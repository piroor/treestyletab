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
import MenuUI from '/extlib/MenuUI.js';

export const onResized = new EventListenerManager();

let mTargetWindow;
let mInitialized = false;

const mTabBarContainer = document.querySelector('#tabbar-container');
const mContainer       = document.querySelector('#subpanel-container');
const mHeader          = document.querySelector('#subpanel-header');
const mSelector        = document.querySelector('#subpanel-selector');
const mSelectorAnchor  = document.querySelector('#subpanel-selector-anchor');
const mToggler         = document.querySelector('#subpanel-toggler');
const mScreen          = document.querySelector('#subpanel-screen');

// Don't put iframe statically, because statically embedded iframe
// produces reflowing on the startup unexpectedly.
const mSubPanel = document.createElement('iframe');
mSubPanel.setAttribute('id', 'subpanel');
mSubPanel.setAttribute('sandbox', [
  'allow-forms',
  'allow-modals',
  //'allow-orientation-lock',
  'allow-pointer-lock',
  'allow-popups',
  //'allow-popups-to-escape-sandbox',
  'allow-presentation',
  'allow-same-origin', // this must be alloed to run scripts in the subpanel itself
  'allow-scripts'//, // this must be alloed to run scripts in the subpanel itself
  //'allow-top-navigation', // this must be disallowed to prevent replacing the sidebar itself via "target" attribute of links or forms
  //'allow-top-navigation-by-user-activation' // this must be disallowed to prevent replacing the sidebar itself via "target" attribute of links or forms
].join(' '));
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
  mHeight = height || 0;

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
          if (message.sender.id == mProviderId) {
            load();
            restoreLastProvider();
          }
        });
        break;
    }
  });

  browser.runtime.onMessageExternal.addListener((message, _sender) => {
    if (!message ||
        typeof message.type != 'string')
      return;

    //log('onMessage: ', message, sender);
    switch (message.type) {
      case TSTAPI.kSET_OVERRIDE_CONTEXT:
        setOverrideContext(message);
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
  if (provider &&
      provider.subPanel) {
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
    load();
  }
}

function restoreLastProvider() {
  const lastProvider = TSTAPI.getAddon(configs.lastSelectedSubPanelProviderId);
  if (lastProvider && lastProvider.subPanel)
    applyProvider(lastProvider.id);
  else if (mSelector.hasChildNodes())
    applyProvider(mSelector.firstChild.dataset.value);
}

function getDefaultHeight() {
  return Math.floor(window.innerHeight * 0.5);
}

async function load(params) {
  params = params || {};
  clearOverrideContext();
  const url = params.url || 'about:blank';
  if (url == mSubPanel.src) {
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
    if (mHeight == 0)
      mContainer.classList.add('collapsed');
    else
      mContainer.classList.remove('collapsed');
    mContainer.style.visibility = mSubPanel.style.visibility = 'visible';
    const headerSize = mHeader.getBoundingClientRect().height;
    mContainer.style.height = `${mHeight + headerSize}px`;
    mSubPanel.style.height = `${mHeight}px`;
    mTabBarContainer.style.bottom = `${mHeight + headerSize}px`;

    if (mHeight > 0 &&
        (!mSubPanel.src || mSubPanel.src == 'about:blank')) {
      // delayed load
      const provider = TSTAPI.getAddon(mProviderId);
      load(provider && provider.subPanel);
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

mHeader.addEventListener('mousedown', event => {
  if (event.target.localName == 'button')
    return;
  event.stopPropagation();
  event.preventDefault();
  mHeader.setCapture(true);
  mDragStartY = event.clientY;
  mDragStartHeight = mHeight;
  mHeader.addEventListener('mousemove', onMouseMove);
});

mHeader.addEventListener('mouseup', event => {
  if (event.target.localName == 'button')
    return;
  mHeader.removeEventListener('mousemove', onMouseMove);
  event.stopPropagation();
  event.preventDefault();
  document.releaseCapture();
  mHeight = mDragStartHeight - (event.clientY - mDragStartY);
  updateLayout();
});

mHeader.addEventListener('dblclick', event => {
  if (event.target.localName == 'button')
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
  if (item.dataset.value)
    applyProvider(item.dataset.value);
  mSelector.ui.close();
}


function setOverrideContext(message) {
  mScreen.style.pointerEvents = 'auto';
  const dataset = mScreen.dataset;
  dataset.contextMenuContext = message.context;
  if ('bookmarkId' in message)
    dataset.contextMenuBookmarkId = message.bookmarkId;
  if ('showDefaults' in message)
    dataset.contextMenuShowDefaults = message.showDefaults;
  if ('tabId' in message)
    dataset.contextMenuTabId = message.tabId;
}

export function tryOverrideContext(event) {
  if (event.target != mScreen)
    return false;

  // This delay is required because hiding of the context element
  // blocks opening of the context menu.
  setTimeout(clearOverrideContext, 150);

  const dataset = mScreen.dataset;
  if (dataset.contextMenuContext) {
    const contextOptions = {
      context: dataset.contextMenuContext
    };
    if (dataset.contextMenuBookmarkId)
      contextOptions.bookmarkId = dataset.contextMenuBookmarkId;
    if (dataset.contextMenuShowDefaults)
      contextOptions.showDefaults = dataset.contextMenuShowDefaults == 'true';
    if (dataset.contextMenuTabId)
      contextOptions.tabId = parseInt(dataset.contextMenuTabId);

    browser.menus.overrideContext(contextOptions);
    return true;
  }
  return false;
}

function clearOverrideContext() {
  mScreen.style.pointerEvents = 'none';
  const dataset = mScreen.dataset;
  delete dataset.contextMenuBookmarkId;
  delete dataset.contextMenuContext;
  delete dataset.contextMenuShowDefaults;
  delete dataset.contextMenuTabId;
}

mScreen.addEventListener('mousedown', () => {
  // This delay is required to override context on macOS,
  // because the context menu is shown just after this
  // mousedown event.
  setTimeout(clearOverrideContext, 150);
});
