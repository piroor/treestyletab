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
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as Tabs from '/common/tabs.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TabsMove from '/common/tabs-move.js';
import * as TabsOpen from '/common/tabs-open.js';
import * as TabsGroup from '/common/tabs-group.js';
import * as Tree from '/common/tree.js';
import * as TSTAPI from '/common/tst-api.js';
import * as SidebarStatus from '/common/sidebar-status.js';
import * as Commands from '/common/commands.js';
import * as Permissions from '/common/permissions.js';

import Tab from '/common/Tab.js';

import * as Background from './background.js';
import * as BackgroundCache from './background-cache.js';
import * as TreeStructure from './tree-structure.js';
import * as HandleTabMultiselect from './handle-tab-multiselect.js';

function log(...args) {
  internalLogger('background/handle-misc', ...args);
}
function logMouseEvent(...args) {
  internalLogger('sidebar/mouse-event-listener', ...args);
}


let mInitialized = false;


Tabs.onPinned.addListener(tab => {
  Tree.collapseExpandSubtree(tab, {
    collapsed: false,
    broadcast: true
  });
  Tree.detachAllChildren(tab, {
    behavior: Tree.getCloseParentBehaviorForTabWithSidebarOpenState(tab, {
      keepChildren: true
    }),
    broadcast: true
  });
  Tree.detachTab(tab, {
    broadcast: true
  });
  Tree.collapseExpandTabAndSubtree(tab, { collapsed: false });
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

  if (SidebarStatus.isOpen(tab.windowId))
    browser.sidebarAction.close();
  else
    browser.sidebarAction.open();
}

async function onShortcutCommand(command) {
  const activeTab = Tab.get((await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0].id);
  const selectedTabs = Tabs.isMultiselected(activeTab) ? Tabs.getSelectedTabs(activeTab.windowId) : [];
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
      browser.runtime.sendMessage({
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
      const nextActive = Tab.getPreviousVisible(activeTab) ||
        Tabs.getLastVisibleTab(activeTab.windowId);
      TabsInternalOperation.activateTab(nextActive, { silently: /Silently/.test(command) });
    }; return;
    case 'focusNext':
    case 'focusNextSilently': {
      const nextActive = Tab.getNextVisible(activeTab) ||
        Tabs.getFirstVisibleTab(activeTab.windowId);
      TabsInternalOperation.activateTab(nextActive, { silently: /Silently/.test(command) });
    }; return;
    case 'focusParent':
      TabsInternalOperation.activateTab(activeTab.$TST.parent);
      return;
    case 'focusFirstChild':
      TabsInternalOperation.activateTab(activeTab.$TST.firstChild);
      return;

    case 'tabbarUp':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        by:       'lineup'
      });
      return;
    case 'tabbarPageUp':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        by:       'pageup'
      });
      return;
    case 'tabbarHome':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        to:       'top'
      });
      return;

    case 'tabbarDown':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        by:       'linedown'
      });
      return;
    case 'tabbarPageDown':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        by:       'pagedown'
      });
      return;
    case 'tabbarEnd':
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SCROLL_TABBAR,
        windowId: activeTab.windowId,
        to:       'bottom'
      });
      return;
  }
}

function onMessage(message, sender) {
  if (!message ||
      typeof message.type != 'string' ||
      message.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', message, sender);
  switch (message.type) {
    case Constants.kCOMMAND_PING_TO_BACKGROUND:
      return Promise.resolve(true);

    case Constants.kCOMMAND_REQUEST_UNIQUE_ID:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.id);
        const tab = Tab.get(message.id);
        if (tab && !message.forceNew)
          return tab.$TST.uniqueId;
        return Tabs.requestUniqueId(message.id, {
          forceNew: message.forceNew
        });
      })();

    case Constants.kCOMMAND_PULL_TABS_ORDER:
      return Promise.resolve(Tabs.trackedWindows.get(message.windowId).order);

    case Constants.kCOMMAND_PULL_TREE_STRUCTURE:
      return (async () => {
        while (!mInitialized) {
          await wait(10);
        }
        const structure = Tree.getTreeStructureFromTabs(Tabs.getAllTabs(message.windowId));
        return { structure };
      })();

    case Constants.kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabId);
        const tab = Tab.get(message.tabId);
        if (!tab)
          return;
        const params = {
          collapsed: message.collapsed,
          justNow:   message.justNow,
          broadcast: true,
          stack:     message.stack
        };
        if (message.manualOperation)
          Tree.manualCollapseExpandSubtree(tab, params);
        else
          Tree.collapseExpandSubtree(tab, params);
        if (mInitialized)
          TreeStructure.reserveToSaveTreeStructure(tab.windowId);
        BackgroundCache.markWindowCacheDirtyFromTab(tab, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
      })();

    case Constants.kCOMMAND_LOAD_URI:
      return TabsOpen.loadURI(message.uri, Object.assign({}, message.options, {
        tab:      Tab.get(message.options.tabId),
        inRemote: false
      }));

    case Constants.kCOMMAND_NEW_TABS:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          message.parentId,
          message.insertBeforeId,
          message.insertAfterId
        ]);
        log('new tabs requested: ', message);
        return TabsOpen.openURIsInTabs(message.uris, Object.assign({}, message, {
          opener:       Tab.get(message.openerId),
          parent:       Tab.get(message.parentId),
          insertBefore: Tab.get(message.insertBeforeId),
          insertAfter:  Tab.get(message.insertAfterId)
        })).then(tabs => tabs.map(tab => tab.id));
      })();

    case Constants.kCOMMAND_NEW_WINDOW_FROM_TABS:
      return (async () => {
        log('new window requested: ', message);
        await Tabs.waitUntilTabsAreCreated(message.tabIds);
        const tabs = message.tabIds.map(id => Tabs.trackedWindows.get(id));
        const movedTabs = await Tree.openNewWindowFromTabs(tabs, message);
        return { movedTabs: movedTabs.map(tab => tab.id) };
      })();

    case Constants.kCOMMAND_MOVE_TABS:
      return (async () => {
        log('move tabs requested: ', message);
        await Tabs.waitUntilTabsAreCreated(message.tabIds.concat([message.insertBeforeId, message.insertAfterId]));
        const movedTabs = await Tree.moveTabs(
          message.tabIds.map(id => Tab.get(id)),
          Object.assign({}, message, {
            insertBefore: Tab.get(message.insertBeforeId),
            insertAfter:  Tab.get(message.insertAfterId)
          })
        );
        return { movedTabs: movedTabs.map(tab => tab.id) };
      })();

    case Constants.kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabIds);
        return TabsInternalOperation.removeTabs(message.tabIds.map(id => Tab.get(id)), message.options);
      })();

    case Constants.kNOTIFY_TAB_MOUSEDOWN:
      return (async () => {
        logMouseEvent('Constants.kNOTIFY_TAB_MOUSEDOWN');
        await Tabs.waitUntilTabsAreCreated(message.tabId);
        const tab = Tab.get(message.tabId);
        if (!tab)
          return;

        logMouseEvent('Sending message to listeners');
        const serializedTab = TSTAPI.serializeTab(tab);
        const mousedownNotified = TSTAPI.sendMessage(Object.assign({}, message, {
          type: TSTAPI.kNOTIFY_TAB_MOUSEDOWN,
          tab:  serializedTab
        }));

        // We must send tab-mouseup after tab-mousedown is notified.
        // So, we return to the caller process and do this post process asynchronously.
        mousedownNotified.then(async (results) => {
          results = results.concat(
            await TSTAPI.sendMessage(Object.assign({}, message, {
              type: TSTAPI.kNOTIFY_TAB_CLICKED,
              tab:  serializedTab
            }))
          );
          if (results.some(result => result.result))
            return browser.runtime.sendMessage({
              type:     Constants.kNOTIFY_TAB_MOUSEDOWN_CANCELED,
              windowId: message.windowId,
              button:   message.button
            });

          logMouseEvent('Ready to handle click action on the tab');

          // not canceled, then fallback to default behavior
          const onRegularArea = (
            !message.twisty &&
            !message.soundButton &&
            !message.closebox
          );
          const wasMultiselectionAction = (
            onRegularArea &&
            await HandleTabMultiselect.updateSelectionByTabClick(tab, message)
          );
          if (message.button == 0 &&
              onRegularArea &&
              !wasMultiselectionAction)
            TabsInternalOperation.activateTab(tab, {
              keepMultiselection: tab.highlighted
            });
        });

        return true;
      })();

    case Constants.kCOMMAND_SELECT_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabId);
        const tab = Tab.get(message.tabId);
        if (!tab)
          return;
        browser.tabs.update(tab.id, { active: true })
          .catch(ApiTabs.handleMissingTabError);
      })();

    case Constants.kCOMMAND_SELECT_TAB_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabId);
        const tab = Tab.get(message.tabId);
        if (!tab)
          return;
        TabsInternalOperation.activateTab(tab, Object.assign({}, message.options, {
          inRemote: false
        }));
      })();

    case Constants.kCOMMAND_SET_SUBTREE_MUTED:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabId);
        log('set muted state: ', message);
        const root = Tab.get(message.tabId);
        if (!root)
          return;
        const multiselected = Tabs.isMultiselected(root);
        const tabs = multiselected ?
          Tabs.getSelectedTabs(root.windowId) :
          [root].concat(root.$TST.descendants) ;
        for (const tab of tabs) {
          const playing = Tabs.isSoundPlaying(tab);
          const muted   = Tabs.isMuted(tab);
          log(`tab ${tab.id}: playing=${playing}, muted=${muted}`);
          if (!multiselected && playing != message.muted)
            continue;

          log(` => set muted=${message.muted}`);

          browser.tabs.update(tab.id, {
            muted: message.muted
          }).catch(ApiTabs.handleMissingTabError);

          const add = [];
          const remove = [];
          if (message.muted) {
            add.push(Constants.kTAB_STATE_MUTED);
            Tabs.addState(tab, Constants.kTAB_STATE_MUTED);
          }
          else {
            remove.push(Constants.kTAB_STATE_MUTED);
            Tabs.removeState(tab, Constants.kTAB_STATE_MUTED);
          }

          if (Tabs.isAudible(tab) && !message.muted) {
            add.push(Constants.kTAB_STATE_SOUND_PLAYING);
            Tabs.addState(tab, Constants.kTAB_STATE_SOUND_PLAYING);
          }
          else {
            remove.push(Constants.kTAB_STATE_SOUND_PLAYING);
            Tabs.removeState(tab, Constants.kTAB_STATE_SOUND_PLAYING);
          }

          // tabs.onUpdated is too slow, so users will be confused
          // from still-not-updated tabs (in other words, they tabs
          // are unresponsive for quick-clicks).
          Tabs.broadcastState(tab, {
            add, remove,
            bubbles: !Tabs.hasChildTabs(tab)
          });
        }
      })();

    case Constants.kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabIds.concat([message.nextId]));
        return TabsMove.moveTabsBefore(
          message.tabIds.map(id => Tab.get(id)),
          message.nextTabId && Tab.get(message.nextTabId),
          Object.assign({}, message, {
            broadcast: !!message.broadcasted
          })
        ).then(tabs => tabs.map(tab => tab.id));
      })();

    case Constants.kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabIds.concat([message.previousTabId]));
        return TabsMove.moveTabsAfter(
          message.tabIds.map(id => Tab.get(id)),
          message.previousTabId && Tab.get(message.previousTabId),
          Object.assign({}, message, {
            broadcast: !!message.broadcasted
          })
        ).then(tabs => tabs.map(tab => tab.id));
      })();

    case Constants.kCOMMAND_ATTACH_TAB_TO:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          message.childId,
          message.parentId,
          message.insertBeforeId,
          message.insertAfterId
        ]);
        const child  = Tab.get(message.childId);
        const parent = Tab.get(message.parentId);
        if (child && parent)
          await Tree.attachTabTo(child, parent, Object.assign({}, message, {
            insertBefore: Tab.get(message.insertBeforeId),
            insertAfter:  Tab.get(message.insertAfterId)
          }));
      })();

    case Constants.kCOMMAND_DETACH_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabId);
        const tab = Tab.get(message.tabId);
        if (tab)
          await Tree.detachTab(tab);
      })();

    case Constants.kCOMMAND_PERFORM_TABS_DRAG_DROP:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          message.attachToId,
          message.insertBeforeId,
          message.insertAfterId
        ]);
        log('perform tabs dragdrop requested: ', message);
        return Commands.performTabsDragDrop(Object.assign({}, message, {
          tabs:         message.tabIds.map(id => Tab.get(id)),
          attachTo:     message.attachToId && Tab.get(message.attachToId),
          insertBefore: message.insertBeforeId && Tab.get(message.insertBeforeId),
          insertAfter:  message.insertAfterId && Tab.get(message.insertAfterId)
        }));
      })();

    case Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED:
      return (async () => {
        if (JSON.stringify(message.permissions) == JSON.stringify(Permissions.ALL_URLS)) {
          const tabs = await browser.tabs.query({});
          await Tabs.waitUntilTabsAreCreated(tabs.map(tab => tab.id));
          for (const tab of tabs) {
            Background.tryStartHandleAccelKeyOnTab(Tab.get(tab.id));
          }
        }
      })();

    default:
      const API_PREFIX_MATCHER = /^treestyletab:api:/;
      if (API_PREFIX_MATCHER.test(message.type)) {
        message.type = message.type.replace(API_PREFIX_MATCHER, '');
        return onMessageExternal(message, sender);
      }
      break;
  }
}

function onMessageExternal(message, sender) {
  //log('onMessageExternal: ', message, sender);
  switch (message.type) {
    case TSTAPI.kGET_TREE:
      return (async () => {
        const tabs    = await TSTAPI.getTargetTabs(message, sender);
        const results = await Promise.all(tabs.map(TSTAPI.serializeTabWithEffectiveFavIconUrl));
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kCOLLAPSE_TREE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
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
        const tabs = await TSTAPI.getTargetTabs(message, sender);
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
        await Tabs.waitUntilTabsAreCreated(message.tab);
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
        const results = await Promise.all(tabs.map(tab => Commands.indent(tab, message)));
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kOUTDENT:
    case TSTAPI.kPROMOTE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const results = await Promise.all(tabs.map(tab => Commands.outdent(tab, message)));
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kMOVE_UP:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const results = await Promise.all(tabs.map(tab => Commands.moveUp(tab, message)));
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kMOVE_TO_START:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        await Commands.moveTabsToStart(tabs);
        return true;
      })();

    case TSTAPI.kMOVE_DOWN:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const results = await Promise.all(tabs.map(tab => Commands.moveDown(tab, message)));
        return TSTAPI.formatResult(results, message);
      })();

    case TSTAPI.kMOVE_TO_END:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        await Commands.moveTabsToEnd(tabs);
        return true;
      })();

    case TSTAPI.kFOCUS:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        for (const tab of tabs) {
          TabsInternalOperation.activateTab(tab, {
            silently: message.silently
          });
        }
        return TSTAPI.formatResult(tabs.map(() => true), message);
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
        for (const tab of tabs) {
          await Commands.duplicateTab(tab, {
            destinationWindowId: tab.windowId,
            behavior,
            multiselected: false
          });
        }
        return TSTAPI.formatResult(tabs.map(() => true), message);
      })();

    case TSTAPI.kGROUP_TABS:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        return TabsGroup.groupTabs(tabs, { broadcast: true });
      })();

    case TSTAPI.kOPEN_IN_NEW_WINDOW:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const windowId = await Commands.openTabsInWindow(tabs, {
          multiselected: false
        });
        return windowId;
      })();

    case TSTAPI.kREOPEN_IN_CONTAINER:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const reopenedTabs = await Commands.reopenInContainer(tabs, message.containerId || 'firefox-default');
        return TSTAPI.formatResult(reopenedTabs, message);
      })();

    case TSTAPI.kGET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        return Promise.resolve(Tree.getTreeStructureFromTabs(tabs));
      })();

    case TSTAPI.kSET_TREE_STRUCTURE:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        await Tree.applyTreeStructureToTabs(tabs, message.structure, {
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
        for (const tab of tabs) {
          for (const state of states) {
            Tabs.addState(tab, state);
          }
        }
        Tabs.broadcastState(tabs, {
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
        for (const tab of tabs) {
          for (const state of states) {
            Tabs.removeState(tab, state);
          }
        }
        Tabs.broadcastState(tabs, {
          remove: states
        });
        return true;
      })();

    case TSTAPI.kGRANT_TO_REMOVE_TABS:
      return (async () => {
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        const grantedRemovingTabIds = configs.grantedRemovingTabIds.concat(tabs.filter(Tabs.ensureLivingTab).map(tab => tab.id));
        configs.grantedRemovingTabIds = Array.from(new Set(grantedRemovingTabIds));
        return true;
      })();

    case TSTAPI.kSTART_CUSTOM_DRAG:
      return (async () => {
        return browser.runtime.sendMessage({
          type:     Constants.kNOTIFY_TAB_MOUSEDOWN_EXPIRED,
          windowId: message.windowId || (await browser.windows.getLastFocused({ populate: false })).id,
          button:   message.button || 0
        });
      })();
  }
}
