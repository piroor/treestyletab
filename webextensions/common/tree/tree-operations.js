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
  if (aParent.getAttribute(kCHILDREN).indexOf(`|${aChild.id}|`) > -1) {
    log('=> already attached');
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
    aParent.setAttribute(kCHILDREN, '|');
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

  gInternalMovingCount++;
  var nextTab = getTabs(aChild)[newIndex];
  if (nextTab != aChild) {
    log('put tab before ', dumpTab(nextTab));
    //moveTabSubtreeTo(aChild, newIndex);
    getTabsContainer(nextTab || aChild).insertBefore(aChild, nextTab);
  }

  var [actualChildIndex, actualNewIndex] = await getApiTabIndex(aChild.apiTab.id, nextTab.apiTab.id);
  if (actualChildIndex < actualNewIndex)
    actualNewIndex--;

  log('actualNewIndex: ', actualNewIndex);
  browser.tabs.move(aChild.apiTab.id, {
    windowId: aChild.apiTab.windowId,
    index:    actualNewIndex
  });
  setTimeout(() => {
    gInternalMovingCount--;
  });

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

  if (gIsBackground)
    reserveToSaveTreeStructure(aChild);
}

function detachTab(aChild, aInfo = {}) {
  log('detachTab: ', dumpTab(aChild), aInfo);
  var parent = getParentTab(aChild);
  if (!parent) {
    log('canceled for an orphan tab');
    return;
  }

  var childIds = parent.getAttribute(kCHILDREN).split('|').filter((aId) => aId && aId != aChild.id);
  if (childIds.length == 0)
    parent.setAttribute(kCHILDREN, '|');
  else
    parent.setAttribute(kCHILDREN, `|${childIds.join('|')}|`);
  log('children => ', parent.getAttribute(kCHILDREN));
  aChild.removeAttribute(kPARENT);

  updateTabsIndent(aChild);

  if (gIsBackground)
    reserveToSaveTreeStructure(aChild);
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

  var baseIndent = gIndent;
  if (gIndent < 0)
    baseIndent = configs.baseIndent;

  for (let i = 0, maxi = aTabs.length; i < maxi; i++) {
    let item = aTabs[i];
    if (!item)
      continue;
    if (!gIsBackground) {
      window.requestAnimationFrame(() => {
        var level = parseInt(item.getAttribute(kNEST) || 0);
        var indent = level * baseIndent;
        var expected = indent == 0 ? 0 : indent + 'px' ;
        log('setting indent: ', { tab: dumpTab(item), expected: expected, level: level });
        if (item.style[gIndentProp] != expected) {
          window.requestAnimationFrame(() => item.style[gIndentProp] = expected);
        }
      });
    }
    item.setAttribute(kNEST, aLevel);
    updateTabsIndent(getChildTabs(item), aLevel + 1);
  }
}


// collapse/expand tabs

function shouldTabAutoExpanded(aTab) {
  return hasChildTabs(aTab) && isSubtreeCollapsed(aTab);
}

function collapseExpandSubtree(aTab, aParams = {}) {
  log('collapseExpandSubtree: ', dumpTab(aTab), aParams);
  if (!aTab ||
      (isSubtreeCollapsed(aTab) == aParams.collapsed))
    return;

  var container = getTabsContainer(aTab);
  container.doingCollapseExpand = true;

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
         justNow:   aParams.justNow//,
         //onStart:   () => scrollToTabSubtree(aTab)
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

  container.doingCollapseExpand = false;
}

function manualCollapseExpandSubtree(aTab, aParams = {}) {
  collapseExpandSubtree(aTab, aParams);
  if (!aParams.collapsed) {
    aTab.classList.add(kTAB_STATE_SUBTREE_EXPANDED_MANUALLY);
    //setTabValue(aTab, kTAB_STATE_SUBTREE_EXPANDED_MANUALLY, true);
  }

/*
  if (!configs.indentAutoShrink ||
      !configs.indentAutoShrinkOnlyForVisible)
    return;

  cancelCheckTabsIndentOverflow();
  if (!aTab.checkTabsIndentOverflowOnMouseLeave) {
    let stillOver = false;
    let id = aTab.id
    aTab.checkTabsIndentOverflowOnMouseLeave = function checkTabsIndentOverflowOnMouseLeave(aEvent, aDelayed) {
      if (aEvent.type == 'mouseover') {
        if (evaluateXPath(
              `ancestor-or-self::*[#${id}]`,
              aEvent.originalTarget || aEvent.target,
              XPathResult.BOOLEAN_TYPE
            ).booleanValue)
            stillOver = true;
          return;
        }
        else if (!aDelayed) {
          if (stillOver) {
            stillOver = false;
          }
          setTimeout(() => aTab.checkTabsIndentOverflowOnMouseLeave(aEvent, true), 0);
          return;
        } else if (stillOver) {
          return;
        }
        var x = aEvent.clientX;
        var y = aEvent.clientY;
        var rect = aTab.getBoundingClientRect();
        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom)
          return;
        document.removeEventListener('mouseover', aTab.checkTabsIndentOverflowOnMouseLeave, true);
        document.removeEventListener('mouseout', aTab.checkTabsIndentOverflowOnMouseLeave, true);
        delete aTab.checkTabsIndentOverflowOnMouseLeave;
        checkTabsIndentOverflow();
      };
      document.addEventListener('mouseover', aTab.checkTabsIndentOverflowOnMouseLeave, true);
      document.addEventListener('mouseout', aTab.checkTabsIndentOverflowOnMouseLeave, true);
    }
  }
*/
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
  updateTabCollapsed(aTab, aParams);

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
    browser.tabs.update(newSelection.apiTab.id, { active: true });
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

async function updateTabCollapsed(aTab, aParams = {}) {
  log('updateTabCollapsed ', dumpTab(aTab));
  if (!aTab.parentNode) // do nothing for closed tab!
    return;

  if (aTab.onEndCollapseExpandAnimation) {
    aTab.removeEventListener('transitionend', aTab.onEndCollapseExpandAnimation, { once: true });
    delete aTab.onEndCollapseExpandAnimation;
  }

  aTab.setAttribute(kCOLLAPSING_PHASE, aParams.collapsed ? kCOLLAPSING_PHASE_TO_BE_COLLAPSED : kCOLLAPSING_PHASE_TO_BE_EXPANDED );

  var endMargin, endOpacity;
  if (aParams.collapsed) {
    let firstTab = getFirstNormalTab(aTab) || getFirstTab(aTab);
    endMargin  = firstTab.getBoundingClientRect().height;
    endOpacity = 0;
  }
  else {
    endMargin  = 0;
    endOpacity = 1;
  }

  if (!canAnimate() ||
      aParams.justNow ||
      configs.collapseDuration < 1) {
    log('=> skip animation');
    if (aParams.collapsed)
      aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
    else
      aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);
    aTab.removeAttribute(kCOLLAPSING_PHASE);

    // Pinned tabs are positioned by "margin-top", so
    // we must not reset the property for pinned tabs.
    // (However, we still must update "opacity".)
    if (!isPinned(aTab))
      aTab.style.marginTop = endMargin ? `-${endMargin}px` : '';

    if (endOpacity == 0)
      aTab.style.opacity = 0;
    else
      aTab.style.opacity = '';

    if (typeof aParams.onStart == 'function')
      aParams.onStart();
    return;
  }

  if (!aParams.collapsed)
    aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);

  return new Promise((aResolve, aReject) => {
    window.requestAnimationFrame(() => {
      log('start animation for ', dumpTab(aTab));
      if (typeof aParams.onStart == 'function')
        aParams.onStart();

      aTab.onEndCollapseExpandAnimation = (() => {
        delete aTab.onEndCollapseExpandAnimation;
        log('=> finish animation for ', dumpTab(aTab));
        if (aParams.collapsed)
          aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
        aTab.removeAttribute(kCOLLAPSING_PHASE);
        if (endOpacity > 0) {
          if (window.getComputedStyle(aTab).opacity > 0) {
            aTab.style.opacity = '';
            aTab = null;
          }
          else {
            // If we clear its "opacity" before it becomes "1"
            // by CSS transition, the calculated opacity will
            // become 0 after we set an invalid value to clear it.
            // So we have to clear it with delay.
            // This is workaround for the issue:
            //   https://github.com/piroor/treestyletab/issues/1202
            setTimeout(function() {
              aTab.style.opacity = '';
              aTab = null;
            }, 0);
          }
        }
        aResolve();
      });
      aTab.addEventListener('transitionend', aTab.onEndCollapseExpandAnimation, { once: true });
      var backupTimer = setTimeout(() => {
        if (!aTab.onEndCollapseExpandAnimation)
          return;
        backupTimer = null
        aTab.removeEventListener('transitionend', aTab.onEndCollapseExpandAnimation, { once: true });
        aTab.onEndCollapseExpandAnimation();
      }, configs.collapseDuration);

      aTab.style.marginTop = endMargin ? `-${endMargin}px` : '';
      aTab.style.opacity   = endOpacity;
    });
  });
}

function collapseExpandTreesIntelligentlyFor(aTab, aParams = {}) {
  if (!aTab)
    return;

  var container = getTabsContainer(aTab);
  if (container.doingCollapseExpand)
    return;

  var sameParentTab = getParentTab(aTab);
  var expandedAncestors = `<${[aTab].concat(getAncestorTabs(aTab))
      .map(aAncestor => aAncestor.id)
      .join('><')}>`;

  var xpathResult = evaluateXPath(
      `child::xhtml:li${kXPATH_LIVE_TAB}[
        not(@${kCHILDREN}="|") and
        not(${hasClass(kTAB_STATE_COLLAPSED)}) and
        not(${hasClass(kTAB_STATE_SUBTREE_COLLAPSED)}) and
        not(contains("${expandedAncestors}", concat("<", @id, ">"))) and
        not(${hasClass(kTAB_STATE_HIDDEN)})
      ]`,
      container
    );
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

    let manuallyExpanded = false;//getTabValue(collapseTab, kSUBTREE_EXPANDED_MANUALLY) == 'true';
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
    browser.tabs.remove(aTab.apiTab.id);
  });
  //fireTabSubtreeClosedEvent(aParent, tabs);
}

function tryMoveFocusFromClosingCurrentTab(aTab) {
  log('tryMoveFocusFromClosingCurrentTab');
  var nextFocusedTab = null;

  var closeParentBehavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD; //getCloseParentBehaviorForTab(aTab);
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
  if (nextFocusedTab && toBeClosedTabs.indexOf(nextFocusedTab) > -1)
    nextFocusedTab = getNextFocusedTab(nextFocusedTab);

  if (!nextFocusedTab || isHidden(nextFocusedTab))
    return false;

  log('focus to: ', dumpTab(nextFocusedTab));

  //XXX notify kEVENT_TYPE_FOCUS_NEXT_TAB for others
  //if (!canFocus)
  //  return;

  //focusChangedByCurrentTabRemove = true;
  browser.tabs.update(nextFocusedTab.apiTab.id, { active: true });
  return true;
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
  return this.cleanUpTreeStructureArray(
      aTabs.map((aTab, aIndex) => {
        let tab = getParentTab(aTab);
        let index = tab ? aTabs.indexOf(tab) : -1 ;
        return index >= aIndex ? -1 : index ;
      }),
      -1
    );
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

function applyTreeStructureToTabs(aTabs, aTreeStructure, aExpandStates) {
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

    let parentIndexInTree = aTreeStructure[i];
    if (parentIndexInTree < 0) // there is no parent, so this is a new parent!
      parentTab = tab.id;

    let parent = getTabById(parentTab);
    if (parent) {
      let tabs = [parent].concat(getDescendantTabs(parent));
      parent = parentIndexInTree < tabs.length ? tabs[parentIndexInTree] : parent ;
    }
    if (parent) {
      attachTabTo(tab, parent, {
        forceExpand : true,
        dontMove    : true
      });
    }
  }

  //for (let i = aTabs.length-1; i > -1; i--) {
  //  collapseExpandSubtree(aTabs[i], !hasChildTabs(aTabs[i]) || !aExpandStates[i], true);
  //}
}


function scrollToNewTab(aTab) {
}

function updateInsertionPositionInfo(aTab) {
}
