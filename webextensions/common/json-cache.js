/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from './common.js';
import * as Constants from './constants.js';
import * as Tabs from './tabs.js';
import * as TabsUpdate from './tabs-update.js';

import Tab from './Tab.js';

function log(...args) {
  internalLogger('common/json-cache', ...args);
}

export async function getWindowSignature(windowIdOrTabs) {
  if (typeof windowIdOrTabs == 'number') {
    windowIdOrTabs = await browser.tabs.query({ windowId: windowIdOrTabs });
  }
  return Tabs.getUniqueIds(windowIdOrTabs);
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
  const window = Tabs.trackedWindows.get(params.windowId);
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
  log('fixupTabsRestoredFromCache start ', { tabs: tabs.map(tab => tab.id), cachedTabs });
  const idMap = new Map();
  // step 1: build a map from old id to new id
  tabs = tabs.map((tab, index) => {
    const cachedTab = cachedTabs[index];
    const oldId     = cachedTab.id;
    tab = Tab.init(tab);
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
  Tabs.initPromisedStatus(tab, true);

  tab.$TST.clear();

  for (const state of NATIVE_STATES) {
    if (tab[state])
      Tabs.addState(tab, state);
    else
      Tabs.removeState(tab, state);
  }
  if (tab.status == 'loading') {
    Tabs.addState(tab, 'loading');
    Tabs.removeState(tab, 'complete');
  }
  else {
    Tabs.addState(tab, 'complete');
    Tabs.removeState(tab, 'loading');
  }

  for (const state of cachedTab.states) {
    if (NATIVE_STATES.has(state) ||
        IGNORE_STATES.has(state))
      continue;
    Tabs.addState(tab, state);
  }

  const idMap = options.idMap;

  log('fixupTabRestoredFromCache children: ', cachedTab.childIds);
  const childTabs = cachedTab.childIds
    .map(oldId => idMap.get(oldId))
    .filter(tab => !!tab);
  tab.$TST.children = childTabs;
  if (childTabs.length > 0)
    Tabs.setAttribute(tab, Constants.kCHILDREN, `|${childTabs.map(tab => tab.id).join('|')}|`);
  else
    Tabs.removeAttribute(tab, Constants.kCHILDREN);
  log('fixupTabRestoredFromCache children: => ', tab.$TST.childIds);

  log('fixupTabRestoredFromCache parent: ', cachedTab.parentId);
  const parentTab = idMap.get(cachedTab.parentId) || null;
  tab.$TST.parent = parentTab;
  if (parentTab)
    Tabs.setAttribute(tab, Constants.kPARENT, parentTab.id);
  else
    Tabs.removeAttribute(tab, Constants.kPARENT);
  log('fixupTabRestoredFromCache parent: => ', tab.$TST.parentId);
  tab.$TST.ancestors = Tab.getAncestors(tab, { force: true });

  Tabs.setAttribute(tab, Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER, cachedTab.attributes[Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER] || '');
  Tabs.setAttribute(tab, Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID, cachedTab.attributes[Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID] || '');
  Tabs.setAttribute(tab, Constants.kCURRENT_URI, cachedTab.attributes[Constants.kCURRENT_URI] || tab.url);
  Tabs.setAttribute(tab, Constants.kLEVEL, cachedTab.attributes[Constants.kLEVEL] || 0);
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
  const states = await Tabs.getPermanentStates(tab);
  if (states.includes(Constants.kTAB_STATE_SUBTREE_COLLAPSED))
    Tabs.addState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  else
    Tabs.removeState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  if (!shouldCollapse)
    shouldCollapse = Tabs.hasState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  for (const child of tab.$TST.children) {
    fixupTreeCollapsedStateRestoredFromCache(child, shouldCollapse);
  }
}
