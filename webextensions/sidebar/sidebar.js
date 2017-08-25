/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'Sidebar';

var gTabBar;
var gAfterTabsForOverflowTabBar;

window.addEventListener('DOMContentLoaded', init, { once: true });

async function init() {
  log('initialize sidebar');
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
  log('initialize sidebar: post process');
  updateTabbarLayout({ justNow: true });
  browser.runtime.onMessage.addListener(onMessage);
  document.documentElement.setAttribute(kTWISTY_STYLE, configs.twistyStyle);

  configs.$addObserver(onConfigChange);
  onConfigChange('debug');

  startListenDragEvents(gTabBar);

  await inheritTreeStructure();
}

function destroy() {
  configs.$removeObserver(onConfigChange);
  browser.runtime.onMessage.removeListener(onMessage);
  endListenDragEvents(gTabBar);
  endObserveApiTabs();
  window.removeEventListener('resize', onResize);

  gTabBar.removeEventListener('mousedown', onMouseDown);
  gTabBar.removeEventListener('click', onClick);
  gTabBar.removeEventListener('dblclick', onDblClick);

  gAllTabs = gTabBar = gAfterTabsForOverflowTabBar = undefined;
}

async function rebuildAll() {
  var apiTabs = await browser.tabs.query({ currentWindow: true });
  gTargetWindow = apiTabs[0].windowId;
  clearAllTabsContainers();
  var container = buildTabsContainerFor(gTargetWindow);
  for (let apiTab of apiTabs) {
    let tab = buildTab(apiTab, { existing: true });
    container.appendChild(tab);
  }
  gAllTabs.appendChild(container);
  startObserveApiTabs();
}

async function inheritTreeStructure() {
  var response = await browser.runtime.sendMessage({
    type:     kCOMMAND_PULL_TREE_STRUCTURE,
    windowId: gTargetWindow
  });
  log('response: ', response);
  if (response && response.structure)
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

    case kCOMMAND_ATTACH_TAB: {
      if (aMessage.windowId == gTargetWindow) {
        let child = getTabById(aMessage.child);
        let parent = getTabById(aMessage.parent);
        let insertBefore = getTabById(aMessage.insertBefore);
        if (child && parent)
          attachTabTo(child, parent, { insertBefore });
      }
    }; break;

    case kCOMMAND_DETACH_TAB: {
      if (aMessage.windowId == gTargetWindow) {
        let tab = getTabById(aMessage.tab);
        if (tab)
          detachTab(tab);
      }
    }; break;
  }
}


function selectTabInternally(aTab) {
  log('selectTabInternally: ', dumpTab(aTab));
  browser.runtime.sendMessage({
    type:     kCOMMAND_SELECT_TAB_INTERNALLY,
    windowId: aTab.apiTab.windowId,
    tab:      aTab.id
  });
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

function reserveToUpdateTabbarLayout() {
  log('reserveToUpdateTabbarLayout');
  if (reserveToUpdateTabbarLayout.waiting)
    clearTimeout(reserveToUpdateTabbarLayout.waiting);
  reserveToUpdateTabbarLayout.waiting = setTimeout(() => {
    delete reserveToUpdateTabbarLayout.waiting;
    updateTabbarLayout();
  }, 10);
}

function updateTabbarLayout(aParams = {}) {
  log('updateTabbarLayout');
  var range = document.createRange();
  range.selectNodeContents(gTabBar);
  var containerHeight = gTabBar.getBoundingClientRect().height;
  var contentHeight = range.getBoundingClientRect().height;
  log('height: ', { container: containerHeight, content: contentHeight });
  var overflow = containerHeight < contentHeight;
  if (overflow && !gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW)) {
    log('overflow');
    gTabBar.classList.add(kTABBAR_STATE_OVERFLOW);
    let range = document.createRange();
    range.selectNodeContents(gAfterTabsForOverflowTabBar);
    let offset = range.getBoundingClientRect().height;
    range.detach();
    gTabBar.style.bottom = `${offset}px`;
  }
  else if (!overflow && gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW)) {
    log('underflow');
    gTabBar.classList.remove(kTABBAR_STATE_OVERFLOW);
    gTabBar.style.bottom = '';
  }

  positionPinnedTabs(aParams);
}
