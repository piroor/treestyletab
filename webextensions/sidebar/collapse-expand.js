/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1
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
 * Portions created by the Initial Developer are Copyright (C) 2011-2026
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *                 tkng (https://github.com/tkng)
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import EventListenerManager from '/extlib/EventListenerManager.js';

import {
  log as internalLogger,
  configs,
  shouldApplyAnimation,
  stack,
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';

import { Tab } from '/common/TreeItem.js';

import * as BackgroundConnection from './background-connection.js';

import { TabInvalidationTarget } from './components/TreeItemElement.js';

function log(...args) {
  internalLogger('sidebar/collapse-expand', ...args);
}

// Module-level maps for per-tab sidebar collapse/expand state.
// These should not be stored on TreeItem instances to preserve object shape stability.
const mUpdatingCollapsedStateCanceller = new Map();
const mCollapseExpandAnimationCallback = new Map();
const mCollapseExpandAnimationTimeout = new Map();


export function clearState(tabId) {
  mUpdatingCollapsedStateCanceller.delete(tabId);
  const timeout = mCollapseExpandAnimationTimeout.get(tabId);
  if (timeout)
    clearTimeout(timeout);
  mCollapseExpandAnimationCallback.delete(tabId);
  mCollapseExpandAnimationTimeout.delete(tabId);
}

export const onUpdating = new EventListenerManager();
export const onUpdated = new EventListenerManager();
export const onReadyToExpand = new EventListenerManager();

export async function setCollapsed(tab, info = {}) {
  log('setCollapsed ', tab.id, { ...info, stack: stack() });
  if (!TabsStore.ensureLivingItem(tab)) // do nothing for closed tab!
    return;

  const changed = (
    info.collapsed != tab.$TST.collapsed ||
    info.collapsed != tab.$TST.collapsedCompletely
  );

  if (info.collapsed) {
    tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED);
    TabsStore.removeVisibleTab(tab);
    TabsStore.removeExpandedTab(tab);
  }
  else {
    if (tab.$TST.states.has(Constants.kTAB_STATE_COLLAPSED_DONE)) {
      tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED_DONE);
      TabsStore.updateVirtualScrollRenderabilityIndexForTab(tab);
      await onReadyToExpand.dispatch(tab);
    }
    tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED);
    TabsStore.addVisibleTab(tab);
    TabsStore.addExpandedTab(tab);
  }

  if (mCollapseExpandAnimationCallback.has(tab.id)) {
    clearTimeout(mCollapseExpandAnimationTimeout.get(tab.id));
    mCollapseExpandAnimationCallback.delete(tab.id);
    mCollapseExpandAnimationTimeout.delete(tab.id);
  }

  if (tab.status == 'loading')
    tab.$TST.addState(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  const manager = tab.$TST.collapsedStateChangedManager || new EventListenerManager();

  const prevCanceller = mUpdatingCollapsedStateCanceller.get(tab.id);
  if (prevCanceller) {
    prevCanceller(tab.$TST.collapsed);
    mUpdatingCollapsedStateCanceller.delete(tab.id);
  }

  let cancelled = false;
  const canceller = (aNewToBeCollapsed) => {
    cancelled = true;
    if (aNewToBeCollapsed != tab.$TST.collapsed) {
      tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSING);
      tab.$TST.removeState(Constants.kTAB_STATE_EXPANDING);
    }
  };
  const onCompleted = (tab, info = {}) => {
    manager.removeListener(onCompleted);
    if (cancelled ||
        !TabsStore.ensureLivingItem(tab)) // do nothing for closed tab!
      return;

    if (shouldApplyAnimation() &&
        !info.justNow &&
        configs.collapseDuration > 0 &&
        changed)
      return; // force completion is required only for non-animation case

    //log('=> skip animation');
    if (tab.$TST.collapsed) {
      tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSING);
      tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED_DONE);
    }
    else {
      tab.$TST.removeState(Constants.kTAB_STATE_EXPANDING);
    }

    TabsStore.updateVirtualScrollRenderabilityIndexForTab(tab);
    onUpdated.dispatch(tab, {
      collapsed: tab.$TST.collapsed,
      anchor:    info.anchor,
      last:      info.last
    });
  };
  manager.addListener(onCompleted);

  if (!shouldApplyAnimation() ||
      info.justNow ||
      configs.collapseDuration < 1 ||
      !changed) {
    //log('=> skip animation');
    onCompleted(tab, info);
    return;
  }

  mUpdatingCollapsedStateCanceller.set(tab.id, canceller);

  if (tab.$TST.collapsed) {
    tab.$TST.addState(Constants.kTAB_STATE_COLLAPSING);
  }
  else {
    tab.$TST.addState(Constants.kTAB_STATE_EXPANDING);
    tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSED_DONE);
  }

  TabsStore.updateVirtualScrollRenderabilityIndexForTab(tab);
  onUpdated.dispatch(tab, { collapsed: info.collapsed });

  const onCanceled = () => {
    manager.removeListener(onCompleted);
  };

  window.requestAnimationFrame(() => {
    if (cancelled ||
        !TabsStore.ensureLivingItem(tab)) { // it was removed while waiting
      onCanceled();
      return;
    }

    //log('start animation for ', dumpTab(tab));
    onUpdating.dispatch(tab, {
      collapsed: tab.$TST.collapsed,
      anchor:    info.anchor,
      last:      info.last
    });

    const collapseExpandCallback = () => {
      if (cancelled) {
        onCanceled();
        return;
      }

      //log('=> finish animation for ', dumpTab(tab));
      tab.$TST.removeState(Constants.kTAB_STATE_COLLAPSING);
      tab.$TST.removeState(Constants.kTAB_STATE_EXPANDING);

      // The collapsed state of the tab can be changed by different trigger,
      // so we must respect the actual status of the tab, instead of the
      // "expected status" given via arguments.
      if (tab.$TST.collapsed)
        tab.$TST.addState(Constants.kTAB_STATE_COLLAPSED_DONE);

      TabsStore.updateVirtualScrollRenderabilityIndexForTab(tab);
      onUpdated.dispatch(tab, {
        collapsed: tab.$TST.collapsed
      });
    };
    mCollapseExpandAnimationCallback.set(tab.id, collapseExpandCallback);
    mCollapseExpandAnimationTimeout.set(tab.id, setTimeout(() => {
      if (cancelled ||
          !TabsStore.ensureLivingItem(tab) ||
          !mCollapseExpandAnimationCallback.has(tab.id)) {
        onCanceled();
        return;
      }
      mCollapseExpandAnimationTimeout.delete(tab.id);
      const callback = mCollapseExpandAnimationCallback.get(tab.id);
      if (callback)
        callback();
      mCollapseExpandAnimationCallback.delete(tab.id);
      mUpdatingCollapsedStateCanceller.delete(tab.id);
    }, configs.collapseDuration));
  });
}

const BUFFER_KEY_PREFIX = 'collapse-expand-';

BackgroundConnection.onMessage.addListener(async message => {
  switch (message.type) {
    case Constants.kCOMMAND_NOTIFY_SUBTREE_COLLAPSED_STATE_CHANGED: {
      if (BackgroundConnection.handleBufferedMessage(message, `${BUFFER_KEY_PREFIX}${message.tabId}`))
        return;
      await Tab.waitUntilTracked(message.tabId);
      const tab = Tab.get(message.tabId);
      const lastMessage = BackgroundConnection.fetchBufferedMessage(message.type, `${BUFFER_KEY_PREFIX}${message.tabId}`);
      if (!tab ||
          !lastMessage)
        return;
      tab.$TST.toggleState(Constants.kTAB_STATE_SUBTREE_COLLAPSED, lastMessage.collapsed);
      tab.$TST.invalidateElement(TabInvalidationTarget.Twisty | TabInvalidationTarget.Tooltip);
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_COLLAPSED_STATE_CHANGED: {
      if (BackgroundConnection.handleBufferedMessage(message, `${BUFFER_KEY_PREFIX}${message.tabId}`))
        return;
      await Tab.waitUntilTracked(message.tabId);
      const tab = Tab.get(message.tabId);
      const lastMessage = BackgroundConnection.fetchBufferedMessage(message.type, `${BUFFER_KEY_PREFIX}${message.tabId}`);
      if (!tab ||
          !lastMessage)
        return;
      setCollapsed(tab, {
        collapsed: lastMessage.collapsed,
        justNow:   lastMessage.justNow,
        anchor:    Tab.get(lastMessage.anchorId),
        last:      lastMessage.last
      });
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_REMOVING:
    case Constants.kCOMMAND_NOTIFY_TAB_DETACHED_FROM_WINDOW:
      BackgroundConnection.clearBufferedMessagesForKey(`${BUFFER_KEY_PREFIX}${message.tabId}`);
      break;
  }
});
