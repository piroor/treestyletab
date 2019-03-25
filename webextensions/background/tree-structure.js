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
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as Sidebar from '/common/sidebar.js';
import * as Tree from '/common/tree.js';
import * as MetricsData from '/common/metrics-data.js';

import Tab from '/common/Tab.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('background/tree-structure', ...args);
}

export const onTabAttachedFromRestoredInfo = new EventListenerManager();

export function startTracking() {
  Tab.onCreated.addListener((tab, _info) => { reserveToSaveTreeStructure(tab.windowId); });
  Tab.onRemoved.addListener((tab, info) => {
    if (!info.isWindowClosing)
      reserveToSaveTreeStructure(tab.windowId);
  });
  Tab.onMoved.addListener((tab, _info) => { reserveToSaveTreeStructure(tab.windowId); });
  Tab.onUpdated.addListener((tab, info) => {
    if ('openerTabId' in info)
      reserveToSaveTreeStructure(tab.windowId);
  });
  Tree.onAttached.addListener((tab, _info) => { reserveToSaveTreeStructure(tab.windowId); });
  Tree.onDetached.addListener((tab, _info) => { reserveToSaveTreeStructure(tab.windowId); });
  Tree.onSubtreeCollapsedStateChanging.addListener(tab => { reserveToSaveTreeStructure(tab.windowId); });
}

export function reserveToSaveTreeStructure(windowId) {
  const window = TabsStore.windows.get(windowId);
  if (!window)
    return;

  if (window.waitingToSaveTreeStructure)
    clearTimeout(window.waitingToSaveTreeStructure);
  window.waitingToSaveTreeStructure = setTimeout(() => {
    saveTreeStructure(windowId);
  }, 150);
}
async function saveTreeStructure(windowId) {
  const window = TabsStore.windows.get(windowId);
  if (!window)
    return;

  const structure = Tree.getTreeStructureFromTabs(Tab.getAllTabs(windowId));
  browser.sessions.setWindowValue(
    windowId,
    Constants.kWINDOW_STATE_TREE_STRUCTURE,
    structure
  ).catch(ApiTabs.createErrorSuppressor());
}

export async function loadTreeStructure(windows, restoredFromCacheResults) {
  log('loadTreeStructure');
  MetricsData.add('loadTreeStructure: start');
  return MetricsData.addAsync('loadTreeStructure: restoration for windows', Promise.all(windows.map(async window => {
    if (restoredFromCacheResults &&
        restoredFromCacheResults[window.id]) {
      log(`skip tree structure restoration for window ${window.id} (restored from cache)`);
      return;
    }
    const tabs = Tab.getAllTabs(window.id);
    const structure = await browser.sessions.getWindowValue(window.id, Constants.kWINDOW_STATE_TREE_STRUCTURE).catch(ApiTabs.createErrorHandler());
    let uniqueIds = tabs.map(tab => tab.$TST.uniqueId && tab.$TST.uniqueId || '?');
    MetricsData.add('loadTreeStructure: read stored data');
    let windowStateCompletelyApplied = false;
    if (structure &&
        structure.length > 0 &&
        structure.length <= tabs.length) {
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
    Tab.dumpAll();
  })));
}

async function reserveToAttachTabFromRestoredInfo(tab, options = {}) {
  if (reserveToAttachTabFromRestoredInfo.waiting)
    clearTimeout(reserveToAttachTabFromRestoredInfo.waiting);
  reserveToAttachTabFromRestoredInfo.tasks.push({ tab, options: options });
  if (!reserveToAttachTabFromRestoredInfo.promisedDone) {
    reserveToAttachTabFromRestoredInfo.promisedDone = new Promise((resolve, _aReject) => {
      reserveToAttachTabFromRestoredInfo.onDone = resolve;
    });
  }
  reserveToAttachTabFromRestoredInfo.waiting = setTimeout(async () => {
    reserveToAttachTabFromRestoredInfo.waiting = null;
    const tasks = reserveToAttachTabFromRestoredInfo.tasks.slice(0);
    reserveToAttachTabFromRestoredInfo.tasks = [];
    const uniqueIds = tasks.map(task => task.tab.$TST.uniqueId);
    const bulk = tasks.length > 1;
    await Promise.all(uniqueIds.map((uniqueId, index) => {
      const task = tasks[index];
      return attachTabFromRestoredInfo(task.tab, Object.assign({}, task.options, {
        uniqueId,
        bulk
      }));
    }));
    reserveToAttachTabFromRestoredInfo.onDone();
    delete reserveToAttachTabFromRestoredInfo.onDone;
    delete reserveToAttachTabFromRestoredInfo.promisedDone;
    Tab.dumpAll();
  }, 100);
  return reserveToAttachTabFromRestoredInfo.promisedDone;
}
reserveToAttachTabFromRestoredInfo.waiting = null;
reserveToAttachTabFromRestoredInfo.tasks   = [];
reserveToAttachTabFromRestoredInfo.promisedDone = null;


async function attachTabFromRestoredInfo(tab, options = {}) {
  log('attachTabFromRestoredInfo ', tab);
  let uniqueId, insertBefore, insertAfter, ancestors, children, states, collapsed /* for backward compatibility */;
  // eslint-disable-next-line prefer-const
  [uniqueId, insertBefore, insertAfter, ancestors, children, states, collapsed] = await Promise.all([
    options.uniqueId || tab.$TST.uniqueId || tab.$TST.promisedUniqueId,
    browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_INSERT_BEFORE).catch(ApiTabs.createErrorHandler()),
    browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_INSERT_AFTER).catch(ApiTabs.createErrorHandler()),
    browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_ANCESTORS).catch(ApiTabs.createErrorHandler()),
    browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_CHILDREN).catch(ApiTabs.createErrorHandler()),
    tab.$TST.getPermanentStates(),
    browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_SUBTREE_COLLAPSED).catch(ApiTabs.createErrorHandler()) // for backward compatibility
  ]);
  ancestors = ancestors || [];
  children  = children  || [];
  log(`persistent references for ${dumpTab(tab)} (${uniqueId.id}): `, {
    insertBefore, insertAfter,
    ancestors: ancestors.join(', '),
    children:  children.join(', '),
    states,
    collapsed
  });
  if (collapsed && !states.includes(Constants.kTAB_STATE_SUBTREE_COLLAPSED)) {
    // migration
    states.push(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
    browser.sessions.removeTabValue(tab.id, Constants.kPERSISTENT_SUBTREE_COLLAPSED).catch(ApiTabs.createErrorSuppressor());
  }
  insertBefore = Tab.getByUniqueId(insertBefore);
  insertAfter  = Tab.getByUniqueId(insertAfter);
  ancestors    = ancestors.map(Tab.getByUniqueId);
  children     = children.map(Tab.getByUniqueId);
  log(' => references: ', {
    insertBefore: dumpTab(insertBefore),
    insertAfter:  dumpTab(insertAfter),
    ancestors:    ancestors.map(dumpTab).join(', '),
    children:     children.map(dumpTab).join(', ')
  });

  // clear wrong positioning information
  if (tab.pinned ||
      (insertBefore && insertBefore.pinned))
    insertBefore = null;
  const nextOfInsertAfter = insertAfter && insertAfter.$TST.nextTab;
  if (nextOfInsertAfter &&
      nextOfInsertAfter.pinned)
    insertAfter = null;

  let attached = false;
  const active = tab.active;
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
    const opener = tab.$TST.openerTab;
    if (opener &&
        configs.syncParentTabAndOpenerTab) {
      log(' attach to opener: ', { child: tab, parent: opener });
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
             (tab.$TST.nearestNormalFollowingTab ||
              tab.$TST.nearestNormalPrecedingTab)) {
      log(' attach from position');
      onTabAttachedFromRestoredInfo.dispatch(tab, {
        toIndex:   tab.index,
        fromIndex: Tab.getLastTab(tab.windowId).index
      });
    }
  }
  if (!options.keepCurrentTree &&
      // the restored tab is a roo tab
      ancestors.length == 0 &&
      // but attached to any parent based on its restored position
      tab.$TST.parent &&
      // when not in-middle position of existing tree (safely detachable position)
      !tab.$TST.nextSiblingTab) {
    Tree.detachTab(tab, {
      broadcast: true
    });
  }
  if (options.children && !options.bulk) {
    for (const child of children) {
      if (!child)
        continue;
      await Tree.attachTabTo(child, tab, {
        dontExpand:  !child.active,
        forceExpand: active,
        insertAt:    Constants.kINSERT_NEAREST,
        broadcast:   true
      });
    }
  }

  const subtreeCollapsed = states.includes(Constants.kTAB_STATE_SUBTREE_COLLAPSED);
  if ((options.canCollapse || options.bulk) &&
      tab.$TST.subtreeCollapsed != subtreeCollapsed) {
    Tree.collapseExpandSubtree(tab, {
      broadcast: true,
      collapsed: subtreeCollapsed,
      justNow:   true
    });
  }
}


Tab.onRestored.addListener(tab => {
  log('onTabRestored ', dumpTab(tab));
  reserveToAttachTabFromRestoredInfo(tab, {
    children: true
  });
  reserveToAttachTabFromRestoredInfo.promisedDone.then(() => {
    Tree.fixupSubtreeCollapsedState(tab, {
      justNow:   true,
      broadcast: true
    });
    Sidebar.sendMessage({
      type:     Constants.kCOMMAND_NOTIFY_TAB_RESTORED,
      tabId:    tab.id,
      windowId: tab.windowId
    });
  });
});
