/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as Commands from '/common/commands.js';
import * as TSTAPI from '/common/tst-api.js';
import * as ContextualIdentities from '/common/contextual-identities.js';

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
  'context_pinTab': {
    title:              browser.i18n.getMessage('tabContextMenu_pin_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_pin_label_multiselected')
  },
  'context_unpinTab': {
    title:              browser.i18n.getMessage('tabContextMenu_unpin_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_unpin_label_multiselected')
  },
  'context_duplicateTab': {
    title:              browser.i18n.getMessage('tabContextMenu_duplicate_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_duplicate_label_multiselected')
  },
  'context_separator:afterDuplicate': {
    type: 'separator'
  },
  'context_bookmarkSelected': {
    title: browser.i18n.getMessage('tabContextMenu_bookmarkSelected_label')
  },
  'context_selectAllTabs': {
    title: browser.i18n.getMessage('tabContextMenu_selectAllTabs_label')
  },
  'context_bookmarkTab': {
    title:              browser.i18n.getMessage('tabContextMenu_bookmark_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_bookmark_label_multiselected')
  },
  'context_reopenInContainer': {
    title: browser.i18n.getMessage('tabContextMenu_reopenInContainer_label')
  },
  'context_moveTab': {
    title:              browser.i18n.getMessage('tabContextMenu_moveTab_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_moveTab_label_multiselected')
  },
  'context_moveTabToStart': {
    parentId: 'context_moveTab',
    title:    browser.i18n.getMessage('tabContextMenu_moveTabToStart_label')
  },
  'context_moveTabToEnd': {
    parentId: 'context_moveTab',
    title:    browser.i18n.getMessage('tabContextMenu_moveTabToEnd_label')
  },
  'context_openTabInWindow': {
    parentId: 'context_moveTab',
    title:    browser.i18n.getMessage('tabContextMenu_tearOff_label')
  },
  'context_separator:afterSendTab': {
    type: 'separator'
  },
  'context_bookmarkAllTabs': {
    title: browser.i18n.getMessage('tabContextMenu_bookmarkAll_label')
  },
  'context_reloadAllTabs': {
    title: browser.i18n.getMessage('tabContextMenu_reloadAll_label')
  },
  'context_separator:afterReloadAll': {
    type: 'separator'
  },
  'context_closeTabsToTheEnd': {
    title:    browser.i18n.getMessage('tabContextMenu_closeTabsToBottom_label')
  },
  'context_closeOtherTabs': {
    title:    browser.i18n.getMessage('tabContextMenu_closeOther_label')
  },
  'context_closeTabOptions_closeTree': {
    title:    browser.i18n.getMessage('context_closeTree_label')
  },
  'context_closeTabOptions_closeDescendants': {
    title:    browser.i18n.getMessage('context_closeDescendants_label')
  },
  'context_closeTabOptions_closeOthers': {
    title:    browser.i18n.getMessage('context_closeOthers_label')
  },
  'context_undoCloseTab': {
    title: browser.i18n.getMessage('tabContextMenu_undoClose_label')
  },
  'context_closeTab': {
    title:              browser.i18n.getMessage('tabContextMenu_close_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_close_label_multiselected')
  },
  'lastSeparatorBeforeExtraItems': {
    type:     'separator',
    fakeMenu: true
  },
  'groupTabs': {
    type:     'separator',
    fakeMenu: true
  }
};

const mExtraItems = new Map();

// Imitation native context menu items depend on https://bugzilla.mozilla.org/show_bug.cgi?id=1280347
const mNativeContextMenuAvailable = typeof browser.menus.overrideContext == 'function';
let mNativeMultiselectionAvailable = true;

const SIDEBAR_URL_PATTERN = mNativeContextMenuAvailable ? [`moz-extension://${location.host}/*`] : null;

export async function init() {
  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onExternalMessage);

  window.addEventListener('unload', () => {
    browser.runtime.onMessage.removeListener(onMessage);
    browser.runtime.onMessageExternal.removeListener(onExternalMessage);
  }, { once: true });

  browser.runtime.getBrowserInfo().then(browserInfo => {
    mNativeMultiselectionAvailable = parseInt(browserInfo.version.split('.')[0]) >= 63;
  });

  for (const id of Object.keys(mItemsById)) {
    const item = mItemsById[id];
    item.lastTitle   = item.title;
    item.lastVisible = true;
    item.lastEnabled = true;
    const info = {
      id,
      title:    item.title,
      type:     item.type || 'normal',
      contexts: ['tab'],
      viewTypes: ['sidebar'],
      documentUrlPatterns: SIDEBAR_URL_PATTERN
    };
    if (item.parentId)
      info.parentId = item.parentId;
    if (mNativeContextMenuAvailable && !item.fakeMenu)
      browser.menus.create(info);
    onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_CREATE,
      params: info
    }, browser.runtime);
  }
  if (mNativeContextMenuAvailable) {
    browser.menus.onShown.addListener(onShown);
    browser.menus.onClicked.addListener(onClick);
  }
  onTSTItemClick.addListener(onClick);

  await ContextualIdentities.init();
  updateContextualIdentities();
  ContextualIdentities.onUpdated.addListener(() => {
    updateContextualIdentities();
  });
}

const mContextualIdentityItems = new Set();
function updateContextualIdentities() {
  for (const item of mContextualIdentityItems.values()) {
    const id = item.id;
    if (id in mItemsById)
      delete mItemsById[id];
    if (mNativeContextMenuAvailable)
      browser.menus.remove(id);
    onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_REMOVE,
      params: id
    }, browser.runtime);
  }
  mContextualIdentityItems.clear();

  const defaultItem = {
    parentId:  'context_reopenInContainer',
    id:        'context_reopenInContainer:firefox-default',
    title:     browser.i18n.getMessage('tabContextMenu_reopenInContainer_noContainer_label'),
    contexts:  ['tab'],
    viewTypes: ['sidebar'],
    documentUrlPatterns: SIDEBAR_URL_PATTERN
  };
  if (mNativeContextMenuAvailable)
    browser.menus.create(defaultItem);
  onExternalMessage({
    type: TSTAPI.kCONTEXT_MENU_CREATE,
    params: defaultItem
  }, browser.runtime);
  mContextualIdentityItems.add(defaultItem);

  const defaultSeparator = {
    parentId:  'context_reopenInContainer',
    id:        'context_reopenInContainer_separator',
    type:      'separator',
    contexts:  ['tab'],
    viewTypes: ['sidebar'],
    documentUrlPatterns: SIDEBAR_URL_PATTERN
  };
  if (mNativeContextMenuAvailable)
    browser.menus.create(defaultSeparator);
  onExternalMessage({
    type: TSTAPI.kCONTEXT_MENU_CREATE,
    params: defaultSeparator
  }, browser.runtime);
  mContextualIdentityItems.add(defaultSeparator);

  ContextualIdentities.forEach(identity => {
    const id = `context_reopenInContainer:${identity.cookieStoreId}`;
    const item = {
      parentId: 'context_reopenInContainer',
      id:       id,
      title:    identity.name.replace(/^([a-z0-9])/i, '&$1'),
      contexts: ['tab'],
      viewTypes: ['sidebar'],
      documentUrlPatterns: SIDEBAR_URL_PATTERN
    };
    if (identity.iconUrl)
      item.icons = { 16: identity.iconUrl };
    if (mNativeContextMenuAvailable)
      browser.menus.create(item);
    onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_CREATE,
      params: item
    }, browser.runtime);
    mContextualIdentityItems.add(item);
  });
  for (const item of mContextualIdentityItems.values()) {
    mItemsById[item.id] = item;
    item.lastVisible = true;
    item.lastEnabled = true;
  }
}


function updateItem(id, state = {}) {
  let modified = false;
  const item = mItemsById[id];
  const updateInfo = {
    visible: 'visible' in state ? !!state.visible : true,
    enabled: 'enabled' in state ? !!state.enabled : true
  };
  const title = state.multiselected ? item.titleMultiselected || item.title : item.title;
  if (title) {
    updateInfo.title = title;
    modified = title != item.lastTitle;
    item.lastTitle = updateInfo.title;
  }
  if (!modified)
    modified = updateInfo.visible != item.lastVisible ||
                 updateInfo.enabled != item.lastEnabled;
  item.lastVisible = updateInfo.visible;
  item.lastEnabled = updateInfo.enabled;
  if (mNativeContextMenuAvailable)
    browser.menus.update(id, updateInfo);
  onExternalMessage({
    type: TSTAPI.kCONTEXT_MENU_UPDATE,
    params: [id, updateInfo]
  }, browser.runtime);
  return modified;
}

async function onShown(info, contextApiTab) {
  const tab                   = Tabs.getTabById(contextApiTab);
  const windowId              = contextApiTab ? contextApiTab.windowId : (await browser.windows.getLastFocused({})).id;
  const container             = tab ? tab.parentNode : Tabs.getTabsContainer(windowId);
  const previousTab           = Tabs.getPreviousTab(tab);
  const previousSiblingTab    = Tabs.getPreviousSiblingTab(tab);
  const nextTab               = Tabs.getNextTab(tab);
  const nextSiblingTab        = Tabs.getNextSiblingTab(tab);
  const hasMultipleTabs       = Tabs.getTabs(tab || container).length > 1;
  const normalTabsCount       = Tabs.getNormalTabs(tab || container).length;
  const hasMultipleNormalTabs = normalTabsCount > 1;
  const multiselected         = Tabs.isMultiselected(tab);

  let modifiedItemsCount = 0;
  let visibleItemsCount = 0;

  // ESLint reports "short circuit" error for following codes.
  //   https://eslint.org/docs/rules/no-unused-expressions#allowshortcircuit
  // To allow those usages, I disable the rule temporarily.
  /* eslint-disable no-unused-expressions */

  updateItem('context_reloadTab', {
    visible: (contextApiTab || mNativeMultiselectionAvailable) && ++visibleItemsCount,
    multiselected: multiselected || !contextApiTab
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-mute', {
    visible: contextApiTab && (!contextApiTab.mutedInfo || !contextApiTab.mutedInfo.muted) && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-unmute', {
    visible: contextApiTab && contextApiTab.mutedInfo && contextApiTab.mutedInfo.muted && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_pinTab', {
    visible: contextApiTab && !contextApiTab.pinned && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_unpinTab', {
    visible: contextApiTab && contextApiTab.pinned && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_duplicateTab', {
    visible: contextApiTab && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_separator:afterDuplicate', {
    visible: contextApiTab && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  updateItem('context_bookmarkSelected', {
    visible: !contextApiTab && mNativeMultiselectionAvailable && ++visibleItemsCount
  }) && modifiedItemsCount++;
  updateItem('context_selectAllTabs', {
    visible: mNativeMultiselectionAvailable && ++visibleItemsCount,
    enabled: !contextApiTab || Tabs.getSelectedTabs(tab).length != Tabs.getVisibleTabs(tab).length,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_bookmarkTab', {
    visible: contextApiTab && ++visibleItemsCount,
    multiselected: multiselected || !contextApiTab
  }) && modifiedItemsCount++;

  let showContextualIdentities = false;
  for (const item of mContextualIdentityItems.values()) {
    const id = item.id;
    let visible = contextApiTab && id != `context_reopenInContainer:${contextApiTab.cookieStoreId}`;
    if (id == 'context_reopenInContainer_separator')
      visible = contextApiTab && contextApiTab.cookieStoreId != 'firefox-default';
    updateItem(id, { visible }) && modifiedItemsCount++;
    if (visible)
      showContextualIdentities = true;
  }
  updateItem('context_reopenInContainer', {
    visible: contextApiTab && showContextualIdentities && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_moveTab', {
    visible: contextApiTab && ++visibleItemsCount,
    enabled: contextApiTab && hasMultipleTabs,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_moveTabToStart', {
    enabled: contextApiTab && hasMultipleTabs && (previousSiblingTab || previousTab) && (Tabs.isPinned(previousSiblingTab || previousTab) == contextApiTab.pinned),
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_moveTabToEnd', {
    enabled: contextApiTab && hasMultipleTabs && (nextSiblingTab || nextTab) && (Tabs.isPinned(nextSiblingTab || nextTab) == contextApiTab.pinned),
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_openTabInWindow', {
    enabled: contextApiTab && hasMultipleTabs,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_separator:afterSendTab', {
    visible: contextApiTab && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  // workaround for https://github.com/piroor/treestyletab/issues/2056
  updateItem('context_bookmarkAllTabs', {
    visible: !mNativeMultiselectionAvailable && ++visibleItemsCount
  }) && modifiedItemsCount++;
  updateItem('context_reloadAllTabs', {
    visible: !mNativeMultiselectionAvailable && ++visibleItemsCount
  }) && modifiedItemsCount++;
  updateItem('context_separator:afterReloadAll', {
    visible: !mNativeMultiselectionAvailable && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  updateItem('context_closeTabsToTheEnd', {
    visible: contextApiTab && ++visibleItemsCount,
    enabled: hasMultipleNormalTabs && nextTab,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeOtherTabs', {
    visible: contextApiTab && ++visibleItemsCount,
    enabled: hasMultipleNormalTabs,
    multiselected
  }) && modifiedItemsCount++;
  {
    const enabled = !multiselected && Tabs.hasChildTabs(tab);
    updateItem('context_closeTabOptions_closeTree', {
      visible: contextApiTab && configs.context_closeTabOptions_closeTree && ++visibleItemsCount,
      enabled
    }) && modifiedItemsCount++;
    updateItem('context_closeTabOptions_closeDescendants', {
      visible: contextApiTab && configs.context_closeTabOptions_closeDescendants && ++visibleItemsCount,
      enabled
    }) && modifiedItemsCount++;
    updateItem('context_closeTabOptions_closeOthers', {
      visible: contextApiTab && configs.context_closeTabOptions_closeOthers && ++visibleItemsCount,
      enabled
    }) && modifiedItemsCount++;
  }

  updateItem('context_undoCloseTab', {
    visible: ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeTab', {
    visible: contextApiTab && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('lastSeparatorBeforeExtraItems', {
    visible: Array.from(mExtraItems.values()).some(item => item.visible !== false) && ++visibleItemsCount
  }) && modifiedItemsCount++;

  /* eslint-enable no-unused-expressions */

  if (mNativeContextMenuAvailable && modifiedItemsCount)
    browser.menus.refresh();
}

async function onClick(info, contextApiTab) {
  const window            = await browser.windows.getLastFocused({ populate: true });
  const contextWindowId   = window.id;
  const contextTabElement = Tabs.getTabById(contextApiTab);
  const activeTab         = window.tabs.find(tab => tab.active);
  const activeTabElement  = Tabs.getTabById(activeTab);

  let multiselectedTabs = Tabs.getSelectedTabs(contextTabElement || activeTabElement);
  const isMultiselected = contextTabElement ? Tabs.isMultiselected(contextTabElement) : multiselectedTabs.length > 1;
  if (!isMultiselected)
    multiselectedTabs = null;

  switch (info.menuItemId) {
    case 'context_reloadTab':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.reload(tab.apiTab.id);
        }
      }
      else {
        const tab = contextTabElement || Tabs.getCurrentTab(contextWindowId);
        browser.tabs.reload(tab.apiTab.id);
      }
      break;
    case 'context_toggleMuteTab-mute':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.apiTab.id, { muted: true });
        }
      }
      else {
        browser.tabs.update(contextApiTab.id, { muted: true });
      }
      break;
    case 'context_toggleMuteTab-unmute':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.apiTab.id, { muted: false });
        }
      }
      else {
        browser.tabs.update(contextApiTab.id, { muted: false });
      }
      break;
    case 'context_pinTab':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.apiTab.id, { pinned: true });
        }
      }
      else {
        browser.tabs.update(contextApiTab.id, { pinned: true });
      }
      break;
    case 'context_unpinTab':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.apiTab.id, { pinned: false });
        }
      }
      else {
        browser.tabs.update(contextApiTab.id, { pinned: false });
      }
      break;
    case 'context_duplicateTab':
      Commands.duplicateTab(contextTabElement, {
        destinationWindowId: contextWindowId
      });
      break;
    case 'context_moveTabToStart':
      Commands.moveTabToStart(contextTabElement);
      break;
    case 'context_moveTabToEnd':
      Commands.moveTabToEnd(contextTabElement);
      break;
    case 'context_openTabInWindow':
      Commands.openTabInWindow(contextTabElement);
    case 'context_selectAllTabs': {
      const apiTabs = await browser.tabs.query({ windowId: contextWindowId });
      browser.tabs.highlight({
        windowId: contextWindowId,
        populate: false,
        tabs:     [activeTab.index].concat(apiTabs.filter(tab => !tab.active).map(tab => tab.index))
      });
    }; break;
    case 'context_bookmarkTab':
      Commands.bookmarkTab(contextTabElement);
      break;
    case 'context_bookmarkSelected':
      Commands.bookmarkTab(contextTabElement || activeTabElement);
      break;
    case 'context_bookmarkAllTabs':
      Commands.bookmarkTabs(Tabs.getTabs(contextTabElement));
      break;
    case 'context_reloadAllTabs': {
      const apiTabs = await browser.tabs.query({ windowId: contextWindowId }) ;
      for (const apiTab of apiTabs) {
        browser.tabs.reload(apiTab.id);
      }
    }; break;
    case 'context_closeTabsToTheEnd': {
      const apiTabs = await browser.tabs.query({ windowId: contextWindowId });
      let after = false;
      const closeAPITabs = [];
      const keptTabIds = multiselectedTabs ?
        multiselectedTabs.map(tab => tab.apiTab.id) :
        [contextApiTab.id] ;
      for (const apiTab of apiTabs) {
        if (keptTabIds.includes(apiTab.id)) {
          after = true;
          continue;
        }
        if (after && !apiTab.pinned)
          closeAPITabs.push(apiTab);
      }
      const canceled = (await browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_NOTIFY_TABS_CLOSING,
        tabs:     closeAPITabs.map(tab => tab.id),
        windowId: contextWindowId
      })) === false
      if (canceled)
        break;
      browser.tabs.remove(closeAPITabs.map(aPITab => aPITab.id));
    }; break;
    case 'context_closeOtherTabs': {
      const apiTabs  = await browser.tabs.query({ windowId: contextWindowId });
      const keptTabIds = multiselectedTabs ?
        multiselectedTabs.map(tab => tab.apiTab.id) :
        [contextApiTab.id] ;
      const closeAPITabs = apiTabs.filter(aPITab => !aPITab.pinned && !keptTabIds.includes(aPITab.id)).map(aPITab => aPITab.id);
      const canceled = (await browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_NOTIFY_TABS_CLOSING,
        tabs:     closeAPITabs.map(tab => tab.id),
        windowId: contextWindowId
      })) === false
      if (canceled)
        break;
      browser.tabs.remove(closeAPITabs);
    }; break;
    case 'context_undoCloseTab': {
      const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
      if (sessions.length && sessions[0].tab)
        browser.sessions.restore(sessions[0].tab.sessionId);
    }; break;
    case 'context_closeTab':
      if (multiselectedTabs) {
        // close down to top, to keep tree structure of Tree Style Tab
        multiselectedTabs.reverse();
        for (const tab of multiselectedTabs) {
          browser.tabs.remove(tab.apiTab.id);
        }
      }
      else {
        browser.tabs.remove(contextApiTab.id);
      }
      break;

    default: {
      const contextualIdentityMatch = info.menuItemId.match(/^context_reopenInContainer:(.+)$/);
      if (contextApiTab &&
          contextualIdentityMatch)
        Commands.reopenInContainer(contextTabElement, contextualIdentityMatch[1]);
    }; break;
  }
}


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
  }).catch(_error => {});
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

function onMessage(message, _sender) {
  log('tab-context-menu: internally called:', message);
  switch (message.type) {
    case TSTAPI.kCONTEXT_MENU_GET_ITEMS:
      return Promise.resolve(exportExtraItems());

    case TSTAPI.kCONTEXT_MENU_CLICK:
      onTSTItemClick.dispatch(message.info, message.tab);
      return;

    case TSTAPI.kCONTEXT_MENU_SHOWN:
      onShown(message.info, message.tab);
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
  if (!message)
    return;
  log('API called:', message, { id: sender.id, url: sender.url });
  switch (message.type) {
    case TSTAPI.kCONTEXT_MENU_CREATE: {
      const items  = getItemsFor(sender.id);
      let params = message.params;
      if (Array.isArray(params))
        params = params[0];
      const parent = params.parentId && items.filter(item => item.id == params.parentId)[0];
      if (params.parentId && !parent)
        break;
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
      if (shouldAdd) {
        items.push(params);
        if (parent && params.id) {
          parent.children = parent.children || [];
          parent.children.push(params.id);
        }
      }
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
      const item   = items.filter(item => item.id == id)[0];
      if (!item)
        break;
      const parent = item.parentId && items.filter(item => item.id == item.parentId)[0];
      items = items.filter(item => item.id != id);
      mExtraItems.set(sender.id, items);
      if (parent && parent.children)
        parent.children = parent.children.filter(childId => childId != id);
      if (item.children) {
        for (const childId of item.children) {
          onExternalMessage({ type: message.type, params: childId }, sender);
        }
      }
      return reserveNotifyUpdated();
    }; break;

    case TSTAPI.kCONTEXT_MENU_REMOVE_ALL:
    case TSTAPI.kUNREGISTER_SELF: {
      delete mExtraItems.delete(sender.id);
      return reserveNotifyUpdated();
    }; break;
  }
}
