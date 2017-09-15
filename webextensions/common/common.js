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
  // appearance
  sidebarPosition: kTABBAR_POSITION_LEFT,

  style: '',
  defaultStyle: 'mixed',
  defaultStyleOnDarwin: 'sidebar',
  defaultStyleOnLinux: 'plain',

  faviconizePinnedTabs: true,
  faviconizedTabScale: 1.75,

  counterRole: kCOUNTER_ROLE_CONTAINED_TABS,

  baseIndent: 12,
  minIndent: kDEFAULT_MIN_INDENT,
  maxTreeLevel: -1,
  indentAutoShrink: true,
  indentAutoShrinkOnlyForVisible: true,


  // context menu
  context_reloadTree: true,
  context_reloadDescendants: false,
  context_closeTree: true,
  context_closeDescendants: false,
  context_closeOthers: false,
  context_collapseAll: true,
  context_expandAll: true,
  context_bookmarkTree: true,


  // tree behavior
  shouldDetectClickOnIndentSpaces: true,

  autoCollapseExpandSubtreeOnAttach: true,
  autoCollapseExpandSubtreeOnSelect: true,
  autoCollapseExpandSubtreeOnSelectExceptCurrentTabRemove: true,

  autoExpandIntelligently: true,
  autoExpandOnAttached: true,
  autoExpandOnCollapsedChildFocused : true,
  autoExpandOnLongHover: true,
  autoExpandOnLongHoverDelay: 500,
  autoExpandOnLongHoverRestoreIniitalState: true,

  parentTabBehaviorForChanges: kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE,


  // grouping
  autoGroupNewTabs: true,
  autoGroupNewTabsTimeout: 100,


  // behavior around newly opened tabs
  insertNewChildAt: kINSERT_LAST,

  scrollToNewTabMode: kSCROLL_TO_NEW_TAB_IF_POSSIBLE,

  autoAttach: true,
  autoAttachOnOpenedWithOwner: kNEWTAB_OPEN_AS_CHILD,
  autoAttachOnNewTabCommand: kNEWTAB_OPEN_AS_ORPHAN,
  autoAttachOnNewTabButtonMiddleClick: kNEWTAB_OPEN_AS_CHILD,
  autoAttachOnDuplicated: kNEWTAB_OPEN_AS_NEXT_SIBLING,


  // behavior around closed tab
  closeParentBehavior: kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
  promoteFirstChildForClosedRoot: true,
  moveTabsToBottomWhenDetachedFromClosedParent: false,
  promoteAllChildrenWhenClosedParentIsLastChild: true,


  // animation
  animation: true,
  smoothScrollEnabled:  true,
  smoothScrollDuration: 150,
  indentDuration:   200,
  collapseDuration: 150,
  outOfViewTabNotifyDuration: 750,


  // misc.
  acccelaratedTabDuplication: false,
  maximumAcceptableDelayForTabDuplication: 10 * 1000,
  acceptableDelayForInternalFocusMoving: 150,
  preventTearOffTabsTimeout: 100,
  notificationTimeout: 10 * 1000,
  sidebarOpenStateUpdateInterval: 500,
  startDragTimeout: 400,
  knownExternalAddons: [
    'multipletab@piro.sakura.ne.jp'
  ],
  cachedExternalAddons: [],

  userStyleRules: `
/* Show title of unread tabs with italic font */
/*
.tab.unread .label {
  font-style: italic;
}
*/

/* Add private browsing indicator per tab */
/*
.tab.private-browsing .label:before {
  content: "🕶";
}
*/
`.trim(),

  debug:     false,

  importedConfigsFromLegacy: null,
  legacyConfigsNextMigrationVersion: 0,
  importedTreeStructureFromLegacy: null,
  migrateLegacyTreeStructure: true
});
