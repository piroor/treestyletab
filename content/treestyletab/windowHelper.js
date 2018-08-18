var TreeStyleTabWindowHelper = { 
  runningDelayedStartup : false,
	
	get service() 
	{
		return TreeStyleTabService;
	},
 
	preInit : function TSTWH_preInit() 
	{
		var source;
		if ('gBrowserInit' in window) {
			if (
				!('_delayedStartup' in gBrowserInit) ||
				!(source = gBrowserInit._delayedStartup.toSource()) ||
				source.indexOf('swapBrowsersAndCloseOther') == -1
				)
				dump('Tree Style Tab: failed to initialize startup function!');
		}
    gBrowserInit.__treestyletab___delayedStartup = gBrowserInit._delayedStartup;
    gBrowserInit._delayedStartup = function(...args) {
      TreeStyleTabWindowHelper.runningDelayedStartup = true;
      var retVal = this.__treestyletab___delayedStartup.apply(this, args);
      TreeStyleTabWindowHelper.runningDelayedStartup = false;
      return retVal;
    };

		eval('nsBrowserAccess.prototype.openURI = '+
			nsBrowserAccess.prototype.openURI.toSource().replace(
				/(switch\s*\(aWhere\))/,
				'TreeStyleTabService.onBeforeBrowserAccessOpenURI(aOpener, aWhere); $1'
			)
		);

		if ('TabsInTitlebar' in window &&
			TabsInTitlebar._update) {
			eval('window.TabsInTitlebar._update = '+
				window.TabsInTitlebar._update.toSource().replace(
					/let fullTabsHeight = /,
					'$& gBrowser.treeStyleTab.position != "top" ? 0 : $1'
				)
			);
		}

		if ('BrowserOpenTab' in window) {
			eval('window.BrowserOpenTab = '+
				window.BrowserOpenTab.toSource().replace(
					// loadOneTab => Firefox 10 or olders
					// openUILinkIn => Firefox 11 or later
					/(gBrowser\.loadOneTab\(|openUILinkIn\(.+\,\s*"tab"\))/,
					'gBrowser.treeStyleTab.onBeforeNewTabCommand(); $1'
				)
			);
		}

		if ('undoCloseTab' in window) {
			eval('window.undoCloseTab = '+
				window.undoCloseTab.toSource().replace(
					/(\btab\s*=\s*[^\.]+\.undoCloseTab\([^;]+\);)/,
					'gBrowser.__treestyletab__readyToUndoCloseTab = true;\n' +
					'$1\n' +
					'tab.__treestyletab__restoredByUndoCloseTab = true;\n' +
					'delete gBrowser.__treestyletab__readyToUndoCloseTab;'
				)
			);
		}

		if ('XULBrowserWindow' in window &&
			'hideChromeForLocation' in window.XULBrowserWindow) {
			eval('XULBrowserWindow.hideChromeForLocation = '+
				XULBrowserWindow.hideChromeForLocation.toSource().replace(
					'{',
					'{ if (gBrowser.treeStyleTab.isVertical) return false;\n'
				)
			);
		}

		{
		  let functions = [
				'window.duplicateTab.handleLinkClick',
				'window.duplicatethistab.handleLinkClick',
				'window.__treestyletab__highlander__origHandleLinkClick',
				'window.__splitbrowser__handleLinkClick',
				'window.__ctxextensions__handleLinkClick',
				'window.handleLinkClick'
			];
			for (let i = 0, maxi = functions.length; i < maxi; i++)
			{
				let func = functions[i];
				let source = this._getFunctionSource(func);
				if (!source || !/^\(?function handleLinkClick/.test(source))
					continue;
				eval(func+' = '+source.replace(
					/(charset\s*:\s*doc\.characterSet\s*)/,
					'$1, event : event, linkNode : linkNode'
				));
				break;
			}
		}

		this.overrideExtensionsPreInit(); // windowHelperHacks.js
	},
 
	onBeforeBrowserInit : function TSTWH_onBeforeBrowserInit() 
	{
		this.overrideExtensionsBeforeBrowserInit(); // windowHelperHacks.js
		this.overrideGlobalFunctions();
		
    gBrowser.__treestyletab__swapBrowsersAndCloseOther = gBrowser.swapBrowsersAndCloseOther;
		gBrowser.swapBrowsersAndCloseOther = function(...args) {
			if (TreeStyleTabWindowHelper.runningDelayedStartup &&
				TreeStyleTabService.tearOffSubtreeFromRemote())
				return;
			return this.__treestyletab__swapBrowsersAndCloseOther.apply(this, args);
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

		if ('_setEffectAllowedForDataTransfer' in aObserver) {
			eval('aObserver._setEffectAllowedForDataTransfer = '+
				aObserver._setEffectAllowedForDataTransfer.toSource().replace(
					'{',
					'{ var TSTTabBrowser = this instanceof Ci.nsIDOMElement ? (this.tabbrowser || this) : gBrowser ; var TST = TSTTabBrowser.treeStyleTab;'
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
				)
			);
		}
	},
 
	overrideGlobalFunctions : function TSTWH_overrideGlobalFunctions() 
	{
		this.initToolbarItems();

		eval('nsContextMenu.prototype.openLinkInTab = '+
			nsContextMenu.prototype.openLinkInTab.toSource().replace(
				'{',
				'{\n' +
				'  TreeStyleTabService.handleNewTabFromCurrent(this.target.ownerDocument.defaultView);'
			)
		);
		eval('nsContextMenu.prototype.openFrameInTab = '+
			nsContextMenu.prototype.openFrameInTab.toSource().replace(
				'{',
				'{\n' +
				'  TreeStyleTabService.handleNewTabFromCurrent(this.target.ownerDocument.defaultView);'
			)
		);
		var viewImageMethod = ('viewImage' in nsContextMenu.prototype) ? 'viewImage' : 'viewMedia' ;
		eval('nsContextMenu.prototype.'+viewImageMethod+' = '+
			nsContextMenu.prototype[viewImageMethod].toSource().replace(
				'openUILink(',
				'TreeStyleTabService.onBeforeViewMedia(e, this.target.ownerDocument.defaultView); $&'
			)
		);
		eval('nsContextMenu.prototype.viewBGImage = '+
			nsContextMenu.prototype.viewBGImage.toSource().replace(
				'openUILink(',
				'TreeStyleTabService.onBeforeViewMedia(e, this.target.ownerDocument.defaultView); $&'
			)
		);
		eval('nsContextMenu.prototype.addDictionaries = '+
			nsContextMenu.prototype.addDictionaries.toSource().replace(
				'openUILinkIn(',
				'TreeStyleTabService.onBeforeOpenLink(where, this.target.ownerDocument.defaultView); $&'
			)
		);

		if ('BrowserSearch' in window) {
			if ('_loadSearch' in BrowserSearch) {
				eval('BrowserSearch._loadSearch = '+
					BrowserSearch._loadSearch.toSource().replace(
						'openLinkIn(',
						'TreeStyleTabService.onBeforeBrowserSearch(arguments[0], useNewTab); $&'
					)
				);
			}
			else if ('loadSearch' in BrowserSearch) { // Firefox 24 and olders
				eval('BrowserSearch.loadSearch = '+
					BrowserSearch.loadSearch.toSource().replace(
						'openLinkIn(',
						'TreeStyleTabService.onBeforeBrowserSearch(arguments[0], useNewTab); $&'
					)
				);
			}
		}

		if ('openLinkIn' in window) {
			eval('window.openLinkIn = '+
				window.openLinkIn.toSource().replace(
					/^.*browser\.loadOneTab\(.*$/m,
					'TreeStyleTabService.onBeforeOpenLinkWithParams(params); $&'
				)
			);
		}

    {
      let functions = [
				'window.permaTabs.utils.wrappedFunctions["window.contentAreaClick"]',
				'window.__contentAreaClick',
				'window.__ctxextensions__contentAreaClick',
				'window.contentAreaClick'
			];
			for (let i = 0, maxi = functions.length; i < maxi; i++)
			{
				let func = functions[i];
				let source = this._getFunctionSource(func);
				if (!source || !/^\(?function contentAreaClick/.test(source))
					continue;
				eval(func+' = '+source.replace(
					// for Tab Utilities, etc. Some addons insert openNewTabWith() to the function.
					// (calls for the function is not included by Firefox default.)
					/(openNewTabWith\()/g,
					'TreeStyleTabService.onBeforeOpenNewTabByThirdParty(event.target.ownerDocument.defaultView); $1'
				));
			}
		}

		if (window.duplicateTabIn) {
			eval('window.duplicateTabIn = '+
				window.duplicateTabIn.toSource().replace(
					'{',
					'{ gBrowser.treeStyleTab.onBeforeTabDuplicate(aTab, where, delta); '
				)
			);
		}

    {
      let functions = [
				'permaTabs.utils.wrappedFunctions["window.BrowserHomeClick"]',
				'window.BrowserHomeClick',
				'window.BrowserGoHome'
			];
			for (let i = 0, maxi = functions.length; i < maxi; i++)
			{
				let func = functions[i];
				let source = this._getFunctionSource(func);
				if (!source || !/^\(?function (BrowserHomeClick|BrowserGoHome)/.test(source))
					continue;
				eval(func+' = '+source.replace(
					'gBrowser.loadTabs(',
					'TreeStyleTabService.readyToOpenNewTabGroup(gBrowser); $&'
				));
			}
		}

		eval('FeedHandler.loadFeed = '+
			FeedHandler.loadFeed.toSource().replace(
				'openUILink(',
				'TreeStyleTabService.onBeforeViewMedia(event, gBrowser); $&'
			)
		);

    // pale moon 28 and above
    if( 'showNavToolbox' in FullScreen ) {
      eval('FullScreen.showNavToolbox = '+
        FullScreen.showNavToolbox.toSource().replace(
          'this._isChromeCollapsed = false;',
          'gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN); $&'
        )
      );
      eval('FullScreen.hideNavToolbox = '+
        FullScreen.hideNavToolbox.toSource().replace(
          'this._isChromeCollapsed = true;',
          'gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN); $&'
        )
      );
    } else {  // older versions
      eval('FullScreen.mouseoverToggle = '+
        FullScreen.mouseoverToggle.toSource().replace(
          'this._isChromeCollapsed = !aShow;',
          'gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_FULLSCREEN); $&'
        )
      );
    }
		eval('FullScreen.toggle = '+
			FullScreen.toggle.toSource().replace(
				'if (enterFS) {',
				' gBrowser.treeStyleTab.onBeforeFullScreenToggle(enterFS); $&'
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

		if ('TabsOnTop' in window && TabsOnTop.syncUI) {
			eval('TabsOnTop.syncUI = '+TabsOnTop.syncUI.toSource().replace(
				/(\}\)?)$/,
				'gBrowser.treeStyleTab.onTabsOnTopSyncCommand(enabled); $&'
			));
		}

		if ('toggleSidebar' in window) {
			eval('window.toggleSidebar = '+
				window.toggleSidebar.toSource().replace(
					'{',
					'{ gBrowser.treeStyleTab.updateFloatingTabbar(gBrowser.treeStyleTab.kTABBAR_UPDATE_BY_TOGGLE_SIDEBAR);'
				)
			);
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
	_getFunctionSource : function TSTWH__getFunctionSource(aFunc)
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
 
	initToolbarItems : function TSTWH_initToolbarItems() 
	{
		var searchbar = document.getElementById('searchbar');
		if (searchbar &&
			searchbar.doSearch &&
			searchbar.doSearch.toSource().toSource().indexOf('TreeStyleTabService') < 0) {
			eval('searchbar.doSearch = '+searchbar.doSearch.toSource().replace(
				/(openUILinkIn\(.+?\);)/,
				'TreeStyleTabService.onBeforeBrowserSearch(arguments[0]);\n' +
				'$1\n' +
				'TreeStyleTabService.stopToOpenChildTab();'
			));
		}

		var goButton = document.getElementById('urlbar-go-button');
		if (goButton)
			goButton.parentNode.addEventListener('click', this.service, true);

		var tabbar = this.service.getTabStrip(this.service.browser);
		tabbar.addEventListener('click', this.service, true);

		var newTabButton = document.getElementById('new-tab-button');
		var nsIDOMNode = Ci.nsIDOMNode;
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
		var nsIDOMNode = Ci.nsIDOMNode;
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

		{
		  let source = b.moveTabForward.toSource();
			eval('b.moveTabForward = '+
				source.replace(
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
				)
			);
		}

		{
		  let source = b.moveTabBackward.toSource();
			eval('b.moveTabBackward = '+
				source.replace(
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
				)
			);
		}

		eval('b.loadTabs = '+
			b.loadTabs.toSource().replace(
				/(?:let|var) tabNum = /,
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
			)
		);

		if ('_beginRemoveTab' in b) {
			eval('b._beginRemoveTab = '+
				b._beginRemoveTab.toSource().replace(
					'if (this.tabs.length - this._removingTabs.length == 1) {',
					'if (this.tabs.length - this._removingTabs.length == 1 || this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab)) {'
				).replace(
					'this._removingTabs.length == 0',
					'(this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab) || $&)'
				)
			);
		}

		eval('b.removeCurrentTab = '+b.removeCurrentTab.toSource().replace(
			'{',
			'{ if (!this.treeStyleTab.warnAboutClosingTabSubtreeOf(this.selectedTab)) return;'
		));
	},
 
	initTabbarMethods : function TSTWH_initTabbarMethods(aTabBrowser) 
	{
		var b = aTabBrowser;

		var source = b.mTabContainer.advanceSelectedTab.toSource();
		if (source.indexOf('treeStyleTab.handleAdvanceSelectedTab') < 0) {
			eval('b.mTabContainer.advanceSelectedTab = '+
				source.replace(
					'{',
					'{\n' +
					'  var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;\n' +
					'  if (treeStyleTab.handleAdvanceSelectedTab(arguments[0], arguments[1]))\n' +
					'    return;'
				)
			);
		}

		source = b.mTabContainer._notifyBackgroundTab.toSource();
		if (source.indexOf('TreeStyleTabService.getTabBrowserFromChild') < 0) {
			eval('b.mTabContainer._notifyBackgroundTab = '+
				source.replace(
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
				)
			);
		}

		if (b.tabContainer && '_getDropIndex' in b.tabContainer) {
			eval('b.tabContainer._getDropIndex = '+
				b.tabContainer._getDropIndex.toSource().replace(
					/\.screenX/g, '[this.treeStyleTab.screenPositionProp]'
				).replace(
					/\.width/g, '[this.treeStyleTab.sizeProp]'
				)
			);
		}

		/**
		 * The default implementation fails to scroll to tab if it is expanding.
		 * So we have to inject codes to override its effect.
		 */
		{
		  let scrollbox = aTabBrowser.treeStyleTab.scrollBox;
			let source = scrollbox.ensureElementIsVisible.toSource();
			if (
				source.indexOf('treeStyleTab') < 0 && // not updated yet
				source.indexOf('ensureTabIsVisible') < 0 // not replaced by Tab Mix Plus
				) {
				eval('scrollbox.ensureElementIsVisible = '+
					source.replace(
						'{',
						'{\n' +
						'  var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;\n' +
						'  if (treeStyleTab && treeStyleTab.shouldCancelEnsureElementIsVisible())\n' +
						'    return;\n' +
						'  if (\n' +
						'      treeStyleTab &&\n' +
						'      (arguments.length == 1 || arguments[1])\n' +
						'    )\n' +
						'    return treeStyleTab.scrollToTab(arguments[0]);'
					)
				);
			}
		}

		{
		  let popup = document.getElementById('alltabs-popup');
			if (popup && '_updateTabsVisibilityStatus' in popup) {
				eval('popup._updateTabsVisibilityStatus = '+
					popup._updateTabsVisibilityStatus.toSource().replace(
						'{',
						'{ var treeStyleTab = gBrowser.treeStyleTab;'
					).replace(
						/\.screenX/g, '[treeStyleTab.screenPositionProp]'
					).replace(
						/\.width/g, '[treeStyleTab.sizeProp]'
					)
				);
			}
		}
	
	}
 
}; 
  
