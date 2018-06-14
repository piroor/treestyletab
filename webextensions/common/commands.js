/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  dumpTab,
  notify,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as Tabs from './tabs.js';
import * as TabsMove from './tabs-move.js';
import * as TabsOpen from './tabs-open.js';
import * as TabsInternalOperation from './tabs-internal-operation.js';
import * as Bookmark from './bookmark.js';
import * as Tree from './tree.js';
import EventListenerManager from './EventListenerManager.js';

export const onTabsClosing = new EventListenerManager();
export const onMoveUp      = new EventListenerManager();
export const onMoveDown    = new EventListenerManager();

export function reloadTree(aRootTab) {
  const tabs = [aRootTab].concat(Tabs.getDescendantTabs(aRootTab));
  for (const tab of tabs) {
    browser.tabs.reload(tab.apiTab.id)
      .catch(ApiTabs.handleMissingTabError);
  }
}

export function reloadDescendants(aRootTab) {
  const tabs = Tabs.getDescendantTabs(aRootTab);
  for (const tab of tabs) {
    browser.tabs.reload(tab.apiTab.id)
      .catch(ApiTabs.handleMissingTabError);
  }
}

export async function closeTree(aRootTab) {
  const tabs = [aRootTab].concat(Tabs.getDescendantTabs(aRootTab));
  const canceled = (await onTabsClosing.dispatch(tabs.length, { windowId: aRootTab.apiTab.windowId })) === false;
  if (canceled)
    return;
  tabs.reverse(); // close bottom to top!
  for (const tab of tabs) {
    TabsInternalOperation.removeTab(tab);
  }
}

export async function closeDescendants(aRootTab) {
  const tabs = Tabs.getDescendantTabs(aRootTab);
  const canceled = (await onTabsClosing.dispatch(tabs.length, { windowId: aRootTab.apiTab.windowId })) === false;
  if (canceled)
    return;
  tabs.reverse(); // close bottom to top!
  for (const tab of tabs) {
    TabsInternalOperation.removeTab(tab);
  }
}

export async function closeOthers(aRootTab) {
  const exceptionTabs = [aRootTab].concat(Tabs.getDescendantTabs(aRootTab));
  const tabs          = Tabs.getNormalTabs(aRootTab); // except pinned or hidden tabs
  tabs.reverse(); // close bottom to top!
  const closeTabs = tabs.filter(aTab => !exceptionTabs.includes(aTab));
  const canceled = (await onTabsClosing.dispatch(closeTabs.length, { windowId: aRootTab.apiTab.windowId })) === false;
  if (canceled)
    return;
  for (const tab of closeTabs) {
    TabsInternalOperation.removeTab(tab);
  }
}

export function collapseAll(aHint) {
  const tabs = Tabs.getNormalTabs(aHint);
  for (const tab of tabs) {
    if (Tabs.hasChildTabs(tab) && !Tabs.isSubtreeCollapsed(tab))
      Tree.collapseExpandSubtree(tab, {
        collapsed: true,
        broadcast: true
      });
  }
}

export function expandAll(aHint) {
  const tabs = Tabs.getNormalTabs(aHint);
  for (const tab of tabs) {
    if (Tabs.hasChildTabs(tab) && Tabs.isSubtreeCollapsed(tab))
      Tree.collapseExpandSubtree(tab, {
        collapsed: false,
        broadcast: true
      });
  }
}

export async function bookmarkTree(aRoot, aOptions = {}) {
  const tabs   = [aRoot].concat(Tabs.getDescendantTabs(aRoot));
  const folder = await Bookmark.bookmarkTabs(tabs, aOptions);
  if (!folder)
    return null;
  browser.bookmarks.get(folder.parentId).then(aFolders => {
    notify({
      title:   browser.i18n.getMessage('bookmarkTree_notification_success_title'),
      message: browser.i18n.getMessage('bookmarkTree_notification_success_message', [
        aRoot.apiTab.title,
        tabs.length,
        aFolders[0].title
      ])
    });
  });
  return folder;
}


export async function openNewTabAs(aOptions = {}) {
  const currentTab = aOptions.baseTab || Tabs.getTabById((await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0]);

  let parent, insertBefore, insertAfter;
  let isOrphan = false;
  switch (aOptions.as) {
    case Constants.kNEWTAB_DO_NOTHING:
    default:
      break;

    case Constants.kNEWTAB_OPEN_AS_ORPHAN:
      isOrphan    = true;
      insertAfter = Tabs.getLastTab(currentTab);
      break;

    case Constants.kNEWTAB_OPEN_AS_CHILD: {
      parent = currentTab;
      const refTabs = Tree.getReferenceTabsForNewChild(parent);
      insertBefore = refTabs.insertBefore;
      insertAfter  = refTabs.insertAfter;
      if (configs.logOnMouseEvent)
        log('detected reference tabs: ',
            dumpTab(parent), dumpTab(insertBefore), dumpTab(insertAfter));
    }; break;

    case Constants.kNEWTAB_OPEN_AS_SIBLING:
      parent      = Tabs.getParentTab(currentTab);
      insertAfter = Tabs.getLastDescendantTab(parent);
      break;

    case Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING: {
      parent       = Tabs.getParentTab(currentTab);
      insertBefore = Tabs.getNextSiblingTab(currentTab);
      insertAfter  = Tabs.getLastDescendantTab(currentTab);
    }; break;
  }

  if (parent &&
      configs.inheritContextualIdentityToNewChildTab &&
      !aOptions.cookieStoreId)
    aOptions.cookieStoreId = parent.apiTab.cookieStoreId;

  TabsOpen.openNewTab({
    parent, insertBefore, insertAfter,
    isOrphan,
    windowId:      currentTab.apiTab.windowId,
    inBackground:  !!aOptions.inBackground,
    cookieStoreId: aOptions.cookieStoreId,
    inRemote:      !!aOptions.inRemote
  });
}

export async function indent(aTab, aOptions = {}) {
  const newParent = Tabs.getPreviousSiblingTab(aTab);
  if (!newParent ||
      newParent == Tabs.getParentTab(aTab))
    return false;

  if (!aOptions.followChildren)
    Tree.detachAllChildren(aTab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
  await Tree.attachTabTo(aTab, newParent, {
    broadcast:   true,
    forceExpand: true,
    insertAfter: Tabs.getLastDescendantTab(newParent) || newParent
  });
  return true;
}

export async function outdent(aTab, aOptions = {}) {
  const parent = Tabs.getParentTab(aTab);
  if (!parent)
    return false;

  const newParent = Tabs.getParentTab(parent);
  if (newParent == Tabs.getParentTab(aTab))
    return false;

  if (!aOptions.followChildren)
    Tree.detachAllChildren(aTab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
  if (newParent) {
    await Tree.attachTabTo(aTab, newParent, {
      broadcast:   true,
      forceExpand: true,
      insertAfter: Tabs.getLastDescendantTab(parent) || parent
    });
  }
  else {
    await Tree.detachTab(aTab, {
      broadcast: true,
    });
    await TabsMove.moveTabAfter(aTab, Tabs.getLastDescendantTab(parent) || parent, {
      broadcast: true,
    });
  }
  return true;
}

export async function moveUp(aTab, aOptions = {}) {
  const previousTab = Tabs.getPreviousTab(aTab);
  if (!previousTab)
    return false;

  if (!aOptions.followChildren)
    Tree.detachAllChildren(aTab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });

  await TabsMove.moveTabBefore(aTab, previousTab, {
    broadcast: true
  });
  await onMoveUp.dispatch(aTab);
  return true;
}

export async function moveDown(aTab, aOptions = {}) {
  const nextTab = Tabs.getNextTab(aTab);
  if (!nextTab)
    return false;

  if (!aOptions.followChildren)
    Tree.detachAllChildren(aTab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });

  await TabsMove.moveTabAfter(aTab, nextTab, {
    broadcast: true
  });
  await onMoveDown.dispatch(aTab);
  return true;
}
