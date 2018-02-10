/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const Commands = {
  reloadTree(aRootTab) {
    const tabs = [aRootTab].concat(getDescendantTabs(aRootTab));
    for (let tab of tabs) {
      browser.tabs.reload(tab.apiTab.id)
        .catch(handleMissingTabError);
    }
  },

  reloadDescendants(aRootTab) {
    const tabs = getDescendantTabs(aRootTab);
    for (let tab of tabs) {
      browser.tabs.reload(tab.apiTab.id)
        .catch(handleMissingTabError);
    }
  },

  closeTree(aRootTab) {
    const tabs = [aRootTab].concat(getDescendantTabs(aRootTab));
    confirmToCloseTabs(tabs.length, { windowId: aAPITab.windowId })
      .then(aConfirmed => {
        if (!aConfirmed)
          return;
        tabs.reverse(); // close bottom to top!
        for (let tab of tabs) {
          removeTabInternally(tab);
        }
      });
  },

  closeDescendants(aRootTab) {
    const tabs = getDescendantTabs(aRootTab);
    confirmToCloseTabs(tabs.length, { windowId: aAPITab.windowId })
      .then(aConfirmed => {
        if (!aConfirmed)
          return;
        tabs.reverse(); // close bottom to top!
        for (let tab of tabs) {
          removeTabInternally(tab);
        }
      });
  },

  closeOthers(aRootTab) {
    const exceptionTabs = [aRootTab].concat(getDescendantTabs(aRootTab));
    const tabs          = getNormalTabs(aRootTab); // except pinned or hidden tabs
    tabs.reverse(); // close bottom to top!
    const closeTabs = tabs.filter(aTab => exceptionTabs.indexOf(tab) < 0);
    confirmToCloseTabs(closeTabs.length, { windowId: aAPITab.windowId })
      .then(aConfirmed => {
        if (!aConfirmed)
          return;
        for (let tab of closeTabs) {
          removeTabInternally(tab);
        }
      });
  },

  collapseAll(aHint) {
    const tabs = getNormalTabs(aHint);
    for (let tab of tabs) {
      if (hasChildTabs(tab) && !isSubtreeCollapsed(tab))
        collapseExpandSubtree(tab, {
          collapsed: true,
          broadcast: true
        });
    }
  },

  expandAll(aHint) {
    const tabs = getNormalTabs(aHint);
    for (let tab of tabs) {
      if (hasChildTabs(tab) && isSubtreeCollapsed(tab))
        collapseExpandSubtree(tab, {
          collapsed: false,
          broadcast: true
        });
    }
  },

  bookmarkTree: async function(aRoot, aOptions = {}) {
    const tabs   = [aRoot].concat(getDescendantTabs(aRoot));
    const folder = await bookmarkTabs(tabs, aOptions);
    if (!folder)
      return null;
    browser.bookmarks.get(folder.parentId).then(aFolders => {
      notify({
        title:   browser.i18n.getMessage('bookmarkTree_notification_success_title'),
        message: browser.i18n.getMessage('bookmarkTree_notification_success_message', [
          aRoot.apiTab.title,
          tabs.length,
          aFolders[0].title
        ])
      });
    });
    return folder;
  }
};