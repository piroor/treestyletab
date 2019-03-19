/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from './common.js';
import * as Constants from './constants.js';
import * as TabsStore from './tabs-store.js';
import * as Sidebar from './sidebar.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/user-operation-blocker', ...args);
}

let mBlockingCount = 0;
let mBlockingThrobberCount = 0;

export function block(options = {}) {
  mBlockingCount++;
  document.documentElement.classList.add(Constants.kTABBAR_STATE_BLOCKING);
  if (options.throbber) {
    mBlockingThrobberCount++;
    document.documentElement.classList.add(Constants.kTABBAR_STATE_BLOCKING_WITH_THROBBER);
  }
}

export function blockIn(windowId, options = {}) {
  const targetWindow = TabsStore.getWindow();
  if (targetWindow && targetWindow != windowId)
    return;

  if (!targetWindow) {
    Sidebar.sendMessage({
      type:     Constants.kCOMMAND_BLOCK_USER_OPERATIONS,
      windowId,
      throbber: !!options.throbber
    });
    return;
  }
  block(options);
}

export function unblock(_options = {}) {
  mBlockingThrobberCount--;
  if (mBlockingThrobberCount < 0)
    mBlockingThrobberCount = 0;
  if (mBlockingThrobberCount == 0)
    document.documentElement.classList.remove(Constants.kTABBAR_STATE_BLOCKING_WITH_THROBBER);

  mBlockingCount--;
  if (mBlockingCount < 0)
    mBlockingCount = 0;
  if (mBlockingCount == 0)
    document.documentElement.classList.remove(Constants.kTABBAR_STATE_BLOCKING);
}

export function unblockIn(windowId, options = {}) {
  const targetWindow = TabsStore.getWindow();
  if (targetWindow && targetWindow != windowId)
    return;

  if (!targetWindow) {
    Sidebar.sendMessage({
      type:     Constants.kCOMMAND_UNBLOCK_USER_OPERATIONS,
      windowId,
      throbber: !!options.throbber
    });
    return;
  }
  unblock(options);
}

