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
    this.onMouseOver       = this.onMouseOver.bind(this);
    this.onMouseDown       = this.onMouseDown.bind(this);
    this.onClick           = this.onClick.bind(this);
    this.onKeyPress        = this.onKeyPress.bind(this);
    this.onTransitionEnd   = this.onTransitionEnd.bind(this);
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

    for (let item of Array.slice(this.menu.querySelectorAll('li:not(.separator)'))) {
      const title = item.getAttribute('title');
      if (title)
        item.setAttribute('title', title.replace(/&([a-z])/i, '$1'));
      item.innerHTML = item.innerHTML.replace(/&amp;([a-z])/i, '<span class="accesskey">$1</span>');
      item.dataset.accessKey = RegExp.$1.toLowerCase();
    }

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
  get containerRect() {
    var allRange = document.createRange();
    allRange.selectNodeContents(document.body);
    var containerRect = allRange.getBoundingClientRect();
    allRange.detach();
    // because the contianer box can be shifted to hide scrollbar
    var dummyTabsRect = document.querySelector('#dummy-tabs').getBoundingClientRect();
    return {
      x:      dummyTabsRect.x,
      y:      containerRect.y,
      width:  dummyTabsRect.width,
      height: containerRect.height,
      top:    containerRect.top,
      right:  dummyTabsRect.right,
      bottom: containerRect.bottom,
      left:   dummyTabsRect.left
    };
  },

  addons: null,

  contextTab: null,
  extraItems: {},
  dirty:      false,
  lastFocusedItem: null,

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

    if (!this.addons)
      this.addons = await browser.runtime.sendMessage({
        type: kCOMMAND_REQUEST_REGISTERED_ADDONS
      });

    var extraItemNodes = document.createDocumentFragment();
    for (let id of Object.keys(this.extraItems)) {
      let addonItem = document.createElement('li');
      addonItem.appendChild(document.createTextNode(this.getAddonName(id)));
      addonItem.classList.add('extra');
      this.prepareAsSubmenu(addonItem);
      let addonSubMenu = addonItem.lastChild;
      let knownItems   = {};
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
  getAddonName(aId) {
    if (aId == browser.runtime.id)
      return browser.i18n.getMessage('extensionName');
    return this.addons[aId].name || aId.replace(/@.+$/, '');
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
    itemNode.classList.add(aItem.type || 'normal');
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
    this.contextTab      = aOptions.tab;
    this.contextWindowId = aOptions.windowId || (this.contextTab && this.contextTab.windowId);
    this.lastFocusedItem = null;
    await this.rebuild();
    this.applyContext();
    this.menu.classList.add('open');
    var menus = [this.menu].concat(Array.slice(this.menu.querySelectorAll('ul')));
    for (let menu of menus) {
      this.updatePosition(menu, aOptions);
    }
    setTimeout(() => {
      for (let item of Array.slice(this.menu.querySelectorAll('li:not(.separator)'))) {
        item.tabIndex = 0;
        item.classList.remove('open');
      }
      this.menu.addEventListener('mousemove', this.onMouseOver);
      this.menu.addEventListener('transitionend', this.onTransitionEnd);
      window.addEventListener('mousedown', this.onMouseDown, { capture: true });
      window.addEventListener('click', this.onClick, { capture: true });
      window.addEventListener('keypress', this.onKeyPress, { capture: true });
    }, configs.collapseDuration);
  },

  close() {
    if (!this.menu.classList.contains('open'))
      return;
    this.menu.classList.remove('open');
    this.contextTab      = null;
    this.contextWindowId = null;
    this.addons          = null;
    this.lastFocusedItem = null;
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
    this.menu.removeEventListener('mousemove', this.onMouseOver);
    this.menu.removeEventListener('transitionend', this.onTransitionEnd);
    window.removeEventListener('mousedown', this.onMouseDown, { capture: true });
    window.removeEventListener('click', this.onClick, { capture: true });
    window.removeEventListener('keypress', this.onKeyPress, { capture: true });
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
    var top  = aOptions.top;

    if (aMenu.parentNode.localName == 'li') {
      let parentRect = aMenu.parentNode.getBoundingClientRect();
      left = parentRect.right;
      top  = parentRect.top;
    }

    let menuRect = aMenu.getBoundingClientRect();
    let containerRect = this.containerRect;
    left = left || Math.max(0, (containerRect.width - menuRect.width) / 2);
    top  = top  || Math.max(0, (containerRect.height - menuRect.height) / 2);

    left = Math.min(left, containerRect.width - menuRect.width - 3);
    top  = Math.min(top,  containerRect.height - menuRect.height - 3);
    aMenu.style.left = `${left}px`;
    aMenu.style.top  = `${top}px`;
  },

  onBlur(aEvent) {
    if (!aEvent.target.closest ||
        !aEvent.target.closest(`#${this.menu.id}`))
      this.close();
  },

  onMouseOver(aEvent) {
    const item = this.getEffectiveItem(aEvent.target);
    if (!item)
      return;
    this.setHover(item);
    this.closeOtherSubmenus(item);
    this.openSubmenuFor(item);
    item.focus();
    this.lastFocusedItem = item;
  },

  setHover(aItem) {
    for (let item of Array.slice(this.menu.querySelectorAll('li.hover'))) {
      if (item != aItem)
        item.classList.remove('hover');
    }
    if (aItem)
      aItem.classList.add('hover');
  },

  openSubmenuFor(aItem) {
    const items = evaluateXPath(
      `ancestor-or-self::li[${hasClass('has-submenu')}]`,
      aItem
    );
    for (let item of getArrayFromXPathResult(items)) {
      item.classList.add('open');
    }
  },

  closeOtherSubmenus(aItem) {
    const items = evaluateXPath(
      `preceding-sibling::li[${hasClass('has-submenu')}] |
       following-sibling::li[${hasClass('has-submenu')}] |
       preceding-sibling::li/descendant::li[${hasClass('has-submenu')}] |
       following-sibling::li/descendant::li[${hasClass('has-submenu')}]`,
      aItem
    );
    for (let item of getArrayFromXPathResult(items)) {
      item.classList.remove('open');
    }
  },

  onMouseDown(aEvent) {
    aEvent.stopImmediatePropagation();
    aEvent.stopPropagation();
    aEvent.preventDefault();
  },

  getEffectiveItem(aNode) {
    var target = aNode.closest('li');
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

    var target = this.getEffectiveItem(aEvent.target);
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

    this.onCommand(target, aEvent);
  },

  onKeyPress(aEvent) {
    switch (aEvent.keyCode) {
      case aEvent.DOM_VK_UP:
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.advanceFocus(-1);
        break;

      case aEvent.DOM_VK_DOWN:
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.advanceFocus(1);
        break;

      case aEvent.DOM_VK_RIGHT:
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.digIn();
        break;

      case aEvent.DOM_VK_LEFT:
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.digOut();
        break;

      case aEvent.DOM_VK_HOME:
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.advanceFocus(1, (this.lastFocusedItem && this.lastFocusedItem.parentNode || this.menu).lastChild);
        break;

      case aEvent.DOM_VK_END:
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.advanceFocus(-1, (this.lastFocusedItem && this.lastFocusedItem.parentNode || this.menu).firstChild);
        break;

      case aEvent.DOM_VK_ENTER:
      case aEvent.DOM_VK_RETURN:
        aEvent.stopPropagation();
        aEvent.preventDefault();
        if (this.lastFocusedItem)
          this.onCommand(this.lastFocusedItem, aEvent);
        break;

      case aEvent.DOM_VK_ESCAPE:
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.close();
        break;

      default:
        if (aEvent.key) {
          const current = this.lastFocusedItem || this.menu.firstChild;
          const condition = `@data-access-key="${aEvent.key.toLowerCase()}"`;
          const item = this.getNextItem(current, condition);
          if (item) {
            this.lastFocusedItem = item;
            this.lastFocusedItem.focus();
            this.setHover(null);
            if (this.getNextItem(item, condition) == item)
              this.onCommand(item, aEvent);
          }
        }
        return;
    }
  },

  getPreviousItem(aBase, aCondition = '') {
    const extraCondition = aCondition ? `[${aCondition}]` : '' ;
    const item = (
      evaluateXPath(
        `preceding-sibling::li[not(${hasClass('separator')})]${extraCondition}[1]`,
        aBase,
        XPathResult.FIRST_ORDERED_NODE_TYPE
      ).singleNodeValue ||
      evaluateXPath(
        `following-sibling::li[not(${hasClass('separator')})]${extraCondition}[last()]`,
        aBase,
        XPathResult.FIRST_ORDERED_NODE_TYPE
      ).singleNodeValue ||
      evaluateXPath(
        `self::li[not(${hasClass('separator')})]${extraCondition}`,
        aBase,
        XPathResult.FIRST_ORDERED_NODE_TYPE
      ).singleNodeValue
    );
    if (window.getComputedStyle(item, null).display == 'none')
      return this.getPreviousItem(item, aCondition);
    return item;
  },

  getNextItem(aBase, aCondition = '') {
    const extraCondition = aCondition ? `[${aCondition}]` : '' ;
    const item = (
      evaluateXPath(
        `following-sibling::li[not(${hasClass('separator')})]${extraCondition}[1]`,
        aBase,
        XPathResult.FIRST_ORDERED_NODE_TYPE
      ).singleNodeValue ||
      evaluateXPath(
        `preceding-sibling::li[not(${hasClass('separator')})]${extraCondition}[last()]`,
        aBase,
        XPathResult.FIRST_ORDERED_NODE_TYPE
      ).singleNodeValue ||
      evaluateXPath(
        `self::li[not(${hasClass('separator')})]${extraCondition}`,
        aBase,
        XPathResult.FIRST_ORDERED_NODE_TYPE
      ).singleNodeValue
    );
    if (item && window.getComputedStyle(item, null).display == 'none')
      return this.getNextItem(item, aCondition);
    return item;
  },

  advanceFocus(aDirection, aLastFocused = null) {
    aLastFocused = aLastFocused || this.lastFocusedItem;
    if (!aLastFocused) {
      if (aDirection < 0)
        this.lastFocusedItem = aLastFocused = this.menu.firstChild;
      else
        this.lastFocusedItem = aLastFocused = this.menu.lastChild;
    }
    if (aDirection < 0)
      this.lastFocusedItem = this.getPreviousItem(aLastFocused);
    else
      this.lastFocusedItem = this.getNextItem(aLastFocused);
    this.lastFocusedItem.focus();
    this.setHover(null);
  },

  digIn() {
    if (!this.lastFocusedItem) {
      this.advanceFocus(1, this.menu.lastChild);
      return;
    }
    const submenu = this.lastFocusedItem.querySelector('ul');
    if (!submenu)
      return;
    this.closeOtherSubmenus(this.lastFocusedItem);
    this.openSubmenuFor(this.lastFocusedItem);
    this.advanceFocus(1, submenu.lastChild);
  },

  digOut() {
    if (!this.lastFocusedItem ||
        this.lastFocusedItem.parentNode == this.menu)
      return;
    this.closeOtherSubmenus(this.lastFocusedItem);
    this.lastFocusedItem = this.lastFocusedItem.parentNode.parentNode;
    this.closeOtherSubmenus(this.lastFocusedItem);
    this.lastFocusedItem.classList.remove('open');
    this.lastFocusedItem.focus();
    this.setHover(null);
  },

  onCommand: async function(aItem, aEvent) {
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
      case 'context_openTabInWindow':
        await browser.windows.create({
          tabId:     this.contextTab.id,
          incognito: this.contextTab.incognito
        });
        break;
      case 'context_reloadAllTabs': {
        let tabs = await browser.tabs.query({ windowId: this.contextWindowId });
        for (let tab of tabs) {
          browser.tabs.reload(tab.id);
        }
      }; break;
      case 'context_bookmarkAllTabs': {
        let tabs   = await browser.tabs.query({ windowId: this.contextWindowId });
        let folder = await bookmarkTabs(tabs.map(aTab => getTabById(aTab.id)));
        if (folder)
          browser.bookmarks.get(folder.parentId).then(aFolders => {
            notify({
              title:   browser.i18n.getMessage('bookmarkTabs.notification.success.title'),
              message: browser.i18n.getMessage('bookmarkTabs.notification.success.message', [
                tabs[0].title,
                tabs.length,
                aFolders[0].title
              ]),
              icon:    kNOTIFICATION_DEFAULT_ICON
            });
          });
      }; break;
      case 'context_closeTabsToTheEnd': {
        let tabs  = await browser.tabs.query({ windowId: this.contextWindowId });
        let after = false;
        let closeTabs = [];
        for (let tab of tabs) {
          if (tab.id == this.contextTab.id) {
            after = true;
            continue;
          }
          if (after && !tab.pinned)
            closeTabs.push(tab);
        }
        confirmToCloseTabs(closeTabs.length, { windowId: this.contextWindowId })
          .then(aConfirmed => {
            if (!aConfirmed)
              return;
            browser.tabs.remove(closeTabs.map(aTab => aTab.id));
          });
      }; break;
      case 'context_closeOtherTabs': {
        let tabId = this.contextTab.id; // cache it for delayed tasks!
        let tabs  = await browser.tabs.query({ windowId: this.contextWindowId });
        let closeTabs = tabs.filter(aTab => !aTab.pinned && aTab.id != tabId).map(aTab => aTab.id);
        confirmToCloseTabs(closeTabs.length, { windowId: this.contextWindowId })
          .then(aConfirmed => {
            if (!aConfirmed)
              return;
            browser.tabs.remove(closeTabs);
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

  onTransitionEnd(aEvent) {
    const hoverItems = this.menu.querySelectorAll('li:hover');
    if (hoverItems.length == 0)
      return;
    const lastHoverItem = hoverItems[hoverItems.length - 1];
    const item = this.getEffectiveItem(lastHoverItem);
    if (!item)
      return;
    if (item.parentNode != aEvent.target)
      return;
    this.setHover(item);
    item.focus();
    this.lastFocusedItem = item;
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
