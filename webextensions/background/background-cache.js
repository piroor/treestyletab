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
import * as Tabs from '/common/tabs.js';
import * as Tree from '/common/tree.js';
import * as Cache from '/common/cache.js';
import * as MetricsData from '/common/metrics-data.js';

function log(...args) {
  internalLogger('background/background-cache', ...args);
}

let mActivated = false;

export function activate() {
  mActivated = true;
  configs.$addObserver(onConfigChange);
}

export async function restoreWindowFromEffectiveWindowCache(windowId, options = {}) {
  MetricsData.add('restoreWindowFromEffectiveWindowCache start');
  log(`restoreWindowFromEffectiveWindowCache for ${windowId} start`);
  const owner = options.owner || getWindowCacheOwner(windowId);
  if (!owner) {
    log(`restoreWindowFromEffectiveWindowCache for ${windowId} fail: no owner`);
    return false;
  }
  cancelReservedCacheTree(windowId); // prevent to break cache before loading
  const apiTabs  = options.tabs || await browser.tabs.query({ windowId: windowId });
  log(`restoreWindowFromEffectiveWindowCache for ${windowId} tabs: `, apiTabs);
  // We cannot define constants with variables at a time like:
  //   [const actualSignature, let cache] = await Promise.all([
  // eslint-disable-next-line prefer-const
  let [actualSignature, cache] = await Promise.all([
    Cache.getWindowSignature(apiTabs),
    getWindowCache(owner, Constants.kWINDOW_STATE_CACHED_TABS)
  ]);
  let cachedSignature = cache && cache.signature;
  log(`restoreWindowFromEffectiveWindowCache for ${windowId}: got from the owner ${owner}`, {
    cachedSignature, cache
  });
  if (cache &&
      cache.tabs &&
      cachedSignature &&
      cachedSignature != Cache.signatureFromTabsCache(cache.tabs)) {
    log(`restoreWindowFromEffectiveWindowCache for ${windowId}: cache is broken.`, {
      signature: cachedSignature,
      cache:     Cache.signatureFromTabsCache(cache.tabs)
    });
    cache = cachedSignature = null;
    clearWindowCache(windowId);
  }
  if (options.ignorePinnedTabs &&
      cache &&
      cache.tabs &&
      cachedSignature) {
    cache.tabs      = Cache.trimTabsCache(cache.tabs, cache.pinnedTabsCount);
    cachedSignature = Cache.trimSignature(cachedSignature, cache.pinnedTabsCount);
  }
  const signatureMatched = Cache.matcheSignatures({
    actual: actualSignature,
    cached: cachedSignature
  });
  log(`restoreWindowFromEffectiveWindowCache for ${windowId}: verify cache`, {
    cache, actualSignature, cachedSignature, signatureMatched
  });
  if (!cache ||
      cache.version != Constants.kBACKGROUND_CONTENTS_VERSION ||
      !signatureMatched) {
    log(`restoreWindowFromEffectiveWindowCache for ${windowId}: no effective cache`);
    clearWindowCache(owner);
    MetricsData.add('restoreWindowFromEffectiveWindowCache fail');
    return false;
  }
  cache.offset = actualSignature.replace(cachedSignature, '').trim().split('\n').filter(part => !!part).length;

  log(`restoreWindowFromEffectiveWindowCache for ${windowId}: restore from cache`);

  let insertionPoint  = options.insertionPoint;
  if (!insertionPoint) {
    insertionPoint = document.createRange();
    const window = Tabs.trackedWindows.get(windowId);
    if (window)
      insertionPoint.selectNode(window.element);
    else
      insertionPoint.selectNodeContents(Tabs.allTabsContainer);
    insertionPoint.collapse(false);
  }
  const restored = restoreTabsFromCache(windowId, {
    insertionPoint,
    cache,
    tabs: apiTabs
  });
  if (!options.insertionPoint)
    insertionPoint.detach();

  if (restored)
    MetricsData.add(`restoreWindowFromEffectiveWindowCache for ${windowId} success`);
  else
    MetricsData.add(`restoreWindowFromEffectiveWindowCache for ${windowId} fail`);

  return restored;
}

function restoreTabsFromCache(windowId, params = {}) {
  if (!params.cache ||
      params.cache.version != Constants.kBACKGROUND_CONTENTS_VERSION)
    return false;

  return Cache.restoreTabsFromCacheInternal({
    windowId:       windowId,
    tabs:           params.tabs,
    offset:         params.cache.offset || 0,
    cache:          params.cache.tabs,
    insertionPoint: params.insertionPoint,
    shouldUpdate:   true
  }).length > 0;
}


async function updateWindowCache(owner, key, value) {
  if (!owner)
    return;
  if (value === undefined) {
    try {
    //return browser.sessions.removeWindowValue(owner, key);
      return browser.sessions.removeTabValue(owner.id || owner, key);
    }
    catch(e) {
      console.log(new Error('fatal error: failed to delete window cache'), e, owner, key, value);
    }
  }
  else {
    try {
    //return browser.sessions.setWindowValue(owner, key, value);
      return browser.sessions.setTabValue(owner.id || owner, key, value);
    }
    catch(e) {
      console.log(new Error('fatal error: failed to update window cache'), e, owner, key, value);
    }
  }
}

export function clearWindowCache(owner) {
  log('clearWindowCache for owner ', owner, { stack: new Error().stack });
  updateWindowCache(owner, Constants.kWINDOW_STATE_CACHED_TABS);
  updateWindowCache(owner, Constants.kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(owner, Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(owner, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

export function markWindowCacheDirtyFromTab(tab, akey) {
  const window = Tabs.trackedWindows.get(tab.windowId);
  if (window.markWindowCacheDirtyFromTabTimeout)
    clearTimeout(window.markWindowCacheDirtyFromTabTimeout);
  window.markWindowCacheDirtyFromTabTimeout = setTimeout(() => {
    window.markWindowCacheDirtyFromTabTimeout = null;
    updateWindowCache(window.lastWindowCacheOwner, akey, true);
  }, 100);
}

async function getWindowCache(owner, key) {
  //return browser.sessions.getWindowValue(owner, key);
  return browser.sessions.getTabValue(owner.id, key);
}

function getWindowCacheOwner(windowId) {
  const tab = Tabs.getLastTab(windowId, { element: false });
  return {
    id:       tab.id,
    windowId: tab.windowId
  };
}

export async function reserveToCacheTree(windowId) {
  if (!mActivated ||
      !configs.useCachedTree)
    return;

  const window = Tabs.trackedWindows.get(windowId);
  if (!window)
    return;

  // If there is any opening (but not resolved its unique id yet) tab,
  // we are possibly restoring tabs. To avoid cache breakage before
  // restoration, we must wait until we know whether there is any other
  // restoring tab or not.
  if (Tabs.hasCreatingTab(windowId))
    await Tabs.waitUntilAllTabsAreCreated(windowId);

  if (window.allTabsRestored)
    return;

  log('reserveToCacheTree for window ', windowId, { stack: new Error().stack });
  clearWindowCache(windowId.lastWindowCacheOwner);

  if (window.waitingToCacheTree)
    clearTimeout(window.waitingToCacheTree);
  window.waitingToCacheTree = setTimeout(() => {
    cacheTree(windowId);
  }, 500);
}

function cancelReservedCacheTree(windowId) {
  const window = Tabs.trackedWindows.get(windowId);
  if (window && window.waitingToCacheTree) {
    clearTimeout(window.waitingToCacheTree);
    delete window.waitingToCacheTree;
  }
}

async function cacheTree(windowId) {
  if (Tabs.hasCreatingTab(windowId))
    await Tabs.waitUntilAllTabsAreCreated(windowId);
  const window = Tabs.trackedWindows.get(windowId);
  if (!window ||
      !configs.useCachedTree)
    return;
  const signature = await Cache.getWindowSignature(windowId);
  if (window.allTabsRestored)
    return;
  //log('save cache for ', windowId);
  window.lastWindowCacheOwner = getWindowCacheOwner(windowId);
  if (!window.lastWindowCacheOwner)
    return;
  log('cacheTree for window ', windowId, { stack: new Error().stack });
  updateWindowCache(window.lastWindowCacheOwner, Constants.kWINDOW_STATE_CACHED_TABS, {
    version: Constants.kBACKGROUND_CONTENTS_VERSION,
    tabs:    window.element.outerHTML,
    pinnedTabsCount: Tabs.getPinnedTabs(windowId).length,
    signature
  });
}


// update cache on events

Tabs.onCreated.addListener((tab, _info = {}) => {
  reserveToCacheTree(tab.windowId);
});

// Tree restoration for "Restore Previous Session"
Tabs.onWindowRestoring.addListener(async windowId => {
  if (!configs.useCachedTree)
    return;

  log('Tabs.onWindowRestoring ', windowId);
  const window = Tabs.trackedWindows.get(windowId);
  const restoredCount = await window.allTabsRestored;
  if (restoredCount == 1) {
    log('Tabs.onWindowRestoring: single tab restored');
    return;
  }

  log('Tabs.onWindowRestoring: continue ', windowId);
  MetricsData.add('Tabs.onWindowRestoring restore start');

  const tabs = await browser.tabs.query({ windowId });
  try {
    await restoreWindowFromEffectiveWindowCache(windowId, {
      ignorePinnedTabs: true,
      owner: tabs[tabs.length - 1],
      tabs
    });
    MetricsData.add('Tabs.onWindowRestoring restore end');
  }
  catch(e) {
    log('Tabs.onWindowRestoring: FATAL ERROR while restoring tree from cache', String(e), e.stack);
  }
});

Tabs.onRemoved.addListener((_tab, info) => {
  wait(0).then(() => {
  // "Restore Previous Session" closes some tabs at first, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
    reserveToCacheTree(info.windowId);
  });
});

Tabs.onMoved.addListener((_tab, info) => {
  reserveToCacheTree(info.windowId);
});

Tabs.onUpdated.addListener((tab, _info) => {
  markWindowCacheDirtyFromTab(tab, Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
});

Tree.onSubtreeCollapsedStateChanging.addListener(tab => {
  reserveToCacheTree(tab.windowId);
});

Tree.onAttached.addListener((tab, _info) => {
  wait(0).then(() => {
    // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
    // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
    reserveToCacheTree(tab.windowId);
  });
});

Tree.onDetached.addListener((tab, _info) => {
  wait(0).then(() => {
    // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
    // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
    reserveToCacheTree(tab.windowId);
  });
});

Tabs.onPinned.addListener(tab => {
  reserveToCacheTree(tab.windowId);
});

Tabs.onUnpinned.addListener(tab => {
  reserveToCacheTree(tab.windowId);
});

Tabs.onShown.addListener(tab => {
  reserveToCacheTree(tab.windowId);
});

Tabs.onHidden.addListener(tab => {
  reserveToCacheTree(tab.windowId);
});

function onConfigChange(key) {
  switch (key) {
    case 'useCachedTree':
      browser.windows.getAll({
        populate:    true,
        windowTypes: ['normal']
      }).then(windows => {
        for (const window of windows) {
          const owner = window.tabs[window.tabs.length - 1];
          if (configs[key]) {
            reserveToCacheTree(window.id);
          }
          else {
            clearWindowCache(owner);
            location.reload();
          }
        }
      });
      break;
  }
}
