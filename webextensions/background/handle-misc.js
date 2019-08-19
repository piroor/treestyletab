/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  filterMap,
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TSTAPI from '/common/tst-api.js';
import * as SidebarConnection from '/common/sidebar-connection.js';
import * as Permissions from '/common/permissions.js';
import * as TreeBehavior from '/common/tree-behavior.js';

import Tab from '/common/Tab.js';

import * as Background from './background.js';
import * as TabsGroup from './tabs-group.js';
import * as Tree from './tree.js';
import * as Commands from './commands.js';

function log(...args) {
  internalLogger('background/handle-misc', ...args);
}

let mInitialized = false;


/* message observer */

// We cannot start listening of messages of browser.runtime.onMessage(External)
// at here and wait processing until promises are resolved like ApiTabsListener
// and BackgroundConnection, because making listeners asynchornous (async
// functions) will break things - those listeners must not return Promise for
// unneeded cases.
// See also: https://github.com/piroor/treestyletab/issues/2200

Background.onInit.addListener(() => {
  browser.browserAction.onClicked.addListener(onToolbarButtonClick);
  browser.commands.onCommand.addListener(onShortcutCommand);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
});

Background.onBuilt.addListener(() => {
  log('Start listening of messages');
  browser.runtime.onMessage.addListener(onMessage);
});

Background.onReady.addListener(() => {
  mInitialized = true;
});

Background.onDestroy.addListener(() => {
  browser.runtime.onMessage.removeListener(onMessage);
  browser.runtime.onMessageExternal.removeListener(onMessageExternal);
  browser.browserAction.onClicked.removeListener(onToolbarButtonClick);
});


function onToolbarButtonClick(tab) {
  if (Permissions.requestPostProcess())
    return;

  if (SidebarConnection.isOpen(tab.windowId))
    browser.sidebarAction.close();
  else
    browser.sidebarAction.open();
}

async function onShortcutCommand(command) {
  const activeTab = Tab.get((await browser.tabs.query({
    active:        true,
    currentWindow: true
  }).catch(ApiTabs.createErrorHandler()))[0].id);
  const selectedTabs = activeTab.$TST.multiselected ? Tab.getSelectedTabs(activeTab.windowId) : [];
  log('onShortcutCommand ', { command, activeTab, selectedTabs });

  switch (command) {
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
    case 'collapseTree':
      Commands.collapseTree(activeTab);
      return;
    case 'collapseAll':
      Commands.collapseAll(activeTab.windowId);
      return;
    case 'expandTree':
      Commands.expandTree(activeTab);
      return;
    case 'expandAll':
      Commands.expandAll(activeTab.windowId);
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
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_SHOW_CONTAINER_SELECTOR,
        windowId: activeTab.windowId
      });
      return;

    case 'groupSelectedTabs':
      if (selectedTabs.length > 1)
        TabsGroup.groupTabs(selectedTabs, { broadcast: true });
      return;

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
    case 'focusPreviousSilently': {
      const nextActive = activeTab.$TST.nearestVisiblePrecedingTab ||
        Tab.getLastVisibleTab(activeTab.windowId);
      TabsInternalOperation.activateTab(nextActive, { silently: /Silently/.test(command) });
    }; return;
    case 'focusNext':
    case 'focusNextSilently': {
      const nextActive = activeTab.$TST.nearestVisibleFollowingTab ||
        Tab.getFirstVisibleTab(activeTab.windowId);
      TabsInternalOperation.activateTab(nextActive, { silently: /Silently/.test(command) });
    }; return;
    case 'focusParent':
      TabsInternalOperation.activateTab(activeTab.$TST.parent);
      return;
    case 'focusFirstChild':
      TabsInternalOperation.activateTab(activeTab.$TST.firstChild);
      return;
    case 'focusLastChild':
      TabsInternalOperation.activateTab(activeTab.$TST.lastChild);
      return;
    case 'focusPreviousSibling':
      TabsInternalOperation.activateTab(activeTab.$TST.previousSiblingTab);
      return;
    case 'focusNextSibling':
      TabsInternalOperation.activateTab(activeTab.$TST.nextSiblingTab);
      return;

    case 'tabbarUp':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        by:       'lineup'
      });
      return;
    case 'tabbarPageUp':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        by:       'pageup'
      });
      return;
    case 'tabbarHome':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        to:       'top'
      });
      return;

    case 'tabbarDown':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        by:       'linedown'
      });
      return;
    case 'tabbarPageDown':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        by:       'pagedown'
      });
      return;
    case 'tabbarEnd':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        to:       'bottom'
      });
      return;

    case 'toggleSubPanel':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_TOGGLE_SUBPANEL,
        windowId: activeTab.windowId
      });
      return;
    case 'switchSubPanel':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_SWITCH_SUBPANEL,
        windowId: activeTab.windowId
      });
      return;
    case 'increaseSubPanel':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_INCREASE_SUBPANEL,
        windowId: activeTab.windowId
      });
      return;
    case 'decreaseSubPanel':
      SidebarConnection.sendMessage({
        type:     Constants.kCOMMAND_DECREASE_SUBPANEL,
        windowId: activeTab.windowId
      });
      return;
  }
}

// This must be synchronous and return Promise on demando, to avoid
// blocking to other listeners.
function onMessage(message, sender) {
  if (!message ||
      typeof message.type != 'string' ||
      message.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', message, sender);
  switch (message.type) {
    case Constants.kCOMMAND_GET_INSTANCE_ID:
      return Promise.resolve(Background.instanceId);

    case Constants.kCOMMAND_RELOAD:
      return Background.reload({ all: message.all });

    case Constants.kCOMMAND_REQUEST_UNIQUE_ID:
      return (async () => {
        if (!Tab.get(message.tabId))
          await Tab.waitUntilTracked(message.tabId);
        return Tab.get(message.tabId).$TST.promisedUniqueId;
      })();

    case Constants.kCOMMAND_GET_CONFIG_VALUE:
      if (Array.isArray(message.keys)) {
        const values = {};
        for (const key of message.keys) {
          values[key] = configs[key];
        }
        return Promise.resolve(values);
      }
      return Promise.resolve(configs[message.key]);

    case Constants.kCOMMAND_SET_CONFIG_VALUE:
      return Promise.resolve(configs[message.key] = message.value);

    case Constants.kCOMMAND_PING_TO_BACKGROUND: // return tabs as the pong, to optimizie further initialization tasks in the sidebar
    case Constants.kCOMMAND_PULL_TABS:
      if (message.windowId) {
        TabsUpdate.completeLoadingTabs(message.windowId); // don't wait here for better perfomance
        return Promise.resolve(TabsStore.windows.get(message.windowId).export(true));
      }
      return Promise.resolve(message.tabIds.map(id => {
        const tab = Tab.get(id);
        return tab && tab.$TST.export(true);
      }));

    case Constants.kCOMMAND_PULL_TABS_ORDER:
      return Promise.resolve(TabsStore.windows.get(message.windowId).order);

    case Constants.kCOMMAND_PULL_TREE_STRUCTURE:
      return (async () => {
        while (!mInitialized) {
          await wait(10);
        }
        const structure = TreeBehavior.getTreeStructureFromTabs(Tab.getAllTabs(message.windowId));
        return { structure };
      })();

    case Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED:
      return (async () => {
        if (JSON.stringify(message.permissions) == JSON.stringify(Permissions.ALL_URLS)) {
          const tabs = await browser.tabs.query({}).catch(ApiTabs.createErrorHandler());
          await Tab.waitUntilTracked(tabs.map(tab => tab.id));
          for (const tab of tabs) {
            Background.tryStartHandleAccelKeyOnTab(Tab.get(tab.id));
          }
        }
      })();

    case Constants.kCOMMAND_SIMULATE_SIDEBAR_MESSAGE: {
      SidebarConnection.onMessage.dispatch(message.message.windowId, message.message);
    }; break;

    default:
      const API_PREFIX_MATCHER = /^treestyletab:api:/;
      if (API_PREFIX_MATCHER.test(message.type)) {
        message.type = message.type.replace(API_PREFIX_MATCHER, '');
        return onMessageExternal(message, sender);
      }
      break;
  }
}

// This must be synchronous and return Promise on demando, to avoid
// blocking to other listeners.
function onMessageExternal(message, sender) {
  //log('onMessageExternal: ', message, sender);
  switch (message.type) {
    case TSTAPI.kGET_TREE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const cache = {};
        return TSTAPI.formatTabResult(
          Array.from(tabs, tab => new TSTAPI.TreeItem(tab, { interval: message.interval, cache })),
          message,
          sender.id
        );
      })();

    case TSTAPI.kCOLLAPSE_TREE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        await TSTAPI.doProgressively(
          tabs,
          tab => Tree.collapseExpandSubtree(tab, { collapsed: true, broadcast: true }),
          message.interval
        );
        return true;
      })();

    case TSTAPI.kEXPAND_TREE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        await TSTAPI.doProgressively(
          tabs,
          tab => Tree.collapseExpandSubtree(tab, { collapsed: false, broadcast: true }),
          message.interval
        );
        return true;
      })();

    case TSTAPI.kATTACH:
      return (async () => {
        await Tab.waitUntilTracked([
          message.child,
          message.parent,
          message.insertBefore,
          message.insertAfter
        ]);
        const child  = Tab.get(message.child);
        const parent = Tab.get(message.parent);
        if (!child ||
            !parent ||
            child.windowId != parent.windowId)
          return false;
        await Tree.attachTabTo(child, parent, {
          broadcast:    true,
          insertBefore: Tab.get(message.insertBefore),
          insertAfter:  Tab.get(message.insertAfter)
        });
        return true;
      })();

    case TSTAPI.kDETACH:
      return (async () => {
        await Tab.waitUntilTracked(message.tab);
        const tab = Tab.get(message.tab);
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
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const results = await TSTAPI.doProgressively(
          tabs,
          tab => Commands.indent(tab, message),
          message.interval
        );
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kOUTDENT:
    case TSTAPI.kPROMOTE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const results = await TSTAPI.doProgressively(
          tabs,
          tab => Commands.outdent(tab, message),
          message.interval
        );
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kMOVE_UP:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const results = await TSTAPI.doProgressively(
          tabs,
          tab => Commands.moveUp(tab, message),
          message.interval
        );
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kMOVE_TO_START:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        await Commands.moveTabsToStart(Array.from(tabs));
        return true;
      })();

    case TSTAPI.kMOVE_DOWN:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const results = await TSTAPI.doProgressively(
          tabs,
          tab => Commands.moveDown(tab, message),
          message.interval
        );
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kMOVE_TO_END:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        await Commands.moveTabsToEnd(Array.from(tabs));
        return true;
      })();

    case TSTAPI.kMOVE_BEFORE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const results = await TSTAPI.doProgressively(
          tabs,
          tab => Commands.moveBefore(tab, message),
          message.interval
        );
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kMOVE_AFTER:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const results = await TSTAPI.doProgressively(
          tabs,
          tab => Commands.moveAfter(tab, message),
          message.interval
        );
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kFOCUS:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const tabsArray = await TSTAPI.doProgressively(
          tabs,
          tab => {
            TabsInternalOperation.activateTab(tab, { silently: message.silently });
            return tab;
          },
          message.interval
        );
        return TSTAPI.formatResult(tabsArray.map(() => true), message);
      })();

    case TSTAPI.kDUPLICATE:
      return (async () => {
        const tabs   = await TSTAPI.getTargetTabs(message, sender);
        let behavior = configs.autoAttachOnDuplicated;
        switch (String(message.as || 'sibling').toLowerCase()) {
          case 'child':
            behavior = Constants.kNEWTAB_OPEN_AS_CHILD;
            break;
          case 'sibling':
            behavior = Constants.kNEWTAB_OPEN_AS_SIBLING;
            break;
          case 'nextsibling':
            behavior = Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING;
            break;
          case 'orphan':
            behavior = Constants.kNEWTAB_OPEN_AS_ORPHAN;
            break;
          default:
            break;
        }
        const tabsArray = await TSTAPI.doProgressively(
          tabs,
          async tab => {
            return Commands.duplicateTab(tab, {
              destinationWindowId: tab.windowId,
              behavior,
              multiselected: false
            });
          },
          message.interval
        );
        return TSTAPI.formatResult(tabsArray.map(() => true), message);
      })();

    case TSTAPI.kGROUP_TABS:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        return TabsGroup.groupTabs(Array.from(tabs), { broadcast: true });
      })();

    case TSTAPI.kOPEN_IN_NEW_WINDOW:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const windowId = await Commands.openTabsInWindow(Array.from(tabs), {
          multiselected: false
        });
        return windowId;
      })();

    case TSTAPI.kREOPEN_IN_CONTAINER:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const reopenedTabs = await Commands.reopenInContainer(Array.from(tabs), message.containerId || 'firefox-default');
        const cache = {};
        return TSTAPI.formatTabResult(
          reopenedTabs.map(tab => new TSTAPI.TreeItem(tab, { interval: message.interval, cache })),
          message,
          sender.id
        );
      })();

    case TSTAPI.kGET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        return Promise.resolve(TreeBehavior.getTreeStructureFromTabs(Array.from(tabs)));
      })();

    case TSTAPI.kSET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        await Tree.applyTreeStructureToTabs(Array.from(tabs), message.structure, {
          broadcast: true
        });
        return Promise.resolve(true);
      })();

    case TSTAPI.kADD_TAB_STATE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        let states = message.state || message.states;
        if (!Array.isArray(states))
          states = [states];
        const tabsArray = await TSTAPI.doProgressively(
          tabs,
          tab => {
            for (const state of states) {
              tab.$TST.addState(state);
            }
            return tab;
          },
          message.interval
        );
        Tab.broadcastState(tabsArray, {
          add: states
        });
        return true;
      })();

    case TSTAPI.kREMOVE_TAB_STATE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        let states = message.state || message.states;
        if (!Array.isArray(states))
          states = [states];
        const tabsArray = await TSTAPI.doProgressively(
          tabs,
          tab => {
            for (const state of states) {
              tab.$TST.removeState(state);
            }
            return tab;
          },
          message.interval
        );
        Tab.broadcastState(tabsArray, {
          remove: states
        });
        return true;
      })();

    case TSTAPI.kGRANT_TO_REMOVE_TABS:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const grantedRemovingTabIds = configs
          .grantedRemovingTabIds
          .concat(filterMap(Array.from(tabs), tab => {
            tab = TabsStore.ensureLivingTab(tab);
            return tab ? tab.id : undefined;
          }));
        configs.grantedRemovingTabIds = Array.from(new Set(grantedRemovingTabIds));
        return true;
      })();

    case TSTAPI.kSTART_CUSTOM_DRAG:
      return (async () => {
        SidebarConnection.sendMessage({
          type:     Constants.kNOTIFY_TAB_MOUSEDOWN_EXPIRED,
          windowId: message.windowId || (await browser.windows.getLastFocused({ populate: false }).catch(ApiTabs.createErrorHandler())).id,
          button:   message.button || 0
        });
      })();
  }
}


SidebarConnection.onMessage.addListener(async (windowId, message) => {
  switch (message.type) {
    case Constants.kCOMMAND_SET_SUBTREE_MUTED: {
      await Tab.waitUntilTracked(message.tabId);
      log('set muted state: ', message);
      const root = Tab.get(message.tabId);
      if (!root)
        return;
      const multiselected = root.$TST.multiselected;
      const tabs = multiselected ?
        Tab.getSelectedTabs(root.windowId, { iterator: true }) :
        [root].concat(root.$TST.descendants) ;
      for (const tab of tabs) {
        const playing = tab.$TST.soundPlaying;
        const muted   = tab.$TST.muted;
        log(`tab ${tab.id}: playing=${playing}, muted=${muted}`);
        if (!multiselected && playing != message.muted)
          continue;

        log(` => set muted=${message.muted}`);
        browser.tabs.update(tab.id, {
          muted: message.muted
        }).catch(ApiTabs.createErrorHandler(ApiTabs.handleMissingTabError));

        const add = [];
        const remove = [];
        if (message.muted) {
          add.push(Constants.kTAB_STATE_MUTED);
          tab.$TST.addState(Constants.kTAB_STATE_MUTED);
        }
        else {
          remove.push(Constants.kTAB_STATE_MUTED);
          tab.$TST.removeState(Constants.kTAB_STATE_MUTED);
        }

        if (tab.audible && !message.muted) {
          add.push(Constants.kTAB_STATE_SOUND_PLAYING);
          tab.$TST.addState(Constants.kTAB_STATE_SOUND_PLAYING);
        }
        else {
          remove.push(Constants.kTAB_STATE_SOUND_PLAYING);
          tab.$TST.removeState(Constants.kTAB_STATE_SOUND_PLAYING);
        }

        // tabs.onUpdated is too slow, so users will be confused
        // from still-not-updated tabs (in other words, they tabs
        // are unresponsive for quick-clicks).
        Tab.broadcastState(tab, { add, remove });
      }
    }; break;
  }
});
