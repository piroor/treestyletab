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
import * as Tree from '/common/tree.js';

import Tab from '/common/Tab.js';

function log(...args) {
  internalLogger('background/successor-tab', ...args);
}

const mTabsToBeUpdated = new Set();

// activate only on Firefox 65 and later
if (typeof browser.tabs.moveInSuccession == 'function') {
  Tab.onActivated.addListener(onActivated);
  Tab.onCreating.addListener(onCreating);
  Tab.onCreated.addListener(onCreated);
  Tab.onRemoving.addListener(onRemoving);
  Tab.onRemoved.addListener(onRemoved);
  Tab.onMoved.addListener(onMoved);
  Tab.onAttached.addListener(onAttached);
  Tab.onDetached.addListener(onDetached);

  Tree.onAttached.addListener(onTreeAttached);
  Tree.onDetached.addListener(onTreeDetached);
  Tree.onSubtreeCollapsedStateChanging.addListener(onSubtreeCollapsedStateChanging);
}

function setSuccessor(tabId, successorTabId = -1) {
  if (configs.successorTabControlLevel == Constants.kSUCCESSOR_TAB_CONTROL_NEVER)
    return;
  browser.tabs.update(tabId, {
    successorTabId
  }).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
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
      lastSuccessorTabId: tab.lastSuccessorTabId
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
      const firstChild = tab.$TST.firstChild;
      successor = (
        (firstChild && !firstChild.$TST.collapsed && firstChild) ||
        (tab.$TST.nextSibling || tab.$TST.nearestVisiblePreceding)
      );
    }
    else
      successor = tab.$TST.nearestVisibleFollowing || tab.$TST.nearestVisiblePreceding;
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


async function onActivated(tab, info = {}) {
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
}

function onCreating(tab, info = {}) {
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
}

function onCreated(tab, _info = {}) {
  const activeTab = Tab.getActiveTab(tab.windowId);
  if (activeTab)
    update(activeTab.id);
}

function onRemoving(tab, removeInfo = {}) {
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
}

function onRemoved(tab, info = {}) {
  const activeTab = Tab.getActiveTab(info.windowId);
  if (activeTab && !info.isWindowClosing)
    update(activeTab.id);
  const window = TabsStore.windows.get(info.windowId);
  if (!window)
    return;
  log(`clear lastRelatedTabs for ${info.windowId} by tabs.onRemoved`);
  if (window.lastRelatedTabs)
    window.lastRelatedTabs.clear();
}

function onMoved(tab, info = {}) {
  const activeTab = Tab.getActiveTab(tab.windowId);
  if (activeTab)
    update(activeTab.id);

  if (!info.byInternalOperation) {
    log(`clear lastRelatedTabs for ${tab.windowId} by tabs.onMoved`);
    const window = TabsStore.windows.get(info.windowId);
    if (window.lastRelatedTabs)
      window.lastRelatedTabs.clear();
  }
}

function onAttached(_tab, info = {}) {
  const activeTab = Tab.getActiveTab(info.newWindowId);
  if (activeTab)
    update(activeTab.id);
}

function onDetached(_tab, info = {}) {
  const activeTab = Tab.getActiveTab(info.oldWindowId);
  if (activeTab)
    update(activeTab.id);

  const window = TabsStore.windows.get(info.oldWindowId);
  if (window) {
    log(`clear lastRelatedTabs for ${info.windowId} by tabs.onDetached`);
    if (window.lastRelatedTabs)
      window.lastRelatedTabs.clear();
  }
}


function onTreeAttached(child, _info = {}) {
  const activeTab = Tab.getActiveTab(child.windowId);
  if (activeTab)
    update(activeTab.id);
}

function onTreeDetached(child, _info = {}) {
  const activeTab = Tab.getActiveTab(child.windowId);
  if (activeTab)
    update(activeTab.id);
}

function onSubtreeCollapsedStateChanging(tab, _info = {}) {
  const activeTab = Tab.getActiveTab(tab.windowId);
  if (activeTab)
    update(activeTab.id);
}
