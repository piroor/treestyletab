/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from './common.js';
import * as Constants from './constants.js';
import * as Tabs from './tabs.js';
import * as TabsMove from './tabs-move.js';
import * as TabsOpen from './tabs-open.js';
import * as Tree from './tree.js';

function log(...args) {
  internalLogger('common/tabs-group', ...args);
}

export function makeGroupTabURI(options = {}) {
  const base = Constants.kGROUP_TAB_URI;
  const title = encodeURIComponent(options.title || '');
  const temporaryOption = options.temporary ? '&temporary=true' : '' ;
  const openerTabIdOption = options.openerTabId ? `&openerTabId=${options.openerTabId}` : '' ;
  return `${base}?title=${title}${temporaryOption}${openerTabIdOption}`;
}

export async function groupTabs(tabs, options = {}) {
  const rootTabs = Tabs.collectRootTabs(tabs);
  if (rootTabs.length <= 0)
    return null;

  log('groupTabs: ', tabs.map(tab => tab.id));

  const uri = makeGroupTabURI({
    title:     browser.i18n.getMessage('groupTab_label', rootTabs[0].title),
    temporary: true
  });
  const groupTab = (await TabsOpen.openURIInTab(uri, {
    windowId:     rootTabs[0].windowId,
    parent:       Tabs.getParentTab(rootTabs[0], { element: true }),
    insertBefore: rootTabs[0].$TST.element,
    inBackground: true
  })).apiTab;

  await Tree.detachTabsFromTree(tabs.map(tab => tab.$TST.element), {
    broadcast: !!options.broadcast
  });
  await TabsMove.moveTabsAfter(tabs.slice(1), tabs[0], {
    broadcast: !!options.broadcast
  });
  for (const tab of rootTabs) {
    await Tree.attachTabTo(tab.$TST.element, groupTab.$TST.element, {
      forceExpand: true, // this is required to avoid the group tab itself is active from active tab in collapsed tree
      dontMove:  true,
      broadcast: !!options.broadcast
    });
  }
  return groupTab;
}
