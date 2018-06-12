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

// Defined in a classic script source, and we can read these as global variables. 
/* global
  attachTabTo: false,
 */

import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as Tabs from './tabs.js';
import * as TabsContainer from './tabs-container.js';
import * as TabsMove from './tabs-move.js';

export async function loadURI(aURI, aOptions = {}) {
  if (!aOptions.windowId && !aOptions.tab)
    throw new Error('missing loading target window or tab');
  if (aOptions.inRemote) {
    await browser.runtime.sendMessage({
      type:    Constants.kCOMMAND_LOAD_URI,
      uri:     aURI,
      options: Object.assign({}, aOptions, {
        tab: aOptions.tab && aOptions.tab.id
      })
    });
    return;
  }
  try {
    let apiTabId;
    if (aOptions.tab) {
      apiTabId = aOptions.tab.apiTab.id;
    }
    else {
      let apiTabs = await browser.tabs.query({
        windowId: aOptions.windowId,
        active:   true
      });
      apiTabId = apiTabs[0].id;
    }
    await browser.tabs.update(apiTabId, {
      url: aURI
    }).catch(ApiTabs.handleMissingTabError);
  }
  catch(e) {
    ApiTabs.handleMissingTabError(e);
  }
}

export function openNewTab(aOptions = {}) {
  return openURIInTab(null, aOptions);
}

export async function openURIInTab(aURI, aOptions = {}) {
  const tabs = await openURIsInTabs([aURI], aOptions);
  return tabs[0];
}

export async function openURIsInTabs(aURIs, aOptions = {}) {
  if (!aOptions.windowId)
    throw new Error('missing loading target window');

  return await Tabs.doAndGetNewTabs(async () => {
    if (aOptions.inRemote) {
      await browser.runtime.sendMessage(Object.assign({}, aOptions, {
        type:          Constants.kCOMMAND_NEW_TABS,
        uris:          aURIs,
        parent:        aOptions.parent && aOptions.parent.id,
        opener:        aOptions.opener && aOptions.opener.id,
        insertBefore:  aOptions.insertBefore && aOptions.insertBefore.id,
        insertAfter:   aOptions.insertAfter && aOptions.insertAfter.id,
        cookieStoreId: aOptions.cookieStoreId || null,
        isOrphan:      !!aOptions.isOrphan,
        inRemote:      false
      }));
    }
    else {
      await Tabs.waitUntilAllTabsAreCreated();
      let startIndex = Tabs.calculateNewTabIndex(aOptions);
      let container  = Tabs.getTabsContainer(aOptions.windowId);
      TabsContainer.incrementCounter(container, 'toBeOpenedTabsWithPositions', aURIs.length);
      if (aOptions.isOrphan)
        TabsContainer.incrementCounter(container, 'toBeOpenedOrphanTabs', aURIs.length);
      await Promise.all(aURIs.map(async (aURI, aIndex) => {
        const params = {
          windowId: aOptions.windowId,
          active:   aIndex == 0 && !aOptions.inBackground
        };
        if (aURI)
          params.url = aURI;
        if (aOptions.opener)
          params.openerTabId = aOptions.opener.apiTab.id;
        if (startIndex > -1)
          params.index = startIndex + aIndex;
        if (aOptions.cookieStoreId)
          params.cookieStoreId = aOptions.cookieStoreId;
        const apiTab = await browser.tabs.create(params);
        await Tabs.waitUntilTabsAreCreated(apiTab.id);
        const tab = Tabs.getTabById(apiTab);
        if (!tab)
          throw new Error('tab is already closed');
        if (!aOptions.opener &&
            aOptions.parent &&
            !aOptions.isOrphan)
          await attachTabTo(tab, aOptions.parent, {
            insertBefore: aOptions.insertBefore,
            insertAfter:  aOptions.insertAfter,
            forceExpand:  params.active,
            broadcast:    true
          });
        else if (aOptions.insertBefore)
          await TabsMove.moveTabInternallyBefore(tab, aOptions.insertBefore, {
            broadcast: true
          });
        else if (aOptions.insertAfter)
          await TabsMove.moveTabInternallyAfter(tab, aOptions.insertAfter, {
            broadcast: true
          });
        return tab.opened;
      }));
    }
  });
}


/* group tab */

export function makeGroupTabURI(aOptions = {}) {
  const base = Constants.kGROUP_TAB_URI;
  const title = encodeURIComponent(aOptions.title || '');
  const temporaryOption = aOptions.temporary ? '&temporary=true' : '' ;
  const openerTabIdOption = aOptions.openerTabId ? `&openerTabId=${aOptions.openerTabId}` : '' ;
  return `${base}?title=${title}${temporaryOption}${openerTabIdOption}`;
}

