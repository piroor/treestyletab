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

  var nest   = (new Error()).stack.split('\n').length;
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
    aTask    = null;
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

async function notify(aParams = {}) {
  var id = await browser.notifications.create({
    type:    'basic',
    iconUrl: aParams.icon || kNOTIFICATION_DEFAULT_ICON,
    title:   aParams.title,
    message: aParams.message
  });

  var timeout = aParams.timeout;
  if (typeof timeout != 'number')
    timeout = configs.notificationTimeout;
  if (timeout >= 0)
    await wait(timeout);

  await browser.notifications.clear(id);
}

function makeAsyncFunctionSequential(aFunction) {
  return async function(...aArgs) {
    return new Promise((aResolve, aReject) => {
      makeAsyncFunctionSequential.tasks.push({
        original: aFunction,
        args:     aArgs,
        resolve:  aResolve,
        reject:   aReject,
        context:  this
      });
      if (makeAsyncFunctionSequential.tasks.length == 1)
        makeAsyncFunctionSequential.start();
    });
  };
}
makeAsyncFunctionSequential.tasks = [];
makeAsyncFunctionSequential.start = async () => {
  var task = makeAsyncFunctionSequential.tasks[0];
  if (!task)
    return;
  try {
    var result = await task.original.call(task.context, ...task.args);
    task.resolve(result);
  }
  catch(e) {
    task.reject(e);
  }
  finally {
    makeAsyncFunctionSequential.tasks.shift();
    makeAsyncFunctionSequential.start();
  }
};

configs = new Configs({
  // appearance
  sidebarPosition: kTABBAR_POSITION_LEFT,
  sidebarScrollbarPosition: kTABBAR_SCROLLBAR_POSITION_AUTO,

  style:
    /^Linux/i.test(navigator.platform) ? 'plain' :
      /^Mac/i.test(navigator.platform) ? 'sidebar' :
        'mixed',
  colorScheme: /^Linux/i.test(navigator.platform) ? 'system-color' : 'photon' ,

  faviconizePinnedTabs: true,
  faviconizedTabScale: 1.75,

  counterRole: kCOUNTER_ROLE_CONTAINED_TABS,

  baseIndent: 12,
  minIndent: kDEFAULT_MIN_INDENT,
  maxTreeLevel: -1,
  indentAutoShrink: true,
  indentAutoShrinkOnlyForVisible: true,

  scrollbarMode: /^Mac/i.test(navigator.platform) ? kTABBAR_SCROLLBAR_MODE_OVERLAY : kTABBAR_SCROLLBAR_MODE_NARROW,
  narrowScrollbarSize: 8,

  showContextualIdentitiesSelector: false,
  showNewTabActionSelector: true,
  longPressOnNewTabButton: kCONTEXTUAL_IDENTITY_SELECTOR,
  zoomable: false,


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

  collapseExpandSubtreeByDblClick: false,

  autoExpandIntelligently: true,
  autoExpandOnCollapsedChildFocused: true,
  autoExpandOnTabSwitchingShortcuts: true,
  autoExpandOnTabSwitchingShortcutsDelay: 800,
  autoExpandOnLongHover: true,
  autoExpandOnLongHoverDelay: 500,
  autoExpandOnLongHoverRestoreIniitalState: true,

  skipCollapsedTabsForTabSwitchingShortcuts: false,

  parentTabBehaviorForChanges: kPARENT_TAB_BEHAVIOR_ALWAYS,

  syncParentTabAndOpenerTab: true,

  dropLinksOnTabBehavior: kDROPLINK_ASK,


  // grouping
  autoGroupNewTabs: true,
  autoGroupNewTabsTimeout: 100,
  autoGroupNewTabsDelayOnNewWindow: 500,
  autoGroupNewTabsFromPinned: true,


  // behavior around newly opened tabs
  insertNewChildAt: kINSERT_END,
  insertNewTabFromPinnedTabAt: kINSERT_NO_CONTROL,

  scrollToNewTabMode: kSCROLL_TO_NEW_TAB_IF_POSSIBLE,

  autoAttach: true,
  autoAttachOnOpenedWithOwner: kNEWTAB_OPEN_AS_CHILD,
  autoAttachOnNewTabCommand: kNEWTAB_OPEN_AS_ORPHAN,
  autoAttachOnNewTabButtonMiddleClick: kNEWTAB_OPEN_AS_CHILD,
  autoAttachOnDuplicated: kNEWTAB_OPEN_AS_NEXT_SIBLING,
  guessNewOrphanTabAsOpenedByNewTabCommand: true,
  guessNewOrphanTabAsOpenedByNewTabCommandUrl: 'about:newtab',
  inheritContextualIdentityToNewChildTab: false,


  // behavior around closed tab
  closeParentBehavior: kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
  promoteFirstChildForClosedRoot: true,
  moveTabsToBottomWhenDetachedFromClosedParent: false,
  promoteAllChildrenWhenClosedParentIsLastChild: true,
  moveFocusInTreeForClosedCurrentTab: true,
  warnOnCloseTabs: true,
  lastConfirmedToCloseTabs: 0,


  // animation
  animation: true,
  smoothScrollEnabled:  true,
  smoothScrollDuration: 150,
  burstDuration:    375,
  indentDuration:   200,
  collapseDuration: 150,
  outOfViewTabNotifyDuration: 750,
  subMenuOpenDelay: 300,
  subMenuCloseDelay: 300,


  // misc.
  acccelaratedTabDuplication: false,
  enableWorkaroundForBug1409262: false,
  maximumAcceptableDelayForTabDuplication: 10 * 1000,
  acceptableDelayForInternalFocusMoving: 150,
  preventTearOffTabsTimeout: 100,
  notificationTimeout: 10 * 1000,
  startDragTimeout: 400,
  minimumIntervalToProcessDragoverEvent: 50,
  moveDroppedTabToNewWindowForUnhandledDragEvent: true, // see also: https://github.com/piroor/treestyletab/issues/1646
  autoDiscardTabForUnexpectedFocus: false,
  knownExternalAddons: [
    'multipletab@piro.sakura.ne.jp'
  ],
  cachedExternalAddons: [],
  notifiedFeaturesVersion: 0,

  useCachedTree: true,

  // This should be removed after https://bugzilla.mozilla.org/show_bug.cgi?id=1388193
  // or https://bugzilla.mozilla.org/show_bug.cgi?id=1421329 become fixed.
  // Otherwise you need to set "svg.context-properties.content.enabled"="true" via "about:config".
  simulateSVGContextFill: true,

  requestingPermissions: null,

  // https://dxr.mozilla.org/mozilla-central/rev/2535bad09d720e71a982f3f70dd6925f66ab8ec7/browser/base/content/browser.css#137
  newTabAnimationDuration: 100,

  userStyleRules: `
/* Show title of unread tabs with red and italic font */
/*
.tab.unread .label {
  color: red !important;
  font-style: italic !important;
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
  logOnUpdated: false,
  logOnMouseEvent: false,
  logOnScroll: false,
  logOnCollapseExpand: false,

  importedConfigsFromLegacy: null,
  legacyConfigsNextMigrationVersion: 0,
  importedTreeStructureFromLegacy: null,
  migrateLegacyTreeStructure: true
}, {
  syncKeys: `
    counterRole
    sidebarScrollbarPosition
    maxTreeLevel
    indentAutoShrink
    indentAutoShrinkOnlyForVisible
    showContextualIdentitiesSelector
    showNewTabActionSelector
    zoomable
    context_reloadTree
    context_reloadDescendants
    context_closeTree
    context_closeDescendants
    context_closeOthers
    context_collapseAll
    context_expandAll
    context_bookmarkTree
    shouldDetectClickOnIndentSpaces
    autoCollapseExpandSubtreeOnAttach
    autoCollapseExpandSubtreeOnSelect
    autoCollapseExpandSubtreeOnSelectExceptCurrentTabRemove
    collapseExpandSubtreeByDblClick
    autoExpandIntelligently
    autoExpandOnCollapsedChildFocused
    autoExpandOnTabSwitchingShortcuts
    autoExpandOnTabSwitchingShortcutsDelay
    autoExpandOnLongHover
    autoExpandOnLongHoverDelay
    autoExpandOnLongHoverRestoreIniitalState
    skipCollapsedTabsForTabSwitchingShortcuts
    parentTabBehaviorForChanges
    syncParentTabAndOpenerTab
    dropLinksOnTabBehavior
    autoGroupNewTabs
    autoGroupNewTabsTimeout
    autoGroupNewTabsDelayOnNewWindow
    autoGroupNewTabsFromPinned
    insertNewChildAt
    insertNewTabFromPinnedTabAt
    scrollToNewTabMode
    autoAttach
    autoAttachOnOpenedWithOwner
    autoAttachOnNewTabCommand
    autoAttachOnNewTabButtonMiddleClick
    autoAttachOnDuplicated
    guessNewOrphanTabAsOpenedByNewTabCommand
    guessNewOrphanTabAsOpenedByNewTabCommandUrl
    inheritContextualIdentityToNewChildTab
    closeParentBehavior
    promoteFirstChildForClosedRoot
    moveTabsToBottomWhenDetachedFromClosedParent
    promoteAllChildrenWhenClosedParentIsLastChild
    moveFocusInTreeForClosedCurrentTab
    warnOnCloseTabs
    animation
    smoothScrollEnabled
    smoothScrollDuration
    burstDuration
    indentDuration
    collapseDuration
    outOfViewTabNotifyDuration
    acccelaratedTabDuplication
    enableWorkaroundForBug1409262
    maximumAcceptableDelayForTabDuplication
    acceptableDelayForInternalFocusMoving
    preventTearOffTabsTimeout
    notificationTimeout
    startDragTimeout
    moveDroppedTabToNewWindowForUnhandledDragEvent
    autoDiscardTabForUnexpectedFocus
    knownExternalAddons
    useCachedTree
    simulateSVGContextFill
    newTabAnimationDuration
    userStyleRules
    debug
    logOnUpdated
    logOnMouseEvent
    logOnScroll
    logOnCollapseExpand
  `.trim().split('\n').map(aKey => aKey.trim()).filter(aKey => aKey && aKey.indexOf('//') != 0)
});
