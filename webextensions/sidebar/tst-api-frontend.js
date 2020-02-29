/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as TSTAPI from '/common/tst-api.js';

import {
//  log as internalLogger,
  configs
} from '/common/common.js';

import {
  kTAB_ELEMENT_NAME,
} from './components/TabElement.js';

/*
function log(...args) {
  internalLogger('sidebar/tst-api-frontend', ...args);
}
*/

const mAddonsWithExtraContents = new Set();

TSTAPI.onRegistered.addListener(addon => {
  // Install stylesheet always, even if the addon is not allowed to access
  // private windows, because the client addon can be alloed on private
  // windows by Firefox itself and extra context menu commands may be called
  // via Firefox's native context menu (or shortcuts).
  if (addon.style)
    installStyle(addon.id, addon.style);
});

TSTAPI.onUnregistered.addListener(addon => {
  if (mAddonsWithExtraContents.has(addon.id)) {
    for (const tabElement of document.querySelector(kTAB_ELEMENT_NAME)) {
      clearExtraContents(tabElement, addon.id);
    }
    mAddonsWithExtraContents.delete(addon.id);
  }

  uninstallStyle(addon.id)
});

browser.runtime.onMessageExternal.addListener((message, sender) => {
  if (!message ||
      typeof message.type != 'string' ||
      (!configs.incognitoAllowedExternalAddons.includes(sender.id) &&
       document.documentElement.classList.contains('incognito')))
    return;

  const tabElement = document.querySelector(`#tab-${message.id}`);
  if (!tabElement)
    return;

  switch (message.type) {
    case TSTAPI.kSET_EXTRA_TAB_CONTENTS:
      setExtraContents(tabElement, sender.id, message);
      break;

    case TSTAPI.kCLEAR_EXTRA_TAB_CONTENTS:
      clearExtraContents(tabElement, sender.id);
      break;
  }
});

function setExtraContents(tabElement, id, params) {
  let container;
  switch (String(params.place).toLowerCase()) {
    case 'behind':
      container = tabElement.extraItemsContainerBehindRoot;
      break;

    case 'front':
      container = tabElement.extraItemsContainerFrontRoot;
      break;

    default:
      return;
  }

  let item = container.itemById.get(id);
  if (!params.contents) {
    if (item) {
      container.removeChild(item);
      container.itemById.delete(id);
    }
    return;
  }

  if (!item) {
    item = document.createElement('span');
    item.classList.add('extra-item');
    item.classList.add(id.replace(/[^-a-z0-9_]/g, '_'));
    container.itemById.set(id, item);
  }

  const range = document.createRange();
  range.selectNodeContents(item);
  const contents = range.createContextualFragment(String(params.contents || '').trim());

  // sanitization
  for (const node of contents.querySelectorAll('*')) {
    // reject dangerous contents
    if (/^(script|embed|object|iframe)$/.test(node.localName)) {
      if (node.src)
        node.src = '';
      if (node.textContent)
        node.textContent = '';
      continue;
    }

    for (const attribute of node.attributes) {
      // inline event handlers are blocked by the CSP mechanism.
      // reject remote resources
      if (/^(src|srcset)$/.test(attribute.name) &&
          node[attribute.name] &&
          !node[attribute.name].startsWith('data:'))
        node[attribute.name] = '';
    }
  }

  range.deleteContents();
  range.insertNode(contents);
  range.detach();

  if (!item.parentNode)
    container.appendChild(item);

  mAddonsWithExtraContents.add(id);
}

function clearExtraContents(tabElement, id) {
  const behindItem = tabElement.extraItemsContainerBehindRoot.itemById.get(id);
  if (behindItem) {
    tabElement.extraItemsContainerBehindRoot.removeChild(behindItem);
    tabElement.extraItemsContainerBehindRoot.itemById.delete(id);
  }

  const frontItem = tabElement.extraItemsContainerFrontRoot.itemById.get(id);
  if (frontItem) {
    tabElement.extraItemsContainerFrontRoot.removeChild(frontItem);
    tabElement.extraItemsContainerFrontRoot.itemById.delete(id);
  }
}

const mAddonStyles = new Map();

function installStyle(id, style) {
  let styleElement = mAddonStyles.get(id);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.setAttribute('type', 'text/css');
    document.head.insertBefore(styleElement, document.querySelector('#addons-style-rules'));
    mAddonStyles.set(id, styleElement);
  }
  styleElement.textContent = style;
}

function uninstallStyle(id) {
  const styleElement = mAddonStyles.get(id);
  if (!styleElement)
    return;
  document.head.removeChild(styleElement);
  mAddonStyles.delete(id);
}
