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

import Window from './Window.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/Tab', ...args);
}

export default class Tab {
  constructor(tab) {
    const alreadyTracked = Tab.get(tab.id);
    if (alreadyTracked)
      return alreadyTracked.$TST;

    log(`tab ${tab.id} is newly tracked: `, tab);

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
      this.promisedUniqueId = Tabs.updateUniqueId(tab);
    else
      this.promisedUniqueId = Promise.resolve(this.uniqueId);

    Tabs.trackedTabs.set(tab.id, tab);

    const window = Tabs.trackedWindows.get(tab.windowId) || new Window(tab.windowId);
    window.trackTab(tab);

    this.promisedUniqueId.then(() => {
      Tab.onTracked.dispatch(tab);
    });
  }

  destroy() {
    this.detach();

    if (this.reservedCleanupNeedlessGroupTab) {
      clearTimeout(this.reservedCleanupNeedlessGroupTab);
      delete this.reservedCleanupNeedlessGroupTab;
    }

    Tabs.trackedTabs.delete(this.id);
    if (this.uniqueId)
      Tabs.trackedTabsByUniqueId.delete(this.uniqueId.id)

    const highlightedTabs = Tabs.highlightedTabsForWindow.get(this.tab.windowId);
    if (highlightedTabs.has(this.tab))
      highlightedTabs.delete(this.tab);

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
    return this.parentId && Tabs.ensureLivingTab(Tab.get(this.parentId));
  }

  get hasParent() {
    return !!this.parentId;
  }

  set ancestors(tabs) {
    this.ancestorIds = tabs.map(tab => typeof tab == 'number' ? tab : tab && tab.id).filter(id => id);
    return tabs;
  }
  get ancestors() {
    return this.ancestorIds.map(id => Tab.get(id)).filter(Tabs.ensureLivingTab);
  }

  set children(tabs) {
    this.childIds = tabs.map(tab => typeof tab == 'number' ? tab : tab && tab.id).filter(id => id);
    return tabs;
  }
  get children() {
    return this.childIds.map(id => Tab.get(id)).filter(Tabs.ensureLivingTab);
  }

  get hasChild() {
    return this.childIds.length > 0;
  }

  sortChildren() {
    this.childIds = Tabs.sort(this.childIds.map(id => Tab.get(id))).map(tab => tab.id);
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

Tab.onTracked = new EventListenerManager();
Tab.onInitialized   = new EventListenerManager();

Tab.track = tab => {
  const trackedTab = Tab.get(tab.id);
  if (!trackedTab) {
    tab.$TST = new Tab(tab);
  }
  else {
    const window = Tabs.trackedWindows.get(tab.windowId);
    window.trackTab(tab);
  }
};

Tab.untrack = tabId => {
  const tab    = Tab.get(tabId);
  const window = Tabs.trackedWindows.get(tab.windowId);
  if (window)
    window.untrackTab(tabId);
};

Tab.isTracked = tabId =>  {
  return Tabs.trackedTabs.has(tabId);
};

Tab.get = tabId =>  {
  return Tabs.trackedTabs.get(tabId);
};

Tab.waitUntilTracked = async tabId => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      // eslint-disable-next-line no-use-before-define
      Tab.onTabTracked.removeListener(listener);
      reject(new Error(`Tab.waitUntilTracked for ${tabId} is timed out`));
    }, 2000);
    const listener = (tab) => {
      if (tab.id != tabId)
        return;
      Tab.onTabTracked.removeListener(listener);
      clearTimeout(timeout);
      resolve(tab);
    };
    Tab.onTabTracked.addListener(listener);
  });
}

Tab.init = (tab, options = {}) => {
  log('initalize tab ', tab);
  const trackedTab = Tab.get(tab.id);
  if (trackedTab)
    tab = trackedTab;
  tab.$TST = (trackedTab && trackedTab.$TST) || new Tab(tab);

  if (tab.active)
    Tabs.addState(tab, Constants.kTAB_STATE_ACTIVE);
  Tabs.addState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);

  Tab.onInitialized.dispatch(tab, options);

  if (options.existing)
    Tabs.addState(tab, Constants.kTAB_STATE_ANIMATION_READY);

  Tabs.initPromisedStatus(tab);

  return tab;
}
