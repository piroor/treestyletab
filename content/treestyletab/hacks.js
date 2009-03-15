TreeStyleTabService.overrideExtensionsPreInit = function() {

	// Highlander
	if ('Highlander' in window) {
		eval('Highlander.overrideHandleLinkClick = '+
			Highlander.overrideHandleLinkClick.toSource().replace(
				/(var )?origHandleLinkClick/g,
				'window.__treestyletab__highlander__origHandleLinkClick'
			)
		);
	}

	// PermaTabs
	if ('permaTabs' in window) {
		// without delay, Firefox crashes on startup.
		eval('permaTabs.__init = '+
			permaTabs.__init.toSource().replace(
				'aTab.setAttribute(\\"image\\", ',
				'window.setTimeout(function(aTab, aImage) { aTab.setAttribute(\\"image\\", aImage); }, 100, aTab, '
			)
		);
	}

	// Tab Mix Plus, SessionStore API
	if ('SessionData' in window &&
		'getTabProperties' in SessionData &&
		'setTabProperties' in SessionData) {
		var prefix = this.kTMP_SESSION_DATA_PREFIX;
		SessionData.tabTSTProperties = [
			prefix+this.kID,
			prefix+this.kCOLLAPSED,
			prefix+this.kSUBTREE_COLLAPSED,
			prefix+this.kCHILDREN,
			prefix+this.kPARENT,
			prefix+this.kANCESTOR,
			prefix+this.kINSERT_BEFORE
		];
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
						gBrowser.treeStyleTab.onTabRestored({ target : aTab, originalTarget : aTab });
				$1]]>
			)
		);
		var source = tablib.init.toSource().split('gBrowser.restoreTab = ');
		source[1] = source[1].replace(
			'return newTab;',
			<![CDATA[
				if (this.treeStyleTab.useTMPSessionAPI)
					this.treeStyleTab.onTabRestored({ target : newTab, originalTarget : newTab });
			$&]]>
		);
		eval('tablib.init = '+source.join('gBrowser.restoreTab = '));
		this.useTMPSessionAPI = true;
	}

	// Session Manager
	// We need to initialize TST before Session Manager restores the last session anyway!
	if ('gSessionManager' in window &&
		'onLoad_proxy' in gSessionManager &&
		'onLoad' in gSessionManager) {
		eval('gSessionManager.onLoad = '+gSessionManager.onLoad.toSource().replace(
			'{',
			'{ TreeStyleTabService.init();'
		));
	}
};

TreeStyleTabService.overrideExtensionsOnInitBefore = function() {

	// Tab Mix Plus
	if ('TMP_LastTab' in window) {
		TMP_LastTab.TabBar = gBrowser.mTabContainer;
	}
	if ('flst' in window) {
		flst.tb = gBrowser;
		flst.tabBox = flst.tb.mTabBox;
	}
	if ('isTabVisible' in gBrowser.mTabContainer &&
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
		if (!this.getTreePref('TMP.doNotUpdate.isTabVisible'))
			eval('gBrowser.mTabContainer.isTabVisible = '+
				replaceHorizontalProps(gBrowser.mTabContainer.isTabVisible.toSource())
			);
	}

};

TreeStyleTabService.overrideExtensionsOnInitAfter = function() {

	if ('MultipleTabService' in window) { // Multiple Tab Handler
		eval('MultipleTabService.showHideMenuItems = '+
			MultipleTabService.showHideMenuItems.toSource().replace(
				'var separators = ',
				<><![CDATA[
					if (aPopup.id == 'multipletab-selection-menu') {
						TreeStyleTabService.showHideSubTreeMenuItem(document.getElementById(TreeStyleTabService.kMENUITEM_REMOVESUBTREE_SELECTION), MultipleTabService.getSelectedTabs());
					}
					$&]]></>
			)
		);
	}

	if ('autoHIDE' in window) { // Autohide
		var func = 'ShowBars' in autoHIDE ? 'ShowBars' : 'ShowMenu' ;
		eval('autoHIDE.'+func+' = '+
			autoHIDE[func].toSource().replace(
				'{',
				'{ var treeStyleTabPos = gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION);'
			).replace(
				/e.screenY <= ((autoHIDE|ah).Win.boxObject).screenY \+ (autoHIDE.space|ah.senseArea)/,
				<><![CDATA[(e.screenY <= $1.screenY + $3 ||
				(
				treeStyleTabPos == 'left' ?
					(e.screenX <= $1.screenX + $3) :
				treeStyleTabPos == 'right' ?
					(e.screenX >= $1.screenX + $1.width - $3) :
				treeStyleTabPos == 'bottom' ?
					(e.screenY >= $1.screenY + $1.height - $3) :
					false
				))]]></>
			).replace( // for old version
				'e.screenY > getBrowser().mCurrentBrowser.boxObject.screenY + 25',
				<><![CDATA[(e.screenY > gBrowser.mCurrentBrowser.boxObject.screenY + 25 &&
				(
				treeStyleTabPos == 'left' ?
					(e.screenX > gBrowser.mCurrentBrowser.boxObject.screenX + 25) :
				treeStyleTabPos == 'right' ?
					(e.screenX < gBrowser.mCurrentBrowser.boxObject.screenX + gBrowser.mCurrentBrowser.boxObject.width - 25) :
				treeStyleTabPos == 'bottom' ?
					(e.screenY < gBrowser.mCurrentBrowser.boxObject.screenY + gBrowser.mCurrentBrowser.boxObject.height - 25) :
					true
				))]]></>
			).replace( // for new version
				'e.screenY > yCondition',
				<><![CDATA[(e.screenY > yCondition &&
				(
				treeStyleTabPos == 'left' ?
					(e.screenX > gBrowser.mCurrentBrowser.boxObject.screenX + 50) :
				treeStyleTabPos == 'right' ?
					(e.screenX < gBrowser.mCurrentBrowser.boxObject.screenX + gBrowser.mCurrentBrowser.boxObject.width - 50) :
				treeStyleTabPos == 'bottom' ?
					(e.screenY < gBrowser.mCurrentBrowser.boxObject.screenY + gBrowser.mCurrentBrowser.boxObject.height - 50) :
					true
				))]]></>
			)
		);
		eval('autoHIDE.HideToolbar = '+
			autoHIDE.HideToolbar.toSource().replace(
				/if \(((this|ah).Show)\) \{/,
				<><![CDATA[
					window.setTimeout('gBrowser.treeStyleTab.checkTabsIndentOverflow();', 0);
					var treeStyleTabPos = gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION);
					if ($1) {
						var appcontent = document.getElementById('appcontent');
						if (appcontent.__treestyletab__resized) {
							appcontent.__treestyletab__resized = false;
							appcontent.style.margin = 0;
						}
				]]></>
			)
		);
		func = 'RemoveAttrib' in autoHIDE ? 'RemoveAttrib' : 'EndFull' ;
		eval('autoHIDE.'+func+' = '+
			autoHIDE[func].toSource().replace(
				'{',
				<><![CDATA[$&
					var appcontent = document.getElementById('appcontent');
					if (appcontent.__treestyletab__resized) {
						appcontent.__treestyletab__resized = false;
						appcontent.style.margin = 0;
					}
					window.setTimeout('gBrowser.treeStyleTab.checkTabsIndentOverflow();', 0);
				]]></>
			)
		);
		eval('autoHIDE.SetMenu = '+
			autoHIDE.SetMenu.toSource().replace(
				'{',
				<><![CDATA[$&
					if (arguments.length && arguments[0]) {
						var treeStyleTabSplitter = document.getAnonymousElementByAttribute(gBrowser, 'class', TreeStyleTabService.kSPLITTER);
						gBrowser.treeStyleTab.tabbarWidth = gBrowser.mStrip.boxObject.width +
							(treeStyleTabSplitter ? treeStyleTabSplitter.boxObject.width : 0 );
					}
				]]></>
			)
		);
		func = 'MoveContent' in autoHIDE ? 'MoveContent' : 'MoveC' ;
		eval('autoHIDE.'+func+' = '+
			autoHIDE[func].toSource().replace(
				'{',
				<><![CDATA[$&
					var treeStyleTabPos = gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION);
					if (!arguments.length) {
						var appcontent = document.getElementById('appcontent');
						if (treeStyleTabPos == 'left' &&
							!appcontent.__treestyletab__resized) {
							appcontent.style.marginRight = '-'+gBrowser.treeStyleTab.tabbarWidth+'px';
							appcontent.__treestyletab__resized = true;
						}
						else if (treeStyleTabPos == 'right' &&
							!appcontent.__treestyletab__resized) {
							appcontent.style.marginLeft = '-'+gBrowser.treeStyleTab.tabbarWidth+'px';
							appcontent.__treestyletab__resized = true;
						}
						window.setTimeout('autoHIDE.MoveC(true);', 100);
						return;
					}
				]]></>
			).replace(
				/.(move|setPosition)\(0, - (this|ah).delta\)/,
				<><![CDATA[.$1(
					(
						treeStyleTabPos == 'left' ? -gBrowser.treeStyleTab.tabbarWidth :
						treeStyleTabPos == 'right' ? gBrowser.treeStyleTab.tabbarWidth :
						0
					),
					-$2.delta
				)]]></>
			)
		);
		var autoHideEventListener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'fullscreen':
							var autoHide = TreeStyleTabService.getTreePref('tabbar.autoHide.enabled');
							var pos      = gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION);
							if (window.fullScreen) { // restore
								if (autoHide && (pos == 'left' || pos == 'right'))
									gBrowser.treeStyleTab.startAutoHide();
							}
							else { // turn to fullscreen
								gBrowser.treeStyleTab.endAutoHide();
							}
							break;

						case 'unload':
							var t = aEvent.currentTarget;
							t.removeEventListener('unload', this, false);
							t.removeEventListener('fullscreen', this, false);
							break;
					}
				}
			};
		window.addEventListener('fullscreen', autoHideEventListener, false);
		window.addEventListener('unload', autoHideEventListener, false);
	}


	// Tab Mix Plus
	if ('TMupdateSettings' in window) {
		eval('window.TMupdateSettings = '+
			window.TMupdateSettings.toSource().replace(
				/(\{aTab.removeAttribute\("tabxleft"\);\})(\})/,
				<><![CDATA[$1
					gBrowser.treeStyleTab.initTabAttributes(aTab);
					gBrowser.treeStyleTab.initTabContentsOrder(aTab);
				$2]]></>
			)
		);

		gBrowser.mTabContainer.removeEventListener('DOMNodeInserted', tabxTabAdded, true);
		eval('window.tabxTabAdded = '+
			window.tabxTabAdded.toSource().replace(
				/(\})(\)?)$/,
				<><![CDATA[
					gBrowser.treeStyleTab.initTabAttributes(aTab);
					gBrowser.treeStyleTab.initTabContentsOrder(aTab);
				$1$2]]></>
			)
		);
		gBrowser.mTabContainer.addEventListener('DOMNodeInserted', tabxTabAdded, true);

		eval('window.TMP_TabDragGesture = '+
			window.TMP_TabDragGesture.toSource().replace(
				'{',
				<><![CDATA[$&
					if (TreeStyleTabService.getPref('extensions.tabmix.tabBarMode', 1) != 2) {
						nsDragAndDrop.startDrag(aEvent, (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical' ? gBrowser : TabDNDObserver ));
						aEvent.stopPropagation();
						return;
					}
				]]></>
			)
		);
		eval('window.TMP_TabDragOver = '+
			window.TMP_TabDragOver.toSource().replace(
				'{',
				<><![CDATA[$&
					if (TreeStyleTabService.getPref('extensions.tabmix.tabBarMode', 1) != 2) {
						nsDragAndDrop.dragOver(aEvent, (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical' ? gBrowser : TabDNDObserver ));
						aEvent.stopPropagation();
						return;
					}
				]]></>
			)
		);
		eval('window.TMP_TabDragDrop = '+
			window.TMP_TabDragDrop.toSource().replace(
				'{',
				<><![CDATA[$&
					if (TreeStyleTabService.getPref('extensions.tabmix.tabBarMode', 1) != 2) {
						nsDragAndDrop.drop(aEvent, (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical' ? gBrowser : TabDNDObserver ));
						aEvent.stopPropagation();
						return;
					}
				]]></>
			)
		);
		eval('window.TMP_TabDragExit = '+
			window.TMP_TabDragExit.toSource().replace(
				'{',
				<><![CDATA[$&
					if (TreeStyleTabService.getPref('extensions.tabmix.tabBarMode', 1) != 2) {
						nsDragAndDrop.dragExit(aEvent, (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical' ? gBrowser : TabDNDObserver ));
						aEvent.stopPropagation();
						return;
					}
				]]></>
			)
		);

		this.updateTabDNDObserver(TabDNDObserver);
		eval('TabDNDObserver.clearDragmark = '+
			TabDNDObserver.clearDragmark.toSource().replace(
				/(\})(\))?$/,
				'gBrowser.treeStyleTab.clearDropPosition(); $1$2'
			)
		);
		eval('TabDNDObserver.canDrop = '+
			TabDNDObserver.canDrop.toSource().replace(
				'var TSTTabBrowser = this;',
				'var TSTTabBrowser = gBrowser;'
			)
		);
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
				'var TSTTabBrowser = gBrowser;'
			).replace(
				/(var newIndex =)/,
				<><![CDATA[
					if (isTabReorder && TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, aDragSession.sourceNode))
						return;
				]]></>
			).replace(
				/(aTab = gBrowser.addTab\(url\));/,
				<><![CDATA[
					TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, $1);
					return;
				]]></>
			).replace(
				/(aTab = event.target;)/,
				<><![CDATA[
					$1
					if (
						aTab.getAttribute('locked') == 'true' ||
						TreeStyleTabService.getTreePref('loadDroppedLinkToNewChildTab') ||
						dropActionInfo.position != TreeStyleTabService.kDROP_ON
						) {
						TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, TSTTabBrowser.loadOneTab(url, null, null, null, bgLoad, false));
						return;
					}
				]]></>
			).replace(
				/aEvent/g, 'event'
			).replace(
				/aDragSession/g, 'session'
			)
		);

		eval('window.TM_BrowserHome = '+
			window.TM_BrowserHome.toSource().replace(
				/(var bgLoad = )/,
				<><![CDATA[
					TreeStyleTabService.readyToOpenChildTab(firstTabAdded, true);
					$1
				]]></>
			).replace(
				/(\})(\)?)$/,
				<><![CDATA[
					TreeStyleTabService.stopToOpenChildTab(firstTabAdded);
					$1$2
				]]></>
			)
		);

		eval('window.TMP_openURL = '+
			window.TMP_openURL.toSource().replace(
				/(var firstTab = [^\(]+\([^\)]+\))/,
				<><![CDATA[
					$1;
					TreeStyleTabService.readyToOpenChildTab(firstTab, true);
				]]></>
			).replace(
				/(anyBrowser.mTabContainer.nextTab)/,
				<><![CDATA[
					TreeStyleTabService.stopToOpenChildTab(firstTab);
					$1
				]]></>
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
				'index = prevTab._tPos + 1;',
				<><![CDATA[
					index = gBrowser.treeStyleTab.getNextSiblingTab(gBrowser.treeStyleTab.getRootTab(prevTab));
					if (tabToSelect == aTab) index = gBrowser.treeStyleTab.getNextSiblingTab(index);
					index = index ? index._tPos : (prevTab._tPos + 1);
				]]></>
			).replace(
				/(prevTab = aTab;)/,
				<><![CDATA[
					$1
					if (tabToSelect == aTab && TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree')) {
						TreeStyleTabService.readyToOpenChildTab(tabToSelect, true, gBrowser.treeStyleTab.getNextSiblingTab(tabToSelect));
					}
				]]></>
			).replace(
				/(browser.mTabContainer.nextTab)/,
				<><![CDATA[
					if (TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree'))
						TreeStyleTabService.stopToOpenChildTab(tabToSelect);
					$1]]></>
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
				<><![CDATA[
					var tabsResult = TreeStyleTabService.getVisibleTabs(getBrowser().selectedTab);
					var tabs = [];
					for (var t = 0, maxt = tabsResult.snapshotLength; t < maxt; t++)
						tabs.push(tabsResult.snapshotItem(t));
				]]></>
			).replace(
				/tabs.item\(([^\)]+)\)/g,
				'tabs[$1]'
			)
		);

		TreeStyleTabService.registerCollapseExpandPostProcess(function() {
			tabBarScrollStatus();
		});

		TreeStyleTabBrowser.prototype.isMultiRow = function()
		{
			return window.tabscroll == 2;
		};

		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return aTabBrowser.treeStyleTab.getPref('extensions.tabmix.focusTab') == 2;
		});

		window.setTimeout(function() {
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
					'{',
					'{ var tabs = this.treeStyleTab.getDescendantTabs(this.treeStyleTab.getRootTab(this.mCurrentTab));'
				).replace(
					/((this.mCurrentTab._tPos)( \+ this.mTabContainer.nextTab))/,
					'((tabs.length ? tabs[tabs.length-1]._tPos : $2 )$3)'
				)
			);

			eval('gBrowser.TMmoveTabTo = '+
				gBrowser.TMmoveTabTo.toSource().replace(
					/(aTab.dispatchEvent)/,
					'this.treeStyleTab.internallyTabMoving = true; $1'
				).replace(
					/(return aTab;\})(\)?)$/,
					'this.treeStyleTab.internallyTabMoving = false; $1$2'
				)
			);

			window.BrowserHome = window.TM_BrowserHome;
			window.BrowserOpenTab = window.TMP_BrowserOpenTab;

			gBrowser.treeStyleTab.internallyTabMoving = false;
		}, 0);

		gBrowser.treeStyleTab.internallyTabMoving = true; // until "TMmoveTabTo" method is overwritten
	}


	// Super DragAndGo
	if ('superDrag' in window) {
		eval('superDrag.onDrop = '+
			superDrag.onDrop.toSource().replace(
				/(var newTab = getBrowser\(\).addTab\([^\)]+\);)/g,
				<><![CDATA[
					if (aDragSession.sourceNode &&
						aDragSession.sourceNode.ownerDocument.defaultView.top == getBrowser().contentWindow)
						TreeStyleTabService.readyToOpenChildTab(getBrowser());
					$1
				]]></>
			)
		);
	}
	if ('TMP_Places' in window &&
		'getTabFixedTitle' in TMP_Places) {
		TreeStyleTabService.addBookmarkTabsFilter = function(aTab) {
			var b = aTab.linkedBrowser;
			var uri = b.currentURI;
			return {
				uri   : uri,
				title : TMP_Places.getTabFixedTitle(b, uri)
			};
		};
	}

	// Drag de Go
	if ('ddg_ges' in window) {
		eval('ddg_ges.Open = '+
			ddg_ges.Open.toSource().replace(
				'if (mode[1] == "h" || mode[1] == "f") {',
				<><![CDATA[$&
					if ('sourceNode' in aData) // only for dragging from the content tarea.
						TreeStyleTabService.readyToOpenChildTab(getBrowser());
				]]></>
			)
		);
		eval('ddg_ges.Search = '+
			ddg_ges.Search.toSource().replace(
				'if (mode[1] == "h" || mode[1] == "f") {',
				<><![CDATA[$&
						TreeStyleTabService.readyToOpenChildTab(getBrowser());
				]]></>
			)
		);
	}

	// ColorfulTab
	if ('clrtabsInit' in window) {
		this.registerAttachTabPostProcess(function(aChild, aParent, aService) {
			if (aChild && aParent) {
				setColor(aChild, aService.SessionStore.getTabValue(aParent, 'tabClr'));
			}
			else if (aChild) {
				aService.SessionStore.setTabValue(aChild, 'tabClr', '')
				calcTabClr({
					target : aChild,
					originalTarget : aChild,
				});
			}
		});
	}

	// FLST
	if ('flst' in window) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !aTabBrowser.treeStyleTab.getPref('extensions.flst.enabled');
		});
	}

	// FireGestures
	if ('FireGestures' in window) {
		eval('FireGestures.onExtraGesture = '+
			FireGestures.onExtraGesture.toSource().replace(
				'case "keypress-stop":',
				<><![CDATA[$&
					TreeStyleTabService.readyToOpenChildTab(gBrowser, true);
				]]></>
			).replace(
				'break;case "gesture-timeout":',
				<><![CDATA[
					TreeStyleTabService.stopToOpenChildTab(gBrowser);
				$&]]></>
			)
		);
		eval('FireGestures._performAction = '+
			FireGestures._performAction.toSource().replace(
				'gBrowser.loadOneTab(',
				<><![CDATA[
					TreeStyleTabService.readyToOpenChildTab(gBrowser);
				$&]]></>
			)
		);
		eval('FireGestures.openURLsInSelection = '+
			FireGestures.openURLsInSelection.toSource().replace(
				'var tab =',
				<><![CDATA[
					if (!TreeStyleTabService.checkToOpenChildTab(gBrowser))
						TreeStyleTabService.readyToOpenChildTab(gBrowser, true);
				$&]]></>
			).replace(
				'if (!flag)',
				<><![CDATA[
					if (TreeStyleTabService.checkToOpenChildTab(gBrowser))
						TreeStyleTabService.stopToOpenChildTab(gBrowser);
				$&]]></>
			)
		);
		eval('FireGestures.handleEvent = '+
			FireGestures.handleEvent.toSource().replace(
				'gBrowser.loadOneTab(',
				<><![CDATA[
					TreeStyleTabService.readyToOpenChildTab(gBrowser);
				$&]]></>
			)
		);
	}

	// Greasemonkey
	if ('GM_BrowserUI' in window && 'openInTab' in GM_BrowserUI) {
		eval('GM_BrowserUI.openInTab = '+
			GM_BrowserUI.openInTab.toSource().replace( // old
				'document.getElementById("content")',
				'TreeStyleTabService.readyToOpenChildTab($&); $&'
			).replace( // GM 0.8 or later
				/(if\s*\(this\.isMyWindow\(([^\)]+)\)\)\s*\{\s*)(this\.tabBrowser)/,
				'$1 TreeStyleTabService.readyToOpenChildTab($2); $3'
			)
		);
	}

	// LastTab
	if ('LastTab' in window) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !aTabBrowser.treeStyleTab.getPref('extensions.lasttab.focusLastTabOnClose');
		});
	}

	// SBM Counter
	if ('SBMCounter' in window) {
		eval('SBMCounter.action = '+
			SBMCounter.action.toSource().replace(
				'gBrowser.selectedTab = gBrowser.addTab',
				'TreeStyleTabService.readyToOpenChildTab(gBrowser); $&'
			)
		);
	}

	// Aging Tabs
	if ('agingTabs' in window) {
		eval('agingTabs.setColor = '+
			agingTabs.setColor.toSource().replace(
				'{',
				'{ important = true;'
			)
		);
	}

	// Snap Links
	if ('executeAction' in window && 'openTabs' in window) {
		eval('window.openTabs = '+
			window.openTabs.toSource().replace(
				'sContent.addTab',
				'TreeStyleTabService.readyToOpenChildTab(sContent); $&'
			)
		);
	}

	// Mouseless Browsing
	if ('mouselessbrowsing' in window &&
		'EventHandler' in mouselessbrowsing) {
		if ('execute' in mouselessbrowsing.EventHandler) {
			eval('mouselessbrowsing.EventHandler.execute = '+
				mouselessbrowsing.EventHandler.execute.toSource().replace(
					/((?:var [^=]+ = )?Utils.openUrlInNewTab\()/g,
					'TreeStyleTabService.readyToOpenChildTab(); $1'
				)
			);
		}
		if ('openLinkInOtherLocationViaPostfixKey' in mouselessbrowsing.EventHandler) {
			eval('mouselessbrowsing.EventHandler.openLinkInOtherLocationViaPostfixKey = '+
				mouselessbrowsing.EventHandler.openLinkInOtherLocationViaPostfixKey.toSource().replace(
					'Utils.openUrlInNewTab(',
					'TreeStyleTabService.readyToOpenChildTab(); $&'
				)
			);
		}
	}

};
