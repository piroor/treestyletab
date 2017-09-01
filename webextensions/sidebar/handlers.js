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

function isMiddleClick(aEvent) {
  return aEvent.button == 1;
}

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

  return evaluateXPath(
    `ancestor-or-self::*[${hasClass(kTWISTY)}]`,
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
}

function isEventFiredOnSoundButton(aEvent) {
  return evaluateXPath(
      `ancestor-or-self::*[${hasClass(kSOUND_BUTTON)}]`,
      aEvent.originalTarget || aEvent.target,
      XPathResult.BOOLEAN_TYPE
    ).booleanValue;
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


function getTabFromEvent(aEvent) {
  return getTabFromChild(aEvent.target);
}

function getTabsContainerFromEvent(aEvent) {
  return getTabsContainer(aEvent.target);
}

function getTabFromTabbarEvent(aEvent) {
  if (!configs.shouldDetectClickOnIndentSpaces ||
      isEventFiredOnClickable(aEvent))
    return null;
  return getTabFromCoordinates(aEvent);
}

function getTabFromCoordinates(aEvent) {
  var tab = document.elementFromPoint(aEvent.clientX, aEvent.clientY);
  tab = getTabFromChild(tab);
  if (tab)
    return tab;

  var container = getTabsContainerFromEvent(aEvent);
  if (!container)
    return null;

  var rect = container.getBoundingClientRect();
  for (let x = 0, maxx = rect.width, step = Math.floor(rect.width / 10);
       x < maxx; x += step) {
    tab = document.elementFromPoint(x, aEvent.clientY);
    tab = getTabFromChild(tab);
    if (tab)
      return tab;
  }

  return null;
}


/* handlers for DOM events */

function onResize(aEvent) {
  reserveToUpdateTabbarLayout();
  reserveToUpdateIndent();
}

function onMouseDown(aEvent) {
  var tab = getTabFromEvent(aEvent);
  //log('mousedown tab: ', tab);
  if (isMiddleClick(aEvent)) {
    if (tab/* && warnAboutClosingTabSubtreeOf(tab)*/) {
      //log('middle-click to close');
      browser.runtime.sendMessage({
        type:     kCOMMAND_REMOVE_TAB,
        windowId: gTargetWindow,
        tab:      tab.id
      });
      aEvent.stopPropagation();
      aEvent.preventDefault();
    }
    else if (isEventFiredOnNewTabButton(aEvent)) {
      aEvent.stopPropagation();
      aEvent.preventDefault();
      handleNewTabAction(aEvent, {
        action: configs.autoAttachOnNewTabButtonMiddleClick
      });
    }
    return;
  }

  tab = tab || getTabFromTabbarEvent(aEvent);
  //log('found target tab: ', tab);
  if (!tab)
    return;

  if (isEventFiredOnTwisty(aEvent)) {
    //log('clicked on twisty');
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (hasChildTabs(tab))
      collapseExpandSubtree(tab, {
        collapsed:       !isSubtreeCollapsed(tab),
        manualOperation: true,
        inRemote:        true
      });
    return;
  }

  if ((isEventFiredOnSoundButton(aEvent) ||
       isEventFiredOnClosebox(aEvent)) &&
      aEvent.button == 0) {
    //log('mousedown on button in tab');
    return;
  }

  //log('give focus to ', tab.id);
  browser.runtime.sendMessage({
    type:     kCOMMAND_SELECT_TAB,
    windowId: gTargetWindow,
    tab:      tab.id
  });
}

function onClick(aEvent) {
  //log('onClick', String(aEvent.target));
  if (isEventFiredOnNewTabButton(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    handleNewTabAction(aEvent, {
      action: configs.autoAttachOnNewTabCommand
    });
    return;
  }

  var tab = getTabFromEvent(aEvent);
  //log('clicked tab: ', tab);

  if (isEventFiredOnSoundButton(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    //log('clicked on sound button');
    browser.runtime.sendMessage({
      type:     kCOMMAND_SET_SUBTREE_MUTED,
      windowId: gTargetWindow,
      tab:      tab.id,
      muted:    maybeSoundPlaying(tab)
    });
    return;
  }

  if (isEventFiredOnClosebox(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    //log('clicked on closebox');
    //if (!warnAboutClosingTabSubtreeOf(tab)) {
    //  aEvent.stopPropagation();
    //  aEvent.preventDefault();
    //  return;
    //}
    browser.runtime.sendMessage({
      type:     kCOMMAND_REMOVE_TAB,
      windowId: gTargetWindow,
      tab:      tab.id
    });
    return;
  }
}

function handleNewTabAction(aEvent, aOptions = {}) {
  //log('handleNewTabAction');
  var parent, insertBefore, insertAfter;
  if (configs.autoAttach) {
    let current = getCurrentTab(gTargetWindow);
    switch (aOptions.action) {
      case kNEWTAB_DO_NOTHING:
      case kNEWTAB_OPEN_AS_ORPHAN:
      default:
        break;

      case kNEWTAB_OPEN_AS_CHILD: {
        parent = current;
        let refTabs = getReferenceTabsForNewChild(parent);
        insertBefore = refTabs.insertBefore;
        insertAfter  = refTabs.insertAfter;
        //log('detected reference tabs: ', dumpTab(parent), dumpTab(insertBefore), dumpTab(insertAfter));
      }; break;

      case kNEWTAB_OPEN_AS_SIBLING:
        parent = getParentTab(current);
        insertAfter = getLastDescendantTab(parent);
        break;

      case kNEWTAB_OPEN_AS_NEXT_SIBLING: {
        parent = getParentTab(current);
        insertBefore = getNextSiblingTab(current);
        insertAfter  = current;
      }; break;
    }
  }
  openNewTab({
    inBackground: aEvent.shiftKey,
    parent, insertBefore, insertAfter,
    inRemote: true
  });
}

function onDblClick(aEvent) {
  if (isEventFiredOnNewTabButton(aEvent) ||
      getTabFromEvent(aEvent))
    return;

  aEvent.stopPropagation();
  aEvent.preventDefault();
  handleNewTabAction(aEvent, {
    action: configs.autoAttachOnNewTabCommand
  });
}

function onTransisionEnd() {
  reserveToUpdateTabbarLayout();
}


/* raw event handlers */

function onTabBuilt(aTab) {
  var label = getTabLabel(aTab);

  var twisty = document.createElement('span');
  twisty.classList.add(kTWISTY);
  twisty.setAttribute('title', browser.i18n.getMessage('tab.twisty.collapsed.tooltip'));
  aTab.insertBefore(twisty, label);

  var favicon = document.createElement('span');
  favicon.classList.add(kFAVICON);
  var faviconImage = favicon.appendChild(document.createElement('img'));
  faviconImage.classList.add(kFAVICON_IMAGE);
  var defaultIcon = favicon.appendChild(document.createElement('span'));
  defaultIcon.classList.add(kFAVICON_DEFAULT);
  var throbber = favicon.appendChild(document.createElement('span'));
  throbber.classList.add(kTHROBBER);
  aTab.insertBefore(favicon, label);
  loadImageTo(faviconImage, aTab.apiTab.favIconUrl);

  var counter = document.createElement('span');
  counter.classList.add(kCOUNTER);
  aTab.appendChild(counter);

  var soundButton = document.createElement('button');
  soundButton.classList.add(kSOUND_BUTTON);
  aTab.appendChild(soundButton);

  var closebox = document.createElement('button');
  closebox.classList.add(kCLOSEBOX);
  closebox.setAttribute('title', browser.i18n.getMessage('tab.closebox.tab.tooltip'));
  aTab.appendChild(closebox);

  aTab.setAttribute('draggable', true);
}

function onTabFaviconUpdated(aTab, aURL) {
  let favicon = getTabFavicon(aTab);
  loadImageTo(favicon.firstChild, aURL);
}

async function loadImageTo(aImageElement, aURL) {
  aImageElement.src = '';
  aImageElement.classList.remove('error');
  aImageElement.classList.add('loading');
  if (!aURL) {
    aImageElement.classList.remove('loading');
    aImageElement.classList.add('error');
    return;
  }
  var onLoad = (() => {
    aImageElement.src = aURL;
    aImageElement.classList.remove('loading');
    clear();
  });
  var onError = ((aError) => {
    aImageElement.removeAttribute('src');
    aImageElement.classList.remove('loading');
    aImageElement.classList.add('error');
    clear();
  });
  var clear = (() => {
    loader.removeEventListener('load', onLoad, { once: true });
    loader.removeEventListener('error', onError, { once: true });
    loader = onLoad = onError = undefined;
  });
  var loader = new Image();
  loader.addEventListener('load', onLoad, { once: true });
  loader.addEventListener('error', onError, { once: true });
  try {
    loader.src = aURL;
  }
  catch(e) {
    onError(e);
  }
}

function onTabFocused(aTab) {
  scrollToTab(aTab);
}

function onTabOpening(aTab) {
  if (configs.animation)
    onTabCollapsedStateChanging(aTab, {
      collapsed: true,
      justNow:   true
    });
}

function onTabOpened(aTab) {
  if (configs.animation) {
    window.requestAnimationFrame(() => {
      if (!aTab.parentNode) // it was removed while waiting
        return;
      aTab.classList.add(kTAB_STATE_ANIMATION_READY);
      onTabCollapsedStateChanging(aTab, {
        collapsed: false,
        justNow:   gRestoringTree,
        anchor:    getCurrentTab(),
        last:      true
      });
    });
  }
  else {
    aTab.classList.add(kTAB_STATE_ANIMATION_READY);
    scrollToNewTab(aTab);
  }

  reserveToUpdateTabbarLayout(configs.collapseDuration);
}

function onTabClosed(aTab) {
  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  detachTab(aTab, {
    dontUpdateIndent: true
  });
  reserveToUpdateTabbarLayout(configs.collapseDuration);
}

async function onTabCompletelyClosed(aTab) {
  if (!configs.animation)
    return;

  return new Promise((aResolve, aReject) => {
    aTab.onEndRemoveAnimation = (() => {
      delete aTab.onEndRemoveAnimation;
      aResolve();
    });
    aTab.addEventListener('transitionend', aTab.onEndRemoveAnimation, { once: true });
    let tabRect = aTab.getBoundingClientRect();
    aTab.style.marginLeft = `${tabRect.width}px`;
    let backupTimer = setTimeout(() => {
      if (!aTab || !aTab.onEndRemoveAnimation ||
          !aTab.parentNode) // it was removed while waiting
        return;
      backupTimer = null
      aTab.removeEventListener('transitionend', aTab.onEndRemoveAnimation, { once: true });
      aTab.onEndRemoveAnimation();
    }, configs.collapseDuration);
  });
}

function onTabMoving(aTab) {
  if (configs.animation &&
      !isCollapsed(aTab) &&
      !isPinned(aTab)) {
    onTabCollapsedStateChanging(aTab, {
      collapsed: true,
      justNow:   true
    });
    window.requestAnimationFrame(() => {
      if (!aTab.parentNode) // it was removed while waiting
        return;
      onTabCollapsedStateChanging(aTab, {
        collapsed: false
      });
    });
  }
}

function onTabMoved(aTab) {
  reserveToUpdateTabbarLayout(configs.collapseDuration);
}

function onTabLevelChanged(aTab) {
  reserveToUpdateIndent();
}

function onTabDetachedFromWindow(aTab) {
  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  detachTab(aTab, {
    dontUpdateIndent: true
  });
}

function onTabSubtreeCollapsedStateChanging(aTab, aInfo = {}) {
  updateTabTwisty(aTab);
  updateTabClosebox(aTab);
}

function onTabCollapsedStateChanging(aTab, aInfo = {}) {
  var toBeCollapsed = aInfo.collapsed;

  //log('updateTabCollapsed ', dumpTab(aTab));
  if (!aTab.parentNode) // do nothing for closed tab!
    return;

  if (configs.indentAutoShrink &&
      configs.indentAutoShrinkOnlyForVisible)
    reserveToUpdateIndent();

  if (aTab.onEndCollapseExpandAnimation) {
    aTab.removeEventListener('transitionend', aTab.onEndCollapseExpandAnimation, { once: true });
    delete aTab.onEndCollapseExpandAnimation;
  }

  if (!configs.animation ||
      aInfo.justNow ||
      configs.collapseDuration < 1) {
    //log('=> skip animation');
    if (toBeCollapsed)
      aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
    else
      aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);

    if (aInfo.last)
      scrollToTab(aTab, { anchor: aInfo.anchor });
    return;
  }

  if (toBeCollapsed) {
    aTab.classList.add(kTAB_STATE_COLLAPSING);
  }
  else {
    aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);
    aTab.classList.add(kTAB_STATE_EXPANDING);
  }

  window.requestAnimationFrame(() => {
    if (!aTab.parentNode) // it was removed while waiting
      return;

    //log('start animation for ', dumpTab(aTab));
    if (aInfo.last)
      scrollToTab(aTab, { anchor: aInfo.anchor });

    aTab.onEndCollapseExpandAnimation = (() => {
      delete aTab.onEndCollapseExpandAnimation;
      if (backupTimer)
        clearTimeout(backupTimer);
      //log('=> finish animation for ', dumpTab(aTab));
      aTab.classList.remove(kTAB_STATE_COLLAPSING);
      aTab.classList.remove(kTAB_STATE_EXPANDING);
      if (toBeCollapsed)
        aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);

      reserveToUpdateTabbarLayout(configs.collapseDuration);
    });
    aTab.addEventListener('transitionend', aTab.onEndCollapseExpandAnimation, { once: true });
    var backupTimer = setTimeout(() => {
      if (!aTab || !aTab.onEndCollapseExpandAnimation ||
          !aTab.parentNode) // it was removed while waiting
        return;
      backupTimer = null
      aTab.removeEventListener('transitionend', aTab.onEndCollapseExpandAnimation, { once: true });
      aTab.onEndCollapseExpandAnimation();
    }, configs.collapseDuration);
  });
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
          setTimeout(() => {
            if (!aTab.parentNode) // it was removed while waiting
              return;
            aTab.checkTabsIndentOverflowOnMouseLeave(aEvent, true);
          }, 0);
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

function onTabAttached(aTab) {
  updateTabTwisty(aTab);
  updateTabClosebox(aTab);
  var ancestors = [aTab].concat(getAncestorTabs(aTab));
  for (let ancestor of ancestors) {
    updateTabsCount(ancestor);
  }
}

function onTabDetached(aTab, aDetachInfo = {}) {
  var parent = aDetachInfo.oldParentTab;
  if (!parent)
    return;
  updateTabTwisty(parent);
  updateTabClosebox(parent);
  var ancestors = [parent].concat(getAncestorTabs(parent));
  for (let ancestor of ancestors) {
    updateTabsCount(ancestor);
  }
}

function onTabPinned(aTab) {
  reserveToPositionPinnedTabs();
}

function onTabUnpinned(aTab) {
  clearPinnedStyle(aTab);
  scrollToTab(aTab);
  //updateInvertedTabContentsOrder(aTab);
  reserveToPositionPinnedTabs();
}


/* message observer */

function onMessage(aMessage, aSender, aRespond) {
  if (!aMessage ||
      typeof aMessage.type != 'string' ||
      aMessage.type.indexOf('treestyletab:') != 0)
    return;

  if ([
       kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE
      ].indexOf(aMessage.type) > -1) {
    handleInternalMessage(aMessage, aSender).then(aRespond);
    return true;
  }
  else
    handleInternalMessage(aMessage, aSender);
}

async function handleInternalMessage(aMessage, aSender) {
  var timeout = setTimeout(() => {
    log('onMessage: timeout! ', aMessage, aSender);
  }, 10 * 1000);

  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE:
      if (aMessage.windowId == gTargetWindow) {
        let tab = getTabById(aMessage.tab);
        if (!tab) {
          clearTimeout(timeout);
          return;
        }
        let params = {
          collapsed: aMessage.collapsed,
          justNow:   aMessage.justNow
        };
        if (aMessage.manualOperation)
          manualCollapseExpandSubtree(tab, params);
        else
          collapseExpandSubtree(tab, params);
      }
      break;

    case kCOMMAND_ATTACH_TAB_TO: {
      if (aMessage.windowId == gTargetWindow) {
        log('attach tab from remote ', aMessage);
        let child = getTabById(aMessage.child);
        let parent = getTabById(aMessage.parent);
        if (child && parent)
          attachTabTo(child, parent, clone(aMessage, {
            insertBefore: getTabById(aMessage.insertBefore),
            insertAfter: getTabById(aMessage.insertAfter),
            inRemote: false,
            broadcast: false
          }));
      }
    }; break;

    case kCOMMAND_DETACH_TAB: {
      if (aMessage.windowId == gTargetWindow) {
        let tab = getTabById(aMessage.tab);
        if (tab)
          detachTab(tab);
      }
    }; break;

    case kCOMMAND_BLOCK_USER_OPERATIONS: {
      if (aMessage.windowId == gTargetWindow)
        blockUserOperationsIn(gTargetWindow);
    }; break;

    case kCOMMAND_UNBLOCK_USER_OPERATIONS: {
      if (aMessage.windowId == gTargetWindow)
        unblockUserOperationsIn(gTargetWindow);
    }; break;

    case kCOMMAND_BROADCAST_TAB_STATE: {
      let tab = getTabById(aMessage.tab);
      if (tab) {
        let add = aMessage.add || [];
        let remove = aMessage.remove || [];
        log('apply broadcasted tab state ', tab.id, {
          add:    add.join(','),
          remove: remove.join(',')
        });
        add.forEach(aState => tab.classList.add(aState));
        remove.forEach(aState => tab.classList.remove(aState));
        if (aMessage.bubbles)
          updateParentTab(getParentTab(tab));
      }
    }; break;
  }
  clearTimeout(timeout);
}

function onConfigChange(aChangedKey) {
  switch (aChangedKey) {
    case 'debug': {
      for (let tab of getAllTabs()) {
        updateTab(tab, tab.apiTab);
      }
      if (configs.debug)
        document.documentElement.classList.add('debug');
      else
        document.documentElement.classList.remove('debug');
    }; break;

    case 'animation':
      if (configs.animation)
        document.documentElement.classList.add('animation');
      else
        document.documentElement.classList.remove('animation');
      break;

    case 'style':
    case 'defaultStyle':
    case 'defaultStyleDarwin':
    case 'defaultStyleLinux': {
      if (getChosenStyle() != gStyle)
        location.reload();
    }; break;
  }
}
