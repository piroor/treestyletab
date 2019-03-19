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

import EventListenerManager from '/extlib/EventListenerManager.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/sidebar', ...args);
}

export const onMessage = new EventListenerManager();
export const onConnected = new EventListenerManager();
export const onDisconnected = new EventListenerManager();

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
    return false;

  if (message.windowId) {
    const port = mOpenState.get(message.windowId);
    if (!port)
      return false;
    port.postMessage(message);
    return true;
  }

  // broadcast
  for (const port of mOpenState.values()) {
    port.postMessage(message);
  }
  return true;
}

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
    const receiver = message => onMessage.dispatch(windowId, message);
    port.onMessage.addListener(receiver);
    mReceivers.set(windowId, receiver);
    onConnected.dispatch(windowId);
    port.onDisconnect.addListener(_message => {
      mOpenState.delete(windowId);
      port.onMessage.removeListener(receiver);
      mReceivers.delete(windowId);
      mFocusState.delete(windowId);
      onDisconnected.dispatch(windowId);
    });
  });
}

onMessage.addListener(async (windowId, message) => {
  switch (message.type) {
    case Constants.kNOTIFY_SIDEBAR_FOCUS:
      mFocusState.set(windowId, true);
      break;

    case Constants.kNOTIFY_SIDEBAR_BLUR:
      mFocusState.delete(windowId);
      break;
  }
});
