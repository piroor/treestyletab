/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var gTabs;
var gInternalMovingCount = 0;

function init() {
  window.addEventListener('unload', destroy, { once: true });
  gTabs = document.getElementById('tabs');
  gTabs.addEventListener('mousedown', omMouseDown);
  chrome.tabs.onActivated.addListener(onSelect);
  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onCreated.addListener(onCreated);
  chrome.tabs.onRemoved.addListener(onRemoved);
  chrome.tabs.onMoved.addListener(onMoved);
  chrome.tabs.onAttached.addListener(onAttached);
  chrome.tabs.onDetached.addListener(onDetached);
  rebuildAll();
}

function destroy() {
  chrome.tabs.onActivated.removeListener(onSelect);
  chrome.tabs.onUpdated.removeListener(onUpdated);
  chrome.tabs.onCreated.removeListener(onCreated);
  chrome.tabs.onRemoved.removeListener(onRemoved);
  chrome.tabs.onMoved.removeListener(onMoved);
  chrome.tabs.onAttached.removeListener(onAttached);
  chrome.tabs.onDetached.removeListener(onDetached);
  gTabs.removeEventListener('mousedown', omMouseDown);
  gTabs = undefined;
}

function rebuildAll() {
  chrome.tabs.query({ currentWindow: true }, (aTabs) => {
    clear();
    for (let tab of aTabs) {
      gTabs.appendChild(buildTabItem(tab));
    }
  });
}

function buildTabItem(aTab) {
  let item = document.createElement('li');
  item.tab = aTab;
  item.setAttribute('id', `tab-${aTab.windowId}-${aTab.id}`);
  item.appendChild(document.createTextNode(aTab.title));
  item.setAttribute('title', aTab.title);
  if (aTab.active)
    item.classList.add('active');
  return item;
}

function clear() {
  var range = document.createRange();
  range.selectNodeContents(gTabs);
  range.deleteContents();
  range.detach();
}


function findTabItemFromEvent(aEvent) {
  var node = aEvent.target;
  while (node.nodeType != node.ELEMENT_NODE ||
         !node.tab) {
    if (!node.parentNode)
      return null;
    node = node.parentNode;
  }
  return node;
}

function findTabItemFromId(aInfo) {
  return document.querySelector(`#tab-${aInfo.window}-${aInfo.tab}`);
}


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
    setTimeout(() => {
      var parentIndex = Array.prototype.indexOf.call(gTabs.childNodes, openerItem);
      log('parentIndex: ', parentIndex);
      gInternalMovingCount++;
      chrome.tabs.move(aTab.id, { windowId: aTab.windowId, index: parentIndex + 1 });
      var nextItem = gTabs.childNodes[parentIndex + 1];
      if (nextItem != newItem)
        gTabs.insertBefore(newItem, nextItem);
      setTimeout(() => {
        gInternalMovingCount--;
      });
    });
  }
}

function onRemoved(aTabId, aRemoveInfo) {
  var oldItem = findTabItemFromId({ tab: aTabId, window: aRemoveInfo.windowId });
  if (oldItem)
    gTabs.removeChild(oldItem);
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

