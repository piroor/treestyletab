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

function startObserveTabs() {
  browser.tabs.onActivated.addListener(onSelect);
  browser.tabs.onUpdated.addListener(onUpdated);
  browser.tabs.onCreated.addListener(onCreated);
  browser.tabs.onRemoved.addListener(onRemoved);
  browser.tabs.onMoved.addListener(onMoved);
  browser.tabs.onAttached.addListener(onAttached);
  browser.tabs.onDetached.addListener(onDetached);
}

function endObserveTabs() {
  browser.tabs.onActivated.removeListener(onSelect);
  browser.tabs.onUpdated.removeListener(onUpdated);
  browser.tabs.onCreated.removeListener(onCreated);
  browser.tabs.onRemoved.removeListener(onRemoved);
  browser.tabs.onMoved.removeListener(onMoved);
  browser.tabs.onAttached.removeListener(onAttached);
  browser.tabs.onDetached.removeListener(onDetached);
}


function onSelect(aActiveInfo) {
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

  var noMoreFocusChange = false;
  log('onSelect: ', dumpTab(newTab));
  if (gIsBackground) {
    if (isCollapsed(newTab)) {
      if (configs.autoExpandSubtreeOnCollapsedChildFocused) {
        for (let ancestor of getAncestorTabs(newTab)) {
          collapseExpandSubtree(ancestor, { collapsed: false });
        }
        handleNewActiveTab(newTab);
      }
      else {
        selectTabInternally(getRootTab(newTab));
        noMoreFocusChange = true;
      }
    }
    else if (/**
              * Focus movings by closing of the old current tab should be handled
              * only when it is activated by user preference expressly.
              */
             newTab.parentNode.focusChangedByCurrentTabRemove &&
             !configs.autoCollapseExpandSubtreeOnSelectOnCurrentTabRemove) {
      noMoreFocusChange = true;
    }
    else if (hasChildTabs(newTab) && isSubtreeCollapsed(newTab)) {
      handleNewActiveTab(newTab);
    }
  }

  newTab.parentNode.focusChangedByCurrentTabRemove = false;

  //if (!isTabInViewport(newTab))
  //  scrollToTab(newTab);

  if (gIsBackground &&
      !noMoreFocusChange &&
      oldTabs.length > 0) {
    oldTabs[0].classList.add(kTAB_STATE_POSSIBLE_CLOSING_CURRENT);
    setTimeout(() => {
      var possibleClosingCurrents = document.querySelectorAll(`.${kTAB_STATE_POSSIBLE_CLOSING_CURRENT}`);
      for (let tab of possibleClosingCurrents) {
        tab.classList.remove(kTAB_STATE_POSSIBLE_CLOSING_CURRENT);
      }
    }, 100);
  }
}
function handleNewActiveTab(aTab) {
  if (aTab.parentNode.doingCollapseExpand)
    return;

  log('handleNewActiveTab: ', dumpTab(aTab));

  if (handleNewActiveTab.timer)
    clearTimeout(handleNewActiveTab.timer);

  /**
   * First, we wait until all event listeners for tabs.onSelect
   * were processed.
   */
  handleNewActiveTab.timer = setTimeout(() => {
    delete handleNewActiveTab.timer;
    var shouldCollapseExpandNow = configs.autoCollapseExpandSubtreeOnSelect;
    var canCollapseTree = shouldCollapseExpandNow;
    var canExpandTree   = shouldCollapseExpandNow && aTab.parentNode.internalFocusCount == 0;
    log('handleNewActiveTab[delayed]: ', dumpTab(aTab), {
      canCollapseTree, canExpandTree, internalFocusCount: aTab.parentNode.internalFocusCount });
    if (canExpandTree) {
      if (canCollapseTree &&
          configs.autoExpandIntelligently)
        collapseExpandTreesIntelligentlyFor(aTab);
      else
        collapseExpandSubtree(aTab, { collapsed: false });
    }
  }, 0);
}

function onUpdated(aTabId, aChangeInfo, aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  var updatedTab = getTabById({ tab: aTabId, window: aTab.windowId });
  if (!updatedTab)
    return;

  updateTab(updatedTab, {
    label:   aTab.title,
    favicon: aTab.favIconUrl
  });
  updatedTab.apiTab = aTab;

  if (gIsBackground)
    reserveToSaveTreeStructure(updatedTab);
}

function onCreated(aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  log('created, id: ', aTab.id);
  var container = getTabsContainer(aTab.windowId);
  if (!container) {
    container = buildTabsContainerFor(aTab.windowId);
    gAllTabs.appendChild(container);
  }
  var newTab = container.appendChild(buildTab(aTab));
  if (canAnimate()) {
    updateTabCollapsed(newTab, {
      collapsed: true,
      justNow:   true
    });
    window.requestAnimationFrame(() => {
      newTab.classList.add(kTAB_STATE_ANIMATION_READY);
      updateTabCollapsed(newTab, {
        collapsed: false,
        justNow:   gRestoringTree,
        /**
         * When the system is too slow, the animation can start after
         * smooth scrolling is finished. The smooth scrolling should be
         * started together with the start of the animation effect.
         */
        onStart: () => scrollToNewTab(newTab)
      });
    });
  }
  else {
    newTab.classList.add(kTAB_STATE_ANIMATION_READY);
    if (!gIsBackground)
      scrollToNewTab(newTab)
  }

  var opener = getTabById({ tab: aTab.openerTabId, window: aTab.windowId });
  if (opener) {
    log('opener: ', dumpTab(opener));
    attachTabTo(newTab, opener);
  }

  updateInsertionPositionInfo(newTab);

  newTab.parentNode.openingCount++;
  setTimeout(() => newTab.parentNode.openingCount--, 0);

  if (gIsBackground)
    reserveToSaveTreeStructure(newTab);
}

function onRemoved(aTabId, aRemoveInfo) {
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

  if (gIsBackground)
    reserveToSaveTreeStructure(oldTab);

  if (canAnimate() && !isCollapsed(oldTab)) {
    oldTab.addEventListener('transitionend', () => {
      onRemovedComplete(oldTab)
    }, { once: true });
    oldTab.classList.add(kTAB_STATE_REMOVING);
    oldTab.style.marginBottom = `-${oldTab.getBoundingClientRect().height}px`;
  }
  else {
    oldTab.classList.add(kTAB_STATE_REMOVING);
    onRemovedComplete(oldTab);
  }

  if (!gIsBackground && isPinned(oldTab))
    positionPinnedTabsWithDelay();
}
function onRemovedComplete(aTab) {
  var container = aTab.parentNode;
  container.removeChild(aTab);
  if (!container.hasChildNodes())
    container.parentNode.removeChild(container);
}

function onMoved(aTabId, aMoveInfo) {
  if (gTargetWindow && aMoveInfo.windowId != gTargetWindow)
    return;

  log('onMoved: ', aTabId, aMoveInfo);
  var movedTab = getTabById({ tab: aTabId, window: aMoveInfo.windowId });
  if (!movedTab)
    return;

  if (gIsBackground)
    reserveToSaveTreeStructure(movedTab);

  if (gInternalMovingCount > 0) {
    log('internal move');
    return;
  }
  var newNextIndex = aMoveInfo.toIndex;
  if (aMoveInfo.fromIndex < newNextIndex)
    newNextIndex++;
  var nextTab = getTabs(movedTab)[newNextIndex];
  getTabsContainer(nextTab || movedTab).insertBefore(movedTab, nextTab);
}

function onAttached(aTabId, aAttachInfo) {
  if (gTargetWindow &&
      aAttachInfo.newWindowId != gTargetWindow)
    return;

  var newTab = getTabById({ tab: aTabId, window: aAttachInfo.newWindowId });
}

function onDetached(aTabId, aDetachInfo) {
  if (gTargetWindow &&
      aAttachInfo.oldWindowId != gTargetWindow)
    return;

  var oldTab = getTabById({ tab: aTabId, window: aDetachInfo.oldWindowId });
  if (oldTab)
    getTabsContainer(oldTab).removeChild(oldTab);
}

