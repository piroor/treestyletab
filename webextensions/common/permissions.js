/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from './constants.js';
import {
  log as internalLogger,
  notify,
  configs
} from './common.js';

function log(...aArgs) {
  if (configs.logFor['common/permissions'])
    internalLogger(...aArgs);
}

export const BOOKMARKS = { permissions: ['bookmarks'] };
export const ALL_URLS = { origins: ['<all_urls>'] };

export function clearRequest() {
  configs.requestingPermissions = null;
}

export function isGranted(aPermissions) {
  try {
    return browser.permissions.contains(aPermissions);
  }
  catch(_e) {
    return Promise.reject(new Error('unsupported permission'));
  }
}

export function bindToCheckbox(aPermissions, aCheckbox, aOptions = {}) {
  isGranted(aPermissions)
    .then(aGranted => {
      aCheckbox.checked = aGranted;
    })
    .catch(_aError => {
      aCheckbox.setAttribute('readonly', true);
      aCheckbox.setAttribute('disabled', true);
      var label = aCheckbox.closest('label') || document.querySelector(`label[for=${aCheckbox.id}]`);
      if (label)
        label.setAttribute('disabled', true);
    });

  aCheckbox.addEventListener('change', _aEvent => {
    aCheckbox.requestPermissions()
  });

  browser.runtime.onMessage.addListener((aMessage, _aSender) => {
    if (!aMessage ||
        !aMessage.type ||
        aMessage.type != Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED ||
        JSON.stringify(aMessage.permissions) != JSON.stringify(aPermissions))
      return;
    if (aOptions.onChanged)
      aOptions.onChanged(true);
    aCheckbox.checked = true;
  });

  /*
  // These events are not available yet on Firefox...
  browser.permissions.onAdded.addListener(aAddedPermissions => {
    if (aAddedPermissions.permissions.includes('...'))
      aCheckbox.checked = true;
  });
  browser.permissions.onRemoved.addListener(aRemovedPermissions => {
    if (aRemovedPermissions.permissions.includes('...'))
      aCheckbox.checked = false;
  });
  */

  aCheckbox.requestPermissions = async () => {
    try {
      if (!aCheckbox.checked) {
        await browser.permissions.remove(aPermissions);
        if (aOptions.onChanged)
          aOptions.onChanged(false);
        return;
      }

      var granted = await isGranted(aPermissions);
      if (granted) {
        aOptions.onChanged(true);
        return;
      }

      configs.requestingPermissions = aPermissions;
      aCheckbox.checked = false;
      browser.browserAction.setBadgeText({ text: '!' });
      browser.browserAction.setPopup({ popup: '' });

      notify({
        title:   browser.i18n.getMessage('config_requestPermissions_fallbackToToolbarButton_title'),
        message: browser.i18n.getMessage('config_requestPermissions_fallbackToToolbarButton_message'),
        icon:    'resources/24x24.svg'
      });
      return;

      /*
      // following codes don't work as expected due to https://bugzilla.mozilla.org/show_bug.cgi?id=1382953
      if (!await browser.permissions.request(aPermissions)) {
        aCheckbox.checked = false;
        return;
      }
      */
    }
    catch(aError) {
      console.log(aError);
    }
    aCheckbox.checked = false;
  };
}

export function requestPostProcess() {
  if (!configs.requestingPermissions)
    return false;

  var permissions = configs.requestingPermissions;
  configs.requestingPermissions = null;
  browser.browserAction.setBadgeText({ text: '' });
  browser.permissions.request(permissions).then(aGranted => {
    log('permission requested: ', permissions, aGranted);
    if (aGranted)
      browser.runtime.sendMessage({
        type:        Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED,
        permissions: permissions
      });
  });
  return true;
}

