/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/extlib/RichConfirm.js';

import {
  log as internalLogger,
  configs,
  isMacOS,
  sanitizeForHTMLText,
} from '/common/common.js';

import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as SidebarConnection from './sidebar-connection.js';
import * as UserOperationBlocker from './user-operation-blocker.js';
import Tab from './Tab.js';

function log(...args) {
  internalLogger('common/dialog', ...args);
}

export async function show(ownerWindow, dialogParams) {
  let result;
  let unblocked = false;
  try {
    if (configs.showDialogInSidebar &&
        SidebarConnection.isOpen(ownerWindow.id)/* &&
        SidebarConnection.hasFocus(ownerWindow.id)*/) {
      UserOperationBlocker.blockIn(ownerWindow.id, { throbber: false });
      result = await browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SHOW_DIALOG,
        params:   {
          ...dialogParams,
          onShown: null,
          onShownInTab: null,
          onShownInPopup: null,
          userOperationBlockerParams: { throbber: false },
        },
        windowId: ownerWindow.id
      }).catch(ApiTabs.createErrorHandler());
    }
    else if (isMacOS() &&
             ownerWindow.state == 'fullscreen') {
      // on macOS, a popup window opened from a fullscreen browser window is always
      // opened as a new fullscreen window, thus we need to fallback to a workaround.
      log('showDialog: show in a temporary tab in ', ownerWindow.id);
      UserOperationBlocker.blockIn(ownerWindow.id, { throbber: false, shade: true });
      const tempTab = await browser.tabs.create({
        windowId: ownerWindow.id,
        url:      '/resources/blank.html',
        active:   true
      });
      await Tab.waitUntilTracked(tempTab.id).then(() => {
        Tab.get(tempTab.id).$TST.addState('hidden', { broadcast: true });
      });
      result = await RichConfirm.showInTab(tempTab.id, {
        ...dialogParams,
        onShown: [
          container => {
            const style = container.closest('.rich-confirm-dialog').style;
            style.maxWidth = `${Math.floor(window.innerWidth * 0.6)}px`;
            style.marginLeft = style.marginRight = 'auto';
          },
          dialogParams.onShownInTab || dialogParams.onShown
        ],
        onHidden(...params) {
          UserOperationBlocker.unblockIn(ownerWindow.id, { throbber: false });
          unblocked = true;
          if (typeof dialogParams.onHidden == 'function')
            dialogParams.onHidden(...params);
        },
      });
      browser.tabs.remove(tempTab.id);
    }
    else {
      log('showDialog: show in a popup window on ', ownerWindow.id);
      UserOperationBlocker.blockIn(ownerWindow.id, { throbber: false });
      browser.runtime.onMessage.addListener(function onMessage(message, sender) {
        switch (message.type) {
          case Constants.kNOTIFY_CONFIRMATION_DIALOG_READY:
            browser.runtime.onMessage.removeListener(onMessage);
            tryRepositionDialogToCenterOfOwner({
              ...message,
              dialogWindowId: sender.tab.windowId,
            });
            break;
        }
      });
      const callback = dialogParams.onShownInPopup || dialogParams.onShown;
      result = await RichConfirm.showInPopup(ownerWindow.id, {
        ...dialogParams,
        inject: {
          ...(dialogParams.inject || {}),
          __dialog__reportScreenMessageType: Constants.kNOTIFY_CONFIRMATION_DIALOG_READY,
          __dialog__ownerWindowId: ownerWindow.id,
        },
        onShown: [
          ...(Array.isArray(callback) ? callback : [callback]),
          (container, { __dialog__reportScreenMessageType, __dialog__ownerWindowId }) => {
            setTimeout(() => {
              // We cannot move this window by this callback function, thus I just send
              // a request to update window position.
              browser.runtime.sendMessage({
                type:          __dialog__reportScreenMessageType,
                ownerWindowId: __dialog__ownerWindowId,
                availLeft:     screen.availLeft,
                availTop:      screen.availTop,
                availWidth:    screen.availWidth,
                availHeight:   screen.availHeight,
              });
            }, 0);
          },
        ],
        onHidden(...params) {
          UserOperationBlocker.unblockIn(ownerWindow.id, { throbber: false });
          unblocked = true;
          if (typeof dialogParams.onHidden == 'function')
            dialogParams.onHidden(...params);
        },
      });
    }
  }
  catch(_error) {
    result = { buttonIndex: -1 };
  }
  finally {
    if (!unblocked)
      UserOperationBlocker.unblockIn(ownerWindow.id, { throbber: false });
  }
  return result;
}

async function tryRepositionDialogToCenterOfOwner({ dialogWindowId, ownerWindowId, availLeft, availTop, availWidth, availHeight }) {
  const [dialogWin, ownerWin] = await Promise.all([
    browser.windows.get(dialogWindowId),
    browser.windows.get(ownerWindowId),
  ]);
  const placedOnOwner = (
    dialogWin.left + dialogWin.width - (dialogWin.width / 2) < ownerWin.left &&
    dialogWin.top + dialogWin.height - (dialogWin.height / 2) < ownerWin.top &&
    dialogWin.left + (dialogWin.width / 2) < ownerWin.left + ownerWin.width &&
    dialogWin.top + (dialogWin.height / 2) < ownerWin.top + ownerWin.height
  );
  const placedInsideViewArea = (
    dialogWin.left >= availLeft &&
    dialogWin.top >= availTop &&
    dialogWin.left + dialogWin.width <= availLeft + availWidth &&
    dialogWin.top + dialogWin.height <= availTop + availHeight
  );
  if (placedOnOwner && placedInsideViewArea)
    return;

  const top  = ownerWin.top + Math.round((ownerWin.height - dialogWin.height) / 2);
  const left = ownerWin.left + Math.round((ownerWin.width - dialogWin.width) / 2);
  return browser.windows.update(dialogWin.id, {
    left: Math.min(availLeft + availWidth - dialogWin.width, Math.max(availLeft, left)),
    top:  Math.min(availTop + availHeight - dialogWin.height, Math.max(availTop, top)),
  });
}

export function tabsToHTMLList(tabs, { maxHeight, maxWidth }) {
  const rootLevelOffset = tabs.map(tab => parseInt(tab.$TST.getAttribute(Constants.kLEVEL) || 0)).sort()[0];
  return (
    `<ul style="border: 1px inset;
                display: flex;
                flex-direction: column;
                flex-grow: 1;
                flex-shrink: 1;
                margin: 0.5em 0;
                min-height: 2em;
                max-height: calc(${maxHeight}px - 12em /* title bar, message, checkbox, buttons, and margins */);
                max-width: ${maxWidth}px;
                overflow: auto;
                padding: 0.5em;">` +
      tabs.map(tab => `<li style="align-items: center;
                                  display: flex;
                                  flex-direction: row;
                                  padding-left: calc((${tab.$TST.getAttribute(Constants.kLEVEL)} - ${rootLevelOffset}) * 0.25em);"
                           title="${sanitizeForHTMLText(tab.title)}"
                          ><img style="display: flex;
                                       max-height: 1em;
                                       max-width: 1em;"
                                alt=""
                                src="${sanitizeForHTMLText(tab.favIconUrl || browser.runtime.getURL('resources/icons/defaultFavicon.svg'))}"
                               ><span style="margin-left: 0.25em;
                                             overflow: hidden;
                                             text-overflow: ellipsis;
                                             white-space: nowrap;"
                                     >${sanitizeForHTMLText(tab.title)}</span></li>`).join('') +
      `</ul>`
  );
}
