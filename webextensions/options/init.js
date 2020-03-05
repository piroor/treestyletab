/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import Options from '/extlib/Options.js';
import '/extlib/l10n.js';

import {
  log,
  wait,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as Permissions from '/common/permissions.js';
import * as Bookmark from '/common/bookmark.js';
import * as BrowserTheme from '/common/browser-theme.js';
import * as TSTAPI from '/common/tst-api.js';

log.context = 'Options';
const options = new Options(configs);

document.title = browser.i18n.getMessage('config_title');
if ((location.hash && location.hash != '#') ||
    /independent=true/.test(location.search))
  document.body.classList.add('independent');

function onConfigChanged(key) {
  const value = configs[key];
  switch (key) {
    case 'successorTabControlLevel': {
      const checkbox = document.getElementById('simulateSelectOwnerOnClose');
      const label = checkbox.parentNode;
      if (value == Constants.kSUCCESSOR_TAB_CONTROL_NEVER) {
        checkbox.setAttribute('disabled', true);
        label.setAttribute('disabled', true);
      }
      else {
        checkbox.removeAttribute('disabled');
        label.removeAttribute('disabled');
      }
    }; break;

    case 'closeParentBehaviorMode': {
      const nodes = document.querySelectorAll('#closeParentBehaviorModeGroup > ul > li > :not(label)');
      for (const node of nodes) {
        node.style.display = node.parentNode.querySelector('input[type="radio"]').checked ? '' : 'none';
        const chosen = node.querySelector(`[type="radio"][data-config-key="closeParentBehavior"][value="${configs.closeParentBehavior}"]`);
        if (chosen) {
          chosen.checked = true;
          continue;
        }
        const chooser = node.querySelector('[data-config-key="closeParentBehavior"]');
        if (chooser)
          chooser.value = configs.closeParentBehavior;
      }
    }; break;

    case 'showExpertOptions':
      document.documentElement.classList.toggle('show-expert-options', configs.showExpertOptions);
      break;
  }
}

function removeAccesskeyMark(node) {
  if (!node.nodeValue)
    return;
  node.nodeValue = node.nodeValue.replace(/\(&[a-z]\)|&([a-z])/gi, '$1');
}

function onChangeMasterChacekbox(event) {
  const container = event.currentTarget.closest('fieldset');
  for (const checkbox of container.querySelectorAll('p input[type="checkbox"]')) {
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
  for (const checkbox of document.querySelectorAll('p input[type="checkbox"][id^="logFor-"]')) {
    config[checkbox.id.replace(/^logFor-/, '')] = checkbox.checked;
  }
  configs.logFor = config;
}

function isAllSlavesChecked(aMasger) {
  const container = aMasger.closest('fieldset');
  const checkboxes = container.querySelectorAll('p input[type="checkbox"]');
  return Array.from(checkboxes).every(checkbox => checkbox.checked);
}

function updateBookmarksUI(enabled) {
  const elements = document.querySelectorAll('.with-bookmarks-permission label, .with-bookmarks-permission input, .with-bookmarks-permission button');
  if (enabled) {
    for (const element of elements) {
      element.removeAttribute('disabled');
    }
    const defaultBookmarkParentChooser = document.getElementById('defaultBookmarkParentChooser');
    Bookmark.initFolderChoolser(defaultBookmarkParentChooser, {
      defaultValue: configs.defaultBookmarkParentId,
      onCommand:    (item, _event) => {
        if (item.dataset.id)
          configs.defaultBookmarkParentId = item.dataset.id;
      },
    });
  }
  else {
    for (const element of elements) {
      element.setAttribute('disabled', true);
    }
  }
}

async function showLogs() {
  browser.tabs.create({
    url: '/resources/logs.html'
  });
}

configs.$addObserver(onConfigChanged);
window.addEventListener('DOMContentLoaded', async () => {
  if (typeof browser.tabs.moveInSuccession == 'function')
    document.documentElement.classList.add('successor-tab-support');
  else
    document.documentElement.classList.remove('successor-tab-support');

  for (const label of document.querySelectorAll('.contextConfigs label')) {
    removeAccesskeyMark(label.lastChild);
  }

  const showLogsButton = document.getElementById('showLogsButton');
  showLogsButton.addEventListener('click', event => {
    if (event.button != 0)
      return;
    showLogs();
  });
  showLogsButton.addEventListener('keydown', event => {
    if (event.key != 'Enter')
      return;
    showLogs();
  });

  document.getElementById('link-optionsPage').setAttribute('href', `${location.href.split('#')[0]}#!`);
  document.getElementById('link-startupPage').setAttribute('href', Constants.kSHORTHAND_URIS.startup);
  document.getElementById('link-groupPage').setAttribute('href', Constants.kSHORTHAND_URIS.group);
  document.getElementById('link-runTests').setAttribute('href', Constants.kSHORTHAND_URIS.testRunner);

  if (browser.theme && browser.theme.getCurrent)
    browser.theme.getCurrent().then(theme => {
      const rules = BrowserTheme.generateThemeRules(theme)
        .replace(/(#(?:[0-9a-f]{3,8})|(?:rgb|hsl)a?\([^\)]+\))/gi, `$1<span style="
          background-color: $1;
          border-radius:    0.2em;
          box-shadow:       1px 1px 1.5px black;
          display:          inline-block;
          height:           1em;
          width:            1em;
        ">\u200b</span>`);
      const range = document.createRange();
      range.selectNodeContents(document.getElementById('browserThemeCustomRules'));
      range.collapse(false);
      range.startContainer.appendChild(range.createContextualFragment(rules));
      range.detach();
      document.getElementById('browserThemeCustomRulesBlock').style.display = rules ? 'block' : 'none';
    });

  await configs.$loaded;

  const focusedItem = document.querySelector(':target');
  for (const fieldset of document.querySelectorAll('fieldset.collapsible')) {
    if (configs.optionsExpandedGroups.includes(fieldset.id) ||
        (focusedItem && fieldset.contains(focusedItem)))
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

  for (const heading of document.querySelectorAll('body > section > h1')) {
    const section = heading.parentNode;
    section.style.maxHeight = `${heading.offsetHeight}px`;
    if (!configs.optionsExpandedSections.includes(section.id) &&
          (!focusedItem || !section.contains(focusedItem)))
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

  Permissions.isGranted(Permissions.BOOKMARKS).then(granted => updateBookmarksUI(granted));

  Permissions.bindToCheckbox(
    Permissions.ALL_URLS,
    document.querySelector('#allUrlsPermissionGranted_ctrlTabTracking'),
    { onChanged: (granted) => configs.skipCollapsedTabsForTabSwitchingShortcuts = granted }
  );
  Permissions.bindToCheckbox(
    Permissions.ALL_URLS,
    document.querySelector('#allUrlsPermissionGranted_inContentConfirmation')
  );
  Permissions.bindToCheckbox(
    Permissions.BOOKMARKS,
    document.querySelector('#bookmarksPermissionGranted'),
    { onChanged: (granted) => updateBookmarksUI(granted) }
  );
  Permissions.bindToCheckbox(
    Permissions.TAB_HIDE,
    document.querySelector('#tabHidePermissionGranted'),
    { onChanged: async (granted) => {
      if (granted) {
        // try to hide/show the tab to ensure the permission is really granted
        const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
        const tab = await browser.tabs.create({ active: false, windowId: activeTabs[0].windowId });
        await wait(200);
        let aborted = false;
        const onRemoved = tabId => {
          if (tabId != tab.id)
            return;
          aborted = true;
          browser.tabs.onRemoved.removeListener(onRemoved);
          // eslint-disable-next-line no-use-before-define
          browser.tabs.onUpdated.removeListener(onUpdated);
        };
        const onUpdated = async (tabId, changeInfo, tab) => {
          if (tabId != tab.id ||
                !('hidden' in changeInfo))
            return;
          await wait(60 * 1000);
          if (aborted)
            return;
          await browser.tabs.show([tab.id]);
          await browser.tabs.remove(tab.id);
        };
        browser.tabs.onRemoved.addListener(onRemoved);
        browser.tabs.onUpdated.addListener(onUpdated);
        await browser.tabs.hide([tab.id]);
      }
    }}
  );


  for (const checkbox of document.querySelectorAll('p input[type="checkbox"][id^="logFor-"]')) {
    checkbox.addEventListener('change', onChangeSlaveChacekbox);
    checkbox.checked = configs.logFor[checkbox.id.replace(/^logFor-/, '')];
  }
  for (const checkbox of document.querySelectorAll('legend input[type="checkbox"][id^="logFor-"]')) {
    checkbox.checked = isAllSlavesChecked(checkbox);
    checkbox.addEventListener('change', onChangeMasterChacekbox);
  }

  for (const previewImage of document.querySelectorAll('select ~ .preview-image')) {
    const container = previewImage.parentNode;
    container.classList.add('has-preview-image');
    const select = container.querySelector('select');
    container.dataset.value = select.dataset.value = select.value;
    container.addEventListener('mouseover', event => {
      if (event.target != select &&
            select.contains(event.target))
        return;
      const rect = select.getBoundingClientRect();
      previewImage.style.left = `${rect.left}px`;
      previewImage.style.top  = `${rect.top - 5 - previewImage.offsetHeight}px`;
    });
    select.addEventListener('change', () => {
      container.dataset.value = select.dataset.value = select.value;
    });
    select.addEventListener('mouseover', event => {
      if (event.target == select)
        return;
      container.dataset.value = select.dataset.value = event.target.value;
    });
    select.addEventListener('mouseout', () => {
      container.dataset.value = select.dataset.value = select.value;
    });
  }

  browser.runtime.sendMessage({
    type: TSTAPI.kCOMMAND_GET_ADDONS
  }).then(addons => {
    const description = document.getElementById('externalAddonPermissionsGroupDescription');
    const range = document.createRange();
    range.selectNodeContents(description);
    description.appendChild(range.createContextualFragment(browser.i18n.getMessage('config_externaladdonpermissions_description')));
    range.detach();

    const container = document.getElementById('externalAddonPermissions');
    for (const addon of addons) {
      if (addon.id == browser.runtime.id)
        continue;
      const row = document.createElement('tr');

      const nameCell = row.appendChild(document.createElement('td'));
      const nameLabel = nameCell.appendChild(document.createElement('label'));
      nameLabel.appendChild(document.createTextNode(addon.label));
      const controlledId = `api-permissions-${encodeURIComponent(addon.id)}`;
      nameLabel.setAttribute('for', controlledId);

      const incognitoCell = row.appendChild(document.createElement('td'));
      const incognitoLabel = incognitoCell.appendChild(document.createElement('label'));
      const incognitoCheckbox = incognitoLabel.appendChild(document.createElement('input'));
      if (addon.permissions.length == 0)
        incognitoCheckbox.setAttribute('id', controlledId);
      incognitoCheckbox.setAttribute('type', 'checkbox');
      incognitoCheckbox.checked = configs.incognitoAllowedExternalAddons.includes(addon.id);
      incognitoCheckbox.addEventListener('change', () => {
        const updatedValue = new Set(configs.incognitoAllowedExternalAddons);
        if (incognitoCheckbox.checked)
          updatedValue.add(addon.id);
        else
          updatedValue.delete(addon.id);
        configs.incognitoAllowedExternalAddons = Array.from(updatedValue);
        browser.runtime.sendMessage({
          type: TSTAPI.kCOMMAND_NOTIFY_PERMISSION_CHANGED,
          id:   addon.id
        });
      });

      const permissionsCell = row.appendChild(document.createElement('td'));
      if (addon.permissions.length > 0) {
        const permissionsLabel = permissionsCell.appendChild(document.createElement('label'));
        const permissionsCheckbox = permissionsLabel.appendChild(document.createElement('input'));
        permissionsCheckbox.setAttribute('id', controlledId);
        permissionsCheckbox.setAttribute('type', 'checkbox');
        permissionsCheckbox.checked = addon.permissionsGranted;
        permissionsCheckbox.addEventListener('change', () => {
          browser.runtime.sendMessage({
            type:        TSTAPI.kCOMMAND_SET_API_PERMISSION,
            id:          addon.id,
            permissions: permissionsCheckbox.checked ? addon.permissions : addon.permissions.map(permission => `!  ${permission}`)
          });
        });
        const permissionNames = addon.permissions.map(permission => {
          try {
            return browser.i18n.getMessage(`api_requestedPermissions_type_${permission}`) || permission;
          }
          catch(_error) {
            return permission;
          }
        }).join(', ');
        permissionsLabel.appendChild(document.createTextNode(permissionNames));
      }

      container.appendChild(row);
    }
  });

  options.buildUIForAllConfigs(document.querySelector('#group-allConfigs'));
  onConfigChanged('successorTabControlLevel');
  onConfigChanged('showExpertOptions');
  await wait(0);
  onConfigChanged('closeParentBehaviorMode');

  if (focusedItem)
    focusedItem.scrollIntoView();

  document.documentElement.classList.add('initialized');
}, { once: true });
