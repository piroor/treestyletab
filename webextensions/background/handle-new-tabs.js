/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab,
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

function log(...args) {
  if (configs.logFor['background/handle-new-tabs'])
    internalLogger(...args);
}


Tabs.onBeforeCreate.addListener(async (apiTab, info) => {
  const openerId = apiTab.openerTabId;
  const openerApiTab = openerId && (await browser.tabs.get(openerId));
  const container = Tabs.getTabsContainer(apiTab.windowId);
  if ((configs.autoGroupNewTabsFromPinned &&
       openerApiTab &&
       openerApiTab.pinned &&
       openerApiTab.windowId == apiTab.windowId) ||
      (configs.autoGroupNewTabs &&
       !openerApiTab &&
       !info.maybeOrphan)) {
    if (parseInt(container.dataset.preventAutoGroupNewTabsUntil) > Date.now()) {
      TabsContainer.incrementCounter(container, 'preventAutoGroupNewTabsUntil', configs.autoGroupNewTabsTimeout);
    }
    else {
      container.dataset.openedNewTabs += `|${apiTab.id}`;
      container.dataset.openedNewTabsOpeners += `|${openerApiTab && openerApiTab.id}`;
    }
  }
  if (container.openedNewTabsTimeout)
    clearTimeout(container.openedNewTabsTimeout);
  container.openedNewTabsTimeout = setTimeout(
    onNewTabsTimeout,
    configs.autoGroupNewTabsTimeout,
    container
  );
});


// this should return true if the tab is moved while processing
Tabs.onCreating.addListener((tab, info = {}) => {
  if (info.duplicatedInternally)
    return true;

  log('Tabs.onCreating ', dumpTab(tab), info);

  const possibleOpenerTab = info.activeTab || Tabs.getCurrentTab(tab);
  const opener = Tabs.getOpenerTab(tab);
  if (opener)
    opener.uniqueId.then(uniqueId => {
      tab.dataset.originalOpenerTabId = uniqueId.id;
    });

  if (!opener) {
    if (!info.maybeOrphan && possibleOpenerTab) {
      if (Tabs.isNewTabCommandTab(tab)) {
        log('behave as a tab opened by new tab command');
        handleNewTabFromActiveTab(tab, {
          possibleOpenerTab,
          autoAttachBehavior:        configs.autoAttachOnNewTabCommand,
          inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
        });
        return false;
      }
      else if (possibleOpenerTab != tab) {
        tab.dataset.possibleOpenerTab = possibleOpenerTab.id;
      }
      tab.dataset.isNewTab = true;
    }
    log('behave as a tab opened with any URL');
    return true;
  }

  log('opener: ', dumpTab(opener), info.maybeOpenedWithPosition);
  if (Tabs.isPinned(opener) &&
      opener.parentNode == tab.parentNode) {
    if (configs.autoGroupNewTabsFromPinned) {
      return false;
    }
    if (configs.insertNewTabFromPinnedTabAt == Constants.kINSERT_END) {
      TabsMove.moveTabAfter(tab, Tabs.getLastTab(tab), {
        delayedMove: true,
        broadcast:   true
      });
    }
  }
  else if (!info.maybeOrphan && configs.autoAttach) {
    Tree.behaveAutoAttachedTab(tab, {
      baseTab:   opener,
      behavior:  configs.autoAttachOnOpenedWithOwner,
      dontMove:  info.maybeOpenedWithPosition,
      broadcast: true
    });
    return false;
  }
  return true;
});

async function handleNewTabFromActiveTab(tab, params = {}) {
  const activeTab = params.activeTab;
  log('handleNewTabFromActiveTab: activeTab = ', dumpTab(activeTab), params);
  await Tree.behaveAutoAttachedTab(tab, {
    baseTab:   activeTab,
    behavior:  params.autoAttachBehavior,
    broadcast: true
  });
  const parent = Tabs.getParentTab(tab);
  if (!parent ||
      !params.inheritContextualIdentity ||
      tab.apiTab.cookieStoreId != 'firefox-default' ||
      tab.apiTab.cookieStoreId == parent.apiTab.cookieStoreId)
    return;
  const cookieStoreId = activeTab.apiTab.cookieStoreId;
  log('handleNewTabFromActiveTab: reopen with inherited contextual identity ', cookieStoreId);
  await TabsOpen.openNewTab({
    parent,
    insertBefore: tab,
    cookieStoreId
  });
  TabsInternalOperation.removeTab(tab);
}

const mToBeGroupedTabSets = [];

async function onNewTabsTimeout(container) {
  if (Tabs.hasCreatingTab())
    await Tabs.waitUntilAllTabsAreCreated();
  if (Tabs.hasMovingTab())
    await Tabs.waitUntilAllTabsAreMoved();

  const tabIds       = container.dataset.openedNewTabs.split('|').filter(part => part != '');
  const tabOpenerIds = container.dataset.openedNewTabsOpeners.split('|').filter(part => part != '');
  log('onNewTabsTimeout ', tabIds);
  let tabReferences = tabIds.map((id, index) => {
    return {
      id:          parseInt(id),
      openerTabId: parseInt(tabOpenerIds[index])
    };
  });

  container.dataset.openedNewTabs = '';
  container.dataset.openedNewTabsOpeners = '';

  tabReferences = tabReferences.filter(tabReference => tabReference.id != '');
  if (tabReferences.length == 0 ||
      TSTAPI.isGroupingBlocked())
    return;

  mToBeGroupedTabSets.push(tabReferences);
  tryGroupNewTabs();
}

async function tryGroupNewTabs() {
  if (tryGroupNewTabs.running)
    return;

  const tabReferences = mToBeGroupedTabSets.shift();
  if (!tabReferences)
    return;

  log('tryGroupNewTabs ', tabReferences);
  tryGroupNewTabs.running = true;
  try {
    // extract only pure new tabs
    let tabs = tabReferences.map(tabReference => {
      const tab = Tabs.getTabById(tabReference.id);
      if (tabReference.openerTabId)
        tab.apiTab.openerTabId = parseInt(tabReference.openerTabId); // restore the opener information
      return tab;
    });
    const uniqueIds = await Promise.all(tabs.map(tab => tab.uniqueId));
    tabs = tabs.filter((id, index) => {
      const uniqueId = uniqueIds[index];
      return !uniqueId.duplicated && !uniqueId.restored;
    });
    tabs.sort((aA, aB) => aA.apiTab.index - aB.apiTab.index);

    let newRootTabs = Tabs.collectRootTabs(tabs)
      .filter(tab => !Tabs.isGroupTab(tab));
    if (newRootTabs.length <= 0)
      return;

    const newRootTabsFromPinned = newRootTabs.filter(tab => Tabs.isPinned(Tabs.getOpenerTab(tab)));
    if (newRootTabsFromPinned.length > 0) {
      newRootTabs = newRootTabs.filter(tab => !newRootTabsFromPinned.includes(tab));
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
    if (mToBeGroupedTabSets.length > 0)
      tryGroupNewTabs();
  }
}

async function tryGroupNewTabsFromPinnedOpener(rootTabs) {
  log(`tryGroupNewTabsFromPinnedOpener: ${rootTabs.length} root tabs are opened from pinned tabs`);

  // First, collect pinned opener tabs.
  let pinnedOpeners = [];
  const childrenOfPinnedTabs = {};
  for (const tab of rootTabs) {
    const opener = Tabs.getOpenerTab(tab);
    if (!pinnedOpeners.includes(opener))
      pinnedOpeners.push(opener);
  }
  log('pinnedOpeners ', pinnedOpeners.map(dumpTab));

  // Second, collect tabs opened from pinned openers including existing tabs
  // (which were left ungrouped in previous process).
  const openerOf = {};
  const unifiedRootTabs = Tabs.getAllTabs(rootTabs[0]).filter(tab => {
    if (Tabs.getParentTab(tab) ||
        tab.dataset.alreadyGroupedForPinnedOpener)
      return false;
    if (rootTabs.includes(tab)) { // newly opened tab
      const opener = Tabs.getOpenerTab(tab);
      if (!opener)
        return false;
      openerOf[tab.id] = opener;
      const tabs = childrenOfPinnedTabs[opener.id] || [];
      childrenOfPinnedTabs[opener.id] = tabs.concat([tab]);
      return true;
    }
    const opener = Tabs.getTabByUniqueId(tab.dataset.originalOpenerTabId);
    if (!Tabs.isPinned(opener))
      return false;
    // existing and not yet grouped tab
    if (!pinnedOpeners.includes(opener))
      pinnedOpeners.push(opener);
    openerOf[tab.id] = opener;
    const tabs = childrenOfPinnedTabs[opener.id] || [];
    childrenOfPinnedTabs[opener.id] = tabs.concat([tab]);
    return true;
  });

  // Ignore pinned openeres which has no child tab to be grouped.
  pinnedOpeners = pinnedOpeners.filter(opener => {
    return childrenOfPinnedTabs[opener.id].length > 1 || Tabs.getGroupTabForOpener(opener);
  });
  log(' => ', pinnedOpeners.map(dumpTab));

  // Move newly opened tabs to expected position before grouping!
  switch (configs.insertNewTabFromPinnedTabAt) {
    case Constants.kINSERT_FIRST:
      const allPinnedTabs = Tabs.getPinnedTabs(rootTabs[0].parentNode);
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

Tabs.onCreated.addListener((tab, info = {}) => {
  if (!info.duplicated)
    return;
  const original = info.originalTab;
  log('duplicated ', dumpTab(tab), dumpTab(original));
  if (info.duplicatedInternally) {
    log('duplicated by internal operation');
    tab.classList.add(Constants.kTAB_STATE_DUPLICATING);
    Tabs.broadcastTabState(tab, {
      add: [Constants.kTAB_STATE_DUPLICATING]
    });
  }
  else {
    Tree.behaveAutoAttachedTab(tab, {
      baseTab:   original,
      behavior:  configs.autoAttachOnDuplicated,
      dontMove:  info.openedWithPosition,
      broadcast: true
    });
  }
});

Tabs.onUpdated.addListener((tab, changeInfo) => {
  if (configs.syncParentTabAndOpenerTab) {
    Tabs.waitUntilAllTabsAreCreated().then(() => {
      const parent = Tabs.getOpenerTab(tab);
      if (!parent ||
          parent.parentNode != tab.parentNode ||
          parent == Tabs.getParentTab(tab))
        return;
      Tree.attachTabTo(tab, parent, {
        insertAt:    Constants.kINSERT_NEAREST,
        forceExpand: Tabs.isActive(tab),
        broadcast:   true
      });
    });
  }

  if (tab.dataset.isNewTab &&
      (changeInfo.url || changeInfo.status == 'complete')) {
    log('new tab ', dumpTab(tab));
    delete tab.dataset.isNewTab;
    const possibleOpenerTab = Tabs.getTabById(tab.dataset.possibleOpenerTab);
    delete tab.dataset.possibleOpenerTab;
    log('possibleOpenerTab ', dumpTab(possibleOpenerTab));
    const toBeGroupedTabs = (tab.parentNode.dataset.openedNewTabs || '')
      .split('|')
      .map(id => Tabs.getTabById(parseInt(id)))
      .filter(tab => !!tab);
    log('toBeGroupedTabs ', toBeGroupedTabs.map(dumpTab));
    if (!Tabs.getParentTab(tab) &&
        possibleOpenerTab &&
        !toBeGroupedTabs.includes(tab)) {
      if (Tabs.isNewTabCommandTab(tab)) {
        log('behave as a tab opened by new tab command (delayed)');
        handleNewTabFromActiveTab(tab, {
          activeTab:                 possibleOpenerTab,
          autoAttachBehavior:        configs.autoAttachOnNewTabCommand,
          inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
        });
      }
      else {
        const siteMatcher  = /^\w+:\/\/([^\/]+)(?:$|\/.*$)/;
        const openerTabSite = possibleOpenerTab.apiTab.url.match(siteMatcher);
        const newTabSite    = tab.apiTab.url.match(siteMatcher);
        if (openerTabSite && newTabSite && openerTabSite[1] == newTabSite[1]) {
          log('behave as a tab opened from same site (delayed)');
          handleNewTabFromActiveTab(tab, {
            activeTab:                 possibleOpenerTab,
            autoAttachBehavior:        configs.autoAttachSameSiteOrphan,
            inheritContextualIdentity: configs.inheritContextualIdentityToSameSiteOrphan
          });
        }
      }
    }
  }
});


Tabs.onAttached.addListener(async (tab, info = {}) => {
  if (!info.windowId ||
      !Tree.shouldApplyTreeBehavior(info))
    return;

  log('Tabs.onAttached ', dumpTab(tab), info);

  log('descendants of attached tab: ', info.descendants.map(dumpTab));
  const movedTabs = await Tree.moveTabs(info.descendants, {
    destinationWindowId: tab.apiTab.windowId,
    insertAfter:         tab
  });
  log('moved descendants: ', movedTabs.map(dumpTab));
  for (const movedTab of movedTabs) {
    if (Tabs.getParentTab(movedTab))
      continue;
    Tree.attachTabTo(movedTab, tab, {
      broadcast: true,
      dontMove:  true
    });
  }
});
