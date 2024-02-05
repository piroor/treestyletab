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
 * Portions created by the Initial Developer are Copyright (C) 2011-2024
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

import EventListenerManager from '/extlib/EventListenerManager.js';
import { SequenceMatcher } from '/extlib/diff.js';

import {
  log as internalLogger,
  wait,
  nextFrame,
  configs,
  shouldApplyAnimation
} from '/common/common.js';

import * as ApiTabs from '/common/api-tabs.js';
import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TSTAPI from '/common/tst-api.js';

import Tab from '/common/Tab.js';

import * as BackgroundConnection from './background-connection.js';
import * as CollapseExpand from './collapse-expand.js';
import * as EventUtils from './event-utils.js';
import * as RestoringTabCount from './restoring-tab-count.js';
import * as SidebarTabs from './sidebar-tabs.js';
import * as Size from './size.js';

export const onPositionUnlocked = new EventListenerManager();
export const onVirtualScrollViewportUpdated = new EventListenerManager();

function log(...args) {
  internalLogger('sidebar/scroll', ...args);
}


const mPinnedScrollBox  = document.querySelector('#pinned-tabs-container-wrapper');
const mNormalScrollBox  = document.querySelector('#normal-tabs-container-wrapper');
const mTabBar           = document.querySelector('#tabbar');
const mOutOfViewTabNotifier = document.querySelector('#out-of-view-tab-notifier');

export function init(scrollPosition) {
  // We need to register the lister as non-passive to cancel the event.
  // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#Improving_scrolling_performance_with_passive_listeners
  document.addEventListener('wheel', onWheel, { capture: true, passive: false });
  mPinnedScrollBox.addEventListener('scroll', onScroll);
  mNormalScrollBox.addEventListener('scroll', onScroll);
  browser.runtime.onMessage.addListener(onMessage);
  BackgroundConnection.onMessage.addListener(onBackgroundMessage);
  TSTAPI.onMessageExternal.addListener(onMessageExternal);
  SidebarTabs.onNormalTabsChanged.addListener(_tab => {
    reserveToRenderVirtualScrollViewport();
  });

  reserveToRenderVirtualScrollViewport();
  if (typeof scrollPosition == 'number') {
    log('restore scroll position');
    cancelRunningScroll();
    scrollTo({
      position: scrollPosition,
      justNow:  true
    });
  }
}

/* virtual scrolling */

let mScrollingInternallyCount = 0;

export function reserveToRenderVirtualScrollViewport() {
  if (mScrollingInternallyCount > 0)
    return;

  const startAt = `${Date.now()}-${parseInt(Math.random() * 65000)}`;
  renderVirtualScrollViewport.lastStartedAt = startAt;
  window.requestAnimationFrame(() => {
    if (renderVirtualScrollViewport.lastStartedAt != startAt)
      return;
    renderVirtualScrollViewport();
  });
}

let mLastRenderedVirtualScrollTabIds = [];

function renderVirtualScrollViewport(scrollPosition = undefined) {
  renderVirtualScrollViewport.lastStartedAt = null;

  const startAt = Date.now();

  const windowId = TabsStore.getCurrentWindowId();
  const win      = TabsStore.windows.get(windowId);
  if (!win.containerElement) // not initialized yet
    return;

  const tabSize               = Size.getTabHeight();
  const renderableTabs        = Tab.getVirtualScrollRenderableTabs(windowId);
  const allRenderableTabsSize = tabSize * renderableTabs.length;

  // We need to use min-height instead of height for a flexbox.
  const minHeight              = `${allRenderableTabsSize}px`;
  const allTabsSizeHolder      = win.containerElement.parentNode;
  const allTabsSizeHolderStyle = allTabsSizeHolder.style;
  const resized = allTabsSizeHolder.dataset.height != allRenderableTabsSize;
  if (resized) {
    allTabsSizeHolderStyle.minHeight = minHeight;
    allTabsSizeHolder.dataset.height = allRenderableTabsSize;
    onVirtualScrollViewportUpdated.dispatch(resized);
  }

  const range = document.createRange();
  //range.selectNodeContents(mTabBar);
  //range.setEndBefore(mNormalScrollBox);
  const precedingAreaSize = mPinnedScrollBox.getBoundingClientRect().height; //range.getBoundingClientRect().height;
  range.selectNodeContents(mTabBar);
  range.setStartAfter(mNormalScrollBox);
  const followingAreaSize = range.getBoundingClientRect().height;
  range.detach();
  const maxViewportSize     = mTabBar.getBoundingClientRect().height - precedingAreaSize - followingAreaSize;
  const currentViewPortSize = mNormalScrollBox.getBoundingClientRect().height;
  // The current box size can be 0 while initialization, so fallback to the max size for safety.
  const viewPortSize = currentViewPortSize || maxViewportSize;
  const renderablePaddingSize = viewPortSize;
  scrollPosition = Math.max(
    0,
    Math.min(
      allRenderableTabsSize - viewPortSize,
      typeof scrollPosition == 'number' ?
        scrollPosition :
        mNormalScrollBox.scrollTop
    )
  );

  const firstRenderableIndex = Math.max(
    0,
    Math.floor((scrollPosition - renderablePaddingSize) / tabSize)
  );
  const lastRenderableIndex = Math.max(
    0,
    Math.min(
      renderableTabs.length - 1,
      Math.ceil((scrollPosition + viewPortSize + renderablePaddingSize) / tabSize)
    )
  );

  const toBeRenderedTabIds = renderableTabs.slice(firstRenderableIndex, lastRenderableIndex + 1).map(tab => tab.id);
  const renderOperations = (new SequenceMatcher(mLastRenderedVirtualScrollTabIds, toBeRenderedTabIds)).operations();
  log('renderVirtualScrollViewport ', {
    firstRenderableIndex,
    lastRenderableIndex,
    old: mLastRenderedVirtualScrollTabIds,
    new: toBeRenderedTabIds,
    renderOperations,
    scrollPosition,
    viewPortSize,
    allRenderableTabsSize,
    maxViewportSize,
    currentViewPortSize,
    //precedingAreaSize,
    //followingAreaSize,
  });

  const toBeRenderedTabIdSet = new Set(toBeRenderedTabIds);
  for (const operation of renderOperations) {
    const [tag, fromStart, fromEnd, toStart, toEnd] = operation;
    switch (tag) {
      case 'equal':
        break;

      case 'delete': {
        const ids = mLastRenderedVirtualScrollTabIds.slice(fromStart, fromEnd);
        //log('delete: ', { fromStart, fromEnd, toStart, toEnd }, ids);
        for (const id of ids) {
          const tab = Tab.get(id);
          // We don't need to remove already rendered tab,
          // because it is automatically moved by insertBefore().
          if (toBeRenderedTabIdSet.has(id) ||
              !tab ||
              !mNormalScrollBox.contains(tab.$TST.element))
            continue;
          SidebarTabs.unrenderTab(tab);
        }
      }; break;

      case 'insert':
      case 'replace': {
        const deleteIds = mLastRenderedVirtualScrollTabIds.slice(fromStart, fromEnd);
        const insertIds = toBeRenderedTabIds.slice(toStart, toEnd);
        //log('insert or replace: ', { fromStart, fromEnd, toStart, toEnd }, deleteIds, ' => ', insertIds);
        for (const id of deleteIds) {
          const tab = Tab.get(id);
          // We don't need to remove already rendered tab,
          // because it is automatically moved by insertBefore().
          if (toBeRenderedTabIdSet.has(id) ||
              !tab ||
              !mNormalScrollBox.contains(tab.$TST.element))
            continue;
          SidebarTabs.unrenderTab(tab);
        }
        const referenceTab = fromEnd < mLastRenderedVirtualScrollTabIds.length ?
          Tab.get(mLastRenderedVirtualScrollTabIds[fromEnd]) :
          null;
        for (const id of insertIds) {
          SidebarTabs.renderTabBefore(Tab.get(id), referenceTab);
        }
      }; break;
    }
  }

  const renderedOffset = tabSize * firstRenderableIndex;
  const transform      = `translateY(${renderedOffset}px)`;
  const containerStyle = win.containerElement.style;
  if (containerStyle.transform != transform)
    containerStyle.transform = transform;

  mLastRenderedVirtualScrollTabIds = toBeRenderedTabIds;

  log(`${Date.now() - startAt} msec, offset = ${renderedOffset}`);
}

function getScrollBoxFor(tab) {
  if (!tab || !tab.pinned)
    return mNormalScrollBox; // the default
  return mPinnedScrollBox;
}

export function getTabRect(tab) {
  if (tab.pinned)
    return tab.$TST.element.getBoundingClientRect();

  const renderableTabs = Tab.getVirtualScrollRenderableTabs(tab.windowId).map(tab => tab.id);
  const tabSize        = Size.getTabHeight();
  const index          = renderableTabs.indexOf(tab.id);
  const scrollBox      = getScrollBoxFor(tab);
  const scrollBoxRect  = scrollBox.getBoundingClientRect();
  const tabTop         = tabSize * index + scrollBoxRect.top - scrollBox.scrollTop;
  return {
    top:    tabTop,
    bottom: tabTop + tabSize,
    height: tabSize,
  };
}


/* basic operations */

function scrollTo(params = {}) {
  log('scrollTo ', params);
  if (!params.justNow &&
      shouldApplyAnimation(true) &&
      configs.smoothScrollEnabled)
    return smoothScrollTo(params);

  //cancelPerformingAutoScroll();
  const scrollBox = getScrollBoxFor(params.tab);
  const scrollTop = params.tab ?
    scrollBox.scrollTop + calculateScrollDeltaForTab(params.tab) :
    typeof params.position == 'number' ?
      params.position :
      typeof params.delta == 'number' ?
        mNormalScrollBox.scrollTop + params.delta :
        undefined;
  if (scrollTop === undefined)
    throw new Error('No parameter to indicate scroll position');

  // render before scroll, to prevent showing blank area
  mScrollingInternallyCount++;
  renderVirtualScrollViewport(scrollTop);
  scrollBox.scrollTop = scrollTop;
  window.requestAnimationFrame(() => {
    mScrollingInternallyCount--;
  });
}

function cancelRunningScroll() {
  scrollToTab.stopped = true;
  stopSmoothScroll();
}

function calculateScrollDeltaForTab(tab, { over } = {}) {
  tab = Tab.get(tab && tab.id);
  if (!tab)
    return 0;

  tab = tab.$TST.collapsed && tab.$TST.nearestVisibleAncestorOrSelf || tab;

  const tabRect       = getTabRect(tab);
  const scrollBoxRect = getScrollBoxFor(tab).getBoundingClientRect();
  const overScrollOffset = over === false ?
    0 :
    Math.ceil(tabRect.height / 2);
  let delta = 0;
  if (scrollBoxRect.bottom < tabRect.bottom) { // should scroll down
    delta = tabRect.bottom - scrollBoxRect.bottom + overScrollOffset;
  }
  else if (scrollBoxRect.top > tabRect.top) { // should scroll up
    delta = tabRect.top - scrollBoxRect.top - overScrollOffset;
  }
  log('calculateScrollDeltaForTab ', tab.id, {
    delta,
    tabTop:          tabRect.top,
    tabBottom:       tabRect.bottom,
    scrollBoxBottom: scrollBoxRect.bottom
  });
  return delta;
}

export function isTabInViewport(tab, { allowPartial } = {}) {
  tab = Tab.get(tab && tab.id);
  if (!TabsStore.ensureLivingTab(tab))
    return false;

  if (tab.pinned)
    return true;

  const tabRect       = getTabRect(tab);
  const allowedOffset = allowPartial ? (tabRect.height / 2) : 0;
  const scrollBoxRect = getScrollBoxFor(tab).getBoundingClientRect();
  log('isTabInViewport ', tab.id, {
    allowedOffset,
    tabTop:         tabRect.top + allowedOffset,
    tabBottom:      tabRect.bottom - allowedOffset,
    viewPortTop:    scrollBoxRect.top,
    viewPortBottom: scrollBoxRect.bottom,
  });
  return (
    tabRect.top + allowedOffset >= scrollBoxRect.top &&
    tabRect.bottom - allowedOffset <= scrollBoxRect.bottom
  );
}

async function smoothScrollTo(params = {}) {
  log('smoothScrollTo ', params, new Error().stack);
  //cancelPerformingAutoScroll(true);

  smoothScrollTo.stopped = false;

  const scrollBox = getScrollBoxFor(params.tab);

  let delta, startPosition, endPosition;
  if (params.tab) {
    startPosition = scrollBox.scrollTop;
    delta       = calculateScrollDeltaForTab(params.tab);
    endPosition = startPosition + delta;
  }
  else if (typeof params.position == 'number') {
    startPosition = scrollBox.scrollTop;
    endPosition = params.position;
    delta       = endPosition - startPosition;
  }
  else if (typeof params.delta == 'number') {
    startPosition = scrollBox.scrollTop;
    endPosition = startPosition + params.delta;
    delta       = params.delta;
  }
  else {
    throw new Error('No parameter to indicate scroll position');
  }
  smoothScrollTo.currentOffset = delta;

  const duration  = Math.max(0, typeof params.duration == 'number' ? params.duration : configs.smoothScrollDuration);
  const startTime = Date.now();

  return new Promise((resolve, _reject) => {
    const radian = 90 * Math.PI / 180;
    const scrollStep = () => {
      if (smoothScrollTo.stopped) {
        smoothScrollTo.currentOffset = 0;
        //reject('smooth scroll is canceled');
        resolve();
        return;
      }
      const nowTime = Date.now();
      const spentTime = nowTime - startTime;
      if (spentTime >= duration) {
        scrollTo({
          position: endPosition,
          justNow: true
        });
        smoothScrollTo.stopped       = true;
        smoothScrollTo.currentOffset = 0;
        resolve();
        return;
      }
      const power        = Math.sin(spentTime / duration * radian);
      const currentDelta = parseInt(delta * power);
      const newPosition  = startPosition + currentDelta;
      scrollTo({
        position: newPosition,
        justNow:  true
      });
      smoothScrollTo.currentOffset = currentDelta;
      window.requestAnimationFrame(scrollStep);
    };
    window.requestAnimationFrame(scrollStep);
  });
}
smoothScrollTo.currentOffset= 0;

async function smoothScrollBy(delta) {
  return smoothScrollTo({
    position: getScrollBoxFor(Tab.getActiveTab(TabsStore.getCurrentWindowId())).scrollTop + delta,
  });
}

function stopSmoothScroll() {
  smoothScrollTo.stopped = true;
}

/* advanced operations */

export function scrollToNewTab(tab, options = {}) {
  if (!canScrollToTab(tab))
    return;

  if (configs.scrollToNewTabMode == Constants.kSCROLL_TO_NEW_TAB_IF_POSSIBLE) {
    const activeTab = Tab.getActiveTab(TabsStore.getCurrentWindowId());
    scrollToTab(tab, {
      ...options,
      anchor:            !activeTab.pinned && isTabInViewport(activeTab) && activeTab,
      notifyOnOutOfView: true
    });
  }
}

function canScrollToTab(tab) {
  tab = Tab.get(tab && tab.id);
  return (TabsStore.ensureLivingTab(tab) &&
          !tab.hidden);
}

export async function scrollToTab(tab, options = {}) {
  scrollToTab.lastTargetId = null;

  log('scrollToTab to ', tab && tab.id, options.anchor && options.anchor.id, options,
      { stack: configs.debug && new Error().stack });
  cancelRunningScroll();
  if (!canScrollToTab(tab)) {
    log('=> unscrollable');
    return;
  }

  scrollToTab.stopped = false;
  cancelNotifyOutOfViewTab();
  //cancelPerformingAutoScroll(true);

  await nextFrame();
  if (scrollToTab.stopped)
    return;
  cancelNotifyOutOfViewTab();

  const anchorTab = options.anchor;
  const hasAnchor = TabsStore.ensureLivingTab(anchorTab) && anchorTab != tab;
  const openedFromPinnedTab = hasAnchor && anchorTab.pinned;

  if (isTabInViewport(tab) &&
      (!hasAnchor ||
       !openedFromPinnedTab)) {
    log('=> already visible');
    return;
  }

  // wait for one more frame, to start collapse/expand animation
  await nextFrame();
  if (scrollToTab.stopped)
    return;
  cancelNotifyOutOfViewTab();
  scrollToTab.lastTargetId = tab.id;

  const scrollBox = getScrollBoxFor(tab);
  if (hasAnchor && !anchorTab.pinned) {
    const targetTabRect = getTabRect(tab);
    const anchorTabRect = getTabRect(anchorTab);
    const scrollBoxRect = scrollBox.getBoundingClientRect();
    let delta = calculateScrollDeltaForTab(tab, { over: false });
    if (targetTabRect.top > anchorTabRect.top) {
      log('=> will scroll down');
      const boundingHeight = targetTabRect.bottom - anchorTabRect.top;
      const overHeight     = boundingHeight - scrollBoxRect.height;
      if (overHeight > 0) {
        delta -= overHeight;
        if (options.notifyOnOutOfView)
          notifyOutOfViewTab(tab);
      }
      log('calculated result: ', {
        boundingHeight, overHeight, delta,
        container:      scrollBoxRect.height
      });
    }
    else if (targetTabRect.bottom < anchorTabRect.bottom) {
      log('=> will scroll up');
      const boundingHeight = anchorTabRect.bottom - targetTabRect.top;
      const overHeight     = boundingHeight - scrollBoxRect.height;
      if (overHeight > 0)
        delta += overHeight;
      log('calculated result: ', {
        boundingHeight, overHeight, delta,
        container:      scrollBoxRect.height
      });
    }
    await scrollTo({
      ...options,
      position: scrollBox.scrollTop + delta,
    });
  }
  else {
    await scrollTo({
      ...options,
      tab
    });
  }
  // A tab can be moved after the tabbar is scrolled to the tab.
  // To retry "scroll to tab" behavior for such cases, we need to
  // keep "last scrolled-to tab" information until the tab is
  // actually moved.
  await wait(configs.tabBunchesDetectionTimeout);
  if (scrollToTab.stopped)
    return;
  const retryOptions = {
    retryCount: options.retryCount || 0,
    anchor:     options.anchor
  };
  if (scrollToTab.lastTargetId == tab.id &&
      !isTabInViewport(tab) &&
      (!options.anchor ||
       !isTabInViewport(options.anchor)) &&
      retryOptions.retryCount < 3) {
    retryOptions.retryCount++;
    return scrollToTab(tab, retryOptions);
  }
  if (scrollToTab.lastTargetId == tab.id)
    scrollToTab.lastTargetId = null;
}
scrollToTab.lastTargetId = null;

/*
function scrollToTabSubtree(tab) {
  return scrollToTab(tab.$TST.lastDescendant, {
    anchor:            tab,
    notifyOnOutOfView: true
  });
}

function scrollToTabs(tabs) {
  return scrollToTab(tabs[tabs.length - 1], {
    anchor:            tabs[0],
    notifyOnOutOfView: true
  });
}
*/

export function autoScrollOnMouseEvent(event) {
  const scrollBox = event.target.closest(`#${mPinnedScrollBox.id}, #${mNormalScrollBox.id}`);
  if (!scrollBox || !scrollBox.classList.contains(Constants.kTABBAR_STATE_OVERFLOW))
    return;

  const startAt = `${Date.now()}-${parseInt(Math.random() * 65000)}`;
  autoScrollOnMouseEvent.lastStartedAt = startAt;
  window.requestAnimationFrame(() => {
    if (autoScrollOnMouseEvent.lastStartedAt != startAt)
      return;

    const tabbarRect = scrollBox.getBoundingClientRect();
    const scrollPixels = Math.round(Size.getTabHeight() * 0.5);
    if (event.clientY < tabbarRect.top + autoScrollOnMouseEvent.areaSize) {
      if (scrollBox.scrollTop > 0)
        scrollBox.scrollTop -= scrollPixels;
    }
    else if (event.clientY > tabbarRect.bottom - autoScrollOnMouseEvent.areaSize) {
      if (scrollBox.scrollTop < scrollBox.scrollTopMax)
        scrollBox.scrollTop += scrollPixels;
    }
  });
}
autoScrollOnMouseEvent.areaSize = 20;


async function notifyOutOfViewTab(tab) {
  tab = Tab.get(tab && tab.id);
  if (RestoringTabCount.hasMultipleRestoringTabs()) {
    log('notifyOutOfViewTab: skip until completely restored');
    wait(100).then(() => notifyOutOfViewTab(tab));
    return;
  }
  await nextFrame();
  cancelNotifyOutOfViewTab();
  if (tab && isTabInViewport(tab))
    return;
  mOutOfViewTabNotifier.classList.add('notifying');
  await wait(configs.outOfViewTabNotifyDuration);
  cancelNotifyOutOfViewTab();
}

function cancelNotifyOutOfViewTab() {
  mOutOfViewTabNotifier.classList.remove('notifying');
}


/* event handling */

async function onWheel(event) {
  // Ctrl-WheelScroll produces zoom-in/out on all platforms
  // including macOS (not Meta-WheelScroll!).
  // Pinch-in/out on macOS also produces zoom-in/out and
  // it is cancelable via synthesized `wheel` event.
  // (See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1777199#c5 )
  if (!configs.zoomable &&
      event.ctrlKey) {
    event.preventDefault();
    return;
  }

  if (!TSTAPI.isScrollLocked()) {
    cancelRunningScroll();
    return;
  }

  event.stopImmediatePropagation();
  event.preventDefault();

  const tab = EventUtils.getTabFromEvent(event);
  const scrollBox = getScrollBoxFor(tab);
  TSTAPI.notifyScrolled({
    tab,
    scrollContainer: scrollBox,
    overflow: scrollBox.classList.contains(Constants.kTABBAR_STATE_OVERFLOW),
    event
  });
}

function onScroll(event) {
  if (event.currentTarget == mNormalScrollBox)
    reserveToRenderVirtualScrollViewport();
  reserveToSaveScrollPosition();
}

function reserveToSaveScrollPosition() {
  if (reserveToSaveScrollPosition.reserved)
    clearTimeout(reserveToSaveScrollPosition.reserved);
  reserveToSaveScrollPosition.reserved = setTimeout(() => {
    delete reserveToSaveScrollPosition.reserved;
    browser.sessions.setWindowValue(
      TabsStore.getCurrentWindowId(),
      Constants.kWINDOW_STATE_SCROLL_POSITION,
      mNormalScrollBox.scrollTop
    ).catch(ApiTabs.createErrorSuppressor());
  }, 150);
}

const mReservedScrolls = new WeakMap();

function reserveToScrollToTab(tab, options = {}) {
  if (!tab)
    return;

  const scrollBox = getScrollBoxFor(tab);
  const reservedScroll = {
    tabId: tab.id,
    options,
  };
  mReservedScrolls.set(scrollBox, reservedScroll);
  window.requestAnimationFrame(() => {
    if (mReservedScrolls.get(scrollBox) != reservedScroll)
      return;
    mReservedScrolls.delete(scrollBox);
    const options = reservedScroll.options;
    delete reservedScroll.tabId;
    delete reservedScroll.options;
    scrollToTab(tab, options);
  });
}

function reserveToScrollToNewTab(tab) {
  if (!tab)
    return;
  const scrollBox = getScrollBoxFor(tab);
  const reservedScroll = {
    tabId: tab.id,
  };
  mReservedScrolls.set(scrollBox, reservedScroll);
  window.requestAnimationFrame(() => {
    if (mReservedScrolls.get(scrollBox) != reservedScroll)
      return;
    mReservedScrolls.delete(scrollBox);
    delete reservedScroll.tabId;
    scrollToNewTab(tab);
  });
}


function reReserveScrollingForTab(tab) {
  if (!tab)
    return false;
  if (reserveToScrollToTab.reservedTabId == tab.id) {
    reserveToScrollToTab(tab);
    return true;
  }
  if (reserveToScrollToNewTab.reservedTabId == tab.id) {
    reserveToScrollToNewTab(tab);
    return true;
  }
  return false;
}


function onMessage(message, _sender, _respond) {
  if (!message ||
      typeof message.type != 'string' ||
      message.type.indexOf('treestyletab:') != 0)
    return;

  if (message.windowId &&
      message.windowId != TabsStore.getCurrentWindowId())
    return;

  //log('onMessage: ', message, sender);
  switch (message.type) {
    case Constants.kCOMMAND_GET_RENDERED_TAB_IDS:
      return Promise.resolve([...new Set([
        ...Tab.getPinnedTabs(message.windowId).map(tab => tab.id),
        ...mLastRenderedVirtualScrollTabIds,
      ])]);

    case Constants.kCOMMAND_ASK_TAB_IS_IN_VIEWPORT:
      return Promise.resolve(isTabInViewport(Tab.get(message.tabId), {
        allowPartial: message.allowPartial,
      }));
  }
}

async function onBackgroundMessage(message) {
  switch (message.type) {
    case Constants.kCOMMAND_NOTIFY_TAB_ATTACHED_COMPLETELY: {
      await Tab.waitUntilTracked([
        message.tabId,
        message.parentId
      ]);
      const tab = Tab.get(message.tabId);
      const parent = Tab.get(message.parentId);
      if (tab && parent && parent.active)
        reserveToScrollToNewTab(tab);
    }; break;

    case Constants.kCOMMAND_SCROLL_TABBAR: {
      const activeTab = Tab.getActiveTab(TabsStore.getCurrentWindowId());
      const scrollBox = getScrollBoxFor(activeTab);
      switch (String(message.by).toLowerCase()) {
        case 'lineup':
          smoothScrollBy(-Size.getTabHeight() * configs.scrollLines);
          break;

        case 'pageup':
          smoothScrollBy(-scrollBox.getBoundingClientRect().height + Size.getTabHeight());
          break;

        case 'linedown':
          smoothScrollBy(Size.getTabHeight() * configs.scrollLines);
          break;

        case 'pagedown':
          smoothScrollBy(scrollBox.getBoundingClientRect().height - Size.getTabHeight());
          break;

        default:
          switch (String(message.to).toLowerCase()) {
            case 'top':
              smoothScrollTo({ position: 0 });
              break;

            case 'bottom':
              smoothScrollTo({ position: scrollBox.scrollTopMax });
              break;
          }
          break;
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_CREATED: {
      await Tab.waitUntilTracked(message.tabId);
      if (message.maybeMoved)
        await SidebarTabs.waitUntilNewTabIsMoved(message.tabId);
      const tab = Tab.get(message.tabId);
      if (!tab) // it can be closed while waiting
        break;
      const needToWaitForTreeExpansion = (
        !tab.active &&
        !Tab.getActiveTab(tab.windowId).pinned
      );
      if (shouldApplyAnimation(true) ||
          needToWaitForTreeExpansion) {
        wait(10).then(() => { // wait until the tab is moved by TST itself
          const parent = tab.$TST.parent;
          if (parent && parent.$TST.subtreeCollapsed) // possibly collapsed by other trigger intentionally
            return;
          const active = tab.active;
          CollapseExpand.setCollapsed(tab, { // this is called to scroll to the tab by the "last" parameter
            collapsed: false,
            anchor:    Tab.getActiveTab(tab.windowId),
            last:      true
          });
          if (!active)
            notifyOutOfViewTab(tab);
        });
      }
      else {
        reserveToScrollToNewTab(tab);
      }
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_ACTIVATED:
    case Constants.kCOMMAND_NOTIFY_TAB_UNPINNED:
      await Tab.waitUntilTracked(message.tabId);
      reserveToScrollToTab(Tab.get(message.tabId));
      break;

    case Constants.kCOMMAND_BROADCAST_TAB_STATE: {
      if (!message.tabIds.length ||
          message.tabIds.length > 1 ||
          !message.add ||
          !message.add.includes(Constants.kTAB_STATE_BUNDLED_ACTIVE))
        break;
      await Tab.waitUntilTracked(message.tabIds);
      const tab = Tab.get(message.tabIds[0]);
      if (!tab ||
          tab.active)
        break;
      const bundled = message.add.includes(Constants.kTAB_STATE_BUNDLED_ACTIVE);
      const activeTab = bundled ?
        tab.$TST.bundledTab : // bundled-active state may be applied before the bundled tab become active
        Tab.getActiveTab(tab.windowId);
      reserveToScrollToTab(tab, {
        anchor:            !activeTab.pinned && isTabInViewport(activeTab) && activeTab,
        notifyOnOutOfView: true
      });
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_MOVED:
    case Constants.kCOMMAND_NOTIFY_TAB_INTERNALLY_MOVED: {
      await Tab.waitUntilTracked(message.tabId);
      const tab = Tab.get(message.tabId);
      if (!tab) // it can be closed while waiting
        break;
      if (!reReserveScrollingForTab(tab) &&
          tab.active)
        reserveToScrollToTab(tab);
    }; break;
  }
}

function onMessageExternal(message, _aSender) {
  switch (message.type) {
    case TSTAPI.kSCROLL:
      return (async () => {
        const params = {};
        const currentWindow = TabsStore.getCurrentWindowId();
        if ('tab' in message) {
          await Tab.waitUntilTracked(message.tab);
          params.tab = Tab.get(message.tab);
          if (!params.tab || params.tab.windowId != currentWindow)
            return;
        }
        else {
          const windowId = message.window || message.windowId;
          if (windowId == 'active') {
            const currentWindow = await browser.windows.get(TabsStore.getCurrentWindowId());
            if (!currentWindow.focused)
              return;
          }
          else if (windowId != currentWindow) {
            return;
          }
          if ('delta' in message) {
            params.delta = message.delta;
            if (typeof params.delta == 'string')
              params.delta = Size.calc(params.delta);
          }
          if ('position' in message) {
            params.position = message.position;
            if (typeof params.position == 'string')
              params.position = Size.calc(params.position);
          }
          if ('duration' in message && typeof message.duration == 'number')
            params.duration = message.duration;
        }
        return scrollTo(params).then(() => {
          return true;
        });
      })();

    case TSTAPI.kSTOP_SCROLL:
      return (async () => {
        const currentWindow = TabsStore.getCurrentWindowId();
        const windowId = message.window || message.windowId;
        if (windowId == 'active') {
          const currentWindow = await browser.windows.get(TabsStore.getCurrentWindowId());
          if (!currentWindow.focused)
            return;
        }
        else if (windowId != currentWindow) {
          return;
        }
        cancelRunningScroll();
        return true;
      })();
  }
}

CollapseExpand.onUpdating.addListener((tab, options) => {
  if (!configs.scrollToExpandedTree)
    return;
  if (!tab.pinned)
    reserveToRenderVirtualScrollViewport();
  if (options.last)
    scrollToTab(tab, {
      anchor:            options.anchor,
      notifyOnOutOfView: true
    });
});

CollapseExpand.onUpdated.addListener((tab, options) => {
  if (!configs.scrollToExpandedTree)
    return;
  if (!tab.pinned)
    reserveToRenderVirtualScrollViewport();
  if (options.last)
    scrollToTab(tab, {
      anchor:            options.anchor,
      notifyOnOutOfView: true
    });
  else if (tab.active && !options.collapsed)
    scrollToTab(tab);
});


// Simulate "lock tab sizing while closing tabs via mouse click" behavior of Firefox itself
// https://github.com/piroor/treestyletab/issues/2691
// https://searchfox.org/mozilla-central/rev/27932d4e6ebd2f4b8519865dad864c72176e4e3b/browser/base/content/tabbrowser-tabs.js#1207
export function tryLockPosition(tabIds) {
  if (!configs.simulateLockTabSizing ||
      tabIds.every(id => {
        const tab = Tab.get(id);
        return !tab || tab.pinned || tab.hidden;
      }))
    return;

  // Don't lock scroll position when the last tab is closed.
  const lastTab = Tab.getLastVisibleTab();
  if (tabIds.includes(lastTab.id)) {
    if (tryLockPosition.tabIds.size > 0) {
      // but we need to add tabs to the list of "close with locked scroll position"
      // tabs to prevent unexpected unlocking.
      for (const id of tabIds) {
        tryLockPosition.tabIds.add(id);
      }
    }
    return;
  }

  // Lock scroll position only when the closing affects to the max scroll position.
  if (mNormalScrollBox.scrollTop < mNormalScrollBox.scrollTopMax - Size.getTabHeight())
    return;

  for (const id of tabIds) {
    tryLockPosition.tabIds.add(id);
  }

  log('tryLockPosition');
  const spacer = mNormalScrollBox.querySelector(`.${Constants.kTABBAR_SPACER}`);
  const count = parseInt(spacer.dataset.removedTabsCount || 0) + 1;
  spacer.style.minHeight = `${Size.getTabHeight() * count}px`;
  spacer.dataset.removedTabsCount = count;

  if (!tryUnlockPosition.listening) {
    tryUnlockPosition.listening = true;
    window.addEventListener('mousemove', tryUnlockPosition);
    window.addEventListener('mouseout', tryUnlockPosition);
  }
}
tryLockPosition.tabIds = new Set();

function tryUnlockPosition(event) {
  log('tryUnlockPosition ', event);
  switch (event && event.type) {
    case 'mouseout':
      const relatedTarget = event.relatedTarget;
      if (relatedTarget && relatedTarget.ownerDocument == document) {
        log(' => ignore mouseout in the tabbar window itself');
        return;
      }

    case 'mousemove':
      if (tryUnlockPosition.contextMenuOpen ||
          (event.type == 'mousemove' && event.target.closest('#tabContextMenu'))) {
        log(' => ignore events while the context menu is opened');
        return;
      }
      if (event.type == 'mousemove') {
        if (EventUtils.getTabFromEvent(event, { force: true }) ||
            EventUtils.getTabFromTabbarEvent(event, { force: true })) {
          log(' => ignore mousemove on any tab');
          return;
        }
        // When you move mouse while the last tab is being removed, it can fire
        // a mousemove event on the background area of the tab bar, and it
        // produces sudden scrolling. So we need to keep scroll locked
        // while the cursor is still on tabs area.
        const spacer = mNormalScrollBox.querySelector(`.${Constants.kTABBAR_SPACER}`);
        const pinnedTabsAreaSize = parseFloat(document.documentElement.style.getPropertyValue('--pinned-tabs-area-size'));
        const spacerTop = Size.getTabHeight() * (Tab.getVirtualScrollRenderableTabs(TabsStore.getCurrentWindowId()).length + 1)
        if ((!spacer || event.clientY < spacerTop) &&
            (!pinnedTabsAreaSize || isNaN(pinnedTabsAreaSize) || event.clientY > pinnedTabsAreaSize)) {
          log(' => ignore mousemove on any tab (removing)');
          return;
        }
      }

    default:
      break;
  }

  window.removeEventListener('mousemove', tryUnlockPosition);
  window.removeEventListener('mouseout', tryUnlockPosition);
  tryUnlockPosition.listening = false;

  tryLockPosition.tabIds.clear();
  const spacer = mNormalScrollBox.querySelector(`.${Constants.kTABBAR_SPACER}`);
  spacer.dataset.removedTabsCount = 0;
  spacer.style.minHeight = '';
  onPositionUnlocked.dispatch();
}
tryUnlockPosition.contextMenuOpen = false;

browser.menus.onShown.addListener((info, tab) => {
  tryUnlockPosition.contextMenuOpen = info.contexts.includes('tab') && (tab.windowId == TabsStore.getCurrentWindowId());
});

browser.menus.onHidden.addListener((_info, _tab) => {
  tryUnlockPosition.contextMenuOpen = false;
});

browser.tabs.onCreated.addListener(_tab => {
  tryUnlockPosition();
});

browser.tabs.onRemoved.addListener(tabId => {
  if (!tryLockPosition.tabIds.has(tabId))
    tryUnlockPosition();
});
