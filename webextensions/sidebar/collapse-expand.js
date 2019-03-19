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
  nextFrame,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';
import * as Tree from '/common/tree.js';

import Tab from '/common/Tab.js';

import * as Background from './background.js';
import * as Sidebar from './sidebar.js';
import * as SidebarCache from './sidebar-cache.js';
import * as Scroll from './scroll.js';
import * as Indent from './indent.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('sidebar/collapse-expand', ...args);
}


const mUpdatingCollapsedStateCancellers = new Map();
const mTabCollapsedStateChangedManagers = new Map();

Tab.onCollapsedStateChanging.addListener((tab, info = {}) => {
  const toBeCollapsed = info.collapsed;

  log('Tabs.onCollapsedStateChanging ', tab.id, info);
  if (!TabsStore.ensureLivingTab(tab)) // do nothing for closed tab!
    return;

  SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

  if (tab.$TST.onEndCollapseExpandAnimation) {
    clearTimeout(tab.$TST.onEndCollapseExpandAnimation.timeout);
    delete tab.$TST.onEndCollapseExpandAnimation;
  }

  if (tab.status == 'loading')
    tab.$TST.addState(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  if (info.anchor && !Scroll.isTabInViewport(info.anchor))
    info.anchor = null;

  const reason = toBeCollapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;

  let manager = mTabCollapsedStateChangedManagers.get(tab.id);
  if (!manager) {
    manager = new EventListenerManager();
    mTabCollapsedStateChangedManagers.set(tab.id, manager);
  }

  if (mUpdatingCollapsedStateCancellers.has(tab.id)) {
    mUpdatingCollapsedStateCancellers.get(tab.id)(toBeCollapsed);
    mUpdatingCollapsedStateCancellers.delete(tab.id);
  }

  let cancelled = false;
  const canceller = (aNewToBeCollapsed) => {
    cancelled = true;
    if (aNewToBeCollapsed != toBeCollapsed) {
      tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSING);
      tab.$TST.removeState(Constants.kTAB_STATE_EXPANDING);
      TabsStore.removeCollapsingTab(tab);
      TabsStore.removeExpandingTab(tab);
    }
  };
  const onCompleted = (tab, info = {}) => {
    manager.removeListener(onCompleted);
    if (cancelled ||
        !TabsStore.ensureLivingTab(tab)) // do nothing for closed tab!
      return;

    mUpdatingCollapsedStateCancellers.delete(tab.id);

    const toBeCollapsed = info.collapsed;
    SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

    if (configs.animation &&
        !info.justNow &&
        configs.collapseDuration > 0)
      return; // animation

    //log('=> skip animation');
    if (toBeCollapsed)
      tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED_DONE);
    else
      tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED_DONE);

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

  mUpdatingCollapsedStateCancellers.set(tab.id, canceller);

  if (toBeCollapsed) {
    tab.$TST.addState(Constants.kTAB_STATE_COLLAPSING);
    TabsStore.addCollapsingTab(tab);
  }
  else {
    tab.$TST.addState(Constants.kTAB_STATE_EXPANDING);
    tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED_DONE);
    TabsStore.addExpandingTab(tab);
  }

  Sidebar.reserveToUpdateTabbarLayout({ reason });

  const onCanceled = () => {
    manager.removeListener(onCompleted);
  };

  nextFrame().then(() => {
    if (cancelled ||
        !TabsStore.ensureLivingTab(tab)) { // it was removed while waiting
      onCanceled();
      return;
    }

    //log('start animation for ', dumpTab(tab));
    if (info.last)
      Scroll.scrollToTab(tab, {
        anchor:            info.anchor,
        notifyOnOutOfView: true
      });

    tab.$TST.onEndCollapseExpandAnimation = (() => {
      if (cancelled) {
        onCanceled();
        return;
      }

      //log('=> finish animation for ', dumpTab(tab));
      tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSING);
      tab.$TST.removeState(Constants.kTAB_STATE_EXPANDING);
      TabsStore.removeCollapsingTab(tab);
      TabsStore.removeExpandingTab(tab);

      // The collapsed state of the tab can be changed by different trigger,
      // so we must respect the actual status of the tab, instead of the
      // "expected status" given via arguments.
      if (tab.$TST.states.has(Constants.kTAB_STATE_COLLAPSED))
        tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED_DONE);
      else
        tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED_DONE);

      onEndCollapseExpandCompletely(tab, {
        collapsed: toBeCollapsed,
        reason
      });
    });
    tab.$TST.onEndCollapseExpandAnimation.timeout = setTimeout(() => {
      if (cancelled ||
          !TabsStore.ensureLivingTab(tab) ||
          !tab.$TST.onEndCollapseExpandAnimation) {
        onCanceled();
        return;
      }
      delete tab.$TST.onEndCollapseExpandAnimation.timeout;
      tab.$TST.onEndCollapseExpandAnimation();
      delete tab.$TST.onEndCollapseExpandAnimation;
    }, configs.collapseDuration);
  });
});
function onEndCollapseExpandCompletely(tab, options = {}) {
  if (tab.active && !options.collapsed)
    Scroll.scrollToTab(tab);

  if (configs.indentAutoShrink &&
      configs.indentAutoShrinkOnlyForVisible)
    Indent.reserveToUpdateVisualMaxTreeLevel();

  // this is very required for no animation case!
  Sidebar.reserveToUpdateTabbarLayout({ reason: options.reason });
  SidebarCache.markWindowCacheDirty(Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

Tab.onCollapsedStateChanged.addListener((tab, info = {}) => {
  const manager = mTabCollapsedStateChangedManagers.get(tab.id);
  if (manager)
    manager.dispatch(tab, info);
});

Background.onMessage.addListener(async message => {
  switch (message.type) {
    case Constants.kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE:
      return Tree.doTreeChangeFromRemote(async () => {
        await Tab.waitUntilTracked(message.tabId, { element: true });
        const tab = Tab.get(message.tabId);
        if (!tab)
          return;
        const params = {
          collapsed: message.collapsed,
          justNow:   message.justNow,
          stack:     message.stack
        };
        if (message.manualOperation)
          Tree.manualCollapseExpandSubtree(tab, params);
        else
          Tree.collapseExpandSubtree(tab, params);
      });

    case Constants.kCOMMAND_CHANGE_TAB_COLLAPSED_STATE:
      return (async () => {
        await Tab.waitUntilTracked(message.tabId, { element: true });
        const tab = Tab.get(message.tabId);
        if (!tab)
          return;
        // Tree's collapsed state can be changed before this message is delivered,
        // so we should ignore obsolete messages.
        if (message.byAncestor &&
            message.collapsed != tab.$TST.ancestors.some(ancestor => ancestor.$TST.subtreeCollapsed))
          return;
        Tree.collapseExpandTab(tab, {
          collapsed:   message.collapsed,
          justNow:     message.justNow,
          broadcasted: true,
          stack:       message.stack
        });
      })();
  }
});
