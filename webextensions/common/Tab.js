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
import * as UniqueId from './unique-id.js';

import Window from './Window.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/Tab', ...args);
}

const mOpenedResolvers            = new Map();
const mClosedWhileActiveResolvers = new Map();

const mIncompletelyTrackedTabs = new Map();
const mMovingTabs              = new Map();

browser.windows.onRemoved.addListener(windowId => {
  mIncompletelyTrackedTabs.delete(windowId);
  mMovingTabs.delete(windowId);
});

export default class Tab {
  constructor(tab) {
    const alreadyTracked = Tab.get(tab.id);
    if (alreadyTracked)
      return alreadyTracked.$TST;

    log(`tab ${dumpTab(tab)} is newly tracked: `, tab);

    tab.$TST = this;
    this.tab = tab;
    this.id  = tab.id;

    this.element = null;
    this.promisedElement = new Promise((resolve, _reject) => {
      this._promisedElementResolver = resolve;
    });

    this.states = new Set();
    this.clear();

    this.uniqueId = {
      id:            null,
      originalId:    null,
      originalTabId: null
    };
    if (tab.id)
      this.promisedUniqueId = this.updateUniqueId();
    else
      this.promisedUniqueId = Promise.resolve(this.uniqueId);

    TabsStore.tabs.set(tab.id, tab);

    const window = TabsStore.windows.get(tab.windowId) || new Window(tab.windowId);
    window.trackTab(tab);

    if (tab.active) {
      TabsStore.activeTabForWindow.set(tab.windowId, tab);
      TabsStore.activeTabsForWindow.get(tab.windowId).add(tab);
    }
    else {
      TabsStore.activeTabsForWindow.get(tab.windowId).delete(tab);
    }

    const incompletelyTrackedTabsPerWindow = mIncompletelyTrackedTabs.get(tab.windowId) || new Set();
    incompletelyTrackedTabsPerWindow.add(tab);
    mIncompletelyTrackedTabs.set(tab.windowId, incompletelyTrackedTabsPerWindow);
    this.promisedUniqueId.then(() => {
      incompletelyTrackedTabsPerWindow.delete(tab);
      Tab.onTracked.dispatch(tab);
    });
  }

  destroy() {
    this.detach();

    if (this.reservedCleanupNeedlessGroupTab) {
      clearTimeout(this.reservedCleanupNeedlessGroupTab);
      delete this.reservedCleanupNeedlessGroupTab;
    }

    TabsStore.tabs.delete(this.id);
    if (this.uniqueId)
      TabsStore.tabsByUniqueId.delete(this.uniqueId.id)

    const highlightedTabs = TabsStore.highlightedTabsForWindow.get(this.tab.windowId);
    highlightedTabs.delete(this.tab);

    if (this.element) {
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      delete this.element.$TST;
      delete this.element.apiTab;
      delete this.element;
    }
    delete this;
    delete this.tab;
    delete this.promisedUniqueId;
    delete this.uniqueId;
  }

  clear() {
    this.states.clear();
    this.attributes = {};

    this.parentId = null;
    this.childIds = [];
    this.cachedAncestorIds   = null;
    this.cachedDescendantIds = null;
  }

  bindElement(element) {
    this.element = element;
    setTimeout(() => { // wait until initialization processes are completed
      this._promisedElementResolver(element);
      if (!element) { // reset for the next binding
        this.promisedElement = new Promise((resolve, _reject) => {
          this._promisedElementResolver = resolve;
        });
      }
      Tab.onElementBound.dispatch(this.tab);
    }, 0);
  }

  startMoving() {
    let onTabMoved;
    const promisedMoved = new Promise((resolve, _reject) => {
      onTabMoved = resolve;
    });
    const movingTabs = mMovingTabs.get(this.tab.windowId) || new Set();
    movingTabs.add(promisedMoved);
    mMovingTabs.set(this.tab.windowId, movingTabs);
    promisedMoved.then(() => {
      movingTabs.delete(promisedMoved);
    });
    return onTabMoved;
  }

  updateUniqueId(options = {}) {
    return UniqueId.request(this.tab, options).then(uniqueId => {
      if (uniqueId && TabsStore.ensureLivingTab(this.tab)) { // possibly removed from document while waiting
        this.uniqueId = uniqueId;
        TabsStore.tabsByUniqueId.set(uniqueId.id, this.tab);
        this.setAttribute(Constants.kPERSISTENT_ID, uniqueId.id);
      }
      return uniqueId || {};
    }).catch(error => {
      console.log(`FATAL ERROR: Failed to get unique id for a tab ${dumpTab(this.tab)}: `, error);
      return {};
    });
  }


  //===================================================================
  // status of tab
  //===================================================================

  get soundPlaying() {
    return !!(this.tab.audible && !this.tab.mutedInfo.muted);
  }

  get maybeSoundPlaying() {
    return (this.soundPlaying ||
            (this.states.has(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER) &&
             this.hasChild));
  }

  get muted() {
    return !!(this.tab.mutedInfo && this.tab.mutedInfo.muted);
  }

  get maybeMuted() {
    return (this.muted ||
            (this.states.has(Constants.kTAB_STATE_HAS_MUTED_MEMBER) &&
             this.hasChild));
  }

  get collapsed() {
    return this.states.has(Constants.kTAB_STATE_COLLAPSED);
  }

  get subtreeCollapsed() {
    return this.states.has(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  }

  get precedesPinned() {
    const following = this.nearestVisibleFollowing;
    return following && following.pinned;
  }

  get duplicating() {
    return this.states.has(Constants.kTAB_STATE_DUPLICATING);
  }

  get isNewTabCommandTab() {
    if (!configs.guessNewOrphanTabAsOpenedByNewTabCommand)
      return false;
    return this.tab.url == configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl;
  }

  get isGroupTab() {
    return this.states.has(Constants.kTAB_STATE_GROUP_TAB) ||
           this.tab.url.indexOf(Constants.kGROUP_TAB_URI) == 0;
  }

  get isTemporaryGroupTab() {
    if (!this.isGroupTab)
      return false;
    return /[&?]temporary=true/.test(this.tab.url);
  }

  get selected() {
    return this.states.has(Constants.kTAB_STATE_SELECTED) ||
             (this.hasOtherHighlighted && !!(this.tab && this.tab.highlighted));
  }

  get multiselected() {
    return this.selected &&
             (this.hasOtherHighlighted ||
              TabsStore.queryAll({
                windowId: this.tab.windowId,
                living:   true,
                states:   [Constants.kTAB_STATE_SELECTED, true]
              }).length > 1);
  }

  get hasOtherHighlighted() {
    const highlightedTabs = TabsStore.highlightedTabsForWindow.get(this.tab.windowId);
    return !!(highlightedTabs && highlightedTabs.size > 1);
  }

  //===================================================================
  // neighbor tabs
  //===================================================================

  get next() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      living:   true,
      index:    (index => index > this.tab.index)
    });
  }

  get previous() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      living:   true,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get anyNext() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      index:    (index => index > this.tab.index)
    });
  }

  get anyPrevious() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get nearestNormalFollowing() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      normal:   true,
      index:    (index => index > this.tab.index)
    });
  }

  get nearestNormalPreceding() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      normal:   true,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get nearestVisibleFollowing() { // visible, not-collapsed
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      visible:  true,
      index:    (index => index > this.tab.index)
    });
  }

  get nearestVisiblePreceding() { // visible, not-collapsed
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      visible:  true,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  //===================================================================
  // tree relations
  //===================================================================

  set parent(tab) {
    const oldParent = this.parent;
    this.parentId = tab && (typeof tab == 'number' ? tab : tab.id);
    this.invalidateCachedAncestors();
    const parent = this.parent;
    if (parent) {
      this.setAttribute(Constants.kPARENT, parent.id);
      parent.$TST.invalidateCachedDescendants();
      parent.$TST.inheritSoundStateFromChildren();
    }
    else {
      this.removeAttribute(Constants.kPARENT);
    }
    if (oldParent)
      oldParent.$TST.invalidateCachedDescendants();
    return tab;
  }
  get parent() {
    return this.parentId && TabsStore.ensureLivingTab(Tab.get(this.parentId));
  }

  get hasParent() {
    return !!this.parentId;
  }

  get ancestors() {
    if (!this.cachedAncestorIds)
      return this.updateAncestors();
    return this.cachedAncestorIds.map(id => Tab.get(id)).filter(TabsStore.ensureLivingTab);
  }

  updateAncestors() {
    const ancestors = [];
    this.cachedAncestorIds = [];
    let descendant = this.tab;
    while (true) {
      const parent = Tab.get(descendant.$TST.parentId);
      if (!parent)
        break;
      ancestors.push(parent);
      this.cachedAncestorIds.push(parent.id);
      descendant = parent;
    }
    return ancestors;
  }

  invalidateCachedAncestors() {
    this.cachedAncestorIds = null;
    for (const child of this.children) {
      child.$TST.invalidateCachedAncestors();
    }
  }

  get root() {
    const ancestors = this.ancestors;
    return ancestors.length > 0 ? ancestors[ancestors.length-1] : this.tab ;
  }

  get nearestVisibleAncestorOrSelf() {
    for (const ancestor of this.ancestors) {
      if (!ancestor.$TST.collapsed)
        return ancestor;
    }
    if (!this.collapsed)
      return this;
    return null;
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
    const oldChildren = this.children;
    this.childIds = tabs.map(tab => typeof tab == 'number' ? tab : tab && tab.id).filter(id => id);
    this.sortChildren();
    if (this.childIds.length > 0)
      this.setAttribute(Constants.kCHILDREN, `|${this.childIds.join('|')}|`);
    else
      this.removeAttribute(Constants.kCHILDREN);
    for (const child of Array.from(new Set(this.children.concat(oldChildren)))) {
      child.$TST.invalidateCachedAncestors();
    }
    return tabs;
  }
  get children() {
    return this.childIds.map(id => Tab.get(id)).filter(TabsStore.ensureLivingTab);
  }

  get firstChild() {
    const children = this.children;
    return children.length > 0 ? children[0] : null ;
  }

  get lastChild() {
    const children = this.children;
    return children.length > 0 ? children[children.length - 1] : null ;
  }

  sortChildren() {
    this.childIds = Tab.sort(this.childIds.map(id => Tab.get(id))).map(tab => tab.id);
    this.invalidateCachedDescendants();
  }

  get hasChild() {
    return this.childIds.length > 0;
  }

  get descendants() {
    if (!this.cachedDescendantIds)
      return this.updateDescendants();
    return this.cachedDescendantIds.map(id => Tab.get(id)).filter(TabsStore.ensureLivingTab);
  }

  updateDescendants() {
    let descendants = [];
    this.cachedDescendantIds = [];
    for (const child of this.children) {
      descendants.push(child);
      descendants = descendants.concat(child.$TST.descendants);
      this.cachedDescendantIds.push(child.id);
      this.cachedDescendantIds = this.cachedDescendantIds.concat(child.$TST.cachedDescendantIds);
    }
    return descendants;
  }

  invalidateCachedDescendants() {
    this.cachedDescendantIds = null;
    const parent = this.parent;
    if (parent)
      parent.$TST.invalidateCachedDescendants();
  }

  get lastDescendant() {
    const descendants = this.descendants;
    return descendants.length ? descendants[descendants.length-1] : null ;
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
      return TabsStore.query({
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
      return TabsStore.query({
        windowId:  this.tab.windowId,
        fromId:    this.tab.id,
        living:    true,
        index:     (index => index < this.tab.index),
        hasParent: false,
        last:      true
      });
    }
  }

  //===================================================================
  // other relations
  //===================================================================

  get opener() {
    if (!this.tab.openerTabId ||
        this.tab.openerTabId == this.tab.id)
      return null;
    return TabsStore.query({
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
    if (tabs.length == 0)
      return true;
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
    if (tabs.length == 0)
      return true;
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
    this.parent   = null;
    this.children = [];
  }


  //===================================================================
  // State
  //===================================================================

  async addState(state, options = {}) {
    if (this.element)
      this.element.classList.add(state);
    if (this.states)
      this.states.add(state);
    if (options.broadcast)
      Tab.broadcastState(this.tab, {
        add: [state]
      });
    if (options.permanently) {
      const states = await this.getPermanentStates();
      if (!states.includes(state)) {
        states.push(state);
        await browser.sessions.setTabValue(this.tab.id, Constants.kPERSISTENT_STATES, states).catch(ApiTabs.createErrorSuppressor());
      }
    }
  }

  async removeState(state, options = {}) {
    if (this.element)
      this.element.classList.remove(state);
    if (this.states)
      this.states.delete(state);
    if (options.broadcast)
      Tab.broadcastState(this.tab, {
        remove: [state]
      });
    if (options.permanently) {
      const states = await this.getPermanentStates();
      const index = states.indexOf(state);
      if (index > -1) {
        states.splice(index, 1);
        await browser.sessions.setTabValue(this.tab.id, Constants.kPERSISTENT_STATES, states).catch(ApiTabs.createErrorSuppressor());
      }
    }
  }

  async getPermanentStates() {
    const states = await browser.sessions.getTabValue(this.tab.id, Constants.kPERSISTENT_STATES).catch(ApiTabs.createErrorHandler());
    return states || [];
  }

  inheritSoundStateFromChildren() {
    const children = this.children;

    if (children.some(child => child.maybeSoundPlaying))
      this.addState(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
    else
      this.removeState(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);

    if (children.some(child => child.maybeMuted))
      this.addState(Constants.kTAB_STATE_HAS_MUTED_MEMBER);
    else
      this.removeState(Constants.kTAB_STATE_HAS_MUTED_MEMBER);

    const parent = this.parent;
    if (parent)
      parent.$TST.inheritSoundStateFromChildren();

    Tab.onSoundStateChanged.dispatch(this.tab);
  }


  setAttribute(attribute, value) {
    if (this.element)
      this.element.setAttribute(attribute, value);
    this.attributes[attribute] = value;
  }

  getAttribute(attribute) {
    return this.attributes[attribute];
  }

  removeAttribute(attribute) {
    if (this.element)
      this.element.removeAttribute(attribute);
    delete this.attributes[attribute];
  }


  resolveOpened() {
    if (!mOpenedResolvers.has(this.tab.id))
      return;
    mOpenedResolvers.get(this.tab.id)();
    mOpenedResolvers.delete(this.tab.id);
  }

  fetchClosedWhileActiveResolver() {
    const resolver = mClosedWhileActiveResolvers.get(this.tab.id);
    mClosedWhileActiveResolvers.delete(this.tab.id);
    return resolver;
  }

  get sanitized() {
    return Object.assign({}, this.tab, {
      '$TST': null
    });
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


//===================================================================
// tracking of tabs
//===================================================================

Tab.onTracked      = new EventListenerManager();
Tab.onDestroyed    = new EventListenerManager();
Tab.onInitialized  = new EventListenerManager();
Tab.onElementBound = new EventListenerManager();

Tab.track = tab => {
  const trackedTab = Tab.get(tab.id);
  if (!trackedTab) {
    tab.$TST = new Tab(tab);
  }
  else {
    const window = TabsStore.windows.get(tab.windowId);
    window.trackTab(tab);
  }
};

Tab.untrack = tabId => {
  const tab    = Tab.get(tabId);
  const window = TabsStore.windows.get(tab.windowId);
  if (window)
    window.untrackTab(tabId);
};

Tab.isTracked = tabId =>  {
  return TabsStore.tabs.has(tabId);
};

Tab.get = tabId =>  {
  return TabsStore.tabs.get(tabId);
};

Tab.getByUniqueId = id => {
  if (!id)
    return null;
  return TabsStore.ensureLivingTab(TabsStore.tabsByUniqueId.get(id));
};

Tab.needToWaitTracked = (windowId) => {
  if (windowId) {
    const tabs = mIncompletelyTrackedTabs.get(windowId);
    return tabs && tabs.size > 0;
  }
  for (const tabs of mIncompletelyTrackedTabs.values()) {
    if (tabs && tabs.size > 0)
      return true;
  }
  return false;
};

Tab.waitUntilTrackedAll = async (windowId, options = {}) => {
  const tabSets = [];
  if (windowId) {
    tabSets.push(mIncompletelyTrackedTabs.get(windowId));
  }
  else {
    for (const tabs of mIncompletelyTrackedTabs.values()) {
      tabSets.push(tabs);
    }
  }
  return Promise.all(tabSets.map(tabs => {
    if (tabs)
      return Tab.waitUntilTracked(Array.from(tabs, tab => tab.id), options);
  }));
};

Tab.waitUntilTracked = async (tabId, options = {}) => {
  if (!tabId)
    return null;
  if (Array.isArray(tabId))
    return Promise.all(tabId.map(id => Tab.waitUntilTracked(id, options)));
  const tab = Tab.get(tabId);
  if (tab) {
    if (options.element)
      return tab.$TST.promisedElement;
    return tab;
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (options.element) // eslint-disable-next-line no-use-before-define
        Tab.onElementBound.removeListener(onTracked);
      else // eslint-disable-next-line no-use-before-define
        Tab.onTracked.removeListener(onTracked);
      // eslint-disable-next-line no-use-before-define
      Tab.onDestroyed.removeListener(onDestroyed);
      reject(new Error(`Tab.waitUntilTracked for ${tabId} is timed out (in ${TabsStore.getWindow() || 'bg'})`));
    }, 10000); // Tabs.moveTabs() between windows may take much time
    const onDestroyed = (tab) => {
      if (tab.id != tabId)
        return;
      if (options.element) // eslint-disable-next-line no-use-before-define
        Tab.onElementBound.removeListener(onTracked);
      else // eslint-disable-next-line no-use-before-define
        Tab.onTracked.removeListener(onTracked);
      Tab.onDestroyed.removeListener(onDestroyed);
      reject(new Error(`Tab.waitUntilTracked: ${tabId} is removed while waiting (in ${TabsStore.getWindow() || 'bg'})`));
    };
    const onTracked = (tab) => {
      if (tab.id != tabId)
        return;
      if (options.element)
        Tab.onElementBound.removeListener(onTracked);
      else
        Tab.onTracked.removeListener(onTracked);
      Tab.onDestroyed.removeListener(onDestroyed);
      clearTimeout(timeout);
      if (options.element) {
        if (tab.$TST.element)
          resolve(tab);
        else
          tab.$TST.promisedElement.then(() => resolve(tab));
      }
      else {
        resolve(tab);
      }
    };
    if (options.element)
      Tab.onElementBound.addListener(onTracked);
    else
      Tab.onTracked.addListener(onTracked);
    Tab.onDestroyed.addListener(onDestroyed);
  });
};

Tab.needToWaitMoved = (windowId) => {
  if (windowId) {
    const tabs = mMovingTabs.get(windowId);
    return tabs && tabs.size > 0;
  }
  for (const tabs of mMovingTabs.values()) {
    if (tabs && tabs.size > 0)
      return true;
  }
  return false;
};

Tab.waitUntilMovedAll = async windowId => {
  const tabSets = [];
  if (windowId) {
    tabSets.push(mMovingTabs.get(windowId));
  }
  else {
    for (const tabs of mMovingTabs.values()) {
      tabSets.push(tabs);
    }
  }
  return Promise.all(tabSets.map(tabs => tabs && Promise.all(tabs)));
};

Tab.init = (tab, options = {}) => {
  log('initalize tab ', tab);
  const trackedTab = Tab.get(tab.id);
  if (trackedTab)
    tab = trackedTab;
  tab.$TST = (trackedTab && trackedTab.$TST) || new Tab(tab);

  if (tab.active)
    tab.$TST.addState(Constants.kTAB_STATE_ACTIVE);
  tab.$TST.addState(Constants.kTAB_STATE_SUBTREE_COLLAPSED);

  Tab.onInitialized.dispatch(tab, options);

  if (options.existing) {
    tab.$TST.addState(Constants.kTAB_STATE_ANIMATION_READY);
    tab.$TST.opened = Promise.resolve(true);
    tab.$TST.opening = false;
  }
  else {
    tab.$TST.opening = false;
    tab.$TST.opened = new Promise((resolve, _reject) => {
      tab.$TST.opening = false;
      mOpenedResolvers.set(tab.id, resolve);
    });
  }

  tab.$TST.closedWhileActive = new Promise((resolve, _reject) => {
    mClosedWhileActiveResolvers.set(tab.id, resolve);
  });

  return tab;
};


//===================================================================
// get single tab
//===================================================================

// Note that this function can return null if it is the first tab of
// a new window opened by the "move tab to new window" command.
Tab.getActiveTab = windowId => {
  return TabsStore.ensureLivingTab(TabsStore.activeTabForWindow.get(windowId));
};

Tab.getFirstTab = windowId => {
  return TabsStore.query({
    windowId,
    living:  true,
    ordered: true
  });
};

Tab.getLastTab = windowId => {
  return TabsStore.query({
    windowId,
    living: true,
    last:   true
  });
};

Tab.getLastVisibleTab = windowId => { // visible, not-collapsed, not-hidden
  return TabsStore.query({
    windowId,
    visible: true,
    last:    true,
  });
};

Tab.getLastOpenedTab = windowId => {
  const tabs = Tab.getTabs(windowId);
  return tabs.length > 0 ?
    tabs.sort((a, b) => b.id - a.id)[0] :
    null ;
};

Tab.getFirstNormalTab = windowId => { // visible, not-collapsed, not-pinned
  return TabsStore.query({
    windowId,
    normal:   true,
    ordered:  true
  });
};

Tab.getFirstVisibleTab = windowId => { // visible, not-collapsed, not-hidden
  return TabsStore.query({
    windowId,
    visible:  true,
    ordered:  true
  });
};

Tab.getGroupTabForOpener = opener => {
  if (!opener)
    return null;
  TabsStore.assertValidTab(opener);
  return TabsStore.query({
    windowId:   opener.windowId,
    living:     true,
    attributes: [
      Constants.kCURRENT_URI,
      new RegExp(`openerTabId=${opener.$TST.uniqueId.id}($|[#&])`)
    ]
  });
};

Tab.getOpenerFromGroupTab = groupTab => {
  if (!groupTab.$TST.isGroupTab)
    return null;
  TabsStore.assertValidTab(groupTab);
  const matchedOpenerTabId = groupTab.url.match(/openerTabId=([^&;]+)/);
  return matchedOpenerTabId && Tab.getByUniqueId(matchedOpenerTabId[1]);
};


//===================================================================
// grap tabs
//===================================================================

Tab.getActiveTabs = () => {
  return Array.from(TabsStore.activeTabForWindow.values(), TabsStore.ensureLivingTab);
};

Tab.getAllTabs = (windowId = null) => {
  return TabsStore.queryAll({
    windowId,
    living:   true,
    ordered:  true
  });
};

Tab.getTabs = windowId => { // only visible, including collapsed and pinned
  return TabsStore.queryAll({
    windowId,
    controllable: true,
    ordered:      true
  });
};

Tab.getNormalTabs = windowId => { // only visible, including collapsed, not pinned
  return TabsStore.queryAll({
    windowId,
    normal:   true,
    ordered:  true
  });
};

Tab.getVisibleTabs = windowId => { // visible, not-collapsed, not-hidden
  return TabsStore.queryAll({
    windowId,
    visible:  true,
    ordered:  true
  });
};

Tab.getPinnedTabs = windowId => { // visible, pinned
  return TabsStore.queryAll({
    windowId,
    pinned:   true,
    ordered:  true
  });
};


Tab.getUnpinnedTabs = windowId => { // visible, not pinned
  return TabsStore.queryAll({
    windowId,
    living:   true,
    pinned:   false,
    ordered:  true
  });
};

Tab.getRootTabs = windowId => {
  return TabsStore.queryAll({
    windowId,
    controllable: true,
    ordered:      true,
    hasParent:    false
  });
};

Tab.collectRootTabs = tabs => {
  return tabs.filter(tab => {
    if (!TabsStore.ensureLivingTab(tab))
      return false;
    const parent = tab.$TST.parent;
    return !parent || !tabs.includes(parent);
  });
};

Tab.getDraggingTabs = windowId => {
  return TabsStore.queryAll({
    windowId,
    living:  true,
    states:  [Constants.kTAB_STATE_DRAGGING, true],
    ordered: true
  });
};

Tab.getRemovingTabs = windowId => {
  return TabsStore.queryAll({
    windowId,
    states:   [Constants.kTAB_STATE_REMOVING, true],
    ordered:  true
  });
};

Tab.getDuplicatingTabs = windowId => {
  return TabsStore.queryAll({
    windowId,
    living:   true,
    states:   [Constants.kTAB_STATE_DUPLICATING, true],
    ordered:  true
  });
};

Tab.getHighlightedTabs = windowId => {
  if (windowId) {
    const highlightedTabs = TabsStore.highlightedTabsForWindow.get(windowId);
    if (highlightedTabs)
      return Array.from(highlightedTabs);
  }
  return TabsStore.queryAll({
    windowId,
    living:      true,
    highlighted: true,
    ordered:     true
  });
};

Tab.getSelectedTabs = windowId => {
  const selectedTabs = TabsStore.queryAll({
    windowId,
    living:   true,
    states:   [Constants.kTAB_STATE_SELECTED, true],
    ordered:  true
  });
  const highlightedTabs = TabsStore.highlightedTabsForWindow.get(windowId);
  if (!highlightedTabs ||
      highlightedTabs.size < 2)
    return selectedTabs;

  return Tab.sort(Array.from(new Set(selectedTabs, ...Array.from(highlightedTabs))));
};


//===================================================================
// general tab events
//===================================================================

Tab.onGroupTabDetected = new EventListenerManager();
Tab.onLabelUpdated     = new EventListenerManager();
Tab.onFaviconUpdated   = new EventListenerManager();
Tab.onStateChanged     = new EventListenerManager();
Tab.onPinned           = new EventListenerManager();
Tab.onUnpinned         = new EventListenerManager();
Tab.onHidden           = new EventListenerManager();
Tab.onShown            = new EventListenerManager();
Tab.onHighlightedTabsChanged = new EventListenerManager();
Tab.onSoundStateChanged = new EventListenerManager();
Tab.onTabInternallyMoved     = new EventListenerManager();
Tab.onCollapsedStateChanging = new EventListenerManager();
Tab.onCollapsedStateChanged  = new EventListenerManager();

Tab.onBeforeCreate     = new EventListenerManager();
Tab.onCreating         = new EventListenerManager();
Tab.onCreated          = new EventListenerManager();
Tab.onRemoving         = new EventListenerManager();
Tab.onRemoved          = new EventListenerManager();
Tab.onMoving           = new EventListenerManager();
Tab.onMoved            = new EventListenerManager();
Tab.onActivating       = new EventListenerManager();
Tab.onActivated        = new EventListenerManager();
Tab.onUpdated          = new EventListenerManager();
Tab.onRestoring        = new EventListenerManager();
Tab.onRestored         = new EventListenerManager();
Tab.onWindowRestoring  = new EventListenerManager();
Tab.onAttached         = new EventListenerManager();
Tab.onDetached         = new EventListenerManager();


//===================================================================
// utilities
//===================================================================

Tab.broadcastState = (tabs, options = {}) => {
  if (!Array.isArray(tabs))
    tabs = [tabs];
  browser.runtime.sendMessage({
    type:     Constants.kCOMMAND_BROADCAST_TAB_STATE,
    tabIds:   tabs.map(tab => tab.id),
    windowId: tabs[0].windowId,
    add:      options.add || [],
    remove:   options.remove || []
  }).catch(ApiTabs.createErrorSuppressor());
};

function getTabIndex(tab, options = {}) {
  if (typeof options != 'object')
    options = {};
  if (!TabsStore.ensureLivingTab(tab))
    return -1;
  TabsStore.assertValidTab(tab);

  let tabs = Tab.getAllTabs(tab.windowId);
  if (Array.isArray(options.ignoreTabs) &&
      options.ignoreTabs.length > 0)
    tabs = tabs.filter(tab => !options.ignoreTabs.includes(tab));

  return tabs.indexOf(tab);
}

Tab.calculateNewTabIndex = params => {
  if (params.insertBefore)
    return getTabIndex(params.insertBefore, params);
  if (params.insertAfter)
    return getTabIndex(params.insertAfter, params) + 1;
  return -1;
};

Tab.doAndGetNewTabs = async (asyncTask, windowId) => {
  const tabsQueryOptions = {
    windowType: 'normal'
  };
  if (windowId) {
    tabsQueryOptions.windowId = windowId;
  }
  const beforeTabs = await browser.tabs.query(tabsQueryOptions).catch(ApiTabs.createErrorHandler());
  const beforeIds  = beforeTabs.map(tab => tab.id);
  await asyncTask();
  const afterTabs = await browser.tabs.query(tabsQueryOptions).catch(ApiTabs.createErrorHandler());
  const addedTabs = afterTabs.filter(afterTab => !beforeIds.includes(afterTab.id));
  return addedTabs.map(tab => Tab.get(tab.id));
};

Tab.sort = tabs => {
  if (tabs.length == 0)
    return tabs;
  return tabs.sort((a, b) => a.index - b.index);
};

Tab.dumpAll = windowId => {
  if (!configs.debug)
    return;
  log('dumpAllTabs\n' +
    Tab.getAllTabs(windowId).map(tab =>
      tab.$TST.ancestors.reverse().concat([tab])
        .map(tab => tab.id + (tab.pinned ? ' [pinned]' : ''))
        .join(' => ')
    ).join('\n'));
};

