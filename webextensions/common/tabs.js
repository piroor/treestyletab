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

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/tabs', ...args);
}


let mTargetWindow;

export const allTabsContainer = document.querySelector('#all-tabs');


//===================================================================
// Tab Related Utilities
//===================================================================

export function setWindow(targetWindow) {
  return mTargetWindow = targetWindow;
}

export function getWindow() {
  return mTargetWindow;
}


//===================================================================
// Operate Tab ID
//===================================================================

export function makeTabId(apiTab) {
  return `tab-${apiTab.windowId}-${apiTab.id}`;
}

export async function requestUniqueId(tabOrId, options = {}) {
  let tabId = tabOrId;
  let tab   = null;
  if (typeof tabOrId == 'number') {
    tab = getTabById(tabOrId);
  }
  else {
    tabId = tabOrId.apiTab.id;
    tab   = tabOrId;
  }

  if (options.inRemote) {
    return await browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_REQUEST_UNIQUE_ID,
      id:       tabId,
      forceNew: !!options.forceNew
    });
  }

  let originalId    = null;
  let originalTabId = null;
  let duplicated    = false;
  if (!options.forceNew) {
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

export function updateUniqueId(tab) {
  tab.uniqueId = requestUniqueId(tab, {
    inRemote: !!mTargetWindow
  }).then(uniqueId => {
    if (uniqueId && ensureLivingTab(tab)) // possibly removed from document while waiting
      tab.setAttribute(Constants.kPERSISTENT_ID, uniqueId.id);
    return uniqueId || {};
  }).catch(error => {
    console.log(`FATAL ERROR: Failed to get unique id for a tab ${tab.apiTab.id}: `, String(error), error.stack);
    return {};
  });
  return tab.uniqueId;
}

export async function getUniqueIds(apiTabs) {
  const uniqueIds = await Promise.all(apiTabs.map(apiTab => browser.sessions.getTabValue(apiTab.id, Constants.kPERSISTENT_ID)));
  return uniqueIds.map(id => id && id.id || '?');
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

export const onBeforeCreate     = new EventListenerManager();
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

async function waitUntilTabsAreOperated(idOrIds, slot) {
  if (!Array.isArray(idOrIds))
    idOrIds = [idOrIds];
  const operatingTabs = idOrIds
    .map(id => parseInt(id))
    .filter(id => !!id)
    .map(id => typeof id == 'string' ? parseInt(id.match(/^tab-\d+-(\d+)$/)[1]) : id)
    .map(id => slot.get(id))
    .filter(operating => !!operating);
  if (operatingTabs.length)
    return Promise.all(operatingTabs);
  return [];
}

const mCreatingTabs = new Map();

export function addCreatingTab(tab) {
  let onTabCreated;
  if (configs.acceleratedTabCreation) {
    mCreatingTabs.set(tab.apiTab.id, tab.uniqueId);
    onTabCreated = () => {};
  }
  else {
    mCreatingTabs.set(tab.apiTab.id, new Promise((resolve, _aReject) => {
      onTabCreated = (uniqueId) => { resolve(uniqueId); };
    }));
  }
  tab.uniqueId.then(_aUniqueId => {
    mCreatingTabs.delete(tab.apiTab.id);
  });
  return onTabCreated;
}

export function hasCreatingTab() {
  return mCreatingTabs.size > 0;
}

export async function waitUntilAllTabsAreCreated() {
  return waitUntilTabsAreCreated(Array.from(mCreatingTabs.keys()));
}

export async function waitUntilTabsAreCreated(idOrIds) {
  return waitUntilTabsAreOperated(idOrIds, mCreatingTabs)
    .then(aUniqueIds => aUniqueIds.map(uniqueId => getTabByUniqueId(uniqueId.id)));
}

const mMovingTabs = new Map();

export function hasMovingTab() {
  return mMovingTabs.size > 0;
}

export function addMovingTabId(tabId) {
  let onTabMoved;
  const promisedMoved = new Promise((resolve, _aReject) => {
    onTabMoved = resolve;
  });
  mMovingTabs.set(tabId, promisedMoved);
  promisedMoved.then(() => {
    mMovingTabs.delete(tabId);
  });
  return onTabMoved;
}

export async function waitUntilAllTabsAreMoved() {
  return waitUntilTabsAreOperated(Array.from(mMovingTabs.keys()), mMovingTabs);
}


//===================================================================
// Create Tabs
//===================================================================

export function buildTab(apiTab, options = {}) {
  log('build tab for ', apiTab);
  const tab = document.createElement('li');
  tab.apiTab = apiTab;
  tab.setAttribute('id', makeTabId(apiTab));
  tab.setAttribute(Constants.kAPI_TAB_ID, apiTab.id || -1);
  tab.setAttribute(Constants.kAPI_WINDOW_ID, apiTab.windowId || -1);
  //tab.setAttribute(Constants.kCHILDREN, '');
  tab.classList.add('tab');
  if (apiTab.active)
    tab.classList.add(Constants.kTAB_STATE_ACTIVE);
  tab.classList.add(Constants.kTAB_STATE_SUBTREE_COLLAPSED);

  const labelContainer = document.createElement('span');
  labelContainer.classList.add(Constants.kLABEL);
  const label = labelContainer.appendChild(document.createElement('span'));
  label.classList.add(`${Constants.kLABEL}-content`);
  tab.appendChild(labelContainer);

  onBuilt.dispatch(tab, options);

  if (options.existing) {
    tab.classList.add(Constants.kTAB_STATE_ANIMATION_READY);
  }

  if (apiTab.id)
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
function assertValidHint(hint) {
  if (!hint)
    return;
  if (/string|number/.test(typeof hint))
    return;
  if (hint.parentNode)
    return;
  const error = new Error('FATAL ERROR: invalid hint is given');
  log(error.message, error.stack);
  throw error;
}

export function getTabsContainer(hint) {
  assertValidHint(hint);

  if (!hint)
    hint = mTargetWindow || allTabsContainer.firstChild;

  if (typeof hint == 'number')
    return document.querySelector(`#window-${hint}`);

  if (hint &&
      typeof hint == 'object' &&
      hint.dataset &&
      hint.dataset.windowId)
    return document.querySelector(`#window-${hint.dataset.windowId}`);

  const tab = getTabFromChild(hint);
  if (tab)
    return tab.parentNode;

  return null;
}

export function getTabFromChild(node, options = {}) {
  if (!node)
    return null;
  if (node.nodeType != Node.ELEMENT_NODE)
    node = node.parentNode;
  return node && node.closest(options.force ? '.tab' : kSELECTOR_LIVE_TAB);
}

export function getTabById(idOrInfo) {
  if (!idOrInfo)
    return null;

  if (idOrInfo.nodeType == Node.ELEMENT_NODE) // tab element itself
    return idOrInfo;

  if (typeof idOrInfo == 'string') { // tab-x-x
    const tab = document.getElementById(idOrInfo);
    if (tab)
      return tab.matches(kSELECTOR_LIVE_TAB) ? tab : null ;
    else // possible unique id
      return getTabByUniqueId(idOrInfo);
  }

  if (typeof idOrInfo == 'number') // tabs.Tab.id
    return document.querySelector(`${kSELECTOR_LIVE_TAB}[${Constants.kAPI_TAB_ID}="${idOrInfo}"]`);

  if (idOrInfo.id && idOrInfo.windowId) { // tabs.Tab
    const tab = document.getElementById(makeTabId(idOrInfo));
    return tab && tab.matches(kSELECTOR_LIVE_TAB) ? tab : null ;
  }
  else if (!idOrInfo.window) { // { tab: tabs.Tab.id }
    return document.querySelector(`${kSELECTOR_LIVE_TAB}[${Constants.kAPI_TAB_ID}="${idOrInfo.tab}"]`);
  }
  else { // { tab: tabs.Tab.id, window: windows.Window.id }
    const tab = document.getElementById(`tab-${idOrInfo.window}-${idOrInfo.tab}`);
    return tab && tab.matches(kSELECTOR_LIVE_TAB) ? tab : null ;
  }

  return null;
}

export function getTabByUniqueId(id) {
  if (!id)
    return null;
  return document.querySelector(`${kSELECTOR_LIVE_TAB}[${Constants.kPERSISTENT_ID}="${id}"]`);
}

export function getTabLabel(tab) {
  return tab && tab.querySelector(`.${Constants.kLABEL}`);
}

export function getTabLabelContent(tab) {
  return tab && tab.querySelector(`.${Constants.kLABEL}-content`);
}

// Note that this function can return null if it is the first tab of
// a new window opened by the "move tab to new window" command.
export function getCurrentTab(hint) {
  const container = getTabsContainer(hint);
  return container && container.querySelector(`.${Constants.kTAB_STATE_ACTIVE}`);
}
export function getCurrentTabs() {
  return Array.slice(document.querySelectorAll(`.${Constants.kTAB_STATE_ACTIVE}`));
}

export function getNextTab(tab) {
  if (!tab || !tab.id)
    return null;
  assertValidHint(tab);
  let next = tab;
  while ((next = next.nextElementSibling)) {
    if (next.matches(kSELECTOR_LIVE_TAB))
      return next;
  }
  return null;
  // don't use '~' selector, it is too slow...
  //return document.querySelector(`#${tab.id} ~ ${kSELECTOR_LIVE_TAB}`);
}

export function getPreviousTab(tab) {
  if (!tab || !tab.id)
    return null;
  assertValidHint(tab);
  let previous = tab;
  while ((previous = previous.previousElementSibling)) {
    if (previous.matches(kSELECTOR_LIVE_TAB))
      return previous;
  }
  return null;
}

export function getFirstTab(hint) {
  const container = getTabsContainer(hint);
  return container && container.querySelector(kSELECTOR_LIVE_TAB);
}

export function getLastTab(hint) {
  const container = getTabsContainer(hint);
  if (!container)
    return null;
  const tabs = container.querySelectorAll(kSELECTOR_LIVE_TAB);
  return tabs.length > 0 ? tabs[tabs.length - 1] : null;
}

export function getLastVisibleTab(hint) { // visible, not-collapsed, not-hidden
  const container = getTabsContainer(hint);
  if (!container)
    return null;
  const tabs = container.querySelectorAll(kSELECTOR_VISIBLE_TAB);
  return tabs.length > 0 ? tabs[tabs.length - 1] : null;
}

export function getLastOpenedTab(hint) {
  const tabs = getTabs(hint);
  return tabs.length > 0 ?
    tabs.sort((aA, aB) => aB.apiTab.id - aA.apiTab.id)[0] :
    null ;
}

export function getTabIndex(tab, options = {}) {
  if (!ensureLivingTab(tab))
    return -1;
  assertValidHint(tab);

  let tabs = getAllTabs(tab);
  if (Array.isArray(options.ignoreTabs) &&
      options.ignoreTabs.length > 0)
    tabs = tabs.filter(tab => !options.ignoreTabs.includes(tab));

  return tabs.indexOf(tab);
}

export function calculateNewTabIndex(params) {
  if (params.insertBefore)
    return getTabIndex(params.insertBefore, params);
  if (params.insertAfter)
    return getTabIndex(params.insertAfter, params) + 1;
  return -1;
}


export function getNextNormalTab(tab) {
  if (!ensureLivingTab(tab))
    return null;
  assertValidHint(tab);
  let next = tab;
  while ((next = next.nextElementSibling)) {
    if (next.matches(kSELECTOR_NORMAL_TAB))
      return next;
  }
  return null;
  // don't use '~' selector, it is too slow...
  //return document.querySelector(`#${tab.id} ~ ${kSELECTOR_NORMAL_TAB}`);
}

export function getPreviousNormalTab(tab) {
  if (!ensureLivingTab(tab))
    return null;
  assertValidHint(tab);
  let previous = tab;
  while ((previous = previous.previousElementSibling)) {
    if (previous.matches(kSELECTOR_NORMAL_TAB))
      return previous;
  }
  return null;
}


// tree basics

export function ensureLivingTab(tab) {
  if (!tab ||
      !tab.id ||
      !tab.parentNode ||
      tab[Constants.kTAB_STATE_REMOVING])
    return null;
  return tab;
}

function assertInitializedTab(tab) {
  if (!tab.apiTab)
    throw new Error(`FATAL ERROR: the tab ${tab.id} is not initialized yet correctly! (no API tab information)\n${new Error().stack}`);
  if (!tab.childTabs)
    throw new Error(`FATAL ERROR: the tab ${tab.id} is not initialized yet correctly! (missing priperty "childTabs")\n${new Error().stack}`);
  return true;
}

export function getOpenerTab(tab) {
  if (!ensureLivingTab(tab) ||
      !tab.apiTab ||
      !tab.apiTab.openerTabId ||
      tab.apiTab.openerTabId == tab.apiTab.id)
    return null;
  return getTabById({ id: tab.apiTab.openerTabId, windowId: tab.apiTab.windowId });
}

export function getParentTab(child) {
  if (!ensureLivingTab(child))
    return null;
  assertValidHint(child);
  return ensureLivingTab(child.parentTab);
}

export function getAncestorTabs(descendant, options = {}) {
  if (!descendant)
    return [];
  if (!options.force)
    return (
      // slice(0) is required to guard the cached array from destructive methods liek sort()!
      descendant.ancestorTabs && descendant.ancestorTabs.slice(0) ||
      []
    );
  const ancestors = [];
  while (true) {
    const parent = getParentTab(descendant);
    if (!parent)
      break;
    ancestors.push(parent);
    descendant = parent;
  }
  return ancestors;
}

export function getVisibleAncestorOrSelf(descendant) {
  for (const ancestor of getAncestorTabs(descendant)) {
    if (!isCollapsed(ancestor))
      return ancestor;
  }
  if (!isCollapsed(descendant))
    return descendant;
  return null;
}

export function getRootTab(descendant) {
  const ancestors = getAncestorTabs(descendant);
  return ancestors.length > 0 ? ancestors[ancestors.length-1] : descendant ;
}

function getSiblingTabs(tab) {
  if (!ensureLivingTab(tab))
    return [];
  assertValidHint(tab);
  if (!ensureLivingTab(tab.parentTab))
    return getRootTabs(tab);
  assertInitializedTab(tab);
  assertInitializedTab(tab.parentTab);
  return tab.parentTab.childTabs.filter(ensureLivingTab);
}

export function getNextSiblingTab(tab) {
  if (!ensureLivingTab(tab))
    return null;
  assertValidHint(tab);
  const siblings = getSiblingTabs(tab);
  const index = siblings.indexOf(tab);
  return index < siblings.length - 1 ? siblings[index + 1] : null ;
}

export function getPreviousSiblingTab(tab) {
  if (!ensureLivingTab(tab))
    return null;
  assertValidHint(tab);
  const siblings = getSiblingTabs(tab);
  const index = siblings.indexOf(tab);
  return index > 0 ? siblings[index - 1] : null ;
}

export function getChildTabs(parent) {
  if (!ensureLivingTab(parent))
    return [];
  assertValidHint(parent);
  assertInitializedTab(parent);
  return parent.childTabs.filter(ensureLivingTab);
}

export function getFirstChildTab(parent) {
  if (!ensureLivingTab(parent))
    return null;
  assertValidHint(parent);
  assertInitializedTab(parent);
  const tabs = parent.childTabs.filter(ensureLivingTab);
  return tabs.length > 0 ? tabs[0] : null ;
}

export function getLastChildTab(parent) {
  if (!ensureLivingTab(parent))
    return null;
  assertValidHint(parent);
  assertInitializedTab(parent);
  const tabs = parent.childTabs.filter(ensureLivingTab);
  return tabs.length > 0 ? tabs[tabs.length - 1] : null ;
}

/*
function getChildTabIndex(child, parent) {
  if (!ensureLivingTab(child) ||
      !ensureLivingTab(parent))
    return -1;
  assertValidHint(child);
  assertValidHint(parent);
  assertInitializedTab(parent);
  const tabs = parent.childTabs.filter(ensureLivingTab);
  return tabs.indexOf(child);
}
*/

export function getDescendantTabs(root) {
  if (!ensureLivingTab(root))
    return [];
  assertValidHint(root);
  assertInitializedTab(root);

  let descendants = [];
  const children = root.childTabs.filter(ensureLivingTab);
  for (const child of children) {
    descendants.push(child);
    descendants = descendants.concat(getDescendantTabs(child));
  }
  return descendants;
}

export function getLastDescendantTab(root) {
  const descendants = getDescendantTabs(root);
  return descendants.length ? descendants[descendants.length-1] : null ;
}


// grab tags

export function getAllTabs(hint) {
  const container = getTabsContainer(hint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_LIVE_TAB));
}

export function getTabs(hint) { // only visible, including collapsed and pinned
  const container = getTabsContainer(hint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_CONTROLLABLE_TAB));
}

export function getNormalTabs(hint) { // only visible, including collapsed, not pinned
  const container = getTabsContainer(hint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_NORMAL_TAB));
}

function getVisibleTabs(hint) { // visible, not-collapsed, not-hidden
  const container = getTabsContainer(hint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_VISIBLE_TAB));
}

export function getPinnedTabs(hint) { // visible, pinned
  const container = getTabsContainer(hint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(kSELECTOR_PINNED_TAB));
}


export function getUnpinnedTabs(hint) { // visible, not pinned
  const container = getTabsContainer(hint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}:not(.${Constants.kTAB_STATE_PINNED})`));
}

/*
function getAllRootTabs(hint) {
  const container = getTabsContainer(hint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}:not([${Constants.kPARENT}])`));
}
*/

export function getRootTabs(hint) {
  const container = getTabsContainer(hint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_CONTROLLABLE_TAB}:not([${Constants.kPARENT}])`));
}

/*
function getVisibleRootTabs(hint) {
  const container = getTabsContainer(hint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}:not([${Constants.kPARENT}])`));
}

function getVisibleLoadingTabs(hint) {
  const container = getTabsContainer(hint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}.loading`));
}
*/

export function collectRootTabs(tabs) {
  return tabs.filter(tab => {
    if (!ensureLivingTab(tab))
      return false;
    const parent = getParentTab(tab);
    return !parent || !tabs.includes(parent);
  });
}

/*
function getIndentedTabs(hint) {
  const container = getTabsContainer(hint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_CONTROLLABLE_TAB}[${Constants.kPARENT}]`));
}

function getVisibleIndentedTabs(hint) {
  const container = getTabsContainer(hint);
  return container.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}[${Constants.kPARENT}]`);
}
*/

export function getDraggingTabs(hint) {
  const container = getTabsContainer(hint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_DRAGGING}`));
}

export function getDuplicatingTabs(hint) {
  const container = getTabsContainer(hint);
  return Array.slice(container.querySelectorAll(`${kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_DUPLICATING}`));
}

export function getSelectedTabs(hint) {
  const container = getTabsContainer(hint);
  if (!container)
    return [];
  return Array.slice(container.querySelectorAll(`
    ${kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_SELECTED},
    .${Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED} ${kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_HIGHLIGHTED}
  `));
}



// misc.

export function getFirstNormalTab(hint) { // visible, not-collapsed, not-pinned
  const container = getTabsContainer(hint);
  return container && container.querySelector(kSELECTOR_NORMAL_TAB);
}

export function getFirstVisibleTab(hint) { // visible, not-collapsed, not-hidden
  const container = getTabsContainer(hint);
  return container && container.querySelector(kSELECTOR_VISIBLE_TAB);
}

/*
function getLastVisibleTab(hint) { // visible, not-collapsed, not-hidden
  const container = getTabsContainer(hint);
  if (!container)
    return null;
  return XPath.evaluate(
    `child::${kXPATH_VISIBLE_TAB}[last()]`,
    container,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}
*/

export function getNextVisibleTab(tab) { // visible, not-collapsed
  if (!ensureLivingTab(tab))
    return null;
  assertValidHint(tab);
  let next = tab;
  while ((next = next.nextElementSibling)) {
    if (next.matches(kSELECTOR_VISIBLE_TAB))
      return next;
  }
  return null;
  // don't use '~' selector, it is too slow...
  //return document.querySelector(`#${tab.id} ~ ${kSELECTOR_VISIBLE_TAB}`);
}

export function getPreviousVisibleTab(tab) { // visible, not-collapsed
  if (!ensureLivingTab(tab))
    return null;
  assertValidHint(tab);
  let previous = tab;
  while ((previous = previous.previousElementSibling)) {
    if (previous.matches(kSELECTOR_VISIBLE_TAB))
      return previous;
  }
  return null;
}

/*
function getVisibleIndex(tab) {
  if (!ensureLivingTab(tab))
    return -1;
  assertValidHint(tab);
  return XPath.evaluate(
    `count(preceding-sibling::${kXPATH_VISIBLE_TAB})`,
    tab,
    XPathResult.NUMBER_TYPE
  ).numberValue;
}
*/

export async function doAndGetNewTabs(asyncTask, hint) {
  const tabsQueryOptions = {
    windowType: 'normal'
  };
  if (hint) {
    const container = getTabsContainer(hint);
    if (container)
      tabsQueryOptions.windowId = parseInt(container.dataset.windowId);
  }
  const beforeApiTabs = await browser.tabs.query(tabsQueryOptions);
  const beforeApiIds  = beforeApiTabs.map(apiTab => apiTab.id);
  await asyncTask();
  const afterApiTabs = await browser.tabs.query(tabsQueryOptions);
  const addedApiTabs = afterApiTabs.filter(afterApiTab => !beforeApiIds.includes(afterApiTab.id));
  const addedTabs    = addedApiTabs.map(getTabById);
  return addedTabs;
}

export function getNextFocusedTab(tab, options = {}) { // if the current tab is closed...
  const ignoredTabs = (options.ignoredTabs || []).slice(0);
  let foundTab = tab;
  do {
    ignoredTabs.push(foundTab);
    foundTab = getNextSiblingTab(foundTab);
  } while (foundTab && ignoredTabs.includes(foundTab));
  if (!foundTab) {
    foundTab = tab;
    do {
      ignoredTabs.push(foundTab);
      foundTab = getPreviousVisibleTab(foundTab);
    } while (foundTab && ignoredTabs.includes(foundTab));
  }
  return foundTab;
}


export function getGroupTabForOpener(opener) {
  const tab = (opener instanceof Element) ? opener : (getTabById(opener) || getTabByUniqueId(opener));
  if (!tab)
    return null;
  return tab.parentNode.querySelector(`${kSELECTOR_LIVE_TAB}[${Constants.kCURRENT_URI}$="openerTabId=${tab.getAttribute(Constants.kPERSISTENT_ID)}"],
                                       ${kSELECTOR_LIVE_TAB}[${Constants.kCURRENT_URI}*="openerTabId=${tab.getAttribute(Constants.kPERSISTENT_ID)}#"],
                                       ${kSELECTOR_LIVE_TAB}[${Constants.kCURRENT_URI}*="openerTabId=${tab.getAttribute(Constants.kPERSISTENT_ID)}&"]`);
}

export function getOpenerFromGroupTab(groupTab) {
  if (!isGroupTab(groupTab))
    return null;
  const matchedOpenerTabId = groupTab.apiTab.url.match(/openerTabId=([^&;]+)/);
  return matchedOpenerTabId && getTabById(matchedOpenerTabId[1]);
}




//===================================================================
// Tab Information
//===================================================================

export function isActive(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_ACTIVE);
}

export function isPinned(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_PINNED);
}

export function isAudible(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_AUDIBLE);
}

export function isSoundPlaying(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_SOUND_PLAYING);
}

export function maybeSoundPlaying(tab) {
  return ensureLivingTab(tab) &&
         (tab.classList.contains(Constants.kTAB_STATE_SOUND_PLAYING) ||
          (tab.classList.contains(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER) &&
           tab.hasAttribute(Constants.kCHILDREN)));
}

export function isMuted(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_MUTED);
}

export function maybeMuted(tab) {
  return ensureLivingTab(tab) &&
         (tab.classList.contains(Constants.kTAB_STATE_MUTED) ||
          (tab.classList.contains(Constants.kTAB_STATE_HAS_MUTED_MEMBER) &&
           tab.hasAttribute(Constants.kCHILDREN)));
}

export function isHidden(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_HIDDEN);
}

export function isCollapsed(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_COLLAPSED);
}

export function isDiscarded(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_DISCARDED);
}

export function isPrivateBrowsing(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_PRIVATE_BROWSING);
}

export function isOpening(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_OPENING);
}

export function isDuplicating(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_DUPLICATING);
}

export function isNewTabCommandTab(tab) {
  return ensureLivingTab(tab) &&
           configs.guessNewOrphanTabAsOpenedByNewTabCommand &&
           assertInitializedTab(tab) &&
           tab.apiTab.url == configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl;
}

export function isSubtreeCollapsed(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
}

/*
function shouldCloseTabSubtreeOf(tab) {
  return (hasChildTabs(tab) &&
          (configs.closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
           isSubtreeCollapsed(tab)));
}
*/

/*
function shouldCloseLastTabSubtreeOf(tab) {
  return (ensureLivingTab(tab) &&
          shouldCloseTabSubtreeOf(tab) &&
          getDescendantTabs(tab).length + 1 == getAllTabs(tab).length);
}
*/

export function isGroupTab(tab) {
  if (!tab)
    return false;
  assertInitializedTab(tab);
  return tab.classList.contains(Constants.kTAB_STATE_GROUP_TAB) ||
         tab.apiTab.url.indexOf(Constants.kGROUP_TAB_URI) == 0;
}

export function isTemporaryGroupTab(tab) {
  if (!isGroupTab(tab))
    return false;
  return /[&?]temporary=true/.test(tab.apiTab.url);
}

export function isSelected(tab) {
  return ensureLivingTab(tab) &&
           (tab.classList.contains(Constants.kTAB_STATE_SELECTED) ||
            tab.matches(`.${Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED} .${Constants.kTAB_STATE_HIGHLIGHTED}`));
}

export function isHighlighted(tab) {
  return ensureLivingTab(tab) &&
           tab.classList.contains(Constants.kTAB_STATE_HIGHLIGHTED);
}

export function isLocked(_aTab) {
  return false;
}

export function hasChildTabs(parent) {
  if (!ensureLivingTab(parent))
    return false;
  return parent.hasAttribute(Constants.kCHILDREN);
}

export function getLabelWithDescendants(tab) {
  const label = [`* ${tab.dataset.label}`];
  for (const child of getChildTabs(tab)) {
    if (!child.dataset.labelWithDescendants)
      child.dataset.labelWithDescendants = getLabelWithDescendants(child);
    label.push(child.dataset.labelWithDescendants.replace(/^/gm, '  '));
  }
  return label.join('\n');
}

export function getMaxTreeLevel(hint, options = {}) {
  const tabs = options.onlyVisible ? getVisibleTabs(hint) : getTabs(hint) ;
  let maxLevel = Math.max(...tabs.map(tab => parseInt(tab.getAttribute(Constants.kLEVEL) || 0)));
  if (configs.maxTreeLevel > -1)
    maxLevel = Math.min(maxLevel, configs.maxTreeLevel);
  return maxLevel;
}

// if all tabs are aldeardy placed at there, we don't need to move them.
export function isAllTabsPlacedBefore(tabs, nextTab) {
  if (tabs[tabs.length - 1] == nextTab)
    nextTab = getNextTab(nextTab);
  if (!nextTab && !getNextTab(tabs[tabs.length - 1]))
    return true;

  tabs = Array.slice(tabs);
  let previousTab = tabs.shift();
  for (const tab of tabs) {
    if (tab.previousSibling != previousTab)
      return false;
    previousTab = tab;
  }
  return !nextTab ||
         !previousTab ||
         previousTab.nextSibling == nextTab;
}

export function isAllTabsPlacedAfter(tabs, previousTab) {
  if (tabs[0] == previousTab)
    previousTab = getPreviousTab(previousTab);
  if (!previousTab && !getPreviousTab(tabs[0]))
    return true;

  tabs = Array.slice(tabs).reverse();
  let nextTab = tabs.shift();
  for (const tab of tabs) {
    if (tab.nextSibling != nextTab)
      return false;
    nextTab = tab;
  }
  return !previousTab ||
         !nextTab ||
         nextTab.previousSibling == previousTab;
}


export function dumpAllTabs() {
  if (!configs.debug)
    return;
  log('dumpAllTabs\n' +
    getAllTabs().map(tab =>
      getAncestorTabs(tab).reverse().concat([tab])
        .map(tab => tab.id + (isPinned(tab) ? ' [pinned]' : ''))
        .join(' => ')
    ).join('\n'));
}


//===================================================================
// Promised status of tabs
//===================================================================

const mOpenedResolvers = new WeakMap();
const mClosedWhileActiveResolvers = new WeakMap();

export function initPromisedStatus(tab, alreadyOpened = false) {
  if (alreadyOpened)
    tab.opened = Promise.resolve(true);
  else
    tab.opened = new Promise((resolve, _aReject) => {
      mOpenedResolvers.set(tab, resolve);
    });

  tab.closedWhileActive = new Promise((resolve, _aReject) => {
    mClosedWhileActiveResolvers.set(tab, resolve);
  });
}

export function resolveOpened(tab) {
  if (!mOpenedResolvers.has(tab))
    return;
  mOpenedResolvers.get(tab)();
  mOpenedResolvers.delete(tab);
}

export function fetchClosedWhileActiveResolver(tab) {
  const resolver = mClosedWhileActiveResolvers.get(tab);
  mClosedWhileActiveResolvers.delete(tab);
  return resolver;
}


//===================================================================
// Tab State
//===================================================================

export function broadcastTabState(tabs, options = {}) {
  if (!Array.isArray(tabs))
    tabs = [tabs];
  browser.runtime.sendMessage({
    type:    Constants.kCOMMAND_BROADCAST_TAB_STATE,
    tabs:    tabs.map(tab => tab.id),
    add:     options.add || [],
    remove:  options.remove || [],
    bubbles: !!options.bubbles
  });
}

export async function getSpecialTabState(tab) {
  const states = await browser.sessions.getTabValue(tab.apiTab.id, Constants.kPERSISTENT_SPECIAL_TAB_STATES);
  return states || [];
}

export async function addSpecialTabState(tab, state) {
  const states = await getSpecialTabState(tab);
  if (states.includes(state))
    return states;
  states.push(state);
  await browser.sessions.setTabValue(tab.apiTab.id, Constants.kPERSISTENT_SPECIAL_TAB_STATES, states);
  return states;
}

export async function removeSpecialTabState(tab, state) {
  const states = await getSpecialTabState(tab);
  const index = states.indexOf(state);
  if (index < 0)
    return states;
  states.splice(index, 1);
  await browser.sessions.setTabValue(tab.apiTab.id, Constants.kPERSISTENT_SPECIAL_TAB_STATES, states);
  return states;
}



//===================================================================
// Take snapshot
//===================================================================

export function snapshotTreeForActionDetection(targetTab) {
  const prevTab = getPreviousNormalTab(targetTab);
  const nextTab = getNextNormalTab(targetTab);
  const foundTabs = {};
  const tabs = getAncestorTabs(prevTab)
    .concat([prevTab, targetTab, nextTab, getParentTab(targetTab)])
    .filter(tab => ensureLivingTab(tab) && !foundTabs[tab.id] && (foundTabs[tab.id] = true)) // uniq
    .sort((aA, aB) => aA.apiTab.index - aB.apiTab.index);
  return snapshotTree(targetTab, tabs);
}

function snapshotTree(targetTab, tabs) {
  const allTabs = tabs || getTabs(targetTab);

  const snapshotById = {};
  function snapshotChild(tab) {
    if (!ensureLivingTab(tab) || isPinned(tab) || isHidden(tab))
      return null;
    return snapshotById[tab.id] = {
      id:            tab.id,
      url:           tab.apiTab.url,
      cookieStoreId: tab.apiTab.cookieStoreId,
      active:        isActive(tab),
      children:      getChildTabs(tab).filter(child => !isHidden(child)).map(child => child.id),
      collapsed:     isSubtreeCollapsed(tab),
      pinned:        isPinned(tab),
      level:         parseInt(tab.getAttribute(Constants.kLEVEL) || 0)
    };
  }
  const snapshotArray = allTabs.map(tab => snapshotChild(tab));
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
  const activeTab = getCurrentTab(targetTab);
  return {
    target:   snapshotById[targetTab.id],
    active:   activeTab && snapshotById[activeTab.id],
    tabs:     snapshotArray,
    tabsById: snapshotById
  };
}
