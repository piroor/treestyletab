/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from '/common/constants.js';
import * as Background from './background.js';

let mCount = 0;

export function increment() {
  mCount++;
}

export function decrement() {
  mCount--;
}

export function hasMultipleRestoringTabs() {
  return mCount > 1;
}

Background.onMessage.addListener(async message => {
  switch (message.type) {
    case Constants.kCOMMAND_NOTIFY_TAB_RESTORING:
      increment();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORED:
      decrement();
      break;
  }
});
