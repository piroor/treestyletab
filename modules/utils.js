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
 * The Initial Developer of the Original Code is SHIMODA Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2010-2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro.outsider.reflex@gmail.com>
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
 
const EXPORTED_SYMBOLS = ['TreeStyleTabUtils']; 

const Cc = Components.classes;
const Ci = Components.interfaces;
 
Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://gre/modules/Services.jsm');

Components.utils.import('resource://treestyletab-modules/lib/prefs.js');
Components.utils.import('resource://treestyletab-modules/lib/namespace.jsm');
var window = getNamespaceFor('piro.sakura.ne.jp');

XPCOMUtils.defineLazyGetter(this, 'Deferred', function() {
	var ns = {};
	Components.utils.import('resource://treestyletab-modules/lib/jsdeferred.js', ns);
	return ns.Deferred;
});
XPCOMUtils.defineLazyGetter(this, 'jstimer', function() {
	var jstimer = {};
	Components.utils.import('resource://treestyletab-modules/lib/jstimer.jsm', jstimer);
	return jstimer;
});
XPCOMUtils.defineLazyGetter(this, 'boxObject', function() {
	Components.utils.import('resource://treestyletab-modules/lib/boxObject.js', {});
	return window['piro.sakura.ne.jp'].boxObject;
});
XPCOMUtils.defineLazyGetter(this, 'stringBundle', function() {
	Components.utils.import('resource://treestyletab-modules/lib/stringBundle.js', {});
	return window['piro.sakura.ne.jp'].stringBundle;
});
XPCOMUtils.defineLazyGetter(this, 'extensions', function() {
	Components.utils.import('resource://treestyletab-modules/lib/extensions.js', {});
	return window['piro.sakura.ne.jp'].extensions;
});
XPCOMUtils.defineLazyGetter(this, 'animationManager', function() {
	Components.utils.import('resource://treestyletab-modules/lib/animationManager.js', {});
	return window['piro.sakura.ne.jp'].animationManager;
});
XPCOMUtils.defineLazyGetter(this, 'autoScroll', function() {
	Components.utils.import('resource://treestyletab-modules/lib/autoScroll.js', {});
	return window['piro.sakura.ne.jp'].autoScroll;
});
XPCOMUtils.defineLazyGetter(this, 'confirmWithPopup', function() {
	var ns = {};
	Components.utils.import('resource://treestyletab-modules/lib/confirmWithPopup.js', ns);
	return ns.confirmWithPopup;
});
 
var TreeStyleTabUtils = { 
	__proto__ : window['piro.sakura.ne.jp'].prefs,
	tabsHash : null,
	inWindowDestoructionProcess : false,
	
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
	kEVENT_TYPE_BEFORE_TOOLBAR_CUSTOMIZATION : 'nsDOMTreeStyleTabBeforeToolbarCustomization',
	kEVENT_TYPE_AFTER_TOOLBAR_CUSTOMIZATION  : 'nsDOMTreeStyleTabAfterToolbarCustomization',

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
	kTABBAR_UPDATE_BY_PRIVATE_BROWSING  : (1 << 8),
	kTABBAR_UPDATE_BY_AUTOHIDE          : (1 << 9),
	kTABBAR_UPDATE_BY_INITIALIZE        : (1 << 10),
	kTABBAR_UPDATE_BY_TOGGLE_SIDEBAR    : (1 << 11),
	kTABBAR_UPDATE_NOW                 : (1 << 5) | (1 << 6) | (1 << 9) | (1 << 10),
	kTABBAR_UPDATE_SYNC_TO_TABBAR      : (1 << 0) | (1 << 1) | (1 << 2) | (1 << 5) | (1 << 8) | (1 << 9),
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
 
/* base variables */ 
	baseIndentVertical   : 12,
	baseIndentHorizontal : 4,
	shouldDetectClickOnIndentSpaces : true,

	smoothScrollEnabled  : true,
	smoothScrollDuration : 150,

	animationEnabled : true,
	indentDuration   : 200,
	collapseDuration : 150,

	shouldExpandTwistyArea : true,

	scrollToNewTabMode : false,

	counterRoleHorizontal : -1,
	counterRoleVertical : -1,
 
	get SessionStore() { 
		if (!this._SessionStore) {
			this._SessionStore = Cc['@mozilla.org/browser/sessionstore;1'].getService(Ci.nsISessionStore);
		}
		return this._SessionStore;
	},
	_SessionStore : null,

	get WindowMediator() {
		if (!this._WindowMediator) {
			this._WindowMediator = Services.wm;
		}
		return this._WindowMediator;
	},
	_WindowMediator : null,

	get PromptService()
	{
		if (!this._PromptService) {
			this._PromptService = Services.prompt;
		}
		return this._PromptService;
	},
	_PromptService : null,

	get FocusManager()
	{
		if (!this._FocusManager) {
			this._FocusManager = Cc['@mozilla.org/focus-manager;1'].getService(Ci.nsIFocusManager);
		}
		return this._FocusManager;
	},
	 _FocusManager : null,

	get Comparator() {
		if (!this._Comparator) {
			this._Comparator = Services.vc;
		}
		return this._Comparator;
	},
	_Comparator : null,
 
	get isGecko10OrLater() 
	{
		return this.Comparator.compare(Services.appinfo.version, '10.0a') > 0;
	},
 
	get treeBundle() { 
		return stringBundle.get('chrome://treestyletab/locale/treestyletab.properties');
	},
	get tabbrowserBundle() {
		return stringBundle.get('chrome://browser/locale/tabbrowser.properties');
	},
 
	get extensions() { return extensions; }, 
	get animationManager() { return animationManager; },
	get autoScroll() { return autoScroll; },
	get Deferred() { return Deferred; },
 
	init : function TSTUtils_init() 
	{
		if (this._initialized) return;

		this.isMac = Services.appinfo.OS == 'Darwin';

		this.applyPlatformDefaultPrefs();
		this.migratePrefs();

		this.addPrefListener(this);

		this.onPrefChange('extensions.treestyletab.indent.vertical');
		this.onPrefChange('extensions.treestyletab.indent.horizontal');
		this.onPrefChange('extensions.treestyletab.clickOnIndentSpaces.enabled');
		this.onPrefChange('browser.tabs.loadFolderAndReplace.override');
		this.onPrefChange('browser.tabs.insertRelatedAfterCurrent.override');
		this.onPrefChange('extensions.stm.tabBarMultiRows.override'); // Super Tab Mode
		this.onPrefChange('extensions.treestyletab.tabbar.scroll.smooth');
		this.onPrefChange('extensions.treestyletab.tabbar.scroll.duration');
		this.onPrefChange('extensions.treestyletab.tabbar.scrollToNewTab.mode');
		this.onPrefChange('extensions.treestyletab.tabbar.narrowScrollbar.size');
		this.onPrefChange('extensions.treestyletab.animation.enabled');
		this.onPrefChange('extensions.treestyletab.animation.indent.duration');
		this.onPrefChange('extensions.treestyletab.animation.collapse.duration');
		this.onPrefChange('extensions.treestyletab.twisty.expandSensitiveArea');
		this.onPrefChange('extensions.treestyletab.counter.role.horizontal');
		this.onPrefChange('extensions.treestyletab.counter.role.vertical');

		try {
			if (Services.appinfo.OS == 'WINNT')
				this.updateAeroPeek();
		}
		catch(e) {
			dump(e+'\n');
		}

		try {
			this.overrideExtensions();
		}
		catch(e) {
			dump(e+'\n');
		}
	},
	_initialized : false,
	applyPlatformDefaultPrefs : function TSTUtils_applyPlatformDefaultPrefs()
	{
		var OS = Services.appinfo.OS;
		var processed = {};
		var originalKeys = this.getDescendant('extensions.treestyletab.platform.'+OS);
		for (let i = 0, maxi = originalKeys.length; i < maxi; i++)
		{
			let originalKey = originalKeys[i];
			let key = originalKey.replace('platform.'+OS+'.', '');
			this.setDefaultPref(key, this.getPref(originalKey));
			processed[key] = true;
		}
		originalKeys = this.getDescendant('extensions.treestyletab.platform.default');
		for (let i = 0, maxi = originalKeys.length; i < maxi; i++)
		{
			let originalKey = originalKeys[i];
			let key = originalKey.replace('platform.default.', '');
			if (!(key in processed))
				this.setDefaultPref(key, this.getPref(originalKey));
		}
	},
	kPREF_VERSION : 9,
	migratePrefs : function TSTUtils_migratePrefs() 
	{
		// migrate old prefs
		var orientalPrefs = [];
		switch (this.getTreePref('prefsVersion'))
		{
			case 0:
				orientalPrefs = orientalPrefs.concat([
					'extensions.treestyletab.tabbar.fixed',
					'extensions.treestyletab.enableSubtreeIndent',
					'extensions.treestyletab.allowSubtreeCollapseExpand'
				]);
			case 1:
			case 2:
				if (this.getTreePref('urlbar.loadSameDomainToNewChildTab') !== null) {
					let value = this.getTreePref('urlbar.loadSameDomainToNewChildTab');
					this.setTreePref('urlbar.loadSameDomainToNewTab', value);
					this.setTreePref('urlbar.loadSameDomainToNewTab.asChild', value);
					if (value) this.setTreePref('urlbar.loadDifferentDomainToNewTab', value);
					this.clearTreePref('urlbar.loadSameDomainToNewChildTab');
				}
			case 3:
				if (this.getTreePref('loadDroppedLinkToNewChildTab') !== null) {
					this.setTreePref('dropLinksOnTab.behavior',
						this.getTreePref('loadDroppedLinkToNewChildTab.confirm') ?
							this.kDROPLINK_ASK :
						this.getTreePref('loadDroppedLinkToNewChildTab') ?
							this.kDROPLINK_NEWTAB :
							this.kDROPLINK_LOAD
					);
					this.clearTreePref('loadDroppedLinkToNewChildTab.confirm');
					this.clearTreePref('loadDroppedLinkToNewChildTab');
				}
				if (this.getTreePref('openGroupBookmarkAsTabSubTree') !== null) {
					let behavior = 0;
					if (this.getTreePref('openGroupBookmarkAsTabSubTree.underParent'))
						behavior += this.kGROUP_BOOKMARK_USE_DUMMY;
					if (!this.getTreePref('openGroupBookmarkBehavior.confirm')) {
						behavior += (
							this.getTreePref('openGroupBookmarkAsTabSubTree') ?
								this.kGROUP_BOOKMARK_SUBTREE :
							this.getTreePref('browser.tabs.loadFolderAndReplace') ?
								this.kGROUP_BOOKMARK_REPLACE :
								this.kGROUP_BOOKMARK_SEPARATE
						);
					}
					this.setTreePref('openGroupBookmark.behavior', behavior);
					this.clearTreePref('openGroupBookmarkBehavior.confirm');
					this.clearTreePref('openGroupBookmarkAsTabSubTree');
					this.clearTreePref('openGroupBookmarkAsTabSubTree.underParent');
					this.setPref('browser.tabs.loadFolderAndReplace', !!(behavior & this.kGROUP_BOOKMARK_REPLACE));
				}
			case 4:
				let (prefs = [
						'extensions.treestyletab.autoCollapseExpandSubTreeOnSelect',
						'extensions.treestyletab.autoCollapseExpandSubTreeOnSelect.onCurrentTabRemove',
						'extensions.treestyletab.autoCollapseExpandSubTreeOnSelect.whileFocusMovingByShortcut',
						'extensions.treestyletab.autoExpandSubTreeOnAppendChild',
						'extensions.treestyletab.autoExpandSubTreeOnCollapsedChildFocused',
						'extensions.treestyletab.collapseExpandSubTree.dblclick',
						'extensions.treestyletab.createSubTree.underParent',
						'extensions.treestyletab.show.context-item-reloadTabSubTree',
						'extensions.treestyletab.show.context-item-removeTabSubTree',
						'extensions.treestyletab.show.context-item-bookmarkTabSubTree',
						'extensions.multipletab.show.multipletab-selection-item-removeTabSubTree',
						'extensions.multipletab.show.multipletab-selection-item-createSubTree'
					]) {
					for (let i = 0, maxi = prefs.length; i < maxi; i++)
					{
						let pref = prefs[i];
						let value = this.getPref(pref);
						if (value === null) continue;
						this.setPref(pref.replace('SubTree', 'Subtree'), value);
						this.clearPref(pref);
					}
				}
			case 5:
				let (behavior = this.getTreePref('openGroupBookmark.behavior')) {
					behavior = behavior | 2048;
					this.setTreePref('openGroupBookmark.behavior', behavior);
				}
			case 6:
				let (
					general = this.getTreePref('autoAttachNewTabsAsChildren'),
					search = this.getTreePref('autoAttachSearchResultAsChildren')
					) {
					if (general !== null)
						this.setTreePref('autoAttach', general);
					if (search !== null)
						this.setTreePref('autoAttach.searchResult', search);
				}
			case 7:
				let (
					enabled = this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut'),
					delay = this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay')
					) {
					if (enabled !== null) {
						this.setTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut', enabled);
						this.setTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut.collapseOthers', enabled);
					}
					if (delay !== null)
						this.setTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay', delay);
				}
			case 8:
				orientalPrefs = orientalPrefs.concat([
					'extensions.treestyletab.indent',
					'extensions.treestyletab.indent.min'
				]);
			default:
				for (let i = 0, maxi = orientalPrefs.length; i < maxi; i++)
				{
					let pref = orientalPrefs[i];
					let value = this.getPref(pref);
					if (value === null) continue;
					this.setPref(pref+'.horizontal', value);
					this.setPref(pref+'.vertical', value);
					this.clearPref(pref);
				}
				break;
		}
		this.setTreePref('prefsVersion', this.kPREF_VERSION);
	},
	
	updateAeroPeek : function TSTUtils_updateAeroPeek() 
	{
		var ns = {};
		Components.utils.import('resource://gre/modules/WindowsPreviewPerTab.jsm', ns);
		this.AeroPeek = ns.AeroPeek;
	},
 
	overrideExtensions : function TSTUtils_overrideExtensions() 
	{
		// Scriptish
		// https://addons.mozilla.org/firefox/addon/scriptish/
		if (this.getTreePref('compatibility.Scriptish')) {
			try {
				let tabModule = Components.utils.import('resource://scriptish/utils/Scriptish_openInTab.js', {});
				let Scriptish_openInTab = tabModule.Scriptish_openInTab;
				tabModule.Scriptish_openInTab = function(aURL, aLoadInBackground, aReuse, aChromeWin) {
					aChromeWin.TreeStyleTabService.readyToOpenChildTabNow(aChromeWin.gBrowser);
					return Scriptish_openInTab.apply(this, arguments);
				};
			}
			catch(e) {
			}
		}
	},
 
	updateNarrowScrollbarStyle : function TSTUtils_updateNarrowScrollbarStyle() 
	{
		const SSS = Cc['@mozilla.org/content/style-sheet-service;1']
					.getService(Ci.nsIStyleSheetService);

		if (this.lastAgentSheet &&
			SSS.sheetRegistered(this.lastAgentSheet, SSS.AGENT_SHEET))
			SSS.unregisterSheet(this.lastAgentSheet, SSS.AGENT_SHEET);

		const style = 'data:text/css,'+encodeURIComponent(
			<![CDATA[
				@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");

				tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]
				  .tabbrowser-arrowscrollbox
				  > scrollbox
				  > scrollbar[orient="vertical"],
				tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]
				  .tabbrowser-arrowscrollbox
				  > scrollbox
				  > scrollbar[orient="vertical"] * {
					max-width: %SIZE%;
					min-width: %SIZE%;
				}

				tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]
				  .tabbrowser-arrowscrollbox
				  > scrollbox
				  > scrollbar[orient="vertical"] {
					font-size: %SIZE%;
				}

				tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]
				  .tabbrowser-arrowscrollbox
				  > scrollbox
				  > scrollbar[orient="vertical"] * {
					padding-left: 0;
					padding-right: 0;
					margin-left: 0;
					margin-right: 0;
				}

				%FORCE_NARROW_SCROLLBAR%
			]]>.toString()
				.replace(/%FORCE_NARROW_SCROLLBAR%/g,
					this.getTreePref('tabbar.narrowScrollbar.overrideSystemAppearance') ?
						this.kOVERRIDE_SYSTEM_SCROLLBAR_APPEARANCE : '' )
				.replace(/%MODE%/g, this.kMODE)
				.replace(/%NARROW%/g, this.kNARROW_SCROLLBAR)
				.replace(/%SIZE%/g, this.getTreePref('tabbar.narrowScrollbar.size'))
			);
		this.lastAgentSheet = this.makeURIFromSpec(style);
		SSS.loadAndRegisterSheet(this.lastAgentSheet, SSS.AGENT_SHEET);
	},
	kOVERRIDE_SYSTEM_SCROLLBAR_APPEARANCE : <![CDATA[
		tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]
		  .tabbrowser-arrowscrollbox
		  > scrollbox
		  > scrollbar[orient="vertical"] {
			appearance: none;
			-moz-appearance: none;
			background: ThreeDFace;
			border: 1px solid ThreeDShadow;
		}
	]]>.toString(),
	lastAgentSheet : null,
  
	observe : function TSTUtils_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onPrefChange(aData);
				return;
		}
	},
 
/* utilities */ 
	
	getBoxObjectFor : function TSTUtils_getBoxObjectFor(aNode) 
	{
		return boxObject.getBoxObjectFor(aNode);
	},
 
	evalInSandbox : function TSTUtils_evalInSandbox(aCode, aOwner) 
	{
		try {
			var sandbox = new Components.utils.Sandbox(aOwner || 'about:blank');
			return Components.utils.evalInSandbox(aCode, sandbox);
		}
		catch(e) {
		}
		return void(0);
	},
 
	get browserWindow() 
	{
		return this.topBrowserWindow;
	},
	get topBrowserWindow()
	{
		return this.WindowMediator.getMostRecentWindow('navigator:browser');
	},
 
	get browserWindows() 
	{
		var windows = [];

		var targets = this.WindowMediator.getZOrderDOMWindowEnumerator('navigator:browser', true);
		// By the bug 156333, we cannot find windows by their Z order on Linux.
		// https://bugzilla.mozilla.org/show_bug.cgi?id=156333
		if (!targets.hasMoreElements())
			targets = this.WindowMediator.getEnumerator('navigator:browser');

		while (targets.hasMoreElements())
		{
			let target = targets.getNext()
							.QueryInterface(Ci.nsIDOMWindow);
			if ('nsIDOMWindowInternal' in Ci) // for Firefox 7 or olders
				target = target.QueryInterface(Ci.nsIDOMWindowInternal);
			windows.push(target);
		}

		return windows;
	},
 
	get browser() 
	{
		var w = this.browserWindow;
		return !w ? null :
			'SplitBrowser' in w ? w.SplitBrowser.activeBrowser :
			w.gBrowser ;
	},
 
	get window() 
	{
		return this.browser.ownerDocument.defaultView;
	},
 
	get currentDragSession() 
	{
		return Cc['@mozilla.org/widget/dragservice;1']
				.getService(Ci.nsIDragService)
				.getCurrentSession();
	},
 
	dropLinksOnTabBehavior : function TSTUtils_dropLinksOnTabBehavior() 
	{
		var behavior = this.getTreePref('dropLinksOnTab.behavior');
		if (behavior & this.kDROPLINK_FIXED) return behavior;

		var checked = { value : false };
		var newChildTab = this.PromptService.confirmEx(this.browserWindow,
				this.treeBundle.getString('dropLinkOnTab.title'),
				this.treeBundle.getString('dropLinkOnTab.text'),
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_0) +
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_1),
				this.treeBundle.getString('dropLinkOnTab.openNewChildTab'),
				this.treeBundle.getString('dropLinkOnTab.loadInTheTab'),
				null,
				this.treeBundle.getString('dropLinkOnTab.never'),
				checked
			) == 0;

		behavior = newChildTab ? this.kDROPLINK_NEWTAB : this.kDROPLINK_LOAD ;
		if (checked.value)
			this.setTreePref('dropLinksOnTab.behavior', behavior);

		return behavior
	},
	kDROPLINK_ASK    : 0,
	kDROPLINK_FIXED  : 1 + 2,
	kDROPLINK_LOAD   : 1,
	kDROPLINK_NEWTAB : 2,
 
	openGroupBookmarkBehavior : function TSTUtils_openGroupBookmarkBehavior() 
	{
		var behavior = this.getTreePref('openGroupBookmark.behavior');
		if (behavior & this.kGROUP_BOOKMARK_FIXED) return behavior;

		var dummyTabFlag = behavior & this.kGROUP_BOOKMARK_USE_DUMMY;

		var checked = { value : false };
		var button = this.PromptService.confirmEx(this.browserWindow,
				this.treeBundle.getString('openGroupBookmarkBehavior.title'),
				this.treeBundle.getString('openGroupBookmarkBehavior.text'),
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_0) +
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_1) +
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_2),
				this.treeBundle.getString('openGroupBookmarkBehavior.subTree'),
				this.treeBundle.getString('openGroupBookmarkBehavior.separate'),
				this.treeBundle.getString('openGroupBookmarkBehavior.replace'),
				this.treeBundle.getString('openGroupBookmarkBehavior.never'),
				checked
			);

		if (button < 0) button = 1;
		var behaviors = [
				this.kGROUP_BOOKMARK_SUBTREE | dummyTabFlag,
				this.kGROUP_BOOKMARK_SEPARATE,
				this.kGROUP_BOOKMARK_REPLACE
			];
		behavior = behaviors[button];

		if (checked.value) {
			this.setTreePref('openGroupBookmark.behavior', behavior);
			this.setPref('browser.tabs.loadFolderAndReplace', !!(behavior & this.kGROUP_BOOKMARK_REPLACE));
		}
		return behavior;
	},
	kGROUP_BOOKMARK_ASK       : 0,
	kGROUP_BOOKMARK_FIXED     : 1 + 2 + 4,
	kGROUP_BOOKMARK_SUBTREE   : 1,
	kGROUP_BOOKMARK_SEPARATE  : 2,
	kGROUP_BOOKMARK_REPLACE   : 4,
	kGROUP_BOOKMARK_USE_DUMMY                   : 256,
	kGROUP_BOOKMARK_USE_DUMMY_FORCE             : 1024,
	kGROUP_BOOKMARK_DONT_RESTORE_TREE_STRUCTURE : 512,
	kGROUP_BOOKMARK_EXPAND_ALL_TREE             : 2048,
 
	bookmarkDroppedTabsBehavior : function TSTUtils_bookmarkDroppedTabsBehavior() 
	{
		var behavior = this.getTreePref('bookmarkDroppedTabs.behavior');
		if (behavior & this.kBOOKMARK_DROPPED_TABS_FIXED) return behavior;

		var checked = { value : false };
		var button = this.PromptService.confirmEx(this.browserWindow,
				this.treeBundle.getString('bookmarkDroppedTabs.title'),
				this.treeBundle.getString('bookmarkDroppedTabs.text'),
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_0) +
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_1),
				this.treeBundle.getString('bookmarkDroppedTabs.bookmarkAll'),
				this.treeBundle.getString('bookmarkDroppedTabs.bookmarkOnlyParent'),
				null,
				this.treeBundle.getString('bookmarkDroppedTabs.never'),
				checked
			);

		if (button < 0) button = 1;
		var behaviors = [
				this.kBOOKMARK_DROPPED_TABS_ALL,
				this.kBOOKMARK_DROPPED_TABS_ONLY_PARENT
			];
		behavior = behaviors[button];

		if (checked.value)
			this.setTreePref('bookmarkDroppedTabs.behavior', behavior);

		return behavior;
	},
	kBOOKMARK_DROPPED_TABS_ASK         : 0,
	kBOOKMARK_DROPPED_TABS_FIXED       : 1 | 2,
	kBOOKMARK_DROPPED_TABS_ALL         : 1,
	kBOOKMARK_DROPPED_TABS_ONLY_PARENT : 2,
 
	askUndoCloseTabSetBehavior : function TSTUtils_askUndoCloseTabSetBehavior(aRestoredTab, aCount) 
	{
		var behavior = this.undoCloseTabSetBehavior;
		if (behavior & this.kUNDO_CLOSE_SET) behavior ^= this.kUNDO_CLOSE_SET;

		var self = this;
		return confirmWithPopup({
				browser  : aRestoredTab.linkedBrowser,
				label    : this.treeBundle.getFormattedString('undoCloseTabSetBehavior.label', [aCount]),
				value    : 'treestyletab-undo-close-tree',
				image    : 'chrome://treestyletab/content/res/icon.png',
				buttons  : [
					this.treeBundle.getString('undoCloseTabSetBehavior.restoreOnce'),
					this.treeBundle.getString('undoCloseTabSetBehavior.restoreForever'),
					this.treeBundle.getString('undoCloseTabSetBehavior.ignoreForever')
				],
				persistence : -1 // don't hide even if the tab is restored after the panel is shown.
			})
			.next(function(aButtonIndex) {
				if (aButtonIndex < 2) {
					behavior |= self.kUNDO_CLOSE_SET;
				}
				if (aButtonIndex > 0) {
					behavior ^= self.kUNDO_ASK;
					self.setTreePref('undoCloseTabSet.behavior', behavior);
				}
				return behavior;
			});
	},
	get undoCloseTabSetBehavior()
	{
		return this.getTreePref('undoCloseTabSet.behavior');
	},
	kUNDO_ASK            : 1,
	kUNDO_CLOSE_SET      : 2,
	kUNDO_CLOSE_FULL_SET : 256,
 
	doAndWaitDOMEvent : function TSTUtils_doAndWaitDOMEvent() 
	{
		var type, target, delay, task;
		for (let i = 0, maxi = arguments.length; i < maxi; i++)
		{
			let arg = arguments[i];
			switch(typeof arg)
			{
				case 'string':
					type = arg;
					continue;

				case 'number':
					delay = arg;
					continue;

				case 'function':
					task = arg;
					continue;

				default:
					target = arg;
					continue;
			}
		}

		if (!target || !type) {
			if (task) task();
			return;
		}

		var done = false;
		var listener = function(aEvent) {
				jstimer.setTimeout(function() {
					done = true;
				}, delay || 0);
				target.removeEventListener(type, listener, false);
			};

		if (task)
			Deferred.next(function() {
				try {
					task();
				}
				catch(e) {
					dump(e+'\n');
					target.removeEventListener(type, listener, false);
					done = true;
				}
			}).error(this.defaultDeferredErrorHandler);

		target.addEventListener(type, listener, false);

		var thread = Components
						.classes['@mozilla.org/thread-manager;1']
						.getService()
						.mainThread;
		while (!done)
		{
			//dump('WAIT '+type+' '+Date.now()+'\n');
			thread.processNextEvent(true);
		}
	},
 
	findOffsetParent : function TSTUtils_findOffsetParent(aNode) 
	{
		var parent = aNode.parentNode;
		var doc = aNode.ownerDocument || aNode;
		var view = doc.defaultView;
		while (parent && parent instanceof Ci.nsIDOMElement)
		{
			let position = view.getComputedStyle(parent, null).getPropertyValue('position');
			if (position != 'static')
				return parent;
			parent = parent.parentNode;
		}
		return doc.documentElement;
	},
 
	assertBeforeDestruction : function TSTUtils_assertBeforeDestruction(aNotDestructed) 
	{
		if (aNotDestructed)
			return;

		var message = 'ERROR: accessed after destruction!';
		var error = new Error(message);
		dump(message+'\n'+error.stack+'\n');
		throw error;
	},
 
	defaultDeferredErrorHandler : function TSTUtils_defaultDeferredErrorHandler(aError) 
	{
		if (aError.stack)
			Components.utils.reportError(aError.message+'\n'+aError.stack);
		else
			Components.utils.reportError(aError);
	},
 
// event 
	
	isNewTabAction : function TSTUtils_isNewTabAction(aEvent) 
	{
		return aEvent.button == 1 || (aEvent.button == 0 && this.isAccelKeyPressed(aEvent));
	},
 
	isAccelKeyPressed : function TSTUtils_isAccelKeyPressed(aEvent) 
	{
		if ( // this is releasing of the accel key!
			(aEvent.type == 'keyup') &&
			(aEvent.keyCode == (this.isMac ? Ci.nsIDOMKeyEvent.DOM_VK_META : Ci.nsIDOMKeyEvent.DOM_VK_CONTROL ))
			) {
			return false;
		}
		return this.isMac ?
			(aEvent.metaKey || (aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_META)) :
			(aEvent.ctrlKey || (aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_CONTROL)) ;
	},
 
	isCopyAction : function TSTUtils_isCopyAction(aEvent) 
	{
		return this.isAccelKeyPressed(aEvent) ||
				(aEvent.dataTransfer && aEvent.dataTransfer.dropEffect == 'copy');
	},
 
	isEventFiredOnClosebox : function TSTUtils_isEventFiredOnClosebox(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " tab-close-button ")]',
				aEvent.originalTarget || aEvent.target,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnClickable : function TSTUtils_isEventFiredOnClickable(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(" button toolbarbutton scrollbar nativescrollbar popup menupopup panel tooltip splitter textbox ", concat(" ", local-name(), " "))]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnScrollbar : function TSTUtils_isEventFiredOnScrollbar(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[local-name()="scrollbar" or local-name()="nativescrollbar"]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnTwisty : function TSTUtils_isEventFiredOnTwisty(aEvent) 
	{
		var tab = this.getTabFromEvent(aEvent);
		if (!tab ||
			!this.hasChildTabs(tab) ||
			!this.canCollapseSubtree(tab))
			return false;

		var twisty = tab.ownerDocument.getAnonymousElementByAttribute(tab, 'class', this.kTWISTY);
		if (!twisty)
			return false;

		var box = twisty.boxObject;
		var left = box.screenX;
		var top = box.screenY;
		var right = left + box.width;
		var bottom = top + box.height;
		var favicon = this.getFaviconRect(tab);
		if (!box.width || !box.height) {
			left = favicon.left;
			top = favicon.top;
			right = favicon.right;
			bottom = favicon.bottom;
		}
		else if (
			this.shouldExpandTwistyArea &&
			!this._expandTwistyAreaBlockers.length
			) {
			left = Math.min(left, favicon.left);
			top = Math.min(top, favicon.top);
			right = Math.max(right, favicon.right);
			bottom = Math.max(bottom, favicon.bottom);
		}

		var x = aEvent.screenX;
		var y = aEvent.screenY;
		return (x >= left && x <= right && y >= top && y <= bottom);
	},
	getFaviconRect : function TSTUtils_getFaviconRect(aTab)
	{
		var icon  = aTab.ownerDocument.getAnonymousElementByAttribute(aTab, 'class', 'tab-icon-image');
		var iconBox = icon.boxObject;
		var iconRect = {
				left   : iconBox.screenX,
				top    : iconBox.screenY,
				right  : iconBox.screenX + iconBox.width,
				bottom : iconBox.screenY + iconBox.height
			};

		var throbber  = aTab.ownerDocument.getAnonymousElementByAttribute(aTab, 'class', 'tab-throbber');
		var throbberBox = throbber.boxObject;
		var throbberRect = {
				left   : throbberBox.screenX,
				top    : throbberBox.screenY,
				right  : throbberBox.screenX + throbberBox.width,
				bottom : throbberBox.screenY + throbberBox.height
			};

		if (!iconBox.width && !iconBox.height)
			return throbberRect;

		if (!throbberBox.width && !throbberBox.height)
			return iconRect;

		return {
			left   : Math.min(throbberRect.left, iconRect.left),
			right  : Math.max(throbberRect.right, iconRect.right),
			top    : Math.min(throbberRect.top, iconRect.top),
			bottom : Math.max(throbberRect.bottom, iconRect.bottom)
		};
	},
	
	// called with target(nsIDOMEventTarget), document(nsIDOMDocument), type(string) and data(object) 
	fireDataContainerEvent : function TSTUtils_fireDataContainerEvent()
	{
		var target, document, type, data, canBubble, cancellable;
		for (let i = 0, maxi = arguments.length; i < maxi; i++)
		{
			let arg = arguments[i];
			if (typeof arg == 'boolean') {
				if (canBubble === void(0))
					canBubble = arg;
				else
					cancellable = arg;
			}
			else if (typeof arg == 'string')
				type = arg;
			else if (arg instanceof Ci.nsIDOMDocument)
				document = arg;
			else if (arg instanceof Ci.nsIDOMEventTarget)
				target = arg;
			else
				data = arg;
		}
		if (!target)
			target = document;
		if (!document)
			document = target.ownerDocument || target;

		var event = document.createEvent('DataContainerEvent');
		event.initEvent(type, canBubble, cancellable);
		var properties = Object.keys(data);
		for (let i = 0, maxi = properties.length; i < maxi; i++)
		{
			let property = properties[i];
			let value = data[property];
			event.setData(property, value);
			event[property] = value; // for backward compatibility
		}

		return target.dispatchEvent(event);
	},
 
	registerExpandTwistyAreaBlocker : function TSTUtils_registerExpandTwistyAreaBlocker(aBlocker) /* PUBLIC API */ 
	{
		if (this._expandTwistyAreaBlockers.indexOf(aBlocker) < 0)
			this._expandTwistyAreaBlockers.push(aBlocker);
	},
	_expandTwistyAreaBlockers : [],
 
	registerExpandTwistyAreaAllowance : function TSTUtils_registerExpandTwistyAreaAllowance(aAllowance) /* PUBLIC API, obsolete, for backward compatibility */ 
	{
		this.registerExpandTwistyAreaBlocker(aAllowance.toSource());
	},
   
// string 
	
	makeNewId : function TSTUtils_makeNewId() 
	{
		return 'tab-<'+Date.now()+'-'+parseInt(Math.random() * 65000)+'>';
	},
 
	makeNewClosedSetId : function TSTUtils_makeNewId() 
	{
		return 'tabs-closed-set-<'+Date.now()+'-'+parseInt(Math.random() * 65000)+'>';
	},
 
	makeURIFromSpec : function TSTUtils_makeURIFromSpec(aURI) 
	{
		var newURI;
		aURI = aURI || '';
		if (aURI && String(aURI).indexOf('file:') == 0) {
			var fileHandler = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler);
			var tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
			newURI = Services.io.newFileURI(tempLocalFile);
		}
		else {
			if (!/^\w+\:/.test(aURI)) aURI = 'http://'+aURI;
			newURI = Services.io.newURI(aURI, null, null);
		}
		return newURI;
	},
 
	getGroupTabURI : function TSTUtils_getGroupTabURI(aTitle) 
	{
		return 'about:treestyletab-group'+(aTitle === void(0) ? '' : '?'+encodeURIComponent(aTitle) );
	},
  
// xpath 
	
	NSResolver : { 
		lookupNamespaceURI : function(aPrefix)
		{
			switch (aPrefix)
			{
				case 'xul':
					return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
				case 'html':
				case 'xhtml':
					return 'http://www.w3.org/1999/xhtml';
				case 'xlink':
					return 'http://www.w3.org/1999/xlink';
				default:
					return '';
			}
		}
	},
 
	evaluateXPath : function TSTUtils_evaluateXPath(aExpression, aContext, aType) 
	{
		if (!aType) aType = Ci.nsIDOMXPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
		try {
			var XPathResult = (aContext.ownerDocument || aContext).evaluate(
					aExpression,
					(aContext || document),
					this.NSResolver,
					aType,
					null
				);
		}
		catch(e) {
			return {
				singleNodeValue : null,
				snapshotLength  : 0,
				snapshotItem    : function() {
					return null
				}
			};
		}
		return XPathResult;
	},
 
	getArrayFromXPathResult : function TSTUtils_getArrayFromXPathResult(aXPathResult) 
	{
		var max = aXPathResult.snapshotLength;
		var array = new Array(max);
		if (!max) return array;

		for (var i = 0; i < max; i++)
		{
			array[i] = aXPathResult.snapshotItem(i);
		}

		return array;
	},
  
/* Session Store API */ 
	
	getTabValue : function TSTUtils_getTabValue(aTab, aKey) 
	{
		var value = '';
		try {
			value = this.SessionStore.getTabValue(aTab, aKey);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI) {
			let TMPValue = aTab.getAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey);
			if (TMPValue) value = TMPValue;
		}

		return value;
	},
 
	setTabValue : function TSTUtils_setTabValue(aTab, aKey, aValue) 
	{
		if (!aValue) return this.deleteTabValue(aTab, aKey);

		aTab.setAttribute(aKey, aValue);
		try {
			this.checkCachedSessionDataExpiration(aTab);
			this.SessionStore.setTabValue(aTab, aKey, aValue);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI)
			aTab.setAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey, aValue);

		return aValue;
	},
 
	deleteTabValue : function TSTUtils_deleteTabValue(aTab, aKey) 
	{
		aTab.removeAttribute(aKey);
		try {
			this.checkCachedSessionDataExpiration(aTab);
			this.SessionStore.setTabValue(aTab, aKey, '');
			this.SessionStore.deleteTabValue(aTab, aKey);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI)
			aTab.removeAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey);
	},
 
	// workaround for http://piro.sakura.ne.jp/latest/blosxom/mozilla/extension/treestyletab/2009-09-29_debug.htm
	checkCachedSessionDataExpiration : function TSTUtils_checkCachedSessionDataExpiration(aTab) 
	{
		var data = aTab.linkedBrowser.__SS_data;
		if (data &&
			data._tabStillLoading &&
			aTab.getAttribute('busy') != 'true' &&
			aTab.linkedBrowser.__SS_restoreState != 1)
			data._tabStillLoading = false;
	},
 
	markAsClosedSet : function TSTUtils_markAsClosedSet(aTabs) /* PUBLIC API */ 
	{
		if (!aTabs || aTabs.length <= 1) return;
		var id = this.makeNewClosedSetId() + '::' + aTabs.length;
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			this.setTabValue(aTabs[i], this.kCLOSED_SET_ID, id);
		}
	},
 
	unmarkAsClosedSet : function TSTUtils_unmarkAsClosedSet(aTabs) /* PUBLIC API */ 
	{
		if (!aTabs || !aTabs.length) return;
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			this.deleteTabValue(aTabs[i], this.kCLOSED_SET_ID);
		}
	},
 
	useTMPSessionAPI : false, 
 
	kTMP_SESSION_DATA_PREFIX : 'tmp-session-data-', 
  
// tab 
	
	getTabStrip : function TSTUtils_getTabStrip(aTabBrowser) 
	{
		if (!(aTabBrowser instanceof Ci.nsIDOMElement))
			return null;

		var strip = aTabBrowser.mStrip;
		return (strip && strip instanceof Ci.nsIDOMElement) ?
				strip :
				this.evaluateXPath(
					aTabBrowser.tabContainer,
					'ancestor::xul:toolbar[1]',
					Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
				).singleNodeValue || aTabBrowser.tabContainer.parentNode;
	},
	get tabStrip()
	{
		return this.getTabStrip(this.browser);
	},
 
	getTabContainerBox : function TSTUtils_getTabContainerBox(aTabBrowser) 
	{
		if (!(aTabBrowser instanceof Ci.nsIDOMElement))
			return null;

		var strip = this.getTabStrip(aTabBrowser);
		return strip.treeStyleTabToolbarInnerBox || aTabBrowser.tabContainer;
	},
	get tabContainerBox()
	{
		return this.getTabContainerBox(this.browser);
	},
 
	setTabbrowserAttribute : function TSTUtils_setTabbrowserAttribute(aName, aValue, aTabBrowser) 
	{
		aTabBrowser = aTabBrowser || this.mTabBrowser || this.browser;
		if (aValue) {
			aTabBrowser.setAttribute(aName, aValue);
			aTabBrowser.mTabContainer.setAttribute(aName, aValue);
			aTabBrowser.treeStyleTab.setTabStripAttribute(aName, aValue);
		}
		else {
			aTabBrowser.removeAttribute(aName);
			aTabBrowser.mTabContainer.removeAttribute(aName);
			aTabBrowser.treeStyleTab.removeTabStripAttribute(aName);
		}
	},
 
	removeTabbrowserAttribute : function TSTUtils_removeTabbrowserAttribute(aName, aTabBrowser) 
	{
		this.setTabbrowserAttribute(aName, null, aTabBrowser);
	},
 
	setTabStripAttribute : function TSTUtils_setTabStripAttribute(aAttr, aValue) 
	{
		var strip = this.tabStrip;
		if (!strip) return;
		var isFeatureAttribute = aAttr.indexOf('treestyletab-') == 0;
		if (aValue) {
			if (this._tabStripPlaceHolder)
				this._tabStripPlaceHolder.setAttribute(aAttr, aValue);
			if (!this._tabStripPlaceHolder || aAttr != 'ordinal')
				strip.setAttribute(aAttr, aValue);
			if (strip.treeStyleTabToolbarInnerBox)
				strip.treeStyleTabToolbarInnerBox.setAttribute(aAttr, aValue);
			if (isFeatureAttribute) {
				// Only attributes for TST's feature are applied to the root element.
				// (width, height, and other general attributes have to be ignored!)
				strip.ownerDocument.defaultView.setTimeout(function(aSelf) {
					strip.ownerDocument.documentElement.setAttribute(aAttr, aValue);
				}, 10, this);
			}
		}
		else {
			if (this._tabStripPlaceHolder)
				this._tabStripPlaceHolder.removeAttribute(aAttr);
			if (!this._tabStripPlaceHolder || aAttr != 'ordinal')
				strip.removeAttribute(aAttr);
			if (strip.treeStyleTabToolbarInnerBox)
				strip.treeStyleTabToolbarInnerBox.removeAttribute(aAttr);
			if (isFeatureAttribute) {
				strip.ownerDocument.defaultView.setTimeout(function(aSelf) {
					strip.ownerDocument.documentElement.removeAttribute(aAttr);
				}, 10, this);
			}
		}
	},
 
	removeTabStripAttribute : function TSTUtils_removeTabStripAttribute(aAttr) 
	{
		this.setTabStripAttribute(aAttr, null);
	},
 
	getTabFromChild : function TSTUtils_getTabFromChild(aTab) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:tab',
				aTab,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabFromEvent : function TSTUtils_getTabFromEvent(aEvent) 
	{
		return this.getTabFromChild(aEvent.originalTarget || aEvent.target);
	},
 
	getNewTabButtonFromEvent : function TSTUtils_getNewTabButtonFromEvent(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*['
					+'@id="new-tab-button" or '
					+'contains(concat(" ", normalize-space(@class), " "), " tabs-newtab-button ")'
				+'][1]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getSplitterFromEvent : function TSTUtils_getSplitterFromEvent(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:splitter[contains(concat(" ", normalize-space(@class), " "), " '+this.kSPLITTER+' ")]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	isEventFiredOnGrippy : function TSTUtils_isEventFiredOnGrippy(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:grippy',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	getTabFromFrame : function TSTUtils_getTabFromFrame(aFrame, aTabBrowser) 
	{
		var b = aTabBrowser || this.browser;
		var top = aFrame.top;
		var tabs = this.getAllTabs(b);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			if (tab.linkedBrowser.contentWindow == top)
				return tab;
		}
		return null;
	},
 
	getTabbarFromChild : function TSTUtils_getTabbarFromChild(aNode) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " tabbrowser-strip ")] | '+
				'ancestor-or-self::xul:tabs[@tabbrowser] | ' +
				'ancestor-or-self::xul:toolbar/child::xul:tabs[@tabbrowser]',
				aNode,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
	getAncestorTabbarFromChild : function TSTUtils_getAncestorTabbarFromChild(aNode)
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " tabbrowser-strip ")] | '+
				'ancestor-or-self::xul:tabs[@tabbrowser]',
				aNode,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabbarFromEvent : function TSTUtils_getTabbarFromEvent(aEvent) 
	{
		return this.getTabbarFromChild(aEvent.originalTarget || aEvent.target);
	},
	getAncestorTabbarFromEvent : function TSTUtils_getAncestorTabbarFromEvent(aEvent)
	{
		return this.getAncestorTabbarFromChild(aEvent.originalTarget || aEvent.target);
	},
 
	cleanUpTabsArray : function TSTUtils_cleanUpTabsArray(aTabs) 
	{
		var newTabs = [];
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (!tab || !tab.parentNode) continue; // ignore removed tabs
			if (newTabs.indexOf(tab) < 0) newTabs.push(tab);
		}
		newTabs.sort(this.sortTabsByOrder);
		return newTabs;
	},
	
	sortTabsByOrder : function TSTUtils_sortTabsByOrder(aA, aB) 
	{
		return aA._tPos - aB._tPos;
	},
  
	gatherSubtreeMemberTabs : function TSTUtils_gatherSubtreeMemberTabs(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = aTabOrTabs;
		if (!(tabs instanceof Array)) {
			tabs = [aTabOrTabs];
		}

		var b = this.getTabBrowserFromChild(tabs[0]);
		var descendant = [];
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			descendant = descendant.concat(b.treeStyleTab.getDescendantTabs(tabs[i]));
		}

		return this.cleanUpTabsArray(aOnlyChildren ? descendant : tabs.concat(descendant));
	},
 
	splitTabsToSubtrees : function TSTUtils_splitTabsToSubtrees(aTabs) /* PUBLIC API */ 
	{
		var groups = [];

		var group = [];
		aTabs = this.cleanUpTabsArray(aTabs);
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			let parent = this.getParentTab(tab);
			if (!parent || group.indexOf(parent) < 0) {
				if (group.length) groups.push(group);
				group = [tab];
			}
			else {
				group.push(tab);
			}
		}
		if (group.length) groups.push(group);
		return groups;
	},
  
// tabbrowser 
	
	getTabBrowserFromChild : function TSTUtils_getTabBrowserFromChild(aTabBrowserChild) 
	{
		if (!aTabBrowserChild)
			return null;

		if (aTabBrowserChild.__treestyletab__linkedTabBrowser) // tab
			return aTabBrowserChild.__treestyletab__linkedTabBrowser;

		if (aTabBrowserChild.localName == 'tabbrowser') // itself
			return aTabBrowserChild;

		if (aTabBrowserChild.tabbrowser) // tabs
			return aTabBrowserChild.tabbrowser;

		if (aTabBrowserChild.localName == 'toolbar') // tabs toolbar
			return aTabBrowserChild.getElementsByTagName('tabs')[0].tabbrowser;

		// tab context menu
		var popup = this.evaluateXPath(
				'ancestor-or-self::xul:menupopup[@id="tabContextMenu"]',
				aTabBrowserChild,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		if (popup && 'TabContextMenu' in aTabBrowserChild.ownerDocument.defaultView)
			return this.getTabBrowserFromChild(aTabBrowserChild.ownerDocument.defaultView.TabContextMenu.contextTab);

		var b = this.evaluateXPath(
				'ancestor::xul:tabbrowser | '+
				'ancestor::xul:tabs[@tabbrowser] |'+
				'ancestor::xul:toolbar/descendant::xul:tabs',
				aTabBrowserChild,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		return (b && b.tabbrowser) || b;
	},
 
	getTabBrowserFromFrame : function TSTUtils_getTabBrowserFromFrame(aFrame) 
	{
		var w = this.browserWindow;
		return !w ? null :
			('SplitBrowser' in w) ? this.getTabBrowserFromChild(w.SplitBrowser.getSubBrowserAndBrowserFromFrame(aFrame.top).browser) :
			this.browser ;
	},
 
	getFrameFromTabBrowserElements : function TSTUtils_getFrameFromTabBrowserElements(aFrameOrTabBrowser) 
	{
		var frame = aFrameOrTabBrowser;
		if (frame == '[object XULElement]') {
			if (frame.localName == 'tab') {
				frame = frame.linkedBrowser.contentWindow;
			}
			else if (frame.localName == 'browser') {
				frame = frame.contentWindow;
			}
			else {
				frame = this.getTabBrowserFromChild(frame);
				if (!frame) return null;
				frame = frame.contentWindow;
			}
		}
		if (!frame)
			frame = this.browser.contentWindow;

		return frame;
	},
   
/* get tab(s) */ 
	
	getTabById : function TSTUtils_getTabById(aId, aTabBrowserChildren) 
	{
		if (!aId) return null;

		if (aTabBrowserChildren && !(aTabBrowserChildren instanceof Ci.nsIDOMNode))
			aTabBrowserChildren = null;

		var b = this.getTabBrowserFromChild(aTabBrowserChildren) || this.browser;

		if (this.tabsHash) // XPath-less implementation
			return this.tabsHash[aId] || null;

		return b.mTabContainer.querySelector('tab['+this.kID+'="'+aId+'"]');
	},
 
	isTabDuplicated : function TSTUtils_isTabDuplicated(aTab) 
	{
		if (!aTab) return false;
		var id = this.getTabValue(aTab, this.kID);
		var b = this.getTabBrowserFromChild(aTab) || this.browser;
		var tabs = b.mTabContainer.querySelectorAll('tab['+this.kID+'="'+id+'"], tab['+this.kID_RESTORING+'="'+id+'"]');
		return tabs.length > 1;
	},
 
	/**
	 * Returns all tabs in the current group as an array.
	 * It includes tabs hidden by Tab Panorama.
	 */
	getAllTabs : function TSTUtils_getTabs(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		return Array.slice(b.mTabContainer.querySelectorAll('tab'));
	},
 
	/**
	 * Returns all tabs in the current group as an array.
	 * It excludes tabs hidden by Tab Panorama.
	 */
	getTabs : function TSTUtils_getTabs(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		return Array.slice(b.mTabContainer.querySelectorAll('tab:not([hidden="true"])'));
	},
 
	getAllTabsArray : function TSTUtils_getAllTabsArray(aTabBrowserChild) /* for backward compatibility */ 
	{
		return this.getAllTabs(aTabBrowserChild);
	},
 
	getTabsArray : function TSTUtils_getTabsArray(aTabBrowserChild) /* for backward compatibility */ 
	{
		return this.getTabs(aTabBrowserChild);
	},
 
	/**
	 * Returns the first tab in the current group.
	 */
	getFirstTab : function TSTUtils_getFirstTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		var tabs = b.visibleTabs;
		return tabs ? tabs[0] : b.mTabContainer.firstChild;
	},
 
	/**
	 * Returns the first visible, not collapsed, and not pinned tab.
	 */
	getFirstNormalTab : function TSTUtils_getFirstNormalTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		return b.mTabContainer.querySelector('tab:not([pinned="true"]):not([hidden="true"])');
	},
 
	/**
	 * Returns the last tab in the current group.
	 */
	getLastTab : function TSTUtils_getLastTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		var tabs = b.visibleTabs;
		return tabs ? tabs[tabs.length-1] : b.mTabContainer.lastChild ;
	},
 
	/**
	 * Returns the next tab in the current group.
	 */
	getNextTab : function TSTUtils_getNextTab(aTab) 
	{
		if (!aTab) return null;
		var b = this.getTabBrowserFromChild(aTab);
		this.assertBeforeDestruction(b && b.mTabContainer);
		var tabs = b.visibleTabs;
		if (tabs) {
			let index = tabs.indexOf(aTab);
			if (index > -1)
				return tabs.length > index ? tabs[index+1] : null
		}
		var tab = aTab.nextSibling;
		return (tab && tab.localName == 'tab') ? tab : null ;
	},
 
	/**
	 * Returns the previous tab in the current group.
	 */
	getPreviousTab : function TSTUtils_getPreviousTab(aTab) 
	{
		if (!aTab) return null;
		var b = this.getTabBrowserFromChild(aTab);
		this.assertBeforeDestruction(b && b.mTabContainer);
		var tabs = b.visibleTabs;
		if (tabs) {
			let index = tabs.indexOf(aTab);
			if (index > -1)
				return 0 < index ? tabs[index-1] : null
		}
		var tab = aTab.previousSibling;
		return (tab && tab.localName == 'tab') ? tab : null ;
	},
 
	/**
	 * Returns the index of the specified tab, in the current group.
	 */
	getTabIndex : function TSTUtils_getTabIndex(aTab) 
	{
		if (!aTab) return -1;
		var b = this.getTabBrowserFromChild(aTab);
		return this.getTabs(b).indexOf(aTab);
	},
 
	/**
	 * Returns the next not collapsed tab in the current group.
	 */
	getNextVisibleTab : function TSTUtils_getNextVisibleTab(aTab) 
	{
		if (!aTab) return null;

		var b = this.getTabBrowserFromChild(aTab);
		if (!this.canCollapseSubtree(b))
			return this.getNextTab(aTab);

		var tabs = this.getVisibleTabs(b);
		if (tabs.indexOf(aTab) < 0) tabs.push(aTab);
		tabs.sort(this.sortTabsByOrder);

		var index = tabs.indexOf(aTab);
		return (index < tabs.length-1) ? tabs[index+1] : null ;
	},
 
	/**
	 * Returns the previous not collapsed tab in the current group.
	 */
	getPreviousVisibleTab : function TSTUtils_getPreviousVisibleTab(aTab) 
	{
		if (!aTab) return null;

		var b = this.getTabBrowserFromChild(aTab);
		if (!this.canCollapseSubtree(b))
			return this.getPreviousTab(aTab);

		var tabs = this.getVisibleTabs(b);
		if (tabs.indexOf(aTab) < 0) tabs.push(aTab);
		tabs.sort(this.sortTabsByOrder);

		var index = tabs.indexOf(aTab);
		return (index > 0) ? tabs[index-1] : null ;
	},
 
	/**
	 * Returns the last not collapsed tab in the current group.
	 */
	getLastVisibleTab : function TSTUtils_getLastVisibleTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		if (!b) return null;
		var tabs = this.getVisibleTabs(b);
		return tabs.length ? tabs[tabs.length-1] : null ;
	},
 
	/**
	 * Returns a XPathResult of not collapsed tabs in the current group.
	 */
	getVisibleTabs : function TSTUtils_getVisibleTabs(aTabBrowserChild) /* OBSOLETE */ 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		if (!this.canCollapseSubtree(b))
			return this.getTabs(b);
		return Array.slice(b.mTabContainer.querySelectorAll('tab:not(['+this.kCOLLAPSED+'="true"]):not([hidden="true"])'));
	},
 
	getVisibleTabsArray : function TSTUtils_getVisibleTabsArray(aTabBrowserChild) /* for backward compatibility */ 
	{
		return this.getVisibleTabs(aTabBrowserChild);
	},
 
	/**
	 * Returns the index of the specified tab, in the array of not collapsed
	 * tabs in the current group.
	 */
	getVisibleIndex : function TSTUtils_getVisibleIndex(aTab) 
	{
		if (!aTab) return -1;
		var b = this.getTabBrowserFromChild(aTab);
		return this.getVisibleTabs(b).indexOf(aTab);
	},
 
	/**
	 * Returns tabs which are newly opened in the given operation.
	 */
	getNewTabsWithOperation : function TSTUtils_getNewTabsWithOperation(aOperation, aTabBrowser)
	{
		var previousTabs = this.getTabsInfo(aTabBrowser);
		aOperation.call(this);
		return this.getNewTabsFromPreviousTabsInfo(aTabBrowser, previousTabs);
	},
 
	/**
	 * Returns tabs which are newly opened. This requires the "previous state".
	 */
	getNewTabsFromPreviousTabsInfo : function TSTUtils_getNewTabsFromPreviousTabsInfo(aTabBrowser, aTabsInfo) 
	{
		var tabs = this.getTabs(aTabBrowser);
		var currentTabsInfo = this.getTabsInfo(aTabBrowser);
		return tabs.filter(function(aTab, aIndex) {
				return aTabsInfo.indexOf(currentTabsInfo[aIndex]) < 0;
			});
	},
	getTabsInfo : function TSTUtils_getTabsInfo(aTabBrowser)
	{
		var tabs = this.getTabs(aTabBrowser);
		return tabs.map(function(aTab) {
				return aTab.getAttribute(this.kID)+'\n'+
						aTab.getAttribute('busy')+'\n'+
						aTab.linkedBrowser.currentURI.spec;
			}, this);
	},
  
/* notify "ready to open child tab(s)" */ 
	
	readyToOpenChildTab : function TSTUtils_readyToOpenChildTab(aFrameOrTabBrowser, aMultiple, aInsertBefore) /* PUBLIC API */ 
	{
		if (!this.getTreePref('autoAttach')) return false;

		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame)
			return false;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);

		var parentTab = this.getTabFromFrame(frame, ownerBrowser);
		if (!parentTab || parentTab.getAttribute('pinned') == 'true')
			return false;

		ownerBrowser.treeStyleTab.ensureTabInitialized(parentTab);
		var parentId = parentTab.getAttribute(this.kID);

		var refId = null;
		if (aInsertBefore) {
			ownerBrowser.treeStyleTab.ensureTabInitialized(parentTab);
			refId = aInsertBefore.getAttribute(this.kID);
		}

		ownerBrowser.treeStyleTab.readiedToAttachNewTab   = true;
		ownerBrowser.treeStyleTab.readiedToAttachMultiple = aMultiple || false ;
		ownerBrowser.treeStyleTab.multipleCount           = aMultiple ? 0 : -1 ;
		ownerBrowser.treeStyleTab.parentTab               = parentId;
		ownerBrowser.treeStyleTab.insertBefore            = refId;

		return true;
	},
	/**
	 * Extended version. If you don't know whether a new tab will be actually
	 * opened or not (by the command called after TST's API), then use this.
	 * This version automatically cancels the "ready" state with delay.
	 */
	readyToOpenChildTabNow : function TSTUtils_readyToOpenChildTabNow(aFrameOrTabBrowser) /* PUBLIC API */
	{
		if (this.readyToOpenChildTab.apply(this, arguments)) {
			let self = this;
			this.Deferred.next(function() {
				self.stopToOpenChildTab(aFrameOrTabBrowser);
			}).error(this.defaultDeferredErrorHandler);
			return true;
		}
		return false;
	},
 
	readyToOpenNextSiblingTab : function TSTUtils_readyToOpenNextSiblingTab(aFrameOrTabBrowser) /* PUBLIC API */ 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame)
			return false;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);

		var tab = this.getTabFromFrame(frame, ownerBrowser);
		if (!tab || tab.getAttribute('pinned') == 'true')
			return false;

		var parentTab = this.getParentTab(tab);
		var nextTab = this.getNextSiblingTab(tab);
		if (parentTab) {
			/**
			 * If the base tab has a parent, open the new tab as a child of
			 * the parent tab.
			 */
			return this.readyToOpenChildTab(parentTab, false, nextTab);
		}
		else {
			/**
			 * Otherwise, open the tab as a new root tab. If there is no
			 * tab next to the base tab (in other words, if the tab is the
			 * last tab), then do nothing.
			 */
			if (!nextTab) return;
			ownerBrowser.treeStyleTab.readiedToAttachNewTab = true;
			ownerBrowser.treeStyleTab.parentTab             = null;
			ownerBrowser.treeStyleTab.insertBefore          = nextTab.getAttribute(this.kID);
			return true;
		}
	},
	/**
	 * Extended version. If you don't know whether a new tab will be actually
	 * opened or not (by the command called after TST's API), then use this.
	 * This version automatically cancels the "ready" state with delay.
	 */
	readyToOpenNextSiblingTabNow : function TSTUtils_readyToOpenNextSiblingTabNow(aFrameOrTabBrowser) /* PUBLIC API */
	{
		if (this.readyToOpenNextSiblingTab.apply(this, arguments)) {
			let self = this;
			this.Deferred.next(function() {
				self.stopToOpenChildTab(aFrameOrTabBrowser);
			}).error(this.defaultDeferredErrorHandler);
			return true;
		}
		return false;
	},
 
	readyToOpenNewTabGroup : function TSTUtils_readyToOpenNewTabGroup(aFrameOrTabBrowser, aTreeStructure, aExpandAllTree) /* PUBLIC API */ 
	{
		if (!this.getTreePref('autoAttach')) return false;

		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return false;

		this.stopToOpenChildTab(frame);

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.treeStyleTab.readiedToAttachNewTabGroup = true;
		ownerBrowser.treeStyleTab.readiedToAttachMultiple    = true;
		ownerBrowser.treeStyleTab.multipleCount              = 0;
		ownerBrowser.treeStyleTab.treeStructure              = aTreeStructure;
		ownerBrowser.treeStyleTab.shouldExpandAllTree        = !!aExpandAllTree;

		return true;
	},
	/**
	 * Extended version. If you don't know whether new tabs will be actually
	 * opened or not (by the command called after TST's API), then use this.
	 * This version automatically cancels the "ready" state with delay.
	 */
	readyToOpenNewTabGroupNow : function TSTUtils_readyToOpenNewTabGroupNow(aFrameOrTabBrowser) /* PUBLIC API */
	{

		if (this.readyToOpenNewTabGroup.apply(this, arguments)) {
			let self = this;
			this.Deferred.next(function() {
				self.stopToOpenChildTab(aFrameOrTabBrowser);
			}).error(this.defaultDeferredErrorHandler);
			return true;
		}
		return false;
	},
 
	stopToOpenChildTab : function TSTUtils_stopToOpenChildTab(aFrameOrTabBrowser) /* PUBLIC API */ 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return false;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.treeStyleTab.readiedToAttachNewTab      = false;
		ownerBrowser.treeStyleTab.readiedToAttachNewTabGroup = false;
		ownerBrowser.treeStyleTab.readiedToAttachMultiple    = false;
		ownerBrowser.treeStyleTab.multipleCount              = -1;
		ownerBrowser.treeStyleTab.parentTab                  = null;
		ownerBrowser.treeStyleTab.insertBefore               = null;
		ownerBrowser.treeStyleTab.treeStructure              = null;
		ownerBrowser.treeStyleTab.shouldExpandAllTree        = false;

		return true;
	},
 
	checkToOpenChildTab : function TSTUtils_checkToOpenChildTab(aFrameOrTabBrowser) /* PUBLIC API */ 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return false;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		return !!(ownerBrowser.treeStyleTab.readiedToAttachNewTab || ownerBrowser.treeStyleTab.readiedToAttachNewTabGroup);
	},
  
/* tree manipulations */ 
	
	get treeViewEnabled() /* PUBLIC API */ 
	{
		return this._treeViewEnabled;
	},
	set treeViewEnabled(aValue)
	{
		this._treeViewEnabled = !!aValue;
		Services.obs.notifyObservers(
			window,
			this.kTOPIC_CHANGE_TREEVIEW_AVAILABILITY,
			this._treeViewEnabled
		);
		return aValue;
	},
	_treeViewEnabled : true,
 
	get rootTabs() /* PUBLIC API */ 
	{
		return Array.slice(this.browser.mTabContainer.querySelectorAll('tab:not(['+this.kNEST+']), tab['+this.kNEST+'=""], tab['+this.kNEST+'="0"]'));
	},
 
	get allRootTabs() /* PUBLIC API */ 
	{
		return this.rootTabs;
	},
 
	get visibleRootTabs() /* PUBLIC API */ 
	{
		return this.rootTabs.filter(function(aTab) {
				return !aTab.hidden;
			});
	},
 
	canCollapseSubtree : function TSTUtils_canCollapseSubtree(aTabOrTabBrowser) /* PUBLIC API */ 
	{
		if (aTabOrTabBrowser &&
			aTabOrTabBrowser.localName == 'tab' &&
			aTabOrTabBrowser.getAttribute(this.kALLOW_COLLAPSE) != 'true')
			return false;

		var b = this.getTabBrowserFromChild(aTabOrTabBrowser) || this.browser;
		return b && b.getAttribute(this.kALLOW_COLLAPSE) == 'true';
	},
 
	isCollapsed : function TSTUtils_isCollapsed(aTab) /* PUBLIC API */ 
	{
		if (!aTab ||
			!this.canCollapseSubtree(this.getRootTab(aTab)))
			return false;

		return aTab.getAttribute(this.kCOLLAPSED) == 'true';
	},
 
	isSubtreeCollapsed : function TSTUtils_isSubtreeCollapsed(aTab) /* PUBLIC API */ 
	{
		if (!aTab || !this.canCollapseSubtree(aTab) || !this.hasChildTabs(aTab))
			return false;

		return aTab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true';
	},
 
	shouldCloseTabSubtreeOf : function TSTUtils_shouldCloseTabSubtreeOf(aTab) 
	{
		return (
			this.hasChildTabs(aTab) &&
			(
				this.getTreePref('closeParentBehavior') == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
				this.isSubtreeCollapsed(aTab)
			)
		);
	},
	shouldCloseTabSubTreeOf : function() { return this.shouldCloseTabSubtreeOf.apply(this, arguments); }, // obsolete, for backward compatibility
 
	shouldCloseLastTabSubtreeOf : function TSTUtils_shouldCloseLastTabSubtreeOf(aTab) 
	{
		var b = this.getTabBrowserFromChild(aTab);
		return (
			b &&
			this.shouldCloseTabSubtreeOf(aTab) &&
			this.getDescendantTabs(aTab).length + 1 == this.getAllTabs(b).length
		);
	},
	shouldCloseLastTabSubTreeOf : function() { return this.shouldCloseLastTabSubtreeOf.apply(this, arguments); }, // obsolete, for backward compatibility
 
	getParentTab : function TSTUtils_getParentTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		var parent;
		var id = aTab.getAttribute(this.kPARENT);
		if (this.tabsHash) { // XPath-less implementation
			parent = this.getTabById(id);
			if (parent && !parent.parentNode && this.tabsHash) {
				delete this.tabsHash[id];
				parent = null;
			}
		}
		else {
			parent =  this.evaluateXPath(
				'preceding-sibling::xul:tab[@'+this.kID+'="'+id+'"][1]',
				aTab,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		}
		return (parent && parent != aTab) ? parent : null ;
	},
 
	getAncestorTabs : function TSTUtils_getAncestorTabs(aTab) /* PUBLIC API */ 
	{
		var tabs = [aTab];
		var parentTab = aTab;
		while (parentTab = this.getParentTab(parentTab))
		{
			if (tabs.indexOf(parentTab) > -1) {
				let message = 'recursive tree detected!\n'+
					tabs.concat([parentTab])
					.reverse().map(function(aTab) {
						return '  '+aTab._tPos+' : '+
								aTab.label+'\n     '+
								aTab.getAttribute(this.kID);
					}, this).join('\n');
				dump(message+'\n');
				break;
			}

			if (aTab._tPos < parentTab._tPos) {
				let message = 'broken tree detected!\n'+
					tabs.concat([parentTab])
					.reverse().map(function(aTab) {
						return '  '+aTab._tPos+' : '+
								aTab.label+'\n     '+
								aTab.getAttribute(this.kID);
					}, this).join('\n');
				dump(message+'\n');
			}

			tabs.push(parentTab);
			aTab = parentTab;
		}
		return tabs.slice(1);
	},
 
	getRootTab : function TSTUtils_getRootTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		if (this.tabsHash) { // XPath-less implementation
			let ancestors = this.getAncestorTabs(aTab);
			return ancestors.length ? ancestors[ancestors.length-1] : aTab ;
		}

		return this.evaluateXPath(
			'(self::*[not(@'+this.kPARENT+')] | preceding-sibling::xul:tab[not(@'+this.kPARENT+')])[last()]',
			aTab,
			Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
	},
 
	getNextSiblingTab : function TSTUtils_getNextSiblingTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		if (this.tabsHash) { // XPath-less implementation
			let parentTab = this.getParentTab(aTab);

			if (!parentTab) {
				let next = aTab;
				do {
					next = next.nextSibling;
				}
				while (next &&
						next.nodeType == Ci.nsIDOMNode.ELEMENT_NODE &&
						this.getParentTab(next));
				return next;
			}

			let children = parentTab.getAttribute(this.kCHILDREN);
			if (children) {
				let list = ('|'+children).split('|'+aTab.getAttribute(this.kID));
				list = list.length > 1 ? list[1].split('|') : [] ;
				for (let i = 0, maxi = list.length; i < maxi; i++)
				{
					let firstChild = this.getTabById(list[i], aTab);
					if (firstChild) return firstChild;
				}
			}
			return null;
		}

		var parent = aTab.getAttribute(this.kPARENT);
		return this.evaluateXPath(
			'following-sibling::xul:tab['+
				(parent ? '@'+this.kPARENT+'="'+parent+'"' : 'not(@'+this.kPARENT+')' )+
			'][1]',
			aTab,
			Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
	},
 
	getPreviousSiblingTab : function TSTUtils_getPreviousSiblingTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		if (this.tabsHash) { // XPath-less implementation
			let parentTab = this.getParentTab(aTab);

			if (!parentTab) {
				let prev = aTab;
				do {
					prev = prev.previousSibling;
				}
				while (prev &&
						prev.nodeType == Ci.nsIDOMNode.ELEMENT_NODE &&
						this.getParentTab(prev));
				return prev;
			}

			let children = parentTab.getAttribute(this.kCHILDREN);
			if (children) {
				let list = ('|'+children).split('|'+aTab.getAttribute(this.kID))[0].split('|');
				for (let i = list.length-1; i > -1; i--)
				{
					let lastChild = this.getTabById(list[i], aTab);
					if (lastChild) return lastChild;
				}
			}
			return null;
		}

		var parent = aTab.getAttribute(this.kPARENT);
		return this.evaluateXPath(
			'preceding-sibling::xul:tab['+
				(parent ? '@'+this.kPARENT+'="'+parent+'"' : 'not(@'+this.kPARENT+')' )+
			'][1]',
			aTab,
			Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
	},
 
	getSiblingTabs : function TSTUtils_getSiblingTabs(aTab) /* PUBLIC API */ 
	{
		var parent = this.getParentTab(aTab);

		var siblings = parent && parent.parentNode ? this.getChildTabs(parent) : this.visibleRootTabs ;
		return siblings.filter(function(aSiblingTab) {
			return aSiblingTab != aTab;
		});
	},
 
	getChildTabs : function TSTUtils_getChildTabs(aTab, aAllTabsArray) /* PUBLIC API */ 
	{
		var tabs = [];
		if (!aTab) return tabs;

		var children = aTab.getAttribute(this.kCHILDREN);
		if (!children) return tabs;

		if (aAllTabsArray) tabs = aAllTabsArray;

		var list = children.split('|');
		for (let i = 0, maxi = list.length; i < maxi; i++)
		{
			let tab = this.getTabById(list[i], aTab);
			if (!tab || tab == aTab) continue;
			if (tabs.indexOf(tab) > -1) {
				let message = 'broken (possible recursive) tree detected!\n'+
					tabs.map(function(aTab) {
						return '  '+aTab._tPos+' : '+
								aTab.label+'\n     '+
								aTab.getAttribute(this.kID);
					}, this).join('\n');
				dump(message+'\n');
				continue;
			}
			tabs.push(tab);
			if (aAllTabsArray)
				this.getChildTabs(tab, tabs);
		}

		return tabs;
	},
 
	hasChildTabs : function TSTUtils_hasChildTabs(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return false;
		return aTab.hasAttribute(this.kCHILDREN);
	},
 
	getDescendantTabs : function TSTUtils_getDescendantTabs(aTab) /* PUBLIC API */ 
	{
		var tabs = [];
		this.getChildTabs(aTab, tabs);
		return tabs;
	},
 
	getFirstChildTab : function TSTUtils_getFirstChildTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		if (this.tabsHash) { // XPath-less implementation
			let children   = aTab.getAttribute(this.kCHILDREN);
			let firstChild = null;
			if (children) {
				let list = children.split('|');
				for (let i = 0, maxi = list.length; i < maxi; i++)
				{
					firstChild = this.getTabById(list[i], aTab);
					if (firstChild && firstChild != aTab) break;
				}
			}
			return firstChild;
		}

		return this.evaluateXPath(
			'following-sibling::xul:tab[@'+this.kPARENT+'="'+aTab.getAttribute(this.kID)+'"][1]',
			aTab,
			Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
	},
 
	getLastChildTab : function TSTUtils_getLastChildTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		if (this.tabsHash) { // XPath-less implementation
			let children  = aTab.getAttribute(this.kCHILDREN);
			let lastChild = null;
			if (children) {
				let list = children.split('|');
				for (let i = list.length-1; i > -1; i--)
				{
					lastChild = this.getTabById(list[i], aTab);
					if (lastChild && lastChild != aTab) break;
				}
			}
			return lastChild;
		}

		return this.evaluateXPath(
			'following-sibling::xul:tab[@'+this.kPARENT+'="'+aTab.getAttribute(this.kID)+'"][last()]',
			aTab,
			Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
	},
 
	getLastDescendantTab : function TSTUtils_getLastDescendantTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		if (this.tabsHash) { // XPath-less implementation
			let tabs = this.getDescendantTabs(aTab);
			return tabs.length ? tabs[tabs.length-1] : null ;
		}

		var parent = aTab.getAttribute(this.kPARENT);
		return this.evaluateXPath(
			'following-sibling::xul:tab['+
				(parent ? '@'+this.kPARENT+'="'+parent+'"' : 'not(@'+this.kPARENT+')' )+
			'][1]/preceding-sibling::xul:tab[1][not(@'+this.kID+'="'+aTab.getAttribute(this.kID)+'")]',
			aTab,
			Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
	},
 
	collectRootTabs : function TSTUtils_collectRootTabs(aTabs) /* PUBLIC API */ 
	{
		aTabs = Array.slice(aTabs);
		return aTabs.filter(function(aTab) {
			var parent = this.getParentTab(aTab);
			return !parent || aTabs.indexOf(parent) < 0;
		}, this);
	},
 
	getChildIndex : function TSTUtils_getChildIndex(aTab, aParent) /* PUBLIC API */ 
	{
		var parent = this.getParentTab(aTab);
		if (!aParent || !parent || aParent != parent) {
			let tabs = [aTab].concat(this.getAncestorTabs(aTab));
			parent = aTab;
			for (let i = 0, maxi = tabs.length; i < maxi && parent != aParent; i++)
			{
				aTab = parent;
				parent = i < maxi ? tabs[i+1] : null ;
			}
			if (parent != aParent)
				return -1;
			aParent = parent;
		}

		if (aParent) {
			let children = aParent.getAttribute(this.kCHILDREN);
			let list = children.split('|');
			let id = aTab.getAttribute(this.kID);
			for (let i = 0, maxi = list.length; i < maxi; i++)
			{
				if (list[i] == id) return i;
			}
			return -1;
		}
		else {
			let tabs = this.rootTabs;
			for (let i = 0, maxi = tabs.length; i < maxi; i++)
			{
				if (tabs[i] == aTab) return i;
			}
		}
		return -1;
	},
 
	getXOffsetOfTab : function TSTUtils_getXOffsetOfTab(aTab) 
	{
		var extraCondition = this.canCollapseSubtree(aTab) ?
								'[not(@'+this.kCOLLAPSED+'="true")]' :
								'' ;

		return this.evaluateXPath(
			'sum((self::* | preceding-sibling::xul:tab[not(@hidden="true")]'+extraCondition+')'+
				'/attribute::'+this.kX_OFFSET+')',
			aTab,
			Ci.nsIDOMXPathResult.NUMBER_TYPE
		).numberValue;
	},
	getYOffsetOfTab : function TSTUtils_getYOffsetOfTab(aTab)
	{
		var extraCondition = this.canCollapseSubtree(aTab) ?
								'[not(@'+this.kCOLLAPSED+'="true")]' :
								'';

		return this.evaluateXPath(
			'sum((self::* | preceding-sibling::xul:tab[not(@hidden="true")]'+extraCondition+')'+
				'/attribute::'+this.kY_OFFSET+')',
			aTab,
			Ci.nsIDOMXPathResult.NUMBER_TYPE
		).numberValue;
	},
	getFutureBoxObject : function TSTUtils_getFutureBoxObject(aTab)
	{
		var tabBox = aTab.boxObject;
		var xOffset = this.getXOffsetOfTab(aTab);
		var yOffset = this.getYOffsetOfTab(aTab);
		return {
			width     : tabBox.width,
			height    : tabBox.height,
			x         : tabBox.x + xOffset,
			y         : tabBox.y + yOffset,
			screenX   : tabBox.screenX + xOffset,
			screenY   : tabBox.screenY + yOffset
		};
	},
 
	isGroupTab : function TSTUtils_isGroupTab(aTab, aLazyCheck) 
	{
		return (
			(aLazyCheck || aTab.linkedBrowser.sessionHistory.count == 1) &&
			aTab.linkedBrowser.currentURI.spec.indexOf('about:treestyletab-group') > -1
		);
	},
 
	get pinnedTabsCount() 
	{
		return this.browser.mTabContainer.querySelectorAll('tab[pinned="true"]').length;
	},
 
	forceExpandTabs : function TSTUtils_forceExpandTabs(aTabs) 
	{
		var collapsedStates = aTabs.map(function(aTab) {
				return this.getTabValue(aTab, this.kSUBTREE_COLLAPSED) == 'true';
			}, this);
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			this.collapseExpandSubtree(tab, false, true);
			this.collapseExpandTab(tab, false, true);
		}
		return collapsedStates;
	},
 
	getTreeStructureFromTabs : function TSTUtils_getTreeStructureFromTabs(aTabs) 
	{
		/* this returns...
		  [A]     => -1 (parent is not in this tree)
		    [B]   => 0 (parent is 1st item in this tree)
		    [C]   => 0 (parent is 1st item in this tree)
		      [D] => 2 (parent is 2nd in this tree)
		  [E]     => -1 (parent is not in this tree, and this creates another tree)
		    [F]   => 0 (parent is 1st item in this another tree)
		*/
		return this.cleanUpTreeStructureArray(
				aTabs.map(function(aTab, aIndex) {
					let tab = this.getParentTab(aTab);
					let index = tab ? aTabs.indexOf(tab) : -1 ;
					return index >= aIndex ? -1 : index ;
				}, this),
				-1
			);
	},
	cleanUpTreeStructureArray : function TSTUtils_cleanUpTreeStructureArray(aTreeStructure, aDefaultParent)
	{
		var offset = 0;
		aTreeStructure = aTreeStructure
			.map(function(aPosition, aIndex) {
				return (aPosition == aIndex) ? -1 : aPosition ;
			})
			.map(function(aPosition, aIndex) {
				if (aPosition == -1) {
					offset = aIndex;
					return aPosition;
				}
				return aPosition - offset;
			});

		/* The final step, this validates all of values.
		   Smaller than -1 is invalid, so it becomes to -1. */
		aTreeStructure = aTreeStructure.map(function(aIndex) {
				return aIndex < -1 ? aDefaultParent : aIndex ;
			}, this);
		return aTreeStructure;
	},
 
	applyTreeStructureToTabs : function TSTUtils_applyTreeStructureToTabs(aTabs, aTreeStructure, aExpandStates) 
	{
		var b = this.getTabBrowserFromChild(aTabs[0]);
		if (!b) return;
		var sv = b.treeStyleTab;

		aTabs = aTabs.slice(0, aTreeStructure.length);
		aTreeStructure = aTreeStructure.slice(0, aTabs.length);

		aExpandStates = (aExpandStates && typeof aExpandStates == 'object') ?
							aExpandStates :
							aTabs.map(function(aTab) {
								return !!aExpandStates;
							});
		aExpandStates = aExpandStates.slice(0, aTabs.length);
		while (aExpandStates.length < aTabs.length) aExpandStates.push(-1);

		var parentTab = null;
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (sv.isCollapsed(tab)) sv.collapseExpandTab(tab, false, true);
			sv.detachTab(tab);

			let parentIndexInTree = aTreeStructure[i];
			if (parentIndexInTree < 0) // there is no parent, so this is a new parent!
				parentTab = tab.getAttribute(sv.kID);

			let parent = sv.getTabById(parentTab);
			if (parent) {
				let tabs = [parent].concat(sv.getDescendantTabs(parent));
				parent = parentIndexInTree < tabs.length ? tabs[parentIndexInTree] : parent ;
			}
			if (parent) {
				sv.attachTabTo(tab, parent, {
					forceExpand : true,
					dontMove    : true
				});
			}
		}

		for (let i = aTabs.length-1; i > -1; i--)
		{
			sv.collapseExpandSubtree(aTabs[i], !sv.hasChildTabs(aTabs[i]) || !aExpandStates[i], true);
		}
	},
 
	getTreeStructureFromTabBrowser : function TSTUtils_getTreeStructureFromTabBrowser(aTabBrowser) 
	{
		return this.getTreeStructureFromTabs(this.getAllTabs(aTabBrowser));
	},
 
	applyTreeStructureToTabBrowser : function TSTUtils_applyTreeStructureToTabBrowser(aTabBrowser, aTreeStructure, aExpandAllTree) 
	{
		var tabs = this.getAllTabs(aTabBrowser);
		return this.applyTreeStructureToTabs(tabs, aTreeStructure, aExpandAllTree);
	},
  
/* tabbar position */ 
	
	get position() /* PUBLIC API */ 
	{
		return this.getTreePref('tabbar.position') || 'top';
	},
	set position(aValue)
	{
		var position = String(aValue).toLowerCase();
		if (!position || !/^(top|bottom|left|right)$/.test(position))
			position = 'top';

		if (position != this.getTreePref('tabbar.position'))
			this.setTreePref('tabbar.position', position);

		return aValue;
	},
	get currentTabbarPosition() /* for backward compatibility */
	{
		return this.position;
	},
	set currentTabbarPosition(aValue)
	{
		return this.position = aValue;
	},
 
	getPositionFlag : function TSTUtils_getPositionFlag(aPosition) 
	{
		aPosition = String(aPosition).toLowerCase();
		return (aPosition == 'left') ? this.kTABBAR_LEFT :
			(aPosition == 'right') ? this.kTABBAR_RIGHT :
			(aPosition == 'bottom') ? this.kTABBAR_BOTTOM :
			this.kTABBAR_TOP;
	},
  
/* Pref Listener */ 
	
	domains : [ 
		'extensions.treestyletab.',
		'browser.tabs.loadFolderAndReplace',
		'browser.tabs.insertRelatedAfterCurrent',
		'extensions.stm.tabBarMultiRows' // Super Tab Mode
	],
 
	onPrefChange : function TSTUtils_onPrefChange(aPrefName) 
	{
		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.indent.vertical':
				this.baseIndentVertical = value;
				Services.obs.notifyObservers(null, this.kTOPIC_INDENT_MODIFIED, value);
				return;
			case 'extensions.treestyletab.indent.horizontal':
				this.baseIndentHorizontal = value;
				Services.obs.notifyObservers(null, this.kTOPIC_INDENT_MODIFIED, value);
				return;

			case 'extensions.treestyletab.tabbar.width':
			case 'extensions.treestyletab.tabbar.shrunkenWidth':
				return this.updateTabWidthPrefs(aPrefName);

			case 'browser.tabs.insertRelatedAfterCurrent':
			case 'browser.tabs.loadFolderAndReplace':
			case 'extensions.stm.tabBarMultiRows': // Super Tab Mode
				if (this.prefOverriding) return;
				aPrefName += '.override';
				this.setPref(aPrefName, value);
			case 'browser.tabs.insertRelatedAfterCurrent.override':
			case 'browser.tabs.loadFolderAndReplace.override':
			case 'extensions.stm.tabBarMultiRows.override': // Super Tab Mode
				if (this.getPref(aPrefName+'.force')) {
					let defaultValue = this.getDefaultPref(aPrefName);
					if (value != defaultValue) {
						this.setPref(aPrefName, defaultValue);
						return;
					}
				}
				this.prefOverriding = true;
				let (target = aPrefName.replace('.override', '')) {
					let originalValue = this.getPref(target);
					if (originalValue !== null && originalValue != value)
						this.setPref(target+'.backup', originalValue);
					this.setPref(target, this.getPref(aPrefName));
				}
				this.prefOverriding = false;
				return;

			case 'extensions.treestyletab.clickOnIndentSpaces.enabled':
				return this.shouldDetectClickOnIndentSpaces = this.getPref(aPrefName);

			case 'extensions.treestyletab.tabbar.scroll.smooth':
				return this.smoothScrollEnabled = value;
			case 'extensions.treestyletab.tabbar.scroll.duration':
				return this.smoothScrollDuration = value;

			case 'extensions.treestyletab.tabbar.scrollToNewTab.mode':
				return this.scrollToNewTabMode = value;

			case 'extensions.treestyletab.tabbar.narrowScrollbar.size':
				return this.updateNarrowScrollbarStyle();

			case 'extensions.treestyletab.animation.enabled':
				return this.animationEnabled = value;
			case 'extensions.treestyletab.animation.indent.duration':
				return this.indentDuration = value;
			case 'extensions.treestyletab.animation.collapse.duration':
				return this.collapseDuration = value;

			case 'extensions.treestyletab.twisty.expandSensitiveArea':
				return this.shouldExpandTwistyArea = value;

			case 'extensions.treestyletab.counter.role.horizontal':
				return this.counterRoleHorizontal = value;

			case 'extensions.treestyletab.counter.role.vertical':
				return this.counterRoleVertical = value;

			default:
				return;
		}
	},
	
	updateTabWidthPrefs : function TSTUtils_updateTabWidthPrefs(aPrefName) 
	{
		var expanded = this.getTreePref('tabbar.width');
		var shrunken = this.getTreePref('tabbar.shrunkenWidth');
		var originalExpanded = expanded;
		var originalShrunken = shrunken;
		if (aPrefName == 'extensions.treestyletab.tabbar.shrunkenWidth') {
			if (expanded <= shrunken)
				expanded = parseInt(shrunken / this.DEFAULT_SHRUNKEN_WIDTH_RATIO)
			let w = this.browserWindow;
			if (w && expanded > w.gBrowser.boxObject.width) {
				expanded = w.gBrowser.boxObject.width * this.MAX_TABBAR_SIZE_RATIO;
				if (expanded <= shrunken)
					shrunken = parseInt(expanded * this.DEFAULT_SHRUNKEN_WIDTH_RATIO)
			}
		}
		else {
			if (expanded <= shrunken)
				shrunken = parseInt(expanded * this.DEFAULT_SHRUNKEN_WIDTH_RATIO);
		}
		if (expanded != originalExpanded ||
			shrunken != originalShrunken) {
			this.setTreePref('tabbar.width', Math.max(0, expanded));
			this.setTreePref('tabbar.shrunkenWidth', Math.max(0, shrunken));
		}
	},
   
/* Save/Load Prefs */ 
	
	getTreePref : function TSTUtils_getTreePref(aPrefstring) 
	{
		return this.getPref('extensions.treestyletab.'+aPrefstring);
	},
 
	setTreePref : function TSTUtils_setTreePref(aPrefstring, aNewValue) 
	{
		return this.setPref('extensions.treestyletab.'+aPrefstring, aNewValue);
	},
 
	clearTreePref : function TSTUtils_clearTreePref(aPrefstring) 
	{
		return this.clearPref('extensions.treestyletab.'+aPrefstring);
	},
 
	get shouldApplyNewPref() 
	{
		return (
					!this.applyOnlyForActiveWindow ||
					this.window == this.topBrowserWindow
				) &&
				!this.inWindowDestoructionProcess;
	},
 
	applyOnlyForActiveWindow : false, 
	setPrefForActiveWindow : function(aTask) {
		TreeStyleTabUtils.applyOnlyForActiveWindow = true;
		try {
			aTask.call(this);
		}
		finally {
			TreeStyleTabUtils.applyOnlyForActiveWindow = false;
		}
	}
  
}; 
 
TreeStyleTabUtils.init(); 
  
