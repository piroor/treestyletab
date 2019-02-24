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
import * as ApiTabs from './api-tabs.js';
import * as Tabs from './tabs.js';
import * as TabsOpen from './tabs-open.js';
import * as TabsInternalOperation from './tabs-internal-operation.js';
import * as Tree from './tree.js';
import ShortcutCustomizeUI from '/extlib/ShortcutCustomizeUI.js';

function log(...args) {
  internalLogger('common/migration', ...args);
}

export const kLEGACY_CONFIGS_MIGRATION_VERSION = 3;
const kCONFIGS_VERSION = 3;
const kFEATURES_VERSION = 3;

export function migrateLegacyConfigs() {
  const values = configs.importedConfigsFromLegacy;
  if (!values ||
      typeof values != 'object')
    return;

  try {

    let migrated = false;
    switch (configs.legacyConfigsNextMigrationVersion) {
      case 0:
      case 1:
        // appearance
        migrateLegacyConfig('style', values['extensions.treestyletab.tabbar.style']);
        migrateLegacyConfig('defaultStyle', values['extensions.treestyletab.platform.default.tabbar.style']);
        migrateLegacyConfig('defaultStyleOnDarwin', values['extensions.treestyletab.platform.default.tabbar.style']);
        migrateLegacyConfig('defaultStyleOnLinux', values['extensions.treestyletab.platform.Linux.tabbar.style']);

        migrateLegacyConfig('faviconizePinnedTabs', values['extensions.treestyletab.pinnedTab.faviconized']);

        migrateLegacyConfig('counterRole', values['extensions.treestyletab.counter.role.vertical']);

        migrateLegacyConfig('baseIndent', values['extensions.treestyletab.indent.vertical']);
        migrateLegacyConfig('minIndent', values['extensions.treestyletab.indent.min.vertical']);
        migrateLegacyConfig('maxTreeLevel', values['extensions.treestyletab.maxTreeLevel.vertical']);
        migrateLegacyConfig('indentAutoShrink', values['extensions.treestyletab.indent.autoShrink']);
        migrateLegacyConfig('indentAutoShrinkOnlyForVisible', values['extensions.treestyletab.indent.autoShrink.onlyForVisible']);

        // context menu
        migrateLegacyConfig('context_reloadTree', values['extensions.treestyletab.show.context-item-reloadTabSubtree']);
        migrateLegacyConfig('context_reloadDescendants', values['extensions.treestyletab.show.context-item-reloadDescendantTabs']);
        migrateLegacyConfig('context_closeTree', values['extensions.treestyletab.show.context-item-removeTabSubtree']);
        migrateLegacyConfig('context_closeDescendants', values['extensions.treestyletab.show.context-item-removeDescendantTabs']);
        migrateLegacyConfig('context_closeOthers', values['extensions.treestyletab.show.context-item-removeAllTabsButThisTree']);
        migrateLegacyConfig('context_collapseAll', values['extensions.treestyletab.show.context-item-collapseAllSubtree']);
        migrateLegacyConfig('context_expandAll', values['extensions.treestyletab.show.context-item-expandAllSubtree']);
        migrateLegacyConfig('context_bookmarkTree', values['extensions.treestyletab.show.context-item-bookmarkTabSubtree']);

        // tree behavior
        migrateLegacyConfig('shouldDetectClickOnIndentSpaces', values['extensions.treestyletab.clickOnIndentSpaces.enabled']);

        migrateLegacyConfig('autoCollapseExpandSubtreeOnAttach', values['extensions.treestyletab.autoCollapseExpandSubtreeOnAttach']);
        migrateLegacyConfig('autoCollapseExpandSubtreeOnSelect', values['extensions.treestyletab.autoCollapseExpandSubtreeOnSelect']);
        migrateLegacyConfig('autoCollapseExpandSubtreeOnSelectExceptActiveTabRemove', !values['extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.onActiveTabRemove']);

        migrateLegacyConfig('autoExpandIntelligently', values['extensions.treestyletab.autoExpand.intelligently']);
        migrateLegacyConfig('autoExpandOnCollapsedChildActive', values['extensions.treestyletab.autoExpandSubtreeOnCollapsedChildActive']);
        migrateLegacyConfig('autoExpandOnLongHover', values['extensions.treestyletab.autoExpand.enabled']);
        migrateLegacyConfig('autoExpandOnLongHoverDelay', values['extensions.treestyletab.autoExpand.delay']);
        migrateLegacyConfig('autoExpandOnLongHoverRestoreIniitalState', values['extensions.treestyletab.autoExpand.collapseFinally']);

        // behavior around newly opened tabs
        migrateLegacyConfig('insertNewChildAt', values['extensions.treestyletab.insertNewChildAt']);

        migrateLegacyConfig('scrollToNewTabMode', values['extensions.treestyletab.tabbar.scrollToNewTab.mode']);

        migrateLegacyConfig('autoAttach', values['extensions.treestyletab.autoAttach']);
        migrateLegacyConfig('autoAttachOnOpenedWithOwner', values['extensions.treestyletab.autoAttach.fromCurrent']);
        migrateLegacyConfig('autoAttachOnNewTabCommand', values['extensions.treestyletab.autoAttach.newTabCommand']);
        migrateLegacyConfig('autoAttachOnNewTabButtonMiddleClick', values['extensions.treestyletab.autoAttach.newTabButton']);
        migrateLegacyConfig('autoAttachOnDuplicated', values['extensions.treestyletab.autoAttach.duplicateTabCommand']);

        // behavior around closed tab
        migrateLegacyConfig('closeParentBehavior', values['extensions.treestyletab.closeParentBehavior']);
        migrateLegacyConfig('promoteFirstChildForClosedRoot', values['extensions.treestyletab.closeRootBehavior'] == Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD);
        migrateLegacyConfig('moveTabsToBottomWhenDetachedFromClosedParent', values['extensions.treestyletab.closeParentBehavior.moveDetachedTabsToBottom']);
        migrateLegacyConfig('promoteAllChildrenWhenClosedParentIsLastChild', values['extensions.treestyletab.closeParentBehavior.promoteAllChildrenWhenParentIsLastChild']);

        // animation
        migrateLegacyConfig('smoothScrollEnabled', values['extensions.treestyletab.tabbar.scroll.smooth']);
        migrateLegacyConfig('smoothScrollDuration', values['extensions.treestyletab.tabbar.scroll.duration']);
        migrateLegacyConfig('indentDuration', values['extensions.treestyletab.animation.indent.duration']);
        migrateLegacyConfig('collapseDuration', values['extensions.treestyletab.animation.collapse.duration']);

      case 2:
        migrateLegacyConfig('collapseExpandSubtreeByDblClick', values['extensions.treestyletab.collapseExpandSubtree.dblclick']);

      case 3:
        migrateLegacyConfig('scrollbarMode', values['extensions.treestyletab.tabbar.narrowScrollbar'] ? Constants.kTABBAR_SCROLLBAR_MODE_NARROW : Constants.kTABBAR_SCROLLBAR_MODE_DEFAULT);
        migrateLegacyConfig('narrowScrollbarSize', values['extensions.treestyletab.tabbar.narrowScrollbar.width']);

        // case 4:
        // case 5:
        migrated = true;

      default:
        break;
    }

    if (migrated)
      notify({
        title:   browser.i18n.getMessage('migration_configs_notification_title'),
        message: browser.i18n.getMessage('migration_configs_notification_message'),
        icon:    Constants.kNOTIFICATION_DEFAULT_ICON,
        timeout: -1
      });

  }
  catch(e) {
    log('failed to migrate tree: ', String(e), e.stack);
    notify({
      title:   browser.i18n.getMessage('migration_configsFailed_notification_title'),
      message: `${browser.i18n.getMessage('migration_configsFailed_notification_message')}\n${String(e)}`,
      icon:    Constants.kNOTIFICATION_DEFAULT_ICON,
      timeout: -1
    });
  }

  configs.legacyConfigsNextMigrationVersion = kLEGACY_CONFIGS_MIGRATION_VERSION + 1;
}

function migrateLegacyConfig(key, value) {
  if (value === undefined)
    return;
  configs[key] = value;
}

export async function migrateLegacyTreeStructure() {
  const structures = configs.importedTreeStructureFromLegacy;
  if (!structures ||
      !Array.isArray(structures) ||
      !configs.migrateLegacyTreeStructure)
    return;

  /*
    Expected format of the "structures":
    [ // top level: array of windows
      [ // second level: array of tabs
        { title:     "Example.com",
          url:       "http://www.example.com/",
          pinned:    true },
        { title:     "Example.net",
          url:       "http://www.example.net/",
          pinned:    false,
          parent:    -1,
          collapsed: false },
        { title:     "Example.jp",
          url:       "http://www.example.jp/",
          pinned:    false,
          parent:    0,
          collapsed: false }
      ],
      [...],
      [...]
    ]
    "parent" and "collapsed" are compatible to the format of
    Tree.getTreeStructureFromTabs() / Tree.applyTreeStructureToTabs().
  */

  try {
    const getWindowSignatureFromTabs = (tabs) => {
      return tabs.map(tab =>
        `${tab.title}\n${tab.url}\npinned=${tab.pinned}`
      ).join('\n');
    };

    const structureSignatures = structures.map(getWindowSignatureFromTabs);

    const messages = [];

    const windows = await browser.windows.getAll({
      populate:     true,
      windowTypes: ['normal']
    });
    let restoredCountWithSession = 0;
    for (const window of windows) {
      const signature = getWindowSignatureFromTabs(window.tabs);
      const index     = structureSignatures.indexOf(signature);
      if (index < 0)
        continue;

      // found: apply only structure case
      const structure = structures[index];
      const tabs      = Tabs.getAllTabs(window.id, { element: true });
      await Tree.applyTreeStructureToTabs(tabs, structure);

      restoredCountWithSession++;

      structureSignatures.splice(index, 1);
      structures.splice(index, 1);
    }
    if (restoredCountWithSession > 0)
      messages.push(
        browser.i18n.getMessage(
          'migration_tree_notification_message_withSession',
          restoredCountWithSession
        )
      );

    // not found: try to restore windows from structures
    await Promise.all(structures.map(async structure => {
    // prepare new window with tabs
      let apiWindow = await browser.windows.create({
        url: 'about:blank'
      });
      const window = Tabs.trackedWindows.get(apiWindow.id);
      window.toBeOpenedOrphanTabs += structure.length;
      // restore tree
      let uris = structure.map(item => item.url);
      uris = uris.map(uRI => {
        if (!/^about:blank($|\?|#)/.test(uRI) &&
            /^(about|resource|chrome|file):/.test(uRI))
          return `about:blank?${uRI}`;
        return uRI;
      });
      const tabElements = await TabsOpen.openURIsInTabs(uris, {
        windowId: apiWindow.id
      });
      Tree.applyTreeStructureToTabs(tabElements, structure);
      // close initial blank tab
      apiWindow = await browser.windows.get(apiWindow.id, {
        populate: true
      });
      const restTabs = apiWindow.tabs.slice(1);
      try {
        await TabsInternalOperation.removeTab(Tabs.getTabElementById(apiWindow.tabs[0]));
        // apply pinned state
        for (let i = 0, maxi = restTabs.length; i < maxi; i++) {
          if (!structure[i].pinned)
            break;
          await browser.tabs.update(restTabs[i].id, {
            pinned: true
          });
        }
      }
      catch(e) {
        ApiTabs.handleMissingTabError(e);
      }
    }));
    if (structures.length > 0)
      messages.push(
        browser.i18n.getMessage(
          'migration_tree_notification_message_withoutSession',
          structures.length
        )
      );

    notify({
      title:   browser.i18n.getMessage('migration_tree_notification_title'),
      message: messages.join('\n'),
      icon:    Constants.kNOTIFICATION_DEFAULT_ICON,
      timeout: -1
    });

  }
  catch(e) {
    log('failed to migrate tree: ', String(e), e.stack);
    notify({
      title:   browser.i18n.getMessage('migration_treeFailed_notification_title'),
      message: `${browser.i18n.getMessage('migration_treeFailed_notification_message')}\n${String(e)}`,
      icon:    Constants.kNOTIFICATION_DEFAULT_ICON,
      timeout: -1
    });
  }

  configs.migrateLegacyTreeStructure = false;
}

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
  }
  configs.configsVersion = kCONFIGS_VERSION;
}

export async function notifyNewFeatures() {
  /*
  let featuresVersionOffset = 0;
  const browserInfo = await browser.runtime.getBrowserInfo();
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

  browser.tabs.create({
    url:    Constants.kSHORTHAND_URIS.startup,
    active: true
  });
}
