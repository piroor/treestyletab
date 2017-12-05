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
  var tabs  = aOptions.tabs || await browser.tabs.query({ windowId: aWindowId });
  var [actualSignature, cachedSignature, cache] = await Promise.all([
    getWindowSignature(tabs),
    getWindowCache(owner, kWINDOW_STATE_SIGNATURE),
    getWindowCache(owner, kWINDOW_STATE_CACHED_TABS)
  ]);
  if (aOptions.ignorePinnedTabs &&
      cache &&
      cache.tabs &&
      cachedSignature) {
    log('cachedSignature(before trimmed) ', cachedSignature);
    cache.tabs      = trimTabsCache(cache.tabs, cache.pinnedTabsCount);
    cachedSignature = trimSignature(cachedSignature, cache.pinnedTabsCount);
  }
  var offset = cachedSignature ? actualSignature.indexOf(cachedSignature) : -1;
  if (!cache ||
      cache.version != kSIDEBAR_CONTENTS_VERSION ||
      offset < 0) {
    log(`restoreWindowFromEffectiveWindowCache: no effective cache for ${aWindowId}`, {
      cache, actualSignature, cachedSignature
    });
    clearWindowCache(owner);
    gMetricsData.add('restoreWindowFromEffectiveWindowCache fail ' + JSON.stringify({
      cache: !!cache,
      version: cache && cache.version,
      signature: actualSignature.indexOf(cachedSignature)
    }));
    return false;
  }
  cache.offset = actualSignature.replace(cachedSignature, '').trim().split('\n').filter(aPart => !!aPart).length;

  log(`restoreWindowFromEffectiveWindowCache: restore ${aWindowId} from cache `, cache);

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
    gMetricsData.add('restoreWindowFromEffectiveWindowCache fail ', cache);

  return restored;
}

function restoreTabsFromCache(aWindowId, aParams = {}) {
  if (!aParams.cache ||
      aParams.cache.version != kBACKGROUND_CONTENTS_VERSION)
    return false;

  log(`restoreTabsFromCache: restore tabs for ${aWindowId} from cache`);

  var offset         = aParams.cache.offset || 0;
  var insertionPoint = aParams.insertionPoint;
  var oldContainer   = getTabsContainer(aWindowId);
  if (offset > 0) {
    if (!oldContainer ||
        oldContainer.childNodes.length <= offset) {
      log('restoreTabsFromCache: missing container');
      return false;
    }
    log(`restoreTabsFromCache: there is ${oldContainer.childNodes.length} tabs`);
    insertionPoint = document.createRange();
    insertionPoint.selectNodeContents(oldContainer);
    log('restoreTabsFromCache: delete obsolete tabs, offset = ', offset);
    insertionPoint.setStartAfter(oldContainer.childNodes[offset - 1]);
    insertionPoint.deleteContents();
    log(`restoreTabsFromCache: => ${oldContainer.childNodes.length} tabs`);
    let matched = aParams.cache.tabs.match(/<li/g);
    log(`restoreTabsFromCache: restore ${matched.length} tabs from cache`);
    let fragment = insertionPoint.createContextualFragment(aParams.cache.tabs.replace(/^<ul[^>]+>|<\/ul>$/g, ''));
    insertionPoint.insertNode(fragment);
    insertionPoint.detach();
  }
  else {
    if (oldContainer)
      oldContainer.parentNode.removeChild(oldContainer);
    let fragment = aParams.insertionPoint.createContextualFragment(aParams.cache.tabs);
    let container = fragment.firstChild;
    log('restoreTabsFromCache: restore');
    insertionPoint.insertNode(fragment);
    container.id = `window-${aWindowId}`;
    container.dataset.windowId = aWindowId;
  }

  log('restoreTabsFromCache: post process');
  // After restoration, tabs are updated with renumbered id.
  // We need to update all tab elements including existing one.
  var tabElements = getAllTabs(aWindowId)/*.slice(offset)*/;
  var apiTabs     = aParams.tabs/*.slice(offset)*/;
  if (tabElements.length != apiTabs.length) {
    log('restoreTabsFromCache: Mismatched number of restored tabs? ', { tabElements, apiTabs });
    return true;
  }
  restoreCachedTabs(tabElements, apiTabs, {
    dirty: true
  });
  log('restoreTabsFromCache: done', configs.debug && getTreeStructureFromTabs(getAllTabs(aWindowId)));
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
  log('clearWindowCache for owner ', aOwner);
  updateWindowCache(aOwner, kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(aOwner, kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(aOwner, kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
  updateWindowCache(aOwner, kWINDOW_STATE_SIGNATURE);
}

function markWindowCacheDirtyFromTab(aTab, akey) {
  var container = aTab.parentNode;
  updateWindowCache(container.lastWindowCacheOwner, akey, true);
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
  if (!container.lastWindowCacheOwner)
    return;
  log('cacheTree for window ', aWindowId);
  updateWindowCache(container.lastWindowCacheOwner, kWINDOW_STATE_CACHED_TABS, {
    version: kBACKGROUND_CONTENTS_VERSION,
    tabs:    container.outerHTML,
    pinnedTabsCount: getPinnedTabs(container).length
  });
  getWindowSignature(aWindowId).then(aSignature => {
    updateWindowCache(container.lastWindowCacheOwner, kWINDOW_STATE_SIGNATURE, aSignature);
  });
}
