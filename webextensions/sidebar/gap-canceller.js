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

let mLastWindowScreenY   = window.screenY;
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

function updateOffset() {
  const shouldSuppressGap = (
    mDataset.activeTabUrl == configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl ||
    mDataset.ownerWindowState == 'fullscreen'
  );
  if (window.screenY == mLastWindowScreenY &&
      mLastMozInnerScreenY != window.mozInnerScreenY) {
    if (shouldSuppressGap) {
      mOffset = Math.min(0, mLastMozInnerScreenY - window.mozInnerScreenY);
      mStyle.setProperty('--visual-gap-offset', `${mOffset}px`);
      document.documentElement.classList.toggle(Constants.kTABBAR_STATE_HAS_VISUAL_GAP, mOffset < 0);
      log('should suppress visual gap: offset = ', mOffset);
    }
    else {
      mStyle.setProperty('--visual-gap-offset', '0px');
      log('should not suppress, but there is a visual gap ');
    }
  }
  else if (!shouldSuppressGap) {
    mStyle.setProperty('--visual-gap-offset', '0px');
    log('should not suppress, no visual gap ');
  }
  mLastWindowScreenY   = window.screenY;
  mLastMozInnerScreenY = window.mozInnerScreenY;
  browser.windows.get(mWindowId).then(window => {
    mDataset.ownerWindowState = window.state;
  });
}

function startWatching() {
  stopWatching();
  startWatching.timer = window.setInterval(
    updateOffset,
    configs.suppressGapFromShownOrHiddenToolbarInterval
  );
  if (!onMouseMove.listening) {
    window.addEventListener('mousemove', onMouseMove);
    onMouseMove.listening = true;
  }
}

function stopWatching() {
  if (startWatching.timer)
    window.clearInterval(startWatching.timer);
  delete startWatching.timer;
  if (onMouseMove.listening) {
    window.removeEventListener('mousemove', onMouseMove);
    onMouseMove.listening = false;
  }
}

function onLocationChange(url) {
  mDataset.activeTabUrl = url;
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
