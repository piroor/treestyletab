/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2020
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import MenuUI from '/extlib/MenuUI.js';

import {
  log as internalLogger,
  wait,
  dumpTab,
  mapAndFilter,
  countMatched,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TreeBehavior from '/common/tree-behavior.js';
import * as TSTAPI from '/common/tst-api.js';
import * as MetricsData from '/common/metrics-data.js';

import Tab from '/common/Tab.js';

import * as BackgroundConnection from './background-connection.js';
import * as Sidebar from './sidebar.js';
import * as EventUtils from './event-utils.js';
import * as DragAndDrop from './drag-and-drop.js';
import * as TabContextMenu from './tab-context-menu.js';

function log(...args) {
  internalLogger('sidebar/mouse-event-listener', ...args);
}

let mTargetWindow;

const mTabBar = document.querySelector('#tabbar');
const mContextualIdentitySelector = document.getElementById(Constants.kCONTEXTUAL_IDENTITY_SELECTOR);
const mNewTabActionSelector       = document.getElementById(Constants.kNEWTAB_ACTION_SELECTOR);

Sidebar.onInit.addListener(() => {
  mTargetWindow = TabsStore.getWindow();
});

Sidebar.onBuilt.addListener(async () => {
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('click', onClick);
  mTabBar.addEventListener('dblclick', onDblClick);

  MetricsData.add('mouse-event-listener: Sidebar.onBuilt: apply configs');

  browser.runtime.onMessage.addListener(onMessage);
  BackgroundConnection.onMessage.addListener(onBackgroundMessage);

  mContextualIdentitySelector.ui = new MenuUI({
    root:       mContextualIdentitySelector,
    appearance: 'panel',
    onCommand:  onContextualIdentitySelect,
    animationDuration: configs.animation ? configs.collapseDuration : 0.001
  });

  mNewTabActionSelector.ui = new MenuUI({
    root:       mNewTabActionSelector,
    appearance: 'panel',
    onCommand:  onNewTabActionSelect,
    animationDuration: configs.animation ? configs.collapseDuration : 0.001
  });
});

Sidebar.onReady.addListener(() => {
  updateSpecialEventListenersForAPIListeners();
});

function updateSpecialEventListenersForAPIListeners() {
  if ((TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_MOUSEMOVE).length > 0) != onMouseMove.listening) {
    if (!onMouseMove.listening) {
      window.addEventListener('mousemove', onMouseMove, { capture: true, passive: true });
      onMouseMove.listening = true;
    }
    else {
      window.removeEventListener('mousemove', onMouseMove, { capture: true, passive: true });
      onMouseMove.listening = false;
    }
  }

  const shouldListenMouseOut = TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_MOUSEOUT) > 0;
  const shouldListenMouseOver = shouldListenMouseOut || TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_MOUSEOVER) > 0;

  if (shouldListenMouseOver != onMouseOver.listening) {
    if (!onMouseOver.listening) {
      window.addEventListener('mouseover', onMouseOver, { capture: true, passive: true });
      onMouseOver.listening = true;
    }
    else {
      window.removeEventListener('mouseover', onMouseOver, { capture: true, passive: true });
      onMouseOver.listening = false;
    }
  }

  if (shouldListenMouseOut != onMouseOut.listening) {
    if (!onMouseOut.listening) {
      window.addEventListener('mouseout', onMouseOut, { capture: true, passive: true });
      onMouseOut.listening = true;
    }
    else {
      window.removeEventListener('mouseout', onMouseOut, { capture: true, passive: true });
      onMouseOut.listening = false;
    }
  }
}


/* handlers for DOM events */

function onMouseMove(event) {
  const tab = EventUtils.getTabFromEvent(event);
  if (tab) {
    TSTAPI.sendMessage({
      type:     TSTAPI.kNOTIFY_TAB_MOUSEMOVE,
      tab:      new TSTAPI.TreeItem(tab),
      window:   mTargetWindow,
      windowId: mTargetWindow,
      ctrlKey:  event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey:   event.altKey,
      metaKey:  event.metaKey,
      dragging: DragAndDrop.isCapturingForDragging()
    }, { tabProperties: ['tab'] }).catch(_error => {});
  }
}
onMouseMove = EventUtils.wrapWithErrorHandler(onMouseMove);

function onMouseOver(event) {
  const tab = EventUtils.getTabFromEvent(event);

  // We enter the tab or one of its children, but not from any of the tabs
  // (other) children, so we are now starting to hover this tab (relatedTarget
  // contains the target of the mouseout event or null if there is none). This
  // also includes the case where we enter the tab directly without going
  // through another tab or the sidebar, which causes relatedTarget to be null
  const enterTabFromAncestor = tab && !tab.$TST.element.contains(event.relatedTarget);

  if (enterTabFromAncestor) {
    TSTAPI.sendMessage({
      type:     TSTAPI.kNOTIFY_TAB_MOUSEOVER,
      tab:      new TSTAPI.TreeItem(tab),
      window:   mTargetWindow,
      windowId: mTargetWindow,
      ctrlKey:  event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey:   event.altKey,
      metaKey:  event.metaKey,
      dragging: DragAndDrop.isCapturingForDragging()
    }, { tabProperties: ['tab'] }).catch(_error => {});
  }
}
onMouseOver = EventUtils.wrapWithErrorHandler(onMouseOver);

function onMouseOut(event) {
  const tab = EventUtils.getTabFromEvent(event);

  // We leave the tab or any of its children, but not for one of the tabs
  // (other) children, so we are no longer hovering this tab (relatedTarget
  // contains the target of the mouseover event or null if there is none). This
  // also includes the case where we leave the tab directly without going
  // through another tab or the sidebar, which causes relatedTarget to be null
  const leaveTabToAncestor = tab && !tab.$TST.element.contains(event.relatedTarget);

  if (leaveTabToAncestor) {
    TSTAPI.sendMessage({
      type:     TSTAPI.kNOTIFY_TAB_MOUSEOUT,
      tab:      new TSTAPI.TreeItem(tab),
      window:   mTargetWindow,
      windowId: mTargetWindow,
      ctrlKey:  event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey:   event.altKey,
      metaKey:  event.metaKey,
      dragging: DragAndDrop.isCapturingForDragging()
    }, { tabProperties: ['tab'] }).catch(_error => {});
  }
}
onMouseOut = EventUtils.wrapWithErrorHandler(onMouseOut);

function onMouseDown(event) {
  EventUtils.cancelHandleMousedown(event.button);
  TabContextMenu.close();
  DragAndDrop.clearDropPosition();
  DragAndDrop.clearDraggingState();

  if (EventUtils.isEventFiredOnAnchor(event) &&
      !EventUtils.isAccelAction(event) &&
      event.button != 2) {
    log('onMouseDown: canceled / mouse down on a selector anchor');
    event.stopPropagation();
    event.preventDefault();
    const selector = document.getElementById(EventUtils.getElementTarget(event).closest('[data-menu-ui]').dataset.menuUi);
    selector.ui.open({
      anchor: event.target
    });
    return;
  }

  const target = event.target;
  const tab = EventUtils.getTabFromEvent(event) || EventUtils.getTabFromTabbarEvent(event);
  log('onMouseDown: found target tab: ', tab);

  const mousedownDetail = {
    targetType:    getMouseEventTargetType(event),
    tab:           tab && tab.id,
    tabId:         tab && tab.id,
    window:        mTargetWindow,
    windowId:      mTargetWindow,
    twisty:        EventUtils.isEventFiredOnTwisty(event),
    soundButton:   EventUtils.isEventFiredOnSoundButton(event),
    closebox:      EventUtils.isEventFiredOnClosebox(event),
    button:        event.button,
    ctrlKey:       event.ctrlKey,
    shiftKey:      event.shiftKey,
    altKey:        event.altKey,
    metaKey:       event.metaKey,
    isMiddleClick: EventUtils.isMiddleClick(event),
    isAccelClick:  EventUtils.isAccelAction(event)
  };
  log('onMouseDown ', mousedownDetail);

  if (mousedownDetail.targetType == 'selector')
    return;

  if (mousedownDetail.isMiddleClick) {
    log('onMouseDown: canceled / middle click');
    event.stopPropagation();
    event.preventDefault();
  }

  const mousedown = {
    detail: mousedownDetail,
    treeItem: new TSTAPI.TreeItem(tab),
    promisedMousedownNotified: Promise.resolve()
  };

  mousedown.promisedMousedownNotified = Promise.all([
    browser.runtime.sendMessage({type: Constants.kNOTIFY_TAB_MOUSEDOWN })
      .catch(ApiTabs.createErrorHandler()),
    (async () => {
      if (mousedownDetail.targetType != 'tab')
        return;
      log('Sending message to listeners');
      return TSTAPI.sendMessage(Object.assign({}, mousedownDetail, {
        type: TSTAPI.kNOTIFY_TAB_MOUSEDOWN,
        tab:  mousedown.treeItem
      }), { tabProperties: ['tab'] });
    })()
  ]).then(results => results[1]);

  EventUtils.setLastMousedown(event.button, mousedown);
  mousedown.timeout = setTimeout(async () => {
    if (!EventUtils.getLastMousedown(event.button))
      return;

    if (event.button == 0 &&
        mousedownDetail.targetType == 'newtabbutton' &&
        configs.longPressOnNewTabButton) {
      mousedown.expired = true;
      const selector = document.getElementById(configs.longPressOnNewTabButton);
      if (selector) {
        selector.ui.open({
          anchor: target
        });
      }
      return;
    }

    if (TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_DRAGREADY).length == 0 ||
        EventUtils.getElementTarget(event).closest('#tab-drag-handle'))
      return;

    if (event.button == 0 &&
        tab) {
      log('onMouseDown expired');
      mousedown.expired = true;
    }
  }, configs.longPressDuration);
}
onMouseDown = EventUtils.wrapWithErrorHandler(onMouseDown);

function getMouseEventTargetType(event) {
  if (EventUtils.getTabFromEvent(event))
    return 'tab';

  if (EventUtils.isEventFiredOnNewTabButton(event))
    return 'newtabbutton';

  if (EventUtils.isEventFiredOnMenuOrPanel(event) ||
      EventUtils.isEventFiredOnAnchor(event))
    return 'selector';

  const allRange = document.createRange();
  allRange.selectNodeContents(document.body);
  const containerRect = allRange.getBoundingClientRect();
  allRange.detach();
  if (event.clientX < containerRect.left ||
      event.clientX > containerRect.right ||
      event.clientY < containerRect.top ||
      event.clientY > containerRect.bottom)
    return 'outside';

  return 'blank';
}

async function onMouseUp(event) {
  const unsafeTab = EventUtils.getTabFromEvent(event, { force: true }) || EventUtils.getTabFromTabbarEvent(event, { force: true });
  const tab       = EventUtils.getTabFromEvent(event) || EventUtils.getTabFromTabbarEvent(event);
  log('onMouseUp: ', unsafeTab, { living: !!tab });

  DragAndDrop.endMultiDrag(unsafeTab, event);

  if (EventUtils.isEventFiredOnMenuOrPanel(event) ||
      EventUtils.isEventFiredOnAnchor(event))
    return;

  const lastMousedown = EventUtils.getLastMousedown(event.button);
  EventUtils.cancelHandleMousedown(event.button);
  if (!lastMousedown)
    return;

  let promisedCanceled = null;
  if (lastMousedown.treeItem && lastMousedown.detail.targetType == 'tab')
    promisedCanceled = Promise.all([
      TSTAPI.sendMessage(Object.assign({}, lastMousedown.detail, {
        type: TSTAPI.kNOTIFY_TAB_MOUSEUP,
        tab:  lastMousedown.treeItem
      }), { tabProperties: ['tab'] }),

      TSTAPI.sendMessage(Object.assign({}, lastMousedown.detail, {
        type: TSTAPI.kNOTIFY_TAB_CLICKED,
        tab:  lastMousedown.treeItem
      }), { tabProperties: ['tab'] }),

      lastMousedown.promisedMousedownNotified
    ])
      .then(results => results.flat())
      .then(results => results.some(result => result && result.result));

  if (lastMousedown.expired ||
      lastMousedown.detail.targetType != getMouseEventTargetType(event) || // when the cursor was moved before mouseup
      (tab && tab != Tab.get(lastMousedown.detail.tab))) // when the tab was already removed
    return;

  if (promisedCanceled && await promisedCanceled) {
    log('onMouseUp: canceled / by other addons');
    return;
  }

  // not canceled, then fallback to default behavior
  return handleDefaultMouseUp({ lastMousedown, tab, event });
}
onMouseUp = EventUtils.wrapWithErrorHandler(onMouseUp);

async function handleDefaultMouseUp({ lastMousedown, tab, event }) {
  log('handleDefaultMouseUp ', lastMousedown.detail);

  if (tab &&
      lastMousedown.detail.button != 2 &&
      await handleDefaultMouseUpOnTab(lastMousedown, tab))
    return;

  // following codes are for handlig of click event on the tab bar itself.
  const actionForNewTabCommand = lastMousedown.detail.isAccelClick ?
    configs.autoAttachOnNewTabButtonMiddleClick :
    configs.autoAttachOnNewTabCommand;
  if (EventUtils.isEventFiredOnNewTabButton(event)) {
    if (lastMousedown.detail.button != 2) {
      log('onMouseUp: click on the new tab button');
      handleNewTabAction(event, {
        action: actionForNewTabCommand
      });
    }
    return;
  }

  log('onMouseUp: notify as a blank area click to other addons');
  let results = await TSTAPI.sendMessage(Object.assign({}, lastMousedown.detail, {
    type:     TSTAPI.kNOTIFY_TABBAR_MOUSEUP,
    window:   mTargetWindow,
    windowId: mTargetWindow,
    tab:      lastMousedown.treeItem
  }), { tabProperties: ['tab'] });
  results = results.concat(await TSTAPI.sendMessage(Object.assign({}, lastMousedown.detail, {
    type:     TSTAPI.kNOTIFY_TABBAR_CLICKED,
    window:   mTargetWindow,
    windowId: mTargetWindow,
    tab:      lastMousedown.treeItem
  }), { tabProperties: ['tab'] }));
  if (results.some(result => result.result))// canceled
    return;

  if (lastMousedown.detail.isMiddleClick) { // Ctrl-click does nothing on Firefox's tab bar!
    log('onMouseUp: default action for middle click on the blank area');
    handleNewTabAction(event, {
      action: configs.autoAttachOnNewTabCommand
    });
  }
}
handleDefaultMouseUp = EventUtils.wrapWithErrorHandler(handleDefaultMouseUp);

async function handleDefaultMouseUpOnTab(lastMousedown, tab) {
  log('Ready to handle click action on the tab');

  const onRegularArea = (
    !lastMousedown.detail.twisty &&
    !lastMousedown.detail.soundButton &&
    !lastMousedown.detail.closebox
  );
  const wasMultiselectionAction = (
    onRegularArea &&
    updateMultiselectionByTabClick(tab, lastMousedown.detail)
  );
  log(' => ', { onRegularArea, wasMultiselectionAction });

  if (lastMousedown.detail.button == 0 &&
      onRegularArea &&
      !wasMultiselectionAction)
    TabsInternalOperation.activateTab(tab, {
      keepMultiselection: false // tab.highlighted
    });

  if (lastMousedown.detail.isMiddleClick) { // Ctrl-click doesn't close tab on Firefox's tab bar!
    log('onMouseUp: middle click on a tab');
    if (lastMousedown.detail.targetType != 'tab') // ignore middle click on blank area
      return false;
    const tabs = TreeBehavior.getClosingTabsFromParent(tab, {
      byInternalOperation: true
    });
    Sidebar.confirmToCloseTabs(tabs.map(tab => tab.$TST.sanitized))
      .then(confirmed => {
        if (confirmed)
          BackgroundConnection.sendMessage({
            type:   Constants.kCOMMAND_REMOVE_TABS_INTERNALLY,
            tabIds: tabs.map(tab => tab.id)
          });
      });
  }
  else if (lastMousedown.detail.twisty) {
    log('clicked on twisty');
    if (tab.$TST.hasChild)
      BackgroundConnection.sendMessage({
        type:            Constants.kCOMMAND_SET_SUBTREE_COLLAPSED_STATE,
        tabId:           tab.id,
        collapsed:       !tab.$TST.subtreeCollapsed,
        manualOperation: true,
        stack:           configs.debug && new Error().stack
      });
  }
  else if (lastMousedown.detail.soundButton) {
    log('clicked on sound button');
    BackgroundConnection.sendMessage({
      type:  Constants.kCOMMAND_SET_SUBTREE_MUTED,
      tabId: tab.id,
      muted: tab.$TST.maybeSoundPlaying
    });
  }
  else if (lastMousedown.detail.closebox) {
    log('clicked on closebox');
    //if (!warnAboutClosingTabSubtreeOf(tab)) {
    //  event.stopPropagation();
    //  event.preventDefault();
    //  return;
    //}
    const multiselected  = tab.$TST.multiselected;
    const tabsToBeClosed = multiselected ?
      Tab.getSelectedTabs(tab.windowId) :
      TreeBehavior.getClosingTabsFromParent(tab, {
        byInternalOperation: true
      }) ;
    Sidebar.confirmToCloseTabs(tabsToBeClosed.map(tab => tab.$TST.sanitized), {
      configKey: 'warnOnCloseTabsByClosebox'
    })
      .then(confirmed => {
        if (!confirmed)
          return;
        BackgroundConnection.sendMessage({
          type:   Constants.kCOMMAND_REMOVE_TABS_INTERNALLY,
          tabIds: tabsToBeClosed.map(tab => tab.id)
        });
      });
  }

  return true;
}
handleDefaultMouseUpOnTab = EventUtils.wrapWithErrorHandler(handleDefaultMouseUpOnTab);

const mLastClickedTabInWindow = new Map();
const mIsInSelectionSession   = new Map();

function updateMultiselectionByTabClick(tab, event) {
  const ctrlKeyPressed     = event.ctrlKey || (event.metaKey && /^Mac/i.test(navigator.platform));
  const activeTab          = Tab.getActiveTab(tab.windowId);
  const highlightedTabIds  = new Set(Tab.getHighlightedTabs(tab.windowId).map(tab => tab.id));
  const inSelectionSession = mIsInSelectionSession.get(tab.windowId);
  log('updateMultiselectionByTabClick ', { ctrlKeyPressed, activeTab, highlightedTabIds, inSelectionSession });
  if (event.shiftKey) {
    // select the clicked tab and tabs between last activated tab
    const lastClickedTab   = mLastClickedTabInWindow.get(tab.windowId) || activeTab;
    const betweenTabs      = Tab.getTabsBetween(lastClickedTab, tab);
    const targetTabs       = new Set([lastClickedTab].concat(betweenTabs));
    targetTabs.add(tab);

    log(' => ', { lastClickedTab, betweenTabs, targetTabs });

    try {
      if (!ctrlKeyPressed) {
        const alreadySelectedTabs = Tab.getSelectedTabs(tab.windowId, { iterator: true });
        log('clear old selection by shift-click: ', configs.debug && Array.from(alreadySelectedTabs, dumpTab));
        for (const alreadySelectedTab of alreadySelectedTabs) {
          if (!targetTabs.has(alreadySelectedTab))
            highlightedTabIds.delete(alreadySelectedTab.id);
        }
      }

      log('set selection by shift-click: ', configs.debug && Array.from(targetTabs, dumpTab));
      for (const toBeSelectedTab of targetTabs) {
        highlightedTabIds.add(toBeSelectedTab.id);
      }

      const rootTabs = [tab];
      if (tab != activeTab &&
          !inSelectionSession)
        rootTabs.push(activeTab);
      for (const root of rootTabs) {
        if (!root.$TST.subtreeCollapsed)
          continue;
        for (const descendant of root.$TST.descendants) {
          highlightedTabIds.add(descendant.id);
        }
      }

      // for better performance, we should not call browser.tabs.update() for each tab.
      const indices = mapAndFilter(highlightedTabIds,
                                   id => id != activeTab.id && Tab.get(id).index || undefined);
      if (highlightedTabIds.has(activeTab.id))
        indices.unshift(activeTab.index);
      browser.tabs.highlight({
        windowId: tab.windowId,
        populate: false,
        tabs:     indices
      }).catch(ApiTabs.createErrorSuppressor());
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    mIsInSelectionSession.set(tab.windowId, true);
    return true;
  }
  else if (ctrlKeyPressed) {
    try {
      log('change selection by ctrl-click: ', dumpTab(tab));
      /* Special operation to toggle selection of collapsed descendants for the active tab.
         - When there is no other multiselected foreign tab
           => toggle multiselection only descendants.
         - When there is one or more multiselected foreign tab
           => toggle multiselection of the active tab and descendants.
              => one of multiselected foreign tabs will be activated.
         - When a foreign tab is highlighted and there is one or more unhighlighted descendants 
           => highlight all descendants (to prevent only the root tab is dragged).
       */
      const activeTabDescendants = activeTab.$TST.descendants;
      let toBeHighlighted = !tab.highlighted;
      log('toBeHighlighted: ', toBeHighlighted);
      if (tab == activeTab &&
          tab.$TST.subtreeCollapsed &&
          activeTabDescendants.length > 0) {
        const highlightedCount  = countMatched(activeTabDescendants, tab => tab.highlighted);
        const partiallySelected = highlightedCount != 0 && highlightedCount != activeTabDescendants.length;
        toBeHighlighted = partiallySelected || !activeTabDescendants[0].highlighted;
        log(' => ', toBeHighlighted, { partiallySelected });
      }
      if (toBeHighlighted)
        highlightedTabIds.add(tab.id);
      else
        highlightedTabIds.delete(tab.id);

      if (tab.$TST.subtreeCollapsed) {
        const descendants = tab == activeTab ? activeTabDescendants : tab.$TST.descendants;
        for (const descendant of descendants) {
          if (toBeHighlighted)
            highlightedTabIds.add(descendant.id);
          else
            highlightedTabIds.delete(descendant.id);
        }
      }

      if (tab == activeTab) {
        if (highlightedTabIds.size == 0) {
          log('Don\'t unhighlight only one highlighted active tab!');
          highlightedTabIds.add(tab.id);
        }
      }
      else if (!inSelectionSession) {
        log('Select active tab and its descendants, for new selection session');
        highlightedTabIds.add(activeTab.id);
        if (activeTab.$TST.subtreeCollapsed) {
          for (const descendant of activeTabDescendants) {
            highlightedTabIds.add(descendant.id);
          }
        }
      }

      // for better performance, we should not call browser.tabs.update() for each tab.
      const indices = mapAndFilter(highlightedTabIds,
                                   id => id != activeTab.id && Tab.get(id).index || undefined);
      if (highlightedTabIds.has(activeTab.id))
        indices.unshift(activeTab.index);
      browser.tabs.highlight({
        windowId: tab.windowId,
        populate: false,
        tabs:     indices
      }).catch(ApiTabs.createErrorSuppressor());
    }
    catch(_e) { // not implemented on old Firefox
      return false;
    }
    mLastClickedTabInWindow.set(tab.windowId, tab);
    mIsInSelectionSession.set(tab.windowId, true);
    return true;
  }
  else {
    mLastClickedTabInWindow.set(tab.windowId, tab);
    mIsInSelectionSession.delete(tab.windowId);
    return false;
  }
}

function onClick(_event) {
  // clear unexpectedly left "dragging" state
  // (see also https://github.com/piroor/treestyletab/issues/1921 )
  DragAndDrop.clearDraggingTabsState();
}
onClick = EventUtils.wrapWithErrorHandler(onClick);

function handleNewTabAction(event, options = {}) {
  log('handleNewTabAction ', { event, options });

  if (!configs.autoAttach && !('action' in options))
    options.action = Constants.kNEWTAB_DO_NOTHING;

  BackgroundConnection.sendMessage({
    type:          Constants.kCOMMAND_NEW_TAB_AS,
    baseTabId:     TabsStore.activeTabInWindow.get(mTargetWindow).id,
    as:            options.action,
    cookieStoreId: options.cookieStoreId,
    inBackground:  event.shiftKey
  });
}

function onDblClick(event) {
  if (EventUtils.isEventFiredOnNewTabButton(event))
    return;

  const tab = EventUtils.getTabFromEvent(event, { force: true }) || EventUtils.getTabFromTabbarEvent(event, { force: true });
  const livingTab = EventUtils.getTabFromEvent(event);
  log('dblclick tab: ', tab, { living: !!livingTab });

  if (livingTab) {
    if (configs.simulateCloseTabByDblclick &&
        event.button == 0 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey) {
      event.stopPropagation();
      event.preventDefault();
      BackgroundConnection.sendMessage({
        type:   Constants.kCOMMAND_REMOVE_TABS_INTERNALLY,
        tabIds: [livingTab.id],
      });
    }
    else if (configs.collapseExpandSubtreeByDblClick) {
      event.stopPropagation();
      event.preventDefault();
      BackgroundConnection.sendMessage({
        type:            Constants.kCOMMAND_SET_SUBTREE_COLLAPSED_STATE,
        tabId:           livingTab.id,
        collapsed:       !livingTab.$TST.subtreeCollapsed,
        manualOperation: true,
        stack:           configs.debug && new Error().stack
      });
    }
    return;
  }

  if (tab) // ignore dblclick on closing tab or something
    return;

  event.stopPropagation();
  event.preventDefault();
  handleNewTabAction(event, {
    action: configs.autoAttachOnNewTabCommand
  });
}

function onNewTabActionSelect(item, event) {
  if (item.dataset.value) {
    let action;
    switch (item.dataset.value) {
      default:
        action = Constants.kNEWTAB_OPEN_AS_ORPHAN;
        break;
      case 'child':
        action = Constants.kNEWTAB_OPEN_AS_CHILD;
        break;
      case 'sibling':
        action = Constants.kNEWTAB_OPEN_AS_SIBLING;
        break;
      case 'next-sibling':
        action = Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING;
        break;
    }
    handleNewTabAction(event, { action });
  }
  mNewTabActionSelector.ui.close();
}

function onContextualIdentitySelect(item, event) {
  if (item.dataset.value) {
    const action = EventUtils.isAccelAction(event) ?
      configs.autoAttachOnNewTabButtonMiddleClick :
      configs.autoAttachOnNewTabCommand;
    handleNewTabAction(event, {
      action,
      cookieStoreId: item.dataset.value
    });
  }
  mContextualIdentitySelector.ui.close();
}


function onMessage(message, _sender, _respond) {
  if (!message ||
      typeof message.type != 'string' ||
      message.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', message, sender);
  switch (message.type) {
    case TSTAPI.kCOMMAND_BROADCAST_API_REGISTERED:
      wait(0).then(() => { // wait until addons are updated
        updateSpecialEventListenersForAPIListeners();
      });
      break;

    case TSTAPI.kCOMMAND_BROADCAST_API_UNREGISTERED:
      wait(0).then(() => { // wait until addons are updated
        updateSpecialEventListenersForAPIListeners();
      });
      break;
  }
}

function onBackgroundMessage(message) {
  switch (message.type) {
    case Constants.kNOTIFY_TAB_MOUSEDOWN_EXPIRED:
      if (message.windowId == mTargetWindow) {
        const lastMousedown = EventUtils.getLastMousedown(message.button || 0);
        if (lastMousedown)
          lastMousedown.expired = true;
      }
      break;

    case Constants.kCOMMAND_SHOW_CONTAINER_SELECTOR: {
      const anchor = document.querySelector(`
        :root.contextual-identity-selectable .contextual-identities-selector-anchor,
        .newtab-button
      `);
      mContextualIdentitySelector.ui.open({ anchor });
    }; break;
  }
}
