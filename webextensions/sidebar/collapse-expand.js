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

import {
  log,
  dumpTab,
  nextFrame,
  configs
} from '../common/common.js';
import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import EventListenerManager from '../common/EventListenerManager.js';

import * as Sidebar from './sidebar.js';
import * as SidebarCache from './sidebar-cache.js';
import * as Scroll from './scroll.js';
import * as Indent from './indent.js';


const gUpdatingCollapsedStateCancellers = new WeakMap();
const gTabCollapsedStateChangedManagers = new WeakMap();

Tabs.onCollapsedStateChanging.addListener(async (aTab, aInfo = {}) => {
  const toBeCollapsed = aInfo.collapsed;

  if (configs.logOnCollapseExpand)
    log('Tabs.onCollapsedStateChanging ', dumpTab(aTab), aInfo);
  if (!Tabs.ensureLivingTab(aTab)) // do nothing for closed tab!
    return;

  SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

  if (aTab.onEndCollapseExpandAnimation) {
    clearTimeout(aTab.onEndCollapseExpandAnimation.timeout);
    delete aTab.onEndCollapseExpandAnimation;
  }

  if (aTab.apiTab.status == 'loading')
    aTab.classList.add(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  if (aInfo.anchor && !Scroll.isTabInViewport(aInfo.anchor))
    aInfo.anchor = null;

  const reason = toBeCollapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;

  let manager = gTabCollapsedStateChangedManagers.get(aTab);
  if (!manager) {
    manager = new EventListenerManager();
    gTabCollapsedStateChangedManagers.set(aTab, manager);
  }

  if (gUpdatingCollapsedStateCancellers.has(aTab)) {
    gUpdatingCollapsedStateCancellers.get(aTab)();
    gUpdatingCollapsedStateCancellers.delete(aTab);
    aTab.classList.remove(Constants.kTAB_STATE_COLLAPSING);
    aTab.classList.remove(Constants.kTAB_STATE_EXPANDING);
    manager.removeAllListeners();
  }

  let cancelled = false;
  const canceller = () => {
    cancelled = true;
  };
  const onCompleted = (aTab, aInfo = {}) => {
    manager.removeListener(onCompleted);
    if (cancelled ||
        !Tabs.ensureLivingTab(aTab)) // do nothing for closed tab!
      return;

    gUpdatingCollapsedStateCancellers.delete(aTab);

    const toBeCollapsed = aInfo.collapsed;
    SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

    if (configs.animation &&
        !aInfo.justNow &&
        configs.collapseDuration > 0)
      return; // animation

    //log('=> skip animation');
    if (toBeCollapsed)
      aTab.classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
    else
      aTab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);

    const reason = toBeCollapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;
    onEndCollapseExpandCompletely(aTab, {
      collapsed: toBeCollapsed,
      reason
    });

    if (aInfo.last)
      Scroll.scrollToTab(aTab, {
        anchor:            aInfo.anchor,
        notifyOnOutOfView: true
      });
  };
  manager.addListener(onCompleted);

  if (!configs.animation ||
      aInfo.justNow ||
      configs.collapseDuration < 1) {
    //log('=> skip animation');
    return;
  }

  gUpdatingCollapsedStateCancellers.set(aTab, canceller);

  if (toBeCollapsed) {
    aTab.classList.add(Constants.kTAB_STATE_COLLAPSING);
  }
  else {
    aTab.classList.add(Constants.kTAB_STATE_EXPANDING);
    aTab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);
  }

  Sidebar.reserveToUpdateTabbarLayout({ reason });

  nextFrame().then(() => {
    if (cancelled ||
        !Tabs.ensureLivingTab(aTab)) { // it was removed while waiting
      return;
    }

    //log('start animation for ', dumpTab(aTab));
    if (aInfo.last)
      Scroll.scrollToTab(aTab, {
        anchor:            aInfo.anchor,
        notifyOnOutOfView: true
      });

    aTab.onEndCollapseExpandAnimation = (() => {
      if (cancelled)
        return;

      //log('=> finish animation for ', dumpTab(aTab));
      aTab.classList.remove(Constants.kTAB_STATE_COLLAPSING);
      aTab.classList.remove(Constants.kTAB_STATE_EXPANDING);

      // The collapsed state of the tab can be changed by different trigger,
      // so we must respect the actual status of the tab, instead of the
      // "expected status" given via arguments.
      if (aTab.classList.contains(Constants.kTAB_STATE_COLLAPSED))
        aTab.classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
      else
        aTab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);

      onEndCollapseExpandCompletely(aTab, {
        collapsed: toBeCollapsed,
        reason
      });
    });
    aTab.onEndCollapseExpandAnimation.timeout = setTimeout(() => {
      if (cancelled ||
          !Tabs.ensureLivingTab(aTab) ||
          !aTab.onEndCollapseExpandAnimation) {
        return;
      }
      delete aTab.onEndCollapseExpandAnimation.timeout;
      aTab.onEndCollapseExpandAnimation();
      delete aTab.onEndCollapseExpandAnimation;
    }, configs.collapseDuration);
  });
});
function onEndCollapseExpandCompletely(aTab, aOptions = {}) {
  if (Tabs.isActive(aTab) && !aOptions.collapsed)
    Scroll.scrollToTab(aTab);

  if (configs.indentAutoShrink &&
      configs.indentAutoShrinkOnlyForVisible)
    Indent.reserveToUpdateVisualMaxTreeLevel();

  // this is very required for no animation case!
  Sidebar.reserveToUpdateTabbarLayout({ reason: aOptions.reason });
  SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

Tabs.onCollapsedStateChanged.addListener((aTab, aInfo = {}) => {
  const manager = gTabCollapsedStateChangedManagers.get(aTab);
  if (manager)
    manager.dispatch(aTab, aInfo);
});

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
        let node = EventUtils.getElementTarget(aEvent);
        if (node.closest(`#${id}`))
            stillOver = true;
          return;
        }
        else if (!aDelayed) {
          if (stillOver) {
            stillOver = false;
          }
          setTimeout(() => {
            if (!Tabs.ensureLivingTab(aTab)) // it was removed while waiting
              return;
            aTab.checkTabsIndentOverflowOnMouseLeave(aEvent, true);
          }, 0);
          return;
        } else if (stillOver) {
          return;
        }
        let x = aEvent.clientX;
        let y = aEvent.clientY;
        let rect = aTab.getBoundingClientRect();
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
