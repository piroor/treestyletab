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

import MenuUI from '../extlib/MenuUI.js';

import {
  log,
  dumpTab,
  wait,
  nextFrame,
  configs
} from '../common/common.js';
import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as TabsInternalOperation from '../common/tabs-internal-operation.js';
import * as TabsUpdate from '../common/tabs-update.js';
import * as TabsMove from '../common/tabs-move.js';
import * as Tree from '../common/tree.js';
import * as TSTAPI from '../common/tst-api.js';
import * as Commands from '../common/commands.js';
import * as UserOperationBlocker from '../common/user-operation-blocker.js';
import * as MetricsData from '../common/metrics-data.js';
import EventListenerManager from '../common/EventListenerManager.js';

import * as Sidebar from './sidebar.js';
import * as SidebarCache from './sidebar-cache.js';
import * as SidebarTabs from './sidebar-tabs.js';
import * as EventUtils from './event-utils.js';
import * as DragAndDrop from './drag-and-drop.js';
import * as RestoringTabCount from './restoring-tab-count.js';
import * as Indent from './indent.js';
import * as Scroll from './scroll.js';
import * as TabContextMenu from './tab-context-menu.js';

let gTargetWindow;

const gTabBar = document.querySelector('#tabbar');
const gContextualIdentitySelector = document.getElementById(Constants.kCONTEXTUAL_IDENTITY_SELECTOR);
const gNewTabActionSelector       = document.getElementById(Constants.kNEWTAB_ACTION_SELECTOR);

const gUpdatingCollapsedStateCancellers = new WeakMap();
const gTabCollapsedStateChangedManagers = new WeakMap();

Sidebar.onInit.addListener(() => {
  gTargetWindow = Tabs.getWindow();
});

Sidebar.onBuilt.addListener(async () => {
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('click', onClick);
  document.addEventListener('focus', onFocus);
  document.addEventListener('blur', onBlur);
  gTabBar.addEventListener('dblclick', onDblClick);
  gTabBar.addEventListener('overflow', onOverflow);
  gTabBar.addEventListener('underflow', onUnderflow);

  MetricsData.add('apply configs');

  browser.runtime.onMessage.addListener(onMessage);

  gContextualIdentitySelector.ui = new MenuUI({
    root:       gContextualIdentitySelector,
    appearance: 'panel',
    onCommand:  onContextualIdentitySelect,
    animationDuration: configs.animation ? configs.collapseDuration : 0.001
  });

  gNewTabActionSelector.ui = new MenuUI({
    root:       gNewTabActionSelector,
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

  if ((TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_MOUSEOVER) > 0) != onMouseOver.listening) {
    if (!onMouseOver.listening) {
      window.addEventListener('mouseover', onMouseOver, { capture: true, passive: true });
      onMouseOver.listening = true;
    }
    else {
      window.removeEventListener('mouseover', onMouseOver, { capture: true, passive: true });
      onMouseOver.listening = false;
    }
  }

  if ((TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_MOUSEOUT) > 0) != onMouseOut.listening) {
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

function onFocus(_aEvent) {
  browser.runtime.sendMessage({
    type:     Constants.kNOTIFY_SIDEBAR_FOCUS,
    windowId: gTargetWindow
  });
}

function onBlur(_aEvent) {
  browser.runtime.sendMessage({
    type:     Constants.kNOTIFY_SIDEBAR_BLUR,
    windowId: gTargetWindow
  });
}

function onMouseMove(aEvent) {
  const tab = EventUtils.getTabFromEvent(aEvent);
  if (tab) {
    TSTAPI.sendMessage({
      type:     TSTAPI.kNOTIFY_TAB_MOUSEMOVE,
      tab:      TSTAPI.serializeTab(tab),
      window:   gTargetWindow,
      ctrlKey:  aEvent.ctrlKey,
      shiftKey: aEvent.shiftKey,
      altKey:   aEvent.altKey,
      metaKey:  aEvent.metaKey,
      dragging: DragAndDrop.isCapturingForDragging()
    });
  }
}

function onMouseOver(aEvent) {
  const tab = EventUtils.getTabFromEvent(aEvent);
  if (tab && onMouseOver.lastTarget != tab.id) {
    TSTAPI.sendMessage({
      type:     TSTAPI.kNOTIFY_TAB_MOUSEOVER,
      tab:      TSTAPI.serializeTab(tab),
      window:   gTargetWindow,
      ctrlKey:  aEvent.ctrlKey,
      shiftKey: aEvent.shiftKey,
      altKey:   aEvent.altKey,
      metaKey:  aEvent.metaKey,
      dragging: DragAndDrop.isCapturingForDragging()
    });
  }
  onMouseOver.lastTarget = tab && tab.id;
}

function onMouseOut(aEvent) {
  const tab = EventUtils.getTabFromEvent(aEvent);
  if (tab && onMouseOut.lastTarget != tab.id) {
    TSTAPI.sendMessage({
      type:     TSTAPI.kNOTIFY_TAB_MOUSEOUT,
      tab:      TSTAPI.serializeTab(tab),
      window:   gTargetWindow,
      ctrlKey:  aEvent.ctrlKey,
      shiftKey: aEvent.shiftKey,
      altKey:   aEvent.altKey,
      metaKey:  aEvent.metaKey,
      dragging: DragAndDrop.isCapturingForDragging()
    });
  }
  onMouseOut.lastTarget = tab && tab.id;
}

function onMouseDown(aEvent) {
  EventUtils.cancelHandleMousedown(aEvent.button);
  TabContextMenu.close();
  DragAndDrop.clearDropPosition();
  DragAndDrop.clearDraggingState();

  if (EventUtils.isEventFiredOnAnchor(aEvent) &&
      !EventUtils.isAccelAction(aEvent) &&
      aEvent.button != 2) {
    if (configs.logOnMouseEvent)
      log('mouse down on a selector anchor');
    aEvent.stopPropagation();
    aEvent.preventDefault();
    const selector = document.getElementById(EventUtils.getElementTarget(aEvent).closest('[data-menu-ui]').dataset.menuUi);
    selector.ui.open({
      anchor: aEvent.target
    });
    return;
  }

  const target = aEvent.target;
  const tab = EventUtils.getTabFromEvent(aEvent) || EventUtils.getTabFromTabbarEvent(aEvent);
  if (configs.logOnMouseEvent)
    log('onMouseDown: found target tab: ', tab);

  const mousedownDetail = {
    targetType:    getMouseEventTargetType(aEvent),
    tab:           tab && tab.id,
    closebox:      EventUtils.isEventFiredOnClosebox(aEvent),
    button:        aEvent.button,
    ctrlKey:       aEvent.ctrlKey,
    shiftKey:      aEvent.shiftKey,
    altKey:        aEvent.altKey,
    metaKey:       aEvent.metaKey,
    isMiddleClick: EventUtils.isMiddleClick(aEvent),
    isAccelClick:  EventUtils.isAccelAction(aEvent)
  };
  if (configs.logOnMouseEvent)
    log('onMouseDown ', mousedownDetail);

  if (mousedownDetail.targetType == 'selector')
    return;

  if (mousedownDetail.isMiddleClick) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
  }

  const mousedown = {
    detail: mousedownDetail,
    promisedMousedownNotified: Promise.resolve()
  };

  if ((!EventUtils.isEventFiredOnTwisty(aEvent) &&
       !EventUtils.isEventFiredOnSoundButton(aEvent) &&
       !EventUtils.isEventFiredOnClosebox(aEvent)) ||
      aEvent.button != 0)
    mousedown.promisedMousedownNotified = browser.runtime.sendMessage(Object.assign({}, mousedownDetail, {
      type:     Constants.kNOTIFY_TAB_MOUSEDOWN,
      windowId: gTargetWindow
    }));

  EventUtils.setLastMousedown(aEvent.button, mousedown);
  mousedown.timeout = setTimeout(() => {
    if (!EventUtils.getLastMousedown(aEvent.button))
      return;

    if (aEvent.button == 0 &&
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

    if (TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_DRAGREADY).length == 0)
      return;

    if (configs.logOnMouseEvent)
      log('onMouseDown expired');
    mousedown.expired = true;
    if (aEvent.button == 0) {
      if (tab) {
        DragAndDrop.startMultiDrag(tab, mousedown.detail.closebox);
      }
    }
  }, configs.startDragTimeout);
}

function getMouseEventTargetType(aEvent) {
  if (EventUtils.getTabFromEvent(aEvent))
    return 'tab';

  if (EventUtils.isEventFiredOnNewTabButton(aEvent))
    return 'newtabbutton';

  if (EventUtils.isEventFiredOnMenuOrPanel(aEvent) ||
      EventUtils.isEventFiredOnAnchor(aEvent))
    return 'selector';

  const allRange = document.createRange();
  allRange.selectNodeContents(document.body);
  const containerRect = allRange.getBoundingClientRect();
  allRange.detach();
  if (aEvent.clientX < containerRect.left ||
      aEvent.clientX > containerRect.right ||
      aEvent.clientY < containerRect.top ||
      aEvent.clientY > containerRect.bottom)
    return 'outside';

  return 'blank';
}

async function onMouseUp(aEvent) {
  const tab = EventUtils.getTabFromEvent(aEvent);
  const lastMousedown = EventUtils.getLastMousedown(aEvent.button);
  EventUtils.cancelHandleMousedown(aEvent.button);
  if (lastMousedown)
    await lastMousedown.promisedMousedownNotified;

  const serializedTab = tab && TSTAPI.serializeTab(tab);
  let promisedCanceled = Promise.resolve(false);
  if (serializedTab && lastMousedown) {
    const results = TSTAPI.sendMessage(Object.assign({}, lastMousedown.detail, {
      type:    TSTAPI.kNOTIFY_TAB_MOUSEUP,
      tab:     serializedTab,
      window:  gTargetWindow
    }));
    // don't wait here, because we need process following common operations
    // even if this mouseup event is canceled.
    promisedCanceled = results.then(aResults => aResults.some(aResult => aResult.result));
  }

  DragAndDrop.endMultiDrag(tab, aEvent);

  if (!lastMousedown ||
      lastMousedown.detail.targetType != getMouseEventTargetType(aEvent) ||
      (tab && tab != Tabs.getTabById(lastMousedown.detail.tab)))
    return;

  if (configs.logOnMouseEvent)
    log('onMouseUp ', lastMousedown.detail);

  if (await promisedCanceled) {
    if (configs.logOnMouseEvent)
      log('mouseup is canceled by other addons');
    return;
  }

  if (tab) {
    if (lastMousedown.detail.isMiddleClick) { // Ctrl-click doesn't close tab on Firefox's tab bar!
      if (configs.logOnMouseEvent)
        log('middle click on a tab');
      //log('middle-click to close');
      Sidebar.confirmToCloseTabs(Tree.getClosingTabsFromParent(tab).length)
        .then(aConfirmed => {
          if (aConfirmed)
            TabsInternalOperation.removeTab(tab, { inRemote: true });
        });
    }
    return;
  }

  // following codes are for handlig of click event on the tab bar itself.
  const actionForNewTabCommand = lastMousedown.detail.isAccelClick ?
    configs.autoAttachOnNewTabButtonMiddleClick :
    configs.autoAttachOnNewTabCommand;
  if (EventUtils.isEventFiredOnNewTabButton(aEvent) &&
      lastMousedown.detail.button != 2) {
    if (configs.logOnMouseEvent)
      log('click on the new tab button');
    handleNewTabAction(aEvent, {
      action: actionForNewTabCommand
    });
    return;
  }

  if (configs.logOnMouseEvent)
    log('notify as a blank area click to other addons');
  let results = await TSTAPI.sendMessage(Object.assign({}, lastMousedown.detail, {
    type:   TSTAPI.kNOTIFY_TABBAR_MOUSEUP,
    window: gTargetWindow,
  }));
  results = results.concat(await TSTAPI.sendMessage(Object.assign({}, lastMousedown.detail, {
    type:   TSTAPI.kNOTIFY_TABBAR_CLICKED,
    window: gTargetWindow,
  })));
  if (results.some(aResult => aResult.result))// canceled
    return;

  if (lastMousedown.detail.isMiddleClick) { // Ctrl-click does nothing on Firefox's tab bar!
    if (configs.logOnMouseEvent)
      log('default action for middle click on the blank area');
    handleNewTabAction(aEvent, {
      action: configs.autoAttachOnNewTabCommand
    });
  }
}

function onClick(aEvent) {
  // clear unexpectedly left "dragging" state
  // (see also https://github.com/piroor/treestyletab/issues/1921 )
  DragAndDrop.clearDraggingTabsState();

  if (aEvent.button != 0) // ignore non-left click
    return;

  if (configs.logOnMouseEvent)
    log('onClick', String(aEvent.target));

  if (EventUtils.isEventFiredOnMenuOrPanel(aEvent) ||
      EventUtils.isEventFiredOnAnchor(aEvent))
    return;

  if (EventUtils.isEventFiredOnNewTabButton(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    return;
  }

  const tab = EventUtils.getTabFromEvent(aEvent);
  if (configs.logOnMouseEvent)
    log('clicked tab: ', tab);

  if (EventUtils.isEventFiredOnTwisty(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (configs.logOnMouseEvent)
      log('clicked on twisty');
    if (Tabs.hasChildTabs(tab))
      Tree.collapseExpandSubtree(tab, {
        collapsed:       !Tabs.isSubtreeCollapsed(tab),
        manualOperation: true,
        inRemote:        true
      });
    return;
  }

  if (EventUtils.isEventFiredOnSoundButton(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (configs.logOnMouseEvent)
      log('clicked on sound button');
    browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_SET_SUBTREE_MUTED,
      windowId: gTargetWindow,
      tab:      tab.id,
      muted:    Tabs.maybeSoundPlaying(tab)
    });
    return;
  }

  if (EventUtils.isEventFiredOnClosebox(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (configs.logOnMouseEvent)
      log('clicked on closebox');
    //if (!warnAboutClosingTabSubtreeOf(tab)) {
    //  aEvent.stopPropagation();
    //  aEvent.preventDefault();
    //  return;
    //}
    Sidebar.confirmToCloseTabs(Tree.getClosingTabsFromParent(tab).length)
      .then(aConfirmed => {
        if (aConfirmed)
          TabsInternalOperation.removeTab(tab, { inRemote: true });
      });
    return;
  }
}

function handleNewTabAction(aEvent, aOptions = {}) {
  if (configs.logOnMouseEvent)
    log('handleNewTabAction');

  if (!configs.autoAttach && !('action' in aOptions))
    aOptions.action = Constants.kNEWTAB_DO_NOTHING;

  Commands.openNewTabAs({
    baseTab:      Tabs.getCurrentTab(gTargetWindow),
    as:           aOptions.action,
    cookieStoreId: aOptions.cookieStoreId,
    inBackground: aEvent.shiftKey,
    inRemote:     true
  });
}

function onDblClick(aEvent) {
  if (EventUtils.isEventFiredOnNewTabButton(aEvent))
    return;

  const tab = EventUtils.getTabFromEvent(aEvent);
  if (tab) {
    if (configs.collapseExpandSubtreeByDblClick) {
      aEvent.stopPropagation();
      aEvent.preventDefault();
      Tree.collapseExpandSubtree(tab, {
        collapsed:       !Tabs.isSubtreeCollapsed(tab),
        manualOperation: true,
        inRemote:        true
      });
    }
    return;
  }

  aEvent.stopPropagation();
  aEvent.preventDefault();
  handleNewTabAction(aEvent, {
    action: configs.autoAttachOnNewTabCommand
  });
}

function onNewTabActionSelect(aItem, aEvent) {
  if (aItem.dataset.value) {
    let action;
    switch (aItem.dataset.value) {
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
    handleNewTabAction(aEvent, { action });
  }
  gNewTabActionSelector.ui.close();
}

function onContextualIdentitySelect(aItem, aEvent) {
  if (aItem.dataset.value) {
    const action = EventUtils.isAccelAction(aEvent) ?
      configs.autoAttachOnNewTabButtonMiddleClick :
      configs.autoAttachOnNewTabCommand;
    handleNewTabAction(aEvent, {
      action,
      cookieStoreId: aItem.dataset.value
    });
  }
  gContextualIdentitySelector.ui.close();
}

function onOverflow(aEvent) {
  const tab = Tabs.getTabFromChild(aEvent.target);
  const label = Tabs.getTabLabel(tab);
  if (aEvent.target == label && !Tabs.isPinned(tab)) {
    label.classList.add('overflow');
    SidebarTabs.reserveToUpdateTooltip(tab);
  }
}

function onUnderflow(aEvent) {
  const tab = Tabs.getTabFromChild(aEvent.target);
  const label = Tabs.getTabLabel(tab);
  if (aEvent.target == label && !Tabs.isPinned(tab)) {
    label.classList.remove('overflow');
    SidebarTabs.reserveToUpdateTooltip(tab);
  }
}


/* raw event handlers */

Tabs.onRestoring.addListener(aTab => {
  if (!configs.useCachedTree) // we cannot know when we should unblock on no cache case...
    return;

  const container = aTab.parentNode;
  // When we are restoring two or more tabs.
  // (But we don't need do this again for third, fourth, and later tabs.)
  if (container.restoredCount == 2)
    UserOperationBlocker.block({ throbber: true });
});

// Tree restoration for "Restore Previous Session"
Tabs.onWindowRestoring.addListener(async aWindowId => {
  if (!configs.useCachedTree)
    return;

  log('Tabs.onWindowRestoring');
  const container = Tabs.getTabsContainer(aWindowId);
  const restoredCount = await container.allTabsRestored;
  if (restoredCount == 1) {
    log('Tabs.onWindowRestoring: single tab restored');
    UserOperationBlocker.unblock({ throbber: true });
    return;
  }

  log('Tabs.onWindowRestoring: continue');
  const cache = await SidebarCache.getEffectiveWindowCache({
    ignorePinnedTabs: true
  });
  if (!cache ||
      (cache.offset &&
       container.childNodes.length <= cache.offset)) {
    log('Tabs.onWindowRestoring: no effective cache');
    await Sidebar.inheritTreeStructure(); // fallback to classic method
    UserOperationBlocker.unblock({ throbber: true });
    return;
  }

  log('Tabs.onWindowRestoring restore! ', cache);
  MetricsData.add('Tabs.onWindowRestoring restore start');
  cache.tabbar.tabsDirty = true;
  const apiTabs = await browser.tabs.query({ windowId: aWindowId });
  const restored = await SidebarCache.restoreTabsFromCache(cache.tabbar, {
    offset: cache.offset || 0,
    tabs:   apiTabs
  });
  if (!restored) {
    await Sidebar.rebuildAll();
    await Sidebar.inheritTreeStructure();
  }
  Sidebar.updateVisualMaxTreeLevel();
  Indent.update({
    force: true,
    cache: restored && cache.offset == 0 ? cache.indent : null
  });
  Sidebar.updateTabbarLayout({ justNow: true });
  UserOperationBlocker.unblock({ throbber: true });
  MetricsData.add('Tabs.onWindowRestoring restore end');
});

Tabs.onRemoving.addListener((aTab, aCloseInfo) => {
  const closeParentBehavior = Tree.getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aCloseInfo);
  if (closeParentBehavior != Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
      Tabs.isSubtreeCollapsed(aTab))
    Tree.collapseExpandSubtree(aTab, {
      collapsed: false
    });

  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  Tree.detachTab(aTab, {
    dontUpdateIndent: true
  });
});

Tabs.onRemoved.addListener(async aTab => {
  gUpdatingCollapsedStateCancellers.delete(aTab);
  gTabCollapsedStateChangedManagers.delete(aTab);

  if (Tabs.isCollapsed(aTab) ||
      !configs.animation)
    return;

  return new Promise(async (aResolve, _aReject) => {
    const tabRect = aTab.getBoundingClientRect();
    aTab.style.marginLeft = `${tabRect.width}px`;
    await wait(configs.animation ? configs.collapseDuration : 0);
    aResolve();
  });
});

Tabs.onMoving.addListener(async aTab => {
  if (!configs.animation ||
      Tabs.isPinned(aTab) ||
      Tabs.isOpening(aTab))
    return;
  aTab.classList.add(Constants.kTAB_STATE_MOVING);
  const visible = !Tabs.isCollapsed(aTab);
  Tree.collapseExpandTab(aTab, {
    collapsed: true,
    justNow:   true
  });
  nextFrame().then(async () => {
    if (!Tabs.ensureLivingTab(aTab)) // it was removed while waiting
      return;
    if (visible)
      Tree.collapseExpandTab(aTab, {
        collapsed: false
      });
    await wait(configs.collapseDuration);
    aTab.classList.remove(Constants.kTAB_STATE_MOVING);
  });
});

Tabs.onDetached.addListener(aTab => {
  if (!Tabs.ensureLivingTab(aTab))
    return;
  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  Tree.detachTab(aTab, {
    dontUpdateIndent: true
  });
});


Tabs.onCollapsedStateChanging.addListener(async (aTab, aInfo = {}) => {
  const toBeCollapsed = aInfo.collapsed;

  if (configs.logOnCollapseExpand)
    log('Tabs.onCollapsedStateChanging ', dumpTab(aTab), aInfo);
  if (!Tabs.ensureLivingTab(aTab)) // do nothing for closed tab!
    return;

  SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

  if (aTab.onEndCollapseExpandAnimation) {
    clearTimeout(aTab.onEndCollapseExpandAnimation.timeout);
    delete aTab.onEndCollapseExpandAnimation;
  }

  if (aTab.apiTab.status == 'loading')
    aTab.classList.add(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  if (aInfo.anchor && !Scroll.isTabInViewport(aInfo.anchor))
    aInfo.anchor = null;

  const reason = toBeCollapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;

  let manager = gTabCollapsedStateChangedManagers.get(aTab);
  if (!manager) {
    manager = new EventListenerManager();
    gTabCollapsedStateChangedManagers.set(aTab, manager);
  }

  if (gUpdatingCollapsedStateCancellers.has(aTab)) {
    gUpdatingCollapsedStateCancellers.get(aTab)();
    gUpdatingCollapsedStateCancellers.delete(aTab);
    aTab.classList.remove(Constants.kTAB_STATE_COLLAPSING);
    aTab.classList.remove(Constants.kTAB_STATE_EXPANDING);
    manager.removeAllListeners();
  }

  let cancelled = false;
  const canceller = () => {
    cancelled = true;
  };
  const onCompleted = (aTab, aInfo = {}) => {
    manager.removeListener(onCompleted);
    if (cancelled ||
        !Tabs.ensureLivingTab(aTab)) // do nothing for closed tab!
      return;

    gUpdatingCollapsedStateCancellers.delete(aTab);

    const toBeCollapsed = aInfo.collapsed;
    SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

    if (configs.animation &&
        !aInfo.justNow &&
        configs.collapseDuration > 0)
      return; // animation

    //log('=> skip animation');
    if (toBeCollapsed)
      aTab.classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
    else
      aTab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);

    const reason = toBeCollapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;
    onEndCollapseExpandCompletely(aTab, {
      collapsed: toBeCollapsed,
      reason
    });

    if (aInfo.last)
      Scroll.scrollToTab(aTab, {
        anchor:            aInfo.anchor,
        notifyOnOutOfView: true
      });
  };
  manager.addListener(onCompleted);

  if (!configs.animation ||
      aInfo.justNow ||
      configs.collapseDuration < 1) {
    //log('=> skip animation');
    return;
  }

  gUpdatingCollapsedStateCancellers.set(aTab, canceller);

  if (toBeCollapsed) {
    aTab.classList.add(Constants.kTAB_STATE_COLLAPSING);
  }
  else {
    aTab.classList.add(Constants.kTAB_STATE_EXPANDING);
    aTab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);
  }

  Sidebar.reserveToUpdateTabbarLayout({ reason });

  nextFrame().then(() => {
    if (cancelled ||
        !Tabs.ensureLivingTab(aTab)) { // it was removed while waiting
      return;
    }

    //log('start animation for ', dumpTab(aTab));
    if (aInfo.last)
      Scroll.scrollToTab(aTab, {
        anchor:            aInfo.anchor,
        notifyOnOutOfView: true
      });

    aTab.onEndCollapseExpandAnimation = (() => {
      if (cancelled)
        return;

      //log('=> finish animation for ', dumpTab(aTab));
      aTab.classList.remove(Constants.kTAB_STATE_COLLAPSING);
      aTab.classList.remove(Constants.kTAB_STATE_EXPANDING);

      // The collapsed state of the tab can be changed by different trigger,
      // so we must respect the actual status of the tab, instead of the
      // "expected status" given via arguments.
      if (aTab.classList.contains(Constants.kTAB_STATE_COLLAPSED))
        aTab.classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
      else
        aTab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);

      onEndCollapseExpandCompletely(aTab, {
        collapsed: toBeCollapsed,
        reason
      });
    });
    aTab.onEndCollapseExpandAnimation.timeout = setTimeout(() => {
      if (cancelled ||
          !Tabs.ensureLivingTab(aTab) ||
          !aTab.onEndCollapseExpandAnimation) {
        return;
      }
      delete aTab.onEndCollapseExpandAnimation.timeout;
      aTab.onEndCollapseExpandAnimation();
      delete aTab.onEndCollapseExpandAnimation;
    }, configs.collapseDuration);
  });
});
function onEndCollapseExpandCompletely(aTab, aOptions = {}) {
  if (Tabs.isActive(aTab) && !aOptions.collapsed)
    Scroll.scrollToTab(aTab);

  if (configs.indentAutoShrink &&
      configs.indentAutoShrinkOnlyForVisible)
    Sidebar.reserveToUpdateVisualMaxTreeLevel();

  // this is very required for no animation case!
  Sidebar.reserveToUpdateTabbarLayout({ reason: aOptions.reason });
  SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

Tabs.onCollapsedStateChanged.addListener((aTab, aInfo = {}) => {
  const manager = gTabCollapsedStateChangedManagers.get(aTab);
  if (manager)
    manager.dispatch(aTab, aInfo);
});

/*
function onTabSubtreeCollapsedStateChangedManually(aEvent) {
  if (!configs.indentAutoShrink ||
      !configs.indentAutoShrinkOnlyForVisible)
    return;

  cancelCheckTabsIndentOverflow();
  if (!aTab.checkTabsIndentOverflowOnMouseLeave) {
    let stillOver = false;
    let id = aTab.id
    aTab.checkTabsIndentOverflowOnMouseLeave = function checkTabsIndentOverflowOnMouseLeave(aEvent, aDelayed) {
      if (aEvent.type == 'mouseover') {
        let node = EventUtils.getElementTarget(aEvent);
        if (node.closest(`#${id}`))
            stillOver = true;
          return;
        }
        else if (!aDelayed) {
          if (stillOver) {
            stillOver = false;
          }
          setTimeout(() => {
            if (!Tabs.ensureLivingTab(aTab)) // it was removed while waiting
              return;
            aTab.checkTabsIndentOverflowOnMouseLeave(aEvent, true);
          }, 0);
          return;
        } else if (stillOver) {
          return;
        }
        let x = aEvent.clientX;
        let y = aEvent.clientY;
        let rect = aTab.getBoundingClientRect();
        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom)
          return;
        document.removeEventListener('mouseover', aTab.checkTabsIndentOverflowOnMouseLeave, true);
        document.removeEventListener('mouseout', aTab.checkTabsIndentOverflowOnMouseLeave, true);
        delete aTab.checkTabsIndentOverflowOnMouseLeave;
        checkTabsIndentOverflow();
      };
      document.addEventListener('mouseover', aTab.checkTabsIndentOverflowOnMouseLeave, true);
      document.addEventListener('mouseout', aTab.checkTabsIndentOverflowOnMouseLeave, true);
    }
  }
}
*/

Tabs.onGroupTabDetected.addListener(aTab => {
  // When a group tab is restored but pending, TST cannot update title of the tab itself.
  // For failsafe now we update the title based on its URL.
  const uri = aTab.apiTab.url;
  const parameters = uri.replace(/^[^\?]+/, '');
  let title = parameters.match(/[&?]title=([^&;]*)/);
  if (!title)
    title = parameters.match(/^\?([^&;]*)/);
  title = title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab_label_default');
  aTab.apiTab.title = title;
  wait(0).then(() => {
    TabsUpdate.updateTab(aTab, { title }, { tab: aTab.apiTab });
  });
});


/* message observer */

const gTreeChangesFromRemote = new Set();
function waitUntilAllTreeChangesFromRemoteAreComplete() {
  return Promise.all(Array.from(gTreeChangesFromRemote.values()));
}

function onMessage(aMessage, _aSender, _aRespond) {
  if (!aMessage ||
      typeof aMessage.type != 'string' ||
      aMessage.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case Constants.kCOMMAND_PING_TO_SIDEBAR: {
      if (aMessage.windowId == gTargetWindow)
        return Promise.resolve(true);
    }; break;

    case Constants.kCOMMAND_PUSH_TREE_STRUCTURE:
      if (aMessage.windowId == gTargetWindow)
        Tree.applyTreeStructureToTabs(Tabs.getAllTabs(gTargetWindow), aMessage.structure);
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORING:
      RestoringTabCount.increment();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORED:
      RestoringTabCount.decrement();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED:
      Tabs.onFaviconUpdated.dispatch(Tabs.getTabById(aMessage.tab), aMessage.favIconUrl);
      break;

    case Constants.kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE: {
      if (aMessage.windowId == gTargetWindow) return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        const params = {
          collapsed: aMessage.collapsed,
          justNow:   aMessage.justNow,
          stack:     aMessage.stack
        };
        if (aMessage.manualOperation)
          Tree.manualCollapseExpandSubtree(tab, params);
        else
          Tree.collapseExpandSubtree(tab, params);
      })();
    }; break;

    case Constants.kCOMMAND_CHANGE_TAB_COLLAPSED_STATE: {
      if (aMessage.windowId == gTargetWindow) return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tab);
        const tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        // Tree's collapsed state can be changed before this message is delivered,
        // so we should ignore obsolete messages.
        if (aMessage.byAncestor &&
            aMessage.collapsed != Tabs.getAncestorTabs(tab).some(Tabs.isSubtreeCollapsed))
          return;
        const params = {
          collapsed:   aMessage.collapsed,
          justNow:     aMessage.justNow,
          broadcasted: true,
          stack:       aMessage.stack
        };
        Tree.collapseExpandTab(tab, params);
      })();
    }; break;

    case Constants.kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.nextTab]));
        return TabsMove.moveTabsBefore(
          aMessage.tabs.map(Tabs.getTabById),
          Tabs.getTabById(aMessage.nextTab),
          aMessage
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case Constants.kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.previousTab]));
        return TabsMove.moveTabsAfter(
          aMessage.tabs.map(Tabs.getTabById),
          Tabs.getTabById(aMessage.previousTab),
          aMessage
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case Constants.kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs);
        return TabsInternalOperation.removeTabs(aMessage.tabs.map(Tabs.getTabById), aMessage.options);
      })();

    case Constants.kCOMMAND_ATTACH_TAB_TO: {
      if (aMessage.windowId == gTargetWindow) {
        const promisedComplete = (async () => {
          await Promise.all([
            Tabs.waitUntilTabsAreCreated([
              aMessage.child,
              aMessage.parent,
              aMessage.insertBefore,
              aMessage.insertAfter
            ]),
            waitUntilAllTreeChangesFromRemoteAreComplete()
          ]);
          log('attach tab from remote ', aMessage);
          const child  = Tabs.getTabById(aMessage.child);
          const parent = Tabs.getTabById(aMessage.parent);
          if (child && parent)
            await Tree.attachTabTo(child, parent, Object.assign({}, aMessage, {
              insertBefore: Tabs.getTabById(aMessage.insertBefore),
              insertAfter:  Tabs.getTabById(aMessage.insertAfter),
              inRemote:     false,
              broadcast:    false
            }));
          gTreeChangesFromRemote.delete(promisedComplete);
        })();
        gTreeChangesFromRemote.add(promisedComplete);
        return promisedComplete;
      }
    }; break;

    case Constants.kCOMMAND_DETACH_TAB: {
      if (aMessage.windowId == gTargetWindow) {
        const promisedComplete = (async () => {
          await Promise.all([
            Tabs.waitUntilTabsAreCreated(aMessage.tab),
            waitUntilAllTreeChangesFromRemoteAreComplete()
          ]);
          const tab = Tabs.getTabById(aMessage.tab);
          if (tab)
            Tree.detachTab(tab, aMessage);
          gTreeChangesFromRemote.delete(promisedComplete);
        })();
        gTreeChangesFromRemote.add(promisedComplete);
        return promisedComplete;
      }
    }; break;

    case Constants.kCOMMAND_BLOCK_USER_OPERATIONS: {
      if (aMessage.windowId == gTargetWindow)
        UserOperationBlocker.blockIn(gTargetWindow, aMessage);
    }; break;

    case Constants.kCOMMAND_UNBLOCK_USER_OPERATIONS: {
      if (aMessage.windowId == gTargetWindow)
        UserOperationBlocker.unblockIn(gTargetWindow, aMessage);
    }; break;

    case Constants.kCOMMAND_BROADCAST_TAB_STATE: {
      if (!aMessage.tabs.length)
        break;
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(aMessage.tabs);
        const add    = aMessage.add || [];
        const remove = aMessage.remove || [];
        log('apply broadcasted tab state ', aMessage.tabs, {
          add:    add.join(','),
          remove: remove.join(',')
        });
        const modified = add.concat(remove);
        for (let tab of aMessage.tabs) {
          tab = Tabs.getTabById(tab);
          if (!tab)
            continue;
          add.forEach(aState => tab.classList.add(aState));
          remove.forEach(aState => tab.classList.remove(aState));
          if (modified.includes(Constants.kTAB_STATE_AUDIBLE) ||
            modified.includes(Constants.kTAB_STATE_SOUND_PLAYING) ||
            modified.includes(Constants.kTAB_STATE_MUTED)) {
            SidebarTabs.updateSoundButtonTooltip(tab);
            if (aMessage.bubbles)
              TabsUpdate.updateParentTab(Tabs.getParentTab(tab));
          }
        }
      })();
    }; break;

    case Constants.kCOMMAND_CONFIRM_TO_CLOSE_TABS: {
      if (aMessage.windowId == gTargetWindow)
        return Sidebar.confirmToCloseTabs(aMessage.count);
    }; break;

    case Constants.kCOMMAND_BROADCAST_CURRENT_DRAG_DATA:
      DragAndDrop.setDragData(aMessage.dragData || null);
      break;

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

    case Constants.kCOMMAND_SHOW_CONTAINER_SELECTOR: {
      const anchor = document.querySelector(`
        :root.contextual-identity-selectable .contextual-identities-selector-anchor,
        .newtab-button
      `);
      gContextualIdentitySelector.ui.open({ anchor });
    }; break;
  }
}
