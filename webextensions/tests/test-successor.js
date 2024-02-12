/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  wait
} from '/common/common.js';
import { is /*, ok, ng*/ } from '/tests/assert.js';
//import Tab from '/common/Tab.js';

import * as Constants from '/common/constants.js';
import * as Utils from './utils.js';

let win;

export async function setup() {
  win = await browser.windows.create();
}

export async function teardown() {
  await browser.windows.remove(win.id);
  win = null;
}

async function getActiveTabName(tabs) {
  const activeTabs = await browser.tabs.query({ windowId: win.id, active: true });
  return Object.keys(tabs).find(key => tabs[key].id == activeTabs[0].id) || `missing(${activeTabs[0].id})`;
}

export async function testSuccessorForLastChildWithPreviousSibling() {
  await Utils.setConfigs({
    successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    simulateSelectOwnerOnClose: false
  });

  const tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'A', active: true },
      D: { index: 4 } },
    win.id,
    [ 'A',
      'A => B',
      'A => C',
      'D' ]
  );

  let activeTabName = await getActiveTabName(tabs);
  is(`C(${tabs.C.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'the last child tab must be active');

  await Utils.waitUntilAllTabChangesFinished(() => browser.tabs.remove(tabs.C.id));

  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  activeTabName = await getActiveTabName(tabs);
  is(`B(${tabs.B.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'new last child tab must be the successor.');
}

export async function testSuccessorForLastChildWithoutPreviousSibling() {
  await Utils.setConfigs({
    successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    simulateSelectOwnerOnClose: false
  });

  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 3, openerTabId: 'A' },
      E: { index: 5 } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => D',
      'E' ]
  );
  // deactivate the effect of the "browser.tabs.selectOwnerOnClose"
  await browser.tabs.update(tabs.D.id, { active: true });
  await browser.tabs.update(tabs.A.id, { active: true });
  await browser.tabs.update(tabs.D.id, { active: true });
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  tabs = await Utils.refreshTabs(tabs);
  let activeTabName = await getActiveTabName(tabs);
  is(`D(${tabs.D.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'the last descendant tab must be active');

  await browser.tabs.remove(tabs.D.id);
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });

  activeTabName = await getActiveTabName(tabs);
  is(`C(${tabs.C.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'new last descendant tab must be the successor.');
}

export async function testMissingSuccessor() {
  await Utils.setConfigs({
    successorTabControlLevel:           Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    parentTabOperationBehaviorMode:     Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_CUSTOM,
    closeParentBehavior:                Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    closeParentBehavior_outsideSidebar_expanded: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    closeParentBehavior_noSidebar_expanded:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    simulateSelectOwnerOnClose:         true
  });

  const A = await browser.tabs.create({ windowId: win.id, active: true });
  const B = await browser.tabs.create({ windowId: win.id, openerTabId: A.id, active: true });
  const C = await browser.tabs.create({ windowId: win.id, openerTabId: A.id, active: true });
  const D = await browser.tabs.create({ windowId: win.id, openerTabId: A.id, active: true });
  const E = await browser.tabs.create({ windowId: win.id, active: true });
  await browser.tabs.update(A.id, { active: true });
  await wait(50);
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });

  let tabs = await Utils.refreshTabs({ A, B, C, D, E });
  {
    const { A, B, C, D, E } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${E.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
    const activeTabName = await getActiveTabName(tabs);
    is(`A(${tabs.A.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
       'the parent tab must be active');
  }

  await Utils.waitUntilAllTabChangesFinished(() => browser.tabs.remove(A.id));
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });

  tabs = await Utils.refreshTabs({ B, C, D, E });
  let activeTabName = await getActiveTabName(tabs);
  is(`B(${tabs.B.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'first child tab must be the successor.');

  await browser.tabs.update(C.id, { active: true });
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  await Utils.waitUntilAllTabChangesFinished(() => browser.tabs.remove(C.id));

  tabs = await Utils.refreshTabs({ B, D, E });
  activeTabName = await getActiveTabName(tabs);
  is(`D(${tabs.D.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'next tab must be the successor, instead of the parent.');
}

export async function testSimulateSelectOwnerOnClose() {
  await Utils.setConfigs({
    successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    simulateSelectOwnerOnClose: true
  });

  let tabs = await Utils.createTabs({
    A: { index: 1, active: true }
  });
  await wait(50);
  const childTabs = await Utils.createTabs({
    B: { index: 2, openerTabId: tabs.A.id },
    C: { index: 3, openerTabId: tabs.A.id, active: true }
  }, { windowId: win.id });
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  tabs = await Utils.refreshTabs({ A: tabs.A, B: childTabs.B, C: childTabs.C });
  {
    const { A, B, C } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${C.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
  }

  await Utils.waitUntilAllTabChangesFinished(() => browser.tabs.remove(tabs.C.id));
  const activeTabName = await getActiveTabName(tabs);
  is(`A(${tabs.A.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'the opener tab must be the successor.');
}

export async function testSimulateSelectOwnerOnCloseCleared() {
  await Utils.setConfigs({
    successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    simulateSelectOwnerOnClose: true
  });

  let tabs = await Utils.createTabs({
    A: { index: 1, active: true }
  });
  const childTabs = await Utils.createTabs({
    B: { index: 2, openerTabId: tabs.A.id },
    C: { index: 3, openerTabId: tabs.A.id }
  }, { windowId: win.id });
  tabs = await Utils.refreshTabs({ A: tabs.A, B: childTabs.B, C: childTabs.C });
  {
    const { A, B, C } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${C.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
    const activeTabName = await getActiveTabName(tabs);
    is(`A(${tabs.A.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
       'the opener tab must be active');
  }

  await browser.tabs.update(tabs.C.id, { active: true });
  await browser.tabs.update(tabs.B.id, { active: true });
  await browser.tabs.update(tabs.C.id, { active: true });
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  await Utils.waitUntilAllTabChangesFinished(() => browser.tabs.remove(tabs.C.id));

  const activeTabName = await getActiveTabName(tabs);
  is(`B(${tabs.B.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'the opener tab must not be the successor.');
}


export async function testAvoidDiscardedTabToBeActivatedAsSuccessor() {
  await Utils.setConfigs({
    successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
    avoidDiscardedTabToBeActivatedIfPossible: true
  });

  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2, openerTabId: 'A' },
    C: { index: 3, openerTabId: 'B' },
    D: { index: 4, openerTabId: 'A' },
    E: { index: 5, openerTabId: 'A' },
    F: { index: 6, openerTabId: 'A' },
    G: { index: 7 }
  }, { windowId: win.id });
  await browser.tabs.update(tabs.A.id, { active: true });
  await browser.tabs.update(tabs.B.id, { active: true });
  await browser.tabs.update(tabs.C.id, { active: true });
  await browser.tabs.update(tabs.D.id, { active: true });
  await browser.tabs.update(tabs.E.id, { active: true });
  await browser.tabs.update(tabs.F.id, { active: true });
  await browser.tabs.discard([tabs.B.id, tabs.E.id]);
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E, F, G } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${A.id} => ${E.id}`,
      `${A.id} => ${F.id}`,
      `${G.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
    const activeTabName = await getActiveTabName(tabs);
    is(`F(${tabs.F.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
       'the last child tab must be active');
  }

  await Utils.waitUntilAllTabChangesFinished(() => browser.tabs.remove(tabs.F.id));
  let activeTabName = await getActiveTabName(tabs);
  is(`D(${tabs.D.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'nearest loaded tab in the tree must become the successor.');

  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  await browser.tabs.update(tabs.C.id, { active: true });
  activeTabName = await getActiveTabName(tabs);
  is(`C(${tabs.C.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'the last child tab must be active');

  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  await Utils.waitUntilAllTabChangesFinished(() => browser.tabs.remove(tabs.C.id));
  activeTabName = await getActiveTabName(tabs);
  is(`D(${tabs.D.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'nearest loaded tab in the tree must become the successor.');

  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  await Utils.waitUntilAllTabChangesFinished(() => browser.tabs.remove(tabs.D.id));
  activeTabName = await getActiveTabName(tabs);
  is(`A(${tabs.A.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'nearest loaded tab in the tree must become the successor.');
}

export async function testAvoidDiscardedTabToBeActivatedOnCollapsed() {
  await Utils.setConfigs({
    avoidDiscardedTabToBeActivatedIfPossible: true
  });

  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2, openerTabId: 'A' },
    C: { index: 3, openerTabId: 'B' },
    D: { index: 4 }
  }, { windowId: win.id });
  await browser.tabs.update(tabs.B.id, { active: true });
  await browser.tabs.update(tabs.C.id, { active: true });
  await browser.tabs.discard(tabs.B.id);
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${D.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
    const activeTabName = await getActiveTabName(tabs);
    is(`C(${tabs.C.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
       'the last child tab must be active');
  }

  await browser.runtime.sendMessage({
    type:  'treestyletab:api:collapse-tree',
    tabId: tabs.B.id
  });
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  let activeTabName = await getActiveTabName(tabs);
  is(`A(${tabs.A.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'nearest loaded tab must become the successor.');

  await browser.runtime.sendMessage({
    type:  'treestyletab:api:expand-tree',
    tabId: tabs.B.id
  });
  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  await browser.tabs.update(tabs.C.id, { active: true });
  await browser.tabs.discard([tabs.A.id, tabs.B.id]);
  activeTabName = await getActiveTabName(tabs);
  is(`C(${tabs.C.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'the last child tab must be active');

  await browser.runtime.sendMessage({ type: Constants.kCOMMAND_WAIT_UNTIL_SUCCESSORS_UPDATED });
  await browser.runtime.sendMessage({
    type:  'treestyletab:api:collapse-tree',
    tabId: tabs.B.id
  });
  activeTabName = await getActiveTabName(tabs);
  is(`D(${tabs.D.id})`, `${activeTabName}(${tabs[activeTabName] && tabs[activeTabName].id})`,
     'nearest loaded tab must become the successor.');
}
