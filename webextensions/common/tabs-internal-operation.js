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
import * as TabsStore from './tabs-store.js';
import * as SidebarConnection from './sidebar-connection.js';

import Tab from '/common/Tab.js';

function log(...args) {
  internalLogger('common/tabs-internal-operation', ...args);
}

export async function activateTab(tab, options = {}) {
  tab = TabsStore.ensureLivingTab(tab);
  if (!tab)
    return;
  log('activateTab: ', dumpTab(tab));
  const window = TabsStore.windows.get(tab.windowId);
  window.internalFocusCount++;
  if (options.silently)
    window.internalSilentlyFocusCount++;
  const onError = (e) => {
    window.internalFocusCount--;
    if (options.silently)
      window.internalSilentlyFocusCount--;
    ApiTabs.handleMissingTabError(e);
  };
  if (configs.supportTabsMultiselect &&
      typeof browser.tabs.highlight == 'function') {
    let tabs = [tab.index];
    if (tab.$TST.hasOtherHighlighted &&
        options.keepMultiselection) {
      const highlightedTabs = Tab.getHighlightedTabs(tab.windowId);
      if (highlightedTabs.some(highlightedTab => highlightedTab.id == tab.id)) {
        // switch active tab with highlighted state
        const otherTabs = highlightedTabs.filter(highlightedTab => highlightedTab.id != tab.id);
        tabs = tabs.concat(otherTabs.map(tab => tab.index));
      }
    }
    if (tabs.length == 1)
      window.tabsToBeHighlightedAlone.add(tab.id);
    return browser.tabs.highlight({
      windowId: tab.windowId,
      tabs,
      populate: false
    }).catch(ApiTabs.createErrorHandler(onError));
  }
  else {
    return browser.tabs.update(tab.id, { active: true }).catch(ApiTabs.createErrorHandler(onError));
  }
}

export function removeTab(tab) {
  return removeTabs([tab]);
}

const cacheKeys = [
  Constants.kWINDOW_STATE_CACHED_TABS,
  Constants.kWINDOW_STATE_CACHED_SIDEBAR,
  Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY,
  Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY
];

export function removeTabs(tabs) {
  tabs = tabs.filter(TabsStore.ensureLivingTab);
  if (!tabs.length)
    return;
  log('removeTabsInternally: ', tabs.map(dumpTab));
  if (SidebarConnection.isInitialized()) // in background
    SidebarConnection.sendMessage({
      type:     Constants.kCOMMAND_REMOVE_TABS_INTERNALLY,
      windowId: tabs[0].windowId,
      tabIds:   tabs.map(tab => tab.id)
    });
  const window = TabsStore.windows.get(tabs[0].windowId);
  if (window) {
    const errorHandler = ApiTabs.createErrorSuppressor(ApiTabs.handleMissingTabError);
    for (const tab of tabs) {
      window.internalClosingTabs.add(tab.id);
      for (const key of cacheKeys) {
        browser.sessions.removeTabValue(tab.id, key).catch(errorHandler);
      }
    }
  }
  if (!SidebarConnection.isInitialized()) // in sidebar
    return;
  return browser.tabs.remove(tabs.map(tab => tab.id)).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
}

export function setTabActive(tab) {
  const oldActiveTabs = clearOldActiveStateInWindow(tab.windowId, tab);
  tab.$TST.addState(Constants.kTAB_STATE_ACTIVE);
  tab.active = true;
  tab.$TST.removeState(Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
  tab.$TST.removeState(Constants.kTAB_STATE_UNREAD, { permanently: true });
  TabsStore.activeTabsInWindow.get(tab.windowId).add(tab);
  return oldActiveTabs;
}

export function clearOldActiveStateInWindow(windowId, exception) {
  const oldTabs = TabsStore.activeTabsInWindow.get(windowId);
  for (const oldTab of oldTabs) {
    if (oldTab == exception)
      continue;
    oldTab.$TST.removeState(Constants.kTAB_STATE_ACTIVE);
    oldTab.active = false;
  }
  return Array.from(oldTabs);
}


SidebarConnection.onMessage.addListener(async (windowId, message) => {
  switch (message.type) {
    case Constants.kCOMMAND_REMOVE_TABS_INTERNALLY:
      await Tab.waitUntilTracked(message.tabIds);
      removeTabs(message.tabIds.map(id => Tab.get(id)));
      break;
  }
});
