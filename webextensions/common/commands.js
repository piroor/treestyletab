/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
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

function log(...args) {
  if (configs.logFor['common/command'])
    internalLogger(...args);
}

export const onTabsClosing = new EventListenerManager();
export const onMoveUp      = new EventListenerManager();
export const onMoveDown    = new EventListenerManager();

export function reloadTree(rootTab) {
  const tabs = [rootTab].concat(Tabs.getDescendantTabs(rootTab));
  for (const tab of tabs) {
    browser.tabs.reload(tab.apiTab.id)
      .catch(ApiTabs.handleMissingTabError);
  }
}

export function reloadDescendants(rootTab) {
  const tabs = Tabs.getDescendantTabs(rootTab);
  for (const tab of tabs) {
    browser.tabs.reload(tab.apiTab.id)
      .catch(ApiTabs.handleMissingTabError);
  }
}

export async function closeTree(rootTab) {
  const tabs = [rootTab].concat(Tabs.getDescendantTabs(rootTab));
  const canceled = (await onTabsClosing.dispatch(tabs.length, { windowId: rootTab.apiTab.windowId })) === false;
  if (canceled)
    return;
  tabs.reverse(); // close bottom to top!
  for (const tab of tabs) {
    TabsInternalOperation.removeTab(tab);
  }
}

export async function closeDescendants(rootTab) {
  const tabs = Tabs.getDescendantTabs(rootTab);
  const canceled = (await onTabsClosing.dispatch(tabs.length, { windowId: rootTab.apiTab.windowId })) === false;
  if (canceled)
    return;
  tabs.reverse(); // close bottom to top!
  for (const tab of tabs) {
    TabsInternalOperation.removeTab(tab);
  }
}

export async function closeOthers(rootTab) {
  const exceptionTabs = [rootTab].concat(Tabs.getDescendantTabs(rootTab));
  const tabs          = Tabs.getNormalTabs(rootTab); // except pinned or hidden tabs
  tabs.reverse(); // close bottom to top!
  const closeTabs = tabs.filter(tab => !exceptionTabs.includes(tab));
  const canceled = (await onTabsClosing.dispatch(closeTabs.length, { windowId: rootTab.apiTab.windowId })) === false;
  if (canceled)
    return;
  for (const tab of closeTabs) {
    TabsInternalOperation.removeTab(tab);
  }
}

export function collapseAll(hint) {
  const tabs = Tabs.getNormalTabs(hint);
  for (const tab of tabs) {
    if (Tabs.hasChildTabs(tab) && !Tabs.isSubtreeCollapsed(tab))
      Tree.collapseExpandSubtree(tab, {
        collapsed: true,
        broadcast: true
      });
  }
}

export function expandAll(hint) {
  const tabs = Tabs.getNormalTabs(hint);
  for (const tab of tabs) {
    if (Tabs.hasChildTabs(tab) && Tabs.isSubtreeCollapsed(tab))
      Tree.collapseExpandSubtree(tab, {
        collapsed: false,
        broadcast: true
      });
  }
}

export async function bookmarkTree(root, options = {}) {
  const tabs   = [root].concat(Tabs.getDescendantTabs(root));
  const folder = await Bookmark.bookmarkTabs(tabs, options);
  if (!folder)
    return null;
  browser.bookmarks.get(folder.parentId).then(folders => {
    notify({
      title:   browser.i18n.getMessage('bookmarkTree_notification_success_title'),
      message: browser.i18n.getMessage('bookmarkTree_notification_success_message', [
        root.apiTab.title,
        tabs.length,
        folders[0].title
      ])
    });
  });
  return folder;
}


export async function openNewTabAs(options = {}) {
  const currentTab = options.baseTab || Tabs.getTabById((await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0]);

  let parent, insertBefore, insertAfter;
  let isOrphan = false;
  switch (options.as) {
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
      !options.cookieStoreId)
    options.cookieStoreId = parent.apiTab.cookieStoreId;

  TabsOpen.openNewTab({
    parent, insertBefore, insertAfter,
    isOrphan,
    windowId:      currentTab.apiTab.windowId,
    inBackground:  !!options.inBackground,
    cookieStoreId: options.cookieStoreId,
    inRemote:      !!options.inRemote
  });
}

export async function indent(tab, options = {}) {
  const newParent = Tabs.getPreviousSiblingTab(tab);
  if (!newParent ||
      newParent == Tabs.getParentTab(tab))
    return false;

  if (!options.followChildren)
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
  await Tree.attachTabTo(tab, newParent, {
    broadcast:   true,
    forceExpand: true,
    insertAfter: Tabs.getLastDescendantTab(newParent) || newParent
  });
  return true;
}

export async function outdent(tab, options = {}) {
  const parent = Tabs.getParentTab(tab);
  if (!parent)
    return false;

  const newParent = Tabs.getParentTab(parent);
  if (newParent == Tabs.getParentTab(tab))
    return false;

  if (!options.followChildren)
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
  if (newParent) {
    await Tree.attachTabTo(tab, newParent, {
      broadcast:   true,
      forceExpand: true,
      insertAfter: Tabs.getLastDescendantTab(parent) || parent
    });
  }
  else {
    await Tree.detachTab(tab, {
      broadcast: true,
    });
    await TabsMove.moveTabAfter(tab, Tabs.getLastDescendantTab(parent) || parent, {
      broadcast: true,
    });
  }
  return true;
}

export async function moveUp(tab, options = {}) {
  const previousTab = Tabs.getPreviousTab(tab);
  if (!previousTab)
    return false;

  if (!options.followChildren)
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });

  await TabsMove.moveTabBefore(tab, previousTab, {
    broadcast: true
  });
  await onMoveUp.dispatch(tab);
  return true;
}

export async function moveDown(tab, options = {}) {
  const nextTab = Tabs.getNextTab(tab);
  if (!nextTab)
    return false;

  if (!options.followChildren)
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });

  await TabsMove.moveTabAfter(tab, nextTab, {
    broadcast: true
  });
  await onMoveDown.dispatch(tab);
  return true;
}
