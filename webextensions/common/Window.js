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

import * as TabsStore from './tabs-store.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/Window', ...args);
}

export default class Window {
  constructor(windowId) {
    const alreadyTracked = TabsStore.windows.get(windowId);
    if (alreadyTracked)
      return alreadyTracked;

    log(`window ${windowId} is newly tracked`);

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

    TabsStore.windows.set(windowId, this);
    TabsStore.activeTabsForWindow.set(windowId, new Set());
    TabsStore.highlightedTabsForWindow.set(windowId, new Set());
    TabsStore.groupTabsForWindow.set(windowId, new Set());
  }

  destroy() {
    for (const tab of this.tabs.values()) {
      if (tab.$TST)
        tab.$TST.destroy();
    }
    this.tabs.clear();
    TabsStore.windows.delete(this.id, this);
    TabsStore.activeTabForWindow.delete(this.id);
    TabsStore.activeTabsForWindow.delete(this.id);
    TabsStore.highlightedTabsForWindow.delete(this.id);
    TabsStore.groupTabsForWindow.delete(this.id);

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
    const orderedIds = this.sliceOrder(startId, endId, this.orderedIds);
    return (function*() {
      for (const id of orderedIds) {
        yield this.tabs.get(id);
      }
    }).call(this);
  }

  getReversedOrderedTabs(startId, endId) {
    const orderedIds = this.sliceOrder(startId, endId, this.order.slice(0).reverse());
    return (function*() {
      for (const id of orderedIds) {
        yield this.tabs.get(id);
      }
    }).call(this);
  }

  sliceOrder(startId, endId, orderedIds) {
    if (!orderedIds)
      orderedIds = this.order;
    if (startId) {
      if (!this.tabs.has(startId))
        return [];
      orderedIds = orderedIds.slice(orderedIds.indexOf(startId));
    }
    if (endId) {
      if (!this.tabs.has(startId))
        return [];
      orderedIds = orderedIds.slice(0, orderedIds.indexOf(endId) + 1);
    }
    return orderedIds;
  }

  trackTab(tab) {
    const alreadyTracked = TabsStore.tabs.get(tab.id);
    if (alreadyTracked)
      tab = alreadyTracked;

    const order = this.order;
    if (this.tabs.has(tab.id)) { // already tracked: update
      const index = order.indexOf(tab.id);
      order.splice(index, 1);
      order.splice(tab.index, 0, tab.id);
      for (let i = Math.min(index, tab.index), maxi = Math.min(Math.max(index + 1, tab.index + 1), order.length); i < maxi; i++) {
        const tab = this.tabs.get(order[i]);
        if (!tab)
          throw new Error(`Unknown tab: ${i}/${order[i]} (${order.join(', ')})`);
        tab.index = i;
      }
      const parent = tab.$TST.parent;
      if (parent) {
        parent.$TST.sortChildren();
        parent.$TST.invalidateCachedAncestors();
      }
      if (tab.highlighted)
        TabsStore.addHighlightedTab(tab);
      if (tab.$TST.isGroupTab)
        TabsStore.addGroupTab(tab);
      log(`tab ${dumpTab(tab)} is re-tracked under the window ${this.id}: `, order);
    }
    else { // not tracked yet: add
      this.tabs.set(tab.id, tab);
      order.splice(tab.index, 0, tab.id);
      for (let i = tab.index + 1, maxi = order.length; i < maxi; i++) {
        const tab = this.tabs.get(order[i]);
        if (!tab)
          throw new Error(`Unknown tab: ${i}/${order[i]} (${order.join(', ')})`);
        tab.index = i;
      }
      log(`tab ${dumpTab(tab)} is newly tracked under the window ${this.id}: `, order);
    }
    return tab;
  }

  detachTab(tabId) {
    const tab = TabsStore.tabs.get(tabId);
    if (!tab)
      return;

    TabsStore.removeHighlightedTab(tab);
    TabsStore.removeGroupTab(tab);

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

Window.onInitialized = new EventListenerManager();

Window.init = windowId => {
  const window = TabsStore.windows.get(windowId) || new Window(windowId);
  Window.onInitialized.dispatch(windowId);
  return window;
}
