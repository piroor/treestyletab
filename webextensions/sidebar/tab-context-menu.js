/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

/*
 Workaround until native context menu becomes available.
 I have very less motivation to maintain this for future versions.
 See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1376251
           https://bugzilla.mozilla.org/show_bug.cgi?id=1396031
*/
import MenuUI from '../extlib/MenuUI.js';

import {
  log as internalLogger,
  wait,
  notify,
  configs
} from '../common/common.js';
import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as Tree from '../common/tree.js';
import * as Bookmark from '../common/bookmark.js';
import * as TSTAPI from '../common/tst-api.js';
import * as EventUtils from './event-utils.js';
import EventListenerManager from '../common/EventListenerManager.js';

function log(...args) {
  if (configs.logFor['sidebar/tab-context-menu'])
    internalLogger(...args);
}

export const onTabsClosing = new EventListenerManager();

let mUI;
let mMenu;

let mContextTab      = null;
let mLastOpenOptions = null;
let mContextWindowId = null;
let mIsDirty         = false;

const mExtraItems = new Map();

export function init() {
  mMenu = document.querySelector('#tabContextMenu');
  document.addEventListener('contextmenu', onContextMenu, { capture: true });

  mUI = new MenuUI({
    root: mMenu,
    onCommand,
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
      if (item.parentId && item.parentId in knownItems) {
        const parent = knownItems[item.parentId];
        prepareAsSubmenu(parent);
        parent.lastChild.appendChild(itemNode);
      }
      else {
        addonSubMenu.appendChild(itemNode);
      }
      knownItems[item.id] = itemNode;
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

  const separator = document.createElement('li');
  separator.classList.add('extra');
  separator.classList.add('separator');
  extraItemNodes.insertBefore(separator, extraItemNodes.firstChild);
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
  mContextWindowId = options.windowId || (mContextTab && mContextTab.windowId);
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
  mContextWindowId = null;
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
    mMenu.setAttribute('data-tab-states', states.join(' '));
  }

  if (Tabs.getTabs().length > 1)
    mMenu.classList.add('has-multiple-tabs');
  else
    mMenu.classList.remove('has-multiple-tabs');

  switch (Tabs.getNormalTabs().length) {
    case 0:
      mMenu.classList.remove('has-normal-tabs');
      mMenu.classList.remove('has-multiple-normal-tabs');
      break;
    case 1:
      mMenu.classList.add('has-normal-tabs');
      mMenu.classList.remove('has-multiple-normal-tabs');
      break;
    default:
      mMenu.classList.add('has-normal-tabs');
      mMenu.classList.add('has-multiple-normal-tabs');
      break;
  }
}

async function onCommand(item, event) {
  if (event.button == 1)
    return;

  wait(0).then(() => close()); // close the menu immediately!

  switch (item.id) {
    case 'context_reloadTab':
      browser.tabs.reload(mContextTab.id);
      break;
    case 'context_toggleMuteTab-mute':
      browser.tabs.update(mContextTab.id, { muted: true });
      break;
    case 'context_toggleMuteTab-unmute':
      browser.tabs.update(mContextTab.id, { muted: false });
      break;
    case 'context_pinTab':
      browser.tabs.update(mContextTab.id, { pinned: true });
      break;
    case 'context_unpinTab':
      browser.tabs.update(mContextTab.id, { pinned: false });
      break;
    case 'context_duplicateTab':
      /*
        Due to difference between Firefox's "duplicate tab" implementation,
        TST sometimes fails to detect duplicated tabs based on its
        session information. Thus we need to duplicate as an internally
        duplicated tab. For more details, see also:
        https://github.com/piroor/treestyletab/issues/1437#issuecomment-334952194
      */
      // browser.tabs.duplicate(mContextTab.id);
      return (async () => {
        const sourceTab = Tabs.getTabById(mContextTab);
        log('source tab: ', sourceTab, !!sourceTab.apiTab);
        const duplicatedTabs = await Tree.moveTabs([sourceTab], {
          duplicate:           true,
          destinationWindowId: mContextWindowId,
          insertAfter:         sourceTab,
          inRemote:            true
        });
        Tree.behaveAutoAttachedTab(duplicatedTabs[0], {
          baseTab:  sourceTab,
          behavior: configs.autoAttachOnDuplicated,
          inRemote: true
        });
      })();
    case 'context_openTabInWindow':
      await browser.windows.create({
        tabId:     mContextTab.id,
        incognito: mContextTab.incognito
      });
      break;
    case 'context_reloadAllTabs': {
      const apiTabs = await browser.tabs.query({ windowId: mContextWindowId });
      for (const apiTab of apiTabs) {
        browser.tabs.reload(apiTab.id);
      }
    }; break;
    case 'context_bookmarkAllTabs': {
      const apiTabs = await browser.tabs.query({ windowId: mContextWindowId });
      const folder = await Bookmark.bookmarkTabs(apiTabs.map(Tabs.getTabById));
      if (folder)
        browser.bookmarks.get(folder.parentId).then(folders => {
          notify({
            title:   browser.i18n.getMessage('bookmarkTabs_notification_success_title'),
            message: browser.i18n.getMessage('bookmarkTabs_notification_success_message', [
              apiTabs[0].title,
              apiTabs.length,
              folders[0].title
            ]),
            icon:    Constants.kNOTIFICATION_DEFAULT_ICON
          });
        });
    }; break;
    case 'context_closeTabsToTheEnd': {
      const apiTabs = await browser.tabs.query({ windowId: mContextWindowId });
      let after = false;
      const closeAPITabs = [];
      for (const apiTab of apiTabs) {
        if (apiTab.id == mContextTab.id) {
          after = true;
          continue;
        }
        if (after && !apiTab.pinned)
          closeAPITabs.push(apiTab);
      }
      const canceled = (await onTabsClosing.dispatch(closeAPITabs.length, { windowId: mContextWindowId })) === false;
      if (canceled)
        return;
      browser.tabs.remove(closeAPITabs.map(aPITab => aPITab.id));
    }; break;
    case 'context_closeOtherTabs': {
      const apiTabId = mContextTab.id; // cache it for delayed tasks!
      const apiTabs  = await browser.tabs.query({ windowId: mContextWindowId });
      const closeAPITabs = apiTabs.filter(aPITab => !aPITab.pinned && aPITab.id != apiTabId).map(aPITab => aPITab.id);
      const canceled = (await onTabsClosing.dispatch(closeAPITabs.length, { windowId: mContextWindowId })) === false;
      if (canceled)
        return;
      browser.tabs.remove(closeAPITabs);
    }; break;
    case 'context_undoCloseTab': {
      const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
      if (sessions.length && sessions[0].tab)
        browser.sessions.restore(sessions[0].tab.sessionId);
    }; break;
    case 'context_closeTab':
      browser.tabs.remove(mContextTab.id);
      break;

    default: {
      const id = item.getAttribute('data-item-id');
      if (id) {
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
        const message = {
          type: TSTAPI.kCONTEXT_MENU_CLICK,
          info: {
            checked:          false,
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
            wasChecked:       false
          },
          tab: mContextTab || null
        };
        const owner = item.getAttribute('data-item-owner-id');
        if (owner == browser.runtime.id)
          await browser.runtime.sendMessage(message);
        else
          await browser.runtime.sendMessage(owner, message);
      }
    }; break;
  }
}

function onMessage(message, _aSender) {
  log('tab-context-menu: internally called:', message);
  switch (message.type) {
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
  log('tab-context-menu: API called:', message, sender);
  switch (message.type) {
    case TSTAPI.kCONTEXT_MENU_OPEN:
      return (async () => {
        const tab      = message.tab ? (await browser.tabs.get(message.tab)) : null ;
        const windowId = message.window || tab && tab.windowId;
        if (windowId != Tabs.getWindow())
          return;
        return open({
          tab:      tab,
          windowId: windowId,
          left:     message.left,
          top:      message.top
        });
      })();
  }
}


function onContextMenu(event) {
  if (!configs.fakeContextMenu)
    return;
  event.stopPropagation();
  event.preventDefault();
  const tab = EventUtils.getTabFromEvent(event);
  open({
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
