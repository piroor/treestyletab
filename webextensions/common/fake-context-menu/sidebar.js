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
    this.onBlur            = this.onBlur.bind(this);
    this.onMouseDown       = this.onMouseDown.bind(this);
    this.onClick           = this.onClick.bind(this);
    this.onMessage         = this.onMessage.bind(this);
    this.onExternalMessage = this.onExternalMessage.bind(this);

    window.addEventListener('blur', this.onBlur, { capture: true });
    browser.runtime.onMessage.addListener(this.onMessage);
    browser.runtime.onMessageExternal.addListener(this.onExternalMessage);

    window.addEventListener('unload', () => {
      this.onClosed();
      window.removeEventListener('blur', this.onBlur, { capture: true });
      browser.runtime.onMessage.removeListener(this.onMessage);
      browser.runtime.onMessageExternal.removeListener(this.onExternalMessage);
    }, { once: true });

    browser.runtime.sendMessage({
      type: kTSTAPI_CONTEXT_MENU_GET_ITEMS
    }).then(aItems => {
      this.extraItems = aItems;
      this.dirty = true;
    });
  },

  get menu() {
    return document.querySelector('#tabContextMenu');
  },
  get containerRect() {
    var allRange = document.createRange();
    allRange.selectNodeContents(document.body);
    var containerRect = allRange.getBoundingClientRect();
    allRange.detach();
    return containerRect;
  },

  contextTab: null,
  extraItems: {},
  dirty: false,

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

    var addons = await browser.runtime.sendMessage({
      type: kCOMMAND_REQUEST_REGISTERED_ADDONS
    });
    var extraItemNodes = document.createDocumentFragment();
    for (let id of Object.keys(this.extraItems)) {
      let addonItem = document.createElement('li');
      let name = (id == browser.runtime.id) ?
        browser.i18n.getMessage('extensionName') :
        addons[id].name || id.replace(/@.+$/, '') ;
      addonItem.appendChild(document.createTextNode(name));
      addonItem.classList.add('extra');
      this.prepareAsSubmenu(addonItem);
      let addonSubMenu = addonItem.lastChild;
      let knownItems = {};
      for (let item of this.extraItems[id]) {
        if (item.contexts && item.contexts.indexOf('tab') < 0)
          continue;
        if (this.contextTab &&
            item.documentUrlPatterns &&
            !this.matchesToCurrentTab(item.documentUrlPatterns))
          continue;
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
  prepareAsSubmenu(aItemNode) {
    if (aItemNode.classList.contains('has-submenu'))
      return aItemNode;
    aItemNode.classList.add('has-submenu');
    var subMenu = aItemNode.appendChild(document.createElement('ul'));
    return aItemNode;
  },
  buildExtraItem(aItem, aOwnerId) {
    var itemNode = document.createElement('li');
    itemNode.setAttribute('id', `${aOwnerId}-${aItem.id}`);
    itemNode.setAttribute('data-item-id', aItem.id);
    itemNode.setAttribute('data-item-owner-id', aOwnerId);
    itemNode.classList.add('extra');
    itemNode.classList.add(aItem.type);
    if (aItem.type == 'checkbox' || aItem.type == 'radio') {
      if (aItem.checked)
        itemNode.classList.add('checked');
    }
    if (aItem.type != 'separator') {
      itemNode.appendChild(document.createTextNode(aItem.title));
      itemNode.setAttribute('title', aItem.title);
    }
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
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      delete this.closeTimeout;
      this.onClosed();
    }
    this.contextTab = aOptions.tab;
    this.contextWindowId = aOptions.windowId;
    await this.rebuild();
    this.applyContext();
    this.menu.classList.add('open');
    var menus = [this.menu].concat(Array.slice(this.menu.querySelectorAll('ul')));
    for (let menu of menus) {
      this.updatePosition(menu, aOptions);
    }
    setTimeout(() => {
      window.addEventListener('mousedown', this.onMouseDown, { capture: true });
      window.addEventListener('click', this.onClick, { capture: true });
    }, configs.collapseDuration);
  },

  close() {
    if (!this.menu.classList.contains('open'))
      return;
    this.menu.classList.remove('open');
    this.contextTab = null;
    this.contextWindowId = null;
    this.closeTimeout = setTimeout(() => {
      delete this.closeTimeout;
      this.onClosed();
    }, configs.collapseDuration);
  },
  onClosed() {
    var menus = [this.menu].concat(Array.slice(this.menu.querySelectorAll('ul')));
    for (let menu of menus) {
      this.updatePosition(menu, { left: 0, right: 0 });
    }
    this.menu.removeAttribute('data-tab-id');
    this.menu.removeAttribute('data-tab-states');
    window.removeEventListener('mousedown', this.onMouseDown, { capture: true });
    window.removeEventListener('click', this.onClick, { capture: true });
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

  updatePosition(aMenu, aOptions = {}) {
    var left = aOptions.left;
    var top = aOptions.top;

    if (aMenu.parentNode.localName == 'li') {
      let parentRect = aMenu.parentNode.getBoundingClientRect();
      left = parentRect.right;
      top = parentRect.top;
    }

    let menuRect = aMenu.getBoundingClientRect();
    let containerRect = this.containerRect;
    left = left || Math.max(0, (containerRect.width - menuRect.width) / 2);
    top = top || Math.max(0, (containerRect.height - menuRect.height) / 2);

    left = Math.min(left, containerRect.width - menuRect.width - 3);
    top = Math.min(top, containerRect.height - menuRect.height - 3);
    aMenu.style.left = `${left}px`;
    aMenu.style.top = `${top}px`;
  },

  onBlur() {
    this.close();
  },

  onMouseDown(aEvent) {
    aEvent.stopImmediatePropagation();
    aEvent.stopPropagation();
    aEvent.preventDefault();
  },

  getEffectiveTargetItem(aEvent) {
    var target = aEvent.target;
    while (target.nodeType != target.ELEMENT_NODE) {
      target = target.parentNode;
    }
    var untransparentTarget = target;
    while (untransparentTarget) {
      if (parseFloat(window.getComputedStyle(untransparentTarget, null).opacity) < 1)
        return null;
      untransparentTarget = untransparentTarget.parentNode;
      if (untransparentTarget == document)
        break;
    }
    return target;
  },

  onClick: async function(aEvent) {
    if (aEvent.button != 0)
      return this.close();

    aEvent.stopImmediatePropagation();
    aEvent.stopPropagation();
    aEvent.preventDefault();

    var target = this.getEffectiveTargetItem(aEvent);
    if (!target ||
        target.classList.contains('has-submenu') ||
        !target.id) {
      let elementTarget = aEvent.target;
      if (elementTarget.nodeType != Node.ELEMENT_NODE)
        elementTarget = elementTarget.parentNode;
      if (!elementTarget.matches(`#${this.menu.id} *`))
        return this.close();
      return;
    }

    switch (target.id) {
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
          let sourceTab = getTabById(this.contextTab.id);
          console.log('source tab: ', sourceTab, !!sourceTab.apiTab);
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
      case 'context_openTabInWindow': {
        let tabId = this.contextTab.id; // cache it for delayed tasks!
        let window = await browser.windows.create({ url: 'about:blank' })
        await browser.tabs.move(tabId, { index: 1, windowId: window.id });
        let tabs = await browser.tabs.query({ windowId: window.id });
        browser.tabs.remove(tabs[0].id);
      }; break;
      case 'context_reloadAllTabs': {
        let tabs = await browser.tabs.query({ windowId: this.contextWindowId });
        for (let tab of tabs) {
          browser.tabs.reload(tab.id);
        }
      }; break;
      case 'context_bookmarkAllTabs': {
        let tabs = await browser.tabs.query({ windowId: this.contextWindowId });
        let folder = await bookmarkTabs(tabs.map(aTab => getTabById(aTab.id)));
        browser.bookmarks.get(folder.parentId).then(aFolders => {
          notify({
            title:   browser.i18n.getMessage('bookmarkTree.notification.title'),
            message: browser.i18n.getMessage('bookmarkTree.notification.message', [
              tabs[0].title,
              tabs.length,
              aFolders[0].title
            ]),
            icon:    kNOTIFICATION_DEFAULT_ICON
          });
        });
      }; break;
      case 'context_closeTabsToTheEnd': {
        let tabs = await browser.tabs.query({ windowId: this.contextWindowId });
        let after = false;
        for (let tab of tabs) {
          if (tab.id == this.contextTab.id) {
            after = true;
            continue;
          }
          if (!after)
            continue;
          browser.tabs.remove(tab.id);
        }
      }; break;
      case 'context_closeOtherTabs': {
        let tabId = this.contextTab.id; // cache it for delayed tasks!
        let tabs = await browser.tabs.query({ windowId: this.contextWindowId });
        for (let tab of tabs) {
          if (!tab.pinned && tab.id != tabId)
            browser.tabs.remove(tab.id);
        }
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
        let id = target.getAttribute('data-item-id');
        if (id) {
          var modifiers = [];
          if (aEvent.metaKey)
            modifiers.push('Command');
          if (aEvent.ctrlKey) {
            modifiers.push('Ctrl');
            if (navigator.platform.indexOf('Darwin') == 0)
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
          let owner = target.getAttribute('data-item-owner-id');
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
          var tab = aMessage.tab ? (await browser.tabs.get(aMessage.tab)) : null ;
          var windowId = aMessage.window || tab && tab.windowId;
          if (windowId != gTargetWindow)
            return;
          return tabContextMenu.open({
            tab:  tab,
            windowId: windowId,
            left: aMessage.left,
            top:  aMessage.top
          });
        })();
    }
  }
};
