/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as TabsMove from '/common/tabs-move.js';
import * as TabsOpen from '/common/tabs-open.js';
import * as Tree from '/common/tree.js';

import Tab from '/common/Tab.js';

function log(...args) {
  internalLogger('background/tabs-group', ...args);
}

export function makeGroupTabURI(options = {}) {
  const base = Constants.kGROUP_TAB_URI;
  const title = encodeURIComponent(options.title || '');
  const temporaryOption = options.temporary ? '&temporary=true' : '' ;
  const openerTabIdOption = options.openerTabId ? `&openerTabId=${options.openerTabId}` : '' ;
  return `${base}?title=${title}${temporaryOption}${openerTabIdOption}`;
}

export async function groupTabs(tabs, options = {}) {
  const rootTabs = Tab.collectRootTabs(tabs);
  if (rootTabs.length <= 0)
    return null;

  log('groupTabs: ', tabs.map(dumpTab));

  const uri = makeGroupTabURI({
    title:     browser.i18n.getMessage('groupTab_label', rootTabs[0].title),
    temporary: true
  });
  const groupTab = await TabsOpen.openURIInTab(uri, {
    windowId:     rootTabs[0].windowId,
    parent:       rootTabs[0].$TST.parent,
    insertBefore: rootTabs[0],
    inBackground: true
  });

  await Tree.detachTabsFromTree(tabs, {
    broadcast: !!options.broadcast
  });
  await TabsMove.moveTabsAfter(tabs.slice(1), tabs[0], {
    broadcast: !!options.broadcast
  });
  for (const tab of rootTabs) {
    await Tree.attachTabTo(tab, groupTab, {
      forceExpand: true, // this is required to avoid the group tab itself is active from active tab in collapsed tree
      dontMove:  true,
      broadcast: !!options.broadcast
    });
  }
  return groupTab;
}
