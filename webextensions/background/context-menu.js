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

function log(...aArgs) {
  if (configs.logFor['background/context-menu'])
    internalLogger(...aArgs);
}

const mContextMenuItems = `
  reloadTree
  reloadDescendants
  -----------------
  closeTree
  closeDescendants
  closeOthers
  -----------------
  collapseAll
  expandAll
  -----------------
  bookmarkTree
`.trim().split(/\s+/);

export async function refreshItems() {
  browser.contextMenus.removeAll();
  TabContextMenu.onExternalMessage({
    type: TSTAPI.kCONTEXT_MENU_REMOVE_ALL
  }, browser.runtime);

  let separatorsCount = 0;
  let normalItemAppeared = false;
  for (let id of mContextMenuItems) {
    const isSeparator = id.charAt(0) == '-';
    if (isSeparator) {
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
    const type  = isSeparator ? 'separator' : 'normal';
    const title = isSeparator ? null : browser.i18n.getMessage(`context_${id}_label`);
    browser.contextMenus.create({
      id, type,
      // Access key is not supported by WE API.
      // See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1320462
      title: title && title.replace(/\(&[a-z]\)|&([a-z])/i, '$1'),
      contexts: ['tab']
    });
    TabContextMenu.onExternalMessage({
      type: TSTAPI.kCONTEXT_MENU_CREATE,
      params: {
        id, type, title,
        contexts: ['tab']
      }
    }, browser.runtime);
  }
}

export const onClick = (aInfo, aAPITab) => {
  log('context menu item clicked: ', aInfo, aAPITab);

  const contextTab = Tabs.getTabById(aAPITab);

  switch (aInfo.menuItemId) {
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

    case 'collapseAll':
      Commands.collapseAll(contextTab);
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
browser.contextMenus.onClicked.addListener(onClick);
TabContextMenu.onTSTItemClick.addListener(onClick);
