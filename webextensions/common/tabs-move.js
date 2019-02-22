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
 * Portions created by the Initial Developer are Copyright (C) 2011-2018
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

import {
  log as internalLogger,
  wait,
  dumpTab,
  configs
} from './common.js';

import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as Tabs from './tabs.js';
import { SequenceMatcher } from './diff.js';

function log(...args) {
  internalLogger('common/tabs-move', ...args);
}
function logApiTabs(...args) {
  internalLogger('common/api-tabs', ...args);
}


// ========================================================
// primitive methods for internal use

export async function moveTabsBefore(tabs, referenceTab, options = {}) {
  log('moveTabsBefore: ', tabs.map(dumpTab), dumpTab(referenceTab), options);
  if (!tabs.length ||
      !Tabs.ensureLivingTab(referenceTab))
    return [];

  if (Tabs.isAllTabsPlacedBefore(tabs, referenceTab)) {
    log('moveTabsBefore:no need to move');
    return [];
  }
  return moveTabsInternallyBefore(tabs, referenceTab, options);
}
export async function moveTabBefore(tab, referenceTab, options = {}) {
  return moveTabsBefore([tab], referenceTab, options).then(moved => moved.length > 0);
}

async function moveTabsInternallyBefore(tabs, referenceTab, options = {}) {
  if (!tabs.length ||
      !Tabs.ensureLivingTab(referenceTab))
    return [];

  const container = tabs[0].parentNode;

  log('moveTabsInternallyBefore: ', tabs.map(dumpTab), dumpTab(referenceTab), options);
  if (options.inRemote || options.broadcast) {
    const message = {
      type:     Constants.kCOMMAND_MOVE_TABS_BEFORE,
      windowId: tabs[0].apiTab.windowId,
      tabs:     tabs.map(tab => tab.id),
      nextTab:  referenceTab.id,
      broadcasted: !!options.broadcast
    };
    if (options.inRemote) {
      const tabIds = await browser.runtime.sendMessage(message);
      return tabIds.map(Tabs.getTabById);
    }
    else {
      browser.runtime.sendMessage(message);
    }
  }

  try {
    /*
      Tab elements are moved by tabs.onMoved automatically, but
      the operation is asynchronous. To help synchronous operations
      following to this operation, we need to move tabs immediately.
    */
    let movedTabsCount = 0;
    for (const tab of tabs) {
      const oldPreviousTab = Tabs.getPreviousTab(tab);
      const oldNextTab     = Tabs.getNextTab(tab);
      if (oldNextTab == referenceTab) // no move case
        continue;
      container.internalMovingTabs.add(tab.apiTab.id);
      container.alreadyMovedTabs.add(tab.apiTab.id);
      container.insertBefore(tab, referenceTab);
      tab.apiTab.index = referenceTab ? referenceTab.apiTab.index : 0;
      Tabs.track(tab.apiTab);
      movedTabsCount++;
      Tabs.onTabElementMoved.dispatch(tab, {
        oldPreviousTab,
        oldNextTab,
        broadcasted: !!options.broadcasted
      });
    }
    syncOrderOfChildTabs(tabs.map(Tabs.getParentTab));
    if (movedTabsCount == 0) {
      log(' => actually nothing moved');
    }
    else {
      log('Tab nodes rearranged by moveTabsInternallyBefore:\n'+(!configs.debug ? '' :
        Array.from(container.childNodes)
          .map(tab => ' - '+tab.apiTab.index+': '+tab.id+(tabs.includes(tab) ? '[MOVED]' : ''))
          .join('\n')));
    }
    if (!options.broadcasted) {
      if (options.delayedMove) // Wait until opening animation is finished.
        await wait(configs.newTabAnimationDuration);
      syncTabsPositionToApiTabs(tabs.map(tab => tab.apiTab));
    }
  }
  catch(e) {
    ApiTabs.handleMissingTabError(e);
    log('moveTabsInternallyBefore failed: ', String(e));
  }
  return tabs;
}
export async function moveTabInternallyBefore(tab, referenceTab, options = {}) {
  return moveTabsInternallyBefore([tab], referenceTab, options);
}

function syncOrderOfChildTabs(parentTabs) {
  if (!Array.isArray(parentTabs))
    parentTabs = [parentTabs];

  let updatedParentTabs = new Map();
  for (const parent of parentTabs) {
    if (!parent || updatedParentTabs.has(parent))
      continue;
    updatedParentTabs.set(parent, true);
    if (parent.childTabs.length < 2)
      continue;
    parent.childTabs = parent.childTabs.map(tab => {
      return {
        index: tab.apiTab.index,
        tab:   tab
      };
    }).sort((aA, aB) => aA.index - aB.index).map(item => item.tab);
    const childIds = parent.childTabs.map(tab => tab.id);
    Tabs.setAttribute(parent, Constants.kCHILDREN, `|${childIds.join('|')}|`);
    log('updateChildTabsInfo: ', childIds);
  }
  updatedParentTabs = undefined;
}

export async function moveTabsAfter(tabs, referenceTab, options = {}) {
  log('moveTabsAfter: ', tabs.map(dumpTab), dumpTab(referenceTab), options);
  if (!tabs.length ||
      !Tabs.ensureLivingTab(referenceTab))
    return [];

  if (Tabs.isAllTabsPlacedAfter(tabs, referenceTab)) {
    log('moveTabsAfter:no need to move');
    return [];
  }
  return moveTabsInternallyAfter(tabs, referenceTab, options);
}
export async function moveTabAfter(tab, referenceTab, options = {}) {
  return moveTabsAfter([tab], referenceTab, options).then(moved => moved.length > 0);
}

async function moveTabsInternallyAfter(tabs, referenceTab, options = {}) {
  if (!tabs.length ||
      !Tabs.ensureLivingTab(referenceTab))
    return [];

  const container = tabs[0].parentNode;

  log('moveTabsInternallyAfter: ', tabs.map(dumpTab), dumpTab(referenceTab), options);
  if (options.inRemote || options.broadcast) {
    const message = {
      type:        Constants.kCOMMAND_MOVE_TABS_AFTER,
      windowId:    tabs[0].apiTab.windowId,
      tabs:        tabs.map(tab => tab.id),
      previousTab: referenceTab.id,
      broadcasted: !!options.broadcast
    };
    if (options.inRemote) {
      const tabIds = await browser.runtime.sendMessage(message);
      return tabIds.map(Tabs.getTabById);
    }
    else {
      browser.runtime.sendMessage(message);
    }
  }

  try {
    /*
      Tab elements are moved by tabs.onMoved automatically, but
      the operation is asynchronous. To help synchronous operations
      following to this operation, we need to move tabs immediately.
    */
    let nextTab = Tabs.getNextTab(referenceTab);
    if (tabs.includes(nextTab))
      nextTab = null;
    let movedTabsCount = 0;
    for (const tab of tabs) {
      const oldPreviousTab = Tabs.getPreviousTab(tab);
      const oldNextTab     = Tabs.getNextTab(tab);
      if (oldNextTab == nextTab) // no move case
        continue;
      container.internalMovingTabs.add(tab.apiTab.id);
      container.alreadyMovedTabs.add(tab.apiTab.id);
      container.insertBefore(tab, nextTab);
      tab.apiTab.index = nextTab ? referenceTab.apiTab.index : 0;
      Tabs.track(tab.apiTab);
      movedTabsCount++;
      Tabs.onTabElementMoved.dispatch(tab, {
        oldPreviousTab,
        oldNextTab,
        broadcasted: !!options.broadcasted
      });
    }
    syncOrderOfChildTabs(tabs.map(Tabs.getParentTab));
    if (movedTabsCount == 0) {
      log(' => actually nothing moved');
    }
    else {
      log('Tab nodes rearranged by moveTabsInternallyAfter:\n'+(!configs.debug ? '' :
        Array.from(container.childNodes)
          .map(tab => ' - '+tab.apiTab.index+': '+tab.id+(tabs.includes(tab) ? '[MOVED]' : ''))
          .join('\n')));
    }
    if (!options.broadcasted) {
      if (options.delayedMove) // Wait until opening animation is finished.
        await wait(configs.newTabAnimationDuration);
      syncTabsPositionToApiTabs(tabs.map(tab => tab.apiTab));
    }
  }
  catch(e) {
    ApiTabs.handleMissingTabError(e);
    log('moveTabsInternallyAfter failed: ', String(e));
  }
  return tabs;
}
export async function moveTabInternallyAfter(tab, referenceTab, options = {}) {
  return moveTabsInternallyAfter([tab], referenceTab, options);
}


// ========================================================
// Synchronize order of tab elements to browser's tabs

const mMovedApiTabs     = new Map();
const mPreviousSync     = new Map();
const mDelayedSync      = new Map();
const mDelayedSyncTimer = new Map();

export async function waitUntilSynchronized(windowId) {
  return mPreviousSync.get(windowId) || mDelayedSync.get(windowId);
}

function syncTabsPositionToApiTabs(apiTabs) {
  const windowId = apiTabs[0].windowId;
  //log(`syncTabsPositionToApiTabs(${windowId})`);
  const movedApiTabs = mMovedApiTabs.get(windowId) || [];
  mMovedApiTabs.set(windowId, movedApiTabs.concat(apiTabs));
  if (mDelayedSyncTimer.has(windowId))
    clearTimeout(mDelayedSyncTimer.get(windowId));
  const delayedSync = new Promise((resolve, _reject) => {
    mDelayedSyncTimer.set(windowId, setTimeout(() => {
      mDelayedSync.delete(windowId);
      let previousSync = mPreviousSync.get(windowId);
      if (previousSync)
        previousSync = previousSync.then(() => syncTabsPositionToApiTabsInternal(windowId));
      else
        previousSync = syncTabsPositionToApiTabsInternal(windowId);
      previousSync = previousSync.then(resolve);
      mPreviousSync.set(windowId, previousSync);
    }, 250));
  }).then(() => {
    mPreviousSync.delete(windowId);
  });
  mDelayedSync.set(windowId, delayedSync);
  return delayedSync;
}
async function syncTabsPositionToApiTabsInternal(windowId) {
  mDelayedSyncTimer.delete(windowId);

  const movedApiTabs = mMovedApiTabs.get(windowId) || [];
  mMovedApiTabs.delete(windowId);

  if (Tabs.hasCreatingTab(windowId))
    await Tabs.waitUntilAllTabsAreCreated(windowId);
  if (Tabs.hasMovingTab(windowId))
    await Tabs.waitUntilAllTabsAreMoved(windowId);

  const container = Tabs.getTabsContainer(windowId);

  for (const apiTab of movedApiTabs) {
    container.internalMovingTabs.delete(apiTab.id);
    container.alreadyMovedTabs.delete(apiTab.id);
  }

  // Tabs may be removed while waiting.
  const currentApiTabIds = (await browser.tabs.query({ windowId })).map(apiTab => apiTab.id);
  const apiTabIds        = Array.from(container.childNodes, tab => tab.apiTab.id);
  log(`syncTabsPositionToApiTabs(${windowId}): rearrange `, { from: currentApiTabIds, to: apiTabIds });

  let apiTabIdsForUpdatedIndices = Array.from(currentApiTabIds);

  const moveOperations = (new SequenceMatcher(currentApiTabIds, apiTabIds)).operations();
  const movedTabs = new Set();
  const needToBeReindexedTabs = new Set();
  for (const operation of moveOperations) {
    const [tag, fromStart, fromEnd, toStart, toEnd] = operation;
    log(`syncTabsPositionToApiTabs(${windowId}): operation `, { tag, fromStart, fromEnd, toStart, toEnd });
    switch (tag) {
      case 'equal':
      case 'delete':
        break;

      case 'insert':
      case 'replace':
        let moveTabIds = apiTabIds.slice(toStart, toEnd);
        const referenceId = currentApiTabIds[fromStart] || null;
        let toIndex = -1;
        let fromIndices = moveTabIds.map(id => apiTabIdsForUpdatedIndices.indexOf(id));
        if (referenceId) {
          toIndex = apiTabIdsForUpdatedIndices.indexOf(referenceId);
        }
        if (toIndex < 0)
          toIndex = apiTabIds.length;
        // ignore already removed tabs!
        moveTabIds = moveTabIds.filter((id, index) => fromIndices[index] > -1);
        if (moveTabIds.length == 0)
          continue;
        fromIndices = fromIndices.filter(index => index > -1);
        const fromIndex = fromIndices[0];
        if (fromIndex < toIndex)
          toIndex--;
        log(`syncTabsPositionToApiTabs(${windowId}): move ${moveTabIds.join(',')} before ${referenceId} / from = ${fromIndex}, to = ${toIndex}`);
        for (const movedId of moveTabIds) {
          container.internalMovingTabs.add(movedId);
          container.alreadyMovedTabs.add(movedId);
          movedTabs.add(movedId);
          needToBeReindexedTabs.add(movedId);
          const nextId = apiTabIds.find((_id, index) => index > 1 && apiTabIds[index - 1] == movedId);
          if (nextId)
            needToBeReindexedTabs.add(nextId);
        }
        logApiTabs(`tabs-move:syncTabsPositionToApiTabs(${windowId}): browser.tabs.move() `, moveTabIds, {
          windowId,
          index: toIndex
        });
        browser.tabs.move(moveTabIds, {
          windowId,
          index: toIndex
        }).catch(e => {
          log(`syncTabsPositionToApiTabs(${windowId}): failed to move: `, String(e), e.stack);
        });
        apiTabIdsForUpdatedIndices = apiTabIdsForUpdatedIndices.filter(id => !moveTabIds.includes(id));
        apiTabIdsForUpdatedIndices.splice(toIndex, 0, ...moveTabIds);
        break;
    }
  }
  log(`syncTabsPositionToApiTabs(${windowId}): rearrange completed.`);

  const allTabs = container.childNodes;
  const reindexedTabs = new Set();
  if (needToBeReindexedTabs.size > 0) {
    // Fixup "index" of cached apiTab.
    // Tab may be removed while waiting, so we need to isolate tabs before sorting.
    const reindexTabs = Tabs.sort(Array.from(needToBeReindexedTabs, Tabs.getTabById).filter(Tabs.ensureLivingTab));
    if (reindexTabs.length > 0) {
      const first = reindexTabs[0];
      const last = reindexTabs[reindexTabs.length - 1];
      log(`syncTabsPositionToApiTabs(${windowId}): reindex between `, { first: first.apiTab.id, last: last.apiTab.id });
      const lastCorrectIndexTab = Tabs.getPreviousTab(first);
      for (let i = lastCorrectIndexTab ? lastCorrectIndexTab.apiTab.index + 1 : 0, maxi = allTabs.length; i < maxi; i++) {
        const tab = allTabs[i];
        tab.apiTab.index = i;
        reindexedTabs.add(tab);
        if (tab == last)
          break;
      }
    }
  }

  if (movedTabs.size > 0 || needToBeReindexedTabs.size > 0) {
    log(`Tabs rearranged and reindexed by syncTabsPositionToApiTabs(${windowId}):\n`+(!configs.debug ? '' :
      Array.from(allTabs, tab => ' - '+tab.apiTab.index+': '+tab.id+(movedTabs.has(tab.apiTab.id) ? '[MOVED]' : '')+(reindexedTabs.has(tab.apiTab.id) ? '[REINDEXED]' : '')+' '+tab.apiTab.title)
        .join('\n')));

    // tabs.onMoved produced by this operation can break the order of tabs
    // in the sidebar, so we need to synchronize complete order of tabs after
    // all.
    browser.runtime.sendMessage({
      type: Constants.kCOMMAND_SYNC_TABS_ORDER,
      windowId
    });

    // Multiple times asynchronous tab move is unstable, so we retry again
    // for safety until all tabs are completely synchronized.
    syncTabsPositionToApiTabs([{ windowId }]);
  }
}
