/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from '/common/common.js';

import * as Tabs from '/common/tabs.js';

function log(...args) {
  internalLogger('background/handle-tab-multiselect', ...args);
}

Tabs.onUpdated.addListener((tab, info, options = {}) => {
  if (!('highlighted' in info) ||
      !Tabs.isSubtreeCollapsed(tab) ||
      Tabs.isCollapsed(tab) ||
      !Tabs.isMultiselected(tab) ||
      options.inheritHighlighted === false)
    return;

  const collapsedDescendants = Tabs.getDescendantTabs(tab);
  log('inherit highlighted state from root visible tab: ', {
    highlighted: info.highlighted,
    collapsedDescendants
  });
  for (const descendant of collapsedDescendants) {
    browser.tabs.update(descendant.apiTab.id, {
      highlighted: info.highlighted,
      active:      Tabs.isActive(descendant)
    });
  }
});

function getTabsBetween(begin, end) {
  if (!begin || !begin.parentNode ||
      !end || !end.parentNode)
    throw new Error('getTabsBetween requires valid two tabs');
  if (begin.parentNode != end.parentNode)
    throw new Error('getTabsBetween requires two tabs in same window');

  if (begin == end)
    return [];
  let inRange = false;
  return Array.from(begin.parentNode.children).filter(tab => {
    if (tab == begin || tab == end) {
      inRange = !inRange;
      return false;
    }
    return inRange;
  });
}

const mLastClickedTabInWindow = new WeakMap();
const mIsInSelectionSession   = new WeakMap();

export async function updateSelectionByTabClick(tab, event) {
  const ctrlKeyPressed = event.ctrlKey || (event.metaKey && /^Mac/i.test(navigator.platform));
  const activeTab = Tabs.getActiveTab(tab.apiTab.windowId);
  const highlightedTabIds = new Set(Tabs.getHighlightedTabs(tab).map(tab => tab.apiTab.id));
  const inSelectionSession = mIsInSelectionSession.get(tab.parentNode);
  if (event.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const lastClickedTab   = mLastClickedTabInWindow.get(tab.parentNode) || activeTab;
    const betweenTabs      = getTabsBetween(lastClickedTab, tab, tab.parentNode.children);
    const targetTabs       = [lastClickedTab].concat(betweenTabs);
    if (tab != lastClickedTab)
      targetTabs.push(tab);

    try {
      if (!ctrlKeyPressed) {
        const alreadySelectedTabs = Tabs.getSelectedTabs(tab.apiTab.windowId);
        log('clear old selection by shift-click: ', alreadySelectedTabs);
        for (const alreadySelectedTab of alreadySelectedTabs) {
          if (!targetTabs.includes(alreadySelectedTab))
            highlightedTabIds.delete(alreadySelectedTab.apiTab.id);
        }
      }

      log('set selection by shift-click: ', targetTabs);
      for (const toBeSelectedTab of targetTabs) {
        highlightedTabIds.add(toBeSelectedTab.apiTab.id);
      }

      const rootTabs = [tab];
      if (tab != activeTab &&
          !inSelectionSession)
        rootTabs.push(activeTab);
      for (const root of rootTabs) {
        if (!Tabs.isSubtreeCollapsed(root))
          continue;
        for (const descendant of Tabs.getDescendantTabs(root)) {
          highlightedTabIds.add(descendant.apiTab.id);
        }
      }

      // for better performance, we should not call browser.tabs.update() for each tab.
      const indices = Array.from(highlightedTabIds)
        .filter(apiTabId => apiTabId != activeTab.apiTab.id)
        .map(apiTabId => Tabs.getTabElementById(apiTabId).apiTab.index);
      if (highlightedTabIds.has(activeTab.apiTab.id))
        indices.unshift(activeTab.apiTab.index);
      browser.tabs.highlight({
        windowId: tab.apiTab.windowId,
        populate: false,
        tabs:     indices
      });
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    mIsInSelectionSession.set(tab.parentNode, true);
    return true;
  }
  else if (ctrlKeyPressed) {
    try {
      log('change selection by ctrl-click: ', tab);
      /* Special operation to toggle selection of collapsed descendants for the active tab.
         - When there is no other multiselected foreign tab
           => toggle multiselection only descendants.
         - When there is one or more multiselected foreign tab
           => toggle multiselection of the active tab and descendants.
              => one of multiselected foreign tabs will be activated.
         - When a foreign tab is highlighted and there is one or more unhighlighted descendants 
           => highlight all descendants (to prevent only the root tab is dragged).
       */
      const activeTabDescendants = Tabs.getDescendantTabs(activeTab);
      let toBeHighlighted = !Tabs.isHighlighted(tab);
      log('toBeHighlighted: ', toBeHighlighted);
      if (tab == activeTab &&
          Tabs.isSubtreeCollapsed(tab) &&
          activeTabDescendants.length > 0) {
        const highlightedCount  = activeTabDescendants.filter(Tabs.isHighlighted).length;
        const partiallySelected = highlightedCount != 0 && highlightedCount != activeTabDescendants.length;
        toBeHighlighted = partiallySelected || !Tabs.isHighlighted(activeTabDescendants[0]);
        log(' => ', toBeHighlighted, { partiallySelected });
      }
      if (toBeHighlighted)
        highlightedTabIds.add(tab.apiTab.id);
      else
        highlightedTabIds.delete(tab.apiTab.id);

      if (Tabs.isSubtreeCollapsed(tab)) {
        const descendants = tab == activeTab ? activeTabDescendants : Tabs.getDescendantTabs(tab);
        for (const descendant of descendants) {
          if (toBeHighlighted)
            highlightedTabIds.add(descendant.apiTab.id);
          else
            highlightedTabIds.delete(descendant.apiTab.id);
        }
      }

      if (tab == activeTab) {
        if (highlightedTabIds.size == 0) {
          log('Don\'t unhighlight only one highlighted active tab!');
          highlightedTabIds.add(tab.apiTab.id);
        }
      }
      else if (!inSelectionSession) {
        log('Select active tab and its descendants, for new selection session');
        highlightedTabIds.add(activeTab.apiTab.id);
        if (Tabs.isSubtreeCollapsed(activeTab)) {
          for (const descendant of activeTabDescendants) {
            highlightedTabIds.add(descendant.apiTab.id);
          }
        }
      }

      // for better performance, we should not call browser.tabs.update() for each tab.
      const indices = Array.from(highlightedTabIds)
        .filter(apiTabId => apiTabId != activeTab.apiTab.id)
        .map(apiTabId => Tabs.getTabElementById(apiTabId).apiTab.index);
      if (highlightedTabIds.has(activeTab.apiTab.id))
        indices.unshift(activeTab.apiTab.index);
      browser.tabs.highlight({
        windowId: tab.apiTab.windowId,
        populate: false,
        tabs:     indices
      });
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    mLastClickedTabInWindow.set(tab.parentNode, tab);
    mIsInSelectionSession.set(tab.parentNode, true);
    return true;
  }
  else {
    mLastClickedTabInWindow.set(tab.parentNode, tab);
    mIsInSelectionSession.delete(tab.parentNode);
    return false;
  }
}
