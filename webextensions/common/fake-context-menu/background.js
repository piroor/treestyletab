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
    this.onExternalMessage = this.onExternalMessage.bind(this);

    browser.runtime.onMessageExternal.addListener(this.onExternalMessage);

    window.addEventListener('unload', () => {
      browser.runtime.onMessageExternal.removeListener(this.onExternalMessage);
    }, { once: true });
  },

  items: {},

  getItemsFor(aAddonId) {
  let items;
  if (aAddonId in this.items) {
    items = this.items[aAddonId];
  }
  else {
    items = [];
    this.items[aAddonId] = items;
  }
  return items;
  },

  onExternalMessage(aMessage, aSender) {
  switch (aMessage.type) {
    case kTSTAPI_CONTEXT_MENU_CREATE: {
      let items = this.getItemsFor(aSender.id);
      let params = aMessage.params;
      if (Array.isArray(params))
        params = params[0];
      items.push(params);
      this.items[aSender.id] = items;
      browser.runtime.sendMessage({
        type:  kTSTAPI_CONTEXT_MENU_UPDATED,
        items: this.items
      });
      return Promise.resolve();
    }; break;

    case kTSTAPI_CONTEXT_MENU_UPDATE: {
      let items = this.getItemsFor(aSender.id);
      for (let i = 0, maxi = items.length; i < maxi; i++) {
        let item = items[i];
        if (item.id != aMessage.params[0])
          continue;
        items.splice(i, 1, clone(item, aMessage.params[1]));
        updated = true;
        break;
      }
      this.items[aSender.id] = items;
      browser.runtime.sendMessage({
        type:  kTSTAPI_CONTEXT_MENU_UPDATED,
        items: this.items
      });
      return Promise.resolve();
    }; break;

    case kTSTAPI_CONTEXT_MENU_REMOVE: {
      let items = this.getItemsFor(aSender.id);
      let id = aMessage.params;
      if (Array.isArray(id))
        id = id[0];
      items = items.filter(aItem => aItem.id != id);
      this.items[aSender.id] = items;
      browser.runtime.sendMessage({
        type:  kTSTAPI_CONTEXT_MENU_UPDATED,
        items: this.items
      });
      return Promise.resolve();
    }; break;

    case kTSTAPI_CONTEXT_MENU_REMOVE_ALL: {
      delete this.items[aSender.id];
      browser.runtime.sendMessage({
        type:  kTSTAPI_CONTEXT_MENU_UPDATED,
        items: this.items
      });
      return Promise.resolve();
    }; break;
  }
  }
};
