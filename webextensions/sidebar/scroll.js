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

/* basics */

function scrollTo(aParams = {}) {
  log('scrollTo ', aParams);
  if (!aParams.justNow &&
      configs.animation && configs.smoothScrollEnabled)
    return smoothScrollTo(aParams);

  //cancelPerformingAutoScroll();
  if (aParams.tab)
    gTabBar.scrollTop += calculateScrollDeltaForTab(aParams.tab);
  else if (typeof aParams.position == 'number')
    gTabBar.scrollTop = aParams.position;
}

function calculateScrollDeltaForTab(aTab) {
  let tabRect = aTab.getBoundingClientRect();
  let containerRect = gTabBar.getBoundingClientRect();
  if (containerRect.bottom < tabRect.bottom) { // should scroll down
    return tabRect.bottom - containerRect.bottom;
  }
  else if (containerRect.top > tabRect.top) { // should scroll up
    return tabRect.top - containerRect.top;
  }
  else {
    return 0;
  }
}

function isTabInViewport(aTab) {
  if (!aTab || !aTab.parentNode)
    return false;

  if (isPinned(aTab))
    return true;

  return calculateScrollDeltaForTab(aTab) == 0;
}

async function smoothScrollTo(aParams = {}) {
  log('smoothScrollTo ', aParams);
  //cancelPerformingAutoScroll(true);

  smoothScrollTo.stopped = false;

  if (aParams.tab)
    aParams.delta = calculateScrollDeltaForTab(aParams.tab);

  var delta = aParams.delta || 0;
  var startPosition = gTabBar.scrollTop;
  var endPosition = startPosition + delta;

  var duration = aParams.duration || configs.smoothScrollDuration;
  var startTime = Date.now();

  return new Promise((aResolve, aReject) => {
    var radian = 90 * Math.PI / 180;
    var scrollStep = () => {
      if (smoothScrollTo.stopped) {
        aReject();
        return;
      }
      var nowTime = Date.now();
      var spentTime = nowTime - startTime;
      if (spentTime >= duration) {
        scrollTo({
          position: endPosition,
          justNow: true
        });
        smoothScrollTo.stopped = true;
        aResolve();
        return;
      }
      var power = Math.sin(spentTime / duration * radian);
      var newPosition = startPosition + parseInt(delta * power);
      scrollTo({
        position: newPosition,
        justNow: true
      });
      window.requestAnimationFrame(scrollStep);
    };
    window.requestAnimationFrame(scrollStep);
  });
}

function stopSmoothScroll() {
  smoothScrollTo.stopped = true;
}

function isSmoothScrolling() {
  return !smoothScrollTo.stopped;
}

/* applications */

function scrollToNewTab(aTab) {
  if (!canScrollToTab(aTab))
    return;

  if (configs.scrollToNewTabMode > kSCROLL_TO_NEW_TAB_IGNORE)
    scrollToTab(aTab, {
      keepActiveTabVisible: configs.scrollToNewTabMode == kSCROLL_TO_NEW_TAB_IF_BOTH_ACTIVE_AND_NEW_ARE_VISIBLE
    });
}

function canScrollToTab(aTab) {
  return (aTab &&
          aTab.parentNode &&
          isHidden(aTab));
}

function scrollToTab(aTab, aOptions = {}) {
  log('scrollToTab to ', dumpTab(aTab), aOptions);
  if (!canScrollToTab(aTab)) {
    log('  => unscrollable');
    return;
  }

  //cancelPerformingAutoScroll(true);

  if (isTabInViewport(aTab)) {
    log('  => already visible');
    return;
  }

  var activeTab = getCurrentTab();
/* cancel if the current tab is going to be outside of the viewport
  if (aOptions.keepActiveTabVisible && activeTab != aTab) {
    let box = b.selectedTab.getBoundingClientRect();
    if (targetTabBox.screenX - box.screenX + baseTabBox.width > scrollBoxObject.width ||
      targetTabBox.screenY - box.screenY + baseTabBox.height > scrollBoxObject.height)
      return;
  }
*/

  scrollTo(clone(aOptions, {
    tab: aTab
  }));
}

function scrollToTabSubtree(aTab) {
  if (!canScrollToTab(aTab))
    return;
  var descendants = getDescendantTabs(aTab);
  return scrollToTabs([aTab].concat(descendants));
}

function scrollToTabs(aTabs) {
  var firstTab = aTabs[0];
  if (!canScrollToTab(firstTab))
    return;
/*
  var containerPosition = this.tabStrip.getBoundingClientRect()[this.screenY];
  var containerSize     = this.tabStrip.getBoundingClientRect()[this.height];
  var parentPosition    = parentTabBox[this.screenY];

  var lastVisible = firstTab;
  for (let i = aTabs.length-1; i > -1; i--)
  {
    let tab = aTabs[i];
    if (this.isCollapsed(tab))
      continue;

    let box = this.getFutureBoxObject(tab);
    if (box[this.screenY] + box[this.height] - parentPosition > containerSize)
      continue;

    lastVisible = tab;
    break;
  }

  this.cancelPerformingAutoScroll(true);

  if (this.isTabInViewport(firstTab) && this.isTabInViewport(lastVisible))
    return;

  var lastVisibleBox = this.getFutureBoxObject(lastVisible);
  var lastPosition = lastVisibleBox[this.screenY];
  var tabSize      = lastVisibleBox[this.height];

  var treeHeight = lastPosition - parentPosition + tabSize;
  var treeIsLargerThanViewport = treeHeight > containerSize - tabSize;
  if (treeIsLargerThanViewport) {
    var endPos = parentPosition - this.getFirstNormalTab(b).getBoundingClientRect()[this.screenY] - tabSize * 0.5;
    var endX = 0 ;
    var endY = endPos;
    this.scrollTo(endX, endY);
  }
  else if (!this.isTabInViewport(firstTab) && this.isTabInViewport(lastVisible)) {
    this.scrollToTab(firstTab);
  }
  else if (this.isTabInViewport(firstTab) && !this.isTabInViewport(lastVisible)) {
    this.scrollToTab(lastVisible);
  }
  else if (parentPosition < containerPosition) {
    this.scrollToTab(firstTab);
  }
  else {
    this.scrollToTab(lastVisible);
  }
*/
}

