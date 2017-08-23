/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

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
    container.appendChild(buildTab(tab));
  }
  gAllTabs.appendChild(container);
  await inheritTreeStructure();
  startObserveTabs();
}

async function inheritTreeStructure() {
  var response = await browser.runtime.sendMessage({
    type:     kCOMMAND_REQUEST_TREE_INFO,
    windowId: gTargetWindow
  });
  log('response: ', response);
  for (let tabInfo of response.tabs) {
    let tab = getTabById(tabInfo.id);
    if (tabInfo.parent)
      tab.setAttribute(kPARENT, tabInfo.parent);
    tab.setAttribute(kCHILDREN, tabInfo.children);
  }
  updateTabsIndent(getAllRootTabs(gTargetWindow), 0);
}


function onMessage(aMessage, aSender, aRespond) {
  log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_APPLY_TREE_STRUCTURE:
      if (aMessage.windowId == gTargetWindow)
        applyTreeStructureToTabs(getAllTabs(gTargetWindow), aMessage.structure);
      break;
  }
}
