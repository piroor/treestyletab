/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

function logForCache(...aArgs) {
  if (configs.logOnCache)
    log(...aArgs);
}

async function getWindowSignature(aWindowIdOrTabs) {
  if (typeof aWindowIdOrTabs == 'number') {
    aWindowIdOrTabs = await browser.tabs.query({ windowId: aWindowIdOrTabs });
  }
  var uniqueIds = await getUniqueIds(aWindowIdOrTabs);
  return uniqueIds.join('\n');
}

async function getUniqueIds(aApiTabs) {
  var uniqueIds = await Promise.all(aApiTabs.map(aApiTab => browser.sessions.getTabValue(aApiTab.id, Constants.kPERSISTENT_ID)));
  return uniqueIds.map(aId => aId && aId.id || '?');
}

function trimSignature(aSignature, aIgnoreCount) {
  if (!aIgnoreCount || aIgnoreCount < 0)
    return aSignature;
  return aSignature.split('\n').slice(aIgnoreCount).join('\n');
}

function trimTabsCache(aCache, aIgnoreCount) {
  if (!aIgnoreCount || aIgnoreCount < 0)
    return aCache;
  return aCache.replace(new RegExp(`(<li[^>]*>[\\w\\W]+?<\/li>){${aIgnoreCount}}`), '');
}

function matcheSignatures(aSignatures) {
  return (
    aSignatures.actual &&
    aSignatures.cached &&
    aSignatures.actual.indexOf(aSignatures.cached) + aSignatures.cached.length == aSignatures.actual.length
  );
}

function signatureFromTabsCache(aCache) {
  var uniqueIdMatcher = new RegExp(`${Constants.kPERSISTENT_ID}="([^"]+)"`);
  if (!aCache.match(/(<li[^>]*>[\w\W]+?<\/li>)/g))
    logForCache('NO MATCH ', aCache);
  return (aCache.match(/(<li[^>]*>[\w\W]+?<\/li>)/g) || []).map(aMatched => {
    var uniqueId = aMatched.match(uniqueIdMatcher);
    return uniqueId ? uniqueId[1] : '?' ;
  }).join('\n');
}

function restoreTabsFromCacheInternal(aParams) {
  logForCache(`restoreTabsFromCacheInternal: restore tabs for ${aParams.windowId} from cache`);
  var offset    = aParams.offset || 0;
  var apiTabs   = aParams.tabs.slice(offset);
  var container = Tabs.getTabsContainer(aParams.windowId);
  var tabElements;
  if (offset > 0) {
    if (!container ||
        container.childNodes.length <= offset) {
      logForCache('restoreTabsFromCacheInternal: missing container');
      return false;
    }
    logForCache(`restoreTabsFromCacheInternal: there is ${container.childNodes.length} tabs`);
    logForCache('restoreTabsFromCacheInternal: delete obsolete tabs, offset = ', offset, apiTabs[0].id);
    let insertionPoint = document.createRange();
    insertionPoint.selectNodeContents(container);
    // for safety, now I use actual ID string instead of short way.
    insertionPoint.setStartBefore(Tabs.getTabById(makeTabId(apiTabs[0])));
    insertionPoint.setEndAfter(Tabs.getTabById(makeTabId(apiTabs[apiTabs.length - 1])));
    insertionPoint.deleteContents();
    let tabsMustBeRemoved = apiTabs.map(Tabs.getTabById);
    logForCache('restoreTabsFromCacheInternal: cleared?: ',
                tabsMustBeRemoved.every(aTab => !aTab),
                tabsMustBeRemoved.map(dumpTab));
    logForCache(`restoreTabsFromCacheInternal: => ${container.childNodes.length} tabs`);
    let matched = aParams.cache.match(/<li/g);
    logForCache(`restoreTabsFromCacheInternal: restore ${matched.length} tabs from cache`);
    dumpCache(aParams.cache);
    insertionPoint.selectNodeContents(container);
    insertionPoint.collapse(false);
    let source   = aParams.cache.replace(/^<ul[^>]+>|<\/ul>$/g, '');
    let fragment = insertionPoint.createContextualFragment(source);
    insertionPoint.insertNode(fragment);
    insertionPoint.detach();
    tabElements = Array.slice(container.childNodes, -matched.length);
  }
  else {
    if (container)
      container.parentNode.removeChild(container);
    logForCache('restoreTabsFromCacheInternal: restore');
    dumpCache(aParams.cache);
    let insertionPoint = aParams.insertionPoint || (() => {
      var range = document.createRange();
      range.selectNodeContents(gAllTabs);
      range.collapse(false);
      return range;
    })();
    let fragment = insertionPoint.createContextualFragment(aParams.cache);
    container = fragment.firstChild;
    insertionPoint.insertNode(fragment);
    container.id = `window-${aParams.windowId}`;
    container.dataset.windowId = aParams.windowId;
    tabElements = Array.slice(container.childNodes);
    if (!aParams.insertionPoint)
      insertionPoint.detach();
  }

  logForCache('restoreTabsFromCacheInternal: post process ', { tabElements, apiTabs });
  if (tabElements.length != apiTabs.length) {
    logForCache('restoreTabsFromCacheInternal: Mismatched number of restored tabs?');
    container.parentNode.removeChild(container); // clear dirty tree!
    return false;
  }
  try {
    fixupTabsRestoredFromCache(tabElements, apiTabs, {
      dirty: aParams.shouldUpdate
    });
  }
  catch(e) {
    logForCache(String(e), e.stack);
    throw e;
  }
  logForCache('restoreTabsFromCacheInternal: done');
  Tabs.dumpAllTabs();
  return true;
}

function dumpCache(aCache) {
  logForCache(aCache
    .replace(new RegExp(`([^\\s=])="[^"]*(\\n[^"]*)+"`, 'g'), '$1="..."')
    .replace(/(<(li|ul))/g, '\n$1'));
}

function fixupTabsRestoredFromCache(aTabs, aApiTabs, aOptions = {}) {
  if (aTabs.length != aApiTabs.length)
    throw new Error(`fixupTabsRestoredFromCache: Mismatched number of tabs restored from cache, elements=${aTabs.length}, tabs.Tab=${aApiTabs.length}`);
  logForCache('fixupTabsRestoredFromCache start ', { elements: aTabs.map(aTab => aTab.id), apiTabs: aApiTabs });
  var idMap = {};
  // step 1: build a map from old id to new id
  aTabs.forEach((aTab, aIndex) => {
    const oldId = aTab.id;
    var apiTab = aApiTabs[aIndex];
    aTab.id = makeTabId(apiTab);
    aTab.apiTab = apiTab;
    logForCache(`fixupTabsRestoredFromCache: remap ${oldId} => ${aTab.id}`);
    aTab.setAttribute(Constants.kAPI_TAB_ID, apiTab.id || -1);
    aTab.setAttribute(Constants.kAPI_WINDOW_ID, apiTab.windowId || -1);
    idMap[oldId] = aTab;
  });
  // step 2: restore information of tabs
  aTabs.forEach((aTab, aIndex) => {
    fixupTabRestoredFromCache(aTab, aApiTabs[aIndex], {
      idMap: idMap,
      dirty: aOptions.dirty
    });
  });
  // step 3: update tabs based on restored information.
  // this step must be done after the step 2 is finished for all tabs
  // because updating operation can refer other tabs.
  if (aOptions.dirty) {
    for (let tab of aTabs) {
      updateTab(tab, tab.apiTab, { forceApply: true });
    }
  }
  else {
    for (let tab of aTabs) {
      updateTabDebugTooltip(tab);
    }
  }

  // update focused tab appearance
  browser.tabs.query({ windowId: aTabs[0].apiTab.windowId, active: true })
    .then(aActiveTabs => updateTabFocused(Tabs.getTabById(aActiveTabs[0])));
}

function fixupTabRestoredFromCache(aTab, aApiTab, aOptions = {}) {
  updateUniqueId(aTab);
  aTab.opened = Promise.resolve(true);
  aTab.closedWhileActive = new Promise((aResolve, aReject) => {
    aTab._resolveClosedWhileActive = aResolve;
  });

  const idMap = aOptions.idMap;

  logForCache('fixupTabRestoredFromCache children: ', aTab.getAttribute(Constants.kCHILDREN));
  aTab.childTabs = (aTab.getAttribute(Constants.kCHILDREN) || '')
    .split('|')
    .map(aOldId => idMap[aOldId])
    .filter(aTab => !!aTab);
  if (aTab.childTabs.length > 0)
    aTab.setAttribute(Constants.kCHILDREN, `|${aTab.childTabs.map(aTab => aTab.id).join('|')}|`);
  else
    aTab.removeAttribute(Constants.kCHILDREN);
  logForCache('fixupTabRestoredFromCache children: => ', aTab.getAttribute(Constants.kCHILDREN));

  logForCache('fixupTabRestoredFromCache parent: ', aTab.getAttribute(Constants.kPARENT));
  aTab.parentTab = idMap[aTab.getAttribute(Constants.kPARENT)] || null;
  if (aTab.parentTab)
    aTab.setAttribute(Constants.kPARENT, aTab.parentTab.id);
  else
    aTab.removeAttribute(Constants.kPARENT);
  logForCache('fixupTabRestoredFromCache parent: => ', aTab.getAttribute(Constants.kPARENT));
  aTab.ancestorTabs = Tabs.getAncestorTabs(aTab, { force: true });
}
