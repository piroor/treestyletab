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

var gIsMac = /^Mac/i.test(navigator.platform);

function makeTabId(aApiTab) {
  return `tab-${aApiTab.windowId}-${aApiTab.id}`;
}

async function requestUniqueId(aTabOrId, aOptions = {}) {
  var tabId = aTabOrId;
  var tab   = null;
  if (typeof aTabOrId == 'number') {
    tab = getTabById(id);
  }
  else {
    tabId = aTabOrId.apiTab.id;
    tab   = aTabOrId;
  }

  if (aOptions.inRemote) {
    return await browser.runtime.sendMessage({
      type:     kCOMMAND_REQUEST_UNIQUE_ID,
      id:       tabId,
      forceNew: !!aOptions.forceNew
    });
  }

  var originalId    = null;
  var originalTabId = null;
  var duplicated    = false;
  if (!aOptions.forceNew) {
    let oldId = await browser.sessions.getTabValue(tabId, kPERSISTENT_ID);
    if (oldId && !oldId.tabId) // ignore broken information!
      oldId = null;

    if (oldId) {
      // If the tab detected from stored tabId is different, it is duplicated tab.
      try {
        let tabWithOldId = getTabById(oldId.tabId);
        if (!tabWithOldId)
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
        originalId = tabWithOldId.getAttribute(kPERSISTENT_ID) /* (await tabWithOldId.uniqueId).id // don't try to wait this, because it sometime causes deadlock */;
        duplicated = tab && tabWithOldId != tab && originalId == oldId.id;
        if (duplicated)
          originalTabId = oldId.tabId;
        else
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
      }
      catch(e) {
        handleMissingTabError(e);
        // It fails if the tab doesn't exist.
        // There is no live tab for the tabId, thus
        // this seems to be a tab restored from session.
        // We need to update the related tab id.
        await browser.sessions.setTabValue(tabId, kPERSISTENT_ID, {
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

  var adjective   = kID_ADJECTIVES[Math.floor(Math.random() * kID_ADJECTIVES.length)];
  var noun        = kID_NOUNS[Math.floor(Math.random() * kID_NOUNS.length)];
  var randomValue = Math.floor(Math.random() * 1000);
  var id          = `tab-${adjective}-${noun}-${Date.now()}-${randomValue}`;
  await browser.sessions.setTabValue(tabId, kPERSISTENT_ID, {
    id:    id,
    tabId: tabId // for detecttion of duplicated tabs
  });
  return { id, originalId, originalTabId, duplicated };
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

  window.onTabBuilt && onTabBuilt(tab, aOptions);

  if (aOptions.existing) {
    tab.classList.add(kTAB_STATE_ANIMATION_READY);
  }

  if (aApiTab.id)
    updateUniqueId(tab);
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

  tab.childTabs = [];
  tab.parentTab = null;

  return tab;
}

function updateUniqueId(aTab) {
  aTab.uniqueId = requestUniqueId(aTab, {
    inRemote: !!gTargetWindow
  }).then(aUniqueId => {
    if (ensureLivingTab(aTab)) // possibly removed from document while waiting
      aTab.setAttribute(kPERSISTENT_ID, aUniqueId.id);
    return aUniqueId;
  });
  return aTab.uniqueId;
}

function updateTab(aTab, aNewState = {}, aOptions = {}) {
  if ('url' in aNewState) {
    aTab.setAttribute(kCURRENT_URI, aNewState.url);
    if (aTab.dataset.discardURLAfterCompletelyLoaded &&
        aTab.dataset.discardURLAfterCompletelyLoaded != aNewState.url)
      delete aTab.dataset.discardURLAfterCompletelyLoaded;
  }

  // Loading of "about:(unknown type)" won't report new URL via tabs.onUpdated,
  // so we need to see the complete tab object.
  if (aOptions.tab && aOptions.tab.url.indexOf(kLEGACY_GROUP_TAB_URI) == 0) {
    browser.tabs.update(aOptions.tab.id, {

      url: aOptions.tab.url.replace(kLEGACY_GROUP_TAB_URI, kGROUP_TAB_URI)
    }).catch(handleMissingTabError);
    aTab.classList.add(kTAB_STATE_GROUP_TAB);
    return;
  }
  else if ('url' in aNewState &&
           aNewState.url.indexOf(kGROUP_TAB_URI) == 0) {
    aTab.classList.add(kTAB_STATE_GROUP_TAB);
    window.onGroupTabDetected && onGroupTabDetected(aTab);
  }
  else if (aTab.apiTab &&
           aTab.apiTab.url.indexOf(kGROUP_TAB_URI) != 0) {
    aTab.classList.remove(kTAB_STATE_GROUP_TAB);
  }

  if (aOptions.forceApply ||
      'title' in aNewState) {
    let visibleLabel = aNewState.title;
    if (aNewState && aNewState.cookieStoreId) {
      let identity = gContextualIdentities[aNewState.cookieStoreId];
      if (identity)
        visibleLabel = `${aNewState.title} - ${identity.name}`;
    }
    if (aOptions.forceApply && aTab.apiTab) {
      browser.sessions.getTabValue(aTab.apiTab.id, kTAB_STATE_UNREAD)
        .then(aUnread => {
          if (aUnread)
            aTab.classList.add(kTAB_STATE_UNREAD);
          else
            aTab.classList.remove(kTAB_STATE_UNREAD);
        });
    }
    else if (!isActive(aTab) && aTab.apiTab) {
      aTab.classList.add(kTAB_STATE_UNREAD);
      browser.sessions.setTabValue(aTab.apiTab.id, kTAB_STATE_UNREAD, true);
    }
    getTabLabel(aTab).textContent = aNewState.title;
    aTab.dataset.label = visibleLabel;
    window.onTabLabelUpdated && onTabLabelUpdated(aTab);
  }

  if ('favIconUrl' in aNewState ||
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
      }, configs.burstDuration);
    }
    if (aNewState.status == 'complete' &&
        aTab.apiTab &&
        aTab.apiTab.url == aTab.dataset.discardURLAfterCompletelyLoaded) {
      log(' => discard accidentally restored tab ', aTab.apiTab.id);
      if (typeof browser.tabs.discard == 'function')
        browser.tabs.discard(aTab.apiTab.id);
      delete aTab.dataset.discardURLAfterCompletelyLoaded;
    }
    window.onTabStateChanged && onTabStateChanged(aTab);
  }

  if ((aOptions.forceApply ||
       'pinned' in aNewState) &&
      aNewState.pinned != aTab.classList.contains(kTAB_STATE_PINNED)) {
    if (aNewState.pinned) {
      aTab.classList.add(kTAB_STATE_PINNED);
      aTab.removeAttribute(kLEVEL); // don't indent pinned tabs!
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

  if (aTab.apiTab &&
      aTab.apiTab.audible &&
      !aTab.apiTab.mutedInfo.muted)
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
    wait(0).then(() => {
      // Don't set this class immediately, because we need to know
      // the newly focused tab *was* discarded on onTabClosed handler.
      if (aNewState.discarded)
        aTab.classList.add(kTAB_STATE_DISCARDED);
      else
        aTab.classList.remove(kTAB_STATE_DISCARDED);
    });
  }

  updateTabDebugTooltip(aTab);
}

function updateTabDebugTooltip(aTab) {
  if (!configs.debug ||
      !aTab.apiTab)
    return;
  aTab.dataset.label = `
${aTab.apiTab.title}
#${aTab.id}
(${aTab.className})
uniqueId = <%${kPERSISTENT_ID}%>
duplicated = <%duplicated%> / <%originalTabId%> / <%originalId%>
restored = <%restored%>
tabId = ${aTab.apiTab.id}
windowId = ${aTab.apiTab.windowId}
`.trim();
  aTab.setAttribute('title', aTab.dataset.label);
  aTab.uniqueId.then(aUniqueId => {
    // reget it because it can be removed from document.
    aTab = getTabById({ tab: aTab.apiTab.id, window: aTab.apiTab.windowId });
    if (!aTab)
      return;
    aTab.setAttribute('title',
                      aTab.dataset.label = aTab.dataset.label
                        .replace(`<%${kPERSISTENT_ID}%>`, aUniqueId.id)
                        .replace(`<%originalId%>`, aUniqueId.originalId)
                        .replace(`<%originalTabId%>`, aUniqueId.originalTabId)
                        .replace(`<%duplicated%>`, !!aUniqueId.duplicated)
                        .replace(`<%restored%>`, !!aUniqueId.restored));
  });
}

function updateTabFocused(aTab) {
  var oldActiveTabs = clearOldActiveStateInWindow(aTab.apiTab.windowId);
  aTab.classList.add(kTAB_STATE_ACTIVE);
  aTab.apiTab.active = true;
  aTab.classList.remove(kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
  aTab.classList.remove(kTAB_STATE_UNREAD);
  browser.sessions.removeTabValue(aTab.apiTab.id, kTAB_STATE_UNREAD);
  return oldActiveTabs;
}

function updateParentTab(aParent) {
  if (!ensureLivingTab(aParent))
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
  container.dataset.windowId = aWindowId;
  container.setAttribute('id', `window-${aWindowId}`);
  container.classList.add('tabs');

  container.dataset.internalMovingCount =
    container.dataset.internalClosingCount =
    container.dataset.alreadyMovedTabsCount =
    container.dataset.subTreeMovingCount =
    container.dataset.subTreeChildrenMovingCount =
    container.dataset.doingIntelligentlyCollapseExpandCount =
    container.dataset.internalFocusCount =
    container.dataset.internalSilentlyFocusCount =
    container.dataset.tryingReforcusForClosingCurrentTabCount =
    container.dataset.duplicatingTabsCount = 0;

  container.dataset.preventAutoGroupNewTabsUntil = Date.now() + configs.autoGroupNewTabsDelayOnNewWindow;

  container.dataset.openingCount  = 0;
  container.dataset.openedNewTabs = '';
  container.dataset.openedNewTabsOpeners = '';

  container.dataset.toBeOpenedTabsWithPositions = 0;
  container.dataset.toBeOpenedOrphanTabs        = 0;
  container.dataset.toBeAttachedTabs            = 0;
  container.dataset.toBeDetachedTabs            = 0;

  return container;
}

function incrementContainerCounter(aContainer, aName, aDelta) {
  var count = parseInt(aContainer.dataset[aName]) + (aDelta || 1);
  aContainer.dataset[aName] = count;
  return count;
}

function decrementContainerCounter(aContainer, aName, aDelta) {
  var count = parseInt(aContainer.dataset[aName]) - (aDelta || 1);
  aContainer.dataset[aName] = count;
  return count;
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
      tab:      aTab.id,
      options:  aOptions
    });
    return;
  }
  var container = aTab.parentNode;
  incrementContainerCounter(container, 'internalFocusCount');
  if (aOptions.silently)
    incrementContainerCounter(container, 'internalSilentlyFocusCount');
  return browser.tabs.update(aTab.apiTab.id, { active: true })
    .catch(e => {
      decrementContainerCounter(container, 'internalFocusCount');
      if (aOptions.silently)
        decrementContainerCounter(container, 'internalSilentlyFocusCount');
      handleMissingTabError(e);
    });
}

function removeTabInternally(aTab, aOptions = {}) {
  return removeTabsInternally([aTab], aOptions);
}

function removeTabsInternally(aTabs, aOptions = {}) {
  aTabs = aTabs.filter(ensureLivingTab);
  if (!aTabs.length)
    return;
  log('removeTabsInternally: ', aTabs.map(dumpTab));
  if (aOptions.inRemote || aOptions.broadcast) {
    browser.runtime.sendMessage({
      type:    kCOMMAND_REMOVE_TABS_INTERNALLY,
      tabs:    aTabs.map(aTab => aTab.id),
      options: Object.assign({}, aOptions, {
        inRemote:    false,
        broadcast:   aOptions.inRemote && !aOptions.broadcast,
        broadcasted: !!aOptions.broadcast
      })
    });
    if (aOptions.inRemote)
      return;
  }
  var container = aTabs[0].parentNode;
  incrementContainerCounter(container, 'internalClosingCount', aTabs.length);
  if (aOptions.broadcasted)
    return;
  return browser.tabs.remove(aTabs.map(aTab => aTab.apiTab.id)).catch(handleMissingTabError);
}

/* move tabs */

async function moveTabsBefore(aTabs, aReferenceTab, aOptions = {}) {
  log('moveTabsBefore: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (!aTabs.length ||
      !ensureLivingTab(aReferenceTab))
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
  if (!aTabs.length ||
      !ensureLivingTab(aReferenceTab))
    return [];

  log('moveTabsInternallyBefore: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (aOptions.inRemote || aOptions.broadcast) {
    let tabIds = await browser.runtime.sendMessage({
      type:     kCOMMAND_MOVE_TABS_BEFORE,
      windowId: gTargetWindow,
      tabs:     aTabs.map(aTab => aTab.id),
      nextTab:  aReferenceTab.id,
      broadcasted: !!aOptions.broadcast
    });
    if (aOptions.inRemote)
      return tabIds.map(getTabById);
  }

  var container = aTabs[0].parentNode;
  var apiTabIds = aTabs.map(aTab => aTab.apiTab.id);
  try {
    /*
      Tab elements are moved by tabs.onMoved automatically, but
      the operation is asynchronous. To help synchronous operations
      following to this operation, we need to move tabs immediately.
    */
    let oldIndexes = [aReferenceTab].concat(aTabs).map(getTabIndex);
    for (let tab of aTabs) {
      let oldPreviousTab = getPreviousTab(tab);
      let oldNextTab     = getNextTab(tab);
      if (oldNextTab == aReferenceTab) // no move case
        continue;
      incrementContainerCounter(container, 'internalMovingCount');
      incrementContainerCounter(container, 'alreadyMovedTabsCount');
      container.insertBefore(tab, aReferenceTab);
      window.onTabElementMoved && onTabElementMoved(tab, {
        oldPreviousTab,
        oldNextTab
      });
    }
    if (parseInt(container.dataset.alreadyMovedTabsCount) <= 0) {
      log(' => actually nothing moved');
    }
    else {
      log('Tab nodes rearranged by moveTabsInternallyBefore:\n'+(!configs.debug ? '' :
        Array.slice(container.childNodes)
          .map(aTab => aTab.id+(aTabs.indexOf(aTab) > -1 ? '[MOVED]' : ''))
          .join('\n')
          .replace(/^/gm, ' - ')));
      let newIndexes = [aReferenceTab].concat(aTabs).map(getTabIndex);
      let minIndex = Math.min(...oldIndexes, ...newIndexes);
      let maxIndex = Math.max(...oldIndexes, ...newIndexes);
      for (let i = minIndex, allTabs = getTabs(container); i <= maxIndex; i++) {
        let tab = allTabs[i];
        if (!tab)
          continue;
        tab.apiTab.index = i;
      }

      if (!aOptions.broadcasted) {
        let toIndex, fromIndex;
        Promise.all([
          aOptions.delayedMove && wait(configs.newTabAnimationDuration), // Wait until opening animation is finished.
          (async () => {
            [toIndex, fromIndex] = await getApiTabIndex(aReferenceTab.apiTab.id, apiTabIds[0]);
          })()
        ]).then(() => {
          if (fromIndex < toIndex)
            toIndex--;
          browser.tabs.move(apiTabIds, {
            windowId: parseInt(container.dataset.windowId),
            index:    toIndex
          }).catch(handleMissingTabError);
        });
      }
    }
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
  if (!aTabs.length ||
      !ensureLivingTab(aReferenceTab))
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
  if (!aTabs.length ||
      !ensureLivingTab(aReferenceTab))
    return [];

  log('moveTabsInternallyAfter: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (aOptions.inRemote || aOptions.broadcast) {
    let tabIds = await browser.runtime.sendMessage({
      type:        kCOMMAND_MOVE_TABS_AFTER,
      windowId:    gTargetWindow,
      tabs:        aTabs.map(aTab => aTab.id),
      previousTab: aReferenceTab.id,
      broadcasted: !!aOptions.broadcast
    });
    if (aOptions.inRemote)
      return tabIds.map(getTabById);
  }

  var container = aTabs[0].parentNode;
  var apiTabIds = aTabs.map(aTab => aTab.apiTab.id);
  try {
    /*
      Tab elements are moved by tabs.onMoved automatically, but
      the operation is asynchronous. To help synchronous operations
      following to this operation, we need to move tabs immediately.
    */
    let oldIndexes = [aReferenceTab].concat(aTabs).map(getTabIndex);
    var nextTab = getNextTab(aReferenceTab);
    if (aTabs.indexOf(nextTab) > -1)
      nextTab = null;
    for (let tab of aTabs) {
      let oldPreviousTab = getPreviousTab(tab);
      let oldNextTab     = getNextTab(tab);
      if (oldNextTab == nextTab) // no move case
        continue;
      incrementContainerCounter(container, 'internalMovingCount');
      incrementContainerCounter(container, 'alreadyMovedTabsCount');
      container.insertBefore(tab, nextTab);
      window.onTabElementMoved && onTabElementMoved(tab, {
        oldPreviousTab,
        oldNextTab
      });
    }
    if (parseInt(container.dataset.alreadyMovedTabsCount) <= 0) {
      log(' => actually nothing moved');
    }
    else {
      log('Tab nodes rearranged by moveTabsInternallyAfter:\n'+(!configs.debug ? '' :
        Array.slice(container.childNodes)
          .map(aTab => aTab.id+(aTabs.indexOf(aTab) > -1 ? '[MOVED]' : ''))
          .join('\n')
          .replace(/^/gm, ' - ')));
      let newIndexes = [aReferenceTab].concat(aTabs).map(getTabIndex);
      let minIndex = Math.min(...oldIndexes, ...newIndexes);
      let maxIndex = Math.max(...oldIndexes, ...newIndexes);
      for (let i = minIndex, allTabs = getTabs(container); i <= maxIndex; i++) {
        let tab = allTabs[i];
        if (!tab)
          continue;
        tab.apiTab.index = i;
      }

      if (!aOptions.broadcasted) {
        let toIndex, fromIndex;
        Promise.all([
          aOptions.delayedMove && wait(configs.newTabAnimationDuration), // Wait until opening animation is finished.
          (async () => {
            [toIndex, fromIndex] = await getApiTabIndex(aReferenceTab.apiTab.id, apiTabIds[0]);
          })()
        ]).then(() => {
          if (fromIndex > toIndex)
            toIndex++;
          browser.tabs.move(apiTabIds, {
            windowId: parseInt(container.dataset.windowId),
            index:    toIndex
          }).catch(handleMissingTabError);
        });
      }
    }
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
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:    kCOMMAND_LOAD_URI,
      uri:     aURI,
      options: Object.assign({}, aOptions, {
        tab: aOptions.tab && aOptions.tab.id
      })
    });
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
    await browser.tabs.update(apiTabId, {
      url: aURI
    }).catch(handleMissingTabError);
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
      await browser.runtime.sendMessage(Object.assign({}, aOptions, {
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
      await waitUntilAllTabsAreCreated();
      let startIndex = calculateNewTabIndex(aOptions);
      let container  = getTabsContainer(aOptions.windowId);
      incrementContainerCounter(container, 'toBeOpenedTabsWithPositions', aURIs.length);
      await Promise.all(aURIs.map(async (aURI, aIndex) => {
        var params = {
          windowId: aOptions.windowId,
          active:   aIndex == 0 && !aOptions.inBackground
        };
        if (aURI)
          params.url = aURI;
        if (aOptions.opener)
          params.openerTabId = aOptions.opener.apiTab.id;
        if (startIndex > -1)
          params.index = startIndex + aIndex;
        if (aOptions.cookieStoreId)
          params.cookieStoreId = aOptions.cookieStoreId;
        var apiTab = await browser.tabs.create(params);
        await waitUntilTabsAreCreated(apiTab.id);
        var tab = getTabById({ tab: apiTab.id, window: apiTab.windowId });
        if (!aOptions.opener &&
            aOptions.parent &&
            tab)
          await attachTabTo(tab, aOptions.parent, {
            insertBefore: aOptions.insertBefore,
            insertAfter:  aOptions.insertAfter,
            forceExpand:  params.active,
            broadcast:    true
          });
        return tab.opened;
      }));
    }
  });
}


/* group tab */

function makeGroupTabURI(aOptions = {}) {
  var base = kGROUP_TAB_URI;
  var title = encodeURIComponent(aOptions.title || '');
  var temporaryOption = aOptions.temporary ? '&temporary=true' : '' ;
  var openerTabIdOption = aOptions.openerTabId ? `&openerTabId=${aOptions.openerTabId}` : '' ;
  return `${base}?title=${title}${temporaryOption}${openerTabIdOption}`;
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
  try {
    if (!(await Permissions.isGranted(Permissions.BOOKMARKS)))
      throw new Error('not permitted');
  }
  catch(e) {
    notify({
      title:   browser.i18n.getMessage('bookmark.notification.notPermitted.title'),
      message: browser.i18n.getMessage('bookmark.notification.notPermitted.message')
    });
    return null;
  }
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


function showTabs(aTabs = []) {
  if (typeof browser.tabs.show != 'function')
    return;

  for (let tab of aTabs) {
    if (tab.apiTab)
      tab = tab.apiTab;
    browser.tabs.show(tab.id);
  }
}

function hideTabs(aTabs = []) {
  if (typeof browser.tabs.hide != 'function')
    return;

  for (let tab of aTabs) {
    if (tab.apiTab)
      tab = tab.apiTab;
    if (!tab.pinned)
      browser.tabs.hide(tab.id);
  }
}


/* TST API Helpers */

function serializeTabForTSTAPI(aTab) {
  return Object.assign({}, aTab.apiTab, {
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

function snapshotTree(aTargetTab, aTabs) {
  var tabs = aTabs || getNormalTabs(aTargetTab);

  var snapshotById = {};
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
      level:         parseInt(aTab.getAttribute(kLEVEL) || 0)
    };
  }
  var snapshotArray = tabs.map(aTab => snapshotChild(aTab));
  for (let tab of tabs) {
    let item = snapshotById[tab.id];
    if (!item)
      continue;
    let parent = getParentTab(tab);
    item.parent = parent && parent.id;
    let next = getNextNormalTab(tab);
    item.next = next && next.id;
    let previous = getPreviousNormalTab(tab);
    item.previous = previous && previous.id;
  }
  var activeTab = getCurrentTab(aTargetTab);
  return {
    target:   snapshotById[aTargetTab.id],
    active:   activeTab && snapshotById[activeTab.id],
    tabs:     snapshotArray,
    tabsById: snapshotById
  };
}

function snapshotTreeForActionDetection(aTargetTab) {
  var prevTab = getPreviousNormalTab(aTargetTab);
  var nextTab = getNextNormalTab(aTargetTab);
  var tabs    = getAncestorTabs(prevTab).reverse().concat([prevTab, aTargetTab, nextTab]).filter(ensureLivingTab);
  return snapshotTree(aTargetTab, tabs);
}
