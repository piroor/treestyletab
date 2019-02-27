/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsOpen from '/common/tabs-open.js';
import * as TabsGroup from '/common/tabs-group.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as Tree from '/common/tree.js';
import * as TSTAPI from '/common/tst-api.js';

import Tab from '/common/Tab.js';

function log(...args) {
  internalLogger('background/handle-group-tabs', ...args);
}

// ====================================================================
// init/update group tabs
// ====================================================================

/*
  To prevent the tab is closed by Firefox, we need to inject scripts dynamically.
  See also: https://github.com/piroor/treestyletab/issues/1670#issuecomment-350964087
*/
export async function tryInitGroupTab(tab) {
  if (!tab.$TST.isGroupTab &&
      tab.url.indexOf(Constants.kGROUP_TAB_URI) != 0)
    return;
  const scriptOptions = {
    runAt:           'document_start',
    matchAboutBlank: true
  };
  try {
    const initialized = await browser.tabs.executeScript(tab.id, Object.assign({}, scriptOptions, {
      code:  'window.initialized',
    })).catch(ApiTabs.handleMissingTabError);
    if (initialized[0])
      return;
  }
  catch(_e) {
  }
  try {
    const titleElementExists = await browser.tabs.executeScript(tab.id, Object.assign({}, scriptOptions, {
      code:  '!!document.querySelector("#title")',
    })).catch(ApiTabs.handleMissingTabError);
    if (!titleElementExists[0] && tab.status == 'complete') // we need to load resources/group-tab.html at first.
      return browser.tabs.update(tab.id, { url: tab.url });
  }
  catch(_e) {
  }
  browser.tabs.executeScript(tab.id, Object.assign({}, scriptOptions, {
    //file:  '/common/l10n.js'
    file:  '/extlib/l10n-classic.js' // ES module does not supported as a content script...
  })).catch(ApiTabs.handleMissingTabError);
  browser.tabs.executeScript(tab.id, Object.assign({}, scriptOptions, {
    file:  '/resources/group-tab.js'
  })).catch(ApiTabs.handleMissingTabError);
}

export function reserveToCleanupNeedlessGroupTab(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!TabsStore.ensureLivingTab(tab))
      continue;
    if (tab.$TST.reservedCleanupNeedlessGroupTab)
      clearTimeout(tab.$TST.reservedCleanupNeedlessGroupTab);
    tab.$TST.reservedCleanupNeedlessGroupTab = setTimeout(() => {
      if (!tab.$TST)
        return;
      delete tab.$TST.reservedCleanupNeedlessGroupTab;
      cleanupNeedlssGroupTab(tab);
    }, 100);
  }
}

function cleanupNeedlssGroupTab(tabs) {
  if (!Array.isArray(tabs))
    tabs = [tabs];
  log('trying to clanup needless temporary group tabs from ', tabs.map(tab => tab.id));
  const tabsToBeRemoved = [];
  for (const tab of tabs) {
    if (!tab.$TST.isTemporaryGroupTab)
      break;
    if (tab.$TST.childIds.length > 1)
      break;
    const lastChild = tab.$TST.firstChild;
    if (lastChild && !lastChild.$TST.isTemporaryGroupTab)
      break;
    tabsToBeRemoved.push(tab);
  }
  log('=> to be removed: ', tabsToBeRemoved.map(tab => tab.id));
  TabsInternalOperation.removeTabs(tabsToBeRemoved);
}

export function reserveToUpdateRelatedGroupTabs(tab, changedInfo) {
  const ancestorGroupTabs = [tab]
    .concat(tab.$TST.ancestors)
    .filter(tab => tab.$TST.isGroupTab);
  for (const tab of ancestorGroupTabs) {
    if (tab.$TST.reservedUpdateRelatedGroupTab)
      clearTimeout(tab.$TST.reservedUpdateRelatedGroupTab);
    tab.$TST.reservedUpdateRelatedGroupTabChangedInfo = tab.$TST.reservedUpdateRelatedGroupTabChangedInfo || new Set();
    for (const info of changedInfo) {
      tab.$TST.reservedUpdateRelatedGroupTabChangedInfo.add(info);
    }
    tab.$TST.reservedUpdateRelatedGroupTab = setTimeout(() => {
      if (!tab.$TST)
        return;
      delete tab.$TST.reservedUpdateRelatedGroupTab;
      updateRelatedGroupTab(tab, Array.from(tab.$TST.reservedUpdateRelatedGroupTabChangedInfo));
      delete tab.$TST.reservedUpdateRelatedGroupTabChangedInfo;
    }, 100);
  }
}

async function updateRelatedGroupTab(groupTab, changedInfo = []) {
  if (!TabsStore.ensureLivingTab(groupTab))
    return;

  await tryInitGroupTab(groupTab);
  if (changedInfo.includes('tree'))
    await browser.tabs.executeScript(groupTab.id, {
      runAt:           'document_start',
      matchAboutBlank: true,
      code:            `window.updateTree()`,
    }).catch(ApiTabs.handleMissingTabError);

  if (changedInfo.includes('title')) {
    let newTitle;
    if (Constants.kGROUP_TAB_DEFAULT_TITLE_MATCHER.test(groupTab.title)) {
      const firstChild = groupTab.$TST.firstChild;
      newTitle = browser.i18n.getMessage('groupTab_label', firstChild.title);
    }
    else if (Constants.kGROUP_TAB_FROM_PINNED_DEFAULT_TITLE_MATCHER.test(groupTab.title)) {
      const opener = groupTab.$TST.opener;
      if (opener) {
        if (opener &&
            opener.favIconUrl) {
          browser.runtime.sendMessage({
            type:       Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED,
            tab:        groupTab.id,
            favIconUrl: opener.favIconUrl
          });
        }
        newTitle = browser.i18n.getMessage('groupTab_fromPinnedTab_label', opener.title);
      }
    }

    if (newTitle && groupTab.title != newTitle) {
      browser.tabs.executeScript(groupTab.id, {
        runAt:           'document_start',
        matchAboutBlank: true,
        code:            `window.setTitle(${JSON.stringify(newTitle)})`,
      }).catch(ApiTabs.handleMissingTabError);
    }
  }
}

Tab.onRemoved.addListener((tab, _closeInfo = {}) => {
  const ancestors = tab.$TST.ancestors;
  wait(0).then(() => {
    reserveToCleanupNeedlessGroupTab(ancestors);
  });
});

Tab.onUpdated.addListener((tab, changeInfo) => {
  if ('url' in changeInfo ||
      'previousUrl' in changeInfo ||
      'state' in changeInfo) {
    const status = changeInfo.status || tab && tab.status;
    const url = changeInfo.url ? changeInfo.url :
      status == 'complete' && tab ? tab.url : '';
    if (tab &&
        status == 'complete') {
      if (url.indexOf(Constants.kGROUP_TAB_URI) == 0) {
        tab.$TST.addState(Constants.kTAB_STATE_GROUP_TAB, { permanently: true });
      }
      else if (!Constants.kSHORTHAND_ABOUT_URI.test(url)) {
        tab.$TST.getPermanentStates().then(async (states) => {
          if (url.indexOf(Constants.kGROUP_TAB_URI) == 0)
            return;
          // Detect group tab from different session - which can have different UUID for the URL.
          const PREFIX_REMOVER = /^moz-extension:\/\/[^\/]+/;
          const pathPart = url.replace(PREFIX_REMOVER, '');
          if (states.includes(Constants.kTAB_STATE_GROUP_TAB) &&
              pathPart.split('?')[0] == Constants.kGROUP_TAB_URI.replace(PREFIX_REMOVER, '')) {
            const parameters = pathPart.replace(/^[^\?]+\?/, '');
            const oldUrl = tab.url;
            await wait(100); // for safety
            if (tab.url != oldUrl)
              return;
            browser.tabs.update(tab.id, {
              url: `${Constants.kGROUP_TAB_URI}?${parameters}`
            }).catch(ApiTabs.handleMissingTabError);
            tab.$TST.addState(Constants.kTAB_STATE_GROUP_TAB);
          }
          else {
            tab.$TST.removeState(Constants.kTAB_STATE_GROUP_TAB, { permanently: true });
          }
        });
      }
    }
    // restored tab can be replaced with blank tab. we need to restore it manually.
    else if (changeInfo.url == 'about:blank' &&
             changeInfo.previousUrl &&
             changeInfo.previousUrl.indexOf(Constants.kGROUP_TAB_URI) == 0) {
      const oldUrl = tab.url;
      wait(100).then(() => { // redirect with delay to avoid infinite loop of recursive redirections.
        if (tab.url != oldUrl)
          return;
        browser.tabs.update(tab.id, {
          url: changeInfo.previousUrl
        }).catch(ApiTabs.handleMissingTabError);
        tab.$TST.addState(Constants.kTAB_STATE_GROUP_TAB, { permanently: true });
      });
    }

    if (changeInfo.status ||
        changeInfo.url ||
        url.indexOf(Constants.kGROUP_TAB_URI) == 0)
      tryInitGroupTab(tab);
  }

  if ('title' in changeInfo) {
    const group = Tab.getGroupTabForOpener(tab);
    if (group)
      reserveToUpdateRelatedGroupTabs(group, ['title', 'tree']);
  }
});

Tab.onGroupTabDetected.addListener(tab => {
  tryInitGroupTab(tab);
});

Tab.onLabelUpdated.addListener(tab => {
  reserveToUpdateRelatedGroupTabs(tab, ['title', 'tree']);
});

Tab.onActivating.addListener((tab, _info = {}) => {
  tryInitGroupTab(tab);
});

Tree.onAttached.addListener((tab, _info = {}) => {
  reserveToUpdateRelatedGroupTabs(tab, ['tree']);
});

Tree.onDetached.addListener((_tab, detachInfo) => {
  if (detachInfo.oldParentTab &&
      detachInfo.oldParentTab.$TST.isGroupTab)
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

Tab.onBeforeCreate.addListener(async (tab, info) => {
  const window  = TabsStore.windows.get(tab.windowId);
  if (!window)
    return;

  const openerId  = tab.openerTabId;
  const openerTab = openerId && (await browser.tabs.get(openerId).catch(ApiTabs.handleMissingTabError));
  if ((configs.autoGroupNewTabsFromPinned &&
       openerTab &&
       openerTab.pinned &&
       openerTab.windowId == tab.windowId) ||
      (configs.autoGroupNewTabs &&
       !openerTab &&
       !info.maybeOrphan)) {
    if (window.preventAutoGroupNewTabsUntil > Date.now()) {
      window.preventAutoGroupNewTabsUntil += configs.autoGroupNewTabsTimeout;
    }
    else {
      window.openedNewTabs.push({
        id:       tab.id,
        openerId: openerTab && openerTab.id
      });
    }
  }
  if (window.openedNewTabsTimeout)
    clearTimeout(window.openedNewTabsTimeout);
  window.openedNewTabsTimeout = setTimeout(
    onNewTabsTimeout,
    configs.autoGroupNewTabsTimeout,
    window
  );
});

const mToBeGroupedTabSets = [];

async function onNewTabsTimeout(window) {
  if (TabsStore.hasCreatingTab(window.id))
    await TabsStore.waitUntilAllTabsAreCreated(window.id);
  if (TabsStore.hasMovingTab(window.id))
    await TabsStore.waitUntilAllTabsAreMoved(window.id);

  let tabReferences = window.openedNewTabs;
  log('onNewTabsTimeout ', tabReferences);

  window.openedNewTabs = [];

  tabReferences = tabReferences.filter(tabReference => !!tabReference.id);
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
      const tab = Tab.get(tabReference.id);
      if (tabReference.openerTabId)
        tab.openerTabId = parseInt(tabReference.openerTabId); // restore the opener information
      return tab;
    });
    const uniqueIds = tabs.map(tab => tab.$TST.uniqueId);
    tabs = tabs.filter((id, index) => {
      const uniqueId = uniqueIds[index];
      return !uniqueId.duplicated && !uniqueId.restored;
    });
    Tab.sort(tabs);

    let newRootTabs = Tab.collectRootTabs(tabs)
      .filter(tab => !tab.$TST.isGroupTab);
    if (newRootTabs.length <= 0)
      return;

    const newRootTabsFromPinned = newRootTabs.filter(tab => tab.$TST.hasPinnedOpener);
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
    const opener = tab.$TST.opener;
    if (!pinnedOpeners.includes(opener))
      pinnedOpeners.push(opener);
  }
  log('pinnedOpeners ', pinnedOpeners.map(tab => tab.id));

  // Second, collect tabs opened from pinned openers including existing tabs
  // (which were left ungrouped in previous process).
  const openerOf = {};
  const unifiedRootTabs = Tab.getAllTabs(rootTabs[0].windowId).filter(tab => {
    if (tab.$TST.parent ||
        tab.$TST.getAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER))
      return false;
    if (rootTabs.includes(tab)) { // newly opened tab
      const opener = tab.$TST.opener;
      if (!opener)
        return false;
      openerOf[tab.id] = opener;
      const tabs = childrenOfPinnedTabs[opener.id] || [];
      childrenOfPinnedTabs[opener.id] = tabs.concat([tab]);
      return true;
    }
    const opener = Tab.getByUniqueId(tab.$TST.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID));
    if (!opener.pinned)
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
    return childrenOfPinnedTabs[opener.id].length > 1 || Tab.getGroupTabForOpener(opener);
  });
  log(' => ', pinnedOpeners.map(tab => tab.id));

  // Move newly opened tabs to expected position before grouping!
  switch (configs.insertNewTabFromPinnedTabAt) {
    case Constants.kINSERT_FIRST:
      const allPinnedTabs = Tab.getPinnedTabs(rootTabs[0].windowId);
      const lastPinnedTab = allPinnedTabs[allPinnedTabs.length - 1];
      for (const tab of rootTabs.slice(0).reverse()) {
        if (!pinnedOpeners.includes(openerOf[tab.id]) ||
            Tab.getGroupTabForOpener(openerOf[tab.id]))
          continue;
        // If there is not-yet grouped sibling, place next to it.
        const siblings = TabsStore.queryAll({
          windowId:   tab.windowId,
          normal:     true,
          '!id':      tab.id,
          attributes: [
            Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID, tab.$TST.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID),
            Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER, ''
          ]
        });
        const referenceTab = siblings.length > 0 ? siblings[siblings.length - 1] : lastPinnedTab ;
        await Tree.moveTabSubtreeAfter(tab, (referenceTab && referenceTab.$TST.lastDescendant || referenceTab), {
          broadcast: true
        });
      }
      break;
    case Constants.kINSERT_END:
      for (const tab of unifiedRootTabs) {
        if (Tab.getGroupTabForOpener(openerOf[tab.id]))
          continue;
        await Tree.moveTabSubtreeAfter(tab, Tab.getLastTab(tab.windowId), {
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
    const children = childrenOfPinnedTabs[opener.id].sort((a, b) => a.index - b.index);
    log(`trying to group children of ${opener.id}: `, children.map(child => child.id));
    let parent = Tab.getGroupTabForOpener(opener);
    if (!parent) {
      const uri = TabsGroup.makeGroupTabURI({
        title:       browser.i18n.getMessage('groupTab_fromPinnedTab_label', opener.title),
        temporary:   true,
        openerTabId: opener.$TST.getAttribute(Constants.kPERSISTENT_ID)
      });
      parent = await TabsOpen.openURIInTab(uri, {
        windowId:     opener.windowId,
        insertBefore: children[0],
        cookieStoreId: opener.cookieStoreId,
        inBackground: true
      });
      log('opened group tab: ', parent);
      newGroupTabs.set(opener, true);
    }
    for (const child of children) {
      // Prevent the tab to be grouped again after it is ungrouped manually.
      child.$TST.setAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER, true);
      await Tree.attachTabTo(child, parent, {
        forceExpand: true, // this is required to avoid the group tab itself is active from active tab in collapsed tree
        insertAfter: configs.insertNewChildAt == Constants.kINSERT_FIRST ? parent : parent.$TST.lastDescendant,
        broadcast:   true
      });
    }
  }
  return true;
}
