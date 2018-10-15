/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  notify,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as TabsOpen from '/common/tabs-open.js';
import * as Tree from '/common/tree.js';
import * as Bookmark from '/common/bookmark.js';
import * as TSTAPI from '/common/tst-api.js';
import * as ContextualIdentities from '/common/contextual-identities.js';
import * as SidebarStatus from '/common/sidebar-status.js';

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
    title: browser.i18n.getMessage('tabContextMenu_duplicate_label')
  },
  'context_separator:afterDuplicate': {
    type: 'separator'
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
  'context_closeTabOptions': {
    title: browser.i18n.getMessage('tabContextMenu_closeTabOptions_label')
  },
  'context_closeTabsToTheEnd': {
    parentId: 'context_closeTabOptions',
    title:    browser.i18n.getMessage('tabContextMenu_closeTabsToBottom_label')
  },
  'context_closeOtherTabs': {
    parentId: 'context_closeTabOptions',
    title:    browser.i18n.getMessage('tabContextMenu_closeOther_label')
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

let mNativeContextMenuAvailable = false;

//const SIDEBAR_URL_PATTERN = `moz-extension://${location.host}/*`;

export async function init() {
  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onExternalMessage);

  window.addEventListener('unload', () => {
    browser.runtime.onMessage.removeListener(onMessage);
    browser.runtime.onMessageExternal.removeListener(onExternalMessage);
  }, { once: true });

  // Imitated native context menu items depend on https://bugzilla.mozilla.org/show_bug.cgi?id=1280347
  const browserInfo = await browser.runtime.getBrowserInfo();
  mNativeContextMenuAvailable = parseInt(browserInfo.version.split('.')[0]) >= 64;

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
      //documentUrlPatterns: [SIDEBAR_URL_PATTERN]
    };
    if (item.parentId)
      info.parentId = item.parentId;
    if (mNativeContextMenuAvailable)
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
  for (const id of mContextualIdentityItems.values()) {
    if (mNativeContextMenuAvailable)
      browser.menus.remove(id);
    onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_REMOVE,
      params: id
    }, browser.runtime);
  }
  mContextualIdentityItems.clear();

  const defaultItem = {
    parentId: 'context_reopenInContainer',
    id:       'context_reopenInContainer:firefox-default',
    title:    browser.i18n.getMessage('tabContextMenu_reopenInContainer_noContainer_label'),
    contexts: ['tab'],
    viewTypes: ['sidebar'],
    //documentUrlPatterns: [SIDEBAR_URL_PATTERN]
  };
  if (mNativeContextMenuAvailable)
    browser.menus.create(defaultItem);
  onExternalMessage({
    type: TSTAPI.kCONTEXT_MENU_CREATE,
    params: defaultItem
  }, browser.runtime);
  mContextualIdentityItems.add(defaultItem.id);

  const defaultSeparator = {
    parentId: 'context_reopenInContainer',
    id:       'context_reopenInContainer:firefox-default',
    title:    browser.i18n.getMessage('tabContextMenu_reopenInContainer_noContainer_label'),
    contexts: ['tab'],
    viewTypes: ['sidebar'],
    //documentUrlPatterns: [SIDEBAR_URL_PATTERN]
  };
  if (mNativeContextMenuAvailable)
    browser.menus.create(defaultSeparator);
  onExternalMessage({
    type: TSTAPI.kCONTEXT_MENU_CREATE,
    params: defaultSeparator
  }, browser.runtime);
  mContextualIdentityItems.add(defaultSeparator.id);

  ContextualIdentities.forEach(identity => {
    const id = `context_reopenInContainer:${identity.cookieStoreId}`;
    const icon = identity.icon && identity.color ?
      `/resources/icons/contextual-identities/${identity.icon}.svg#${identity.color}` :
      identity.iconUrl;
    const item = {
      parentId: 'context_reopenInContainer',
      id:       id,
      title:    identity.name.replace(/^([a-z0-9])/i, '&$1'),
      contexts: ['tab'],
      viewTypes: ['sidebar'],
      //documentUrlPatterns: [SIDEBAR_URL_PATTERN]
    };
    if (icon)
      item.icons = { 16: icon };
    if (mNativeContextMenuAvailable)
      browser.menus.create(item);
    onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_CREATE,
      params: item
    }, browser.runtime);
    mContextualIdentityItems.add(id);
  });
}


function updateItem(id, state = {}) {
  let modified = false;
  const item = mItemsById[id];
  const updateInfo = {
    visible: !!state.visible,
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
  const isTSTSidebar          = SidebarStatus.isOpen(windowId) && SidebarStatus.hasFocus(windowId);

  let modifiedItemsCount = 0;
  let visibleItemsCount = 0;

  // ESLint reports "short circuit" error for following codes.
  //   https://eslint.org/docs/rules/no-unused-expressions#allowshortcircuit
  // To allow those usages, I disable the rule temporarily.
  /* eslint-disable no-unused-expressions */

  updateItem('context_reloadTab', {
    visible: isTSTSidebar && ++visibleItemsCount,
    multiselected: multiselected || !contextApiTab
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-mute', {
    visible: isTSTSidebar && contextApiTab && (!contextApiTab.mutedInfo || !contextApiTab.mutedInfo.muted) && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-unmute', {
    visible: isTSTSidebar && contextApiTab && contextApiTab.mutedInfo && contextApiTab.mutedInfo.muted && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_pinTab', {
    visible: isTSTSidebar && contextApiTab && !contextApiTab.pinned && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_unpinTab', {
    visible: isTSTSidebar && contextApiTab && contextApiTab.pinned && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_duplicateTab', {
    visible: isTSTSidebar && contextApiTab && !multiselected && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_separator:afterDuplicate', {
    visible: isTSTSidebar && contextApiTab && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  updateItem('context_selectAllTabs', {
    visible: isTSTSidebar && ++visibleItemsCount,
    enabled: !contextApiTab || Tabs.getSelectedTabs(tab).length != Tabs.getVisibleTabs(tab).length,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_bookmarkTab', {
    visible: isTSTSidebar && ++visibleItemsCount,
    multiselected: multiselected || !contextApiTab
  }) && modifiedItemsCount++;
  const showContextualIdentities = contextApiTab && mContextualIdentityItems.size > 2;
  updateItem('context_reopenInContainer', {
    visible: isTSTSidebar && showContextualIdentities && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  if (showContextualIdentities) {
    for (const id of mContextualIdentityItems.values()) {
      let visible = id != `context_reopenInContainer:${contextApiTab.cookieStoreId}`;
      if (id == 'context_reopenInContainer_separator')
        visible = contextApiTab.cookieStoreId != 'firefox-default';
      if (mNativeContextMenuAvailable)
        browser.menus.update(id, {
          visible
        });
      onExternalMessage({
        type: TSTAPI.kCONTEXT_MENU_UPDATE,
        params: [id, { visible }]
      }, browser.runtime);
    }
  }
  updateItem('context_moveTab', {
    visible: isTSTSidebar && contextApiTab && ++visibleItemsCount,
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
    visible: isTSTSidebar && contextApiTab && visibleItemsCount > 0
  }) && modifiedItemsCount++;
  visibleItemsCount = 0;

  updateItem('context_closeTabOptions', {
    visible: isTSTSidebar && contextApiTab && ++visibleItemsCount,
    enabled: hasMultipleNormalTabs,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeTabsToTheEnd', {
    visible: isTSTSidebar && contextApiTab,
    enabled: hasMultipleNormalTabs && nextTab,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeOtherTabs', {
    visible: isTSTSidebar && contextApiTab,
    enabled: hasMultipleNormalTabs,
    multiselected
  });
  updateItem('context_undoCloseTab', {
    visible: isTSTSidebar && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeTab', {
    visible: isTSTSidebar && contextApiTab && ++visibleItemsCount,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_separator:afterTabContextItems', {
    visible: isTSTSidebar && contextApiTab && visibleItemsCount > 0
  }) && modifiedItemsCount++;

  /* eslint-enable no-unused-expressions */

  if (mNativeContextMenuAvailable && modifiedItemsCount)
    browser.menus.refresh();
}

async function onClick(info, contextApiTab) {
  const window            = await browser.windows.getLastFocused({});
  const contextWindowId   = window.id;
  const contextTabElement = Tabs.getTabById(contextApiTab);

  const isMultiselected   = Tabs.isMultiselected(contextTabElement);
  const multiselectedTabs = isMultiselected && Tabs.getSelectedTabs(contextTabElement);

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
      /*
        Due to difference between Firefox's "duplicate tab" implementation,
        TST sometimes fails to detect duplicated tabs based on its
        session information. Thus we need to duplicate as an internally
        duplicated tab. For more details, see also:
        https://github.com/piroor/treestyletab/issues/1437#issuecomment-334952194
      */
      // browser.tabs.duplicate(contextApiTab.id);
      return (async () => {
        const sourceTab = contextTabElement;
        log('source tab: ', sourceTab, !!sourceTab.apiTab);
        const duplicatedTabs = await Tree.moveTabs([sourceTab], {
          duplicate:           true,
          destinationWindowId: contextWindowId,
          insertAfter:         sourceTab,
          inRemote:            true
        });
        Tree.behaveAutoAttachedTab(duplicatedTabs[0], {
          baseTab:  sourceTab,
          behavior: configs.autoAttachOnDuplicated,
          inRemote: true
        });
      })();
    case 'context_moveTabToStart': {
      const movedTabs = multiselectedTabs || [contextTabElement].concat(Tabs.getDescendantTabs(contextTabElement));
      const allTabs   = contextApiTab.pinned ? Tabs.getPinnedTabs(contextTabElement) : Tabs.getUnpinnedTabs(contextTabElement);
      const otherTabs = allTabs.filter(tab => !movedTabs.includes(tab));
      if (otherTabs.length > 0)
        Tree.performTabsDragDrop({
          windowId:            contextWindowId,
          tabs:                movedTabs.map(tab => tab.apiTab),
          action:              Constants.kACTION_MOVE | Constants.kACTION_DETACH,
          insertBefore:        otherTabs[0],
          destinationWindowId: contextWindowId,
          duplicate:           false
        });
    }; break;
    case 'context_moveTabToEnd': {
      const movedTabs = multiselectedTabs || [contextTabElement].concat(Tabs.getDescendantTabs(contextTabElement));
      const allTabs   = contextApiTab.pinned ? Tabs.getPinnedTabs(contextTabElement) : Tabs.getUnpinnedTabs(contextTabElement);
      const otherTabs = allTabs.filter(tab => !movedTabs.includes(tab));
      if (otherTabs.length > 0)
        Tree.performTabsDragDrop({
          windowId:            contextWindowId,
          tabs:                movedTabs.map(tab => tab.apiTab),
          action:              Constants.kACTION_MOVE | Constants.kACTION_DETACH,
          insertAfter:        otherTabs[otherTabs.length-1],
          destinationWindowId: contextWindowId,
          duplicate:           false
        });
    }; break;
    case 'context_openTabInWindow':
      if (multiselectedTabs) {
        Tree.openNewWindowFromTabs(multiselectedTabs, {
          inRemote:  true
        });
      }
      else {
        await browser.windows.create({
          tabId:     contextApiTab.id,
          incognito: contextApiTab.incognito
        });
      }
      break;
    case 'context_selectAllTabs': {
      const apiTabs = await browser.tabs.query({ windowId: contextWindowId });
      browser.tabs.highlight({
        windowId: contextWindowId,
        tabs: apiTabs.map(tab => tab.index)
      });
    }; break;
    case 'context_bookmarkTab':
      if (!multiselectedTabs) {
        const tab = contextTabElement || Tabs.getCurrentTab(contextWindowId);
        await Bookmark.bookmarkTab(tab);
        notify({
          title:   browser.i18n.getMessage('bookmarkTabs_notification_success_title'),
          message: browser.i18n.getMessage('bookmarkTabs_notification_success_message', [
            tab.apiTab.title,
            1,
            tab.apiTab.title
          ]),
          icon:    Constants.kNOTIFICATION_DEFAULT_ICON
        });
        break;
      }
    case 'context_bookmarkAllTabs': {
      const apiTabs = multiselectedTabs ?
        multiselectedTabs.map(tab => tab.apiTab) :
        await browser.tabs.query({ windowId: contextWindowId }) ;
      const folder = await Bookmark.bookmarkTabs(apiTabs.map(Tabs.getTabById));
      if (folder)
        browser.bookmarks.get(folder.parentId).then(folders => {
          notify({
            title:   browser.i18n.getMessage('bookmarkTabs_notification_success_title'),
            message: browser.i18n.getMessage('bookmarkTabs_notification_success_message', [
              apiTabs[0].title,
              apiTabs.length,
              folders[0].title
            ]),
            icon:    Constants.kNOTIFICATION_DEFAULT_ICON
          });
        });
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
        count:    closeAPITabs.length,
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
        count:    closeAPITabs.length,
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
          contextualIdentityMatch) {
        // Open in Container
        const tab = await TabsOpen.openURIInTab(contextApiTab.url, {
          windowId:      contextApiTab.windowId,
          cookieStoreId: contextualIdentityMatch[1]
        });
        Tree.behaveAutoAttachedTab(tab, {
          baseTab:  contextTabElement,
          behavior: configs.autoAttachOnDuplicated,
          inRemote: true
        });
      }
    }; break;
  }
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
