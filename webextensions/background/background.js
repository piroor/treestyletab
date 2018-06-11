/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

log.context = 'BG';

var gInitializing           = true;
var gSidebarOpenState       = new Map();
var gSidebarFocusState      = new Map();
var gExternalListenerAddons = null;
var gMaybeTabSwitchingByShortcut = false;
var gTabSwitchedByShortcut       = false;

MetricsData.add('Loaded');

window.addEventListener('DOMContentLoaded', init, { once: true });

async function init() {
  MetricsData.add('init start');
  window.addEventListener('pagehide', destroy, { once: true });

  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
  browser.commands.onCommand.addListener(onShortcutCommand);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  browser.windows.onFocusChanged.addListener(() => {
    gMaybeTabSwitchingByShortcut = false;
  });
  startWatchSidebarOpenState();

  await configs.$loaded;
  MetricsData.add('configs.$loaded');

  migrateLegacyConfigs();
  MetricsData.add('migrateLegacyConfigs');

  updatePanelUrl();

  await MetricsData.addAsync('parallel initialization tasks: waitUntilCompletelyRestored, ContextualIdentities.init', Promise.all([
    waitUntilCompletelyRestored(),
    ContextualIdentities.init()
  ]));
  var restoredFromCache = await rebuildAll();
  MetricsData.add(`rebuildAll (cached: ${JSON.stringify(restoredFromCache)})`);
  await loadTreeStructure(restoredFromCache);
  MetricsData.add('loadTreeStructure done');

  migrateLegacyTreeStructure();
  MetricsData.add('migrateLegacyTreeStructure');

  startObserveApiTabs();
  ContextualIdentities.startObserve();
  browser.runtime.onMessage.addListener(onMessage);

  tabContextMenu.init();

  ContextMenu.refreshItems();
  configs.$addObserver(aKey => {
    switch (aKey) {
      case 'useCachedTree':
        browser.windows.getAll({
          populate:    true,
          windowTypes: ['normal']
        }).then(aWindows => {
          for (let window of aWindows) {
            let owner = window.tabs[window.tabs.length - 1];
            if (configs[aKey]) {
              reserveToCacheTree(owner.windowId);
            }
            else {
              clearWindowCache(owner.id);
              location.reload();
            }
          }
        });
        break;

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
      reserveToCacheTree(parseInt(windowId));
  }

  Tabs.getAllTabs().forEach(updateSubtreeCollapsed);
  for (let tab of Tabs.getCurrentTabs()) {
    for (let ancestor of Tabs.getAncestorTabs(tab)) {
      collapseExpandTabAndSubtree(ancestor, {
        collapsed: false,
        justNow:   true
      });
    }
  }

  await readyForExternalAddons();

  gInitializing = false;

  // notify that the master process is ready.
  browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PING_TO_SIDEBAR
  });

  notifyNewFeatures();
  log(`Startup metrics for ${Tabs.getTabs().length} tabs: `, MetricsData.toString());
}

function updatePanelUrl() {
  var panel = browser.extension.getURL(`/sidebar/sidebar.html?style=${encodeURIComponent(configs.style)}`);
  browser.sidebarAction.setPanel({ panel });
}

function waitUntilCompletelyRestored() {
  log('waitUntilCompletelyRestored');
  return new Promise((aResolve, aReject) => {
    var onNewTabRestored = async (aNewApiTab) => {
      clearTimeout(timeout);
      log('new restored tab is detected.');
      var uniqueId = await browser.sessions.getTabValue(aNewApiTab.id, Constants.kPERSISTENT_ID);
      //uniqueId = uniqueId && uniqueId.id || '?'; // not used
      timeout = setTimeout(resolver, 100);
    };
    browser.tabs.onCreated.addListener(onNewTabRestored);
    var resolver = (() => {
      log('timeout: all tabs are restored.');
      browser.tabs.onCreated.removeListener(onNewTabRestored);
      timeout = resolver = onNewTabRestored = undefined;
      aResolve();
    });
    var timeout = setTimeout(resolver, 500);
  });
}

function destroy() {
  browser.runtime.sendMessage(browser.runtime.id, {
    type:  Constants.kTSTAPI_UNREGISTER_SELF
  });

  // This API doesn't work as expected because it is not notified to
  // other addons actually when browser.runtime.sendMessage() is called
  // on pagehide or something unloading event.
  sendTSTAPIMessage({
    type: Constants.kTSTAPI_NOTIFY_SHUTDOWN
  });

  browser.runtime.onMessage.removeListener(onMessage);
  browser.runtime.onMessageExternal.removeListener(onMessageExternal);
  browser.browserAction.onClicked.removeListener(onToolbarButtonClick);
  endObserveApiTabs();
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
        restoredFromCache[aWindow.id] = await restoreWindowFromEffectiveWindowCache(aWindow.id, {
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
        updateTab(newTab, apiTab, { forceApply: true });
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

async function tryStartHandleAccelKeyOnTab(aTab) {
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
async function tryInitGroupTab(aTab) {
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
    file:  '/common/l10n.js'
  }));
  browser.tabs.executeScript(aTab.apiTab.id, Object.assign({}, scriptOptions, {
    file:  '/resources/group-tab.js'
  }));
}

function startWatchSidebarOpenState() {
  var matcher = new RegExp(`^${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}`);
  browser.runtime.onConnect.addListener(aPort => {
    if (!matcher.test(aPort.name))
      return;
    const windowId = parseInt(aPort.name.replace(matcher, ''));
    gSidebarOpenState.set(windowId, true);
    sendTSTAPIMessage({
      type:   Constants.kTSTAPI_NOTIFY_SIDEBAR_SHOW,
      window: windowId
    });
    aPort.onDisconnect.addListener(aMessage => {
      gSidebarOpenState.delete(windowId);
      gSidebarFocusState.delete(windowId);
      sendTSTAPIMessage({
        type:   Constants.kTSTAPI_NOTIFY_SIDEBAR_HIDE,
        window: windowId
      });
    });
  });
}


async function readyForExternalAddons() {
  gExternalListenerAddons = {};
  const manifest = browser.runtime.getManifest();
  gExternalListenerAddons[manifest.applications.gecko.id] = {
    id:         manifest.applications.gecko.id,
    internalId: browser.runtime.getURL('').replace(/^moz-extension:\/\/([^\/]+)\/.*$/, '$1'),
    icons:      manifest.icons,
    listeningTypes: []
  };
  var respondedAddons = [];
  var notifiedAddons = {};
  var notifyAddons = configs.knownExternalAddons.concat(configs.cachedExternalAddons);
  await Promise.all(notifyAddons.map(async aId => {
    if (aId in notifiedAddons)
      return;
    notifiedAddons[aId] = true;
    try {
      let success = await browser.runtime.sendMessage(aId, {
        type: Constants.kTSTAPI_NOTIFY_READY
      });
      if (success)
        respondedAddons.push(aId);
    }
    catch(e) {
    }
  }));
  configs.cachedExternalAddons = respondedAddons;
}


// save/load tree structure

function reserveToSaveTreeStructure(aHint) {
  if (gInitializing)
    return;

  var container = Tabs.getTabsContainer(aHint);
  if (!container)
    return;

  if (container.waitingToSaveTreeStructure)
    clearTimeout(container.waitingToSaveTreeStructure);
  container.waitingToSaveTreeStructure = setTimeout(aWindowId => {
    saveTreeStructure(aWindowId);
  }, 150, parseInt(container.dataset.windowId));
}
async function saveTreeStructure(aWindowId) {
  var container = Tabs.getTabsContainer(aWindowId);
  if (!container)
    return;

  var structure = getTreeStructureFromTabs(Tabs.getAllTabs(aWindowId));
  browser.sessions.setWindowValue(
    aWindowId,
    Constants.kWINDOW_STATE_TREE_STRUCTURE,
    structure
  );
}

async function loadTreeStructure(aRestoredFromCacheResults) {
  log('loadTreeStructure');
  var windows = await browser.windows.getAll({
    windowTypes: ['normal']
  });
  MetricsData.add('loadTreeStructure: browser.windows.getAll');
  return MetricsData.addAsync('loadTreeStructure: restoration for windows', Promise.all(windows.map(async aWindow => {
    if (aRestoredFromCacheResults &&
        aRestoredFromCacheResults[aWindow.id]) {
      log(`skip tree structure restoration for window ${aWindow.id} (restored from cache)`);
      return;
    }
    var tabs = Tabs.getAllTabs(aWindow.id);
    var [structure, uniqueIds] = await Promise.all([
      browser.sessions.getWindowValue(aWindow.id, Constants.kWINDOW_STATE_TREE_STRUCTURE),
      getUniqueIds(tabs.map(aTab => aTab.apiTab))
    ]);
    MetricsData.add('loadTreeStructure: read stored data');
    var windowStateCompletelyApplied = false;
    if (structure && structure.length <= tabs.length) {
      uniqueIds = uniqueIds.map(aId => aId.id);
      let tabsOffset, windowStateCompletelyApplied;
      if (structure[0].id) {
        tabsOffset = uniqueIds.join('\n').indexOf(structure.map(aItem => aItem.id).join('\n'));
        windowStateCompletelyApplied = tabsOffset > -1;
      }
      else {
        tabsOffset = 0;
        windowStateCompletelyApplied = structure.length == tabs.length;
      }
      if (tabsOffset > -1) {
        await applyTreeStructureToTabs(tabs.slice(tabsOffset), structure);
        MetricsData.add('loadTreeStructure: applyTreeStructureToTabs');
      }
    }
    if (!windowStateCompletelyApplied) {
      log(`Tree information for the window ${aWindow.id} is not same to actual state. Fallback to restoration from tab relations.`);
      for (let tab of tabs) {
        reserveToAttachTabFromRestoredInfo(tab, {
          keepCurrentTree: true,
          canCollapse:     true
        });
      }
      await reserveToAttachTabFromRestoredInfo.promisedDone;
      MetricsData.add('loadTreeStructure: attachTabFromRestoredInfo');
    }
    Tabs.dumpAllTabs();
  })));
}

function reserveToAttachTabFromRestoredInfo(aTab, aOptions = {}) {
  if (reserveToAttachTabFromRestoredInfo.waiting)
    clearTimeout(reserveToAttachTabFromRestoredInfo.waiting);
  reserveToAttachTabFromRestoredInfo.tasks.push({ tab: aTab, options: aOptions });
  if (!reserveToAttachTabFromRestoredInfo.promisedDone) {
    reserveToAttachTabFromRestoredInfo.promisedDone = new Promise((aResolve, aReject) => {
      reserveToAttachTabFromRestoredInfo.onDone = aResolve;
    });
  }
  reserveToAttachTabFromRestoredInfo.waiting = setTimeout(async () => {
    reserveToAttachTabFromRestoredInfo.waiting = null;
    var tasks = reserveToAttachTabFromRestoredInfo.tasks.slice(0);
    reserveToAttachTabFromRestoredInfo.tasks = [];
    var uniqueIds = await Promise.all(tasks.map(aTask => aTask.tab.uniqueId));
    var bulk = tasks.length > 1;
    await Promise.all(uniqueIds.map((aUniqueId, aIndex) => {
      var task = tasks[aIndex];
      return attachTabFromRestoredInfo(task.tab, Object.assign({}, task.options, {
        uniqueId: aUniqueId,
        bulk
      }));
    }));
    reserveToAttachTabFromRestoredInfo.onDone();
    delete reserveToAttachTabFromRestoredInfo.onDone;
    delete reserveToAttachTabFromRestoredInfo.promisedDone;
    Tabs.dumpAllTabs();
  }, 100);
}
reserveToAttachTabFromRestoredInfo.waiting = null;
reserveToAttachTabFromRestoredInfo.tasks   = [];
reserveToAttachTabFromRestoredInfo.promisedDone = null;

async function attachTabFromRestoredInfo(aTab, aOptions = {}) {
  log('attachTabFromRestoredInfo ', dumpTab(aTab), aTab.apiTab);
  browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_NOTIFY_TAB_RESTORING,
    tab:    aTab.apiTab.id,
    window: aTab.apiTab.windowId
  });
  var uniqueId = aOptions.uniqueId || await aTab.uniqueId;
  var container = Tabs.getTabsContainer(aTab);
  var insertBefore, insertAfter, ancestors, children, collapsed;
  [insertBefore, insertAfter, ancestors, children, collapsed] = await Promise.all([
    browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_INSERT_BEFORE),
    browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_INSERT_AFTER),
    browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_ANCESTORS),
    browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_CHILDREN),
    browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_SUBTREE_COLLAPSED)
  ]);
  ancestors = ancestors || [];
  children  = children  || [];
  log(`persistent references for ${aTab.id} (${uniqueId.id}): `, {
    insertBefore, insertAfter,
    ancestors: ancestors.join(', '),
    children:  children.join(', '),
    collapsed
  });
  insertBefore = Tabs.getTabByUniqueId(insertBefore);
  insertAfter  = Tabs.getTabByUniqueId(insertAfter);
  ancestors    = ancestors.map(Tabs.getTabByUniqueId);
  children     = children.map(Tabs.getTabByUniqueId);
  log(' => references: ', {
    insertBefore: dumpTab(insertBefore),
    insertAfter:  dumpTab(insertAfter),
    ancestors:    ancestors.map(dumpTab).join(', '),
    children:     children.map(dumpTab).join(', ')
  });
  var attached = false;
  var active   = Tabs.isActive(aTab);
  for (let ancestor of ancestors) {
    if (!ancestor)
      continue;
    let done = attachTabTo(aTab, ancestor, {
      insertBefore,
      insertAfter,
      dontExpand:  !active,
      forceExpand: active,
      broadcast:   true
    });
    if (!aOptions.bulk)
      await done;
    attached = true;
    break;
  }
  if (!attached) {
    let opener = Tabs.getOpenerTab(aTab);
    if (opener &&
        configs.syncParentTabAndOpenerTab) {
      log(' attach to opener: ', { child: dumpTab(aTab), parent: dumpTab(opener) });
      let done = attachTabTo(aTab, opener, {
        dontExpand:  !active,
        forceExpand: active,
        broadcast:   true,
        insertAt:    Constants.kINSERT_NEAREST
      });
      if (!aOptions.bulk)
        await done;
    }
    else if (!aOptions.bulk &&
             (Tabs.getNextNormalTab(aTab) ||
              Tabs.getPreviousNormalTab(aTab))) {
      log(' attach from position');
      await tryFixupTreeForInsertedTab(aTab, {
        toIndex:   aTab.apiTab.index,
        fromIndex: Tabs.getTabIndex(Tabs.getLastTab(aTab))
      });
    }
  }
  if (!aOptions.keepCurrentTree &&
      // the restored tab is a roo tab
      ancestors.length == 0 &&
      // but attached to any parent based on its restored position
      Tabs.getParentTab(aTab) &&
      // when not in-middle position of existing tree (safely detachable position)
      !Tabs.getNextSiblingTab(aTab)) {
    detachTab(aTab, {
      broadcast: true
    });
  }
  if (aOptions.children && !aOptions.bulk) {
    for (let child of children) {
      if (!child)
        continue;
      await attachTabTo(child, aTab, {
        dontExpand:  !Tabs.isActive(child),
        forceExpand: active,
        insertAt:    Constants.kINSERT_NEAREST,
        broadcast:   true
      });
    }
  }

  if (aOptions.canCollapse || aOptions.bulk) {
    collapseExpandSubtree(aTab, {
      broadcast: true,
      collapsed
    });
  }
  browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_NOTIFY_TAB_RESTORED,
    tab:    aTab.apiTab.id,
    window: aTab.apiTab.windowId
  });
}


function reserveToUpdateInsertionPosition(aTabOrTabs) {
  var tabs = Array.isArray(aTabOrTabs) ? aTabOrTabs : [aTabOrTabs] ;
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

  var prev = Tabs.getPreviousTab(aTab);
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

  var next = Tabs.getNextTab(aTab);
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

function reserveToUpdateAncestors(aTabOrTabs) {
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

function reserveToUpdateChildren(aTabOrTabs) {
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

function reserveToUpdateSubtreeCollapsed(aTab) {
  if (gInitializing ||
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

function reserveToCleanupNeedlessGroupTab(aTabOrTabs) {
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
  removeTabsInternally(tabsToBeRemoved);
}

function reserveToUpdateRelatedGroupTabs(aTab) {
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


async function confirmToCloseTabs(aCount, aOptions = {}) {
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
       gSidebarOpenState.get(aOptions.windowId) &&
       gSidebarFocusState.get(aOptions.windowId)))
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
