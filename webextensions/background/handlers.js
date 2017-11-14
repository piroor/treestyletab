/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

function onToolbarButtonClick(aTab) {
  if (gSidebarOpenState.has(aTab.windowId)) {
    // "unload" event doesn't fire for sidebar closed by this method,
    // thus we need update the flag manually for now...
    gSidebarOpenState.delete(aTab.windowId);
    browser.sidebarAction.close();
  }
  else
    browser.sidebarAction.open();
}

// raw event handlers

// this should return true if the tab is moved while processing
function onTabOpening(aTab, aInfo = {}) {
  if (aInfo.duplicatedInternally)
    return false;

  log('onTabOpening ', dumpTab(aTab), aInfo);
  var container = aTab.parentNode;
  var opener    = getOpenerTab(aTab);
  if (configs.autoGroupNewTabs &&
      !opener &&
      !aInfo.maybeOrphan) {
    if (container.preventAutoGroupNewTabsUntil > Date.now())
      container.preventAutoGroupNewTabsUntil += configs.autoGroupNewTabsTimeout;
    else
      container.openedNewTabs.push(aTab.id);
  }
  if (container.openedNewTabsTimeout)
    clearTimeout(container.openedNewTabsTimeout);
  container.openedNewTabsTimeout = setTimeout(
    onNewTabsTimeout,
    configs.autoGroupNewTabsTimeout,
    container
  );

  if (!opener) {
    if (isNewTabCommandTab(aTab)) {
      let current = getCurrentTab(aTab);
      log('behave as a tab opened by new tab command, current = ', dumpTab(current));
      behaveAutoAttachedTab(aTab, {
        baseTab:   current,
        behavior:  configs.autoAttachOnNewTabCommand,
        broadcast: true
      });
      return true;
    }
    return false;
  }

  log('opener: ', dumpTab(opener), aInfo.maybeOpenedWithPosition);
  if (isPinned(opener)) {
    switch (configs.insertNewTabFromPinnedTabAt) {
      case kINSERT_FIRST:
        browser.tabs.move(aTab.apiTab.id, {
          index: getPinnedTabs(container).length
        }).catch(handleMissingTabError); // already removed tab;
        return true;
        break;
      case kINSERT_END:
        browser.tabs.move(aTab.apiTab.id, {
          index: getAllTabs(container).length - 1
        }).catch(handleMissingTabError); // already removed tab;
        return true;
        break;
    }
  }
  else if (configs.autoAttach) {
    behaveAutoAttachedTab(aTab, {
      baseTab:   opener,
      behavior:  configs.autoAttachOnOpenedWithOwner,
      dontMove:  aInfo.maybeOpenedWithPosition,
      broadcast: true
    });
    return true;
  }
  return false;
}

function onNewTabsTimeout(aContainer) {
  if (aContainer.openedNewTabs.length == 0)
    return;

  var tabIds = aContainer.openedNewTabs;
  aContainer.openedNewTabs = [];
  tryGroupTabs(tabIds);
}

async function tryGroupTabs(aTabIds) {
  log('tryGroupTabs: ', aTabIds);

  // extract only pure new tabs
  var uniqueIds = await Promise.all(aTabIds.map(aId => getTabById(aId).uniqueId));
  aTabIds = aTabIds.filter((aId, aIndex) => {
    var uniqueId = uniqueIds[aIndex];
    return !uniqueId.duplicated && !uniqueId.restored;
  });

  var newRootTabs = collectRootTabs(aTabIds.map(getTabById))
    .filter(aTab => !isGroupTab(aTab));
  if (newRootTabs.length <= 1)
    return;

  log(`tryGroupTabs: ${newRootTabs.length} root tabs are opened`);
  var title = browser.i18n.getMessage('groupTab.label', newRootTabs[0].apiTab.title);
  var uri = makeGroupTabURI(title, {
    temporary: true
  });
  var groupTab = await openURIInTab(uri, {
    windowId: newRootTabs[0].apiTab.windowId,
    insertBefore: newRootTabs[0]
  });
  for (let tab of newRootTabs) {
    await attachTabTo(tab, groupTab, {
      dontMove:  true,
      broadcast: true
    });
  }
}

function onTabOpened(aTab, aInfo = {}) {
  log('onTabOpened ', dumpTab(aTab), aInfo);
  if (aInfo.duplicated) {
    let original = aInfo.originalTab;
    log('duplicated ', dumpTab(aTab), dumpTab(original));
    if (aInfo.duplicatedInternally) {
      log('duplicated by internal operation');
      aTab.classList.add(kTAB_STATE_DUPLICATING);
      broadcastTabState(aTab, {
        add: [kTAB_STATE_DUPLICATING]
      });
    }
    else {
      behaveAutoAttachedTab(aTab, {
        baseTab:   original,
        behavior:  configs.autoAttachOnDuplicated,
        dontMove:  aInfo.openedWithPosition,
        broadcast: true
      });
    }
    // Duplicated tab has its own tree structure information inherited
    // from the original tab, but they must be cleared.
    reserveToUpdateAncestors(aTab);
    reserveToUpdateChildren(aTab);
    reserveToUpdateInsertionPosition([
      aTab,
      getNextTab(aTab),
      getPreviousTab(aTab)
    ]);
  }
  else {
    // if the tab is opened inside existing tree by someone, we must fixup the tree.
    if (!aInfo.openedWithPosition &&
        aTab.nextSibling)
      tryFixupTreeForInsertedTab(aTab, {
        toIndex:   aTab.apiTab.index,
        fromIndex: getTabIndex(aTab.nextSibling)
      });
  }

  reserveToSaveTreeStructure(aTab);
}

function onTabRestored(aTab) {
  log('onTabRestored ', dumpTab(aTab), aTab.apiTab);
  return attachTabFromRestoredInfo(aTab, {
    children: true
  });
}

async function onTabClosed(aTab, aCloseInfo = {}) {
  log('onTabClosed ', dumpTab(aTab), aTab.apiTab, aCloseInfo);
  tryMoveFocusFromClosingCurrentTab(aTab);

  var container = aTab.parentNode;

  var ancestors = getAncestorTabs(aTab);
  var closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aCloseInfo);
  var skipAnimation = (
    !gSidebarOpenState.has(aTab.apiTab.windowId) &&
    closeParentBehavior != kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
    isSubtreeCollapsed(aTab)
  );
  collapseExpandSubtree(aTab, {
    collapsed: false,
    justNow:   skipAnimation,
    broadcast: false // because the tab is going to be closed, broadcasted collapseExpandSubtree can be ignored.
  });

  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    await closeChildTabs(aTab);

  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB &&
      getChildTabs(aTab).length > 1) {
    log('trying to replace the closing tab with a new group tab');
    let firstChild = getFirstChildTab(aTab);
    let label = browser.i18n.getMessage('groupTab.label', firstChild.apiTab.title);
    let uri = makeGroupTabURI(label, {
      temporary: true
    });
    aTab.parentNode.toBeOpenedTabsWithPositions++;
    let groupTab = await openURIInTab(uri, {
      windowId:     aTab.apiTab.windowId,
      insertBefore: aTab // not firstChild, because the "aTab" is disappeared from tree.
    });
    log('group tab: ', dumpTab(groupTab));
    if (!groupTab) // the window is closed!
      return;
    await attachTabTo(groupTab, aTab, {
      insertBefore: firstChild,
      broadcast:    true
    });
    closeParentBehavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;
  }

  detachAllChildren(aTab, {
    behavior:  closeParentBehavior,
    broadcast: true
  });
  //reserveCloseRelatedTabs(toBeClosedTabs);
  detachTab(aTab, {
    dontUpdateIndent: true,
    broadcast:        true
  });

  setTimeout(() => {
    log('trying to clanup needless temporary group tabs from ', ancestors.map(dumpTab));
    var tabsToBeRemoved = [];
    for (let ancestor of ancestors) {
      if (!isTemporaryGroupTab(ancestor))
        break;
      if (getChildTabs(ancestor).length > 1)
        break;
      let lastChild = getFirstChildTab(ancestor);
      if (lastChild && !isTemporaryGroupTab(lastChild))
        break;
      tabsToBeRemoved.push(ancestor);
    }
    log('=> to be removed: ', tabsToBeRemoved.map(dumpTab));
    if (container)
      container.toBeClosedTabs += tabsToBeRemoved.length;
    for (let tab of tabsToBeRemoved) {
      browser.tabs.remove(tab.apiTab.id)
        .catch(handleMissingTabError);
    }
  }, 0);

  reserveToSaveTreeStructure(aTab);
}

async function closeChildTabs(aParent) {
  var tabs = getDescendantTabs(aParent);
  //if (!fireTabSubtreeClosingEvent(aParent, tabs))
  //  return;

  aParent.parentNode.toBeClosedTabs += tabs.length;

  //markAsClosedSet([aParent].concat(tabs));
  await Promise.all(tabs.reverse().map(aTab => {
    return browser.tabs.remove(aTab.apiTab.id)
      .catch(handleMissingTabError);
  }));
  //fireTabSubtreeClosedEvent(aParent, tabs);
}

function onTabMoving(aTab, aMoveInfo) {
  var container = getTabsContainer(aTab);
  var positionControlled = configs.insertNewChildAt != kINSERT_NO_CONTROL;
  if (container.openingCount > 0 &&
      !aMoveInfo.byInternalOperation &&
      positionControlled) {
    let opener = getOpenerTab(aTab);
    // if there is no valid opener, it can be a restored initial tab in a restored window
    // and can be just moved as a part of window restoration process.
    if (opener) {
      log('onTabMove for new child tab: move back '+aMoveInfo.toIndex+' => '+aMoveInfo.fromIndex);
      moveBack(aTab, aMoveInfo);
      return true;
    }
  }
}

function onTabElementMoved(aTab, aInfo = {}) {
  reserveToUpdateInsertionPosition([
    aTab,
    getPreviousTab(aTab),
    getNextTab(aTab),
    aInfo.oldPreviousTab,
    aInfo.oldNextTab
  ]);
}

async function onTabMoved(aTab, aMoveInfo) {
  reserveToSaveTreeStructure(aTab);
  reserveToUpdateInsertionPosition([
    aTab,
    aMoveInfo.oldPreviousTab,
    aMoveInfo.oldNextTab,
    getPreviousTab(aTab),
    getNextTab(aTab)
  ]);

  var container = getTabsContainer(aTab);
  if (aMoveInfo.byInternalOperation ||
      isDuplicating(aTab)) {
    log('internal move');
    return;
  }
  log('process moved tab');

  tryFixupTreeForInsertedTab(aTab, aMoveInfo);
}

async function tryFixupTreeForInsertedTab(aTab, aMoveInfo) {
  if (configs.parentTabBehaviorForChanges == kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE &&
      !gSidebarOpenState.has(aTab.apiTab.windowId)) {
    detachAllChildren(aTab, {
      behavior: getCloseParentBehaviorForTab(aTab, {
        keepChildren: true
      }),
      broadcast: true
    });
    detachTab(aTab, {
      broadcast: true
    });
  }

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
      await attachTabTo(aTab, getTabById(action.parent), {
        insertBefore: getTabById(action.insertBefore),
        insertAfter:  getTabById(action.insertAfter),
        broadcast:    true
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

function moveBack(aTab, aMoveInfo) {
  log('Move back tab from unexpected move: ', dumpTab(aTab), aMoveInfo);
  var container = aTab.parentNode;
  container.internalMovingCount++;
  return browser.tabs.move(aTab.apiTab.id, {
    windowId: aMoveInfo.windowId,
    index:    aMoveInfo.fromIndex
  }).catch(e => {
    if (container.internalMovingCount > 0)
      container.internalMovingCount--;
    handleMissingTabError(e);
  });
}

async function detectTabActionFromNewPosition(aTab, aMoveInfo) {
  log('detectTabActionFromNewPosition: ', dumpTab(aTab), aMoveInfo);
  var toIndex   = aMoveInfo.toIndex;
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
    if ([oldParent].concat(getAncestorTabs(oldParent)).indexOf(prevParent) > -1) {
      log(' => moving in related tree: keep it attached in existing tree');
      newParent = prevParent;
    }
    else {
      log(' => moving from other tree: keep it orphaned');
      newParent = null;
    }
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
    while (newParent && isSubtreeCollapsed(newParent)) {
      log('=> the tree is collapsed, up to parent tree')
      newParent = getParentTab(newParent)
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
          action:       'attach',
          parent:       newParent.id,
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

function onTabFocusing(aTab, aInfo = {}) { // return true if this focusing is overridden.
  log('onTabFocusing ', aTab.id, aInfo);
  if (isCollapsed(aTab)) {
    if (configs.autoExpandOnCollapsedChildFocused) {
      log('=> reaction for autoExpandOnCollapsedChildFocused');
      for (let ancestor of getAncestorTabs(aTab)) {
        collapseExpandSubtree(ancestor, {
          collapsed: false,
          broadcast: true
        });
      }
      handleNewActiveTab(aTab, aInfo);
    }
    else {
      log('=> reaction for focusing collapsed descendant');
      selectTabInternally(getRootTab(aTab));
      return true;
    }
  }
  else if (aInfo.byCurrentTabRemove &&
           /*
             Focus movings by closing of the old current tab should be handled
             only when it is activated by user preference expressly.
           */
           configs.autoCollapseExpandSubtreeOnSelectExceptCurrentTabRemove) {
    log('=> reaction for removing current tab');
    return true;
  }
  else if (hasChildTabs(aTab) && isSubtreeCollapsed(aTab)) {
    log('=> reaction for newly focused parent tab');
    handleNewActiveTab(aTab, aInfo);
  }
  return false;
}
function handleNewActiveTab(aTab, aInfo = {}) {
  if (aTab.parentNode.doingCollapseExpandCount != 0)
    return;

  log('handleNewActiveTab: ', dumpTab(aTab), aInfo);
  var shouldCollapseExpandNow = configs.autoCollapseExpandSubtreeOnSelect;
  var canCollapseTree         = shouldCollapseExpandNow;
  var canExpandTree           = shouldCollapseExpandNow && !aInfo.byInternalOperation;
  log('handleNewActiveTab[delayed]: ',
      dumpTab(aTab),
      {
        canCollapseTree, canExpandTree,
        byInternalOperation: aInfo.byInternalOperation
      });
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
}

function onTabUpdated(aTab) {
  var parent = getOpenerTab(aTab);
  if (parent && parent != getParentTab(aTab)) {
    attachTabTo(aTab, parent, {
      insertAt:    kINSERT_NEAREST,
      forceExpand: isActive(aTab),
      broadcast:   true
    });
  }
  reserveToSaveTreeStructure(aTab);
}

function onTabSubtreeCollapsedStateChanging(aTab) {
  reserveToUpdateSubtreeCollapsed(aTab);
  reserveToSaveTreeStructure(aTab);
}

function onTabCollapsedStateChanged(aTab, aInfo = {}) {
  if (aInfo.collapsed)
    aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
  else
    aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);
}

async function onTabAttached(aTab, aInfo = {}) {
  var parent = aInfo.parent;
  if (aTab.apiTab.openerTabId != parent.apiTab.id) {
    aTab.apiTab.openerTabId = parent.apiTab.id;
    aTab.apiTab.TSTUpdatedOpenerTabId = aTab.apiTab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(aTab.apiTab.id, { openerTabId: parent.apiTab.id })
      .catch(handleMissingTabError);
  }

  await Promise.all([
    isOpening(aTab) && aTab.opened,
    !aInfo.dontMove && (async () => {
      let nextTab = aInfo.insertBefore;
      let prevTab = aInfo.insertAfter;
      if (!nextTab && !prevTab) {
        let tabs = getTabs(aTab);
        nextTab = tabs[aInfo.newIndex];
        if (!nextTab)
          prevTab = tabs[aInfo.newIndex - 1];
      }
      log('move newly attached child: ', dumpTab(aTab), {
        next: dumpTab(nextTab),
        prev: dumpTab(prevTab)
      });
      if (nextTab)
        await moveTabSubtreeBefore(aTab, nextTab, clone(aInfo, {
          broadcast: true
        }));
      else
        await moveTabSubtreeAfter(aTab, prevTab, clone(aInfo, {
          broadcast: true
        }));
    })()
  ]);

  if (!aTab.parentNode || // not removed while waiting
      getParentTab(aTab) != aInfo.parent) // not detached while waiting
    return;

  browser.runtime.sendMessage({
    type:   kCOMMAND_TAB_ATTACHED_COMPLETELY,
    tab:    aTab.id,
    parent: parent.id,
    newlyAttached: aInfo.newlyAttached
  });

  if (aInfo.newlyAttached &&
      !gInitializing) {
    if (isSubtreeCollapsed(aInfo.parent) &&
        !aInfo.forceExpand)
      collapseExpandTabAndSubtree(aTab, {
        collapsed: true,
        justNow:   true,
        broadcast: true
      });

    let isNewTreeCreatedManually = !aInfo.justNow && getChildTabs(parent).length == 1;
    if (aInfo.forceExpand) {
      collapseExpandSubtree(parent, clone(aInfo, {
        collapsed: false,
        inRemote:  false
      }));
    }
    if (!aInfo.dontExpand) {
      if (configs.autoCollapseExpandSubtreeOnAttach &&
          (isNewTreeCreatedManually || shouldTabAutoExpanded(parent)))
        collapseExpandTreesIntelligentlyFor(parent, {
          broadcast: true
        });

      let newAncestors = [parent].concat(getAncestorTabs(parent));
      if (configs.autoCollapseExpandSubtreeOnSelect) {
        newAncestors.forEach(aAncestor => {
          if (isNewTreeCreatedManually || shouldTabAutoExpanded(aAncestor))
            collapseExpandSubtree(aAncestor, clone(aInfo, {
              collapsed: false,
              broadcast: true
            }));
        });
      }
      else if (isNewTreeCreatedManually || shouldTabAutoExpanded(parent)) {
        if (configs.autoExpandOnAttached) {
          newAncestors.forEach(aAncestor => {
            if (isNewTreeCreatedManually || shouldTabAutoExpanded(aAncestor))
              collapseExpandSubtree(aAncestor, clone(aInfo, {
                collapsed: false,
                broadcast: true
              }));
          });
        }
        else
          collapseExpandTabAndSubtree(aTab, clone(aInfo, {
            collapsed: true,
            broadcast: true
          }));
      }
      if (isCollapsed(parent))
        collapseExpandTabAndSubtree(aTab, clone(aInfo, {
          collapsed: true,
          broadcast: true
        }));
    }
    else if (shouldTabAutoExpanded(parent) ||
             isCollapsed(parent)) {
      collapseExpandTabAndSubtree(aTab, clone(aInfo, {
        collapsed: true,
        broadcast: true
      }));
    }
  }

  reserveToSaveTreeStructure(aTab);
  if (aInfo.newlyAttached)
    reserveToUpdateAncestors([aTab].concat(getDescendantTabs(aTab)));
  reserveToUpdateChildren(parent);
  reserveToUpdateInsertionPosition([
    aTab,
    getNextTab(aTab),
    getPreviousTab(aTab)
  ]);
}

function onTabDetached(aTab, aDetachInfo) {
  if (aTab.apiTab.openerTabId) {
    aTab.apiTab.openerTabId = aTab.apiTab.id;
    aTab.apiTab.TSTUpdatedOpenerTabId = aTab.apiTab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(aTab.apiTab.id, { openerTabId: aTab.apiTab.id }) // set self id instead of null, because it requires any valid tab id...
      .catch(handleMissingTabError);
  }
  if (isGroupTab(aDetachInfo.oldParentTab))
    reserveToRemoveNeedlessGroupTab(aDetachInfo.oldParentTab);
  reserveToSaveTreeStructure(aTab);
  reserveToUpdateAncestors([aTab].concat(getDescendantTabs(aTab)));
  reserveToUpdateChildren(aDetachInfo.oldParentTab);
}

async function onTabAttachedToWindow(aTab, aInfo = {}) {
  if (!aInfo.windowId ||
      !shouldApplyTreeBehavior(aInfo))
    return;

  log('onTabAttachedToWindow ', dumpTab(aTab), aInfo);

  log('descendants of attached tab: ', aInfo.descendants.map(dumpTab));
  let movedTabs = await moveTabs(aInfo.descendants, {
    destinationWindowId: aTab.apiTab.windowId,
    insertAfter:         aTab
  });
  log('moved descendants: ', movedTabs.map(dumpTab));
  for (let movedTab of movedTabs) {
    if (getParentTab(movedTab))
      continue;
    attachTabTo(movedTab, aTab, {
      broadcast: true,
      dontMove:  true
    });
  }
}

function onTabDetachedFromWindow(aTab, aInfo = {}) {
  if (shouldApplyTreeBehavior(aInfo)) {
    tryMoveFocusFromClosingCurrentTabNow(aTab, {
      ignoredTabs: getDescendantTabs(aTab)
    });
    return;
  }

  tryMoveFocusFromClosingCurrentTab(aTab);

  log('onTabDetachedFromWindow ', dumpTab(aTab));
  var closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aInfo);
  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    closeParentBehavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

  detachAllChildren(aTab, {
    behavior: closeParentBehavior,
    broadcast: true
  });
  //reserveCloseRelatedTabs(toBeClosedTabs);
  detachTab(aTab, {
    dontUpdateIndent: true,
    broadcast:        true
  });
  //restoreTabAttributes(aTab, backupAttributes);
}

function onTabPinned(aTab) {
  collapseExpandSubtree(aTab, {
    collapsed: false,
    broadcast: true
  });
  detachAllChildren(aTab, {
    behavior: getCloseParentBehaviorForTabWithSidebarOpenState(aTab, {
      keepChildren: true
    }),
    broadcast: true
  });
  detachTab(aTab, {
    broadcast: true
  });
  collapseExpandTabAndSubtree(aTab, { collapsed: false });
}


/* message observer */

function onMessage(aMessage, aSender) {
  if (Array.isArray(aMessage))
    return Promise.all(aMessage.map(aOneMessage => onMessage(aOneMessage, aSender)));

  if (!aMessage ||
      typeof aMessage.type != 'string' ||
      aMessage.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_PING_TO_BACKGROUND:
      startWatchSidebarOpenState();
      return Promise.resolve(true);

    case kNOTIFY_SIDEBAR_OPENED:
      gSidebarOpenState.set(aMessage.windowId, true);
      break;

    case kNOTIFY_SIDEBAR_CLOSED:
      gSidebarOpenState.delete(aMessage.windowId);
      break;

    case kCOMMAND_REQUEST_UNIQUE_ID:
      return (async () => {
        let tab = getTabById(aMessage.id);
        if (tab && !aMessage.forceNew)
          return tab.uniqueId;
        let id = await requestUniqueId(aMessage.id, {
          forceNew: aMessage.forceNew
        });
        return id;
      })();

    case kCOMMAND_REQUEST_REGISTERED_ADDONS:
      return Promise.resolve(gExternalListenerAddons);

    case kCOMMAND_REQUEST_SCROLL_LOCK_STATE:
      return Promise.resolve(gScrollLockedBy);

    // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1398272
    case kCOMMAND_PULL_TAB_ID_TABLES:
      return Promise.resolve({
        wrongToCorrect: gTabIdWrongToCorrect,
        correctToWrong: gTabIdCorrectToWrong
      });

    case kCOMMAND_PULL_TREE_STRUCTURE:
      return (async () => {
        while (gInitializing) {
          await wait(10);
        }
        let structure = getTreeStructureFromTabs(getAllTabs(aMessage.windowId));
        return { structure: structure };
      })();

    case kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE: {
      let tab = getTabById(aMessage.tab);
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

    case kCOMMAND_LOAD_URI: {
      // not implemented yet.
    }; break;

    case kCOMMAND_NEW_TABS:
      return (async () => {
        log('new tabs requested: ', aMessage);
        return await openURIsInTabs(aMessage.uris, clone(aMessage, {
          parent:       getTabById(aMessage.parent),
          insertBefore: getTabById(aMessage.insertBefore),
          insertAfter:  getTabById(aMessage.insertAfter)
        }));
      })();

    case kCOMMAND_NEW_WINDOW_FROM_TABS:
      return (async () => {
        log('new window requested: ', aMessage);
        let movedTabs = await openNewWindowFromTabs(
          aMessage.tabs.map(getTabById),
          aMessage
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case kCOMMAND_MOVE_TABS:
      return (async () => {
        log('move tabs requested: ', aMessage);
        let movedTabs = await moveTabs(
          aMessage.tabs.map(getTabById),
          clone(aMessage, {
            insertBefore: getTabById(aMessage.insertBefore),
            insertAfter:  getTabById(aMessage.insertAfter)
          })
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case kCOMMAND_REMOVE_TAB:
      return (async () => {
        let tab = getTabById(aMessage.tab);
        if (!tab)
          return;
        tab.parentNode.toBeClosedTabs++;
        browser.tabs.remove(tab.apiTab.id)
          .catch(handleMissingTabError);
      })();

    case kNOTIFY_TAB_MOUSEDOWN:
      return (async () => {
        let tab = getTabById(aMessage.tab);
        if (!tab)
          return;

        let results = await sendTSTAPIMessage(clone(aMessage, {
          type:   kTSTAPI_NOTIFY_TAB_CLICKED,
          tab:    serializeTabForTSTAPI(tab),
          window: tab.apiTab.windowId
        }));
        if (results.some(aResult => aResult.result)) // canceled
          return;

        // not canceled, then fallback to default "select tab"
        if (aMessage.button == 0)
          browser.tabs.update(tab.apiTab.id, { active: true })
            .catch(handleMissingTabError);
      })();

    case kCOMMAND_SELECT_TAB: {
      let tab = getTabById(aMessage.tab);
      if (!tab)
        return;
      browser.tabs.update(tab.apiTab.id, { active: true })
        .catch(handleMissingTabError);
    }; break;

    case kCOMMAND_SELECT_TAB_INTERNALLY: {
      let tab = getTabById(aMessage.tab);
      if (!tab)
        return;
      selectTabInternally(tab);
    }; break;

    case kCOMMAND_SET_SUBTREE_MUTED: {
      log('set muted state: ', aMessage);
      let root = getTabById(aMessage.tab);
      if (!root)
        return;
      let tabs = [root].concat(getDescendantTabs(root));
      for (let tab of tabs) {
        let playing = isSoundPlaying(tab);
        let muted   = isMuted(tab);
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

    case kCOMMAND_MOVE_TABS_BEFORE:
      return moveTabsBefore(
        aMessage.tabs.map(getTabById),
        getTabById(aMessage.nextTab),
        clone(aMessage, {
          broadcast: !!aMessage.broadcasted
        })
      ).then(aTabs => aTabs.map(aTab => aTab.id));

    case kCOMMAND_MOVE_TABS_AFTER:
      return moveTabsAfter(
        aMessage.tabs.map(getTabById),
        getTabById(aMessage.previousTab),
        clone(aMessage, {
          broadcast: !!aMessage.broadcasted
        })
      ).then(aTabs => aTabs.map(aTab => aTab.id));

    case kCOMMAND_ATTACH_TAB_TO:
      return (async () => {
        let child  = getTabById(aMessage.child);
        let parent = getTabById(aMessage.parent);
        if (child && parent)
          await attachTabTo(child, parent, clone(aMessage, {
            insertBefore: getTabById(aMessage.insertBefore),
            insertAfter:  getTabById(aMessage.insertAfter)
          }));
      })();

    case kCOMMAND_DETACH_TAB:
      return (async () => {
        let tab = getTabById(aMessage.tab);
        if (tab)
          await detachTab(tab);
      })();

    case kCOMMAND_PERFORM_TABS_DRAG_DROP:
      log('perform tabs dragdrop requested: ', aMessage);
      return performTabsDragDrop(clone(aMessage, {
        attachTo:     getTabById(aMessage.attachTo),
        insertBefore: getTabById(aMessage.insertBefore),
        insertAfter:  getTabById(aMessage.insertAfter)
      }));
  }
}

function onMessageExternal(aMessage, aSender) {
  //log('onMessageExternal: ', aMessage, aSender);
  switch (aMessage.type) {
    case kTSTAPI_REGISTER_SELF:
      return (async () => {
        gExternalListenerAddons[aSender.id] = aMessage;
        let index = configs.cachedExternalAddons.indexOf(aSender.id);
        if (index < 0)
          configs.cachedExternalAddons = configs.cachedExternalAddons.concat([aSender.id]);
        return true;
      })();

    case kTSTAPI_UNREGISTER_SELF:
      return (async () => {
        delete gExternalListenerAddons[aSender.id];
        delete gScrollLockedBy[aSender.id];
        configs.cachedExternalAddons = configs.cachedExternalAddons.filter(aId => aId != aSender.id);
        return true;
      })();

    case kTSTAPI_PING:
      return Promise.resolve(true);


    case kTSTAPI_GET_TREE:
      return (async () => {
        var tabs    = await TSTAPIGetTargetTabs(aMessage);
        var results = tabs.map(serializeTabForTSTAPI);
        return TSTAPIFormatResult(results, aMessage);
      })();

    case kTSTAPI_COLLAPSE_TREE:
      return (async () => {
        var tabs = await TSTAPIGetTargetTabs(aMessage);
        for (let tab of tabs) {
          collapseExpandSubtree(tab, {
            collapsed: true,
            broadcast: true
          });
        }
        return true;
      })();

    case kTSTAPI_EXPAND_TREE:
      return (async () => {
        var tabs = await TSTAPIGetTargetTabs(aMessage);
        for (let tab of tabs) {
          collapseExpandSubtree(tab, {
            collapsed: false,
            broadcast: true
          });
        }
        return true;
      })();

    case kTSTAPI_ATTACH:
      return (async () => {
        var child  = getTabById(aMessage.child);
        var parent = getTabById(aMessage.parent);
        if (!child ||
            !parent ||
            child.parentNode != parent.parentNode)
          return false;
        await attachTabTo(child, parent, {
          broadcast:    true,
          insertBefore: getTabById(aMessage.insertBefore),
          insertAfter:  getTabById(aMessage.insertAfter)
        });
        return true;
      })();

    case kTSTAPI_DETACH:
      return (async () => {
        var tab = getTabById(aMessage.tab);
        if (!tab)
          return false;
        await detachTab(tab, {
          broadcast: true
        });
        return true;
      })();

    case kTSTAPI_ADD_TAB_STATE:
      return (async () => {
        var tabs   = await TSTAPIGetTargetTabs(aMessage);
        var states = aMessage.state || aMessage.states;
        if (!Array.isArray(states))
          states = [states];
        for (let tab of tabs) {
          for (let state of states) {
            tab.classList.add(state);
          }
        }
        broadcastTabState(tabs, {
          add: states
        });
        return true;
      })();

    case kTSTAPI_REMOVE_TAB_STATE:
      return (async () => {
        var tabs   = await TSTAPIGetTargetTabs(aMessage);
        var states = aMessage.state || aMessage.states;
        if (!Array.isArray(states))
          states = [states];
        for (let tab of tabs) {
          for (let state of states) {
            tab.classList.remove(state);
          }
        }
        broadcastTabState(tabs, {
          remove: states
        });
        return true;
      })();

    case kTSTAPI_SCROLL_LOCK:
      gScrollLockedBy[aSender.id] = true;
      return Promise.resolve(true);

    case kTSTAPI_SCROLL_UNLOCK:
      delete gScrollLockedBy[aSender.id];
      return Promise.resolve(true);
  }
}

async function TSTAPIGetTargetTabs(aMessage) {
  if (Array.isArray(aMessage.tabs))
    return TSTAPIGetTabsFromWrongIds(aMessage.tabs);
  if (aMessage.window || aMessage.windowId) {
    if (aMessage.tab == '*' ||
        aMessage.tabs == '*')
      return getTabs(aMessage.window || aMessage.windowId);
    else
      return getRootTabs(aMessage.window || aMessage.windowId);
  }
  if (aMessage.tab == '*' ||
      aMessage.tabs == '*') {
    let window = await browser.windows.getLastFocused({});
    return getTabs(window.id);
  }
  if (aMessage.tab)
    return TSTAPIGetTabsFromWrongIds([aMessage.tab]);
  return [];
}
function TSTAPIGetTabsFromWrongIds(aIds) {
  return aIds
    .map(aId => gTabIdWrongToCorrect[aId] || aId)
    .map(getTabById)
    .filter(aTab => !!aTab);
}

function TSTAPIFormatResult(aResults, aOriginalMessage) {
  if (Array.isArray(aOriginalMessage.tabs))
    return aResults;
  if (aOriginalMessage.tab == '*' ||
      aOriginalMessage.tabs == '*')
    return aResults;
  if (aOriginalMessage.tab)
    return aResults[0];
  return aResults;
}


// fake context menu
