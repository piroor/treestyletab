/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  wait,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TSTAPI from '/common/tst-api.js';

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
let mProviderId = null;

applyHeight();

export async function init() {
  mTargetWindow = TabsStore.getWindow();
  mInitialized = true;

  const [providerId, height] = await Promise.all([
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_PROVIDER_ID).catch(ApiTabs.createErrorHandler()),
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT).catch(ApiTabs.createErrorHandler())
  ]);
  mHeight = height || 0;

  mContainer.appendChild(mSubPanel);

  const provider = TSTAPI.getAddon(providerId);
  if (provider && provider.subPanel) {
    mProviderId = providerId;
    load(provider.subPanel);
  }
  else {
    load();
  }

  browser.runtime.onMessage.addListener((message, _sender, _respond) => {
    if (!message ||
        typeof message.type != 'string' ||
        message.type.indexOf('treestyletab:') != 0)
      return;

    //log('onMessage: ', message, sender);
    switch (message.type) {
      case TSTAPI.kCOMMAND_BROADCAST_API_REGISTERED:
        wait(0).then(() => { // wait until addons are updated
          const provider = TSTAPI.getAddon(message.sender.id);
          if (provider && provider.subPanel) {
            mProviderId = message.sender.id;
            load(provider.subPanel);
          }
        });
        break;

      case TSTAPI.kCOMMAND_BROADCAST_API_UNREGISTERED:
        wait(0).then(() => { // wait until addons are updated
          if (message.sender.id == mProviderId)
            load();
        });
        break;
    }
  });
}

export function load(params) {
  params = params || {};
  mSubPanel.setAttribute('src', params.url || 'about:blank');
  applyHeight();
}

function applyHeight() {
  const isBlank = mSubPanel.src == '' || mSubPanel.src == 'about:blank';

  if (isBlank) {
    mContainer.style.visibility = mSubPanel.style.visibility = 'collapse';
    mTabBarContainer.style.bottom = 0;
  }
  else {
    mHeight = Math.max(0, mHeight);
    mContainer.style.visibility = mSubPanel.style.visibility = 'visible';
    mContainer.style.height = `calc(${mHeight}px + var(--subpanel-resizer-size))`;
    mSubPanel.style.height = `${mHeight}px`;
    mTabBarContainer.style.bottom = `calc(${mHeight}px + var(--subpanel-resizer-size))`;
  }

  if (!mInitialized)
    return;

  onResized.dispatch();

  if (!isBlank)
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
