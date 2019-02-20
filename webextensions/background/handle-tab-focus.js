/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  wait,
  dumpTab,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as Tree from '/common/tree.js';

import * as Background from './background.js';

function log(...args) {
  internalLogger('background/handle-tab-focus', ...args);
}


let mTabSwitchedByShortcut       = false;
let mMaybeTabSwitchingByShortcut = false;


Tabs.onActivating.addListener((tab, info = {}) => { // return true if this focusing is overridden.
  log('Tabs.onActivating ', tab.id, info);
  if (tab.dataset.shouldReloadOnSelect) {
    browser.tabs.reload(tab.apiTab.id);
    delete tab.dataset.shouldReloadOnSelect;
  }
  const container = tab.parentNode;
  cancelDelayedExpand(Tabs.getTabById(container.lastActiveTab));
  const shouldSkipCollapsed = (
    !info.byInternalOperation &&
    mMaybeTabSwitchingByShortcut &&
    configs.skipCollapsedTabsForTabSwitchingShortcuts
  );
  mTabSwitchedByShortcut = mMaybeTabSwitchingByShortcut;
  if (Tabs.isCollapsed(tab)) {
    if (!Tabs.getParentTab(tab)) {
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
      for (const ancestor of Tabs.getAncestorTabs(tab)) {
        Tree.collapseExpandSubtree(ancestor, {
          collapsed: false,
          broadcast: true
        });
      }
      handleNewActiveTab(tab, info);
    }
    else {
      log('=> reaction for focusing collapsed descendant');
      let newSelection = Tabs.getVisibleAncestorOrSelf(tab);
      if (!newSelection) // this seems invalid case...
        return false;
      if (shouldSkipCollapsed &&
          container.lastActiveTab == newSelection.id) {
        newSelection = Tabs.getNextVisibleTab(newSelection) || Tabs.getFirstVisibleTab(tab);
      }
      container.lastActiveTab = newSelection.id;
      if (mMaybeTabSwitchingByShortcut)
        setupDelayedExpand(newSelection);
      TabsInternalOperation.activateTab(newSelection, { silently: true });
      log('Tabs.onActivating: discarded? ', dumpTab(tab), Tabs.isDiscarded(tab));
      if (Tabs.isDiscarded(tab))
        tab.dataset.discardURLAfterCompletelyLoaded = tab.apiTab.url;
      return false;
    }
  }
  else if (info.byActiveTabRemove &&
           (!configs.autoCollapseExpandSubtreeOnSelect ||
            configs.autoCollapseExpandSubtreeOnSelectExceptActiveTabRemove)) {
    log('=> reaction for removing current tab');
    return false;
  }
  else if (Tabs.hasChildTabs(tab) &&
           Tabs.isSubtreeCollapsed(tab) &&
           !shouldSkipCollapsed) {
    log('=> reaction for newly active parent tab');
    handleNewActiveTab(tab, info);
  }
  delete tab.dataset.discardOnCompletelyLoaded;
  container.lastActiveTab = tab.id;
  if (mMaybeTabSwitchingByShortcut)
    setupDelayedExpand(tab);
  return true;
});
function handleNewActiveTab(tab, info = {}) {
  log('handleNewActiveTab: ', dumpTab(tab), info);
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
    if (tab.dataset.discardURLAfterCompletelyLoaded &&
        tab.dataset.discardURLAfterCompletelyLoaded != changeInfo.url)
      delete tab.dataset.discardURLAfterCompletelyLoaded;
  }
});

Tabs.onStateChanged.addListener(tab => {
  if (!tab.apiTab ||
      tab.apiTab.status != 'complete')
    return;

  if (typeof browser.tabs.discard == 'function') {
    if (tab.apiTab.url == tab.dataset.discardURLAfterCompletelyLoaded &&
        configs.autoDiscardTabForUnexpectedFocus) {
      log('Try to discard accidentally restored tab (on restored) ', tab.apiTab.id);
      wait(configs.autoDiscardTabForUnexpectedFocusDelay).then(() => {
        if (!Tabs.ensureLivingTab(tab) ||
            tab.apiTab.active)
          return;
        if (tab.apiTab.status == 'complete')
          browser.tabs.discard(tab.apiTab.id);
        else
          tab.dataset.discardOnCompletelyLoaded = true;
      });
    }
    else if (tab.dataset.discardOnCompletelyLoaded && !tab.apiTab.active) {
      log('Discard accidentally restored tab (on complete) ', tab.apiTab.id);
      browser.tabs.discard(tab.apiTab.id);
    }
  }
  delete tab.dataset.discardURLAfterCompletelyLoaded;
  delete tab.dataset.discardOnCompletelyLoaded;
});

function setupDelayedExpand(tab) {
  if (!tab)
    return;
  cancelDelayedExpand(tab);
  if (!configs.autoExpandOnTabSwitchingShortcuts ||
      !Tabs.hasChildTabs(tab) ||
      !Tabs.isSubtreeCollapsed(tab))
    return;
  tab.delayedExpand = setTimeout(() => {
    Tree.collapseExpandTreesIntelligentlyFor(tab, {
      broadcast: true
    });
  }, configs.autoExpandOnTabSwitchingShortcutsDelay);
}

function cancelDelayedExpand(tab) {
  if (!tab ||
      !tab.delayedExpand)
    return;
  clearTimeout(tab.delayedExpand);
  delete tab.delayedExpand;
}

function cancelAllDelayedExpand(hint) {
  for (const tab of Tabs.getAllTabs(hint)) {
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
          await Tabs.waitUntilTabsAreCreated(sender.tab);
          let tab = sender.tab && Tabs.getTabById(sender.tab);
          if (!tab) {
            const apiTabs = await browser.tabs.query({ currentWindow: true, active: true });
            await Tabs.waitUntilTabsAreCreated(apiTabs[0].id);
            tab = Tabs.getTabById(apiTabs[0]);
          }
          cancelAllDelayedExpand(tab);
          if (configs.autoCollapseExpandSubtreeOnSelect &&
              tab &&
              tab.parentNode.lastActiveTab == tab.id) {
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
