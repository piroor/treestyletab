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
 * Portions created by the Initial Developer are Copyright (C) 2011-2018
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
  wait,
  configs
} from './common.js';

import * as Constants from './constants.js';
import * as TabsStore from './tabs-store.js';
import * as ContextualIdentities from './contextual-identities.js';
import * as Sidebar from './sidebar.js';

import Tab from './Tab.js';

function log(...args) {
  internalLogger('common/tabs-update', ...args);
}

let mDelayedDispatchOnHighlightedTabsChanged;

export function updateTab(tab, newState = {}, options = {}) {
  if ('url' in newState) {
    tab.$TST.setAttribute(Constants.kCURRENT_URI, newState.url);
  }

  if ('url' in newState &&
      newState.url.indexOf(Constants.kGROUP_TAB_URI) == 0) {
    tab.$TST.addState(Constants.kTAB_STATE_GROUP_TAB, { permanently: true });
    TabsStore.addGroupTab(tab);
    Tab.onGroupTabDetected.dispatch(tab);
  }
  else if (tab.$TST.states.has(Constants.kTAB_STATE_GROUP_TAB) &&
           !tab.$TST.hasGroupTabURL) {
    TabsStore.removeGroupTab(tab);
  }

  if (options.forceApply ||
      'title' in newState) {
    let visibleLabel = newState.title;
    if (newState && newState.cookieStoreId) {
      const identity = ContextualIdentities.get(newState.cookieStoreId);
      if (identity)
        visibleLabel = `${newState.title} - ${identity.name}`;
    }
    if (options.forceApply) {
      tab.$TST.getPermanentStates().then(states => {
        if (states.includes(Constants.kTAB_STATE_UNREAD))
          tab.$TST.addState(Constants.kTAB_STATE_UNREAD, { permanently: true });
        else
          tab.$TST.removeState(Constants.kTAB_STATE_UNREAD, { permanently: true });
      });
    }
    else if (!tab.active) {
      tab.$TST.addState(Constants.kTAB_STATE_UNREAD, { permanently: true });
    }
    tab.$TST.label = visibleLabel;
    Tab.onLabelUpdated.dispatch(tab);
    Sidebar.sendMessage({
      type:     Constants.kCOMMAND_NOTIFY_TAB_LABEL_UPDATED,
      windowId: tab.windowId,
      tabId:    tab.id,
      title:    tab.title,
      label:    tab.$TST.label
    });
  }

  const openerOfGroupTab = tab.$TST.isGroupTab && Tab.getOpenerFromGroupTab(tab);
  if (openerOfGroupTab &&
      openerOfGroupTab.favIconUrl) {
    Sidebar.sendMessage({
      type:       Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED,
      windowId:   tab.windowId,
      tabId:      tab.id,
      favIconUrl: openerOfGroupTab.favIconUrl
    });
  }
  else if (options.forceApply ||
           'favIconUrl' in newState) {
    Sidebar.sendMessage({
      type:       Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED,
      windowId:   tab.windowId,
      tabId:      tab.id,
      favIconUrl: tab.favIconUrl
    });
  }
  else if (tab.$TST.isGroupTab) {
    // "about:treestyletab-group" can set error icon for the favicon and
    // reloading doesn't cloear that, so we need to clear favIconUrl manually.
    tab.favIconUrl = null;
    Sidebar.sendMessage({
      type:       Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED,
      windowId:   tab.windowId,
      tabId:      tab.id,
      favIconUrl: null
    });
  }

  if ('status' in newState) {
    const reallyChanged = !tab.$TST.states.has(newState.status);
    tab.$TST.removeState(newState.status == 'loading' ? 'complete' : 'loading');
    tab.$TST.addState(newState.status);
    if (newState.status == 'loading') {
      tab.$TST.removeState(Constants.kTAB_STATE_BURSTING);
      TabsStore.addLoadingTab(tab);
    }
    else {
      TabsStore.removeLoadingTab(tab);
      if (!options.forceApply && reallyChanged) {
        tab.$TST.addState(Constants.kTAB_STATE_BURSTING);
        if (tab.$TST.delayedBurstEnd)
          clearTimeout(tab.$TST.delayedBurstEnd);
        tab.$TST.delayedBurstEnd = setTimeout(() => {
          delete tab.$TST.delayedBurstEnd;
          tab.$TST.removeState(Constants.kTAB_STATE_BURSTING);
          if (!tab.active)
            tab.$TST.addState(Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
        }, configs.burstDuration);
      }
    }
    Tab.onStateChanged.dispatch(tab);
  }

  if ((options.forceApply ||
       'pinned' in newState) &&
      newState.pinned != tab.$TST.states.has(Constants.kTAB_STATE_PINNED)) {
    if (newState.pinned) {
      tab.$TST.addState(Constants.kTAB_STATE_PINNED);
      tab.$TST.removeAttribute(Constants.kLEVEL); // don't indent pinned tabs!
      TabsStore.removeUnpinnedTab(tab);
      TabsStore.addPinnedTab(tab);
      Tab.onPinned.dispatch(tab);
    }
    else {
      tab.$TST.removeState(Constants.kTAB_STATE_PINNED);
      TabsStore.removePinnedTab(tab);
      TabsStore.addUnpinnedTab(tab);
      Tab.onUnpinned.dispatch(tab);
    }
  }

  if (options.forceApply ||
      'audible' in newState) {
    if (newState.audible)
      tab.$TST.addState(Constants.kTAB_STATE_AUDIBLE);
    else
      tab.$TST.removeState(Constants.kTAB_STATE_AUDIBLE);
  }

  let soundStateChanged = false;

  if (options.forceApply ||
      'mutedInfo' in newState) {
    soundStateChanged = true;
    if (newState.mutedInfo && newState.mutedInfo.muted)
      tab.$TST.addState(Constants.kTAB_STATE_MUTED);
    else
      tab.$TST.removeState(Constants.kTAB_STATE_MUTED);
  }

  if (options.forceApply ||
      soundStateChanged ||
      'audible' in newState) {
    soundStateChanged = true;
    if (tab.audible &&
        !tab.mutedInfo.muted)
      tab.$TST.addState(Constants.kTAB_STATE_SOUND_PLAYING);
    else
      tab.$TST.removeState(Constants.kTAB_STATE_SOUND_PLAYING);
  }

  if (soundStateChanged) {
    const parent = tab.$TST.parent;
    if (parent)
      parent.$TST.inheritSoundStateFromChildren();
  }

  if (options.forceApply ||
      'cookieStoreId' in newState) {
    for (const state of tab.$TST.states) {
      if (state.indexOf('contextual-identity-') == 0)
        tab.$TST.removeState(state);
    }
    if (newState.cookieStoreId)
      tab.$TST.addState(`contextual-identity-${newState.cookieStoreId}`);
  }

  if (options.forceApply ||
      'incognito' in newState) {
    if (newState.incognito)
      tab.$TST.addState(Constants.kTAB_STATE_PRIVATE_BROWSING);
    else
      tab.$TST.removeState(Constants.kTAB_STATE_PRIVATE_BROWSING);
  }

  if (options.forceApply ||
      'hidden' in newState) {
    if (newState.hidden) {
      if (!tab.$TST.states.has(Constants.kTAB_STATE_HIDDEN)) {
        tab.$TST.addState(Constants.kTAB_STATE_HIDDEN);
        TabsStore.removeVisibleTab(tab);
        TabsStore.removeControllableTab(tab);
        Tab.onHidden.dispatch(tab);
      }
    }
    else if (tab.$TST.states.has(Constants.kTAB_STATE_HIDDEN)) {
      tab.$TST.removeState(Constants.kTAB_STATE_HIDDEN);
      if (!tab.$TST.collapsed)
        TabsStore.addVisibleTab(tab);
      TabsStore.addControllableTab(tab);
      Tab.onShown.dispatch(tab);
    }
  }

  if (options.forceApply ||
      'highlighted' in newState) {
    if (newState.highlighted) {
      TabsStore.addHighlightedTab(tab);
      tab.$TST.addState(Constants.kTAB_STATE_HIGHLIGHTED);
    }
    else {
      TabsStore.removeHighlightedTab(tab);
      tab.$TST.removeState(Constants.kTAB_STATE_HIGHLIGHTED);
    }
    if (mDelayedDispatchOnHighlightedTabsChanged)
      clearTimeout(mDelayedDispatchOnHighlightedTabsChanged);
    mDelayedDispatchOnHighlightedTabsChanged = setTimeout(windowId => {
      mDelayedDispatchOnHighlightedTabsChanged = null;
      Tab.onHighlightedTabsChanged.dispatch(windowId);
    }, 0, tab.windowId);
  }

  if (options.forceApply ||
      'attention' in newState) {
    if (newState.attention)
      tab.$TST.addState(Constants.kTAB_STATE_ATTENTION);
    else
      tab.$TST.removeState(Constants.kTAB_STATE_ATTENTION);
  }

  if (options.forceApply ||
      'discarded' in newState) {
    wait(0).then(() => {
      // Don't set this class immediately, because we need to know
      // the newly active tab *was* discarded on onTabClosed handler.
      if (newState.discarded)
        tab.$TST.addState(Constants.kTAB_STATE_DISCARDED);
      else
        tab.$TST.removeState(Constants.kTAB_STATE_DISCARDED);
    });
  }
}

export async function updateTabsHighlighted(highlightInfo) {
  if (Tab.needToWaitTracked(highlightInfo.windowId))
    await Tab.waitUntilTrackedAll(highlightInfo.windowId);
  const window = TabsStore.windows.get(highlightInfo.windowId);
  if (!window)
    return;

  //const startAt = Date.now();

  const tabIds = highlightInfo.tabIds; // new Set(highlightInfo.tabIds);
  const unhighlightedTabs = Tab.getHighlightedTabs(highlightInfo.windowId, {
    ordered: false,
    '!id':   tabIds
  });
  const highlightedTabs = tabIds.map(id => window.tabs.get(id)).filter(tab => !tab.highlighted);

  //console.log(`updateTabsHighlighted: ${Date.now() - startAt}ms`);

  //log('updateTabsHighlighted ', { highlightedTabs, unhighlightedTabs});
  for (const tab of unhighlightedTabs) {
    TabsStore.removeHighlightedTab(tab);
    updateTabHighlighted(tab, false);
  }
  for (const tab of highlightedTabs) {
    TabsStore.addHighlightedTab(tab);
    updateTabHighlighted(tab, true);
  }
  if (unhighlightedTabs.length > 0 ||
      highlightedTabs.length > 0)
    Tab.onHighlightedTabsChanged.dispatch(highlightInfo.windowId);
}
async function updateTabHighlighted(tab, highlighted) {
  log(`highlighted status of ${dumpTab(tab)}: `, { old: tab.highlighted, new: highlighted });
  //if (tab.highlighted == highlighted)
  //  return false;
  if (highlighted)
    tab.$TST.addState(Constants.kTAB_STATE_HIGHLIGHTED);
  else
    tab.$TST.removeState(Constants.kTAB_STATE_HIGHLIGHTED);
  tab.highlighted = highlighted;
  const window = TabsStore.windows.get(tab.windowId);
  const inheritHighlighted = !window.tabsToBeHighlightedAlone.has(tab.id);
  if (!inheritHighlighted)
    window.tabsToBeHighlightedAlone.delete(tab.id);
  Tab.onUpdated.dispatch(tab, { highlighted }, { inheritHighlighted });
  return true;
}
