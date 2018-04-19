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

function isMiddleClick(aEvent) {
  return aEvent.button == 1;
}

function isAccelAction(aEvent) {
  return isMiddleClick(aEvent) || (aEvent.button == 0 && isAccelKeyPressed(aEvent));
}

function isAccelKeyPressed(aEvent) {
  return gIsMac ?
    (aEvent.metaKey || aEvent.key == 'Meta') :
    (aEvent.ctrlKey || aEvent.key == 'Control') ;
}

function isCopyAction(aEvent) {
  return isAccelKeyPressed(aEvent) ||
           (aEvent.dataTransfer && aEvent.dataTransfer.dropEffect == 'copy');
}

function isEventFiredOnTwisty(aEvent) {
  var tab = getTabFromEvent(aEvent);
  if (!tab || !hasChildTabs(tab))
    return false;

  return !!aEvent.target.closest(`.${kTWISTY}`);
}

function isEventFiredOnSoundButton(aEvent) {
  return !!aEvent.target.closest(`.${kSOUND_BUTTON}`);
}

function isEventFiredOnClosebox(aEvent) {
  return !!aEvent.target.closest(`.${kCLOSEBOX}`);
}

function isEventFiredOnNewTabButton(aEvent) {
  return !!aEvent.target.closest(`.${kNEWTAB_BUTTON}`);
}

function isEventFiredOnMenuOrPanel(aEvent) {
  return !!aEvent.target.closest('ul.menu, ul.panel');
}

function isEventFiredOnAnchor(aEvent) {
  return !!aEvent.target.closest(`[data-menu-ui]`);
}

function isEventFiredOnClickable(aEvent) {
  return !!aEvent.target.closest(`button, scrollbar, select`);
}

function isEventFiredOnScrollbar(aEvent) {
  return !!aEvent.target.closest(`scrollbar, nativescrollbar`);
}


function getTabFromEvent(aEvent) {
  return getTabFromChild(aEvent.target);
}

function getTabsContainerFromEvent(aEvent) {
  return getTabsContainer(aEvent.target);
}

function getTabFromTabbarEvent(aEvent) {
  if (!configs.shouldDetectClickOnIndentSpaces ||
      isEventFiredOnClickable(aEvent))
    return null;
  return getTabFromCoordinates(aEvent);
}

function getTabFromCoordinates(aEvent) {
  var tab = document.elementFromPoint(aEvent.clientX, aEvent.clientY);
  tab = getTabFromChild(tab);
  if (tab)
    return tab;

  var container = getTabsContainerFromEvent(aEvent);
  if (!container)
    return null;

  // because tab style can be modified, we try to find tab from
  // left, middle, and right.
  var containerRect = container.getBoundingClientRect();
  var trialPoints = [
    gFaviconSize,
    containerRect.width / 2,
    containerRect.width - gFaviconSize
  ];
  for (let x of trialPoints) {
    let tab = getTabFromChild(document.elementFromPoint(x, aEvent.clientY));
    if (tab)
      return tab;
  }
  return null;
}


/* handlers for DOM events */

function onResize(aEvent) {
  reserveToUpdateTabbarLayout({
    reason: kTABBAR_UPDATE_REASON_RESIZE
  });
  reserveToUpdateIndent();
}

function onContextMenu(aEvent) {
  if (!configs.fakeContextMenu)
    return;
  aEvent.stopPropagation();
  aEvent.preventDefault();
  var tab = getTabFromEvent(aEvent);
  tabContextMenu.open({
    tab:  tab && tab.apiTab,
    left: aEvent.clientX,
    top:  aEvent.clientY
  });
}

var gLastMousedown = {};

function onMouseDown(aEvent) {
  cancelHandleMousedown(aEvent.button);
  tabContextMenu.close();
  clearDropPosition();
  clearDraggingState();

  if (isEventFiredOnAnchor(aEvent) &&
      !isAccelAction(aEvent) &&
      aEvent.button != 2) {
    if (configs.logOnMouseEvent)
      log('mouse down on a selector anchor');
    aEvent.stopPropagation();
    aEvent.preventDefault();
    const selector = document.getElementById(aEvent.target.closest('[data-menu-ui]').dataset.menuUi);
    selector.ui.open({
      anchor: aEvent.target
    });
    return;
  }

  var target = aEvent.target;
  var tab = getTabFromEvent(aEvent) || getTabFromTabbarEvent(aEvent);
  if (configs.logOnMouseEvent)
    log('onMouseDown: found target tab: ', tab);

  var mousedownDetail = {
    targetType:    getMouseEventTargetType(aEvent),
    tab:           tab && tab.id,
    closebox:      isEventFiredOnClosebox(aEvent),
    button:        aEvent.button,
    ctrlKey:       aEvent.ctrlKey,
    shiftKey:      aEvent.shiftKey,
    altKey:        aEvent.altKey,
    metaKey:       aEvent.metaKey,
    isMiddleClick: isMiddleClick(aEvent),
    isAccelClick:  isAccelAction(aEvent)
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

  if ((!isEventFiredOnTwisty(aEvent) &&
       !isEventFiredOnSoundButton(aEvent) &&
       !isEventFiredOnClosebox(aEvent)) ||
      aEvent.button != 0)
    mousedown.promisedMousedownNotified = browser.runtime.sendMessage(Object.assign({}, mousedownDetail, {
      type:     kNOTIFY_TAB_MOUSEDOWN,
      windowId: gTargetWindow
    }));

  gLastMousedown[aEvent.button] = mousedown;
  mousedown.timeout = setTimeout(() => {
    if (!gLastMousedown[aEvent.button])
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

    if (getListenersForTSTAPIMessageType(kTSTAPI_NOTIFY_TAB_DRAGREADY).length == 0)
      return;

    if (configs.logOnMouseEvent)
      log('onMouseDown expired');
    mousedown.expired = true;
    if (aEvent.button == 0) {
      if (tab) {
        notifyTSTAPIDragReady(tab, mousedown.detail.closebox);
      }
    }
  }, configs.startDragTimeout);
}

function notifyTSTAPIDragReady(aTab, aIsClosebox) {
  sendTSTAPIMessage({
    type:   kTSTAPI_NOTIFY_TAB_DRAGREADY,
    tab:    serializeTabForTSTAPI(aTab),
    window: gTargetWindow,
    startOnClosebox: aIsClosebox
  });
  gReadyToCaptureMouseEvents = true;
}

function getMouseEventTargetType(aEvent) {
  if (getTabFromEvent(aEvent))
    return 'tab';

  if (isEventFiredOnNewTabButton(aEvent))
    return 'newtabbutton';

  if (isEventFiredOnMenuOrPanel(aEvent) ||
      isEventFiredOnAnchor(aEvent))
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

function cancelHandleMousedown(button = null) {
  if (!button && button !== 0) {
    return Object.keys(gLastMousedown).filter((key) => cancelHandleMousedown(key)).length > 0;
  }
  let lastMousedown = gLastMousedown[button];
  if (lastMousedown) {
    clearTimeout(lastMousedown.timeout);
    delete gLastMousedown[button];
    return true;
  }
  return false;
}

async function onMouseUp(aEvent) {
  let tab = getTabFromEvent(aEvent);
  let lastMousedown = gLastMousedown[aEvent.button];
  cancelHandleMousedown(aEvent.button);
  await lastMousedown.promisedMousedownNotified;

  let serializedTab = tab && serializeTabForTSTAPI(tab);
  let promisedCanceled = Promise.resolve(false);
  if (serializedTab && lastMousedown) {
    const results = sendTSTAPIMessage(Object.assign({}, lastMousedown.detail, {
      type:    kTSTAPI_NOTIFY_TAB_MOUSEUP,
      tab:     serializedTab,
      window:  gTargetWindow
    }));
    // don't wait here, because we need process following common operations
    // even if this mouseup event is canceled.
    promisedCanceled = results.then(aResults => aResults.some(aResult => aResult.result));
  }

  if (gCapturingMouseEvents) {
    window.removeEventListener('mouseover', onTSTAPIDragEnter, { capture: true });
    window.removeEventListener('mouseout',  onTSTAPIDragExit, { capture: true });
    document.releaseCapture();

    sendTSTAPIMessage({
      type:    kTSTAPI_NOTIFY_TAB_DRAGEND,
      tab:     serializedTab,
      window:  gTargetWindow,
      clientX: aEvent.clientX,
      clientY: aEvent.clientY
    });

    gLastDragEnteredTab = null;
    gLastDragEnteredTarget = null;
  }
  else if (gReadyToCaptureMouseEvents) {
    sendTSTAPIMessage({
      type:    kTSTAPI_NOTIFY_TAB_DRAGCANCEL,
      tab:     serializedTab,
      window:  gTargetWindow,
      clientX: aEvent.clientX,
      clientY: aEvent.clientY
    });
  }
  gCapturingMouseEvents = false;
  gReadyToCaptureMouseEvents = false;

  if (!lastMousedown ||
      lastMousedown.detail.targetType != getMouseEventTargetType(aEvent) ||
      (tab && tab != getTabById(lastMousedown.detail.tab)))
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
      confirmToCloseTabs(getCountOfClosingTabs(tab))
        .then(aConfirmed => {
          if (aConfirmed)
            removeTabInternally(tab, { inRemote: true });
        });
    }
    return;
  }

  // following codes are for handlig of click event on the tab bar itself.
  const actionForNewTabCommand = lastMousedown.detail.isAccelClick ?
    configs.autoAttachOnNewTabButtonMiddleClick :
    configs.autoAttachOnNewTabCommand;
  if (isEventFiredOnNewTabButton(aEvent) &&
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
  let results = await sendTSTAPIMessage(Object.assign({}, lastMousedown.detail, {
    type:   kTSTAPI_NOTIFY_TABBAR_MOUSEUP,
    window: gTargetWindow,
  }));
  results = results.concat(await sendTSTAPIMessage(Object.assign({}, lastMousedown.detail, {
    type:   kTSTAPI_NOTIFY_TABBAR_CLICKED,
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
  if (aEvent.button != 0) // ignore non-left click
    return;

  if (configs.logOnMouseEvent)
    log('onClick', String(aEvent.target));

  if (isEventFiredOnMenuOrPanel(aEvent) ||
      isEventFiredOnAnchor(aEvent))
    return;

  if (isEventFiredOnNewTabButton(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    return;
  }

  var tab = getTabFromEvent(aEvent);
  if (configs.logOnMouseEvent)
    log('clicked tab: ', tab);

  if (isEventFiredOnTwisty(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (configs.logOnMouseEvent)
      log('clicked on twisty');
    if (hasChildTabs(tab))
      collapseExpandSubtree(tab, {
        collapsed:       !isSubtreeCollapsed(tab),
        manualOperation: true,
        inRemote:        true
      });
    return;
  }

  if (isEventFiredOnSoundButton(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (configs.logOnMouseEvent)
      log('clicked on sound button');
    browser.runtime.sendMessage({
      type:     kCOMMAND_SET_SUBTREE_MUTED,
      windowId: gTargetWindow,
      tab:      tab.id,
      muted:    maybeSoundPlaying(tab)
    });
    return;
  }

  if (isEventFiredOnClosebox(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (configs.logOnMouseEvent)
      log('clicked on closebox');
    //if (!warnAboutClosingTabSubtreeOf(tab)) {
    //  aEvent.stopPropagation();
    //  aEvent.preventDefault();
    //  return;
    //}
    confirmToCloseTabs(getCountOfClosingTabs(tab))
      .then(aConfirmed => {
        if (aConfirmed)
          removeTabInternally(tab, { inRemote: true });
      });
    return;
  }
}

function handleNewTabAction(aEvent, aOptions = {}) {
  if (configs.logOnMouseEvent)
    log('handleNewTabAction');

  if (!configs.autoAttach && !('action' in aOptions))
    aOptions.action = kNEWTAB_DO_NOTHING;

  Commands.openNewTabAs({
    baseTab:      getCurrentTab(gTargetWindow),
    as:           aOptions.action,
    cookieStoreId: aOptions.cookieStoreId,
    inBackground: aEvent.shiftKey,
    inRemote:     true
  });
}

function onDblClick(aEvent) {
  if (isEventFiredOnNewTabButton(aEvent))
    return;

  var tab = getTabFromEvent(aEvent);
  if (tab) {
    if (configs.collapseExpandSubtreeByDblClick) {
      aEvent.stopPropagation();
      aEvent.preventDefault();
      collapseExpandSubtree(tab, {
        collapsed:       !isSubtreeCollapsed(tab),
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

function onTransisionEnd() {
  reserveToUpdateTabbarLayout({
    reason: kTABBAR_UPDATE_REASON_ANIMATION_END
  });
}

function onNewTabActionSelect(aItem, aEvent) {
  if (aItem.dataset.value) {
    let action;
    switch (aItem.dataset.value) {
      default:
        action = kNEWTAB_OPEN_AS_ORPHAN;
        break;
      case 'child':
        action = kNEWTAB_OPEN_AS_CHILD;
        break;
      case 'sibling':
        action = kNEWTAB_OPEN_AS_SIBLING;
        break;
      case 'next-sibling':
        action = kNEWTAB_OPEN_AS_NEXT_SIBLING;
        break;
    }
    handleNewTabAction(aEvent, { action });
  }
  gNewTabActionSelector.ui.close();
}

function onContextualIdentitySelect(aItem, aEvent) {
  if (aItem.dataset.value) {
    const action = isAccelAction(aEvent) ?
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
      isAccelKeyPressed(aEvent)) {
    aEvent.preventDefault();
    return;
  }

  var lockers = Object.keys(gScrollLockedBy);
  if (lockers.length <= 0)
    return;

  aEvent.stopImmediatePropagation();
  aEvent.preventDefault();

  var tab = getTabFromEvent(aEvent);
  var results = await sendTSTAPIMessage({
    type:      kTSTAPI_NOTIFY_SCROLLED,
    tab:       tab && serializeTabForTSTAPI(tab),
    tabs:      getTabs().map(serializeTabForTSTAPI),
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
      kWINDOW_STATE_SCROLL_POSITION,
      gTabBar.scrollTop
    );
  }, 150);
}


/* raw event handlers */

function onTabBuilt(aTab, aInfo) {
  var label = getTabLabel(aTab);

  var twisty = document.createElement('span');
  twisty.classList.add(kTWISTY);
  twisty.setAttribute('title', browser.i18n.getMessage('tab_twisty_collapsed_tooltip'));
  aTab.insertBefore(twisty, label);

  var favicon = document.createElement('span');
  favicon.classList.add(kFAVICON);
  var faviconImage = favicon.appendChild(document.createElement('img'));
  faviconImage.classList.add(kFAVICON_IMAGE);
  var defaultIcon = favicon.appendChild(document.createElement('span'));
  defaultIcon.classList.add(kFAVICON_DEFAULT);
  var throbber = favicon.appendChild(document.createElement('span'));
  throbber.classList.add(kTHROBBER);
  aTab.insertBefore(favicon, label);

  var counter = document.createElement('span');
  counter.classList.add(kCOUNTER);
  aTab.appendChild(counter);

  var soundButton = document.createElement('button');
  soundButton.classList.add(kSOUND_BUTTON);
  aTab.appendChild(soundButton);

  var closebox = document.createElement('span');
  closebox.classList.add(kCLOSEBOX);
  closebox.setAttribute('title', browser.i18n.getMessage('tab_closebox_tab_tooltip'));
  closebox.setAttribute('draggable', true); // this is required to cancel click by dragging
  aTab.appendChild(closebox);

  var burster = document.createElement('span');
  burster.classList.add(kBURSTER);
  aTab.appendChild(burster);

  var activeMarker = document.createElement('span');
  activeMarker.classList.add(kACTIVE_MARKER);
  aTab.appendChild(activeMarker);

  var identityMarker = document.createElement('span');
  identityMarker.classList.add(kCONTEXTUAL_IDENTITY_MARKER);
  aTab.appendChild(identityMarker);

  var extraItemsContainerBehind = document.createElement('span');
  extraItemsContainerBehind.classList.add(kEXTRA_ITEMS_CONTAINER);
  extraItemsContainerBehind.classList.add('behind');
  aTab.appendChild(extraItemsContainerBehind);

  aTab.setAttribute('draggable', true);

  if (!aInfo.existing && configs.animation) {
    collapseExpandTab(aTab, {
      collapsed: true,
      justNow:   true
    });
  }
}


function onTabFaviconUpdated(aTab, aURL) {
  TabFavIconHelper.loadToImage({
    image: getTabFavicon(aTab).firstChild,
    tab:   aTab.apiTab,
    url:   aURL
  });
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
}

function onTabUpdated(aTab, aChangeInfo) {
  updateTabSoundButtonTooltip(aTab);
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
  updateTabLabelOverflow(aTab);
}

function onTabLabelUpdated(aTab) {
  reserveToUpdateTabTooltip(aTab);
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
}

function onParentTabUpdated(aTab) {
  updateTabSoundButtonTooltip(aTab);
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
}

function updateTabSoundButtonTooltip(aTab) {
  var tooltip = '';
  if (maybeMuted(aTab))
    tooltip = browser.i18n.getMessage('tab_soundButton_muted_tooltip');
  else if (maybeSoundPlaying(aTab))
    tooltip = browser.i18n.getMessage('tab_soundButton_playing_tooltip');

  getTabSoundButton(aTab).setAttribute('title', tooltip);
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
}

function onTabFocused(aTab, aInfo = {}) {
  tabContextMenu.close();
  scrollToTab(aTab);
}

function onTabOpening(aTab, aInfo = {}) {
  tabContextMenu.close();
}

function onTabOpened(aTab, aInfo = {}) {
  if (configs.animation) {
    aTab.classList.add(kTAB_STATE_ANIMATION_READY);
    nextFrame().then(() => {
      var parent = getParentTab(aTab);
      if (parent && isSubtreeCollapsed(parent)) // possibly collapsed by other trigger intentionally
        return;
      var focused = isActive(aTab);
      collapseExpandTab(aTab, {
        collapsed: false,
        justNow:   gRestoringTree,
        anchor:    getCurrentTab(),
        last:      true
      });
      if (!focused)
        notifyOutOfViewTab(aTab);
    });
  }
  else {
    aTab.classList.add(kTAB_STATE_ANIMATION_READY);
    if (isActive(aTab))
      scrollToNewTab(aTab);
    else
      notifyOutOfViewTab(aTab);
  }

  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateTabbarLayout({
    reason:  kTABBAR_UPDATE_REASON_TAB_OPEN,
    timeout: configs.collapseDuration
  });
  reserveToUpdateCachedTabbar();
}

function onTabRestoring(aTab) {
  if (!configs.useCachedTree) // we cannot know when we should unblock on no cache case...
    return;

  var container = aTab.parentNode;
  // When we are restoring two or more tabs.
  // (But we don't need do this again for third, fourth, and later tabs.)
  if (container.restoredCount == 2)
    blockUserOperations({ throbber: true });
}

// Tree restoration for "Restore Previous Session"
async function onWindowRestoring(aWindowId) {
  if (!configs.useCachedTree)
    return;

  log('onWindowRestoring');
  var container = getTabsContainer(aWindowId);
  var restoredCount = await container.allTabsRestored;
  if (restoredCount == 1) {
    log('onWindowRestoring: single tab restored');
    unblockUserOperations({ throbber: true });
    return;
  }

  log('onWindowRestoring: continue');
  var cache = await getEffectiveWindowCache({
    ignorePinnedTabs: true
  });
  if (!cache ||
      (cache.offset &&
       container.childNodes.length <= cache.offset)) {
    log('onWindowRestoring: no effective cache');
    await inheritTreeStructure(); // fallback to classic method
    unblockUserOperations({ throbber: true });
    return;
  }

  log('onWindowRestoring restore! ', cache);
  gMetricsData.add('onWindowRestoring restore start');
  cache.tabbar.tabsDirty = true;
  const apiTabs = await browser.tabs.query({ windowId: aWindowId });
  const restored = await restoreTabsFromCache(cache.tabbar, {
    offset: cache.offset || 0,
    tabs:   apiTabs
  });
  if (!restored) {
    await rebuildAll();
    await inheritTreeStructure();
  }
  updateVisualMaxTreeLevel();
  updateIndent({
    force: true,
    cache: restored && cache.offset == 0 ? cache.indent : null
  });
  updateTabbarLayout({ justNow: true });
  unblockUserOperations({ throbber: true });
  gMetricsData.add('onWindowRestoring restore end');
}

function onTabClosed(aTab, aCloseInfo) {
  tabContextMenu.close();

  var closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aCloseInfo);
  if (closeParentBehavior != kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
      isSubtreeCollapsed(aTab))
    collapseExpandSubtree(aTab, {
      collapsed: false
    });

  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  detachTab(aTab, {
    dontUpdateIndent: true
  });
  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateTabbarLayout({
    reason:  kTABBAR_UPDATE_REASON_TAB_CLOSE,
    timeout: configs.collapseDuration
  });
  reserveToUpdateLoadingState();
}

async function onTabCompletelyClosed(aTab) {
  // "Restore Previous Session" closes some tabs at first, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  wait(0).then(() => reserveToUpdateCachedTabbar());
  if (!configs.animation)
    return;

  return new Promise(async (aResolve, aReject) => {
    let tabRect = aTab.getBoundingClientRect();
    aTab.style.marginLeft = `${tabRect.width}px`;
    await wait(configs.animation ? configs.collapseDuration : 0);
    reserveToUpdateCachedTabbar();
    aResolve();
  });
}

function onTabMoving(aTab) {
  tabContextMenu.close();
  if (configs.animation &&
      !isCollapsed(aTab) &&
      !isPinned(aTab) &&
      !isOpening(aTab)) {
    aTab.classList.add(kTAB_STATE_MOVING);
    collapseExpandTab(aTab, {
      collapsed: true,
      justNow:   true
    });
    nextFrame().then(async () => {
      if (!ensureLivingTab(aTab)) // it was removed while waiting
        return;
      collapseExpandTab(aTab, {
        collapsed: false
      });
      await wait(configs.collapseDuration);
      aTab.classList.remove(kTAB_STATE_MOVING);
    });
  }
}

function onTabMoved(aTab) {
  reserveToUpdateTabbarLayout({
    reason:  kTABBAR_UPDATE_REASON_TAB_MOVE,
    timeout: configs.collapseDuration
  });
  reserveToUpdateTabTooltip(getParentTab(aTab));
  reserveToUpdateCachedTabbar();
}

async function onTabLevelChanged(aTab) {
  reserveToUpdateIndent();
  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToUpdateCachedTabbar();
}

function onTabDetachedFromWindow(aTab) {
  if (!ensureLivingTab(aTab))
    return;
  reserveToUpdateTabTooltip(getParentTab(aTab));
  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  detachTab(aTab, {
    dontUpdateIndent: true
  });
  reserveToUpdateCachedTabbar();
}

function onTabSubtreeCollapsedStateChanging(aTab, aInfo = {}) {
  updateTabTwisty(aTab);
  updateTabClosebox(aTab);
  reserveToUpdateTabTooltip(aTab);
}

function onTabCollapsedStateChanging(aTab, aInfo = {}) {
  var toBeCollapsed = aInfo.collapsed;

  if (configs.logOnCollapseExpand)
    log('onTabCollapsedStateChanging ', dumpTab(aTab), aInfo);
  if (!ensureLivingTab(aTab)) // do nothing for closed tab!
    return;

  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

  if (aTab.onEndCollapseExpandAnimation) {
    clearTimeout(aTab.onEndCollapseExpandAnimation.timeout);
    delete aTab.onEndCollapseExpandAnimation;
  }

  if (aTab.apiTab.status == 'loading')
    aTab.classList.add(kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  if (aInfo.anchor && !isTabInViewport(aInfo.anchor))
    aInfo.anchor = null;

  var reason = toBeCollapsed ? kTABBAR_UPDATE_REASON_COLLAPSE : kTABBAR_UPDATE_REASON_EXPAND ;

  if (!configs.animation ||
      aInfo.justNow ||
      configs.collapseDuration < 1) {
    //log('=> skip animation');
    return;
  }

  if (toBeCollapsed) {
    aTab.classList.add(kTAB_STATE_COLLAPSING);
  }
  else {
    aTab.classList.add(kTAB_STATE_EXPANDING);
    aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);
  }

  reserveToUpdateTabbarLayout({ reason });

  nextFrame().then(() => {
    if (!ensureLivingTab(aTab)) // it was removed while waiting
      return;

    //log('start animation for ', dumpTab(aTab));
    if (aInfo.last)
      scrollToTab(aTab, {
        anchor:            aInfo.anchor,
        notifyOnOutOfView: true
      });

    aTab.onEndCollapseExpandAnimation = (() => {
      //log('=> finish animation for ', dumpTab(aTab));
      aTab.classList.remove(kTAB_STATE_COLLAPSING);
      aTab.classList.remove(kTAB_STATE_EXPANDING);

      // The collapsed state of the tab can be changed by different trigger,
      // so we must respect the actual status of the tab, instead of the
      // "expected status" given via arguments.
      if (aTab.classList.contains(kTAB_STATE_COLLAPSED))
        aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
      else
        aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);

      onEndCollapseExpandCompletely(aTab, {
        collapsed: toBeCollapsed,
        reason
      });
    });
    aTab.onEndCollapseExpandAnimation.timeout = setTimeout(() => {
      if (!ensureLivingTab(aTab) ||
          !aTab.onEndCollapseExpandAnimation)
        return;
      delete aTab.onEndCollapseExpandAnimation.timeout;
      aTab.onEndCollapseExpandAnimation();
      delete aTab.onEndCollapseExpandAnimation;
    }, configs.collapseDuration);
  });
}
function onEndCollapseExpandCompletely(aTab, aOptions = {}) {
  if (isActive(aTab) && !aOptions.collapsed)
    scrollToTab(aTab);

  if (configs.indentAutoShrink &&
      configs.indentAutoShrinkOnlyForVisible)
    reserveToUpdateVisualMaxTreeLevel();

  reserveToUpdateLoadingState();

  // this is very required for no animation case!
  reserveToUpdateTabbarLayout({ reason: aOptions.reason });
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

function onTabCollapsedStateChanged(aTab, aInfo = {}) {
  var toBeCollapsed = aInfo.collapsed;
  if (!ensureLivingTab(aTab)) // do nothing for closed tab!
    return;

  reserveToUpdateLoadingState();
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

  if (configs.animation &&
      !aInfo.justNow &&
      configs.collapseDuration > 0)
    return; // animation

  //log('=> skip animation');
  if (toBeCollapsed)
    aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
  else
    aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);


  var reason = toBeCollapsed ? kTABBAR_UPDATE_REASON_COLLAPSE : kTABBAR_UPDATE_REASON_EXPAND ;
  onEndCollapseExpandCompletely(aTab, {
    collapsed: toBeCollapsed,
    reason
  });

  if (aInfo.last)
    scrollToTab(aTab, {
      anchor:            aInfo.anchor,
      notifyOnOutOfView: true
    });
}


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
        let node = aEvent.originalTarget || aEvent.target;
        if (node.nodeType != Node.ELEMENT_NODE)
          node = node.parentNode;
        if (node.closest(`#${id}`))
            stillOver = true;
          return;
        }
        else if (!aDelayed) {
          if (stillOver) {
            stillOver = false;
          }
          setTimeout(() => {
            if (!ensureLivingTab(aTab)) // it was removed while waiting
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

async function onTabAttached(aTab, aInfo = {}) {
  if (gInitializing)
    return;
  tabContextMenu.close();
  updateTabTwisty(aInfo.parent);
  updateTabClosebox(aInfo.parent);
  if (aInfo.newlyAttached) {
    let ancestors = [aInfo.parent].concat(getAncestorTabs(aInfo.parent));
    for (let ancestor of ancestors) {
      updateTabsCount(ancestor);
    }
  }
  reserveToUpdateTabTooltip(aInfo.parent);
  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateIndent();
  /*
    We must not scroll to the tab here, because the tab can be moved
    by the background page later. Instead we wait until the tab is
    successfully moved (then kCOMMAND_TAB_ATTACHED_COMPLETELY is delivered.)
  */

  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToUpdateCachedTabbar();
}

async function onTabDetached(aTab, aDetachInfo = {}) {
  if (gInitializing)
    return;
  tabContextMenu.close();
  var parent = aDetachInfo.oldParentTab;
  if (!parent)
    return;
  updateTabTwisty(parent);
  updateTabClosebox(parent);
  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateIndent();
  reserveToUpdateTabTooltip(parent);
  var ancestors = [parent].concat(getAncestorTabs(parent));
  for (let ancestor of ancestors) {
    updateTabsCount(ancestor);
  }

  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToUpdateCachedTabbar();
}

function onTabPinned(aTab) {
  tabContextMenu.close();
  reserveToPositionPinnedTabs();
  reserveToUpdateCachedTabbar();
}

function onTabUnpinned(aTab) {
  tabContextMenu.close();
  clearPinnedStyle(aTab);
  updateTabLabelOverflow(aTab);
  scrollToTab(aTab);
  //updateInvertedTabContentsOrder(aTab);
  reserveToPositionPinnedTabs();
  reserveToUpdateCachedTabbar();
}

function onTabShown(aTab) {
  tabContextMenu.close();
  reserveToPositionPinnedTabs();
  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateIndent();
  reserveToUpdateCachedTabbar();
}

function onTabHidden(aTab) {
  tabContextMenu.close();
  reserveToPositionPinnedTabs();
  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateIndent();
  reserveToUpdateCachedTabbar();
}

function onTabStateChanged(aTab) {
  if (aTab.apiTab.status == 'loading')
    aTab.classList.add(kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  else
    aTab.classList.remove(kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  reserveToUpdateLoadingState();
}

function onGroupTabDetected(aTab) {
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
    updateTab(aTab, { title }, { tab: aTab.apiTab });
  });
}

function onContextualIdentitiesUpdated() {
  updateContextualIdentitiesStyle();
  updateContextualIdentitiesSelector();
}


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
    case kCOMMAND_PING_TO_SIDEBAR: {
      if (aMessage.windowId == gTargetWindow)
        return Promise.resolve(true);
    }; break;

    case kCOMMAND_PUSH_TREE_STRUCTURE:
      if (aMessage.windowId == gTargetWindow)
        applyTreeStructureToTabs(getAllTabs(gTargetWindow), aMessage.structure);
      break;

    case kCOMMAND_NOTIFY_TAB_RESTORING:
      gRestoringTabCount++;
      break;

    case kCOMMAND_NOTIFY_TAB_RESTORED:
      gRestoringTabCount--;
      break;

    case kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED:
      onTabFaviconUpdated(getTabById(aMessage.tab), aMessage.favIconUrl);
      break;

    case kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE: {
      if (aMessage.windowId == gTargetWindow) return (async () => {
        await waitUntilTabsAreCreated(aMessage.tab);
        let tab = getTabById(aMessage.tab);
        if (!tab)
          return;
        let params = {
          collapsed: aMessage.collapsed,
          justNow:   aMessage.justNow,
          stack:     aMessage.stack
        };
        if (aMessage.manualOperation)
          manualCollapseExpandSubtree(tab, params);
        else
          collapseExpandSubtree(tab, params);
      })();
    }; break;

    case kCOMMAND_CHANGE_TAB_COLLAPSED_STATE: {
      if (aMessage.windowId == gTargetWindow) return (async () => {
        await waitUntilTabsAreCreated(aMessage.tab);
        let tab = getTabById(aMessage.tab);
        if (!tab)
          return;
        // Tree's collapsed state can be changed before this message is delivered,
        // so we should ignore obsolete messages.
        if (aMessage.byAncestor &&
            aMessage.collapsed != getAncestorTabs(tab).some(isSubtreeCollapsed))
          return;
        let params = {
          collapsed:   aMessage.collapsed,
          justNow:     aMessage.justNow,
          broadcasted: true,
          stack:       aMessage.stack
        };
        collapseExpandTab(tab, params);
      })();
    }; break;

    case kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.nextTab]));
        return moveTabsBefore(
          aMessage.tabs.map(getTabById),
          getTabById(aMessage.nextTab),
          aMessage
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tabs.concat([aMessage.previousTab]));
        return moveTabsAfter(
          aMessage.tabs.map(getTabById),
          getTabById(aMessage.previousTab),
          aMessage
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tabs);
        return removeTabsInternally(aMessage.tabs.map(getTabById), aMessage.options);
      })();

    case kCOMMAND_ATTACH_TAB_TO: {
      if (aMessage.windowId == gTargetWindow) {
        const promisedComplete = (async () => {
          await Promise.all([
            waitUntilTabsAreCreated([
              aMessage.child,
              aMessage.parent,
              aMessage.insertBefore,
              aMessage.insertAfter
            ]),
            waitUntilAllTreeChangesFromRemoteAreComplete()
          ]);
          log('attach tab from remote ', aMessage);
          let child  = getTabById(aMessage.child);
          let parent = getTabById(aMessage.parent);
          if (child && parent)
            await attachTabTo(child, parent, Object.assign({}, aMessage, {
              insertBefore: getTabById(aMessage.insertBefore),
              insertAfter:  getTabById(aMessage.insertAfter),
              inRemote:     false,
              broadcast:    false
            }));
          gTreeChangesFromRemote.splice(gTreeChangesFromRemote.indexOf(promisedComplete), 1);
        })();
        gTreeChangesFromRemote.push(promisedComplete);
        return promisedComplete;
      }
    }; break;

    case kCOMMAND_TAB_ATTACHED_COMPLETELY:
      return (async () => {
        await waitUntilTabsAreCreated([
          aMessage.tab,
          aMessage.parent
        ]);
        let tab = getTabById(aMessage.tab);
        if (tab && isActive(getTabById(aMessage.parent)))
          scrollToNewTab(tab);
      })();

    case kCOMMAND_DETACH_TAB: {
      if (aMessage.windowId == gTargetWindow) {
        const promisedComplete = (async () => {
          await Promise.all([
            waitUntilTabsAreCreated(aMessage.tab),
            waitUntilAllTreeChangesFromRemoteAreComplete()
          ]);
          let tab = getTabById(aMessage.tab);
          if (tab)
            detachTab(tab, aMessage);
          gTreeChangesFromRemote.splice(gTreeChangesFromRemote.indexOf(promisedComplete), 1);
        })();
        gTreeChangesFromRemote.push(promisedComplete);
        return promisedComplete;
      }
    }; break;

    case kCOMMAND_BLOCK_USER_OPERATIONS: {
      if (aMessage.windowId == gTargetWindow)
        blockUserOperationsIn(gTargetWindow, aMessage);
    }; break;

    case kCOMMAND_UNBLOCK_USER_OPERATIONS: {
      if (aMessage.windowId == gTargetWindow)
        unblockUserOperationsIn(gTargetWindow, aMessage);
    }; break;

    case kCOMMAND_BROADCAST_TAB_STATE: {
      if (!aMessage.tabs.length)
        break;
      return (async () => {
        await waitUntilTabsAreCreated(aMessage.tabs);
        let add    = aMessage.add || [];
        let remove = aMessage.remove || [];
        log('apply broadcasted tab state ', aMessage.tabs, {
          add:    add.join(','),
          remove: remove.join(',')
        });
        let modified = add.concat(remove);
        for (let tab of aMessage.tabs) {
          tab = getTabById(tab);
          if (!tab)
            continue;
          add.forEach(aState => tab.classList.add(aState));
          remove.forEach(aState => tab.classList.remove(aState));
          if (modified.indexOf(kTAB_STATE_AUDIBLE) > -1 ||
            modified.indexOf(kTAB_STATE_SOUND_PLAYING) > -1 ||
            modified.indexOf(kTAB_STATE_MUTED) > -1) {
            updateTabSoundButtonTooltip(tab);
            if (aMessage.bubbles)
              updateParentTab(getParentTab(tab));
          }
        }
      })();
    }; break;

    case kCOMMAND_CONFIRM_TO_CLOSE_TABS: {
      if (aMessage.windowId == gTargetWindow)
        return confirmToCloseTabs(aMessage.count);
    }; break;

    case kCOMMAND_BROADCAST_CURRENT_DRAG_DATA:
      gCurrentDragData = aMessage.dragData || null;
      break;

    case kCOMMAND_BROADCAST_API_REGISTERED:
      gExternalListenerAddons[aMessage.sender.id] = aMessage.message;
      if (aMessage.message.style)
        installStyleForAddon(aMessage.sender.id, aMessage.message.style)
      break;

    case kCOMMAND_BROADCAST_API_UNREGISTERED:
      uninstallStyleForAddon(aMessage.sender.id)
      delete gScrollLockedBy[aMessage.sender.id];
      delete gExternalListenerAddons[aMessage.sender.id];
      break;

    case kCOMMAND_SHOW_CONTAINER_SELECTOR:
      Commands.showContainerSelector();
      break;

    case kCOMMAND_SCROLL_TABBAR:
      switch (String(aMessage.by).toLowerCase()) {
        case 'lineup':
          smoothScrollBy(-gTabHeight * configs.scrollLines);
          break;

        case 'pageup':
          smoothScrollBy(-gTabBar.getBoundingClientRect().height + gTabHeight);
          break;

        case 'linedown':
          smoothScrollBy(gTabHeight * configs.scrollLines);
          break;

        case 'pagedown':
          smoothScrollBy(gTabBar.getBoundingClientRect().height - gTabHeight);
          break;

        default:
          switch (String(aMessage.to).toLowerCase()) {
            case 'top':
              smoothScrollTo({ position: 0 });
              break;

            case 'bottom':
              smoothScrollTo({ position: gTabBar.scrollTopMax });
              break;
          }
          break;
      }
      break;
  }
}

function onMessageExternal(aMessage, aSender) {
  switch (aMessage.type) {
    case kTSTAPI_SCROLL_LOCK:
      gScrollLockedBy[aSender.id] = true;
      return Promise.resolve(true);

    case kTSTAPI_SCROLL_UNLOCK:
      delete gScrollLockedBy[aSender.id];
      return Promise.resolve(true);

    case kTSTAPI_SCROLL:
      return (async () => {
        let params = {};
        if ('tab' in aMessage) {
          await waitUntilTabsAreCreated(aMessage.tab);
          params.tab = getTabById(aMessage.tab);
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
        return scrollTo(params).then(() => {
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
      for (let tab of getAllTabs()) {
        updateTab(tab, tab.apiTab, { forceApply: true });
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
      if (configs.sidebarPosition == kTABBAR_POSITION_RIGHT) {
        rootClasses.add('right');
        rootClasses.remove('left');
        gIndentProp = 'margin-right';
      }
      else {
        rootClasses.add('left');
        rootClasses.remove('right');
        gIndentProp = 'margin-left';
      }
      updateIndent({ force: true });
      break;

    case 'sidebarScrollbarPosition': {
      let position = configs.sidebarScrollbarPosition;
      if (position == kTABBAR_SCROLLBAR_POSITION_AUTO)
        position = configs.sidebarPosition;
      if (position == kTABBAR_SCROLLBAR_POSITION_RIGHT) {
        rootClasses.add('right-scrollbar');
        rootClasses.remove('left-scrollbar');
      }
      else {
        rootClasses.add('left-scrollbar');
        rootClasses.remove('right-scrollbar');
      }
      updateIndent({ force: true });
    }; break;

    case 'baseIndent':
    case 'minIndent':
    case 'maxTreeLevel':
    case 'indentAutoShrink':
    case 'indentAutoShrinkOnlyForVisible':
      updateIndent({ force: true });
      break;

    case 'style':
      location.reload();
      break;

    case 'faviconizePinnedTabs':
      reserveToPositionPinnedTabs();
      break;

    case 'scrollbarMode':
      rootClasses.remove(kTABBAR_STATE_NARROW_SCROLLBAR);
      rootClasses.remove(kTABBAR_STATE_NO_SCROLLBAR);
      rootClasses.remove(kTABBAR_STATE_OVERLAY_SCROLLBAR);
      switch (configs.scrollbarMode) {
        default:
        case kTABBAR_SCROLLBAR_MODE_DEFAULT:
          break;
        case kTABBAR_SCROLLBAR_MODE_NARROW:
          rootClasses.add(kTABBAR_STATE_NARROW_SCROLLBAR);
          break;
        case kTABBAR_SCROLLBAR_MODE_HIDE:
          rootClasses.add(kTABBAR_STATE_NO_SCROLLBAR);
          break;
        case kTABBAR_SCROLLBAR_MODE_OVERLAY:
          rootClasses.add(kTABBAR_STATE_OVERLAY_SCROLLBAR);
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
        rootClasses.add(kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE);
      else
        rootClasses.remove(kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE);
      break;

    case 'showNewTabActionSelector':
      if (configs[aChangedKey])
        rootClasses.add(kTABBAR_STATE_NEWTAB_ACTION_SELECTABLE);
      else
        rootClasses.remove(kTABBAR_STATE_NEWTAB_ACTION_SELECTABLE);
      break;

    case 'useCachedTree':
      if (configs[aChangedKey]) {
        reserveToUpdateCachedTabbar();
      }
      else {
        clearWindowCache();
        location.reload();
      }
      break;

    case 'simulateSVGContextFill':
      if (configs[aChangedKey])
        rootClasses.add('simulate-svg-context-fill');
      else
        rootClasses.remove('simulate-svg-context-fill');
      break;
  }
}
