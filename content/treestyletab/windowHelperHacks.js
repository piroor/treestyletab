TreeStyleTabWindowHelper.extraProperties = [
	TreeStyleTabService.kID,
	TreeStyleTabService.kCOLLAPSED,
	TreeStyleTabService.kSUBTREE_COLLAPSED,
	TreeStyleTabService.kCHILDREN,
	TreeStyleTabService.kPARENT,
	TreeStyleTabService.kANCESTOR,
	TreeStyleTabService.kINSERT_BEFORE,
	TreeStyleTabService.kINSERT_AFTER
];

TreeStyleTabWindowHelper.overrideExtensionsPreInit = function TSTWH_overrideExtensionsPreInit() {
	var sv = this.service;

	// Highlander
	// https://addons.mozilla.org/firefox/addon/4086
	if ('Highlander' in window &&
		sv.getTreePref('compatibility.Highlander')) {
		eval('Highlander.overrideHandleLinkClick = '+
			Highlander.overrideHandleLinkClick.toSource().replace(
				/(var )?origHandleLinkClick/g,
				'window.__treestyletab__highlander__origHandleLinkClick'
			)
		);
	}

	// PermaTabs
	// https://addons.mozilla.org/firefox/addon/2558
	// PermaTabs Mod
	// https://addons.mozilla.org/firefox/addon/7816
	if ('permaTabs' in window &&
		sv.getTreePref('compatibility.PermaTabs')) {
		if ('__init' in permaTabs) {
			// without delay, Firefox crashes on startup.
			eval('permaTabs.__init = '+
				permaTabs.__init.toSource().replace(
					'aTab.setAttribute(\\"image\\", ',
					'window.setTimeout(function(aTab, aImage) { aTab.setAttribute(\\"image\\", aImage); }, 100, aTab, '
				)
			);
		}
		if ('showPermaTab' in permaTabs) {
			eval('permaTabs.showPermaTab = '+
				permaTabs.showPermaTab.toSource().replace(
					/(\}\)?)$/,
					<![CDATA[
						(function(tab, id) {
							if (this.ssWillRestore) return;
							var TST = TreeStyleTabService;
							if (this.TSTRestoredPermaTabsInfo === void(0)) {
								try {
									eval('this.TSTRestoredPermaTabsInfo = '+(TST.getTreePref('permaTabsInfo') || 'null'));
								}
								catch(e) {
								}
							}
							if (!this.TSTRestoredPermaTabsInfo) return;

							var info = this.TSTRestoredPermaTabsInfo[id];
							if (!info) return;

							for (var i in info)
							{
								TST.SessionStore.setTabValue(tab, i, info[i]);
							}
							var count = 0;
							window.setTimeout(function() {
								var b = TST.getTabBrowserFromChild(tab);
								if (!b.treeStyleTab) {
									if (++count < 50)
										window.setTimeout(arguments.callee, 100);
									return;
								}
								b.treeStyleTab.restoreStructure(tab);
							}, 0);
						}).call(this, tab, id)
					$1]]>
				)
			);
		}
		if ('savePermaTabs' in permaTabs) {
			eval('permaTabs.savePermaTabs = '+
				permaTabs.savePermaTabs.toSource().replace(
					'{',
					<![CDATA[$&
						(function() {
							var tabsInfo = {};
							var TST = TreeStyleTabService;
							Array.slice(getBrowser().mTabContainer.childNodes)
								.forEach(function(aTab) {
									var index = this.getPermaTabLocalIndex(aTab);
									if (index < 0) return;
									var info = {};
									TST.extraProperties.forEach(function(aProperty) {
										info[aProperty] = TST.getTabValue(aTab, aProperty);
									});
									tabsInfo[this.permaTabs[index].id] = info;
								}, this);
							TST.setTreePref('permaTabsInfo', tabsInfo.toSource());
						}).call(this);
					]]>
				)
			);
		}
	}

	// Tab Mix Plus
	if (sv.getTreePref('compatibility.TMP')) {
		document.documentElement.setAttribute('treestyletab-enable-compatibility-tmp', true);
	}
	// Tab Mix Plus, SessionStore API
	if (
		sv.getTreePref('compatibility.TMP') &&
		('TabmixSessionData' in window || 'SessionData' in window)
		) {
		let sessionData = window.TabmixSessionData || window.SessionData;
		if ('getTabProperties' in sessionData && 'setTabProperties' in sessionData) {
			let prefix = sv.kTMP_SESSION_DATA_PREFIX;
			let sessionManager = window.TabmixSessionManager || window.SessionManager;
			SessionData.tabTSTProperties = this.extraProperties.map(function(aProperty) {
				return prefix+aProperty;
			});
			eval('sessionData.getTabProperties = '+
				sessionData.getTabProperties.toSource().replace(
					'return tabProperties;',
					<![CDATA[
						this.tabTSTProperties.forEach(function(aProp) {
							tabProperties += '|' + aProp + '=' + encodeURIComponent(aTab.getAttribute(aProp));
						});
					$&]]>
				)
			);
			eval('sessionData.setTabProperties = '+
				sessionData.setTabProperties.toSource().replace(
					'{',
					<![CDATA[$&
						var TSTProps = tabProperties.split('|');
						tabProperties = TSTProps.shift();
						TSTProps.forEach(function(aSet) {
							var index = aSet.indexOf('=');
							var name = aSet.substring(0, index);
							var value = decodeURIComponent(aSet.substring(index+1));
							if (name && value)
								aTab.setAttribute(name, value);
						});
					]]>
				)
			);
			eval('sessionManager.loadOneTab = '+
				sessionManager.loadOneTab.toSource().replace(
					/(\}\))?$/,
					<![CDATA[
						if (gBrowser.treeStyleTab.useTMPSessionAPI)
							gBrowser.treeStyleTab.restoreStructure(aTab);
					$1]]>
				)
			);
			let source = tablib.init.toSource().split('gBrowser.restoreTab = ');
			source[1] = source[1].replace(
				'return newTab;',
				<![CDATA[
					if (this.treeStyleTab.useTMPSessionAPI)
						this.treeStyleTab.restoreStructure(newTab);
				$&]]>
			);
			eval('tablib.init = '+source.join('gBrowser.restoreTab = '));
			eval('sessionManager.loadOneWindow = '+
				sessionManager.loadOneWindow.toSource().replace(
					'gBrowser.tabsToLoad = ',
					<![CDATA[
						gBrowser.treeStyleTab.resetAllTabs(true, true);
						TreeStyleTabService.restoringTree = true;
					$&]]>
				).replace(
					/(\}\))?$/,
					'TreeStyleTabService.restoringTree = false; $1'
				)
			);
			sv.useTMPSessionAPI = true;
		}
	}

	// Session Manager
	// https://addons.mozilla.org/firefox/addon/2324
	// We need to initialize TST before Session Manager restores the last session anyway!
	if ('gSessionManager' in window &&
		sv.getTreePref('compatibility.SessionManager')) {
		if ('onLoad_proxy' in gSessionManager &&
			'onLoad' in gSessionManager) {
			eval('gSessionManager.onLoad = '+gSessionManager.onLoad.toSource().replace(
				'{',
				'{ TreeStyleTabService.init();'
			));
		}
		if ('load' in gSessionManager) {
			eval('gSessionManager.load = '+gSessionManager.load.toSource().replace(
				'var tabcount = ',
				<![CDATA[
					gBrowser.treeStyleTab.collapseExpandAllSubtree(false, true);
					gBrowser.treeStyleTab.getTabsArray(gBrowser)
						.slice(1)
						.reverse()
						.forEach(function(aTab, aIndex) {
							gBrowser.removeTab(aTab);
						});
					TreeStyleTabService.restoringTree = true;
				$&]]>
			));
		}
	}

	// FullerScreen
	// https://addons.mozilla.org/firefox/addon/4650
	if ('FS_onFullerScreen' in window &&
		sv.getTreePref('compatibility.FullerScreen')) {
		'CheckIfFullScreen,FS_onFullerScreen,FS_onMouseMove'.split(',').forEach(function(aFunc) {
			if (!(aFunc in window)) return;
			eval('window.'+aFunc+' = '+window[aFunc].toSource().replace(
				/FS_data.mTabs.(removeAttribute\("moz-collapsed"\)|setAttribute\("moz-collapsed", "true"\));/g,
				'if (gBrowser.treeStyleTab.currentTabbarPosition == "top") { $& }'
			));
		}, this);
	}

	// TooManyTabs
	// https://addons.mozilla.org/firefox/addon/9429
	if ('tooManyTabs' in window &&
		sv.getTreePref('compatibility.TooManyTabs')) {
		sv.registerExpandTwistyAreaBlocker('tooManyTabs');
	}

	// DragNDrop Toolbars
	// https://addons.mozilla.org/firefox/addon/dragndrop-toolbars/
	if ('globDndtb' in window &&
		globDndtb.setTheStuff &&
		sv.isGecko2 &&
		sv.getTreePref('compatibility.DragNDropToolbars')) {
		let reinitTabbar = function() {
				TreeStyleTabService.stopRendering();
				gBrowser.treeStyleTab.syncDestroyTabbar();
				window.setTimeout(function() {
					gBrowser.treeStyleTab.syncReinitTabbar();
					TreeStyleTabService.startRendering();
				}, 100);
			};
		globDndtb.__treestyletab__setOrder = globDndtb.setOrder;
		globDndtb.setOrder = function() {
			reinitTabbar();
			return this.__treestyletab__setOrder.apply(this, arguments);
		};
		globDndtb.__treestyletab__setTheStuff = globDndtb.setTheStuff;
		globDndtb.setTheStuff = function() {
			var result = this.__treestyletab__setTheStuff.apply(this, arguments);
			if (this.dndObserver &&
				this.dndObserver.onDrop &&
				!this.dndObserver.__treestyletab__onDrop) {
				this.dndObserver.__treestyletab__onDrop = this.dndObserver.onDrop;
				this.dndObserver.onDrop = function(aEvent, aDropData, aSession) {
					if (document.getElementById(aDropData.data) == gBrowser.treeStyleTab.tabStrip) {
						reinitTabbar();
					}
					return this.__treestyletab__onDrop.apply(this, arguments);
				};
			}
			return result;
		};
	}

	// Optimoz Tweaks
	// http://optimoz.mozdev.org/tweaks/
	// https://addons.mozilla.org/firefox/addon/optimoz-tweaks-ja-version/
	if ('mtSidebarStartup' in window &&
		'mtSidebarShutdown' in window &&
		'mtPreventHiding' in window &&
		sv.isGecko2 &&
		sv.getTreePref('compatibility.OptimozTweaks')) {
		eval('window.mtSidebarStartup = '+window.mtSidebarStartup.toSource().replace(
			'{',
			<![CDATA[{
				document.getElementById('TabsToolbar')
					.addEventListener('mousemove', mtMouseMoveListener, false);
			]]>.toString()
		));
		eval('window.mtSidebarShutdown = '+window.mtSidebarShutdown.toSource().replace(
			'{',
			<![CDATA[{
				document.getElementById('TabsToolbar')
					.removeEventListener('mousemove', mtMouseMoveListener, false);
			]]>.toString()
		));
		eval('window.mtPreventHiding = '+window.mtPreventHiding.toSource().replace(
			'{',
			<![CDATA[{
				if (TreeStyleTabService.getTabbarFromEvent(arguments[0]))
					return;
			]]>.toString()
		));
	}

	/**
	 * Hide Caption Titlebar Plus (Smart)
	 * https://addons.mozilla.org/firefox/addon/hide-caption-titlebar-plus-sma/
	 */
	if ('HideCaption' in window &&
		'do_alter' in HideCaption) {
		eval('HideCaption.do_alter = '+HideCaption.do_alter.toSource().replace(
			'if (!theSettings) {',
			<![CDATA[
				if (!theSettings ||
					gBrowser.treeStyleTab.isVertical) {
			]]>
		));
	}
};

TreeStyleTabWindowHelper.overrideExtensionsBeforeBrowserInit = function TSTWH_overrideExtensionsBeforeBrowserInit() {
	var sv = this.service;

	// Tab Mix Plus
	if (sv.getTreePref('compatibility.TMP') &&
		'TMP_LastTab' in window) {
		TMP_LastTab.TabBar = gBrowser.mTabContainer;
	}
	if (sv.getTreePref('compatibility.TMP') &&
		'isTabVisible' in gBrowser.mTabContainer &&
		'ensureTabIsVisible' in gBrowser.mTabContainer) {
		function replaceHorizontalProps(aString)
		{
			return aString.replace(
					/boxObject\.x/g,
					'boxObject[posProp]'
				).replace(
					/boxObject\.screenX/g,
					'boxObject[screenPosProp]'
				).replace(
					/boxObject\.width/g,
					'boxObject[sizeProp]'
				).replace(
					'{',
					<![CDATA[$&
						var posProp = gBrowser.treeStyleTab.isVertical ? 'y' : 'x' ;
						var screenPosProp = gBrowser.treeStyleTab.isVertical ? 'screenY' : 'screenX' ;
						var sizeProp = gBrowser.treeStyleTab.isVertical ? 'height' : 'width' ;
					]]>
				)
		}
		eval('gBrowser.mTabContainer.ensureTabIsVisible = '+
			replaceHorizontalProps(gBrowser.mTabContainer.ensureTabIsVisible.toSource().replace(
				'boxObject.width < 250',
				'$& || gBrowser.treeStyleTab.isVertical'
			))
		);
		eval('gBrowser.mTabContainer.isTabVisible = '+
			replaceHorizontalProps(gBrowser.mTabContainer.isTabVisible.toSource())
		);
	}

	// Tabberwocky
	// https://addons.mozilla.org/firefox/addon/14439
	if ('tabberwocky' in window &&
		sv.getTreePref('compatibility.Tabberwocky')) {
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'TreeStyleTabTabbarPositionChanged':
							var b = aEvent.originalTarget;
							if (b.treeStyleTab.isVertical)
								b.treeStyleTab.setPref('tabberwocky.multirow', false);
							break;

						case 'unload':
							document.removeEventListener('TreeStyleTabTabbarPositionChanged', this, false);
							document.removeEventListener('unload', this, false);
							break;
					}
				}
			};
		document.addEventListener('TreeStyleTabTabbarPositionChanged', listener, false);
		document.addEventListener('unload', listener, false);

		if ('openSelectedLinks' in tabberwocky) {
			eval('tabberwocky.openSelectedLinks = '+
				tabberwocky.openSelectedLinks.toSource().replace(
					'links.forEach(',
					<![CDATA[
						TreeStyleTabService.readyToOpenChildTab(aFrame, true)
					$&]]>
				).replace(
					/(\}\)?)$/,
					<![CDATA[
						TreeStyleTabService.stopToOpenChildTab(aFrame)
					$1]]>
				)
			);
		}
	}
};

TreeStyleTabWindowHelper.overrideExtensionsAfterBrowserInit = function TSTWH_overrideExtensionsAfterBrowserInit() {
	var sv = this.service;

	// Selection Links
	// https://addons.mozilla.org/firefox/addon/8644
	if ('selectionlinks' in window &&
		'parseSelection' in selectionlinks &&
		sv.getTreePref('compatibility.SelectionLinks')) {
		eval('selectionlinks.parseSelection = '+
			selectionlinks.parseSelection.toSource().replace(
				/((?:[^\s:;]+.selectedTab\s*=\s*)?([^\s:;]+).addTab\()/g,
				<![CDATA[
					if ($2.treeStyleTab)
						$2.treeStyleTab.readyToOpenChildTab(focusedWindow);
				$1]]>
			)
		);
	}


	// Tab Mix Plus
	if (
		sv.getTreePref('compatibility.TMP') &&
		'TabmixTabbar' in window
		) {
		let DNDObserver = 'TMP_tabDNDObserver' in window ? TMP_tabDNDObserver : TabDNDObserver ;
		this.updateTabDNDObserver(DNDObserver);
		eval('DNDObserver.clearDragmark = '+
			DNDObserver.clearDragmark.toSource().replace(
				/(\})(\))?$/,
				'gBrowser.treeStyleTab.tabbarDNDObserver.clearDropPosition(); $1$2'
			)
		);
		eval('DNDObserver.onDragStart = '+
			DNDObserver.onDragStart.toSource().replace(
				'event.target.localName != "tab"',
				<![CDATA[
					gBrowser.treeStyleTab.tabbarDNDObserver.canDragTabbar(event) ||
					$&
				]]>
			)
		);

		eval('window.TMP_howToOpen = '+
			window.TMP_howToOpen.toSource().replace(
				/(window.openNewTabWith\()/g,
				'TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView); $1'
			)
		);

		if ('TabmixContext' in window &&
			typeof TabmixContext.openMultipleLinks == 'function') {
			eval('TabmixContext.openMultipleLinks = '+
				TabmixContext.openMultipleLinks.toSource().replace(
					/(TMP_loadTabs\([^\)]+\);)/g,
					'TreeStyleTabService.readyToOpenChildTab(gBrowser, true); $1 TreeStyleTabService.stopToOpenChildTab(gBrowser);'
				)
			);
		}


		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case sv.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED:
							TabmixTabbar.updateScrollStatus();
							break;

						case sv.kEVENT_TYPE_FOCUS_NEXT_TAB:
							let mode = sv.getPref('extensions.tabmix.focusTab');
							if (mode != 2 && mode != 5)
								aEvent.preventDefault();
							break;

						case 'unload':
							document.removeEventListener(sv.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, this, false);
							document.removeEventListener(sv.kEVENT_TYPE_FOCUS_NEXT_TAB, this, false);
							document.removeEventListener('unload', this, false);
							break;
					}
				}
			};
		document.addEventListener(sv.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, listener, false);
		document.addEventListener(sv.kEVENT_TYPE_FOCUS_NEXT_TAB, listener, false);
		document.addEventListener('unload', listener, false);

		gBrowser.treeStyleTab.internallyTabMovingCount++; // until "TMmoveTabTo" method is overwritten
	}


	// Super DragAndGo
	// https://addons.mozilla.org/firefox/addon/137
	if ('superDrag' in window &&
		sv.getTreePref('compatibility.SuperDragAndGo')) {
		eval('superDrag.onDrop = '+
			superDrag.onDrop.toSource().replace(
				/(var newTab = getBrowser\(\).addTab\([^\)]+\);)/g,
				<![CDATA[
					if (aDragSession.sourceNode &&
						aDragSession.sourceNode.ownerDocument.defaultView.top == getBrowser().contentWindow)
						TreeStyleTabService.readyToOpenChildTab(getBrowser());
					$1
				]]>
			)
		);
	}

	// Drag de Go
	// https://addons.mozilla.org/firefox/addon/2918
	if ('ddg_ges' in window &&
		sv.getTreePref('compatibility.DragDeGo')) {
		eval('ddg_ges.Open = '+
			ddg_ges.Open.toSource().replace(
				'if (mode[1] == "h" || mode[1] == "f") {',
				<![CDATA[$&
					if ('sourceNode' in aData) // only for dragging from the content tarea.
						TreeStyleTabService.readyToOpenChildTab(getBrowser());
				]]>
			)
		);
		eval('ddg_ges.Search = '+
			ddg_ges.Search.toSource().replace(
				'if (mode[1] == "h" || mode[1] == "f") {',
				<![CDATA[$&
						TreeStyleTabService.readyToOpenChildTab(getBrowser());
				]]>
			)
		);
	}

	// Colorful Tabs
	// https://addons.mozilla.org/firefox/addon/1368
	if ('colorfulTabs' in window &&
		sv.getTreePref('compatibility.ColorfulTabs')) {
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'TreeStyleTabAttached':
						case 'TreeStyleTabParted':
							var child = aEvent.originalTarget;
							var parent = aEvent.parentTab;
							if (child && parent) {
								colorfulTabs.setColor(child, TreeStyleTabService.SessionStore.getTabValue(parent, 'tabClr'));
							}
							else if (child) {
								TreeStyleTabService.SessionStore.setTabValue(child, 'tabClr', '');
								colorfulTabs.calcTabClr({
									target : child,
									originalTarget : child,
								});
							}
							break;

						case 'unload':
							document.removeEventListener('TreeStyleTabAttached', this, false);
							document.removeEventListener('TreeStyleTabParted', this, false);
							document.removeEventListener('unload', this, false);
							break;
					}
				}
			};
		eval('colorfulTabs.show_ctStack = '+
			colorfulTabs.show_ctStack.toSource().replace(
				'.setProperty("display", "-moz-stack", "important")',
				'.display = ""'
			)
		);
		document.addEventListener('TreeStyleTabAttached', listener, false);
		document.addEventListener('TreeStyleTabParted', listener, false);
		document.addEventListener('unload', listener, false);
	}

	// FLST (Focus Last Selected Tab)
	// https://addons.mozilla.org/firefox/addon/32
	if ('flst' in window &&
		sv.getTreePref('compatibility.FLST')) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !aTabBrowser.treeStyleTab.getPref('extensions.flst.enabled');
		});
	}

	// Focus Last Selected Tab 0.9.5.x
	// http://www.gozer.org/mozilla/extensions/
	if (sv.getTreePref('compatibility.FocusLastSelectedTab')) {
		sv.extensions.isAvailable('focuslastselectedtab@gozer.org', { ok : function() {
			TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
				return !aTabBrowser.selectedTab.hasAttribute('lastselected');
			});
		}});
	}

	// LastTab
	// https://addons.mozilla.org/firefox/addon/112
	if ('LastTab' in window &&
		sv.getTreePref('compatibility.LastTab')) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !aTabBrowser.treeStyleTab.getPref('extensions.lasttab.focusLastTabOnClose');
		});
	}

	// FireGestures
	// https://addons.mozilla.org/firefox/addon/6366
	if ('FireGestures' in window &&
		sv.getTreePref('compatibility.FireGestures')) {
		eval('FireGestures.onExtraGesture = '+
			FireGestures.onExtraGesture.toSource().replace(
				'case "keypress-stop":',
				<![CDATA[$&
					TreeStyleTabService.readyToOpenChildTab(gBrowser, true);
				]]>
			).replace(
				'break;case "gesture-timeout":',
				<![CDATA[
					TreeStyleTabService.stopToOpenChildTab(gBrowser);
				$&]]>
			)
		);
		eval('FireGestures._performAction = '+
			FireGestures._performAction.toSource().replace(
				'gBrowser.loadOneTab(',
				<![CDATA[
					TreeStyleTabService.readyToOpenChildTab(gBrowser);
				$&]]>
			)
		);
		eval('FireGestures.openURLsInSelection = '+
			FireGestures.openURLsInSelection.toSource().replace(
				'var tab =',
				<![CDATA[
					if (!TreeStyleTabService.checkToOpenChildTab(gBrowser))
						TreeStyleTabService.readyToOpenChildTab(gBrowser, true);
				$&]]>
			).replace(
				'if (!flag)',
				<![CDATA[
					if (TreeStyleTabService.checkToOpenChildTab(gBrowser))
						TreeStyleTabService.stopToOpenChildTab(gBrowser);
				$&]]>
			)
		);
		eval('FireGestures.handleEvent = '+
			FireGestures.handleEvent.toSource().replace(
				'gBrowser.loadOneTab(',
				<![CDATA[
					TreeStyleTabService.readyToOpenChildTab(gBrowser);
				$&]]>
			)
		);
	}

	// Mouse Gestures Redox
	// http://www.mousegestures.org/
	if ('mgBuiltInFunctions' in window &&
		'mgLinkInTab' in mgBuiltInFunctions &&
		sv.getTreePref('compatibility.MouseGesturesRedox')) {
		eval('mgBuiltInFunctions.mgLinkInTab = '+
			mgBuiltInFunctions.mgLinkInTab.toSource().replace(
				'var tab',
				'TreeStyleTabService.readyToOpenChildTab(gBrowser); $&'
			)
		);
	}

	// Greasemonkey
	// https://addons.mozilla.org/firefox/addon/748
	if ('GM_BrowserUI' in window &&
		'openInTab' in GM_BrowserUI &&
		sv.getTreePref('compatibility.Greasemonkey')) {
		eval('GM_BrowserUI.openInTab = '+
			GM_BrowserUI.openInTab.toSource().replace(
				/(if\s*\(this\.isMyWindow\([^\)]+\)\)\s*\{\s*)(this\.tabBrowser)/,
				'$1 TreeStyleTabService.readyToOpenChildTab($2); $2'
			)
		);
	}

	// SBM Counter
	// http://miniturbo.org/products/sbmcounter/
	if ('SBMCounter' in window &&
		sv.getTreePref('compatibility.SBMCounter')) {
		eval('SBMCounter.action = '+
			SBMCounter.action.toSource().replace(
				'gBrowser.selectedTab = gBrowser.addTab',
				'TreeStyleTabService.readyToOpenChildTab(gBrowser); $&'
			)
		);
	}

	// Aging Tabs
	// https://addons.mozilla.org/firefox/addon/3542
	if ('agingTabs' in window &&
		sv.getTreePref('compatibility.AgingTabs')) {
		eval('agingTabs.setColor = '+
			agingTabs.setColor.toSource().replace(
				'{',
				'{ important = true;'
			)
		);
	}

	// Snap Links
	// https://addons.mozilla.org/firefox/addon/4336
	// Snap Links Plus
	// http://snaplinks.mozdev.org/
	if (sv.getTreePref('compatibility.SnapLinks')) {
		if ('executeAction' in window &&
			'openTabs' in window) {
			eval('window.openTabs = '+
				window.openTabs.toSource().replace(
					/((sContent|gBrowser|getBrowser\(\))\.addTab)/,
					'TreeStyleTabService.readyToOpenChildTab($2); $1'
				)
			);
		}
		if ('SnapLinks' in window &&
			'OpenTabs' in SnapLinks) {
			eval('SnapLinks.OpenTabs = '+
				SnapLinks.OpenTabs.toSource().replace(
					/((sContent|gBrowser|getBrowser\(\))\.addTab)/,
					'TreeStyleTabService.readyToOpenChildTab($2); $1'
				)
			);
		}
	}

	// Mouseless Browsing
	// https://addons.mozilla.org/firefox/addon/879
	if ('mouselessbrowsing' in window &&
		'EventHandler' in mouselessbrowsing &&
		sv.getTreePref('compatibility.MouselessBrowsing')) {
		if ('execute' in mouselessbrowsing.EventHandler) {
			eval('mouselessbrowsing.EventHandler.execute = '+
				mouselessbrowsing.EventHandler.execute.toSource().replace(
					'{',
					'{ var Prefs = mlb_common.Prefs;'+
					'  var Utils = mlb_common.Utils;'+
					'  var MlbUtils = mouselessbrowsing.MlbUtils;'
				).replace(
					/((?:var [^=]+ = )?Utils.openUrlInNewTab\()/g,
					'TreeStyleTabService.readyToOpenChildTab(); $1'
				)
			);
		}
		if ('openLinkInOtherLocationViaPostfixKey' in mouselessbrowsing.EventHandler) {
			eval('mouselessbrowsing.EventHandler.openLinkInOtherLocationViaPostfixKey = '+
				mouselessbrowsing.EventHandler.openLinkInOtherLocationViaPostfixKey.toSource().replace(
					'{',
					'{ var Prefs = mlb_common.Prefs;'+
					'  var Utils = mlb_common.Utils;'+
					'  var MlbUtils = mouselessbrowsing.MlbUtils;'+
					'  var MlbCommon = mouselessbrowsing.MlbCommon;'+
					'  var ShortcutManager = mlb_common.ShortcutManager;'
				).replace(
					'Utils.openUrlInNewTab(',
					'TreeStyleTabService.readyToOpenChildTab(); $&'
				)
			);
		}
	}

	// Linky
	// https://addons.mozilla.org/firefox/addon/425
	if ('LinkyContext' in window &&
		'prototype' in LinkyContext &&
		sv.getTreePref('compatibility.Linky')) {
		'doSelected,doSelectedText,doImages,doAll,doAllPics,doValidateAll,doValidateSelected'
			.split(',').forEach(function(aMethod) {
				if (!(aMethod in LinkyContext.prototype)) return;
				eval('LinkyContext.prototype.'+aMethod+' = '+
					LinkyContext.prototype[aMethod].toSource().replace(
						'{',
						'{ TreeStyleTabService.readyToOpenChildTab(null, true);'
					).replace(
						/(\}\)?)$/,
						'TreeStyleTabService.stopToOpenChildTab(); $1'
					)
				);
			});
	}

	// QuickDrag
	// https://addons.mozilla.org/firefox/addon/6912
	if ('QuickDrag' in window &&
		'_loadTab' in QuickDrag &&
		sv.getTreePref('compatibility.QuickDrag')) {
		eval('QuickDrag._loadTab = '+
			QuickDrag._loadTab.toSource().replace(
				/(gBrowser.loadOneTab\()/g,
				'TreeStyleTabService.readyToOpenChildTab(); $1'
			)
		);
	}

	// Autohide
	// http://www.krickelkrackel.de/autohide/
	if ('autoHIDE' in window &&
		sv.getTreePref('compatibility.Autohide')) {
		let autoHideEventListener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'TreeStyleTabAutoHideStateChanging':
							if (!window.fullScreen) return;
							if (!aEvent.shown) {
								if (
									autoHIDE.statBar &&
									gBrowser.treeStyleTab.currentTabbarPosition == 'bottom' &&
									!gBrowser.treeStyleTab.getPref('extensions.autohide.bars.statBar.always') &&
									gBrowser.treeStyleTab.getPref('extensions.autohide.bars.statBar')
									) {
									autoHIDE.statBar.setAttribute('ahHIDE', true);
								}
							}
							else {
								TreeStyleTabService.getTabStrip(gBrowser).removeAttribute('ahHIDE');
								if (
									autoHIDE.statBar &&
									aTabBrowser.treeStyleTab.currentTabbarPosition == 'bottom' &&
									!aTabBrowser.treeStyleTab.getPref('extensions.autohide.bars.statBar.always') &&
									aTabBrowser.treeStyleTab.getPref('extensions.autohide.bars.statBar')
									) {
									autoHIDE.statBar.removeAttribute('ahHIDE');
								}
							}
							break;

						case 'fullscreen':
							var treeStyleTab = gBrowser.treeStyleTab;
							if (gBrowser.treeStyleTab.currentTabbarPosition != 'top') {
								if (window.fullScreen)
									treeStyleTab.autoHide.endForFullScreen();
								else
									treeStyleTab.autoHide.startForFullScreen();
							}
							break;

						case 'unload':
							document.removeEventListener('TreeStyleTabAutoHideStateChanging', this, false);
							document.removeEventListener('unload', this, false);
							document.removeEventListener('fullscreen', this, false);
							break;
					}
				}
			};
		document.addEventListener('TreeStyleTabAutoHideStateChanging', autoHideEventListener, false);
		document.addEventListener('fullscreen', autoHideEventListener, false);
		document.addEventListener('unload', autoHideEventListener, false);

		if ('MoveContent' in autoHIDE) {
			eval('autoHIDE.MoveContent = '+autoHIDE.MoveContent.toSource().replace(
				/(;)([^;]*\.setPosition\(0, -\s*ah\.delta\);)/,
				<![CDATA[$1
					if (autoHIDE.winUtil)
						autoHIDE.winUtil.setRedraw(false, false);
					$2
					gBrowser.treeStyleTab.autoHide.extraYOffset = ah.delta;
					window.setTimeout(function() {
						gBrowser.treeStyleTab.autoHide.redrawContentArea();
						if (autoHIDE.winUtil)
							autoHIDE.winUtil.setRedraw(true, false);
					}, 0);
				]]>.toString()
			).replace(
				/(;)([^;]*\.setPosition\(0, 0\);)/,
				<![CDATA[$1
					if (autoHIDE.winUtil)
						autoHIDE.winUtil.setRedraw(false, false);
					$2
					gBrowser.treeStyleTab.autoHide.extraYOffset = 0;
					window.setTimeout(function() {
						gBrowser.treeStyleTab.autoHide.redrawContentArea();
						if (autoHIDE.winUtil)
							autoHIDE.winUtil.setRedraw(true, false);
					}, 0);
				]]>.toString()
			));
		}
	}


	// Google Toolbar Sidewiki
	if ('sidewikiWindowHandler' in window &&
		window.sidewikiWindowHandler &&
		sidewikiWindowHandler.barsContainer_ &&
		sidewikiWindowHandler.barsContainer_.geometry_ &&
		sidewikiWindowHandler.barsContainer_.geometry_.__proto__.getWindowSizeForDrawers &&
		sv.getTreePref('compatibility.GoogleToolbar.Sidewiki')) {
		let func = sidewikiWindowHandler.barsContainer_.geometry_.__proto__.getWindowSizeForDrawers.toSource();
		if (func.indexOf('treeStyleTab') < 0) {
			eval('sidewikiWindowHandler.barsContainer_.geometry_.__proto__.getWindowSizeForDrawers = '+func.replace(
				'return {',
				<![CDATA[
					if ('treeStyleTab' in this.topLevelDocument_.getElementById('content')) {
						let b = this.topLevelDocument_.getElementById('content');
						let box = b.mPanelContainer.boxObject;
						return {
							height       : box.height,
							width        : box.width,
							top          : box.y,
							left         : box.x,
							right        : this.topLevelWindow_.innerWidth - box.x - box.width,
							tabBoxHeight : 0
						};
					}
				$&]]>
			));
		}
	}


	// Smoothly Close Tabs
	// https://addons.mozilla.org/firefox/addon/71410
	if ('SMOOTHLYCLOSETABS' in window &&
		sv.getTreePref('compatibility.SmoothlyCloseTabs')) {
		let replaceScrollProps = function(aString) {
			return aString.replace(
					/\.scrollWidth/g,
					'[scrollProp]'
				).replace(
					/"width"/g,
					'sizeProp'
				).replace(
					/\.maxWidth/g,
					'[maxSizeProp]'
				).replace(
					'{',
					<![CDATA[$&
						var scrollProp = gBrowser.treeStyleTab.isVertical ? 'scrollHeight' : 'scrollWidth' ;
						var sizeProp = gBrowser.treeStyleTab.isVertical ? 'height' : 'width' ;
						var maxSizeProp = gBrowser.treeStyleTab.isVertical ? 'maxHeight' : 'maxWidth' ;
					]]>
				)
		}
		eval('SMOOTHLYCLOSETABS.shrinkTab = '+
			replaceScrollProps(SMOOTHLYCLOSETABS.shrinkTab.toSource())
		);
		eval('SMOOTHLYCLOSETABS.shrinkTabIcon = '+
			replaceScrollProps(SMOOTHLYCLOSETABS.shrinkTabIcon.toSource())
		);
	}

	// Super Tab Mode
	// https://addons.mozilla.org/firefox/addon/13288
	if ('stmM' in window &&
		sv.getTreePref('compatibility.STM')) {
		var observer = {
				domain : 'extensions.stm.',
				observe : function(aSubject, aTopic, aData)
				{
					switch (aData)
					{
						case 'extensions.stm.tabBarMultiRows':
						case 'extensions.stm.tabBarPosition':
							if (
								sv.getPref('extensions.stm.tabBarMultiRows') &&
								sv.getPref('extensions.stm.tabBarPosition') == 0
								) {
								sv.setPref('extensions.stm.tabBarMultiRows.override', false);
							}
							return;

						case 'extensions.stm.newTabBtnPos':
							if (TreeStyleTabService.getPref(aData) == 0)
								document.documentElement.removeAttribute(TreeStyleTabService.kHIDE_NEWTAB);
							else
								document.documentElement.setAttribute(TreeStyleTabService.kHIDE_NEWTAB, true);
							return;
					}
				}
			};
		observer.observe(null, null, 'extensions.stm.tabBarMultiRows');
		observer.observe(null, null, 'extensions.stm.newTabBtnPos');
		sv.addPrefListener(observer);
		document.addEventListener('unload', function() {
			document.removeEventListener('unload', arguments.callee, false);
			sv.removePrefListener(observer);
		}, false);

		let warnPref = 'extensions.treestyletab.compatibility.STM.warnForNewTabPosition';
		if (
			sv.getPref(warnPref) &&
			sv.getPref('extensions.stm.newTabPosition') != 0
			) {
			let checked = { value : false };
			if (sv.PromptService.confirmEx(
					null,
					sv.treeBundle.getString('compatibility_STM_warning_title'),
					sv.treeBundle.getString('compatibility_STM_warning_text'),
					(sv.PromptService.BUTTON_TITLE_IS_STRING * sv.PromptService.BUTTON_POS_0) +
					(sv.PromptService.BUTTON_TITLE_IS_STRING * sv.PromptService.BUTTON_POS_1),
					sv.treeBundle.getString('compatibility_STM_warning_use_TST'),
					sv.treeBundle.getString('compatibility_STM_warning_use_STM'),
					null,
					sv.treeBundle.getString('compatibility_STM_warning_never'),
					checked
				) == 0) {
				sv.setPref('extensions.stm.newTabPosition', 0);
			}
			if (checked.value)
				sv.setPref(warnPref, false);
		}

		sv.registerTabFocusAllowance(function(aTabBrowser) {
			return aTabBrowser.treeStyleTab.getPref('extensions.stm.focusAfterCloseTab') == 0;
		});
	}

	// Tab Utilities
	// https://addons.mozilla.org/firefox/addon/59961
	if ('tabutils' in window &&
		sv.getTreePref('compatibility.TabUtilities')) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return aTabBrowser.treeStyleTab.getPref('extensions.tabutils.selectOnClose') == 0;
		});
	}

	// Remove New Tab Button
	// https://addons.mozilla.org/firefox/addon/10535
	if (sv.getTreePref('compatibility.RemoveNewTabButton')) {
		sv.extensions.isAvailable('remove-new-tab-button@forerunnerdesigns.com', { ok : function() {
			document.documentElement.setAttribute(TreeStyleTabService.kHIDE_NEWTAB, true);
		}});
	}

	// IE Tab Plus
	// https://addons.mozilla.org/firefox/addon/10909/
	if ('IeTab' in window &&
		IeTab.prototype &&
		sv.getTreePref('compatibility.IETabPlus')) {
		if (IeTab.prototype.switchTabEngine)
			eval('IeTab.prototype.switchTabEngine = '+
				IeTab.prototype.switchTabEngine.toSource().replace(
					'var newTab = ',
					'TreeStyleTabService.readyToOpenChildTab(); $&'
				)
			);

		if (IeTab.prototype.addIeTab)
			eval('IeTab.prototype.addIeTab = '+
				IeTab.prototype.addIeTab.toSource().replace(
					'var newTab = ',
					'TreeStyleTabService.readyToOpenChildTab(); $&'
				)
			);
	}

	// Locationbar2
	// https://addons.mozilla.org/firefox/addon/locationbar²/
	if ('lb2_alternateStyles' in window &&
		sv.getTreePref('compatibility.Locationbar2')) {
		let listening = false;
		let listener = function(aEvent) {
				switch (aEvent.type)
				{
					case 'unload':
						document.removeEventListener('unload', listener, false);
						document.removeEventListener(sv.kEVENT_TYPE_BEFORE_TOOLBAR_CUSTOMIZATION, listener, false);
						document.removeEventListener(sv.kEVENT_TYPE_AFTER_TOOLBAR_CUSTOMIZATION, listener, false);
					case sv.kEVENT_TYPE_BEFORE_TOOLBAR_CUSTOMIZATION:
						if (gURLBar && listening)
							gURLBar.removeEventListener('click', listener, true);
						listening = false;
						return;

					case sv.kEVENT_TYPE_AFTER_TOOLBAR_CUSTOMIZATION:
						if (gURLBar && !listening) {
							gURLBar.addEventListener('click', listener, true);
							listening = true;
						}
						return;

					case 'click':
						if (sv.evaluateXPath(
								'ancestor-or-self::*['
									+'contains(concat(" ", normalize-space(@class), " "), " textbox-presentation-segment ")'
								+']',
								aEvent.originalTarget,
								Ci.nsIDOMXPathResult.BOOLEAN_TYPE
							).booleanValue)
							sv.readyToOpenChildTabNow(gBrowser.selectedTab);
						return;
				}
			};
		document.addEventListener('unload', listener, false);
		document.addEventListener(sv.kEVENT_TYPE_BEFORE_TOOLBAR_CUSTOMIZATION, listener, false);
		document.addEventListener(sv.kEVENT_TYPE_AFTER_TOOLBAR_CUSTOMIZATION, listener, false);
		if (gURLBar && !listening) {
			gURLBar.addEventListener('click', listener, true);
			listening = true;
		}
	}

	// InstaClick
	// https://addons.mozilla.org/firefox/addon/instaclick/
	if ('instaclick' in window &&
		'contentAreaClick2' in window.instaclick &&
		sv.getTreePref('compatibility.InstaClick')) {
		eval('instaclick.contentAreaClick2 = '+
			instaclick.contentAreaClick2.toSource().replace(
				'gBrowser.loadOneTab(',
				'TreeStyleTabService.readyToOpenChildTab(); $&'
			)
		);
	}

	// Duplicate This Tab
	// https://addons.mozilla.org/firefox/addon/duplicate-this-tab/
	if ('duplicatethistab' in window &&
		'openLinkWithHistory' in window.duplicatethistab &&
		sv.getTreePref('compatibility.DuplicateThisTab')) {
		eval('duplicatethistab.openLinkWithHistory = '+
			duplicatethistab.openLinkWithHistory.toSource().replace(
				'var newTab = ',
				'TreeStyleTabService.readyToOpenChildTab(); $&'
			)
		);
	}

	window.setTimeout(function(aSelf) {
		aSelf.overrideExtensionsDelayed();
	}, 0, this);
};


TreeStyleTabWindowHelper.overrideExtensionsDelayed = function TSTWH_overrideExtensionsDelayed() {
	var sv = this.service;

	// Tab Mix Plus
	if (sv.getTreePref('compatibility.TMP') &&
		'TabmixTabbar' in window) {
		// correct broken appearance of the first tab
		var t = gBrowser.treeStyleTab.getFirstTab(gBrowser);
		gBrowser.treeStyleTab.initTabAttributes(t);
		gBrowser.treeStyleTab.initTabContentsOrder(t);

		eval('gBrowser.openInverseLink = '+
			gBrowser.openInverseLink.toSource().replace(
				/(var newTab)/,
				'TreeStyleTabService.readyToOpenChildTab(aTab); $1'
			)
		);

		eval('gBrowser.TMP_openTabNext = '+
			gBrowser.TMP_openTabNext.toSource().replace(
				'this.mCurrentTab._tPos + this.tabContainer.nextTab',
				<![CDATA[
					(function() {
						var tabs = this.treeStyleTab.getDescendantTabs(this.mCurrentTab);
						if (tabs.length) {
							var index = this.treeStyleTab.getPref("extensions.tabmix.openTabNextInverse") ?
										tabs[tabs.length - 1]._tPos :
										this.mCurrentTab._tPos ;
							if (index < aTab._tPos) index++;
							return index;
						}
						else {
							return ($&);
						}
					}).call(this)
				]]>
			)
		);

		gBrowser.treeStyleTab.internallyTabMovingCount--;
	}

	// Multi Links
	// https://addons.mozilla.org/firefox/addon/13494
	if ('MultiLinks_Wrapper' in window &&
		'LinksManager' in MultiLinks_Wrapper &&
		'OpenInNewTabs' in MultiLinks_Wrapper.LinksManager &&
		sv.getTreePref('compatibility.MultiLinks')) {
		eval('MultiLinks_Wrapper.LinksManager.OpenInNewTabs = '+
			MultiLinks_Wrapper.LinksManager.OpenInNewTabs.toSource().replace(
				'{',
				<![CDATA[{
					if (!TreeStyleTabService.checkToOpenChildTab(getBrowser()))
						TreeStyleTabService.readyToOpenChildTab(getBrowser(), true);
				]]>
			).replace(
				/(\}\)?)$/,
				<![CDATA[
					if (TreeStyleTabService.checkToOpenChildTab(getBrowser()))
						TreeStyleTabService.stopToOpenChildTab(getBrowser());
				$1]]>
			)
		);
	}

	// DomainTab
	// https://addons.mozilla.org/firefox/addon/13906/
	if ('domaintab' in window &&
		'TMP_howToOpen' in domaintab &&
		sv.getTreePref('compatibility.DomainTab')) {
		eval('domaintab.TMP_howToOpen = '+
			domaintab.TMP_howToOpen.toSource().replace(
				/(domaintab.DT_openNewTabWith\()/g,
				'TreeStyleTabService.readyToOpenChildTab(); $1'
			)
		);
	}

	// Personal Titlebar
	// https://addons.mozilla.org/irefox/addon/personal-titlebar/
	if (document.getElementById('personal-titlebar') &&
		sv.getTreePref('compatibility.PersonalTitlebar')) {
		let titlebar = document.getElementById('titlebar');
		let personalTitlebar = document.getElementById('personal-titlebar');
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'beforecustomization':
							titlebar.removeEventListener('DOMAttrModified', this, true);
							gBrowser.treeStyleTab.destroyTabStrip(personalTitlebar);
							break;

						case 'aftercustomization':
							titlebar.addEventListener('DOMAttrModified', this, true);
							break;

						case 'DOMAttrModified':
							if (
								aEvent.attrName == 'hidden' &&
								gBrowser.tabContainer.parentNode.id == (aEvent.newValue == 'true' ? 'toolbar-menubar' : 'personal-titlebar' )
								) {
								TreeStyleTabService.stopRendering();
								gBrowser.treeStyleTab.syncDestroyTabbar();
								window.setTimeout(function() {
									gBrowser.treeStyleTab.syncReinitTabbar();
									TreeStyleTabService.startRendering();
								}, 0);
							}
							break;

						case 'unload':
							titlebar.removeEventListener('DOMAttrModified', this, true);
							document.removeEventListener('beforecustomization', this, false);
							document.removeEventListener('aftercustomization', this, false);
							document.removeEventListener('unload', this, false);
							personalTitlebar = null;
							break;
					}
				}
			};
		document.addEventListener('beforecustomization', listener, false);
		document.addEventListener('aftercustomization', listener, false);
		document.addEventListener('unload', listener, false);
		titlebar.addEventListener('DOMAttrModified', listener, true);
	}

	// TotalToolbar
	// http://totaltoolbar.mozdev.org/
	let (menu = document.getElementById('tt-toolbar-properties') &&
		sv.getTreePref('compatibility.TotalToolbar')) {
		if (menu) {
			let tabbarToolboxes = ['tt-toolbox-tabright', 'tt-toolbox-tableft']
									.map(document.getElementById, document)
									.filter(function(aToolbox) { return aToolbox; });
			let listener = {
					handleEvent : function(aEvent)
					{
						var sv = TreeStyleTabService;
						switch (aEvent.type)
						{
							case 'command':
								gBrowser.treeStyleTab.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_WINDOW_RESIZE);
								break;

							case sv.kEVENT_TYPE_BEFORE_TOOLBAR_CUSTOMIZATION:
								tabbarToolboxes.forEach(function(aToolbox) {
									aToolbox.removeAttribute('collapsed');
								});
								break;

							case sv.kEVENT_TYPE_AFTER_TOOLBAR_CUSTOMIZATION:
								tabbarToolboxes.forEach(function(aToolbox) {
									if (!aToolbox.firstChild.hasChildNodes())
										aToolbox.setAttribute('collapsed', true);
								});
								break;

							case 'unload':
								menu.removeEventListener('command', this, true);
								document.removeEventListener(sv.kEVENT_TYPE_BEFORE_TOOLBAR_CUSTOMIZATION, listener, false);
								document.removeEventListener(sv.kEVENT_TYPE_AFTER_TOOLBAR_CUSTOMIZATION, listener, false);
								document.removeEventListener('unload', this, false);
								menu = null;
								break;
						}
					}
				};
			menu.addEventListener('command', listener, false);
			document.addEventListener(sv.kEVENT_TYPE_BEFORE_TOOLBAR_CUSTOMIZATION, listener, false);
			document.addEventListener(sv.kEVENT_TYPE_AFTER_TOOLBAR_CUSTOMIZATION, listener, false);
			document.addEventListener('unload', listener, false);
			tabbarToolboxes.forEach(function(aToolbox) {
				if (!aToolbox.firstChild.hasChildNodes())
					aToolbox.setAttribute('collapsed', true);
			});
		}
	}

	// Firefox Sync (Weave)
	// http://www.mozilla.com/en-US/firefox/sync/
	if (
		(
			'gFxWeaveGlue' in window || // addon
			'gSyncUI' in window // Firefox 4 built-in
		) &&
		sv.getTreePref('compatibility.FirefoxSync')
		) {
		let ns = {};
		try { // 1.4
			Components.utils.import('resource://services-sync/service.js', ns);
		}
		catch(e) { // 1.3
			Components.utils.import('resource://weave/service.js', ns);
		}
		let engine = ns.Weave.Engines.get('tabs');
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'TabOpen':
							let tab = aEvent.originalTarget
							let b = TreeStyleTabService.getTabBrowserFromChild(tab);
							if (b.selectedTab.linkedBrowser.currentURI.spec != 'about:sync-tabs')
								return;

							let uri = tab.getAttribute('label');
							if (engine.locallyOpenTabMatchesURL(uri))
								return;

							for (let [guid, client] in Iterator(engine.getAllClients()))
							{
								if (client.tabs.some(function({ urlHistory }) {
										return urlHistory[0] == uri;
									})) {
									let parent = b.selectedTab;
									window.setTimeout(function() {
										if (tab.parentNode && !b.treeStyleTab.getParentTab(tab))
											b.treeStyleTab.attachTabTo(tab, parent);
									}, 0);
									return;
								}
							}
							return;

						case 'unload':
							document.removeEventListener('TabOpen', this, true);
							document.removeEventListener('unload', this, false);
							return;
					}
				}
			};
		document.addEventListener('TabOpen', listener, true);
		document.addEventListener('unload', listener, false);
	}

};
