/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// Defined in a classic script source, and we can read these as global variables. 
/* global
  attachTabTo: false,
  detachTabsFromTree: false,
 */

import {
  log,
  dumpTab
} from './common.js';
import * as Constants from './constants.js';
import * as Tabs from './tabs.js';
import * as TabsMove from './tabs-move.js';
import * as TabsOpen from './tabs-open.js';

export function makeGroupTabURI(aOptions = {}) {
  const base = Constants.kGROUP_TAB_URI;
  const title = encodeURIComponent(aOptions.title || '');
  const temporaryOption = aOptions.temporary ? '&temporary=true' : '' ;
  const openerTabIdOption = aOptions.openerTabId ? `&openerTabId=${aOptions.openerTabId}` : '' ;
  return `${base}?title=${title}${temporaryOption}${openerTabIdOption}`;
}

export async function groupTabs(aTabs, aOptions = {}) {
  const rootTabs = Tabs.collectRootTabs(aTabs);
  if (rootTabs.length <= 0)
    return null;

  log('groupTabs: ', aTabs.map(dumpTab));

  const uri = makeGroupTabURI({
    title:     browser.i18n.getMessage('groupTab_label', rootTabs[0].apiTab.title),
    temporary: true
  });
  const groupTab = await TabsOpen.openURIInTab(uri, {
    windowId:     rootTabs[0].apiTab.windowId,
    parent:       Tabs.getParentTab(rootTabs[0]),
    insertBefore: rootTabs[0],
    inBackground: true
  });

  await detachTabsFromTree(aTabs, {
    broadcast: !!aOptions.broadcast
  });
  await TabsMove.moveTabsAfter(aTabs.slice(1), aTabs[0], {
    broadcast: !!aOptions.broadcast
  });
  for (let tab of rootTabs) {
    await attachTabTo(tab, groupTab, {
      forceExpand: true, // this is required to avoid the group tab itself is focused from active tab in collapsed tree
      dontMove:  true,
      broadcast: !!aOptions.broadcast
    });
  }
  return groupTab;
}
