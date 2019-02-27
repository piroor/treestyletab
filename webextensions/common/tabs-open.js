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
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as TabsStore from './tabs-store.js';
import * as TabsMove from './tabs-move.js';
import * as Tree from './tree.js';

import Tab from './Tab.js';

function log(...args) {
  internalLogger('common/tabs-open', ...args);
}

const SEARCH_PREFIX_MATCHER = /^about:treestyletab-search\?/;

export async function loadURI(uri, options = {}) {
  if (!options.windowId && !options.tab)
    throw new Error('missing loading target window or tab');
  if (options.inRemote) {
    await browser.runtime.sendMessage({
      uri,
      type:    Constants.kCOMMAND_LOAD_URI,
      options: Object.assign({}, options, {
        tabId: options.tab && options.tab.id,
        tab:   null
      })
    });
    return;
  }
  try {
    let tabId;
    if (options.tab) {
      tabId = options.tab.id;
    }
    else {
      const tabs = await browser.tabs.query({
        windowId: options.windowId,
        active:   true
      });
      tabId = tabs[0].id;
    }
    let searchQuery = null;
    if (SEARCH_PREFIX_MATCHER.test(uri)) {
      const query = uri.replace(SEARCH_PREFIX_MATCHER, '');
      if (browser.search &&
          typeof browser.search.search == 'function')
        searchQuery = query;
      else
        uri = configs.defaultSearchEngine.replace(/%s/gi, query);
    }
    if (searchQuery) {
      await browser.search.search({
        query: searchQuery,
        tabId
      });
    }
    else {
      await browser.tabs.update(tabId, {
        url: uri
      }).catch(ApiTabs.handleMissingTabError);
    }
  }
  catch(e) {
    ApiTabs.handleMissingTabError(e);
  }
}

export async function openNewTab(options = {}) {
  return openURIInTab(null, options);
}

export async function openURIInTab(uri, options = {}) {
  const tabs = await openURIsInTabs([uri], options);
  return tabs[0];
}

export async function openURIsInTabs(uris, options = {}) {
  log('openURIsInTabs: ', { uris, options });
  if (!options.windowId)
    throw new Error('missing loading target window\n' + new Error().stack);

  return Tab.doAndGetNewTabs(async () => {
    if (options.inRemote) {
      const ids = await browser.runtime.sendMessage(Object.assign({}, options, {
        type:           Constants.kCOMMAND_NEW_TABS,
        uris,
        parent:         null,
        parentId:       options.parent && options.parent.id,
        opener:         null,
        openerId:       options.opener && options.opener.id,
        insertBefore:   null,
        insertBeforeId: options.insertBefore && options.insertBefore.id,
        insertAfter:    null,
        insertAfterId:  options.insertAfter && options.insertAfter.id,
        cookieStoreId: options.cookieStoreId || null,
        isOrphan:      !!options.isOrphan,
        inRemote:      false
      }));
      return ids.map(id => Tab.get(id));
    }
    else {
      await TabsStore.waitUntilAllTabsAreCreated(options.windowId);
      await TabsMove.waitUntilSynchronized(options.windowId);
      const startIndex = Tab.calculateNewTabIndex(options);
      log('startIndex: ', startIndex);
      const window = TabsStore.windows.get(options.windowId);
      window.toBeOpenedTabsWithPositions += uris.length;
      if (options.isOrphan)
        window.toBeOpenedOrphanTabs += uris.length;
      return Promise.all(uris.map(async (uri, index) => {
        const params = {
          windowId: options.windowId,
          active:   index == 0 && !options.inBackground
        };
        let searchQuery = null;
        if (uri) {
          if (SEARCH_PREFIX_MATCHER.test(uri)) {
            const query = uri.replace(SEARCH_PREFIX_MATCHER, '');
            if (browser.search &&
                typeof browser.search.search == 'function')
              searchQuery = query;
            else
              params.url = configs.defaultSearchEngine.replace(/%s/gi, query);
          }
          else {
            params.url = uri;
          }
        }
        if (options.opener)
          params.openerTabId = options.opener.id;
        if (startIndex > -1)
          params.index = startIndex + index;
        if (options.cookieStoreId)
          params.cookieStoreId = options.cookieStoreId;
        // Tabs opened with different container can take time to be tracked,
        // then TabsStore.waitUntilTabsAreCreated() may be resolved before it is
        // tracked like as "the tab is already closed". So we wait until the
        // tab is correctly tracked.
        const promisedNewTabTracked = new Promise((resolve, _reject) => {
          const listener = (tab) => {
            Tab.onCreating.removeListener(listener);
            browser.tabs.get(tab.id).then(resolve);
          };
          Tab.onCreating.addListener(listener);
        });
        const createdTab = await browser.tabs.create(params);
        await Promise.all([
          promisedNewTabTracked, // TabsStore.waitUntilTabsAreCreated(createdTab.id),
          searchQuery && browser.search.search({
            query: searchQuery,
            tabId: createdTab.id
          })
        ]);
        const tab = Tab.get(createdTab.id);
        log('created tab: ', tab);
        if (!tab)
          throw new Error('tab is already closed');
        if (!options.opener &&
            options.parent &&
            !options.isOrphan)
          await Tree.attachTabTo(tab, options.parent, {
            insertBefore: options.insertBefore,
            insertAfter:  options.insertAfter,
            forceExpand:  params.active,
            broadcast:    true
          });
        else if (options.insertBefore)
          await TabsMove.moveTabInternallyBefore(tab, options.insertBefore, {
            broadcast: true
          });
        else if (options.insertAfter)
          await TabsMove.moveTabInternallyAfter(tab, options.insertAfter, {
            broadcast: true
          });
        log('tab is opened.');
        await tab.$TST.opened;
        return tab;
      }));
    }
  }, options.windowId);
}

