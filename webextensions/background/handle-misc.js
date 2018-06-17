/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  wait,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as ApiTabs from '../common/api-tabs.js';
import * as Tabs from '../common/tabs.js';
import * as TabsInternalOperation from '../common/tabs-internal-operation.js';
import * as TabsMove from '../common/tabs-move.js';
import * as TabsOpen from '../common/tabs-open.js';
import * as TabsGroup from '../common/tabs-group.js';
import * as Tree from '../common/tree.js';
import * as TSTAPI from '../common/tst-api.js';
import * as SidebarStatus from '../common/sidebar-status.js';
import * as Commands from '../common/commands.js';
import * as Permissions from '../common/permissions.js';

import * as Background from './background.js';
import * as BackgroundCache from './background-cache.js';
import * as TreeStructure from './tree-structure.js';

function log(...aArgs) {
  if (configs.logFor['background/handle-misc'])
    internalLogger(...aArgs);
}
function logMouseEvent(...aArgs) {
  if (configs.logOnMouseEvent)
    internalLogger(...aArgs);
}


let gInitialized = false;


Tabs.onPinned.addListener(aTab => {
  Tree.collapseExpandSubtree(aTab, {
    collapsed: false,
    broadcast: true
  });
  Tree.detachAllChildren(aTab, {
    behavior: Tree.getCloseParentBehaviorForTabWithSidebarOpenState(aTab, {
      keepChildren: true
    }),
    broadcast: true
  });
  Tree.detachTab(aTab, {
    broadcast: true
  });
  Tree.collapseExpandTabAndSubtree(aTab, { collapsed: false });
});


/* message observer */

Background.onInit.addListener(() => {
  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
  browser.commands.onCommand.addListener(onShortcutCommand);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
});

Background.onBuilt.addListener(() => {
  browser.runtime.onMessage.addListener(onMessage);
});

Background.onReady.addListener(() => {
  gInitialized = true;
});

Background.onDestroy.addListener(() => {
  browser.runtime.onMessage.removeListener(onMessage);
  browser.runtime.onMessageExternal.removeListener(onMessageExternal);
  browser.browserAction.onClicked.removeListener(onToolbarButtonClick);
});


function onToolbarButtonClick(aTab) {
  if (Permissions.requestPostProcess())
    return;

  if (SidebarStatus.isOpen(aTab.windowId))
    browser.sidebarAction.close();
  else
    browser.sidebarAction.open();
}

async function onShortcutCommand(aCommand) {
  const activeTab = Tabs.getTabById((await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0]);

  switch (aCommand) {
    case '_execute_browser_action':
      return;

    case 'reloadTree':
      Commands.reloadTree(activeTab);
      return;
    case 'reloadDescendants':
      Commands.reloadDescendants(activeTab);
      return;
    case 'closeTree':
      Commands.closeTree(activeTab);
      return;
    case 'closeDescendants':
      Commands.closeDescendants(activeTab);
      return;
    case 'closeOthers':
      Commands.closeOthers(activeTab);
      return;
    case 'collapseAll':
      Commands.collapseAll(activeTab);
      return;
    case 'expandAll':
      Commands.expandAll(activeTab);
      return;
    case 'bookmarkTree':
      Commands.bookmarkTree(activeTab);
      return;

    case 'newIndependentTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_ORPHAN
      });
      return;
    case 'newChildTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_CHILD
      });
      return;
    case 'newSiblingTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_SIBLING
      });
      return;
    case 'newNextSiblingTab':
      Commands.openNewTabAs({
        baseTab: activeTab,
        as:      Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING
      });
      return;

    case 'newContainerTab':
      return browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SHOW_CONTAINER_SELECTOR,
        windowId: activeTab.apiTab.windowId
      });

    case 'indent':
      Commands.indent(activeTab, { followChildren: true });
      return;
    case 'outdent':
      Commands.outdent(activeTab, { followChildren: true });
      return;

    case 'tabMoveUp':
      Commands.moveUp(activeTab, { followChildren: false });
      return;
    case 'treeMoveUp':
      Commands.moveUp(activeTab, { followChildren: true });
      return;
    case 'tabMoveDown':
      Commands.moveDown(activeTab, { followChildren: false });
      return;
    case 'treeMoveDown':
      Commands.moveDown(activeTab, { followChildren: true });
      return;

    case 'focusPrevious':
      TabsInternalOperation.selectTab(Tabs.getPreviousSiblingTab(activeTab), { silently: false });
      return;
    case 'focusPreviousSilently':
      TabsInternalOperation.selectTab(Tabs.getPreviousSiblingTab(activeTab), { silently: true });
      return;
    case 'focusNext':
      TabsInternalOperation.selectTab(Tabs.getNextSiblingTab(activeTab), { silently: false });
      return;
    case 'focusNextSilently':
      TabsInternalOperation.selectTab(Tabs.getNextSiblingTab(activeTab), { silently: true });
      return;

    case 'tabbarUp':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'lineup'
      });
      return;
    case 'tabbarPageUp':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'pageup'
      });
      return;
    case 'tabbarHome':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        to:       'top'
      });
      return;

    case 'tabbarDown':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'linedown'
      });
      return;
    case 'tabbarPageDown':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        by:       'pagedown'
      });
      return;
    case 'tabbarEnd':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.apiTab.windowId,
        to:       'bottom'
      });
      return;
  }
}

function onMessage(aMessage, aSender) {
  if (!aMessage ||
      typeof aMessage.type != 'string' ||
      aMessage.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case Constants.kCOMMAND_PING_TO_BACKGROUND:
      return Promise.resolve(true);

    case Constants.kCOMMAND_REQUEST_UNIQUE_ID:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.id);
        const tab = Tabs.getTabById(aMessage.id);
        if (tab && !aMessage.forceNew)
          return tab.uniqueId;
        return Tabs.requestUniqueId(aMessage.id, {
          forceNew: aMessage.forceNew
        });
      })();

    case Constants.kCOMMAND_PULL_TREE_STRUCTURE:
      return (async () => {
        while (!gInitialized) {
          await wait(10);
        }
        const structure = Tree.getTreeStructureFromTabs(Tabs.getAllTabs(aMessage.windowId));
        return { structure };
      })();

    case Constants.kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        const params = {
          collapsed: aMessage.collapsed,
          justNow:   aMessage.justNow,
          broadcast: true,
          stack:     aMessage.stack
        };
        if (aMessage.manualOperation)
          Tree.manualCollapseExpandSubtree(tab, params);
        else
          Tree.collapseExpandSubtree(tab, params);
        if (gInitialized)
          TreeStructure.reserveToSaveTreeStructure(tab);
        BackgroundCache.markWindowCacheDirtyFromTab(tab, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
      })();

    case Constants.kCOMMAND_LOAD_URI:
      return TabsOpen.loadURI(aMessage.uri, Object.assign({}, aMessage.options, {
        tab:      Tabs.getTabById(aMessage.options.tab),
        inRemote: false
      }));

    case Constants.kCOMMAND_NEW_TABS:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        log('new tabs requested: ', aMessage);
        return await TabsOpen.openURIsInTabs(aMessage.uris, Object.assign({}, aMessage, {
          parent:       Tabs.getTabById(aMessage.parent),
          insertBefore: Tabs.getTabById(aMessage.insertBefore),
          insertAfter:  Tabs.getTabById(aMessage.insertAfter)
        }));
      })();

    case Constants.kCOMMAND_NEW_WINDOW_FROM_TABS:
      return (async () => {
        log('new window requested: ', aMessage);
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs);
        const movedTabs = await Tree.openNewWindowFromTabs(
          aMessage.tabs.map(Tabs.getTabById),
          aMessage
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case Constants.kCOMMAND_MOVE_TABS:
      return (async () => {
        log('move tabs requested: ', aMessage);
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.insertBefore, aMessage.insertAfter]));
        const movedTabs = await Tree.moveTabs(
          aMessage.tabs.map(Tabs.getTabById),
          Object.assign({}, aMessage, {
            insertBefore: Tabs.getTabById(aMessage.insertBefore),
            insertAfter:  Tabs.getTabById(aMessage.insertAfter)
          })
        );
        return { movedTabs: movedTabs.map(aTab => aTab.id) };
      })();

    case Constants.kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs);
        return TabsInternalOperation.removeTabs(aMessage.tabs.map(Tabs.getTabById), aMessage.options);
      })();

    case Constants.kNOTIFY_TAB_MOUSEDOWN:
      return (async () => {
        logMouseEvent('Constants.kNOTIFY_TAB_MOUSEDOWN');
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;

        logMouseEvent('Sending message to listeners');
        const serializedTab = TSTAPI.serializeTab(tab);
        const mousedownNotified = TSTAPI.sendMessage(Object.assign({}, aMessage, {
          type:   TSTAPI.kNOTIFY_TAB_MOUSEDOWN,
          tab:    serializedTab,
          window: tab.apiTab.windowId
        }));

        // We must send tab-mouseup after tab-mousedown is notified.
        // So, we return to the caller process and do this post process asynchronously.
        mousedownNotified.then(async (aResults) => {
          const results = aResults.concat(
            await TSTAPI.sendMessage(Object.assign({}, aMessage, {
              type:   TSTAPI.kNOTIFY_TAB_CLICKED,
              tab:    serializedTab,
              window: tab.apiTab.windowId
            }))
          );
          if (results.some(aResult => aResult.result)) // canceled
            return;

          logMouseEvent('Ready to select the tab');

          // not canceled, then fallback to default "select tab"
          if (aMessage.button == 0)
            TabsInternalOperation.selectTab(tab);
        });

        return true;
      })();

    case Constants.kCOMMAND_SELECT_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        browser.tabs.update(tab.apiTab.id, { active: true })
          .catch(ApiTabs.handleMissingTabError);
      })();

    case Constants.kCOMMAND_SELECT_TAB_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        TabsInternalOperation.selectTab(tab, Object.assign({}, aMessage.options, {
          inRemote: false
        }));
      })();

    case Constants.kCOMMAND_SET_SUBTREE_MUTED:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        log('set muted state: ', aMessage);
        const root = Tabs.getTabById(aMessage.tab);
        if (!root)
          return;
        const tabs = [root].concat(Tabs.getDescendantTabs(root));
        for (const tab of tabs) {
          const playing = Tabs.isSoundPlaying(tab);
          const muted   = Tabs.isMuted(tab);
          log(`tab ${tab.id}: playing=${playing}, muted=${muted}`);
          if (playing != aMessage.muted)
            continue;

          log(` => set muted=${aMessage.muted}`);

          browser.tabs.update(tab.apiTab.id, {
            muted: aMessage.muted
          }).catch(ApiTabs.handleMissingTabError);

          const add = [];
          const remove = [];
          if (aMessage.muted) {
            add.push(Constants.kTAB_STATE_MUTED);
            tab.classList.add(Constants.kTAB_STATE_MUTED);
          }
          else {
            remove.push(Constants.kTAB_STATE_MUTED);
            tab.classList.remove(Constants.kTAB_STATE_MUTED);
          }

          if (Tabs.isAudible(tab) && !aMessage.muted) {
            add.push(Constants.kTAB_STATE_SOUND_PLAYING);
            tab.classList.add(Constants.kTAB_STATE_SOUND_PLAYING);
          }
          else {
            remove.push(Constants.kTAB_STATE_SOUND_PLAYING);
            tab.classList.remove(Constants.kTAB_STATE_SOUND_PLAYING);
          }

          // tabs.onUpdated is too slow, so users will be confused
          // from still-not-updated tabs (in other words, they tabs
          // are unresponsive for quick-clicks).
          Tabs.broadcastTabState(tab, {
            add, remove,
            bubbles: !Tabs.hasChildTabs(tab)
          });
        }
      })();

    case Constants.kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.nextTab]));
        return TabsMove.moveTabsBefore(
          aMessage.tabs.map(Tabs.getTabById),
          Tabs.getTabById(aMessage.nextTab),
          Object.assign({}, aMessage, {
            broadcast: !!aMessage.broadcasted
          })
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case Constants.kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.previousTab]));
        return TabsMove.moveTabsAfter(
          aMessage.tabs.map(Tabs.getTabById),
          Tabs.getTabById(aMessage.previousTab),
          Object.assign({}, aMessage, {
            broadcast: !!aMessage.broadcasted
          })
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case Constants.kCOMMAND_ATTACH_TAB_TO:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.child,
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        const child  = Tabs.getTabById(aMessage.child);
        const parent = Tabs.getTabById(aMessage.parent);
        if (child && parent)
          await Tree.attachTabTo(child, parent, Object.assign({}, aMessage, {
            insertBefore: Tabs.getTabById(aMessage.insertBefore),
            insertAfter:  Tabs.getTabById(aMessage.insertAfter)
          }));
      })();

    case Constants.kCOMMAND_DETACH_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (tab)
          await Tree.detachTab(tab);
      })();

    case Constants.kCOMMAND_PERFORM_TABS_DRAG_DROP:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.attachTo,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        log('perform tabs dragdrop requested: ', aMessage);
        return Tree.performTabsDragDrop(Object.assign({}, aMessage, {
          attachTo:     Tabs.getTabById(aMessage.attachTo),
          insertBefore: Tabs.getTabById(aMessage.insertBefore),
          insertAfter:  Tabs.getTabById(aMessage.insertAfter)
        }));
      })();

    case Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED:
      return (async () => {
        if (JSON.stringify(aMessage.permissions) == JSON.stringify(Permissions.ALL_URLS)) {
          const apiTabs = await browser.tabs.query({});
          await Tabs.waitUntilTabsAreCreated(apiTabs.map(aAPITab => aAPITab.id));
          for (const apiTab of apiTabs) {
            Background.tryStartHandleAccelKeyOnTab(Tabs.getTabById(apiTab));
          }
        }
      })();

    default:
      const API_PREFIX_MATCHER = /^treestyletab:api:/;
      if (API_PREFIX_MATCHER.test(aMessage.type)) {
        aMessage.type = aMessage.type.replace(API_PREFIX_MATCHER, '');
        return onMessageExternal(aMessage, aSender);
      }
      break;
  }
}

function onMessageExternal(aMessage, aSender) {
  //log('onMessageExternal: ', aMessage, aSender);
  switch (aMessage.type) {
    case TSTAPI.kGET_TREE:
      return (async () => {
        const tabs    = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = tabs.map(TSTAPI.serializeTab);
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kCOLLAPSE_TREE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        for (const tab of tabs) {
          Tree.collapseExpandSubtree(tab, {
            collapsed: true,
            broadcast: true
          });
        }
        return true;
      })();

    case TSTAPI.kEXPAND_TREE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        for (const tab of tabs) {
          Tree.collapseExpandSubtree(tab, {
            collapsed: false,
            broadcast: true
          });
        }
        return true;
      })();

    case TSTAPI.kATTACH:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.child,
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        const child  = Tabs.getTabById(aMessage.child);
        const parent = Tabs.getTabById(aMessage.parent);
        if (!child ||
            !parent ||
            child.parentNode != parent.parentNode)
          return false;
        await Tree.attachTabTo(child, parent, {
          broadcast:    true,
          insertBefore: Tabs.getTabById(aMessage.insertBefore),
          insertAfter:  Tabs.getTabById(aMessage.insertAfter)
        });
        return true;
      })();

    case TSTAPI.kDETACH:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return false;
        await Tree.detachTab(tab, {
          broadcast: true
        });
        return true;
      })();

    case TSTAPI.kINDENT:
    case TSTAPI.kDEMOTE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.indent(aTab, aMessage)));
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kOUTDENT:
    case TSTAPI.kPROMOTE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.outdent(aTab, aMessage)));
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kMOVE_UP:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.moveUp(aTab, aMessage)));
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kMOVE_DOWN:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        const results = await Promise.all(tabs.map(aTab => Commands.moveDown(aTab, aMessage)));
        return TSTAPI.formatResult(results, aMessage);
      })();

    case TSTAPI.kFOCUS:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        for (const tab of tabs) {
          TabsInternalOperation.selectTab(tab, {
            silently: aMessage.silently
          });
        }
        return TSTAPI.formatResult(tabs.map(() => true), aMessage);
      })();

    case TSTAPI.kDUPLICATE:
      return (async () => {
        const tabs   = await TSTAPI.getTargetTabs(aMessage, aSender);
        let behavior = Constants.kNEWTAB_OPEN_AS_ORPHAN;
        switch (String(aMessage.as || 'sibling').toLowerCase()) {
          case 'child':
            behavior = Constants.kNEWTAB_OPEN_AS_CHILD;
            break;
          case 'sibling':
            behavior = Constants.kNEWTAB_OPEN_AS_SIBLING;
            break;
          case 'nextsibling':
            behavior = Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING;
            break;
          default:
            break;
        }
        for (const tab of tabs) {
          const duplicatedTabs = await Tree.moveTabs([tab], {
            duplicate:           true,
            destinationWindowId: tab.apiTab.windowId,
            insertAfter:         tab
          });
          await Tree.behaveAutoAttachedTab(duplicatedTabs[0], {
            broadcast: true,
            baseTab:   tab,
            behavior
          });
        }
        return TSTAPI.formatResult(tabs.map(() => true), aMessage);
      })();

    case TSTAPI.kGROUP_TABS:
      return (async () => {
        const tabs     = await TSTAPI.getTargetTabs(aMessage, aSender);
        const groupTab = await TabsGroup.groupTabs(tabs, { broadcast: true });
        return groupTab.apiTab;
      })();

    case TSTAPI.kGET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        return Promise.resolve(Tree.getTreeStructureFromTabs(tabs));
      })();

    case TSTAPI.kSET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        await Tree.applyTreeStructureToTabs(tabs, aMessage.structure, {
          broadcast: true
        });
        return Promise.resolve(true);
      })();

    case TSTAPI.kADD_TAB_STATE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        let states = aMessage.state || aMessage.states;
        if (!Array.isArray(states))
          states = [states];
        for (const tab of tabs) {
          for (const state of states) {
            tab.classList.add(state);
          }
        }
        Tabs.broadcastTabState(tabs, {
          add: states
        });
        return true;
      })();

    case TSTAPI.kREMOVE_TAB_STATE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(aMessage, aSender);
        let states = aMessage.state || aMessage.states;
        if (!Array.isArray(states))
          states = [states];
        for (const tab of tabs) {
          for (const state of states) {
            tab.classList.remove(state);
          }
        }
        Tabs.broadcastTabState(tabs, {
          remove: states
        });
        return true;
      })();
  }
}
