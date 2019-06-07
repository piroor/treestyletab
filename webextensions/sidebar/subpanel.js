/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

export const onResized = new EventListenerManager();

let mTargetWindow;
let mInitialized = false;

const mTabBarContainer = document.querySelector('#tabbar-container');
const mContainer       = document.querySelector('#subpanel-container');
const mResizer         = document.querySelector('#subpanel-resizer');

// Don't put iframe statically, because it predefined iframe produces
// reflowing on the startup unexpectedly.
const mSubPanel = document.createElement('iframe');
mSubPanel.setAttribute('id', 'subpanel');
mSubPanel.setAttribute('type', 'content');
mSubPanel.setAttribute('src', 'about:blank');

let mHeight = 0;
let mDragStartY = 0;
let mDragStartHeight = 0;

applyHeight();

export async function init() {
  mTargetWindow = TabsStore.getWindow();
  mInitialized = true;

  const [url, height] = await Promise.all([
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_URL).catch(ApiTabs.createErrorHandler()),
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT).catch(ApiTabs.createErrorHandler())
  ]);
  mHeight = height || 0;

  mContainer.appendChild(mSubPanel);

  load({ url });
  applyHeight();
}

export function load(params = {}) {
  mSubPanel.setAttribute('src', params.url || 'about:blank');
}

function applyHeight() {
  mHeight = Math.max(0, mHeight);
  mContainer.style.height = `calc(${mHeight}px + var(--subpanel-resizer-size))`;
  mSubPanel.style.height = `${mHeight}px`;
  mTabBarContainer.style.bottom = `calc(${mHeight}px + var(--subpanel-resizer-size))`;
  if (!mInitialized)
    return;
  onResized.dispatch();
  browser.sessions.setWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT, mHeight).catch(ApiTabs.createErrorHandler());
}

mResizer.addEventListener('mousedown', event => {
  event.stopPropagation();
  event.preventDefault();
  mResizer.setCapture(true);
  mDragStartY = event.clientY;
  mDragStartHeight = mHeight;
  mResizer.addEventListener('mousemove', onMouseMove);
});

mResizer.addEventListener('mouseup', event => {
  mResizer.removeEventListener('mousemove', onMouseMove);
  event.stopPropagation();
  event.preventDefault();
  document.releaseCapture();
  mHeight = mDragStartHeight - (event.clientY - mDragStartY);
  applyHeight();
});

mResizer.addEventListener('dblclick', async event => {
  event.stopPropagation();
  event.preventDefault();
  const lastEffectiveHeight = await browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_EFFECTIVE_HEIGHT).catch(ApiTabs.createErrorHandler());
  if (mHeight > 0)
    browser.sessions.setWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_EFFECTIVE_HEIGHT, mHeight).catch(ApiTabs.createErrorHandler());
  mHeight = mHeight > 0 ? 0 : (lastEffectiveHeight || Math.floor(window.innerHeight * 0.5));
  applyHeight();
});

function onMouseMove(event) {
  event.stopPropagation();
  event.preventDefault();
  mHeight = mDragStartHeight - (event.clientY - mDragStartY);
  applyHeight();
}
