/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  dumpTab,
  wait,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as TabsInternalOperation from '../common/tabs-internal-operation.js';
import * as TabsMove from '../common/tabs-move.js';
import * as TabsOpen from '../common/tabs-open.js';
import * as TabsGroup from '../common/tabs-group.js';
import * as TabsContainer from '../common/tabs-container.js';
import * as Tree from '../common/tree.js';
import * as TSTAPI from '../common/tst-api.js';


// this should return true if the tab is moved while processing
Tabs.onCreating.addListener((aTab, aInfo = {}) => {
  if (aInfo.duplicatedInternally)
    return true;

  log('Tabs.onCreating ', dumpTab(aTab), aInfo);

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
        return false;
      }
      else if (possibleOpenerTab != aTab) {
        aTab.dataset.possibleOpenerTab = possibleOpenerTab.id;
      }
      aTab.dataset.isNewTab = true;
    }
    log('behave as a tab opened with any URL');
    return true;
  }

  log('opener: ', dumpTab(opener), aInfo.maybeOpenedWithPosition);
  if (Tabs.isPinned(opener) &&
      opener.parentNode == aTab.parentNode) {
    if (configs.autoGroupNewTabsFromPinned) {
      return false;
    }
    if (configs.insertNewTabFromPinnedTabAt == Constants.kINSERT_END) {
      TabsMove.moveTabAfter(aTab, Tabs.getLastTab(aTab), {
        delayedMove: true,
        broadcast:   true
      });
    }
  }
  else if (!aInfo.maybeOrphan && configs.autoAttach) {
    Tree.behaveAutoAttachedTab(aTab, {
      baseTab:   opener,
      behavior:  configs.autoAttachOnOpenedWithOwner,
      dontMove:  aInfo.maybeOpenedWithPosition,
      broadcast: true
    });
    return false;
  }
  return true;
});

async function handleNewTabFromActiveTab(aTab, aParams = {}) {
  const activeTab = aParams.activeTab;
  log('handleNewTabFromActiveTab: activeTab = ', dumpTab(activeTab), aParams);
  await Tree.behaveAutoAttachedTab(aTab, {
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
  TabsInternalOperation.removeTab(aTab);
}

const gToBeGroupedTabSets = [];

function onNewTabsTimeout(aContainer) {
  const tabIds       = aContainer.dataset.openedNewTabs.split('|');
  const tabOpenerIds = aContainer.dataset.openedNewTabsOpeners.split('|');
  let tabReferences = tabIds.map((aId, aIndex) => {
    return {
      id:          aId,
      openerTabId: tabOpenerIds[aIndex]
    };
  });

  aContainer.dataset.openedNewTabs = '';
  aContainer.dataset.openedNewTabsOpeners = '';

  tabReferences = tabReferences.filter(aTabReference => aTabReference.id != '');
  if (tabReferences.length == 0 ||
      TSTAPI.isGroupingBlocked())
    return;

  gToBeGroupedTabSets.push(tabReferences);
  wait(0).then(tryGroupNewTabs);
}

async function tryGroupNewTabs() {
  if (tryGroupNewTabs.running)
    return;

  const tabReferences = gToBeGroupedTabSets.shift();
  if (!tabReferences)
    return;

  tryGroupNewTabs.running = true;
  try {
    // extract only pure new tabs
    let tabs = tabReferences.map(aTabReference => {
      const tab = Tabs.getTabById(aTabReference.id);
      if (aTabReference.openerTabId)
        tab.apiTab.openerTabId = parseInt(aTabReference.openerTabId); // restore the opener information
      return tab;
    });
    const uniqueIds = await Promise.all(tabs.map(aTab => aTab.uniqueId));
    tabs = tabs.filter((aId, aIndex) => {
      const uniqueId = uniqueIds[aIndex];
      return !uniqueId.duplicated && !uniqueId.restored;
    });
    tabs.sort((aA, aB) => aA.apiTab.index - aB.apiTab.index);

    let newRootTabs = Tabs.collectRootTabs(tabs)
      .filter(aTab => !Tabs.isGroupTab(aTab));
    if (newRootTabs.length <= 0)
      return;

    const newRootTabsFromPinned = newRootTabs.filter(aTab => Tabs.isPinned(Tabs.getOpenerTab(aTab)));
    if (newRootTabsFromPinned.length > 0) {
      newRootTabs = newRootTabs.filter(aTab => !newRootTabsFromPinned.includes(aTab));
      await tryGroupNewTabsFromPinnedOpener(newRootTabsFromPinned);
    }
    if (newRootTabs.length > 1 &&
        configs.autoGroupNewTabs)
      await TabsGroup.groupTabs(newRootTabs, { broadcast: true });
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
  for (const tab of aRootTabs) {
    const opener = Tabs.getOpenerTab(tab);
    if (!pinnedOpeners.includes(opener))
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
    if (aRootTabs.includes(aTab)) { // newly opened tab
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
    if (!pinnedOpeners.includes(opener))
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
      for (const tab of unifiedRootTabs.slice(0).reverse()) {
        if (!pinnedOpeners.includes(openerOf[tab.id]) ||
            Tabs.getGroupTabForOpener(openerOf[tab.id]))
          continue;
        // If there is not-yet grouped sibling, place next to it.
        const siblings = tab.parentNode.querySelectorAll(`${Tabs.kSELECTOR_NORMAL_TAB}[data-original-opener-tab-id="${tab.dataset.originalOpenerTabId}"]:not([data-already-grouped-for-pinned-opener])`);
        const referenceTab = siblings.length > 0 ? siblings[siblings.length - 1] : lastPinnedTab ;
        await Tree.moveTabSubtreeAfter(tab, Tabs.getLastDescendantTab(referenceTab) || referenceTab, {
          broadcast: true
        });
      }
      break;
    case Constants.kINSERT_END:
      for (const tab of unifiedRootTabs) {
        if (Tabs.getGroupTabForOpener(openerOf[tab.id]))
          continue;
        await Tree.moveTabSubtreeAfter(tab, Tabs.getLastTab(tab.parentNode), {
          broadcast: true
        });
      }
      break;
  }

  if (!configs.autoGroupNewTabsFromPinned)
    return false;

  // Finally, try to group opened tabs.
  const newGroupTabs = new Map();
  for (const opener of pinnedOpeners) {
    const children = childrenOfPinnedTabs[opener.id].sort((aA, aB) => aA.apiTab.index - aB.apiTab.index);
    log(`trying to group children of ${dumpTab(opener)}: `, children.map(dumpTab));
    let parent = Tabs.getGroupTabForOpener(opener);
    if (!parent) {
      const uri = TabsGroup.makeGroupTabURI({
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
    for (const child of children) {
      // Prevent the tab to be grouped again after it is ungrouped manually.
      child.dataset.alreadyGroupedForPinnedOpener = true;
      await Tree.attachTabTo(child, parent, {
        forceExpand: true, // this is required to avoid the group tab itself is focused from active tab in collapsed tree
        insertAfter: configs.insertNewChildAt == Constants.kINSERT_FIRST ? parent : Tabs.getLastDescendantTab(parent),
        broadcast: true
      });
    }
  }
  return true;
}

Tabs.onCreated.addListener((aTab, aInfo = {}) => {
  if (!aInfo.duplicated)
    return;
  const original = aInfo.originalTab;
  log('duplicated ', dumpTab(aTab), dumpTab(original));
  if (aInfo.duplicatedInternally) {
    log('duplicated by internal operation');
    aTab.classList.add(Constants.kTAB_STATE_DUPLICATING);
    Tabs.broadcastTabState(aTab, {
      add: [Constants.kTAB_STATE_DUPLICATING]
    });
  }
  else {
    Tree.behaveAutoAttachedTab(aTab, {
      baseTab:   original,
      behavior:  configs.autoAttachOnDuplicated,
      dontMove:  aInfo.openedWithPosition,
      broadcast: true
    });
  }
});

Tabs.onUpdated.addListener((aTab, aChangeInfo) => {
  if (configs.syncParentTabAndOpenerTab) {
    Tabs.waitUntilAllTabsAreCreated().then(() => {
      const parent = Tabs.getOpenerTab(aTab);
      if (!parent ||
          parent.parentNode != aTab.parentNode ||
          parent == Tabs.getParentTab(aTab))
        return;
      Tree.attachTabTo(aTab, parent, {
        insertAt:    Constants.kINSERT_NEAREST,
        forceExpand: Tabs.isActive(aTab),
        broadcast:   true
      });
    });
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
});


Tabs.onAttached.addListener(async (aTab, aInfo = {}) => {
  if (!aInfo.windowId ||
      !Tree.shouldApplyTreeBehavior(aInfo))
    return;

  log('Tabs.onAttached ', dumpTab(aTab), aInfo);

  log('descendants of attached tab: ', aInfo.descendants.map(dumpTab));
  const movedTabs = await Tree.moveTabs(aInfo.descendants, {
    destinationWindowId: aTab.apiTab.windowId,
    insertAfter:         aTab
  });
  log('moved descendants: ', movedTabs.map(dumpTab));
  for (const movedTab of movedTabs) {
    if (Tabs.getParentTab(movedTab))
      continue;
    Tree.attachTabTo(movedTab, aTab, {
      broadcast: true,
      dontMove:  true
    });
  }
});
