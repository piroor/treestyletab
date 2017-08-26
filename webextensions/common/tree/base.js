/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

var gAllTabs;
var gTargetWindow = null;
var gRestoringTree = false;
var gIndent = -1;
var gIndentProp = 'marginLeft';
var gNeedRestoreTree = false;

var gIsMac = /Darwin/.test(navigator.platform);

function buildTab(aTab, aOptions = {}) {
  log('build tab for ', aTab);

  var item = document.createElement('li');
  item.apiTab = aTab;
  item.setAttribute('id', `tab-${aTab.windowId}-${aTab.id}`);
  //item.setAttribute(kCHILDREN, '');
  item.classList.add('tab');
  if (aTab.active)
    item.classList.add(kTAB_STATE_ACTIVE);
  if (aTab.pinned)
    item.classList.add(kTAB_STATE_PINNED);
  item.classList.add(kTAB_STATE_SUBTREE_COLLAPSED);

  var title = aTab.title;
  if (aTab.url && aTab.url.indexOf(kGROUP_TAB_URI) == 0) {
    item.classList.add(kTAB_STATE_GROUP_TAB);
    title = getTitleFromGroupTabURI(aTab.url);
  }
  var label = document.createElement('span');
  label.classList.add(kLABEL);
  label.appendChild(document.createTextNode(title));
  item.appendChild(label);
  item.setAttribute('title', title);

  item.classList.add(aTab.status);

  window.onTabBuilt && onTabBuilt(item);

  if (aOptions.existing) {
    item.classList.add(kTAB_STATE_ANIMATION_READY);
  }

  return item;
}

function updateTab(aTab) {
  var apiTab = aTab.apiTab;
  var label = apiTab.title;
  if (apiTab.url && apiTab.url.indexOf(kGROUP_TAB_URI) == 0) {
    aTab.classList.add(kTAB_STATE_GROUP_TAB);
    label = getTitleFromGroupTabURI(apiTab.url);
  }
  else {
    aTab.classList.remove(kTAB_STATE_GROUP_TAB);
  }

  getTabLabel(aTab).textContent = label;
  aTab.setAttribute('title', label);

  window.onTabFaviconUpdated &&
    onTabFaviconUpdated(aTab, aTab.favIconUrl);

  aTab.classList.remove(aTab.status == 'loading' ? 'complete' : 'loading');
  aTab.classList.add(aTab.status);

  var previousState = isPinned(aTab);
  if (aTab.pinned) {
    aTab.classList.add(kTAB_STATE_PINNED);
    if (!previousState)
      window.onTabPinned && onTabPinned(aTab);
  }
  else {
    aTab.classList.remove(kTAB_STATE_PINNED);
    if (previousState)
      window.onTabUnpinned && onTabUnpinned(aTab);
  }
}

function getTitleFromGroupTabURI(aURI) {
  var title = aURI.match(/title=([^&;]*)/);
  return title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab.label.default');
}

function buildTabsContainerFor(aWindowId) {
  var container = document.createElement('ul');
  container.windowId = aWindowId;
  container.setAttribute('id', `window-${aWindowId}`);
  container.classList.add('tabs');

  container.internalMovingCount = 0;
  container.subTreeMovingCount = 0;
  container.subTreeChildrenMovingCount = 0;
  container.doingCollapseExpandCount = 0;
  container.internalFocusCount = 0;
  container.openingCount = 0;
  container.toBeOpenedTabsWithPositionsCount = 0;
  container.openedNewTabs = [];
  container.openedNewTabsTimeout = null;

  return container;
}

function clearAllTabsContainers() {
  var range = document.createRange();
  range.selectNodeContents(gAllTabs);
  range.deleteContents();
  range.detach();
}

async function selectTabInternally(aTab, aOptions = {}) {
  log('selectTabInternally: ', dumpTab(aTab));
  var container = aTab.parentNode;
  container.internalFocusCount++;
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:     kCOMMAND_SELECT_TAB_INTERNALLY,
      windowId: aTab.apiTab.windowId,
      tab:      aTab.id
    });
    container.internalFocusCount--
    return;
  }

  await browser.tabs.update(aTab.apiTab.id, { active: true })
          .catch(handleMissingTabError);
  /**
   * Note: enough large delay is truly required to wait various
   * tab-related operations are processed in background and sidebar.
   */
  setTimeout(() => container.internalFocusCount--,
    configs.acceptableDelayForInternalFocusMoving);
}

async function moveTabInternallyBefore(aTab, aNextTab, aOptions = {}) {
  if (!aTab)
    return;

  var container = aTab.parentNode;

  if (aOptions.inRemote) {
    container.internalMovingCount++;
    await browser.runtime.sendMessage({
      type:     kCOMMAND_MOVE_TAB_INTERNALLY_BEFORE,
      windowId: gTargetWindow,
      tab:      aTab.id,
      nextTab:  aNextTab && aNextTab.id
    });
    container.internalMovingCount--
    return;
  }

  var fromIndex, toIndex;
  if (!aNextTab) {
    [fromIndex, toIndex] = await getApiTabIndex(aTab.apiTab.id, getLastTab(aTab).apiTab.id);
  }
  else {
    [fromIndex, toIndex] = await getApiTabIndex(aTab.apiTab.id, aNextTab.apiTab.id);
    if (fromIndex < toIndex)
      toIndex--;
  }
  log('index of API tabs: ', { fromIndex, toIndex });

  if (fromIndex < 0 || toIndex < 0) {
    log('alrady closed tab cannot be moved!');
    return;
  }

  if (fromIndex == toIndex) {
    log('tab is already placed expected place');
    return;
  }

  log(`tab is not placed at ${toIndex} yet`);
  var container = aTab.parentNode;
  container.internalMovingCount++;
  browser.tabs.move(aTab.apiTab.id, {
    windowId: container.windowId,
    index:    toIndex
  }).catch(handleMissingTabError)
    .then(() => container.internalMovingCount--);
}

async function moveTabsInternallyAfter(aTabs, aReferenceTab, aOptions = {}) {
  if (!aTabs.length || !aReferenceTab)
    return;

  var container = aTabs[0].parentNode;
  container.internalMovingCount++;
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:        kCOMMAND_MOVE_TABS_INTERNALLY_AFTER,
      windowId:    gTargetWindow,
      tabs:        aTabs.map(aTab => aTab.id),
      previousTab: aReferenceTab.id
    });
    container.internalMovingCount--;
    return;
  }

  try {
    var lastMoved = aReferenceTab;
    var count = 0;
    for (let tab of aTabs) {
      let [toIndex, fromIndex] = await getApiTabIndex(lastMoved.apiTab.id, tab.apiTab.id);
      if (fromIndex > toIndex)
        toIndex++;
      log(`moving tab ${dumpTab(tab)} to ${toIndex}`);
      if (fromIndex != toIndex)
        await browser.tabs.move(tab.apiTab.id, {
          windowId: container.windowId,
          index: toIndex
        });
      lastMoved = tab;
      // tab will be moved by handling of API event
    }
  }
  catch(e) {
    log('moveTabsNextTo failed: ', String(e));
  }
  await wait(50);
  container.internalMovingCount--;
}

async function loadURI(aURI, aOptions = {}) {
  if (!aOptions.windowId && gTargetWindow)
    aOptions.windowId = gTargetWindow;
  if (aOptions.isRemote) {
    await browser.runtime.sendMessage(inherit(aOptions, {
      type: kCOMMAND_LOAD_URI,
      tab:  aOptions.tab && aOptions.tab.id
    }));
  }
  else {
    let apiTabId;
    if (aOptions.tab) {
      apiTabId = aOptions.tab.apiTab.id;
    }
    else {
      let apiTabs = await browser.tabs.query({
        windowId: aOptions.windowId,
        active: true
      });
      apiTabId = apiTabs[0].id;
    }
    await browser.tabs.update({
      windowId: aOptions.windowId,
      id:       apiTabId,
      url:      aURI
    });
  }
}

async function openNewTab(aOptions = {}) {
  return await openURIInTab(null, aOptions);
}

async function openURIInTab(aURI, aOptions = {}) {
  var tabs = await openURIsInTabs([aURI], aOptions);
  return tabs[0];
}

async function openURIsInTabs(aURIs, aOptions = {}) {
  if (!aOptions.windowId && gTargetWindow)
    aOptions.windowId = gTargetWindow;

  return await doAndGetNewTabs(async () => {
    if (aOptions.inRemote) {
      await browser.runtime.sendMessage(inherit(aOptions, {
        type:         kCOMMAND_NEW_TABS,
        uris:         aURIs,
        parent:       aOptions.parent && aOptions.parent.id,
        insertBefore: aOptions.insertBefore && aOptions.insertBefore.id
      }));
    }
    else {
      let startIndex = aOptions.insertBefore ?
                         getTabIndex(aOptions.insertBefore) :
                         -1 ;
      let container = getTabsContainer(aOptions.windowId);
      container.toBeOpenedTabsWithPositionsCount += aURIs.length;
      await Promise.all(aURIs.map((aURI, aIndex) => {
        var params = {};
        if (aURI)
          params.url = aURI;
        if (aIndex == 0)
          params.active = !aOptions.inBackground;
        if (aOptions.parent)
          params.openerTabId = aOptions.parent.apiTab.id;
        if (startIndex > -1)
          params.index = startIndex + aIndex;
        return browser.tabs.create(params);
      }));
    }
  });
}

function makeGroupTabURI(aTitle) {
  var base = kGROUP_TAB_URI;
  return `${base}?title=${encodeURIComponent(aTitle)}`;
}
