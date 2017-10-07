/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'BG';

var gInitializing = true;
var gSidebarOpenState = new Map();
var gExternalListenerAddons = {};

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
  window.addEventListener('pagehide', destroy, { once: true });
  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  gAllTabs = document.querySelector('#all-tabs');
  await configs.$loaded;

  migrateLegacyConfigs();

  await Promise.all([
    waitUntilCompletelyRestored(),
    retrieveAllContextualIdentities()
  ]);
  await rebuildAll();
  await loadTreeStructure();

  migrateLegacyTreeStructure();

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

  // notify that the master process is ready.
  browser.runtime.sendMessage({
    type: kCOMMAND_PING_TO_SIDEBAR
  });

  await readyForExternalAddons();

  notifyUpdatedFromLegacy();
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
  endObserveApiTabs();
  endObserveContextualIdentities();
  gAllTabs = undefined;
}

async function rebuildAll() {
  clearAllTabsContainers();
  var windows = await browser.windows.getAll({
    populate: true,
    windowTypes: ['normal']
  });
  windows.forEach(async aWindow => {
    var container = buildTabsContainerFor(aWindow.id);
    for (let apiTab of aWindow.tabs) {
      let newTab = buildTab(apiTab, { existing: true });
      container.appendChild(newTab);
      updateTab(newTab, apiTab, { forceApply: true });
    }
    gAllTabs.appendChild(container);
  });
}

function getCloseParentBehaviorForTabWithSidebarOpenState(aTab) {
  return getCloseParentBehaviorForTab(aTab, {
    keepChildren: configs.parentTabBehaviorForChanges == kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE &&
                  !configs.alwaysApplyTreeBehavior &&
                  !gSidebarOpenState.has(aTab.apiTab.windowId)
  });
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

  var window = await browser.windows.get(aWindowId, {
    windowTypes: ['normal']
  });
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
  return Promise.all(windows.map(async aWindow => {
    var structure = await browser.sessions.getWindowValue(
      aWindow.id,
      kWINDOW_STATE_TREE_STRUCTURE
    );
    var tabs = getAllTabs(aWindow.id);
    var windowStateCompletelyApplied = structure && structure.length == tabs.length;
    if (structure)
      await applyTreeStructureToTabs(tabs, structure);
    if (!windowStateCompletelyApplied) {
      log(`Tree information for the window ${aWindow.id} is not same to actual state. Fallback to restoration from tab relations.`);
      for (let tab of tabs) {
        await attachTabFromRestoredInfo(tab, {
          keepCurrentTree: true
        });
      }
    }
  }));
}

async function attachTabFromRestoredInfo(aTab, aOptions = {}) {
  log('attachTabFromRestoredInfo ', dumpTab(aTab), aTab.apiTab);
  await aTab.uniqueId;
  var insertBefore, insertAfter, ancestors, children;
  [insertBefore, insertAfter, ancestors, children] = await Promise.all([
    browser.sessions.getTabValue(aTab.apiTab.id, kPERSISTENT_INSERT_BEFORE),
    browser.sessions.getTabValue(aTab.apiTab.id, kPERSISTENT_INSERT_AFTER),
    browser.sessions.getTabValue(aTab.apiTab.id, kPERSISTENT_ANCESTORS),
    browser.sessions.getTabValue(aTab.apiTab.id, kPERSISTENT_CHILDREN)
  ]);
  ancestors = ancestors || [];
  children  = children  || [];
  log('persistent references: ', insertBefore, insertAfter, ancestors, children);
  insertBefore = getTabByUniqueId(insertBefore);
  insertAfter  = getTabByUniqueId(insertAfter);
  ancestors    = ancestors.map(getTabByUniqueId);
  children     = children.map(getTabByUniqueId);
  log(' => references: ', dumpTab(insertBefore), dumpTab(insertAfter), ancestors.map(dumpTab), children.map(dumpTab));
  for (let ancestor of ancestors) {
    if (!ancestor)
      continue;
    await attachTabTo(aTab, ancestor, {
      broadcast: true,
      dontMove: insertBefore || insertAfter,
      insertBefore: insertBefore,
      insertAfter:  insertAfter
    });
    break;
  }
  if (
      !aOptions.keepCurrentTree &&
      ancestors.length == 0 && // the restored tab is a roo tab
      getParentTab(aTab) && // but attached to any parent based on its restored position
      !getNextSiblingTab(aTab) // when not in-middle position of existing tree (safely detachable position)
      ) {
    detachTab(aTab, {
      broadcast: true
    });
  }
  if (aOptions.children) {
    for (let child of children) {
      if (!child)
        continue;
      await attachTabTo(child, aTab, {
        broadcast: true
      });
    }
  }
}


function reserveToUpdateInsertionPosition(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
    if (!tab || !tab.parentNode)
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
  if (!aTab || !aTab.parentNode)
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
    if (!tab || !tab.parentNode)
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
  if (!aTab || !aTab.parentNode)
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
    if (!tab || !tab.parentNode)
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
  if (!aTab || !aTab.parentNode)
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

function reserveToRemoveNeedlessGroupTab(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
    if (!tab || !tab.parentNode)
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
  browser.tabs.remove(aTab.apiTab.id)
    .catch(handleMissingTabError);
}
