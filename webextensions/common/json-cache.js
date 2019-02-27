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
import * as TabsStore from './tabs-store.js';
import * as TabsUpdate from './tabs-update.js';
import * as UniqueId from './unique-id.js';

import Tab from './Tab.js';

function log(...args) {
  internalLogger('common/json-cache', ...args);
}

export async function getWindowSignature(windowIdOrTabs) {
  let tabs = windowIdOrTabs;
  if (typeof windowIdOrTabs == 'number') {
    tabs = await browser.tabs.query({ windowId: windowIdOrTabs });
  }
  return UniqueId.getFromTabs(tabs);
}

export function trimSignature(signature, ignoreCount) {
  if (!ignoreCount || ignoreCount < 0)
    return signature;
  return signature.slice(ignoreCount);
}

export function trimTabsCache(cache, ignoreCount) {
  if (!ignoreCount || ignoreCount < 0)
    return cache;
  return cache.slice(ignoreCount);
}

export function matcheSignatures(signatures) {
  return (
    signatures.actual &&
    signatures.cached &&
    signatures.actual.slice(-signatures.cached.length).join('\n') == signatures.cached.join('\n')
  );
}

export function signatureFromTabsCache(cache) {
  return cache.map(tab => tab.uniqueId);
}

export function restoreTabsFromCacheInternal(params) {
  log(`restoreTabsFromCacheInternal: restore tabs for ${params.windowId} from cache`);
  const offset = params.offset || 0;
  const window = TabsStore.windows.get(params.windowId);
  const tabs   = params.tabs.slice(offset).map(tab => Tab.get(tab.id));
  if (offset > 0 &&
      tabs.length <= offset) {
    log('restoreTabsFromCacheInternal: missing window');
    return [];
  }
  log(`restoreTabsFromCacheInternal: there is ${window.tabs.size} tabs`);
  if (params.cache.length != tabs.length) {
    log('restoreTabsFromCacheInternal: Mismatched number of restored tabs?');
    return [];
  }
  try {
    fixupTabsRestoredFromCache(tabs, params.cache, {
      dirty: params.shouldUpdate
    });
  }
  catch(e) {
    log(String(e), e.stack);
    throw e;
  }
  log('restoreTabsFromCacheInternal: done');
  Tab.dumpAll();
  return tabs;
}

function fixupTabsRestoredFromCache(tabs, cachedTabs, options = {}) {
  if (tabs.length != cachedTabs.length)
    throw new Error(`fixupTabsRestoredFromCache: Mismatched number of tabs restored from cache, tabs=${tabs.length}, cachedTabs=${cachedTabs.length}`);
  log('fixupTabsRestoredFromCache start ', { tabs: tabs.map(dumpTab), cachedTabs });
  const idMap = new Map();
  // step 1: build a map from old id to new id
  tabs = tabs.map((tab, index) => {
    const cachedTab = cachedTabs[index];
    const oldId     = cachedTab.id;
    tab = Tab.init(tab, { existing: true });
    log(`fixupTabsRestoredFromCache: remap ${oldId} => ${tab.id}`);
    idMap.set(oldId, tab);
    return tab;
  });
  // step 2: restore information of tabs
  tabs.forEach((tab, index) => {
    fixupTabRestoredFromCache(tab, cachedTabs[index], {
      idMap: idMap,
      dirty: options.dirty
    });
  });
  for (const tab of tabs) {
    if (!tab.$TST.parent) // process only root tabs
      fixupTreeCollapsedStateRestoredFromCache(tab);
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
  'pinned',
  'loading',
  'complete'
]);
const IGNORE_STATES = new Set([
  Constants.kTAB_STATE_ANIMATION_READY,
  Constants.kTAB_STATE_SUBTREE_COLLAPSED
]);

function fixupTabRestoredFromCache(tab, cachedTab, options = {}) {
  tab.$TST.clear();

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

  for (const state of cachedTab.states) {
    if (NATIVE_STATES.has(state) ||
        IGNORE_STATES.has(state))
      continue;
    tab.$TST.addState(state);
  }

  const idMap = options.idMap;

  log('fixupTabRestoredFromCache children: ', cachedTab.childIds);
  const childTabs = cachedTab.childIds
    .map(oldId => idMap.get(oldId))
    .filter(tab => !!tab);
  tab.$TST.children = childTabs;
  if (childTabs.length > 0)
    tab.$TST.setAttribute(Constants.kCHILDREN, `|${childTabs.map(tab => tab.id).join('|')}|`);
  else
    tab.$TST.removeAttribute(Constants.kCHILDREN);
  log('fixupTabRestoredFromCache children: => ', tab.$TST.childIds);

  log('fixupTabRestoredFromCache parent: ', cachedTab.parentId);
  const parentTab = idMap.get(cachedTab.parentId) || null;
  tab.$TST.parent = parentTab;
  if (parentTab)
    tab.$TST.setAttribute(Constants.kPARENT, parentTab.id);
  else
    tab.$TST.removeAttribute(Constants.kPARENT);
  log('fixupTabRestoredFromCache parent: => ', tab.$TST.parentId);

  tab.$TST.setAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER, cachedTab.attributes[Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER] || '');
  tab.$TST.setAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID, cachedTab.attributes[Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID] || '');
  tab.$TST.setAttribute(Constants.kCURRENT_URI, cachedTab.attributes[Constants.kCURRENT_URI] || tab.url);
  tab.$TST.setAttribute(Constants.kLEVEL, cachedTab.attributes[Constants.kLEVEL] || 0);
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
