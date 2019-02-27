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

import * as ApiTabs from '/common/api-tabs.js';
import * as TabsGroup from '/common/tabs-group.js';
import * as Commands from '/common/commands.js';
import * as TSTAPI from '/common/tst-api.js';
import * as TabContextMenu from './tab-context-menu.js';

import Tab from '/common/Tab.js';

function log(...args) {
  internalLogger('background/context-menu', ...args);
}

// Imitation native context menu items depend on https://bugzilla.mozilla.org/show_bug.cgi?id=1280347
const mNativeContextMenuAvailable = typeof browser.menus.overrideContext == 'function';

const kROOT_ITEM = 'treestyletab';

const mContextMenuItemsById = {
  'reloadTree': {
    title: browser.i18n.getMessage('context_reloadTree_label')
  },
  'reloadDescendants': {
    title: browser.i18n.getMessage('context_reloadDescendants_label')
  },
  'separatorAfterReload': {
    type: 'separator'
  },
  'closeTree': {
    title: browser.i18n.getMessage('context_closeTree_label')
  },
  'closeDescendants': {
    title:       browser.i18n.getMessage('context_closeDescendants_label'),
    requireTree: true,
  },
  'closeOthers': {
    title: browser.i18n.getMessage('context_closeOthers_label')
  },
  'separatorAfterClose': {
    type: 'separator'
  },
  'collapseTree': {
    title:       browser.i18n.getMessage('context_collapseTree_label'),
    requireTree: true,
  },
  'collapseAll': {
    title: browser.i18n.getMessage('context_collapseAll_label')
  },
  'expandTree': {
    title:       browser.i18n.getMessage('context_expandTree_label'),
    requireTree: true,
  },
  'expandAll': {
    title: browser.i18n.getMessage('context_expandAll_label')
  },
  'separatorAfterCollapseExpand': {
    type: 'separator'
  },
  'bookmarkTree': {
    title: browser.i18n.getMessage('context_bookmarkTree_label')
  },
  'groupTabs': {
    title: browser.i18n.getMessage('context_groupTabs_label'),
    requireMultiselected: true
  },
  'separatorAfterBookmark': {
    type: 'separator'
  },
  'collapsed': {
    title:       browser.i18n.getMessage('context_collapsed_label'),
    requireTree: true,
    type:        'checkbox'
  },
  'pinnedTab': {
    title: browser.i18n.getMessage('context_pinnedTab_label'),
    type: 'radio'
  },
  'unpinnedTab': {
    title: browser.i18n.getMessage('context_unpinnedTab_label'),
    type: 'radio'
  }
};
const mContextMenuItems = [];
const mGroupedContextMenuItems = [];
for (const id of Object.keys(mContextMenuItemsById)) {
  const item = mContextMenuItemsById[id];
  item.id = id;
  item.configKey = `context_${id}`;
  item.checked = false; // initialize as unchecked
  item.enabled = true;
  // Access key is not supported by WE API.
  // See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1320462
  item.titleWithoutAccesskey = item.title && item.title.replace(/\(&[a-z]\)|&([a-z])/i, '$1');
  item.type = item.type || 'normal';
  item.lastVisible = item.visible = false;
  mContextMenuItems.push(item);
  mGroupedContextMenuItems.push(Object.assign({}, item, {
    id:       `grouped:${id}`,
    parentId: kROOT_ITEM
  }));
}

// for Firefox 63 and later
let mInitialized = false;

const mSeparator = {
  id:        `separatprBefore${kROOT_ITEM}`,
  type:      'separator',
  contexts:  ['tab'],
  viewTypes: ['sidebar'],
  documentUrlPatterns: [`moz-extension://${location.host}/*`],
  visible:   false
};
const manifest = browser.runtime.getManifest();
const mRootItem = {
  id:       kROOT_ITEM,
  type:     'normal',
  contexts: ['tab'],
  title:    manifest.name,
  icons:    manifest.icons,
  visible:  false
};

function initItems() {
  if (mInitialized)
    return;

  mInitialized = true;

  browser.menus.create(mSeparator);
  mSeparator.lastVisible = false;

  browser.menus.create(mRootItem);
  TabContextMenu.onExternalMessage({
    type: TSTAPI.kCONTEXT_MENU_CREATE,
    params: mRootItem
  }, browser.runtime);
  mRootItem.lastVisible = false;

  for (const item of mContextMenuItems.concat(mGroupedContextMenuItems)) {
    const id = item.id;
    const params = {
      id,
      type:     item.type,
      checked:  item.checked,
      title:    item.title,
      contexts: ['tab'],
      visible:  item.visible
    };
    if (item.parentId)
      params.parentId = item.parentId;
    browser.menus.create(params);
    TabContextMenu.onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_CREATE,
      params
    }, browser.runtime);
  }
}

function updateItem(id, params) {
  browser.menus.update(id, params).catch(ApiTabs.createErrorSuppressor());
  TabContextMenu.onExternalMessage({
    type:   TSTAPI.kCONTEXT_MENU_UPDATE,
    params: [id, params]
  }, browser.runtime);
}

function updateItemsVisibility(items, forceVisible = null) {
  let updated = false;
  let visibleItemsCount = 0;
  let visibleNormalItemsCount = 0;
  let lastSeparator;
  for (const item of items) {
    if (item.type == 'separator') {
      if (lastSeparator) {
        if (lastSeparator.lastVisible) {
          updateItem(lastSeparator.id, { visible: false });
          lastSeparator.lastVisible = false;
          updated = true;
        }
      }
      lastSeparator = item;
    }
    else {
      let visible = !(item.configKey in configs) || configs[item.configKey];
      if (forceVisible !== null)
        visible = forceVisible;
      if (visible) {
        if (lastSeparator) {
          updateItem(lastSeparator.id, { visible: visibleNormalItemsCount > 0 });
          lastSeparator.lastVisible = true;
          lastSeparator = null;
          updated = true;
          visibleNormalItemsCount = 0;
        }
        visibleNormalItemsCount++;
        visibleItemsCount++;
      }
      if (visible == item.lastVisible)
        continue;
      updateItem(item.id, { visible });
      item.lastVisible = visible;
      updated = true;
    }
  }
  if (lastSeparator && lastSeparator.lastVisible) {
    updateItem(lastSeparator.id, { visible: false });
    lastSeparator.lastVisible = false;
    updated = true;
  }
  return { updated, visibleItemsCount };
}

function updateItems() {
  let updated = false;

  const groupedItems = updateItemsVisibility(mGroupedContextMenuItems);
  if (groupedItems.updated)
    updated = true;

  const separatorVisible = configs.emulateDefaultContextMenu && groupedItems.visibleItemsCount > 0;
  if (separatorVisible != mSeparator.lastVisible) {
    updateItem(mSeparator.id, { visible: separatorVisible });
    mSeparator.lastVisible = separatorVisible;
    updated = true;
  }

  const grouped = configs.emulateDefaultContextMenu && groupedItems.visibleItemsCount > 1;
  if (grouped != mRootItem.lastVisible) {
    updateItem(mRootItem.id, { visible: grouped });
    mRootItem.lastVisible = grouped;
    updated = true;
  }

  const topLevelItems = updateItemsVisibility(mContextMenuItems, grouped ? false : null);
  if (topLevelItems.updated)
    updated = true;

  return updated;
}

// for Firefox 62 or olders
export function refreshItems() {
  if (mNativeContextMenuAvailable)
    return;

  browser.menus.remove(kROOT_ITEM).catch(ApiTabs.createErrorSuppressor());
  TabContextMenu.onExternalMessage({
    type:   TSTAPI.kCONTEXT_MENU_REMOVE,
    params: kROOT_ITEM
  }, browser.runtime);

  let separatorsCount = 0;
  let normalItemAppeared = false;
  const items = [];
  const customItems = [];
  for (const item of mContextMenuItems) {
    let id = item.id;
    browser.menus.remove(id).catch(ApiTabs.createErrorSuppressor());
    TabContextMenu.onExternalMessage({
      type:   TSTAPI.kCONTEXT_MENU_REMOVE,
      params: id
    }, browser.runtime);
    if (item.type == 'separator') {
      if (!normalItemAppeared)
        continue;
      normalItemAppeared = false;
      id = `separator${separatorsCount++}`;
    }
    else {
      if (item.hidden || !configs[`context_${id}`])
        continue;
      normalItemAppeared = true;
    }
    items.push({
      id,
      type:     item.type,
      checked:  item.checked,
      title:    item.titleWithoutAccesskey,
      contexts: ['tab']
    });
    customItems.push({
      type: TSTAPI.kCONTEXT_MENU_CREATE,
      params: {
        id,
        type:     item.type,
        checked:  item.checked,
        title:    item.title,
        contexts: ['tab']
      }
    });
  }

  if (items.length > 0 && items[items.length - 1].type == 'separator') {
    items.pop();
    customItems.pop();
  }
  if (items.length == 0)
    return;

  const grouped = configs.emulateDefaultContextMenu && items.length > 1;
  if (grouped) {
    const manifest = browser.runtime.getManifest();
    browser.menus.create({
      id:       kROOT_ITEM,
      type:     'normal',
      contexts: ['tab'],
      title:    manifest.name,
      icons:    manifest.icons
    });
    TabContextMenu.onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_CREATE,
      params: {
        id:       kROOT_ITEM,
        contexts: ['tab'],
        title:    manifest.name,
        icons:    manifest.icons
      }
    }, browser.runtime);
  }
  for (let i = 0, maxi = items.length; i < maxi; i++) {
    items[i].parentId = customItems[i].params.parentId = grouped ? kROOT_ITEM : null ;
    browser.menus.create(items[i]);
    TabContextMenu.onExternalMessage(customItems[i], browser.runtime);
  }
}

export const onClick = (info, tab) => {
  log('context menu item clicked: ', info, tab);

  const contextTab = Tab.get(tab.id);
  const selectedTabs = contextTab.$TST.multiselected ? Tab.getSelectedTabs(contextTab) : [];

  switch (info.menuItemId.replace(/^(?:grouped:|context_closeTabOptions_)/, '')) {
    case 'reloadTree':
      Commands.reloadTree(contextTab);
      break;
    case 'reloadDescendants':
      Commands.reloadDescendants(contextTab);
      break;

    case 'closeTree':
      Commands.closeTree(contextTab);
      break;
    case 'closeDescendants':
      Commands.closeDescendants(contextTab);
      break;
    case 'closeOthers':
      Commands.closeOthers(contextTab);
      break;

    case 'collapseTree':
      Commands.collapseTree(contextTab);
      break;
    case 'collapseAll':
      Commands.collapseAll(contextTab.windowId);
      break;
    case 'expandTree':
      Commands.expandTree(contextTab);
      break;
    case 'expandAll':
      Commands.expandAll(contextTab.windowId);
      break;

    case 'bookmarkTree':
      Commands.bookmarkTree(contextTab);
      break;

    case 'groupTabs':
      if (selectedTabs.length > 1)
        TabsGroup.groupTabs(selectedTabs, { broadcast: true });
      break;

    case 'collapsed':
      if (info.wasChecked)
        Commands.expandTree(contextTab);
      else
        Commands.collapseTree(contextTab);
      break;
    case 'pinnedTab': {
      const tabs = Tab.getPinnedTabs(contextTab.windowId);
      if (tabs.length > 0)
        browser.tabs.update(tabs[0].id, { active: true })
          .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
    }; break;
    case 'unpinnedTab': {
      const tabs = Tab.getUnpinnedTabs(tab.windowId);
      if (tabs.length > 0)
        browser.tabs.update(tabs[0].id, { active: true })
          .catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));
    }; break;

    default:
      break;
  }
};
browser.menus.onClicked.addListener(onClick);
TabContextMenu.onTSTItemClick.addListener(onClick);

function onShown(info, tab) {
  if (!info.contexts.includes('tab'))
    return;

  let updated = false;
  if (mNativeContextMenuAvailable) {
    initItems();
    updated = updateItems();
  }

  tab = tab && Tab.get(tab.id);
  const subtreeCollapsed = tab.$TST.subtreeCollapsed;
  const hasChild = tab.$TST.hasChild;
  const multiselected = tab.$TST.multiselected;

  for (const item of mContextMenuItems) {
    let newEnabled;
    if (item.requireTree) {
      newEnabled = hasChild;
      switch (item.id) {
        case 'collapseTree':
          if (subtreeCollapsed)
            newEnabled = false;
          break;
        case 'expandTree':
          if (!subtreeCollapsed)
            newEnabled = false;
          break;
      }
    }
    else if (item.requireMultiselected) {
      newEnabled = multiselected;
    }
    else {
      continue;
    }

    if (newEnabled == !!item.enabled)
      continue;

    const params = {
      enabled: item.enabled = newEnabled
    };

    updateItem(item.id, params);
    updateItem(`grouped:${item.id}`, params);
    updated = true;
  }

  const canExpand = hasChild && subtreeCollapsed;
  if (canExpand != mContextMenuItemsById.collapsed.checked) {
    mContextMenuItemsById.collapsed.checked = canExpand;
    const params = {
      checked: canExpand
    };
    updateItem('collapsed', params);
    updateItem(`grouped:collapsed`, params);
    updated = true;
  }

  if (updated)
    browser.menus.refresh().catch(ApiTabs.createErrorSuppressor());
}
browser.menus.onShown.addListener(onShown);
TabContextMenu.onTSTTabContextMenuShown.addListener(onShown);
