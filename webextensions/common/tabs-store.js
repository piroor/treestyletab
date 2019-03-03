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
    if (query.tabs && query.tabs.name)
      query.indexedTabs = query.tabs.name;
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
    if (query.tabs && query.tabs.name)
      query.indexedTabs = query.tabs.name;
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
// Indexes for optimization
//===================================================================

export const activeTabForWindow       = new Map();
export const activeTabsForWindow      = new Map();
export const removingTabsForWindow    = new Map();
export const removedTabsForWindow     = new Map();
export const visibleTabsForWindow     = new Map();
export const selectedTabsForWindow    = new Map();
export const highlightedTabsForWindow = new Map();
export const pinnedTabsForWindow      = new Map();
export const unpinnedTabsForWindow    = new Map();
export const rootTabsForWindow        = new Map();
export const groupTabsForWindow       = new Map();
export const collapsingTabsForWindow  = new Map();
export const expandingTabsForWindow   = new Map();
export const toBeExpandedTabsForWindow = new Map();
export const draggingTabsForWindow    = new Map();
export const duplicatingTabsForWindow = new Map();
export const toBeGroupedTabsForWindow = new Map();
export const unsynchronizedTabsForWindow = new Map();

function createMapWithName(name) {
  const map = new Map();
  map.name = name;
  return map;
}

export function prepareIndexesForWindow(windowId) {
  activeTabsForWindow.set(windowId, new Set());
  removingTabsForWindow.set(windowId, createMapWithName(`removing tabs in window ${windowId}`));
  removedTabsForWindow.set(windowId, createMapWithName(`removed tabs in window ${windowId}`));
  visibleTabsForWindow.set(windowId, createMapWithName(`visible tabs in window ${windowId}`));
  selectedTabsForWindow.set(windowId, createMapWithName(`selected tabs in window ${windowId}`));
  highlightedTabsForWindow.set(windowId, createMapWithName(`highlighted tabs in window ${windowId}`));
  pinnedTabsForWindow.set(windowId, createMapWithName(`pinned tabs in window ${windowId}`));
  unpinnedTabsForWindow.set(windowId, createMapWithName(`unpinned tabs in window ${windowId}`));
  rootTabsForWindow.set(windowId, createMapWithName(`root tabs in window ${windowId}`));
  groupTabsForWindow.set(windowId, createMapWithName(`group tabs in window ${windowId}`));
  collapsingTabsForWindow.set(windowId, createMapWithName(`collapsing tabs in window ${windowId}`));
  expandingTabsForWindow.set(windowId, createMapWithName(`expanding tabs in window ${windowId}`));
  toBeExpandedTabsForWindow.set(windowId, createMapWithName(`to-be-expanded tabs in window ${windowId}`));
  draggingTabsForWindow.set(windowId, createMapWithName(`dragging tabs in window ${windowId}`));
  duplicatingTabsForWindow.set(windowId, createMapWithName(`duplicating tabs in window ${windowId}`));
  toBeGroupedTabsForWindow.set(windowId, createMapWithName(`to-be-grouped tabs in window ${windowId}`));
  unsynchronizedTabsForWindow.set(windowId, createMapWithName(`unsynchronized tabs in window ${windowId}`));
}

export function unprepareIndexesForWindow(windowId) {
  activeTabForWindow.delete(windowId);
  activeTabsForWindow.delete(windowId);
  removingTabsForWindow.delete(windowId);
  removedTabsForWindow.delete(windowId);
  visibleTabsForWindow.delete(windowId);
  selectedTabsForWindow.delete(windowId);
  highlightedTabsForWindow.delete(windowId);
  pinnedTabsForWindow.delete(windowId);
  unpinnedTabsForWindow.delete(windowId);
  rootTabsForWindow.delete(windowId);
  groupTabsForWindow.delete(windowId);
  collapsingTabsForWindow.delete(windowId);
  expandingTabsForWindow.delete(windowId);
  toBeExpandedTabsForWindow.delete(windowId);
  toBeGroupedTabsForWindow.delete(windowId);
  unsynchronizedTabsForWindow.delete(windowId);
}

export function updateIndexesForTab(tab) {
  if (tab.hidden || tab.$TST.collapsed)
    removeVisibleTab(tab);
  else
    addVisibleTab(tab);

  if (tab.$TST.states.has(Constants.kTAB_STATE_SELECTED))
    addSelectedTab(tab);
  else
    removeSelectedTab(tab);

  if (tab.highlighted)
    addHighlightedTab(tab);
  else
    removeHighlightedTab(tab);

  if (tab.pinned) {
    removeUnpinnedTab(tab);
    addPinnedTab(tab);
  }
  else {
    removePinnedTab(tab);
    addUnpinnedTab(tab);
  }

  if (tab.$TST.isGroupTab)
    addGroupTab(tab);
  else
    removeGroupTab(tab);

  if (tab.$TST.duplicating)
    addDuplicatingTab(tab);
  else
    removeDuplicatingTab(tab);

  if (tab.$TST.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID) &&
      !tab.$TST.getAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER))
    addToBeGroupedTab(tab);
  else
    removeToBeGroupedTab(tab);

  if (tab.$TST.parent)
    removeRootTab(tab);
  else
    addRootTab(tab);
}

export function removeTabFromIndexes(tab) {
  removeRemovingTab(tab);
  //removeRemovedTab(tab);
  removeVisibleTab(tab);
  removeSelectedTab(tab);
  removeHighlightedTab(tab);
  removePinnedTab(tab);
  removeUnpinnedTab(tab);
  removeRootTab(tab);
  removeGroupTab(tab);
  removeCollapsingTab(tab);
  removeExpandingTab(tab);
  removeToBeExpandedTab(tab);
  removeDuplicatingTab(tab);
  removeDraggingTab(tab);
  removeToBeGroupedTab(tab);
  removeUnsynchronizedTab(tab);
}

function addTabToIndex(tab, indexes) {
  const tabs = indexes.get(tab.windowId);
  tabs.set(tab.id, tab);
}

function removeTabFromIndex(tab, indexes) {
  const tabs = indexes.get(tab.windowId);
  if (tabs)
    tabs.delete(tab.id);
}

export function addRemovingTab(tab) {
  addTabToIndex(tab, removingTabsForWindow);
}
export function removeRemovingTab(tab) {
  removeTabFromIndex(tab, removingTabsForWindow);
}

export function addRemovedTab(tab) {
  addTabToIndex(tab, removedTabsForWindow);
  setTimeout(removeRemovedTab, 100000, {
    id:       tab.id,
    windowId: tab.windowId
  });
}
function removeRemovedTab(tab) {
  removeTabFromIndex(tab, removedTabsForWindow);
}

export function addVisibleTab(tab) {
  addTabToIndex(tab, visibleTabsForWindow);
}
export function removeVisibleTab(tab) {
  removeTabFromIndex(tab, visibleTabsForWindow);
}

export function addSelectedTab(tab) {
  addTabToIndex(tab, selectedTabsForWindow);
}
export function removeSelectedTab(tab) {
  removeTabFromIndex(tab, selectedTabsForWindow);
}

export function addHighlightedTab(tab) {
  addTabToIndex(tab, highlightedTabsForWindow);
}
export function removeHighlightedTab(tab) {
  removeTabFromIndex(tab, highlightedTabsForWindow);
}

export function addPinnedTab(tab) {
  addTabToIndex(tab, pinnedTabsForWindow);
}
export function removePinnedTab(tab) {
  removeTabFromIndex(tab, pinnedTabsForWindow);
}

export function addUnpinnedTab(tab) {
  addTabToIndex(tab, unpinnedTabsForWindow);
}
export function removeUnpinnedTab(tab) {
  removeTabFromIndex(tab, unpinnedTabsForWindow);
}

export function addRootTab(tab) {
  addTabToIndex(tab, rootTabsForWindow);
}
export function removeRootTab(tab) {
  removeTabFromIndex(tab, rootTabsForWindow);
}

export function addGroupTab(tab) {
  addTabToIndex(tab, groupTabsForWindow);
}
export function removeGroupTab(tab) {
  removeTabFromIndex(tab, groupTabsForWindow);
}

export function addCollapsingTab(tab) {
  addTabToIndex(tab, collapsingTabsForWindow);
}
export function removeCollapsingTab(tab) {
  removeTabFromIndex(tab, collapsingTabsForWindow);
}

export function addExpandingTab(tab) {
  addTabToIndex(tab, expandingTabsForWindow);
}
export function removeExpandingTab(tab) {
  removeTabFromIndex(tab, expandingTabsForWindow);
}

export function addToBeExpandedTab(tab) {
  addTabToIndex(tab, toBeExpandedTabsForWindow);
}
export function removeToBeExpandedTab(tab) {
  removeTabFromIndex(tab, toBeExpandedTabsForWindow);
}

export function addDuplicatingTab(tab) {
  addTabToIndex(tab, duplicatingTabsForWindow);
}
export function removeDuplicatingTab(tab) {
  removeTabFromIndex(tab, duplicatingTabsForWindow);
}

export function addDraggingTab(tab) {
  addTabToIndex(tab, draggingTabsForWindow);
}
export function removeDraggingTab(tab) {
  removeTabFromIndex(tab, draggingTabsForWindow);
}

export function addToBeGroupedTab(tab) {
  addTabToIndex(tab, toBeGroupedTabsForWindow);
}
export function removeToBeGroupedTab(tab) {
  removeTabFromIndex(tab, toBeGroupedTabsForWindow);
}

export function addUnsynchronizedTab(tab) {
  addTabToIndex(tab, unsynchronizedTabsForWindow);
}
export function removeUnsynchronizedTab(tab) {
  removeTabFromIndex(tab, unsynchronizedTabsForWindow);
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
