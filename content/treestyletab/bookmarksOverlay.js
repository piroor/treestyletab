var TreeStyleTabBookmarksService = {
	__proto__ : TreeStyleTabService,

	get BookmarksService() {
		if (!this._BookmarksService) {
			this._BookmarksService = Components
					.classes['@mozilla.org/browser/nav-bookmarks-service;1']
					.getService(Components.interfaces.nsINavBookmarksService);
		}
		return this._BookmarksService;
	},
	_BookmarksService : null,


	beginAddBookmarksFromTabs : function TSTBMService_beginAddBookmarksFromTabs(aTabs) /* PUBLIC API */ 
	{
		if (this._observing) return;
		this._observing = true;

		this._addingBookmarks = [];
		this._addingBookmarkTreeStructure = this
				.cleanUpTabsArray(aTabs)
				.map(function(aTab) {
					var parent = this.getParentTab(aTab);
					return aTabs.indexOf(parent);
				}, this);

		this.BookmarksService.addObserver(this, false);
	},
 
	endAddBookmarksFromTabs : function TSTBMService_endAddBookmarksFromTabs() /* PUBLIC API */ 
	{
		if (!this._observing) return;
		this._observing = false;

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
 
	bookmarkTabSubtree : function TSTBMService_bookmarkTabSubtree(aTabOrTabs) 
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
	bookmarkTabSubTree : function() { return this.bookmarkTabSubtree.apply(this, arguments); }, // obsolete, for backward compatibility
 
	getParentItem : function TSTBMService_getParentItem(aId) 
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
 
	getTreeStructureFromItems : function TSTBMService_getTreeStructureFromItems(aIDs, aDefaultParentID) 
	{
		/* this returns a result same to getTreeStructureFromTabs().
		  [A]     => -1 (parent is not in this tree)
		    [B]   => 0 (parent is 1st item in this tree)
		    [C]   => 0 (parent is 1st item in this tree)
		      [D] => 2 (parent is 2nd in this tree)
		  [E]     => -1 (parent is not in this tree, and this creates another tree)
		    [F]   => 0 (parent is 1st item in this another tree)
		*/
		if (aDefaultParentID === void(0))
			aDefaultParentID = -1;

		/* Get array of parents. The index becomes to -1,
		   if there is NO PARENT or the parent is THE TAB ITSELF. */
		var treeStructure = aIDs.map(function(aId, aIndex) {
				let id = this.getParentItem(aId);
				let index = aIDs.indexOf(id);
				return index >= aIndex ? aDefaultParentID : index ;
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

		return this.cleanUpTreeStructureArray(treeStructure, aDefaultParentID);
	},
 
	// based on PlacesUtils.getURLsForContainerNode()
	getItemIdsForContainerNode : function TSTBMService_getItemIdsForContainerNode(aNode) 
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
			if (oldViewer)
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
			if (oldViewer)
				root.parentResult.viewer = oldViewer;
		}
		return ids;
	},

	getTabsInfo : function TSTBMService_getTabsInfo(aTabBrowser)
	{
		var tabs = this.getTabsArray(aTabBrowser);
		return tabs.map(function(aTab) {
				return aTab.getAttribute(this.kID)+'\n'+
						aTab.getAttribute('busy')+'\n'+
						aTab.linkedBrowser.currentURI.spec;
			}, this);
	},

	getNewTabsFromPreviousTabsInfo : function TSTBMService_getNewTabsFromPreviousTabsInfo(aTabBrowser, aTabsInfo)
	{
		var tabs = this.getTabsArray(aTabBrowser);
		var currentTabsInfo = this.getTabsInfo(aTabBrowser);
		return tabs.filter(function(aTab, aIndex) {
				return aTabsInfo.indexOf(currentTabsInfo[aIndex]) < 0;
			});
	},
 

	preInit : function TSTBMService_preInit()
	{
		window.addEventListener('load', this, false);
		window.addEventListener(window['piro.sakura.ne.jp'].tabsDragUtils.EVENT_TYPE_TABS_DROP, this, false);
	},

	init : function TSTBMService_init()
	{
		window.removeEventListener('load', this, false);
		window.addEventListener('unload', this, false);

		if (!('PlacesUIUtils' in window)) return;

		if (!PlacesUIUtils.__treestyletab__done) {
			var ns;
			try { // Firefox 4 or later
				ns = Components.utils.import('resource://gre/modules/PlacesUIUtils.jsm', {});
			}
			catch(e) { // Firefox 3.6 or older
				ns = window;
			}
			with (ns) {

			eval('PlacesUIUtils._openTabset = '+
				PlacesUIUtils._openTabset.toSource().replace(
					/(function[^\(]*\([^\)]+)(\))/,
					'$1, aFolderTitle$2'
				).replace(
					'{',
					'{ var TSTTreeStructure = null, TSTPreviousTabs, TSTOpenGroupBookmarkBehavior;'
				).replace(
					'var urls = [];',
					'$& var ids = [];'
				).replace(
					'urls.push(item.uri);',
					'$& ids.push(item.id);'
				).replace(
					/(browserWindow\.(?:getBrowser\(\)|gBrowser)\.loadTabs\([^;]+\);)/,
					<![CDATA[
						if (
							where.indexOf('tab') == 0 ||
							aEvent.target.id == 'placesContext_openContainer:tabs' ||
							aEvent.target.id == 'placesContext_openLinks:tabs' ||
							aEvent.target == aEvent.target.parentNode._endOptOpenAllInTabs ||
							aEvent.target.getAttribute('openInTabs') == 'true'
							) {
							let sv = browserWindow.TreeStyleTabBookmarksService;
							TSTOpenGroupBookmarkBehavior = sv.openGroupBookmarkBehavior();
							if (TSTOpenGroupBookmarkBehavior & sv.kGROUP_BOOKMARK_SUBTREE) {
								let treeStructure = TSTOpenGroupBookmarkBehavior & sv.kGROUP_BOOKMARK_DONT_RESTORE_TREE_STRUCTURE ?
											null :
											sv.getTreeStructureFromItems(ids) ;
								if (
									treeStructure &&
									TSTOpenGroupBookmarkBehavior & sv.kGROUP_BOOKMARK_USE_DUMMY
									) {
									let parentCount = 0;
									let childCount = 0;
									for (let i in treeStructure) {
										if (treeStructure[i] == -1)
											parentCount++;
										else
											childCount++;
									}
									if (
										parentCount > 1 &&
										(
											TSTOpenGroupBookmarkBehavior & sv.kGROUP_BOOKMARK_USE_DUMMY_FORCE ||
											// when there is any orphan, then all of parents and orphans should be grouped under a dummy tab.
											childCount < parentCount
										)
										) {
										ids.unshift(-1);
										treeStructure = sv.getTreeStructureFromItems(ids, 0);
										urls.unshift(sv.getGroupTabURI(aFolderTitle));
									}
								}

								if (sv.getTreePref('compatibility.TMP') &&
									'TMP_Places' in browserWindow &&
									'openGroup' in browserWindow.TMP_Places) {
									TSTTreeStructure = treeStructure;
									TSTPreviousTabs = browserWindow.TreeStyleTabBookmarksService.getTabsInfo(browserWindow.gBrowser);
								}
								else {
									sv.readyToOpenNewTabGroup(null, treeStructure, TSTOpenGroupBookmarkBehavior & sv.kGROUP_BOOKMARK_EXPAND_ALL_TREE);
								}
								replaceCurrentTab = false;
							}
							else {
								replaceCurrentTab = !!(TSTOpenGroupBookmarkBehavior & sv.kGROUP_BOOKMARK_REPLACE);
							}
						}
						$1
						]]>
				).replace(
					/(\}\)?)$/,
					<![CDATA[
						if (TSTTreeStructure && TSTPreviousTabs) {
							let tabs = browserWindow.TreeStyleTabBookmarksService.getNewTabsFromPreviousTabsInfo(browserWindow.gBrowser, TSTPreviousTabs)
							browserWindow.TreeStyleTabService.applyTreeStructureToTabs(tabs, TSTTreeStructure, TSTOpenGroupBookmarkBehavior & browserWindow.TreeStyleTabBookmarksService.kGROUP_BOOKMARK_EXPAND_ALL_TREE);
						}
					$1]]>
				)
			);

			eval('PlacesUIUtils.openContainerNodeInTabs = '+
				PlacesUIUtils.openContainerNodeInTabs.toSource().replace(
					/(this\._openTabset\([^\)]+)(\))/,
					<![CDATA[
						let (w = '_getTopBrowserWin' in this ?
									this._getTopBrowserWin() :
								'_getCurrentActiveWin' in this ?
									this._getCurrentActiveWin() :
									window) {
							let nodes = w.TreeStyleTabBookmarksService.getItemIdsForContainerNode(aNode);
							for (let i in nodes) {
								urlsToOpen[i].id = nodes[i];
							}
						}
						$1, aNode.title$2
					]]>
				)
			);

			eval('PlacesUIUtils.openURINodesInTabs = '+
				PlacesUIUtils.openURINodesInTabs.toSource().replace(
					'{',
					<![CDATA[{
						var TSTBS;
						let (w = '_getTopBrowserWin' in this ?
									this._getTopBrowserWin() :
								'_getCurrentActiveWin' in this ?
									this._getCurrentActiveWin() :
									window) {
							TSTBS = w.TreeStyleTabBookmarksService;
						}
					]]>.toString()
				).replace(
					'uri: aNodes[i].uri,',
					'id: aNodes[i].itemId, $&'
				).replace(
					/(this\._openTabset\([^\)]+)(\))/,
					<![CDATA[$1,
						TSTBS.treeBundle
							.getFormattedString(
								PlacesUtils.nodeIsBookmark(aNodes[0]) ?
									'openSelectedPlaces.bookmarks' :
									'openSelectedPlaces.history',
								[aNodes[0].title, aNodes.length]
							)
					$2]]>
				)
			);

			PlacesUIUtils.__treestyletab__done = true;

			} // end of with
		}

		if ('PlacesCommandHook' in window && 'bookmarkCurrentPages' in PlacesCommandHook) {
			// Bookmark All Tabs
			eval('PlacesCommandHook.bookmarkCurrentPages = '+
				PlacesCommandHook.bookmarkCurrentPages.toSource().replace(
					'{',
					<![CDATA[$&
						TreeStyleTabBookmarksService.beginAddBookmarksFromTabs((function() {
							var tabs = [];
							var seen = {};
							Array.forEach(getBrowser().mTabContainer.childNodes, function(aTab) {
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

	destroy : function TSTBMService_destroy()
	{
		window.removeEventListener('unload', this, false);
		window.removeEventListener(window['piro.sakura.ne.jp'].tabsDragUtils.EVENT_TYPE_TABS_DROP, this, false);
	},

	// observer for nsINavBookmarksService 
	onItemAdded : function TSTBMService_onItemAdded(aID, aFolderID, aPosition)
	{
		this._addingBookmarks.push({
			id  : aID
		});
	},
	onItemRemoved : function TSTBMService_onItemRemoved(aID, aFolderID, aPosition) {},
	onItemMoved : function TSTBMService_onItemMoved(aID, aFolderID, aPosition) {},
	onItemChanged : function TSTBMService_onItemChanged(aID, aChange, aIsAnnotation, aNewValue) {},
	onItemVisited : function TSTBMService_onItemVisited(aID, aHistoryID, aDate) {},
	onBeginUpdateBatch : function TSTBMService_onBeginUpdateBatch() {},
	onEndUpdateBatch : function TSTBMService_onEndUpdateBatch() {},


	_onTabsDrop : function TSTBMService_onTabsDrop(aEvent)
	{
		var tabs = aEvent.getData('tabs') || [];
		var groups = this.splitTabsToSubtrees(tabs);
		if (
			groups.length == 1 &&
			this.bookmarkDroppedTabsBehavior() != this.kBOOKMARK_DROPPED_TABS_ALL &&
			!Array.some(tabs, function(aTab) {
				return aTab.getAttribute('multiselected') == 'true';
			})
			) {
			aEvent.preventDefault();
			aEvent.stopPropagation();
		}
	},


	handleEvent : function TSTBMService_handleEvent(aEvent)
	{
		switch (aEvent.type)
		{
			case 'load':
				return this.init();

			case 'unload':
				return this.destroy();

			case window['piro.sakura.ne.jp'].tabsDragUtils.EVENT_TYPE_TABS_DROP:
				return this._onTabsDrop(aEvent);
		}
	}

};

TreeStyleTabBookmarksService.preInit();
