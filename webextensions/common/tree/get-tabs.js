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


function getTabFromChild(aNode) {
  if (!aNode)
    return null;
  return evaluateXPath(
    `ancestor-or-self::xhtml:li[${hasClass('tab')}]`,
    aNode,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getTabFromEvent(aEvent) {
  return getTabFromChild(aEvent.target);
}

function getNewTabButtonFromEvent(aEvent) {
  return evaluateXPath(
    `ancestor-or-self::*[${hasClass('newtab-button')}][1]`,
    aEvent.originalTarget,
    Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getTabById(aIdOrInfo) {
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

function getAllRootTabs(aHint) {
  return getAllTabs(aHint).filter((aTab) => {
    return !aTab.hasAttribute(kPARENT);
  });
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

  var tab = getTabFromChild(aHint);
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

kSELECTOR_NORMAL_TAB = 'li.tab:not(.removing):not(.hidden):not(.pinned)';
kSELECTOR_VISIBLE_TAB = 'li.tab:not(.removing):not(.collapsed):not(.hidden)';

function getNormalTabs(aHint) { // only visible, including collapsed, not pinned
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_NORMAL_TAB));
}

function getVisibleTabs(aHint) { // visible, not-collapsed
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_VISIBLE_TAB));
}

function getPinnedTabs(aHint) { // visible, pinned
  return getAllTabs(aHint);
}

function getFirstTab(aHint) {
  var container = getTabsContainer(aHint);
  return container && container.firstChild;
}

function getFirstNormalTab(aHint) { // visible, not-collapsed, not-pinned
  var container = getTabsContainer(aHint);
  if (!container)
    return null;
  return container.querySelector(kSELECTOR_NORMAL_TAB)
}

function getLastTab(aHint) {
  var container = getTabsContainer(aHint);
  return container && container.lastChild;
}

function getLastVisibleTab(aHint) { // visible, not-collapsed
  var items = getTabs(aHint);
  return items[items.length-1];
}

function getNextTab(aTab) {
  return document.querySelector(`#${aTab.id} ~ li.tab:not(.removing)`);
}

function getPreviousTab(aTab) {
  return evaluateXPath(
    `preceding-sibling::xhtml:li[${hasClass('tab')}][not(${hasClass('removing')})]`,
    aTab,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
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

