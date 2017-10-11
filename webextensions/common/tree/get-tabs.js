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

const kSELECTOR_LIVE_TAB = `li.tab:not(.${kTAB_STATE_REMOVING})`;
const kSELECTOR_NORMAL_TAB = `${kSELECTOR_LIVE_TAB}:not(.${kTAB_STATE_HIDDEN}):not(.${kTAB_STATE_PINNED})`;
const kSELECTOR_VISIBLE_TAB = `${kSELECTOR_LIVE_TAB}:not(.${kTAB_STATE_COLLAPSED}):not(.${kTAB_STATE_HIDDEN})`;
const kSELECTOR_CONTROLLABLE_TAB = `${kSELECTOR_LIVE_TAB}:not(.${kTAB_STATE_HIDDEN})`;
const kSELECTOR_PINNED_TAB = `${kSELECTOR_LIVE_TAB}.${kTAB_STATE_PINNED}`;

const kXPATH_LIVE_TAB = `xhtml:li[${hasClass('tab')}][not(${hasClass(kTAB_STATE_REMOVING)})]`;
const kXPATH_NORMAL_TAB = `${kXPATH_LIVE_TAB}[not(${hasClass(kTAB_STATE_HIDDEN)})][not(${hasClass(kTAB_STATE_PINNED)})]`;
const kXPATH_VISIBLE_TAB = `${kXPATH_LIVE_TAB}[not(${hasClass(kTAB_STATE_COLLAPSED)})][not(${hasClass(kTAB_STATE_HIDDEN)})]`;
const kXPATH_CONTROLLABLE_TAB = `${kXPATH_LIVE_TAB}[not(${hasClass(kTAB_STATE_HIDDEN)})]`;
const kXPATH_PINNED_TAB = `${kXPATH_LIVE_TAB}[${hasClass(kTAB_STATE_PINNED)}]`;

// basics
function assertValidHint(aHint) {
  if (!aHint)
    return;
  if (/string|number/.test(typeof aHint))
    return;
  if (aHint.parentNode)
    return;
  var error = new Error('FATAL ERROR: invalid hint is given');
  log(error.message, error.stack);
  throw error;
}

function getTabsContainer(aHint) {
  assertValidHint(aHint);

  if (!aHint)
    aHint = gTargetWindow || gAllTabs.firstChild;

  if (typeof aHint == 'number')
    return document.querySelector(`#window-${aHint}`);

  if (aHint && typeof aHint == 'object' && 'windowId' in aHint)
    return document.querySelector(`#window-${aHint.windowId}`);

  var tab = getTabFromChild(aHint);
  if (tab)
    return tab.parentNode;

  return null;
}

function getOrBuildTabsContainer(aHint) {
  var container = getTabsContainer(aHint);
  if (container)
    return container;

  if (typeof aHint != 'number')
    throw new Error(`The given ID seems invalid as an window id: ${aHint}`);

  container = buildTabsContainerFor(aHint);
  container.preventAutoGroupNewTabsUntil = Date.now() + configs.autoGroupNewTabsDelayOnNewWindow;
  gAllTabs.appendChild(container);
  return container;
}

function getTabFromChild(aNode) {
  if (!aNode)
    return null;
  return evaluateXPath(
    `ancestor-or-self::${kXPATH_LIVE_TAB}`,
    aNode,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getTabById(aIdOrInfo) {
  if (!aIdOrInfo)
    return null;
  var selector;
  if (typeof aIdOrInfo == 'string')
    selector = `${kSELECTOR_LIVE_TAB}#${aIdOrInfo}`;
  else if (typeof aIdOrInfo == 'number')
    selector = `${kSELECTOR_LIVE_TAB}[${kAPI_TAB_ID}="${aIdOrInfo}"]`;
  else if (!aIdOrInfo.window)
    selector = `${kSELECTOR_LIVE_TAB}[${kAPI_TAB_ID}="${aIdOrInfo.tab}"]`;
  else
    selector = `${kSELECTOR_LIVE_TAB}#tab-${aIdOrInfo.window}-${aIdOrInfo.tab}`;
  return document.querySelector(selector);
}

function getTabByUniqueId(aId) {
  if (!aId)
    return null;
  return document.querySelector(`${kSELECTOR_LIVE_TAB}[${kPERSISTENT_ID}="${aId}"]`);
}

function getTabLabel(aTab) {
  return aTab.querySelector(`.${kLABEL}`);
}

function getCurrentTab(aHint) {
  var container = getTabsContainer(aHint);
  return container.querySelector(`.${kTAB_STATE_ACTIVE}`);
}

function getNextTab(aTab) {
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  return document.querySelector(`#${aTab.id} ~ ${kSELECTOR_LIVE_TAB}`);
}

function getPreviousTab(aTab) {
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  return evaluateXPath(
    `preceding-sibling::${kXPATH_LIVE_TAB}[1]`,
    aTab,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getFirstTab(aHint) {
  var container = getTabsContainer(aHint);
  return container && container.querySelector(kSELECTOR_LIVE_TAB);
}

function getLastTab(aHint) {
  var container = getTabsContainer(aHint);
  if (!container)
    return null;
  return evaluateXPath(
    `child::${kXPATH_LIVE_TAB}[last()]`,
    container,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getLastOpenedTab(aHint) {
  var tabs = getTabs(aHint);
  return tabs.length > 0 ?
    tabs.sort((aA, aB) => aB.apiTab.id - aA.apiTab.id )[0] :
    null ;
}

function getTabIndex(aTab) {
  if (!aTab || !aTab.id)
    return -1;
  assertValidHint(aTab);
  return evaluateXPath(
    `count(preceding-sibling::${kXPATH_LIVE_TAB})`,
    aTab,
    XPathResult.NUMBER_TYPE
  ).numberValue;
}


function getNextNormalTab(aTab) {
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  return document.querySelector(`#${aTab.id} ~ ${kSELECTOR_NORMAL_TAB}`);
}

function getPreviousNormalTab(aTab) {
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  return evaluateXPath(
    `preceding-sibling::${kXPATH_NORMAL_TAB}[1]`,
    aTab,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}


// tree basics

function getParentTab(aChild) {
  if (!aChild)
    return null;
  assertValidHint(aChild);
  var id = aChild.getAttribute(kPARENT);
  if (id)
    return aChild.parentNode.querySelector(`${kSELECTOR_LIVE_TAB}#${id}`);
  return null;
}

function getAncestorTabs(aDecendant) {
  var ancestors = [];
  while (true) {
    let parent = getParentTab(aDecendant);
    if (!parent)
      break;
    ancestors.push(parent);
    aDecendant = parent;
  }
  return ancestors;
}

function getRootTab(aDecendant) {
  var ancestors = getAncestorTabs(aDecendant);
  return ancestors.length > 0 ? ancestors[ancestors.length-1] : aDecendant ;
}

function getSiblingTabs(aTab) {
  if (!aTab || !aTab.id)
    return [];
  assertValidHint(aTab);
  var parentId = aTab.getAttribute(kPARENT);
  if (!parentId)
    return getRootTabs(aTab);
  return aTab.parentNode.querySelector(`${kSELECTOR_LIVE_TAB}[${kPARENT}="${parentId}"]`);
}

function getNextSiblingTab(aTab) {
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  var parentId = aTab.getAttribute(kPARENT);
  var parentCondition = parentId ? `[${kPARENT}="${parentId}"]` : `:not([${kPARENT}])` ;
  return aTab.parentNode.querySelector(`#${aTab.id} ~ ${kSELECTOR_LIVE_TAB}${parentCondition}`);
}

function getPreviousSiblingTab(aTab) {
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  var parentId = aTab.getAttribute(kPARENT);
  var parentCondition = parentId ? `[@${kPARENT}="${parentId}"]` : `[not(@${kPARENT})]` ;
  return evaluateXPath(
    `preceding-sibling::${kXPATH_LIVE_TAB}${parentCondition}[1]`,
    aTab,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getChildTabs(aParent) {
  if (!aParent)
    return [];
  assertValidHint(aParent);
  return Array.slice(aParent.parentNode.querySelectorAll(`${kSELECTOR_LIVE_TAB}[${kPARENT}="${aParent.id}"]`));
}

function getFirstChildTab(aParent) {
  if (!aParent)
    return null;
  assertValidHint(aParent);
  return aParent.parentNode.querySelector(`${kSELECTOR_LIVE_TAB}[${kPARENT}="${aParent.id}"`);
}

function getLastChildTab(aParent) {
  if (!aParent)
    return null;
  assertValidHint(aParent);
  return evaluateXPath(
    `following-sibling::${kXPATH_LIVE_TAB}[@${kPARENT}="${aParent.id}"][last()]`,
    aParent,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getChildTabIndex(aChild, aParent) {
  if (!aChild)
    return -1;
  assertValidHint(aChild);
  assertValidHint(aParent);
  var parentId = (aParent && aParent.id) || aChild.getAttribute(kPARENT);
  var parentCondition = parentId ? `[@${kPARENT}="${parentId}"]` : `[not(@${kPARENT})]` ;
  return evaluateXPath(
    `count(preceding-sibling::${kXPATH_CONTROLLABLE_TAB}${parentCondition})`,
    aChild,
    XPathResult.NUMBER_TYPE
  ).numberValue;
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

function getLastDescendantTab(aRoot) {
  var descendants = getDescendantTabs(aRoot);
  return descendants.length ? descendants[descendants.length-1] : null ;
}


// grab tags

function getAllTabs(aHint) {
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_LIVE_TAB));
}

function getTabs(aHint) { // only visible, including collapsed and pinned
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_CONTROLLABLE_TAB));
}

function getNormalTabs(aHint) { // only visible, including collapsed, not pinned
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_NORMAL_TAB));
}

function getVisibleTabs(aHint) { // visible, not-collapsed, not-hidden
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_VISIBLE_TAB));
}

function getPinnedTabs(aHint) { // visible, pinned
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_PINNED_TAB));
}

function getAllRootTabs(aHint) {
  var container = getTabsContainer(aHint);
  return container.querySelector(`${kSELECTOR_LIVE_TAB}:not([${kPARENT}])`);
}

function getRootTabs(aHint) {
  var container = getTabsContainer(aHint);
  return container.querySelector(`${kSELECTOR_CONTROLLABLE_TAB}:not([${kPARENT}])`);
}

function getVisibleRootTabs(aHint) {
  var container = getTabsContainer(aHint);
  return container.querySelector(`${kSELECTOR_VISIBLE_TAB}:not([${kPARENT}])`);
}

function getVisibleLoadingTabs(aHint) {
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}.loading`));
}

function collectRootTabs(aTabs) {
  return aTabs.filter(aTab => {
    if (!aTab)
      return false;
    var parent = getParentTab(aTab);
    return !parent || aTabs.indexOf(parent) < 0;
  });
}

function getIndentedTabs(aHint) {
  var container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_CONTROLLABLE_TAB}[${kPARENT}]`));
}

function getVisibleIndentedTabs(aHint) {
  var container = getTabsContainer(aHint);
  return container.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}[${kPARENT}]`);
}

function getDraggingTabs(aHint) {
  var container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}.${kTAB_STATE_DRAGGING}`));
}

function getDuplicatingTabs(aHint) {
  var container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}.${kTAB_STATE_DUPLICATING}`));
}

function getSelectedTabs(aHint) {
  var container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}.${kTAB_STATE_SELECTED}`));
}



// misc.

function getFirstNormalTab(aHint) { // visible, not-collapsed, not-pinned
  var container = getTabsContainer(aHint);
  return container && container.querySelector(kSELECTOR_NORMAL_TAB);
}

function getFirstVisibleTab(aHint) { // visible, not-collapsed, not-hidden
  var container = getTabsContainer(aHint);
  return container && container.querySelector(kSELECTOR_VISIBLE_TAB);
}

function getLastVisibleTab(aHint) { // visible, not-collapsed, not-hidden
  var container = getTabsContainer(aHint);
  if (!container)
    return null;
  return evaluateXPath(
    `child::${kXPATH_VISIBLE_TAB}[last()]`,
    container,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getNextVisibleTab(aTab) { // visible, not-collapsed
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  return document.querySelector(`#${aTab.id} ~ ${kSELECTOR_VISIBLE_TAB}`);
}

function getPreviousVisibleTab(aTab) { // visible, not-collapsed
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  return evaluateXPath(
    `preceding-sibling::${kXPATH_VISIBLE_TAB}[1]`,
    aTab,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getVisibleIndex(aTab) {
  if (!aTab || !aTab.id)
    return -1;
  assertValidHint(aTab);
  return evaluateXPath(
    `count(preceding-sibling::${kXPATH_VISIBLE_TAB})`,
    aTab,
    XPathResult.NUMBER_TYPE
  ).numberValue;
}

async function doAndGetNewTabs(aAsyncTask, aHint) {
  var tabsQueryOptions = {
    windowType: 'normal'
  };
  if (aHint) {
    let container = getTabsContainer(aHint);
    if (container)
      tabsQueryOptions.windowId = container.windowId;
  }
  var beforeApiTabs = await browser.tabs.query(tabsQueryOptions);
  var beforeApiIds = beforeApiTabs.map(aApiTab => aApiTab.id);
  await aAsyncTask();
  var afterApiTabs = await browser.tabs.query(tabsQueryOptions);
  var addedApiTabs = afterApiTabs.filter(aAfterApiTab => beforeApiIds.indexOf(aAfterApiTab.id) < 0);
  var addedTabs = addedApiTabs.map(aApiTab => getTabById({ tab: aApiTab.id, window: aApiTab.windowId })
  );
  return addedTabs;
}

function getNextFocusedTab(aTab) { // if the current tab is closed...
  return getNextSiblingTab(aTab) || getPreviousVisibleTab(aTab);
}
