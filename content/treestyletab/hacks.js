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
	if (this.getTreePref('compatibility.TMP') &&
		'SessionData' in window &&
		'getTabProperties' in SessionData &&
		'setTabProperties' in SessionData) {
		var prefix = this.kTMP_SESSION_DATA_PREFIX;
		SessionData.tabTSTProperties = this.extraProperties.map(function(aProperty) {
			return prefix+aProperty;
		});
		eval('SessionData.getTabProperties = '+
			SessionData.getTabProperties.toSource().replace(
				'return tabProperties;',
				<![CDATA[
					this.tabTSTProperties.forEach(function(aProp) {
						tabProperties += '|' + aProp + '=' + encodeURIComponent(aTab.getAttribute(aProp));
					});
				$&]]>
			)
		);
		eval('SessionData.setTabProperties = '+
			SessionData.setTabProperties.toSource().replace(
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
		eval('SessionManager.loadOneTab = '+
			SessionManager.loadOneTab.toSource().replace(
				/(\}\))?$/,
				<![CDATA[
					if (gBrowser.treeStyleTab.useTMPSessionAPI)
						gBrowser.treeStyleTab.restoreStructure(aTab);
				$1]]>
			)
		);
		var source = tablib.init.toSource().split('gBrowser.restoreTab = ');
		source[1] = source[1].replace(
			'return newTab;',
			<![CDATA[
				if (this.treeStyleTab.useTMPSessionAPI)
					this.treeStyleTab.restoreStructure(newTab);
			$&]]>
		);
		eval('tablib.init = '+source.join('gBrowser.restoreTab = '));
		eval('SessionManager.loadOneWindow = '+
			SessionManager.loadOneWindow.toSource().replace(
				'gBrowser.tabsToLoad = ',
				<![CDATA[
					gBrowser.treeStyleTab.resetAllTabs(true, true);
					TreeStyleTabService.restoringWindow = true;
				$&]]>
			).replace(
				/(\}\))?$/,
				'TreeStyleTabService.restoringWindow = false; $1'
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
					TreeStyleTabService.restoringWindow = true;
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
				'if (gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION) == "top") { $& }'
			));
		}, this);
	}

	// TooManyTabs
	// https://addons.mozilla.org/firefox/addon/9429
	if ('tooManyTabs' in window) {
		this.registerExpandTwistyAreaAllowance(function(aTabBrowser) {
			return false;
		});
	}
};

TreeStyleTabService.overrideExtensionsOnInitBefore = function TSTService_overrideExtensionsOnInitBefore() {

	// Tab Mix Plus
	if (this.getTreePref('compatibility.TMP') &&
		'TMP_LastTab' in window) {
		TMP_LastTab.TabBar = gBrowser.mTabContainer;
	}
	if (this.getTreePref('compatibility.TMP') &&
		'flst' in window) {
		flst.tb = gBrowser;
		flst.tabBox = flst.tb.mTabBox;
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
					/boxObject\.width/g,
					'boxObject[sizeProp]'
				).replace(
					'{',
					<![CDATA[$&
						var posProp = gBrowser.treeStyleTab.isVertical ? 'y' : 'x' ;
						var sizeProp = gBrowser.treeStyleTab.isVertical ? 'height' : 'width' ;
					]]>
				)
		}
		eval('gBrowser.mTabContainer.ensureTabIsVisible = '+
			replaceHorizontalProps(gBrowser.mTabContainer.ensureTabIsVisible.toSource().replace(
				'tabhbox.boxObject.width < 250',
				'$& && !gBrowser.treeStyleTab.isVertical'
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

	// Multiple Tab Handler
	if ('MultipleTabService' in window) {
		eval('MultipleTabService.showHideMenuItems = '+
			MultipleTabService.showHideMenuItems.toSource().replace(
				'var separators = ',
				<![CDATA[
					if (aPopup.id == 'multipletab-selection-menu') {
						TreeStyleTabService.showHideSubtreeMenuItem(document.getElementById(TreeStyleTabService.kMENUITEM_REMOVESUBTREE_SELECTION), MultipleTabService.getSelectedTabs());
					}
					$&]]>
			)
		);
	}

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
	if (this.getTreePref('compatibility.TMP') &&
		'TMupdateSettings' in window) {
		eval('window.TMupdateSettings = '+
			window.TMupdateSettings.toSource().replace(
				/(\{aTab.removeAttribute\("tabxleft"\);\})(\})/,
				<![CDATA[$1
					gBrowser.treeStyleTab.initTabAttributes(aTab);
					gBrowser.treeStyleTab.initTabContentsOrder(aTab);
				$2]]>
			)
		);

		gBrowser.mTabContainer.removeEventListener('DOMNodeInserted', tabxTabAdded, true);
		eval('window.tabxTabAdded = '+
			window.tabxTabAdded.toSource().replace(
				/(\})(\)?)$/,
				<![CDATA[
					gBrowser.treeStyleTab.initTabAttributes(aTab);
					gBrowser.treeStyleTab.initTabContentsOrder(aTab);
				$1$2]]>
			)
		);
		gBrowser.mTabContainer.addEventListener('DOMNodeInserted', tabxTabAdded, true);

		eval('window.TMP_TabDragGesture = '+
			window.TMP_TabDragGesture.toSource().replace(
				'{',
				<![CDATA[$&
					if (TreeStyleTabService.getPref('extensions.tabmix.tabBarMode', 1) != 2) {
						nsDragAndDrop.startDrag(aEvent, (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical' ? gBrowser : TabDNDObserver ));
						aEvent.stopPropagation();
						return;
					}
				]]>
			)
		);
		eval('window.TMP_TabDragOver = '+
			window.TMP_TabDragOver.toSource().replace(
				'{',
				<![CDATA[$&
					if (TreeStyleTabService.getPref('extensions.tabmix.tabBarMode', 1) != 2) {
						nsDragAndDrop.dragOver(aEvent, (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical' ? gBrowser : TabDNDObserver ));
						aEvent.stopPropagation();
						return;
					}
				]]>
			)
		);
		eval('window.TMP_TabDragDrop = '+
			window.TMP_TabDragDrop.toSource().replace(
				'{',
				<![CDATA[$&
					if (TreeStyleTabService.getPref('extensions.tabmix.tabBarMode', 1) != 2) {
						nsDragAndDrop.drop(aEvent, (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical' ? gBrowser : TabDNDObserver ));
						aEvent.stopPropagation();
						return;
					}
				]]>
			)
		);
		eval('window.TMP_TabDragExit = '+
			window.TMP_TabDragExit.toSource().replace(
				'{',
				<![CDATA[$&
					if (TreeStyleTabService.getPref('extensions.tabmix.tabBarMode', 1) != 2) {
						nsDragAndDrop.dragExit(aEvent, (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical' ? gBrowser : TabDNDObserver ));
						aEvent.stopPropagation();
						return;
					}
				]]>
			)
		);

		this.updateTabDNDObserver(TabDNDObserver);
		eval('TabDNDObserver.clearDragmark = '+
			TabDNDObserver.clearDragmark.toSource().replace(
				/(\})(\))?$/,
				'gBrowser.treeStyleTab.clearDropPosition(); $1$2'
			)
		);
		if (TabDNDObserver.canDrop) {
			eval('TabDNDObserver.canDrop = '+
				TabDNDObserver.canDrop.toSource().replace(
					'var TSTTabBrowser = this;',
					'var TSTTabBrowser = gBrowser;'
				).replace(
					/\.screenY/g,
					'[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.invertedPositionProp]'
				).replace(
					/\.height/g,
					'[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.invertedSizeProp]'
				)
			);
		}
		if (TabDNDObserver._setEffectAllowedForDataTransfer) {
			eval('TabDNDObserver._setEffectAllowedForDataTransfer = '+
				TabDNDObserver._setEffectAllowedForDataTransfer.toSource().replace(
					'var TSTTabBrowser = this;',
					'var TSTTabBrowser = gBrowser;'
				)
			);
		}
		if (TabDNDObserver.onDragStart) {
			eval('TabDNDObserver.onDragStart = '+
				TabDNDObserver.onDragStart.toSource().replace(
					'event.target.localName != "tab"',
					<![CDATA[
						gBrowser.treeStyleTab.tabbarDNDObserver.canDragTabbar(event) ||
						$&
					]]>
				)
			);
		}
		eval('TabDNDObserver.onDragOver = '+
			TabDNDObserver.onDragOver.toSource().replace(
				'var TSTTabBrowser = this;',
				'var TSTTabBrowser = gBrowser;'
			).replace(
				/aEvent/g, 'event'
			).replace(
				/aDragSession/g, 'session'
			)
		);
		eval('TabDNDObserver.onDrop = '+
			TabDNDObserver.onDrop.toSource().replace(
				'var TSTTabBrowser = this;',
				'var TSTTabBrowser = gBrowser;'+
				'if (!aDragSession) aDragSession = TSTTabBrowser.treeStyleTab.getCurrentDragSession();'
			).replace(
				/(var newIndex =)/,
				<![CDATA[
					if (isTabReorder && TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, aDragSession.sourceNode))
						return;
				]]>
			).replace(
				/(aTab = gBrowser.addTab\(url\));/,
				<![CDATA[
					TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, $1);
					return;
				]]>
			).replace(
				/(aTab = event.target;)/,
				<![CDATA[
					$1
					if (
						aTab.getAttribute('locked') == 'true' ||
						dropActionInfo.position != TreeStyleTabService.kDROP_ON ||
						(TreeStyleTabService.dropLinksOnTabBehavior() & TreeStyleTabService.kDROPLINK_NEWTAB)
						) {
						TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, TSTTabBrowser.loadOneTab(url, null, null, null, bgLoad, false));
						return;
					}
				]]>
			).replace(
				/aEvent/g, 'event'
			).replace(
				/aDragSession/g, 'session'
			)
		);

		eval('window.TM_BrowserHome = '+
			window.TM_BrowserHome.toSource().replace(
				/(var bgLoad = )/,
				<![CDATA[
					TreeStyleTabService.readyToOpenChildTab(firstTabAdded, true);
					$1
				]]>
			).replace(
				/(\})(\)?)$/,
				<![CDATA[
					TreeStyleTabService.stopToOpenChildTab(firstTabAdded);
					$1$2
				]]>
			)
		);

		eval('window.TMP_openURL = '+
			window.TMP_openURL.toSource().replace(
				/(var firstTab = [^\(]+\([^\)]+\))/,
				<![CDATA[
					$1;
					TreeStyleTabService.readyToOpenChildTab(firstTab, true);
				]]>
			).replace(
				/(anyBrowser.mTabContainer.nextTab)/,
				<![CDATA[
					TreeStyleTabService.stopToOpenChildTab(firstTab);
					$1
				]]>
			)
		);

		eval('window.TMP_howToOpen = '+
			window.TMP_howToOpen.toSource().replace(
				/(window.openNewTabWith\()/g,
				'TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView); $1'
			)
		);

		eval('window.openMultipleLinks = '+
			window.openMultipleLinks.toSource().replace(
				/(if \(rangeCount > 0\) \{)/,
				'$1 TreeStyleTabService.readyToOpenChildTab(focusedWindow, true);'
			).replace(
				/(return true;)/,
				'if (rangeCount > 0) { TreeStyleTabService.stopToOpenChildTab(focusedWindow); }; $1'
			)
		);

		eval('TMP_Bookmark.openGroup = '+
			TMP_Bookmark.openGroup.toSource().replace(
				'{',
				'$& var TSTOpenGroupBookmarkBehavior = TreeStyleTabService.openGroupBookmarkBehavior();'
			).replace(
				'index = prevTab._tPos + 1;',
				<![CDATA[
					index = gBrowser.treeStyleTab.getNextSiblingTab(gBrowser.treeStyleTab.getRootTab(prevTab));
					if (tabToSelect == aTab) index = gBrowser.treeStyleTab.getNextSiblingTab(index);
					index = index ? index._tPos : (prevTab._tPos + 1);
				]]>
			).replace(
				/(prevTab = aTab;)/,
				<![CDATA[
					$1
					if (tabToSelect == aTab && TSTOpenGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE) {
						TreeStyleTabService.readyToOpenChildTab(tabToSelect, true, gBrowser.treeStyleTab.getNextSiblingTab(tabToSelect));
					}
				]]>
			).replace(
				/(browser.mTabContainer.nextTab)/,
				<![CDATA[
					if (TSTOpenGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE)
						TreeStyleTabService.stopToOpenChildTab(tabToSelect);
					$1]]>
			)
		);

		'setMultibarAttribute getMultiRowAttribute tabxTabClosed'.split(' ').forEach(function(aFunc) {
			if (aFunc in window)
				eval('window.'+aFunc+' = '+
					window[aFunc].toSource().replace(
						/(tabBar.lastChild)/g,
						'TreeStyleTabService.getLastVisibleTab($1)'
					)
				);
		});

		eval('window.getRowHeight = '+
			window.getRowHeight.toSource().replace(
				'var tabs = getBrowser().mTabContainer.childNodes;',
				<![CDATA[
					var tabsResult = TreeStyleTabService.getVisibleTabs(getBrowser().selectedTab);
					var tabs = [];
					for (var t = 0, maxt = tabsResult.snapshotLength; t < maxt; t++)
						tabs.push(tabsResult.snapshotItem(t));
				]]>
			).replace(
				/tabs.item\(([^\)]+)\)/g,
				'tabs[$1]'
			)
		);

		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'TreeStyleTabCollapsedStateChange':
							tabBarScrollStatus();
							break;

						case 'unload':
							window.removeEventListener('TreeStyleTabCollapsedStateChange', this, false);
							window.removeEventListener('unload', this, false);
							break;
					}
				}
			};
		window.addEventListener('TreeStyleTabCollapsedStateChange', listener, false);
		window.addEventListener('unload', listener, false);

		TreeStyleTabBrowser.prototype.isMultiRow = function()
		{
			return window.tabscroll == 2;
		};

		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			var mode = aTabBrowser.treeStyleTab.getPref('extensions.tabmix.focusTab');
			return mode == 2 || mode == 5;
		});

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
	if (window['piro.sakura.ne.jp'].extensions.isAvailable('focuslastselectedtab@gozer.org')) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !aTabBrowser.selectedTab.hasAttribute('lastselected');
		});
	}

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
									gBrowser.getAttribute(gBrowser.treeStyleTab.kTABBAR_POSITION) == 'bottom' &&
									!gBrowser.treeStyleTab.getPref('extensions.autohide.bars.statBar.always') &&
									gBrowser.treeStyleTab.getPref('extensions.autohide.bars.statBar')
									) {
									autoHIDE.statBar.setAttribute('ahHIDE', true);
								}
							}
							else {
								gBrowser.mStrip.removeAttribute('ahHIDE');
								if (
									autoHIDE.statBar &&
									aTabBrowser.getAttribute(gBrowser.treeStyleTab.kTABBAR_POSITION) == 'bottom' &&
									!aTabBrowser.treeStyleTab.getPref('extensions.autohide.bars.statBar.always') &&
									aTabBrowser.treeStyleTab.getPref('extensions.autohide.bars.statBar')
									) {
									autoHIDE.statBar.removeAttribute('ahHIDE');
								}
							}
							break;

						case 'fullscreen':
							var treeStyleTab = gBrowser.treeStyleTab;
							if (gBrowser.getAttribute(treeStyleTab.kTABBAR_POSITION) != 'top') {
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

	window.setTimeout(function(aSelf) {
		aSelf.overrideExtensionsDelayed();
	}, 0, this);
};


TreeStyleTabService.overrideExtensionsDelayed = function TSTService_overrideExtensionsDelayed() {

	// Tab Mix Plus
	if (this.getTreePref('compatibility.TMP') &&
		'TMupdateSettings' in window) {
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
				'this.mCurrentTab._tPos + this.mTabContainer.nextTab',
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

		window.BrowserHome = window.TM_BrowserHome;
		window.BrowserOpenTab = window.TMP_BrowserOpenTab;

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

};
