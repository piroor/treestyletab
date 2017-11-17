/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'BG';

var gInitializing           = true;
var gSidebarOpenState       = new Map();
var gSidebarOpenStateUpdateTimer;
var gExternalListenerAddons = {};
var gMaybeTabSwitchingByShortcut = false;

var gMetricsData = new MetricsData();
gMetricsData.add('Loaded');

window.addEventListener('DOMContentLoaded', init, { once: true });

browser.runtime.onInstalled.addListener(aDetails => {
  /* When TST 2 (or later) is newly installed, this listener is invoked.
     We should not notify "updated from legacy" for this case.
     On the other hand, when TST is updated from legacy to 2 (or later),
     this listener is not invoked with the reason "install" and
     invoked with the reason "updated" after Firefox is restarted. */
  if (aDetails.reason == 'install')
    configs.shouldNotifyUpdatedFromLegacyVersion = false;
});

async function init() {
  gMetricsData.add('init start');
  window.addEventListener('pagehide', destroy, { once: true });
  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  browser.windows.onFocusChanged.addListener(() => {
    gMaybeTabSwitchingByShortcut = false;
  });
  gAllTabs = document.querySelector('#all-tabs');
  await configs.$loaded;
  gMetricsData.add('configs.$loaded');

  migrateLegacyConfigs();
  gMetricsData.add('migrateLegacyConfigs');

  await gMetricsData.addAsync('parallel initialization tasks: waitUntilCompletelyRestored, retrieveAllContextualIdentities', Promise.all([
    waitUntilCompletelyRestored(),
    retrieveAllContextualIdentities()
  ]));
  await rebuildAll();
  gMetricsData.add('rebuildAll');
  await loadTreeStructure();
  gMetricsData.add('loadTreeStructure done');

  migrateLegacyTreeStructure();
  gMetricsData.add('migrateLegacyTreeStructure');

  startWatchSidebarOpenState();
  startObserveApiTabs();
  startObserveContextualIdentities();
  browser.runtime.onMessage.addListener(onMessage);

  tabContextMenu.init();

  refreshContextMenuItems();
  configs.$addObserver(aKey => {
    if (aKey.indexOf('context_') == 0)
      refreshContextMenuItems();
  });

  gInitializing = false;

  getAllTabs().forEach(updateSubtreeCollapsed);
  for (let tab of getCurrentTabs()) {
    for (let ancestor of getAncestorTabs(tab)) {
      collapseExpandTabAndSubtree(ancestor, {
        collapsed: false,
        justNow:   true
      });
    }
  }

  // notify that the master process is ready.
  browser.runtime.sendMessage({
    type: kCOMMAND_PING_TO_SIDEBAR
  });

  await readyForExternalAddons();

  notifyUpdatedFromLegacy();
  log('Startup metrics: ', gMetricsData.toString());
}

function waitUntilCompletelyRestored() {
  log('waitUntilCompletelyRestored');
  return new Promise((aResolve, aReject) => {
    var onNewTabRestored = (() => {
      clearTimeout(timeout);
      log('new restored tab is detected.');
      timeout = setTimeout(resolver, 100);
    });
    browser.tabs.onCreated.addListener(onNewTabRestored);
    var resolver = (() => {
      log('timeout: all tabs are restored.');
      browser.tabs.onCreated.removeListener(onNewTabRestored);
      timeout = resolver = onNewTabRestored = undefined;
      aResolve();
    });
    var timeout = setTimeout(resolver, 500);
  });
}

function destroy() {
  browser.runtime.sendMessage(browser.runtime.id, {
    type:  kTSTAPI_UNREGISTER_SELF
  });

  // This API doesn't work as expected because it is not notified to
  // other addons actually when browser.runtime.sendMessage() is called
  // on pagehide or something unloading event.
  sendTSTAPIMessage({
    type: kTSTAPI_NOTIFY_SHUTDOWN
  });

  browser.runtime.onMessage.removeListener(onMessage);
  browser.runtime.onMessageExternal.removeListener(onMessageExternal);
  browser.browserAction.onClicked.removeListener(onToolbarButtonClick);
  endWatchSidebarOpenState();
  endObserveApiTabs();
  endObserveContextualIdentities();
  gAllTabs = undefined;
}

async function rebuildAll() {
  clearAllTabsContainers();
  var windows = await browser.windows.getAll({
    populate:    true,
    windowTypes: ['normal']
  });
  windows.forEach(async aWindow => {
    var container = buildTabsContainerFor(aWindow.id);
    for (let apiTab of aWindow.tabs) {
      let newTab = buildTab(apiTab, { existing: true });
      container.appendChild(newTab);
      updateTab(newTab, apiTab, { forceApply: true });
      tryStartHandleAccelKeyOnTab(newTab);
    }
    gAllTabs.appendChild(container);
  });
}

async function tryStartHandleAccelKeyOnTab(aTab) {
  var granted = await browser.permissions.contains({ origins: ['<all_urls>'] });
  if (!granted ||
      /^(about|chrome|resource):/.test(aTab.apiTab.url))
    return;
  try {
    browser.tabs.executeScript(aTab.apiTab.id, {
      file:            '/common/handle-accel-key.js',
      allFrames:       true,
      matchAboutBlank: true,
      runAt:           'document_start'
    });
  }
  catch(aError) {
    console.log(aError);
  }
}

function startWatchSidebarOpenState() {
  if (gSidebarOpenStateUpdateTimer)
    return;

  gSidebarOpenStateUpdateTimer = setInterval(async () => {
    let windows = await browser.windows.getAll({
      windowTypes: ['normal']
    });
    await Promise.all(windows.map(async aWindow => {
      try {
        var response = await browser.runtime.sendMessage({
          type:     kCOMMAND_PING_TO_SIDEBAR,
          windowId: aWindow.id
        });
        if (response)
          gSidebarOpenState.set(aWindow.id, true);
        else
          gSidebarOpenState.delete(aWindow.id);
      }
      catch(e) {
        gSidebarOpenState.delete(aWindow.id);
      }
    }));
    if (gSidebarOpenState.size == 0)
      endWatchSidebarOpenState();
  }, configs.sidebarOpenStateUpdateInterval);
}

function endWatchSidebarOpenState() {
  if (!gSidebarOpenStateUpdateTimer)
    return;

  clearInterval(gSidebarOpenStateUpdateTimer);
  gSidebarOpenStateUpdateTimer = null;
}



async function readyForExternalAddons() {
  var respondedAddons = [];
  var notifiedAddons = {};
  var notifyAddons = configs.knownExternalAddons.concat(configs.cachedExternalAddons);
  await Promise.all(notifyAddons.map(async aId => {
    if (aId in notifiedAddons)
      return;
    notifiedAddons[aId] = true;
    try {
      let success = await browser.runtime.sendMessage(aId, {
        type: kTSTAPI_NOTIFY_READY
      });
      if (success)
        respondedAddons.push(aId);
    }
    catch(e) {
    }
  }));
  configs.cachedExternalAddons = respondedAddons;
}


// save/load tree structure

function reserveToSaveTreeStructure(aHint) {
  if (gInitializing)
    return;

  var container = getTabsContainer(aHint);
  if (!container)
    return;

  if (container.waitingToSaveTreeStructure)
    clearTimeout(container.waitingToSaveTreeStructure);
  container.waitingToSaveTreeStructure = setTimeout((aWindowId) => {
    saveTreeStructure(aWindowId);
  }, 150, container.windowId);
}
async function saveTreeStructure(aWindowId) {
  var container = getTabsContainer(aWindowId);
  if (!container)
    return;

  var structure = getTreeStructureFromTabs(getAllTabs(aWindowId));
  browser.sessions.setWindowValue(
    aWindowId,
    kWINDOW_STATE_TREE_STRUCTURE,
    structure
  );
}

async function loadTreeStructure() {
  log('loadTreeStructure');
  var windows = await browser.windows.getAll({
    windowTypes: ['normal']
  });
  gMetricsData.add('loadTreeStructure: browser.windows.getAll');
  return gMetricsData.addAsync('loadTreeStructure: restoration for windows', Promise.all(windows.map(async aWindow => {
    var structure = await browser.sessions.getWindowValue(
      aWindow.id,
      kWINDOW_STATE_TREE_STRUCTURE
    );
    gMetricsData.add('loadTreeStructure: browser.sessions.getWindowValue');
    var tabs = getAllTabs(aWindow.id);
    var windowStateCompletelyApplied = structure && structure.length == tabs.length;
    if (structure) {
      applyTreeStructureToTabs(tabs, structure);
      gMetricsData.add('loadTreeStructure: applyTreeStructureToTabs');
    }
    if (!windowStateCompletelyApplied) {
      log(`Tree information for the window ${aWindow.id} is not same to actual state. Fallback to restoration from tab relations.`);
      for (let tab of tabs) {
        await attachTabFromRestoredInfo(tab, {
          keepCurrentTree: true,
          canCollapse:     true
        });
      }
      gMetricsData.add('loadTreeStructure: attachTabFromRestoredInfo');
    }
  })));
}

async function attachTabFromRestoredInfo(aTab, aOptions = {}) {
  log('attachTabFromRestoredInfo ', dumpTab(aTab), aTab.apiTab);
  var uniqueId = await aTab.uniqueId;
  var container = getTabsContainer(aTab);
  var insertBefore, insertAfter, ancestors, children, collapsed;
  [insertBefore, insertAfter, ancestors, children, collapsed] = await Promise.all([
    browser.sessions.getTabValue(aTab.apiTab.id, kPERSISTENT_INSERT_BEFORE),
    browser.sessions.getTabValue(aTab.apiTab.id, kPERSISTENT_INSERT_AFTER),
    browser.sessions.getTabValue(aTab.apiTab.id, kPERSISTENT_ANCESTORS),
    browser.sessions.getTabValue(aTab.apiTab.id, kPERSISTENT_CHILDREN),
    browser.sessions.getTabValue(aTab.apiTab.id, kPERSISTENT_SUBTREE_COLLAPSED)
  ]);
  ancestors = ancestors || [];
  children  = children  || [];
  log(`persistent references for ${aTab.id} (${uniqueId.id}): `, {
    insertBefore, insertAfter,
    ancestors: ancestors.join(', '),
    children:  children.join(', '),
    collapsed
  });
  insertBefore = getTabByUniqueId(insertBefore);
  insertAfter  = getTabByUniqueId(insertAfter);
  ancestors    = ancestors.map(getTabByUniqueId);
  children     = children.map(getTabByUniqueId);
  log(' => references: ', {
    insertBefore: dumpTab(insertBefore),
    insertAfter:  dumpTab(insertAfter),
    ancestors:    ancestors.map(dumpTab).join(', '),
    children:     children.map(dumpTab).join(', ')
  });
  var attached = false;
  var active   = isActive(aTab);
  for (let ancestor of ancestors) {
    if (!ancestor)
      continue;
    await attachTabTo(aTab, ancestor, {
      insertBefore,
      insertAfter,
      dontExpand:  !active,
      forceExpand: active,
      broadcast:   true
    });
    attached = true;
    break;
  }
  var opener = getOpenerTab(aTab);
  if (!attached &&
      opener &&
      configs.syncParentTabAndOpenerTab) {
    await attachTabTo(aTab, opener, {
      dontExpand:  !active,
      forceExpand: active,
      broadcast:   true,
      insertAt:    kINSERT_NEAREST
    });
  }
  if (!aOptions.keepCurrentTree &&
      // the restored tab is a roo tab
      ancestors.length == 0 &&
      // but attached to any parent based on its restored position
      getParentTab(aTab) &&
      // when not in-middle position of existing tree (safely detachable position)
      !getNextSiblingTab(aTab)) {
    detachTab(aTab, {
      broadcast: true
    });
  }
  var isWindowRestoring = container.restoringTabsCount > 1;
  if (aOptions.children && !isWindowRestoring) {
    for (let child of children) {
      if (!child)
        continue;
      await attachTabTo(child, aTab, {
        dontExpand:  !isActive(child),
        forceExpand: active,
        insertAt:    kINSERT_NEAREST,
        broadcast:   true
      });
    }
  }
  isWindowRestoring = isWindowRestoring || container.restoringTabsCount > 1; // the status can be updated while waiting
  if (aOptions.canCollapse || isWindowRestoring) {
    collapseExpandSubtree(aTab, {
      broadcast: true,
      collapsed
    });
  }
}


function reserveToUpdateInsertionPosition(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
    if (!ensureLivingTab(tab))
      continue;
    if (tab.reservedUpdateInsertionPosition)
      clearTimeout(tab.reservedUpdateInsertionPosition);
    tab.reservedUpdateInsertionPosition = setTimeout(() => {
      delete tab.reservedUpdateInsertionPosition;
      updateInsertionPosition(tab);
    }, 100);
  }
}

async function updateInsertionPosition(aTab) {
  if (!ensureLivingTab(aTab))
    return;

  var prev = getPreviousTab(aTab);
  if (prev)
    prev.uniqueId.then(aId =>
      browser.sessions.setTabValue(
        aTab.apiTab.id,
        kPERSISTENT_INSERT_AFTER,
        aId.id
      )
    );
  else
    browser.sessions.removeTabValue(
      aTab.apiTab.id,
      kPERSISTENT_INSERT_AFTER
    );

  var next = getNextTab(aTab);
  if (next)
    next.uniqueId.then(aId =>
      browser.sessions.setTabValue(
        aTab.apiTab.id,
        kPERSISTENT_INSERT_BEFORE,
        aId.id
      )
    );
  else
    browser.sessions.removeTabValue(
      aTab.apiTab.id,
      kPERSISTENT_INSERT_BEFORE
    );
}

function reserveToUpdateAncestors(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
    if (!ensureLivingTab(tab))
      continue;
    if (tab.reservedUpdateAncestors)
      clearTimeout(tab.reservedUpdateAncestors);
    tab.reservedUpdateAncestors = setTimeout(() => {
      delete tab.reservedUpdateAncestors;
      updateAncestors(tab);
    }, 100);
  }
}

async function updateAncestors(aTab) {
  if (!ensureLivingTab(aTab))
    return;

  var ancestorIds = await Promise.all(
    getAncestorTabs(aTab)
      .map(aAncestor => aAncestor.uniqueId)
  );
  browser.sessions.setTabValue(
    aTab.apiTab.id,
    kPERSISTENT_ANCESTORS,
    ancestorIds.map(aId => aId.id)
  );
}

function reserveToUpdateChildren(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
    if (!ensureLivingTab(tab))
      continue;
    if (tab.reservedUpdateChildren)
      clearTimeout(tab.reservedUpdateChildren);
    tab.reservedUpdateChildren = setTimeout(() => {
      delete tab.reservedUpdateChildren;
      updateChildren(tab);
    }, 100);
  }
}

async function updateChildren(aTab) {
  if (!ensureLivingTab(aTab))
    return;

  var childIds = await Promise.all(
    getChildTabs(aTab)
      .map(aChild => aChild.uniqueId)
  );
  browser.sessions.setTabValue(
    aTab.apiTab.id,
    kPERSISTENT_CHILDREN,
    childIds.map(aId => aId.id)
  );
}

function reserveToUpdateSubtreeCollapsed(aTab) {
  if (gInitializing ||
      !ensureLivingTab(aTab))
    return;
  if (aTab.reservedUpdateSubtreeCollapsed)
    clearTimeout(aTab.reservedUpdateSubtreeCollapsed);
  aTab.reservedUpdateSubtreeCollapsed = setTimeout(() => {
    delete aTab.reservedUpdateSubtreeCollapsed;
    updateSubtreeCollapsed(aTab);
  }, 100);
}

async function updateSubtreeCollapsed(aTab) {
  if (!ensureLivingTab(aTab))
    return;
  browser.sessions.setTabValue(
    aTab.apiTab.id,
    kPERSISTENT_SUBTREE_COLLAPSED,
    isSubtreeCollapsed(aTab)
  );
}

function reserveToRemoveNeedlessGroupTab(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
    if (!ensureLivingTab(tab))
      continue;
    if (tab.reservedRemoveNeedlessGroupTab)
      clearTimeout(tab.reservedRemoveNeedlessGroupTab);
    tab.reservedRemoveNeedlessGroupTab = setTimeout(() => {
      delete tab.reservedRemoveNeedlessGroupTab;
      removeNeedlessGroupTab(tab);
    }, 100);
  }
}

async function removeNeedlessGroupTab(aTab) {
  if (hasChildTabs(aTab))
    return;
  removeTabInternally(aTab);
}
