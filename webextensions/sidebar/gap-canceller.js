/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=727668

import {
  log as internalLogger,
  configs,
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';

function log(...args) {
  internalLogger('sidebar/gap-canceller', ...args);
}

let mWindowId;
const mStyle = document.documentElement.style;
const mDataset = document.documentElement.dataset;

let mLastWindowDimension = getWindowDimension();
let mLastMozInnerScreenY = window.mozInnerScreenY;
let mOffset              = 0;

export function init() {
  mWindowId = TabsStore.getCurrentWindowId();

  browser.tabs.query({ active: true, windowId: mWindowId }).then(tabs => {
    onLocationChange(tabs[0].url);
  });
  browser.tabs.onActivated.addListener(async activeInfo => {
    const tab = await browser.tabs.get(activeInfo.tabId);
    onLocationChange(tab.url);
  });
  browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (tab.active && changeInfo.status == 'complete')
      onLocationChange(tab.url);
  }, { windowId: mWindowId, properties: ['status'] });

  if (configs.suppressGapFromShownOrHiddenToolbar)
    startWatching();

  configs.$addObserver(changedKey => {
    switch (changedKey) {
      case 'suppressGapFromShownOrHiddenToolbar':
      case 'suppressGapFromShownOrHiddenToolbarInterval':
        if (configs.suppressGapFromShownOrHiddenToolbar)
          startWatching();
        else
          stopWatching();
        break;
    }
  });
}

function getWindowDimension() {
  return `(${window.screenX},${window.screenY}), ${window.outerWidth}x${window.outerHeight}, innerX=${window.mozInnerScreenX}`;
}

function updateOffset() {
  const dimension = getWindowDimension();
  const shouldSuppressGap = (
    mDataset.activeTabUrl == configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl ||
    mDataset.ownerWindowState == 'fullscreen'
  );
  log('updateOffset: ', {
    url:               mDataset.activeTabUrl,
    isNewTab:          mDataset.activeTabUrl == configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl,
    state:             mDataset.ownerWindowState,
    dimension,
    lastDimension:     mLastWindowDimension,
    innerScreenY:      window.mozInnerScreenY,
    lastInnerScreenY:  mLastMozInnerScreenY,
    windowNotChanged:  dimension == mLastWindowDimension,
    sidebarMoved:      mLastMozInnerScreenY != window.mozInnerScreenY
  });
  if (dimension == mLastWindowDimension &&
      mLastMozInnerScreenY != window.mozInnerScreenY) {
    if (shouldSuppressGap) {
      mOffset = Math.min(0, mLastMozInnerScreenY - window.mozInnerScreenY);
      mStyle.setProperty('--visual-gap-offset', `${mOffset}px`);
      const currentState = document.documentElement.classList.contains(Constants.kTABBAR_STATE_HAS_VISUAL_GAP);
      const newState = mOffset < 0;
      document.documentElement.classList.toggle(Constants.kTABBAR_STATE_HAS_VISUAL_GAP, newState);
      log(' => should suppress visual gap: offset = ', mOffset);
      if (currentState != newState) {
        cancelUpdateOffset();
        if (newState)
          startListenMouseEvents()
        else
          endListenMouseEvents();
      }
    }
    else {
      mStyle.setProperty('--visual-gap-offset', '0px');
      log(' => should not suppress, but there is a visual gap ');
    }
  }
  else if (!shouldSuppressGap) {
    mStyle.setProperty('--visual-gap-offset', '0px');
    log(' => should not suppress, no visual gap ');
  }
  mLastWindowDimension = dimension;
  mLastMozInnerScreenY = window.mozInnerScreenY;
  browser.windows.get(mWindowId).then(window => {
    mDataset.ownerWindowState = window.state;
  });
}

function startWatching() {
  stopWatching();
  window.addEventListener('resize', onResize);
}

function stopWatching() {
  cancelUpdateOffset();
  window.removeEventListener('resize', onResize);
}

function onResize() {
  cancelUpdateOffset();
  // We need to try checking updateed mozInnerScreenY, because the
  // mozInnerScreenY is sometimes not updated yet when a resize event
  // is dispatched.
  // (ResizeObserver has same problem.)
  updateOffset.intervalTimer = window.setInterval(
    updateOffset,
    configs.suppressGapFromShownOrHiddenToolbarInterval
  );
  updateOffset.timeoutTimer = setTimeout(() => {
    cancelUpdateOffset();
  }, configs.suppressGapFromShownOrHiddenToolbarTiemout);
}

function cancelUpdateOffset() {
  if (updateOffset.intervalTimer) {
    window.clearInterval(updateOffset.intervalTimer);
    delete updateOffset.intervalTimer;
  }
  if (updateOffset.timeoutTimer) {
    window.clearTimeout(updateOffset.timeoutTimer);
    delete updateOffset.timeoutTimer;
  }
}

function onLocationChange(url) {
  mDataset.activeTabUrl = url;
}

function startListenMouseEvents() {
  if (!onMouseMove.listening) {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseout', onMouseMove);
    onMouseMove.listening = true;
  }
}

function endListenMouseEvents() {
  if (onMouseMove.listening) {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseout', onMouseMove);
    onMouseMove.listening = false;
  }
}

let mClearHoverTopEdgeTimer;

function onMouseMove(event) {
  if (mClearHoverTopEdgeTimer)
    clearTimeout(mClearHoverTopEdgeTimer);
  const onTopEdge = event.screenY < window.mozInnerScreenY - mOffset;
  if (onTopEdge) {
    document.documentElement.classList.add(Constants.kTABBAR_STATE_HOVER_ON_TOP_EDGE);
  }
  else {
    mClearHoverTopEdgeTimer = setTimeout(() => {
      mClearHoverTopEdgeTimer = null;
      document.documentElement.classList.remove(Constants.kTABBAR_STATE_HOVER_ON_TOP_EDGE);
    }, configs.cancelGapSuppresserHoverDelay);
  }
}
