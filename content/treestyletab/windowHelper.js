Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabUtils', 'resource://treestyletab-modules/utils.js');

var TreeStyleTabWindowHelper = { 
	
	get service() 
	{
		return TreeStyleTabService;
	},
 
	preInit : function TSTWH_preInit() 
	{
		TreeStyleTabUtils.doPatching(gBrowserInit._delayedStartup, 'gBrowserInit._delayedStartup', function(aName, aSource) {
			if (aSource.indexOf('!MultipleTabService.tearOffSelectedTabsFromRemote()') > -1) {
				return eval(aName+' = '+aSource.replace(
					'!MultipleTabService.tearOffSelectedTabsFromRemote()',
					'!TreeStyleTabService.tearOffSubtreeFromRemote() && $&'
				));
			}
			else if (aSource.indexOf('gBrowser.swapBrowsersAndCloseOther') > -1) {
				return eval(aName+' = '+aSource.replace(
					/gBrowser\.swapBrowsersAndCloseOther\([^)]+\);/g,
					'if (!TreeStyleTabService.tearOffSubtreeFromRemote()) { $& }'
				).replace(
					// Workaround for https://github.com/piroor/treestyletab/issues/741
					// After the function is updated by TST, reassignment of a global variable raises an error like:
					// > System JS : ERROR chrome://treestyletab/content/windowHelper.js line 30 > eval:130 - TypeError: can't redefine non-configurable property 'gBidiUI'
					// If I access it as a property of the global object, the error doesn't appear.
					/([^\.])\bgBidiUI =/,
					'$1window.gBidiUI ='
				));
			}
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(nsBrowserAccess.prototype.openURI, 'nsBrowserAccess.prototype.openURI', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				/(switch\s*\(aWhere\))/,
				'TreeStyleTabService.onBeforeBrowserAccessOpenURI(aOpener, aWhere, aContext); $1'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(nsBrowserAccess.prototype.openURIInFrame, 'nsBrowserAccess.prototype.openURIInFrame', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'let browser = ',
				// Use "arguments[1]" instead of "aOwner" or "aParams".
				// The argument name is changed from "aOwner" to "aParams" by https://bugzilla.mozilla.org/show_bug.cgi?id=1058116
				'TreeStyleTabService.onBeforeBrowserAccessOpenURI(arguments[1], aWhere, aContext); $&'
			));
		}, 'TreeStyleTab');

		if ('TabsInTitlebar' in window) {
			TreeStyleTabUtils.doPatching(TabsInTitlebar._update, 'TabsInTitlebar._update', function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					/let fullTabsHeight = /,
					'$& gBrowser.treeStyleTab.position != "top" ? 0 : '
				));
			}, 'treeStyleTab');
		}

		TreeStyleTabUtils.doPatching(window.BrowserOpenTab, 'window.BrowserOpenTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'openUILinkIn(',
				'gBrowser.treeStyleTab.onBeforeNewTabCommand(); $&'
			));
		}, 'treeStyleTab');

		TreeStyleTabUtils.doPatching(window.undoCloseTab, 'window.undoCloseTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				/(\btab\s*=\s*[^\.]+\.undoCloseTab\([^;]+\);)/,
				'gBrowser.__treestyletab__doingUndoCloseTab = true;\n' +
				'$1\n' +
				'tab.__treestyletab__restoredByUndoCloseTab = true;\n' +
				'setTimeout(function() { delete gBrowser.__treestyletab__doingUndoCloseTab; }, 0);'
			));
		}, 'treestyletab');

		TreeStyleTabUtils.doPatching(window.XULBrowserWindow.hideChromeForLocation, 'XULBrowserWindow.hideChromeForLocation', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{ if (gBrowser.treeStyleTab.isVertical) return false;\n'
			));
		}, 'treeStyleTab');

		[
			'window.duplicateTab.handleLinkClick',
			'window.duplicatethistab.handleLinkClick',
			'window.__treestyletab__highlander__origHandleLinkClick',
			'window.__splitbrowser__handleLinkClick',
			'window.__ctxextensions__handleLinkClick',
			'window.handleLinkClick'
		].some(function(aName) {
			let func = this._getFunction(aName);
			if (!func || !/^\(?function handleLinkClick/.test(func.toString()))
				return false;
			TreeStyleTabUtils.doPatching(func, aName, function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					/(charset\s*:\s*doc\.characterSet\s*)/,
					'$1, event : event, linkNode : linkNode'
				));
			}, 'event : event, linkNode : linkNode');
			return true;
		}, this);

		this.overrideExtensionsPreInit(); // windowHelperHacks.js
	},
 
	onBeforeBrowserInit : function TSTWH_onBeforeBrowserInit() 
	{
		this.overrideExtensionsBeforeBrowserInit(); // windowHelperHacks.js
		this.overrideGlobalFunctions();
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
	},
 
	overrideGlobalFunctions : function TSTWH_overrideGlobalFunctions() 
	{
		this.initToolbarItems();

		TreeStyleTabUtils.doPatching(nsContextMenu.prototype.openLinkInTab, 'nsContextMenu.prototype.openLinkInTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{\n' +
				'  TreeStyleTabService.handleNewTabFromCurrent(this.target.ownerDocument.defaultView);'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(nsContextMenu.prototype.openFrameInTab, 'nsContextMenu.prototype.openFrameInTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{\n' +
				'  TreeStyleTabService.handleNewTabFromCurrent(this.target.ownerDocument.defaultView);'
			));
		}, 'TreeStyleTab');

		var viewImageMethod = ('viewImage' in nsContextMenu.prototype) ? 'viewImage' : 'viewMedia' ;
		TreeStyleTabUtils.doPatching(nsContextMenu.prototype[viewImageMethod], 'nsContextMenu.prototype.'+viewImageMethod, function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'openUILink(',
				'TreeStyleTabService.onBeforeViewMedia(e, this.target.ownerDocument.defaultView); $&'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(nsContextMenu.prototype.viewBGImage, 'nsContextMenu.prototype.viewBGImage', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'openUILink(',
				'TreeStyleTabService.onBeforeViewMedia(e, this.target.ownerDocument.defaultView); $&'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(nsContextMenu.prototype.addDictionaries, 'nsContextMenu.prototype.addDictionaries', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'openUILinkIn(',
				'TreeStyleTabService.onBeforeOpenLink(where, this.target.ownerDocument.defaultView); $&'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(BrowserSearch._loadSearch, 'BrowserSearch._loadSearch', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'openLinkIn(',
				'TreeStyleTabService.onBeforeBrowserSearch(arguments[0], useNewTab); $&'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(window.openLinkIn, 'window.openLinkIn', function(aName, aSource) {
			// Bug 1050447 changed this line in Fx 34 to
			// newTab = w.gBrowser.loadOneTab(
			// Bug 1108555 removed newTab assignment
			return eval(aName+' = '+aSource.replace(
				/((b|(newTab = )?w\.gB)rowser.loadOneTab\()/g,
				'TreeStyleTabService.onBeforeOpenLinkWithTab(gBrowser.selectedTab, aFromChrome); $1'
			));
		}, 'TreeStyleTab');

		[
			'window.permaTabs.utils.wrappedFunctions["window.contentAreaClick"]',
			'window.__contentAreaClick',
			'window.__ctxextensions__contentAreaClick',
			'window.contentAreaClick'
		].forEach(function(aName) {
			var func = this._getFunction(aName);
			var source = func && func.toString();
			if (!func ||
				!/^\(?function contentAreaClick/.test(source) ||
				// for Tab Utilities, etc. Some addons insert openNewTabWith() to the function.
				// (calls for the function is not included by Firefox default.)
				!/(openNewTabWith\()/.test(source))
				return;
			TreeStyleTabUtils.doPatching(func, aName, function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					/(openNewTabWith\()/g,
					'TreeStyleTabService.onBeforeOpenNewTabByThirdParty(event.target.ownerDocument.defaultView); $1'
				));
			}, 'TreeStyleTab');
		}, this);

		TreeStyleTabUtils.doPatching(window.duplicateTabIn, 'window.duplicateTabIn', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{ gBrowser.treeStyleTab.onBeforeTabDuplicate(aTab, where, delta); '
			));
		}, 'treeStyleTab');

		[
			'permaTabs.utils.wrappedFunctions["window.BrowserHomeClick"]',
			'window.BrowserHomeClick',
			'window.BrowserGoHome'
		].forEach(function(aName) {
			let func = this._getFunction(aName);
			if (!func || !/^\(?function (BrowserHomeClick|BrowserGoHome)/.test(func.toString()))
				return;
			TreeStyleTabUtils.doPatching(func, aName, function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					'gBrowser.loadTabs(',
					'TreeStyleTabService.readyToOpenNewTabGroup(gBrowser); $&'
				));
			}, 'TreeStyleTab');
		}, this);

		TreeStyleTabUtils.doPatching(FeedHandler.loadFeed, 'FeedHandler.loadFeed', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'openUILink(',
				'TreeStyleTabService.onBeforeViewMedia(event, gBrowser); $&'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(FullScreen.mouseoverToggle, 'FullScreen.mouseoverToggle', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'this._isChromeCollapsed = !aShow;',
				'gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN); $&'
			));
		}, 'treeStyleTab');

		TreeStyleTabUtils.doPatching(FullScreen.toggle, 'FullScreen.toggle', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{ gBrowser.treeStyleTab.onBeforeFullScreenToggle(); '
			));
		}, 'treeStyleTab');

		TreeStyleTabUtils.doPatching(PrintUtils.printPreview, 'PrintUtils.printPreview', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{ TreeStyleTabService.onPrintPreviewEnter();'
			));
		}, 'TreeStyleTab');
		TreeStyleTabUtils.doPatching(PrintUtils.exitPrintPreview, 'PrintUtils.exitPrintPreview', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{ TreeStyleTabService.onPrintPreviewExit();'
			));
		}, 'TreeStyleTab');

		if ('TabsOnTop' in window) {
			TreeStyleTabUtils.doPatching(TabsOnTop.syncUI, 'TabsOnTop.syncUI', function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					/(\}\)?)$/,
					'gBrowser.treeStyleTab.onTabsOnTopSyncCommand(enabled); $&'
				));
			}, 'treeStyleTab');
		}

		if ('SidebarUI' in window) { // for Firefox 39 or later
			SidebarUI.__treestyletab__show = SidebarUI.show;
			SidebarUI.show = function(...aArgs) {
				return this.__treestyletab__show.apply(this, aArgs)
						.then(function(aResult) {
							gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_TOGGLE_SIDEBAR);
							return aResult;
						});
			};
			SidebarUI.__treestyletab__hide = SidebarUI.hide;
			SidebarUI.hide = function(...aArgs) {
				var retVal = this.__treestyletab__hide.apply(this, aArgs);
				gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_TOGGLE_SIDEBAR);
				return retVal;
			};
		}
		else if ('toggleSidebar' in window) { // for Firefox 38 or older
			TreeStyleTabUtils.doPatching(window.toggleSidebar, 'window.toggleSidebar', function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					'{',
					'{ gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_TOGGLE_SIDEBAR);'
				));
			}, 'treeStyleTab');
		}
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
		var searchbar = document.getElementById('searchbar');
		if (searchbar &&
			searchbar.doSearch &&
			!searchbar.__treestyletab__original_doSearch) {
			searchbar.__treestyletab__original_doSearch = searchbar.doSearch;
			searchbar.doSearch = function(...aArgs) {
				TreeStyleTabService.onBeforeBrowserSearch(aArgs[0]);
				var retVal = this.__treestyletab__original_doSearch.apply(this, aArgs);
				TreeStyleTabService.stopToOpenChildTab();
				return retVal;
			};
		}

		var goButton = document.getElementById('urlbar-go-button');
		if (goButton)
			goButton.parentNode.addEventListener('click', this.service, true);

		var tabbar = this.service.getTabStrip(this.service.browser);
		tabbar.addEventListener('click', this.service, true);

		var newTabButton = document.getElementById('new-tab-button');
		const nsIDOMNode = Ci.nsIDOMNode;
		if (newTabButton &&
			!(tabbar.compareDocumentPosition(newTabButton) & nsIDOMNode.DOCUMENT_POSITION_CONTAINED_BY))
			newTabButton.parentNode.addEventListener('click', this.service, true);

		this.service.updateAllTabsButton(gBrowser);
	},
 
	destroyToolbarItems : function TSTWH_destroyToolbarItems() 
	{
		var goButton = document.getElementById('urlbar-go-button');
		if (goButton)
			goButton.parentNode.removeEventListener('click', this, true);

		var tabbar = this.service.getTabStrip(this.service.browser);
		tabbar.removeEventListener('click', this.service, true);

		var newTabButton = document.getElementById('new-tab-button');
		const nsIDOMNode = Ci.nsIDOMNode;
		if (newTabButton &&
			!(tabbar.compareDocumentPosition(newTabButton) & Ci.nsIDOMNode.DOCUMENT_POSITION_CONTAINED_BY))
			newTabButton.parentNode.removeEventListener('click', this.service, true);

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
				'  if (this.treeStyleTab.hasChildTabs(this.mCurrentTab)) {\n' +
				'    let descendant = this.treeStyleTab.getDescendantTabs(this.mCurrentTab);\n' +
				'    if (descendant.length)\n' +
				'      nextTab = this.treeStyleTab.getNextTab(descendant[descendant.length-1]);\n' +
				'  }\n' +
				'}).call(this);' +
				'$&'
			).replace(
				/(this.moveTabTo\([^;]+\);)/,
				'(function() {\n' +
				'  let descendant = this.treeStyleTab.getDescendantTabs(nextTab);\n' +
				'  if (descendant.length) {\n' +
				'    nextTab = descendant[descendant.length-1];\n' +
				'  }\n' +
				'  $1\n' +
				'}).call(this);'
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

		TreeStyleTabUtils.doPatching(b.loadTabs, 'b.loadTabs', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'var tabNum = ',
				'if (this.treeStyleTab.readiedToAttachNewTabGroup)\n' +
				'  TreeStyleTabService.readyToOpenChildTab(firstTabAdded || this.selectedTab, true);\n' +
				'$&'
			).replace(
				'if (!aLoadInBackground)',
				'if (TreeStyleTabService.checkToOpenChildTab(this))\n' +
				'  TreeStyleTabService.stopToOpenChildTab(this);\n' +
				'$&'
			).replace(
				'this.selectedTab = firstTabAdded;',
				'this.selectedTab = aURIs[0].indexOf("about:treestyletab-group") < 0 ? \n' +
				'  firstTabAdded :\n' +
				'  TreeStyleTabService.getNextTab(firstTabAdded) ;'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(b._beginRemoveTab, 'b._beginRemoveTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'if (this.tabs.length - this._removingTabs.length == 1) {',
				'if (this.tabs.length - this._removingTabs.length == 1 || this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab)) {'
			).replace(
				'this._removingTabs.length == 0',
				'(this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab) || $&)'
			));
		}, 'treeStyleTab');

		TreeStyleTabUtils.doPatching(b.removeCurrentTab, 'b.removeCurrentTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{ if (!this.treeStyleTab.warnAboutClosingTabSubtreeOf(this.selectedTab)) return;'
			));
		}, 'treeStyleTab');
	},
 
	initTabbarMethods : function TSTWH_initTabbarMethods(aTabBrowser) 
	{
		var b = aTabBrowser;

		TreeStyleTabUtils.doPatching(b.mTabContainer.advanceSelectedTab, 'b.mTabContainer.advanceSelectedTab', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'{\n' +
				'  var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;\n' +
				'  if (treeStyleTab.handleAdvanceSelectedTab(arguments[0], arguments[1]))\n' +
				'    return;'
			));
		}, 'treeStyleTab.handleAdvanceSelectedTab');

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
					var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;
					if (treeStyleTab) {
						if (treeStyleTab.shouldCancelEnsureElementIsVisible())
							return;
						let shouldScrollNow = aArgs[1] === false;
						if (treeStyleTab.animationEnabled && !shouldScrollNow)
							return treeStyleTab.scrollToTab(aArgs[0]);
					}
					this.__treestyletab__ensureElementIsVisible.apply(this, aArgs);
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
	
	}
 
}; 
  
