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

function positionPinnedTabs(aParams = {}) {
  log('positionPinnedTabs');
  var width = aParams.width;
  var height = aParams.height;

  var pinnedTabs = getPinnedTabs(aParams.hint);
  if (!pinnedTabs.length) {
    resetPinnedTabs();
    return;
  }

  var containerWidth = gTabBar.getBoundingClientRect().width;
  var maxWidth = containerWidth;
  var faviconized = configs.faviconizePinnedTabs;
  var faviconizedSize = getFirstVisibleTab(gTargetWindow).getBoundingClientRect().height;

  var width  = faviconized ? faviconizedSize : maxWidth ;
  var height = faviconizedSize;
  var maxCol = Math.max(1, Math.floor(maxWidth / width));
  var maxRow = Math.ceil(count / maxCol);
  var col    = 0;
  var row    = 0;

  gTabBar.style.top = `${height * maxRow}px`;
  for (let item of pinnedTabs) {
    let style = item.style;
    style.marginTop = '';

    let transitionStyleBackup = style.transition || '';
    if (aParams.justNow)
      style.transition = 'none';

    if (faviconized)
      item.classList.add(kTAB_STATE_FAVICONIZED);
    else
      item.classList.remove(kTAB_STATE_FAVICONIZED);

    style.maxWidth = style.width = `${width}px`;
    style.marginLeft = `${width * col}px`;
    style.left = 0;
    style.right = 'auto';
    style.marginRight = '';

    style.marginTop = `-${height * (maxRow - row)}px`;
    style.top = style.bottom = '';

    log('pinned tab: ', {
      tab:    dumpTab(item),
      col:    col,
      width:  width,
      height: height
    });

    if (aParams.justNow && transitionStyleBackup)
      setTimeout(() => style.transition = transitionStyleBackup, 0);

    col++;
    if (col >= maxCol) {
      col = 0;
      row++;
      log('=> new row');
    }
  }
}

function positionPinnedTabsWithDelay(aParams) {
  if (positionPinnedTabsWithDelay.waiting)
    return;
  positionPinnedTabsWithDelay.waiting = setTimeout(() => {
    delete positionPinnedTabsWithDelay.waiting;
    positionPinnedTabs(aParams);
  }, 0);
}

function resetPinnedTabs(aHint) {
  gTabBar.style.top = '';
  var pinnedTabs = getPinnedTabs(aParams.hint);
  for (let pinnedTab of pinnedTabs) {
    let style = pinnedTab.style;
    style.maxWidth = style.width = style.left = style.right =
      style.marginLeft = style.marginRight = style.marginTop = '';
  }
}
