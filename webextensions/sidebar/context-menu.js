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
  get node() {
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

  rebuild: function() {
    var firstExtraItem = this.node.querySelector('.extra');
    if (firstExtraItem) {
      let range = documenr.createRange();
      range.selectNodeContents(this.node);
      range.setStartBefore(firstExtraItem);
      range.deleteContents();
      range.detach();
    }

    if (Object.keys(this.extraItems).length == 0)
     return;

    var extraItemNodes = document.createDocumentFragment();
    for (let id of Object.keys(this.extraItems)) {
      let addonItem = document.createElement('li');
      addonItem.appendChild(document.createTextNode(id.replace(/@.+$/, '')));
      addonItem.classList.add('extra');
      this.prepareAsSubmenu(addonItem);
      let addonSubMenu = addonItem.lastChild;
      let knownItems = {};
      for (let item of this.extraItems[id]) {
        if (item.contexts && item.contexts.indexOf('tab') < 0)
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
    this.node.appendChild(extraItemNodes);
  },
  prepareAsSubmenu(aItemNode) {
    if (aItemNode.classList.contains('has-submenu'))
      return aItemNode;
    aItemNode.classList.add('has-submenu');
    var subMenu = aItemNode.appendChild(document.createElement('ul'));
    return aItemNode;
  },
  buildExtraItem(aItem, aOwnerId) {
    var node = document.createElement('li');
    node.setAttribute('data-item-id', aItem.id);
    node.setAttribute('data-item-owner-id', aOwnerId);
    node.classList.add('extra');
    node.classList.add(aItem.type);
    if (aItem.type == 'checkbox' || aItem.type == 'radio') {
      if (aItem.checked)
        node.classList.add('checked');
    }
    if (aItem.type != 'separator') {
      node.appendChild(document.createTextNode(aItem.title));
      node.setAttribute('title', aItem.title);
    }
    return node;
  },

  open(aOptions = {}) {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      delete this.closeTimeout;
      this.onClosed();
    }
    this.contextTab = aOptions.tab;
    this.init();
    this.node.classList.add('open');
    var menus = [this.node].concat(Array.slice(this.node.querySelectorAll('ul')));
    for (let menu of menus) {
      this.updatePosition(menu, aOptions);
    }
    setTimeout(() => {
      window.addEventListener('mousedown', this.onMouseDown, { capture: true });
      window.addEventListener('click', this.onClick, { capture: true });
    }, configs.collapseDuration);
  },

  close() {
    window.removeEventListener('mousedown', this.onMouseDown, { capture: true });
    window.removeEventListener('click', this.onClick, { capture: true });
    this.node.classList.remove('open');
    this.contextTab = null;
    this.closeTimeout = setTimeout(() => {
      delete this.closeTimeout;
      this.onClosed();
    }, configs.collapseDuration);
  },
  onClosed() {
    this.node.removeAttribute('data-tab-id');
    this.node.removeAttribute('data-tab-states');
  },

  init() {
    if (this.contextTab) {
      this.node.setAttribute('data-tab-id', this.contextTab.id);
      this.node.setAttribute('data-tab-states', getTabById(this.contextTab.id).className);
    }

    if (getTabs().length > 1)
      this.node.classList.add('has-multiple-tabs');
    else
      this.node.classList.remove('has-multiple-tabs');

    switch (getNormalTabs().length) {
      case 0:
        this.node.classList.remove('has-normal-tabs');
        this.node.classList.remove('has-multiple-normal-tabs');
        break;
      case 1:
        this.node.classList.add('has-normal-tabs');
        this.node.classList.remove('has-multiple-normal-tabs');
        break;
      default:
        this.node.classList.add('has-normal-tabs');
        this.node.classList.add('has-multiple-normal-tabs');
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

    left = Math.min(left, containerRect.width - menuRect.width);
    top = Math.min(top, containerRect.height - menuRect.height);
    aMenu.style.left = `${left}px`;
    aMenu.style.top = `${top}px`;
  },

  onMouseDown: function(aEvent) {
    var target = aEvent.target;
    do {
      if (target == this.node)
        return;
      target = target.parentNode;
    } while (target && target.parentNode);
    aEvent.stopImmediatePropagation();
    aEvent.stopPropagation();
    aEvent.preventDefault();
  },

  onClick: async function(aEvent) {
    if (aEvent.button != 0)
      return this.close();

    var target = aEvent.target;
    while (target.nodeType != target.ELEMENT_NODE)
      target = target.parentNode;

    switch (target.id) {
      case 'context-reload':
        browser.tabs.reload(this.contextTab.id);
        break;
      case 'context-mute':
        browser.tabs.update(this.contextTab.id, { muted: true });
        break;
      case 'context-unmute':
        browser.tabs.update(this.contextTab.id, { muted: false });
        break;
      case 'context-pin':
        browser.tabs.update(this.contextTab.id, { pinned: true });
        break;
      case 'context-unpin':
        browser.tabs.update(this.contextTab.id, { pinned: false });
        break;
      case 'context-duplicate':
        browser.tabs.duplicate(this.contextTab.id);
        break;
      case 'context-tearOff': {
        let window = await browser.windows.create({ url: 'about:blank' })
        await browser.tabs.move(this.contextTab.id, { index: 1, windowId: window.id });
        let tabs = await browser.tabs.query({ windowId: window.id });
        browser.tabs.remove(tabs[0].id);
      }; break;
      case 'context-reloadAll': {
        let tabs = await browser.tabs.query({ windowId: this.contextTab.windowId });
        for (let tab of tabs) {
          browser.tabs.reload(tab.id);
        }
      }; break;
      case 'context-bookmarkAll': {
        let tabs = await browser.tabs.query({ windowId: this.contextTab.windowId });
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
      case 'context-closeAfter': {
        let tabs = await browser.tabs.query({ windowId: this.contextTab.windowId });
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
      case 'context-closeOther': {
        let tabs = await browser.tabs.query({ windowId: this.contextTab.windowId });
        for (let tab of tabs) {
          if (tab.id != this.contextTab.id)
            browser.tabs.remove(tab.id);
        }
      }; break;
      case 'context-undoClose': {
        let sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
        if (sessions.length && sessions[0].tab)
          browser.sessions.restore(sessions[0].tab.sessionId);
      }; break;
      case 'context-close':
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
            browser.runtime.sendMessage(message);
          else
            browser.runtime.sendMessage(owner, message);
        }
      }; break;
    }
    this.close();
  }
};
tabContextMenu.onMouseDown = tabContextMenu.onMouseDown.bind(tabContextMenu);
tabContextMenu.onClick = tabContextMenu.onClick.bind(tabContextMenu);
setTimeout(() => {
  browser.runtime.getBackgroundPage().then(aWindow => {
    tabContextMenu.extraItems = aWindow.gTabContextMenuItems;
    tabContextMenu.rebuild();
  });
}, 0);

window.addEventListener('contextmenu', (aEvent) => {
  aEvent.stopPropagation();
  aEvent.preventDefault();
}, { capture: true });

window.addEventListener('blur', (aEvent) => {
  tabContextMenu.close();
}, { capture: true });
