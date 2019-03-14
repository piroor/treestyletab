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
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as Tree from '/common/tree.js';
import { SequenceMatcher } from '/common/diff.js';

import Tab from '/common/Tab.js';
import Window from '/common/Window.js';

import TabFavIconHelper from '/extlib/TabFavIconHelper.js';

function log(...args) {
  internalLogger('sidebar/sidebar-tabs', ...args);
}

let mInitialized = false;

export const wholeContainer = document.querySelector('#all-tabs');

export function init() {
  mInitialized = true;
  document.querySelector('#sync-throbber').addEventListener('animationiteration', synchronizeThrobberAnimation);

  document.documentElement.setAttribute(Constants.kLABEL_OVERFLOW, configs.labelOverflowStyle);
  if (configs.labelOverflowStyle == 'fade')
    startObserveTabsOverflow();

  window.addEventListener('mouseover', event => {
    const tab = getTabFromDOMNode(event.target);
    if (tab)
      updateTabAndAncestorsTooltip(tab);
  });
}

export function getTabFromDOMNode(node, options = {}) {
  if (typeof options != 'object')
    options = {};
  if (!node)
    return null;
  if (!(node instanceof Element))
    node = node.parentNode;
  const tab = node && node.closest('.tab');
  if (options.force)
    return tab && tab.apiTab;
  return TabsStore.ensureLivingTab(tab && tab.apiTab);
}

function getLabel(tab) {
  return tab && tab.$TST.element.querySelector(`.${Constants.kLABEL}`);
}

function getLabelContent(tab) {
  return tab && tab.$TST.element.querySelector(`.${Constants.kLABEL}-content`);
}

function getTwisty(tab) {
  return tab && tab.$TST.element.querySelector(`.${Constants.kTWISTY}`);
}

function getFavIcon(tab) {
  return tab && tab.$TST.element.querySelector(`.${Constants.kFAVICON}`);
}

function getSoundButton(tab) {
  return tab && tab.$TST.element.querySelector(`.${Constants.kSOUND_BUTTON}`);
}

function getDescendantsCounter(tab) {
  return tab && tab.$TST.element.querySelector(`.${Constants.kCOUNTER}`);
}

export function getClosebox(tab) {
  return tab && tab.$TST.element.querySelector(`.${Constants.kCLOSEBOX}`);
}


export async function reserveToUpdateTwistyTooltip(tab) {
  if (tab.$TST.reservedUpdateTwistyTooltip)
    return;
  tab.$TST.reservedUpdateTwistyTooltip = () => {
    delete tab.$TST.reservedUpdateTwistyTooltip;
    updateTwistyTooltip(tab);
  };
  const element = await tab.$TST.promisedElement;
  if (element)
    element.addEventListener('mouseover', tab.$TST.reservedUpdateTwistyTooltip, { once: true });
}

function updateTwistyTooltip(tab) {
  let tooltip;
  if (tab.$TST.subtreeCollapsed)
    tooltip = browser.i18n.getMessage('tab_twisty_collapsed_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_twisty_expanded_tooltip');
  getTwisty(tab).setAttribute('title', tooltip);
}

export async function reserveToUpdateCloseboxTooltip(tab) {
  if (tab.$TST.reservedUpdateCloseboxTooltip)
    return;
  tab.$TST.reservedUpdateCloseboxTooltip = () => {
    delete tab.$TST.reservedUpdateCloseboxTooltip;
    updateCloseboxTooltip(tab);
  };
  const element = await tab.$TST.promisedElement;
  if (element)
    element.addEventListener('mouseover', tab.$TST.reservedUpdateCloseboxTooltip, { once: true });
}

function updateCloseboxTooltip(tab) {
  let tooltip;
  if (tab.$TST.multiselected)
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip_multiselected');
  else if (tab.$TST.hasChild && tab.$TST.subtreeCollapsed)
    tooltip = browser.i18n.getMessage('tab_closebox_tree_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip');
  getClosebox(tab).setAttribute('title', tooltip);
}

function updateDescendantsCount(tab) {
  const counter = getDescendantsCounter(tab);
  if (!counter)
    return;
  const descendants = tab.$TST.descendants;
  let count = descendants.length;
  if (configs.counterRole == Constants.kCOUNTER_ROLE_ALL_TABS)
    count += 1;
  counter.textContent = count;
}

function updateDescendantsHighlighted(tab) {
  const children = tab.$TST.children;
  if (!tab.$TST.hasChild) {
    tab.$TST.removeState(Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED);
    tab.$TST.removeState(Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
    return;
  }
  let someHighlighted = false;
  let allHighlighted  = true;
  for (const child of children) {
    if (child.$TST.states.has(Constants.kTAB_STATE_HIGHLIGHTED)) {
      someHighlighted = true;
      allHighlighted = (
        allHighlighted &&
        (!child.$TST.hasChild ||
         child.$TST.states.has(Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED))
      );
    }
    else {
      if (!someHighlighted &&
          child.$TST.states.has(Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED)) {
        someHighlighted = true;
      }
      allHighlighted = false;
    }
  }
  if (someHighlighted) {
    tab.$TST.addState(Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED);
    if (allHighlighted)
      tab.$TST.addState(Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
    else
      tab.$TST.removeState(Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
  }
  else {
    tab.$TST.removeState(Constants.kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED);
    tab.$TST.removeState(Constants.kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED);
  }
}


function updateTabAndAncestorsTooltip(tab) {
  if (!TabsStore.ensureLivingTab(tab))
    return;
  for (const updateTab of [tab].concat(tab.$TST.ancestors)) {
    updateTooltip(updateTab);
  }
}

function updateTooltip(tab) {
  if (!TabsStore.ensureLivingTab(tab) ||
      !tab.$TST.tooltipIsDirty)
    return;

  // on the "fade" mode, overflow style was already updated,
  // so we don' need to update the status here.
  if (configs.labelOverflowStyle != 'fade')
    updateLabelOverflow(tab);

  tab.$TST.tooltipIsDirty = false;

  if (configs.debug) {
    tab.$TST.tooltip = `
${tab.title}
#${tab.id}
(${tab.$TST.element.className})
uniqueId = <${tab.$TST.uniqueId.id}>
duplicated = <${!!tab.$TST.uniqueId.duplicated}> / <${tab.$TST.uniqueId.originalTabId}> / <${tab.$TST.uniqueId.originalId}>
restored = <${!!tab.$TST.uniqueId.restored}>
tabId = ${tab.id}
windowId = ${tab.windowId}
`.trim();
    tab.$TST.setAttribute('title', tab.$TST.tooltip);
    return;
  }

  tab.$TST.tooltip = tab.title;
  tab.$TST.tooltipWithDescendants = getTooltipWithDescendants(tab);

  if (configs.showCollapsedDescendantsByTooltip &&
      tab.$TST.subtreeCollapsed &&
      tab.$TST.hasChild) {
    tab.$TST.setAttribute('title', tab.$TST.tooltipWithDescendants);
    return;
  }

  const label = getLabel(tab);
  if (tab.pinned || label.classList.contains('overflow')) {
    tab.$TST.setAttribute('title', tab.$TST.tooltip);
  }
  else {
    tab.$TST.removeAttribute('title');
  }
}

function getTooltipWithDescendants(tab) {
  const tooltip = [`* ${tab.$TST.tooltip || tab.title}`];
  for (const child of tab.$TST.children) {
    if (!child.$TST.tooltipWithDescendants)
      child.$TST.tooltipWithDescendants = getTooltipWithDescendants(child);
    tooltip.push(child.$TST.tooltipWithDescendants.replace(/^/gm, '  '));
  }
  return tooltip.join('\n');
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
  if (Tab.hasLoadingTab(TabsStore.getWindow()))
    document.documentElement.classList.add(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
  else
    document.documentElement.classList.remove(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
}

async function synchronizeThrobberAnimation() {
  let processedCount = 0;
  for (const tab of Tab.getNeedToBeSynchronizedTabs(TabsStore.getWindow(), { iterator: true })) {
    tab.$TST.removeState(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
    TabsStore.removeUnsynchronizedTab(tab);
    processedCount++;
  }
  if (processedCount == 0)
    return;

  document.documentElement.classList.add(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
  void document.documentElement.offsetWidth;
  document.documentElement.classList.remove(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
}


export async function reserveToUpdateSoundButtonTooltip(tab) {
  if (tab.$TST.reservedUpdateSoundButtonTooltip)
    return;
  tab.$TST.reservedUpdateSoundButtonTooltip = () => {
    delete tab.$TST.reservedUpdateSoundButtonTooltip;
    updateSoundButtonTooltip(tab);
  };
  const element = await tab.$TST.promisedElement;
  if (element)
    element.addEventListener('mouseover', tab.$TST.reservedUpdateSoundButtonTooltip, { once: true });
}

function updateSoundButtonTooltip(tab) {
  let tooltip = '';
  const suffix = tab.$TST.multiselected ? '_multiselected' : '' ;
  if (tab.$TST.maybeMuted)
    tooltip = browser.i18n.getMessage(`tab_soundButton_muted_tooltip${suffix}`);
  else if (tab.$TST.maybeSoundPlaying)
    tooltip = browser.i18n.getMessage(`tab_soundButton_playing_tooltip${suffix}`);

  getSoundButton(tab).setAttribute('title', tooltip);
}


export function updateAll() {
  updateLoadingState();
  synchronizeThrobberAnimation();
  // We need to update from bottom to top, because
  // updateDescendantsHighlighted() refers results of descendants.
  for (const tab of Tab.getAllTabs(TabsStore.getWindow(), { iterator: true, reverse: true })) {
    reserveToUpdateTwistyTooltip(tab);
    reserveToUpdateCloseboxTooltip(tab);
    updateDescendantsCount(tab);
    updateDescendantsHighlighted(tab);
    tab.$TST.tooltipIsDirty = true;
    if (configs.labelOverflowStyle == 'fade' &&
        !tab.$TST.collapsed)
      updateLabelOverflow(tab);
  }
}

function startObserveTabsOverflow() {
  const tabbar = document.getElementById('tabbar');
  if (tabbar.$observingTabsOverflow)
    return;
  tabbar.addEventListener('overflow', onOverflow);
  tabbar.addEventListener('underflow', onUnderflow);
  tabbar.$observingTabsOverflow = true;
}

function endObserveTabsOverflow() {
  const tabbar = document.getElementById('tabbar');
  if (!tabbar.$observingTabsOverflow)
    return;
  tabbar.removeEventListener('overflow', onOverflow);
  tabbar.removeEventListener('underflow', onUnderflow);
  tabbar.$observingTabsOverflow = false;
}

export function updateLabelOverflow(tab) {
  const label = getLabel(tab);
  if (!tab.pinned &&
      label.firstChild.getBoundingClientRect().width > label.getBoundingClientRect().width)
    label.classList.add('overflow');
  else
    label.classList.remove('overflow');
  tab.$TST.tooltipIsDirty = true;
}

function onOverflow(event) {
  const tab   = getTabFromDOMNode(event.target);
  const label = getLabel(tab);
  if (event.target == label && !tab.pinned) {
    label.classList.add('overflow');
    tab.$TST.tooltipIsDirty = true;
  }
}

function onUnderflow(event) {
  const tab   = getTabFromDOMNode(event.target);
  const label = getLabel(tab);
  if (event.target == label && !tab.pinned) {
    label.classList.remove('overflow');
    tab.$TST.tooltipIsDirty = true;
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
  const windowId      = TabsStore.getWindow();
  const internalOrder = await browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PULL_TABS_ORDER,
    windowId
  }).catch(ApiTabs.createErrorHandler());

  log('syncTabsOrder: internalOrder = ', internalOrder);

  const trackedWindow = TabsStore.windows.get(windowId);
  if (internalOrder.slice(0).sort().join(',') != trackedWindow.order.sort().join(',')) {
    if (reserveToSyncTabsOrder.retryCount > 10)
      throw new Error(`fatal error: mismatched tabs in the window ${windowId}`);
    log('syncTabsOrder: retry');
    reserveToSyncTabsOrder.retryCount++;
    return reserveToSyncTabsOrder();
  }
  reserveToSyncTabsOrder.retryCount = 0;

  const container = trackedWindow.element;
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
        const referenceTab = fromStart < elementsOrder.length ? Tab.get(elementsOrder[fromStart]) : null;
        log(`syncTabsOrder: move ${moveTabIds.join(',')} before `, referenceTab);
        for (const id of moveTabIds) {
          const tab = Tab.get(id);
          if (tab)
            tab.$TST.element.parentNode.insertBefore(tab.$TST.element, referenceTab && referenceTab.$TST.element);
        }
        break;
    }
  }
}

Window.onInitialized.addListener(windowId => {
  let container = document.getElementById(`window-${windowId}`);
  if (!container) {
    container = document.createElement('ul');
    wholeContainer.appendChild(container);
  }
  container.dataset.windowId = windowId;
  container.setAttribute('id', `window-${windowId}`);
  container.classList.add('tabs');
  container.$TST = TabsStore.windows.get(windowId);
  container.$TST.element = container;
});

Tab.onInitialized.addListener((tab, info) => {
  if (tab.$TST.element) // restored from cache
    return;

  const id = `tab-${tab.id}`;
  let tabElement = document.getElementById(id);
  if (tabElement) {
    tab.$TST.bindElement(tabElement);
    return;
  }

  tabElement = document.createElement('li');
  tab.$TST.bindElement(tabElement);
  tabElement.$TST = tab.$TST;
  tabElement.apiTab = tab;

  tabElement.classList.add('tab');
  tab.$TST.setAttribute('id', id);
  tab.$TST.setAttribute(Constants.kAPI_TAB_ID, tab.id || -1);
  tab.$TST.setAttribute(Constants.kAPI_WINDOW_ID, tab.windowId || -1);

  const label = document.createElement('span');
  label.classList.add(Constants.kLABEL);
  const labelContent = label.appendChild(document.createElement('span'));
  labelContent.classList.add(`${Constants.kLABEL}-content`);
  tabElement.appendChild(label);

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

  applyStatesToElement(tab);

  const window  = TabsStore.windows.get(tab.windowId);
  const nextTab = Tab.getTabAt(window.id, tab.index);
  window.element.insertBefore(tabElement, nextTab && nextTab.$TST.element);
});

const NATIVE_STATES = new Set([
  'active',
  'attention',
  'audible',
  'discarded',
  'hidden',
  'highlighted',
  'pinned'
]);
const IGNORE_CLASS_STATES = new Set([
  'tab',
  Constants.kTAB_STATE_ANIMATION_READY,
  Constants.kTAB_STATE_SUBTREE_COLLAPSED
]);

export function applyStatesToElement(tab) {
  const tabElement = tab.$TST.element;

  for (const state of tabElement.classList) {
    if (IGNORE_CLASS_STATES.has(state) ||
        NATIVE_STATES.has(state))
      continue;
    if (!tab.$TST.states.has(state))
      tabElement.classList.remove(state);
  }
  for (const state of tab.$TST.states) {
    if (IGNORE_CLASS_STATES.has(state))
      continue;
    if (!tabElement.classList.contains(state))
      tabElement.classList.add(state);
  }

  for (const state of NATIVE_STATES) {
    if (tab[state] == tabElement.classList.contains(state))
      continue;
    if (tab[state])
      tabElement.classList.add(state);
    else
      tabElement.classList.remove(state);
  }

  if (tab.$TST.childIds.length > 0)
    tabElement.setAttribute(Constants.kCHILDREN, `|${tab.$TST.childIds.join('|')}|`);
  else
    tabElement.removeAttribute(Constants.kCHILDREN);

  if (tab.$TST.parentId)
    tabElement.setAttribute(Constants.kPARENT, tab.$TST.parentId);
  else
    tabElement.removeAttribute(Constants.kPARENT);

  const alreadyGrouped = tab.$TST.getAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER) || '';
  if (tabElement.getAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER) != alreadyGrouped)
    tabElement.setAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER, alreadyGrouped);

  const opener = tab.$TST.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID) || '';
  if (tabElement.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID) != opener)
    tabElement.setAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID, opener);

  const uri = tab.$TST.getAttribute(Constants.kCURRENT_URI) || tab.url;
  if (tabElement.getAttribute(Constants.kCURRENT_URI) != uri)
    tabElement.setAttribute(Constants.kCURRENT_URI, uri);

  const level = tab.$TST.getAttribute(Constants.kLEVEL) || 0;
  if (tabElement.getAttribute(Constants.kLEVEL) != level)
    tabElement.setAttribute(Constants.kLEVEL, level);

  const id = tab.$TST.uniqueId.id;
  if (tabElement.getAttribute(Constants.kPERSISTENT_ID) != id)
    tabElement.setAttribute(Constants.kPERSISTENT_ID, id);

  if (tab.$TST.subtreeCollapsed) {
    if (!tabElement.classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
      tabElement.classList.add(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  }
  else {
    if (tabElement.classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
      tabElement.classList.remove(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  }

  const parent = tab.$TST.parent;
  if (parent &&
      (parent.$TST.collapsed ||
       parent.$TST.subtreeCollapsed)) {
    if (!tabElement.classList.contains(Constants.kTAB_STATE_COLLAPSED)) {
      tabElement.classList.add(Constants.kTAB_STATE_COLLAPSED);
      tabElement.classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
    }
  }
  else {
    if (tabElement.classList.contains(Constants.kTAB_STATE_COLLAPSED)) {
      tabElement.classList.remove(Constants.kTAB_STATE_COLLAPSED);
      tabElement.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);
    }
  }
}

Tab.onCreated.addListener((tab, _info) => {
  tab.$TST.addState(Constants.kTAB_STATE_ANIMATION_READY);
});

Tab.onTabInternallyMoved.addListener(async (tab, info) => {
  if (!tab.$TST.element)
    await Tab.waitUntilTracked(tab.id, { element: true });
  const tabElement  = tab.$TST.element;
  const nextElement = info.nextTab && info.nextTab.$TST.element;
  if (tabElement.nextSibling != nextElement)
    tabElement.parentNode.insertBefore(tabElement, nextElement);

  if (!info.broadcasted) {
    // Tab element movement triggered by sidebar itself can break order of
    // tabs synchronized from the background, so for safetyl we trigger
    // synchronization.
    reserveToSyncTabsOrder();
  }
});


Tab.onRemoving.addListener((_tab, _info) => {
  reserveToUpdateLoadingState();
});

Tab.onRemoved.addListener((tab, _info) => {
  if (tab.$TST.collapsed ||
      !configs.animation)
    return;

  return new Promise(async (resolve, _reject) => {
    if (!tab.$TST ||
        !tab.$TST.element ||
        !tab.$TST.element.parentNode)
      return resolve();
    const tabRect = tab.$TST.element.getBoundingClientRect();
    tab.$TST.element.style.marginLeft = `${tabRect.width}px`;
    await wait(configs.animation ? configs.collapseDuration : 0);
    resolve();
  });
});

const mTabWasVisibleBeforeMoving = new Map();

Tab.onMoving.addListener((tab, _info) => {
  tab.$TST.addState(Constants.kTAB_STATE_MOVING);
  if (!configs.animation ||
      tab.pinned ||
      tab.$TST.opening)
    return;
  mTabWasVisibleBeforeMoving.set(tab.id, !tab.$TST.collapsed);
  Tree.collapseExpandTab(tab, {
    collapsed: true,
    justNow:   true
  });
});

Tab.onMoved.addListener(async (tab, info) => {
  if (!tab.$TST.element)
    await Tab.waitUntilTracked(tab.id, { element: true });
  if (mInitialized &&
      tab.$TST.parent)
    tab.$TST.parent.$TST.tooltipIsDirty = true;

  const wasVisible = mTabWasVisibleBeforeMoving.get(tab.id);
  mTabWasVisibleBeforeMoving.delete(tab.id);

  if (!TabsStore.ensureLivingTab(tab)) // it was removed while waiting
    return;

  tab.$TST.element.parentNode.insertBefore(tab.$TST.element, info.nextTab && info.nextTab.$TST.element);

  if (configs.animation && wasVisible) {
    Tree.collapseExpandTab(tab, {
      collapsed: false
    });
    await wait(configs.collapseDuration);
  }
  tab.$TST.removeState(Constants.kTAB_STATE_MOVING);
});

Tab.onStateChanged.addListener(tab => {
  if (tab.status == 'loading') {
    tab.$TST.addState(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
    TabsStore.addUnsynchronizedTab(tab);
  }
  else {
    tab.$TST.removeState(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
    TabsStore.removeUnsynchronizedTab(tab);
  }

  reserveToUpdateLoadingState();
});

Tab.onLabelUpdated.addListener(tab => {
  getLabelContent(tab).textContent = tab.title;
  tab.$TST.tooltipIsDirty = true;
  if (configs.labelOverflowStyle == 'fade' &&
      !tab.$TST.labelIsDirty &&
      tab.$TST.collapsed)
    tab.$TST.labelIsDirty = true;
});

Tab.onFaviconUpdated.addListener((tab, url) => {
  TabFavIconHelper.loadToImage({
    image: getFavIcon(tab).firstChild,
    tab,
    url
  });
});

Tab.onCollapsedStateChanged.addListener((tab, info) => {
  if (info.collapsed)
    return;
  reserveToUpdateLoadingState();
  if (configs.labelOverflowStyle == 'fade' &&
      tab.$TST.labelIsDirty) {
    updateLabelOverflow(tab);
    delete tab.$TST.labelIsDirty;
  }
});

let mReservedUpdateActiveTab;
Tab.onUpdated.addListener((tab, info) => {
  reserveToUpdateSoundButtonTooltip(tab);
  tab.$TST.tooltiplIsDirty = true;

  if (!('highlighted' in info))
    return;

  reserveToUpdateCloseboxTooltip(tab);

  for (const ancestor of tab.$TST.ancestors) {
    updateDescendantsHighlighted(ancestor);
  }

  if (mReservedUpdateActiveTab)
    clearTimeout(mReservedUpdateActiveTab);
  mReservedUpdateActiveTab = setTimeout(() => {
    mReservedUpdateActiveTab = null;
    const activeTab = Tab.getActiveTab(tab.windowId);
    if (activeTab) {
      reserveToUpdateSoundButtonTooltip(activeTab);
      reserveToUpdateCloseboxTooltip(activeTab);
    }
  }, 50);
});

Tab.onSoundStateChanged.addListener(tab => { reserveToUpdateSoundButtonTooltip(tab); });

Tab.onDetached.addListener((tab, _info) => {
  if (!mInitialized ||
      !TabsStore.ensureLivingTab(tab))
    return;
  tab.$TST.tooltipIsDirty = true;
  if (tab.$TST.element.parentNode)
    tab.$TST.element.parentNode.removeChild(tab.$TST.element);
});

Tab.onGroupTabDetected.addListener(tab => {
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
  reserveToUpdateTwistyTooltip(info.parent);
  reserveToUpdateCloseboxTooltip(info.parent);
  if (info.newlyAttached) {
    const ancestors = [info.parent].concat(info.parent.$TST.ancestors);
    for (const ancestor of ancestors) {
      updateDescendantsCount(ancestor);
      updateDescendantsHighlighted(ancestor);
    }
  }
  info.parent.$TST.tooltipIsDirty = true;
});

Tree.onDetached.addListener((_tab, detachInfo = {}) => {
  if (!mInitialized)
    return;
  const parent = detachInfo.oldParentTab;
  if (!parent)
    return;
  reserveToUpdateTwistyTooltip(parent);
  reserveToUpdateCloseboxTooltip(parent);
  parent.$TST.tooltipIsDirty = true;
  const ancestors = [parent].concat(parent.$TST.ancestors);
  for (const ancestor of ancestors) {
    updateDescendantsCount(ancestor);
    updateDescendantsHighlighted(ancestor);
  }
});

Tree.onSubtreeCollapsedStateChanging.addListener((tab, _info) => {
  reserveToUpdateTwistyTooltip(tab);
  reserveToUpdateCloseboxTooltip(tab);
  if (mInitialized)
    tab.$TST.tooltipIsDirty = true;
});

let mDelayedResized = null;
window.addEventListener('resize', () => {
  if (mDelayedResized)
    clearTimeout(mDelayedResized);
  mDelayedResized = setTimeout(() => {
    mDelayedResized = null;
    for (const tab of Tab.getAllTabs(TabsStore.getWindow(), { iterator: true })) {
      tab.$TST.tooltipIsDirty = true;
    }
  }, 250);
});

configs.$addObserver(changedKey => {
  switch (changedKey) {
    case 'showCollapsedDescendantsByTooltip':
      if (mInitialized)
        for (const tab of Tab.getAllTabs(TabsStore.getWindow(), { iterator: true })) {
          tab.$TST.tooltipIsDirty = true;
        }
      break;

    case 'labelOverflowStyle':
      document.documentElement.setAttribute(Constants.kLABEL_OVERFLOW, configs.labelOverflowStyle);
      if (configs.labelOverflowStyle == 'fade') {
        for (const tab of Tab.getVisibleTabs(TabsStore.getWindow())) {
          updateLabelOverflow(tab);
        }
        startObserveTabsOverflow();
      }
      else {
        endObserveTabsOverflow();
      }
      break;
  }
});
