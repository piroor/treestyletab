/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
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
import TabFavIconHelper from '../common/TabFavIconHelper.js';
import RichConfirm from '../common/RichConfirm.js';
import EventListenerManager from '../common/EventListenerManager.js';

import * as TreeStructure from './tree-structure.js';
import * as BackgroundCache from './cache.js';
import * as ContextMenu from './context-menu.js';
import * as TabContextMenu from './tab-context-menu.js';

export const onInit    = new EventListenerManager();
export const onBuilt   = new EventListenerManager();
export const onReady   = new EventListenerManager();
export const onDestroy = new EventListenerManager();

let gInitialized = false;

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
  var restoredFromCache = await rebuildAll();
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
  configs.$addObserver(aKey => {
    switch (aKey) {
      case 'style':
        updatePanelUrl();
        break;

      default:
        if (aKey.indexOf('context_') == 0)
          ContextMenu.refreshItems();
        break;
    }
  });

  Permissions.clearRequest();

  for (let windowId of Object.keys(restoredFromCache)) {
    if (!restoredFromCache[windowId])
      BackgroundCache.reserveToCacheTree(parseInt(windowId));
  }

  Tabs.getAllTabs().forEach(updateSubtreeCollapsed);
  for (let tab of Tabs.getCurrentTabs()) {
    for (let ancestor of Tabs.getAncestorTabs(tab)) {
      Tree.collapseExpandTabAndSubtree(ancestor, {
        collapsed: false,
        justNow:   true
      });
    }
  }

  await TSTAPI.init();

  gInitialized = true;
  onReady.dispatch();
  BackgroundCache.activate();

  // notify that the master process is ready.
  browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PING_TO_SIDEBAR
  });

  Migration.notifyNewFeatures();
  log(`Startup metrics for ${Tabs.getTabs().length} tabs: `, MetricsData.toString());
}

function updatePanelUrl() {
  var panel = browser.extension.getURL(`/sidebar/sidebar.html?style=${encodeURIComponent(configs.style)}`);
  browser.sidebarAction.setPanel({ panel });
}

function waitUntilCompletelyRestored() {
  log('waitUntilCompletelyRestored');
  return new Promise((aResolve, _aReject) => {
    let timeout;
    let resolver;
    let onNewTabRestored = async (aNewApiTab) => {
      clearTimeout(timeout);
      log('new restored tab is detected.');
      await browser.sessions.getTabValue(aNewApiTab.id, Constants.kPERSISTENT_ID);
      //uniqueId = uniqueId && uniqueId.id || '?'; // not used
      timeout = setTimeout(resolver, 100);
    };
    browser.tabs.onCreated.addListener(onNewTabRestored);
    resolver = (() => {
      log('timeout: all tabs are restored.');
      browser.tabs.onCreated.removeListener(onNewTabRestored);
      timeout = resolver = onNewTabRestored = undefined;
      aResolve();
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
  var windows = await browser.windows.getAll({
    populate:    true,
    windowTypes: ['normal']
  });
  var insertionPoint = document.createRange();
  insertionPoint.selectNodeContents(Tabs.allTabsContainer);
  var restoredFromCache = {};
  await Promise.all(windows.map(async (aWindow) => {
    await MetricsData.addAsync(`rebuild ${aWindow.id}`, async () => {
      if (configs.useCachedTree) {
        restoredFromCache[aWindow.id] = await BackgroundCache.restoreWindowFromEffectiveWindowCache(aWindow.id, {
          insertionPoint,
          owner: aWindow.tabs[aWindow.tabs.length - 1],
          tabs:  aWindow.tabs
        });
        for (let tab of Tabs.getAllTabs(aWindow.id)) {
          tryStartHandleAccelKeyOnTab(tab);
        }
        if (restoredFromCache[aWindow.id]) {
          log(`window ${aWindow.id} is restored from cache`);
          return;
        }
      }
      log(`build tabs for ${aWindow.id} from scratch`);
      let container = TabsContainer.buildFor(aWindow.id);
      for (let apiTab of aWindow.tabs) {
        let newTab = Tabs.buildTab(apiTab, { existing: true });
        container.appendChild(newTab);
        TabsUpdate.updateTab(newTab, apiTab, { forceApply: true });
        tryStartHandleAccelKeyOnTab(newTab);
      }
      Tabs.allTabsContainer.appendChild(container);
      restoredFromCache[aWindow.id] = false;
    });
    for (let tab of Tabs.getAllTabs(aWindow.id).filter(Tabs.isGroupTab)) {
      if (!Tabs.isDiscarded(tab))
        tab.dataset.shouldReloadOnSelect = true;
    }
  }));
  insertionPoint.detach();
  return restoredFromCache;
}

export async function tryStartHandleAccelKeyOnTab(aTab) {
  if (!Tabs.ensureLivingTab(aTab))
    return;
  var granted = await Permissions.isGranted(Permissions.ALL_URLS);
  if (!granted ||
      /^(about|chrome|resource):/.test(aTab.apiTab.url))
    return;
  try {
    //log(`tryStartHandleAccelKeyOnTab: initialize tab ${aTab.id}`);
    browser.tabs.executeScript(aTab.apiTab.id, {
      file:            '/common/handle-accel-key.js',
      allFrames:       true,
      matchAboutBlank: true,
      runAt:           'document_start'
    });
  }
  catch(aError) {
    console.log(aError);
  }
}

/*
  To prevent the tab is closed by Firefox, we need to inject scripts dynamically.
  See also: https://github.com/piroor/treestyletab/issues/1670#issuecomment-350964087
*/
export async function tryInitGroupTab(aTab) {
  if (!Tabs.isGroupTab(aTab) &&
      aTab.apiTab.url.indexOf(Constants.kGROUP_TAB_URI) != 0)
    return;
  var scriptOptions = {
    runAt:           'document_start',
    matchAboutBlank: true
  };
  var initialized = await browser.tabs.executeScript(aTab.apiTab.id, Object.assign({}, scriptOptions, {
    code:  'window.init && window.init.done',
  }));
  if (initialized[0])
    return;
  browser.tabs.executeScript(aTab.apiTab.id, Object.assign({}, scriptOptions, {
    //file:  '/common/l10n.js'
    file:  '/resources/l10n.js' // ES module does not supported as a content script...
  }));
  browser.tabs.executeScript(aTab.apiTab.id, Object.assign({}, scriptOptions, {
    file:  '/resources/group-tab.js'
  }));
}

export function reserveToUpdateInsertionPosition(aTabOrTabs) {
  const tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
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

async function updateInsertionPosition(aTab) {
  if (!Tabs.ensureLivingTab(aTab))
    return;

  const prev = Tabs.getPreviousTab(aTab);
  if (prev)
    prev.uniqueId.then(aId =>
      browser.sessions.setTabValue(
        aTab.apiTab.id,
        Constants.kPERSISTENT_INSERT_AFTER,
        aId.id
      )
    );
  else
    browser.sessions.removeTabValue(
      aTab.apiTab.id,
      Constants.kPERSISTENT_INSERT_AFTER
    );

  const next = Tabs.getNextTab(aTab);
  if (next)
    next.uniqueId.then(aId =>
      browser.sessions.setTabValue(
        aTab.apiTab.id,
        Constants.kPERSISTENT_INSERT_BEFORE,
        aId.id
      )
    );
  else
    browser.sessions.removeTabValue(
      aTab.apiTab.id,
      Constants.kPERSISTENT_INSERT_BEFORE
    );
}


export function reserveToUpdateAncestors(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
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

async function updateAncestors(aTab) {
  if (!Tabs.ensureLivingTab(aTab))
    return;

  var ancestorIds = await Promise.all(
    Tabs.getAncestorTabs(aTab)
      .map(aAncestor => aAncestor.uniqueId)
  );
  browser.sessions.setTabValue(
    aTab.apiTab.id,
    Constants.kPERSISTENT_ANCESTORS,
    ancestorIds.map(aId => aId.id)
  );
}

export function reserveToUpdateChildren(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
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

async function updateChildren(aTab) {
  if (!Tabs.ensureLivingTab(aTab))
    return;

  var childIds = await Promise.all(
    Tabs.getChildTabs(aTab)
      .map(aChild => aChild.uniqueId)
  );
  browser.sessions.setTabValue(
    aTab.apiTab.id,
    Constants.kPERSISTENT_CHILDREN,
    childIds.map(aId => aId.id)
  );
}

export function reserveToUpdateSubtreeCollapsed(aTab) {
  if (!gInitialized ||
      !Tabs.ensureLivingTab(aTab))
    return;
  if (aTab.reservedUpdateSubtreeCollapsed)
    clearTimeout(aTab.reservedUpdateSubtreeCollapsed);
  aTab.reservedUpdateSubtreeCollapsed = setTimeout(() => {
    delete aTab.reservedUpdateSubtreeCollapsed;
    updateSubtreeCollapsed(aTab);
  }, 100);
}

async function updateSubtreeCollapsed(aTab) {
  if (!Tabs.ensureLivingTab(aTab))
    return;
  browser.sessions.setTabValue(
    aTab.apiTab.id,
    Constants.kPERSISTENT_SUBTREE_COLLAPSED,
    Tabs.isSubtreeCollapsed(aTab)
  );
}

export function reserveToCleanupNeedlessGroupTab(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
  for (let tab of tabs) {
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

function cleanupNeedlssGroupTab(aTabs) {
  if (!Array.isArray(aTabs))
    aTabs = [aTabs];
  log('trying to clanup needless temporary group tabs from ', aTabs.map(dumpTab));
  var tabsToBeRemoved = [];
  for (let tab of aTabs) {
    if (!Tabs.isTemporaryGroupTab(tab))
      break;
    if (Tabs.getChildTabs(tab).length > 1)
      break;
    let lastChild = Tabs.getFirstChildTab(tab);
    if (lastChild && !Tabs.isTemporaryGroupTab(lastChild))
      break;
    tabsToBeRemoved.push(tab);
  }
  log('=> to be removed: ', tabsToBeRemoved.map(dumpTab));
  TabsInternalOperation.removeTabs(tabsToBeRemoved);
}

export function reserveToUpdateRelatedGroupTabs(aTab) {
  const ancestorGroupTabs = [aTab]
    .concat(Tabs.getAncestorTabs(aTab))
    .filter(Tabs.isGroupTab);
  for (let tab of ancestorGroupTabs) {
    if (tab.reservedUpdateRelatedGroupTab)
      clearTimeout(tab.reservedUpdateRelatedGroupTab);
    tab.reservedUpdateRelatedGroupTab = setTimeout(() => {
      delete tab.reservedUpdateRelatedGroupTab;
      updateRelatedGroupTab(tab);
    }, 100);
  }
}

async function updateRelatedGroupTab(aGroupTab) {
  if (!Tabs.ensureLivingTab(aGroupTab))
    return;

  await tryInitGroupTab(aGroupTab);
  await browser.tabs.executeScript(aGroupTab.apiTab.id, {
    runAt:           'document_start',
    matchAboutBlank: true,
    code:            `updateTree()`,
  });

  let newTitle;
  if (Constants.kGROUP_TAB_DEFAULT_TITLE_MATCHER.test(aGroupTab.apiTab.title)) {
    const firstChild = Tabs.getFirstChildTab(aGroupTab);
    newTitle = browser.i18n.getMessage('groupTab_label', firstChild.apiTab.title);
  }
  else if (Constants.kGROUP_TAB_FROM_PINNED_DEFAULT_TITLE_MATCHER.test(aGroupTab.apiTab.title)) {
    const opener = Tabs.getOpenerFromGroupTab(aGroupTab);
    if (opener) {
      if (opener &&
           (opener.apiTab.favIconUrl ||
            TabFavIconHelper.maybeImageTab(opener.apiTab))) {
        browser.runtime.sendMessage({
          type:       Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED,
          tab:        aGroupTab.id,
          favIconUrl: Tabs.getSafeFaviconUrl(opener.apiTab.favIconUrl || opener.apiTab.url)
        });
      }
      newTitle = browser.i18n.getMessage('groupTab_fromPinnedTab_label', opener.apiTab.title);
    }
  }

  if (newTitle && aGroupTab.apiTab.title != newTitle) {
    const url = aGroupTab.apiTab.url.replace(/title=[^&]+/, `title=${encodeURIComponent(newTitle)}`);
    browser.tabs.update(aGroupTab.apiTab.id, { url });
  }
}


export async function confirmToCloseTabs(aCount, aOptions = {}) {
  if (aCount <= 1 ||
      !configs.warnOnCloseTabs ||
      Date.now() - configs.lastConfirmedToCloseTabs < 500)
    return true;

  const apiTabs = await browser.tabs.query({
    active:   true,
    windowId: aOptions.windowId
  });

  const granted = await Permissions.isGranted(Permissions.ALL_URLS);
  if (!granted ||
      /^(about|chrome|resource):/.test(apiTabs[0].url) ||
      (!aOptions.showInTab &&
       SidebarStatus.isOpen(aOptions.windowId) &&
       SidebarStatus.hasFocus(aOptions.windowId)))
    return browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_CONFIRM_TO_CLOSE_TABS,
      count:    aCount,
      windowId: aOptions.windowId
    });

  const result = await RichConfirm.showInTab(apiTabs[0].id, {
    message: browser.i18n.getMessage('warnOnCloseTabs_message', [aCount]),
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
