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
  configs
} from '../../common/common.js';
import * as TSTAPI from '../../common/tst-api.js';
import EventListenerManager from '../../common/EventListenerManager.js';

export const onTSTItemClick = new EventListenerManager();

  export function init() {
    browser.runtime.onMessage.addListener(onMessage);
    browser.runtime.onMessageExternal.addListener(onExternalMessage);

    window.addEventListener('unload', () => {
      browser.runtime.onMessage.removeListener(onMessage);
      browser.runtime.onMessageExternal.removeListener(onExternalMessage);
    }, { once: true });
  }

  const gItems = {};

  function getItemsFor(aAddonId) {
    let items;
    if (aAddonId in gItems) {
      items = gItems[aAddonId] || [];
    }
    else {
      items = [];
      gItems[aAddonId] = items;
    }
    return items;
  }

  async function notifyUpdated() {
    await browser.runtime.sendMessage({
      type:  TSTAPI.kCONTEXT_MENU_UPDATED,
      items: gItems
    });
  }

  let gReservedNotifyUpdate;
  let gNotifyUpdatedHandlers = [];

  function reserveNotifyUpdated() {
    return new Promise((aResolve, _aReject) => {
      gNotifyUpdatedHandlers.push(aResolve);
      if (gReservedNotifyUpdate)
        clearTimeout(gReservedNotifyUpdate);
      gReservedNotifyUpdate = setTimeout(async () => {
        gReservedNotifyUpdate = undefined;
        await notifyUpdated();
        const handlers = gNotifyUpdatedHandlers;
        gNotifyUpdatedHandlers = [];
        for (let handler of handlers) {
          handler();
        }
      }, 100);
    });
  }

  function onMessage(aMessage, _aSender) {
    if (configs.logOnFakeContextMenu)
      log('fake-context-menu: internally called:', aMessage);
    switch (aMessage.type) {
      case TSTAPI.kCONTEXT_MENU_GET_ITEMS:
        return Promise.resolve(gItems);

      case TSTAPI.kCONTEXT_MENU_CLICK:
        onTSTItemClick.dispatch(aMessage.info, aMessage.tab);
        return;
    }
  }

  export function onExternalMessage(aMessage, aSender) {
    if (configs.logOnFakeContextMenu)
      log('fake-context-menu: API called:', aMessage, aSender);
    switch (aMessage.type) {
      case TSTAPI.kCONTEXT_MENU_CREATE: {
        let items  = getItemsFor(aSender.id);
        let params = aMessage.params;
        if (Array.isArray(params))
          params = params[0];
        let shouldAdd = true;
        if (params.id) {
          for (let i = 0, maxi = items.length; i < maxi; i++) {
            let item = items[i];
            if (item.id != params.id)
              continue;
            items.splice(i, 1, params);
            shouldAdd = false;
            break;
          }
        }
        if (shouldAdd)
          items.push(params);
        gItems[aSender.id] = items;
        return reserveNotifyUpdated();
      }; break;

      case TSTAPI.kCONTEXT_MENU_UPDATE: {
        let items = getItemsFor(aSender.id);
        for (let i = 0, maxi = items.length; i < maxi; i++) {
          let item = items[i];
          if (item.id != aMessage.params[0])
            continue;
          items.splice(i, 1, Object.assign({}, item, aMessage.params[1]));
          break;
        }
        gItems[aSender.id] = items;
        return reserveNotifyUpdated();
      }; break;

      case TSTAPI.kCONTEXT_MENU_REMOVE: {
        let items = getItemsFor(aSender.id);
        let id    = aMessage.params;
        if (Array.isArray(id))
          id = id[0];
        items = items.filter(aItem => aItem.id != id);
        gItems[aSender.id] = items;
        return reserveNotifyUpdated();
      }; break;

      case TSTAPI.kCONTEXT_MENU_REMOVE_ALL:
      case TSTAPI.kUNREGISTER_SELF: {
        delete gItems[aSender.id];
        return reserveNotifyUpdated();
      }; break;
    }
  }
