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

function onConfigChanged(key) {
  switch (key) {
    case 'debug':
      if (configs.debug)
        document.documentElement.classList.add('debugging');
      else
        document.documentElement.classList.remove('debugging');
      break;
  }
}

function removeAccesskeyMark(node) {
  node.nodeValue = node.nodeValue.replace(/\(&[a-z]\)|&([a-z])/i, '$1');
}

function onChangeMasterChacekbox(event) {
  const container = event.currentTarget.closest('fieldset');
  const checkboxes = container.querySelectorAll('p input[type="checkbox"]');
  for (const checkbox of Array.from(checkboxes)) {
    checkbox.checked = event.currentTarget.checked;
  }
  saveLogForConfig();
}

function onChangeSlaveChacekbox(event) {
  getMasterCheckboxFromSlave(event.currentTarget).checked = isAllSlavesChecked(event.currentTarget);
  saveLogForConfig();
}

function getMasterCheckboxFromSlave(aSlave) {
  const container = aSlave.closest('fieldset');
  return container.querySelector('legend input[type="checkbox"]');
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
  return Array.from(checkboxes).every(checkbox => checkbox.checked);
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
    if (configs.optionsExpandedGroups.includes(fieldset.id))
      fieldset.classList.remove('collapsed');
    else
      fieldset.classList.add('collapsed');

    const onChangeCollapsed = () => {
      if (!fieldset.id)
        return;
      const otherExpandedSections = configs.optionsExpandedGroups.filter(id => id != fieldset.id);
      if (fieldset.classList.contains('collapsed'))
        configs.optionsExpandedGroups = otherExpandedSections;
      else
        configs.optionsExpandedGroups = otherExpandedSections.concat([fieldset.id]);
    };

    const legend = fieldset.querySelector(':scope > legend');
    legend.addEventListener('click', () => {
      fieldset.classList.toggle('collapsed');
      onChangeCollapsed();
    });
    legend.addEventListener('keydown', event => {
      if (event.key != 'Enter')
        return;
      fieldset.classList.toggle('collapsed');
      onChangeCollapsed();
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
        const otherExpandedSections = configs.optionsExpandedSections.filter(id => id != section.id);
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
      { onChanged: (granted) => configs.skipCollapsedTabsForTabSwitchingShortcuts = granted }
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

    options.buildUIForAllConfigs(document.querySelector('#group-allConfigs'));
    onConfigChanged('debug');
  });
}, { once: true });
