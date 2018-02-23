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
    this.onMessage         = this.onMessage.bind(this);
    this.onExternalMessage = this.onExternalMessage.bind(this);

    browser.runtime.onMessage.addListener(this.onMessage);
    browser.runtime.onMessageExternal.addListener(this.onExternalMessage);

    window.addEventListener('unload', () => {
      browser.runtime.onMessage.removeListener(this.onMessage);
      browser.runtime.onMessageExternal.removeListener(this.onExternalMessage);
    }, { once: true });
  },

  items: {},

  getItemsFor(aAddonId) {
    let items;
    if (aAddonId in this.items) {
      items = this.items[aAddonId] || [];
    }
    else {
      items = [];
      this.items[aAddonId] = items;
    }
    return items;
  },

  notifyUpdated: async function() {
    await browser.runtime.sendMessage({
      type:  kTSTAPI_CONTEXT_MENU_UPDATED,
      items: this.items
    });
  },

  reserveNotifyUpdated() {
    return new Promise((aResolve, aReject) => {
      this.notifyUpdatedHandlers.push(aResolve);
      if (this.reservedNotifyUpdate)
        clearTimeout(this.reservedNotifyUpdate);
      this.reservedNotifyUpdate = setTimeout(async () => {
        delete this.reservedNotifyUpdate;
        await this.notifyUpdated();
        var handlers = this.notifyUpdatedHandlers;
        this.notifyUpdatedHandlers = [];
        for (let handler of handlers) {
          handler();
        }
      }, 100);
    });
  },
  notifyUpdatedHandlers: [],

  onMessage(aMessage, aSender) {
    switch (aMessage.type) {
      case kTSTAPI_CONTEXT_MENU_GET_ITEMS:
        return Promise.resolve(this.items);

      case kTSTAPI_CONTEXT_MENU_CLICK:
        contextMenuClickListener(aMessage.info, aMessage.tab);
        return;
    }
  },

  onExternalMessage(aMessage, aSender) {
    switch (aMessage.type) {
      case kTSTAPI_CONTEXT_MENU_CREATE: {
        let items  = this.getItemsFor(aSender.id);
        let params = aMessage.params;
        if (Array.isArray(params))
          params = params[0];
        items.push(params);
        this.items[aSender.id] = items;
        return this.reserveNotifyUpdated();
      }; break;

      case kTSTAPI_CONTEXT_MENU_UPDATE: {
        let items = this.getItemsFor(aSender.id);
        for (let i = 0, maxi = items.length; i < maxi; i++) {
          let item = items[i];
          if (item.id != aMessage.params[0])
            continue;
          items.splice(i, 1, Object.assign({}, item, aMessage.params[1]));
          break;
        }
        this.items[aSender.id] = items;
        return this.reserveNotifyUpdated();
      }; break;

      case kTSTAPI_CONTEXT_MENU_REMOVE: {
        let items = this.getItemsFor(aSender.id);
        let id    = aMessage.params;
        if (Array.isArray(id))
          id = id[0];
        items = items.filter(aItem => aItem.id != id);
        this.items[aSender.id] = items;
        return this.reserveNotifyUpdated();
      }; break;

      case kTSTAPI_CONTEXT_MENU_REMOVE_ALL: {
        delete this.items[aSender.id];
        return this.reserveNotifyUpdated();
      }; break;
    }
  }
};
