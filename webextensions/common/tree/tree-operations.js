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

async function attachTabTo(aChild, aParent, aInfo = {}) {
  if (!aParent || !aChild) {
    log('missing information: ', dumpTab(aParent), dumpTab(aChild));
    return;
  }

  log('attachTabTo: ', {
    parent:   dumpTab(aParent),
    children: aParent.getAttribute(kCHILDREN),
    child:    dumpTab(aChild),
    info:     aInfo
  });
  if ((aParent.getAttribute(kCHILDREN) || '').indexOf(`|${aChild.id}|`) > -1) {
    log('=> already attached');
    return;
  }
  if (isPinned(aParent) || isPinned(aChild)) {
    log('=> pinned tabs cannot be attached');
    return;
  }
  var ancestors = [aParent].concat(getAncestorTabs(aChild));
  if (ancestors.indexOf(aChild) > -1) {
    log('=> canceled for recursive request');
    return;
  }

  detachTab(aChild);

  var newIndex = -1;
  if (aInfo.dontMove)
    aInfo.insertBefore = getNextTab(aChild);
  if (aInfo.insertBefore) {
    log('insertBefore: ', dumpTab(aInfo.insertBefore));
    newIndex = getTabIndex(aInfo.insertBefore);
  }
  var childIds = [];
  if (newIndex > -1) {
    log('newIndex (from insertBefore): ', newIndex);
    let expectedAllTabs = getAllTabs(aChild).filter((aTab) => aTab != aChild);
    let refIndex = expectedAllTabs.indexOf(aInfo.insertBefore);
    expectedAllTabs.splice(refIndex, 0, aChild);
    childIds = expectedAllTabs.filter((aTab) => {
      return (aTab == aChild || aTab.getAttribute(kPARENT) == aParent.id);
    }).map((aTab) => {
      return aTab.id;
    });
  }
  else {
    let descendants = getDescendantTabs(aParent);
    log('descendants: ', descendants.map(dumpTab));
    if (descendants.length) {
      newIndex = getTabIndex(descendants[descendants.length-1]) + 1;
    }
    else {
      newIndex = getTabIndex(aParent) + 1;
    }
    log('newIndex (from existing children): ', newIndex);
    // update and cleanup
    let children = getChildTabs(aParent);
    children.push(aChild);
    childIds = children.map((aTab) => aTab.id);
  }

  if (childIds.length == 0)
    aParent.removeAttribute(kCHILDREN);
  else
    aParent.setAttribute(kCHILDREN, `|${childIds.join('|')}|`);

  if (getTabIndex(aChild) < newIndex)
    newIndex--;
  log('newIndex: ', newIndex);

  aChild.setAttribute(kPARENT, aParent.id);
  var parentLevel = parseInt(aParent.getAttribute(kNEST) || 0);
  if (!aInfo.dontUpdateIndent) {
    updateTabsIndent(aChild, parentLevel + 1);
    //checkTabsIndentOverflow();
  }
  //updateTabAsParent(aParent);
  //if (shouldInheritIndent && !aInfo.dontUpdateIndent)
    //this.inheritTabIndent(aChild, aParent);

  var container = getTabsContainer(aChild);
  var nextTab = getTabs(aChild)[newIndex];
  if (nextTab != aChild) {
    log('put tab before ', dumpTab(nextTab));
    //moveTabSubtreeTo(aChild, newIndex);
    container.insertBefore(aChild, nextTab);
  }

  var [actualOldIndex, actualNewIndex] = await getApiTabIndex(aChild.apiTab.id, nextTab.apiTab.id);
  if (actualOldIndex < actualNewIndex)
    actualNewIndex--;

  log('index of API tabs: ', { actualOldIndex, actualNewIndex });
  if (actualOldIndex < 0 || actualNewIndex < 0) {
    log('alrady closed tab cannot be moved!');
    return;
  }

  if (actualOldIndex == actualNewIndex) {
    log('attaching child is already moved');
  }
  else {
    log(`attaching child is not moved to ${actualNewIndex} yet`);
  container.internalMovingCount++;
  browser.tabs.move(aChild.apiTab.id, {
    windowId: aChild.apiTab.windowId,
    index:    actualNewIndex
  }).catch(handleMissingTabError)
    .then(() => container.internalMovingCount--);
  }

  if (aInfo.forceExpand) {
    collapseExpandSubtree(aParent, { collapsed: false, justNow: aInfo.justNow });
  }
  else if (!aInfo.dontExpand) {
    if (configs.autoCollapseExpandSubtreeOnAttach &&
        shouldTabAutoExpanded(aParent))
      collapseExpandTreesIntelligentlyFor(aParent);

    let newAncestors = [aParent].concat(getAncestorTabs(aParent));
    if (configs.autoCollapseExpandSubtreeOnSelect) {
      newAncestors.forEach(aAncestor => {
        if (shouldTabAutoExpanded(aAncestor))
          collapseExpandSubtree(aAncestor, { collapsed: false, justNow: aInfo.justNow });
      });
    }
    else if (shouldTabAutoExpanded(aParent)) {
      if (configs.autoExpandSubtreeOnAppendChild) {
        newAncestors.forEach(aAncestor => {
          if (shouldTabAutoExpanded(aAncestor))
            collapseExpandSubtree(aAncestor, { collapsed: false, justNow: aInfo.justNow });
        });
      }
      else
        collapseExpandTab(aChild, { collapsed: true, justNow: aInfo.justNow });
    }
    if (isCollapsed(aParent))
      collapseExpandTab(aChild, { collapsed: true, justNow: aInfo.justNow });
  }
  else if (shouldTabAutoExpanded(aParent) ||
           isCollapsed(aParent)) {
    collapseExpandTab(aChild, { collapsed: true, justNow: aInfo.justNow });
  }

  //promoteTooDeepLevelTabs(aChild);

  window.onTabAttached && onTabAttached(aChild, {
    parent: aParent
  });
}

function detachTab(aChild, aInfo = {}) {
  log('detachTab: ', dumpTab(aChild), aInfo);
  var parent = getParentTab(aChild);
  if (!parent) {
    log('canceled for an orphan tab');
    return;
  }

  var childIds = (parent.getAttribute(kCHILDREN) || '').split('|').filter((aId) => aId && aId != aChild.id);
  if (childIds.length == 0)
    parent.removeAttribute(kCHILDREN);
  else
    parent.setAttribute(kCHILDREN, `|${childIds.join('|')}|`);
  log('children => ', parent.getAttribute(kCHILDREN));
  aChild.removeAttribute(kPARENT);

  updateTabsIndent(aChild);

  window.onTabDetached && onTabDetached(aChild, {
    oldParent: parent
  });
}

function detachAllChildren(aTab, aInfo = {}) {
  var children = getChildTabs(aTab);
  if (!children.length)
    return;

  if (!('behavior' in aInfo))
    aInfo.behavior = kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN;
  if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    aInfo.behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  aInfo.dontUpdateInsertionPositionInfo = true;

  var parent = getParentTab(aTab);
  if (isGroupTab(aTab) &&
      getTabs(aTab).filter((aTab) => aTab.removing).length == children.length) {
    aInfo.behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
    aInfo.dontUpdateIndent = false;
  }

  var nextTab = null;
  if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN/* &&
    !utils.getTreePref('closeParentBehavior.moveDetachedTabsToBottom')*/) {
    nextTab = getNextSiblingTab(getRootTab(aTab));
  }

  if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB) {
    // open new group tab and replace the detaching tab with it.
    aInfo.behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
  }

  for (let i = 0, maxi = children.length; i < maxi; i++) {
    let child = children[i];
    if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN) {
      detachTab(child, aInfo);
      //moveTabSubtreeTo(tab, nextTab ? nextTab._tPos - 1 : this.getLastTab(b)._tPos );
    }
    else if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD) {
      detachTab(child, aInfo);
      if (i == 0) {
        if (parent) {
          attachTabTo(child, parent, inherit(aInfo, {
            dontExpand : true,
            dontMove   : true
          }));
        }
        collapseExpandSubtree(child, false);
        //deleteTabValue(child, kTAB_STATE_SUBTREE_COLLAPSED);
      }
      else {
        attachTabTo(child, children[0], inherit(aInfo, {
          dontExpand : true,
          dontMove   : true
        }));
      }
    }
    else if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN && parent) {
      attachTabTo(child, parent, inherit(aInfo, {
        dontExpand : true,
        dontMove   : true
      }));
    }
    else { // aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN
      detachTab(child, aInfo);
    }
  }
}

function updateTabsIndent(aTabs, aLevel = undefined) {
  if (!aTabs)
    return;

  if (!Array.isArray(aTabs))
    aTabs = [aTabs];

  if (!aTabs.length)
    return;

  if (aLevel === undefined)
    aLevel = getAncestorTabs(aTabs[0]).length;

  for (let i = 0, maxi = aTabs.length; i < maxi; i++) {
    let item = aTabs[i];
    if (!item || isPinned(item))
      continue;

    window.onTabLevelChanged && onTabLevelChanged(item);
    item.setAttribute(kNEST, aLevel);
    updateTabsIndent(getChildTabs(item), aLevel + 1);
  }
}


// collapse/expand tabs

function shouldTabAutoExpanded(aTab) {
  return hasChildTabs(aTab) && isSubtreeCollapsed(aTab);
}

async function collapseExpandSubtree(aTab, aParams = {}) {
  aParams.collapsed = !!aParams.collapsed;
  log('collapseExpandSubtree: ', dumpTab(aTab), aParams);
  if (!aTab)
    return;
  var container = getTabsContainer(aTab);
  container.doingCollapseExpandCount++;
  await collapseExpandSubtreeInternal(aTab, aParams);
  if (!aParams.noPush) {
    browser.runtime.sendMessage({
      type:      kCOMMAND_PUSH_SUBTREE_COLLAPSED_STATE,
      windowId:  container.windowId,
      tab:       aTab.id,
      collapsed: aParams.collapsed,
      manualOperation: !!aParams.manualOperation
    });
  }
  container.doingCollapseExpandCount--;
}
function collapseExpandSubtreeInternal(aTab, aParams = {}) {
  if ((isSubtreeCollapsed(aTab) == aParams.collapsed))
    return;

  var container = getTabsContainer(aTab);

  if (aParams.collapsed)
    aTab.classList.add(kTAB_STATE_SUBTREE_COLLAPSED);
  else
    aTab.classList.remove(kTAB_STATE_SUBTREE_COLLAPSED);
  //setTabValue(aTab, kTAB_STATE_SUBTREE_COLLAPSED, aParams.collapsed);

  var childTabs = getChildTabs(aTab);
  var lastExpandedTabIndex = childTabs.length - 1;
  for (let i = 0, maxi = childTabs.length; i < maxi; i++) {
    let childTab = childTabs[i];
    if (!aParams.collapsed &&
        !aParams.justNow &&
        i == lastExpandedTabIndex) {
      collapseExpandTab(childTab, {
         collapsed: aParams.collapsed,
         justNow:   aParams.justNow,
         last:      true
      });
    }
    else {
      collapseExpandTab(childTab, {
        collapsed: aParams.collapsed,
        justNow:   aParams.justNow
      });
    }
  }

  if (aParams.collapsed) {
    aTab.classList.remove(kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
    //deleteTabValue(aTab, kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
  }

  //if (configs.indentAutoShrink &&
  //    configs.indentAutoShrinkOnlyForVisible)
  //  checkTabsIndentOverflow();
}

function manualCollapseExpandSubtree(aTab, aParams = {}) {
  aParams.manualOperation = true;
  collapseExpandSubtree(aTab, aParams);
  if (!aParams.collapsed) {
    aTab.classList.add(kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
    //setTabValue(aTab, kTAB_STATE_SUBTREE_EXPANDED_MANUALLY, true);
  }
}

function collapseExpandTab(aTab, aParams = {}) {
  if (!aTab)
    return;

  var parent = getParentTab(aTab);
  if (!parent)
    return;

  if (aParams.collapsed)
    aTab.classList.add(kTAB_STATE_COLLAPSED);
  else
    aTab.classList.remove(kTAB_STATE_COLLAPSED);
  //setTabValue(aTab, kTAB_STATE_COLLAPSED, aParams.collapsed);

  window.onTabCollapsedStateChanging &&
    window.onTabCollapsedStateChanging(aTab, {
      collapsed: aParams.collapsed,
      justNow: aParams.justNow
    });

  //var data = {
  //  collapsed : aParams.collapsed
  //};
  ///* PUBLIC API */
  //fireCustomEvent(kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, aTab, true, false, data);

  if (aParams.collapsed && isActive(aTab)) {
    let newSelection = parent;
    for (let ancestor of getAncestorTabs(aTab)) {
      if (isCollapsed(ancestor))
        continue;
      newSelection = ancestor;
      break;
    }
    log('current tab is going to be collapsed, switch to ', dumpTab(newSelection));
    selectTabInternally(newSelection);
  }

  if (!isSubtreeCollapsed(aTab)) {
    for (let tab of getChildTabs(aTab)) {
      collapseExpandTab(tab, {
        collapsed: aParams.collapsed,
        justNow:   aParams.justNow
      });
    }
  }
}

function collapseExpandTreesIntelligentlyFor(aTab, aParams = {}) {
  if (!aTab)
    return;

  log('collapseExpandTreesIntelligentlyFor');
  var container = getTabsContainer(aTab);
  if (container.doingCollapseExpandCount > 0) {
    //log('=> done by others');
    return;
  }

  var sameParentTab = getParentTab(aTab);
  var expandedAncestors = `<${[aTab].concat(getAncestorTabs(aTab))
      .map(aAncestor => aAncestor.id)
      .join('><')}>`;

  var xpathResult = evaluateXPath(
      `child::${kXPATH_LIVE_TAB}[
        @${kCHILDREN} and
        not(${hasClass(kTAB_STATE_COLLAPSED)}) and
        not(${hasClass(kTAB_STATE_SUBTREE_COLLAPSED)}) and
        not(contains("${expandedAncestors}", concat("<", @id, ">"))) and
        not(${hasClass(kTAB_STATE_HIDDEN)})
      ]`,
      container
    );
  //log(`${xpathResult.snapshotLength} tabs can be collapsed`);
  for (let i = 0, maxi = xpathResult.snapshotLength; i < maxi; i++) {
    let dontCollapse = false;
    let collapseTab  = xpathResult.snapshotItem(i);
    let parentTab = getParentTab(collapseTab);
    if (parentTab) {
      dontCollapse = true;
      if (!isSubtreeCollapsed(parentTab)) {
        for (let ancestor of getAncestorTabs(collapseTab)) {
          if (expandedAncestors.indexOf(`<${ancestor.id}>`) < 0)
            continue;
          dontCollapse = false;
          break;
        }
      }
    }
    //log(`${dumpTab(collapseTab)}: dontCollapse = ${dontCollapse}`);

    let manuallyExpanded = collapseTab.classList.contains(kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
    if (!dontCollapse && !manuallyExpanded)
      collapseExpandSubtree(collapseTab, {
        collapsed: true,
        justNow:   aParams.justNow
      });
  }

  collapseExpandSubtree(aTab, {
    collapsed: false,
    justNow:   aParams.justNow
  });
}

async function forceExpandTabs(aTabs) {
  var collapsedStates = aTabs.map(isSubtreeCollapsed);
  await Promise.all(aTabs.map(aTab => {
    collapseExpandSubtree(aTab, { collapsed: false, justNow: true });
    collapseExpandTab(aTab, { collapsed: false, justNow: true });
  }));
  return collapsedStates;
}


// operate tabs based on tree information

function closeChildTabs(aParent) {
  var tabs = getDescendantTabs(aParent);
  //if (!fireTabSubtreeClosingEvent(aParent, tabs))
  //  return;

  //markAsClosedSet([aParent].concat(tabs));
  tabs.reverse().forEach(aTab => {
    browser.tabs.remove(aTab.apiTab.id)
      .catch(handleMissingTabError);
  });
  //fireTabSubtreeClosedEvent(aParent, tabs);
}

async function tryMoveFocusFromClosingCurrentTab(aTab) {
  log('tryMoveFocusFromClosingCurrentTab');
  var nextFocusedTab = null;

  var closeParentBehavior = getCloseParentBehaviorForTab(aTab);
  var firstChild = getFirstChildTab(aTab);
  if (firstChild &&
      (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN ||
       closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD))
    nextFocusedTab = firstChild;
  log('focus to first child?: ', !!nextFocusedTab);

  var toBeClosedTabs = []; // collectNeedlessGroupTabs(aTab);
  var parentTab = getParentTab(aTab);
  if (parentTab) {
    if (!nextFocusedTab && aTab == getLastChildTab(parentTab)) {
      if (aTab == getFirstChildTab(parentTab)) { // this is the really last child
        nextFocusedTab = parentTab;
        log('focus to parent?: ', !!nextFocusedTab);
      }
      else {
        nextFocusedTab = getPreviousSiblingTab(aTab);
        log('focus to previous sibling?: ', !!nextFocusedTab);
      }
    }
    if (nextFocusedTab && toBeClosedTabs.indexOf(nextFocusedTab) > -1)
      nextFocusedTab = getNextFocusedTab(parentTab);
  }
  else if (!nextFocusedTab) {
    nextFocusedTab = getNextFocusedTab(aTab);
    log('focus to getNextFocusedTab()?: ', !!nextFocusedTab);
  }
  if (nextFocusedTab && toBeClosedTabs.indexOf(nextFocusedTab) > -1) {
    nextFocusedTab = getNextFocusedTab(nextFocusedTab);
    log('focus to getNextFocusedTab() again?: ', !!nextFocusedTab);
  }

  if (!nextFocusedTab || isHidden(nextFocusedTab))
    return false;

  log('focus to: ', dumpTab(nextFocusedTab));

  //XXX notify kEVENT_TYPE_FOCUS_NEXT_TAB for others
  //if (!canFocus)
  //  return;

  nextFocusedTab.parentNode.focusChangedByCurrentTabRemove = true;
  await selectTabInternally(nextFocusedTab);
  return true;
}

function getCloseParentBehaviorForTab(aTab, aDefaultBehavior) {
  if (isSubtreeCollapsed(aTab))
    return kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN;

  var closeParentBehavior = configs.closeParentBehavior;
  var closeRootBehavior = configs.closeRootBehavior;

  var parentTab = getParentTab(aTab);
  var behavior = aDefaultBehavior ?
                   aDefaultBehavior :
                 (!parentTab &&
                  closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN) ?
                   closeRootBehavior :
                   closeParentBehavior ;
  // Promote all children to upper level, if this is the last child of the parent.
  // This is similar to "taking by representation".
  if (behavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
      parentTab &&
      getChildTabs(parentTab).length == 1 &&
      configs.closeParentBehaviorPromoteAllChildrenWhenParentIsLastChild)
    behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;

  return behavior;
}


async function moveTabSubtreeTo(aTab, aIndex) {
  if (!aTab)
    return;

  var container = aTab.parentNode;
  container.subTreeMovingCount++;
  container.internalMovingCount++;
  //moveTabTo(aTab, aIndex);
  container.internalMovingCount--;
  await followDescendantsToMovedRoot(aTab)
  setTimeout(() => container.subTreeMovingCount--, 0);
}

async function followDescendantsToMovedRoot(aTab) {
  if (!hasChildTabs(aTab))
    return;

  log('followDescendantsToMovedRoot: ', dumpTab(aTab));
  var container = aTab.parentNode;
  container.subTreeChildrenMovingCount++;
  container.internalMovingCount++;
  container.subTreeMovingCount++;
  try {
    var descendants = getDescendantTabs(aTab);
    var lastMoved = aTab;
    var count = 0;
    for (let descendant of descendants) {
      let [toIndex, fromIndex] = await getApiTabIndex(lastMoved.apiTab.id, descendant.apiTab.id);
      if (fromIndex > toIndex)
        toIndex++;
      log(`moving descendant tab ${dumpTab(descendant)} to ${toIndex}`);
      await browser.tabs.move(descendant.apiTab.id, {
        windowId: container.windowId,
        index: toIndex
      });
      lastMoved = descendant;
      // descendant node will be moved by handling of API event
    }
  }
  catch(e) {
    log('followDescendantsToMovedRoot failed: ', String(e));
  }
  setTimeout(() => {
    container.internalMovingCount--;
    container.subTreeChildrenMovingCount--;
    container.subTreeMovingCount--;
  }, 50);
}

// set/get tree structure

function getTreeStructureFromTabs(aTabs) {
  if (!aTabs || !aTabs.length)
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
      aTabs.map((aTab, aIndex) => {
        let tab = getParentTab(aTab);
        let index = tab ? aTabs.indexOf(tab) : -1 ;
        return index >= aIndex ? -1 : index ;
      }),
      -1
    ).map((aParentIndex, aIndex) => {
      return {
        parent:    aParentIndex,
        collapsed: isSubtreeCollapsed(aTabs[aIndex])
      };
    });
}
function cleanUpTreeStructureArray(aTreeStructure, aDefaultParent) {
  var offset = 0;
  aTreeStructure = aTreeStructure
    .map((aPosition, aIndex) => {
      return (aPosition == aIndex) ? -1 : aPosition ;
    })
    .map((aPosition, aIndex) => {
      if (aPosition == -1) {
        offset = aIndex;
        return aPosition;
      }
      return aPosition - offset;
    });

  /* The final step, this validates all of values.
     Smaller than -1 is invalid, so it becomes to -1. */
  aTreeStructure = aTreeStructure.map(aIndex => {
      return aIndex < -1 ? aDefaultParent : aIndex ;
    });
  return aTreeStructure;
}

function applyTreeStructureToTabs(aTabs, aTreeStructure, aExpandStates = []) {
  log('applyTreeStructureToTabs: ', aTreeStructure, aExpandStates);
  aTabs = aTabs.slice(0, aTreeStructure.length);
  aTreeStructure = aTreeStructure.slice(0, aTabs.length);

  aExpandStates = (aExpandStates && typeof aExpandStates == 'object') ?
            aExpandStates :
            aTabs.map(aTab => !!aExpandStates);
  aExpandStates = aExpandStates.slice(0, aTabs.length);
  while (aExpandStates.length < aTabs.length)
    aExpandStates.push(-1);

  var parentTab = null;
  for (let i = 0, maxi = aTabs.length; i < maxi; i++) {
    let tab = aTabs[i];
    //if (isCollapsed(tab))
    //  collapseExpandTab(tab, false, true);
    detachTab(tab);

    let structureInfo = aTreeStructure[i];
    let parentIndexInTree = -1;
    if (typeof structureInfo == 'number') { // legacy format
      parentIndexInTree = structureInfo;
    }
    else {
      parentIndexInTree = structureInfo.parent;
      aExpandStates[i]  = !structureInfo.collapsed;
    }
    if (parentIndexInTree < 0) // there is no parent, so this is a new parent!
      parentTab = tab.id;

    let parent = getTabById(parentTab);
    if (parent) {
      let tabs = [parent].concat(getDescendantTabs(parent));
      parent = parentIndexInTree < tabs.length ? tabs[parentIndexInTree] : parent ;
    }
    if (parent) {
      attachTabTo(tab, parent, {
        dontExpand : true,
        dontMove   : true,
        justNow    : true
      });
    }
  }

  log('aExpandStates: ', aExpandStates);
  for (let i = aTabs.length-1; i > -1; i--) {
    let tab = aTabs[i];
    let expanded = aExpandStates[i];
    collapseExpandSubtree(tab, {
      collapsed: expanded === undefined ? !hasChildTabs(tab) : !expanded ,
      justNow:   true
    });
  }
}


function scrollToNewTab(aTab) {
}

function updateInsertionPositionInfo(aTab) {
}
