/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/resources/dialog/RichConfirmWithUserStyles.js';

import {
  log as internalLogger,
  configs,
  isMacOS,
} from '/common/common.js';

import * as ApiTabs from './api-tabs.js';
import * as Constants from './constants.js';
import * as SidebarConnection from './sidebar-connection.js';
import * as UserOperationBlocker from './user-operation-blocker.js';

function log(...args) {
  internalLogger('common/dialog', ...args);
}

export async function show({ ownerWindow, params, controller }) {
  if (!controller)
    controller = RichConfirm;
  let result;
  let unblocked = false;
  try {
    if (configs.showDialogInSidebar &&
        SidebarConnection.isOpen(ownerWindow.id)/* &&
        SidebarConnection.hasFocus(ownerWindow.id)*/) {
      UserOperationBlocker.blockIn(ownerWindow.id, { throbber: false });
      result = await browser.runtime.sendMessage({
        type:                       Constants.kCOMMAND_SHOW_DIALOG,
        windowId:                   ownerWindow.id,
        userOperationBlockerParams: { throbber: false },
        controller:                 controller.name,
        params:                     {
          ...params,
          sidebar: true,
        },
      }).catch(ApiTabs.createErrorHandler());
    }
    else {
      log('showDialog: show in a popup window on ', ownerWindow.id);
      params.forceInTab = configs.forceOpenDialogInTab || (isMacOS() && ownerWindow.state == 'fullscreen');
      params.modal      = !configs.debug;
      UserOperationBlocker.blockIn(ownerWindow.id, { throbber: false, shade: params.forceInTab });
      result = await controller.showInPopup(ownerWindow.id, params);
      UserOperationBlocker.unblockIn(ownerWindow.id, { throbber: false });
      unblocked = true;
    }
  }
  catch(error) {
    console.error(error);
    result = { buttonIndex: -1 };
  }
  finally {
    if (!unblocked)
      UserOperationBlocker.unblockIn(ownerWindow.id, { throbber: false });
  }
  return result;
}
