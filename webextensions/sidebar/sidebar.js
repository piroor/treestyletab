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
  rebuild();
}

function destroy() {
  chrome.tabs.onActivated.removeListener(onSelect);
  gTabs.removeEventListener('click', onClick);
  gTabs = undefined;
}

function rebuild() {
  chrome.tabs.query({ currentWindow: true }, (aTabs) => {
    clear();
    for (let tab of aTabs) {
      let item = document.createElement('li')
      item.tab = tab;
      item.setAttribute('id', `tab-${tab.windowId}-${tab.id}`);
      item.appendChild(document.createTextNode(tab.title));
      item.setAttribute('title', tab.title);
      if (tab.active)
        item.classList.add('active');
      gTabs.appendChild(item);
    }
  });
}

function clear() {
  var range = document.createRange();
  range.selectNodeContents(gTabs);
  range.deleteContents();
  range.detach();
}

function onClick(aEvent) {
  log('onClick: ', aEvent);
  var tabItem = findTabFromEvent(aEvent);
  log('tabItem: ', tabItem);
  if (!tabItem)
    return;
  chrome.tabs.update(tabItem.tab.id, { active: true });
}

function findTabFromEvent(aEvent) {
  var node = aEvent.target;
  while (node.nodeType != node.ELEMENT_NODE ||
         !node.tab) {
    if (!node.parentNode)
      return null;
    node = node.parentNode;
  }
  return node;
}

function onSelect(aActiveInfo) {
  var oldItem = document.querySelector('.active');
  var newItem = document.querySelector(`#tab-${aActiveInfo.windowId}-${aActiveInfo.tabId}`);
  if (oldItem && newItem)
    oldItem.classList.remove('active');
  if (newItem)
    newItem.classList.add('active');
}

window.addEventListener('DOMContentLoaded', init, { once: true });

