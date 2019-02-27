/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
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

import Tab from './Tab.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/commands', ...args);
}

export const onTabsClosing = new EventListenerManager();
export const onMoveUp      = new EventListenerManager();
export const onMoveDown    = new EventListenerManager();

export function reloadTree(rootTab) {
  const tabs = [rootTab].concat(Tab.getDescendants(rootTab));
  for (const tab of tabs) {
    browser.tabs.reload(tab.id)
      .catch(ApiTabs.handleMissingTabError);
  }
}

export function reloadDescendants(rootTab) {
  const tabs = Tab.getDescendants(rootTab);
  for (const tab of tabs) {
    browser.tabs.reload(tab.id)
      .catch(ApiTabs.handleMissingTabError);
  }
}

export async function closeTree(rootTab) {
  const tabs = [rootTab].concat(Tab.getDescendants(rootTab));
  const canceled = (await onTabsClosing.dispatch(tabs.map(tab => tab.id), { windowId: rootTab.windowId })) === false;
  if (canceled)
    return;
  tabs.reverse(); // close bottom to top!
  for (const tab of tabs) {
    TabsInternalOperation.removeTab(tab);
  }
}

export async function closeDescendants(rootTab) {
  const tabs = Tab.getDescendants(rootTab);
  const canceled = (await onTabsClosing.dispatch(tabs.map(tab => tab.id), { windowId: rootTab.windowId })) === false;
  if (canceled)
    return;
  tabs.reverse(); // close bottom to top!
  for (const tab of tabs) {
    TabsInternalOperation.removeTab(tab);
  }
}

export async function closeOthers(rootTab) {
  const exceptionTabs = [rootTab].concat(Tab.getDescendants(rootTab));
  const tabs          = Tabs.getNormalTabs(rootTab.windowId); // except pinned or hidden tabs
  tabs.reverse(); // close bottom to top!
  const closeTabs = tabs.filter(tab => !exceptionTabs.includes(tab));
  const canceled = (await onTabsClosing.dispatch(closeTabs.map(tab => tab.id), { windowId: rootTab.windowId })) === false;
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

export function collapseAll(windowId) {
  const tabs = Tabs.getNormalTabs(windowId);
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

export function expandAll(windowId) {
  const tabs = Tabs.getNormalTabs(windowId);
  for (const tab of tabs) {
    expandTree(tab);
  }
}

export async function bookmarkTree(root, options = {}) {
  const tabs = [root].concat(Tab.getDescendants(root));
  if (tabs.length > 1 &&
      Tabs.isGroupTab(tabs[0]))
    tabs.shift();

  const tab = tabs[0];
  if (SidebarStatus.isOpen(tab.windowId)) {
    return browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_BOOKMARK_TABS_WITH_DIALOG,
      windowId: tab.windowId,
      tabIds:   tabs.map(tab => tab.id)
    });
  }

  const folder = await Bookmark.bookmarkTabs(tabs, options);
  if (!folder)
    return null;
  notify({
    title:   browser.i18n.getMessage('bookmarkTree_notification_success_title'),
    message: browser.i18n.getMessage('bookmarkTree_notification_success_message', [
      root.title,
      tabs.length,
      folder.title
    ])
  });
  return folder;
}


export async function openNewTabAs(options = {}) {
  const currentTab = options.baseTab ||
    Tab.get((await browser.tabs.query({
      active:        true,
      currentWindow: true
    }))[0].id);

  let parent, insertBefore, insertAfter;
  let isOrphan = false;
  switch (options.as) {
    case Constants.kNEWTAB_DO_NOTHING:
    default:
      break;

    case Constants.kNEWTAB_OPEN_AS_ORPHAN:
      isOrphan    = true;
      insertAfter = Tabs.getLastTab(currentTab.windowId);
      break;

    case Constants.kNEWTAB_OPEN_AS_CHILD: {
      parent = currentTab;
      const refTabs = Tree.getReferenceTabsForNewChild(parent);
      insertBefore = refTabs.insertBefore;
      insertAfter  = refTabs.insertAfter;
      log('detected reference tabs: ',
          { parent, insertBefore, insertAfter });
    }; break;

    case Constants.kNEWTAB_OPEN_AS_SIBLING:
      parent      = currentTab.$TST.parent;
      insertAfter = Tab.getLastDescendant(parent);
      break;

    case Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING: {
      parent       = currentTab.$TST.parent;
      insertBefore = Tab.getNextSibling(currentTab);
      insertAfter  = Tab.getLastDescendant(currentTab) || currentTab;
    }; break;
  }

  if (parent &&
      configs.inheritContextualIdentityToNewChildTab &&
      !options.cookieStoreId)
    options.cookieStoreId = parent.cookieStoreId;

  TabsOpen.openNewTab({
    parent, insertBefore, insertAfter,
    isOrphan,
    windowId:      currentTab.windowId,
    inBackground:  !!options.inBackground,
    cookieStoreId: options.cookieStoreId,
    inRemote:      !!options.inRemote
  });
}

export async function indent(tab, options = {}) {
  const newParent = Tab.getPreviousSibling(tab);
  if (!newParent ||
      newParent == tab.$TST.parent)
    return false;

  if (!options.followChildren)
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
  const insertAfter = Tab.getLastDescendant(newParent) || newParent;
  await Tree.attachTabTo(tab, newParent, {
    broadcast:   true,
    forceExpand: true,
    insertAfter
  });
  return true;
}

export async function outdent(tab, options = {}) {
  const parent = tab.$TST.parent;
  if (!parent)
    return false;

  const newParent = parent.$TST.parent;
  if (!options.followChildren)
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
  if (newParent) {
    const insertAfter = Tab.getLastDescendant(parent) || parent;
    await Tree.attachTabTo(tab, newParent, {
      broadcast:   true,
      forceExpand: true,
      insertAfter
    });
  }
  else {
    await Tree.detachTab(tab, {
      broadcast: true,
    });
    const insertAfter = Tab.getLastDescendant(parent) || parent;
    await TabsMove.moveTabAfter(tab, insertAfter, {
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
      type:           Constants.kCOMMAND_PERFORM_TABS_DRAG_DROP,
      windowId:       windowId,
      tabs:           null,
      attachTo:       null,
      insertBefore:   null,
      insertAfter:    null,
      tabIds:         params.tabs.map(tab => tab.id),
      attachToId:     params.attachTo && params.attachTo.id,
      insertBeforeId: params.insertBefore && params.insertBefore.id,
      insertAfterId:  params.insertAfter && params.insertAfter.id,
      inRemote:       false,
      destinationWindowId
    }));
    return;
  }

  log('performTabsDragDrop ', {
    tabs:                params.tabs.map(tab => tab.id),
    attachTo:            params.attachTo && params.attachTo.id,
    insertBefore:        params.insertBefore && params.insertBefore.id,
    insertAfter:         params.insertAfter && params.insertAfter.id,
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
    browser.tabs.update(movedTabs[0].id, { active: true })
      .catch(ApiTabs.handleMissingTabError);
  }
}

// useful utility for general purpose
export async function moveTabsWithStructure(tabs, params = {}) {
  log('moveTabsWithStructure ', tabs.map(tab => tab.id));

  let movedTabs = tabs.filter(tab => !!tab);
  if (!movedTabs.length)
    return [];

  let movedRoots = Tabs.collectRootTabs(movedTabs);

  const movedWholeTree = [].concat(movedRoots);
  for (const movedRoot of movedRoots) {
    const descendants = Tab.getDescendants(movedRoot);
    for (const descendant of descendants) {
      if (!movedWholeTree.includes(descendant))
        movedWholeTree.push(descendant);
    }
  }
  log('=> movedTabs: ', movedTabs.map(tab => tab.id).join(' / '));

  while (params.insertBefore &&
         movedWholeTree.includes(params.insertBefore)) {
    params.insertBefore = Tab.getNext(params.insertBefore);
  }
  while (params.insertAfter &&
         movedWholeTree.includes(params.insertAfter)) {
    params.insertAfter = Tab.getPrevious(params.insertAfter);
  }

  const windowId = params.windowId || tabs[0].windowId;
  const destinationWindowId = params.destinationWindowId ||
    params.insertBefore && params.insertBefore.windowId || 
      params.insertAfter && params.insertAfter.windowId ||
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

  log('=> moving tabs ', movedTabs.map(tab => tab.id));
  if (params.insertBefore)
    await TabsMove.moveTabsBefore(
      movedTabs,
      params.insertBefore,
      { broadcast: params.broadcast }
    );
  else if (params.insertAfter)
    await TabsMove.moveTabsAfter(
      movedTabs,
      params.insertAfter,
      { broadcast: params.broadcast }
    );
  else
    log('=> already placed at expected position');

  /*
  const treeStructure = getTreeStructureFromTabs(movedTabs);

  const newTabs;
  const replacedGroupTabs = Tabs.doAndGetNewTabs(() => {
    newTabs = moveTabsInternal(movedTabs, {
      duplicate:    params.duplicate,
      insertBefore: params.insertBefore,
      insertAfter:  params.insertAfter,
      inRemote:     true
    });
  }, windowId);
  log('=> opened group tabs: ', replacedGroupTabs);
  params.draggedTab.ownerDocument.defaultView.setTimeout(() => {
    if (!Tabs.ensureLivingTab(tab)) // it was removed while waiting
      return;
    log('closing needless group tabs');
    replacedGroupTabs.reverse().forEach(function(tab) {
      log(' check: ', tab.label+'('+tab.index+') '+getLoadingURI(tab));
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
  log('attachTabsWithStructure: start ', tabs.map(tab => tab.id), parent && parent.id);
  if (parent &&
      !options.insertBefore &&
      !options.insertAfter) {
    const refTabs = Tree.getReferenceTabsForNewChild(
      tabs[0],
      parent,
      { ignoreTabs: tabs }
    );
    options.insertBefore = refTabs.insertBefore;
    options.insertAfter  = refTabs.insertAfter;
  }

  if (options.insertBefore)
    await TabsMove.moveTabsBefore(
      options.draggedTabs || tabs,
      options.insertBefore,
      { broadcast: options.broadcast }
    );
  else if (options.insertAfter)
    await TabsMove.moveTabsAfter(
      options.draggedTabs || tabs,
      options.insertAfter,
      { broadcast: options.broadcast }
    );

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
  log('detachTabsWithStructure: start ', tabs.map(tab => tab.id));
  for (const tab of tabs) {
    Tree.detachTab(tab, options);
    Tree.collapseExpandTabAndSubtree(tab, Object.assign({}, options, {
      collapsed: false
    }));
  }
}

export async function moveUp(tab, options = {}) {
  const previousTab = Tab.getPreviousVisible(tab);
  if (!previousTab)
    return false;

  if (!options.followChildren) {
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
    await TabsMove.moveTabBefore(
      tab,
      previousTab,
      { broadcast: true }
    );
    await onMoveUp.dispatch(tab);
  }
  else {
    const referenceTabs = Tree.calculateReferenceTabsFromInsertionPosition(tab, {
      insertBefore: previousTab
    });
    if (!referenceTabs.insertBefore &&
        !referenceTabs.insertAfter)
      return false;
    await moveTabsWithStructure([tab].concat(Tab.getDescendants(tab)), {
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
    const nextTab = Tab.getNextVisible(tab);
    if (!nextTab)
      return false;
    Tree.detachAllChildren(tab, {
      broadcast: true,
      behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    });
    await TabsMove.moveTabAfter(
      tab,
      nextTab,
      { broadcast: true }
    );
    await onMoveDown.dispatch(tab);
  }
  else {
    const nextTab = Tab.getNextVisible(Tab.getLastDescendant(tab) || tab);
    if (!nextTab)
      return false;
    const referenceTabs = Tree.calculateReferenceTabsFromInsertionPosition(tab, {
      insertAfter: nextTab
    });
    if (!referenceTabs.insertBefore && !referenceTabs.insertAfter)
      return false;
    await moveTabsWithStructure([tab].concat(Tab.getDescendants(tab)), {
      attachTo:     referenceTabs.parent,
      insertBefore: referenceTabs.insertBefore,
      insertAfter:  referenceTabs.insertAfter,
      broadcast:    true
    });
  }
  return true;
}


/* commands to simulate Firefox's native tab cocntext menu */

export async function duplicateTab(sourceTab, options = {}) {
  /*
    Due to difference between Firefox's "duplicate tab" implementation,
    TST sometimes fails to detect duplicated tabs based on its
    session information. Thus we need to duplicate as an internally
    duplicated tab. For more details, see also:
    https://github.com/piroor/treestyletab/issues/1437#issuecomment-334952194
  */
  const isMultiselected = options.multiselected === false ? false : Tabs.isMultiselected(sourceTab);
  const sourceTabs = isMultiselected ? Tabs.getSelectedTabs(sourceTab.windowId) : [sourceTab];
  log('source tabs: ', sourceTabs);
  const duplicatedTabs = await Tree.moveTabs(sourceTabs, {
    duplicate:           true,
    destinationWindowId: options.destinationWindowId || sourceTabs[0].windowId,
    insertAfter:         sourceTabs[sourceTabs.length-1]
  });
  await Tree.behaveAutoAttachedTabs(duplicatedTabs, {
    baseTabs:  sourceTabs,
    behavior:  typeof options.behavior == 'number' ? options.behavior : configs.autoAttachOnDuplicated,
    broadcast: true
  });
  return duplicatedTabs;
}

export async function moveTabToStart(tab, options = {}) {
  const isMultiselected = options.multiselected === false ? false : Tabs.isMultiselected(tab);
  return moveTabsToStart(isMultiselected ? Tabs.getSelectedTabs(tab.windowId) : [tab].concat(Tab.getDescendants(tab)));
}

export async function moveTabsToStart(movedTabs) {
  if (movedTabs.length === 0)
    return;
  const tab       = movedTabs[0];
  const allTabs   = tab.pinned ? Tabs.getPinnedTabs(tab.windowId) : Tabs.getUnpinnedTabs(tab.windowId);
  const otherTabs = allTabs.filter(tab => !movedTabs.includes(tab));
  if (otherTabs.length > 0)
    await moveTabsWithStructure(movedTabs, {
      insertBefore: otherTabs[0],
      broadcast:    true
    });
}

export async function moveTabToEnd(tab, options = {}) {
  const isMultiselected = options.multiselected === false ? false : Tabs.isMultiselected(tab);
  return moveTabsToEnd(isMultiselected ? Tabs.getSelectedTabs(tab.windowId) : [tab].concat(Tab.getDescendants(tab)));
}

export async function moveTabsToEnd(movedTabs) {
  if (movedTabs.length === 0)
    return;
  const tab       = movedTabs[0];
  const allTabs   = tab.pinned ? Tabs.getPinnedTabs(tab.windowId) : Tabs.getUnpinnedTabs(tab.windowId);
  const otherTabs = allTabs.filter(tab => !movedTabs.includes(tab));
  if (otherTabs.length > 0)
    await moveTabsWithStructure(movedTabs, {
      insertAfter: otherTabs[otherTabs.length-1],
      broadcast:   true
    });
}

export async function openTabInWindow(tab, options = {}) {
  if (options.multiselected !== false && Tabs.isMultiselected(tab)) {
    return openTabsInWindow(Tabs.getSelectedTabs(tab.windowId));
  }
  else {
    const window = await browser.windows.create({
      tabId:     tab.id,
      incognito: tab.incognito
    });
    return window.id;
  }
}

export async function openTabsInWindow(tabs) {
  const movedTabs = await Tree.openNewWindowFromTabs(tabs);
  return movedTabs[0].windowId;
}

export async function bookmarkTab(tab, options = {}) {
  if (options.multiselected !== false && Tabs.isMultiselected(tab))
    return bookmarkTabs(Tabs.getSelectedTabs(tab.windowId));

  if (SidebarStatus.isOpen(tab.windowId)) {
    browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_BOOKMARK_TAB_WITH_DIALOG,
      windowId: tab.windowId,
      tabId:    tab.id
    });
  }
  else {
    await Bookmark.bookmarkTab(tab);
    notify({
      title:   browser.i18n.getMessage('bookmarkTab_notification_success_title'),
      message: browser.i18n.getMessage('bookmarkTab_notification_success_message', [
        tab.title
      ]),
      icon:    Constants.kNOTIFICATION_DEFAULT_ICON
    });
  }
}

export async function bookmarkTabs(tabs) {
  if (tabs.length == 0)
    return;
  if (SidebarStatus.isOpen(tabs[0].windowId)) {
    browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_BOOKMARK_TABS_WITH_DIALOG,
      windowId: tabs[0].windowId,
      tabIds:   tabs.map(tab => tab.id)
    });
  }
  else {
    const folder = await Bookmark.bookmarkTabs(tabs);
    if (folder)
      notify({
        title:   browser.i18n.getMessage('bookmarkTabs_notification_success_title'),
        message: browser.i18n.getMessage('bookmarkTabs_notification_success_message', [
          tabs[0].title,
          tabs.length,
          folder.title
        ]),
        icon:    Constants.kNOTIFICATION_DEFAULT_ICON
      });
  }
}

export async function reopenInContainer(sourceTabOrTabs, cookieStoreId, options = {}) {
  let sourceTabs;
  if (Array.isArray(sourceTabOrTabs)) {
    sourceTabs = sourceTabOrTabs;
  }
  else {
    const isMultiselected = options.multiselected === false ? false : Tabs.isMultiselected(sourceTabOrTabs);
    sourceTabs = isMultiselected ? Tabs.getSelectedTabs(sourceTabOrTabs.windowId) : [sourceTabOrTabs];
  }
  if (sourceTabs.length === 0)
    return [];
  const tabs = await TabsOpen.openURIsInTabs(sourceTabs.map(tab => tab.url), {
    isOrphan: true,
    windowId: sourceTabs[0].windowId,
    cookieStoreId
  });
  await Tree.behaveAutoAttachedTabs(tabs, {
    baseTabs:  sourceTabs,
    behavior:  configs.autoAttachOnDuplicated,
    broadcast: true
  });
  return tabs;
}
