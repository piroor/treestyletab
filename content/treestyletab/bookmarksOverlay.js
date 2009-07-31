window.addEventListener('load', function() {
	window.removeEventListener('load', arguments.callee, false);

	eval('PlacesUIUtils._openTabset = '+
		PlacesUIUtils._openTabset.toSource().replace(
			/(function[^\(]*\([^\)]+)(\))/,
			'$1, aFolderTitle$2'
		).replace(
			'var urls = [];',
			'$& var ids = [];'
		).replace(
			'urls.push(item.uri);',
			'$& ids.push(item.id);'
		).replace(
			/(browserWindow\.getBrowser\(\)\.loadTabs\([^;]+\);)/,
			<![CDATA[
				if (
					where.indexOf('tab') == 0 ||
					aEvent.target.id == 'placesContext_openContainer:tabs' ||
					aEvent.target.id == 'placesContext_openLinks:tabs' ||
					aEvent.target == aEvent.target.parentNode._endOptOpenAllInTabs ||
					aEvent.target.getAttribute('openInTabs') == 'true'
					) {
					let openGroupBookmarkBehavior = TreeStyleTabService.openGroupBookmarkBehavior();
					if (openGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE) {
						let treeStructure = TreeStyleTabService.getTreeStructureFromBookmarkItems(ids);
						if (
							openGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_USE_DUMMY &&
							treeStructure.filter(function(aParent, aIndex) {
								return aParent == -1 || aIndex == aParent;
							}).length > 1
							) {
							ids.unshift(-1);
							treeStructure = TreeStyleTabService.getTreeStructureFromBookmarkItems(ids);
							urls.unshift(TreeStyleTabService.getGroupTabURI(aFolderTitle));
						}
						TreeStyleTabService.readyToOpenNewTabGroup(null, treeStructure);
						replaceCurrentTab = false;
					}
					else {
						replaceCurrentTab = openGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_REPLACE ? true : false ;
					}
				}
				$1
				]]>
		)
	);

	eval('PlacesUIUtils.openContainerNodeInTabs = '+
		PlacesUIUtils.openContainerNodeInTabs.toSource().replace(
			/(this\._openTabset\([^\)]+)(\))/,
			<![CDATA[
				TreeStyleTabService.getItemIdsForContainerNode(aNode).forEach(function(aId, aIndex) {
					urlsToOpen[aIndex].id = aId;
				});
				$1, aNode.title$2
			]]>
		)
	);

	eval('PlacesUIUtils.openURINodesInTabs = '+
		PlacesUIUtils.openURINodesInTabs.toSource().replace(
			'uri: aNodes[i].uri,',
			'id: aNodes[i].itemId, $&'
		).replace(
			/(this\._openTabset\([^\)]+)(\))/,
			'$1, aNodes[0].title$2'
		)
	);

}, false);
