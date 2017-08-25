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
  return `${getTabIndex(aTab)} #${aTab.id}.${aTab.className} ${JSON.stringify(aTab.apiTab.title)}`;
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

configs = new Configs({
  treeStructure: [],

  baseIndent: 12, // extensions.treestyletab.indent.vertical
  shouldDetectClickOnIndentSpaces: true, // extensions.treestyletab.clickOnIndentSpaces.enabled
  
  smoothScrollEnabled:  true, // extensions.treestyletab.tabbar.scroll.smooth
  smoothScrollDuration: 150, // extensions.treestyletab.tabbar.scroll.duration

  indentDuration:   200, // extensions.treestyletab.animation.indent.duration
  collapseDuration: 150, // extensions.treestyletab.animation.collapse.duration

  twistyStyle: 'modern-black', // extensions.treestyletab.twisty.style
  shouldExpandTwistyArea: true, // extensions.treestyletab.twisty.expandSensitiveArea

  scrollToNewTabMode: null, // extensions.treestyletab.tabbar.scrollToNewTab.mode
  counterRole: -1, // extensions.treestyletab.counter.role.vertical

  style: null, // extensions.treestyletab.tabbar.style

  faviconizePinnedTabs: true, // extensions.treestyletab.pinnedTab.faviconized

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

  closeParentBehavior: kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD, // extensions.treestyletab.closeParentBehavior
  closeParentBehaviorMoveDetachedTabsToBottom: false, // extensions.treestyletab.closeParentBehavior.moveDetachedTabsToBottom
  closeParentBehaviorPromoteAllChildrenWhenParentIsLastChild: true, // extensions.treestyletab.closeParentBehavior.promoteAllChildrenWhenParentIsLastChild
  closeRootBehavior: kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD, // extensions.treestyletab.closeRootBehavior

  insertNewChildAt: kINSERT_LAST, // extensions.treestyletab.insertNewChildAt

  acceptableDelayForInternalFocusMoving: 150,
  maxFaviconizedSize: 32,

  animation: true,
  debug:     false
});
