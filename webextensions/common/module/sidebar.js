/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from './constants.js';
import * as TSTAPI from './tst-api.js';

let gOpenState;
let gFocusState = new Map();

export function isOpen(aWindowId) {
  return gOpenState && gOpenState.has(aWindowId)
}

export function isWatchingOpenState() {
  return !!gOpenState;
}

export function hasFocus(aWindowId) {
  return gFocusState.has(aWindowId)
}

export function onFocus(aWindowId) {
  gFocusState.set(aWindowId, true);
}

export function onBlur(aWindowId) {
  gFocusState.delete(aWindowId);
}

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
