/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// raw event handlers

function onTabOpening(aTab) {
  var container = aTab.parentNode;
  if (container.openedNewTabsTimeout)
    clearTimeout(container.openedNewTabsTimeout);

  if (!configs.autoGroupNewTabs)
    return;

  container.openedNewTabs.push(aTab.id);
  container.openedNewTabsTimeout = setTimeout(
    onNewTabsTimeout,
    configs.autoGroupNewTabsTimeout,
    container
  );
}
async function onNewTabsTimeout(aContainer) {
  var newRootTabs = collectRootTabs(aContainer.openedNewTabs.map(getTabById));
  aContainer.openedNewTabs = [];
  if (newRootTabs.length <= 1)
    return;

  log(`onNewTabsTimeout: ${newRootTabs.length} root tabs are opened`);
  var title = browser.i18n.getMessage('groupTab.label', newRootTabs[0].apiTab.title);
  var uri = makeGroupTabURI(title);
  var groupTab = await openURIInTab(uri, {
    windowId: aContainer.windowId,
    insertBefore: newRootTabs[0],
    insertAfter: getPreviousTab(newRootTabs[0])
  });
  for (let tab of newRootTabs) {
    await attachTabTo(tab, groupTab, {
      dontMove: true,
      broadcast: true
    });
  }
}

function onTabOpened(aTab) {
  reserveToSaveTreeStructure(aTab);
}

function onTabClosed(aTab) {
  reserveToSaveTreeStructure(aTab);
}

function onTabMoving(aTab, aMoveInfo) {
  var container = getTabsContainer(aTab);
  var positionControlled = configs.insertNewChildAt != kINSERT_NO_CONTROL;
  if (container.openingCount > 0 &&
      container.internalMovingCount == 0 &&
      positionControlled) {
    log('onTabMove for new child tab: move back '+aMoveInfo.toIndex+' => '+aMoveInfo.fromIndex);
    moveBack(aTab, aMoveInfo);
    return true;
  }
}

async function onTabMoved(aTab, aMoveInfo) {
  var container = getTabsContainer(aTab);
  if (container.internalMovingCount > 0) {
    log('internal move');
    return;
  }
  log('process moved tab');

  //updateTabAsParent(aTab);

  reserveToSaveTreeStructure(aTab);

/*
  var tabsToBeUpdated = [aTab];

  var allTabs = getAllTabs(container);
  tabsToBeUpdated.push(allTabs[aMoveInfo.fromIndex]);
  if (aMoveInfo.fromIndex > aMoveInfo.toIndex) { // from bottom to top
    if (aMoveInfo.fromIndex < allTabs.length - 1)
      tabsToBeUpdated.push(allTabs[aMoveInfo.fromIndex + 1]);
  }
  else { // from top to bottom
    if (aMoveInfo.fromIndex > 0)
      tabsToBeUpdated.push(allTabs[aMoveInfo.fromIndex - 1]);
  }

  var parentTab = getParentTab(aTab);
  if (parentTab) {
    let children = getChildTabs(parentTab);
    let oldChildIndex = children.indexOf(aTab);
    if (oldChildIndex > -1) {
      if (oldChildIndex > 0) {
        let oldPrevTab = children[oldChildIndex - 1];
        tabsToBeUpdated.push(oldPrevTab);
      }
      if (oldChildIndex < children.lenght - 1) {
        let oldNextTab = children[oldChildIndex + 1];
        tabsToBeUpdated.push(oldNextTab);
      }
    }
    //if (container.subTreeChildrenMovingCount == 0)
    //  updateChildrenArray(parentTab);
  }
  log('tabsToBeUpdated: '+tabsToBeUpdated.map(dumpTab));

  var updatedTabs = new WeakMap();
  for (let tab of tabsToBeUpdated) {
    if (updatedTabs.has(tab))
      continue;
    updatedTabs.set(tab, true);
    //updateInsertionPositionInfo(tab);
  }
  updatedTabs = undefined;
*/

  log('status of move: ', {
    subTreeMovingCount: container.subTreeMovingCount,
    internalMovingCount: container.internalMovingCount
  });
  if (container.subTreeMovingCount > 0 ||
      container.internalMovingCount > 0 /*||
      // We don't have to fixup tree structure for a NEW TAB
      // which has already been structured.
      (newlyOpened && getParentTab(aTab))*/) {
    log('=> ignore internal move');
    return;
  }

  //var positionControlled = configs.insertNewChildAt != kINSERT_NO_CONTROL;
  if (/* !restored && */
      //!positionControlled &&
      container.internalMovingCount == 0) {
    log('the tab is moved unexpectedly, so now we are trying to fixup tree.');
    let action = await detectTabActionFromNewPosition(aTab, aMoveInfo);
    if (action) {
      log('action: ', action);
      switch (action.action) {
        case 'moveBack':
          moveBack(aTab, aMoveInfo);
          return;

        case 'attach': {
          attachTabTo(aTab, getTabById(action.parent), {
            insertBefore: getTabById(action.insertBefore),
            insertAfter:  getTabById(action.insertAfter),
            broadcast: true
          });
          followDescendantsToMovedRoot(aTab);
        }; break;

        case 'detach': {
          detachTab(aTab, { broadcast: true });
          followDescendantsToMovedRoot(aTab);
        }; break;

        default:
          followDescendantsToMovedRoot(aTab);
          break;
      }
    }
  }
}

async function moveBack(aTab, aMoveInfo) {
  var container = aTab.parentNode;
  container.internalMovingCount++;
  await browser.tabs.move(aTab.apiTab.id, {
    windowId: aMoveInfo.windowId,
    index: aMoveInfo.fromIndex
  });
  container.internalMovingCount--;
}

async function detectTabActionFromNewPosition(aTab, aMoveInfo) {
  log('attachTabFromPosition: ', dumpTab(aTab), aMoveInfo);
  var toIndex = aMoveInfo.toIndex;
  var fromIndex = aMoveInfo.fromIndex;
  var delta;
  if (toIndex == fromIndex) { // no move?
    log('=> no move');
    return { action: null };
  }
  else if (toIndex < 0 || fromIndex < 0) {
    delta = 2;
  }
  else {
    delta = Math.abs(toIndex - fromIndex);
  }

  var prevTab = getPreviousNormalTab(aTab);
  var nextTab = getNextNormalTab(aTab);

  log('prevTab: ', dumpTab(prevTab));
  log('nextTab: ', dumpTab(nextTab));

  var prevParent = getParentTab(prevTab);
  var nextParent = getParentTab(nextTab);

  var prevLevel  = prevTab ? Number(prevTab.getAttribute(kNEST)) : -1 ;
  var nextLevel  = nextTab ? Number(nextTab.getAttribute(kNEST)) : -1 ;
  log('prevLevel: '+prevLevel);
  log('nextLevel: '+nextLevel);

  var oldParent = getParentTab(aTab);
  var newParent;

  if (oldParent &&
      prevTab &&
      oldParent == prevTab) {
    log('=> no need to fix case');
    newParent = oldParent;
  }
  else if (!prevTab) {
    log('=> moved to topmost position');
    newParent = null;
  }
  else if (!nextTab) {
    log('=> moved to last position');
    newParent = prevParent;
  }
  else if (prevParent == nextParent) {
    log('=> moved into existing tree');
    newParent = prevParent;
  }
  else if (prevLevel > nextLevel) {
    log('=> moved to end of existing tree');
    if (!isActive(aTab)) {
      log('=> maybe newly opened tab');
      newParent = prevParent;
    }
    else {
      log('=> maybe drag and drop');
      let realDelta = Math.abs(toIndex - fromIndex);
      newParent = realDelta < 2 ? prevParent : (oldParent || nextParent) ;
    }
  }
  else if (prevLevel < nextLevel) {
    log('=> moved to first child position of existing tree');
    newParent = prevTab || oldParent || nextParent;
  }

  log('calculated parent: ', {
    old: dumpTab(oldParent),
    new: dumpTab(newParent)
  });

  if (newParent == aTab ||
      getAncestorTabs(newParent).indexOf(aTab) > -1) {
    log('=> invalid move: a parent is moved inside its own tree, thus move back!');
    return { action: 'moveBack' };
  }

  if (newParent != oldParent) {
    if (newParent) {
      if (isHidden(newParent) == isHidden(aTab)) {
        return {
          action: 'attach',
          parent: newParent.id,
          insertBefore: nextTab && nextTab.id,
          insertAfter:  prevTab && prevTab.id
        };
      }
    }
    else {
      return { action: 'detach' };
    }
  }
  return { action: 'move' };
}

function onTabFocusing(aTab) {
  if (isCollapsed(aTab)) {
    if (configs.autoExpandSubtreeOnCollapsedChildFocused) {
      for (let ancestor of getAncestorTabs(aTab)) {
        collapseExpandSubtree(ancestor, {
          collapsed: false,
          broadcast: true
        });
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
        collapseExpandTreesIntelligentlyFor(aTab, {
          broadcast: true
        });
      else
        collapseExpandSubtree(aTab, {
          collapsed: false,
          broadcast: true
        });
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
