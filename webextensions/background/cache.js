/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

async function restoreWindowFromEffectiveWindowCache(aWindowId, aOptions = {}) {
  MetricsData.add('restoreWindowFromEffectiveWindowCache start');
  logForCache('restoreWindowFromEffectiveWindowCache start');
  var owner = aOptions.owner || getWindowCacheOwner(aWindowId);
  if (!owner) {
    logForCache('restoreWindowFromEffectiveWindowCache fail: no owner');
    return false;
  }
  cancelReservedCacheTree(aWindowId); // prevent to break cache before loading
  var apiTabs  = aOptions.tabs || await browser.tabs.query({ windowId: aWindowId });
  logForCache('restoreWindowFromEffectiveWindowCache tabs: ', apiTabs);
  var [actualSignature, cache] = await Promise.all([
    getWindowSignature(apiTabs),
    getWindowCache(owner, Constants.kWINDOW_STATE_CACHED_TABS)
  ]);
  var cachedSignature = cache && cache.signature;
  logForCache(`restoreWindowFromEffectiveWindowCache: got from the owner ${owner}`, {
    cachedSignature, cache
  });
  if (cache &&
      cache.tabs &&
      cachedSignature &&
      cachedSignature != signatureFromTabsCache(cache.tabs)) {
    logForCache(`restoreWindowFromEffectiveWindowCache: cache for ${aWindowId} is broken.`, {
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
  logForCache(`restoreWindowFromEffectiveWindowCache: verify cache for ${aWindowId}`, {
    cache, actualSignature, cachedSignature, signatureMatched
  });
  if (!cache ||
      cache.version != Constants.kSIDEBAR_CONTENTS_VERSION ||
      !signatureMatched) {
    logForCache(`restoreWindowFromEffectiveWindowCache: no effective cache for ${aWindowId}`);
    clearWindowCache(owner);
    MetricsData.add('restoreWindowFromEffectiveWindowCache fail');
    return false;
  }
  cache.offset = actualSignature.replace(cachedSignature, '').trim().split('\n').filter(aPart => !!aPart).length;

  logForCache(`restoreWindowFromEffectiveWindowCache: restore ${aWindowId} from cache`);

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
    return browser.sessions.removeTabValue(aOwner.id, aKey);
  }
  else {
    //return browser.sessions.setWindowValue(aOwner, aKey, aValue);
    return browser.sessions.setTabValue(aOwner.id, aKey, aValue);
  }
}

function clearWindowCache(aOwner) {
  logForCache('clearWindowCache for owner ', aOwner, { stack: new Error().stack });
  updateWindowCache(aOwner, Constants.kWINDOW_STATE_CACHED_TABS);
  updateWindowCache(aOwner, Constants.kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(aOwner, Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(aOwner, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

function markWindowCacheDirtyFromTab(aTab, akey) {
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
  const apiTab = getLastTab(aHint).apiTab;
  return {
    id:       apiTab.id,
    windowId: apiTab.windowId
  };
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
    await waitUntilAllTabsAreCreated();

  if (!aHint ||
      aHint instanceof Node && !aHint.parentNode)
    return;

  var container = getTabsContainer(aHint);
  if (!container)
    return;

  if (container.allTabsRestored)
    return;

  var windowId = parseInt(container.dataset.windowId);
  logForCache('reserveToCacheTree for window ', windowId, { stack: new Error().stack });
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
    await waitUntilAllTabsAreCreated();
  var container = getTabsContainer(aWindowId);
  if (!container ||
      !configs.useCachedTree)
    return;
  var signature = await getWindowSignature(aWindowId);
  if (container.allTabsRestored)
    return;
  //logForCache('save cache for ', aWindowId);
  container.lastWindowCacheOwner = getWindowCacheOwner(aWindowId);
  if (!container.lastWindowCacheOwner)
    return;
  logForCache('cacheTree for window ', aWindowId, { stack: new Error().stack });
  updateWindowCache(container.lastWindowCacheOwner, Constants.kWINDOW_STATE_CACHED_TABS, {
    version: Constants.kBACKGROUND_CONTENTS_VERSION,
    tabs:    container.outerHTML,
    pinnedTabsCount: getPinnedTabs(container).length,
    signature
  });
}
