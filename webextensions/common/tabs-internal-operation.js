/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// internal operations means operations bypassing WebExtensions' tabs APIs.

import {
  log as internalLogger,
  configs
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
  log('activateTab: ', tab.id);
  if (options.inRemote) {
    await browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_SELECT_TAB_INTERNALLY,
      windowId: tab.windowId,
      tabId:    tab.id,
      options:  options
    });
    return;
  }
  const window = Tabs.trackedWindows.get(tab.windowId);
  window.internalFocusCount++;
  if (options.silently)
    window.internalSilentlyFocusCount++;
  const onError = (e) => {
    window.internalFocusCount--;
    if (options.silently)
      window.internalSilentlyFocusCount--;
    ApiTabs.handleMissingTabError(e);
  };
  if (configs.supportTabsMultiselect) {
    let tabs = [tab.index];
    const highlightedTabs = Tabs.getHighlightedTabs(tab.windowId);
    if (tab.$TST.hasOtherHighlighted &&
        options.keepMultiselection &&
        highlightedTabs.some(highlightedTab => highlightedTab.id == tab.id)) {
      // switch active tab with highlighted state
      const otherTabs = highlightedTabs.filter(highlightedTab => highlightedTab.id != tab.id);
      tabs = tabs.concat(otherTabs.map(tab => tab.index));
    }
    else {
      window.tabsToBeHighlightedAlone.add(tab.id);
    }
    return browser.tabs.highlight({
      windowId: tab.windowId,
      tabs,
      populate: false
    }).catch(onError);
  }
  else {
    return browser.tabs.update(tab.id, { active: true }).catch(onError);
  }
}

export function removeTab(tab, options = {}) {
  return removeTabs([tab], options);
}

export function removeTabs(tabs, options = {}) {
  tabs = tabs.filter(Tabs.ensureLivingTab);
  if (!tabs.length)
    return;
  log('removeTabsInternally: ', tabs.map(tab => tab.id));
  if (options.inRemote || options.broadcast) {
    browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_REMOVE_TABS_INTERNALLY,
      windowId: tabs[0].windowId,
      tabIds:   tabs.map(tab => tab.id),
      options:  Object.assign({}, options, {
        inRemote:    false,
        broadcast:   options.inRemote && !options.broadcast,
        broadcasted: !!options.broadcast
      })
    });
    if (options.inRemote)
      return;
  }
  const window = Tabs.trackedWindows.get(tabs[0].windowId);
  if (window) {
    for (const tab of tabs) {
      window.internalClosingTabs.add(tab.id);
    }
  }
  if (options.broadcasted)
    return;
  return browser.tabs.remove(tabs.map(tab => tab.id)).catch(ApiTabs.handleMissingTabError);
}

export function setTabActive(tab) {
  const oldActiveTabs = clearOldActiveStateInWindow(tab.windowId);
  tab.$TST.addState(Constants.kTAB_STATE_ACTIVE);
  tab.active = true;
  tab.$TST.removeState(Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
  tab.$TST.removeState(Constants.kTAB_STATE_UNREAD, { permanently: true });
  return oldActiveTabs;
}

export function clearOldActiveStateInWindow(windowId) {
  const oldTabs = Tabs.queryAll({
    windowId,
    active:  true
  });
  for (const oldTab of oldTabs) {
    oldTab.$TST.removeState(Constants.kTAB_STATE_ACTIVE);
    oldTab.active = false;
  }
  return oldTabs;
}
