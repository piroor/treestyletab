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
  wait,
  configs
} from './common.js';

import * as Constants from './constants.js';
import * as Tabs from './tabs.js';
import * as ContextualIdentities from './contextual-identities.js';

import Tab from './Tab.js';

function log(...args) {
  internalLogger('common/tabs-update', ...args);
}

let mDelayedDispatchOnHighlightedTabsChanged;

export function updateTab(tab, newState = {}, options = {}) {
  if ('url' in newState) {
    Tabs.setAttribute(tab, Constants.kCURRENT_URI, newState.url);
  }

  if ('url' in newState &&
      newState.url.indexOf(Constants.kGROUP_TAB_URI) == 0) {
    Tabs.addState(tab, Constants.kTAB_STATE_GROUP_TAB, { permanently: true });
    Tabs.onGroupTabDetected.dispatch(tab);
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
      Tabs.getPermanentStates(tab).then(states => {
        if (states.includes(Constants.kTAB_STATE_UNREAD))
          Tabs.addState(tab, Constants.kTAB_STATE_UNREAD, { permanently: true });
        else
          Tabs.removeState(tab, Constants.kTAB_STATE_UNREAD, { permanently: true });
      });
    }
    else if (!Tabs.isActive(tab)) {
      Tabs.addState(tab, Constants.kTAB_STATE_UNREAD, { permanently: true });
    }
    tab.$TST.label = visibleLabel;
    Tabs.onLabelUpdated.dispatch(tab);
  }

  const openerOfGroupTab = Tabs.isGroupTab(tab) && Tab.getOpenerFromGroupTab(tab);
  if (openerOfGroupTab &&
      openerOfGroupTab.favIconUrl) {
    Tabs.onFaviconUpdated.dispatch(tab,
                                   openerOfGroupTab.favIconUrl);
  }
  else if (options.forceApply ||
           'favIconUrl' in newState) {
    Tabs.onFaviconUpdated.dispatch(tab);
  }
  else if (Tabs.isGroupTab(tab)) {
    // "about:treestyletab-group" can set error icon for the favicon and
    // reloading doesn't cloear that, so we need to clear favIconUrl manually.
    tab.favIconUrl = null;
    Tabs.onFaviconUpdated.dispatch(tab, null);
  }

  if ('status' in newState) {
    const reallyChanged = !Tabs.hasState(tab, newState.status);
    Tabs.removeState(tab, newState.status == 'loading' ? 'complete' : 'loading');
    Tabs.addState(tab, newState.status);
    if (newState.status == 'loading') {
      Tabs.removeState(tab, Constants.kTAB_STATE_BURSTING);
    }
    else if (!options.forceApply && reallyChanged) {
      Tabs.addState(tab, Constants.kTAB_STATE_BURSTING);
      if (tab.$TST.delayedBurstEnd)
        clearTimeout(tab.$TST.delayedBurstEnd);
      tab.$TST.delayedBurstEnd = setTimeout(() => {
        delete tab.$TST.delayedBurstEnd;
        Tabs.removeState(tab, Constants.kTAB_STATE_BURSTING);
        if (!Tabs.isActive(tab))
          Tabs.addState(tab, Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
      }, configs.burstDuration);
    }
    Tabs.onStateChanged.dispatch(tab);
  }

  if ((options.forceApply ||
       'pinned' in newState) &&
      newState.pinned != Tabs.hasState(tab, Constants.kTAB_STATE_PINNED)) {
    if (newState.pinned) {
      Tabs.addState(tab, Constants.kTAB_STATE_PINNED);
      Tabs.removeAttribute(tab, Constants.kLEVEL); // don't indent pinned tabs!
      Tabs.onPinned.dispatch(tab);
    }
    else {
      Tabs.removeState(tab, Constants.kTAB_STATE_PINNED);
      Tabs.onUnpinned.dispatch(tab);
    }
  }

  if (options.forceApply ||
      'audible' in newState) {
    if (newState.audible)
      Tabs.addState(tab, Constants.kTAB_STATE_AUDIBLE);
    else
      Tabs.removeState(tab, Constants.kTAB_STATE_AUDIBLE);
  }

  if (options.forceApply ||
      'mutedInfo' in newState) {
    if (newState.mutedInfo && newState.mutedInfo.muted)
      Tabs.addState(tab, Constants.kTAB_STATE_MUTED);
    else
      Tabs.removeState(tab, Constants.kTAB_STATE_MUTED);
  }

  if (tab.audible &&
      !tab.mutedInfo.muted)
    Tabs.addState(tab, Constants.kTAB_STATE_SOUND_PLAYING);
  else
    Tabs.removeState(tab, Constants.kTAB_STATE_SOUND_PLAYING);

  if (options.forceApply ||
      'cookieStoreId' in newState) {
    for (const state of Tabs.getStates(tab)) {
      if (state.indexOf('contextual-identity-') == 0)
        Tabs.removeState(tab, state);
    }
    if (newState.cookieStoreId)
      Tabs.addState(tab, `contextual-identity-${newState.cookieStoreId}`);
  }

  if (options.forceApply ||
      'incognito' in newState) {
    if (newState.incognito)
      Tabs.addState(tab, Constants.kTAB_STATE_PRIVATE_BROWSING);
    else
      Tabs.removeState(tab, Constants.kTAB_STATE_PRIVATE_BROWSING);
  }

  if (options.forceApply ||
      'hidden' in newState) {
    if (newState.hidden) {
      if (!Tabs.hasState(tab, Constants.kTAB_STATE_HIDDEN)) {
        Tabs.addState(tab, Constants.kTAB_STATE_HIDDEN);
        Tabs.onHidden.dispatch(tab);
      }
    }
    else if (Tabs.hasState(tab, Constants.kTAB_STATE_HIDDEN)) {
      Tabs.removeState(tab, Constants.kTAB_STATE_HIDDEN);
      Tabs.onShown.dispatch(tab);
    }
  }

  if (options.forceApply ||
      'highlighted' in newState) {
    const highlightedTabs = Tabs.highlightedTabsForWindow.get(tab.windowId);
    if (newState.highlighted) {
      highlightedTabs.add(tab);
      Tabs.addState(tab, Constants.kTAB_STATE_HIGHLIGHTED);
    }
    else {
      highlightedTabs.delete(tab);
      Tabs.removeState(tab, Constants.kTAB_STATE_HIGHLIGHTED);
    }
    if (mDelayedDispatchOnHighlightedTabsChanged)
      clearTimeout(mDelayedDispatchOnHighlightedTabsChanged);
    mDelayedDispatchOnHighlightedTabsChanged = setTimeout(windowId => {
      mDelayedDispatchOnHighlightedTabsChanged = null;
      Tabs.onHighlightedTabsChanged.dispatch(windowId);
    }, 0, tab.windowId);
  }

  if (options.forceApply ||
      'attention' in newState) {
    if (newState.attention)
      Tabs.addState(tab, Constants.kTAB_STATE_ATTENTION);
    else
      Tabs.removeState(tab, Constants.kTAB_STATE_ATTENTION);
  }

  if (options.forceApply ||
      'discarded' in newState) {
    wait(0).then(() => {
      // Don't set this class immediately, because we need to know
      // the newly active tab *was* discarded on onTabClosed handler.
      if (newState.discarded)
        Tabs.addState(tab, Constants.kTAB_STATE_DISCARDED);
      else
        Tabs.removeState(tab, Constants.kTAB_STATE_DISCARDED);
    });
  }
}

export async function updateTabsHighlighted(highlightInfo) {
  if (Tabs.hasCreatingTab(highlightInfo.windowId))
    await Tabs.waitUntilAllTabsAreCreated(highlightInfo.windowId);
  const window = Tabs.trackedWindows.get(highlightInfo.windowId);
  if (!window)
    return;

  //const startAt = Date.now();

  const allHighlightedTabs = Tabs.highlightedTabsForWindow.get(highlightInfo.windowId);

  const tabIds = highlightInfo.tabIds; // new Set(highlightInfo.tabIds);
  const unhighlightedTabs = Tabs.queryAll({
    windowId:    highlightInfo.windowId,
    '!id':       tabIds,
    //id:          new RegExp(`^(?!(${highlightInfo.tabIds.join('|')})$)`),
    highlighted: true
  });
  const highlightedTabs = Tabs.queryAll({
    windowId:    highlightInfo.windowId,
    id:          tabIds,
    //id:          new RegExp(`^(${highlightInfo.tabIds.join('|')})$`),
    highlighted: false
  });

  //console.log(`updateTabsHighlighted: ${Date.now() - startAt}ms`);

  //log('updateTabsHighlighted ', { highlightedTabs, unhighlightedTabs});
  for (const tab of unhighlightedTabs) {
    allHighlightedTabs.delete(tab);
    updateTabHighlighted(tab, false);
  }
  for (const tab of highlightedTabs) {
    allHighlightedTabs.add(tab);
    updateTabHighlighted(tab, true);
  }
  if (unhighlightedTabs.length > 0 ||
      highlightedTabs.length > 0)
    Tabs.onHighlightedTabsChanged.dispatch(highlightInfo.windowId);
}
async function updateTabHighlighted(tab, highlighted) {
  log(`highlighted status of ${tab.id}: `, { old: Tabs.isHighlighted(tab), new: highlighted });
  //if (Tabs.isHighlighted(tab) == highlighted)
  //  return false;
  if (highlighted)
    Tabs.addState(tab, Constants.kTAB_STATE_HIGHLIGHTED);
  else
    Tabs.removeState(tab, Constants.kTAB_STATE_HIGHLIGHTED);
  tab.highlighted = highlighted;
  const window = Tabs.trackedWindows.get(tab.windowId);
  const inheritHighlighted = !window.tabsToBeHighlightedAlone.has(tab.id);
  if (!inheritHighlighted)
    window.tabsToBeHighlightedAlone.delete(tab.id);
  Tabs.onUpdated.dispatch(tab, { highlighted }, { inheritHighlighted });
  return true;
}

export function updateParentTab(parent) {
  if (!Tabs.ensureLivingTab(parent))
    return;

  const children = Tab.getChildren(parent);

  if (children.some(Tabs.maybeSoundPlaying))
    Tabs.addState(parent, Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
  else
    Tabs.removeState(parent, Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);

  if (children.some(Tabs.maybeMuted))
    Tabs.addState(parent, Constants.kTAB_STATE_HAS_MUTED_MEMBER);
  else
    Tabs.removeState(parent, Constants.kTAB_STATE_HAS_MUTED_MEMBER);

  updateParentTab(Tab.getParent(parent));

  Tabs.onParentTabUpdated.dispatch(parent);
}
