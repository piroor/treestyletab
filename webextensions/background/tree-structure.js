/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  dumpTab,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as Tree from '../common/tree.js';
import * as MetricsData from '../common/metrics-data.js';
import EventListenerManager from '../common/EventListenerManager.js';

export const onTabAttachedFromRestoredInfo = new EventListenerManager();

export function reserveToSaveTreeStructure(aHint) {
  const container = Tabs.getTabsContainer(aHint);
  if (!container)
    return;

  if (container.waitingToSaveTreeStructure)
    clearTimeout(container.waitingToSaveTreeStructure);
  container.waitingToSaveTreeStructure = setTimeout(aWindowId => {
    saveTreeStructure(aWindowId);
  }, 150, parseInt(container.dataset.windowId));
}
async function saveTreeStructure(aWindowId) {
  const container = Tabs.getTabsContainer(aWindowId);
  if (!container)
    return;

  const structure = Tree.getTreeStructureFromTabs(Tabs.getAllTabs(aWindowId));
  browser.sessions.setWindowValue(
    aWindowId,
    Constants.kWINDOW_STATE_TREE_STRUCTURE,
    structure
  );
}

export async function loadTreeStructure(aRestoredFromCacheResults) {
  log('loadTreeStructure');
  const windows = await browser.windows.getAll({
    windowTypes: ['normal']
  });
  MetricsData.add('loadTreeStructure: browser.windows.getAll');
  return MetricsData.addAsync('loadTreeStructure: restoration for windows', Promise.all(windows.map(async aWindow => {
    if (aRestoredFromCacheResults &&
        aRestoredFromCacheResults[aWindow.id]) {
      log(`skip tree structure restoration for window ${aWindow.id} (restored from cache)`);
      return;
    }
    const tabs = Tabs.getAllTabs(aWindow.id);
    const structure = await browser.sessions.getWindowValue(aWindow.id, Constants.kWINDOW_STATE_TREE_STRUCTURE);
    let uniqueIds = await Tabs.getUniqueIds(tabs.map(aTab => aTab.apiTab));
    MetricsData.add('loadTreeStructure: read stored data');
    let windowStateCompletelyApplied = false;
    if (structure && structure.length <= tabs.length) {
      uniqueIds = uniqueIds.map(aId => aId.id);
      let tabsOffset;
      if (structure[0].id) {
        tabsOffset = uniqueIds.join('\n').indexOf(structure.map(aItem => aItem.id).join('\n'));
        windowStateCompletelyApplied = tabsOffset > -1;
      }
      else {
        tabsOffset = 0;
        windowStateCompletelyApplied = structure.length == tabs.length;
      }
      if (tabsOffset > -1) {
        await Tree.applyTreeStructureToTabs(tabs.slice(tabsOffset), structure);
        MetricsData.add('loadTreeStructure: Tree.applyTreeStructureToTabs');
      }
    }
    if (!windowStateCompletelyApplied) {
      log(`Tree information for the window ${aWindow.id} is not same to actual state. Fallback to restoration from tab relations.`);
      for (const tab of tabs) {
        reserveToAttachTabFromRestoredInfo(tab, {
          keepCurrentTree: true,
          canCollapse:     true
        });
      }
      await reserveToAttachTabFromRestoredInfo.promisedDone;
      MetricsData.add('loadTreeStructure: attachTabFromRestoredInfo');
    }
    Tabs.dumpAllTabs();
  })));
}

export function reserveToAttachTabFromRestoredInfo(aTab, aOptions = {}) {
  if (reserveToAttachTabFromRestoredInfo.waiting)
    clearTimeout(reserveToAttachTabFromRestoredInfo.waiting);
  reserveToAttachTabFromRestoredInfo.tasks.push({ tab: aTab, options: aOptions });
  if (!reserveToAttachTabFromRestoredInfo.promisedDone) {
    reserveToAttachTabFromRestoredInfo.promisedDone = new Promise((aResolve, _aReject) => {
      reserveToAttachTabFromRestoredInfo.onDone = aResolve;
    });
  }
  reserveToAttachTabFromRestoredInfo.waiting = setTimeout(async () => {
    reserveToAttachTabFromRestoredInfo.waiting = null;
    const tasks = reserveToAttachTabFromRestoredInfo.tasks.slice(0);
    reserveToAttachTabFromRestoredInfo.tasks = [];
    const uniqueIds = await Promise.all(tasks.map(aTask => aTask.tab.uniqueId));
    const bulk = tasks.length > 1;
    await Promise.all(uniqueIds.map((aUniqueId, aIndex) => {
      const task = tasks[aIndex];
      return attachTabFromRestoredInfo(task.tab, Object.assign({}, task.options, {
        uniqueId: aUniqueId,
        bulk
      }));
    }));
    reserveToAttachTabFromRestoredInfo.onDone();
    delete reserveToAttachTabFromRestoredInfo.onDone;
    delete reserveToAttachTabFromRestoredInfo.promisedDone;
    Tabs.dumpAllTabs();
  }, 100);
}
reserveToAttachTabFromRestoredInfo.waiting = null;
reserveToAttachTabFromRestoredInfo.tasks   = [];
reserveToAttachTabFromRestoredInfo.promisedDone = null;


async function attachTabFromRestoredInfo(aTab, aOptions = {}) {
  log('attachTabFromRestoredInfo ', dumpTab(aTab), aTab.apiTab);
  browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_NOTIFY_TAB_RESTORING,
    tab:    aTab.apiTab.id,
    window: aTab.apiTab.windowId
  });
  let uniqueId, insertBefore, insertAfter, ancestors, children, collapsed;
  await Promise.all([
    async () => {
      uniqueId = aOptions.uniqueId || await aTab.uniqueId;
    },
    async () => {
      [insertBefore, insertAfter, ancestors, children, collapsed] = await Promise.all([
        browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_INSERT_BEFORE),
        browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_INSERT_AFTER),
        browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_ANCESTORS),
        browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_CHILDREN),
        browser.sessions.getTabValue(aTab.apiTab.id, Constants.kPERSISTENT_SUBTREE_COLLAPSED)
      ]);
      ancestors = ancestors || [];
      children  = children  || [];
    },
  ]);
  log(`persistent references for ${aTab.id} (${uniqueId.id}): `, {
    insertBefore, insertAfter,
    ancestors: ancestors.join(', '),
    children:  children.join(', '),
    collapsed
  });
  insertBefore = Tabs.getTabByUniqueId(insertBefore);
  insertAfter  = Tabs.getTabByUniqueId(insertAfter);
  ancestors    = ancestors.map(Tabs.getTabByUniqueId);
  children     = children.map(Tabs.getTabByUniqueId);
  log(' => references: ', {
    insertBefore: dumpTab(insertBefore),
    insertAfter:  dumpTab(insertAfter),
    ancestors:    ancestors.map(dumpTab).join(', '),
    children:     children.map(dumpTab).join(', ')
  });
  let attached = false;
  const active = Tabs.isActive(aTab);
  for (const ancestor of ancestors) {
    if (!ancestor)
      continue;
    const done = Tree.attachTabTo(aTab, ancestor, {
      insertBefore,
      insertAfter,
      dontExpand:  !active,
      forceExpand: active,
      broadcast:   true
    });
    if (!aOptions.bulk)
      await done;
    attached = true;
    break;
  }
  if (!attached) {
    const opener = Tabs.getOpenerTab(aTab);
    if (opener &&
        configs.syncParentTabAndOpenerTab) {
      log(' attach to opener: ', { child: dumpTab(aTab), parent: dumpTab(opener) });
      const done = Tree.attachTabTo(aTab, opener, {
        dontExpand:  !active,
        forceExpand: active,
        broadcast:   true,
        insertAt:    Constants.kINSERT_NEAREST
      });
      if (!aOptions.bulk)
        await done;
    }
    else if (!aOptions.bulk &&
             (Tabs.getNextNormalTab(aTab) ||
              Tabs.getPreviousNormalTab(aTab))) {
      log(' attach from position');
      onTabAttachedFromRestoredInfo.dispatch(aTab, {
        toIndex:   aTab.apiTab.index,
        fromIndex: Tabs.getTabIndex(Tabs.getLastTab(aTab))
      });
    }
  }
  if (!aOptions.keepCurrentTree &&
      // the restored tab is a roo tab
      ancestors.length == 0 &&
      // but attached to any parent based on its restored position
      Tabs.getParentTab(aTab) &&
      // when not in-middle position of existing tree (safely detachable position)
      !Tabs.getNextSiblingTab(aTab)) {
    Tree.detachTab(aTab, {
      broadcast: true
    });
  }
  if (aOptions.children && !aOptions.bulk) {
    for (const child of children) {
      if (!child)
        continue;
      await Tree.attachTabTo(child, aTab, {
        dontExpand:  !Tabs.isActive(child),
        forceExpand: active,
        insertAt:    Constants.kINSERT_NEAREST,
        broadcast:   true
      });
    }
  }

  if (aOptions.canCollapse || aOptions.bulk) {
    Tree.collapseExpandSubtree(aTab, {
      broadcast: true,
      collapsed
    });
  }
  browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_NOTIFY_TAB_RESTORED,
    tab:    aTab.apiTab.id,
    window: aTab.apiTab.windowId
  });
}
