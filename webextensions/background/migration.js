/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kLEGACY_CONFIGS_MIGRATION_VERSION = 3;
const kFEATURES_VERSION = 3;

function migrateLegacyConfigs() {
  var values = configs.importedConfigsFromLegacy;
  if (!values ||
      typeof values != 'object')
    return;

  try {

    var migrated = false;
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
        migrateLegacyConfig('autoCollapseExpandSubtreeOnSelectExceptCurrentTabRemove', !values['extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.onCurrentTabRemove']);

        migrateLegacyConfig('autoExpandIntelligently', values['extensions.treestyletab.autoExpand.intelligently']);
        migrateLegacyConfig('autoExpandOnCollapsedChildFocused', values['extensions.treestyletab.autoExpandSubtreeOnCollapsedChildFocused']);
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
        migrateLegacyConfig('promoteFirstChildForClosedRoot', values['extensions.treestyletab.closeRootBehavior'] == kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD);
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
        migrateLegacyConfig('scrollbarMode', values['extensions.treestyletab.tabbar.narrowScrollbar'] ? kTABBAR_SCROLLBAR_MODE_NARROW : kTABBAR_SCROLLBAR_MODE_DEFAULT);
        migrateLegacyConfig('narrowScrollbarSize', values['extensions.treestyletab.tabbar.narrowScrollbar.width']);

        // case 4:
        // case 5:
        migrated = true;

      default:
        break;
    }

    if (migrated)
      notify({
        title:   browser.i18n.getMessage('migration.configs.notification.title'),
        message: browser.i18n.getMessage('migration.configs.notification.message'),
        icon:    kNOTIFICATION_DEFAULT_ICON,
        timeout: -1
      });

  }
  catch(e) {
    log('failed to migrate tree: ', String(e), e.stack);
    notify({
      title:   browser.i18n.getMessage('migration.configsFailed.notification.title'),
      message: `${browser.i18n.getMessage('migration.configsFailed.notification.message')}\n${String(e)}`,
      icon:    kNOTIFICATION_DEFAULT_ICON,
      timeout: -1
    });
  }

  configs.legacyConfigsNextMigrationVersion = kLEGACY_CONFIGS_MIGRATION_VERSION + 1;
}

function migrateLegacyConfig(aKey, aValue) {
  if (aValue === undefined)
    return;
  configs[aKey] = aValue;
}

async function migrateLegacyTreeStructure() {
  var structures = configs.importedTreeStructureFromLegacy;
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
    getTreeStructureFromTabs() / applyTreeStructureToTabs().
  */

  try {
    var getWindowSignatureFromTabs = (aTabs) => {
      return aTabs.map(aTab =>
        `${aTab.title}\n${aTab.url}\npinned=${aTab.pinned}`
      ).join('\n');
    };

    var structureSignatures = structures.map(getWindowSignatureFromTabs);

    var messages = [];

    var apiWindows = await browser.windows.getAll({
      populate:     true,
      windowTypes: ['normal']
    });
    var restoredCountWithSession = 0;
    for (let apiWindow of apiWindows) {
      let signature = getWindowSignatureFromTabs(apiWindow.tabs);
      let index     = structureSignatures.indexOf(signature);
      if (index < 0)
        continue;

      // found: apply only structure case
      let structure = structures[index];
      let tabs      = getAllTabs(apiWindow.id);
      await applyTreeStructureToTabs(tabs, structure);

      restoredCountWithSession++;

      structureSignatures.splice(index, 1);
      structures.splice(index, 1);
    }
    if (restoredCountWithSession > 0)
      messages.push(
        browser.i18n.getMessage(
          'migration.tree.notification.message.withSession',
          restoredCountWithSession
        )
      );

    // not found: try to restore windows from structures
    await Promise.all(structures.map(async aStructure => {
    // prepare new window with tabs
      var apiWindow = await browser.windows.create({
        url: 'about:blank'
      });
      var container = getTabsContainer(apiWindow.id);
      incrementContainerCounter(container, 'toBeOpenedOrphanTabs', aStructure.length);
      // restore tree
      var uris = aStructure.map(aItem => aItem.url);
      uris = uris.map(aURI => {
        if (!/^about:blank($|\?|#)/.test(aURI) &&
            /^(about|resource|chrome|file):/.test(aURI))
          return `about:blank?${aURI}`;
        return aURI;
      });
      var tabs = await openURIsInTabs(uris, {
        windowId: apiWindow.id
      });
      applyTreeStructureToTabs(tabs, aStructure);
      // close initial blank tab
      apiWindow = await browser.windows.get(apiWindow.id, {
        populate: true
      });
      var restApiTabs = apiWindow.tabs.slice(1);
      try {
        await removeTabInternally(getTabById(apiWindow.tabs[0].id));
        // apply pinned state
        for (let i = 0, maxi = restApiTabs.length; i < maxi; i++) {
          if (!aStructure[i].pinned)
            break;
          await browser.tabs.update(restApiTabs[i].id, {
            pinned: true
          });
        }
      }
      catch(e) {
        handleMissingTabError(e);
      }
    }));
    if (structures.length > 0)
      messages.push(
        browser.i18n.getMessage(
          'migration.tree.notification.message.withoutSession',
          structures.length
        )
      );

    notify({
      title:   browser.i18n.getMessage('migration.tree.notification.title'),
      message: messages.join('\n'),
      icon:    kNOTIFICATION_DEFAULT_ICON,
      timeout: -1
    });

  }
  catch(e) {
    log('failed to migrate tree: ', String(e), e.stack);
    notify({
      title:   browser.i18n.getMessage('migration.treeFailed.notification.title'),
      message: `${browser.i18n.getMessage('migration.treeFailed.notification.message')}\n${String(e)}`,
      icon:    kNOTIFICATION_DEFAULT_ICON,
      timeout: -1
    });
  }

  configs.migrateLegacyTreeStructure = false;
}

async function notifyNewFeatures() {
  if (configs.notifiedFeaturesVersion >= kFEATURES_VERSION)
    return;
  configs.notifiedFeaturesVersion = kFEATURES_VERSION;

  browser.tabs.create({
    url:    kSHORTHAND_URIS.startup,
    active: true
  });
}
