/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  mapAndFilterUniq,
  configs
} from './common.js';
import * as Constants from './constants.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/sidebar-connection', ...args);
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

export const counts = {
  broadcast: {}
};

export function getOpenWindowIds() {
  return mOpenState ? Array.from(mOpenState.keys()) : [];
}

export function sendMessage(message) {
  if (!mOpenState)
    return false;

  if (message.windowId) {
    if (configs.loggingConnectionMessages) {
      counts[message.windowId] = counts[message.windowId] || {};
      const localCounts = counts[message.windowId];
      localCounts[message.type] = localCounts[message.type] || 0;
      localCounts[message.type]++;
    }
    const port = mOpenState.get(message.windowId);
    if (!port)
      return false;
    sendMessageToPort(port, message);
    //port.postMessage(message);
    return true;
  }

  // broadcast
  counts.broadcast[message.type] = counts.broadcast[message.type] || 0;
  counts.broadcast[message.type]++;
  for (const port of mOpenState.values()) {
    sendMessageToPort(port, message);
    //port.postMessage(message);
  }
  return true;
}

const mReservedTasks = new WeakMap();

// Se should not send messages immediately, instead we should throttle
// it and bulk-send multiple messages, for better user experience.
// Sending too much messages in one event loop may block everything
// and makes Firefox like frozen.
function sendMessageToPort(port, message) {
  const task = mReservedTasks.get(port) || { messages: [] };
  task.messages.push(message);
  mReservedTasks.set(port, task);
  if (!task.onFrame) {
    task.onFrame = () => {
      delete task.onFrame;
      const messages = task.messages;
      task.messages = [];
      port.postMessage(messages);
      if (configs.debug) {
        const types = mapAndFilterUniq(messages,
                                       message => message.type || undefined).join(', ');
        log(`${messages.length} messages sent (${types}):`, messages);
      }
    };
    // We should not use window.requestAnimationFrame for throttling,
    // because it is quite lagged on some environment. Firefox may
    // decelerate the method for an invisible document (the background
    // page).
    //window.requestAnimationFrame(task.onFrame);
    setTimeout(task.onFrame, 0);
  }
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
    const receiver = message => {
      if (Array.isArray(message))
        return message.forEach(receiver);
      onMessage.dispatch(windowId, message);
    };
    port.onMessage.addListener(receiver);
    mReceivers.set(windowId, receiver);
    onConnected.dispatch(windowId);
    port.onDisconnect.addListener(_diconnectedPort => {
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


//===================================================================
// Logging
//===================================================================

browser.runtime.onMessage.addListener((message, _sender) => {
  if (!message ||
      typeof message != 'object' ||
      message.type != Constants.kCOMMAND_REQUEST_CONNECTION_MESSAGE_LOGS ||
      !isInitialized())
    return;

  browser.runtime.sendMessage({
    type: Constants.kCOMMAND_RESPONSE_CONNECTION_MESSAGE_LOGS,
    logs: JSON.parse(JSON.stringify(counts))
  });
});
