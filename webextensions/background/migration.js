/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as Permissions from '/common/permissions.js';

import ShortcutCustomizeUI from '/extlib/ShortcutCustomizeUI.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('background/migration', ...args);
}

const kCONFIGS_VERSION = 9;
const kFEATURES_VERSION = 4;

export function migrateConfigs() {
  switch (configs.configsVersion) {
    case 0:
      ShortcutCustomizeUI.setDefaultShortcuts();

    case 1:
      configs.longPressDuration = configs.startDragTimeout;
      configs.emulateDefaultContextMenu = configs.emulateDefaultContextMenu;

    case 2:
      if (!configs.simulateSelectOwnerOnClose)
        configs.successorTabControlLevel = Constants.kSUCCESSOR_TAB_CONTROL_NEVER;

    case 3:
      if (!(configs.tabDragBehavior & Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK))
        configs.tabDragBehavior |= Constants.kDRAG_BEHAVIOR_TEAR_OFF;
      if (!(configs.tabDragBehaviorShift & Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK))
        configs.tabDragBehaviorShift |= Constants.kDRAG_BEHAVIOR_TEAR_OFF;

    case 4:
      configs.emulateDefaultContextMenu = true; // activate by default
      configs.context_topLevel_closeTree        = configs.context_closeTabOptions_closeTree;
      configs.context_topLevel_closeDescendants = configs.context_closeTabOptions_closeDescendants;
      configs.context_topLevel_closeOthers      = configs.context_closeTabOptions_closeOthers;

    case 5:
      switch (configs.scrollbarMode < 0 ? (/^Mac/i.test(navigator.platform) ? 3 : 1) : configs.scrollbarMode) {
        case 0: // default, refular width
          configs.userStyleRules += `

/* regular width scrollbar */
#tabbar { scrollbar-width: auto; }`;
          break;
        case 1: // narrow width
          break;
        case 2: // hide
          configs.userStyleRules += `

/* hide scrollbar */
#tabbar { scrollbar-width: none; }

/* cancel spaces for macOS overlay scrollbar */
:root.platform-mac #tabbar:dir(rtl).overflow .tab:not(.pinned) {
  padding-left: 0;
}
:root.platform-mac #tabbar:dir(ltr).overflow .tab:not(.pinned) {
  padding-right: 0;
}`;
          break;
        case 3: // overlay (macOS)
          break;
      }
      switch (configs.sidebarScrollbarPosition) {
        default:
        case 0: // auto
        case 1: // left
          break;
          break;
        case 2: // right
          configs.userStyleRules += `

/* put scrollbar rightside */
:root.left #tabbar { direction: ltr; }`;
          break;
      }

    case 6:
      if (configs.promoteFirstChildForClosedRoot &&
          configs.closeParentBehavior == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN)
        configs.closeParentBehavior = Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_INTELLIGENTLY;
      switch (configs.parentTabBehaviorForChanges) {
        case Constants.kPARENT_TAB_BEHAVIOR_ALWAYS:
          configs.closeParentBehaviorMode = Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITHOUT_NATIVE_TABBAR;
          break;
        default:
        case Constants.kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE:
          configs.closeParentBehaviorMode = Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITH_NATIVE_TABBAR;
          break;
        case Constants.kPARENT_TAB_BEHAVIOR_ONLY_ON_SIDEBAR:
          configs.closeParentBehaviorMode = Constants.kCLOSE_PARENT_BEHAVIOR_MODE_CUSTOM;
          configs.closeParentBehavior_outsideSidebar = configs.closeParentBehavior_noSidebar = configs.closeParentBehavior;
          break;
      }

    case 7:
      if (configs.collapseExpandSubtreeByDblClick)
        configs.treeDoubleClickBehavior = Constants.kTREE_DOUBLE_CLICK_BEHAVIOR_TOGGLE_COLLAPSED;

    case 8:
      if (!configs.autoExpandOnCollapsedChildActive)
        configs.guardToFocusCollapsedTab = configs.autoExpandOnCollapsedChildActive;
  }
  configs.configsVersion = kCONFIGS_VERSION;
}

export async function notifyNewFeatures() {
  /*
  let featuresVersionOffset = 0;
  const browserInfo = await browser.runtime.getBrowserInfo().catch(ApiTabs.createErrorHandler());
  // "search" permission becomes available!
  if (parseInt(browserInfo.version.split('.')[0]) >= 63)
    featuresVersionOffset++;
  // "menus.overrideContext" permission becomes available!
  if (parseInt(browserInfo.version.split('.')[0]) >= 64)
    featuresVersionOffset++;
  */

  const featuresVersion = kFEATURES_VERSION /*+ featuresVersionOffset*/;

  if (configs.notifiedFeaturesVersion >= featuresVersion)
    return;
  configs.notifiedFeaturesVersion = featuresVersion;

  return browser.tabs.create({
    url:    Constants.kSHORTHAND_URIS.startup,
    active: true
  }).catch(ApiTabs.createErrorSuppressor());
}


// Auto-migration of bookmarked internal URLs
//
// Internal URLs like "moz-extension://(UUID)/..." are runtime environment
// dependent and unavailable when such bookmarks are loaded in different
// runtime environment, for example they are synchronized from other devices.
// Thus we should migrate such internal URLs to universal shorthand URIs like
// "ext+treestyletab:(name)".

export async function migrateBookmarkUrls() {
  const granted = await Permissions.isGranted(Permissions.BOOKMARKS);
  if (!granted)
    return;

  startBookmarksUrlAutoMigration();

  const urls = new Set(configs.migratedBookmarkUrls);
  const migrations = [];
  const updates = [];
  for (const key in Constants.kSHORTHAND_URIS) {
    const url = Constants.kSHORTHAND_URIS[key].split('?')[0];
    if (urls.has(url))
      continue;

    const shorthand = `ext+treestyletab:${key.toLowerCase()}`;
    migrations.push(browser.bookmarks.search({ query: url })
      .then(bookmarks => {
        for (const bookmark of bookmarks) {
          updates.push(browser.bookmarks.update(bookmark.id, {
            url: bookmark.url.replace(url, shorthand)
          }));
        }
      }));
    urls.add(url);
  }
  if (migrations.length > 0)
    await Promise.all(migrations);
  if (updates.length > 0)
    await Promise.all(updates);
  if (urls.size > configs.migratedBookmarkUrls.length)
    configs.migratedBookmarkUrls = Array.from(urls);
}

async function migrateBookmarkUrl(bookmark) {
  for (const key in Constants.kSHORTHAND_URIS) {
    const url = Constants.kSHORTHAND_URIS[key].split('?')[0];
    if (!bookmark.url.startsWith(url))
      continue;

    const shorthand = `ext+treestyletab:${key.toLowerCase()}`;
    return browser.bookmarks.update(bookmark.id, {
      url: bookmark.url.replace(url, shorthand)
    });
  }
}

let mObservingBookmarks = false;

async function startBookmarksUrlAutoMigration() {
  if (mObservingBookmarks)
    return;

  mObservingBookmarks = true;

  browser.bookmarks.onCreated.addListener((id, bookmark) => {
    if (bookmark.url)
      migrateBookmarkUrl(bookmark);
  });

  browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
    if (changeInfo.url &&
        changeInfo.url.startsWith(browser.extension.getURL(''))) {
      const bookmark = await browser.bookmarks.get(id);
      if (Array.isArray(bookmark))
        bookmark.forEach(migrateBookmarkUrl);
      else
        migrateBookmarkUrl(bookmark);
    }
  });
}
