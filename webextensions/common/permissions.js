/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const Permissions = {
  BOOKMARKS: { permissions: ['bookmarks'] },
  ALL_URLS:  { origins: ['<all_urls>'] },
  TAB_HIDE:  { permissions: ['tabHide'] },

  clearRequest() {
    configs.requestingPermissions = null;
  },

  isGranted(aPermissions) {
    try {
      return browser.permissions.contains(aPermissions);
    }
    catch(e) {
      return Promise.reject(new Error('unsupported permission'));
    }
  },

  bindToCheckbox(aPermissions, aCheckbox, aOptions = {}) {
    this.isGranted(aPermissions)
      .then(aGranted => {
        aCheckbox.checked = aGranted;
      })
      .catch(aError => {
        aCheckbox.setAttribute('readonly', true);
        aCheckbox.setAttribute('disabled', true);
      });

    aCheckbox.addEventListener('change', aEvent => {
      aCheckbox.requestPermissions()
    });

    browser.runtime.onMessage.addListener((aMessage, aSender) => {
      if (!aMessage ||
          !aMessage.type ||
          aMessage.type != kCOMMAND_NOTIFY_PERMISSIONS_GRANTED ||
          JSON.stringify(aMessage.permissions) != JSON.stringify(aPermissions))
        return;
      if (aOptions.onChanged)
        aOptions.onChanged(true);
      aCheckbox.checked = true;
    });

    /*
    // These events are not available yet on Firefox...
    browser.permissions.onAdded.addListener(aAddedPermissions => {
      if (aAddedPermissions.permissions.indexOf('...') > -1)
        aCheckbox.checked = true;
    });
    browser.permissions.onRemoved.addListener(aRemovedPermissions => {
      if (aRemovedPermissions.permissions.indexOf('...') > -1)
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

        var granted = await this.isGranted(aPermissions);
        if (granted) {
          aOptions.onChanged(true);
          return;
        }

        configs.requestingPermissions = aPermissions;
        aCheckbox.checked = false;
        browser.browserAction.setBadgeText({ text: '!' });
        browser.browserAction.setPopup({ popup: '' });

        notify({
          title:   browser.i18n.getMessage('config.requestPermissions.fallbackToToolbarButton.title'),
          message: browser.i18n.getMessage('config.requestPermissions.fallbackToToolbarButton.message'),
          icon:    'resources/24x24-light.svg'
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
  },

  requestPostProcess() {
    if (!configs.requestingPermissions)
      return false;

    var permissions = configs.requestingPermissions;
    configs.requestingPermissions = null;
    browser.browserAction.setBadgeText({ text: '' });
    browser.permissions.request(permissions).then(aGranted => {
      log('permission requested: ', permissions, aGranted);
      if (aGranted)
        browser.runtime.sendMessage({
          type:        kCOMMAND_NOTIFY_PERMISSIONS_GRANTED,
          permissions: permissions
        });
    });
    return true;
  }
};
