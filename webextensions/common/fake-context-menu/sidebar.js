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

var tabContextMenu = {
  init() {
    this.ui = new MenuUI({
      root: this.menu,
      onCommand: (aItem, aEvent) => {
        return this.onCommand(aItem, aEvent);
      },
      appearance:        'menu',
      animationDuration: configs.collapseDuration,
      subMenuOpenDelay:  configs.subMenuOpenDelay,
      subMenuCloseDelay: configs.subMenuCloseDelay
    });

    this.onMessage         = this.onMessage.bind(this);
    this.onExternalMessage = this.onExternalMessage.bind(this);

    browser.runtime.onMessage.addListener(this.onMessage);
    browser.runtime.onMessageExternal.addListener(this.onExternalMessage);

    window.addEventListener('unload', () => {
      this.close();
      browser.runtime.onMessage.removeListener(this.onMessage);
      browser.runtime.onMessageExternal.removeListener(this.onExternalMessage);
    }, { once: true });

    browser.runtime.sendMessage({
      type: kTSTAPI_CONTEXT_MENU_GET_ITEMS
    }).then(aItems => {
      this.extraItems = aItems;
      this.dirty      = true;
    });
  },

  get menu() {
    return document.querySelector('#tabContextMenu');
  },

  contextTab: null,
  extraItems: {},
  dirty:      false,

  rebuild: async function() {
    if (!this.dirty)
      return;

    var firstExtraItem = this.menu.querySelector('.extra');
    if (firstExtraItem) {
      let range = document.createRange();
      range.selectNodeContents(this.menu);
      range.setStartBefore(firstExtraItem);
      range.deleteContents();
      range.detach();
    }

    if (Object.keys(this.extraItems).length == 0)
      return;

    var extraItemNodes = document.createDocumentFragment();
    for (let id of Object.keys(this.extraItems)) {
      let addonItem = document.createElement('li');
      const name = this.getAddonName(id);
      addonItem.appendChild(document.createTextNode(name));
      addonItem.setAttribute('title', name);
      addonItem.classList.add('extra');
      const icon = this.getAddonIcon(id);
      if (icon)
        addonItem.dataset.icon = icon;
      this.prepareAsSubmenu(addonItem);

      const toBeBuiltItems = [];
      for (let item of this.extraItems[id]) {
        if (item.contexts && item.contexts.indexOf('tab') < 0)
          continue;
        if (this.contextTab &&
            item.documentUrlPatterns &&
            !this.matchesToCurrentTab(item.documentUrlPatterns))
          continue;
        toBeBuiltItems.push(item);
      }
      const topLevelItems = toBeBuiltItems.filter(aItem => !aItem.parentId);
      if (topLevelItems.length == 1 &&
          !topLevelItems[0].icons)
        topLevelItems[0].icons = gExternalListenerAddons[id].icons || {};

      const addonSubMenu = addonItem.lastChild;
      const knownItems   = {};
      for (let item of toBeBuiltItems) {
        let itemNode = this.buildExtraItem(item, id);
        if (item.parentId && item.parentId in knownItems) {
          let parent = knownItems[item.parentId];
          this.prepareAsSubmenu(parent);
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
    this.menu.appendChild(extraItemNodes);
  },
  getAddonName(aId) {
    if (aId == browser.runtime.id)
      return browser.i18n.getMessage('extensionName');
    const addon = gExternalListenerAddons[aId] || {};
    return addon.name || aId.replace(/@.+$/, '');
  },
  getAddonIcon(aId) {
    const addon = gExternalListenerAddons[aId] || {};
    return this.chooseIconForAddon({
      id:         aId,
      internalId: addon.internalId,
      icons:      addon.icons || {}
    });
  },
  chooseIconForAddon(aParams) {
    const icons = aParams.icons || {};
    const addon = gExternalListenerAddons[aParams.id] || {};
    const sizes = Object.keys(icons).map(aSize => parseInt(aSize)).sort();
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
  },
  prepareAsSubmenu(aItemNode) {
    if (aItemNode.querySelector('ul'))
      return aItemNode;
    var subMenu = aItemNode.appendChild(document.createElement('ul'));
    return aItemNode;
  },
  buildExtraItem(aItem, aOwnerAddonId) {
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
    const addon = gExternalListenerAddons[aOwnerAddonId] || {};
    const icon = this.chooseIconForAddon({
      id:         aOwnerAddonId,
      internalId: addon.internalId,
      icons:      aItem.icons || {}
    });
    if (icon)
      itemNode.dataset.icon = icon;
    return itemNode;
  },

  matchesToCurrentTab(aPatterns) {
    if (!Array.isArray(aPatterns))
      aPatterns = [aPatterns];
    for (let pattern of aPatterns) {
      if (this.matchPatternToRegExp(pattern).test(this.contextTab.url))
        return true;
    }
    return false;
  },
  // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
  matchPattern: /^(?:(\*|http|https|file|ftp|app):\/\/([^\/]+|)\/?(.*))$/i,
  matchPatternToRegExp(aPattern) {
    if (aPattern === '<all_urls>')
      return (/^(?:https?|file|ftp|app):\/\//);
    const match = this.matchPattern.exec(aPattern);
    if (!match)
      throw new TypeError(`"${aPattern}" is not a valid MatchPattern`);

    const [, scheme, host, path,] = match;
    return new RegExp('^(?:'
                      + (scheme === '*' ? 'https?' : escape(scheme)) + ':\\/\\/'
                      + (host === '*' ? '[^\\/]*' : escape(host).replace(/^\*\./g, '(?:[^\\/]+)?'))
                      + (path ? (path == '*' ? '(?:\\/.*)?' : ('\\/' + escape(path).replace(/\*/g, '.*'))) : '\\/?')
                      + ')$');
  },

  open: async function(aOptions = {}) {
    await this.close();
    this.contextTab      = aOptions.tab;
    this.contextWindowId = aOptions.windowId || (this.contextTab && this.contextTab.windowId);
    await this.rebuild();
    this.applyContext();
    this.ui.open(aOptions);
  },

  close: async function() {
    await this.ui.close();
    this.menu.removeAttribute('data-tab-id');
    this.menu.removeAttribute('data-tab-states');
    this.contextTab      = null;
    this.contextWindowId = null;
  },

  applyContext() {
    if (this.contextTab) {
      this.menu.setAttribute('data-tab-id', this.contextTab.id);
      let states = [];
      if (this.contextTab.active)
        states.push('active');
      if (this.contextTab.pinned)
        states.push('pinned');
      if (this.contextTab.audible)
        states.push('audible');
      if (this.contextTab.mutedInfo && this.contextTab.mutedInfo.muted)
        states.push('muted');
      if (this.contextTab.discarded)
        states.push('discarded');
      if (this.contextTab.incognito)
        states.push('incognito');
      this.menu.setAttribute('data-tab-states', states.join(' '));
    }

    if (getTabs().length > 1)
      this.menu.classList.add('has-multiple-tabs');
    else
      this.menu.classList.remove('has-multiple-tabs');

    switch (getNormalTabs().length) {
      case 0:
        this.menu.classList.remove('has-normal-tabs');
        this.menu.classList.remove('has-multiple-normal-tabs');
        break;
      case 1:
        this.menu.classList.add('has-normal-tabs');
        this.menu.classList.remove('has-multiple-normal-tabs');
        break;
      default:
        this.menu.classList.add('has-normal-tabs');
        this.menu.classList.add('has-multiple-normal-tabs');
        break;
    }
  },

  onCommand: async function(aItem, aEvent) {
    if (aEvent.button == 1)
      return;

    switch (aItem.id) {
      case 'context_reloadTab':
        browser.tabs.reload(this.contextTab.id);
        break;
      case 'context_toggleMuteTab-mute':
        browser.tabs.update(this.contextTab.id, { muted: true });
        break;
      case 'context_toggleMuteTab-unmute':
        browser.tabs.update(this.contextTab.id, { muted: false });
        break;
      case 'context_pinTab':
        browser.tabs.update(this.contextTab.id, { pinned: true });
        break;
      case 'context_unpinTab':
        browser.tabs.update(this.contextTab.id, { pinned: false });
        break;
      case 'context_duplicateTab':
        /*
          Due to difference between Firefox's "duplicate tab" implementation,
          TST sometimes fails to detect duplicated tabs based on its
          session information. Thus we need to duplicate as an internally
          duplicated tab. For more details, see also:
          https://github.com/piroor/treestyletab/issues/1437#issuecomment-334952194
        */
        // browser.tabs.duplicate(this.contextTab.id);
        return (async () => {
          let sourceTab = getTabById(this.contextTab);
          //console.log('source tab: ', sourceTab, !!sourceTab.apiTab);
          let duplicatedTabs = await moveTabs([sourceTab], {
            duplicate:           true,
            destinationWindowId: this.contextWindowId,
            insertAfter:         sourceTab,
            inRemote:            true
          });
          behaveAutoAttachedTab(duplicatedTabs[0], {
            baseTab:  sourceTab,
            behavior: configs.autoAttachOnDuplicated,
            inRemote: true
          });
        })();
      case 'context_openTabInWindow':
        await browser.windows.create({
          tabId:     this.contextTab.id,
          incognito: this.contextTab.incognito
        });
        break;
      case 'context_reloadAllTabs': {
        let apiTabs = await browser.tabs.query({ windowId: this.contextWindowId });
        for (let apiTab of apiTabs) {
          browser.tabs.reload(apiTab.id);
        }
      }; break;
      case 'context_bookmarkAllTabs': {
        let apiTabs = await browser.tabs.query({ windowId: this.contextWindowId });
        let folder = await bookmarkTabs(apiTabs.map(getTabById));
        if (folder)
          browser.bookmarks.get(folder.parentId).then(aFolders => {
            notify({
              title:   browser.i18n.getMessage('bookmarkTabs_notification_success_title'),
              message: browser.i18n.getMessage('bookmarkTabs_notification_success_message', [
                apiTabs[0].title,
                apiTabs.length,
                aFolders[0].title
              ]),
              icon:    kNOTIFICATION_DEFAULT_ICON
            });
          });
      }; break;
      case 'context_closeTabsToTheEnd': {
        let apiTabs = await browser.tabs.query({ windowId: this.contextWindowId });
        let after = false;
        let closeAPITabs = [];
        for (let apiTab of apiTabs) {
          if (apiTab.id == this.contextTab.id) {
            after = true;
            continue;
          }
          if (after && !apiTab.pinned)
            closeAPITabs.push(apiTab);
        }
        confirmToCloseTabs(closeAPITabs.length, { windowId: this.contextWindowId })
          .then(aConfirmed => {
            if (!aConfirmed)
              return;
            browser.tabs.remove(closeAPITabs.map(aAPITab => aAPITab.id));
          });
      }; break;
      case 'context_closeOtherTabs': {
        let apiTabId = this.contextTab.id; // cache it for delayed tasks!
        let apiTabs  = await browser.tabs.query({ windowId: this.contextWindowId });
        let closeAPITabs = apiTabs.filter(aAPITab => !aAPITab.pinned && aAPITab.id != apiTabId).map(aAPITab => aAPITab.id);
        confirmToCloseTabs(closeAPITabs.length, { windowId: this.contextWindowId })
          .then(aConfirmed => {
            if (!aConfirmed)
              return;
            browser.tabs.remove(closeAPITabs);
          });
      }; break;
      case 'context_undoCloseTab': {
        let sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
        if (sessions.length && sessions[0].tab)
          browser.sessions.restore(sessions[0].tab.sessionId);
      }; break;
      case 'context_closeTab':
        browser.tabs.remove(this.contextTab.id);
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
            type: kTSTAPI_CONTEXT_MENU_CLICK,
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
            tab: this.contextTab || null
          };
          let owner = aItem.getAttribute('data-item-owner-id');
          if (owner == browser.runtime.id)
            await browser.runtime.sendMessage(message);
          else
            await browser.runtime.sendMessage(owner, message);
        }
      }; break;
    }
    this.close();
  },

  onMessage(aMessage, aSender) {
    switch (aMessage.type) {
      case kTSTAPI_CONTEXT_MENU_UPDATED: {
        this.extraItems = aMessage.items;
        this.dirty = true;
      }; break;
    }
  },

  onExternalMessage(aMessage, aSender) {
    switch (aMessage.type) {
      case kTSTAPI_CONTEXT_MENU_OPEN:
        return (async () => {
          var tab      = aMessage.tab ? (await browser.tabs.get(aMessage.tab)) : null ;
          var windowId = aMessage.window || tab && tab.windowId;
          if (windowId != gTargetWindow)
            return;
          return tabContextMenu.open({
            tab:      tab,
            windowId: windowId,
            left:     aMessage.left,
            top:      aMessage.top
          });
        })();
    }
  }
};
