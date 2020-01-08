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
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TreeBehavior from '/common/tree-behavior.js';
import * as SidebarConnection from '/common/sidebar-connection.js';

import Tab from '/common/Tab.js';

import * as Background from './background.js';
import * as BackgroundCache from './background-cache.js';
import * as Tree from './tree.js';
import * as TreeStructure from './tree-structure.js';
import * as TabsMove from './tabs-move.js';

function log(...args) {
  internalLogger('background/handle-tree-changes', ...args);
}

let mInitialized = false;

Tree.onAttached.addListener(async (tab, info = {}) => {
  const parent = info.parent;
  if (tab.openerTabId != parent.id &&
      configs.syncParentTabAndOpenerTab) {
    tab.openerTabId = parent.id;
    tab.$TST.updatingOpenerTabIds.push(parent.id);
    tab.$TST.updatedOpenerTabId = tab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(tab.id, { openerTabId: parent.id })
      .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
    wait(200).then(() => {
      const index = tab.$TST.updatingOpenerTabIds.findIndex(id => id == parent.id);
      tab.$TST.updatingOpenerTabIds.splice(index, 1);
    });
  }

  if (parent.$TST.lockedCollapsed &&
      parent.$TST.subtreeCollapsed) {
    if (tab.active) {
      // Tab move disallows to update highlighted state of tabs
      // even if they are not moved tabs, so we need to wait
      // until all tab move is finished.
      TabsMove.waitUntilSynchronized(tab.windowId).then(() => {
        TabsInternalOperation.activateTab(parent.$TST.nearestFocusableTabOrSelf, { silently: true });
      });
    }
    Tree.collapseExpandTabAndSubtree(tab, {
      collapsed: true,
      justNow:   true,
      broadcast: true
    });
  }
  else if (info.newlyAttached &&
           mInitialized) {
    // Because the tab is possibly closing for "reopen" operation,
    // we need to apply "forceExpand" immediately. Otherwise, when
    // the tab is closed with "subtree collapsed" state, descendant
    // tabs are also closed even if "forceExpand" is "true".
    log('newly attached tab');
    if (parent.$TST.subtreeCollapsed &&
        !info.forceExpand) {
      log('  the tree is collapsed, but keep collapsed by forceExpand option');
      Tree.collapseExpandTabAndSubtree(tab, {
        collapsed: true,
        justNow:   true,
        broadcast: true
      });
    }

    const isNewTreeCreatedManually = !info.justNow && parent.$TST.childIds.length == 1;
    if (info.forceExpand) {
      log('  expand by forceExpand option');
      Tree.collapseExpandSubtree(parent, Object.assign({}, info, {
        collapsed: false,
        broadcast: true
      }));
    }
    if (!info.dontExpand) {
      if (configs.autoCollapseExpandSubtreeOnAttach &&
          (isNewTreeCreatedManually ||
           parent.$TST.isAutoExpandable)) {
        log('  collapse others by collapseExpandTreesIntelligentlyFor');
        Tree.collapseExpandTreesIntelligentlyFor(parent, {
          broadcast: true
        });
      }

      const newAncestors = [parent].concat(parent.$TST.ancestors);
      if (configs.autoCollapseExpandSubtreeOnSelect ||
          isNewTreeCreatedManually ||
          parent.$TST.isAutoExpandable ||
          info.forceExpand) {
        log('  expand ancestor tabs');
        newAncestors.filter(ancestor => ancestor.$TST.subtreeCollapsed).forEach(ancestor => {
          Tree.collapseExpandSubtree(ancestor, Object.assign({}, info, {
            collapsed:    false,
            broadcast:    true
          }));
        });
      }
      if (parent.$TST.collapsed) {
        log('  collapse tab because the parent is collapsed');
        Tree.collapseExpandTabAndSubtree(tab, Object.assign({}, info, {
          collapsed:    true,
          broadcast:    true
        }));
      }
    }
    else if (parent.$TST.isAutoExpandable ||
             parent.$TST.collapsed) {
      log('  collapse auto expanded tree');
      Tree.collapseExpandTabAndSubtree(tab, Object.assign({}, info, {
        collapsed:    true,
        broadcast:    true
      }));
    }
  }

  await Promise.all([
    tab.$TST.opened,
    !info.dontMove && (async () => {
      let nextTab = info.insertBefore;
      let prevTab = info.insertAfter;
      if (!nextTab && !prevTab) {
        nextTab = Tab.getTabAt(tab.windowId, info.newIndex);
        if (!nextTab)
          prevTab = Tab.getTabAt(tab.windowId, info.newIndex - 1);
      }
      log('move newly attached child: ', dumpTab(tab), {
        next: dumpTab(nextTab),
        prev: dumpTab(prevTab)
      });
      if (nextTab)
        await Tree.moveTabSubtreeBefore(tab, nextTab, Object.assign({}, info, {
          broadcast:    true
        }));
      else
        await Tree.moveTabSubtreeAfter(tab, prevTab, Object.assign({}, info, {
          broadcast:    true
        }));
    })()
  ]);

  if (!TabsStore.ensureLivingTab(tab) || // not removed while waiting
      tab.$TST.parent != info.parent) // not detached while waiting
    return;

  SidebarConnection.sendMessage({
    type:          Constants.kCOMMAND_NOTIFY_TAB_ATTACHED_COMPLETELY,
    windowId:      tab.windowId,
    tabId:         tab.id,
    parentId:      parent.id,
    newlyAttached: info.newlyAttached
  });

  if (info.newlyAttached)
    Background.reserveToUpdateAncestors([tab].concat(tab.$TST.descendants));
  Background.reserveToUpdateChildren(parent);
  Background.reserveToUpdateInsertionPosition([
    tab,
    tab.$TST.nextTab,
    tab.$TST.previousTab
  ]);
});

Tree.onDetached.addListener((tab, _detachInfo) => {
  if (tab.openerTabId &&
      configs.syncParentTabAndOpenerTab) {
    tab.openerTabId = tab.id;
    tab.$TST.updatedOpenerTabId = tab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(tab.id, { openerTabId: tab.id }) // set self id instead of null, because it requires any valid tab id...
      .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
  }
});

function reserveDetachHiddenTab(tab) {
  reserveDetachHiddenTab.tabs.add(tab);
  if (reserveDetachHiddenTab.reserved)
    clearTimeout(reserveDetachHiddenTab.reserved);
  reserveDetachHiddenTab.reserved = setTimeout(async () => {
    delete reserveDetachHiddenTab.reserved;
    const tabs = new Set(Tab.sort(Array.from(reserveDetachHiddenTab.tabs)));
    reserveDetachHiddenTab.tabs.clear();
    for (const tab of tabs) {
      if (!TabsStore.ensureLivingTab(tab))
        continue;
      for (const descendant of tab.$TST.descendants) {
        if (descendant.hidden)
          continue;
        const nearestVisibleAncestor = descendant.$TST.ancestors.find(ancestor => !ancestor.hidden && !tabs.has(ancestor));
        if (nearestVisibleAncestor &&
            nearestVisibleAncestor == descendant.$TST.parent)
          continue;
        for (const ancestor of descendant.$TST.ancestors) {
          if (!ancestor.hidden &&
              !ancestor.$TST.collapsed)
            break;
          if (!ancestor.$TST.subtreeCollapsed)
            continue;
          await Tree.collapseExpandSubtree(ancestor, {
            collapsed: false,
            broadcast: true
          });
        }
        if (nearestVisibleAncestor) {
          await Tree.attachTabTo(descendant, nearestVisibleAncestor, {
            dontMove:  true,
            broadcast: true
          });
        }
        else {
          await Tree.detachTab(descendant, {
            broadcast: true
          });
        }
      }
      if (tab.$TST.hasParent &&
          !tab.$TST.parent.hidden)
        await Tree.detachTab(tab, {
          broadcast: true
        });
    }
  }, 100);
}
reserveDetachHiddenTab.tabs = new Set();

Tab.onHidden.addListener(tab => {
  if (configs.fixupTreeOnTabVisibilityChanged)
    reserveDetachHiddenTab(tab);
});

function reserveAttachShownTab(tab) {
  tab.$TST.addState(Constants.kTAB_STATE_SHOWING);
  reserveAttachShownTab.tabs.add(tab);
  if (reserveAttachShownTab.reserved)
    clearTimeout(reserveAttachShownTab.reserved);
  reserveAttachShownTab.reserved = setTimeout(async () => {
    delete reserveAttachShownTab.reserved;
    const tabs = new Set(Tab.sort(Array.from(reserveAttachShownTab.tabs)));
    reserveAttachShownTab.tabs.clear();
    for (const tab of tabs) {
      if (!TabsStore.ensureLivingTab(tab) ||
          tab.$TST.hasParent)
        continue;
      const referenceTabs = TreeBehavior.calculateReferenceTabsFromInsertionPosition(tab, {
        insertAfter:  tab.$TST.nearestVisiblePrecedingTab,
        // Instead of nearestFollowingForeignerTab, to avoid placing the tab
        // after hidden tabs (too far from the target)
        insertBefore: tab.$TST.unsafeNearestFollowingForeignerTab
      });
      if (referenceTabs.parent) {
        await Tree.attachTabTo(tab, referenceTabs.parent, {
          insertBefore: referenceTabs.insertBefore,
          insertAfter:  referenceTabs.insertAfter,
          broadcast:    true
        });
      }
      tab.$TST.removeState(Constants.kTAB_STATE_SHOWING);
    }
  }, 100);
}
reserveAttachShownTab.tabs = new Set();

Tab.onShown.addListener(tab => {
  if (configs.fixupTreeOnTabVisibilityChanged)
    reserveAttachShownTab(tab);
});

Background.onReady.addListener(() => {
  mInitialized = true;
});

Tree.onSubtreeCollapsedStateChanged.addListener((tab, _info) => {
  if (mInitialized)
    TreeStructure.reserveToSaveTreeStructure(tab.windowId);
  BackgroundCache.markWindowCacheDirtyFromTab(tab, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
});
