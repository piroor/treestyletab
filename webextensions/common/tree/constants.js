/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kBACKGROUND_CONTENTS_VERSION = 2;
const kSIDEBAR_CONTENTS_VERSION    = 3;

const kCOMMAND_PING_TO_BACKGROUND             = 'treestyletab:ping-to-background';
const kCOMMAND_PING_TO_SIDEBAR                = 'treestyletab:ping-to-sidebar';
const kCOMMAND_REQUEST_CONNECT_PREFIX         = 'treestyletab:request-connect-from:';
const kCOMMAND_REQUEST_UNIQUE_ID              = 'treestyletab:request-unique-id';
const kCOMMAND_REQUEST_REGISTERED_ADDONS      = 'treestyletab:request-registered-addons';
const kCOMMAND_REQUEST_SCROLL_LOCK_STATE      = 'treestyletab:request-scroll-lock-state';
const kCOMMAND_PULL_TAB_ID_TABLES             = 'treestyletab:pull-tab-id-tables';
const kCOMMAND_BROADCAST_TAB_ID_TABLES_UPDATE = 'treestyletab:broadcast-tab-id-tables-update';
const kCOMMAND_PUSH_TREE_STRUCTURE            = 'treestyletab:push-tree-structure';
const kCOMMAND_PULL_TREE_STRUCTURE            = 'treestyletab:pull-tree-structure';
const kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE = 'treestyletab:change-subtree-collapsed-state';
const kCOMMAND_CHANGE_TAB_COLLAPSED_STATE     = 'treestyletab:change-tab-collapsed-state';
const kCOMMAND_LOAD_URI                       = 'treestyletab:load-uri';
const kCOMMAND_NEW_WINDOW_FROM_TABS           = 'treestyletab:open-new-window-from-tabs';
const kCOMMAND_MOVE_TABS                      = 'treestyletab:move-tabs';
const kCOMMAND_NEW_TABS                       = 'treestyletab:open-new-tabs';
const kCOMMAND_SELECT_TAB_INTERNALLY          = 'treestyletab:select-tab-internally';
const kCOMMAND_REMOVE_TABS_INTERNALLY         = 'treestyletab:remove-tabs-internally';
const kCOMMAND_MOVE_TABS_BEFORE               = 'treestyletab:move-tabs-internally-before';
const kCOMMAND_MOVE_TABS_AFTER                = 'treestyletab:move-tabs-internally-after';
const kCOMMAND_CONFIRM_TO_CLOSE_TABS          = 'treestyletab:confirm-to-close-tabs';
const kCOMMAND_NOTIFY_START_TAB_SWITCH        = 'treestyletab:notify-start-tab-switch';
const kCOMMAND_NOTIFY_END_TAB_SWITCH          = 'treestyletab:notify-end-tab-switch';
const kCOMMAND_NOTIFY_PERMISSIONS_GRANTED     = 'treestyletab:notify-permissions-granted';
const kCOMMAND_NOTIFY_TAB_RESTORING           = 'treestyletab:notify-tab-restoring';
const kCOMMAND_NOTIFY_TAB_RESTORED            = 'treestyletab:notify-tab-restored';
const kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED     = 'treestyletab:notify-tab-favicon-updated';
const kCOMMAND_BROADCAST_CURRENT_DRAG_DATA    = 'treestyletab:broadcast-current-drag-data';
const kCOMMAND_BROADCAST_API_REGISTERED       = 'treestyletab:broadcast-registered';
const kCOMMAND_BROADCAST_API_UNREGISTERED     = 'treestyletab:broadcast-unregistered';
const kCOMMAND_SHOW_CONTAINER_SELECTOR        = 'treestyletab:show-container-selector';
const kCOMMAND_SCROLL_TABBAR                  = 'treestyletab:scroll-tabbar';

const kCOMMAND_SELECT_TAB              = 'treestyletab:select-tab';
const kCOMMAND_SET_SUBTREE_MUTED       = 'treestyletab:set-subtree-muted';
const kCOMMAND_ATTACH_TAB_TO           = 'treestyletab:attach-tab-to';
const kCOMMAND_TAB_ATTACHED_COMPLETELY = 'treestyletab:tab-attached-completely';
const kCOMMAND_DETACH_TAB              = 'treestyletab:detach-tab';
const kCOMMAND_PERFORM_TABS_DRAG_DROP  = 'treestyletab:perform-tabs-drag-drop';
const kCOMMAND_BLOCK_USER_OPERATIONS   = 'treestyletab:block-user-operations';
const kCOMMAND_UNBLOCK_USER_OPERATIONS = 'treestyletab:unblock-user-operations';
const kCOMMAND_BROADCAST_TAB_STATE     = 'treestyletab:broadcast-tab-state';

const kNOTIFY_TAB_MOUSEDOWN  = 'treestyletab:tab-mousedown';

const kNOTIFY_SIDEBAR_FOCUS = 'treestyletab:sidebar-focus';
const kNOTIFY_SIDEBAR_BLUR  = 'treestyletab:sidebar-blur';

const kTSTAPI_REGISTER_SELF         = 'register-self';
const kTSTAPI_UNREGISTER_SELF       = 'unregister-self';
const kTSTAPI_PING                  = 'ping';
const kTSTAPI_NOTIFY_READY          = 'ready';
const kTSTAPI_NOTIFY_SHUTDOWN       = 'shutdown'; // defined but not notified for now.
const kTSTAPI_NOTIFY_TAB_CLICKED    = 'tab-clicked'; // for backward compatibility
const kTSTAPI_NOTIFY_TAB_MOUSEDOWN  = 'tab-mousedown';
const kTSTAPI_NOTIFY_TAB_MOUSEUP    = 'tab-mouseup';
const kTSTAPI_NOTIFY_TABBAR_CLICKED = 'tabbar-clicked'; // for backward compatibility
const kTSTAPI_NOTIFY_TABBAR_MOUSEDOWN = 'tabbar-mousedown';
const kTSTAPI_NOTIFY_TABBAR_MOUSEUP = 'tabbar-mouseup';
const kTSTAPI_NOTIFY_TAB_MOUSEMOVE  = 'tab-mousemove';
const kTSTAPI_NOTIFY_TAB_MOUSEOVER  = 'tab-mouseover';
const kTSTAPI_NOTIFY_TAB_MOUSEOUT   = 'tab-mouseout';
const kTSTAPI_NOTIFY_TAB_DRAGREADY  = 'tab-dragready';
const kTSTAPI_NOTIFY_TAB_DRAGCANCEL = 'tab-dragcancel';
const kTSTAPI_NOTIFY_TAB_DRAGSTART  = 'tab-dragstart';
const kTSTAPI_NOTIFY_TAB_DRAGENTER  = 'tab-dragenter';
const kTSTAPI_NOTIFY_TAB_DRAGEXIT   = 'tab-dragexit';
const kTSTAPI_NOTIFY_TAB_DRAGEND    = 'tab-dragend';
const kTSTAPI_NOTIFY_TRY_MOVE_FOCUS_FROM_CLOSING_CURRENT_TAB = 'try-move-focus-from-closing-current-tab';
const kTSTAPI_GET_TREE              = 'get-tree';
const kTSTAPI_ATTACH                = 'attach';
const kTSTAPI_DETACH                = 'detach';
const kTSTAPI_INDENT                = 'indent';
const kTSTAPI_DEMOTE                = 'demote';
const kTSTAPI_OUTDENT               = 'outdent';
const kTSTAPI_PROMOTE               = 'promote';
const kTSTAPI_MOVE_UP               = 'move-up';
const kTSTAPI_MOVE_DOWN             = 'move-down';
const kTSTAPI_FOCUS                 = 'focus';
const kTSTAPI_DUPLICATE             = 'duplicate';
const kTSTAPI_GROUP_TABS            = 'group-tabs';
const kTSTAPI_GET_TREE_STRUCTURE    = 'get-tree-structure';
const kTSTAPI_SET_TREE_STRUCTURE    = 'set-tree-structure';
const kTSTAPI_COLLAPSE_TREE         = 'collapse-tree';
const kTSTAPI_EXPAND_TREE           = 'expand-tree';
const kTSTAPI_ADD_TAB_STATE         = 'add-tab-state';
const kTSTAPI_REMOVE_TAB_STATE      = 'remove-tab-state';
const kTSTAPI_SCROLL                = 'scroll';
const kTSTAPI_SCROLL_LOCK           = 'scroll-lock';
const kTSTAPI_SCROLL_UNLOCK         = 'scroll-unlock';
const kTSTAPI_NOTIFY_SCROLLED       = 'scrolled';
const kTSTAPI_BLOCK_GROUPING        = 'block-grouping';
const kTSTAPI_UNBLOCK_GROUPING      = 'unblock-grouping';

const kAPI_TAB_ID       = 'data-tab-id';
const kAPI_WINDOW_ID    = 'data-window-id';

const kPARENT        = 'data-parent-id';
const kCHILDREN      = 'data-child-ids';
const kLEVEL         = 'data-level';
const kCLOSED_SET_ID = 'data-closed-set-id';
const kDROP_POSITION = 'data-drop-position';
const kCURRENT_URI   = 'data-current-uri';
const kMAX_TREE_LEVEL = 'data-max-tree-level';

const kPERSISTENT_ID            = 'data-persistent-id';
const kPERSISTENT_ANCESTORS     = 'ancestors';
const kPERSISTENT_CHILDREN      = 'children';
const kPERSISTENT_INSERT_BEFORE = 'insert-before';
const kPERSISTENT_INSERT_AFTER  = 'isnert-after';
const kPERSISTENT_SUBTREE_COLLAPSED = 'subtree-collapsed';
const kPERSISTENT_SPECIAL_TAB_STATES = 'special-tab-states';

const kFAVICON         = 'favicon';
const kFAVICON_IMAGE   = 'favicon-image';
const kFAVICON_BUILTIN = 'favicon-builtin';
const kFAVICON_DEFAULT = 'favicon-default'; // just for backward compatibility, and this should be removed from future versions
const kTHROBBER        = 'throbber';
const kACTIVE_MARKER   = 'active-marker';
const kBURSTER         = 'burster';
const kSOUND_BUTTON    = 'sound-button';
const kTWISTY          = 'twisty';
const kLABEL           = 'label';
const kCOUNTER         = 'counter';
const kCLOSEBOX        = 'closebox';
const kNEWTAB_BUTTON   = 'newtab-button';
const kEXTRA_ITEMS_CONTAINER        = 'extra-items-container';
const kCONTEXTUAL_IDENTITY_MARKER   = 'contextual-identity-marker';
const kCONTEXTUAL_IDENTITY_SELECTOR = 'contextual-identities-selector';
const kNEWTAB_ACTION_SELECTOR       = 'newtab-action-selector';

const kTAB_STATE_ACTIVE                    = 'active';
const kTAB_STATE_PINNED                    = 'pinned';
const kTAB_STATE_LAST_ROW                  = 'last-row';
const kTAB_STATE_AUDIBLE                   = 'audible';
const kTAB_STATE_SOUND_PLAYING             = 'sound-playing';
const kTAB_STATE_HAS_SOUND_PLAYING_MEMBER  = 'has-sound-playing-member';
const kTAB_STATE_MUTED                     = 'muted';
const kTAB_STATE_HAS_MUTED_MEMBER          = 'has-muted-member';
const kTAB_STATE_PRIVATE_BROWSING          = 'private-browsing';
const kTAB_STATE_HIDDEN                    = 'hidden';
const kTAB_STATE_ANIMATION_READY           = 'animation-ready';
const kTAB_STATE_NOT_ACTIVATED_SINCE_LOAD  = 'not-activated-since-load';
const kTAB_STATE_BURSTING                  = 'bursting';
const kTAB_STATE_REMOVING                  = 'removing';
const kTAB_STATE_COLLAPSED                 = 'collapsed';
const kTAB_STATE_COLLAPSED_DONE            = 'collapsed-completely';
const kTAB_STATE_COLLAPSING                = 'collapsing';
const kTAB_STATE_EXPANDING                 = 'expanding';
const kTAB_STATE_MOVING                    = 'moving';
const kTAB_STATE_SUBTREE_COLLAPSED         = 'subtree-collapsed';
const kTAB_STATE_SUBTREE_EXPANDED_MANUALLY = 'subtree-expanded-manually';
const kTAB_STATE_FAVICONIZED               = 'faviconized';
const kTAB_STATE_UNREAD                    = 'unread';
const kTAB_STATE_HIGHLIGHTED               = 'highlighted';
const kTAB_STATE_DISCARDED                 = 'discarded';
const kTAB_STATE_SELECTED                  = 'selected';
const kTAB_STATE_DRAGGING                  = 'dragging';
const kTAB_STATE_OPENING                   = 'opening';
const kTAB_STATE_DUPLICATING               = 'duplicating';
const kTAB_STATE_RESTORED                  = 'restored';
const kTAB_STATE_THROBBER_UNSYNCHRONIZED   = 'throbber-unsynchronized';
const kTAB_INTERNAL_STATES = [
  'tab',
  kTAB_STATE_LAST_ROW,
  kTAB_STATE_ANIMATION_READY,
  kTAB_STATE_COLLAPSED_DONE,
  kTAB_STATE_OPENING,
  kTAB_STATE_DUPLICATING,
  kTAB_STATE_COLLAPSING,
  kTAB_STATE_EXPANDING,
  kTAB_STATE_MOVING,
  kTAB_STATE_THROBBER_UNSYNCHRONIZED
];

const kTABBAR_STATE_OVERFLOW               = 'overflow';
const kTABBAR_STATE_TAB_DRAGGING           = 'tab-dragging';
const kTABBAR_STATE_LINK_DRAGGING          = 'link-dragging';
const kTABBAR_STATE_BLOCKING               = 'blocking';
const kTABBAR_STATE_BLOCKING_WITH_THROBBER = 'blocking-throbber';
const kTABBAR_STATE_HAVE_LOADING_TAB       = 'have-loading-tab';
const kTABBAR_STATE_THROBBER_SYNCHRONIZING = 'throbber-synchronizing';
const kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE = 'contextual-identity-selectable';
const kTABBAR_STATE_NEWTAB_ACTION_SELECTABLE = 'newtab-action-selectable';
const kTABBAR_STATE_NARROW_SCROLLBAR       = 'narrow-scrollbar';
const kTABBAR_STATE_NO_SCROLLBAR           = 'no-scrollbar';
const kTABBAR_STATE_OVERLAY_SCROLLBAR      = 'overlay-scrollbar';

const kWINDOW_STATE_TREE_STRUCTURE  = 'tree-structure';
const kWINDOW_STATE_SCROLL_POSITION = 'scroll-position';
const kWINDOW_STATE_CACHED_TABS     = 'cached-tabs';
const kWINDOW_STATE_CACHED_SIDEBAR  = 'cached-sidebar-contents';
const kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY = 'cached-sidebar-contents:tabs-dirty';
const kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY = 'cached-sidebar-contents:collapsed-dirty';

const kCOUNTER_ROLE_ALL_TABS       = 1;
const kCOUNTER_ROLE_CONTAINED_TABS = 2;

const kTABBAR_POSITION_LEFT  = 1;
const kTABBAR_POSITION_RIGHT = 2;

const kTABBAR_DIRECTION_LTR = 1;
const kTABBAR_DIRECTION_RTL = 2;

const kTABBAR_SCROLLBAR_POSITION_AUTO  = 0;
const kTABBAR_SCROLLBAR_POSITION_LEFT  = 1;
const kTABBAR_SCROLLBAR_POSITION_RIGHT = 2;

const kTABBAR_SCROLLBAR_MODE_DEFAULT = 0;
const kTABBAR_SCROLLBAR_MODE_NARROW  = 1;
const kTABBAR_SCROLLBAR_MODE_HIDE    = 2;
const kTABBAR_SCROLLBAR_MODE_OVERLAY = 3;

const kDROP_BEFORE  = 'before';
const kDROP_ON_SELF = 'self';
const kDROP_AFTER   = 'after';

const kACTION_MOVE   = 1 << 0;
const kACTION_ATTACH = 1 << 10;
const kACTION_DETACH = 1 << 11;

const kDROPLINK_ASK    = 0;
const kDROPLINK_LOAD   = 1 << 0;
const kDROPLINK_NEWTAB = 1 << 1;

const kGROUP_BOOKMARK_ASK                         = 0;
const kGROUP_BOOKMARK_SUBTREE                     = 1 << 0;
const kGROUP_BOOKMARK_SEPARATE                    = 1 << 1;
const kGROUP_BOOKMARK_FIXED                       = kGROUP_BOOKMARK_SUBTREE | kGROUP_BOOKMARK_SEPARATE;
const kGROUP_BOOKMARK_USE_DUMMY                   = 1 << 8;
const kGROUP_BOOKMARK_USE_DUMMY_FORCE             = 1 << 10;
const kGROUP_BOOKMARK_DONT_RESTORE_TREE_STRUCTURE = 1 << 9;
const kGROUP_BOOKMARK_EXPAND_ALL_TREE             = 1 << 11;
const kGROUP_BOOKMARK_CANCEL                      = -1;

const kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD        = 3;
const kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN       = 0;
const kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN        = 1;
const kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN = 4;
const kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN         = 2; // onTabRemoved only
const kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB     = 5;

const kPARENT_TAB_BEHAVIOR_ALWAYS            = 0;
const kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE = 1;
const kPARENT_TAB_BEHAVIOR_ONLY_ON_SIDEBAR   = 2;

const kINSERT_NO_CONTROL = -1;
const kINSERT_FIRST      = 0;
const kINSERT_END        = 1;
const kINSERT_NEAREST    = 2;

const kNEWTAB_DO_NOTHING           = -1;
const kNEWTAB_OPEN_AS_ORPHAN       = 0;
const kNEWTAB_OPEN_AS_CHILD        = 1;
const kNEWTAB_OPEN_AS_SIBLING      = 2;
const kNEWTAB_OPEN_AS_NEXT_SIBLING = 3;

const kSCROLL_TO_NEW_TAB_IGNORE      = 0;
const kSCROLL_TO_NEW_TAB_IF_POSSIBLE = 1;

const kTABBAR_UPDATE_REASON_RESIZE        = 1 << 0;
const kTABBAR_UPDATE_REASON_COLLAPSE      = 1 << 1;
const kTABBAR_UPDATE_REASON_EXPAND        = 1 << 2;
const kTABBAR_UPDATE_REASON_ANIMATION_END = 1 << 3;
const kTABBAR_UPDATE_REASON_TAB_OPEN      = 1 << 4;
const kTABBAR_UPDATE_REASON_TAB_CLOSE     = 1 << 5;
const kTABBAR_UPDATE_REASON_TAB_MOVE      = 1 << 6;

const kDEFAULT_MIN_INDENT = 3;

const kTAB_STATE_GROUP_TAB = 'group-tab';
const kGROUP_TAB_URI = browser.extension.getURL('resources/group-tab.html');
const kGROUP_TAB_DEFAULT_TITLE_MATCHER = new RegExp(`^${browser.i18n.getMessage('groupTab_label', '.+')}$`);
const kGROUP_TAB_FROM_PINNED_DEFAULT_TITLE_MATCHER = new RegExp(`^${browser.i18n.getMessage('groupTab_fromPinnedTab_label', '.+')}$`);
const kSHORTHAND_ABOUT_URI = /^about:treestyletab-([^\?]+)/;
const kSHORTHAND_URIS = {
  group:   kGROUP_TAB_URI,
  startup: browser.extension.getURL('resources/startup.html')
};

const kNOTIFICATION_DEFAULT_ICON = '/resources/icon64.png';

// for generated IDs
const kID_ADJECTIVES = `
Agile
Breezy
Cheerful
Dapper
Edgy
Feisty
Gutsy
Hoary
Intrepid
Jaunty
Karmic
Lucid
Marveric
Natty
Oneiric
Precise
Quantal
Raring
Saucy
Trusty
Utopic
Vivid
Warty
Xenial
Yakkety
Zesty
`.toLowerCase().trim().split(/\s+/);
const kID_NOUNS = `
Alpaca
Badger
Cat
Drake
Eft
Fawn
Gibbon
Heron
Ibis
Jackalope
Koala
Lynx
Meerkat
Narwhal
Ocelot
Pangolin
Quetzal
Ringtail
Salamander
Tahr
Unicorn
Vervet
Werwolf
Xerus
Yak
Zapus
`.toLowerCase().trim().split(/\s+/);
