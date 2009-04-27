window.addEventListener('load', function() {
	window.removeEventListener('load', arguments.callee, false);

	if ('BookmarksCommand' in window) { // Firefox 2
		eval('BookmarksCommand.openGroupBookmark = '+
			BookmarksCommand.openGroupBookmark.toSource().replace(
				/(tabPanels\[index\])(\.loadURI\(uri\);)/,
				<><![CDATA[
					$1$2
					if (!doReplace &&
						TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree') &&
						!browser.treeStyleTab.parentTab) {
						browser.treeStyleTab.partTab(browser.treeStyleTab.getTabs(browser).snapshotItem(index));
						TreeStyleTabService.readyToOpenChildTab($1, true);
					}
				]]></>
			).replace(
				'browser.addTab(uri);',
				<><![CDATA[
					var openedTab = $&
					if (!doReplace &&
						TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree') &&
						!browser.treeStyleTab.parentTab) {
						TreeStyleTabService.readyToOpenChildTab(openedTab, true);
					}
				]]></>
			).replace(
				'if (index == index0)',
				<><![CDATA[
					TreeStyleTabService.stopToOpenChildTab(browser);
					$&]]></>
			)
		);
	}

	// Firefox 3
	if ('PlacesUIUtils' in window || 'PlacesUtils' in window) {
		var urils = 'PlacesUIUtils' in window ? PlacesUIUtils : PlacesUtils ;
		eval('urils._openTabset = '+
			urils._openTabset.toSource().replace(
				'browserWindow.getBrowser().loadTabs(',
				<><![CDATA[
					if (
						TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree') &&
						(
							where.indexOf('tab') == 0 ||
							aEvent.target.getAttribute('openInTabs') == 'true' ||
							(
								gNavigatorBundle in window &&
								aEvent.target.getAttribute('label') == gNavigatorBundle.getString('menuOpenAllInTabs.label')
							)
						)
						)
						{
						TreeStyleTabService.readyToOpenNewTabGroup();
						replaceCurrentTab = false;
					}
					else if (!TreeStyleTabService.getPref('browser.tabs.loadFolderAndReplace')) {
						replaceCurrentTab = false;
					}
					$&]]></>
			)
		);
	}
}, false);
