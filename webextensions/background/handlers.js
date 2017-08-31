/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// raw event handlers

async function onTabOpening(aTab, aInfo = {}) {
  log('onTabOpening ', dumpTab(aTab), aInfo);
  var container = aTab.parentNode;
  if (container.openedNewTabsTimeout)
    clearTimeout(container.openedNewTabsTimeout);

  // ignore tabs opened from others
  if (configs.autoGroupNewTabs &&
      !aTab.apiTab.openerTabId &&
      !aInfo.maybeOrphan) {
    container.openedNewTabs.push(aTab.id);
    container.openedNewTabsTimeout = setTimeout(
      onNewTabsTimeout,
      configs.autoGroupNewTabsTimeout,
      container
    );
  }

  var opener = await getTabById({ tab: aTab.apiTab.openerTabId, window: aTab.apiTab.windowId });
  if (opener &&
      configs.autoAttach) {
    log('opener: ', dumpTab(opener), aInfo.maybeOpenedWithPosition);
    switch (configs.autoAttachOnOpenedWithOwner) {
      case kNEWTAB_OPEN_AS_ORPHAN:
      default:
        break;

      case kNEWTAB_OPEN_AS_CHILD:
        await attachTabTo(aTab, opener, {
          dontMove: aInfo.maybeOpenedWithPosition,
          broadcast: true
        });
        break;

      case kNEWTAB_OPEN_AS_SIBLING: {
        let parent = getParentTab(opener);
        if (parent) {
          await attachTabTo(aTab, parent, {
            broadcast: true
          });
        }
      }; break;

      case kNEWTAB_OPEN_AS_NEXT_SIBLING: {
        let parent = getParentTab(opener);
        if (parent) {
          await attachTabTo(aTab, parent, {
            insertAfter: opener,
            broadcast: true
          });
        }
        else {
          moveTab(aTab, {
            insertBefore: opener
          });
        }
      }; break;
    }
  }
}

async function onNewTabsTimeout(aContainer) {
  var newRootTabs = collectRootTabs(await Promise.all(aContainer.openedNewTabs.map(getTabById)));
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

function onTabOpened(aTab, aInfo = {}) {
  log('onTabOpened ', dumpTab(aTab), aInfo);
  // if the tab is opened inside existing tree by someone, we must fixup the tree.
  if (!aInfo.openedWithPosition &&
      aTab.nextSibling)
    tryFixupTreeForInsertedTab(aTab, {
      toIndex:   aTab.apiTab.index,
      fromIndex: getTabIndex(aTab.nextSibling)
    });

  reserveToSaveTreeStructure(aTab);
}

function onTabClosed(aTab) {
  //var backupAttributes = collectBackupAttributes(aTab);
  //log('onTabClose: backupAttributes = ', backupAttributes);

  var closeParentBehavior = getCloseParentBehaviorForTab(aTab);
  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    closeChildTabs(aTab);

  detachAllChildren(aTab, {
    behavior: closeParentBehavior,
    broadcast: true
  });
  //reserveCloseRelatedTabs(toBeClosedTabs);
  detachTab(aTab, {
    dontUpdateIndent: true,
    broadcast: true
  });
  //restoreTabAttributes(oldTab, backupAttributes);

  reserveToSaveTreeStructure(aTab);
}

function closeChildTabs(aParent) {
  var tabs = getDescendantTabs(aParent);
  //if (!fireTabSubtreeClosingEvent(aParent, tabs))
  //  return;

  //markAsClosedSet([aParent].concat(tabs));
  tabs.reverse().forEach(aTab => {
    browser.tabs.remove(aTab.apiTab.id)
      .catch(handleMissingTabError);
  });
  //fireTabSubtreeClosedEvent(aParent, tabs);
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
      container.internalMovingCount == 0)
    tryFixupTreeForInsertedTab(aTab, aMoveInfo);
}

async function tryFixupTreeForInsertedTab(aTab, aMoveInfo) {
  log('the tab can be placed inside existing tab unexpectedly, so now we are trying to fixup tree.');
  var action = await detectTabActionFromNewPosition(aTab, aMoveInfo);
  if (!action) {
    log('no action');
    return;
  }

  log('action: ', action);
  switch (action.action) {
    case 'moveBack':
      moveBack(aTab, aMoveInfo);
      return;

    case 'attach': {
      await attachTabTo(aTab, await getTabById(action.parent), {
        insertBefore: await getTabById(action.insertBefore),
        insertAfter:  await getTabById(action.insertAfter),
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

async function moveBack(aTab, aMoveInfo) {
  log('Move back tab from unexpected move: ', dumpTab(aTab), aMoveInfo);
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

  var prevLevel  = prevTab ? Number(prevTab.getAttribute(kLEVEL)) : -1 ;
  var nextLevel  = nextTab ? Number(nextTab.getAttribute(kLEVEL)) : -1 ;
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

function onTabFocusing(aTab, aInfo = {}) {
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
           aInfo.byCurrentTabRemove &&
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
    if (!aTab.parentNode) // it was removed while waiting
      return;
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

function onTabDetachedFromWindow(aTab) {
  var closeParentBehavior = getCloseParentBehaviorForTab(aTab);
  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    closeParentBehavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  detachAllChildren(aTab, {
    behavior: closeParentBehavior,
    broadcast: true
  });
  //reserveCloseRelatedTabs(toBeClosedTabs);
  detachTab(aTab, {
    dontUpdateIndent: true,
    broadcast: true
  });
  //restoreTabAttributes(aTab, backupAttributes);
}

function onTabPinned(aTab) {
  collapseExpandSubtree(aTab, {
    collapsed: false,
    broadcast: true
  });
  detachAllChildren(aTab, {
    behavior: getCloseParentBehaviorForTab(
      aTab,
      kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    ),
    broadcast: true
  });
  detachTab(aTab, {
    broadcast: true
  });
  collapseExpandTab(aTab, { collapsed: false });
}


/* message observer */

async function onMessage(aMessage, aSender) {
  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_GET_OR_GENERATE_UNIQUE_ID: {
      log(kCOMMAND_GET_OR_GENERATE_UNIQUE_ID, aMessage);
      let id = await getOrGenerateTabId({ id: aMessage.tabId,
                                          windowId: aMessage.windowId });
      return { id: id };
    }; break;

    case kCOMMAND_PULL_TREE_STRUCTURE: {
      log(`tree structure is requested from ${aMessage.windowId}`);
      let structure = getTreeStructureFromTabs(getAllTabs(aMessage.windowId));
      // By some reason the requestor can receive "undefined" as the response...
      // For safely we resend the information as a "PUSH" message.
      browser.runtime.sendMessage({
        type:      kCOMMAND_PUSH_TREE_STRUCTURE,
        windowId:  aMessage.windowId,
        structure: structure
      });
      return { structure: structure };
    }; break;

    case kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE: {
      let tab = await getTabById(aMessage.tab);
      if (!tab)
        return;
      let params = {
        collapsed: aMessage.collapsed,
        justNow:   aMessage.justNow,
        broadcast: true
      };
      if (aMessage.manualOperation)
        manualCollapseExpandSubtree(tab, params);
      else
        collapseExpandSubtree(tab, params);
      reserveToSaveTreeStructure(tab);
    }; break;

    case kCOMMAND_NEW_TABS: {
      log('new tabs requested: ', aMessage);
      await openURIsInTabs(aMessage.uris, clone(aMessage, {
        parent:       await getTabById(aMessage.parent),
        insertBefore: await getTabById(aMessage.insertBefore),
        insertAfter:  await getTabById(aMessage.insertAfter)
      }));
    }; break;

    case kCOMMAND_NEW_WINDOW_FROM_TABS: {
      log('new window requested: ', aMessage);
      let movedTabs = await openNewWindowFromTabs(
                              await Promise.all(aMessage.tabs.map(getTabById)),
                              aMessage
                            );
      return { movedTabs: movedTabs.map(aTab => aTab.id) };
    }; break;

    case kCOMMAND_MOVE_TABS: {
      log('move tabs requested: ', aMessage);
      let movedTabs = await moveTabs(
                              await Promise.all(aMessage.tabs.map(getTabById)),
                              aMessage
                            );
      return { movedTabs: movedTabs.map(aTab => aTab.id) };
    }; break;

    case kCOMMAND_REMOVE_TAB: {
      let tab = await getTabById(aMessage.tab);
      if (!tab)
        return;
      if (isActive(tab))
        await tryMoveFocusFromClosingCurrentTab(tab);
      browser.tabs.remove(tab.apiTab.id)
        .catch(handleMissingTabError);
    }; break;

    case kCOMMAND_SELECT_TAB: {
      let tab = await getTabById(aMessage.tab);
      if (!tab)
        return;
      browser.tabs.update(tab.apiTab.id, { active: true })
        .catch(handleMissingTabError);
    }; break;

    case kCOMMAND_SELECT_TAB_INTERNALLY: {
      let tab = await getTabById(aMessage.tab);
      if (!tab)
        return;
      selectTabInternally(tab);
    }; break;

    case kCOMMAND_SET_SUBTREE_MUTED: {
      log('set muted state: ', aMessage);
      let root = await getTabById(aMessage.tab);
      if (!root)
        return;
      let tabs = [root].concat(getDescendantTabs(root));
      for (let tab of tabs) {
        let playing = isSoundPlaying(tab);
        let muted = isMuted(tab);
        log(`tab ${tab.id}: playing=${playing}, muted=${muted}`);
        if (playing != aMessage.muted)
          continue;

        log(` => set muted=${aMessage.muted}`);

        browser.tabs.update(tab.apiTab.id, {
          muted: aMessage.muted
        }).catch(handleMissingTabError);

        let add = [];
        let remove = [];
        if (aMessage.muted) {
          add.push(kTAB_STATE_MUTED);
          tab.classList.add(kTAB_STATE_MUTED);
        }
        else {
          remove.push(kTAB_STATE_MUTED);
          tab.classList.remove(kTAB_STATE_MUTED);
        }

        if (isAudible(tab) && !aMessage.muted) {
          add.push(kTAB_STATE_SOUND_PLAYING);
          tab.classList.add(kTAB_STATE_SOUND_PLAYING);
        }
        else {
          remove.push(kTAB_STATE_SOUND_PLAYING);
          tab.classList.remove(kTAB_STATE_SOUND_PLAYING);
        }

        // tabs.onUpdated is too slow, so users will be confused
        // from still-not-updated tabs (in other words, they tabs
        // are unresponsive for quick-clicks).
        broadcastTabState(tab, {
          add, remove,
          bubbles: !hasChildTabs(tab)
        });
      }
    }; break;

    case kCOMMAND_MOVE_TABS_INTERNALLY_BEFORE: {
      await moveTabsInternallyBefore(
        await Promise.all(aMessage.tabs.map(getTabById)),
        await getTabById(aMessage.nextTab)
      );
   }; break;

    case kCOMMAND_MOVE_TABS_INTERNALLY_AFTER: {
      await moveTabsInternallyAfter(
        await Promise.all(aMessage.tabs.map(getTabById)),
        await getTabById(aMessage.previousTab)
      );
    }; break;

    case kCOMMAND_ATTACH_TAB_TO: {
      let child = await getTabById(aMessage.child);
      let parent = await getTabById(aMessage.parent);
      let insertBefore = await getTabById(aMessage.insertBefore);
      let insertAfter = await getTabById(aMessage.insertAfter);
      if (child && parent)
        await attachTabTo(child, parent, clone(aMessage, {
          insertBefore, insertAfter
        }));
    }; break;

    case kCOMMAND_DETACH_TAB: {
      let tab = await getTabById(aMessage.tab);
      if (tab)
        await detachTab(tab, aMessage);
    }; break;

    case kCOMMAND_PERFORM_TABS_DRAG_DROP: {
      log('perform tabs dragdrop requested: ', aMessage);
      await performTabsDragDrop(clone(aMessage, {
        attachTo:     await getTabById(aMessage.attachTo),
        insertBefore: await getTabById(aMessage.insertBefore),
        insertAfter:  await getTabById(aMessage.insertAfter)
      }));
    }; break;
  }
}
