/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import Configs from '/extlib/Configs.js';

/* global
  uneval: false,
 */

import * as Constants from './constants.js';

export const configs = new Configs({
  optionsExpandedSections: ['section-appearance'],
  optionsExpandedGroups: [],

  // appearance
  sidebarPosition: Constants.kTABBAR_POSITION_LEFT,
  sidebarDirection: Constants.kTABBAR_DIRECTION_LTR,
  sidebarScrollbarPosition: Constants.kTABBAR_SCROLLBAR_POSITION_AUTO,

  style:
    /^Mac/i.test(navigator.platform) ? 'sidebar' :
      'mixed',
  colorScheme: /^Linux/i.test(navigator.platform) ? 'system-color' : 'photon' ,
  applyBrowserTheme: true,

  faviconizePinnedTabs: true,
  faviconizedTabScale: 1.75,

  counterRole: Constants.kCOUNTER_ROLE_CONTAINED_TABS,

  baseIndent: 12,
  minIndent: Constants.kDEFAULT_MIN_INDENT,
  maxTreeLevel: -1,
  indentAutoShrink: true,
  indentAutoShrinkOnlyForVisible: true,
  labelOverflowStyle: 'fade',

  scrollbarMode: /^Mac/i.test(navigator.platform) ? Constants.kTABBAR_SCROLLBAR_MODE_OVERLAY : Constants.kTABBAR_SCROLLBAR_MODE_NARROW,

  showContextualIdentitiesSelector: false,
  showNewTabActionSelector: true,
  longPressOnNewTabButton: Constants.kCONTEXTUAL_IDENTITY_SELECTOR,
  zoomable: false,
  showCollapsedDescendantsByTooltip: true,


  // context menu
  fakeContextMenu: true, // obsolete, migrated to emulateDefaultContextMenu
  emulateDefaultContextMenu: true,
  context_reloadTree: true,
  context_reloadDescendants: false,
  context_closeTree: true,
  context_closeDescendants: false,
  context_closeOthers: false,
  context_collapseTree: false,
  context_collapseAll: true,
  context_expandTree: false,
  context_expandAll: true,
  context_bookmarkTree: true,
  context_groupTabs: true,

  context_closeTabOptions_closeTree: false,
  context_closeTabOptions_closeDescendants: false,
  context_closeTabOptions_closeOthers: false,

  context_collapsed: false,
  context_pinnedTab: false,
  context_unpinnedTab: false,


  // tree behavior
  shouldDetectClickOnIndentSpaces: true,

  autoCollapseExpandSubtreeOnAttach: true,
  autoCollapseExpandSubtreeOnSelect: true,
  autoCollapseExpandSubtreeOnSelectExceptActiveTabRemove: true,

  collapseExpandSubtreeByDblClick: false,

  autoExpandIntelligently: true,
  autoExpandOnCollapsedChildActive: true,
  autoExpandOnTabSwitchingShortcuts: true,
  autoExpandOnTabSwitchingShortcutsDelay: 800,
  autoExpandOnLongHover: true,
  autoExpandOnLongHoverDelay: 500,
  autoExpandOnLongHoverRestoreIniitalState: true,

  skipCollapsedTabsForTabSwitchingShortcuts: false,

  parentTabBehaviorForChanges: Constants.kPARENT_TAB_BEHAVIOR_ALWAYS,

  syncParentTabAndOpenerTab: true,

  dropLinksOnTabBehavior: Constants.kDROPLINK_ASK,

  showTabDragHandle:    false,
  tabDragBehavior:      Constants.kDRAG_BEHAVIOR_TEAR_OFF | Constants.kDRAG_BEHAVIOR_WHOLE_TREE,
  tabDragBehaviorShift: Constants.kDRAG_BEHAVIOR_WHOLE_TREE | Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK,
  showTabDragBehaviorNotification: true,

  fixupTreeOnTabVisibilityChanged: false,


  // grouping
  autoGroupNewTabs: true,
  autoGroupNewTabsTimeout: 100,
  autoGroupNewTabsDelayOnNewWindow: 500,
  autoGroupNewTabsFromPinned: true,
  warnOnAutoGroupNewTabs: true,
  showAutoGroupOptionHint: true,


  // behavior around newly opened tabs
  insertNewChildAt: Constants.kINSERT_END,
  insertNewTabFromPinnedTabAt: Constants.kINSERT_NO_CONTROL,

  scrollToNewTabMode: Constants.kSCROLL_TO_NEW_TAB_IF_POSSIBLE,
  scrollLines: 3,

  autoAttach: true,
  autoAttachOnOpenedWithOwner: Constants.kNEWTAB_OPEN_AS_CHILD,
  autoAttachOnNewTabCommand: Constants.kNEWTAB_OPEN_AS_ORPHAN,
  autoAttachOnNewTabButtonMiddleClick: Constants.kNEWTAB_OPEN_AS_CHILD,
  autoAttachOnDuplicated: Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING,
  autoAttachSameSiteOrphan: Constants.kNEWTAB_OPEN_AS_CHILD,
  guessNewOrphanTabAsOpenedByNewTabCommand: true,
  guessNewOrphanTabAsOpenedByNewTabCommandUrl: 'about:newtab',
  inheritContextualIdentityToNewChildTab: false,
  inheritContextualIdentityToSameSiteOrphan: true,


  // behavior around closed tab
  closeParentBehavior: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
  promoteFirstChildForClosedRoot: true,
  moveTabsToBottomWhenDetachedFromClosedParent: false,
  promoteAllChildrenWhenClosedParentIsLastChild: true,
  moveFocusInTreeForClosedActiveTab: true, // obsolete, migrated to "successorTabControlLevel"
  successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
  simulateSelectOwnerOnClose: true,
  supportTabsMultiselect: typeof browser.menus.overrideContext == 'function',
  warnOnCloseTabs: true,
  lastConfirmedToCloseTabs: 0,
  grantedRemovingTabIds: [],


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
  tabDragHandleDelay: 750,
  tabDragHandleFeedbackDuration: 1000,


  // misc.
  bookmarkTreeFolderName: browser.i18n.getMessage('bookmarkFolder_label_default', ['%TITLE%', '%YEAR%', '%MONTH%', '%DATE%']),
  defaultBookmarkParentId: 'unfiled_____',
  defaultSearchEngine: 'https://www.google.com/search?q=%s',
  acceleratedTabOperations: true,
  acceleratedTabCreation: false,
  acceleratedTabDuplication: false,
  enableWorkaroundForBug1409262: false,
  simulateCloseTabByDblclick: false,
  maximumAcceptableDelayForTabDuplication: 10 * 1000,
  maximumDelayUntilTabIsTracked: 10 * 60 * 1000,
  delayToBlockUserOperationForTabsRestoration: 1000,
  intervalToUpdateProgressForBlockedUserOperation: 50,
  delayToShowProgressForBlockedUserOperation: 1000,
  acceptableDelayForInternalFocusMoving: 150,
  notificationTimeout: 10 * 1000,
  startDragTimeout: 400, // obsolete, migrated to longPressDuration
  longPressDuration: 400,
  minimumIntervalToProcessDragoverEvent: 50,
  moveDroppedTabToNewWindowForUnhandledDragEvent: true, // see also: https://github.com/piroor/treestyletab/issues/1646
  autoDiscardTabForUnexpectedFocus: true,
  autoDiscardTabForUnexpectedFocusDelay: 500,
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
  applyThemeColorToIcon: false,

  requestingPermissions: null,
  requestingPermissionsNatively: null,

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
  logTimestamp: true,
  loggingQueries: false,
  logFor: { // git grep configs.logFor | grep -v common.js | cut -d "'" -f 2 | sed -e "s/^/    '/" -e "s/$/': false,/"
    'background/api-tabs-listener': false,
    'background/background-cache': false,
    'background/background': false,
    'background/browser-action-menu': false,
    'background/commands': false,
    'background/context-menu': false,
    'background/handle-group-tabs': false,
    'background/handle-misc': false,
    'background/handle-moved-tabs': false,
    'background/handle-new-tabs': false,
    'background/handle-removed-tabs': false,
    'background/handle-tab-focus': false,
    'background/handle-tab-multiselect': false,
    'background/handle-tree-changes': false,
    'background/migration': false,
    'background/successor-tab': false,
    'background/tab-context-menu': false,
    'background/tabs-group': false,
    'background/tabs-move': false,
    'background/tabs-open': false,
    'background/tree': false,
    'background/tree-structure': false,
    'common/Tab': false,
    'common/Window': false,
    'common/api-tabs': false,
    'common/bookmarks': false,
    'common/contextual-identities': false,
    'common/permissions': false,
    'common/sidebar-connection': false,
    'common/tabs-internal-operation': false,
    'common/tabs-update': false,
    'common/tabs': false,
    'common/tst-api': false,
    'common/unique-id': false,
    'common/user-operation-blocker': false,
    'sidebar/background-connection': false,
    'sidebar/collapse-expand': false,
    'sidebar/color': false,
    'sidebar/drag-and-drop': false,
    'sidebar/event-utils': false,
    'sidebar/indent': false,
    'sidebar/mouse-event-listener': false,
    'sidebar/pinned-tabs': false,
    'sidebar/scroll': false,
    'sidebar/sidebar-cache': false,
    'sidebar/sidebar-tabs': false,
    'sidebar/sidebar': false,
    'sidebar/size': false,
    'sidebar/tab-context-menu': false,
    'sidebar/tab-drag-handle': false
  },
  loggingConnectionMessages: false,

  configsVersion: 0,

  testKey: 0 // for tests/utils.js
}, {
  localKeys: `
    optionsExpandedSections
    sidebarPosition
    sidebarDirection
    style
    colorScheme
    faviconizedTabScale
    baseIndent
    minIndent
    scrollbarMode
    narrowScrollbarSize
    lastConfirmedToCloseTabs
    grantedRemovingTabIds
    subMenuOpenDelay
    subMenuCloseDelay
    minimumIntervalToProcessDragoverEvent
    cachedExternalAddons
    notifiedFeaturesVersion
    requestingPermissions
    requestingPermissionsNatively
    testKey
  `.trim().split('\n').map(key => key.trim()).filter(key => key && key.indexOf('//') != 0)
});

configs.$loaded.then(() => {
  log.forceStore = false;
  if (!configs.debug)
    log.logs = [];
});


export function log(module, ...args)
{
  const isModuleLog = module in configs.$default.logFor;
  const message    = isModuleLog ? args.shift() : module ;
  const useConsole = configs && configs.debug && (!isModuleLog || configs.logFor[module]);
  const logging    = useConsole || log.forceStore;
  if (!logging)
    return;

  const nest = (new Error()).stack.split('\n').length;
  let indent = '';
  for (let i = 0; i < nest; i++) {
    indent += ' ';
  }
  if (isModuleLog)
    module = `${module}: `
  else
    module = '';

  const timestamp = configs.logTimestamp ? `${new Date().toString()} ` : '';
  const line = `tst<${log.context}>: ${timestamp}${module}${indent}${message}`;
  if (useConsole)
    console.log(line, ...args);

  log.logs.push(`${line} ${args.map(arg => uneval(arg)).join(', ')}`);
  log.logs = log.logs.slice(-log.max);
}
log.context = '?';
log.max  = 2000;
log.logs = [];
log.forceStore = true;

configs.$logger = log;

export function dumpTab(tab) {
  if (!configs || !configs.debug)
    return '';
  if (!tab)
    return '<NULL>';
  return `#${tab.id}(${!!tab.$TST ? 'tracked' : '!tracked'})`;
}

export async function wait(task = 0, timeout = 0) {
  if (typeof task != 'function') {
    timeout = task;
    task    = null;
  }
  return new Promise((resolve, _aReject) => {
    setTimeout(async () => {
      if (task)
        await task();
      resolve();
    }, timeout);
  });
}

export function nextFrame() {
  return new Promise((resolve, _aReject) => {
    window.requestAnimationFrame(resolve);
  });
}

export async function notify(params = {}) {
  const id = await browser.notifications.create({
    type:    'basic',
    iconUrl: params.icon || Constants.kNOTIFICATION_DEFAULT_ICON,
    title:   params.title,
    message: params.message
  });

  let timeout = params.timeout;
  if (typeof timeout != 'number')
    timeout = configs.notificationTimeout;
  if (timeout >= 0)
    await wait(timeout);

  await browser.notifications.clear(id);
}
