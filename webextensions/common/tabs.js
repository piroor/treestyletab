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

import * as XPath from './xpath.js';
import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import {
  log as internalLogger,
  configs
} from './common.js';

import EventListenerManager from './EventListenerManager.js';

function log(...aArgs) {
  if (configs.logFor['common/tabs'])
    internalLogger(...aArgs);
}


let gTargetWindow;

export const allTabsContainer = document.querySelector('#all-tabs');


//===================================================================
// Tab Related Utilities
//===================================================================

export function setWindow(aTargetWindow) {
  return gTargetWindow = aTargetWindow;
}

export function getWindow() {
  return gTargetWindow;
}

export function getSafeFaviconUrl(aURL) {
  switch (aURL) {
    case 'chrome://browser/skin/settings.svg':
      return browser.extension.getURL('resources/icons/settings.svg');
    case 'chrome://mozapps/skin/extensions/extensionGeneric-16.svg':
      return browser.extension.getURL('resources/icons/extensionGeneric-16.svg');
    case 'chrome://browser/skin/privatebrowsing/favicon.svg':
      return browser.extension.getURL('resources/icons/privatebrowsing-favicon.svg');
    default:
      if (/^chrome:\/\//.test(aURL) &&
          !/^chrome:\/\/branding\//.test(aURL))
        return browser.extension.getURL('resources/icons/globe-16.svg');
      break;
  }
  return aURL;
}


//===================================================================
// Operate Tab ID
//===================================================================

export function makeTabId(aApiTab) {
  return `tab-${aApiTab.windowId}-${aApiTab.id}`;
}

export async function requestUniqueId(aTabOrId, aOptions = {}) {
  let tabId = aTabOrId;
  let tab   = null;
  if (typeof aTabOrId == 'number') {
    tab = getTabById(aTabOrId);
  }
  else {
    tabId = aTabOrId.apiTab.id;
    tab   = aTabOrId;
  }

  if (aOptions.inRemote) {
    return await browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_REQUEST_UNIQUE_ID,
      id:       tabId,
      forceNew: !!aOptions.forceNew
    });
  }

  let originalId    = null;
  let originalTabId = null;
  let duplicated    = false;
  if (!aOptions.forceNew) {
    let oldId = await browser.sessions.getTabValue(tabId, Constants.kPERSISTENT_ID);
    if (oldId && !oldId.tabId) // ignore broken information!
      oldId = null;

    if (oldId) {
      // If the tab detected from stored tabId is different, it is duplicated tab.
      try {
        const tabWithOldId = getTabById(oldId.tabId);
        if (!tabWithOldId)
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
        originalId = tabWithOldId.getAttribute(Constants.kPERSISTENT_ID) /* (await tabWithOldId.uniqueId).id // don't try to wait this, because it sometime causes deadlock */;
        duplicated = tab && tabWithOldId != tab && originalId == oldId.id;
        if (duplicated)
          originalTabId = oldId.tabId;
        else
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
      }
      catch(e) {
        ApiTabs.handleMissingTabError(e);
        // It fails if the tab doesn't exist.
        // There is no live tab for the tabId, thus
        // this seems to be a tab restored from session.
        // We need to update the related tab id.
        await browser.sessions.setTabValue(tabId, Constants.kPERSISTENT_ID, {
          id:    oldId.id,
          tabId: tabId
        });
        return {
          id:            oldId.id,
          originalId:    null,
          originalTabId: oldId.tabId,
          restored:      true
        };
      }
    }
  }

  const adjective   = Constants.kID_ADJECTIVES[Math.floor(Math.random() * Constants.kID_ADJECTIVES.length)];
  const noun        = Constants.kID_NOUNS[Math.floor(Math.random() * Constants.kID_NOUNS.length)];
  const randomValue = Math.floor(Math.random() * 1000);
  const id          = `tab-${adjective}-${noun}-${Date.now()}-${randomValue}`;
  // tabId is for detecttion of duplicated tabs
  await browser.sessions.setTabValue(tabId, Constants.kPERSISTENT_ID, { id, tabId });
  return { id, originalId, originalTabId, duplicated };
}

export function updateUniqueId(aTab) {
  aTab.uniqueId = requestUniqueId(aTab, {
    inRemote: !!gTargetWindow
  }).then(aUniqueId => {
    if (aUniqueId && ensureLivingTab(aTab)) // possibly removed from document while waiting
      aTab.setAttribute(Constants.kPERSISTENT_ID, aUniqueId.id);
    return aUniqueId || {};
  }).catch(aError => {
    console.log(`FATAL ERROR: Failed to get unique id for a tab ${aTab.apiTab.id}: `, String(aError), aError.stack);
    return {};
  });
  return aTab.uniqueId;
}

export async function getUniqueIds(aApiTabs) {
  const uniqueIds = await Promise.all(aApiTabs.map(aApiTab => browser.sessions.getTabValue(aApiTab.id, Constants.kPERSISTENT_ID)));
  return uniqueIds.map(aId => aId && aId.id || '?');
}


//===================================================================
// Event Handling
//===================================================================

export const onBuilt            = new EventListenerManager();
export const onGroupTabDetected = new EventListenerManager();
export const onLabelUpdated     = new EventListenerManager();
export const onFaviconUpdated   = new EventListenerManager();
export const onStateChanged     = new EventListenerManager();
export const onPinned           = new EventListenerManager();
export const onUnpinned         = new EventListenerManager();
export const onHidden           = new EventListenerManager();
export const onShown            = new EventListenerManager();
export const onParentTabUpdated = new EventListenerManager();
export const onTabElementMoved  = new EventListenerManager();
export const onCollapsedStateChanging = new EventListenerManager();
export const onCollapsedStateChanged  = new EventListenerManager();

export const onCreating         = new EventListenerManager();
export const onCreated          = new EventListenerManager();
export const onRemoving         = new EventListenerManager();
export const onRemoved          = new EventListenerManager();
export const onMoving           = new EventListenerManager();
export const onMoved            = new EventListenerManager();
export const onActivating       = new EventListenerManager();
export const onActivated        = new EventListenerManager();
export const onUpdated          = new EventListenerManager();
export const onRestoring        = new EventListenerManager();
export const onRestored         = new EventListenerManager();
export const onWindowRestoring  = new EventListenerManager();
export const onAttached         = new EventListenerManager();
export const onDetached         = new EventListenerManager();

async function waitUntilTabsAreOperated(aIdOrIds, aSlot) {
  if (!Array.isArray(aIdOrIds))
    aIdOrIds = [aIdOrIds];
  const operatingTabs = aIdOrIds
    .map(aId => parseInt(aId))
    .filter(aId => !!aId)
    .map(aId => typeof aId == 'string' ? parseInt(aId.match(/^tab-\d+-(\d+)$/)[1]) : aId)
    .map(aId => aSlot.get(aId))
    .filter(aOperating => !!aOperating);
  if (operatingTabs.length)
    return Promise.all(operatingTabs);
  return [];
}

const gCreatingTabs = new Map();

export function addCreatingTab(aTab) {
  let onTabCreated;
  if (configs.acceleratedTabCreation) {
    gCreatingTabs.set(aTab.apiTab.id, aTab.uniqueId);
    onTabCreated = () => {};
  }
  else {
    gCreatingTabs.set(aTab.apiTab.id, new Promise((aResolve, _aReject) => {
      onTabCreated = (aUniqueId) => { aResolve(aUniqueId); };
    }));
  }
  aTab.uniqueId.then(_aUniqueId => {
    gCreatingTabs.delete(aTab.apiTab.id);
  });
  return onTabCreated;
}

export function hasCreatingTab() {
  return gCreatingTabs.size > 0;
}

export async function waitUntilAllTabsAreCreated() {
  return waitUntilTabsAreCreated(Array.from(gCreatingTabs.keys()));
}

export async function waitUntilTabsAreCreated(aIdOrIds) {
  return waitUntilTabsAreOperated(aIdOrIds, gCreatingTabs)
    .then(aUniqueIds => aUniqueIds.map(aUniqueId => getTabByUniqueId(aUniqueId.id)));
}

const gMovingTabs = new Map();

export function addMovingTabId(aTabId) {
  let onTabMoved;
  const promisedMoved = new Promise((aResolve, _aReject) => {
    onTabMoved = aResolve;
  });
  gMovingTabs.set(aTabId, promisedMoved);
  promisedMoved.then(() => {
    gMovingTabs.delete(aTabId);
  });
  return onTabMoved;
}

export async function waitUntilAllTabsAreMoved() {
  return waitUntilTabsAreOperated(Array.from(gMovingTabs.keys()), gMovingTabs);
}


//===================================================================
// Create Tabs
//===================================================================

export function buildTab(aApiTab, aOptions = {}) {
  log('build tab for ', aApiTab);
  const tab = document.createElement('li');
  tab.apiTab = aApiTab;
  tab.setAttribute('id', makeTabId(aApiTab));
  tab.setAttribute(Constants.kAPI_TAB_ID, aApiTab.id || -1);
  tab.setAttribute(Constants.kAPI_WINDOW_ID, aApiTab.windowId || -1);
  //tab.setAttribute(Constants.kCHILDREN, '');
  tab.classList.add('tab');
  if (aApiTab.active)
    tab.classList.add(Constants.kTAB_STATE_ACTIVE);
  tab.classList.add(Constants.kTAB_STATE_SUBTREE_COLLAPSED);

  const labelContainer = document.createElement('span');
  labelContainer.classList.add(Constants.kLABEL);
  const label = labelContainer.appendChild(document.createElement('span'));
  label.classList.add(`${Constants.kLABEL}-content`);
  tab.appendChild(labelContainer);

  onBuilt.dispatch(tab, aOptions);

  if (aOptions.existing) {
    tab.classList.add(Constants.kTAB_STATE_ANIMATION_READY);
  }

  if (aApiTab.id)
    updateUniqueId(tab);
  else
    tab.uniqueId = Promise.resolve({
      id:            null,
      originalId:    null,
      originalTabId: null
    });

  tab.childTabs = [];
  tab.parentTab = null;
  tab.ancestorTabs = [];

  initPromisedStatus(tab);

  return tab;
}


//===================================================================
// Get Tabs
//===================================================================

export const kSELECTOR_LIVE_TAB         = `li.tab:not(.${Constants.kTAB_STATE_REMOVING})`;
export const kSELECTOR_NORMAL_TAB       = `${kSELECTOR_LIVE_TAB}:not(.${Constants.kTAB_STATE_HIDDEN}):not(.${Constants.kTAB_STATE_PINNED})`;
export const kSELECTOR_VISIBLE_TAB      = `${kSELECTOR_LIVE_TAB}:not(.${Constants.kTAB_STATE_COLLAPSED}):not(.${Constants.kTAB_STATE_HIDDEN})`;
export const kSELECTOR_CONTROLLABLE_TAB = `${kSELECTOR_LIVE_TAB}:not(.${Constants.kTAB_STATE_HIDDEN})`;
export const kSELECTOR_PINNED_TAB       = `${kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_PINNED}`;

export const kXPATH_LIVE_TAB         = `li[${XPath.hasClass('tab')}][not(${XPath.hasClass(Constants.kTAB_STATE_REMOVING)})]`;
//const kXPATH_NORMAL_TAB       = `${kXPATH_LIVE_TAB}[not(${XPath.hasClass(Constants.kTAB_STATE_HIDDEN)})][not(${XPath.hasClass(Constants.kTAB_STATE_PINNED)})]`;
//const kXPATH_VISIBLE_TAB      = `${kXPATH_LIVE_TAB}[not(${XPath.hasClass(Constants.kTAB_STATE_COLLAPSED)})][not(${XPath.hasClass(Constants.kTAB_STATE_HIDDEN)})]`;
//const kXPATH_CONTROLLABLE_TAB = `${kXPATH_LIVE_TAB}[not(${XPath.hasClass(Constants.kTAB_STATE_HIDDEN)})]`;
//const kXPATH_PINNED_TAB       = `${kXPATH_LIVE_TAB}[${XPath.hasClass(Constants.kTAB_STATE_PINNED)}]`;

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
    aHint = gTargetWindow || allTabsContainer.firstChild;

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
    tabs = tabs.filter(aTab => !aOptions.ignoreTabs.includes(aTab));

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

function assertInitializedTab(aTab) {
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
  for (const ancestor of getAncestorTabs(aDescendant)) {
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

/*
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
*/

export function getDescendantTabs(aRoot) {
  if (!ensureLivingTab(aRoot))
    return [];
  assertValidHint(aRoot);
  assertInitializedTab(aRoot);

  let descendants = [];
  const children = aRoot.childTabs.filter(ensureLivingTab);
  for (const child of children) {
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

function getVisibleTabs(aHint) { // visible, not-collapsed, not-hidden
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

/*
function getUnpinnedTabs(aHint) { // visible, not pinned
  const container = getTabsContainer(aHint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}:not(.${Constants.kTAB_STATE_PINNED})`));
}
*/

/*
function getAllRootTabs(aHint) {
  const container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}:not([${Constants.kPARENT}])`));
}
*/

export function getRootTabs(aHint) {
  const container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_CONTROLLABLE_TAB}:not([${Constants.kPARENT}])`));
}

/*
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
*/

export function collectRootTabs(aTabs) {
  return aTabs.filter(aTab => {
    if (!ensureLivingTab(aTab))
      return false;
    const parent = getParentTab(aTab);
    return !parent || !aTabs.includes(parent);
  });
}

/*
function getIndentedTabs(aHint) {
  const container = getTabsContainer(aHint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_CONTROLLABLE_TAB}[${Constants.kPARENT}]`));
}

function getVisibleIndentedTabs(aHint) {
  const container = getTabsContainer(aHint);
  return container.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}[${Constants.kPARENT}]`);
}
*/

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

/*
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
*/

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

/*
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
*/

export async function doAndGetNewTabs(aAsyncTask, aHint) {
  const tabsQueryOptions = {
    windowType: 'normal'
  };
  if (aHint) {
    const container = getTabsContainer(aHint);
    if (container)
      tabsQueryOptions.windowId = parseInt(container.dataset.windowId);
  }
  const beforeApiTabs = await browser.tabs.query(tabsQueryOptions);
  const beforeApiIds  = beforeApiTabs.map(aApiTab => aApiTab.id);
  await aAsyncTask();
  const afterApiTabs = await browser.tabs.query(tabsQueryOptions);
  const addedApiTabs = afterApiTabs.filter(aAfterApiTab => !beforeApiIds.includes(aAfterApiTab.id));
  const addedTabs    = addedApiTabs.map(getTabById);
  return addedTabs;
}

export function getNextFocusedTab(aTab, aOptions = {}) { // if the current tab is closed...
  const ignoredTabs = (aOptions.ignoredTabs || []).slice(0);
  let foundTab = aTab;
  do {
    ignoredTabs.push(foundTab);
    foundTab = getNextSiblingTab(foundTab);
  } while (foundTab && ignoredTabs.includes(foundTab));
  if (!foundTab) {
    foundTab = aTab;
    do {
      ignoredTabs.push(foundTab);
      foundTab = getPreviousVisibleTab(foundTab);
    } while (foundTab && ignoredTabs.includes(foundTab));
  }
  return foundTab;
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




//===================================================================
// Tab Information
//===================================================================

export function isActive(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_ACTIVE);
}

export function isPinned(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_PINNED);
}

export function isAudible(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_AUDIBLE);
}

export function isSoundPlaying(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_SOUND_PLAYING);
}

export function maybeSoundPlaying(aTab) {
  return ensureLivingTab(aTab) &&
         (aTab.classList.contains(Constants.kTAB_STATE_SOUND_PLAYING) ||
          (aTab.classList.contains(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER) &&
           aTab.hasAttribute(Constants.kCHILDREN)));
}

export function isMuted(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_MUTED);
}

export function maybeMuted(aTab) {
  return ensureLivingTab(aTab) &&
         (aTab.classList.contains(Constants.kTAB_STATE_MUTED) ||
          (aTab.classList.contains(Constants.kTAB_STATE_HAS_MUTED_MEMBER) &&
           aTab.hasAttribute(Constants.kCHILDREN)));
}

export function isHidden(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_HIDDEN);
}

export function isCollapsed(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_COLLAPSED);
}

export function isDiscarded(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_DISCARDED);
}

export function isPrivateBrowsing(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_PRIVATE_BROWSING);
}

export function isOpening(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_OPENING);
}

export function isDuplicating(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_DUPLICATING);
}

export function isNewTabCommandTab(aTab) {
  return ensureLivingTab(aTab) &&
           configs.guessNewOrphanTabAsOpenedByNewTabCommand &&
           assertInitializedTab(aTab) &&
           aTab.apiTab.url == configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl;
}

export function isSubtreeCollapsed(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
}

/*
function shouldCloseTabSubtreeOf(aTab) {
  return (hasChildTabs(aTab) &&
          (configs.closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
           isSubtreeCollapsed(aTab)));
}
*/

/*
function shouldCloseLastTabSubtreeOf(aTab) {
  return (ensureLivingTab(aTab) &&
          shouldCloseTabSubtreeOf(aTab) &&
          getDescendantTabs(aTab).length + 1 == getAllTabs(aTab).length);
}
*/

export function isGroupTab(aTab) {
  if (!aTab)
    return false;
  assertInitializedTab(aTab);
  return aTab.classList.contains(Constants.kTAB_STATE_GROUP_TAB) ||
         aTab.apiTab.url.indexOf(Constants.kGROUP_TAB_URI) == 0;
}

export function isTemporaryGroupTab(aTab) {
  if (!isGroupTab(aTab))
    return false;
  return /[&?]temporary=true/.test(aTab.apiTab.url);
}

export function isSelected(aTab) {
  return ensureLivingTab(aTab) &&
           aTab.classList.contains(Constants.kTAB_STATE_SELECTED);
}

export function isLocked(_aTab) {
  return false;
}

export function hasChildTabs(aParent) {
  if (!ensureLivingTab(aParent))
    return false;
  return aParent.hasAttribute(Constants.kCHILDREN);
}

export function getLabelWithDescendants(aTab) {
  const label = [`* ${aTab.dataset.label}`];
  for (const child of getChildTabs(aTab)) {
    if (!child.dataset.labelWithDescendants)
      child.dataset.labelWithDescendants = getLabelWithDescendants(child);
    label.push(child.dataset.labelWithDescendants.replace(/^/gm, '  '));
  }
  return label.join('\n');
}

export function getMaxTreeLevel(aHint, aOptions = {}) {
  const tabs = aOptions.onlyVisible ? getVisibleTabs(aHint) : getTabs(aHint) ;
  let maxLevel = Math.max(...tabs.map(aTab => parseInt(aTab.getAttribute(Constants.kLEVEL) || 0)));
  if (configs.maxTreeLevel > -1)
    maxLevel = Math.min(maxLevel, configs.maxTreeLevel);
  return maxLevel;
}

// if all tabs are aldeardy placed at there, we don't need to move them.
export function isAllTabsPlacedBefore(aTabs, aNextTab) {
  if (aTabs[aTabs.length - 1] == aNextTab)
    aNextTab = getNextTab(aNextTab);
  if (!aNextTab && !getNextTab(aTabs[aTabs.length - 1]))
    return true;

  aTabs = Array.slice(aTabs);
  let previousTab = aTabs.shift();
  for (const tab of aTabs) {
    if (tab.previousSibling != previousTab)
      return false;
    previousTab = tab;
  }
  return !aNextTab ||
         !previousTab ||
         previousTab.nextSibling == aNextTab;
}

export function isAllTabsPlacedAfter(aTabs, aPreviousTab) {
  if (aTabs[0] == aPreviousTab)
    aPreviousTab = getPreviousTab(aPreviousTab);
  if (!aPreviousTab && !getPreviousTab(aTabs[0]))
    return true;

  aTabs = Array.slice(aTabs).reverse();
  let nextTab = aTabs.shift();
  for (const tab of aTabs) {
    if (tab.nextSibling != nextTab)
      return false;
    nextTab = tab;
  }
  return !aPreviousTab ||
         !nextTab ||
         nextTab.previousSibling == aPreviousTab;
}


export function dumpAllTabs() {
  if (!configs.debug)
    return;
  log('dumpAllTabs\n' +
    getAllTabs().map(aTab =>
      getAncestorTabs(aTab).reverse().concat([aTab])
        .map(aTab => aTab.id + (isPinned(aTab) ? ' [pinned]' : ''))
        .join(' => ')
    ).join('\n'));
}


//===================================================================
// Promised status of tabs
//===================================================================

const gOpenedResolvers = new WeakMap();
const gClosedWhileActiveResolvers = new WeakMap();

export function initPromisedStatus(aTab, aAlreadyOpened = false) {
  if (aAlreadyOpened)
    aTab.opened = Promise.resolve(true);
  else
    aTab.opened = new Promise((aResolve, _aReject) => {
      gOpenedResolvers.set(aTab, aResolve);
    });

  aTab.closedWhileActive = new Promise((aResolve, _aReject) => {
    gClosedWhileActiveResolvers.set(aTab, aResolve);
  });
}

export function resolveOpened(aTab) {
  if (!gOpenedResolvers.has(aTab))
    return;
  gOpenedResolvers.get(aTab)();
  gOpenedResolvers.delete(aTab);
}

export function fetchClosedWhileActiveResolver(aTab) {
  const resolver = gClosedWhileActiveResolvers.get(aTab);
  gClosedWhileActiveResolvers.delete(aTab);
  return resolver;
}


//===================================================================
// Tab State
//===================================================================

export function broadcastTabState(aTabs, aOptions = {}) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];
  browser.runtime.sendMessage({
    type:    Constants.kCOMMAND_BROADCAST_TAB_STATE,
    tabs:    aTabs.map(aTab => aTab.id),
    add:     aOptions.add || [],
    remove:  aOptions.remove || [],
    bubbles: !!aOptions.bubbles
  });
}

export async function getSpecialTabState(aTab) {
  const states = await browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_SPECIAL_TAB_STATES);
  return states || [];
}

export async function addSpecialTabState(aTab, aState) {
  const states = await getSpecialTabState(aTab);
  if (states.includes(aState))
    return states;
  states.push(aState);
  await browser.sessions.setTabValue(aTab.apiTab.id, Constants.kPERSISTENT_SPECIAL_TAB_STATES, states);
  return states;
}

export async function removeSpecialTabState(aTab, aState) {
  const states = await getSpecialTabState(aTab);
  const index = states.indexOf(aState);
  if (index < 0)
    return states;
  states.splice(index, 1);
  await browser.sessions.setTabValue(aTab.apiTab.id, Constants.kPERSISTENT_SPECIAL_TAB_STATES, states);
  return states;
}



//===================================================================
// Take snapshot
//===================================================================

export function snapshotTreeForActionDetection(aTargetTab) {
  const prevTab = getPreviousNormalTab(aTargetTab);
  const nextTab = getNextNormalTab(aTargetTab);
  const foundTabs = {};
  const tabs = getAncestorTabs(prevTab)
    .concat([prevTab, aTargetTab, nextTab, getParentTab(aTargetTab)])
    .filter(aTab => ensureLivingTab(aTab) && !foundTabs[aTab.id] && (foundTabs[aTab.id] = true)) // uniq
    .sort((aA, aB) => aA.apiTab.index - aB.apiTab.index);
  return snapshotTree(aTargetTab, tabs);
}

function snapshotTree(aTargetTab, aTabs) {
  const allTabs = aTabs || getNormalTabs(aTargetTab);

  const snapshotById = {};
  function snapshotChild(aTab) {
    if (!ensureLivingTab(aTab) || isPinned(aTab) || isHidden(aTab))
      return null;
    return snapshotById[aTab.id] = {
      id:            aTab.id,
      url:           aTab.apiTab.url,
      cookieStoreId: aTab.apiTab.cookieStoreId,
      active:        isActive(aTab),
      children:      getChildTabs(aTab).filter(aChild => !isHidden(aChild)).map(aChild => aChild.id),
      collapsed:     isSubtreeCollapsed(aTab),
      level:         parseInt(aTab.getAttribute(Constants.kLEVEL) || 0)
    };
  }
  const snapshotArray = allTabs.map(aTab => snapshotChild(aTab));
  for (const tab of allTabs) {
    const item = snapshotById[tab.id];
    if (!item)
      continue;
    const parent = getParentTab(tab);
    item.parent = parent && parent.id;
    const next = getNextNormalTab(tab);
    item.next = next && next.id;
    const previous = getPreviousNormalTab(tab);
    item.previous = previous && previous.id;
  }
  const activeTab = getCurrentTab(aTargetTab);
  return {
    target:   snapshotById[aTargetTab.id],
    active:   activeTab && snapshotById[activeTab.id],
    tabs:     snapshotArray,
    tabsById: snapshotById
  };
}
