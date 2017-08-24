/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

var kCOMMAND_PULL_TREE_STRUCTURE = 'treestyletab:pull-tree-structure';
var kCOMMAND_PUSH_TREE_STRUCTURE = 'treestyletab:push-tree-structure';
var kCOMMAND_PUSH_SUBTREE_COLLAPSED_STATE = 'treestyletab:push-subtree-collapsed-state';
var kCOMMAND_SELECT_TAB = 'treestyletab:request-select-tab';
var kCOMMAND_SELECT_TAB_INTERNALLY = 'treestyletab:request-select-tab-internally';
var kCOMMAND_REMOVE_TAB = 'treestyletab:request-remove-tab';
var kCOMMAND_NEW_TAB = 'treestyletab:request-new-tab';

var kEVENT_TAB_OPENING = 'treestyletab:tab-opening';
var kEVENT_TAB_OPENED = 'treestyletab:tab-opened';
var kEVENT_TAB_CLOSED = 'treestyletab:tab-closed';
var kEVENT_TAB_MOVED = 'treestyletab:tab-moved';
var kEVENT_TAB_FOCUSING = 'treestyletab:tab-focusing';
var kEVENT_TAB_FOCUSED = 'treestyletab:tab-focused';
var kEVENT_TAB_UPDATED = 'treestyletab:tab-updated';
var kEVENT_TAB_PINNED = 'treestyletab:tab-pinned';
var kEVENT_TAB_UNPINNED = 'treestyletab:tab-unpinned';
var kEVENT_TAB_ATTACHED = 'treestyletab:tab-attached';
var kEVENT_TAB_DETACHED = 'treestyletab:tab-detached';
var kEVENT_TAB_LEVEL_CHANGED = 'treestyletab:tab-level-changed';
var kEVENT_TAB_COLLAPSED_STATE_CHANGING = 'treestyletab:tab-collapsed-state-changing';
var kEVENT_TAB_SUBTREE_COLLAPSED_STATE_CHANGED_MANUALLY = 'treestyletab:tab-subtree-collapsed-state-changed-manually';
var kEVENT_EXPANDED_TREE_READY_TO_SCROLL = 'treestyletab:expanded-tree-ready-to-scroll';

var kPARENT   = 'data-parent-id';
var kCHILDREN = 'data-child-ids';
var kANCESTORS = 'data-ancestor-ids';
var kNEST     = 'data-nest';
var kINSERT_BEFORE = 'data-insert-before-id';
var kINSERT_AFTER  = 'data-insert-after-id';
var kCLOSED_SET_ID = 'data-closed-set-id';
var kTWISTY_STYLE = 'data-twisty-style';

var kCOLLAPSING_PHASE = 'data-collapsing-phase';
var kCOLLAPSING_PHASE_TO_BE_COLLAPSED = 'collapse';
var kCOLLAPSING_PHASE_TO_BE_EXPANDED  = 'expand';

var kFAVICON  = 'favicon';
var kTHROBBER = 'throbber';
var kSOUND_BUTTON = 'sound-button';
var kTWISTY   = 'twisty';
var kLABEL    = 'label';
var kCOUNTER  = 'counter';
var kCLOSEBOX = 'closebox';
var kNEWTAB_BUTTON = 'newtab-button';

var kTAB_STATE_ACTIVE = 'active';
var kTAB_STATE_PINNED = 'pinned';
var kTAB_STATE_HIDDEN = 'hidden';
var kTAB_STATE_ANIMATION_READY = 'animation-ready';
var kTAB_STATE_REMOVING = 'removing';
var kTAB_STATE_COLLAPSED = 'collapsed';
var kTAB_STATE_COLLAPSED_DONE = 'collapsed-completely';
var kTAB_STATE_SUBTREE_COLLAPSED = 'subtree-collapsed';
var kTAB_STATE_SUBTREE_EXPANDED_MANUALLY = 'subtree-expanded-manually';
var kTAB_STATE_FAVICONIZED = 'faviconized';
var kTAB_STATE_HIGHLIGHTED = 'highlighted';
var kTAB_STATE_POSSIBLE_CLOSING_CURRENT = 'possible-closing-current';

var kTABBAR_STATE_OVERFLOW = 'overflow';

var kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD        = 3;
var kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN       = 0;
var kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN        = 1;
var kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN = 4;
var kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN         = 2; // onTabRemoved only
var kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB     = 5;

var kDEFAULT_FAVICON_URL = '';
