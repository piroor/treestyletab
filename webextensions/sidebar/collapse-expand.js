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
  log as internalLogger,
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

function log(...args) {
  if (configs.logFor['sidebar/collapse-expand'] || configs.logOnCollapseExpand)
    internalLogger(...args);
}


const mUpdatingCollapsedStateCancellers = new WeakMap();
const mTabCollapsedStateChangedManagers = new WeakMap();

Tabs.onCollapsedStateChanging.addListener((tab, info = {}) => {
  const toBeCollapsed = info.collapsed;

  log('Tabs.onCollapsedStateChanging ', dumpTab(tab), info);
  if (!Tabs.ensureLivingTab(tab)) // do nothing for closed tab!
    return;

  SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

  if (tab.onEndCollapseExpandAnimation) {
    clearTimeout(tab.onEndCollapseExpandAnimation.timeout);
    delete tab.onEndCollapseExpandAnimation;
  }

  if (tab.apiTab.status == 'loading')
    tab.classList.add(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  if (info.anchor && !Scroll.isTabInViewport(info.anchor))
    info.anchor = null;

  const reason = toBeCollapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;

  let manager = mTabCollapsedStateChangedManagers.get(tab);
  if (!manager) {
    manager = new EventListenerManager();
    mTabCollapsedStateChangedManagers.set(tab, manager);
  }

  if (mUpdatingCollapsedStateCancellers.has(tab)) {
    mUpdatingCollapsedStateCancellers.get(tab)(toBeCollapsed);
    mUpdatingCollapsedStateCancellers.delete(tab);
  }

  let cancelled = false;
  const canceller = (aNewToBeCollapsed) => {
    cancelled = true;
    if (aNewToBeCollapsed != toBeCollapsed) {
      tab.classList.remove(Constants.kTAB_STATE_COLLAPSING);
      tab.classList.remove(Constants.kTAB_STATE_EXPANDING);
    }
  };
  const onCompleted = (tab, info = {}) => {
    manager.removeListener(onCompleted);
    if (cancelled ||
        !Tabs.ensureLivingTab(tab)) // do nothing for closed tab!
      return;

    mUpdatingCollapsedStateCancellers.delete(tab);

    const toBeCollapsed = info.collapsed;
    SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

    if (configs.animation &&
        !info.justNow &&
        configs.collapseDuration > 0)
      return; // animation

    //log('=> skip animation');
    if (toBeCollapsed)
      tab.classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
    else
      tab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);

    const reason = toBeCollapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;
    onEndCollapseExpandCompletely(tab, {
      collapsed: toBeCollapsed,
      reason
    });

    if (info.last)
      Scroll.scrollToTab(tab, {
        anchor:            info.anchor,
        notifyOnOutOfView: true
      });
  };
  manager.addListener(onCompleted);

  if (!configs.animation ||
      info.justNow ||
      configs.collapseDuration < 1) {
    //log('=> skip animation');
    return;
  }

  mUpdatingCollapsedStateCancellers.set(tab, canceller);

  if (toBeCollapsed) {
    tab.classList.add(Constants.kTAB_STATE_COLLAPSING);
  }
  else {
    tab.classList.add(Constants.kTAB_STATE_EXPANDING);
    tab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);
  }

  Sidebar.reserveToUpdateTabbarLayout({ reason });

  const onCanceled = () => {
    manager.removeListener(onCompleted);
  };

  nextFrame().then(() => {
    if (cancelled ||
        !Tabs.ensureLivingTab(tab)) { // it was removed while waiting
      onCanceled();
      return;
    }

    //log('start animation for ', dumpTab(tab));
    if (info.last)
      Scroll.scrollToTab(tab, {
        anchor:            info.anchor,
        notifyOnOutOfView: true
      });

    tab.onEndCollapseExpandAnimation = (() => {
      if (cancelled) {
        onCanceled();
        return;
      }

      //log('=> finish animation for ', dumpTab(tab));
      tab.classList.remove(Constants.kTAB_STATE_COLLAPSING);
      tab.classList.remove(Constants.kTAB_STATE_EXPANDING);

      // The collapsed state of the tab can be changed by different trigger,
      // so we must respect the actual status of the tab, instead of the
      // "expected status" given via arguments.
      if (tab.classList.contains(Constants.kTAB_STATE_COLLAPSED))
        tab.classList.add(Constants.kTAB_STATE_COLLAPSED_DONE);
      else
        tab.classList.remove(Constants.kTAB_STATE_COLLAPSED_DONE);

      onEndCollapseExpandCompletely(tab, {
        collapsed: toBeCollapsed,
        reason
      });
    });
    tab.onEndCollapseExpandAnimation.timeout = setTimeout(() => {
      if (cancelled ||
          !Tabs.ensureLivingTab(tab) ||
          !tab.onEndCollapseExpandAnimation) {
        onCanceled();
        return;
      }
      delete tab.onEndCollapseExpandAnimation.timeout;
      tab.onEndCollapseExpandAnimation();
      delete tab.onEndCollapseExpandAnimation;
    }, configs.collapseDuration);
  });
});
function onEndCollapseExpandCompletely(tab, options = {}) {
  if (Tabs.isActive(tab) && !options.collapsed)
    Scroll.scrollToTab(tab);

  if (configs.indentAutoShrink &&
      configs.indentAutoShrinkOnlyForVisible)
    Indent.reserveToUpdateVisualMaxTreeLevel();

  // this is very required for no animation case!
  Sidebar.reserveToUpdateTabbarLayout({ reason: options.reason });
  SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

Tabs.onCollapsedStateChanged.addListener((tab, info = {}) => {
  const manager = mTabCollapsedStateChangedManagers.get(tab);
  if (manager)
    manager.dispatch(tab, info);
});

/*
function onTabSubtreeCollapsedStateChangedManually(event) {
  if (!configs.indentAutoShrink ||
      !configs.indentAutoShrinkOnlyForVisible)
    return;

  cancelCheckTabsIndentOverflow();
  if (!tab.checkTabsIndentOverflowOnMouseLeave) {
    let stillOver = false;
    let id = tab.id
    tab.checkTabsIndentOverflowOnMouseLeave = function checkTabsIndentOverflowOnMouseLeave(event, aDelayed) {
      if (event.type == 'mouseover') {
        let node = EventUtils.getElementTarget(event);
        if (node.closest(`#${id}`))
            stillOver = true;
          return;
        }
        else if (!aDelayed) {
          if (stillOver) {
            stillOver = false;
          }
          setTimeout(() => {
            if (!Tabs.ensureLivingTab(tab)) // it was removed while waiting
              return;
            tab.checkTabsIndentOverflowOnMouseLeave(event, true);
          }, 0);
          return;
        } else if (stillOver) {
          return;
        }
        let x = event.clientX;
        let y = event.clientY;
        let rect = tab.getBoundingClientRect();
        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom)
          return;
        document.removeEventListener('mouseover', tab.checkTabsIndentOverflowOnMouseLeave, true);
        document.removeEventListener('mouseout', tab.checkTabsIndentOverflowOnMouseLeave, true);
        delete tab.checkTabsIndentOverflowOnMouseLeave;
        checkTabsIndentOverflow();
      };
      document.addEventListener('mouseover', tab.checkTabsIndentOverflowOnMouseLeave, true);
      document.addEventListener('mouseout', tab.checkTabsIndentOverflowOnMouseLeave, true);
    }
  }
}
*/
