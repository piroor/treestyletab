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

let mTargetTabId;
let mLastX;
let mLastY;

let mShowTimer;
let mHideTimer;

export function init() {
  mHandle = document.querySelector('#tab-drag-handle');

  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mousemove', onMouseMove, { capture: true, passive: true });
  document.addEventListener('scroll', () => hide(), true);
  document.addEventListener('click', () => hide(), true);
  mHandle.addEventListener('dragstart', onDragStart);
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
      !tab.matches(':hover'))
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

  if (Tabs.isPinned(tab) ||
      configs.sidebarPosition == Constants.kTABBAR_POSITION_LEFT) {
    mHandle.style.right = '';
    mHandle.style.left  = `${x + 1}px`;
  }
  else {
    mHandle.style.left  = '';
    mHandle.style.right = `${x - 1}px`;
  }
  mHandle.style.bottom = '';
  mHandle.style.top    = `${y + 1}px`;

  // reposition
  const handlerRect = mHandle.getBoundingClientRect();
  if (handlerRect.left < 0) {
    mHandle.style.right = '';
    mHandle.style.left  = 0;
  }
  else if (handlerRect.right > window.innerWidth) {
    mHandle.style.left  = '';
    mHandle.style.right = 0;
  }
  if (handlerRect.bottom > window.innerHeight)
    mHandle.style.top = `${y - handlerRect.height - 1}px`;

  mHandle.classList.add('animating');
  mHandle.classList.add('shown');
  setTimeout(() => {
    if (mHandle.classList.contains('shown'))
      mHandle.classList.remove('animating');
  }, configs.collapseDuration);
}

function reserveToShow(tab) {
  if (mHideTimer) {
    clearTimeout(mHideTimer);
    mHideTimer = null;
  }
  mShowTimer = setTimeout(() => {
    mShowTimer = null;
    show(tab);
  }, configs.tabDragHandleDelay);
}

function hide() {
  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }
  mHandle.classList.add('animating');
  mHandle.classList.remove('shown');
  mTargetTabId = null;
}

function reserveToHide() {
  if (mShowTimer) {
    clearTimeout(mShowTimer);
    mShowTimer = null;
  }
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
      event.clientX >= dragHandlerRect.left &&
      event.clientY >= dragHandlerRect.top &&
      event.clientX <= dragHandlerRect.right &&
      event.clientY <= dragHandlerRect.bottom) {
    if (mHideTimer) {
      clearTimeout(mHideTimer);
      mHideTimer = null;
    }
    return;
  }

  const tab    = EventUtils.getTabFromEvent(event);
  const target = EventUtils.getElementTarget(event.target);
  if (tab) {
    const tabRect  = tab.getBoundingClientRect();
    const areaSize = Size.getFavIconSize() * 1.5;
    const onLeft   = Tabs.isPinned(tab) || configs.sidebarPosition == Constants.kTABBAR_POSITION_LEFT;
    const onArea   = (onLeft &&
                      event.clientX >= tabRect.left &&
                      event.clientX <= Math.min(tabRect.left + areaSize, tabRect.right)) ||
                     (!onLeft &&
                      event.clientX <= tabRect.right &&
                      event.clientX >= Math.max(tabRect.left, tabRect.right - areaSize));
    if (onArea) {
      if (mTargetTabId != tab.id)
        reserveToShow(tab);
    }
    else {
      reserveToHide();
    }
  }
  else if (!target || !target.closest(`#${mHandle.id}`)) {
    reserveToHide();
  }
}
onMouseMove = EventUtils.wrapWithErrorHandler(onMouseMove);

function onDragStart(event) {
  // get target tab at first before it is cleared by hide()
  const targetTab = Tabs.getTabById(mTargetTabId);
  log('onDragStart: targetTab = ', mTargetTabId, targetTab);

  if (!targetTab) {
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

  return DragAndDrop.onDragStart(event, {
    target: targetTab,
    behavior
  });
}
onDragStart = EventUtils.wrapWithErrorHandler(onDragStart);

