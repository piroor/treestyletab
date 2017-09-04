/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kLEGACY_CONFIGS_MIGRATED_VERSION = 1;

function migrateLegacyConfigs() {
  var values = configs.importedConfigsFromLegacy;
  if (!values ||
      typeof values != 'object')
    return;

  sitch (configs.legacyConfigsMigratedVersion) {
    case 0:
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
      migrateLegacyConfig('autoExpandOnAttached', values['extensions.treestyletab.autoExpandSubtreeOnAppendChild']);
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

    default:
      break;
  }

  configs.legacyConfigsMigratedVersion = kLEGACY_CONFIGS_MIGRATED_VERSION;
}

function migrateLegacyConfig(aKey, aValue) {
  if (aValue === undefined)
    return;
  configs[aKey] = aValue;
}
