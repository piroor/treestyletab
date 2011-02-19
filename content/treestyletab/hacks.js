TreeStyleTabService.extraProperties = [
	TreeStyleTabService.kID,
	TreeStyleTabService.kCOLLAPSED,
	TreeStyleTabService.kSUBTREE_COLLAPSED,
	TreeStyleTabService.kCHILDREN,
	TreeStyleTabService.kPARENT,
	TreeStyleTabService.kANCESTOR,
	TreeStyleTabService.kINSERT_BEFORE,
	TreeStyleTabService.kINSERT_AFTER
];

TreeStyleTabService.overrideExtensionsPreInit = function TSTService_overrideExtensionsPreInit() {

	// Highlander
	// https://addons.mozilla.org/firefox/addon/4086
	if ('Highlander' in window) {
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
	if ('permaTabs' in window) {
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
	if (this.getTreePref('compatibility.TMP')) {
		document.documentElement.setAttribute('treestyletab-enable-compatibility-tmp', true);
	}
	// Tab Mix Plus, SessionStore API
	if (
		this.getTreePref('compatibility.TMP') &&
		('SessionData' in window || 'TabmixSessionData' in window) &&
		('getTabProperties' in SessionData || 'getTabProperties' in TabmixSessionData) &&
		('setTabProperties' in SessionData || 'setTabProperties' in TabmixSessionData)
		) {
		let prefix = this.kTMP_SESSION_DATA_PREFIX;
		let sessionData = window.TabmixSessionData || window.SessionData;
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
		this.useTMPSessionAPI = true;
	}

	// Session Manager
	// https://addons.mozilla.org/firefox/addon/2324
	// We need to initialize TST before Session Manager restores the last session anyway!
	if ('gSessionManager' in window) {
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
	if ('FS_onFullerScreen' in window) {
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
	if ('tooManyTabs' in window) {
		this.registerExpandTwistyAreaBlocker('tooManyTabs');
	}

	// DragNDrop Toolbars
	// https://addons.mozilla.org/firefox/addon/dragndrop-toolbars/
	if ('globDndtb' in window && globDndtb.setTheStuff && this.isGecko2) {
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
};

TreeStyleTabService.overrideExtensionsOnInitBefore = function TSTService_overrideExtensionsOnInitBefore() {

	// Tab Mix Plus
	if (this.getTreePref('compatibility.TMP') &&
		'TMP_LastTab' in window) {
		TMP_LastTab.TabBar = gBrowser.mTabContainer;
	}
	if (this.getTreePref('compatibility.TMP') &&
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
	if ('tabberwocky' in window) {
		TreeStyleTabBrowser.prototype.isMultiRow = function()
		{
			return this.getPref('tabberwocky.multirow') && !this.isVertical;
		};

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
							window.removeEventListener('TreeStyleTabTabbarPositionChanged', this, false);
							window.removeEventListener('unload', this, false);
							break;
					}
				}
			};
		window.addEventListener('TreeStyleTabTabbarPositionChanged', listener, false);
		window.addEventListener('unload', listener, false);

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

TreeStyleTabService.overrideExtensionsOnInitAfter = function TSTService_overrideExtensionsOnInitAfter() {

	// Selection Links
	// https://addons.mozilla.org/firefox/addon/8644
	if ('selectionlinks' in window &&
		'parseSelection' in selectionlinks) {
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
		this.getTreePref('compatibility.TMP') &&
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

		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case TreeStyleTabService.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED:
							TabmixTabbar.updateScrollStatus();
							break;

						case TreeStyleTabService.kEVENT_TYPE_FOCUS_NEXT_TAB:
							let mode = TreeStyleTabService.getPref('extensions.tabmix.focusTab');
							if (mode != 2 && mode != 5)
								aEvent.preventDefault();
							break;

						case 'unload':
							window.removeEventListener(TreeStyleTabService.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, this, false);
							window.removeEventListener(TreeStyleTabService.kEVENT_TYPE_FOCUS_NEXT_TAB, this, false);
							window.removeEventListener('unload', this, false);
							break;
					}
				}
			};
		window.addEventListener(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, listener, false);
		window.addEventListener(this.kEVENT_TYPE_FOCUS_NEXT_TAB, listener, false);
		window.addEventListener('unload', listener, false);

		TreeStyleTabBrowser.prototype.isMultiRow = function()
		{
			return TabmixTabbar.isMultiRow;
		};

		gBrowser.treeStyleTab.internallyTabMovingCount++; // until "TMmoveTabTo" method is overwritten
	}


	// Super DragAndGo
	// https://addons.mozilla.org/firefox/addon/137
	if ('superDrag' in window) {
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
	if ('ddg_ges' in window) {
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
	if ('clrtabsInit' in window) {
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
								setColor(child, TreeStyleTabService.SessionStore.getTabValue(parent, 'tabClr'));
							}
							else if (child) {
								TreeStyleTabService.SessionStore.setTabValue(child, 'tabClr', '')
								calcTabClr({
									target : child,
									originalTarget : child,
								});
							}
							break;

						case 'unload':
							window.removeEventListener('TreeStyleTabAttached', this, false);
							window.removeEventListener('TreeStyleTabParted', this, false);
							window.removeEventListener('unload', this, false);
							break;
					}
				}
			};
		window.addEventListener('TreeStyleTabAttached', listener, false);
		window.addEventListener('TreeStyleTabParted', listener, false);
		window.addEventListener('unload', listener, false);
	}

	// FLST (Focus Last Selected Tab)
	// https://addons.mozilla.org/firefox/addon/32
	if ('flst' in window) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !aTabBrowser.treeStyleTab.getPref('extensions.flst.enabled');
		});
	}

	// Focus Last Selected Tab 0.9.5.x
	// http://www.gozer.org/mozilla/extensions/
	this.extensions.isAvailable('focuslastselectedtab@gozer.org', { ok : function() {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !aTabBrowser.selectedTab.hasAttribute('lastselected');
		});
	}});

	// LastTab
	// https://addons.mozilla.org/firefox/addon/112
	if ('LastTab' in window) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !aTabBrowser.treeStyleTab.getPref('extensions.lasttab.focusLastTabOnClose');
		});
	}

	// FireGestures
	// https://addons.mozilla.org/firefox/addon/6366
	if ('FireGestures' in window) {
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
	if ('mgBuiltInFunctions' in window && 'mgLinkInTab' in mgBuiltInFunctions) {
		eval('mgBuiltInFunctions.mgLinkInTab = '+
			mgBuiltInFunctions.mgLinkInTab.toSource().replace(
				'var tab',
				'TreeStyleTabService.readyToOpenChildTab(gBrowser); $&'
			)
		);
	}

	// Greasemonkey
	// https://addons.mozilla.org/firefox/addon/748
	if ('GM_BrowserUI' in window && 'openInTab' in GM_BrowserUI) {
		eval('GM_BrowserUI.openInTab = '+
			GM_BrowserUI.openInTab.toSource().replace(
				/(if\s*\(this\.isMyWindow\([^\)]+\)\)\s*\{\s*)(this\.tabBrowser)/,
				'$1 TreeStyleTabService.readyToOpenChildTab($2); $2'
			)
		);
	}

	// SBM Counter
	// http://miniturbo.org/products/sbmcounter/
	if ('SBMCounter' in window) {
		eval('SBMCounter.action = '+
			SBMCounter.action.toSource().replace(
				'gBrowser.selectedTab = gBrowser.addTab',
				'TreeStyleTabService.readyToOpenChildTab(gBrowser); $&'
			)
		);
	}

	// Aging Tabs
	// https://addons.mozilla.org/firefox/addon/3542
	if ('agingTabs' in window) {
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
	if ('executeAction' in window && 'openTabs' in window) {
		eval('window.openTabs = '+
			window.openTabs.toSource().replace(
				/((sContent|gBrowser|getBrowser\(\))\.addTab)/,
				'TreeStyleTabService.readyToOpenChildTab($2); $1'
			)
		);
	}

	// Mouseless Browsing
	// https://addons.mozilla.org/firefox/addon/879
	if ('mouselessbrowsing' in window &&
		'EventHandler' in mouselessbrowsing) {
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
		'prototype' in LinkyContext) {
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
	if ('QuickDrag' in window && '_loadTab' in QuickDrag) {
		eval('QuickDrag._loadTab = '+
			QuickDrag._loadTab.toSource().replace(
				/(gBrowser.loadOneTab\()/g,
				'TreeStyleTabService.readyToOpenChildTab(); $1'
			)
		);
	}

	// Autohide
	// http://www.krickelkrackel.de/autohide/
	if ('autoHIDE' in window) {
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
							var t = aEvent.currentTarget;
							t.removeEventListener('TreeStyleTabAutoHideStateChanging', this, false);
							t.removeEventListener('unload', this, false);
							t.removeEventListener('fullscreen', this, false);
							break;
					}
				}
			};
		window.addEventListener('TreeStyleTabAutoHideStateChanging', autoHideEventListener, false);
		window.addEventListener('fullscreen', autoHideEventListener, false);
		window.addEventListener('unload', autoHideEventListener, false);

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
		sidewikiWindowHandler.barsContainer_.geometry_.__proto__.getWindowSizeForDrawers) {
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
	if ('SMOOTHLYCLOSETABS' in window) {
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
	if ('stmM' in window) {
		var observer = {
				domain : 'extensions.stm.',
				observe : function(aSubject, aTopic, aData)
				{
					switch (aData)
					{
						case 'extensions.stm.tabBarMultiRows':
						case 'extensions.stm.tabBarPosition':
							if (
								TreeStyleTabService.getPref('extensions.stm.tabBarMultiRows') &&
								TreeStyleTabService.getPref('extensions.stm.tabBarPosition') == 0
								) {
								TreeStyleTabService.setPref('extensions.stm.tabBarMultiRows.override', false);
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
		TreeStyleTabService.addPrefListener(observer);
		window.addEventListener('unload', function() {
			window.removeEventListener('unload', arguments.callee, false);
			TreeStyleTabService.removePrefListener(observer);
		}, false);

		let warnPref = 'extensions.treestyletab.compatibility.STM.warnForNewTabPosition';
		if (
			this.getPref(warnPref) &&
			this.getPref('extensions.stm.newTabPosition') != 0
			) {
			let checked = { value : false };
			if (this.PromptService.confirmEx(
					null,
					this.treeBundle.getString('compatibility_STM_warning_title'),
					this.treeBundle.getString('compatibility_STM_warning_text'),
					(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_0) +
					(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_1),
					this.treeBundle.getString('compatibility_STM_warning_use_TST'),
					this.treeBundle.getString('compatibility_STM_warning_use_STM'),
					null,
					this.treeBundle.getString('compatibility_STM_warning_never'),
					checked
				) == 0) {
				this.setPref('extensions.stm.newTabPosition', 0);
			}
			if (checked.value)
				this.setPref(warnPref, false);
		}

		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return aTabBrowser.treeStyleTab.getPref('extensions.stm.focusAfterCloseTab') == 0;
		});
	}

	// Tab Utilities
	// https://addons.mozilla.org/firefox/addon/59961
	if ('tabutils' in window) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return aTabBrowser.treeStyleTab.getPref('extensions.tabutils.selectOnClose') == 0;
		});
	}

	// Remove New Tab Button
	// https://addons.mozilla.org/firefox/addon/10535
	this.extensions.isAvailable('remove-new-tab-button@forerunnerdesigns.com', { ok : function() {
		document.documentElement.setAttribute(TreeStyleTabService.kHIDE_NEWTAB, true);
	}});

	// IE Tab Plus
	// https://addons.mozilla.org/firefox/addon/10909/
	if ('IeTab' in window && IeTab.prototype) {
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


	window.setTimeout(function(aSelf) {
		aSelf.overrideExtensionsDelayed();
	}, 0, this);
};


TreeStyleTabService.overrideExtensionsDelayed = function TSTService_overrideExtensionsDelayed() {

	// Tab Mix Plus
	if (this.getTreePref('compatibility.TMP') &&
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
		'OpenInNewTabs' in MultiLinks_Wrapper.LinksManager) {
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
	if ('domaintab' in window && 'TMP_howToOpen' in domaintab) {
		eval('domaintab.TMP_howToOpen = '+
			domaintab.TMP_howToOpen.toSource().replace(
				/(domaintab.DT_openNewTabWith\()/g,
				'TreeStyleTabService.readyToOpenChildTab(); $1'
			)
		);
	}

	// Personal Titlebar
	// https://addons.mozilla.org/irefox/addon/personal-titlebar/
	if (document.getElementById('personal-titlebar')) {
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
							window.removeEventListener('beforecustomization', this, false);
							window.removeEventListener('aftercustomization', this, false);
							window.removeEventListener('unload', this, false);
							personalTitlebar = null;
							break;
					}
				}
			};
		window.addEventListener('beforecustomization', listener, false);
		window.addEventListener('aftercustomization', listener, false);
		window.addEventListener('unload', listener, false);
		titlebar.addEventListener('DOMAttrModified', listener, true);
	}

	// TotalToolbar
	// http://totaltoolbar.mozdev.org/
	let (menu = document.getElementById('tt-toolbar-properties')) {
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'command':
							gBrowser.treeStyleTab.updateFloatingTabbar(TreeStyleTabService.kTABBAR_UPDATE_BY_WINDOW_RESIZE);
							break;

						case 'unload':
							menu.removeEventListener('command', this, true);
							window.removeEventListener('unload', this, false);
							menu = null;
							break;
					}
				}
			};
		menu.addEventListener('command', listener, false);
		window.addEventListener('unload', listener, false);
	}

	// Firefox Sync (Weave)
	// http://www.mozilla.com/en-US/firefox/sync/
	if (
		'gFxWeaveGlue' in window || // addon
		'gSyncUI' in window // Firefox 4 built-in
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
							window.removeEventListener('TabOpen', this, true);
							window.removeEventListener('unload', this, false);
							return;
					}
				}
			};
		window.addEventListener('TabOpen', listener, true);
		window.addEventListener('unload', listener, false);
	}

};
