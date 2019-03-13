/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
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

export async function restoreTabsFromCacheInternal(params) {
  log(`restoreTabsFromCacheInternal: restore tabs for ${params.windowId} from cache`);
  const offset  = params.offset || 0;
  const tabs    = params.tabs.slice(offset);
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
    if (configs.debug)
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
    if (configs.debug)
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
    await fixupTabsRestoredFromCache(tabElements, tabs, {
      dirty: params.shouldUpdate
    });
  }
  catch(e) {
    log(String(e), e.stack);
    throw e;
  }
  log('restoreTabsFromCacheInternal: done');
  if (configs.debug)
    Tab.dumpAll();
  return tabElements;
}

function dumpCache(cache) {
  log(cache
    .replace(new RegExp(`([^\\s=])="[^"]*(\\n[^"]*)+"`, 'g'), '$1="..."')
    .replace(/(<(li|ul))/g, '\n$1'));
}

async function fixupTabsRestoredFromCache(tabElements, tabs, options = {}) {
  if (tabElements.length != tabs.length)
    throw new Error(`fixupTabsRestoredFromCache: Mismatched number of tabs restored from cache, elements=${tabElements.length}, tabs.Tab=${tabs.length}`);
  log('fixupTabsRestoredFromCache start ', { elements: tabElements.map(tabElement => tabElement.id), tabs });
  // step 1: build a map from old id to new id
  tabElements.forEach((tabElement, index) => {
    tabElement.setAttribute('id', `tab-${tabs[index].id}`); // set tab element's id before initialization, to associate the tab element correctly
    const tab = Tab.init(tabs[index], { existing: true });
    tabElement.apiTab = tab;
    tab.$TST.setAttribute('id', tabElement.id);
    tab.$TST.element = tabElement;
    tabElement.$TST = tab.$TST;
    tab.$TST.setAttribute(Constants.kAPI_TAB_ID, tab.id || -1);
    tab.$TST.setAttribute(Constants.kAPI_WINDOW_ID, tab.windowId || -1);
  });
  // step 2: restore information of tabElements
  for (const tabElement of tabElements) {
    const tab = tabElement.apiTab;
    fixupTabRestoredFromCache(tabElement, tab);
    if (options.shouldUpdate)
      TabsUpdate.updateTab(tab, tab, { forceApply: true });
    if (!tab.$TST.parentId) // process only root tabs
      fixupTreeCollapsedStateRestoredFromCache(tab);
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

function fixupTabRestoredFromCache(tabElement, tab) {
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
}

function fixupTreeCollapsedStateRestoredFromCache(tab, shouldCollapse = false) {
  const tabElement = tab.$TST.element;
  if (shouldCollapse) {
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
  if (tab.$TST.states.has(Constants.kTAB_STATE_SUBTREE_COLLAPSED)) {
    if (!tabElement.classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
      tabElement.classList.add(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  }
  else {
    if (tabElement.classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
      tabElement.classList.remove(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  }
  if (!shouldCollapse)
    shouldCollapse = tab.$TST.states.has(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  for (const child of tab.$TST.children) {
    fixupTreeCollapsedStateRestoredFromCache(child, shouldCollapse);
  }
}
