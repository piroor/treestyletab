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

import TabFavIconHelper from '../external/TabFavIconHelper.js';

import {
  log,
  wait,
  configs
} from './common.js';

import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as Tabs from './tabs.js';
import * as ContextualIdentities from './contextual-identities.js';

export function updateTab(aTab, aNewState = {}, aOptions = {}) {
  if ('url' in aNewState) {
    aTab.setAttribute(Constants.kCURRENT_URI, aNewState.url);
    if (aTab.dataset.discardURLAfterCompletelyLoaded &&
        aTab.dataset.discardURLAfterCompletelyLoaded != aNewState.url)
      delete aTab.dataset.discardURLAfterCompletelyLoaded;
  }

  // Loading of "about:(unknown type)" won't report new URL via tabs.onUpdated,
  // so we need to see the complete tab object.
  if (aOptions.tab && Constants.kSHORTHAND_ABOUT_URI.test(aOptions.tab.url)) {
    const shorthand = RegExp.$1;
    wait(0).then(() => { // redirect with delay to avoid infinite loop of recursive redirections.
      browser.tabs.update(aOptions.tab.id, {
        url: aOptions.tab.url.replace(Constants.kSHORTHAND_ABOUT_URI, Constants.kSHORTHAND_URIS[shorthand] || 'about:blank')
      }).catch(ApiTabs.handleMissingTabError);
      aTab.classList.add(Constants.kTAB_STATE_GROUP_TAB);
      Tabs.addSpecialTabState(aTab, Constants.kTAB_STATE_GROUP_TAB);
    });
    return;
  }
  else if ('url' in aNewState &&
           aNewState.url.indexOf(Constants.kGROUP_TAB_URI) == 0) {
    aTab.classList.add(Constants.kTAB_STATE_GROUP_TAB);
    Tabs.addSpecialTabState(aTab, Constants.kTAB_STATE_GROUP_TAB);
    Tabs.onGroupTabDetected.dispatch(aTab);
  }
  else if (aTab.apiTab &&
           aTab.apiTab.status == 'complete' &&
           aTab.apiTab.url.indexOf(Constants.kGROUP_TAB_URI) != 0) {
    Tabs.getSpecialTabState(aTab).then(async (aStates) => {
      if (aTab.apiTab.url.indexOf(Constants.kGROUP_TAB_URI) == 0)
        return;
      // Detect group tab from different session - which can have different UUID for the URL.
      const PREFIX_REMOVER = /^moz-extension:\/\/[^\/]+/;
      const pathPart = aTab.apiTab.url.replace(PREFIX_REMOVER, '');
      if (aStates.indexOf(Constants.kTAB_STATE_GROUP_TAB) > -1 &&
          pathPart.split('?')[0] == Constants.kGROUP_TAB_URI.replace(PREFIX_REMOVER, '')) {
        const parameters = pathPart.replace(/^[^\?]+\?/, '');
        await wait(100); // for safety
        browser.tabs.update(aTab.apiTab.id, {
          url: `${Constants.kGROUP_TAB_URI}?${parameters}`
        }).catch(ApiTabs.handleMissingTabError);
        aTab.classList.add(Constants.kTAB_STATE_GROUP_TAB);
      }
      else {
        Tabs.removeSpecialTabState(aTab, Constants.kTAB_STATE_GROUP_TAB);
        aTab.classList.remove(Constants.kTAB_STATE_GROUP_TAB);
      }
    });
  }

  if (aOptions.forceApply ||
      'title' in aNewState) {
    let visibleLabel = aNewState.title;
    if (aNewState && aNewState.cookieStoreId) {
      const identity = ContextualIdentities.get(aNewState.cookieStoreId);
      if (identity)
        visibleLabel = `${aNewState.title} - ${identity.name}`;
    }
    if (aOptions.forceApply && aTab.apiTab) {
      browser.sessions.getTabValue(aTab.apiTab.id, Constants.kTAB_STATE_UNREAD)
        .then(aUnread => {
          if (aUnread)
            aTab.classList.add(Constants.kTAB_STATE_UNREAD);
          else
            aTab.classList.remove(Constants.kTAB_STATE_UNREAD);
        });
    }
    else if (!Tabs.isActive(aTab) && aTab.apiTab) {
      aTab.classList.add(Constants.kTAB_STATE_UNREAD);
      browser.sessions.setTabValue(aTab.apiTab.id, Constants.kTAB_STATE_UNREAD, true);
    }
    Tabs.getTabLabelContent(aTab).textContent = aNewState.title;
    aTab.dataset.label = visibleLabel;
    Tabs.onLabelUpdated.dispatch(aTab);
  }

  const openerOfGroupTab = Tabs.isGroupTab(aTab) && Tabs.getOpenerFromGroupTab(aTab);
  const hasFavIcon       = 'favIconUrl' in aNewState;
  const maybeImageTab    = !hasFavIcon && TabFavIconHelper.maybeImageTab(aNewState);
  if (aOptions.forceApply || hasFavIcon || maybeImageTab) {
    Tabs.onFaviconUpdated.dispatch(
      aTab,
      Tabs.getSafeFaviconUrl(aNewState.favIconUrl ||
                             maybeImageTab && aNewState.url)
    );
  }
  else if (openerOfGroupTab &&
           (openerOfGroupTab.apiTab.favIconUrl ||
            TabFavIconHelper.maybeImageTab(openerOfGroupTab.apiTab))) {
    Tabs.onFaviconUpdated.dispatch(
      aTab,
      Tabs.getSafeFaviconUrl(openerOfGroupTab.apiTab.favIconUrl ||
                             openerOfGroupTab.apiTab.url)
    );
  }

  if ('status' in aNewState) {
    const reallyChanged = !aTab.classList.contains(aNewState.status);
    aTab.classList.remove(aNewState.status == 'loading' ? 'complete' : 'loading');
    aTab.classList.add(aNewState.status);
    if (aNewState.status == 'loading') {
      aTab.classList.remove(Constants.kTAB_STATE_BURSTING);
    }
    else if (!aOptions.forceApply && reallyChanged) {
      aTab.classList.add(Constants.kTAB_STATE_BURSTING);
      if (aTab.delayedBurstEnd)
        clearTimeout(aTab.delayedBurstEnd);
      aTab.delayedBurstEnd = setTimeout(() => {
        delete aTab.delayedBurstEnd;
        aTab.classList.remove(Constants.kTAB_STATE_BURSTING);
        if (!Tabs.isActive(aTab))
          aTab.classList.add(Constants.kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD);
      }, configs.burstDuration);
    }
    if (aNewState.status == 'complete' &&
        aTab.apiTab &&
        aTab.apiTab.url == aTab.dataset.discardURLAfterCompletelyLoaded) {
      if (configs.autoDiscardTabForUnexpectedFocus) {
        log(' => discard accidentally restored tab ', aTab.apiTab.id);
        if (typeof browser.tabs.discard == 'function')
          browser.tabs.discard(aTab.apiTab.id);
      }
      delete aTab.dataset.discardURLAfterCompletelyLoaded;
    }
    Tabs.onStateChanged.dispatch(aTab);
  }

  if ((aOptions.forceApply ||
       'pinned' in aNewState) &&
      aNewState.pinned != aTab.classList.contains(Constants.kTAB_STATE_PINNED)) {
    if (aNewState.pinned) {
      aTab.classList.add(Constants.kTAB_STATE_PINNED);
      aTab.removeAttribute(Constants.kLEVEL); // don't indent pinned tabs!
      Tabs.onPinned.dispatch(aTab);
    }
    else {
      aTab.classList.remove(Constants.kTAB_STATE_PINNED);
      Tabs.onUnpinned.dispatch(aTab);
    }
  }

  if (aOptions.forceApply ||
      'audible' in aNewState) {
    if (aNewState.audible)
      aTab.classList.add(Constants.kTAB_STATE_AUDIBLE);
    else
      aTab.classList.remove(Constants.kTAB_STATE_AUDIBLE);
  }

  if (aOptions.forceApply ||
      'mutedInfo' in aNewState) {
    if (aNewState.mutedInfo && aNewState.mutedInfo.muted)
      aTab.classList.add(Constants.kTAB_STATE_MUTED);
    else
      aTab.classList.remove(Constants.kTAB_STATE_MUTED);
  }

  if (aTab.apiTab &&
      aTab.apiTab.audible &&
      !aTab.apiTab.mutedInfo.muted)
    aTab.classList.add(Constants.kTAB_STATE_SOUND_PLAYING);
  else
    aTab.classList.remove(Constants.kTAB_STATE_SOUND_PLAYING);

  /*
  // On Firefox, "highlighted" is same to "activated" for now...
  // https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/tabs/onHighlighted
  if (aOptions.forceApply ||
      'highlighted' in aNewState) {
    if (aNewState.highlighted)
      aTab.classList.add(Constants.kTAB_STATE_HIGHLIGHTED);
    else
      aTab.classList.remove(Constants.kTAB_STATE_HIGHLIGHTED);
  }
  */

  if (aOptions.forceApply ||
      'cookieStoreId' in aNewState) {
    for (const className of aTab.classList) {
      if (className.indexOf('contextual-identity-') == 0)
        aTab.classList.remove(className);
    }
    if (aNewState.cookieStoreId)
      aTab.classList.add(`contextual-identity-${aNewState.cookieStoreId}`);
  }

  if (aOptions.forceApply ||
      'incognito' in aNewState) {
    if (aNewState.incognito)
      aTab.classList.add(Constants.kTAB_STATE_PRIVATE_BROWSING);
    else
      aTab.classList.remove(Constants.kTAB_STATE_PRIVATE_BROWSING);
  }

  if (aOptions.forceApply ||
      'hidden' in aNewState) {
    if (aNewState.hidden) {
      if (!aTab.classList.contains(Constants.kTAB_STATE_HIDDEN)) {
        aTab.classList.add(Constants.kTAB_STATE_HIDDEN);
        Tabs.onHidden.dispatch(aTab);
      }
    }
    else if (aTab.classList.contains(Constants.kTAB_STATE_HIDDEN)) {
      aTab.classList.remove(Constants.kTAB_STATE_HIDDEN);
      Tabs.onShown.dispatch(aTab);
    }
  }

  /*
  // currently "selected" is not available on Firefox, so the class is used only by other addons.
  if (aOptions.forceApply ||
      'selected' in aNewState) {
    if (aNewState.selected)
      aTab.classList.add(Constants.kTAB_STATE_SELECTED);
    else
      aTab.classList.remove(Constants.kTAB_STATE_SELECTED);
  }
  */

  if (aOptions.forceApply ||
      'discarded' in aNewState) {
    wait(0).then(() => {
      // Don't set this class immediately, because we need to know
      // the newly focused tab *was* discarded on onTabClosed handler.
      if (aNewState.discarded)
        aTab.classList.add(Constants.kTAB_STATE_DISCARDED);
      else
        aTab.classList.remove(Constants.kTAB_STATE_DISCARDED);
    });
  }

  updateTabDebugTooltip(aTab);
}

export function updateTabDebugTooltip(aTab) {
  if (!configs.debug ||
      !aTab.apiTab)
    return;
  aTab.dataset.label = `
${aTab.apiTab.title}
#${aTab.id}
(${aTab.className})
uniqueId = <%${Constants.kPERSISTENT_ID}%>
duplicated = <%duplicated%> / <%originalTabId%> / <%originalId%>
restored = <%restored%>
tabId = ${aTab.apiTab.id}
windowId = ${aTab.apiTab.windowId}
`.trim();
  aTab.setAttribute('title', aTab.dataset.label);
  aTab.uniqueId.then(aUniqueId => {
    // reget it because it can be removed from document.
    aTab = Tabs.getTabById(aTab.apiTab);
    if (!aTab)
      return;
    aTab.setAttribute('title',
                      aTab.dataset.label = aTab.dataset.label
                        .replace(`<%${Constants.kPERSISTENT_ID}%>`, aUniqueId.id)
                        .replace(`<%originalId%>`, aUniqueId.originalId)
                        .replace(`<%originalTabId%>`, aUniqueId.originalTabId)
                        .replace(`<%duplicated%>`, !!aUniqueId.duplicated)
                        .replace(`<%restored%>`, !!aUniqueId.restored));
  });
}

export function updateParentTab(aParent) {
  if (!Tabs.ensureLivingTab(aParent))
    return;

  var children = Tabs.getChildTabs(aParent);

  if (children.some(Tabs.maybeSoundPlaying))
    aParent.classList.add(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);
  else
    aParent.classList.remove(Constants.kTAB_STATE_HAS_SOUND_PLAYING_MEMBER);

  if (children.some(Tabs.maybeMuted))
    aParent.classList.add(Constants.kTAB_STATE_HAS_MUTED_MEMBER);
  else
    aParent.classList.remove(Constants.kTAB_STATE_HAS_MUTED_MEMBER);

  updateParentTab(Tabs.getParentTab(aParent));

  Tabs.onParentTabUpdated.dispatch(aParent);
}

