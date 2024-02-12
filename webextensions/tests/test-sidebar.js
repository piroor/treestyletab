/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  wait,
  //configs,
} from '/common/common.js';
import { is /*, ok, ng*/ } from '/tests/assert.js';
//import Tab from '/common/Tab.js';

import * as Constants from '/common/constants.js';
import * as Utils from './utils.js';

let win, sidebar;

export async function setup() {
  win = await browser.windows.create();
  await wait(250); // wait until the window is tracked
  sidebar = await browser.windows.create({
    url: `${Constants.kSHORTHAND_URIS.tabbar}?windowId=${win.id}`,
    width: 600,
    height: 500,
  });

  const startAt = Date.now();
  while (true) {
    try {
      const pong = await browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_PING_TO_SIDEBAR,
        windowId: win.id,
      });
      if (pong)
        break;
    }
    catch(_error) {
    }
    if (Date.now() - startAt > 1000)
      throw new Error('timeout: failed to initialize sidebar within 1 sec');
    await wait(100);
  }
}

export async function teardown() {
  await browser.windows.remove(sidebar.id);
  await browser.windows.remove(win.id);
  win = null;
}


function getAllPinnedTabsRect(windowId) {
  return browser.runtime.sendMessage({
    type:        Constants.kCOMMAND_GET_BOUNDING_CLIENT_RECT,
    windowId,
    startBefore: 'tab-item:nth-child(1).pinned',
    endAfter:    'tab-item:nth-child(7).pinned',
  });
}

export async function testMaxFaviconizedPinnedTabsInOneRow() {
  await Utils.setConfigs({
    faviconizePinnedTabs:             true,
    maxFaviconizedPinnedTabsInOneRow: 0,
  });
  await wait(250);

  await Utils.createTabs({
    A: { index: 0, pinned: true },
    B: { index: 1, pinned: true },
    C: { index: 1, pinned: true },
    D: { index: 1, pinned: true },
    E: { index: 1, pinned: true },
    F: { index: 1, pinned: true },
    G: { index: 1, pinned: true },
  }, { windowId: win.id });

  let [pinnedTabRect, allPinnedTabsRect] = await Promise.all([ // eslint-disable-line prefer-const
    browser.runtime.sendMessage({
      type:        Constants.kCOMMAND_GET_BOUNDING_CLIENT_RECT,
      windowId:    win.id,
      startBefore: 'tab-item:nth-child(1).pinned',
      endAfter:    'tab-item:nth-child(1).pinned',
    }),
    getAllPinnedTabsRect(win.id),
  ]);
  is(pinnedTabRect.width * 7,
     allPinnedTabsRect.width,
     'all pinned tabs should be shown in a row');

  await Utils.setConfigs({
    maxFaviconizedPinnedTabsInOneRow: 1,
  });
  await wait(250);
  allPinnedTabsRect = await getAllPinnedTabsRect(win.id);
  is(pinnedTabRect.width * 1,
     allPinnedTabsRect.width,
     'one pinned tab should be shown in a row');

  await Utils.setConfigs({
    maxFaviconizedPinnedTabsInOneRow: 2,
  });
  await wait(250);
  allPinnedTabsRect = await getAllPinnedTabsRect(win.id);
  is(pinnedTabRect.width * 2,
     allPinnedTabsRect.width,
     'two pinned tab should be shown in a row');

  await Utils.setConfigs({
    maxFaviconizedPinnedTabsInOneRow: 3,
  });
  await wait(250);
  allPinnedTabsRect = await getAllPinnedTabsRect(win.id);
  is(pinnedTabRect.width * 3,
     allPinnedTabsRect.width,
     'three pinned tab should be shown in a row');

  await Utils.setConfigs({
    maxFaviconizedPinnedTabsInOneRow: -1,
  });
  await wait(250);
  allPinnedTabsRect = await getAllPinnedTabsRect(win.id);
  is(pinnedTabRect.width * 7,
     allPinnedTabsRect.width,
     'all pinned tab should be shown in a row for a negative value');
}
