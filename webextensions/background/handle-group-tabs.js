/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import TabFavIconHelper from '../extlib/TabFavIconHelper.js';

import {
  log as internalLogger,
  dumpTab,
  wait,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as ApiTabs from '../common/api-tabs.js';
import * as Tabs from '../common/tabs.js';
import * as TabsOpen from '../common/tabs-open.js';
import * as TabsGroup from '../common/tabs-group.js';
import * as TabsInternalOperation from '../common/tabs-internal-operation.js';
import * as TabsContainer from '../common/tabs-container.js';
import * as Tree from '../common/tree.js';
import * as TSTAPI from '../common/tst-api.js';

function log(...args) {
  if (configs.logFor['background/handle-group-tabs'])
    internalLogger(...args);
}

// ====================================================================
// init/update group tabs
// ====================================================================

/*
  To prevent the tab is closed by Firefox, we need to inject scripts dynamically.
  See also: https://github.com/piroor/treestyletab/issues/1670#issuecomment-350964087
*/
export async function tryInitGroupTab(tab) {
  if (!Tabs.isGroupTab(tab) &&
      tab.apiTab.url.indexOf(Constants.kGROUP_TAB_URI) != 0)
    return;
  const scriptOptions = {
    runAt:           'document_start',
    matchAboutBlank: true
  };
  try {
    const initialized = await browser.tabs.executeScript(tab.apiTab.id, Object.assign({}, scriptOptions, {
      code:  'window.initialized',
    }));
    if (initialized[0])
      return;
  }
  catch(_e) {
  }
  try {
    const titleElementExists = await browser.tabs.executeScript(tab.apiTab.id, Object.assign({}, scriptOptions, {
      code:  '!!document.querySelector("#title")',
    }));
    if (!titleElementExists[0] && tab.status == 'complete') // we need to load resources/group-tab.html at first.
      return browser.tabs.update(tab.apiTab.id, { url: tab.apiTab.url });
  }
  catch(_e) {
  }
  browser.tabs.executeScript(tab.apiTab.id, Object.assign({}, scriptOptions, {
    //file:  '/common/l10n.js'
    file:  '/extlib/l10n-classic.js' // ES module does not supported as a content script...
  }));
  browser.tabs.executeScript(tab.apiTab.id, Object.assign({}, scriptOptions, {
    file:  '/resources/group-tab.js'
  }));
}

export function reserveToCleanupNeedlessGroupTab(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!Tabs.ensureLivingTab(tab))
      continue;
    if (tab.reservedCleanupNeedlessGroupTab)
      clearTimeout(tab.reservedCleanupNeedlessGroupTab);
    tab.reservedCleanupNeedlessGroupTab = setTimeout(() => {
      delete tab.reservedCleanupNeedlessGroupTab;
      cleanupNeedlssGroupTab(tab);
    }, 100);
  }
}

function cleanupNeedlssGroupTab(tabs) {
  if (!Array.isArray(tabs))
    tabs = [tabs];
  log('trying to clanup needless temporary group tabs from ', tabs.map(dumpTab));
  const tabsToBeRemoved = [];
  for (const tab of tabs) {
    if (!Tabs.isTemporaryGroupTab(tab))
      break;
    if (Tabs.getChildTabs(tab).length > 1)
      break;
    const lastChild = Tabs.getFirstChildTab(tab);
    if (lastChild && !Tabs.isTemporaryGroupTab(lastChild))
      break;
    tabsToBeRemoved.push(tab);
  }
  log('=> to be removed: ', tabsToBeRemoved.map(dumpTab));
  TabsInternalOperation.removeTabs(tabsToBeRemoved);
}

export function reserveToUpdateRelatedGroupTabs(tab, changedInfo) {
  const ancestorGroupTabs = [tab]
    .concat(Tabs.getAncestorTabs(tab))
    .filter(Tabs.isGroupTab);
  for (const tab of ancestorGroupTabs) {
    if (tab.reservedUpdateRelatedGroupTab)
      clearTimeout(tab.reservedUpdateRelatedGroupTab);
    tab.reservedUpdateRelatedGroupTabChangedInfo = tab.reservedUpdateRelatedGroupTabChangedInfo || new Set();
    for (const info of changedInfo) {
      tab.reservedUpdateRelatedGroupTabChangedInfo.add(info);
    }
    tab.reservedUpdateRelatedGroupTab = setTimeout(() => {
      delete tab.reservedUpdateRelatedGroupTab;
      updateRelatedGroupTab(tab, Array.from(tab.reservedUpdateRelatedGroupTabChangedInfo));
      delete tab.reservedUpdateRelatedGroupTabChangedInfo;
    }, 100);
  }
}

async function updateRelatedGroupTab(groupTab, changedInfo = []) {
  if (!Tabs.ensureLivingTab(groupTab))
    return;

  await tryInitGroupTab(groupTab);
  if (changedInfo.includes('tree'))
    await browser.tabs.executeScript(groupTab.apiTab.id, {
      runAt:           'document_start',
      matchAboutBlank: true,
      code:            `window.updateTree()`,
    });

  if (changedInfo.includes('title')) {
    let newTitle;
    if (Constants.kGROUP_TAB_DEFAULT_TITLE_MATCHER.test(groupTab.apiTab.title)) {
      const firstChild = Tabs.getFirstChildTab(groupTab);
      newTitle = browser.i18n.getMessage('groupTab_label', firstChild.apiTab.title);
    }
    else if (Constants.kGROUP_TAB_FROM_PINNED_DEFAULT_TITLE_MATCHER.test(groupTab.apiTab.title)) {
      const opener = Tabs.getOpenerFromGroupTab(groupTab);
      if (opener) {
        if (opener &&
            (opener.apiTab.favIconUrl ||
             TabFavIconHelper.maybeImageTab(opener.apiTab))) {
          browser.runtime.sendMessage({
            type:       Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED,
            tab:        groupTab.id,
            favIconUrl: Tabs.getSafeFaviconUrl(opener.apiTab.favIconUrl || opener.apiTab.url)
          });
        }
        newTitle = browser.i18n.getMessage('groupTab_fromPinnedTab_label', opener.apiTab.title);
      }
    }

    if (newTitle && groupTab.apiTab.title != newTitle) {
      browser.tabs.executeScript(groupTab.apiTab.id, {
        runAt:           'document_start',
        matchAboutBlank: true,
        code:            `window.setTitle(${JSON.stringify(newTitle)})`,
      });
    }
  }
}

Tabs.onRemoved.addListener(async (tab, _closeInfo = {}) => {
  const ancestors = Tabs.getAncestorTabs(tab);
  wait(0).then(() => {
    reserveToCleanupNeedlessGroupTab(ancestors);
  });
});

Tabs.onUpdated.addListener((tab, changeInfo) => {
  if (tab &&
      tab.apiTab &&
      tab.apiTab.status == 'complete' &&
      tab.apiTab.url.indexOf(Constants.kGROUP_TAB_URI) != 0 &&
      !Constants.kSHORTHAND_ABOUT_URI.test(tab.apiTab.url)) {
    Tabs.getSpecialTabState(tab).then(async (states) => {
      if (tab.apiTab.url.indexOf(Constants.kGROUP_TAB_URI) == 0)
        return;
      // Detect group tab from different session - which can have different UUID for the URL.
      const PREFIX_REMOVER = /^moz-extension:\/\/[^\/]+/;
      const pathPart = tab.apiTab.url.replace(PREFIX_REMOVER, '');
      if (states.includes(Constants.kTAB_STATE_GROUP_TAB) &&
          pathPart.split('?')[0] == Constants.kGROUP_TAB_URI.replace(PREFIX_REMOVER, '')) {
        const parameters = pathPart.replace(/^[^\?]+\?/, '');
        await wait(100); // for safety
        browser.tabs.update(tab.apiTab.id, {
          url: `${Constants.kGROUP_TAB_URI}?${parameters}`
        }).catch(ApiTabs.handleMissingTabError);
        tab.classList.add(Constants.kTAB_STATE_GROUP_TAB);
      }
      else {
        Tabs.removeSpecialTabState(tab, Constants.kTAB_STATE_GROUP_TAB);
        tab.classList.remove(Constants.kTAB_STATE_GROUP_TAB);
      }
    });
  }

  if (changeInfo.status || changeInfo.url)
    tryInitGroupTab(tab);

  const group = Tabs.getGroupTabForOpener(tab);
  if (group)
    reserveToUpdateRelatedGroupTabs(group, ['title', 'tree']);
});

Tabs.onGroupTabDetected.addListener(tab => {
  tryInitGroupTab(tab);
});

Tabs.onLabelUpdated.addListener(tab => {
  reserveToUpdateRelatedGroupTabs(tab, ['title', 'tree']);
});

Tabs.onActivating.addListener((tab, _info = {}) => {
  tryInitGroupTab(tab);
});

Tree.onAttached.addListener((tab, _info = {}) => {
  reserveToUpdateRelatedGroupTabs(tab, ['tree']);
});

Tree.onDetached.addListener((_tab, detachInfo) => {
  if (Tabs.isGroupTab(detachInfo.oldParentTab))
    reserveToCleanupNeedlessGroupTab(detachInfo.oldParentTab);
  reserveToUpdateRelatedGroupTabs(detachInfo.oldParentTab, ['tree']);
});

/*
Tree.onSubtreeCollapsedStateChanging.addListener((tab, _info) => { 
  reserveToUpdateRelatedGroupTabs(tab);
});
*/


// ====================================================================
// auto-grouping of tabs
// ====================================================================

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
