/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

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

async function refreshContextMenuItems() {
  await browser.contextMenus.removeAll();

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
    let type = isSeparator ? 'separator' : 'normal';
    let title = isSeparator ? null : browser.i18n.getMessage(`context.${id}.label`);
    await browser.contextMenus.create({
      id, type, title,
      contexts: ['page', 'tab']
    });
  }
}

configs.$load().then(() => {
  refreshContextMenuItems();
});

configs.$addObserver(aKey => {
  if (aKey.indexOf('context_') == 0)
    refreshContextMenuItems();
});

browser.contextMenus.onClicked.addListener((aInfo, aTab) => {
  switch (aInfo.menuItemId) {
    case 'reloadTree':
      break;
    case 'reloadDescendants':
      break;

    case 'closeTree':
      break;
    case 'closeDescendants':
      break;
    case 'closeOthers':
      break;

    case 'collapseAll':
      break;
    case 'expandAll':
      break;

    case 'bookmarkTree':
      break;

    default:
      break;
  }
});
