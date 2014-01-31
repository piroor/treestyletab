Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'Services', 'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabUtils', 'resource://treestyletab-modules/utils.js');

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
		TreeStyleTabUtils.getTreePref('compatibility.Highlander')) {
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
		TreeStyleTabUtils.getTreePref('compatibility.PermaTabs')) {
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
					'(function(tab, id) {\n' +
					'  if (this.ssWillRestore) return;\n' +
					'  var TST = TreeStyleTabService;\n' +
					'  if (this.TSTRestoredPermaTabsInfo === void(0)) {\n' +
					'    try {\n' +
					'      eval("this.TSTRestoredPermaTabsInfo = "+(TreeStyleTabUtils.getTreePref("permaTabsInfo") || "null"));\n' +
					'    }\n' +
					'    catch(e) {\n' +
					'    }\n' +
					'  }\n' +
					'  if (!this.TSTRestoredPermaTabsInfo) return;\n' +

					'  var info = this.TSTRestoredPermaTabsInfo[id];\n' +
					'  if (!info) return;\n' +

					'  for (var i in info)\n' +
					'  {\n' +
					'    TST.SessionStore.setTabValue(tab, i, info[i]);\n' +
					'  }\n' +
					'  var count = 0;\n' +
					'  window.setTimeout(function onTimeout() {\n' +
					'    var b = TST.getTabBrowserFromChild(tab);\n' +
					'    if (!b.treeStyleTab) {\n' +
					'      if (++count < 50)\n' +
					'        window.setTimeout(onTimeout, 100);\n' +
					'      return;\n' +
					'    }\n' +
					'    b.treeStyleTab.handleRestoredTab(tab);\n' +
					'  }, 0);\n' +
					'}).call(this, tab, id)\n' +
					'$1'
				)
			);
		}
		if ('savePermaTabs' in permaTabs) {
			eval('permaTabs.savePermaTabs = '+
				permaTabs.savePermaTabs.toSource().replace(
					'{',
					'{\n' +
					'(function() {\n' +
					'  var tabsInfo = {};\n' +
					'  var TST = TreeStyleTabService;\n' +
					'  var allTabs = getBrowser().mTabContainer.childNodes;\n' +
					'  for (let i = 0, maxi = allTabs.length; i < maxi; i++)\n' +
					'  {\n' +
					'    let tab = allTabs[i];\n' +
					'    let index = this.getPermaTabLocalIndex(tab);\n' +
					'    if (index < 0) continue;\n' +
					'    let info = {};\n' +
					'    for (let i = 0, maxi = TST.extraProperties.length; i < maxi; i++)\n' +
					'    {\n' +
					'      let property = TST.extraProperties[i];\n' +
					'      info[property] = TST.getTabValue(tab, property);\n' +
					'    }\n' +
					'    tabsInfo[this.permaTabs[index].id] = info;\n' +
					'  }\n' +
					'  TreeStyleTabUtils.setTreePref("permaTabsInfo", tabsInfo.toSource());\n' +
					'}).call(this);'
				)
			);
		}
	}

	// Tab Mix Plus
	if (TreeStyleTabUtils.getTreePref('compatibility.TMP')) {
		document.documentElement.setAttribute('treestyletab-enable-compatibility-tmp', true);
	}
	// Tab Mix Plus, SessionStore API
	if (
		TreeStyleTabUtils.getTreePref('compatibility.TMP') &&
		('TabmixSessionData' in window || 'SessionData' in window)
		) {
		let sessionData = window.TabmixSessionData || window.SessionData;
		if ('getTabProperties' in sessionData && 'setTabProperties' in sessionData) {
			let prefix = sv.kTMP_SESSION_DATA_PREFIX;
			let sessionManager = window.TabmixSessionManager || window.SessionManager;
			sessionData.tabTSTProperties = this.extraProperties.map(function(aProperty) {
				return prefix+aProperty;
			});
			eval('sessionData.getTabProperties = '+
				sessionData.getTabProperties.toSource().replace(
					'return tabProperties;',
					'  for (let i = 0, maxi = this.tabTSTProperties.length; i < maxi; i++)\n' +
					'  {\n' +
					'    let property = this.tabTSTProperties[i];\n' +
					'    tabProperties += "|" + property + "=" + encodeURIComponent(aTab.getAttribute(property));\n' +
					'  }\n' +
					'$&'
				)
			);
			eval('sessionData.setTabProperties = '+
				sessionData.setTabProperties.toSource().replace(
					'{',
					'$&\n' +
					'  var TSTProps = tabProperties.split("|");\n' +
					'  tabProperties = TSTProps.shift();\n' +
					'  for (let i = 0, maxi = TSTProps.length; i < maxi; i++)\n' +
					'  {\n' +
					'    let property = TSTProps[i];\n' +
					'    let index = property.indexOf("=");\n' +
					'    let name = property.substring(0, index);\n' +
					'    let value = decodeURIComponent(property.substring(index+1));\n' +
					'    if (name && value)\n' +
					'      aTab.setAttribute(name, value);\n' +
					'  }'
				)
			);
			eval('sessionManager.loadOneTab = '+
				sessionManager.loadOneTab.toSource().replace(
					/(\}\))?$/,
					'  if (gBrowser.treeStyleTab.useTMPSessionAPI)\n' +
					'    gBrowser.treeStyleTab.handleRestoredTab(aTab);\n' +
					'$1'
				)
			);
			let source = tablib.init.toSource().split('gBrowser.restoreTab = ');
			source[1] = source[1].replace(
				'return newTab;',
				'  if (this.treeStyleTab.useTMPSessionAPI)\n' +
				'    this.treeStyleTab.handleRestoredTab(newTab);\n' +
				'$&'
			);
			eval('tablib.init = '+source.join('gBrowser.restoreTab = '));
			eval('sessionManager.loadOneWindow = '+
				sessionManager.loadOneWindow.toSource().replace(
					'gBrowser.tabsToLoad = ',
					'  gBrowser.treeStyleTab.resetAllTabs(true, true);\n' +
					'  TreeStyleTabService.restoringTree = true;\n' +
					'$&'
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
		TreeStyleTabUtils.getTreePref('compatibility.SessionManager')) {
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
				'  gBrowser.treeStyleTab.collapseExpandAllSubtree(false, true);\n' +
				'  let (tabs = gBrowser.treeStyleTab.getTabs(gBrowser).slice(1).reverse()) {\n' +
				'    for (let i = 0, maxi = tabs.length; i < maxi; i++)\n' +
				'    {\n' +
				'      let tab = tabs[i];\n' +
				'      gBrowser.removeTab(tab);\n' +
				'    }\n' +
				'  }\n' +
				'  TreeStyleTabService.restoringTree = true;\n' +
				'$&'
			));
		}
	}

	// FullerScreen
	// https://addons.mozilla.org/firefox/addon/4650
	if ('FS_onFullerScreen' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.FullerScreen')) {
		let (functions = 'CheckIfFullScreen,FS_onFullerScreen,FS_onMouseMove'.split(',')) {
			for (let i = 0, maxi = functions.length; i < maxi; i++)
			{
				let func = functions[i];
				if (!(func in window)) continue;
				eval('window.'+func+' = '+window[func].toSource().replace(
					/FS_data.mTabs.(removeAttribute\("moz-collapsed"\)|setAttribute\("moz-collapsed", "true"\));/g,
					'if (gBrowser.treeStyleTab.currentTabbarPosition == "top") { $& }'
				));
			}
		}
	}

	// TooManyTabs
	// https://addons.mozilla.org/firefox/addon/9429
	if ('tooManyTabs' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.TooManyTabs')) {
		sv.registerExpandTwistyAreaBlocker('tooManyTabs');
	}

	// DragNDrop Toolbars
	// https://addons.mozilla.org/firefox/addon/dragndrop-toolbars/
	if ('globDndtb' in window &&
		globDndtb.setTheStuff &&
		TreeStyleTabUtils.getTreePref('compatibility.DragNDropToolbars')) {
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
		TreeStyleTabUtils.getTreePref('compatibility.OptimozTweaks')) {
		eval('window.mtSidebarStartup = '+window.mtSidebarStartup.toSource().replace(
			'{',
			'{\n' +
			'  document.getElementById("TabsToolbar")\n' +
			'    .addEventListener("mousemove", mtMouseMoveListener, false);'
		));
		eval('window.mtSidebarShutdown = '+window.mtSidebarShutdown.toSource().replace(
			'{',
			'{\n' +
			'  document.getElementById("TabsToolbar")\n' +
			'    .removeEventListener("mousemove", mtMouseMoveListener, false);'
		));
		eval('window.mtPreventHiding = '+window.mtPreventHiding.toSource().replace(
			'{',
			'{\n' +
			'  if (TreeStyleTabService.getTabbarFromEvent(arguments[0]))\n' +
			'    return;'
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
			'  if (!theSettings ||\n' +
			'    gBrowser.treeStyleTab.isVertical) {'
		));
	}

	// Greasemonkey
	// https://addons.mozilla.org/firefox/addon/748
	if (TreeStyleTabUtils.getTreePref('compatibility.Greasemonkey')) {
		try {
			let hitchModule = Components.utils.import('resource://greasemonkey/util/hitch.js', {});
			let hitch = hitchModule.hitch;
			if (hitch.toSource().indexOf('TreeStyleTabService') < 0) {
				let ns = {};
				Components.utils.import('resource://greasemonkey/third-party/getChromeWinForContentWin.js', ns);
				let getChromeWinForContentWin = ns.getChromeWinForContentWin;
				hitchModule.hitch = function(aObject, aMethod) {
					if (typeof aMethod == 'function' &&
						aMethod.toSource().indexOf('function openInTab') > -1) {
						let originalOpenInTab = aMethod;
						/**
						 * This function must be replaced on scripts in "chrome:" URL, like this.
						 * Otherwise the original openInTab() will raise violation error.
						 * Don't move this hack into JS code modules with "resource:" URL.
						 */
						aMethod = function openInTab(aSafeContentWindow, aURL, aLoadInBackgtound) {
							let chrome = getChromeWinForContentWin(aSafeContentWindow);
							if (chrome && chrome.TreeStyleTabService)
								chrome.TreeStyleTabService.readyToOpenChildTabNow(aSafeContentWindow);
							return originalOpenInTab.apply(this, arguments);
						};
					}
					return hitch.apply(this, arguments);
				};
				Components.utils.import('resource://greasemonkey/util.js', ns);
				if (ns.GM_util)
					ns.GM_util.hitch = hitchModule.hitch;
			}
		}
		catch(e) {
			dump('Tree Style Tab: failed to patch to Greasemonkey.\n');
			dump(e+'\n');
		}
	}
};

TreeStyleTabWindowHelper.overrideExtensionsBeforeBrowserInit = function TSTWH_overrideExtensionsBeforeBrowserInit() {
	var sv = this.service;

	// Tab Mix Plus
	if (TreeStyleTabUtils.getTreePref('compatibility.TMP') &&
		'TMP_LastTab' in window) {
		TMP_LastTab.TabBar = gBrowser.mTabContainer;
	}
	if (TreeStyleTabUtils.getTreePref('compatibility.TMP') &&
		'isTabVisible' in gBrowser.mTabContainer &&
		'ensureTabIsVisible' in gBrowser.mTabContainer) {
		let replaceHorizontalProps = function replaceHorizontalProps(aString)
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
					'{\n' +
					'  var posProp = gBrowser.treeStyleTab.isVertical ? "y" : "x" ;\n' +
					'  var screenPosProp = gBrowser.treeStyleTab.isVertical ? "screenY" : "screenX" ;\n' +
					'  var sizeProp = gBrowser.treeStyleTab.isVertical ? "height" : "width" ;'
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
		TreeStyleTabUtils.getTreePref('compatibility.Tabberwocky')) {
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'TreeStyleTabTabbarPositionChanged':
							var b = aEvent.originalTarget;
							if (b.treeStyleTab.isVertical)
								TreeStyleTabUtils.prefs.setPref('tabberwocky.multirow', false);
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
					'  TreeStyleTabService.readyToOpenChildTab(aFrame, true)\n' +
					'$&'
				).replace(
					/(\}\)?)$/,
					'  TreeStyleTabService.stopToOpenChildTab(aFrame)\n' +
					'$1'
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
		TreeStyleTabUtils.getTreePref('compatibility.SelectionLinks')) {
		eval('selectionlinks.parseSelection = '+
			selectionlinks.parseSelection.toSource().replace(
				/((?:[^\s:;]+.selectedTab\s*=\s*)?([^\s:;]+).addTab\()/g,
				'  if ($2.treeStyleTab)\n' +
				'    $2.treeStyleTab.readyToOpenChildTab(focusedWindow);\n' +
				'$1'
			)
		);
	}


	// Tab Mix Plus
	if (
		TreeStyleTabUtils.getTreePref('compatibility.TMP') &&
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
				'  gBrowser.treeStyleTab.tabbarDNDObserver.canDragTabbar(event) ||\n' +
				'  $&'
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
							let mode = TreeStyleTabUtils.prefs.getPref('extensions.tabmix.focusTab');
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
		TreeStyleTabUtils.getTreePref('compatibility.SuperDragAndGo')) {
		eval('superDrag.onDrop = '+
			superDrag.onDrop.toSource().replace(
				/(var newTab = getBrowser\(\).addTab\([^\)]+\);)/g,
				'  if (aDragSession.sourceNode &&\n' +
				'    aDragSession.sourceNode.ownerDocument.defaultView.top == getBrowser().contentWindow)\n' +
				'    TreeStyleTabService.readyToOpenChildTab(getBrowser());\n' +
				'  $1'
			)
		);
	}

	// Drag de Go
	// https://addons.mozilla.org/firefox/addon/2918
	if ('ddg_ges' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.DragDeGo')) {
		eval('ddg_ges.Open = '+
			ddg_ges.Open.toSource().replace(
				'if (mode[1] == "h" || mode[1] == "f") {',
				'$&\n' +
				'  if ("sourceNode" in aData) // only for dragging from the content tarea.\n' +
				'    TreeStyleTabService.readyToOpenChildTab(getBrowser());'
			)
		);
		eval('ddg_ges.Search = '+
			ddg_ges.Search.toSource().replace(
				'if (mode[1] == "h" || mode[1] == "f") {',
				'$&\n' +
				'    TreeStyleTabService.readyToOpenChildTab(getBrowser());'
			)
		);
	}

	// DragIt
	// https://addons.mozilla.org/firefox/addon/dragit-formerly-drag-de-go/
	if ('DragIt' in window &&
		DragIt.tab &&
		DragIt.tab.open &&
		TreeStyleTabUtils.getTreePref('compatibility.DragIt')) {
		eval('DragIt.tab.open = '+
			DragIt.tab.open.toSource().replace(
				'try {',
				'try { TreeStyleTabService.readyToOpenChildTabNow(gBrowser);'
			)
		);
	}

	// Colorful Tabs
	// https://addons.mozilla.org/firefox/addon/1368
	if ('colorfulTabs' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.ColorfulTabs')) {
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'TabOpen':
						case 'TreeStyleTabAttached':
						case 'TreeStyleTabParted':
							var child = aEvent.originalTarget;
							var parent = aEvent.parentTab;
							if (child && parent) {
								let color = TreeStyleTabService.SessionStore.getTabValue(parent, 'tabClr');
								if (/^\d+,\d+,\d+$/.test(color))
									color = 'rgb('+color+')';
								window.setTimeout(function() {
									colorfulTabs.setColor(child, color);
								}, 0);
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
							document.removeEventListener('TabOpen', this, false);
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
		document.addEventListener('TabOpen', listener, false);
		document.addEventListener('TreeStyleTabAttached', listener, false);
		document.addEventListener('TreeStyleTabParted', listener, false);
		document.addEventListener('unload', listener, false);
	}

	// FLST (Focus Last Selected Tab)
	// https://addons.mozilla.org/firefox/addon/32
	if ('flst' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.FLST')) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !TreeStyleTabUtils.prefs.getPref('extensions.flst.enabled');
		});
	}

	// Focus Last Selected Tab 0.9.5.x
	// http://www.gozer.org/mozilla/extensions/
	if (TreeStyleTabUtils.getTreePref('compatibility.FocusLastSelectedTab')) {
		sv.extensions.isAvailable('focuslastselectedtab@gozer.org', { ok : function() {
			TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
				return !aTabBrowser.selectedTab.hasAttribute('lastselected');
			});
		}});
	}

	// LastTab
	// https://addons.mozilla.org/firefox/addon/112
	if ('LastTab' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.LastTab')) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !TreeStyleTabUtils.prefs.getPref('extensions.lasttab.focusLastTabOnClose');
		});
	}

	// FireGestures
	// https://addons.mozilla.org/firefox/addon/6366
	if ('FireGestures' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.FireGestures')) {
		eval('FireGestures.onExtraGesture = '+
			FireGestures.onExtraGesture.toSource().replace(
				'case "keypress-stop":',
				'$&\n' +
				'  TreeStyleTabService.readyToOpenChildTab(gBrowser, true);'
			).replace(
				'break;case "gesture-timeout":',
				'  TreeStyleTabService.stopToOpenChildTab(gBrowser);\n' +
				'$&'
			)
		);
		eval('FireGestures._performAction = '+
			FireGestures._performAction.toSource().replace(
				'gBrowser.loadOneTab(',
				'  TreeStyleTabService.readyToOpenChildTab(gBrowser);\n' +
				'$&'
			)
		);
		eval('FireGestures.openURLsInSelection = '+
			FireGestures.openURLsInSelection.toSource().replace(
				'var tab =',
				'  if (!TreeStyleTabService.checkToOpenChildTab(gBrowser))\n' +
				'    TreeStyleTabService.readyToOpenChildTab(gBrowser, true);\n' +
				'$&'
			).replace(
				'if (!flag)',
				'  if (TreeStyleTabService.checkToOpenChildTab(gBrowser))\n' +
				'    TreeStyleTabService.stopToOpenChildTab(gBrowser);\n' +
				'$&'
			)
		);
		eval('FireGestures.handleEvent = '+
			FireGestures.handleEvent.toSource().replace(
				'gBrowser.loadOneTab(',
				'  TreeStyleTabService.readyToOpenChildTab(gBrowser);\n' +
				'$&'
			)
		);
	}

	// Mouse Gestures Redox
	// http://www.mousegestures.org/
	if ('mgBuiltInFunctions' in window &&
		'mgLinkInTab' in mgBuiltInFunctions &&
		TreeStyleTabUtils.getTreePref('compatibility.MouseGesturesRedox')) {
		eval('mgBuiltInFunctions.mgLinkInTab = '+
			mgBuiltInFunctions.mgLinkInTab.toSource().replace(
				'var tab',
				'TreeStyleTabService.readyToOpenChildTab(gBrowser); $&'
			)
		);
	}

	// SBM Counter
	// http://miniturbo.org/products/sbmcounter/
	if ('SBMCounter' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.SBMCounter')) {
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
		TreeStyleTabUtils.getTreePref('compatibility.AgingTabs')) {
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
	if (TreeStyleTabUtils.getTreePref('compatibility.SnapLinks')) {
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
		TreeStyleTabUtils.getTreePref('compatibility.MouselessBrowsing')) {
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
		TreeStyleTabUtils.getTreePref('compatibility.Linky')) {
		let (methods = 'openLink,openLinks,generateDocument'.split(',')) {
			for (let i = 0, maxi = methods.length; i < maxi; i++)
			{
				let method = methods[i];
				if (!(method in LinkyContext.prototype)) continue;
				eval('LinkyContext.prototype.'+method+' = '+
					LinkyContext.prototype[method].toSource().replace(
						'{',
						'{ TreeStyleTabService.readyToOpenChildTabNow(null, true);'
					)
				);
			}
		}
	}

	// QuickDrag
	// https://addons.mozilla.org/firefox/addon/6912
	if ('QuickDrag' in window &&
		'_loadTab' in QuickDrag &&
		TreeStyleTabUtils.getTreePref('compatibility.QuickDrag')) {
		eval('QuickDrag._loadTab = '+
			QuickDrag._loadTab.toSource().replace(
				/(gBrowser.loadOneTab\()/g,
				'TreeStyleTabService.readyToOpenChildTab(), $1'
			)
		);
	}

	// Autohide
	// http://www.krickelkrackel.de/autohide/
	if ('autoHIDE' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.Autohide')) {
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
									!TreeStyleTabUtils.prefs.getPref('extensions.autohide.bars.statBar.always') &&
									TreeStyleTabUtils.prefs.getPref('extensions.autohide.bars.statBar')
									) {
									autoHIDE.statBar.setAttribute('ahHIDE', true);
								}
							}
							else {
								TreeStyleTabService.getTabStrip(gBrowser).removeAttribute('ahHIDE');
								if (
									autoHIDE.statBar &&
									aTabBrowser.treeStyleTab.currentTabbarPosition == 'bottom' &&
									!TreeStyleTabUtils.prefs.getPref('extensions.autohide.bars.statBar.always') &&
									TreeStyleTabUtils.prefs.getPref('extensions.autohide.bars.statBar')
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
				'$1\n' +
				'  if (autoHIDE.winUtil)\n' +
				'    autoHIDE.winUtil.setRedraw(false, false);\n' +
				'  $2\n' +
				'  gBrowser.treeStyleTab.autoHide.extraYOffset = ah.delta;\n' +
				'  window.setTimeout(function() {\n' +
				'    gBrowser.treeStyleTab.autoHide.redrawContentArea();\n' +
				'    if (autoHIDE.winUtil)\n' +
				'      autoHIDE.winUtil.setRedraw(true, false);\n' +
				'  }, 0);'
			).replace(
				/(;)([^;]*\.setPosition\(0, 0\);)/,
				'$1\n' +
				'  if (autoHIDE.winUtil)\n' +
				'    autoHIDE.winUtil.setRedraw(false, false);\n' +
				'  $2\n' +
				'  gBrowser.treeStyleTab.autoHide.extraYOffset = 0;\n' +
				'  window.setTimeout(function() {\n' +
				'    gBrowser.treeStyleTab.autoHide.redrawContentArea();\n' +
				'    if (autoHIDE.winUtil)\n' +
				'      autoHIDE.winUtil.setRedraw(true, false);\n' +
				'  }, 0);'
			));
		}
	}


	// Google Toolbar Sidewiki
	if ('sidewikiWindowHandler' in window &&
		window.sidewikiWindowHandler &&
		sidewikiWindowHandler.barsContainer_ &&
		sidewikiWindowHandler.barsContainer_.geometry_ &&
		sidewikiWindowHandler.barsContainer_.geometry_.__proto__.getWindowSizeForDrawers &&
		TreeStyleTabUtils.getTreePref('compatibility.GoogleToolbar.Sidewiki')) {
		let func = sidewikiWindowHandler.barsContainer_.geometry_.__proto__.getWindowSizeForDrawers.toSource();
		if (func.indexOf('treeStyleTab') < 0) {
			eval('sidewikiWindowHandler.barsContainer_.geometry_.__proto__.getWindowSizeForDrawers = '+func.replace(
				'return {',
				'  if ("treeStyleTab" in this.topLevelDocument_.getElementById("content")) {\n' +
				'    let b = this.topLevelDocument_.getElementById("content");\n' +
				'    let box = b.mPanelContainer.boxObject;\n' +
				'    return {\n' +
				'      height       : box.height,\n' +
				'      width        : box.width,\n' +
				'      top          : box.y,\n' +
				'      left         : box.x,\n' +
				'      right        : this.topLevelWindow_.innerWidth - box.x - box.width,\n' +
				'      tabBoxHeight : 0\n' +
				'    };\n' +
				'  }\n' +
				'$&'
			));
		}
	}


	// Smoothly Close Tabs
	// https://addons.mozilla.org/firefox/addon/71410
	if ('SMOOTHLYCLOSETABS' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.SmoothlyCloseTabs')) {
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
					'{\n' +
					'  var scrollProp = gBrowser.treeStyleTab.isVertical ? "scrollHeight" : "scrollWidth" ;\n' +
					'  var sizeProp = gBrowser.treeStyleTab.isVertical ? "height" : "width" ;\n' +
					'  var maxSizeProp = gBrowser.treeStyleTab.isVertical ? "maxHeight" : "maxWidth" ;'
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
		TreeStyleTabUtils.getTreePref('compatibility.STM')) {
		var observer = {
				domain : 'extensions.stm.',
				observe : function(aSubject, aTopic, aData)
				{
					switch (aData)
					{
						case 'extensions.stm.tabBarMultiRows':
						case 'extensions.stm.tabBarPosition':
							if (
								TreeStyleTabUtils.prefs.getPref('extensions.stm.tabBarMultiRows') &&
								TreeStyleTabUtils.prefs.getPref('extensions.stm.tabBarPosition') == 0
								) {
								TreeStyleTabUtils.prefs.setPref('extensions.stm.tabBarMultiRows.override', false);
							}
							return;

						case 'extensions.stm.newTabBtnPos':
							if (TreeStyleTabUtils.prefs.getPref(aData) == 0)
								document.documentElement.removeAttribute(TreeStyleTabService.kHIDE_NEWTAB);
							else
								document.documentElement.setAttribute(TreeStyleTabService.kHIDE_NEWTAB, true);
							return;
					}
				}
			};
		observer.observe(null, null, 'extensions.stm.tabBarMultiRows');
		observer.observe(null, null, 'extensions.stm.newTabBtnPos');
		TreeStyleTabUtils.prefs.addPrefListener(observer);
		document.addEventListener('unload', function onUnload() {
			document.removeEventListener('unload', onUnload, false);
			TreeStyleTabUtils.prefs.removePrefListener(observer);
		}, false);

		let warnPref = 'extensions.treestyletab.compatibility.STM.warnForNewTabPosition';
		if (
			TreeStyleTabUtils.prefs.getPref(warnPref) &&
			TreeStyleTabUtils.prefs.getPref('extensions.stm.newTabPosition') != 0
			) {
			let checked = { value : false };
			if (Services.prompt.confirmEx(
					null,
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_title'),
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_text'),
					(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
					(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1),
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_use_TST'),
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_use_STM'),
					null,
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_never'),
					checked
				) == 0) {
				TreeStyleTabUtils.prefs.setPref('extensions.stm.newTabPosition', 0);
			}
			if (checked.value)
				TreeStyleTabUtils.prefs.setPref(warnPref, false);
		}

		sv.registerTabFocusAllowance(function(aTabBrowser) {
			return TreeStyleTabUtils.prefs.getPref('extensions.stm.focusAfterCloseTab') == 0;
		});
	}

	// Tab Utilities
	// https://addons.mozilla.org/firefox/addon/59961
	if ('tabutils' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.TabUtilities')) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return TreeStyleTabUtils.prefs.getPref('extensions.tabutils.selectOnClose') == 0;
		});
	}

	// Remove New Tab Button
	// https://addons.mozilla.org/firefox/addon/10535
	if (TreeStyleTabUtils.getTreePref('compatibility.RemoveNewTabButton')) {
		sv.extensions.isAvailable('remove-new-tab-button@forerunnerdesigns.com', { ok : function() {
			document.documentElement.setAttribute(TreeStyleTabService.kHIDE_NEWTAB, true);
		}});
	}

	// IE Tab Plus
	// https://addons.mozilla.org/firefox/addon/10909/
	if ('IeTab' in window &&
		IeTab.prototype &&
		TreeStyleTabUtils.getTreePref('compatibility.IETabPlus')) {
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
		TreeStyleTabUtils.getTreePref('compatibility.Locationbar2')) {
		let listening = false;
		let listener = function(aEvent) {
				switch (aEvent.type)
				{
					case 'unload':
						document.removeEventListener('unload', listener, false);
						document.removeEventListener('beforecustomization', listener, true);
						document.removeEventListener('aftercustomization', listener, false);
					case 'beforecustomization':
						if (gURLBar && listening)
							gURLBar.removeEventListener('click', listener, true);
						listening = false;
						return;

					case 'aftercustomization':
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
		document.addEventListener('beforecustomization', listener, true);
		document.addEventListener('aftercustomization', listener, false);
		if (gURLBar && !listening) {
			gURLBar.addEventListener('click', listener, true);
			listening = true;
		}
	}

	// InstaClick
	// https://addons.mozilla.org/firefox/addon/instaclick/
	if ('instaclick' in window &&
		'contentAreaClick2' in window.instaclick &&
		TreeStyleTabUtils.getTreePref('compatibility.InstaClick')) {
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
		TreeStyleTabUtils.getTreePref('compatibility.DuplicateThisTab')) {
		eval('duplicatethistab.openLinkWithHistory = '+
			duplicatethistab.openLinkWithHistory.toSource().replace(
				'var newTab = ',
				'TreeStyleTabService.readyToOpenChildTab(); $&'
			)
		);
	}

	// Context Search
	// http://www.cusser.net/extensions/contextsearch/
	if ('contextsearch' in window &&
		'search' in window.contextsearch &&
		TreeStyleTabUtils.getTreePref('compatibility.ContextSearch')) {
		eval('contextsearch.search = '+
			contextsearch.search.toSource().replace(
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
	if (TreeStyleTabUtils.getTreePref('compatibility.TMP') &&
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
				'  (function() {\n' +
				'    var tabs = this.treeStyleTab.getDescendantTabs(this.mCurrentTab);\n' +
				'    if (tabs.length) {\n' +
				'      var index = TreeStyleTabUtils.prefs.getPref("extensions.tabmix.openTabNextInverse") ?\n' +
				'            tabs[tabs.length - 1]._tPos :\n' +
				'            this.mCurrentTab._tPos ;\n' +
				'      if (index < aTab._tPos) index++;\n' +
				'      return index;\n' +
				'    }\n' +
				'    else {\n' +
				'      return ($&);\n' +
				'    }\n' +
				'  }).call(this)'
			)
		);

		gBrowser.treeStyleTab.internallyTabMovingCount--;
	}

	// Multi Links
	// https://addons.mozilla.org/firefox/addon/13494
	if ('MultiLinks_Wrapper' in window &&
		'LinksManager' in MultiLinks_Wrapper &&
		'OpenInNewTabs' in MultiLinks_Wrapper.LinksManager &&
		TreeStyleTabUtils.getTreePref('compatibility.MultiLinks')) {
		eval('MultiLinks_Wrapper.LinksManager.OpenInNewTabs = '+
			MultiLinks_Wrapper.LinksManager.OpenInNewTabs.toSource().replace(
				'{',
				'{\n' +
				'  if (!TreeStyleTabService.checkToOpenChildTab(getBrowser()))\n' +
				'    TreeStyleTabService.readyToOpenChildTab(getBrowser(), true);'
			).replace(
				/(\}\)?)$/,
				'  if (TreeStyleTabService.checkToOpenChildTab(getBrowser()))\n' +
				'    TreeStyleTabService.stopToOpenChildTab(getBrowser());\n' +
				'$1'
			)
		);
	}

	// DomainTab
	// https://addons.mozilla.org/firefox/addon/13906/
	if ('domaintab' in window &&
		'TMP_howToOpen' in domaintab &&
		TreeStyleTabUtils.getTreePref('compatibility.DomainTab')) {
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
		TreeStyleTabUtils.getTreePref('compatibility.PersonalTitlebar')) {
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
		TreeStyleTabUtils.getTreePref('compatibility.TotalToolbar')) {
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

							case 'beforecustomization':
								for (let i = 0, maxi = tabbarToolboxes.length; i < maxi; i++)
								{
									tabbarToolboxes[i].removeAttribute('collapsed');
								}
								break;

							case 'aftercustomization':
								for (let i = 0, maxi = tabbarToolboxes.length; i < maxi; i++)
								{
									let toolbox = tabbarToolboxes[i];
									if (!toolbox.firstChild.hasChildNodes())
										toolbox.setAttribute('collapsed', true);
								}
								break;

							case 'unload':
								menu.removeEventListener('command', this, true);
								document.removeEventListener('beforecustomization', listener, true);
								document.removeEventListener('aftercustomization', listener, false);
								document.removeEventListener('unload', this, false);
								menu = null;
								break;
						}
					}
				};
			menu.addEventListener('command', listener, false);
			document.addEventListener('beforecustomization', listener, true);
			document.addEventListener('aftercustomization', listener, false);
			document.addEventListener('unload', listener, false);
			for (let i = 0, maxi = tabbarToolboxes.length; i < maxi; i++)
			{
				let toolbox = tabbarToolboxes[i];
				if (!toolbox.firstChild.hasChildNodes())
					toolbox.setAttribute('collapsed', true);
			}
		}
	}

	// Tab Control
	// https://addons.mozilla.org/firefox/addon/tab-control/
	if (
		TreeStyleTabUtils.getTreePref('compatibility.TabControl') &&
		'gTabControl' in window
		) {
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case sv.kEVENT_TYPE_FOCUS_NEXT_TAB:
							if (TreeStyleTabUtils.prefs.getPref('tabcontrol.focusLeftOnClose'))
								aEvent.preventDefault();
							break;

						case 'unload':
							document.removeEventListener(sv.kEVENT_TYPE_FOCUS_NEXT_TAB, this, false);
							break;
					}
				}
			};
		document.addEventListener(sv.kEVENT_TYPE_FOCUS_NEXT_TAB, listener, false);
		document.addEventListener('unload', listener, false);
	}

	// Firefox Sync (Weave)
	// http://www.mozilla.com/en-US/firefox/sync/
	if (
		(
			'gFxWeaveGlue' in window || // addon
			'gSyncUI' in window // Firefox 4 built-in
		) &&
		TreeStyleTabUtils.getTreePref('compatibility.FirefoxSync')
		) {
		let ns = {};
		try { // 1.4
			Components.utils.import('resource://services-sync/service.js', ns);
		}
		catch(e) { // 1.3
			Components.utils.import('resource://weave/service.js', ns);
		}
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

							let service = ns.Service || ns.Weave /* old name */;
							let manager = service.engineManager || service.Engines /* old name */;
							let engine = manager.get('tabs');

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
