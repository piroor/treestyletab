window.addEventListener('load', function() {
	window.removeEventListener('load', arguments.callee, false);

	eval('PlacesUIUtils._openTabset = '+
		PlacesUIUtils._openTabset.toSource().replace(
			/(function[^\(]*\([^\)]+)(\))/,
			'$1, aFolderTitle$2'
		).replace(
			'browserWindow.getBrowser().loadTabs(',
			<![CDATA[
				var openGroupBookmarkBehavior = TreeStyleTabService.openGroupBookmarkBehavior();
				if (
					where.indexOf('tab') == 0 ||
					aEvent.target.id == 'placesContext_openContainer:tabs' ||
					aEvent.target == aEvent.target.parentNode._endOptOpenAllInTabs ||
					aEvent.target.getAttribute('openInTabs') == 'true'
					) {
					if (openGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_SUBTREE) {
						TreeStyleTabService.readyToOpenNewTabGroup();
						if (openGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_USE_DUMMY)
							urls.unshift(TreeStyleTabService.getGroupTabURI(aFolderTitle));
						replaceCurrentTab = false;
					}
					else {
						replaceCurrentTab = openGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_REPLACE ? true : false ;
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

}, false);
