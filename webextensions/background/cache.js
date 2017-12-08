/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

async function restoreWindowFromEffectiveWindowCache(aWindowId, aOptions = {}) {
  gMetricsData.add('restoreWindowFromEffectiveWindowCache start');
  log('restoreWindowFromEffectiveWindowCache start');
  var owner = aOptions.owner || getWindowCacheOwner(aWindowId);
  if (!owner) {
    log('restoreWindowFromEffectiveWindowCache fail: no owner');
    return false;
  }
  cancelReservedCacheTree(aWindowId); // prevent to break cache before loading
  var tabs  = aOptions.tabs || await browser.tabs.query({ windowId: aWindowId });
  log('restoreWindowFromEffectiveWindowCache tabs: ', tabs);
  var [actualSignature, cache] = await Promise.all([
    getWindowSignature(tabs),
    getWindowCache(owner, kWINDOW_STATE_CACHED_TABS)
  ]);
  var cachedSignature = cache && cache.signature;
  log(`restoreWindowFromEffectiveWindowCache: got from the owner ${owner}`, {
    cachedSignature, cache
  });
  if (cache &&
      cache.tabs &&
      cachedSignature &&
      cachedSignature != signatureFromTabsCache(cache.tabs)) {
    log(`restoreWindowFromEffectiveWindowCache: cache for ${aWindowId} is broken.`, {
      signature: cachedSignature,
      cache:     signatureFromTabsCache(cache.tabs)
    });
    cache = cachedSignature = null;
    clearWindowCache(aWindowId);
  }
  if (aOptions.ignorePinnedTabs &&
      cache &&
      cache.tabs &&
      cachedSignature) {
    cache.tabs      = trimTabsCache(cache.tabs, cache.pinnedTabsCount);
    cachedSignature = trimSignature(cachedSignature, cache.pinnedTabsCount);
  }
  var signatureMatched = matcheSignatures({
    actual: actualSignature,
    cached: cachedSignature
  });
  log(`restoreWindowFromEffectiveWindowCache: verify cache for ${aWindowId}`, {
    cache, actualSignature, cachedSignature, signatureMatched
  });
  if (!cache ||
      cache.version != kSIDEBAR_CONTENTS_VERSION ||
      !signatureMatched) {
    log(`restoreWindowFromEffectiveWindowCache: no effective cache for ${aWindowId}`);
    clearWindowCache(owner);
    gMetricsData.add('restoreWindowFromEffectiveWindowCache fail');
    return false;
  }
  cache.offset = actualSignature.replace(cachedSignature, '').trim().split('\n').filter(aPart => !!aPart).length;

  log(`restoreWindowFromEffectiveWindowCache: restore ${aWindowId} from cache`);

  var insertionPoint  = aOptions.insertionPoint;
  if (!insertionPoint) {
    insertionPoint = document.createRange();
    let container = getTabsContainer(aWindowId);
    if (container)
      insertionPoint.selectNode(container);
    else
      insertionPoint.selectNodeContents(gAllTabs);
    insertionPoint.collapse(false);
  }
  var restored = restoreTabsFromCache(aWindowId, {
    insertionPoint, cache, tabs
  });
  if (!aOptions.insertionPoint)
    insertionPoint.detach();

  if (restored)
    gMetricsData.add('restoreWindowFromEffectiveWindowCache success');
  else
    gMetricsData.add('restoreWindowFromEffectiveWindowCache fail');

  return restored;
}

function restoreTabsFromCache(aWindowId, aParams = {}) {
  if (!aParams.cache ||
      aParams.cache.version != kBACKGROUND_CONTENTS_VERSION)
    return false;

  return restoreTabsFromCacheInternal({
    windowId:       aWindowId,
    tabs:           aParams.tabs,
    offset:         aParams.cache.offset || 0,
    cache:          aParams.cache.tabs,
    insertionPoint: aParams.insertionPoint,
    shouldUpdate:   true
  });
}


function updateWindowCache(aOwner, aKey, aValue) {
  if (!aOwner ||
      !getTabById(aOwner))
    return;
  if (aValue === undefined) {
    //return browser.sessions.removeWindowValue(aOwner, aKey);
    return browser.sessions.removeTabValue(aOwner, aKey);
  }
  else {
    //return browser.sessions.setWindowValue(aOwner, aKey, aValue);
    return browser.sessions.setTabValue(aOwner, aKey, aValue);
  }
}

function clearWindowCache(aOwner) {
  log('clearWindowCache for owner ', aOwner, { stack: new Error().stack });
  return Promise.all([
    updateWindowCache(aOwner, kWINDOW_STATE_CACHED_TABS),
    updateWindowCache(aOwner, kWINDOW_STATE_CACHED_SIDEBAR),
    updateWindowCache(aOwner, kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY),
    updateWindowCache(aOwner, kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY)
  ]);
}

function markWindowCacheDirtyFromTab(aTab, akey) {
  var container = aTab.parentNode;
  return updateWindowCache(container.lastWindowCacheOwner, akey, true);
}

async function getWindowCache(aOwner, aKey) {
  //return browser.sessions.getWindowValue(aOwner, aKey);
  return browser.sessions.getTabValue(aOwner, aKey);
}

function getWindowCacheOwner(aHint) {
  return getLastTab(aHint).apiTab.id;
}

async function reserveToCacheTree(aHint) {
  if (gInitializing ||
      !configs.useCachedTree)
    return;

  // If there is any opening (but not resolved its unique id yet) tab,
  // we are possibly restoring tabs. To avoid cache breakage before
  // restoration, we must wait until we know whether there is any other
  // restoring tab or not.
  if (hasCreatingTab())
    await waitUntilAllTabsAreaCreated();

  if (!aHint ||
      aHint instanceof Node && !aHint.parentNode)
    return;

  var container = getTabsContainer(aHint);
  if (!container)
    return;

  if (container.allTabsRestored)
    return;

  var windowId = parseInt(container.dataset.windowId);
  log('reserveToCacheTree for window ', windowId, { stack: new Error().stack });
  clearWindowCache(container.lastWindowCacheOwner);

  if (container.waitingToCacheTree)
    clearTimeout(container.waitingToCacheTree);
  container.waitingToCacheTree = setTimeout(() => {
    cacheTree(windowId);
  }, 500);
}

function cancelReservedCacheTree(aWindowId) {
  var container = getTabsContainer(aWindowId);
  if (container && container.waitingToCacheTree) {
    clearTimeout(container.waitingToCacheTree);
    delete container.waitingToCacheTree;
  }
}

async function cacheTree(aWindowId) {
  if (hasCreatingTab())
    await waitUntilAllTabsAreaCreated();
  var container = getTabsContainer(aWindowId);
  if (!container ||
      !configs.useCachedTree)
    return;
  var signature = await getWindowSignature(aWindowId);
  if (container.allTabsRestored)
    return;
  //log('save cache for ', aWindowId);
  container.lastWindowCacheOwner = getWindowCacheOwner(aWindowId);
  if (!container.lastWindowCacheOwner)
    return;
  log('cacheTree for window ', aWindowId, { stack: new Error().stack });
  updateWindowCache(container.lastWindowCacheOwner, kWINDOW_STATE_CACHED_TABS, {
    version: kBACKGROUND_CONTENTS_VERSION,
    tabs:    container.outerHTML,
    pinnedTabsCount: getPinnedTabs(container).length,
    signature
  });
}
