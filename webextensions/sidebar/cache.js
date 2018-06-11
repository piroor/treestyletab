/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gLastWindowCacheOwner;

async function getEffectiveWindowCache(aOptions = {}) {
  MetricsData.add('getEffectiveWindowCache start');
  logForCache('getEffectiveWindowCache: start');
  cancelReservedUpdateCachedTabbar(); // prevent to break cache before loading
  var cache;
  var cachedSignature;
  var actualSignature;
  await Promise.all([
    (async () => {
      var apiTabs = await browser.tabs.query({ currentWindow: true });
      gLastWindowCacheOwner = apiTabs[apiTabs.length - 1];
      var tabsDirty, collapsedDirty;
      [cache, tabsDirty, collapsedDirty] = await Promise.all([
        getWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR),
        getWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY),
        getWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY)
      ]);
      cachedSignature = cache && cache.signature;
      logForCache(`getEffectiveWindowCache: got from the owner ${gLastWindowCacheOwner.id}`, {
        cachedSignature, cache, tabsDirty, collapsedDirty
      });
      if (cache &&
          cache.tabs &&
          cachedSignature &&
          cachedSignature != signatureFromTabsCache(cache.tabbar.contents)) {
        logForCache('getEffectiveWindowCache: cache is broken.', {
          signature: cachedSignature,
          cache:     signatureFromTabsCache(cache.tabbar.contents)
        });
        cache = cachedSignature = null;
        clearWindowCache();
      }
      if (aOptions.ignorePinnedTabs &&
          cache &&
          cache.tabbar &&
          cache.tabbar.contents &&
          cachedSignature) {
        cache.tabbar.contents = trimTabsCache(cache.tabbar.contents, cache.tabbar.pinnedTabsCount);
        cachedSignature       = trimSignature(cachedSignature, cache.tabbar.pinnedTabsCount);
      }
      MetricsData.add('getEffectiveWindowCache get ' + JSON.stringify({
        cache: !!cache,
        version: cache && cache.version
      }));
      logForCache('getEffectiveWindowCache: verify cache (1)', { cache, tabsDirty, collapsedDirty });
      if (cache && cache.version == Constants.kSIDEBAR_CONTENTS_VERSION) {
        logForCache('getEffectiveWindowCache: restore sidebar from cache');
        cache.tabbar.tabsDirty      = tabsDirty;
        cache.tabbar.collapsedDirty = collapsedDirty;
        cache.signature = cachedSignature;
      }
      else {
        logForCache('getEffectiveWindowCache: invalid cache ', cache);
        cache = null;
      }
    })(),
    (async () => {
      actualSignature = await getWindowSignature(gTargetWindow);
    })()
  ]);

  var signatureMatched = matcheSignatures({
    actual: actualSignature,
    cached: cachedSignature
  });
  logForCache('getEffectiveWindowCache: verify cache (2)', {
    cache, actualSignature, cachedSignature, signatureMatched
  });
  if (!cache ||
      !signatureMatched) {
    clearWindowCache();
    cache = null;
    logForCache('getEffectiveWindowCache: failed');
    MetricsData.add('getEffectiveWindowCache fail');
  }
  else {
    cache.offset          = actualSignature.replace(cachedSignature, '').trim().split('\n').filter(aPart => !!aPart).length;
    cache.actualSignature = actualSignature;
    logForCache('getEffectiveWindowCache: success ');
    MetricsData.add('getEffectiveWindowCache success');
  }

  return cache;
}

async function restoreTabsFromCache(aCache, aParams = {}) {
  var offset    = aParams.offset || 0;
  var container = Tabs.getTabsContainer(gTargetWindow);
  if (offset <= 0) {
    if (container)
      container.parentNode.removeChild(container);
    gTabBar.setAttribute('style', aCache.style);
  }

  var restored = restoreTabsFromCacheInternal({
    windowId:     gTargetWindow,
    tabs:         aParams.tabs,
    offset:       offset,
    cache:        aCache.contents,
    shouldUpdate: aCache.tabsDirty
  });

  if (restored) {
    try {
      let masterStructure = (await browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_PULL_TREE_STRUCTURE,
        windowId: gTargetWindow
      })).structure;
      let allTabs = Tabs.getAllTabs();
      let currentStructrue = getTreeStructureFromTabs(allTabs);
      if (currentStructrue.map(aItem => aItem.parent).join(',') != masterStructure.map(aItem => aItem.parent).join(',')) {
        logForCache(`restoreTabsFromCache: failed to restore tabs, mismatched tree for ${gTargetWindow}. fallback to regular way.`);
        restored = false;
        let container = Tabs.getTabsContainer(gTargetWindow);
        if (container)
          container.parentNode.removeChild(container);
      }
      if (restored && aCache.collapsedDirty) {
        let structure = currentStructrue.reverse();
        allTabs.reverse().forEach((aTab, aIndex) => {
          collapseExpandSubtree(aTab, {
            collapsed: structure[aIndex].collapsed,
            justNow:   true
          });
        });
        clearDropPosition();
      }
    }
    catch(e) {
      logForCache(String(e), e.stack);
      throw e;
    }
  }

  return restored;
}

function updateWindowCache(aKey, aValue) {
  if (!gLastWindowCacheOwner ||
      !Tabs.getTabById(gLastWindowCacheOwner))
    return;
  if (aValue === undefined) {
    //logForCache('updateWindowCache: delete cache from ', gLastWindowCacheOwner, aKey);
    //return browser.sessions.removeWindowValue(gLastWindowCacheOwner, aKey);
    return browser.sessions.removeTabValue(gLastWindowCacheOwner.id, aKey);
  }
  else {
    //logForCache('updateWindowCache: set cache for ', gLastWindowCacheOwner, aKey);
    //return browser.sessions.setWindowValue(gLastWindowCacheOwner, aKey, aValue);
    return browser.sessions.setTabValue(gLastWindowCacheOwner.id, aKey, aValue);
  }
}

function clearWindowCache() {
  logForCache('clearWindowCache ', { stack: new Error().stack });
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

function markWindowCacheDirty(akey) {
  if (markWindowCacheDirty.timeout)
    clearTimeout(markWindowCacheDirty.timeout);
  markWindowCacheDirty.timeout = setTimeout(() => {
    markWindowCacheDirty.timeout = null;
    updateWindowCache(akey, true);
  }, 250);
}

async function getWindowCache(aKey) {
  if (!gLastWindowCacheOwner)
    return null;
  //return browser.sessions.getWindowValue(gLastWindowCacheOwner, aKey);
  return browser.sessions.getTabValue(gLastWindowCacheOwner.id, aKey);
}

function getWindowCacheOwner() {
  const tab = Tabs.getLastTab();
  return tab && tab.apiTab;
}

async function reserveToUpdateCachedTabbar() {
  if (gInitializing ||
      !configs.useCachedTree)
    return;

  // If there is any opening (but not resolved its unique id yet) tab,
  // we are possibly restoring tabs. To avoid cache breakage before
  // restoration, we must wait until we know whether there is any other
  // restoring tab or not.
  if (hasCreatingTab())
    await waitUntilAllTabsAreCreated();

  var container = Tabs.getTabsContainer(gTargetWindow);
  if (container.allTabsRestored)
    return;

  logForCache('reserveToUpdateCachedTabbar ', { stack: new Error().stack });
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
  if (hasCreatingTab())
    await waitUntilAllTabsAreCreated();
  var container = Tabs.getTabsContainer(gTargetWindow);
  var signature = await getWindowSignature(gTargetWindow);
  if (container.allTabsRestored)
    return;
  logForCache('updateCachedTabbar ', { stack: new Error().stack });
  gLastWindowCacheOwner = getWindowCacheOwner(gTargetWindow);
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR, {
    version: Constants.kSIDEBAR_CONTENTS_VERSION,
    tabbar:  {
      contents: gAllTabs.innerHTML,
      style:    gTabBar.getAttribute('style'),
      pinnedTabsCount: Tabs.getPinnedTabs(container).length
    },
    indent:  {
      lastMaxLevel:  gLastMaxLevel,
      lastMaxIndent: gLastMaxIndent,
      definition:    gIndentDefinition.textContent
    },
    signature
  });
}
