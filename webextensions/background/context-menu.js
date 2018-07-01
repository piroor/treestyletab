/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from '../common/common.js';

import * as Tabs from '../common/tabs.js';
import * as Commands from '../common/commands.js';
import * as TSTAPI from '../common/tst-api.js';
import * as TabContextMenu from './tab-context-menu.js';

function log(...args) {
  if (configs.logFor['background/context-menu'])
    internalLogger(...args);
}

const mContextMenuItems = `
  reloadTree:normal
  reloadDescendants:normal
  -----------------:separator
  closeTree:normal
  closeDescendants:normal
  closeOthers:normal
  -----------------:separator
  collapseTree:normal
  collapseAll:normal
  expandTree:normal
  expandAll:normal
  -----------------:separator
  bookmarkTree:normal
  -----------------:separator
  collapsed:checkbox
`.trim().split(/\s+/).map(definition => {
    const [id, type] = definition.split(':');
    const isSeparator = type == 'separator' || id.charAt(0) == '-';
    const title = isSeparator ? null : browser.i18n.getMessage(`context_${id}_label`) || id;
    return {
      id,
      title,
      checked: false, // initialize as unchecked
      // Access key is not supported by WE API.
      // See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1320462
      titleWithoutAccesskey: title && title.replace(/\(&[a-z]\)|&([a-z])/i, '$1'),
      type: isSeparator ? 'separator' : type,
      isSeparator
    };
  });

export async function refreshItems() {
  browser.menus.removeAll();
  TabContextMenu.onExternalMessage({
    type: TSTAPI.kCONTEXT_MENU_REMOVE_ALL
  }, browser.runtime);

  let separatorsCount = 0;
  let normalItemAppeared = false;
  const items = [];
  const customItems = [];
  for (const item of mContextMenuItems) {
    let id = item.id;
    if (item.isSeparator) {
      if (!normalItemAppeared)
        continue;
      normalItemAppeared = false;
      id = `separator${separatorsCount++}`;
    }
    else {
      if (!configs[`context_${id}`])
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
  if (items[items.length - 1].type == 'separator') {
    items.pop();
    customItems.pop();
  }
  for (let i = 0, maxi = items.length; i < maxi; i++) {
    browser.menus.create(items[i]);
    TabContextMenu.onExternalMessage(customItems[i], browser.runtime);
  }
}

export const onClick = (info, apiTab) => {
  log('context menu item clicked: ', info, apiTab);

  const contextTab = Tabs.getTabById(apiTab);

  switch (info.menuItemId) {
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

    default:
      break;
  }
};
browser.menus.onClicked.addListener(onClick);
TabContextMenu.onTSTItemClick.addListener(onClick);
