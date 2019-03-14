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
import * as TabsStore from '/common/tabs-store.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as MetricsData from '/common/metrics-data.js';

import Tab from '/common/Tab.js';
import Window from '/common/Window.js';

import * as SidebarTabs from './sidebar-tabs.js';

function log(...args) {
  internalLogger('sidebar/dom-cache', ...args);
}

export async function getWindowSignature(windowIdOrTabs) {
  let tabs = windowIdOrTabs;
  if (typeof windowIdOrTabs == 'number') {
    tabs = await browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_PULL_TABS,
      windowId: windowIdOrTabs
    });
  }
  const uniqueIds = tabs.map(tab => tab.$TST.uniqueId);
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
  MetricsData.add('restoreTabsFromCacheInternal: start');
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
      range.selectNodeContents(SidebarTabs.wholeContainer);
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
  MetricsData.add('restoreTabsFromCacheInternal: DOM tree restoration finished');

  log('restoreTabsFromCacheInternal: post process ', { tabElements, tabs });
  if (tabElements.length != tabs.length) {
    log('restoreTabsFromCacheInternal: Mismatched number of restored tabs?');
    container.parentNode.removeChild(container); // clear dirty tree!
    return [];
  }
  try {
    await MetricsData.addAsync('restoreTabsFromCacheInternal: fixing restored DOM tree', async () => {
      const parent = container.parentNode;
      parent.removeChild(container); // remove from DOM tree to optimize
      await fixupTabsRestoredFromCache(tabElements, tabs, {
        dirty: params.shouldUpdate
      });
      parent.appendChild(container);
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
  MetricsData.add('fixupTabsRestoredFromCache: start');
  if (tabElements.length != tabs.length)
    throw new Error(`fixupTabsRestoredFromCache: Mismatched number of tabs restored from cache, elements=${tabElements.length}, tabs.Tab=${tabs.length}`);
  log('fixupTabsRestoredFromCache start ', { elements: tabElements.map(tabElement => tabElement.id), tabs });
  // step 1: build a map from old id to new id
  tabElements.forEach((tabElement, index) => {
    tabElement.setAttribute('id', `tab-${tabs[index].id}`); // set tab element's id before initialization, to associate the tab element correctly
    const tab = tabs[index];
    tab.$TST.bindElement(tabElement);
    tabElement.apiTab = tab;
    Tab.init(tab, { existing: true });
    tab.$TST.setAttribute('id', tabElement.id);
    tabElement.$TST = tab.$TST;
    tab.$TST.setAttribute(Constants.kAPI_TAB_ID, tab.id || -1);
    tab.$TST.setAttribute(Constants.kAPI_WINDOW_ID, tab.windowId || -1);
  });
  MetricsData.add('fixupTabsRestoredFromCache: step 1 finished');
  // step 2: restore information of tabElements
  for (const tabElement of tabElements) {
    const tab = tabElement.apiTab;
    SidebarTabs.applyStatesToElement(tab);
    if (options.dirty)
      TabsUpdate.updateTab(tab, tab, { forceApply: true });
  }
  MetricsData.add('fixupTabsRestoredFromCache: step 2 finished');
}
