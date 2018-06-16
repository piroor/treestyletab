/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  dumpTab,
  wait,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as ApiTabs from '../common/api-tabs.js';
import * as Tabs from '../common/tabs.js';
import * as TabsInternalOperation from '../common/tabs-internal-operation.js';
import * as TabsMove from '../common/tabs-move.js';
import * as TabsOpen from '../common/tabs-open.js';
import * as TabsGroup from '../common/tabs-group.js';
import * as TabsContainer from '../common/tabs-container.js';
import * as Tree from '../common/tree.js';
import * as TSTAPI from '../common/tst-api.js';
import * as SidebarStatus from '../common/sidebar-status.js';
import * as Commands from '../common/commands.js';
import * as Permissions from '../common/permissions.js';

import * as Background from './background.js';
import * as BackgroundCache from './background-cache.js';
import * as TreeStructure from './tree-structure.js';


let gInitialized                 = false;
let gTabSwitchedByShortcut       = false;
let gMaybeTabSwitchingByShortcut = false;


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

Tree.onAttached.addListener(async (aTab, aInfo = {}) => {
  const parent = aInfo.parent;
  if (aTab.apiTab.openerTabId != parent.apiTab.id &&
      configs.syncParentTabAndOpenerTab) {
    aTab.apiTab.openerTabId = parent.apiTab.id;
    aTab.apiTab.TSTUpdatedOpenerTabId = aTab.apiTab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(aTab.apiTab.id, { openerTabId: parent.apiTab.id })
      .catch(ApiTabs.handleMissingTabError);
  }

  // Because the tab is possibly closing for "reopen" operation,
  // we need to apply "forceExpand" immediately. Otherwise, when
  // the tab is closed with "subtree collapsed" state, descendant
  // tabs are also closed even if "forceExpand" is "true".
  if (aInfo.newlyAttached &&
      gInitialized) {
    if (Tabs.isSubtreeCollapsed(aInfo.parent) &&
        !aInfo.forceExpand)
      Tree.collapseExpandTabAndSubtree(aTab, {
        collapsed: true,
        justNow:   true,
        broadcast: true
      });

    const isNewTreeCreatedManually = !aInfo.justNow && Tabs.getChildTabs(parent).length == 1;
    if (aInfo.forceExpand) {
      Tree.collapseExpandSubtree(parent, Object.assign({}, aInfo, {
        collapsed: false,
        inRemote:  false
      }));
    }
    if (!aInfo.dontExpand) {
      if (configs.autoCollapseExpandSubtreeOnAttach &&
          (isNewTreeCreatedManually || Tree.shouldTabAutoExpanded(parent)))
        Tree.collapseExpandTreesIntelligentlyFor(parent, {
          broadcast: true
        });

      const newAncestors = [parent].concat(Tabs.getAncestorTabs(parent));
      if (configs.autoCollapseExpandSubtreeOnSelect ||
          isNewTreeCreatedManually ||
          Tree.shouldTabAutoExpanded(parent) ||
          aInfo.forceExpand) {
        newAncestors.filter(Tabs.isSubtreeCollapsed).forEach(aAncestor => {
          Tree.collapseExpandSubtree(aAncestor, Object.assign({}, aInfo, {
            collapsed: false,
            broadcast: true
          }));
        });
      }
      if (Tabs.isCollapsed(parent))
        Tree.collapseExpandTabAndSubtree(aTab, Object.assign({}, aInfo, {
          collapsed: true,
          broadcast: true
        }));
    }
    else if (Tree.shouldTabAutoExpanded(parent) ||
             Tabs.isCollapsed(parent)) {
      Tree.collapseExpandTabAndSubtree(aTab, Object.assign({}, aInfo, {
        collapsed: true,
        broadcast: true
      }));
    }
  }

  await Promise.all([
    Tabs.isOpening(aTab) && aTab.opened,
    !aInfo.dontMove && (async () => {
      let nextTab = aInfo.insertBefore;
      let prevTab = aInfo.insertAfter;
      if (!nextTab && !prevTab) {
        const tabs = Tabs.getAllTabs(aTab);
        nextTab = tabs[aInfo.newIndex];
        if (!nextTab)
          prevTab = tabs[aInfo.newIndex - 1];
      }
      log('move newly attached child: ', dumpTab(aTab), {
        next: dumpTab(nextTab),
        prev: dumpTab(prevTab)
      });
      if (nextTab)
        await Tree.moveTabSubtreeBefore(aTab, nextTab, Object.assign({}, aInfo, {
          broadcast: true
        }));
      else
        await Tree.moveTabSubtreeAfter(aTab, prevTab, Object.assign({}, aInfo, {
          broadcast: true
        }));
    })()
  ]);

  if (!Tabs.ensureLivingTab(aTab) || // not removed while waiting
      Tabs.getParentTab(aTab) != aInfo.parent) // not detached while waiting
    return;

  browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_TAB_ATTACHED_COMPLETELY,
    tab:    aTab.id,
    parent: parent.id,
    newlyAttached: aInfo.newlyAttached
  });

  if (aInfo.newlyAttached)
    Background.reserveToUpdateAncestors([aTab].concat(Tabs.getDescendantTabs(aTab)));
  Background.reserveToUpdateChildren(parent);
  Background.reserveToUpdateInsertionPosition([
    aTab,
    Tabs.getNextTab(aTab),
    Tabs.getPreviousTab(aTab)
  ]);

  Background.reserveToUpdateRelatedGroupTabs(aTab);
});

Tree.onDetached.addListener(async (aTab, _aDetachInfo) => {
  if (aTab.apiTab.openerTabId &&
      configs.syncParentTabAndOpenerTab) {
    aTab.apiTab.openerTabId = aTab.apiTab.id;
    aTab.apiTab.TSTUpdatedOpenerTabId = aTab.apiTab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(aTab.apiTab.id, { openerTabId: aTab.apiTab.id }) // set self id instead of null, because it requires any valid tab id...
      .catch(ApiTabs.handleMissingTabError);
  }
});

Tabs.onAttached.addListener(async (aTab, aInfo = {}) => {
  if (!aInfo.windowId ||
      !Tree.shouldApplyTreeBehavior(aInfo))
    return;

  log('Tabs.onAttached ', dumpTab(aTab), aInfo);

  log('descendants of attached tab: ', aInfo.descendants.map(dumpTab));
  const movedTabs = await Tree.moveTabs(aInfo.descendants, {
    destinationWindowId: aTab.apiTab.windowId,
    insertAfter:         aTab
  });
  log('moved descendants: ', movedTabs.map(dumpTab));
  for (const movedTab of movedTabs) {
    if (Tabs.getParentTab(movedTab))
      continue;
    Tree.attachTabTo(movedTab, aTab, {
      broadcast: true,
      dontMove:  true
    });
  }
});

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

Tabs.onPinned.addListener(aTab => {
  Tree.collapseExpandSubtree(aTab, {
    collapsed: false,
    broadcast: true
  });
  Tree.detachAllChildren(aTab, {
    behavior: Tree.getCloseParentBehaviorForTabWithSidebarOpenState(aTab, {
      keepChildren: true
    }),
    broadcast: true
  });
  Tree.detachTab(aTab, {
    broadcast: true
  });
  Tree.collapseExpandTabAndSubtree(aTab, { collapsed: false });
});

Tabs.onGroupTabDetected.addListener(aTab => {
  Background.tryInitGroupTab(aTab);
});


/* message observer */

Background.onInit.addListener(() => {
  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
  browser.commands.onCommand.addListener(onShortcutCommand);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  browser.windows.onFocusChanged.addListener(() => {
    gMaybeTabSwitchingByShortcut = false;
  });
});

Background.onBuilt.addListener(() => {
  browser.runtime.onMessage.addListener(onMessage);
});

Background.onReady.addListener(() => {
  gInitialized = true;
});

Background.onDestroy.addListener(() => {
  browser.runtime.onMessage.removeListener(onMessage);
  browser.runtime.onMessageExternal.removeListener(onMessageExternal);
  browser.browserAction.onClicked.removeListener(onToolbarButtonClick);
});


function onToolbarButtonClick(aTab) {
  if (Permissions.requestPostProcess())
    return;

  if (SidebarStatus.isOpen(aTab.windowId))
    browser.sidebarAction.close();
  else
    browser.sidebarAction.open();
}

async function onShortcutCommand(aCommand) {
  const activeTab = Tabs.getTabById((await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0]);

  switch (aCommand) {
    case '_execute_browser_action':
      return;

    case 'reloadTree':
      Commands.reloadTree(activeTab);
      return;
    case 'reloadDescendants':
      Commands.reloadDescendants(activeTab);
      return;
    case 'closeTree':
      Commands.closeTree(activeTab);
      return;
    case 'closeDescendants':
      Commands.closeDescendants(activeTab);
      return;
    case 'closeOthers':
      Commands.closeOthers(activeTab);
      return;
    case 'collapseAll':
      Commands.collapseAll(activeTab);
      return;
    case 'expandAll':
      Commands.expandAll(activeTab);
      return;
    case 'bookmarkTree':
      Commands.bookmarkTree(activeTab);
      return;

    case 'newIndependentTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_ORPHAN
      });
      return;
    case 'newChildTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_CHILD
      });
      return;
    case 'newSiblingTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_SIBLING
      });
      return;
    case 'newNextSiblingTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING
      });
      return;

    case 'newContainerTab':
      return browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SHOW_CONTAINER_SELECTOR,
        windowId: activeTab.apiTab.windowId
      });

    case 'indent':
      Commands.indent(activeTab, { followChildren: true });
      return;
    case 'outdent':
      Commands.outdent(activeTab, { followChildren: true });
      return;

    case 'tabMoveUp':
      Commands.moveUp(activeTab, { followChildren: false });
      return;
    case 'treeMoveUp':
      Commands.moveUp(activeTab, { followChildren: true });
      return;
    case 'tabMoveDown':
      Commands.moveDown(activeTab, { followChildren: false });
      return;
    case 'treeMoveDown':
      Commands.moveDown(activeTab, { followChildren: true });
      return;

    case 'focusPrevious':
      TabsInternalOperation.selectTab(Tabs.getPreviousSiblingTab(activeTab), { silently: false });
      return;
    case 'focusPreviousSilently':
      TabsInternalOperation.selectTab(Tabs.getPreviousSiblingTab(activeTab), { silently: true });
      return;
    case 'focusNext':
      TabsInternalOperation.selectTab(Tabs.getNextSiblingTab(activeTab), { silently: false });
      return;
    case 'focusNextSilently':
      TabsInternalOperation.selectTab(Tabs.getNextSiblingTab(activeTab), { silently: true });
      return;

    case 'tabbarUp':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'lineup'
      });
      return;
    case 'tabbarPageUp':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'pageup'
      });
      return;
    case 'tabbarHome':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        to:       'top'
      });
      return;

    case 'tabbarDown':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'linedown'
      });
      return;
    case 'tabbarPageDown':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'pagedown'
      });
      return;
    case 'tabbarEnd':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        to:       'bottom'
      });
      return;
  }
}

function onMessage(aMessage, aSender) {
  if (!aMessage ||
      typeof aMessage.type != 'string' ||
      aMessage.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case Constants.kCOMMAND_PING_TO_BACKGROUND:
      return Promise.resolve(true);

    case Constants.kCOMMAND_REQUEST_UNIQUE_ID:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.id);
        const tab = Tabs.getTabById(aMessage.id);
        if (tab && !aMessage.forceNew)
          return tab.uniqueId;
        return Tabs.requestUniqueId(aMessage.id, {
          forceNew: aMessage.forceNew
        });
      })();

    case Constants.kCOMMAND_PULL_TREE_STRUCTURE:
      return (async () => {
        while (!gInitialized) {
          await wait(10);
        }
        const structure = Tree.getTreeStructureFromTabs(Tabs.getAllTabs(aMessage.windowId));
        return { structure };
      })();

    case Constants.kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        const params = {
          collapsed: aMessage.collapsed,
          justNow:   aMessage.justNow,
          broadcast: true,
          stack:     aMessage.stack
        };
        if (aMessage.manualOperation)
          Tree.manualCollapseExpandSubtree(tab, params);
        else
          Tree.collapseExpandSubtree(tab, params);
        if (gInitialized)
          TreeStructure.reserveToSaveTreeStructure(tab);
        BackgroundCache.markWindowCacheDirtyFromTab(tab, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
      })();

    case Constants.kCOMMAND_LOAD_URI:
      return TabsOpen.loadURI(aMessage.uri, Object.assign({}, aMessage.options, {
        tab:      Tabs.getTabById(aMessage.options.tab),
        inRemote: false
      }));

    case Constants.kCOMMAND_NEW_TABS:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        log('new tabs requested: ', aMessage);
        return await TabsOpen.openURIsInTabs(aMessage.uris, Object.assign({}, aMessage, {
          parent:       Tabs.getTabById(aMessage.parent),
          insertBefore: Tabs.getTabById(aMessage.insertBefore),
          insertAfter:  Tabs.getTabById(aMessage.insertAfter)
        }));
      })();

    case Constants.kCOMMAND_NEW_WINDOW_FROM_TABS:
      return (async () => {
        log('new window requested: ', aMessage);
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs);
        const movedTabs = await Tree.openNewWindowFromTabs(
          aMessage.tabs.map(Tabs.getTabById),
          aMessage
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case Constants.kCOMMAND_MOVE_TABS:
      return (async () => {
        log('move tabs requested: ', aMessage);
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.insertBefore, aMessage.insertAfter]));
        const movedTabs = await Tree.moveTabs(
          aMessage.tabs.map(Tabs.getTabById),
          Object.assign({}, aMessage, {
            insertBefore: Tabs.getTabById(aMessage.insertBefore),
            insertAfter:  Tabs.getTabById(aMessage.insertAfter)
          })
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case Constants.kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs);
        return TabsInternalOperation.removeTabs(aMessage.tabs.map(Tabs.getTabById), aMessage.options);
      })();

    case Constants.kNOTIFY_TAB_MOUSEDOWN:
      gMaybeTabSwitchingByShortcut =
        gTabSwitchedByShortcut = false;
      return (async () => {
        if (configs.logOnMouseEvent)
          log('Constants.kNOTIFY_TAB_MOUSEDOWN');
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;

        if (configs.logOnMouseEvent)
          log('Sending message to listeners');
        const serializedTab = TSTAPI.serializeTab(tab);
        const mousedownNotified = TSTAPI.sendMessage(Object.assign({}, aMessage, {
          type:   TSTAPI.kNOTIFY_TAB_MOUSEDOWN,
          tab:    serializedTab,
          window: tab.apiTab.windowId
        }));

        // We must send tab-mouseup after tab-mousedown is notified.
        // So, we return to the caller process and do this post process asynchronously.
        mousedownNotified.then(async (aResults) => {
          const results = aResults.concat(
            await TSTAPI.sendMessage(Object.assign({}, aMessage, {
              type:   TSTAPI.kNOTIFY_TAB_CLICKED,
              tab:    serializedTab,
              window: tab.apiTab.windowId
            }))
          );
          if (results.some(aResult => aResult.result)) // canceled
            return;

          if (configs.logOnMouseEvent)
            log('Ready to select the tab');

          // not canceled, then fallback to default "select tab"
          if (aMessage.button == 0)
            TabsInternalOperation.selectTab(tab);
        });

        return true;
      })();

    case Constants.kCOMMAND_SELECT_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        browser.tabs.update(tab.apiTab.id, { active: true })
          .catch(ApiTabs.handleMissingTabError);
      })();

    case Constants.kCOMMAND_SELECT_TAB_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        TabsInternalOperation.selectTab(tab, Object.assign({}, aMessage.options, {
          inRemote: false
        }));
      })();

    case Constants.kCOMMAND_SET_SUBTREE_MUTED:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        log('set muted state: ', aMessage);
        const root = Tabs.getTabById(aMessage.tab);
        if (!root)
          return;
        const tabs = [root].concat(Tabs.getDescendantTabs(root));
        for (const tab of tabs) {
          const playing = Tabs.isSoundPlaying(tab);
          const muted   = Tabs.isMuted(tab);
          log(`tab ${tab.id}: playing=${playing}, muted=${muted}`);
          if (playing != aMessage.muted)
            continue;

          log(` => set muted=${aMessage.muted}`);

          browser.tabs.update(tab.apiTab.id, {
            muted: aMessage.muted
          }).catch(ApiTabs.handleMissingTabError);

          const add = [];
          const remove = [];
          if (aMessage.muted) {
            add.push(Constants.kTAB_STATE_MUTED);
            tab.classList.add(Constants.kTAB_STATE_MUTED);
          }
          else {
            remove.push(Constants.kTAB_STATE_MUTED);
            tab.classList.remove(Constants.kTAB_STATE_MUTED);
          }

          if (Tabs.isAudible(tab) && !aMessage.muted) {
            add.push(Constants.kTAB_STATE_SOUND_PLAYING);
            tab.classList.add(Constants.kTAB_STATE_SOUND_PLAYING);
          }
          else {
            remove.push(Constants.kTAB_STATE_SOUND_PLAYING);
            tab.classList.remove(Constants.kTAB_STATE_SOUND_PLAYING);
          }

          // tabs.onUpdated is too slow, so users will be confused
          // from still-not-updated tabs (in other words, they tabs
          // are unresponsive for quick-clicks).
          Tabs.broadcastTabState(tab, {
            add, remove,
            bubbles: !Tabs.hasChildTabs(tab)
          });
        }
      })();

    case Constants.kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.nextTab]));
        return TabsMove.moveTabsBefore(
          aMessage.tabs.map(Tabs.getTabById),
          Tabs.getTabById(aMessage.nextTab),
          Object.assign({}, aMessage, {
            broadcast: !!aMessage.broadcasted
          })
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case Constants.kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.previousTab]));
        return TabsMove.moveTabsAfter(
          aMessage.tabs.map(Tabs.getTabById),
          Tabs.getTabById(aMessage.previousTab),
          Object.assign({}, aMessage, {
            broadcast: !!aMessage.broadcasted
          })
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case Constants.kCOMMAND_ATTACH_TAB_TO:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.child,
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        const child  = Tabs.getTabById(aMessage.child);
        const parent = Tabs.getTabById(aMessage.parent);
        if (child && parent)
          await Tree.attachTabTo(child, parent, Object.assign({}, aMessage, {
            insertBefore: Tabs.getTabById(aMessage.insertBefore),
            insertAfter:  Tabs.getTabById(aMessage.insertAfter)
          }));
      })();

    case Constants.kCOMMAND_DETACH_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (tab)
          await Tree.detachTab(tab);
      })();

    case Constants.kCOMMAND_PERFORM_TABS_DRAG_DROP:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.attachTo,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        log('perform tabs dragdrop requested: ', aMessage);
        return Tree.performTabsDragDrop(Object.assign({}, aMessage, {
          attachTo:     Tabs.getTabById(aMessage.attachTo),
          insertBefore: Tabs.getTabById(aMessage.insertBefore),
          insertAfter:  Tabs.getTabById(aMessage.insertAfter)
        }));
      })();

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

    case Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED:
      return (async () => {
        if (JSON.stringify(aMessage.permissions) == JSON.stringify(Permissions.ALL_URLS)) {
          const apiTabs = await browser.tabs.query({});
          await Tabs.waitUntilTabsAreCreated(apiTabs.map(aAPITab => aAPITab.id));
          for (const apiTab of apiTabs) {
            Background.tryStartHandleAccelKeyOnTab(Tabs.getTabById(apiTab));
          }
        }
      })();

    default:
      const API_PREFIX_MATCHER = /^treestyletab:api:/;
      if (API_PREFIX_MATCHER.test(aMessage.type)) {
        aMessage.type = aMessage.type.replace(API_PREFIX_MATCHER, '');
        return onMessageExternal(aMessage, aSender);
      }
      break;
  }
}

function onMessageExternal(aMessage, aSender) {
  //log('onMessageExternal: ', aMessage, aSender);
  switch (aMessage.type) {
    case TSTAPI.kGET_TREE:
      return (async () => {
        const tabs    = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = tabs.map(TSTAPI.serializeTab);
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kCOLLAPSE_TREE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        for (const tab of tabs) {
          Tree.collapseExpandSubtree(tab, {
            collapsed: true,
            broadcast: true
          });
        }
        return true;
      })();

    case TSTAPI.kEXPAND_TREE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        for (const tab of tabs) {
          Tree.collapseExpandSubtree(tab, {
            collapsed: false,
            broadcast: true
          });
        }
        return true;
      })();

    case TSTAPI.kATTACH:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.child,
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        const child  = Tabs.getTabById(aMessage.child);
        const parent = Tabs.getTabById(aMessage.parent);
        if (!child ||
            !parent ||
            child.parentNode != parent.parentNode)
          return false;
        await Tree.attachTabTo(child, parent, {
          broadcast:    true,
          insertBefore: Tabs.getTabById(aMessage.insertBefore),
          insertAfter:  Tabs.getTabById(aMessage.insertAfter)
        });
        return true;
      })();

    case TSTAPI.kDETACH:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return false;
        await Tree.detachTab(tab, {
          broadcast: true
        });
        return true;
      })();

    case TSTAPI.kINDENT:
    case TSTAPI.kDEMOTE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.indent(aTab, aMessage)));
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kOUTDENT:
    case TSTAPI.kPROMOTE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.outdent(aTab, aMessage)));
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kMOVE_UP:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.moveUp(aTab, aMessage)));
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kMOVE_DOWN:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.moveDown(aTab, aMessage)));
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kFOCUS:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        for (const tab of tabs) {
          TabsInternalOperation.selectTab(tab, {
            silently: aMessage.silently
          });
        }
        return TSTAPI.formatResult(tabs.map(() => true), aMessage);
      })();

    case TSTAPI.kDUPLICATE:
      return (async () => {
        const tabs   = await TSTAPI.getTargetTabs(aMessage, aSender);
        let behavior = Constants.kNEWTAB_OPEN_AS_ORPHAN;
        switch (String(aMessage.as || 'sibling').toLowerCase()) {
          case 'child':
            behavior = Constants.kNEWTAB_OPEN_AS_CHILD;
            break;
          case 'sibling':
            behavior = Constants.kNEWTAB_OPEN_AS_SIBLING;
            break;
          case 'nextsibling':
            behavior = Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING;
            break;
          default:
            break;
        }
        for (const tab of tabs) {
          const duplicatedTabs = await Tree.moveTabs([tab], {
            duplicate:           true,
            destinationWindowId: tab.apiTab.windowId,
            insertAfter:         tab
          });
          await Tree.behaveAutoAttachedTab(duplicatedTabs[0], {
            broadcast: true,
            baseTab:   tab,
            behavior
          });
        }
        return TSTAPI.formatResult(tabs.map(() => true), aMessage);
      })();

    case TSTAPI.kGROUP_TABS:
      return (async () => {
        const tabs     = await TSTAPI.getTargetTabs(aMessage, aSender);
        const groupTab = await TabsGroup.groupTabs(tabs, { broadcast: true });
        return groupTab.apiTab;
      })();

    case TSTAPI.kGET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        return Promise.resolve(Tree.getTreeStructureFromTabs(tabs));
      })();

    case TSTAPI.kSET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        await Tree.applyTreeStructureToTabs(tabs, aMessage.structure, {
          broadcast: true
        });
        return Promise.resolve(true);
      })();

    case TSTAPI.kADD_TAB_STATE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        let states = aMessage.state || aMessage.states;
        if (!Array.isArray(states))
          states = [states];
        for (const tab of tabs) {
          for (const state of states) {
            tab.classList.add(state);
          }
        }
        Tabs.broadcastTabState(tabs, {
          add: states
        });
        return true;
      })();

    case TSTAPI.kREMOVE_TAB_STATE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        let states = aMessage.state || aMessage.states;
        if (!Array.isArray(states))
          states = [states];
        for (const tab of tabs) {
          for (const state of states) {
            tab.classList.remove(state);
          }
        }
        Tabs.broadcastTabState(tabs, {
          remove: states
        });
        return true;
      })();
  }
}
