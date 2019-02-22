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
} from './common.js';
import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as SidebarStatus from './sidebar-status.js';
import * as Tabs from './tabs.js';
import * as TabsContainer from './tabs-container.js';
import * as TabsInternalOperation from './tabs-internal-operation.js';
import * as TabsUpdate from './tabs-update.js';
import * as TabsMove from './tabs-move.js';
import * as TSTAPI from './tst-api.js';
import * as UserOperationBlocker from './user-operation-blocker.js';
import * as MetricsData from './metrics-data.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/tree', ...args);
}
function logCollapseExpand(...args) {
  internalLogger('sidebar/collapse-expand', ...args);
}


export const onAttached     = new EventListenerManager();
export const onDetached     = new EventListenerManager();
export const onLevelChanged = new EventListenerManager();
export const onSubtreeCollapsedStateChanging = new EventListenerManager();


// return moved (or not)
export async function attachTabTo(child, parent, options = {}) {
  parent = Tabs.ensureLivingTab(parent);
  child = Tabs.ensureLivingTab(child);
  if (!parent || !child) {
    log('missing information: ', dumpTab(parent), dumpTab(child));
    return false;
  }

  log('attachTabTo: ', {
    child:            dumpTab(child),
    parent:           dumpTab(parent),
    children:         parent.getAttribute(Constants.kCHILDREN),
    insertAt:         options.insertAt,
    insertBefore:     dumpTab(options.insertBefore),
    insertAfter:      dumpTab(options.insertAfter),
    dontMove:         options.dontMove,
    dontUpdateIndent: options.dontUpdateIndent,
    forceExpand:      options.forceExpand,
    dontExpand:       options.dontExpand,
    delayedMove:      options.delayedMove,
    inRemote:         options.inRemote,
    broadcast:        options.broadcast,
    broadcasted:      options.broadcasted,
    stack:            `${new Error().stack}\n${options.stack || ''}`
  });

  if (Tabs.isPinned(parent) || Tabs.isPinned(child)) {
    log('=> pinned tabs cannot be attached');
    return false;
  }
  if (parent.apiTab.windowId != child.apiTab.windowId) {
    log('=> could not attach tab to a parent in different window');
    return false;
  }
  const ancestors = [parent].concat(Tabs.getAncestorTabs(child));
  if (ancestors.includes(child)) {
    log('=> canceled for recursive request');
    return false;
  }

  if (options.dontMove) {
    options.insertBefore = Tabs.getNextTab(child);
    if (!options.insertBefore)
      options.insertAfter = Tabs.getPreviousTab(child);
  }

  if (!options.insertBefore && !options.insertAfter) {
    const refTabs = getReferenceTabsForNewChild(child, parent, options);
    options.insertBefore = refTabs.insertBefore;
    options.insertAfter  = refTabs.insertAfter;
  }
  options.insertAfter = options.insertAfter || parent;
  log(`reference tabs for ${child.id}: `, {
    next: dumpTab(options.insertBefore),
    prev: dumpTab(options.insertAfter)
  });

  await Tabs.waitUntilAllTabsAreCreated(child.apiTab.windowId);

  parent = Tabs.ensureLivingTab(parent);
  child = Tabs.ensureLivingTab(child);
  if (!parent || !child) {
    log('attachTabTo: parent or child is closed before attaching.');
    return false;
  }

  const newIndex = Tabs.calculateNewTabIndex({
    insertBefore: options.insertBefore,
    insertAfter:  options.insertAfter,
    ignoreTabs:   [child]
  });
  const moved = newIndex != child.apiTab.index;
  log(`newIndex for ${child.id}: `, newIndex);

  const newlyAttached = (
    !parent.childTabs.includes(child) ||
    child.parentTab != parent
  );
  if (!newlyAttached)
    log('=> already attached');

  let childIds;
  {
    const expectedAllTabs = Tabs.getAllTabs(child).filter(tab => tab != child);
    log('expectedAllTabs: ', expectedAllTabs.map(dumpTab));
    if (newIndex >= expectedAllTabs.length)
      expectedAllTabs.push(child);
    else
      expectedAllTabs.splice(newIndex, 0, child);
    log(' => ', expectedAllTabs.map(dumpTab));

    const children = expectedAllTabs.filter(tab => {
      return (tab == child ||
                tab.parentTab == parent);
    });
    parent.childTabs = children;
    childIds = children.map(tab => tab.id);
  }
  log('new children: ', childIds);

  if (newlyAttached) {
    detachTab(child, Object.assign({}, options, {
      // Don't broadcast this detach operation, because this "attachTabTo" can be
      // broadcasted. If we broadcast this detach operation, the tab is detached
      // twice in the sidebar!
      broadcast: false
    }));

    log('attachTabTo: setting child information: ', dumpTab(parent));
    Tabs.setAttribute(parent, Constants.kCHILDREN, `|${childIds.join('|')}|`);

    log('attachTabTo: setting parent information: ', dumpTab(child));
    Tabs.setAttribute(child, Constants.kPARENT, parent.id);
    child.parentTab = parent;
    child.ancestorTabs = Tabs.getAncestorTabs(child, { force: true });

    const parentLevel = parseInt(parent.getAttribute(Constants.kLEVEL) || 0);
    if (!options.dontUpdateIndent) {
      updateTabsIndent(child, parentLevel + 1);
    }
    //updateTabAsParent(parent);
    //if (shouldInheritIndent && !options.dontUpdateIndent)
    //  this.inheritTabIndent(child, parent);

    //promoteTooDeepLevelTabs(child);

    TabsUpdate.updateParentTab(parent);
  }

  onAttached.dispatch(child, Object.assign({}, options, {
    parent: parent,
    newIndex, newlyAttached
  }));

  if (options.inRemote || options.broadcast) {
    browser.runtime.sendMessage({
      type:             Constants.kCOMMAND_ATTACH_TAB_TO,
      windowId:         child.apiTab.windowId,
      child:            child.id,
      parent:           parent.id,
      insertAt:         options.insertAt,
      insertBefore:     options.insertBefore && options.insertBefore.id,
      insertAfter:      options.insertAfter && options.insertAfter.id,
      dontMove:         !!options.dontMove,
      dontUpdateIndent: !!options.dontUpdateIndent,
      forceExpand:      !!options.forceExpand,
      dontExpand:       !!options.dontExpand,
      justNow:          !!options.justNow,
      broadcasted:      !!options.broadcast,
      stack:            new Error().stack
    });
  }

  return moved;
}

export function getReferenceTabsForNewChild(child, parent, options = {}) {
  let insertAt = options.insertAt;
  if (typeof insertAt !== 'number')
    insertAt = configs.insertNewChildAt;
  let descendants = Tabs.getDescendantTabs(parent);
  if (options.ignoreTabs)
    descendants = descendants.filter(tab => !options.ignoreTabs.includes(tab));
  let insertBefore, insertAfter;
  if (descendants.length > 0) {
    const firstChild     = descendants[0];
    const lastDescendant = descendants[descendants.length-1];
    switch (insertAt) {
      case Constants.kINSERT_END:
      default:
        insertAfter = lastDescendant;
        break;
      case Constants.kINSERT_FIRST:
        insertBefore = firstChild;
        break;
      case Constants.kINSERT_NEAREST: {
        let allTabs = Tabs.getAllTabs(parent);
        if (options.ignoreTabs)
          allTabs = allTabs.filter(tab => !options.ignoreTabs.includes(tab));
        const index = allTabs.indexOf(child);
        if (index < allTabs.indexOf(firstChild)) {
          insertBefore = firstChild;
          insertAfter  = parent;
        }
        else if (index > allTabs.indexOf(lastDescendant)) {
          insertAfter  = lastDescendant;
        }
        else { // inside the tree
          let children = Tabs.getChildTabs(parent);
          if (options.ignoreTabs)
            children = children.filter(tab => !options.ignoreTabs.includes(tab));
          for (const child of children) {
            if (index > allTabs.indexOf(child))
              continue;
            insertBefore = child;
            break;
          }
          if (!insertBefore)
            insertAfter = lastDescendant;
        }
      }; break;
    }
  }
  else {
    insertAfter = parent;
  }
  if (insertBefore == child)
    insertBefore = Tabs.getNextTab(insertBefore);
  if (insertAfter == child)
    insertAfter = Tabs.getPreviousTab(insertAfter);
  // disallow to place tab in invalid position
  if (insertBefore) {
    if (insertBefore.apiTab.index <= parent.apiTab.index) {
      insertBefore = null;
    }
    //TODO: we need to reject more cases...
  }
  if (insertAfter) {
    const allTabsInTree = [parent].concat(descendants);
    const lastMember    = allTabsInTree[allTabsInTree.length - 1];
    if (insertAfter.apiTab.index >= lastMember.apiTab.index) {
      insertAfter = lastMember;
    }
    //TODO: we need to reject more cases...
  }
  return { insertBefore, insertAfter };
}

export function detachTab(child, options = {}) {
  log('detachTab: ', dumpTab(child), options,
      { stack: `${new Error().stack}\n${options.stack || ''}` });
  // the "parent" option is used for removing child.
  const parent = Tabs.ensureLivingTab(options.parent) || Tabs.getParentTab(child);

  if (!parent)
    log(` => parent(${child.getAttribute(Constants.kPARENT)}) is already removed, or orphan tab`);

  if (parent) {
    parent.childTabs = parent.childTabs.filter(tab => tab != child);
    const childIds = parent.childTabs.map(tab => tab.id);
    if (childIds.length == 0) {
      Tabs.removeAttribute(parent, Constants.kCHILDREN);
      log(' => no more child');
    }
    else {
      Tabs.setAttribute(parent, Constants.kCHILDREN, `|${childIds.join('|')}|`);
      log(' => rest children: ', childIds);
    }
    TabsUpdate.updateParentTab(parent);
  }
  Tabs.removeAttribute(child, Constants.kPARENT);
  child.parentTab = null;
  child.ancestorTabs = [];
  log('detachTab: parent information cleared: ', dumpTab(child));

  updateTabsIndent(child);

  onDetached.dispatch(child, {
    oldParentTab: parent
  });

  if (options.inRemote || options.broadcast) {
    browser.runtime.sendMessage({
      type:        Constants.kCOMMAND_DETACH_TAB,
      windowId:    child.apiTab.windowId,
      tab:         child.id,
      broadcasted: !!options.broadcast,
      stack:       new Error().stack
    });
  }
}

export async function detachTabsFromTree(tabs, options = {}) {
  if (!Array.isArray(tabs))
    tabs = [tabs];
  tabs = Array.from(tabs).reverse();
  const promisedAttach = [];
  for (const tab of tabs) {
    const children = Tabs.getChildTabs(tab);
    const parent   = Tabs.getParentTab(tab);
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
  log('detachAllChildren: ', dumpTab(tab));
  // the "children" option is used for removing tab.
  const children = options.children ? options.children.map(Tabs.ensureLivingTab) : Tabs.getChildTabs(tab);
  if (!children.length)
    return;
  log(' => children to be detached: ', children.map(dumpTab));

  if (!('behavior' in options))
    options.behavior = Constants.kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN;
  if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    options.behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  options.dontUpdateInsertionPositionInfo = true;

  // the "parent" option is used for removing tab.
  const parent = Tabs.ensureLivingTab(options.parent) || Tabs.getParentTab(tab);
  if (Tabs.isGroupTab(tab) &&
      Tabs.getTabs(tab).filter(tab => tab.removing).length == children.length) {
    options.behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
    options.dontUpdateIndent = false;
  }

  let nextTab = null;
  if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN &&
      !configs.moveTabsToBottomWhenDetachedFromClosedParent) {
    nextTab = Tabs.getNextSiblingTab(Tabs.getRootTab(tab));
  }

  if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB) {
    // open new group tab and replace the detaching tab with it.
    options.behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
  }

  if (options.behavior != Constants.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN)
    collapseExpandSubtree(tab, Object.assign({}, options, {
      collapsed: false
    }));

  for (let i = 0, maxi = children.length; i < maxi; i++) {
    const child = children[i];
    if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN) {
      detachTab(child, options);
      moveTabSubtreeBefore(child, nextTab, options);
    }
    else if (options.behavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD) {
      detachTab(child, options);
      if (i == 0) {
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
  }
}

// returns moved (or not)
export async function behaveAutoAttachedTab(tab, options = {}) {
  const baseTab = options.baseTab || Tabs.getActiveTab(Tabs.getWindow() || tab);
  log('behaveAutoAttachedTab ', dumpTab(tab), dumpTab(baseTab), options);
  if (Tabs.isPinned(baseTab)) {
    if (!Tabs.isPinned(tab))
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
        inRemote:  options.inRemote,
        broadcast: options.broadcast
      });
      if (Tabs.getNextTab(tab))
        return TabsMove.moveTabAfter(tab, Tabs.getLastTab(), {
          delayedMove: true,
          inRemote: options.inRemote
        });
      return false;

    case Constants.kNEWTAB_OPEN_AS_CHILD:
      log(' => kNEWTAB_OPEN_AS_CHILD');
      return attachTabTo(tab, baseTab, {
        dontMove:    options.dontMove || configs.insertNewChildAt == Constants.kINSERT_NO_CONTROL,
        forceExpand: true,
        delayedMove: true,
        inRemote:    options.inRemote,
        broadcast:   options.broadcast
      });

    case Constants.kNEWTAB_OPEN_AS_SIBLING: {
      log(' => kNEWTAB_OPEN_AS_SIBLING');
      const parent = Tabs.getParentTab(baseTab);
      if (parent) {
        await attachTabTo(tab, parent, {
          delayedMove: true,
          inRemote:  options.inRemote,
          broadcast: options.broadcast
        });
        return true;
      }
      else {
        detachTab(tab, {
          inRemote:  options.inRemote,
          broadcast: options.broadcast
        });
        return TabsMove.moveTabAfter(tab, Tabs.getLastTab(), {
          delayedMove: true,
          inRemote: options.inRemote
        });
      }
    };

    case Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING: {
      log(' => kNEWTAB_OPEN_AS_NEXT_SIBLING');
      let nextSibling = Tabs.getNextSiblingTab(baseTab);
      if (nextSibling == tab)
        nextSibling = null;
      const parent = Tabs.getParentTab(baseTab);
      if (parent) {
        return attachTabTo(tab, parent, {
          insertBefore: nextSibling,
          insertAfter:  Tabs.getLastDescendantTab(baseTab) || baseTab,
          delayedMove:  true,
          inRemote:     options.inRemote,
          broadcast:    options.broadcast
        });
      }
      else {
        detachTab(tab, {
          inRemote:  options.inRemote,
          broadcast: options.broadcast
        });
        if (nextSibling)
          return TabsMove.moveTabBefore(tab, nextSibling, {
            delayedMove: true,
            inRemote:  options.inRemote,
            broadcast: options.broadcast
          });
        else
          return TabsMove.moveTabAfter(tab, Tabs.getLastDescendantTab(baseTab), {
            delayedMove: true,
            inRemote:  options.inRemote,
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
    level = Tabs.getAncestorTabs(tabs[0]).length;

  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    const item = tabs[i];
    if (!item || Tabs.isPinned(item))
      continue;

    onLevelChanged.dispatch(item);
    Tabs.setAttribute(item, Constants.kLEVEL, level);
    updateTabsIndent(Tabs.getChildTabs(item), level + 1);
  }
}


// collapse/expand tabs

export function shouldTabAutoExpanded(tab) {
  return Tabs.hasChildTabs(tab) && Tabs.isSubtreeCollapsed(tab);
}

export async function collapseExpandSubtree(tab, params = {}) {
  params.collapsed = !!params.collapsed;
  if (!tab)
    return;
  const remoteParams = {
    type:            Constants.kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE,
    windowId:        parseInt(tab.parentNode.dataset.windowId),
    tab:             tab.id,
    collapsed:       params.collapsed,
    manualOperation: !!params.manualOperation,
    justNow:         !!params.justNow,
    broadcasted:     !!params.broadcast,
    stack:           new Error().stack
  };
  if (params.inRemote) {
    await browser.runtime.sendMessage(remoteParams);
    return;
  }
  if (!Tabs.ensureLivingTab(tab)) // it was removed while waiting
    return;
  params.stack = `${new Error().stack}\n${params.stack || ''}`;
  logCollapseExpand('collapseExpandSubtree: ', dumpTab(tab), Tabs.isSubtreeCollapsed(tab), params);
  await Promise.all([
    collapseExpandSubtreeInternal(tab, params),
    params.broadcast && browser.runtime.sendMessage(remoteParams)
  ]);
}
function collapseExpandSubtreeInternal(tab, params = {}) {
  if (!params.force &&
      Tabs.isSubtreeCollapsed(tab) == params.collapsed)
    return;

  if (params.collapsed) {
    Tabs.addState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
    Tabs.removeState(tab, Constants.kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
  }
  else {
    Tabs.removeState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  }
  //setTabValue(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED, params.collapsed);

  const childTabs = Tabs.getChildTabs(tab);
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
}

export function manualCollapseExpandSubtree(tab, params = {}) {
  params.manualOperation = true;
  collapseExpandSubtree(tab, params);
  if (!params.collapsed) {
    Tabs.addState(tab, Constants.kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
    //setTabValue(tab, Constants.kTAB_STATE_SUBTREE_EXPANDED_MANUALLY, true);
  }
}

export function collapseExpandTabAndSubtree(tab, params = {}) {
  if (!tab)
    return;

  const parent = Tabs.getParentTab(tab);
  if (!parent)
    return;

  collapseExpandTab(tab, params);

  //const data = {
  //  collapsed : params.collapsed
  //};
  ///* PUBLIC API */
  //fireCustomEvent(Constants.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, tab, true, false, data);

  if (params.collapsed && Tabs.isActive(tab)) {
    const newSelection = Tabs.getVisibleAncestorOrSelf(tab);
    logCollapseExpand('current tab is going to be collapsed, switch to ', dumpTab(newSelection));
    TabsInternalOperation.activateTab(newSelection, { silently: true });
  }

  if (!Tabs.isSubtreeCollapsed(tab)) {
    const children = Tabs.getChildTabs(tab);
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
  if (Tabs.isPinned(tab) && params.collapsed) {
    log('CAUTION: a pinned tab is going to be collapsed, but canceled.',
        dumpTab(tab), { stack: new Error().stack });
    params.collapsed = false;
  }

  // When an asynchronous "expand" operation is processed after a
  // synchronous "collapse" operation, it can produce an expanded
  // child tab under "subtree-collapsed" parent. So this is a failsafe.
  if (!params.collapsed &&
      Tabs.getAncestorTabs(tab).some(ancestor => Tabs.isSubtreeCollapsed(ancestor)))
    return;

  const stack = `${new Error().stack}\n${params.stack || ''}`;
  logCollapseExpand(`collapseExpandTab ${tab.id} `, params, { stack })
  const last = params.last &&
                 (!Tabs.hasChildTabs(tab) || Tabs.isSubtreeCollapsed(tab));
  const collapseExpandInfo = Object.assign({}, params, {
    anchor: last && params.anchor,
    last:   last
  });
  Tabs.onCollapsedStateChanging.dispatch(tab, collapseExpandInfo);

  if (params.collapsed) {
    Tabs.addState(tab, Constants.kTAB_STATE_COLLAPSED);
  }
  else {
    Tabs.removeState(tab, Constants.kTAB_STATE_COLLAPSED);
  }

  Tabs.onCollapsedStateChanged.dispatch(tab, collapseExpandInfo);

  if (params.broadcast && !params.broadcasted) {
    browser.runtime.sendMessage({
      type:      Constants.kCOMMAND_CHANGE_TAB_COLLAPSED_STATE,
      windowId:  tab.apiTab.windowId,
      tab:       tab.id,
      justNow:   params.justNow,
      collapsed: params.collapsed,
      stack:     stack,
      byAncestor: Tabs.getAncestorTabs(tab).some(Tabs.isSubtreeCollapsed) == params.collapsed
    });
  }
}

export function collapseExpandTreesIntelligentlyFor(tab, options = {}) {
  if (!tab)
    return;

  logCollapseExpand('collapseExpandTreesIntelligentlyFor');
  const container = Tabs.getTabsContainer(tab);
  if (container.doingIntelligentlyCollapseExpandCount > 0) {
    logCollapseExpand('=> done by others');
    return;
  }
  container.doingIntelligentlyCollapseExpandCount++;

  const expandedAncestors = Tabs.getAncestorTabs(tab).map(ancestor => ancestor.id);
  const collapseTabs = Tabs.queryAll({
    windowId:   container.windowId,
    living:     true,
    hidden:     false,
    '!id':      expandedAncestors,
    states:     [
      Constants.kTAB_STATE_COLLAPSED,         false,
      Constants.kTAB_STATE_SUBTREE_COLLAPSED, false
    ],
    attributes: [Constants.kCHILDREN, /./],
    ordered:    true,
    element:    true
  });
  logCollapseExpand(`${collapseTabs.length} tabs can be collapsed`);
  for (const collapseTab of collapseTabs) {
    let dontCollapse = false;
    const parentTab = Tabs.getParentTab(collapseTab);
    if (parentTab) {
      dontCollapse = true;
      if (!Tabs.isSubtreeCollapsed(parentTab)) {
        for (const ancestor of Tabs.getAncestorTabs(collapseTab)) {
          if (!expandedAncestors.includes(ancestor.id))
            continue;
          dontCollapse = false;
          break;
        }
      }
    }
    logCollapseExpand(`${dumpTab(collapseTab)}: dontCollapse = ${dontCollapse}`);

    const manuallyExpanded = Tabs.hasState(collapseTab, Constants.kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
    if (!dontCollapse && !manuallyExpanded)
      collapseExpandSubtree(collapseTab, Object.assign({}, options, {
        collapsed: true
      }));
  }

  collapseExpandSubtree(tab, Object.assign({}, options, {
    collapsed: false
  }));
  container.doingIntelligentlyCollapseExpandCount--;
}

export async function fixupSubtreeCollapsedState(tab, options = {}) {
  let fixed = false;
  if (!Tabs.hasChildTabs(tab))
    return fixed;
  const firstChild = Tabs.getFirstChildTab(tab);
  const childrenCollapsed = Tabs.isCollapsed(firstChild);
  const collapsedStateMismatched = Tabs.isSubtreeCollapsed(tab) != childrenCollapsed;
  const nextIsFirstChild = Tabs.getNextTab(tab) == firstChild;
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

/*
These functions are not used on Firefox 65 and later. We should remove
them after Firefox 64 and older versions are completely outdated.

 * By https://bugzilla.mozilla.org/show_bug.cgi?id=1366290 when the
   current tab is closed, Firefox notifies tabs.onTabRemoved at first
   and tabs.onActivated at later.
 * Basically the next (right) tab will be active when the current tab
   is closed, except the closed tab was the last tab.
   * If the closed current tab was the last tab, then the previous tab
     is active.
 * However, if the tab has "owner", it will be active instead of the
   right tab if `browser.tabs.selectOwnerOnClose` == `true`.
   * The owner tab must be one of preceding tabs, because Firefox never
     open tab leftside (by default).
     So, if the next (right) tab is active, it definitely caused by
     the closing of the current tab - except "switch to tab" command
     from the location bar.
     https://bugzilla.mozilla.org/show_bug.cgi?id=1405262
     https://github.com/piroor/treestyletab/issues/1409

So, if I ignore the bug 1405262 / issue #1409 case, "the next (right)
tab is active after the current (active) tab is closed" means that the
focus move is unintentional and TST can override it.
*/
export function tryMoveFocusFromClosingActiveTab(tab, options = {}) {
  if (configs.successorTabControlLevel != Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE)
    return;
  log('tryMoveFocusFromClosingActiveTab', dumpTab(tab), options);
  if (!options.wasActive && !Tabs.isActive(tab)) {
    log(' => not active tab');
    return;
  }
  tab.parentNode.focusRedirectedForClosingActiveTab = tryMoveFocusFromClosingActiveTabOnFocusRedirected(tab, options);
}
async function tryMoveFocusFromClosingActiveTabOnFocusRedirected(tab, options = {}) {
  if (configs.successorTabControlLevel != Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE)
    return false;
  log('tryMoveFocusFromClosingActiveTabOnFocusRedirected ', dumpTab(tab), options);

  // The tab can be closed while we waiting.
  // Thus we need to get tabs related to tab at first.
  const params      = getTryMoveFocusFromClosingActiveTabNowParams(tab, options.params);
  const nextTab     = Tabs.getNextTab(tab);
  const previousTab = Tabs.getPreviousTab(tab);

  await tab.closedWhileActive;
  log('tryMoveFocusFromClosingActiveTabOnFocusRedirected: tabs.onActivated is fired');

  const autoActiveTab = Tabs.getActiveTab(tab.apiTab.windowId);
  if (autoActiveTab != nextTab &&
      (autoActiveTab != previousTab ||
       (Tabs.getNextTab(autoActiveTab) &&
        Tabs.getNextTab(autoActiveTab) != tab))) {
    // possibly it is active by browser.tabs.selectOwnerOnClose
    log('=> the tab seems active intentionally: ', {
      autoActive:       dumpTab(autoActiveTab),
      nextOfAutoActive: dumpTab(Tabs.getNextTab(autoActiveTab)),
      prev:              dumpTab(previousTab),
      next:              dumpTab(nextTab)
    });
    return false;
  }
  return tryMoveFocusFromClosingActiveTabNow(tab, { params });
}
function getTryMoveFocusFromClosingActiveTabNowParams(tab, overrideParams) {
  const parentTab = Tabs.getParentTab(tab);
  const params = {
    active:                    Tabs.isActive(tab),
    pinned:                    Tabs.isPinned(tab),
    parentTab,
    firstChildTab:             Tabs.getFirstChildTab(tab),
    firstChildTabOfParent:     Tabs.getFirstChildTab(parentTab),
    lastChildTabOfParent:      Tabs.getLastChildTab(parentTab),
    previousSiblingTab:        Tabs.getPreviousSiblingTab(tab),
    preDetectedNextActiveTab: Tabs.getNextActiveTab(tab),
    serializedTab:             TSTAPI.serializeTab(tab),
    closeParentBehavior:       getCloseParentBehaviorForTab(tab, { parentTab })
  };
  if (overrideParams)
    return Object.assign({}, params, overrideParams);
  return params;
}

export async function tryMoveFocusFromClosingActiveTabNow(tab, options = {}) {
  if (configs.successorTabControlLevel != Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE)
    return false;
  const params = options.params || getTryMoveFocusFromClosingActiveTabNowParams(tab);
  if (options.ignoredTabs)
    params.ignoredTabs = options.ignoredTabs;
  const {
    active,
    nextTabUrl, nextIsDiscarded,
    parentTab, firstChildTab, firstChildTabOfParent, lastChildTabOfParent,
    previousSiblingTab, preDetectedNextActiveTab,
    serializedTab, closeParentBehavior
  } = params;
  let {
    nextTab,
    ignoredTabs
  } = params;

  log('tryMoveFocusFromClosingActiveTabNow ', params);
  if (!active) {
    log(' => not active tab');
    return false;
  }

  const results = await TSTAPI.sendMessage({
    type:   TSTAPI.kNOTIFY_TRY_MOVE_FOCUS_FROM_CLOSING_CURRENT_TAB,
    tab:    serializedTab,
    window: tab.apiTab.windowId,
    windowId: tab.apiTab.windowId
  });
  if (results.some(result => result.result)) // canceled
    return false;

  let nextActiveTab = null;
  if (firstChildTab &&
      (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN ||
       closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD))
    nextActiveTab = firstChildTab;
  log('focus to first child?: ', !!nextActiveTab);

  ignoredTabs = ignoredTabs || [];
  if (parentTab) {
    log(`tab=${dumpTab(tab)}, parent=${dumpTab(parentTab)}, nextActive=${dumpTab(nextActiveTab)}, lastChildTabOfParent=${dumpTab(lastChildTabOfParent)}, previousSiblingTab=${dumpTab(previousSiblingTab)}`);
    if (!nextActiveTab && tab == lastChildTabOfParent) {
      if (tab == firstChildTabOfParent) { // this is the really last child
        nextActiveTab = parentTab;
        log('focus to parent?: ', !!nextActiveTab);
      }
      else {
        nextActiveTab = previousSiblingTab;
        log('focus to previous sibling?: ', !!nextActiveTab);
      }
    }
    if (nextActiveTab && ignoredTabs.includes(nextActiveTab))
      nextActiveTab = Tabs.getNextActiveTab(parentTab, { ignoredTabs });
  }
  else if (!nextActiveTab) {
    nextActiveTab = preDetectedNextActiveTab;
    log('focus to Tabs.getNextActiveTab()?: ', !!nextActiveTab);
  }
  if (nextActiveTab && ignoredTabs.includes(nextActiveTab)) {
    nextActiveTab = Tabs.getNextActiveTab(nextActiveTab, { ignoredTabs });
    log('focus to Tabs.getNextActiveTab() again?: ', !!nextActiveTab);
  }

  if (!nextActiveTab ||
      Tabs.isHidden(nextActiveTab) ||
      Tabs.isActive(nextActiveTab))
    return false;

  nextTab = Tabs.getTabById(nextTab);
  if (Tabs.isActive(nextTab) &&
      nextIsDiscarded) {
    log('reserve to discard accidentally restored tab ', nextTab.apiTab.id, nextTabUrl || nextTab.apiTab.url);
    nextTab.dataset.discardURLAfterCompletelyLoaded = nextTabUrl || nextTab.apiTab.url;
  }

  log('focus to: ', dumpTab(nextActiveTab));
  await TabsInternalOperation.activateTab(nextActiveTab);
  return true;
}

export function getCloseParentBehaviorForTab(tab, options = {}) {
  if (!options.asIndividualTab &&
      Tabs.isSubtreeCollapsed(tab) &&
      !options.keepChildren)
    return Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN;

  let behavior = configs.closeParentBehavior;
  const parentTab = options.parent || Tabs.getParentTab(tab);

  if (options.keepChildren &&
      behavior != Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
      behavior != Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN)
    behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  if (!parentTab &&
      behavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN &&
      configs.promoteFirstChildForClosedRoot)
    behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  // Promote all children to upper level, if this is the last child of the parent.
  // This is similar to "taking by representation".
  if (behavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
      parentTab &&
      Tabs.getChildTabs(parentTab).length == 1 &&
      configs.promoteAllChildrenWhenClosedParentIsLastChild)
    behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;

  return behavior;
}

export function getCloseParentBehaviorForTabWithSidebarOpenState(tab, removeInfo = {}) {
  return getCloseParentBehaviorForTab(tab, {
    keepChildren: (
      removeInfo.keepChildren ||
      !shouldApplyTreeBehavior({
        windowId:            removeInfo.windowId || tab.apiTab.windowId,
        byInternalOperation: removeInfo.byInternalOperation
      })
    )
  });
}

export function shouldApplyTreeBehavior(params = {}) {
  switch (configs.parentTabBehaviorForChanges) {
    case Constants.kPARENT_TAB_BEHAVIOR_ALWAYS:
      return true;
    case Constants.kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE:
      return SidebarStatus.isWatchingOpenState() ? (params.windowId && SidebarStatus.isOpen(params.windowId)) : true ;
    default:
    case Constants.kPARENT_TAB_BEHAVIOR_ONLY_ON_SIDEBAR:
      return !!params.byInternalOperation;
  }
}

export function getClosingTabsFromParent(tab) {
  const closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(tab, {
    windowId: tab.apiTab.windowId
  });
  if (closeParentBehavior != Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    return [tab];
  return [tab].concat(Tabs.getDescendantTabs(tab));
}


export async function moveTabSubtreeBefore(tab, nextTab, options = {}) {
  if (!tab)
    return;
  if (Tabs.isAllTabsPlacedBefore([tab].concat(Tabs.getDescendantTabs(tab)), nextTab)) {
    log('moveTabSubtreeBefore:no need to move');
    return;
  }

  log('moveTabSubtreeBefore: ', dumpTab(tab), dumpTab(nextTab));
  const container = tab.parentNode;
  container.subTreeMovingCount++;
  try {
    await TabsMove.moveTabInternallyBefore(tab, nextTab, options);
    if (!Tabs.ensureLivingTab(tab)) // it is removed while waiting
      throw new Error('the tab was removed before moving of descendants');
    await followDescendantsToMovedRoot(tab, options);
  }
  catch(e) {
    log(`failed to move subtree: ${String(e)}`);
  }
  await wait(0);
  if (!container.parentNode) // it was removed while waiting
    return;
  container.subTreeMovingCount--;
}

export async function moveTabSubtreeAfter(tab, previousTab, options = {}) {
  if (!tab)
    return;
  if (Tabs.isAllTabsPlacedAfter([tab].concat(Tabs.getDescendantTabs(tab)), previousTab)) {
    log('moveTabSubtreeAfter:no need to move');
    return;
  }

  log('moveTabSubtreeAfter: ', dumpTab(tab), dumpTab(previousTab));
  const container = tab.parentNode;
  container.subTreeMovingCount++;
  try {
    await TabsMove.moveTabInternallyAfter(tab, previousTab, options);
    if (!Tabs.ensureLivingTab(tab)) // it is removed while waiting
      throw new Error('the tab was removed before moving of descendants');
    await followDescendantsToMovedRoot(tab, options);
  }
  catch(e) {
    log(`failed to move subtree: ${String(e)}`);
  }
  await wait(0);
  if (!container.parentNode) // it was removed while waiting
    return;
  container.subTreeMovingCount--;
}

export async function followDescendantsToMovedRoot(tab, options = {}) {
  if (!Tabs.hasChildTabs(tab))
    return;

  log('followDescendantsToMovedRoot: ', dumpTab(tab));
  const container = tab.parentNode;
  container.subTreeChildrenMovingCount++;
  container.subTreeMovingCount++;
  await TabsMove.moveTabsAfter(Tabs.getDescendantTabs(tab), tab, options);
  container.subTreeChildrenMovingCount--;
  container.subTreeMovingCount--;
}

export async function moveTabs(tabs, options = {}) {
  tabs = tabs.filter(Tabs.ensureLivingTab);
  if (tabs.length == 0)
    return [];

  log('moveTabs: ', tabs.map(dumpTab), options);

  const windowId = parseInt(tabs[0].parentNode.dataset.windowId || Tabs.getWindow());

  let newWindow = options.destinationPromisedNewWindow;

  let destinationWindowId = options.destinationWindowId;
  if (!destinationWindowId && !newWindow)
    destinationWindowId = Tabs.getWindow();

  const isAcrossWindows = windowId != destinationWindowId || !!newWindow;

  options.insertAfter = options.insertAfter || Tabs.getLastTab(destinationWindowId);

  if (options.inRemote) {
    const response = await browser.runtime.sendMessage(Object.assign({}, options, {
      type:                Constants.kCOMMAND_MOVE_TABS,
      windowId:            windowId,
      tabs:                tabs.map(tab => tab.id),
      insertBefore:        options.insertBefore && options.insertBefore.id,
      insertAfter:         options.insertAfter && options.insertAfter.id,
      duplicate:           !!options.duplicate,
      destinationWindowId: destinationWindowId,
      inRemote:            false
    }));
    return (response.movedTabs || []).map(Tabs.getTabById).filter(tab => !!tab);
  }

  let movedTabs = tabs;
  const structure = getTreeStructureFromTabs(tabs);
  log('original tree structure: ', structure);

  if (isAcrossWindows || options.duplicate) {
    UserOperationBlocker.blockIn(windowId, { throbber: true });
    try {
      let container;
      const prepareContainer = () => {
        container = Tabs.getTabsContainer(destinationWindowId);
        if (!container) {
          container = TabsContainer.buildFor(destinationWindowId);
          Tabs.allTabsContainer.appendChild(container);
        }
        if (isAcrossWindows) {
          container.toBeOpenedTabsWithPositions += tabs.length;
          container.toBeOpenedOrphanTabs += tabs.length;
          for (const tab of tabs) {
            container.toBeAttachedTabs.add(tab.apiTab.id);
          }
        }
      };
      if (newWindow) {
        newWindow = newWindow.then(window => {
          log('moveTabs: destination window is ready, ', window);
          destinationWindowId = window.id;
          prepareContainer();
          return window;
        });
      }
      else {
        prepareContainer();
      }

      let apiTabs   = tabs.map(tab => tab.apiTab);
      let apiTabIds = tabs.map(tab => tab.apiTab.id);
      await Promise.all([
        newWindow,
        (async () => {
          const sourceContainer = tabs[0].parentNode;
          if (options.duplicate) {
            sourceContainer.toBeOpenedTabsWithPositions += tabs.length;
            sourceContainer.toBeOpenedOrphanTabs += tabs.length;
            sourceContainer.duplicatingTabsCount += tabs.length;
          }
          if (isAcrossWindows) {
            for (const tab of tabs) {
              sourceContainer.toBeDetachedTabs.add(tab.apiTab.id);
            }
          }

          log('preparing tabs');
          if (options.duplicate) {
            const startTime = Date.now();
            // This promise will be resolved with very large delay.
            // (See also https://bugzilla.mozilla.org/show_bug.cgi?id=1394376 )
            const promisedDuplicatedTabs = Promise.all(apiTabIds.map(async (id, _aIndex) => {
              try {
                return await browser.tabs.duplicate(id);
              }
              catch(e) {
                ApiTabs.handleMissingTabError(e);
                return null;
              }
            })).then(aPITabs => {
              log(`ids from API responses are resolved in ${Date.now() - startTime}msec: `, aPITabs.map(aPITab => aPITab.id));
              return aPITabs;
            });
            if (configs.acceleratedTabDuplication) {
              // So, I collect duplicating tabs in different way.
              // This promise will be resolved when they actually
              // appear in the tab bar. This hack should be removed
              // after the bug 1394376 is fixed.
              const promisedDuplicatingTabs = (async () => {
                while (true) {
                  await wait(100);
                  const tabs = Tabs.getDuplicatingTabs(windowId);
                  if (tabs.length < apiTabIds.length)
                    continue; // not opened yet
                  const tabIds = tabs.map(tab => tab.apiTab.id);
                  if (tabIds.join(',') == tabIds.sort().join(','))
                    continue; // not sorted yet
                  return tabs;
                }
              })().then(aPITabs => {
                log(`ids from duplicating tabs are resolved in ${Date.now() - startTime}msec: `, aPITabs.map(aPITab => aPITab.id));
                return aPITabs;
              });
              apiTabs = await Promise.race([
                promisedDuplicatedTabs,
                promisedDuplicatingTabs
              ]);
            }
            else {
              apiTabs = await promisedDuplicatedTabs;
            }
            apiTabIds = apiTabs.map(aPITab => aPITab.id);
          }
        })()
      ]);
      log('moveTabs: all windows and tabs are ready, ', apiTabIds, destinationWindowId);
      // we must put moved tab at the first position by default, because pinned tabs cannot be placed after regular tabs.
      let toIndex = 0; // Tabs.getAllTabs(container).length;
      log('toIndex = ', toIndex);
      if (options.insertBefore &&
          options.insertBefore.apiTab.windowId == destinationWindowId) {
        try {
          const latestApiTab = await browser.tabs.get(options.insertBefore.apiTab.id);
          toIndex = latestApiTab.index;
        }
        catch(e) {
          ApiTabs.handleMissingTabError(e);
          log('options.insertBefore is unavailable');
        }
      }
      else if (options.insertAfter &&
               options.insertAfter.apiTab.windowId == destinationWindowId) {
        try {
          const latestApiTab = await browser.tabs.get(options.insertAfter.apiTab.id);
          toIndex = latestApiTab.index + 1;
        }
        catch(e) {
          ApiTabs.handleMissingTabError(e);
          log('options.insertAfter is unavailable');
        }
      }
      if (!isAcrossWindows &&
          tabs[0].apiTab.index < toIndex)
        toIndex--;
      log(' => ', toIndex);
      if (isAcrossWindows) {
        if (typeof browser.tabs.moveInSuccession != 'function') { // on Firefox 64 or older
          for (const tab of tabs) {
            if (!Tabs.isActive(tab))
              continue;
            await tryMoveFocusFromClosingActiveTabNow(tab, { ignoredTabs: tabs });
            break;
          }
        }
        apiTabs = await ApiTabs.safeMoveAcrossWindows(apiTabIds, {
          windowId: destinationWindowId,
          index:    toIndex
        });
        apiTabIds = apiTabs.map(apiTab => apiTab.id);
        log('moved across windows: ', apiTabIds);
      }

      log('applying tree structure', structure);
      // wait until tabs.onCreated are processed (for safety)
      let newTabs;
      const startTime = Date.now();
      const maxDelay = configs.maximumAcceptableDelayForTabDuplication;
      while (Date.now() - startTime < maxDelay) {
        newTabs = apiTabs.map(apiTab => Tabs.getTabById(TabIdFixer.fixTab(apiTab)));
        newTabs = newTabs.filter(tab => !!tab);
        if (newTabs.length < tabs.length) {
          log('retrying: ', apiTabIds, newTabs.length, tabs.length);
          await wait(100);
          continue;
        }
        await Promise.all(newTabs.map(tab => tab.opened));
        await applyTreeStructureToTabs(newTabs, structure, {
          broadcast: true
        });
        if (options.duplicate) {
          for (const tab of newTabs) {
            Tabs.removeState(tab, Constants.kTAB_STATE_DUPLICATING, { broadcast: true });
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
      throw e;
    }
    finally {
      UserOperationBlocker.unblockIn(windowId, { throbber: true });
    }
  }


  if (options.insertBefore) {
    await TabsMove.moveTabsBefore(movedTabs, options.insertBefore, options);
  }
  else if (options.insertAfter) {
    await TabsMove.moveTabsAfter(movedTabs, options.insertAfter, options);
  }
  else {
    log('no move: just duplicate or import');
  }
  // Tabs can be removed while waiting, so we need to
  // refresh the array of tabs.
  movedTabs = movedTabs.map(tab => Tabs.getTabById(tab.id));
  movedTabs = movedTabs.filter(tab => !!tab);

  return movedTabs;
}

export async function openNewWindowFromTabs(tabs, options = {}) {
  if (tabs.length == 0)
    return [];

  log('openNewWindowFromTabs: ', tabs.map(dumpTab), options);

  const windowId = parseInt(tabs[0].parentNode.windowId || Tabs.getWindow());

  if (options.inRemote) {
    const response = await browser.runtime.sendMessage(Object.assign({}, options, {
      type:      Constants.kCOMMAND_NEW_WINDOW_FROM_TABS,
      windowId:  windowId,
      tabs:      tabs.map(tab => tab.id),
      duplicate: !!options.duplicate,
      left:      'left' in options ? parseInt(options.left) : null,
      top:       'top' in options ? parseInt(options.top) : null,
      inRemote:  false
    }));
    return (response.movedTabs || []).map(Tabs.getTabById).filter(tab => !!tab);
  }

  log('opening new window');
  const windowParams = {
    //active: true,  // not supported in Firefox...
    url: 'about:blank',
    incognito: Tabs.isPrivateBrowsing(tabs[0])
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
    });
  tabs = tabs.filter(Tabs.ensureLivingTab);
  const movedTabs = await moveTabs(tabs, Object.assign({}, options, {
    destinationPromisedNewWindow: promsiedNewWindow
  }));

  log('closing needless tabs');
  browser.windows.get(newWindow.id, { populate: true })
    .then(apiWindow => {
      log('moved tabs: ', movedTabs.map(dumpTab));
      const movedAPITabIds = movedTabs.map(tab => tab.apiTab.id);
      const allTabsInWindow = apiWindow.tabs.map(apiTab => TabIdFixer.fixTab(apiTab));
      const removeTabs = [];
      for (const apiTab of allTabsInWindow) {
        if (!movedAPITabIds.includes(apiTab.id))
          removeTabs.push(Tabs.getTabById(apiTab));
      }
      log('removing tabs: ', removeTabs.map(dumpTab));
      TabsInternalOperation.removeTabs(removeTabs);
      UserOperationBlocker.unblockIn(newWindow.id);
    });

  return movedTabs;
}


export function calculateReferenceTabsFromInsertionPosition(tab, params = {}) {
  if (params.insertBefore) {
    /* strategy
         +-----------------------------------------------------
         |     <= detach from parent, and move
         |[TARGET  ]
         +-----------------------------------------------------
         |  [      ]
         |     <= attach to the parent of the target, and move
         |[TARGET  ]
         +-----------------------------------------------------
         |[        ]
         |     <= attach to the parent of the target, and move
         |[TARGET  ]
         +-----------------------------------------------------
         |[        ]
         |     <= attach to the parent of the target (previous tab), and move
         |  [TARGET]
         +-----------------------------------------------------
    */
    const prevTab = Tabs.getPreviousVisibleTab(params.insertBefore);
    if (!prevTab) {
      // allow to move pinned tab to beside of another pinned tab
      if (!tab || Tabs.isPinned(tab) == Tabs.isPinned(params.insertBefore)) {
        return {
          insertBefore: params.insertBefore
        };
      }
      else {
        return {};
      }
    }
    else {
      const prevLevel   = Number(prevTab.getAttribute(Constants.kLEVEL) || 0);
      const targetLevel = Number(params.insertBefore.getAttribute(Constants.kLEVEL) || 0);
      let parent = null;
      if (!tab || !Tabs.isPinned(tab))
        parent = (prevLevel < targetLevel) ? prevTab : Tabs.getParentTab(params.insertBefore);
      return {
        parent,
        insertAfter:  prevTab,
        insertBefore: params.insertBefore
      }
    }
  }
  if (params.insertAfter) {
    /* strategy
         +-----------------------------------------------------
         |[TARGET  ]
         |     <= if the target has a parent, attach to it and and move
         +-----------------------------------------------------
         |  [TARGET]
         |     <= attach to the parent of the target, and move
         |[        ]
         +-----------------------------------------------------
         |[TARGET  ]
         |     <= attach to the parent of the target, and move
         |[        ]
         +-----------------------------------------------------
         |[TARGET  ]
         |     <= attach to the target, and move
         |  [      ]
         +-----------------------------------------------------
    */
    const nextTab = Tabs.getNextVisibleTab(params.insertAfter);
    if (!nextTab) {
      return {
        parent:      Tabs.getParentTab(params.insertAfter),
        insertAfter: params.insertAfter
      };
    }
    else {
      const targetLevel = Number(params.insertAfter.getAttribute(Constants.kLEVEL) || 0);
      const nextLevel   = Number(nextTab.getAttribute(Constants.kLEVEL) || 0);
      let parent = null;
      if (!tab || !Tabs.isPinned(tab))
        parent = (targetLevel < nextLevel) ? params.insertAfter : Tabs.getParentTab(params.insertAfter) ;
      return {
        parent,
        insertBefore: nextTab,
        insertAfter:  params.insertAfter
      };
    }
  }
  throw new Error('calculateReferenceTabsFromInsertionPosition requires one of insertBefore or insertAfter parameter!');
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
  return cleanUpTreeStructureArray(
    tabs.map((tab, index) => {
      const parent = Tabs.getParentTab(tab);
      const indexInGivenTabs = parent ? tabs.indexOf(parent) : -1 ;
      return indexInGivenTabs >= index ? -1 : indexInGivenTabs ;
    }),
    -1
  ).map((parentIndex, index) => {
    const tab = tabs[index];
    const item = {
      id:        tab.getAttribute(Constants.kPERSISTENT_ID),
      parent:    parentIndex,
      collapsed: Tabs.isSubtreeCollapsed(tab)
    };
    if (options.full) {
      item.title  = tab.apiTab.title;
      item.url    = tab.apiTab.url;
      item.pinned = Tabs.isPinned(tab);
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
    if (Tabs.isCollapsed(tab))
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
      parent = Tabs.getTabById(parentTab);
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
      Tabs.removeState(parent, Constants.kTAB_STATE_SUBTREE_COLLAPSED); // prevent focus changing by "current tab attached to collapsed tree"
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
      collapsed: expanded === undefined ? !Tabs.hasChildTabs(tab) : !expanded ,
      justNow:   true,
      force:     true
    }));
  }
  MetricsData.add('applyTreeStructureToTabs: collapse/expand');
}
