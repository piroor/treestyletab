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

var gTabContextMenuItems = {};

function getTabContextMenuItemsFor(aAddonId) {
  let items;
  if (aAddonId in gTabContextMenuItems) {
    items = gTabContextMenuItems[aAddonId];
  }
  else {
    items = [];
    gTabContextMenuItems[aAddonId] = items;
  }
  return items;
}

function handleFakeContextMenuMessages(aMessage, aSender) {
  switch (aMessage.type) {
    case kTSTAPI_CONTEXT_MENU_CREATE: {
      let items = getTabContextMenuItemsFor(aSender.id);
      let params = aMessage.params;
      if (Array.isArray(params))
        params = params[0];
      items.push(params);
      gTabContextMenuItems[aSender.id] = items;
      browser.runtime.sendMessage({
        type:  kTSTAPI_CONTEXT_MENU_UPDATED,
        items: gTabContextMenuItems
      });
      return Promise.resolve();
    }; break;

    case kTSTAPI_CONTEXT_MENU_UPDATE: {
      let items = getTabContextMenuItemsFor(aSender.id);
      for (let i = 0, maxi = items.length; i < maxi; i++) {
        let item = items[i];
        if (item.id != aMessage.params[0])
          continue;
        items.splice(i, 1, clone(item, aMessage.params[1]));
        updated = true;
        break;
      }
      gTabContextMenuItems[aSender.id] = items;
      browser.runtime.sendMessage({
        type:  kTSTAPI_CONTEXT_MENU_UPDATED,
        items: gTabContextMenuItems
      });
      return Promise.resolve();
    }; break;

    case kTSTAPI_CONTEXT_MENU_REMOVE: {
      let items = getTabContextMenuItemsFor(aSender.id);
      let id = aMessage.params;
      if (Array.isArray(id))
        id = id[0];
      items = items.filter(aItem => aItem.id != id);
      gTabContextMenuItems[aSender.id] = items;
      browser.runtime.sendMessage({
        type:  kTSTAPI_CONTEXT_MENU_UPDATED,
        items: gTabContextMenuItems
      });
      return Promise.resolve();
    }; break;

    case kTSTAPI_CONTEXT_MENU_REMOVE_ALL: {
      delete gTabContextMenuItems[aSender.id];
      browser.runtime.sendMessage({
        type:  kTSTAPI_CONTEXT_MENU_UPDATED,
        items: gTabContextMenuItems
      });
      return Promise.resolve();
    }; break;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  browser.runtime.onMessageExternal.addListener(handleFakeContextMenuMessages);
}, { once: true });

window.addEventListener('unload', () => {
  browser.runtime.onMessageExternal.removeListener(handleFakeContextMenuMessages);
}, { once: true });
