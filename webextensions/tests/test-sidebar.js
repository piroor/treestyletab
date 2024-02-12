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
import { is, ok, ng } from '/tests/assert.js';
//import Tab from '/common/Tab.js';

import * as Constants from '/common/constants.js';
import * as Utils from './utils.js';

let win, sidebar;

export async function setup() {
  win = await browser.windows.create({
    width:  600,
    height: 500,
  });
  await wait(250); // wait until the window is tracked
  sidebar = await browser.windows.create({
    url:    `${Constants.kSHORTHAND_URIS.tabbar}?windowId=${win.id}`,
    width:  600,
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


function getAllPinnedTabsRect() {
  return browser.runtime.sendMessage({
    type:        Constants.kCOMMAND_GET_BOUNDING_CLIENT_RECT,
    windowId:    win.id,
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
    C: { index: 2, pinned: true },
    D: { index: 3, pinned: true },
    E: { index: 4, pinned: true },
    F: { index: 5, pinned: true },
    G: { index: 6, pinned: true },
  }, { windowId: win.id });

  let [pinnedTabRect, allPinnedTabsRect] = await Promise.all([ // eslint-disable-line prefer-const
    browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_GET_BOUNDING_CLIENT_RECT,
      windowId: win.id,
      selector: 'tab-item:nth-child(1).pinned',
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

async function isNormalTabsOverflow() {
  const rect = await browser.runtime.sendMessage({
    type:     Constants.kCOMMAND_GET_BOUNDING_CLIENT_RECT,
    windowId: win.id,
    selector: '#normal-tabs-container.overflow',
  });
  return !!rect;
}

export async function testTabbarOverflow() {
  await wait(250);
  ng(await isNormalTabsOverflow(),
     'initially the tab bar should not be overflowed');

  const tabs = await Utils.prepareTabsInWindow(
    { A: { index: 0 },
      B: { index: 1, openerTabId: 'A' },
      C: { index: 2, openerTabId: 'A' },
      D: { index: 3, openerTabId: 'A' },
      E: { index: 4, openerTabId: 'A' },
      F: { index: 5, openerTabId: 'A' },
      G: { index: 6, openerTabId: 'A' },
      H: { index: 7, openerTabId: 'A' },
      I: { index: 8, openerTabId: 'A' },
      J: { index: 9, openerTabId: 'A' },
      K: { index: 10, openerTabId: 'A' },
      L: { index: 11, openerTabId: 'A' },
      M: { index: 12, openerTabId: 'A' },
      N: { index: 13, openerTabId: 'A' },
      O: { index: 14, openerTabId: 'A' },
      P: { index: 15, openerTabId: 'A' },
      Q: { index: 16, openerTabId: 'A' },
      R: { index: 17, openerTabId: 'A' },
      S: { index: 18, openerTabId: 'A' },
      T: { index: 19, openerTabId: 'A' },
      U: { index: 20, openerTabId: 'A' },
      V: { index: 21, openerTabId: 'A' },
      W: { index: 22, openerTabId: 'A' },
      X: { index: 23, openerTabId: 'A' },
      Y: { index: 24, openerTabId: 'A' },
      Z: { index: 25, openerTabId: 'A' } },
    win.id,
    [ 'A',
      'A => B',
      'A => C',
      'A => D',
      'A => E',
      'A => F',
      'A => G',
      'A => H',
      'A => I',
      'A => J',
      'A => K',
      'A => L',
      'A => M',
      'A => N',
      'A => O',
      'A => P',
      'A => Q',
      'A => R',
      'A => S',
      'A => T',
      'A => U',
      'A => V',
      'A => W',
      'A => X',
      'A => Y',
      'A => Z' ]
  );
  await wait(500);

  ok(await isNormalTabsOverflow(),
     'the tab bar should be overflowed for many tabs');

  await browser.runtime.sendMessage({
    type:  'treestyletab:api:collapse-tree',
    tabId: tabs.A.id
  });
  await wait(1000);
  ng(await isNormalTabsOverflow(),
     'the tab bar should not be overflowed after the tree is collapsed');
}
