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
    const tabs = getDescendantTabs(aRootTab);
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
    const exceptionTabs = [aRootTab].concat(getDescendantTabs(aRootTab));
    const tabs          = getNormalTabs(aRootTab); // except pinned or hidden tabs
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
  },


  openNewTabAs: async function(aOptions = {}) {
    const currentTab = aOptions.baseTab || getTabById((await browser.tabs.query({
      active:        true,
      currentWindow: true
    }))[0]);

    let parent, insertBefore, insertAfter;
    let isOrphan = false;
    switch (aOptions.as) {
      case kNEWTAB_DO_NOTHING:
      default:
        break;

      case kNEWTAB_OPEN_AS_ORPHAN:
        isOrphan    = true;
        insertAfter = getLastTab(currentTab);
        break;

      case kNEWTAB_OPEN_AS_CHILD: {
        parent = currentTab;
        let refTabs = getReferenceTabsForNewChild(parent);
        insertBefore = refTabs.insertBefore;
        insertAfter  = refTabs.insertAfter;
        if (configs.logOnMouseEvent)
          log('detected reference tabs: ',
              dumpTab(parent), dumpTab(insertBefore), dumpTab(insertAfter));
      }; break;

      case kNEWTAB_OPEN_AS_SIBLING:
        parent      = getParentTab(currentTab);
        insertAfter = getLastDescendantTab(parent);
        break;

      case kNEWTAB_OPEN_AS_NEXT_SIBLING: {
        parent       = getParentTab(currentTab);
        insertBefore = getNextSiblingTab(currentTab);
        insertAfter  = getLastDescendantTab(currentTab);
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
        type:     kCOMMAND_SHOW_CONTAINER_SELECTOR,
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
    const newParent = getPreviousSiblingTab(aTab);
    if (!newParent ||
        newParent == getParentTab(aTab))
      return false;

    if (!aOptions.followChildren)
      detachAllChildren(aTab, {
        broadcast: true,
        behavior:  kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
      });
    await attachTabTo(aTab, newParent, {
      broadcast:   true,
      forceExpand: true,
      insertAfter: getLastDescendantTab(newParent) || newParent
    });
    return true;
  },

  outdent: async function(aTab, aOptions = {}) {
    const parent = getParentTab(aTab);
    if (!parent)
      return false;

    let newParent = getParentTab(parent);
    if (newParent == getParentTab(aTab))
      return false;

    if (!aOptions.followChildren)
      detachAllChildren(aTab, {
        broadcast: true,
        behavior:  kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
      });
    if (newParent) {
      await attachTabTo(aTab, newParent, {
        broadcast:   true,
        forceExpand: true,
        insertAfter: getLastDescendantTab(parent) || parent
      });
    }
    else {
      await detachTab(aTab, {
        broadcast: true,
      });
      await moveTabAfter(aTab, getLastDescendantTab(parent) || parent, {
        broadcast: true,
      });
    }
    return true;
  },

  moveUp: async function(aTab, aOptions = {}) {
    const previousTab = getPreviousTab(aTab);
    if (!previousTab)
      return false;

    if (!aOptions.followChildren)
      detachAllChildren(aTab, {
        broadcast: true,
        behavior:  kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
      });

    await moveTabBefore(aTab, previousTab, {
      broadcast: true
    });
    const index = getTabIndex(aTab);
    await tryFixupTreeForInsertedTab(aTab, {
      toIndex:   index,
      fromIndex: index + 1,
    });
    return true;
  },

  moveDown: async function(aTab, aOptions = {}) {
    const nextTab = getNextTab(aTab);
    if (!nextTab)
      return false;

    if (!aMessage.followChildren)
      detachAllChildren(aTab, {
        broadcast: true,
        behavior:  kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
      });

    await moveTabAfter(aTab, nextTab, {
      broadcast: true
    });
    const index = getTabIndex(aTab);
    await tryFixupTreeForInsertedTab(aTab, {
      toIndex:   index,
      fromIndex: index - 1,
    });
    return true;
  }
};