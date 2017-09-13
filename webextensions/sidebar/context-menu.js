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

  contextTab: null,

  open(aOptions = {}) {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      delete this.closeTimeout;
      this.onClosed();
    }
    this.contextTab = aOptions.tab;
    this.init();
    this.node.classList.add('open');
    this.updatePosition(aOptions);
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

  updatePosition(aOptions = {}) {
    let menuRect = this.node.getBoundingClientRect();

    let allRange = document.createRange();
    allRange.selectNodeContents(document.body);
    let containerRect = allRange.getBoundingClientRect();
    allRange.detach();

    let left = aOptions.left || Math.max(0, (containerRect.width - menuRect.width) / 2);
    let top = aOptions.top || Math.max(0, (containerRect.height - menuRect.height) / 2);
    left = Math.min(left, containerRect.width - menuRect.width);
    top = Math.min(top, containerRect.height - menuRect.height);
    this.node.style.left = `${left}px`;
    this.node.style.top = `${top}px`;
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
    }
    this.close();
  }
};
tabContextMenu.onMouseDown = tabContextMenu.onMouseDown.bind(tabContextMenu);
tabContextMenu.onClick = tabContextMenu.onClick.bind(tabContextMenu);

window.addEventListener('contextmenu', (aEvent) => {
  aEvent.stopPropagation();
  aEvent.preventDefault();
}, { capture: true });
