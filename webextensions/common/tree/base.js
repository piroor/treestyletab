/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var kCOMMAND_REQUEST_TREE_INFO = 'treestyletab:request-tree-info';

var kPARENT   = 'data-parent-id';
var kCHILDREN = 'data-child-ids';
var kNEST     = 'data-nest';

var gAllTabs;
var gInternalMovingCount = 0;
var gIsBackground = false;

function buildTab(aTab) {
  var item = document.createElement('li');
  item.apiTab = aTab;
  item.setAttribute('id', `tab-${aTab.windowId}-${aTab.id}`);
  item.setAttribute(kCHILDREN, '|');
  item.appendChild(document.createTextNode(aTab.title));
  item.setAttribute('title', aTab.title);
  item.classList.add('tab');
  if (aTab.active)
    item.classList.add('active');
  return item;
}

function buildTabsContainerFor(aWindowId) {
  var container = document.createElement('ul');
  container.setAttribute('id', `window-${aWindowId}`);
  container.classList.add('tabs');
  return container;
}

function clearAllTabsContainers() {
  var range = document.createRange();
  range.selectNodeContents(gAllTabs);
  range.deleteContents();
  range.detach();
}

function canAnimate() {
  return !gIsBackground && configs.animation;
}
