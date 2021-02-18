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


export async function testPromoteFirstChildWhenClosedParentIsLastChild() {
  await Utils.setConfigs({
    closeParentBehaviorMode: Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITHOUT_NATIVE_TABBAR,
    closeParentBehavior: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
    promoteAllChildrenWhenClosedParentIsLastChild: false
  });
  configs.sidebarVirtuallyOpenedWindows = [win.id];

  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D' ]
  );

  await browser.tabs.remove(tabs.B.id);
  await wait(1000);

  delete tabs.B;
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, C, D } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${C.id}`,
      `${A.id} => ${C.id} => ${D.id}`,
    ], Utils.treeStructure([A, C, D]),
       'only first child must be promoted');
  }
}

export async function testPromoteAllChildrenWhenClosedParentIsLastChild() {
  await Utils.setConfigs({
    closeParentBehaviorMode: Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITHOUT_NATIVE_TABBAR,
    closeParentBehavior: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
    promoteAllChildrenWhenClosedParentIsLastChild: true
  });
  configs.sidebarVirtuallyOpenedWindows = [win.id];

  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'B' },
      D: { index: 4, openerTabId: 'B' } },
    win.id,
    [ 'A',
      'A => B',
      'A => B => C',
      'A => B => D' ]
  );

  await browser.tabs.remove(tabs.B.id);
  await wait(1000);

  delete tabs.B;
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, C, D } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
    ], Utils.treeStructure([A, C, D]),
       'all children must be promoted');
  }
}

export async function testReplaceRemovedParentWithGroup() {
  await Utils.setConfigs({
    closeParentBehaviorMode: Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITHOUT_NATIVE_TABBAR,
    closeParentBehavior: Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB
  });
  configs.sidebarVirtuallyOpenedWindows = [win.id];

  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'A' } },
    win.id,
    [ 'A',
      'A => B',
      'A => C' ]
  );

  const beforeTabs = await browser.tabs.query({ windowId: win.id });
  await browser.tabs.remove(tabs.A.id);
  await wait(1000);
  const afterTabs = await browser.tabs.query({ windowId: win.id });
  is(beforeTabs.length,
     afterTabs.length,
     'the total number of tabs must be same');

  delete tabs.A;
  tabs.opened = afterTabs[afterTabs.length - 3];

  tabs = await Utils.refreshTabs(tabs);
  {
    const { opened, B, C } = tabs;
    is([
      `${opened.id}`,
      `${opened.id} => ${B.id}`,
      `${opened.id} => ${C.id}`,
    ], Utils.treeStructure([opened, B, C]),
       'tree structure must be kept');
  }
}

// https://github.com/piroor/treestyletab/issues/2818
export async function testReplaceRemovedParentWithGroupForVisibleSidebar() {
  await Utils.setConfigs({
    closeParentBehaviorMode: Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITH_NATIVE_TABBAR,
    closeParentBehavior: Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB
  });
  configs.sidebarVirtuallyOpenedWindows = [win.id];

  let tabs = await Utils.prepareTabsInWindow(
    { A: { index: 1 },
      B: { index: 2, openerTabId: 'A' },
      C: { index: 3, openerTabId: 'A' } },
    win.id,
    [ 'A',
      'A => B',
      'A => C' ]
  );

  const beforeTabs = await browser.tabs.query({ windowId: win.id });
  await browser.tabs.remove(tabs.A.id);
  await wait(1000);
  const afterTabs = await browser.tabs.query({ windowId: win.id });
  is(beforeTabs.length,
     afterTabs.length,
     'the total number of tabs must be same');

  delete tabs.A;
  tabs = await Utils.refreshTabs({ opened: afterTabs[afterTabs.length - 3], ...tabs });
  {
    const { opened, B, C } = tabs;
    is([
      `${opened.id}`,
      `${opened.id} => ${B.id}`,
      `${opened.id} => ${C.id}`,
    ], Utils.treeStructure([opened, B, C]),
       'tree structure must be kept');
  }
}

// https://github.com/piroor/treestyletab/issues/2819
export async function testKeepChildrenForTemporaryAggressiveGroupWithCloseParentWithAllChildrenBehavior() {
  await Utils.setConfigs({
    closeParentBehaviorMode:            Constants.kCLOSE_PARENT_BEHAVIOR_MODE_CUSTOM,
    closeParentBehavior:                Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN,
    closeParentBehavior_outsideSidebar: Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB,
    closeParentBehavior_noSidebar:      Constants.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB
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

  const beforeTabs = await browser.tabs.query({ windowId: win.id });
  await browser.tabs.remove(tabs.C.id);
  await wait(1000);
  const afterTabs = await browser.tabs.query({ windowId: win.id });
  is(beforeTabs.length - 2,
     afterTabs.length,
     'only the group parent tab should be cleaned up');
  is(afterTabs[afterTabs.length - 1].id,
     tabs.B.id,
     'other children of the group parent tab must be kept');
}

