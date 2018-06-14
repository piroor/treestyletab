/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from '../common/common.js';
import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as Size from './size.js';

export function isMiddleClick(aEvent) {
  return aEvent.button == 1;
}

export function isAccelAction(aEvent) {
  return isMiddleClick(aEvent) || (aEvent.button == 0 && isAccelKeyPressed(aEvent));
}

export function isAccelKeyPressed(aEvent) {
  return /^Mac/i.test(navigator.platform) ?
    (aEvent.metaKey || aEvent.key == 'Meta') :
    (aEvent.ctrlKey || aEvent.key == 'Control') ;
}

export function isCopyAction(aEvent) {
  return isAccelKeyPressed(aEvent) ||
           (aEvent.dataTransfer && aEvent.dataTransfer.dropEffect == 'copy');
}

export function getElementTarget(aEvent) {
  const target = aEvent.target;
  if (target.nodeType == Node.TEXT_NODE)
    return target.parentNode;
  return target;
}

export function isEventFiredOnTwisty(aEvent) {
  const tab = getTabFromEvent(aEvent);
  if (!tab || !Tabs.hasChildTabs(tab))
    return false;

  return !!getElementTarget(aEvent).closest(`.${Constants.kTWISTY}`);
}

export function isEventFiredOnSoundButton(aEvent) {
  return !!getElementTarget(aEvent).closest(`.${Constants.kSOUND_BUTTON}`);
}

export function isEventFiredOnClosebox(aEvent) {
  return !!getElementTarget(aEvent).closest(`.${Constants.kCLOSEBOX}`);
}

export function isEventFiredOnNewTabButton(aEvent) {
  return !!getElementTarget(aEvent).closest(`.${Constants.kNEWTAB_BUTTON}`);
}

export function isEventFiredOnMenuOrPanel(aEvent) {
  return !!getElementTarget(aEvent).closest('ul.menu, ul.panel');
}

export function isEventFiredOnAnchor(aEvent) {
  return !!getElementTarget(aEvent).closest(`[data-menu-ui]`);
}

export function isEventFiredOnClickable(aEvent) {
  return !!getElementTarget(aEvent).closest(`button, scrollbar, select`);
}

export function isEventFiredOnScrollbar(aEvent) {
  return !!getElementTarget(aEvent).closest(`scrollbar, nativescrollbar`);
}


export function getTabFromEvent(aEvent) {
  return Tabs.getTabFromChild(aEvent.target);
}

export function getTabsContainerFromEvent(aEvent) {
  return Tabs.getTabsContainer(aEvent.target);
}

export function getTabFromTabbarEvent(aEvent) {
  if (!configs.shouldDetectClickOnIndentSpaces ||
      isEventFiredOnClickable(aEvent))
    return null;
  return getTabFromCoordinates(aEvent);
}

export function getTabFromCoordinates(aEvent) {
  let tab = document.elementFromPoint(aEvent.clientX, aEvent.clientY);
  tab = Tabs.getTabFromChild(tab);
  if (tab)
    return tab;

  const container = getTabsContainerFromEvent(aEvent);
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
    const tab = Tabs.getTabFromChild(document.elementFromPoint(x, aEvent.clientY));
    if (tab)
      return tab;
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
