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


function omMouseDown(aEvent) {
  var tab = findTabFromEvent(aEvent);
  if (!tab || tab.classList.contains('removing'))
    return;
  if (aEvent.button == 1 ||
      (aEvent.button == 0 && (aEvent.ctrlKey || aEvent.metaKey))) {
    log('middle-click to close');
    browser.tabs.remove(tab.apiTab.id);
    aEvent.stopPropagation();
    aEvent.preventDefault();
    return;
  }
  browser.tabs.update(tab.apiTab.id, { active: true });
}

function onSelect(aActiveInfo) {
  if (gTargetWindow && aActiveInfo.windowId != gTargetWindow)
    return;

  var newTab = findTabById({ tab: aActiveInfo.tabId, window: aActiveInfo.windowId });
  if (!newTab || newTab.classList.contains('removing'))
    return;
  var oldTabs = document.querySelectorAll('.active');
  for (let oldTab of oldTabs) {
    oldTab.classList.remove('active');
  }
  newTab.classList.add('active');
}

function onUpdated(aTabId, aChangeInfo, aTab) {
  if (gTargetWindow && aTab.windowId != gTargetWindow)
    return;

  var updatedTab = findTabById({ tab: aTabId, window: aTab.windowId });
  if (!updatedTab || updatedTab.classList.contains('removing'))
    return;
  if (aTab.title != updatedTab.textContent)
    updatedTab.textContent = aTab.title;
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
      newTab.classList.add('animation-ready');
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
    newTab.classList.add('animation-ready');
    if (!gIsBackground)
      scrollToNewTab(newTab)
  }

  var opener = findTabById({ tab: aTab.openerTabId, window: aTab.windowId });
  if (opener) {
    log('opener: ', dumpTab(opener));
    attachTabTo(newTab, opener);
  }

  updateInsertionPositionInfo(newTab);

  gOpeningCount++;
  setTimeout(() => gOpeningCount--, 0);

  if (gIsBackground)
    reserveToSaveTreeStructure(newTab);
}

function onRemoved(aTabId, aRemoveInfo) {
  if (gTargetWindow && aRemoveInfo.windowId != gTargetWindow)
    return;

  var oldTab = findTabById({ tab: aTabId, window: aRemoveInfo.windowId });
  if (!oldTab)
    return;

  log('onRemoved: ', dumpTab(oldTab));

  var closeParentBehavior = getCloseParentBehaviorForTab(oldTab);
  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
      isSubtreeCollapsed(oldTab))
    closeChildTabs(tab);

//  var firstChild = getFirstChildTab(oldTab);

  detachAllChildren(oldTab, {
    behavior : closeParentBehavior
  });

  if (gIsBackground)
    reserveToSaveTreeStructure(oldTab);

  if (canAnimate()) {
    oldTab.addEventListener('transitionend', () => {
      onRemovedComplete(oldTab)
    }, { once: true });
    oldTab.classList.add('removing');
    oldTab.style.marginBottom = `-${oldTab.getBoundingClientRect().height}px`;
  }
  else {
    oldTab.classList.add('removing');
    onRemovedComplete(oldTab);
  }
}
function onRemovedComplete(aTab) {
  var container = getTabsContainer(aTab);
  container.removeChild(aTab);
  if (!container.hasChildNodes())
    container.parentNode.removeChild(container);
}

var kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD        = 3;
var kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN       = 0;
var kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN        = 1;
var kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN = 4;
var kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN         = 2; // onTabRemoved only
var kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB     = 5;
function getCloseParentBehaviorForTab(aTab) {
  return kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;
}

function onMoved(aTabId, aMoveInfo) {
  if (gTargetWindow && aMoveInfo.windowId != gTargetWindow)
    return;

  log('onMoved: ', aTabId, aMoveInfo);
  var movedTab = findTabById({ tab: aTabId, window: aMoveInfo.windowId });
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

  var newTab = findTabById({ tab: aTabId, window: aAttachInfo.newWindowId });
}

function onDetached(aTabId, aDetachInfo) {
  if (gTargetWindow &&
      aAttachInfo.oldWindowId != gTargetWindow)
    return;

  var oldTab = findTabById({ tab: aTabId, window: aDetachInfo.oldWindowId });
  if (oldTab)
    getTabsContainer(oldTab).removeChild(oldTab);
}

