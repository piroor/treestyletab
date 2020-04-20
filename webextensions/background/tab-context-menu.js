/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  mapAndFilter,
  configs
} from '/common/common.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TreeBehavior from '/common/tree-behavior.js';
import * as TSTAPI from '/common/tst-api.js';
import * as ContextualIdentities from '/common/contextual-identities.js';

import Tab from '/common/Tab.js';

import * as Commands from './commands.js';

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
  'context_topLevel_reloadTree': {
    title:              browser.i18n.getMessage('context_reloadTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_reloadTree_label_multiselected')
  },
  'context_topLevel_reloadDescendants': {
    title:              browser.i18n.getMessage('context_reloadDescendants_label'),
    titleMultiselected: browser.i18n.getMessage('context_reloadDescendants_label_multiselected')
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
  'context_selectAllTabs': {
    title: browser.i18n.getMessage('tabContextMenu_selectAllTabs_label')
  },
  'context_bookmarkTab': {
    title:              browser.i18n.getMessage('tabContextMenu_bookmark_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_bookmark_label_multiselected')
  },
  'context_topLevel_bookmarkTree': {
    title:              browser.i18n.getMessage('context_bookmarkTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_bookmarkTree_label_multiselected')
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
  'context_topLevel_collapseTree': {
    title:              browser.i18n.getMessage('context_collapseTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_collapseTree_label_multiselected')
  },
  'context_topLevel_collapseTreeRecursively': {
    title:              browser.i18n.getMessage('context_collapseTreeRecursively_label'),
    titleMultiselected: browser.i18n.getMessage('context_collapseTreeRecursively_label_multiselected')
  },
  'context_topLevel_collapseAll': {
    title: browser.i18n.getMessage('context_collapseAll_label')
  },
  'context_topLevel_expandTree': {
    title:              browser.i18n.getMessage('context_expandTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_expandTree_label_multiselected')
  },
  'context_topLevel_expandTreeRecursively': {
    title:              browser.i18n.getMessage('context_expandTreeRecursively_label'),
    titleMultiselected: browser.i18n.getMessage('context_expandTreeRecursively_label_multiselected')
  },
  'context_topLevel_expandAll': {
    title: browser.i18n.getMessage('context_expandAll_label')
  },
  'context_separator:afterCollapseExpand': {
    type: 'separator'
  },
  'context_closeTabsToTheEnd': {
    title: browser.i18n.getMessage('tabContextMenu_closeTabsToBottom_label')
  },
  'context_closeOtherTabs': {
    title: browser.i18n.getMessage('tabContextMenu_closeOther_label')
  },
  'context_topLevel_closeTree': {
    title:              browser.i18n.getMessage('context_closeTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_closeTree_label_multiselected')
  },
  'context_topLevel_closeDescendants': {
    title:              browser.i18n.getMessage('context_closeDescendants_label'),
    titleMultiselected: browser.i18n.getMessage('context_closeDescendants_label_multiselected')
  },
  'context_topLevel_closeOthers': {
    title:              browser.i18n.getMessage('context_closeOthers_label'),
    titleMultiselected: browser.i18n.getMessage('context_closeOthers_label_multiselected')
  },
  'context_undoCloseTab': {
    title: browser.i18n.getMessage('tabContextMenu_undoClose_label')
  },
  'context_closeTab': {
    title:              browser.i18n.getMessage('tabContextMenu_close_label'),
    titleMultiselected: browser.i18n.getMessage('tabContextMenu_close_label_multiselected')
  },
  'context_separator:afterClose': {
    type: 'separator'
  },
  'context_topLevel_groupTabs': {
    title: browser.i18n.getMessage('context_groupTabs_label')
  },

  'noContextTab:context_reloadTab': {
    title: browser.i18n.getMessage('tabContextMenu_reload_label_multiselected')
  },
  'noContextTab:context_bookmarkSelected': {
    title: browser.i18n.getMessage('tabContextMenu_bookmarkSelected_label')
  },
  'noContextTab:context_selectAllTabs': {
    title: browser.i18n.getMessage('tabContextMenu_selectAllTabs_label')
  },
  'noContextTab:context_undoCloseTab': {
    title: browser.i18n.getMessage('tabContextMenu_undoClose_label')
  },

  'lastSeparatorBeforeExtraItems': {
    type:     'separator',
    fakeMenu: true
  }
};

const mExtraItems = new Map();

// Imitation native context menu items depend on https://bugzilla.mozilla.org/show_bug.cgi?id=1280347
const mNativeContextMenuAvailable = typeof browser.menus.overrideContext == 'function';
let mNativeMultiselectionAvailable = true;

const SIDEBAR_URL_PATTERN = mNativeContextMenuAvailable ? [`moz-extension://${location.host}/*`] : null;

function getItemPlacementSignature(item) {
  if (item.placementSignature)
    return item.placementSignature;
  return item.placementSignature = JSON.stringify({
    parentId: item.parentId
  });
}
export async function init() {
  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onExternalMessage);

  window.addEventListener('unload', () => {
    browser.runtime.onMessage.removeListener(onMessage);
    browser.runtime.onMessageExternal.removeListener(onExternalMessage);
  }, { once: true });

  browser.runtime.getBrowserInfo().then(browserInfo => {
    mNativeMultiselectionAvailable = parseInt(browserInfo.version.split('.')[0]) >= 63;
  }).catch(ApiTabs.createErrorSuppressor());

  const itemIds = Object.keys(mItemsById);
  for (const id of itemIds) {
    const item = mItemsById[id];
    item.id          = id;
    item.lastTitle   = item.title;
    item.lastVisible = false;
    item.lastEnabled = true;
    if (item.type == 'separator') {
      let beforeSeparator = true;
      item.precedingItems = [];
      item.followingItems = [];
      for (const id of itemIds) {
        const possibleSibling = mItemsById[id];
        if (getItemPlacementSignature(item) != getItemPlacementSignature(possibleSibling)) {
          if (beforeSeparator)
            continue;
          else
            break;
        }
        if (id == item.id) {
          beforeSeparator = false;
          continue;
        }
        if (beforeSeparator) {
          if (possibleSibling.type == 'separator') {
            item.previousSeparator = possibleSibling;
            item.precedingItems = [];
          }
          else {
            item.precedingItems.push(id);
          }
        }
        else {
          if (possibleSibling.type == 'separator')
            break;
          else
            item.followingItems.push(id);
        }
      }
    }
    const info = {
      id,
      title:    item.title,
      type:     item.type || 'normal',
      contexts: ['tab'],
      viewTypes: ['sidebar'],
      visible:  false, // hide all by default
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
      browser.menus.remove(id).catch(ApiTabs.createErrorSuppressor());
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
  if ('checked' in state)
    updateInfo.checked = state.checked;
  const title = state.multiselected && item.titleMultiselected || item.title;
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
    browser.menus.update(id, updateInfo).catch(ApiTabs.createErrorSuppressor());
  onExternalMessage({
    type: TSTAPI.kCONTEXT_MENU_UPDATE,
    params: [id, updateInfo]
  }, browser.runtime);
  return modified;
}

function updateSeparator(id, options = {}) {
  const item = mItemsById[id];
  const visible = (
    (options.hasVisiblePreceding ||
     hasVisiblePrecedingItem(item)) &&
    (options.hasVisibleFollowing ||
     item.followingItems.some(id => mItemsById[id].type != 'separator' && mItemsById[id].lastVisible))
  );
  return updateItem(id, { visible });
}
function hasVisiblePrecedingItem(separator) {
  return (
    separator.precedingItems.some(id => mItemsById[id].type != 'separator' && mItemsById[id].lastVisible) ||
    (separator.previousSeparator &&
     !separator.previousSeparator.lastVisible &&
     hasVisiblePrecedingItem(separator.previousSeparator))
  );
}

async function onShown(info, contextTab) {
  contextTab = contextTab && Tab.get(contextTab.id);
  const windowId              = contextTab ? contextTab.windowId : (await browser.windows.getLastFocused({}).catch(ApiTabs.createErrorHandler())).id;
  const previousTab           = contextTab && contextTab.$TST.previousTab;
  const previousSiblingTab    = contextTab && contextTab.$TST.previousSiblingTab;
  const nextTab               = contextTab && contextTab.$TST.nextTab;
  const nextSiblingTab        = contextTab && contextTab.$TST.nextSiblingTab;
  const hasMultipleTabs       = Tab.hasMultipleTabs(windowId);
  const hasMultipleNormalTabs = Tab.hasMultipleTabs(windowId, { normal: true });
  const multiselected         = contextTab && contextTab.$TST.multiselected;
  const contextTabs           = multiselected ?
    Tab.getSelectedTabs(windowId) :
    contextTab ?
      [contextTab] :
      [];
  const hasChild              = contextTab && contextTabs.some(tab => tab.$TST.hasChild);

  let modifiedItemsCount = 0;

  // ESLint reports "short circuit" error for following codes.
  //   https://eslint.org/docs/rules/no-unused-expressions#allowshortcircuit
  // To allow those usages, I disable the rule temporarily.
  /* eslint-disable no-unused-expressions */

  const emulate = configs.emulateDefaultContextMenu;

  updateItem('context_reloadTab', {
    visible: emulate && contextTab,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_reloadTree', {
    visible: emulate && contextTab && configs.context_topLevel_reloadTree,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_reloadDescendants', {
    visible: emulate && contextTab && configs.context_topLevel_reloadDescendants,
    enabled: hasChild,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-mute', {
    visible: emulate && contextTab && (!contextTab.mutedInfo || !contextTab.mutedInfo.muted),
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_toggleMuteTab-unmute', {
    visible: emulate && contextTab && contextTab.mutedInfo && contextTab.mutedInfo.muted,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_pinTab', {
    visible: emulate && contextTab && !contextTab.pinned,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_unpinTab', {
    visible: emulate && contextTab && contextTab.pinned,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_duplicateTab', {
    visible: emulate && contextTab,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_selectAllTabs', {
    visible: mNativeContextMenuAvailable && emulate && contextTab,
    enabled: contextTab && Tab.getSelectedTabs(windowId).length != Tab.getVisibleTabs(windowId).length,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_bookmarkTab', {
    visible: emulate && contextTab,
    multiselected: multiselected || !contextTab
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_bookmarkTree', {
    visible: emulate && contextTab && configs.context_topLevel_bookmarkTree,
    multiselected
  }) && modifiedItemsCount++;

  let showContextualIdentities = false;
  for (const item of mContextualIdentityItems.values()) {
    const id = item.id;
    let visible;
    if (!emulate)
      visible = false;
    else if (id == 'context_reopenInContainer_separator')
      visible = contextTab && contextTab.cookieStoreId != 'firefox-default';
    else
      visible = contextTab && id != `context_reopenInContainer:${contextTab.cookieStoreId}`;
    updateItem(id, { visible }) && modifiedItemsCount++;
    if (visible)
      showContextualIdentities = true;
  }
  updateItem('context_reopenInContainer', {
    visible: emulate && contextTab && showContextualIdentities,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_moveTab', {
    visible: emulate && contextTab,
    enabled: contextTab && hasMultipleTabs,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_moveTabToStart', {
    enabled: emulate && contextTab && hasMultipleTabs && (previousSiblingTab || previousTab) && ((previousSiblingTab || previousTab).pinned == contextTab.pinned),
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_moveTabToEnd', {
    enabled: emulate && contextTab && hasMultipleTabs && (nextSiblingTab || nextTab) && ((nextSiblingTab || nextTab).pinned == contextTab.pinned),
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_openTabInWindow', {
    enabled: emulate && contextTab && hasMultipleTabs,
    multiselected
  }) && modifiedItemsCount++;

  // workaround for https://github.com/piroor/treestyletab/issues/2056
  updateItem('context_bookmarkAllTabs', {
    visible: emulate && !mNativeMultiselectionAvailable
  }) && modifiedItemsCount++;
  updateItem('context_reloadAllTabs', {
    visible: emulate && !mNativeMultiselectionAvailable
  }) && modifiedItemsCount++;

  updateItem('context_topLevel_collapseTree', {
    visible: emulate && contextTab && configs.context_topLevel_collapseTree,
    enabled: hasChild,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_collapseTreeRecursively', {
    visible: emulate && contextTab && configs.context_topLevel_collapseTreeRecursively,
    enabled: hasChild,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_collapseAll', {
    visible: emulate && !multiselected && contextTab && configs.context_topLevel_collapseAll
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_expandTree', {
    visible: emulate && contextTab && configs.context_topLevel_expandTree,
    enabled: hasChild,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_expandTreeRecursively', {
    visible: emulate && contextTab && configs.context_topLevel_expandTreeRecursively,
    enabled: hasChild,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_expandAll', {
    visible: emulate && !multiselected && contextTab && configs.context_topLevel_expandAll
  }) && modifiedItemsCount++;

  updateItem('context_closeTabsToTheEnd', {
    visible: emulate && contextTab,
    enabled: hasMultipleNormalTabs && nextTab,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeOtherTabs', {
    visible: emulate && contextTab,
    enabled: hasMultipleNormalTabs,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_topLevel_closeTree', {
    visible: emulate && contextTab && configs.context_topLevel_closeTree,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_closeDescendants', {
    visible: emulate && contextTab && configs.context_topLevel_closeDescendants,
    enabled: hasChild,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_topLevel_closeOthers', {
    visible: emulate && contextTab && configs.context_topLevel_closeOthers,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('context_undoCloseTab', {
    visible: emulate && contextTab,
    multiselected
  }) && modifiedItemsCount++;
  updateItem('context_closeTab', {
    visible: emulate && contextTab,
    multiselected
  }) && modifiedItemsCount++;

  updateItem('noContextTab:context_reloadTab', {
    visible: emulate && !contextTab
  }) && modifiedItemsCount++;
  updateItem('noContextTab:context_bookmarkSelected', {
    visible: emulate && !contextTab && mNativeMultiselectionAvailable
  }) && modifiedItemsCount++;
  updateItem('noContextTab:context_selectAllTabs', {
    visible: emulate && !contextTab,
    enabled: !contextTab && Tab.getSelectedTabs(windowId).length != Tab.getVisibleTabs(windowId).length
  }) && modifiedItemsCount++;
  updateItem('noContextTab:context_undoCloseTab', {
    visible: emulate && !contextTab
  }) && modifiedItemsCount++;

  updateItem('context_topLevel_groupTabs', {
    visible: emulate && multiselected && contextTab && configs.context_topLevel_groupTabs
  }) && modifiedItemsCount++;

  updateSeparator('context_separator:afterDuplicate') && modifiedItemsCount++;
  updateSeparator('context_separator:afterSendTab') && modifiedItemsCount++;
  updateSeparator('context_separator:afterReloadAll') && modifiedItemsCount++;
  updateSeparator('context_separator:afterCollapseExpand') && modifiedItemsCount++;
  updateSeparator('context_separator:afterClose') && modifiedItemsCount++;

  const flattenExtraItems = Array.from(mExtraItems.values()).flat();

  updateSeparator('lastSeparatorBeforeExtraItems', {
    hasVisibleFollowing: contextTab && flattenExtraItems.some(item => !item.parentId && item.visible !== false)
  }) && modifiedItemsCount++;

  /* eslint-enable no-unused-expressions */

  if (mNativeContextMenuAvailable && modifiedItemsCount)
    browser.menus.refresh().catch(ApiTabs.createErrorSuppressor());
}

async function onClick(info, contextTab) {
  contextTab = contextTab && Tab.get(contextTab.id);
  const window    = await browser.windows.getLastFocused({ populate: true }).catch(ApiTabs.createErrorHandler());
  const windowId  = contextTab && contextTab.windowId || window.id;
  const activeTab = TabsStore.activeTabInWindow.get(windowId);

  let multiselectedTabs = Tab.getSelectedTabs(windowId);
  const isMultiselected = contextTab ? contextTab.$TST.multiselected : multiselectedTabs.length > 1;
  if (!isMultiselected)
    multiselectedTabs = null;

  switch (info.menuItemId.replace(/^noContextTab:/, '')) {
    case 'context_reloadTab':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.reload(tab.id)
            .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
        }
      }
      else {
        const tab = contextTab || activeTab;
        browser.tabs.reload(tab.id)
          .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
      }
      break;
    case 'context_toggleMuteTab-mute':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.id, { muted: true })
            .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
        }
      }
      else {
        browser.tabs.update(contextTab.id, { muted: true })
          .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
      }
      break;
    case 'context_toggleMuteTab-unmute':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.id, { muted: false })
            .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
        }
      }
      else {
        browser.tabs.update(contextTab.id, { muted: false })
          .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
      }
      break;
    case 'context_pinTab':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.id, { pinned: true })
            .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
        }
      }
      else {
        browser.tabs.update(contextTab.id, { pinned: true })
          .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
      }
      break;
    case 'context_unpinTab':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.id, { pinned: false })
            .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
        }
      }
      else {
        browser.tabs.update(contextTab.id, { pinned: false })
          .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
      }
      break;
    case 'context_duplicateTab':
      Commands.duplicateTab(contextTab, {
        destinationWindowId: windowId
      });
      break;
    case 'context_moveTabToStart':
      Commands.moveTabToStart(contextTab);
      break;
    case 'context_moveTabToEnd':
      Commands.moveTabToEnd(contextTab);
      break;
    case 'context_openTabInWindow':
      Commands.openTabInWindow(contextTab);
      break;
    case 'context_selectAllTabs': {
      const tabs = await browser.tabs.query({ windowId }).catch(ApiTabs.createErrorHandler());
      browser.tabs.highlight({
        windowId,
        populate: false,
        tabs:     [activeTab.index].concat(mapAndFilter(tabs,
                                                        tab => !tab.active ? tab.index : undefined))
      }).catch(ApiTabs.createErrorSuppressor());
    }; break;
    case 'context_bookmarkTab':
      Commands.bookmarkTab(contextTab);
      break;
    case 'context_bookmarkSelected':
      Commands.bookmarkTab(contextTab || activeTab);
      break;
    case 'context_bookmarkAllTabs':
      Commands.bookmarkTabs(Tab.getTabs(contextTab.windowId));
      break;
    case 'context_reloadAllTabs': {
      const tabs = await browser.tabs.query({ windowId }).catch(ApiTabs.createErrorHandler());
      for (const tab of tabs) {
        browser.tabs.reload(tab.id)
          .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
      }
    }; break;
    case 'context_closeTabsToTheEnd': {
      const tabs = await browser.tabs.query({ windowId }).catch(ApiTabs.createErrorHandler());
      let after = false;
      const closeTabs = [];
      const keptTabIds = new Set(
        multiselectedTabs ?
          multiselectedTabs.map(tab => tab.id) :
          [contextTab.id]
      );
      for (const tab of tabs) {
        if (keptTabIds.has(tab.id)) {
          after = true;
          continue;
        }
        if (after && !tab.pinned)
          closeTabs.push(Tab.get(tab.id));
      }
      const canceled = (await browser.runtime.sendMessage({
        type: Constants.kCOMMAND_NOTIFY_TABS_CLOSING,
        tabs: closeTabs.map(tab => tab.$TST.sanitized),
        windowId
      }).catch(ApiTabs.createErrorHandler())) === false;
      if (canceled)
        break;
      TabsInternalOperation.removeTabs(closeTabs);
    }; break;
    case 'context_closeOtherTabs': {
      const tabs  = await browser.tabs.query({ windowId }).catch(ApiTabs.createErrorHandler());
      const keptTabIds = new Set(
        multiselectedTabs ?
          multiselectedTabs.map(tab => tab.id) :
          [contextTab.id]
      );
      const closeTabs = mapAndFilter(tabs,
                                     tab => !tab.pinned && !keptTabIds.has(tab.id) && Tab.get(tab.id) || undefined);
      const canceled = (await browser.runtime.sendMessage({
        type: Constants.kCOMMAND_NOTIFY_TABS_CLOSING,
        tabs: closeTabs.map(tab => tab.$TST.sanitized),
        windowId
      }).catch(ApiTabs.createErrorHandler())) === false;
      if (canceled)
        break;
      TabsInternalOperation.removeTabs(closeTabs);
    }; break;
    case 'context_undoCloseTab': {
      const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 }).catch(ApiTabs.createErrorHandler());
      if (sessions.length && sessions[0].tab)
        browser.sessions.restore(sessions[0].tab.sessionId).catch(ApiTabs.createErrorSuppressor());
    }; break;
    case 'context_closeTab': {
      const closeTabs = (multiselectedTabs || TreeBehavior.getClosingTabsFromParent(contextTab, {
        byInternalOperation: true
      })).reverse(); // close down to top, to keep tree structure of Tree Style Tab
      const canceled = (await browser.runtime.sendMessage({
        type: Constants.kCOMMAND_NOTIFY_TABS_CLOSING,
        tabs: closeTabs.map(tab => tab.$TST.sanitized),
        windowId
      }).catch(ApiTabs.createErrorHandler())) === false;
      if (canceled)
        return;
      TabsInternalOperation.removeTabs(closeTabs);
    }; break;

    default: {
      const contextualIdentityMatch = info.menuItemId.match(/^context_reopenInContainer:(.+)$/);
      if (contextTab &&
          contextualIdentityMatch)
        Commands.reopenInContainer(contextTab, contextualIdentityMatch[1]);
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
  }).catch(ApiTabs.createErrorSuppressor());
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
        items.splice(i, 1, {
          ...item,
          ...message.params[1]
        });
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
