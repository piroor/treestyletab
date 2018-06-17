/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as TSTAPI from './tst-api.js';

function log(...aArgs) {
  if (configs.logFor['common/sidebar-status'])
    internalLogger(...aArgs);
}

let gOpenState;
const gFocusState = new Map();

export function isOpen(aWindowId) {
  return gOpenState && gOpenState.has(aWindowId)
}

export function isWatchingOpenState() {
  return !!gOpenState;
}

export function hasFocus(aWindowId) {
  return gFocusState.has(aWindowId)
}

browser.runtime.onMessage.addListener((aMessage, _aSender) => {
  if (!aMessage ||
      typeof aMessage.type != 'string')
    return;

  switch (aMessage.type) {
    case Constants.kNOTIFY_SIDEBAR_FOCUS:
      gFocusState.set(aMessage.windowId, true);
      break;

    case Constants.kNOTIFY_SIDEBAR_BLUR:
      gFocusState.delete(aMessage.windowId);
      break;
  }
});

export function startWatchOpenState() {
  if (isWatchingOpenState())
    return;
  gOpenState = new Map();
  const matcher = new RegExp(`^${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}`);
  browser.runtime.onConnect.addListener(aPort => {
    if (!matcher.test(aPort.name))
      return;
    const windowId = parseInt(aPort.name.replace(matcher, ''));
    gOpenState.set(windowId, true);
    TSTAPI.sendMessage({
      type:   TSTAPI.kNOTIFY_SIDEBAR_SHOW,
      window: windowId
    });
    aPort.onDisconnect.addListener(_aMessage => {
      gOpenState.delete(windowId);
      gFocusState.delete(windowId);
      TSTAPI.sendMessage({
        type:   TSTAPI.kNOTIFY_SIDEBAR_HIDE,
        window: windowId
      });
    });
  });
}
