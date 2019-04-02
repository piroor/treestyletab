/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import TabIdFixer from '/extlib/TabIdFixer.js';

import {
  log as internalLogger,
  wait,
  dumpTab,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as SidebarConnection from '/common/sidebar-connection.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as UserOperationBlocker from '/common/user-operation-blocker.js';
import * as MetricsData from '/common/metrics-data.js';

import Tab from '/common/Tab.js';
import Window from '/common/Window.js';

import * as TabsMove from './tabs-move.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('background/tree', ...args);
}
function logCollapseExpand(...args) {
  internalLogger('sidebar/collapse-expand', ...args);
}


export const onAttached     = new EventListenerManager();
export const onDetached     = new EventListenerManager();
export const onSubtreeCollapsedStateChanging = new EventListenerManager();
export const onSubtreeCollapsedStateChanged  = new EventListenerManager();


// return moved (or not)
export async function attachTabTo(child, parent, options = {}) {
  parent = TabsStore.ensureLivingTab(parent);
  child = TabsStore.ensureLivingTab(child);
  if (!parent || !child) {
    log('missing information: ', { parent, child });
    return false;
  }

  log('attachTabTo: ', {
    child:            child.id,
    parent:           parent.id,
    children:         parent.$TST.getAttribute(Constants.kCHILDREN),
    insertAt:         options.insertAt,
    insertBefore:     options.insertBefore && options.insertBefore.id,
    insertAfter:      options.insertAfter && options.insertAfter.id,
    dontMove:         options.dontMove,
    dontUpdateIndent: options.dontUpdateIndent,
    forceExpand:      options.forceExpand,
    dontExpand:       options.dontExpand,
    delayedMove:      options.delayedMove,
    broadcast:        options.broadcast,
    broadcasted:      options.broadcasted,
    stack:            `${configs.debug && new Error().stack}\n${options.stack || ''}`
  });

  if (parent.pinned || child.pinned) {
    log('=> pinned tabs cannot be attached');
    return false;
  }
  if (parent.windowId != child.windowId) {
    log('=> could not attach tab to a parent in different window');
    return false;
  }
  const ancestors = [parent].concat(child.$TST.ancestors);
  if (ancestors.includes(child)) {
    log('=> canceled for recursive request');
    return false;
  }

  if (options.dontMove) {
    log('=> do not move');
    options.insertBefore = child.$TST.nextTab;
    if (!options.insertBefore)
      options.insertAfter = child.$TST.previousTab;
  }

  if (!options.insertBefore && !options.insertAfter) {
    const refTabs = getReferenceTabsForNewChild(child, parent, options);
    options.insertBefore = refTabs.insertBefore;
    options.insertAfter  = refTabs.insertAfter;
    log('=> calculate reference tabs ', refTabs);
  }
  options.insertAfter = options.insertAfter || parent;
  log(`reference tabs for ${child.id}: `, {
    insertBefore: options.insertBefore,
    insertAfter:  options.insertAfter
  });

  await Tab.waitUntilTrackedAll(child.windowId);

  parent = TabsStore.ensureLivingTab(parent);
  child = TabsStore.ensureLivingTab(child);
  if (!parent || !child) {
    log('attachTabTo: parent or child is closed before attaching.');
    return false;
  }

  const newIndex = Tab.calculateNewTabIndex({
    insertBefore: options.insertBefore,
    insertAfter:  options.insertAfter,
    ignoreTabs:   [child]
  });
  const moved = newIndex != child.index;
  log(`newIndex for ${child.id}: `, newIndex);

  const newlyAttached = (
    !parent.$TST.childIds.includes(child.id) ||
    child.$TST.parentId != parent.id
  );
  if (!newlyAttached)
    log('=> already attached');

  if (newlyAttached) {
    detachTab(child, Object.assign({}, options, {
      // Don't broadcast this detach operation, because this "attachTabTo" can be
      // broadcasted. If we broadcast this detach operation, the tab is detached
      // twice in the sidebar!
      broadcast: false
    }));

    log('attachTabTo: setting child information to ', parent.id);
    // we need to set its children via the "children" setter, to invalidate cached information.
    parent.$TST.children = parent.$TST.childIds.concat([child.id]);

    // We don't need to update its parent information, because the parent's
    // "children" setter updates the child itself automatically.

    const parentLevel = parseInt(parent.$TST.getAttribute(Constants.kLEVEL) || 0);
    if (!options.dontUpdateIndent) {
      updateTabsIndent(child, parentLevel + 1);
    }

    SidebarConnection.sendMessage({
      type:     Constants.kCOMMAND_NOTIFY_CHILDREN_CHANGED,
      windowId: parent.windowId,
      tabId:    parent.id,
      childIds: parent.$TST.childIds,
      newChildIds: [child.id],
      newlyAttached
    });
  }

  onAttached.dispatch(child, Object.assign({}, options, {
    parent,
    insertBefore: options.insertBefore,
    insertAfter:  options.insertAfter,
    newIndex, newlyAttached
  }));

  return moved;
}

export function getReferenceTabsForNewChild(child, parent, options = {}) {
  log('getReferenceTabsForNewChild ', child, parent, options);
  let insertAt = options.insertAt;
  if (typeof insertAt !== 'number')
    insertAt = configs.insertNewChildAt;
  log('  insertAt = ', insertAt);
  let descendants = parent.$TST.descendants;
  if (options.ignoreTabs)
    descendants = descendants.filter(tab => !options.ignoreTabs.includes(tab));
  log('  descendants = ', descendants);
  let insertBefore, insertAfter;
  if (descendants.length > 0) {
    const firstChild     = descendants[0];
    const lastDescendant = descendants[descendants.length-1];
    switch (insertAt) {
      case Constants.kINSERT_END:
      default:
        insertAfter = lastDescendant;
        log('  insert after lastDescendant (insertAt=kINSERT_END)');
        break;
      case Constants.kINSERT_FIRST:
        insertBefore = firstChild;
        log('  insert before firstChild (insertAt=kINSERT_FIRST)');
        break;
      case Constants.kINSERT_NEAREST: {
        const allTabs = Tab.getOtherTabs(parent.windowId, options.ignoreTabs);
        const index = allTabs.indexOf(child);
        if (index < allTabs.indexOf(firstChild)) {
          insertBefore = firstChild;
          insertAfter  = parent;
          log('  insert between parent and firstChild (insertAt=kINSERT_NEAREST)');
        }
        else if (index > allTabs.indexOf(lastDescendant)) {
          insertAfter  = lastDescendant;
          log('  insert after lastDescendant (insertAt=kINSERT_NEAREST)');
        }
        else { // inside the tree
          let children = parent.$TST.children;
          if (options.ignoreTabs)
            children = children.filter(tab => !options.ignoreTabs.includes(tab));
          for (const child of children) {
            if (index > allTabs.indexOf(child))
              continue;
            insertBefore = child;
            log('  insert before nearest following child (insertAt=kINSERT_NEAREST)');
            break;
          }
          if (!insertBefore) {
            insertAfter = lastDescendant;
            log('  insert after lastDescendant (insertAt=kINSERT_NEAREST)');
          }
        }
      }; break;
    }
  }
  else {
    insertAfter = parent;
    log('  insert after parent');
  }
  if (insertBefore == child) {
    // Return unsafe tab, to avoid placing the child after hidden tabs
    // (too far from the place it should be.)
    insertBefore = insertBefore && insertBefore.$TST.unsafeNextTab;
    log('  => insert before next tab of the child tab itelf');
  }
  if (insertAfter == child) {
    insertAfter = insertAfter && insertAfter.$TST.previousTab;
    log('  => insert after previous tab of the child tab itelf');
  }
  // disallow to place tab in invalid position
  if (insertBefore) {
    if (insertBefore.index <= parent.index) {
      insertBefore = null;
      log('  => do not put before a tab preceding to the parent');
    }
    //TODO: we need to reject more cases...
  }
  if (insertAfter) {
    const allTabsInTree = [parent].concat(descendants);
    const lastMember    = allTabsInTree[allTabsInTree.length - 1];
    if (insertAfter.index >= lastMember.index) {
      insertAfter = lastMember;
      log('  => do not put after the last tab in the tree');
    }
    //TODO: we need to reject more cases...
  }
  return { insertBefore, insertAfter };
}

export function getReferenceTabsForNewNextSibling(base, options = {}) {
  log('getReferenceTabsForNewNextSibling ', base);
  let insertBefore = base.$TST.nextSiblingTab;
  if (insertBefore &&
      insertBefore.pinned &&
      !options.pinned) {
    insertBefore = Tab.getFirstNormalTab(base.windowId);
  }
  let insertAfter  = base.$TST.lastDescendant || base;
  if (insertAfter &&
      !insertAfter.pinned &&
      options.pinned) {
    insertAfter = Tab.getLastPinnedTab(base.windowId);
  }
  return { insertBefore, insertAfter };
}

export function detachTab(child, options = {}) {
  log('detachTab: ', child.id, options,
      { stack: `${configs.debug && new Error().stack}\n${options.stack || ''}` });
  // the "parent" option is used for removing child.
  const parent = TabsStore.ensureLivingTab(options.parent) || child.$TST.parent;

  if (!parent)
    log(` => parent(${child.$TST.parentId}) is already removed, or orphan tab`);

  // we need to set children and parent via setters, to invalidate cached information.
  if (parent) {
    parent.$TST.children = parent.$TST.childIds.filter(id => id != child.id);
    log('detachTab: children information is updated ', parent.id, parent.$TST.childIds);
    SidebarConnection.sendMessage({
      type:     Constants.kCOMMAND_NOTIFY_CHILDREN_CHANGED,
      windowId: parent.windowId,
      tabId:    parent.id,
      childIds: parent.$TST.childIds,
      newChildIds: [],
      detached: true
    });
  }
  // We don't need to clear its parent information, because the old parent's
  // "children" setter removes the parent ifself from the detached child
  // automatically.

  updateTabsIndent(child);

  onDetached.dispatch(child, {
    oldParentTab: parent
  });
}

export async function detachTabsFromTree(tabs, options = {}) {
  if (!Array.isArray(tabs))
    tabs = [tabs];
  tabs = Array.from(tabs).reverse();
  const promisedAttach = [];
  for (const tab of tabs) {
    const children = tab.$TST.children;
    const parent   = tab.$TST.parent;
    for (const child of children) {
      if (!tabs.includes(child)) {
        if (parent)
          promisedAttach.push(attachTabTo(child, parent, Object.assign({}, options, {
            dontMove: true
          })));
        else
          detachTab(child, options);
      }
    }
  }
  if (promisedAttach.length > 0)
    await Promise.all(promisedAttach);
}

export function detachAllChildren(tab, options = {}) {
  log('detachAllChildren: ', tab.id);
  // the "children" option is used for removing tab.
  const children = options.children ? options.children.map(TabsStore.ensureLivingTab) : tab.$TST.children;
  if (!children.length)
    return;
  log(' => children to be detached: ', children.map(dumpTab));

  if (!('behavior' in options))
    options.behavior = Constants.kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN;
  if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    options.behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  options.dontUpdateInsertionPositionInfo = true;

  // the "parent" option is used for removing tab.
  const parent = TabsStore.ensureLivingTab(options.parent) || tab.$TST.parent;
  if (tab.$TST.isGroupTab &&
      Tab.getRemovingTabs(tab.windowId).length == children.length) {
    options.behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
    options.dontUpdateIndent = false;
  }

  let nextTab = null;
  if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN &&
      !configs.moveTabsToBottomWhenDetachedFromClosedParent) {
    nextTab = tab.$TST.nearestFollowingRootTab;
  }

  if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB) {
    // open new group tab and replace the detaching tab with it.
    options.behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
  }

  if (options.behavior != Constants.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN)
    collapseExpandSubtree(tab, Object.assign({}, options, {
      collapsed: false
    }));

  let count = 0;
  for (const child of children) {
    if (!child)
      continue;
    if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN) {
      detachTab(child, options);
      moveTabSubtreeBefore(child, nextTab, options);
    }
    else if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD) {
      detachTab(child, options);
      if (count == 0) {
        if (parent) {
          attachTabTo(child, parent, Object.assign({}, options, {
            dontExpan: true,
            dontMove:  true
          }));
        }
        collapseExpandSubtree(child, Object.assign({}, options, {
          collapsed: false
        }));
        //deleteTabValue(child, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
      }
      else {
        attachTabTo(child, children[0], Object.assign({}, options, {
          dontExpand: true,
          dontMove:   true
        }));
      }
    }
    else if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN && parent) {
      attachTabTo(child, parent, Object.assign({}, options, {
        dontExpand: true,
        dontMove:   true
      }));
    }
    else { // options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN
      detachTab(child, options);
    }
    count++;
  }
}

// returns moved (or not)
export async function behaveAutoAttachedTab(tab, options = {}) {
  const baseTab = options.baseTab || Tab.getActiveTab(TabsStore.getWindow() || tab.windowId);
  log('behaveAutoAttachedTab ', tab.id, baseTab.id, options);
  if (baseTab.pinned) {
    if (!tab.pinned)
      return false;
    options.behavior = Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING;
    log(' => override behavior for pinned tabs');
  }
  switch (options.behavior) {
    default:
      return false;

    case Constants.kNEWTAB_OPEN_AS_ORPHAN:
      log(' => kNEWTAB_OPEN_AS_ORPHAN');
      detachTab(tab, {
        broadcast: options.broadcast
      });
      if (tab.$TST.nextTab)
        return TabsMove.moveTabAfter(tab, Tab.getLastTab(tab.windowId), {
          delayedMove: true
        });
      return false;

    case Constants.kNEWTAB_OPEN_AS_CHILD:
      log(' => kNEWTAB_OPEN_AS_CHILD');
      return attachTabTo(tab, baseTab, {
        dontMove:    options.dontMove || configs.insertNewChildAt == Constants.kINSERT_NO_CONTROL,
        forceExpand: true,
        delayedMove: true,
        broadcast:   options.broadcast
      });

    case Constants.kNEWTAB_OPEN_AS_SIBLING: {
      log(' => kNEWTAB_OPEN_AS_SIBLING');
      const parent = baseTab.$TST.parent;
      if (parent) {
        await attachTabTo(tab, parent, {
          delayedMove: true,
          broadcast: options.broadcast
        });
        return true;
      }
      else {
        detachTab(tab, {
          broadcast: options.broadcast
        });
        return TabsMove.moveTabAfter(tab, Tab.getLastTab(tab.windowId), {
          delayedMove: true
        });
      }
    };

    case Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING: {
      log(' => kNEWTAB_OPEN_AS_NEXT_SIBLING');
      let nextSibling = baseTab.$TST.nextSiblingTab;
      if (nextSibling == tab)
        nextSibling = null;
      const parent = baseTab.$TST.parent;
      if (parent) {
        return attachTabTo(tab, parent, {
          insertBefore: nextSibling,
          insertAfter:  baseTab.$TST.lastDescendant || baseTab,
          delayedMove:  true,
          broadcast:    options.broadcast
        });
      }
      else {
        detachTab(tab, {
          broadcast: options.broadcast
        });
        if (nextSibling)
          return TabsMove.moveTabBefore(tab, nextSibling, {
            delayedMove: true,
            broadcast: options.broadcast
          });
        else
          return TabsMove.moveTabAfter(tab, baseTab.$TST.lastDescendant, {
            delayedMove: true,
            broadcast: options.broadcast
          });
      }
    };
  }
}

export async function behaveAutoAttachedTabs(tabs, options = {}) {
  switch (options.behavior) {
    default:
      return false;

    case Constants.kNEWTAB_OPEN_AS_ORPHAN:
      if (options.baseTabs && !options.baseTab)
        options.baseTab = options.baseTabs[options.baseTabs.length-1];
      for (const tab of tabs) {
        await behaveAutoAttachedTab(tab, options);
      }
      return false;

    case Constants.kNEWTAB_OPEN_AS_CHILD: {
      if (options.baseTabs && !options.baseTab)
        options.baseTab = options.baseTabs[0];
      let moved = false;
      for (const tab of tabs) {
        moved = (await behaveAutoAttachedTab(tab, options)) || moved;
      }
      return moved;
    };

    case Constants.kNEWTAB_OPEN_AS_SIBLING:
    case Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING: {
      if (options.baseTabs && !options.baseTab)
        options.baseTab = options.baseTabs[options.baseTabs.length-1];
      let moved = false;
      for (const tab of tabs.reverse()) {
        moved = (await behaveAutoAttachedTab(tab, options)) || moved;
      }
      return moved;
    };
  }
}

function updateTabsIndent(tabs, level = undefined) {
  if (!tabs)
    return;

  if (!Array.isArray(tabs))
    tabs = [tabs];

  if (!tabs.length)
    return;

  if (level === undefined)
    level = tabs[0].$TST.ancestors.length;

  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    const item = tabs[i];
    if (!item || item.pinned)
      continue;

    updateTabIndent(item, level);
  }
}

// this is called multiple times on a session restoration, so this should be throttled for better performance
function updateTabIndent(tab, level = undefined) {
  let timer = updateTabIndent.delayed.get(tab.id);
  if (timer)
    clearTimeout(timer);
  timer = setTimeout(() => {
    updateTabIndent.delayed.delete(tab.id);
    if (!TabsStore.ensureLivingTab(tab))
      return;
    tab.$TST.setAttribute(Constants.kLEVEL, level);
    updateTabsIndent(tab.$TST.children, level + 1);
    SidebarConnection.sendMessage({
      type:     Constants.kCOMMAND_NOTIFY_TAB_LEVEL_CHANGED,
      windowId: tab.windowId,
      tabId:    tab.id,
      level
    });
  }, 100);
  updateTabIndent.delayed.set(tab.id, timer);
}
updateTabIndent.delayed = new Map();


// collapse/expand tabs

export async function collapseExpandSubtree(tab, params = {}) {
  params.collapsed = !!params.collapsed;
  if (!tab || !TabsStore.ensureLivingTab(tab))
    return;
  if (!TabsStore.ensureLivingTab(tab)) // it was removed while waiting
    return;
  params.stack = `${configs.debug && new Error().stack}\n${params.stack || ''}`;
  logCollapseExpand('collapseExpandSubtree: ', dumpTab(tab), tab.$TST.subtreeCollapsed, params);
  await collapseExpandSubtreeInternal(tab, params);
  onSubtreeCollapsedStateChanged.dispatch(tab, { collapsed: !!params.collapsed });
}
function collapseExpandSubtreeInternal(tab, params = {}) {
  if (!params.force &&
      tab.$TST.subtreeCollapsed == params.collapsed)
    return;

  if (params.collapsed) {
    tab.$TST.addState(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
    tab.$TST.removeState(Constants.kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
  }
  else {
    tab.$TST.removeState(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  }
  //setTabValue(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED, params.collapsed);

  const childTabs = tab.$TST.children;
  const lastExpandedTabIndex = childTabs.length - 1;
  for (let i = 0, maxi = childTabs.length; i < maxi; i++) {
    const childTab = childTabs[i];
    if (!params.collapsed &&
        !params.justNow &&
        i == lastExpandedTabIndex) {
      collapseExpandTabAndSubtree(childTab, {
        collapsed: params.collapsed,
        justNow:   params.justNow,
        anchor:    tab,
        last:      true,
        broadcast: false
      });
    }
    else {
      collapseExpandTabAndSubtree(childTab, {
        collapsed: params.collapsed,
        justNow:   params.justNow,
        broadcast: false
      });
    }
  }

  onSubtreeCollapsedStateChanging.dispatch(tab, { collapsed: params.collapsed });
  SidebarConnection.sendMessage({
    type:      Constants.kCOMMAND_NOTIFY_SUBTREE_COLLAPSED_STATE_CHANGED,
    windowId:  tab.windowId,
    tabId:     tab.id,
    collapsed: !!params.collapsed,
    justNow:   params.justNow,
    anchorId:  tab.id,
    last:      true
  });
}

export function manualCollapseExpandSubtree(tab, params = {}) {
  params.manualOperation = true;
  collapseExpandSubtree(tab, params);
  if (!params.collapsed) {
    tab.$TST.addState(Constants.kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
    //setTabValue(tab, Constants.kTAB_STATE_SUBTREE_EXPANDED_MANUALLY, true);
  }
}

export function collapseExpandTabAndSubtree(tab, params = {}) {
  if (!tab)
    return;

  const parent = tab.$TST.parent;
  if (!parent)
    return;

  collapseExpandTab(tab, params);

  if (params.collapsed && tab.active) {
    const newSelection = tab.$TST.nearestVisibleAncestorOrSelf;
    logCollapseExpand('current tab is going to be collapsed, switch to ', newSelection.id);
    TabsInternalOperation.activateTab(newSelection, { silently: true });
  }

  if (!tab.$TST.subtreeCollapsed) {
    const children = tab.$TST.children;
    children.forEach((child, index) => {
      const last = params.last &&
                     (index == children.length - 1);
      collapseExpandTabAndSubtree(child, Object.assign({}, params, {
        collapsed: params.collapsed,
        justNow:   params.justNow,
        anchor:    last && params.anchor,
        last:      last,
        broadcast: params.broadcast
      }));
    });
  }
}

export async function collapseExpandTab(tab, params = {}) {
  if (tab.pinned && params.collapsed) {
    log('CAUTION: a pinned tab is going to be collapsed, but canceled.',
        dumpTab(tab), { stack: configs.debug && new Error().stack });
    params.collapsed = false;
  }

  // When an asynchronous "expand" operation is processed after a
  // synchronous "collapse" operation, it can produce an expanded
  // child tab under "subtree-collapsed" parent. So this is a failsafe.
  if (!params.collapsed &&
      tab.$TST.ancestors.some(ancestor => ancestor.$TST.subtreeCollapsed))
    return;

  const stack = `${configs.debug && new Error().stack}\n${params.stack || ''}`;
  logCollapseExpand(`collapseExpandTab ${tab.id} `, params, { stack })
  const last = params.last &&
                 (!tab.$TST.hasChild || tab.$TST.subtreeCollapsed);
  const byAncestor = tab.$TST.ancestors.some(ancestor => ancestor.$TST.subtreeCollapsed) == params.collapsed;
  const collapseExpandInfo = Object.assign({}, params, {
    anchor: last && params.anchor,
    last
  });

  if (params.collapsed) {
    tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED);
    TabsStore.removeVisibleTab(tab);
  }
  else {
    tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED);
    TabsStore.addVisibleTab(tab);
  }

  Tab.onCollapsedStateChanged.dispatch(tab, collapseExpandInfo);

  // the message is called multiple times on a session restoration, so it should be throttled for better performance
  let timer = collapseExpandTab.delayedNotify.get(tab.id);
  if (timer)
    clearTimeout(timer);
  timer = setTimeout(() => {
    collapseExpandTab.delayedNotify.delete(tab.id);
    if (!TabsStore.ensureLivingTab(tab))
      return;
    SidebarConnection.sendMessage({
      type:      Constants.kCOMMAND_NOTIFY_TAB_COLLAPSED_STATE_CHANGED,
      windowId:  tab.windowId,
      tabId:     tab.id,
      anchorId:  collapseExpandInfo.anchor && collapseExpandInfo.anchor.id,
      justNow:   params.justNow,
      collapsed: params.collapsed,
      last,
      stack,
      byAncestor
    });
  }, 100);
  collapseExpandTab.delayedNotify.set(tab.id, timer);
}
collapseExpandTab.delayedNotify = new Map();

export function collapseExpandTreesIntelligentlyFor(tab, options = {}) {
  if (!tab)
    return;

  logCollapseExpand('collapseExpandTreesIntelligentlyFor ', tab);
  const window = TabsStore.windows.get(tab.windowId);
  if (window.doingIntelligentlyCollapseExpandCount > 0) {
    logCollapseExpand('=> done by others');
    return;
  }
  window.doingIntelligentlyCollapseExpandCount++;

  const expandedAncestors = [tab.id]
    .concat(tab.$TST.ancestors.map(ancestor => ancestor.id))
    .concat(tab.$TST.descendants.map(descendant => descendant.id));
  const collapseTabs = Tab.getSubtreeCollapsedTabs(tab.windowId, {
    '!id': expandedAncestors
  });
  logCollapseExpand(`${collapseTabs.length} tabs can be collapsed, ancestors: `, expandedAncestors);
  for (const collapseTab of collapseTabs) {
    let dontCollapse = false;
    const parentTab = collapseTab.$TST.parent;
    if (parentTab) {
      dontCollapse = true;
      if (!parentTab.$TST.subtreeCollapsed) {
        for (const ancestor of collapseTab.$TST.ancestors) {
          if (!expandedAncestors.includes(ancestor.id))
            continue;
          dontCollapse = false;
          break;
        }
      }
    }
    logCollapseExpand(`${collapseTab.id}: dontCollapse = ${dontCollapse}`);

    const manuallyExpanded = collapseTab.$TST.states.has(Constants.kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
    if (!dontCollapse && !manuallyExpanded)
      collapseExpandSubtree(collapseTab, Object.assign({}, options, {
        collapsed: true
      }));
  }

  collapseExpandSubtree(tab, Object.assign({}, options, {
    collapsed: false
  }));
  window.doingIntelligentlyCollapseExpandCount--;
}

export async function fixupSubtreeCollapsedState(tab, options = {}) {
  let fixed = false;
  if (!tab.$TST.hasChild)
    return fixed;
  const firstChild = tab.$TST.firstChild;
  const childrenCollapsed = firstChild.$TST.collapsed;
  const collapsedStateMismatched = tab.$TST.subtreeCollapsed != childrenCollapsed;
  const nextIsFirstChild = tab.$TST.nextTab == firstChild;
  log('fixupSubtreeCollapsedState ', {
    tab: tab.id,
    childrenCollapsed,
    collapsedStateMismatched,
    nextIsFirstChild
  });
  if (collapsedStateMismatched) {
    log(' => set collapsed state');
    await collapseExpandSubtree(tab, Object.assign({}, options, {
      collapsed: childrenCollapsed
    }));
    fixed = true;
  }
  if (!nextIsFirstChild) {
    log(' => move child tabs');
    await followDescendantsToMovedRoot(tab, options);
    fixed = true;
  }
  return fixed;
}


// operate tabs based on tree information

export async function moveTabSubtreeBefore(tab, nextTab, options = {}) {
  if (!tab)
    return;
  if (nextTab && nextTab.$TST.isAllPlacedBeforeSelf([tab].concat(tab.$TST.descendants))) {
    log('moveTabSubtreeBefore:no need to move');
    return;
  }

  log('moveTabSubtreeBefore: ', tab.id, nextTab && nextTab.id);
  const window = TabsStore.windows.get(tab.windowId);
  window.subTreeMovingCount++;
  try {
    await TabsMove.moveTabInternallyBefore(tab, nextTab, options);
    if (!TabsStore.ensureLivingTab(tab)) // it is removed while waiting
      throw new Error('the tab was removed before moving of descendants');
    await followDescendantsToMovedRoot(tab, options);
  }
  catch(e) {
    log(`failed to move subtree: ${String(e)}`);
  }
  await wait(0);
  window.subTreeMovingCount--;
}

export async function moveTabSubtreeAfter(tab, previousTab, options = {}) {
  if (!tab)
    return;
  if (previousTab && previousTab.$TST.isAllPlacedAfterSelf([tab].concat(tab.$TST.descendants))) {
    log('moveTabSubtreeAfter:no need to move');
    return;
  }

  log('moveTabSubtreeAfter: ', tab.id, previousTab && previousTab.id);
  const window = TabsStore.windows.get(tab.windowId);
  window.subTreeMovingCount++;
  try {
    await TabsMove.moveTabInternallyAfter(tab, previousTab, options);
    if (!TabsStore.ensureLivingTab(tab)) // it is removed while waiting
      throw new Error('the tab was removed before moving of descendants');
    await followDescendantsToMovedRoot(tab, options);
  }
  catch(e) {
    log(`failed to move subtree: ${String(e)}`);
  }
  await wait(0);
  window.subTreeMovingCount--;
}

export async function followDescendantsToMovedRoot(tab, options = {}) {
  if (!tab.$TST.hasChild)
    return;

  log('followDescendantsToMovedRoot: ', tab);
  const window = TabsStore.windows.get(tab.windowId);
  window.subTreeChildrenMovingCount++;
  window.subTreeMovingCount++;
  await TabsMove.moveTabsAfter(tab.$TST.descendants, tab, options);
  window.subTreeChildrenMovingCount--;
  window.subTreeMovingCount--;
}

export async function moveTabs(tabs, options = {}) {
  tabs = tabs.filter(TabsStore.ensureLivingTab);
  if (tabs.length == 0)
    return [];

  log('moveTabs: ', tabs.map(dumpTab), options);

  const windowId = parseInt(tabs[0].windowId || TabsStore.getWindow());

  let newWindow = options.destinationPromisedNewWindow;

  let destinationWindowId = options.destinationWindowId;
  if (!destinationWindowId && !newWindow)
    destinationWindowId = TabsStore.getWindow();

  const isAcrossWindows = windowId != destinationWindowId || !!newWindow;

  options.insertAfter = options.insertAfter || Tab.getLastTab(destinationWindowId);

  let movedTabs = tabs;
  const structure = getTreeStructureFromTabs(tabs);
  log('original tree structure: ', structure);

  if (isAcrossWindows || options.duplicate) {
    UserOperationBlocker.blockIn(windowId, { throbber: true });
    try {
      let window;
      const prepareWindow = () => {
        window = Window.init(destinationWindowId);
        if (isAcrossWindows) {
          window.toBeOpenedTabsWithPositions += tabs.length;
          window.toBeOpenedOrphanTabs += tabs.length;
          for (const tab of tabs) {
            window.toBeAttachedTabs.add(tab.id);
          }
        }
      };
      if (newWindow) {
        newWindow = newWindow.then(window => {
          log('moveTabs: destination window is ready, ', window);
          destinationWindowId = window.id;
          prepareWindow();
          return window;
        });
      }
      else {
        prepareWindow();
      }

      let movedTabs   = tabs;
      let movedTabIds = tabs.map(tab => tab.id);
      await Promise.all([
        newWindow,
        (async () => {
          const sourceWindow = TabsStore.windows.get(tabs[0].windowId);
          if (options.duplicate) {
            sourceWindow.toBeOpenedTabsWithPositions += tabs.length;
            sourceWindow.toBeOpenedOrphanTabs += tabs.length;
            sourceWindow.duplicatingTabsCount += tabs.length;
          }
          if (isAcrossWindows) {
            for (const tab of tabs) {
              sourceWindow.toBeDetachedTabs.add(tab.id);
            }
          }

          log('preparing tabs');
          if (options.duplicate) {
            const startTime = Date.now();
            // This promise will be resolved with very large delay.
            // (See also https://bugzilla.mozilla.org/show_bug.cgi?id=1394376 )
            const promisedDuplicatedTabs = Promise.all(movedTabIds.map(async (id, _index) => {
              try {
                return await browser.tabs.duplicate(id).catch(ApiTabs.createErrorHandler());
              }
              catch(e) {
                ApiTabs.handleMissingTabError(e);
                return null;
              }
            })).then(tabs => {
              log(`ids from API responses are resolved in ${Date.now() - startTime}msec: `, tabs.map(dumpTab));
              return tabs;
            });
            if (configs.acceleratedTabDuplication) {
              // So, I collect duplicating tabs in different way.
              // This promise will be resolved when they actually
              // appear in the tab bar. This hack should be removed
              // after the bug 1394376 is fixed.
              const promisedDuplicatingTabs = (async () => {
                while (true) {
                  await wait(100);
                  const tabs = Tab.getDuplicatingTabs(windowId);
                  UserOperationBlocker.setProgress(Math.round(tabs.length / movedTabIds.length * 50), windowId);
                  if (tabs.length < movedTabIds.length)
                    continue; // not opened yet
                  const tabIds = tabs.map(tab => tab.id);
                  if (tabIds.join(',') == tabIds.sort().join(','))
                    continue; // not sorted yet
                  return tabs;
                }
              })().then(tabs => {
                log(`ids from duplicating tabs are resolved in ${Date.now() - startTime}msec: `, tabs.map(tab => tab.id));
                return tabs;
              });
              movedTabs = await Promise.race([
                promisedDuplicatedTabs,
                promisedDuplicatingTabs
              ]);
            }
            else {
              movedTabs = await promisedDuplicatedTabs;
            }
            UserOperationBlocker.setProgress(50, windowId);
            movedTabs = movedTabs.map(tab => Tab.get(tab.id));
            movedTabIds = movedTabs.map(tab => tab.id);
          }
        })()
      ]);
      log('moveTabs: all windows and tabs are ready, ', movedTabIds, destinationWindowId);
      // we must put moved tab at the first position by default, because pinned tabs cannot be placed after regular tabs.
      let toIndex = 0; // Tab.getAllTabs(destinationWindowId).length;
      log('toIndex = ', toIndex);
      if (options.insertBefore &&
          options.insertBefore.windowId == destinationWindowId) {
        try {
          const latestTab = await browser.tabs.get(options.insertBefore.id).catch(ApiTabs.createErrorHandler());
          toIndex = latestTab.index;
        }
        catch(e) {
          ApiTabs.handleMissingTabError(e);
          log('options.insertBefore is unavailable');
        }
      }
      else if (options.insertAfter &&
               options.insertAfter.windowId == destinationWindowId) {
        try {
          const latestTab = await browser.tabs.get(options.insertAfter.id).catch(ApiTabs.createErrorHandler());
          toIndex = latestTab.index + 1;
        }
        catch(e) {
          ApiTabs.handleMissingTabError(e);
          log('options.insertAfter is unavailable');
        }
      }
      if (!isAcrossWindows &&
          tabs[0].index < toIndex)
        toIndex--;
      log(' => ', toIndex);
      if (isAcrossWindows) {
        movedTabs = await ApiTabs.safeMoveAcrossWindows(movedTabIds, {
          windowId: destinationWindowId,
          index:    toIndex
        });
        movedTabs   = movedTabs.map(tab => Tab.get(tab.id));
        movedTabIds = movedTabs.map(tab => tab.id);
        for (const tab of movedTabs) {
          tab.windowId = destinationWindowId;
        }
        log('moved across windows: ', movedTabIds);
      }

      log('applying tree structure', structure);
      // wait until tabs.onCreated are processed (for safety)
      let newTabs;
      const startTime = Date.now();
      const maxDelay = configs.maximumAcceptableDelayForTabDuplication;
      while (Date.now() - startTime < maxDelay) {
        newTabs = movedTabs.map(tab => Tab.get(TabIdFixer.fixTab(tab).id));
        newTabs = newTabs.filter(tab => !!tab);
        UserOperationBlocker.setProgress(Math.round(newTabs.length / tabs.length * 50) + 50, windowId);
        if (newTabs.length < tabs.length) {
          log('retrying: ', movedTabIds, newTabs.length, tabs.length);
          await wait(100);
          continue;
        }
        await Promise.all(newTabs.map(tab => tab.$TST.opened));
        await applyTreeStructureToTabs(newTabs, structure, {
          broadcast: true
        });
        if (options.duplicate) {
          for (const tab of newTabs) {
            tab.$TST.removeState(Constants.kTAB_STATE_DUPLICATING, { broadcast: true });
            TabsStore.removeDuplicatingTab(tab);
          }
        }
        break;
      }

      if (!newTabs) {
        log('failed to move tabs (timeout)');
        newTabs = [];
      }
      movedTabs = newTabs;
    }
    catch(e) {
      if (configs.debug)
        console.log('failed to move/duplicate tabs ', e, new Error().stack);
      throw e;
    }
    finally {
      UserOperationBlocker.unblockIn(windowId, { throbber: true });
    }
  }


  movedTabs = movedTabs.map(tab => Tab.get(tab.id));
  movedTabs = movedTabs.filter(tab => !!tab);
  if (options.insertBefore) {
    await TabsMove.moveTabsBefore(
      movedTabs,
      options.insertBefore,
      options
    );
  }
  else if (options.insertAfter) {
    await TabsMove.moveTabsAfter(
      movedTabs,
      options.insertAfter,
      options
    );
  }
  else {
    log('no move: just duplicate or import');
  }
  // Tabs can be removed while waiting, so we need to
  // refresh the array of tabs.
  movedTabs = movedTabs.map(tab => Tab.get(tab.id));
  movedTabs = movedTabs.filter(tab => !!tab);

  return movedTabs;
}

export async function openNewWindowFromTabs(tabs, options = {}) {
  if (tabs.length == 0)
    return [];

  log('openNewWindowFromTabs: ', tabs, options);
  const windowParams = {
    //active: true,  // not supported in Firefox...
    url: 'about:blank',
    incognito: tabs[0].incognito
  };
  if ('left' in options && options.left !== null)
    windowParams.left = options.left;
  if ('top' in options && options.top !== null)
    windowParams.top = options.top;
  let newWindow;
  const promsiedNewWindow = browser.windows.create(windowParams)
    .then(createdWindow => {
      newWindow = createdWindow;
      log('openNewWindowFromTabs: new window is ready, ', newWindow);
      UserOperationBlocker.blockIn(newWindow.id);
      return newWindow;
    })
    .catch(ApiTabs.createErrorHandler());
  tabs = tabs.filter(TabsStore.ensureLivingTab);
  const movedTabs = await moveTabs(tabs, Object.assign({}, options, {
    destinationPromisedNewWindow: promsiedNewWindow
  }));

  log('closing needless tabs');
  browser.windows.get(newWindow.id, { populate: true })
    .then(window => {
      log('moved tabs: ', movedTabs.map(dumpTab));
      const movedTabIds     = movedTabs.map(tab => tab.id);
      const allTabsInWindow = window.tabs.map(tab => TabIdFixer.fixTab(tab));
      const removeTabs      = allTabsInWindow
        .filter(tab => !movedTabIds.includes(tab.id))
        .map(tab => Tab.get(tab.id));
      log('removing tabs: ', removeTabs.map(dumpTab));
      TabsInternalOperation.removeTabs(removeTabs);
      UserOperationBlocker.unblockIn(newWindow.id);
    })
    .catch(ApiTabs.createErrorSuppressor());

  return movedTabs;
}


// set/get tree structure

export function getTreeStructureFromTabs(tabs, options = {}) {
  if (!tabs || !tabs.length)
    return [];

  /* this returns...
    [A]     => -1 (parent is not in this tree)
      [B]   => 0 (parent is 1st item in this tree)
      [C]   => 0 (parent is 1st item in this tree)
        [D] => 2 (parent is 2nd in this tree)
    [E]     => -1 (parent is not in this tree, and this creates another tree)
      [F]   => 0 (parent is 1st item in this another tree)
  */
  const tabIds = tabs.map(tab => tab.id);
  return cleanUpTreeStructureArray(
    tabs.map((tab, index) => {
      const parentId = tab.$TST.parentId;
      const indexInGivenTabs = parent ? tabIds.indexOf(parentId) : -1 ;
      return indexInGivenTabs >= index ? -1 : indexInGivenTabs ;
    }),
    -1
  ).map((parentIndex, index) => {
    const tab = tabs[index];
    const item = {
      id:        tab.$TST.uniqueId.id,
      parent:    parentIndex,
      collapsed: tab.$TST.subtreeCollapsed
    };
    if (options.full) {
      item.title  = tab.title;
      item.url    = tab.url;
      item.pinned = tab.pinned;
    }
    return item;
  });
}
function cleanUpTreeStructureArray(treeStructure, defaultParent) {
  let offset = 0;
  treeStructure = treeStructure
    .map((position, index) => {
      return (position == index) ? -1 : position ;
    })
    .map((position, index) => {
      if (position == -1) {
        offset = index;
        return position;
      }
      return position - offset;
    });

  /* The final step, this validates all of values.
     Smaller than -1 is invalid, so it becomes to -1. */
  treeStructure = treeStructure.map(index => {
    return index < -1 ? defaultParent : index ;
  });
  return treeStructure;
}

export async function applyTreeStructureToTabs(tabs, treeStructure, options = {}) {
  if (!tabs || !treeStructure)
    return;

  MetricsData.add('applyTreeStructureToTabs: start');

  log('applyTreeStructureToTabs: ', tabs.map(dumpTab), treeStructure, options);
  tabs = tabs.slice(0, treeStructure.length);
  treeStructure = treeStructure.slice(0, tabs.length);

  let expandStates = tabs.map(tab => !!tab);
  expandStates = expandStates.slice(0, tabs.length);
  while (expandStates.length < tabs.length)
    expandStates.push(-1);

  MetricsData.add('applyTreeStructureToTabs: preparation');

  let parentTab = null;
  let tabsInTree = [];
  const promises   = [];
  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    const tab = tabs[i];
    /*
    if (tab.$TST.collapsed)
      collapseExpandTabAndSubtree(tab, Object.assign({}, options, {
        collapsed: false,
        justNow: true
      }));
    */
    detachTab(tab, { justNow: true });

    const structureInfo = treeStructure[i];
    let parentIndexInTree = -1;
    if (typeof structureInfo == 'number') { // legacy format
      parentIndexInTree = structureInfo;
    }
    else {
      parentIndexInTree = structureInfo.parent;
      expandStates[i]   = !structureInfo.collapsed;
    }
    if (parentIndexInTree < 0) { // there is no parent, so this is a new parent!
      parentTab  = tab.id;
      tabsInTree = [tab];
    }

    let parent = null;
    if (parentIndexInTree > -1) {
      parent = Tab.get(parentTab);
      if (parent) {
        //log('existing tabs in tree: ', {
        //  size:   tabsInTree.length,
        //  parent: parentIndexInTree
        //});
        parent = parentIndexInTree < tabsInTree.length ? tabsInTree[parentIndexInTree] : parent ;
        tabsInTree.push(tab);
      }
    }
    if (parent) {
      parent.$TST.removeState(Constants.kTAB_STATE_SUBTREE_COLLAPSED); // prevent focus changing by "current tab attached to collapsed tree"
      promises.push(attachTabTo(tab, parent, Object.assign({}, options, {
        dontExpand: true,
        dontMove:   true,
        justNow:    true
      })));
    }
  }
  if (promises.length > 0)
    await Promise.all(promises);
  MetricsData.add('applyTreeStructureToTabs: attach/detach');

  log('expandStates: ', expandStates);
  for (let i = tabs.length-1; i > -1; i--) {
    const tab = tabs[i];
    const expanded = expandStates[i];
    collapseExpandSubtree(tab, Object.assign({}, options, {
      collapsed: expanded === undefined ? !tab.$TST.hasChild : !expanded ,
      justNow:   true,
      force:     true
    }));
  }
  MetricsData.add('applyTreeStructureToTabs: collapse/expand');
}



//===================================================================
// Take snapshot
//===================================================================

export function snapshotForActionDetection(targetTab) {
  const prevTab = targetTab.$TST.nearestNormalPrecedingTab;
  const nextTab = targetTab.$TST.nearestNormalFollowingTab;
  const tabs = Array.from(new Set([
    ...(prevTab && prevTab.$TST.ancestors || []),
    prevTab,
    targetTab,
    nextTab,
    targetTab.$TST.parent
  ]))
    .filter(TabsStore.ensureLivingTab)
    .sort((a, b) => a.index - b.index);
  return snapshotTree(targetTab, tabs);
}

function snapshotTree(targetTab, tabs) {
  const allTabs = tabs || Tab.getTabs(targetTab.windowId);

  const snapshotById = {};
  function snapshotChild(tab) {
    if (!TabsStore.ensureLivingTab(tab) || tab.pinned || tab.hidden)
      return null;
    return snapshotById[tab.id] = {
      id:            tab.id,
      url:           tab.url,
      cookieStoreId: tab.cookieStoreId,
      active:        tab.active,
      children:      tab.$TST.children.filter(child => !child.hidden).map(child => child.id),
      collapsed:     tab.$TST.subtreeCollapsed,
      pinned:        tab.pinned,
      level:         parseInt(tab.$TST.getAttribute(Constants.kLEVEL) || 0)
    };
  }
  const snapshotArray = allTabs.map(tab => snapshotChild(tab));
  for (const tab of allTabs) {
    const item = snapshotById[tab.id];
    if (!item)
      continue;
    const parent = tab.$TST.parent;
    item.parent = parent && parent.id;
    const next = tab.$TST.nearestNormalFollowingTab;
    item.next = next && next.id;
    const previous = tab.$TST.nearestNormalPrecedingTab;
    item.previous = previous && previous.id;
  }
  const activeTab = Tab.getActiveTab(targetTab.windowId);
  return {
    target:   snapshotById[targetTab.id],
    active:   activeTab && snapshotById[activeTab.id],
    tabs:     snapshotArray,
    tabsById: snapshotById
  };
}


SidebarConnection.onMessage.addListener(async (windowId, message) => {
  switch (message.type) {
    case Constants.kCOMMAND_SET_SUBTREE_COLLAPSED_STATE: {
      await Tab.waitUntilTracked(message.tabId);
      const tab = Tab.get(message.tabId);
      if (!tab)
        return;
      const params = {
        collapsed: message.collapsed,
        justNow:   message.justNow,
        broadcast: true,
        stack:     message.stack
      };
      if (message.manualOperation)
        manualCollapseExpandSubtree(tab, params);
      else
        collapseExpandSubtree(tab, params);
    }; break;

    case Constants.kCOMMAND_SET_SUBTREE_COLLAPSED_STATE_INTELLIGENTLY_FOR: {
      await Tab.waitUntilTracked(message.tabId);
      const tab = Tab.get(message.tabId);
      if (tab)
        collapseExpandTreesIntelligentlyFor(tab);
    }; break;

    case Constants.kCOMMAND_NEW_WINDOW_FROM_TABS: {
      log('new window requested: ', message);
      await Tab.waitUntilTracked(message.tabIds);
      const tabs = message.tabIds.map(id => TabsStore.tabs.get(id));
      if (!message.duplicate)
        await detachTabsFromTree(tabs);
      openNewWindowFromTabs(tabs, message);
    }; break;
  }
});
