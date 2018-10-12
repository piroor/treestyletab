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
  log as internalLogger
} from '/common/common.js';
import * as Tabs from '/common/tabs.js';
import * as TSTAPI from '/common/tst-api.js';
import * as CommonTabContextMenu from '/common/tab-context-menu.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('background/tab-context-menu', ...args);
}

export const onTSTItemClick = new EventListenerManager();
export const onTSTTabContextMenuShown = new EventListenerManager();
export const onTSTTabContextMenuHidden = new EventListenerManager();


const mItemsById = {
  'context_reloadTab': {
    title:              browser.i18n.getMessage('tabContextMenu_reload_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_reload_label_multiselected')
  },
  'context_toggleMuteTab-mute': {
    title:              browser.i18n.getMessage('tabContextMenu_mute_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_mute_label_multiselected')
  },
  'context_toggleMuteTab-unmute': {
    title:              browser.i18n.getMessage('tabContextMenu_unmute_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_unmute_label_multiselected')
  },
  'context_separator:afterMute': {
    type: 'separator'
  },
  'context_pinTab': {
    title:              browser.i18n.getMessage('tabContextMenu_pin_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_pin_label_multiselected')
  },
  'context_unpinTab': {
    title:              browser.i18n.getMessage('tabContextMenu_unpin_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_unpin_label_multiselected')
  },
  'context_duplicateTab': {
    title: browser.i18n.getMessage('tabContextMenu_duplicate_label')
  },
  'context_reopenInContainer': {
    title: browser.i18n.getMessage('tabContextMenu_reopenInContainer_label')
  },
  'context_openTabInWindow': {
    title: browser.i18n.getMessage('tabContextMenu_tearOff_label')
  },
  'context_separator:afterOpenInWindow': {
    type: 'separator'
  },
  'context_reloadAllTabs': {
    title: browser.i18n.getMessage('tabContextMenu_reloadAll_label')
  },
  'context_bookmarkAllTabs': {
    title:              browser.i18n.getMessage('tabContextMenu_bookmarkAll_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_bookmark_label_multiselected')
  },
  'context_closeTabsToTheEnd': {
    title: browser.i18n.getMessage('tabContextMenu_closeAfter_label')
  },
  'context_closeOtherTabs': {
    title: browser.i18n.getMessage('tabContextMenu_closeOther_label')
  },
  'context_separator:afterCloseOther': {
    type: 'separator'
  },
  'context_undoCloseTab': {
    title: browser.i18n.getMessage('tabContextMenu_undoClose_label')
  },
  'context_closeTab': {
    title:              browser.i18n.getMessage('tabContextMenu_close_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_close_label_multiselected')
  },
  'context_separator:afterTabContextItems': {
    type: 'separator'
  }
};


export function init() {
  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onExternalMessage);

  window.addEventListener('unload', () => {
    browser.runtime.onMessage.removeListener(onMessage);
    browser.runtime.onMessageExternal.removeListener(onExternalMessage);
  }, { once: true });

  for (const id of Object.keys(mItemsById)) {
    const item = mItemsById[id];
    item.lastTitle   = item.title;
    item.lastVisible = false;
    browser.menus.create({
      id,
      title:    item.title,
      type:     item.type || 'normal',
      contexts: ['tab'],
      visible:  false
    });
  }
  browser.menus.onShown.addListener(onShown);
  browser.menus.onClicked.addListener(onClick);
}


function updateItem(id, state = {}) {
  let modified = false;
  const item = mItemsById[id];
  const updateInfo = {
    visible: !!state.visible
  };
  const title = state.multiselected ? item.titleMultiselected || item.title : item.title;
  if (title) {
    updateInfo.title = title;
    modified = title != item.lastTitle;
    item.lastTitle = updateInfo.title;
  }
  if (!modified)
    modified = updateInfo.visible != item.lastVisible;
  item.lastVisible = updateInfo.visible;
  browser.menus.update(id, updateInfo);
  return modified;
}

function onShown(info, contextApiTab) {
  const inSidebar             = info.viewType == 'sidebar';
  const tab                   = Tabs.getTabById(contextApiTab);
  const hasMultipleTabs       = Tabs.getTabs(tab).length > 1;
  const normalTabsCount       = Tabs.getNormalTabs(tab).length;
  const hasNormalTab          = normalTabsCount > 0;
  const hasMultipleNormalTabs = normalTabsCount > 1;
  const multiselected         = Tabs.isMultiselected(tab);

  let modifiedItemsCount = 0;
  let visibleItemsCount = 0;

  // ESLint reports "short circuit" error for following codes.
  //   https://eslint.org/docs/rules/no-unused-expressions#allowshortcircuit
  // To allow those usages, I disable the rule temporarily.
  /* eslint-disable no-unused-expressions */

  updateItem('context_reloadTab', {
    visible: inSidebar && contextApiTab && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-mute', {
    visible: inSidebar && contextApiTab && (!contextApiTab.mutedInfo || !contextApiTab.mutedInfo.muted) && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-unmute', {
    visible: inSidebar && contextApiTab && contextApiTab.mutedInfo && contextApiTab.mutedInfo.muted && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_separator:afterMute', {
    visible: inSidebar && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  updateItem('context_pinTab', {
    visible: inSidebar && contextApiTab && !contextApiTab.pinned && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_unpinTab', {
    visible: inSidebar && contextApiTab && contextApiTab.pinned && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_duplicateTab', {
    visible: inSidebar && contextApiTab && !multiselected && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_reopenInContainer', {
    visible: inSidebar && contextApiTab && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_openTabInWindow', {
    visible: inSidebar && contextApiTab && hasMultipleTabs && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_separator:afterOpenInWindow', {
    visible: inSidebar && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  updateItem('context_reloadAllTabs', {
    visible: inSidebar && hasMultipleTabs && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_bookmarkAllTabs', {
    visible: inSidebar && (!contextApiTab || !contextApiTab.pinned) && hasNormalTab && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeTabsToTheEnd', {
    visible: inSidebar && contextApiTab && hasMultipleNormalTabs && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeOtherTabs', {
    visible: inSidebar && contextApiTab && hasMultipleNormalTabs && ++visibleItemsCount,
    multiselected
  });

  updateItem('context_separator:afterCloseOther', {
    visible: inSidebar && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  updateItem('context_undoCloseTab', {
    visible: inSidebar && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeTab', {
    visible: inSidebar && contextApiTab && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_separator:afterTabContextItems', {
    visible: inSidebar && visibleItemsCount > 0
  }) && modifiedItemsCount++;

  /* eslint-enable no-unused-expressions */

  if (modifiedItemsCount)
    browser.menus.refresh();
}

async function onClick(info, contextApiTab) {
  const window = await browser.windows.getLastFocused({
    windowTypes: ['normal']
  });
  CommonTabContextMenu.onCommand({
    item: {
      id: info.menuItemId
    },
    event: {
      button: 0
    },
    tab:      contextApiTab,
    windowId: window.id
  });
}


const mExtraItems = new Map();

function getItemsFor(addonId) {
  if (mExtraItems.has(addonId)) {
    return mExtraItems.get(addonId);
  }
  const items = [];
  mExtraItems.set(addonId, items);
  return items;
}

function exportExtraItems() {
  const exported = {};
  for (const [id, items] of mExtraItems.entries()) {
    exported[id] = items;
  }
  return exported;
}

async function notifyUpdated() {
  await browser.runtime.sendMessage({
    type:  TSTAPI.kCONTEXT_MENU_UPDATED,
    items: exportExtraItems()
  });
}

let mReservedNotifyUpdate;
let mNotifyUpdatedHandlers = [];

function reserveNotifyUpdated() {
  return new Promise((resolve, _aReject) => {
    mNotifyUpdatedHandlers.push(resolve);
    if (mReservedNotifyUpdate)
      clearTimeout(mReservedNotifyUpdate);
    mReservedNotifyUpdate = setTimeout(async () => {
      mReservedNotifyUpdate = undefined;
      await notifyUpdated();
      const handlers = mNotifyUpdatedHandlers;
      mNotifyUpdatedHandlers = [];
      for (const handler of handlers) {
        handler();
      }
    }, 10);
  });
}

function onMessage(message, _aSender) {
  log('tab-context-menu: internally called:', message);
  switch (message.type) {
    case TSTAPI.kCONTEXT_MENU_GET_ITEMS:
      return Promise.resolve(exportExtraItems());

    case TSTAPI.kCONTEXT_MENU_CLICK:
      onTSTItemClick.dispatch(message.info, message.tab);
      return;

    case TSTAPI.kCONTEXT_MENU_SHOWN:
      onTSTTabContextMenuShown.dispatch(message.info, message.tab);
      return;

    case TSTAPI.kCONTEXT_MENU_HIDDEN:
      onTSTTabContextMenuHidden.dispatch();
      return;

    case TSTAPI.kCONTEXT_ITEM_CHECKED_STATUS_CHANGED:
      for (const itemData of mExtraItems.get(message.ownerId)) {
        if (!itemData.id != message.id)
          continue;
        itemData.checked = message.checked;
        break;
      }
      return;
  }
}

export function onExternalMessage(message, sender) {
  log('API called:', message, { id: sender.id, url: sender.url });
  switch (message.type) {
    case TSTAPI.kCONTEXT_MENU_CREATE: {
      const items  = getItemsFor(sender.id);
      let params = message.params;
      if (Array.isArray(params))
        params = params[0];
      let shouldAdd = true;
      if (params.id) {
        for (let i = 0, maxi = items.length; i < maxi; i++) {
          const item = items[i];
          if (item.id != params.id)
            continue;
          items.splice(i, 1, params);
          shouldAdd = false;
          break;
        }
      }
      if (shouldAdd)
        items.push(params);
      mExtraItems.set(sender.id, items);
      return reserveNotifyUpdated();
    }; break;

    case TSTAPI.kCONTEXT_MENU_UPDATE: {
      const items = getItemsFor(sender.id);
      for (let i = 0, maxi = items.length; i < maxi; i++) {
        const item = items[i];
        if (item.id != message.params[0])
          continue;
        items.splice(i, 1, Object.assign({}, item, message.params[1]));
        break;
      }
      mExtraItems.set(sender.id, items);
      return reserveNotifyUpdated();
    }; break;

    case TSTAPI.kCONTEXT_MENU_REMOVE: {
      let items = getItemsFor(sender.id);
      let id    = message.params;
      if (Array.isArray(id))
        id = id[0];
      items = items.filter(item => item.id != id);
      mExtraItems.set(sender.id, items);
      return reserveNotifyUpdated();
    }; break;

    case TSTAPI.kCONTEXT_MENU_REMOVE_ALL:
    case TSTAPI.kUNREGISTER_SELF: {
      delete mExtraItems.delete(sender.id);
      return reserveNotifyUpdated();
    }; break;
  }
}
