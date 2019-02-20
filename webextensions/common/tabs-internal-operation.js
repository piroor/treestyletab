/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// internal operations means operations bypassing WebExtensions' tabs APIs.

import {
  log as internalLogger,
  configs,
  dumpTab
} from './common.js';
import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as Tabs from './tabs.js';

function log(...args) {
  internalLogger('common/tabs-internal-operation', ...args);
}

export async function activateTab(tab, options = {}) {
  tab = Tabs.ensureLivingTab(tab);
  if (!tab)
    return;
  log('activateTabInternally: ', dumpTab(tab), tab.apiTab);
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
  container.internalFocusCount++;
  if (options.silently)
    container.internalSilentlyFocusCount++;
  const onError = (e) => {
    container.internalFocusCount--;
    if (options.silently)
      container.internalSilentlyFocusCount--;
    ApiTabs.handleMissingTabError(e);
  };
  if (configs.supportTabsMultiselect) {
    let tabs = [tab.apiTab.index];
    const highlightedTabs = Tabs.getHighlightedTabs(tab);
    if (Tabs.isMultihighlighted(tab) &&
        options.keepMultiselection &&
        highlightedTabs.includes(tab)) {
      // switch active tab with highlighted state
      const otherTabs = highlightedTabs.filter(highlightedTab => highlightedTab != tab);
      tabs = tabs.concat(otherTabs.map(tab => tab.apiTab.index));
    }
    else {
      tab.parentNode.tabsToBeHighlightedAlone.add(tab.apiTab.id);
    }
    return browser.tabs.highlight({
      windowId: tab.apiTab.windowId,
      tabs,
      populate: false
    }).catch(onError);
  }
  else {
    return browser.tabs.update(tab.apiTab.id, { active: true }).catch(onError);
  }
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
  for (const tab of tabs) {
    container.internalClosingTabs.add(tab.apiTab.id);
  }
  if (options.broadcasted)
    return;
  return browser.tabs.remove(tabs.map(tab => tab.apiTab.id)).catch(ApiTabs.handleMissingTabError);
}

export function setTabActive(tab) {
  tab = Tabs.ensureLivingTab(tab);
  if (!tab)
    return [];
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
