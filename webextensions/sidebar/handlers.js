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

function isEventFiredOnContextualIdentitySelector(aEvent) {
  return evaluateXPath(
      `ancestor-or-self::*[${hasClass(kCONTEXTUAL_IDENTITY_SELECTOR)}]`,
      aEvent.originalTarget || aEvent.target,
      XPathResult.BOOLEAN_TYPE
    ).booleanValue;
}

function isEventFiredOnClickable(aEvent) {
  return evaluateXPath(
      'ancestor-or-self::*[contains(" button scrollbar select ", concat(" ", local-name(), " "))]',
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

function getClickedOptionFromEvent(aEvent) {
  return evaluateXPath(
      'ancestor-or-self::*[contains(" option ", concat(" ", local-name(), " "))]',
      aEvent.originalTarget || aEvent.target,
      XPathResult.FIRST_ORDERED_NODE_TYPE
    ).singleNodeValue;
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

var gLastMousedown = null;
var gLastMousedownIsMiddleClick = false;

function onMouseDown(aEvent) {
  cancelHandleMousedown();
  tabContextMenu.close();

  var tab = getTabFromEvent(aEvent);

  gLastMousedownIsMiddleClick = isMiddleClick(aEvent);
  if (gLastMousedownIsMiddleClick) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    return;
  }

  tab = tab || getTabFromTabbarEvent(aEvent);
  //log('found target tab: ', tab);
  if (!tab) {
    if (aEvent.button == 2) {
      tabContextMenu.open({
        left: aEvent.clientX,
        top:  aEvent.clientY
      });
      aEvent.stopPropagation();
      aEvent.preventDefault();
      return;
    }
    sendTSTAPIMessage({
      type:     kTSTAPI_NOTIFY_TABBAR_CLICKED,
      window:   gTargetWindow,
      button:   aEvent.button,
      ctrlKey:  aEvent.ctrlKey,
      shiftKey: aEvent.shiftKey,
      altKey:   aEvent.altKey,
      metaKey:  aEvent.metaKey
    });
    return;
  }

  if (aEvent.button == 0 &&
      isEventFiredOnTwisty(aEvent)) {
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

  var mousedownDetail = {
    tab:      tab.id,
    button:   aEvent.button,
    ctrlKey:  aEvent.ctrlKey,
    shiftKey: aEvent.shiftKey,
    altKey:   aEvent.altKey,
    metaKey:  aEvent.metaKey
  };

  if ((isEventFiredOnSoundButton(aEvent) ||
       isEventFiredOnClosebox(aEvent)) &&
      aEvent.button == 0) {
    //log('mousedown on button in tab');
    mousedownDetail.closebox = isEventFiredOnClosebox(aEvent);
    gLastMousedown = {
      detail: mousedownDetail
    };
    gLastMousedown.timeout = setTimeout(() => {
      if (!gLastMousedown)
        return;
      gLastMousedown.expired = true;
      notifyTSTAPIDragReady(tab, gLastMousedown.detail.closebox);
    }, configs.startDragTimeout);
    return;
  }

  if (aEvent.button == 2) {
    tabContextMenu.open({
      tab:  tab.apiTab,
      left: aEvent.clientX,
      top:  aEvent.clientY
    });
    aEvent.stopPropagation();
    aEvent.preventDefault();
    return;
  }

  gLastMousedown = {
    detail: mousedownDetail,
    fire: () => {
      //log('give focus to ', tab.id);
      browser.runtime.sendMessage(clone(gLastMousedown.detail, {
        type:     kNOTIFY_TAB_MOUSEDOWN,
        windowId: gTargetWindow
      }));
      gLastMousedown.expired = true;
    }
  };
  gLastMousedown.timeout = setTimeout(() => {
    if (!gLastMousedown)
      return;
    gLastMousedown.fire();
    notifyTSTAPIDragReady(tab, gLastMousedown.detail.closebox);
  }, configs.startDragTimeout);
}

function notifyTSTAPIDragReady(aTab, aIsClosebox) {
  sendTSTAPIMessage({
    type:   kTSTAPI_NOTIFY_TAB_DRAGREADY,
    tab:    serializeTabForTSTAPI(aTab),
    window: gTargetWindow,
    startOnClosebox: aIsClosebox
  });
}

function cancelHandleMousedown() {
  if (gLastMousedown) {
    clearTimeout(gLastMousedown.timeout);
    gLastMousedown = null;
    return true;
  }
  return false;
}

function onMouseUp(aEvent) {
  if (gLastMousedown) {
    if (!gLastMousedown.expired &&
        gLastMousedown.fire)
      gLastMousedown.fire();

    cancelHandleMousedown();
  }

  if (gCapturingMouseEvents) {
    gCapturingMouseEvents = false;
    window.removeEventListener('mouseover', onTSTAPIDragEnter, { capture: true });
    window.removeEventListener('mouseout',  onTSTAPIDragExit, { capture: true });
    document.releaseCapture();

    let tab = getTabFromEvent(aEvent);
    sendTSTAPIMessage({
      type:    kTSTAPI_NOTIFY_TAB_DRAGEND,
      tab:     tab && serializeTabForTSTAPI(tab),
      window:  gTargetWindow,
      clientX: aEvent.clientX,
      clientY: aEvent.clientY
    });

    gLastDragEnteredTab = null;
    gLastDragEnteredTarget = null;
  }

  if (gLastMousedownIsMiddleClick) {
    let tab = getTabFromEvent(aEvent);
    if (tab/* && warnAboutClosingTabSubtreeOf(tab)*/) {
      //log('middle-click to close');
      browser.runtime.sendMessage({
        type:     kCOMMAND_REMOVE_TAB,
        windowId: gTargetWindow,
        tab:      tab.id
      });
    }
    else if (isEventFiredOnNewTabButton(aEvent)) {
      handleNewTabAction(aEvent, {
        action: configs.autoAttachOnNewTabButtonMiddleClick
      });
    }
    else if (isEventFiredOnContextualIdentitySelector(aEvent)) {
      let option = getClickedOptionFromEvent(aEvent);
      if (option) {
        handleNewTabAction(aEvent, {
          action: configs.autoAttachOnNewTabButtonMiddleClick,
          cookieStoreId: option.getAttribute('value')
        });
      }
      else { // treat as middle click on new tab button
        handleNewTabAction(aEvent, {
          action: configs.autoAttachOnNewTabButtonMiddleClick
        });
      }
    }
    else { // on blank area
      handleNewTabAction(aEvent, {
        action: configs.autoAttachOnNewTabCommand
      });
    }
  }
}

function onClick(aEvent) {
  if (aEvent.button == 2) // ignore right click
    return;

  //log('onClick', String(aEvent.target));

  if (isEventFiredOnContextualIdentitySelector(aEvent))
    return;

  if (aEvent.button == 0 &&
      isEventFiredOnNewTabButton(aEvent)) {
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
    cookieStoreId: aOptions.cookieStoreId,
    inRemote: true
  });
}

function onDblClick(aEvent) {
  if (isEventFiredOnNewTabButton(aEvent))
    return;

  var tab = getTabFromEvent(aEvent);
  if (tab) {
    if (configs.collapseExpandSubtreeByDblClick) {
      aEvent.stopPropagation();
      aEvent.preventDefault();
      collapseExpandSubtree(tab, {
        collapsed:       !isSubtreeCollapsed(tab),
        manualOperation: true,
        inRemote:        true
      });
    }
    return;
  }

  aEvent.stopPropagation();
  aEvent.preventDefault();
  handleNewTabAction(aEvent, {
    action: configs.autoAttachOnNewTabCommand
  });
}

function onTransisionEnd() {
  reserveToUpdateTabbarLayout();
}

function onChange(aEvent) {
  var selector = aEvent.target;

  handleNewTabAction(aEvent, {
    cookieStoreId: selector.value
  });

  selector.value = '';
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
  loadImageTo(faviconImage, aTab.apiTab.favIconUrl, aTab.apiTab);

  var counter = document.createElement('span');
  counter.classList.add(kCOUNTER);
  aTab.appendChild(counter);

  var soundButton = document.createElement('button');
  soundButton.classList.add(kSOUND_BUTTON);
  aTab.appendChild(soundButton);

  var closebox = document.createElement('span');
  closebox.classList.add(kCLOSEBOX);
  closebox.setAttribute('title', browser.i18n.getMessage('tab.closebox.tab.tooltip'));
  closebox.setAttribute('draggable', true); // this is required to cancel click by dragging
  aTab.appendChild(closebox);

  var identityMarker = document.createElement('span');
  identityMarker.classList.add(kCONTEXTUAL_IDENTITY_MARKER);
  aTab.appendChild(identityMarker);

  var extraItemsContainerBehind = document.createElement('span');
  extraItemsContainerBehind.classList.add(kEXTRA_ITEMS_CONTAINER);
  extraItemsContainerBehind.classList.add('behind');
  aTab.appendChild(extraItemsContainerBehind);

  aTab.setAttribute('draggable', true);
}

var gEffectiveFavicons = new Map();

function onTabFaviconUpdated(aTab, aURL) {
  let favicon = getTabFavicon(aTab);
  loadImageTo(favicon.firstChild, aURL, aTab.apiTab);
}

async function loadImageTo(aImageElement, aURL, aApiTab) {
  var loader;
  var onLoad = (() => {
    var oldData = gEffectiveFavicons.get(aApiTab.id);
    if (!oldData ||
        oldData.url != aApiTab.url ||
        oldData.favIconUrl != aURL) {
      let lastEffectiveFavicon = {
        url:        aApiTab.url,
        favIconUrl: aURL
      };
      gEffectiveFavicons.set(aApiTab.id, lastEffectiveFavicon);
      browser.sessions.setTabValue(aApiTab.id, kLAST_EFFECTIVE_FAVICON, lastEffectiveFavicon);
    }
    aImageElement.src = aURL;
    aImageElement.classList.remove('loading');
    clear();
  });
  var onError = (async (aError) => {
    clear();
    let effectiveFaviconData = gEffectiveFavicons.get(aApiTab.id) ||
                               await browser.sessions.getTabValue(aApiTab.id, kLAST_EFFECTIVE_FAVICON);
    if (effectiveFaviconData &&
        effectiveFaviconData.url == aApiTab.url) {
      if (aApiTab.favIconUrl != aImageElement.src)
        loadImageTo(aImageElement, effectiveFaviconData.favIconUrl, aApiTab);
    }
    else {
      aImageElement.removeAttribute('src');
      aImageElement.classList.remove('loading');
      aImageElement.classList.add('error');
    }
  });
  var clear = (() => {
    if (loader) {
      loader.removeEventListener('load', onLoad, { once: true });
      loader.removeEventListener('error', onError, { once: true });
    }
    loader = onLoad = onError = undefined;
  });
  if (!aURL ||
      !kVALID_FAVICON_PATTERN.test(aURL)) {
    onError();
    return;
  }
  aImageElement.src = '';
  aImageElement.classList.remove('error');
  aImageElement.classList.add('loading');
  loader = new Image();
  loader.addEventListener('load', onLoad, { once: true });
  loader.addEventListener('error', onError, { once: true });
  try {
    loader.src = aURL;
  }
  catch(e) {
    onError(e);
  }
}

function onTabUpdated(aTab) {
  updateTabSoundButtonTooltip(aTab);
  reserveToSynchronizeThrobberAnimations();
}

function onTabLabelUpdated(aTab) {
  reserveToUpdateTabTooltip(aTab);
}

function onParentTabUpdated(aTab) {
  updateTabSoundButtonTooltip(aTab);
}

function updateTabSoundButtonTooltip(aTab) {
  var tooltip = '';
  if (maybeMuted(aTab))
    tooltip = browser.i18n.getMessage('tab.soundButton.muted.tooltip');
  else if (maybeSoundPlaying(aTab))
    tooltip = browser.i18n.getMessage('tab.soundButton.playing.tooltip');

  getTabSoundButton(aTab).setAttribute('title', tooltip);
}

function onTabFocused(aTab) {
  tabContextMenu.close();
  scrollToTab(aTab);
}

function onTabOpening(aTab, aInfo = {}) {
  tabContextMenu.close();
  if (configs.animation) {
    collapseExpandTab(aTab, {
      collapsed: true,
      justNow:   true
    });
  }
}

function onTabOpened(aTab, aInfo = {}) {
  if (configs.animation) {
    aTab.classList.add(kTAB_STATE_ANIMATION_READY);
    nextFrame().then(async () => {
      var parent = getParentTab(aTab);
      if (parent && isSubtreeCollapsed(parent)) // possibly collapsed by other trigger intentionally
        return;
      var focused = isActive(aTab);
      collapseExpandTab(aTab, {
        collapsed: false,
        justNow:   gRestoringTree,
        anchor:    focused && getCurrentTab(),
        last:      focused
      });
      if (!focused)
        notifyOutOfViewTab(aTab);
    });
  }
  else {
    aTab.classList.add(kTAB_STATE_ANIMATION_READY);
    if (isActive(aTab))
      scrollToNewTab(aTab);
    else
      notifyOutOfViewTab(aTab);
  }

  reserveToUpdateTabbarLayout(configs.collapseDuration);
  reserveToSynchronizeThrobberAnimations();
}

function onTabClosed(aTab) {
  gEffectiveFavicons.delete(aTab.apiTab.id);
  tabContextMenu.close();
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
    let tabRect = aTab.getBoundingClientRect();
    aTab.style.marginLeft = `${tabRect.width}px`;
    setTimeout(() => {
      if (!aTab || !aTab.parentNode) // it was removed while waiting
        return;
      aResolve();
    }, configs.collapseDuration);
  });
}

function onTabMoving(aTab) {
  tabContextMenu.close();
  if (configs.animation &&
      !isCollapsed(aTab) &&
      !isPinned(aTab)) {
    collapseExpandTab(aTab, {
      collapsed: true,
      justNow:   true
    });
    nextFrame().then(() => {
      if (!aTab.parentNode) // it was removed while waiting
        return;
      collapseExpandTab(aTab, {
        collapsed: false
      });
    });
  }
}

function onTabMoved(aTab) {
  reserveToUpdateTabbarLayout(configs.collapseDuration);
  reserveToUpdateTabTooltip(getParentTab(aTab));
  reserveToSynchronizeThrobberAnimations();
}

function onTabLevelChanged(aTab) {
  reserveToUpdateIndent();
}

function onTabDetachedFromWindow(aTab) {
  reserveToUpdateTabTooltip(getParentTab(aTab));
  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  detachTab(aTab, {
    dontUpdateIndent: true
  });
}

function onTabSubtreeCollapsedStateChanging(aTab, aInfo = {}) {
  updateTabTwisty(aTab);
  updateTabClosebox(aTab);
  reserveToUpdateTabTooltip(aTab);
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
    clearTimeout(aTab.onEndCollapseExpandAnimation.timeout);
    delete aTab.onEndCollapseExpandAnimation;
  }

  if (!toBeCollapsed)
    reserveToSynchronizeThrobberAnimations();

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

  nextFrame().then(() => {
    if (!aTab.parentNode) // it was removed while waiting
      return;

    //log('start animation for ', dumpTab(aTab));
    if (aInfo.last)
      scrollToTab(aTab, { anchor: aInfo.anchor });

    aTab.onEndCollapseExpandAnimation = (() => {
      //log('=> finish animation for ', dumpTab(aTab));
      aTab.classList.remove(kTAB_STATE_COLLAPSING);
      aTab.classList.remove(kTAB_STATE_EXPANDING);

      // The collapsed state of the tab can be changed by different trigger,
      // so we must respect the actual status of the tab, instead of the
      // "expected status" given via arguments.
      if (aTab.classList.contains(kTAB_STATE_COLLAPSED))
        aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
      else
        aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);

      reserveToUpdateTabbarLayout(configs.collapseDuration);
    });
    aTab.onEndCollapseExpandAnimation.timeout = setTimeout(() => {
      if (!aTab || !aTab.onEndCollapseExpandAnimation ||
          !aTab.parentNode) // it was removed while waiting
        return;
      delete aTab.onEndCollapseExpandAnimation.timeout;
      aTab.onEndCollapseExpandAnimation();
      delete aTab.onEndCollapseExpandAnimation;
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
  tabContextMenu.close();
  updateTabTwisty(aTab);
  updateTabClosebox(aTab);
  reserveToUpdateTabTooltip(aTab);
  var ancestors = [aTab].concat(getAncestorTabs(aTab));
  for (let ancestor of ancestors) {
    updateTabsCount(ancestor);
  }
  if (isActive(getParentTab(aTab)))
    scrollToNewTab(aTab);
}

function onTabDetached(aTab, aDetachInfo = {}) {
  gEffectiveFavicons.delete(aTab.apiTab.id);
  tabContextMenu.close();
  var parent = aDetachInfo.oldParentTab;
  if (!parent)
    return;
  updateTabTwisty(parent);
  updateTabClosebox(parent);
  reserveToUpdateTabTooltip(parent);
  var ancestors = [parent].concat(getAncestorTabs(parent));
  for (let ancestor of ancestors) {
    updateTabsCount(ancestor);
  }
}

function onTabPinned(aTab) {
  tabContextMenu.close();
  reserveToPositionPinnedTabs();
}

function onTabUnpinned(aTab) {
  tabContextMenu.close();
  clearPinnedStyle(aTab);
  scrollToTab(aTab);
  //updateInvertedTabContentsOrder(aTab);
  reserveToPositionPinnedTabs();
}


function onContextualIdentitiesUpdated() {
  updateContextualIdentitiesStyle();
  updateContextualIdentitiesSelector();
}


/* message observer */

function onMessage(aMessage, aSender, aRespond) {
  if (!aMessage ||
      typeof aMessage.type != 'string' ||
      aMessage.type.indexOf('treestyletab:') != 0)
    return;

  var timeout = setTimeout(() => {
    log('onMessage: timeout! ', aMessage, aSender);
  }, 10 * 1000);

  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_PING_TO_SIDEBAR: {
      clearTimeout(timeout);
      if (aMessage.windowId == gTargetWindow)
        return Promise.resolve(true);
    }; break;

    // workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1398272
    case kCOMMAND_BROADCAST_TAB_ID_TABLES_UPDATE:
      delete gTabIdWrongToCorrect[aMessage.oldWrongId];
      gTabIdWrongToCorrect[aMessage.newWrongId] = aMessage.newCorrectId;
      gTabIdCorrectToWrong[aMessage.newCorrectId] = aMessage.newWrongId;
      break;

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
        blockUserOperationsIn(gTargetWindow, aMessage);
    }; break;

    case kCOMMAND_UNBLOCK_USER_OPERATIONS: {
      if (aMessage.windowId == gTargetWindow)
        unblockUserOperationsIn(gTargetWindow, aMessage);
    }; break;

    case kCOMMAND_BROADCAST_TAB_STATE: {
      if (!aMessage.tabs.length)
        break;
      let add = aMessage.add || [];
      let remove = aMessage.remove || [];
      log('apply broadcasted tab state ', aMessage.tabs, {
        add:    add.join(','),
        remove: remove.join(',')
      });
      let modified = add.concat(remove);
      for (let tab of aMessage.tabs) {
        tab = getTabById(tab);
        if (!tab)
          continue;
        add.forEach(aState => tab.classList.add(aState));
        remove.forEach(aState => tab.classList.remove(aState));
        if (modified.indexOf(kTAB_STATE_AUDIBLE) > -1 ||
            modified.indexOf(kTAB_STATE_SOUND_PLAYING) > -1 ||
            modified.indexOf(kTAB_STATE_MUTED) > -1) {
          updateTabSoundButtonTooltip(tab);
          if (aMessage.bubbles)
            updateParentTab(getParentTab(tab));
        }
      }
    }; break;
  }
  clearTimeout(timeout);
}

function onMessageExternal(aMessage, aSender) {
  switch (aMessage.type) {
    case kTSTAPI_REGISTER_SELF: {
      if (aMessage.style)
        installStyleForAddon(aSender.id, aMessage.style)
    }; break;

    case kTSTAPI_UNREGISTER_SELF: {
      uninstallStyleForAddon(aSender.id)
    }; break;
  }
}

function onConfigChange(aChangedKey) {
  var rootClasses = document.documentElement.classList;
  switch (aChangedKey) {
    case 'debug': {
      for (let tab of getAllTabs()) {
        updateTab(tab, tab.apiTab, { forceApply: true });
      }
      if (configs.debug)
        rootClasses.add('debug');
      else
        rootClasses.remove('debug');
    }; break;

    case 'animation':
      if (configs.animation)
        rootClasses.add('animation');
      else
        rootClasses.remove('animation');
      break;

    case 'sidebarPosition':
      if (configs.sidebarPosition == kTABBAR_POSITION_RIGHT) {
        rootClasses.add('right');
        rootClasses.remove('left');
        gIndentProp = 'margin-right';
      }
      else {
        rootClasses.add('left');
        rootClasses.remove('right');
        gIndentProp = 'margin-left';
      }
      updateIndent({ force: true });
      break;

    case 'style':
    case 'defaultStyle':
    case 'defaultStyleDarwin':
    case 'defaultStyleLinux': {
      if (getChosenStyle() != gStyle)
        location.reload();
    }; break;

    case 'faviconizePinnedTabs':
      reserveToPositionPinnedTabs();
      break;

    case 'userStyleRules':
      applyUserStyleRules()
      break;
  }
}
