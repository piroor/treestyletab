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

async function attachTabTo(aChild, aParent, aOptions = {}) {
  if (!aParent || !aChild) {
    log('missing information: ', dumpTab(aParent), dumpTab(aChild));
    return;
  }

  log('attachTabTo: ', {
    child:            dumpTab(aChild),
    parent:           dumpTab(aParent),
    children:         aParent.getAttribute(kCHILDREN),
    insertBefore:     dumpTab(aOptions.insertBefore),
    insertAfter:      dumpTab(aOptions.insertAfter),
    dontMove:         aOptions.dontMove,
    dontUpdateIndent: aOptions.dontUpdateIndent,
    forceExpand:      aOptions.forceExpand,
    dontExpand:       aOptions.dontExpand,
    delayedMove:      aOptions.delayedMove,
    inRemote:         aOptions.inRemote,
    broadcast:        aOptions.broadcast,
    broadcasted:      aOptions.broadcasted
  }, `${new Error().stack}\n${aOptions.stack || ''}`);

  if (isPinned(aParent) || isPinned(aChild)) {
    log('=> pinned tabs cannot be attached');
    return;
  }
  if (aParent.apiTab.windowId != aChild.apiTab.windowId) {
    log('=> could not attach tab to a parent in different window');
    return;
  }
  var ancestors = [aParent].concat(getAncestorTabs(aChild));
  if (ancestors.indexOf(aChild) > -1) {
    log('=> canceled for recursive request');
    return;
  }

  if (aOptions.dontMove) {
    aOptions.insertBefore = getNextTab(aChild);
    if (!aOptions.insertBefore)
      aOptions.insertAfter = getPreviousTab(aChild);
  }

  if (!aOptions.insertBefore && !aOptions.insertAfter) {
    let refTabs = getReferenceTabsForNewChild(aChild, aParent, aOptions);
    aOptions.insertBefore = refTabs.insertBefore;
    aOptions.insertAfter  = refTabs.insertAfter;
  }
  aOptions.insertAfter = aOptions.insertAfter || aParent;

  var newIndex = calculateNewTabIndex(aOptions);
  log('newIndex: ', newIndex);

  var childIds;
  {
    let newIndex = calculateNewTabIndex({
      insertBefore: aOptions.insertBefore,
      insertAfter:  aOptions.insertAfter,
      ignoreTabs:   [aChild.id]
    });
    let expectedAllTabs = getAllTabs(aChild).filter(aTab => aTab != aChild);
    if (newIndex >= expectedAllTabs.length)
      expectedAllTabs.push(aChild);
    else
      expectedAllTabs.splice(newIndex, 0, aChild);

    childIds = expectedAllTabs.filter(aTab => {
      return (aTab == aChild ||
              aTab.getAttribute(kPARENT) == aParent.id);
    }).map(aTab => aTab.id);
  }
  log('new children: ', childIds);

  var newlyAttached = false;
  if ((aParent.getAttribute(kCHILDREN) || '').indexOf(`|${aChild.id}|`) > -1 &&
      aChild.getAttribute(kPARENT) == aParent.id) {
    log('=> already attached');
  }
  else {
    newlyAttached = true;

    detachTab(aChild, clone(aOptions, {
      // Don't broadcast this detach operation, because this "attachTabTo" can be
      // broadcasted. If we broadcast this detach operation, the tab is detached
      // twice in the sidebar!
      broadcast: false
    }));

    if (childIds.length == 0)
      aParent.removeAttribute(kCHILDREN);
    else
      aParent.setAttribute(kCHILDREN, `|${childIds.join('|')}|`);

    aChild.setAttribute(kPARENT, aParent.id);

    let parentLevel = parseInt(aParent.getAttribute(kLEVEL) || 0);
    if (!aOptions.dontUpdateIndent) {
      updateTabsIndent(aChild, parentLevel + 1);
    }
    //updateTabAsParent(aParent);
    //if (shouldInheritIndent && !aOptions.dontUpdateIndent)
    //  this.inheritTabIndent(aChild, aParent);

    //promoteTooDeepLevelTabs(aChild);

    updateParentTab(aParent);
  }

  window.onTabAttached && onTabAttached(aChild, clone(aOptions, {
    parent: aParent,
    newIndex, newlyAttached
  }));

  if (aOptions.inRemote || aOptions.broadcast) {
    browser.runtime.sendMessage({
      type:             kCOMMAND_ATTACH_TAB_TO,
      windowId:         aChild.apiTab.windowId,
      child:            aChild.id,
      parent:           aParent.id,
      insertBefore:     aOptions.insertBefore && aOptions.insertBefore.id,
      insertAfter:      aOptions.insertAfter && aOptions.insertAfter.id,
      dontMove:         !!aOptions.dontMove,
      dontUpdateIndent: !!aOptions.dontUpdateIndent,
      forceExpand:      !!aOptions.forceExpand,
      dontExpand:       !!aOptions.dontExpand,
      justNow:          !!aOptions.justNow,
      broadcasted:      !!aOptions.broadcast,
      stack:            new Error().stack
    });
  }
}

function getReferenceTabsForNewChild(aChild, aParent, aOptions = {}) {
  var insertAt = aOptions.insertAt;
  if (typeof insertAt !== 'number')
    insertAt = configs.insertNewChildAt;
  var descendants = getDescendantTabs(aParent);
  if (aOptions.ignoreTabs)
    descendants = descendants.filter(aTab => aOptions.ignoreTabs.indexOf(aTab) < 0);
  var insertBefore, insertAfter;
  if (descendants.length > 0) {
    let firstChild     = descendants[0];
    let lastDescendant = descendants[descendants.length-1];
    switch (insertAt) {
      case kINSERT_END:
      default:
        insertAfter = lastDescendant;
        break;
      case kINSERT_FIRST:
        insertBefore = firstChild;
        break;
      case kINSERT_NEAREST: {
        let allTabs = getTabs(aParent);
        if (aOptions.ignoreTabs)
          allTabs = allTabs.filter(aTab => aOptions.ignoreTabs.indexOf(aTab) < 0);
        let index = allTabs.indexOf(aChild);
        if (index < allTabs.indexOf(firstChild)) {
          insertBefore = firstChild;
          insertAfter  = aParent;
        }
        else if (index > allTabs.indexOf(lastDescendant)) {
          insertAfter  = lastDescendant;
        }
        else { // inside the tree
          let children = getChildTabs(aParent);
          if (aOptions.ignoreTabs)
            children = children.filter(aTab => aOptions.ignoreTabs.indexOf(aTab) < 0);
          for (let child of children) {
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
    insertAfter = aParent;
  }
  // disallow to place tab in invalid position
  if (insertBefore) {
    if (getTabIndex(insertBefore) <= getTabIndex(aParent)) {
      insertBefore = null;
    }
    //TODO: we need to reject more cases...
  }
  if (insertAfter) {
    let allTabsInTree = [aParent].concat(descendants);
    let lastMember    = allTabsInTree[allTabsInTree.length - 1];
    if (getTabIndex(insertAfter) >= getTabIndex(lastMember)) {
      insertAfter = lastMember;
    }
    //TODO: we need to reject more cases...
  }
  return { insertBefore, insertAfter };
}

function detachTab(aChild, aOptions = {}) {
  log('detachTab: ', dumpTab(aChild), aOptions,
      `${new Error().stack}\n${aOptions.stack || ''}`);
  var parent = getParentTab(aChild);

  if (!parent)
    log('parent is already removed, or orphan tab');

  if (parent) {
    let childIds = (parent.getAttribute(kCHILDREN) || '').split('|').filter((aId) => aId && aId != aChild.id);
    if (childIds.length == 0) {
      parent.removeAttribute(kCHILDREN);
      log('no more child');
    }
    else {
      parent.setAttribute(kCHILDREN, `|${childIds.join('|')}|`);
      log('rest children: ', childIds);
    }
    updateParentTab(parent);
  }
  aChild.removeAttribute(kPARENT);

  updateTabsIndent(aChild);

  window.onTabDetached && onTabDetached(aChild, {
    oldParentTab: parent
  });

  if (aOptions.inRemote || aOptions.broadcast) {
    browser.runtime.sendMessage({
      type:        kCOMMAND_DETACH_TAB,
      windowId:    aChild.apiTab.windowId,
      tab:         aChild.id,
      broadcasted: !!aOptions.broadcast,
      stack:       new Error().stack
    });
  }
}

function detachTabsFromTree(aTabs, aOptions = {}) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];
  aTabs = Array.slice(aTabs).reverse();
  for (let tab of aTabs) {
    let children = getChildTabs(tab);
    let parent   = getParentTab(tab);
    for (let child of children) {
      if (aTabs.indexOf(child) < 0) {
        if (parent)
          attachTabTo(child, parent, clone(aOptions, {
            dontMove: true
          }));
        else
          detachTab(child, aOptions);
      }
    }
  }
}

function detachAllChildren(aTab, aOptions = {}) {
  var children = getChildTabs(aTab);
  if (!children.length)
    return;

  if (!('behavior' in aOptions))
    aOptions.behavior = kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN;
  if (aOptions.behavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    aOptions.behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  aOptions.dontUpdateInsertionPositionInfo = true;

  var parent = getParentTab(aTab);
  if (isGroupTab(aTab) &&
      getTabs(aTab).filter((aTab) => aTab.removing).length == children.length) {
    aOptions.behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
    aOptions.dontUpdateIndent = false;
  }

  var nextTab = null;
  if (aOptions.behavior == kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN &&
      !configs.moveTabsToBottomWhenDetachedFromClosedParent) {
    nextTab = getNextSiblingTab(getRootTab(aTab));
  }

  if (aOptions.behavior == kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB) {
    // open new group tab and replace the detaching tab with it.
    aOptions.behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
  }

  if (aOptions.behavior != kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN)
    collapseExpandSubtree(aTab, clone(aOptions, {
      collapsed: false
    }));

  for (let i = 0, maxi = children.length; i < maxi; i++) {
    let child = children[i];
    if (aOptions.behavior == kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN) {
      detachTab(child, aOptions);
      moveTabSubtreeBefore(child, nextTab, aOptions);
    }
    else if (aOptions.behavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD) {
      detachTab(child, aOptions);
      if (i == 0) {
        if (parent) {
          attachTabTo(child, parent, clone(aOptions, {
            dontExpan: true,
            dontMove:  true
          }));
        }
        collapseExpandSubtree(child, clone(aOptions, {
          collapsed: false
        }));
        //deleteTabValue(child, kTAB_STATE_SUBTREE_COLLAPSED);
      }
      else {
        attachTabTo(child, children[0], clone(aOptions, {
          dontExpand: true,
          dontMove:   true
        }));
      }
    }
    else if (aOptions.behavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN && parent) {
      attachTabTo(child, parent, clone(aOptions, {
        dontExpand: true,
        dontMove:   true
      }));
    }
    else { // aOptions.behavior == kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN
      detachTab(child, aOptions);
    }
  }
}

async function behaveAutoAttachedTab(aTab, aOptions = {}) {
  var baseTab = aOptions.baseTab || getCurrentTab(gTargetWindow || aTab);
  log('behaveAutoAttachedTab ', dumpTab(aTab), dumpTab(baseTab), aOptions);
  switch (aOptions.behavior) {
    default:
      break;

    case kNEWTAB_OPEN_AS_ORPHAN:
      detachTab(aTab, {
        inRemote:  aOptions.inRemote,
        broadcast: aOptions.broadcast
      });
      if (getNextTab(aTab))
        await moveTabAfter(aTab, getLastTab(), {
          delayedMove: true,
          inRemote: aOptions.inRemote
        });
      break;

    case kNEWTAB_OPEN_AS_CHILD:
      await attachTabTo(aTab, baseTab, {
        dontMove:    aOptions.dontMove || configs.insertNewChildAt == kINSERT_NO_CONTROL,
        forceExpand: true,
        delayedMove: true,
        inRemote:    aOptions.inRemote,
        broadcast:   aOptions.broadcast
      });
      return true;
      break;

    case kNEWTAB_OPEN_AS_SIBLING: {
      let parent = getParentTab(baseTab);
      if (parent) {
        await attachTabTo(aTab, parent, {
          delayedMove: true,
          inRemote:  aOptions.inRemote,
          broadcast: aOptions.broadcast
        });
      }
      else {
        detachTab(aTab, {
          inRemote:  aOptions.inRemote,
          broadcast: aOptions.broadcast
        });
        await moveTabAfter(aTab, getLastDescendantTab(baseTab) || getLastTab(), {
          delayedMove: true,
          inRemote: aOptions.inRemote
        });
      }
      return true;
    }; break;

    case kNEWTAB_OPEN_AS_NEXT_SIBLING: {
      let nextSibling = getNextSiblingTab(baseTab);
      if (nextSibling == aTab)
        nextSibling = null;
      let parent = getParentTab(baseTab);
      if (parent)
        await attachTabTo(aTab, parent, {
          insertBefore: nextSibling,
          insertAfter:  getLastDescendantTab(baseTab),
          delayedMove:  true,
          inRemote:     aOptions.inRemote,
          broadcast:    aOptions.broadcast
        });
      else {
        detachTab(aTab, {
          inRemote:  aOptions.inRemote,
          broadcast: aOptions.broadcast
        });
        if (nextSibling)
          await moveTabBefore(aTab, nextSibling, {
            delayedMove: true,
            inRemote:  aOptions.inRemote,
            broadcast: aOptions.broadcast
          });
        else
          await moveTabAfter(aTab, getLastDescendantTab(baseTab), {
            delayedMove: true,
            inRemote:  aOptions.inRemote,
            broadcast: aOptions.broadcast
          });
      }
    }; break;
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
    item.setAttribute(kLEVEL, aLevel);
    updateTabsIndent(getChildTabs(item), aLevel + 1);
  }
}


// collapse/expand tabs

function shouldTabAutoExpanded(aTab) {
  return hasChildTabs(aTab) && isSubtreeCollapsed(aTab);
}

async function collapseExpandSubtree(aTab, aParams = {}) {
  aParams.collapsed = !!aParams.collapsed;
  if (!aTab)
    return;
  if (aParams.inRemote || aParams.broadcast) {
    await browser.runtime.sendMessage({
      type:            kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE,
      windowId:        aTab.parentNode.windowId,
      tab:             aTab.id,
      collapsed:       aParams.collapsed,
      manualOperation: !!aParams.manualOperation,
      justNow:         !!aParams.justNow,
      broadcasted:     !!aParams.broadcast
    });
    if (aParams.inRemote)
      return;
  }
  if (!aTab.parentNode) // it was removed while waiting
    return;
  log('collapseExpandSubtree: ', dumpTab(aTab), isSubtreeCollapsed(aTab), aParams);
  var container = aTab.parentNode;
  container.doingCollapseExpandCount++;
  await collapseExpandSubtreeInternal(aTab, aParams);
  container.doingCollapseExpandCount--;
}
function collapseExpandSubtreeInternal(aTab, aParams = {}) {
  if (!aParams.force &&
      isSubtreeCollapsed(aTab) == aParams.collapsed)
    return;

  var container = getTabsContainer(aTab);

  if (aParams.collapsed) {
    aTab.classList.add(kTAB_STATE_SUBTREE_COLLAPSED);
    aTab.classList.remove(kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
  }
  else {
    aTab.classList.remove(kTAB_STATE_SUBTREE_COLLAPSED);
  }
  //setTabValue(aTab, kTAB_STATE_SUBTREE_COLLAPSED, aParams.collapsed);

  var childTabs = getChildTabs(aTab);
  var lastExpandedTabIndex = childTabs.length - 1;
  for (let i = 0, maxi = childTabs.length; i < maxi; i++) {
    let childTab = childTabs[i];
    if (!aParams.collapsed &&
        !aParams.justNow &&
        i == lastExpandedTabIndex) {
      collapseExpandTabAndSubtree(childTab, {
        collapsed: aParams.collapsed,
        justNow:   aParams.justNow,
        anchor:    aTab,
        last:      true,
        broadcast: false
      });
    }
    else {
      collapseExpandTabAndSubtree(childTab, {
        collapsed: aParams.collapsed,
        justNow:   aParams.justNow,
        broadcast: false
      });
    }
  }

  window.onTabSubtreeCollapsedStateChanging &&
    onTabSubtreeCollapsedStateChanging(aTab);
}

function manualCollapseExpandSubtree(aTab, aParams = {}) {
  aParams.manualOperation = true;
  collapseExpandSubtree(aTab, aParams);
  if (!aParams.collapsed) {
    aTab.classList.add(kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
    //setTabValue(aTab, kTAB_STATE_SUBTREE_EXPANDED_MANUALLY, true);
  }
}

function collapseExpandTabAndSubtree(aTab, aParams = {}) {
  if (!aTab)
    return;

  var parent = getParentTab(aTab);
  if (!parent)
    return;

  collapseExpandTab(aTab, aParams);

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
    let children = getChildTabs(aTab);
    children.forEach((aChild, aIndex) => {
      var last = aParams.last &&
                   (aIndex == children.length - 1);
      collapseExpandTabAndSubtree(aChild, clone(aParams, {
        collapsed: aParams.collapsed,
        justNow:   aParams.justNow,
        anchor:    last && aParams.anchor,
        last:      last,
        broadcast: aParams.broadcast
      }));
    });
  }
}

function collapseExpandTab(aTab, aParams = {}) {
  if (aParams.collapsed)
    aTab.classList.add(kTAB_STATE_COLLAPSED);
  else
    aTab.classList.remove(kTAB_STATE_COLLAPSED);

  var last = aParams.last &&
               (!hasChildTabs(aTab) || isSubtreeCollapsed(aTab));
  window.onTabCollapsedStateChanging &&
    window.onTabCollapsedStateChanging(aTab, clone(aParams, {
      anchor: last && aParams.anchor,
      last:   last
    }));

  if (aParams.broadcast && !aParams.broadcasted) {
    browser.runtime.sendMessage({
      type:      kCOMMAND_CHANGE_TAB_COLLAPSED_STATE,
      windowId:  aTab.apiTab.windowId,
      tab:       aTab.id,
      justNow:   aParams.justNow,
      collapsed: aParams.collapsed,
      byAncestor: getAncestorTabs(aTab).some(isSubtreeCollapsed) == aParams.collapsed
    });
  }
}

function collapseExpandTreesIntelligentlyFor(aTab, aOptions = {}) {
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
    let parentTab    = getParentTab(collapseTab);
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
      collapseExpandSubtree(collapseTab, clone(aOptions, {
        collapsed: true
      }));
  }

  collapseExpandSubtree(aTab, clone(aOptions, {
    collapsed: false
  }));
}


// operate tabs based on tree information

/*
 * By https://bugzilla.mozilla.org/show_bug.cgi?id=1366290 when the
   current tab is closed, Firefox notifies tabs.onTabRemoved at first
   and tabs.onActivated at later.
 * Basically the next (right) tab will be focused when the current tab
   is closed, except the closed tab was the last tab.
   * If the closed current tab was the last tab, then the previous tab
     is focused.
 * However, if the tab has "owner", it will be focused instead of the
   right tab if `browser.tabs.selectOwnerOnClose` == `true`.
   * The owner tab must be one of preceding tabs, because Firefox never
     open tab leftside (by default).
     So, if the next (right) tab is focused, it definitely caused by
     the closing of the current tab - except "switch to tab" command
     from the location bar.
     https://bugzilla.mozilla.org/show_bug.cgi?id=1405262
     https://github.com/piroor/treestyletab/issues/1409

So, if I ignore the bug 1405262 / issue #1409 case, "the next (right)
tab is focused after the current (active) tab is closed" means that the
focus move is unintentional and TST can override it.
*/
function tryMoveFocusFromClosingCurrentTab(aTab) {
  log('tryMoveFocusFromClosingCurrentTab', dumpTab(aTab));
  if (!isActive(aTab)) {
    log(' => not active tab');
    return;
  }
  aTab.parentNode.focusRedirectedForClosingCurrentTab = tryMoveFocusFromClosingCurrentTabOnFocusRedirected(aTab);
}
async function tryMoveFocusFromClosingCurrentTabOnFocusRedirected(aTab) {
  log('tryMoveFocusFromClosingCurrentTabOnFocusRedirected ', dumpTab(aTab));

  // The aTab can be closed while we waiting.
  // Thus we need to get tabs related to aTab at first.
  var params      = getTryMoveFocusFromClosingCurrentTabNowParams(aTab);
  var nextTab     = getNextTab(aTab);
  var previousTab = getPreviousTab(aTab);

  await aTab.closedWhileActive;
  log('tryMoveFocusFromClosingCurrentTabOnFocusRedirected: tabs.onActivated is fired');

  var autoFocusedTab = getCurrentTab(aTab.apiTab.windowId);
  if (autoFocusedTab != nextTab &&
      (autoFocusedTab != previousTab ||
       getNextTab(autoFocusedTab))) {
    log('=> the tab seems focused intentionally: ', {
      autoFocused:       dumpTab(autoFocusedTab),
      nextOfAutoFocused: dumpTab(getNextTab(autoFocusedTab)),
      prev:              dumpTab(previousTab),
      next:              dumpTab(nextTab)
    });
    return false;
  }
  return tryMoveFocusFromClosingCurrentTabNow(aTab, { params });
}
function getTryMoveFocusFromClosingCurrentTabNowParams(aTab) {
  var parentTab = getParentTab(aTab);
  return {
    active:                    isActive(aTab),
    parentTab,
    firstChildTab:             getFirstChildTab(aTab),
    firstChildTabOfParent:     getFirstChildTab(parentTab),
    lastChildTabOfParent:      getLastChildTab(parentTab),
    previousSiblingTab:        getPreviousSiblingTab(aTab),
    preDetectedNextFocusedTab: getNextFocusedTab(aTab),
    serialized:                serializeTabForTSTAPI(aTab),
    closeParentBehavior:       getCloseParentBehaviorForTab(aTab, { parentTab })
  };
}

async function tryMoveFocusFromClosingCurrentTabNow(aTab, aOptions = {}) {
  var params = aOptions.params || getTryMoveFocusFromClosingCurrentTabNowParams(aTab);
  if (aOptions.ignoredTabs)
    params.ignoredTabs = aOptions.ignoredTabs;
  var {
    active,
    parentTab, firstChildTab, firstChildTabOfParent, lastChildTabOfParent,
    previousSiblingTab, preDetectedNextFocusedTab,
    ignoredTabs,
    serialized, closeParentBehavior
  } = params;
  log('tryMoveFocusFromClosingCurrentTabNow ', params);
  if (!active) {
    log(' => not active tab');
    return false;
  }

  var results = await sendTSTAPIMessage({
    type:   kTSTAPI_NOTIFY_TRY_MOVE_FOCUS_FROM_CLOSING_CURRENT_TAB,
    tab:    serialized,
    window: aTab.apiTab.windowId
  });
  if (results.some(aResult => aResult.result)) // canceled
    return false;

  var nextFocusedTab = null;
  if (firstChildTab &&
      (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN ||
       closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD))
    nextFocusedTab = firstChildTab;
  log('focus to first child?: ', !!nextFocusedTab);

  ignoredTabs = ignoredTabs || [];
  if (parentTab) {
    if (!nextFocusedTab && aTab == lastChildTabOfParent) {
      if (aTab == firstChildTabOfParent) { // this is the really last child
        nextFocusedTab = parentTab;
        log('focus to parent?: ', !!nextFocusedTab);
      }
      else {
        nextFocusedTab = previousSiblingTab;
        log('focus to previous sibling?: ', !!nextFocusedTab);
      }
    }
    if (nextFocusedTab && ignoredTabs.indexOf(nextFocusedTab) > -1)
      nextFocusedTab = getNextFocusedTab(parentTab, { ignoredTabs });
  }
  else if (!nextFocusedTab) {
    nextFocusedTab = preDetectedNextFocusedTab;
    log('focus to getNextFocusedTab()?: ', !!nextFocusedTab);
  }
  if (nextFocusedTab && ignoredTabs.indexOf(nextFocusedTab) > -1) {
    nextFocusedTab = getNextFocusedTab(nextFocusedTab, { ignoredTabs });
    log('focus to getNextFocusedTab() again?: ', !!nextFocusedTab);
  }

  if (!nextFocusedTab ||
      isHidden(nextFocusedTab) ||
      isActive(nextFocusedTab))
    return false;

  log('focus to: ', dumpTab(nextFocusedTab));
  await selectTabInternally(nextFocusedTab);
  return true;
}

function getCloseParentBehaviorForTab(aTab, aOptions = {}) {
  if (!aOptions.asIndividualTab &&
      isSubtreeCollapsed(aTab) &&
      !aOptions.keepChildren)
    return kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN;

  var behavior = configs.closeParentBehavior;
  var parentTab = aOptions.parent || getParentTab(aTab);

  if (aOptions.keepChildren &&
      behavior != kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
      behavior != kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN)
    behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  if (!parentTab &&
      behavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN &&
      configs.promoteFirstChildForClosedRoot)
    behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  // Promote all children to upper level, if this is the last child of the parent.
  // This is similar to "taking by representation".
  if (behavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
      parentTab &&
      getChildTabs(parentTab).length == 1 &&
      configs.promoteAllChildrenWhenClosedParentIsLastChild)
    behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;

  return behavior;
}


async function moveTabSubtreeBefore(aTab, aNextTab, aOptions = {}) {
  if (!aTab)
    return;
  if (isAllTabsPlacedBefore([aTab].concat(getDescendantTabs(aTab)), aNextTab)) {
    log('moveTabSubtreeBefore:no need to move');
    return;
  }

  log('moveTabSubtreeBefore: ', dumpTab(aTab), dumpTab(aNextTab));
  var container = aTab.parentNode;
  container.subTreeMovingCount++;
  try {
    await moveTabInternallyBefore(aTab, aNextTab, aOptions);
    if (!aTab.parentNode) // it is removed while waiting
      throw new Error('the tab was removed before moving of descendants');
    await followDescendantsToMovedRoot(aTab, aOptions);
  }
  catch(e) {
    log(`failed to move subtree: ${String(e)}`);
  }
  await wait(0);
  if (!container.parentNode) // it was removed while waiting
    return;
  container.subTreeMovingCount--;
}

async function moveTabSubtreeAfter(aTab, aPreviousTab, aOptions = {}) {
  if (!aTab)
    return;
  if (isAllTabsPlacedAfter([aTab].concat(getDescendantTabs(aTab)), aPreviousTab)) {
    log('moveTabSubtreeAfter:no need to move');
    return;
  }

  log('moveTabSubtreeAfter: ', dumpTab(aTab), dumpTab(aPreviousTab));
  var container = aTab.parentNode;
  container.subTreeMovingCount++;
  try {
    await moveTabInternallyAfter(aTab, aPreviousTab, aOptions);
    if (!aTab.parentNode) // it is removed while waiting
      throw new Error('the tab was removed before moving of descendants');
    await followDescendantsToMovedRoot(aTab, aOptions);
  }
  catch(e) {
    log(`failed to move subtree: ${String(e)}`);
  }
  await wait(0);
  if (!container.parentNode) // it was removed while waiting
    return;
  container.subTreeMovingCount--;
}

async function followDescendantsToMovedRoot(aTab, aOptions = {}) {
  if (!hasChildTabs(aTab))
    return;

  log('followDescendantsToMovedRoot: ', dumpTab(aTab));
  var container = aTab.parentNode;
  container.subTreeChildrenMovingCount++;
  container.subTreeMovingCount++;
  await moveTabsAfter(getDescendantTabs(aTab), aTab, aOptions);
  container.subTreeChildrenMovingCount--;
  container.subTreeMovingCount--;
}

async function moveTabs(aTabs, aOptions = {}) {
  if (aTabs.length == 0)
    return [];

  log('moveTabs: ', aTabs.map(dumpTab), aOptions);

  var windowId = aTabs[0].parentNode.windowId || gTargetWindow;

  var newWindow = aOptions.destinationPromisedNewWindow;

  var destinationWindowId = aOptions.destinationWindowId;
  if (!destinationWindowId && !newWindow)
    destinationWindowId = gTargetWindow;

  var isAcrossWindows = windowId != destinationWindowId || !!newWindow;

  aOptions.insertAfter = aOptions.insertAfter || getLastTab(destinationWindowId);

  if (aOptions.inRemote) {
    let response = await browser.runtime.sendMessage(clone(aOptions, {
      type:                kCOMMAND_MOVE_TABS,
      windowId:            windowId,
      tabs:                aTabs.map(aTab => aTab.id),
      insertBefore:        aOptions.insertBefore && aOptions.insertBefore.id,
      insertAfter:         aOptions.insertAfter && aOptions.insertAfter.id,
      duplicate:           !!aOptions.duplicate,
      destinationWindowId: destinationWindowId,
      inRemote:            false
    }));
    return (response.movedTabs || []).map(getTabById).filter(aTab => !!aTab);
  }

  var movedTabs = aTabs;
  var structure = getTreeStructureFromTabs(aTabs);
  log('original tree structure: ', structure);

  if (isAcrossWindows || aOptions.duplicate) {
    blockUserOperationsIn(windowId, { throbber: true });
    try {
      let container;
      let prepareContainer = () => {
        container = getTabsContainer(destinationWindowId);
        if (!container) {
          container = buildTabsContainerFor(destinationWindowId);
          gAllTabs.appendChild(container);
        }
        if (isAcrossWindows) {
          container.toBeOpenedTabsWithPositions += aTabs.length;
          container.toBeOpenedOrphanTabs        += aTabs.length;
          container.toBeAttachedTabs            += aTabs.length;
        }
      };
      if (newWindow) {
        newWindow = newWindow.then(aWindow => {
          log('moveTabs: destination window is ready, ', aWindow);
          destinationWindowId = aWindow.id;
          prepareContainer();
          return aWindow;
        });
      }
      else {
        prepareContainer();
      }

      let apiTabIds = aTabs.map(aTab => aTab.apiTab.id);
      await Promise.all([
        newWindow,
        (async () => {
          let sourceContainer = aTabs[0].parentNode;
          if (aOptions.duplicate) {
            sourceContainer.toBeOpenedTabsWithPositions += aTabs.length;
            sourceContainer.toBeOpenedOrphanTabs        += aTabs.length;
            sourceContainer.duplicatingTabsCount        += aTabs.length;
          }
          if (isAcrossWindows)
            sourceContainer.toBeDetachedTabs += aTabs.length;

          log('preparing tabs');
          if (aOptions.duplicate) {
            let startTime = Date.now();
            // This promise will be resolved with very large delay.
            // (See also https://bugzilla.mozilla.org/show_bug.cgi?id=1394376 )
            let promisedDuplicatedIds = Promise.all(apiTabIds.map(async (aId, aIndex) => {
              try {
                return (await browser.tabs.duplicate(aId)).id;
              }
              catch(e) {
                handleMissingTabError(e);
                return null;
              }
            })).then(aIds => {
              log(`ids from API responses are resolved in ${Date.now() - startTime}msec: `, aIds);
              return aIds;
            });
            if (configs.acccelaratedTabDuplication) {
              // So, I collect duplicating tabs in different way.
              // This promise will be resolved when they actually
              // appear in the tab bar. This hack should be removed
              // after the bug 1394376 is fixed.
              let promisedDuplicatingIds = (async () => {
                while (true) {
                  await wait(100);
                  let tabs = getDuplicatingTabs(windowId);
                  if (tabs.length < apiTabIds.length)
                    continue; // not opened yet
                  let tabIds = tabs.map(aTab => aTab.apiTab.id);
                  if (tabIds.join(',') == tabIds.sort().join(','))
                    continue; // not sorted yet
                  return tabIds;
                }
              })().then(aIds => {
                log(`ids from duplicating tabs are resolved in ${Date.now() - startTime}msec: `, aIds);
                return aIds;
              });
              apiTabIds = await Promise.race([
                promisedDuplicatedIds,
                promisedDuplicatingIds
              ]);
            }
            else {
              apiTabIds = await promisedDuplicatedIds;
            }
          }
        })()
      ]);
      log('moveTabs: all windows and tabs are ready, ', apiTabIds, destinationWindowId);
      let toIndex = getAllTabs(container).length;
      log('toIndex = ', toIndex);
      if (aOptions.insertBefore &&
          aOptions.insertBefore.apiTab.windowId == destinationWindowId) {
        try {
          let latestApiTab = await browser.tabs.get(aOptions.insertBefore.apiTab.id);
          toIndex = latestApiTab.index;
        }
        catch(e) {
          handleMissingTabError(e);
          log('aOptions.insertBefore is unavailable');
        }
      }
      else if (aOptions.insertAfter &&
               aOptions.insertAfter.apiTab.windowId == destinationWindowId) {
        try {
          let latestApiTab = await browser.tabs.get(aOptions.insertAfter.apiTab.id);
          toIndex = latestApiTab.index + 1;
        }
        catch(e) {
          handleMissingTabError(e);
          log('aOptions.insertAfter is unavailable');
        }
      }
      if (!isAcrossWindows &&
          aTabs[0].apiTab.index < toIndex)
        toIndex--;
      log(' => ', toIndex);
      if (isAcrossWindows) {
        for (let tab of aTabs) {
          if (!isActive(tab))
            continue;
          await tryMoveFocusFromClosingCurrentTabNow(tab, { ignoredTabs: aTabs });
          break;
        }
        apiTabIds = await safeMoveApiTabsAcrossWindows(apiTabIds, {
          windowId: destinationWindowId,
          index:    toIndex
        });
        apiTabIds = apiTabIds.map(aApiTab => aApiTab.id);
        log('moved across windows: ', apiTabIds);
      }

      log('applying tree structure', structure);
      // wait until tabs.onCreated are processed (for safety)
      let newTabs;
      let startTime = Date.now();
      let maxDelay = configs.maximumAcceptableDelayForTabDuplication;
      while (Date.now() - startTime < maxDelay) {
        newTabs = apiTabIds.map(aApiTabId => {
        // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1398272
          var correctId = gTabIdWrongToCorrect[aApiTabId];
          if (correctId)
            aApiTabId = correctId;
          return getTabById(aApiTabId);
        });
        newTabs = newTabs.filter(aTab => !!aTab);
        if (newTabs.length < aTabs.length ||
            container.processingNewTabsCount > 0) {
          log('retrying: ', apiTabIds, newTabs.length, aTabs.length);
          await wait(100);
          continue;
        }
        await applyTreeStructureToTabs(newTabs, structure, {
          broadcast: true
        });
        if (aOptions.duplicate) {
          for (let tab of newTabs) {
            tab.classList.remove(kTAB_STATE_DUPLICATING);
            broadcastTabState(tab, {
              remove: [kTAB_STATE_DUPLICATING]
            });
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
      unblockUserOperationsIn(windowId, { throbber: true });
    }
  }


  if (aOptions.insertBefore) {
    await moveTabsBefore(movedTabs, aOptions.insertBefore, aOptions);
  }
  else if (aOptions.insertAfter) {
    await moveTabsAfter(movedTabs, aOptions.insertAfter, aOptions);
  }
  else {
    log('no move: just duplicate or import');
  }
  // Tabs can be removed while waiting, so we need to
  // refresh the array of tabs.
  movedTabs = movedTabs.map(aTab => getTabById(aTab.id));
  movedTabs = movedTabs.filter(aTab => !!aTab);

  return movedTabs;
}

async function moveTab(aTab, aOptions = {}) {
  var tabs = await moveTabs([aTab], aOptions);
  return tabs[0];
}

async function openNewWindowFromTabs(aTabs, aOptions = {}) {
  if (aTabs.length == 0)
    return [];

  log('openNewWindowFromTabs: ', aTabs.map(dumpTab), aOptions);

  var windowId = aTabs[0].parentNode.windowId || gTargetWindow;

  if (aOptions.inRemote) {
    let response = await browser.runtime.sendMessage(clone(aOptions, {
      type:      kCOMMAND_NEW_WINDOW_FROM_TABS,
      windowId:  windowId,
      tabs:      aTabs.map(aTab => aTab.id),
      duplicate: !!aOptions.duplicate,
      left:      'left' in aOptions ? parseInt(aOptions.left) : null,
      top:       'top' in aOptions ? parseInt(aOptions.top) : null,
      inRemote:  false
    }));
    return (response.movedTabs || []).map(getTabById).filter(aTab => !!aTab);
  }

  log('opening new window');
  var windowParams = {
    //focused: true,  // not supported in Firefox...
    url: 'about:blank'
  };
  if ('left' in aOptions && aOptions.left !== null)
    windowParams.left = aOptions.left;
  if ('top' in aOptions && aOptions.top !== null)
    windowParams.top = aOptions.top;
  var newWindow;
  var promsiedNewWindow = browser.windows.create(windowParams)
    .then(aNewWindow => {
      newWindow = aNewWindow;
      log('openNewWindowFromTabs: new window is ready, ', newWindow);
      blockUserOperationsIn(newWindow.id);
      return newWindow;
    });
  var movedTabs = await moveTabs(aTabs, clone(aOptions, {
    destinationPromisedNewWindow: promsiedNewWindow
  }));

  log('closing needless tabs');
  browser.windows.get(newWindow.id, { populate: true })
    .then(aApiWindow => {
      var movedTabIds = movedTabs.map(aTab => aTab.apiTab.id);
      log('moved tabs: ', movedTabIds);
      // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1398272
      var allTabIdsInWindow = aApiWindow.tabs.map(aApiTab => {
        var id = aApiTab.id;
        var correctId = gTabIdWrongToCorrect[id];
        if (correctId)
          return correctId;
        else
          return id;
      });
      var removeIds = allTabIdsInWindow.filter(aId => movedTabIds.indexOf(aId) < 0);
      log('removing tabs: ', removeIds);
      browser.tabs.remove(removeIds)
        .catch(handleMissingTabError); // already removed
      unblockUserOperationsIn(newWindow.id);
    });

  return movedTabs;
}


// drag and drop helper

async function performTabsDragDrop(aParams = {}) {
  var windowId = aParams.windowId || gTargetWindow;
  var destinationWindowId = aParams.destinationWindowId || windowId;

  if (aParams.inRemote) {
    browser.runtime.sendMessage(clone(aParams, {
      type:         kCOMMAND_PERFORM_TABS_DRAG_DROP,
      windowId:     windowId,
      attachTo:     aParams.attachTo && aParams.attachTo.id,
      insertBefore: aParams.insertBefore && aParams.insertBefore.id,
      insertAfter:  aParams.insertAfter && aParams.insertAfter.id,
      inRemote:     false,
      destinationWindowId
    }));
    return;
  }

  log('performTabsDragDrop ', {
    tabIds:              aParams.tabIds,
    windowId:            aParams.windowId,
    destinationWindowId: aParams.destinationWindowId,
    action:              aParams.action
  });

  var draggedTabs = aParams.tabIds.map(getTabById).filter(aTab => !!aTab);
  if (!draggedTabs.length)
    return;

  var draggedRoots = collectRootTabs(draggedTabs);
  var targetTabs   = getTabs(windowId);

  var draggedWholeTree = [].concat(draggedRoots);
  for (let draggedRoot of draggedRoots) {
    let descendants = getDescendantTabs(draggedRoot);
    for (let descendant of descendants) {
      if (draggedWholeTree.indexOf(descendant) < 0)
        draggedWholeTree.push(descendant);
    }
  }
  log('=> draggedTabs: ', draggedTabs.map(dumpTab).join(' / '));

  if (draggedWholeTree.length != draggedTabs.length) {
    log('=> partially dragged');
    if (!aParams.duplicate)
      detachTabsFromTree(draggedTabs, {
        broadcast: true
      });
  }

  while (aParams.insertBefore &&
         draggedWholeTree.indexOf(aParams.insertBefore) > -1) {
    aParams.insertBefore = getNextTab(aParams.insertBefore);
  }
  while (aParams.insertAfter &&
         draggedWholeTree.indexOf(aParams.insertAfter) > -1) {
    aParams.insertAfter = getPreviousTab(aParams.insertAfter);
  }

  if (aParams.duplicate ||
      windowId != destinationWindowId) {
    draggedTabs = await moveTabs(draggedTabs, {
      destinationWindowId,
      duplicate:    aParams.duplicate,
      insertBefore: aParams.insertBefore,
      insertAfter:  aParams.insertAfter
    });
    draggedRoots = collectRootTabs(draggedTabs);
  }

  log('try attach/detach');
  if (!aParams.attachTo) {
    log('=> detach');
    detachTabsOnDrop(draggedRoots, {
      broadcast: true
    });
  }
  else if (aParams.action & kACTION_ATTACH) {
    log('=> attach');
    await attachTabsOnDrop(draggedRoots, aParams.attachTo, {
      insertBefore: aParams.insertBefore,
      insertAfter:  aParams.insertAfter,
      draggedTabs:  draggedTabs,
      broadcast:    true
    });
  }
  else {
    log('=> just moved');
  }

  log('=> moving dragged tabs ', draggedTabs.map(dumpTab));
  if (aParams.insertBefore)
    await moveTabsBefore(draggedTabs, aParams.insertBefore);
  else if (aParams.insertAfter)
    await moveTabsAfter(draggedTabs, aParams.insertAfter);
  else
    log('=> already placed at expected position');

  browser.tabs.update(draggedTabs[0].apiTab.id, { active: true });
  var treeStructure = getTreeStructureFromTabs(draggedTabs);

  var newTabs;
  /*
  var replacedGroupTabs = doAndGetNewTabs(() => {
    newTabs = moveTabsInternal(draggedTabs, {
      duplicate    : aParams.duplicate,
      insertBefore : aParams.insertBefore,
      insertAfter  : aParams.insertAfter,
      inRemote     : true
    });
  });
  log('=> opened group tabs: ', replacedGroupTabs);
  aParams.draggedTab.ownerDocument.defaultView.setTimeout(() => {
    if (!aTab.parentNode) // it was removed while waiting
      return;
    log('closing needless group tabs');
    replacedGroupTabs.reverse().forEach(function(aTab) {
      log(' check: ', aTab.label+'('+aTab._tPos+') '+getLoadingURI(aTab));
      if (isGroupTab(aTab) &&
        !hasChildTabs(aTab))
        removeTab(aTab);
    }, this);
  }, 0);
  */

  /*
  if (newTabs.length && aParams.action & kACTION_ATTACH) {
    Promise.all(newTabs.map((aTab) => aTab.__treestyletab__promisedDuplicatedTab))
      .then((function() {
        log('   => attach (last)');
        await attachTabsOnDrop(
          newTabs.filter(function(aTab, aIndex) {
            return treeStructure[aIndex] == -1;
          }),
          aParams.attachTo,
          { insertBefore: aParams.insertBefore,
            insertAfter:  aParams.insertAfter }
        );
      }).bind(this));
  }
  */

  log('=> finished');
}

async function attachTabsOnDrop(aTabs, aParent, aOptions = {}) {
  log('attachTabsOnDrop: start ', aTabs.map(dumpTab));
  if (aParent && !aOptions.insertBefore && !aOptions.insertAfter) {
    let refTabs = getReferenceTabsForNewChild(aTabs[0], aParent, {
      ignoreTabs: aTabs
    });
    aOptions.insertBefore = refTabs.insertBefore;
    aOptions.insertAfter  = refTabs.insertAfter;
  }

  if (aOptions.insertBefore)
    await moveTabsBefore(aOptions.draggedTabs || aTabs, aOptions.insertBefore);
  else if (aOptions.insertAfter)
    await moveTabsAfter(aOptions.draggedTabs || aTabs, aOptions.insertAfter);

  var memberOptions = clone(aOptions, {
    insertBefore: null,
    insertAfter:  null,
    dontMove:     true
  });
  for (let tab of aTabs) {
    if (aParent)
      attachTabTo(tab, aParent, memberOptions);
    else
      detachTab(tab, memberOptions);
    collapseExpandTabAndSubtree(tab, clone(memberOptions, {
      collapsed: false
    }));
  }
}

function detachTabsOnDrop(aTabs, aOptions = {}) {
  log('detachTabsOnDrop: start ', aTabs.map(dumpTab));
  for (let tab of aTabs) {
    detachTab(tab, aOptions);
    collapseExpandTabAndSubtree(tab, clone(aOptions, {
      collapsed: false
    }));
  }
}


// set/get tree structure

function getTreeStructureFromTabs(aTabs, aOptions = {}) {
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
    var tab = aTabs[aIndex];
    var item = {
      parent:    aParentIndex,
      collapsed: isSubtreeCollapsed(tab)
    };
    if (aOptions.full) {
      item.title  = tab.apiTab.title;
      item.url    = tab.apiTab.url;
      item.pinned = isPinned(tab);
    }
    return item;
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

async function applyTreeStructureToTabs(aTabs, aTreeStructure, aOptions = {}) {
  if (!aTabs || !aTreeStructure)
    return;

  log('applyTreeStructureToTabs: ', aTabs.map(dumpTab), aTreeStructure, aOptions);
  aTabs = aTabs.slice(0, aTreeStructure.length);
  aTreeStructure = aTreeStructure.slice(0, aTabs.length);

  var expandStates = aTabs.map(aTab => !!aTab);
  expandStates = expandStates.slice(0, aTabs.length);
  while (expandStates.length < aTabs.length)
    expandStates.push(-1);

  var parentTab = null;
  for (let i = 0, maxi = aTabs.length; i < maxi; i++) {
    let tab = aTabs[i];
    /*
    if (isCollapsed(tab))
      collapseExpandTabAndSubtree(tab, clone(aOptions, {
        collapsed: false,
        justNow: true
      }));
    */
    detachTab(tab, { justNow: true });

    let structureInfo = aTreeStructure[i];
    let parentIndexInTree = -1;
    if (typeof structureInfo == 'number') { // legacy format
      parentIndexInTree = structureInfo;
    }
    else {
      parentIndexInTree = structureInfo.parent;
      expandStates[i]   = !structureInfo.collapsed;
    }
    if (parentIndexInTree < 0) // there is no parent, so this is a new parent!
      parentTab = tab.id;

    let parent = getTabById(parentTab);
    if (parent) {
      let tabs = [parent].concat(getDescendantTabs(parent));
      //log('existing tabs in tree: ', {
      //  size: tabs.length,
      //  parent: parentIndexInTree
      //});
      parent = parentIndexInTree < tabs.length ? tabs[parentIndexInTree] : parent ;
    }
    if (parent) {
      parent.classList.remove(kTAB_STATE_SUBTREE_COLLAPSED); // prevent focus changing by "current tab attached to collapsed tree"
      attachTabTo(tab, parent, clone(aOptions, {
        dontExpand: true,
        dontMove:   true,
        justNow:    true
      }));
    }
  }

  log('expandStates: ', expandStates);
  for (let i = aTabs.length-1; i > -1; i--) {
    let tab = aTabs[i];
    let expanded = expandStates[i];
    collapseExpandSubtree(tab, clone(aOptions, {
      collapsed: expanded === undefined ? !hasChildTabs(tab) : !expanded ,
      justNow:   true,
      force:     true
    }));
  }
}


function getDroppedLinksOnTabBehavior() {
  return kDROPLINK_NEWTAB;
/*
  var behavior = utils.getTreePref('dropLinksOnTab.behavior');
  if (behavior & this.kDROPLINK_FIXED)
    return behavior;

  var checked = { value : false };
  var newChildTab = Services.prompt.confirmEx(this.browserWindow,
      utils.treeBundle.getString('dropLinkOnTab.title'),
      utils.treeBundle.getString('dropLinkOnTab.text'),
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1),
      utils.treeBundle.getString('dropLinkOnTab.openNewChildTab'),
      utils.treeBundle.getString('dropLinkOnTab.loadInTheTab'),
      null,
      utils.treeBundle.getString('dropLinkOnTab.never'),
      checked
    ) == 0;

  behavior = newChildTab ? this.kDROPLINK_NEWTAB : this.kDROPLINK_LOAD ;
  if (checked.value)
    utils.setTreePref('dropLinksOnTab.behavior', behavior);

  return behavior
*/
}

function openGroupBookmarkBehavior() {
  return kGROUP_BOOKMARK_SUBTREE | kGROUP_BOOKMARK_USE_DUMMY | kGROUP_BOOKMARK_EXPAND_ALL_TREE;
/*
  var behavior = utils.getTreePref('openGroupBookmark.behavior');
  if (behavior & this.kGROUP_BOOKMARK_FIXED)
    return behavior;

  var dummyTabFlag = behavior & this.kGROUP_BOOKMARK_USE_DUMMY;

  var checked = { value : false };
  var button = Services.prompt.confirmEx(this.browserWindow,
      utils.treeBundle.getString('openGroupBookmarkBehavior.title'),
      utils.treeBundle.getString('openGroupBookmarkBehavior.text'),
      // The "cancel" button must pe placed as the second button
      // due to the bug: https://bugzilla.mozilla.org/show_bug.cgi?id=345067
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) |
      (Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1) |
      (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_2),
      utils.treeBundle.getString('openGroupBookmarkBehavior.subTree'),
      '',
      utils.treeBundle.getString('openGroupBookmarkBehavior.separate'),
      utils.treeBundle.getString('openGroupBookmarkBehavior.never'),
      checked
    );

  if (button < 0)
    return this.kGROUP_BOOKMARK_CANCEL;

  var behaviors = [
      this.kGROUP_BOOKMARK_SUBTREE | dummyTabFlag,
      this.kGROUP_BOOKMARK_CANCEL,
      this.kGROUP_BOOKMARK_SEPARATE
    ];
  behavior = behaviors[button];

  if (checked.value && button != this.kGROUP_BOOKMARK_CANCEL) {
    utils.setTreePref('openGroupBookmark.behavior', behavior);
  }
  return behavior;
*/
}

async function bookmarkTree(aRoot, aOptions = {}) {
  var folder = await bookmarkTabs([aRoot].concat(getDescendantTabs(aRoot)), aOptions);
  browser.bookmarks.get(folder.parentId).then(aFolders => {
    notify({
      title:   browser.i18n.getMessage('bookmarkTree.notification.title'),
      message: browser.i18n.getMessage('bookmarkTree.notification.message', [
        aTabs[0].apiTab.title,
        aTabs.length,
        aFolders[0].title
      ]),
      icon:    kNOTIFICATION_DEFAULT_ICON
    });
  });
  return folder;
}
