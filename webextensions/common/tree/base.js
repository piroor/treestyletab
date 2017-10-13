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
var gTargetWindow    = null;
var gRestoringTree   = false;
var gNeedRestoreTree = false;
var gScrollLockedBy  = {};

var gIsMac = /Darwin/.test(navigator.platform);

function makeTabId(aApiTab) {
  return `tab-${aApiTab.windowId}-${aApiTab.id}`;
}

async function requestUniqueId(aTabId, aOptions = {}) {
  if (aOptions.inRemote) {
    return await browser.runtime.sendMessage({
      type:     kCOMMAND_REQUEST_UNIQUE_ID,
      id:       aTabId,
      forceNew: !!aOptions.forceNew
    });
  }

  var originalId    = null;
  var originalTabId = null;
  var duplicated    = false;
  if (!aOptions.forceNew) {
    //let oldId = await browser.sessions.getTabValue(aTabId, kPERSISTENT_ID);
    let container = getTabsContainer(getTabById(aTabId));
    let maxRetry  = container && container.waitingForRestored ? 500 : 0 ;
    let oldId     = await getTabValueWithRetry(aTabId, kPERSISTENT_ID, maxRetry);
    if (oldId && !oldId.tabId) // ignore broken information!
      oldId = null;

    if (oldId) {
      if (aTabId == oldId.tabId)
        return {
          id:            oldId.id,
          originalId:    null,
          originalTabId: null,
          restored:      true
        };

      // If the stored tabId is different, it is possibly duplicated tab.
      try {
        let tabWithOldId = await browser.tabs.get(oldId.tabId);
        if (!tabWithOldId)
          throw new Error('missing');
      }
      catch(e) {
        handleMissingTabError(e);
        // It fails if the tab doesn't exist.
        // There is no live tab for the tabId, thus
        // this seems to be a tab restored from session.
        // We need to update the related tab id.
        await browser.sessions.setTabValue(aTabId, kPERSISTENT_ID, {
          id:    oldId.id,
          tabId: aTabId
        });
        return {
          id:            oldId.id,
          originalId:    null,
          originalTabId: oldId.tabId,
          restored:      true
        };
      }
      aOptions.forceNew = true;
      originalId    = oldId.id;
      originalTabId = oldId.tabId;
      duplicated    = true;
    }
  }

  var adjective   = kID_ADJECTIVES[Math.floor(Math.random() * kID_ADJECTIVES.length)];
  var noun        = kID_NOUNS[Math.floor(Math.random() * kID_NOUNS.length)];
  var randomValue = Math.floor(Math.random() * 1000);
  var id          = `tab-${adjective}-${noun}-${Date.now()}-${randomValue}`;
  await browser.sessions.setTabValue(aTabId, kPERSISTENT_ID, {
    id:    id,
    tabId: aTabId // for detecttion of duplicated tabs
  });
  return { id, originalId, originalTabId, duplicated };
}

async function getTabValueWithRetry(aTabId, aKey, aMaxRetryDelay) {
  /*
    Because currently there is no way to know the timing all
    restored session information become readable, sessions.getTabValue()
    sometimes gets nothing result for actually duplicated/restored tabs.
    https://bugzilla.mozilla.org/show_bug.cgi?id=1394376 will help to fix
    this problem for duplicated tab case...
    Just as a workaround, now we wait for the next event loop.
  */
  await wait(0); // for safety
  aMaxRetryDelay = Math.max(aMaxRetryDelay, 1);
  let steps    = 10;
  let delay    = Math.max(aMaxRetryDelay / steps, 1);
  let tryStart = Date.now();
  do {
    try {
      let value = await browser.sessions.getTabValue(aTabId, aKey)
      if (value !== undeifned) {
        log(`getTabValueWithRetry(${aTabId}, ${aKey}): success with ${Date.now() - tryStart}msec delay `, value);
        return data;
      }
    }
    catch(e) {
      return null; // missing tab
    }
    await wait(delay);
  } while (Date.now() - tryStart < aMaxRetryDelay);
  log(`getTabValueWithRetry(${aTabId}, ${aKey}): failed with ${Date.now() - tryStart}msec delay`);
  return null;
}

function buildTab(aApiTab, aOptions = {}) {
  log('build tab for ', aApiTab);
  var tab = document.createElement('li');
  tab.apiTab = aApiTab;
  tab.setAttribute('id', makeTabId(aApiTab));
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

  if (aApiTab.id)
    tab.uniqueId = requestUniqueId(aApiTab.id, {
      inRemote: !!gTargetWindow
    }).then(aUniqueId => {
      if (tab && tab.parentNode) // possibly removed from document
        tab.setAttribute(kPERSISTENT_ID, aUniqueId.id);
      return aUniqueId;
    });
  else
    tab.uniqueId = Promise.resolve({
      id:            null,
      originalId:    null,
      originalTabId: null
    });

  tab.opened = new Promise((aResolve, aReject) => {
    tab._resolveOpened = aResolve;
  });
  tab.closedWhileActive = new Promise((aResolve, aReject) => {
    tab._resolveClosedWhileActive = aResolve;
  });

  return tab;
}

function updateTab(aTab, aNewState, aOptions = {}) {
  if ('url' in aNewState &&
      aNewState.url.indexOf(kGROUP_TAB_URI) == 0) {
    aTab.classList.add(kTAB_STATE_GROUP_TAB);
    aNewState.title = getTitleFromGroupTabURI(aNewState.url);
  }
  else if (aTab.apiTab.url.indexOf(kGROUP_TAB_URI) != 0) {
    aTab.classList.remove(kTAB_STATE_GROUP_TAB);
  }

  if (aOptions.forceApply ||
      'url' in aNewState)
    aTab.setAttribute(kCONTENT_LOCATION, aNewState.url);

  if (aOptions.forceApply ||
      'title' in aNewState) {
    let visibleLabel = aNewState.title;
    if (aNewState && aNewState.cookieStoreId) {
      let identity = gContextualIdentities[aNewState.cookieStoreId];
      if (identity)
        visibleLabel = `${aNewState.title} - ${identity.name}`;
    }
    if (!aOptions.forceApply &&
        !isActive(aTab))
      aTab.classList.add(kTAB_STATE_UNREAD);
    getTabLabel(aTab).textContent = aNewState.title;
    aTab.label = visibleLabel;
    window.onTabLabelUpdated && onTabLabelUpdated(aTab);
  }

  if (aOptions.forceApply ||
      'favIconUrl' in aNewState ||
       TabFavIconHelper.maybeImageTab(aNewState)) {
    window.onTabFaviconUpdated &&
      onTabFaviconUpdated(
        aTab,
        aNewState.favIconUrl || aNewState.url
      );
  }

  if ('status' in aNewState) {
    let reallyChanged = !aTab.classList.contains(aNewState.status);
    aTab.classList.remove(aNewState.status == 'loading' ? 'complete' : 'loading');
    aTab.classList.add(aNewState.status);
    if (aNewState.status == 'loading') {
      aTab.classList.remove(kTAB_STATE_BURSTING);
    }
    else if (!aOptions.forceApply && reallyChanged) {
      aTab.classList.add(kTAB_STATE_BURSTING);
      if (aTab.delayedBurstEnd)
        clearTimeout(aTab.delayedBurstEnd);
      aTab.delayedBurstEnd = setTimeout(() => {
        delete aTab.delayedBurstEnd;
        aTab.classList.remove(kTAB_STATE_BURSTING);
        if (!isActive(aTab))
          aTab.classList.add(kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
      }, configs.butstDuration);
    }
  }

  if ((aOptions.forceApply ||
       'pinned' in aNewState) &&
      aNewState.pinned != aTab.classList.contains(kTAB_STATE_PINNED)) {
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
      'audible' in aNewState) {
    if (aNewState.audible)
      aTab.classList.add(kTAB_STATE_AUDIBLE);
    else
      aTab.classList.remove(kTAB_STATE_AUDIBLE);
  }

  if (aOptions.forceApply ||
      'mutedInfo' in aNewState) {
    if (aNewState.mutedInfo.muted)
      aTab.classList.add(kTAB_STATE_MUTED);
    else
      aTab.classList.remove(kTAB_STATE_MUTED);
  }

  if (aTab.apiTab.audible && !aTab.apiTab.mutedInfo.muted)
    aTab.classList.add(kTAB_STATE_SOUND_PLAYING);
  else
    aTab.classList.remove(kTAB_STATE_SOUND_PLAYING);

  /*
  // On Firefox, "highlighted" is same to "activated" for now...
  // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/onHighlighted
  if (aOptions.forceApply ||
      'highlighted' in aNewState) {
    if (aNewState.highlighted)
      aTab.classList.add(kTAB_STATE_HIGHLIGHTED);
    else
      aTab.classList.remove(kTAB_STATE_HIGHLIGHTED);
  }
  */

  if (aOptions.forceApply ||
      'cookieStoreId' in aNewState) {
    for (let className of aTab.classList) {
      if (className.indexOf('contextual-identity-') == 0)
        aTab.classList.remove(className);
    }
    if (aNewState.cookieStoreId)
      aTab.classList.add(`contextual-identity-${aNewState.cookieStoreId}`);
  }

  if (aOptions.forceApply ||
      'incognito' in aNewState) {
    if (aNewState.incognito)
      aTab.classList.add(kTAB_STATE_PRIVATE_BROWSING);
    else
      aTab.classList.remove(kTAB_STATE_PRIVATE_BROWSING);
  }

  /*
  // currently "selected" is not available on Firefox, so the class is used only by other addons.
  if (aOptions.forceApply ||
      'selected' in aNewState) {
    if (aNewState.selected)
      aTab.classList.add(kTAB_STATE_SELECTED);
    else
      aTab.classList.remove(kTAB_STATE_SELECTED);
  }
  */

  if (aOptions.forceApply ||
      'discarded' in aNewState) {
    if (aNewState.discarded)
      aTab.classList.add(kTAB_STATE_DISCARDED);
    else
      aTab.classList.remove(kTAB_STATE_DISCARDED);
  }

  if (configs.debug) {
    aTab.setAttribute('title',
                      `
${aTab.apiTab.title}
#${aTab.id}
(${aTab.className})
uniqueId = <%${kPERSISTENT_ID}%>
duplicated = <%duplicated%> / <%originalTabId%> / <%originalId%>
tabId = ${aTab.apiTab.id}
windowId = ${aTab.apiTab.windowId}
`.trim());
    aTab.uniqueId.then(aUniqueId => {
      // reget it because it can be removed from document.
      aTab = getTabById({ tab: aTab.apiTab.id, window: aTab.apiTab.windowId });
      if (!aTab)
        return;
      aTab.setAttribute('title',
                        aTab.getAttribute('title')
                          .replace(`<%${kPERSISTENT_ID}%>`, aUniqueId.id)
                          .replace(`<%originalId%>`, aUniqueId.originalId)
                          .replace(`<%originalTabId%>`, aUniqueId.originalTabId)
                          .replace(`<%duplicated%>`, !!aUniqueId.originalId));
    });
  }
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

  window.onParentTabUpdated && onParentTabUpdated(aParent);
}

function buildTabsContainerFor(aWindowId) {
  var container = document.createElement('ul');
  container.windowId = aWindowId;
  container.setAttribute('id', `window-${aWindowId}`);
  container.classList.add('tabs');

  container.internalMovingCount =
    container.subTreeMovingCount =
    container.subTreeChildrenMovingCount =
    container.doingCollapseExpandCount =
    container.internalFocusCount =
    container.tryingReforcusForClosingCurrentTabCount =
    container.processingNewTabsCount =
    container.duplicatingTabsCount = 0;

  container.openingCount         = 0;
  container.openedNewTabs        = [];
  container.openedNewTabsTimeout = null;

  container.toBeOpenedTabsWithPositions = 0;
  container.toBeOpenedOrphanTabs        = 0;
  container.toBeDetachedTabs            = 0;
  container.toBeClosedTabs              = 0;

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
  return browser.tabs.update(aTab.apiTab.id, { active: true })
    .catch(e => {
      container.internalFocusCount--;
      handleMissingTabError(e);
    });
}


/* move tabs */

async function moveTabsBefore(aTabs, aReferenceTab, aOptions = {}) {
  log('moveTabsBefore: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (!aTabs.length || !aReferenceTab)
    return [];

  if (isAllTabsPlacedBefore(aTabs, aReferenceTab)) {
    log('moveTabsBefore:no need to move');
    return [];
  }
  return moveTabsInternallyBefore(aTabs, aReferenceTab, aOptions);
}
async function moveTabBefore(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsBefore([aTab], aReferenceTab, aOptions);
}

async function moveTabsInternallyBefore(aTabs, aReferenceTab, aOptions = {}) {
  if (!aTabs.length || !aReferenceTab)
    return [];

  log('moveTabsInternallyBefore: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (aOptions.inRemote) {
    let tabIds = await browser.runtime.sendMessage({
      type:     kCOMMAND_MOVE_TABS_BEFORE,
      windowId: gTargetWindow,
      tabs:     aTabs.map(aTab => aTab.id),
      nextTab:  aReferenceTab.id
    });
    return tabIds.map(getTabById);
  }

  var container = aTabs[0].parentNode;
  container.internalMovingCount += aTabs.length;

  var apiTabIds = aTabs.map(aTab => aTab.apiTab.id);
  try {
    var [toIndex, fromIndex] = await getApiTabIndex(aReferenceTab.apiTab.id, apiTabIds[0]);
    if (fromIndex < toIndex)
      toIndex--;
    await browser.tabs.move(apiTabIds, {
      windowId: container.windowId,
      index:    toIndex
    });
    // tab will be moved by handling of API event
  }
  catch(e) {
    handleMissingTabError(e);
    log('moveTabsInternallyBefore failed: ', String(e));
  }
  return apiTabIds.map(getTabById);
}
async function moveTabInternallyBefore(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsInternallyBefore([aTab], aReferenceTab, aOptions);
}

async function moveTabsAfter(aTabs, aReferenceTab, aOptions = {}) {
  log('moveTabsAfter: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (!aTabs.length || !aReferenceTab)
    return [];

  if (isAllTabsPlacedAfter(aTabs, aReferenceTab)) {
    log('moveTabsAfter:no need to move');
    return [];
  }
  return moveTabsInternallyAfter(aTabs, aReferenceTab, aOptions);
}
async function moveTabAfter(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsAfter([aTab], aReferenceTab, aOptions);
}

async function moveTabsInternallyAfter(aTabs, aReferenceTab, aOptions = {}) {
  if (!aTabs.length || !aReferenceTab)
    return [];

  log('moveTabsInternallyAfter: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (aOptions.inRemote) {
    let tabIds = await browser.runtime.sendMessage({
      type:        kCOMMAND_MOVE_TABS_AFTER,
      windowId:    gTargetWindow,
      tabs:        aTabs.map(aTab => aTab.id),
      previousTab: aReferenceTab.id
    });
    return tabIds.map(getTabById);
  }

  var container = aTabs[0].parentNode;
  container.internalMovingCount += aTabs.length;

  var apiTabIds = aTabs.map(aTab => aTab.apiTab.id);
  try {
    var [toIndex, fromIndex] = await getApiTabIndex(aReferenceTab.apiTab.id, apiTabIds[0]);
    if (fromIndex > toIndex)
      toIndex++;
    await browser.tabs.move(apiTabIds, {
      windowId: container.windowId,
      index:    toIndex
    });
    // tab will be moved by handling of API event
  }
  catch(e) {
    handleMissingTabError(e);
    log('moveTabsInternallyAfter failed: ', String(e));
  }
  return apiTabIds.map(getTabById);
}
async function moveTabInternallyAfter(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsInternallyAfter([aTab], aReferenceTab, aOptions);
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
    return;
  }
  try {
    let apiTabId;
    if (aOptions.tab) {
      apiTabId = aOptions.tab.apiTab.id;
    }
    else {
      let apiTabs = await browser.tabs.query({
        windowId: aOptions.windowId,
        active:   true
      });
      apiTabId = apiTabs[0].id;
    }
    await browser.tabs.update({
      windowId: aOptions.windowId,
      id:       apiTabId,
      url:      aURI
    });
  }
  catch(e) {
    handleMissingTabError(e);
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
        type:          kCOMMAND_NEW_TABS,
        uris:          aURIs,
        parent:        aOptions.parent && aOptions.parent.id,
        opener:        aOptions.opener && aOptions.opener.id,
        insertBefore:  aOptions.insertBefore && aOptions.insertBefore.id,
        insertAfter:   aOptions.insertAfter && aOptions.insertAfter.id,
        cookieStoreId: aOptions.cookieStoreId || null,
        inRemote:      false
      }));
    }
    else {
      let startIndex = calculateNewTabIndex(aOptions);
      let container  = getTabsContainer(aOptions.windowId);
      container.toBeOpenedTabsWithPositions += aURIs.length;
      await Promise.all(aURIs.map(async (aURI, aIndex) => {
        var params = {
          windowId: aOptions.windowId
        };
        if (aURI)
          params.url = aURI;
        if (aIndex == 0)
          params.active = !aOptions.inBackground;
        if (aOptions.opener)
          params.openerTabId = aOptions.opener.apiTab.id;
        if (startIndex > -1)
          params.index = startIndex + aIndex;
        if (aOptions.cookieStoreId)
          params.cookieStoreId = aOptions.cookieStoreId;
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


/* group tab */

function makeGroupTabURI(aTitle, aOptions = {}) {
  var base = kGROUP_TAB_URI;
  var temporaryOption = aOptions.temporary ? '&temporary=true' : '' ;
  return `${base}?title=${encodeURIComponent(aTitle)}${temporaryOption}`;
}

function getTitleFromGroupTabURI(aURI) {
  var title = aURI.match(/title=([^&;]*)/);
  return title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab.label.default');
}


/* blocking/unblocking */

var gBlockingCount = 0;
var gBlockingThrobberCount = 0;

function blockUserOperations(aOptions = {}) {
  gBlockingCount++;
  document.documentElement.classList.add(kTABBAR_STATE_BLOCKING);
  if (aOptions.throbber) {
    gBlockingThrobberCount++;
    document.documentElement.classList.add(kTABBAR_STATE_BLOCKING_WITH_THROBBER);
  }
}

function blockUserOperationsIn(aWindowId, aOptions = {}) {
  if (gTargetWindow && gTargetWindow != aWindowId)
    return;

  if (!gTargetWindow) {
    browser.runtime.sendMessage({
      type:     kCOMMAND_BLOCK_USER_OPERATIONS,
      windowId: aWindowId,
      throbber: !!aOptions.throbber
    });
    return;
  }
  blockUserOperations(aOptions);
}

function unblockUserOperations(aOptions = {}) {
  gBlockingThrobberCount--;
  if (gBlockingThrobberCount < 0)
    gBlockingThrobberCount = 0;
  if (gBlockingThrobberCount == 0)
    document.documentElement.classList.remove(kTABBAR_STATE_BLOCKING_WITH_THROBBER);

  gBlockingCount--;
  if (gBlockingCount < 0)
    gBlockingCount = 0;
  if (gBlockingCount == 0)
    document.documentElement.classList.remove(kTABBAR_STATE_BLOCKING);
}

function unblockUserOperationsIn(aWindowId, aOptions = {}) {
  if (gTargetWindow && gTargetWindow != aWindowId)
    return;

  if (!gTargetWindow) {
    browser.runtime.sendMessage({
      type:     kCOMMAND_UNBLOCK_USER_OPERATIONS,
      windowId: aWindowId,
      throbber: !!aOptions.throbber
    });
    return;
  }
  unblockUserOperations(aOptions);
}


function broadcastTabState(aTabs, aOptions = {}) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];
  browser.runtime.sendMessage({
    type:    kCOMMAND_BROADCAST_TAB_STATE,
    tabs:    aTabs.map(aTab => aTab.id),
    add:     aOptions.add || [],
    remove:  aOptions.remove || [],
    bubbles: !!aOptions.bubbles
  });
}


async function bookmarkTabs(aTabs, aOptions = {}) {
  var folderParams = {
    title: browser.i18n.getMessage('bookmarkFolder.label', aTabs[0].apiTab.title)
  };
  if (aOptions.parentId) {
    folderParams.parentId = aOptions.parentId;
    if ('index' in aOptions)
      folderParams.index = aOptions.index;
  }
  var folder = await browser.bookmarks.create(folderParams);
  for (let i = 0, maxi = aTabs.length; i < maxi; i++) {
    let tab = aTabs[i];
    await browser.bookmarks.create({
      parentId: folder.id,
      index:    i,
      title:    tab.apiTab.title,
      url:      tab.apiTab.url
    });
  }
  return folder;
}

async function notify(aParams = {}) {
  var id = await browser.notifications.create({
    type:    'basic',
    iconUrl: aParams.icon,
    title:   aParams.title,
    message: aParams.message
  });

  var timeout = aParams.timeout;
  if (typeof timeout != 'number')
    timeout = configs.notificationTimeout;
  if (timeout >= 0)
    await wait(timeout);

  await browser.notifications.clear(id);
}


/* TST API Helpers */

function serializeTabForTSTAPI(aTab) {
  return clone(aTab.apiTab, {
    states:   Array.slice(aTab.classList).filter(aState => kTAB_INTERNAL_STATES.indexOf(aState) < 0),
    children: getChildTabs(aTab).map(serializeTabForTSTAPI)
  });
}

async function sendTSTAPIMessage(aMessage, aOptions = {}) {
  var addons = window.gExternalListenerAddons;
  if (!addons)
    addons = await browser.runtime.sendMessage({
      type: kCOMMAND_REQUEST_REGISTERED_ADDONS
    });
  var uniqueTargets = {};
  for (let id of Object.keys(addons)) {
    uniqueTargets[id] = true;
  }
  if (aOptions.targets) {
    if (!Array.isArray(aOptions.targets))
      aOptions.targets = [aOptions.targets];
    for (let id of aOptions.targets) {
      uniqueTargets[id] = true;
    }
  }
  return Promise.all(Object.keys(uniqueTargets).map(async (aId) => {
    try {
      let result = await browser.runtime.sendMessage(aId, aMessage);
      return {
        id:     aId,
        result: result
      };
    }
    catch(e) {
      return {
        id:    aId,
        error: e
      };
    }
  }));
}
