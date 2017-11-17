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
      await browser.permissions.remove({ permissions: aPermissions });
      return;
    }
    if (!await browser.permissions.request({ permissions: aPermissions })) {
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
    document.querySelector('#bookmarksPermissionGranted').addEventListener('change', (aEvent) => {
      requestPermissionFor(['bookmarks'], aEvent.target)
    });
    options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
    onConfigChanged('debug');
  });
}, { once: true });
