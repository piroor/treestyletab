/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// raw event handlers

function onTabOpened(aTab) {
  reserveToSaveTreeStructure(aTab);
}

function onTabClosed(aTab) {
  reserveToSaveTreeStructure(aTab);
}

function onTabMoved(aTab) {
  reserveToSaveTreeStructure(aTab);
}

function onTabFocusing(aTab) {
  if (isCollapsed(aTab)) {
    if (configs.autoExpandSubtreeOnCollapsedChildFocused) {
      for (let ancestor of getAncestorTabs(aTab)) {
        collapseExpandSubtree(ancestor, { collapsed: false });
      }
      handleNewActiveTab(aTab);
    }
    else {
      selectTabInternally(getRootTab(aTab));
      return true;
    }
  }
  else if (/**
            * Focus movings by closing of the old current tab should be handled
            * only when it is activated by user preference expressly.
            */
           aTab.parentNode.focusChangedByCurrentTabRemove &&
           !configs.autoCollapseExpandSubtreeOnSelectOnCurrentTabRemove) {
    return true;
  }
  else if (hasChildTabs(aTab) && isSubtreeCollapsed(aTab)) {
    handleNewActiveTab(aTab);
  }
  return false;
}
function handleNewActiveTab(aTab) {
  if (aTab.parentNode.doingCollapseExpandCount != 0)
    return;

  log('handleNewActiveTab: ', dumpTab(aTab));

  if (handleNewActiveTab.timer)
    clearTimeout(handleNewActiveTab.timer);

  /**
   * First, we wait until all event listeners for tabs.onSelect
   * were processed.
   */
  handleNewActiveTab.timer = setTimeout(() => {
    delete handleNewActiveTab.timer;
    var shouldCollapseExpandNow = configs.autoCollapseExpandSubtreeOnSelect;
    var canCollapseTree = shouldCollapseExpandNow;
    var canExpandTree   = shouldCollapseExpandNow && aTab.parentNode.internalFocusCount == 0;
    log('handleNewActiveTab[delayed]: ', dumpTab(aTab), {
      canCollapseTree, canExpandTree, internalFocusCount: aTab.parentNode.internalFocusCount });
    if (canExpandTree) {
      if (canCollapseTree &&
          configs.autoExpandIntelligently)
        collapseExpandTreesIntelligentlyFor(aTab);
      else
        collapseExpandSubtree(aTab, { collapsed: false });
    }
  }, 0);
}

function onTabFocused(aTab, aInfo = {}) {
  var tab = aInfo.previouslyFocusedTab;
  if (!tab)
    return;
  tab.classList.add(kTAB_STATE_POSSIBLE_CLOSING_CURRENT);
  setTimeout(() => {
    var possibleClosingCurrents = document.querySelectorAll(`.${kTAB_STATE_POSSIBLE_CLOSING_CURRENT}`);
    for (let tab of possibleClosingCurrents) {
      tab.classList.remove(kTAB_STATE_POSSIBLE_CLOSING_CURRENT);
    }
  }, 100);
}

function onTabUpdated(aTab) {
  reserveToSaveTreeStructure(aTab);
}

function onTabCollapsedStateChanging(aTab, aInfo = {}) {
  if (aInfo.collapsed)
    aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
  else
    aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);
}

function onTabAttached(aTab) {
  reserveToSaveTreeStructure(aTab);
}

function onTabDetached(aTab) {
  reserveToSaveTreeStructure(aTab);
}
