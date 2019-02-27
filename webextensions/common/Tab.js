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

  sortChildren() {
    this.childIds = Tabs.sort(this.childIds.map(id => Tab.get(id))).map(tab => tab.id);
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

  findSuccessor(tab, options = {}) {
    if (typeof options != 'object')
      options = {};
    const ignoredTabs = (options.ignoredTabs || []).slice(0);
    let foundTab = tab;
    do {
      ignoredTabs.push(foundTab);
      foundTab = Tab.getNextSibling(foundTab);
    } while (foundTab && ignoredTabs.includes(foundTab));
    if (!foundTab) {
      foundTab = tab;
      do {
        ignoredTabs.push(foundTab);
        foundTab = Tab.getPreviousVisible(foundTab);
      } while (foundTab && ignoredTabs.includes(foundTab));
    }
    return foundTab;
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


Tab.getNext = tab => {
  if (!tab)
    return null;
  Tabs.assertValidTab(tab);
  return Tabs.query({
    windowId: tab.windowId,
    fromId:   tab.id,
    living:   true,
    index:    (index => index > tab.index)
  });
}

Tab.getPrevious = tab => {
  if (!tab)
    return null;
  Tabs.assertValidTab(tab);
  return Tabs.query({
    windowId: tab.windowId,
    fromId:   tab.id,
    living:   true,
    index:    (index => index < tab.index),
    last:     true
  });
}

Tab.getNextNormal = tab => {
  if (!Tabs.ensureLivingTab(tab))
    return null;
  Tabs.assertValidTab(tab);
  return Tabs.query({
    windowId: tab.windowId,
    fromId:   tab.id,
    normal:   true,
    index:    (index => index > tab.index)
  });
}

Tab.getPreviousNormal = tab => {
  if (!Tabs.ensureLivingTab(tab))
    return null;
  Tabs.assertValidTab(tab);
  return Tabs.query({
    windowId: tab.windowId,
    fromId:   tab.id,
    normal:   true,
    index:    (index => index < tab.index),
    last:     true
  });
}

Tab.getNextVisibleTab = tab => { // visible, not-collapsed
  if (!Tabs.ensureLivingTab(tab))
    return null;
  Tabs.assertValidTab(tab);
  return Tabs.query({
    windowId: tab.windowId,
    fromId:   tab.id,
    visible:  true,
    index:    (index => index > tab.index)
  });
}

Tab.getPreviousVisibleTab = tab => { // visible, not-collapsed
  if (!Tabs.ensureLivingTab(tab))
    return null;
  Tabs.assertValidTab(tab);
  return Tabs.query({
    windowId: tab.windowId,
    fromId:   tab.id,
    visible:  true,
    index:    (index => index < tab.index),
    last:     true
  });
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

Tab.getDescendants = root => {
  if (!Tabs.ensureLivingTab(root))
    return [];
  Tabs.assertValidTab(root);
  if (!Tabs.assertInitializedTab(root))
    return [];
  let descendants = [];
  const children = root.$TST.children;
  for (const child of children) {
    descendants.push(child);
    descendants = descendants.concat(Tab.getDescendants(child));
  }
  return descendants;
}

Tab.getLastDescendant = root => {
  Tabs.assertValidTab(root);
  const descendants = Tab.getDescendants(root);
  return descendants.length ? descendants[descendants.length-1] : null ;
}

Tab.getNextSibling = tab => {
  if (!Tabs.ensureLivingTab(tab))
    return null;
  Tabs.assertValidTab(tab);
  const parent = tab.$TST.parent;
  if (parent) {
    const siblingIds = parent.$TST.childIds;
    const index = siblingIds.indexOf(tab.id);
    const siblingId = index < siblingIds.length - 1 ? siblingIds[index + 1] : null ;
    if (!siblingId)
      return null;
    return Tab.get(siblingId);
  }
  else {
    return Tabs.query({
      windowId:  tab.windowId,
      fromId:    tab.id,
      living:    true,
      index:     (index => index > tab.index),
      hasParent: false,
      first:     true
    });
  }
}

Tab.getPreviousSibling = tab => {
  if (!Tabs.ensureLivingTab(tab))
    return null;
  Tabs.assertValidTab(tab);
  const parent = tab.$TST.parent;
  if (parent) {
    const siblingIds = parent.$TST.childIds;
    const index = siblingIds.indexOf(tab.id);
    const siblingId = index > 0 ? siblingIds[index - 1] : null ;
    if (!siblingId)
      return null;
    return Tab.get(siblingId);
  }
  else {
    return Tabs.query({
      windowId:  tab.windowId,
      fromId:    tab.id,
      living:    true,
      index:     (index => index < tab.index),
      hasParent: false,
      last:      true
    });
  }
}


// if all tabs are aldeardy placed at there, we don't need to move them.
Tab.isAllPlacedBefore = (tabs, nextTab) => {
  if (tabs[tabs.length - 1] == nextTab)
    nextTab = Tab.getNext(nextTab);
  if (!nextTab && !Tab.getNext(tabs[tabs.length - 1]))
    return true;

  tabs = Array.from(tabs);
  let previousTab = tabs.shift();
  for (const tab of tabs) {
    if (Tab.getPrevious(tab) != previousTab)
      return false;
    previousTab = tab;
  }
  return !nextTab ||
         !previousTab ||
         Tab.getNext(previousTab) == nextTab;
}

Tab.isAllPlacedAfter = (tabs, previousTab) => {
  if (tabs[0] == previousTab)
    previousTab = Tab.getPrevious(previousTab);
  if (!previousTab && !Tab.getPrevious(tabs[0]))
    return true;

  tabs = Array.from(tabs).reverse();
  let nextTab = tabs.shift();
  for (const tab of tabs) {
    if (Tab.getNext(tab) != nextTab)
      return false;
    nextTab = tab;
  }
  return !previousTab ||
         !nextTab ||
         Tab.getPrevious(nextTab) == previousTab;
}


Tab.dumpAll = (windowId) => {
  if (!configs.debug)
    return;
  log('dumpAllTabs\n' +
    Tabs.getAllTabs(windowId).map(tab =>
      Tab.getAncestor(tab).reverse().concat([tab])
        .map(tab => tab.id + (Tabs.isPinned(tab) ? ' [pinned]' : ''))
        .join(' => ')
    ).join('\n'));
}

