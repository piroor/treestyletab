/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

window.addEventListener('DOMContentLoaded', init, { once: true });

async function init() {
  gIsBackground = true;
  window.addEventListener('unload', destroy, { once: true });
  gAllTabs = document.getElementById('all-tabs');
  startObserveTabs();
  await rebuildAll();
  browser.runtime.onMessage.addListener(onMessage);
}

function destroy() {
  browser.runtime.onMessage.removeListener(onMessage);
  endObserveTabs();
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
      container.appendChild(buildTab(tab));
    }
    gAllTabs.appendChild(container);
  });
}

function onMessage(aMessage, aSender, aRespond) {
  log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_REQUEST_TREE_INFO:
      aRespond({
        tabs: getAllTabs(aMessage.windowId).map(aTab => {
          return {
            id:       aTab.id,
            parent:   aTab.getAttribute(kPARENT),
            children: aTab.getAttribute(kCHILDREN)
          }
        })
      });
      break;

    default:
      break;
  }
}
