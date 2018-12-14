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
  const activeTab = Tabs.getTabById((await browser.tabs.query({
    active:        true,
    currentWindow: true
  }))[0]);
  const selectedTabs = Tabs.isMultiselected(activeTab) ? Tabs.getSelectedTabs(activeTab) : [];

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
      Commands.collapseAll(activeTab);
      return;
    case 'expandTree':
      Commands.expandTree(activeTab);
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
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SHOW_CONTAINER_SELECTOR,
        windowId: activeTab.apiTab.windowId
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
      const nextFocused = Tabs.getPreviousVisibleTab(activeTab) ||
        Tabs.getLastVisibleTab(activeTab);
      TabsInternalOperation.selectTab(nextFocused, { silently: /Silently/.test(command) });
    }; return;
    case 'focusNext':
    case 'focusNextSilently': {
      const nextFocused = Tabs.getNextVisibleTab(activeTab) ||
        Tabs.getFirstVisibleTab(activeTab);
      TabsInternalOperation.selectTab(nextFocused, { silently: /Silently/.test(command) });
    }; return;
    case 'focusParent':
      TabsInternalOperation.selectTab(Tabs.getParentTab(activeTab));
      return;
    case 'focusFirstChild':
      TabsInternalOperation.selectTab(Tabs.getFirstChildTab(activeTab));
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
        const tab = Tabs.getTabById(message.id);
        if (tab && !message.forceNew)
          return tab.uniqueId;
        return Tabs.requestUniqueId(message.id, {
          forceNew: message.forceNew
        });
      })();

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
        await Tabs.waitUntilTabsAreCreated(message.tab);
        const tab = Tabs.getTabById(message.tab);
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
          TreeStructure.reserveToSaveTreeStructure(tab);
        BackgroundCache.markWindowCacheDirtyFromTab(tab, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
      })();

    case Constants.kCOMMAND_LOAD_URI:
      return TabsOpen.loadURI(message.uri, Object.assign({}, message.options, {
        tab:      Tabs.getTabById(message.options.tab),
        inRemote: false
      }));

    case Constants.kCOMMAND_NEW_TABS:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          message.parent,
          message.insertBefore,
          message.insertAfter
        ]);
        log('new tabs requested: ', message);
        return await TabsOpen.openURIsInTabs(message.uris, Object.assign({}, message, {
          parent:       Tabs.getTabById(message.parent),
          insertBefore: Tabs.getTabById(message.insertBefore),
          insertAfter:  Tabs.getTabById(message.insertAfter)
        }));
      })();

    case Constants.kCOMMAND_NEW_WINDOW_FROM_TABS:
      return (async () => {
        log('new window requested: ', message);
        await Tabs.waitUntilTabsAreCreated(message.tabs);
        const movedTabs = await Tree.openNewWindowFromTabs(
          message.tabs.map(Tabs.getTabById),
          message
        );
        return { movedTabs: movedTabs.map(tab => tab.id) };
      })();

    case Constants.kCOMMAND_MOVE_TABS:
      return (async () => {
        log('move tabs requested: ', message);
        await Tabs.waitUntilTabsAreCreated(message.tabs.concat([message.insertBefore, message.insertAfter]));
        const movedTabs = await Tree.moveTabs(
          message.tabs.map(Tabs.getTabById),
          Object.assign({}, message, {
            insertBefore: Tabs.getTabById(message.insertBefore),
            insertAfter:  Tabs.getTabById(message.insertAfter)
          })
        );
        return { movedTabs: movedTabs.map(tab => tab.id) };
      })();

    case Constants.kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabs);
        return TabsInternalOperation.removeTabs(message.tabs.map(Tabs.getTabById), message.options);
      })();

    case Constants.kNOTIFY_TAB_MOUSEDOWN:
      return (async () => {
        logMouseEvent('Constants.kNOTIFY_TAB_MOUSEDOWN');
        await Tabs.waitUntilTabsAreCreated(message.tab);
        const tab = Tabs.getTabById(message.tab);
        if (!tab)
          return;

        logMouseEvent('Sending message to listeners');
        const serializedTab = TSTAPI.serializeTab(tab);
        const mousedownNotified = TSTAPI.sendMessage(Object.assign({}, message, {
          type:   TSTAPI.kNOTIFY_TAB_MOUSEDOWN,
          tab:    serializedTab,
          window: tab.apiTab.windowId,
          windowId: tab.apiTab.windowId
        }));

        // We must send tab-mouseup after tab-mousedown is notified.
        // So, we return to the caller process and do this post process asynchronously.
        mousedownNotified.then(async (results) => {
          results = results.concat(
            await TSTAPI.sendMessage(Object.assign({}, message, {
              type:   TSTAPI.kNOTIFY_TAB_CLICKED,
              tab:    serializedTab,
              window: tab.apiTab.windowId,
              windowId: tab.apiTab.windowId
            }))
          );
          if (results.some(result => result.result)) // canceled
            return;

          logMouseEvent('Ready to select the tab');

          // not canceled, then fallback to default behavior
          const wasMultiselectionAction = await HandleTabMultiselect.updateSelectionByTabClick(tab, message);
          if (message.button == 0 &&
              !wasMultiselectionAction)
            TabsInternalOperation.selectTab(tab);
        });

        return true;
      })();

    case Constants.kCOMMAND_SELECT_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tab);
        const tab = Tabs.getTabById(message.tab);
        if (!tab)
          return;
        browser.tabs.update(tab.apiTab.id, { active: true })
          .catch(ApiTabs.handleMissingTabError);
      })();

    case Constants.kCOMMAND_SELECT_TAB_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tab);
        const tab = Tabs.getTabById(message.tab);
        if (!tab)
          return;
        TabsInternalOperation.selectTab(tab, Object.assign({}, message.options, {
          inRemote: false
        }));
      })();

    case Constants.kCOMMAND_SET_SUBTREE_MUTED:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tab);
        log('set muted state: ', message);
        const root = Tabs.getTabById(message.tab);
        if (!root)
          return;
        const multiselected = Tabs.isMultiselected(root);
        const tabs = multiselected ?
          Tabs.getSelectedTabs(root) :
          [root].concat(Tabs.getDescendantTabs(root)) ;
        for (const tab of tabs) {
          const playing = Tabs.isSoundPlaying(tab);
          const muted   = Tabs.isMuted(tab);
          log(`tab ${tab.id}: playing=${playing}, muted=${muted}`);
          if (!multiselected && playing != message.muted)
            continue;

          log(` => set muted=${message.muted}`);

          browser.tabs.update(tab.apiTab.id, {
            muted: message.muted
          }).catch(ApiTabs.handleMissingTabError);

          const add = [];
          const remove = [];
          if (message.muted) {
            add.push(Constants.kTAB_STATE_MUTED);
            tab.classList.add(Constants.kTAB_STATE_MUTED);
          }
          else {
            remove.push(Constants.kTAB_STATE_MUTED);
            tab.classList.remove(Constants.kTAB_STATE_MUTED);
          }

          if (Tabs.isAudible(tab) && !message.muted) {
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
        await Tabs.waitUntilTabsAreCreated(message.tabs.concat([message.nextTab]));
        return TabsMove.moveTabsBefore(
          message.tabs.map(Tabs.getTabById),
          Tabs.getTabById(message.nextTab),
          Object.assign({}, message, {
            broadcast: !!message.broadcasted
          })
        ).then(tabs => tabs.map(tab => tab.id));
      })();

    case Constants.kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabs.concat([message.previousTab]));
        return TabsMove.moveTabsAfter(
          message.tabs.map(Tabs.getTabById),
          Tabs.getTabById(message.previousTab),
          Object.assign({}, message, {
            broadcast: !!message.broadcasted
          })
        ).then(tabs => tabs.map(tab => tab.id));
      })();

    case Constants.kCOMMAND_ATTACH_TAB_TO:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          message.child,
          message.parent,
          message.insertBefore,
          message.insertAfter
        ]);
        const child  = Tabs.getTabById(message.child);
        const parent = Tabs.getTabById(message.parent);
        if (child && parent)
          await Tree.attachTabTo(child, parent, Object.assign({}, message, {
            insertBefore: Tabs.getTabById(message.insertBefore),
            insertAfter:  Tabs.getTabById(message.insertAfter)
          }));
      })();

    case Constants.kCOMMAND_DETACH_TAB:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tab);
        const tab = Tabs.getTabById(message.tab);
        if (tab)
          await Tree.detachTab(tab);
      })();

    case Constants.kCOMMAND_PERFORM_TABS_DRAG_DROP:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          message.attachTo,
          message.insertBefore,
          message.insertAfter
        ]);
        log('perform tabs dragdrop requested: ', message);
        return Commands.performTabsDragDrop(Object.assign({}, message, {
          attachTo:     Tabs.getTabById(message.attachTo),
          insertBefore: Tabs.getTabById(message.insertBefore),
          insertAfter:  Tabs.getTabById(message.insertAfter)
        }));
      })();

    case Constants.kCOMMAND_NOTIFY_PERMISSIONS_GRANTED:
      return (async () => {
        if (JSON.stringify(message.permissions) == JSON.stringify(Permissions.ALL_URLS)) {
          const apiTabs = await browser.tabs.query({});
          await Tabs.waitUntilTabsAreCreated(apiTabs.map(aPITab => aPITab.id));
          for (const apiTab of apiTabs) {
            Background.tryStartHandleAccelKeyOnTab(Tabs.getTabById(apiTab));
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
        const child  = Tabs.getTabById(message.child);
        const parent = Tabs.getTabById(message.parent);
        if (!child ||
            !parent ||
            child.parentNode != parent.parentNode)
          return false;
        await Tree.attachTabTo(child, parent, {
          broadcast:    true,
          insertBefore: Tabs.getTabById(message.insertBefore),
          insertAfter:  Tabs.getTabById(message.insertAfter)
        });
        return true;
      })();

    case TSTAPI.kDETACH:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tab);
        const tab = Tabs.getTabById(message.tab);
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
          TabsInternalOperation.selectTab(tab, {
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
            destinationWindowId: tab.apiTab.windowId,
            behavior,
            multiselected: false
          });
        }
        return TSTAPI.formatResult(tabs.map(() => true), message);
      })();

    case TSTAPI.kGROUP_TABS:
      return (async () => {
        const tabs     = await TSTAPI.getTargetTabs(message, sender);
        const groupTab = await TabsGroup.groupTabs(tabs, { broadcast: true });
        return groupTab.apiTab;
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
        return TSTAPI.formatResult(reopenedTabs.map(tab => tab.apiTab), message);
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
        const tabs = await TSTAPI.getTargetTabs(message, sender);
        let states = message.state || message.states;
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
