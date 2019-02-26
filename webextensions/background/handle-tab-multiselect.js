/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from '/common/common.js';

import * as ApiTabs from '/common/api-tabs.js';
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
    browser.tabs.update(descendant.id, {
      highlighted: info.highlighted,
      active:      Tabs.isActive(descendant)
    }).catch(ApiTabs.handleMissingTabError);
  }
});

function getTabsBetween(begin, end) {
  if (!begin || !Tabs.ensureLivingTab(begin) ||
      !end || !Tabs.ensureLivingTab(end))
    throw new Error('getTabsBetween requires valid two tabs');
  if (begin.windowId != end.windowId)
    throw new Error('getTabsBetween requires two tabs in same window');

  if (begin == end)
    return [];
  if (begin.index > end.index)
    [begin, end] = [end, begin];
  return Tabs.queryAll({
    windowId: begin.windowId,
    id:       (id => id != begin.id && id != end.id),
    fromId:   begin.id,
    toId:     end.id,
    element:  false
  });
}

const mLastClickedTabInWindow = new Map();
const mIsInSelectionSession   = new Map();

export async function updateSelectionByTabClick(tab, event) {
  const ctrlKeyPressed     = event.ctrlKey || (event.metaKey && /^Mac/i.test(navigator.platform));
  const activeTab          = Tabs.getActiveTab(tab.windowId, { element: false });
  const highlightedTabIds  = new Set(Tabs.getHighlightedTabs(tab.windowId, { element: false }).map(tab => tab.id));
  const inSelectionSession = mIsInSelectionSession.get(tab.windowId);
  if (event.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const lastClickedTab   = mLastClickedTabInWindow.get(tab.windowId) || activeTab;
    const betweenTabs      = getTabsBetween(lastClickedTab, tab);
    const targetTabs       = [lastClickedTab].concat(betweenTabs);
    if (tab != lastClickedTab)
      targetTabs.push(tab);

    try {
      if (!ctrlKeyPressed) {
        const alreadySelectedTabs = Tabs.getSelectedTabs(tab.windowId, { element: false });
        log('clear old selection by shift-click: ', alreadySelectedTabs);
        for (const alreadySelectedTab of alreadySelectedTabs) {
          if (!targetTabs.includes(alreadySelectedTab))
            highlightedTabIds.delete(alreadySelectedTab.id);
        }
      }

      log('set selection by shift-click: ', targetTabs);
      for (const toBeSelectedTab of targetTabs) {
        highlightedTabIds.add(toBeSelectedTab.id);
      }

      const rootTabs = [tab];
      if (tab != activeTab &&
          !inSelectionSession)
        rootTabs.push(activeTab);
      for (const root of rootTabs) {
        if (!Tabs.isSubtreeCollapsed(root))
          continue;
        for (const descendant of Tabs.getDescendantTabs(root)) {
          highlightedTabIds.add(descendant.id);
        }
      }

      // for better performance, we should not call browser.tabs.update() for each tab.
      const indices = Array.from(highlightedTabIds)
        .filter(id => id != activeTab.id)
        .map(id => Tabs.trackedTabs.get(id).index);
      if (highlightedTabIds.has(activeTab.id))
        indices.unshift(activeTab.index);
      browser.tabs.highlight({
        windowId: tab.windowId,
        populate: false,
        tabs:     indices
      });
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    mIsInSelectionSession.set(tab.windowId, true);
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
        highlightedTabIds.add(tab.id);
      else
        highlightedTabIds.delete(tab.id);

      if (Tabs.isSubtreeCollapsed(tab)) {
        const descendants = tab == activeTab ? activeTabDescendants : Tabs.getDescendantTabs(tab);
        for (const descendant of descendants) {
          if (toBeHighlighted)
            highlightedTabIds.add(descendant.id);
          else
            highlightedTabIds.delete(descendant.id);
        }
      }

      if (tab == activeTab) {
        if (highlightedTabIds.size == 0) {
          log('Don\'t unhighlight only one highlighted active tab!');
          highlightedTabIds.add(tab.id);
        }
      }
      else if (!inSelectionSession) {
        log('Select active tab and its descendants, for new selection session');
        highlightedTabIds.add(activeTab.id);
        if (Tabs.isSubtreeCollapsed(activeTab)) {
          for (const descendant of activeTabDescendants) {
            highlightedTabIds.add(descendant.id);
          }
        }
      }

      // for better performance, we should not call browser.tabs.update() for each tab.
      const indices = Array.from(highlightedTabIds)
        .filter(id => id != activeTab.id)
        .map(id => Tabs.trackedTabs.get(id).index);
      if (highlightedTabIds.has(activeTab.id))
        indices.unshift(activeTab.index);
      browser.tabs.highlight({
        windowId: tab.windowId,
        populate: false,
        tabs:     indices
      });
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    mLastClickedTabInWindow.set(tab.windowId, tab);
    mIsInSelectionSession.set(tab.windowId, true);
    return true;
  }
  else {
    mLastClickedTabInWindow.set(tab.windowId, tab);
    mIsInSelectionSession.delete(tab.windowId);
    return false;
  }
}
