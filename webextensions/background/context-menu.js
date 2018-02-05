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
    let title = isSeparator ? null : browser.i18n.getMessage(`context.${id}.label`);
    browser.contextMenus.create({
      id, type, title,
      contexts: ['page', 'tab']
    });
    tabContextMenu.onExternalMessage({
      type: kTSTAPI_CONTEXT_MENU_CREATE,
      params: {
        id, type, title,
        contexts: ['page', 'tab']
      }
    }, browser.runtime);
  }
}

var contextMenuClickListener = (aInfo, aTab) => {
  log('context menu item clicked: ', aInfo, aTab);

  var contextTab = getTabById(aTab.id);
  var container  = contextTab.parentNode;

  switch (aInfo.menuItemId) {
    case 'reloadTree': {
      let tabs = [contextTab].concat(getDescendantTabs(contextTab));
      for (let tab of tabs) {
        browser.tabs.reload(tab.apiTab.id)
          .catch(handleMissingTabError);
      }
    }; break;
    case 'reloadDescendants': {
      let tabs = getDescendantTabs(contextTab);
      for (let tab of tabs) {
        browser.tabs.reload(tab.apiTab.id)
          .catch(handleMissingTabError);
      }
    }; break;

    case 'closeTree': {
      let tabs = [contextTab].concat(getDescendantTabs(contextTab));
      confirmToCloseTabs(tabs.length, { windowId: aTab.windowId })
        .then(aConfirmed => {
          if (!aConfirmed)
            return;
          tabs.reverse(); // close bottom to top!
          for (let tab of tabs) {
            removeTabInternally(tab);
          }
        });
    }; break;
    case 'closeDescendants': {
      let tabs = getDescendantTabs(contextTab);
      confirmToCloseTabs(tabs.length, { windowId: aTab.windowId })
        .then(aConfirmed => {
          if (!aConfirmed)
            return;
          tabs.reverse(); // close bottom to top!
          for (let tab of tabs) {
            removeTabInternally(tab);
          }
        });
    }; break;
    case 'closeOthers': {
      let exceptionTabs = [contextTab].concat(getDescendantTabs(contextTab));
      let tabs          = getNormalTabs(container); // except pinned or hidden tabs
      tabs.reverse(); // close bottom to top!
      let closeTabs = tabs.filter(aTab => exceptionTabs.indexOf(tab) < 0);
      confirmToCloseTabs(closeTabs.length, { windowId: aTab.windowId })
        .then(aConfirmed => {
          if (!aConfirmed)
            return;
          for (let tab of closeTabs) {
            removeTabInternally(tab);
          }
        });
    }; break;

    case 'collapseAll': {
      let tabs = getNormalTabs(container);
      for (let tab of tabs) {
        if (hasChildTabs(tab) && !isSubtreeCollapsed(tab))
          collapseExpandSubtree(tab, {
            collapsed: true,
            broadcast: true
          });
      }
    }; break;
    case 'expandAll': {
      let tabs = getNormalTabs(container);
      for (let tab of tabs) {
        if (hasChildTabs(tab) && isSubtreeCollapsed(tab))
          collapseExpandSubtree(tab, {
            collapsed: false,
            broadcast: true
          });
      }
    }; break;

    case 'bookmarkTree': {
      bookmarkTree(contextTab);
    }; break;

    default:
      break;
  }
};
browser.contextMenus.onClicked.addListener(contextMenuClickListener);
