/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab
} from './common.js';
import * as Constants from './constants.js';
import * as Tabs from './tabs.js';
import * as TabsUpdate from './tabs-update.js';

function log(...args) {
  internalLogger('common/cache', ...args);
}

export async function getWindowSignature(windowIdOrTabs) {
  if (typeof windowIdOrTabs == 'number') {
    windowIdOrTabs = await browser.tabs.query({ windowId: windowIdOrTabs });
  }
  const uniqueIds = await Tabs.getUniqueIds(windowIdOrTabs);
  return uniqueIds.join('\n');
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
  const apiTabs   = params.tabs.slice(offset);
  let container = Tabs.getTabsContainer(params.windowId);
  let tabElements;
  if (offset > 0) {
    if (!container ||
        container.childNodes.length <= offset) {
      log('restoreTabsFromCacheInternal: missing container');
      return [];
    }
    log(`restoreTabsFromCacheInternal: there is ${container.childNodes.length} tabs`);
    log('restoreTabsFromCacheInternal: delete obsolete tabs, offset = ', offset, apiTabs[0].id);
    const insertionPoint = document.createRange();
    insertionPoint.selectNodeContents(container);
    // for safety, now I use actual ID string instead of short way.
    insertionPoint.setStartBefore(Tabs.getTabElementById(Tabs.makeTabId(apiTabs[0])));
    insertionPoint.setEndAfter(Tabs.getTabElementById(Tabs.makeTabId(apiTabs[apiTabs.length - 1])));
    insertionPoint.deleteContents();
    const tabsMustBeRemoved = apiTabs.map(Tabs.getTabElementById);
    log('restoreTabsFromCacheInternal: cleared?: ',
        tabsMustBeRemoved.every(tab => !tab),
        tabsMustBeRemoved.map(dumpTab));
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
      range.selectNodeContents(Tabs.allElementsContainer);
      range.collapse(false);
      return range;
    })();
    const fragment = insertionPoint.createContextualFragment(params.cache);
    container = fragment.firstChild;
    insertionPoint.insertNode(fragment);
    container.id = `window-${params.windowId}`;
    container.dataset.windowId = params.windowId;
    Tabs.initElementsContainer(container);
    tabElements = Array.from(container.childNodes);
    if (!params.insertionPoint)
      insertionPoint.detach();
  }

  log('restoreTabsFromCacheInternal: post process ', { tabElements, apiTabs });
  if (tabElements.length != apiTabs.length) {
    log('restoreTabsFromCacheInternal: Mismatched number of restored tabs?');
    container.parentNode.removeChild(container); // clear dirty tree!
    return [];
  }
  try {
    fixupTabsRestoredFromCache(tabElements, apiTabs, {
      dirty: params.shouldUpdate
    });
  }
  catch(e) {
    log(String(e), e.stack);
    throw e;
  }
  log('restoreTabsFromCacheInternal: done');
  Tabs.dumpAllTabs();
  return tabElements;
}

function dumpCache(cache) {
  log(cache
    .replace(new RegExp(`([^\\s=])="[^"]*(\\n[^"]*)+"`, 'g'), '$1="..."')
    .replace(/(<(li|ul))/g, '\n$1'));
}

function fixupTabsRestoredFromCache(tabElements, apiTabs, options = {}) {
  if (tabElements.length != apiTabs.length)
    throw new Error(`fixupTabsRestoredFromCache: Mismatched number of tabs restored from cache, elements=${tabElements.length}, tabs.Tab=${apiTabs.length}`);
  log('fixupTabsRestoredFromCache start ', { elements: tabElements.map(tabElement => tabElement.id), apiTabs: apiTabs });
  const idMap = {};
  // step 1: build a map from old id to new id
  tabElements.forEach((tabElement, index) => {
    const oldId = tabElement.id;
    const apiTab = apiTabs[index];
    tabElement.apiTab = apiTab;
    if (!apiTab.$TST)
      new Tabs.Tab(apiTab);
    Tabs.setAttribute(apiTab, 'id', Tabs.makeTabId(apiTab));
    apiTab.$TST.element = tabElement;
    tabElement.$TST = apiTab.$TST;
    log(`fixupTabsRestoredFromCache: remap ${oldId} => ${tabElement.id}`);
    Tabs.setAttribute(apiTab, Constants.kAPI_TAB_ID, apiTab.id || -1);
    Tabs.setAttribute(apiTab, Constants.kAPI_WINDOW_ID, apiTab.windowId || -1);
    idMap[oldId] = tabElement;
  });
  // step 2: restore information of tabElements
  tabElements.forEach((tabElement, index) => {
    fixupTabRestoredFromCache(tabElement, apiTabs[index], {
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
    for (const tab of apiTabs) {
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

function fixupTabRestoredFromCache(tabElement, apiTab, options = {}) {
  Tabs.initPromisedStatus(apiTab, true);

  for (const state of tabElement.classList) {
    if (IGNORE_CLASS_STATES.has(state))
      continue;
    Tabs.addState(apiTab, state);
  }
  for (const state of NATIVE_STATES) {
    if (apiTab[state])
      Tabs.addState(apiTab, state);
    else
      Tabs.removeState(apiTab, state);
  }
  if (apiTab.status == 'loading') {
    Tabs.addState(apiTab, 'loading');
    Tabs.removeState(apiTab, 'complete');
  }
  else {
    Tabs.addState(apiTab, 'complete');
    Tabs.removeState(apiTab, 'loading');
  }

  const idMap = options.idMap;

  log('fixupTabRestoredFromCache children: ', tabElement.getAttribute(Constants.kCHILDREN));
  const childTabs = (tabElement.getAttribute(Constants.kCHILDREN) || '')
    .split('|')
    .map(oldId => idMap[oldId])
    .filter(tabElement => !!tabElement);
  apiTab.$TST.children = childTabs.map(tabElement => tabElement.apiTab.id);
  if (childTabs.length > 0)
    Tabs.setAttribute(apiTab, Constants.kCHILDREN, `|${childTabs.map(tabElement => tabElement.id).join('|')}|`);
  else
    Tabs.removeAttribute(apiTab, Constants.kCHILDREN);
  log('fixupTabRestoredFromCache children: => ', tabElement.getAttribute(Constants.kCHILDREN));

  log('fixupTabRestoredFromCache parent: ', tabElement.getAttribute(Constants.kPARENT));
  const parentTab = idMap[tabElement.getAttribute(Constants.kPARENT)] || null;
  apiTab.$TST.parent = parentTab && parentTab.apiTab.id;
  if (parentTab)
    Tabs.setAttribute(apiTab, Constants.kPARENT, parentTab.id);
  else
    Tabs.removeAttribute(apiTab, Constants.kPARENT);
  log('fixupTabRestoredFromCache parent: => ', tabElement.getAttribute(Constants.kPARENT));
  apiTab.$TST.ancestors = Tabs.getAncestorTabs(apiTab, { force: true, element: false });

  if (tabElement.dataset.alreadyGroupedForPinnedOpener)
    Tabs.setAttribute(apiTab, 'data-already-grouped-for-pinned-opener', tabElement.dataset.alreadyGroupedForPinnedOpener);
  if (tabElement.dataset.originalOpenerTabId)
    Tabs.setAttribute(apiTab, 'data-original-opener-tab-id', tabElement.dataset.originalOpenerTabId);
  Tabs.setAttribute(apiTab, Constants.kCURRENT_URI, tabElement.getAttribute(Constants.kCURRENT_URI) || apiTab.url);
  Tabs.setAttribute(apiTab, Constants.kLEVEL, tabElement.getAttribute(Constants.kLEVEL) || 0);
}

async function fixupTreeCollapsedStateRestoredFromCache(tab, shouldCollapse = false) {
  if (shouldCollapse) {
    Tabs.addState(tab, Constants.kTAB_STATE_COLLAPSED);
    Tabs.addState(tab, Constants.kTAB_STATE_COLLAPSED_DONE);
  }
  else {
    Tabs.removeState(tab, Constants.kTAB_STATE_COLLAPSED);
    Tabs.removeState(tab, Constants.kTAB_STATE_COLLAPSED_DONE);
  }
  //if (tab.classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
  const states = await Tabs.getPermanentStates(tab);
  if (states.includes(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
    Tabs.addState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  else
    Tabs.removeState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  if (!shouldCollapse)
    shouldCollapse = Tabs.hasState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  for (const child of tab.$TST.children) {
    fixupTreeCollapsedStateRestoredFromCache(child.$TST.element, shouldCollapse);
  }
}
