/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var gAllTabs;
var gInternalMovingCount = 0;

function buildTab(aTab) {
  var item = document.createElement('li');
  item.apiTab = aTab;
  item.setAttribute('id', `tab-${aTab.windowId}-${aTab.id}`);
  item.setAttribute('data-child-ids', '|');
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
