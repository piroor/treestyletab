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

Tabs.onUpdated.addListener((tab, info) => {
  if (!('highlighted' in info) ||
      !Tabs.isSubtreeCollapsed(tab) ||
      Tabs.isCollapsed(tab) ||
      !Tabs.isMultiselected(tab))
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
  return Array.slice(begin.parentNode.children).filter(tab => {
    if (tab == begin || tab == end) {
      inRange = !inRange;
      return false;
    }
    return inRange;
  });
}

const mLastClickedTabInWindow = new WeakMap();

export async function updateSelectionByTabClick(tab, event) {
  const ctrlKeyPressed = event.ctrlKey || (event.metaKey && /^Mac/i.test(navigator.platform));
  const activeTab = Tabs.getCurrentTab(tab);
  const highlightedTabIds = new Set(Tabs.getHighlightedTabs(tab).map(tab => tab.apiTab.id));
  if (event.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const lastClickedTab   = mLastClickedTabInWindow.get(tab.parentNode) || activeTab;
    const betweenTabs      = getTabsBetween(lastClickedTab, tab, tab.parentNode.children);
    const targetTabs       = [lastClickedTab].concat(betweenTabs);
    if (tab != lastClickedTab)
      targetTabs.push(tab);

    try {
      if (!ctrlKeyPressed) {
        const alreadySelectedTabs = Tabs.getSelectedTabs(tab);
        log('clear old selection by shift-click: ', alreadySelectedTabs);
        for (const alreadySelectedTab of alreadySelectedTabs) {
          if (!targetTabs.includes(alreadySelectedTab))
            highlightedTabIds.delete(alreadySelectedTab.apiTab.id);
        }
      }
      log('set selection by shift-click: ', targetTabs);
      for (const toBeSelectedTab of targetTabs) {
        if (Tabs.isHighlighted(toBeSelectedTab))
          continue;
        highlightedTabIds.add(toBeSelectedTab.apiTab.id);
      }
      if (tab != activeTab &&
          Tabs.isSubtreeCollapsed(activeTab)) {
        // highlight all collapsed descendants of the active tab, to prevent only the root tab is dragged.
        for (const descendant of Tabs.getDescendantTabs(activeTab)) {
          highlightedTabIds.add(descendant.apiTab.id);
        }
      }
      // for better performance, we should not call browser.tabs.update() for each tab.
      browser.tabs.highlight({
        windowId: tab.apiTab.windowId,
        populate: false,
        tabs:     Array.from(highlightedTabIds).map(apiTabId => Tabs.getTabById(apiTabId).apiTab.index)
      });
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
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
      let highlightedCount = Tabs.getSelectedTabs(tab).length;
      let partiallyHighlighted = false;
      if (Tabs.isSubtreeCollapsed(activeTab)) {
        const descendants = Tabs.getDescendantTabs(activeTab);
        const highlightedDescendants = descendants.filter(Tabs.isHighlighted);
        partiallyHighlighted = (tab != activeTab && highlightedDescendants.length == 0) || (highlightedDescendants.length != descendants.length);
        const highlighted = (tab != activeTab) || partiallyHighlighted || !Tabs.isHighlighted(descendants[0]);
        if (tab == activeTab ||
            partiallyHighlighted) {
          for (const descendant of descendants) {
            if (highlighted)
              highlightedCount++;
            else
              highlightedCount--;
            if (highlighted)
              highlightedTabIds.add(descendant.apiTab.id);
            else
              highlightedTabIds.delete(descendant.apiTab.id);
          }
        }
      }
      if (tab != activeTab ||
          /* don't unhighlight only one highlighted active tab! */
          (!partiallyHighlighted && highlightedCount > 1)) {
        if (!Tabs.isHighlighted(tab))
          highlightedTabIds.add(tab.apiTab.id);
        else
          highlightedTabIds.delete(tab.apiTab.id);
      }
      // for better performance, we should not call browser.tabs.update() for each tab.
      browser.tabs.highlight({
        windowId: tab.apiTab.windowId,
        populate: false,
        tabs:     Array.from(highlightedTabIds).map(apiTabId => Tabs.getTabById(apiTabId).apiTab.index)
      });
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    mLastClickedTabInWindow.set(tab.parentNode, tab);
    return true;
  }
  else {
    mLastClickedTabInWindow.set(tab.parentNode, tab);
    return false;
  }
}
