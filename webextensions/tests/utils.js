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
//import * as Tree from '/common/tree.js';
import Tab from '/common/Tab.js';

export async function createTab(params = {}) {
  return browser.tabs.create(params);
}

export async function createTabs(definitions, commonParams = {}) {
  const oldAutoGroupNewTabs = configs.autoGroupNewTabs;
  if (oldAutoGroupNewTabs)
    await setConfigs({ autoGroupNewTabs: false });

  let tabs;
  if (Array.isArray(definitions)) {
    tabs = Promise.all(definitions.map((definition, index) => {
      if (!definition.url)
        definition.url = `about:blank?${index}`;
      const params = Object.assign({}, commonParams, definition);
      return createTab(params);
    }));
  }

  if (typeof definitions == 'object') {
    tabs = {};
    for (const name of Object.keys(definitions)) {
      const definition = definitions[name];
      if (definition.openerTabId in tabs)
        definition.openerTabId = tabs[definition.openerTabId].id;
      if (!definition.url)
        definition.url = `about:blank?${name}`;
      const params = Object.assign({}, commonParams, definition);
      tabs[name] = await createTab(params);
    }
  }

  if (!tabs)
    throw new Error('Invalid tab definitions: ', definitions);

  if (oldAutoGroupNewTabs)
    await setConfigs({ autoGroupNewTabs: oldAutoGroupNewTabs });

  return tabs;
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
    else if (tab.$TST && tab.$TST.parentId && tab.$TST.parentId != tab.id)
      return `${outputNestedRelation(tabsById[tab.$TST.parentId])} => ${tab.id}`;
    return `${tab.id}`;
  };
  return tabs.map(outputNestedRelation);
}

export async function tabsOrder(tabs) {
  if (Array.isArray(tabs)) {
    tabs = await browser.runtime.sendMessage({
      type:   Constants.kCOMMAND_PULL_TABS,
      tabIds: tabs.map(tab => tab.id || tab)
    });
    return Tab.sort(tabs).map(tab => tab.id);
  }

  if (typeof tabs == 'object') {
    const refreshedTabsArray = await browser.runtime.sendMessage({
      type:   Constants.kCOMMAND_PULL_TABS,
      tabIds: Object.values(tabs).map(tab => tab.id)
    });
    return Tab.sort(refreshedTabsArray).map(tab => tab.id);
  }

  throw new Error('Invalid tab collection: ', tabs);
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
