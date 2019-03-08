/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from '/common/constants.js';

export async function createTab(params = {}) {
  return browser.tabs.create(params);
}

export async function createTabs(definitions, commonParams = {}) {
  if (Array.isArray(definitions))
    return Promise.all(definitions.map((definition, index) => {
      if (!definition.url)
        definition.url = `about:blank?${index}`;
      createTab(Object.assign({}, commonParams, definition));
    }));

  if (typeof definitions == 'object') {
    const tabs = {};
    for (const name of Object.keys(definitions)) {
      const definition = definitions[name];
      if (definition.openerTabId in tabs)
        definition.openerTabId = tabs[definition.openerTabId].id;
      if (!definition.url)
        definition.url = `about:blank?${name}`;
      tabs[name] = await createTab(Object.assign({}, commonParams, definition));
    }
    return tabs;
  }

  throw new Error('Invalid tab definitions: ', definitions);
}

export async function refreshTabs(tabs) {
  if (Array.isArray(tabs))
    return browser.runtime.sendMessage({
      type:   Constants.kCOMMAND_PULL_TABS,
      tabIds: tabs.map(tab => tab.id)
    });

  if (typeof tabs == 'object') {
    const refreshedTabsArray = await browser.runtime.sendMessage({
      type:   Constants.kCOMMAND_PULL_TABS,
      tabIds: Object.values(tabs).map(tab => tab.id)
    });
    const refreshedTabs = {};
    const idToName = {};
    for (const name of Object.keys(tabs)) {
      idToName[tabs[name].id] = name;
    }
    for (const tab of refreshedTabsArray) {
      refreshedTabs[idToName[tab.id]] = tab;
    }
    return refreshedTabs;
  }

  throw new Error('Invalid tab collection: ', tabs);
}

export function treeStructure(tabs) {
  const tabsById = {};
  for (const tab of tabs) {
    tabsById[tab.id] = tab;
  }
  const outputNestedRelation = (tab) => {
    if (!tab)
      return '?';
    if (tab.openerTabId && tab.openerTabId != tab.id)
      return `${outputNestedRelation(tabsById[tab.openerTabId])} => ${tab.id}`;
    return `${tab.id}`;
  };
  return tabs.map(outputNestedRelation);
}
