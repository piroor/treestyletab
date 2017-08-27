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

var gAllTabs;
var gTargetWindow = null;
var gRestoringTree = false;
var gIndent = -1;
var gIndentProp = 'marginLeft';
var gNeedRestoreTree = false;

var gIsMac = /Darwin/.test(navigator.platform);

function buildTab(aApiTab, aOptions = {}) {
  log('build tab for ', aApiTab);

  var tab = document.createElement('li');
  tab.apiTab = aApiTab;
  tab.setAttribute('id', makeTabId(aApiTab));
  //tab.setAttribute(kCHILDREN, '');
  tab.setAttribute(kCONTENT_LOCATION, aApiTab.url);
  tab.classList.add('tab');
  if (aApiTab.active)
    tab.classList.add(kTAB_STATE_ACTIVE);
  if (aApiTab.pinned)
    tab.classList.add(kTAB_STATE_PINNED);
  tab.classList.add(kTAB_STATE_SUBTREE_COLLAPSED);

  var title = aApiTab.title;
  if (aApiTab.url && aApiTab.url.indexOf(kGROUP_TAB_URI) == 0) {
    tab.classList.add(kTAB_STATE_GROUP_TAB);
    title = getTitleFromGroupTabURI(aApiTab.url);
  }
  var label = document.createElement('span');
  label.classList.add(kLABEL);
  label.appendChild(document.createTextNode(title));
  tab.appendChild(label);
  tab.setAttribute('title', title);

  tab.classList.add(aApiTab.status);

  window.onTabBuilt && onTabBuilt(tab);

  if (aOptions.existing) {
    tab.classList.add(kTAB_STATE_ANIMATION_READY);
  }

  return tab;
}

function updateTab(aTab, aNewState) {
  var oldState = aTab.apiTab;
  var label = aNewState.title;
  if (aNewState.url && aNewState.url.indexOf(kGROUP_TAB_URI) == 0) {
    aTab.classList.add(kTAB_STATE_GROUP_TAB);
    label = getTitleFromGroupTabURI(aNewState.url);
  }
  else {
    aTab.classList.remove(kTAB_STATE_GROUP_TAB);
  }

  if (oldState.url != aNewState.url)
    aTab.setAttribute(kCONTENT_LOCATION, aNewState.url);

  if (label != oldState.title) {
    getTabLabel(aTab).textContent = label;
    aTab.setAttribute('title', label);
  }

  if (aNewState.favIconUrl != oldState.favIconUrl)
    window.onTabFaviconUpdated &&
      onTabFaviconUpdated(aTab, aNewState.favIconUrl);

  if (aNewState.status != oldState.status) {
    aTab.classList.remove(oldState.status);
    aTab.classList.add(aNewState.status);
  }

  if (aNewState.pinned != oldState.pinned) {
    if (aNewState.pinned) {
      aTab.classList.add(kTAB_STATE_PINNED);
      window.onTabPinned && onTabPinned(aTab);
    }
    else {
      aTab.classList.remove(kTAB_STATE_PINNED);
      window.onTabUnpinned && onTabUnpinned(aTab);
    }
  }
}

function getTitleFromGroupTabURI(aURI) {
  var title = aURI.match(/title=([^&;]*)/);
  return title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab.label.default');
}

function buildTabsContainerFor(aWindowId) {
  var container = document.createElement('ul');
  container.windowId = aWindowId;
  container.setAttribute('id', `window-${aWindowId}`);
  container.classList.add('tabs');

  container.internalMovingCount = 0;
  container.subTreeMovingCount = 0;
  container.subTreeChildrenMovingCount = 0;
  container.doingCollapseExpandCount = 0;
  container.internalFocusCount = 0;

  container.openingCount = 0;
  container.openedNewTabs = [];
  container.openedNewTabsTimeout = null;

  container.toBeOpenedTabsWithPositions = 0;
  container.toBeOpenedOrphanTabs = 0;
  container.toBeDetachedTabs = 0;

  return container;
}

function clearAllTabsContainers() {
  var range = document.createRange();
  range.selectNodeContents(gAllTabs);
  range.deleteContents();
  range.detach();
}

async function selectTabInternally(aTab, aOptions = {}) {
  log('selectTabInternally: ', dumpTab(aTab));
  var container = aTab.parentNode;
  container.internalFocusCount++;
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:     kCOMMAND_SELECT_TAB_INTERNALLY,
      windowId: aTab.apiTab.windowId,
      tab:      aTab.id
    });
    container.internalFocusCount--
    return;
  }

  await browser.tabs.update(aTab.apiTab.id, { active: true })
          .catch(handleMissingTabError);
  /**
   * Note: enough large delay is truly required to wait various
   * tab-related operations are processed in background and sidebar.
   */
  setTimeout(() => container.internalFocusCount--,
    configs.acceptableDelayForInternalFocusMoving);
}

async function moveTabsInternallyBefore(aTabs, aReferenceTab, aOptions = {}) {
  if (!aTabs.length || !aReferenceTab)
    return;

  aTabs = aTabs.slice(0).reverse();
  var container = aTabs[0].parentNode;
  container.internalMovingCount++;
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:     kCOMMAND_MOVE_TABS_INTERNALLY_BEFORE,
      windowId: gTargetWindow,
      tabs:     aTabs.map(aTab => aTab.id),
      nextTab:  aReferenceTab.id
    });
    container.internalMovingCount--;
    return;
  }

  try {
    var lastMoved = aReferenceTab;
    var count = 0;
    for (let tab of aTabs) {
      let [toIndex, fromIndex] = await getApiTabIndex(lastMoved.apiTab.id, tab.apiTab.id);
      if (fromIndex < toIndex)
        toIndex--;
      log(`moving tab ${dumpTab(tab)} to ${toIndex}`);
      if (fromIndex != toIndex)
        await browser.tabs.move(tab.apiTab.id, {
          windowId: container.windowId,
          index: toIndex
        });
      lastMoved = tab;
      // tab will be moved by handling of API event
    }
  }
  catch(e) {
    log('moveTabsInternallyBefore failed: ', String(e));
  }
  container.internalMovingCount--;
}
async function moveTabInternallyBefore(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsInternallyBefore([aTab], aReferenceTab, aOptions = {});
}

async function moveTabsInternallyAfter(aTabs, aReferenceTab, aOptions = {}) {
  if (!aTabs.length || !aReferenceTab)
    return;

  var container = aTabs[0].parentNode;
  container.internalMovingCount++;
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:        kCOMMAND_MOVE_TABS_INTERNALLY_AFTER,
      windowId:    gTargetWindow,
      tabs:        aTabs.map(aTab => aTab.id),
      previousTab: aReferenceTab.id
    });
    container.internalMovingCount--;
    return;
  }

  try {
    var lastMoved = aReferenceTab;
    var count = 0;
    for (let tab of aTabs) {
      let [toIndex, fromIndex] = await getApiTabIndex(lastMoved.apiTab.id, tab.apiTab.id);
      if (fromIndex > toIndex)
        toIndex++;
      log(`moving tab ${dumpTab(tab)} to ${toIndex}`);
      if (fromIndex != toIndex)
        await browser.tabs.move(tab.apiTab.id, {
          windowId: container.windowId,
          index: toIndex
        });
      lastMoved = tab;
      // tab will be moved by handling of API event
    }
  }
  catch(e) {
    log('moveTabsInternallyAfter failed: ', String(e));
  }
  container.internalMovingCount--;
}
async function moveTabInternallyAfter(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsInternallyAfter([aTab], aReferenceTab, aOptions = {});
}

async function loadURI(aURI, aOptions = {}) {
  if (!aOptions.windowId && gTargetWindow)
    aOptions.windowId = gTargetWindow;
  if (aOptions.isRemote) {
    await browser.runtime.sendMessage(clone(aOptions, {
      type: kCOMMAND_LOAD_URI,
      tab:  aOptions.tab && aOptions.tab.id
    }));
  }
  else {
    let apiTabId;
    if (aOptions.tab) {
      apiTabId = aOptions.tab.apiTab.id;
    }
    else {
      let apiTabs = await browser.tabs.query({
        windowId: aOptions.windowId,
        active: true
      });
      apiTabId = apiTabs[0].id;
    }
    await browser.tabs.update({
      windowId: aOptions.windowId,
      id:       apiTabId,
      url:      aURI
    });
  }
}

async function openNewTab(aOptions = {}) {
  return await openURIInTab(null, aOptions);
}

async function openURIInTab(aURI, aOptions = {}) {
  var tabs = await openURIsInTabs([aURI], aOptions);
  return tabs[0];
}

async function openURIsInTabs(aURIs, aOptions = {}) {
  if (!aOptions.windowId && gTargetWindow)
    aOptions.windowId = gTargetWindow;

  return await doAndGetNewTabs(async () => {
    if (aOptions.inRemote) {
      await browser.runtime.sendMessage(clone(aOptions, {
        type:         kCOMMAND_NEW_TABS,
        uris:         aURIs,
        parent:       aOptions.parent && aOptions.parent.id,
        opener:       aOptions.opener && aOptions.opener.id,
        insertBefore: aOptions.insertBefore && aOptions.insertBefore.id,
        insertAfter:  aOptions.insertAfter && aOptions.insertAfter.id,
        inRemote:     false
      }));
    }
    else {
      let startIndex = aOptions.insertBefore ?
                         getTabIndex(aOptions.insertBefore) :
                       aOptions.insertAfter ?
                         getTabIndex(aOptions.insertAfter) + 1 :
                         -1 ;
      let container = getTabsContainer(aOptions.windowId);
      container.toBeOpenedTabsWithPositions += aURIs.length;
      await Promise.all(aURIs.map(async (aURI, aIndex) => {
        var params = {};
        if (aURI)
          params.url = aURI;
        if (aIndex == 0)
          params.active = !aOptions.inBackground;
        if (aOptions.opener)
          params.openerTabId = aOptions.opener.apiTab.id;
        if (startIndex > -1)
          params.index = startIndex + aIndex;
        var apiTab = await browser.tabs.create(params);
        var tab = getTabById({ tab: apiTab.id, window: apiTab.windowId });
        if (!aOptions.opener &&
            aOptions.parent &&
            tab)
          await attachTabTo(tab, aOptions.parent, {
            insertBefore: aOptions.insertBefore,
            insertAfter:  aOptions.insertAfter,
            broadcast:    true
          });
      }));
    }
  });
}

function makeGroupTabURI(aTitle) {
  var base = kGROUP_TAB_URI;
  return `${base}?title=${encodeURIComponent(aTitle)}`;
}

var gBlockingCount = 0;

function blockUserOperations() {
  gBlockingCount++;
  document.documentElement.classList.add(kTABBAR_STATE_BLOCKING);
}

function blockUserOperationsIn(aWindowId) {
  if (gTargetWindow && gTargetWindow != aWindowId)
    return;

  if (!gTargetWindow) {
    browser.runtime.sendMessage({
      type: kCOMMAND_BLOCK_USER_OPERATIONS,
      windowId: aWindowId
    });
    return;
  }
  blockUserOperations();
}

function unblockUserOperations() {
  gBlockingCount--;
  if (gBlockingCount < 0)
    gBlockingCount = 0;
  if (gBlockingCount == 0)
    document.documentElement.classList.remove(kTABBAR_STATE_BLOCKING);
}

function unblockUserOperationsIn(aWindowId) {
  if (gTargetWindow && gTargetWindow != aWindowId)
    return;

  if (!gTargetWindow) {
    browser.runtime.sendMessage({
      type: kCOMMAND_UNBLOCK_USER_OPERATIONS,
      windowId: aWindowId
    });
    return;
  }
  unblockUserOperations();
}
