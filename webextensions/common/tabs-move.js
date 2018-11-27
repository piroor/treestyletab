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
import * as TabsContainer from './tabs-container.js';

function log(...args) {
  internalLogger('common/tabs-move', ...args);
}

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

  const container = tabs[0].parentNode;
  try {
    /*
      Tab elements are moved by tabs.onMoved automatically, but
      the operation is asynchronous. To help synchronous operations
      following to this operation, we need to move tabs immediately.
    */
    const oldIndexes = [referenceTab].concat(tabs).map(Tabs.getTabIndex);
    for (const tab of tabs) {
      const oldPreviousTab = Tabs.getPreviousTab(tab);
      const oldNextTab     = Tabs.getNextTab(tab);
      if (oldNextTab == referenceTab) // no move case
        continue;
      TabsContainer.incrementCounter(container, 'internalMovingCount');
      TabsContainer.incrementCounter(container, 'alreadyMovedTabsCount');
      container.insertBefore(tab, referenceTab);
      Tabs.onTabElementMoved.dispatch(tab, {
        oldPreviousTab,
        oldNextTab
      });
    }
    syncOrderOfChildTabs(tabs.map(Tabs.getParentTab));
    if (parseInt(container.dataset.alreadyMovedTabsCount) <= 0) {
      log(' => actually nothing moved');
    }
    else {
      log('Tab nodes rearranged by moveTabsInternallyBefore:\n'+(!configs.debug ? '' :
        Array.slice(container.childNodes)
          .map(tab => tab.id+(tabs.includes(tab) ? '[MOVED]' : ''))
          .join('\n')
          .replace(/^/gm, ' - ')));
      const newIndexes = [referenceTab].concat(tabs).map(Tabs.getTabIndex);
      const minIndex = Math.min(...oldIndexes, ...newIndexes);
      const maxIndex = Math.max(...oldIndexes, ...newIndexes);
      for (let i = minIndex, allTabs = Tabs.getAllTabs(container); i <= maxIndex; i++) {
        const tab = allTabs[i];
        if (!tab)
          continue;
        tab.apiTab.index = i;
      }
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
        index: Tabs.getTabIndex(tab),
        tab:   tab
      };
    }).sort((aA, aB) => aA.index - aB.index).map(item => item.tab);
    const childIds = parent.childTabs.map(tab => tab.id);
    parent.setAttribute(Constants.kCHILDREN, `|${childIds.join('|')}|`);
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

  const container = tabs[0].parentNode;
  try {
    /*
      Tab elements are moved by tabs.onMoved automatically, but
      the operation is asynchronous. To help synchronous operations
      following to this operation, we need to move tabs immediately.
    */
    const oldIndexes = [referenceTab].concat(tabs).map(Tabs.getTabIndex);
    let nextTab = Tabs.getNextTab(referenceTab);
    if (tabs.includes(nextTab))
      nextTab = null;
    for (const tab of tabs) {
      const oldPreviousTab = Tabs.getPreviousTab(tab);
      const oldNextTab     = Tabs.getNextTab(tab);
      if (oldNextTab == nextTab) // no move case
        continue;
      TabsContainer.incrementCounter(container, 'internalMovingCount');
      TabsContainer.incrementCounter(container, 'alreadyMovedTabsCount');
      container.insertBefore(tab, nextTab);
      Tabs.onTabElementMoved.dispatch(tab, {
        oldPreviousTab,
        oldNextTab
      });
    }
    syncOrderOfChildTabs(tabs.map(Tabs.getParentTab));
    if (parseInt(container.dataset.alreadyMovedTabsCount) <= 0) {
      log(' => actually nothing moved');
    }
    else {
      log('Tab nodes rearranged by moveTabsInternallyAfter:\n'+(!configs.debug ? '' :
        Array.slice(container.childNodes)
          .map(tab => tab.id+(tabs.includes(tab) ? '[MOVED]' : ''))
          .join('\n')
          .replace(/^/gm, ' - ')));
      const newIndexes = [referenceTab].concat(tabs).map(Tabs.getTabIndex);
      const minIndex = Math.min(...oldIndexes, ...newIndexes);
      const maxIndex = Math.max(...oldIndexes, ...newIndexes);
      for (let i = minIndex, allTabs = Tabs.getAllTabs(container); i <= maxIndex; i++) {
        const tab = allTabs[i];
        if (!tab)
          continue;
        tab.apiTab.index = i;
      }
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

function syncTabsPositionToApiTabs(apiTabs) {
  syncTabsPositionToApiTabsInternal.movedApiTabs = syncTabsPositionToApiTabsInternal.movedApiTabs.concat(apiTabs);
  if (syncTabsPositionToApiTabsInternal.delayed)
    clearTimeout(syncTabsPositionToApiTabsInternal.delayed);
  syncTabsPositionToApiTabsInternal.delayed = setTimeout(() => {
    if (syncTabsPositionToApiTabsInternal.previousRun)
      syncTabsPositionToApiTabsInternal.previousRun = syncTabsPositionToApiTabsInternal.previousRun.then(syncTabsPositionToApiTabsInternal);
    else
      syncTabsPositionToApiTabsInternal.previousRun = syncTabsPositionToApiTabsInternal();
  }, 100);
}
async function syncTabsPositionToApiTabsInternal() {
  delete syncTabsPositionToApiTabsInternal.delayed;

  const movedApiTabs = syncTabsPositionToApiTabsInternal.movedApiTabs;
  syncTabsPositionToApiTabsInternal.movedApiTabs = [];

  const uniqueApiTabs       = new Map();
  const toBeMovedTabsCounts = new Map();
  const movedTabsCounts     = new Map();
  for (const apiTab of movedApiTabs) {
    uniqueApiTabs.set(apiTab.id, apiTab);
    const count = toBeMovedTabsCounts.get(apiTab.windowId) || 0;
    toBeMovedTabsCounts.set(apiTab.windowId, count + 1);
  }
  const tabs    = Array.from(uniqueApiTabs.values()).map(Tabs.getTabById);
  const apiTabs = tabs.sort(documentPositionComparator).map(tab => tab.apiTab);
  log('syncTabsPositionToApiTabsInternal: rearrange ', apiTabs.map(apiTab => apiTab.id));
  const movedLogs = [];
  for (const apiTab of apiTabs) {
    if (Tabs.hasCreatingTab())
      await Tabs.waitUntilAllTabsAreCreated();
    if (Tabs.hasMovingTab())
      await Tabs.waitUntilAllTabsAreMoved();
    try {
      const tab         = Tabs.getTabById(apiTab.id);
      const previousTab = Tabs.getPreviousTab(tab);
      const nextTab     = Tabs.getNextTab(tab);
      let fromIndex     = -1;
      let toIndex       = -1;
      let movedInfo;
      if (previousTab) {
        [ fromIndex, toIndex ] = await ApiTabs.getIndexes(apiTab.id, previousTab.apiTab.id);
        if (fromIndex > toIndex)
          toIndex++;
        movedInfo = ` (after tab ${previousTab.apiTab.id})`;
      }
      else if (nextTab) {
        [ fromIndex, toIndex ] = await ApiTabs.getIndexes(apiTab.id, nextTab.apiTab.id);
        if (fromIndex < toIndex)
          toIndex--;
        movedInfo = ` (before tab ${nextTab.apiTab.id})`;
      }
      if (fromIndex != toIndex && toIndex > -1) {
        const count = movedTabsCounts.get(apiTab.windowId) || 0;
        movedTabsCounts.set(apiTab.windowId, count + 1);
        await browser.tabs.move(apiTab.id, {
          windowId: apiTab.windowId,
          index:    toIndex
        }).catch(ApiTabs.handleMissingTabError);
        movedLogs.push(`tab ${apiTab.id}, from ${fromIndex} to ${toIndex}${movedInfo}`);
      }
    }
    catch(e) {
      log('syncTabsPositionToApiTabsInternal: fatal error: ', e);
    }
  }
  log('syncTabsPositionToApiTabsInternal: moved ', movedLogs);
  for (const windowId of toBeMovedTabsCounts.keys()) {
    const toBeMovedCount = toBeMovedTabsCounts.get(windowId) || 0;
    const movedCount     = movedTabsCounts.get(windowId) || 0;
    const delta          = toBeMovedCount - movedCount;
    if (delta > 0) {
      const container = Tabs.getTabsContainer(windowId);
      TabsContainer.decrementCounter(container, 'internalMovingCount', delta);
      TabsContainer.decrementCounter(container, 'alreadyMovedTabsCount', delta);
    }
  }
}
syncTabsPositionToApiTabsInternal.movedApiTabs = [];

function documentPositionComparator(a, b) {
  if (a === b)
    return 0;

  const position = a.compareDocumentPosition(b);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING)
    return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING)
    return 1;

  return 0;
}
