/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import {
  configs
} from '../../common/common.js';

import * as Constants from '../../common/constants.js';
import * as Tabs from '../../common/tabs.js';
import * as Size from './size.js';

let gTargetWindow;
let gTabBar;

export function init() {
  gTargetWindow = Tabs.getWindow();
  gTabBar       = document.querySelector('#tabbar');
  configs.$addObserver(onConfigChange);
}

export function reposition(aOptions = {}) {
  //log('reposition');
  const pinnedTabs = Tabs.getPinnedTabs(gTargetWindow);
  if (!pinnedTabs.length) {
    reset();
    document.documentElement.classList.remove('have-pinned-tabs');
    return;
  }

  document.documentElement.classList.add('have-pinned-tabs');

  const containerWidth = gTabBar.getBoundingClientRect().width;
  const maxWidth       = containerWidth;
  const faviconized    = configs.faviconizePinnedTabs;

  const width  = faviconized ? Size.getFavIconizedTabSize() : maxWidth ;
  const height = faviconized ? Size.getFavIconizedTabSize() : Size.getTabHeight() ;
  const maxCol = Math.max(1, Math.floor(maxWidth / width));
  const maxRow = Math.ceil(pinnedTabs.length / maxCol);
  let col    = 0;
  let row    = 0;

  gTabBar.style.marginTop = `${height * maxRow}px`;
  for (let item of pinnedTabs) {
    let style = item.style;
    if (aOptions.justNow)
      item.classList.remove(Constants.kTAB_STATE_ANIMATION_READY);

    if (faviconized)
      item.classList.add(Constants.kTAB_STATE_FAVICONIZED);
    else
      item.classList.remove(Constants.kTAB_STATE_FAVICONIZED);

    if (row == maxRow - 1)
      item.classList.add(Constants.kTAB_STATE_LAST_ROW);
    else
      item.classList.remove(Constants.kTAB_STATE_LAST_ROW);

    style.bottom = 'auto';
    style.left   = `${width * col}px`;
    style.right  = faviconized ? 'auto' : 0 ;
    style.top    = `${height * row}px`;

    if (aOptions.justNow)
      item.classList.add(Constants.kTAB_STATE_ANIMATION_READY);

    /*
    log('pinned tab: ', {
      tab:    dumpTab(item),
      col:    col,
      width:  width,
      height: height
    });
    */

    col++;
    if (col >= maxCol) {
      col = 0;
      row++;
      //log('=> new row');
    }
  }
}

export function reserveToReposition(aOptions = {}) {
  if (reserveToReposition.waiting)
    clearTimeout(reserveToReposition.waiting);
  reserveToReposition.waiting = setTimeout(() => {
    delete reserveToReposition.waiting;
    reposition(aOptions);
  }, 10);
}

function reset() {
  gTabBar.style.marginTop = '';
  const pinnedTabs = Tabs.getPinnedTabs(gTargetWindow);
  pinnedTabs.forEach(clearStyle);
}

export function clearStyle(aTab) {
  aTab.classList.remove(Constants.kTAB_STATE_FAVICONIZED);
  aTab.classList.remove(Constants.kTAB_STATE_LAST_ROW);
  const style = aTab.style;
  style.left = style.right = style.top = style.bottom;
}

Tabs.onPinned.addListener(() => {
  reserveToReposition();
});

Tabs.onUnpinned.addListener(aTab => {
  clearStyle(aTab);
  reserveToReposition();
});

Tabs.onShown.addListener(() => {
  reserveToReposition();
});

Tabs.onHidden.addListener(() => {
  reserveToReposition();
});

function onConfigChange(aChangedKey) {
  switch (aChangedKey) {
    case 'faviconizePinnedTabs':
      reserveToReposition();
      break;
  }
}
