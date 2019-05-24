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
import * as TSTAPI from '/common/tst-api.js';
//import Tab from '/common/Tab.js';

import * as Utils from './utils.js';

let win;

export async function setup() {
  win = await browser.windows.create();
}

export async function teardown() {
  await browser.windows.remove(win.id);
  win = null;
}


export async function testGroupMultiselectedTabs() {
  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2 },
    C: { index: 3 },
    D: { index: 4 }
  }, { windowId: win.id });

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D } = tabs;
    is([
      `${A.id}`,
      `${B.id}`,
      `${C.id}`,
      `${D.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');
  }

  await browser.tabs.highlight({
    windowId: win.id,
    tabs: [tabs.B.index, tabs.C.index]
  });
  await wait(500);

  const newTabs = await Utils.doAndGetNewTabs(async () => {
    await browser.runtime.sendMessage({
      type: TSTAPI.kCONTEXT_MENU_CLICK,
      info: {
        menuItemId: 'groupTabs'
      },
      tab: tabs.B.$TST.sanitized
    });
    await wait(1000);
  }, { windowId: win.id });

  is(1, newTabs.length,
     'new group tab must be opened');

  tabs.GroupTab = newTabs[0];
  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, GroupTab } = tabs;
    is([A.id, GroupTab.id, B.id, C.id, D.id],
       await Utils.tabsOrder([A, B, C, D, GroupTab]),
       'new group tab must be placed before the first multiselected tab');
    is([
      `${A.id}`,
      `${GroupTab.id}`,
      `${GroupTab.id} => ${B.id}`,
      `${GroupTab.id} => ${C.id}`,
      `${D.id}`
    ], Utils.treeStructure([A, GroupTab, B, C, D]),
       'multiselected tabs must be bundled under the group tab');
  }
}

export async function testCloseTabsToBottomTabs() {
  await Utils.setConfigs({
    warnOnCloseTabs: false
  });

  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2 },
    C: { index: 3 },
    D: { index: 4 }
  }, { windowId: win.id });

  tabs = await Utils.refreshTabs(tabs);
  await browser.runtime.sendMessage({
    type: TSTAPI.kCONTEXT_MENU_CLICK,
    info: {
      menuItemId: 'context_closeTabsToTheEnd'
    },
    tab: tabs.B.$TST.sanitized
  });
  await wait(1000);

  const afterTabs = await browser.tabs.query({ windowId: win.id });
  is([],
     afterTabs.map(tab => tab.id).filter(id => id == tabs.C.id || id == tabs.D.id),
     'tabs must be closed');
  is([tabs.A.id, tabs.B.id],
     afterTabs.map(tab => tab.id).filter(id => id == tabs.A.id || id == tabs.B.id),
     'specified tab must be open');
}

export async function testCloseOtherTabs() {
  await Utils.setConfigs({
    warnOnCloseTabs: false
  });

  let tabs = await Utils.createTabs({
    A: { index: 1 },
    B: { index: 2 },
    C: { index: 3 },
    D: { index: 4 }
  }, { windowId: win.id });

  tabs = await Utils.refreshTabs(tabs);
  await browser.runtime.sendMessage({
    type: TSTAPI.kCONTEXT_MENU_CLICK,
    info: {
      menuItemId: 'context_closeOtherTabs'
    },
    tab: tabs.B.$TST.sanitized
  });
  await wait(1000);

  const afterTabs = await browser.tabs.query({ windowId: win.id });
  is([],
     afterTabs.map(tab => tab.id).filter(id => id == tabs.A.id || id == tabs.C.id || id == tabs.D.id),
     'tabs must be closed');
  is([tabs.B.id],
     afterTabs.map(tab => tab.id).filter(id => id == tabs.B.id),
     'specified tab must be open');
}

