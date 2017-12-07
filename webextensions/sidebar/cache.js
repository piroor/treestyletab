/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gLastWindowCacheOwner;

async function getEffectiveWindowCache(aOptions = {}) {
  gMetricsData.add('getEffectiveWindowCache start');
  log('getEffectiveWindowCache: start');
  var cache;
  var cachedSignature;
  var actualSignature;
  await Promise.all([
    (async () => {
      var apiTabs = await browser.tabs.query({ currentWindow: true });
      gLastWindowCacheOwner = apiTabs[apiTabs.length - 1].id;
      var tabsDirty, collapsedDirty;
      [cache, tabsDirty, collapsedDirty, cachedSignature] = await Promise.all([
        getWindowCache(kWINDOW_STATE_CACHED_SIDEBAR),
        getWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY),
        getWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY),
        getWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_SIGNATURE)
      ]);
      log(`getEffectiveWindowCache: got `, {
        cache, tabsDirty, collapsedDirty, cachedSignature
      });
      if (cache &&
          cache.tabs &&
          cachedSignature &&
          cachedSignature != signatureFromTabsCache(cache.tabbar.contents)) {
        log('getEffectiveWindowCache: cache is broken.', {
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
      gMetricsData.add('getEffectiveWindowCache get ' + JSON.stringify({
        cache: !!cache,
        version: cache && cache.version
      }));
      log('getEffectiveWindowCache: verify cache (1)', { cache, tabsDirty, collapsedDirty });
      if (cache && cache.version == kSIDEBAR_CONTENTS_VERSION) {
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
      actualSignature = await getWindowSignature(gTargetWindow);
    })()
  ]);

  var signatureMatched = matcheSignatures({
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
    gMetricsData.add('getEffectiveWindowCache fail');
  }
  else {
    cache.offset          = actualSignature.replace(cachedSignature, '').trim().split('\n').filter(aPart => !!aPart).length;
    cache.actualSignature = actualSignature;
    log('getEffectiveWindowCache: success ');
    gMetricsData.add('getEffectiveWindowCache success');
  }

  return cache;
}

async function restoreTabsFromCache(aCache, aParams = {}) {
  log('restoreTabsFromCache: restore tabs from cache ', aCache, aParams);

  var offset       = aParams.offset || 0;
  var oldContainer = getTabsContainer(gTargetWindow);
  if (offset > 0) {
    log(`restoreTabsFromCache: there is ${oldContainer.childNodes.length} tabs`);
    log('restoreTabsFromCache: delete obsolete tabs, offset = ', offset);
    let insertionPoint = document.createRange();
    insertionPoint.selectNodeContents(oldContainer);
    insertionPoint.setStartAfter(oldContainer.childNodes[offset - 1]);
    insertionPoint.deleteContents();
    log(`restoreTabsFromCache: => ${oldContainer.childNodes.length} tabs`);
    let matched = aCache.contents.match(/<li/g);
    log(`restoreTabsFromCache: restore ${matched.length} tabs from cache `,
        aCache.contents.replace(/(<(li|ul))/g, '\n$1'));
    let fragment = insertionPoint.createContextualFragment(aCache.contents.replace(/^<ul[^>]+>|<\/ul>$/g, ''));
    insertionPoint.insertNode(fragment);
    insertionPoint.detach();
  }
  else {
    if (oldContainer)
      oldContainer.parentNode.removeChild(oldContainer);
    gTabBar.setAttribute('style', aCache.style);
    log('restoreTabsFromCache: restore');
    gAllTabs.innerHTML = aCache.contents;
    let container = gAllTabs.firstChild;
    container.id = `window-${gTargetWindow}`;
    container.dataset.windowId = gTargetWindow;
  }

  log('restoreTabsFromCache: post process');
  var tabElements = getAllTabs().slice(offset);
  var apiTabs     = aParams.tabs.slice(offset);
  log('restoreTabsFromCache: tabs ', { tabElements, apiTabs });
  if (tabElements.length != apiTabs.length) {
    log('restoreTabsFromCache: Mismatched number of restored tabs?');
    return true;
  }
  try {
    fixupTabsRestoredFromCache(tabElements, apiTabs, {
      dirty: aCache.tabsDirty
    });
    if (aCache.collapsedDirty) {
      let response = await browser.runtime.sendMessage({
        type:     kCOMMAND_PULL_TREE_STRUCTURE,
        windowId: gTargetWindow
      });
      let structure = response.structure.reverse();
      getAllTabs().reverse().forEach((aTab, aIndex) => {
        collapseExpandSubtree(aTab, {
          collapsed: structure[aIndex].collapsed,
          justNow:   true
        });
      });
    }
  }
  catch(e) {
    log(String(e), e.stack);
    throw e;
  }
  log('restoreTabsFromCache: done');
  dumpAllTabs();
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
  log('clearWindowCache ', { stack: new Error().stack });
  updateWindowCache(kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
  updateWindowCache(kWINDOW_STATE_SIGNATURE);
}

function markWindowCacheDirty(akey) {
  updateWindowCache(akey, true);
}

async function getWindowCache(aKey) {
  if (!gLastWindowCacheOwner)
    return null;
  //return browser.sessions.getWindowValue(gLastWindowCacheOwner, aKey);
  return browser.sessions.getTabValue(gLastWindowCacheOwner, aKey);
}

function getWindowCacheOwner() {
  var tab = getLastTab();
  var apiTab = tab && tab.apiTab;
  return apiTab && apiTab.id;
}

function reserveToUpdateCachedTabbar() {
  if (gInitializing ||
      !configs.useCachedTree)
    return;

  var container = getTabsContainer(gTargetWindow);
  if (container.allTabsRestored)
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
function updateCachedTabbar() {
  if (!configs.useCachedTree)
    return;
  var container = getTabsContainer(gTargetWindow);
  if (container.allTabsRestored)
    return;
  log('updateCachedTabbar ', { stack: new Error().stack });
  gLastWindowCacheOwner = getWindowCacheOwner(gTargetWindow);
  updateWindowCache(kWINDOW_STATE_CACHED_SIDEBAR, {
    version: kSIDEBAR_CONTENTS_VERSION,
    tabbar:  {
      contents: gAllTabs.innerHTML,
      style:    gTabBar.getAttribute('style'),
      pinnedTabsCount: getPinnedTabs(container).length
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
