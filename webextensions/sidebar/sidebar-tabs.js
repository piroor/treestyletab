/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from '../common/constants.js';

export function getTabTwisty(aTab) {
  return aTab.querySelector(`.${Constants.kTWISTY}`);
}

export function getTabFavicon(aTab) {
  return aTab.querySelector(`.${Constants.kFAVICON}`);
}

export function getTabThrobber(aTab) {
  return aTab.querySelector(`.${Constants.kTHROBBER}`);
}

export function getTabSoundButton(aTab) {
  return aTab.querySelector(`.${Constants.kSOUND_BUTTON}`);
}

export function getTabCounter(aTab) {
  return aTab.querySelector(`.${Constants.kCOUNTER}`);
}

export function getTabClosebox(aTab) {
  return aTab.querySelector(`.${Constants.kCLOSEBOX}`);
}
