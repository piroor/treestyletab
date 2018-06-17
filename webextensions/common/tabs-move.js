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
  log,
  wait,
  dumpTab,
  configs
} from './common.js';

import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as Tabs from './tabs.js';
import * as TabsContainer from './tabs-container.js';

export async function moveTabsBefore(aTabs, aReferenceTab, aOptions = {}) {
  log('moveTabsBefore: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (!aTabs.length ||
      !Tabs.ensureLivingTab(aReferenceTab))
    return [];

  if (Tabs.isAllTabsPlacedBefore(aTabs, aReferenceTab)) {
    log('moveTabsBefore:no need to move');
    return [];
  }
  return moveTabsInternallyBefore(aTabs, aReferenceTab, aOptions);
}
export async function moveTabBefore(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsBefore([aTab], aReferenceTab, aOptions);
}

async function moveTabsInternallyBefore(aTabs, aReferenceTab, aOptions = {}) {
  if (!aTabs.length ||
      !Tabs.ensureLivingTab(aReferenceTab))
    return [];

  log('moveTabsInternallyBefore: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (aOptions.inRemote || aOptions.broadcast) {
    const message = {
      type:     Constants.kCOMMAND_MOVE_TABS_BEFORE,
      windowId: aTabs[0].apiTab.windowId,
      tabs:     aTabs.map(aTab => aTab.id),
      nextTab:  aReferenceTab.id,
      broadcasted: !!aOptions.broadcast
    };
    if (aOptions.inRemote) {
      const tabIds = await browser.runtime.sendMessage(message);
      return tabIds.map(Tabs.getTabById);
    }
    else {
      browser.runtime.sendMessage(message);
    }
  }

  const container = aTabs[0].parentNode;
  const apiTabIds = aTabs.map(aTab => aTab.apiTab.id);
  try {
    /*
      Tab elements are moved by tabs.onMoved automatically, but
      the operation is asynchronous. To help synchronous operations
      following to this operation, we need to move tabs immediately.
    */
    const oldIndexes = [aReferenceTab].concat(aTabs).map(Tabs.getTabIndex);
    for (const tab of aTabs) {
      const oldPreviousTab = Tabs.getPreviousTab(tab);
      const oldNextTab     = Tabs.getNextTab(tab);
      if (oldNextTab == aReferenceTab) // no move case
        continue;
      TabsContainer.incrementCounter(container, 'internalMovingCount');
      TabsContainer.incrementCounter(container, 'alreadyMovedTabsCount');
      container.insertBefore(tab, aReferenceTab);
      Tabs.onTabElementMoved.dispatch(tab, {
        oldPreviousTab,
        oldNextTab
      });
    }
    syncOrderOfChildTabs(aTabs.map(Tabs.getParentTab));
    if (parseInt(container.dataset.alreadyMovedTabsCount) <= 0) {
      log(' => actually nothing moved');
    }
    else {
      log('Tab nodes rearranged by moveTabsInternallyBefore:\n'+(!configs.debug ? '' :
        Array.slice(container.childNodes)
          .map(aTab => aTab.id+(aTabs.includes(aTab) ? '[MOVED]' : ''))
          .join('\n')
          .replace(/^/gm, ' - ')));
      const newIndexes = [aReferenceTab].concat(aTabs).map(Tabs.getTabIndex);
      const minIndex = Math.min(...oldIndexes, ...newIndexes);
      const maxIndex = Math.max(...oldIndexes, ...newIndexes);
      for (let i = minIndex, allTabs = Tabs.getAllTabs(container); i <= maxIndex; i++) {
        const tab = allTabs[i];
        if (!tab)
          continue;
        tab.apiTab.index = i;
      }

      if (!aOptions.broadcasted) {
        if (aOptions.delayedMove) // Wait until opening animation is finished.
          await wait(configs.newTabAnimationDuration);
        const indexes   = await ApiTabs.getIndexes(aReferenceTab.apiTab.id, apiTabIds[0]);
        let   toIndex   = indexes[0];
        const fromIndex = indexes[1];
        if (fromIndex < toIndex)
          toIndex--;
        browser.tabs.move(apiTabIds, {
          windowId: parseInt(container.dataset.windowId),
          index:    toIndex
        }).catch(ApiTabs.handleMissingTabError);
      }
    }
  }
  catch(e) {
    ApiTabs.handleMissingTabError(e);
    log('moveTabsInternallyBefore failed: ', String(e));
  }
  return aTabs;
}
export async function moveTabInternallyBefore(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsInternallyBefore([aTab], aReferenceTab, aOptions);
}

function syncOrderOfChildTabs(aParentTabs) {
  if (!Array.isArray(aParentTabs))
    aParentTabs = [aParentTabs];

  let updatedParentTabs = new Map();
  for (const parent of aParentTabs) {
    if (!parent || updatedParentTabs.has(parent))
      continue;
    updatedParentTabs.set(parent, true);
    if (parent.childTabs.length < 2)
      continue;
    parent.childTabs = parent.childTabs.map(aTab => {
      return {
        index: Tabs.getTabIndex(aTab),
        tab:   aTab
      };
    }).sort((aA, aB) => aA.index - aB.index).map(aItem => aItem.tab);
    const childIds = parent.childTabs.map(aTab => aTab.id);
    parent.setAttribute(Constants.kCHILDREN, `|${childIds.join('|')}|`);
    log('updateChildTabsInfo: ', childIds);
  }
  updatedParentTabs = undefined;
}

export async function moveTabsAfter(aTabs, aReferenceTab, aOptions = {}) {
  log('moveTabsAfter: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (!aTabs.length ||
      !Tabs.ensureLivingTab(aReferenceTab))
    return [];

  if (Tabs.isAllTabsPlacedAfter(aTabs, aReferenceTab)) {
    log('moveTabsAfter:no need to move');
    return [];
  }
  return moveTabsInternallyAfter(aTabs, aReferenceTab, aOptions);
}
export async function moveTabAfter(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsAfter([aTab], aReferenceTab, aOptions);
}

async function moveTabsInternallyAfter(aTabs, aReferenceTab, aOptions = {}) {
  if (!aTabs.length ||
      !Tabs.ensureLivingTab(aReferenceTab))
    return [];

  log('moveTabsInternallyAfter: ', aTabs.map(dumpTab), dumpTab(aReferenceTab), aOptions);
  if (aOptions.inRemote || aOptions.broadcast) {
    const message = {
      type:        Constants.kCOMMAND_MOVE_TABS_AFTER,
      windowId:    aTabs[0].apiTab.windowId,
      tabs:        aTabs.map(aTab => aTab.id),
      previousTab: aReferenceTab.id,
      broadcasted: !!aOptions.broadcast
    };
    if (aOptions.inRemote) {
      const tabIds = await browser.runtime.sendMessage(message);
      return tabIds.map(Tabs.getTabById);
    }
    else {
      browser.runtime.sendMessage(message);
    }
  }

  const container = aTabs[0].parentNode;
  const apiTabIds = aTabs.map(aTab => aTab.apiTab.id);
  try {
    /*
      Tab elements are moved by tabs.onMoved automatically, but
      the operation is asynchronous. To help synchronous operations
      following to this operation, we need to move tabs immediately.
    */
    const oldIndexes = [aReferenceTab].concat(aTabs).map(Tabs.getTabIndex);
    let nextTab = Tabs.getNextTab(aReferenceTab);
    if (aTabs.includes(nextTab))
      nextTab = null;
    for (const tab of aTabs) {
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
    syncOrderOfChildTabs(aTabs.map(Tabs.getParentTab));
    if (parseInt(container.dataset.alreadyMovedTabsCount) <= 0) {
      log(' => actually nothing moved');
    }
    else {
      log('Tab nodes rearranged by moveTabsInternallyAfter:\n'+(!configs.debug ? '' :
        Array.slice(container.childNodes)
          .map(aTab => aTab.id+(aTabs.includes(aTab) ? '[MOVED]' : ''))
          .join('\n')
          .replace(/^/gm, ' - ')));
      const newIndexes = [aReferenceTab].concat(aTabs).map(Tabs.getTabIndex);
      const minIndex = Math.min(...oldIndexes, ...newIndexes);
      const maxIndex = Math.max(...oldIndexes, ...newIndexes);
      for (let i = minIndex, allTabs = Tabs.getAllTabs(container); i <= maxIndex; i++) {
        const tab = allTabs[i];
        if (!tab)
          continue;
        tab.apiTab.index = i;
      }

      if (!aOptions.broadcasted) {
        if (aOptions.delayedMove) // Wait until opening animation is finished.
          await wait(configs.newTabAnimationDuration);
        const indexes   = await ApiTabs.getIndexes(aReferenceTab.apiTab.id, apiTabIds[0]);
        let   toIndex   = indexes[0];
        const fromIndex = indexes[1];
        if (fromIndex > toIndex)
          toIndex++;
        browser.tabs.move(apiTabIds, {
          windowId: parseInt(container.dataset.windowId),
          index:    toIndex
        }).catch(ApiTabs.handleMissingTabError);
      }
    }
  }
  catch(e) {
    ApiTabs.handleMissingTabError(e);
    log('moveTabsInternallyAfter failed: ', String(e));
  }
  return aTabs;
}
export async function moveTabInternallyAfter(aTab, aReferenceTab, aOptions = {}) {
  return moveTabsInternallyAfter([aTab], aReferenceTab, aOptions);
}

