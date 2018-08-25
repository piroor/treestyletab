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

import TabFavIconHelper from '/extlib/TabFavIconHelper.js';

import {
  log as internalLogger,
  wait,
  configs
} from './common.js';

import * as Constants from './constants.js';
import * as Tabs from './tabs.js';
import * as ContextualIdentities from './contextual-identities.js';

function log(...args) {
  internalLogger('common/tabs-update', ...args);
}

export function updateTab(tab, newState = {}, options = {}) {
  if ('url' in newState) {
    tab.setAttribute(Constants.kCURRENT_URI, newState.url);
    if (tab.dataset.discardURLAfterCompletelyLoaded &&
        tab.dataset.discardURLAfterCompletelyLoaded != newState.url)
      delete tab.dataset.discardURLAfterCompletelyLoaded;
  }

  if ('url' in newState &&
      newState.url.indexOf(Constants.kGROUP_TAB_URI) == 0) {
    tab.classList.add(Constants.kTAB_STATE_GROUP_TAB);
    Tabs.addSpecialTabState(tab, Constants.kTAB_STATE_GROUP_TAB);
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
    if (options.forceApply && tab.apiTab) {
      browser.sessions.getTabValue(tab.apiTab.id, Constants.kTAB_STATE_UNREAD)
        .then(unread => {
          if (unread)
            tab.classList.add(Constants.kTAB_STATE_UNREAD);
          else
            tab.classList.remove(Constants.kTAB_STATE_UNREAD);
        });
    }
    else if (!Tabs.isActive(tab) && tab.apiTab) {
      tab.classList.add(Constants.kTAB_STATE_UNREAD);
      browser.sessions.setTabValue(tab.apiTab.id, Constants.kTAB_STATE_UNREAD, true);
    }
    Tabs.getTabLabelContent(tab).textContent = newState.title;
    tab.dataset.label = visibleLabel;
    Tabs.onLabelUpdated.dispatch(tab);
  }

  const openerOfGroupTab = Tabs.isGroupTab(tab) && Tabs.getOpenerFromGroupTab(tab);
  if (openerOfGroupTab &&
      (openerOfGroupTab.apiTab.favIconUrl ||
       TabFavIconHelper.maybeImageTab(openerOfGroupTab.apiTab))) {
    Tabs.onFaviconUpdated.dispatch(tab,
                                   openerOfGroupTab.apiTab.favIconUrl ||
                                     openerOfGroupTab.apiTab.url);
  }
  else if (options.forceApply ||
           'favIconUrl' in newState ||
           TabFavIconHelper.maybeImageTab('url' in newState ? newState : tab.apiTab)) {
    Tabs.onFaviconUpdated.dispatch(tab);
  }
  else if (Tabs.isGroupTab(tab)) {
    // "about:treestyletab-group" can set error icon for the favicon and
    // reloading doesn't cloear that, so we need to clear favIconUrl manually.
    tab.apiTab.favIconUrl = null;
    Tabs.onFaviconUpdated.dispatch(tab, null);
  }

  if ('status' in newState) {
    const reallyChanged = !tab.classList.contains(newState.status);
    tab.classList.remove(newState.status == 'loading' ? 'complete' : 'loading');
    tab.classList.add(newState.status);
    if (newState.status == 'loading') {
      tab.classList.remove(Constants.kTAB_STATE_BURSTING);
    }
    else if (!options.forceApply && reallyChanged) {
      tab.classList.add(Constants.kTAB_STATE_BURSTING);
      if (tab.delayedBurstEnd)
        clearTimeout(tab.delayedBurstEnd);
      tab.delayedBurstEnd = setTimeout(() => {
        delete tab.delayedBurstEnd;
        tab.classList.remove(Constants.kTAB_STATE_BURSTING);
        if (!Tabs.isActive(tab))
          tab.classList.add(Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
      }, configs.burstDuration);
    }
    if (newState.status == 'complete' &&
        tab.apiTab &&
        tab.apiTab.url == tab.dataset.discardURLAfterCompletelyLoaded) {
      if (configs.autoDiscardTabForUnexpectedFocus) {
        log(' => discard accidentally restored tab ', tab.apiTab.id);
        if (typeof browser.tabs.discard == 'function')
          browser.tabs.discard(tab.apiTab.id);
      }
      delete tab.dataset.discardURLAfterCompletelyLoaded;
    }
    Tabs.onStateChanged.dispatch(tab);
  }

  if ((options.forceApply ||
       'pinned' in newState) &&
      newState.pinned != tab.classList.contains(Constants.kTAB_STATE_PINNED)) {
    if (newState.pinned) {
      tab.classList.add(Constants.kTAB_STATE_PINNED);
      tab.removeAttribute(Constants.kLEVEL); // don't indent pinned tabs!
      Tabs.onPinned.dispatch(tab);
    }
    else {
      tab.classList.remove(Constants.kTAB_STATE_PINNED);
      Tabs.onUnpinned.dispatch(tab);
    }
  }

  if (options.forceApply ||
      'audible' in newState) {
    if (newState.audible)
      tab.classList.add(Constants.kTAB_STATE_AUDIBLE);
    else
      tab.classList.remove(Constants.kTAB_STATE_AUDIBLE);
  }

  if (options.forceApply ||
      'mutedInfo' in newState) {
    if (newState.mutedInfo && newState.mutedInfo.muted)
      tab.classList.add(Constants.kTAB_STATE_MUTED);
    else
      tab.classList.remove(Constants.kTAB_STATE_MUTED);
  }

  if (tab.apiTab &&
      tab.apiTab.audible &&
      !tab.apiTab.mutedInfo.muted)
    tab.classList.add(Constants.kTAB_STATE_SOUND_PLAYING);
  else
    tab.classList.remove(Constants.kTAB_STATE_SOUND_PLAYING);

  if (options.forceApply ||
      'cookieStoreId' in newState) {
    for (const className of tab.classList) {
      if (className.indexOf('contextual-identity-') == 0)
        tab.classList.remove(className);
    }
    if (newState.cookieStoreId)
      tab.classList.add(`contextual-identity-${newState.cookieStoreId}`);
  }

  if (options.forceApply ||
      'incognito' in newState) {
    if (newState.incognito)
      tab.classList.add(Constants.kTAB_STATE_PRIVATE_BROWSING);
    else
      tab.classList.remove(Constants.kTAB_STATE_PRIVATE_BROWSING);
  }

  if (options.forceApply ||
      'hidden' in newState) {
    if (newState.hidden) {
      if (!tab.classList.contains(Constants.kTAB_STATE_HIDDEN)) {
        tab.classList.add(Constants.kTAB_STATE_HIDDEN);
        Tabs.onHidden.dispatch(tab);
      }
    }
    else if (tab.classList.contains(Constants.kTAB_STATE_HIDDEN)) {
      tab.classList.remove(Constants.kTAB_STATE_HIDDEN);
      Tabs.onShown.dispatch(tab);
    }
  }

  if (options.forceApply ||
      'highlighted' in newState) {
    if (newState.highlighted)
      tab.classList.add(Constants.kTAB_STATE_HIGHLIGHTED);
    else
      tab.classList.remove(Constants.kTAB_STATE_HIGHLIGHTED);

    reserveToUpdateMultipleHighlighted(tab);
  }

  if (options.forceApply ||
      'discarded' in newState) {
    wait(0).then(() => {
      // Don't set this class immediately, because we need to know
      // the newly focused tab *was* discarded on onTabClosed handler.
      if (newState.discarded)
        tab.classList.add(Constants.kTAB_STATE_DISCARDED);
      else
        tab.classList.remove(Constants.kTAB_STATE_DISCARDED);
    });
  }

  updateTabDebugTooltip(tab);
}

export function updateTabDebugTooltip(tab) {
  if (!configs.debug ||
      !tab.apiTab)
    return;
  tab.dataset.label = `
${tab.apiTab.title}
#${tab.id}
(${tab.className})
uniqueId = <%${Constants.kPERSISTENT_ID}%>
duplicated = <%duplicated%> / <%originalTabId%> / <%originalId%>
restored = <%restored%>
tabId = ${tab.apiTab.id}
windowId = ${tab.apiTab.windowId}
`.trim();
  tab.setAttribute('title', tab.dataset.label);
  tab.uniqueId.then(uniqueId => {
    // reget it because it can be removed from document.
    tab = Tabs.getTabById(tab.apiTab);
    if (!tab)
      return;
    tab.setAttribute('title',
                     tab.dataset.label = tab.dataset.label
                       .replace(`<%${Constants.kPERSISTENT_ID}%>`, uniqueId.id)
                       .replace(`<%originalId%>`, uniqueId.originalId)
                       .replace(`<%originalTabId%>`, uniqueId.originalTabId)
                       .replace(`<%duplicated%>`, !!uniqueId.duplicated)
                       .replace(`<%restored%>`, !!uniqueId.restored));
  });
}

function reserveToUpdateMultipleHighlighted(tab) {
  const container = tab.parentNode;
  if (container.reservedUpdateMultipleHighlighted)
    clearTimeout(container.reservedUpdateMultipleHighlighted);
  container.reservedUpdateMultipleHighlighted = setTimeout(() => {
    container.reservedUpdateMultipleHighlighted = null;
    if (container.querySelectorAll(`${Tabs.kSELECTOR_LIVE_TAB}.${Constants.kTAB_STATE_HIGHLIGHTED}`).length > 1)
      container.classList.add(Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED);
    else
      container.classList.remove(Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED);
  }, 10);
}

export function updateParentTab(parent) {
  if (!Tabs.ensureLivingTab(parent))
    return;

  const children = Tabs.getChildTabs(parent);

  if (children.some(Tabs.maybeSoundPlaying))
    parent.classList.add(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
  else
    parent.classList.remove(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);

  if (children.some(Tabs.maybeMuted))
    parent.classList.add(Constants.kTAB_STATE_HAS_MUTED_MEMBER);
  else
    parent.classList.remove(Constants.kTAB_STATE_HAS_MUTED_MEMBER);

  updateParentTab(Tabs.getParentTab(parent));

  Tabs.onParentTabUpdated.dispatch(parent);
}

