/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var gTabs;
var gInternalMovingCount = 0;

function buildTab(aTab) {
  let item = document.createElement('li');
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
