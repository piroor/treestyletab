Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabUtils', 'resource://treestyletab-modules/utils.js');

var TreeStyleTabWindowHelper = { 
	runningDelayedStartup : false,
	
	get service() 
	{
		return TreeStyleTabService;
	},
 
	preInit : function TSTWH_preInit() 
	{
		gBrowserInit.__treestyletab___delayedStartup = gBrowserInit._delayedStartup;
		gBrowserInit._delayedStartup = function(...aArgs) {
			TreeStyleTabWindowHelper.runningDelayedStartup = true;
			var retVal = gBrowserInit.__treestyletab___delayedStartup.apply(this, aArgs);
			TreeStyleTabWindowHelper.runningDelayedStartup = false;
			return retVal;
		};

		nsBrowserAccess.prototype.__treestyletab__openURI = nsBrowserAccess.prototype.openURI;
		nsBrowserAccess.prototype.openURI = function(aURI, aOpener, aWhere, aContext) {
			var where = aWhere;
			if (where === Ci.nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW) {
				let isExternal = aContext === Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL;
				let overridePref = TreeStyleTabUtils.prefs.getPref('browser.link.open_newwindow.override.external');
				if (isExternal && overridePref !== null)
					where = overridePref;
				else
					where = TreeStyleTabUtils.prefs.getPref('browser.link.open_newwindow');
			}
			TreeStyleTabService.onBeforeBrowserAccessOpenURI(aOpener, where);
			return nsBrowserAccess.prototype.__treestyletab__openURI.call(this, aURI, aOpener, aWhere, aContext);
		};

		nsBrowserAccess.prototype.__treestyletab__openURIInFrame = nsBrowserAccess.prototype.openURIInFrame;
		nsBrowserAccess.prototype.openURIInFrame = function(aURI, aParams, aWhere, aContext) {
			if (aWhere === Ci.nsIBrowserDOMWindow.OPEN_NEWTAB)
				TreeStyleTabService.onBeforeBrowserAccessOpenURI(aParams, aWhere, aContext);
			return nsBrowserAccess.prototype.__treestyletab__openURIInFrame.call(this, aURI, aParams, aWhere, aContext);
		};

		if ('TabsInTitlebar' in window) {
			TreeStyleTabUtils.doPatching(TabsInTitlebar._update, 'TabsInTitlebar._update', function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					/let fullTabsHeight = /,
					'$& gBrowser.treeStyleTab.position != "top" ? 0 : '
				));
			}, 'treeStyleTab');
		}

		window.__treestyletab__BrowserOpenTab = window.BrowserOpenTab;
		window.BrowserOpenTab = function(...aArgs) {
			gBrowser.treeStyleTab.onBeforeNewTabCommand();
			return window.__treestyletab__BrowserOpenTab.apply(this, aArgs);
		};

		window.__treestyletab__undoCloseTab = window.undoCloseTab;
		window.undoCloseTab = function(...aArgs) {
			gBrowser.__treestyletab__doingUndoCloseTab = true;
			var tab = window.__treestyletab__undoCloseTab.apply(this, aArgs);
			if (tab)
				tab.__treestyletab__restoredByUndoCloseTab = true;
			setTimeout(function() {
				delete gBrowser.__treestyletab__doingUndoCloseTab;
			}, 0);
			return tab;
		};

		window.__treestyletab__openLinkIn = window.openLinkIn;
		window.openLinkIn = function(aUrl, aWhere, aParams, ...aArgs) {
			if (window.__treestyletab__openLinkIn_extraParams)
				Object.keys(window.__treestyletab__openLinkIn_extraParams).forEach(function(aKey) {
					aParams[aKey] = window.__treestyletab__openLinkIn_extraParams[aKey];
				});
			try {
				TreeStyleTabService.onBeforeOpenLinkWithTab(gBrowser.selectedTab, aParams);
				return window.__treestyletab__openLinkIn.apply(this, [aUrl, aWhere, aParams].concat(aArgs));
			}
			finally {
				delete window.__treestyletab__openLinkIn_extraParams;
			}
		};

		window.__treestyletab__handleLinkClick = window.handleLinkClick;
		window.handleLinkClick = function(aEvent, aHref, aLinkNode, ...aArgs) {
			window.__treestyletab__openLinkIn_extraParams = {
				event    : aEvent,
				linkNode : aLinkNode
			};
			try {
				return window.__treestyletab__handleLinkClick.apply(this, [aEvent, aHref, aLinkNode].concat(aArgs));
			}
			finally {
				delete window.__treestyletab__openLinkIn_extraParams;
			}
		};

		this.overrideExtensionsPreInit(); // windowHelperHacks.js
	},
 
	onBeforeBrowserInit : function TSTWH_onBeforeBrowserInit() 
	{
		this.overrideExtensionsBeforeBrowserInit(); // windowHelperHacks.js
		this.overrideGlobalFunctions();

		// Replacing of gBrowserInit._delayedStartup() with eval()
		// breaks the variable scope of the function and break its
		// functionality completely.
		// Instead, I change the behavior of the method only at the
		// startup process.
		gBrowser.__treestyletab__swapBrowsersAndCloseOther = gBrowser.swapBrowsersAndCloseOther;
		gBrowser.swapBrowsersAndCloseOther = function(aOurTab, aRemoteTab, ...aArgs) {
			if (TreeStyleTabWindowHelper.runningDelayedStartup &&
				TreeStyleTabService.tearOffSubtreeFromRemote(aRemoteTab))
				return;
			return gBrowser.__treestyletab__swapBrowsersAndCloseOther.apply(this, [aOurTab, aRemoteTab].concat(aArgs));
		};
	},
 
	onAfterBrowserInit : function TSTWH_onAfterBrowserInit() 
	{
		this.overrideExtensionsAfterBrowserInit(); // windowHelperHacks.js
	},
	
	updateTabDNDObserver : function TSTWH_updateTabDNDObserver(aObserver) 
	{
		var strip = this.service.getTabStrip(aObserver) ||
					gBrowser.mStrip // fallback to the default strip, for Tab Mix Plus;

		if (
			aObserver.tabContainer &&
			aObserver.tabContainer.tabbrowser == aObserver
			)
			aObserver = aObserver.tabContainer;

		if (typeof aObserver._setEffectAllowedForDataTransfer === 'function') { // Firefox 43 and older
			TreeStyleTabUtils.doPatching(aObserver._setEffectAllowedForDataTransfer, aObserver+'._setEffectAllowedForDataTransfer', function(aName, aSource) {
				return eval('aObserver._setEffectAllowedForDataTransfer = '+aSource.replace(
					'{',
					'{ var TSTTabBrowser = this instanceof Element ? (this.tabbrowser || this) : gBrowser ; var TST = TSTTabBrowser.treeStyleTab;'
				).replace(
					/\.screenX/g, '[TST.screenPositionProp]'
				).replace(
					/\.width/g, '[TST.sizeProp]'
				).replace(
					/(return (?:true|dt.effectAllowed = "copyMove");)/,
					'if (!TST.tabbarDNDObserver.canDropTab(arguments[0])) {\n' +
					'  return dt.effectAllowed = "none";\n' +
					'}\n' +
					'$1'
				).replace(
					'sourceNode.parentNode == this &&',
					'$& TST.getTabFromEvent(event) == sourceNode &&'
				));
			}, 'TST');
		}
		else { // Firefox 44 and later
			aObserver.__treestyletab__getDropEffectForTabDrag = aObserver._getDropEffectForTabDrag;
			aObserver._getDropEffectForTabDrag = function(...aArgs) {
				var effects = aObserver.__treestyletab__getDropEffectForTabDrag.apply(this, aArgs);
				if (effects === 'copy' || effects === 'move') {
					let TSTTabBrowser = this instanceof Element ? (this.tabbrowser || this) : gBrowser ;
					var TST = TSTTabBrowser.treeStyleTab
					if (!TST.tabbarDNDObserver.canDropTab(aArgs[0]))
						effects = 'none';
				}
				return effects;
			};
		}
	},
 
	overrideGlobalFunctions : function TSTWH_overrideGlobalFunctions() 
	{
		this.initToolbarItems();

		nsContextMenu.prototype.__treestyletab__openLinkInTab = nsContextMenu.prototype.openLinkInTab;
		nsContextMenu.prototype.openLinkInTab = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(this.target.ownerDocument.defaultView);
			return nsContextMenu.prototype.__treestyletab__openLinkInTab.apply(this, aArgs);
		};

		nsContextMenu.prototype.__treestyletab__openFrameInTab = nsContextMenu.prototype.openFrameInTab;
		nsContextMenu.prototype.openFrameInTab = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(this.target.ownerDocument.defaultView);
			return nsContextMenu.prototype.__treestyletab__openFrameInTab.apply(this, aArgs);
		};

		nsContextMenu.prototype.__treestyletab__viewMedia = nsContextMenu.prototype.viewMedia;
		nsContextMenu.prototype.viewMedia = function(aEvent) {
			TreeStyleTabService.onBeforeViewMedia(aEvent, this.target.ownerDocument.defaultView);
			return nsContextMenu.prototype.__treestyletab__viewMedia.call(this, aEvent);
		};

		nsContextMenu.prototype.__treestyletab__viewBGImage = nsContextMenu.prototype.viewBGImage;
		nsContextMenu.prototype.viewBGImage = function(aEvent) {
			TreeStyleTabService.onBeforeViewMedia(aEvent, this.target.ownerDocument.defaultView);
			return nsContextMenu.prototype.__treestyletab__viewBGImage.call(this, aEvent);
		};

		nsContextMenu.prototype.__treestyletab__addDictionaries = nsContextMenu.prototype.addDictionaries;
		nsContextMenu.prototype.addDictionaries = function(...aArgs) {
			var newWindowPref = TreeStyleTabUtils.prefs.getPref('browser.link.open_newwindow');
			var where = newWindowPref === 3 ? 'tab' : 'window' ;
			TreeStyleTabService.onBeforeOpenLink(where, this.target.ownerDocument.defaultView);
			return nsContextMenu.prototype.__treestyletab__addDictionaries.apply(this, aArgs);
		};

		nsContextMenu.prototype.__treestyletab__viewPartialSource = nsContextMenu.prototype.viewPartialSource;
		nsContextMenu.prototype.viewPartialSource = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(this.target.ownerDocument.defaultView);
			return nsContextMenu.prototype.__treestyletab__viewPartialSource.apply(this, aArgs);
		};

		nsContextMenu.prototype.__treestyletab__viewFrameSource = nsContextMenu.prototype.viewFrameSource;
		nsContextMenu.prototype.viewFrameSource = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(this.target.ownerDocument.defaultView);
			return nsContextMenu.prototype.__treestyletab__viewFrameSource.apply(this, aArgs);
		};

		window.__treestyletab__BrowserViewSource = window.BrowserViewSource;
		window.BrowserViewSource = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(aArgs[0]);
			return window.__treestyletab__BrowserViewSource.apply(this, aArgs);
		};

		BrowserSearch.__treestyletab__loadSearch = BrowserSearch._loadSearch;
		BrowserSearch._loadSearch = function(aSearchText, aUseNewTab, aPurpose) {
			TreeStyleTabService.onBeforeBrowserSearch(aSearchText, aUseNewTab);
			return BrowserSearch.__treestyletab__loadSearch.call(this, aSearchText, aUseNewTab, aPurpose);
		};

		[
			{ owner: window.permaTabs && window.permaTabs.utils && window.permaTabs.utils.wrappedFunctions,
			  name:  'window.contentAreaClick' },
			{ owner: window,
			  name:  '__contentAreaClick' },
			{ owner: window,
			  name:  '__ctxextensions__contentAreaClick' },
			{ owner: window,
			  name:  'contentAreaClick' }
		].forEach(function(aTarget) {
			var name = aTarget.name;
			var owner = aTarget.owner;
			var func = owner && owner[name];
			var source = func && func.toString();
			if (!func ||
				!/^\(?function contentAreaClick/.test(source) ||
				// for Tab Utilities, etc. Some addons insert openNewTabWith() to the function.
				// (calls for the function is not included by Firefox default.)
				!/(openNewTabWith\()/.test(source))
				return;
			let original = '__treestyletab__' + name;
			owner[original] = owner[name];
			owner[name] = function(aEvent, aIsPanelClick, ...aArgs) {
				TreeStyleTabService.onBeforeOpenNewTabByThirdParty(aEvent.target.ownerDocument.defaultView);
				return owner[original].apply(this, [aEvent, aIsPanelClick].concat(aArgs));
			};
		}, this);

		window.__treestyletab__duplicateTabIn = window.duplicateTabIn;
		window.duplicateTabIn = function(aTab, where, delta) {
			gBrowser.treeStyleTab.onBeforeTabDuplicate(aTab, where, delta);
			return window.__treestyletab__duplicateTabIn.call(this, aTab, where, delta);
		};

		window.__treestyletab__BrowserGoHome = window.BrowserGoHome;
		window.BrowserGoHome = function(aEvent) {
			TreeStyleTabService.onBeforeGoHome(aEvent, gBrowser);
			return window.__treestyletab__BrowserGoHome.call(this, aEvent);
		};

		FeedHandler.__treestyletab__loadFeed = FeedHandler.loadFeed;
		FeedHandler.loadFeed = function(aHref, aEvent) {
			TreeStyleTabService.onBeforeViewMedia(aEvent, gBrowser);
			return FeedHandler.__treestyletab__loadFeed.call(this, aHref, aEvent);
		};

		if ('showNavToolbox' in FullScreen) { // for Firefox 40 or later
			FullScreen.__treestyletab__showNavToolbox = FullScreen.showNavToolbox;
			FullScreen.showNavToolbox = function(...aArgs) {
				var beforeCollapsed = this._isChromeCollapsed;
				var retVal = FullScreen.__treestyletab__showNavToolbox.apply(this, aArgs);
				if (beforeCollapsed !== this._isChromeCollapsed)
					gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN);
				return retVal;
			};

			FullScreen.__treestyletab__hideNavToolbox = FullScreen.hideNavToolbox;
			FullScreen.hideNavToolbox = function(...aArgs) {
				var beforeCollapsed = this._isChromeCollapsed;
				var retVal = FullScreen.__treestyletab__hideNavToolbox.apply(this, aArgs);
				if (beforeCollapsed !== this._isChromeCollapsed)
					gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN);
				return retVal;
			};
		}
		else if ('mouseoverToggle' in FullScreen) { // for Firefox 39 or older
			FullScreen.__treestyletab__mouseoverToggle = FullScreen.mouseoverToggle;
			FullScreen.mouseoverToggle = function(...aArgs) {
				var beforeCollapsed = this._isChromeCollapsed;
				var retVal = FullScreen.__treestyletab__mouseoverToggle.apply(this, aArgs);
				if (beforeCollapsed !== this._isChromeCollapsed)
					gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN);
				return retVal;
			};
		}

		FullScreen.__treestyletab__toggle = FullScreen.toggle;
		FullScreen.toggle = function(...aArgs) {
			var enterFS = window.fullScreen;
			var event = aArgs[0];
			if (event && event.type == 'fullscreen')
				enterFS = !enterFS;
			gBrowser.treeStyleTab.onBeforeFullScreenToggle(enterFS);
			return FullScreen.__treestyletab__toggle.apply(this, aArgs);
		};

		PrintUtils.__treestyletab__printPreview = PrintUtils.printPreview;
		PrintUtils.printPreview = function(...aArgs) {
			TreeStyleTabService.onPrintPreviewEnter();
			return PrintUtils.__treestyletab__printPreview.apply(this, aArgs);
		};
		PrintUtils.__treestyletab__exitPrintPreview = PrintUtils.exitPrintPreview;
		PrintUtils.exitPrintPreview = function(...aArgs) {
			TreeStyleTabService.onPrintPreviewExit();
			return PrintUtils.__treestyletab__exitPrintPreview.apply(this, aArgs);
		};

		SidebarUI.__treestyletab__show = SidebarUI.show;
		SidebarUI.show = function(...aArgs) {
			var opened = this.isOpen;
			var width = this.browser.boxObject.width;
			return SidebarUI.__treestyletab__show.apply(this, aArgs)
					.then((function(aResult) {
						if (opened !== this.isOpen ||
							width !== this.browser.boxObject.width)
							gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_TOGGLE_SIDEBAR);
						return aResult;
					}).bind(this));
		};
		SidebarUI.__treestyletab__hide = SidebarUI.hide;
		SidebarUI.hide = function(...aArgs) {
			var opened = this.isOpen;
			var width = this.browser.boxObject.width;
			var retVal = SidebarUI.__treestyletab__hide.apply(this, aArgs);
			if (opened !== this.isOpen ||
				width !== this.browser.boxObject.width)
				gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_TOGGLE_SIDEBAR);
			return retVal;
		};
	},
	_splitFunctionNames : function TSTWH__splitFunctionNames(aString)
	{
		return String(aString)
				.split(/\s+/)
				.map(function(aString) {
					return aString
							.replace(/\/\*.*\*\//g, '')
							.replace(/\/\/.+$/, '')
							.trim();
				});
	},
	_getFunction : function TSTWH__getFunction(aFunc)
	{
		var func;
		try {
			eval('func = '+aFunc);
		}
		catch(e) {
			return null;
		}
		return func;
	},
 
	initToolbarItems : function TSTWH_initToolbarItems() 
	{
		let { ReferenceCounter } = Components.utils.import('resource://treestyletab-modules/ReferenceCounter.js', {});

		var searchbar = document.getElementById('searchbar');
		if (searchbar &&
			searchbar.doSearch &&
			!searchbar.__treestyletab__original_doSearch) {
			searchbar.__treestyletab__original_doSearch = searchbar.doSearch;
			searchbar.doSearch = function(...aArgs) {
				TreeStyleTabService.onBeforeBrowserSearch(aArgs[0]);
				var retVal = searchbar.__treestyletab__original_doSearch.apply(this, aArgs);
				TreeStyleTabService.stopToOpenChildTab();
				return retVal;
			};
		}

		var goButton = document.getElementById('urlbar-go-button');
		if (goButton) {
			goButton.parentNode.addEventListener('click', this.service, true);
			ReferenceCounter.add('goButton.parentNode,click,this.service,true');
		}

		var tabbar = this.service.getTabStrip(this.service.browser);
		tabbar.addEventListener('click', this.service, true);
		ReferenceCounter.add('tabbar,click,this.service,true');

		var newTabButton = document.getElementById('new-tab-button');
		var nsIDOMNode = Ci.nsIDOMNode;
		if (newTabButton &&
			!(tabbar.compareDocumentPosition(newTabButton) & nsIDOMNode.DOCUMENT_POSITION_CONTAINED_BY)) {
			newTabButton.parentNode.addEventListener('click', this.service, true);
			ReferenceCounter.add('newTabButton.parentNode,click,this.service,true');
		}

		this.service.updateAllTabsButton(gBrowser);
	},
 
	destroyToolbarItems : function TSTWH_destroyToolbarItems() 
	{
		let { ReferenceCounter } = Components.utils.import('resource://treestyletab-modules/ReferenceCounter.js', {});

		var goButton = document.getElementById('urlbar-go-button');
		if (goButton) {
			goButton.parentNode.removeEventListener('click', this.service, true);
			ReferenceCounter.remove('goButton.parentNode,click,this.service,true');
		}

		var tabbar = this.service.getTabStrip(this.service.browser);
		tabbar.removeEventListener('click', this.service, true);
		ReferenceCounter.remove('tabbar,click,this.service,true');

		var newTabButton = document.getElementById('new-tab-button');
		var nsIDOMNode = Ci.nsIDOMNode;
		if (newTabButton &&
			!(tabbar.compareDocumentPosition(newTabButton) & Ci.nsIDOMNode.DOCUMENT_POSITION_CONTAINED_BY)) {
			newTabButton.parentNode.removeEventListener('click', this.service, true);
			ReferenceCounter.remove('newTabButton.parentNode,click,this.service,true');
		}

		var allTabsButton = document.getElementById('alltabs-button');
		if (allTabsButton && allTabsButton.hasChildNodes())
			allTabsButton.firstChild.setAttribute('position', 'after_end');
	},
  
	initTabbrowserMethods : function TSTWH_initTabbrowserMethods(aTabBrowser) 
	{
		var b = aTabBrowser;

		TreeStyleTabUtils.doPatching(b.moveTabForward, 'b.moveTabForward', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'if (nextTab)',
				'(function() {\n' +
				'  let descendants = this.treeStyleTab.getDescendantTabs(this.mCurrentTab);\n' +
				'  if (descendants.indexOf(nextTab) > -1) {\n' +
				'    let lastDescendant = this.treeStyleTab.getLastDescendantTab(this.mCurrentTab);\n' +
				'    nextTab = this.treeStyleTab.getNextVisibleTab(lastDescendant || this.mCurrentTab);\n' +
				'  }\n' +
				'  if (this.treeStyleTab.hasChildTabs(nextTab) && this.treeStyleTab.isSubtreeCollapsed(nextTab)) {\n' +
				'    nextTab = this.treeStyleTab.getLastDescendantTab(nextTab);\n' +
				'  }\n' +
				'}).call(this);' +
				'$&'
			).replace(
				'this.moveTabToStart();',
				'(function() {\n' +
				'  this.treeStyleTab.internallyTabMovingCount++;\n' +
				'  let parentTab = this.treeStyleTab.getParentTab(this.mCurrentTab);\n' +
				'  if (parentTab) {\n' +
				'    this.moveTabTo(this.mCurrentTab, this.treeStyleTab.getFirstChildTab(parentTab)._tPos);\n' +
				'    this.mCurrentTab.focus();\n' +
				'  }\n' +
				'  else {\n' +
				'    $&\n' +
				'  }\n' +
				'  this.treeStyleTab.internallyTabMovingCount--;\n' +
				'}).call(this);'
			));
		}, 'treeStyleTab');

		TreeStyleTabUtils.doPatching(b.moveTabBackward, 'b.moveTabBackward', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'if (previousTab)',
				'(function() {\n' +
				'  previousTab = this.treeStyleTab.getPreviousVisibleTab(this.mCurrentTab);\n' +
				'}).call(this);' +
				'$&'
			).replace(
				'this.moveTabToEnd();',
				'(function() {\n' +
				'  this.treeStyleTab.internallyTabMovingCount++;\n' +
				'  let parentTab = this.treeStyleTab.getParentTab(this.mCurrentTab);\n' +
				'  if (parentTab) {\n' +
				'    this.moveTabTo(this.mCurrentTab, this.treeStyleTab.getLastChildTab(parentTab)._tPos);\n' +
				'    this.mCurrentTab.focus();\n' +
				'  }\n' +
				'  else {\n' +
				'    $&\n' +
				'  }\n' +
				'  this.treeStyleTab.internallyTabMovingCount--;\n' +
				'}).call(this);'
			));
		}, 'treeStyleTab');

		b.__treestyletab__loadTabs = b.loadTabs;
		b.loadTabs = function(aURIs, aLoadInBackground, aReplace, ...aArgs) {
			if (aReplace)
				this.treeStyleTab.readyToOpenChildTab(this.selectedTab, true);
			else if (typeof this.treeStyleTab.nextOpenedTabToBeParent == 'undefined')
				this.treeStyleTab.nextOpenedTabToBeParent = true;

			var result;
			var tabs = [];
			var firstTabAdded;
			try {
				tabs = this.treeStyleTab.doAndGetNewTabs((function() {
						result = this.__treestyletab__loadTabs.apply(this, [aURIs, aLoadInBackground, aReplace].concat(aArgs));
					}).bind(this));
				firstTabAdded = tabs[0];
			}
			finally {
				if (!aReplace && firstTabAdded) {
					this.selectedTab = aURIs[0].indexOf('about:treestyletab-group') == 0 ?
						TreeStyleTabService.getNextTab(firstTabAdded) :
						firstTabAdded;
				}
				if (this.treeStyleTab.checkToOpenChildTab(this))
					this.treeStyleTab.stopToOpenChildTab(this);
				delete this.treeStyleTab.nextOpenedTabToBeParent;
			}
			return result;
		};

		TreeStyleTabUtils.doPatching(b._beginRemoveTab, 'b._beginRemoveTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'if (this.tabs.length - this._removingTabs.length == 1) {',
				'if (this.tabs.length - this._removingTabs.length == 1 || this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab)) {'
			).replace(
				'this._removingTabs.length == 0',
				'(this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab) || $&)'
			));
		}, 'treeStyleTab');

		b.__treestyletab__removeCurrentTab = b.removeCurrentTab;
		b.removeCurrentTab = function(...aArgs) {
			if (!b.treeStyleTab.warnAboutClosingTabSubtreeOf(this.selectedTab))
				return;
			return b.__treestyletab__removeCurrentTab.apply(this, aArgs);
		};
	},
 
	initTabbarMethods : function TSTWH_initTabbarMethods(aTabBrowser) 
	{
		var b = aTabBrowser;

		if (!b.mTabContainer.__treestyletab__advanceSelectedTab)
			b.mTabContainer.__treestyletab__advanceSelectedTab = b.mTabContainer.advanceSelectedTab;
		if (b.mTabContainer.advanceSelectedTab.toString() === b.mTabContainer.__treestyletab__advanceSelectedTab.toString())
			b.mTabContainer.advanceSelectedTab = function(...aArgs) {
				if (b.treeStyleTab.handleAdvanceSelectedTab(aArgs[0], aArgs[1]))
					return;
				return b.mTabContainer.__treestyletab__advanceSelectedTab.apply(this, aArgs);
			};

		TreeStyleTabUtils.doPatching(b.mTabContainer._notifyBackgroundTab, 'b.mTabContainer._notifyBackgroundTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{\n' +
				'  var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;\n' +
				'  if (treeStyleTab.scrollToNewTabMode == 0 ||\n' +
				'      treeStyleTab.shouldCancelEnsureElementIsVisible())\n' +
				'    return;'
			).replace(
				/\.screenX/g, '[treeStyleTab.screenPositionProp]'
			).replace(
				/\.width/g, '[treeStyleTab.sizeProp]'
			).replace(
				/\.left/g, '[treeStyleTab.startProp]'
			).replace(
				/\.right/g, '[treeStyleTab.endProp]'

			// replace such codes:
			//   tab = {left: tab.left, right: tab.right};
			).replace(
				/left\s*:/g, 'start:'
			).replace(
				/right\s*:/g, 'end:'
			).replace(
				/((tab|selected)\s*=\s*\{\s*start:[^\}]+\})/g,
				'$1; $2[treeStyleTab.startProp] = $2.start; $2[treeStyleTab.endProp] = $2.end;'

			).replace(
				'!selected ||',
				'$& treeStyleTab.scrollToNewTabMode == 1 && '
			).replace(
				/(\}\)?)$/,
				'treeStyleTab.notifyBackgroundTab(); $1'
			));
		}, 'TreeStyleTabService.getTabBrowserFromChild');

		TreeStyleTabUtils.doPatching(b.tabContainer._getDragTargetTab, 'b.tabContainer._getDragTargetTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				/\.screenX/g, '[this.treeStyleTab.screenPositionProp]'
			).replace(
				/\.width/g, '[this.treeStyleTab.sizeProp]'
			));
		}, 'treeStyleTab');

		TreeStyleTabUtils.doPatching(b.tabContainer._getDropIndex, 'b.tabContainer._getDropIndex', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				/\.screenX/g, '[this.treeStyleTab.screenPositionProp]'
			).replace(
				/\.width/g, '[this.treeStyleTab.sizeProp]'
			));
		}, 'treeStyleTab');

		/**
		 * The default implementation fails to scroll to tab if it is expanding.
		 * So we have to override its effect.
		 */
		{
			let scrollbox = aTabBrowser.treeStyleTab.scrollBox;
				if (!scrollbox.__treestyletab__ensureElementIsVisible) {
				scrollbox.__treestyletab__ensureElementIsVisible = scrollbox.ensureElementIsVisible;
				scrollbox.ensureElementIsVisible = function(...aArgs) {
					if (b.treeStyleTab.shouldCancelEnsureElementIsVisible())
						return;
					let shouldScrollNow = aArgs[1] === false;
					if (b.treeStyleTab.animationEnabled && !shouldScrollNow)
						return b.treeStyleTab.scrollToTab(aArgs[0]);
					scrollbox.__treestyletab__ensureElementIsVisible.apply(this, aArgs);
				};
			}
		}

		{
			let popup = document.getElementById('alltabs-popup');
			TreeStyleTabUtils.doPatching(popup._updateTabsVisibilityStatus, 'popup._updateTabsVisibilityStatus', function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					'{',
					'{ var treeStyleTab = gBrowser.treeStyleTab;'
				).replace(
					/\.screenX/g, '[treeStyleTab.screenPositionProp]'
				).replace(
					/\.width/g, '[treeStyleTab.sizeProp]'
				));
			}, 'treeStyleTab');
		}
	
	},
 
	initTabMethods : function TSTWH_initTabMethods(aTab, aTabBrowser) 
	{
		if (aTab.__treestyletab__toggleMuteAudio &&
			aTab.__treestyletab__toggleMuteAudio.toString() != aTab.toggleMuteAudio.toString())
			return;

		aTab.__treestyletab__toggleMuteAudio = aTab.toggleMuteAudio;
		aTab.toggleMuteAudio = function(...aArgs) {
			if (aTabBrowser.treeStyleTab.handleTabToggleMuteAudio(aTab))
				return;
			return aTab.__treestyletab__toggleMuteAudio.apply(this, aArgs);
		};
	}
 
}; 
  
