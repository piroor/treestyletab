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

// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1398272
var gTabIdWrongToCorrect = {};
var gTabIdCorrectToWrong = {};

function startObserveApiTabs() {
  browser.tabs.onActivated.addListener(onApiTabActivated);
  browser.tabs.onUpdated.addListener(onApiTabUpdated);
  browser.tabs.onCreated.addListener(onApiTabCreated);
  browser.tabs.onRemoved.addListener(onApiTabRemoved);
  browser.tabs.onMoved.addListener(onApiTabMoved);
  browser.tabs.onAttached.addListener(onApiTabAttached);
  browser.tabs.onDetached.addListener(onApiTabDetached);
}

function endObserveApiTabs() {
  browser.tabs.onActivated.removeListener(onApiTabActivated);
  browser.tabs.onUpdated.removeListener(onApiTabUpdated);
  browser.tabs.onCreated.removeListener(onApiTabCreated);
  browser.tabs.onRemoved.removeListener(onApiTabRemoved);
  browser.tabs.onMoved.removeListener(onApiTabMoved);
  browser.tabs.onAttached.removeListener(onApiTabAttached);
  browser.tabs.onDetached.removeListener(onApiTabDetached);
}


async function onApiTabActivated(aActiveInfo) {
  if (gTargetWindow && aActiveInfo.windowId != gTargetWindow)
    return;

  var container = getOrBuildTabsContainer(aActiveInfo.windowId);
  var byInternalOperation = container.internalFocusCount > 0;
  if (byInternalOperation)
    container.internalFocusCount--;
  var byTabDuplication = container.duplicatingTabsCount > 0;
  var newTab = getTabById({ tab: aActiveInfo.tabId, window: aActiveInfo.windowId });
  if (!newTab)
    return;

  var oldTabs = clearOldActiveStateInWindow(aActiveInfo.windowId);
  newTab.classList.add(kTAB_STATE_ACTIVE);
  newTab.apiTab.active = true;
  newTab.classList.remove(kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
  newTab.classList.remove(kTAB_STATE_UNREAD);

  log('tabs.onActivated: ', dumpTab(newTab));

  var byCurrentTabRemove = container.resolveClosedWhileActiveForPreviousActiveTab;
  if (byCurrentTabRemove) {
    container.tryingReforcusForClosingCurrentTabCount++;
    container.resolveClosedWhileActiveForPreviousActiveTab();
    delete container.resolveClosedWhileActiveForPreviousActiveTab;
    let focusRedirected = await container.focusRedirectedForClosingCurrentTab;
    delete container.focusRedirectedForClosingCurrentTab;
    if (container.tryingReforcusForClosingCurrentTabCount > 0) // reduce count even if not redirected
      container.tryingReforcusForClosingCurrentTabCount--;
    log('focusRedirected: ', focusRedirected);
    if (focusRedirected.indexOf(true) > -1)
      return;
  }
  else if (container.tryingReforcusForClosingCurrentTabCount > 0) { // treat as "redirected unintentional tab focus"
    container.tryingReforcusForClosingCurrentTabCount--;
    byCurrentTabRemove = true;
    byInternalOperation = false;
  }

  if (!newTab.parentNode) // it can be removed while waiting
    return;

  if (window.onTabFocusing && await onTabFocusing(newTab, {
    byCurrentTabRemove,
    byTabDuplication,
    byInternalOperation
  }))
    return;

  if (!newTab.parentNode) // it can be removed while waiting
    return;

  window.onTabFocused && await onTabFocused(newTab, {
    byCurrentTabRemove,
    byTabDuplication,
    byInternalOperation
  });
}

function clearOldActiveStateInWindow(aWindowId) {
  var container = getTabsContainer(aWindowId);
  if (!container)
    return [];
  var oldTabs = document.querySelectorAll(`.${kTAB_STATE_ACTIVE}`);
  for (let oldTab of oldTabs) {
    oldTab.classList.remove(kTAB_STATE_ACTIVE);
    oldTab.apiTab.active = false;
  }
  return oldTabs;
}

function onApiTabUpdated(aTabId, aChangeInfo, aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1398272
  var correctId = gTabIdWrongToCorrect[aTabId];
  if (correctId)
    aTabId = aTab.id = correctId;

  var updatedTab = getTabById({ tab: aTabId, window: aTab.windowId });
  if (!updatedTab)
    return;

  updatedTab.apiTab = aTab;
  updateTab(updatedTab, aChangeInfo);
  updateParentTab(getParentTab(updatedTab));

  window.onTabUpdated && onTabUpdated(updatedTab);
}

function onApiTabCreated(aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  log('tabs.onCreated: ', aTab.id);
  return onNewTabTracked(aTab);
}

async function onNewTabTracked(aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  log('onNewTabTracked: ', aTab.id);
  var container = getOrBuildTabsContainer(aTab.windowId);
  container.processingNewTabsCount++;
  var newTab = buildTab(aTab, { inRemote: !!gTargetWindow });
  newTab.classList.add(kTAB_STATE_OPENING);
  var nextTab = getAllTabs(container)[aTab.index];
  container.insertBefore(newTab, nextTab);

  updateTab(newTab, aTab, { forceApply: true });

  var openedWithPosition = container.toBeOpenedTabsWithPositions > 0;
  var duplicatedInternally = container.duplicatingTabsCount > 0;

  var moved = window.onTabOpening && await onTabOpening(newTab, {
    maybeOpenedWithPosition: openedWithPosition,
    maybeOrphan: container.toBeOpenedOrphanTabs > 0,
    duplicatedInternally
  });

  if (container.parentNode) { // it can be removed while waiting
    if (container.toBeOpenedTabsWithPositions > 0)
      container.toBeOpenedTabsWithPositions--;

    if (container.toBeOpenedOrphanTabs > 0)
      container.toBeOpenedOrphanTabs--;

    if (duplicatedInternally)
      container.duplicatingTabsCount--;

    container.openingCount++;
    setTimeout(() => {
      if (!container.parentNode) // it was removed while waiting
        return;
      container.openingCount--;
    }, 0);
  }

  if (!newTab.parentNode) // it can be removed while waiting
    return;

  var uniqueId = await newTab.uniqueId;
  if (!newTab.parentNode) // it can be removed while waiting
    return;

  var duplicated = duplicatedInternally || uniqueId.duplicated;

  window.onTabOpened && onTabOpened(newTab, {
    openedWithPosition: openedWithPosition || moved,
    duplicated,
    duplicatedInternally,
    originalTab: duplicated && getTabById({ tab: uniqueId.originalTabId })
  });
  newTab.classList.remove(kTAB_STATE_OPENING);
  newTab._resolveOpened();

  container.processingNewTabsCount--;

  if (!duplicated &&
      uniqueId.restored)
    window.onTabRestored && onTabRestored(newTab);
}

async function onApiTabRemoved(aTabId, aRemoveInfo) {
  log('tabs.onRemoved: ', aTabId, aRemoveInfo);
  if (gTargetWindow && aRemoveInfo.windowId != gTargetWindow)
    return;

  // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1398272
  var wrongId = gTabIdCorrectToWrong[aTabId];
  if (wrongId)
    delete gTabIdWrongToCorrect[wrongId];
  delete gTabIdCorrectToWrong[aTabId];

  var container = getOrBuildTabsContainer(aRemoveInfo.windowId);
  var byInternalOperation = container.toBeClosedTabs > 0;
  if (byInternalOperation)
    container.toBeClosedTabs--;

  var oldTab = getTabById({ tab: aTabId, window: aRemoveInfo.windowId });
  if (!oldTab)
    return;

  log('tabs.onRemoved, tab is found: ', dumpTab(oldTab));

  if (isActive(oldTab))
    container.resolveClosedWhileActiveForPreviousActiveTab = oldTab._resolveClosedWhileActive;

  window.onTabClosed && await onTabClosed(oldTab, {
    byInternalOperation
  });

  oldTab.classList.add(kTAB_STATE_REMOVING);

  if (!isCollapsed(oldTab) &&
      window.onTabCompletelyClosed) {
    await onTabCompletelyClosed(oldTab, {
      byInternalOperation
    });
    onApiTabRemovedComplete(oldTab);
  }
  else {
    onApiTabRemovedComplete(oldTab);
  }
}
function onApiTabRemovedComplete(aTab) {
  var container = aTab.parentNode;
  if (!container) // it was removed while waiting
    return;
  container.removeChild(aTab);
  if (!container.hasChildNodes())
    container.parentNode.removeChild(container);
}

async function onApiTabMoved(aTabId, aMoveInfo) {
  if (gTargetWindow && aMoveInfo.windowId != gTargetWindow)
    return;

  var container = getOrBuildTabsContainer(aMoveInfo.windowId);
  var byInternalOperation = container.internalMovingCount > 0;

  /* When a tab is pinned, tabs.onMoved may be notified before
     tabs.onUpdated(pinned=true) is notified. As the result,
     descendant tabs are unexpectedly moved to the top of the
     tab bar to follow their parent pinning tab. To avoid this
     problem, we have to wait for a while with this "async" and
     do following processes after the tab is completely pinned. */
  var movedTab = getTabById({ tab: aTabId, window: aMoveInfo.windowId });
  if (!movedTab) {
    if (byInternalOperation)
      container.internalMovingCount--;
    return;
  }

  log('tabs.onMoved: ', dumpTab(movedTab), aMoveInfo, movedTab.apiTab);

  var moveInfo = clone(aMoveInfo, {
    byInternalOperation,
    oldPreviousTab: getPreviousTab(movedTab),
    oldNextTab:     getNextTab(movedTab)
  });
  var canceled = window.onTabMoving && await onTabMoving(movedTab, moveInfo);
  if (!canceled &&
      movedTab.parentNode) { // it is removed while waiting
    let newNextIndex = aMoveInfo.toIndex;
    if (aMoveInfo.fromIndex < newNextIndex)
      newNextIndex++;
    let nextTab = getTabs(movedTab)[newNextIndex];
    movedTab.parentNode.insertBefore(movedTab, nextTab);

    window.onTabMoved && await onTabMoved(movedTab, moveInfo);
  }
  if (byInternalOperation)
    container.internalMovingCount--;
}

async function onApiTabAttached(aTabId, aAttachInfo) {
  if (gTargetWindow &&
      aAttachInfo.newWindowId != gTargetWindow)
    return;

  log('tabs.onAttached, id: ', aTabId, aAttachInfo);
  var apiTab;
  try {
    apiTab = await browser.tabs.get(aTabId);
    log(`New apiTab for attached tab ${aTabId}: `, apiTab);
    if (!apiTab)
      return;
  }
  catch(e) {
    handleMissingTabError(e);
  }

  // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1398272
  if (apiTab.id != aTabId) {
    let oldWrongId = gTabIdCorrectToWrong[aTabId];
    if (oldWrongId)
      delete gTabIdWrongToCorrect[oldWrongId];
    gTabIdWrongToCorrect[apiTab.id] = aTabId;
    gTabIdCorrectToWrong[aTabId] = apiTab.id;
    browser.runtime.sendMessage({
      type: kCOMMAND_BROADCAST_TAB_ID_TABLES_UPDATE,
      oldWrongId:   oldWrongId,
      newWrongId:   apiTab.id,
      newCorrectId: aTabId
    });
    apiTab.id = aTabId;
  }

  clearOldActiveStateInWindow(aAttachInfo.newWindowId);
  onNewTabTracked(apiTab);
}

function onApiTabDetached(aTabId, aDetachInfo) {
  if (gTargetWindow &&
      aDetachInfo.oldWindowId != gTargetWindow)
    return;

  log('tabs.onDetached, id: ', aTabId, aDetachInfo);
  var oldTab = getTabById({ tab: aTabId, window: aDetachInfo.oldWindowId });
  if (!oldTab)
    return;

  if (oldTab.parentNode.toBeDetachedTabs > 0) {
    oldTab.parentNode.toBeDetachedTabs--;
  }
  else {
    window.onTabDetachedFromWindow && onTabDetachedFromWindow(oldTab);
  }

  var container = oldTab.parentNode;
  container.removeChild(oldTab);
  if (!container.hasChildNodes())
    container.parentNode.removeChild(container);
}

