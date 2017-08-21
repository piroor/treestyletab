/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

// initialize

var gTabs;
var gInternalMovingCount = 0;

function init() {
  window.addEventListener('unload', destroy, { once: true });
  gTabs = document.getElementById('tabs');
  gTabs.addEventListener('mousedown', omMouseDown);
  chrome.tabs.onActivated.addListener(onSelect);
  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onCreated.addListener(onCreated);
  chrome.tabs.onRemoved.addListener(onRemoved);
  chrome.tabs.onMoved.addListener(onMoved);
  chrome.tabs.onAttached.addListener(onAttached);
  chrome.tabs.onDetached.addListener(onDetached);
  rebuildAll();
}

function destroy() {
  chrome.tabs.onActivated.removeListener(onSelect);
  chrome.tabs.onUpdated.removeListener(onUpdated);
  chrome.tabs.onCreated.removeListener(onCreated);
  chrome.tabs.onRemoved.removeListener(onRemoved);
  chrome.tabs.onMoved.removeListener(onMoved);
  chrome.tabs.onAttached.removeListener(onAttached);
  chrome.tabs.onDetached.removeListener(onDetached);
  gTabs.removeEventListener('mousedown', omMouseDown);
  gTabs = undefined;
}

function rebuildAll() {
  chrome.tabs.query({ currentWindow: true }, (aTabs) => {
    clear();
    for (let tab of aTabs) {
      gTabs.appendChild(buildTabItem(tab));
    }
  });
}

function buildTabItem(aTab) {
  let item = document.createElement('li');
  item.tab = aTab;
  item.setAttribute('id', `tab-${aTab.windowId}-${aTab.id}`);
  item.setAttribute('data-child-ids', '|');
  item.appendChild(document.createTextNode(aTab.title));
  item.setAttribute('title', aTab.title);
  if (aTab.active)
    item.classList.add('active');
  return item;
}

function clear() {
  var range = document.createRange();
  range.selectNodeContents(gTabs);
  range.deleteContents();
  range.detach();
}


// get tab items

function findTabItemFromEvent(aEvent) {
  var node = aEvent.target;
  while (node.nodeType != node.ELEMENT_NODE ||
         !node.tab) {
    if (!node.parentNode)
      return null;
    node = node.parentNode;
  }
  return node;
}

function findTabItemFromId(aIdOrInfo) {
  if (!aIdOrInfo)
    return null;
  if (typeof aIdOrInfo == 'string')
    aIdOrInfo = `#${aIdOrInfo}`;
  else
    aIdOrInfo = `#tab-${aIdOrInfo.window}-${aIdOrInfo.tab}`;
  return document.querySelector(aIdOrInfo);
}

function getTabItemIndex(aTabItem) {
  return Array.prototype.indexOf.call(gTabs.childNodes, aTabItem);
}

// get tab items based on tree information

function getParentTabItem(aChildItem) {
  var id = aChildItem.getAttribute('data-parent-id');
  if (id)
    return document.querySelector(`#${id}`);
  return null;
}

function getAncestorTabItems(aDecendantItem) {
  var ancestors = [];
  var parent;
  while (parent = getParentTabItem(aDecendantItem)) {
    ancestors.push(parent);
  }
  return ancestors;
}

function getRootTabItem(aDecendantItem) {
  var ancestors = getAncestorTabItems(aDecendantItem);
  return ancestors.length > 0 ? ancestors[ancestors.length-1] : aDecendantItem ;
}

function getNextSiblingTabItem(aItem) {
  var parentId = aItem.getAttribute('data-parent-id');
  if (!parentId)
    return document.querySelector(`#${aItem.id} ~ li:not([data-parent-id])`);
  return document.querySelector(`#${aItem.id} ~ li[data-parent-id="${parentId}"]`);
}

function getPreviousSiblingTabItem(aItem) {
  var siblingItems = getSiblingTabItems(aItem);
  var index = siblingItems.indexOf(aItem) - 1;
  if (index < 0)
    return null;
  return siblingItems[index];
}

function getSiblingTabItems(aItem) {
  var parentItem = getParentTabItem(aItem);
  return parentItem ? getChildTabItems(parentItem) : getRootTabItems() ;
}

function getChildTabItems(aParentItem) {
  return aParentItem.getAttribute('data-child-ids').split('|').map(findTabItemFromId).filter((aValidItem) => aValidItem);
}

function hasChildTabItems(aParentItem) {
  return aParentItem.getAttribute('data-child-ids') != '|';
}

function getDescendantTabItems(aRootItem) {
  var descendants = [];
  if (!aRootItem)
    return descendants;
  for (let childItem of getChildTabItems(aRootItem)) {
    descendants.push(childItem);
    descendants = descendants.concat(getDescendantTabItems(childItem));
  }
  return descendants;
}

function getFirstChildTabItem(aParentItem) {
  var childItems = getChildTabItems(aTabItems);
  return childItems[0];
}

function getLastChildTabItem(aParentItem) {
  var childItems = getChildTabItems(aTabItems);
  return childItems.length > 0 ? childItems[childItems.length - 1] : null ;
}

function getLastDescendantTab(aRootItem) {
  var descendantItems = getDescendantTabItems(aRootItem);
  return descendantItems.length ? descendantItems[descendantItems.length-1] : null ;
}

function getRootTabItems() {
  return Array.prototype.filter((aItem) => {
    return !aItem.hasAttribute('data-parent-id');
  });
}

function getChildTabItemIndex(aChildItem, aParentItem) {
  var childItems = getChildTabItems(aParentItem);
  return childItems.indexOf(aChildItem);
}


// get tree state of tab items

function isSubtreeCollapsed(aTabItem) {
  return false;
}

function isGroupTabItem(aTabItem) {
  return false;
}


// operate tree of tab items

function attachTabItemTo(aParentItem, aChildItem, aInfo = {}) {
  if (!aParentItem ||
      !aChildItem ||
      aParentItem.getAttribute('data-child-ids').indexOf(`|${aChildItem.id}|`) > -1)
    return;

  // avoid recursive tree
  var ancestorItems = [aParentItem].concat(getAncestorTabItems(aChildItem));
  if (ancestorItems.indexOf(aChildItem) > -1) {
    log('attachTabItemTo: canceled for recursive request');
    return;
  }

  detachTabItem(aChildItem);

  var newIndex = -1;
  var descendantItems = getDescendantTabItems(aParentItem);
  log('descendantItems: ', descendantItems);
  if (aInfo.insertBeforeItem) {
    newIndex = getTabItemIndex(aInfo.insertBeforeItem);
  }
  if (newIndex > -1) {
    let nextItemIndex = descendantItems.indexOf(aInfo.insertBeforeItem.id);
    descendantItems.splice(nextItemIndex, 0, aChildItem.id);
    let childIds = descendantItems.filter((aItem) => {
      return (aItem == aChildItem || aItem.getAttribute('data-parent-id') == aParentItem.id);
    }).map((aItem) => {
      return aItem.id;
    });
    aParentItem.setAttribute('data-child-ids', `|${childIds.join('|')}|`);
  }
  else {
    if (descendantItems.length) {
      newIndex = getTabItemIndex(descendantItems[descendantItems.length-1]);
    }
    else {
      newIndex = getTabItemIndex(aParentItem);
    }
    let childIds = aParentItem.getAttribute('data-child-ids');
    if (!childIds)
      childIds = '|';
    aParentItem.setAttribute('data-child-ids', `${childIds}${aChildItem.id}|`);
  }
  newIndex++;
  log('newIndex: ', newIndex);

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
  var parentItem = getParentTabItem(aChildItem);
  if (!parentItem) {
    log('detachTabItem: canceled for an orphan tab');
    return;
  }

  log('detachTabItem: detach ', aChildItem.id, ' from ', parentItem.id);

  var childIds = parentItem.getAttribute('data-child-ids').split('|').filter((aId) => aId && aId != aChildItem.id);
  parentItem.setAttribute('data-child-ids', `|${childIds.join('|')}|`);
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

  var parentItem = getParentTabItem(aTab);
  if (isGroupTabItem(aTab) &&
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
        attachTabItemTo(tab, childItems[0], inherit(aInfo, {
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


// event handling

function omMouseDown(aEvent) {
  log('omMouseDown: ', aEvent);
  var tabItem = findTabItemFromEvent(aEvent);
  log('tabItem: ', tabItem);
  if (!tabItem)
    return;
  if (aEvent.button == 1 ||
      (aEvent.button == 0 && (aEvent.ctrlKey || aEvent.metaKey))) {
    log('middle-click to close');
    chrome.tabs.remove(tabItem.tab.id);
    return;
  }
  chrome.tabs.update(tabItem.tab.id, { active: true });
}

function onSelect(aActiveInfo) {
  var newItem = findTabItemFromId({ tab: aActiveInfo.tabId, window: aActiveInfo.windowId });
  if (!newItem)
    return;
  var oldItems = document.querySelectorAll('.active');
  for (let oldItem of oldItems) {
    oldItem.classList.remove('active');
  }
  newItem.classList.add('active');
}

function onUpdated(aTabId, aChangeInfo, aTab) {
  var updatedItem = findTabItemFromId({ tab: aTabId, window: aTab.windowId });
  if (!updatedItem)
    return;
  if (aTab.title != updatedItem.textContent)
    updatedItem.textContent = aTab.title;
  updatedItem.tab = aTab;
}

function onCreated(aTab) {
  log('created', aTab);
  var newItem = gTabs.appendChild(buildTabItem(aTab));

  var openerItem = findTabItemFromId({ tab: aTab.openerTabId, window: aTab.windowId });
  log('openerItem: ', openerItem);
  if (openerItem) {
    attachTabItemTo(openerItem, newItem);
  }
}

function onRemoved(aTabId, aRemoveInfo) {
  var oldItem = findTabItemFromId({ tab: aTabId, window: aRemoveInfo.windowId });
  if (!oldItem)
    return;

  var closeParentBehavior = getCloseParentBehaviorForTabItem(oldItem);
  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
      isSubtreeCollapsed(oldItem))
    closeChildTabItems(tab);

//  var firstChildItem = getFirstChildTabItem(oldItem);

  detachAllChildItems(oldItem, {
    behavior : closeParentBehavior
  });

  gTabs.removeChild(oldItem);
}

var kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD        = 3;
var kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN       = 0;
var kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN        = 1;
var kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN = 4;
var kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN         = 2; // onTabRemoved only
var kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB     = 5;
function getCloseParentBehaviorForTabItem(aTabItem) {
  return kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;
}

function onMoved(aTabId, aMoveInfo) {
  log('moved: ', aTabId, aMoveInfo);
  var movedItem = findTabItemFromId({ tab: aTabId, window: aMoveInfo.windowId });
  if (!movedItem)
    return;
  if (gInternalMovingCount > 0) {
    log('internal move');
    return;
  }
  var newNextIndex = aMoveInfo.toIndex;
  if (aMoveInfo.fromIndex < newNextIndex)
    newNextIndex++;
  var nextItem = gTabs.childNodes[newNextIndex];
  gTabs.insertBefore(movedItem, nextItem);
}

function onAttached(aTabId, aAttachInfo) {
  var newItem = findTabItemFromId({ tab: aTabId, window: aAttachInfo.newWindowId });
}

function onDetached(aTabId, aDetachInfo) {
  var oldItem = findTabItemFromId({ tab: aTabId, window: aDetachInfo.oldWindowId });
  if (oldItem)
    gTabs.removeChild(oldItem);
}

window.addEventListener('DOMContentLoaded', init, { once: true });

