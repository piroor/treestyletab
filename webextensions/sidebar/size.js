/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from '/common/common.js';

function log(...args) {
  internalLogger('sidebar/size', ...args);
}

let mTabHeight          = 0;
let mFavIconSize        = 0;
let mFavIconizedTabSize = 0;

export function getTabHeight() {
  return mTabHeight;
}

export function getFavIconSize() {
  return mFavIconSize;
}

export function getFavIconizedTabSize() {
  return mFavIconizedTabSize;
}

export function init() {
  const sizeDefinition = document.querySelector('#size-definition');
  // first, calculate actual favicon size.
  mFavIconSize = document.querySelector('#dummy-favicon-size-box').getBoundingClientRect().height;
  const scale = Math.max(configs.faviconizedTabScale, 1);
  mFavIconizedTabSize = parseInt(mFavIconSize * scale);
  log('mFavIconSize / mFavIconizedTabSize ', mFavIconSize, mFavIconizedTabSize);
  sizeDefinition.textContent = `:root {
    --favicon-size:         ${mFavIconSize}px;
    --faviconized-tab-size: ${mFavIconizedTabSize}px;
  }`;
  const dummyTab = document.querySelector('#dummy-tab');
  const dummyTabRect = dummyTab.getBoundingClientRect();
  mTabHeight = dummyTabRect.height;
  const dummyTabbar = document.querySelector('#dummy-tabs');
  const dummyTabbarRect = dummyTabbar.getBoundingClientRect();
  const scrollbarSize = dummyTabbarRect.width - dummyTabRect.width;
  log('mTabHeight ', mTabHeight);
  sizeDefinition.textContent += `:root {
    --tab-size: ${mTabHeight}px;
    --tab-height: var(--tab-size); /* for backward compatibility of custom user styles */
    --scrollbar-size: ${scrollbarSize}px;
    --narrow-scrollbar-size: ${configs.narrowScrollbarSize}px;

    --tab-burst-duration: ${configs.burstDuration}ms;
    --indent-duration:    ${configs.indentDuration}ms;
    --collapse-duration:  ${configs.collapseDuration}ms;
    --out-of-view-tab-notify-duration: ${configs.outOfViewTabNotifyDuration}ms;
  }`;
}
