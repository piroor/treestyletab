/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab,
  wait,
  configs
} from '/common/common.js';

import * as ApiTabs from '/common/api-tabs.js';
import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as SidebarConnection from '/common/sidebar-connection.js';

import Tab from '/common/Tab.js';

import * as Background from './background.js';
import * as Tree from './tree.js';

function log(...args) {
  internalLogger('background/handle-tab-focus', ...args);
}


let mTabSwitchedByShortcut       = false;
let mMaybeTabSwitchingByShortcut = false;


Tab.onActivating.addListener((tab, info = {}) => { // return false if the activation should be canceled
  log('Tabs.onActivating ', { tab: dumpTab(tab), info });
  if (tab.$TST.shouldReloadOnSelect) {
    browser.tabs.reload(tab.id)
      .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
    delete tab.$TST.shouldReloadOnSelect;
  }
  const window = TabsStore.windows.get(tab.windowId);
  log('  lastActiveTab: ', window.lastActiveTab);
  cancelDelayedExpand(Tab.get(window.lastActiveTab));
  const shouldSkipCollapsed = (
    !info.byInternalOperation &&
    mMaybeTabSwitchingByShortcut &&
    (configs.skipCollapsedTabsForTabSwitchingShortcuts ||
     tab.$TST.nearestFocusableTabOrSelf.$TST.lockedCollapsed)
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
      const forceAutoExpand = configs.autoExpandOnCollapsedChildActiveUnderLockedCollapsed;
      const toBeFocused = forceAutoExpand ? tab : tab.$TST.nearestFocusableTabOrSelf;
      const ancestors   = toBeFocused ? [toBeFocused].concat(toBeFocused.$TST.ancestors) : [];
      for (const ancestor of ancestors) {
        if (!forceAutoExpand && ancestor.$TST.lockedCollapsed)
          continue;
        Tree.collapseExpandSubtree(ancestor, {
          collapsed: false,
          broadcast: true
        });
      }
      if (toBeFocused != tab) {
        TabsInternalOperation.activateTab(toBeFocused, { silently: true });
        log('Tabs.onActivating: discarded? ', dumpTab(tab), tab && tab.discarded);
        if (tab.discarded)
          tab.$TST.discardURLAfterCompletelyLoaded = tab.url;
        return false;
      }
      handleNewActiveTab(tab, info);
    }
    else {
      log('=> reaction for focusing collapsed descendant');
      let successor = tab.$TST.nearestVisibleAncestorOrSelf;
      if (!successor) // this seems invalid case...
        return false;
      log('successor = ', successor.id);
      if (shouldSkipCollapsed &&
          window.lastActiveTab == successor.id) {
        log('=> redirect successor (focus moved from the successor itself)');
        successor = successor.$TST.nearestVisibleFollowingTab;
        if (successor &&
            successor.discarded &&
            configs.avoidDiscardedTabToBeActivatedIfPossible)
          successor = successor.$TST.nearestLoadedTabInTree ||
                        successor.$TST.nearestLoadedTab ||
                        successor;
        if (!successor)
          successor = Tab.getFirstVisibleTab(tab.windowId);
        log('=> ', successor.id);
      }
      else if (!mTabSwitchedByShortcut && // intentonal focus to a discarded tabs by Ctrl-Tab/Ctrl-Shift-Tab is always allowed!
               successor.discarded &&
               configs.avoidDiscardedTabToBeActivatedIfPossible) {
        log('=> redirect successor (successor is discarded)');
        successor = successor.$TST.nearestLoadedTabInTree ||
                      successor.$TST.nearestLoadedTab ||
                      successor;
        log('=> ', successor.id);
      }
      window.lastActiveTab = successor.id;
      if (mMaybeTabSwitchingByShortcut)
        setupDelayedExpand(successor);
      TabsInternalOperation.activateTab(successor, { silently: true });
      log('Tabs.onActivating: discarded? ', dumpTab(tab), tab && tab.discarded);
      if (tab.discarded)
        tab.$TST.discardURLAfterCompletelyLoaded = tab.url;
      return false;
    }
  }
  else if (info.byActiveTabRemove &&
           (!configs.autoCollapseExpandSubtreeOnSelect ||
            configs.autoCollapseExpandSubtreeOnSelectExceptActiveTabRemove)) {
    log('=> reaction for removing current tab');
    window.lastActiveTab = tab.id;
    return true;
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
  else
    tryHighlightBundledTab(tab, Object.assign({}, info, { shouldSkipCollapsed }));

  return true;
});

function handleNewActiveTab(tab, info = {}) {
  log('handleNewActiveTab: ', dumpTab(tab), info);
  const shouldCollapseExpandNow = configs.autoCollapseExpandSubtreeOnSelect;
  const canCollapseTree         = shouldCollapseExpandNow;
  const canExpandTree           = shouldCollapseExpandNow && !info.silently && !tab.$TST.lockedCollapsed;
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

async function tryHighlightBundledTab(tab, info) {
  const bundledTab = tab.$TST.bundledTab;
  const oldBundledTabs = TabsStore.bundledActiveTabsInWindow.get(tab.windowId);
  for (const tab of oldBundledTabs.values()) {
    if (tab == bundledTab)
      continue;
    tab.$TST.removeState(Constants.kTAB_STATE_BUNDLED_ACTIVE, { broadcast: true });
  }

  if (!bundledTab)
    return;

  bundledTab.$TST.addState(Constants.kTAB_STATE_BUNDLED_ACTIVE, { broadcast: true });

  await wait(100);
  if (!tab.active || // ignore tab already inactivated while waiting
      tab.$TST.hasOtherHighlighted || // ignore manual highlighting
      bundledTab.pinned)
    return;

  if (bundledTab.$TST.hasChild &&
      bundledTab.$TST.subtreeCollapsed &&
      !info.shouldSkipCollapsed)
    handleNewActiveTab(bundledTab, info);
}

Tab.onUpdated.addListener((tab, changeInfo = {}) => {
  if ('url' in changeInfo) {
    if (tab.$TST.discardURLAfterCompletelyLoaded &&
        tab.$TST.discardURLAfterCompletelyLoaded != changeInfo.url)
      delete tab.$TST.discardURLAfterCompletelyLoaded;
  }
});

Tab.onStateChanged.addListener(tab => {
  if (tab.status != 'complete')
    return;

  if (typeof browser.tabs.discard == 'function') {
    if (tab.url == tab.$TST.discardURLAfterCompletelyLoaded &&
        configs.autoDiscardTabForUnexpectedFocus) {
      log('Try to discard accidentally restored tab (on restored) ', dumpTab(tab));
      wait(configs.autoDiscardTabForUnexpectedFocusDelay).then(() => {
        if (!TabsStore.ensureLivingTab(tab) ||
            tab.active)
          return;
        if (tab.status == 'complete')
          browser.tabs.discard(tab.id)
            .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
        else
          tab.$TST.discardOnCompletelyLoaded = true;
      });
    }
    else if (tab.$TST.discardOnCompletelyLoaded && !tab.active) {
      log('Discard accidentally restored tab (on complete) ', dumpTab(tab));
      browser.tabs.discard(tab.id)
        .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
    }
  }
  delete tab.$TST.discardURLAfterCompletelyLoaded;
  delete tab.$TST.discardOnCompletelyLoaded;
});

function setupDelayedExpand(tab) {
  if (!tab)
    return;
  cancelDelayedExpand(tab);
  TabsStore.removeToBeExpandedTab(tab);
  if (!configs.autoExpandOnTabSwitchingShortcuts ||
      !tab.$TST.hasChild ||
      !tab.$TST.subtreeCollapsed ||
      tab.$TST.lockedCollapsed)
    return;
  TabsStore.addToBeExpandedTab(tab);
  tab.$TST.delayedExpand = setTimeout(() => {
    TabsStore.removeToBeExpandedTab(tab);
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
  TabsStore.removeToBeExpandedTab(tab);
}

function cancelAllDelayedExpand(windowId) {
  for (const tab of TabsStore.toBeExpandedTabsInWindow.get(windowId)) {
    cancelDelayedExpand(tab);
  }
}

Tab.onCollapsedStateChanged.addListener((tab, info = {}) => {
  if (info.collapsed)
    tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED_DONE);
  else
    tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED_DONE);
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

    case Constants.kCOMMAND_NOTIFY_START_TAB_SWITCH: {
      log('Constants.kCOMMAND_NOTIFY_START_TAB_SWITCH');
      mMaybeTabSwitchingByShortcut = true;
      if (sender.tab.active) {
        const window = TabsStore.windows.get(sender.tab.windowId);
        window.lastActiveTab = sender.tab.id;
      }
    }; break;
    case Constants.kCOMMAND_NOTIFY_END_TAB_SWITCH:
      log('Constants.kCOMMAND_NOTIFY_END_TAB_SWITCH');
      return (async () => {
        if (mTabSwitchedByShortcut &&
            configs.skipCollapsedTabsForTabSwitchingShortcuts) {
          await Tab.waitUntilTracked(sender.tab.id);
          let tab = sender.tab && Tab.get(sender.tab.id);
          if (!tab) {
            const tabs = await browser.tabs.query({ currentWindow: true, active: true }).catch(ApiTabs.createErrorHandler());
            await Tab.waitUntilTracked(tabs[0].id);
            tab = Tab.get(tabs[0].id);
          }
          cancelAllDelayedExpand(tab.windowId);
          if (configs.autoCollapseExpandSubtreeOnSelect &&
              tab &&
              TabsStore.windows.get(tab.windowId).lastActiveTab == tab.id &&
              !tab.$TST.lockedCollapsed) {
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

SidebarConnection.onMessage.addListener(async (windowId, message) => {
  switch (message.type) {
    case Constants.kCOMMAND_SELECT_TAB: {
      await Tab.waitUntilTracked(message.tabId);
      const tab = Tab.get(message.tabId);
      if (!tab)
        return;
      browser.tabs.update(tab.id, { active: true })
        .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
    }; break;
  }
});
