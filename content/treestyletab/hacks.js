TreeStyleTabService.overrideExtensions = function() {
	if ('MultipleTabService' in window) { // Multiple Tab Handler
		eval('MultipleTabService.showHideMenuItems = '+
			MultipleTabService.showHideMenuItems.toSource().replace(
				/var separators = /,
				<><![CDATA[
					if (aPopup.id == 'multipletab-selection-menu') {
						TreeStyleTabService.showHideRemoveSubTreeMenuItem(document.getElementById(TreeStyleTabService.kMENUITEM_REMOVESUBTREE_SELECTION), MultipleTabService.getSelectedTabs());
					}
					var separators = ]]></>
			)
		);
	}

	if ('autoHIDE' in window) { // Autohide
		eval('autoHIDE.ShowMenu = '+
			autoHIDE.ShowMenu.toSource().replace(
				'{',
				'{ var treeStyleTabPos = gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION);'
			).replace(
				'e.screenY <= autoHIDE.Win.boxObject.screenY + autoHIDE.space',
				<><![CDATA[(e.screenY <= autoHIDE.Win.boxObject.screenY + autoHIDE.space ||
				(
				treeStyleTabPos == 'left' ?
					(e.screenX <= autoHIDE.Win.boxObject.screenX + autoHIDE.space) :
				treeStyleTabPos == 'right' ?
					(e.screenX >= autoHIDE.Win.boxObject.screenX + autoHIDE.Win.boxObject.width - autoHIDE.space) :
				treeStyleTabPos == 'bottom' ?
					(e.screenY >= autoHIDE.Win.boxObject.screenY + autoHIDE.Win.boxObject.height - autoHIDE.space) :
					false
				))]]></>
			).replace(
				'e.screenY > getBrowser().mCurrentBrowser.boxObject.screenY + 25',
				<><![CDATA[(e.screenY > getBrowser().mCurrentBrowser.boxObject.screenY + 25 &&
				(
				treeStyleTabPos == 'left' ?
					(e.screenX > getBrowser().mCurrentBrowser.boxObject.screenX + 25) :
				treeStyleTabPos == 'right' ?
					(e.screenX < getBrowser().mCurrentBrowser.boxObject.screenX + getBrowser().mCurrentBrowser.boxObject.width - 25) :
				treeStyleTabPos == 'bottom' ?
					(e.screenY < getBrowser().mCurrentBrowser.boxObject.screenY + getBrowser().mCurrentBrowser.boxObject.height - 25) :
					true
				))]]></>
			)
		);
		eval('autoHIDE.HideToolbar = '+
			autoHIDE.HideToolbar.toSource().replace(
				'if (this.Show) {',
				<><![CDATA[
					window.setTimeout('TreeStyleTabService.checkTabsIndentOverflow(gBrowser);', 0);
					var treeStyleTabPos = gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION);
					if (this.Show) {
						var appcontent = document.getElementById('appcontent');
						if (appcontent.__treestyletab__resized) {
							appcontent.__treestyletab__resized = false;
							appcontent.style.margin = 0;
						}
				]]></>
			)
		);
		eval('autoHIDE.EndFull = '+
			autoHIDE.EndFull.toSource().replace(
				'{',
				<><![CDATA[
					{
						var appcontent = document.getElementById('appcontent');
						if (appcontent.__treestyletab__resized) {
							appcontent.__treestyletab__resized = false;
							appcontent.style.margin = 0;
						}
						window.setTimeout('TreeStyleTabService.checkTabsIndentOverflow(gBrowser);', 0);
				]]></>
			)
		);
		eval('autoHIDE.SetMenu = '+
			autoHIDE.SetMenu.toSource().replace(
				'{',
				<><![CDATA[
					{
						if (arguments.length && arguments[0]) {
							var treeStyleTabSplitter = document.getAnonymousElementByAttribute(gBrowser, 'class', TreeStyleTabService.kSPLITTER);
							TreeStyleTabService.tabbarWidth = gBrowser.mStrip.boxObject.width +
								(treeStyleTabSplitter ? treeStyleTabSplitter.boxObject.width : 0 );
						}
				]]></>
			)
		);
		eval('autoHIDE.MoveC = '+
			autoHIDE.MoveC.toSource().replace(
				'{',
				<><![CDATA[
					{
						var treeStyleTabPos = gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION);
						if (!arguments.length) {
							var appcontent = document.getElementById('appcontent');
							if (treeStyleTabPos == 'left' &&
								!appcontent.__treestyletab__resized) {
								appcontent.style.marginRight = '-'+TreeStyleTabService.tabbarWidth+'px';
								appcontent.__treestyletab__resized = true;
							}
							else if (treeStyleTabPos == 'right' &&
								!appcontent.__treestyletab__resized) {
								appcontent.style.marginLeft = '-'+TreeStyleTabService.tabbarWidth+'px';
								appcontent.__treestyletab__resized = true;
							}
							window.setTimeout('autoHIDE.MoveC(true);', 100);
							return;
						}
				]]></>
			).replace(
				'.move(0, - this.delta)',
				<><![CDATA[.move(
					(
						treeStyleTabPos == 'left' ? -TreeStyleTabService.tabbarWidth :
						treeStyleTabPos == 'right' ? TreeStyleTabService.tabbarWidth :
						0
					),
					-this.delta
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
									TreeStyleTabService.startAutoHide();
							}
							else { // turn to fullscreen
								TreeStyleTabService.endAutoHide();
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
					TreeStyleTabService.initTabAttributes(aTab);
					TreeStyleTabService.initTabContentsOrder(aTab);
				$2]]></>
			)
		);

		gBrowser.mTabContainer.removeEventListener('DOMNodeInserted', tabxTabAdded, true);
		eval('window.tabxTabAdded = '+
			window.tabxTabAdded.toSource().replace(
				/(\})(\)?)$/,
				<><![CDATA[
					TreeStyleTabService.initTabAttributes(aTab);
					TreeStyleTabService.initTabContentsOrder(aTab);
				$1$2]]></>
			)
		);
		gBrowser.mTabContainer.addEventListener('DOMNodeInserted', tabxTabAdded, true);

		eval('window.TMP_TabDragGesture = '+
			window.TMP_TabDragGesture.toSource().replace(
				'{',
				<><![CDATA[
				{
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
				<><![CDATA[
				{
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
				<><![CDATA[
				{
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
				<><![CDATA[
				{
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
				'TreeStyleTabService.clearDropPosition(gBrowser); $1$2'
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
					if (isTabReorder && TreeStyleTabService.processDropAction(dropActionInfo, TSTTabBrowser, aDragSession.sourceNode))
						return;
				]]></>
			).replace(
				/(aTab = gBrowser.addTab\(url\));/,
				<><![CDATA[
					TreeStyleTabService.processDropAction(dropActionInfo, TSTTabBrowser, $1);
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
						TreeStyleTabService.processDropAction(dropActionInfo, TSTTabBrowser, TSTTabBrowser.loadOneTab(url, null, null, null, bgLoad, false));
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
					index = TreeStyleTabService.getNextSiblingTab(TreeStyleTabService.getRootTab(prevTab));
					if (tabToSelect == aTab) index = TreeStyleTabService.getNextSiblingTab(index);
					index = index ? index._tPos : (prevTab._tPos + 1);
				]]></>
			).replace(
				/(prevTab = aTab;)/,
				<><![CDATA[
					$1
					if (tabToSelect == aTab) {
						TreeStyleTabService.readyToOpenChildTab(tabToSelect, true, TreeStyleTabService.getNextSiblingTab(tabToSelect));
					}
				]]></>
			).replace(
				/(browser.mTabContainer.nextTab)/,
				<><![CDATA[
					TreeStyleTabService.stopToOpenChildTab(tabToSelect);
					$1]]></>
			)
		);

		window.setTimeout(function() {
			// correct broken appearance of the first tab
			var t = gBrowser.mTabContainer.firstChild;
			TreeStyleTabService.initTabAttributes(t, gBrowser);
			TreeStyleTabService.initTabContentsOrder(t, gBrowser);

			eval('gBrowser.openInverseLink = '+
				gBrowser.openInverseLink.toSource().replace(
					/(var newTab)/,
					'TreeStyleTabService.readyToOpenChildTab(aTab); $1'
				)
			);

			eval('gBrowser.TMP_openTabNext = '+
				gBrowser.TMP_openTabNext.toSource().replace(
					'{',
					'{ var tabs = TreeStyleTabService.getDescendantTabs(TreeStyleTabService.getRootTab(this.mCurrentTab));'
				).replace(
					/((this.mCurrentTab._tPos)( \+ this.mTabContainer.nextTab))/,
					'((tabs.length ? tabs[tabs.length-1]._tPos : $2 )$3)'
				)
			);

			eval('gBrowser.TMmoveTabTo = '+
				gBrowser.TMmoveTabTo.toSource().replace(
					/(aTab.dispatchEvent)/,
					'this.__treestyletab__internallyTabMoving = true; $1'
				).replace(
					/(return aTab;\})(\)?)$/,
					'this.__treestyletab__internallyTabMoving = false; $1$2'
				)
			);

			window.BrowserHome = window.TM_BrowserHome;
			window.BrowserOpenTab = window.TMP_BrowserOpenTab;

			gBrowser.__treestyletab__internallyTabMoving = false;
		}, 0);

		gBrowser.__treestyletab__internallyTabMoving = true; // until "TMmoveTabTo" method is overwritten
	}

};
