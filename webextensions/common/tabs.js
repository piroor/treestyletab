/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import * as Constants from './constants.js';
import {
  log as internalLogger,
  configs
} from './common.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

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

export const trackedWindows           = new Map();
export const trackedTabs              = new Map();
export const trackedTabsByUniqueId    = new Map();
export const activeTabForWindow       = new Map();
export const highlightedTabsForWindow = new Map();

function isTracked(tabId) {
  return trackedTabs.has(tabId);
}

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
  fixupQuery(conditions);
  if (conditions.windowId || conditions.ordered) {
    let tabs = [];
    for (const window of trackedWindows.values()) {
      if (conditions.windowId && !matched(window.id, conditions.windowId))
        continue;
      const tabsIterator = !conditions.ordered ? window.tabs.values() :
        conditions.last ? window.getReversedOrderedTabs(conditions.fromId, conditions.toId) :
          window.getOrderedTabs(conditions.fromId, conditions.toId);
      tabs = tabs.concat(extractMatchedTabs(tabsIterator, conditions));
    }
    return tabs;
  }
  else {
    return extractMatchedTabs(trackedTabs.values(), conditions);
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
        if (!matched(tab.$TST.states[state], pattern))
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
  fixupQuery(conditions);
  if (conditions.last)
    conditions.ordered = true;
  else
    conditions.first = true;
  let tabs = [];
  if (conditions.windowId || conditions.ordered) {
    for (const window of trackedWindows.values()) {
      if (conditions.windowId && !matched(window.id, conditions.windowId))
        continue;
      const tabsIterator = !conditions.ordered ? window.tabs.values() :
        conditions.last ? window.getReversedOrderedTabs(conditions.fromId, conditions.toId) :
          window.getOrderedTabs(conditions.fromId, conditions.toId);
      tabs = tabs.concat(extractMatchedTabs(tabsIterator, conditions));
      if (tabs.length > 0)
        break;
    }
  }
  else {
    tabs = extractMatchedTabs(trackedTabs.values(), conditions);
  }
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

export const onGroupTabDetected = new EventListenerManager();
export const onLabelUpdated     = new EventListenerManager();
export const onFaviconUpdated   = new EventListenerManager();
export const onStateChanged     = new EventListenerManager();
export const onPinned           = new EventListenerManager();
export const onUnpinned         = new EventListenerManager();
export const onHidden           = new EventListenerManager();
export const onShown            = new EventListenerManager();
export const onHighlightedTabsChanged = new EventListenerManager();
export const onParentTabUpdated = new EventListenerManager();
export const onTabInternallyMoved     = new EventListenerManager();
export const onCollapsedStateChanging = new EventListenerManager();
export const onCollapsedStateChanged  = new EventListenerManager();

export const onBeforeCreate     = new EventListenerManager();
export const onCreating         = new EventListenerManager();
export const onCreated          = new EventListenerManager();
export const onRemoving         = new EventListenerManager();
export const onRemoved          = new EventListenerManager();
export const onMoving           = new EventListenerManager();
export const onMoved            = new EventListenerManager();
export const onActivating       = new EventListenerManager();
export const onActivated        = new EventListenerManager();
export const onUpdated          = new EventListenerManager();
export const onRestoring        = new EventListenerManager();
export const onRestored         = new EventListenerManager();
export const onWindowRestoring  = new EventListenerManager();
export const onAttached         = new EventListenerManager();
export const onDetached         = new EventListenerManager();

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
    .then(aUniqueIds => aUniqueIds.map(uniqueId => uniqueId && trackedTabsByUniqueId.get(uniqueId.id)));
}

export async function waitUntilTabsAreCreated(idOrIds) {
  return waitUntilTabsAreOperated({ ids: idOrIds, operatingTabs: mCreatingTabs })
    .then(aUniqueIds => aUniqueIds.map(uniqueId => uniqueId && trackedTabsByUniqueId.get(uniqueId.id)));
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
      !isTracked(tab.id) ||
      tab.$TST.states.has(Constants.kTAB_STATE_REMOVING))
    return null;
  return tab;
}
