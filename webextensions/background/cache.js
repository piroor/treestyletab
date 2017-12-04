/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

async function restoreWindowFromEffectiveWindowCache(aWindowId, aOptions = {}) {
  gMetricsData.add('restoreWindowFromEffectiveWindowCache start');
  var owner = aOptions.owner || getWindowCacheOwner(aWindowId);
  var tabs  = aOptions.tabs || await browser.tabs.query({ windowId: aWindowId });
  var [actualSignature, cachedSignature, cache] = await Promise.all([
    getWindowSignature(tabs),
    getWindowCache(owner, kWINDOW_STATE_SIGNATURE),
    getWindowCache(owner, kWINDOW_STATE_CACHED_TABS)
  ]);
  if (!cache ||
      cache.version != kSIDEBAR_CONTENTS_VERSION ||
      actualSignature != cachedSignature) {
    log(`restoreWindowFromEffectiveWindowCache: no effective cache for ${aWindowId}`);
    clearWindowCache(owner);
    gMetricsData.add('restoreWindowFromEffectiveWindowCache fail ' + JSON.stringify({
      cache: !!cache,
      version: cache && cache.version,
      actualSignature,
      cachedSignature
    }));
    return false;
  }

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
  var restored = restoreTabsFromCache(aWindowId, { insertionPoint, cache, tabs });
  if (!aOptions.insertionPoint)
    insertionPoint.detach();

  gMetricsData.add('restoreWindowFromEffectiveWindowCache success');
  return restored;
}

function restoreTabsFromCache(aWindowId, aParams = {}) {
  if (!aParams.cache ||
      aParams.cache.version != kBACKGROUND_CONTENTS_VERSION)
    return false;

  log(`restore tabs for ${aWindowId} from cache`);

  var oldContainer = getTabsContainer(aWindowId);
  if (oldContainer)
    oldContainer.parentNode.removeChild(oldContainer);

  var fragment = aParams.insertionPoint.createContextualFragment(aParams.cache.tabs);
  var container = fragment.firstChild;
  aParams.insertionPoint.insertNode(fragment);
  container.id = `window-${aWindowId}`;
  container.dataset.windowId = aWindowId;
  restoreCachedTabs(getAllTabs(aWindowId), aParams.tabs, {
    dirty: true
  });
  return true;
}


function updateWindowCache(aOwner, aKey, aValue) {
  if (!aOwner ||
      !getTabById(aOwner))
    return;
  if (aValue === undefined) {
    //browser.sessions.removeWindowValue(aOwner, aKey);
    browser.sessions.removeTabValue(aOwner, aKey);
  }
  else {
    //browser.sessions.setWindowValue(aOwner, aKey, aValue);
    browser.sessions.setTabValue(aOwner, aKey, aValue);
  }
}

function clearWindowCache(aOwner) {
  updateWindowCache(aOwner, kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(aOwner, kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(aOwner, kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
  updateWindowCache(aOwner, kWINDOW_STATE_SIGNATURE);
}

async function getWindowCache(aOwner, aKey) {
  //return browser.sessions.getWindowValue(aOwner, aKey);
  return browser.sessions.getTabValue(aOwner, aKey);
}

function getWindowCacheOwner(aHint) {
  return getLastTab(aHint).apiTab.id;
}

function reserveToCacheTree(aHint) {
  if (gInitializing ||
      !configs.useCachedTree)
    return;

  var container = getTabsContainer(aHint);
  if (!container ||
      container.allTabsRestored)
    return;

  var windowId = parseInt(container.dataset.windowId);
  //log('clear cache for ', windowId);
  clearWindowCache(container.lastWindowCacheOwner);

  if (container.waitingToCacheTree)
    clearTimeout(container.waitingToCacheTree);
  container.waitingToCacheTree = setTimeout(() => {
    cacheTree(windowId);
  }, 500, windowId);
}
async function cacheTree(aWindowId) {
  var container = getTabsContainer(aWindowId);
  if (!container ||
      !configs.useCachedTree ||
      container.allTabsRestored)
    return;
  //log('save cache for ', aWindowId);
  container.lastWindowCacheOwner = getWindowCacheOwner(aWindowId);
  updateWindowCache(container.lastWindowCacheOwner, kWINDOW_STATE_CACHED_TABS, {
    version: kBACKGROUND_CONTENTS_VERSION,
    tabs:    container.outerHTML
  });
  getWindowSignature(aWindowId).then(aSignature => {
    updateWindowCache(container.lastWindowCacheOwner, kWINDOW_STATE_SIGNATURE, aSignature);
  });
}
