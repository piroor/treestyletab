/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

function onToolbarButtonClick(aTab) {
  if (Permissions.requestPostProcess())
    return;

  if (gSidebarOpenState.has(aTab.windowId)) {
    // "unload" event doesn't fire for sidebar closed by this method,
    // thus we need update the flag manually for now...
    gSidebarOpenState.delete(aTab.windowId);
    browser.sidebarAction.close();
  }
  else
    browser.sidebarAction.open();
}

async function onShortcutCommand(aCommand) {
  const activeTab = getTabById((await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0]);

  switch (aCommand) {
    case '_execute_browser_action':
      return;

    case 'reloadTree':
      Commands.reloadTree(activeTab);
      return;
    case 'reloadDescendants':
      Commands.reloadDescendants(activeTab);
      return;
    case 'closeTree':
      Commands.closeTree(activeTab);
      return;
    case 'closeDescendants':
      Commands.closeDescendants(activeTab);
      return;
    case 'closeOthers':
      Commands.closeOthers(activeTab);
      return;
    case 'collapseAll':
      Commands.collapseAll(activeTab);
      return;
    case 'expandAll':
      Commands.expandAll(activeTab);
      return;
    case 'bookmarkTree':
      Commands.bookmarkTree(activeTab);
      return;

    case 'newIndependentTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      kNEWTAB_OPEN_AS_ORPHAN
      });
      return;
    case 'newChildTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      kNEWTAB_OPEN_AS_CHILD
      });
      return;
    case 'newSiblingTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      kNEWTAB_OPEN_AS_SIBLING
      });
      return;
    case 'newNextSiblingTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      kNEWTAB_OPEN_AS_NEXT_SIBLING
      });
      return;

    case 'newContainerTab':
      Commands.showContainerSelector({ inRemote: true });
      return;

    case 'indent':
      Commands.indent(activeTab, { followChildren: true });
      return;
    case 'outdent':
      Commands.outdent(activeTab, { followChildren: true });
      return;

    case 'tabMoveUp':
      Commands.moveUp(activeTab, { followChildren: false });
      return;
    case 'treeMoveUp':
      Commands.moveUp(activeTab, { followChildren: true });
      return;
    case 'tabMoveDown':
      Commands.moveDown(activeTab, { followChildren: false });
      return;
    case 'treeMoveDown':
      Commands.moveDown(activeTab, { followChildren: true });
      return;

    case 'focusPrevious':
      selectTabInternally(getPreviousSiblingTab(activeTab), { silently: false });
      return;
    case 'focusPreviousSilently':
      selectTabInternally(getPreviousSiblingTab(activeTab), { silently: true });
      return;
    case 'focusNext':
      selectTabInternally(getNextSiblingTab(activeTab), { silently: false });
      return;
    case 'focusNextSilently':
      selectTabInternally(getNextSiblingTab(activeTab), { silently: true });
      return;

    case 'tabbarUp':
      browser.runtime.sendMessage({
        type:     kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'lineup'
      });
      return;
    case 'tabbarPageUp':
      browser.runtime.sendMessage({
        type:     kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'pageup'
      });
      return;
    case 'tabbarHome':
      browser.runtime.sendMessage({
        type:     kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        to:       'top'
      });
      return;

    case 'tabbarDown':
      browser.runtime.sendMessage({
        type:     kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'linedown'
      });
      return;
    case 'tabbarPageDown':
      browser.runtime.sendMessage({
        type:     kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'pagedown'
      });
      return;
    case 'tabbarEnd':
      browser.runtime.sendMessage({
        type:     kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        to:       'bottom'
      });
      return;
  }
}

// raw event handlers

// this should return true if the tab is moved while processing
function onTabOpening(aTab, aInfo = {}) {
  if (aInfo.duplicatedInternally)
    return false;

  log('onTabOpening ', dumpTab(aTab), aInfo);

  const opener = getOpenerTab(aTab);
  if (opener)
    opener.uniqueId.then(aUniqueId => {
      aTab.dataset.originalOpenerTabId = aUniqueId.id;
    });

  const container = aTab.parentNode;
  if ((configs.autoGroupNewTabsFromPinned &&
       isPinned(opener) &&
       opener.parentNode == container) ||
      (configs.autoGroupNewTabs &&
       !opener &&
       !aInfo.maybeOrphan)) {
    if (parseInt(container.dataset.preventAutoGroupNewTabsUntil) > Date.now()) {
      incrementContainerCounter(container, 'preventAutoGroupNewTabsUntil', configs.autoGroupNewTabsTimeout);
    }
    else {
      container.dataset.openedNewTabs += `|${aTab.id}`;
      container.dataset.openedNewTabsOpeners += `|${opener && opener.apiTab.id}`;
    }
  }
  if (container.openedNewTabsTimeout)
    clearTimeout(container.openedNewTabsTimeout);
  container.openedNewTabsTimeout = setTimeout(
    onNewTabsTimeout,
    configs.autoGroupNewTabsTimeout,
    container
  );

  if (!opener) {
    if (!aInfo.maybeOrphan && isNewTabCommandTab(aTab)) {
      let current = aInfo.activeTab || getCurrentTab(aTab);
      log('behave as a tab opened by new tab command, current = ', dumpTab(current));
      behaveAutoAttachedTab(aTab, {
        baseTab:   current,
        behavior:  configs.autoAttachOnNewTabCommand,
        broadcast: true
      }).then(async () => {
        let parent = getParentTab(aTab);
        if (!parent ||
            !configs.inheritContextualIdentityToNewChildTab ||
            aTab.apiTab.cookieStoreId != 'firefox-default' ||
            aTab.apiTab.cookieStoreId == parent.apiTab.cookieStoreId)
          return;
        let cookieStoreId = current.apiTab.cookieStoreId;
        log(' => reopen with inherited contextual identity ', cookieStoreId);
        await openNewTab({
          parent,
          insertBefore: aTab,
          cookieStoreId
        });
        removeTabInternally(aTab);
      });
      return true;
    }
    log('behave as a tab opened with any URL');
    return false;
  }

  log('opener: ', dumpTab(opener), aInfo.maybeOpenedWithPosition);
  if (isPinned(opener) &&
      opener.parentNode == aTab.parentNode) {
    if (configs.autoGroupNewTabsFromPinned) {
      return true;
    }
    if (configs.insertNewTabFromPinnedTabAt == kINSERT_END) {
      moveTabAfter(aTab, getLastTab(aTab), {
        delayedMove: true,
        broadcast:   true
      });
    }
  }
  else if (!aInfo.maybeOrphan && configs.autoAttach) {
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

var gGroupingBlockedBy = {};
var gToBeGroupedTabSets = [];

function onNewTabsTimeout(aContainer) {
  var tabIds        = aContainer.dataset.openedNewTabs.split('|');
  var tabOpenerIds  = aContainer.dataset.openedNewTabsOpeners.split('|');
  var tabReferences = tabIds.map((aId, aIndex) => {
    return {
      id:          aId,
      openerTabId: tabOpenerIds[aIndex]
    };
  });

  aContainer.dataset.openedNewTabs = '';
  aContainer.dataset.openedNewTabsOpeners = '';

  tabReferences = tabReferences.filter(aTabReference => aTabReference.id != '');
  if (tabReferences.length == 0 ||
      Object.keys(gGroupingBlockedBy).length > 0)
    return;

  gToBeGroupedTabSets.push(tabReferences);
  wait(0).then(tryGroupNewTabs);
}

async function tryGroupNewTabs() {
  if (tryGroupNewTabs.running)
    return;

  var tabReferences = gToBeGroupedTabSets.shift();
  if (!tabReferences)
    return;

  tryGroupNewTabs.running = true;
  try {
    // extract only pure new tabs
    var tabs = tabReferences.map(aTabReference => {
      var tab = getTabById(aTabReference.id);
      if (aTabReference.openerTabId)
        tab.apiTab.openerTabId = parseInt(aTabReference.openerTabId); // restore the opener information
      return tab;
    });
    var uniqueIds = await Promise.all(tabs.map(aTab => aTab.uniqueId));
    tabs = tabs.filter((aId, aIndex) => {
      var uniqueId = uniqueIds[aIndex];
      return !uniqueId.duplicated && !uniqueId.restored;
    });
    tabs.sort((aA, aB) => aA.apiTab.index - aB.apiTab.index);

    var newRootTabs = collectRootTabs(tabs)
      .filter(aTab => !isGroupTab(aTab));
    if (newRootTabs.length <= 0)
      return;

    var newRootTabsFromPinned = newRootTabs.filter(aTab => isPinned(getOpenerTab(aTab)));
    if (newRootTabsFromPinned.length > 0) {
      newRootTabs = newRootTabs.filter(aTab => newRootTabsFromPinned.indexOf(aTab) < 0);
      await tryGroupNewTabsFromPinnedOpener(newRootTabsFromPinned);
    }
    if (newRootTabs.length > 1 &&
        configs.autoGroupNewTabs)
      await groupTabs(newRootTabs, { broadcast: true });
  }
  catch(e) {
    log('Error on tryGroupNewTabs: ', String(e), e.stack);
  }
  finally {
    tryGroupNewTabs.running = false;
    if (gToBeGroupedTabSets.length > 0)
      tryGroupNewTabs();
  }
}

async function tryGroupNewTabsFromPinnedOpener(aRootTabs) {
  log(`tryGroupNewTabsFromPinnedOpener: ${aRootTabs.length} root tabs are opened from pinned tabs`);

  // First, collect pinned opener tabs.
  let pinnedOpeners = [];
  const childrenOfPinnedTabs = {};
  for (let tab of aRootTabs) {
    const opener = getOpenerTab(tab);
    if (pinnedOpeners.indexOf(opener) < 0)
      pinnedOpeners.push(opener);
  }
  log('pinnedOpeners ', pinnedOpeners.map(dumpTab));

  // Second, collect tabs opened from pinned openers including existing tabs
  // (which were left ungrouped in previous process).
  const openerOf = {};
  const unifiedRootTabs = getAllTabs(aRootTabs[0]).filter(aTab => {
    if (getParentTab(aTab) ||
        aTab.dataset.alreadyGroupedForPinnedOpener)
      return false;
    if (aRootTabs.indexOf(aTab) > -1) { // newly opened tab
      const opener = getOpenerTab(aTab);
      if (!opener)
        return false;
      openerOf[aTab.id] = opener;
      const tabs = childrenOfPinnedTabs[opener.id] || [];
      childrenOfPinnedTabs[opener.id] = tabs.concat([aTab]);
      return true;
    }
    const opener = getTabByUniqueId(aTab.dataset.originalOpenerTabId);
    if (!isPinned(opener))
      return false;
    // existing and not yet grouped tab
    if (pinnedOpeners.indexOf(opener) < 0)
      pinnedOpeners.push(opener);
    openerOf[aTab.id] = opener;
    const tabs = childrenOfPinnedTabs[opener.id] || [];
    childrenOfPinnedTabs[opener.id] = tabs.concat([aTab]);
    return true;
  });

  // Ignore pinned openeres which has no child tab to be grouped.
  pinnedOpeners = pinnedOpeners.filter(aOpener => {
    return childrenOfPinnedTabs[aOpener.id].length > 1 || getGroupTabForOpener(aOpener);
  });
  log(' => ', pinnedOpeners.map(dumpTab));

  // Move newly opened tabs to expected position before grouping!
  switch (configs.insertNewTabFromPinnedTabAt) {
    case kINSERT_FIRST:
      const allPinnedTabs = getPinnedTabs(aRootTabs[0].parentNode);
      const lastPinnedTab = allPinnedTabs[allPinnedTabs.length - 1];
      for (let tab of unifiedRootTabs.slice(0).reverse()) {
        if (pinnedOpeners.indexOf(openerOf[tab.id]) < 0 ||
            getGroupTabForOpener(openerOf[tab.id]))
          continue;
        // If there is not-yet grouped sibling, place next to it.
        const siblings = tab.parentNode.querySelectorAll(`${kSELECTOR_NORMAL_TAB}[data-original-opener-tab-id="${tab.dataset.originalOpenerTabId}"]:not([data-already-grouped-for-pinned-opener])`);
        const referenceTab = siblings.length > 0 ? siblings[siblings.length - 1] : lastPinnedTab ;
        await moveTabSubtreeAfter(tab, getLastDescendantTab(referenceTab) || referenceTab, {
          broadcast: true
        });
      }
      break;
    case kINSERT_END:
      for (let tab of unifiedRootTabs) {
        if (getGroupTabForOpener(openerOf[tab.id]))
          continue;
        await moveTabSubtreeAfter(tab, getLastTab(tab.parentNode), {
          broadcast: true
        });
      }
      break;
  }

  if (!configs.autoGroupNewTabsFromPinned)
    return false;

  // Finally, try to group opened tabs.
  const newGroupTabs = new Map();
  for (let opener of pinnedOpeners) {
    const children = childrenOfPinnedTabs[opener.id].sort((aA, aB) => aA.apiTab.index - aB.apiTab.index);
    log(`trying to group children of ${dumpTab(opener)}: `, children.map(dumpTab));
    let parent = getGroupTabForOpener(opener);
    if (!parent) {
      let uri = makeGroupTabURI({
        title:       browser.i18n.getMessage('groupTab_fromPinnedTab_label', opener.apiTab.title),
        temporary:   true,
        openerTabId: opener.getAttribute(kPERSISTENT_ID)
      });
      parent = await openURIInTab(uri, {
        windowId:     opener.apiTab.windowId,
        insertBefore: children[0],
        cookieStoreId: opener.apiTab.cookieStoreId,
        inBackground: true
      });
      newGroupTabs.set(opener, true);
    }
    for (let child of children) {
      // Prevent the tab to be grouped again after it is ungrouped manually.
      child.dataset.alreadyGroupedForPinnedOpener = true;
      await attachTabTo(child, parent, {
        forceExpand: true, // this is required to avoid the group tab itself is focused from active tab in collapsed tree
        insertAfter: getLastDescendantTab(parent),
        broadcast: true
      });
    }
  }
  return true;
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
  else if (!aInfo.restored && !aInfo.skipFixupTree) {
    // if the tab is opened inside existing tree by someone, we must fixup the tree.
    if (!aInfo.openedWithPosition &&
        (getNextNormalTab(aTab) ||
         getPreviousNormalTab(aTab) ||
         (aInfo.treeForActionDetection &&
          (aInfo.treeForActionDetection.target.next ||
           aInfo.treeForActionDetection.target.previous))))
      tryFixupTreeForInsertedTab(aTab, {
        toIndex:   aTab.apiTab.index,
        fromIndex: getTabIndex(getLastTab(aTab)),
        treeForActionDetection: aInfo.treeForActionDetection
      });
  }

  reserveToSaveTreeStructure(aTab);
  reserveToCacheTree(aTab);
}

function onTabRestored(aTab) {
  log('onTabRestored ', dumpTab(aTab), aTab.apiTab);
  reserveToAttachTabFromRestoredInfo(aTab, {
    children: true
  });
}

// Tree restoration for "Restore Previous Session"
async function onWindowRestoring(aWindowId) {
  if (!configs.useCachedTree)
    return;

  log('onWindowRestoring ', aWindowId);
  var container = getTabsContainer(aWindowId);
  var restoredCount = await container.allTabsRestored;
  if (restoredCount == 1) {
    log('onWindowRestoring: single tab restored');
    return;
  }

  log('onWindowRestoring: continue ', aWindowId);
  gMetricsData.add('onWindowRestoring restore start');

  const apiTabs = await browser.tabs.query({ windowId: aWindowId });
  try {
    await restoreWindowFromEffectiveWindowCache(aWindowId, {
      ignorePinnedTabs: true,
      owner: apiTabs[apiTabs.length - 1],
      tabs:  apiTabs
    });
    gMetricsData.add('onWindowRestoring restore end');
  }
  catch(e) {
    log('onWindowRestoring: FATAL ERROR while restoring tree from cache', String(e), e.stack);
  }
}

async function onTabClosed(aTab, aCloseInfo = {}) {
  log('onTabClosed ', dumpTab(aTab), aTab.apiTab, aCloseInfo);
  var container = aTab.parentNode;

  var ancestors = getAncestorTabs(aTab);
  var closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aCloseInfo);
  if (!gSidebarOpenState.has(aTab.apiTab.windowId) &&
      closeParentBehavior != kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
      isSubtreeCollapsed(aTab))
    collapseExpandSubtree(aTab, {
      collapsed: false,
      justNow:   true,
      broadcast: false // because the tab is going to be closed, broadcasted collapseExpandSubtree can be ignored.
    });

  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN) {
    const count = getCountOfClosingTabs(aTab);
    const confirmed = await confirmToCloseTabs(count, { windowId: aTab.apiTab.windowId });
    if (!confirmed) {
      await wait(0); // this is required to wait until the closing tab is stored to the "recently closed" list
      let sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
      if (sessions.length && sessions[0].tab)
        browser.sessions.restore(sessions[0].tab.sessionId);
      return;
    }
  }

  var nextTab = closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN && getNextSiblingTab(aTab) || aTab.nextSibling;
  tryMoveFocusFromClosingCurrentTab(aTab, {
    params: {
      nextTab:         nextTab && nextTab.id,
      nextTabUrl:      nextTab && nextTab.apiTab.url,
      nextIsDiscarded: isDiscarded(nextTab)
    }
  });

  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    await closeChildTabs(aTab);

  if (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB &&
      getChildTabs(aTab).length > 1) {
    log('trying to replace the closing tab with a new group tab');
    let firstChild = getFirstChildTab(aTab);
    let uri = makeGroupTabURI({
      title:     browser.i18n.getMessage('groupTab_label', firstChild.apiTab.title),
      temporary: true
    });
    incrementContainerCounter(aTab.parentNode, 'toBeOpenedTabsWithPositions');
    let groupTab = await openURIInTab(uri, {
      windowId:     aTab.apiTab.windowId,
      insertBefore: aTab, // not firstChild, because the "aTab" is disappeared from tree.
      inBackground: true
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

  reserveToSaveTreeStructure(aTab);
  reserveToCleanupNeedlessGroupTab(ancestors);

  await wait(0);
  // "Restore Previous Session" closes some tabs at first, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToCacheTree(aTab);
}

async function closeChildTabs(aParent) {
  var tabs = getDescendantTabs(aParent);
  //if (!fireTabSubtreeClosingEvent(aParent, tabs))
  //  return;

  //markAsClosedSet([aParent].concat(tabs));
  // close bottom to top!
  await Promise.all(tabs.reverse().map(aTab => {
    return removeTabInternally(aTab);
  }));
  //fireTabSubtreeClosedEvent(aParent, tabs);
}

function onTabMoving(aTab, aMoveInfo) {
  var container = getTabsContainer(aTab);
  var positionControlled = configs.insertNewChildAt != kINSERT_NO_CONTROL;
  if (parseInt(container.dataset.openingCount) > 0 &&
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
  reserveToCacheTree(aTab);
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
  if (!shouldApplyTreeBehavior(aMoveInfo)) {
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
  incrementContainerCounter(container, 'internalMovingCount');
  return browser.tabs.move(aTab.apiTab.id, {
    windowId: aMoveInfo.windowId,
    index:    aMoveInfo.fromIndex
  }).catch(e => {
    if (parseInt(container.dataset.internalMovingCount) > 0)
      decrementContainerCounter(container, 'internalMovingCount');
    handleMissingTabError(e);
  });
}

async function detectTabActionFromNewPosition(aTab, aMoveInfo) {
  log('detectTabActionFromNewPosition: ', dumpTab(aTab), aMoveInfo);
  var tree   = aMoveInfo.treeForActionDetection || snapshotTreeForActionDetection(aTab);
  var target = tree.target;

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

  var prevTab = tree.tabsById[target.previous];
  var nextTab = tree.tabsById[target.next];
  log('prevTab: ', prevTab && prevTab.id);
  log('nextTab: ', nextTab && nextTab.id);

  var prevParent = prevTab && tree.tabsById[prevTab.parent];
  var nextParent = nextTab && tree.tabsById[nextTab.parent];

  var prevLevel  = prevTab ? prevTab.level : -1 ;
  var nextLevel  = nextTab ? nextTab.level : -1 ;
  log('prevLevel: '+prevLevel);
  log('nextLevel: '+nextLevel);

  var oldParent = tree.tabsById[target.parent];
  var newParent = null;

  if (prevTab &&
      target.cookieStoreId != prevTab.cookieStoreId &&
      target.url == prevTab.url) {
    // https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/
    log('=> replaced by Firefox Multi-Acount Containers');
    newParent = prevParent;
  }
  else if (oldParent &&
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
    let ancestor = oldParent;
    while (ancestor) {
      if (ancestor == prevParent) {
        log(' => moving in related tree: keep it attached in existing tree');
        newParent = prevParent;
        break;
      }
      ancestor = tree.tabsById[ancestor.parent];
    }
    if (!newParent) {
      log(' => moving from other tree: keep it orphaned');
    }
  }
  else if (prevParent == nextParent) {
    log('=> moved into existing tree');
    newParent = prevParent;
  }
  else if (prevLevel > nextLevel) {
    log('=> moved to end of existing tree');
    if (!target.active) {
      log('=> maybe newly opened tab');
      newParent = prevParent;
    }
    else {
      log('=> maybe drag and drop (or opened with active state and position)');
      let realDelta = Math.abs(toIndex - fromIndex);
      newParent = realDelta < 2 ? prevParent : (oldParent || nextParent) ;
    }
    while (newParent && newParent.collapsed) {
      log('=> the tree is collapsed, up to parent tree')
      newParent = tree.tabsById[newParent.parent];
    }
  }
  else if (prevLevel < nextLevel) {
    log('=> moved to first child position of existing tree');
    newParent = prevTab || oldParent || nextParent;
  }

  log('calculated parent: ', {
    old: oldParent && oldParent.id,
    new: newParent && newParent.id
  });

  if (newParent) {
    let ancestor = newParent;
    while (ancestor) {
      if (ancestor == target) {
        log('=> invalid move: a parent is moved inside its own tree, thus move back!');
        return { action: 'moveBack' };
      }
      ancestor = tree.tabsById[ancestor.parent];
    }
  }

  if (newParent != oldParent) {
    if (newParent) {
      return {
        action:       'attach',
        parent:       newParent.id,
        insertBefore: nextTab && nextTab.id,
        insertAfter:  prevTab && prevTab.id
      };
    }
    else {
      return { action: 'detach' };
    }
  }
  return { action: 'move' };
}

function onTabFocusing(aTab, aInfo = {}) { // return true if this focusing is overridden.
  log('onTabFocusing ', aTab.id, aInfo);
  var container = aTab.parentNode;
  cancelDelayedExpand(getTabById(container.lastFocusedTab));
  var shouldSkipCollapsed = (
    !aInfo.byInternalOperation &&
    gMaybeTabSwitchingByShortcut &&
    configs.skipCollapsedTabsForTabSwitchingShortcuts
  );
  gTabSwitchedByShortcut = gMaybeTabSwitchingByShortcut;
  if (isCollapsed(aTab)) {
    if (!getParentTab(aTab)) {
      // This is invalid case, generally never should happen,
      // but actually happen on some environment:
      // https://github.com/piroor/treestyletab/issues/1717
      // So, always expand orphan collapsed tab as a failsafe.
      collapseExpandTab(aTab, {
        collapsed: false,
        broadcast: true
      });
      handleNewActiveTab(aTab, aInfo);
    }
    else if (configs.autoExpandOnCollapsedChildFocused &&
             !shouldSkipCollapsed) {
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
      let newSelection = getVisibleAncestorOrSelf(aTab);
      if (!newSelection) // this seems invalid case...
        return false;
      if (shouldSkipCollapsed &&
          container.lastFocusedTab == newSelection.id) {
        newSelection = getNextVisibleTab(newSelection) || getFirstVisibleTab(aTab);
      }
      container.lastFocusedTab = newSelection.id;
      if (gMaybeTabSwitchingByShortcut)
        setupDelayedExpand(newSelection);
      selectTabInternally(newSelection, { silently: true });
      log('onTabFocusing: discarded? ', dumpTab(aTab), isDiscarded(aTab));
      if (isDiscarded(aTab))
        aTab.dataset.discardURLAfterCompletelyLoaded = aTab.apiTab.url;
      return true
    }
  }
  else if (aInfo.byCurrentTabRemove &&
           (!configs.autoCollapseExpandSubtreeOnSelect ||
            configs.autoCollapseExpandSubtreeOnSelectExceptCurrentTabRemove)) {
    log('=> reaction for removing current tab');
    return true;
  }
  else if (hasChildTabs(aTab) &&
           isSubtreeCollapsed(aTab) &&
           !shouldSkipCollapsed) {
    log('=> reaction for newly focused parent tab');
    handleNewActiveTab(aTab, aInfo);
  }
  container.lastFocusedTab = aTab.id;
  if (gMaybeTabSwitchingByShortcut)
    setupDelayedExpand(aTab);
  tryInitGroupTab(aTab);
  return false;
}
function handleNewActiveTab(aTab, aInfo = {}) {
  log('handleNewActiveTab: ', dumpTab(aTab), aInfo);
  var shouldCollapseExpandNow = configs.autoCollapseExpandSubtreeOnSelect;
  var canCollapseTree         = shouldCollapseExpandNow;
  var canExpandTree           = shouldCollapseExpandNow && !aInfo.silently;
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

function setupDelayedExpand(aTab) {
  if (!aTab)
    return;
  cancelDelayedExpand(aTab);
  if (!configs.autoExpandOnTabSwitchingShortcuts ||
      !hasChildTabs(aTab) ||
      !isSubtreeCollapsed(aTab))
    return;
  aTab.delayedExpand = setTimeout(() => {
    collapseExpandTreesIntelligentlyFor(aTab, {
      broadcast: true
    });
  }, configs.autoExpandOnTabSwitchingShortcutsDelay);
}

function cancelDelayedExpand(aTab) {
  if (!aTab ||
      !aTab.delayedExpand)
    return;
  clearTimeout(aTab.delayedExpand);
  delete aTab.delayedExpand;
}

function cancelAllDelayedExpand(aHint) {
  for (let tab of getAllTabs(aHint)) {
    cancelDelayedExpand(tab);
  }
}

function onTabUpdated(aTab, aChangeInfo) {
  var parent = getOpenerTab(aTab);
  if (parent &&
      parent.parentNode == aTab.parentNode &&
      parent != getParentTab(aTab) &&
      configs.syncParentTabAndOpenerTab) {
    attachTabTo(aTab, parent, {
      insertAt:    kINSERT_NEAREST,
      forceExpand: isActive(aTab),
      broadcast:   true
    });
  }

  if (aChangeInfo.status || aChangeInfo.url) {
    tryInitGroupTab(aTab);
    tryStartHandleAccelKeyOnTab(aTab);
  }

  reserveToSaveTreeStructure(aTab);
  markWindowCacheDirtyFromTab(aTab, kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);

  const group = getGroupTabForOpener(aTab);
  if (group)
    reserveToUpdateRelatedGroupTabs(group);
}

function onTabLabelUpdated(aTab) {
  reserveToUpdateRelatedGroupTabs(aTab);
}

function onTabSubtreeCollapsedStateChanging(aTab) {
  reserveToUpdateSubtreeCollapsed(aTab);
  reserveToSaveTreeStructure(aTab);
  reserveToCacheTree(aTab);
}

function onTabCollapsedStateChanged(aTab, aInfo = {}) {
  if (aInfo.collapsed)
    aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
  else
    aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);
}

async function onTabAttached(aTab, aInfo = {}) {
  var parent = aInfo.parent;
  if (aTab.apiTab.openerTabId != parent.apiTab.id &&
      configs.syncParentTabAndOpenerTab) {
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
        let tabs = getAllTabs(aTab);
        nextTab = tabs[aInfo.newIndex];
        if (!nextTab)
          prevTab = tabs[aInfo.newIndex - 1];
      }
      log('move newly attached child: ', dumpTab(aTab), {
        next: dumpTab(nextTab),
        prev: dumpTab(prevTab)
      });
      if (nextTab)
        await moveTabSubtreeBefore(aTab, nextTab, Object.assign({}, aInfo, {
          broadcast: true
        }));
      else
        await moveTabSubtreeAfter(aTab, prevTab, Object.assign({}, aInfo, {
          broadcast: true
        }));
    })()
  ]);

  if (!ensureLivingTab(aTab) || // not removed while waiting
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
      collapseExpandSubtree(parent, Object.assign({}, aInfo, {
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
      if (configs.autoCollapseExpandSubtreeOnSelect ||
          isNewTreeCreatedManually ||
          shouldTabAutoExpanded(parent) ||
          aInfo.forceExpand) {
        newAncestors.filter(isSubtreeCollapsed).forEach(aAncestor => {
          collapseExpandSubtree(aAncestor, Object.assign({}, aInfo, {
            collapsed: false,
            broadcast: true
          }));
        });
      }
      if (isCollapsed(parent))
        collapseExpandTabAndSubtree(aTab, Object.assign({}, aInfo, {
          collapsed: true,
          broadcast: true
        }));
    }
    else if (shouldTabAutoExpanded(parent) ||
             isCollapsed(parent)) {
      collapseExpandTabAndSubtree(aTab, Object.assign({}, aInfo, {
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

  reserveToUpdateRelatedGroupTabs(aTab);

  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToCacheTree(aTab);
}

async function onTabDetached(aTab, aDetachInfo) {
  if (aTab.apiTab.openerTabId &&
      configs.syncParentTabAndOpenerTab) {
    aTab.apiTab.openerTabId = aTab.apiTab.id;
    aTab.apiTab.TSTUpdatedOpenerTabId = aTab.apiTab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(aTab.apiTab.id, { openerTabId: aTab.apiTab.id }) // set self id instead of null, because it requires any valid tab id...
      .catch(handleMissingTabError);
  }
  if (isGroupTab(aDetachInfo.oldParentTab))
    reserveToCleanupNeedlessGroupTab(aDetachInfo.oldParentTab);
  reserveToSaveTreeStructure(aTab);
  reserveToUpdateAncestors([aTab].concat(getDescendantTabs(aTab)));
  reserveToUpdateChildren(aDetachInfo.oldParentTab);

  reserveToUpdateRelatedGroupTabs(aDetachInfo.oldParentTab);

  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToCacheTree(aTab);
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
  reserveToCacheTree(aTab);
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

function onTabUnpinned(aTab) {
  reserveToCacheTree(aTab);
}

function onTabShown(aTab) {
  reserveToCacheTree(aTab);
}

function onTabHidden(aTab) {
  reserveToCacheTree(aTab);
}

function onGroupTabDetected(aTab) {
  tryInitGroupTab(aTab);
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

    case kCOMMAND_REQUEST_UNIQUE_ID:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.id);
        const tab = getTabById(aMessage.id);
        if (tab && !aMessage.forceNew)
          return tab.uniqueId;
        return requestUniqueId(aMessage.id, {
          forceNew: aMessage.forceNew
        });
      })();

    case kCOMMAND_REQUEST_REGISTERED_ADDONS:
      return (async () => {
        while (!gExternalListenerAddons) {
          await wait(10);
        }
        return gExternalListenerAddons;
      })();

    case kCOMMAND_REQUEST_SCROLL_LOCK_STATE:
      return Promise.resolve(gScrollLockedBy);

    case kCOMMAND_PULL_TREE_STRUCTURE:
      return (async () => {
        while (gInitializing) {
          await wait(10);
        }
        const structure = getTreeStructureFromTabs(getAllTabs(aMessage.windowId));
        return { structure };
      })();

    case kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tab);
        const tab = getTabById(aMessage.tab);
        if (!tab)
          return;
        const params = {
          collapsed: aMessage.collapsed,
          justNow:   aMessage.justNow,
          broadcast: true,
          stack:     aMessage.stack
        };
        if (aMessage.manualOperation)
          manualCollapseExpandSubtree(tab, params);
        else
          collapseExpandSubtree(tab, params);
        reserveToSaveTreeStructure(tab);
        markWindowCacheDirtyFromTab(tab, kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
      })();

    case kCOMMAND_LOAD_URI:
      return loadURI(aMessage.uri, Object.assign({}, aMessage.options, {
        tab:      getTabById(aMessage.options.tab),
        inRemote: false
      }));

    case kCOMMAND_NEW_TABS:
      return (async () => {
        await waitUntilTabsAreCreated([
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        log('new tabs requested: ', aMessage);
        return await openURIsInTabs(aMessage.uris, Object.assign({}, aMessage, {
          parent:       getTabById(aMessage.parent),
          insertBefore: getTabById(aMessage.insertBefore),
          insertAfter:  getTabById(aMessage.insertAfter)
        }));
      })();

    case kCOMMAND_NEW_WINDOW_FROM_TABS:
      return (async () => {
        log('new window requested: ', aMessage);
        await waitUntilTabsAreCreated(aMessage.tabs);
        const movedTabs = await openNewWindowFromTabs(
          aMessage.tabs.map(getTabById),
          aMessage
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case kCOMMAND_MOVE_TABS:
      return (async () => {
        log('move tabs requested: ', aMessage);
        await waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.insertBefore, aMessage.insertAfter]));
        const movedTabs = await moveTabs(
          aMessage.tabs.map(getTabById),
          Object.assign({}, aMessage, {
            insertBefore: getTabById(aMessage.insertBefore),
            insertAfter:  getTabById(aMessage.insertAfter)
          })
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tabs);
        return removeTabsInternally(aMessage.tabs.map(getTabById), aMessage.options);
      })();

    case kNOTIFY_TAB_MOUSEDOWN:
      gMaybeTabSwitchingByShortcut =
        gTabSwitchedByShortcut = false;
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tab);
        const tab = getTabById(aMessage.tab);
        if (!tab)
          return;

        const serializedTab = serializeTabForTSTAPI(tab);
        let results = await sendTSTAPIMessage(Object.assign({}, aMessage, {
          type:   kTSTAPI_NOTIFY_TAB_MOUSEDOWN,
          tab:    serializedTab,
          window: tab.apiTab.windowId
        }));
        results = results.concat(await sendTSTAPIMessage(Object.assign({}, aMessage, {
          type:   kTSTAPI_NOTIFY_TAB_CLICKED,
          tab:    serializedTab,
          window: tab.apiTab.windowId
        })));
        if (results.some(aResult => aResult.result)) // canceled
          return;

        // not canceled, then fallback to default "select tab"
        if (aMessage.button == 0)
          selectTabInternally(tab);
      })();

    case kCOMMAND_SELECT_TAB:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tab);
        const tab = getTabById(aMessage.tab);
        if (!tab)
          return;
        browser.tabs.update(tab.apiTab.id, { active: true })
          .catch(handleMissingTabError);
      })();

    case kCOMMAND_SELECT_TAB_INTERNALLY:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tab);
        const tab = getTabById(aMessage.tab);
        if (!tab)
          return;
        selectTabInternally(tab, Object.assign({}, aMessage.options, {
          inRemote: false
        }));
      })();

    case kCOMMAND_SET_SUBTREE_MUTED:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tab);
        log('set muted state: ', aMessage);
        const root = getTabById(aMessage.tab);
        if (!root)
          return;
        const tabs = [root].concat(getDescendantTabs(root));
        for (let tab of tabs) {
          const playing = isSoundPlaying(tab);
          const muted   = isMuted(tab);
          log(`tab ${tab.id}: playing=${playing}, muted=${muted}`);
          if (playing != aMessage.muted)
            continue;

          log(` => set muted=${aMessage.muted}`);

          browser.tabs.update(tab.apiTab.id, {
            muted: aMessage.muted
          }).catch(handleMissingTabError);

          const add = [];
          const remove = [];
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
      })();

    case kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.nextTab]));
        return moveTabsBefore(
          aMessage.tabs.map(getTabById),
          getTabById(aMessage.nextTab),
          Object.assign({}, aMessage, {
            broadcast: !!aMessage.broadcasted
          })
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.previousTab]));
        return moveTabsAfter(
          aMessage.tabs.map(getTabById),
          getTabById(aMessage.previousTab),
          Object.assign({}, aMessage, {
            broadcast: !!aMessage.broadcasted
          })
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case kCOMMAND_ATTACH_TAB_TO:
      return (async () => {
        await waitUntilTabsAreCreated([
          aMessage.child,
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        const child  = getTabById(aMessage.child);
        const parent = getTabById(aMessage.parent);
        if (child && parent)
          await attachTabTo(child, parent, Object.assign({}, aMessage, {
            insertBefore: getTabById(aMessage.insertBefore),
            insertAfter:  getTabById(aMessage.insertAfter)
          }));
      })();

    case kCOMMAND_DETACH_TAB:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tab);
        const tab = getTabById(aMessage.tab);
        if (tab)
          await detachTab(tab);
      })();

    case kCOMMAND_PERFORM_TABS_DRAG_DROP:
      return (async () => {
        await waitUntilTabsAreCreated([
          aMessage.attachTo,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        log('perform tabs dragdrop requested: ', aMessage);
        return performTabsDragDrop(Object.assign({}, aMessage, {
          attachTo:     getTabById(aMessage.attachTo),
          insertBefore: getTabById(aMessage.insertBefore),
          insertAfter:  getTabById(aMessage.insertAfter)
        }));
      })();

    case kCOMMAND_NOTIFY_START_TAB_SWITCH:
      log('kCOMMAND_NOTIFY_START_TAB_SWITCH');
      gMaybeTabSwitchingByShortcut = true;
      break;
    case kCOMMAND_NOTIFY_END_TAB_SWITCH:
      log('kCOMMAND_NOTIFY_END_TAB_SWITCH');
      return (async () => {
        if (gTabSwitchedByShortcut &&
            configs.skipCollapsedTabsForTabSwitchingShortcuts) {
          await waitUntilTabsAreCreated(aSender.tab);
          let tab = aSender.tab && getTabById(aSender.tab);
          if (!tab) {
            const apiTabs = await browser.tabs.query({ currentWindow: true, active: true });
            await waitUntilTabsAreCreated(apiTabs[0].id);
            tab = getTabById(apiTabs[0]);
          }
          cancelAllDelayedExpand(tab);
          if (configs.autoCollapseExpandSubtreeOnSelect &&
              tab &&
              tab.parentNode.lastFocusedTab == tab.id) {
            collapseExpandSubtree(tab, {
              collapsed: false,
              broadcast: true
            });
          }
        }
        gMaybeTabSwitchingByShortcut =
          gTabSwitchedByShortcut = false;
      })();

    case kCOMMAND_NOTIFY_PERMISSIONS_GRANTED:
      return (async () => {
        if (JSON.stringify(aMessage.permissions) == JSON.stringify(Permissions.ALL_URLS)) {
          const apiTabs = await browser.tabs.query({});
          await waitUntilTabsAreCreated(apiTabs.map(aAPITab => aAPITab.id));
          for (let apiTab of apiTabs) {
            tryStartHandleAccelKeyOnTab(getTabById(apiTab));
          }
        }
      })();

    default:
      const API_PREFIX_MATCHER = /^treestyletab:api:/;
      if (API_PREFIX_MATCHER.test(aMessage.type)) {
        aMessage.type = aMessage.type.replace(API_PREFIX_MATCHER, '');
        return onMessageExternal(aMessage, aSender);
      }
      break;
  }
}

function onMessageExternal(aMessage, aSender) {
  //log('onMessageExternal: ', aMessage, aSender);
  switch (aMessage.type) {
    case kTSTAPI_REGISTER_SELF:
      return (async () => {
        if (!aMessage.listeningTypes) {
          // for backward compatibility, send all message types available on TST 2.4.16 by default.
          aMessage.listeningTypes = [
            kTSTAPI_NOTIFY_READY,
            kTSTAPI_NOTIFY_SHUTDOWN,
            kTSTAPI_NOTIFY_TAB_CLICKED,
            kTSTAPI_NOTIFY_TAB_MOUSEDOWN,
            kTSTAPI_NOTIFY_TAB_MOUSEUP,
            kTSTAPI_NOTIFY_TABBAR_CLICKED,
            kTSTAPI_NOTIFY_TABBAR_MOUSEDOWN,
            kTSTAPI_NOTIFY_TABBAR_MOUSEUP
          ];
        }
        aMessage.id = aSender.id;
        gExternalListenerAddons[aSender.id] = aMessage;
        browser.runtime.sendMessage({
          type:    kCOMMAND_BROADCAST_API_REGISTERED,
          sender:  aSender,
          message: aMessage
        });
        const index = configs.cachedExternalAddons.indexOf(aSender.id);
        if (index < 0)
          configs.cachedExternalAddons = configs.cachedExternalAddons.concat([aSender.id]);
        return true;
      })();

    case kTSTAPI_UNREGISTER_SELF:
      return (async () => {
        browser.runtime.sendMessage({
          type:    kCOMMAND_BROADCAST_API_UNREGISTERED,
          sender:  aSender,
          message: aMessage
        });
        delete gExternalListenerAddons[aSender.id];
        delete gScrollLockedBy[aSender.id];
        configs.cachedExternalAddons = configs.cachedExternalAddons.filter(aId => aId != aSender.id);
        return true;
      })();

    case kTSTAPI_PING:
      return Promise.resolve(true);


    case kTSTAPI_GET_TREE:
      return (async () => {
        const tabs    = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = tabs.map(serializeTabForTSTAPI);
        return TSTAPIFormatResult(results, aMessage);
      })();

    case kTSTAPI_COLLAPSE_TREE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
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
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
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
        await waitUntilTabsAreCreated([
          aMessage.child,
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        const child  = getTabById(aMessage.child);
        const parent = getTabById(aMessage.parent);
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
        await waitUntilTabsAreCreated(aMessage.tab);
        const tab = getTabById(aMessage.tab);
        if (!tab)
          return false;
        await detachTab(tab, {
          broadcast: true
        });
        return true;
      })();

    case kTSTAPI_INDENT:
    case kTSTAPI_DEMOTE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.indent(aTab, aMessage)));
        return TSTAPIFormatResult(results, aMessage);
      })();

    case kTSTAPI_OUTDENT:
    case kTSTAPI_PROMOTE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.outdent(aTab, aMessage)));
        return TSTAPIFormatResult(results, aMessage);
      })();

    case kTSTAPI_MOVE_UP:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.moveUp(aTab, aMessage)));
        return TSTAPIFormatResult(results, aMessage);
      })();

    case kTSTAPI_MOVE_DOWN:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.moveDown(aTab, aMessage)));
        return TSTAPIFormatResult(results, aMessage);
      })();

    case kTSTAPI_FOCUS:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        for (let tab of tabs) {
          selectTabInternally(tab, {
            silently: aMessage.silently
          });
        }
        return TSTAPIFormatResult(tabs.map(aTab => true), aMessage);
      })();

    case kTSTAPI_DUPLICATE:
      return (async () => {
        const tabs   = await TSTAPIGetTargetTabs(aMessage, aSender);
        let behavior = kNEWTAB_OPEN_AS_ORPHAN;
        switch (String(aMessage.as || 'sibling').toLowerCase()) {
          case 'child':
            behavior = kNEWTAB_OPEN_AS_CHILD;
            break;
          case 'sibling':
            behavior = kNEWTAB_OPEN_AS_SIBLING;
            break;
          case 'nextsibling':
            behavior = kNEWTAB_OPEN_AS_NEXT_SIBLING;
            break;
          default:
            break;
        }
        for (let tab of tabs) {
          const duplicatedTabs = await moveTabs([tab], {
            duplicate:           true,
            destinationWindowId: tab.apiTab.windowId,
            insertAfter:         tab
          });
          await behaveAutoAttachedTab(duplicatedTabs[0], {
            broadcast: true,
            baseTab:   tab,
            behavior
          });
        }
        return TSTAPIFormatResult(tabs.map(aTab => true), aMessage);
      })();

    case kTSTAPI_GROUP_TABS:
      return (async () => {
        const tabs     = await TSTAPIGetTargetTabs(aMessage, aSender);
        const groupTab = await groupTabs(tabs, { broadcast: true });
        return groupTab.apiTab;
      })();

    case kTSTAPI_GET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        return Promise.resolve(getTreeStructureFromTabs(tabs));
      })();

    case kTSTAPI_SET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        await applyTreeStructureToTabs(tabs, aMessage.structure, {
          broadcast: true
        });
        return Promise.resolve(true);
      })();

    case kTSTAPI_ADD_TAB_STATE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        let states = aMessage.state || aMessage.states;
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
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        let states = aMessage.state || aMessage.states;
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

    case kTSTAPI_BLOCK_GROUPING:
      gGroupingBlockedBy[aSender.id] = true;
      return Promise.resolve(true);

    case kTSTAPI_UNBLOCK_GROUPING:
      delete gGroupingBlockedBy[aSender.id];
      return Promise.resolve(true);
  }
}

async function TSTAPIGetTargetTabs(aMessage, aSender) {
  await waitUntilAllTabsAreCreated();
  if (Array.isArray(aMessage.tabs))
    return TSTAPIGetTabsFromWrongIds(aMessage.tabs, aSender);
  if (aMessage.window || aMessage.windowId) {
    if (aMessage.tab == '*' ||
        aMessage.tabs == '*')
      return getAllTabs(aMessage.window || aMessage.windowId);
    else
      return getRootTabs(aMessage.window || aMessage.windowId);
  }
  if (aMessage.tab == '*' ||
      aMessage.tabs == '*') {
    let window = await browser.windows.getLastFocused({
      windowTypes: ['normal']
    });
    return getAllTabs(window.id);
  }
  if (aMessage.tab)
    return TSTAPIGetTabsFromWrongIds([aMessage.tab], aSender);
  return [];
}
async function TSTAPIGetTabsFromWrongIds(aIds, aSender) {
  var tabsInActiveWindow = [];
  if (aIds.some(aId => typeof aId != 'number')) {
    let window = await browser.windows.getLastFocused({
      populate:    true,
      windowTypes: ['normal']
    });
    tabsInActiveWindow = window.tabs;
  }
  let tabOrAPITabOrIds = await Promise.all(aIds.map(async (aId) => {
    switch (String(aId).toLowerCase()) {
      case 'active':
      case 'current': {
        let tabs = tabsInActiveWindow.filter(aTab => aTab.active);
        return TabIdFixer.fixTab(tabs[0]);
      }
      case 'next': {
        let tabs = tabsInActiveWindow.filter((aTab, aIndex) =>
          aIndex > 0 && tabsInActiveWindow[aIndex - 1].active);
        return tabs.length > 0 ? TabIdFixer.fixTab(tabs[0]) : null ;
      }
      case 'previous':
      case 'prev': {
        let maxIndex = tabsInActiveWindow.length - 1;
        let tabs = tabsInActiveWindow.filter((aTab, aIndex) =>
          aIndex < maxIndex && tabsInActiveWindow[aIndex + 1].active);
        return tabs.length > 0 ? TabIdFixer.fixTab(tabs[0]) : null ;
      }
      case 'nextsibling': {
        let tabs = tabsInActiveWindow.filter(aTab => aTab.active);
        return getNextSiblingTab(getTabById(tabs[0]));
      }
      case 'previoussibling':
      case 'prevsibling': {
        let tabs = tabsInActiveWindow.filter(aTab => aTab.active);
        return getPreviousSiblingTab(getTabById(tabs[0]));
      }
      case 'sendertab':
        if (aSender.tab)
          return aSender.tab;
      default:
        const tabFromUniqueId = getTabByUniqueId(aId);
        return tabFromUniqueId || aId;
    }
  }));
  return tabOrAPITabOrIds.map(getTabById).filter(aTab => !!aTab);
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
