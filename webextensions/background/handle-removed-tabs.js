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
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as TabsInternalOperation from '../common/tabs-internal-operation.js';
import * as TabsOpen from '../common/tabs-open.js';
import * as TabsGroup from '../common/tabs-group.js';
import * as TabsContainer from '../common/tabs-container.js';
import * as Tree from '../common/tree.js';
import * as SidebarStatus from '../common/sidebar-status.js';

import * as Background from './background.js';

function log(...aArgs) {
  if (configs.logFor['background/handle-removed-tabs'])
    internalLogger(...aArgs);
}


Tabs.onRemoving.addListener(async (aTab, aCloseInfo = {}) => {
  log('Tabs.onRemoving ', dumpTab(aTab), aTab.apiTab, aCloseInfo);

  const ancestors = Tabs.getAncestorTabs(aTab);
  let closeParentBehavior = Tree.getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aCloseInfo);
  if (!SidebarStatus.isOpen(aTab.apiTab.windowId) &&
      closeParentBehavior != Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
      Tabs.isSubtreeCollapsed(aTab))
    Tree.collapseExpandSubtree(aTab, {
      collapsed: false,
      justNow:   true,
      broadcast: false // because the tab is going to be closed, broadcasted Tree.collapseExpandSubtree can be ignored.
    });

  const wasActive = Tabs.isActive(aTab);
  if (!(await tryGrantCloseTab(aTab, closeParentBehavior)))
    return;

  const nextTab = closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN && Tabs.getNextSiblingTab(aTab) || aTab.nextSibling;
  Tree.tryMoveFocusFromClosingCurrentTab(aTab, {
    wasActive,
    params: {
      active:          wasActive,
      nextTab:         nextTab && nextTab.id,
      nextTabUrl:      nextTab && nextTab.apiTab.url,
      nextIsDiscarded: Tabs.isDiscarded(nextTab)
    }
  });

  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    await closeChildTabs(aTab);

  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB &&
      Tabs.getChildTabs(aTab).length > 1) {
    log('trying to replace the closing tab with a new group tab');
    const firstChild = Tabs.getFirstChildTab(aTab);
    const uri = TabsGroup.makeGroupTabURI({
      title:     browser.i18n.getMessage('groupTab_label', firstChild.apiTab.title),
      temporary: true
    });
    TabsContainer.incrementCounter(aTab.parentNode, 'toBeOpenedTabsWithPositions');
    const groupTab = await TabsOpen.openURIInTab(uri, {
      windowId:     aTab.apiTab.windowId,
      insertBefore: aTab, // not firstChild, because the "aTab" is disappeared from tree.
      inBackground: true
    });
    log('group tab: ', dumpTab(groupTab));
    if (!groupTab) // the window is closed!
      return;
    await Tree.attachTabTo(groupTab, aTab, {
      insertBefore: firstChild,
      broadcast:    true
    });
    closeParentBehavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;
  }

  Tree.detachAllChildren(aTab, {
    behavior:  closeParentBehavior,
    broadcast: true
  });
  //reserveCloseRelatedTabs(toBeClosedTabs);
  Tree.detachTab(aTab, {
    dontUpdateIndent: true,
    broadcast:        true
  });

  Background.reserveToCleanupNeedlessGroupTab(ancestors);
});

async function tryGrantCloseTab(aTab, aCloseParentBehavior) {
  const self = tryGrantCloseTab;

  self.closingTabIds.push(aTab.id);
  if (aCloseParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    self.closingDescendantTabIds = self.closingDescendantTabIds
      .concat(Tree.getClosingTabsFromParent(aTab).map(aTab => aTab.id));

  // this is required to wait until the closing tab is stored to the "recently closed" list
  await wait(0);
  if (self.promisedGrantedToCloseTabs)
    return self.promisedGrantedToCloseTabs;

  self.closingTabWasActive = self.closingTabWasActive || Tabs.isActive(aTab);

  let shouldRestoreCount;
  self.promisedGrantedToCloseTabs = wait(10).then(async () => {
    let foundTabs = {};
    self.closingTabIds = self.closingTabIds
      .filter(aId => !foundTabs[aId] && (foundTabs[aId] = true)); // uniq

    foundTabs = {};
    self.closingDescendantTabIds = self.closingDescendantTabIds
      .filter(aId => !foundTabs[aId] && (foundTabs[aId] = true) && !self.closingTabIds.includes(aId));

    shouldRestoreCount = self.closingDescendantTabIds.length;
    if (shouldRestoreCount > 0) {
      return Background.confirmToCloseTabs(shouldRestoreCount + 1, {
        windowId: aTab.apiTab.windowId
      });
    }
    return true;
  })
    .then(async (aGranted) => {
      if (aGranted)
        return true;
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
        await Promise.all(tabs.map(aTab => aTab.opened));
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

async function closeChildTabs(aParent) {
  const tabs = Tabs.getDescendantTabs(aParent);
  //if (!fireTabSubtreeClosingEvent(aParent, tabs))
  //  return;

  //markAsClosedSet([aParent].concat(tabs));
  // close bottom to top!
  await Promise.all(tabs.reverse().map(aTab => {
    return TabsInternalOperation.removeTab(aTab);
  }));
  //fireTabSubtreeClosedEvent(aParent, tabs);
}


Tabs.onDetached.addListener((aTab, aInfo = {}) => {
  if (Tree.shouldApplyTreeBehavior(aInfo)) {
    Tree.tryMoveFocusFromClosingCurrentTabNow(aTab, {
      ignoredTabs: Tabs.getDescendantTabs(aTab)
    });
    return;
  }

  Tree.tryMoveFocusFromClosingCurrentTab(aTab);

  log('Tabs.onDetached ', dumpTab(aTab));
  let closeParentBehavior = Tree.getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aInfo);
  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    closeParentBehavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  Tree.detachAllChildren(aTab, {
    behavior: closeParentBehavior,
    broadcast: true
  });
  //reserveCloseRelatedTabs(toBeClosedTabs);
  Tree.detachTab(aTab, {
    dontUpdateIndent: true,
    broadcast:        true
  });
  //restoreTabAttributes(aTab, backupAttributes);
});
