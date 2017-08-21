/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function findTabFromEvent(aEvent) {
  var node = aEvent.target;
  while (node.nodeType != node.ELEMENT_NODE ||
         !node.tab) {
    if (!node.parentNode)
      return null;
    node = node.parentNode;
  }
  return node;
}

function findTabFromId(aIdOrInfo) {
  if (!aIdOrInfo)
    return null;
  if (typeof aIdOrInfo == 'string')
    aIdOrInfo = `#${aIdOrInfo}`;
  else
    aIdOrInfo = `#tab-${aIdOrInfo.window}-${aIdOrInfo.tab}`;
  return document.querySelector(aIdOrInfo);
}


// get tab items based on tree information

function getParentTab(aChild) {
  var id = aChild.getAttribute('data-parent-id');
  if (id)
    return document.querySelector(`#${id}`);
  return null;
}

function getAncestorTabs(aDecendant) {
  var ancestors = [];
  while (true) {
    let parent = getParentTab(aDecendant);
    if (parent)
      ancestors.push(parent);
    else
      break;
  }
  return ancestors;
}

function getRootTab(aDecendant) {
  var ancestors = getAncestorTabs(aDecendant);
  return ancestors.length > 0 ? ancestors[ancestors.length-1] : aDecendant ;
}

function getNextSiblingTab(aTab) {
  var parentId = aTab.getAttribute('data-parent-id');
  if (!parentId)
    return document.querySelector(`#${aTab.id} ~ li:not([data-parent-id])`);
  return document.querySelector(`#${aTab.id} ~ li[data-parent-id="${parentId}"]`);
}

function getPreviousSiblingTab(aTab) {
  var siblings = getSiblingTabs(aTab);
  var index = siblings.indexOf(aTab) - 1;
  if (index < 0)
    return null;
  return siblings[index];
}

function getSiblingTabs(aTab) {
  var parent = getParentTab(aTab);
  return parent ? getChildTabs(parent) : getRootTabs() ;
}

function getChildTabs(aParent) {
  return aParent.getAttribute('data-child-ids').split('|').map(findTabFromId).filter((aValidTab) => aValidTab);
}

function hasChildTabs(aParent) {
  return aParent.getAttribute('data-child-ids') != '|';
}

function getDescendantTabs(aRoot) {
  var descendants = [];
  if (!aRoot)
    return descendants;
  for (let child of getChildTabs(aRoot)) {
    descendants.push(child);
    descendants = descendants.concat(getDescendantTabs(child));
  }
  return descendants;
}

function getFirstChildTab(aParent) {
  var children = getChildTabs(aTabs);
  return children[0];
}

function getLastChildTab(aParent) {
  var children = getChildTabs(aTabs);
  return children.length > 0 ? children[children.length - 1] : null ;
}

function getLastDescendantTab(aRoot) {
  var descendants = getDescendantTabs(aRoot);
  return descendants.length ? descendants[descendants.length-1] : null ;
}

function getRootTabs() {
  return getTabs().filter((aTab) => {
    return !aTab.hasAttribute('data-parent-id');
  });
}

function getChildTabIndex(aChild, aParent) {
  var children = getChildTabs(aParent);
  return children.indexOf(aChild);
}


// get tabs safely (ignoring removing tabs)

function getAllTabss() {
  return Array.slice(gTabs.childNodes);
}

function getTabs() { // only visible, including collapsed and pinned
  return getAllTabs();
}

function getPinnedTabs() { // visible, pinned
  return getAllTabs();
}

function getFirstTab() {
  return gTabs.childNodes[0];
}

function getFirstNormalTab() { // visible, not-collapsed, not-pinned
  return getFirstTab();
}

function getLastTab() {
  var items = gTabs.childNodes;
  return items[items.length-1];
}

function getLastVisibleTab() { // visible, not-collapsed
  var items = gTabs.childNodes;
  return items[items.length-1];
}

function getNextTab(aTab) {
  return aTab && aTab.nextSibling;
}

function getPreviousTab(aTab) {
  return aTab && aTab.previousSibling;
}

function getTabIndex(aTab) {
  return Array.prototype.indexOf.call(gTabs.childNodes, aTab);
}

function getNextVisibleTab(aTab) { // visible, not-collapsed
  return getNextTab(aTab);
}

function getPreviousVisibleTab(aTab) { // visible, not-collapsed
  return getPreviousTab(aTab);
}

function getVisibleTabs() { // visible, not-collapsed
  return getTabs();
}

