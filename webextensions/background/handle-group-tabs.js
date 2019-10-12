/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/extlib/RichConfirm.js';

import {
  log as internalLogger,
  dumpTab,
  wait,
  mapAndFilter,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TSTAPI from '/common/tst-api.js';
import * as SidebarConnection from '/common/sidebar-connection.js';
import * as Permissions from '/common/permissions.js';
import * as TreeBehavior from '/common/tree-behavior.js';

import Tab from '/common/Tab.js';

import * as TabsGroup from './tabs-group.js';
import * as TabsOpen from './tabs-open.js';
import * as Tree from './tree.js';

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
    })).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
    if (initialized[0])
      return;
  }
  catch(_e) {
  }
  try {
    const titleElementExists = await browser.tabs.executeScript(tab.id, Object.assign({}, scriptOptions, {
      code:  '!!document.querySelector("#title")',
    })).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
    if (!titleElementExists[0] && tab.status == 'complete') // we need to load resources/group-tab.html at first.
      return browser.tabs.update(tab.id, { url: tab.url }).catch(ApiTabs.createErrorSuppressor());
  }
  catch(_e) {
  }
  browser.tabs.executeScript(tab.id, Object.assign({}, scriptOptions, {
    //file:  '/common/l10n.js'
    file:  '/extlib/l10n-classic.js' // ES module does not supported as a content script...
  })).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
  browser.tabs.executeScript(tab.id, Object.assign({}, scriptOptions, {
    file:  '/resources/group-tab.js'
  })).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));

  if (tab.$TST.states.has(Constants.kTAB_STATE_UNREAD)) {
    tab.$TST.removeState(Constants.kTAB_STATE_UNREAD, { permanently: true });
    SidebarConnection.sendMessage({
      type:     Constants.kCOMMAND_NOTIFY_TAB_UPDATED,
      windowId: tab.windowId,
      tabId:    tab.id,
      removedStates: [Constants.kTAB_STATE_UNREAD]
    });
  }
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
      code:            `window.updateTree && window.updateTree()`,
    }).catch(ApiTabs.createErrorSuppressor(ApiTabs.handleMissingTabError, ApiTabs.handleUnloadedError));

  const firstChild = groupTab.$TST.firstChild;
  if (!firstChild) // the tab can be closed while waiting...
    return;

  if (changedInfo.includes('title')) {
    let newTitle;
    if (Constants.kGROUP_TAB_DEFAULT_TITLE_MATCHER.test(groupTab.title)) {
      newTitle = browser.i18n.getMessage('groupTab_label', firstChild.title);
    }
    else if (Constants.kGROUP_TAB_FROM_PINNED_DEFAULT_TITLE_MATCHER.test(groupTab.title)) {
      const opener = groupTab.$TST.openerTab;
      if (opener) {
        if (opener &&
            opener.favIconUrl) {
          SidebarConnection.sendMessage({
            type:       Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED,
            windowId:   groupTab.windowId,
            tabId:      groupTab.id,
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
        code:            `window.setTitle && window.setTitle(${JSON.stringify(newTitle)})`,
      }).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
    }
  }
}

Tab.onRemoved.addListener((tab, _closeInfo = {}) => {
  const ancestors = tab.$TST.ancestors;
  wait(0).then(() => {
    TabsGroup.reserveToCleanupNeedlessGroupTab(ancestors);
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
            }).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
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
        }).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
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

Tab.onPinned.addListener(tab => {
  Tree.collapseExpandSubtree(tab, {
    collapsed: false,
    broadcast: true
  });
  const children = tab.$TST.children;
  Tree.detachAllChildren(tab, {
    behavior: TreeBehavior.getCloseParentBehaviorForTabWithSidebarOpenState(tab, {
      applyTreeBehavior: true
    }),
    broadcast: true
  });
  Tree.detachTab(tab, {
    broadcast: true
  });

  if (configs.autoGroupNewTabsFromPinned)
    TabsGroup.groupTabs(children, {
      title:       browser.i18n.getMessage('groupTab_fromPinnedTab_label', tab.title),
      temporary:   true,
      openerTabId: tab.$TST.uniqueId.id
    });
});

Tree.onAttached.addListener((tab, _info = {}) => {
  reserveToUpdateRelatedGroupTabs(tab, ['tree']);
});

Tree.onDetached.addListener((_tab, detachInfo) => {
  if (!detachInfo.oldParentTab)
    return;
  if (detachInfo.oldParentTab.$TST.isGroupTab)
    TabsGroup.reserveToCleanupNeedlessGroupTab(detachInfo.oldParentTab);
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
  const openerTab = openerId && (await browser.tabs.get(openerId).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError)));
  if ((openerTab &&
       openerTab.pinned &&
       openerTab.windowId == tab.windowId) ||
      (!openerTab &&
       !info.maybeOrphan)) {
    if (window.preventAutoGroupNewTabsUntil > Date.now()) {
      window.preventAutoGroupNewTabsUntil += configs.autoGroupNewTabsTimeout;
    }
    else {
      window.openedNewTabs.set(tab.id, {
        id:       tab.id,
        openerId: openerTab && openerTab.id,
        openerIsPinned: openerTab && openerTab.pinned
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
  if (Tab.needToWaitTracked(window.id))
    await Tab.waitUntilTrackedAll(window.id);
  if (Tab.needToWaitMoved(window.id))
    await Tab.waitUntilMovedAll(window.id);

  let tabReferences = Array.from(window.openedNewTabs.values());
  log('onNewTabsTimeout ', tabReferences);

  window.openedNewTabs.clear();

  const blocked = TSTAPI.isGroupingBlocked();
  tabReferences = tabReferences.filter(tabReference => {
    if (blocked || !tabReference.id)
      return false;
    const tab = Tab.get(tabReference.id);
    if (!tab)
      return false;
    const uniqueId = tab && tab.$TST && tab.$TST.uniqueId;
    return !uniqueId || (!uniqueId.duplicated && !uniqueId.restored);
  });
  if (tabReferences.length == 0)
    return;

  if (tabReferences.length > 1) {
    for (const tabReference of tabReferences) {
      Tab.get(tabReference.id).$TST.openedWithOthers = true;
    }
  }

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
    const tabs = mapAndFilter(tabReferences, tabReference => {
      const tab = Tab.get(tabReference.id);
      if (!tab)
        return undefined;
      // We should check the config here, because to-be-grouped tabs should be
      // ignored by the handler for "autoAttachSameSiteOrphan" behavior.
      const shouldBeGrouped = tabReference.openerIsPinned ? configs.autoGroupNewTabsFromPinned : configs.autoGroupNewTabs;
      if (!shouldBeGrouped)
        return undefined;
      if (tabReference.openerTabId)
        tab.openerTabId = parseInt(tabReference.openerTabId); // restore the opener information
      const uniqueId = tab.$TST.uniqueId;
      return !uniqueId.duplicated && !uniqueId.restored && tab || undefined;
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
        configs.autoGroupNewTabs) {
      const granted = await confirmToAutoGroupNewTabs(tabs);
      if (granted)
        await TabsGroup.groupTabs(newRootTabs, { broadcast: true });
    }
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

async function confirmToAutoGroupNewTabs(tabs) {
  if (tabs.length <= 1 ||
      !configs.warnOnAutoGroupNewTabs)
    return true;

  const windowId = tabs[0].windowId;
  const granted = await Permissions.isGranted(Permissions.ALL_URLS);
  if (!granted ||
      /^(about|chrome|resource):/.test(tabs[0].url) ||
      (SidebarConnection.isOpen(windowId) &&
       SidebarConnection.hasFocus(windowId)))
    return browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_CONFIRM_TO_AUTO_GROUP_NEW_TABS,
      tabIds:   tabs.map(tab => tab.id),
      windowId: windowId
    }).catch(ApiTabs.createErrorHandler());

  const result = await RichConfirm.showInTab(tabs[0].id, {
    message: browser.i18n.getMessage('warnOnAutoGroupNewTabs_message', [tabs.length]),
    buttons: [
      browser.i18n.getMessage('warnOnAutoGroupNewTabs_close'),
      browser.i18n.getMessage('warnOnAutoGroupNewTabs_cancel')
    ],
    checkMessage: browser.i18n.getMessage('warnOnAutoGroupNewTabs_warnAgain'),
    checked: true
  });
  switch (result.buttonIndex) {
    case 0:
      if (!result.checked)
        configs.warnOnAutoGroupNewTabs = false;
      return true;
    case 1:
      if (!result.checked) {
        configs.warnOnAutoGroupNewTabs = false;
        configs.autoGroupNewTabs = false;
      }
    default:
      return false;
  }
}

async function tryGroupNewTabsFromPinnedOpener(rootTabs) {
  log(`tryGroupNewTabsFromPinnedOpener: ${rootTabs.length} root tabs are opened from pinned tabs`);

  // First, collect pinned opener tabs.
  let pinnedOpeners = [];
  const childrenOfPinnedTabs = {};
  for (const tab of rootTabs) {
    const opener = tab.$TST.openerTab;
    if (!pinnedOpeners.includes(opener))
      pinnedOpeners.push(opener);
  }
  log('pinnedOpeners ', () => pinnedOpeners.map(dumpTab));

  // Second, collect tabs opened from pinned openers including existing tabs
  // (which were left ungrouped in previous process).
  const openerOf = {};
  const unifiedRootTabs = Tab.getRootTabs(rootTabs[0].windowId).filter(tab => {
    if (tab.$TST.getAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER))
      return false;
    if (rootTabs.includes(tab)) { // newly opened tab
      const opener = tab.$TST.openerTab;
      if (!opener)
        return false;
      openerOf[tab.id] = opener;
      const tabs = childrenOfPinnedTabs[opener.id] || [];
      childrenOfPinnedTabs[opener.id] = tabs.concat([tab]);
      return true;
    }
    const opener = Tab.getByUniqueId(tab.$TST.getAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID));
    if (!opener ||
        !opener.pinned ||
        opener.windowId != tab.windowId)
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
  log(' => ', () => pinnedOpeners.map(dumpTab));

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
        const siblings = tab.$TST.needToBeGroupedSiblings;
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
    log(`trying to group children of ${dumpTab(opener)}: `, () => children.map(dumpTab));
    let parent = Tab.getGroupTabForOpener(opener);
    if (!parent) {
      const uri = TabsGroup.makeGroupTabURI({
        title:       browser.i18n.getMessage('groupTab_fromPinnedTab_label', opener.title),
        temporary:   true,
        openerTabId: opener.$TST.uniqueId.id
      });
      parent = await TabsOpen.openURIInTab(uri, {
        windowId:     opener.windowId,
        insertBefore: children[0],
        cookieStoreId: opener.cookieStoreId,
        inBackground: true
      });
      log('opened group tab: ', dumpTab(parent));
      newGroupTabs.set(opener, true);
    }
    for (const child of children) {
      // Prevent the tab to be grouped again after it is ungrouped manually.
      child.$TST.setAttribute(Constants.kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER, true);
      TabsStore.removeToBeGroupedTab(child);
      await Tree.attachTabTo(child, parent, {
        forceExpand: true, // this is required to avoid the group tab itself is active from active tab in collapsed tree
        insertAfter: configs.insertNewChildAt == Constants.kINSERT_FIRST ? parent : parent.$TST.lastDescendant,
        broadcast:   true
      });
    }
  }
  return true;
}
