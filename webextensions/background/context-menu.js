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

import * as Tabs from '/common/tabs.js';
import * as TabsGroup from '/common/tabs-group.js';
import * as Commands from '/common/commands.js';
import * as TSTAPI from '/common/tst-api.js';
import * as TabContextMenu from './tab-context-menu.js';

function log(...args) {
  internalLogger('background/context-menu', ...args);
}

// Imitation native context menu items depend on https://bugzilla.mozilla.org/show_bug.cgi?id=1280347
const mNativeContextMenuAvailable = typeof browser.menus.overrideContext == 'function';

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
    type: 'separator',
    get hidden() {
      return !(
        configs.context_collapsed ||
        configs.context_pinnedTab ||
        configs.context_unpinnedTab
      );
    }
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
const mContextMenuItems = Object.keys(mContextMenuItemsById).map(id => {
  const item = mContextMenuItemsById[id];
  item.id = id;
  item.checked = false; // initialize as unchecked
  item.enabled = true;
  // Access key is not supported by WE API.
  // See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1320462
  item.titleWithoutAccesskey = item.title && item.title.replace(/\(&[a-z]\)|&([a-z])/i, '$1');
  item.type = item.type || 'normal';
  item.lastVisible = item.visible = false;
  return item;
});

const kROOT_ITEM = 'treestyletab';

export function refreshItems() {
  if (mNativeContextMenuAvailable) {
    initItems();
    updateItems();
  }
  else {
    refreshItemsLegacy();
  }
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

  for (const item of mContextMenuItems) {
    const id = item.id;
    const params = {
      id,
      type:     item.type,
      checked:  item.checked,
      title:    item.title,
      contexts: ['tab'],
      visible:  item.visible
    };
    browser.menus.create(params);
    TabContextMenu.onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_CREATE,
      params
    }, browser.runtime);
    const groupedParams = Object.assign({}, params, {
      id:       `grouped:${id}`,
      parentId: kROOT_ITEM
    });
    browser.menus.create(groupedParams);
    TabContextMenu.onExternalMessage({
      type:   TSTAPI.kCONTEXT_MENU_CREATE,
      params: groupedParams
    }, browser.runtime);
  }
}

function updateItems() {
  let updated = false;
  let visibleItemsCount = 0;
  let visibleNormalItemsCount = 0;
  for (const item of mContextMenuItems) {
    const id = item.id;
    let visible;
    if (item.type == 'separator') {
      visible = !item.hidden && visibleNormalItemsCount > 0;
      visibleNormalItemsCount = 0;
    }
    else {
      visible = !item.hidden && (!(`context_${id}` in configs) || configs[`context_${id}`]);
      if (visible)
        visibleNormalItemsCount++;
    }
    if (visible)
      visibleItemsCount++;
    if (visible == item.lastVisible)
      continue;
    browser.menus.update(`grouped:${id}`, { visible });
    TabContextMenu.onExternalMessage({
      type:   TSTAPI.kCONTEXT_MENU_UPDATE,
      params: [`grouped:${id}`, { visible }]
    }, browser.runtime);
    item.visible = visible;
    updated = true;
  }

  const separatorVisible = visibleItemsCount > 0;
  if (separatorVisible != mSeparator.lastVisible) {
    browser.menus.update(mSeparator.id, { visible: separatorVisible });
    TabContextMenu.onExternalMessage({ type: TSTAPI.kCONTEXT_MENU_UPDATE,
      params: [mSeparator.id, { visible: separatorVisible }]
    }, browser.runtime);
    mSeparator.lastVisible = separatorVisible;
    updated = true;
  }

  const grouped = visibleItemsCount > 1;
  if (grouped != mRootItem.lastVisible) {
    browser.menus.update(mRootItem.id, { visible: grouped });
    TabContextMenu.onExternalMessage({
      type:   TSTAPI.kCONTEXT_MENU_UPDATE,
      params: [mRootItem.id, { visible: grouped }]
    }, browser.runtime);
    mRootItem.lastVisible = grouped;
    updated = true;
  }

  for (const item of mContextMenuItems) {
    const visible = item.visible && !grouped;
    if (visible == item.lastVisible)
      continue;
    browser.menus.update(item.id, { visible });
    TabContextMenu.onExternalMessage({
      type:   TSTAPI.kCONTEXT_MENU_UPDATE,
      params: [item.id, { visible }]
    }, browser.runtime);
    item.lastVisible = visible;
    updated = true;
  }

  if (updated)
    browser.menus.refresh();
}

// for Firefox 62 or olders
function refreshItemsLegacy() {
  browser.menus.remove(kROOT_ITEM);
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
    browser.menus.remove(id);
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

  const grouped = items.length > 1;
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

export const onClick = (info, apiTab) => {
  log('context menu item clicked: ', info, apiTab);

  const contextTab = Tabs.getTabById(apiTab);
  const selectedTabs = Tabs.isMultiselected(contextTab) ? Tabs.getSelectedTabs(contextTab) : [];

  switch (info.menuItemId.replace(/^grouped:/, '')) {
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
      Commands.collapseAll(contextTab);
      break;
    case 'expandTree':
      Commands.expandTree(contextTab);
      break;
    case 'expandAll':
      Commands.expandAll(contextTab);
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
      const tabs = Tabs.getPinnedTabs(contextTab);
      if (tabs.length > 0)
        browser.tabs.update(tabs[0].apiTab.id, { active: true });
    }; break;
    case 'unpinnedTab': {
      const tabs = Tabs.getUnpinnedTabs(contextTab);
      if (tabs.length > 0)
        browser.tabs.update(tabs[0].apiTab.id, { active: true });
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

  tab = tab && Tabs.getTabById(tab.id);
  const subtreeCollapsed = Tabs.isSubtreeCollapsed(tab);
  const hasChild = Tabs.hasChildTabs(tab);
  const multiselected = Tabs.isMultiselected(tab);

  let updated = false;
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

    browser.menus.update(item.id, params);
    TabContextMenu.onExternalMessage({
      type:   TSTAPI.kCONTEXT_MENU_UPDATE,
      params: [item.id, params]
    }, browser.runtime);
    if (mNativeContextMenuAvailable) {
      browser.menus.update(`grouped:${item.id}`, params);
      TabContextMenu.onExternalMessage({
        type:   TSTAPI.kCONTEXT_MENU_UPDATE,
        params: [`grouped:${item.id}`, params]
      }, browser.runtime);
    }
    updated = true;
  }

  const canExpand = hasChild && subtreeCollapsed;
  if (canExpand != mContextMenuItemsById.collapsed.checked) {
    mContextMenuItemsById.collapsed.checked = canExpand;
    const params = {
      checked: canExpand
    };
    browser.menus.update('collapsed', params);
    TabContextMenu.onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_UPDATE,
      params: ['collapsed', params]
    }, browser.runtime);
    if (mNativeContextMenuAvailable) {
      browser.menus.update(`grouped:collapsed`, params);
      TabContextMenu.onExternalMessage({
        type:   TSTAPI.kCONTEXT_MENU_UPDATE,
        params: ['grouped:collapsed', params]
      }, browser.runtime);
    }
    updated = true;
  }

  if (updated)
    browser.menus.refresh();
}
browser.menus.onShown.addListener(onShown);
TabContextMenu.onTSTTabContextMenuShown.addListener(onShown);
