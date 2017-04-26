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
			var retVal = gBrowserInit.__treestyletab___delayedStartup.call(this, ...aArgs);
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
		nsBrowserAccess.prototype.openURIInFrame = function(aURI, aParams, aWhere, aContext, ...aArgs) {
			if (aWhere === Ci.nsIBrowserDOMWindow.OPEN_NEWTAB)
				TreeStyleTabService.onBeforeBrowserAccessOpenURI(aParams, aWhere, aContext);
			return nsBrowserAccess.prototype.__treestyletab__openURIInFrame.call(this, aURI, aParams, aWhere, aContext, ...aArgs);
		};

		if ('TabsInTitlebar' in window) {
			TabsInTitlebar.__treestyletab__update = TabsInTitlebar._update;
			TabsInTitlebar._update = function(...aArgs) {
				// See: https://dxr.mozilla.org/mozilla-central/rev/dbe4b47941c7b3d6298a0ead5e40dd828096c808/browser/base/content/browser-tabsintitlebar.js#104
				let result = this.__treestyletab__update(...aArgs);
				if (
					gBrowser.treeStyleTab && // possibly not available while the startup process
					(
						gBrowser.treeStyleTab.position != 'top' ||
						!gBrowser.treeStyleTab.isFixed
					)
					) {
					let heightOfItemsInTitlebar = 0;
					if (AppConstants.platform != 'macosx') {
						let menubar = document.getElementById('toolbar-menubar');
						let style = window.getComputedStyle(menubar);
						heightOfItemsInTitlebar = menubar.boxObject.height +
													parseFloat(style.marginTop) +
													parseFloat(style.marginBottom);
					}
					let marginBottom = heightOfItemsInTitlebar ? '-' + heightOfItemsInTitlebar + 'px' : '' ;
					document.getElementById('titlebar').style.marginBottom =
						document.getElementById('titlebar-content').style.marginBottom = marginBottom;
				}
				return result;
			};
		}

		window.__treestyletab__BrowserOpenTab = window.BrowserOpenTab;
		window.BrowserOpenTab = function(...aArgs) {
			gBrowser.treeStyleTab.onBeforeNewTabCommand();
			return window.__treestyletab__BrowserOpenTab.call(this, ...aArgs);
		};

		window.__treestyletab__undoCloseTab = window.undoCloseTab;
		window.undoCloseTab = function(...aArgs) {
			gBrowser.__treestyletab__doingUndoCloseTab = true;
			var tab = window.__treestyletab__undoCloseTab.call(this, ...aArgs);
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
				return window.__treestyletab__openLinkIn.call(this, aUrl, aWhere, aParams, ...aArgs);
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
				return window.__treestyletab__handleLinkClick.call(this, aEvent, aHref, aLinkNode, ...aArgs);
			}
			finally {
				delete window.__treestyletab__openLinkIn_extraParams;
			}
		};

		this.overrideExtensionsPreInit(); // windowHelperHacks.js


		if ('MultipleTabService' in window &&
			Array.isArray(MultipleTabService.showHideMenuItemsConditionsProviders)) {
			MultipleTabService.showHideMenuItemsConditionsProviders.push(
				function treeProvider(aContextTabs) {
					return {
						'can-create-subtree' : TreeStyleTabService.canCreateSubtree(aContextTabs)
					};
				}
			);
		}
	},
 
	onBeforeBrowserInit : function TSTWH_onBeforeBrowserInit() 
	{
		this.overrideExtensionsBeforeBrowserInit(); // windowHelperHacks.js
		this.overrideGlobalFunctions();

		gBrowser.__treestyletab__swapBrowsersAndCloseOther = gBrowser.swapBrowsersAndCloseOther;
		gBrowser.swapBrowsersAndCloseOther = function(aOurTab, aRemoteTab, ...aArgs) {
			if (TreeStyleTabWindowHelper.runningDelayedStartup &&
				TreeStyleTabService.tearOffSubtreeFromRemote(aRemoteTab))
				return;
			return gBrowser.__treestyletab__swapBrowsersAndCloseOther(aOurTab, aRemoteTab, ...aArgs);
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

		aObserver.__treestyletab__getDropEffectForTabDrag = aObserver._getDropEffectForTabDrag;
		aObserver._getDropEffectForTabDrag = function(aEvent, ...aArgs) {
			var effects = aObserver.__treestyletab__getDropEffectForTabDrag(aEvent, ...aArgs);
			if (effects === 'copy' || effects === 'move') {
				let TSTTabBrowser = this instanceof Element ? (this.tabbrowser || this) : gBrowser ;
				var TST = TSTTabBrowser.treeStyleTab
				if (!TST.tabbarDNDObserver.canDropTab(aEvent))
					effects = 'none';
			}
			return effects;
		};
	},
 
	overrideGlobalFunctions : function TSTWH_overrideGlobalFunctions() 
	{
		this.initToolbarItems();

		nsContextMenu.prototype.__treestyletab__openLinkInTab = nsContextMenu.prototype.openLinkInTab;
		nsContextMenu.prototype.openLinkInTab = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(gBrowser.selectedTab);
			return nsContextMenu.prototype.__treestyletab__openLinkInTab.call(this, ...aArgs);
		};

		nsContextMenu.prototype.__treestyletab__openFrameInTab = nsContextMenu.prototype.openFrameInTab;
		nsContextMenu.prototype.openFrameInTab = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(gBrowser.selectedTab);
			return nsContextMenu.prototype.__treestyletab__openFrameInTab.call(this, ...aArgs);
		};

		nsContextMenu.prototype.__treestyletab__viewMedia = nsContextMenu.prototype.viewMedia;
		nsContextMenu.prototype.viewMedia = function(aEvent) {
			TreeStyleTabService.onBeforeViewMedia(aEvent, gBrowser.selectedTab);
			return nsContextMenu.prototype.__treestyletab__viewMedia.call(this, aEvent);
		};

		nsContextMenu.prototype.__treestyletab__viewBGImage = nsContextMenu.prototype.viewBGImage;
		nsContextMenu.prototype.viewBGImage = function(aEvent) {
			TreeStyleTabService.onBeforeViewMedia(aEvent, gBrowser.selectedTab);
			return nsContextMenu.prototype.__treestyletab__viewBGImage.call(this, aEvent);
		};

		nsContextMenu.prototype.__treestyletab__addDictionaries = nsContextMenu.prototype.addDictionaries;
		nsContextMenu.prototype.addDictionaries = function(...aArgs) {
			var newWindowPref = TreeStyleTabUtils.prefs.getPref('browser.link.open_newwindow');
			var where = newWindowPref === 3 ? 'tab' : 'window' ;
			TreeStyleTabService.onBeforeOpenLink(where, gBrowser.selectedTab);
			return nsContextMenu.prototype.__treestyletab__addDictionaries.call(this, ...aArgs);
		};

		nsContextMenu.prototype.__treestyletab__viewPartialSource = nsContextMenu.prototype.viewPartialSource;
		nsContextMenu.prototype.viewPartialSource = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(gBrowser.selectedTab);
			return nsContextMenu.prototype.__treestyletab__viewPartialSource.call(this, ...aArgs);
		};

		nsContextMenu.prototype.__treestyletab__viewFrameSource = nsContextMenu.prototype.viewFrameSource;
		nsContextMenu.prototype.viewFrameSource = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(gBrowser.selectedTab);
			return nsContextMenu.prototype.__treestyletab__viewFrameSource.call(this, ...aArgs);
		};

		window.__treestyletab__BrowserViewSource = window.BrowserViewSource;
		window.BrowserViewSource = function(...aArgs) {
			TreeStyleTabService.handleNewTabFromCurrent(aArgs[0]);
			return window.__treestyletab__BrowserViewSource.call(this, ...aArgs);
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
				return owner[original].call(this, aEvent, aIsPanelClick, ...aArgs);
			};
		}, this);

		window.__treestyletab__BrowserGoHome = window.BrowserGoHome;
		window.BrowserGoHome = function(aEvent) {
			aEvent = TreeStyleTabService.onBeforeGoHome(aEvent, gBrowser);
			return window.__treestyletab__BrowserGoHome.call(this, aEvent);
		};

		FeedHandler.__treestyletab__loadFeed = FeedHandler.loadFeed;
		FeedHandler.loadFeed = function(aHref, aEvent) {
			TreeStyleTabService.onBeforeViewMedia(aEvent, gBrowser);
			return FeedHandler.__treestyletab__loadFeed.call(this, aHref, aEvent);
		};

		if ('showNavToolbox' in FullScreen) {
			FullScreen.__treestyletab__showNavToolbox = FullScreen.showNavToolbox;
			FullScreen.showNavToolbox = function(...aArgs) {
				var beforeCollapsed = this._isChromeCollapsed;
				var retVal = FullScreen.__treestyletab__showNavToolbox.call(this, ...aArgs);
				if (beforeCollapsed !== this._isChromeCollapsed)
					gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN);
				return retVal;
			};

			FullScreen.__treestyletab__hideNavToolbox = FullScreen.hideNavToolbox;
			FullScreen.hideNavToolbox = function(...aArgs) {
				var beforeCollapsed = this._isChromeCollapsed;
				var retVal = FullScreen.__treestyletab__hideNavToolbox.call(this, ...aArgs);
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
			return FullScreen.__treestyletab__toggle.call(this, ...aArgs);
		};

		PrintUtils.__treestyletab__printPreview = PrintUtils.printPreview;
		PrintUtils.printPreview = function(...aArgs) {
			TreeStyleTabService.onPrintPreviewEnter();
			return PrintUtils.__treestyletab__printPreview.call(this, ...aArgs);
		};
		PrintUtils.__treestyletab__exitPrintPreview = PrintUtils.exitPrintPreview;
		PrintUtils.exitPrintPreview = function(...aArgs) {
			TreeStyleTabService.onPrintPreviewExit();
			return PrintUtils.__treestyletab__exitPrintPreview.call(this, ...aArgs);
		};

		SidebarUI.__treestyletab__show = SidebarUI.show;
		SidebarUI.show = function(...aArgs) {
			var opened = this.isOpen;
			var width = this.browser.boxObject.width;
			return SidebarUI.__treestyletab__show.call(this, ...aArgs)
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
			var retVal = SidebarUI.__treestyletab__hide.call(this, ...aArgs);
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
				var retVal = searchbar.__treestyletab__original_doSearch.call(this, ...aArgs);
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
		var { ExtendedImmutable } = Components.utils.import('resource://treestyletab-modules/lib/extended-immutable.js', {});

		b.__treestyletab__moveTabForward = b.moveTabForward;
		b.moveTabForward = function(...aArgs) {
			let originalNextTab = this.treeStyleTab.getNextTab(this.mCurrentTab);
			let nextTab = originalNextTab;

			let descendants = this.treeStyleTab.getDescendantTabs(this.mCurrentTab);
			if (descendants.indexOf(nextTab) > -1) {
				let lastDescendant = this.treeStyleTab.getLastDescendantTab(this.mCurrentTab);
				nextTab = this.treeStyleTab.getNextVisibleTab(lastDescendant || this.mCurrentTab);
			}
			if (this.treeStyleTab.hasChildTabs(nextTab) && this.treeStyleTab.isSubtreeCollapsed(nextTab)) {
				nextTab = this.treeStyleTab.getLastDescendantTab(nextTab);
			}

			if (nextTab == originalNextTab)
				return this.__treestyletab__moveTabForward(...aArgs);

			if (nextTab)
				this.moveTabTo(this.mCurrentTab, nextTab._tPos);
			else if (this.arrowKeysShouldWrap)
				this.moveTabToStart();
		};

		b.__treestyletab__moveTabBackward = b.moveTabBackward;
		b.moveTabBackward = function(...aArgs) {
			let originalPreviousTab = this.treeStyleTab.getPreviousTab(this.mCurrentTab);
			let previousTab = this.treeStyleTab.getPreviousVisibleTab(this.mCurrentTab);

			if (previousTab == originalPreviousTab)
				return this.__treestyletab__moveTabBackward(...aArgs);

			if (previousTab)
				this.moveTabTo(this.mCurrentTab, previousTab._tPos);
			else if (this.arrowKeysShouldWrap)
				this.moveTabToStart();
		};

		b.__treestyletab__loadTabs = b.loadTabs;
		b.loadTabs = function(aURIs, aLoadInBackground, aReplace, ...aArgs) {
			if (!TreeStyleTabWindowHelper.runningDelayedStartup) { // don't open home tabs as a tree!
				if (aReplace)
					this.treeStyleTab.readyToOpenChildTab(this.selectedTab, true);
				else if (typeof this.treeStyleTab.nextOpenedTabToBeParent == 'undefined')
					this.treeStyleTab.nextOpenedTabToBeParent = true;
			}

			var result;
			var tabs = [];
			var firstTabAdded;
			try {
				tabs = this.treeStyleTab.doAndGetNewTabs((function() {
						result = this.__treestyletab__loadTabs.call(this, aURIs, aLoadInBackground, aReplace, ...aArgs);
					}).bind(this));
				firstTabAdded = tabs[0];
			}
			finally {
				if (!aLoadInBackground && !aReplace && firstTabAdded) {
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

		b.__treestyletab__beginRemoveTab = b._beginRemoveTab;
		b._beginRemoveTab = function(aTab, ...aArgs) {
			var originalRemovingTabs = this._removingTabs;
			var self = this;
			if (this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab)) {
				this._removingTabs = new ExtendedImmutable(originalRemovingTabs, {
					get length() {
						// hack for https://dxr.mozilla.org/mozilla-central/rev/dbe4b47941c7b3d6298a0ead5e40dd828096c808/browser/base/content/tabbrowser.xml#2371
						if (aTab.closing) // do nothing after the removing process is started
							return originalRemovingTabs.length;

						if (window.skipNextCanClose) // the end section of the "close window with last tab" block
							return 0;
						else
							return self.tabs.length - 1; // the beginning of the "close window with last tab" block
					}
				});
			}
			var result = this.__treestyletab__beginRemoveTab(aTab, ...aArgs);
			this._removingTabs = originalRemovingTabs;
			return result;
		};

		b.__treestyletab__removeCurrentTab = b.removeCurrentTab;
		b.removeCurrentTab = function(...aArgs) {
			if (!b.treeStyleTab.warnAboutClosingTabSubtreeOf(this.selectedTab))
				return;
			return b.__treestyletab__removeCurrentTab.call(this, ...aArgs);
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
				return b.mTabContainer.__treestyletab__advanceSelectedTab.call(this, ...aArgs);
			};

		if (!b.tabContainer.__treestyletab__notifyBackgroundTab)
			b.tabContainer.__treestyletab__notifyBackgroundTab = b.tabContainer._notifyBackgroundTab;
		// original: https://dxr.mozilla.org/mozilla-central/rev/dbe4b47941c7b3d6298a0ead5e40dd828096c808/browser/base/content/tabbrowser.xml#5459
		if (b.mTabContainer._notifyBackgroundTab.toString() === b.mTabContainer.__treestyletab__notifyBackgroundTab.toString())
			b.tabContainer._notifyBackgroundTab = function(aTab, ...aArgs) {
				var treeStyleTab = gBrowser.treeStyleTab;
				if (aTab.pinned ||
					treeStyleTab.scrollToNewTabMode == 0 ||
					treeStyleTab.shouldCancelEnsureElementIsVisible())
					return;

				let scrollRect = this.mTabstrip.scrollClientRect;
				let tabRect = aTab.getBoundingClientRect();
				this.mTabstrip._calcTabMargins(aTab);

				tabRect = {
					start : tabRect[treeStyleTab.startProp],
					end   : tabRect[treeStyleTab.endProp]
				};
				tabRect[treeStyleTab.startProp] = tabRect.start;
				tabRect[treeStyleTab.endProp]   = tabRect.end;

				if (tabRect[treeStyleTab.startProp] >= scrollRect[treeStyleTab.startProp] &&
					tabRect[treeStyleTab.endProp]   <= scrollRect[treeStyleTab.endProp])
					return;

				if (this.mTabstrip.smoothScroll) {
					let selectedRect = !this.selectedItem.pinned && this.selectedItem.getBoundingClientRect();
					if (selectedRect) {
						selectedRect = {
							start : selectedRect[treeStyleTab.startProp],
							end   : selectedRect[treeStyleTab.endProp]
						};
						selectedRect[treeStyleTab.startProp] = selectedRect.start + this.mTabstrip._tabMarginLeft;
						selectedRect[treeStyleTab.endProp]   = selectedRect.end - this.mTabstrip._tabMarginRight;
					}
					tabRect[treeStyleTab.startProp] += this.mTabstrip._tabMarginLeft;
					tabRect[treeStyleTab.endProp]   -= this.mTabstrip._tabMarginRight;

					if (!selectedRect ||
						treeStyleTab.scrollToNewTabMode == 1 &&
						Math.max(
							tabRect[treeStyleTab.endProp] - selectedRect[treeStyleTab.startProp],
							selectedRect[treeStyleTab.endProp] - tabRect[treeStyleTab.startProp]
						) <= scrollRect[treeStyleTab.sizeProp]) {
						this.mTabstrip.ensureElementIsVisible(aTab);
						return;
					}

					this.mTabstrip._smoothScrollByPixels(
						this.mTabstrip._isRTLScrollbox ?
							selectedRect[treeStyleTab.endProp] - scrollRect[treeStyleTab.endProp] :
							selectedRect[treeStyleTab.startProp] - scrollRect[treeStyleTab.startProp]
					);
				}

				if (!this._animateElement.hasAttribute('notifybgtab')) {
					this._animateElement.setAttribute('notifybgtab', 'true');
					setTimeout(function(aAnimateElement) {
						aAnimateElement.removeAttribute('notifybgtab');
					}, 150, this._animateElement);
				}

				treeStyleTab.notifyBackgroundTab();
			};

		if (!b.tabContainer.__treestyletab__getDragTargetTab)
			b.tabContainer.__treestyletab__getDragTargetTab = b.tabContainer._getDragTargetTab;
		// original: https://dxr.mozilla.org/mozilla-central/rev/dbe4b47941c7b3d6298a0ead5e40dd828096c808/browser/base/content/tabbrowser.xml#5511
		if (b.mTabContainer._getDragTargetTab.toString() === b.mTabContainer.__treestyletab__getDragTargetTab.toString())
			b.tabContainer._getDragTargetTab = function(aEvent, aIsLink, ...aArgs) {
				var treeStyleTab = gBrowser.treeStyleTab;
				if (!treeStyleTab.isVertical)
					return this.__treestyletab__getDragTargetTab(aEvent, aIsLink, ...aArgs);

				var draggedTab = aEvent.target.localName == 'tab' ? aEvent.target : null;
				if (draggedTab && aIsLink) {
					let tabBox      = draggedTab.boxObject;
					let tabPosition = tabBox[treeStyleTab.screenPositionProp];
					let tabSize     = tabBox[treeStyleTab.sizeProp];
					let currentPosition = aEvent[treeStyleTab.screenPositionProp];
					if (currentPosition < tabPosition + tabSize * 0.25 ||
						currentPosition > tabPosition + tabSize * 0.75)
						return null;
				}
				return draggedTab;
			};

		if (!b.tabContainer.__treestyletab__getDropIndex)
			b.tabContainer.__treestyletab__getDropIndex = b.tabContainer._getDropIndex;
		// original: https://dxr.mozilla.org/mozilla-central/rev/dbe4b47941c7b3d6298a0ead5e40dd828096c808/browser/base/content/tabbrowser.xml#5526
		if (b.mTabContainer._getDropIndex.toString() === b.mTabContainer.__treestyletab__getDropIndex.toString())
			b.tabContainer._getDropIndex = function(aEvent, aIsLink, ...aArgs) {
				var treeStyleTab = gBrowser.treeStyleTab;
				if (!treeStyleTab.isVertical)
					return this.__treestyletab__getDropIndex(aEvent, aIsLink, ...aArgs);

				var tabs = this.childNodes;
				var draggedTab = this._getDragTargetTab(aEvent, aIsLink);
				var currentPosition = aEvent[treeStyleTab.screenPositionProp];
				var isLTR = window.getComputedStyle(this, null).direction == 'ltr';
				for (let i = draggedTab ? draggedTab._tPos : 0; i < tabs.length; i++)
				{
					let tabBox    = tabs[i].boxObject;
					let tabCenter = tabBox[treeStyleTab.screenPositionProp] + tabBox[treeStyleTab.sizeProp] / 2;
					if (isLTR) {
						if (currentPosition < tabCenter)
							return i;
					}
					else {
						if (currentPosition > tabCenter)
							return i;
					}
				}
				return tabs.length;
			};

		/**
		 * The default implementation fails to scroll to tab if it is expanding.
		 * So we have to override its effect.
		 */
		{
			let scrollbox = aTabBrowser.treeStyleTab.scrollBox;
				if (!scrollbox.__treestyletab__ensureElementIsVisible) {
				scrollbox.__treestyletab__ensureElementIsVisible = scrollbox.ensureElementIsVisible;
				scrollbox.ensureElementIsVisible = function(...aArgs) {
					var treeStyleTab = gBrowser.treeStyleTab;
					if (treeStyleTab.shouldCancelEnsureElementIsVisible())
						return;
					let shouldScrollNow = aArgs[1] === false;
					if (treeStyleTab.animationEnabled && !shouldScrollNow)
						return treeStyleTab.scrollToTab(aArgs[0]);
					scrollbox.__treestyletab__ensureElementIsVisible.call(this, ...aArgs);
				};
			}
		}

		{
			let popup = document.getElementById('alltabs-popup');
			if (!popup.__treestyletab__updateTabsVisibilityStatus)
				popup.__treestyletab__updateTabsVisibilityStatus = popup._updateTabsVisibilityStatus;
			// original https://dxr.mozilla.org/mozilla-central/rev/dbe4b47941c7b3d6298a0ead5e40dd828096c808/browser/base/content/tabbrowser.xml#6588
			if (popup._updateTabsVisibilityStatus.toString() === popup.__treestyletab__updateTabsVisibilityStatus.toString())
				popup._updateTabsVisibilityStatus = function(...aArgs) {
					var treeStyleTab = gBrowser.treeStyleTab;
					if (!treeStyleTab.isVertical)
						return this.__treestyletab__updateTabsVisibilityStatus(...aArgs);

					var tabContainer = gBrowser.tabContainer;
					if (tabContainer.getAttribute('overflow') != 'true')
						return;

					var tabbarBox = tabContainer.mTabstrip.scrollBoxObject;
					for (let aItem of this.childNodes)
					{
						let tab = aItem.tab;
						if (!tab) // not tab item
							continue;

						let tabBox = tab.boxObject;
						if (tabBox[treeStyleTab.screenPositionProp] >= tabbarBox[treeStyleTab.screenPositionProp] &&
							tabBox[treeStyleTab.screenPositionProp] + tabBox[treeStyleTab.sizeProp] <= tabbarBox[treeStyleTab.screenPositionProp] + tabbarBox[treeStyleTab.sizeProp])
							aItem.setAttribute('tabIsVisible', true);
						else
							aItem.removeAttribute('tabIsVisible');
					}
				};
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
			return aTab.__treestyletab__toggleMuteAudio.call(this, ...aArgs);
		};
	}
 
}; 
  
