/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TabsMove from '/common/tabs-move.js';
import * as TabsOpen from '/common/tabs-open.js';
import * as Tree from '/common/tree.js';

import Tab from '/common/Tab.js';

function log(...args) {
  internalLogger('background/handle-new-tabs', ...args);
}


// this should return false if the tab is / may be moved while processing
Tab.onCreating.addListener((tab, info = {}) => {
  if (info.duplicatedInternally)
    return true;

  log('Tabs.onCreating ', dumpTab(tab), info);

  const possibleOpenerTab = info.activeTab || Tab.getActiveTab(tab.windowId);
  const opener = tab.$TST.opener;
  if (opener) {
    tab.$TST.setAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID, opener.$TST.uniqueId.id);
  }
  else {
    if (!info.maybeOrphan &&
        possibleOpenerTab &&
        /* New tab opened with browser.tabs.insertAfterCurrent=true may have
           next tab. In this case the tab is expected to be placed next to the
           active tab aways, so we should skip all repositioning behavior.
           See also: https://github.com/piroor/treestyletab/issues/2054 */
        !tab.$TST.next) {
      if (tab.$TST.isNewTabCommandTab) {
        if (!info.positionedBySelf) {
          log('behave as a tab opened by new tab command');
          return handleNewTabFromActiveTab(tab, {
            activeTab:                 possibleOpenerTab,
            autoAttachBehavior:        configs.autoAttachOnNewTabCommand,
            inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
          }).then(moved => !moved);
        }
        return false;
      }
      else if (possibleOpenerTab != tab) {
        tab.$TST.possibleOpenerTab = possibleOpenerTab.id;
      }
      tab.$TST.isNewTab = true;
    }
    log('behave as a tab opened with any URL');
    return true;
  }

  log(`opener: ${dumpTab(opener)}, positionedBySelf = ${info.positionedBySelf}`);
  if (opener && opener.pinned &&
      opener.windowId == tab.windowId) {
    if (configs.autoGroupNewTabsFromPinned) {
      return false;
    }
    if (configs.insertNewTabFromPinnedTabAt == Constants.kINSERT_END) {
      return TabsMove.moveTabAfter(tab, Tab.getLastTab(tab.windowId), {
        delayedMove: true,
        broadcast:   true
      }).then(moved => !moved);
    }
  }
  else if (!info.maybeOrphan && configs.autoAttach) {
    return Tree.behaveAutoAttachedTab(tab, {
      baseTab:   opener,
      behavior:  configs.autoAttachOnOpenedWithOwner,
      dontMove:  info.positionedBySelf,
      broadcast: true
    }).then(moved => !moved);
  }
  return true;
});

async function handleNewTabFromActiveTab(tab, params = {}) {
  const activeTab = params.activeTab;
  log('handleNewTabFromActiveTab: activeTab = ', dumpTab(activeTab), params);
  const moved = await Tree.behaveAutoAttachedTab(tab, {
    baseTab:   activeTab,
    behavior:  params.autoAttachBehavior,
    broadcast: true
  });
  const parent = tab.$TST.parent;
  if (!parent ||
      !params.inheritContextualIdentity ||
      tab.cookieStoreId != 'firefox-default' ||
      tab.cookieStoreId == parent.cookieStoreId)
    return moved;
  const cookieStoreId = activeTab.cookieStoreId;
  log('handleNewTabFromActiveTab: reopen with inherited contextual identity ', cookieStoreId);
  await TabsOpen.openNewTab({
    parent,
    insertBefore: tab,
    cookieStoreId
  });
  TabsInternalOperation.removeTab(tab);
  return moved;
}

Tab.onCreated.addListener((tab, info = {}) => {
  if (!info.duplicated)
    return;
  const original = info.originalTab;
  log('duplicated ', dumpTab(tab), dumpTab(original));
  if (info.duplicatedInternally) {
    log('duplicated by internal operation');
    tab.$TST.addState(Constants.kTAB_STATE_DUPLICATING, { broadcast: true });
  }
  else {
    Tree.behaveAutoAttachedTab(tab, {
      baseTab:   original,
      behavior:  configs.autoAttachOnDuplicated,
      dontMove:  info.positionedBySelf,
      broadcast: true
    });
  }
});

Tab.onUpdated.addListener((tab, changeInfo) => {
  if ('openerTabId' in changeInfo &&
      configs.syncParentTabAndOpenerTab) {
    Tab.waitUntilTrackedAll(tab.windowId).then(() => {
      const parent = tab.$TST.opener;
      if (!parent ||
          parent.windowId != tab.windowId ||
          parent == tab.$TST.parent)
        return;
      Tree.attachTabTo(tab, parent, {
        insertAt:    Constants.kINSERT_NEAREST,
        forceExpand: tab.active,
        broadcast:   true
      });
    });
  }

  if ((changeInfo.url || changeInfo.status == 'complete') &&
      tab.$TST.isNewTab) {
    log('new tab ', dumpTab(tab));
    delete tab.$TST.isNewTab;
    const possibleOpenerTab = Tab.get(tab.$TST.possibleOpenerTab);
    delete tab.$TST.possibleOpenerTab;
    log('possibleOpenerTab ', dumpTab(possibleOpenerTab));
    const window = TabsStore.windows.get(tab.windowId);
    const toBeGroupedTabs = window.openedNewTabs;
    log('toBeGroupedTabs ', toBeGroupedTabs);
    if (!tab.$TST.parent &&
        possibleOpenerTab &&
        !toBeGroupedTabs.includes(tab.id)) {
      if (tab.$TST.isNewTabCommandTab) {
        log('behave as a tab opened by new tab command (delayed)');
        handleNewTabFromActiveTab(tab, {
          activeTab:                 possibleOpenerTab,
          autoAttachBehavior:        configs.autoAttachOnNewTabCommand,
          inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
        });
      }
      else {
        const siteMatcher  = /^\w+:\/\/([^\/]+)(?:$|\/.*$)/;
        const openerTabSite = possibleOpenerTab.url.match(siteMatcher);
        const newTabSite    = tab.url.match(siteMatcher);
        if (openerTabSite && newTabSite && openerTabSite[1] == newTabSite[1]) {
          log('behave as a tab opened from same site (delayed)');
          handleNewTabFromActiveTab(tab, {
            activeTab:                 possibleOpenerTab,
            autoAttachBehavior:        configs.autoAttachSameSiteOrphan,
            inheritContextualIdentity: configs.inheritContextualIdentityToSameSiteOrphan
          });
        }
      }
    }
  }
});


Tab.onAttached.addListener(async (tab, info = {}) => {
  if (!info.windowId ||
      !Tree.shouldApplyTreeBehavior(info))
    return;

  log('Tabs.onAttached ', dumpTab(tab), info);

  log('descendants of attached tab: ', info.descendants.map(dumpTab));
  const movedTabs = await Tree.moveTabs(info.descendants, {
    destinationWindowId: tab.windowId,
    insertAfter:         tab
  });
  log('moved descendants: ', movedTabs.map(dumpTab));
  for (const movedTab of movedTabs) {
    Tree.attachTabTo(movedTab, tab, {
      broadcast: true,
      dontMove:  true
    });
  }
});
