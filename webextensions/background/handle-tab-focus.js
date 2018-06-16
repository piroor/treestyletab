/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  dumpTab,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as TabsInternalOperation from '../common/tabs-internal-operation.js';
import * as Tree from '../common/tree.js';

import * as Background from './background.js';


let gTabSwitchedByShortcut       = false;
let gMaybeTabSwitchingByShortcut = false;


Tabs.onActivating.addListener((aTab, aInfo = {}) => { // return true if this focusing is overridden.
  log('Tabs.onActivating ', aTab.id, aInfo);
  if (aTab.dataset.shouldReloadOnSelect) {
    browser.tabs.reload(aTab.apiTab.id);
    delete aTab.dataset.shouldReloadOnSelect;
  }
  const container = aTab.parentNode;
  cancelDelayedExpand(Tabs.getTabById(container.lastFocusedTab));
  const shouldSkipCollapsed = (
    !aInfo.byInternalOperation &&
    gMaybeTabSwitchingByShortcut &&
    configs.skipCollapsedTabsForTabSwitchingShortcuts
  );
  gTabSwitchedByShortcut = gMaybeTabSwitchingByShortcut;
  if (Tabs.isCollapsed(aTab)) {
    if (!Tabs.getParentTab(aTab)) {
      // This is invalid case, generally never should happen,
      // but actually happen on some environment:
      // https://github.com/piroor/treestyletab/issues/1717
      // So, always expand orphan collapsed tab as a failsafe.
      Tree.collapseExpandTab(aTab, {
        collapsed: false,
        broadcast: true
      });
      handleNewActiveTab(aTab, aInfo);
    }
    else if (configs.autoExpandOnCollapsedChildFocused &&
             !shouldSkipCollapsed) {
      log('=> reaction for autoExpandOnCollapsedChildFocused');
      for (const ancestor of Tabs.getAncestorTabs(aTab)) {
        Tree.collapseExpandSubtree(ancestor, {
          collapsed: false,
          broadcast: true
        });
      }
      handleNewActiveTab(aTab, aInfo);
    }
    else {
      log('=> reaction for focusing collapsed descendant');
      let newSelection = Tabs.getVisibleAncestorOrSelf(aTab);
      if (!newSelection) // this seems invalid case...
        return false;
      if (shouldSkipCollapsed &&
          container.lastFocusedTab == newSelection.id) {
        newSelection = Tabs.getNextVisibleTab(newSelection) || Tabs.getFirstVisibleTab(aTab);
      }
      container.lastFocusedTab = newSelection.id;
      if (gMaybeTabSwitchingByShortcut)
        setupDelayedExpand(newSelection);
      TabsInternalOperation.selectTab(newSelection, { silently: true });
      log('Tabs.onActivating: discarded? ', dumpTab(aTab), Tabs.isDiscarded(aTab));
      if (Tabs.isDiscarded(aTab))
        aTab.dataset.discardURLAfterCompletelyLoaded = aTab.apiTab.url;
      return false;
    }
  }
  else if (aInfo.byCurrentTabRemove &&
           (!configs.autoCollapseExpandSubtreeOnSelect ||
            configs.autoCollapseExpandSubtreeOnSelectExceptCurrentTabRemove)) {
    log('=> reaction for removing current tab');
    return false;
  }
  else if (Tabs.hasChildTabs(aTab) &&
           Tabs.isSubtreeCollapsed(aTab) &&
           !shouldSkipCollapsed) {
    log('=> reaction for newly focused parent tab');
    handleNewActiveTab(aTab, aInfo);
  }
  container.lastFocusedTab = aTab.id;
  if (gMaybeTabSwitchingByShortcut)
    setupDelayedExpand(aTab);
  Background.tryInitGroupTab(aTab);
  return true;
});
function handleNewActiveTab(aTab, aInfo = {}) {
  log('handleNewActiveTab: ', dumpTab(aTab), aInfo);
  const shouldCollapseExpandNow = configs.autoCollapseExpandSubtreeOnSelect;
  const canCollapseTree         = shouldCollapseExpandNow;
  const canExpandTree           = shouldCollapseExpandNow && !aInfo.silently;
  if (canExpandTree) {
    if (canCollapseTree &&
        configs.autoExpandIntelligently)
      Tree.collapseExpandTreesIntelligentlyFor(aTab, {
        broadcast: true
      });
    else
      Tree.collapseExpandSubtree(aTab, {
        collapsed: false,
        broadcast: true
      });
  }
}

function setupDelayedExpand(aTab) {
  if (!aTab)
    return;
  cancelDelayedExpand(aTab);
  if (!configs.autoExpandOnTabSwitchingShortcuts ||
      !Tabs.hasChildTabs(aTab) ||
      !Tabs.isSubtreeCollapsed(aTab))
    return;
  aTab.delayedExpand = setTimeout(() => {
    Tree.collapseExpandTreesIntelligentlyFor(aTab, {
      broadcast: true
    });
  }, configs.autoExpandOnTabSwitchingShortcutsDelay);
}

function cancelDelayedExpand(aTab) {
  if (!aTab ||
      !aTab.delayedExpand)
    return;
  clearTimeout(aTab.delayedExpand);
  delete aTab.delayedExpand;
}

function cancelAllDelayedExpand(aHint) {
  for (const tab of Tabs.getAllTabs(aHint)) {
    cancelDelayedExpand(tab);
  }
}

Tabs.onCollapsedStateChanged.addListener((aTab, aInfo = {}) => {
  if (aInfo.collapsed)
    aTab.classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
  else
    aTab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);
});


Background.onInit.addListener(() => {
  browser.windows.onFocusChanged.addListener(() => {
    gMaybeTabSwitchingByShortcut = false;
  });
});

Background.onBuilt.addListener(() => {
  browser.runtime.onMessage.addListener(onMessage);
});


function onMessage(aMessage, aSender) {
  if (!aMessage ||
      typeof aMessage.type != 'string')
    return;

  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case Constants.kNOTIFY_TAB_MOUSEDOWN:
      gMaybeTabSwitchingByShortcut =
        gTabSwitchedByShortcut = false;
      break;

    case Constants.kCOMMAND_NOTIFY_START_TAB_SWITCH:
      log('Constants.kCOMMAND_NOTIFY_START_TAB_SWITCH');
      gMaybeTabSwitchingByShortcut = true;
      break;
    case Constants.kCOMMAND_NOTIFY_END_TAB_SWITCH:
      log('Constants.kCOMMAND_NOTIFY_END_TAB_SWITCH');
      return (async () => {
        if (gTabSwitchedByShortcut &&
            configs.skipCollapsedTabsForTabSwitchingShortcuts) {
          await Tabs.waitUntilTabsAreCreated(aSender.tab);
          let tab = aSender.tab && Tabs.getTabById(aSender.tab);
          if (!tab) {
            const apiTabs = await browser.tabs.query({ currentWindow: true, active: true });
            await Tabs.waitUntilTabsAreCreated(apiTabs[0].id);
            tab = Tabs.getTabById(apiTabs[0]);
          }
          cancelAllDelayedExpand(tab);
          if (configs.autoCollapseExpandSubtreeOnSelect &&
              tab &&
              tab.parentNode.lastFocusedTab == tab.id) {
            Tree.collapseExpandSubtree(tab, {
              collapsed: false,
              broadcast: true
            });
          }
        }
        gMaybeTabSwitchingByShortcut =
          gTabSwitchedByShortcut = false;
      })();
  }
}
