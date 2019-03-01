/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as UniqueId from '/common/unique-id.js';

import Tab from '/common/Tab.js';
import Window from '/common/Window.js';

function log(...args) {
  internalLogger('sidebar/dom-cache', ...args);
}

export const wholeContainer = document.querySelector('#all-tabs');

export async function getWindowSignature(windowIdOrTabs) {
  let tabs = windowIdOrTabs;
  if (typeof windowIdOrTabs == 'number') {
    tabs = await browser.tabs.query({ windowId: windowIdOrTabs }).catch(ApiTabs.createErrorHandler());
  }
  const uniqueIds = await UniqueId.getFromTabs(tabs);
  return uniqueIds.map(id => id && id.id || '?').join('\n');
}

export function trimSignature(signature, ignoreCount) {
  if (!ignoreCount || ignoreCount < 0)
    return signature;
  return signature.split('\n').slice(ignoreCount).join('\n');
}

export function trimTabsCache(cache, ignoreCount) {
  if (!ignoreCount || ignoreCount < 0)
    return cache;
  return cache.replace(new RegExp(`(<li[^>]*>[\\w\\W]+?<\/li>){${ignoreCount}}`), '');
}

export function matcheSignatures(signatures) {
  return (
    signatures.actual &&
    signatures.cached &&
    signatures.actual.indexOf(signatures.cached) + signatures.cached.length == signatures.actual.length
  );
}

export function signatureFromTabsCache(cache) {
  const uniqueIdMatcher = new RegExp(`${Constants.kPERSISTENT_ID}="([^"]+)"`);
  if (!cache.match(/(<li[^>]*>[\w\W]+?<\/li>)/g))
    log('NO MATCH ', cache);
  return (cache.match(/(<li[^>]*>[\w\W]+?<\/li>)/g) || []).map(matched => {
    const uniqueId = matched.match(uniqueIdMatcher);
    return uniqueId ? uniqueId[1] : '?' ;
  }).join('\n');
}

export function restoreTabsFromCacheInternal(params) {
  log(`restoreTabsFromCacheInternal: restore tabs for ${params.windowId} from cache`);
  const offset    = params.offset || 0;
  const tabs   = params.tabs.slice(offset);
  let container = TabsStore.windows.get(params.windowId).element;
  let tabElements;
  if (offset > 0) {
    if (!container ||
        container.childNodes.length <= offset) {
      log('restoreTabsFromCacheInternal: missing container');
      return [];
    }
    log(`restoreTabsFromCacheInternal: there is ${container.childNodes.length} tabs`);
    log('restoreTabsFromCacheInternal: delete obsolete tabs, offset = ', offset, tabs[0].id);
    const insertionPoint = document.createRange();
    insertionPoint.selectNodeContents(container);
    // for safety, now I use actual ID string instead of short way.
    insertionPoint.setStartBefore(Tab.get(tabs[0].id).$TST.element);
    insertionPoint.setEndAfter(Tab.get(tabs[tabs.length - 1].id).$TST.element);
    insertionPoint.deleteContents();
    const tabsMustBeRemoved = tabs.map(tab => Tab.get(tab.id));
    log('restoreTabsFromCacheInternal: cleared?: ',
        tabsMustBeRemoved.every(tab => !tab),
        tabsMustBeRemoved.map(tab => tab.id));
    log(`restoreTabsFromCacheInternal: => ${container.childNodes.length} tabs`);
    const matched = params.cache.match(/<li/g);
    log(`restoreTabsFromCacheInternal: restore ${matched.length} tabs from cache`);
    dumpCache(params.cache);
    insertionPoint.selectNodeContents(container);
    insertionPoint.collapse(false);
    const source   = params.cache.replace(/^<ul[^>]+>|<\/ul>$/g, '');
    const fragment = insertionPoint.createContextualFragment(source);
    insertionPoint.insertNode(fragment);
    insertionPoint.detach();
    tabElements = Array.slice(container.childNodes, -matched.length);
  }
  else {
    if (container)
      container.parentNode.removeChild(container);
    log('restoreTabsFromCacheInternal: restore');
    dumpCache(params.cache);
    const insertionPoint = params.insertionPoint || (() => {
      const range = document.createRange();
      range.selectNodeContents(wholeContainer);
      range.collapse(false);
      return range;
    })();
    const fragment = insertionPoint.createContextualFragment(params.cache);
    container = fragment.firstChild;
    insertionPoint.insertNode(fragment);
    container.id = `window-${params.windowId}`;
    container.dataset.windowId = params.windowId;
    Window.init(params.windowId);
    tabElements = Array.from(container.childNodes);
    if (!params.insertionPoint)
      insertionPoint.detach();
  }

  log('restoreTabsFromCacheInternal: post process ', { tabElements, tabs });
  if (tabElements.length != tabs.length) {
    log('restoreTabsFromCacheInternal: Mismatched number of restored tabs?');
    container.parentNode.removeChild(container); // clear dirty tree!
    return [];
  }
  try {
    fixupTabsRestoredFromCache(tabElements, tabs, {
      dirty: params.shouldUpdate
    });
  }
  catch(e) {
    log(String(e), e.stack);
    throw e;
  }
  log('restoreTabsFromCacheInternal: done');
  Tab.dumpAll();
  return tabElements;
}

function dumpCache(cache) {
  log(cache
    .replace(new RegExp(`([^\\s=])="[^"]*(\\n[^"]*)+"`, 'g'), '$1="..."')
    .replace(/(<(li|ul))/g, '\n$1'));
}

function fixupTabsRestoredFromCache(tabElements, tabs, options = {}) {
  if (tabElements.length != tabs.length)
    throw new Error(`fixupTabsRestoredFromCache: Mismatched number of tabs restored from cache, elements=${tabElements.length}, tabs.Tab=${tabs.length}`);
  log('fixupTabsRestoredFromCache start ', { elements: tabElements.map(tabElement => tabElement.id), tabs });
  const idMap = {};
  // step 1: build a map from old id to new id
  tabs = tabElements.map((tabElement, index) => {
    const oldId = parseInt(tabElement.getAttribute(Constants.kAPI_TAB_ID));
    tabElement.setAttribute('id', `tab-${tabs[index].id}`); // set tab element's id before initialization, to associate the tab element correctly
    const tab = Tab.init(tabs[index], { existing: true });
    tabElement.apiTab = tab;
    tab.$TST.setAttribute('id', tabElement.id);
    tab.$TST.element = tabElement;
    tabElement.$TST = tab.$TST;
    log(`fixupTabsRestoredFromCache: remap ${oldId} => ${tab.id}`);
    tab.$TST.setAttribute(Constants.kAPI_TAB_ID, tab.id || -1);
    tab.$TST.setAttribute(Constants.kAPI_WINDOW_ID, tab.windowId || -1);
    idMap[oldId] = tabElement;
    return tab;
  });
  // step 2: restore information of tabElements
  tabElements.forEach((tabElement, index) => {
    fixupTabRestoredFromCache(tabElement, tabs[index], {
      idMap: idMap,
      dirty: options.dirty
    });
  });
  for (const tabElement of tabElements) {
    if (!tabElement.$TST.parent) // process only root tabs
      fixupTreeCollapsedStateRestoredFromCache(tabElement.apiTab);
  }
  // step 3: update tabs based on restored information.
  // this step must be done after the step 2 is finished for all tabs
  // because updating operation can refer other tabs.
  if (options.dirty) {
    for (const tab of tabs) {
      TabsUpdate.updateTab(tab, tab, { forceApply: true });
    }
  }
}

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

function fixupTabRestoredFromCache(tabElement, tab, options = {}) {
  for (const state of tabElement.classList) {
    if (IGNORE_CLASS_STATES.has(state))
      continue;
    tab.$TST.addState(state);
  }
  for (const state of NATIVE_STATES) {
    if (tab[state])
      tab.$TST.addState(state);
    else
      tab.$TST.removeState(state);
  }
  if (tab.status == 'loading') {
    tab.$TST.addState('loading');
    tab.$TST.removeState('complete');
  }
  else {
    tab.$TST.addState('complete');
    tab.$TST.removeState('loading');
  }

  const idMap = options.idMap;

  log('fixupTabRestoredFromCache children: ', tabElement.getAttribute(Constants.kCHILDREN));
  const childTabs = (tabElement.getAttribute(Constants.kCHILDREN) || '')
    .split('|')
    .map(oldId => idMap[oldId])
    .filter(tabElement => !!tabElement);
  tab.$TST.children = childTabs.map(tabElement => tabElement.apiTab.id);
  if (childTabs.length > 0)
    tab.$TST.setAttribute(Constants.kCHILDREN, `|${childTabs.map(tabElement => tabElement.id).join('|')}|`);
  else
    tab.$TST.removeAttribute(Constants.kCHILDREN);
  log('fixupTabRestoredFromCache children: => ', tab.$TST.childIds);

  log('fixupTabRestoredFromCache parent: ', tabElement.getAttribute(Constants.kPARENT));
  const parentTab = idMap[tabElement.getAttribute(Constants.kPARENT)] || null;
  tab.$TST.parent = parentTab && parentTab.apiTab.id;
  if (parentTab)
    tab.$TST.setAttribute(Constants.kPARENT, parentTab.id);
  else
    tab.$TST.removeAttribute(Constants.kPARENT);
  log('fixupTabRestoredFromCache parent: => ', tab.$TST.parentId);

  tab.$TST.setAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER, tabElement.getAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER) || '');
  tab.$TST.setAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID, tabElement.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID) || '');
  tab.$TST.setAttribute(Constants.kCURRENT_URI, tabElement.getAttribute(Constants.kCURRENT_URI) || tab.url);
  tab.$TST.setAttribute(Constants.kLEVEL, tabElement.getAttribute(Constants.kLEVEL) || 0);
  tab.$TST.uniqueId.id = tabElement.getAttribute(Constants.kPERSISTENT_ID) || tab.$TST.uniqueId.id;
  tab.$TST.setAttribute(Constants.kPERSISTENT_ID, tab.$TST.uniqueId.id);
}

async function fixupTreeCollapsedStateRestoredFromCache(tab, shouldCollapse = false) {
  if (shouldCollapse) {
    tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED);
    tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED_DONE);
  }
  else {
    tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED);
    tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED_DONE);
  }
  //if (tab.classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
  const states = await tab.$TST.getPermanentStates();
  if (states.includes(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
    tab.$TST.addState(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  else
    tab.$TST.removeState(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  if (!shouldCollapse)
    shouldCollapse = tab.$TST.states.has(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  for (const child of tab.$TST.children) {
    fixupTreeCollapsedStateRestoredFromCache(child, shouldCollapse);
  }
}
