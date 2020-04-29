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
import * as TSTAPI from '/common/tst-api.js';
import * as TabContextMenu from './tab-context-menu.js';

import Tab from '/common/Tab.js';

import * as TabsGroup from './tabs-group.js';
import * as Commands from './commands.js';

function log(...args) {
  internalLogger('background/context-menu', ...args);
}

const kROOT_ITEM = 'treestyletab';

const mContextMenuItemsById = {
  'reloadTree': {
    title:              browser.i18n.getMessage('context_reloadTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_reloadTree_label_multiselected')
  },
  'reloadDescendants': {
    title:              browser.i18n.getMessage('context_reloadDescendants_label'),
    titleMultiselected: browser.i18n.getMessage('context_reloadDescendants_label_multiselected')
  },
  'separatorAfterReload': {
    type: 'separator'
  },
  'closeTree': {
    title:              browser.i18n.getMessage('context_closeTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_closeTree_label_multiselected')
  },
  'closeDescendants': {
    title:              browser.i18n.getMessage('context_closeDescendants_label'),
    titleMultiselected: browser.i18n.getMessage('context_closeDescendants_label_multiselected'),
    requireTree:        true,
  },
  'closeOthers': {
    title:              browser.i18n.getMessage('context_closeOthers_label'),
    titleMultiselected: browser.i18n.getMessage('context_closeOthers_label_multiselected')
  },
  'separatorAfterClose': {
    type: 'separator'
  },
  'collapseTree': {
    title:              browser.i18n.getMessage('context_collapseTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_collapseTree_label_multiselected'),
    requireTree: true,
  },
  'collapseTreeRecursively': {
    title:              browser.i18n.getMessage('context_collapseTreeRecursively_label'),
    titleMultiselected: browser.i18n.getMessage('context_collapseTreeRecursively_label_multiselected'),
    requireTree:        true,
  },
  'collapseAll': {
    title:               browser.i18n.getMessage('context_collapseAll_label'),
    hideOnMultiselected: true
  },
  'expandTree': {
    title:              browser.i18n.getMessage('context_expandTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_expandTree_label_multiselected'),
    requireTree:       true,
  },
  'expandTreeRecursively': {
    title:              browser.i18n.getMessage('context_expandTreeRecursively_label'),
    titleMultiselected: browser.i18n.getMessage('context_expandTreeRecursively_label_multiselected'),
    requireTree:        true,
  },
  'expandAll': {
    title:               browser.i18n.getMessage('context_expandAll_label'),
    hideOnMultiselected: true
  },
  'separatorAfterCollapseExpand': {
    type: 'separator'
  },
  'bookmarkTree': {
    title:              browser.i18n.getMessage('context_bookmarkTree_label'),
    titleMultiselected: browser.i18n.getMessage('context_bookmarkTree_label_multiselected')
  },
  'groupTabs': {
    title:                browser.i18n.getMessage('context_groupTabs_label'),
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
  item.titleMultiselectedWithoutAccesskey = item.titleMultiselected && item.titleMultiselected.replace(/\(&[a-z]\)|&([a-z])/i, '$1');
  item.type = item.type || 'normal';
  item.lastVisible = item.visible = false;
  item.lastTitle = item.title;
  mContextMenuItems.push(item);
  mGroupedContextMenuItems.push({
    ...item,
    id:       `grouped:${id}`,
    parentId: kROOT_ITEM
  });
}

browser.menus.create({
  id:       'openAllBookmarksWithStructure',
  title:    browser.i18n.getMessage('context_openAllBookmarksWithStructure_label'),
  contexts: ['bookmark']
});
browser.menus.create({
  id:       'openAllBookmarksWithStructureRecursively',
  title:    browser.i18n.getMessage('context_openAllBookmarksWithStructureRecursively_label'),
  contexts: ['bookmark']
});

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
  title:    browser.i18n.getMessage('context_menu_label'),
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
      contexts: item.contexts || ['tab'],
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

function updateItemsVisibility(items, { forceVisible = null, multiselected = false } = {}) {
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
      const title = multiselected && item.titleMultiselected || item.title;
      let visible = !(item.configKey in configs) || configs[item.configKey];
      if (forceVisible !== null)
        visible = forceVisible;
      if (item.hideOnMultiselected && multiselected)
        visible = false;
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
      const updatedParams = {};
      if (visible !== item.lastVisible) {
        updatedParams.visible = visible;
        item.lastVisible = visible;
      }
      if (title !== item.lastTitle) {
        updatedParams.title = title;
        item.lastTitle = title;
      }
      if (Object.keys(updatedParams).length == 0)
        continue;
      updateItem(item.id, updatedParams);
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

function updateItems({ multiselected } = {}) {
  let updated = false;

  const groupedItems = updateItemsVisibility(mGroupedContextMenuItems, { multiselected });
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

  const topLevelItems = updateItemsVisibility(mContextMenuItems, { forceVisible: grouped ? false : null, multiselected });
  if (topLevelItems.updated)
    updated = true;

  return updated;
}

export function onClick(info, tab) {
  if (info.bookmarkId)
    return onBookmarkItemClick(info);
  else
    return onTabItemClick(info, tab);
}
browser.menus.onClicked.addListener(onClick);

function onTabItemClick(info, tab) {
  // Extra context menu commands won't be available on the blank area of the tab bar.
  if (!tab)
    return;

  log('context menu item clicked: ', info, tab);

  const contextTab = Tab.get(tab.id);
  const contextTabs = contextTab.$TST.multiselected ? Tab.getSelectedTabs(contextTab.windowId) : [contextTab];

  const itemId = info.menuItemId.replace(/^(?:grouped:|context_topLevel_)/, '');
  if (mContextMenuItemsById[itemId] &&
      mContextMenuItemsById[itemId].type == 'checkbox')
    mContextMenuItemsById[itemId].checked = !mContextMenuItemsById[itemId].checked;

  const inverted = info.button == 1;
  switch (itemId) {
    case 'reloadTree':
      if (inverted)
        Commands.reloadDescendants(contextTabs);
      else
        Commands.reloadTree(contextTabs);
      break;
    case 'reloadDescendants':
      if (inverted)
        Commands.reloadTree(contextTabs);
      else
        Commands.reloadDescendants(contextTabs);
      break;

    case 'closeTree':
      if (inverted)
        Commands.closeDescendants(contextTabs);
      else
        Commands.closeTree(contextTabs);
      break;
    case 'closeDescendants':
      if (inverted)
        Commands.closeTree(contextTabs);
      else
        Commands.closeDescendants(contextTabs);
      break;
    case 'closeOthers':
      Commands.closeOthers(contextTabs);
      break;

    case 'collapseTree':
      Commands.collapseTree(contextTabs, { recursively: inverted });
      break;
    case 'collapseTreeRecursively':
      Commands.collapseTree(contextTabs, { recursively: !inverted });
      break;
    case 'collapseAll':
      Commands.collapseAll(contextTab.windowId);
      break;
    case 'expandTree':
      Commands.expandTree(contextTabs, { recursively: inverted });
      break;
    case 'expandTreeRecursively':
      Commands.expandTree(contextTabs, { recursively: !inverted });
      break;
    case 'expandAll':
      Commands.expandAll(contextTab.windowId);
      break;

    case 'bookmarkTree':
      Commands.bookmarkTree(contextTabs);
      break;

    case 'groupTabs':
      if (contextTabs.length > 1)
        TabsGroup.groupTabs(contextTabs, { broadcast: true });
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
}
TabContextMenu.onTSTItemClick.addListener(onTabItemClick);

function onBookmarkItemClick(info) {
  switch (info.menuItemId) {
    case 'openAllBookmarksWithStructure':
      Commands.openAllBookmarksWithStructure(info.bookmarkId, { recursively: false });
      break;
    case 'openAllBookmarksWithStructureRecursively':
      Commands.openAllBookmarksWithStructure(info.bookmarkId, { recursively: true });
      break;
  }
}

function onShown(info, tab) {
  if (info.contexts.includes('tab'))
    onTabContextMenuShown(info, tab);
  else if (info.contexts.includes('bookmark'))
    onBookmarkContextMenuShown(info);
}
browser.menus.onShown.addListener(onShown);

function onTabContextMenuShown(info, tab) {
  tab = tab && Tab.get(tab.id);
  const multiselected = tab && tab.$TST.multiselected;
  const contextTabs      = multiselected ? Tab.getSelectedTabs(tab.windowId) : tab ? [tab] : [];
  const hasChild         = contextTabs.some(tab => tab.$TST.hasChild);
  const subtreeCollapsed = contextTabs.some(tab => tab.$TST.subtreeCollapsed);

  initItems();
  let updated = updateItems({ multiselected });

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

  {
    const canExpand = hasChild && subtreeCollapsed;
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
TabContextMenu.onTSTTabContextMenuShown.addListener(onTabContextMenuShown);

async function onBookmarkContextMenuShown(info) {
  let isFolder = true;
  if (info.bookmarkId) {
    let item = await browser.bookmarks.get(info.bookmarkId);
    if (Array.isArray(item))
      item = item[0];
    isFolder = item.type == 'folder';
  }

  browser.menus.update('openAllBookmarksWithStructure', {
    visible: isFolder && configs.context_openAllBookmarksWithStructure
  });
  browser.menus.update('openAllBookmarksWithStructureRecursively', {
    visible: isFolder && configs.context_openAllBookmarksWithStructureRecursively
  });
  browser.menus.refresh().catch(ApiTabs.createErrorSuppressor());
}
