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

  const highlightIndices = Tabs.getSelectedTabs(tab)
    .filter(tab => !Tabs.isActive(tab))
    .map(tab => tab.apiTab.index);
  const activeIndex = Tabs.getCurrentTab(tab).apiTab.index;
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
  highlightIndices.sort().reverse();
  highlightIndices.unshift(activeIndex);
  log('onUpdated[highlighted] ', {
    highlighted: info.highlighted,
    highlightIndices
  });
  browser.tabs.highlight({
    tabs: highlightIndices
  });
});
