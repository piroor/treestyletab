/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2010-2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
 
const EXPORTED_SYMBOLS = ['TreeStyleTabConstants']; 

const TreeStyleTabConstants = Object.freeze({
/* attributes */
	kID                 : 'treestyletab-id',
	kCHILDREN           : 'treestyletab-children',
	kPARENT             : 'treestyletab-parent',
	kANCESTOR           : 'treestyletab-ancestors',
	kNEST               : 'treestyletab-nest',
	kINSERT_BEFORE      : 'treestyletab-insert-before',
	kINSERT_AFTER       : 'treestyletab-insert-after',
	kCLOSED_SET_ID      : 'treestyletab-closed-set-id',

	kID_NEW             : 'treestyletab-id-new',
	kID_RESTORING       : 'treestyletab-id-restoring',
	kCHILDREN_RESTORING : 'treestyletab-children-restoring',

	kSUBTREE_COLLAPSED  : 'treestyletab-subtree-collapsed',
	kSUBTREE_EXPANDED_MANUALLY : 'treestyletab-subtree-expanded-manually',
	kCOLLAPSED          : 'treestyletab-collapsed',
	kCOLLAPSED_DONE     : 'treestyletab-collapsed-done',
	kCOLLAPSING_PHASE   : 'treestyletab-collapsing-phase',
	kCOLLAPSING_PHASE_TO_BE_COLLAPSED : 'collapse',
	kCOLLAPSING_PHASE_TO_BE_EXPANDED : 'expand',
	kALLOW_COLLAPSE     : 'treestyletab-allow-subtree-collapse',
	kALLOW_STACK        : 'treestyletab-stack-collapsed-tabs',
	kREMOVED            : 'treestyletab-removed',

	kX_OFFSET           : 'treestyletab-x-offset',
	kY_OFFSET           : 'treestyletab-y-offset',

	kTABBAR_POSITION    : 'treestyletab-tabbar-position',
	kMODE               : 'treestyletab-mode',

	kHIDE_NEWTAB        : 'treestyletab-hide-newtab-button',
	kSTYLE              : 'treestyletab-style',
	kFIRSTTAB_BORDER    : 'treestyletab-firsttab-border',
	kFIXED              : 'treestyletab-tabbar-fixed',
	kRESIZING           : 'treestyletab-tabbar-resizing',
	kINDENTED           : 'treestyletab-tabs-indented',
	kMAX_LEVEL          : 'treestyletab-max-tree-level',
	kPRINT_PREVIEW      : 'treestyletab-print-preview',
	kANIMATION_ENABLED  : 'treestyletab-animation-enabled',
	kINVERT_SCROLLBAR   : 'treestyletab-invert-scrollbar',
	kNARROW_SCROLLBAR   : 'treestyletab-narrow-scrollbar',
	kFAVICONIZED        : 'treestyletab-faviconized',
	kBG_NOTIFY_PHASE    : 'treestyletab-notifybgtab-phase',
	kIGNORE_POPUP_STATE : 'treestyletab-ignore-state',
	kDOM_FULLSCREEN_ACTIVATED : 'treestyletab-dom-fullscreen-activated',

	kTAB_INVERTED          : 'treestyletab-tab-inverted',
	kTAB_CONTENTS_INVERTED : 'treestyletab-tab-contents-inverted',
	kCLOSEBOX_INVERTED     : 'treestyletab-closebox-inverted',

	kTWISTY_HOVER       : 'treestyletab-twisty-hover',
	kTWISTY_STYLE       : 'treestyletab-twisty-style',

	kDROP_POSITION      : 'treestyletab-drop-position',
	kDRAG_TYPE_TABBAR   : 'application/x-moz-treestyletab-tabbrowser-tabbar',
	kDROP_POSITION_UNKNOWN : 'unknown',
	kTABBAR_MOVE_FORCE  : 'force',
	kTABBAR_MOVE_NORMAL : 'normal',

	kTAB_STRIP_ELEMENT  : 'treestyletab-tabstrip-element',

/* classes */
	kTWISTY                     : 'treestyletab-twisty',
	kCOUNTER                    : 'treestyletab-counter',
	kCOUNTER_CONTAINER          : 'treestyletab-counter-container',
	kCOUNTER_PAREN              : 'treestyletab-counter-paren',
	kSPLITTER                   : 'treestyletab-splitter',
	kTABBAR_TOGGLER             : 'treestyletab-tabbar-toggler',
	kTABBAR_PLACEHOLDER         : 'treestyletab-tabbar-placeholder',
	kTABBAR_TOOLBAR             : 'treestyletab-tabbar-toolbar',
	kTABBAR_TOOLBAR_READY       : 'treestyletab-tabbar-toolbar-ready',
	kTABBAR_TOOLBAR_READY_POPUP : 'treestyletab-tabbar-toolbar-ready-popup',

/* event types, topics */
	kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN : 'nsDOMTreeStyleTabFocusSwitchingKeyDown',
	kEVENT_TYPE_TAB_FOCUS_SWITCHING_START    : 'nsDOMTreeStyleTabFocusSwitchingStart',
	kEVENT_TYPE_TAB_FOCUS_SWITCHING_END      : 'nsDOMTreeStyleTabFocusSwitchingEnd',
	kTAB_FOCUS_SWITCHING_SCROLL_DOWN    : (1 << 0),
	kTAB_FOCUS_SWITCHING_SCROLL_UP      : (1 << 1),
	kTAB_FOCUS_SWITCHING_STAND_BY       : (1 << 2),
	kTAB_FOCUS_SWITCHING_ONLY_SHIFT_KEY : (1 << 3),
	kEVENT_TYPE_SUBTREE_CLOSING              : 'nsDOMTreeStyleTabSubtreeClosing',
	kEVENT_TYPE_SUBTREE_CLOSED               : 'nsDOMTreeStyleTabSubtreeClosed',
	kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED  : 'nsDOMTreeStyleTabCollapsedStateChange',
	kEVENT_TYPE_TABBAR_INITIALIZED           : 'nsDOMTreeStyleTabTabbarInitialized',
	kEVENT_TYPE_TABBAR_POSITION_CHANGING     : 'nsDOMTreeStyleTabTabbarPositionChanging',
	kEVENT_TYPE_TABBAR_POSITION_CHANGED      : 'nsDOMTreeStyleTabTabbarPositionChanged',
	kEVENT_TYPE_TABBAR_STATE_CHANGING        : 'nsDOMTreeStyleTabTabbarStateChanging',
	kEVENT_TYPE_TABBAR_STATE_CHANGED         : 'nsDOMTreeStyleTabTabbarStateChanged',
	kEVENT_TYPE_FOCUS_NEXT_TAB               : 'nsDOMTreeStyleTabFocusNextTab',
	kEVENT_TYPE_ATTACHED                     : 'nsDOMTreeStyleTabAttached',
	kEVENT_TYPE_DETACHED                     : 'nsDOMTreeStyleTabParted',

	kEVENT_TYPE_PRINT_PREVIEW_ENTERED        : 'nsDOMTreeStyleTabPrintPreviewEntered',
	kEVENT_TYPE_PRINT_PREVIEW_EXITED         : 'nsDOMTreeStyleTabPrintPreviewExited',
	kEVENT_TYPE_AUTO_HIDE_STATE_CHANGING     : 'nsDOMTreeStyleTabAutoHideStateChanging',
	kEVENT_TYPE_AUTO_HIDE_STATE_CHANGE       : 'nsDOMTreeStyleTabAutoHideStateChange',

	kTOPIC_INDENT_MODIFIED              : 'TreeStyleTab:indentModified',
	kTOPIC_COLLAPSE_EXPAND_ALL          : 'TreeStyleTab:collapseExpandAllSubtree',
	kTOPIC_CHANGE_TREEVIEW_AVAILABILITY : 'TreeStyleTab:changeTreeViewAvailability',

/* other constant values */
	kFOCUS_ALL     : 0,
	kFOCUS_VISIBLE : 1,

	kDROP_BEFORE : -1,
	kDROP_ON     : 0,
	kDROP_AFTER  : 1,

	kACTION_MOVE      : 1 << 0,
	kACTION_STAY      : 1 << 1,
	kACTION_DUPLICATE : 1 << 2,
	kACTION_IMPORT    : 1 << 3,
	kACTION_NEWTAB    : 1 << 4,
	kACTION_ATTACH    : 1 << 10,
	kACTION_PART      : 1 << 11,
	kACTIONS_FOR_SOURCE      : (1 << 0) | (1 << 1),
	kACTIONS_FOR_DESTINATION : (1 << 2) | (1 << 3),

	kTABBAR_TOP    : 1 << 0,
	kTABBAR_BOTTOM : 1 << 1,
	kTABBAR_LEFT   : 1 << 2,
	kTABBAR_RIGHT  : 1 << 3,

	kTABBAR_HORIZONTAL : (1 << 0) | (1 << 1),
	kTABBAR_VERTICAL   : (1 << 2) | (1 << 3),
	kTABBAR_REGULAR    : (1 << 0) | (1 << 2),
	kTABBAR_INVERTED   : (1 << 3) | (1 << 4),

	kINSERT_FISRT : 0,
	kINSERT_LAST  : 1,

	kTABBAR_UPDATE_BY_UNKNOWN_REASON    : (1 << 0),
	kTABBAR_UPDATE_BY_RESET             : (1 << 1),
	kTABBAR_UPDATE_BY_PREF_CHANGE       : (1 << 2),
	kTABBAR_UPDATE_BY_APPEARANCE_CHANGE : (1 << 3),
	kTABBAR_UPDATE_BY_SHOWHIDE_TABBAR   : (1 << 4),
	kTABBAR_UPDATE_BY_TABBAR_RESIZE     : (1 << 5),
	kTABBAR_UPDATE_BY_WINDOW_RESIZE     : (1 << 6),
	kTABBAR_UPDATE_BY_FULLSCREEN        : (1 << 7),
	kTABBAR_UPDATE_BY_AUTOHIDE          : (1 << 9),
	kTABBAR_UPDATE_BY_INITIALIZE        : (1 << 10),
	kTABBAR_UPDATE_BY_TOGGLE_SIDEBAR    : (1 << 11),
	kTABBAR_UPDATE_NOW                 : (1 << 5) | (1 << 6) | (1 << 9) | (1 << 10),
	kTABBAR_UPDATE_SYNC_TO_TABBAR      : (1 << 0) | (1 << 1) | (1 << 2) | (1 << 5) | (1 << 9),
	kTABBAR_UPDATE_SYNC_TO_PLACEHOLDER : (1 << 3) | (1 << 4) | (1 << 6) | (1 << 7) | (1 << 10) | (1 << 11),

	kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD        : 3,
	kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN       : 0,
	kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN        : 1,
	kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN : 4,
	kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN         : 2, // onTabRemoved only

	kRESTORE_TREE_LEVEL_NONE   : 0,
	kRESTORE_TREE_ONLY_VISIBLE : 1,
	kRESTORE_TREE_ALL          : 2,

	kCOUNTER_ROLE_ALL_TABS       : 1,
	kCOUNTER_ROLE_CONTAINED_TABS : 2,

	MAX_TABBAR_SIZE_RATIO        : 0.8,
	DEFAULT_SHRUNKEN_WIDTH_RATIO : 0.67,
	MIN_TABBAR_WIDTH : 24,
	MIN_TABBAR_HEIGHT : 24
});
