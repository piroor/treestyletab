/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  wait,
  nextFrame,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import Tab from '/common/Tab.js';

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
  if (Array.isArray(tabs)) {
    tabs = await browser.runtime.sendMessage({
      type:   Constants.kCOMMAND_PULL_TABS,
      tabIds: tabs.map(tab => tab.id)
    });
    return tabs.map(tab => Tab.import(tab));
  }

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
      refreshedTabs[idToName[tab.id]] = Tab.import(tab);
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

export async function setConfigs(values) {
  for (const key of Object.keys(values)) {
    configs[key] = values[key];
  }
  // wait until updated configs are delivered to other namespaces
  await nextFrame();
}

export async function doAndGetNewTabs(task, queryToFindTabs) {
  await wait(150); // wait until currently opened tabs are completely tracked
  const oldAllTabIds = (await browser.tabs.query(queryToFindTabs)).map(tab => tab.id);
  await task();
  await wait(150); // wait until new tabs are tracked
  const allTabs = await browser.tabs.query(queryToFindTabs);
  return allTabs.filter(tab => !oldAllTabIds.includes(tab.id));
}
