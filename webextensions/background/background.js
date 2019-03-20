/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/extlib/RichConfirm.js';
import TabIdFixer from '/extlib/TabIdFixer.js';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabsListener from '/common/api-tabs-listener.js';
import * as MetricsData from '/common/metrics-data.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as Tree from '/common/tree.js';
import * as ContextualIdentities from '/common/contextual-identities.js';
import * as Permissions from '/common/permissions.js';
import * as TSTAPI from '/common/tst-api.js';
import * as Sidebar from '/common/sidebar.js';
import * as Commands from '/common/commands.js';
import * as Migration from '/common/migration.js';

import Tab from '/common/Tab.js';
import Window from '/common/Window.js';

import * as TreeStructure from './tree-structure.js';
import * as BackgroundCache from './background-cache.js';
import * as TabContextMenu from './tab-context-menu.js';
import './browser-action-menu.js';
import './successor-tab.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('background/background', ...args);
}

export const onInit    = new EventListenerManager();
export const onBuilt   = new EventListenerManager();
export const onReady   = new EventListenerManager();
export const onDestroy = new EventListenerManager();
export const onTreeCompletelyAttached = new EventListenerManager();

let mInitialized = false;

export async function init() {
  MetricsData.add('init: start');
  window.addEventListener('pagehide', destroy, { once: true });

  onInit.dispatch();
  Sidebar.init();

  await configs.$loaded;
  MetricsData.add('init: configs.$loaded');

  Migration.migrateLegacyConfigs();
  Migration.migrateConfigs();
  Migration.notifyNewFeatures(); // open new tab now, instead of the end of initialization, because the sidebar may fail to track tabs.onCreated for the tab while its initializing process.
  configs.grantedRemovingTabIds = []; // clear!
  MetricsData.add('init: Migration.migrateLegacyConfigs, Migration.migrateConfigs');

  updatePanelUrl();

  await MetricsData.addAsync('init: waiting for waitUntilCompletelyRestored and ContextualIdentities.init', Promise.all([
    waitUntilCompletelyRestored(),
    ContextualIdentities.init()
  ]));
  const restoredFromCache = await await MetricsData.addAsync('init: rebuildAll', async () => {
    return rebuildAll();
  });
  await MetricsData.addAsync('init: TreeStructure.loadTreeStructure', async () => {
    return TreeStructure.loadTreeStructure(restoredFromCache);
  });

  Migration.migrateLegacyTreeStructure();
  MetricsData.add('init: Migration.migrateLegacyTreeStructure');

  ApiTabsListener.startListen();
  ContextualIdentities.startObserve();
  onBuilt.dispatch();
  MetricsData.add('init: started listening');

  TabContextMenu.init();
  MetricsData.add('init: started initializing of context menu');

  Permissions.clearRequest();

  for (const windowId of Object.keys(restoredFromCache)) {
    if (!restoredFromCache[windowId])
      BackgroundCache.reserveToCacheTree(parseInt(windowId));
  }

  for (const tab of Tab.getAllTabs(null, { iterator: true })) {
    updateSubtreeCollapsed(tab);
  }
  for (const tab of Tab.getActiveTabs()) {
    for (const ancestor of tab.$TST.ancestors) {
      Tree.collapseExpandTabAndSubtree(ancestor, {
        collapsed: false,
        justNow:   true
      });
    }
  }

  await MetricsData.addAsync('init: initializing API for other addons', async () => {
    return TSTAPI.initAsBackend();
  });

  mInitialized = true;
  onReady.dispatch();
  BackgroundCache.activate();
  TreeStructure.startTracking();

  // notify that the master process is ready.
  for (const window of TabsStore.windows.values()) {
    Sidebar.sendMessage({
      type:     Constants.kCOMMAND_PING_TO_SIDEBAR,
      windowId: window.id,
      tabs:     window.export(true) // send tabs together to optimizie further initialization tasks in the sidebar
    });
  }

  log(`Startup metrics for ${TabsStore.tabs.size} tabs: `, MetricsData.toString());
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
    let onNewTabRestored = async (tab, _info = {}) => {
      clearTimeout(timeout);
      log('new restored tab is detected.');
      await browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_ID).catch(ApiTabs.createErrorSuppressor());
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
  browser.runtime.sendMessage({
    type:  TSTAPI.kUNREGISTER_SELF
  }).catch(ApiTabs.createErrorSuppressor());

  // This API doesn't work as expected because it is not notified to
  // other addons actually when browser.runtime.sendMessage() is called
  // on pagehide or something unloading event.
  TSTAPI.sendMessage({
    type: TSTAPI.kNOTIFY_SHUTDOWN
  }).catch(ApiTabs.createErrorSuppressor());

  onDestroy.dispatch();
  ApiTabsListener.endListen();
  ContextualIdentities.endObserve();
}

async function rebuildAll() {
  const windows = await 
  await MetricsData.addAsync('rebuildAll: getting all tabs across windows', browser.windows.getAll({
    populate:    true,
    windowTypes: ['normal']
  }).catch(ApiTabs.createErrorHandler()));
  const restoredFromCache = {};
  await Promise.all(windows.map(async (window) => {
    await MetricsData.addAsync(`rebuildAll: tabs in window ${window.id}`, async () => {
      const trackedWindow = TabsStore.windows.get(window.id);
      if (!trackedWindow)
        Window.init(window.id);

      for (const tab of window.tabs) {
        TabIdFixer.fixTab(tab);
        Tab.track(tab);
        Tab.init(tab, { existing: true });
        tryStartHandleAccelKeyOnTab(tab);
      }
      try {
        if (configs.useCachedTree) {
          log(`trying to restore window ${window.id} from cache`);
          restoredFromCache[window.id] = await MetricsData.addAsync(`rebuildAll: restore tabs in window ${window.id} from cache`, BackgroundCache.restoreWindowFromEffectiveWindowCache(window.id, {
            owner: window.tabs[window.tabs.length - 1],
            tabs:  window.tabs
          }));
          log(`window ${window.id}: restored from cache?: `, restoredFromCache[window.id]);
          if (restoredFromCache[window.id])
            return;
        }
      }
      catch(e) {
        log(`failed to restore tabs for ${window.id} from cache `, e);
      }
      try {
        log(`build tabs for ${window.id} from scratch`);
        Window.init(window.id);
        for (let tab of window.tabs) {
          tab = Tab.get(tab.id);
          tab.$TST.clear(); // clear dirty restored states
          TabsUpdate.updateTab(tab, tab, { forceApply: true });
          tryStartHandleAccelKeyOnTab(tab);
        }
      }
      catch(e) {
        log(`failed to build tabs for ${window.id}`, e);
      }
      restoredFromCache[window.id] = false;
    });
    for (const tab of Tab.getGroupTabs(window.id, { iterator: true })) {
      if (!tab.discarded)
        tab.$TST.shouldReloadOnSelect = true;
    }
  }));
  return restoredFromCache;
}

export async function tryStartHandleAccelKeyOnTab(tab) {
  if (!TabsStore.ensureLivingTab(tab))
    return;
  const granted = await Permissions.isGranted(Permissions.ALL_URLS);
  if (!granted ||
      /^(about|chrome|resource):/.test(tab.url))
    return;
  try {
    //log(`tryStartHandleAccelKeyOnTab: initialize tab ${tab.id}`);
    browser.tabs.executeScript(tab.id, {
      file:            '/common/handle-accel-key.js',
      allFrames:       true,
      matchAboutBlank: true,
      runAt:           'document_start'
    }).catch(ApiTabs.createErrorSuppressor(ApiTabs.handleMissingTabError));
  }
  catch(error) {
    console.log(error);
  }
}

export function reserveToUpdateInsertionPosition(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!TabsStore.ensureLivingTab(tab))
      continue;
    if (tab.$TST.reservedUpdateInsertionPosition)
      clearTimeout(tab.$TST.reservedUpdateInsertionPosition);
    tab.$TST.reservedUpdateInsertionPosition = setTimeout(() => {
      if (!tab.$TST)
        return;
      delete tab.$TST.reservedUpdateInsertionPosition;
      updateInsertionPosition(tab);
    }, 100);
  }
}

async function updateInsertionPosition(tab) {
  if (!TabsStore.ensureLivingTab(tab))
    return;

  const prev = tab.$TST.previousTab;
  if (prev)
    browser.sessions.setTabValue(
      tab.id,
      Constants.kPERSISTENT_INSERT_AFTER,
      prev.$TST.uniqueId.id
    ).catch(ApiTabs.createErrorSuppressor());
  else
    browser.sessions.removeTabValue(
      tab.id,
      Constants.kPERSISTENT_INSERT_AFTER
    ).catch(ApiTabs.createErrorSuppressor());

  const next = tab.$TST.nextTab;
  if (next)
    browser.sessions.setTabValue(
      tab.id,
      Constants.kPERSISTENT_INSERT_BEFORE,
      next.$TST.uniqueId.id
    ).catch(ApiTabs.createErrorSuppressor());
  else
    browser.sessions.removeTabValue(
      tab.id,
      Constants.kPERSISTENT_INSERT_BEFORE
    ).catch(ApiTabs.createErrorSuppressor());
}


export function reserveToUpdateAncestors(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!TabsStore.ensureLivingTab(tab))
      continue;
    if (tab.$TST.reservedUpdateAncestors)
      clearTimeout(tab.$TST.reservedUpdateAncestors);
    tab.$TST.reservedUpdateAncestors = setTimeout(() => {
      if (!tab.$TST)
        return;
      delete tab.$TST.reservedUpdateAncestors;
      updateAncestors(tab);
    }, 100);
  }
}

async function updateAncestors(tab) {
  if (!TabsStore.ensureLivingTab(tab))
    return;

  browser.sessions.setTabValue(
    tab.id,
    Constants.kPERSISTENT_ANCESTORS,
    tab.$TST.ancestors.map(ancestor => ancestor.$TST.uniqueId.id)
  ).catch(ApiTabs.createErrorSuppressor());
}

export function reserveToUpdateChildren(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!TabsStore.ensureLivingTab(tab))
      continue;
    if (tab.$TST.reservedUpdateChildren)
      clearTimeout(tab.$TST.reservedUpdateChildren);
    tab.$TST.reservedUpdateChildren = setTimeout(() => {
      if (!tab.$TST)
        return;
      delete tab.$TST.reservedUpdateChildren;
      updateChildren(tab);
    }, 100);
  }
}

async function updateChildren(tab) {
  if (!TabsStore.ensureLivingTab(tab))
    return;

  browser.sessions.setTabValue(
    tab.id,
    Constants.kPERSISTENT_CHILDREN,
    tab.$TST.children.map(child => child.$TST.uniqueId.id)
  ).catch(ApiTabs.createErrorSuppressor());
}

function reserveToUpdateSubtreeCollapsed(tab) {
  if (!mInitialized ||
      !TabsStore.ensureLivingTab(tab))
    return;
  if (tab.$TST.reservedUpdateSubtreeCollapsed)
    clearTimeout(tab.$TST.reservedUpdateSubtreeCollapsed);
  tab.$TST.reservedUpdateSubtreeCollapsed = setTimeout(() => {
    if (!tab.$TST)
      return;
    delete tab.$TST.reservedUpdateSubtreeCollapsed;
    updateSubtreeCollapsed(tab);
  }, 100);
}

async function updateSubtreeCollapsed(tab) {
  if (!TabsStore.ensureLivingTab(tab))
    return;
  if (tab.$TST.subtreeCollapsed)
    tab.$TST.addState(Constants.kTAB_STATE_SUBTREE_COLLAPSED, { permanently: true });
  else
    tab.$TST.removeState(Constants.kTAB_STATE_SUBTREE_COLLAPSED, { permanently: true });
}

export async function confirmToCloseTabs(tabIds, options = {}) {
  tabIds = tabIds.filter(id => !configs.grantedRemovingTabIds.includes(id));
  const count = tabIds.length;
  log('confirmToCloseTabs ', { tabIds, count, options });
  if (count <= 1 ||
      !configs.warnOnCloseTabs ||
      Date.now() - configs.lastConfirmedToCloseTabs < 500)
    return true;

  const tabs = await browser.tabs.query({
    active:   true,
    windowId: options.windowId
  }).catch(ApiTabs.createErrorHandler());

  const granted = await Permissions.isGranted(Permissions.ALL_URLS);
  if (!granted ||
      /^(about|chrome|resource):/.test(tabs[0].url) ||
      (!options.showInTab &&
       Sidebar.isOpen(options.windowId) &&
       Sidebar.hasFocus(options.windowId)))
    return browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_CONFIRM_TO_CLOSE_TABS,
      tabIds:   tabs.map(tab => tab.id),
      windowId: options.windowId
    }).catch(ApiTabs.createErrorHandler());

  const result = await RichConfirm.showInTab(tabs[0].id, {
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
      configs.grantedRemovingTabIds = Array.from(new Set((configs.grantedRemovingTabIds || []).concat(tabIds)));
      log('confirmToCloseTabs: granted ', configs.grantedRemovingTabIds);
      return true;
    default:
      return false;
  }
}
Commands.onTabsClosing.addListener((tabIds, options = {}) => {
  return confirmToCloseTabs(tabIds, options);
});

Tab.onCreated.addListener((tab, info = {}) => {
  if (!info.duplicated)
    return;
  // Duplicated tab has its own tree structure information inherited
  // from the original tab, but they must be cleared.
  reserveToUpdateAncestors(tab);
  reserveToUpdateChildren(tab);
  reserveToUpdateInsertionPosition([
    tab,
    tab.$TST.nextTab,
    tab.$TST.previousTab
  ]);
});

Tab.onUpdated.addListener((tab, changeInfo) => {
  // Loading of "about:(unknown type)" won't report new URL via tabs.onUpdated,
  // so we need to see the complete tab object.
  const status = changeInfo.status || tab && tab.status;
  const url = changeInfo.url ? changeInfo.url :
    status == 'complete' && tab ? tab.url : '';
  if (tab &&
      Constants.kSHORTHAND_ABOUT_URI.test(url)) {
    const shorthand = RegExp.$1;
    const oldUrl = tab.url;
    wait(100).then(() => { // redirect with delay to avoid infinite loop of recursive redirections.
      if (tab.url != oldUrl)
        return;
      browser.tabs.update(tab.id, {
        url: url.replace(Constants.kSHORTHAND_ABOUT_URI, Constants.kSHORTHAND_URIS[shorthand] || 'about:blank')
      }).catch(ApiTabs.createErrorSuppressor(ApiTabs.handleMissingTabError));
      if (shorthand == 'group')
        tab.$TST.addState(Constants.kTAB_STATE_GROUP_TAB, { permanently: true });
    });
  }

  if (changeInfo.status || changeInfo.url)
    tryStartHandleAccelKeyOnTab(tab);
});

Tab.onTabInternallyMoved.addListener((tab, info = {}) => {
  reserveToUpdateInsertionPosition([
    tab,
    tab.$TST.previousTab,
    tab.$TST.nextTab,
    info.oldPreviousTab,
    info.oldNextTab
  ]);
});

Tab.onMoved.addListener(async (tab, moveInfo) => {
  reserveToUpdateInsertionPosition([
    tab,
    moveInfo.oldPreviousTab,
    moveInfo.oldNextTab,
    tab.$TST.previousTab,
    tab.$TST.nextTab
  ]);
});

Tree.onDetached.addListener(async (tab, detachInfo) => {
  reserveToUpdateAncestors([tab].concat(tab.$TST.descendants));
  reserveToUpdateChildren(detachInfo.oldParentTab);
});

Tree.onSubtreeCollapsedStateChanging.addListener((tab, _info) => { reserveToUpdateSubtreeCollapsed(tab); });

// This section should be removed and define those context-fill icons
// statically on manifest.json on future versions of Firefox.
// See also: https://github.com/piroor/treestyletab/issues/2053
function applyThemeColorToIcon() {
  if (configs.applyThemeColorToIcon) {
    const icons = { path: browser.runtime.getManifest().variable_color_icons };
    browser.browserAction.setIcon(icons);
    browser.sidebarAction.setIcon(icons);
  }
}
configs.$loaded.then(applyThemeColorToIcon);

configs.$addObserver(key => {
  switch (key) {
    case 'style':
      updatePanelUrl();
      break;
    case 'applyThemeColorToIcon':
      applyThemeColorToIcon();
      break;
  }
});
