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
 * Portions created by the Initial Developer are Copyright (C) 2012-2013
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
 
const EXPORTED_SYMBOLS = ['TreeStyleTabWindow']; 

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

XPCOMUtils.defineLazyGetter(this, 'window', function() {
	Cu.import('resource://treestyletab-modules/lib/namespace.jsm');
	return getNamespaceFor('piro.sakura.ne.jp');
});
XPCOMUtils.defineLazyGetter(this, 'prefs', function() {
	Cu.import('resource://treestyletab-modules/lib/prefs.js');
	return window['piro.sakura.ne.jp'].prefs;
});

XPCOMUtils.defineLazyModuleGetter(this, 'UninstallationListener',
  'resource://treestyletab-modules/lib/UninstallationListener.js');

XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');

Cu.import('resource://treestyletab-modules/base.js');
XPCOMUtils.defineLazyModuleGetter(this, 'TreeStyleTabBrowser', 'resource://treestyletab-modules/browser.js');
XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');
XPCOMUtils.defineLazyModuleGetter(this, 'AutoHideWindow', 'resource://treestyletab-modules/autoHide.js');
XPCOMUtils.defineLazyModuleGetter(this, 'TreeStyleTabThemeManager', 'resource://treestyletab-modules/themeManager.js');
XPCOMUtils.defineLazyModuleGetter(this, 'FullscreenObserver', 'resource://treestyletab-modules/fullscreenObserver.js');
XPCOMUtils.defineLazyModuleGetter(this, 'BrowserUIShowHideObserver', 'resource://treestyletab-modules/browserUIShowHideObserver.js');

function TreeStyleTabWindow(aWindow) 
{
	this.window = aWindow;
	this.document = aWindow.document;

	this._restoringTabs = [];
	this._shownPopups = [];
	this.restoringCount = 0;

	aWindow.addEventListener('DOMContentLoaded', this, true);
	aWindow.addEventListener('load', this, false);
	aWindow.TreeStyleTabService = this;

	XPCOMUtils.defineLazyModuleGetter(aWindow, 'TreeStyleTabBrowser', 'resource://treestyletab-modules/browser.js');
}

TreeStyleTabWindow.prototype = {
	
	base : TreeStyleTabBase, 
	__proto__ : TreeStyleTabBase,
 
	window : null, 
	document : null,
 
/* API */ 
	
	changeTabbarPosition : function TSTWindow_changeTabbarPosition(aNewPosition) /* PUBLIC API (obsolete, for backward compatibility) */ 
	{
		this.position = aNewPosition;
	},
 
	get position() /* PUBLIC API */ 
	{
		return this.preInitialized && this.browser.treeStyleTab ?
					this.browser.treeStyleTab.position :
					this.base.position ;
	},
	set position(aValue)
	{
		if ('UndoTabService' in this.window && this.window.UndoTabService.isUndoable()) {
			var current = this.base.position;
			var self = this;
			this.window.UndoTabService.doOperation(
				function() {
					self.base.position = aValue;
				},
				{
					label  : utils.treeBundle.getString('undo_changeTabbarPosition_label'),
					name   : 'treestyletab-changeTabbarPosition',
					data   : {
						oldPosition : current,
						newPosition : aValue
					}
				}
			);
		}
		else {
			this.base.position = aValue;
		}
		return aValue;
	},
 
	undoChangeTabbarPosition : function TSTWindow_undoChangeTabbarPosition() /* PUBLIC API */ 
	{
		return this.base.undoChangeTabbarPosition();
	},
 
	redoChangeTabbarPosition : function TSTWindow_redoChangeTabbarPosition() /* PUBLIC API */ 
	{
		return this.base.redoChangeTabbarPosition();
	},
 
	get treeViewEnabled() /* PUBLIC API */ 
	{
		return this.base.treeViewEnabled;
	},
	set treeViewEnabled(aValue)
	{
		return this.base.treeViewEnabled = aValue;
	},
 
	get useTMPSessionAPI() /* PUBLIC API */ 
	{
		return this.base.useTMPSessionAPI;
	},
	set useTMPSessionAPI(aValue)
	{
		return this.base.useTMPSessionAPI = aValue;
	},
 
	get browser() 
	{
		var w = this.window;
		this.assertBeforeDestruction(w);
		return 'SplitBrowser' in w ? w.SplitBrowser.activeBrowser :
			w.gBrowser ;
	},
 
	get browserToolbox()
	{
		var w = this.window;
		return w.gToolbox || w.gNavToolbox;
	},
 
	get browserBox()
	{
		return this.document.getElementById('browser');
	},
 
	get browserBottomBox()
	{
		return this.document.getElementById('browser-bottombox');
	},
 
	get isPopupWindow() 
	{
		return (
			this.document &&
			this.document.documentElement.getAttribute('chromehidden') != '' &&
			!this.window.gBrowser.treeStyleTab.ownerToolbar.boxObject.width &&
			!this.window.gBrowser.treeStyleTab.ownerToolbar.boxObject.height
		);
	},
  
/* backward compatibility */ 
	getTempTreeStyleTab : function TSTWindow_getTempTreeStyleTab(aTabBrowser)
	{
		return aTabBrowser.treeStyleTab || new TreeStyleTabBrowser(this, aTabBrowser);
	},
	
	initTabAttributes : function TSTWindow_initTabAttributes(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabAttributes(aTab);
	},
 
	initTabContents : function TSTWindow_initTabContents(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabContents(aTab);
	},
 
	initTabContentsOrder : function TSTWindow_initTabContentsOrder(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabContentsOrder(aTab);
	},
  
/* Utilities */ 
	
	stopRendering : function TSTWindow_stopRendering() 
	{
		this.window['piro.sakura.ne.jp'].stopRendering.stop();
	},
	startRendering : function TSTWindow_startRendering()
	{
		this.window['piro.sakura.ne.jp'].stopRendering.start();
	},
 
	getPropertyPixelValue : function TSTWindow_getPropertyPixelValue(aElementOrStyle, aProp) 
	{
		var style = aElementOrStyle instanceof Ci.nsIDOMCSSStyleDeclaration ?
					aElementOrStyle :
					this.window.getComputedStyle(aElementOrStyle, null) ;
		return Number(style.getPropertyValue(aProp).replace(/px$/, ''));
	},
 
	get isToolbarCustomizing() 
	{
		var toolbox = this.browserToolbox;
		return toolbox && toolbox.customizing;
	},
 
	get maximized() 
	{
		var sizemode = this.document.documentElement.getAttribute('sizemode');
		return (
			this.window.fullScreen ||
			this.window.windowState == this.window.STATE_MAXIMIZED ||
			sizemode == 'maximized' ||
			sizemode == 'fullscreen'
		);
	},
 
	maxTabbarWidth : function TSTWindow_maxTabbarWidth(aWidth, aTabBrowser) 
	{
		aTabBrowser = aTabBrowser || this.browser;
		var safePadding = 20; // for window border, etc.
		var windowWidth = this.maximized ? this.window.screen.availWidth - safePadding : this.window.outerWidth ;
		var rootWidth = parseInt(this.document.documentElement.getAttribute('width') || 0);
		var max = Math.max(windowWidth, rootWidth);
		return Math.max(0, Math.min(aWidth, max * this.MAX_TABBAR_SIZE_RATIO));
	},
 
	maxTabbarHeight : function TSTWindow_maxTabbarHeight(aHeight, aTabBrowser) 
	{
		aTabBrowser = aTabBrowser || this.browser;
		var safePadding = 20; // for window border, etc.
		var windowHeight = this.maximized ? this.window.screen.availHeight - safePadding : this.window.outerHeight ;
		var rootHeight = parseInt(this.document.documentElement.getAttribute('height') || 0);
		var max = Math.max(windowHeight, rootHeight);
		return Math.max(0, Math.min(aHeight, max * this.MAX_TABBAR_SIZE_RATIO));
	},
 
	shouldOpenSearchResultAsChild : function TSTWindow_shouldOpenSearchResultAsChild(aTerm) 
	{
		aTerm = aTerm.replace(/^\s+|\s+$/g, '');

		var mode = utils.getTreePref('autoAttach.searchResult');
		if (mode == this.kSEARCH_RESULT_ATTACH_ALWAYS) {
			return true;
		}
		else if (!aTerm || mode == this.kSEARCH_RESULT_DO_NOT_ATTACH) {
			return false;
		}

		var w = this.document.commandDispatcher.focusedWindow;
		if (!w || w.top != this.browser.contentWindow)
			w = this.browser.contentWindow;

		return (function checkWindow(aWindow) {
			if (!aWindow || !(aWindow instanceof Ci.nsIDOMWindow))
				return false;
			var selection = aWindow.getSelection();
			if (selection && selection.toString().replace(/^\s+|\s+$/g, '') == aTerm)
				return true;
			return aWindow.frames ? Array.slice(aWindow.frames).some(checkWindow) : false ;
		})(w);
	},
	kSEARCH_RESULT_DO_NOT_ATTACH      : 0,
	kSEARCH_RESULT_ATTACH_IF_SELECTED : 1,
	kSEARCH_RESULT_ATTACH_ALWAYS      : 2,
 
	get isAutoHide() 
	{
		return this.window.fullScreen ?
				(
					prefs.getPref('browser.fullscreen.autohide') &&
					utils.getTreePref('tabbar.autoHide.mode.fullscreen')
				) :
				utils.getTreePref('tabbar.autoHide.mode');
	},
 
	get autoHideWindow() 
	{
		if (!this._autoHideWindow) {
			this._autoHideWindow = new AutoHideWindow(this.window);
		}
		return this._autoHideWindow;
	},
 
	get themeManager() 
	{
		if (!this._themeManager) {
			this._themeManager = new TreeStyleTabThemeManager(this.window);
		}
		return this._themeManager;
	},
  
/* Initializing */ 
	
	preInit : function TSTWindow_preInit() 
	{
		if (this.preInitialized)
			return;
		this.preInitialized = true;

		var w = this.window;
		w.removeEventListener('DOMContentLoaded', this, true);
		if (w.location.href.indexOf('chrome://browser/content/browser.xul') != 0)
			return;

		w.addEventListener('SSTabRestoring', this, true);

		w.TreeStyleTabWindowHelper.preInit();

		// initialize theme
		this.onPrefChange('extensions.treestyletab.tabbar.style');
	},
	preInitialized : false,
 
	init : function TSTWindow_init() 
	{
		var w = this.window;
		w.removeEventListener('load', this, false);

		w.addEventListener('unload', this, false);

		if (
			w.location.href.indexOf('chrome://browser/content/browser.xul') != 0 ||
			!this.browser
			)
			return;

		if (this.initialized)
			return;

		if (!this.preInitialized) {
			this.preInit();
		}
		w.removeEventListener('SSTabRestoring', this, true);

		var d = this.document;
		d.addEventListener('popupshowing', this, false);
		d.addEventListener('popuphiding', this, true);
		d.addEventListener(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, this, false);
		d.addEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED,     this, false);
		d.addEventListener(this.kEVENT_TYPE_TABBAR_STATE_CHANGED,        this, false);
		d.addEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB,              this, false);
		w.addEventListener('beforecustomization', this, true);
		w.addEventListener('aftercustomization', this, false);

		this.fullscreenObserver = new FullscreenObserver(this.window);
		this.initUIShowHideObserver();

		var appcontent = d.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);

		w.addEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
		w.addEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);

		prefs.addPrefListener(this);

		this.initUninstallationListener();

		w.TreeStyleTabWindowHelper.onBeforeBrowserInit();
		this.initTabBrowser(this.browser);
		w.TreeStyleTabWindowHelper.onAfterBrowserInit();

		this.processRestoredTabs();
		this.updateTabsOnTop();

		// Init autohide service only if it have to be activated.
		if (this.isAutoHide)
			this.onPrefChange('extensions.treestyletab.tabbar.autoHide.mode');

		this.onPrefChange('extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut');

		this.initialized = true;
	},
	initialized : false,
	
	initUninstallationListener : function TSTWindow_initUninstallationListener() 
	{
		var restorePrefs = function() {
				if (prefs.getPref('extensions.treestyletab.tabsOnTop.originalState')) {
					prefs.clearPref('extensions.treestyletab.tabsOnTop.originalState');
					try {
						this.browser.treeStyleTab.position = 'top';
					}
					catch(e) {
					}
					this.window.TabsOnTop.enabled = true;
				}
			}.bind(this);
		new UninstallationListener({
			id : 'treestyletab@piro.sakura.ne.jp',
			onuninstalled : restorePrefs,
			ondisabled : restorePrefs
		});
	},
 
	initTabBrowser : function TSTWindow_initTabBrowser(aTabBrowser) 
	{
		if (aTabBrowser.localName != 'tabbrowser')
			return;
		(new TreeStyleTabBrowser(this, aTabBrowser)).init();
	},
 
	updateAllTabsButton : function TSTWindow_updateAllTabsButton(aTabBrowser) 
	{
		var d = this.document;
		aTabBrowser = aTabBrowser || this.browser;
		var allTabsButton = d.getElementById('alltabs-button') ||
				( // Tab Mix Plus
					utils.getTreePref('compatibility.TMP') &&
					d.getAnonymousElementByAttribute(aTabBrowser.mTabContainer, 'anonid', 'alltabs-button')
				);

		if (allTabsButton && allTabsButton.hasChildNodes() && aTabBrowser.treeStyleTab)
			allTabsButton.firstChild.setAttribute('position', aTabBrowser.treeStyleTab.isVertical ? 'before_start' : 'after_end' );
	},
 
	updateAllTabsPopup : function TSTWindow_updateAllTabsPopup(aEvent) 
	{
		if (!utils.getTreePref('enableSubtreeIndent.allTabsPopup'))
			return;

		Array.forEach(aEvent.originalTarget.childNodes, function(aItem) {
			if (aItem.classList.contains('alltabs-item') && 'tab' in aItem)
				aItem.style.marginLeft = aItem.tab.getAttribute(this.kNEST) + 'em';
		}, this);
	},
 
	initUIShowHideObserver : function TSTWindow_initUIShowHideObserver() 
	{
		this.rootElementObserver = new BrowserUIShowHideObserver(this, this.document.documentElement);

		var toolbox = this.browserToolbox;
		if (toolbox)
			this.browserToolboxObserver = new BrowserUIShowHideObserver(this, toolbox);

		var browserBox = this.browserBox;
		if (browserBox)
			this.browserBoxObserver = new BrowserUIShowHideObserver(this, browserBox);

		var bottomBox = this.browserBottomBox;
		if (bottomBox)
			this.browserBottomBoxObserver = new BrowserUIShowHideObserver(this, bottomBox);
	},
  
	destroy : function TSTWindow_destroy() 
	{
		var w = this.window;
		if (this.browser) {
			this.base.inWindowDestoructionProcess = true;
			try {
				w.removeEventListener('unload', this, false);

				this.autoHideWindow.destroy();
				delete this._autoHideWindow;

				this.themeManager.destroy();
				delete this._themeManager;

				this.browser.treeStyleTab.saveCurrentState();
				this.destroyTabBrowser(this.browser);

				this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOHIDE);
				this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);

				let d = this.document;
				d.removeEventListener('popupshowing', this, false);
				d.removeEventListener('popuphiding', this, true);
				d.removeEventListener(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, this, false);
				d.removeEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED,     this, false);
				d.removeEventListener(this.kEVENT_TYPE_TABBAR_STATE_CHANGED,        this, false);
				d.removeEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB,              this, false);
				w.removeEventListener('beforecustomization', this, true);
				w.removeEventListener('aftercustomization', this, false);

				this.fullscreenObserver.destroy();
				delete this.fullscreenObserver;

				this.rootElementObserver.destroy();
				delete this.rootElementObserver;

				if (this.browserToolboxObserver) {
					this.browserToolboxObserver.destroy();
					delete this.browserToolboxObserver;
				}
				if (this.browserBoxObserver) {
					this.browserBoxObserver.destroy();
					delete this.browserBoxObserver;
				}
				if (this.browserBottomBoxObserver) {
					this.browserBottomBoxObserver.destroy();
					delete this.browserBottomBoxObserver;
				}

				for (let i = 0, maxi = this._tabFocusAllowance.length; i < maxi; i++)
				{
					w.removeEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB, this._tabFocusAllowance[i], false);
				}

				var appcontent = d.getElementById('appcontent');
				appcontent.removeEventListener('SubBrowserAdded', this, false);
				appcontent.removeEventListener('SubBrowserRemoveRequest', this, false);

				w.removeEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
				w.removeEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);

				prefs.removePrefListener(this);
			}
			catch(e) {
				throw e;
			}
			finally {
				this.base.inWindowDestoructionProcess = false;
			}
		}

		delete w.TreeStyleTabService;
		delete this.window;
		delete this.document;
	},
	
	destroyTabBrowser : function TSTWindow_destroyTabBrowser(aTabBrowser) 
	{
		if (aTabBrowser.localName != 'tabbrowser')
			return;
		aTabBrowser.treeStyleTab.destroy();
		delete aTabBrowser.treeStyleTab;
	},
   
/* Event Handling */ 
	
	handleEvent : function TSTWindow_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'DOMContentLoaded':
				return this.preInit();

			case 'load':
				return this.init();

			case 'unload':
				return this.destroy();

			case 'SSTabRestoring':
				return this.onTabRestored(aEvent);

			case 'popupshowing':
				this.onPopupShown(aEvent.originalTarget);
				if ((aEvent.originalTarget.getAttribute('anonid') || aEvent.originalTarget.id) == 'alltabs-popup')
					this.updateAllTabsPopup(aEvent);
				return;

			case 'popuphiding':
				return this.onPopupHidden(aEvent.originalTarget);

			case this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED:
				return this.updateAeroPeekPreviews();

			case this.kEVENT_TYPE_TABBAR_POSITION_CHANGED:
			case this.kEVENT_TYPE_TABBAR_STATE_CHANGED:
				return this.updateTabsOnTop();

			case this.kEVENT_TYPE_FOCUS_NEXT_TAB:
				return this.onFocusNextTab(aEvent);

			case 'keydown':
				return this.onKeyDown(aEvent);

			case 'keyup':
			case 'keypress':
				return this.onKeyRelease(aEvent);

			case 'mousedown':
				return this.onTabbarResizeStart(aEvent);

			case 'mouseup':
				return this.onTabbarResizeEnd(aEvent);

			case 'mousemove':
				return this.onTabbarResizing(aEvent);

			case 'dblclick':
				return this.onTabbarReset(aEvent);

			case 'click':
				return this.handleNewTabActionOnButton(aEvent);


			case 'beforecustomization':
				this.window.TreeStyleTabWindowHelper.destroyToolbarItems();
				return;

			case 'aftercustomization':
				this.window.TreeStyleTabWindowHelper.initToolbarItems();
				return;


			case 'SubBrowserAdded':
				return this.initTabBrowser(aEvent.originalTarget.browser);

			case 'SubBrowserRemoveRequest':
				return this.destroyTabBrowser(aEvent.originalTarget.browser);

			case 'UIOperationHistoryUndo:TabbarOperations':
				switch (aEvent.entry.name)
				{
					case 'treestyletab-changeTabbarPosition':
						this.position = aEvent.entry.data.oldPosition;
						return;
					case 'treestyletab-changeTabbarPosition-private':
						aEvent.entry.data.target.treeStyleTab.position = aEvent.entry.data.oldPosition;
						return;
				}
				return;

			case 'UIOperationHistoryRedo:TabbarOperations':
				switch (aEvent.entry.name)
				{
					case 'treestyletab-changeTabbarPosition':
						this.position = aEvent.entry.data.newPosition;
						return;
					case 'treestyletab-changeTabbarPosition-private':
						aEvent.entry.data.target.treeStyleTab.position = aEvent.entry.data.newPosition;
						return;
				}
				return;
		}
	},
	
	keyEventListening      : false, 
	keyEventListeningFlags : 0,

	LISTEN_FOR_AUTOHIDE                  : 1,
	LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE : 2,
	
	startListenKeyEventsFor : function TSTWindow_startListenKeyEventsFor(aReason) 
	{
		if (this.keyEventListeningFlags & aReason)
			return;
		if (!this.keyEventListening) {
			let w = this.window;
			w.addEventListener('keydown',  this, true);
			w.addEventListener('keyup',    this, true);
			w.addEventListener('keypress', this, true);
			this.keyEventListening = true;
		}
		this.keyEventListeningFlags |= aReason;
	},
 
	endListenKeyEventsFor : function TSTWindow_endListenKeyEventsFor(aReason) 
	{
		if (!(this.keyEventListeningFlags & aReason))
			return;
		this.keyEventListeningFlags ^= aReason;
		if (!this.keyEventListeningFlags && this.keyEventListening) {
			let w = this.window;
			w.removeEventListener('keydown',  this, true);
			w.removeEventListener('keyup',    this, true);
			w.removeEventListener('keypress', this, true);
			this.keyEventListening = false;
		}
	},
 
	onKeyDown : function TSTWindow_onKeyDown(aEvent) 
	{
		/**
		 * On Mac OS X, default accel key is the Command key (metaKey), but
		 * Cmd-Tab is used to switch applications by the OS itself. So Firefox
		 * uses Ctrl-Tab to switch tabs on all platforms.
		 */
		// this.accelKeyPressed = this.isAccelKeyPressed(aEvent);
		this.accelKeyPressed = aEvent.ctrlKey || aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_CONTROL;

		var left  = aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_LEFT;
		var right = aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_RIGHT;
		var up    = aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_UP;
		var down  = aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_DOWN;
		if (
			Services.focus.focusedElement == this.browser.selectedTab &&
			(up || down || left || right)
			)
			this.arrowKeyEventOnTab = {
				keyCode  : aEvent.keyCode,
				left     : left,
				right    : right,
				up       : up,
				down     : down,
				altKey   : aEvent.altKey,
				ctrlKey  : aEvent.ctrlKey,
				metaKey  : aEvent.metaKey,
				shiftKey : aEvent.shiftKey
			};

		var b = this.browser;
		var data = {
				sourceEvent : aEvent
			};

		/* PUBLIC API */
		this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN, b, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN.replace(/^nsDOM/, ''), b, true, false, data);
	},
	accelKeyPressed : false,
	arrowKeyEventOnTab : null,
 
	onKeyRelease : function TSTWindow_onKeyRelease(aEvent) 
	{
		var b = this.browser;
		if (!b || !b.treeStyleTab)
			return;
		var sv = b.treeStyleTab;

		var scrollDown,
			scrollUp;

		// this.accelKeyPressed = this.isAccelKeyPressed(aEvent);
		this.accelKeyPressed = aEvent.ctrlKey || aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_CONTROL;
		this.window.setTimeout(function(aSelf) {
			aSelf.arrowKeyEventOnTab = null;
		}, 10, this);

		var standBy = scrollDown = scrollUp = (!aEvent.altKey && this.accelKeyPressed);

		scrollDown = scrollDown && (
				!aEvent.shiftKey &&
				(
					aEvent.keyCode == aEvent.DOM_VK_TAB ||
					aEvent.keyCode == aEvent.DOM_VK_PAGE_DOWN
				)
			);

		scrollUp = scrollUp && (
				aEvent.shiftKey ? (aEvent.keyCode == aEvent.DOM_VK_TAB) : (aEvent.keyCode == aEvent.DOM_VK_PAGE_UP)
			);

		var onlyShiftKey = (!aEvent.shiftKey && aEvent.keyCode == 16 && (aEvent.type == 'keyup' || aEvent.charCode == 0));

		var data = {
				scrollDown   : scrollDown,
				scrollUp     : scrollUp,
				standBy      : standBy,
				onlyShiftKey : onlyShiftKey,
				sourceEvent  : aEvent
			};

		if (
			scrollDown ||
			scrollUp ||
			( // when you release "shift" key
				standBy && onlyShiftKey
			)
			) {
			/* PUBLIC API */
			this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START, b, true, false, data);
			// for backward compatibility
			this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START.replace(/^nsDOM/, ''), b, true, false, data);
			return;
		}

		if (aEvent.type == 'keypress' ?
				// ignore keypress on Ctrl-R, Ctrl-T, etc.
				aEvent.charCode != 0 :
				// ignore keyup not on the Ctrl key
				aEvent.keyCode != Ci.nsIDOMKeyEvent.DOM_VK_CONTROL
			)
			return;

		// when you just release accel key...

		/* PUBLIC API */
		let (event) {
			this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, b, true, false, data);
			// for backward compatibility
			this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END.replace(/^nsDOM/, ''), b, true, false, data);
		}

		if (this._tabShouldBeExpandedAfterKeyReleased) {
			let tab = this._tabShouldBeExpandedAfterKeyReleased;
			if (this.hasChildTabs(tab) &&
				this.isSubtreeCollapsed(tab)) {
				this.getTabBrowserFromChild(tab)
						.treeStyleTab
						.collapseExpandTreesIntelligentlyFor(tab);
			}
		}
		this._tabShouldBeExpandedAfterKeyReleased = null;
	},
 
	get shouldListenKeyEventsForAutoExpandByFocusChange() 
	{
		return !this.ctrlTabPreviewsEnabled &&
				(
					utils.getTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut') ||
					utils.getTreePref('autoCollapseExpandSubtreeOnSelect')
				);
	},
 
	get ctrlTabPreviewsEnabled() 
	{
		return 'allTabs' in this.window &&
				prefs.getPref('browser.ctrlTab.previews');
	},
   
	onTabbarResizeStart : function TSTWindow_onTabbarResizeStart(aEvent) 
	{
		if (aEvent.button != 0)
			return;

		if (!this.isEventFiredOnGrippy(aEvent))
			aEvent.stopPropagation();

		if ('setCapture' in aEvent.currentTarget)
			aEvent.currentTarget.setCapture(true);

		aEvent.currentTarget.addEventListener('mousemove', this, false);

		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		var box = aEvent.currentTarget.id == 'treestyletab-tabbar-resizer-splitter' ?
					this.getTabStrip(b) :
					b.treeStyleTab.tabStripPlaceHolder || b.tabContainer ;
		this.tabbarResizeStartWidth  = box.boxObject.width;
		this.tabbarResizeStartHeight = box.boxObject.height;
		this.tabbarResizeStartX = aEvent.screenX;
		this.tabbarResizeStartY = aEvent.screenY;
	},
	onTabbarResizeEnd : function TSTWindow_onTabbarResizeEnd(aEvent)
	{
		if (this.tabbarResizeStartWidth < 0)
			return;

		var target = aEvent.currentTarget;
		var b = this.getTabBrowserFromChild(target);

		aEvent.stopPropagation();
		if ('releaseCapture' in target)
			target.releaseCapture();

		target.removeEventListener('mousemove', this, false);

		this.tabbarResizeStartWidth  = -1;
		this.tabbarResizeStartHeight = -1;
		this.tabbarResizeStartX = -1;
		this.tabbarResizeStartY = -1;

		this.Deferred.next(function() {
			b.treeStyleTab.fixTooNarrowTabbar();
		}).error(this.defaultDeferredErrorHandler);
	},
	onTabbarResizing : function TSTWindow_onTabbarResizing(aEvent)
	{
		var target = aEvent.currentTarget;
		var b = this.getTabBrowserFromChild(target);

		var expanded = target.id == 'treestyletab-tabbar-resizer-splitter';
		if (expanded)
			aEvent.stopPropagation();

		var width = this.tabbarResizeStartWidth;
		var height = this.tabbarResizeStartHeight;
		var pos = b.treeStyleTab.position;
		if (b.treeStyleTab.isVertical) {
			let delta = aEvent.screenX - this.tabbarResizeStartX;
			width += (pos == 'left' ? delta : -delta );
			width = this.maxTabbarWidth(width, b);
			if (expanded || b.treeStyleTab.autoHide.expanded) {
				this.setPrefForActiveWindow(function() {
					utils.setTreePref('tabbar.width', width);
				});
				if (b.treeStyleTab.autoHide.mode == b.treeStyleTab.autoHide.kMODE_SHRINK &&
					b.treeStyleTab.tabStripPlaceHolder)
					b.treeStyleTab.tabStripPlaceHolder.setAttribute('width', utils.getTreePref('tabbar.shrunkenWidth'));
			}
			else {
				this.setPrefForActiveWindow(function() {
					utils.setTreePref('tabbar.shrunkenWidth', width);
				});
			}
		}
		else {
			let delta = aEvent.screenY - this.tabbarResizeStartY;
			height += (pos == 'top' ? delta : -delta );
			this.setPrefForActiveWindow(function() {
				utils.setTreePref('tabbar.height', this.maxTabbarHeight(height, b));
			});
		}
		b.treeStyleTab.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_TABBAR_RESIZE);
	},
	tabbarResizeStartWidth  : -1,
	tabbarResizeStartHeight : -1,
	tabbarResizeStartX : -1,
	tabbarResizeStartY : -1,
 
	onTabbarReset : function TSTWindow_onTabbarReset(aEvent) 
	{
		if (aEvent.button != 0)
			return;
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		if (b) {
			b.treeStyleTab.resetTabbarSize();
			aEvent.stopPropagation();
		}
	},
 
	onFocusNextTab : function TSTWindow_onFocusNextTab(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b = this.getTabBrowserFromChild(tab);
		if (
			prefs.getPref('browser.tabs.selectOwnerOnClose') &&
			tab.owner &&
			(
				!b._removingTabs ||
				b._removingTabs.indexOf(tab.owner) < 0
			)
			)
			aEvent.preventDefault();
	},
 
	showHideSubtreeMenuItem : function TSTWindow_showHideSubtreeMenuItem(aMenuItem, aTabs) 
	{
		if (!aMenuItem ||
			aMenuItem.getAttribute('hidden') == 'true' ||
			!aTabs ||
			!aTabs.length)
			return;

		var hasSubtree = false;
		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			if (!this.hasChildTabs(aTabs[i]))
				continue;
			hasSubtree = true;
			break;
		}
		if (hasSubtree)
			aMenuItem.removeAttribute('hidden');
		else
			aMenuItem.setAttribute('hidden', true);
	},
	showHideSubTreeMenuItem : function(...aArgs) {
		return this.showHideSubtreeMenuItem.apply(this, aArgs);
	}, // obsolete, for backward compatibility
 
	updateAeroPeekPreviews : function TSTWindow_updateAeroPeekPreviews() 
	{
		var w = this.window;
		if (
			this.updateAeroPeekPreviewsTimer ||
			!prefs.getPref('browser.taskbar.previews.enable') ||
			!utils.getTreePref('taskbarPreviews.hideCollapsedTabs') ||
			!('Win7Features' in w) ||
			!w.Win7Features ||
			!this.AeroPeek ||
			!this.AeroPeek.windows
			)
			return;

		this.updateAeroPeekPreviewsTimer = w.setTimeout(function(aSelf) {
			aSelf.updateAeroPeekPreviewsTimer = null;
			try {
				aSelf.updateAeroPeekPreviewsInternal();
			}
			catch(e) {
				dump(e+'\n');
				aSelf.updateAeroPeekPreviews();
			}
		}, 250, this);
	},
	updateAeroPeekPreviewsTimer : null,
	updateAeroPeekPreviewsInternal : function TSTWindow_updateAeroPeekPreviewsInternal()
	{
		if (
			!prefs.getPref('browser.taskbar.previews.enable') ||
			!utils.getTreePref('taskbarPreviews.hideCollapsedTabs')
			)
			return;

		this.AeroPeek.windows.some(function(aTabWindow) {
			if (aTabWindow.win == this.window) {
				let previews = aTabWindow.previews;
				for (let i = 0, maxi = previews.length; i < maxi; i++)
				{
					let preview = previews[i];
					if (!preview)
						continue;
					let tab = preview.controller.wrappedJSObject.tab;
					preview.visible = !this.isCollapsed(tab);
				}
				this.AeroPeek.checkPreviewCount();
				return true;
			}
			return false;
		}, this);
	},
 
	updateTabsOnTop : function TSTWindow_updateTabsOnTop() 
	{
		if (
			this.isPopupWindow ||
			this.tabsOnTopChangingByUI ||
			this.tabsOnTopChangingByTST
			)
			return;

		var TabsOnTop = this.window.TabsOnTop;
		var TabsInTitlebar = this.window.TabsInTitlebar;
		var isTopTabbar = this.browser.treeStyleTab.position == 'top';

		this.tabsOnTopChangingByTST = true;

		try {
			if (TabsOnTop) {
				let originalState = utils.getTreePref('tabsOnTop.originalState');
				if (originalState === null) {
					let current = prefs.getDefaultPref('browser.tabs.onTop') === null ?
									TabsOnTop.enabled :
									prefs.getPref('browser.tabs.onTop') ;
					utils.setTreePref('tabsOnTop.originalState', originalState = current);
				}

				if (!isTopTabbar || !this.browser.treeStyleTab.fixed) {
					if (TabsOnTop.enabled)
						TabsOnTop.enabled = false;
				}
				else {
					if (TabsOnTop.enabled != originalState)
						TabsOnTop.enabled = originalState;
					utils.clearTreePref('tabsOnTop.originalState');
				}
			}
			if (TabsInTitlebar) {
				let allowed = isTopTabbar && this.browser.treeStyleTab.fixed;
				if ('navbarontop' in this.window && utils.getTreePref('compatibility.NavbarOnTitlebar'))
					allowed = true;
				TabsInTitlebar.allowedBy('TreeStyleTab-tabsOnTop', allowed);
			}
		}
		finally {
			this.tabsOnTopChangingByTST = false;
		}
	},
 
	onPopupShown : function TSTWindow_onPopupShown(aPopup) 
	{
		if (!aPopup.boxObject ||
			this.evaluateXPath(
				'parent::*/ancestor-or-self::*[local-name()="tooltip" or local-name()="panel" or local-name()="popup" or local-name()="menupopup"]',
				aPopup,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue)
			return;

		this.window.setTimeout(function(aSelf) {
			if ((!aPopup.boxObject.width && !aPopup.boxObject.height) ||
				aPopup.boxObject.popupState == 'closed')
				return;

			var id = aPopup.id;
			var item = id && aSelf.document.getElementById(id) ? id : aPopup ;
			var index = aSelf._shownPopups.indexOf(item);
			if (index < 0)
				aSelf._shownPopups.push(item);
		}, 10, this);
	},
 
	onPopupHidden : function TSTWindow_onPopupHidden(aPopup) 
	{
		var id = aPopup.id;
		aPopup = id && this.document.getElementById(id) ? id : aPopup ;
		var index = this._shownPopups.indexOf(aPopup);
		if (index > -1)
			this._shownPopups.splice(index, 1);
	},
 
	isPopupShown : function TSTWindow_isPopupShown() 
	{
		this._shownPopups = this._shownPopups.filter(function(aItem) {
			if (typeof aItem == 'string')
				aItem = this.document.getElementById(aItem);
			return (
				aItem &&
				aItem.getAttribute(this.kIGNORE_POPUP_STATE) != 'true' &&
				aItem.boxObject &&
				(aItem.boxObject.width || aItem.boxObject.height) &&
				aItem.state != 'closed'
			);
		}, this);
		return this._shownPopups.length > 0;
	},
 
	onBeforeNewTabCommand : function TSTWindow_onBeforeNewTabCommand(aTabBrowser) 
	{
		var self = this.windowService || this;
		if (self._clickEventOnNewTabButtonHandled)
			return;

		var b = aTabBrowser || this.browser;
		this.readyToOpenRelatedTabAs(b.selectedTab, utils.getTreePref('autoAttach.newTabCommand'));
	},
 
	handleNewTabActionOnButton : function TSTWindow_handleNewTabActionOnButton(aEvent) 
	{
		// ignore non new-tab commands (middle click, Ctrl-click)
		if (aEvent.button != 1 && (aEvent.button != 0 || !this.isAccelKeyPressed(aEvent)))
			return;

		var newTabButton = this.getNewTabButtonFromEvent(aEvent);
		if (newTabButton) {
			this.readyToOpenRelatedTabAs(this.browser.selectedTab, utils.getTreePref('autoAttach.newTabButton'));
			let self = this.windowService || this;
			self._clickEventOnNewTabButtonHandled = true;
			this.Deferred.next(function() {
				self._clickEventOnNewTabButtonHandled = false;
			});
		}
		else if (aEvent.target.id == 'urlbar-go-button' || aEvent.target.id == 'go-button') {
			this.readyToOpenRelatedTabAs(this.browser.selectedTab, utils.getTreePref('autoAttach.goButton'));
		}
	},
	_clickEventOnNewTabButtonHandled : false,
 
	onBeforeTabDuplicate : function TSTWindow_onBeforeTabDuplicate(aTab, aWhere, aDelta) 
	{
		if (aWhere && aWhere.indexOf('tab') != 0)
			return;

		var b = this.getTabBrowserFromChild(aTab) || this.browser;
		var behaviorPref = !aDelta ? 'autoAttach.duplicateTabCommand' :
							aDelta < 0 ? 'autoAttach.duplicateTabCommand.back' :
										'autoAttach.duplicateTabCommand.forward'
		var behavior = utils.getTreePref(behaviorPref);
		this.readyToOpenRelatedTabAs(aTab || b.selectedTab, behavior);
	},
 
	onBeforeOpenLink : function TSTWindow_onBeforeOpenLink(aWhere, aOwner) 
	{
		if (aWhere == 'tab' || aWhere == 'tabshifted')
			this.handleNewTabFromCurrent(aOwner);
	},
 
	onBeforeOpenLinkWithParams : function TSTWindow_onBeforeOpenLinkWithParams(aParams) 
	{
		if (aParams.linkNode &&
			!this.checkToOpenChildTab(aParams.linkNode.ownerDocument.defaultView))
			this.handleNewTabFromCurrent(aParams.linkNode.ownerDocument.defaultView);
	},
 
	onBeforeOpenNewTabByThirdParty : function TSTWindow_onBeforeOpenNewTabByThirdParty(aOwner) 
	{
		if (!this.checkToOpenChildTab(aOwner))
			this.handleNewTabFromCurrent(aOwner);
	},
 
	onBeforeBrowserAccessOpenURI : function TSTWindow_onBeforeBrowserAccessOpenURI(aOpener, aWhere) 
	{
		if (aOpener &&
			this.getTabFromFrame(aOpener.top) &&
			aWhere == Ci.nsIBrowserDOMWindow.OPEN_NEWTAB)
			this.handleNewTabFromCurrent(aOpener);
	},
 
	onBeforeViewMedia : function TSTWindow_onBeforeViewMedia(aEvent, aOwner) 
	{
		if (String(this.window.whereToOpenLink(aEvent, false, true)).indexOf('tab') == 0)
			this.handleNewTabFromCurrent(aOwner);
	},
 
	onBeforeBrowserSearch : function TSTWindow_onBeforeBrowserSearch(aTerm, aForceNewTab) 
	{
		if ((arguments.length == 1 || aForceNewTab) &&
			this.shouldOpenSearchResultAsChild(aTerm))
			this.handleNewTabFromCurrent();
	},
  
/* Tree Style Tabの初期化が行われる前に復元されたセッションについてツリー構造を復元 */ 
	
	onTabRestored : function TSTWindow_onTabRestored(aEvent) 
	{
		this._restoringTabs.push(aEvent.originalTarget);
	},
 
	processRestoredTabs : function TSTWindow_processRestoredTabs() 
	{
		for (let i = 0, maxi = this._restoringTabs.length; i < maxi; i++)
		{
			let tab = this._restoringTabs[i];
			try {
				let b = this.getTabBrowserFromChild(aTab);
				if (b)
					b.treeStyleTab.handleRestoredTab(aTab);
			}
			catch(e) {
			}
		}
		this._restoringTabs = [];
	},
  
/* Commands */ 
	
	setTabbarWidth : function TSTWindow_setTabbarWidth(aWidth, aForceExpanded) /* PUBLIC API */ 
	{
		this.browser.treeStyleTab.autoHide.setWidth(aWidth, aForceExpanded);
	},
 
	setContentWidth : function TSTWindow_setContentWidth(aWidth, aKeepWindowSize) /* PUBLIC API */ 
	{
		var w = this.window;
		var treeStyleTab = this.browser.treeStyleTab;
		var strip = treeStyleTab.tabStrip;
		var tabbarWidth = treeStyleTab.splitterWidth + (treeStyleTab.isVertical ? strip.boxObject.width : 0 );
		var contentWidth = this.browser.boxObject.width - tabbarWidth;
		if (aKeepWindowSize ||
			w.fullScreen ||
			w.windowState != Ci.nsIDOMChromeWindow.STATE_NORMAL) {
			this.setTabbarWidth(Math.max(10, this.browser.boxObject.width - aWidth));
		}
		else if (tabbarWidth + aWidth <= w.screen.availWidth) {
			w.resizeBy(aWidth - contentWidth, 0);
		}
		else {
			w.resizeBy(w.screen.availWidth - w.outerWidth, 0);
			this.setTabbarWidth(this.browser.boxObject.width - aWidth);
		}
	},
 
	toggleAutoHide : function TSTWindow_toggleAutoHide(aTabBrowser) /* PUBLIC API, for backward compatibility */ 
	{
		this.autoHideWindow.toggleMode(aTabBrowser || this.browser);
	},
 
	toggleFixed : function TSTWindow_toggleFixed(aTabBrowser) /* PUBLIC API */ 
	{
		var b = aTabBrowser || this.browser;
		var orient = b.treeStyleTab.isVertical ? 'vertical' : 'horizontal' ;

		var newFixed = b.getAttribute(this.kFIXED+'-'+orient) != 'true';
		this.setTabbrowserAttribute(this.kFIXED+'-'+orient, newFixed || null, b);
		this.setPrefForActiveWindow(function() {
			b.treeStyleTab.fixed = newFixed;
			utils.setTreePref('tabbar.fixed.'+orient, newFixed);
		});

		b.treeStyleTab.updateTabbarState();
	},
 
	removeTabSubtree : function TSTWindow_removeTabSubtree(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = this.gatherSubtreeMemberTabs(aTabOrTabs, aOnlyChildren);
		if (!this.warnAboutClosingTabs(tabs.length))
			return;

		if (aOnlyChildren)
			tabs = this.gatherSubtreeMemberTabs(aTabOrTabs);

		var allSubtrees = this.splitTabsToSubtrees(tabs);
		for (let i = 0, maxi = allSubtrees.length; i < maxi; i++)
		{
			let subtreeTabs = allSubtrees[i];
			if (!this.fireTabSubtreeClosingEvent(subtreeTabs[0], subtreeTabs))
				continue;
			let b = this.getTabBrowserFromChild(subtreeTabs[0]);
			if (aOnlyChildren)
				subtreeTabs = subtreeTabs.slice(1);
			if (!subtreeTabs.length)
				continue;
			this.stopRendering();
			this.markAsClosedSet(subtreeTabs);
			for (let i = subtreeTabs.length-1; i > -1; i--)
			{
				b.removeTab(subtreeTabs[i], { animate : true });
			}
			this.startRendering();
			this.fireTabSubtreeClosedEvent(b, subtreeTabs[0], subtreeTabs)
		}
	},
	removeTabSubTree : function(...aArgs) {
		return this.removeTabSubtree.apply(this, aArgs);
	}, // obsolete, for backward compatibility
	
	fireTabSubtreeClosingEvent : function TSTWindow_fireTabSubtreeClosingEvent(aParentTab, aClosedTabs) 
	{
		var b = this.getTabBrowserFromChild(aParentTab);
		var data = {
				parent : aParentTab,
				tabs   : aClosedTabs
			};
		var canClose = (
			/* PUBLIC API */
			this.fireDataContainerEvent(this.kEVENT_TYPE_SUBTREE_CLOSING, b, true, true, data) &&
			// for backward compatibility
			this.fireDataContainerEvent(this.kEVENT_TYPE_SUBTREE_CLOSING.replace(/^nsDOM/, ''), b, true, true, data)
		);
		return canClose;
	},
 
	fireTabSubtreeClosedEvent : function TSTWindow_fireTabSubtreeClosedEvent(aTabBrowser, aParentTab, aClosedTabs) 
	{
		aClosedTabs = aClosedTabs.filter(function(aTab) { return !aTab.parentNode; });
		var data = {
				parent : aParentTab,
				tabs   : aClosedTabs
			};

		/* PUBLIC API */
		this.fireDataContainerEvent(this.kEVENT_TYPE_SUBTREE_CLOSED, aTabBrowser, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_SUBTREE_CLOSED.replace(/^nsDOM/, ''), aTabBrowser, true, false, data);
	},
 
	warnAboutClosingTabSubtreeOf : function TSTWindow_warnAboutClosingTabSubtreeOf(aTab) 
	{
		if (!this.shouldCloseTabSubtreeOf(aTab))
			return true;

		var tabs = [aTab].concat(this.getDescendantTabs(aTab));
		return this.warnAboutClosingTabs(tabs.length);
	},
	warnAboutClosingTabSubTreeOf : function(...aArgs) {
		return this.warnAboutClosingTabSubtreeOf.apply(this, aArgs);
	}, // obsolete, for backward compatibility
 
	warnAboutClosingTabs : function TSTWindow_warnAboutClosingTabs(aTabsCount) 
	{
		if (
			aTabsCount <= 1 ||
			!prefs.getPref('browser.tabs.warnOnClose')
			)
			return true;
		var checked = { value:true };
		var w = this.window;
		w.focus();
		var shouldClose = Services.prompt.confirmEx(w,
				utils.tabbrowserBundle.getString('tabs.closeWarningTitle'),
				utils.tabbrowserBundle.getFormattedString('tabs.closeWarningMultipleTabs', [aTabsCount]),
				(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
				(Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1),
				utils.tabbrowserBundle.getString('tabs.closeButtonMultiple'),
				null, null,
				utils.tabbrowserBundle.getString('tabs.closeWarningPromptMe'),
				checked
			) == 0;
		if (shouldClose && !checked.value)
			prefs.setPref('browser.tabs.warnOnClose', false);
		return shouldClose;
	},
  
	reloadTabSubtree : function TSTWindow_reloadTabSubtree(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = this.gatherSubtreeMemberTabs(aTabOrTabs, aOnlyChildren);
		var b = this.getTabBrowserFromChild(tabs[0]);
		for (var i = tabs.length-1; i > -1; i--)
		{
			b.reloadTab(tabs[i]);
		}
	},
	reloadTabSubTree : function(...aArgs) {
		return this.reloadTabSubtree.apply(this, aArgs);
	}, // obsolete, for backward compatibility
 
	createSubtree : function TSTWindow_createSubtree(aTabs) 
	{
		var rootTabs = this.getRootTabs(aTabs);

		var parent = this.getParentTab(aTabs[0]);
		var next = aTabs[0];
		while (
			(next = this.getNextSiblingTab(next)) &&
			aTabs.indexOf(next) > -1
		);

		var b = this.getTabBrowserFromChild(aTabs[0]);

		rootTabs.forEach(function(aRootTab) {
			var parentTab = this.getParentTab(aRootTab);
			var descendantTabs = this.getDescendantTabs(aRootTab);
			descendantTabs.reverse().forEach(function(aDescendantTab) {
				var inTargets = aTabs.indexOf(aDescendantTab) > -1;
				var parentInTargets = aTabs.indexOf(this.getParentTab(aDescendantTab)) > -1;
				if (inTargets || (inTargets == parentInTargets))
					return;
				if (parentTab)
					b.treeStyleTab.attachTabTo(aDescendantTab, parentTab, {
						dontExpand   : true,
						dontMove     : true,
						insertBefore : this.getNextSiblingTab(aRootTab)
					});
				else
					b.treeStyleTab.detachTab(aDescendantTab);
			}, this);
		}, this);

		aTabs = rootTabs;

		var shouldCreateGroup = aTabs.length > 1 && utils.getTreePref('createSubtree.underParent');
		var root = shouldCreateGroup ?
					b.addTab(this.getGroupTabURI({
						temporary: utils.getTreePref('createSubtree.underParent.temporaryGroup')
					})) :
					aTabs.shift() ;
		var self = this;
		this.Deferred.next(function(self) {
			if (shouldCreateGroup) {
				for (let i = 0, maxi = aTabs.length; i < maxi; i++)
				{
					let tab = aTabs[i];
					b.treeStyleTab.attachTabTo(tab, root);
					b.treeStyleTab.collapseExpandTab(tab, false);
				}
			}
			if (parent) {
				b.treeStyleTab.attachTabTo(root, parent, {
					insertBefore : next
				});
			}
			else if (next) {
				b.treeStyleTab.moveTabSubtreeTo(root, next._tPos);
			}
		}).error(this.defaultDeferredErrorHandler);
	},
	createSubTree : function(...aArgs) {
		return this.createSubtree.apply(this, aArgs);
	}, // obsolete, for backward compatibility
	
	canCreateSubtree : function TSTWindow_canCreateSubtree(aTabs) 
	{
		var rootTabs = this.getRootTabs(aTabs);
		if (rootTabs.length == 1) {
			let descendants = this.getDescendantTabs(rootTabs[0]);
			// are they already grouped?
			// if it is a partial selection, I can create new group.
			return (descendants.some(function(aDescendantTab) {
				return aTabs.indexOf(aDescendantTab) < 0;
			}, this));
		}
		return true;
	},
	canCreateSubTree : function(...aArgs) {
		return this.canCreateSubtree.apply(this, aArgs);
	}, // obsolete, for backward compatibility
 
	getRootTabs : function TSTWindow_getRootTabs(aTabs) 
	{
		var roots = [];
		if (!aTabs || !aTabs.length)
			return roots;
		aTabs = this.cleanUpTabsArray(aTabs);
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			let parent = this.getParentTab(tab);
			if (parent && aTabs.indexOf(parent) > -1)
				continue;
			roots.push(tab);
		}
		return roots;
	},
  
	collapseExpandAllSubtree : function TSTWindow_collapseExpandAllSubtree(aCollapse) 
	{
		Services.obs.notifyObservers(
			this.window,
			this.kTOPIC_COLLAPSE_EXPAND_ALL,
			(aCollapse ? 'collapse' : 'open' )
		);
	},
 
	promoteTab : function TSTWindow_promoteTab(aTab) /* PUBLIC API */ 
	{
		var b = this.getTabBrowserFromChild(aTab);
		var sv = b.treeStyleTab;

		var parent = sv.getParentTab(aTab);
		if (!parent)
			return;

		var nextSibling = sv.getNextSiblingTab(parent);

		var grandParent = sv.getParentTab(parent);
		if (grandParent) {
			sv.attachTabTo(aTab, grandParent, {
				insertBefore : nextSibling
			});
		}
		else {
			sv.detachTab(aTab);
			let index = nextSibling ? nextSibling._tPos : b.mTabContainer.childNodes.length ;
			if (index > aTab._tPos)
				index--;
			b.moveTabTo(aTab, index);
		}
	},
	
	promoteCurrentTab : function TSTWindow_promoteCurrentTab() /* PUBLIC API */ 
	{
		this.promoteTab(this.browser.selectedTab);
	},
  
	demoteTab : function TSTWindow_demoteTab(aTab) /* PUBLIC API */ 
	{
		var b = this.getTabBrowserFromChild(aTab);
		var sv = b.treeStyleTab;

		var previous = this.getPreviousSiblingTab(aTab);
		if (previous)
			sv.attachTabTo(aTab, previous);
	},
	
	demoteCurrentTab : function TSTWindow_demoteCurrentTab() /* PUBLIC API */ 
	{
		this.demoteTab(this.browser.selectedTab);
	},
  
	expandTreeAfterKeyReleased : function TSTWindow_expandTreeAfterKeyReleased(aTab) 
	{
		if (utils.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut'))
			return;
		this._tabShouldBeExpandedAfterKeyReleased = aTab || null;
	},
	_tabShouldBeExpandedAfterKeyReleased : null,
 
	removeAllTabsBut : function TSTWindow_removeAllTabsBut(aTab) 
	{
		var keepTabs = [aTab].concat(this.getDescendantTabs(aTab));
		var b = this.getTabBrowserFromChild(aTab);
		var closeTabs = this.getTabs(b).filter(function(aTab) {
						return keepTabs.indexOf(aTab) < 0 && !aTab.hasAttribute('pinned');
					});

		if (!this.warnAboutClosingTabs(closeTabs.length))
			return;

		this.stopRendering();
		this.markAsClosedSet(closeTabs);
		var tabs = closeTabs.reverse();
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			b.removeTab(tabs[i]);
		}
		this.startRendering();
	},
 
	// For backward compatibility. You should use DOM event to block TST's focus handling.
	registerTabFocusAllowance : function TSTWindow_registerTabFocusAllowance(aProcess) /* PUBLIC API */ 
	{
		var listener = {
				process : aProcess,
				handleEvent : function(aEvent) {
					var tab = aEvent.originalTarget;
					var b = tab.__treestyletab__linkedTabBrowser;
					if (!this.process.call(b.treeStyleTab, b))
						aEvent.preventDefault();
				}
			};
		this.window.addEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB, listener, false);
		this._tabFocusAllowance.push(listener);
	},
	_tabFocusAllowance : [],
 
	tearOffSubtreeFromRemote : function TSTWindow_tearOffSubtreeFromRemote() 
	{
		var w = this.window;
		var remoteTab = w.arguments[0];
		var remoteWindow  = remoteTab.ownerDocument.defaultView;
		var remoteService = remoteWindow.TreeStyleTabService;
		var remoteMultipleTabService = remoteWindow.MultipleTabService;
		if (remoteService.hasChildTabs(remoteTab) ||
			(remoteMultipleTabService && remoteMultipleTabService.isSelected(remoteTab))) {
			let remoteBrowser = remoteService.getTabBrowserFromChild(remoteTab);
			if (remoteBrowser.treeStyleTab.tabbarDNDObserver.isDraggingAllTabs(remoteTab)) {
				w.close();
			}
			else {
				let actionInfo = {
						action : remoteTab.__treestyletab__toBeDuplicated ? this.kACTION_DUPLICATE : this.kACTION_IMPORT
					};

				let b = this.browser;
				let blankTab;
				this.Deferred
					.next(function() {
						var blankTab = b.selectedTab;
						b.treeStyleTab.tabbarDNDObserver.performDrop(actionInfo, remoteTab);
						return blankTab;
					})
					.next(function(aBlankTab) {
						b.removeTab(aBlankTab);
						remoteTab = null;
						remoteBrowser = null;
						remoteWindow = null
						remoteService = null;
						remoteMultipleTabService = null;
					})
					.error(this.defaultDeferredErrorHandler);
			}
			return true;
		}
		return false;
	},
	tearOffSubTreeFromRemote : function(...aArgs) {
		return this.tearOffSubtreeFromRemote.apply(this, aArgs);
	}, // obsolete, for backward compatibility
 
	onPrintPreviewEnter : function TSTWindow_onPrintPreviewEnter() 
	{
		var d = this.document;
		var event = d.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, true, false);
		d.documentElement.dispatchEvent(event);

		// for backward compatibility
		event = d.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED.replace(/^nsDOM/, ''), true, false);
		d.documentElement.dispatchEvent(event);
	},
 
	onPrintPreviewExit : function TSTWindow_onPrintPreviewExit() 
	{
		var d = this.document;
		var event = d.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED, true, false);
		d.documentElement.dispatchEvent(event);

		// for backward compatibility
		event = d.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED.replace(/^nsDOM/, ''), true, false);
		d.documentElement.dispatchEvent(event);
	},
  
	observe : function TSTWindow_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onPrefChange(aData);
				return;
		}
	},
	get restoringTree() {
		if (this._restoringTree || !!this.restoringCount)
			return true;

		var count = 0;
		this.browser.visibleTabs.some(function(aTab) {
			if (aTab.linkedBrowser.__treestyletab__toBeRestored)
				count++;
			return count > 1;
		});
		return count > 1;
	},
	set restoringTree(aValue) {
		return this._restoringTree = !!aValue;
	},
	_restoringTree : false,
 
/* Pref Listener */ 
	
	domains : [ 
		'extensions.treestyletab',
		'browser.ctrlTab.previews'
	],
 
	onPrefChange : function TSTWindow_onPrefChange(aPrefName) 
	{
		var value = prefs.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.autoHide.mode':
				// don't set on this time, because appearance of all tabbrowsers are not updated yet.
				// this.autoHide.mode = utils.getTreePref('tabbar.autoHide.mode');
			case 'extensions.treestyletab.tabbar.autoShow.accelKeyDown':
			case 'extensions.treestyletab.tabbar.autoShow.tabSwitch':
			case 'extensions.treestyletab.tabbar.autoShow.feedback':
				this.autoHideWindow.updateKeyListeners(this.window);
				break;

			case 'extensions.treestyletab.tabbar.style':
			case 'extensions.treestyletab.tabbar.position':
				this.themeManager.set(prefs.getPref('extensions.treestyletab.tabbar.style'), this.position);
				break;

			case 'browser.ctrlTab.previews':
				this.autoHideWindow.updateKeyListeners(this.window);
			case 'extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut':
			case 'extensions.treestyletab.autoCollapseExpandSubtreeOnSelect':
				if (this.shouldListenKeyEventsForAutoExpandByFocusChange)
					this.startListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);
				else
					this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);
				break;

			default:
				break;
		}
	}
  
}; 
  
