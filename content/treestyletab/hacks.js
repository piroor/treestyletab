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
				'{ var treeStyleTabPos = TreeStyleTabService.getTreePref("tabbar.position");'
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
					var treeStyleTabPos = TreeStyleTabService.getTreePref("tabbar.position");
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
						var treeStyleTabPos = TreeStyleTabService.getTreePref("tabbar.position");
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
							var pos      = TreeStyleTabService.getTreePref('tabbar.position');
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
					if (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical') {
						nsDragAndDrop.startDrag(aEvent, gBrowser);
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
					if (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical') {
						nsDragAndDrop.dragOver(aEvent, gBrowser);
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
					if (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical') {
						nsDragAndDrop.drop(aEvent, gBrowser);
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
					if (gBrowser.getAttribute(TreeStyleTabService.kMODE) == 'vertical') {
						nsDragAndDrop.dragExit(aEvent, gBrowser);
						aEvent.stopPropagation();
						return;
					}
				]]></>
			)
		);

		window.setTimeout(function() {
			var t = gBrowser.mTabContainer.firstChild;
			TreeStyleTabService.initTabAttributes(t, gBrowser);
			TreeStyleTabService.initTabContentsOrder(t, gBrowser);
		}, 0);
	}

};
