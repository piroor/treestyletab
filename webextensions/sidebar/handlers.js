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



function isNewTabAction(aEvent) {
  return aEvent.button == 1 || (aEvent.button == 0 && isAccelKeyPressed(aEvent));
}

function isAccelKeyPressed(aEvent) {
  return gIsMac ?
    (aEvent.metaKey || (aEvent.keyCode == aEvent.DOM_VK_META)) :
    (aEvent.ctrlKey || (aEvent.keyCode == aEvent.DOM_VK_CONTROL)) ;
}

function isCopyAction(aEvent) {
  return isAccelKeyPressed(aEvent) ||
      (aEvent.dataTransfer && aEvent.dataTransfer.dropEffect == 'copy');
}

function isEventFiredOnClosebox(aEvent) {
  return evaluateXPath(
      'ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " tab-close-button ")]',
      aEvent.originalTarget || aEvent.target,
      XPathResult.BOOLEAN_TYPE
    ).booleanValue;
}

function isEventFiredOnClickable(aEvent) {
  return evaluateXPath(
      'ancestor-or-self::*[contains(" button scrollbar textbox ", concat(" ", local-name(), " "))]',
      aEvent.originalTarget || aEvent.target,
      XPathResult.BOOLEAN_TYPE
    ).booleanValue;
}

function isEventFiredOnScrollbar(aEvent) {
  return evaluateXPath(
      'ancestor-or-self::*[local-name()="scrollbar" or local-name()="nativescrollbar"]',
      aEvent.originalTarget || aEvent.target,
      XPathResult.BOOLEAN_TYPE
    ).booleanValue;
}

function isEventFiredOnTwisty(aEvent) {
  var tab = findTabFromEvent(aEvent);
  if (!tab || !hasChildTabs(tab))
    return false;

  var twisty = tab.querySelector(`.${kTWISTY}`);
  if (!twisty)
    return false;

  var twistyRect = twisty.getBoundingClientRect();
  var left    = twistyRect.left;
  var top     = twistyRect.top;
  var right   = twistyRect.right;
  var bottom  = twistyRect.bottom;
  var favicon = getFaviconRect(tab);
  if (!box.width || !box.height) {
    left   = favicon.left;
    top    = favicon.top;
    right  = favicon.right;
    bottom = favicon.bottom;
  }
  else if (configs.shouldExpandTwistyArea) {
    left   = Math.min(left,   favicon.left);
    top    = Math.min(top,    favicon.top);
    right  = Math.max(right,  favicon.right);
    bottom = Math.max(bottom, favicon.bottom);
  }

  var x = aEvent.clientX;
  var y = aEvent.clientY;
  return (x >= left && x <= right && y >= top && y <= bottom);
}
function getFaviconRect(aTab) {
  var icon         = tab.querySelector(`.${kFAVICON}`);
  var iconRect     = icon.getBoundingClientRect();
  var throbber     = tab.querySelector(`.${kTHROBBER}`);
  var throbberRect = throbber.getBoundingClientRect();

  if (!iconRect.width && !iconRect.height)
    return throbberRect;

  if (!throbberRect.width && !throbberRect.height)
    return iconRect;

  return {
    left   : Math.min(throbberRect.left,   iconRect.left),
    right  : Math.max(throbberRect.right,  iconRect.right),
    top    : Math.min(throbberRect.top,    iconRect.top),
    bottom : Math.max(throbberRect.bottom, iconRect.bottom)
  };
}
