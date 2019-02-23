/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as Tabs from '/common/tabs.js';
import * as Tree from '/common/tree.js';

function log(...args) {
  internalLogger('background/successor-tab', ...args);
}

const mTabsToBeUpdated = new Set();

// activate only on Firefox 65 and later
if (typeof browser.tabs.moveInSuccession == 'function') {
  Tabs.onActivated.addListener(onActivated);
  Tabs.onCreating.addListener(onCreating);
  Tabs.onCreated.addListener(onCreated);
  Tabs.onRemoving.addListener(onRemoving);
  Tabs.onRemoved.addListener(onRemoved);
  Tabs.onMoved.addListener(onMoved);
  Tabs.onAttached.addListener(onAttached);
  Tabs.onDetached.addListener(onDetached);

  Tree.onAttached.addListener(onTreeAttached);
  Tree.onDetached.addListener(onTreeDetached);
  Tree.onSubtreeCollapsedStateChanging.addListener(onSubtreeCollapsedStateChanging);
}

function setSuccessor(apiTabId, successorTabId = -1) {
  if (configs.successorTabControlLevel == Constants.kSUCCESSOR_TAB_CONTROL_NEVER)
    return;
  browser.tabs.update(apiTabId, {
    successorTabId
  });
}

function clearSuccessor(apiTabId) {
  setSuccessor(apiTabId, -1);
}


function update(apiTabId) {
  mTabsToBeUpdated.add(apiTabId);
  setTimeout(() => {
    const ids = Array.from(mTabsToBeUpdated);
    mTabsToBeUpdated.clear();
    for (const id of ids) {
      if (id)
        updateInternal(id);
    }
  }, 100);
}
async function updateInternal(apiTabId) {
  const apiTab = await browser.tabs.get(apiTabId).catch(ApiTabs.handleMissingTabError);
  const tab = Tabs.getTabElementById(apiTabId);
  if (!apiTab ||
      !tab ||
      !Tabs.ensureLivingTab(tab))
    return;
  log('update: ', tab.id);
  if (tab.lastSuccessorTabIdByOwner) {
    const successor = Tabs.getTabElementById(apiTab.successorTabId);
    if (successor) {
      log(`  ${tab.id} is already prepared for "selectOwnerOnClose" behavior (successor=${apiTab.successorTabId})`);
      return;
    }
    // clear broken information
    delete tab.lastSuccessorTabIdByOwner;
    delete tab.lastSuccessorTabId;
    clearSuccessor(tab.apiTab.id);
  }
  if (tab.lastSuccessorTabId) {
    log(`  ${tab.id} is under control: `, {
      successorTabId: apiTab.successorTabId,
      lastSuccessorTabId: tab.lastSuccessorTabId
    });
    if (apiTab.successorTabId != -1 &&
        apiTab.successorTabId != tab.lastSuccessorTabId) {
      log(`  ${tab.id}'s successor is modified by someone! Now it is out of control.`);
      delete tab.lastSuccessorTabId;
      return;
    }
  }
  delete tab.lastSuccessorTabId;
  if (configs.successorTabControlLevel == Constants.kSUCCESSOR_TAB_CONTROL_NEVER)
    return;
  let nextActive = null;
  if (apiTab.active) {
    if (configs.successorTabControlLevel == Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE) {
      const firstChild = Tabs.getFirstChildTab(tab);
      nextActive = (
        (firstChild && !Tabs.isCollapsed(firstChild) && firstChild) ||
        (Tabs.getNextSiblingTab(tab) || Tabs.getPreviousVisibleTab(tab))
      );
    }
    else
      nextActive = Tabs.getNextVisibleTab(tab) || Tabs.getPreviousVisibleTab(tab);
  }
  if (nextActive) {
    log(`  ${tab.id} is under control: successor = ${nextActive.id}`);
    setSuccessor(apiTab.id, nextActive.apiTab.id);
    tab.lastSuccessorTabId = nextActive.apiTab.id;
  }
  else {
    log(`  ${tab.id} is out of control.`, {
      active:      apiTab.active,
      nextActive: nextActive && nextActive.id
    });
    clearSuccessor(apiTab.id);
  }
}

async function tryClearOwnerSuccessor(tab) {
  if (!tab || !tab.lastSuccessorTabIdByOwner)
    return;
  delete tab.lastSuccessorTabIdByOwner;
  const apiTab = await browser.tabs.get(tab.apiTab.id).catch(ApiTabs.handleMissingTabError);
  if (!apiTab || apiTab.successorTabId != tab.lastSuccessorTabId)
    return;
  log(`${tab.id} is unprepared for "selectOwnerOnClose" behavior`);
  delete tab.lastSuccessorTabId;
  clearSuccessor(tab.apiTab.id);
}


async function onActivated(tab, info = {}) {
  update(tab.apiTab.id);
  if (info.previousTabId) {
    const previousTab = Tabs.getTabElementById(info.previousTabId);
    if (previousTab) {
      await tryClearOwnerSuccessor(previousTab);
      const container = Tabs.getTabsContainer(info.windowId);
      if (container.lastRelatedTabs) {
        const lastRelatedTab = Tabs.getTabElementById(container.lastRelatedTabs.get(info.previousTabId));
        if (lastRelatedTab &&
            lastRelatedTab != tab) {
          log(`clear lastRelatedTabs for the window ${info.windowId} by tabs.onActivated`);
          container.lastRelatedTabs.clear();
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
    const ownerTabId = tab.apiTab.openerTabId || tab.apiTab.active ? info.activeTab.apiTab.id : null
    if (!ownerTabId)
      return;

    log(`${tab.id} is prepared for "selectOwnerOnClose" behavior (successor=${ownerTabId})`);
    setSuccessor(tab.apiTab.id, ownerTabId);
    tab.lastSuccessorTabId = ownerTabId;
    tab.lastSuccessorTabIdByOwner = true;

    if (!tab.apiTab.openerTabId)
      return;

    const container = tab.parentNode;
    container.lastRelatedTabs = container.lastRelatedTabs || new Map();

    const lastRelatedTabId = container.lastRelatedTabs.get(tab.apiTab.openerTabId);
    if (lastRelatedTabId)
      tryClearOwnerSuccessor(Tabs.getTabElementById(lastRelatedTabId));

    container.lastRelatedTabs.set(tab.apiTab.openerTabId, tab.apiTab.id);
    log(`set lastRelatedTab for ${tab.apiTab.openerTabId}: ${tab.id}`);
  });
}

function onCreated(tab, _info = {}) {
  const activeTab = Tabs.getActiveTab(tab.apiTab.windowId);
  if (activeTab)
    update(activeTab.id);
}

function onRemoving(tab, removeInfo = {}) {
  if (removeInfo.isWindowClosing)
    return;

  const container = tab.parentNode;
  const lastRelatedTabs = container.lastRelatedTabs;
  if (!lastRelatedTabs)
    return;

  const lastRelatedTab = Tabs.getTabElementById(lastRelatedTabs.get(tab.apiTab.id));
  if (lastRelatedTab &&
      !lastRelatedTab.apiTab.active)
    tryClearOwnerSuccessor(lastRelatedTab);
}

function onRemoved(tab, info = {}) {
  const activeTab = Tabs.getActiveTab(info.windowId);
  if (activeTab && !info.isWindowClosing)
    update(activeTab.id);
  const container = tab.parentNode;
  log(`clear lastRelatedTabs for ${info.windowId} by tabs.onRemoved`);
  if (container.lastRelatedTabs)
    container.lastRelatedTabs.clear();
}

function onMoved(tab, info = {}) {
  const activeTab = Tabs.getActiveTab(tab.apiTab.windowId);
  if (activeTab)
    update(activeTab.id);

  if (!info.byInternalOperation) {
    log(`clear lastRelatedTabs for ${tab.apiTab.windowId} by tabs.onMoved`);
    const container = tab.parentNode;
    if (container.lastRelatedTabs)
      container.lastRelatedTabs.clear();
  }
}

function onAttached(_tab, info = {}) {
  const activeTab = Tabs.getActiveTab(info.newWindowId);
  if (activeTab)
    update(activeTab.id);
}

function onDetached(_tab, info = {}) {
  const activeTab = Tabs.getActiveTab(info.oldWindowId);
  if (activeTab)
    update(activeTab.id);

  const container = Tabs.getTabsContainer(info.oldWindowId);
  if (container) {
    log(`clear lastRelatedTabs for ${info.windowId} by tabs.onDetached`);
    if (container.lastRelatedTabs)
      container.lastRelatedTabs.clear();
  }
}


function onTreeAttached(child, _info = {}) {
  const activeTab = Tabs.getActiveTab(child.apiTab.windowId);
  if (activeTab)
    update(activeTab.id);
}

function onTreeDetached(child, _info = {}) {
  const activeTab = Tabs.getActiveTab(child.apiTab.windowId);
  if (activeTab)
    update(activeTab.id);
}

function onSubtreeCollapsedStateChanging(tab, _info = {}) {
  const activeTab = Tabs.getActiveTab(tab.apiTab.windowId);
  if (activeTab)
    update(activeTab.id);
}
