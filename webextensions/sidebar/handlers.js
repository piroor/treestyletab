/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function omMouseDown(aEvent) {
  log('omMouseDown: ', aEvent);
  var tabItem = findTabItemFromEvent(aEvent);
  log('tabItem: ', tabItem);
  if (!tabItem)
    return;
  if (aEvent.button == 1 ||
      (aEvent.button == 0 && (aEvent.ctrlKey || aEvent.metaKey))) {
    log('middle-click to close');
    chrome.tabs.remove(tabItem.tab.id);
    return;
  }
  chrome.tabs.update(tabItem.tab.id, { active: true });
}

function onSelect(aActiveInfo) {
  var newItem = findTabItemFromId({ tab: aActiveInfo.tabId, window: aActiveInfo.windowId });
  if (!newItem)
    return;
  var oldItems = document.querySelectorAll('.active');
  for (let oldItem of oldItems) {
    oldItem.classList.remove('active');
  }
  newItem.classList.add('active');
}

function onUpdated(aTabId, aChangeInfo, aTab) {
  var updatedItem = findTabItemFromId({ tab: aTabId, window: aTab.windowId });
  if (!updatedItem)
    return;
  if (aTab.title != updatedItem.textContent)
    updatedItem.textContent = aTab.title;
  updatedItem.tab = aTab;
}

function onCreated(aTab) {
  log('created', aTab);
  var newItem = gTabs.appendChild(buildTabItem(aTab));

  var openerItem = findTabItemFromId({ tab: aTab.openerTabId, window: aTab.windowId });
  log('openerItem: ', openerItem);
  if (openerItem) {
    attachTabItemTo(openerItem, newItem);
  }
}

function onRemoved(aTabId, aRemoveInfo) {
  var oldItem = findTabItemFromId({ tab: aTabId, window: aRemoveInfo.windowId });
  if (!oldItem)
    return;

  var closeParentBehavior = getCloseParentBehaviorForTabItem(oldItem);
  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
      isSubtreeCollapsed(oldItem))
    closeChildTabItems(tab);

//  var firstChildItem = getFirstChildTabItem(oldItem);

  detachAllChildItems(oldItem, {
    behavior : closeParentBehavior
  });

  gTabs.removeChild(oldItem);
}

var kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD        = 3;
var kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN       = 0;
var kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN        = 1;
var kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN = 4;
var kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN         = 2; // onTabRemoved only
var kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB     = 5;
function getCloseParentBehaviorForTabItem(aTabItem) {
  return kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;
}

function onMoved(aTabId, aMoveInfo) {
  log('moved: ', aTabId, aMoveInfo);
  var movedItem = findTabItemFromId({ tab: aTabId, window: aMoveInfo.windowId });
  if (!movedItem)
    return;
  if (gInternalMovingCount > 0) {
    log('internal move');
    return;
  }
  var newNextIndex = aMoveInfo.toIndex;
  if (aMoveInfo.fromIndex < newNextIndex)
    newNextIndex++;
  var nextItem = gTabs.childNodes[newNextIndex];
  gTabs.insertBefore(movedItem, nextItem);
}

function onAttached(aTabId, aAttachInfo) {
  var newItem = findTabItemFromId({ tab: aTabId, window: aAttachInfo.newWindowId });
}

function onDetached(aTabId, aDetachInfo) {
  var oldItem = findTabItemFromId({ tab: aTabId, window: aDetachInfo.oldWindowId });
  if (oldItem)
    gTabs.removeChild(oldItem);
}

window.addEventListener('DOMContentLoaded', init, { once: true });

