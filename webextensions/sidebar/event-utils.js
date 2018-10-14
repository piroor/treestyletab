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

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('sidebar/event-utils', ...args);
}

export function isMiddleClick(event) {
  return event.button == 1;
}

export function isAccelAction(event) {
  return isMiddleClick(event) || (event.button == 0 && isAccelKeyPressed(event));
}

export function isAccelKeyPressed(event) {
  return /^Mac/i.test(navigator.platform) ?
    (event.metaKey || event.key == 'Meta') :
    (event.ctrlKey || event.key == 'Control') ;
}

export function isCopyAction(event) {
  return isAccelKeyPressed(event) ||
           (event.dataTransfer && event.dataTransfer.dropEffect == 'copy');
}

export function getElementTarget(eventOrTarget) {
  const target = 'nodeType' in eventOrTarget ? eventOrTarget : eventOrTarget.target;
  if (target.nodeType == Node.TEXT_NODE)
    return target.parentNode;
  return target;
}

export function isEventFiredOnTwisty(event) {
  const tab = getTabFromEvent(event);
  if (!tab || !Tabs.hasChildTabs(tab))
    return false;

  const target = getElementTarget(event);
  return target && target.closest && !!target.closest(`.${Constants.kTWISTY}`);
}

export function isEventFiredOnSoundButton(event) {
  const target = getElementTarget(event);
  return target && target.closest && !!target.closest(`.${Constants.kSOUND_BUTTON}`);
}

export function isEventFiredOnClosebox(event) {
  const target = getElementTarget(event);
  return target && target.closest && !!target.closest(`.${Constants.kCLOSEBOX}`);
}

export function isEventFiredOnNewTabButton(event) {
  const target = getElementTarget(event);
  return target && target.closest && !!target.closest(`.${Constants.kNEWTAB_BUTTON}`);
}

export function isEventFiredOnMenuOrPanel(event) {
  const target = getElementTarget(event);
  return target && target.closest && !!target.closest('ul.menu, ul.panel');
}

export function isEventFiredOnAnchor(event) {
  const target = getElementTarget(event);
  return target && target.closest && !!target.closest(`[data-menu-ui]`);
}

export function isEventFiredOnClickable(event) {
  const target = getElementTarget(event);
  return target && target.closest && !!target.closest(`button, scrollbar, select`);
}


export function getTabFromEvent(event, options = {}) {
  return Tabs.getTabFromChild(event.target, options);
}

function getTabsContainerFromEvent(event) {
  return Tabs.getTabsContainer(event.target);
}

export function getTabFromTabbarEvent(event, options = {}) {
  if (!configs.shouldDetectClickOnIndentSpaces ||
      isEventFiredOnClickable(event))
    return null;
  return getTabFromCoordinates(event, options);
}

function getTabFromCoordinates(event, options = {}) {
  let tab = document.elementFromPoint(event.clientX, event.clientY);
  tab = Tabs.getTabFromChild(tab, options);
  if (tab)
    return tab;

  const container = getTabsContainerFromEvent(event);
  if (!container)
    return null;

  // because tab style can be modified, we try to find tab from
  // left, middle, and right.
  const containerRect = container.getBoundingClientRect();
  const trialPoints = [
    Size.getFavIconSize(),
    containerRect.width / 2,
    containerRect.width - Size.getFavIconSize()
  ];
  for (const x of trialPoints) {
    const tab = Tabs.getTabFromChild(document.elementFromPoint(x, event.clientY), options);
    if (tab)
      return tab;
  }

  // document.elementFromPoint cannot find elements being in animation effect,
  // so I try to find a tab from previous or next tab.
  const height = Size.getTabHeight();
  for (const x of trialPoints) {
    const tab = Tabs.getTabFromChild(document.elementFromPoint(x, event.clientY - height), options);
    if (tab)
      return Tabs.getTabFromChild(tab.nextSibling, options);
  }
  for (const x of trialPoints) {
    const tab = Tabs.getTabFromChild(document.elementFromPoint(x, event.clientY + height), options);
    if (tab)
      return Tabs.getTabFromChild(tab.previousSibling, options);
  }

  return null;
}

const lastMousedown = new Map();

export function getLastMousedown(aButton) {
  return lastMousedown.get(aButton);
}

export function setLastMousedown(aButton, aDetails) {
  lastMousedown.set(aButton, aDetails);
}

export function cancelHandleMousedown(aButton = null) {
  if (!aButton && aButton !== 0) {
    return Array.from(lastMousedown.keys()).filter(aButton => cancelHandleMousedown(aButton)).length > 0;
  }

  const lastMousedownForButton = lastMousedown.get(aButton);
  if (lastMousedownForButton) {
    clearTimeout(lastMousedownForButton.timeout);
    lastMousedown.delete(aButton);
    return true;
  }
  return false;
}


export function wrapWithErrorHandler(func) {
  return (...args) => {
    try {
      const result = func(...args);
      if (result && result instanceof Promise)
        return result.catch(e => {
          console.log('Fatal async error: ', e);
          throw e;
        });
      else
        return result;
    }
    catch(e) {
      console.log('Fatal error: ', e);
      throw e;
    }
  };
}
