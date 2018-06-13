/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  wait,
  configs
} from '../../common/common.js';

import * as Constants from '../../common/constants.js';
import * as Tabs from '../../common/tabs.js';
import * as Tree from '../../common/tree.js';
import * as MetricsData from '../../common/metrics-data.js';

let gActivated = false;

export function activate() {
  gActivated = true;
  configs.$addObserver(onConfigChange);
}

export async function restoreWindowFromEffectiveWindowCache(aWindowId, aOptions = {}) {
  MetricsData.add('restoreWindowFromEffectiveWindowCache start');
  Cache.log('restoreWindowFromEffectiveWindowCache start');
  var owner = aOptions.owner || getWindowCacheOwner(aWindowId);
  if (!owner) {
    Cache.log('restoreWindowFromEffectiveWindowCache fail: no owner');
    return false;
  }
  cancelReservedCacheTree(aWindowId); // prevent to break cache before loading
  var apiTabs  = aOptions.tabs || await browser.tabs.query({ windowId: aWindowId });
  Cache.log('restoreWindowFromEffectiveWindowCache tabs: ', apiTabs);
  var [actualSignature, cache] = await Promise.all([
    Cache.getWindowSignature(apiTabs),
    getWindowCache(owner, Constants.kWINDOW_STATE_CACHED_TABS)
  ]);
  var cachedSignature = cache && cache.signature;
  Cache.log(`restoreWindowFromEffectiveWindowCache: got from the owner ${owner}`, {
    cachedSignature, cache
  });
  if (cache &&
      cache.tabs &&
      cachedSignature &&
      cachedSignature != Cache.signatureFromTabsCache(cache.tabs)) {
    Cache.log(`restoreWindowFromEffectiveWindowCache: cache for ${aWindowId} is broken.`, {
      signature: cachedSignature,
      cache:     Cache.signatureFromTabsCache(cache.tabs)
    });
    cache = cachedSignature = null;
    clearWindowCache(aWindowId);
  }
  if (aOptions.ignorePinnedTabs &&
      cache &&
      cache.tabs &&
      cachedSignature) {
    cache.tabs      = Cache.trimTabsCache(cache.tabs, cache.pinnedTabsCount);
    cachedSignature = Cache.trimSignature(cachedSignature, cache.pinnedTabsCount);
  }
  var signatureMatched = Cache.matcheSignatures({
    actual: actualSignature,
    cached: cachedSignature
  });
  Cache.log(`restoreWindowFromEffectiveWindowCache: verify cache for ${aWindowId}`, {
    cache, actualSignature, cachedSignature, signatureMatched
  });
  if (!cache ||
      cache.version != Constants.kSIDEBAR_CONTENTS_VERSION ||
      !signatureMatched) {
    Cache.log(`restoreWindowFromEffectiveWindowCache: no effective cache for ${aWindowId}`);
    clearWindowCache(owner);
    MetricsData.add('restoreWindowFromEffectiveWindowCache fail');
    return false;
  }
  cache.offset = actualSignature.replace(cachedSignature, '').trim().split('\n').filter(aPart => !!aPart).length;

  Cache.log(`restoreWindowFromEffectiveWindowCache: restore ${aWindowId} from cache`);

  var insertionPoint  = aOptions.insertionPoint;
  if (!insertionPoint) {
    insertionPoint = document.createRange();
    let container = Tabs.getTabsContainer(aWindowId);
    if (container)
      insertionPoint.selectNode(container);
    else
      insertionPoint.selectNodeContents(Tabs.allTabsContainer);
    insertionPoint.collapse(false);
  }
  var restored = restoreTabsFromCache(aWindowId, {
    insertionPoint,
    cache,
    tabs: apiTabs
  });
  if (!aOptions.insertionPoint)
    insertionPoint.detach();

  if (restored)
    MetricsData.add('restoreWindowFromEffectiveWindowCache success');
  else
    MetricsData.add('restoreWindowFromEffectiveWindowCache fail');

  return restored;
}

function restoreTabsFromCache(aWindowId, aParams = {}) {
  if (!aParams.cache ||
      aParams.cache.version != Constants.kBACKGROUND_CONTENTS_VERSION)
    return false;

  return Cache.restoreTabsFromCacheInternal({
    windowId:       aWindowId,
    tabs:           aParams.tabs,
    offset:         aParams.cache.offset || 0,
    cache:          aParams.cache.tabs,
    insertionPoint: aParams.insertionPoint,
    shouldUpdate:   true
  });
}


function updateWindowCache(aOwner, aKey, aValue) {
  if (!aOwner)
    return;
  if (aValue === undefined) {
    //return browser.sessions.removeWindowValue(aOwner, aKey);
    return browser.sessions.removeTabValue(aOwner.id, aKey);
  }
  else {
    //return browser.sessions.setWindowValue(aOwner, aKey, aValue);
    return browser.sessions.setTabValue(aOwner.id, aKey, aValue);
  }
}

export function clearWindowCache(aOwner) {
  Cache.log('clearWindowCache for owner ', aOwner, { stack: new Error().stack });
  updateWindowCache(aOwner, Constants.kWINDOW_STATE_CACHED_TABS);
  updateWindowCache(aOwner, Constants.kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(aOwner, Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(aOwner, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

export function markWindowCacheDirtyFromTab(aTab, akey) {
  const container = aTab.parentNode;
  if (container.markWindowCacheDirtyFromTabTimeout)
    clearTimeout(container.markWindowCacheDirtyFromTabTimeout);
  container.markWindowCacheDirtyFromTabTimeout = setTimeout(() => {
    container.markWindowCacheDirtyFromTabTimeout = null;
    updateWindowCache(container.lastWindowCacheOwner, akey, true);
  }, 100);
}

async function getWindowCache(aOwner, aKey) {
  //return browser.sessions.getWindowValue(aOwner, aKey);
  return browser.sessions.getTabValue(aOwner.id, aKey);
}

function getWindowCacheOwner(aHint) {
  const apiTab = Tabs.getLastTab(aHint).apiTab;
  return {
    id:       apiTab.id,
    windowId: apiTab.windowId
  };
}

export async function reserveToCacheTree(aHint) {
  if (!gActivated ||
      !configs.useCachedTree)
    return;

  // If there is any opening (but not resolved its unique id yet) tab,
  // we are possibly restoring tabs. To avoid cache breakage before
  // restoration, we must wait until we know whether there is any other
  // restoring tab or not.
  if (Tabs.hasCreatingTab())
    await Tabs.waitUntilAllTabsAreCreated();

  if (!aHint ||
      aHint instanceof Node && !aHint.parentNode)
    return;

  var container = Tabs.getTabsContainer(aHint);
  if (!container)
    return;

  if (container.allTabsRestored)
    return;

  var windowId = parseInt(container.dataset.windowId);
  Cache.log('reserveToCacheTree for window ', windowId, { stack: new Error().stack });
  clearWindowCache(container.lastWindowCacheOwner);

  if (container.waitingToCacheTree)
    clearTimeout(container.waitingToCacheTree);
  container.waitingToCacheTree = setTimeout(() => {
    cacheTree(windowId);
  }, 500);
}

function cancelReservedCacheTree(aWindowId) {
  var container = Tabs.getTabsContainer(aWindowId);
  if (container && container.waitingToCacheTree) {
    clearTimeout(container.waitingToCacheTree);
    delete container.waitingToCacheTree;
  }
}

async function cacheTree(aWindowId) {
  if (Tabs.hasCreatingTab())
    await Tabs.waitUntilAllTabsAreCreated();
  var container = Tabs.getTabsContainer(aWindowId);
  if (!container ||
      !configs.useCachedTree)
    return;
  var signature = await Cache.getWindowSignature(aWindowId);
  if (container.allTabsRestored)
    return;
  //Cache.log('save cache for ', aWindowId);
  container.lastWindowCacheOwner = getWindowCacheOwner(aWindowId);
  if (!container.lastWindowCacheOwner)
    return;
  Cache.log('cacheTree for window ', aWindowId, { stack: new Error().stack });
  updateWindowCache(container.lastWindowCacheOwner, Constants.kWINDOW_STATE_CACHED_TABS, {
    version: Constants.kBACKGROUND_CONTENTS_VERSION,
    tabs:    container.outerHTML,
    pinnedTabsCount: Tabs.getPinnedTabs(container).length,
    signature
  });
}


// update cache on events

Tabs.onCreated.addListener(aTab => {
  reserveToCacheTree(aTab);
});

// Tree restoration for "Restore Previous Session"
Tabs.onWindowRestoring.addListener(async aWindowId => {
  if (!configs.useCachedTree)
    return;

  log('Tabs.onWindowRestoring ', aWindowId);
  const container = Tabs.getTabsContainer(aWindowId);
  const restoredCount = await container.allTabsRestored;
  if (restoredCount == 1) {
    log('Tabs.onWindowRestoring: single tab restored');
    return;
  }

  log('Tabs.onWindowRestoring: continue ', aWindowId);
  MetricsData.add('Tabs.onWindowRestoring restore start');

  const apiTabs = await browser.tabs.query({ windowId: aWindowId });
  try {
    await restoreWindowFromEffectiveWindowCache(aWindowId, {
      ignorePinnedTabs: true,
      owner: apiTabs[apiTabs.length - 1],
      tabs:  apiTabs
    });
    MetricsData.add('Tabs.onWindowRestoring restore end');
  }
  catch(e) {
    log('Tabs.onWindowRestoring: FATAL ERROR while restoring tree from cache', String(e), e.stack);
  }
});

Tabs.onRemoved.addListener(async aTab => {
  await wait(0);
  // "Restore Previous Session" closes some tabs at first, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToCacheTree(aTab);
});

Tabs.onMoved.addListener(async aTab => {
  reserveToCacheTree(aTab);
});

Tabs.onUpdated.addListener(aTab => {
  markWindowCacheDirtyFromTab(aTab, Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
});

Tree.onSubtreeCollapsedStateChanging.addListener(aTab => {
  reserveToCacheTree(aTab);
});

Tree.onAttached.addListener(async aTab => {
  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToCacheTree(aTab);
});

Tree.onDetached.addListener(async aTab => {
  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToCacheTree(aTab);
});

Tabs.onPinned.addListener(aTab => {
  reserveToCacheTree(aTab);
});

Tabs.onUnpinned.addListener(aTab => {
  reserveToCacheTree(aTab);
});

Tabs.onShown.addListener(aTab => {
  reserveToCacheTree(aTab);
});

Tabs.onHidden.addListener(aTab => {
  reserveToCacheTree(aTab);
});

function onConfigChange(aKey) {
  switch (aKey) {
    case 'useCachedTree':
      browser.windows.getAll({
        populate:    true,
        windowTypes: ['normal']
      }).then(aWindows => {
        for (let window of aWindows) {
          let owner = window.tabs[window.tabs.length - 1];
          if (configs[aKey]) {
            reserveToCacheTree(Tabs.getTabById(owner));
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
