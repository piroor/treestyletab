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
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TabsUpdate from '/common/tabs-update.js';
import { Diff, SequenceMatcher } from '/common/diff.js';

import Tab from '/common/Tab.js';
import Window from '/common/Window.js';

import * as Background from './background.js';
import * as CollapseExpand from './collapse-expand.js';

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


async function reserveToUpdateSoundButtonTooltip(tab) {
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
  const expectedTabs = internalOrder.slice(0).sort().join('\n');
  const actualTabs   = trackedWindow.order.sort().join('\n');
  if (expectedTabs != actualTabs) {
    if (reserveToSyncTabsOrder.retryCount > 10)
      throw new Error(`fatal error: mismatched tabs in the window ${windowId}:\n${Diff.readable(expectedTabs, actualTabs)}`);
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
  container.$TST.bindElement(container);
});

Tab.onInitialized.addListener((tab, _info) => {
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

  tab.$TST.classList.add('tab');
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
  const classList = tab.$TST.classList;

  getLabelContent(tab).textContent = tab.title;
  tab.$TST.tooltipIsDirty = true;
  if (configs.labelOverflowStyle == 'fade' &&
      !tab.$TST.labelIsDirty &&
      tab.$TST.collapsed)
    tab.$TST.labelIsDirty = true;

  const openerOfGroupTab = tab.$TST.isGroupTab && Tab.getOpenerFromGroupTab(tab);
  TabFavIconHelper.loadToImage({
    image: getFavIcon(tab).firstChild,
    tab,
    url: openerOfGroupTab && openerOfGroupTab.favIconUrl || tab.favIconUrl
  });

  for (const state of classList) {
    if (IGNORE_CLASS_STATES.has(state) ||
        NATIVE_STATES.has(state))
      continue;
    if (!tab.$TST.states.has(state))
      classList.remove(state);
  }
  for (const state of tab.$TST.states) {
    if (IGNORE_CLASS_STATES.has(state))
      continue;
    if (!classList.contains(state))
      classList.add(state);
  }

  for (const state of NATIVE_STATES) {
    if (tab[state] == classList.contains(state))
      continue;
    if (tab[state])
      classList.add(state);
    else
      classList.remove(state);
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
    if (!classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
      classList.add(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  }
  else {
    if (classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
      classList.remove(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  }
}

export function applyCollapseExpandStateToElement(tab) {
  const classList = tab.$TST.classList;
  const parent = tab.$TST.parent;
  if (parent &&
      (parent.$TST.collapsed ||
       parent.$TST.subtreeCollapsed)) {
    if (!classList.contains(Constants.kTAB_STATE_COLLAPSED))
      classList.add(Constants.kTAB_STATE_COLLAPSED);
    if (!classList.contains(Constants.kTAB_STATE_COLLAPSED_DONE))
      classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
  }
  else {
    if (classList.contains(Constants.kTAB_STATE_COLLAPSED))
      classList.remove(Constants.kTAB_STATE_COLLAPSED);
    if (classList.contains(Constants.kTAB_STATE_COLLAPSED_DONE))
      classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);
  }
}


let mReservedUpdateActiveTab;

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


// Mechanism to override "index" of newly opened tabs by TST's detection logic

const mMovedNewTabResolvers = new Map();
const mPromsiedMovedNewTabs = new Map();
const mAlreadyMovedNewTabs = new Set();

export async function waitUntilNewTabIsMoved(tabId) {
  if (mAlreadyMovedNewTabs.has(tabId))
    return true;
  if (mPromsiedMovedNewTabs.has(tabId))
    return mPromsiedMovedNewTabs.get(tabId);
  const timer = setTimeout(() => {
    if (mMovedNewTabResolvers.has(tabId))
      mMovedNewTabResolvers.get(tabId)();
  }, Math.max(0, configs.autoGroupNewTabsTimeout));
  const promise = new Promise((resolve, _reject) => {
    mMovedNewTabResolvers.set(tabId, resolve);
  }).then(newIndex => {
    mMovedNewTabResolvers.delete(tabId);
    mPromsiedMovedNewTabs.delete(tabId);
    clearTimeout(timer);
    return newIndex;
  });
  mPromsiedMovedNewTabs.set(tabId, promise);
  return promise;
}

function maybeNewTabIsMoved(tabId) {
  if (mMovedNewTabResolvers.has(tabId)) {
    mMovedNewTabResolvers.get(tabId)();
  }
  else {
    mAlreadyMovedNewTabs.add(tabId);
    setTimeout(() => {
      mAlreadyMovedNewTabs.delete(tabId);
    }, Math.min(10 * 1000, configs.autoGroupNewTabsTimeout));
  }
}


Background.onMessage.addListener(async message => {
  switch (message.type) {
    case Constants.kCOMMAND_SYNC_TABS_ORDER:
      reserveToSyncTabsOrder();
      break;

    case Constants.kCOMMAND_BROADCAST_TAB_STATE: {
      if (!message.tabIds.length)
        break;
      await Tab.waitUntilTracked(message.tabIds, { element: true });
      const add    = message.add || [];
      const remove = message.remove || [];
      log('apply broadcasted tab state ', message.tabIds, {
        add:    add.join(','),
        remove: remove.join(',')
      });
      const modified = add.concat(remove);
      for (const id of message.tabIds) {
        const tab = Tab.get(id);
        if (!tab)
          continue;
        add.forEach(state => tab.$TST.addState(state));
        remove.forEach(state => tab.$TST.removeState(state));
        if (modified.includes(Constants.kTAB_STATE_AUDIBLE) ||
            modified.includes(Constants.kTAB_STATE_SOUND_PLAYING) ||
            modified.includes(Constants.kTAB_STATE_MUTED)) {
          reserveToUpdateSoundButtonTooltip(tab);
        }
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_CREATING: {
      const nativeTab = await browser.tabs.get(message.tabId);
      const tab = Tab.init(nativeTab, { inBackground: true });
      TabsUpdate.updateTab(tab, tab, { forceApply: true, tab });

      tab.$TST.addState(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
      TabsStore.addUnsynchronizedTab(tab);
      TabsStore.addLoadingTab(tab);
      if (configs.animation)
        CollapseExpand.setCollapsed(tab, {
          collapsed: true,
          justNow:   true
        });
      else
        reserveToUpdateLoadingState();
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_CREATED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      tab.$TST.addState(Constants.kTAB_STATE_ANIMATION_READY);
      tab.$TST.resolveOpened();
      if (message.maybeMoved)
        await waitUntilNewTabIsMoved(message.tabId);
      if (configs.animation) {
        await wait(0); // nextFrame() is too fast!
        CollapseExpand.setCollapsed(tab, {
          collapsed: false
        });
        reserveToUpdateLoadingState();
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      tab.$TST.addState(Constants.kTAB_STATE_RESTORED);
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_ACTIVATED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      TabsStore.activeTabInWindow.set(message.windowId, tab);
      TabsInternalOperation.setTabActive(tab);
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_UPDATED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      if (!tab)
        return;

      const highlightedChanged = 'highlighted' in message.updatedProperties;
      for (const key of Object.keys(message.updatedProperties)) {
        tab[key] = message.updatedProperties[key];
      }
      for (const key of Object.keys(message.addedAttributes)) {
        tab.$TST.setAttribute(key, message.addedAttributes[key]);
      }
      for (const key of message.removedAttributes) {
        tab.$TST.removeAttribute(key, );
      }
      for (const state of message.addedStates) {
        tab.$TST.addState(state);
      }
      for (const state of message.removedStates) {
        tab.$TST.removeState(state);
      }

      if (message.soundStateChanged) {
        const parent = tab.$TST.parent;
        if (parent)
          parent.$TST.inheritSoundStateFromChildren();
      }

      TabsStore.updateIndexesForTab(tab);

      reserveToUpdateSoundButtonTooltip(tab);
      tab.$TST.tooltiplIsDirty = true;

      if (highlightedChanged) {
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
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_MOVED: {
      maybeNewTabIsMoved(message.tabId);
      await Tab.waitUntilTracked([message.tabId, message.nextTabId], { element: true });
      const tab     = Tab.get(message.tabId);
      if (tab.index == message.newIndex)
        return;
      const nextTab = Tab.get(message.nextTabId);
      if (mInitialized &&
          tab.$TST.parent)
        tab.$TST.parent.$TST.tooltipIsDirty = true;

      tab.$TST.addState(Constants.kTAB_STATE_MOVING);

      let shouldAnimate = false;
      if (configs.animation &&
          !tab.pinned &&
          !tab.$TST.opening &&
          !tab.$TST.collapsed) {
        shouldAnimate = true;
        CollapseExpand.setCollapsed(tab, {
          collapsed: true,
          justNow:   true
        });
      }

      tab.index = message.newIndex;
      const window = TabsStore.windows.get(message.windowId);
      window.trackTab(tab);
      tab.$TST.element.parentNode.insertBefore(tab.$TST.element, nextTab && nextTab.$TST.element);

      if (shouldAnimate) {
        CollapseExpand.setCollapsed(tab, {
          collapsed: false
        });
        await wait(configs.collapseDuration);
      }
      tab.$TST.removeState(Constants.kTAB_STATE_MOVING);
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_INTERNALLY_MOVED: {
      maybeNewTabIsMoved(message.tabId);
      await Tab.waitUntilTracked([message.tabId, message.nextTabId], { element: true });
      const tab         = Tab.get(message.tabId);
      if (tab.index == message.newIndex)
        return;
      tab.index         = message.newIndex;
      Tab.track(tab);
      const tabElement  = tab.$TST.element;
      const nextTab     = Tab.get(message.nextTabId);
      const nextElement = nextTab && nextTab.$TST.element;
      if (tabElement.nextSibling != nextElement)
        tabElement.parentNode.insertBefore(tabElement, nextElement);
      if (!message.broadcasted) {
        // Tab element movement triggered by sidebar itself can break order of
        // tabs synchronized from the background, so for safetyl we trigger
        // synchronization.
        reserveToSyncTabsOrder();
      }
    }; break;

    case Constants.kCOMMAND_UPDATE_LOADING_STATE: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      if (tab) {
        const reallyChanged = !tab.$TST.states.has(message.status);
        if (message.status == 'loading') {
          tab.$TST.removeState(Constants.kTAB_STATE_BURSTING);
          TabsStore.addLoadingTab(tab);
          tab.$TST.addState(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
          TabsStore.addUnsynchronizedTab(tab);
        }
        else {
          if (reallyChanged) {
            tab.$TST.addState(Constants.kTAB_STATE_BURSTING);
            if (tab.$TST.delayedBurstEnd)
              clearTimeout(tab.$TST.delayedBurstEnd);
            tab.$TST.delayedBurstEnd = setTimeout(() => {
              delete tab.$TST.delayedBurstEnd;
              tab.$TST.removeState(Constants.kTAB_STATE_BURSTING);
              if (!tab.active)
                tab.$TST.addState(Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
            }, configs.burstDuration);
          }
          tab.$TST.removeState(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
          TabsStore.removeUnsynchronizedTab(tab);
          TabsStore.removeLoadingTab(tab);
        }
      }
      reserveToUpdateLoadingState();
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_REMOVING: {
      const tab = Tab.get(message.tabId);
      if (!tab)
        return;
      tab.$TST.parent = null;
      // remove from "highlighted tabs" cache immediately, to prevent misdetection for "multiple highlighted".
      TabsStore.removeHighlightedTab(tab);
      TabsStore.removeGroupTab(tab);
      TabsStore.addRemovingTab(tab);
      TabsStore.addRemovedTab(tab); // reserved
      reserveToUpdateLoadingState();
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_REMOVED: {
      const tab = Tab.get(message.tabId);
      TabsStore.windows.get(message.windowId).detachTab(message.tabId);
      if (!tab)
        return;
      if (!tab.$TST.collapsed &&
          configs.animation) {
        const tabRect = tab.$TST.element.getBoundingClientRect();
        tab.$TST.element.style.marginLeft = `${tabRect.width}px`;
        CollapseExpand.setCollapsed(tab, {
          collapsed: true
        });
        await wait(configs.animation ? configs.collapseDuration : 0);
      }
      tab.$TST.destroy();
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_LABEL_UPDATED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      tab.$TST.label = message.label;
      getLabelContent(tab).textContent = message.title;
      tab.$TST.tooltipIsDirty = true;
      if (configs.labelOverflowStyle == 'fade' &&
          !tab.$TST.labelIsDirty &&
          tab.$TST.collapsed)
        tab.$TST.labelIsDirty = true;
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      if (tab) {
        tab.favIconUrl = message.favIconUrl;
        TabFavIconHelper.loadToImage({
          image: getFavIcon(tab).firstChild,
          tab,
          url: message.favIconUrl
        });
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_SOUND_STATE_UPDATED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      if (message.hasSoundPlayingMember)
        tab.$TST.addState(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
      else
        tab.$TST.removeState(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
      if (message.hasMutedMember)
        tab.$TST.addState(Constants.kTAB_STATE_HAS_MUTED_MEMBER);
      else
        tab.$TST.removeState(Constants.kTAB_STATE_HAS_MUTED_MEMBER);
      reserveToUpdateSoundButtonTooltip(tab);
    }; break;

    case Constants.kCOMMAND_NOTIFY_HIGHLIGHTED_TABS_CHANGED: {
      await Tab.waitUntilTracked(message.tabIds, { element: true });
      TabsUpdate.updateTabsHighlighted(message);
      const window = TabsStore.windows.get(message.windowId);
      if (!window || !window.element)
        return;
      if (message.tabIds.lengt > 1)
        window.classList.add(Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED);
      else
        window.classList.remove(Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED);
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_PINNED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      if (tab) {
        tab.pinned = true;
        TabsStore.removeUnpinnedTab(tab);
        TabsStore.addPinnedTab(tab);
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_UNPINNED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      if (tab) {
        tab.pinned = false;
        TabsStore.removePinnedTab(tab);
        TabsStore.addUnpinnedTab(tab);
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_HIDDEN: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      if (tab) {
        tab.hidden = true;
        TabsStore.removeVisibleTab(tab);
        TabsStore.removeControllableTab(tab);
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_SHOWN: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      if (tab) {
        tab.hidden = false;
        if (!tab.$TST.collapsed)
          TabsStore.addVisibleTab(tab);
        TabsStore.addControllableTab(tab);
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_COLLAPSED_STATE_CHANGED: {
      if (message.collapsed)
        return;
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      TabsStore.addVisibleTab(tab);
      reserveToUpdateLoadingState();
      reserveToUpdateTwistyTooltip(tab);
      reserveToUpdateCloseboxTooltip(tab);
      if (mInitialized)
        tab.$TST.tooltipIsDirty = true;
      if (configs.labelOverflowStyle == 'fade' &&
          tab.$TST.labelIsDirty) {
        updateLabelOverflow(tab);
        delete tab.$TST.labelIsDirty;
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_DETACHED_FROM_WINDOW: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      tab.$TST.tooltipIsDirty = true;
      tab.$TST.parent = null;
      TabsStore.addRemovedTab(tab);
      const window = TabsStore.windows.get(message.windowId);
      window.untrackTab(message.tabId);
      if (tab.$TST.element.parentNode)
        tab.$TST.element.parentNode.removeChild(tab.$TST.element);
    }; break;

    case Constants.kCOMMAND_NOTIFY_GROUP_TAB_DETECTED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
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
    }; break;

    case Constants.kCOMMAND_NOTIFY_CHILDREN_CHANGED: {
      if (!mInitialized)
        return;
      await Tab.waitUntilTracked([message.tabId].concat(message.childIds), { element: true });
      const tab = Tab.get(message.tabId);

      tab.$TST.children = message.childIds;

      reserveToUpdateTwistyTooltip(tab);
      reserveToUpdateCloseboxTooltip(tab);
      if (message.newlyAttached || message.detached) {
        const ancestors = [tab].concat(tab.$TST.ancestors);
        for (const ancestor of ancestors) {
          updateDescendantsCount(ancestor);
          updateDescendantsHighlighted(ancestor);
        }
      }
      tab.$TST.tooltipIsDirty = true;
    }; break;
  }
});
