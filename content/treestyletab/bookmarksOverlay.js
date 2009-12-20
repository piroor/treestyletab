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
		this._addingBookmarkTreeStructure = this
				.cleanUpTabsArray(aTabs)
				.map(function(aTab) {
					var parent = this.getParentTab(aTab);
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
					name    : this.kPARENT,
					value   : (index > -1 ? this._addingBookmarks[index].id : -1 ),
					expires : PlacesUtils.annotations.EXPIRE_NEVER
				}]);
			}, this);
		}
		this._addingBookmarks = [];
		this._addingBookmarkTreeStructure = [];
	},
 
	bookmarkTabSubTree : function(aTabOrTabs) 
	{
		var tabs = aTabOrTabs;
		if (!(tabs instanceof Array)) {
			tabs = [aTabOrTabs];
		}

		var folderName = (this.isGroupTab(tabs[0], true) || tabs.length == 1) ?
						tabs[0].label :
						null ;

		var b = this.getTabBrowserFromChild(tabs[0]);
		var bookmarkedTabs = [];
		tabs.forEach(function(aTab, aIndex) {
			if (!this.isGroupTab(aTab, aIndex == 0)) bookmarkedTabs.push(aTab);
			bookmarkedTabs = bookmarkedTabs.concat(b.treeStyleTab.getDescendantTabs(aTab));
		}, this);

		this.beginAddBookmarksFromTabs(bookmarkedTabs);
		try {
			window['piro.sakura.ne.jp'].bookmarkMultipleTabs.addBookmarkFor(bookmarkedTabs, folderName);
		}
		catch(e) {
		}
		this.endAddBookmarksFromTabs();
	},
 
	getParentItem : function(aId) 
	{
		if (aId < 0) return -1;
		var annotations = PlacesUtils.getAnnotationsForItem(aId);
		for (let i in annotations)
		{
			if (annotations[i].name != this.kPARENT) continue;
			return parseInt(annotations[i].value);
		}
		return -1;
	},
 
	getTreeStructureFromItems : function(aIDs, aDefaultParentID) 
	{
		/* this returns...
		  [A]     => -1 (parent is not in this tree)
		    [B]   => 0 (parent is 1st item in this tree)
		    [C]   => 0 (parent is 1st item in this tree)
		      [D] => 2 (parent is 2nd in this tree)
		  [E]     => -1 (parent is not in this tree, and this creates another tree)
		    [F]   => 0 (parent is 1st item in this another tree)
		*/
		if (aDefaultParentID === void(0))
			aDefaultParentID = -1;

		var treeStructure = aIDs.map(function(aId, aIndex) {
				let id = this.getParentItem(aId);
				let index = aIDs.indexOf(id);
				return index > aIndex ? aDefaultParentID : index ;
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

		var offset = 0;
		treeStructure = treeStructure
			.map(function(aPosition, aIndex) {
				return (aPosition == aIndex) ? -1 : aPosition ;
			})
			.map(function(aPosition, aIndex) {
				if (aPosition == -1) {
					offset = aIndex;
					return aPosition;
				}
				return aPosition - offset;
			});
		return treeStructure;
	},
 
	// based on PlacesUtils.getURLsForContainerNode()
	getItemIdsForContainerNode : function(aNode) 
	{
		var ids = [];
		if (!aNode || !PlacesUtils.nodeIsContainer(aNode)) return ids;

		var root = aNode;
		if ('getContainerNodeWithOptions' in PlacesUtils) { // Firefox 3.5 or later
			root = PlacesUtils.getContainerNodeWithOptions(root, false, true);
		}
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

		if (!('PlacesUIUtils' in window)) return;

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
						let openGroupBookmarkBehavior = TreeStyleTabBookmarksService.openGroupBookmarkBehavior();
						if (openGroupBookmarkBehavior & TreeStyleTabBookmarksService.kGROUP_BOOKMARK_SUBTREE) {
							let treeStructure = openGroupBookmarkBehavior & TreeStyleTabBookmarksService.kGROUP_BOOKMARK_DONT_RESTORE_TREE_STRUCTURE ?
										null :
										TreeStyleTabBookmarksService.getTreeStructureFromItems(ids) ;
							if (
								treeStructure &&
								openGroupBookmarkBehavior & TreeStyleTabBookmarksService.kGROUP_BOOKMARK_USE_DUMMY &&
								treeStructure.filter(function(aParent, aIndex) { return aParent == -1; }).length > 1
								) {
								ids.unshift(-1);
								treeStructure = TreeStyleTabBookmarksService.getTreeStructureFromItems(ids, 0);
								urls.unshift(TreeStyleTabBookmarksService.getGroupTabURI(aFolderTitle));
							}
							TreeStyleTabBookmarksService.readyToOpenNewTabGroup(null, treeStructure);
							replaceCurrentTab = false;
						}
						else {
							replaceCurrentTab = openGroupBookmarkBehavior & TreeStyleTabBookmarksService.kGROUP_BOOKMARK_REPLACE ? true : false ;
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
				<![CDATA[$1,
					TreeStyleTabBookmarksService.treeBundle
						.getFormattedString(
							PlacesUtils.nodeIsBookmark(aNodes[0]) ?
								'openSelectedPlaces.bookmarks' :
								'openSelectedPlaces.history',
							[aNodes[0].title, aNodes.length]
						)
				$2]]>
			)
		);

		if ('PlacesCommandHook' in window && 'bookmarkCurrentPages' in PlacesCommandHook) {
			// Bookmark All Tabs
			eval('PlacesCommandHook.bookmarkCurrentPages = '+
				PlacesCommandHook.bookmarkCurrentPages.toSource().replace(
					'{',
					<![CDATA[$&
						TreeStyleTabBookmarksService.beginAddBookmarksFromTabs((function() {
							var tabs = [];
							var seen = {};
							Array.slice(getBrowser().mTabContainer.childNodes).forEach(function(aTab) {
								let uri = aTab.linkedBrowser.currentURI.spec;
								if (uri in seen) return;
								seen[uri] = true;
								tabs.push(aTab);
							});
							return tabs;
						})());
						try {
					]]>
				).replace(
					/(\}\)?)$/,
					<![CDATA[
						}
						catch(e) {
						}
						TreeStyleTabBookmarksService.endAddBookmarksFromTabs();
					$1]]>
				)
			);
		}
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
TreeStyleTabBookmarksService.__proto__ = TreeStyleTabService;

window.addEventListener('load', TreeStyleTabBookmarksService, false);
