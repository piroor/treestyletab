/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function init() {
  window.addEventListener('unload', destroy, { once: true });
  gAllTabs = document.getElementById('all-tabs');
  gAllTabs.addEventListener('mousedown', omMouseDown);
  startObserveTabs();
  rebuildAll();
}

function destroy() {
  endObserveTabs();
  gAllTabs.removeEventListener('mousedown', omMouseDown);
  gAllTabs = undefined;
}

function rebuildAll() {
  browser.tabs.query({ currentWindow: true }).then(aTabs => {
    clearAllTabsContainers();
    var container = buildTabsContainerFor(aTabs[0].windowId);
    for (let tab of aTabs) {
      container.appendChild(buildTab(tab));
    }
    gAllTabs.appendChild(container);
  });
}

window.addEventListener('DOMContentLoaded', init, { once: true });
