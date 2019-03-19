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

import EventListenerManager from '/extlib/EventListenerManager.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/sidebar', ...args);
}

export const onResponse = new EventListenerManager();

let mOpenState;
const mReceivers = new Map();
const mFocusState = new Map();

export function isInitialized() {
  return !!mOpenState;
}

export function isOpen(windowId) {
  return mOpenState && mOpenState.has(windowId)
}

export function hasFocus(windowId) {
  return mFocusState.has(windowId)
}

export function sendMessage(message) {
  if (!mOpenState)
    throw new Error('not initialized yet');

  if (message.windowId) {
    mOpenState.get(message.windowId).postMessage(message);
    return;
  }

  // broadcast
  for (const port of mOpenState.values()) {
    port.postMessage(message);
  }
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

export function init() {
  if (isInitialized())
    return;
  mOpenState = new Map();
  const matcher = new RegExp(`^${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}`);
  browser.runtime.onConnect.addListener(port => {
    if (!matcher.test(port.name))
      return;
    const windowId = parseInt(port.name.replace(matcher, ''));
    mOpenState.set(windowId, port);
    const receiver = message => onResponse.dispatch(windowId, message);
    port.onMessage.addListener(receiver);
    mReceivers.set(windowId, receiver);
    TSTAPI.sendMessage({
      type:   TSTAPI.kNOTIFY_SIDEBAR_SHOW,
      window: windowId,
      windowId
    });
    port.onDisconnect.addListener(_message => {
      mOpenState.delete(windowId);
      port.onMessage.removeListener(receiver);
      mReceivers.delete(windowId);
      mFocusState.delete(windowId);
      TSTAPI.sendMessage({
        type:   TSTAPI.kNOTIFY_SIDEBAR_HIDE,
        window: windowId,
        windowId
      });
    });
  });
}
