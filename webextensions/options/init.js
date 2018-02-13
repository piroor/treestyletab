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

function removeAccesskeyMark(aNode) {
  aNode.nodeValue = aNode.nodeValue.replace(/\(&[a-z]\)|&([a-z])/i, '$1');
}

configs.$addObserver(onConfigChanged);
window.addEventListener('DOMContentLoaded', () => {
  if (/^Mac/i.test(navigator.platform))
    document.documentElement.classList.add('platform-mac');
  else
    document.documentElement.classList.remove('platform-mac');

  for (let label of Array.slice(document.querySelectorAll('#contextConfigs label'))) {
    removeAccesskeyMark(label.lastChild);
  }

  ShortcutCustomizeUI.build().then(aUI => {
    document.getElementById('shortcuts').appendChild(aUI);

    for (let item of Array.slice(aUI.querySelectorAll('li > label:first-child'))) {
      removeAccesskeyMark(item.firstChild);
    }
  });

  configs.$loaded.then(() => {
    document.querySelector('#legacyConfigsNextMigrationVersion-currentLevel').textContent = kLEGACY_CONFIGS_MIGRATION_VERSION;

    Permissions.bindToCheckbox(
      Permissions.ALL_URLS,
      document.querySelector('#allUrlsPermissionGranted'),
      { onChanged: (aGranted) => configs.skipCollapsedTabsForTabSwitchingShortcuts = aGranted }
    );
    Permissions.bindToCheckbox(
      Permissions.BOOKMARKS,
      document.querySelector('#bookmarksPermissionGranted')
    );

    options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
    onConfigChanged('debug');
  });
}, { once: true });
