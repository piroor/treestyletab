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
 
const EXPORTED_SYMBOLS = ['TreeStyleTabBase']; 

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/Timer.jsm');
Cu.import('resource://treestyletab-modules/constants.js');

XPCOMUtils.defineLazyGetter(this, 'window', function() {
	Cu.import('resource://treestyletab-modules/lib/namespace.jsm');
	return getNamespaceFor('piro.sakura.ne.jp');
});
XPCOMUtils.defineLazyGetter(this, 'prefs', function() {
	Cu.import('resource://treestyletab-modules/lib/prefs.js');
	return window['piro.sakura.ne.jp'].prefs;
});
XPCOMUtils.defineLazyGetter(this, 'extensions', function() {
	Cu.import('resource://treestyletab-modules/lib/extensions.js', {});
	return window['piro.sakura.ne.jp'].extensions;
});
XPCOMUtils.defineLazyGetter(this, 'animationManager', function() {
	Cu.import('resource://treestyletab-modules/lib/animationManager.js', {});
	return window['piro.sakura.ne.jp'].animationManager;
});
XPCOMUtils.defineLazyGetter(this, 'autoScroll', function() {
	Cu.import('resource://treestyletab-modules/lib/autoScroll.js', {});
	return window['piro.sakura.ne.jp'].autoScroll;
});
XPCOMUtils.defineLazyModuleGetter(this, 'UninstallationListener',
  'resource://treestyletab-modules/lib/UninstallationListener.js');
XPCOMUtils.defineLazyModuleGetter(this, 'Deferred',
  'resource://treestyletab-modules/lib/jsdeferred.js');
XPCOMUtils.defineLazyModuleGetter(this, 'confirmWithPopup', 'resource://treestyletab-modules/lib/confirmWithPopup.js');
XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');

XPCOMUtils.defineLazyServiceGetter(this, 'SessionStore',
  '@mozilla.org/browser/sessionstore;1', 'nsISessionStore');

if (Services.appinfo.OS === 'WINNT') {
	XPCOMUtils.defineLazyModuleGetter(this, 'AeroPeek',
	  'resource:///modules/WindowsPreviewPerTab.jsm', 'AeroPeek');
}
else {
	this.AeroPeek = null;
}
 
var TreeStyleTabBase = { 
	__proto__ : TreeStyleTabConstants,
	
	tabsHash : null, 
	inWindowDestoructionProcess : false,
 
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
		return SessionStore;
	},

	get extensions() { return extensions; },
	get animationManager() { return animationManager; },
	get autoScroll() { return autoScroll; },
	get Deferred() { return Deferred; },
	get AeroPeek() { return AeroPeek; }, // for Windows
 
	init : function TSTBase_init() 
	{
		if (this._initialized)
			return;

		this.isMac = Services.appinfo.OS == 'Darwin';

		this.applyPlatformDefaultPrefs();
		utils.migratePrefs();

		prefs.addPrefListener(this);

		this.initUninstallationListener();

		this.onPrefChange('extensions.treestyletab.indent.vertical');
		this.onPrefChange('extensions.treestyletab.indent.horizontal');
		this.onPrefChange('extensions.treestyletab.clickOnIndentSpaces.enabled');
		this.onPrefChange('browser.tabs.insertRelatedAfterCurrent.override');
		this.onPrefChange('extensions.stm.tabBarMultiRows.override'); // Super Tab Mode
		this.onPrefChange('extensions.treestyletab.tabbar.scroll.smooth');
		this.onPrefChange('extensions.treestyletab.tabbar.scroll.duration');
		this.onPrefChange('extensions.treestyletab.tabbar.scrollToNewTab.mode');
		this.onPrefChange('extensions.treestyletab.tabbar.narrowScrollbar.size');
		this.onPrefChange('browser.tabs.animate');
		this.onPrefChange('extensions.treestyletab.animation.indent.duration');
		this.onPrefChange('extensions.treestyletab.animation.collapse.duration');
		this.onPrefChange('extensions.treestyletab.twisty.expandSensitiveArea');
		this.onPrefChange('extensions.treestyletab.counter.role.horizontal');
		this.onPrefChange('extensions.treestyletab.counter.role.vertical');

		try {
			this.overrideExtensions();
		}
		catch(e) {
			dump(e+'\n');
		}
	},
	_initialized : false,
	
	applyPlatformDefaultPrefs : function TSTBase_applyPlatformDefaultPrefs() 
	{
		var OS = Services.appinfo.OS;
		var processed = {};
		var originalKeys = prefs.getDescendant('extensions.treestyletab.platform.'+OS);
		for (let i = 0, maxi = originalKeys.length; i < maxi; i++)
		{
			let originalKey = originalKeys[i];
			let key = originalKey.replace('platform.'+OS+'.', '');
			prefs.setDefaultPref(key, prefs.getPref(originalKey));
			processed[key] = true;
		}
		originalKeys = prefs.getDescendant('extensions.treestyletab.platform.default');
		for (let i = 0, maxi = originalKeys.length; i < maxi; i++)
		{
			let originalKey = originalKeys[i];
			let key = originalKey.replace('platform.default.', '');
			if (!(key in processed))
				prefs.setDefaultPref(key, prefs.getPref(originalKey));
		}
	},

	initUninstallationListener : function TSTWindow_initUninstallationListener()
	{
		var restorePrefs = function() {
			// Remove pref listener before restore backuped prefs.
			prefs.removePrefListener(this);

			let restorePrefs = [
				'browser.tabs.insertRelatedAfterCurrent',
				'extensions.stm.tabBarMultiRows' // Super Tab Mode
			];
			for (let i = 0, maxi = restorePrefs.length; i < maxi; i++)
			{
				let pref = restorePrefs[i];
				let backup = prefs.getPref(pref+'.backup');
				if (backup === null)
					continue;
				// restore user preference.
				prefs.setPref(pref, backup);
				// clear backup pref.
				prefs.clearPref(pref+'.backup');
			}
		}.bind(this);
		new UninstallationListener({
			id : 'treestyletab@piro.sakura.ne.jp',
			onuninstalled : restorePrefs,
			ondisabled : restorePrefs
		});
	},
 
	overrideExtensions : function TSTBase_overrideExtensions() 
	{
		// Scriptish
		// https://addons.mozilla.org/firefox/addon/scriptish/
		if (utils.getTreePref('compatibility.Scriptish')) {
			try {
				let tabModule = Cu.import('resource://scriptish/utils/Scriptish_openInTab.js', {});
				let Scriptish_openInTab = tabModule.Scriptish_openInTab;
				tabModule.Scriptish_openInTab = function(aURL, aLoadInBackground, aReuse, aChromeWin, ...aExtraArgs) {
					try {
						aChromeWin.TreeStyleTabService.readyToOpenChildTabNow(aChromeWin.gBrowser);
					}
					catch(e) {
						Cu.reportError(e);
					}
					var allArgs = [aURL, aLoadInBackground, aReuse, aChromeWin].concat(aExtraArgs);
					return Scriptish_openInTab.apply(this, allArgs);
				};
			}
			catch(e) {
			}
		}
	},
 
	updateNarrowScrollbarStyle : function TSTBase_updateNarrowScrollbarStyle() 
	{
		const SSS = Cc['@mozilla.org/content/style-sheet-service;1']
					.getService(Ci.nsIStyleSheetService);

		if (this.lastAgentSheet &&
			SSS.sheetRegistered(this.lastAgentSheet, SSS.AGENT_SHEET))
			SSS.unregisterSheet(this.lastAgentSheet, SSS.AGENT_SHEET);

		const style = 'data:text/css,'+encodeURIComponent(
			('@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");' +

			'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
			'  .tabbrowser-arrowscrollbox' +
			'  > scrollbox' +
			'  > scrollbar[orient="vertical"],' +
			'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
			'  .tabbrowser-arrowscrollbox' +
			'  > scrollbox' +
			'  > scrollbar[orient="vertical"] * {' +
			'  max-width: %SIZE%;' +
			'  min-width: %SIZE%;' +
			'}' +

			'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
			'  .tabbrowser-arrowscrollbox' +
			'  > scrollbox' +
			'  > scrollbar[orient="vertical"] {' +
			'  font-size: %SIZE%;' +
			'}' +

			'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
			'  .tabbrowser-arrowscrollbox' +
			'  > scrollbox' +
			'  > scrollbar[orient="vertical"] * {' +
			'  padding-left: 0;' +
			'  padding-right: 0;' +
			'  margin-left: 0;' +
			'  margin-right: 0;' +
			'}' +

			'%FORCE_NARROW_SCROLLBAR%')
				.replace(/%FORCE_NARROW_SCROLLBAR%/g,
					utils.getTreePref('tabbar.narrowScrollbar.overrideSystemAppearance') ?
						this.kOVERRIDE_SYSTEM_SCROLLBAR_APPEARANCE : '' )
				.replace(/%MODE%/g, this.kMODE)
				.replace(/%NARROW%/g, this.kNARROW_SCROLLBAR)
				.replace(/%SIZE%/g, utils.getTreePref('tabbar.narrowScrollbar.size'))
			);
		this.lastAgentSheet = this.makeURIFromSpec(style);
		SSS.loadAndRegisterSheet(this.lastAgentSheet, SSS.AGENT_SHEET);
	},
	kOVERRIDE_SYSTEM_SCROLLBAR_APPEARANCE :
		'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
		'  .tabbrowser-arrowscrollbox' +
		'  > scrollbox' +
		'  > scrollbar[orient="vertical"] {' +
		'  appearance: none;' +
		'  -moz-appearance: none;' +
		'  background: ThreeDFace;' +
		'  border: 1px solid ThreeDShadow;' +
		'}',
	lastAgentSheet : null,
  
/* references to the owner */ 
	
	get browserWindow() 
	{
		return this.topBrowserWindow;
	},
	get topBrowserWindow()
	{
		return Services.wm.getMostRecentWindow('navigator:browser');
	},
 
	get browserWindows() 
	{
		var windows = [];

		var targets = Services.wm.getZOrderDOMWindowEnumerator('navigator:browser', true);
		// By the bug 156333, we cannot find windows by their Z order on Linux.
		// https://bugzilla.mozilla.org/show_bug.cgi?id=156333
		if (!targets.hasMoreElements())
			targets = Services.wm.getEnumerator('navigator:browser');

		while (targets.hasMoreElements())
		{
			let target = targets.getNext()
							.QueryInterface(Ci.nsIDOMWindow);
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
 
/* calculated behaviors */ 
	
	dropLinksOnTabBehavior : function TSTBase_dropLinksOnTabBehavior() 
	{
		var behavior = utils.getTreePref('dropLinksOnTab.behavior');
		if (behavior & this.kDROPLINK_FIXED)
			return behavior;

		var checked = { value : false };
		var newChildTab = Services.prompt.confirmEx(this.browserWindow,
				utils.treeBundle.getString('dropLinkOnTab.title'),
				utils.treeBundle.getString('dropLinkOnTab.text'),
				(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
				(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1),
				utils.treeBundle.getString('dropLinkOnTab.openNewChildTab'),
				utils.treeBundle.getString('dropLinkOnTab.loadInTheTab'),
				null,
				utils.treeBundle.getString('dropLinkOnTab.never'),
				checked
			) == 0;

		behavior = newChildTab ? this.kDROPLINK_NEWTAB : this.kDROPLINK_LOAD ;
		if (checked.value)
			utils.setTreePref('dropLinksOnTab.behavior', behavior);

		return behavior
	},
	kDROPLINK_ASK    : 0,
	kDROPLINK_FIXED  : 1 + 2,
	kDROPLINK_LOAD   : 1,
	kDROPLINK_NEWTAB : 2,
 
	openGroupBookmarkBehavior : function TSTBase_openGroupBookmarkBehavior() 
	{
		var behavior = utils.getTreePref('openGroupBookmark.behavior');
		if (behavior & this.kGROUP_BOOKMARK_FIXED)
			return behavior;

		var dummyTabFlag = behavior & this.kGROUP_BOOKMARK_USE_DUMMY;

		var checked = { value : false };
		var button = Services.prompt.confirmEx(this.browserWindow,
				utils.treeBundle.getString('openGroupBookmarkBehavior.title'),
				utils.treeBundle.getString('openGroupBookmarkBehavior.text'),
				(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
				(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1),
				utils.treeBundle.getString('openGroupBookmarkBehavior.subTree'),
				utils.treeBundle.getString('openGroupBookmarkBehavior.separate'),
				null,
				utils.treeBundle.getString('openGroupBookmarkBehavior.never'),
				checked
			);

		if (button < 0)
			button = 1;
		var behaviors = [
				this.kGROUP_BOOKMARK_SUBTREE | dummyTabFlag,
				this.kGROUP_BOOKMARK_SEPARATE
			];
		behavior = behaviors[button];

		if (checked.value) {
			utils.setTreePref('openGroupBookmark.behavior', behavior);
		}
		return behavior;
	},
	kGROUP_BOOKMARK_ASK       : 0,
	kGROUP_BOOKMARK_FIXED     : 1 + 2 + 4,
	kGROUP_BOOKMARK_SUBTREE   : 1,
	kGROUP_BOOKMARK_SEPARATE  : 2,
	kGROUP_BOOKMARK_USE_DUMMY                   : 256,
	kGROUP_BOOKMARK_USE_DUMMY_FORCE             : 1024,
	kGROUP_BOOKMARK_DONT_RESTORE_TREE_STRUCTURE : 512,
	kGROUP_BOOKMARK_EXPAND_ALL_TREE             : 2048,
 
	bookmarkDroppedTabsBehavior : function TSTBase_bookmarkDroppedTabsBehavior() 
	{
		var behavior = utils.getTreePref('bookmarkDroppedTabs.behavior');
		if (behavior & this.kBOOKMARK_DROPPED_TABS_FIXED)
			return behavior;

		var checked = { value : false };
		var button = Services.prompt.confirmEx(this.browserWindow,
				utils.treeBundle.getString('bookmarkDroppedTabs.title'),
				utils.treeBundle.getString('bookmarkDroppedTabs.text'),
				(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
				(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1),
				utils.treeBundle.getString('bookmarkDroppedTabs.bookmarkAll'),
				utils.treeBundle.getString('bookmarkDroppedTabs.bookmarkOnlyParent'),
				null,
				utils.treeBundle.getString('bookmarkDroppedTabs.never'),
				checked
			);

		if (button < 0)
			button = 1;
		var behaviors = [
				this.kBOOKMARK_DROPPED_TABS_ALL,
				this.kBOOKMARK_DROPPED_TABS_ONLY_PARENT
			];
		behavior = behaviors[button];

		if (checked.value)
			utils.setTreePref('bookmarkDroppedTabs.behavior', behavior);

		return behavior;
	},
	kBOOKMARK_DROPPED_TABS_ASK         : 0,
	kBOOKMARK_DROPPED_TABS_FIXED       : 1 | 2,
	kBOOKMARK_DROPPED_TABS_ALL         : 1,
	kBOOKMARK_DROPPED_TABS_ONLY_PARENT : 2,
 
	askUndoCloseTabSetBehavior : function TSTBase_askUndoCloseTabSetBehavior(aRestoredTab, aCount) 
	{
		var behavior = this.undoCloseTabSetBehavior;
		if (behavior & this.kUNDO_CLOSE_SET)
			behavior ^= this.kUNDO_CLOSE_SET;

		var self = this;
		return confirmWithPopup({
				browser  : aRestoredTab.linkedBrowser,
				label    : utils.treeBundle.getFormattedString('undoCloseTabSetBehavior.label', [aCount]),
				value    : 'treestyletab-undo-close-tree',
				image    : 'chrome://treestyletab/content/res/icon.png',
				buttons  : [
					utils.treeBundle.getString('undoCloseTabSetBehavior.restoreOnce'),
					utils.treeBundle.getString('undoCloseTabSetBehavior.restoreForever'),
					utils.treeBundle.getString('undoCloseTabSetBehavior.ignoreForever')
				],
				persistence : -1 // don't hide even if the tab is restored after the panel is shown.
			})
			.next(function(aButtonIndex) {
				if (aButtonIndex < 2) {
					behavior |= self.kUNDO_CLOSE_SET;
				}
				if (aButtonIndex > 0) {
					behavior ^= self.kUNDO_ASK;
					utils.setTreePref('undoCloseTabSet.behavior', behavior);
				}
				return behavior;
			});
	},
	get undoCloseTabSetBehavior()
	{
		return utils.getTreePref('undoCloseTabSet.behavior');
	},
	kUNDO_ASK            : 1,
	kUNDO_CLOSE_SET      : 2,
	kUNDO_CLOSE_FULL_SET : 256,
  
/* utilities */ 
	
	doAndWaitDOMEvent : function TSTBase_doAndWaitDOMEvent(...aArgs) 
	{
		var type, target, delay, task;
		for (let i = 0, maxi = aArgs.length; i < maxi; i++)
		{
			let arg = aArgs[i];
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
			if (task)
				task();
			return;
		}

		var done = false;
		var listener = function(aEvent) {
				setTimeout(function() {
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
 
	findOffsetParent : function TSTBase_findOffsetParent(aNode) 
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
 
	assertBeforeDestruction : function TSTBase_assertBeforeDestruction(aNotDestructed) 
	{
		if (aNotDestructed)
			return;

		var message = 'ERROR: accessed after destruction!';
		var error = new Error(message);
		dump(message+'\n'+error.stack+'\n');
		throw error;
	},
  
	defaultDeferredErrorHandler : function TSTBase_defaultDeferredErrorHandler(aError) 
	{
		if (aError.stack)
			Cu.reportError(aError.message+'\n'+aError.stack);
		else
			Cu.reportError(aError);
	},
 
// event 
	
	isNewTabAction : function TSTBase_isNewTabAction(aEvent) 
	{
		return aEvent.button == 1 || (aEvent.button == 0 && this.isAccelKeyPressed(aEvent));
	},
 
	isAccelKeyPressed : function TSTBase_isAccelKeyPressed(aEvent) 
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
 
	isCopyAction : function TSTBase_isCopyAction(aEvent) 
	{
		return this.isAccelKeyPressed(aEvent) ||
				(aEvent.dataTransfer && aEvent.dataTransfer.dropEffect == 'copy');
	},
 
	isEventFiredOnClosebox : function TSTBase_isEventFiredOnClosebox(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " tab-close-button ")]',
				aEvent.originalTarget || aEvent.target,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnClickable : function TSTBase_isEventFiredOnClickable(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(" button toolbarbutton scrollbar nativescrollbar popup menupopup panel tooltip splitter textbox ", concat(" ", local-name(), " "))]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnScrollbar : function TSTBase_isEventFiredOnScrollbar(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[local-name()="scrollbar" or local-name()="nativescrollbar"]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnTwisty : function TSTBase_isEventFiredOnTwisty(aEvent) 
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
	getFaviconRect : function TSTBase_getFaviconRect(aTab)
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
	fireDataContainerEvent : function TSTBase_fireDataContainerEvent(...aArgs)
	{
		var target, document, type, data, canBubble, cancellable;
		for (let i = 0, maxi = aArgs.length; i < maxi; i++)
		{
			let arg = aArgs[i];
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
 
	registerExpandTwistyAreaBlocker : function TSTBase_registerExpandTwistyAreaBlocker(aBlocker) /* PUBLIC API */ 
	{
		if (this._expandTwistyAreaBlockers.indexOf(aBlocker) < 0)
			this._expandTwistyAreaBlockers.push(aBlocker);
	},
	_expandTwistyAreaBlockers : [],
 
	registerExpandTwistyAreaAllowance : function TSTBase_registerExpandTwistyAreaAllowance(aAllowance) /* PUBLIC API, obsolete, for backward compatibility */ 
	{
		this.registerExpandTwistyAreaBlocker(aAllowance.toSource());
	},
   
// string 
	
	makeNewId : function TSTBase_makeNewId() 
	{
		return 'tab-<'+Date.now()+'-'+parseInt(Math.random() * 65000)+'>';
	},
 
	makeNewClosedSetId : function TSTBase_makeNewId() 
	{
		return 'tabs-closed-set-<'+Date.now()+'-'+parseInt(Math.random() * 65000)+'>';
	},
 
	makeURIFromSpec : function TSTBase_makeURIFromSpec(aURI) 
	{
		var newURI;
		aURI = aURI || '';
		if (aURI && String(aURI).indexOf('file:') == 0) {
			var fileHandler = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler);
			var tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
			newURI = Services.io.newFileURI(tempLocalFile);
		}
		else {
			if (!/^\w+\:/.test(aURI))
				aURI = 'http://'+aURI;
			newURI = Services.io.newURI(aURI, null, null);
		}
		return newURI;
	},
 
	getGroupTabURI : function TSTBase_getGroupTabURI(aOptions) 
	{
		aOptions = aOptions || {};
		var parameters = [];
		parameters.push('title=' + encodeURIComponent(aOptions.title || ''));
		parameters.push('temporary=' + !!aOptions.temporary);
		return 'about:treestyletab-group?' + parameters.join('&');
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
 
	evaluateXPath : function TSTBase_evaluateXPath(aExpression, aContext, aType) 
	{
		if (!aType)
			aType = Ci.nsIDOMXPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
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
 
	getArrayFromXPathResult : function TSTBase_getArrayFromXPathResult(aXPathResult) 
	{
		var max = aXPathResult.snapshotLength;
		var array = new Array(max);
		if (!max)
			return array;

		for (var i = 0; i < max; i++)
		{
			array[i] = aXPathResult.snapshotItem(i);
		}

		return array;
	},
  
/* Session Store API */ 
	
	getTabValue : function TSTBase_getTabValue(aTab, aKey) 
	{
		var value = '';
		try {
			value = SessionStore.getTabValue(aTab, aKey);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI) {
			let TMPValue = aTab.getAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey);
			if (TMPValue)
				value = TMPValue;
		}

		return value;
	},
 
	setTabValue : function TSTBase_setTabValue(aTab, aKey, aValue) 
	{
		if (!aValue)
			return this.deleteTabValue(aTab, aKey);

		aTab.setAttribute(aKey, aValue);
		try {
			this.checkCachedSessionDataExpiration(aTab);
			SessionStore.setTabValue(aTab, aKey, aValue);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI)
			aTab.setAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey, aValue);

		return aValue;
	},
 
	deleteTabValue : function TSTBase_deleteTabValue(aTab, aKey) 
	{
		aTab.removeAttribute(aKey);
		try {
			this.checkCachedSessionDataExpiration(aTab);
			SessionStore.setTabValue(aTab, aKey, '');
			SessionStore.deleteTabValue(aTab, aKey);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI)
			aTab.removeAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey);
	},
 
	// workaround for http://piro.sakura.ne.jp/latest/blosxom/mozilla/extension/treestyletab/2009-09-29_debug.htm
	// This is obsolete for lately Firefox and no need to be updated. See: https://github.com/piroor/treestyletab/issues/508#issuecomment-17526429
	checkCachedSessionDataExpiration : function TSTBase_checkCachedSessionDataExpiration(aTab) 
	{
		var data = aTab.linkedBrowser.__SS_data;
		if (data &&
			data._tabStillLoading &&
			aTab.getAttribute('busy') != 'true' &&
			!utils.isTabNeedToBeRestored(aTab))
			data._tabStillLoading = false;
	},
 
	markAsClosedSet : function TSTBase_markAsClosedSet(aTabs) /* PUBLIC API */ 
	{
		if (!aTabs || aTabs.length <= 1)
			return;
		var id = this.makeNewClosedSetId() + '::' + aTabs.length;
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			this.setTabValue(aTabs[i], this.kCLOSED_SET_ID, id);
		}
	},
 
	unmarkAsClosedSet : function TSTBase_unmarkAsClosedSet(aTabs) /* PUBLIC API */ 
	{
		if (!aTabs || !aTabs.length)
			return;
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			this.deleteTabValue(aTabs[i], this.kCLOSED_SET_ID);
		}
	},
 
	useTMPSessionAPI : false, 
 
	kTMP_SESSION_DATA_PREFIX : 'tmp-session-data-', 
  
// tab 
	
	getTabStrip : function TSTBase_getTabStrip(aTabBrowser) 
	{
		if (!(aTabBrowser instanceof Ci.nsIDOMElement))
			return null;

		var strip = aTabBrowser.mStrip;
		return (strip && strip instanceof Ci.nsIDOMElement) ?
				strip :
				this.evaluateXPath(
					'ancestor::xul:toolbar[1]',
					aTabBrowser.tabContainer,
					Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
				).singleNodeValue || aTabBrowser.tabContainer.parentNode;
	},
	get tabStrip()
	{
		return this.getTabStrip(this.browser);
	},
 
	getTabContainerBox : function TSTBase_getTabContainerBox(aTabBrowser) 
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
 
	setTabbrowserAttribute : function TSTBase_setTabbrowserAttribute(aName, aValue, aTabBrowser) 
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
 
	removeTabbrowserAttribute : function TSTBase_removeTabbrowserAttribute(aName, aTabBrowser) 
	{
		this.setTabbrowserAttribute(aName, null, aTabBrowser);
	},
 
	setTabStripAttribute : function TSTBase_setTabStripAttribute(aAttr, aValue) 
	{
		var strip = this.tabStrip;
		if (!strip)
			return;
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
 
	removeTabStripAttribute : function TSTBase_removeTabStripAttribute(aAttr) 
	{
		this.setTabStripAttribute(aAttr, null);
	},
 
	getTabFromChild : function TSTBase_getTabFromChild(aTab) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:tab',
				aTab,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabFromEvent : function TSTBase_getTabFromEvent(aEvent) 
	{
		return this.getTabFromChild(aEvent.originalTarget || aEvent.target);
	},
 
	getNewTabButtonFromEvent : function TSTBase_getNewTabButtonFromEvent(aEvent) 
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
 
	getSplitterFromEvent : function TSTBase_getSplitterFromEvent(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:splitter[contains(concat(" ", normalize-space(@class), " "), " '+this.kSPLITTER+' ")]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	isEventFiredOnGrippy : function TSTBase_isEventFiredOnGrippy(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:grippy',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	getTabFromFrame : function TSTBase_getTabFromFrame(aFrame, aTabBrowser) 
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
 
	getTabbarFromChild : function TSTBase_getTabbarFromChild(aNode) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " tabbrowser-strip ")] | ' +
				'ancestor-or-self::xul:tabs[@tabbrowser] | ' +
				'ancestor-or-self::xul:toolbar/child::xul:tabs[@tabbrowser]',
				aNode,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
	getAncestorTabbarFromChild : function TSTBase_getAncestorTabbarFromChild(aNode)
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " tabbrowser-strip ")] | ' +
				'ancestor-or-self::xul:tabs[@tabbrowser]',
				aNode,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabbarFromEvent : function TSTBase_getTabbarFromEvent(aEvent) 
	{
		return this.getTabbarFromChild(aEvent.originalTarget || aEvent.target);
	},
	getAncestorTabbarFromEvent : function TSTBase_getAncestorTabbarFromEvent(aEvent)
	{
		return this.getAncestorTabbarFromChild(aEvent.originalTarget || aEvent.target);
	},
 
	cleanUpTabsArray : function TSTBase_cleanUpTabsArray(aTabs) 
	{
		var newTabs = [];
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (!tab || !tab.parentNode)
				continue; // ignore removed tabs
			if (newTabs.indexOf(tab) < 0)
				newTabs.push(tab);
		}
		newTabs.sort(this.sortTabsByOrder);
		return newTabs;
	},
	
	sortTabsByOrder : function TSTBase_sortTabsByOrder(aA, aB) 
	{
		return aA._tPos - aB._tPos;
	},
  
	gatherSubtreeMemberTabs : function TSTBase_gatherSubtreeMemberTabs(aTabOrTabs, aOnlyChildren) 
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
 
	splitTabsToSubtrees : function TSTBase_splitTabsToSubtrees(aTabs) /* PUBLIC API */ 
	{
		var groups = [];

		var group = [];
		aTabs = this.cleanUpTabsArray(aTabs);
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			let parent = this.getParentTab(tab);
			if (!parent || group.indexOf(parent) < 0) {
				if (group.length)
					groups.push(group);
				group = [tab];
			}
			else {
				group.push(tab);
			}
		}
		if (group.length)
			groups.push(group);
		return groups;
	},
  
// tabbrowser 
	
	getTabBrowserFromChild : function TSTBase_getTabBrowserFromChild(aTabBrowserChild) 
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
 
	getTabBrowserFromFrame : function TSTBase_getTabBrowserFromFrame(aFrame) 
	{
		var w = this.browserWindow;
		return !w ? null :
			('SplitBrowser' in w) ? this.getTabBrowserFromChild(w.SplitBrowser.getSubBrowserAndBrowserFromFrame(aFrame.top).browser) :
			this.browser ;
	},
 
	getFrameFromTabBrowserElements : function TSTBase_getFrameFromTabBrowserElements(aFrameOrTabBrowser) 
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
				if (!frame)
					return null;
				frame = frame.contentWindow;
			}
		}
		if (!frame)
			frame = this.browser.contentWindow;

		return frame;
	},
  
/* get tab(s) */ 
	
	getTabById : function TSTBase_getTabById(aId, aTabBrowserChildren) 
	{
		if (!aId)
			return null;

		if (aTabBrowserChildren && !(aTabBrowserChildren instanceof Ci.nsIDOMNode))
			aTabBrowserChildren = null;

		var b = this.getTabBrowserFromChild(aTabBrowserChildren) || this.browser;

		if (this.tabsHash) // XPath-less implementation
			return this.tabsHash[aId] || null;

		return b.mTabContainer.querySelector('tab['+this.kID+'="'+aId+'"]');
	},
 
	isTabDuplicated : function TSTBase_isTabDuplicated(aTab) 
	{
		if (!aTab)
			return false;
		var id = this.getTabValue(aTab, this.kID);
		var b = this.getTabBrowserFromChild(aTab) || this.browser;
		var tabs = b.mTabContainer.querySelectorAll('tab['+this.kID+'="'+id+'"], tab['+this.kID_RESTORING+'="'+id+'"]');
		return tabs.length > 1;
	},
 
	/**
	 * Returns all tabs in the current group as an array.
	 * It includes tabs hidden by Tab Panorama.
	 */
	getAllTabs : function TSTBase_getTabs(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		return Array.slice(b.mTabContainer.querySelectorAll('tab'));
	},
 
	/**
	 * Returns all tabs in the current group as an array.
	 * It excludes tabs hidden by Tab Panorama.
	 */
	getTabs : function TSTBase_getTabs(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		return Array.slice(b.mTabContainer.querySelectorAll('tab:not([hidden="true"])'));
	},
 
	getAllTabsArray : function TSTBase_getAllTabsArray(aTabBrowserChild) /* for backward compatibility */ 
	{
		return this.getAllTabs(aTabBrowserChild);
	},
 
	getTabsArray : function TSTBase_getTabsArray(aTabBrowserChild) /* for backward compatibility */ 
	{
		return this.getTabs(aTabBrowserChild);
	},
 
	/**
	 * Returns the first tab in the current group.
	 */
	getFirstTab : function TSTBase_getFirstTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		var tabs = b.visibleTabs;
		return tabs ? tabs[0] : b.mTabContainer.firstChild;
	},
 
	/**
	 * Returns the first visible, not collapsed, and not pinned tab.
	 */
	getFirstNormalTab : function TSTBase_getFirstNormalTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		return b.mTabContainer.querySelector('tab:not([pinned="true"]):not([hidden="true"])');
	},
 
	/**
	 * Returns the last tab in the current group.
	 */
	getLastTab : function TSTBase_getLastTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		this.assertBeforeDestruction(b && b.mTabContainer);
		var tabs = b.visibleTabs;
		return tabs ? tabs[tabs.length-1] : b.mTabContainer.lastChild ;
	},
 
	/**
	 * Returns the next tab in the current group.
	 */
	getNextTab : function TSTBase_getNextTab(aTab) 
	{
		if (!aTab)
			return null;
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
	getPreviousTab : function TSTBase_getPreviousTab(aTab) 
	{
		if (!aTab)
			return null;
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
	getTabIndex : function TSTBase_getTabIndex(aTab) 
	{
		if (!aTab)
			return -1;
		var b = this.getTabBrowserFromChild(aTab);
		return this.getTabs(b).indexOf(aTab);
	},
 
	/**
	 * Returns the next not collapsed tab in the current group.
	 */
	getNextVisibleTab : function TSTBase_getNextVisibleTab(aTab) 
	{
		if (!aTab)
			return null;

		var b = this.getTabBrowserFromChild(aTab);
		if (!this.canCollapseSubtree(b))
			return this.getNextTab(aTab);

		var tabs = this.getVisibleTabs(b);
		if (tabs.indexOf(aTab) < 0)
			tabs.push(aTab);
		tabs.sort(this.sortTabsByOrder);

		var index = tabs.indexOf(aTab);
		return (index < tabs.length-1) ? tabs[index+1] : null ;
	},
 
	/**
	 * Returns the previous not collapsed tab in the current group.
	 */
	getPreviousVisibleTab : function TSTBase_getPreviousVisibleTab(aTab) 
	{
		if (!aTab)
			return null;

		var b = this.getTabBrowserFromChild(aTab);
		if (!this.canCollapseSubtree(b))
			return this.getPreviousTab(aTab);

		var tabs = this.getVisibleTabs(b);
		if (tabs.indexOf(aTab) < 0)
			tabs.push(aTab);
		tabs.sort(this.sortTabsByOrder);

		var index = tabs.indexOf(aTab);
		return (index > 0) ? tabs[index-1] : null ;
	},
 
	/**
	 * Returns the last not collapsed tab in the current group.
	 */
	getLastVisibleTab : function TSTBase_getLastVisibleTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		if (!b)
			return null;
		var tabs = this.getVisibleTabs(b);
		return tabs.length ? tabs[tabs.length-1] : null ;
	},
 
	/**
	 * Returns a XPathResult of not collapsed tabs in the current group.
	 */
	getVisibleTabs : function TSTBase_getVisibleTabs(aTabBrowserChild) /* OBSOLETE */ 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild || this.browser);
		if (!this.canCollapseSubtree(b))
			return this.getTabs(b);
		return Array.slice(b.mTabContainer.querySelectorAll('tab:not(['+this.kCOLLAPSED+'="true"]):not([hidden="true"])'));
	},
 
	getVisibleTabsArray : function TSTBase_getVisibleTabsArray(aTabBrowserChild) /* for backward compatibility */ 
	{
		return this.getVisibleTabs(aTabBrowserChild);
	},
 
	/**
	 * Returns the index of the specified tab, in the array of not collapsed
	 * tabs in the current group.
	 */
	getVisibleIndex : function TSTBase_getVisibleIndex(aTab) 
	{
		if (!aTab)
			return -1;
		var b = this.getTabBrowserFromChild(aTab);
		return this.getVisibleTabs(b).indexOf(aTab);
	},
 
	/** 
	 * Returns tabs which are newly opened in the given operation.
	 */
	getNewTabsWithOperation : function TSTBase_getNewTabsWithOperation(aOperation, aTabBrowser)
	{
		var previousTabs = this.getTabsInfo(aTabBrowser);
		aOperation.call(this);
		return this.getNewTabsFromPreviousTabsInfo(aTabBrowser, previousTabs);
	},
 
	/**
	 * Returns tabs which are newly opened. This requires the "previous state".
	 */
	getNewTabsFromPreviousTabsInfo : function TSTBase_getNewTabsFromPreviousTabsInfo(aTabBrowser, aTabsInfo) 
	{
		var tabs = this.getTabs(aTabBrowser);
		var currentTabsInfo = this.getTabsInfo(aTabBrowser);
		return tabs.filter(function(aTab, aIndex) {
				return aTabsInfo.indexOf(currentTabsInfo[aIndex]) < 0;
			});
	},
	getTabsInfo : function TSTBase_getTabsInfo(aTabBrowser)
	{
		var tabs = this.getTabs(aTabBrowser);
		return tabs.map(function(aTab) {
				return aTab.getAttribute(this.kID)+'\n'+
						aTab.getAttribute('busy')+'\n'+
						aTab.linkedBrowser.currentURI.spec;
			}, this);
	},
  
/* notify "ready to open child tab(s)" */ 
	
	readyToOpenChildTab : function TSTBase_readyToOpenChildTab(aFrameOrTabBrowser, aMultiple, aInsertBefore) /* PUBLIC API */ 
	{
		if (!utils.getTreePref('autoAttach'))
			return false;

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
	readyToOpenChildTabNow : function TSTBase_readyToOpenChildTabNow(...aArgs) /* PUBLIC API */
	{
		if (this.readyToOpenChildTab.apply(this, aArgs)) {
			let self = this;
			this.Deferred.next(function() {
				self.stopToOpenChildTab(aArgs[0]);
			}).error(this.defaultDeferredErrorHandler);
			return true;
		}
		return false;
	},
 
	readyToOpenNextSiblingTab : function TSTBase_readyToOpenNextSiblingTab(aFrameOrTabBrowser) /* PUBLIC API */ 
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
			if (!nextTab)
				return;
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
	readyToOpenNextSiblingTabNow : function TSTBase_readyToOpenNextSiblingTabNow(...aArgs) /* PUBLIC API */
	{
		if (this.readyToOpenNextSiblingTab.apply(this, aArgs)) {
			let self = this;
			this.Deferred.next(function() {
				self.stopToOpenChildTab(aArgs[0]);
			}).error(this.defaultDeferredErrorHandler);
			return true;
		}
		return false;
	},
 
	readyToOpenNewTabGroup : function TSTBase_readyToOpenNewTabGroup(aFrameOrTabBrowser, aTreeStructure, aExpandAllTree) /* PUBLIC API */ 
	{
		if (!utils.getTreePref('autoAttach'))
			return false;

		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame)
			return false;

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
	readyToOpenNewTabGroupNow : function TSTBase_readyToOpenNewTabGroupNow(...aArgs) /* PUBLIC API */
	{

		if (this.readyToOpenNewTabGroup.apply(this, aArgs)) {
			let self = this;
			this.Deferred.next(function() {
				self.stopToOpenChildTab(aArgs[0]);
			}).error(this.defaultDeferredErrorHandler);
			return true;
		}
		return false;
	},
 
	stopToOpenChildTab : function TSTBase_stopToOpenChildTab(aFrameOrTabBrowser) /* PUBLIC API */ 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame)
			return false;

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
 
	checkToOpenChildTab : function TSTBase_checkToOpenChildTab(aFrameOrTabBrowser) /* PUBLIC API */ 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame)
			return false;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		return !!(ownerBrowser.treeStyleTab.readiedToAttachNewTab || ownerBrowser.treeStyleTab.readiedToAttachNewTabGroup);
	},
 
	kNEWTAB_DO_NOTHING           : -1,
	kNEWTAB_OPEN_AS_ORPHAN       : 0,
	kNEWTAB_OPEN_AS_CHILD        : 1,
	kNEWTAB_OPEN_AS_SIBLING      : 2,
	kNEWTAB_OPEN_AS_NEXT_SIBLING : 3,
	readyToOpenRelatedTabAs : function TSTBase_readyToOpenRelatedTabAs(aBaseTab, aBehavior) 
	{
		var frame = this.getFrameFromTabBrowserElements(aBaseTab);
		if (!frame)
			return;

		aBaseTab = this.getTabFromFrame(frame, this.getTabBrowserFromFrame(frame));

		switch (aBehavior)
		{
			case this.kNEWTAB_OPEN_AS_ORPHAN:
			case this.kNEWTAB_DO_NOTHING:
			default:
				break;
			case this.kNEWTAB_OPEN_AS_CHILD:
				this.readyToOpenChildTabNow(aBaseTab);
				break;
			case this.kNEWTAB_OPEN_AS_SIBLING:
				let (parentTab = this.getParentTab(aBaseTab)) {
					if (parentTab)
						this.readyToOpenChildTabNow(parentTab);
				}
				break;
			case this.kNEWTAB_OPEN_AS_NEXT_SIBLING:
				this.readyToOpenNextSiblingTabNow(aBaseTab);
				break;
		}
	},
 
	handleNewTabFromCurrent : function TSTBase_handleNewTabFromCurrent(aBaseTab) 
	{
		this.readyToOpenRelatedTabAs(aBaseTab, utils.getTreePref('autoAttach.fromCurrent'));
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
 
	canCollapseSubtree : function TSTBase_canCollapseSubtree(aTabOrTabBrowser) /* PUBLIC API */ 
	{
		if (aTabOrTabBrowser &&
			aTabOrTabBrowser.localName == 'tab' &&
			aTabOrTabBrowser.getAttribute(this.kALLOW_COLLAPSE) != 'true')
			return false;

		var b = this.getTabBrowserFromChild(aTabOrTabBrowser) || this.browser;
		return b && b.getAttribute(this.kALLOW_COLLAPSE) == 'true';
	},
 
	isCollapsed : function TSTBase_isCollapsed(aTab) /* PUBLIC API */ 
	{
		if (!aTab ||
			!this.canCollapseSubtree(this.getRootTab(aTab)))
			return false;

		return aTab.getAttribute(this.kCOLLAPSED) == 'true';
	},
 
	isSubtreeCollapsed : function TSTBase_isSubtreeCollapsed(aTab) /* PUBLIC API */ 
	{
		if (!aTab || !this.canCollapseSubtree(aTab) || !this.hasChildTabs(aTab))
			return false;

		return aTab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true';
	},
 
	shouldCloseTabSubtreeOf : function TSTBase_shouldCloseTabSubtreeOf(aTab) 
	{
		return (
			this.hasChildTabs(aTab) &&
			(
				utils.getTreePref('closeParentBehavior') == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
				this.isSubtreeCollapsed(aTab)
			)
		);
	},
	shouldCloseTabSubTreeOf : function TSTBase_shouldCloseTabSubTreeOf(...aArgs) {
		return this.shouldCloseTabSubtreeOf.apply(this, aArgs);
	}, // obsolete, for backward compatibility
 
	shouldCloseLastTabSubtreeOf : function TSTBase_shouldCloseLastTabSubtreeOf(aTab) 
	{
		var b = this.getTabBrowserFromChild(aTab);
		return (
			b &&
			this.shouldCloseTabSubtreeOf(aTab) &&
			this.getDescendantTabs(aTab).length + 1 == this.getAllTabs(b).length
		);
	},
	shouldCloseLastTabSubTreeOf : function TSTBase_shouldCloseLastTabSubTreeOf(...aArgs) {
		return this.shouldCloseLastTabSubtreeOf.apply(this, aArgs);
	}, // obsolete, for backward compatibility
 
	getParentTab : function TSTBase_getParentTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab)
			return null;

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
 
	getAncestorTabs : function TSTBase_getAncestorTabs(aTab) /* PUBLIC API */ 
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
 
	getRootTab : function TSTBase_getRootTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab)
			return null;

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
 
	getNextSiblingTab : function TSTBase_getNextSiblingTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab)
			return null;

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
					if (firstChild)
						return firstChild;
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
 
	getPreviousSiblingTab : function TSTBase_getPreviousSiblingTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab)
			return null;

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
					if (lastChild)
						return lastChild;
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
 
	getSiblingTabs : function TSTBase_getSiblingTabs(aTab) /* PUBLIC API */ 
	{
		var parent = this.getParentTab(aTab);

		var siblings = parent && parent.parentNode ? this.getChildTabs(parent) : this.visibleRootTabs ;
		return siblings.filter(function(aSiblingTab) {
			return aSiblingTab != aTab;
		});
	},
 
	getChildTabs : function TSTBase_getChildTabs(aTab, aAllTabsArray) /* PUBLIC API */ 
	{
		var tabs = [];
		if (!aTab)
			return tabs;

		var children = aTab.getAttribute(this.kCHILDREN);
		if (!children)
			return tabs;

		if (aAllTabsArray)
			tabs = aAllTabsArray;

		var list = children.split('|');
		for (let i = 0, maxi = list.length; i < maxi; i++)
		{
			let tab = this.getTabById(list[i], aTab);
			if (!tab || tab == aTab)
				continue;
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
 
	hasChildTabs : function TSTBase_hasChildTabs(aTab) /* PUBLIC API */ 
	{
		if (!aTab)
			return false;
		return aTab.hasAttribute(this.kCHILDREN);
	},
 
	getDescendantTabs : function TSTBase_getDescendantTabs(aTab) /* PUBLIC API */ 
	{
		var tabs = [];
		this.getChildTabs(aTab, tabs);
		return tabs;
	},
 
	getFirstChildTab : function TSTBase_getFirstChildTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab)
			return null;

		if (this.tabsHash) { // XPath-less implementation
			let children   = aTab.getAttribute(this.kCHILDREN);
			let firstChild = null;
			if (children) {
				let list = children.split('|');
				for (let i = 0, maxi = list.length; i < maxi; i++)
				{
					firstChild = this.getTabById(list[i], aTab);
					if (firstChild && firstChild != aTab)
						break;
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
 
	getLastChildTab : function TSTBase_getLastChildTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab)
			return null;

		if (this.tabsHash) { // XPath-less implementation
			let children  = aTab.getAttribute(this.kCHILDREN);
			let lastChild = null;
			if (children) {
				let list = children.split('|');
				for (let i = list.length-1; i > -1; i--)
				{
					lastChild = this.getTabById(list[i], aTab);
					if (lastChild && lastChild != aTab)
						break;
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
 
	getLastDescendantTab : function TSTBase_getLastDescendantTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab)
			return null;

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
 
	collectRootTabs : function TSTBase_collectRootTabs(aTabs) /* PUBLIC API */ 
	{
		aTabs = Array.slice(aTabs);
		return aTabs.filter(function(aTab) {
			var parent = this.getParentTab(aTab);
			return !parent || aTabs.indexOf(parent) < 0;
		}, this);
	},
 
	getChildIndex : function TSTBase_getChildIndex(aTab, aParent) /* PUBLIC API */ 
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
				if (list[i] == id)
					return i;
			}
			return -1;
		}
		else {
			let tabs = this.rootTabs;
			for (let i = 0, maxi = tabs.length; i < maxi; i++)
			{
				if (tabs[i] == aTab)
					return i;
			}
		}
		return -1;
	},
 
	getXOffsetOfTab : function TSTBase_getXOffsetOfTab(aTab) 
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
	getYOffsetOfTab : function TSTBase_getYOffsetOfTab(aTab)
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
	getFutureBoxObject : function TSTBase_getFutureBoxObject(aTab)
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
	getTabActualScreenPosition : function TSTBase_getTabActualScreenPosition(aTab, aOrient)
	{
		aOrient = aOrient || aTab.parentNode.orient;
		return aOrient == 'vertical' ?
				this.getTabActualScreenY(aTab) :
				this.getTabActualScreenX(aTab) ;
	},
	MATRIX_PATTERN : /matrix\((-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\)/,
	getTabActualScreenX : function TSTBase_getTabActualScreenX(aTab)
	{
		var x = aTab.boxObject.screenX;

		var w = aTab.ownerDocument.defaultView;
		var transform = w.getComputedStyle(aTab, null).transform;
		var offset = transform && transform.match(this.MATRIX_PATTERN);
		offset = offset ? parseFloat(offset[5]) : 0 ;

		return x + offset;
	},
	getTabActualScreenY : function TSTBase_getTabActualScreenY(aTab)
	{
		var y = aTab.boxObject.screenY;

		var w = aTab.ownerDocument.defaultView;
		var transform = w.getComputedStyle(aTab, null).transform;
		var offset = transform && transform.match(this.MATRIX_PATTERN);
		offset = offset ? parseFloat(offset[6]) : 0 ;

		return y + offset;
	},
 
	isGroupTab : function TSTBase_isGroupTab(aTab, aLazyCheck) 
	{
		return (
			(aLazyCheck || aTab.linkedBrowser.sessionHistory.count == 1) &&
			aTab.linkedBrowser.currentURI.spec.indexOf('about:treestyletab-group') == 0
		);
	},
 
	isTemporaryGroupTab : function TSTBase_isTemporaryGroupTab(aTab) 
	{
		return (
			this.isGroupTab(aTab, true) &&
			/.*[\?&;]temporary=(?:1|yes|true)/i.test(aTab.linkedBrowser.currentURI.spec)
		);
	},
 
	get pinnedTabsCount() 
	{
		return this.browser.mTabContainer.querySelectorAll('tab[pinned="true"]').length;
	},
 
	forceExpandTabs : function TSTBase_forceExpandTabs(aTabs) 
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
 
	getTreeStructureFromTabs : function TSTBase_getTreeStructureFromTabs(aTabs) 
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
	cleanUpTreeStructureArray : function TSTBase_cleanUpTreeStructureArray(aTreeStructure, aDefaultParent)
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
 
	applyTreeStructureToTabs : function TSTBase_applyTreeStructureToTabs(aTabs, aTreeStructure, aExpandStates) 
	{
		var b = this.getTabBrowserFromChild(aTabs[0]);
		if (!b)
			return;
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
			if (sv.isCollapsed(tab))
				sv.collapseExpandTab(tab, false, true);
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
 
	getTreeStructureFromTabBrowser : function TSTBase_getTreeStructureFromTabBrowser(aTabBrowser) 
	{
		return this.getTreeStructureFromTabs(this.getAllTabs(aTabBrowser));
	},
 
	applyTreeStructureToTabBrowser : function TSTBase_applyTreeStructureToTabBrowser(aTabBrowser, aTreeStructure, aExpandAllTree) 
	{
		var tabs = this.getAllTabs(aTabBrowser);
		return this.applyTreeStructureToTabs(tabs, aTreeStructure, aExpandAllTree);
	},
  
/* tabbar position */ 
	
	get position() /* PUBLIC API */ 
	{
		return utils.getTreePref('tabbar.position') || 'top';
	},
	set position(aValue)
	{
		var position = String(aValue).toLowerCase();
		if (!position || !/^(top|bottom|left|right)$/.test(position))
			position = 'top';

		if (position != utils.getTreePref('tabbar.position'))
			utils.setTreePref('tabbar.position', position);

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
 
	getPositionFlag : function TSTBase_getPositionFlag(aPosition) 
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
		'browser.tabs.animate',
		'browser.tabs.insertRelatedAfterCurrent',
		'extensions.stm.tabBarMultiRows' // Super Tab Mode
	],
 
	observe : function TSTBase_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onPrefChange(aData);
				return;
		}
	},
 
	onPrefChange : function TSTBase_onPrefChange(aPrefName) 
	{
		var value = prefs.getPref(aPrefName);
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
			case 'extensions.stm.tabBarMultiRows': // Super Tab Mode
				if (this.prefOverriding)
					return;
				aPrefName += '.override';
				prefs.setPref(aPrefName, value);
			case 'browser.tabs.insertRelatedAfterCurrent.override':
			case 'extensions.stm.tabBarMultiRows.override': // Super Tab Mode
				if (prefs.getPref(aPrefName+'.force')) {
					let defaultValue = prefs.getDefaultPref(aPrefName);
					if (value != defaultValue) {
						prefs.setPref(aPrefName, defaultValue);
						return;
					}
				}
				this.prefOverriding = true;
				let (target = aPrefName.replace('.override', '')) {
					let originalValue = prefs.getPref(target);
					if (originalValue !== null && originalValue != value)
						prefs.setPref(target+'.backup', originalValue);
					prefs.setPref(target, prefs.getPref(aPrefName));
				}
				this.prefOverriding = false;
				return;

			case 'extensions.treestyletab.clickOnIndentSpaces.enabled':
				return this.shouldDetectClickOnIndentSpaces = prefs.getPref(aPrefName);

			case 'extensions.treestyletab.tabbar.scroll.smooth':
				return this.smoothScrollEnabled = value;
			case 'extensions.treestyletab.tabbar.scroll.duration':
				return this.smoothScrollDuration = value;

			case 'extensions.treestyletab.tabbar.scrollToNewTab.mode':
				return this.scrollToNewTabMode = value;

			case 'extensions.treestyletab.tabbar.narrowScrollbar.size':
				return this.updateNarrowScrollbarStyle();

			case 'browser.tabs.animate':
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
	
	updateTabWidthPrefs : function TSTBase_updateTabWidthPrefs(aPrefName) 
	{
		var expanded = utils.getTreePref('tabbar.width');
		var shrunken = utils.getTreePref('tabbar.shrunkenWidth');
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
			utils.setTreePref('tabbar.width', Math.max(0, expanded));
			utils.setTreePref('tabbar.shrunkenWidth', Math.max(0, shrunken));
		}
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
	setPrefForActiveWindow : function TSTBase_setPrefForActiveWindow(aTask) {
		TreeStyleTabBase.applyOnlyForActiveWindow = true;
		try {
			aTask.call(this);
		}
		finally {
			TreeStyleTabBase.applyOnlyForActiveWindow = false;
		}
	}
   
}; 
  
TreeStyleTabBase.init(); 
 
