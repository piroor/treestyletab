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
 * Portions created by the Initial Developer are Copyright (C) 2012-2016
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 J. Ryan Stinnett <https://github.com/jryans>
 *                 Ohnuma <https://github.com/lv7777>
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
 
var EXPORTED_SYMBOLS = ['TreeStyleTabWindow']; 

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Timer.jsm');
Cu.import('resource://treestyletab-modules/lib/inherit.jsm');
Cu.import('resource://treestyletab-modules/ReferenceCounter.js');

XPCOMUtils.defineLazyGetter(this, 'window', function() {
	Cu.import('resource://treestyletab-modules/lib/namespace.jsm');
	return getNamespaceFor('piro.sakura.ne.jp');
});
Cu.import('resource://treestyletab-modules/lib/prefs.js');

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
XPCOMUtils.defineLazyModuleGetter(this, 'ContentBridge', 'resource://treestyletab-modules/contentBridge.js');
XPCOMUtils.defineLazyModuleGetter(this, 'getHashString', 'resource://treestyletab-modules/getHashString.js');

XPCOMUtils.defineLazyServiceGetter(this, 'SessionStore',
  '@mozilla.org/browser/sessionstore;1', 'nsISessionStore');

function log(...aArgs) {
	utils.log('window', ...aArgs);
}
function logWithStackTrace(...aArgs) {
	utils.logWithStackTrace('window', ...aArgs);
}

function TreeStyleTabWindow(aWindow)
{
	this.window = aWindow;
	this.document = aWindow.document;

	this._restoringTabs = [];
	this._shownPopups = [];
	this.restoringCount = 0;

	aWindow.addEventListener('DOMContentLoaded', this, true);
	ReferenceCounter.add('w,DOMContentLoaded,TSTWindow,true');
	aWindow.addEventListener('load', this, false);
	ReferenceCounter.add('w,load,TSTWindow,false');
	aWindow.TreeStyleTabService = this;

	XPCOMUtils.defineLazyModuleGetter(aWindow, 'TreeStyleTabBrowser', 'resource://treestyletab-modules/browser.js');

	var isDevEdition = this.window.AppConstants.MOZ_DEV_EDITION;
	if (isDevEdition) {
		let rootelem = this.document.documentElement;
		rootelem.setAttribute('treestyletab-devedition', true);
	}

}

TreeStyleTabWindow.prototype = inherit(TreeStyleTabBase, {
	
	base : TreeStyleTabBase, 
 
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
		var setPosition = (function() {
			if (this.preInitialized && this.browser.treeStyleTab)
				this.browser.treeStyleTab.position = aValue;
			else
				this.base.position = aValue;
		}).bind(this);

		if ('UndoTabService' in this.window && this.window.UndoTabService.isUndoable()) {
			var current = this.position;
			var self = this;
			this.window.UndoTabService.doOperation(
				setPosition,
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
			setPosition();
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
 
	get socialBox() 
	{
		return this.document.getElementById('social-sidebar-box');
	},
 
	get isPopupWindow() 
	{
		return (
			this.document &&
			this.document.documentElement.getAttribute('chromehidden') != '' &&
			!this.window.gBrowser.treeStyleTab.isVisible
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
	
	getPropertyPixelValue : function TSTWindow_getPropertyPixelValue(aElementOrStyle, aProp) 
	{
		var style = aElementOrStyle instanceof this.window.CSSStyleDeclaration ?
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
		aTerm = getHashString(aTerm.trim());

		var mode = utils.getTreePref('autoAttach.searchResult');
		if (mode == this.kSEARCH_RESULT_ATTACH_ALWAYS) {
			return true;
		}
		else if (!aTerm || mode == this.kSEARCH_RESULT_DO_NOT_ATTACH) {
			return false;
		}

		var selection = '';
		var contextMenuContentData = this.window.gContextMenuContentData;
		log('shouldOpenSearchResultAsChild: contextMenuContentData =', contextMenuContentData);
		if (contextMenuContentData && contextMenuContentData.selectionInfo) {
			selection = contextMenuContentData.selectionInfo.text;
			if (selection) {
				selection = getHashString(selection.trim());
				log('selection (contextMenuContentData) => ', selection);
			}
		}
		else {
			let tab = this.window.gBrowser.selectedTab;
			selection = tab.__treestyletab__lastContentSelectionText || '';
			log('selection (selectionchange) => ', selection);
			// for old Firefox without selectionchange event
			if (selection === '' &&
				typeof this.window.getBrowserSelection === 'function' &&
				tab.linkedBrowser.getAttribute('remote') !== 'true') {
				selection = getHashString(this.window.getBrowserSelection().trim());
				log('selection (getBrowserSelection) => ', selection);
			}
		}
		return selection == aTerm;
	},
	kSEARCH_RESULT_DO_NOT_ATTACH      : 0,
	kSEARCH_RESULT_ATTACH_IF_SELECTED : 1,
	kSEARCH_RESULT_ATTACH_ALWAYS      : 2,
 
	get isFullscreenAutoHide()
	{
		return Boolean(
			this.window.fullScreen &&
			prefs.getPref('browser.fullscreen.autohide') &&
			utils.getTreePref('tabbar.autoHide.mode.fullscreen') != AutoHideWindow.prototype.kMODE_DISABLED
		);
	},
 
	get autoHideWindow() 
	{
		if (!('_autoHideWindow' in this)) {
			this._autoHideWindow = new AutoHideWindow(this.window);
		}
		return this._autoHideWindow;
	},
 
	get themeManager() 
	{
		if (!('_themeManager' in this)) {
			this._themeManager = new TreeStyleTabThemeManager(this.window);
		}
		return this._themeManager;
	},
 
	getWindowValue : function TSTWindow_getWindowValue(aKey) 
	{
		var value = '';
		try {
			value = SessionStore.getWindowValue(this.window, aKey);
		}
		catch(e) {
		}

		return value;
	},
 
	setWindowValue : function TSTWindow_setWindowValue(aKey, aValue) 
	{
		if (aValue === null || aValue === undefined || aValue === '')
			return this.deleteWindowValue(this.window, aKey);

		try {
			SessionStore.setWindowValue(this.window, aKey, String(aValue));
		}
		catch(e) {
		}

		return aValue;
	},
 
	deleteWindowValue : function TSTWindow_deleteWindowValue(aKey) 
	{
		aTab.removeAttribute(aKey);
		try {
			SessionStore.setWindowValue(this.window, aKey, '');
			SessionStore.deleteWindowValue(this.window, aKey);
		}
		catch(e) {
		}
	},
  
/* Initializing */ 
	
	preInit : function TSTWindow_preInit() 
	{
		if (this.preInitialized)
			return;
		this.preInitialized = true;

		var w = this.window;
		w.removeEventListener('DOMContentLoaded', this, true);
		ReferenceCounter.remove('w,DOMContentLoaded,TSTWindow,true');
		if (w.location.href.indexOf('chrome://browser/content/browser.xul') != 0)
			return;

		w.addEventListener('SSTabRestoring', this, true);
		ReferenceCounter.add('w,SSTabRestoring,TSTWindow,true');

		w.TreeStyleTabWindowHelper.preInit();

		// initialize theme
		this.onPrefChange('extensions.treestyletab.tabbar.style');
	},
	preInitialized : false,
 
	init : function TSTWindow_init() 
	{
		var w = this.window;
		w.removeEventListener('load', this, false);
		ReferenceCounter.remove('w,load,TSTWindow,false');

		w.addEventListener('unload', this, false);
		ReferenceCounter.add('w,unload,TSTWindow,false');

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
		ReferenceCounter.remove('w,SSTabRestoring,TSTWindow,true');

		var d = this.document;
		d.addEventListener('popupshowing', this, false);
		ReferenceCounter.add('d,popupshowing,TSTWindow,false');
		d.addEventListener('popuphiding', this, true);
		ReferenceCounter.add('d,popuphiding,TSTWindow,true');
		d.addEventListener(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, this, false);
		ReferenceCounter.add('d,kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED,TSTWindow,false');
		d.addEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED,     this, false);
		ReferenceCounter.add('d,kEVENT_TYPE_TABBAR_POSITION_CHANGED,TSTWindow,false');
		d.addEventListener(this.kEVENT_TYPE_TABBAR_STATE_CHANGED,        this, false);
		ReferenceCounter.add('d,kEVENT_TYPE_TABBAR_STATE_CHANGED,TSTWindow,false');
		d.addEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB,              this, false);
		ReferenceCounter.add('d,kEVENT_TYPE_FOCUS_NEXT_TAB,TSTWindow,false');
		w.addEventListener('beforecustomization', this, true);
		ReferenceCounter.add('w,beforecustomization,TSTWindow,true');
		w.addEventListener('aftercustomization', this, false);
		ReferenceCounter.add('w,aftercustomization,TSTWindow,false');

		w.messageManager.addMessageListener('SessionStore:restoreTabContentStarted', this);

		this.fullscreenObserver = new FullscreenObserver(this.window);
		this.initUIShowHideObserver();
		if (!this.isMac)
			this.initMenubarShowHideObserver();

		var appcontent = d.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		ReferenceCounter.add('appcontent,SubBrowserAdded,TSTWindow,false');
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);
		ReferenceCounter.add('appcontent,SubBrowserRemoveRequest,TSTWindow,false');

		w.addEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
		ReferenceCounter.add('w,UIOperationHistoryUndo:TabbarOperations,TSTWindow,false');
		w.addEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);
		ReferenceCounter.add('w,UIOperationHistoryRedo:TabbarOperations,TSTWindow,false');

		prefs.addPrefListener(this);

		this.initUninstallationListener();

		ContentBridge.install(w);

		w.TreeStyleTabWindowHelper.onBeforeBrowserInit();
		this.initTabBrowser(this.browser);
		w.TreeStyleTabWindowHelper.onAfterBrowserInit();

		this.processRestoredTabs();
		this.updateTabsInTitlebar();

		this.autoHideWindow; // initialize

		this.onPrefChange('extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut');

		this.initialized = true;
	},
	initialized : false,
	
	initUninstallationListener : function TSTWindow_initUninstallationListener() 
	{
		var restorePrefs = function() {
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
					d.getAnonymousElementByAttribute(aTabBrowser.tabContainer, 'anonid', 'alltabs-button')
				);

		if (allTabsButton && allTabsButton.hasChildNodes() && aTabBrowser.treeStyleTab)
			allTabsButton.firstChild.setAttribute('position', aTabBrowser.treeStyleTab.isVertical ? 'before_start' : 'after_end' );
	},
 
	updateAllTabsPopup : function TSTWindow_updateAllTabsPopup(aEvent) 
	{
		if (!utils.getTreePref('enableSubtreeIndent.allTabsPopup'))
			return;

		for (let aItem of aEvent.originalTarget.childNodes)
		{
			if (aItem.classList.contains('alltabs-item') && 'tab' in aItem)
				aItem.style.marginLeft = aItem.tab.getAttribute(this.kNEST) + 'em';
		}
	},
 
	initUIShowHideObserver : function TSTWindow_initUIShowHideObserver() 
	{
		this.rootElementObserver = new BrowserUIShowHideObserver(this, this.document.documentElement, {
			childList : false,
			subtree   : false
		});

		var toolbox = this.browserToolbox;
		if (toolbox)
			this.browserToolboxObserver = new BrowserUIShowHideObserver(this, toolbox);

		var browserBox = this.browserBox;
		if (browserBox)
			this.browserBoxObserver = new BrowserUIShowHideObserver(this, browserBox);

		var bottomBox = this.browserBottomBox;
		if (bottomBox)
			this.browserBottomBoxObserver = new BrowserUIShowHideObserver(this, bottomBox);

		var socialBox = this.socialBox;
		if (socialBox)
			this.socialBoxObserver = new BrowserUIShowHideObserver(this, socialBox);
	},
 
	initMenubarShowHideObserver : function TSTWindow_initMenubarShowHideObserver() 
	{
		var w = this.window;
		var MutationObserver = w.MutationObserver || w.MozMutationObserver;
		this.menubarShowHideObserver = new MutationObserver((function(aMutations, aObserver) {
			this.updateTabsInTitlebar();
		}).bind(this));
		this.menubarShowHideObserver.observe(w.document.getElementById('toolbar-menubar'), {
			attributes      : true,
			attributeFilter : ['autohide']
		});
	},
  
	destroy : function TSTWindow_destroy() 
	{
		var w = this.window;
		if (this.browser) {
			this.base.inWindowDestoructionProcess = true;
			try {
				w.removeEventListener('unload', this, false);
				ReferenceCounter.remove('w,unload,TSTWindow,false');

				w.TreeStyleTabWindowHelper.destroyToolbarItems();

				this.autoHideWindow.destroy();
				this._autoHideWindow = undefined;

				this.themeManager.destroy();
				this._themeManager = undefined;

				this.browser.treeStyleTab.saveCurrentState();
				this.destroyTabBrowser(this.browser);

				this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOHIDE);
				this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);

				let d = this.document;
				d.removeEventListener('popupshowing', this, false);
				ReferenceCounter.remove('d,popupshowing,TSTWindow,false');
				d.removeEventListener('popuphiding', this, true);
				ReferenceCounter.remove('d,popuphiding,TSTWindow,true');
				d.removeEventListener(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, this, false);
				ReferenceCounter.remove('d,kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED,TSTWindow,false');
				d.removeEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED,     this, false);
				ReferenceCounter.remove('d,kEVENT_TYPE_TABBAR_POSITION_CHANGED,TSTWindow,false');
				d.removeEventListener(this.kEVENT_TYPE_TABBAR_STATE_CHANGED,        this, false);
				ReferenceCounter.remove('d,kEVENT_TYPE_TABBAR_STATE_CHANGED,TSTWindow,false');
				d.removeEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB,              this, false);
				ReferenceCounter.remove('d,kEVENT_TYPE_FOCUS_NEXT_TAB,TSTWindow,false');
				w.removeEventListener('beforecustomization', this, true);
				ReferenceCounter.remove('w,beforecustomization,TSTWindow,true');
				w.removeEventListener('aftercustomization', this, false);
				ReferenceCounter.remove('w,aftercustomization,TSTWindow,false');

				w.messageManager.removeMessageListener('SessionStore:restoreTabContentStarted', this);

				ContentBridge.uninstall(w);

				this.fullscreenObserver.destroy();
				delete this.fullscreenObserver;

				if (this.rootElementObserver) {
					this.rootElementObserver.destroy();
					delete this.rootElementObserver;
				}
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
				if (this.socialBoxObserver) {
					this.socialBoxObserver.destroy();
					delete this.socialBoxObserver;
				}

				if (this.menubarShowHideObserver) {
					this.menubarShowHideObserver.disconnect();
					delete this.menubarShowHideObserver;
				}

				for (let i = 0, maxi = this._tabFocusAllowance.length; i < maxi; i++)
				{
					w.removeEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB, this._tabFocusAllowance[i], false);
					ReferenceCounter.remove('w,kEVENT_TYPE_FOCUS_NEXT_TAB,_tabFocusAllowance['+i+'],false');
				}

				var appcontent = d.getElementById('appcontent');
				appcontent.removeEventListener('SubBrowserAdded', this, false);
				ReferenceCounter.remove('appcontent,SubBrowserAdded,TSTWindow,false');
				appcontent.removeEventListener('SubBrowserRemoveRequest', this, false);
				ReferenceCounter.remove('appcontent,SubBrowserRemoveRequest,TSTWindow,false');

				w.removeEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
				ReferenceCounter.remove('w,UIOperationHistoryUndo:TabbarOperations,TSTWindow,false');
				w.removeEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);
				ReferenceCounter.remove('w,UIOperationHistoryRedo:TabbarOperations,TSTWindow,false');

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
				return this.updateTabsInTitlebar();

			case this.kEVENT_TYPE_FOCUS_NEXT_TAB:
				return this.onFocusNextTab(aEvent);

			case 'keydown':
				return this.onKeyDown(aEvent);

			case 'keyup':
			case 'keypress':
				return this.onKeyRelease(aEvent);

			case 'blur':
				let activeWindow = Cc['@mozilla.org/focus-manager;1']
									.getService(Ci.nsIFocusManager)
									.activeWindow;
				if (!activeWindow || activeWindow != this.window)
					this.simulateKeyRelease();
				return;

			case 'mousedown':
				return this.onTabbarResizeStart(aEvent);

			case 'mouseup':
				return this.onTabbarResizeEnd(aEvent);

			case 'mousemove':
				return this.onTabbarResizing(aEvent);

			case 'dblclick':
				return this.onTabbarReset(aEvent);

			case 'click':
				if (aEvent.currentTarget.localName == 'splitter')
					this.onTabbarSplitterClick(aEvent);
				else
					this.handleNewTabActionOnButton(aEvent);
				return;


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
			ReferenceCounter.add('w,keydown,TSTWindow,true');
			w.addEventListener('keyup',    this, true);
			ReferenceCounter.add('w,keyup,TSTWindow,true');
			w.addEventListener('keypress', this, true);
			ReferenceCounter.add('w,keypress,TSTWindow,true');
			w.addEventListener('blur',     this, true);
			ReferenceCounter.add('w,blur,TSTWindow,true');
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
			ReferenceCounter.remove('w,keydown,TSTWindow,true');
			w.removeEventListener('keyup',    this, true);
			ReferenceCounter.remove('w,keyup,TSTWindow,true');
			w.removeEventListener('keypress', this, true);
			ReferenceCounter.remove('w,keypress,TSTWindow,true');
			w.removeEventListener('blur',     this, true);
			ReferenceCounter.remove('w,blur,TSTWindow,true');
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
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN, b, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN.replace(/^nsDOM/, ''), b, true, false, data);
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
		setTimeout((function() {
			this.arrowKeyEventOnTab = null;
		}).bind(this), 10);

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
			this.fireCustomEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START, b, true, false, data);
			// for backward compatibility
			this.fireCustomEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START.replace(/^nsDOM/, ''), b, true, false, data);
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
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, b, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END.replace(/^nsDOM/, ''), b, true, false, data);

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
	// When the window lose its focus, we cannot detect any key-release events.
	// So we have to simulate key-release event manually.
	// See: https://github.com/piroor/treestyletab/issues/654
	simulateKeyRelease : function TSTWindow_simulateKeyRelease()
	{
		if (!this.accelKeyPressed)
			return;

		this.accelKeyPressed = false;
		var data = {
			scrollDown   : false,
			scrollUp     : false,
			standBy      : false,
			onlyShiftKey : false,
			sourceEvent  : null
		};
		/* PUBLIC API */
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this.browser, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END.replace(/^nsDOM/, ''), this.browser, true, false, data);
	},
 
	get shouldListenKeyEventsForAutoExpandByFocusChange() 
	{
		return (
					utils.getTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut') ||
					utils.getTreePref('autoCollapseExpandSubtreeOnSelect')
				);
	},
   
	receiveMessage : function TSTWindow_receiveMessage(aMessage) 
	{
		var browser = aMessage.target;
		var tabbrowser = this.getTabBrowserFromChild(browser);
		if (!tabbrowser)
			return;
		var tab = tabbrowser.treeStyleTab.getTabFromBrowser(browser);
		if (!tab)
			return;

		switch (aMessage.name)
		{
			case 'SessionStore:restoreTabContentStarted':
				return tabbrowser.treeStyleTab.onRestoreTabContentStarted(tab);
		}
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
		ReferenceCounter.add('currentTarget,mousemove,TSTWindow,false');

		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		var box;
		if (aEvent.currentTarget.id == 'treestyletab-tabbar-resizer-splitter') {
			box = this.getTabStrip(b);
		}
		else {
			box = b.treeStyleTab.tabStripPlaceHolder || b.tabContainer;
		}
		b.treeStyleTab.tabStripPlaceHolder.setAttribute('maxwidth', b.boxObject.width * this.MAX_TABBAR_SIZE_RATIO);

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
		ReferenceCounter.remove('currentTarget,mousemove,TSTWindow,false');

		this.tabbarResizeStartWidth  = -1;
		this.tabbarResizeStartHeight = -1;
		this.tabbarResizeStartX = -1;
		this.tabbarResizeStartY = -1;

		setTimeout((function() {
			try {
				b.treeStyleTab.fixTooNarrowTabbar();
			}
			catch(e) {
				this.defaultErrorHandler(e);
			}
			b.treeStyleTab.tabStripPlaceHolder.removeAttribute('maxwidth');
		}).bind(this), 0);
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
				log('onTabbarResizing: setting expanded width to '+width);
				// b.treeStyleTab.tabbarWidth = width;
				b.treeStyleTab.autoHide.expandedWidth = width;
				if (b.treeStyleTab.autoHide.mode == b.treeStyleTab.autoHide.kMODE_SHRINK &&
					b.treeStyleTab.tabStripPlaceHolder)
					b.treeStyleTab.tabStripPlaceHolder.setAttribute('width', b.treeStyleTab.autoHide.shrunkenWidth);
			}
			else {
				log('onTabbarResizing: setting shrunken width to '+width);
				b.treeStyleTab.autoHide.shrunkenWidth = width;
			}
		}
		else {
			let delta = aEvent.screenY - this.tabbarResizeStartY;
			height += (pos == 'top' ? delta : -delta );
			height = this.maxTabbarHeight(height, b);
			log('onTabbarResizing: setting height to '+height);
			b.treeStyleTab.tabbarHeight = height;
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
 
	onTabbarSplitterClick : function TSTWindow_onTabbarSplitterClick(aEvent) 
	{
		if (
			aEvent.button != 1 ||
			(aEvent.button == 0 && !isAccelKeyPressed(aEvent))
			)
			return;

		var grippy = utils.evaluateXPath(
			'ancestor-or-self::*[local-name()="grippy"]',
			aEvent.originalTarget || aEvent.target,
			Ci.nsIDOMXPathResult.BOOLEAN_TYPE
		).booleanValue;
		if (grippy && aEvent.button == 0)
			return;

		this.onTabbarToggleCollapsed(aEvent.currentTarget);
	},
	onTabbarToggleCollapsed : function TSTWindow_onTabbarToggleCollapsed(aTarget) 
	{
		var b = this.getTabBrowserFromChild(aTarget);
		var splitter = b.treeStyleTab.splitter;

		var state = splitter.getAttribute('state');
		var newState = state == 'collapsed' ? 'open' : 'collapsed';
		splitter.setAttribute('state', newState);

		// Workaround for bugs:
		//  * https://github.com/piroor/treestyletab/issues/593
		//  * https://github.com/piroor/treestyletab/issues/783
		b.ownerDocument.defaultView.setTimeout(function() {
			var visible = splitter.getAttribute('state') != 'collapsed';
			var tabContainer = b.tabContainer;
			if (visible != tabContainer.visible)
				tabContainer.visible = visible;
		}, 0);
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

		this.updateAeroPeekPreviewsTimer = w.setTimeout((function() {
			this.updateAeroPeekPreviewsTimer = null;
			try {
				this.updateAeroPeekPreviewsInternal();
			}
			catch(e) {
				dump(e+'\n');
				this.updateAeroPeekPreviews();
			}
		}).bind(this), 250);
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
 
	updateTabsInTitlebar : function TSTWindow_updateTabsInTitlebar() 
	{
		if (
			this.isPopupWindow ||
			this.tabsInTitlebarChanging
			)
			return;

		this.tabsInTitlebarChanging = true;
		// We have to do this with delay, because the tab bar is always on top
		// for the toolbar customizing and returned to left or right after a delay.
		setTimeout(this.updateTabsInTitlebarInternal.bind(this), 0);
	},
	updateTabsInTitlebarInternal : function TSTWindow_updateTabsInTitlebarInternal()
	{
		var TabsInTitlebar = this.window.TabsInTitlebar;
		var isTopTabbar = this.browser.treeStyleTab.position == 'top';

		try {
			if (TabsInTitlebar) {
				let menubar = this.window.document.getElementById('toolbar-menubar');
				let allowed = (
					!utils.getTreePref('blockTabsInTitlebar') ||
					(isTopTabbar && this.browser.treeStyleTab.fixed) ||
					(!this.isMac && menubar.getAttribute('autohide') !== 'true')
				);
				if (
					(this.window.TabsOnBottom && utils.getTreePref('compatibility.TabsOnBottom')) ||
					('classicthemerestorerjs' in this.window && utils.getTreePref('compatibility.ClassicThemeRestorer'))
					)
					allowed = true;
				TabsInTitlebar.allowedBy('TreeStyleTab-tabsInTitlebar', allowed);
			}
		}
		finally {
			this.tabsInTitlebarChanging = false;
		}
	},
 
	onPopupShown : function TSTWindow_onPopupShown(aPopup) 
	{
		if (!aPopup.boxObject ||
			utils.evaluateXPath(
				'parent::*/ancestor-or-self::*[local-name()="tooltip" or local-name()="panel" or local-name()="popup" or local-name()="menupopup"]',
				aPopup,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue)
			return;

		setTimeout((function() {
			if ((!aPopup.boxObject.width && !aPopup.boxObject.height) ||
				aPopup.boxObject.popupState == 'closed')
				return;

			var id = aPopup.id;
			var item = id && this.document.getElementById(id) ? id : aPopup ;
			var index = this._shownPopups.indexOf(item);
			if (index < 0)
				this._shownPopups.push(item);
		}).bind(this), 10);
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
			setTimeout(function() {
				self._clickEventOnNewTabButtonHandled = false;
			}, 0);
		}
		else if (aEvent.target.id == 'urlbar-go-button' || aEvent.target.id == 'go-button') {
			this.readyToOpenRelatedTabAs(this.browser.selectedTab, utils.getTreePref('autoAttach.goButton'));
		}
	},
	_clickEventOnNewTabButtonHandled : false,
 
	onBeforeTabDuplicate : function TSTWindow_onBeforeTabDuplicate(aWindow, aTab, aDelta) 
	{
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
 
	onBeforeOpenLinkWithTab : function TSTWindow_onBeforeOpenLinkWithTab(aTab, aParams) 
	{
		if (!aTab)
			return;

		log('onBeforeOpenLinkWithTab: ', [aTab, aParams, this.checkToOpenChildTab(aTab)]);

		if (!this.checkToOpenChildTab(aTab)) {
			if (!aParams.fromChrome)
				this.handleNewTabFromCurrent(aTab);
			else if (!aParams.relatedToCurrent && !aParams.referrerURI)
				this.readyToOpenOrphanTabNow(aTab);
		}
	},
 
	onBeforeOpenNewTabByThirdParty : function TSTWindow_onBeforeOpenNewTabByThirdParty(aOwner) 
	{
		log('onBeforeOpenNewTabByThirdParty: ', [aOwner, this.checkToOpenChildTab(aTab)]);

		if (!this.checkToOpenChildTab(aOwner)) {
			this.handleNewTabFromCurrent(aOwner);
		}
	},
 
	onBeforeBrowserAccessOpenURI : function TSTWindow_onBeforeBrowserAccessOpenURI(aParamsOrOpener, aWhere, aContext) 
	{
		var hasOwnerTab = false;
		var opener = null;
		if (aParamsOrOpener) {
			if (aParamsOrOpener instanceof Ci.nsIDOMWindow) {
				log('onBeforeBrowserAccessOpenURI: opener is DOMWindow');
				opener = aParamsOrOpener;
				hasOwnerTab = this.getTabFromFrame(opener.top);
				log('  opener =>', [opener, hasOwnerTab]);
			}
			else if (Ci.nsIOpenURIInFrameParams &&
					aParamsOrOpener instanceof Ci.nsIOpenURIInFrameParams) {
				log('TSTWindow_onBeforeBrowserAccessOpenURI: opener is nsIOpenURIInFrameParams');
				log('  params => ', aParamsOrOpener);
				// from remote contents, we have to detect its opener from the URI.
				let referrer = aParamsOrOpener.referrer;
				if (referrer) {
					let referrerHash = getHashString(referrer);
					let activeTab = this.browser.selectedTab;
					let possibleOwners = [activeTab].concat(this.getAncestorTabs(activeTab));
					for (let i = 0, maxi = possibleOwners.length; i < maxi; i++) {
						let possibleOwner = possibleOwners[i];
						let contentLocations = possibleOwner.__treestyletab__contentLocations ||
												[getHashString(possibleOwner.linkedBrowser.currentURI.spec)];
						if (contentLocations.indexOf(referrerHash) < 0)
							continue;
						hasOwnerTab = true;
						opener = possibleOwner.linkedBrowser;
						break;
					}
				}
				log('  opener =>', [opener, hasOwnerTab]);
			}
		}
		else {
			log('onBeforeBrowserAccessOpenURI: no params is given');
		}
		if (aParamsOrOpener &&
			hasOwnerTab &&
			aWhere == Ci.nsIBrowserDOMWindow.OPEN_NEWTAB)
			this.handleNewTabFromCurrent(opener);
		else
			this.readyToOpenOrphanTabNow(opener);
	},
 
	onBeforeGoHome : function TSTWindow_onBeforeGoHome(aEvent, aTabBrowser) 
	{
		if (!aEvent || aEvent.button === 2 || !aTabBrowser)
			return aEvent;

		var where = this.window.whereToOpenLink(aEvent, false, true);
		if (where == 'current' && aTabBrowser.selectedTab.pinned)
			where = 'tab';

		var openAsFlatTabs = where === 'current';

		// Loading home pages into the current tab will replaces the current
		// tab with the first home page and others are opened as child tabs.
		// To avoid such odd behavior, we always open multiple home pages as
		// a new group.
		// See also: https://github.com/piroor/treestyletab/issues/1063
		var homePages = this.window.gHomeButton.getHomePage().split('|').filter(function(aURI) {
				return aURI;
			});
		if (where.indexOf('tab') !== 0 &&
			homePages.length > 1) {
			where = 'tab';
			aEvent = utils.wrapEventAsNewTabAction(aEvent);
			openAsFlatTabs = true;
		}

		if (openAsFlatTabs) {
			this.readyToOpenOrphanTabNow(aTabBrowser);
			aTabBrowser.treeStyleTab.nextOpenedTabToBeParent = false;
		}
		else {
			if (where.indexOf('tab') === 0)
				this.readyToOpenNewTabGroupNow(aTabBrowser);
			else
				this.readyToOpenOrphanTabNow(aTabBrowser);
		}

		return aEvent;
	},
 
	onBeforeViewMedia : function TSTWindow_onBeforeViewMedia(aEvent, aOwner) 
	{
		var where = String(this.window.whereToOpenLink(aEvent, false, true));

		log('onBeforeViewMedia: ', [aEvent, aOwner, where]);

		if (where.indexOf('tab') == 0)
			this.handleNewTabFromCurrent(aOwner);
		else
			this.readyToOpenOrphanTabNow(aOwner);
	},
 
	onBeforeBrowserSearch : function TSTWindow_onBeforeBrowserSearch(aTerm, aForceNewTab) 
	{
		log('onBeforeBrowserSearch: ', [aTerm, aForceNewTab, this.shouldOpenSearchResultAsChild(aTerm)]);

		if ((arguments.length == 1 || aForceNewTab) &&
			this.shouldOpenSearchResultAsChild(aTerm))
			this.handleNewTabFromCurrent();
		else
			this.readyToOpenOrphanTabNow();
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
		b.treeStyleTab.fixed = newFixed;
		utils.setTreePref('tabbar.fixed.'+orient, newFixed);

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
			this.markAsClosedSet(subtreeTabs);
			for (let i = subtreeTabs.length-1; i > -1; i--)
			{
				b.removeTab(subtreeTabs[i], { animate : true });
			}
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
			this.fireCustomEvent(this.kEVENT_TYPE_SUBTREE_CLOSING, b, true, true, data) &&
			// for backward compatibility
			this.fireCustomEvent(this.kEVENT_TYPE_SUBTREE_CLOSING.replace(/^nsDOM/, ''), b, true, true, data)
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
		this.fireCustomEvent(this.kEVENT_TYPE_SUBTREE_CLOSED, aTabBrowser, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_SUBTREE_CLOSED.replace(/^nsDOM/, ''), aTabBrowser, true, false, data);
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
		var message = w.PluralForm.get(aTabsCount, utils.tabbrowserBundle.getString('tabs.closeWarningMultiple')).replace('#1', aTabsCount);
		var shouldClose = Services.prompt.confirmEx(w,
				utils.tabbrowserBundle.getString('tabs.closeWarningTitle'),
				message,
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
		log('TSTWindow_createSubtree\n'+aTabs.map(function(aTab) {
			return '  '+aTab._tPos+': '+aTab.linkedBrowser.currentURI.spec;
		}).join('\n'));

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
				log('  detaching unselected descendant: '+aDescendantTab._tPos+': '+aDescendantTab.linkedBrowser.currentURI.spec);
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
					b.addTab(utils.getGroupTabURI({
						temporary: utils.getTreePref('createSubtree.underParent.temporaryGroup')
					})) :
					aTabs.shift() ;
		setTimeout((function() {
			try {
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
			}
			catch(e) {
				this.defaultErrorHandler(e);
			}
		}).bind(this), 0);
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
			let index = nextSibling ? nextSibling._tPos : b.tabContainer.childNodes.length ;
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

		this.markAsClosedSet(closeTabs);
		var tabs = closeTabs.reverse();
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			b.removeTab(tabs[i]);
		}
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
		ReferenceCounter.add('window,kEVENT_TYPE_FOCUS_NEXT_TAB,listener,false');
		this._tabFocusAllowance.push(listener);
	},
	_tabFocusAllowance : [],
 
	tearOffSubtreeFromRemote : function TSTWindow_tearOffSubtreeFromRemote(aRemoteTab)
	{
		log('tearOffSubtreeFromRemote');
		var w = this.window;
		var remoteWindow  = aRemoteTab.ownerDocument.defaultView;
		var remoteService = remoteWindow.TreeStyleTabService;
		var remoteMultipleTabService = remoteWindow.MultipleTabService;
		if (remoteService.hasChildTabs(aRemoteTab) ||
			(remoteMultipleTabService && remoteMultipleTabService.isSelected(aRemoteTab))) {
			let remoteBrowser = remoteService.getTabBrowserFromChild(aRemoteTab);
			if (remoteBrowser.treeStyleTab.tabbarDNDObserver.isDraggingAllTabs(aRemoteTab)) {
				w.close();
			}
			else {
				let actionInfo = {
						action : aRemoteTab.__treestyletab__toBeDuplicated ? this.kACTION_DUPLICATE : this.kACTION_IMPORT
					};

				let b = this.browser;
				setTimeout((function() {
					try {
						var blankTab = b.selectedTab;
						b.treeStyleTab.tabbarDNDObserver.performDrop(actionInfo, aRemoteTab);
						setTimeout((function() {
							try {
								b.removeTab(blankTab);
								aRemoteTab = null;
								remoteBrowser = null;
								remoteWindow = null
								remoteService = null;
								remoteMultipleTabService = null;
							}
							catch(e) {
								this.defaultErrorHandler(e);
							}
						}).bind(this), 0);
					}
					catch(e) {
						this.defaultErrorHandler(e);
					}
				}).bind(this), 0);
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
			if (aTab.__treestyletab__toBeRestored)
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
		'extensions.treestyletab'
	],
 
	onPrefChange : function TSTWindow_onPrefChange(aPrefName) 
	{
		var value = prefs.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.style':
			case 'extensions.treestyletab.tabbar.position':
				this.themeManager.set(prefs.getPref('extensions.treestyletab.tabbar.style'), this.position);
				break;

			case 'extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut':
			case 'extensions.treestyletab.autoCollapseExpandSubtreeOnSelect':
				if (this.shouldListenKeyEventsForAutoExpandByFocusChange)
					this.startListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);
				else
					this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);
				break;

			case 'extensions.treestyletab.blockTabsInTitlebar':
				this.updateTabsInTitlebar();
				break;

			default:
				break;
		}
	}
  
}, Object); 
  
