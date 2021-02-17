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

