/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as SidebarConnection from './sidebar-connection.js';

export function shouldApplyTreeBehavior(params = {}) {
  switch (configs.parentTabBehaviorForChanges) {
    case Constants.kPARENT_TAB_BEHAVIOR_ALWAYS:
      return true;
    case Constants.kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE:
      return SidebarConnection.isInitialized() ? (params.windowId && SidebarConnection.isOpen(params.windowId)) : true ;
    default:
    case Constants.kPARENT_TAB_BEHAVIOR_ONLY_ON_SIDEBAR:
      return !!params.byInternalOperation;
  }
}

export function getCloseParentBehaviorForTab(tab, options = {}) {
  if (!options.asIndividualTab &&
      tab.$TST.subtreeCollapsed &&
      !options.keepChildren)
    return Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN;

  let behavior = configs.closeParentBehavior;
  const parentTab = options.parent || tab.$TST.parent;

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
      parentTab.$TST.childIds.length == 1 &&
      configs.promoteAllChildrenWhenClosedParentIsLastChild)
    behavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;

  return behavior;
}

export function getCloseParentBehaviorForTabWithSidebarOpenState(tab, removeInfo = {}) {
  return getCloseParentBehaviorForTab(tab, {
    keepChildren: (
      removeInfo.keepChildren ||
      !shouldApplyTreeBehavior({
        windowId:            removeInfo.windowId || tab.windowId,
        byInternalOperation: removeInfo.byInternalOperation
      })
    )
  });
}

export function getClosingTabsFromParent(tab) {
  const closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(tab, {
    windowId: tab.windowId
  });
  if (closeParentBehavior != Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    return [tab];
  return [tab].concat(tab.$TST.descendants);
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
    const prevTab = params.insertBefore && params.insertBefore.$TST.nearestVisiblePrecedingTab;
    if (!prevTab) {
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
      if (!tab || !tab.pinned)
        parent = (prevLevel < targetLevel) ? prevTab : (params.insertBefore && params.insertBefore.$TST.parent);
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
    const nextTab = params.insertAfter && params.insertAfter.$TST.nearestVisibleFollowingTab;
    // We need to refer unsafeNextTab instead of a visible tab, to avoid
    // placing the tab after hidden tabs (it is too far from the target).
    const phisicalNextTab = params.insertAfter && params.insertAfter.$TST.unsafeNextTab;
    if (!nextTab) {
      return {
        parent:      params.insertAfter && params.insertAfter.$TST.parent,
        insertBefore: phisicalNextTab,
        insertAfter: params.insertAfter
      };
    }
    else {
      const targetLevel = Number(params.insertAfter.$TST.getAttribute(Constants.kLEVEL) || 0);
      const nextLevel   = Number(nextTab.$TST.getAttribute(Constants.kLEVEL) || 0);
      let parent = null;
      if (!tab || !tab.pinned)
        parent = (targetLevel < nextLevel) ? params.insertAfter : (params.insertAfter && params.insertAfter.$TST.parent) ;
      return {
        parent,
        insertBefore: phisicalNextTab || nextTab,
        insertAfter:  params.insertAfter
      };
    }
  }
  throw new Error('calculateReferenceTabsFromInsertionPosition requires one of insertBefore or insertAfter parameter!');
}
