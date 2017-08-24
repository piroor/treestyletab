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


function onApiTabActivated(aActiveInfo) {
  if (gTargetWindow && aActiveInfo.windowId != gTargetWindow)
    return;

  var newTab = getTabById({ tab: aActiveInfo.tabId, window: aActiveInfo.windowId });
  if (!newTab)
    return;

  //cancelDelayedExpandOnTabSelect(); // for Ctrl-Tab

  var oldTabs = document.querySelectorAll(`.${kTAB_STATE_ACTIVE}`);
  for (let oldTab of oldTabs) {
    oldTab.classList.remove(kTAB_STATE_ACTIVE);
  }
  newTab.classList.add(kTAB_STATE_ACTIVE);

  log('onSelect: ', dumpTab(newTab));

  var focusChanged = window.onTabFocusing && onTabFocusing(newTab);

  newTab.parentNode.focusChangedByCurrentTabRemove = false;

  //if (!isTabInViewport(newTab))
  //  scrollToTab(newTab);

  if (focusChanged && oldTabs.length > 0)
    window.onTabFocused && onTabFocused(newTab, {
      previouslyFocusedTab: oldTabs[0]
    });
}

function onApiTabUpdated(aTabId, aChangeInfo, aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  var updatedTab = getTabById({ tab: aTabId, window: aTab.windowId });
  if (!updatedTab)
    return;

  updateTab(updatedTab, {
    label:   aTab.title,
    favicon: aTab.favIconUrl,
    status:  aTab.status,
    pinned:  aTab.pinned
  });
  updatedTab.apiTab = aTab;

  window.onTabUpdated && onTabUpdated(updatedTab);
}

function onApiTabCreated(aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  log('created, id: ', aTab.id);
  var container = getTabsContainer(aTab.windowId);
  if (!container) {
    container = buildTabsContainerFor(aTab.windowId);
    gAllTabs.appendChild(container);
  }
  var newTab = container.appendChild(buildTab(aTab));
  window.onTabOpening && onTabOpening(newTab);

  var opener = getTabById({ tab: aTab.openerTabId, window: aTab.windowId });
  if (opener) {
    log('opener: ', dumpTab(opener));
    attachTabTo(newTab, opener);
  }

  updateInsertionPositionInfo(newTab);

  container.openingCount++;
  setTimeout(() => container.openingCount--, 0);

  window.onTabOpened && onTabOpened(newTab);
}

async function onApiTabRemoved(aTabId, aRemoveInfo) {
  if (gTargetWindow && aRemoveInfo.windowId != gTargetWindow)
    return;

  var oldTab = getTabById({ tab: aTabId, window: aRemoveInfo.windowId });
  if (!oldTab)
    return;

  log('onRemoved: ', dumpTab(oldTab));

  //var backupAttributes = collectBackupAttributes(oldTab);
  //log('onTabClose: backupAttributes = ', backupAttributes);

  var closeParentBehavior = getCloseParentBehaviorForTab(oldTab);
  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    closeChildTabs(oldTab);

  if (oldTab.classList.contains(kTAB_STATE_POSSIBLE_CLOSING_CURRENT))
    tryMoveFocusFromClosingCurrentTab(oldTab);

  detachAllChildren(oldTab, {
    behavior: closeParentBehavior
  });
  //reserveCloseRelatedTabs(toBeClosedTabs);
  detachTab(oldTab, { dontUpdateIndent: true });
  //restoreTabAttributes(oldTab, backupAttributes);
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
  container.removeChild(aTab);
  if (!container.hasChildNodes())
    container.parentNode.removeChild(container);
}

async function onApiTabMoved(aTabId, aMoveInfo) {
  if (gTargetWindow && aMoveInfo.windowId != gTargetWindow)
    return;

  var movedTab = getTabById({ tab: aTabId, window: aMoveInfo.windowId });
  if (!movedTab)
    return;

  log('onMoved: ', dumpTab(movedTab), aMoveInfo);

  var canceled = await window.onTabMoving && onTabMoving(movedTab, aMoveInfo);
  if (canceled)
    return;

  var newNextIndex = aMoveInfo.toIndex;
  if (aMoveInfo.fromIndex < newNextIndex)
    newNextIndex++;
  var nextTab = getTabs(movedTab)[newNextIndex];
  movedTab.parentNode.insertBefore(movedTab, nextTab);

  await window.onTabMoved && onTabMoved(movedTab, aMoveInfo);
}

function onApiTabAttached(aTabId, aAttachInfo) {
  if (gTargetWindow &&
      aAttachInfo.newWindowId != gTargetWindow)
    return;

  var newTab = getTabById({ tab: aTabId, window: aAttachInfo.newWindowId });
}

function onApiTabDetached(aTabId, aDetachInfo) {
  if (gTargetWindow &&
      aAttachInfo.oldWindowId != gTargetWindow)
    return;

  var oldTab = getTabById({ tab: aTabId, window: aDetachInfo.oldWindowId });
  if (oldTab)
    getTabsContainer(oldTab).removeChild(oldTab);
}

