/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const kCOMMAND_PULL_TREE_STRUCTURE = 'treestyletab:pull-tree-structure';
const kCOMMAND_PUSH_TREE_STRUCTURE = 'treestyletab:push-tree-structure';
const kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE = 'treestyletab:change-subtree-collapsed-state';
const kCOMMAND_SELECT_TAB = 'treestyletab:request-select-tab';
const kCOMMAND_SELECT_TAB_INTERNALLY = 'treestyletab:request-select-tab-internally';
const kCOMMAND_REMOVE_TAB = 'treestyletab:request-remove-tab';
const kCOMMAND_NEW_TABS = 'treestyletab:request-new-tabs';
const kCOMMAND_ATTACH_TAB_TO = 'treestyletab:request-attach-tab-to';
const kCOMMAND_DETACH_TAB = 'treestyletab:request-detach-tab';
const kCOMMAND_MOVE_TAB_INTERNALLY_BEFORE = 'treestyletab:request-move-tab-internally-before';
const kCOMMAND_MOVE_TABS_INTERNALLY_AFTER = 'treestyletab:request-move-tabs-internally-after';
const kCOMMAND_LOAD_URI = 'treestyletab:request-load-uri';

const kPARENT   = 'data-parent-id';
const kCHILDREN = 'data-child-ids';
const kANCESTORS = 'data-ancestor-ids';
const kNEST     = 'data-nest';
const kINSERT_BEFORE = 'data-insert-before-id';
const kINSERT_AFTER  = 'data-insert-after-id';
const kCLOSED_SET_ID = 'data-closed-set-id';
const kTWISTY_STYLE = 'data-twisty-style';
const kDROP_POSITION = 'data-drop-position';

const kCOLLAPSING_PHASE = 'data-collapsing-phase';
const kCOLLAPSING_PHASE_TO_BE_COLLAPSED = 'collapse';
const kCOLLAPSING_PHASE_TO_BE_EXPANDED  = 'expand';

const kFAVICON  = 'favicon';
const kFAVICON_IMAGE = 'favicon-image';
const kFAVICON_DEFAULT = 'favicon-default';
const kTHROBBER = 'throbber';
const kSOUND_BUTTON = 'sound-button';
const kTWISTY   = 'twisty';
const kLABEL    = 'label';
const kCOUNTER  = 'counter';
const kCLOSEBOX = 'closebox';
const kNEWTAB_BUTTON = 'newtab-button';

const kTAB_STATE_ACTIVE = 'active';
const kTAB_STATE_PINNED = 'pinned';
const kTAB_STATE_HIDDEN = 'hidden';
const kTAB_STATE_ANIMATION_READY = 'animation-ready';
const kTAB_STATE_REMOVING = 'removing';
const kTAB_STATE_COLLAPSED = 'collapsed';
const kTAB_STATE_COLLAPSED_DONE = 'collapsed-completely';
const kTAB_STATE_SUBTREE_COLLAPSED = 'subtree-collapsed';
const kTAB_STATE_SUBTREE_EXPANDED_MANUALLY = 'subtree-expanded-manually';
const kTAB_STATE_FAVICONIZED = 'faviconized';
const kTAB_STATE_HIGHLIGHTED = 'highlighted';
const kTAB_STATE_POSSIBLE_CLOSING_CURRENT = 'possible-closing-current';
const kTAB_STATE_DRAGGING = 'dragging';

const kTABBAR_STATE_OVERFLOW = 'overflow';
const kTABBAR_STATE_TAB_DRAGGING = 'tab-dragging';

const kDROP_BEFORE = -1;
const kDROP_ON = 0;
const kDROP_AFTER = 1;

const kACTION_MOVE = 1 << 0;
const kACTION_STAY = 1 << 1;
const kACTION_DUPLICATE = 1 << 2;
const kACTION_IMPORT = 1 << 3;
const kACTION_NEWTAB = 1 << 4;
const kACTION_ATTACH = 1 << 10;
const kACTION_DETACH = 1 << 11;
const kACTION_AFFECTS_TO_SOURCE = (1 << 0) | (1 << 1);
const kACTION_AFFECTS_TO_DESTINATION = (1 << 2) | (1 << 3);

const kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD        = 3;
const kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN       = 0;
const kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN        = 1;
const kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN = 4;
const kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN         = 2; // onTabRemoved only
const kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB     = 5;

const kINSERT_NO_CONTROL = -1;
const kINSERT_FISRT = 0;
const kINSERT_LAST = 1;

