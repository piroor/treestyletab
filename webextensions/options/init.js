/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import Options from '../extlib/Options.js';
import ShortcutCustomizeUI from '../extlib/ShortcutCustomizeUI.js';
import '../extlib/l10n.js';

import {
  log,
  configs
} from '../common/common.js';

import * as Permissions from '../common/permissions.js';
import * as Migration from '../common/migration.js';

log.context = 'Options';
const options = new Options(configs);

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

function onChangeMasterChacekbox(aEvent) {
  const container = aEvent.currentTarget.closest('fieldset');
  const checkboxes = container.querySelectorAll('p input[type="checkbox"]');
  for (const checkbox of Array.from(checkboxes)) {
    checkbox.checked = aEvent.currentTarget.checked;
  }
  saveLogForConfig();
}

function onChangeSlaveChacekbox(aEvent) {
  master.checked = isAllSlavesChecked(aEvent.currentTarget);
  saveLogForConfig();
}

function saveLogForConfig() {
  const config = {};
  for (const checkbox of Array.from(document.querySelectorAll('p input[type="checkbox"][id^="logFor-"]'))) {
    config[checkbox.id.replace(/^logFor-/, '')] = checkbox.checked;
  }
  configs.logFor = config;
}

function isAllSlavesChecked(aMasger) {
  const container = aMasger.closest('fieldset');
  const checkboxes = container.querySelectorAll('p input[type="checkbox"]');
  const master = container.querySelector('legend input[type="checkbox"]');
  return Array.from(checkboxes).every(aCheckbox => aCheckbox.checked);
}

configs.$addObserver(onConfigChanged);
window.addEventListener('DOMContentLoaded', () => {
  if (/^Mac/i.test(navigator.platform))
    document.documentElement.classList.add('platform-mac');
  else
    document.documentElement.classList.remove('platform-mac');

  for (const label of Array.from(document.querySelectorAll('#contextConfigs label'))) {
    removeAccesskeyMark(label.lastChild);
  }

  ShortcutCustomizeUI.build().then(aUI => {
    document.getElementById('shortcuts').appendChild(aUI);

    for (const item of Array.from(aUI.querySelectorAll('li > label:first-child'))) {
      removeAccesskeyMark(item.firstChild);
    }
  });

  for (const fieldset of Array.from(document.querySelectorAll('fieldset.collapsible'))) {
    fieldset.addEventListener('click', () => {
      fieldset.classList.toggle('collapsed');
    });
    fieldset.addEventListener('keydown', aEvent => {
      if (aEvent.key == 'Enter')
        fieldset.classList.toggle('collapsed');
    });
  }

  configs.$loaded.then(() => {
    for (const heading of Array.from(document.querySelectorAll('body > section > h1'))) {
      const section = heading.parentNode;
      section.style.maxHeight = `${heading.offsetHeight}px`;
      if (!configs.optionsExpandedSections.includes(section.id))
        section.classList.add('collapsed');
      heading.addEventListener('click', () => {
        section.classList.toggle('collapsed');
        const otherExpandedSections = configs.optionsExpandedSections.filter(aId => aId != section.id);
        if (section.classList.contains('collapsed'))
          configs.optionsExpandedSections = otherExpandedSections;
        else
          configs.optionsExpandedSections = otherExpandedSections.concat([section.id]);
      });
    }

    document.querySelector('#legacyConfigsNextMigrationVersion-currentLevel').textContent = Migration.kLEGACY_CONFIGS_MIGRATION_VERSION;

    Permissions.bindToCheckbox(
      Permissions.ALL_URLS,
      document.querySelector('#allUrlsPermissionGranted'),
      { onChanged: (aGranted) => configs.skipCollapsedTabsForTabSwitchingShortcuts = aGranted }
    );
    Permissions.bindToCheckbox(
      Permissions.BOOKMARKS,
      document.querySelector('#bookmarksPermissionGranted')
    );


    for (const checkbox of Array.from(document.querySelectorAll('p input[type="checkbox"][id^="logFor-"]'))) {
      checkbox.addEventListener('change', onChangeSlaveChacekbox);
      checkbox.checked = configs.logFor[checkbox.id.replace(/^logFor-/, '')];
    }
    for (const checkbox of Array.from(document.querySelectorAll('legend input[type="checkbox"][id^="logFor-"]'))) {
      checkbox.checked = isAllSlavesChecked(checkbox);
      checkbox.addEventListener('change', onChangeMasterChacekbox);
    }

    options.buildUIForAllConfigs(document.querySelector('#debug-configs'));
    onConfigChanged('debug');
  });
}, { once: true });
