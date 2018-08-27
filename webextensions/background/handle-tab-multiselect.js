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
      Tabs.isCollapsed(tab))
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
  if (event.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const lastClickedTab   = mLastClickedTabInWindow.get(tab.parentNode) || Tabs.getCurrentTab(tab);
    const betweenTabs      = getTabsBetween(lastClickedTab, tab, tab.parentNode.children);
    const targetTabs       = [lastClickedTab].concat(betweenTabs);
    if (tab != lastClickedTab)
      targetTabs.push(tab);

    try {
      if (!ctrlKeyPressed) {
        const alreadySelectedTabs = Tabs.getSelectedTabs(tab);
        log('clear old selection by shift-click: ', {
          alreadySelectedTabs
        });
        for (const alreadySelectedTab of alreadySelectedTabs) {
          if (!targetTabs.includes(alreadySelectedTab))
            browser.tabs.update(alreadySelectedTab.apiTab.id, { highlighted: false });
        }
      }
      const alreadySelectedTabs = Tabs.getSelectedTabs(tab);
      log('set selection by shift-click: ', {
        targetTabs
      });
      for (const toBeSelectedTab of targetTabs) {
        if (Tabs.isHighlighted(toBeSelectedTab))
          continue;
        browser.tabs.update(toBeSelectedTab.apiTab.id, {
          highlighted: true,
          active:      Tabs.isActive(toBeSelectedTab)
        });
      }
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    return true;
  }
  else if (ctrlKeyPressed) {
    // toggle selection of the tab and all collapsed descendants
    try {
      log('change selection by ctrl-click: ', tab);
      browser.tabs.update(tab.apiTab.id, {
        highlighted: !Tabs.isHighlighted(tab),
        active:      Tabs.isActive(tab)
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
