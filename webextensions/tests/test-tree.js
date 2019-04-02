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


export async function testInheritMutedState() {
  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2, openerTabId: 'A' },
    C: { index: 3, openerTabId: 'B' },
    D: { index: 4, openerTabId: 'C' }
  }, { windowId: win.id });

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${A.id} => ${B.id} => ${C.id} => ${D.id}`,
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
    is([false, false, false, false],
       [A, B, C, D].map(tab => tab.$TST.muted),
       'initially all tab must be unmuted');
    is([false, false, false, false],
       [A, B, C, D].map(tab => tab.$TST.maybeMuted),
       'initially all tab must not inherit muted status');
  }

  await browser.tabs.update(tabs.C.id, { muted: true });
  await wait(1000);

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D } = tabs;
    is([false, false, true, false],
       [A, B, C, D].map(tab => tab.$TST.muted),
       'only muted tab must have muted status');
    is([true, true, true, false],
       [A, B, C, D].map(tab => tab.$TST.maybeMuted),
       'ancestors must inherit "muted" state from descendant');
  }
}

export async function testPromoteFirstChildWhenClosedParentIsLastChild() {
  await Utils.setConfigs({
    closeParentBehavior: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
    promoteAllChildrenWhenClosedParentIsLastChild: false
  });

  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2, openerTabId: 'A' },
    C: { index: 3, openerTabId: 'B' },
    D: { index: 4, openerTabId: 'B' }
  }, { windowId: win.id });

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${A.id} => ${B.id} => ${D.id}`,
    ], Utils.treeStructure([A, B, C, D]),
       'tabs must be initialized with specified structure');
  }

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
    closeParentBehavior: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
    promoteAllChildrenWhenClosedParentIsLastChild: true
  });

  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2, openerTabId: 'A' },
    C: { index: 3, openerTabId: 'B' },
    D: { index: 4, openerTabId: 'B' }
  }, { windowId: win.id });

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${A.id} => ${B.id} => ${D.id}`,
    ], Utils.treeStructure([A, B, C, D]),
       'tabs must be initialized with specified structure');
  }

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
