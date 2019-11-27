/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TSTAPI from '/common/tst-api.js';

import EventListenerManager from '/extlib/EventListenerManager.js';
import MenuUI from '/extlib/MenuUI.js';

import * as BackgroundConnection from './background-connection.js';
import * as Size from './size.js';

function log(...args) {
  internalLogger('sidebar/subpanel', ...args);
}

export const onResized = new EventListenerManager();

let mTargetWindow;
let mInitialized = false;

const mTabBarContainer = document.querySelector('#tabbar-container');
const mContainer       = document.querySelector('#subpanel-container');
const mHeader          = document.querySelector('#subpanel-header');
const mSelector        = document.querySelector('#subpanel-selector');
const mSelectorAnchor  = document.querySelector('#subpanel-selector-anchor');
const mToggler         = document.querySelector('#subpanel-toggler');

// Don't put iframe statically, because statically embedded iframe
// produces reflowing on the startup unexpectedly.
const mSubPanel = document.createElement('iframe');
mSubPanel.setAttribute('id', 'subpanel');
mSubPanel.setAttribute('src', 'about:blank');

let mHeight = 0;
let mDragStartY = 0;
let mDragStartHeight = 0;
let mProviderId = null;

updateLayout();

export async function init() {
  if (mInitialized)
    return;
  mInitialized = true;
  mTargetWindow = TabsStore.getWindow();

  const [providerId, height] = await Promise.all([
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_PROVIDER_ID).catch(ApiTabs.createErrorHandler()),
    browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT).catch(ApiTabs.createErrorHandler())
  ]);
  mHeight = typeof height == 'number' ? height : Math.max(configs.lastSubPanelHeight, 0);

  log('initialize ', { providerId, height: mHeight });

  mContainer.appendChild(mSubPanel);
  updateSelector();

  if (providerId)
    applyProvider(providerId);
  else
    restoreLastProvider();

  browser.runtime.onMessage.addListener((message, _sender, _respond) => {
    if (!message ||
        typeof message.type != 'string' ||
        message.type.indexOf('treestyletab:') != 0)
      return;

    //log('onMessage: ', message, sender);
    switch (message.type) {
      case TSTAPI.kCOMMAND_BROADCAST_API_REGISTERED:
        wait(0).then(() => { // wait until addons are updated
          updateSelector();
          const provider = TSTAPI.getAddon(message.sender.id);
          if (provider &&
              (mProviderId == provider.id ||
               provider.newlyInstalled)) {
            if (mHeight == 0)
              mHeight = getDefaultHeight();
            applyProvider(provider.id);
          }
          else {
            restoreLastProvider();
          }
        });
        break;

      case TSTAPI.kCOMMAND_BROADCAST_API_UNREGISTERED:
        wait(0).then(() => { // wait until addons are updated
          updateSelector();
          if (message.sender.id == mProviderId)
            restoreLastProvider();
        });
        break;
    }
  });
}

TSTAPI.onInitialized.addListener(async () => {
  await init();

  const providerId = await browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_PROVIDER_ID).catch(ApiTabs.createErrorHandler());
  if (providerId)
    applyProvider(providerId);
  else
    restoreLastProvider();
});

function applyProvider(id) {
  const provider = TSTAPI.getAddon(id);
  log('applyProvider ', id, provider);
  if (provider &&
      provider.subPanel) {
    log('applyProvider: load ', id);
    configs.lastSelectedSubPanelProviderId = mProviderId = id;
    for (const item of mSelector.querySelectorAll('.radio')) {
      item.classList.remove('checked');
    }
    const activeItem = mSelector.querySelector(`[data-value="${id}"]`);
    if (activeItem)
      activeItem.classList.add('checked');
    browser.sessions.setWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_PROVIDER_ID, id).catch(ApiTabs.createErrorHandler());

    const icon = mSelectorAnchor.querySelector('.icon > img');
    if (provider.icons && provider.icons['16'])
      icon.src = provider.icons['16'];
    else
      icon.removeAttribute('src');

    mSelectorAnchor.querySelector('.label').textContent = provider.subPanel.title || provider.name || provider.id;

    if (mHeight > 0)
      load(provider.subPanel);
    else
      load();
  }
  else {
    log('applyProvider: unload missing/invalid provider ', id);
    const icon = mSelectorAnchor.querySelector('.icon > img');
    icon.removeAttribute('src');
    mSelectorAnchor.querySelector('.label').textContent = '';
    load();
  }
}

function restoreLastProvider() {
  const lastProvider = TSTAPI.getAddon(configs.lastSelectedSubPanelProviderId);
  log('restoreLastProvider ', lastProvider);
  if (lastProvider && lastProvider.subPanel)
    applyProvider(lastProvider.id);
  else if (mSelector.hasChildNodes())
    applyProvider(mSelector.firstChild.dataset.value);
  else
    applyProvider(mProviderId = null);
}

function getDefaultHeight() {
  return Math.floor(window.innerHeight * 0.5);
}

async function load(params) {
  params = params || {};
  const url = params.url || 'about:blank';
  if (url == mSubPanel.src &&
      url != 'about:blank') {
    mSubPanel.src = 'about:blank?'; // force reload
    await wait(0);
  }
  mSubPanel.src = url;
  updateLayout();
}

function updateLayout() {
  if (!mProviderId && !mSelector.hasChildNodes()) {
    mContainer.classList.add('collapsed');
    mContainer.style.visibility = mSubPanel.style.visibility = 'collapse';
    mTabBarContainer.style.bottom = 0;
  }
  else {
    mHeight = Math.max(0, mHeight);
    mContainer.classList.toggle('collapsed', mHeight == 0);
    mContainer.style.visibility = mSubPanel.style.visibility = 'visible';
    const headerSize = mHeader.getBoundingClientRect().height;
    const appliedHeight = Math.min(window.innerHeight * 0.66, mHeight);
    mContainer.style.height = `${appliedHeight + headerSize}px`;
    mSubPanel.style.height = `${appliedHeight}px`;
    mTabBarContainer.style.bottom = `${appliedHeight + headerSize}px`;

    if (mHeight > 0 &&
        (!mSubPanel.src || mSubPanel.src == 'about:blank')) {
      // delayed load
      const provider = TSTAPI.getAddon(mProviderId);
      if (provider && provider.subPanel)
        mSubPanel.src = provider.subPanel.url;
    }
    else if (mHeight == 0) {
      mSubPanel.src = 'about:blank';
    }
  }

  if (!mInitialized)
    return;

  onResized.dispatch();

  if (mProviderId)
    browser.sessions.setWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_HEIGHT, mHeight).catch(ApiTabs.createErrorHandler());
}

async function toggle() {
  const lastEffectiveHeight = await browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_EFFECTIVE_HEIGHT).catch(ApiTabs.createErrorHandler());
  if (mHeight > 0)
    browser.sessions.setWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SUBPANEL_EFFECTIVE_HEIGHT, mHeight).catch(ApiTabs.createErrorHandler());
  mHeight = mHeight > 0 ? 0 : (lastEffectiveHeight || getDefaultHeight());
  updateLayout();
}

// We should save the last height only when it is changed by the user intentonally.
function saveLastHeight() {
  configs.lastSubPanelHeight = mContainer.classList.contains('collapsed') ? 0 : mHeight;
}

function isFiredOnClickable(event) {
  let target = event.target;
  if (!(target instanceof Element))
    target = target.parentNode;
  return !!target.closest('.clickable');
}

mHeader.addEventListener('mousedown', event => {
  if (isFiredOnClickable(event))
    return;
  event.stopPropagation();
  event.preventDefault();
  mHeader.setCapture(true);
  mDragStartY = event.clientY;
  mDragStartHeight = mHeight;
  mHeader.addEventListener('mousemove', onMouseMove);
});

mHeader.addEventListener('mouseup', event => {
  if (isFiredOnClickable(event))
    return;
  mHeader.removeEventListener('mousemove', onMouseMove);
  event.stopPropagation();
  event.preventDefault();
  document.releaseCapture();
  mHeight = mDragStartHeight - (event.clientY - mDragStartY);
  updateLayout();
  saveLastHeight();
});

mHeader.addEventListener('dblclick', async event => {
  if (isFiredOnClickable(event))
    return;
  event.stopPropagation();
  event.preventDefault();
  await toggle();
  saveLastHeight();
});

mToggler.addEventListener('click', async event => {
  event.stopPropagation();
  event.preventDefault();
  await toggle();
  saveLastHeight();
});

window.addEventListener('resize', _event => {
  updateLayout();
});

function onMouseMove(event) {
  event.stopPropagation();
  event.preventDefault();
  mHeight = mDragStartHeight - (event.clientY - mDragStartY);
  updateLayout();
}


function updateSelector() {
  const range = document.createRange();
  range.selectNodeContents(mSelector);
  range.deleteContents();

  const items = [];
  for (const [id, addon] of TSTAPI.getAddons()) {
    if (!addon.subPanel)
      continue;
    const item = document.createElement('li');
    item.classList.add('radio');
    item.dataset.value = id;
    const iconContainer = item.appendChild(document.createElement('span'));
    iconContainer.classList.add('icon');
    const icon = iconContainer.appendChild(document.createElement('img'));
    if (addon.icons && addon.icons['16'])
      icon.src = addon.icons['16'];
    item.appendChild(document.createTextNode(addon.subPanel.title || addon.name || id));
    items.push(item);
  }

  items.sort((a, b) => a.textContent < b.textContent ? -1 : 1);

  const itemsFragment = document.createDocumentFragment();
  for (const item of items) {
    itemsFragment.appendChild(item);
  }
  range.insertNode(itemsFragment);
  range.detach();
}

mSelector.ui = new MenuUI({
  root:       mSelector,
  appearance: 'panel',
  onCommand:  onSelect,
  animationDuration: configs.animation ? configs.collapseDuration : 0.001
});

function onSelect(item, _event) {
  if (item.dataset.value) {
    applyProvider(item.dataset.value);
    saveLastHeight();
  }
  mSelector.ui.close();
}

BackgroundConnection.onMessage.addListener(async message => {
  switch (message.type) {
    case Constants.kCOMMAND_TOGGLE_SUBPANEL:
      toggle();
      break;

    case Constants.kCOMMAND_SWITCH_SUBPANEL:
      mSelector.ui.open({ anchor: mSelectorAnchor });
      break;

    case Constants.kCOMMAND_INCREASE_SUBPANEL:
      mHeight += Size.getTabHeight();
      updateLayout();
      break;

    case Constants.kCOMMAND_DECREASE_SUBPANEL:
      mHeight -= Size.getTabHeight();
      updateLayout();
      break;
  }
});
