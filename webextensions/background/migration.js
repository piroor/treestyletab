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

const kCONFIGS_VERSION = 6;
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

    case 3:
      if (!(configs.tabDragBehavior & Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK))
        configs.tabDragBehavior |= Constants.kDRAG_BEHAVIOR_TEAR_OFF;
      if (!(configs.tabDragBehaviorShift & Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK))
        configs.tabDragBehaviorShift |= Constants.kDRAG_BEHAVIOR_TEAR_OFF;

    case 4:
      configs.emulateDefaultContextMenu = true; // activate by default
      configs.context_topLevel_closeTree        = configs.context_closeTabOptions_closeTree;
      configs.context_topLevel_closeDescendants = configs.context_closeTabOptions_closeDescendants;
      configs.context_topLevel_closeOthers      = configs.context_closeTabOptions_closeOthers;

    case 5:
      switch (configs.scrollbarMode < 0 ? (/^Mac/i.test(navigator.platform) ? 3 : 1) : configs.scrollbarMode) {
        case 0: // default, refular width
          configs.userStyleRules += `

/* regular width scrollbar */
#tabbar { scrollbar-width: auto; }`;
          break;
        case 1: // narrow width
          break;
        case 2: // hide
          configs.userStyleRules += `

/* hide scrollbar */
#tabbar { scrollbar-width: none; }

/* cancel spaces for macOS overlay scrollbar */
:root.platform-mac #tabbar:dir(rtl).overflow .tab:not(.pinned) {
  padding-left: 0;
}
:root.platform-mac #tabbar:dir(ltr).overflow .tab:not(.pinned) {
  padding-right: 0;
}`;
          break;
        case 3: // overlay (macOS)
          break;
      }
      switch (configs.sidebarScrollbarPosition) {
        default:
        case 0: // auto
        case 1: // left
          break;
          break;
        case 2: // right
          configs.userStyleRules += `

/* put scrollbar rightside */
:root.left #tabbar { direction: ltr; }`;
          break;
        case 3: // overlay (macOS)
          break;
      }
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

  return browser.tabs.create({
    url:    Constants.kSHORTHAND_URIS.startup,
    active: true
  }).catch(ApiTabs.createErrorSuppressor());
}
