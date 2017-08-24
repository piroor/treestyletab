/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

gIsBackground = true;
gLogContext = 'BG';

window.addEventListener('DOMContentLoaded', init, { once: true });

async function init() {
  window.addEventListener('unload', destroy, { once: true });
  gAllTabs = document.querySelector('#all-tabs');
  gAllTabs.addEventListener(kEVENT_TAB_OPENED, onTabOpened);
  gAllTabs.addEventListener(kEVENT_TAB_CLOSED, onTabClosed);
  gAllTabs.addEventListener(kEVENT_TAB_MOVED, onTabMoved);
  gAllTabs.addEventListener(kEVENT_TAB_FOCUSING, onTabFocusing);
  gAllTabs.addEventListener(kEVENT_TAB_FOCUSED, onTabFocused);
  gAllTabs.addEventListener(kEVENT_TAB_UPDATED, onTabUpdated);

  await configs.$loaded;
  await rebuildAll();

  startObserveApiTabs();
  browser.runtime.onMessage.addListener(onMessage);

  await waitUntilCompletelyRestored();
  await loadTreeStructure();
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

  gAllTabs.removeEventListener(kEVENT_TAB_OPENED, onTabOpened);
  gAllTabs.removeEventListener(kEVENT_TAB_CLOSED, onTabClosed);
  gAllTabs.removeEventListener(kEVENT_TAB_MOVED, onTabMoved);
  gAllTabs.removeEventListener(kEVENT_TAB_FOCUSING, onTabFocusing);
  gAllTabs.removeEventListener(kEVENT_TAB_FOCUSED, onTabFocused);
  gAllTabs.removeEventListener(kEVENT_TAB_UPDATED, onTabUpdated);

  gAllTabs = undefined;
}

async function rebuildAll() {
  clearAllTabsContainers();
  var windows = await browser.windows.getAll({
    populate: true,
    windowTypes: ['normal']
  });
  windows.forEach((aWindow) => {
    var container = buildTabsContainerFor(aWindow.id);
    for (let tab of aWindow.tabs) {
      container.appendChild(buildTab(tab, { existing: true }));
    }
    gAllTabs.appendChild(container);
  });
}


// save/load tree structure

var gTreeStructures = {};

function reserveToSaveTreeStructure(aHint) {
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
    delete gTreeStructures[aWindowId];
  }
  else {
    container.waitingToSaveTreeStructure = null;
    let window = await browser.windows.get(aWindowId, {
      populate: true,
      windowTypes: ['normal']
    });
    gTreeStructures[aWindowId] = {
      signature: getTabsSignature(window.tabs),
      structure: getTreeStructureFromTabs(getAllTabs(aWindowId))
    };
  }
  var sanitizedStructure = {};
  Object.keys(gTreeStructures).forEach(aId => {
    var structure = gTreeStructures[aId];
    sanitizedStructure[structure.signature] = structure.structure;
  });
  configs.treeStructure = sanitizedStructure;
}

async function loadTreeStructure() {
  var structures = configs.treeStructure;
  if (!structures)
    return;

  log('loadTreeStructure: ', structures);
  var windows = await browser.windows.getAll({
    populate: true,
    windowTypes: ['normal']
  });
  for (let window of windows) {
    let signature = getTabsSignature(window.tabs);
    let structure = structures[signature];
    if (structure) {
      log(`tree information for window ${window.id} is available.`);
      applyTreeStructureToTabs(getAllTabs(window.id), structure);
      browser.runtime.sendMessage({
        type:      kCOMMAND_PUSH_TREE_STRUCTURE,
        windowId:  window.id,
        structure: structure
      });
    }
    else {
      log(`no tree information for the window ${window.id}. `, signature, getTabsSignatureSource(window.tabs));
    }
  }
}

function getTabsSignatureSource(aApiTabs) {
  return aApiTabs.map(aTab => {
    return {
      audible:   aTab.audible,
      incognito: aTab.incognito,
      pinned:    aTab.pinned,
      title:     aTab.title,
      url:       aTab.url
    };
  })
};

function getTabsSignature(aApiTabs) {
  return md5(JSON.stringify(getTabsSignatureSource(aApiTabs)));
}


async function onMessage(aMessage, aSender, aRespond) {
  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_PULL_TREE_STRUCTURE: {
      log(`tree structure is requested from ${aMessage.windowId}`);
      let structure = getTreeStructureFromTabs(getAllTabs(aMessage.windowId));
      // By some reason the requestor can receive "undefined" as the response...
      // For safely we resend the information as a "PUSH" message.
      browser.runtime.sendMessage({
        type:      kCOMMAND_PUSH_TREE_STRUCTURE,
        windowId:  aMessage.windowId,
        structure: structure
      });
      aRespond({ structure: structure });
    }; break;

    case kCOMMAND_PUSH_SUBTREE_COLLAPSED_STATE: {
      let tab = getTabById(aMessage.tab);
      if (!tab)
        return;
      let params = {
        collapsed:      aMessage.collapsed,
        justNow:        true,
        fromBackground: true
      };
      if (aMessage.manualOperation)
        manualCollapseExpandSubtree(tab, params);
      else
        collapseExpandSubtree(tab, params);
      reserveToSaveTreeStructure(tab);
    }; break;

    case kCOMMAND_NEW_TAB: {
      log('new tab requested: ', aMessage);
      let params = { windowId: aMessage.windowId };
      // params.openerTabId = ?
      params.active = !aMessage.accel;
      browser.tabs.create(params);
    }; break;

    case kCOMMAND_REMOVE_TAB: {
      let tab = getTabById(aMessage.tab);
      if (!tab)
        return;
      if (isActive(tab))
        await tryMoveFocusFromClosingCurrentTab(tab);
      browser.tabs.remove(tab.apiTab.id);
    }; break;

    case kCOMMAND_SELECT_TAB: {
      let tab = getTabById(aMessage.tab);
      if (!tab)
        return;
      browser.tabs.update(tab.apiTab.id, { active: true });
    }; break;

    case kCOMMAND_SELECT_TAB_INTERNALLY: {
      let tab = getTabById(aMessage.tab);
      if (!tab)
        return;
      selectTabInternally(tab);
    }; break;
  }
}
