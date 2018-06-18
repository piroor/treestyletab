/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as ApiTabs from '../common/api-tabs.js';
import * as Tabs from '../common/tabs.js';
import * as Tree from '../common/tree.js';

import * as Background from './background.js';

function log(...aArgs) {
  if (configs.logFor['background/handle-tree-changes'])
    internalLogger(...aArgs);
}

let mInitialized = false;

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
      mInitialized) {
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

Background.onReady.addListener(() => {
  mInitialized = true;
});
