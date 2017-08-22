/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function findTabFromEvent(aEvent) {
  return findTabFromChild(aEvent.target);
}

function findTabFromChild(aNode) {
  if (!aNode)
    return null;
  while (aNode.nodeType != aNode.ELEMENT_NODE ||
         !aNode.apiTab) {
    if (!aNode.parentNode)
      return null;
    aNode = aNode.parentNode;
  }
  return aNode;
}

function findTabFromId(aIdOrInfo) {
  if (!aIdOrInfo)
    return null;
  if (typeof aIdOrInfo == 'string')
    aIdOrInfo = `#${aIdOrInfo}:not(.removing)`;
  else
    aIdOrInfo = `#tab-${aIdOrInfo.window}-${aIdOrInfo.tab}:not(.removing)`;
  return document.querySelector(aIdOrInfo);
}


// get tab items based on tree information

function getParentTab(aChild) {
  var id = aChild.getAttribute(kPARENT);
  if (id)
    return document.querySelector(`#${id}:not(.removing)`);
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
  var parentId = aTab.getAttribute(kPARENT);
  if (!parentId)
    return document.querySelector(`#${aTab.id} ~ li:not([${kPARENT}]):not(.removing)`);
  return document.querySelector(`#${aTab.id} ~ li[${kPARENT}="${parentId}"]:not(.removing)`);
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
  var ids = aParent.getAttribute(kCHILDREN).replace(/\|\|+|^\||\|$/g, '');
  if (ids == '')
    return [];
  ids = ids.split('|').join(', #');
  return Array.slice(document.querySelectorAll(`:-moz-any(#${ids}):not(.removing)`));
}

function hasChildTabs(aParent) {
  return aParent.getAttribute(kCHILDREN) != '|';
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

function getRootTabs(aHint) {
  return getTabs(aHint).filter((aTab) => {
    return !aTab.hasAttribute(kPARENT);
  });
}

function getChildTabIndex(aChild, aParent) {
  var children = getChildTabs(aParent);
  return children.indexOf(aChild);
}


// get tabs safely (ignoring removing tabs)

function getTabsContainer(aHint) {
  if (!aHint)
    aHint = gAllTabs.firstChild.firstChild;

  if (typeof aHint == 'number')
    return document.querySelector(`#window-${aHint}`);

  if (aHint && typeof aHint == 'object' && 'windowId' in aHint)
    return document.querySelector(`#window-${aHint.windowId}`);

  var tab = findTabFromChild(aHint);
  if (tab)
    return document.querySelector(`#window-${tab.apiTab.windowId}`);

  return null;
}

function getAllTabs(aHint) {
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.childNodes);
}

function getTabs(aHint) { // only visible, including collapsed and pinned
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll('li.tab:not(.removing):not(.hidden)'));
}

function getNormalTabs(aHint) { // only visible, including collapsed, not pinned
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll('li.tab:not(.removing):not(.hidden):not(.pinned)'));
}

function getVisibleTabs(aHint) { // visible, not-collapsed
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll('li.tab:not(.removing):not(.collapsed):not(.hidden)'));
}

function getPinnedTabs(aHint) { // visible, pinned
  return getAllTabs(aHint);
}

function getFirstTab(aHint) {
  return getAllTabs(aHint)[0];
}

function getFirstNormalTab(aHint) { // visible, not-collapsed, not-pinned
  return getNormalTabs(aHint)[0];
}

function getLastTab(aHint) {
  var items = getAllTabs(aHint);
  return items[items.length-1];
}

function getLastVisibleTab(aHint) { // visible, not-collapsed
  var items = getTabs(aHint);
  return items[items.length-1];
}

function getNextTab(aTab) {
  return document.querySelector(`#${aTab.id} ~ li.tab:not(.removing)`);
}

function getPreviousTab(aTab) {
  var tabs = getAllTabs(aTab);
  var index = tabs.indexOf(aTab);
  return index > 0 ? tabs[index-1] : null ;
}

function getTabIndex(aTab) {
  return getTabs(aTab).indexOf(aTab);
}

function getNextVisibleTab(aTab) { // visible, not-collapsed
  return document.querySelector(`#${aTab.id} ~ li.tab:not(.removing):not(.collapsed):not(.hidden)`);
}

function getPreviousVisibleTab(aTab) { // visible, not-collapsed
  var tabs = getVisibleTabs(aTab);
  var index = tabs.indexOf(aTab);
  return index > 0 ? tabs[index-1] : null ;
}

