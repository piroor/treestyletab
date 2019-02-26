/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/extlib/RichConfirm.js';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabsListener from '/common/api-tabs-listener.js';
import * as MetricsData from '/common/metrics-data.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as Tabs from '/common/tabs.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as Tree from '/common/tree.js';
import * as ContextualIdentities from '/common/contextual-identities.js';
import * as Permissions from '/common/permissions.js';
import * as TSTAPI from '/common/tst-api.js';
import * as SidebarStatus from '/common/sidebar-status.js';
import * as Commands from '/common/commands.js';
import * as Migration from '/common/migration.js';

import * as TreeStructure from './tree-structure.js';
import * as BackgroundCache from './background-cache.js';
import * as ContextMenu from './context-menu.js';
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
  MetricsData.add('init start');
  window.addEventListener('pagehide', destroy, { once: true });

  onInit.dispatch();
  SidebarStatus.startWatchOpenState();

  await configs.$loaded;
  MetricsData.add('configs.$loaded');

  Migration.migrateLegacyConfigs();
  Migration.migrateConfigs();
  configs.grantedRemovingTabIds = []; // clear!
  MetricsData.add('Migration.migrateLegacyConfigs, Migration.migrateConfigs');

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
  MetricsData.add('started listening');

  TabContextMenu.init().then(() => {
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
  });
  MetricsData.add('started initializing of context menu');

  Permissions.clearRequest();

  for (const windowId of Object.keys(restoredFromCache)) {
    if (!restoredFromCache[windowId])
      BackgroundCache.reserveToCacheTree(parseInt(windowId));
  }

  Tabs.getAllTabs(null).forEach(updateSubtreeCollapsed);
  for (const tab of Tabs.getActiveTabs()) {
    for (const ancestor of Tabs.getAncestorTabs(tab)) {
      Tree.collapseExpandTabAndSubtree(ancestor, {
        collapsed: false,
        justNow:   true
      });
    }
  }

  await TSTAPI.initAsBackend();
  MetricsData.add('TSTAPI.initAsBackend');

  mInitialized = true;
  onReady.dispatch();
  BackgroundCache.activate();
  TreeStructure.startTracking();

  // notify that the master process is ready.
  browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PING_TO_SIDEBAR
  }).catch(_error => {});

  Migration.notifyNewFeatures();
  log(`Startup metrics for ${Tabs.getAllTabs(null).length} tabs: `, MetricsData.toString());
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
      await browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_ID);
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
  }).catch(_error => {});

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
  Tabs.clearAllElements();
  Tabs.untrackAll();
  const windows = await browser.windows.getAll({
    populate:    true,
    windowTypes: ['normal']
  });
  const insertionPoint = document.createRange();
  insertionPoint.selectNodeContents(Tabs.allElementsContainer);
  const restoredFromCache = {};
  await Promise.all(windows.map(async (window) => {
    await MetricsData.addAsync(`rebuild ${window.id}`, async () => {
      for (const tab of window.tabs) {
        Tabs.track(tab);
      }
      try {
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
      }
      catch(e) {
        log(`failed to restore tabs for ${window.id} from cache `, e);
      }
      try {
        log(`build tabs for ${window.id} from scratch`);
        const container = Tabs.buildElementsContainerFor(window.id);
        for (const tab of window.tabs) {
          const tabElement = Tabs.buildTabElement(tab, { existing: true });
          container.appendChild(tabElement);
          TabsUpdate.updateTab(tab, tab, { forceApply: true });
          tryStartHandleAccelKeyOnTab(tab);
        }
        Tabs.allElementsContainer.appendChild(container);
      }
      catch(e) {
        log(`failed to build tabs for ${window.id}`, e);
      }
      restoredFromCache[window.id] = false;
    });
    for (const tab of Tabs.getAllTabs(window.id).filter(Tabs.isGroupTab)) {
      if (!Tabs.isDiscarded(tab))
        tab.$TST.shouldReloadOnSelect = true;
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
      /^(about|chrome|resource):/.test(tab.url))
    return;
  try {
    //log(`tryStartHandleAccelKeyOnTab: initialize tab ${tab.id}`);
    browser.tabs.executeScript(tab.id, {
      file:            '/common/handle-accel-key.js',
      allFrames:       true,
      matchAboutBlank: true,
      runAt:           'document_start'
    }).catch(ApiTabs.handleMissingTabError);
  }
  catch(error) {
    console.log(error);
  }
}

export function reserveToUpdateInsertionPosition(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!Tabs.ensureLivingTab(tab))
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
  if (!Tabs.ensureLivingTab(tab))
    return;

  const prev = Tabs.getPreviousTab(tab);
  if (prev)
    browser.sessions.setTabValue(
      tab.id,
      Constants.kPERSISTENT_INSERT_AFTER,
      prev.$TST.uniqueId.id
    );
  else
    browser.sessions.removeTabValue(
      tab.id,
      Constants.kPERSISTENT_INSERT_AFTER
    );

  const next = Tabs.getNextTab(tab);
  if (next)
    browser.sessions.setTabValue(
      tab.id,
      Constants.kPERSISTENT_INSERT_BEFORE,
      next.$TST.uniqueId.id
    );
  else
    browser.sessions.removeTabValue(
      tab.id,
      Constants.kPERSISTENT_INSERT_BEFORE
    );
}


export function reserveToUpdateAncestors(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!Tabs.ensureLivingTab(tab))
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
  if (!Tabs.ensureLivingTab(tab))
    return;

  browser.sessions.setTabValue(
    tab.id,
    Constants.kPERSISTENT_ANCESTORS,
    Tabs.getAncestorTabs(tab).map(ancestor => ancestor.$TST.uniqueId.id)
  );
}

export function reserveToUpdateChildren(tabOrTabs) {
  const tabs = Array.isArray(tabOrTabs) ? tabOrTabs : [tabOrTabs] ;
  for (const tab of tabs) {
    if (!Tabs.ensureLivingTab(tab))
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
  if (!Tabs.ensureLivingTab(tab))
    return;

  browser.sessions.setTabValue(
    tab.id,
    Constants.kPERSISTENT_CHILDREN,
    Tabs.getChildTabs(tab).map(child => child.$TST.uniqueId.id)
  );
}

function reserveToUpdateSubtreeCollapsed(tab) {
  if (!mInitialized ||
      !Tabs.ensureLivingTab(tab))
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
  if (!Tabs.ensureLivingTab(tab))
    return;
  if (Tabs.isSubtreeCollapsed(tab))
    Tabs.addState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED, { permanently: true });
  else
    Tabs.removeState(tab, Constants.kTAB_STATE_SUBTREE_COLLAPSED, { permanently: true });
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
  });

  const granted = await Permissions.isGranted(Permissions.ALL_URLS);
  if (!granted ||
      /^(about|chrome|resource):/.test(tabs[0].url) ||
      (!options.showInTab &&
       SidebarStatus.isOpen(options.windowId) &&
       SidebarStatus.hasFocus(options.windowId)))
    return browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_CONFIRM_TO_CLOSE_TABS,
      tabIds:   tabs.map(tab => tab.id),
      windowId: options.windowId
    });

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
      }).catch(ApiTabs.handleMissingTabError);
      if (shorthand == 'group')
        Tabs.addState(tab, Constants.kTAB_STATE_GROUP_TAB, { permanently: true });
    });
  }

  if (changeInfo.status || changeInfo.url)
    tryStartHandleAccelKeyOnTab(tab);
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

Tree.onDetached.addListener(async (tab, detachInfo) => {
  reserveToUpdateAncestors([tab].concat(Tabs.getDescendantTabs(tab)));
  reserveToUpdateChildren(detachInfo.oldParentTab);
});

Tree.onSubtreeCollapsedStateChanging.addListener((tab, _info) => { reserveToUpdateSubtreeCollapsed(tab); });

// This section should be removed and define those context-fill icons
// statically on manifest.json after Firefox ESR66 (or 67) is released.
// See also: https://github.com/piroor/treestyletab/issues/2053
async function applyThemeColorToIcon() {
  const browserInfo = await browser.runtime.getBrowserInfo();
  if (configs.applyThemeColorToIcon &&
      parseInt(browserInfo.version.split('.')[0]) >= 62) {
    const icons = { path: browser.runtime.getManifest().variable_color_icons };
    browser.browserAction.setIcon(icons);
    browser.sidebarAction.setIcon(icons);
  }
}
configs.$addObserver(key => {
  if (key == 'applyThemeColorToIcon')
    applyThemeColorToIcon();
});
configs.$loaded.then(applyThemeColorToIcon);
