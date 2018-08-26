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
      !Tabs.isSubtreeCollapsed(tab))
    return;

  const highlightIndices = getCurrentSelectedIndices(tab);
  const treeTabs = Tabs.getDescendantTabs(tab).concat([tab]);
  if (info.highlighted) {
    for (const tab of treeTabs) {
      if (!highlightIndices.includes(tab.apiTab.index))
        highlightIndices.push(tab.apiTab.index);
    }
  }
  else {
    for (const tab of treeTabs) {
      const index = highlightIndices.indexOf(tab.apiTab.index);
      if (index)
        highlightIndices.splice(index, 1);
    }
  }
  log('onUpdated[highlighted] ', {
    highlighted: info.highlighted,
    highlightIndices
  });
  browser.tabs.highlight({
    tabs: highlightIndices
  });
});

function getCurrentSelectedIndices(hint) {
  const highlightIndices = Tabs.getSelectedTabs(hint)
    .filter(tab => !Tabs.isActive(tab))
    .map(tab => tab.apiTab.index);
  const activeIndex = Tabs.getCurrentTab(hint).apiTab.index;
  highlightIndices.unshift(activeIndex);
  return highlightIndices;
}

const mLastClickedTabInWindow = new WeakMap();

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

export async function updateSelectionByTabClick(tab, event) {
  const ctrlKeyPressed = event.ctrlKey || (event.metaKey && /^Mac/i.test(navigator.platform));
  if (event.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const lastClickedTab   = mLastClickedTabInWindow.get(tab.parentNode) || Tabs.getCurrentTab(tab);
    const betweenTabs      = getTabsBetween(lastClickedTab, tab, tab.parentNode.children);
    const targetTabIndices = [lastClickedTab].concat(betweenTabs).map(tab => tab.apiTab.index);
    if (tab != lastClickedTab)
      targetTabIndices.push(tab.apiTab.index);

    let indices = getCurrentSelectedIndices();
    if (!ctrlKeyPressed)
      indices = indices.filter(index => targetTabIndices.includes(index));
    indices = indices.concat(targetTabIndices.filter(index => !indices.includes(index)));
    try {
    browser.tabs.highlight({ tabs: indices });
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    return true;
  }
  else if (ctrlKeyPressed) {
    // toggle selection of the tab and all collapsed descendants
    const indices = getCurrentSelectedIndices();
    if (Tabs.isHighlighted(tab))
      indices.splice(indices.indexOf(tab.apiTab.index), 1);
    else
      indices.push(tab.apiTab.index);
    try {
    browser.tabs.highlight({ tabs: indices });
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
