/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as Tree from '/common/tree.js';
import { SequenceMatcher } from '/common/diff.js';
import TabFavIconHelper from '/extlib/TabFavIconHelper.js';

function log(...args) {
  internalLogger('sidebar/sidebar-tabs', ...args);
}

let mInitialized = false;

export function init() {
  mInitialized = true;
  document.querySelector('#sync-throbber').addEventListener('animationiteration', synchronizeThrobberAnimation);

  const tabbar = document.querySelector('#tabbar');
  tabbar.addEventListener('overflow', onOverflow);
  tabbar.addEventListener('underflow', onUnderflow);
}

function getTwisty(tab) {
  return tab && tab.querySelector(`.${Constants.kTWISTY}`);
}

function getFavIcon(tab) {
  return tab && tab.querySelector(`.${Constants.kFAVICON}`);
}

function getSoundButton(tab) {
  return tab && tab.querySelector(`.${Constants.kSOUND_BUTTON}`);
}

function getDescendantsCounter(tab) {
  return tab && tab.querySelector(`.${Constants.kCOUNTER}`);
}

export function getClosebox(tab) {
  return tab && tab.querySelector(`.${Constants.kCLOSEBOX}`);
}


export function reserveToUpdateTwistyTooltip(tab) {
  if (tab.reservedUpdateTwistyTooltip)
    return;
  tab.reservedUpdateTwistyTooltip = () => {
    delete tab.reservedUpdateTwistyTooltip;
    updateTwistyTooltip(tab);
  };
  tab.addEventListener('mouseover', tab.reservedUpdateTwistyTooltip, { once: true });
}

function updateTwistyTooltip(tab) {
  let tooltip;
  if (Tabs.isSubtreeCollapsed(tab))
    tooltip = browser.i18n.getMessage('tab_twisty_collapsed_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_twisty_expanded_tooltip');
  getTwisty(tab).setAttribute('title', tooltip);
}

export function reserveToUpdateCloseboxTooltip(tab) {
  if (tab.reservedUpdateCloseboxTooltip)
    return;
  tab.reservedUpdateCloseboxTooltip = () => {
    delete tab.reservedUpdateCloseboxTooltip;
    updateCloseboxTooltip(tab);
  };
  tab.addEventListener('mouseover', tab.reservedUpdateCloseboxTooltip, { once: true });
}

function updateCloseboxTooltip(tab) {
  let tooltip;
  if (Tabs.isMultiselected(tab))
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip_multiselected');
  else if (Tabs.hasChildTabs(tab) && Tabs.isSubtreeCollapsed(tab))
    tooltip = browser.i18n.getMessage('tab_closebox_tree_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip');
  getClosebox(tab).setAttribute('title', tooltip);
}

function updateDescendantsCount(tab) {
  const counter = getDescendantsCounter(tab);
  if (!counter)
    return;
  const descendants = Tabs.getDescendantTabs(tab);
  let count = descendants.length;
  if (configs.counterRole == Constants.kCOUNTER_ROLE_ALL_TABS)
    count += 1;
  counter.textContent = count;
}

function updateDescendantsHighlighted(tab) {
  const children = Tabs.getChildTabs(tab);
  if (!Tabs.hasChildTabs(tab)) {
    Tabs.removeState(tab, Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED);
    Tabs.removeState(tab, Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
    return;
  }
  let someHighlighted = false;
  let allHighlighted  = true;
  for (const child of children) {
    if (Tabs.hasState(child, Constants.kTAB_STATE_HIGHLIGHTED)) {
      someHighlighted = true;
      allHighlighted = (
        allHighlighted &&
        (!Tabs.hasChildTabs(child) ||
         Tabs.hasState(child, Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED))
      );
    }
    else {
      if (!someHighlighted &&
          Tabs.hasState(child, Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED)) {
        someHighlighted = true;
      }
      allHighlighted = false;
    }
  }
  if (someHighlighted) {
    Tabs.addState(tab, Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED);
    if (allHighlighted)
      Tabs.addState(tab, Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
    else
      Tabs.removeState(tab, Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
  }
  else {
    Tabs.removeState(tab, Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED);
    Tabs.removeState(tab, Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
  }
}


export function reserveToUpdateTooltip(tab) {
  if (!mInitialized ||
      !Tabs.ensureLivingTab(tab) ||
      tab.reservedUpdateTabTooltip)
    return;
  tab.reservedUpdateTabTooltip = () => {
    delete tab.reservedUpdateTabTooltip;
    updateTabAndAncestorsTooltip(tab);
  };
  tab.addEventListener('mouseover', tab.reservedUpdateTabTooltip, { once: true });
}

function updateTabAndAncestorsTooltip(tab) {
  if (!Tabs.ensureLivingTab(tab))
    return;
  for (const updateTab of [tab].concat(Tabs.getAncestorTabs(tab))) {
    updateTooltip(updateTab);
  }
}

function updateTooltip(tab) {
  if (!Tabs.ensureLivingTab(tab))
    return;

  tab.dataset.labelWithDescendants = getLabelWithDescendants(tab);

  if (configs.debug) {
    tab.dataset.label = `
${tab.apiTab.title}
#${tab.id}
(${tab.className})
uniqueId = <%${Constants.kPERSISTENT_ID}%>
duplicated = <%duplicated%> / <%originalTabId%> / <%originalId%>
restored = <%restored%>
tabId = ${tab.apiTab.id}
windowId = ${tab.apiTab.windowId}
`.trim();
    Tabs.setAttribute(tab, 'title',
                      tab.dataset.label = tab.dataset.label
                        .replace(`<%${Constants.kPERSISTENT_ID}%>`, tab.$TST.uniqueId.id)
                        .replace(`<%originalId%>`, tab.$TST.uniqueId.originalId)
                        .replace(`<%originalTabId%>`, tab.$TST.uniqueId.originalTabId)
                        .replace(`<%duplicated%>`, !!tab.$TST.uniqueId.duplicated)
                        .replace(`<%restored%>`, !!tab.$TST.uniqueId.restored));
    return;
  }

  if (configs.showCollapsedDescendantsByTooltip &&
      Tabs.isSubtreeCollapsed(tab) &&
      Tabs.hasChildTabs(tab)) {
    Tabs.setAttribute(tab, 'title', tab.dataset.labelWithDescendants);
    return;
  }

  const label = Tabs.getTabLabel(tab);
  if (Tabs.isPinned(tab) || label.classList.contains('overflow')) {
    Tabs.setAttribute(tab, 'title', tab.dataset.label);
  }
  else {
    Tabs.removeAttribute(tab, 'title');
  }
}

function getLabelWithDescendants(tab) {
  const label = [`* ${tab.dataset.label}`];
  for (const child of Tabs.getChildTabs(tab)) {
    if (!child.dataset.labelWithDescendants)
      child.dataset.labelWithDescendants = getLabelWithDescendants(child);
    label.push(child.dataset.labelWithDescendants.replace(/^/gm, '  '));
  }
  return label.join('\n');
}


function reserveToUpdateLoadingState() {
  if (!mInitialized)
    return;
  if (reserveToUpdateLoadingState.waiting)
    clearTimeout(reserveToUpdateLoadingState.waiting);
  reserveToUpdateLoadingState.waiting = setTimeout(() => {
    delete reserveToUpdateLoadingState.waiting;
    updateLoadingState();
  }, 0);
}

function updateLoadingState() {
  const loadingTab = Tabs.query({
    windowId: Tabs.getWindow(),
    visible:  true,
    status:   'loading'
  });
  if (loadingTab)
    document.documentElement.classList.add(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
  else
    document.documentElement.classList.remove(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
}

async function synchronizeThrobberAnimation() {
  const toBeSynchronizedTabs = Tabs.queryAll({
    windowId: Tabs.getWindow(),
    visible:  true,
    states:   [Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED, true],
    element:  true
  });
  if (toBeSynchronizedTabs.length == 0)
    return;

  for (const tab of toBeSynchronizedTabs) {
    Tabs.removeState(tab, Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  }

  document.documentElement.classList.add(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
  void document.documentElement.offsetWidth;
  document.documentElement.classList.remove(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
}


export function reserveToUpdateSoundButtonTooltip(tab) {
  if (tab.reservedUpdateSoundButtonTooltip)
    return;
  tab.reservedUpdateSoundButtonTooltip = () => {
    delete tab.reservedUpdateSoundButtonTooltip;
    updateSoundButtonTooltip(tab);
  };
  tab.addEventListener('mouseover', tab.reservedUpdateSoundButtonTooltip, { once: true });
}

function updateSoundButtonTooltip(tab) {
  let tooltip = '';
  const suffix = Tabs.isMultiselected(tab) ? '_multiselected' : '' ;
  if (Tabs.maybeMuted(tab))
    tooltip = browser.i18n.getMessage(`tab_soundButton_muted_tooltip${suffix}`);
  else if (Tabs.maybeSoundPlaying(tab))
    tooltip = browser.i18n.getMessage(`tab_soundButton_playing_tooltip${suffix}`);

  getSoundButton(tab).setAttribute('title', tooltip);
}


export function updateAll() {
  updateLoadingState();
  synchronizeThrobberAnimation();
  // We need to update from bottom to top, because
  // updateDescendantsHighlighted() refers results of descendants.
  for (const tab of Tabs.getAllTabs(Tabs.getWindow()).reverse()) {
    reserveToUpdateTwistyTooltip(tab);
    reserveToUpdateCloseboxTooltip(tab);
    updateDescendantsCount(tab);
    updateDescendantsHighlighted(tab);
    updateTooltip(tab);
    if (!Tabs.isCollapsed(tab))
      updateLabelOverflow(tab);
  }
}

export function updateLabelOverflow(tab) {
  const label = Tabs.getTabLabel(tab);
  if (!Tabs.isPinned(tab) &&
      label.firstChild.getBoundingClientRect().width > label.getBoundingClientRect().width)
    label.classList.add('overflow');
  else
    label.classList.remove('overflow');
}

function onOverflow(event) {
  const tab = Tabs.getTabFromChild(event.target);
  const label = Tabs.getTabLabel(tab);
  if (event.target == label && !Tabs.isPinned(tab)) {
    label.classList.add('overflow');
    reserveToUpdateTooltip(tab);
  }
}

function onUnderflow(event) {
  const tab = Tabs.getTabFromChild(event.target);
  const label = Tabs.getTabLabel(tab);
  if (event.target == label && !Tabs.isPinned(tab)) {
    label.classList.remove('overflow');
    reserveToUpdateTooltip(tab);
  }
}



export function reserveToSyncTabsOrder() {
  if (reserveToSyncTabsOrder.timer)
    clearTimeout(reserveToSyncTabsOrder.timer);
  reserveToSyncTabsOrder.timer = setTimeout(() => {
    delete reserveToSyncTabsOrder.timer;
    syncTabsOrder();
  }, 100);
}
reserveToSyncTabsOrder.retryCount = 0;

async function syncTabsOrder() {
  log('syncTabsOrder');
  const windowId  = Tabs.getWindow();
  const internalOrder = await browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PULL_TABS_ORDER,
    windowId
  });

  log('syncTabsOrder: internalOrder = ', internalOrder);

  const trackedWindow = Tabs.trackedWindows.get(windowId);
  if (internalOrder.slice(0).sort().join(',') != trackedWindow.order.sort().join(',')) {
    if (reserveToSyncTabsOrder.retryCount > 10)
      throw new Error(`fatal error: mismatched tabs in the window ${windowId}`);
    log('syncTabsOrder: retry');
    reserveToSyncTabsOrder.retryCount++;
    return reserveToSyncTabsOrder();
  }
  reserveToSyncTabsOrder.retryCount = 0;

  const container = Tabs.getTabsContainer();
  if (container.childNodes.length != internalOrder.length) {
    if (reserveToSyncTabsOrder.retryCount > 10)
      throw new Error(`fatal error: mismatched number of tabs in the window ${windowId}`);
    log('syncTabsOrder: retry');
    reserveToSyncTabsOrder.retryCount++;
    return reserveToSyncTabsOrder();
  }
  reserveToSyncTabsOrder.retryCount = 0;

  trackedWindow.order = internalOrder;
  let count = 0;
  for (const tab of trackedWindow.getOrderedTabs()) {
    tab.index = count++;
  }

  const elementsOrder = Array.from(container.childNodes, tab => tab.apiTab.id);
  const DOMElementsOperations = (new SequenceMatcher(elementsOrder, internalOrder)).operations();
  log(`syncTabsOrder: rearrange `, { internalOrder:internalOrder.join(','), elementsOrder:elementsOrder.join(',') });
  for (const operation of DOMElementsOperations) {
    const [tag, fromStart, fromEnd, toStart, toEnd] = operation;
    log('syncTabsOrder: operation ', { tag, fromStart, fromEnd, toStart, toEnd });
    switch (tag) {
      case 'equal':
      case 'delete':
        break;

      case 'insert':
      case 'replace':
        const moveTabIds = internalOrder.slice(toStart, toEnd);
        const referenceTab = fromStart < elementsOrder.length ? Tabs.getTabElementById(elementsOrder[fromStart]) : null;
        log(`syncTabsOrder: move ${moveTabIds.join(',')} before `, referenceTab);
        for (const id of moveTabIds) {
          const tab = Tabs.getTabElementById(id);
          if (tab)
            tab.parentNode.insertBefore(tab, referenceTab);
        }
        break;
    }
  }
}



Tabs.onTabElementBuilt.addListener((tab, info) => {
  const tabElement = tab.$TST.element;
  const label = Tabs.getTabLabel(tabElement);

  const twisty = document.createElement('span');
  twisty.classList.add(Constants.kTWISTY);
  twisty.setAttribute('title', browser.i18n.getMessage('tab_twisty_collapsed_tooltip'));
  tabElement.insertBefore(twisty, label);

  const favicon = document.createElement('span');
  favicon.classList.add(Constants.kFAVICON);
  const faviconImage = favicon.appendChild(document.createElement('img'));
  faviconImage.classList.add(Constants.kFAVICON_IMAGE);
  const defaultIcon = favicon.appendChild(document.createElement('span'));
  defaultIcon.classList.add(Constants.kFAVICON_BUILTIN);
  defaultIcon.classList.add(Constants.kFAVICON_DEFAULT); // just for backward compatibility, and this should be removed from future versions
  const throbber = favicon.appendChild(document.createElement('span'));
  throbber.classList.add(Constants.kTHROBBER);
  tabElement.insertBefore(favicon, label);

  const counter = document.createElement('span');
  counter.classList.add(Constants.kCOUNTER);
  tabElement.appendChild(counter);

  const soundButton = document.createElement('button');
  soundButton.classList.add(Constants.kSOUND_BUTTON);
  tabElement.appendChild(soundButton);

  const closebox = document.createElement('span');
  closebox.classList.add(Constants.kCLOSEBOX);
  closebox.setAttribute('title', browser.i18n.getMessage('tab_closebox_tab_tooltip'));
  closebox.setAttribute('draggable', true); // this is required to cancel click by dragging
  tabElement.appendChild(closebox);

  const burster = document.createElement('span');
  burster.classList.add(Constants.kBURSTER);
  tabElement.appendChild(burster);

  const activeMarker = document.createElement('span');
  activeMarker.classList.add(Constants.kHIGHLIGHTER);
  tabElement.appendChild(activeMarker);

  const identityMarker = document.createElement('span');
  identityMarker.classList.add(Constants.kCONTEXTUAL_IDENTITY_MARKER);
  tabElement.appendChild(identityMarker);

  const extraItemsContainerBehind = document.createElement('span');
  extraItemsContainerBehind.classList.add(Constants.kEXTRA_ITEMS_CONTAINER);
  extraItemsContainerBehind.classList.add('behind');
  tabElement.appendChild(extraItemsContainerBehind);

  tabElement.setAttribute('draggable', true);

  if (!info.existing && configs.animation) {
    Tree.collapseExpandTab(tab, {
      collapsed: true,
      justNow:   true
    });
  }
});

Tabs.onCreated.addListener((tab, _info) => {
  Tabs.addState(tab, Constants.kTAB_STATE_ANIMATION_READY);
});

Tabs.onTabElementMoved.addListener((_tab, info) => {
  if (!info.broadcasted) {
    // Tab element movement triggered by sidebar itself can break order of
    // tabs synchronized from the background, so for safetyl we trigger
    // synchronization.
    reserveToSyncTabsOrder();
  }
});


Tabs.onRestored.addListener(tab => {
  Tree.fixupSubtreeCollapsedState(tab, {
    justNow:  true,
    inRemote: true
  });
});

Tabs.onRemoving.addListener((_tab, _info) => {
  reserveToUpdateLoadingState();
});

Tabs.onRemoved.addListener((tab, _info) => {
  if (Tabs.isCollapsed(tab) ||
      !configs.animation)
    return;

  return new Promise(async (resolve, _reject) => {
    const tabRect = tab.$TST.element.getBoundingClientRect();
    tab.$TST.element.style.marginLeft = `${tabRect.width}px`;
    await wait(configs.animation ? configs.collapseDuration : 0);
    resolve();
  });
});

const mTabWasVisibleBeforeMoving = new WeakMap();

Tabs.onMoving.addListener((tab, _info) => {
  Tabs.addState(tab, Constants.kTAB_STATE_MOVING);
  if (!configs.animation ||
      Tabs.isPinned(tab) ||
      Tabs.isOpening(tab))
    return;
  mTabWasVisibleBeforeMoving.set(tab.$TST.element, !Tabs.isCollapsed(tab));
  Tree.collapseExpandTab(tab, {
    collapsed: true,
    justNow:   true
  });
});

Tabs.onMoved.addListener(async (tab, _info) => {
  if (mInitialized)
    reserveToUpdateTooltip(Tabs.getParentTab(tab.$TST.element));

  const wasVisible = mTabWasVisibleBeforeMoving.get(tab.$TST.element);
  mTabWasVisibleBeforeMoving.delete(tab.$TST.element);

  if (!Tabs.ensureLivingTab(tab)) // it was removed while waiting
    return;

  if (configs.animation && wasVisible) {
    Tree.collapseExpandTab(tab, {
      collapsed: false
    });
    await wait(configs.collapseDuration);
  }
  Tabs.removeState(tab, Constants.kTAB_STATE_MOVING);
});

Tabs.onStateChanged.addListener(tab => {
  if (tab.status == 'loading')
    Tabs.addState(tab, Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  else
    Tabs.removeState(tab, Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  reserveToUpdateLoadingState();
});

Tabs.onLabelUpdated.addListener(tab => {
  Tabs.getTabLabelContent(tab.$TST.element).textContent = tab.title;
  reserveToUpdateTooltip(tab.$TST.element);
  if (!tab.$TST.titleUpdatedWhileCollapsed && Tabs.isCollapsed(tab))
    tab.$TST.titleUpdatedWhileCollapsed = true;
});

Tabs.onFaviconUpdated.addListener((tab, url) => {
  TabFavIconHelper.loadToImage({
    image: getFavIcon(tab.$TST.element).firstChild,
    tab,
    url
  });
});

Tabs.onCollapsedStateChanged.addListener((tab, info) => {
  if (info.collapsed)
    return;
  reserveToUpdateLoadingState(tab.$TST.element);
  if (tab.$TST.titleUpdatedWhileCollapsed) {
    updateLabelOverflow(tab.$TST.element);
    delete tab.$TST.titleUpdatedWhileCollapsed;
  }
});

let mReservedUpdateActiveTab;
Tabs.onUpdated.addListener((tab, info) => {
  reserveToUpdateSoundButtonTooltip(tab.$TST.element);
  reserveToUpdateTooltip(tab.$TST.element);

  if (!('highlighted' in info))
    return;

  reserveToUpdateCloseboxTooltip(tab.$TST.element);

  for (const ancestor of Tabs.getAncestorTabs(tab)) {
    updateDescendantsHighlighted(ancestor.$TST.element);
  }

  if (mReservedUpdateActiveTab)
    clearTimeout(mReservedUpdateActiveTab);
  mReservedUpdateActiveTab = setTimeout(() => {
    mReservedUpdateActiveTab = null;
    const activeTab = Tabs.getActiveTab(tab.windowId);
    if (activeTab) {
      reserveToUpdateSoundButtonTooltip(activeTab.$TST.element);
      reserveToUpdateCloseboxTooltip(activeTab.$TST.element);
    }
  }, 50);
});

Tabs.onParentTabUpdated.addListener(tab => { reserveToUpdateSoundButtonTooltip(tab.$TST.element); });

Tabs.onDetached.addListener((tab, _info) => {
  if (!mInitialized ||
      !Tabs.ensureLivingTab(tab))
    return;
  reserveToUpdateTooltip(Tabs.getParentTab(tab.$TST.element));
});

Tabs.onGroupTabDetected.addListener(tab => {
  // When a group tab is restored but pending, TST cannot update title of the tab itself.
  // For failsafe now we update the title based on its URL.
  const uri = tab.url;
  const parameters = uri.replace(/^[^\?]+/, '');
  let title = parameters.match(/[&?]title=([^&;]*)/);
  if (!title)
    title = parameters.match(/^\?([^&;]*)/);
  title = title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab_label_default');
  tab.title = title;
  wait(0).then(() => {
    TabsUpdate.updateTab(tab, { title }, { tab });
  });
});

Tree.onAttached.addListener((_tab, info = {}) => {
  if (!mInitialized)
    return;
  reserveToUpdateTwistyTooltip(info.parent.$TST.element);
  reserveToUpdateCloseboxTooltip(info.parent.$TST.element);
  if (info.newlyAttached) {
    const ancestors = [info.parent.$TST.element].concat(Tabs.getAncestorTabs(info.parent.$TST.element));
    for (const ancestor of ancestors) {
      updateDescendantsCount(ancestor);
      updateDescendantsHighlighted(ancestor);
    }
  }
  reserveToUpdateTooltip(info.parent.$TST.element);
});

Tree.onDetached.addListener((_tab, detachInfo = {}) => {
  if (!mInitialized)
    return;
  const parent = detachInfo.oldParentTab;
  if (!parent)
    return;
  reserveToUpdateTwistyTooltip(parent.$TST.element);
  reserveToUpdateCloseboxTooltip(parent.$TST.element);
  reserveToUpdateTooltip(parent.$TST.element);
  const ancestors = [parent.$TST.element].concat(Tabs.getAncestorTabs(parent.$TST.element));
  for (const ancestor of ancestors) {
    updateDescendantsCount(ancestor);
    updateDescendantsHighlighted(ancestor);
  }
});

Tree.onSubtreeCollapsedStateChanging.addListener((tab, _info) => {
  reserveToUpdateTwistyTooltip(tab.$TST.element);
  reserveToUpdateCloseboxTooltip(tab.$TST.element);
  if (mInitialized)
    reserveToUpdateTooltip(tab.$TST.element);
});

configs.$addObserver(changedKey => {
  switch (changedKey) {
    case 'showCollapsedDescendantsByTooltip':
      if (mInitialized)
        for (const tab of Tabs.getAllTabs(Tabs.getWindow(), { element: true })) {
          reserveToUpdateTooltip(tab);
        }
      break;
  }
});
