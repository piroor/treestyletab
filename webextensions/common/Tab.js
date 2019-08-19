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
import * as SidebarConnection from './sidebar-connection.js';

import Window from './Window.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/Tab', ...args);
}

const mOpenedResolvers            = new Map();
const mClosedWhileActiveResolvers = new Map();

const mIncompletelyTrackedTabs = new Map();
const mMovingTabs              = new Map();
const mPromisedTrackedTabs     = new Map();


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
    this.trackedAt = Date.now();

    this.updatingOpenerTabIds = []; // this must be an array, because same opener tab id can appear multiple times.

    this.lastSoundStateCounts = {
      soundPlaying: 0,
      muted:        0
    };
    this.soundPlayingChildrenIds = new Set();
    this.maybeSoundPlayingChildrenIds = new Set();
    this.mutedChildrenIds = new Set();
    this.maybeMutedChildrenIds = new Set();

    this.element = null;
    this.classList = null;
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
    this.promisedUniqueId = new Promise((resolve, _reject) => {
      this.onUniqueIdGenerated = resolve;
    });

    TabsStore.tabs.set(tab.id, tab);

    const window = TabsStore.windows.get(tab.windowId) || new Window(tab.windowId);
    window.trackTab(tab);

    // Don't update indexes here, instead Window.prototype.trackTab()
    // updates indexes because indexes are bound to windows.
    // TabsStore.updateIndexesForTab(tab);

    if (tab.active) {
      TabsStore.activeTabInWindow.set(tab.windowId, tab);
      TabsStore.activeTabsInWindow.get(tab.windowId).add(tab);
    }
    else {
      TabsStore.activeTabsInWindow.get(tab.windowId).delete(tab);
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
    mPromisedTrackedTabs.delete(`${this.tab.id}:true`);
    mPromisedTrackedTabs.delete(`${this.tab.id}:false`);

    Tab.onDestroyed.dispatch(this.tab);
    this.detach();

    if (this.reservedCleanupNeedlessGroupTab) {
      clearTimeout(this.reservedCleanupNeedlessGroupTab);
      delete this.reservedCleanupNeedlessGroupTab;
    }

    TabsStore.tabs.delete(this.id);
    if (this.uniqueId)
      TabsStore.tabsByUniqueId.delete(this.uniqueId.id);

    TabsStore.removeTabFromIndexes(this.tab);

    if (this.element) {
      if (this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      delete this.element.$TST;
      delete this.element.apiTab;
      delete this.element;
      delete this.classList;
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
    this.classList = element.classList;
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

  unbindElement() {
    this.element = null;
    this.classList = null;
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
    if (!this.tab) {
      const error = new Error('FATAL ERROR: updateUniqueId() is unavailable for an invalid tab');
      console.log(error);
      throw error;
    }
    if (options.id) {
      if (this.uniqueId.id)
        TabsStore.tabsByUniqueId.delete(this.uniqueId.id);
      this.uniqueId.id = options.id;
      TabsStore.tabsByUniqueId.set(options.id, this.tab);
      this.setAttribute(Constants.kPERSISTENT_ID, options.id);
      return Promise.resolve(this.uniqueId);
    }
    return UniqueId.request(this.tab, options).then(uniqueId => {
      if (uniqueId && TabsStore.ensureLivingTab(this.tab)) { // possibly removed from document while waiting
        this.uniqueId = uniqueId;
        TabsStore.tabsByUniqueId.set(uniqueId.id, this.tab);
        this.setAttribute(Constants.kPERSISTENT_ID, uniqueId.id);
      }
      return uniqueId || {};
    }).catch(error => {
      console.log(`FATAL ERROR: Failed to get unique id for a tab ${this.id}: `, error);
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

  get isSubtreeCollapsable() {
    return this.hasChild &&
           !this.collapsed &&
           !this.subtreeCollapsed;
  }

  get isAutoExpandable() {
    return this.hasChild && this.subtreeCollapsed;
  }

  get precedesPinnedTab() {
    const following = this.nearestVisibleFollowingTab;
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
           this.hasGroupTabURL;
  }

  get hasGroupTabURL() {
    return this.tab.url.indexOf(Constants.kGROUP_TAB_URI) == 0;
  }

  get isTemporaryGroupTab() {
    if (!this.isGroupTab)
      return false;
    return /[&?]temporary=true/.test(this.tab.url);
  }

  get isTemporaryAggressiveGroupTab() {
    if (!this.isGroupTab)
      return false;
    return /[&?]temporaryAggressive=true/.test(this.tab.url);
  }

  // Firefox Multi-Account Containers
  // https://addons.mozilla.org/firefox/addon/multi-account-containers/
  // Temporary Containers
  // https://addons.mozilla.org/firefox/addon/temporary-containers/
  get mayBeReplacedWithContainer() {
    const prevTab = this.unsafePreviousTab;
    return (
      !!prevTab &&
      this.tab.cookieStoreId != prevTab.cookieStoreId &&
      this.tab.url == prevTab.url
    );
  }
  get mayBeOriginalOfReplacedWithContainer() {
    const firstChild = this.firstChild;
    return (
      !!firstChild &&
      firstChild.$TST.mayBeReplacedWithContainer
    );
  }

  get selected() {
    return this.states.has(Constants.kTAB_STATE_SELECTED) ||
             (this.hasOtherHighlighted && !!(this.tab && this.tab.highlighted));
  }

  get multiselected() {
    return this.selected &&
             (this.hasOtherHighlighted ||
              TabsStore.selectedTabsInWindow.get(this.tab.windowId).size > 1);
  }

  get hasOtherHighlighted() {
    const highlightedTabs = TabsStore.highlightedTabsInWindow.get(this.tab.windowId);
    return !!(highlightedTabs && highlightedTabs.size > 1);
  }

  //===================================================================
  // neighbor tabs
  //===================================================================

  get nextTab() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      tabs:     TabsStore.controllableTabsInWindow.get(this.tab.windowId),
      fromId:   this.tab.id,
      controllable: true,
      index:    (index => index > this.tab.index)
    });
  }

  get previousTab() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      tabs:     TabsStore.controllableTabsInWindow.get(this.tab.windowId),
      fromId:   this.tab.id,
      controllable: true,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get unsafeNextTab() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      index:    (index => index > this.tab.index)
    });
  }

  get unsafePreviousTab() {
    return TabsStore.query({
      windowId: this.tab.windowId,
      fromId:   this.tab.id,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get nearestCompletelyOpenedNormalFollowingTab() { // including hidden tabs!
    return TabsStore.query({
      windowId: this.tab.windowId,
      tabs:     TabsStore.unpinnedTabsInWindow.get(this.tab.windowId),
      states:   [Constants.kTAB_STATE_CREATING, false],
      fromId:   this.tab.id,
      living:   true,
      index:    (index => index > this.tab.index)
    });
  }

  get nearestCompletelyOpenedNormalPrecedingTab() { // including hidden tabs!
    return TabsStore.query({
      windowId: this.tab.windowId,
      tabs:     TabsStore.unpinnedTabsInWindow.get(this.tab.windowId),
      states:   [Constants.kTAB_STATE_CREATING, false],
      fromId:   this.tab.id,
      living:   true,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get nearestVisibleFollowingTab() { // visible, not-collapsed
    return TabsStore.query({
      windowId: this.tab.windowId,
      tabs:     TabsStore.visibleTabsInWindow.get(this.tab.windowId),
      fromId:   this.tab.id,
      visible:  true,
      index:    (index => index > this.tab.index)
    });
  }

  get unsafeNearestExpandedFollowingTab() { // not-collapsed, possibly hidden
    return TabsStore.query({
      windowId: this.tab.windowId,
      tabs:     TabsStore.expandedTabsInWindow.get(this.tab.windowId),
      fromId:   this.tab.id,
      index:    (index => index > this.tab.index)
    });
  }

  get nearestVisiblePrecedingTab() { // visible, not-collapsed
    return TabsStore.query({
      windowId: this.tab.windowId,
      tabs:     TabsStore.visibleTabsInWindow.get(this.tab.windowId),
      fromId:   this.tab.id,
      visible:  true,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  get unsafeNearestExpandedPrecedingTab() { // not-collapsed, possibly hidden
    return TabsStore.query({
      windowId: this.tab.windowId,
      tabs:     TabsStore.expandedTabsInWindow.get(this.tab.windowId),
      fromId:   this.tab.id,
      index:    (index => index < this.tab.index),
      last:     true
    });
  }

  //===================================================================
  // tree relations
  //===================================================================

  set parent(tab) {
    const newParentId = tab && (typeof tab == 'number' ? tab : tab.id);
    if (newParentId == this.parentId)
      return tab;

    const oldParent = this.parent;
    this.parentId = newParentId;
    this.invalidateCachedAncestors();
    const parent = this.parent;
    if (parent) {
      this.setAttribute(Constants.kPARENT, parent.id);
      parent.$TST.invalidateCachedDescendants();
      if (this.states.has(Constants.kTAB_STATE_SOUND_PLAYING))
        parent.$TST.soundPlayingChildrenIds.add(this.tab.id);
      if (this.states.has(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER))
        parent.$TST.maybeSoundPlayingChildrenIds.add(this.tab.id);
      if (this.states.has(Constants.kTAB_STATE_MUTED))
        parent.$TST.mutedChildrenIds.add(this.tab.id);
      if (this.states.has(Constants.kTAB_STATE_HAS_MUTED_MEMBER))
        parent.$TST.maybeMutedChildrenIds.add(this.tab.id);
      parent.$TST.inheritSoundStateFromChildren();
      TabsStore.removeRootTab(this.tab);
    }
    else {
      this.removeAttribute(Constants.kPARENT);
      TabsStore.addRootTab(this.tab);
    }
    if (oldParent && oldParent.id != this.parentId) {
      oldParent.$TST.soundPlayingChildrenIds.delete(this.tab.id);
      oldParent.$TST.maybeSoundPlayingChildrenIds.delete(this.tab.id);
      oldParent.$TST.mutedChildrenIds.delete(this.tab.id);
      oldParent.$TST.maybeMutedChildrenIds.delete(this.tab.id);
      oldParent.$TST.inheritSoundStateFromChildren();
      oldParent.$TST.children = oldParent.$TST.childIds.filter(id => id != this.tab.id);
    }
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

  get rootTab() {
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

  get nearestFollowingRootTab() {
    const root = this.rootTab;
    return root && root.$TST.nextSiblingTab;
  }

  get nearestFollowingForeignerTab() {
    const base = this.lastDescendant || this.tab;
    return base && base.$TST.nextTab;
  }

  get unsafeNearestFollowingForeignerTab() {
    const base = this.lastDescendant || this.tab;
    return base && base.$TST.unsafeNextTab;
  }

  set children(tabs) {
    const ancestorsOfSelf = this.ancestors;
    tabs = tabs.filter(tab => {
      if (!ancestorsOfSelf.includes(tab))
        return true;
      console.log('FATAL ERROR: Cyclic tree structure has detected and prevented. ', {
        ancestorsOfSelf,
        tabs,
        tab,
        stack: new Error().stack
      });
      return false;
    });

    const newChildIds = tabs.map(tab => typeof tab == 'number' ? tab : tab && tab.id).filter(id => id);
    if (newChildIds.join('|') == this.childIds.join('|'))
      return tabs;

    const oldChildren = this.children;
    this.childIds = newChildIds;
    this.sortChildren();
    if (this.childIds.length > 0) {
      this.setAttribute(Constants.kCHILDREN, `|${this.childIds.join('|')}|`);
      if (this.isSubtreeCollapsable)
        TabsStore.addSubtreeCollapsableTab(this.tab);
    }
    else {
      this.removeAttribute(Constants.kCHILDREN);
      TabsStore.removeSubtreeCollapsableTab(this.tab);
    }
    for (const child of Array.from(new Set(this.children.concat(oldChildren)))) {
      if (this.childIds.includes(child.id))
        child.$TST.parent = this.id;
      else
        child.$TST.parent = null;
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
    this.childIds.sort((a, b) => Tab.compare(Tab.get(a), Tab.get(b)));
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

  get nextSiblingTab() {
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
        tabs:      TabsStore.rootTabsInWindow.get(this.tab.windowId),
        fromId:    this.tab.id,
        living:    true,
        index:     (index => index > this.tab.index),
        hasParent: false,
        first:     true
      });
    }
  }

  get previousSiblingTab() {
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
        tabs:      TabsStore.rootTabsInWindow.get(this.tab.windowId),
        fromId:    this.tab.id,
        living:    true,
        index:     (index => index < this.tab.index),
        hasParent: false,
        last:      true
      });
    }
  }

  get needToBeGroupedSiblings() {
    return TabsStore.queryAll({
      windowId:   this.tab.windowId,
      tabs:       TabsStore.toBeGroupedTabsInWindow.get(this.tab.windowId),
      normal:     true,
      '!id':      this.tab.id,
      attributes: [
        Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID, this.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID),
        Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER, ''
      ],
      ordered:    true
    });
  }

  //===================================================================
  // other relations
  //===================================================================

  get openerTab() {
    if (!this.tab.openerTabId ||
        this.tab.openerTabId == this.tab.id)
      return null;
    return TabsStore.query({
      windowId: this.tab.windowId,
      tabs:     TabsStore.livingTabsInWindow.get(this.tab.windowId),
      id:       this.tab.openerTabId,
      living:   true
    });
  }

  get hasPinnedOpener() {
    const opener = this.openerTab;
    return opener && opener.pinned;
  }

  findSuccessor(options = {}) {
    if (typeof options != 'object')
      options = {};
    const ignoredTabs = (options.ignoredTabs || []).slice(0);
    let foundTab = this.tab;
    do {
      ignoredTabs.push(foundTab);
      foundTab = foundTab.$TST.nextTab;
    } while (foundTab && ignoredTabs.includes(foundTab));
    if (!foundTab) {
      foundTab = this.tab;
      do {
        ignoredTabs.push(foundTab);
        foundTab = foundTab.$TST.nearestVisiblePrecedingTab;
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
      nextTab = nextTab.$TST.unsafeNextTab;
    if (!nextTab && !tabs[tabs.length - 1].$TST.unsafeNextTab)
      return true;

    tabs = Array.from(tabs);
    let previousTab = tabs.shift();
    for (const tab of tabs) {
      if (tab.$TST.unsafePreviousTab != previousTab)
        return false;
      previousTab = tab;
    }
    return !nextTab ||
           !previousTab ||
           previousTab.$TST.unsafeNextTab == nextTab;
  }

  isAllPlacedAfterSelf(tabs) {
    if (tabs.length == 0)
      return true;
    let previousTab = this.tab;
    if (tabs[0] == previousTab)
      previousTab = previousTab.$TST.unsafePreviousTab;
    if (!previousTab && !tabs[0].$TST.unsafePreviousTab)
      return true;

    tabs = Array.from(tabs).reverse();
    let nextTab = tabs.shift();
    for (const tab of tabs) {
      if (tab.$TST.unsafeNextTab != nextTab)
        return false;
      nextTab = tab;
    }
    return !previousTab ||
           !nextTab ||
           nextTab.$TST.unsafePreviousTab == previousTab;
  }

  detach() {
    this.parent   = null;
    this.children = [];
  }


  //===================================================================
  // State
  //===================================================================

  async addState(state, options = {}) {
    if (this.classList)
      this.classList.add(state);
    if (this.states)
      this.states.add(state);

    switch (state) {
      case Constants.kTAB_STATE_SELECTED:
        TabsStore.addSelectedTab(this.tab);
        break;

      case Constants.kTAB_STATE_COLLAPSED:
      case Constants.kTAB_STATE_SUBTREE_COLLAPSED:
        if (this.isSubtreeCollapsable)
          TabsStore.addSubtreeCollapsableTab(this.tab);
        else
          TabsStore.removeSubtreeCollapsableTab(this.tab);
        break;

      case Constants.kTAB_STATE_BUNDLED_ACTIVE:
        TabsStore.addBundledActiveTab(this.tab);
        break;

      case Constants.kTAB_STATE_SOUND_PLAYING: {
        const parent = this.parent;
        if (parent)
          parent.$TST.soundPlayingChildrenIds.add(this.tab.id);
      } break;

      case Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER: {
        const parent = this.parent;
        if (parent)
          parent.$TST.maybeSoundPlayingChildrenIds.add(this.tab.id);
      } break;

      case Constants.kTAB_STATE_MUTED: {
        const parent = this.parent;
        if (parent)
          parent.$TST.mutedChildrenIds.add(this.tab.id);
      } break;

      case Constants.kTAB_STATE_HAS_MUTED_MEMBER: {
        const parent = this.parent;
        if (parent)
          parent.$TST.maybeMutedChildrenIds.add(this.tab.id);
      } break;
    }

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
    if (this.classList)
      this.classList.remove(state);
    if (this.states)
      this.states.delete(state);

    switch (state) {
      case Constants.kTAB_STATE_SELECTED:
        TabsStore.removeSelectedTab(this.tab);
        break;

      case Constants.kTAB_STATE_COLLAPSED:
      case Constants.kTAB_STATE_SUBTREE_COLLAPSED:
        if (this.isSubtreeCollapsable)
          TabsStore.addSubtreeCollapsableTab(this.tab);
        else
          TabsStore.removeSubtreeCollapsableTab(this.tab);
        break;

      case Constants.kTAB_STATE_BUNDLED_ACTIVE:
        TabsStore.addBundledActiveTab(this.tab);
        break;

      case Constants.kTAB_STATE_SOUND_PLAYING: {
        const parent = this.parent;
        if (parent)
          parent.$TST.soundPlayingChildrenIds.delete(this.tab.id);
      } break;

      case Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER: {
        const parent = this.parent;
        if (parent)
          parent.$TST.maybeSoundPlayingChildrenIds.delete(this.tab.id);
      } break;

      case Constants.kTAB_STATE_MUTED: {
        const parent = this.parent;
        if (parent)
          parent.$TST.mutedChildrenIds.delete(this.tab.id);
      } break;

      case Constants.kTAB_STATE_HAS_MUTED_MEMBER: {
        const parent = this.parent;
        if (parent)
          parent.$TST.maybeMutedChildrenIds.delete(this.tab.id);
      } break;
    }

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
    const states = this.tab && await browser.sessions.getTabValue(this.tab.id, Constants.kPERSISTENT_STATES).catch(ApiTabs.handleMissingTabError);
    return states || [];
  }

  inheritSoundStateFromChildren() {
    // this is called too many times on a session restoration, so this should be throttled for better performance
    if (this.delayedInheritSoundStateFromChildren)
      clearTimeout(this.delayedInheritSoundStateFromChildren);

    this.delayedInheritSoundStateFromChildren = setTimeout(() => {
      delete this.delayedInheritSoundStateFromChildren;
      if (!TabsStore.ensureLivingTab(this.tab))
        return;

      const parent = this.parent;
      let modifiedCount = 0;

      const soundPlayingCount = this.soundPlayingChildrenIds.size + this.maybeSoundPlayingChildrenIds.size;
      if (soundPlayingCount != this.lastSoundStateCounts.soundPlaying) {
        this.lastSoundStateCounts.soundPlaying = soundPlayingCount;
        if (soundPlayingCount > 0) {
          this.addState(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
          if (parent)
            parent.$TST.maybeSoundPlayingChildrenIds.add(this.tab.id);
        }
        else {
          this.removeState(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
          if (parent)
            parent.$TST.maybeSoundPlayingChildrenIds.delete(this.tab.id);
        }
        modifiedCount++;
      }

      const mutedCount = this.mutedChildrenIds.size + this.maybeMutedChildrenIds.size;
      if (mutedCount != this.lastSoundStateCounts.muted) {
        this.lastSoundStateCounts.muted = mutedCount;
        if (mutedCount > 0) {
          this.addState(Constants.kTAB_STATE_HAS_MUTED_MEMBER);
          if (parent)
            parent.$TST.maybeMutedChildrenIds.add(this.tab.id);
        }
        else {
          this.removeState(Constants.kTAB_STATE_HAS_MUTED_MEMBER);
          if (parent)
            parent.$TST.maybeMutedChildrenIds.delete(this.tab.id);
        }
        modifiedCount++;
      }

      if (modifiedCount == 0)
        return;

      if (parent)
        parent.$TST.inheritSoundStateFromChildren();

      SidebarConnection.sendMessage({
        type:                  Constants.kCOMMAND_NOTIFY_TAB_SOUND_STATE_UPDATED,
        windowId:              this.tab.windowId,
        tabId:                 this.tab.id,
        hasSoundPlayingMember: this.states.has(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER),
        hasMutedMember:        this.states.has(Constants.kTAB_STATE_HAS_MUTED_MEMBER)
      });
    }, 100);
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

  memorizeNeighbors() {
    if (!this.tab) // already closed tab
      return;

    const previousTab = this.unsafePreviousTab;
    this.lastPreviousTabId = previousTab && previousTab.id;

    const nextTab = this.unsafeNextTab;
    this.lastNextTabId = nextTab && nextTab.id;
  }

  get isSubstantiallyMoved() {
    const previousTab = this.unsafePreviousTab;
    if (this.lastPreviousTabId != (previousTab && previousTab.id))
      return true;

    const nextTab = this.unsafeNextTab;
    if (this.lastNextTabId != (nextTab && nextTab.id))
      return true;

    return false;
  }

  get sanitized() {
    const sanitized = Object.assign({}, this.tab, {
      '$TST': null
    });
    delete sanitized.$TST;
    return sanitized;
  }

  export(full) {
    const exported = {
      id:         this.id,
      uniqueId:   this.uniqueId,
      states:     Array.from(this.states),
      attributes: this.attributes,
      parentId:   this.parentId,
      childIds:   this.childIds
    };
    if (full)
      return Object.assign({}, this.sanitized, { $TST: exported });
    return exported;
  }

  apply(exported) { // not optimized and unsafe yet!
    TabsStore.removeTabFromIndexes(this.tab);

    for (const key of Object.keys(exported)) {
      if (key == '$TST')
        continue;
      if (key in this.tab)
        this.tab[key] = exported[key];
    }

    this.uniqueId = exported.$TST.uniqueId;
    this.promisedUniqueId = Promise.resolve(this.uniqueId);

    this.states     = new Set(exported.$TST.states);
    this.attributes = exported.$TST.attributes;

    this.parent   = exported.$TST.parentId;
    this.children = exported.$TST.childIds || [];

    TabsStore.updateIndexesForTab(this.tab);
  }
}

// The list of properties which should be ignored when synchronization from the
// background to sidebars.
Tab.UNSYNCHRONIZABLE_PROPERTIES = new Set([
  'id',
  // Ignore "index" on synchronization, because it maybe wrong for the sidebar.
  // Index of tabs are managed and fixed by other sections like handling of
  // "kCOMMAND_NOTIFY_TAB_CREATING", Window.prototype.trackTab, and others.
  // See also: https://github.com/piroor/treestyletab/issues/2119
  'index',
  'reindexedBy'
]);


//===================================================================
// tracking of tabs
//===================================================================

Tab.onTracked      = new EventListenerManager();
Tab.onDestroyed    = new EventListenerManager();
Tab.onInitialized  = new EventListenerManager();
Tab.onElementBound = new EventListenerManager();

Tab.track = tab => {
  const trackedTab = Tab.get(tab.id);
  if (!trackedTab ||
      !(tab.$TST instanceof Tab)) {
    new Tab(tab);
  }
  else {
    if (trackedTab)
      tab = trackedTab;
    const window = TabsStore.windows.get(tab.windowId);
    window.trackTab(tab);
  }
  return trackedTab || tab;
};

Tab.untrack = tabId => {
  const tab = Tab.get(tabId);
  if (!tab) // already untracked
    return;
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
    if (!tabs)
      return;
    let tabIds = Array.from(tabs, tab => tab.id);
    if (options.exceptionTabId)
      tabIds = tabIds.filter(id => id != options.exceptionTabId);
    return Tab.waitUntilTracked(tabIds, options);
  }));
};

async function waitUntilTracked(tabId, options = {}) {
  const stack = configs.debug && new Error().stack;
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
      reject(new Error(`Tab.waitUntilTracked for ${tabId} is timed out (in ${TabsStore.getWindow() || 'bg'})\b${stack}`));
    }, configs.maximumDelayUntilTabIsTracked); // Tabs.moveTabs() between windows may take much time
    const onDestroyed = (tab) => {
      if (tab.id != tabId)
        return;
      if (options.element) // eslint-disable-next-line no-use-before-define
        Tab.onElementBound.removeListener(onTracked);
      else // eslint-disable-next-line no-use-before-define
        Tab.onTracked.removeListener(onTracked);
      Tab.onDestroyed.removeListener(onDestroyed);
      reject(new Error(`Tab.waitUntilTracked: ${tabId} is removed while waiting (in ${TabsStore.getWindow() || 'bg'})\n${stack}`));
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

Tab.waitUntilTracked = async (tabId, options = {}) => {
  if (!tabId)
    return null;

  if (Array.isArray(tabId))
    return Promise.all(tabId.map(id => Tab.waitUntilTracked(id, options)));

  const windowId = TabsStore.getWindow();
  if (windowId) {
    const tabs = TabsStore.removedTabsInWindow.get(windowId);
    if (tabs && tabs.has(tabId))
      return null; // already removed tab
  }

  const key = `${tabId}:${!!options.element}`;
  if (mPromisedTrackedTabs.has(key))
    return mPromisedTrackedTabs.get(key);

  const promisedTracked = waitUntilTracked(tabId, options);
  mPromisedTrackedTabs.set(key, promisedTracked);
  return promisedTracked.then(tab => {
    // Don't claer the last promise, because it is required to process following "waitUntilTracked" callbacks sequentically.
    //if (mPromisedTrackedTabs.get(key) == promisedTracked)
    //  mPromisedTrackedTabs.delete(key);
    return tab;
  }).catch(error => {
    //if (mPromisedTrackedTabs.get(key) == promisedTracked)
    //  mPromisedTrackedTabs.delete(key);
    throw error;
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
  if (!tab) {
    const error = new Error('Fatal error: invalid tab is given to Tab.init()');
    console.log(error, error.stack);
    throw error;
  }
  const trackedTab = Tab.get(tab.id);
  if (trackedTab)
    tab = trackedTab;
  tab.$TST = (trackedTab && trackedTab.$TST) || new Tab(tab);
  tab.$TST.updateUniqueId().then(tab.$TST.onUniqueIdGenerated);

  if (tab.active)
    tab.$TST.addState(Constants.kTAB_STATE_ACTIVE);

  // When a new "child" tab was opened and the "parent" tab was closed
  // immediately by someone outside of TST, both new "child" and the
  // "parent" were closed by TST because all new tabs had
  // "subtree-collapsed" state initially and such an action was detected
  // as "closing of a collapsed tree".
  // The initial state was introduced in old versions, but I forgot why
  // it was required. "When new child tab is attached, collapse other
  // tree" behavior works as expected even if the initial state is not
  // there. Thus I remove the initial state for now, to avoid the
  // annoying problem.
  // See also: https://github.com/piroor/treestyletab/issues/2162
  // tab.$TST.addState(Constants.kTAB_STATE_SUBTREE_COLLAPSED);

  Tab.onInitialized.dispatch(tab, options);

  if (options.existing) {
    tab.$TST.addState(Constants.kTAB_STATE_ANIMATION_READY);
    tab.$TST.opened = Promise.resolve(true);
    tab.$TST.opening = false;
    tab.$TST.openedCompletely = true;
  }
  else {
    tab.$TST.opening = true;
    tab.$TST.openedCompletely = false;
    tab.$TST.opened = new Promise((resolve, _reject) => {
      tab.$TST.opening = false;
      mOpenedResolvers.set(tab.id, resolve);
    }).then(() => {
      tab.$TST.openedCompletely = true;
    });
  }

  tab.$TST.closedWhileActive = new Promise((resolve, _reject) => {
    mClosedWhileActiveResolvers.set(tab.id, resolve);
  });

  return tab;
};

Tab.import = tab => {
  const existingTab = Tab.get(tab.id);
  if (existingTab)
    existingTab.$TST.apply(tab);
  return existingTab;
};


//===================================================================
// get single tab
//===================================================================

// Note that this function can return null if it is the first tab of
// a new window opened by the "move tab to new window" command.
Tab.getActiveTab = windowId => {
  return TabsStore.ensureLivingTab(TabsStore.activeTabInWindow.get(windowId));
};

Tab.getFirstTab = windowId => {
  return TabsStore.query({
    windowId,
    tabs:    TabsStore.livingTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  });
};

Tab.getLastTab = windowId => {
  return TabsStore.query({
    windowId,
    tabs:   TabsStore.livingTabsInWindow.get(windowId),
    living: true,
    last:   true
  });
};

Tab.getLastVisibleTab = windowId => { // visible, not-collapsed, not-hidden
  return TabsStore.query({
    windowId,
    tabs:    TabsStore.visibleTabsInWindow.get(windowId),
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

Tab.getLastPinnedTab = windowId => { // visible, pinned
  return TabsStore.query({
    windowId,
    tabs:    TabsStore.pinnedTabsInWindow.get(windowId),
    living:  true,
    ordered: true,
    last:    true
  });
};

Tab.getFirstNormalTab = windowId => { // visible, not-collapsed, not-pinned
  return TabsStore.query({
    windowId,
    tabs:    TabsStore.unpinnedTabsInWindow.get(windowId),
    normal:  true,
    ordered: true
  });
};

Tab.getFirstVisibleTab = windowId => { // visible, not-collapsed, not-hidden
  return TabsStore.query({
    windowId,
    tabs:    TabsStore.visibleTabsInWindow.get(windowId),
    visible: true,
    ordered: true
  });
};

Tab.getGroupTabForOpener = opener => {
  if (!opener)
    return null;
  TabsStore.assertValidTab(opener);
  return TabsStore.query({
    windowId:   opener.windowId,
    tabs:       TabsStore.groupTabsInWindow.get(opener.windowId),
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
  return Array.from(TabsStore.activeTabInWindow.values(), TabsStore.ensureLivingTab);
};

Tab.getAllTabs = (windowId = null, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:     windowId && TabsStore.livingTabsInWindow.get(windowId),
    living:   true,
    ordered:  true
  }, options));
};

Tab.getTabAt = (windowId, index) => {
  const tabs    = TabsStore.livingTabsInWindow.get(windowId);
  const allTabs = TabsStore.windows.get(windowId).tabs;
  return TabsStore.query({
    windowId,
    tabs,
    living:       true,
    fromIndex:    Math.max(0, index - (allTabs.size - tabs.size)),
    logicalIndex: index,
    first:        true
  });
};

Tab.getTabs = (windowId, options = {}) => { // only visible, including collapsed and pinned
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:         TabsStore.controllableTabsInWindow.get(windowId),
    controllable: true,
    ordered:      true
  }, options));
};

Tab.getTabsBetween = (begin, end) => {
  if (!begin || !TabsStore.ensureLivingTab(begin) ||
      !end || !TabsStore.ensureLivingTab(end))
    throw new Error('getTabsBetween requires valid two tabs');
  if (begin.windowId != end.windowId)
    throw new Error('getTabsBetween requires two tabs in same window');

  if (begin == end)
    return [];
  if (begin.index > end.index)
    [begin, end] = [end, begin];
  return TabsStore.queryAll({
    windowId: begin.windowId,
    tabs:     TabsStore.controllableTabsInWindow.get(begin.windowId),
    id:       (id => id != begin.id && id != end.id),
    fromId:   begin.id,
    toId:     end.id
  });
};

Tab.getNormalTabs = (windowId, options = {}) => { // only visible, including collapsed, not pinned
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.unpinnedTabsInWindow.get(windowId),
    normal:  true,
    ordered: true
  }, options));
};

Tab.getVisibleTabs = (windowId, options = {}) => { // visible, not-collapsed, not-hidden
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.visibleTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  }, options));
};

Tab.getPinnedTabs = (windowId, options = {}) => { // visible, pinned
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.pinnedTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  }, options));
};


Tab.getUnpinnedTabs = (windowId, options = {}) => { // visible, not pinned
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.unpinnedTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  }, options));
};

Tab.getRootTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:         TabsStore.rootTabsInWindow.get(windowId),
    controllable: true,
    ordered:      true
  }, options));
};

Tab.collectRootTabs = tabs => {
  return tabs.filter(tab => {
    if (!TabsStore.ensureLivingTab(tab))
      return false;
    const parent = tab.$TST.parent;
    return !parent || !tabs.includes(parent);
  });
};

Tab.getSubtreeCollapsedTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:     TabsStore.subtreeCollapsableTabsInWindow.get(windowId),
    living:   true,
    hidden:   false,
    ordered:  true
  }, options));
};

Tab.getCollapsingTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs: TabsStore.collapsingTabsInWindow.get(windowId)
  }, options));
};

Tab.getExpandingTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs: TabsStore.expandingTabsInWindow.get(windowId),
  }, options));
};

Tab.getGroupTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.groupTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  }, options));
};

Tab.getLoadingTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.loadingTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  }, options));
};

Tab.getDraggingTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.draggingTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  }, options));
};

Tab.getRemovingTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.removingTabsInWindow.get(windowId),
    ordered: true
  }, options));
};

Tab.getDuplicatingTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.duplicatingTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  }, options));
};

Tab.getHighlightedTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.highlightedTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  }, options));
};

Tab.getSelectedTabs = (windowId, options = {}) => {
  const selectedTabs = TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.selectedTabsInWindow.get(windowId),
    living:  true,
    ordered: true
  }, options));
  const highlightedTabs = TabsStore.highlightedTabsInWindow.get(windowId);
  if (!highlightedTabs ||
      highlightedTabs.size < 2)
    return selectedTabs;

  if (options.iterator)
    return (function* () {
      const alreadyReturnedTabs = new Set();
      for (const tab of selectedTabs) {
        yield tab;
        alreadyReturnedTabs.add(tab);
      }
      for (const tab of highlightedTabs.values()) {
        if (!alreadyReturnedTabs.has(tab))
          yield tab;
      }
    })();
  else
    return Tab.sort(Array.from(new Set([...selectedTabs, ...Array.from(highlightedTabs.values())])));
};

Tab.getNeedToBeSynchronizedTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:    TabsStore.unsynchronizedTabsInWindow.get(windowId),
    visible: true
  }, options));
};

Tab.hasLoadingTab = windowId => {
  return !!TabsStore.query({
    windowId,
    tabs:     TabsStore.loadingTabsInWindow.get(windowId),
    visible:  true
  });
};

Tab.hasMultipleTabs = (windowId, options = {}) => {
  const tabs = TabsStore.queryAll(Object.assign({
    windowId,
    tabs:   TabsStore.livingTabsInWindow.get(windowId),
    living: true
  }, options, { iterator: true }));
  let count = 0;
  // eslint-disable-next-line no-unused-vars
  for (const tab of tabs) {
    count++;
    if (count > 1)
      return true;
  }
  return false;
};

// "Recycled tab" is an existing but reused tab for session restoration.
Tab.getRecycledTabs = (windowId, options = {}) => {
  return TabsStore.queryAll(Object.assign({
    windowId,
    tabs:       TabsStore.livingTabsInWindow.get(windowId),
    living:     true,
    states:     [Constants.kTAB_STATE_RESTORED, false],
    attributes: [Constants.kCURRENT_URI, new RegExp(`^(|${configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl}|about:blank|about:privatebrowsing)$`)]
  }, options));
};


//===================================================================
// general tab events
//===================================================================

Tab.onGroupTabDetected = new EventListenerManager();
Tab.onLabelUpdated     = new EventListenerManager();
Tab.onStateChanged     = new EventListenerManager();
Tab.onPinned           = new EventListenerManager();
Tab.onUnpinned         = new EventListenerManager();
Tab.onHidden           = new EventListenerManager();
Tab.onShown            = new EventListenerManager();
Tab.onTabInternallyMoved     = new EventListenerManager();
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
  if (tabs.length == 0)
    return;
  SidebarConnection.sendMessage({
    type:     Constants.kCOMMAND_BROADCAST_TAB_STATE,
    tabIds:   tabs.map(tab => tab.id),
    windowId: tabs[0].windowId,
    add:      options.add || [],
    remove:   options.remove || []
  });
};

Tab.getOtherTabs = (windowId, ignoreTabs, options = {}) => {
  const query = {
    windowId: windowId,
    tabs:     TabsStore.livingTabsInWindow.get(windowId),
    ordered:  true
  };
  if (Array.isArray(ignoreTabs) &&
      ignoreTabs.length > 0)
    query['!id'] = ignoreTabs.map(tab => tab.id);
  return TabsStore.queryAll(Object.assign(query, options));
};

function getTabIndex(tab, options = {}) {
  if (typeof options != 'object')
    options = {};
  if (!TabsStore.ensureLivingTab(tab))
    return -1;
  TabsStore.assertValidTab(tab);
  return Tab.getOtherTabs(tab.windowId, options.ignoreTabs).indexOf(tab);
}

Tab.calculateNewTabIndex = params => {
  // We need to calculate new index based on "insertAfter" at first, to avoid
  // placing of the new tab after hidden tabs (too far from the location it
  // should be.)
  if (params.insertAfter)
    return getTabIndex(params.insertAfter, params) + 1;
  if (params.insertBefore)
    return getTabIndex(params.insertBefore, params);
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

Tab.compare = (a, b) => a.index - b.index;

Tab.sort = tabs => tabs.length == 0 ? tabs : tabs.sort(Tab.compare);

Tab.dumpAll = windowId => {
  if (!configs.debug)
    return;
  const output = ['dumpAllTabs'];
  for (const tab of Tab.getAllTabs(windowId, {iterator: true })) {
    output.push(tab.$TST.ancestors.reverse().concat([tab])
      .map(tab => tab.id + (tab.pinned ? ' [pinned]' : ''))
      .join(' => '));
  }
  log(output.join('\n'));
};

