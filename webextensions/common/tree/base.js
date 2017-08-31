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
var gNeedRestoreTree = false;

var gIsMac = /Darwin/.test(navigator.platform);

var gWaitingForTabIdGenerated = 0;

async function getOrGenerateTabId(aApiTab, aOptions = {}) {
  var oldId = await browser.sessions.getTabValue(aApiTab.id, kID);
  if (oldId)
    return oldId;

  if (aOptions.inRemote) {
    gWaitingForTabIdGenerated++;
    aOptions.retryCount = 0;
    let response = await browser.runtime.sendMessage({
      type:     kCOMMAND_GET_OR_GENERATE_UNIQUE_ID,
      windowId: aApiTab.windowId,
      tabId:    aApiTab.id
    });
    gWaitingForTabIdGenerated--;
    if (!response || !response.id) {
      log('FATAL ERROR: failed to get unique id from background.');
      if (aOptions.retryCount < 10) {
        aOptions.retryCount++;
        return getOrGenerateTabId(aApiTab, aOptions);
      }
      else {
        throw new Error('FATAL ERROR: failed to get unique id from background.');
      }
    }
    return response && response.id;
  }

  var adjective = kID_ADJECTIVES[Math.floor(Math.random() * kID_ADJECTIVES.length)];
  var noun = kID_NOUNS[Math.floor(Math.random() * kID_NOUNS.length)];
  var randomValue = Math.floor(Math.random() * 1000);
  var id = `tab-${adjective}-${noun}-${Date.now()}-${randomValue}`;
  await browser.sessions.setTabValue(aApiTab.id, kID, id);
  return id;
}

async function buildTab(aApiTab, aOptions = {}) {
  var id = await getOrGenerateTabId(aApiTab, aOptions);
  return syncBuildTabWithId(aApiTab, id, aOptions);
}

function syncBuildTabWithId(aApiTab, aId, aOptions = {}) {
  log('build tab for ', aApiTab, aId);
  var tab = document.createElement('li');
  tab.apiTab = aApiTab;
  tab.setAttribute('id', aId || Math.floor(Math.random() * 65000));
  tab.setAttribute(kAPI_TAB_ID, aApiTab.id || -1);
  tab.setAttribute(kAPI_WINDOW_ID, aApiTab.windowId || -1);
  //tab.setAttribute(kCHILDREN, '');
  tab.classList.add('tab');
  if (aApiTab.active)
    tab.classList.add(kTAB_STATE_ACTIVE);
  tab.classList.add(kTAB_STATE_SUBTREE_COLLAPSED);

  var label = document.createElement('span');
  label.classList.add(kLABEL);
  tab.appendChild(label);

  window.onTabBuilt && onTabBuilt(tab);

  if (aOptions.existing) {
    tab.classList.add(kTAB_STATE_ANIMATION_READY);
  }

  return tab;
}

function updateTab(aTab, aNewState, aOptions = {}) {
  var oldState = aTab.apiTab;
  var label = aNewState.title;
  if (aNewState.url && aNewState.url.indexOf(kGROUP_TAB_URI) == 0) {
    aTab.classList.add(kTAB_STATE_GROUP_TAB);
    label = getTitleFromGroupTabURI(aNewState.url);
  }
  else {
    aTab.classList.remove(kTAB_STATE_GROUP_TAB);
  }

  if (aOptions.forceApply ||
      aNewState.url != oldState.url)
    aTab.setAttribute(kCONTENT_LOCATION, aNewState.url);

  if (aOptions.forceApply ||
      label != oldState.title) {
    getTabLabel(aTab).textContent = label;
    aTab.setAttribute('title', label);
    if (label != oldState.title &&
        !isActive(aTab))
      aTab.classList.add(kTAB_STATE_UNREAD);
  }

  if (aOptions.forceApply ||
      aNewState.favIconUrl != oldState.favIconUrl ||
      (maybeImageUrl(aNewState.url) &&
       aNewState.url != oldState.url)) {
    window.onTabFaviconUpdated &&
      onTabFaviconUpdated(
        aTab,
        aNewState.favIconUrl ||
          (maybeImageUrl(aNewState.url) && aNewState.url)
      );
  }

  if (aOptions.forceApply ||
      aNewState.status != oldState.status) {
    if (oldState)
      aTab.classList.remove(oldState.status);
    aTab.classList.add(aNewState.status);
  }

  if (aOptions.forceApply ||
      aNewState.pinned != oldState.pinned) {
    if (aNewState.pinned) {
      aTab.classList.add(kTAB_STATE_PINNED);
      window.onTabPinned && onTabPinned(aTab);
    }
    else {
      aTab.classList.remove(kTAB_STATE_PINNED);
      window.onTabUnpinned && onTabUnpinned(aTab);
    }
  }

  if (aOptions.forceApply ||
      aNewState.audible != oldState.audible) {
    if (aNewState.audible)
      aTab.classList.add(kTAB_STATE_AUDIBLE);
    else
      aTab.classList.remove(kTAB_STATE_AUDIBLE);

    if (aNewState.audible && !aNewState.mutedInfo.muted)
      aTab.classList.add(kTAB_STATE_SOUND_PLAYING);
    else
      aTab.classList.remove(kTAB_STATE_SOUND_PLAYING);
  }

  if (aOptions.forceApply ||
      aNewState.mutedInfo.muted != oldState.mutedInfo.muted) {
    if (aNewState.mutedInfo.muted)
      aTab.classList.add(kTAB_STATE_MUTED);
    else
      aTab.classList.remove(kTAB_STATE_MUTED);
  }

/*
  // On Firefox, "highlighted" is same to "activated" for now...
  // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/onHighlighted
  if (aOptions.forceApply ||
      aNewState.highlighted != oldState.highlighted) {
    if (aNewState.highlighted)
      aTab.classList.add(kTAB_STATE_HIGHLIGHTED);
    else
      aTab.classList.remove(kTAB_STATE_HIGHLIGHTED);
  }
*/

  if (aOptions.forceApply ||
      aNewState.selected != oldState.selected) {
    if (aNewState.selected)
      aTab.classList.add(kTAB_STATE_SELECTED);
    else
      aTab.classList.remove(kTAB_STATE_SELECTED);
  }

  if (configs.debug)
    aTab.setAttribute('title',
      `
${label}
#${aTab.id}
${aTab.className}
tabId = ${aNewState.id}
windowId = ${aNewState.windowId}
`.trim());
}

function maybeImageUrl(aURL) {
  return /\.(jpe?g|png|gif|bmp|svg)/i.test(aURL);
}

function updateParentTab(aParent) {
  if (!aParent)
    return;

  var children = getChildTabs(aParent);

  if (children.some(maybeSoundPlaying))
    aParent.classList.add(kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
  else
    aParent.classList.remove(kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);

  if (children.some(maybeMuted))
    aParent.classList.add(kTAB_STATE_HAS_MUTED_MEMBER);
  else
    aParent.classList.remove(kTAB_STATE_HAS_MUTED_MEMBER);

  updateParentTab(getParentTab(aParent));
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
  container.focusChangedByCurrentTabRemoveCount = 0;
  container.processingNewTabsCount = 0;

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
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:     kCOMMAND_SELECT_TAB_INTERNALLY,
      windowId: aTab.apiTab.windowId,
      tab:      aTab.id
    });
    return;
  }
  var container = aTab.parentNode;
  container.internalFocusCount++;
  await browser.tabs.update(aTab.apiTab.id, { active: true })
          .catch(handleMissingTabError);
}


/* move tabs */

async function moveTabsInternallyBefore(aTabs, aReferenceTab, aOptions = {}) {
  if (!aTabs.length || !aReferenceTab)
    return;

  log('moveTabsInternallyBefore: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:     kCOMMAND_MOVE_TABS_INTERNALLY_BEFORE,
      windowId: gTargetWindow,
      tabs:     aTabs.map(aTab => aTab.id),
      nextTab:  aReferenceTab.id
    });
    return;
  }

  var container = aTabs[0].parentNode;
  container.internalMovingCount += aTabs.length;
  try {
    var [toIndex, fromIndex] = await getApiTabIndex(aReferenceTab.apiTab.id, aTabs[0].apiTab.id);
    if (fromIndex < toIndex)
        toIndex--;
    await browser.tabs.move(aTabs.map(aTab => aTab.apiTab.id), {
      windowId: container.windowId,
      index: toIndex
    });
    // tab will be moved by handling of API event
  }
  catch(e) {
    log('moveTabsInternallyBefore failed: ', String(e));
  }
}
async function moveTabInternallyBefore(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsInternallyBefore([aTab], aReferenceTab, aOptions = {});
}

async function moveTabsInternallyAfter(aTabs, aReferenceTab, aOptions = {}) {
  if (!aTabs.length || !aReferenceTab)
    return;

  log('moveTabsInternallyAfter: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:        kCOMMAND_MOVE_TABS_INTERNALLY_AFTER,
      windowId:    gTargetWindow,
      tabs:        aTabs.map(aTab => aTab.id),
      previousTab: aReferenceTab.id
    });
    return;
  }

  var container = aTabs[0].parentNode;
  container.internalMovingCount += aTabs.length;
  try {
    var [toIndex, fromIndex] = await getApiTabIndex(aReferenceTab.apiTab.id, aTabs[0].apiTab.id);
    if (fromIndex > toIndex)
      toIndex++;
    await browser.tabs.move(aTabs.map(aTab => aTab.apiTab.id), {
      windowId: container.windowId,
      index: toIndex
    });
    // tab will be moved by handling of API event
  }
  catch(e) {
    log('moveTabsInternallyAfter failed: ', String(e));
  }
}
async function moveTabInternallyAfter(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsInternallyAfter([aTab], aReferenceTab, aOptions = {});
}


/* open something in tabs */

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

function openNewTab(aOptions = {}) {
  return openURIInTab(null, aOptions);
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
        var tab = await getTabById({ tab: apiTab.id, window: apiTab.windowId });
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


/* group tab */

function makeGroupTabURI(aTitle) {
  var base = kGROUP_TAB_URI;
  return `${base}?title=${encodeURIComponent(aTitle)}`;
}

function getTitleFromGroupTabURI(aURI) {
  var title = aURI.match(/title=([^&;]*)/);
  return title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab.label.default');
}


/* blocking/unblocking */

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


function broadcastTabState(aTab, aOptions = {}) {
  browser.runtime.sendMessage({
    type:   kCOMMAND_BROADCAST_TAB_STATE,
    tab:    aTab.id,
    add:    aOptions.add || [],
    remove: aOptions.remove || [],
    bubbles: !!aOptions.bubbles
  });
}
