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

function isActive(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_ACTIVE);
}

function isPinned(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_PINNED);
}

function isAudible(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_AUDIBLE);
}

function isSoundPlaying(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_SOUND_PLAYING);
}

function maybeSoundPlaying(aTab) {
  return aTab && aTab.parentNode &&
         (aTab.classList.contains(kTAB_STATE_SOUND_PLAYING) ||
          (aTab.classList.contains(kTAB_STATE_HAS_SOUND_PLAYING_MEMBER) &&
           aTab.hasAttribute(kCHILDREN)));
}

function isMuted(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_MUTED);
}

function maybeMuted(aTab) {
  return aTab && aTab.parentNode &&
         (aTab.classList.contains(kTAB_STATE_MUTED) ||
          (aTab.classList.contains(kTAB_STATE_HAS_MUTED_MEMBER) &&
           aTab.hasAttribute(kCHILDREN)));
}

function isHidden(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_HIDDEN);
}

function isCollapsed(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_COLLAPSED);
}

function isOpening(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_OPENING);
}

function isDuplicating(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_DUPLICATING);
}

function isSubtreeCollapsed(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_SUBTREE_COLLAPSED);
}

function shouldCloseTabSubtreeOf(aTab) {
  return (hasChildTabs(aTab) &&
          (configs.closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
           isSubtreeCollapsed(aTab)));
}

function shouldCloseLastTabSubtreeOf(aTab) {
  return (aTab && aTab.parentNode &&
          shouldCloseTabSubtreeOf(aTab) &&
          getDescendantTabs(aTab).length + 1 == getAllTabs(aTab).length);
}

function isGroupTab(aTab) {
  if (!aTab)
    return false;
  return aTab.classList.contains(kTAB_STATE_GROUP_TAB) ||
         aTab.apiTab.url.indexOf(kGROUP_TAB_URI) == 0;
}

function isTemporaryGroupTab(aTab) {
  if (!isGroupTab(aTab))
    return false;
  return aTab.apiTab.url.indexOf('&temporary=true') > -1;
}

function isSelected(aTab) {
  return aTab && aTab.parentNode &&
           aTab.classList.contains(kTAB_STATE_SELECTED);
}

function isLocked(aTab) {
  return false;
}

function hasChildTabs(aParent) {
  if (!aParent || !aParent.parentNode)
    return false;
  return aParent.hasAttribute(kCHILDREN);
}

function getLabelWithDescendants(aTab) {
  var label = [`* ${aTab.label}`];
  for (let child of getChildTabs(aTab)) {
    if (!child.labelWithDescendants)
      child.labelWithDescendants = getLabelWithDescendants(child);
    label.push(child.labelWithDescendants.replace(/^/gm, '  '));
  }
  return label.join('\n');
}

function getMaxTreeLevel(aHint, aOptions = {}) {
  var tabCondition = aOptions.onlyVisible ?
                       `${kXPATH_VISIBLE_TAB}[@${kPARENT}]` :
                       `${kXPATH_CONTROLLABLE_TAB}[@${kPARENT}]`;
  var maxLevel = evaluateXPath(
    `descendant::${tabCondition}[
       not(preceding-sibling::${tabCondition}/@${kLEVEL} > @${kLEVEL})
     ][
       not(following-sibling::${tabCondition}/@${kLEVEL} > @${kLEVEL})
     ]/@${kLEVEL}`,
    getTabsContainer(aHint) || document,
    XPathResult.NUMBER_TYPE
  ).numberValue;
  if (isNaN(maxLevel))
    return 0;
  else
    return maxLevel;
}

// if all tabs are aldeardy placed at there, we don't need to move them.
function isAllTabsPlacedBefore(aTabs, aNextTab) {
  aTabs = Array.slice(aTabs);
  var previousTab = aTabs.shift();
  for (let tab of aTabs) {
    if (tab.previousSibling != previousTab)
      return false;
    previousTab = tab;
  }
  return !aNextTab ||
         !previousTab ||
         previousTab.nextSibling == aNextTab;
}

function isAllTabsPlacedAfter(aTabs, aPreviousTab) {
  aTabs = Array.slice(aTabs).reverse();
  var nextTab = aTabs.shift();
  for (let tab of aTabs) {
    if (tab.nextSibling != nextTab)
      return false;
    nextTab = tab;
  }
  return !aPreviousTab ||
         !nextTab ||
         nextTab.previousSibling == aPreviousTab;
}

