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

export function queryAll(conditions) {
  queryLogs.push(conditions);
  queryLogs.splice(0, Math.max(0, queryLogs.length - MAX_LOGS));
  fixupQuery(conditions);
  const startAt = Date.now();
  if (conditions.windowId || conditions.ordered) {
    let tabs = [];
    for (const window of windows.values()) {
      if (conditions.windowId && !matched(window.id, conditions.windowId))
        continue;
      const tabsIterator = conditions.tabs ||
        !conditions.ordered ? window.tabs.values() :
        conditions.last ? window.getReversedOrderedTabs(conditions.fromId, conditions.toId) :
          window.getOrderedTabs(conditions.fromId, conditions.toId);
      tabs = tabs.concat(extractMatchedTabs(tabsIterator, conditions));
    }
    conditions.elasped = Date.now() - startAt;
    return tabs;
  }
  else {
    const matchedTabs = extractMatchedTabs(conditions.tabs || tabs.values(), conditions);
    conditions.elasped = Date.now() - startAt;
    return matchedTabs;
  }
}

function extractMatchedTabs(tabs, conditions) {
  const matchedTabs = [];
  TAB_MACHING:
  for (const tab of tabs) {
    for (const attribute of MATCHING_ATTRIBUTES) {
      if (attribute in conditions &&
          !matched(tab[attribute], conditions[attribute]))
        continue TAB_MACHING;
      if (`!${attribute}` in conditions &&
          matched(tab[attribute], conditions[`!${attribute}`]))
        continue TAB_MACHING;
    }

    if (!tab.$TST)
      continue TAB_MACHING;

    if ('states' in conditions && tab.$TST.states) {
      for (let i = 0, maxi = conditions.states.length; i < maxi; i += 2) {
        const state   = conditions.states[i];
        const pattern = conditions.states[i+1];
        if (!matched(tab.$TST.states.has(state), pattern))
          continue TAB_MACHING;
      }
    }
    if ('attributes' in conditions && tab.$TST.attributes) {
      for (let i = 0, maxi = conditions.attributes.length; i < maxi; i += 2) {
        const attribute = conditions.attributes[i];
        const pattern   = conditions.attributes[i+1];
        if (!matched(tab.$TST.attributes[attribute], pattern))
          continue TAB_MACHING;
      }
    }

    if (conditions.living &&
        !ensureLivingTab(tab))
      continue TAB_MACHING;
    if (conditions.normal &&
        (tab.hidden ||
         tab.pinned))
      continue TAB_MACHING;
    if (conditions.visible &&
        (tab.$TST.states.has(Constants.kTAB_STATE_COLLAPSED) ||
         tab.hidden))
      continue TAB_MACHING;
    if (conditions.controllable &&
        tab.hidden)
      continue TAB_MACHING;
    if ('hasChild' in conditions &&
        conditions.hasChild != tab.$TST.hasChild)
      continue TAB_MACHING;
    if ('hasParent' in conditions &&
        conditions.hasParent != tab.$TST.hasParent)
      continue TAB_MACHING;

    matchedTabs.push(tab);
    if (conditions.first || conditions.last)
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

export function query(conditions) {
  queryLogs.push(conditions);
  queryLogs.splice(0, Math.max(0, queryLogs.length - MAX_LOGS));
  fixupQuery(conditions);
  if (conditions.last)
    conditions.ordered = true;
  else
    conditions.first = true;
  const startAt = Date.now();
  let tabs = [];
  if (conditions.windowId || conditions.ordered) {
    for (const window of windows.values()) {
      if (conditions.windowId && !matched(window.id, conditions.windowId))
        continue;
      const tabsIterator = conditions.tabs ||
        !conditions.ordered ? window.tabs.values() :
        conditions.last ? window.getReversedOrderedTabs(conditions.fromId, conditions.toId) :
          window.getOrderedTabs(conditions.fromId, conditions.toId);
      tabs = tabs.concat(extractMatchedTabs(tabsIterator, conditions));
      if (tabs.length > 0)
        break;
    }
  }
  else {
    tabs = extractMatchedTabs(conditions.tabs ||tabs.values(), conditions);
  }
  conditions.elasped = Date.now() - startAt;
  return tabs.length > 0 ? tabs[0] : null ;
}

function fixupQuery(conditions) {
  if (conditions.fromId || conditions.toId)
    conditions.ordered = true;
  if ((conditions.normal ||
       conditions.visible ||
       conditions.controllable ||
       conditions.pinned) &&
       !('living' in conditions))
    conditions.living = true;
}




//===================================================================
// Event Handling
//===================================================================

function normalizeOperatingTabIds(idOrIds) {
  if (!Array.isArray(idOrIds))
    idOrIds = [idOrIds];
  return idOrIds
    .map(id => parseInt(id))
    .filter(id => !!id)
    .map(id => typeof id == 'string' ? parseInt(id.match(/^tab-\d+-(\d+)$/)[1]) : id);
}

async function waitUntilTabsAreOperated(params = {}) {
  const ids = params.ids && normalizeOperatingTabIds(params.ids);
  let promises = [];
  if (params.operatingTabsInWindow) {
    if (ids) {
      for (const id of ids) {
        if (params.operatingTabsInWindow.has(id))
          promises.push(params.operatingTabsInWindow.get(id));
      }
    }
    else {
      promises.splice(0, 0, ...params.operatingTabsInWindow.values());
    }
  }
  else if (params.operatingTabs) {
    for (const operatingTabsInWindow of params.operatingTabs.values()) {
      if (ids) {
        for (let i = ids.length - 1; i > -1; i--) {
          const id = ids[i];
          if (operatingTabsInWindow.has(id)) {
            promises.push(operatingTabsInWindow.get(id));
            ids.splice(i, 1);
          }
        }
        if (ids.length == 0)
          break;
      }
      else {
        promises.splice(0, 0, ...operatingTabsInWindow.values());
      }
    }
  }
  else {
    throw new Error('missing required parameter: operatingTabs or operatingTabsInWindow');
  }
  promises = promises.filter(operating => !!operating);
  if (promises.length > 0)
    return Promise.all(promises);
  return [];
}

export function hasOperatingTab(params = {}) {
  if (!params.operatingTabs) {
    throw new Error('missing required parameter: operatingTabs');
  }
  if (params.windowId) {
    const operatingTabsInWindow = params.operatingTabs.get(params.windowId);
    return operatingTabsInWindow ? operatingTabsInWindow.size > 0 : false;
  }
  for (const operatingTabsInWindow of params.operatingTabs.values()) {
    if (operatingTabsInWindow.size > 0)
      return true;
  }
  return false;
}

const mCreatingTabs = new Map();

export function addCreatingTab(tab) {
  let onTabCreated;
  const creatingTabs = mCreatingTabs.get(tab.windowId) || new Map();
  if (configs.acceleratedTabCreation) {
    creatingTabs.set(tab.id, tab.$TST.promisedUniqueId);
    onTabCreated = () => {};
  }
  else {
    creatingTabs.set(tab.id, new Promise((resolve, _aReject) => {
      onTabCreated = (uniqueId) => { resolve(uniqueId); };
    }));
  }
  mCreatingTabs.set(tab.windowId, creatingTabs);
  tab.$TST.promisedUniqueId.then(_aUniqueId => {
    creatingTabs.delete(tab.id);
  });
  return onTabCreated;
}

export function hasCreatingTab(windowId = null) {
  return hasOperatingTab({ operatingTabs: mCreatingTabs, windowId });
}

export async function waitUntilAllTabsAreCreated(windowId = null) {
  const params = {};
  if (windowId) {
    params.operatingTabsInWindow = mCreatingTabs.get(windowId);
    if (!params.operatingTabsInWindow)
      return;
  }
  else {
    params.operatingTabs = mCreatingTabs;
  }
  return waitUntilTabsAreOperated(params)
    .then(aUniqueIds => aUniqueIds.map(uniqueId => uniqueId && tabsByUniqueId.get(uniqueId.id)));
}

export async function waitUntilTabsAreCreated(idOrIds) {
  return waitUntilTabsAreOperated({ ids: idOrIds, operatingTabs: mCreatingTabs })
    .then(aUniqueIds => aUniqueIds.map(uniqueId => uniqueId && tabsByUniqueId.get(uniqueId.id)));
}

const mMovingTabs = new Map();

export function hasMovingTab(windowId = null) {
  return hasOperatingTab({ operatingTabs: mMovingTabs, windowId });
}

export function addMovingTabId(tabId, windowId) {
  let onTabMoved;
  const promisedMoved = new Promise((resolve, _aReject) => {
    onTabMoved = resolve;
  });
  const movingTabs = mMovingTabs.get(windowId) || new Map();
  movingTabs.set(tabId, promisedMoved);
  mMovingTabs.set(windowId, movingTabs);
  promisedMoved.then(() => {
    movingTabs.delete(tabId);
  });
  return onTabMoved;
}

export async function waitUntilAllTabsAreMoved(windowId = null) {
  const params = {};
  if (windowId) {
    params.operatingTabsInWindow = mMovingTabs.get(windowId);
    if (!params.operatingTabsInWindow)
      return;
  }
  else {
    params.operatingTabs = mMovingTabs;
  }
  return waitUntilTabsAreOperated(params)
}

browser.windows.onRemoved.addListener(windowId => {
  mCreatingTabs.delete(windowId);
  mMovingTabs.delete(windowId);
});


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
