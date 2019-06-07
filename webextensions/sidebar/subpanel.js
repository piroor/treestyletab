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

const mTabBarContainer   = document.querySelector('#tabbar-container');
const mSubPanel          = document.querySelector('#subpanel');
const mSubPanelContainer = document.querySelector('#subpanel-container');

mSubPanelContainer.style.height = mSubPanel.style.height = 0;

export async function init() {
  mTargetWindow = TabsStore.getWindow();

  const [url, height] = await Promise.all([
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_URL).catch(ApiTabs.createErrorHandler()),
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT).catch(ApiTabs.createErrorHandler())
  ]);

  load({ url });
  setHeight(height);
}

export function load(params = {}) {
  mSubPanel.setAttribute('src', params.url || 'about:blank');
}

export function setHeight(height) {
  height = 300; // height || 0;
  mSubPanelContainer.style.height = mSubPanel.style.height = `${height}px`;
  mTabBarContainer.style.bottom = `${height}px`;
  onResized.dispatch();
}
