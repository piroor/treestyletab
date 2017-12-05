/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

async function getWindowSignature(aWindowIdOrTabs) {
  if (typeof aWindowIdOrTabs == 'number') {
    aWindowIdOrTabs = await browser.tabs.query({ windowId: aWindowIdOrTabs });
  }
  var uniqueIds = await getUniqueIds(aWindowIdOrTabs);
  return uniqueIds.join('\n');
}

async function getUniqueIds(aApiTabs) {
  var uniqueIds = await Promise.all(aApiTabs.map(aApiTab => browser.sessions.getTabValue(aApiTab.id, kPERSISTENT_ID)));
  return uniqueIds.map(aId => aId && aId.id || '?');
}

function restoreCachedTabs(aTabs, aApiTabs, aOptions = {}) {
  var idMap = {};
  getAllTabs().forEach((aTab, aIndex) => {
    var oldId = aTab.id;
    var apiTab = aApiTabs[aIndex];
    aTab.id = makeTabId(apiTab);
    aTab.setAttribute(kAPI_TAB_ID, apiTab.id || -1);
    aTab.setAttribute(kAPI_WINDOW_ID, apiTab.windowId || -1);
    idMap[oldId] = aTab.id;
  });
  aTabs.forEach((aTab, aIndex) => {
    restoreCachedTab(aTab, aApiTabs[aIndex], {
      idMap: idMap,
      dirty: aOptions.dirty
    });
  });
}

function restoreCachedTab(aTab, aApiTab, aOptions = {}) {
  aTab.apiTab = aApiTab;
  updateUniqueId(aTab);
  aTab.opened = Promise.resolve(true);
  aTab.closedWhileActive = new Promise((aResolve, aReject) => {
    aTab._resolveClosedWhileActive = aResolve;
  });

  var idMap = aOptions.idMap;

  aTab.childTabs = (aTab.getAttribute(kCHILDREN) || '')
    .split('|')
    .map(aOldId => getTabById(idMap[aOldId]))
    .filter(aTab => !!aTab);
  if (aTab.childTabs.length > 0)
    aTab.setAttribute(kCHILDREN, `|${aTab.childTabs.map(aTab => aTab.id).join('|')}|`);

  aTab.parentTab = getTabById(idMap[aTab.getAttribute(kPARENT)]);
  if (aTab.parentTab)
    aTab.setAttribute(kPARENT, aTab.parentTab.id);

  if (aOptions.dirty) {
    updateTab(aTab, aTab.apiTab, { forceApply: true });
    if (aTab.apiTab.active)
      updateTabFocused(aTab);
  }
}
