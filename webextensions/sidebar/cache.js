/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gLastWindowCacheOwner;

async function getEffectiveWindowCache() {
  gMetricsData.add('getEffectiveWindowCache start');
  var cache;
  var cachedSignature;
  var actualSignature;
  await Promise.all([
    (async () => {
      var apiTabs = await browser.tabs.query({ currentWindow: true });
      gLastWindowCacheOwner = apiTabs[apiTabs.length - 1].id;
      let tabsDirty, collapsedDirty;
      [cache, tabsDirty, collapsedDirty, cachedSignature] = await Promise.all([
        getWindowCache(kWINDOW_STATE_CACHED_SIDEBAR),
        getWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY),
        getWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY),
        getWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_SIGNATURE)
      ]);
      gMetricsData.add('getEffectiveWindowCache get ' + JSON.stringify({
        cache: !!cache,
        version: cache && cache.version
      }));
      if (cache && cache.version == kSIDEBAR_CONTENTS_VERSION) {
        log(`restore sidebar from cache`);
        cache.tabbar.tabsDirty      = tabsDirty;
        cache.tabbar.collapsedDirty = collapsedDirty;
      }
      else {
        cache = null;
      }
    })(),
    (async () => {
      actualSignature = await getWindowSignature(gTargetWindow);
    })()
  ]);

  if (!cache ||
      cachedSignature != actualSignature) {
    clearWindowCache();
    cache = null;
    gMetricsData.add('getEffectiveWindowCache fail');
  }
  else
    gMetricsData.add('getEffectiveWindowCache success');

  return cache;
}

function updateWindowCache(aKey, aValue) {
  if (!gLastWindowCacheOwner ||
      !getTabById(gLastWindowCacheOwner))
    return;
  if (aValue === undefined) {
    //browser.sessions.removeWindowValue(gLastWindowCacheOwner, aKey);
    browser.sessions.removeTabValue(gLastWindowCacheOwner, aKey);
  }
  else {
    //browser.sessions.setWindowValue(gLastWindowCacheOwner, aKey, aValue);
    browser.sessions.setTabValue(gLastWindowCacheOwner, aKey, aValue);
  }
}

function clearWindowCache() {
  updateWindowCache(kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
  updateWindowCache(kWINDOW_STATE_SIGNATURE);
}

function markWindowCacheDirty(akey) {
  updateWindowCache(akey, true);
  var container = getTabsContainer(gTargetWindow);
  if (!container)
    return;
  container.windowCacheDirtyCount = container.windowCacheDirtyCount || 0;
  container.windowCacheDirtyCount++;
  if (container.windowCacheDirtyCount > 10) {
    container.windowCacheDirtyCount = 0;
    reserveToUpdateCachedTabbar();
  }
}

async function getWindowCache(aKey) {
  if (!gLastWindowCacheOwner)
    return null;
  //return browser.sessions.getWindowValue(gLastWindowCacheOwner, aKey);
  return browser.sessions.getTabValue(gLastWindowCacheOwner, aKey);
}

function getWindowCacheOwner() {
  return getLastTab().apiTab.id;
}

function reserveToUpdateCachedTabbar() {
  if (gInitializing ||
      !configs.useCachedTree)
    return;

  var container = getTabsContainer(gTargetWindow);
  if (container.allTabsRestored)
    return;

  // clear dirty cache
  clearWindowCache();

  if (updateCachedTabbar.waiting)
    clearTimeout(updateCachedTabbar.waiting);
  updateCachedTabbar.waiting = setTimeout(() => {
    delete updateCachedTabbar.waiting;
    updateCachedTabbar();
  }, 500);
}
function updateCachedTabbar() {
  if (!configs.useCachedTree)
    return;
  var container = getTabsContainer(gTargetWindow);
  if (container.allTabsRestored)
    return;
  gLastWindowCacheOwner = getWindowCacheOwner(gTargetWindow);
  updateWindowCache(kWINDOW_STATE_CACHED_SIDEBAR, {
    version: kSIDEBAR_CONTENTS_VERSION,
    tabbar:  {
      contents: gAllTabs.innerHTML,
      style:    gTabBar.getAttribute('style')
    },
    indent:  {
      lastMaxLevel:  gLastMaxLevel,
      lastMaxIndent: gLastMaxIndent,
      definition:    gIndentDefinition.textContent
    }
  });
  getWindowSignature(gTargetWindow).then(aSignature => {
    updateWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_SIGNATURE, aSignature);
  });
}
