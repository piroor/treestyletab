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
  const apiTabIds = tabs.map(tab => tab.apiTab.id);
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

      if (!options.broadcasted) {
        if (options.delayedMove) // Wait until opening animation is finished.
          await wait(configs.newTabAnimationDuration);
        moveApiTabsBefore(apiTabIds, referenceTab.apiTab.id);
      }
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
  const apiTabIds = tabs.map(tab => tab.apiTab.id);
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

      if (!options.broadcasted) {
        if (options.delayedMove) // Wait until opening animation is finished.
          await wait(configs.newTabAnimationDuration);
        moveApiTabsAfter(apiTabIds, referenceTab.apiTab.id);
      }
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


let mMovingApiTabsCount = 0;

async function moveApiTabsBefore(apiTabIds, referenceApiTabId) {
  while (mMovingApiTabsCount > 0) {
    await wait(10);
  }
  mMovingApiTabsCount++;
  try {
    const indexes   = await ApiTabs.getIndexes(referenceApiTabId, apiTabIds[0]);
    let   toIndex   = indexes[0];
    const fromIndex = indexes[1];
    if (fromIndex < toIndex)
      toIndex--;
    await browser.tabs.move(apiTabIds, {
      windowId: apiTabIds[0].windowId,
      index:    toIndex
    }).catch(ApiTabs.handleMissingTabError);
  }
  catch(_e) {
  }
  mMovingApiTabsCount--;
}

async function moveApiTabsAfter(apiTabIds, referenceApiTabId) {
  while (mMovingApiTabsCount > 0) {
    await wait(10);
  }
  mMovingApiTabsCount++;
  try {
    const indexes   = await ApiTabs.getIndexes(referenceApiTabId, apiTabIds[0]);
    let   toIndex   = indexes[0];
    const fromIndex = indexes[1];
    if (fromIndex > toIndex)
      toIndex++;
    await browser.tabs.move(apiTabIds, {
      windowId: apiTabIds[0].windowId,
      index:    toIndex
    }).catch(ApiTabs.handleMissingTabError);
  }
  catch(_e) {
  }
  mMovingApiTabsCount--;
}
