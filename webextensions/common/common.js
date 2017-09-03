/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var configs;
var gLogContext = '?';

function log(aMessage, ...aArgs)
{
  if (!configs || !configs.debug)
    return;

  var nest = (new Error()).stack.split('\n').length;
  var indent = '';
  for (let i = 0; i < nest; i++) {
    indent += ' ';
  }
  console.log(`tst<${gLogContext}>: ${indent}${aMessage}`, ...aArgs);
}

function dumpTab(aTab) {
  if (!configs || !configs.debug)
    return '';
  if (!aTab || !aTab.apiTab)
    return '<NULL>';
  return `#${aTab.id}`;
}

async function wait(aTask = 0, aTimeout = 0) {
  if (typeof aTask != 'function') {
    aTimeout = aTask;
    aTask = null;
  }
  return new Promise((aResolve, aReject) => {
    setTimeout(async () => {
      if (aTask)
        await aTask();
      aResolve();
    }, aTimeout);
  });
}

function nextFrame() {
  return new Promise((aResolve, aReject) => {
    window.requestAnimationFrame(aResolve);
  });
}

function clone(aOriginalObject, aExtraProperties) {
  var cloned = {};
  for (let key of Object.keys(aOriginalObject)) {
    cloned[key] = aOriginalObject[key];
  }
  if (aExtraProperties) {
    for (let key of Object.keys(aExtraProperties)) {
      cloned[key] = aExtraProperties[key];
    }
  }
  return cloned;
}

configs = new Configs({
  baseIndent: 12, // extensions.treestyletab.indent.vertical
  shouldDetectClickOnIndentSpaces: true, // extensions.treestyletab.clickOnIndentSpaces.enabled
  
  smoothScrollEnabled:  true, // extensions.treestyletab.tabbar.scroll.smooth
  smoothScrollDuration: 150, // extensions.treestyletab.tabbar.scroll.duration

  indentDuration:   200, // extensions.treestyletab.animation.indent.duration
  collapseDuration: 150, // extensions.treestyletab.animation.collapse.duration

  scrollToNewTabMode: kSCROLL_TO_NEW_TAB_IF_POSSIBLE, // extensions.treestyletab.tabbar.scrollToNewTab.mode
  counterRole: kCOUNTER_ROLE_CONTAINED_TABS, // extensions.treestyletab.counter.role.vertical

  sidebarPosition: kTABBAR_POSITION_LEFT,
  style: null, // extensions.treestyletab.tabbar.style
  defaultStyle: 'mixed', // extensions.treestyletab.platform.default.tabbar.style
  defaultStyleOnDarwin: 'sidebar', // extensions.treestyletab.platform.default.tabbar.style
  defaultStyleOnLinux: 'plain', // extensions.treestyletab.platform.Linux.tabbar.style

  faviconizePinnedTabs: true, // extensions.treestyletab.pinnedTab.faviconized

  autoAttach: true, // extensions.treestyletab.autoAttach
  autoAttachOnOpenedWithOwner: kNEWTAB_OPEN_AS_CHILD, // extensions.treestyletab.autoAttach.fromCurrent
  autoAttachOnNewTabCommand: kNEWTAB_OPEN_AS_ORPHAN, // extensions.treestyletab.autoAttach.newTabCommand
  autoAttachOnNewTabButtonMiddleClick: kNEWTAB_OPEN_AS_CHILD, // extensions.treestyletab.autoAttach.newTabButton
  //autoAttachOnDuplicated: kNEWTAB_OPEN_AS_NEXT_SIBLING, // extensions.treestyletab.autoAttach.duplicateTabCommand

  autoCollapseExpandSubtreeOnAttach: true, // extensions.treestyletab.autoCollapseExpandSubtreeOnAttach
  autoCollapseExpandSubtreeOnSelect: true, // extensions.treestyletab.autoCollapseExpandSubtreeOnSelect
  autoCollapseExpandSubtreeOnSelectWhileFocusMovingByShortcut: true, // extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut
  autoCollapseExpandSubtreeOnSelectOnCurrentTabRemove: false, // extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.onCurrentTabRemove
  autoExpandSubtreeOnAppendChild: true, // extensions.treestyletab.autoExpandSubtreeOnAppendChild
  autoExpandSubtreeOnCollapsedChildFocused : true, // extensions.treestyletab.autoExpandSubtreeOnCollapsedChildFocused
  autoExpandIntelligently: true, // extensions.treestyletab.autoExpand.intelligently

  autoExpandEnabled: true, // extensions.treestyletab.autoExpand.enabled
  autoExpandDelay: 500, // extensions.treestyletab.autoExpand.delay
  autoExpandCollapseFinally: true, // extensions.treestyletab.autoExpand.collapseFinally

  indentAutoShrink: true, // extensions.treestyletab.indent.autoShrink
  indentAutoShrinkOnlyForVisible: true, // extensions.treestyletab.indent.autoShrink.onlyForVisible
  maxTreeLevel: -1, // extensions.treestyletab.maxTreeLevel.vertical
  minIndent: kDEFAULT_MIN_INDENT, // extensions.treestyletab.indent.min.vertical

  closeParentBehavior: kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD, // extensions.treestyletab.closeParentBehavior
  closeParentBehaviorMoveDetachedTabsToBottom: false, // extensions.treestyletab.closeParentBehavior.moveDetachedTabsToBottom
  closeParentBehaviorPromoteAllChildrenWhenParentIsLastChild: true, // extensions.treestyletab.closeParentBehavior.promoteAllChildrenWhenParentIsLastChild
  closeRootBehavior: kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD, // extensions.treestyletab.closeRootBehavior

  insertNewChildAt: kINSERT_LAST, // extensions.treestyletab.insertNewChildAt

  acceptableDelayForInternalFocusMoving: 150,
  faviconizedTabScale: 1.75,

  autoGroupNewTabs: true,
  autoGroupNewTabsTimeout: 100,
  preventTearOffTabsTimeout: 100,
  outOfViewTabNotifyDuration: 750,

  animation: true,
  debug:     false
});
