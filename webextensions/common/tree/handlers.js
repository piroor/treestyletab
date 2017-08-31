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
  container.processingNewTabsCount++;
  var byCurrentTabRemove = container.focusChangedByCurrentTabRemoveCount > 0;
  var newTab = await getTabById({ tab: aActiveInfo.tabId, window: aActiveInfo.windowId });
  if (!newTab) {
    container.processingNewTabsCount--;
    return;
  }

  //cancelDelayedExpandOnTabSelect(); // for Ctrl-Tab

  var oldTabs = clearOldActiveStateInWindow(aActiveInfo.windowId)
  newTab.classList.add(kTAB_STATE_ACTIVE);
  newTab.classList.remove(kTAB_STATE_UNREAD);

  log('onSelect: ', dumpTab(newTab));

  window.onTabFocusing && onTabFocusing(newTab, {
    byCurrentTabRemove
  });

  if (container.focusChangedByCurrentTabRemoveCount > 0)
    container.focusChangedByCurrentTabRemoveCount--;

  window.onTabFocused && onTabFocused(newTab, {
    byCurrentTabRemove,
    previouslyFocusedTab: oldTabs.length > 0 ? oldTabs[0] : null
  });

  container.processingNewTabsCount--;
}

function clearOldActiveStateInWindow(aWindowId) {
  var container = getTabsContainer(aWindowId);
  if (!container)
    return [];
  var oldTabs = document.querySelectorAll(`.${kTAB_STATE_ACTIVE}`);
  for (let oldTab of oldTabs) {
    oldTab.classList.remove(kTAB_STATE_ACTIVE);
  }
  return oldTabs;
}

async function onApiTabUpdated(aTabId, aChangeInfo, aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  var updatedTab = await getTabById({ tab: aTabId, window: aTab.windowId });
  if (!updatedTab)
    return;

  updateTab(updatedTab, aTab);
  updatedTab.apiTab = aTab;
  updateParentTab(getParentTab(updatedTab));

  window.onTabUpdated && onTabUpdated(updatedTab);
}

async function onApiTabCreated(aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  log('onApiTabCreated: ', aTab.id);
  return onNewTabTracked(aTab);
}

async function onNewTabTracked(aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  log('onNewTabTracked: ', aTab.id);
  var container = getOrBuildTabsContainer(aTab.windowId);
  var newTab = await buildTab(aTab, { inRemote: !!gTargetWindow });
  var nextTab = getAllTabs(container)[aTab.index];
  container.insertBefore(newTab, nextTab);

  updateTab(newTab, aTab, { forceApply: true });

  var openedWithPosition = container.toBeOpenedTabsWithPositions > 0;

  window.onTabOpening && await onTabOpening(newTab, {
    maybeOpenedWithPosition: openedWithPosition,
    maybeOrphan: container.toBeOpenedOrphanTabs > 0
  });

  if (container.parentNode) { // it can be removed while waiting
    if (container.toBeOpenedTabsWithPositions > 0)
      container.toBeOpenedTabsWithPositions--;

    if (container.toBeOpenedOrphanTabs > 0)
      container.toBeOpenedOrphanTabs--;

    //updateInsertionPositionInfo(newTab);

    container.openingCount++;
    setTimeout(() => {
      if (!container.parentNode) // it was removed while waiting
        return;
      container.openingCount--;
    }, 0);
  }

  if (newTab.parentNode) // it can be removed while waiting
    window.onTabOpened && onTabOpened(newTab, {
      openedWithPosition
    });
}

async function onApiTabRemoved(aTabId, aRemoveInfo) {
  if (gTargetWindow && aRemoveInfo.windowId != gTargetWindow)
    return;

  var oldTab = await getTabById({ tab: aTabId, window: aRemoveInfo.windowId });
  if (!oldTab)
    return;

  log('onApiTabRemoved: ', dumpTab(oldTab));

  if (oldTab.classList.contains(kTAB_STATE_POSSIBLE_CLOSING_CURRENT))
    tryMoveFocusFromClosingCurrentTab(oldTab);

  //updateLastScrollPosition();

  window.onTabClosed && onTabClosed(oldTab);

  oldTab.classList.add(kTAB_STATE_REMOVING);

  if (!isCollapsed(oldTab) &&
      window.onTabCompletelyClosed) {
    await onTabCompletelyClosed(oldTab);
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

  /* When a tab is pinned, tabs.onMoved may be notified before
     tabs.onUpdated(pinned=true) is notified. As the result,
     descendant tabs are unexpectedly moved to the top of the
     tab bar to follow their parent pinning tab. To avoid this
     problem, we have to wait for a while with this "async" and
     do following processes after the tab is completely pinned. */
  var movedApiTab = await browser.tabs.get(aTabId);
  var movedTab = await getTabById({ tab: aTabId, window: aMoveInfo.windowId });
  if (!movedTab)
    return;

  log('onMoved: ', dumpTab(movedTab), aMoveInfo, movedApiTab);

  var canceled = window.onTabMoving && await onTabMoving(movedTab, aMoveInfo);
  if (canceled ||
      !movedTab.parentNode) // it is removed while waiting
    return;

  var newNextIndex = aMoveInfo.toIndex;
  if (aMoveInfo.fromIndex < newNextIndex)
    newNextIndex++;
  var nextTab = getTabs(movedTab)[newNextIndex];
  movedTab.parentNode.insertBefore(movedTab, nextTab);

  window.onTabMoved && await onTabMoved(movedTab, aMoveInfo);
}

async function onApiTabAttached(aTabId, aAttachInfo) {
  if (gTargetWindow &&
      aAttachInfo.newWindowId != gTargetWindow)
    return;

  log('onApiTabAttached, id: ', aTabId, aAttachInfo);
  var apiTab = await browser.tabs.get(aTabId);
  if (!apiTab)
    return;

  clearOldActiveStateInWindow(aAttachInfo.newWindowId);
  onNewTabTracked(apiTab);
}

async function onApiTabDetached(aTabId, aDetachInfo) {
  if (gTargetWindow &&
      aDetachInfo.oldWindowId != gTargetWindow)
    return;

  log('onApiTabDetached, id: ', aTabId, aDetachInfo);
  var oldTab = await getTabById({ tab: aTabId, window: aDetachInfo.oldWindowId });
  if (!oldTab)
    return;

  //var backupAttributes = collectBackupAttributes(oldTab);
  //log('onTabClose: backupAttributes = ', backupAttributes);

  if (isActive(oldTab))
    tryMoveFocusFromClosingCurrentTab(oldTab);

  if (oldTab.parentNode.toBeDetachedTabs > 0) {
    oldTab.parentNode.toBeDetachedTabs--;
  }
  else {
    window.onTabDetachedFromWindow && onTabDetachedFromWindow(oldTab);
  }
  //updateLastScrollPosition();

  var container = oldTab.parentNode;
  container.removeChild(oldTab);
  if (!container.hasChildNodes())
    container.parentNode.removeChild(container);
}

