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

import * as Background from './background.js';

function log(...args) {
  internalLogger('background/handle-tree-changes', ...args);
}

let mInitialized = false;

Tree.onAttached.addListener(async (tab, info = {}) => {
  const parent = info.parent;
  if (tab.openerTabId != parent.id &&
      configs.syncParentTabAndOpenerTab) {
    tab.openerTabId = parent.id;
    tab.$TST.updatedOpenerTabId = tab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(tab.id, { openerTabId: parent.id })
      .catch(ApiTabs.handleMissingTabError);
  }

  // Because the tab is possibly closing for "reopen" operation,
  // we need to apply "forceExpand" immediately. Otherwise, when
  // the tab is closed with "subtree collapsed" state, descendant
  // tabs are also closed even if "forceExpand" is "true".
  if (info.newlyAttached &&
      mInitialized) {
    if (Tabs.isSubtreeCollapsed(info.parent) &&
        !info.forceExpand)
      Tree.collapseExpandTabAndSubtree(tab, {
        collapsed: true,
        justNow:   true,
        broadcast: true
      });

    const isNewTreeCreatedManually = !info.justNow && Tabs.getChildTabs(parent).length == 1;
    if (info.forceExpand) {
      Tree.collapseExpandSubtree(parent, Object.assign({}, info, {
        collapsed:    false,
        inRemote:     false
      }));
    }
    if (!info.dontExpand) {
      if (configs.autoCollapseExpandSubtreeOnAttach &&
          (isNewTreeCreatedManually || Tree.shouldTabAutoExpanded(parent)))
        Tree.collapseExpandTreesIntelligentlyFor(parent, {
          broadcast: true
        });

      const newAncestors = [parent].concat(Tabs.getAncestorTabs(parent));
      if (configs.autoCollapseExpandSubtreeOnSelect ||
          isNewTreeCreatedManually ||
          Tree.shouldTabAutoExpanded(parent) ||
          info.forceExpand) {
        newAncestors.filter(Tabs.isSubtreeCollapsed).forEach(ancestor => {
          Tree.collapseExpandSubtree(ancestor, Object.assign({}, info, {
            collapsed:    false,
            broadcast:    true
          }));
        });
      }
      if (Tabs.isCollapsed(parent))
        Tree.collapseExpandTabAndSubtree(tab, Object.assign({}, info, {
          collapsed:    true,
          broadcast:    true
        }));
    }
    else if (Tree.shouldTabAutoExpanded(parent) ||
             Tabs.isCollapsed(parent)) {
      Tree.collapseExpandTabAndSubtree(tab, Object.assign({}, info, {
        collapsed:    true,
        broadcast:    true
      }));
    }
  }

  await Promise.all([
    Tabs.isOpening(tab) && tab.$TST.opened,
    !info.dontMove && (async () => {
      let nextTab = info.insertBefore;
      let prevTab = info.insertAfter;
      if (!nextTab && !prevTab) {
        const tabs = Tabs.getAllTabs(tab.windowId);
        nextTab = tabs[info.newIndex];
        if (!nextTab)
          prevTab = tabs[info.newIndex - 1];
      }
      log('move newly attached child: ', tab.id, {
        next: nextTab && nextTab.id,
        prev: prevTab && prevTab.id
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

  if (!Tabs.ensureLivingTab(tab) || // not removed while waiting
      Tabs.getParentTab(tab) != info.parent) // not detached while waiting
    return;

  browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_TAB_ATTACHED_COMPLETELY,
    tab:    tab.$TST.element.id,
    parent: parent.$TST.element.id,
    newlyAttached: info.newlyAttached
  });

  if (info.newlyAttached)
    Background.reserveToUpdateAncestors([tab.$TST.element].concat(Tabs.getDescendantTabs(tab.$TST.element)));
  Background.reserveToUpdateChildren(parent.$TST.element);
  Background.reserveToUpdateInsertionPosition([
    tab.$TST.element,
    Tabs.getNextTab(tab.$TST.element),
    Tabs.getPreviousTab(tab.$TST.element)
  ]);
});

Tree.onDetached.addListener((tab, _detachInfo) => {
  if (tab.openerTabId &&
      configs.syncParentTabAndOpenerTab) {
    tab.openerTabId = tab.id;
    tab.$TST.updatedOpenerTabId = tab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(tab.id, { openerTabId: tab.id }) // set self id instead of null, because it requires any valid tab id...
      .catch(ApiTabs.handleMissingTabError);
  }
});

Background.onReady.addListener(() => {
  mInitialized = true;
});
