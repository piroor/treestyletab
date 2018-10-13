/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import MenuUI from '/extlib/MenuUI.js';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as Tree from '/common/tree.js';
import * as TSTAPI from '/common/tst-api.js';
import * as EventUtils from './event-utils.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('sidebar/tab-context-menu', ...args);
}

export const onTabsClosing = new EventListenerManager();

let mUI;
let mMenu;

let mContextTab      = null;
let mLastOpenOptions = null;
let mIsDirty         = false;

const mExtraItems = new Map();

export function init() {
  mMenu = document.querySelector('#tabContextMenu');
  document.addEventListener('contextmenu', onContextMenu, { capture: true });

  mUI = new MenuUI({
    root: mMenu,
    onCommand,
    //onShown,
    onHidden,
    appearance:        'menu',
    animationDuration: configs.animation ? configs.collapseDuration : 0.001,
    subMenuOpenDelay:  configs.subMenuOpenDelay,
    subMenuCloseDelay: configs.subMenuCloseDelay
  });

  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onExternalMessage);

  browser.runtime.sendMessage({
    type: TSTAPI.kCONTEXT_MENU_GET_ITEMS
  }).then(aItems => {
    importExtraItems(aItems);
    mIsDirty = true;
  });
}

async function rebuild() {
  if (!mIsDirty)
    return;

  mIsDirty = false;

  const firstExtraItem = mMenu.querySelector('.extra');
  if (firstExtraItem) {
    const range = document.createRange();
    range.selectNodeContents(mMenu);
    range.setStartBefore(firstExtraItem);
    range.deleteContents();
    range.detach();
  }

  if (mExtraItems.size == 0)
    return;

  const extraItemNodes = document.createDocumentFragment();
  for (const [id, extraItems] of mExtraItems.entries()) {
    let addonItem = document.createElement('li');
    const name = getAddonName(id);
    addonItem.appendChild(document.createTextNode(name));
    addonItem.setAttribute('title', name);
    addonItem.classList.add('extra');
    const icon = getAddonIcon(id);
    if (icon)
      addonItem.dataset.icon = icon;
    prepareAsSubmenu(addonItem);

    const toBeBuiltItems = [];
    for (const item of extraItems) {
      if (item.visible === false)
        continue;
      if (item.contexts && !item.contexts.includes('tab'))
        continue;
      if (mContextTab &&
          item.documentUrlPatterns &&
          !matchesToCurrentTab(item.documentUrlPatterns))
        continue;
      toBeBuiltItems.push(item);
    }
    const topLevelItems = toBeBuiltItems.filter(item => !item.parentId);
    if (topLevelItems.length == 1 &&
        !topLevelItems[0].icons)
      topLevelItems[0].icons = TSTAPI.getAddon(id).icons || {};

    const addonSubMenu = addonItem.lastChild;
    const knownItems   = {};
    for (const item of toBeBuiltItems) {
      const itemNode = buildExtraItem(item, id);
      if (item.parentId) {
        if (item.parentId in knownItems) {
          const parent = knownItems[item.parentId];
          prepareAsSubmenu(parent);
          parent.lastChild.appendChild(itemNode);
        }
        else {
          continue;
        }
      }
      else {
        addonSubMenu.appendChild(itemNode);
      }
      knownItems[item.id] = itemNode;
    }
    if (id == browser.runtime.id) {
      for (const item of addonSubMenu.children) {
        if (item.nextSibling) // except the last "Tree Style Tab" menu
          item.classList.remove('extra');
      }
      const range = document.createRange();
      range.selectNodeContents(addonSubMenu);
      extraItemNodes.appendChild(range.extractContents());
      range.detach();
      continue;
    }
    switch (addonSubMenu.childNodes.length) {
      case 0:
        break;
      case 1:
        addonItem = addonSubMenu.removeChild(addonSubMenu.firstChild);
        extraItemNodes.appendChild(addonItem);
      default:
        extraItemNodes.appendChild(addonItem);
        break;
    }
  }
  if (!extraItemNodes.hasChildNodes())
    return;

  mMenu.appendChild(extraItemNodes);
}

function getAddonName(id) {
  if (id == browser.runtime.id)
    return browser.i18n.getMessage('extensionName');
  const addon = TSTAPI.getAddon(id) || {};
  return addon.name || id.replace(/@.+$/, '');
}

function getAddonIcon(id) {
  const addon = TSTAPI.getAddon(id) || {};
  return chooseIconForAddon({
    id:         id,
    internalId: addon.internalId,
    icons:      addon.icons || {}
  });
}

function chooseIconForAddon(params) {
  const icons = params.icons || {};
  const addon = TSTAPI.getAddon(params.id) || {};
  let sizes = Object.keys(icons).map(aSize => parseInt(aSize)).sort();
  const reducedSizes = sizes.filter(aSize => aSize < 16);
  if (reducedSizes.length > 0)
    sizes = reducedSizes;
  const size = sizes[0] || null;
  if (!size)
    return null;
  let url = icons[size];
  if (!/^\w+:\/\//.test(url))
    url = `moz-extension://${addon.internalId || params.internalId}/${url.replace(/^\//, '')}`;
  return url;
}

function prepareAsSubmenu(aItemNode) {
  if (aItemNode.querySelector('ul'))
    return aItemNode;
  aItemNode.appendChild(document.createElement('ul'));
  return aItemNode;
}

function buildExtraItem(item, aOwnerAddonId) {
  const itemNode = document.createElement('li');
  itemNode.setAttribute('id', `${aOwnerAddonId}-${item.id}`);
  itemNode.setAttribute('data-item-id', item.id);
  itemNode.setAttribute('data-item-owner-id', aOwnerAddonId);
  itemNode.classList.add('extra');
  itemNode.classList.add(item.type || 'normal');
  if (item.type == 'checkbox' || item.type == 'radio') {
    if (item.checked)
      itemNode.classList.add('checked');
  }
  if (item.type != 'separator') {
    itemNode.appendChild(document.createTextNode(item.title));
    itemNode.setAttribute('title', item.title);
  }
  if (item.enabled === false)
    itemNode.classList.add('disabled');
  else
    itemNode.classList.remove('disabled');;
  const addon = TSTAPI.getAddon(aOwnerAddonId) || {};
  const icon = chooseIconForAddon({
    id:         aOwnerAddonId,
    internalId: addon.internalId,
    icons:      item.icons || {}
  });
  if (icon)
    itemNode.dataset.icon = icon;
  return itemNode;
}

function matchesToCurrentTab(aPatterns) {
  if (!Array.isArray(aPatterns))
    aPatterns = [aPatterns];
  for (const pattern of aPatterns) {
    if (matchPatternToRegExp(pattern).test(mContextTab.url))
      return true;
  }
  return false;
}
// https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
const matchPattern = /^(?:(\*|http|https|file|ftp|app):\/\/([^\/]+|)\/?(.*))$/i;
function matchPatternToRegExp(aPattern) {
  if (aPattern === '<all_urls>')
    return (/^(?:https?|file|ftp|app):\/\//);
  const match = matchPattern.exec(aPattern);
  if (!match)
    throw new TypeError(`"${aPattern}" is not a valid MatchPattern`);

  const [, scheme, host, path,] = match;
  return new RegExp('^(?:'
                    + (scheme === '*' ? 'https?' : escape(scheme)) + ':\\/\\/'
                    + (host === '*' ? '[^\\/]*' : escape(host).replace(/^\*\./g, '(?:[^\\/]+)?'))
                    + (path ? (path == '*' ? '(?:\\/.*)?' : ('\\/' + escape(path).replace(/\*/g, '.*'))) : '\\/?')
                    + ')$');
}

export async function open(options = {}) {
  await close();
  mLastOpenOptions = options;
  mContextTab      = options.tab;
  await rebuild();
  if (mIsDirty) {
    return await open(options);
  }
  applyContext();
  const originalCanceller = options.canceller;
  options.canceller = () => {
    return (typeof originalCanceller == 'function' && originalCanceller()) || mIsDirty;
  };
  await mUI.open(options);
  if (mIsDirty) {
    return await open(options);
  }
}

export async function close() {
  await mUI.close();
  mMenu.removeAttribute('data-tab-id');
  mMenu.removeAttribute('data-tab-states');
  mContextTab      = null;
  mLastOpenOptions = null;
}

function applyContext() {
  if (mContextTab) {
    mMenu.setAttribute('data-tab-id', mContextTab.id);
    const states = [];
    if (mContextTab.active)
      states.push('active');
    if (mContextTab.pinned)
      states.push('pinned');
    if (mContextTab.audible)
      states.push('audible');
    if (mContextTab.mutedInfo && mContextTab.mutedInfo.muted)
      states.push('muted');
    if (mContextTab.discarded)
      states.push('discarded');
    if (mContextTab.incognito)
      states.push('incognito');
    if (Tabs.isMultiselected(Tabs.getTabById(mContextTab)))
      states.push('multiselected');
    mMenu.setAttribute('data-tab-states', states.join(' '));
  }
}

async function onCommand(item, event) {
  if (event.button == 1)
    return;

  const contextTab = mContextTab;
  wait(0).then(() => close()); // close the menu immediately!

  const id = item.getAttribute('data-item-id');
  if (!id)
    return;

  const modifiers = [];
  if (event.metaKey)
    modifiers.push('Command');
  if (event.ctrlKey) {
    modifiers.push('Ctrl');
    if (/^Mac/i.test(navigator.platform))
      modifiers.push('MacCtrl');
  }
  if (event.shiftKey)
    modifiers.push('Shift');
  const checked    = item.matches('.radio, .checkbox:not(.checked)');
  const wasChecked = item.matches('.radio.checked, .checkbox.checked');
  const message = {
    type: TSTAPI.kCONTEXT_MENU_CLICK,
    info: {
      checked,
      editable:         false,
      frameUrl:         null,
      linkUrl:          null,
      mediaType:        null,
      menuItemId:       id,
      modifiers:        modifiers,
      pageUrl:          null,
      parentMenuItemId: null,
      selectionText:    null,
      srcUrl:           null,
      wasChecked
    },
    tab: contextTab || null
  };
  const owner = item.getAttribute('data-item-owner-id');
  if (owner == browser.runtime.id)
    await browser.runtime.sendMessage(message);
  else
    await browser.runtime.sendMessage(owner, message);

  if (item.matches('.checkbox')) {
    item.classList.toggle('checked');
    for (const itemData of mExtraItems.get(item.dataset.itemOwnerId)) {
      if (itemData.id != item.dataset.itemId)
        continue;
      itemData.checked = item.matches('.checked');
      browser.runtime.sendMessage({
        type:    TSTAPI.kCONTEXT_ITEM_CHECKED_STATUS_CHANGED,
        id:      item.dataset.itemId,
        ownerId: item.dataset.itemOwnerId,
        checked: itemData.checked
      });
      break;
    }
    mIsDirty = true;
  }
  else if (item.matches('.radio')) {
    const currentRadioItems = new Set();
    let radioItems = null;
    for (const itemData of mExtraItems.get(item.dataset.itemOwnerId)) {
      if (itemData.type == 'radio') {
        currentRadioItems.add(itemData);
      }
      else if (radioItems == currentRadioItems) {
        break;
      }
      else {
        currentRadioItems.clear();
      }
      if (itemData.id == item.dataset.itemId)
        radioItems = currentRadioItems;
    }
    if (radioItems) {
      for (const itemData of radioItems) {
        itemData.checked = itemData.id == item.dataset.itemId;
        const radioItem = document.getElementById(`${item.dataset.itemOwnerId}-${itemData.id}`);
        if (radioItem) {
          if (itemData.checked)
            radioItem.classList.add('checked');
          else
            radioItem.classList.remove('checked');
        }
        browser.runtime.sendMessage({
          type:    TSTAPI.kCONTEXT_ITEM_CHECKED_STATUS_CHANGED,
          id:      item.dataset.itemId,
          ownerId: item.dataset.itemOwnerId,
          checked: itemData.checked
        });
      }
    }
    mIsDirty = true;
  }
}

async function onShown(contextTab) {
  const message = {
    type: TSTAPI.kCONTEXT_MENU_SHOWN,
    info: {
      editable:         false,
      frameUrl:         null,
      linkUrl:          null,
      mediaType:        null,
      pageUrl:          null,
      selectionText:    null,
      srcUrl:           null,
      contexts:         ['tab'],
      menuIds:          [],
      viewType:         'sidebar'
    },
    tab: contextTab || mContextTab || null
  };
  return Promise.all([
    browser.runtime.sendMessage(message),
    TSTAPI.sendMessage(message)
  ]);
}

async function onHidden() {
  const message = {
    type: TSTAPI.kCONTEXT_MENU_HIDDEN
  };
  return Promise.all([
    browser.runtime.sendMessage(message),
    TSTAPI.sendMessage(message)
  ]);
}

function onMessage(message, _aSender) {
  log('tab-context-menu: internally called:', message);
  switch (message.type) {
    case Constants.kCOMMAND_NOTIFY_TABS_CLOSING:
      return onTabsClosing.dispatch(message.count, { windowId: message.windowId });

    case TSTAPI.kCONTEXT_MENU_UPDATED: {
      importExtraItems(message.items);
      mIsDirty = true;
      if (mUI.opened)
        open(mLastOpenOptions);
    }; break;
  }
}

function importExtraItems(aItems) {
  mExtraItems.clear();
  for (const [id, items] of Object.entries(aItems)) {
    mExtraItems.set(id, items);
  }
}

function onExternalMessage(message, sender) {
  log('API called:', message, { id: sender.id, url: sender.url });
  switch (message.type) {
    case TSTAPI.kCONTEXT_MENU_OPEN:
      return (async () => {
        const tab      = message.tab ? (await browser.tabs.get(message.tab)) : null ;
        const windowId = message.window || tab && tab.windowId;
        if (windowId != Tabs.getWindow())
          return;
        await onShown(tab);
        await wait(25);
        return open({
          tab,
          left:     message.left,
          top:      message.top
        });
      })();
  }
}


async function onContextMenu(event) {
  const tab = EventUtils.getTabFromEvent(event);
  if (!event.ctrlKey &&
      tab && tab.apiTab &&
      typeof browser.menus.overrideContext == 'function') {
    browser.menus.overrideContext({
      context: 'tab',
      tabId: tab.apiTab.id
    });
    return;
  }
  if (!configs.fakeContextMenu)
    return;
  event.stopPropagation();
  event.preventDefault();
  await onShown(tab && tab.apiTab);
  await wait(25);
  await open({
    tab:  tab && tab.apiTab,
    left: event.clientX,
    top:  event.clientY
  });
}

// don't return promise, to avoid needless "await"
Tabs.onRemoving.addListener((_tab, _info) => { close(); });
Tabs.onMoving.addListener((_tab, _info) => { close(); });
Tabs.onActivated.addListener((_tab, _info) => { close(); });
Tabs.onCreating.addListener((_tab, _info) => { close(); });
Tabs.onPinned.addListener(_tab => { close(); });
Tabs.onUnpinned.addListener(_tab => { close(); });
Tabs.onShown.addListener(_tab => { close(); });
Tabs.onHidden.addListener(_tab => { close(); });
Tree.onAttached.addListener((_tab, _info) => { close(); });
Tree.onDetached.addListener((_tab, _info) => { close(); });
