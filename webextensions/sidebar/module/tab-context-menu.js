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

import {
  log,
  wait,
  notify,
  configs
} from '../../common/common.js';
import * as Constants from '../../common/constants.js';
import * as Tabs from '../../common/tabs.js';
import * as Tree from '../../common/tree.js';
import * as Bookmark from '../../common/bookmark.js';
import * as TSTAPI from '../../common/tst-api.js';
import EventListenerManager from '../../common/EventListenerManager.js';
import MenuUI from '../../common/MenuUI.js';

export const onTabsClosing = new EventListenerManager();

let ui;
let menu;

let contextTab      = null;
let lastOpenOptions = null;
let contextWindowId = null;
let extraItems      = {};
let dirty           = false;

  export function init() {
    menu = document.querySelector('#tabContextMenu');

    ui = new MenuUI({
      root: menu,
      onCommand,
      appearance:        'menu',
      animationDuration: configs.animation ? configs.collapseDuration : 0.001,
      subMenuOpenDelay:  configs.subMenuOpenDelay,
      subMenuCloseDelay: configs.subMenuCloseDelay
    });

    browser.runtime.onMessage.addListener(onMessage);
    browser.runtime.onMessageExternal.addListener(onExternalMessage);

    window.addEventListener('unload', () => {
      close();
      browser.runtime.onMessage.removeListener(onMessage);
      browser.runtime.onMessageExternal.removeListener(onExternalMessage);
    }, { once: true });

    browser.runtime.sendMessage({
      type: TSTAPI.kCONTEXT_MENU_GET_ITEMS
    }).then(aItems => {
      extraItems = aItems;
      dirty      = true;
    });
  }

  async function rebuild() {
    if (!dirty)
      return;

    dirty = false;

    var firstExtraItem = menu.querySelector('.extra');
    if (firstExtraItem) {
      let range = document.createRange();
      range.selectNodeContents(menu);
      range.setStartBefore(firstExtraItem);
      range.deleteContents();
      range.detach();
    }

    if (Object.keys(extraItems).length == 0)
      return;

    var extraItemNodes = document.createDocumentFragment();
    for (let id of Object.keys(extraItems)) {
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
      for (let item of extraItems[id]) {
        if (item.contexts && item.contexts.indexOf('tab') < 0)
          continue;
        if (contextTab &&
            item.documentUrlPatterns &&
            !matchesToCurrentTab(item.documentUrlPatterns))
          continue;
        toBeBuiltItems.push(item);
      }
      const topLevelItems = toBeBuiltItems.filter(aItem => !aItem.parentId);
      if (topLevelItems.length == 1 &&
          !topLevelItems[0].icons)
        topLevelItems[0].icons = TSTAPI.addons[id].icons || {};

      const addonSubMenu = addonItem.lastChild;
      const knownItems   = {};
      for (let item of toBeBuiltItems) {
        let itemNode = buildExtraItem(item, id);
        if (item.parentId && item.parentId in knownItems) {
          let parent = knownItems[item.parentId];
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

    var separator = document.createElement('li');
    separator.classList.add('extra');
    separator.classList.add('separator');
    extraItemNodes.insertBefore(separator, extraItemNodes.firstChild);
    menu.appendChild(extraItemNodes);
  }

  function getAddonName(aId) {
    if (aId == browser.runtime.id)
      return browser.i18n.getMessage('extensionName');
    const addon = TSTAPI.addons[aId] || {};
    return addon.name || aId.replace(/@.+$/, '');
  }

  function getAddonIcon(aId) {
    const addon = TSTAPI.addons[aId] || {};
    return chooseIconForAddon({
      id:         aId,
      internalId: addon.internalId,
      icons:      addon.icons || {}
    });
  }

  function chooseIconForAddon(aParams) {
    const icons = aParams.icons || {};
    const addon = TSTAPI.addons[aParams.id] || {};
    let sizes = Object.keys(icons).map(aSize => parseInt(aSize)).sort();
    const reducedSizes = sizes.filter(aSize => aSize < 16);
    if (reducedSizes.length > 0)
      sizes = reducedSizes;
    const size = sizes[0] || null;
    if (!size)
      return null;
    let url = icons[size];
    if (!/^\w+:\/\//.test(url))
      url = `moz-extension://${addon.internalId || aParams.internalId}/${url.replace(/^\//, '')}`;
    return url;
  }

  function prepareAsSubmenu(aItemNode) {
    if (aItemNode.querySelector('ul'))
      return aItemNode;
    aItemNode.appendChild(document.createElement('ul'));
    return aItemNode;
  }

  function buildExtraItem(aItem, aOwnerAddonId) {
    var itemNode = document.createElement('li');
    itemNode.setAttribute('id', `${aOwnerAddonId}-${aItem.id}`);
    itemNode.setAttribute('data-item-id', aItem.id);
    itemNode.setAttribute('data-item-owner-id', aOwnerAddonId);
    itemNode.classList.add('extra');
    itemNode.classList.add(aItem.type || 'normal');
    if (aItem.type == 'checkbox' || aItem.type == 'radio') {
      if (aItem.checked)
        itemNode.classList.add('checked');
    }
    if (aItem.type != 'separator') {
      itemNode.appendChild(document.createTextNode(aItem.title));
      itemNode.setAttribute('title', aItem.title);
    }
    if (aItem.enabled === false)
      itemNode.classList.add('disabled');
    else
      itemNode.classList.remove('disabled');;
    const addon = TSTAPI.addons[aOwnerAddonId] || {};
    const icon = chooseIconForAddon({
      id:         aOwnerAddonId,
      internalId: addon.internalId,
      icons:      aItem.icons || {}
    });
    if (icon)
      itemNode.dataset.icon = icon;
    return itemNode;
  }

  function matchesToCurrentTab(aPatterns) {
    if (!Array.isArray(aPatterns))
      aPatterns = [aPatterns];
    for (let pattern of aPatterns) {
      if (matchPatternToRegExp(pattern).test(contextTab.url))
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

  export async function open(aOptions = {}) {
    await close();
    lastOpenOptions = aOptions;
    contextTab      = aOptions.tab;
    contextWindowId = aOptions.windowId || (contextTab && contextTab.windowId);
    await rebuild();
    if (dirty) {
      return await open(aOptions);
    }
    applyContext();
    const originalCanceller = aOptions.canceller;
    aOptions.canceller = () => {
      return (typeof originalCanceller == 'function' && originalCanceller()) || dirty;
    };
    await ui.open(aOptions);
    if (dirty) {
      return await open(aOptions);
    }
  }

  export async function close() {
    await ui.close();
    menu.removeAttribute('data-tab-id');
    menu.removeAttribute('data-tab-states');
    contextTab      = null;
    contextWindowId = null;
    lastOpenOptions = null;
  }

  function applyContext() {
    if (contextTab) {
      menu.setAttribute('data-tab-id', contextTab.id);
      let states = [];
      if (contextTab.active)
        states.push('active');
      if (contextTab.pinned)
        states.push('pinned');
      if (contextTab.audible)
        states.push('audible');
      if (contextTab.mutedInfo && contextTab.mutedInfo.muted)
        states.push('muted');
      if (contextTab.discarded)
        states.push('discarded');
      if (contextTab.incognito)
        states.push('incognito');
      menu.setAttribute('data-tab-states', states.join(' '));
    }

    if (Tabs.getTabs().length > 1)
      menu.classList.add('has-multiple-tabs');
    else
      menu.classList.remove('has-multiple-tabs');

    switch (Tabs.getNormalTabs().length) {
      case 0:
        menu.classList.remove('has-normal-tabs');
        menu.classList.remove('has-multiple-normal-tabs');
        break;
      case 1:
        menu.classList.add('has-normal-tabs');
        menu.classList.remove('has-multiple-normal-tabs');
        break;
      default:
        menu.classList.add('has-normal-tabs');
        menu.classList.add('has-multiple-normal-tabs');
        break;
    }
  }

  async function onCommand(aItem, aEvent) {
    if (aEvent.button == 1)
      return;

    wait(0).then(() => close()); // close the menu immediately!

    switch (aItem.id) {
      case 'context_reloadTab':
        browser.tabs.reload(contextTab.id);
        break;
      case 'context_toggleMuteTab-mute':
        browser.tabs.update(contextTab.id, { muted: true });
        break;
      case 'context_toggleMuteTab-unmute':
        browser.tabs.update(contextTab.id, { muted: false });
        break;
      case 'context_pinTab':
        browser.tabs.update(contextTab.id, { pinned: true });
        break;
      case 'context_unpinTab':
        browser.tabs.update(contextTab.id, { pinned: false });
        break;
      case 'context_duplicateTab':
        /*
          Due to difference between Firefox's "duplicate tab" implementation,
          TST sometimes fails to detect duplicated tabs based on its
          session information. Thus we need to duplicate as an internally
          duplicated tab. For more details, see also:
          https://github.com/piroor/treestyletab/issues/1437#issuecomment-334952194
        */
        // browser.tabs.duplicate(contextTab.id);
        return (async () => {
          let sourceTab = Tabs.getTabById(contextTab);
          if (configs.logOnFakeContextMenu)
            log('source tab: ', sourceTab, !!sourceTab.apiTab);
          let duplicatedTabs = await Tree.moveTabs([sourceTab], {
            duplicate:           true,
            destinationWindowId: contextWindowId,
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
          tabId:     contextTab.id,
          incognito: contextTab.incognito
        });
        break;
      case 'context_reloadAllTabs': {
        let apiTabs = await browser.tabs.query({ windowId: contextWindowId });
        for (let apiTab of apiTabs) {
          browser.tabs.reload(apiTab.id);
        }
      }; break;
      case 'context_bookmarkAllTabs': {
        let apiTabs = await browser.tabs.query({ windowId: contextWindowId });
        let folder = await Bookmark.bookmarkTabs(apiTabs.map(Tabs.getTabById));
        if (folder)
          browser.bookmarks.get(folder.parentId).then(aFolders => {
            notify({
              title:   browser.i18n.getMessage('bookmarkTabs_notification_success_title'),
              message: browser.i18n.getMessage('bookmarkTabs_notification_success_message', [
                apiTabs[0].title,
                apiTabs.length,
                aFolders[0].title
              ]),
              icon:    Constants.kNOTIFICATION_DEFAULT_ICON
            });
          });
      }; break;
      case 'context_closeTabsToTheEnd': {
        let apiTabs = await browser.tabs.query({ windowId: contextWindowId });
        let after = false;
        let closeAPITabs = [];
        for (let apiTab of apiTabs) {
          if (apiTab.id == contextTab.id) {
            after = true;
            continue;
          }
          if (after && !apiTab.pinned)
            closeAPITabs.push(apiTab);
        }
        const canceled = (await onTabsClosing.dispatch(closeAPITabs.length, { windowId: contextWindowId })) === false;
        if (canceled)
          return;
            browser.tabs.remove(closeAPITabs.map(aAPITab => aAPITab.id));
      }; break;
      case 'context_closeOtherTabs': {
        let apiTabId = contextTab.id; // cache it for delayed tasks!
        let apiTabs  = await browser.tabs.query({ windowId: contextWindowId });
        let closeAPITabs = apiTabs.filter(aAPITab => !aAPITab.pinned && aAPITab.id != apiTabId).map(aAPITab => aAPITab.id);
        const canceled = (await onTabsClosing.dispatch(closeAPITabs.length, { windowId: contextWindowId })) === false;
        if (canceled)
              return;
            browser.tabs.remove(closeAPITabs);
      }; break;
      case 'context_undoCloseTab': {
        let sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
        if (sessions.length && sessions[0].tab)
          browser.sessions.restore(sessions[0].tab.sessionId);
      }; break;
      case 'context_closeTab':
        browser.tabs.remove(contextTab.id);
        break;

      default: {
        let id = aItem.getAttribute('data-item-id');
        if (id) {
          var modifiers = [];
          if (aEvent.metaKey)
            modifiers.push('Command');
          if (aEvent.ctrlKey) {
            modifiers.push('Ctrl');
            if (/^Mac/i.test(navigator.platform))
              modifiers.push('MacCtrl');
          }
          if (aEvent.shiftKey)
            modifiers.push('Shift');
          let message = {
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
            tab: contextTab || null
          };
          let owner = aItem.getAttribute('data-item-owner-id');
          if (owner == browser.runtime.id)
            await browser.runtime.sendMessage(message);
          else
            await browser.runtime.sendMessage(owner, message);
        }
      }; break;
    }
  }

  function onMessage(aMessage, _aSender) {
    if (configs.logOnFakeContextMenu)
      log('fake-context-menu: internally called:', aMessage);
    switch (aMessage.type) {
      case TSTAPI.kCONTEXT_MENU_UPDATED: {
        extraItems = aMessage.items;
        dirty = true;
        if (ui.opened)
          open(lastOpenOptions);
      }; break;
    }
  }

  function onExternalMessage(aMessage, aSender) {
    if (configs.logOnFakeContextMenu)
      log('fake-context-menu: API called:', aMessage, aSender);
    switch (aMessage.type) {
      case TSTAPI.kCONTEXT_MENU_OPEN:
        return (async () => {
          var tab      = aMessage.tab ? (await browser.tabs.get(aMessage.tab)) : null ;
          var windowId = aMessage.window || tab && tab.windowId;
          if (windowId != Tabs.getWindow())
            return;
          return open({
            tab:      tab,
            windowId: windowId,
            left:     aMessage.left,
            top:      aMessage.top
          });
        })();
    }
  }
