/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';

import * as ApiTabs from '/common/api-tabs.js';
import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as Tree from '/common/tree.js';

import Tab from '/common/Tab.js';

import * as Background from './background.js';

function log(...args) {
  internalLogger('background/handle-tab-focus', ...args);
}


let mTabSwitchedByShortcut       = false;
let mMaybeTabSwitchingByShortcut = false;


Tabs.onActivating.addListener((tab, info = {}) => { // return true if this focusing is overridden.
  log('Tabs.onActivating ', tab.id, info);
  if (tab.$TST.shouldReloadOnSelect) {
    browser.tabs.reload(tab.id)
      .catch(ApiTabs.handleMissingTabError);
    delete tab.$TST.shouldReloadOnSelect;
  }
  const window = Tabs.trackedWindows.get(tab.windowId);
  cancelDelayedExpand(Tab.get(window.lastActiveTab));
  const shouldSkipCollapsed = (
    !info.byInternalOperation &&
    mMaybeTabSwitchingByShortcut &&
    configs.skipCollapsedTabsForTabSwitchingShortcuts
  );
  mTabSwitchedByShortcut = mMaybeTabSwitchingByShortcut;
  if (tab.$TST.collapsed) {
    if (!tab.$TST.parent) {
      // This is invalid case, generally never should happen,
      // but actually happen on some environment:
      // https://github.com/piroor/treestyletab/issues/1717
      // So, always expand orphan collapsed tab as a failsafe.
      Tree.collapseExpandTab(tab, {
        collapsed: false,
        broadcast: true
      });
      handleNewActiveTab(tab, info);
    }
    else if (configs.autoExpandOnCollapsedChildActive &&
             !shouldSkipCollapsed) {
      log('=> reaction for autoExpandOnCollapsedChildActive');
      for (const ancestor of Tab.getAncestors(tab)) {
        Tree.collapseExpandSubtree(ancestor, {
          collapsed: false,
          broadcast: true
        });
      }
      handleNewActiveTab(tab, info);
    }
    else {
      log('=> reaction for focusing collapsed descendant');
      let successor = Tab.getVisibleAncestorOrSelf(tab);
      if (!successor) // this seems invalid case...
        return false;
      if (shouldSkipCollapsed &&
          window.lastActiveTab == successor.id) {
        successor = successor.$TST.nearestVisibleFollowing || Tabs.getFirstVisibleTab(tab.windowId);
      }
      window.lastActiveTab = successor.id;
      if (mMaybeTabSwitchingByShortcut)
        setupDelayedExpand(successor);
      TabsInternalOperation.activateTab(successor, { silently: true });
      log('Tabs.onActivating: discarded? ', tab.id, tab.discarded);
      if (tab.discarded)
        tab.$TST.discardURLAfterCompletelyLoaded = tab.url;
      return false;
    }
  }
  else if (info.byActiveTabRemove &&
           (!configs.autoCollapseExpandSubtreeOnSelect ||
            configs.autoCollapseExpandSubtreeOnSelectExceptActiveTabRemove)) {
    log('=> reaction for removing current tab');
    return false;
  }
  else if (tab.$TST.hasChild &&
           tab.$TST.subtreeCollapsed &&
           !shouldSkipCollapsed) {
    log('=> reaction for newly active parent tab');
    handleNewActiveTab(tab, info);
  }
  delete tab.$TST.discardOnCompletelyLoaded;
  window.lastActiveTab = tab.id;
  if (mMaybeTabSwitchingByShortcut)
    setupDelayedExpand(tab);
  return true;
});
function handleNewActiveTab(tab, info = {}) {
  log('handleNewActiveTab: ', tab.id, info);
  const shouldCollapseExpandNow = configs.autoCollapseExpandSubtreeOnSelect;
  const canCollapseTree         = shouldCollapseExpandNow;
  const canExpandTree           = shouldCollapseExpandNow && !info.silently;
  if (canExpandTree) {
    if (canCollapseTree &&
        configs.autoExpandIntelligently)
      Tree.collapseExpandTreesIntelligentlyFor(tab, {
        broadcast: true
      });
    else
      Tree.collapseExpandSubtree(tab, {
        collapsed: false,
        broadcast: true
      });
  }
}

Tabs.onUpdated.addListener((tab, changeInfo = {}) => {
  if ('url' in changeInfo) {
    if (tab.$TST.discardURLAfterCompletelyLoaded &&
        tab.$TST.discardURLAfterCompletelyLoaded != changeInfo.url)
      delete tab.$TST.discardURLAfterCompletelyLoaded;
  }
});

Tabs.onStateChanged.addListener(tab => {
  if (tab.status != 'complete')
    return;

  if (typeof browser.tabs.discard == 'function') {
    if (tab.url == tab.$TST.discardURLAfterCompletelyLoaded &&
        configs.autoDiscardTabForUnexpectedFocus) {
      log('Try to discard accidentally restored tab (on restored) ', tab.id);
      wait(configs.autoDiscardTabForUnexpectedFocusDelay).then(() => {
        if (!Tabs.ensureLivingTab(tab) ||
            tab.active)
          return;
        if (tab.status == 'complete')
          browser.tabs.discard(tab.id)
            .catch(ApiTabs.handleMissingTabError);
        else
          tab.$TST.discardOnCompletelyLoaded = true;
      });
    }
    else if (tab.$TST.discardOnCompletelyLoaded && !tab.active) {
      log('Discard accidentally restored tab (on complete) ', tab.id);
      browser.tabs.discard(tab.id)
        .catch(ApiTabs.handleMissingTabError);
    }
  }
  delete tab.$TST.discardURLAfterCompletelyLoaded;
  delete tab.$TST.discardOnCompletelyLoaded;
});

function setupDelayedExpand(tab) {
  if (!tab)
    return;
  cancelDelayedExpand(tab);
  if (!configs.autoExpandOnTabSwitchingShortcuts ||
      !tab.$TST.hasChild ||
      !tab.$TST.subtreeCollapsed)
    return;
  tab.$TST.delayedExpand = setTimeout(() => {
    Tree.collapseExpandTreesIntelligentlyFor(tab, {
      broadcast: true
    });
  }, configs.autoExpandOnTabSwitchingShortcutsDelay);
}

function cancelDelayedExpand(tab) {
  if (!tab ||
      !tab.$TST.delayedExpand)
    return;
  clearTimeout(tab.$TST.delayedExpand);
  delete tab.$TST.delayedExpand;
}

function cancelAllDelayedExpand(windowId) {
  for (const tab of Tabs.getAllTabs(windowId)) {
    cancelDelayedExpand(tab);
  }
}

Tabs.onCollapsedStateChanged.addListener((tab, info = {}) => {
  if (info.collapsed)
    Tabs.addState(tab, Constants.kTAB_STATE_COLLAPSED_DONE);
  else
    Tabs.removeState(tab, Constants.kTAB_STATE_COLLAPSED_DONE);
});


Background.onInit.addListener(() => {
  browser.windows.onFocusChanged.addListener(() => {
    mMaybeTabSwitchingByShortcut = false;
  });
});

Background.onBuilt.addListener(() => {
  browser.runtime.onMessage.addListener(onMessage);
});


function onMessage(message, sender) {
  if (!message ||
      typeof message.type != 'string')
    return;

  //log('onMessage: ', message, sender);
  switch (message.type) {
    case Constants.kNOTIFY_TAB_MOUSEDOWN:
      mMaybeTabSwitchingByShortcut =
        mTabSwitchedByShortcut = false;
      break;

    case Constants.kCOMMAND_NOTIFY_START_TAB_SWITCH:
      log('Constants.kCOMMAND_NOTIFY_START_TAB_SWITCH');
      mMaybeTabSwitchingByShortcut = true;
      break;
    case Constants.kCOMMAND_NOTIFY_END_TAB_SWITCH:
      log('Constants.kCOMMAND_NOTIFY_END_TAB_SWITCH');
      return (async () => {
        if (mTabSwitchedByShortcut &&
            configs.skipCollapsedTabsForTabSwitchingShortcuts) {
          await Tabs.waitUntilTabsAreCreated(sender.tab.id);
          let tab = sender.tab && Tab.get(sender.tab.id);
          if (!tab) {
            const tabs = await browser.tabs.query({ currentWindow: true, active: true });
            await Tabs.waitUntilTabsAreCreated(tabs[0].id);
            tab = Tab.get(tabs[0].id);
          }
          cancelAllDelayedExpand(tab.windowId);
          if (configs.autoCollapseExpandSubtreeOnSelect &&
              tab &&
              Tabs.trackedWindows.get(tab.windowId).lastActiveTab == tab.id) {
            Tree.collapseExpandSubtree(tab, {
              collapsed: false,
              broadcast: true
            });
          }
        }
        mMaybeTabSwitchingByShortcut =
          mTabSwitchedByShortcut = false;
      })();
  }
}
