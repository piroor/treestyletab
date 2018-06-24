/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as Tree from '../common/tree.js';
import * as MetricsData from '../common/metrics-data.js';
import EventListenerManager from '../common/EventListenerManager.js';

function log(...args) {
  if (configs.logFor['background/tree-structure'])
    internalLogger(...args);
}

export const onTabAttachedFromRestoredInfo = new EventListenerManager();

export function startTracking() {
  Tabs.onCreated.addListener((tab, _info) => { reserveToSaveTreeStructure(tab); });
  Tabs.onRemoved.addListener((tab, _info) => { reserveToSaveTreeStructure(tab); });
  Tabs.onMoved.addListener((tab, _info) => { reserveToSaveTreeStructure(tab); });
  Tabs.onUpdated.addListener((tab, _info) => { reserveToSaveTreeStructure(tab); });
  Tree.onAttached.addListener((tab, _info) => { reserveToSaveTreeStructure(tab); });
  Tree.onDetached.addListener((tab, _info) => { reserveToSaveTreeStructure(tab); });
  Tree.onSubtreeCollapsedStateChanging.addListener(tab => { reserveToSaveTreeStructure(tab); });
}

export function reserveToSaveTreeStructure(hint) {
  const container = Tabs.getTabsContainer(hint);
  if (!container)
    return;

  if (container.waitingToSaveTreeStructure)
    clearTimeout(container.waitingToSaveTreeStructure);
  container.waitingToSaveTreeStructure = setTimeout(windowId => {
    saveTreeStructure(windowId);
  }, 150, parseInt(container.dataset.windowId));
}
async function saveTreeStructure(windowId) {
  const container = Tabs.getTabsContainer(windowId);
  if (!container)
    return;

  const structure = Tree.getTreeStructureFromTabs(Tabs.getAllTabs(windowId));
  browser.sessions.setWindowValue(
    windowId,
    Constants.kWINDOW_STATE_TREE_STRUCTURE,
    structure
  );
}

export async function loadTreeStructure(restoredFromCacheResults) {
  log('loadTreeStructure');
  const windows = await browser.windows.getAll({
    windowTypes: ['normal']
  });
  MetricsData.add('loadTreeStructure: browser.windows.getAll');
  return MetricsData.addAsync('loadTreeStructure: restoration for windows', Promise.all(windows.map(async window => {
    if (restoredFromCacheResults &&
        restoredFromCacheResults[window.id]) {
      log(`skip tree structure restoration for window ${window.id} (restored from cache)`);
      return;
    }
    const tabs = Tabs.getAllTabs(window.id);
    const structure = await browser.sessions.getWindowValue(window.id, Constants.kWINDOW_STATE_TREE_STRUCTURE);
    let uniqueIds = await Tabs.getUniqueIds(tabs.map(tab => tab.apiTab));
    MetricsData.add('loadTreeStructure: read stored data');
    let windowStateCompletelyApplied = false;
    if (structure && structure.length <= tabs.length) {
      uniqueIds = uniqueIds.map(id => id.id);
      let tabsOffset;
      if (structure[0].id) {
        tabsOffset = uniqueIds.join('\n').indexOf(structure.map(item => item.id).join('\n'));
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
      log(`Tree information for the window ${window.id} is not same to actual state. Fallback to restoration from tab relations.`);
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

function reserveToAttachTabFromRestoredInfo(tab, options = {}) {
  if (reserveToAttachTabFromRestoredInfo.waiting)
    clearTimeout(reserveToAttachTabFromRestoredInfo.waiting);
  reserveToAttachTabFromRestoredInfo.tasks.push({ tab: tab, options: options });
  if (!reserveToAttachTabFromRestoredInfo.promisedDone) {
    reserveToAttachTabFromRestoredInfo.promisedDone = new Promise((resolve, _aReject) => {
      reserveToAttachTabFromRestoredInfo.onDone = resolve;
    });
  }
  reserveToAttachTabFromRestoredInfo.waiting = setTimeout(async () => {
    reserveToAttachTabFromRestoredInfo.waiting = null;
    const tasks = reserveToAttachTabFromRestoredInfo.tasks.slice(0);
    reserveToAttachTabFromRestoredInfo.tasks = [];
    const uniqueIds = await Promise.all(tasks.map(task => task.tab.uniqueId));
    const bulk = tasks.length > 1;
    await Promise.all(uniqueIds.map((uniqueId, index) => {
      const task = tasks[index];
      return attachTabFromRestoredInfo(task.tab, Object.assign({}, task.options, {
        uniqueId: uniqueId,
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


async function attachTabFromRestoredInfo(tab, options = {}) {
  log('attachTabFromRestoredInfo ', dumpTab(tab), tab.apiTab);
  browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_NOTIFY_TAB_RESTORING,
    tab:    tab.apiTab.id,
    window: tab.apiTab.windowId
  });
  let uniqueId, insertBefore, insertAfter, ancestors, children, collapsed;
  await Promise.all([
    (async () => {
      uniqueId = options.uniqueId || await tab.uniqueId;
    })(),
    (async () => {
      [insertBefore, insertAfter, ancestors, children, collapsed] = await Promise.all([
        browser.sessions.getTabValue(tab.apiTab.id, Constants.kPERSISTENT_INSERT_BEFORE),
        browser.sessions.getTabValue(tab.apiTab.id, Constants.kPERSISTENT_INSERT_AFTER),
        browser.sessions.getTabValue(tab.apiTab.id, Constants.kPERSISTENT_ANCESTORS),
        browser.sessions.getTabValue(tab.apiTab.id, Constants.kPERSISTENT_CHILDREN),
        browser.sessions.getTabValue(tab.apiTab.id, Constants.kPERSISTENT_SUBTREE_COLLAPSED)
      ]);
      ancestors = ancestors || [];
      children  = children  || [];
    })()
  ]);
  log(`persistent references for ${tab.id} (${uniqueId.id}): `, {
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
  const active = Tabs.isActive(tab);
  for (const ancestor of ancestors) {
    if (!ancestor)
      continue;
    const done = Tree.attachTabTo(tab, ancestor, {
      insertBefore,
      insertAfter,
      dontExpand:  !active,
      forceExpand: active,
      broadcast:   true
    });
    if (!options.bulk)
      await done;
    attached = true;
    break;
  }
  if (!attached) {
    const opener = Tabs.getOpenerTab(tab);
    if (opener &&
        configs.syncParentTabAndOpenerTab) {
      log(' attach to opener: ', { child: dumpTab(tab), parent: dumpTab(opener) });
      const done = Tree.attachTabTo(tab, opener, {
        dontExpand:  !active,
        forceExpand: active,
        broadcast:   true,
        insertAt:    Constants.kINSERT_NEAREST
      });
      if (!options.bulk)
        await done;
    }
    else if (!options.bulk &&
             (Tabs.getNextNormalTab(tab) ||
              Tabs.getPreviousNormalTab(tab))) {
      log(' attach from position');
      onTabAttachedFromRestoredInfo.dispatch(tab, {
        toIndex:   tab.apiTab.index,
        fromIndex: Tabs.getTabIndex(Tabs.getLastTab(tab))
      });
    }
  }
  if (!options.keepCurrentTree &&
      // the restored tab is a roo tab
      ancestors.length == 0 &&
      // but attached to any parent based on its restored position
      Tabs.getParentTab(tab) &&
      // when not in-middle position of existing tree (safely detachable position)
      !Tabs.getNextSiblingTab(tab)) {
    Tree.detachTab(tab, {
      broadcast: true
    });
  }
  if (options.children && !options.bulk) {
    for (const child of children) {
      if (!child)
        continue;
      await Tree.attachTabTo(child, tab, {
        dontExpand:  !Tabs.isActive(child),
        forceExpand: active,
        insertAt:    Constants.kINSERT_NEAREST,
        broadcast:   true
      });
    }
  }

  if (options.canCollapse || options.bulk) {
    Tree.collapseExpandSubtree(tab, {
      broadcast: true,
      collapsed
    });
  }
  browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_NOTIFY_TAB_RESTORED,
    tab:    tab.apiTab.id,
    window: tab.apiTab.windowId
  });
}


Tabs.onRestored.addListener(tab => {
  log('onTabRestored ', dumpTab(tab), tab.apiTab);
  reserveToAttachTabFromRestoredInfo(tab, {
    children: true
  });
});
