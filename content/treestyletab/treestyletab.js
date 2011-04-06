var TreeStyleTabService = { 
	
/* API */ 

	changeTabbarPosition : function TSTService_changeTabbarPosition(aNewPosition) /* PUBLIC API (obsolete, for backward compatibility) */
	{
		this.position = aNewPosition;
	},
	
	get position() /* PUBLIC API */ 
	{
		return this.preInitialized && this.browser.treeStyleTab ?
					this.browser.treeStyleTab.position :
					this.utils.position ;
	},
	set position(aValue)
	{
		if ('UndoTabService' in window && UndoTabService.isUndoable()) {
			var current = this.utils.position;
			var self = this;
			UndoTabService.doOperation(
				function() {
					self.utils.position = aValue;
				},
				{
					label  : self.treeBundle.getString('undo_changeTabbarPosition_label'),
					name   : 'treestyletab-changeTabbarPosition',
					data   : {
						oldPosition : current,
						newPosition : aValue
					}
				}
			);
		}
		else {
			this.utils.position = aValue;
		}
		return aValue;
	},
 
	undoChangeTabbarPosition : function TSTService_undoChangeTabbarPosition() /* PUBLIC API */ 
	{
		return this.utils.undoChangeTabbarPosition();
	},
 
	redoChangeTabbarPosition : function TSTService_redoChangeTabbarPosition() /* PUBLIC API */ 
	{
		return this.utils.redoChangeTabbarPosition();
	},
 
	get treeViewEnabled() /* PUBLIC API */ 
	{
		return this.utils.treeViewEnabled;
	},
	set treeViewEnabled(aValue)
	{
		return this.utils.treeViewEnabled = aValue;
	},
 
	get useTMPSessionAPI() /* PUBLIC API */ 
	{
		return this.utils.useTMPSessionAPI;
	},
	set useTMPSessionAPI(aValue)
	{
		return this.utils.useTMPSessionAPI = aValue;
	},
 
	get browser() 
	{
		return 'SplitBrowser' in window ? window.SplitBrowser.activeBrowser :
			window.gBrowser ;
	},
 
	get shouldApplyNewPref() 
	{
		return window == this.topBrowserWindow && !this.utils.inWindowDestoructionProcess;
	},
  
/* backward compatibility */ 
	getTempTreeStyleTab : function TSTService_getTempTreeStyleTab(aTabBrowser)
	{
		return aTabBrowser.treeStyleTab || new TreeStyleTabBrowser(aTabBrowser);
	},
	
	initTabAttributes : function TSTService_initTabAttributes(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabAttributes(aTab);
	},
 
	initTabContents : function TSTService_initTabContents(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabContents(aTab);
	},
 
	initTabContentsOrder : function TSTService_initTabContentsOrder(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabContentsOrder(aTab);
	},
  
/* Utilities */ 
	
	stopRendering : function TSTService_stopRendering() 
	{
		window['piro.sakura.ne.jp'].stopRendering.stop();
	},
	startRendering : function TSTService_startRendering()
	{
		window['piro.sakura.ne.jp'].stopRendering.start();
	},
 
	getPropertyPixelValue : function TSTService_getPropertyPixelValue(aElementOrStyle, aProp) 
	{
		var style = aElementOrStyle instanceof Components.interfaces.nsIDOMCSSStyleDeclaration ?
					aElementOrStyle :
					window.getComputedStyle(aElementOrStyle, null) ;
		return Number(style.getPropertyValue(aProp).replace(/px$/, ''));
	},
 
	get isToolbarCustomizing() 
	{
		var toolbox = window.gToolbox || window.gNavToolbox;
		return toolbox && toolbox.customizing;
	},
 
	maxTabbarWidth : function TSTService_maxTabbarWidth(aWidth, aTabBrowser) 
	{
		aTabBrowser = aTabBrowser || this.browser;
		var windowWidth = window.outerWidth;
		var rootWidth = parseInt(document.documentElement.getAttribute('width') || 0);
		var max = Math.max(windowWidth, rootWidth);
		return Math.max(0, Math.min(aWidth, max * this.MAX_TABBAR_SIZE_RATIO));
	},
 
	maxTabbarHeight : function TSTService_maxTabbarHeight(aHeight, aTabBrowser) 
	{
		aTabBrowser = aTabBrowser || this.browser;
		var windowHeight = window.outerHeight;
		var rootHeight = parseInt(document.documentElement.getAttribute('height') || 0);
		var max = Math.max(windowHeight, rootHeight);
		return Math.max(0, Math.min(aHeight, max * this.MAX_TABBAR_SIZE_RATIO));
	},
 
	shouldOpenSearchResultAsChild : function TSTService_shouldOpenSearchResultAsChild(aTerm) 
	{
		var mode = this.getTreePref('autoAttach.searchResult');
		if (mode == this.kSEARCH_RESULT_ATTACH_ALWAYS) {
			return true;
		}
		else if (!aTerm || mode == this.kSEARCH_RESULT_DO_NOT_ATTACH) {
			return false;
		}

		var w = document.commandDispatcher.focusedWindow;
		if (!w || w.top != this.browser.contentWindow)
			w = this.browser.contentWindow;

		return (function(aWindow) {
			if (!aWindow || !(aWindow instanceof Components.interfaces.nsIDOMWindow))
				return false;
			var selection = aWindow.getSelection();
			if (selection && selection.toString() == aTerm)
				return true;
			return aWindow.frames ? Array.slice(aWindow.frames).some(arguments.callee) : false ;
		})(w);
	},
	kSEARCH_RESULT_DO_NOT_ATTACH      : 0,
	kSEARCH_RESULT_ATTACH_IF_SELECTED : 1,
	kSEARCH_RESULT_ATTACH_ALWAYS      : 2,
  
/* Initializing */ 
	
	preInit : function TSTService_preInit() 
	{
		if (this.preInitialized) return;
		this.preInitialized = true;

		window.removeEventListener('DOMContentLoaded', this, true);
		if (location.href.indexOf('chrome://browser/content/browser.xul') != 0)
			return;

		window.addEventListener('SSTabRestoring', this, true);

		var source = window.BrowserStartup.toSource();
		if (source.indexOf('!MultipleTabService.tearOffSelectedTabsFromRemote()') > -1) {
			eval('window.BrowserStartup = '+source.replace(
				'!MultipleTabService.tearOffSelectedTabsFromRemote()',
				'!TreeStyleTabService.tearOffSubtreeFromRemote() && $&'
			));
		}
		else if (source.indexOf('gBrowser.swapBrowsersAndCloseOther') > -1) {
			eval('window.BrowserStartup = '+source.replace(
				'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);',
				'if (!TreeStyleTabService.tearOffSubtreeFromRemote()) { $& }'
			));
		}

		eval('nsBrowserAccess.prototype.openURI = '+
			nsBrowserAccess.prototype.openURI.toSource().replace(
				/(switch\s*\(aWhere\))/,
				<![CDATA[
					if (aOpener &&
						aWhere == Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWTAB) {
						TreeStyleTabService.readyToOpenChildTab(aOpener);
					}
					$1]]>
			)
		);

		if ('BrowserOpenTab' in window) {
			eval('window.BrowserOpenTab = '+
				window.BrowserOpenTab.toSource().replace(
					'gBrowser.loadOneTab(',
					'gBrowser.treeStyleTab.onBeforeNewTabCommand(); $&'
				)
			);
		}

		if ('undoCloseTab' in window) {
			eval('window.undoCloseTab = '+
				window.undoCloseTab.toSource().replace(
					/(\btab\s*=\s*[^\.]+\.undoCloseTab\([^;]+\);)/,
					<![CDATA[
						gBrowser.__treestyletab__readyToUndoCloseTab = true;
						$1
						tab.__treestyletab__restoredByUndoCloseTab = true;
						delete gBrowser.__treestyletab__readyToUndoCloseTab;
					]]>
				)
			);
		}

		this.overrideExtensionsPreInit(); // hacks.js

		this.migratePrefs();
	},
	preInitialized : false,
	
	kPREF_VERSION : 7,
	migratePrefs : function TSTService_migratePrefs() 
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
				orientalPrefs = orientalPrefs.concat([
					'extensions.treestyletab.tabbar.hideAlltabsButton'
				]);
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
				[
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
				].forEach(function(aPref) {
					var value = this.getPref(aPref);
					if (value === null) return;
					this.setPref(aPref.replace('SubTree', 'Subtree'), value);
					this.clearPref(aPref);
				}, this);
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
			default:
				orientalPrefs.forEach(function(aPref) {
					let value = this.getPref(aPref);
					if (value === null) return;
					this.setPref(aPref+'.horizontal', value);
					this.setPref(aPref+'.vertical', value);
					this.clearPref(aPref);
				}, this);
				break;
		}
		this.setTreePref('prefsVersion', this.kPREF_VERSION);
	},
  
	init : function TSTService_init() 
	{
		if (!('gBrowser' in window)) return;

		if (this.initialized) return;
		this.initialized = true;

		if (!this.preInitialized) {
			this.preInit();
		}
		window.removeEventListener('SSTabRestoring', this, true);

		window.removeEventListener('load', this, false);
		window.addEventListener('unload', this, false);
		document.addEventListener('popupshowing', this, false);
		document.addEventListener('popuphiding', this, true);
		document.addEventListener(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, this, false);
		document.addEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED,     this, false);
		document.addEventListener(this.kEVENT_TYPE_TABBAR_STATE_CHANGED,        this, false);
		document.addEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB,              this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);

		var statusPanel = document.getElementById('statusbar-display');
		if (statusPanel)
			statusPanel.addEventListener('DOMAttrModified', this, false);

		window.addEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
		window.addEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);

		this.addPrefListener(this);

		this.initUninstallationListener();

		this.overrideExtensionsOnInitBefore(); // hacks.js
		this.overrideGlobalFunctions();
		this.initTabBrowser(gBrowser);
		this.overrideExtensionsOnInitAfter(); // hacks.js

		this.processRestoredTabs();
		this.updateTabsOnTop();

		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.mode');
		this.onPrefChange('extensions.treestyletab.tabbar.style');
		this.onPrefChange('extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut');
	},
	initialized : false,
	
	initUninstallationListener : function TSTService_initUninstallationListener() 
	{
		var namespace = {};
		Components.utils.import(
			'resource://treestyletab-modules/lib/prefs.js',
			namespace
		);
		var prefs = namespace.prefs;
		namespace = void(0);
		var restorePrefs = function() {
				if (!prefs) return;
				[
					'browser.tabs.loadFolderAndReplace',
					'browser.tabs.insertRelatedAfterCurrent',
					'extensions.stm.tabBarMultiRows' // Super Tab Mode
				].forEach(function(aPref) {
					var backup = prefs.getPref(aPref+'.backup');
					if (backup === null) return;
					prefs.setPref(aPref+'.override', backup); // we have to set to ".override" pref, to avoid unexpectedly reset by the preference listener.
					prefs.clearPref(aPref+'.backup');
				});
			};
		new window['piro.sakura.ne.jp'].UninstallationListener({
			id : 'treestyletab@piro.sakura.ne.jp',
			onuninstalled : restorePrefs,
			ondisabled : restorePrefs
		});
	},
 
	initTabBrowser : function TSTService_initTabBrowser(aTabBrowser) 
	{
		if (aTabBrowser.localName != 'tabbrowser') return;
		aTabBrowser.treeStyleTab = new TreeStyleTabBrowser(aTabBrowser);
		aTabBrowser.treeStyleTab.init();
	},
 
	updateTabDNDObserver : function TSTService_updateTabDNDObserver(aObserver) 
	{
		var strip = this.getTabStrip(aObserver) ||
					gBrowser.mStrip // fallback to the default strip, for Tab Mix Plus;

		if (aObserver.tabContainer &&
			aObserver.tabContainer.tabbrowser == aObserver) { // Firefox 4.0 or later
			aObserver = aObserver.tabContainer;
		}

		if ('_setEffectAllowedForDataTransfer' in aObserver) {
			eval('aObserver._setEffectAllowedForDataTransfer = '+
				aObserver._setEffectAllowedForDataTransfer.toSource().replace(
					'{',
					'{ var TSTTabBrowser = this instanceof Ci.nsIDOMElement ? this : gBrowser ;'
				).replace(
					/\.screenX/g, '[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.positionProp]'
				).replace(
					/\.width/g, '[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.sizeProp]'
				).replace(
					/(return (?:true|dt.effectAllowed = "copyMove");)/,
					<![CDATA[
						if (!this.treeStyleTab.tabbarDNDObserver.canDropTab(arguments[0])) {
							return dt.effectAllowed = "none";
						}
						$1
					]]>
				).replace(
					'sourceNode.parentNode == this &&',
					'$& TSTTabBrowser.treeStyleTab.getTabFromEvent(event) == sourceNode &&'
				)
			);
		}
	},
 
	overrideGlobalFunctions : function TSTService_overrideGlobalFunctions() 
	{
		window.__treestyletab__BrowserCustomizeToolbar = window.BrowserCustomizeToolbar;
		window.BrowserCustomizeToolbar = function() {
			TreeStyleTabService.destroyToolbarItems();
			window.__treestyletab__BrowserCustomizeToolbar.call(window);
		};

		let (toolbox) {
			toolbox = document.getElementById('navigator-toolbox');
			if (toolbox.customizeDone) {
				toolbox.__treestyletab__customizeDone = toolbox.customizeDone;
				toolbox.customizeDone = function(aChanged) {
					this.__treestyletab__customizeDone(aChanged);
					TreeStyleTabService.initToolbarItems();
				};
			}
			if ('BrowserToolboxCustomizeDone' in window) {
				window.__treestyletab__BrowserToolboxCustomizeDone = window.BrowserToolboxCustomizeDone;
				window.BrowserToolboxCustomizeDone = function(aChanged) {
					window.__treestyletab__BrowserToolboxCustomizeDone.apply(window, arguments);
					TreeStyleTabService.initToolbarItems();
				};
			}
			this.initToolbarItems();
			toolbox = null;
		}


		eval('nsContextMenu.prototype.openLinkInTab = '+
			nsContextMenu.prototype.openLinkInTab.toSource().replace(
				'{',
				<![CDATA[$&
					TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
				]]>
			)
		);
		eval('nsContextMenu.prototype.openFrameInTab = '+
			nsContextMenu.prototype.openFrameInTab.toSource().replace(
				'{',
				<![CDATA[$&
					TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
				]]>
			)
		);
		var viewImageMethod = ('viewImage' in nsContextMenu.prototype) ? 'viewImage' : 'viewMedia' ;
		eval('nsContextMenu.prototype.'+viewImageMethod+' = '+
			nsContextMenu.prototype[viewImageMethod].toSource().replace(
				'openUILink(',
				<![CDATA[
					if (String(whereToOpenLink(e, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]>
			)
		);
		eval('nsContextMenu.prototype.viewBGImage = '+
			nsContextMenu.prototype.viewBGImage.toSource().replace(
				'openUILink(',
				<![CDATA[
					if (String(whereToOpenLink(e, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]>
			)
		);
		eval('nsContextMenu.prototype.addDictionaries = '+
			nsContextMenu.prototype.addDictionaries.toSource().replace(
				'openUILinkIn(',
				<![CDATA[
					if (where.indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]>
			)
		);

		if ('BrowserSearch' in window &&
			'loadSearch' in BrowserSearch) {
			eval('BrowserSearch.loadSearch = '+
				BrowserSearch.loadSearch.toSource().replace(
					'if (useNewTab) {',
					<![CDATA[$&
						if (TreeStyleTabService.shouldOpenSearchResultAsChild(arguments[0]))
							TreeStyleTabService.readyToOpenChildTab();
					]]>
				)
			);
		}

		this._splitFunctionNames(<![CDATA[
			window.duplicateTab.handleLinkClick
			window.__treestyletab__highlander__origHandleLinkClick
			window.__splitbrowser__handleLinkClick
			window.__ctxextensions__handleLinkClick
			window.handleLinkClick
		]]>).some(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function handleLinkClick/.test(source))
				return false;
			eval(aFunc+' = '+source.replace( // for Firefox 3.5 - Firefox 3.6
				/(openNewTabWith\()/g,
				<![CDATA[
					if (!TreeStyleTabService.checkToOpenChildTab(event.target.ownerDocument.defaultView))
						TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView);
					$1]]>
			).replace( // for Firefox 4.0-
				/(charset\s*:\s*doc\.characterSet\s*)/,
				'$1, event : event, linkNode : linkNode'
			));
			source = null;
			return true;
		}, this);

		// for Firefox 4.0-
		if ('openLinkIn' in window) {
			eval('window.openLinkIn = '+
				window.openLinkIn.toSource().replace(
					'browser.loadOneTab(',
					<![CDATA[
						if (params.linkNode &&
							!TreeStyleTabService.checkToOpenChildTab(params.linkNode.ownerDocument.defaultView))
							TreeStyleTabService.readyToOpenChildTab(params.linkNode.ownerDocument.defaultView);
						$&]]>.toString()
				)
			);
		}

		this._splitFunctionNames(<![CDATA[
			window.permaTabs.utils.wrappedFunctions["window.contentAreaClick"]
			window.__contentAreaClick
			window.__ctxextensions__contentAreaClick
			window.contentAreaClick
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function contentAreaClick/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				// for Tab Utilities, etc. Some addons insert openNewTabWith() to the function.
				// (calls for the function is not included by Firefox default.)
				/(openNewTabWith\()/g,
				<![CDATA[
					if (!TreeStyleTabService.checkToOpenChildTab(event.target.ownerDocument.defaultView)) TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView);
					$1]]>
			));
			source = null;
		}, this);

		this._splitFunctionNames(<![CDATA[
			window.duplicateTab.gotoHistoryIndex
			window.duplicateTab.BrowserBack
			window.duplicateTab.BrowserForward
			window.__rewindforward__BrowserForward
			window.__rewindforward__BrowserBack
			window.gotoHistoryIndex
			window.BrowserForward
			window.BrowserBack
			window.BrowserReloadOrDuplicate
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function (gotoHistoryIndex|BrowserForward|BrowserBack)/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				/((?:openUILinkIn|duplicateTabIn)\()/g,
				<![CDATA[
					if (where == 'tab' || where == 'tabshifted')
						TreeStyleTabService.readyToOpenChildTab();
					$1]]>
			));
			source = null;
		}, this);

		this._splitFunctionNames(<![CDATA[
			permaTabs.utils.wrappedFunctions["window.BrowserHomeClick"]
			window.BrowserHomeClick
			window.BrowserGoHome
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function (BrowserHomeClick|BrowserGoHome)/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				'gBrowser.loadTabs(',
				<![CDATA[
					TreeStyleTabService.readyToOpenNewTabGroup(gBrowser);
					$&]]>
			));
			source = null;
		}, this);

		eval('FeedHandler.loadFeed = '+
			FeedHandler.loadFeed.toSource().replace(
				'openUILink(',
				<![CDATA[
					if (String(whereToOpenLink(event, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(gBrowser);
					$&]]>
			)
		);

		// Firefox 3 full screen
		eval('FullScreen._animateUp = '+
			FullScreen._animateUp.toSource().replace(
				// Firefox 3.6 or older
				/(gBrowser\.mStrip\.boxObject\.height)/,
				'((gBrowser.treeStyleTab.position != "top") ? 0 : $1)'
			)
		);
		eval('FullScreen.mouseoverToggle = '+
			FullScreen.mouseoverToggle.toSource().replace(
				// Firefox 4.0 or later
				'this._isChromeCollapsed = !aShow;',
				'gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN); $&'
			).replace(
				// Firefox 3.6 or older
				'gBrowser.mStrip.setAttribute("moz-collapsed", !aShow);',
				'if (gBrowser.treeStyleTab.position == "top") { $& }'
			)
		);
		eval('FullScreen.toggle = '+
			FullScreen.toggle.toSource().replace(
				'{',
				<![CDATA[{
					var treeStyleTab = gBrowser.treeStyleTab;
					if (treeStyleTab.position != 'top') {
						if (window.fullScreen)
							treeStyleTab.autoHide.endForFullScreen();
						else
							treeStyleTab.autoHide.startForFullScreen();
					}
				]]>
			)
		);

		if ('PrintUtils' in window) {
			eval('PrintUtils.printPreview = '+PrintUtils.printPreview.toSource().replace(
				'{',
				'{ TreeStyleTabService.onPrintPreviewEnter();'
			));
			eval('PrintUtils.exitPrintPreview = '+PrintUtils.exitPrintPreview.toSource().replace(
				'{',
				'{ TreeStyleTabService.onPrintPreviewExit();'
			));
		}

		if ('TabsOnTop' in window && TabsOnTop.syncCommand) {
			eval('TabsOnTop.syncCommand = '+TabsOnTop.syncCommand.toSource().replace(
				/(\}\)?)$/,
				'gBrowser.treeStyleTab.onTabsOnTopSyncCommand(enabled); $&'
			));
		}

		if ('toggleSidebar' in window) {
			eval('window.toggleSidebar = '+
				window.toggleSidebar.toSource().replace(
					'{',
					'{ gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_WINDOW_RESIZE);'
				)
			);
		}
	},
	_splitFunctionNames : function TSTService__splitFunctionNames(aString)
	{
		return String(aString)
				.split(/\s+/)
				.map(function(aString) {
					return aString
							.replace(/\/\*.*\*\//g, '')
							.replace(/\/\/.+$/, '')
							.replace(/^\s+|\s+$/g, '');
				});
	},
	_getFunctionSource : function TSTService__getFunctionSource(aFunc)
	{
		var func;
		try {
			eval('func = '+aFunc);
		}
		catch(e) {
			return null;
		}
		return func ? func.toSource() : null ;
	},
 
	initToolbarItems : function TSTService_initToolbarItems() 
	{
		var searchbar = document.getElementById('searchbar');
		if (searchbar &&
			searchbar.doSearch &&
			searchbar.doSearch.toSource().toSource().indexOf('TreeStyleTabService') < 0) {
			eval('searchbar.doSearch = '+searchbar.doSearch.toSource().replace(
				/(openUILinkIn\(.+?\);)/,
				<![CDATA[
					if (TreeStyleTabService.shouldOpenSearchResultAsChild(arguments[0]))
						TreeStyleTabService.readyToOpenChildTab();
					$1
					TreeStyleTabService.stopToOpenChildTab();
				]]>.toString()
			));
		}

		// for Firefox 4.0 or later
		this.updateAllTabsButton(gBrowser);

		var event = document.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_AFTER_TOOLBAR_CUSTOMIZATION, true, false);
		document.documentElement.dispatchEvent(event);
	},
 
	destroyToolbarItems : function TSTService_destroyToolbarItems() 
	{
		// Firefox 4.0 or later (restore original position)
		var allTabsButton = document.getElementById('alltabs-button');
		if (allTabsButton && allTabsButton.hasChildNodes())
			allTabsButton.firstChild.setAttribute('position', 'after_end');

		var event = document.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_BEFORE_TOOLBAR_CUSTOMIZATION, true, false);
		document.documentElement.dispatchEvent(event);
	},
 
	updateAllTabsButton : function TSTService_updateAllTabsButton(aTabBrowser) 
	{
		aTabBrowser = aTabBrowser || this.browser;
		var allTabsButton = document.getElementById('alltabs-button') || // Firefox 4.0 or later
				document.getAnonymousElementByAttribute(aTabBrowser.mTabContainer, 'class', 'tabs-alltabs-button') || // Firefox 3.6 or older
				( // Tab Mix Plus
					this.getTreePref('compatibility.TMP') &&
					document.getAnonymousElementByAttribute(aTabBrowser.mTabContainer, 'anonid', 'alltabs-button')
				);

		if (allTabsButton && allTabsButton.hasChildNodes() && aTabBrowser.treeStyleTab)
			allTabsButton.firstChild.setAttribute('position', aTabBrowser.treeStyleTab.isVertical ? 'before_start' : 'after_end' );
	},
 
	updateAllTabsPopup : function TSTService_updateAllTabsPopup(aEvent) 
	{
		if (!this.getTreePref('enableSubtreeIndent.allTabsPopup')) return;

		var items = Array.slice(aEvent.originalTarget.childNodes);
		var firstItemIndex = 0;
		// ignore menu items inserted by Weave (Firefox Sync), Tab Utilities, and others.
		items.forEach(function(aItem, aIndex) {
			if (
				aItem.getAttribute('anonid') ||
				aItem.id ||
				aItem.hidden ||
				aItem.localName != 'menuitem'
				)
				firstItemIndex = aIndex + 1;
		});
		items = items.slice(firstItemIndex);

		var b = this.getTabBrowserFromChild(aEvent.originalTarget) || gBrowser;
		this.getTabsArray(b).forEach(function(aTab, aIndex) {
			items[aIndex].style.paddingLeft = aTab.getAttribute(this.kNEST)+'em';
		}, this);
	},
 
	updateStatusPanel : function TSTService_updateStatusPanel(aPanel) 
	{
		if (!this.getTreePref('autoRepositionStatusPanel'))
			return;

		switch (this.position)
		{
			case 'left':
				aPanel.setAttribute('mirror', true);
				break;

			case 'right':
				aPanel.removeAttribute('mirror');
				break;

			default:
				break;
		}
	},
  
	destroy : function TSTService_destroy() 
	{
		this.utils.inWindowDestoructionProcess = true;
		try {
			window.removeEventListener('unload', this, false);

			gBrowser.treeStyleTab.saveCurrentState();
			this.destroyTabBrowser(gBrowser);

			this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOHIDE);
			this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);

			document.removeEventListener('popupshowing', this, false);
			document.removeEventListener('popuphiding', this, true);
			document.removeEventListener(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, this, false);
			document.removeEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED,     this, false);
			document.removeEventListener(this.kEVENT_TYPE_TABBAR_STATE_CHANGED,        this, false);
			document.removeEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB,              this, false);

			this._tabFocusAllowance.forEach(function(aListener) {
				window.removeEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB, aListener, false);
			}, this);

			var appcontent = document.getElementById('appcontent');
			appcontent.removeEventListener('SubBrowserAdded', this, false);
			appcontent.removeEventListener('SubBrowserRemoveRequest', this, false);

			var statusPanel = document.getElementById('statusbar-display');
			if (statusPanel)
				statusPanel.removeEventListener('DOMAttrModified', this, false);

			window.removeEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
			window.removeEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);

			this.removePrefListener(this);
		}
		catch(e) {
			throw e;
		}
		finally {
			this.utils.inWindowDestoructionProcess = false;
		}
	},
	
	destroyTabBrowser : function TSTService_destroyTabBrowser(aTabBrowser) 
	{
		if (aTabBrowser.localName != 'tabbrowser') return;
		aTabBrowser.treeStyleTab.destroy();
		delete aTabBrowser.treeStyleTab;
	},
   
/* Event Handling */ 
	
	handleEvent : function TSTService_handleEvent(aEvent) 
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

			case 'DOMAttrModified':
				if (aEvent.attrName == 'label')
					this.updateStatusPanel(aEvent.currentTarget);
				return;

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
	
	startListenKeyEventsFor : function TSTService_startListenKeyEventsFor(aReason) 
	{
		if (this.keyEventListeningFlags & aReason) return;
		if (!this.keyEventListening) {
			window.addEventListener('keydown',  this, true);
			window.addEventListener('keyup',    this, true);
			window.addEventListener('keypress', this, true);
			this.keyEventListening = true;
		}
		this.keyEventListeningFlags |= aReason;
	},
 
	endListenKeyEventsFor : function TSTService_endListenKeyEventsFor(aReason) 
	{
		if (!(this.keyEventListeningFlags & aReason)) return;
		this.keyEventListeningFlags ^= aReason;
		if (!this.keyEventListeningFlags && this.keyEventListening) {
			window.removeEventListener('keydown',  this, true);
			window.removeEventListener('keyup',    this, true);

			window.removeEventListener('keypress', this, true);
			this.keyEventListening = false;
		}
	},
 
	onKeyDown : function TSTService_onKeyDown(aEvent) 
	{
		/**
		 * On Mac OS X, default accel key is the Command key (metaKey), but
		 * Cmd-Tab is used to switch applications by the OS itself. So Firefox
		 * uses Ctrl-Tab to switch tabs on all platforms.
		 */
		// this.accelKeyPressed = this.isAccelKeyPressed(aEvent);
		this.accelKeyPressed = aEvent.ctrlKey || aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_CONTROL;

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
 
	onKeyRelease : function TSTService_onKeyRelease(aEvent) 
	{
		var b = this.browser;
		if (!b || !b.treeStyleTab) return;
		var sv = b.treeStyleTab;

		var scrollDown,
			scrollUp;

		// this.accelKeyPressed = this.isAccelKeyPressed(aEvent);
		this.accelKeyPressed = aEvent.ctrlKey || aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_CONTROL;

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
				!this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut') &&
				this.getTreePref('autoCollapseExpandSubtreeOnSelect');
	},
 
	get ctrlTabPreviewsEnabled() 
	{
		return 'allTabs' in window &&
				this.getPref('browser.ctrlTab.previews');
	},
   
	onTabbarResizeStart : function TSTService_onTabbarResizeStart(aEvent) 
	{
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
	onTabbarResizeEnd : function TSTService_onTabbarResizeEnd(aEvent)
	{
		if (this.tabbarResizeStartWidth < 0)
			return;

		aEvent.stopPropagation();
		if ('releaseCapture' in aEvent.currentTarget)
			aEvent.currentTarget.releaseCapture();

		aEvent.currentTarget.removeEventListener('mousemove', this, false);

		this.tabbarResizeStartWidth  = -1;
		this.tabbarResizeStartHeight = -1;
		this.tabbarResizeStartX = -1;
		this.tabbarResizeStartY = -1;

		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
	},
	onTabbarResizing : function TSTService_onTabbarResizing(aEvent)
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
				this.setTreePref('tabbar.width', width);
				if (b.treeStyleTab.autoHide.mode == b.treeStyleTab.autoHide.kMODE_SHRINK &&
					b.treeStyleTab.tabStripPlaceHolder)
					b.treeStyleTab.tabStripPlaceHolder.setAttribute('width', this.getTreePref('tabbar.shrunkenWidth'));
			}
			else {
				this.setTreePref('tabbar.shrunkenWidth', width);
			}
		}
		else {
			let delta = aEvent.screenY - this.tabbarResizeStartY;
			height += (pos == 'top' ? delta : -delta );
			this.setTreePref('tabbar.height', this.maxTabbarHeight(height, b));
		}
		b.treeStyleTab.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_TABBAR_RESIZE);
	},
	tabbarResizeStartWidth  : -1,
	tabbarResizeStartHeight : -1,
	tabbarResizeStartX : -1,
	tabbarResizeStartY : -1,
 
	onTabbarReset : function TSTService_onTabbarReset(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		if (b) {
			b.treeStyleTab.resetTabbarSize();
			aEvent.stopPropagation();
		}
	},
 
	onFocusNextTab : function TSTService_onFocusNextTab(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b = this.getTabBrowserFromChild(tab);
		if (
			this.getPref('browser.tabs.selectOwnerOnClose') &&
			tab.owner &&
			(
				!b._removingTabs ||
				b._removingTabs.indexOf(tab.owner) < 0
			)
			)
			aEvent.preventDefault();
	},
 
	showHideSubtreeMenuItem : function TSTService_showHideSubtreeMenuItem(aMenuItem, aTabs) 
	{
		if (!aMenuItem ||
			aMenuItem.getAttribute('hidden') == 'true' ||
			!aTabs ||
			!aTabs.length)
			return;

		var hasSubtree = false;
		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			if (!this.hasChildTabs(aTabs[i])) continue;
			hasSubtree = true;
			break;
		}
		if (hasSubtree)
			aMenuItem.removeAttribute('hidden');
		else
			aMenuItem.setAttribute('hidden', true);
	},
	showHideSubTreeMenuItem : function() { return this.showHideSubtreeMenuItem.apply(this, arguments); }, // obsolete, for backward compatibility
 
	updateAeroPeekPreviews : function TSTService_updateAeroPeekPreviews() 
	{
		if (
			this.updateAeroPeekPreviewsTimer ||
			!this.getPref('browser.taskbar.previews.enable') ||
			!this.getTreePref('taskbarPreviews.hideCollapsedTabs') ||
			!('Win7Features' in window) ||
			!window.Win7Features ||
			!this.AeroPeek ||
			!this.AeroPeek.windows
			)
			return;

		this.updateAeroPeekPreviewsTimer = window.setTimeout(function(aSelf) {
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
	updateAeroPeekPreviewsInternal : function TSTService_updateAeroPeekPreviewsInternal()
	{
		if (
			!this.getPref('browser.taskbar.previews.enable') ||
			!this.getTreePref('taskbarPreviews.hideCollapsedTabs')
			)
			return;

		this.AeroPeek.windows.some(function(aTabWindow) {
			if (aTabWindow.win == window) {
				aTabWindow.previews.forEach(function(aPreview) {
					if (!aPreview) return;
					var tab = aPreview.controller.wrappedJSObject.tab;
					aPreview.visible = !this.isCollapsed(tab);
				}, this);
				this.AeroPeek.checkPreviewCount();
				return true;
			}
			return false;
		}, this);
	},
 
	updateTabsOnTop : function TSTService_updateTabsOnTop() 
	{
		if (!('TabsOnTop' in window) || !('enabled' in TabsOnTop))
			return;

		if (!('_tabsOnTopDefaultState' in this))
			this._tabsOnTopDefaultState = TabsOnTop.enabled;

		if (gBrowser.treeStyleTab.position != 'top' ||
			!gBrowser.treeStyleTab.fixed) {
			if (TabsOnTop.enabled)
				TabsOnTop.enabled = false;
		}
		else if ('_tabsOnTopDefaultState' in this) {
			if (TabsOnTop.enabled!= this._tabsOnTopDefaultState)
				TabsOnTop.enabled = this._tabsOnTopDefaultState;
			delete this._tabsOnTopDefaultState;
		}
	},
 
	onPopupShown : function TSTService_onPopupShown(aPopup) 
	{
		if (!aPopup.boxObject ||
			this.evaluateXPath(
				'local-name() = "tooltip" or local-name() ="panel" or '+
				'parent::*/ancestor-or-self::*[local-name()="popup" or local-name()="menupopup"]',
				aPopup,
				XPathResult.BOOLEAN_TYPE


			).booleanValue)
			return;

		window.setTimeout(function(aSelf) {
			if ((!aPopup.boxObject.width && !aPopup.boxObject.height) ||
				aPopup.boxObject.popupState == 'closed')
				return;

			var id = aPopup.id;
			var item = id && document.getElementById(id) ? id : aPopup ;
			var index = TreeStyleTabService._shownPopups.indexOf(item);
			if (index < 0)
				TreeStyleTabService._shownPopups.push(item);
		}, 10, this);
	},
 
	onPopupHidden : function TSTService_onPopupHidden(aPopup) 
	{
		var id = aPopup.id;
		aPopup = id && document.getElementById(id) ? id : aPopup ;
		var index = TreeStyleTabService._shownPopups.indexOf(aPopup);
		if (index > -1)
			TreeStyleTabService._shownPopups.splice(index, 1);
	},
 
	isPopupShown : function TSTService_isPopupShown() 
	{
		TreeStyleTabService._shownPopups = TreeStyleTabService._shownPopups.filter(function(aItem) {
			if (typeof aItem == 'string')
				aItem = document.getElementById(aItem);
			return aItem && aItem.boxObject && ((aItem.boxObject.width || aItem.boxObject.height) && aItem.state != 'closed');
		});
		return TreeStyleTabService._shownPopups.length > 0;
	},
	_shownPopups : [],
 
	onBeforeNewTabCommand : function TSTService_onBeforeNewTabCommand(aTabBrowser) 
	{
		var b = aTabBrowser || this.browser;
		switch (this.getTreePref('autoAttach.newTabCommand'))
		{
			case this.kNEWTAB_COMMAND_DO_NOT_ATTACH:
			default:
				break;

			case this.kNEWTAB_COMMAND_ATTACH_TO_CURRENT:
				this.readyToOpenChildTab(b.selectedTab);
				break;

			case this.kNEWTAB_COMMAND_ATTACH_TO_PARENT:
				let parentTab = this.getParentTab(b.selectedTab);
				if (parentTab)
					this.readyToOpenChildTab(parentTab);
				break;
		}
	},
	kNEWTAB_COMMAND_DO_NOT_ATTACH     : 0,
	kNEWTAB_COMMAND_ATTACH_TO_CURRENT : 1,
	kNEWTAB_COMMAND_ATTACH_TO_PARENT  : 2,
  
/* Tree Style Tabの初期化が行われる前に復元されたセッションについてツリー構造を復元 */ 
	
	_restoringTabs : [], 
 
	onTabRestored : function TSTService_onTabRestored(aEvent) 
	{
		this._restoringTabs.push(aEvent.originalTarget);
	},
 
	processRestoredTabs : function TSTService_processRestoredTabs() 
	{
		this._restoringTabs.forEach(function(aTab) {
			try {
				var b = this.getTabBrowserFromChild(aTab);
				if (b) b.treeStyleTab.restoreStructure(aTab, true);
			}
			catch(e) {
			}
		}, this);
		this._restoringTabs = [];
	},
  
/* Commands */ 
	
	setTabbarWidth : function TSTService_setTabbarWidth(aWidth, aForceExpanded) /* PUBLIC API */ 
	{
		gBrowser.treeStyleTab.autoHide.setWidth(aWidth, aForceExpanded);
	},
 
	setContentWidth : function TSTService_setContentWidth(aWidth, aKeepWindowSize) /* PUBLIC API */ 
	{
		var treeStyleTab = gBrowser.treeStyleTab;
		var strip = treeStyleTab.tabStrip;
		var tabbarWidth = treeStyleTab.splitterWidth + (treeStyleTab.isVertical ? strip.boxObject.width : 0 );
		var contentWidth = gBrowser.boxObject.width - tabbarWidth;
		if (aKeepWindowSize ||
			window.fullScreen ||
			window.windowState != Components.interfaces.nsIDOMChromeWindow.STATE_NORMAL) {
			this.setTabbarWidth(Math.max(10, gBrowser.boxObject.width - aWidth));
		}
		else if (tabbarWidth + aWidth <= screen.availWidth) {
			window.resizeBy(aWidth - contentWidth, 0);
		}
		else {
			window.resizeBy(screen.availWidth - window.outerWidth, 0);
			this.setTabbarWidth(gBrowser.boxObject.width - aWidth);
		}
	},
 
	get autoHideWindow() 
	{
		if (!this._autoHideWindow) {
			let ns = {};
			Components.utils.import('resource://treestyletab-modules/autoHide.js', ns);
			this._autoHideWindow = new ns.AutoHideWindow(window);
		}
		return this._autoHideWindow;
	},
 
	toggleAutoHide : function TSTService_toggleAutoHide(aTabBrowser) /* PUBLIC API, for backward compatibility */ 
	{
		this.autoHideWindow.toggleMode(aTabBrowser || this.browser);
	},
 
	toggleFixed : function TSTService_toggleFixed(aTabBrowser) /* PUBLIC API */ 
	{
		var b = aTabBrowser || this.browser;
		var orient = b.treeStyleTab.isVertical ? 'vertical' : 'horizontal' ;

		var newFixed = b.getAttribute(this.kFIXED+'-'+orient) != 'true';
		this.setTabbrowserAttribute(this.kFIXED+'-'+orient, newFixed || null, this.mTabBrowser);
		b.treeStyleTab.fixed = newFixed;
		this.setTreePref('tabbar.fixed.'+orient, newFixed);

		b.treeStyleTab.updateTabbarState();
	},
 
	removeTabSubtree : function TSTService_removeTabSubtree(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = this.gatherSubtreeMemberTabs(aTabOrTabs, aOnlyChildren);
		if (!this.warnAboutClosingTabs(tabs.length))
			return;

		if (aOnlyChildren)
			tabs = this.gatherSubtreeMemberTabs(aTabOrTabs);

		this.splitTabsToSubtrees(tabs).forEach(function(aTabs) {
			if (!this.fireTabSubtreeClosingEvent(aTabs[0], aTabs))
				return;
			var b = this.getTabBrowserFromChild(aTabs[0]);
			if (aOnlyChildren)
				aTabs = aTabs.slice(1);
			if (!aTabs.length)
				return;
			this.stopRendering();
			this.markAsClosedSet(aTabs);
			for (var i = aTabs.length-1; i > -1; i--)
			{
				b.removeTab(aTabs[i], { animate : true });
			}
			this.startRendering();
			this.fireTabSubtreeClosedEvent(b, aTabs[0], aTabs)
		}, this);
	},
	removeTabSubTree : function() { return this.removeTabSubtree.apply(this, arguments); }, // obsolete, for backward compatibility
	
	fireTabSubtreeClosingEvent : function TSTService_fireTabSubtreeClosingEvent(aParentTab, aClosedTabs) 
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
 
	fireTabSubtreeClosedEvent : function TSTService_fireTabSubtreeClosedEvent(aTabBrowser, aParentTab, aClosedTabs) 
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
 
	warnAboutClosingTabSubtreeOf : function TSTService_warnAboutClosingTabSubtreeOf(aTab) 
	{
		if (!this.shouldCloseTabSubtreeOf(aTab))
			return true;

		var tabs = [aTab].concat(this.getDescendantTabs(aTab));
		return this.warnAboutClosingTabs(tabs.length);
	},
	warnAboutClosingTabSubTreeOf : function() { return this.warnAboutClosingTabSubtreeOf.apply(this, arguments); }, // obsolete, for backward compatibility
 
	warnAboutClosingTabs : function TSTService_warnAboutClosingTabs(aTabsCount) 
	{
		if (
			aTabsCount <= 1 ||
			!this.getPref('browser.tabs.warnOnClose')
			)
			return true;
		var checked = { value:true };
		window.focus();
		var shouldClose = this.PromptService.confirmEx(window,
				this.tabbrowserBundle.getString('tabs.closeWarningTitle'),
				this.tabbrowserBundle.getFormattedString('tabs.closeWarningMultipleTabs', [aTabsCount]),
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_0) +
				(this.PromptService.BUTTON_TITLE_CANCEL * this.PromptService.BUTTON_POS_1),
				this.tabbrowserBundle.getString('tabs.closeButtonMultiple'),
				null, null,
				this.tabbrowserBundle.getString('tabs.closeWarningPromptMe'),
				checked
			) == 0;
		if (shouldClose && !checked.value)
			this.setPref('browser.tabs.warnOnClose', false);
		return shouldClose;
	},
  
	reloadTabSubtree : function TSTService_reloadTabSubtree(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = this.gatherSubtreeMemberTabs(aTabOrTabs, aOnlyChildren);
		var b = this.getTabBrowserFromChild(tabs[0]);
		for (var i = tabs.length-1; i > -1; i--)
		{
			b.reloadTab(tabs[i]);
		}
	},
	reloadTabSubTree : function() { return this.reloadTabSubtree.apply(this, arguments); }, // obsolete, for backward compatibility
 
	createSubtree : function TSTService_createSubtree(aTabs) 
	{
		aTabs = this.getRootTabs(aTabs);
		if (!aTabs.length) return;

		var b = this.getTabBrowserFromChild(aTabs[0]);

		var parent = this.getParentTab(aTabs[0]);

		var next = aTabs[0];
		while (
			(next = this.getNextSiblingTab(next)) &&
			aTabs.indexOf(next) > -1
		);

		var root = this.getTreePref('createSubtree.underParent') ?
					b.addTab(this.getGroupTabURI()) :
					aTabs.shift() ;
		window.setTimeout(function(aSelf) {
			aTabs.forEach(function(aTab) {
				b.treeStyleTab.attachTabTo(aTab, root);
				b.treeStyleTab.collapseExpandTab(aTab, false);
			}, aSelf);
			if (parent) {
				b.treeStyleTab.attachTabTo(root, parent, {
					insertBefore : next
				});
			}
			else if (next) {
				b.treeStyleTab.moveTabSubtreeTo(root, next._tPos);
			}
		}, 0, this);
	},
	createSubTree : function() { return this.createSubtree.apply(this, arguments); }, // obsolete, for backward compatibility
	
	canCreateSubtree : function TSTService_canCreateSubtree(aTabs) 
	{
		aTabs = this.getRootTabs(aTabs);
		if (aTabs.length < 2) return false;

		var lastParent = this.getParentTab(aTabs[0]);
		for (let i = 1, maxi = aTabs.length-1; i < maxi; i++)
		{
			let parent = this.getParentTab(aTabs[i]);
			if (!lastParent || parent != lastParent) return true;
			lastParent = parent;
		}
		return this.getChildTabs(lastParent).length != aTabs.length;
	},
	canCreateSubTree : function() { return this.canCreateSubtree.apply(this, arguments); }, // obsolete, for backward compatibility
 
	getRootTabs : function TSTService_getRootTabs(aTabs) 
	{
		var roots = [];
		if (!aTabs || !aTabs.length) return roots;
		aTabs = this.cleanUpTabsArray(aTabs);
		aTabs.forEach(function(aTab) {
			var parent = this.getParentTab(aTab);
			if (parent && aTabs.indexOf(parent) > -1) return;
			roots.push(aTab);
		}, this);
		return roots;
	},
  
	collapseExpandAllSubtree : function TSTService_collapseExpandAllSubtree(aCollapse) 
	{
		this.ObserverService.notifyObservers(
			window,
			this.kTOPIC_COLLAPSE_EXPAND_ALL,
			(aCollapse ? 'collapse' : 'open' )
		);
	},
 
	promoteTab : function TSTService_promoteTab(aTab) /* PUBLIC API */ 
	{
		var b = this.getTabBrowserFromChild(aTab);
		var sv = b.treeStyleTab;

		var parent = sv.getParentTab(aTab);
		if (!parent) return;

		var nextSibling = sv.getNextSiblingTab(parent);

		var grandParent = sv.getParentTab(parent);
		if (grandParent) {
			sv.attachTabTo(aTab, grandParent, {
				insertBefore : nextSibling
			});
		}
		else {
			sv.partTab(aTab);
			let index = nextSibling ? nextSibling._tPos : b.mTabContainer.childNodes.length ;
			if (index > aTab._tPos) index--;
			b.moveTabTo(aTab, index);
		}
	},
	
	promoteCurrentTab : function TSTService_promoteCurrentTab() /* PUBLIC API */ 
	{
		this.promoteTab(this.browser.selectedTab);
	},
  
	demoteTab : function TSTService_demoteTab(aTab) /* PUBLIC API */ 
	{
		var b = this.getTabBrowserFromChild(aTab);
		var sv = b.treeStyleTab;

		var previous = this.getPreviousSiblingTab(aTab);
		if (previous)
			sv.attachTabTo(aTab, previous);
	},
	
	demoteCurrentTab : function TSTService_demoteCurrentTab() /* PUBLIC API */ 
	{
		this.demoteTab(this.browser.selectedTab);
	},
  
	expandTreeAfterKeyReleased : function TSTService_expandTreeAfterKeyReleased(aTab) 
	{
		if (this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut')) return;
		this._tabShouldBeExpandedAfterKeyReleased = aTab || null;
	},
	_tabShouldBeExpandedAfterKeyReleased : null,
 
	removeAllTabsBut : function TSTService_removeAllTabsBut(aTab) 
	{
		var keepTabs = [aTab].concat(this.getDescendantTabs(aTab));
		var b = this.getTabBrowserFromChild(aTab);
		var closeTabs = this.getTabsArray(b)
					.filter(function(aTab) {
						return keepTabs.indexOf(aTab) < 0;
					});

		if (!this.warnAboutClosingTabs(closeTabs.length))
			return;

		this.stopRendering();
		this.markAsClosedSet(closeTabs);
		closeTabs.reverse().forEach(function(aTab) {
			b.removeTab(aTab);
		});
		this.startRendering();
	},
 
	// For backward compatibility. You should use DOM event to block TST's focus handling.
	registerTabFocusAllowance : function TSTService_registerTabFocusAllowance(aProcess) /* PUBLIC API */ 
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
		window.addEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB, listener, false);
		this._tabFocusAllowance.push(listener);
	},
	_tabFocusAllowance : [],
 
	tearOffSubtreeFromRemote : function TSTService_tearOffSubtreeFromRemote() 
	{
		var remoteTab = window.arguments[0];
		var remoteWindow  = remoteTab.ownerDocument.defaultView;
		var remoteService = remoteWindow.TreeStyleTabService;
		var remoteMultipleTabService = remoteWindow.MultipleTabService;
		if (remoteService.hasChildTabs(remoteTab) ||
			(remoteMultipleTabService && remoteMultipleTabService.isSelected(remoteTab))) {
			var remoteBrowser = remoteService.getTabBrowserFromChild(remoteTab);
			if (remoteBrowser.treeStyleTab.tabbarDNDObserver.isDraggingAllTabs(remoteTab)) {
				window.close();
			}
			else {
				var actionInfo = {
						action : this.kACTIONS_FOR_DESTINATION | this.kACTION_IMPORT
					};
				window.setTimeout(function() {
					var blankTab = gBrowser.selectedTab;
					gBrowser.treeStyleTab.tabbarDNDObserver.performDrop(actionInfo, remoteTab);
					window.setTimeout(function() {
						gBrowser.removeTab(blankTab);

						remoteTab = null;
						remoteBrowser = null;
						remoteWindow = null
						remoteService = null;
						remoteMultipleTabService = null;
					}, 0);
				}, 0);
			}
			return true;
		}
		return false;
	},
	tearOffSubTreeFromRemote : function() { return this.tearOffSubtreeFromRemote.apply(this, arguments); }, // obsolete, for backward compatibility
 
	onPrintPreviewEnter : function TSTService_onPrintPreviewEnter() 
	{
		var event = document.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, true, false);
		document.documentElement.dispatchEvent(event);

		// for backward compatibility
		event = document.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED.replace(/^nsDOM/, ''), true, false);
		document.documentElement.dispatchEvent(event);
	},
 
	onPrintPreviewExit : function TSTService_onPrintPreviewExit() 
	{
		var event = document.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED, true, false);
		document.documentElement.dispatchEvent(event);

		// for backward compatibility
		event = document.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED.replace(/^nsDOM/, ''), true, false);
		document.documentElement.dispatchEvent(event);
	},
  
	observe : function TSTService_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onPrefChange(aData);
				return;
		}
	},
	get restoringTree() {
		return this.restoringCount > 0;
	},
	restoringCount : 0,
 
/* Pref Listener */ 
	
	domains : [ 
		'extensions.treestyletab',
		'browser.ctrlTab.previews'
	],
 
	onPrefChange : function TSTService_onPrefChange(aPrefName) 
	{
		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.autoHide.mode':
				// don't set on this time, because appearance of all tabbrowsers are not updated yet.
				// this.autoHide.mode = this.getTreePref('tabbar.autoHide.mode');
			case 'extensions.treestyletab.tabbar.autoShow.accelKeyDown':
			case 'extensions.treestyletab.tabbar.autoShow.tabSwitch':
			case 'extensions.treestyletab.tabbar.autoShow.feedback':
				this.autoHideWindow.updateKeyListeners(window);
				break;

			case 'extensions.treestyletab.tabbar.style':
			case 'extensions.treestyletab.tabbar.position':
				this.preLoadImagesForStyle([
					this.getPref('extensions.treestyletab.tabbar.style'),
					this.position
				].join('-'));
				break;

			case 'browser.ctrlTab.previews':
				this.autoHideWindow.updateKeyListeners(window);
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
	},
  
}; 
  
(function() { 
	var namespace = {};
	Components.utils.import(
		'resource://treestyletab-modules/utils.js',
		namespace
	);
	TreeStyleTabService.__proto__ = TreeStyleTabService.utils = namespace.TreeStyleTabUtils;
	TreeStyleTabService.utils.init();
})();
 
