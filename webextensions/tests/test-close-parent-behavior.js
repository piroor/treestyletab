/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  wait,
  configs
} from '/common/common.js';
import { is /*, ok, ng*/ } from '/tests/assert.js';
//import Tab from '/common/Tab.js';

import * as Constants from '/common/constants.js';
import * as Utils from './utils.js';

let win;

export async function setup() {
  configs.sidebarVirtuallyOpenedWindows = [];
  configs.sidebarVirtuallyClosedWindows = [];
  win = await browser.windows.create();
}

export async function teardown() {
  await browser.windows.remove(win.id);
  win = null;
  configs.sidebarVirtuallyOpenedWindows = [];
  configs.sidebarVirtuallyClosedWindows = [];
}

async function expandAll(windowId) {
  await browser.runtime.sendMessage({
    type:  'treestyletab:api:expand-tree',
    tabId: '*',
    windowId
  });
  await wait(250);
}

async function collapseAll(windowId) {
  await browser.runtime.sendMessage({
    type:  'treestyletab:api:collapse-tree',
    tabId: '*',
    windowId
  });
  await wait(250);
}

function openSidebar() {
  configs.sidebarVirtuallyOpenedWindows = [win.id];
  configs.sidebarVirtuallyClosedWindows = [];
}

function closeSidebar() {
  configs.sidebarVirtuallyOpenedWindows = [];
  configs.sidebarVirtuallyClosedWindows = [win.id];
}


async function assertFirstChildPromoted({ closer, collapsed } = {}) {
  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'A' },
      E: { index: 5 },
      F: { index: 6, openerTabId: 'E' },
      G: { index: 7, openerTabId: 'E' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => D',
      'E',
      'E => F',
      'E => G' ]
  );
  if (collapsed)
    await collapseAll(win.id);
  else
    await expandAll(win.id);

  await (closer || closeTabsFromOutside)([tabs.B, tabs.E]);
  await wait(500);

  delete tabs.B;
  delete tabs.E;
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, C, D, F, G } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${F.id}`,
      `${F.id} => ${G.id}`,
    ], Utils.treeStructure([A, C, D, F, G]),
       'the first child must be promoted');
  }
}

async function assertAllChildrenPromoted({ closer, collapsed } = {}) {
  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' },
      E: { index: 5 },
      F: { index: 6, openerTabId: 'E' },
      G: { index: 7, openerTabId: 'E' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D',
      'E',
      'E => F',
      'E => G' ]
  );
  if (collapsed)
    await collapseAll(win.id);
  else
    await expandAll(win.id);

  await (closer || closeTabsFromOutside)([tabs.B, tabs.E]);
  await wait(500);

  delete tabs.B;
  delete tabs.E;
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, C, D, F, G } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${F.id}`,
      `${G.id}`,
    ], Utils.treeStructure([A, C, D, F, G]),
       'all children must be promoted');
  }
}

async function assertPromotedIntelligently({ closer, collapsed } = {}) {
  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' },
      E: { index: 5, openerTabId: 'A' },
      F: { index: 6 },
      G: { index: 7, openerTabId: 'F' },
      H: { index: 8, openerTabId: 'F' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D',
      'A => E',
      'F',
      'F => G',
      'F => H' ]
  );
  if (collapsed)
    await collapseAll(win.id);
  else
    await expandAll(win.id);

  await (closer || closeTabsFromOutside)([tabs.B, tabs.F]);
  await wait(500);

  delete tabs.B;
  delete tabs.F;
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, C, D, E, G, H } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${A.id} => ${E.id}`,
      `${G.id}`,
      `${G.id} => ${H.id}`,
    ], Utils.treeStructure([A, C, D, E, G, H]),
       'all children must be promoted if there parent, otherwise promote the first child');
  }
}

async function assertAllChildrenDetached({ closer, collapsed } = {}) {
  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' },
      E: { index: 5, openerTabId: 'A' },
      F: { index: 6 },
      G: { index: 7, openerTabId: 'F' },
      H: { index: 8, openerTabId: 'F' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D',
      'A => E',
      'F',
      'F => G',
      'F => H' ]
  );
  if (collapsed)
    await collapseAll(win.id);
  else
    await expandAll(win.id);

  await (closer || closeTabsFromOutside)([tabs.B, tabs.F]);
  await wait(500);

  delete tabs.B;
  delete tabs.F;
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, C, D, E, G, H } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${E.id}`,
      `${C.id}`,
      `${D.id}`,
      `${G.id}`,
      `${H.id}`,
    ], Utils.treeStructure([A, E, C, D, G, H]),
       'all children must be detached');
  }
}

async function assertAllChildrenSimplyDetached({ closer, collapsed } = {}) {
  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' },
      E: { index: 5, openerTabId: 'A' },
      F: { index: 6 },
      G: { index: 7, openerTabId: 'F' },
      H: { index: 8, openerTabId: 'F' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D',
      'A => E',
      'F',
      'F => G',
      'F => H' ]
  );
  if (collapsed)
    await collapseAll(win.id);
  else
    await expandAll(win.id);

  await (closer || closeTabsFromOutside)([tabs.B, tabs.F]);
  await wait(500);

  delete tabs.B;
  delete tabs.F;
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, C, D, E, G, H } = tabs;
    is([
      `${A.id}`,
      `${C.id}`,
      `${D.id}`,
      `${A.id} => ${E.id}`,
      `${G.id}`,
      `${H.id}`,
    ], Utils.treeStructure([A, C, D, E, G, H]),
       'all children must be detached at their original position');
  }
}

async function assertEntireTreeClosed({ closer, collapsed } = {}) {
  const tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' },
      E: { index: 5 },
      F: { index: 6, openerTabId: 'E' },
      G: { index: 7, openerTabId: 'E' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D',
      'E',
      'E => F',
      'E => G' ]
  );
  if (collapsed)
    await collapseAll(win.id);
  else
    await expandAll(win.id);

  await (closer || closeTabsFromOutside)([tabs.B, tabs.E]);
  await wait(500);
  const afterTabs = await Promise.all(
    Array.from(Object.values(tabs))
      .map(tab => browser.tabs.get(tab.id).catch(_error => null))
  );
  is([tabs.A.id],
     afterTabs.filter(tab => !!tab).map(tab => tab.id),
     'all closed parents and their children must be removed, and only upper level tab must be left');
}

async function assertClosedParentIsReplacedWithGroup({ closer, collapsed } = {}) {
  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' },
      E: { index: 5 },
      F: { index: 6, openerTabId: 'E' },
      G: { index: 7, openerTabId: 'E' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D',
      'E',
      'E => F',
      'E => G' ]
  );
  if (collapsed)
    await collapseAll(win.id);
  else
    await expandAll(win.id);

  const beforeTabIds = new Set((await browser.tabs.query({ windowId: win.id })).map(tab => tab.id));
  await (closer || closeTabsFromOutside)([tabs.B, tabs.E]);
  await wait(500);
  const openedTabs = (await browser.tabs.query({ windowId: win.id })).filter(tab => !beforeTabIds.has(tab.id));
  is(2,
     openedTabs.length,
     'group tabs must be opened for closed parent tabs');

  delete tabs.B;
  delete tabs.E;
  tabs.opened1 = openedTabs[0];
  tabs.opened2 = openedTabs[1];

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, opened1, C, D, opened2, F, G} = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${opened1.id}`,
      `${A.id} => ${opened1.id} => ${C.id}`,
      `${A.id} => ${opened1.id} => ${D.id}`,
      `${opened2.id}`,
      `${opened2.id} => ${F.id}`,
      `${opened2.id} => ${G.id}`,
    ], Utils.treeStructure([A, opened1, C, D, opened2, F, G]),
       'tree structure must be kept');
  }
}

async function closeTabsFromSidebar(tabs) {
  await browser.runtime.sendMessage({
    type:   Constants.kCOMMAND_REMOVE_TABS_BY_MOUSE_OPERATION,
    tabIds: tabs.map(tab => tab.id)
  });
}

async function closeTabsFromOutside(tabs) {
  await browser.tabs.remove(tabs.map(tab => tab.id));
}


export async function testPermanentlyConsistentBehaviors() {
  await Utils.setConfigs({
    warnOnCloseTabs:                              false,
    parentTabOperationBehaviorMode:               Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_CONSISTENT,
    closeParentBehavior_insideSidebar_expanded:   Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
  });

  configs.sidebarVirtuallyOpenedWindows = [win.id];
  configs.sidebarVirtuallyClosedWindows = [];
  await assertEntireTreeClosed({ closer: closeTabsFromSidebar, collapsed: true });

  configs.parentTabOperationBehaviorMode = Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_PARALLEL;
  await assertEntireTreeClosed({ closer: closeTabsFromSidebar, collapsed: true });

  configs.parentTabOperationBehaviorMode = Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_CUSTOM;
  await assertEntireTreeClosed({ closer: closeTabsFromSidebar, collapsed: true });
}


async function assertCloseBehaved({
  collapsed_insideSidebar, expanded_insideSidebar,
  collapsed_outsideSidebar, expanded_outsideSidebar,
  collapsed_noSidebar, expanded_noSidebar
}) {
  openSidebar();
  await collapsed_insideSidebar({ closer: closeTabsFromSidebar, collapsed: true });
  await expanded_insideSidebar({ closer: closeTabsFromSidebar });
  await collapsed_outsideSidebar({ closer: closeTabsFromOutside, collapsed: true });
  await expanded_outsideSidebar({ closer: closeTabsFromOutside });
  closeSidebar();
  await collapsed_noSidebar({ closer: closeTabsFromOutside, collapsed: true });
  await expanded_noSidebar({ closer: closeTabsFromOutside });
}

export async function testConsistentMode_close() {
  await Utils.setConfigs({
    warnOnCloseTabs:                              false,
    parentTabOperationBehaviorMode:               Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_CONSISTENT,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
  });

  configs.closeParentBehavior_insideSidebar_expanded = Constants.kPARENT_TAB_OPERATION_BEHAVIOR_ENTIRE_TREE;
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertEntireTreeClosed,
    collapsed_outsideSidebar: assertEntireTreeClosed,
    expanded_outsideSidebar:  assertEntireTreeClosed,
    collapsed_noSidebar:      assertEntireTreeClosed,
    expanded_noSidebar:       assertEntireTreeClosed,
  });

  configs.closeParentBehavior_insideSidebar_expanded = Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD;
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertFirstChildPromoted,
    collapsed_outsideSidebar: assertEntireTreeClosed,
    expanded_outsideSidebar:  assertFirstChildPromoted,
    collapsed_noSidebar:      assertEntireTreeClosed,
    expanded_noSidebar:       assertFirstChildPromoted,
  });

  configs.closeParentBehavior_insideSidebar_expanded = Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_ALL_CHILDREN;
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertAllChildrenPromoted,
    collapsed_outsideSidebar: assertEntireTreeClosed,
    expanded_outsideSidebar:  assertAllChildrenPromoted,
    collapsed_noSidebar:      assertEntireTreeClosed,
    expanded_noSidebar:       assertAllChildrenPromoted,
  });

  configs.closeParentBehavior_insideSidebar_expanded = Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_INTELLIGENTLY;
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertPromotedIntelligently,
    collapsed_outsideSidebar: assertEntireTreeClosed,
    expanded_outsideSidebar:  assertPromotedIntelligently,
    collapsed_noSidebar:      assertEntireTreeClosed,
    expanded_noSidebar:       assertPromotedIntelligently,
  });

  configs.closeParentBehavior_insideSidebar_expanded = Constants.kPARENT_TAB_OPERATION_BEHAVIOR_DETACH_ALL_CHILDREN;
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertAllChildrenDetached,
    collapsed_outsideSidebar: assertEntireTreeClosed,
    expanded_outsideSidebar:  assertAllChildrenDetached,
    collapsed_noSidebar:      assertEntireTreeClosed,
    expanded_noSidebar:       assertAllChildrenDetached,
  });

  configs.closeParentBehavior_insideSidebar_expanded = Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN;
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertAllChildrenSimplyDetached,
    collapsed_outsideSidebar: assertEntireTreeClosed,
    expanded_outsideSidebar:  assertAllChildrenSimplyDetached,
    collapsed_noSidebar:      assertEntireTreeClosed,
    expanded_noSidebar:       assertAllChildrenSimplyDetached,
  });

  configs.closeParentBehavior_insideSidebar_expanded = Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB;
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertClosedParentIsReplacedWithGroup,
    collapsed_outsideSidebar: assertEntireTreeClosed,
    expanded_outsideSidebar:  assertClosedParentIsReplacedWithGroup,
    collapsed_noSidebar:      assertEntireTreeClosed,
    expanded_noSidebar:       assertClosedParentIsReplacedWithGroup,
  });
}


export async function testParallelMode_close() {
  await Utils.setConfigs({
    warnOnCloseTabs:                              false,
    parentTabOperationBehaviorMode:               Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_PARALLEL,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_ENTIRE_TREE,
    closeParentBehavior_outsideSidebar_expanded: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertEntireTreeClosed,
    collapsed_outsideSidebar: assertFirstChildPromoted,
    expanded_outsideSidebar:  assertFirstChildPromoted,
    collapsed_noSidebar:      assertFirstChildPromoted,
    expanded_noSidebar:       assertFirstChildPromoted,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    closeParentBehavior_outsideSidebar_expanded: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_ALL_CHILDREN,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertFirstChildPromoted,
    collapsed_outsideSidebar: assertAllChildrenPromoted,
    expanded_outsideSidebar:  assertAllChildrenPromoted,
    collapsed_noSidebar:      assertAllChildrenPromoted,
    expanded_noSidebar:       assertAllChildrenPromoted,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_expanded: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_DETACH_ALL_CHILDREN,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertAllChildrenPromoted,
    collapsed_outsideSidebar: assertAllChildrenDetached,
    expanded_outsideSidebar:  assertAllChildrenDetached,
    collapsed_noSidebar:      assertAllChildrenDetached,
    expanded_noSidebar:       assertAllChildrenDetached,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_DETACH_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_expanded: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertAllChildrenDetached,
    collapsed_outsideSidebar: assertAllChildrenSimplyDetached,
    expanded_outsideSidebar:  assertAllChildrenSimplyDetached,
    collapsed_noSidebar:      assertAllChildrenSimplyDetached,
    expanded_noSidebar:       assertAllChildrenSimplyDetached,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_expanded: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertAllChildrenSimplyDetached,
    collapsed_outsideSidebar: assertClosedParentIsReplacedWithGroup,
    expanded_outsideSidebar:  assertClosedParentIsReplacedWithGroup,
    collapsed_noSidebar:      assertClosedParentIsReplacedWithGroup,
    expanded_noSidebar:       assertClosedParentIsReplacedWithGroup,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
    closeParentBehavior_outsideSidebar_expanded: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_ENTIRE_TREE,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertClosedParentIsReplacedWithGroup,
    collapsed_outsideSidebar: assertEntireTreeClosed,
    expanded_outsideSidebar:  assertEntireTreeClosed,
    collapsed_noSidebar:      assertEntireTreeClosed,
    expanded_noSidebar:       assertEntireTreeClosed,
  });
}


export async function testCustomMode_close() {
  await Utils.setConfigs({
    warnOnCloseTabs:                false,
    parentTabOperationBehaviorMode: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_CUSTOM,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:   Constants.kPARENT_TAB_OPERATION_BEHAVIOR_ENTIRE_TREE,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    closeParentBehavior_outsideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_ALL_CHILDREN,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertEntireTreeClosed,
    collapsed_outsideSidebar: assertFirstChildPromoted,
    expanded_outsideSidebar:  assertAllChildrenPromoted,
    collapsed_noSidebar:      assertAllChildrenDetached,
    expanded_noSidebar:       assertAllChildrenSimplyDetached,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:   Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertFirstChildPromoted,
    collapsed_outsideSidebar: assertAllChildrenPromoted,
    expanded_outsideSidebar:  assertAllChildrenDetached,
    collapsed_noSidebar:      assertAllChildrenSimplyDetached,
    expanded_noSidebar:       assertClosedParentIsReplacedWithGroup,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:   Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_DETACH_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_ENTIRE_TREE,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertAllChildrenPromoted,
    collapsed_outsideSidebar: assertAllChildrenDetached,
    expanded_outsideSidebar:  assertAllChildrenSimplyDetached,
    collapsed_noSidebar:      assertClosedParentIsReplacedWithGroup,
    expanded_noSidebar:       assertEntireTreeClosed,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:   Constants.kPARENT_TAB_OPERATION_BEHAVIOR_DETACH_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_ENTIRE_TREE,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertAllChildrenDetached,
    collapsed_outsideSidebar: assertAllChildrenSimplyDetached,
    expanded_outsideSidebar:  assertClosedParentIsReplacedWithGroup,
    collapsed_noSidebar:      assertEntireTreeClosed,
    expanded_noSidebar:       assertFirstChildPromoted,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:   Constants.kPARENT_TAB_OPERATION_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
    closeParentBehavior_outsideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_ENTIRE_TREE,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_ALL_CHILDREN,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertAllChildrenSimplyDetached,
    collapsed_outsideSidebar: assertClosedParentIsReplacedWithGroup,
    expanded_outsideSidebar:  assertEntireTreeClosed,
    collapsed_noSidebar:      assertFirstChildPromoted,
    expanded_noSidebar:       assertAllChildrenPromoted,
  });

  await Utils.setConfigs({
    closeParentBehavior_insideSidebar_expanded:   Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_ENTIRE_TREE,
    closeParentBehavior_outsideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_ALL_CHILDREN,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_DETACH_ALL_CHILDREN,
  });
  await assertCloseBehaved({
    collapsed_insideSidebar:  assertEntireTreeClosed,
    expanded_insideSidebar:   assertClosedParentIsReplacedWithGroup,
    collapsed_outsideSidebar: assertEntireTreeClosed,
    expanded_outsideSidebar:  assertFirstChildPromoted,
    collapsed_noSidebar:      assertAllChildrenPromoted,
    expanded_noSidebar:       assertAllChildrenDetached,
  });
}

export async function testPromoteOnlyFirstChildWhenClosedParentIsLastChild() {
  await Utils.setConfigs({
    warnOnCloseTabs:                               false,
    parentTabOperationBehaviorMode:                Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_CONSISTENT,
    closeParentBehavior_insideSidebar_expanded:    Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    promoteAllChildrenWhenClosedParentIsLastChild: false,
  });
  configs.sidebarVirtuallyOpenedWindows = [win.id];

  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' },
      E: { index: 5 },
      F: { index: 6, openerTabId: 'E' },
      G: { index: 7, openerTabId: 'E' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D',
      'E',
      'E => F',
      'E => G' ]
  );
  await expandAll(win.id);

  await browser.tabs.remove([tabs.B.id, tabs.E.id]);
  await wait(500);

  delete tabs.B;
  delete tabs.E;
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, C, D, F, G } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${C.id}`,
      `${A.id} => ${C.id} => ${D.id}`,
      `${F.id}`,
      `${F.id} => ${G.id}`,
    ], Utils.treeStructure([A, C, D, F, G]),
       'only first child must be promoted');
  }
}

export async function testPromoteAllChildrenWhenClosedParentIsLastChild() {
  await Utils.setConfigs({
    warnOnCloseTabs:                               false,
    parentTabOperationBehaviorMode:                Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_CONSISTENT,
    closeParentBehavior_insideSidebar_expanded:    Constants.kPARENT_TAB_OPERATION_BEHAVIOR_PROMOTE_FIRST_CHILD,
    promoteAllChildrenWhenClosedParentIsLastChild: true,
  });
  configs.sidebarVirtuallyOpenedWindows = [win.id];

  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' },
      E: { index: 5 },
      F: { index: 6, openerTabId: 'E' },
      G: { index: 7, openerTabId: 'E' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D',
      'E',
      'E => F',
      'E => G' ]
  );
  await expandAll(win.id);

  await browser.tabs.remove([tabs.B.id, tabs.E.id]);
  await wait(500);

  delete tabs.B;
  delete tabs.E;
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, C, D, F, G } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${F.id}`,
      `${F.id} => ${G.id}`,
    ], Utils.treeStructure([A, C, D, F, G]),
       'all children must be promoted only when it is the last child');
  }
}

// https://github.com/piroor/treestyletab/issues/2819
export async function testKeepChildrenForTemporaryAggressiveGroupWithCloseParentWithAllChildrenBehavior() {
  await Utils.setConfigs({
    warnOnCloseTabs:                              false,
    parentTabOperationBehaviorMode:               Constants.kPARENT_TAB_OPERATION_BEHAVIOR_MODE_CUSTOM,
    closeParentBehavior_insideSidebar_expanded:   Constants.kPARENT_TAB_OPERATION_BEHAVIOR_ENTIRE_TREE,
    closeParentBehavior_outsideSidebar_collapsed: Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
    closeParentBehavior_outsideSidebar_expanded:  Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
    closeParentBehavior_noSidebar_collapsed:      Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
    closeParentBehavior_noSidebar_expanded:       Constants.kPARENT_TAB_OPERATION_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
  });
  configs.sidebarVirtuallyOpenedWindows = [win.id];

  const tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1, url: `${Constants.kSHORTHAND_URIS.group}?temporaryAggressive=true` },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'A' } },
    win.id,
    [ 'A',
      'A => B',
      'A => C' ]
  );
  await expandAll(win.id);

  const beforeTabs = await browser.tabs.query({ windowId: win.id });
  await browser.tabs.remove(tabs.C.id);
  await wait(500);
  const afterTabs = await browser.tabs.query({ windowId: win.id });
  is(beforeTabs.length - 2,
     afterTabs.length,
     'only the group parent tab should be cleaned up');
  is(afterTabs[afterTabs.length - 1].id,
     tabs.B.id,
     'other children of the group parent tab must be kept');
}

