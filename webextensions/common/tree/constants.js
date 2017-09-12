/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kCOMMAND_PING_TO_BACKGROUND = 'treestyletab:ping-to-background';
const kCOMMAND_PING_TO_SIDEBAR = 'treestyletab:ping-to-sidebar';
const kCOMMAND_REQUEST_UNIQUE_ID = 'treestyletab:request-unique-id';
const kCOMMAND_PULL_TREE_STRUCTURE = 'treestyletab:pull-tree-structure';
const kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE = 'treestyletab:change-subtree-collapsed-state';
const kCOMMAND_LOAD_URI = 'treestyletab:load-uri';
const kCOMMAND_NEW_WINDOW_FROM_TABS = 'treestyletab:open-new-window-from-tabs';
const kCOMMAND_MOVE_TABS = 'treestyletab:move-tabs';
const kCOMMAND_NEW_TABS = 'treestyletab:open-new-tabs';
const kCOMMAND_SELECT_TAB_INTERNALLY = 'treestyletab:select-tab-internally';
const kCOMMAND_MOVE_TABS_INTERNALLY_BEFORE = 'treestyletab:move-tabs-internally-before';
const kCOMMAND_MOVE_TABS_INTERNALLY_AFTER = 'treestyletab:move-tabs-internally-after';

const kCOMMAND_SELECT_TAB = 'treestyletab:select-tab';
const kCOMMAND_SET_SUBTREE_MUTED = 'treestyletab:set-subtree-muted';
const kCOMMAND_REMOVE_TAB = 'treestyletab:remove-tab';
const kCOMMAND_ATTACH_TAB_TO = 'treestyletab:attach-tab-to';
const kCOMMAND_DETACH_TAB = 'treestyletab:detach-tab';
const kCOMMAND_PERFORM_TABS_DRAG_DROP = 'treestyletab:perform-tabs-drag-drop';
const kCOMMAND_BLOCK_USER_OPERATIONS = 'treestyletab:block-user-operations';
const kCOMMAND_UNBLOCK_USER_OPERATIONS = 'treestyletab:unblock-user-operations';
const kCOMMAND_BROADCAST_TAB_STATE = 'treestyletab:broadcast-tab-state';

const kNOTIFY_TAB_MOUSEDOWN = 'treestyletab:tab-mousedown';
const kNOTIFY_SIDEBAR_OPENED = 'treestyletab:sidebar-opened';
const kNOTIFY_SIDEBAR_CLOSED = 'treestyletab:sidebar-closed';

const kTSTAPI_REGISTER_SELF        = 'register-self';
const kTSTAPI_UNREGISTER_SELF      = 'unregister-self';
const kTSTAPI_NOTIFY_READY         = 'ready';
const kTSTAPI_NOTIFY_TAB_CLICKED   = 'tab-clicked';
const kTSTAPI_NOTIFY_TAB_DRAGSTART = 'tab-dragstart';
const kTSTAPI_NOTIFY_TAB_DRAGENTER = 'tab-dragenter';
const kTSTAPI_NOTIFY_TAB_DRAGEXIT  = 'tab-dragexit';
const kTSTAPI_NOTIFY_TAB_DRAGEND   = 'tab-dragend';
const kTSTAPI_IS_SUBTREE_COLLAPSED = 'is-subtree-collapsed';
const kTSTAPI_HAS_CHILD_TABS       = 'has-child-tabs';
const kTSTAPI_GET_DESCENDANT_TABS  = 'get-descendant-tabs';
const kTSTAPI_GET_TAB_STATE        = 'get-tab-state';
const kTSTAPI_ADD_TAB_STATE        = 'add-tab-state';
const kTSTAPI_REMOVE_TAB_STATE     = 'remove-tab-state';

const kAPI_TAB_ID = 'data-tab-id';
const kAPI_WINDOW_ID = 'data-window-id';
const kCONTENT_LOCATION = 'data-content-location';
const kPARENT   = 'data-parent-id';
const kCHILDREN = 'data-child-ids';
const kLEVEL = 'data-level';
const kINSERT_BEFORE = 'data-insert-before-id';
const kINSERT_AFTER  = 'data-insert-after-id';
const kCLOSED_SET_ID = 'data-closed-set-id';
const kDROP_POSITION = 'data-drop-position';

const kPERSISTENT_ID        = 'data-persistent-id';
const kPERSISTENT_ANCESTORS = 'ancestors';
const kPERSISTENT_CHILDREN  = 'children';
const kPERSISTENT_INSERT_BEFORE = 'insert-before';
const kPERSISTENT_INSERT_AFTER  = 'isnert-after';

const kFAVICON  = 'favicon';
const kFAVICON_IMAGE = 'favicon-image';
const kFAVICON_DEFAULT = 'favicon-default';
const kTHROBBER = 'throbber';
const kSOUND_BUTTON = 'sound-button';
const kTWISTY   = 'twisty';
const kLABEL    = 'label';
const kCOUNTER  = 'counter';
const kCLOSEBOX = 'closebox';
const kCONTEXTUAL_IDENTITY_MARKER = 'contextual-identity-marker';
const kEXTRA_ITEMS_CONTAINER = 'extra-items-container';
const kNEWTAB_BUTTON = 'newtab-button';
const kCONTEXTUAL_IDENTITY_SELECTOR = 'contextual-identities-selector';

const kTAB_STATE_ACTIVE = 'active';
const kTAB_STATE_PINNED = 'pinned';
const kTAB_STATE_LAST_ROW = 'last-row';
const kTAB_STATE_AUDIBLE = 'audible';
const kTAB_STATE_SOUND_PLAYING = 'sound-playing';
const kTAB_STATE_HAS_SOUND_PLAYING_MEMBER = 'has-sound-playing-member';
const kTAB_STATE_MUTED = 'muted';
const kTAB_STATE_HAS_MUTED_MEMBER = 'has-muted-member';
const kTAB_STATE_PRIVATE_BROWSING = 'private-browsing';
const kTAB_STATE_HIDDEN = 'hidden';
const kTAB_STATE_ANIMATION_READY = 'animation-ready';
const kTAB_STATE_REMOVING = 'removing';
const kTAB_STATE_COLLAPSED = 'collapsed';
const kTAB_STATE_COLLAPSED_DONE = 'collapsed-completely';
const kTAB_STATE_COLLAPSING = 'collapsing';
const kTAB_STATE_EXPANDING = 'expanding';
const kTAB_STATE_SUBTREE_COLLAPSED = 'subtree-collapsed';
const kTAB_STATE_SUBTREE_EXPANDED_MANUALLY = 'subtree-expanded-manually';
const kTAB_STATE_FAVICONIZED = 'faviconized';
const kTAB_STATE_UNREAD = 'unread';
const kTAB_STATE_HIGHLIGHTED = 'highlighted';
const kTAB_STATE_SELECTED = 'selected';
const kTAB_STATE_READY_TO_CLOSE = 'ready-to-close';
const kTAB_STATE_POSSIBLE_CLOSING_CURRENT = 'possible-closing-current';
const kTAB_STATE_DRAGGING = 'dragging';
const kTAB_STATE_DUPLICATING = 'duplicating';

const kTABBAR_STATE_OVERFLOW = 'overflow';
const kTABBAR_STATE_TAB_DRAGGING = 'tab-dragging';
const kTABBAR_STATE_BLOCKING = 'blocking';
const kTABBAR_STATE_BLOCKING_WITH_THROBBER = 'blocking-throbber';

const kWINDOW_STATE_TREE_STRUCTURE = 'tree-structure';

const kCOUNTER_ROLE_ALL_TABS = 1;
const kCOUNTER_ROLE_CONTAINED_TABS = 2;

const kTABBAR_POSITION_LEFT = 1;
const kTABBAR_POSITION_RIGHT = 2;

const kDROP_BEFORE = -1;
const kDROP_ON = 0;
const kDROP_AFTER = 1;

const kACTION_MOVE   = 1 << 0;
const kACTION_ATTACH = 1 << 10;
const kACTION_DETACH = 1 << 11;

const kDROPLINK_ASK = 0;
const kDROPLINK_LOAD = 1 << 0;
const kDROPLINK_NEWTAB = 1 << 1;
const kDROPLINK_FIXED = kDROPLINK_LOAD | kDROPLINK_NEWTAB;

const kGROUP_BOOKMARK_ASK = 0;
const kGROUP_BOOKMARK_SUBTREE = 1 << 0;
const kGROUP_BOOKMARK_SEPARATE = 1 << 1;
const kGROUP_BOOKMARK_FIXED = kGROUP_BOOKMARK_SUBTREE | kGROUP_BOOKMARK_SEPARATE;
const kGROUP_BOOKMARK_USE_DUMMY = 1 << 8;
const kGROUP_BOOKMARK_USE_DUMMY_FORCE = 1 << 10;
const kGROUP_BOOKMARK_DONT_RESTORE_TREE_STRUCTURE = 1 << 9;
const kGROUP_BOOKMARK_EXPAND_ALL_TREE = 1 << 11;
const kGROUP_BOOKMARK_CANCEL = -1;

const kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD        = 3;
const kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN       = 0;
const kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN        = 1;
const kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN = 4;
const kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN         = 2; // onTabRemoved only
const kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB     = 5;

const kPARENT_TAB_BEHAVIOR_ALWAYS            = 0;
const kPARENT_TAB_BEHAVIOR_ONLY_WHEN_VISIBLE = 1;

const kINSERT_NO_CONTROL = -1;
const kINSERT_FISRT = 0;
const kINSERT_LAST = 1;

const kNEWTAB_DO_NOTHING           = -1;
const kNEWTAB_OPEN_AS_ORPHAN       = 0;
const kNEWTAB_OPEN_AS_CHILD        = 1;
const kNEWTAB_OPEN_AS_SIBLING      = 2;
const kNEWTAB_OPEN_AS_NEXT_SIBLING = 3;

const kSCROLL_TO_NEW_TAB_IGNORE = 0;
const kSCROLL_TO_NEW_TAB_IF_POSSIBLE = 1;

const kDEFAULT_MIN_INDENT = 3;

const kTAB_STATE_GROUP_TAB = 'group-tab';
const kGROUP_TAB_URI = browser.extension.getURL('resources/group-tab.html');

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
