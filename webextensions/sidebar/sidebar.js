/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

gIsBackground = false;
gLogContext = 'Sidebar';

var gTabBar;
var gAfterTabsForOverflowTabBar;

window.addEventListener('DOMContentLoaded', init, { once: true });

async function init() {
  window.addEventListener('unload', destroy, { once: true });
  window.addEventListener('resize', onResize);
  gTabBar = document.querySelector('#tabbar');
  gAfterTabsForOverflowTabBar = document.querySelector('#tabbar ~ .after-tabs');
  gAllTabs = document.querySelector('#all-tabs');
  gTabBar.addEventListener('mousedown', onMouseDown);
  gTabBar.addEventListener('click', onClick);
  gTabBar.addEventListener('dblclick', onDblClick);
  await configs.$loaded;
  await rebuildAll();
  checkTabbarOverflow();
  browser.runtime.onMessage.addListener(onMessage);
  document.documentElement.setAttribute(kTWISTY_STYLE, configs.twistyStyle);
  if (configs.debug)
    document.documentElement.classList.add('debug');
}

function destroy() {
  browser.runtime.onMessage.removeListener(onMessage);
  endObserveTabs();
  window.removeEventListener('resize', onResize);
  gTabBar.removeEventListener('mousedown', onMouseDown);
  gTabBar.removeEventListener('click', onClick);
  gTabBar.removeEventListener('dblclick', onDblClick);
  gAllTabs = gTabBar = gAfterTabsForOverflowTabBar = undefined;
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
  if (response)
    applyTreeStructureToTabs(getAllTabs(gTargetWindow), response.structure);
}


function onMessage(aMessage, aSender, aRespond) {
  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_PUSH_TREE_STRUCTURE:
      if (aMessage.windowId == gTargetWindow)
        applyTreeStructureToTabs(getAllTabs(gTargetWindow), aMessage.structure);
      break;

    case kCOMMAND_PUSH_SUBTREE_COLLAPSED_STATE:
      if (aMessage.windowId == gTargetWindow) {
        let tab = getTabById(aMessage.tab);
        if (!tab)
          return;
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

function reserveToCheckTabbarOverflow() {
  log('reserveToCheckTabbarOverflow');
  if (reserveToCheckTabbarOverflow.waiting)
    clearTimeout(reserveToCheckTabbarOverflow.waiting);
  reserveToCheckTabbarOverflow.waiting = setTimeout(() => {
    delete reserveToCheckTabbarOverflow.waiting;
    checkTabbarOverflow();
  }, 10);
}

function checkTabbarOverflow() {
  log('checkTabbarOverflow');
  var range = document.createRange();
  range.selectNodeContents(gTabBar);
  var containerHeight = gTabBar.getBoundingClientRect().height;
  var contentHeight = range.getBoundingClientRect().height;
  log('height: ', { container: containerHeight, content: contentHeight });
  if (containerHeight < contentHeight) {
    if (gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW))
      return;
    log('overflow');
    gTabBar.classList.add(kTABBAR_STATE_OVERFLOW);
    let range = document.createRange();
    range.selectNodeContents(gAfterTabsForOverflowTabBar);
    let offset = range.getBoundingClientRect().height;
    range.detach();
    gTabBar.style.bottom = `${offset}px`;
  }
  else {
    if (!gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW))
      return;
    log('underflow');
    gTabBar.classList.remove(kTABBAR_STATE_OVERFLOW);
    gTabBar.style.bottom = '';
  }
}
