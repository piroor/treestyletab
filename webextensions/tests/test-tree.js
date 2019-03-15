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

import * as Utils from './utils.js';

let win;

export async function setup() {
  win = await browser.windows.create();
}

export async function teardown() {
  await browser.windows.remove(win.id);
  win = null;
}


export async function testAutoFixupForHiddenTabs() {
  await Utils.setConfigs({
    fixupTreeOnTabVisibilityChanged: true,
    inheritContextualIdentityToNewChildTab: false,
    inheritContextualIdentityToSameSiteOrphan: false
  });

  let tabs;

  /*
  - A
    - B (with the "Personal" container)
      - C (with the "Personal" container)
        - D
          - E
    - F (with the "Personal" container)
      - G (with the "Personal" container)
    - H
  */
  tabs = await Utils.createTabs({
    A: { index: 1, cookieStoreId: 'firefox-default' },
    B: { index: 2, cookieStoreId: 'firefox-container-1', openerTabId: 'A' },
    C: { index: 3, cookieStoreId: 'firefox-container-1', openerTabId: 'B' },
    D: { index: 4, cookieStoreId: 'firefox-default', openerTabId: 'C' },
    E: { index: 5, cookieStoreId: 'firefox-default', openerTabId: 'D' },
    F: { index: 6, cookieStoreId: 'firefox-container-1', openerTabId: 'A' },
    G: { index: 7, cookieStoreId: 'firefox-container-1', openerTabId: 'F' },
    H: { index: 8, cookieStoreId: 'firefox-default', openerTabId: 'A' }
  }, { windowId: win.id });

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E, F, G, H } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${A.id} => ${B.id} => ${C.id} => ${D.id}`,
      `${A.id} => ${B.id} => ${C.id} => ${D.id} => ${E.id}`,
      `${A.id} => ${F.id}`,
      `${A.id} => ${F.id} => ${G.id}`,
      `${A.id} => ${H.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'tabs must be initialized with specified structure');

    await new Promise(resolve => {
      // wait until tabs are updated by TST
      let count = 0;
      const onUpdated = (tabId, changeInfo, _tab) => {
        if ('hidden' in changeInfo)
          count++;
        if (count == 4)
          resolve();
      };
      browser.tabs.onUpdated.addListener(onUpdated);
      browser.tabs.hide([B.id, C.id, F.id, G.id]);
    });
    await wait(1000);
  }

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E, F, G, H } = tabs;
    is([
      `${A.id}`,
      `${B.id}`,
      `${B.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${A.id} => ${D.id} => ${E.id}`,
      `${F.id}`,
      `${F.id} => ${G.id}`,
      `${A.id} => ${H.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'hidden tabs must be detached from the tree');

    await new Promise(resolve => {
      // wait until tabs are updated by TST
      let count = 0;
      const onUpdated = (tabId, changeInfo, _tab) => {
        if ('hidden' in changeInfo)
          count++;
        if (count == 4)
          resolve();
      };
      browser.tabs.onUpdated.addListener(onUpdated);
      browser.tabs.show([B.id, C.id, F.id, G.id]);
    });
    await wait(1000);
  }

  tabs = await Utils.refreshTabs(tabs);
  {
    const { A, B, C, D, E, F, G, H } = tabs;
    is([
      `${A.id}`,
      `${A.id} => ${B.id}`,
      `${A.id} => ${B.id} => ${C.id}`,
      `${A.id} => ${D.id}`,
      `${A.id} => ${D.id} => ${E.id}`,
      `${A.id} => ${F.id}`,
      `${A.id} => ${F.id} => ${G.id}`,
      `${A.id} => ${H.id}`
    ], Utils.treeStructure(Object.values(tabs)),
       'shown tabs must be attached to the tree');
  }
}

