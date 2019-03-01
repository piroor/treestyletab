/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from './constants.js';
import {
  log as internalLogger,
  configs
} from './common.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/tabs', ...args);
}


let mTargetWindow;

export function setWindow(targetWindow) {
  return mTargetWindow = targetWindow;
}

export function getWindow() {
  return mTargetWindow;
}


//===================================================================
// Tab Tracking
//===================================================================

export const windows        = new Map();
export const tabs           = new Map();
export const tabsByUniqueId = new Map();

// indexes for better performance
export const activeTabForWindow       = new Map();
export const activeTabsForWindow      = new Map();
export const highlightedTabsForWindow = new Map();
export const groupTabsForWindow       = new Map();
export const collapsingTabsForWindow  = new Map();
export const expandingTabsForWindow   = new Map();

export const queryLogs = [];
const MAX_LOGS = 100000;

const MATCHING_ATTRIBUTES = `
active
attention
audible
autoDiscardable
cookieStoreId
discarded
favIconUrl
hidden
highlighted
id
incognito
index
isArticle
isInReaderMode
pinned
sessionId
status
successorId
title
url
`.trim().split(/\s+/);

export function queryAll(query) {
  if (configs.loggingQueries) {
    queryLogs.push(query);
    queryLogs.splice(0, Math.max(0, queryLogs.length - MAX_LOGS));
  }
  fixupQuery(query);
  const startAt = Date.now();
  if (query.windowId || query.ordered) {
    let tabs = [];
    for (const window of windows.values()) {
      if (query.windowId && !matched(window.id, query.windowId))
        continue;
      const sourceTabs = sourceTabsForQuery(query, window);
      tabs = tabs.concat(extractMatchedTabs(sourceTabs, query));
    }
    query.elapsed = Date.now() - startAt;
    return tabs;
  }
  else {
    const matchedTabs = extractMatchedTabs((query.tabs || tabs).values(), query);
    query.elapsed = Date.now() - startAt;
    return matchedTabs;
  }
}

function sourceTabsForQuery(query, window) {
  if (!query.ordered)
    return query.tabs && query.tabs.values() || window.tabs.values();
  if (query.last)
    return window.getReversedOrderedTabs(query.fromId, query.toId, query.tabs);
  return window.getOrderedTabs(query.fromId, query.toId, query.tabs);
}

function extractMatchedTabs(tabs, query) {
  const matchedTabs = [];
  TAB_MACHING:
  for (const tab of tabs) {
    for (const attribute of MATCHING_ATTRIBUTES) {
      if (attribute in query &&
          !matched(tab[attribute], query[attribute]))
        continue TAB_MACHING;
      if (`!${attribute}` in query &&
          matched(tab[attribute], query[`!${attribute}`]))
        continue TAB_MACHING;
    }

    if (!tab.$TST)
      continue TAB_MACHING;

    if ('states' in query && tab.$TST.states) {
      for (let i = 0, maxi = query.states.length; i < maxi; i += 2) {
        const state   = query.states[i];
        const pattern = query.states[i+1];
        if (!matched(tab.$TST.states.has(state), pattern))
          continue TAB_MACHING;
      }
    }
    if ('attributes' in query && tab.$TST.attributes) {
      for (let i = 0, maxi = query.attributes.length; i < maxi; i += 2) {
        const attribute = query.attributes[i];
        const pattern   = query.attributes[i+1];
        if (!matched(tab.$TST.attributes[attribute], pattern))
          continue TAB_MACHING;
      }
    }

    if (query.living &&
        !ensureLivingTab(tab))
      continue TAB_MACHING;
    if (query.normal &&
        (tab.hidden ||
         tab.pinned))
      continue TAB_MACHING;
    if (query.visible &&
        (tab.$TST.states.has(Constants.kTAB_STATE_COLLAPSED) ||
         tab.hidden))
      continue TAB_MACHING;
    if (query.controllable &&
        tab.hidden)
      continue TAB_MACHING;
    if ('hasChild' in query &&
        query.hasChild != tab.$TST.hasChild)
      continue TAB_MACHING;
    if ('hasParent' in query &&
        query.hasParent != tab.$TST.hasParent)
      continue TAB_MACHING;

    matchedTabs.push(tab);
    if (query.first || query.last)
      break TAB_MACHING;
  }
  return matchedTabs;
}

function matched(value, pattern) {
  if (pattern instanceof RegExp &&
      !pattern.test(String(value)))
    return false;
  if (pattern instanceof Set &&
      !pattern.has(value))
    return false;
  if (Array.isArray(pattern) &&
      !pattern.includes(value))
    return false;
  if (typeof pattern == 'function' &&
      !pattern(value))
    return false;
  if (typeof pattern == 'boolean' &&
      !!value !== pattern)
    return false;
  if (typeof pattern == 'string' &&
      String(value || '') != pattern)
    return false;
  if (typeof pattern == 'number' &&
      value != pattern)
    return false;
  return true;
}

export function query(query) {
  if (configs.loggingQueries) {
    queryLogs.push(query);
    queryLogs.splice(0, Math.max(0, queryLogs.length - MAX_LOGS));
  }
  fixupQuery(query);
  if (query.last)
    query.ordered = true;
  else
    query.first = true;
  const startAt = Date.now();
  let tabs = [];
  if (query.windowId || query.ordered) {
    for (const window of windows.values()) {
      if (query.windowId && !matched(window.id, query.windowId))
        continue;
      const sourceTabs = sourceTabsForQuery(query, window);
      tabs = tabs.concat(extractMatchedTabs(sourceTabs, query));
      if (tabs.length > 0)
        break;
    }
  }
  else {
    tabs = extractMatchedTabs((query.tabs ||tabs).values(), query);
  }
  query.elapsed = Date.now() - startAt;
  return tabs.length > 0 ? tabs[0] : null ;
}

function fixupQuery(query) {
  if (query.fromId || query.toId)
    query.ordered = true;
  if ((query.normal ||
       query.visible ||
       query.controllable ||
       query.pinned) &&
       !('living' in query))
    query.living = true;
}


//===================================================================
// Cache for optimization
//===================================================================

function addCachedTab(tab, store) {
  const tabs = store.get(tab.windowId);
  tabs.set(tab.id, tab);
}

function removeCachedTab(tab, store) {
  const tabs = store.get(tab.windowId);
  if (tabs)
    tabs.delete(tab.id);
}

export function addHighlightedTab(tab) {
  addCachedTab(tab, highlightedTabsForWindow);
}

export function removeHighlightedTab(tab) {
  removeCachedTab(tab, highlightedTabsForWindow);
}

export function addGroupTab(tab) {
  addCachedTab(tab, groupTabsForWindow);
}

export function removeGroupTab(tab) {
  removeCachedTab(tab, groupTabsForWindow);
}

export function addCollapsingTab(tab) {
  addCachedTab(tab, collapsingTabsForWindow);
}

export function removeCollapsingTab(tab) {
  removeCachedTab(tab, collapsingTabsForWindow);
}

export function addExpandingTab(tab) {
  addCachedTab(tab, expandingTabsForWindow);
}

export function removeExpandingTab(tab) {
  removeCachedTab(tab, expandingTabsForWindow);
}



//===================================================================
// Utilities
//===================================================================

export function assertValidTab(tab) {
  if (tab && tab.$TST)
    return;
  const error = new Error('FATAL ERROR: invalid tab is given');
  console.log(error.message, tab, error.stack);
  throw error;
}

export function ensureLivingTab(tab) {
  if (!tab ||
      !tab.id ||
      !tab.$TST ||
      (tab.$TST.element &&
       !tab.$TST.element.parentNode) ||
      !tabs.has(tab.id) ||
      tab.$TST.states.has(Constants.kTAB_STATE_REMOVING))
    return null;
  return tab;
}


//===================================================================
// Logging
//===================================================================

browser.runtime.onMessage.addListener((message, _sender) => {
  if (!message ||
      typeof message != 'object' ||
      message.type != Constants.kCOMMAND_REQUEST_QUERY_LOGS)
    return;

  browser.runtime.sendMessage({
    type: Constants.kCOMMAND_RESPONSE_QUERY_LOGS,
    logs: JSON.parse(JSON.stringify(queryLogs)),
    windowId: mTargetWindow || 'background'
  });
});
