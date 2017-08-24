/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

function onTabOpened(aEvent) {
  reserveToSaveTreeStructure(aEvent.target);
}

function onTabClosed(aEvent) {
  reserveToSaveTreeStructure(aEvent.target);
}

function onTabMoved(aEvent) {
  reserveToSaveTreeStructure(aEvent.target);
}

function onTabFocusing(aEvent) {
  var tab = aEvent.target;
  if (isCollapsed(tab)) {
    if (configs.autoExpandSubtreeOnCollapsedChildFocused) {
      for (let ancestor of getAncestorTabs(tab)) {
        collapseExpandSubtree(ancestor, { collapsed: false });
      }
      handleNewActiveTab(tab);
    }
    else {
      selectTabInternally(getRootTab(tab));
      aEvent.preventDefault();
    }
  }
  else if (/**
            * Focus movings by closing of the old current tab should be handled
            * only when it is activated by user preference expressly.
            */
           tab.parentNode.focusChangedByCurrentTabRemove &&
           !configs.autoCollapseExpandSubtreeOnSelectOnCurrentTabRemove) {
    aEvent.preventDefault();
  }
  else if (hasChildTabs(tab) && isSubtreeCollapsed(tab)) {
    handleNewActiveTab(tab);
  }
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

function onTabFocused(aEvent) {
  var tab = aEvent.detail.previouslyFocusedTab;
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

function onTabUpdated(aEvent) {
  reserveToSaveTreeStructure(aEvent.target);
}

