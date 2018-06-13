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

//import MenuUI from '../../common/MenuUI.js';

var gScrollLockedBy = {};
var gAddonStyles    = {};
var gInitialized    = false;

var gTabBar = document.querySelector('#tabbar');
var gContextualIdentitySelector = document.getElementById(Constants.kCONTEXTUAL_IDENTITY_SELECTOR);
var gNewTabActionSelector       = document.getElementById(Constants.kNEWTAB_ACTION_SELECTOR);

Sidebar.onInit.addListener(() => {
  onConfigChange('colorScheme');
  onConfigChange('simulateSVGContextFill');
});

Sidebar.onBuilt.addListener(async () => {
  window.addEventListener('resize', onResize);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('click', onClick);
  document.addEventListener('wheel', onWheel, { capture: true });
  document.addEventListener('contextmenu', onContextMenu, { capture: true });
  document.addEventListener('focus', onFocus);
  document.addEventListener('blur', onBlur);
  gTabBar.addEventListener('scroll', onScroll);
  gTabBar.addEventListener('dblclick', onDblClick);
  gTabBar.addEventListener('transitionend', onTransisionEnd);
  gTabBar.addEventListener('overflow', onOverflow);
  gTabBar.addEventListener('underflow', onUnderflow);

  configs.$addObserver(onConfigChange);
  onConfigChange('debug');
  onConfigChange('sidebarPosition');
  onConfigChange('sidebarDirection');
  onConfigChange('sidebarScrollbarPosition');
  onConfigChange('scrollbarMode');
  onConfigChange('showContextualIdentitiesSelector');
  onConfigChange('showNewTabActionSelector');
  MetricsData.add('apply configs');

  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
  if (browser.theme && browser.theme.onUpdated) // Firefox 58 and later
    browser.theme.onUpdated.addListener(onBrowserThemeChanged);

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

  gScrollLockedBy = await browser.runtime.sendMessage({ type: Constants.kCOMMAND_REQUEST_SCROLL_LOCK_STATE });
});

Sidebar.onReady.addListener(() => {
  gInitialized = true;

  onConfigChange('animation');

  updateSpecialEventListenersForAPIListeners();

  for (let id of Object.keys(TSTAPI.addons)) {
    let addon = addons[id];
    if (addon.style)
      installStyleForAddon(id, addon.style);
  }
});

Sidebar.onDestroy.addListener(() => {
  configs.$removeObserver(onConfigChange);
  browser.runtime.onMessage.removeListener(onMessage);
  browser.runtime.onMessageExternal.removeListener(onMessageExternal);
  if (browser.theme && browser.theme.onUpdated) // Firefox 58 and later
    browser.theme.onUpdated.removeListener(onBrowserThemeChanged);

  window.removeEventListener('resize', onResize);
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('click', onClick);
  document.removeEventListener('wheel', onWheel, { capture: true });
  document.removeEventListener('contextmenu', onContextMenu, { capture: true });
  document.removeEventListener('focus', onFocus);
  document.removeEventListener('blur', onBlur);
  gTabBar.removeEventListener('scroll', onScroll);
  gTabBar.removeEventListener('dblclick', onDblClick);
  gTabBar.removeEventListener('transitionend', onTransisionEnd);
  gTabBar.removeEventListener('overflow', onOverflow);
  gTabBar.removeEventListener('underflow', onUnderflow);

  if (onMouseMove.listening)
    window.removeEventListener('mousemove', onMouseMove, { capture: true, passive: true });
  if (onMouseOver.listening)
    window.removeEventListener('mouseover', onMouseOver, { capture: true, passive: true });
  if (onMouseOut.listening)
    window.removeEventListener('mouseout', onMouseOut, { capture: true, passive: true });
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

function installStyleForAddon(aId, aStyle) {
  if (!gAddonStyles[aId]) {
    gAddonStyles[aId] = document.createElement('style');
    gAddonStyles[aId].setAttribute('type', 'text/css');
    document.head.insertBefore(gAddonStyles[aId], gUserStyleRules);
  }
  gAddonStyles[aId].textContent = aStyle;
}

function uninstallStyleForAddon(aId) {
  if (!gAddonStyles[aId])
    return;
  document.head.removeChild(gAddonStyles[aId]);
  delete gAddonStyles[aId];
}


/* handlers for DOM events */

function onResize(aEvent) {
  Sidebar.reserveToUpdateTabbarLayout({
    reason: Constants.kTABBAR_UPDATE_REASON_RESIZE
  });
  Sidebar.reserveToUpdateIndent();
}

function onContextMenu(aEvent) {
  if (!configs.fakeContextMenu)
    return;
  aEvent.stopPropagation();
  aEvent.preventDefault();
  var tab = EventUtils.getTabFromEvent(aEvent);
  TabContextMenu.open({
    tab:  tab && tab.apiTab,
    left: aEvent.clientX,
    top:  aEvent.clientY
  });
}

function onFocus(aEvent) {
  browser.runtime.sendMessage({
    type:     Constants.kNOTIFY_SIDEBAR_FOCUS,
    windowId: gTargetWindow
  });
}

function onBlur(aEvent) {
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

  var target = aEvent.target;
  var tab = EventUtils.getTabFromEvent(aEvent) || EventUtils.getTabFromTabbarEvent(aEvent);
  if (configs.logOnMouseEvent)
    log('onMouseDown: found target tab: ', tab);

  var mousedownDetail = {
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

  var mousedown = {
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

  EventUtils.lastMousedown[aEvent.button] = mousedown;
  mousedown.timeout = setTimeout(() => {
    if (!EventUtils.lastMousedown[aEvent.button])
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

  var allRange = document.createRange();
  allRange.selectNodeContents(document.body);
  var containerRect = allRange.getBoundingClientRect();
  allRange.detach();
  if (aEvent.clientX < containerRect.left ||
      aEvent.clientX > containerRect.right ||
      aEvent.clientY < containerRect.top ||
      aEvent.clientY > containerRect.bottom)
    return 'outside';

  return 'blank';
}

async function onMouseUp(aEvent) {
  let tab = EventUtils.getTabFromEvent(aEvent);
  let lastMousedown = EventUtils.lastMousedown[aEvent.button];
  EventUtils.cancelHandleMousedown(aEvent.button);
  if (lastMousedown)
    await lastMousedown.promisedMousedownNotified;

  let serializedTab = tab && TSTAPI.serializeTab(tab);
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
      confirmToCloseTabs(Tree.getClosingTabsFromParent(tab).length)
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

  var tab = EventUtils.getTabFromEvent(aEvent);
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
    confirmToCloseTabs(Tree.getClosingTabsFromParent(tab).length)
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

  var tab = EventUtils.getTabFromEvent(aEvent);
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

function onTransisionEnd(aEvent) {
  if (aEvent.pseudoElement || // ignore size change of pseudo elements because they won't change height of tabbar contents
      !aEvent.target.classList.contains('tab') || // ignore animations of twisty or something inside tabs
      /opacity|color|text-shadow/.test(aEvent.propertyName))
    return;
  //log('transitionend ', aEvent);
  Sidebar.reserveToUpdateTabbarLayout({
    reason: Constants.kTABBAR_UPDATE_REASON_ANIMATION_END
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

async function onWheel(aEvent) {
  if (!configs.zoomable &&
      EventUtils.isAccelKeyPressed(aEvent)) {
    aEvent.preventDefault();
    return;
  }

  var lockers = Object.keys(gScrollLockedBy);
  if (lockers.length <= 0)
    return;

  aEvent.stopImmediatePropagation();
  aEvent.preventDefault();

  var tab = EventUtils.getTabFromEvent(aEvent);
  var results = await TSTAPI.sendMessage({
    type:      TSTAPI.kNOTIFY_SCROLLED,
    tab:       tab && TSTAPI.serializeTab(tab),
    tabs:      Tabs.getTabs().map(TSTAPI.serializeTab),
    window:    gTargetWindow,

    deltaY:       aEvent.deltaY,
    deltaMode:    aEvent.deltaMode,
    scrollTop:    gTabBar.scrollTop,
    scrollTopMax: gTabBar.scrollTopMax,

    altKey:    aEvent.altKey,
    ctrlKey:   aEvent.ctrlKey,
    metaKey:   aEvent.metaKey,
    shiftKey:  aEvent.shiftKey,

    clientX:   aEvent.clientX,
    clientY:   aEvent.clientY
  }, {
    targets: lockers
  });
  for (let result of results) {
    if (result.error || result.result === undefined)
      delete gScrollLockedBy[result.id];
  }
}

function onScroll(aEvent) {
  reserveToSaveScrollPosition();
}

function reserveToSaveScrollPosition() {
  if (reserveToSaveScrollPosition.reserved)
    clearTimeout(reserveToSaveScrollPosition.reserved);
  reserveToSaveScrollPosition.reserved = setTimeout(() => {
    delete reserveToSaveScrollPosition.reserved;
    browser.sessions.setWindowValue(
      gTargetWindow,
      Constants.kWINDOW_STATE_SCROLL_POSITION,
      gTabBar.scrollTop
    );
  }, 150);
}

function onOverflow(aEvent) {
  const tab = Tabs.getTabFromChild(aEvent.target);
  const label = Tabs.getTabLabel(tab);
  if (aEvent.target == label && !Tabs.isPinned(tab)) {
    label.classList.add('overflow');
    Sidebar.reserveToUpdateTabTooltip(tab);
  }
}

function onUnderflow(aEvent) {
  const tab = Tabs.getTabFromChild(aEvent.target);
  const label = Tabs.getTabLabel(tab);
  if (aEvent.target == label && !Tabs.isPinned(tab)) {
    label.classList.remove('overflow');
    Sidebar.reserveToUpdateTabTooltip(tab);
  }
}


/* raw event handlers */

Tabs.onBuilt.addListener((aTab, aInfo) => {
  var label = Tabs.getTabLabel(aTab);

  var twisty = document.createElement('span');
  twisty.classList.add(Constants.kTWISTY);
  twisty.setAttribute('title', browser.i18n.getMessage('tab_twisty_collapsed_tooltip'));
  aTab.insertBefore(twisty, label);

  var favicon = document.createElement('span');
  favicon.classList.add(Constants.kFAVICON);
  var faviconImage = favicon.appendChild(document.createElement('img'));
  faviconImage.classList.add(Constants.kFAVICON_IMAGE);
  var defaultIcon = favicon.appendChild(document.createElement('span'));
  defaultIcon.classList.add(Constants.kFAVICON_BUILTIN);
  defaultIcon.classList.add(Constants.kFAVICON_DEFAULT); // just for backward compatibility, and this should be removed from future versions
  var throbber = favicon.appendChild(document.createElement('span'));
  throbber.classList.add(Constants.kTHROBBER);
  aTab.insertBefore(favicon, label);

  var counter = document.createElement('span');
  counter.classList.add(Constants.kCOUNTER);
  aTab.appendChild(counter);

  var soundButton = document.createElement('button');
  soundButton.classList.add(Constants.kSOUND_BUTTON);
  aTab.appendChild(soundButton);

  var closebox = document.createElement('span');
  closebox.classList.add(Constants.kCLOSEBOX);
  closebox.setAttribute('title', browser.i18n.getMessage('tab_closebox_tab_tooltip'));
  closebox.setAttribute('draggable', true); // this is required to cancel click by dragging
  aTab.appendChild(closebox);

  var burster = document.createElement('span');
  burster.classList.add(Constants.kBURSTER);
  aTab.appendChild(burster);

  var activeMarker = document.createElement('span');
  activeMarker.classList.add(Constants.kACTIVE_MARKER);
  aTab.appendChild(activeMarker);

  var identityMarker = document.createElement('span');
  identityMarker.classList.add(Constants.kCONTEXTUAL_IDENTITY_MARKER);
  aTab.appendChild(identityMarker);

  var extraItemsContainerBehind = document.createElement('span');
  extraItemsContainerBehind.classList.add(Constants.kEXTRA_ITEMS_CONTAINER);
  extraItemsContainerBehind.classList.add('behind');
  aTab.appendChild(extraItemsContainerBehind);

  aTab.setAttribute('draggable', true);

  if (!aInfo.existing && configs.animation) {
    Tree.collapseExpandTab(aTab, {
      collapsed: true,
      justNow:   true
    });
  }
});

Tabs.onFaviconUpdated.addListener((aTab, aURL) => {
  TabFavIconHelper.loadToImage({
    image: SidebarTabs.getTabFavicon(aTab).firstChild,
    tab:   aTab.apiTab,
    url:   aURL
  });
});

Tabs.onUpdated.addListener((aTab, aChangeInfo) => {
  updateTabSoundButtonTooltip(aTab);
});

Tabs.onLabelUpdated.addListener(aTab => {
  Sidebar.reserveToUpdateTabTooltip(aTab);
});

Tabs.onParentTabUpdated.addListener(aTab => {
  updateTabSoundButtonTooltip(aTab);
});

function updateTabSoundButtonTooltip(aTab) {
  var tooltip = '';
  if (Tabs.maybeMuted(aTab))
    tooltip = browser.i18n.getMessage('tab_soundButton_muted_tooltip');
  else if (Tabs.maybeSoundPlaying(aTab))
    tooltip = browser.i18n.getMessage('tab_soundButton_playing_tooltip');

  SidebarTabs.getTabSoundButton(aTab).setAttribute('title', tooltip);
}


Tabs.onCreated.addListener((aTab, aInfo = {}) => {
  if (configs.animation) {
    aTab.classList.add(Constants.kTAB_STATE_ANIMATION_READY);
    nextFrame().then(() => {
      var parent = Tabs.getParentTab(aTab);
      if (parent && Tabs.isSubtreeCollapsed(parent)) // possibly collapsed by other trigger intentionally
        return;
      var focused = Tabs.isActive(aTab);
      Tree.collapseExpandTab(aTab, {
        collapsed: false,
        anchor:    Tabs.getCurrentTab(),
        last:      true
      });
      if (!focused)
        Scroll.notifyOutOfViewTab(aTab);
    });
  }
  else {
    aTab.classList.add(Constants.kTAB_STATE_ANIMATION_READY);
    if (Tabs.isActive(aTab))
      Scroll.scrollToNewTab(aTab);
    else
      Scroll.notifyOutOfViewTab(aTab);
  }

  Sidebar.reserveToUpdateVisualMaxTreeLevel();
  Sidebar.reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_TAB_OPEN,
    timeout: configs.collapseDuration
  });
});

Tabs.onRestoring.addListener(aTab => {
  if (!configs.useCachedTree) // we cannot know when we should unblock on no cache case...
    return;

  var container = aTab.parentNode;
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
  var container = Tabs.getTabsContainer(aWindowId);
  var restoredCount = await container.allTabsRestored;
  if (restoredCount == 1) {
    log('Tabs.onWindowRestoring: single tab restored');
    UserOperationBlocker.unblock({ throbber: true });
    return;
  }

  log('Tabs.onWindowRestoring: continue');
  var cache = await SidebarCache.getEffectiveWindowCache({
    ignorePinnedTabs: true
  });
  if (!cache ||
      (cache.offset &&
       container.childNodes.length <= cache.offset)) {
    log('Tabs.onWindowRestoring: no effective cache');
    await inheritTreeStructure(); // fallback to classic method
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
    await rebuildAll();
    await inheritTreeStructure();
  }
  updateVisualMaxTreeLevel();
  Indent.update({
    force: true,
    cache: restored && cache.offset == 0 ? cache.indent : null
  });
  updateTabbarLayout({ justNow: true });
  UserOperationBlocker.unblock({ throbber: true });
  MetricsData.add('Tabs.onWindowRestoring restore end');
});

Tabs.onRemoving.addListener((aTab, aCloseInfo) => {
  TabContextMenu.close();

  var closeParentBehavior = Tree.getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aCloseInfo);
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
  Sidebar.reserveToUpdateVisualMaxTreeLevel();
  Sidebar.reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_TAB_CLOSE,
    timeout: configs.collapseDuration
  });
  Sidebar.reserveToUpdateLoadingState();
});

Tabs.onRemoved.addListener(async aTab => {
  if (Tabs.isCollapsed(aTab) ||
      !configs.animation)
    return;

  return new Promise(async (aResolve, aReject) => {
    let tabRect = aTab.getBoundingClientRect();
    aTab.style.marginLeft = `${tabRect.width}px`;
    await wait(configs.animation ? configs.collapseDuration : 0);
    aResolve();
  });
});

Tabs.onMoving.addListener(async aTab => {
  TabContextMenu.close();
  if (!configs.animation ||
      Tabs.isPinned(aTab) ||
      Tabs.isOpening(aTab))
    return;
  aTab.classList.add(Constants.kTAB_STATE_MOVING);
  nextFrame().then(async () => {
    if (!Tabs.ensureLivingTab(aTab)) // it was removed while waiting
      return;
    let visible = !Tabs.isCollapsed(aTab);
    let promisedCollapsed;
    if (isCollapsedStateUpdating(aTab))
      promisedCollapsed = isSurelyCollapsed(aTab);
    Tree.collapseExpandTab(aTab, {
      collapsed: true,
      justNow:   true
    });
    if (promisedCollapsed)
      visible = !(await promisedCollapsed);
    await nextFrame();
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

Tabs.onMoved.addListener(aTab => {
  Sidebar.reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_TAB_MOVE,
    timeout: configs.collapseDuration
  });
  Sidebar.reserveToUpdateTabTooltip(Tabs.getParentTab(aTab));
});

Tree.onLevelChanged.addListener(async aTab => {
  Sidebar.reserveToUpdateIndent();
});

Tabs.onDetached.addListener(aTab => {
  if (!Tabs.ensureLivingTab(aTab))
    return;
  Sidebar.reserveToUpdateTabTooltip(Tabs.getParentTab(aTab));
  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  Tree.detachTab(aTab, {
    dontUpdateIndent: true
  });
});

Tree.onSubtreeCollapsedStateChanging.addListener((aTab, aInfo = {}) => {
  updateTabTwisty(aTab);
  updateTabClosebox(aTab);
  Sidebar.reserveToUpdateTabTooltip(aTab);
});

Tabs.onCollapsedStateChanging.addListener(async (aTab, aInfo = {}) => {
  var toBeCollapsed = aInfo.collapsed;

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

  var reason = toBeCollapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;

  if (!configs.animation ||
      aInfo.justNow ||
      configs.collapseDuration < 1) {
    //log('=> skip animation');
    return;
  }

  if (isCollapsedStateUpdating(aTab))
    await isSurelyCollapsed(aTab);

  let onCompletelyUpdated;
  gUpdatingCollapsedState[aTab.id] = new Promise((aResolve, _aReject) => {
    onCompletelyUpdated = aResolve;
  });
  gUpdatingCollapsedState[aTab.id].then(() => {
    delete gUpdatingCollapsedState[aTab.id];
  });

  if (toBeCollapsed) {
    aTab.classList.add(Constants.kTAB_STATE_COLLAPSING);
  }
  else {
    aTab.classList.add(Constants.kTAB_STATE_EXPANDING);
    aTab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);
  }

  Sidebar.reserveToUpdateTabbarLayout({ reason });

  nextFrame().then(() => {
    if (!Tabs.ensureLivingTab(aTab)) { // it was removed while waiting
      onCompletelyUpdated();
      return;
    }

    //log('start animation for ', dumpTab(aTab));
    if (aInfo.last)
      Scroll.scrollToTab(aTab, {
        anchor:            aInfo.anchor,
        notifyOnOutOfView: true
      });

    aTab.onEndCollapseExpandAnimation = (() => {
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
      onCompletelyUpdated();
    });
    aTab.onEndCollapseExpandAnimation.timeout = setTimeout(() => {
      if (!Tabs.ensureLivingTab(aTab) ||
          !aTab.onEndCollapseExpandAnimation) {
        onCompletelyUpdated();
        return;
      }
      delete aTab.onEndCollapseExpandAnimation.timeout;
      aTab.onEndCollapseExpandAnimation();
      delete aTab.onEndCollapseExpandAnimation;
      onCompletelyUpdated();
    }, configs.collapseDuration);
  });
});
function onEndCollapseExpandCompletely(aTab, aOptions = {}) {
  if (Tabs.isActive(aTab) && !aOptions.collapsed)
    Scroll.scrollToTab(aTab);

  if (configs.indentAutoShrink &&
      configs.indentAutoShrinkOnlyForVisible)
    Sidebar.reserveToUpdateVisualMaxTreeLevel();

  Sidebar.reserveToUpdateLoadingState();

  // this is very required for no animation case!
  Sidebar.reserveToUpdateTabbarLayout({ reason: aOptions.reason });
  SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

Tabs.onCollapsedStateChanged.addListener((aTab, aInfo = {}) => {
  var toBeCollapsed = aInfo.collapsed;
  if (!Tabs.ensureLivingTab(aTab)) // do nothing for closed tab!
    return;

  Sidebar.reserveToUpdateLoadingState();
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


  var reason = toBeCollapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;
  onEndCollapseExpandCompletely(aTab, {
    collapsed: toBeCollapsed,
    reason
  });

  if (aInfo.last)
    Scroll.scrollToTab(aTab, {
      anchor:            aInfo.anchor,
      notifyOnOutOfView: true
    });
});

function isCollapsedStateUpdating(aTab) {
  return aTab.id in gUpdatingCollapsedState;
}

async function isSurelyCollapsed(aTab) {
  if ('aTab.id' in gUpdatingCollapsedState)
    return gUpdatingCollapsedState[aTab.id].then(() => {
      return Tabs.isCollapsed(aTab);
    });
  return Tabs.isCollapsed(aTab);
}
const gUpdatingCollapsedState = {};


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
        var x = aEvent.clientX;
        var y = aEvent.clientY;
        var rect = aTab.getBoundingClientRect();
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

Tree.onAttached.addListener(async (aTab, aInfo = {}) => {
  if (!gInitialized)
    return;
  TabContextMenu.close();
  updateTabTwisty(aInfo.parent);
  updateTabClosebox(aInfo.parent);
  if (aInfo.newlyAttached) {
    let ancestors = [aInfo.parent].concat(Tabs.getAncestorTabs(aInfo.parent));
    for (let ancestor of ancestors) {
      updateTabsCount(ancestor);
    }
  }
  Sidebar.reserveToUpdateTabTooltip(aInfo.parent);
  Sidebar.reserveToUpdateVisualMaxTreeLevel();
  Sidebar.reserveToUpdateIndent();
  /*
    We must not scroll to the tab here, because the tab can be moved
    by the background page later. Instead we wait until the tab is
    successfully moved (then Constants.kCOMMAND_TAB_ATTACHED_COMPLETELY is delivered.)
  */
});

Tree.onDetached.addListener(async (aTab, aDetachInfo = {}) => {
  if (!gInitialized)
    return;
  TabContextMenu.close();
  var parent = aDetachInfo.oldParentTab;
  if (!parent)
    return;
  updateTabTwisty(parent);
  updateTabClosebox(parent);
  Sidebar.reserveToUpdateVisualMaxTreeLevel();
  Sidebar.reserveToUpdateIndent();
  Sidebar.reserveToUpdateTabTooltip(parent);
  var ancestors = [parent].concat(Tabs.getAncestorTabs(parent));
  for (let ancestor of ancestors) {
    updateTabsCount(ancestor);
  }
});

Tabs.onPinned.addListener(aTab => {
  TabContextMenu.close();
});

Tabs.onUnpinned.addListener(aTab => {
  TabContextMenu.close();
  Scroll.scrollToTab(aTab);
  //updateInvertedTabContentsOrder(aTab);
});

Tabs.onShown.addListener(aTab => {
  TabContextMenu.close();
  Sidebar.reserveToUpdateVisualMaxTreeLevel();
  Sidebar.reserveToUpdateIndent();
});

Tabs.onHidden.addListener(aTab => {
  TabContextMenu.close();
  Sidebar.reserveToUpdateVisualMaxTreeLevel();
  Sidebar.reserveToUpdateIndent();
});

Tabs.onStateChanged.addListener(aTab => {
  if (aTab.apiTab.status == 'loading')
    aTab.classList.add(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  else
    aTab.classList.remove(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  Sidebar.reserveToUpdateLoadingState();
});

Tabs.onGroupTabDetected.addListener(aTab => {
  // When a group tab is restored but pending, TST cannot update title of the tab itself.
  // For failsafe now we update the title based on its URL.
  var uri = aTab.apiTab.url;
  var parameters = uri.replace(/^[^\?]+/, '');
  var title = parameters.match(/[&?]title=([^&;]*)/);
  if (!title)
    title = parameters.match(/^\?([^&;]*)/);
  title = title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab_label_default');
  aTab.apiTab.title = title;
  wait(0).then(() => {
    TabsUpdate.updateTab(aTab, { title }, { tab: aTab.apiTab });
  });
});

ContextualIdentities.onUpdated.addListener(() => {
  updateContextualIdentitiesStyle();
  updateContextualIdentitiesSelector();
});


/* message observer */

var gTreeChangesFromRemote = [];
function waitUntilAllTreeChangesFromRemoteAreComplete() {
  return Promise.all(gTreeChangesFromRemote);
}

function onMessage(aMessage, aSender, aRespond) {
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
        let tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        let params = {
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
        let tab = Tabs.getTabById(aMessage.tab);
        if (!tab)
          return;
        if (isCollapsedStateUpdating(tab))
          await isSurelyCollapsed(tab);
        // Tree's collapsed state can be changed before this message is delivered,
        // so we should ignore obsolete messages.
        if (aMessage.byAncestor &&
            aMessage.collapsed != Tabs.getAncestorTabs(tab).some(Tabs.isSubtreeCollapsed))
          return;
        let params = {
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
          let child  = Tabs.getTabById(aMessage.child);
          let parent = Tabs.getTabById(aMessage.parent);
          if (child && parent)
            await Tree.attachTabTo(child, parent, Object.assign({}, aMessage, {
              insertBefore: Tabs.getTabById(aMessage.insertBefore),
              insertAfter:  Tabs.getTabById(aMessage.insertAfter),
              inRemote:     false,
              broadcast:    false
            }));
          gTreeChangesFromRemote.splice(gTreeChangesFromRemote.indexOf(promisedComplete), 1);
        })();
        gTreeChangesFromRemote.push(promisedComplete);
        return promisedComplete;
      }
    }; break;

    case Constants.kCOMMAND_TAB_ATTACHED_COMPLETELY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.tab,
          aMessage.parent
        ]);
        let tab = Tabs.getTabById(aMessage.tab);
        if (tab && Tabs.isActive(Tabs.getTabById(aMessage.parent)))
          Scroll.scrollToNewTab(tab);
      })();

    case Constants.kCOMMAND_DETACH_TAB: {
      if (aMessage.windowId == gTargetWindow) {
        const promisedComplete = (async () => {
          await Promise.all([
            Tabs.waitUntilTabsAreCreated(aMessage.tab),
            waitUntilAllTreeChangesFromRemoteAreComplete()
          ]);
          let tab = Tabs.getTabById(aMessage.tab);
          if (tab)
            Tree.detachTab(tab, aMessage);
          gTreeChangesFromRemote.splice(gTreeChangesFromRemote.indexOf(promisedComplete), 1);
        })();
        gTreeChangesFromRemote.push(promisedComplete);
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
        let add    = aMessage.add || [];
        let remove = aMessage.remove || [];
        log('apply broadcasted tab state ', aMessage.tabs, {
          add:    add.join(','),
          remove: remove.join(',')
        });
        let modified = add.concat(remove);
        for (let tab of aMessage.tabs) {
          tab = Tabs.getTabById(tab);
          if (!tab)
            continue;
          add.forEach(aState => tab.classList.add(aState));
          remove.forEach(aState => tab.classList.remove(aState));
          if (modified.indexOf(Constants.kTAB_STATE_AUDIBLE) > -1 ||
            modified.indexOf(Constants.kTAB_STATE_SOUND_PLAYING) > -1 ||
            modified.indexOf(Constants.kTAB_STATE_MUTED) > -1) {
            updateTabSoundButtonTooltip(tab);
            if (aMessage.bubbles)
              TabsUpdate.updateParentTab(Tabs.getParentTab(tab));
          }
        }
      })();
    }; break;

    case Constants.kCOMMAND_CONFIRM_TO_CLOSE_TABS: {
      if (aMessage.windowId == gTargetWindow)
        return confirmToCloseTabs(aMessage.count);
    }; break;

    case Constants.kCOMMAND_BROADCAST_CURRENT_DRAG_DATA:
      gCurrentDragData = aMessage.dragData || null;
      break;

    case Constants.kCOMMAND_BROADCAST_API_REGISTERED:
      TSTAPI.addons[aMessage.sender.id] = aMessage.message;
      if (aMessage.message.style)
        installStyleForAddon(aMessage.sender.id, aMessage.message.style);
      updateSpecialEventListenersForAPIListeners();
      break;

    case Constants.kCOMMAND_BROADCAST_API_UNREGISTERED:
      delete gScrollLockedBy[aMessage.sender.id];
      uninstallStyleForAddon(aMessage.sender.id)
      delete TSTAPI.addons[aMessage.sender.id];
      updateSpecialEventListenersForAPIListeners();
      break;

    case Constants.kCOMMAND_SHOW_CONTAINER_SELECTOR: {
      const anchor = document.querySelector(`
        :root.contextual-identity-selectable .contextual-identities-selector-anchor,
        .newtab-button
      `);
      gContextualIdentitySelector.ui.open({ anchor });
    }; break;

    case Constants.kCOMMAND_SCROLL_TABBAR:
      if (aMessage.windowId != gTargetWindow)
        break;
      switch (String(aMessage.by).toLowerCase()) {
        case 'lineup':
          Scroll.smoothScrollBy(-Size.getTabHeight() * configs.scrollLines);
          break;

        case 'pageup':
          Scroll.smoothScrollBy(-gTabBar.getBoundingClientRect().height + Size.getTabHeight());
          break;

        case 'linedown':
          Scroll.smoothScrollBy(Size.getTabHeight() * configs.scrollLines);
          break;

        case 'pagedown':
          Scroll.smoothScrollBy(gTabBar.getBoundingClientRect().height - Size.getTabHeight());
          break;

        default:
          switch (String(aMessage.to).toLowerCase()) {
            case 'top':
              Scroll.smoothScrollTo({ position: 0 });
              break;

            case 'bottom':
              Scroll.smoothScrollTo({ position: gTabBar.scrollTopMax });
              break;
          }
          break;
      }
      break;
  }
}

function onMessageExternal(aMessage, aSender) {
  switch (aMessage.type) {
    case TSTAPI.kSCROLL_LOCK:
      gScrollLockedBy[aSender.id] = true;
      return Promise.resolve(true);

    case TSTAPI.kSCROLL_UNLOCK:
      delete gScrollLockedBy[aSender.id];
      return Promise.resolve(true);

    case TSTAPI.kSCROLL:
      return (async () => {
        let params = {};
        if ('tab' in aMessage) {
          await Tabs.waitUntilTabsAreCreated(aMessage.tab);
          params.tab = Tabs.getTabById(aMessage.tab);
          if (!params.tab || params.tab.windowId != gTargetWindow)
            return;
        }
        else {
          if (aMessage.window != gTargetWindow)
            return;
          if ('delta' in aMessage)
            params.delta = aMessage.delta;
          if ('position' in aMessage)
            params.position = aMessage.position;
        }
        return Scroll.scrollTo(params).then(() => {
          return true;
        });
      })();
  }
}

function onBrowserThemeChanged(aUpdateInfo) {
  if (!aUpdateInfo.windowId || // reset to default
      aUpdateInfo.windowId == gTargetWindow)
    applyBrowserTheme(aUpdateInfo.theme);
}

function onConfigChange(aChangedKey) {
  var rootClasses = document.documentElement.classList;
  switch (aChangedKey) {
    case 'debug': {
      for (let tab of Tabs.getAllTabs()) {
        TabsUpdate.updateTab(tab, tab.apiTab, { forceApply: true });
      }
      if (configs.debug)
        rootClasses.add('debug');
      else
        rootClasses.remove('debug');
    }; break;

    case 'animation':
      if (configs.animation)
        rootClasses.add('animation');
      else
        rootClasses.remove('animation');
      break;

    case 'sidebarPosition':
      if (configs.sidebarPosition == Constants.kTABBAR_POSITION_RIGHT) {
        rootClasses.add('right');
        rootClasses.remove('left');
      }
      else {
        rootClasses.add('left');
        rootClasses.remove('right');
      }
      Indent.update({ force: true });
      break;

    case 'sidebarDirection':
      if (configs.sidebarDirection == Constants.kTABBAR_DIRECTION_RTL) {
        rootClasses.add('rtl');
        rootClasses.remove('ltr');
      }
      else {
        rootClasses.add('ltr');
        rootClasses.remove('rtl');
      }
      break;

    case 'sidebarScrollbarPosition': {
      let position = configs.sidebarScrollbarPosition;
      if (position == Constants.kTABBAR_SCROLLBAR_POSITION_AUTO)
        position = configs.sidebarPosition;
      if (position == Constants.kTABBAR_SCROLLBAR_POSITION_RIGHT) {
        rootClasses.add('right-scrollbar');
        rootClasses.remove('left-scrollbar');
      }
      else {
        rootClasses.add('left-scrollbar');
        rootClasses.remove('right-scrollbar');
      }
      Indent.update({ force: true });
    }; break;

    case 'baseIndent':
    case 'minIndent':
    case 'maxTreeLevel':
    case 'indentAutoShrink':
    case 'indentAutoShrinkOnlyForVisible':
      Indent.update({ force: true });
      break;

    case 'showCollapsedDescendantsByTooltip':
      for (let tab of Tabs.getAllTabs()) {
        Sidebar.reserveToUpdateTabTooltip(tab);
      }
      break;

    case 'style':
      location.reload();
      break;

    case 'scrollbarMode':
      rootClasses.remove(Constants.kTABBAR_STATE_NARROW_SCROLLBAR);
      rootClasses.remove(Constants.kTABBAR_STATE_NO_SCROLLBAR);
      rootClasses.remove(Constants.kTABBAR_STATE_OVERLAY_SCROLLBAR);
      switch (configs.scrollbarMode) {
        default:
        case Constants.kTABBAR_SCROLLBAR_MODE_DEFAULT:
          break;
        case Constants.kTABBAR_SCROLLBAR_MODE_NARROW:
          rootClasses.add(Constants.kTABBAR_STATE_NARROW_SCROLLBAR);
          break;
        case Constants.kTABBAR_SCROLLBAR_MODE_HIDE:
          rootClasses.add(Constants.kTABBAR_STATE_NO_SCROLLBAR);
          break;
        case Constants.kTABBAR_SCROLLBAR_MODE_OVERLAY:
          rootClasses.add(Constants.kTABBAR_STATE_OVERLAY_SCROLLBAR);
          break;
      }
      break;

    case 'colorScheme':
      document.documentElement.setAttribute('color-scheme', configs.colorScheme);
      break;

    case 'narrowScrollbarSize':
      location.reload();
      break;

    case 'userStyleRules':
      applyUserStyleRules()
      break;

    case 'inheritContextualIdentityToNewChildTab':
      updateContextualIdentitiesSelector();
      break;

    case 'showContextualIdentitiesSelector':
      if (configs[aChangedKey])
        rootClasses.add(Constants.kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE);
      else
        rootClasses.remove(Constants.kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE);
      break;

    case 'showNewTabActionSelector':
      if (configs[aChangedKey])
        rootClasses.add(Constants.kTABBAR_STATE_NEWTAB_ACTION_SELECTABLE);
      else
        rootClasses.remove(Constants.kTABBAR_STATE_NEWTAB_ACTION_SELECTABLE);
      break;

    case 'simulateSVGContextFill':
      if (configs[aChangedKey])
        rootClasses.add('simulate-svg-context-fill');
      else
        rootClasses.remove('simulate-svg-context-fill');
      break;
  }
}
