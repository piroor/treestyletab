/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const Commands = {
  reloadTree(aRootTab) {
    const tabs = [aRootTab].concat(GetTabs.getDescendantTabs(aRootTab));
    for (let tab of tabs) {
      browser.tabs.reload(tab.apiTab.id)
        .catch(ApiTabs.handleMissingTabError);
    }
  },

  reloadDescendants(aRootTab) {
    const tabs = GetTabs.getDescendantTabs(aRootTab);
    for (let tab of tabs) {
      browser.tabs.reload(tab.apiTab.id)
        .catch(ApiTabs.handleMissingTabError);
    }
  },

  closeTree(aRootTab) {
    const tabs = [aRootTab].concat(GetTabs.getDescendantTabs(aRootTab));
    confirmToCloseTabs(tabs.length, { windowId: aRootTab.apiTab.windowId })
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
    const tabs = GetTabs.getDescendantTabs(aRootTab);
    confirmToCloseTabs(tabs.length, { windowId: aRootTab.apiTab.windowId })
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
    const exceptionTabs = [aRootTab].concat(GetTabs.getDescendantTabs(aRootTab));
    const tabs          = GetTabs.getNormalTabs(aRootTab); // except pinned or hidden tabs
    tabs.reverse(); // close bottom to top!
    const closeTabs = tabs.filter(aTab => exceptionTabs.indexOf(aTab) < 0);
    confirmToCloseTabs(closeTabs.length, { windowId: aRootTab.apiTab.windowId })
      .then(aConfirmed => {
        if (!aConfirmed)
          return;
        for (let tab of closeTabs) {
          removeTabInternally(tab);
        }
      });
  },

  collapseAll(aHint) {
    const tabs = GetTabs.getNormalTabs(aHint);
    for (let tab of tabs) {
      if (TabInfo.hasChildTabs(tab) && !TabInfo.isSubtreeCollapsed(tab))
        collapseExpandSubtree(tab, {
          collapsed: true,
          broadcast: true
        });
    }
  },

  expandAll(aHint) {
    const tabs = GetTabs.getNormalTabs(aHint);
    for (let tab of tabs) {
      if (TabInfo.hasChildTabs(tab) && TabInfo.isSubtreeCollapsed(tab))
        collapseExpandSubtree(tab, {
          collapsed: false,
          broadcast: true
        });
    }
  },

  bookmarkTree: async function(aRoot, aOptions = {}) {
    const tabs   = [aRoot].concat(GetTabs.getDescendantTabs(aRoot));
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
  },


  openNewTabAs: async function(aOptions = {}) {
    const currentTab = aOptions.baseTab || GetTabs.getTabById((await browser.tabs.query({
      active:        true,
      currentWindow: true
    }))[0]);

    let parent, insertBefore, insertAfter;
    let isOrphan = false;
    switch (aOptions.as) {
      case Constants.kNEWTAB_DO_NOTHING:
      default:
        break;

      case Constants.kNEWTAB_OPEN_AS_ORPHAN:
        isOrphan    = true;
        insertAfter = GetTabs.getLastTab(currentTab);
        break;

      case Constants.kNEWTAB_OPEN_AS_CHILD: {
        parent = currentTab;
        let refTabs = getReferenceTabsForNewChild(parent);
        insertBefore = refTabs.insertBefore;
        insertAfter  = refTabs.insertAfter;
        if (configs.logOnMouseEvent)
          log('detected reference tabs: ',
              dumpTab(parent), dumpTab(insertBefore), dumpTab(insertAfter));
      }; break;

      case Constants.kNEWTAB_OPEN_AS_SIBLING:
        parent      = GetTabs.getParentTab(currentTab);
        insertAfter = GetTabs.getLastDescendantTab(parent);
        break;

      case Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING: {
        parent       = GetTabs.getParentTab(currentTab);
        insertBefore = GetTabs.getNextSiblingTab(currentTab);
        insertAfter  = GetTabs.getLastDescendantTab(currentTab);
      }; break;
    }

    if (parent &&
        configs.inheritContextualIdentityToNewChildTab &&
        !aOptions.cookieStoreId)
      aOptions.cookieStoreId = parent.apiTab.cookieStoreId;

    openNewTab({
      parent, insertBefore, insertAfter,
      isOrphan,
      inBackground:  !!aOptions.inBackground,
      cookieStoreId: aOptions.cookieStoreId,
      inRemote:      !!aOptions.inRemote
    });
  },

  showContainerSelector(aOptions = {}) {
    if (aOptions.inRemote) {
      return browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SHOW_CONTAINER_SELECTOR,
        windowId: activeTab.apiTab.windowId
      });
    }
    const anchor = document.querySelector(`
      :root.contextual-identity-selectable .contextual-identities-selector-anchor,
      .newtab-button
    `);
    gContextualIdentitySelector.ui.open({ anchor });
  },

  indent: async function(aTab, aOptions = {}) {
    const newParent = GetTabs.getPreviousSiblingTab(aTab);
    if (!newParent ||
        newParent == GetTabs.getParentTab(aTab))
      return false;

    if (!aOptions.followChildren)
      detachAllChildren(aTab, {
        broadcast: true,
        behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
      });
    await attachTabTo(aTab, newParent, {
      broadcast:   true,
      forceExpand: true,
      insertAfter: GetTabs.getLastDescendantTab(newParent) || newParent
    });
    return true;
  },

  outdent: async function(aTab, aOptions = {}) {
    const parent = GetTabs.getParentTab(aTab);
    if (!parent)
      return false;

    let newParent = GetTabs.getParentTab(parent);
    if (newParent == GetTabs.getParentTab(aTab))
      return false;

    if (!aOptions.followChildren)
      detachAllChildren(aTab, {
        broadcast: true,
        behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
      });
    if (newParent) {
      await attachTabTo(aTab, newParent, {
        broadcast:   true,
        forceExpand: true,
        insertAfter: GetTabs.getLastDescendantTab(parent) || parent
      });
    }
    else {
      await detachTab(aTab, {
        broadcast: true,
      });
      await moveTabAfter(aTab, GetTabs.getLastDescendantTab(parent) || parent, {
        broadcast: true,
      });
    }
    return true;
  },

  moveUp: async function(aTab, aOptions = {}) {
    const previousTab = GetTabs.getPreviousTab(aTab);
    if (!previousTab)
      return false;

    if (!aOptions.followChildren)
      detachAllChildren(aTab, {
        broadcast: true,
        behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
      });

    await moveTabBefore(aTab, previousTab, {
      broadcast: true
    });
    const index = GetTabs.getTabIndex(aTab);
    await tryFixupTreeForInsertedTab(aTab, {
      toIndex:   index,
      fromIndex: index + 1,
    });
    return true;
  },

  moveDown: async function(aTab, aOptions = {}) {
    const nextTab = GetTabs.getNextTab(aTab);
    if (!nextTab)
      return false;

    if (!aOptions.followChildren)
      detachAllChildren(aTab, {
        broadcast: true,
        behavior:  Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
      });

    await moveTabAfter(aTab, nextTab, {
      broadcast: true
    });
    const index = GetTabs.getTabIndex(aTab);
    await tryFixupTreeForInsertedTab(aTab, {
      toIndex:   index,
      fromIndex: index - 1,
    });
    return true;
  }
};