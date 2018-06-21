/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from './common.js';

function log(...args) {
  if (configs.logFor['common/api-tabs'])
    internalLogger(...args);
}

export async function getIndexes(...queriedTabIds) {
  log('getIndexes ', queriedTabIds);
  if (queriedTabIds.length == 0)
    return [];

  const indexes = await Promise.all(queriedTabIds.map((tabId) => {
    return browser.tabs.get(tabId)
      .catch(e => {
        handleMissingTabError(e);
        return -1;
      });
  }));
  return indexes.map(tab => tab ? tab.index : -1);
}

// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1394477
export async function safeMoveAcrossWindows(tabIds, moveOptions) {
  log('safeMoveAcrossWindows ', tabIds, moveOptions);
  return (await Promise.all(tabIds.map(async (tabId, index) => {
    try {
      let movedTab = await browser.tabs.move(tabId, Object.assign({}, moveOptions, {
        index: moveOptions.index + index
      }));
      log(`safeMoveAcrossWindows: movedTab[${index}] = `, movedTab);
      if (Array.isArray(movedTab))
        movedTab = movedTab[0];
      return movedTab;
    }
    catch(e) {
      handleMissingTabError(e);
      return null;
    }
  }))).filter(tab => !!tab);
}

export function handleMissingTabError(error) {
  if (!error ||
      !error.message ||
      error.message.indexOf('Invalid tab ID:') != 0)
    throw error;
  // otherwise, this error is caused from a tab already closed.
  // we just ignore it.
  //console.log('Invalid Tab ID error on: ' + error.stack);
}
