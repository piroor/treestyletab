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

// Defined in a classic script source, and we can read these as global variables. 
/* global
  gTargetWindow: false,
  gAllTabs: false,
  buildTabsContainerFor: false,
  makeTabId: false,
  isCollapsed: false,
  isGroupTab: false,
 */

import * as XPath from './xpath.js';
import * as Constants from './constants.js';
import { log } from './common.js';

const kSELECTOR_LIVE_TAB         = `li.tab:not(.${Constants.kTAB_STATE_REMOVING})`;
const kSELECTOR_NORMAL_TAB       = `${kSELECTOR_LIVE_TAB}:not(.${Constants.kTAB_STATE_HIDDEN}):not(.${Constants.kTAB_STATE_PINNED})`;
const kSELECTOR_VISIBLE_TAB      = `${kSELECTOR_LIVE_TAB}:not(.${Constants.kTAB_STATE_COLLAPSED}):not(.${Constants.kTAB_STATE_HIDDEN})`;
const kSELECTOR_CONTROLLABLE_TAB = `${kSELECTOR_LIVE_TAB}:not(.${Constants.kTAB_STATE_HIDDEN})`;
const kSELECTOR_PINNED_TAB       = `${kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_PINNED}`;

const kXPATH_LIVE_TAB         = `li[${XPath.hasClass('tab')}][not(${XPath.hasClass(Constants.kTAB_STATE_REMOVING)})]`;
const kXPATH_NORMAL_TAB       = `${kXPATH_LIVE_TAB}[not(${XPath.hasClass(Constants.kTAB_STATE_HIDDEN)})][not(${XPath.hasClass(Constants.kTAB_STATE_PINNED)})]`;
const kXPATH_VISIBLE_TAB      = `${kXPATH_LIVE_TAB}[not(${XPath.hasClass(Constants.kTAB_STATE_COLLAPSED)})][not(${XPath.hasClass(Constants.kTAB_STATE_HIDDEN)})]`;
const kXPATH_CONTROLLABLE_TAB = `${kXPATH_LIVE_TAB}[not(${XPath.hasClass(Constants.kTAB_STATE_HIDDEN)})]`;
const kXPATH_PINNED_TAB       = `${kXPATH_LIVE_TAB}[${XPath.hasClass(Constants.kTAB_STATE_PINNED)}]`;

// basics
function assertValidHint(aHint) {
  if (!aHint)
    return;
  if (/string|number/.test(typeof aHint))
    return;
  if (aHint.parentNode)
    return;
  const error = new Error('FATAL ERROR: invalid hint is given');
  log(error.message, error.stack);
  throw error;
}

export function getTabsContainer(aHint) {
  assertValidHint(aHint);

  if (!aHint)
    aHint = gTargetWindow || gAllTabs.firstChild;

  if (typeof aHint == 'number')
    return document.querySelector(`#window-${aHint}`);

  if (aHint &&
      typeof aHint == 'object' &&
      aHint.dataset &&
      aHint.dataset.windowId)
    return document.querySelector(`#window-${aHint.dataset.windowId}`);

  const tab = getTabFromChild(aHint);
  if (tab)
    return tab.parentNode;

  return null;
}

export function getOrBuildTabsContainer(aHint) {
  let container = getTabsContainer(aHint);
  if (container)
    return container;

  if (typeof aHint != 'number')
    throw new Error(`The given ID seems invalid as an window id: ${aHint}`);

  container = buildTabsContainerFor(aHint);
  gAllTabs.appendChild(container);
  return container;
}

export function getTabFromChild(aNode) {
  if (!aNode)
    return null;
  if (aNode.nodeType != Node.ELEMENT_NODE)
    aNode = aNode.parentNode;
  return aNode && aNode.closest(kSELECTOR_LIVE_TAB);
}

export function getTabById(aIdOrInfo) {
  if (!aIdOrInfo)
    return null;

  if (aIdOrInfo.nodeType == Node.ELEMENT_NODE) // tab element itself
    return aIdOrInfo;

  if (typeof aIdOrInfo == 'string') { // tab-x-x
    const tab = document.getElementById(aIdOrInfo);
    if (tab)
      return tab.matches(kSELECTOR_LIVE_TAB) ? tab : null ;
    else // possible unique id
      return getTabByUniqueId(aIdOrInfo);
  }

  if (typeof aIdOrInfo == 'number') // tabs.Tab.id
    return document.querySelector(`${kSELECTOR_LIVE_TAB}[${Constants.kAPI_TAB_ID}="${aIdOrInfo}"]`);

  if (aIdOrInfo.id && aIdOrInfo.windowId) { // tabs.Tab
    const tab = document.getElementById(makeTabId(aIdOrInfo));
    return tab && tab.matches(kSELECTOR_LIVE_TAB) ? tab : null ;
  }
  else if (!aIdOrInfo.window) { // { tab: tabs.Tab.id }
    return document.querySelector(`${kSELECTOR_LIVE_TAB}[${Constants.kAPI_TAB_ID}="${aIdOrInfo.tab}"]`);
  }
  else { // { tab: tabs.Tab.id, window: windows.Window.id }
    const tab = document.getElementById(`tab-${aIdOrInfo.window}-${aIdOrInfo.tab}`);
    return tab && tab.matches(kSELECTOR_LIVE_TAB) ? tab : null ;
  }

  return null;
}

export function getTabByUniqueId(aId) {
  if (!aId)
    return null;
  return document.querySelector(`${kSELECTOR_LIVE_TAB}[${Constants.kPERSISTENT_ID}="${aId}"]`);
}

export function getTabLabel(aTab) {
  return aTab && aTab.querySelector(`.${Constants.kLABEL}`);
}

export function getTabLabelContent(aTab) {
  return aTab && aTab.querySelector(`.${Constants.kLABEL}-content`);
}

// Note that this function can return null if it is the first tab of
// a new window opened by the "move tab to new window" command.
export function getCurrentTab(aHint) {
  const container = getTabsContainer(aHint);
  return container && container.querySelector(`.${Constants.kTAB_STATE_ACTIVE}`);
}
export function getCurrentTabs() {
  return Array.slice(document.querySelectorAll(`.${Constants.kTAB_STATE_ACTIVE}`));
}

export function getNextTab(aTab) {
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  let next = aTab;
  while ((next = next.nextElementSibling)) {
    if (next.matches(kSELECTOR_LIVE_TAB))
      return next;
  }
  return null;
  // don't use '~' selector, it is too slow...
  //return document.querySelector(`#${aTab.id} ~ ${kSELECTOR_LIVE_TAB}`);
}

export function getPreviousTab(aTab) {
  if (!aTab || !aTab.id)
    return null;
  assertValidHint(aTab);
  let previous = aTab;
  while ((previous = previous.previousElementSibling)) {
    if (previous.matches(kSELECTOR_LIVE_TAB))
      return previous;
  }
  return null;
}

export function getFirstTab(aHint) {
  const container = getTabsContainer(aHint);
  return container && container.querySelector(kSELECTOR_LIVE_TAB);
}

export function getLastTab(aHint) {
  const container = getTabsContainer(aHint);
  if (!container)
    return null;
  const tabs = container.querySelectorAll(kSELECTOR_LIVE_TAB);
  return tabs.length > 0 ? tabs[tabs.length - 1] : null;
}

export function getLastOpenedTab(aHint) {
  const tabs = getTabs(aHint);
  return tabs.length > 0 ?
    tabs.sort((aA, aB) => aB.apiTab.id - aA.apiTab.id)[0] :
    null ;
}

export function getTabIndex(aTab, aOptions = {}) {
  if (!ensureLivingTab(aTab))
    return -1;
  assertValidHint(aTab);

  let tabs = getAllTabs(aTab);
  if (Array.isArray(aOptions.ignoreTabs) &&
      aOptions.ignoreTabs.length > 0)
    tabs = tabs.filter(aTab => aOptions.ignoreTabs.indexOf(aTab) < 0);

  return tabs.indexOf(aTab);
}

export function calculateNewTabIndex(aParams) {
  if (aParams.insertBefore)
    return getTabIndex(aParams.insertBefore, aParams);
  if (aParams.insertAfter)
    return getTabIndex(aParams.insertAfter, aParams) + 1;
  return -1;
}


export function getNextNormalTab(aTab) {
  if (!ensureLivingTab(aTab))
    return null;
  assertValidHint(aTab);
  let next = aTab;
  while ((next = next.nextElementSibling)) {
    if (next.matches(kSELECTOR_NORMAL_TAB))
      return next;
  }
  return null;
  // don't use '~' selector, it is too slow...
  //return document.querySelector(`#${aTab.id} ~ ${kSELECTOR_NORMAL_TAB}`);
}

export function getPreviousNormalTab(aTab) {
  if (!ensureLivingTab(aTab))
    return null;
  assertValidHint(aTab);
  let previous = aTab;
  while ((previous = previous.previousElementSibling)) {
    if (previous.matches(kSELECTOR_NORMAL_TAB))
      return previous;
  }
  return null;
}


// tree basics

export function ensureLivingTab(aTab) {
  if (!aTab ||
      !aTab.id ||
      !aTab.parentNode ||
      aTab[Constants.kTAB_STATE_REMOVING])
    return null;
  return aTab;
}

export function assertInitializedTab(aTab) {
  if (!aTab.apiTab)
    throw new Error(`FATAL ERROR: the tab ${aTab.id} is not initialized yet correctly! (no API tab information)\n${new Error().stack}`);
  if (!aTab.childTabs)
    throw new Error(`FATAL ERROR: the tab ${aTab.id} is not initialized yet correctly! (missing priperty "childTabs")\n${new Error().stack}`);
  return true;
}

export function getOpenerTab(aTab) {
  if (!ensureLivingTab(aTab) ||
      !aTab.apiTab ||
      !aTab.apiTab.openerTabId ||
      aTab.apiTab.openerTabId == aTab.apiTab.id)
    return null;
  return getTabById({ id: aTab.apiTab.openerTabId, windowId: aTab.apiTab.windowId });
}

export function getParentTab(aChild) {
  if (!ensureLivingTab(aChild))
    return null;
  assertValidHint(aChild);
  return ensureLivingTab(aChild.parentTab);
}

export function getAncestorTabs(aDescendant, aOptions = {}) {
  if (!aDescendant)
    return [];
  if (!aOptions.force)
    return (
      // slice(0) is required to guard the cached array from destructive methods liek sort()!
      aDescendant.ancestorTabs && aDescendant.ancestorTabs.slice(0) ||
      []
    );
  const ancestors = [];
  while (true) {
    const parent = getParentTab(aDescendant);
    if (!parent)
      break;
    ancestors.push(parent);
    aDescendant = parent;
  }
  return ancestors;
}

export function getVisibleAncestorOrSelf(aDescendant) {
  if (!isCollapsed(aDescendant))
    return aDescendant;
  for (let ancestor of getAncestorTabs(aDescendant)) {
    if (!isCollapsed(ancestor))
      return ancestor;
  }
  return null;
}

export function getRootTab(aDescendant) {
  const ancestors = getAncestorTabs(aDescendant);
  return ancestors.length > 0 ? ancestors[ancestors.length-1] : aDescendant ;
}

function getSiblingTabs(aTab) {
  if (!ensureLivingTab(aTab))
    return [];
  assertValidHint(aTab);
  if (!ensureLivingTab(aTab.parentTab))
    return getRootTabs(aTab);
  assertInitializedTab(aTab);
  assertInitializedTab(aTab.parentTab);
  return aTab.parentTab.childTabs.filter(ensureLivingTab);
}

export function getNextSiblingTab(aTab) {
  if (!ensureLivingTab(aTab))
    return null;
  assertValidHint(aTab);
  const siblings = getSiblingTabs(aTab);
  const index = siblings.indexOf(aTab);
  return index < siblings.length - 1 ? siblings[index + 1] : null ;
}

export function getPreviousSiblingTab(aTab) {
  if (!ensureLivingTab(aTab))
    return null;
  assertValidHint(aTab);
  const siblings = getSiblingTabs(aTab);
  const index = siblings.indexOf(aTab);
  return index > 0 ? siblings[index - 1] : null ;
}

export function getChildTabs(aParent) {
  if (!ensureLivingTab(aParent))
    return [];
  assertValidHint(aParent);
  assertInitializedTab(aParent);
  return aParent.childTabs.filter(ensureLivingTab);
}

export function getFirstChildTab(aParent) {
  if (!ensureLivingTab(aParent))
    return null;
  assertValidHint(aParent);
  assertInitializedTab(aParent);
  const tabs = aParent.childTabs.filter(ensureLivingTab);
  return tabs.length > 0 ? tabs[0] : null ;
}

export function getLastChildTab(aParent) {
  if (!ensureLivingTab(aParent))
    return null;
  assertValidHint(aParent);
  assertInitializedTab(aParent);
  const tabs = aParent.childTabs.filter(ensureLivingTab);
  return tabs.length > 0 ? tabs[tabs.length - 1] : null ;
}

function getChildTabIndex(aChild, aParent) {
  if (!ensureLivingTab(aChild) ||
      !ensureLivingTab(aParent))
    return -1;
  assertValidHint(aChild);
  assertValidHint(aParent);
  assertInitializedTab(aParent);
  const tabs = aParent.childTabs.filter(ensureLivingTab);
  return tabs.indexOf(aChild);
}

export function getDescendantTabs(aRoot) {
  if (!ensureLivingTab(aRoot))
    return [];
  assertValidHint(aRoot);
  assertInitializedTab(aRoot);

  let descendants = [];
  const children = aRoot.childTabs.filter(ensureLivingTab);
  for (let child of children) {
    descendants.push(child);
    descendants = descendants.concat(getDescendantTabs(child));
  }
  return descendants;
}

export function getLastDescendantTab(aRoot) {
  const descendants = getDescendantTabs(aRoot);
  return descendants.length ? descendants[descendants.length-1] : null ;
}


// grab tags

export function getAllTabs(aHint) {
  const container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_LIVE_TAB));
}

export function getTabs(aHint) { // only visible, including collapsed and pinned
  const container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_CONTROLLABLE_TAB));
}

export function getNormalTabs(aHint) { // only visible, including collapsed, not pinned
  const container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_NORMAL_TAB));
}

export function getVisibleTabs(aHint) { // visible, not-collapsed, not-hidden
  const container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_VISIBLE_TAB));
}

export function getPinnedTabs(aHint) { // visible, pinned
  const container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_PINNED_TAB));
}

function getUnpinnedTabs(aHint) { // visible, not pinned
  const container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}:not(.${Constants.kTAB_STATE_PINNED})`));
}

function getAllRootTabs(aHint) {
  const container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}:not([${Constants.kPARENT}])`));
}

export function getRootTabs(aHint) {
  const container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_CONTROLLABLE_TAB}:not([${Constants.kPARENT}])`));
}

function getVisibleRootTabs(aHint) {
  const container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}:not([${Constants.kPARENT}])`));
}

function getVisibleLoadingTabs(aHint) {
  const container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}.loading`));
}

export function collectRootTabs(aTabs) {
  return aTabs.filter(aTab => {
    if (!ensureLivingTab(aTab))
      return false;
    const parent = getParentTab(aTab);
    return !parent || aTabs.indexOf(parent) < 0;
  });
}

function getIndentedTabs(aHint) {
  const container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_CONTROLLABLE_TAB}[${Constants.kPARENT}]`));
}

function getVisibleIndentedTabs(aHint) {
  const container = getTabsContainer(aHint);
  return container.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}[${Constants.kPARENT}]`);
}

export function getDraggingTabs(aHint) {
  const container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_DRAGGING}`));
}

export function getDuplicatingTabs(aHint) {
  const container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_DUPLICATING}`));
}

export function getSelectedTabs(aHint) {
  const container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_SELECTED}`));
}



// misc.

export function getFirstNormalTab(aHint) { // visible, not-collapsed, not-pinned
  const container = getTabsContainer(aHint);
  return container && container.querySelector(kSELECTOR_NORMAL_TAB);
}

export function getFirstVisibleTab(aHint) { // visible, not-collapsed, not-hidden
  const container = getTabsContainer(aHint);
  return container && container.querySelector(kSELECTOR_VISIBLE_TAB);
}

function getLastVisibleTab(aHint) { // visible, not-collapsed, not-hidden
  const container = getTabsContainer(aHint);
  if (!container)
    return null;
  return XPath.evaluate(
    `child::${kXPATH_VISIBLE_TAB}[last()]`,
    container,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

export function getNextVisibleTab(aTab) { // visible, not-collapsed
  if (!ensureLivingTab(aTab))
    return null;
  assertValidHint(aTab);
  let next = aTab;
  while ((next = next.nextElementSibling)) {
    if (next.matches(kSELECTOR_VISIBLE_TAB))
      return next;
  }
  return null;
  // don't use '~' selector, it is too slow...
  //return document.querySelector(`#${aTab.id} ~ ${kSELECTOR_VISIBLE_TAB}`);
}

export function getPreviousVisibleTab(aTab) { // visible, not-collapsed
  if (!ensureLivingTab(aTab))
    return null;
  assertValidHint(aTab);
  let previous = aTab;
  while ((previous = previous.previousElementSibling)) {
    if (previous.matches(kSELECTOR_VISIBLE_TAB))
      return previous;
  }
  return null;
}

function getVisibleIndex(aTab) {
  if (!ensureLivingTab(aTab))
    return -1;
  assertValidHint(aTab);
  return XPath.evaluate(
    `count(preceding-sibling::${kXPATH_VISIBLE_TAB})`,
    aTab,
    XPathResult.NUMBER_TYPE
  ).numberValue;
}

export async function doAndGetNewTabs(aAsyncTask, aHint) {
  const tabsQueryOptions = {
    windowType: 'normal'
  };
  if (aHint) {
    let container = getTabsContainer(aHint);
    if (container)
      tabsQueryOptions.windowId = parseInt(container.dataset.windowId);
  }
  const beforeApiTabs = await browser.tabs.query(tabsQueryOptions);
  const beforeApiIds  = beforeApiTabs.map(aApiTab => aApiTab.id);
  await aAsyncTask();
  const afterApiTabs = await browser.tabs.query(tabsQueryOptions);
  const addedApiTabs = afterApiTabs.filter(aAfterApiTab => beforeApiIds.indexOf(aAfterApiTab.id) < 0);
  const addedTabs    = addedApiTabs.map(getTabById);
  return addedTabs;
}

export function getNextFocusedTab(aTab, aOptions = {}) { // if the current tab is closed...
  const ignoredTabs = (aOptions.ignoredTabs || []).slice(0);
  let tab = aTab;
  do {
    ignoredTabs.push(tab);
    tab = getNextSiblingTab(tab);
  } while (tab && ignoredTabs.indexOf(tab) > -1);
  if (!tab) {
    tab = aTab;
    do {
      ignoredTabs.push(tab);
      tab = getPreviousVisibleTab(tab);
    } while (tab && ignoredTabs.indexOf(tab) > -1);
  }
  return tab;
}


export function getGroupTabForOpener(aOpener) {
  const tab = (aOpener instanceof Element) ? aOpener : (getTabById(aOpener) || getTabByUniqueId(aOpener));
  if (!tab)
    return null;
  return tab.parentNode.querySelector(`${kSELECTOR_LIVE_TAB}[${Constants.kCURRENT_URI}$="openerTabId=${tab.getAttribute(Constants.kPERSISTENT_ID)}"],
                                       ${kSELECTOR_LIVE_TAB}[${Constants.kCURRENT_URI}*="openerTabId=${tab.getAttribute(Constants.kPERSISTENT_ID)}#"],
                                       ${kSELECTOR_LIVE_TAB}[${Constants.kCURRENT_URI}*="openerTabId=${tab.getAttribute(Constants.kPERSISTENT_ID)}&"]`);
}

export function getOpenerFromGroupTab(aGroupTab) {
  if (!isGroupTab(aGroupTab))
    return null;
  const matchedOpenerTabId = aGroupTab.apiTab.url.match(/openerTabId=([^&;]+)/);
  return matchedOpenerTabId && getTabById(matchedOpenerTabId[1]);
}
