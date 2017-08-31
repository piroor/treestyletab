/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'BG';

var gInitializing = true;

window.addEventListener('DOMContentLoaded', init, { once: true });

async function init() {
  window.addEventListener('unload', destroy, { once: true });
  gAllTabs = document.querySelector('#all-tabs');

  await configs.$loaded;
  await rebuildAll();

  startObserveApiTabs();
  browser.runtime.onMessage.addListener(onMessage);

  await waitUntilCompletelyRestored();
  await loadTreeStructure();
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
  endObserveApiTabs();
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
  if (!container) {
    browser.sessions.removeWindowValue(
      aWindowId,
      kWINDOW_STATE_TREE_STRUCTURE
    );
  }
  else {
    let window = await browser.windows.get(aWindowId, {
      populate: true,
      windowTypes: ['normal']
    });
    let structure = getTreeStructureFromTabs(getAllTabs(aWindowId));
    browser.sessions.setWindowValue(
      aWindowId,
      kWINDOW_STATE_TREE_STRUCTURE,
      structure
    );
  }
}

async function loadTreeStructure() {
  log('loadTreeStructure');
  var windows = await browser.windows.getAll({
    populate: true,
    windowTypes: ['normal']
  });
  return Promise.all(windows.map(async aWindow => {
    var structure = await browser.sessions.getWindowValue(
      aWindow.id,
      kWINDOW_STATE_TREE_STRUCTURE
    );
    if (structure) {
      log(`tree information for window ${aWindow.id} is available.`);
      await applyTreeStructureToTabs(getAllTabs(aWindow.id), structure);
      browser.runtime.sendMessage({
        type:      kCOMMAND_PUSH_TREE_STRUCTURE,
        windowId:  aWindow.id,
        structure: structure
      });
    }
    else {
      log(`no tree information for the window ${aWindow.id}.`);
    }
  }));
}
