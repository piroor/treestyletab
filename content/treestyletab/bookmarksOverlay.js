window.addEventListener('load', function() {
	window.removeEventListener('load', arguments.callee, false);

	if ('BookmarksCommand' in window) { // Firefox 2
		eval('BookmarksCommand.openGroupBookmark = '+
			BookmarksCommand.openGroupBookmark.toSource().replace(
				'var index = index0;',
				<![CDATA[$&
					if (TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree.underParent')) {
						containerChildren = {
							hasMoreElements : function()
							{
								return this.isFirst ? true : this._children.hasMoreElements();
							},
							getNext : function()
							{
								if (!this.isFirst)
									return this._children.getNext();

								this.isFirst = false;
								return {
									QueryInterface : function() {
										return this;
									}
								};
							},
							_children : containerChildren,
							isFirst : true
						};
					}
				]]>
			).replace(
				/(tabPanels\[index\])(\.loadURI\(uri\);)/,
				<![CDATA[
					$1$2
					if (!doReplace &&
						TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree') &&
						!browser.treeStyleTab.parentTab) {
						browser.treeStyleTab.partTab(browser.treeStyleTab.getTabs(browser).snapshotItem(index));
						TreeStyleTabService.readyToOpenChildTab($1, true);
					}
				]]>
			).replace(
				'browser.addTab(uri);',
				<![CDATA[
					var openedTab = $&
					if (!doReplace &&
						TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree') &&
						!browser.treeStyleTab.parentTab) {
						TreeStyleTabService.readyToOpenChildTab(openedTab, true);
					}
				]]>
			).replace(
				'if (index == index0)',
				<![CDATA[
					TreeStyleTabService.stopToOpenChildTab(browser);
					$&]]>
			)
		);
	}

	// Firefox 3
	if ('PlacesUIUtils' in window) {
		eval('PlacesUIUtils._openTabset = '+
			PlacesUIUtils._openTabset.toSource().replace(
				/(function[^\(]*\([^\)]+)(\))/,
				'$1, aFolderTitle$2'
			).replace(
				'browserWindow.getBrowser().loadTabs(',
				<![CDATA[
					if (
						TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree') &&
						(
							where.indexOf('tab') == 0 ||
							aEvent.target.id == 'placesContext_openContainer:tabs' ||
							aEvent.target == aEvent.target.parentNode._endOptOpenAllInTabs ||
							aEvent.target.getAttribute('openInTabs') == 'true'
						)
						) {
						TreeStyleTabService.readyToOpenNewTabGroup();
						if (TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree.underParent'))
							urls.unshift(TreeStyleTabService.getFolderTabURI(aFolderTitle));
						replaceCurrentTab = false;
					}
					else if (!TreeStyleTabService.getPref('browser.tabs.loadFolderAndReplace')) {
						replaceCurrentTab = false;
					}
					$&]]>
			)
		);
		eval('PlacesUIUtils.openContainerNodeInTabs = '+
			PlacesUIUtils.openContainerNodeInTabs.toSource().replace(
				/(this\._openTabset\([^\)]+)(\))/,
				'$1, aNode.title$2'
			)
		);
	}
}, false);
