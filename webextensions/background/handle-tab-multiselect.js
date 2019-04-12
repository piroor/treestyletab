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
} from '/common/common.js';

import * as ApiTabs from '/common/api-tabs.js';

import Tab from '/common/Tab.js';

function log(...args) {
  internalLogger('background/handle-tab-multiselect', ...args);
}

Tab.onUpdated.addListener((tab, info, options = {}) => {
  if (!('highlighted' in info) ||
      !tab.$TST.subtreeCollapsed ||
      tab.$TST.collapsed ||
      !tab.$TST.multiselected ||
      options.inheritHighlighted === false)
    return;

  const collapsedDescendants = tab.$TST.descendants;
  log('inherit highlighted state from root visible tab: ', {
    highlighted: info.highlighted,
    collapsedDescendants
  });
  for (const descendant of collapsedDescendants) {
    browser.tabs.update(descendant.id, {
      highlighted: info.highlighted,
      active:      descendant.active
    }).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
  }
});

const mLastClickedTabInWindow = new Map();
const mIsInSelectionSession   = new Map();

export async function updateSelectionByTabClick(tab, event) {
  const ctrlKeyPressed     = event.ctrlKey || (event.metaKey && /^Mac/i.test(navigator.platform));
  const activeTab          = Tab.getActiveTab(tab.windowId);
  const highlightedTabIds  = new Set(Tab.getHighlightedTabs(tab.windowId).map(tab => tab.id));
  const inSelectionSession = mIsInSelectionSession.get(tab.windowId);
  if (event.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const lastClickedTab   = mLastClickedTabInWindow.get(tab.windowId) || activeTab;
    const betweenTabs      = Tab.getTabsBetween(lastClickedTab, tab);
    const targetTabs       = new Set([lastClickedTab].concat(betweenTabs));
    targetTabs.add(tab);

    log(' => ', { lastClickedTab, betweenTabs, targetTabs });

    try {
      if (!ctrlKeyPressed) {
        const alreadySelectedTabs = Tab.getSelectedTabs(tab.windowId, { iterator: true });
        log('clear old selection by shift-click: ', configs.debug && Array.from(alreadySelectedTabs, dumpTab));
        for (const alreadySelectedTab of alreadySelectedTabs) {
          if (!targetTabs.has(alreadySelectedTab))
            highlightedTabIds.delete(alreadySelectedTab.id);
        }
      }

      log('set selection by shift-click: ', configs.debug && Array.from(targetTabs, dumpTab));
      for (const toBeSelectedTab of targetTabs) {
        highlightedTabIds.add(toBeSelectedTab.id);
      }

      const rootTabs = [tab];
      if (tab != activeTab &&
          !inSelectionSession)
        rootTabs.push(activeTab);
      for (const root of rootTabs) {
        if (!root.$TST.subtreeCollapsed)
          continue;
        for (const descendant of root.$TST.descendants) {
          highlightedTabIds.add(descendant.id);
        }
      }

      // for better performance, we should not call browser.tabs.update() for each tab.
      const indices = Array.from(highlightedTabIds)
        .filter(id => id != activeTab.id)
        .map(id => Tab.get(id).index);
      if (highlightedTabIds.has(activeTab.id))
        indices.unshift(activeTab.index);
      browser.tabs.highlight({
        windowId: tab.windowId,
        populate: false,
        tabs:     indices
      }).catch(ApiTabs.createErrorSuppressor());
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    mIsInSelectionSession.set(tab.windowId, true);
    return true;
  }
  else if (ctrlKeyPressed) {
    try {
      log('change selection by ctrl-click: ', dumpTab(tab));
      /* Special operation to toggle selection of collapsed descendants for the active tab.
         - When there is no other multiselected foreign tab
           => toggle multiselection only descendants.
         - When there is one or more multiselected foreign tab
           => toggle multiselection of the active tab and descendants.
              => one of multiselected foreign tabs will be activated.
         - When a foreign tab is highlighted and there is one or more unhighlighted descendants 
           => highlight all descendants (to prevent only the root tab is dragged).
       */
      const activeTabDescendants = activeTab.$TST.descendants;
      let toBeHighlighted = !tab.highlighted;
      log('toBeHighlighted: ', toBeHighlighted);
      if (tab == activeTab &&
          tab.$TST.subtreeCollapsed &&
          activeTabDescendants.length > 0) {
        const highlightedCount  = activeTabDescendants.filter(tab => tab.highlighted).length;
        const partiallySelected = highlightedCount != 0 && highlightedCount != activeTabDescendants.length;
        toBeHighlighted = partiallySelected || !activeTabDescendants[0].highlighted;
        log(' => ', toBeHighlighted, { partiallySelected });
      }
      if (toBeHighlighted)
        highlightedTabIds.add(tab.id);
      else
        highlightedTabIds.delete(tab.id);

      if (tab.$TST.subtreeCollapsed) {
        const descendants = tab == activeTab ? activeTabDescendants : tab.$TST.descendants;
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
        if (activeTab.$TST.subtreeCollapsed) {
          for (const descendant of activeTabDescendants) {
            highlightedTabIds.add(descendant.id);
          }
        }
      }

      // for better performance, we should not call browser.tabs.update() for each tab.
      const indices = Array.from(highlightedTabIds)
        .filter(id => id != activeTab.id)
        .map(id => Tab.get(id).index);
      if (highlightedTabIds.has(activeTab.id))
        indices.unshift(activeTab.index);
      browser.tabs.highlight({
        windowId: tab.windowId,
        populate: false,
        tabs:     indices
      }).catch(ApiTabs.createErrorSuppressor());
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
