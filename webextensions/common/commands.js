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
import * as SidebarStatus from './sidebar-status.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/command', ...args);
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

export function collapseTree(rootTab) {
  if (!Tabs.hasChildTabs(rootTab) ||
      Tabs.isSubtreeCollapsed(rootTab))
    return;
  Tree.collapseExpandSubtree(rootTab, {
    collapsed: true,
    broadcast: true
  });
}

export function collapseAll(hint) {
  const tabs = Tabs.getNormalTabs(hint);
  for (const tab of tabs) {
    collapseTree(tab);
  }
}

export function expandTree(rootTab) {
  if (!Tabs.hasChildTabs(rootTab) ||
      !Tabs.isSubtreeCollapsed(rootTab))
    return;
  Tree.collapseExpandSubtree(rootTab, {
    collapsed: false,
    broadcast: true
  });
}

export function expandAll(hint) {
  const tabs = Tabs.getNormalTabs(hint);
  for (const tab of tabs) {
    expandTree(tab);
  }
}

export async function bookmarkTree(root, options = {}) {
  const tabs   = [root].concat(Tabs.getDescendantTabs(root));
  if (tabs.length > 1 &&
      Tabs.isGroupTab(tabs[0]))
    tabs.shift();

  const tab = tabs[0];
  if (SidebarStatus.isOpen(tab.apiTab.windowId)) {
    return browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_BOOKMARK_TABS_WITH_DIALOG,
      windowId: tab.apiTab.windowId,
      tabs:     tabs.map(tab => tab.apiTab)
    });
  }

  const folder = await Bookmark.bookmarkTabs(tabs, options);
  if (!folder)
    return null;
  notify({
    title:   browser.i18n.getMessage('bookmarkTree_notification_success_title'),
    message: browser.i18n.getMessage('bookmarkTree_notification_success_message', [
      root.apiTab.title,
      tabs.length,
      folder.title
    ])
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
      insertAfter  = Tabs.getLastDescendantTab(currentTab) || currentTab;
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

// drag and drop helper
export async function performTabsDragDrop(params = {}) {
  const windowId = params.windowId || Tabs.getWindow();
  const destinationWindowId = params.destinationWindowId || windowId;

  if (params.inRemote) {
    browser.runtime.sendMessage(Object.assign({}, params, {
      type:         Constants.kCOMMAND_PERFORM_TABS_DRAG_DROP,
      windowId:     windowId,
      attachTo:     params.attachTo && params.attachTo.id,
      insertBefore: params.insertBefore && params.insertBefore.id,
      insertAfter:  params.insertAfter && params.insertAfter.id,
      inRemote:     false,
      destinationWindowId
    }));
    return;
  }

  log('performTabsDragDrop ', {
    tabs:                params.tabs.map(tab => tab.id),
    windowId:            params.windowId,
    destinationWindowId: params.destinationWindowId,
    action:              params.action
  });

  const movedTabs = await moveTabsWithStructure(params.tabs, Object.assign({}, params, {
    windowId, destinationWindowId,
    broadcast: true
  }));
  if (windowId != destinationWindowId) {
    // Firefox always focuses to the dropped (mvoed) tab if it is dragged from another window.
    // TST respects Firefox's the behavior.
    browser.tabs.update(movedTabs[0].apiTab.id, { active: true })
      .catch(ApiTabs.handleMissingTabError);
  }
}

// useful utility for general purpose
export async function moveTabsWithStructure(tabs, params = {}) {
  log('moveTabsWithStructure ', tabs.map(tab => tab.id));

  let movedTabs = tabs.map(Tabs.getTabById).filter(tab => !!tab);
  if (!movedTabs.length)
    return [];

  let movedRoots = Tabs.collectRootTabs(movedTabs);

  const movedWholeTree = [].concat(movedRoots);
  for (const movedRoot of movedRoots) {
    const descendants = Tabs.getDescendantTabs(movedRoot);
    for (const descendant of descendants) {
      if (!movedWholeTree.includes(descendant))
        movedWholeTree.push(descendant);
    }
  }
  log('=> movedTabs: ', movedTabs.map(tab => tab.id).join(' / '));

  while (params.insertBefore &&
         movedWholeTree.includes(params.insertBefore)) {
    params.insertBefore = Tabs.getNextTab(params.insertBefore);
  }
  while (params.insertAfter &&
         movedWholeTree.includes(params.insertAfter)) {
    params.insertAfter = Tabs.getPreviousTab(params.insertAfter);
  }

  const windowId = params.windowId || tabs[0].apiTab.windowId;
  const destinationWindowId = params.destinationWindowId ||
    params.insertBefore && params.insertBefore.apiTab.windowId || 
      params.insertAfter && params.insertAfter.apiTab.windowId ||
        windowId;

  // Basically tabs should not be moved between regular window and private browsing window,
  // so there are some codes to prevent shch operations. This is for failsafe.
  if (Tabs.isPrivateBrowsing(movedTabs[0]) != Tabs.isPrivateBrowsing(Tabs.getFirstTab(destinationWindowId)))
    return [];

  if (movedWholeTree.length != movedTabs.length) {
    log('=> partially moved');
    if (!params.duplicate)
      await Tree.detachTabsFromTree(movedTabs, {
        broadcast: params.broadcast
      });
  }

  if (params.duplicate ||
      windowId != destinationWindowId) {
    movedTabs = await Tree.moveTabs(movedTabs, {
      destinationWindowId,
      duplicate:    params.duplicate,
      insertBefore: params.insertBefore,
      insertAfter:  params.insertAfter,
      broadcast:    params.broadcast
    });
    movedRoots = Tabs.collectRootTabs(movedTabs);
  }

  log('try attach/detach');
  if (!params.attachTo) {
    log('=> detach');
    detachTabsWithStructure(movedRoots, {
      broadcast: params.broadcast
    });
  }
  else {
    log('=> attach');
    await attachTabsWithStructure(movedRoots, params.attachTo, {
      insertBefore: params.insertBefore,
      insertAfter:  params.insertAfter,
      draggedTabs:  movedTabs,
      broadcast:    params.broadcast
    });
  }

  log('=> moving tabs ', movedTabs.map(dumpTab));
  if (params.insertBefore)
    await TabsMove.moveTabsBefore(movedTabs, params.insertBefore, { broadcast: params.broadcast });
  else if (params.insertAfter)
    await TabsMove.moveTabsAfter(movedTabs, params.insertAfter, { broadcast: params.broadcast });
  else
    log('=> already placed at expected position');

  /*
  const treeStructure = getTreeStructureFromTabs(movedTabs);

  const newTabs;
  const replacedGroupTabs = Tabs.doAndGetNewTabs(() => {
    newTabs = moveTabsInternal(movedTabs, {
      duplicate    : params.duplicate,
      insertBefore : params.insertBefore,
      insertAfter  : params.insertAfter,
      inRemote     : true
    });
  });
  log('=> opened group tabs: ', replacedGroupTabs);
  params.draggedTab.ownerDocument.defaultView.setTimeout(() => {
    if (!Tabs.ensureLivingTab(tab)) // it was removed while waiting
      return;
    log('closing needless group tabs');
    replacedGroupTabs.reverse().forEach(function(tab) {
      log(' check: ', tab.label+'('+tab._tPos+') '+getLoadingURI(tab));
      if (Tabs.isGroupTab(tab) &&
        !Tabs.hasChildTabs(tab))
        removeTab(tab);
    }, this);
  }, 0);
  */

  log('=> finished');

  return movedTabs;
}

async function attachTabsWithStructure(tabs, parent, options = {}) {
  log('attachTabsWithStructure: start ', tabs.map(dumpTab));
  if (parent && !options.insertBefore && !options.insertAfter) {
    const refTabs = Tree.getReferenceTabsForNewChild(tabs[0], parent, {
      ignoreTabs: tabs
    });
    options.insertBefore = refTabs.insertBefore;
    options.insertAfter  = refTabs.insertAfter;
  }

  if (options.insertBefore)
    await TabsMove.moveTabsBefore(options.draggedTabs || tabs, options.insertBefore, { broadcast: options.broadcast });
  else if (options.insertAfter)
    await TabsMove.moveTabsAfter(options.draggedTabs || tabs, options.insertAfter, { broadcast: options.broadcast });

  const memberOptions = Object.assign({}, options, {
    insertBefore: null,
    insertAfter:  null,
    dontMove:     true,
    forceExpand:  options.draggedTabs.some(Tabs.isActive)
  });
  for (const tab of tabs) {
    if (parent)
      Tree.attachTabTo(tab, parent, memberOptions);
    else
      Tree.detachTab(tab, memberOptions);
    Tree.collapseExpandTabAndSubtree(tab, Object.assign({}, memberOptions, {
      collapsed: false
    }));
  }
}

function detachTabsWithStructure(tabs, options = {}) {
  log('detachTabsWithStructure: start ', tabs.map(dumpTab));
  for (const tab of tabs) {
    Tree.detachTab(tab, options);
    Tree.collapseExpandTabAndSubtree(tab, Object.assign({}, options, {
      collapsed: false
    }));
  }
}

export async function moveUp(tab, options = {}) {
  const previousTab = Tabs.getPreviousVisibleTab(tab);
  if (!previousTab)
    return false;

  if (!options.followChildren) {
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
    await TabsMove.moveTabBefore(tab, previousTab, {
      broadcast: true
    });
    await onMoveUp.dispatch(tab);
  }
  else {
    const referenceTabs = Tree.calculateReferenceTabsFromInsertionPosition(tab, {
      insertBefore: previousTab
    });
    if (!referenceTabs.insertBefore && !referenceTabs.insertAfter)
      return false;
    await moveTabsWithStructure([tab].concat(Tabs.getDescendantTabs(tab)), {
      attachTo:     referenceTabs.parent,
      insertBefore: referenceTabs.insertBefore,
      insertAfter:  referenceTabs.insertAfter,
      broadcast:    true
    });
  }
  return true;
}

export async function moveDown(tab, options = {}) {
  if (!options.followChildren) {
    const nextTab = Tabs.getNextVisibleTab(tab);
    if (!nextTab)
      return false;
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
    await TabsMove.moveTabAfter(tab, nextTab, {
      broadcast: true
    });
    await onMoveDown.dispatch(tab);
  }
  else {
    const nextTab = Tabs.getNextVisibleTab(Tabs.getLastDescendantTab(tab) || tab);
    if (!nextTab)
      return false;
    const referenceTabs = Tree.calculateReferenceTabsFromInsertionPosition(tab, {
      insertAfter: nextTab
    });
    if (!referenceTabs.insertBefore && !referenceTabs.insertAfter)
      return false;
    await moveTabsWithStructure([tab].concat(Tabs.getDescendantTabs(tab)), {
      attachTo:     referenceTabs.parent,
      insertBefore: referenceTabs.insertBefore,
      insertAfter:  referenceTabs.insertAfter,
      broadcast:    true
    });
  }
  return true;
}


/* commands to simulate Firefox's native tab cocntext menu */

export async function duplicateTab(sourceTab, destinationWindowId) {
  /*
    Due to difference between Firefox's "duplicate tab" implementation,
    TST sometimes fails to detect duplicated tabs based on its
    session information. Thus we need to duplicate as an internally
    duplicated tab. For more details, see also:
    https://github.com/piroor/treestyletab/issues/1437#issuecomment-334952194
  */
  const isMultiselected   = Tabs.isMultiselected(sourceTab);
  const sourceTabs = isMultiselected ? Tabs.getSelectedTabs(sourceTab) : [sourceTab];
  log('source tabs: ', sourceTabs);
  const duplicatedTabs = await Tree.moveTabs(sourceTabs, {
    duplicate:           true,
    destinationWindowId: destinationWindowId || sourceTabs[0].apiTab.windowId,
    insertAfter:         sourceTabs[sourceTabs.length-1]
  });
  return Tree.behaveAutoAttachedTabs(duplicatedTabs, {
    baseTabs:  sourceTabs,
    behavior:  configs.autoAttachOnDuplicated,
    broadcast: true
  });
}

export function moveTabToStart(tab) {
  const isMultiselected = Tabs.isMultiselected(tab);
  const movedTabs = isMultiselected ? Tabs.getSelectedTabs(tab) : [tab].concat(Tabs.getDescendantTabs(tab));
  const allTabs   = tab.apiTab.pinned ? Tabs.getPinnedTabs(tab) : Tabs.getUnpinnedTabs(tab);
  const otherTabs = allTabs.filter(tab => !movedTabs.includes(tab));
  if (otherTabs.length > 0)
    moveTabsWithStructure(movedTabs, {
      insertBefore: otherTabs[0],
      broadcast:    true
    });
}

export function moveTabToEnd(tab) {
  const isMultiselected = Tabs.isMultiselected(tab);
  const movedTabs = isMultiselected ? Tabs.getSelectedTabs(tab) : [tab].concat(Tabs.getDescendantTabs(tab));
  const allTabs   = tab.apiTab.pinned ? Tabs.getPinnedTabs(tab) : Tabs.getUnpinnedTabs(tab);
  const otherTabs = allTabs.filter(tab => !movedTabs.includes(tab));
  if (otherTabs.length > 0)
    moveTabsWithStructure(movedTabs, {
      insertAfter: otherTabs[otherTabs.length-1],
      broadcast:   true
    });
}

export async function openTabInWindow(tab) {
  if (Tabs.isMultiselected(tab)) {
    Tree.openNewWindowFromTabs(Tabs.getSelectedTabs(tab));
  }
  else {
    await browser.windows.create({
      tabId:     tab.apiTab.id,
      incognito: tab.apiTab.incognito
    });
  }
}

export async function bookmarkTab(tab) {
  if (Tabs.isMultiselected(tab))
    return bookmarkTabs(Tabs.getSelectedTabs(tab));

  if (SidebarStatus.isOpen(tab.apiTab.windowId)) {
    browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_BOOKMARK_TAB_WITH_DIALOG,
      windowId: tab.apiTab.windowId,
      tab:      tab.apiTab
    });
  }
  else {
    await Bookmark.bookmarkTab(tab);
    notify({
      title:   browser.i18n.getMessage('bookmarkTab_notification_success_title'),
      message: browser.i18n.getMessage('bookmarkTab_notification_success_message', [
        tab.apiTab.title
      ]),
      icon:    Constants.kNOTIFICATION_DEFAULT_ICON
    });
  }
}

export async function bookmarkTabs(tabs) {
  if (tabs.length == 0)
    return;
  const apiTabs = tabs.map(tab => tab.apiTab);
  if (SidebarStatus.isOpen(apiTabs[0].windowId)) {
    browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_BOOKMARK_TABS_WITH_DIALOG,
      windowId: apiTabs[0].windowId,
      tabs:     apiTabs
    });
  }
  else {
    const folder = await Bookmark.bookmarkTabs(tabs);
    if (folder)
      notify({
        title:   browser.i18n.getMessage('bookmarkTabs_notification_success_title'),
        message: browser.i18n.getMessage('bookmarkTabs_notification_success_message', [
          apiTabs[0].title,
          apiTabs.length,
          folder.title
        ]),
        icon:    Constants.kNOTIFICATION_DEFAULT_ICON
      });
  }
}

export async function reopenInContainer(sourceTab, cookieStoreId) {
  const isMultiselected   = Tabs.isMultiselected(sourceTab);
  const sourceTabs = isMultiselected ? Tabs.getSelectedTabs(sourceTab) : [sourceTab];
  const tabs = await TabsOpen.openURIsInTabs(sourceTabs.map(tab => tab.apiTab.url), {
    isOrphan: true,
    windowId: sourceTab.apiTab.windowId,
    cookieStoreId
  });
  return Tree.behaveAutoAttachedTabs(tabs, {
    baseTabs:  sourceTabs,
    behavior:  configs.autoAttachOnDuplicated,
    broadcast: true
  });
}
