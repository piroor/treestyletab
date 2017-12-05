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
  var restoredFromCache = await rebuildAll();
  gMetricsData.add(`rebuildAll (cached: ${JSON.stringify(restoredFromCache)})`);
  await loadTreeStructure(restoredFromCache);
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
    switch (aKey) {
      case 'useCachedTree':
        browser.windows.getAll({
          populate:    true,
          windowTypes: ['normal']
        }).then(aWindows => {
          for (let window of aWindows) {
            let owner = window.tabs[window.tabs.length - 1];
            if (configs[aKey])
              reserveToCacheTree(owner);
            else
              clearWindowCache(owner);
          }
        });
        break;

      default:
        if (aKey.indexOf('context_') == 0)
          refreshContextMenuItems();
        break;
    }
  });

  Permissions.clearRequest();

  gInitializing = false;

  for (let windowId of Object.keys(restoredFromCache)) {
    if (!restoredFromCache[windowId])
      reserveToCacheTree(parseInt(windowId));
  }

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

  notifyNewFeatures();
  log('Startup metrics: ', gMetricsData.toString());
}

function waitUntilCompletelyRestored() {
  log('waitUntilCompletelyRestored');
  return new Promise((aResolve, aReject) => {
    var onNewTabRestored = async (aNewApiTab) => {
      clearTimeout(timeout);
      log('new restored tab is detected.');
      var uniqueId = await browser.sessions.getTabValue(aNewApiTab.id, kPERSISTENT_ID);
      //uniqueId = uniqueId && uniqueId.id || '?'; // not used
      timeout = setTimeout(resolver, 100);
    };
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
  var insertionPoint = document.createRange();
  insertionPoint.selectNodeContents(gAllTabs);
  var restoredFromCache = {};
  await Promise.all(windows.map(aWindow =>
    gMetricsData.addAsync(`rebuild ${aWindow.id}`, async () => {
      if (configs.useCachedTree) {
        restoredFromCache[aWindow.id] = await restoreWindowFromEffectiveWindowCache(aWindow.id, {
          insertionPoint,
          owner: aWindow.tabs[aWindow.tabs.length - 1].id,
          tabs:  aWindow.tabs
        });
        if (restoredFromCache[aWindow.id]) {
          log(`window ${aWindow.id} is restored from cache`);
          return;
        }
      }
      log(`build tabs for ${aWindow.id} from scratch`);
      let container = buildTabsContainerFor(aWindow.id);
      for (let apiTab of aWindow.tabs) {
        let newTab = buildTab(apiTab, { existing: true });
        container.appendChild(newTab);
        updateTab(newTab, apiTab, { forceApply: true });
        tryStartHandleAccelKeyOnTab(newTab);
      }
      gAllTabs.appendChild(container);
      restoredFromCache[aWindow.id] = false;
    })
  ));
  insertionPoint.detach();
  return restoredFromCache;
}

async function tryStartHandleAccelKeyOnTab(aTab) {
  if (!ensureLivingTab(aTab))
    return;
  var granted = await Permissions.isGranted(Permissions.ALL_URLS);
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
  container.waitingToSaveTreeStructure = setTimeout(aWindowId => {
    saveTreeStructure(aWindowId);
  }, 150, parseInt(container.dataset.windowId));
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

async function loadTreeStructure(aRestoredFromCacheResults) {
  log('loadTreeStructure');
  var windows = await browser.windows.getAll({
    windowTypes: ['normal']
  });
  gMetricsData.add('loadTreeStructure: browser.windows.getAll');
  return gMetricsData.addAsync('loadTreeStructure: restoration for windows', Promise.all(windows.map(async aWindow => {
    if (aRestoredFromCacheResults &&
        aRestoredFromCacheResults[aWindow.id]) {
      log(`skip tree structure restoration for window ${aWindow.id} (restored from cache)`);
      return;
    }
    var tabs = getAllTabs(aWindow.id);
    var [structure, uniqueIds] = await Promise.all([
      browser.sessions.getWindowValue(aWindow.id, kWINDOW_STATE_TREE_STRUCTURE),
      getUniqueIds(tabs.map(aTab => aTab.apiTab))
    ]);
    gMetricsData.add('loadTreeStructure: read stored data');
    var windowStateCompletelyApplied = false;
    if (structure && structure.length <= tabs.length) {
      uniqueIds = uniqueIds.map(aId => aId.id);
      let tabsOffset, windowStateCompletelyApplied;
      if (structure[0].id) {
        tabsOffset = uniqueIds.join('\n').indexOf(structure.map(aItem => aItem.id).join('\n'));
        windowStateCompletelyApplied = tabsOffset > -1;
      }
      else {
        tabsOffset = 0;
        windowStateCompletelyApplied = structure.length == tabs.length;
      }
      if (tabsOffset > -1) {
        applyTreeStructureToTabs(tabs.slice(tabsOffset), structure);
        gMetricsData.add('loadTreeStructure: applyTreeStructureToTabs');
      }
    }
    if (!windowStateCompletelyApplied) {
      log(`Tree information for the window ${aWindow.id} is not same to actual state. Fallback to restoration from tab relations.`);
      for (let tab of tabs) {
        reserveToAttachTabFromRestoredInfo(tab, {
          keepCurrentTree: true,
          canCollapse:     true
        });
      }
      gMetricsData.add('loadTreeStructure: attachTabFromRestoredInfo');
    }
    dumpAllTabs();
  })));
}

function reserveToAttachTabFromRestoredInfo(aTab, aOptions = {}) {
  if (reserveToAttachTabFromRestoredInfo.waiting)
    clearTimeout(reserveToAttachTabFromRestoredInfo.waiting);
  reserveToAttachTabFromRestoredInfo.tasks.push({ tab: aTab, options: aOptions });
  reserveToAttachTabFromRestoredInfo.waiting = setTimeout(async () => {
    reserveToAttachTabFromRestoredInfo.waiting = null;
    var tasks = reserveToAttachTabFromRestoredInfo.tasks.slice(0);
    reserveToAttachTabFromRestoredInfo.tasks = [];
    var uniqueIds = await Promise.all(tasks.map(aTask => aTask.tab.uniqueId));
    var bulk = tasks.length > 1;
    uniqueIds.forEach((aUniqueId, aIndex) => {
      var task = tasks[aIndex];
      attachTabFromRestoredInfo(task.tab, clone(task.options, {
        uniqueId: aUniqueId,
        bulk
      }));
    });
  }, 100);
}
reserveToAttachTabFromRestoredInfo.waiting = null;
reserveToAttachTabFromRestoredInfo.tasks   = [];

async function attachTabFromRestoredInfo(aTab, aOptions = {}) {
  log('attachTabFromRestoredInfo ', dumpTab(aTab), aTab.apiTab);
  browser.runtime.sendMessage({
    type:   kCOMMAND_NOTIFY_TAB_RESTORING,
    tab:    aTab.apiTab.id,
    window: aTab.apiTab.windowId
  });
  var uniqueId = aOptions.uniqueId || await aTab.uniqueId;
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
    let done = attachTabTo(aTab, ancestor, {
      insertBefore,
      insertAfter,
      dontExpand:  !active,
      forceExpand: active,
      broadcast:   true
    });
    if (!aOptions.bulk)
      await done;
    attached = true;
    break;
  }
  var opener = getOpenerTab(aTab);
  if (!attached &&
      opener &&
      configs.syncParentTabAndOpenerTab) {
    log(' attach to opener: ', { child: dumpTab(aTab), parent: dumpTab(opener) });
    let done = attachTabTo(aTab, opener, {
      dontExpand:  !active,
      forceExpand: active,
      broadcast:   true,
      insertAt:    kINSERT_NEAREST
    });
    if (!aOptions.bulk)
      await done;
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
  if (aOptions.children && !aOptions.bulk) {
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
  if (aOptions.canCollapse || aOptions.bulk) {
    collapseExpandSubtree(aTab, {
      broadcast: true,
      collapsed
    });
  }
  browser.runtime.sendMessage({
    type:   kCOMMAND_NOTIFY_TAB_RESTORED,
    tab:    aTab.apiTab.id,
    window: aTab.apiTab.windowId
  });
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

function reserveToCleanupNeedlessGroupTab(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
    if (!ensureLivingTab(tab))
      continue;
    if (tab.reservedCleanupNeedlessGroupTab)
      clearTimeout(tab.reservedCleanupNeedlessGroupTab);
    tab.reservedCleanupNeedlessGroupTab = setTimeout(() => {
      delete tab.reservedCleanupNeedlessGroupTab;
      cleanupNeedlssGroupTab(tab);
    }, 100);
  }
}

function cleanupNeedlssGroupTab(aTabs) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];
  log('trying to clanup needless temporary group tabs from ', aTabs.map(dumpTab));
  var tabsToBeRemoved = [];
  for (let tab of aTabs) {
    if (!isTemporaryGroupTab(tab))
      break;
    if (getChildTabs(tab).length > 1)
      break;
    let lastChild = getFirstChildTab(tab);
    if (lastChild && !isTemporaryGroupTab(lastChild))
      break;
    tabsToBeRemoved.push(tab);
  }
  log('=> to be removed: ', tabsToBeRemoved.map(dumpTab));
  removeTabsInternally(tabsToBeRemoved);
}
