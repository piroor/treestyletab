/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'BG';

var gInitializing = true;
var gSidebarOpenState = new Map();
var gSidebarOpenStateUpdateTimer;

window.addEventListener('DOMContentLoaded', init, { once: true });

async function init() {
  window.addEventListener('unload', destroy, { once: true });
  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
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

  startWatchSidebarOpenState();
  startObserveApiTabs();
  startObserveContextualIdentities();
  browser.runtime.onMessage.addListener(onMessage);
  gInitializing = false;
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
  browser.runtime.onMessage.removeListener(onMessage);
  browser.browserAction.onClicked.removeListener(onToolbarButtonClick);
  endWatchSidebarOpenState();
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

function startWatchSidebarOpenState() {
  if (gSidebarOpenStateUpdateTimer)
    return;

  gSidebarOpenStateUpdateTimer = setInterval(async () => {
    let windows = await browser.windows.getAll({
      windowTypes: ['normal']
    });
    windows.forEach(async aWindow => {
      var response = await browser.runtime.sendMessage({
        type:     kCOMMAND_PING_TO_SIDEBAR,
        windowId: aWindow.id
      });
      if (response)
        gSidebarOpenState.set(aWindow.id, true);
      else
        gSidebarOpenState.delete(aWindow.id);
    });
  }, configs.sidebarOpenStateUpdateInterval);
}

function endWatchSidebarOpenState() {
  if (!gSidebarOpenStateUpdateTimer)
    return;

  clearInterval(gSidebarOpenStateUpdateTimer);
  gSidebarOpenStateUpdateTimer = null;
}

function getCloseParentBehaviorForTabWithSidebarOpenState(aTab) {
  if (configs.parentTabBehaviorForChanges == kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE &&
      !gSidebarOpenState.has(aTab.apiTab.windowId))
    return kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  return getCloseParentBehaviorForTab(aTab);
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
    if (structure && structure.length == tabs.length) {
      await applyTreeStructureToTabs(tabs, structure);
    }
    else {
      log(`Tree information for the window ${aWindow.id} is not available. Fallback to restoration from tab relations.`);
      for (let tab of tabs) {
        await attachTabFromRestoredInfo(tab);
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
  if (aOptions.chilren) {
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
