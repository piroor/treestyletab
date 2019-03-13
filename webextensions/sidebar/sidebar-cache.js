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
import * as Tree from '/common/tree.js';
import * as MetricsData from '/common/metrics-data.js';

import Tab from '/common/Tab.js';

import * as DOMCache from './dom-cache.js';
import * as SidebarTabs from './sidebar-tabs.js';
import * as Indent from './indent.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('sidebar/sidebar-cache', ...args);
}

export const onRestored = new EventListenerManager();

let mTracking = false;

let mLastWindowCacheOwner;
let mTargetWindow;
let mTabBar;

export function init() {
  mTargetWindow = TabsStore.getWindow();
  mTabBar       = document.querySelector('#tabbar');
}

export function startTracking() {
  mTracking = true;
  configs.$addObserver(onConfigChange);
}

export async function getEffectiveWindowCache(options = {}) {
  MetricsData.add('getEffectiveWindowCache start');
  log('getEffectiveWindowCache: start');
  cancelReservedUpdateCachedTabbar(); // prevent to break cache before loading
  let cache;
  let cachedSignature;
  let actualSignature;
  await Promise.all([
    (async () => {
      const tabs = await browser.tabs.query({ currentWindow: true }).catch(ApiTabs.createErrorHandler());
      mLastWindowCacheOwner = tabs[tabs.length - 1];
      // We cannot define constants with variables at a time like:
      //   [cache, const tabsDirty, const collapsedDirty] = await Promise.all([
      let tabsDirty, collapsedDirty;
      [cache, tabsDirty, collapsedDirty] = await Promise.all([
        getWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR),
        getWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY),
        getWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY)
      ]);
      cachedSignature = cache && cache.signature;
      log(`getEffectiveWindowCache: got from the owner `, mLastWindowCacheOwner, {
        cachedSignature, cache, tabsDirty, collapsedDirty
      });
      if (cache &&
          cache.tabs &&
          cachedSignature &&
          cachedSignature != DOMCache.signatureFromTabsCache(cache.tabbar.contents)) {
        log('getEffectiveWindowCache: cache is broken.', {
          signature: cachedSignature,
          cache:     DOMCache.signatureFromTabsCache(cache.tabbar.contents)
        });
        cache = cachedSignature = null;
        clearWindowCache();
      }
      if (options.ignorePinnedTabs &&
          cache &&
          cache.tabbar &&
          cache.tabbar.contents &&
          cachedSignature) {
        cache.tabbar.contents = DOMCache.trimTabsCache(cache.tabbar.contents, cache.tabbar.pinnedTabsCount);
        cachedSignature       = DOMCache.trimSignature(cachedSignature, cache.tabbar.pinnedTabsCount);
      }
      MetricsData.add('getEffectiveWindowCache get ' + JSON.stringify({
        cache: !!cache,
        version: cache && cache.version
      }));
      log('getEffectiveWindowCache: verify cache (1)', { cache, tabsDirty, collapsedDirty });
      if (cache && cache.version == Constants.kSIDEBAR_CONTENTS_VERSION) {
        log('getEffectiveWindowCache: restore sidebar from cache');
        cache.tabbar.tabsDirty      = tabsDirty;
        cache.tabbar.collapsedDirty = collapsedDirty;
        cache.signature = cachedSignature;
      }
      else {
        log('getEffectiveWindowCache: invalid cache ', cache);
        cache = null;
      }
    })(),
    (async () => {
      actualSignature = await DOMCache.getWindowSignature(mTargetWindow);
    })()
  ]);

  const signatureMatched = DOMCache.matcheSignatures({
    actual: actualSignature,
    cached: cachedSignature
  });
  log('getEffectiveWindowCache: verify cache (2)', {
    cache, actualSignature, cachedSignature, signatureMatched
  });
  if (!cache ||
      !signatureMatched) {
    clearWindowCache();
    cache = null;
    log('getEffectiveWindowCache: failed');
    MetricsData.add('getEffectiveWindowCache fail');
  }
  else {
    cache.offset          = actualSignature.replace(cachedSignature, '').trim().split('\n').filter(part => !!part).length;
    cache.actualSignature = actualSignature;
    log('getEffectiveWindowCache: success ');
    MetricsData.add('getEffectiveWindowCache success');
  }

  return cache;
}

export async function restoreTabsFromCache(cache, params = {}) {
  const offset = params.offset || 0;
  const window = TabsStore.windows.get(mTargetWindow);
  if (offset <= 0) {
    if (window.element)
      window.element.parentNode.removeChild(window.element);
    mTabBar.setAttribute('style', cache.style);
  }

  const restored = (await DOMCache.restoreTabsFromCacheInternal({
    windowId:     mTargetWindow,
    tabs:         params.tabs,
    offset:       offset,
    cache:        cache.contents,
    shouldUpdate: cache.tabsDirty
  })).length > 0;

  if (restored) {
    try {
      if (cache.collapsedDirty) {
        const allTabs = Tab.getAllTabs(mTargetWindow);
        const restoredStructrue = Tree.getTreeStructureFromTabs(allTabs);
        const structure = restoredStructrue.reverse();
        allTabs.reverse().forEach((tab, index) => {
          Tree.collapseExpandSubtree(tab, {
            collapsed: structure[index].collapsed,
            justNow:   true
          });
        });
      }
      SidebarTabs.updateAll();
      onRestored.dispatch();
    }
    catch(e) {
      log(String(e), e.stack);
      throw e;
    }
  }

  return restored;
}

function updateWindowCache(key, value) {
  if (!mLastWindowCacheOwner ||
      !Tab.get(mLastWindowCacheOwner.id))
    return;
  if (value === undefined) {
    //log('updateWindowCache: delete cache from ', mLastWindowCacheOwner, key);
    //return browser.sessions.removeWindowValue(mLastWindowCacheOwner, key).catch(ApiTabs.createErrorSuppressor());
    return browser.sessions.removeTabValue(mLastWindowCacheOwner.id, key).catch(ApiTabs.createErrorSuppressor(ApiTabs.handleMissingTabError));
  }
  else {
    //log('updateWindowCache: set cache for ', mLastWindowCacheOwner, key);
    //return browser.sessions.setWindowValue(mLastWindowCacheOwner, key, value).catch(ApiTabs.createErrorSuppressor());
    return browser.sessions.setTabValue(mLastWindowCacheOwner.id, key, value).catch(ApiTabs.createErrorSuppressor(ApiTabs.handleMissingTabError));
  }
}

function clearWindowCache() {
  log('clearWindowCache ', { stack: new Error().stack });
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

export function markWindowCacheDirty(key) {
  if (markWindowCacheDirty.timeout)
    clearTimeout(markWindowCacheDirty.timeout);
  markWindowCacheDirty.timeout = setTimeout(() => {
    markWindowCacheDirty.timeout = null;
    updateWindowCache(key, true);
  }, 250);
}

async function getWindowCache(key) {
  if (!mLastWindowCacheOwner)
    return null;
  //return browser.sessions.getWindowValue(mLastWindowCacheOwner, key).catch(ApiTabs.createErrorHandler());
  return browser.sessions.getTabValue(mLastWindowCacheOwner.id, key).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
}

function getWindowCacheOwner() {
  return Tab.getLastTab(mTargetWindow);
}

export async function reserveToUpdateCachedTabbar() {
  if (!mTracking ||
      !configs.useCachedTree)
    return;

  // If there is any opening (but not resolved its unique id yet) tab,
  // we are possibly restoring tabs. To avoid cache breakage before
  // restoration, we must wait until we know whether there is any other
  // restoring tab or not.
  if (Tab.needToWaitTracked(null))
    await Tab.waitUntilTrackedAll(null, { element: true });

  const window = TabsStore.windows.get(mTargetWindow);
  if (window.allTabsRestored)
    return;

  log('reserveToUpdateCachedTabbar ', { stack: new Error().stack });
  // clear dirty cache
  clearWindowCache();

  if (updateCachedTabbar.waiting)
    clearTimeout(updateCachedTabbar.waiting);
  updateCachedTabbar.waiting = setTimeout(() => {
    delete updateCachedTabbar.waiting;
    updateCachedTabbar();
  }, 500);
}

function cancelReservedUpdateCachedTabbar() {
  if (updateCachedTabbar.waiting) {
    clearTimeout(updateCachedTabbar.waiting);
    delete updateCachedTabbar.waiting;
  }
}

async function updateCachedTabbar() {
  if (!configs.useCachedTree)
    return;
  if (Tab.needToWaitTracked(mTargetWindow))
    await Tab.waitUntilTrackedAll(mTargetWindow);
  const window    = TabsStore.windows.get(mTargetWindow);
  const signature = await DOMCache.getWindowSignature(mTargetWindow);
  if (window.allTabsRestored)
    return;
  log('updateCachedTabbar ', { stack: new Error().stack });
  mLastWindowCacheOwner = getWindowCacheOwner(mTargetWindow);
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR, {
    version: Constants.kSIDEBAR_CONTENTS_VERSION,
    tabbar: {
      contents:        SidebarTabs.wholeContainer.innerHTML,
      style:           mTabBar.getAttribute('style'),
      pinnedTabsCount: Tab.getPinnedTabs(mTargetWindow).length
    },
    indent: Indent.getCacheInfo(),
    signature
  });
}


Tab.onFaviconUpdated.addListener((_tab, _url) => {
  wait(0).then(() => {
    markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  });
});

Tab.onUpdated.addListener((_tab, _url) => {
  wait(0).then(() => {
    markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  });
});

Tab.onLabelUpdated.addListener(_tab => {
  wait(0).then(() => {
    markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  });
});

Tab.onSoundStateChanged.addListener(async _tab => {
  wait(0).then(() => {
    markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  });
});

Tab.onCreated.addListener((_tab, _info) => {
  wait(0).then(() => {
    reserveToUpdateCachedTabbar();
  });
});

Tab.onRemoved.addListener(async (_tab, _info) => {
  // "Restore Previous Session" closes some tabs at first, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  await wait(0);
  if (configs.animation) {
    await wait(configs.animation ? configs.collapseDuration : 0);
    await reserveToUpdateCachedTabbar();
  }
});

Tab.onMoved.addListener((_tab, _info) => {
  reserveToUpdateCachedTabbar();
});

Tree.onLevelChanged.addListener(_tab => {
  wait(0).then(() => {
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
    reserveToUpdateCachedTabbar();
  });
});

Tab.onDetached.addListener(async (tab, _info) => {
  if (!TabsStore.ensureLivingTab(tab))
    return;
  await wait(0);
  reserveToUpdateCachedTabbar();
});

Tree.onAttached.addListener((_tab, _info) => {
  wait(0).then(() => {
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
    reserveToUpdateCachedTabbar();
  });
});

Tree.onDetached.addListener((_tab, _info) => {
  wait(0).then(() => {
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
    reserveToUpdateCachedTabbar();
  });
});

Tab.onPinned.addListener(_tab => {
  reserveToUpdateCachedTabbar();
});

Tab.onUnpinned.addListener(_tab => {
  reserveToUpdateCachedTabbar();
});

Tab.onShown.addListener(_tab => {
  reserveToUpdateCachedTabbar();
});

Tab.onHidden.addListener(_tab => {
  reserveToUpdateCachedTabbar();
});

function onConfigChange(changedKey) {
  switch (changedKey) {
    case 'useCachedTree':
      if (configs[changedKey]) {
        reserveToUpdateCachedTabbar();
      }
      else {
        clearWindowCache();
        location.reload();
      }
      break;
  }
}
