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
import * as ApiTabs from './api-tabs.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/unique-id', ...args);
}



//===================================================================
// Unique Tab ID
//===================================================================

export async function request(tabOrId, options = {}) {
  if (typeof options != 'object')
    options = {};

  let tab = tabOrId;
  if (typeof tabOrId == 'number')
    tab = Tabs.trackedTabs.get(tabOrId);

  if (options.inRemote) {
    return await browser.runtime.sendMessage({
      type:  Constants.kCOMMAND_REQUEST_UNIQUE_ID,
      tabId: tab.id
    });
  }

  let originalId    = null;
  let originalTabId = null;
  let duplicated    = false;
  if (!options.forceNew) {
    let oldId = await browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_ID);
    if (oldId && !oldId.tabId) // ignore broken information!
      oldId = null;

    if (oldId) {
      // If the tab detected from stored tabId is different, it is duplicated tab.
      try {
        const tabWithOldId = Tabs.trackedTabs.get(oldId.tabId);
        if (!tabWithOldId)
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
        originalId = (tabWithOldId.$TST.uniqueId || await tabWithOldId.$TST.promisedUniqueId).id;
        duplicated = tab && tabWithOldId.id != tab.id && originalId == oldId.id;
        if (duplicated)
          originalTabId = oldId.tabId;
        else
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
      }
      catch(e) {
        ApiTabs.handleMissingTabError(e);
        // It fails if the tab doesn't exist.
        // There is no live tab for the tabId, thus
        // this seems to be a tab restored from session.
        // We need to update the related tab id.
        await browser.sessions.setTabValue(tab.id, Constants.kPERSISTENT_ID, {
          id:    oldId.id,
          tabId: tab.id
        });
        return {
          id:            oldId.id,
          originalId:    null,
          originalTabId: oldId.tabId,
          restored:      true
        };
      }
    }
  }

  const adjective   = Constants.kID_ADJECTIVES[Math.floor(Math.random() * Constants.kID_ADJECTIVES.length)];
  const noun        = Constants.kID_NOUNS[Math.floor(Math.random() * Constants.kID_NOUNS.length)];
  const randomValue = Math.floor(Math.random() * 1000);
  const id          = `tab-${adjective}-${noun}-${Date.now()}-${randomValue}`;
  // tabId is for detecttion of duplicated tabs
  await browser.sessions.setTabValue(tab.id, Constants.kPERSISTENT_ID, { id, tabId: tab.id });
  return { id, originalId, originalTabId, duplicated };
}

export async function getFromTabs(tabs) {
  const uniqueIds = await Promise.all(tabs.map(tab => browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_ID)));
  return uniqueIds.map(id => id && id.id || '?');
}
