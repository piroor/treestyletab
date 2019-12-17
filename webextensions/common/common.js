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

  sidebarScrollbarPosition: 0, // obsolete, migrated to user stylesheet
  scrollbarMode: -1, // obsolete, migrated to user stylesheet

  style:
    /^Mac/i.test(navigator.platform) ? 'sidebar' :
      'mixed',
  colorScheme: /^Linux/i.test(navigator.platform) ? 'system-color' : 'photon' ,
  applyBrowserTheme: true,

  faviconizePinnedTabs: true,
  maxFaviconizedPinnedTabsInOneRow: 0, // auto
  faviconizedTabScale: 1.75,

  counterRole: Constants.kCOUNTER_ROLE_CONTAINED_TABS,

  baseIndent: 12,
  minIndent: Constants.kDEFAULT_MIN_INDENT,
  maxTreeLevel: -1,
  indentAutoShrink: true,
  indentAutoShrinkOnlyForVisible: true,
  labelOverflowStyle: 'fade',

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

  context_topLevel_reloadTree: false,
  context_topLevel_reloadDescendants: false,
  context_topLevel_closeTree: false,
  context_topLevel_closeDescendants: false,
  context_topLevel_closeOthers: false,
  context_topLevel_collapseTree: false,
  context_topLevel_collapseAll: false,
  context_topLevel_expandTree: false,
  context_topLevel_expandAll: false,
  context_topLevel_bookmarkTree: false,
  context_topLevel_groupTabs: false,

  context_closeTabOptions_closeTree: false, // obsolete, migrated to context_topLevel_closeTree
  context_closeTabOptions_closeDescendants: false, // obsolete, migrated to context_topLevel_closeDescendants
  context_closeTabOptions_closeOthers: false, // obsolete, migrated to context_topLevel_closeOthers

  context_collapsed: false,
  context_pinnedTab: false,
  context_unpinnedTab: false,

  context_openAllBookmarksWithStructure: true,
  context_openAllBookmarksWithStructureRecursively: false,

  openAllBookmarksWithStructureDiscarded: true,


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

  syncParentTabAndOpenerTab: true,

  dropLinksOnTabBehavior: Constants.kDROPLINK_ASK,

  showTabDragHandle:    false,
  tabDragBehavior:      Constants.kDRAG_BEHAVIOR_TEAR_OFF | Constants.kDRAG_BEHAVIOR_WHOLE_TREE,
  tabDragBehaviorShift: Constants.kDRAG_BEHAVIOR_WHOLE_TREE | Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK,
  showTabDragBehaviorNotification: true,
  guessDraggedNativeTabs: true,

  fixupTreeOnTabVisibilityChanged: false,

  scrollToExpandedTree: true,


  // grouping
  autoGroupNewTabs: true,
  autoGroupNewTabsTimeout: 100,
  autoGroupNewTabsDelayOnNewWindow: 500,
  autoGroupNewTabsFromPinned: true,
  renderTreeInGroupTabs: true,
  warnOnAutoGroupNewTabs: true,
  showAutoGroupOptionHint: true,


  // behavior around newly opened tabs
  insertNewChildAt: Constants.kINSERT_END,
  insertNewTabFromPinnedTabAt: Constants.kINSERT_NO_CONTROL,

  scrollToNewTabMode: Constants.kSCROLL_TO_NEW_TAB_IF_POSSIBLE,
  scrollLines: 3,

  autoAttach: true,
  autoAttachOnOpenedWithOwner: Constants.kNEWTAB_OPEN_AS_CHILD,
  autoAttachOnNewTabCommand: Constants.kNEWTAB_DO_NOTHING,
  autoAttachOnNewTabButtonMiddleClick: Constants.kNEWTAB_OPEN_AS_CHILD,
  autoAttachOnDuplicated: Constants.kNEWTAB_OPEN_AS_NEXT_SIBLING,
  autoAttachSameSiteOrphan: Constants.kNEWTAB_OPEN_AS_CHILD,
  autoAttachOnOpenedFromExternal: Constants.kNEWTAB_DO_NOTHING,
  guessNewOrphanTabAsOpenedByNewTabCommand: true,
  guessNewOrphanTabAsOpenedByNewTabCommandUrl: 'about:newtab',
  inheritContextualIdentityToNewChildTab: false,
  inheritContextualIdentityToSameSiteOrphan: true,
  inheritContextualIdentityToTabsFromExternal: false,


  // behavior around closed tab
  closeParentBehaviorMode:            Constants.kCLOSE_PARENT_BEHAVIOR_MODE_WITH_NATIVE_TABBAR,
  closeParentBehavior:                Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
  closeParentBehavior_outsideSidebar: Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
  closeParentBehavior_noSidebar:      Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD,
  promoteFirstChildForClosedRoot:     true, // obsolete, migrated to Constants.kCLOSE_PARENT_BEHAVIOR_PROMOTE_INTELLIGENTLY of closeParentBehavior
  parentTabBehaviorForChanges:        Constants.kPARENT_TAB_BEHAVIOR_ALWAYS, // obsolete, migrated to closeParentBehaviorMode
  moveTabsToBottomWhenDetachedFromClosedParent: false,
  promoteAllChildrenWhenClosedParentIsLastChild: true,
  moveFocusInTreeForClosedActiveTab: true, // obsolete, migrated to "successorTabControlLevel"
  successorTabControlLevel: Constants.kSUCCESSOR_TAB_CONTROL_IN_TREE,
  simulateSelectOwnerOnClose: true,
  supportTabsMultiselect: typeof browser.menus.overrideContext == 'function',
  warnOnCloseTabs: true,
  warnOnCloseTabsNotificationTimeout: 20 * 1000,
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


  // subpanel
  lastSelectedSubPanelProviderId: null,
  lastSubPanelHeight: 0,


  // misc.
  bookmarkTreeFolderName: browser.i18n.getMessage('bookmarkFolder_label_default', ['%TITLE%', '%YEAR%', '%MONTH%', '%DATE%']),
  defaultBookmarkParentId: 'unfiled_____',
  defaultSearchEngine: 'https://www.google.com/search?q=%s',
  acceleratedTabOperations: true,
  acceleratedTabCreation: false,
  enableWorkaroundForBug1409262: false,
  enableWorkaroundForBug1548949: true,
  workaroundForBug1548949DroppedTabs: null,
  simulateCloseTabByDblclick: false,
  maximumAcceptableDelayForTabDuplication: 10 * 1000,
  maximumDelayUntilTabIsTracked: 10 * 60 * 1000,
  delayToBlockUserOperationForTabsRestoration: 1000,
  intervalToUpdateProgressForBlockedUserOperation: 50,
  delayToShowProgressForBlockedUserOperation: 1000,
  acceptableDelayForInternalFocusMoving: 150,
  delayToRetrySyncTabsOrder: 100,
  notificationTimeout: 10 * 1000,
  startDragTimeout: 400, // obsolete, migrated to longPressDuration
  longPressDuration: 400,
  minimumIntervalToProcessDragoverEvent: 50,
  delayToApplyHighlightedState: 50,
  moveDroppedTabToNewWindowForUnhandledDragEvent: true, // see also: https://github.com/piroor/treestyletab/issues/1646
  autoDiscardTabForUnexpectedFocus: true,
  autoDiscardTabForUnexpectedFocusDelay: 500,
  migratedBookmarkUrls: [],
  knownExternalAddons: [
    'multipletab@piro.sakura.ne.jp'
  ],
  cachedExternalAddons: [],
  grantedExternalAddonPermissions: {},
  incognitoAllowedExternalAddons: [],
  notifiedFeaturesVersion: 0,

  useCachedTree: true,
  storeCacheAsWindowValue: false,

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
tab-label::part(label-text) {
  color: red !important;
  font-style: italic !important;
}
*/

/* Add private browsing indicator per tab */
/*
tab-item.private-browsing tab-label:before {
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
    'common/tree-behavior': false,
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
    'sidebar/subpanel': false,
    'sidebar/tab-context-menu': false,
    'sidebar/tab-drag-handle': false
  },
  loggingConnectionMessages: false,

  configsVersion: 0,

  testKey: 0 // for tests/utils.js
}, {
  localKeys: mapAndFilter(`
    optionsExpandedSections
    sidebarPosition
    sidebarDirection
    style
    colorScheme
    faviconizedTabScale
    baseIndent
    minIndent
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
  `.trim().split('\n'), key => {
    key = key.trim();
    return key && key.indexOf('//') != 0 && key;
  })
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

  args = args.map(arg => typeof arg == 'function' ? arg() : arg);

  const nest = (new Error()).stack.split('\n').length;
  let indent = '';
  for (let i = 0; i < nest; i++) {
    indent += ' ';
  }
  if (isModuleLog)
    module = `${module}: `
  else
    module = '';

  const timestamp = configs.logTimestamp ? `${getTimeStamp()} ` : '';
  const line = `tst<${log.context}>: ${timestamp}${module}${indent}${message}`;
  if (useConsole)
    console.log(line, ...args);

  log.logs.push(`${line} ${args.reduce((output, arg, index) => {
    output += `${index == 0 ? '' : ', '}${uneval(arg)}`;
    return output;
  }, '')}`);
  log.logs = log.logs.slice(-log.max);
}
log.context = '?';
log.max  = 2000;
log.logs = [];
log.forceStore = true;

function getTimeStamp() {
  const time = new Date();
  const hours = `0${time.getHours()}`.substr(-2);
  const minutes = `0${time.getMinutes()}`.substr(-2);
  const seconds = `0${time.getSeconds()}`.substr(-2);
  const milliseconds = `00${time.getMilliseconds()}`.substr(-3);
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

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
  return new Promise((resolve, _reject) => {
    setTimeout(async () => {
      if (task)
        await task();
      resolve();
    }, timeout);
  });
}

export function nextFrame() {
  return new Promise((resolve, _reject) => {
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

  let onClicked;
  let onClosed;
  return new Promise(async (resolve, _reject) => {
    let resolved = false;

    onClicked = notificationId => {
      if (notificationId != id)
        return;
      if (params.url) {
        browser.tabs.create({
          url: params.url
        });
      }
      resolved = true;
      resolve(true);
    };
    browser.notifications.onClicked.addListener(onClicked);

    onClosed = notificationId => {
      if (notificationId != id)
        return;
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    };
    browser.notifications.onClosed.addListener(onClosed);

    let timeout = params.timeout;
    if (typeof timeout != 'number')
      timeout = configs.notificationTimeout;
    if (timeout >= 0) {
      await wait(timeout);
    }
    await browser.notifications.clear(id);
    if (!resolved)
      resolve(false);
  }).then(clicked => {
    browser.notifications.onClicked.removeListener(onClicked);
    onClicked = null;
    browser.notifications.onClosed.removeListener(onClosed);
    onClosed = null;
    return clicked;
  });
}


// Helper functions for optimization
// Originally implemented by @bb010g at
// https://github.com/piroor/treestyletab/pull/2368/commits/9d184c4ac6c9977d2557cd17cec8c2a0f21dd527

// For better performance the callback function must return "undefined"
// when the item should not be included. "null", "false", and other false
// values will be included to the mapped result.
export function mapAndFilter(values, mapper) {
  /* This function logically equals to:
  return values.reduce((mappedValues, value) => {
    value = mapper(value);
    if (value !== undefined)
      mappedValues.push(value);
    return mappedValues;
  }, []);
  */
  const maxi = ('length' in values ? values.length : values.size) >>> 0; // define as unsigned int
  const mappedValues = new Array(maxi); // prepare with enough size at first, to avoid needless re-allocation
  let count = 0,
      value, // this must be defined outside of the loop, to avoid needless re-allocation
      mappedValue; // this must be defined outside of the loop, to avoid needless re-allocation
  for (value of values) {
    mappedValue = mapper(value);
    if (mappedValue !== undefined)
      mappedValues[count++] = mappedValue;
  }
  mappedValues.length = count; // shrink the array at last
  return mappedValues;
}

export function mapAndFilterUniq(values, mapper, options = {}) {
  const mappedValues = new Set();
  let value, // this must be defined outside of the loop, to avoid needless re-allocation
      mappedValue; // this must be defined outside of the loop, to avoid needless re-allocation
  for (value of values) {
    mappedValue = mapper(value);
    if (mappedValue !== undefined)
      mappedValues.add(mappedValue);
  }
  return options.set ? mappedValues : Array.from(mappedValues);
}

export function countMatched(values, matcher) {
  /* This function logically equals to:
  return values.reduce((count, value) => {
    if (matcher(value))
      count++;
    return count;
  }, 0);
  */
  let count = 0,
      value; // this must be defined outside of the loop, to avoid needless re-allocation
  for (value of values) {
    if (matcher(value))
      count++;
  }
  return count;
}

export function toLines(values, mapper, separator = '\n') {
  /* This function logically equals to:
  return values.reduce((output, value, index) => {
    output += `${index == 0 ? '' : '\n'}${mapper(value)}`;
    return output;
  }, '');
  */
  const maxi = values.length >>> 0; // define as unsigned int
  let i = 0,
      lines = '';
  while (i < maxi) { // use "while" loop instead "for" loop, for better performance
    lines += `${i == 0 ? '' : separator}${mapper(values[i])}`;
    i++;
  }
  return lines;
}
