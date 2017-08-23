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

function tryMoveFocusFromClosingCurrentTab(aTab) {
  log('tryMoveFocusFromClosingCurrentTab');
  if (!isActive(aTab))
    return;

  var nextFocusedTab = null;

  var closeParentBehavior = kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD; //getCloseParentBehaviorForTab(aTab);
  var firstChild = getFirstChildTab(aTab);
  if (firstChild &&
      (closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN ||
       closeParentBehavior == kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD))
    nextFocusedTab = firstChild;
  log('focus to first child?: ', !!nextFocusedTab);

  var toBeClosedTabs = []; // collectNeedlessGroupTabs(aTab);
  var parentTab = getParentTab(aTab);
  if (parentTab) {
    if (!nextFocusedTab && aTab == getLastChildTab(parentTab)) {
      if (aTab == getFirstChildTab(parentTab)) { // this is the really last child
        nextFocusedTab = parentTab;
        log('focus to parent?: ', !!nextFocusedTab);
      }
      else {
        nextFocusedTab = getPreviousSiblingTab(aTab);
        log('focus to previous sibling?: ', !!nextFocusedTab);
      }
    }
    if (nextFocusedTab && toBeClosedTabs.indexOf(nextFocusedTab) > -1)
      nextFocusedTab = getNextFocusedTab(parentTab);
  }
  else if (!nextFocusedTab) {
    nextFocusedTab = getNextFocusedTab(aTab);
    log('focus to getNextFocusedTab()?: ', !!nextFocusedTab);
  }
  if (nextFocusedTab && toBeClosedTabs.indexOf(nextFocusedTab) > -1)
    nextFocusedTab = getNextFocusedTab(nextFocusedTab);

  if (!nextFocusedTab || isHidden(nextFocusedTab))
    return;

  log('focus to: ', dumpTab(nextFocusedTab));

  //XXX notify kEVENT_TYPE_FOCUS_NEXT_TAB for others
  //if (!canFocus)
  //  return;

  //focusChangedByCurrentTabRemove = true;
  browser.tabs.update(nextFocusedTab.apiTab.id, { active: true });
}


// collapse/expand tabs

function collapseExpandSubtree() {
}

function collapseExpandTab() {
}

async function updateTabCollapsed(aTab, aParams = {}) {
  log('updateTabCollapsed ', dumpTab(aTab));
  if (!aTab.parentNode) // do nothing for closed tab!
    return;

  if (aTab.onEndCollapseExpandAnimation) {
    aTab.removeEventListener('transitionend', aTab.onEndCollapseExpandAnimation, { once: true });
    delete aTab.onEndCollapseExpandAnimation;
  }

  aTab.setAttribute(kCOLLAPSING_PHASE, aParams.collapsed ? kCOLLAPSING_PHASE_TO_BE_COLLAPSED : kCOLLAPSING_PHASE_TO_BE_EXPANDED );

  var endMargin, endOpacity;
  if (aParams.collapsed) {
    let firstTab = getFirstNormalTab(aTab) || getFirstTab(aTab);
    endMargin  = firstTab.getBoundingClientRect().height;
    endOpacity = 0;
  }
  else {
    endMargin  = 0;
    endOpacity = 1;
  }

  if (!canAnimate() ||
      aParams.justNow ||
      configs.collapseDuration < 1) {
    log('=> skip animation');
    if (aParams.collapsed)
      aTab.classList.add(kCOLLAPSED_DONE);
    else
      aTab.classList.remove(kCOLLAPSED_DONE);
    aTab.removeAttribute(kCOLLAPSING_PHASE);

    // Pinned tabs are positioned by "margin-top", so
    // we must not reset the property for pinned tabs.
    // (However, we still must update "opacity".)
    if (!isPinned(aTab))
      aTab.style.marginTop = endMargin ? `-${endMargin}px` : '';

    if (endOpacity == 0)
      aTab.style.opacity = 0;
    else
      aTab.style.opacity = '';

    if (typeof aParams.onStart == 'function')
      aParams.onStart();
    return;
  }

  if (!aParams.collapsed)
    aTab.classList.remove(kCOLLAPSED_DONE);

  return new Promise((aResolve, aReject) => {
    window.requestAnimationFrame(() => {
      if (typeof aParams.onStart == 'function')
        aParams.onStart();

      aTab.onEndCollapseExpandAnimation = (() => {
        delete aTab.onEndCollapseExpandAnimation;
        log('=> finish animation for ', dumpTab(aTab));
        if (aParams.collapsed)
          aTab.classList.add(kCOLLAPSED_DONE);
        aTab.removeAttribute(kCOLLAPSING_PHASE);
        if (endOpacity > 0) {
          if (window.getComputedStyle(aTab).opacity > 0) {
            aTab.style.opacity = '';
            aTab = null;
          }
          else {
            // If we clear its "opacity" before it becomes "1"
            // by CSS transition, the calculated opacity will
            // become 0 after we set an invalid value to clear it.
            // So we have to clear it with delay.
            // This is workaround for the issue:
            //   https://github.com/piroor/treestyletab/issues/1202
            setTimeout(function() {
              aTab.style.opacity = '';
              aTab = null;
            }, 0);
          }
        }
        aResolve();
      });
      aTab.addEventListener('transitionend', aTab.onEndCollapseExpandAnimation, { once: true });

      aTab.style.marginTop = endMargin ? `-${endMargin}px` : '';
      aTab.style.opacity   = endOpacity;
    });
  });
}

async function forceExpandTabs(aTabs) {
  var collapsedStates = aTabs.map(isSubtreeCollapsed);
  await Promise.all(aTabs.map(aTab => {
    collapseExpandSubtree(aTab, { collapsed: false, justNow: true });
	collapseExpandTab(aTab, { collapsed: false, justNow: true });
  }));
  return collapsedStates;
}
