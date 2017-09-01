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
  var tabRect = aTab.getBoundingClientRect();
  var containerRect = gTabBar.getBoundingClientRect();
  var offset = getOffsetForAnimatingTab(aTab);
  offset += smoothScrollTo.currentOffset;
  if (containerRect.bottom < tabRect.bottom + offset) { // should scroll down
    return tabRect.bottom - containerRect.bottom + offset;
  }
  else if (containerRect.top > tabRect.top + offset) { // should scroll up
    return tabRect.top - containerRect.top + offset;
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

  var startPosition = gTabBar.scrollTop;
  var delta, endPosition;
  if (aParams.tab) {
    delta = calculateScrollDeltaForTab(aParams.tab);
    endPosition = startPosition + delta;
  }
  else {
    endPosition = aParams.position;
    delta = endPosition - startPosition;
  }
  smoothScrollTo.currentOffset = delta;

  var duration = aParams.duration || configs.smoothScrollDuration;
  var startTime = Date.now();

  return new Promise((aResolve, aReject) => {
    var radian = 90 * Math.PI / 180;
    var scrollStep = () => {
      if (smoothScrollTo.stopped) {
        smoothScrollTo.currentOffset= 0;
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
        smoothScrollTo.currentOffset= 0;
        aResolve();
        return;
      }
      var power = Math.sin(spentTime / duration * radian);
      var currentDelta = parseInt(delta * power);
      var newPosition = startPosition + currentDelta;
      scrollTo({
        position: newPosition,
        justNow: true
      });
      smoothScrollTo.currentOffset = currentDelta;
      nextFrame().then(scrollStep);
    };
    nextFrame().then(scrollStep);
  });
}
smoothScrollTo.currentOffset= 0;

function stopSmoothScroll() {
  smoothScrollTo.stopped = true;
}

function isSmoothScrolling() {
  return !smoothScrollTo.stopped;
}

/* applications */

function scrollToNewTab(aTab, aOptions = {}) {
  if (!canScrollToTab(aTab))
    return;

  if (configs.scrollToNewTabMode == kSCROLL_TO_NEW_TAB_IF_POSSIBLE)
    scrollToTab(aTab, clone(aOptions, { anchor: getCurrentTab() }));
}

function canScrollToTab(aTab) {
  return (aTab &&
          aTab.parentNode &&
          !isHidden(aTab));
}

async function scrollToTab(aTab, aOptions = {}) {
  log('scrollToTab to ', dumpTab(aTab), dumpTab(aOptions.anchor), aOptions);
  if (!canScrollToTab(aTab)) {
    log('=> unscrollable');
    return;
  }

  cancelNotifyOutOfViewTab();
  //cancelPerformingAutoScroll(true);

  await nextFrame();
  cancelNotifyOutOfViewTab();

  if (isTabInViewport(aTab)) {
    log('=> already visible');
    return;
  }

  var anchorTab = aOptions.anchor;
  if (!anchorTab ||
      !anchorTab.parentNode ||
      anchorTab == aTab ||
      isPinned(anchorTab)) {
    log('=> no available anchor, direct scroll');
    scrollTo(clone(aOptions, {
      tab: aTab
    }));
    return;
  }

  // wait for one more frame, to start collapse/expand animation
  await nextFrame();
  cancelNotifyOutOfViewTab();

  var targetTabRect = aTab.getBoundingClientRect();
  var anchorTabRect = anchorTab.getBoundingClientRect();
  var containerRect = gTabBar.getBoundingClientRect();
  var offset = getOffsetForAnimatingTab(aTab);
  var delta = calculateScrollDeltaForTab(aTab);
  if (targetTabRect.top > anchorTabRect.top) {
    log('=> will scroll down');
    let boundingHeight = targetTabRect.bottom - anchorTabRect.top + offset;
    let overHeight = boundingHeight - containerRect.height;
    if (overHeight > 0) {
      delta -= overHeight;
      notifyOutOfViewTab(aTab);
    }
    log('calculated result: ', {
      boundingHeight, overHeight, delta,
      container: containerRect.height
    });
  }
  else if (targetTabRect.bottom < anchorTabRect.bottom) {
    log('=> will scroll up');
    let boundingHeight = anchorTabRect.bottom - targetTabRect.top + offset;
    let overHeight = boundingHeight - containerRect.height;
    if (overHeight > 0)
      delta += overHeight;
    log('calculated result: ', {
      boundingHeight, overHeight, delta,
      container: containerRect.height
    });
  }
  scrollTo(clone(aOptions, {
    position: gTabBar.scrollTop + delta
  }));
}

function getOffsetForAnimatingTab(aTab) {
  var numExpandingTabs = evaluateXPath(
    `count(self::*[${hasClass(kTAB_STATE_EXPANDING)}] |
           preceding-sibling::${kXPATH_NORMAL_TAB}[${hasClass(kTAB_STATE_EXPANDING)}])`,
    aTab,
    XPathResult.NUMBER_TYPE
  ).numberValue;
  if (isNaN(numExpandingTabs))
    numExpandingTabs = 0;

  var numCollapsingTabs = evaluateXPath(
    `count(self::*[${hasClass(kTAB_STATE_COLLAPSING)}] |
           preceding-sibling::${kXPATH_NORMAL_TAB}[${hasClass(kTAB_STATE_COLLAPSING)}])`,
    aTab,
    XPathResult.NUMBER_TYPE
  ).numberValue;
  if (isNaN(numCollapsingTabs))
    numCollapsingTabs = 0;

  return (numExpandingTabs * gTabHeight) - (numCollapsingTabs * gTabHeight);
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

