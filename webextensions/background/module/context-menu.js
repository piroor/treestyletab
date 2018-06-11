/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// Defined in a classic script source, and we can read these as global variables. 
/* global
  tabContextMenu: false,
  getTabById: false,
  Commands: false,
 */

import {
  kTSTAPI_CONTEXT_MENU_REMOVE_ALL,
  kTSTAPI_CONTEXT_MENU_CREATE
} from '../../common/module/constants.js';
import {
  log,
  configs
} from '../../common/module/common.js';

var gContextMenuItems = `
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
  tabContextMenu.onExternalMessage({
    type: kTSTAPI_CONTEXT_MENU_REMOVE_ALL
  }, browser.runtime);

  let separatorsCount = 0;
  let normalItemAppeared = false;
  for (let id of gContextMenuItems) {
    let isSeparator = id.charAt(0) == '-';
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
    let type  = isSeparator ? 'separator' : 'normal';
    let title = isSeparator ? null : browser.i18n.getMessage(`context_${id}_label`);
    browser.contextMenus.create({
      id, type,
      // Access key is not supported by WE API.
      // See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1320462
      title: title && title.replace(/\(&[a-z]\)|&([a-z])/i, '$1'),
      contexts: ['tab']
    });
    tabContextMenu.onExternalMessage({
      type: kTSTAPI_CONTEXT_MENU_CREATE,
      params: {
        id, type, title,
        contexts: ['tab']
      }
    }, browser.runtime);
  }
}

export const onClick = (aInfo, aAPITab) => {
  log('context menu item clicked: ', aInfo, aAPITab);

  var contextTab = getTabById(aAPITab);

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
