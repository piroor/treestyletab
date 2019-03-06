/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * Portions created by the Initial Developer are Copyright (C) 2011-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import MenuUI from '/extlib/MenuUI.js';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as Tree from '/common/tree.js';
import * as TSTAPI from '/common/tst-api.js';
import * as Commands from '/common/commands.js';
import * as MetricsData from '/common/metrics-data.js';

import Tab from '/common/Tab.js';

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

  MetricsData.add('apply configs');

  browser.runtime.onMessage.addListener(onMessage);

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
      tab:      TSTAPI.serializeTab(tab),
      window:   mTargetWindow,
      windowId: mTargetWindow,
      ctrlKey:  event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey:   event.altKey,
      metaKey:  event.metaKey,
      dragging: DragAndDrop.isCapturingForDragging()
    }).catch(_error => {});
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
      tab:      TSTAPI.serializeTab(tab),
      window:   mTargetWindow,
      windowId: mTargetWindow,
      ctrlKey:  event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey:   event.altKey,
      metaKey:  event.metaKey,
      dragging: DragAndDrop.isCapturingForDragging()
    }).catch(_error => {});
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
      tab:      TSTAPI.serializeTab(tab),
      window:   mTargetWindow,
      windowId: mTargetWindow,
      ctrlKey:  event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey:   event.altKey,
      metaKey:  event.metaKey,
      dragging: DragAndDrop.isCapturingForDragging()
    }).catch(_error => {});
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
    promisedMousedownNotified: Promise.resolve()
  };

  mousedown.promisedMousedownNotified = browser.runtime.sendMessage(Object.assign({}, mousedownDetail, {
    type:     Constants.kNOTIFY_TAB_MOUSEDOWN,
    window:   mTargetWindow,
    windowId: mTargetWindow,
    tabId:    tab && tab.id
  })).catch(ApiTabs.createErrorHandler());

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
      const results = await DragAndDrop.legacyStartMultiDrag(tab, mousedown.detail.closebox);
      if (results.some(result => result.result !== false)) {
        log('onMouseDown expired');
        mousedown.expired = true;
        onMessage({
          type:     Constants.kNOTIFY_TAB_MOUSEDOWN_EXPIRED,
          windowId: mTargetWindow,
          button:   event.button
        });
      }
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
  const tab = EventUtils.getTabFromEvent(event, { force: true }) || EventUtils.getTabFromTabbarEvent(event, { force: true });
  const livingTab = EventUtils.getTabFromEvent(event);
  log('onMouseUp: ', tab, { living: !!livingTab });

  DragAndDrop.endMultiDrag(livingTab, event);

  if (EventUtils.isEventFiredOnMenuOrPanel(event) ||
      EventUtils.isEventFiredOnAnchor(event))
    return;

  const lastMousedown = EventUtils.getLastMousedown(event.button);
  EventUtils.cancelHandleMousedown(event.button);
  if (lastMousedown)
    await lastMousedown.promisedMousedownNotified;

  const serializedTab = livingTab && TSTAPI.serializeTab(livingTab);
  let promisedCanceled = Promise.resolve(false);
  if (serializedTab && lastMousedown) {
    const results = TSTAPI.sendMessage(Object.assign({}, lastMousedown.detail, {
      type:    TSTAPI.kNOTIFY_TAB_MOUSEUP,
      tab:     serializedTab,
      window:  mTargetWindow,
      windowId: mTargetWindow
    }));
    // don't wait here, because we need process following common operations
    // even if this mouseup event is canceled.
    promisedCanceled = results.then(results => results.some(result => result && result.result));
  }

  if (!lastMousedown ||
      lastMousedown.expired ||
      lastMousedown.detail.targetType != getMouseEventTargetType(event) ||
      (livingTab && livingTab != Tab.get(lastMousedown.detail.tab)))
    return;

  log('onMouseUp ', lastMousedown.detail);

  if (await promisedCanceled) {
    log('onMouseUp: canceled / by other addons');
    return;
  }

  if (livingTab) {
    if (lastMousedown.detail.isMiddleClick) { // Ctrl-click doesn't close tab on Firefox's tab bar!
      log('onMouseUp: middle click on a tab');
      //log('middle-click to close');
      const tabs = Tree.getClosingTabsFromParent(livingTab);
      Sidebar.confirmToCloseTabs(tabs.map(tab => tab.id))
        .then(confirmed => {
          if (confirmed)
            TabsInternalOperation.removeTab(livingTab, { inRemote: true });
        });
    }
    else if (lastMousedown.detail.twisty) {
      log('clicked on twisty');
      if (tab.$TST.hasChild)
        Tree.collapseExpandSubtree(tab, {
          collapsed:       !tab.$TST.subtreeCollapsed,
          manualOperation: true,
          inRemote:        true
        });
    }
    else if (lastMousedown.detail.soundButton) {
      log('clicked on sound button');
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SET_SUBTREE_MUTED,
        windowId: mTargetWindow,
        tabId:    tab.id,
        muted:    tab.$TST.maybeSoundPlaying
      }).catch(ApiTabs.createErrorSuppressor());
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
        Tree.getClosingTabsFromParent(tab) ;
      Sidebar.confirmToCloseTabs(tabsToBeClosed.map(tab => tab.id))
        .then(confirmed => {
          if (!confirmed)
            return;
          if (multiselected)
            TabsInternalOperation.removeTabs(tabsToBeClosed, { inRemote: true });
          else
            TabsInternalOperation.removeTab(tab, { inRemote: true });
        });
    }
    else if (lastMousedown.detail.button == 0 &&
             !lastMousedown.detail.altKey &&
             !lastMousedown.detail.ctrlKey &&
             !lastMousedown.detail.metaKey &&
             !lastMousedown.detail.shiftKey &&
             typeof browser.tabs.highlight == 'function') {
      // clear selection by left click
      browser.tabs.highlight({
        windowId: tab.windowId,
        tabs:     [tab.index],
        populate: false
      }).catch(ApiTabs.createErrorSuppressor());
    }
    return;
  }
  else if (tab) // ignore mouseup on closing tab or something
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
    type:   TSTAPI.kNOTIFY_TABBAR_MOUSEUP,
    window: mTargetWindow,
    windowId: mTargetWindow
  }));
  results = results.concat(await TSTAPI.sendMessage(Object.assign({}, lastMousedown.detail, {
    type:   TSTAPI.kNOTIFY_TABBAR_CLICKED,
    window: mTargetWindow,
    windowId: mTargetWindow
  })));
  if (results.some(result => result.result))// canceled
    return;

  if (lastMousedown.detail.isMiddleClick) { // Ctrl-click does nothing on Firefox's tab bar!
    log('onMouseUp: default action for middle click on the blank area');
    handleNewTabAction(event, {
      action: configs.autoAttachOnNewTabCommand
    });
  }
}
onMouseUp = EventUtils.wrapWithErrorHandler(onMouseUp);

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

  Commands.openNewTabAs({
    baseTab:       TabsStore.activeTabInWindow.get(mTargetWindow),
    as:            options.action,
    cookieStoreId: options.cookieStoreId,
    inBackground:  event.shiftKey,
    inRemote:      true
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
      TabsInternalOperation.removeTab(livingTab, { inRemote: true });
    }
    else if (configs.collapseExpandSubtreeByDblClick) {
      event.stopPropagation();
      event.preventDefault();
      Tree.collapseExpandSubtree(livingTab, {
        collapsed:       !livingTab.$TST.subtreeCollapsed,
        manualOperation: true,
        inRemote:        true
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
    case Constants.kNOTIFY_TAB_MOUSEDOWN_CANCELED:
      if (message.windowId == mTargetWindow)
        EventUtils.cancelHandleMousedown(message.button || 0);
      break;

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
