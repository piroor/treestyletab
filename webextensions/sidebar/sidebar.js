/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

window.addEventListener('DOMContentLoaded', init, { once: true });

function init() {
  window.addEventListener('unload', destroy, { once: true });
  gAllTabs = document.getElementById('all-tabs');
  gAllTabs.addEventListener('mousedown', omMouseDown);
  rebuildAll();
}

function destroy() {
  endObserveTabs();
  gAllTabs.removeEventListener('mousedown', omMouseDown);
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
    let tab = findTabById(tabInfo.id);
    if (tabInfo.parent)
      tab.setAttribute(kPARENT, tabInfo.parent);
    tab.setAttribute(kCHILDREN, tabInfo.children);
  }
  updateTabsIndent(getAllRootTabs(gTargetWindow), 0);
}
