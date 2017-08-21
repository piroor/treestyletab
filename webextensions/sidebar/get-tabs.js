/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

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


// get tab items based on tree information

function getParentTabItem(aChildItem) {
  var id = aChildItem.getAttribute('data-parent-id');
  if (id)
    return document.querySelector(`#${id}`);
  return null;
}

function getAncestorTabItems(aDecendantItem) {
  var ancestors = [];
  while (true) {
    let parent = getParentTabItem(aDecendantItem);
    if (parent)
      ancestors.push(parent);
    else
      break;
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
  return getTabItems().filter((aItem) => {
    return !aItem.hasAttribute('data-parent-id');
  });
}

function getChildTabItemIndex(aChildItem, aParentItem) {
  var childItems = getChildTabItems(aParentItem);
  return childItems.indexOf(aChildItem);
}


// get tabs safely (ignoring removing tabs)

function getAllTabItemss() {
  return Array.slice(gTabs.childNodes);
}

function getTabItems() { // only visible, including collapsed and pinned
  return getAllTabs();
}

function getPinnedTabItems() { // visible, pinned
  return getAllTabs();
}

function getFirstTabItem() {
  return gTabs.childNodes[0];
}

function getFirstNormalTabItem() { // visible, not-collapsed, not-pinned
  return getFirstTabItem();
}

function getLastTabItem() {
  var items = gTabs.childNodes;
  return items[items.length-1];
}

function getLastVisibleTabItem() { // visible, not-collapsed
  var items = gTabs.childNodes;
  return items[items.length-1];
}

function getNextTabItem(aItem) {
  return aItem && aItem.nextSibling;
}

function getPreviousTabItem(aItem) {
  return aItem && aItem.previousSibling;
}

function getTabItemIndex(aTabItem) {
  return Array.prototype.indexOf.call(gTabs.childNodes, aTabItem);
}

function getNextVisibleTabItem(aItem) { // visible, not-collapsed
  return getNextTabItem(aItem);
}

function getPreviousVisibleTabItem(aItem) { // visible, not-collapsed
  return getPreviousTabItem(aItem);
}

function getVisibleTabItems() { // visible, not-collapsed
  return getTabItems();
}

