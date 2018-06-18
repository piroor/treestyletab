/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// internal operations means operations bypassing WebExtensions' tabs APIs.

import {
  log as internalLogger,
  dumpTab,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as Tabs from './tabs.js';
import * as TabsContainer from './tabs-container.js';

function log(...args) {
  if (configs.logFor['common/tabs-internal-operation'])
    internalLogger(...args);
}

export async function selectTab(tab, options = {}) {
  log('selectTabInternally: ', dumpTab(tab));
  if (options.inRemote) {
    await browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_SELECT_TAB_INTERNALLY,
      windowId: tab.apiTab.windowId,
      tab:      tab.id,
      options:  options
    });
    return;
  }
  const container = tab.parentNode;
  TabsContainer.incrementCounter(container, 'internalFocusCount');
  if (options.silently)
    TabsContainer.incrementCounter(container, 'internalSilentlyFocusCount');
  return browser.tabs.update(tab.apiTab.id, { active: true })
    .catch(e => {
      TabsContainer.decrementCounter(container, 'internalFocusCount');
      if (options.silently)
        TabsContainer.decrementCounter(container, 'internalSilentlyFocusCount');
      ApiTabs.handleMissingTabError(e);
    });
}

export function removeTab(tab, options = {}) {
  return removeTabs([tab], options);
}

export function removeTabs(tabs, options = {}) {
  tabs = tabs.filter(Tabs.ensureLivingTab);
  if (!tabs.length)
    return;
  log('removeTabsInternally: ', tabs.map(dumpTab));
  if (options.inRemote || options.broadcast) {
    browser.runtime.sendMessage({
      type:    Constants.kCOMMAND_REMOVE_TABS_INTERNALLY,
      tabs:    tabs.map(tab => tab.id),
      options: Object.assign({}, options, {
        inRemote:    false,
        broadcast:   options.inRemote && !options.broadcast,
        broadcasted: !!options.broadcast
      })
    });
    if (options.inRemote)
      return;
  }
  const container = tabs[0].parentNode;
  TabsContainer.incrementCounter(container, 'internalClosingCount', tabs.length);
  if (options.broadcasted)
    return;
  return browser.tabs.remove(tabs.map(tab => tab.apiTab.id)).catch(ApiTabs.handleMissingTabError);
}

export function setTabFocused(tab) {
  const oldActiveTabs = clearOldActiveStateInWindow(tab.apiTab.windowId);
  tab.classList.add(Constants.kTAB_STATE_ACTIVE);
  tab.apiTab.active = true;
  tab.classList.remove(Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
  tab.classList.remove(Constants.kTAB_STATE_UNREAD);
  browser.sessions.removeTabValue(tab.apiTab.id, Constants.kTAB_STATE_UNREAD);
  return oldActiveTabs;
}

export function clearOldActiveStateInWindow(windowId) {
  const container = Tabs.getTabsContainer(windowId);
  if (!container)
    return [];
  const oldTabs = container.querySelectorAll(`.${Constants.kTAB_STATE_ACTIVE}`);
  for (const oldTab of oldTabs) {
    oldTab.classList.remove(Constants.kTAB_STATE_ACTIVE);
    if (oldTab.apiTab) // this function can be applied for cached tab.
      oldTab.apiTab.active = false;
  }
  return oldTabs;
}
