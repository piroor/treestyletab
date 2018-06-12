/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

function onToolbarButtonClick(aTab) {
  if (Permissions.requestPostProcess())
    return;

  if (gSidebarOpenState.has(aTab.windowId))
    browser.sidebarAction.close();
  else
    browser.sidebarAction.open();
}

async function onShortcutCommand(aCommand) {
  const activeTab = Tabs.getTabById((await browser.tabs.query({
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
        as:      Constants.kNEWTAB_OPEN_AS_ORPHAN
      });
      return;
    case 'newChildTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_CHILD
      });
      return;
    case 'newSiblingTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_SIBLING
      });
      return;
    case 'newNextSiblingTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING
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
      selectTabInternally(Tabs.getPreviousSiblingTab(activeTab), { silently: false });
      return;
    case 'focusPreviousSilently':
      selectTabInternally(Tabs.getPreviousSiblingTab(activeTab), { silently: true });
      return;
    case 'focusNext':
      selectTabInternally(Tabs.getNextSiblingTab(activeTab), { silently: false });
      return;
    case 'focusNextSilently':
      selectTabInternally(Tabs.getNextSiblingTab(activeTab), { silently: true });
      return;

    case 'tabbarUp':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'lineup'
      });
      return;
    case 'tabbarPageUp':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'pageup'
      });
      return;
    case 'tabbarHome':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        to:       'top'
      });
      return;

    case 'tabbarDown':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'linedown'
      });
      return;
    case 'tabbarPageDown':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'pagedown'
      });
      return;
    case 'tabbarEnd':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
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

  const possibleOpenerTab = aInfo.activeTab || Tabs.getCurrentTab(aTab);
  const opener = Tabs.getOpenerTab(aTab);
  if (opener)
    opener.uniqueId.then(aUniqueId => {
      aTab.dataset.originalOpenerTabId = aUniqueId.id;
    });

  const container = aTab.parentNode;
  if ((configs.autoGroupNewTabsFromPinned &&
       Tabs.isPinned(opener) &&
       opener.parentNode == container) ||
      (configs.autoGroupNewTabs &&
       !opener &&
       !aInfo.maybeOrphan)) {
    if (parseInt(container.dataset.preventAutoGroupNewTabsUntil) > Date.now()) {
      TabsContainer.incrementCounter(container, 'preventAutoGroupNewTabsUntil', configs.autoGroupNewTabsTimeout);
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
    if (!aInfo.maybeOrphan && possibleOpenerTab) {
      if (Tabs.isNewTabCommandTab(aTab)) {
        log('behave as a tab opened by new tab command');
        handleNewTabFromActiveTab(aTab, {
          possibleOpenerTab,
          autoAttachBehavior:        configs.autoAttachOnNewTabCommand,
          inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
        });
        return true;
      }
      else if (possibleOpenerTab != aTab) {
        aTab.dataset.possibleOpenerTab = possibleOpenerTab.id;
      }
      aTab.dataset.isNewTab = true;
    }
    log('behave as a tab opened with any URL');
    return false;
  }

  log('opener: ', dumpTab(opener), aInfo.maybeOpenedWithPosition);
  if (Tabs.isPinned(opener) &&
      opener.parentNode == aTab.parentNode) {
    if (configs.autoGroupNewTabsFromPinned) {
      return true;
    }
    if (configs.insertNewTabFromPinnedTabAt == Constants.kINSERT_END) {
      TabsMove.moveTabAfter(aTab, Tabs.getLastTab(aTab), {
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

async function handleNewTabFromActiveTab(aTab, aParams = {}) {
  const activeTab = aParams.activeTab;
  log('handleNewTabFromActiveTab: activeTab = ', dumpTab(activeTab), aParams);
  await behaveAutoAttachedTab(aTab, {
    baseTab:   activeTab,
    behavior:  aParams.autoAttachBehavior,
    broadcast: true
  });
  const parent = Tabs.getParentTab(aTab);
  if (!parent ||
      !aParams.inheritContextualIdentity ||
      aTab.apiTab.cookieStoreId != 'firefox-default' ||
      aTab.apiTab.cookieStoreId == parent.apiTab.cookieStoreId)
    return;
  const cookieStoreId = activeTab.apiTab.cookieStoreId;
  log('handleNewTabFromActiveTab: reopen with inherited contextual identity ', cookieStoreId);
  await TabsOpen.openNewTab({
    parent,
    insertBefore: aTab,
    cookieStoreId
  });
  removeTabInternally(aTab);
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
      var tab = Tabs.getTabById(aTabReference.id);
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

    var newRootTabs = Tabs.collectRootTabs(tabs)
      .filter(aTab => !Tabs.isGroupTab(aTab));
    if (newRootTabs.length <= 0)
      return;

    var newRootTabsFromPinned = newRootTabs.filter(aTab => Tabs.isPinned(Tabs.getOpenerTab(aTab)));
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
    const opener = Tabs.getOpenerTab(tab);
    if (pinnedOpeners.indexOf(opener) < 0)
      pinnedOpeners.push(opener);
  }
  log('pinnedOpeners ', pinnedOpeners.map(dumpTab));

  // Second, collect tabs opened from pinned openers including existing tabs
  // (which were left ungrouped in previous process).
  const openerOf = {};
  const unifiedRootTabs = Tabs.getAllTabs(aRootTabs[0]).filter(aTab => {
    if (Tabs.getParentTab(aTab) ||
        aTab.dataset.alreadyGroupedForPinnedOpener)
      return false;
    if (aRootTabs.indexOf(aTab) > -1) { // newly opened tab
      const opener = Tabs.getOpenerTab(aTab);
      if (!opener)
        return false;
      openerOf[aTab.id] = opener;
      const tabs = childrenOfPinnedTabs[opener.id] || [];
      childrenOfPinnedTabs[opener.id] = tabs.concat([aTab]);
      return true;
    }
    const opener = Tabs.getTabByUniqueId(aTab.dataset.originalOpenerTabId);
    if (!Tabs.isPinned(opener))
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
    return childrenOfPinnedTabs[aOpener.id].length > 1 || Tabs.getGroupTabForOpener(aOpener);
  });
  log(' => ', pinnedOpeners.map(dumpTab));

  // Move newly opened tabs to expected position before grouping!
  switch (configs.insertNewTabFromPinnedTabAt) {
    case Constants.kINSERT_FIRST:
      const allPinnedTabs = Tabs.getPinnedTabs(aRootTabs[0].parentNode);
      const lastPinnedTab = allPinnedTabs[allPinnedTabs.length - 1];
      for (let tab of unifiedRootTabs.slice(0).reverse()) {
        if (pinnedOpeners.indexOf(openerOf[tab.id]) < 0 ||
            Tabs.getGroupTabForOpener(openerOf[tab.id]))
          continue;
        // If there is not-yet grouped sibling, place next to it.
        const siblings = tab.parentNode.querySelectorAll(`${Tabs.kSELECTOR_NORMAL_TAB}[data-original-opener-tab-id="${tab.dataset.originalOpenerTabId}"]:not([data-already-grouped-for-pinned-opener])`);
        const referenceTab = siblings.length > 0 ? siblings[siblings.length - 1] : lastPinnedTab ;
        await moveTabSubtreeAfter(tab, Tabs.getLastDescendantTab(referenceTab) || referenceTab, {
          broadcast: true
        });
      }
      break;
    case Constants.kINSERT_END:
      for (let tab of unifiedRootTabs) {
        if (Tabs.getGroupTabForOpener(openerOf[tab.id]))
          continue;
        await moveTabSubtreeAfter(tab, Tabs.getLastTab(tab.parentNode), {
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
    let parent = Tabs.getGroupTabForOpener(opener);
    if (!parent) {
      let uri = TabsOpen.makeGroupTabURI({
        title:       browser.i18n.getMessage('groupTab_fromPinnedTab_label', opener.apiTab.title),
        temporary:   true,
        openerTabId: opener.getAttribute(Constants.kPERSISTENT_ID)
      });
      parent = await TabsOpen.openURIInTab(uri, {
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
        insertAfter: configs.insertNewChildAt == Constants.kINSERT_FIRST ? parent : Tabs.getLastDescendantTab(parent),
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
      aTab.classList.add(Constants.kTAB_STATE_DUPLICATING);
      broadcastTabState(aTab, {
        add: [Constants.kTAB_STATE_DUPLICATING]
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
      Tabs.getNextTab(aTab),
      Tabs.getPreviousTab(aTab)
    ]);
  }
  else if (!aInfo.restored && !aInfo.skipFixupTree) {
    // if the tab is opened inside existing tree by someone, we must fixup the tree.
    if (!aInfo.openedWithPosition &&
        (Tabs.getNextNormalTab(aTab) ||
         Tabs.getPreviousNormalTab(aTab) ||
         (aInfo.treeForActionDetection &&
          (aInfo.treeForActionDetection.target.next ||
           aInfo.treeForActionDetection.target.previous))))
      tryFixupTreeForInsertedTab(aTab, {
        toIndex:   aTab.apiTab.index,
        fromIndex: Tabs.getTabIndex(Tabs.getLastTab(aTab)),
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
  var container = Tabs.getTabsContainer(aWindowId);
  var restoredCount = await container.allTabsRestored;
  if (restoredCount == 1) {
    log('onWindowRestoring: single tab restored');
    return;
  }

  log('onWindowRestoring: continue ', aWindowId);
  MetricsData.add('onWindowRestoring restore start');

  const apiTabs = await browser.tabs.query({ windowId: aWindowId });
  try {
    await restoreWindowFromEffectiveWindowCache(aWindowId, {
      ignorePinnedTabs: true,
      owner: apiTabs[apiTabs.length - 1],
      tabs:  apiTabs
    });
    MetricsData.add('onWindowRestoring restore end');
  }
  catch(e) {
    log('onWindowRestoring: FATAL ERROR while restoring tree from cache', String(e), e.stack);
  }
}

async function onTabClosed(aTab, aCloseInfo = {}) {
  log('onTabClosed ', dumpTab(aTab), aTab.apiTab, aCloseInfo);
  var container = aTab.parentNode;

  var ancestors = Tabs.getAncestorTabs(aTab);
  var closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aCloseInfo);
  if (!gSidebarOpenState.has(aTab.apiTab.windowId) &&
      closeParentBehavior != Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
      Tabs.isSubtreeCollapsed(aTab))
    collapseExpandSubtree(aTab, {
      collapsed: false,
      justNow:   true,
      broadcast: false // because the tab is going to be closed, broadcasted collapseExpandSubtree can be ignored.
    });

  var wasActive = Tabs.isActive(aTab);
  if (!(await tryGrantCloseTab(aTab, closeParentBehavior)))
    return;

  var nextTab = closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN && Tabs.getNextSiblingTab(aTab) || aTab.nextSibling;
  tryMoveFocusFromClosingCurrentTab(aTab, {
    wasActive,
    params: {
      active:          wasActive,
      nextTab:         nextTab && nextTab.id,
      nextTabUrl:      nextTab && nextTab.apiTab.url,
      nextIsDiscarded: Tabs.isDiscarded(nextTab)
    }
  });

  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    await closeChildTabs(aTab);

  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB &&
      Tabs.getChildTabs(aTab).length > 1) {
    log('trying to replace the closing tab with a new group tab');
    let firstChild = Tabs.getFirstChildTab(aTab);
    let uri = TabsOpen.makeGroupTabURI({
      title:     browser.i18n.getMessage('groupTab_label', firstChild.apiTab.title),
      temporary: true
    });
    TabsContainer.incrementCounter(aTab.parentNode, 'toBeOpenedTabsWithPositions');
    let groupTab = await TabsOpen.openURIInTab(uri, {
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
    closeParentBehavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;
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

async function tryGrantCloseTab(aTab, aCloseParentBehavior) {
  const self = tryGrantCloseTab;

  self.closingTabIds.push(aTab.id);
  if (aCloseParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    self.closingDescendantTabIds = self.closingDescendantTabIds
      .concat(getClosingTabsFromParent(aTab).map(aTab => aTab.id));

  // this is required to wait until the closing tab is stored to the "recently closed" list
  await wait(0);
  if (self.promisedGrantedToCloseTabs)
    return self.promisedGrantedToCloseTabs;

  self.closingTabWasActive = self.closingTabWasActive || Tabs.isActive(aTab);

  let shouldRestoreCount;
  self.promisedGrantedToCloseTabs = wait(10).then(async () => {
    let foundTabs = {};
    self.closingTabIds = self.closingTabIds
      .filter(aId => !foundTabs[aId] && (foundTabs[aId] = true)); // uniq

    foundTabs = {};
    self.closingDescendantTabIds = self.closingDescendantTabIds
      .filter(aId => !foundTabs[aId] && (foundTabs[aId] = true) && (self.closingTabIds.indexOf(aId) < 0));

    shouldRestoreCount = self.closingDescendantTabIds.length;
    if (shouldRestoreCount > 0) {
      return confirmToCloseTabs(shouldRestoreCount + 1, {
        windowId: aTab.apiTab.windowId
      });
    }
    return true;
  })
    .then(async (aGranted) => {
      if (aGranted)
        return true;
      const sessions = await browser.sessions.getRecentlyClosed({ maxResults: shouldRestoreCount * 2 });
      const toBeRestoredTabs = [];
      for (let session of sessions) {
        if (!session.tab)
          continue;
        toBeRestoredTabs.push(session.tab);
        if (toBeRestoredTabs.length == shouldRestoreCount)
          break;
      }
      for (let tab of toBeRestoredTabs.reverse()) {
        log('tryGrantClose: Tabrestoring session = ', tab);
        browser.sessions.restore(tab.sessionId);
        const tabs = await Tabs.waitUntilAllTabsAreCreated();
        await Promise.all(tabs.map(aTab => aTab.opened));
      }
      return false;
    });

  const granted = await self.promisedGrantedToCloseTabs;
  self.closingTabIds              = [];
  self.closingDescendantTabIds    = [];
  self.closingTabWasActive        = false;
  self.promisedGrantedToCloseTabs = null;
  return granted;
}
tryGrantCloseTab.closingTabIds              = [];
tryGrantCloseTab.closingDescendantTabIds    = [];
tryGrantCloseTab.closingTabWasActive        = false;
tryGrantCloseTab.promisedGrantedToCloseTabs = null;

async function closeChildTabs(aParent) {
  var tabs = Tabs.getDescendantTabs(aParent);
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
  // avoid TabMove produced by browser.tabs.insertRelatedAfterCurrent=true or something.
  const container = Tabs.getTabsContainer(aTab);
  const isNewlyOpenedTab = parseInt(container.dataset.openingCount) > 0;
  const positionControlled = configs.insertNewChildAt != Constants.kINSERT_NO_CONTROL;
  if (!isNewlyOpenedTab ||
      aMoveInfo.byInternalOperation ||
      !positionControlled)
    return false;

  const opener = Tabs.getOpenerTab(aTab);
  // if there is no valid opener, it can be a restored initial tab in a restored window
  // and can be just moved as a part of window restoration process.
  if (!opener)
    return false;

  log('onTabMove for new child tab: move back '+aMoveInfo.toIndex+' => '+aMoveInfo.fromIndex);
  moveBack(aTab, aMoveInfo);
  return true;
}

Tabs.onTabElementMoved.addListener((aTab, aInfo = {}) => {
  reserveToUpdateInsertionPosition([
    aTab,
    Tabs.getPreviousTab(aTab),
    Tabs.getNextTab(aTab),
    aInfo.oldPreviousTab,
    aInfo.oldNextTab
  ]);
});

async function onTabMoved(aTab, aMoveInfo) {
  reserveToCacheTree(aTab);
  reserveToSaveTreeStructure(aTab);
  reserveToUpdateInsertionPosition([
    aTab,
    aMoveInfo.oldPreviousTab,
    aMoveInfo.oldNextTab,
    Tabs.getPreviousTab(aTab),
    Tabs.getNextTab(aTab)
  ]);

  var container = Tabs.getTabsContainer(aTab);
  if (aMoveInfo.byInternalOperation ||
      Tabs.isDuplicating(aTab)) {
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
      await attachTabTo(aTab, Tabs.getTabById(action.parent), {
        insertBefore: Tabs.getTabById(action.insertBefore),
        insertAfter:  Tabs.getTabById(action.insertAfter),
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
  TabsContainer.incrementCounter(container, 'internalMovingCount');
  return browser.tabs.move(aTab.apiTab.id, {
    windowId: aMoveInfo.windowId,
    index:    aMoveInfo.fromIndex
  }).catch(e => {
    if (parseInt(container.dataset.internalMovingCount) > 0)
      TabsContainer.decrementCounter(container, 'internalMovingCount');
    ApiTabs.handleMissingTabError(e);
  });
}

async function detectTabActionFromNewPosition(aTab, aMoveInfo) {
  log('detectTabActionFromNewPosition: ', dumpTab(aTab), aMoveInfo);
  var tree   = aMoveInfo.treeForActionDetection || Tabs.snapshotTreeForActionDetection(aTab);
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
  if (aTab.dataset.shouldReloadOnSelect) {
    browser.tabs.reload(aTab.apiTab.id);
    delete aTab.dataset.shouldReloadOnSelect;
  }
  var container = aTab.parentNode;
  cancelDelayedExpand(Tabs.getTabById(container.lastFocusedTab));
  var shouldSkipCollapsed = (
    !aInfo.byInternalOperation &&
    gMaybeTabSwitchingByShortcut &&
    configs.skipCollapsedTabsForTabSwitchingShortcuts
  );
  gTabSwitchedByShortcut = gMaybeTabSwitchingByShortcut;
  if (Tabs.isCollapsed(aTab)) {
    if (!Tabs.getParentTab(aTab)) {
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
      for (let ancestor of Tabs.getAncestorTabs(aTab)) {
        collapseExpandSubtree(ancestor, {
          collapsed: false,
          broadcast: true
        });
      }
      handleNewActiveTab(aTab, aInfo);
    }
    else {
      log('=> reaction for focusing collapsed descendant');
      let newSelection = Tabs.getVisibleAncestorOrSelf(aTab);
      if (!newSelection) // this seems invalid case...
        return false;
      if (shouldSkipCollapsed &&
          container.lastFocusedTab == newSelection.id) {
        newSelection = Tabs.getNextVisibleTab(newSelection) || Tabs.getFirstVisibleTab(aTab);
      }
      container.lastFocusedTab = newSelection.id;
      if (gMaybeTabSwitchingByShortcut)
        setupDelayedExpand(newSelection);
      selectTabInternally(newSelection, { silently: true });
      log('onTabFocusing: discarded? ', dumpTab(aTab), Tabs.isDiscarded(aTab));
      if (Tabs.isDiscarded(aTab))
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
  else if (Tabs.hasChildTabs(aTab) &&
           Tabs.isSubtreeCollapsed(aTab) &&
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
      !Tabs.hasChildTabs(aTab) ||
      !Tabs.isSubtreeCollapsed(aTab))
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
  for (let tab of Tabs.getAllTabs(aHint)) {
    cancelDelayedExpand(tab);
  }
}

function onTabUpdated(aTab, aChangeInfo) {
  if (configs.syncParentTabAndOpenerTab) {
    Tabs.waitUntilAllTabsAreCreated().then(() => {
      const parent = Tabs.getOpenerTab(aTab);
      if (!parent ||
          parent.parentNode != aTab.parentNode ||
          parent == Tabs.getParentTab(aTab))
        return;
      attachTabTo(aTab, parent, {
        insertAt:    Constants.kINSERT_NEAREST,
        forceExpand: Tabs.isActive(aTab),
        broadcast:   true
      });
    });
  }

  if (aChangeInfo.status || aChangeInfo.url) {
    tryInitGroupTab(aTab);
    tryStartHandleAccelKeyOnTab(aTab);
  }

  if (aTab.dataset.isNewTab &&
      (aChangeInfo.url || aChangeInfo.status == 'complete')) {
    delete aTab.dataset.isNewTab;
    const possibleOpenerTab = Tabs.getTabById(aTab.dataset.possibleOpenerTab);
    delete aTab.dataset.possibleOpenerTab;
    log('possibleOpenerTab ', dumpTab(possibleOpenerTab));
    if (!Tabs.getParentTab(aTab) && possibleOpenerTab) {
      if (Tabs.isNewTabCommandTab(aTab)) {
        log('behave as a tab opened by new tab command (delayed)');
        handleNewTabFromActiveTab(aTab, {
          activeTab:                 possibleOpenerTab,
          autoAttachBehavior:        configs.autoAttachOnNewTabCommand,
          inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
        });
      }
      else {
        const siteMatcher  = /^\w+:\/\/([^\/]+)(?:$|\/.*$)/;
        const openerTabSite = possibleOpenerTab.apiTab.url.match(siteMatcher);
        const newTabSite    = aTab.apiTab.url.match(siteMatcher);
        if (openerTabSite && newTabSite && openerTabSite[1] == newTabSite[1]) {
          log('behave as a tab opened from same site (delayed)');
          handleNewTabFromActiveTab(aTab, {
            activeTab:                 possibleOpenerTab,
            autoAttachBehavior:        configs.autoAttachSameSiteOrphan,
            inheritContextualIdentity: configs.inheritContextualIdentityToSameSiteOrphan
          });
        }
      }
    }
  }

  reserveToSaveTreeStructure(aTab);
  markWindowCacheDirtyFromTab(aTab, Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);

  const group = Tabs.getGroupTabForOpener(aTab);
  if (group)
    reserveToUpdateRelatedGroupTabs(group);
}

Tabs.onLabelUpdated.addListener(aTab => {
  reserveToUpdateRelatedGroupTabs(aTab);
});

function onTabSubtreeCollapsedStateChanging(aTab) {
  reserveToUpdateSubtreeCollapsed(aTab);
  reserveToSaveTreeStructure(aTab);
  reserveToCacheTree(aTab);
}

function onTabCollapsedStateChanged(aTab, aInfo = {}) {
  if (aInfo.collapsed)
    aTab.classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
  else
    aTab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);
}

async function onTabAttached(aTab, aInfo = {}) {
  var parent = aInfo.parent;
  if (aTab.apiTab.openerTabId != parent.apiTab.id &&
      configs.syncParentTabAndOpenerTab) {
    aTab.apiTab.openerTabId = parent.apiTab.id;
    aTab.apiTab.TSTUpdatedOpenerTabId = aTab.apiTab.openerTabId; // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1409262
    browser.tabs.update(aTab.apiTab.id, { openerTabId: parent.apiTab.id })
      .catch(ApiTabs.handleMissingTabError);
  }

  // Because the tab is possibly closing for "reopen" operation,
  // we need to apply "forceExpand" immediately. Otherwise, when
  // the tab is closed with "subtree collapsed" state, descendant
  // tabs are also closed even if "forceExpand" is "true".
  if (aInfo.newlyAttached &&
      !gInitializing) {
    if (Tabs.isSubtreeCollapsed(aInfo.parent) &&
        !aInfo.forceExpand)
      collapseExpandTabAndSubtree(aTab, {
        collapsed: true,
        justNow:   true,
        broadcast: true
      });

    let isNewTreeCreatedManually = !aInfo.justNow && Tabs.getChildTabs(parent).length == 1;
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

      let newAncestors = [parent].concat(Tabs.getAncestorTabs(parent));
      if (configs.autoCollapseExpandSubtreeOnSelect ||
          isNewTreeCreatedManually ||
          shouldTabAutoExpanded(parent) ||
          aInfo.forceExpand) {
        newAncestors.filter(Tabs.isSubtreeCollapsed).forEach(aAncestor => {
          collapseExpandSubtree(aAncestor, Object.assign({}, aInfo, {
            collapsed: false,
            broadcast: true
          }));
        });
      }
      if (Tabs.isCollapsed(parent))
        collapseExpandTabAndSubtree(aTab, Object.assign({}, aInfo, {
          collapsed: true,
          broadcast: true
        }));
    }
    else if (shouldTabAutoExpanded(parent) ||
             Tabs.isCollapsed(parent)) {
      collapseExpandTabAndSubtree(aTab, Object.assign({}, aInfo, {
        collapsed: true,
        broadcast: true
      }));
    }
  }

  await Promise.all([
    Tabs.isOpening(aTab) && aTab.opened,
    !aInfo.dontMove && (async () => {
      let nextTab = aInfo.insertBefore;
      let prevTab = aInfo.insertAfter;
      if (!nextTab && !prevTab) {
        let tabs = Tabs.getAllTabs(aTab);
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

  if (!Tabs.ensureLivingTab(aTab) || // not removed while waiting
      Tabs.getParentTab(aTab) != aInfo.parent) // not detached while waiting
    return;

  browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_TAB_ATTACHED_COMPLETELY,
    tab:    aTab.id,
    parent: parent.id,
    newlyAttached: aInfo.newlyAttached
  });

  reserveToSaveTreeStructure(aTab);
  if (aInfo.newlyAttached)
    reserveToUpdateAncestors([aTab].concat(Tabs.getDescendantTabs(aTab)));
  reserveToUpdateChildren(parent);
  reserveToUpdateInsertionPosition([
    aTab,
    Tabs.getNextTab(aTab),
    Tabs.getPreviousTab(aTab)
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
      .catch(ApiTabs.handleMissingTabError);
  }
  if (Tabs.isGroupTab(aDetachInfo.oldParentTab))
    reserveToCleanupNeedlessGroupTab(aDetachInfo.oldParentTab);
  reserveToSaveTreeStructure(aTab);
  reserveToUpdateAncestors([aTab].concat(Tabs.getDescendantTabs(aTab)));
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
    if (Tabs.getParentTab(movedTab))
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
      ignoredTabs: Tabs.getDescendantTabs(aTab)
    });
    return;
  }

  tryMoveFocusFromClosingCurrentTab(aTab);

  log('onTabDetachedFromWindow ', dumpTab(aTab));
  var closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aInfo);
  if (closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
    closeParentBehavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

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

Tabs.onPinned.addListener(aTab => {
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
});

Tabs.onUnpinned.addListener(aTab => {
  reserveToCacheTree(aTab);
});

Tabs.onShown.addListener(aTab => {
  reserveToCacheTree(aTab);
});

Tabs.onHidden.addListener(aTab => {
  reserveToCacheTree(aTab);
});

Tabs.onGroupTabDetected.addListener(aTab => {
  tryInitGroupTab(aTab);
});


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
    case Constants.kCOMMAND_PING_TO_BACKGROUND:
      return Promise.resolve(true);

    case Constants.kCOMMAND_REQUEST_UNIQUE_ID:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.id);
        const tab = Tabs.getTabById(aMessage.id);
        if (tab && !aMessage.forceNew)
          return tab.uniqueId;
        return Tabs.requestUniqueId(aMessage.id, {
          forceNew: aMessage.forceNew
        });
      })();

    case Constants.kCOMMAND_REQUEST_REGISTERED_ADDONS:
      return (async () => {
        while (!TSTAPI.isInitialized()) {
          await wait(10);
        }
        return TSTAPI.addons;
      })();

    case Constants.kCOMMAND_REQUEST_SCROLL_LOCK_STATE:
      return Promise.resolve(gScrollLockedBy);

    case Constants.kCOMMAND_PULL_TREE_STRUCTURE:
      return (async () => {
        while (gInitializing) {
          await wait(10);
        }
        const structure = getTreeStructureFromTabs(Tabs.getAllTabs(aMessage.windowId));
        return { structure };
      })();

    case Constants.kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
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
        markWindowCacheDirtyFromTab(tab, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
      })();

    case Constants.kCOMMAND_LOAD_URI:
      return TabsOpen.loadURI(aMessage.uri, Object.assign({}, aMessage.options, {
        tab:      Tabs.getTabById(aMessage.options.tab),
        inRemote: false
      }));

    case Constants.kCOMMAND_NEW_TABS:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        log('new tabs requested: ', aMessage);
        return await TabsOpen.openURIsInTabs(aMessage.uris, Object.assign({}, aMessage, {
          parent:       Tabs.getTabById(aMessage.parent),
          insertBefore: Tabs.getTabById(aMessage.insertBefore),
          insertAfter:  Tabs.getTabById(aMessage.insertAfter)
        }));
      })();

    case Constants.kCOMMAND_NEW_WINDOW_FROM_TABS:
      return (async () => {
        log('new window requested: ', aMessage);
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs);
        const movedTabs = await openNewWindowFromTabs(
          aMessage.tabs.map(Tabs.getTabById),
          aMessage
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case Constants.kCOMMAND_MOVE_TABS:
      return (async () => {
        log('move tabs requested: ', aMessage);
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.insertBefore, aMessage.insertAfter]));
        const movedTabs = await moveTabs(
          aMessage.tabs.map(Tabs.getTabById),
          Object.assign({}, aMessage, {
            insertBefore: Tabs.getTabById(aMessage.insertBefore),
            insertAfter:  Tabs.getTabById(aMessage.insertAfter)
          })
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case Constants.kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs);
        return removeTabsInternally(aMessage.tabs.map(Tabs.getTabById), aMessage.options);
      })();

    case Constants.kNOTIFY_SIDEBAR_FOCUS:
      gSidebarFocusState.set(aMessage.windowId, true);
      break;

    case Constants.kNOTIFY_SIDEBAR_BLUR:
      gSidebarFocusState.delete(aMessage.windowId);
      break;

    case Constants.kNOTIFY_TAB_MOUSEDOWN:
      gMaybeTabSwitchingByShortcut =
        gTabSwitchedByShortcut = false;
      return (async () => {
        if (configs.logOnMouseEvent)
          log('Constants.kNOTIFY_TAB_MOUSEDOWN');
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;

        if (configs.logOnMouseEvent)
          log('Sending message to listeners');
        const serializedTab = TSTAPI.serializeTab(tab);
        const mousedownNotified = TSTAPI.sendMessage(Object.assign({}, aMessage, {
          type:   TSTAPI.kNOTIFY_TAB_MOUSEDOWN,
          tab:    serializedTab,
          window: tab.apiTab.windowId
        }));

        // We must send tab-mouseup after tab-mousedown is notified.
        // So, we return to the caller process and do this post process asynchronously.
        mousedownNotified.then(async (aResults) => {
          const results = aResults.concat(
            await TSTAPI.sendMessage(Object.assign({}, aMessage, {
              type:   TSTAPI.kNOTIFY_TAB_CLICKED,
              tab:    serializedTab,
              window: tab.apiTab.windowId
            }))
          );
          if (results.some(aResult => aResult.result)) // canceled
            return;

          if (configs.logOnMouseEvent)
            log('Ready to select the tab');

          // not canceled, then fallback to default "select tab"
          if (aMessage.button == 0)
            selectTabInternally(tab);
        });

        return true;
      })();

    case Constants.kCOMMAND_SELECT_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        browser.tabs.update(tab.apiTab.id, { active: true })
          .catch(ApiTabs.handleMissingTabError);
      })();

    case Constants.kCOMMAND_SELECT_TAB_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        selectTabInternally(tab, Object.assign({}, aMessage.options, {
          inRemote: false
        }));
      })();

    case Constants.kCOMMAND_SET_SUBTREE_MUTED:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        log('set muted state: ', aMessage);
        const root = Tabs.getTabById(aMessage.tab);
        if (!root)
          return;
        const tabs = [root].concat(Tabs.getDescendantTabs(root));
        for (let tab of tabs) {
          const playing = Tabs.isSoundPlaying(tab);
          const muted   = Tabs.isMuted(tab);
          log(`tab ${tab.id}: playing=${playing}, muted=${muted}`);
          if (playing != aMessage.muted)
            continue;

          log(` => set muted=${aMessage.muted}`);

          browser.tabs.update(tab.apiTab.id, {
            muted: aMessage.muted
          }).catch(ApiTabs.handleMissingTabError);

          const add = [];
          const remove = [];
          if (aMessage.muted) {
            add.push(Constants.kTAB_STATE_MUTED);
            tab.classList.add(Constants.kTAB_STATE_MUTED);
          }
          else {
            remove.push(Constants.kTAB_STATE_MUTED);
            tab.classList.remove(Constants.kTAB_STATE_MUTED);
          }

          if (Tabs.isAudible(tab) && !aMessage.muted) {
            add.push(Constants.kTAB_STATE_SOUND_PLAYING);
            tab.classList.add(Constants.kTAB_STATE_SOUND_PLAYING);
          }
          else {
            remove.push(Constants.kTAB_STATE_SOUND_PLAYING);
            tab.classList.remove(Constants.kTAB_STATE_SOUND_PLAYING);
          }

          // tabs.onUpdated is too slow, so users will be confused
          // from still-not-updated tabs (in other words, they tabs
          // are unresponsive for quick-clicks).
          broadcastTabState(tab, {
            add, remove,
            bubbles: !Tabs.hasChildTabs(tab)
          });
        }
      })();

    case Constants.kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.nextTab]));
        return TabsMove.moveTabsBefore(
          aMessage.tabs.map(Tabs.getTabById),
          Tabs.getTabById(aMessage.nextTab),
          Object.assign({}, aMessage, {
            broadcast: !!aMessage.broadcasted
          })
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case Constants.kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.previousTab]));
        return TabsMove.moveTabsAfter(
          aMessage.tabs.map(Tabs.getTabById),
          Tabs.getTabById(aMessage.previousTab),
          Object.assign({}, aMessage, {
            broadcast: !!aMessage.broadcasted
          })
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case Constants.kCOMMAND_ATTACH_TAB_TO:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.child,
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        const child  = Tabs.getTabById(aMessage.child);
        const parent = Tabs.getTabById(aMessage.parent);
        if (child && parent)
          await attachTabTo(child, parent, Object.assign({}, aMessage, {
            insertBefore: Tabs.getTabById(aMessage.insertBefore),
            insertAfter:  Tabs.getTabById(aMessage.insertAfter)
          }));
      })();

    case Constants.kCOMMAND_DETACH_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (tab)
          await detachTab(tab);
      })();

    case Constants.kCOMMAND_PERFORM_TABS_DRAG_DROP:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.attachTo,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        log('perform tabs dragdrop requested: ', aMessage);
        return performTabsDragDrop(Object.assign({}, aMessage, {
          attachTo:     Tabs.getTabById(aMessage.attachTo),
          insertBefore: Tabs.getTabById(aMessage.insertBefore),
          insertAfter:  Tabs.getTabById(aMessage.insertAfter)
        }));
      })();

    case Constants.kCOMMAND_NOTIFY_START_TAB_SWITCH:
      log('Constants.kCOMMAND_NOTIFY_START_TAB_SWITCH');
      gMaybeTabSwitchingByShortcut = true;
      break;
    case Constants.kCOMMAND_NOTIFY_END_TAB_SWITCH:
      log('Constants.kCOMMAND_NOTIFY_END_TAB_SWITCH');
      return (async () => {
        if (gTabSwitchedByShortcut &&
            configs.skipCollapsedTabsForTabSwitchingShortcuts) {
          await Tabs.waitUntilTabsAreCreated(aSender.tab);
          let tab = aSender.tab && Tabs.getTabById(aSender.tab);
          if (!tab) {
            const apiTabs = await browser.tabs.query({ currentWindow: true, active: true });
            await Tabs.waitUntilTabsAreCreated(apiTabs[0].id);
            tab = Tabs.getTabById(apiTabs[0]);
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

    case Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED:
      return (async () => {
        if (JSON.stringify(aMessage.permissions) == JSON.stringify(Permissions.ALL_URLS)) {
          const apiTabs = await browser.tabs.query({});
          await Tabs.waitUntilTabsAreCreated(apiTabs.map(aAPITab => aAPITab.id));
          for (let apiTab of apiTabs) {
            tryStartHandleAccelKeyOnTab(Tabs.getTabById(apiTab));
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
    case TSTAPI.kREGISTER_SELF:
      return (async () => {
        if (!aMessage.listeningTypes) {
          // for backward compatibility, send all message types available on TST 2.4.16 by default.
          aMessage.listeningTypes = [
            TSTAPI.kNOTIFY_READY,
            TSTAPI.kNOTIFY_SHUTDOWN,
            TSTAPI.kNOTIFY_TAB_CLICKED,
            TSTAPI.kNOTIFY_TAB_MOUSEDOWN,
            TSTAPI.kNOTIFY_TAB_MOUSEUP,
            TSTAPI.kNOTIFY_TABBAR_CLICKED,
            TSTAPI.kNOTIFY_TABBAR_MOUSEDOWN,
            TSTAPI.kNOTIFY_TABBAR_MOUSEUP
          ];
        }
        aMessage.internalId = aSender.url.replace(/^moz-extension:\/\/([^\/]+)\/.*$/, '$1');
        aMessage.id = aSender.id;
        TSTAPI.addons[aSender.id] = aMessage;
        browser.runtime.sendMessage({
          type:    Constants.kCOMMAND_BROADCAST_API_REGISTERED,
          sender:  aSender,
          message: aMessage
        });
        const index = configs.cachedExternalAddons.indexOf(aSender.id);
        if (index < 0)
          configs.cachedExternalAddons = configs.cachedExternalAddons.concat([aSender.id]);
        return true;
      })();

    case TSTAPI.kUNREGISTER_SELF:
      return (async () => {
        browser.runtime.sendMessage({
          type:    Constants.kCOMMAND_BROADCAST_API_UNREGISTERED,
          sender:  aSender,
          message: aMessage
        });
        delete TSTAPI.addons[aSender.id];
        delete gScrollLockedBy[aSender.id];
        configs.cachedExternalAddons = configs.cachedExternalAddons.filter(aId => aId != aSender.id);
        return true;
      })();

    case TSTAPI.kPING:
      return Promise.resolve(true);


    case TSTAPI.kGET_TREE:
      return (async () => {
        const tabs    = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = tabs.map(TSTAPI.serializeTab);
        return TSTAPIFormatResult(results, aMessage);
      })();

    case TSTAPI.kCOLLAPSE_TREE:
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

    case TSTAPI.kEXPAND_TREE:
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

    case TSTAPI.kATTACH:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.child,
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        const child  = Tabs.getTabById(aMessage.child);
        const parent = Tabs.getTabById(aMessage.parent);
        if (!child ||
            !parent ||
            child.parentNode != parent.parentNode)
          return false;
        await attachTabTo(child, parent, {
          broadcast:    true,
          insertBefore: Tabs.getTabById(aMessage.insertBefore),
          insertAfter:  Tabs.getTabById(aMessage.insertAfter)
        });
        return true;
      })();

    case TSTAPI.kDETACH:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return false;
        await detachTab(tab, {
          broadcast: true
        });
        return true;
      })();

    case TSTAPI.kINDENT:
    case TSTAPI.kDEMOTE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.indent(aTab, aMessage)));
        return TSTAPIFormatResult(results, aMessage);
      })();

    case TSTAPI.kOUTDENT:
    case TSTAPI.kPROMOTE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.outdent(aTab, aMessage)));
        return TSTAPIFormatResult(results, aMessage);
      })();

    case TSTAPI.kMOVE_UP:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.moveUp(aTab, aMessage)));
        return TSTAPIFormatResult(results, aMessage);
      })();

    case TSTAPI.kMOVE_DOWN:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.moveDown(aTab, aMessage)));
        return TSTAPIFormatResult(results, aMessage);
      })();

    case TSTAPI.kFOCUS:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        for (let tab of tabs) {
          selectTabInternally(tab, {
            silently: aMessage.silently
          });
        }
        return TSTAPIFormatResult(tabs.map(aTab => true), aMessage);
      })();

    case TSTAPI.kDUPLICATE:
      return (async () => {
        const tabs   = await TSTAPIGetTargetTabs(aMessage, aSender);
        let behavior = Constants.kNEWTAB_OPEN_AS_ORPHAN;
        switch (String(aMessage.as || 'sibling').toLowerCase()) {
          case 'child':
            behavior = Constants.kNEWTAB_OPEN_AS_CHILD;
            break;
          case 'sibling':
            behavior = Constants.kNEWTAB_OPEN_AS_SIBLING;
            break;
          case 'nextsibling':
            behavior = Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING;
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

    case TSTAPI.kGROUP_TABS:
      return (async () => {
        const tabs     = await TSTAPIGetTargetTabs(aMessage, aSender);
        const groupTab = await groupTabs(tabs, { broadcast: true });
        return groupTab.apiTab;
      })();

    case TSTAPI.kGET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        return Promise.resolve(getTreeStructureFromTabs(tabs));
      })();

    case TSTAPI.kSET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPIGetTargetTabs(aMessage, aSender);
        await applyTreeStructureToTabs(tabs, aMessage.structure, {
          broadcast: true
        });
        return Promise.resolve(true);
      })();

    case TSTAPI.kADD_TAB_STATE:
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

    case TSTAPI.kREMOVE_TAB_STATE:
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

    case TSTAPI.kSCROLL_LOCK:
      gScrollLockedBy[aSender.id] = true;
      return Promise.resolve(true);

    case TSTAPI.kSCROLL_UNLOCK:
      delete gScrollLockedBy[aSender.id];
      return Promise.resolve(true);

    case TSTAPI.kBLOCK_GROUPING:
      gGroupingBlockedBy[aSender.id] = true;
      return Promise.resolve(true);

    case TSTAPI.kUNBLOCK_GROUPING:
      delete gGroupingBlockedBy[aSender.id];
      return Promise.resolve(true);
  }
}

async function TSTAPIGetTargetTabs(aMessage, aSender) {
  await Tabs.waitUntilAllTabsAreCreated();
  if (Array.isArray(aMessage.tabs))
    return TSTAPIGetTabsFromWrongIds(aMessage.tabs, aSender);
  if (aMessage.window || aMessage.windowId) {
    if (aMessage.tab == '*' ||
        aMessage.tabs == '*')
      return Tabs.getAllTabs(aMessage.window || aMessage.windowId);
    else
      return Tabs.getRootTabs(aMessage.window || aMessage.windowId);
  }
  if (aMessage.tab == '*' ||
      aMessage.tabs == '*') {
    let window = await browser.windows.getLastFocused({
      windowTypes: ['normal']
    });
    return Tabs.getAllTabs(window.id);
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
        return Tabs.getNextSiblingTab(Tabs.getTabById(tabs[0]));
      }
      case 'previoussibling':
      case 'prevsibling': {
        let tabs = tabsInActiveWindow.filter(aTab => aTab.active);
        return Tabs.getPreviousSiblingTab(Tabs.getTabById(tabs[0]));
      }
      case 'sendertab':
        if (aSender.tab)
          return aSender.tab;
      default:
        const tabFromUniqueId = Tabs.getTabByUniqueId(aId);
        return tabFromUniqueId || aId;
    }
  }));
  return tabOrAPITabOrIds.map(Tabs.getTabById).filter(aTab => !!aTab);
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
