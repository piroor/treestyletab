/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function attachTabItemTo(aChildItem, aParentItem, aInfo = {}) {
  if (!aParentItem || !aChildItem) {
    log('missing information: ', aParentItem, aChildItem);
    return;
  }
  log('attachTabItemTo: ', { parent: aParentItem, child: aChildItem, info: aInfo });
  if (aParentItem.getAttribute('data-child-ids').indexOf(`|${aChildItem.id}|`) > -1) {
    log('already attached');
    return;
  }
  var ancestorItems = [aParentItem].concat(getAncestorTabItems(aChildItem));
  if (ancestorItems.indexOf(aChildItem) > -1) {
    log('  canceled for recursive request');
    return;
  }

  detachTabItem(aChildItem);

  var newIndex = -1;
  var descendantItems = getDescendantTabItems(aParentItem);
  log('  descendantItems: ', descendantItems);
  if (aInfo.dontMove)
    aInfo.insertBeforeItem = aChildItem.nextSibling;
  log('  insertBeforeItem: ', aInfo.insertBeforeItem);
  if (aInfo.insertBeforeItem) {
    newIndex = getTabItemIndex(aInfo.insertBeforeItem);
  }
  if (newIndex > -1) {
    log('  newIndex (from insertBeforeItem): ', newIndex);
    let nextItemIndex = descendantItems.indexOf(aInfo.insertBeforeItem.id);
    descendantItems.splice(nextItemIndex, 0, aChildItem);
    let childIds = descendantItems.filter((aItem) => {
      return (aItem == aChildItem || aItem.getAttribute('data-parent-id') == aParentItem.id);
    }).map((aItem) => {
      return aItem.id;
    });
    if (childIds.length == 0)
      aParentItem.setAttribute('data-child-ids', '|');
    else
      aParentItem.setAttribute('data-child-ids', `|${childIds.join('|')}|`);
  }
  else {
    if (descendantItems.length) {
      newIndex = getTabItemIndex(descendantItems[descendantItems.length-1]);
    }
    else {
      newIndex = getTabItemIndex(aParentItem);
    }
    log('  newIndex (from existing children): ', newIndex);
    let childIds = aParentItem.getAttribute('data-child-ids');
    if (!childIds)
      childIds = '|';
    aParentItem.setAttribute('data-child-ids', `${childIds}${aChildItem.id}|`);
  }
  newIndex++;
  log('  newIndex: ', newIndex);

  aChildItem.setAttribute('data-parent-id', aParentItem.id);
  var parentLevel = parseInt(aParentItem.getAttribute('data-nest') || 0);
  updateTabItemsIndent(aChildItem, parentLevel + 1);

  gInternalMovingCount++;
  let tab = aChildItem.tab;
  chrome.tabs.move(tab.id, { windowId: tab.windowId, index: newIndex });
  var nextItem = gTabs.childNodes[newIndex];
  if (nextItem != aChildItem)
    gTabs.insertBefore(aChildItem, nextItem);
  setTimeout(() => {
    gInternalMovingCount--;
  });
}

function detachTabItem(aChildItem, aInfo = {}) {
  log('detachTabItem: ', aChildItem, aInfo);
  var parentItem = getParentTabItem(aChildItem);
  if (!parentItem) {
    log('  detachTabItem: canceled for an orphan tab');
    return;
  }

  var childIds = parentItem.getAttribute('data-child-ids').split('|').filter((aId) => aId && aId != aChildItem.id);
  parentItem.setAttribute('data-child-ids', `|${childIds.join('|')}|`);
  log('  child-ids => ', parentItem.getAttribute('data-child-ids'));
  aChildItem.removeAttribute('data-parent-id');

  updateTabItemsIndent(aChildItem);
}

function detachAllChildItems(aTabItem, aInfo = {}) {
  var childItems = getChildTabItems(aTabItem);
  if (!childItems.length)
    return;

  if (!('behavior' in aInfo))
    aInfo.behavior = kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN;
  if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    aInfo.behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  aInfo.dontUpdateInsertionPositionInfo = true;

  var parentItem = getParentTabItem(aTabItem);
  if (isGroupTabItem(aTabItem) &&
      gTabs.childNodes.filter((aItem) => aItem.removing).length == childItems.length) {
    aInfo.behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
    aInfo.dontUpdateIndent = false;
  }

  var insertBefore = null;
  if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN/* &&
    !utils.getTreePref('closeParentBehavior.moveDetachedTabsToBottom')*/) {
    insertBefore = getNextSiblingTabItem(getRootTabItem(aTabItem));
  }

  if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB) {
    // open new group tab and replace the detaching tab with it.
    aInfo.behavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
  }

  for (let i = 0, maxi = childItems.length; i < maxi; i++) {
    let childItem = childItems[i];
    if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN) {
      detachTabItem(childItem, aInfo);
      //moveTabSubtreeTo(tab, insertBefore ? insertBefore._tPos - 1 : this.getLastTab(b)._tPos );
    }
    else if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD) {
      detachTabItem(childItem, aInfo);
      if (i == 0) {
        if (parentItem) {
          attachTabItemTo(childItem, parentItem, inherit(aInfo, {
            dontExpand : true,
            dontMove   : true
          }));
        }
        //collapseExpandSubtree(childItem, false);
        //deleteTabValue(childItem, kSUBTREE_COLLAPSED);
      }
      else {
        attachTabItemTo(childItem, childItems[0], inherit(aInfo, {
          dontExpand : true,
          dontMove   : true
        }));
      }
    }
    else if (aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN && parentItem) {
      attachTabItemTo(childItem, parentItem, inherit(aInfo, {
        dontExpand : true,
        dontMove   : true
      }));
    }
    else { // aInfo.behavior == kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN
      detachTabItem(childItem, aInfo);
    }
  }
}

function updateTabItemsIndent(aTabItems, aLevel = undefined) {
  if (!aTabItems)
    return;

  if (!Array.isArray(aTabItems))
    aTabItems = [aTabItems];

  if (!aTabItems.length)
    return;

  if (aLevel === undefined)
    aLevel = getAncestorTabItems(aTabItems[0]).length;

  var margin = 16;
  var indent = aLevel * margin;
  for (let i = 0, maxi = aTabItems.length; i < maxi; i++) {
    let item = aTabItems[i];
    if (!item)
      continue;
    item.style.marginLeft = indent + 'px';
    item.setAttribute('data-nest', aLevel);
    updateTabItemsIndent(item.getAttribute('data-child-ids').split('|').map(findTabItemFromId), aLevel+1);
  }
}

// operate tabs based on tree information

function closeChildTabItems(aParentItem) {
  var getDescendantTabItems
}

