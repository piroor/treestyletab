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
  await Utils.setConfigs({
    spreadMutedStateOnlyToSoundPlayingTabs: false
  });
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

  //await Promise.all(
  //  [tabs.B.id, tabs.C.id, tabs.D.id].map(id =>
  //    browser.tabs.update(id, { audible: true }))
  //);

  await browser.tabs.update(tabs.C.id, { muted: false });
  await browser.runtime.sendMessage({
    type:  'treestyletab:api:collapse-tree',
    tabId: tabs.B.id
  });
  await wait(1000);
  await browser.tabs.update(tabs.B.id, { muted: true });
  await wait(1000);
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D } = tabs;
    is([false, true, true, true],
       [A, B, C, D].map(tab => tab.$TST.muted),
       'collapsed descendants must be muted too');
  }
  await browser.tabs.update(tabs.B.id, { muted: false });
  await wait(1000);
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D } = tabs;
    is([false, false, false, false],
       [A, B, C, D].map(tab => tab.$TST.muted),
       'collapsed descendants must be unmuted too');
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

// https://github.com/piroor/treestyletab/issues/2273
export async function testIgnoreCreatingTabsOnTreeStructureAutoFix() {
  await Utils.setConfigs({
    autoGroupNewTabs: false
  });

  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2, openerTabId: 'A' },
    C: { index: 3, openerTabId: 'B' }
  }, { windowId: win.id });

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`
    ], Utils.treeStructure([A, B, C]),
       'tabs must be initialized with specified structure');
  }

  const newTabs = await Utils.doAndGetNewTabs(async () => {
    await Promise.all([
      browser.tabs.create({ windowId: win.id }),
      browser.tabs.create({ windowId: win.id })
    ]);
  }, { windowId: win.id });
  tabs.D = newTabs[0];
  tabs.E = newTabs[1];

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${D.id}`,
      `${E.id}`
    ], Utils.treeStructure([A, B, C, D, E]),
       'new tabs opened in a time must not be attached');
  }
}

export async function testNearestLoadedTabInTree() {
  /*
    * A
    * B
      * C
        * D
      * E
        * F
          * G
        * H <= test target
          * I
        * J
          * K
      * L
        * M
    * N
  */
  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2 },
    C: { index: 3, openerTabId: 'B' },
    D: { index: 4, openerTabId: 'C' },
    E: { index: 5, openerTabId: 'B' },
    F: { index: 6, openerTabId: 'E' },
    G: { index: 7, openerTabId: 'F' },
    H: { index: 8, openerTabId: 'E' },
    I: { index: 9, openerTabId: 'H' },
    J: { index: 10, openerTabId: 'E' },
    K: { index: 11, openerTabId: 'J' },
    L: { index: 12, openerTabId: 'B' },
    M: { index: 13, openerTabId: 'L' },
    N: { index: 14 }
  }, { windowId: win.id });
  await browser.tabs.update(tabs.H.id, { active: true });
  await browser.tabs.discard([
    tabs.A.id,
    tabs.B.id,
    tabs.C.id,
    tabs.D.id,
    tabs.E.id,
    tabs.F.id,
    tabs.G.id,
    tabs.I.id,
    tabs.J.id,
    tabs.K.id,
    tabs.L.id,
    tabs.M.id
  ]);
  await wait(50);
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E, F, G, H, I, J, K, L, M, N } = tabs;
    is([
      `${A.id}`,
      `${B.id}`,
      `${B.id} => ${C.id}`,
      `${B.id} => ${C.id} => ${D.id}`,
      `${B.id} => ${E.id}`,
      `${B.id} => ${E.id} => ${F.id}`,
      `${B.id} => ${E.id} => ${F.id} => ${G.id}`,
      `${B.id} => ${E.id} => ${H.id}`,
      `${B.id} => ${E.id} => ${H.id} => ${I.id}`,
      `${B.id} => ${E.id} => ${J.id}`,
      `${B.id} => ${E.id} => ${J.id} => ${K.id}`,
      `${B.id} => ${L.id}`,
      `${B.id} => ${L.id} => ${M.id}`,
      `${N.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
  }
  await wait(1000);

  const tabNameById = {};
  const promisedExpanded = [];
  for (const name of Object.keys(tabs)) {
    tabNameById[tabs[name].id] = name;
    promisedExpanded.push(browser.runtime.sendMessage({
      type:  'treestyletab:api:expand-tree',
      tabId: tabs[name].id
    }));
  }
  await Promise.all(promisedExpanded);

  is(null,
     tabs.H.$TST.nearestLoadedTabInTree &&
       tabNameById[tabs.H.$TST.nearestLoadedTabInTree.id],
     'No tab should be found');
  is('N', tabNameById[tabs.H.$TST.nearestLoadedTab.id],
     'Next root tab should be found');

  const followingTabs = [
    tabs.I,
    tabs.J,
    tabs.K,
    tabs.L,
    tabs.M
  ];
  let lastTab;
  for (let i = 0; i < followingTabs.length - 1; i++) {
    const nextTab = followingTabs[i];
    await Promise.all([
      lastTab && browser.tabs.discard(lastTab.id),
      browser.tabs.reload(nextTab.id)
    ]);
    await wait(500);
    tabs = await Utils.refreshTabs(tabs);
    is(tabNameById[nextTab.id],
       tabs.H.$TST.nearestLoadedTabInTree &&
         tabNameById[tabs.H.$TST.nearestLoadedTabInTree.id],
       'A following loaded tab in the tree should be found');
    is(tabNameById[nextTab.id],
       tabs.H.$TST.nearestLoadedTab &&
         tabNameById[tabs.H.$TST.nearestLoadedTab.id],
       'A following loaded tab should be found');
    lastTab = nextTab;
  }
  await browser.tabs.discard([lastTab.id, tabs.N.id]);

  const precedingTabs = [
    tabs.B,
    tabs.C,
    tabs.D,
    tabs.E,
    tabs.F,
    tabs.G
  ].reverse();
  lastTab = null;
  for (let i = 0; i < precedingTabs.length - 1; i++) {
    const nextTab = precedingTabs[i];
    await Promise.all([
      lastTab && browser.tabs.discard(lastTab.id),
      browser.tabs.reload(nextTab.id)
    ]);
    await wait(500);
    tabs = await Utils.refreshTabs(tabs);
    is(tabNameById[nextTab.id],
       tabs.H.$TST.nearestLoadedTabInTree &&
         tabNameById[tabs.H.$TST.nearestLoadedTabInTree.id],
       'A preceding loaded tab in the tree should be found');
    is(tabNameById[nextTab.id],
       tabs.H.$TST.nearestLoadedTab &&
         tabNameById[tabs.H.$TST.nearestLoadedTab.id],
       'A preceding loaded tab should be found');
    lastTab = nextTab;
  }
}


async function prepareRelatedTabsToTestInsertionPosition() {
  const A = await browser.tabs.create({ windowId: win.id, active: true, url: 'about:blank?A' });
  const B = await browser.tabs.create({ windowId: win.id, openerTabId: A.id, active: false, url: 'about:blank?B' });
  const C = await browser.tabs.create({ windowId: win.id, openerTabId: A.id, active: false, url: 'about:blank?C' });
  const D = await browser.tabs.create({ windowId: win.id, openerTabId: A.id, active: false, url: 'about:blank?D' });

  await browser.tabs.update(B.id, { active: true });
  await wait(150);
  const B1 = await browser.tabs.create({ windowId: win.id, openerTabId: B.id, active: false, url: 'about:blank?B1' });
  const B2 = await browser.tabs.create({ windowId: win.id, openerTabId: B.id, active: false, url: 'about:blank?B2' });

  await browser.tabs.update(C.id, { active: true });
  await wait(150);
  const C1 = await browser.tabs.create({ windowId: win.id, openerTabId: C.id, active: false, url: 'about:blank?C1' });
  const C2 = await browser.tabs.create({ windowId: win.id, openerTabId: C.id, active: false, url: 'about:blank?C2' });

  await browser.tabs.update(D.id, { active: true });
  await wait(150);
  const D1 = await browser.tabs.create({ windowId: win.id, openerTabId: D.id, active: false, url: 'about:blank?D1' });
  const D2 = await browser.tabs.create({ windowId: win.id, openerTabId: D.id, active: false, url: 'about:blank?D2' });

  await browser.tabs.update(A.id, { active: true });
  await wait(150);
  const E = await browser.tabs.create({ windowId: win.id, openerTabId: A.id, active: false, url: 'about:blank?E' });
  const F = await browser.tabs.create({ windowId: win.id, openerTabId: A.id, active: false, url: 'about:blank?F' });

  await wait(150);
  return Utils.refreshTabs({ A, B, B1, B2, C, C1, C2, D, D1, D2, E, F });
}

export async function testInsertionPosition_insertAtTop() {
  await Utils.setConfigs({
    insertNewChildAt:            Constants.kINSERT_TOP,
    insertNewTabFromPinnedTabAt: Constants.kINSERT_END,
    insertDroppedTabsAt:         Constants.kINSERT_END,
    simulateSelectOwnerOnClose:  false
  });

  const tabs = await prepareRelatedTabsToTestInsertionPosition();
  const { A, B, B1, B2, C, C1, C2, D, D1, D2, E, F } = tabs;
  is([
    `${A.id}`,
    `${A.id} => ${F.id}`,
    `${A.id} => ${E.id}`,
    `${A.id} => ${D.id}`,
    `${A.id} => ${D.id} => ${D2.id}`,
    `${A.id} => ${D.id} => ${D1.id}`,
    `${A.id} => ${C.id}`,
    `${A.id} => ${C.id} => ${C2.id}`,
    `${A.id} => ${C.id} => ${C1.id}`,
    `${A.id} => ${B.id}`,
    `${A.id} => ${B.id} => ${B2.id}`,
    `${A.id} => ${B.id} => ${B1.id}`,
  ], Utils.treeStructure(Object.values(tabs)),
     'tabs should be opened reversed order');
}

export async function testInsertionPosition_insertAtEnd() {
  await Utils.setConfigs({
    insertNewChildAt:            Constants.kINSERT_END,
    insertNewTabFromPinnedTabAt: Constants.kINSERT_END,
    insertDroppedTabsAt:         Constants.kINSERT_END,
    simulateSelectOwnerOnClose:  false
  });

  const tabs = await prepareRelatedTabsToTestInsertionPosition();
  const { A, B, B1, B2, C, C1, C2, D, D1, D2, E, F } = tabs;
  is([
    `${A.id}`,
    `${A.id} => ${B.id}`,
    `${A.id} => ${B.id} => ${B1.id}`,
    `${A.id} => ${B.id} => ${B2.id}`,
    `${A.id} => ${C.id}`,
    `${A.id} => ${C.id} => ${C1.id}`,
    `${A.id} => ${C.id} => ${C2.id}`,
    `${A.id} => ${D.id}`,
    `${A.id} => ${D.id} => ${D1.id}`,
    `${A.id} => ${D.id} => ${D2.id}`,
    `${A.id} => ${E.id}`,
    `${A.id} => ${F.id}`,
  ], Utils.treeStructure(Object.values(tabs)),
     'tabs should be opened reversed order');
}

export async function testInsertionPosition_nextToLastRelatedTab() {
  await Utils.setConfigs({
    insertNewChildAt:            Constants.kINSERT_NEXT_TO_LAST_RELATED_TAB,
    insertNewTabFromPinnedTabAt: Constants.kINSERT_END,
    insertDroppedTabsAt:         Constants.kINSERT_END,
    simulateSelectOwnerOnClose:  false
  });

  const tabs = await prepareRelatedTabsToTestInsertionPosition();
  const { A, B, B1, B2, C, C1, C2, D, D1, D2, E, F } = tabs;
  is([
    `${A.id}`,
    `${A.id} => ${E.id}`,
    `${A.id} => ${F.id}`,
    `${A.id} => ${B.id}`,
    `${A.id} => ${B.id} => ${B1.id}`,
    `${A.id} => ${B.id} => ${B2.id}`,
    `${A.id} => ${C.id}`,
    `${A.id} => ${C.id} => ${C1.id}`,
    `${A.id} => ${C.id} => ${C2.id}`,
    `${A.id} => ${D.id}`,
    `${A.id} => ${D.id} => ${D1.id}`,
    `${A.id} => ${D.id} => ${D2.id}`
  ], Utils.treeStructure(Object.values(tabs)),
     'tabs should be ordered like Firefox does');
}

