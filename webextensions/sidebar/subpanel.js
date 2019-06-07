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
const mHeader          = document.querySelector('#subpanel-header');
const mToggler         = document.querySelector('#subpanel-toggler');

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

update();

export async function init() {
  mTargetWindow = TabsStore.getWindow();
  mInitialized = true;

  const [providerId, height] = await Promise.all([
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_PROVIDER_ID).catch(ApiTabs.createErrorHandler()),
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT).catch(ApiTabs.createErrorHandler())
  ]);
  mHeight = height || 0;

  mContainer.appendChild(mSubPanel);

  applyProvider(providerId);

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
          if (provider &&
              (mProviderId == provider.id ||
               provider.newlyInstalled)) {
            if (mHeight == 0)
              mHeight = getDefaultHeight();
            applyProvider(provider.id);
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

function applyProvider(id) {
  const provider = TSTAPI.getAddon(id);
  if (provider &&
      provider.subPanel) {
    mProviderId = id;
    browser.sessions.setWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_PROVIDER_ID, id).catch(ApiTabs.createErrorHandler());
    load(provider.subPanel);
  }
  else {
    load();
  }
}

function getDefaultHeight() {
  return Math.floor(window.innerHeight * 0.5);
}

async function load(params) {
  params = params || {};
  const url = params.url || 'about:blank';
  if (url == mSubPanel.src) {
    mSubPanel.src = 'about:blank?'; // force reload
    await wait(0);
  }
  mSubPanel.src = url;
  update();
}

function update() {
  const isBlank = mSubPanel.src == '' || mSubPanel.src == 'about:blank';

  if (isBlank) {
    mContainer.classList.add('collapsed');
    mContainer.style.visibility = mSubPanel.style.visibility = 'collapse';
    mTabBarContainer.style.bottom = 0;
  }
  else {
    mHeight = Math.max(0, mHeight);
    if (mHeight == 0)
      mContainer.classList.add('collapsed');
    else
      mContainer.classList.remove('collapsed');
    mContainer.style.visibility = mSubPanel.style.visibility = 'visible';
    const headerSize = mHeader.getBoundingClientRect().height;
    mContainer.style.height = `${mHeight + headerSize}px`;
    mSubPanel.style.height = `${mHeight}px`;
    mTabBarContainer.style.bottom = `${mHeight + headerSize}px`;
  }

  if (!mInitialized)
    return;

  onResized.dispatch();

  if (!isBlank)
    browser.sessions.setWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT, mHeight).catch(ApiTabs.createErrorHandler());
}

async function toggle() {
  const lastEffectiveHeight = await browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_EFFECTIVE_HEIGHT).catch(ApiTabs.createErrorHandler());
  if (mHeight > 0)
    browser.sessions.setWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_EFFECTIVE_HEIGHT, mHeight).catch(ApiTabs.createErrorHandler());
  mHeight = mHeight > 0 ? 0 : (lastEffectiveHeight || getDefaultHeight());
  update();
}

mHeader.addEventListener('mousedown', event => {
  if (event.target == mToggler)
    return;
  event.stopPropagation();
  event.preventDefault();
  mHeader.setCapture(true);
  mDragStartY = event.clientY;
  mDragStartHeight = mHeight;
  mHeader.addEventListener('mousemove', onMouseMove);
});

mHeader.addEventListener('mouseup', event => {
  if (event.target == mToggler)
    return;
  mHeader.removeEventListener('mousemove', onMouseMove);
  event.stopPropagation();
  event.preventDefault();
  document.releaseCapture();
  mHeight = mDragStartHeight - (event.clientY - mDragStartY);
  update();
});

mHeader.addEventListener('dblclick', event => {
  if (event.target == mToggler)
    return;
  event.stopPropagation();
  event.preventDefault();
  toggle();
});

mToggler.addEventListener('click', event => {
  event.stopPropagation();
  event.preventDefault();
  toggle();
});

function onMouseMove(event) {
  event.stopPropagation();
  event.preventDefault();
  mHeight = mDragStartHeight - (event.clientY - mDragStartY);
  update();
}
