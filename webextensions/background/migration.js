/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';

import ShortcutCustomizeUI from '/extlib/ShortcutCustomizeUI.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('background/migration', ...args);
}

const kCONFIGS_VERSION = 3;
const kFEATURES_VERSION = 3;

export function migrateConfigs() {
  switch (configs.configsVersion) {
    case 0:
      ShortcutCustomizeUI.setDefaultShortcuts();

    case 1:
      configs.longPressDuration = configs.startDragTimeout;
      configs.emulateDefaultContextMenu = configs.emulateDefaultContextMenu;

    case 2:
      if (!configs.simulateSelectOwnerOnClose)
        configs.successorTabControlLevel = Constants.kSUCCESSOR_TAB_CONTROL_NEVER;
  }
  configs.configsVersion = kCONFIGS_VERSION;
}

export async function notifyNewFeatures() {
  /*
  let featuresVersionOffset = 0;
  const browserInfo = await browser.runtime.getBrowserInfo().catch(ApiTabs.createErrorHandler());
  // "search" permission becomes available!
  if (parseInt(browserInfo.version.split('.')[0]) >= 63)
    featuresVersionOffset++;
  // "menus.overrideContext" permission becomes available!
  if (parseInt(browserInfo.version.split('.')[0]) >= 64)
    featuresVersionOffset++;
  */

  const featuresVersion = kFEATURES_VERSION /*+ featuresVersionOffset*/;

  if (configs.notifiedFeaturesVersion >= featuresVersion)
    return;
  configs.notifiedFeaturesVersion = featuresVersion;

  browser.tabs.create({
    url:    Constants.kSHORTHAND_URIS.startup,
    active: true
  }).catch(ApiTabs.createErrorSuppressor());
}
