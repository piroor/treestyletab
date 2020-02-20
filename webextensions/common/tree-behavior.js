/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as SidebarConnection from './sidebar-connection.js';

function log(...args) {
  internalLogger('common/tree-behavior', ...args);
}

export function shouldApplyTreeBehavior(params = {}) {
  log('shouldApplyTreeBehavior ', () => ({
    closeParentBehaviorMode: configs.closeParentBehaviorMode,
    params,
    stack: new Error().stack
  }));
  switch (configs.closeParentBehaviorMode) {
    case Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITHOUT_NATIVE_TABBAR: // kPARENT_TAB_BEHAVIOR_ALWAYS
      return true;
    default:
    case Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITH_NATIVE_TABBAR: // kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE
      return SidebarConnection.isInitialized() ? (params.windowId && SidebarConnection.isOpen(params.windowId)) : true ;
    case Constants.kCLOSE_PARENT_BEHAVIOR_MODE_CUSTOM: // kPARENT_TAB_BEHAVIOR_ONLY_ON_SIDEBAR
      return !!params.byInternalOperation;
  }
}

export function getCloseParentBehaviorForTab(tab, options = {}) {
  log('getCloseParentBehaviorForTab ', tab, options);
  if (!options.asIndividualTab &&
      tab.$TST.subtreeCollapsed &&
      !options.applyTreeBehavior)
    return Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN;

  const sidebarVisible = SidebarConnection.isInitialized() ? (tab.windowId && SidebarConnection.isOpen(tab.windowId)) : true;
  let behavior;
  switch (configs.closeParentBehaviorMode) {
    case Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITHOUT_NATIVE_TABBAR:
      log(' => kCLOSE_PARENT_BEHAVIOR_MODE_WITHOUT_NATIVE_TABBAR');
      behavior = configs.closeParentBehavior;
      break;
    default:
    case Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITH_NATIVE_TABBAR:
      log(' => kCLOSE_PARENT_BEHAVIOR_MODE_WITH_NATIVE_TABBAR');
      behavior = sidebarVisible ? configs.closeParentBehavior : Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;
      if (behavior != Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
          behavior != Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN)
        behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

      break;
    case Constants.kCLOSE_PARENT_BEHAVIOR_MODE_CUSTOM: // kPARENT_TAB_BEHAVIOR_ONLY_ON_SIDEBAR
      log(' => kCLOSE_PARENT_BEHAVIOR_MODE_CUSTOM');
      behavior = options.byInternalOperation ? configs.closeParentBehavior :
        sidebarVisible ? configs.closeParentBehavior_outsideSidebar :
          configs.closeParentBehavior_noSidebar;
      break;
  }
  const parentTab = options.parent || tab.$TST.parent;

  log(' => behavior: ', behavior);

  if (behavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_INTELLIGENTLY) {
    behavior = parentTab ? Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN : Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;
    log(' => intelligent behavior: ', behavior);
  }

  // Promote all children to upper level, if this is the last child of the parent.
  // This is similar to "taking by representation".
  if (behavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
      parentTab &&
      parentTab.$TST.childIds.length == 1 &&
      configs.promoteAllChildrenWhenClosedParentIsLastChild) {
    behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
    log(' => blast child ehavior: ', behavior);
  }

  return behavior;
}

export function getCloseParentBehaviorForTabWithSidebarOpenState(tab, removeInfo = {}) {
  const applyTreeBehavior = (
    removeInfo.applyTreeBehavior ||
    !shouldApplyTreeBehavior({
      windowId:            removeInfo.windowId || tab.windowId,
      byInternalOperation: removeInfo.byInternalOperation
    })
  );
  log('getCloseParentBehaviorForTabWithSidebarOpenState ', { tab, removeInfo, applyTreeBehavior });
  return getCloseParentBehaviorForTab(tab, {
    byInternalOperation: removeInfo.byInternalOperation,
    applyTreeBehavior
  });
}

export function getClosingTabsFromParent(tab, removeInfo = {}) {
  log('getClosingTabsFromParent: ', tab);
  const closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(tab, Object.assign(removeInfo, {
    windowId: tab.windowId
  }));
  log('getClosingTabsFromParent: closeParentBehavior ', closeParentBehavior);
  if (closeParentBehavior != Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    return [tab];
  return [tab].concat(tab.$TST.descendants);
}

export function calculateReferenceTabsFromInsertionPosition(tab, params = {}) {
  log('calculateReferenceTabsFromInsertionPosition ', {
    tab:          tab.id,
    insertBefore: params.insertBefore && params.insertBefore.id,
    insertAfter : params.insertAfter && params.insertAfter.id
  });
  if (params.insertBefore) {
    /* strategy for moved case
         +------------------ CASE 1 ---------------------------
         |     <= detach from parent, and move
         |[TARGET  ]
         +------------------ CASE 2 ---------------------------
         |  [      ]
         |     <= attach to the parent of the target, and move
         |[TARGET  ]
         +------------------ CASE 3 ---------------------------
         |[        ]
         |     <= attach to the parent of the target, and move
         |[TARGET  ]
         +------------------ CASE 4 ---------------------------
         |[        ]
         |     <= attach to the parent of the target (previous tab), and move
         |  [TARGET]
         +-----------------------------------------------------
    */
    /* strategy for shown case
         +------------------ CASE 5 ---------------------------
         |     <= detach from parent, and move
         |[TARGET  ]
         +------------------ CASE 6 ---------------------------
         |  [      ]
         |     <= if the inserted tab has a parent and it is not the parent of the target, attach to the parent of the target. Otherwise keep inserted as a root.
         |[TARGET  ]
         +------------------ CASE 7 ---------------------------
         |[        ]
         |     <= attach to the parent of the target, and move
         |[TARGET  ]
         +------------------ CASE 8 ---------------------------
         |[        ]
         |     <= attach to the parent of the target (previous tab), and move
         |  [TARGET]
         +-----------------------------------------------------
    */
    const prevTab = params.insertBefore && (configs.fixupTreeOnTabVisibilityChanged ? params.insertBefore.$TST.nearestVisiblePrecedingTab : params.insertBefore.$TST.unsafeNearestExpandedPrecedingTab);
    if (!prevTab) {
      log('calculateReferenceTabsFromInsertionPosition: from insertBefore, CASE 1/5');
      // allow to move pinned tab to beside of another pinned tab
      if (!tab ||
          tab.pinned == (params.insertBefore && params.insertBefore.pinned)) {
        return {
          insertBefore: params.insertBefore
        };
      }
      else {
        return {};
      }
    }
    else {
      const prevLevel   = Number(prevTab.$TST.getAttribute(Constants.kLEVEL) || 0);
      const targetLevel = Number(params.insertBefore.$TST.getAttribute(Constants.kLEVEL) || 0);
      let parent = null;
      if (!tab || !tab.pinned) {
        if (prevLevel < targetLevel) {
          if (params.context == Constants.kINSERTION_CONTEXT_MOVED) {
            log('calculateReferenceTabsFromInsertionPosition: from insertBefore, CASE 4');
            parent = prevTab;
          }
          else {
            log('calculateReferenceTabsFromInsertionPosition: from insertBefore, CASE 8');
            parent = (tab.$TST.parent != prevTab) ? prevTab : null;
          }
        }
        else {
          const possibleParent = params.insertBefore && params.insertBefore.$TST.parent;
          if (params.context == Constants.kINSERTION_CONTEXT_MOVED || prevLevel == targetLevel) {
            log('calculateReferenceTabsFromInsertionPosition: from insertBefore, CASE 2/3/7');
            parent = possibleParent;
          }
          else {
            log('calculateReferenceTabsFromInsertionPosition: from insertBefore, CASE 6');
            parent = tab.$TST.parent != possibleParent && possibleParent || tab.$TST.parent;
          }
        }
      }
      const result = {
        parent,
        insertAfter:  prevTab,
        insertBefore: params.insertBefore
      };
      log(' => ', result);
      return result;
    }
  }
  if (params.insertAfter) {
    /* strategy for moved case
         +------------------ CASE 1 ---------------------------
         |[TARGET  ]
         |     <= if the target has a parent, attach to it and and move
         +------------------ CASE 2 ---------------------------
         |  [TARGET]
         |     <= attach to the parent of the target, and move
         |[        ]
         +------------------ CASE 3 ---------------------------
         |[TARGET  ]
         |     <= attach to the parent of the target, and move
         |[        ]
         +------------------ CASE 4 ---------------------------
         |[TARGET  ]
         |     <= attach to the target, and move
         |  [      ]
         +-----------------------------------------------------
    */
    /* strategy for shown case
         +------------------ CASE 5 ---------------------------
         |[TARGET  ]
         |     <= if the inserted tab has a parent, detach. Otherwise keep inserted as a root.
         +------------------ CASE 6 ---------------------------
         |  [TARGET]
         |     <= if the inserted tab has a parent and it is not the parent of the next tab, attach to the parent of the target. Otherwise attach to the parent of the next tab.
         |[        ]
         +------------------ CASE 7 ---------------------------
         |[TARGET  ]
         |     <= attach to the parent of the target, and move
         |[        ]
         +------------------ CASE 8 ---------------------------
         |[TARGET  ]
         |     <= attach to the target, and move
         |  [      ]
         +-----------------------------------------------------
    */
    // We need to refer unsafeNearestExpandedFollowingTab instead of a visible tab, to avoid
    // placing the tab after hidden tabs (it is too far from the target).
    const unsafeNextTab = params.insertAfter && params.insertAfter.$TST.unsafeNearestExpandedFollowingTab;
    const nextTab = params.insertAfter && (configs.fixupTreeOnTabVisibilityChanged ? params.insertAfter.$TST.nearestVisibleFollowingTab : unsafeNextTab);
    if (!nextTab) {
      let result;
      if (params.context == Constants.kINSERTION_CONTEXT_MOVED) {
        log('calculateReferenceTabsFromInsertionPosition: from insertAfter, CASE 1');
        result = {
          parent:       params.insertAfter && params.insertAfter.$TST.parent,
          insertBefore: unsafeNextTab,
          insertAfter:  params.insertAfter
        };
      }
      else {
        log('calculateReferenceTabsFromInsertionPosition: from insertAfter, CASE 5');
        result = {
          parent:       tab.$TST.parent && params.insertAfter && params.insertAfter.$TST.parent,
          insertBefore: unsafeNextTab,
          insertAfter:  params.insertAfter
        };
      }
      log(' => ', result);
      return result;
    }
    else {
      const targetLevel = Number(params.insertAfter.$TST.getAttribute(Constants.kLEVEL) || 0);
      const nextLevel   = Number(nextTab.$TST.getAttribute(Constants.kLEVEL) || 0);
      let parent = null;
      if (!tab || !tab.pinned) {
        if (targetLevel < nextLevel) {
          log('calculateReferenceTabsFromInsertionPosition: from insertAfter, CASE 4/8');
          parent = params.insertAfter;
        }
        else  {
          const possibleParent = params.insertAfter && params.insertAfter.$TST.parent;
          if (params.context == Constants.kINSERTION_CONTEXT_MOVED || targetLevel == nextLevel) {
            log('calculateReferenceTabsFromInsertionPosition: from insertAfter, CASE 2/3/7');
            parent = possibleParent;
          }
          else {
            log('calculateReferenceTabsFromInsertionPosition: from insertAfter, CASE 6');
            parent = tab.$TST.parent != possibleParent && possibleParent || tab.$TST.parent;
          }
        }
      }
      const result = {
        parent,
        insertBefore: unsafeNextTab || nextTab,
        insertAfter:  params.insertAfter
      };
      log(' => ', result);
      return result;
    }
  }
  throw new Error('calculateReferenceTabsFromInsertionPosition requires one of insertBefore or insertAfter parameter!');
}

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
