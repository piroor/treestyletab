var TreeStyleTabBookmarksService = {

	get BookmarksService() {
		if (!this._BookmarksService) {
			this._BookmarksService = Components
					.classes['@mozilla.org/browser/nav-bookmarks-service;1']
					.getService(Components.interfaces.nsINavBookmarksService);
		}
		return this._BookmarksService;
	},
	_BookmarksService : null,


	beginAddBookmarksFromTabs : function(aTabs) /* PUBLIC API */ 
	{
		this._addingBookmarks = [];
		this._addingBookmarkTreeStructure = TreeStyleTabService
				.cleanUpTabsArray(aTabs)
				.map(function(aTab) {
					var parent = TreeStyleTabService.getParentTab(aTab);
					return aTabs.indexOf(parent);
				}, this);

		this.BookmarksService.addObserver(this, false);
	},
 
	endAddBookmarksFromTabs : function() /* PUBLIC API */ 
	{
		this.BookmarksService.removeObserver(this);

		// this is adding bookmark folder from tabs, so ignroe the first item!
		if (
			this._addingBookmarks.length == this._addingBookmarkTreeStructure.length+1 &&
			this.BookmarksService.getItemType(this._addingBookmarks[0].id) == this.BookmarksService.TYPE_FOLDER
			)
			this._addingBookmarks.shift();

		if (this._addingBookmarks.length == this._addingBookmarkTreeStructure.length) {
			this._addingBookmarks.forEach(function(aItem, aIndex) {
				let index = this._addingBookmarkTreeStructure[aIndex];
				PlacesUtils.setAnnotationsForItem(aItem.id, [{
					name    : TreeStyleTabService.kPARENT,
					value   : (index > -1 ? this._addingBookmarks[index].id : -1 ),
					expires : PlacesUtils.annotations.EXPIRE_NEVER
				}]);
			}, this);
		}
		this._addingBookmarks = [];
		this._addingBookmarkTreeStructure = [];
	},
 
	getParentItem : function(aId) 
	{
		if (aId < 0) return -1;
		var annotations = PlacesUtils.getAnnotationsForItem(aId);
		for (let i in annotations)
		{
			if (annotations[i].name != TreeStyleTabService.kPARENT) continue;
			return parseInt(annotations[i].value);
		}
		return -1;
	},
 
	getTreeStructureFromItems : function(aIDs) 
	{
		var treeStructure = aIDs.map(function(aId, aIndex) {
				let id = this.getParentItem(aId);
				let index = id < 0 ? -1 : aIDs.indexOf(id);
				return index < aIndex ? index : -1 ;
			}, this);

		/* Correct patterns like:
		     [TabA]
		     [TabB] - this has no parent
		       [TabC] - TabA's child
		   to:
		     [TabA]
		       [TabB]
		       [TabC]
		*/
		treeStructure = treeStructure.reverse();
		treeStructure = treeStructure.map(function(aPosition, aIndex) {
				if (aIndex > 0 &&
					aIndex < treeStructure.length-1 &&
					aPosition < 0) {
					aPosition = treeStructure[aIndex-1];
				}
				return aPosition;
			});
		treeStructure = treeStructure.reverse();

		treeStructure = treeStructure.map(function(aPosition, aIndex) {
				return (aPosition == aIndex) ? -1 : aPosition ;
			});
		return treeStructure;
	},
 
	// based on PlacesUtils.getURLsForContainerNode()
	getItemIdsForContainerNode : function(aNode) 
	{
		var ids = [];
		if (!PlacesUtils.nodeIsContainer(aNode)) return ids;

		var root = PlacesUtils.getContainerNodeWithOptions(aNode, false, true);
		var oldViewer = root.parentResult.viewer;
		var wasOpen = root.containerOpen;
		if (!wasOpen) {
			root.parentResult.viewer = null;
			root.containerOpen = true;
		}
		for (let i = 0, maxi = root.childCount; i < maxi; ++i)
		{
			let child = root.getChild(i);
			if (PlacesUtils.nodeIsURI(child)) ids.push(child.itemId || -1);
		}
		if (!wasOpen) {
			root.containerOpen = false;
			root.parentResult.viewer = oldViewer;
		}
		return ids;
	},
 

	init : function()
	{
		window.removeEventListener('load', this, false);

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
							let treeStructure = TreeStyleTabBookmarksService.getTreeStructureFromItems(ids);
							if (
								openGroupBookmarkBehavior & TreeStyleTabService.kGROUP_BOOKMARK_USE_DUMMY &&
								treeStructure.filter(function(aParent, aIndex) { return aParent == -1; }).length > 1
								) {
								ids.unshift(-1);
								treeStructure = TreeStyleTabBookmarksService.getTreeStructureFromItems(ids);
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
					TreeStyleTabBookmarksService.getItemIdsForContainerNode(aNode).forEach(function(aId, aIndex) {
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
	},

	// observer for nsINavBookmarksService 
	onItemAdded : function(aID, aFolderID, aPosition)
	{
		this._addingBookmarks.push({
			id  : aID
		});
	},
	onItemRemoved : function(aID, aFolderID, aPosition) {},
	onItemMoved : function(aID, aFolderID, aPosition) {},
	onItemChanged : function(aID, aChange, aIsAnnotation, aNewValue) {},
	onItemVisited : function(aID, aHistoryID, aDate) {},
	onBeginUpdateBatch : function() {},
	onEndUpdateBatch : function() {},

	handleEvent : function(aEvent)
	{
		switch (aEvent.type)
		{
			case 'load':
				this.init();
				break;
		}
	}

};

window.addEventListener('load', TreeStyleTabBookmarksService, false);
