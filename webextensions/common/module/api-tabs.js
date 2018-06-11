/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// Defined in a classic script source, and we can read these as global variables. 
/* global
  Promise: false,
 */

export async function getIndex(...aQueriedTabIds) {
  if (aQueriedTabIds.length == 0)
    return -1;

  let indexes = await Promise.all(aQueriedTabIds.map((aTabId) => {
    return browser.tabs.get(aTabId)
      .catch(e => {
        handleMissingTabError(e);
        return -1;
      });
  }));
  indexes = indexes.map(aTab => aTab ? aTab.index : -1);
  if (indexes.length == 1)
    return indexes[0];
  else
    return indexes;
}

// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1394477
export async function safeMoveAcrossWindows(aTabIds, aMoveOptions) {
  return (await Promise.all(aTabIds.map(async (aTabId, aIndex) => {
    try {
      let movedTab = await browser.tabs.move(aTabId, Object.assign({}, aMoveOptions, {
        index: aMoveOptions.index + aIndex
      }));
      if (Array.isArray(movedTab))
        movedTab = movedTab[0];
      return movedTab;
    }
    catch(e) {
      handleMissingTabError(e);
      return null;
    }
  }))).filter(aTab => !!aTab);
}

export function handleMissingTabError(aError) {
  if (!aError ||
      !aError.message ||
      aError.message.indexOf('Invalid tab ID:') != 0)
    throw aError;
  // otherwise, this error is caused from a tab already closed.
  // we just ignore it.
  //console.log('Invalid Tab ID error on: ' + aError.stack);
}
