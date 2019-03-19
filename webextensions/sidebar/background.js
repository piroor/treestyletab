/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('sidebar/background', ...args);
}

export const onMessage = new EventListenerManager();

let mConnectionPort = null;

export function connect() {
  mConnectionPort = browser.runtime.connect({
    name: `${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}${TabsStore.getWindow()}`
  });
  mConnectionPort.onMessage.addListener(onConnectionMessage);
}

export function sendMessage(message) {
  mConnectionPort.postMessage(message);
}

function onConnectionMessage(message) {
  switch (message.type) {
    case 'echo': // for testing
      mConnectionPort.postMessage(message);
      break;

    default:
      onMessage.dispatch(message);
      break;
  }
}
