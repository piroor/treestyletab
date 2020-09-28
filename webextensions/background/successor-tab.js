/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as SidebarConnection from '/common/sidebar-connection.js';

import Tab from '/common/Tab.js';

import * as Tree from './tree.js';

function log(...args) {
  internalLogger('background/successor-tab', ...args);
}

const mTabsToBeUpdated = new Set();


function setSuccessor(tabId, successorTabId = -1) {
  const tab          = Tab.get(tabId);
  const successorTab = Tab.get(successorTabId);
  if (configs.successorTabControlLevel == Constants.kSUCCESSOR_TAB_CONTROL_NEVER ||
      !tab ||
      !successorTab ||
      tab.windowId != successorTab.windowId)
    return;
  browser.tabs.update(tabId, {
    successorTabId
  }).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError, error => {
    // ignore error for already closed tab
    if (!error ||
        !error.message ||
        (error.message.indexOf('Invalid successorTabId') != 0 &&
         // This error may happen at the time just after a tab is detached from its original window.
         error.message.indexOf('Successor tab must be in the same window as the tab being updated') != 0))
      throw error;
  }));
}

function clearSuccessor(tabId) {
  setSuccessor(tabId, -1);
}


function update(tabId) {
  mTabsToBeUpdated.add(tabId);
  setTimeout(() => {
    const ids = Array.from(mTabsToBeUpdated);
    mTabsToBeUpdated.clear();
    for (const id of ids) {
      if (id)
        updateInternal(id);
    }
  }, 100);
}
async function updateInternal(tabId) {
  const renewedTab = await browser.tabs.get(tabId).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
  const tab = Tab.get(tabId);
  if (!renewedTab ||
      !tab ||
      !TabsStore.ensureLivingTab(tab))
    return;
  log('update: ', dumpTab(tab));
  if (tab.$TST.lastSuccessorTabIdByOwner) {
    const successor = Tab.get(renewedTab.successorTabId);
    if (successor) {
      log(`  ${dumpTab(tab)} is already prepared for "selectOwnerOnClose" behavior (successor=${renewedTab.successorTabId})`);
      return;
    }
    // clear broken information
    delete tab.$TST.lastSuccessorTabIdByOwner;
    delete tab.$TST.lastSuccessorTabId;
    clearSuccessor(tab.id);
  }
  if (tab.$TST.lastSuccessorTabId) {
    log(`  ${dumpTab(tab)} is under control: `, {
      successorTabId: renewedTab.successorTabId,
      lastSuccessorTabId: tab.$TST.lastSuccessorTabId
    });
    if (renewedTab.successorTabId != -1 &&
        renewedTab.successorTabId != tab.$TST.lastSuccessorTabId) {
      log(`  ${dumpTab(tab)}'s successor is modified by someone! Now it is out of control.`);
      delete tab.$TST.lastSuccessorTabId;
      return;
    }
  }
  delete tab.$TST.lastSuccessorTabId;
  if (configs.successorTabControlLevel == Constants.kSUCCESSOR_TAB_CONTROL_NEVER)
    return;
  let successor = null;
  if (renewedTab.active) {
    if (configs.successorTabControlLevel == Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE) {
      const firstChild = (
        configs.treatTreeAsExpandedOnClosedWithNoSidebar &&
        !SidebarConnection.isOpen(tab.windowId)
      ) ? tab.$TST.firstChild : tab.$TST.firstVisibleChild;
      successor = firstChild || tab.$TST.nextVisibleSiblingTab || tab.$TST.nearestVisiblePrecedingTab;
      log(`  possible successor: ${dumpTab(tab)}`);
      if (successor &&
          successor.discarded &&
          configs.avoidDiscardedTabToBeActivatedIfPossible) {
        log(`  ${dumpTab(successor)} is discarded.`);
        successor = tab.$TST.nearestLoadedSiblingTab ||
                      tab.$TST.nearestLoadedTabInTree ||
                      tab.$TST.nearestLoadedTab ||
                      successor;
        log(`  => redirected successor is: ${dumpTab(successor)}`);
      }
    }
    else {
      successor = tab.$TST.nearestVisibleFollowingTab || tab.$TST.nearestVisiblePrecedingTab;
      log(`  possible successor: ${dumpTab(tab)}`);
      if (successor &&
          successor.discarded &&
          configs.avoidDiscardedTabToBeActivatedIfPossible) {
        log(`  ${dumpTab(successor)} is discarded.`);
        successor = tab.$TST.nearestLoadedTab ||
                      successor;
        log(`  => redirected successor is: ${dumpTab(successor)}`);
      }
    }
  }
  if (successor) {
    log(`  ${dumpTab(tab)} is under control: successor = ${successor.id}`);
    setSuccessor(renewedTab.id, successor.id);
    tab.$TST.lastSuccessorTabId = successor.id;
  }
  else {
    log(`  ${dumpTab(tab)} is out of control.`, {
      active:    renewedTab.active,
      successor: successor && successor.id
    });
    clearSuccessor(renewedTab.id);
  }
}

async function tryClearOwnerSuccessor(tab) {
  if (!tab ||
      !tab.$TST.lastSuccessorTabIdByOwner)
    return;
  delete tab.$TST.lastSuccessorTabIdByOwner;
  const renewedTab = await browser.tabs.get(tab.id).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
  if (!renewedTab ||
      renewedTab.successorTabId != tab.lastSuccessorTabId)
    return;
  log(`${dumpTab(tab)} is unprepared for "selectOwnerOnClose" behavior`);
  delete tab.$TST.lastSuccessorTabId;
  clearSuccessor(tab.id);
}

Tab.onActivated.addListener(async (tab, info = {}) => {
  update(tab.id);
  if (info.previousTabId) {
    const previousTab = Tab.get(info.previousTabId);
    if (previousTab) {
      await tryClearOwnerSuccessor(previousTab);
      const window = TabsStore.windows.get(info.windowId);
      if (window.lastRelatedTabs) {
        const lastRelatedTab = Tab.get(window.lastRelatedTabs.get(info.previousTabId));
        if (lastRelatedTab &&
            lastRelatedTab.id != tab.id) {
          log(`clear lastRelatedTabs for the window ${info.windowId} by tabs.onActivated`);
          window.lastRelatedTabs.clear();
          await tryClearOwnerSuccessor(lastRelatedTab);
        }
      }
    }
    update(info.previousTabId);
  }
});

Tab.onCreating.addListener((tab, info = {}) => {
  if (configs.successorTabControlLevel == Constants.kSUCCESSOR_TAB_CONTROL_NEVER ||
      !configs.simulateSelectOwnerOnClose ||
      !info.activeTab)
    return;

  // don't use await here, to prevent that other onCreating handlers are treated async.
  tryClearOwnerSuccessor(info.activeTab).then(() => {
    const ownerTabId = tab.openerTabId || tab.active ? info.activeTab.id : null
    if (!ownerTabId)
      return;

    log(`${dumpTab(tab)} is prepared for "selectOwnerOnClose" behavior (successor=${ownerTabId})`);
    setSuccessor(tab.id, ownerTabId);
    tab.$TST.lastSuccessorTabId = ownerTabId;
    tab.$TST.lastSuccessorTabIdByOwner = true;

    if (!tab.openerTabId)
      return;

    const window = TabsStore.windows.get(tab.windowId);
    window.lastRelatedTabs = window.lastRelatedTabs || new Map();

    const lastRelatedTabId = window.lastRelatedTabs.get(tab.openerTabId);
    if (lastRelatedTabId)
      tryClearOwnerSuccessor(Tab.get(lastRelatedTabId));

    window.lastRelatedTabs.set(tab.openerTabId, tab.id);
    log(`set lastRelatedTab for ${tab.openerTabId}: ${dumpTab(tab)}`);
  });
});

function updateActiveTab(windowId) {
  const activeTab = Tab.getActiveTab(windowId);
  if (activeTab)
    update(activeTab.id);
}

Tab.onCreated.addListener((tab, _info = {}) => {
  updateActiveTab(tab.windowId);
});

Tab.onRemoving.addListener((tab, removeInfo = {}) => {
  if (removeInfo.isWindowClosing)
    return;

  const window = TabsStore.windows.get(tab.windowId);
  const lastRelatedTabs = window.lastRelatedTabs;
  if (!lastRelatedTabs)
    return;

  const lastRelatedTab = Tab.get(lastRelatedTabs.get(tab.id));
  if (lastRelatedTab &&
      !lastRelatedTab.active)
    tryClearOwnerSuccessor(lastRelatedTab);
});

Tab.onRemoved.addListener((tab, info = {}) => {
  updateActiveTab(info.windowId);

  const window = TabsStore.windows.get(info.windowId);
  if (!window)
    return;
  log(`clear lastRelatedTabs for ${info.windowId} by tabs.onRemoved`);
  if (window.lastRelatedTabs)
    window.lastRelatedTabs.clear();
});

Tab.onMoved.addListener((tab, info = {}) => {
  updateActiveTab(tab.windowId);

  if (!info.byInternalOperation) {
    log(`clear lastRelatedTabs for ${tab.windowId} by tabs.onMoved`);
    const window = TabsStore.windows.get(info.windowId);
    if (window.lastRelatedTabs)
      window.lastRelatedTabs.clear();
  }
});

Tab.onAttached.addListener((_tab, info = {}) => {
  updateActiveTab(info.newWindowId);
});

Tab.onDetached.addListener((_tab, info = {}) => {
  updateActiveTab(info.oldWindowId);

  const window = TabsStore.windows.get(info.oldWindowId);
  if (window) {
    log(`clear lastRelatedTabs for ${info.windowId} by tabs.onDetached`);
    if (window.lastRelatedTabs)
      window.lastRelatedTabs.clear();
  }
});

Tab.onUpdated.addListener((tab, changeInfo = {}) => {
  if (!('discarded' in changeInfo))
    return;
  updateActiveTab(tab.windowId);
});

Tab.onShown.addListener(tab => {
  updateActiveTab(tab.windowId);
});

Tab.onHidden.addListener(tab => {
  updateActiveTab(tab.windowId);
});

Tree.onAttached.addListener((child, _info = {}) => {
  updateActiveTab(child.windowId);
});

Tree.onDetached.addListener((child, _info = {}) => {
  updateActiveTab(child.windowId);
});

Tree.onSubtreeCollapsedStateChanging.addListener((tab, _info = {}) => {
  updateActiveTab(tab.windowId);
});

SidebarConnection.onConnected.addListener((windowId, _openCount) => {
  updateActiveTab(windowId);
});

SidebarConnection.onDisconnected.addListener((windowId, _openCount) => {
  updateActiveTab(windowId);
});
