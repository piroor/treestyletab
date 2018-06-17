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
  log as internalLogger,
  wait,
  configs
} from '../common/common.js';
import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as TabsInternalOperation from '../common/tabs-internal-operation.js';
import * as Tree from '../common/tree.js';
import * as TSTAPI from '../common/tst-api.js';
import * as Commands from '../common/commands.js';
import * as MetricsData from '../common/metrics-data.js';

import * as Sidebar from './sidebar.js';
import * as EventUtils from './event-utils.js';
import * as DragAndDrop from './drag-and-drop.js';
import * as TabContextMenu from './tab-context-menu.js';

function log(...aArgs) {
  if (configs.logFor['sidebar/mouse-event-listener'] || configs.logOnMouseEvent)
    internalLogger(...aArgs);
}

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
  gTabBar.addEventListener('dblclick', onDblClick);

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

  log('onMouseUp ', lastMousedown.detail);

  if (await promisedCanceled) {
    log('mouseup is canceled by other addons');
    return;
  }

  if (tab) {
    if (lastMousedown.detail.isMiddleClick) { // Ctrl-click doesn't close tab on Firefox's tab bar!
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
    log('click on the new tab button');
    handleNewTabAction(aEvent, {
      action: actionForNewTabCommand
    });
    return;
  }

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
  log('clicked tab: ', tab);

  if (EventUtils.isEventFiredOnTwisty(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
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



Tabs.onRemoved.addListener(async aTab => {
  gUpdatingCollapsedStateCancellers.delete(aTab);
  gTabCollapsedStateChangedManagers.delete(aTab);
});


function onMessage(aMessage, _aSender, _aRespond) {
  if (!aMessage ||
      typeof aMessage.type != 'string' ||
      aMessage.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
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
