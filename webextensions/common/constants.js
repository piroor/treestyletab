/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export const kBACKGROUND_CONTENTS_VERSION = 5;
export const kSIDEBAR_CONTENTS_VERSION    = 9;

export const kCOMMAND_GET_INSTANCE_ID                = 'treestyletab:get-instance-id';
export const kCOMMAND_RELOAD                         = 'treestyletab:reload';
export const kCOMMAND_PING_TO_BACKGROUND             = 'treestyletab:ping-to-background';
export const kCOMMAND_PING_TO_SIDEBAR                = 'treestyletab:ping-to-sidebar';
export const kCOMMAND_REQUEST_CONNECT_PREFIX         = 'treestyletab:request-connect-from:';
export const kCOMMAND_REQUEST_UNIQUE_ID              = 'treestyletab:request-unique-id';
export const kCOMMAND_GET_CONFIG_VALUE               = 'treestyletab:get-config-value';
export const kCOMMAND_SET_CONFIG_VALUE               = 'treestyletab:set-config-value';
export const kCOMMAND_PULL_TABS                      = 'treestyletab:pull-tabs';
export const kCOMMAND_SYNC_TABS_ORDER                = 'treestyletab:sync-tabs-order';
export const kCOMMAND_PULL_TABS_ORDER                = 'treestyletab:pull-tabs-order';
export const kCOMMAND_PULL_TREE_STRUCTURE            = 'treestyletab:pull-tree-structure';
export const kCOMMAND_LOAD_URI                       = 'treestyletab:load-uri';
export const kCOMMAND_OPEN_TAB                       = 'treestyletab:open-tab';
export const kCOMMAND_NEW_WINDOW_FROM_TABS           = 'treestyletab:open-new-window-from-tabs';
export const kCOMMAND_NEW_TABS                       = 'treestyletab:open-new-tabs';
export const kCOMMAND_NEW_TAB_AS                     = 'treestyletab:open-new-tab-as';
export const kCOMMAND_REMOVE_TABS_INTERNALLY         = 'treestyletab:remove-tabs-internally';
export const kCOMMAND_UPDATE_LOADING_STATE           = 'treestyletab:update-loading-state';
export const kCOMMAND_CONFIRM_TO_CLOSE_TABS          = 'treestyletab:confirm-to-close-tabs';
export const kCOMMAND_CONFIRM_TO_AUTO_GROUP_NEW_TABS = 'treestyletab:confirm-to-auto-group-new-tabs';
export const kCOMMAND_NOTIFY_TAB_CREATING            = 'treestyletab:notify-tab-creating';
export const kCOMMAND_NOTIFY_TAB_CREATED             = 'treestyletab:notify-tab-created';
export const kCOMMAND_NOTIFY_TAB_UPDATED             = 'treestyletab:notify-tab-updated';
export const kCOMMAND_NOTIFY_TAB_MOVED               = 'treestyletab:notify-tab-moved';
export const kCOMMAND_NOTIFY_TAB_INTERNALLY_MOVED    = 'treestyletab:notify-tab-internally-moved';
export const kCOMMAND_NOTIFY_TAB_REMOVING            = 'treestyletab:notify-tab-removing';
export const kCOMMAND_NOTIFY_TAB_REMOVED             = 'treestyletab:notify-tab-removed';
export const kCOMMAND_NOTIFY_TAB_ACTIVATED           = 'treestyletab:notify-tab-activated';
export const kCOMMAND_NOTIFY_START_TAB_SWITCH        = 'treestyletab:notify-start-tab-switch';
export const kCOMMAND_NOTIFY_END_TAB_SWITCH          = 'treestyletab:notify-end-tab-switch';
export const kCOMMAND_NOTIFY_TAB_ATTACHED_TO_WINDOW   = 'treestyletab:notify-tab-attached-to-window';
export const kCOMMAND_NOTIFY_TAB_DETACHED_FROM_WINDOW = 'treestyletab:notify-tab-detached-from-window';
export const kCOMMAND_NOTIFY_PERMISSIONS_GRANTED     = 'treestyletab:notify-permissions-granted';
export const kCOMMAND_NOTIFY_TAB_PINNED              = 'treestyletab:notify-tab-pinned';
export const kCOMMAND_NOTIFY_TAB_UNPINNED            = 'treestyletab:notify-tab-unpinned';
export const kCOMMAND_NOTIFY_TAB_SHOWN               = 'treestyletab:notify-tab-shown';
export const kCOMMAND_NOTIFY_TAB_HIDDEN              = 'treestyletab:notify-tab-hidden';
export const kCOMMAND_NOTIFY_TAB_RESTORING           = 'treestyletab:notify-tab-restoring';
export const kCOMMAND_NOTIFY_TAB_RESTORED            = 'treestyletab:notify-tab-restored';
export const kCOMMAND_NOTIFY_TAB_LABEL_UPDATED       = 'treestyletab:notify-tab-label-updated';
export const kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED     = 'treestyletab:notify-tab-favicon-updated';
export const kCOMMAND_NOTIFY_TAB_SOUND_STATE_UPDATED = 'treestyletab:notify-tab-sound-state-updated';
export const kCOMMAND_NOTIFY_TABS_CLOSING            = 'treestyletab:notify-tabs-closing';
export const kCOMMAND_NOTIFY_HIGHLIGHTED_TABS_CHANGED = 'treestyletab:notify-highlighted-tabs-changed';
export const kCOMMAND_NOTIFY_GROUP_TAB_DETECTED      = 'treestyletab:notify-group-tab-detected';
export const kCOMMAND_NOTIFY_CHILDREN_CHANGED        = 'treestyletab:notify-children-changed';
export const kCOMMAND_NOTIFY_TAB_COLLAPSED_STATE_CHANGED     = 'treestyletab:notify-tab-collapsed-state-changed';
export const kCOMMAND_NOTIFY_SUBTREE_COLLAPSED_STATE_CHANGED = 'treestyletab:notify-subtree-collapsed-state-changed';
export const kCOMMAND_SET_SUBTREE_COLLAPSED_STATE                   = 'treestyletab:set-subtree-collapsed-state';
export const kCOMMAND_SET_SUBTREE_COLLAPSED_STATE_INTELLIGENTLY_FOR = 'treestyletab:set-subtree-collapsed-state-intelligently-for';
export const kCOMMAND_NOTIFY_TAB_LEVEL_CHANGED       = 'treestyletab:notify-tab-level-changed';
export const kCOMMAND_NOTIFY_TAB_ATTACHED_COMPLETELY = 'treestyletab:notify-tab-attached-completely';
export const kCOMMAND_BROADCAST_CURRENT_DRAG_DATA    = 'treestyletab:broadcast-current-drag-data';
export const kCOMMAND_SHOW_CONTAINER_SELECTOR        = 'treestyletab:show-container-selector';
export const kCOMMAND_SCROLL_TABBAR                  = 'treestyletab:scroll-tabbar';
export const kCOMMAND_TOGGLE_SUBPANEL                = 'treestyletab:toggle-subpanel';
export const kCOMMAND_SWITCH_SUBPANEL                = 'treestyletab:switch-subpanel';
export const kCOMMAND_INCREASE_SUBPANEL              = 'treestyletab:increase-subpanel';
export const kCOMMAND_DECREASE_SUBPANEL              = 'treestyletab:decrease-subpanel';
export const kCOMMAND_REQUEST_QUERY_LOGS             = 'treestyletab:request-query-logs';
export const kCOMMAND_RESPONSE_QUERY_LOGS            = 'treestyletab:response-query-logs';
export const kCOMMAND_REQUEST_CONNECTION_MESSAGE_LOGS  = 'treestyletab:request-connection-message-logs';
export const kCOMMAND_RESPONSE_CONNECTION_MESSAGE_LOGS = 'treestyletab:response-connection-message-logs';
export const kCOMMAND_NOTIFY_TEST_KEY_CHANGED        = 'treestyletab:notify-test-key-changed';
export const kCOMMAND_SIMULATE_SIDEBAR_MESSAGE       = 'treestyletab:simulate-sidebar-message';

export const kCOMMAND_SELECT_TAB              = 'treestyletab:select-tab';
export const kCOMMAND_SET_SUBTREE_MUTED       = 'treestyletab:set-subtree-muted';
export const kCOMMAND_PERFORM_TABS_DRAG_DROP  = 'treestyletab:perform-tabs-drag-drop';
export const kCOMMAND_BLOCK_USER_OPERATIONS   = 'treestyletab:block-user-operations';
export const kCOMMAND_UNBLOCK_USER_OPERATIONS = 'treestyletab:unblock-user-operations';
export const kCOMMAND_PROGRESS_USER_OPERATIONS = 'treestyletab:progress-user-operations';
export const kCOMMAND_BROADCAST_TAB_STATE     = 'treestyletab:broadcast-tab-state';

export const kCOMMAND_BOOKMARK_TAB_WITH_DIALOG  = 'treestyletab:bookmark-tab-with-dialog';
export const kCOMMAND_BOOKMARK_TABS_WITH_DIALOG = 'treestyletab:bookmark-tabs-with-dialog';

export const kNOTIFY_TAB_MOUSEDOWN  = 'treestyletab:tab-mousedown';
export const kNOTIFY_TAB_MOUSEDOWN_EXPIRED  = 'treestyletab:tab-mousedown-expired';

export const kNOTIFY_SIDEBAR_FOCUS = 'treestyletab:sidebar-focus';
export const kNOTIFY_SIDEBAR_BLUR  = 'treestyletab:sidebar-blur';

export const kAPI_TAB_ID       = 'data-tab-id';
export const kAPI_WINDOW_ID    = 'data-window-id';

export const kPARENT        = 'data-parent-id';
export const kCHILDREN      = 'data-child-ids';
export const kLEVEL         = 'data-level';
export const kCLOSED_SET_ID = 'data-closed-set-id';
export const kCURRENT_URI   = 'data-current-uri';
export const kMAX_TREE_LEVEL = 'data-max-tree-level';
export const kLABEL_OVERFLOW = 'data-label-overflow';

export const kPERSISTENT_ID            = 'data-persistent-id';
export const kPERSISTENT_ANCESTORS     = 'ancestors';
export const kPERSISTENT_CHILDREN      = 'children';
export const kPERSISTENT_INSERT_BEFORE = 'insert-before';
export const kPERSISTENT_INSERT_AFTER  = 'isnert-after';
export const kPERSISTENT_STATES        = 'special-tab-states';
export const kPERSISTENT_SUBTREE_COLLAPSED = 'subtree-collapsed'; // obsolete
export const kPERSISTENT_ORIGINAL_OPENER_TAB_ID            = 'data-original-opener-tab-id';
export const kPERSISTENT_ALREADY_GROUPED_FOR_PINNED_OPENER = 'data-already-grouped-for-pinned-opener';

export const kFAVICON         = 'favicon';
export const kFAVICON_IMAGE   = 'favicon-image';
export const kFAVICON_BUILTIN = 'favicon-builtin';
export const kFAVICON_DEFAULT = 'favicon-default'; // just for backward compatibility, and this should be removed from future versions
export const kTHROBBER        = 'throbber';
export const kHIGHLIGHTER     = 'highlighter';
export const kBURSTER         = 'burster';
export const kSOUND_BUTTON    = 'sound-button';
export const kTWISTY          = 'twisty';
export const kLABEL           = 'label';
export const kCOUNTER         = 'counter';
export const kNEWTAB_BUTTON   = 'newtab-button';
export const kEXTRA_ITEMS_CONTAINER        = 'extra-items-container';
export const kCONTEXTUAL_IDENTITY_MARKER   = 'contextual-identity-marker';
export const kCONTEXTUAL_IDENTITY_SELECTOR = 'contextual-identities-selector';
export const kCONTEXTUAL_IDENTITY_SELECTOR_CONTEXT_MENU = 'contextual-identities-selector-context';
export const kNEWTAB_ACTION_SELECTOR       = 'newtab-action-selector';

export const kTAB_STATE_ACTIVE                    = 'active';
export const kTAB_STATE_PINNED                    = 'pinned';
export const kTAB_STATE_LAST_ROW                  = 'last-row';
export const kTAB_STATE_AUDIBLE                   = 'audible';
export const kTAB_STATE_SOUND_PLAYING             = 'sound-playing';
export const kTAB_STATE_HAS_SOUND_PLAYING_MEMBER  = 'has-sound-playing-member';
export const kTAB_STATE_MUTED                     = 'muted';
export const kTAB_STATE_HAS_MUTED_MEMBER          = 'has-muted-member';
export const kTAB_STATE_PRIVATE_BROWSING          = 'private-browsing';
export const kTAB_STATE_HIDDEN                    = 'hidden';
export const kTAB_STATE_ANIMATION_READY           = 'animation-ready';
export const kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD  = 'not-activated-since-load';
export const kTAB_STATE_BURSTING                  = 'bursting';
export const kTAB_STATE_CREATING                  = 'creating';
export const kTAB_STATE_TO_BE_REMOVED             = 'to-be-removed';
export const kTAB_STATE_REMOVING                  = 'removing';
export const kTAB_STATE_COLLAPSED                 = 'collapsed';
export const kTAB_STATE_COLLAPSED_DONE            = 'collapsed-completely';
export const kTAB_STATE_COLLAPSING                = 'collapsing';
export const kTAB_STATE_EXPANDING                 = 'expanding';
export const kTAB_STATE_MOVING                    = 'moving';
export const kTAB_STATE_SHOWING                   = 'showing';
export const kTAB_STATE_SUBTREE_COLLAPSED         = 'subtree-collapsed';
export const kTAB_STATE_SUBTREE_EXPANDED_MANUALLY = 'subtree-expanded-manually';
export const kTAB_STATE_FAVICONIZED               = 'faviconized';
export const kTAB_STATE_UNREAD                    = 'unread';
export const kTAB_STATE_HIGHLIGHTED               = 'highlighted';
export const kTAB_STATE_BUNDLED_ACTIVE            = 'bundled-active';
export const kTAB_STATE_SOME_DESCENDANTS_HIGHLIGHTED = 'some-descendants-highlighted';
export const kTAB_STATE_ALL_DESCENDANTS_HIGHLIGHTED  = 'all-descendants-highlighted';
export const kTAB_STATE_ATTENTION                 = 'attention';
export const kTAB_STATE_DISCARDED                 = 'discarded';
export const kTAB_STATE_SELECTED                  = 'selected';
export const kTAB_STATE_DRAGGING                  = 'dragging';
export const kTAB_STATE_DUPLICATING               = 'duplicating';
export const kTAB_STATE_RESTORED                  = 'restored';
export const kTAB_STATE_THROBBER_UNSYNCHRONIZED   = 'throbber-unsynchronized';
export const kTAB_STATE_GROUP_TAB                 = 'group-tab';
export const kTAB_INTERNAL_STATES = new Set([
  'tab',
  kTAB_STATE_LAST_ROW,
  kTAB_STATE_ANIMATION_READY,
  kTAB_STATE_COLLAPSED_DONE,
  kTAB_STATE_CREATING,
  kTAB_STATE_DUPLICATING,
  kTAB_STATE_COLLAPSING,
  kTAB_STATE_EXPANDING,
  kTAB_STATE_MOVING,
  kTAB_STATE_TO_BE_REMOVED,
  kTAB_STATE_REMOVING,
  kTAB_STATE_SHOWING,
  kTAB_STATE_THROBBER_UNSYNCHRONIZED
]);
export const kTAB_TEMPORARY_STATES = new Set([
  kTAB_STATE_CREATING,
  kTAB_STATE_BURSTING,
  kTAB_STATE_COLLAPSING,
  kTAB_STATE_DUPLICATING,
  kTAB_STATE_EXPANDING,
  kTAB_STATE_MOVING,
  kTAB_STATE_TO_BE_REMOVED,
  kTAB_STATE_REMOVING,
  kTAB_STATE_SHOWING
]);
export const kTAB_SAFE_STATES = new Set([
  kTAB_STATE_COLLAPSED,
  kTAB_STATE_SUBTREE_COLLAPSED,
  kTAB_STATE_GROUP_TAB
]);
export const kTAB_SAFE_STATES_ARRAY = Array.from(kTAB_SAFE_STATES);

export const kTABBAR_STATE_OVERFLOW               = 'overflow';
export const kTABBAR_STATE_BLOCKING               = 'blocking';
export const kTABBAR_STATE_BLOCKING_WITH_THROBBER = 'blocking-throbber';
export const kTABBAR_STATE_HAVE_LOADING_TAB       = 'have-loading-tab';
export const kTABBAR_STATE_THROBBER_SYNCHRONIZING = 'throbber-synchronizing';
export const kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE = 'contextual-identity-selectable';
export const kTABBAR_STATE_NEWTAB_ACTION_SELECTABLE = 'newtab-action-selectable';
export const kTABBAR_STATE_MULTIPLE_HIGHLIGHTED   = 'mutiple-highlighted';

export const kWINDOW_STATE_TREE_STRUCTURE  = 'tree-structure';
export const kWINDOW_STATE_SCROLL_POSITION = 'scroll-position';
export const kWINDOW_STATE_SUBPANEL_PROVIDER_ID = 'subpanel-provider-id';
export const kWINDOW_STATE_SUBPANEL_HEIGHT = 'subpanel-height';
export const kWINDOW_STATE_SUBPANEL_EFFECTIVE_HEIGHT = 'subpanel-effective-height';
export const kWINDOW_STATE_CACHED_TABS     = 'cached-tabs';
export const kWINDOW_STATE_CACHED_SIDEBAR  = 'cached-sidebar-contents';
export const kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY = 'cached-sidebar-contents:tabs-dirty';
export const kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY = 'cached-sidebar-contents:collapsed-dirty';

export const kCACHE_KEYS = [
  kWINDOW_STATE_CACHED_TABS,
  kWINDOW_STATE_CACHED_SIDEBAR,
  kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY,
  kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY
];

export const kCOUNTER_ROLE_ALL_TABS       = 1;
export const kCOUNTER_ROLE_CONTAINED_TABS = 2;

export const kTABBAR_POSITION_LEFT  = 1;
export const kTABBAR_POSITION_RIGHT = 2;

export const kTABBAR_DIRECTION_LTR = 1;
export const kTABBAR_DIRECTION_RTL = 2;

export const kACTION_MOVE   = 1 << 0;
export const kACTION_ATTACH = 1 << 10;
export const kACTION_DETACH = 1 << 11;

export const kDROPLINK_ASK    = 0;
export const kDROPLINK_LOAD   = 1 << 0;
export const kDROPLINK_NEWTAB = 1 << 1;

export const kGROUP_BOOKMARK_ASK                         = 0;
export const kGROUP_BOOKMARK_SUBTREE                     = 1 << 0;
export const kGROUP_BOOKMARK_SEPARATE                    = 1 << 1;
export const kGROUP_BOOKMARK_FIXED                       = kGROUP_BOOKMARK_SUBTREE | kGROUP_BOOKMARK_SEPARATE;
export const kGROUP_BOOKMARK_USE_DUMMY                   = 1 << 8;
export const kGROUP_BOOKMARK_USE_DUMMY_FORCE             = 1 << 10;
export const kGROUP_BOOKMARK_DONT_RESTORE_TREE_STRUCTURE = 1 << 9;
export const kGROUP_BOOKMARK_EXPAND_ALL_TREE             = 1 << 11;
export const kGROUP_BOOKMARK_CANCEL                      = -1;

export const kCLOSE_PARENT_BEHAVIOR_MODE_WITH_NATIVE_TABBAR    = 0;
export const kCLOSE_PARENT_BEHAVIOR_MODE_WITHOUT_NATIVE_TABBAR = 1;
export const kCLOSE_PARENT_BEHAVIOR_MODE_CUSTOM                = -1;

export const kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD        = 3;
export const kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN       = 0;
export const kCLOSE_PARENT_BEHAVIOR_PROMOTE_INTELLIGENTLY      = 6;
export const kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN        = 1;
export const kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN = 4;
export const kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN         = 2; // onTabRemoved only
export const kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB     = 5;

export const kPARENT_TAB_BEHAVIOR_ALWAYS            = 0;
export const kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE = 1;
export const kPARENT_TAB_BEHAVIOR_ONLY_ON_SIDEBAR   = 2;

export const kINSERT_NO_CONTROL = -1;
export const kINSERT_FIRST      = 0;
export const kINSERT_END        = 1;
export const kINSERT_NEAREST    = 2;

export const kSUCCESSOR_TAB_CONTROL_NEVER            = 0;
export const kSUCCESSOR_TAB_CONTROL_SIMULATE_DEFAULT = 1;
export const kSUCCESSOR_TAB_CONTROL_IN_TREE          = 2;

export const kDRAG_BEHAVIOR_NONE           = 0;
export const kDRAG_BEHAVIOR_WHOLE_TREE     = 1 << 0;
export const kDRAG_BEHAVIOR_ALLOW_BOOKMARK = 1 << 1;
export const kDRAG_BEHAVIOR_TEAR_OFF       = 1 << 2;

export const kNEWTAB_DO_NOTHING           = -1;
export const kNEWTAB_OPEN_AS_ORPHAN       = 0;
export const kNEWTAB_OPEN_AS_CHILD        = 1;
export const kNEWTAB_OPEN_AS_SIBLING      = 2;
export const kNEWTAB_OPEN_AS_NEXT_SIBLING = 3;

export const kSCROLL_TO_NEW_TAB_IGNORE      = 0;
export const kSCROLL_TO_NEW_TAB_IF_POSSIBLE = 1;

export const kTABBAR_UPDATE_REASON_RESIZE        = 1 << 0;
export const kTABBAR_UPDATE_REASON_COLLAPSE      = 1 << 1;
export const kTABBAR_UPDATE_REASON_EXPAND        = 1 << 2;
export const kTABBAR_UPDATE_REASON_ANIMATION_END = 1 << 3;
export const kTABBAR_UPDATE_REASON_TAB_OPEN      = 1 << 4;
export const kTABBAR_UPDATE_REASON_TAB_CLOSE     = 1 << 5;
export const kTABBAR_UPDATE_REASON_TAB_MOVE      = 1 << 6;

export const kDEFAULT_MIN_INDENT = 3;

export const kGROUP_TAB_URI = browser.extension.getURL('resources/group-tab.html');
export const kGROUP_TAB_DEFAULT_TITLE_MATCHER = new RegExp(`^${browser.i18n.getMessage('groupTab_label', '.+')}$`);
export const kGROUP_TAB_FROM_PINNED_DEFAULT_TITLE_MATCHER = new RegExp(`^${browser.i18n.getMessage('groupTab_fromPinnedTab_label', '.+')}$`);
export const kSHORTHAND_CUSTOM_URI = /^ext\+treestyletab:([^:?]+)(?:[:?](.*))?$/;
export const kSHORTHAND_ABOUT_URI = /^about:treestyletab-([^?]+)/;
export const kSHORTHAND_URIS = {
  group:   kGROUP_TAB_URI,
  options: browser.extension.getURL('options/options.html?independent=true'),
  startup: browser.extension.getURL('resources/startup.html'),
  testRunner:    browser.extension.getURL('tests/runner.html'),
  'test-runner': browser.extension.getURL('tests/runner.html')
};

export const kNOTIFICATION_DEFAULT_ICON = '/resources/icon64.png';