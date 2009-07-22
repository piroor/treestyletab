window.addEventListener('load', function() {
	window.removeEventListener('load', arguments.callee, false);

	if ('BookmarksCommand' in window) { // Firefox 2
		eval('BookmarksCommand.openGroupBookmark = '+
			BookmarksCommand.openGroupBookmark.toSource().replace(
				'var index0;',
				<![CDATA[
					var howToOpenGroupBookmark = TreeStyleTabService.howToOpenGroupBookmark();
					if (howToOpenGroupBookmark & TreeStyleTabService.kGROUP_BOOKMARK_REPLACE) {
						doReplace = true;
						browser.treeStyleTab.getTabsArray(browser).forEach(function(aTab) {
							aTab.removeAttribute(browser.treeStyleTab.kCOLLAPSED);
							browser.treeStyleTab.partTab(aTab);
						});
					}
				$&]]>
			).replace(
				'var index = index0;',
				<![CDATA[
					if (howToOpenGroupBookmark & TreeStyleTabService.kGROUP_BOOKMARK_USE_DUMMY) {
						var folderTitle = BMDS.GetTarget(resource, RDF.GetResource(gNC_NS + 'Name'), true)
											.QueryInterface(kRDFLITIID)
											.Value;
						var folderTitleURI = TreeStyleTabService.getGroupTabURI(folderTitle);
						if (doReplace || index0 < tabCount) {
							browser.treeStyleTab.partTab(browser.treeStyleTab.getTabs(browser).snapshotItem(index0));
							tabPanels[index0].loadURI(folderTitleURI);
						}
						else {
							TreeStyleTabService.readyToOpenChildTab(
								browser.addTab(folderTitleURI),
								true
							);
							tabCount++;
						}
						index0++;
					}
				$&]]>
			).replace(
				/(tabPanels\[index\])(\.loadURI\(uri\);)/,
				<![CDATA[
					$1$2
					if (!doReplace &&
						howToOpenGroupBookmark & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE &&
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
						howToOpenGroupBookmark & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE &&
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
					var howToOpenGroupBookmark = TreeStyleTabService.howToOpenGroupBookmark();
					if (
						where.indexOf('tab') == 0 ||
						aEvent.target.id == 'placesContext_openContainer:tabs' ||
						aEvent.target == aEvent.target.parentNode._endOptOpenAllInTabs ||
						aEvent.target.getAttribute('openInTabs') == 'true'
						) {
						if (howToOpenGroupBookmark & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE) {
							TreeStyleTabService.readyToOpenNewTabGroup();
							if (howToOpenGroupBookmark & TreeStyleTabService.kGROUP_BOOKMARK_USE_DUMMY)
								urls.unshift(TreeStyleTabService.getGroupTabURI(aFolderTitle));
							replaceCurrentTab = false;
						}
						else {
							replaceCurrentTab = howToOpenGroupBookmark & TreeStyleTabService.kGROUP_BOOKMARK_REPLACE ? true : false ;
						}
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
