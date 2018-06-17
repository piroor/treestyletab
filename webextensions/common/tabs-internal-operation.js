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

function log(...aArgs) {
  if (configs.logFor['common/tabs-internal-operation'])
    internalLogger(...aArgs);
}

export async function selectTab(aTab, aOptions = {}) {
  log('selectTabInternally: ', dumpTab(aTab));
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_SELECT_TAB_INTERNALLY,
      windowId: aTab.apiTab.windowId,
      tab:      aTab.id,
      options:  aOptions
    });
    return;
  }
  const container = aTab.parentNode;
  TabsContainer.incrementCounter(container, 'internalFocusCount');
  if (aOptions.silently)
    TabsContainer.incrementCounter(container, 'internalSilentlyFocusCount');
  return browser.tabs.update(aTab.apiTab.id, { active: true })
    .catch(e => {
      TabsContainer.decrementCounter(container, 'internalFocusCount');
      if (aOptions.silently)
        TabsContainer.decrementCounter(container, 'internalSilentlyFocusCount');
      ApiTabs.handleMissingTabError(e);
    });
}

export function removeTab(aTab, aOptions = {}) {
  return removeTabs([aTab], aOptions);
}

export function removeTabs(aTabs, aOptions = {}) {
  aTabs = aTabs.filter(Tabs.ensureLivingTab);
  if (!aTabs.length)
    return;
  log('removeTabsInternally: ', aTabs.map(dumpTab));
  if (aOptions.inRemote || aOptions.broadcast) {
    browser.runtime.sendMessage({
      type:    Constants.kCOMMAND_REMOVE_TABS_INTERNALLY,
      tabs:    aTabs.map(aTab => aTab.id),
      options: Object.assign({}, aOptions, {
        inRemote:    false,
        broadcast:   aOptions.inRemote && !aOptions.broadcast,
        broadcasted: !!aOptions.broadcast
      })
    });
    if (aOptions.inRemote)
      return;
  }
  const container = aTabs[0].parentNode;
  TabsContainer.incrementCounter(container, 'internalClosingCount', aTabs.length);
  if (aOptions.broadcasted)
    return;
  return browser.tabs.remove(aTabs.map(aTab => aTab.apiTab.id)).catch(ApiTabs.handleMissingTabError);
}

export function setTabFocused(aTab) {
  const oldActiveTabs = clearOldActiveStateInWindow(aTab.apiTab.windowId);
  aTab.classList.add(Constants.kTAB_STATE_ACTIVE);
  aTab.apiTab.active = true;
  aTab.classList.remove(Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
  aTab.classList.remove(Constants.kTAB_STATE_UNREAD);
  browser.sessions.removeTabValue(aTab.apiTab.id, Constants.kTAB_STATE_UNREAD);
  return oldActiveTabs;
}

export function clearOldActiveStateInWindow(aWindowId) {
  const container = Tabs.getTabsContainer(aWindowId);
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
