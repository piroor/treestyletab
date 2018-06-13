/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  wait,
  configs
} from '../../common/common.js';

import * as Constants from '../../common/constants.js';
import * as Tabs from '../../common/tabs.js';
import * as Tree from '../../common/tree.js';
import * as MetricsData from '../../common/metrics-data.js';
import * as Cache from '../../common/cache.js';
import EventListenerManager from '../../common/EventListenerManager.js';

import * as Indent from './indent.js';

export const onRestored = new EventListenerManager();

let gTracking = false;

let gLastWindowCacheOwner;
let gTargetWindow;
let gTabBar;

export function init() {
  gTargetWindow = Tabs.getWindow();
  gTabBar       = document.querySelector('#tabbar');
}

export function startTracking() {
  gTracking = true;
  configs.$addObserver(onConfigChange);
}

export async function getEffectiveWindowCache(aOptions = {}) {
  MetricsData.add('getEffectiveWindowCache start');
  Cache.log('getEffectiveWindowCache: start');
  cancelReservedUpdateCachedTabbar(); // prevent to break cache before loading
  let cache;
  let cachedSignature;
  let actualSignature;
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
      Cache.log(`getEffectiveWindowCache: got from the owner ${gLastWindowCacheOwner.id}`, {
        cachedSignature, cache, tabsDirty, collapsedDirty
      });
      if (cache &&
          cache.tabs &&
          cachedSignature &&
          cachedSignature != Cache.signatureFromTabsCache(cache.tabbar.contents)) {
        Cache.log('getEffectiveWindowCache: cache is broken.', {
          signature: cachedSignature,
          cache:     Cache.signatureFromTabsCache(cache.tabbar.contents)
        });
        cache = cachedSignature = null;
        clearWindowCache();
      }
      if (aOptions.ignorePinnedTabs &&
          cache &&
          cache.tabbar &&
          cache.tabbar.contents &&
          cachedSignature) {
        cache.tabbar.contents = Cache.trimTabsCache(cache.tabbar.contents, cache.tabbar.pinnedTabsCount);
        cachedSignature       = Cache.trimSignature(cachedSignature, cache.tabbar.pinnedTabsCount);
      }
      MetricsData.add('getEffectiveWindowCache get ' + JSON.stringify({
        cache: !!cache,
        version: cache && cache.version
      }));
      Cache.log('getEffectiveWindowCache: verify cache (1)', { cache, tabsDirty, collapsedDirty });
      if (cache && cache.version == Constants.kSIDEBAR_CONTENTS_VERSION) {
        Cache.log('getEffectiveWindowCache: restore sidebar from cache');
        cache.tabbar.tabsDirty      = tabsDirty;
        cache.tabbar.collapsedDirty = collapsedDirty;
        cache.signature = cachedSignature;
      }
      else {
        Cache.log('getEffectiveWindowCache: invalid cache ', cache);
        cache = null;
      }
    })(),
    (async () => {
      actualSignature = await Cache.getWindowSignature(gTargetWindow);
    })()
  ]);

  const signatureMatched = Cache.matcheSignatures({
    actual: actualSignature,
    cached: cachedSignature
  });
  Cache.log('getEffectiveWindowCache: verify cache (2)', {
    cache, actualSignature, cachedSignature, signatureMatched
  });
  if (!cache ||
      !signatureMatched) {
    clearWindowCache();
    cache = null;
    Cache.log('getEffectiveWindowCache: failed');
    MetricsData.add('getEffectiveWindowCache fail');
  }
  else {
    cache.offset          = actualSignature.replace(cachedSignature, '').trim().split('\n').filter(aPart => !!aPart).length;
    cache.actualSignature = actualSignature;
    Cache.log('getEffectiveWindowCache: success ');
    MetricsData.add('getEffectiveWindowCache success');
  }

  return cache;
}

export async function restoreTabsFromCache(aCache, aParams = {}) {
  const offset    = aParams.offset || 0;
  const container = Tabs.getTabsContainer(gTargetWindow);
  if (offset <= 0) {
    if (container)
      container.parentNode.removeChild(container);
    gTabBar.setAttribute('style', aCache.style);
  }

  let restored = Cache.restoreTabsFromCacheInternal({
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
      let currentStructrue = Tree.getTreeStructureFromTabs(allTabs);
      if (currentStructrue.map(aItem => aItem.parent).join(',') != masterStructure.map(aItem => aItem.parent).join(',')) {
        Cache.log(`restoreTabsFromCache: failed to restore tabs, mismatched tree for ${gTargetWindow}. fallback to regular way.`);
        restored = false;
        let container = Tabs.getTabsContainer(gTargetWindow);
        if (container)
          container.parentNode.removeChild(container);
      }
      if (restored && aCache.collapsedDirty) {
        let structure = currentStructrue.reverse();
        allTabs.reverse().forEach((aTab, aIndex) => {
          Tree.collapseExpandSubtree(aTab, {
            collapsed: structure[aIndex].collapsed,
            justNow:   true
          });
        });
      }
      onRestored.dispatch();
    }
    catch(e) {
      Cache.log(String(e), e.stack);
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
    //Cache.log('updateWindowCache: delete cache from ', gLastWindowCacheOwner, aKey);
    //return browser.sessions.removeWindowValue(gLastWindowCacheOwner, aKey);
    return browser.sessions.removeTabValue(gLastWindowCacheOwner.id, aKey);
  }
  else {
    //Cache.log('updateWindowCache: set cache for ', gLastWindowCacheOwner, aKey);
    //return browser.sessions.setWindowValue(gLastWindowCacheOwner, aKey, aValue);
    return browser.sessions.setTabValue(gLastWindowCacheOwner.id, aKey, aValue);
  }
}

function clearWindowCache() {
  Cache.log('clearWindowCache ', { stack: new Error().stack });
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR);
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

export function markWindowCacheDirty(akey) {
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

export async function reserveToUpdateCachedTabbar() {
  if (!gTracking ||
      !configs.useCachedTree)
    return;

  // If there is any opening (but not resolved its unique id yet) tab,
  // we are possibly restoring tabs. To avoid cache breakage before
  // restoration, we must wait until we know whether there is any other
  // restoring tab or not.
  if (Tabs.hasCreatingTab())
    await Tabs.waitUntilAllTabsAreCreated();

  const container = Tabs.getTabsContainer(gTargetWindow);
  if (container.allTabsRestored)
    return;

  Cache.log('reserveToUpdateCachedTabbar ', { stack: new Error().stack });
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
  if (Tabs.hasCreatingTab())
    await Tabs.waitUntilAllTabsAreCreated();
  const container = Tabs.getTabsContainer(gTargetWindow);
  const signature = await Cache.getWindowSignature(gTargetWindow);
  if (container.allTabsRestored)
    return;
  Cache.log('updateCachedTabbar ', { stack: new Error().stack });
  gLastWindowCacheOwner = getWindowCacheOwner(gTargetWindow);
  updateWindowCache(Constants.kWINDOW_STATE_CACHED_SIDEBAR, {
    version: Constants.kSIDEBAR_CONTENTS_VERSION,
    tabbar: {
      contents:        Tabs.allTabsContainer.innerHTML,
      style:           gTabBar.getAttribute('style'),
      pinnedTabsCount: Tabs.getPinnedTabs(container).length
    },
    indent: Indent.getCacheInfo(),
    signature
  });
}


Tabs.onFaviconUpdated.addListener(async () => {
  await wait(0);
  markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
});

Tabs.onUpdated.addListener(async () => {
  await wait(0);
  markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
});

Tabs.onLabelUpdated.addListener(async () => {
  await wait(0);
  markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
});

Tabs.onParentTabUpdated.addListener(async () => {
  await wait(0);
  markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
});

Tabs.onCreated.addListener(async () => {
  await wait(0);
  reserveToUpdateCachedTabbar();
});

Tabs.onRemoved.addListener(async () => {
  // "Restore Previous Session" closes some tabs at first, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  await wait(0);
  if (configs.animation) {
    await wait(configs.animation ? configs.collapseDuration : 0);
    await reserveToUpdateCachedTabbar();
  }
});

Tabs.onMoved.addListener(() => {
  reserveToUpdateCachedTabbar();
});

Tree.onLevelChanged.addListener(async () => {
  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToUpdateCachedTabbar();
});

Tabs.onDetached.addListener(async aTab => {
  if (!Tabs.ensureLivingTab(aTab))
    return;
  await wait(0);
  reserveToUpdateCachedTabbar();
});

Tree.onAttached.addListener(async () => {
  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToUpdateCachedTabbar();
});

Tree.onDetached.addListener(async () => {
  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToUpdateCachedTabbar();
});

Tabs.onPinned.addListener(() => {
  reserveToUpdateCachedTabbar();
});

Tabs.onUnpinned.addListener(() => {
  reserveToUpdateCachedTabbar();
});

Tabs.onShown.addListener(() => {
  reserveToUpdateCachedTabbar();
});

Tabs.onHidden.addListener(() => {
  reserveToUpdateCachedTabbar();
});

function onConfigChange(aChangedKey) {
  switch (aChangedKey) {
    case 'useCachedTree':
      if (!configs[aChangedKey]) {
        reserveToUpdateCachedTabbar();
      }
      else {
        clearWindowCache();
        location.reload();
      }
      break;
  }
}
