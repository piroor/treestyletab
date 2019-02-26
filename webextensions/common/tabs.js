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
import * as ApiTabs from './api-tabs.js';
import {
  log as internalLogger,
  configs
} from './common.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/tabs', ...args);
}


let mTargetWindow;

export const allElementsContainer = document.querySelector('#all-tabs');

export const trackedWindows           = new Map();
export const trackedTabs              = new Map();
export const trackedTabsByUniqueId    = new Map();
export const activeTabForWindow       = new Map();
export const highlightedTabsForWindow = new Map();

let mBindToElement = false;

export function bindToElement() {
  mBindToElement = true;
}

export function boundToElement() {
  return mBindToElement;
}


//===================================================================
// Helper Class
//===================================================================

export class Tab {
  constructor(tab) {
    const alreadyTracked = trackedTabs.get(tab.id);
    if (alreadyTracked)
      return alreadyTracked.$TST;

    tab.$TST = this;
    this.tab = tab;
    this.id  = tab.id;

    this.element = null;

    this.clear();

    this.uniqueId = {
      id:            null,
      originalId:    null,
      originalTabId: null
    };
    if (tab.id)
      this.promisedUniqueId = updateUniqueId(tab);
    else
      this.promisedUniqueId = Promise.resolve(this.uniqueId);

    trackedTabs.set(tab.id, tab);

    // eslint-disable-next-line no-use-before-define
    const window = trackedWindows.get(tab.windowId) || new Window(tab.windowId);
    window.trackTab(tab);
  }

  destroy() {
    this.detach();

    if (this.reservedCleanupNeedlessGroupTab) {
      clearTimeout(this.reservedCleanupNeedlessGroupTab);
      delete this.reservedCleanupNeedlessGroupTab;
    }

    trackedTabs.delete(this.id);
    if (this.uniqueId)
      trackedTabsByUniqueId.delete(this.uniqueId.id)

    if (this.element) {
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      delete this.element.$TST;
      delete this.element.apiTab;
      delete this.element;
    }
    delete this.tab.$TST;
    delete this.tab;
    delete this.promisedUniqueId;
    delete this.uniqueId;
  }

  clear() {
    this.states     = {};
    this.attributes = {};

    this.parentId    = null;
    this.ancestorIds = [];
    this.childIds    = [];
  }

  set parent(tab) {
    this.parentId = tab && (typeof tab == 'number' ? tab : tab.id);
    return tab;
  }
  get parent() {
    return this.parentId && ensureLivingTab(trackedTabs.get(this.parentId));
  }

  get hasParent() {
    return !!this.parentId;
  }

  set ancestors(tabs) {
    this.ancestorIds = tabs.map(tab => typeof tab == 'number' ? tab : tab && tab.id).filter(id => id);
    return tabs;
  }
  get ancestors() {
    return this.ancestorIds.map(id => trackedTabs.get(id)).filter(ensureLivingTab);
  }

  set children(tabs) {
    this.childIds = tabs.map(tab => typeof tab == 'number' ? tab : tab && tab.id).filter(id => id);
    return tabs;
  }
  get children() {
    return this.childIds.map(id => trackedTabs.get(id)).filter(ensureLivingTab);
  }

  get hasChild() {
    return this.childIds.length > 0;
  }

  sortChildren() {
    this.childIds = sort(this.childIds.map(id => trackedTabs.get(id))).map(tab => tab.id);
  }

  detach() {
    const parent = this.parent;
    if (parent) {
      this.childIds  = parent.$TST.childIds.filter(childId => childId != this.id);
      this.parent    = null;
      this.ancestors = [];
    }
    for (const child of this.children) {
      if (child.$TST.parentId == this.id) {
        child.$TST.parentId = null;
        child.$TST.ancestors = child.$TST.ancestors.filter(ancestor => ancestor.id != this.id);
      }
    }
    this.children = [];
  }

  export() {
    return {
      id:         this.id,
      uniqueId:   this.uniqueId.id,
      states:     Object.keys(this.states),
      attributes: this.attributes,
      parentId:   this.parentId,
      childIds:   this.childIds
    };
  }
}

export class Window {
  constructor(windowId) {
    const alreadyTracked = trackedWindows.get(windowId);
    if (alreadyTracked)
      return alreadyTracked;

    this.id    = windowId;
    this.tabs  = new Map();
    this.order = [];

    this.element = null;

    this.internalMovingTabs  = new Set();
    this.alreadyMovedTabs    = new Set();
    this.internalClosingTabs = new Set();
    this.tabsToBeHighlightedAlone = new Set();

    this.subTreeMovingCount =
      this.subTreeChildrenMovingCount =
      this.doingIntelligentlyCollapseExpandCount =
      this.internalFocusCount =
      this.internalSilentlyFocusCount =
      this.tryingReforcusForClosingActiveTabCount = // used only on Firefox 64 and older
      this.duplicatingTabsCount = 0;

    this.preventAutoGroupNewTabsUntil = Date.now() + configs.autoGroupNewTabsDelayOnNewWindow;

    this.openingTabs   = new Set();

    this.openedNewTabs = [];

    this.toBeOpenedTabsWithPositions = 0;
    this.toBeOpenedOrphanTabs        = 0;

    this.toBeAttachedTabs = new Set();
    this.toBeDetachedTabs = new Set();

    trackedWindows.set(windowId, this);
    highlightedTabsForWindow.set(windowId, new Set());
  }

  destroy() {
    for (const tab of this.tabs.values()) {
      if (tab.$TST)
        tab.$TST.destroy();
    }
    this.tabs.clear();
    trackedWindows.delete(this.id, this);
    activeTabForWindow.delete(this.id);
    highlightedTabsForWindow.delete(this.id);

    if (this.element) {
      const element = this.element;
      if (element.parentNode && !element.hasChildNodes())
        element.parentNode.removeChild(element);
      delete this.element;
    }

    delete this.tabs;
    delete this.order;
    delete this.id;
  }

  getOrderedTabs(startId, endId) {
    let order = this.order;
    if (startId) {
      if (!this.tabs.has(startId))
        return [];
      order = order.slice(order.indexOf(startId));
    }
    return (function*() {
      for (const id of order) {
        yield this.tabs.get(id);
        if (id == endId)
          break;
      }
    }).call(this);
  }

  getReversedOrderedTabs(startId, endId) {
    let order = this.order.slice(0).reverse();
    if (startId) {
      if (!this.tabs.has(startId))
        return [];
      order = order.slice(order.indexOf(startId));
    }
    return (function*() {
      for (const id of order) {
        yield this.tabs.get(id);
        if (id == endId)
          break;
      }
    }).call(this);
  }

  trackTab(tab) {
    const alreadyTracked = trackedTabs.get(tab.id);
    if (alreadyTracked)
      tab = alreadyTracked;

    const order = this.order;
    if (this.tabs.has(tab.id)) { // already tracked: update
      const index = order.indexOf(tab.id);
      order.splice(index, 1);
      order.splice(tab.index, 0, tab.id);
      for (let i = Math.min(index, tab.index), maxi = Math.max(index, tab.index) + 1; i < maxi; i++) {
        this.tabs.get(order[i]).index = i;
      }
      const parent = tab.$TST.parent;
      if (parent)
        parent.$TST.sortChildren();
      //console.log('Tabs.track / updated order: ', order);
    }
    else { // not tracked yet: add
      this.tabs.set(tab.id, tab);
      order.splice(tab.index, 0, tab.id);
      for (let i = tab.index + 1, maxi = order.length; i < maxi; i++) {
        this.tabs.get(order[i]).index = i;
      }
      //console.log('Tabs.track / order: ', order);
    }
    return tab;
  }

  detachTab(tabId) {
    const tab = trackedTabs.get(tabId);
    if (!tab)
      return;

    tab.$TST.detach();
    this.tabs.delete(tabId);
    const order = this.order;
    const index = order.indexOf(tab.id);
    order.splice(index, 1);
    if (this.tabs.size == 0) {
      this.destroy();
    }
    else {
      for (let i = index, maxi = order.length; i < maxi; i++) {
        this.tabs.get(order[i]).index = i;
      }
    }
    return tab;
  }

  untrackTab(tabId) {
    const tab = this.detachTab(tabId);
    if (tab)
      tab.$TST.destroy();
  }

  export() {
    const tabs = [];
    for (const tab of this.getOrderedTabs()) {
      tabs.push(tab.$TST.export());
    }
    return tabs;
  }
}


//===================================================================
// Tab Tracking
//===================================================================

export function track(tab) {
  const trackedTab = trackedTabs.get(tab.id);
  if (!trackedTab)
    tab.$TST = new Tab(tab);
}

export function untrack(tabId) {
  const tab    = trackedTabs.get(tabId);
  const window = trackedWindows.get(tab.windowId);
  if (window)
    window.untrackTab(tabId);
}

function isTracked(tabId) {
  return trackedTabs.has(tabId);
}

// queryings

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
        (hasState(tab, Constants.kTAB_STATE_COLLAPSED) ||
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

    const extracted = conditions.element ? tab.$TST.element : tab;
    if (extracted) {
      matchedTabs.push(extracted);
      if (conditions.first || conditions.last)
        break TAB_MACHING;
    }
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
// Tab Related Utilities
//===================================================================

export function setWindow(targetWindow) {
  return mTargetWindow = targetWindow;
}

export function getWindow() {
  return mTargetWindow;
}

export function sort(tabs) {
  if (tabs.length == 0)
    return tabs;
  if (tabs[0] instanceof Element)
    return tabs.sort(documentPositionComparator);
  return tabs.sort((a, b) => a.index - b.index);
}

function documentPositionComparator(a, b) {
  if (a === b || !a || !b)
    return 0;

  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING)
    return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING)
    return 1;

  return 0;
}

export function sanitize(tab) {
  tab = Object.assign({}, tab, {
    '$TST': JSON.parse(JSON.stringify({
      states:      tab.$TST.states,
      attributes:  tab.$TST.attributes,
      parentId:    tab.$TST.parentId,
      ancestorIds: tab.$TST.ancestorIds,
      childIds:    tab.$TST.childIds
    }))
  });
  return tab;
}


//===================================================================
// Operate Tab ID
//===================================================================

export function makeTabId(tab) {
  return `tab-${tab.windowId}-${tab.id}`;
}

export async function requestUniqueId(tabOrId, options = {}) {
  if (typeof options != 'object')
    options = {};

  let tab = tabOrId;
  if (typeof tabOrId == 'number')
    tab = trackedTabs.get(tabOrId);

  if (options.inRemote) {
    return await browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_REQUEST_UNIQUE_ID,
      id:       tab.id,
      forceNew: !!options.forceNew
    });
  }

  let originalId    = null;
  let originalTabId = null;
  let duplicated    = false;
  if (!options.forceNew) {
    let oldId = await browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_ID);
    if (oldId && !oldId.tabId) // ignore broken information!
      oldId = null;

    if (oldId) {
      // If the tab detected from stored tabId is different, it is duplicated tab.
      try {
        const tabWithOldId = trackedTabs.get(oldId.tabId);
        if (!tabWithOldId)
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
        originalId = (tabWithOldId.$TST.uniqueId || await tabWithOldId.$TST.promisedUniqueId).id;
        duplicated = tab && tabWithOldId.id != tab.id && originalId == oldId.id;
        if (duplicated)
          originalTabId = oldId.tabId;
        else
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
      }
      catch(e) {
        ApiTabs.handleMissingTabError(e);
        // It fails if the tab doesn't exist.
        // There is no live tab for the tabId, thus
        // this seems to be a tab restored from session.
        // We need to update the related tab id.
        await browser.sessions.setTabValue(tab.id, Constants.kPERSISTENT_ID, {
          id:    oldId.id,
          tabId: tab.id
        });
        return {
          id:            oldId.id,
          originalId:    null,
          originalTabId: oldId.tabId,
          restored:      true
        };
      }
    }
  }

  const adjective   = Constants.kID_ADJECTIVES[Math.floor(Math.random() * Constants.kID_ADJECTIVES.length)];
  const noun        = Constants.kID_NOUNS[Math.floor(Math.random() * Constants.kID_NOUNS.length)];
  const randomValue = Math.floor(Math.random() * 1000);
  const id          = `tab-${adjective}-${noun}-${Date.now()}-${randomValue}`;
  // tabId is for detecttion of duplicated tabs
  await browser.sessions.setTabValue(tab.id, Constants.kPERSISTENT_ID, { id, tabId: tab.id });
  return { id, originalId, originalTabId, duplicated };
}

export function updateUniqueId(tab) {
  return requestUniqueId(tab, {
    inRemote: !!mTargetWindow
  }).then(uniqueId => {
    if (uniqueId && ensureLivingTab(tab)) { // possibly removed from document while waiting
      tab.$TST.uniqueId = uniqueId;
      trackedTabsByUniqueId.set(uniqueId.id, tab);
      setAttribute(tab, Constants.kPERSISTENT_ID, uniqueId.id);
    }
    return uniqueId || {};
  }).catch(error => {
    console.log(`FATAL ERROR: Failed to get unique id for a tab ${tab.id}: `, error);
    return {};
  });
}

export async function getUniqueIds(tabs) {
  const uniqueIds = await Promise.all(tabs.map(tab => browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_ID)));
  return uniqueIds.map(id => id && id.id || '?');
}


//===================================================================
// Event Handling
//===================================================================

export const onTabElementBuilt  = new EventListenerManager();
export const onGroupTabDetected = new EventListenerManager();
export const onLabelUpdated     = new EventListenerManager();
export const onFaviconUpdated   = new EventListenerManager();
export const onStateChanged     = new EventListenerManager();
export const onPinned           = new EventListenerManager();
export const onUnpinned         = new EventListenerManager();
export const onHidden           = new EventListenerManager();
export const onShown            = new EventListenerManager();
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
    .then(aUniqueIds => aUniqueIds.map(uniqueId => getTabByUniqueId(uniqueId.id)));
}

export async function waitUntilTabsAreCreated(idOrIds) {
  return waitUntilTabsAreOperated({ ids: idOrIds, operatingTabs: mCreatingTabs })
    .then(aUniqueIds => aUniqueIds.map(uniqueId => getTabByUniqueId(uniqueId.id)));
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
// Create Tabs
//===================================================================

export function initTab(tab, options = {}) {
  log('initalize tab ', tab);
  const trackedTab = trackedTabs.get(tab.id);
  if (trackedTab)
    tab = trackedTab;
  tab.$TST = (trackedTab && trackedTab.$TST) || new Tab(tab);

  if (mBindToElement) {
    const tabElement = document.createElement('li');
    tab.$TST.element = tabElement;
    tabElement.$TST = tab.$TST;
    tabElement.apiTab = tab;
  }

  if (tab.active)
    addState(tab, Constants.kTAB_STATE_ACTIVE);
  addState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);

  if (mBindToElement) {
    tab.$TST.element.classList.add('tab');
    setAttribute(tab, 'id', makeTabId(tab));
    setAttribute(tab, Constants.kAPI_TAB_ID, tab.id || -1);
    setAttribute(tab, Constants.kAPI_WINDOW_ID, tab.windowId || -1);

    const labelContainer = document.createElement('span');
    labelContainer.classList.add(Constants.kLABEL);
    const label = labelContainer.appendChild(document.createElement('span'));
    label.classList.add(`${Constants.kLABEL}-content`);
    tab.$TST.element.appendChild(labelContainer);

    onTabElementBuilt.dispatch(tab, options);
  }

  if (options.existing)
    addState(tab, Constants.kTAB_STATE_ANIMATION_READY);

  initPromisedStatus(tab);

  return tab;
}

export function initWindow(windowId, container = null) {
  const window = trackedWindows.get(windowId) || new Window(windowId);

  if (boundToElement()) {
    if (!container) {
      container = document.getElementById(`window-${windowId}`);
      if (!container) {
        container = document.createElement('ul');
        allElementsContainer.appendChild(container);
      }
    }
    container.dataset.windowId = windowId;
    container.setAttribute('id', `window-${windowId}`);
    container.classList.add('tabs');
    container.$TST = window;
    container.$TST.element = container;
  }
  return window;
}

export function clearAllElements() {
  const range = document.createRange();
  range.selectNodeContents(allElementsContainer);
  range.deleteContents();
  range.detach();
}


//===================================================================
// Get Tabs
//===================================================================

// basics
function assertValidTab(tab) {
  if (tab && tab.$TST)
    return;
  const error = new Error('FATAL ERROR: invalid tab is given');
  console.log(error.message, tab, error.stack);
  throw error;
}

export function getTabByUniqueId(id) {
  if (!id)
    return null;
  return ensureLivingTab(trackedTabsByUniqueId.get(id));
}

// Note that this function can return null if it is the first tab of
// a new window opened by the "move tab to new window" command.
export function getActiveTab(windowId) {
  return ensureLivingTab(activeTabForWindow.get(windowId));
}
export function getActiveTabs() {
  return Array.from(activeTabForWindow.values(), ensureLivingTab);
}

export function getNextTab(tab) {
  if (!tab)
    return null;
  assertValidTab(tab);
  return query({
    windowId: tab.windowId,
    fromId:   tab.id,
    living:   true,
    index:    (index => index > tab.index)
  });
}

export function getPreviousTab(tab) {
  if (!tab)
    return null;
  assertValidTab(tab);
  return query({
    windowId: tab.windowId,
    fromId:   tab.id,
    living:   true,
    index:    (index => index < tab.index),
    last:     true
  });
}

export function getFirstTab(windowId) {
  return query({
    windowId,
    living:  true,
    ordered: true
  });
}

export function getLastTab(windowId) {
  return query({
    windowId,
    living: true,
    last:   true
  });
}

export function getLastVisibleTab(windowId) { // visible, not-collapsed, not-hidden
  return query({
    windowId,
    visible: true,
    last:    true,
  });
}

export function getLastOpenedTab(windowId) {
  const tabs = getTabs(windowId);
  return tabs.length > 0 ?
    tabs.sort((a, b) => b.id - a.id)[0] :
    null ;
}

function getTabIndex(tab, options = {}) {
  if (typeof options != 'object')
    options = {};
  if (!ensureLivingTab(tab))
    return -1;
  assertValidTab(tab);

  if (tab instanceof Element)
    tab = tab.apiTab;
  let tabs = getAllTabs(tab.windowId);
  if (Array.isArray(options.ignoreTabs) &&
      options.ignoreTabs.length > 0)
    tabs = tabs.filter(tab => !options.ignoreTabs.includes(tab));

  return tabs.indexOf(tab);
}

export function calculateNewTabIndex(params) {
  if (params.insertBefore)
    return getTabIndex(params.insertBefore, params);
  if (params.insertAfter)
    return getTabIndex(params.insertAfter, params) + 1;
  return -1;
}


export function getNextNormalTab(tab) {
  if (!ensureLivingTab(tab))
    return null;
  assertValidTab(tab);
  return query({
    windowId: tab.windowId,
    fromId:   tab.id,
    normal:   true,
    index:    (index => index > tab.index)
  });
}

export function getPreviousNormalTab(tab) {
  if (!ensureLivingTab(tab))
    return null;
  assertValidTab(tab);
  return query({
    windowId: tab.windowId,
    fromId:   tab.id,
    normal:   true,
    index:    (index => index < tab.index),
    last:     true
  });
}


// tree basics

export function ensureLivingTab(tab) {
  if (!tab ||
      !tab.id ||
      !tab.$TST ||
      (mBindToElement &&
       (!tab.$TST.element ||
        !tab.$TST.element.parentNode)) ||
      !isTracked(tab.id) ||
      hasState(tab, Constants.kTAB_STATE_REMOVING))
    return null;
  return tab;
}

function assertInitializedTab(tab) {
  if (!tab ||
      tab.$TST && hasState(tab, Constants.kTAB_STATE_REMOVING))
    return false;
  if (tab instanceof Element && !tab.apiTab)
    throw new Error(`FATAL ERROR: the tab ${tab.id} is not initialized yet correctly! (no API tab information)\n${new Error().stack}`);
  if (!tab.$TST)
    throw new Error(`FATAL ERROR: the tab ${tab.id} is not initialized yet correctly! (no $TST helper)\n${new Error().stack}`);
  return true;
}

export function getOpenerTab(tab) {
  if (!tab)
    return null;
  if (!ensureLivingTab(tab) ||
      !tab ||
      !tab.openerTabId ||
      tab.openerTabId == tab.id)
    return null;
  assertValidTab(tab);
  const opener = query({
    windowId: tab.windowId,
    id:       tab.openerTabId,
    living:   true
  });
  return opener;
}

export function getParentTab(child) {
  if (!ensureLivingTab(child))
    return null;
  assertValidTab(child);
  return child.$TST.parent;
}

export function getAncestorTabs(descendant, options = {}) {
  if (!descendant || !ensureLivingTab(descendant))
    return [];
  assertValidTab(descendant);
  if (!options.force) {
    // slice(0) is required to guard the cached array from destructive methods liek sort()!
    return descendant.$TST.ancestors.slice(0);
  }
  const ancestors = [];
  while (true) {
    const parent = trackedTabs.get(descendant.$TST.parentId);
    if (!parent)
      break;
    ancestors.push(parent);
    descendant = parent;
  }
  return ancestors;
}

export function getVisibleAncestorOrSelf(descendant) {
  for (const ancestor of getAncestorTabs(descendant)) {
    if (!isCollapsed(ancestor))
      return ancestor;
  }
  assertValidTab(descendant);
  if (!isCollapsed(descendant))
    return descendant;
  return null;
}

export function getRootTab(descendant) {
  if (!ensureLivingTab(descendant))
    return null;
  assertValidTab(descendant);
  const ancestors = descendant.$TST.ancestors;
  return ancestors.length > 0 ? ancestors[ancestors.length-1] : descendant ;
}

export function getNextSiblingTab(tab) {
  if (!ensureLivingTab(tab))
    return null;
  assertValidTab(tab);
  const parent = tab.$TST.parent;
  if (parent) {
    const siblingIds = parent.$TST.childIds;
    const index = siblingIds.indexOf(tab.id);
    const siblingId = index < siblingIds.length - 1 ? siblingIds[index + 1] : null ;
    if (!siblingId)
      return null;
    return trackedTabs.get(siblingId);
  }
  else {
    return query({
      windowId:  tab.windowId,
      fromId:    tab.id,
      living:    true,
      index:     (index => index > tab.index),
      hasParent: false,
      first:     true
    });
  }
}

export function getPreviousSiblingTab(tab) {
  if (!ensureLivingTab(tab))
    return null;
  assertValidTab(tab);
  const parent = tab.$TST.parent;
  if (parent) {
    const siblingIds = parent.$TST.childIds;
    const index = siblingIds.indexOf(tab.id);
    const siblingId = index > 0 ? siblingIds[index - 1] : null ;
    if (!siblingId)
      return null;
    return trackedTabs.get(siblingId);
  }
  else {
    return query({
      windowId:  tab.windowId,
      fromId:    tab.id,
      living:    true,
      index:     (index => index < tab.index),
      hasParent: false,
      last:      true
    });
  }
}

export function getChildTabs(parent) {
  if (!ensureLivingTab(parent))
    return [];
  assertValidTab(parent);
  if (!assertInitializedTab(parent))
    return [];
  return parent.$TST.children;
}

export function getFirstChildTab(parent) {
  if (!ensureLivingTab(parent))
    return null;
  assertValidTab(parent);
  if (!assertInitializedTab(parent))
    return null;
  const children = parent.$TST.children;
  return children.length > 0 ? children[0] : null ;
}

export function getLastChildTab(parent) {
  if (!ensureLivingTab(parent))
    return null;
  assertValidTab(parent);
  if (!assertInitializedTab(parent))
    return null;
  const children = parent.$TST.children;
  return children.length > 0 ? children[children.length - 1] : null ;
}

export function getDescendantTabs(root) {
  if (!ensureLivingTab(root))
    return [];
  assertValidTab(root);
  if (!assertInitializedTab(root))
    return [];
  let descendants = [];
  const children = root.$TST.children;
  for (const child of children) {
    descendants.push(child);
    descendants = descendants.concat(getDescendantTabs(child));
  }
  return descendants;
}

export function getLastDescendantTab(root) {
  assertValidTab(root);
  const descendants = getDescendantTabs(root);
  return descendants.length ? descendants[descendants.length-1] : null ;
}


// grab tabs

export function getAllTabs(windowId = null) {
  return queryAll({
    windowId,
    living:   true,
    ordered:  true
  });
}

export function getTabs(windowId) { // only visible, including collapsed and pinned
  return queryAll({
    windowId,
    controllable: true,
    ordered:      true
  });
}

export function getNormalTabs(windowId) { // only visible, including collapsed, not pinned
  return queryAll({
    windowId,
    normal:   true,
    ordered:  true
  });
}

export function getVisibleTabs(windowId) { // visible, not-collapsed, not-hidden
  return queryAll({
    windowId,
    visible:  true,
    ordered:  true
  });
}

export function getPinnedTabs(windowId) { // visible, pinned
  return queryAll({
    windowId,
    pinned:   true,
    ordered:  true
  });
}


export function getUnpinnedTabs(windowId) { // visible, not pinned
  return queryAll({
    windowId,
    living:   true,
    pinned:   false,
    ordered:  true
  });
}

export function getRootTabs(windowId) {
  return queryAll({
    windowId,
    controllable: true,
    ordered:      true,
    hasParent:    false
  });
}

export function collectRootTabs(tabs) {
  return tabs.filter(tab => {
    if (!ensureLivingTab(tab))
      return false;
    const parent = tab.$TST.parent;
    return !parent || !tabs.includes(parent);
  });
}

export function getDraggingTabs(windowId) {
  return queryAll({
    windowId,
    living:   true,
    states:   [Constants.kTAB_STATE_DRAGGING, true],
    ordered:  true
  });
}

export function getRemovingTabs(windowId) {
  return queryAll({
    windowId,
    states:   [Constants.kTAB_STATE_REMOVING, true],
    ordered:  true
  });
}

export function getDuplicatingTabs(windowId) {
  return queryAll({
    windowId,
    living:   true,
    states:   [Constants.kTAB_STATE_DUPLICATING, true],
    ordered:  true
  });
}

export function getHighlightedTabs(windowId) {
  return queryAll({
    windowId,
    living:      true,
    highlighted: true,
    ordered:     true
  });
}

export function getSelectedTabs(windowId) {
  const selectedTabs = queryAll({
    windowId,
    living:   true,
    states:   [Constants.kTAB_STATE_SELECTED, true],
    ordered:  true
  });
  const highlightedTabs = highlightedTabsForWindow.get(windowId);
  if (!highlightedTabs ||
      highlightedTabs.size < 2)
    return selectedTabs;

  return sort(Array.from(new Set(...selectedTabs, ...highlightedTabs)));
}



// misc.

export function getFirstNormalTab(windowId) { // visible, not-collapsed, not-pinned
  return query({
    windowId,
    normal:   true,
    ordered:  true
  });
}

export function getFirstVisibleTab(windowId) { // visible, not-collapsed, not-hidden
  return query({
    windowId,
    visible:  true,
    ordered:  true
  });
}

export function getNextVisibleTab(tab) { // visible, not-collapsed
  if (!ensureLivingTab(tab))
    return null;
  assertValidTab(tab);
  return query({
    windowId: tab.windowId,
    fromId:   tab.id,
    visible:  true,
    index:    (index => index > tab.index)
  });
}

export function getPreviousVisibleTab(tab) { // visible, not-collapsed
  if (!ensureLivingTab(tab))
    return null;
  assertValidTab(tab);
  return query({
    windowId: tab.windowId,
    fromId:   tab.id,
    visible:  true,
    index:    (index => index < tab.index),
    last:     true
  });
}

export async function doAndGetNewTabs(asyncTask, windowId) {
  const tabsQueryOptions = {
    windowType: 'normal'
  };
  if (windowId) {
    tabsQueryOptions.windowId = windowId;
  }
  const beforeTabs = await browser.tabs.query(tabsQueryOptions);
  const beforeIds  = beforeTabs.map(tab => tab.id);
  await asyncTask();
  const afterTabs = await browser.tabs.query(tabsQueryOptions);
  const addedTabs = afterTabs.filter(afterTab => !beforeIds.includes(afterTab.id));
  return addedTabs.map(tab => trackedTabs.get(tab.id));
}

export function getNextActiveTab(tab, options = {}) { // if the current tab is closed...
  if (typeof options != 'object')
    options = {};
  assertValidTab(tab);
  const ignoredTabs = (options.ignoredTabs || []).slice(0);
  let foundTab = tab;
  do {
    ignoredTabs.push(foundTab);
    foundTab = getNextSiblingTab(foundTab);
  } while (foundTab && ignoredTabs.includes(foundTab));
  if (!foundTab) {
    foundTab = tab;
    do {
      ignoredTabs.push(foundTab);
      foundTab = getPreviousVisibleTab(foundTab);
    } while (foundTab && ignoredTabs.includes(foundTab));
  }
  return foundTab;
}


export function getGroupTabForOpener(opener) {
  if (!opener)
    return null;
  assertValidTab(opener);
  return query({
    windowId:   opener.windowId,
    living:     true,
    attributes: [
      Constants.kCURRENT_URI,
      new RegExp(`openerTabId=${opener.$TST.uniqueId.id}($|[#&])`)
    ]
  });
}

export function getOpenerFromGroupTab(groupTab) {
  if (!isGroupTab(groupTab))
    return null;
  assertValidTab(groupTab);
  const matchedOpenerTabId = groupTab.url.match(/openerTabId=([^&;]+)/);
  return matchedOpenerTabId && trackedTabs.get(matchedOpenerTabId[1]);
}




//===================================================================
// Tab Information
//===================================================================

export function isActive(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return !!(tab && tab.active);
}

export function isPinned(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return !!(tab && tab.pinned);
}

export function isAudible(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return !!(tab && tab.audible);
}

export function isSoundPlaying(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return !!(tab && tab.audible && !tab.mutedInfo.muted);
}

export function maybeSoundPlaying(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return (isSoundPlaying(tab) ||
          (hasState(tab, Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER) &&
           hasChildTabs(tab)));
}

export function isMuted(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return !!(tab && tab.mutedInfo && tab.mutedInfo.muted);
}

export function maybeMuted(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return (isMuted(tab) ||
          (hasState(tab, Constants.kTAB_STATE_HAS_MUTED_MEMBER) &&
           hasChildTabs(tab)));
}

export function isHidden(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return !!(tab && tab.hidden);
}

export function isCollapsed(tab) {
  return ensureLivingTab(tab) &&
         hasState(tab, Constants.kTAB_STATE_COLLAPSED);
}

export function isDiscarded(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return !!(tab && tab.discarded);
}

export function isPrivateBrowsing(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return !!(tab && tab.incognito);
}

export function isOpening(tab) {
  return ensureLivingTab(tab) &&
         hasState(tab, Constants.kTAB_STATE_OPENING);
}

export function isDuplicating(tab) {
  return ensureLivingTab(tab) &&
         hasState(tab, Constants.kTAB_STATE_DUPLICATING);
}

export function isNewTabCommandTab(tab) {
  if (!ensureLivingTab(tab) ||
      !configs.guessNewOrphanTabAsOpenedByNewTabCommand ||
      !assertInitializedTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return tab.url == configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl;
}

export function isSubtreeCollapsed(tab) {
  return ensureLivingTab(tab) &&
         hasState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
}

export function isGroupTab(tab) {
  if (!tab)
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  if (!assertInitializedTab(tab))
    return false;
  return hasState(tab, Constants.kTAB_STATE_GROUP_TAB) ||
         tab.url.indexOf(Constants.kGROUP_TAB_URI) == 0;
}

export function isTemporaryGroupTab(tab) {
  if (!isGroupTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return /[&?]temporary=true/.test(tab.url);
}

export function isSelected(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return hasState(tab, Constants.kTAB_STATE_SELECTED) ||
         (isMultihighlighted(tab) && !!(tab && tab.highlighted));
}

export function isHighlighted(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return !!(tab && tab.highlighted);
}

export function isMultiselected(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  return isSelected(tab) &&
           (isMultihighlighted(tab) ||
            queryAll({
              windowId: tab.windowId,
              living:   true,
              states:   [Constants.kTAB_STATE_SELECTED, true]
            }).length > 1);
}

export function isMultihighlighted(tab) {
  if (!ensureLivingTab(tab))
    return false;
  if (tab instanceof Element)
    tab = tab.apiTab;
  const highlightedTabs = highlightedTabsForWindow.get(tab.windowId);
  return !!(highlightedTabs && highlightedTabs.size > 1);
}

export function isLocked(_aTab) {
  return false;
}

export function hasChildTabs(parent) {
  if (!ensureLivingTab(parent))
    return false;
  return parent.$TST.hasChild;
}

export function getMaxTreeLevel(windowId, options = {}) {
  if (typeof options != 'object')
    options = {};
  const tabs = options.onlyVisible ?
    getVisibleTabs(windowId, { ordered: false }) :
    getTabs(windowId, { ordered: false }) ;
  let maxLevel = Math.max(...tabs.map(tab => parseInt(tab.$TST.attributes[Constants.kLEVEL] || 0)));
  if (configs.maxTreeLevel > -1)
    maxLevel = Math.min(maxLevel, configs.maxTreeLevel);
  return maxLevel;
}

// if all tabs are aldeardy placed at there, we don't need to move them.
export function isAllTabsPlacedBefore(tabs, nextTab) {
  if (tabs[tabs.length - 1] == nextTab)
    nextTab = getNextTab(nextTab);
  if (!nextTab && !getNextTab(tabs[tabs.length - 1]))
    return true;

  tabs = Array.from(tabs);
  let previousTab = tabs.shift();
  for (const tab of tabs) {
    if (getPreviousTab(tab) != previousTab)
      return false;
    previousTab = tab;
  }
  return !nextTab ||
         !previousTab ||
         getNextTab(previousTab) == nextTab;
}

export function isAllTabsPlacedAfter(tabs, previousTab) {
  if (tabs[0] == previousTab)
    previousTab = getPreviousTab(previousTab);
  if (!previousTab && !getPreviousTab(tabs[0]))
    return true;

  tabs = Array.from(tabs).reverse();
  let nextTab = tabs.shift();
  for (const tab of tabs) {
    if (getNextTab(tab) != nextTab)
      return false;
    nextTab = tab;
  }
  return !previousTab ||
         !nextTab ||
         getPreviousTab(nextTab) == previousTab;
}


export function dumpAllTabs() {
  if (!configs.debug)
    return;
  log('dumpAllTabs\n' +
    getAllTabs(mTargetWindow).map(tab =>
      getAncestorTabs(tab).reverse().concat([tab])
        .map(tab => tab.id + (isPinned(tab) ? ' [pinned]' : ''))
        .join(' => ')
    ).join('\n'));
}


//===================================================================
// Promised status of tabs
//===================================================================

const mOpenedResolvers            = new Map();
const mClosedWhileActiveResolvers = new Map();

export function initPromisedStatus(tab, alreadyOpened = false) {
  if (alreadyOpened)
    tab.$TST.opened = Promise.resolve(true);
  else
    tab.$TST.opened = new Promise((resolve, _reject) => {
      mOpenedResolvers.set(tab.id, resolve);
    });

  tab.$TST.closedWhileActive = new Promise((resolve, _reject) => {
    mClosedWhileActiveResolvers.set(tab.id, resolve);
  });
}

export function resolveOpened(tab) {
  if (!mOpenedResolvers.has(tab.id))
    return;
  mOpenedResolvers.get(tab.id)();
  mOpenedResolvers.delete(tab.id);
}

export function fetchClosedWhileActiveResolver(tab) {
  const resolver = mClosedWhileActiveResolvers.get(tab.id);
  mClosedWhileActiveResolvers.delete(tab.id);
  return resolver;
}


//===================================================================
// Tab State
//===================================================================

export async function addState(tab, state, options = {}) {
  assertValidTab(tab);
  if (tab.$TST.element)
    tab.$TST.element.classList.add(state);
  if (tab.$TST.states)
    tab.$TST.states[state] = true;
  if (options.broadcast)
    broadcastState(tab, {
      add: [state]
    });
  if (options.permanently) {
    const states = await getPermanentStates(tab);
    if (!states.includes(state)) {
      states.push(state);
      await browser.sessions.setTabValue(tab.id, Constants.kPERSISTENT_STATES, states);
    }
  }
}

export async function removeState(tab, state, options = {}) {
  assertValidTab(tab);
  if (tab.$TST.element)
    tab.$TST.element.classList.remove(state);
  if (tab.$TST.states)
    delete tab.$TST.states[state];
  if (options.broadcast)
    broadcastState(tab, {
      remove: [state]
    });
  if (options.permanently) {
    const states = await getPermanentStates(tab);
    const index = states.indexOf(state);
    if (index > -1) {
      states.splice(index, 1);
      await browser.sessions.setTabValue(tab.id, Constants.kPERSISTENT_STATES, states);
    }
  }
}

export function hasState(tab, state) {
  if (!tab || !tab.$TST)
    return false;
  return tab && state in tab.$TST.states;
}

export function getStates(tab) {
  assertValidTab(tab);
  return tab && tab.$TST.states ? Object.keys(tab.$TST.states) : [];
}

export function broadcastState(tabs, options = {}) {
  if (!Array.isArray(tabs))
    tabs = [tabs];
  browser.runtime.sendMessage({
    type:    Constants.kCOMMAND_BROADCAST_TAB_STATE,
    tabIds:  tabs.map(tab => tab.id),
    add:     options.add || [],
    remove:  options.remove || [],
    bubbles: !!options.bubbles
  });
}

export async function getPermanentStates(tab) {
  if (!tab || !tab.$TST)
    return [];
  assertValidTab(tab);
  const states = await browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_STATES);
  return states || [];
}


export function setAttribute(tab, attribute, value) {
  if (!tab || !tab.$TST)
    return;
  assertValidTab(tab);
  if (tab.$TST.element)
    tab.$TST.element.setAttribute(attribute, value);
  tab.$TST.attributes[attribute] = value;
}

export function getAttribute(tab, attribute) {
  if (!tab || !tab.$TST)
    return null;
  assertValidTab(tab);
  return tab.$TST.attributes[attribute];
}

export function removeAttribute(tab, attribute) {
  if (!tab || !tab.$TST)
    return false;
  assertValidTab(tab);
  if (tab.$TST.element)
    tab.$TST.element.removeAttribute(attribute);
  delete tab.$TST.attributes[attribute];
}



//===================================================================
// Take snapshot
//===================================================================

export function snapshotTreeForActionDetection(targetTab) {
  const prevTab = getPreviousNormalTab(targetTab);
  const nextTab = getNextNormalTab(targetTab);
  const foundTabs = {};
  const tabs = getAncestorTabs(prevTab)
    .concat([prevTab, targetTab, nextTab, getParentTab(targetTab)])
    .filter(tab => ensureLivingTab(tab) && !foundTabs[tab.id] && (foundTabs[tab.id] = true)) // uniq
    .sort((a, b) => a.index - b.index);
  return snapshotTree(targetTab, tabs);
}

function snapshotTree(targetTab, tabs) {
  const allTabs = tabs || getTabs(targetTab.windowId);

  const snapshotById = {};
  function snapshotChild(tab) {
    if (!ensureLivingTab(tab) || isPinned(tab) || isHidden(tab))
      return null;
    return snapshotById[tab.id] = {
      id:            tab.id,
      url:           tab.url,
      cookieStoreId: tab.cookieStoreId,
      active:        isActive(tab),
      children:      getChildTabs(tab).filter(child => !isHidden(child)).map(child => child.id),
      collapsed:     isSubtreeCollapsed(tab),
      pinned:        isPinned(tab),
      level:         parseInt(getAttribute(tab, Constants.kLEVEL) || 0)
    };
  }
  const snapshotArray = allTabs.map(tab => snapshotChild(tab));
  for (const tab of allTabs) {
    const item = snapshotById[tab.id];
    if (!item)
      continue;
    const parent = getParentTab(tab);
    item.parent = parent && parent.id;
    const next = getNextNormalTab(tab);
    item.next = next && next.id;
    const previous = getPreviousNormalTab(tab);
    item.previous = previous && previous.id;
  }
  const activeTab = getActiveTab(targetTab.windowId);
  return {
    target:   snapshotById[targetTab.id],
    active:   activeTab && snapshotById[activeTab.id],
    tabs:     snapshotArray,
    tabsById: snapshotById
  };
}
