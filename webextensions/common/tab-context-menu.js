/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  notify,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as Tabs from './tabs.js';
import * as TabsOpen from './tabs-open.js';
import * as Tree from './tree.js';
import * as Bookmark from './bookmark.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/tab-context-menu', ...args);
}

export const onTabsClosing = new EventListenerManager();

export async function onCommand(params = {}) {
  const event = params.event;
  if (event.button == 1)
    return false;

  const item = params.item;
  const contextTab = params.tab;
  const contextWindowId = params.windowId;

  const isMultiselected   = Tabs.isMultiselected(Tabs.getTabById(contextTab));
  const multiselectedTabs = isMultiselected && Tabs.getSelectedTabs();

  switch (item.id) {
    case 'context_reloadTab':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.reload(tab.apiTab.id);
        }
      }
      else {
        browser.tabs.reload(contextTab.id);
      }
      return true;
    case 'context_toggleMuteTab-mute':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.apiTab.id, { muted: true });
        }
      }
      else {
        browser.tabs.update(contextTab.id, { muted: true });
      }
      return true;
    case 'context_toggleMuteTab-unmute':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.apiTab.id, { muted: false });
        }
      }
      else {
        browser.tabs.update(contextTab.id, { muted: false });
      }
      return true;
    case 'context_pinTab':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.apiTab.id, { pinned: true });
        }
      }
      else {
        browser.tabs.update(contextTab.id, { pinned: true });
      }
      return true;
    case 'context_unpinTab':
      if (multiselectedTabs) {
        for (const tab of multiselectedTabs) {
          browser.tabs.update(tab.apiTab.id, { pinned: false });
        }
      }
      else {
        browser.tabs.update(contextTab.id, { pinned: false });
      }
      return true;
    case 'context_duplicateTab':
      /*
        Due to difference between Firefox's "duplicate tab" implementation,
        TST sometimes fails to detect duplicated tabs based on its
        session information. Thus we need to duplicate as an internally
        duplicated tab. For more details, see also:
        https://github.com/piroor/treestyletab/issues/1437#issuecomment-334952194
      */
      // browser.tabs.duplicate(contextTab.id);
      return (async () => {
        const sourceTab = Tabs.getTabById(contextTab);
        log('source tab: ', sourceTab, !!sourceTab.apiTab);
        const duplicatedTabs = await Tree.moveTabs([sourceTab], {
          duplicate:           true,
          destinationWindowId: contextWindowId,
          insertAfter:         sourceTab,
          inRemote:            true
        });
        Tree.behaveAutoAttachedTab(duplicatedTabs[0], {
          baseTab:  sourceTab,
          behavior: configs.autoAttachOnDuplicated,
          inRemote: true
        });
      })();
    case 'context_openTabInWindow':
      if (multiselectedTabs) {
        Tree.openNewWindowFromTabs(multiselectedTabs, {
          inRemote:  true
        });
      }
      else {
        await browser.windows.create({
          tabId:     contextTab.id,
          incognito: contextTab.incognito
        });
      }
      return true;
    case 'context_reloadAllTabs': {
      const apiTabs = await browser.tabs.query({ windowId: contextWindowId });
      for (const apiTab of apiTabs) {
        browser.tabs.reload(apiTab.id);
      }
    }; return true;
    case 'context_selectAllTabs': {
      const apiTabs = await browser.tabs.query({ windowId: contextWindowId });
      browser.tabs.highlight({
        windowId: contextWindowId,
        tabs: apiTabs.map(tab => tab.index)
      });
    }; return true;
    case 'context_bookmarkTab':
      if (!multiselectedTabs) {
        await Bookmark.bookmarkTab(Tabs.getTabById(contextTab));
        return true;
      }
    case 'context_bookmarkAllTabs': {
      const apiTabs = multiselectedTabs ?
        multiselectedTabs.map(tab => tab.apiTab) :
        await browser.tabs.query({ windowId: contextWindowId }) ;
      const folder = await Bookmark.bookmarkTabs(apiTabs.map(Tabs.getTabById));
      if (folder)
        browser.bookmarks.get(folder.parentId).then(folders => {
          notify({
            title:   browser.i18n.getMessage('bookmarkTabs_notification_success_title'),
            message: browser.i18n.getMessage('bookmarkTabs_notification_success_message', [
              apiTabs[0].title,
              apiTabs.length,
              folders[0].title
            ]),
            icon:    Constants.kNOTIFICATION_DEFAULT_ICON
          });
        });
    }; return true;
    case 'context_closeTabsToTheEnd': {
      const apiTabs = await browser.tabs.query({ windowId: contextWindowId });
      let after = false;
      const closeAPITabs = [];
      const keptTabIds = multiselectedTabs ?
        multiselectedTabs.map(tab => tab.apiTab.id) :
        [contextTab.id] ;
      for (const apiTab of apiTabs) {
        if (keptTabIds.includes(apiTab.id)) {
          after = true;
          continue;
        }
        if (after && !apiTab.pinned)
          closeAPITabs.push(apiTab);
      }
      const canceled = (await onTabsClosing.dispatch(closeAPITabs.length, { windowId: contextWindowId })) === false;
      if (canceled)
        return;
      browser.tabs.remove(closeAPITabs.map(aPITab => aPITab.id));
    }; return true;
    case 'context_closeOtherTabs': {
      const apiTabs  = await browser.tabs.query({ windowId: contextWindowId });
      const keptTabIds = multiselectedTabs ?
        multiselectedTabs.map(tab => tab.apiTab.id) :
        [contextTab.id] ;
      const closeAPITabs = apiTabs.filter(aPITab => !aPITab.pinned && !keptTabIds.includes(aPITab.id)).map(aPITab => aPITab.id);
      const canceled = (await onTabsClosing.dispatch(closeAPITabs.length, { windowId: contextWindowId })) === false;
      if (canceled)
        return;
      browser.tabs.remove(closeAPITabs);
    }; return true;
    case 'context_undoCloseTab': {
      const sessions = await browser.sessions.getRecentlyClosed({ maxResults: 1 });
      if (sessions.length && sessions[0].tab)
        browser.sessions.restore(sessions[0].tab.sessionId);
    }; return true;
    case 'context_closeTab':
      if (multiselectedTabs) {
        // close down to top, to keep tree structure of Tree Style Tab
        multiselectedTabs.reverse();
        for (const tab of multiselectedTabs) {
          browser.tabs.remove(tab.apiTab.id);
        }
      }
      else {
        browser.tabs.remove(contextTab.id);
      }
      return true;

    default: {
      const contextualIdentityMatch = item.id.match(/^context_reopenInContainer:(.+)$/);
      if (contextTab &&
          contextualIdentityMatch) {
        // Open in Container
        const contextTabElement = Tabs.getTabById(contextTab);
        const tab = await TabsOpen.openURIInTab(contextTab.url, {
          windowId:      contextTab.windowId,
          cookieStoreId: contextualIdentityMatch[1]
        });
        Tree.behaveAutoAttachedTab(tab, {
          baseTab:  contextTabElement,
          behavior: configs.autoAttachOnDuplicated,
          inRemote: true
        });
        return true;
      }
    }; break;
  }
  return false;
}

