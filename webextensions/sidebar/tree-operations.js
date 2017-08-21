/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function attachTabTo(aChild, aParent, aInfo = {}) {
  if (!aParent || !aChild) {
    log('missing information: ', dumpTab(aParent), dumpTab(aChild));
    return;
  }
  log('attachTabTo: ', {
    parent:   dumpTab(aParent),
    children: aParent.getAttribute('data-child-ids'),
    child:    dumpTab(aChild),
    info:     aInfo
  });
  if (aParent.getAttribute('data-child-ids').indexOf(`|${aChild.id}|`) > -1) {
    log('  => already attached');
    return;
  }
  var ancestors = [aParent].concat(getAncestorTabs(aChild));
  if (ancestors.indexOf(aChild) > -1) {
    log('  => canceled for recursive request');
    return;
  }

  detachTab(aChild);

  var newIndex = -1;
  if (aInfo.dontMove)
    aInfo.insertBefore = getNextTab(aChild);
  if (aInfo.insertBefore) {
    log('  insertBefore: ', dumpTab(aInfo.insertBefore));
    newIndex = getTabIndex(aInfo.insertBefore);
  }
  var childIds = [];
  if (newIndex > -1) {
    log('  newIndex (from insertBefore): ', newIndex);
    let expectedAllTabs = getAllTabs().filter((aTab) => aTab == aChild);
    let refIndex = expectedAllTabs.indexOf(aInfo.insertBefore);
    expectedAllTabs.splice(refIndex, 0, aChild);
    childIds = expectedAllTabs.filter((aTab) => {
      return (aTab == aChild || aTab.getAttribute('data-parent-id') == aParent.id);
    }).map((aTab) => {
      return aTab.id;
    });
  }
  else {
    let descendants = getDescendantTabs(aParent);
    log('  descendants: ', descendants.map(dumpTab));
    if (descendants.length) {
      newIndex = getTabIndex(descendants[descendants.length-1]) + 1;
    }
    else {
      newIndex = getTabIndex(aParent) + 1;
    }
    log('  newIndex (from existing children): ', newIndex);
    // update and cleanup
    let children = getChildTabs(aParent);
    children.push(aChild);
    childIds = children.map((aTab) => aTab.id);
  }

  if (childIds.length == 0)
    aParent.setAttribute('data-child-ids', '|');
  else
    aParent.setAttribute('data-child-ids', `|${childIds.join('|')}|`);

  if (getTabIndex(aChild) < newIndex)
    newIndex--;
  log('  newIndex: ', newIndex);

  aChild.setAttribute('data-parent-id', aParent.id);
  var parentLevel = parseInt(aParent.getAttribute('data-nest') || 0);
  updateTabsIndent(aChild, parentLevel + 1);

  gInternalMovingCount++;
  var nextTab = getTabs()[newIndex];
  if (nextTab != aChild)
    gTabs.insertBefore(aChild, nextTab);
  getApiTabIndex(aChild.tab.id, nextTab.tab.id).then((aActualIndexes) => {
    log('  actual indexes: ', aActualIndexes);
    var [actualChildIndex, actualNewIndex] = aActualIndexes;
    if (actualChildIndex < actualNewIndex)
      actualNewIndex--;
    log('  actualNewIndex: ', actualNewIndex);
    chrome.tabs.move(aChild.tab.id, { windowId: aChild.tab.windowId, index: actualNewIndex });
    setTimeout(() => {
      gInternalMovingCount--;
    });
  });
}

function detachTab(aChild, aInfo = {}) {
  log('detachTab: ', dumpTab(aChild), aInfo);
  var parent = getParentTab(aChild);
  if (!parent) {
    log('  detachTab: canceled for an orphan tab');
    return;
  }

  var childIds = parent.getAttribute('data-child-ids').split('|').filter((aId) => aId && aId != aChild.id);
  if (childIds.length == 0)
    parent.setAttribute('data-child-ids', '|');
  else
    parent.setAttribute('data-child-ids', `|${childIds.join('|')}|`);
  log('  child-ids => ', parent.getAttribute('data-child-ids'));
  aChild.removeAttribute('data-parent-id');

  updateTabsIndent(aChild);
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
      getTabs().filter((aTab) => aTab.removing).length == children.length) {
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
        //collapseExpandSubtree(child, false);
        //deleteTabValue(child, kSUBTREE_COLLAPSED);
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

  var margin = 16;
  var indent = aLevel * margin;
  for (let i = 0, maxi = aTabs.length; i < maxi; i++) {
    let item = aTabs[i];
    if (!item)
      continue;
    item.style.marginLeft = indent + 'px';
    item.setAttribute('data-nest', aLevel);
    updateTabsIndent(item.getAttribute('data-child-ids').split('|').map(findTabFromId), aLevel+1);
  }
}

// operate tabs based on tree information

function closeChildTabs(aParent) {
  var getDescendantTabs;
}

