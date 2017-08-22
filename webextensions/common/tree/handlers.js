/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

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
    let referenceTab = getFirstNormalTab() || getFirstTab();
    newTab.style.marginTop = `-${referenceTab.getBoundingClientRect().height}px`;
    window.requestAnimationFrame(() => {
      newTab.classList.add('animation-ready');
      window.requestAnimationFrame(() => {
        newTab.style.marginTop = 0;
      });
    });
  }
  else {
    newTab.classList.add('animation-ready');
  }

  var opener = findTabById({ tab: aTab.openerTabId, window: aTab.windowId });
  if (opener) {
    log('opener: ', dumpTab(opener));
    attachTabTo(newTab, opener);
  }
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
  if (gInternalMovingCount > 0) {
    log('internal move');
    return;
  }
  var newNextIndex = aMoveInfo.toIndex;
  if (aMoveInfo.fromIndex < newNextIndex)
    newNextIndex++;
  var nextTab = getTabs()[newNextIndex];
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

