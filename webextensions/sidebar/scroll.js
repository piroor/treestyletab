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

import {
  log,
  wait,
  nextFrame,
  dumpTab,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as Tree from '../common/tree.js';
import * as TSTAPI from '../common/tst-api.js';

import * as Size from './size.js';
import * as EventUtils from './event-utils.js';

import * as RestoringTabCount from './restoring-tab-count.js';


let gTabBar;
let gOutOfViewTabNotifier;

export async function init() {
  gTabBar               = document.querySelector('#tabbar');
  gOutOfViewTabNotifier = document.querySelector('#out-of-view-tab-notifier');

  const scrollPosition = await browser.sessions.getWindowValue(Tabs.getWindow(), Constants.kWINDOW_STATE_SCROLL_POSITION);
  if (typeof scrollPosition == 'number') {
    log('restore scroll position');
    cancelRunningScroll();
    scrollTo({
      position: scrollPosition,
      justNow:  true
    });
  }

  document.addEventListener('wheel', onWheel, { capture: true });
  gTabBar.addEventListener('scroll', onScroll);
  browser.runtime.onMessage.addListener(onMessage);
  browser.runtime.onMessageExternal.addListener(onMessageExternal);
}

/* basics */

function scrollTo(aParams = {}) {
  if (configs.logOnScroll)
    log('scrollTo ', aParams);
  if (!aParams.justNow &&
      configs.animation && configs.smoothScrollEnabled)
    return smoothScrollTo(aParams);

  //cancelPerformingAutoScroll();
  if (aParams.tab)
    gTabBar.scrollTop += calculateScrollDeltaForTab(aParams.tab);
  else if (typeof aParams.position == 'number')
    gTabBar.scrollTop = aParams.position;
  else if (typeof aParams.delta == 'number')
    gTabBar.scrollTop += aParams.delta;
  else
    throw new Error('No parameter to indicate scroll position');
}

function cancelRunningScroll() {
  scrollToTab.stopped = true;
  stopSmoothScroll();
}

function calculateScrollDeltaForTab(aTab) {
  if (Tabs.isPinned(aTab))
    return 0;

  const tabRect       = aTab.getBoundingClientRect();
  const containerRect = gTabBar.getBoundingClientRect();
  const offset        = getOffsetForAnimatingTab(aTab) + smoothScrollTo.currentOffset;
  let delta = 0;
  if (containerRect.bottom < tabRect.bottom + offset) { // should scroll down
    delta = tabRect.bottom - containerRect.bottom + offset;
  }
  else if (containerRect.top > tabRect.top + offset) { // should scroll up
    delta = tabRect.top - containerRect.top + offset;
  }
  if (configs.logOnScroll)
    log('calculateScrollDeltaForTab ', dumpTab(aTab), {
      delta, offset,
      tabTop:          tabRect.top,
      tabBottom:       tabRect.bottom,
      containerBottom: containerRect.bottom
    });
  return delta;
}

export function isTabInViewport(aTab) {
  if (!Tabs.ensureLivingTab(aTab))
    return false;

  if (Tabs.isPinned(aTab))
    return true;

  return calculateScrollDeltaForTab(aTab) == 0;
}

async function smoothScrollTo(aParams = {}) {
  if (configs.logOnScroll)
    log('smoothScrollTo ', aParams);
  //cancelPerformingAutoScroll(true);

  smoothScrollTo.stopped = false;

  const startPosition = gTabBar.scrollTop;
  let delta, endPosition;
  if (aParams.tab) {
    delta       = calculateScrollDeltaForTab(aParams.tab);
    endPosition = startPosition + delta;
  }
  else if (typeof aParams.position == 'number') {
    endPosition = aParams.position;
    delta       = endPosition - startPosition;
  }
  else if (typeof aParams.delta == 'number') {
    endPosition = startPosition + aParams.delta;
    delta       = aParams.delta;
  }
  else {
    throw new Error('No parameter to indicate scroll position');
  }
  smoothScrollTo.currentOffset = delta;

  const duration  = aParams.duration || configs.smoothScrollDuration;
  const startTime = Date.now();

  return new Promise((aResolve, aReject) => {
    const radian = 90 * Math.PI / 180;
    const scrollStep = () => {
      if (smoothScrollTo.stopped) {
        smoothScrollTo.currentOffset = 0;
        aReject();
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
        aResolve();
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
      nextFrame().then(scrollStep);
    };
    nextFrame().then(scrollStep);
  });
}
smoothScrollTo.currentOffset= 0;

async function smoothScrollBy(aDelta) {
  return smoothScrollTo({
    position: gTabBar.scrollTop + aDelta
  });
}

function stopSmoothScroll() {
  smoothScrollTo.stopped = true;
}

/* applications */

export function scrollToNewTab(aTab, aOptions = {}) {
  if (!canScrollToTab(aTab))
    return;

  if (configs.scrollToNewTabMode == Constants.kSCROLL_TO_NEW_TAB_IF_POSSIBLE) {
    const current = Tabs.getCurrentTab();
    scrollToTab(aTab, Object.assign({}, aOptions, {
      anchor:            isTabInViewport(current) && current,
      notifyOnOutOfView: true
    }));
  }
}

function canScrollToTab(aTab) {
  return (Tabs.ensureLivingTab(aTab) &&
          !Tabs.isHidden(aTab));
}

export async function scrollToTab(aTab, aOptions = {}) {
  scrollToTab.lastTargetId = null;

  if (configs.logOnScroll)
    log('scrollToTab to ', dumpTab(aTab), dumpTab(aOptions.anchor), aOptions,
        { stack: new Error().stack });
  cancelRunningScroll();
  if (!canScrollToTab(aTab)) {
    if (configs.logOnScroll)
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

  const anchorTab = aOptions.anchor;
  const hasAnchor = Tabs.ensureLivingTab(anchorTab) && anchorTab != aTab;
  const openedFromPinnedTab = hasAnchor && Tabs.isPinned(anchorTab);

  if (isTabInViewport(aTab) &&
      (!hasAnchor ||
       !openedFromPinnedTab)) {
    if (configs.logOnScroll)
      log('=> already visible');
    return;
  }

  // wait for one more frame, to start collapse/expand animation
  await nextFrame();
  if (scrollToTab.stopped)
    return;
  cancelNotifyOutOfViewTab();
  scrollToTab.lastTargetId = aTab.id;

  if (hasAnchor) {
    const targetTabRect = aTab.getBoundingClientRect();
    const anchorTabRect = anchorTab.getBoundingClientRect();
    const containerRect = gTabBar.getBoundingClientRect();
    const offset        = getOffsetForAnimatingTab(aTab);
    let delta = calculateScrollDeltaForTab(aTab);
    if (targetTabRect.top > anchorTabRect.top) {
      if (configs.logOnScroll)
        log('=> will scroll down');
      const boundingHeight = targetTabRect.bottom - anchorTabRect.top + offset;
      const overHeight     = boundingHeight - containerRect.height;
      if (overHeight > 0) {
        delta -= overHeight;
        if (aOptions.notifyOnOutOfView)
          notifyOutOfViewTab(aTab);
      }
      if (configs.logOnScroll)
        log('calculated result: ', {
          boundingHeight, overHeight, delta,
          container:      containerRect.height
        });
    }
    else if (targetTabRect.bottom < anchorTabRect.bottom) {
      if (configs.logOnScroll)
        log('=> will scroll up');
      const boundingHeight = anchorTabRect.bottom - targetTabRect.top + offset;
      const overHeight     = boundingHeight - containerRect.height;
      if (overHeight > 0)
        delta += overHeight;
      if (configs.logOnScroll)
        log('calculated result: ', {
          boundingHeight, overHeight, delta,
          container:      containerRect.height
        });
    }
    await scrollTo(Object.assign({}, aOptions, {
      position: gTabBar.scrollTop + delta
    }));
  }
  else {
    await scrollTo(Object.assign({}, aOptions, {
      tab: aTab
    }));
  }
  // A tab can be moved after the tabbar is scrolled to the tab.
  // To retry "scroll to tab" behavior for such cases, we need to
  // keep "last scrolled-to tab" information until the tab is
  // actually moved.
  await wait(configs.autoGroupNewTabsTimeout);
  const retryOptions = { retryCount: aOptions.retryCount || 0 };
  if (scrollToTab.lastTargetId == aTab.id &&
      !isTabInViewport(aTab) &&
      retryOptions.retryCount < 3) {
    retryOptions.retryCount++;
    return scrollToTab(aTab, retryOptions);
  }
  if (scrollToTab.lastTargetId == aTab.id)
    scrollToTab.lastTargetId = null;
}
scrollToTab.lastTargetId = null;

function getOffsetForAnimatingTab(aTab) {
  const allExpanding        = document.querySelectorAll(`${Tabs.kSELECTOR_NORMAL_TAB}:not(.${Constants.kTAB_STATE_COLLAPSED}).${Constants.kTAB_STATE_EXPANDING}`);
  const followingExpanding  = document.querySelectorAll(`#${aTab.id} ~ ${Tabs.kSELECTOR_NORMAL_TAB}:not(.${Constants.kTAB_STATE_COLLAPSED}).${Constants.kTAB_STATE_EXPANDING}`);
  const allCollapsing       = document.querySelectorAll(`${Tabs.kSELECTOR_NORMAL_TAB}.${Constants.kTAB_STATE_COLLAPSED}.${Constants.kTAB_STATE_COLLAPSING}`);
  const followingCollapsing = document.querySelectorAll(`#${aTab.id} ~ ${Tabs.kSELECTOR_NORMAL_TAB}.${Constants.kTAB_STATE_COLLAPSED}.${Constants.kTAB_STATE_COLLAPSING}`);
  const numExpandingTabs = (allExpanding.length - followingExpanding.length) - (allCollapsing.length - followingCollapsing.length);
  return numExpandingTabs * Size.getTabHeight();
}

/*
function scrollToTabSubtree(aTab) {
  return scrollToTab(Tabs.getLastDescendantTab(aTab), {
    anchor:            aTab,
    notifyOnOutOfView: true
  });
}

function scrollToTabs(aTabs) {
  return scrollToTab(aTabs[aTabs.length - 1], {
    anchor:            aTabs[0],
    notifyOnOutOfView: true
  });
}
*/

export function autoScrollOnMouseEvent(aEvent) {
  if (!gTabBar.classList.contains(Constants.kTABBAR_STATE_OVERFLOW))
    return;

  const tabbarRect = gTabBar.getBoundingClientRect();
  const scrollPixels = Math.round(Size.getTabHeight() * 0.5);
  if (aEvent.clientY < tabbarRect.top + autoScrollOnMouseEvent.areaSize) {
    if (gTabBar.scrollTop > 0)
      gTabBar.scrollTop -= scrollPixels;
  }
  else if (aEvent.clientY > tabbarRect.bottom - autoScrollOnMouseEvent.areaSize) {
    if (gTabBar.scrollTop < gTabBar.scrollTopMax)
      gTabBar.scrollTop += scrollPixels;
  }
}
autoScrollOnMouseEvent.areaSize = 20;


async function notifyOutOfViewTab(aTab) {
  if (RestoringTabCount.hasMultipleRestoringTabs()) {
    log('notifyOutOfViewTab: skip until completely restored');
    wait(100).then(() => notifyOutOfViewTab(aTab));
    return;
  }
  await nextFrame();
  cancelNotifyOutOfViewTab();
  if (aTab && isTabInViewport(aTab))
    return;
  gOutOfViewTabNotifier.classList.add('notifying');
  await wait(configs.outOfViewTabNotifyDuration);
  cancelNotifyOutOfViewTab();
}

function cancelNotifyOutOfViewTab() {
  gOutOfViewTabNotifier.classList.remove('notifying');
}


async function onWheel(aEvent) {
  if (!configs.zoomable &&
      EventUtils.isAccelKeyPressed(aEvent)) {
    aEvent.preventDefault();
    return;
  }

  if (!TSTAPI.isScrollLocked())
    return;

  aEvent.stopImmediatePropagation();
  aEvent.preventDefault();

  TSTAPI.notifyScrolled({
    tab:             EventUtils.getTabFromEvent(aEvent),
    scrollContainer: gTabBar,
    event:           aEvent
  });
}

function onScroll(_aEvent) {
  reserveToSaveScrollPosition();
}

function reserveToSaveScrollPosition() {
  if (reserveToSaveScrollPosition.reserved)
    clearTimeout(reserveToSaveScrollPosition.reserved);
  reserveToSaveScrollPosition.reserved = setTimeout(() => {
    delete reserveToSaveScrollPosition.reserved;
    browser.sessions.setWindowValue(
      Tabs.getWindow(),
      Constants.kWINDOW_STATE_SCROLL_POSITION,
      gTabBar.scrollTop
    );
  }, 150);
}


Tabs.onCreated.addListener(aTab => {
  if (configs.animation) {
    nextFrame().then(() => {
      const parent = Tabs.getParentTab(aTab);
      if (parent && Tabs.isSubtreeCollapsed(parent)) // possibly collapsed by other trigger intentionally
        return;
      const focused = Tabs.isActive(aTab);
      Tree.collapseExpandTab(aTab, {
        collapsed: false,
        anchor:    Tabs.getCurrentTab(),
        last:      true
      });
      if (!focused)
        notifyOutOfViewTab(aTab);
    });
  }
  else {
    if (Tabs.isActive(aTab))
      scrollToNewTab(aTab);
    else
      notifyOutOfViewTab(aTab);
  }
});

Tabs.onActivated.addListener(scrollToTab);

Tabs.onUnpinned.addListener(scrollToTab);


function onMessage(aMessage, _aSender, _aRespond) {
  if (!aMessage ||
      typeof aMessage.type != 'string')
    return;

  switch (aMessage.type) {
    case Constants.kCOMMAND_TAB_ATTACHED_COMPLETELY:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated([
          aMessage.tab,
          aMessage.parent
        ]);
        const tab = Tabs.getTabById(aMessage.tab);
        if (tab && Tabs.isActive(Tabs.getTabById(aMessage.parent)))
          scrollToNewTab(tab);
      })();

    case Constants.kCOMMAND_SCROLL_TABBAR:
      if (aMessage.windowId != Tabs.getWindow())
        break;
      switch (String(aMessage.by).toLowerCase()) {
        case 'lineup':
          smoothScrollBy(-Size.getTabHeight() * configs.scrollLines);
          break;

        case 'pageup':
          smoothScrollBy(-gTabBar.getBoundingClientRect().height + Size.getTabHeight());
          break;

        case 'linedown':
          smoothScrollBy(Size.getTabHeight() * configs.scrollLines);
          break;

        case 'pagedown':
          smoothScrollBy(gTabBar.getBoundingClientRect().height - Size.getTabHeight());
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

function onMessageExternal(aMessage, _aSender) {
  switch (aMessage.type) {
    case TSTAPI.kSCROLL:
      return (async () => {
        const params = {};
        const currentWindow = Tabs.getWindow();
        if ('tab' in aMessage) {
          await Tabs.waitUntilTabsAreCreated(aMessage.tab);
          params.tab = Tabs.getTabById(aMessage.tab);
          if (!params.tab || params.tab.windowId != currentWindow)
            return;
        }
        else {
          if (aMessage.window != currentWindow)
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
