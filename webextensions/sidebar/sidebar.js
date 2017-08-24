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
  log('initialize sidebar');
  window.addEventListener('unload', destroy, { once: true });
  window.addEventListener('resize', onResize);

  gTabBar = document.querySelector('#tabbar');
  gAfterTabsForOverflowTabBar = document.querySelector('#tabbar ~ .after-tabs');
  gAllTabs = document.querySelector('#all-tabs');

  gTabBar.addEventListener('mousedown', onMouseDown);
  gTabBar.addEventListener('click', onClick);
  gTabBar.addEventListener('dblclick', onDblClick);
  gTabBar.addEventListener(kEVENT_TAB_OPENING, onTabOpening);
  gTabBar.addEventListener(kEVENT_TAB_OPENED, onTabOpened);
  gTabBar.addEventListener(kEVENT_TAB_SCROLL_READY, onTabScrollReady);
  gTabBar.addEventListener(kEVENT_TAB_CLOSED, onTabClosed);
  gTabBar.addEventListener(kEVENT_TAB_MOVED, onTabMoved);
  gTabBar.addEventListener(kEVENT_TAB_LEVEL_CHANGED, onTabLevelChanged);
  gTabBar.addEventListener(kEVENT_TAB_COLLAPSED_STATE_CHANGING, onTabCollapsedStateChanging);
  //gTabBar.addEventListener(kEVENT_TAB_SUBTREE_COLLAPSED_STATE_CHANGED_MANUALLY, onTabSubtreeCollapsedStateChangedManually);
  gTabBar.addEventListener(kEVENT_TAB_PINNED, onTabPinned);
  gTabBar.addEventListener(kEVENT_TAB_UNPINNED, onTabUnpinned);

  await configs.$loaded;
  await rebuildAll();
  log('initialize sidebar: post process');
  updateTabbarLayout({ justNow: true });
  browser.runtime.onMessage.addListener(onMessage);
  document.documentElement.setAttribute(kTWISTY_STYLE, configs.twistyStyle);
  if (configs.debug)
    document.documentElement.classList.add('debug');
  await inheritTreeStructure();
}

function destroy() {
  browser.runtime.onMessage.removeListener(onMessage);
  endObserveApiTabs();
  window.removeEventListener('resize', onResize);

  gTabBar.removeEventListener('mousedown', onMouseDown);
  gTabBar.removeEventListener('click', onClick);
  gTabBar.removeEventListener('dblclick', onDblClick);
  gTabBar.removeEventListener(kEVENT_TAB_OPENING, onTabOpening);
  gTabBar.removeEventListener(kEVENT_TAB_OPENED, onTabOpened);
  gTabBar.removeEventListener(kEVENT_TAB_SCROLL_READY, onTabScrollReady);
  gTabBar.removeEventListener(kEVENT_TAB_CLOSED, onTabClosed);
  gTabBar.removeEventListener(kEVENT_TAB_MOVED, onTabMoved);
  gTabBar.removeEventListener(kEVENT_TAB_LEVEL_CHANGED, onTabLevelChanged);
  gTabBar.removeEventListener(kEVENT_TAB_COLLAPSED_STATE_CHANGING, onTabCollapsedStateChanging);
  //gTabBar.removeEventListener(kEVENT_TAB_SUBTREE_COLLAPSED_STATE_CHANGED_MANUALLY, onTabSubtreeCollapsedStateChangedManually);
  gTabBar.removeEventListener(kEVENT_TAB_PINNED, onTabPinned);
  gTabBar.removeEventListener(kEVENT_TAB_UNPINNED, onTabUnpinned);

  gAllTabs = gTabBar = gAfterTabsForOverflowTabBar = undefined;
}

async function rebuildAll() {
  var apiTabs = await browser.tabs.query({ currentWindow: true });
  gTargetWindow = apiTabs[0].windowId;
  clearAllTabsContainers();
  var container = buildTabsContainerFor(gTargetWindow);
  for (let apiTab of apiTabs) {
    let tab = buildTab(apiTab, { existing: true });
    fixupTab(tab);
    container.appendChild(tab);
  }
  gAllTabs.appendChild(container);
  startObserveApiTabs();
}

function fixupTab(aTab) {
  var label = getTabLabel(aTab);

  var twisty = document.createElement('span');
  twisty.classList.add(kTWISTY);
  aTab.insertBefore(twisty, label);

  var favicon = document.createElement('span');
  favicon.classList.add(kFAVICON);
  favicon.appendChild(document.createElement('img'));
  aTab.insertBefore(favicon, label);
  loadImageTo(favicon.firstChild, aTab.apiTab.favIconUrl, kDEFAULT_FAVICON_URL);

  var closebox = document.createElement('button');
  closebox.appendChild(document.createTextNode('✖'));
  closebox.classList.add(kCLOSEBOX);
  aTab.appendChild(closebox);
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
