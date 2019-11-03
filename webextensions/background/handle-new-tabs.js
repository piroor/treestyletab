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
import * as TreeBehavior from '/common/tree-behavior.js';

import Tab from '/common/Tab.js';

import * as TabsOpen from './tabs-open.js';
import * as TabsMove from './tabs-move.js';
import * as Tree from './tree.js';

function log(...args) {
  internalLogger('background/handle-new-tabs', ...args);
}


// this should return false if the tab is / may be moved while processing
Tab.onCreating.addListener((tab, info = {}) => {
  if (info.duplicatedInternally)
    return true;

  log('Tabs.onCreating ', dumpTab(tab), info);

  const possibleOpenerTab = info.activeTab || Tab.getActiveTab(tab.windowId);
  const opener = tab.$TST.openerTab;
  if (opener) {
    tab.$TST.setAttribute(Constants.kPERSISTENT_ORIGINAL_OPENER_TAB_ID, opener.$TST.uniqueId.id);
    TabsStore.addToBeGroupedTab(tab);
  }
  else {
    let dontMove = false;
    if (!info.maybeOrphan &&
        possibleOpenerTab &&
        !info.restored) {
      let autoAttachBehavior = configs.autoAttachOnNewTabCommand;
      if (tab.$TST.nextTab &&
          possibleOpenerTab == tab.$TST.previousTab) {
        // New tab opened with browser.tabs.insertAfterCurrent=true may have
        // next tab. In this case the tab is expected to be placed next to the
        // active tab always, so we should change the behavior specially.
        // See also:
        //   https://github.com/piroor/treestyletab/issues/2054
        //   https://github.com/piroor/treestyletab/issues/2194#issuecomment-505272940
        dontMove = true;
        switch (autoAttachBehavior) {
          case Constants.kNEWTAB_OPEN_AS_ORPHAN:
          case Constants.kNEWTAB_OPEN_AS_SIBLING:
          case Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING:
            if (possibleOpenerTab.$TST.hasChild)
              autoAttachBehavior = Constants.kNEWTAB_OPEN_AS_CHILD;
            else
              autoAttachBehavior = Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING;
            break;

          case Constants.kNEWTAB_OPEN_AS_CHILD:
          default:
            break;
        }
      }
      if (tab.$TST.isNewTabCommandTab) {
        if (!info.positionedBySelf) {
          log('behave as a tab opened by new tab command');
          return handleNewTabFromActiveTab(tab, {
            activeTab:                 possibleOpenerTab,
            autoAttachBehavior,
            dontMove,
            inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
          }).then(moved => !moved);
        }
        return false;
      }
      else if (possibleOpenerTab != tab) {
        tab.$TST.possibleOpenerTab = possibleOpenerTab.id;
      }
      tab.$TST.isNewTab = !info.fromExternal;
    }
    if (info.fromExternal) {
      log('behave as a tab opened from external application');
      return Tree.behaveAutoAttachedTab(tab, {
        baseTab:   possibleOpenerTab,
        behavior:  configs.autoAttachOnOpenedFromExternal,
        dontMove,
        inheritContextualIdentity: configs.inheritContextualIdentityToTabsFromExternal,
        broadcast: true
      }).then(moved => !moved);
    }
    log('behave as a tab opened with any URL');
    tab.$TST.positionedBySelf = info.positionedBySelf;
    return true;
  }

  log(`opener: ${dumpTab(opener)}, positionedBySelf = ${info.positionedBySelf}`);
  if (opener && opener.pinned &&
      opener.windowId == tab.windowId) {
    if (configs.autoGroupNewTabsFromPinned) {
      if (Tab.getGroupTabForOpener(opener) ||
          tab.$TST.needToBeGroupedSiblings.length > 0)
        return false;
      return true;
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
      behavior:  info.fromExternal ? configs.autoAttachOnOpenedFromExternal : configs.autoAttachOnOpenedWithOwner,
      dontMove:  info.positionedBySelf || info.mayBeReplacedWithContainer,
      inheritContextualIdentity: info.fromExternal ? configs.inheritContextualIdentityToTabsFromExternal : false,
      broadcast: true
    }).then(moved => !moved);
  }
  return true;
});

async function handleNewTabFromActiveTab(tab, params = {}) {
  const activeTab = params.activeTab;
  log('handleNewTabFromActiveTab: activeTab = ', dumpTab(activeTab), params);
  if (activeTab &&
      activeTab.$TST.ancestors.includes(tab)) {
    log(' => ignore restored ancestor tab');
    return;
  }
  const moved = await Tree.behaveAutoAttachedTab(tab, {
    baseTab:   activeTab,
    behavior:  params.autoAttachBehavior,
    broadcast: true,
    dontMove:  params.dontMove || false
  });
  const parent = tab.$TST.parent;
  if (!parent ||
      !params.inheritContextualIdentity ||
      tab.cookieStoreId != 'firefox-default' ||
      tab.cookieStoreId == parent.cookieStoreId)
    return moved;
  const cookieStoreId = activeTab.cookieStoreId;
  log('handleNewTabFromActiveTab: reopen with inherited contextual identity ', cookieStoreId);
  // We need to prevent grouping of this original tab and the reopened tab
  // by the "multiple tab opened in XXX msec" feature.
  const window = TabsStore.windows.get(tab.windowId);
  window.openedNewTabs.delete(tab.id);
  await TabsOpen.openURIInTab(params.url || null, {
    windowId: activeTab.windowId,
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
    TabsStore.addDuplicatingTab(tab);
  }
  else {
    Tree.behaveAutoAttachedTab(tab, {
      baseTab:   original,
      behavior:  configs.autoAttachOnDuplicated,
      dontMove:  info.positionedBySelf || info.movedBySelfWhileCreation || info.mayBeReplacedWithContainer,
      broadcast: true
    });
  }
});

Tab.onUpdated.addListener((tab, changeInfo) => {
  if ('openerTabId' in changeInfo &&
      configs.syncParentTabAndOpenerTab &&
      !tab.$TST.updatingOpenerTabIds.includes(changeInfo.openerTabId) /* accept only changes from outside of TST */) {
    Tab.waitUntilTrackedAll(tab.windowId).then(() => {
      const parent = tab.$TST.openerTab;
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
    log('window.openedNewTabs ', window.openedNewTabs);
    if (tab.$TST.parent ||
        !possibleOpenerTab ||
        window.openedNewTabs.has(tab.id) ||
        tab.$TST.openedWithOthers ||
        tab.$TST.positionedBySelf) {
      log(' => no need to control');
      return;
    }

    if (tab.$TST.isNewTabCommandTab) {
      log('behave as a tab opened by new tab command (delayed)');
      handleNewTabFromActiveTab(tab, {
        activeTab:                 possibleOpenerTab,
        autoAttachBehavior:        configs.autoAttachOnNewTabCommand,
        inheritContextualIdentity: configs.inheritContextualIdentityToNewChildTab
      });
      return;
    }

    const siteMatcher  = /^\w+:\/\/([^\/]+)(?:$|\/.*$)/;
    const openerTabSite = possibleOpenerTab.url.match(siteMatcher);
    const newTabSite    = tab.url.match(siteMatcher);
    if (openerTabSite && newTabSite && openerTabSite[1] == newTabSite[1]) {
      log('behave as a tab opened from same site (delayed)');
      handleNewTabFromActiveTab(tab, {
        url:                       tab.url,
        activeTab:                 possibleOpenerTab,
        autoAttachBehavior:        configs.autoAttachSameSiteOrphan,
        inheritContextualIdentity: configs.inheritContextualIdentityToSameSiteOrphan
      });
      return;
    }

    log('checking special openers (delayed)', { opener: possibleOpenerTab.url, child: tab.url });
    for (const rule of Constants.kAGGRESSIVE_OPENER_TAB_DETECTION_RULES_WITH_URL) {
      if (rule.opener.test(possibleOpenerTab.url) &&
          rule.child.test(tab.url)) {
        log('behave as a tab opened from special opener (delayed)', { rule });
        handleNewTabFromActiveTab(tab, {
          url:                tab.url,
          activeTab:          possibleOpenerTab,
          autoAttachBehavior: Constants.kNEWTAB_OPEN_AS_CHILD
        });
        return;
      }
    }
  }
});


Tab.onAttached.addListener(async (tab, info = {}) => {
  if (!info.windowId ||
      !TreeBehavior.shouldApplyTreeBehavior(info))
    return;

  log('Tabs.onAttached ', dumpTab(tab), info);

  log('descendants of attached tab: ', () => info.descendants.map(dumpTab));
  const movedTabs = await Tree.moveTabs(info.descendants, {
    destinationWindowId: tab.windowId,
    insertAfter:         tab
  });
  log('moved descendants: ', () => movedTabs.map(dumpTab));
  for (const movedTab of movedTabs) {
    Tree.attachTabTo(movedTab, tab, {
      broadcast: true,
      dontMove:  true
    });
  }
});
