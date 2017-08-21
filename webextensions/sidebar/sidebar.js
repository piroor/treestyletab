/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var gTabs;

function init() {
  window.addEventListener('unload', destroy, { once: true });
  gTabs = document.getElementById('tabs');
  gTabs.addEventListener('click', onClick);
  chrome.tabs.onActivated.addListener(onSelect);
  chrome.tabs.onCreated.addListener(onCreated);
  chrome.tabs.onRemoved.addListener(onRemoved);
  chrome.tabs.onMoved.addListener(onMoved);
  chrome.tabs.onAttached.addListener(onAttached);
  chrome.tabs.onDetached.addListener(onDetached);
  rebuildAll();
}

function destroy() {
  chrome.tabs.onActivated.removeListener(onSelect);
  gTabs.removeEventListener('click', onClick);
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


function onClick(aEvent) {
  log('onClick: ', aEvent);
  var tabItem = findTabItemFromEvent(aEvent);
  log('tabItem: ', tabItem);
  if (!tabItem)
    return;
  chrome.tabs.update(tabItem.tab.id, { active: true });
}

function onSelect(aActiveInfo) {
  var newItem = findTabItemFromId({ tab: aActiveInfo.id, window: aActiveInfo.windowId });
  if (!newItem)
    return;
  var oldItems = document.querySelectorAll('.active');
  for (let oldItem of oldItems) {
    oldItem.classList.remove('active');
  }
  newItem.classList.add('active');
}

function onCreated(aTab) {
  gTabs.appendChild(buildTabItem(aTab));
}

function onRemoved(aTabId, aRemoveInfo) {
  var oldItem = findTabItemFromId({ tab: aTabId, window: aRemoveInfo.windowId });
  if (oldItem)
    gTabs.removeChild(oldItem);
}

function onMoved(aTabId, aMoveInfo) {
  var movedItem = findTabItemFromId({ tab: aTabId, window: aMoveInfo.windowId });
  if (!movedItem)
    return;
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

