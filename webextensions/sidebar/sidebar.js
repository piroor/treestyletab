/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

gIsBackground = false;
gLogContext = 'Sidebar';

window.addEventListener('DOMContentLoaded', init, { once: true });

async function init() {
  window.addEventListener('unload', destroy, { once: true });
  gAllTabs = document.getElementById('all-tabs');
  gAllTabs.addEventListener('mousedown', onMouseDown);
  await rebuildAll();
  browser.runtime.onMessage.addListener(onMessage);
  document.documentElement.setAttribute(kTWISTY_STYLE, configs.twistyStyle);
}

function destroy() {
  browser.runtime.onMessage.removeListener(onMessage);
  endObserveTabs();
  gAllTabs.removeEventListener('mousedown', onMouseDown);
  gAllTabs = undefined;
}

async function rebuildAll() {
  var tabs = await browser.tabs.query({ currentWindow: true });
  gTargetWindow = tabs[0].windowId;
  clearAllTabsContainers();
  var container = buildTabsContainerFor(gTargetWindow);
  for (let tab of tabs) {
    container.appendChild(buildTab(tab, { existing: true }));
  }
  gAllTabs.appendChild(container);
  await inheritTreeStructure();
  startObserveTabs();
}

async function inheritTreeStructure() {
  var response = await browser.runtime.sendMessage({
    type:     kCOMMAND_PULL_TREE_STRUCTURE,
    windowId: gTargetWindow
  });
  log('response: ', response);
  applyTreeStructureToTabs(getAllTabs(gTargetWindow), response.structure);
}


function onMessage(aMessage, aSender, aRespond) {
  log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_PUSH_TREE_STRUCTURE:
      if (aMessage.windowId == gTargetWindow)
        applyTreeStructureToTabs(getAllTabs(gTargetWindow), aMessage.structure);
      break;

    case kCOMMAND_PUSH_SUBTREE_COLLAPSED_STATE:
      if (aMessage.windowId == gTargetWindow) {
        let tab = getTabById(aMessage.tab);
        let params = {
          collapsed: aMessage.collapsed,
          justNow:   !aMessage.manualOperation,
          noPush:    true
        };
        if (aMessage.manualOperation)
          manualCollapseExpandSubtree(tab, params);
        else
          collapseExpandSubtree(tab, params);
      }
      break;
  }
}


function collapseExpandAllSubtree(aParams = {}) {
  var container = getTabsContainer(gTargetWindow);
  var subtreeCondition = aParams.collapsed ?
        `:not(.${kTAB_STATE_SUBTREE_COLLAPSED})` :
        `.${kTAB_STATE_SUBTREE_COLLAPSED}`
  var tabs = container.querySelectorAll(`.tab:not([${kCHILDREN}="|"])${subtreeCondition}`);
  for (let tab of tabs) {
    collapseExpandSubtree(tab, aParams);
  }
}
