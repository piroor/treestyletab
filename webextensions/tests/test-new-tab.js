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


export async function testInheritContainerFromAutoAttachedParent() {
  await Utils.setConfigs({
    inheritContextualIdentityToNewChildTab: true,
    autoAttachOnNewTabCommand: Constants.kNEWTAB_OPEN_AS_CHILD
  });

  const parent = await browser.tabs.create({
    windowId: win.id,
    cookieStoreId: 'firefox-container-1'
  });
  const newTabs = await Utils.doAndGetNewTabs(async () => {
    await browser.tabs.create({
      windowId:      win.id,
      cookieStoreId: 'firefox-default'
    });
    await wait(500); // wait until new tab is reopened by TST
  }, { windowId: win.id });
  is({
    newTabsCount:    1,
    newTabParent:    parent.id,
    newTabContainer: 'firefox-container-1'
  }, {
    newTabsCount:    newTabs.length,
    newTabParent:    newTabs.length > 0 && newTabs[0].openerTabId,
    newTabContainer: newTabs.length > 0 && newTabs[0].cookieStoreId
  });
}

export async function testDoNotInheritContainerFromExplicitParent() {
  await Utils.setConfigs({
    inheritContextualIdentityToNewChildTab: true
  });

  const parent = await browser.tabs.create({
    windowId: win.id,
    cookieStoreId: 'firefox-container-1'
  });
  const newTabs = await Utils.doAndGetNewTabs(async () => {
    await browser.tabs.create({
      windowId:      win.id,
      cookieStoreId: 'firefox-default',
      openerTabId:   parent.id
    });
    await wait(500); // wait until new tab is reopened by TST
  }, { windowId: win.id });
  is({
    newTabsCount:    1,
    newTabParent:    parent.id,
    newTabContainer: 'firefox-default'
  }, {
    newTabsCount:    newTabs.length,
    newTabParent:    newTabs.length > 0 && newTabs[0].openerTabId,
    newTabContainer: newTabs.length > 0 && newTabs[0].cookieStoreId
  });
}

