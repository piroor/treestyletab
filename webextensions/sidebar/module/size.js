/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log,
  configs
} from '../../common/common.js';

let gTabHeight          = 0;
let gFavIconSize        = 0;
let gFavIconizedTabSize = 0;
let gSizeDefinition;

export function getTabHeight() {
  return gTabHeight;
}

export function getFavIconSize() {
  return gFavIconSize;
}

export function getFavIconizedTabSize() {
  return gFavIconizedTabSize;
}

export function init() {
  // first, calculate actual favicon size.
  gFavIconSize = document.querySelector('#dummy-favicon-size-box').getBoundingClientRect().height;
  const scale = Math.max(configs.faviconizedTabScale, 1);
  gFavIconizedTabSize = parseInt(gFavIconSize * scale);
  log('gFavIconSize / gFavIconizedTabSize ', gFavIconSize, gFavIconizedTabSize);
  gSizeDefinition.textContent = `:root {
    --favicon-size:         ${gFavIconSize}px;
    --faviconized-tab-size: ${gFavIconizedTabSize}px;
  }`;
  const dummyTab = document.querySelector('#dummy-tab');
  const dummyTabRect = dummyTab.getBoundingClientRect();
  gTabHeight = dummyTabRect.height;
  const dummyTabbar = document.querySelector('#dummy-tabs');
  const dummyTabbarRect = dummyTabbar.getBoundingClientRect();
  const scrollbarSize = dummyTabbarRect.width - dummyTabRect.width;
  log('gTabHeight ', gTabHeight);
  gSizeDefinition.textContent += `:root {
    --tab-height: ${gTabHeight}px;
    --scrollbar-size: ${scrollbarSize}px;
    --narrow-scrollbar-size: ${configs.narrowScrollbarSize}px;

    --tab-burst-duration: ${configs.burstDuration}ms;
    --indent-duration:    ${configs.indentDuration}ms;
    --collapse-duration:  ${configs.collapseDuration}ms;
    --out-of-view-tab-notify-duration: ${configs.outOfViewTabNotifyDuration}ms;
  }`;
}
