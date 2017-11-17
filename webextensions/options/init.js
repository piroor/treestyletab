/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'Options';
var options = new Options(configs);

function onConfigChanged(aKey) {
  switch (aKey) {
    case 'debug':
      if (configs.debug)
        document.documentElement.classList.add('debugging');
      else
        document.documentElement.classList.remove('debugging');
      break;
  }
}

async function requestPermissionFor(aPermissions, aCheckbox) {
  try {
    if (!aCheckbox.checked) {
      await browser.permissions.remove(aPermissions);
      return;
    }
    var granted = await browser.permissions.contains(aPermissions);
    if (granted)
      return;
    configs.requestingPermissions = aPermissions;
    aCheckbox.checked = false;
    browser.browserAction.setBadgeText({ text: '!' });
    alert(browser.i18n.getMessage('config.requestPermissions.fallbackToToolbarButton.message'));
    return;
    // following codes don't work as expected due to https://bugzilla.mozilla.org/show_bug.cgi?id=1382953
    if (!await browser.permissions.request(aPermissions)) {
      aCheckbox.checked = false;
      return;
    }
  }
  catch(e) {
  }
  aCheckbox.checked = false;
}

configs.$addObserver(onConfigChanged);
window.addEventListener('DOMContentLoaded', () => {
  configs.$loaded.then(() => {
    document.querySelector('#legacyConfigsNextMigrationVersion-currentLevel').textContent = kLEGACY_CONFIGS_MIGRATION_VERSION;

    var bookmarksPermisions = { permissions: ['bookmarks'] };
    var checkbox = document.querySelector('#bookmarksPermissionGranted');
    browser.permissions.contains(bookmarksPermisions).then(aGranted => {
      checkbox.checked = aGranted;
    });
    checkbox.addEventListener('change', (aEvent) => {
      requestPermissionFor(bookmarksPermisions, aEvent.target)
    });

    /*
    // These events are not available yet on Firefox...
    browser.permissions.onAdded.addListener(aPermissions => {
      if (aPermissions.permissions.indexOf('bookmarks') > -1)
        checkbox.checked = true;
    });
    browser.permissions.onRemoved.addListener(aPermissions => {
      if (aPermissions.permissions.indexOf('bookmarks') > -1)
        checkbox.checked = false;
    });
    */

    options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
    onConfigChanged('debug');
  });
}, { once: true });
