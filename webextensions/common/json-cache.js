/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from './tabs-store.js';
import * as TabsUpdate from './tabs-update.js';
import * as MetricsData from '/common/metrics-data.js';

import Tab from './Tab.js';

function log(...args) {
  internalLogger('common/json-cache', ...args);
}

export async function getWindowSignature(windowIdOrTabs) {
  let tabs = windowIdOrTabs;
  if (typeof windowIdOrTabs == 'number') {
    tabs = await browser.tabs.query({ windowId: windowIdOrTabs }).catch(ApiTabs.createErrorHandler());
  }
  tabs = tabs.map(tab => Tab.get(tab.id)).filter(tab => !!tab);
  return Promise.all(tabs.map(tab => tab.$TST.promisedUniqueId.then(id => id.id || '?')));
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
  return cache.map(tab => tab.uniqueId.id || tab.uniqueId);
}

export async function restoreTabsFromCacheInternal(params) {
  MetricsData.add('restoreTabsFromCacheInternal: start');
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
    await MetricsData.addAsync('rebuildAll: fixupTabsRestoredFromCache', fixupTabsRestoredFromCache(tabs, params.permanentStates, params.cache, {
      dirty: params.shouldUpdate
    }));
  }
  catch(e) {
    log(String(e), e.stack);
    throw e;
  }
  log('restoreTabsFromCacheInternal: done');
  if (configs.debug)
    Tab.dumpAll();
  return tabs;
}

async function fixupTabsRestoredFromCache(tabs, permanentStates, cachedTabs, options = {}) {
  MetricsData.add('fixupTabsRestoredFromCache: start');
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
  MetricsData.add('fixupTabsRestoredFromCache: step 1 done.');
  // step 2: restore information of tabs
  tabs.forEach((tab, index) => {
    fixupTabRestoredFromCache(tab, permanentStates[index], cachedTabs[index], {
      idMap: idMap,
      dirty: options.dirty
    });
    if (!tab.$TST.parent) // process only root tabs
      fixupTreeCollapsedStateRestoredFromCache(tab, false);
    TabsStore.updateIndexesForTab(tab);
    TabsUpdate.updateTab(tab, tab, { forceApply: true });
  });
  MetricsData.add('fixupTabsRestoredFromCache: step 2 done.');
}

function fixupTabRestoredFromCache(tab, permanentStates, cachedTab, options = {}) {
  tab.$TST.clear();
  tab.$TST.states = new Set([...cachedTab.states, ...permanentStates]);
  tab.$TST.attributes = cachedTab.attributes;

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
}

function fixupTreeCollapsedStateRestoredFromCache(tab, shouldCollapse = false) {
  if (shouldCollapse) {
    tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED);
    tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED_DONE);
  }
  else {
    tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED);
    tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED_DONE);
  }
  if (!shouldCollapse)
    shouldCollapse = tab.$TST.subtreeCollapsed;
  for (const child of tab.$TST.children) {
    fixupTreeCollapsedStateRestoredFromCache(child, shouldCollapse);
  }
}
