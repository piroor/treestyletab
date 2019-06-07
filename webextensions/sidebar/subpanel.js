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

const mTabBarContainer = document.querySelector('#tabbar-container');
const mSubPanel        = document.querySelector('#subpanel');
const mContainer       = document.querySelector('#subpanel-container');
const mResizer         = document.querySelector('#subpanel-resizer');

mContainer.style.height = mSubPanel.style.height = 0;

const MIN_HEIGHT = 3;

let mHeight = 0;
let mDragStartY = 0;
let mDragStartHeight = 0;

export async function init() {
  mTargetWindow = TabsStore.getWindow();

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
    mHeight = Math.max(MIN_HEIGHT, mDragStartHeight - (event.clientY - mDragStartY));
    browser.sessions.setWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT, mHeight).catch(ApiTabs.createErrorHandler());
    applyHeight();
  });

  const [url, height] = await Promise.all([
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_URL).catch(ApiTabs.createErrorHandler()),
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT).catch(ApiTabs.createErrorHandler())
  ]);
  mHeight = height || 1;

  load({ url });
  applyHeight();
}

export function load(params = {}) {
  mSubPanel.setAttribute('src', params.url || 'about:blank');
}

function applyHeight() {
  mContainer.style.height = `${mHeight}px`;
  mSubPanel.style.height = `calc(${mHeight}px - var(--resizer-size))`;
  mTabBarContainer.style.bottom = `${mHeight}px`;
  onResized.dispatch();
}

function onMouseMove(event) {
  event.stopPropagation();
  event.preventDefault();
  mHeight = Math.max(MIN_HEIGHT, mDragStartHeight - (event.clientY - mDragStartY));
  applyHeight();
}
