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
import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as Size from './size.js';
import * as EventUtils from './event-utils.js';
import * as DragAndDrop from './drag-and-drop.js';

function log(...args) {
  internalLogger('sidebar/tab-drag-handle', ...args);
}

let mHandle;
let mListening = false;

let mTargetTabId;
let mLastX;
let mLastY;

let mShowTimer;
let mHideTimer;

const HANDLE_MARGIN = 3;

export function init() {
  mHandle = document.querySelector('#tab-drag-handle');

  mHandle.addEventListener('dragstart', onDragStart);

  configs.$addObserver(onConfigChange);
  onConfigChange('showTabDragHandle');
}

function onConfigChange(key) {
  if (key != 'showTabDragHandle' ||
      mListening == configs.showTabDragHandle)
    return;

  if (configs.showTabDragHandle) {
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('mousemove', onMouseMove, { capture: true, passive: true });
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('click', onClick, true);
    mListening = true;
  }
  else {
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mousemove', onMouseMove, { capture: true, passive: true });
    document.removeEventListener('scroll', onScroll, true);
    document.removeEventListener('click', onClick, true);
    mListening = false;
  }
}

function show(tab) {
  if (show.timer)
    clearTimeout(show.timer);
  show.timer = setTimeout(() => {
    delete show.timer;
    doShow(tab);
  }, 100);
}
function doShow(tab) {
  if (!configs.showTabDragHandle ||
      !Tabs.ensureLivingTab(tab) ||
      !tab.$TST.element.matches(':hover'))
    return;

  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }

  mHandle.classList.remove('animating');
  mHandle.classList.remove('shown');

  for (const activeItem of mHandle.querySelectorAll('.active')) {
    activeItem.classList.remove('active');
  }

  mTargetTabId = tab.id;
  if (Tabs.hasChildTabs(tab))
    mHandle.classList.add('has-child');
  else
    mHandle.classList.remove('has-child');

  const x = mLastX;
  const y = mLastY;
  const offset = HANDLE_MARGIN; // this is required to allow clicking of the tab itself.

  let handleRect = mHandle.getBoundingClientRect();
  if (Tabs.isPinned(tab) ||
      configs.sidebarPosition == Constants.kTABBAR_POSITION_LEFT) {
    mHandle.style.left = `${x + offset}px`;
  }
  else {
    mHandle.style.left = `${x - handleRect.width - offset}px`;
  }
  // Tab drag handle shown at bottom-right of the cursor will be covered partially,
  // by the tooltip for tab's title so we should move it up a little.
  mHandle.style.top = `${Math.max(0, Math.floor(y - (handleRect.height / 2)))}px`;

  // reposition
  handleRect = mHandle.getBoundingClientRect();
  if (handleRect.left < 0) {
    mHandle.style.left = `${x + offset}px`;
  }
  else if (handleRect.right > window.innerWidth) {
    mHandle.style.left = `${x - handleRect.width - offset}px`;
  }
  if (handleRect.bottom > window.innerHeight)
    mHandle.style.top = `${y - handleRect.height - offset}px`;

  mHandle.classList.add('animating');
  mHandle.classList.add('shown');
  setTimeout(() => {
    if (mHandle.classList.contains('shown'))
      mHandle.classList.remove('animating');
  }, configs.collapseDuration);
}

function reserveToShow(tab) {
  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }
  if (mHideTimer &&
      mTargetTabId == tab.id) {
    clearTimeout(mHideTimer);
    mHideTimer = null;
  }
  mShowTimer = setTimeout(() => {
    if (mHideTimer) {
      clearTimeout(mHideTimer);
      mHideTimer = null;
    }
    mShowTimer = null;
    show(tab);
  }, configs.tabDragHandleDelay);
}

function hide() {
  mHandle.classList.add('animating');
  mHandle.classList.remove('shown');
  mTargetTabId = null;
}

function reserveToHide() {
  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }
  // we don't need to throttle "hide" operation!
  if (mHideTimer)
    return;
  mHideTimer = setTimeout(() => {
    mHideTimer = null;
    hide();
  }, configs.subMenuCloseDelay);
}

function onMouseDown(event) {
  const target = EventUtils.getElementTarget(event.target);
  if (!target || !target.closest(`#${mHandle.id}`))
    hide();
}
onMouseDown = EventUtils.wrapWithErrorHandler(onMouseDown);

function onMouseMove(event) {
  if (!configs.showTabDragHandle)
    return;

  mLastX = event.clientX;
  mLastY = event.clientY;

  // We need to use coordinates because elements with
  // "pointer-events:none" won't be found by element.closest().
  const dragHandlerRect = mHandle.getBoundingClientRect();
  if (mHandle.classList.contains('shown') &&
      event.clientX >= dragHandlerRect.left - HANDLE_MARGIN &&
      event.clientY >= dragHandlerRect.top - HANDLE_MARGIN &&
      event.clientX <= dragHandlerRect.right + HANDLE_MARGIN &&
      event.clientY <= dragHandlerRect.bottom + HANDLE_MARGIN) {
    if (mHideTimer) {
      clearTimeout(mHideTimer);
      mHideTimer = null;
    }
    log('onMouseMove: on tab drag handler');
    return;
  }

  const tab    = EventUtils.getTabFromEvent(event);
  const target = EventUtils.getElementTarget(event.target);
  if (tab) {
    const tabRect  = tab.$TST.element.getBoundingClientRect();
    const areaSize = Math.min(Size.getFavIconSize() * 1.5, tabRect.width / 2);
    const onLeft   = Tabs.isPinned(tab) || configs.sidebarPosition == Constants.kTABBAR_POSITION_LEFT;
    const onArea   = (onLeft &&
                      event.clientX >= tabRect.left &&
                      event.clientX <= Math.min(tabRect.left + areaSize, tabRect.right)) ||
                     (!onLeft &&
                      event.clientX <= tabRect.right &&
                      event.clientX >= Math.max(tabRect.left, tabRect.right - areaSize));
    if (onArea) {
      if (mTargetTabId != tab.id) {
        log('onMouseMove: on sensitive area / show');
        reserveToHide();
        reserveToShow(tab);
      }
    }
    else {
      log('onMouseMove: out of sensitive area / hide');
      reserveToHide();
    }
  }
  else if (!target || !target.closest(`#${mHandle.id}`)) {
    log('onMouseMove: out of tabs, out of tab drag handle');
    reserveToHide();
  }
}
onMouseMove = EventUtils.wrapWithErrorHandler(onMouseMove);

function onScroll() {
  hide();
  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }
}
onScroll = EventUtils.wrapWithErrorHandler(onScroll);

function onClick() {
  hide();
  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }
}
onClick = EventUtils.wrapWithErrorHandler(onClick);

function onDragStart(event) {
  // get target tab at first before it is cleared by hide()
  const tab = Tabs.trackedTabs.get(mTargetTabId);
  log('onDragStart: tab = ', mTargetTabId, tab);

  if (!tab) {
    hide();
    return;
  }

  event.stopPropagation();

  const target = EventUtils.getElementTarget(event.target);
  target.classList.add('active');
  target.classList.add('animating');

  setTimeout(() => {
    hide();
  }, configs.tabDragHandleFeedbackDuration);

  let behavior = 0;
  if (!target.closest('.shouldIgnoreDescendants'))
    behavior |= Constants.kDRAG_BEHAVIOR_WHOLE_TREE;
  if (target.closest('.allowBookmark'))
    behavior |= Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK;

  return DragAndDrop.onDragStart(event, { tab, behavior });
}
onDragStart = EventUtils.wrapWithErrorHandler(onDragStart);

