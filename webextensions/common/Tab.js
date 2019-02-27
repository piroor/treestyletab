/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
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

  get next() {
    return Tabs.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      living:   true,
      index:    (index => index > this.tab.index)
    });
  }

  get previous() {
    return Tabs.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      living:   true,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get anyNext() {
    return Tabs.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      index:    (index => index > this.tab.index)
    });
  }

  get anyPrevious() {
    return Tabs.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get nearestNormalFollowing() {
    return Tabs.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      normal:   true,
      index:    (index => index > this.tab.index)
    });
  }

  get nearestNormalPreceding() {
    return Tabs.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      normal:   true,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get nearestVisibleFollowing() { // visible, not-collapsed
    return Tabs.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      visible:  true,
      index:    (index => index > this.tab.index)
    });
  }

  get nearestVisiblePreceding() { // visible, not-collapsed
    return Tabs.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      visible:  true,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get precedesPinned() {
    const following = this.nearestVisibleFollowing;
    return following && following.pinned;
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

  get root() {
    const ancestors = this.ancestors;
    return ancestors.length > 0 ? ancestors[ancestors.length-1] : this.tab ;
  }

  get nearestFollowingRoot() {
    const root = this.root;
    return root && root.$TST.nextSibling;
  }

  get nearestFollowingForeigner() {
    const base = this.lastDescendant || this.tab;
    return base && base.$TST.next;
  }

  set children(tabs) {
    this.childIds = tabs.map(tab => typeof tab == 'number' ? tab : tab && tab.id).filter(id => id);
    return tabs;
  }
  get children() {
    return this.childIds.map(id => Tab.get(id)).filter(Tabs.ensureLivingTab);
  }

  get firstChild() {
    const children = this.children;
    return children.length > 0 ? children[0] : null ;
  }

  get lastChild() {
    const children = this.children;
    return children.length > 0 ? children[children.length - 1] : null ;
  }

  get hasChild() {
    return this.childIds.length > 0;
  }

  get descendants() {
    let descendants = [];
    const children = this.children;
    for (const child of children) {
      descendants.push(child);
      descendants = descendants.concat(child.$TST.descendants);
    }
    return descendants;
  }

  get lastDescendant() {
    const descendants = this.descendants;
    return descendants.length ? descendants[descendants.length-1] : null ;
  }

  sortChildren() {
    this.childIds = Tabs.sort(this.childIds.map(id => Tab.get(id))).map(tab => tab.id);
  }

  get nextSibling() {
    const parent = this.parent;
    if (parent) {
      const siblingIds = parent.$TST.childIds;
      const index = siblingIds.indexOf(this.tab.id);
      const siblingId = index < siblingIds.length - 1 ? siblingIds[index + 1] : null ;
      if (!siblingId)
        return null;
      return Tab.get(siblingId);
    }
    else {
      return Tabs.query({
        windowId:  this.tab.windowId,
        fromId:    this.tab.id,
        living:    true,
        index:     (index => index > this.tab.index),
        hasParent: false,
        first:     true
      });
    }
  }

  get previousSibling() {
    const parent = this.parent;
    if (parent) {
      const siblingIds = parent.$TST.childIds;
      const index = siblingIds.indexOf(this.tab.id);
      const siblingId = index > 0 ? siblingIds[index - 1] : null ;
      if (!siblingId)
        return null;
      return Tab.get(siblingId);
    }
    else {
      return Tabs.query({
        windowId:  this.tab.windowId,
        fromId:    this.tab.id,
        living:    true,
        index:     (index => index < this.tab.index),
        hasParent: false,
        last:      true
      });
    }
  }

  get opener() {
    if (!this.tab.openerTabId ||
        this.tab.openerTabId == this.tab.id)
      return null;
    return Tabs.query({
      windowId: this.tab.windowId,
      id:       this.tab.openerTabId,
      living:   true
    });
  }

  get hasPinnedOpener() {
    const opener = this.opener;
    return opener && opener.pinned;
  }

  findSuccessor(tab, options = {}) {
    if (typeof options != 'object')
      options = {};
    const ignoredTabs = (options.ignoredTabs || []).slice(0);
    let foundTab = tab;
    do {
      ignoredTabs.push(foundTab);
      foundTab = foundTab.$TST.next;
    } while (foundTab && ignoredTabs.includes(foundTab));
    if (!foundTab) {
      foundTab = tab;
      do {
        ignoredTabs.push(foundTab);
        foundTab = foundTab.$TST.nearestVisiblePreceding;
      } while (foundTab && ignoredTabs.includes(foundTab));
    }
    return foundTab;
  }

  // if all tabs are aldeardy placed at there, we don't need to move them.
  isAllPlacedBeforeSelf(tabs) {
    let nextTab = this.tab;
    if (tabs[tabs.length - 1] == nextTab)
      nextTab = nextTab.$TST.next;
    if (!nextTab && !tabs[tabs.length - 1].$TST.next)
      return true;

    tabs = Array.from(tabs);
    let previousTab = tabs.shift();
    for (const tab of tabs) {
      if (tab.$TST.previous != previousTab)
        return false;
      previousTab = tab;
    }
    return !nextTab ||
           !previousTab ||
           previousTab.$TST.next == nextTab;
  }

  isAllPlacedAfterSelf(tabs) {
    let previousTab = this.tab;
    if (tabs[0] == previousTab)
      previousTab = previousTab.$TST.previous;
    if (!previousTab && !tabs[0].$TST.previous)
      return true;

    tabs = Array.from(tabs).reverse();
    let nextTab = tabs.shift();
    for (const tab of tabs) {
      if (tab.$TST.next != nextTab)
        return false;
      nextTab = tab;
    }
    return !previousTab ||
           !nextTab ||
           nextTab.$TST.previous == previousTab;
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


Tab.getGroupTabForOpener = opener => {
  if (!opener)
    return null;
  Tabs.assertValidTab(opener);
  return Tabs.query({
    windowId:   opener.windowId,
    living:     true,
    attributes: [
      Constants.kCURRENT_URI,
      new RegExp(`openerTabId=${opener.$TST.uniqueId.id}($|[#&])`)
    ]
  });
}

Tab.getOpenerFromGroupTab = groupTab => {
  if (!Tabs.isGroupTab(groupTab))
    return null;
  Tabs.assertValidTab(groupTab);
  const matchedOpenerTabId = groupTab.url.match(/openerTabId=([^&;]+)/);
  return matchedOpenerTabId && Tab.get(matchedOpenerTabId[1]);
}


Tab.getAncestors = (descendant, options = {}) => {
  if (!descendant || !Tabs.ensureLivingTab(descendant))
    return [];
  Tabs.assertValidTab(descendant);
  if (!options.force) {
    // slice(0) is required to guard the cached array from destructive methods liek sort()!
    return descendant.$TST.ancestors.slice(0);
  }
  const ancestors = [];
  while (true) {
    const parent = Tab.get(descendant.$TST.parentId);
    if (!parent)
      break;
    ancestors.push(parent);
    descendant = parent;
  }
  return ancestors;
}

Tab.getVisibleAncestorOrSelf = descendant => {
  if (!Tabs.ensureLivingTab(descendant))
    return null;
  for (const ancestor of descendant.$TST.ancestors) {
    if (!Tabs.isCollapsed(ancestor))
      return ancestor;
  }
  Tabs.assertValidTab(descendant);
  if (!Tabs.isCollapsed(descendant))
    return descendant;
  return null;
}


Tab.dumpAll = (windowId) => {
  if (!configs.debug)
    return;
  log('dumpAllTabs\n' +
    Tabs.getAllTabs(windowId).map(tab =>
      Tab.getAncestors(tab).reverse().concat([tab])
        .map(tab => tab.id + (tab.pinned ? ' [pinned]' : ''))
        .join(' => ')
    ).join('\n'));
}

