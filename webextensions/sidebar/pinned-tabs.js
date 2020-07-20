/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2019
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import {
  log as internalLogger,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';
import Tab from '/common/Tab.js';
import * as Size from './size.js';
import * as BackgroundConnection from './background-connection.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('sidebar/pinned-tabs', ...args);
}

let mTargetWindow;
let mTabBar;

export function init() {
  mTargetWindow = TabsStore.getCurrentWindowId();
  mTabBar       = document.querySelector('#tabbar');
  configs.$addObserver(onConfigChange);
}

export function reposition(options = {}) {
  //log('reposition');
  const pinnedTabs = Tab.getPinnedTabs(mTargetWindow);
  if (pinnedTabs.length == 0) {
    reset();
    document.documentElement.classList.remove('have-pinned-tabs');
    return;
  }

  document.documentElement.classList.add('have-pinned-tabs');

  const containerWidth = mTabBar.getBoundingClientRect().width;
  const maxWidth       = containerWidth;
  const faviconized    = configs.faviconizePinnedTabs;

  const width  = faviconized ? Size.getFavIconizedTabSize() : maxWidth + Size.getTabXOffset();
  const height = faviconized ? Size.getFavIconizedTabSize() : Size.getTabHeight() + Size.getTabYOffset();
  const maxCol = faviconized ? Math.max(1, configs.maxFaviconizedPinnedTabsInOneRow > 0 ? configs.maxFaviconizedPinnedTabsInOneRow : Math.floor(maxWidth / width)) : 1;
  const maxRow = Math.ceil(pinnedTabs.length / maxCol);
  let col    = 0;
  let row    = 0;

  mTabBar.style.marginTop = `${height * maxRow + (faviconized ? 0 : Size.getTabYOffset())}px`;
  for (const tab of pinnedTabs) {
    const style = tab.$TST.element.style;
    if (options.justNow)
      tab.$TST.removeState(Constants.kTAB_STATE_ANIMATION_READY);

    if (faviconized)
      tab.$TST.addState(Constants.kTAB_STATE_FAVICONIZED);
    else
      tab.$TST.removeState(Constants.kTAB_STATE_FAVICONIZED);

    if (row == maxRow - 1)
      tab.$TST.addState(Constants.kTAB_STATE_LAST_ROW);
    else
      tab.$TST.removeState(Constants.kTAB_STATE_LAST_ROW);

    style.bottom = 'auto';
    style.left   = `${width * col}px`;
    style.right  = faviconized ? 'auto' : 0 ;
    style.top    = `${height * row}px`;

    if (options.justNow)
      tab.$TST.addState(Constants.kTAB_STATE_ANIMATION_READY);

    /*
    log('pinned tab: ', {
      tab:    dumpTab(tab),
      col:    col,
      width:  width,
      height: height
    });
    */

    col++;
    if (col >= maxCol) {
      col = 0;
      row++;
      //log('=> new row');
    }
  }
}

export function reserveToReposition(options = {}) {
  if (reserveToReposition.waiting)
    clearTimeout(reserveToReposition.waiting);
  reserveToReposition.waiting = setTimeout(() => {
    delete reserveToReposition.waiting;
    reposition(options);
  }, 10);
}

function reset() {
  mTabBar.style.marginTop = '';
  for (const tab of Tab.getPinnedTabs(mTargetWindow, { iterator: true })) {
    clearStyle(tab);
  }
}

function clearStyle(tab) {
  tab.$TST.removeState(Constants.kTAB_STATE_FAVICONIZED);
  tab.$TST.removeState(Constants.kTAB_STATE_LAST_ROW);
  const style = tab.$TST.element.style;
  style.left = style.right = style.top = style.bottom;
}

const BUFFER_KEY_PREFIX = 'pinned-tabs-';

BackgroundConnection.onMessage.addListener(async message => {
  switch (message.type) {
    case Constants.kCOMMAND_NOTIFY_TAB_CREATED: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      if (!tab)
        return;
      if (tab.pinned)
        reserveToReposition();
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_REMOVING:
    case Constants.kCOMMAND_NOTIFY_TAB_MOVED:
    case Constants.kCOMMAND_NOTIFY_TAB_INTERNALLY_MOVED: {
      // don't wait until tracked here, because removing or detaching tab will become untracked!
      const tab = Tab.get(message.tabId);
      if (tab && tab.pinned)
        reserveToReposition();
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_SHOWN:
    case Constants.kCOMMAND_NOTIFY_TAB_HIDDEN:
      reserveToReposition();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_DETACHED_FROM_WINDOW:
      if (message.wasPinned)
        reserveToReposition();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_PINNED:
    case Constants.kCOMMAND_NOTIFY_TAB_UNPINNED: {
      if (BackgroundConnection.handleBufferedMessage({ type: 'pinned/unpinned', message }, `${BUFFER_KEY_PREFIX}${message.tabId}`))
        return;
      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      const lastMessage = BackgroundConnection.fetchBufferedMessage('pinned/unpinned', `${BUFFER_KEY_PREFIX}${message.tabId}`);
      if (!tab ||
          !lastMessage)
        return;
      if (lastMessage.message.type == Constants.kCOMMAND_NOTIFY_TAB_UNPINNED)
        clearStyle(tab);
      reserveToReposition();
    }; break;
  }
});

function onConfigChange(key) {
  switch (key) {
    case 'faviconizePinnedTabs':
      reserveToReposition();
      break;
  }
}
