/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function init() {
  gIsBackground = true;
  window.addEventListener('unload', destroy, { once: true });
  gAllTabs = document.getElementById('all-tabs');
  startObserveTabs();
  rebuildAll();
}

function destroy() {
  endObserveTabs();
  gAllTabs = undefined;
}

function rebuildAll() {
  clearAllTabsContainers();
  chrome.windows.getAll({
    populate: true,
    windowTypes: ['normal']
  }).then((aWindows) => {
    aWindows.forEach((aWindow) => {
      var container = buildTabsContainerFor(aWindow.id);
      for (let tab of aWindow.tabs) {
        container.appendChild(buildTab(tab));
      }
      gAllTabs.appendChild(container);
    });
  });
}

window.addEventListener('DOMContentLoaded', init, { once: true });
