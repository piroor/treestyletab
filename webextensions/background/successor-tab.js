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
  const tab = Tabs.getTabById(apiTabId);
  if (!apiTab ||
      !tab ||
      !Tabs.ensureLivingTab(tab))
    return;
  log('update: ', tab.id);
  if (tab.lastSuccessorTabIdByOwner) {
    log(`  ${tab.id} is already prepared for "selectOwnerOnClose" behavior (successor=${apiTab.successorTabId})`);
    return;
  }
  if (tab.lastSuccessorTabId) {
    log(`  ${tab.id} was controlled: `, {
      successorTabId: apiTab.successorTabId,
      lastSuccessorTabId: tab.lastSuccessorTabId
    });
    if (apiTab.successorTabId != -1 &&
        apiTab.successorTabId != tab.lastSuccessorTabId) {
      log(`  ${tab.id} is modified by someone!`);
      delete tab.lastSuccessorTabId;
      return;
    }
  }
  delete tab.lastSuccessorTabId;
  if (!configs.moveFocusInTreeForClosedCurrentTab) {
    browser.tabs.update(apiTab.id, {
      successorTabId: -1
    });
    return;
  }
  let allowedNextFocusedTab = null;
  let nextFocused           = null;
  const parent = Tabs.getParentTab(tab);
  if (parent || Tabs.getNextVisibleTab(tab)) { // prevent to focus to the next tab
    allowedNextFocusedTab = Tabs.getFirstChildTab(tab) || Tabs.getNextSiblingTab(tab);
    nextFocused = Tabs.getPreviousSiblingTab(tab) || parent;
  }
  else if (!parent) { // prevent to focus to the previous tab
    nextFocused = Tabs.getPreviousVisibleTab(tab);
    if (nextFocused == Tabs.getPreviousTab(tab))
      nextFocused = null;
  }
  if (apiTab.active && !allowedNextFocusedTab && nextFocused) {
    log(`  ${tab.id} has its successor ${nextFocused.id}`);
    browser.tabs.update(apiTab.id, {
      successorTabId: nextFocused.apiTab.id
    });
    tab.lastSuccessorTabId = nextFocused.apiTab.id;
  }
  else {
    log(`  ${tab.id} is not controlled `, {
      active:                apiTab.active,
      nextFocused:           nextFocused && nextFocused.id,
      allowedNextFocusedTab: allowedNextFocusedTab && allowedNextFocusedTab.id
    });
    browser.tabs.update(apiTab.id, {
      successorTabId: -1
    });
  }
}

async function tryClearOwnerSuccessor(tab) {
  delete tab.lastSuccessorTabIdByOwner;
  const apiTab = await browser.tabs.get(tab.apiTab.id).catch(ApiTabs.handleMissingTabError);
  if (!apiTab || apiTab.successorTabId != tab.lastSuccessorTabId)
    return;
  log(`${tab.id} is unprepared for "selectOwnerOnClose" behavior`);
  delete tab.lastSuccessorTabId;
  browser.tabs.update(tab.apiTab.id, {
    successorTabId: -1
  });
}


async function onActivated(tab, info = {}) {
  update(tab.apiTab.id);
  if (info.previousTabId) {
    const tab = Tabs.getTabById(info.previousTabId);
    if (tab) {
      const container = Tabs.getTabsContainer(info.windowId);
      if (container.lastRelatedTabs) {
        const lastRelatedTab = Tabs.getTabById(container.lastRelatedTabs.get(info.previousTabId));
        if (lastRelatedTab &&
            !lastRelatedTab.apiTab.active) {
          log(`clear lastRelatedTabs for ${tab.apiTab.windowId} by tabs.onActivated`);
          container.lastRelatedTabs.clear();
          if (lastRelatedTab.lastSuccessorTabIdByOwner)
            await tryClearOwnerSuccessor(lastRelatedTab);
        }
      }
      if (tab.lastSuccessorTabIdByOwner)
        await tryClearOwnerSuccessor(tab);
    }
    update(info.previousTabId);
  }
}

function onCreating(tab, _info = {}) {
  if (!configs.simulateSelectOwnerOnClose ||
      !tab.apiTab.openerTabId)
    return;
  log(`${tab.id} is prepared for "selectOwnerOnClose" behavior (successor=${tab.apiTab.openerTabId})`);
  browser.tabs.update(tab.apiTab.id, {
    successorTabId: tab.apiTab.openerTabId
  });
  tab.lastSuccessorTabId = tab.apiTab.openerTabId;
  tab.lastSuccessorTabIdByOwner = true;

  const container = tab.parentNode;
  container.lastRelatedTabs = container.lastRelatedTabs || new Map();
  container.lastRelatedTabs.set(tab.apiTab.openerTabId, tab.apiTab.id);
  log(`set lastRelatedTab for ${tab.apiTab.openerTabId}: ${tab.id}`);

  if (!tab.apiTab.active) {
    const activeTab = Tabs.getCurrentTab(tab);
    if (activeTab.lastSuccessorTabIdByOwner)
      tryClearOwnerSuccessor(activeTab);
  }
}

function onCreated(tab, _info = {}) {
  update(Tabs.getCurrentTab(tab).apiTab.id);
}

function onRemoving(tab, _info = {}) {
  const container = tab.parentNode;
  const lastRelatedTabs = container.lastRelatedTabs;
  if (!lastRelatedTabs)
    return;

  const lastRelatedTab = Tabs.getTabById(lastRelatedTabs.get(tab.apiTab.id));
  if (lastRelatedTab &&
      !lastRelatedTab.apiTab.active &&
      lastRelatedTab.lastSuccessorTabIdByOwner)
    tryClearOwnerSuccessor(lastRelatedTab);
}

function onRemoved(tab, info = {}) {
  if (!info.isWindowClosing)
    update(Tabs.getCurrentTab(info.windowId).apiTab.id);
  const container = tab.parentNode;
  log(`clear lastRelatedTabs for ${info.windowId} by tabs.onRemoved`);
  if (container.lastRelatedTabs)
    container.lastRelatedTabs.clear();
}

function onMoved(tab, info = {}) {
  update(Tabs.getCurrentTab(tab).apiTab.id);

  if (!info.byInternalOperation) {
    log(`clear lastRelatedTabs for ${tab.apiTab.windowId} by tabs.onMoved`);
    const container = tab.parentNode;
    if (container.lastRelatedTabs)
      container.lastRelatedTabs.clear();
  }
}

function onAttached(_tab, info = {}) {
  update(Tabs.getCurrentTab(info.newWindowId).apiTab.id);
}

function onDetached(_tab, info = {}) {
  update(Tabs.getCurrentTab(info.oldWindowId).apiTab.id);

  const container = Tabs.getTabsContainer(info.oldWindowId);
  if (container) {
    log(`clear lastRelatedTabs for ${info.windowId} by tabs.onDetached`);
    if (container.lastRelatedTabs)
      container.lastRelatedTabs.clear();
  }
}


function onTreeAttached(child, _info = {}) {
  update(Tabs.getCurrentTab(child).apiTab.id);
}

function onTreeDetached(child, _info = {}) {
  update(Tabs.getCurrentTab(child).apiTab.id);
}

function onSubtreeCollapsedStateChanging(tab, _info = {}) {
  update(Tabs.getCurrentTab(tab).apiTab.id);
}
