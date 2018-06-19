/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import TabFavIconHelper from '../extlib/TabFavIconHelper.js';
import RichConfirm from '../extlib/RichConfirm.js';

import {
  log as internalLogger,
  dumpTab,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as ApiTabsListener from '../common/api-tabs-listener.js';
import * as MetricsData from '../common/metrics-data.js';
import * as Tabs from '../common/tabs.js';
import * as TabsInternalOperation from '../common/tabs-internal-operation.js';
import * as TabsContainer from '../common/tabs-container.js';
import * as TabsUpdate from '../common/tabs-update.js';
import * as Tree from '../common/tree.js';
import * as ContextualIdentities from '../common/contextual-identities.js';
import * as Permissions from '../common/permissions.js';
import * as TSTAPI from '../common/tst-api.js';
import * as SidebarStatus from '../common/sidebar-status.js';
import * as Commands from '../common/commands.js';
import * as Migration from '../common/migration.js';
import EventListenerManager from '../common/EventListenerManager.js';

import * as TreeStructure from './tree-structure.js';
import * as BackgroundCache from './background-cache.js';
import * as ContextMenu from './context-menu.js';
import * as TabContextMenu from './tab-context-menu.js';

function log(...args) {
  if (configs.logFor['background/background'])
    internalLogger(...args);
}

export const onInit    = new EventListenerManager();
export const onBuilt   = new EventListenerManager();
export const onReady   = new EventListenerManager();
export const onDestroy = new EventListenerManager();
export const onTreeCompletelyAttached = new EventListenerManager();

let mInitialized = false;

export async function init() {
  MetricsData.add('init start');
  window.addEventListener('pagehide', destroy, { once: true });

  onInit.dispatch();
  SidebarStatus.startWatchOpenState();

  await configs.$loaded;
  MetricsData.add('configs.$loaded');

  Migration.migrateLegacyConfigs();
  MetricsData.add('Migration.migrateLegacyConfigs');

  updatePanelUrl();

  await MetricsData.addAsync('parallel initialization tasks: waitUntilCompletelyRestored, ContextualIdentities.init', Promise.all([
    waitUntilCompletelyRestored(),
    ContextualIdentities.init()
  ]));
  const restoredFromCache = await rebuildAll();
  MetricsData.add(`rebuildAll (cached: ${JSON.stringify(restoredFromCache)})`);
  await TreeStructure.loadTreeStructure(restoredFromCache);
  MetricsData.add('TreeStructure.loadTreeStructure done');

  Migration.migrateLegacyTreeStructure();
  MetricsData.add('Migration.migrateLegacyTreeStructure');

  ApiTabsListener.startListen();
  ContextualIdentities.startObserve();
  onBuilt.dispatch();

  TabContextMenu.init();

  ContextMenu.refreshItems();
  configs.$addObserver(key => {
    switch (key) {
      case 'style':
        updatePanelUrl();
        break;

      default:
        if (key.indexOf('context_') == 0)
          ContextMenu.refreshItems();
        break;
    }
  });

  Permissions.clearRequest();

  for (const windowId of Object.keys(restoredFromCache)) {
    if (!restoredFromCache[windowId])
      BackgroundCache.reserveToCacheTree(parseInt(windowId));
  }

  Tabs.getAllTabs().forEach(updateSubtreeCollapsed);
  for (const tab of Tabs.getCurrentTabs()) {
    for (const ancestor of Tabs.getAncestorTabs(tab)) {
      Tree.collapseExpandTabAndSubtree(ancestor, {
        collapsed: false,
        justNow:   true
      });
    }
  }

  await TSTAPI.initAsBackend();

  mInitialized = true;
  onReady.dispatch();
  BackgroundCache.activate();
  TreeStructure.startTracking();

  // notify that the master process is ready.
  browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PING_TO_SIDEBAR
  });

  Migration.notifyNewFeatures();
  log(`Startup metrics for ${Tabs.getTabs().length} tabs: `, MetricsData.toString());
}

function updatePanelUrl() {
  const panel = browser.extension.getURL(`/sidebar/sidebar.html?style=${encodeURIComponent(configs.style)}`);
  browser.sidebarAction.setPanel({ panel });
}

function waitUntilCompletelyRestored() {
  log('waitUntilCompletelyRestored');
  return new Promise((resolve, _aReject) => {
    let timeout;
    let resolver;
    let onNewTabRestored = async (newApiTab, _info = {}) => {
      clearTimeout(timeout);
      log('new restored tab is detected.');
      await browser.sessions.getTabValue(newApiTab.id, Constants.kPERSISTENT_ID);
      //uniqueId = uniqueId && uniqueId.id || '?'; // not used
      timeout = setTimeout(resolver, 100);
    };
    browser.tabs.onCreated.addListener(onNewTabRestored);
    resolver = (() => {
      log('timeout: all tabs are restored.');
      browser.tabs.onCreated.removeListener(onNewTabRestored);
      timeout = resolver = onNewTabRestored = undefined;
      resolve();
    });
    timeout = setTimeout(resolver, 500);
  });
}

function destroy() {
  browser.runtime.sendMessage(browser.runtime.id, {
    type:  TSTAPI.kUNREGISTER_SELF
  });

  // This API doesn't work as expected because it is not notified to
  // other addons actually when browser.runtime.sendMessage() is called
  // on pagehide or something unloading event.
  TSTAPI.sendMessage({
    type: TSTAPI.kNOTIFY_SHUTDOWN
  });

  onDestroy.dispatch();
  ApiTabsListener.endListen();
  ContextualIdentities.endObserve();
}

async function rebuildAll() {
  TabsContainer.clearAll();
  const windows = await browser.windows.getAll({
    populate:    true,
    windowTypes: ['normal']
  });
  const insertionPoint = document.createRange();
  insertionPoint.selectNodeContents(Tabs.allTabsContainer);
  const restoredFromCache = {};
  await Promise.all(windows.map(async (window) => {
    await MetricsData.addAsync(`rebuild ${window.id}`, async () => {
      if (configs.useCachedTree) {
        restoredFromCache[window.id] = await BackgroundCache.restoreWindowFromEffectiveWindowCache(window.id, {
          insertionPoint,
          owner: window.tabs[window.tabs.length - 1],
          tabs:  window.tabs
        });
        for (const tab of Tabs.getAllTabs(window.id)) {
          tryStartHandleAccelKeyOnTab(tab);
        }
        if (restoredFromCache[window.id]) {
          log(`window ${window.id} is restored from cache`);
          return;
        }
      }
      log(`build tabs for ${window.id} from scratch`);
      const container = TabsContainer.buildFor(window.id);
      for (const apiTab of window.tabs) {
        const newTab = Tabs.buildTab(apiTab, { existing: true });
        container.appendChild(newTab);
        TabsUpdate.updateTab(newTab, apiTab, { forceApply: true });
        tryStartHandleAccelKeyOnTab(newTab);
      }
      Tabs.allTabsContainer.appendChild(container);
      restoredFromCache[window.id] = false;
    });
    for (const tab of Tabs.getAllTabs(window.id).filter(Tabs.isGroupTab)) {
      if (!Tabs.isDiscarded(tab))
        tab.dataset.shouldReloadOnSelect = true;
    }
  }));
  insertionPoint.detach();
  return restoredFromCache;
}

export async function tryStartHandleAccelKeyOnTab(tab) {
  if (!Tabs.ensureLivingTab(tab))
    return;
  const granted = await Permissions.isGranted(Permissions.ALL_URLS);
  if (!granted ||
      /^(about|chrome|resource):/.test(tab.apiTab.url))
    return;
  try {
    //log(`tryStartHandleAccelKeyOnTab: initialize tab ${tab.id}`);
    browser.tabs.executeScript(tab.apiTab.id, {
      file:            '/common/handle-accel-key.js',
      allFrames:       true,
      matchAboutBlank: true,
      runAt:           'document_start'
    });
  }
  catch(error) {
    console.log(error);
  }
}

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
  const initialized = await browser.tabs.executeScript(tab.apiTab.id, Object.assign({}, scriptOptions, {
    code:  'window.init && window.init.done',
  }));
  if (initialized[0])
    return;
  browser.tabs.executeScript(tab.apiTab.id, Object.assign({}, scriptOptions, {
    //file:  '/common/l10n.js'
    file:  '/extlib/l10n-classic.js' // ES module does not supported as a content script...
  }));
  browser.tabs.executeScript(tab.apiTab.id, Object.assign({}, scriptOptions, {
    file:  '/resources/group-tab.js'
  }));
}

export function reserveToUpdateInsertionPosition(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!Tabs.ensureLivingTab(tab))
      continue;
    if (tab.reservedUpdateInsertionPosition)
      clearTimeout(tab.reservedUpdateInsertionPosition);
    tab.reservedUpdateInsertionPosition = setTimeout(() => {
      delete tab.reservedUpdateInsertionPosition;
      updateInsertionPosition(tab);
    }, 100);
  }
}

async function updateInsertionPosition(tab) {
  if (!Tabs.ensureLivingTab(tab))
    return;

  const prev = Tabs.getPreviousTab(tab);
  if (prev)
    prev.uniqueId.then(id =>
      browser.sessions.setTabValue(
        tab.apiTab.id,
        Constants.kPERSISTENT_INSERT_AFTER,
        id.id
      )
    );
  else
    browser.sessions.removeTabValue(
      tab.apiTab.id,
      Constants.kPERSISTENT_INSERT_AFTER
    );

  const next = Tabs.getNextTab(tab);
  if (next)
    next.uniqueId.then(id =>
      browser.sessions.setTabValue(
        tab.apiTab.id,
        Constants.kPERSISTENT_INSERT_BEFORE,
        id.id
      )
    );
  else
    browser.sessions.removeTabValue(
      tab.apiTab.id,
      Constants.kPERSISTENT_INSERT_BEFORE
    );
}


export function reserveToUpdateAncestors(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!Tabs.ensureLivingTab(tab))
      continue;
    if (tab.reservedUpdateAncestors)
      clearTimeout(tab.reservedUpdateAncestors);
    tab.reservedUpdateAncestors = setTimeout(() => {
      delete tab.reservedUpdateAncestors;
      updateAncestors(tab);
    }, 100);
  }
}

async function updateAncestors(tab) {
  if (!Tabs.ensureLivingTab(tab))
    return;

  const ancestorIds = await Promise.all(
    Tabs.getAncestorTabs(tab)
      .map(ancestor => ancestor.uniqueId)
  );
  browser.sessions.setTabValue(
    tab.apiTab.id,
    Constants.kPERSISTENT_ANCESTORS,
    ancestorIds.map(id => id.id)
  );
}

export function reserveToUpdateChildren(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!Tabs.ensureLivingTab(tab))
      continue;
    if (tab.reservedUpdateChildren)
      clearTimeout(tab.reservedUpdateChildren);
    tab.reservedUpdateChildren = setTimeout(() => {
      delete tab.reservedUpdateChildren;
      updateChildren(tab);
    }, 100);
  }
}

async function updateChildren(tab) {
  if (!Tabs.ensureLivingTab(tab))
    return;

  const childIds = await Promise.all(
    Tabs.getChildTabs(tab)
      .map(child => child.uniqueId)
  );
  browser.sessions.setTabValue(
    tab.apiTab.id,
    Constants.kPERSISTENT_CHILDREN,
    childIds.map(id => id.id)
  );
}

function reserveToUpdateSubtreeCollapsed(tab) {
  if (!mInitialized ||
      !Tabs.ensureLivingTab(tab))
    return;
  if (tab.reservedUpdateSubtreeCollapsed)
    clearTimeout(tab.reservedUpdateSubtreeCollapsed);
  tab.reservedUpdateSubtreeCollapsed = setTimeout(() => {
    delete tab.reservedUpdateSubtreeCollapsed;
    updateSubtreeCollapsed(tab);
  }, 100);
}

async function updateSubtreeCollapsed(tab) {
  if (!Tabs.ensureLivingTab(tab))
    return;
  browser.sessions.setTabValue(
    tab.apiTab.id,
    Constants.kPERSISTENT_SUBTREE_COLLAPSED,
    Tabs.isSubtreeCollapsed(tab)
  );
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

export function reserveToUpdateRelatedGroupTabs(tab) {
  const ancestorGroupTabs = [tab]
    .concat(Tabs.getAncestorTabs(tab))
    .filter(Tabs.isGroupTab);
  for (const tab of ancestorGroupTabs) {
    if (tab.reservedUpdateRelatedGroupTab)
      clearTimeout(tab.reservedUpdateRelatedGroupTab);
    tab.reservedUpdateRelatedGroupTab = setTimeout(() => {
      delete tab.reservedUpdateRelatedGroupTab;
      updateRelatedGroupTab(tab);
    }, 100);
  }
}

async function updateRelatedGroupTab(groupTab) {
  if (!Tabs.ensureLivingTab(groupTab))
    return;

  await tryInitGroupTab(groupTab);
  await browser.tabs.executeScript(groupTab.apiTab.id, {
    runAt:           'document_start',
    matchAboutBlank: true,
    code:            `updateTree()`,
  });

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
    const url = groupTab.apiTab.url.replace(/title=[^&]+/, `title=${encodeURIComponent(newTitle)}`);
    browser.tabs.update(groupTab.apiTab.id, { url });
  }
}


export async function confirmToCloseTabs(count, options = {}) {
  if (count <= 1 ||
      !configs.warnOnCloseTabs ||
      Date.now() - configs.lastConfirmedToCloseTabs < 500)
    return true;

  const apiTabs = await browser.tabs.query({
    active:   true,
    windowId: options.windowId
  });

  const granted = await Permissions.isGranted(Permissions.ALL_URLS);
  if (!granted ||
      /^(about|chrome|resource):/.test(apiTabs[0].url) ||
      (!options.showInTab &&
       SidebarStatus.isOpen(options.windowId) &&
       SidebarStatus.hasFocus(options.windowId)))
    return browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_CONFIRM_TO_CLOSE_TABS,
      count:    count,
      windowId: options.windowId
    });

  const result = await RichConfirm.showInTab(apiTabs[0].id, {
    message: browser.i18n.getMessage('warnOnCloseTabs_message', [count]),
    buttons: [
      browser.i18n.getMessage('warnOnCloseTabs_close'),
      browser.i18n.getMessage('warnOnCloseTabs_cancel')
    ],
    checkMessage: browser.i18n.getMessage('warnOnCloseTabs_warnAgain'),
    checked: true
  });
  switch (result.buttonIndex) {
    case 0:
      if (!result.checked)
        configs.warnOnCloseTabs = false;
      return true;
    default:
      return false;
  }
}
Commands.onTabsClosing.addListener(confirmToCloseTabs);

Tabs.onCreated.addListener((tab, info = {}) => {
  if (!info.duplicated)
    return;
  // Duplicated tab has its own tree structure information inherited
  // from the original tab, but they must be cleared.
  reserveToUpdateAncestors(tab);
  reserveToUpdateChildren(tab);
  reserveToUpdateInsertionPosition([
    tab,
    Tabs.getNextTab(tab),
    Tabs.getPreviousTab(tab)
  ]);
});

Tabs.onUpdated.addListener((tab, changeInfo) => {
  if (changeInfo.status || changeInfo.url) {
    tryInitGroupTab(tab);
    tryStartHandleAccelKeyOnTab(tab);
  }

  const group = Tabs.getGroupTabForOpener(tab);
  if (group)
    reserveToUpdateRelatedGroupTabs(group);
});

Tabs.onTabElementMoved.addListener((tab, info = {}) => {
  reserveToUpdateInsertionPosition([
    tab,
    Tabs.getPreviousTab(tab),
    Tabs.getNextTab(tab),
    info.oldPreviousTab,
    info.oldNextTab
  ]);
});

Tabs.onMoved.addListener(async (tab, moveInfo) => {
  reserveToUpdateInsertionPosition([
    tab,
    moveInfo.oldPreviousTab,
    moveInfo.oldNextTab,
    Tabs.getPreviousTab(tab),
    Tabs.getNextTab(tab)
  ]);
});

Tabs.onLabelUpdated.addListener(tab => { reserveToUpdateRelatedGroupTabs(tab); });

Tabs.onGroupTabDetected.addListener(tab => { tryInitGroupTab(tab); });

Tree.onDetached.addListener(async (tab, detachInfo) => {
  if (Tabs.isGroupTab(detachInfo.oldParentTab))
    reserveToCleanupNeedlessGroupTab(detachInfo.oldParentTab);
  reserveToUpdateAncestors([tab].concat(Tabs.getDescendantTabs(tab)));
  reserveToUpdateChildren(detachInfo.oldParentTab);
  reserveToUpdateRelatedGroupTabs(detachInfo.oldParentTab);
});

Tree.onSubtreeCollapsedStateChanging.addListener((tab, _info) => {
  reserveToUpdateRelatedGroupTabs(tab);
  reserveToUpdateSubtreeCollapsed(tab);
});

