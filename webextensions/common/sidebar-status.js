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
import * as TSTAPI from './tst-api.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/sidebar-status', ...args);
}

let mOpenState;
const mFocusState = new Map();

export function isOpen(windowId) {
  return mOpenState && mOpenState.has(windowId)
}

export function isWatchingOpenState() {
  return !!mOpenState;
}

export function hasFocus(windowId) {
  return mFocusState.has(windowId)
}

browser.runtime.onMessage.addListener((message, _sender) => {
  if (!message ||
      typeof message.type != 'string')
    return;

  switch (message.type) {
    case Constants.kNOTIFY_SIDEBAR_FOCUS:
      mFocusState.set(message.windowId, true);
      break;

    case Constants.kNOTIFY_SIDEBAR_BLUR:
      mFocusState.delete(message.windowId);
      break;
  }
});

export function startWatchOpenState() {
  if (isWatchingOpenState())
    return;
  mOpenState = new Map();
  const matcher = new RegExp(`^${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}`);
  browser.runtime.onConnect.addListener(port => {
    if (!matcher.test(port.name))
      return;
    const windowId = parseInt(port.name.replace(matcher, ''));
    mOpenState.set(windowId, true);
    TSTAPI.sendMessage({
      type:   TSTAPI.kNOTIFY_SIDEBAR_SHOW,
      window: windowId
    });
    port.onDisconnect.addListener(_message => {
      mOpenState.delete(windowId);
      mFocusState.delete(windowId);
      TSTAPI.sendMessage({
        type:   TSTAPI.kNOTIFY_SIDEBAR_HIDE,
        window: windowId
      });
    });
  });
}
