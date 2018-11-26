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
import * as Tabs from '/common/tabs.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TabsMove from '/common/tabs-move.js';
import * as TabsOpen from '/common/tabs-open.js';
import * as Tree from '/common/tree.js';

function log(...args) {
  internalLogger('background/handle-new-tabs', ...args);
}


// this should return true if the tab is moved while processing
Tabs.onCreating.addListener((tab, info = {}) => {
  if (info.duplicatedInternally)
    return true;

  log('Tabs.onCreating ', dumpTab(tab), info);

  const possibleOpenerTab = info.activeTab || Tabs.getCurrentTab(tab);
  const opener = Tabs.getOpenerTab(tab);
  if (opener)
    opener.uniqueId.then(uniqueId => {
      tab.dataset.originalOpenerTabId = uniqueId.id;
    });

  if (!opener) {
    if (!info.maybeOrphan &&
        possibleOpenerTab &&
        /* New tab opened with browser.tabs.insertAfterCurrent=true may have
           next tab. In this case the tab is expected to be placed next to the
           active tab aways, so we should skip all repositioning behavior.
           See also: https://github.com/piroor/treestyletab/issues/2054 */
        !Tabs.getNextTab(tab)) {
      if (Tabs.isNewTabCommandTab(tab)) {
        if (!info.maybeOpenedWithPosition) {
          log('behave as a tab opened by new tab command');
          handleNewTabFromActiveTab(tab, {
            activeTab:                 possibleOpenerTab,
            autoAttachBehavior:        configs.autoAttachOnNewTabCommand,
            inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
          });
        }
        return false;
      }
      else if (possibleOpenerTab != tab) {
        tab.dataset.possibleOpenerTab = possibleOpenerTab.id;
      }
      tab.dataset.isNewTab = true;
    }
    log('behave as a tab opened with any URL');
    return true;
  }

  log(`opener: ${dumpTab(opener)}, info.maybeOpenedWithPosition = ${info.maybeOpenedWithPosition}`);
  if (Tabs.isPinned(opener) &&
      opener.parentNode == tab.parentNode) {
    if (configs.autoGroupNewTabsFromPinned) {
      return false;
    }
    if (configs.insertNewTabFromPinnedTabAt == Constants.kINSERT_END) {
      TabsMove.moveTabAfter(tab, Tabs.getLastTab(tab), {
        delayedMove: true,
        broadcast:   true
      });
    }
  }
  else if (!info.maybeOrphan && configs.autoAttach) {
    Tree.behaveAutoAttachedTab(tab, {
      baseTab:   opener,
      behavior:  configs.autoAttachOnOpenedWithOwner,
      dontMove:  info.maybeOpenedWithPosition,
      broadcast: true
    });
    return false;
  }
  return true;
});

async function handleNewTabFromActiveTab(tab, params = {}) {
  const activeTab = params.activeTab;
  log('handleNewTabFromActiveTab: activeTab = ', dumpTab(activeTab), params);
  await Tree.behaveAutoAttachedTab(tab, {
    baseTab:   activeTab,
    behavior:  params.autoAttachBehavior,
    broadcast: true
  });
  const parent = Tabs.getParentTab(tab);
  if (!parent ||
      !params.inheritContextualIdentity ||
      tab.apiTab.cookieStoreId != 'firefox-default' ||
      tab.apiTab.cookieStoreId == parent.apiTab.cookieStoreId)
    return;
  const cookieStoreId = activeTab.apiTab.cookieStoreId;
  log('handleNewTabFromActiveTab: reopen with inherited contextual identity ', cookieStoreId);
  await TabsOpen.openNewTab({
    parent,
    insertBefore: tab,
    cookieStoreId
  });
  TabsInternalOperation.removeTab(tab);
}

Tabs.onCreated.addListener((tab, info = {}) => {
  if (!info.duplicated)
    return;
  const original = info.originalTab;
  log('duplicated ', dumpTab(tab), dumpTab(original));
  if (info.duplicatedInternally) {
    log('duplicated by internal operation');
    tab.classList.add(Constants.kTAB_STATE_DUPLICATING);
    Tabs.broadcastTabState(tab, {
      add: [Constants.kTAB_STATE_DUPLICATING]
    });
  }
  else {
    Tree.behaveAutoAttachedTab(tab, {
      baseTab:   original,
      behavior:  configs.autoAttachOnDuplicated,
      dontMove:  info.openedWithPosition,
      broadcast: true
    });
  }
});

Tabs.onUpdated.addListener((tab, changeInfo) => {
  if (configs.syncParentTabAndOpenerTab) {
    Tabs.waitUntilAllTabsAreCreated().then(() => {
      const parent = Tabs.getOpenerTab(tab);
      if (!parent ||
          parent.parentNode != tab.parentNode ||
          parent == Tabs.getParentTab(tab))
        return;
      Tree.attachTabTo(tab, parent, {
        insertAt:    Constants.kINSERT_NEAREST,
        forceExpand: Tabs.isActive(tab),
        broadcast:   true
      });
    });
  }

  if (tab.dataset.isNewTab &&
      (changeInfo.url || changeInfo.status == 'complete')) {
    log('new tab ', dumpTab(tab));
    delete tab.dataset.isNewTab;
    const possibleOpenerTab = Tabs.getTabById(tab.dataset.possibleOpenerTab);
    delete tab.dataset.possibleOpenerTab;
    log('possibleOpenerTab ', dumpTab(possibleOpenerTab));
    const toBeGroupedTabs = (tab.parentNode.dataset.openedNewTabs || '')
      .split('|')
      .map(id => Tabs.getTabById(parseInt(id)))
      .filter(tab => !!tab);
    log('toBeGroupedTabs ', toBeGroupedTabs.map(dumpTab));
    if (!Tabs.getParentTab(tab) &&
        possibleOpenerTab &&
        !toBeGroupedTabs.includes(tab)) {
      if (Tabs.isNewTabCommandTab(tab)) {
        log('behave as a tab opened by new tab command (delayed)');
        handleNewTabFromActiveTab(tab, {
          activeTab:                 possibleOpenerTab,
          autoAttachBehavior:        configs.autoAttachOnNewTabCommand,
          inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
        });
      }
      else {
        const siteMatcher  = /^\w+:\/\/([^\/]+)(?:$|\/.*$)/;
        const openerTabSite = possibleOpenerTab.apiTab.url.match(siteMatcher);
        const newTabSite    = tab.apiTab.url.match(siteMatcher);
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


Tabs.onAttached.addListener(async (tab, info = {}) => {
  if (!info.windowId ||
      !Tree.shouldApplyTreeBehavior(info))
    return;

  log('Tabs.onAttached ', dumpTab(tab), info);

  log('descendants of attached tab: ', info.descendants.map(dumpTab));
  const movedTabs = await Tree.moveTabs(info.descendants, {
    destinationWindowId: tab.apiTab.windowId,
    insertAfter:         tab
  });
  log('moved descendants: ', movedTabs.map(dumpTab));
  for (const movedTab of movedTabs) {
    if (Tabs.getParentTab(movedTab))
      continue;
    Tree.attachTabTo(movedTab, tab, {
      broadcast: true,
      dontMove:  true
    });
  }
});
