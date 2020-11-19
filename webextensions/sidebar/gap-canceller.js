/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=727668

import {
  configs,
} from '/common/common.js';
import * as TabsStore from '/common/tabs-store.js';

let mWindowId;
const mContainer = document.querySelector('#tabbar-container');
const mDataset = document.documentElement.dataset;

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

  if (configs.suppressGapOnNewTabBookmarksToolbar)
    startSuppressGapOnNewTabBookmarksToolbar();

  configs.$addObserver(changedKey => {
    const rootClasses = document.documentElement.classList;
    switch (changedKey) {
      case 'suppressGapOnNewTabBookmarksToolbar':
      case 'suppressGapOnNewTabBookmarksToolbarInterval':
        if (configs.suppressGapOnNewTabBookmarksToolbar)
          startSuppressGapOnNewTabBookmarksToolbar();
        else
          stopSuppressGapOnNewTabBookmarksToolbar();
        break;
    }
  });
}

function startSuppressGapOnNewTabBookmarksToolbar() {
  stopSuppressGapOnNewTabBookmarksToolbar();
  let lastWindowScreenY   = window.screenY;
  let lastMozInnerScreenY = window.mozInnerScreenY;
  startSuppressGapOnNewTabBookmarksToolbar.timer = window.setInterval(() => {
    const shouldSuppressGap = (
      mDataset.activeTabUrl == configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl ||
      mDataset.ownerWindowState == 'fullscreen'
    );
    if (window.screenY == lastWindowScreenY &&
        lastMozInnerScreenY != window.mozInnerScreenY) {
      if (shouldSuppressGap) {
        const offset = lastMozInnerScreenY - window.mozInnerScreenY;
        mContainer.style.transform = offset < 0 ? `translate(0, ${offset}px)` : '';
        console.log('should suppress visual gap: offset = ', offset);
      }
      else {
        mContainer.style.transform = '';
        console.log('should not suppress, but there is a visual gap ');
      }
    }
    else if (!shouldSuppressGap) {
      mContainer.style.transform = '';
      console.log('should not suppress, no visual gap ');
    }
    lastWindowScreenY   = window.screenY;
    lastMozInnerScreenY = window.mozInnerScreenY;
    browser.windows.get(mWindowId).then(window => {
      mDataset.ownerWindowState = window.state;
    });
  }, configs.suppressGapOnNewTabBookmarksToolbarInterval);
}

function stopSuppressGapOnNewTabBookmarksToolbar() {
  if (startSuppressGapOnNewTabBookmarksToolbar.timer)
    window.clearInterval(startSuppressGapOnNewTabBookmarksToolbar.timer);
  delete startSuppressGapOnNewTabBookmarksToolbar.timer;
}

function onLocationChange(url) {
  mDataset.activeTabUrl = url;
}
