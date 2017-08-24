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

function isAccelAction(aEvent) {
  return aEvent.button == 1 || (aEvent.button == 0 && isAccelKeyPressed(aEvent));
}

function isAccelKeyPressed(aEvent) {
  return gIsMac ?
    (aEvent.metaKey || ('keyCode' in aEvent && aEvent.keyCode == aEvent.DOM_VK_META)) :
    (aEvent.ctrlKey || ('keyCode' in aEvent && aEvent.keyCode == aEvent.DOM_VK_CONTROL)) ;
}

function isCopyAction(aEvent) {
  return isAccelKeyPressed(aEvent) ||
      (aEvent.dataTransfer && aEvent.dataTransfer.dropEffect == 'copy');
}

function isEventFiredOnTwisty(aEvent) {
  var tab = getTabFromEvent(aEvent);
  if (!tab || !hasChildTabs(tab))
    return false;

  var twisty = evaluateXPath(
    `ancestor-or-self::*[${hasClass(kTWISTY)}]`,
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
  if (twisty)
    return true;

  if (!configs.shouldExpandTwistyArea)
    return false;

  var favicon = evaluateXPath(
    `ancestor-or-self::*[${hasClass(kFAVICON)}]`,
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
  if (favicon)
    return true;

  return false;
}

function isEventFiredOnClosebox(aEvent) {
  return evaluateXPath(
      `ancestor-or-self::*[${hasClass(kCLOSEBOX)}]`,
      aEvent.originalTarget || aEvent.target,
      XPathResult.BOOLEAN_TYPE
    ).booleanValue;
}

function isEventFiredOnNewTabButton(aEvent) {
  return evaluateXPath(
      `ancestor-or-self::*[${hasClass(kNEWTAB_BUTTON)}]`,
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

function isTabInViewport(aTab) {
  if (!aTab)
    return false;

  if (isPinned(aTab))
    return true;

  var tabRect = aTab.getBoundingClientRect();
  var containerRect = aTab.parentNode.getBoundingClientRect();

  return (
    containerRect.top >= barBox.top &&
    containerRect.bottom <= barBox.bottom
  );
}

function onResize(aEvent) {
  reserveToUpdateTabbarLayout();
}

function onMouseDown(aEvent) {
  var tab = getTabFromEvent(aEvent);
  if (isAccelAction(aEvent)) {
    if (tab/* && warnAboutClosingTabSubtreeOf(tab)*/) {
      log('middle-click to close');
      browser.runtime.sendMessage({
        type:      kCOMMAND_REMOVE_TAB,
        windowId:  gTargetWindow,
        tab:       tab.id
      });
      aEvent.stopPropagation();
      aEvent.preventDefault();
    }
    else if (isEventFiredOnNewTabButton(aEvent)) {
      aEvent.stopPropagation();
      aEvent.preventDefault();
      handleNewTabAction(aEvent);
    }
    return;
  }

  tab = tab || getTabFromTabbarEvent(aEvent);
  if (!tab)
    return;

  if (isEventFiredOnTwisty(aEvent)) {
    log('clicked on twisty');
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (hasChildTabs(tab))
      browser.runtime.sendMessage({
        type:      kCOMMAND_PUSH_SUBTREE_COLLAPSED_STATE,
        windowId:  gTargetWindow,
        tab:       tab.id,
        collapsed: !isSubtreeCollapsed(tab),
        manualOperation: true
      });
    return;
  }

  if (isEventFiredOnClosebox(aEvent) &&
      aEvent.button == 0) {
    log('mousedown on closebox');
    return;
  }

  browser.runtime.sendMessage({
    type:      kCOMMAND_SELECT_TAB,
    windowId:  gTargetWindow,
    tab:       tab.id
  });
}

function onClick(aEvent) {
  if (isEventFiredOnNewTabButton(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    handleNewTabAction(aEvent);
    return;
  }

  if (!isEventFiredOnClosebox(aEvent))
    return;

  aEvent.stopPropagation();
  aEvent.preventDefault();

  log('clicked on closebox');
  var tab = getTabFromEvent(aEvent);
  //if (!warnAboutClosingTabSubtreeOf(tab)) {
  //  aEvent.stopPropagation();
  //  aEvent.preventDefault();
  //  return;
  //}
  browser.runtime.sendMessage({
    type:      kCOMMAND_REMOVE_TAB,
    windowId:  gTargetWindow,
    tab:       tab.id
  });
}

function handleNewTabAction(aEvent) {
  browser.runtime.sendMessage({
    type:      kCOMMAND_NEW_TAB,
    windowId:  gTargetWindow,
    accel:     isAccelAction(aEvent)
  });
}

function onDblClick(aEvent) {
  if (isEventFiredOnNewTabButton(aEvent) ||
      getTabFromEvent(aEvent))
    return;

  aEvent.stopPropagation();
  aEvent.preventDefault();
  handleNewTabAction(aEvent);
}

function onTabOpening(aEvent) {
  var tab = aEvent.target;
  fixupTab(tab);

  if (configs.animation) {
    updateTabCollapsed(tab, {
      collapsed: true,
      justNow:   true
    });
    window.requestAnimationFrame(() => {
      tab.classList.add(kTAB_STATE_ANIMATION_READY);
      updateTabCollapsed(tab, {
        collapsed: false,
        justNow:   gRestoringTree,
        /**
         * When the system is too slow, the animation can start after
         * smooth scrolling is finished. The smooth scrolling should be
         * started together with the start of the animation effect.
         */
        onStart: () => scrollToNewTab(tab)
      });
    });
  }
  else {
    tab.classList.add(kTAB_STATE_ANIMATION_READY);
    scrollToNewTab(tab);
  }
}

function onTabOpened(aEvent) {
  reserveToUpdateTabbarLayout();
}

function onTabClosed(aEvent) {
  reserveToUpdateTabbarLayout();
}

function onTabMoved(aEvent) {
  reserveToUpdateTabbarLayout();
}

function onTabInternalFocusRequested(aEvent) {
  var tab = aEvent.target;
  browser.runtime.sendMessage({
    type:     kCOMMAND_SELECT_TAB_INTERNALLY,
    windowId: tab.apiTab.windowId,
    tab:      tab.id
  });
}

function onTabLevelChanged(aEvent) {
  var baseIndent = gIndent;
  if (gIndent < 0)
    baseIndent = configs.baseIndent;
  var tab = aEvent.target;
  window.requestAnimationFrame(() => {
    var level = parseInt(tab.getAttribute(kNEST) || 0);
    var indent = level * baseIndent;
    var expected = indent == 0 ? 0 : indent + 'px' ;
    log('setting indent: ', { tab: dumpTab(tab), expected: expected, level: level });
    if (tab.style[gIndentProp] != expected) {
      window.requestAnimationFrame(() => tab.style[gIndentProp] = expected);
    }
  });
}

function onTabCollapsedStateChanging(aEvent) {
  var tab = aEvent.target;
  var collapsed = aEvent.detail.collapsed;

  //log('updateTabCollapsed ', dumpTab(tab));
  if (!tab.parentNode) // do nothing for closed tab!
    return;

  if (tab.onEndCollapseExpandAnimation) {
    tab.removeEventListener('transitionend', tab.onEndCollapseExpandAnimation, { once: true });
    delete tab.onEndCollapseExpandAnimation;
  }

  tab.setAttribute(kCOLLAPSING_PHASE, collapsed ? kCOLLAPSING_PHASE_TO_BE_COLLAPSED : kCOLLAPSING_PHASE_TO_BE_EXPANDED );

  var endMargin, endOpacity;
  if (collapsed) {
    let firstTab = getFirstNormalTab(tab) || getFirstTab(tab);
    endMargin  = firstTab.getBoundingClientRect().height;
    endOpacity = 0;
  }
  else {
    endMargin  = 0;
    endOpacity = 1;
  }

  var readyToScroll = (() => {
    tab.dispatchEvent(new CustomEvent(kEVENT_EXPANDED_TREE_READY_TO_SCROLL, {
      bubbles: true,
      cancelable: false
    }));
  });

  if (!configs.animation ||
      aEvent.detail.justNow ||
      configs.collapseDuration < 1) {
    //log('=> skip animation');
    if (collapsed)
      tab.classList.add(kTAB_STATE_COLLAPSED_DONE);
    else
      tab.classList.remove(kTAB_STATE_COLLAPSED_DONE);
    tab.removeAttribute(kCOLLAPSING_PHASE);

    // Pinned tabs are positioned by "margin-top", so
    // we must not reset the property for pinned tabs.
    // (However, we still must update "opacity".)
    if (!isPinned(tab))
      tab.style.marginTop = endMargin ? `-${endMargin}px` : '';

    if (endOpacity == 0)
      tab.style.opacity = 0;
    else
      tab.style.opacity = '';

    if (aEvent.detail.last)
      readyToScroll();
    return;
  }

  if (!collapsed)
    tab.classList.remove(kTAB_STATE_COLLAPSED_DONE);

  window.requestAnimationFrame(() => {
    //log('start animation for ', dumpTab(tab));
    if (aEvent.detail.last)
      readyToScroll();

    tab.onEndCollapseExpandAnimation = (() => {
      delete tab.onEndCollapseExpandAnimation;
      if (backupTimer)
        clearTimeout(backupTimer);
      //log('=> finish animation for ', dumpTab(tab));
      if (collapsed)
        tab.classList.add(kTAB_STATE_COLLAPSED_DONE);
      tab.removeAttribute(kCOLLAPSING_PHASE);
      if (endOpacity > 0) {
        if (window.getComputedStyle(tab).opacity > 0) {
          tab.style.opacity = '';
          tab = null;
        }
        else {
          // If we clear its "opacity" before it becomes "1"
          // by CSS transition, the calculated opacity will
          // become 0 after we set an invalid value to clear it.
          // So we have to clear it with delay.
          // This is workaround for the issue:
          //   https://github.com/piroor/treestyletab/issues/1202
          setTimeout(function() {
            tab.style.opacity = '';
            tab = null;
          }, 0);
        }
      }
      reserveToUpdateTabbarLayout();
    });
    tab.addEventListener('transitionend', tab.onEndCollapseExpandAnimation, { once: true });
    var backupTimer = setTimeout(() => {
      if (!tab || !tab.onEndCollapseExpandAnimation)
        return;
      backupTimer = null
      tab.removeEventListener('transitionend', tab.onEndCollapseExpandAnimation, { once: true });
      tab.onEndCollapseExpandAnimation();
    }, configs.collapseDuration);

    tab.style.marginTop = endMargin ? `-${endMargin}px` : '';
    tab.style.opacity   = endOpacity;
  });
}

function onExpandedTreeReadyToScroll(aEvent) {
  //scrollToTabSubtree(aEvent.target);
}

/*
function onTabSubtreeCollapsedStateChangedManually(aEvent) {
  if (!configs.indentAutoShrink ||
      !configs.indentAutoShrinkOnlyForVisible)
    return;

  cancelCheckTabsIndentOverflow();
  if (!aTab.checkTabsIndentOverflowOnMouseLeave) {
    let stillOver = false;
    let id = aTab.id
    aTab.checkTabsIndentOverflowOnMouseLeave = function checkTabsIndentOverflowOnMouseLeave(aEvent, aDelayed) {
      if (aEvent.type == 'mouseover') {
        if (evaluateXPath(
              `ancestor-or-self::*[#${id}]`,
              aEvent.originalTarget || aEvent.target,
              XPathResult.BOOLEAN_TYPE
            ).booleanValue)
            stillOver = true;
          return;
        }
        else if (!aDelayed) {
          if (stillOver) {
            stillOver = false;
          }
          setTimeout(() => aTab.checkTabsIndentOverflowOnMouseLeave(aEvent, true), 0);
          return;
        } else if (stillOver) {
          return;
        }
        var x = aEvent.clientX;
        var y = aEvent.clientY;
        var rect = aTab.getBoundingClientRect();
        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom)
          return;
        document.removeEventListener('mouseover', aTab.checkTabsIndentOverflowOnMouseLeave, true);
        document.removeEventListener('mouseout', aTab.checkTabsIndentOverflowOnMouseLeave, true);
        delete aTab.checkTabsIndentOverflowOnMouseLeave;
        checkTabsIndentOverflow();
      };
      document.addEventListener('mouseover', aTab.checkTabsIndentOverflowOnMouseLeave, true);
      document.addEventListener('mouseout', aTab.checkTabsIndentOverflowOnMouseLeave, true);
    }
  }
}
*/

function onTabPinned(aEvent) {
  var tab = aEvent.target;
  collapseExpandSubtree(tab, { collapsed: false });
  detachAllChildren(tab, {
    behavior: getCloseParentBehaviorForTab(
      tab,
      kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
    )
  });
  detachTab(tab);
  collapseExpandTab(tab, { collapsed: false });
  reserveToPositionPinnedTabs();
}

function onTabUnpinned(aEvent) {
  var tab = aEvent.target;
  clearPinnedStyle(tab);
  //updateInvertedTabContentsOrder(tab);
  reserveToPositionPinnedTabs();
}
