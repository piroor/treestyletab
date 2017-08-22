/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var kCOMMAND_REQUEST_TREE_INFO = 'treestyletab:request-tree-info';
var kCOMMAND_APPLY_TREE_STRUCTURE = 'treestyletab:apply-tree-structure';

var kPARENT   = 'data-parent-id';
var kCHILDREN = 'data-child-ids';
var kANCESTORS = 'data-ancestor-ids';
var kNEST     = 'data-nest';
var kINSERT_BEFORE = 'data-insert-before-id';
var kINSERT_AFTER  = 'data-insert-after-id';
var kCLOSED_SET_ID = 'data-closed-set-id';

var kCOLLAPSED_DONE   = 'collapsed-completely';
var kCOLLAPSING_PHASE = 'data-collapsing-phase';
var kCOLLAPSING_PHASE_TO_BE_COLLAPSED = 'collapse';
var kCOLLAPSING_PHASE_TO_BE_EXPANDED  = 'expand';


var gAllTabs;
var gInternalMovingCount = 0;
var gIsBackground = false;
var gTargetWindow = null;
var gRestoringTree = false;
var gOpeningCount = 0;

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
  container.windowId = aWindowId;
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
