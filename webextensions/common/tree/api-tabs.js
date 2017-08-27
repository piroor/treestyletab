/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

function makeTabId(aApiTab) {
  return `tab-${aApiTab.windowId}-${aApiTab.id}`;
}

async function getApiTabIndex(...aQueriedTabIds) {
  if (aQueriedTabIds.length == 0)
    return -1;

  var indexes = await Promise.all(aQueriedTabIds.map((aTabId) => {
    return browser.tabs.get(aTabId);
  }));
  indexes = indexes.map(aTab => aTab ? aTab.index : -1);
  if (indexes.length == 1)
    return indexes[0];
  else
    return indexes;
}

// workaround: browser.tabs.move accepts multiple tabs as the input
// but sometimes they are moved with mixed positions if they are
// moved across windows...
async function safeMoveApiTabsAcrossWindows(aTabIds, aMoveOptions) {
  return await Promise.all(aTabIds.map(async (aTabId, aIndex) => {
    var movedTab = await browser.tabs.move(aTabId, clone(aMoveOptions, {
      index: aMoveOptions.index + aIndex
    }));
    if (Array.isArray(movedTab))
      movedTab = movedTab[0];
    return movedTab;
  }));
}

function handleMissingTabError(aError) {
  if (!aError ||
      !aError.message ||
      aError.message.indexOf('Invalid tab ID:') != 0)
    throw aError;
  // otherwise, this error is caused from a tab already closed.
  // we just ignore it.
}
