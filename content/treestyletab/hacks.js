TreeStyleTabService.overrideExtensions = function() {
	if ('MultipleTabService' in window) {
		eval('MultipleTabService.showHideMenuItems = '+
			MultipleTabService.showHideMenuItems.toSource().replace(
				/var separators = /,
				<><![CDATA[
					(function(aPopup) {
						var b;
						var item;
						var tabs;
						if (aPopup.id == 'multipletab-selection-menu') {
							b    = MultipleTabService.browser;
							item = document.getElementById(TreeStyleTabService.kMENUITEM_REMOVESUBTREE_SELECTION);
							tabs = MultipleTabService.getSelectedTabs();
						}
						else { // context
							b    = TreeStyleTabService.getTabBrowserFromChildren(aPopup);
							item = TreeStyleTabService.evaluateXPath(
									'descendant::xul:menuitem[starts-with(@id, "'+TreeStyleTabService.kMENUITEM_REMOVESUBTREE_CONTEXT+'")]',
									aPopup,
									XPathResult.FIRST_ORDERED_NODE_TYPE
								).singleNodeValue;
							tabs = [b.mContextTab];
						}

						if (item.getAttribute('hidden') == 'true') return;

						var hasSubTree = false;
						for (var i = 0, maxi = tabs.length; i < maxi; i++)
						{
							if (!tabs[i].hasAttribute(TreeStyleTabService.kCHILDREN)) continue;
							hasSubTree = true;
							break;
						}
						if (hasSubTree)
							item.removeAttribute('hidden');
						else
							item.setAttribute('hidden', true);
					})(aPopup);
					var separators = ]]></>
			)
		);
	}

	if ('autoHIDE' in window) {
		eval('autoHIDE.ShowMenu = '+
			autoHIDE.ShowMenu.toSource().replace(
				'{',
				'{ var treeStyleTabPos = TreeStyleTabService.getPref("extensions.treestyletab.tabbar.position");'
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
					var treeStyleTabPos = TreeStyleTabService.getPref("extensions.treestyletab.tabbar.position");
					if (this.Show) {
						var appcontent = document.getElementById('appcontent');
						if (appcontent.__treestyletab__resized) {
							appcontent.__treestyletab__resized = false;
							appcontent.style.marginLeft  = 0;
							appcontent.style.marginRight = 0;
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
							appcontent.style.marginLeft  = 0;
							appcontent.style.marginRight = 0;
						}
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
							this.__treestyletab__tabBarWidth = gBrowser.mStrip.boxObject.width +
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
						var treeStyleTabPos = TreeStyleTabService.getPref("extensions.treestyletab.tabbar.position");
						if (!arguments.length) {
							var appcontent = document.getElementById('appcontent');
							if (treeStyleTabPos == 'left' &&
								!appcontent.__treestyletab__resized) {
								appcontent.style.marginRight = '-'+autoHIDE.__treestyletab__tabBarWidth+'px';
								appcontent.__treestyletab__resized = true;
							}
							else if (treeStyleTabPos == 'right' &&
								!appcontent.__treestyletab__resized) {
								appcontent.style.marginLeft = '-'+autoHIDE.__treestyletab__tabBarWidth+'px';
								appcontent.__treestyletab__resized = true;
							}
							window.setTimeout('autoHIDE.MoveC(true);', 100);
							return;
						}
				]]></>
			).replace(
				'.move(0, - this.delta)',
				'.move((treeStyleTabPos == "left" ? -this.__treestyletab__tabBarWidth : 0 ), -this.delta)'
			)
		);
	}
};
