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

import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TabsOpen from '/common/tabs-open.js';
import * as TabsGroup from '/common/tabs-group.js';
import * as Tree from '/common/tree.js';
import * as SidebarStatus from '/common/sidebar-status.js';

import * as Background from './background.js';

function log(...args) {
  internalLogger('background/handle-removed-tabs', ...args);
}


Tabs.onRemoving.addListener(async (tab, removeInfo = {}) => {
  log('Tabs.onRemoving ', dumpTab(tab), tab.apiTab, removeInfo);
  if (removeInfo.isWindowClosing)
    return;

  let closeParentBehavior = Tree.getCloseParentBehaviorForTabWithSidebarOpenState(tab, removeInfo);
  if (!SidebarStatus.isOpen(tab.apiTab.windowId) &&
      closeParentBehavior != Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
      Tabs.isSubtreeCollapsed(tab))
    Tree.collapseExpandSubtree(tab, {
      collapsed: false,
      justNow:   true,
      broadcast: false // because the tab is going to be closed, broadcasted Tree.collapseExpandSubtree can be ignored.
    });

  const wasActive = Tabs.isActive(tab);
  if (!(await tryGrantCloseTab(tab, closeParentBehavior)))
    return;

  if (typeof browser.tabs.moveInSuccession != 'function') { // on Firefox 64 or older
    const nextTab = closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN && Tabs.getNextSiblingTab(tab) || Tabs.getNextTab(tab);
    Tree.tryMoveFocusFromClosingCurrentTab(tab, {
      wasActive,
      params: {
        active:          wasActive,
        nextTab:         nextTab && nextTab.id,
        nextTabUrl:      nextTab && nextTab.apiTab.url,
        nextIsDiscarded: Tabs.isDiscarded(nextTab)
      }
    });
  }

  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    await closeChildTabs(tab);

  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB &&
      Tabs.getChildTabs(tab).length > 1) {
    log('trying to replace the closing tab with a new group tab');
    const firstChild = Tabs.getFirstChildTab(tab);
    const uri = TabsGroup.makeGroupTabURI({
      title:     browser.i18n.getMessage('groupTab_label', firstChild.apiTab.title),
      temporary: true
    });
    tab.parentNode.toBeOpenedTabsWithPositions++;
    const groupTab = await TabsOpen.openURIInTab(uri, {
      windowId:     tab.apiTab.windowId,
      insertBefore: tab, // not firstChild, because the "tab" is disappeared from tree.
      inBackground: true
    });
    log('group tab: ', dumpTab(groupTab));
    if (!groupTab) // the window is closed!
      return;
    await Tree.attachTabTo(groupTab, tab, {
      insertBefore: firstChild,
      broadcast:    true
    });
    closeParentBehavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;
  }

  Tree.detachAllChildren(tab, {
    behavior:  closeParentBehavior,
    broadcast: true
  });
  //reserveCloseRelatedTabs(toBeClosedTabs);
  Tree.detachTab(tab, {
    dontUpdateIndent: true,
    broadcast:        true
  });
});

async function tryGrantCloseTab(tab, closeParentBehavior) {
  log('tryGrantClose: ', { alreadyGranted: configs.grantedRemovingTabIds, closing: tab.apiTab.id });
  const alreadyGranted = configs.grantedRemovingTabIds.includes(tab.apiTab.id);
  configs.grantedRemovingTabIds = configs.grantedRemovingTabIds.filter(id => id != tab.apiTab.id);
  if (alreadyGranted)
    return true;

  const self = tryGrantCloseTab;

  self.closingTabIds.push(tab.id);
  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN) {
    self.closingDescendantTabIds = self.closingDescendantTabIds
      .concat(Tree.getClosingTabsFromParent(tab).map(tab => tab.apiTab.id));
    self.closingDescendantTabIds = Array.from(new Set(self.closingDescendantTabIds));
  }

  // this is required to wait until the closing tab is stored to the "recently closed" list
  await wait(0);
  if (self.promisedGrantedToCloseTabs)
    return self.promisedGrantedToCloseTabs;

  self.closingTabWasActive = self.closingTabWasActive || Tabs.isActive(tab);

  let shouldRestoreCount;
  self.promisedGrantedToCloseTabs = wait(10).then(async () => {
    self.closingTabIds = Array.from(new Set(self.closingTabIds));
    self.closingDescendantTabIds = self.closingDescendantTabIds.filter(id => !self.closingTabIds.includes(id))
    self.closingDescendantTabIds = Array.from(new Set(self.closingDescendantTabIds));
    let allClosingTabs = [tab.apiTab.id].concat(self.closingDescendantTabIds);
    allClosingTabs = Array.from(new Set(allClosingTabs));
    shouldRestoreCount = self.closingTabIds.length;
    if (allClosingTabs.length > 0) {
      log('tryGrantClose: show confirmation for ', allClosingTabs);
      return Background.confirmToCloseTabs(allClosingTabs, {
        windowId: tab.apiTab.windowId
      });
    }
    return true;
  })
    .then(async (granted) => {
      // remove the closed tab itself because it is already closed!
      configs.grantedRemovingTabIds = configs.grantedRemovingTabIds.filter(id => id != tab.apiTab.id);
      if (granted)
        return true;
      log(`tryGrantClose: not granted, restore ${shouldRestoreCount} tabs`);
      const sessions = await browser.sessions.getRecentlyClosed({ maxResults: shouldRestoreCount * 2 });
      const toBeRestoredTabs = [];
      for (const session of sessions) {
        if (!session.tab)
          continue;
        toBeRestoredTabs.push(session.tab);
        if (toBeRestoredTabs.length == shouldRestoreCount)
          break;
      }
      for (const tab of toBeRestoredTabs.reverse()) {
        log('tryGrantClose: Tabrestoring session = ', tab);
        browser.sessions.restore(tab.sessionId);
        const tabs = await Tabs.waitUntilAllTabsAreCreated();
        await Promise.all(tabs.map(tab => tab.opened));
      }
      return false;
    });

  const granted = await self.promisedGrantedToCloseTabs;
  self.closingTabIds              = [];
  self.closingDescendantTabIds    = [];
  self.closingTabWasActive        = false;
  self.promisedGrantedToCloseTabs = null;
  return granted;
}
tryGrantCloseTab.closingTabIds              = [];
tryGrantCloseTab.closingDescendantTabIds    = [];
tryGrantCloseTab.closingTabWasActive        = false;
tryGrantCloseTab.promisedGrantedToCloseTabs = null;

async function closeChildTabs(parent) {
  const tabs = Tabs.getDescendantTabs(parent);
  //if (!fireTabSubtreeClosingEvent(parent, tabs))
  //  return;

  //markAsClosedSet([parent].concat(tabs));
  // close bottom to top!
  await Promise.all(tabs.reverse().map(tab => {
    return TabsInternalOperation.removeTab(tab);
  }));
  //fireTabSubtreeClosedEvent(parent, tabs);
}

Tabs.onRemoved.addListener((tab, _info) => {
  configs.grantedRemovingTabIds = configs.grantedRemovingTabIds.filter(id => id != tab.apiTab.id);
});

browser.windows.onRemoved.addListener(windowId  => {
  const removeTabIds = Tabs.getAllTabs(windowId).map(tab => tab.apiTab.id);
  configs.grantedRemovingTabIds = configs.grantedRemovingTabIds.filter(id => !removeTabIds.includes(id));
});


Tabs.onDetached.addListener((tab, info = {}) => {
  if (typeof browser.tabs.moveInSuccession != 'function') { // on Firefox 64 or older
    if (Tree.shouldApplyTreeBehavior(info)) {
      Tree.tryMoveFocusFromClosingCurrentTabNow(tab, {
        ignoredTabs: Tabs.getDescendantTabs(tab)
      });
      return;
    }

    Tree.tryMoveFocusFromClosingCurrentTab(tab);
  }

  log('Tabs.onDetached ', dumpTab(tab));
  let closeParentBehavior = Tree.getCloseParentBehaviorForTabWithSidebarOpenState(tab, info);
  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    closeParentBehavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  Tree.detachAllChildren(tab, {
    behavior: closeParentBehavior,
    broadcast: true
  });
  //reserveCloseRelatedTabs(toBeClosedTabs);
  Tree.detachTab(tab, {
    dontUpdateIndent: true,
    broadcast:        true
  });
  //restoreTabAttributes(tab, backupAttributes);
});
