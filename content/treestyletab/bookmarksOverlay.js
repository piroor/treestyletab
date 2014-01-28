Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabUtils', 'resource://treestyletab-modules/utils.js');

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

		aTabs = this.cleanUpTabsArray(aTabs);

		this._addingBookmarks = [];
		this._addingBookmarkTreeStructure = aTabs.map(function(aTab) {
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
		this.handleNewBookmarksFromTabs(this._addingBookmarks, this._addingBookmarkTreeStructure);
		this._addingBookmarks = [];
		this._addingBookmarkTreeStructure = [];
	},
 
	handleNewBookmarksFromTabs : function TSTBMService_handleNewBookmarksFromTabs(aBookarmks, aTreeStructure) 
	{
		// this is adding bookmark folder from tabs, so ignroe the first item!
		if (
			aBookarmks.length == aTreeStructure.length+1 &&
			this.BookmarksService.getItemType(aBookarmks[0].id) == this.BookmarksService.TYPE_FOLDER
			) {
			aBookarmks.shift();
		}
		else if (aBookarmks.length != aTreeStructure.length) {
			return;
		}

		for (let i = 0, maxi = aBookarmks.length; i < maxi; i++)
		{
			let item = aBookarmks[i];
			item.position = this.BookmarksService.getItemIndex(item.id);
		}
		aBookarmks.sort(function(aA, aB) {
			return aA.position - aB.position;
		});

		for (let i = 0, maxi = aBookarmks.length; i < maxi; i++)
		{
			let item = aBookarmks[i];
			if (this.BookmarksService.getItemType(item.id) != this.BookmarksService.TYPE_BOOKMARK)
				continue;

			let uri = this.BookmarksService.getBookmarkURI(item.id);
			if (/^about:treestyletab-group\b/.test(uri.spec)) {
				let title = this.BookmarksService.getItemTitle(item.id);
				let folderId = this.BookmarksService.createFolder(item.parent, title, item.position);
				this.BookmarksService.removeItem(item.id);
				item.id = folderId;
				item.isFolder = true;
			}

			let index = aTreeStructure[i];
			let parent = index > -1 ? aBookarmks[index] : null ;
			if (parent && (parent.folder || parent).isFolder) {
				let folder = parent.isFolder ? parent : parent.folder ;
				this.BookmarksService.moveItem(item.id, folder.id, -1);
				item.folder = folder;
			}
			if (parent && !parent.isFolder) {
				PlacesUtils.setAnnotationsForItem(item.id, [{
					name    : this.kPARENT,
					value   : parent ? parent.id : -1,
					expires : PlacesUtils.annotations.EXPIRE_NEVER
				}]);
			}
		}
	},
 
	bookmarkTabSubtree : function TSTBMService_bookmarkTabSubtree(aTabOrTabs) 
	{
		var tabs = aTabOrTabs;
		if (!Array.isArray(tabs)) {
			tabs = [aTabOrTabs];
		}

		var folderName = (this.isGroupTab(tabs[0], true) || tabs.length == 1) ?
						tabs[0].label :
						null ;

		var b = this.getTabBrowserFromChild(tabs[0]);
		var bookmarkedTabs = [];
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			if (!this.isGroupTab(tab, i == 0)) bookmarkedTabs.push(tab);
			bookmarkedTabs = bookmarkedTabs.concat(b.treeStyleTab.getDescendantTabs(tab));
		}

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
		if ('getContainerNodeWithOptions' in PlacesUtils) {
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
			var ns = Components.utils.import('resource:///modules/PlacesUIUtils.jsm', {});
			var sv = this;
			with (ns) {

			let (method = (TreeStyleTabUtils.getTreePref('compatibility.TabUtilities') && PlacesUIUtils.TU__openTabset) ?
							'TU__openTabset' :
							'_openTabset') {
				eval('PlacesUIUtils.'+method+' = '+
					PlacesUIUtils[method].toSource().replace(
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
						'if (item.uri) { $& ids.push(item.id); }'
					).replace(
						'this.markPageAsTyped(item.uri);',
						'if (item.uri) { $& }'
					).replace(
						/(browserWindow\.(?:getBrowser\(\)|gBrowser)\.loadTabs\([^;]+\);)/,
						'var TSTResult = browserWindow.TreeStyleTabBookmarksService.handleTabsOpenProcess(where, aEvent, browserWindow, ids, urls, aFolderTitle);\n' +
						'TSTTreeStructure = TSTResult.treeStructure;\n' +
						'TSTPreviousTabs = TSTResult.previousTabs;\n' +
						'TSTOpenGroupBookmarkBehavior = TSTResult.behavior;\n' +
						'if (typeof replaceCurrentTab != "undefined")\n' +
						'  replaceCurrentTab = TSTResult.replaceCurrentTab;\n' +
						'$1'
					).replace(
						/(\}\)?)$/,
						'  if (TSTTreeStructure && TSTPreviousTabs) {\n' +
						'    let tabs = browserWindow.TreeStyleTabService.getNewTabsFromPreviousTabsInfo(browserWindow.gBrowser, TSTPreviousTabs);\n' +
						'    browserWindow.TreeStyleTabService.applyTreeStructureToTabs(tabs, TSTTreeStructure, TSTOpenGroupBookmarkBehavior & browserWindow.TreeStyleTabBookmarksService.kGROUP_BOOKMARK_EXPAND_ALL_TREE);\n' +
						'  }\n' +
						'$1'
					)
				);
				if (TreeStyleTabUtils.getTreePref('compatibility.TabUtilities') && method.indexOf('TU_') > -1)
					window[method] = PlacesUIUtils[method];
			}

			let (method = (TreeStyleTabUtils.getTreePref('compatibility.TabUtilities') && PlacesUIUtils.TU_openContainerNodeInTabs) ?
							'TU_openContainerNodeInTabs' :
							'openContainerNodeInTabs') {
				eval('PlacesUIUtils.'+method+' = '+
					PlacesUIUtils[method].toSource().replace(
						/(this\._openTabset\([^\)]+)(\))/,
						'let (w = "_getTopBrowserWin" in this ?\n' +
						'      this._getTopBrowserWin() :\n' +
						'    "_getCurrentActiveWin" in this ?\n' +
						'      this._getCurrentActiveWin() :\n' +
						'      window) {\n' +
						'  let nodes = w.TreeStyleTabBookmarksService.getItemIdsForContainerNode(aNode);\n' +
						'  for (let i in nodes) {\n' +
						'    urlsToOpen[i].id = nodes[i];\n' +
						'  }\n' +
						'}\n' +
						'$1, aNode.title$2'
					)
				);
				if (TreeStyleTabUtils.getTreePref('compatibility.TabUtilities') && method.indexOf('TU_') > -1)
					window[method] = PlacesUIUtils[method];
			}

			let (method = (TreeStyleTabUtils.getTreePref('compatibility.TabUtilities') && PlacesUIUtils.TU_openURINodesInTabs) ?
							'TU_openURINodesInTabs' :
							'openURINodesInTabs') {
				eval('PlacesUIUtils.'+method+' = '+
					PlacesUIUtils[method].toSource().replace(
						'{',
						'{\n' +
						'  var TSTBS, TSTUtils;\n' +
						'  let (w = "_getTopBrowserWin" in this ?\n' +
						'        this._getTopBrowserWin() :\n' +
						'      "_getCurrentActiveWin" in this ?\n' +
						'        this._getCurrentActiveWin() :\n' +
						'        window) {\n' +
						'    TSTBS = w.TreeStyleTabBookmarksService;\n' +
						'    TSTUtils = w.TreeStyleTabUtils;\n' +
						'    PlacesUtils = w.PlacesUtils;\n' +
						'  }'
					).replace(
						'uri: aNodes[i].uri,',
						'id: aNodes[i].itemId, $&'
					).replace(
						/(this\._openTabset\([^\)]+)(\))/,
						'$1,\n' +
						'  TSTUtils.treeBundle\n' +
						'    .getFormattedString(\n' +
						'      PlacesUtils.nodeIsBookmark(aNodes[0]) ?\n' +
						'        "openSelectedPlaces.bookmarks" :\n' +
						'        "openSelectedPlaces.history",\n' +
						'      [aNodes[0].title, aNodes.length]\n' +
						'    )\n' +
						'$2'
					)
				);
				if (TreeStyleTabUtils.getTreePref('compatibility.TabUtilities') && method.indexOf('TU_') > -1)
					window[method] = PlacesUIUtils[method];
			}

			PlacesUIUtils.__treestyletab__done = true;

			} // end of with
		}

		if ('PlacesCommandHook' in window && 'bookmarkCurrentPages' in PlacesCommandHook) {
			// Bookmark All Tabs
			eval('PlacesCommandHook.bookmarkCurrentPages = '+
				PlacesCommandHook.bookmarkCurrentPages.toSource().replace(
					'{',
					'{\n' +
					'  TreeStyleTabBookmarksService.beginAddBookmarksFromTabs((function() {\n' +
					'    var tabs = [];\n' +
					'    var seen = {};\n' +
					'    var allTabs = getBrowser().mTabContainer.childNodes;\n' +
					'    for (let i = 0, maxi = allTabs.length; i < maxi; i++)\n' +
					'    {\n' +
					'      let tab = allTabs[i];\n' +
					'      let uri = tab.linkedBrowser.currentURI.spec;\n' +
					'      if (uri in seen) continue;\n' +
					'      seen[uri] = true;\n' +
					'      tabs.push(tab);\n' +
					'    }\n' +
					'    return tabs;\n' +
					'  })());\n' +
					'  try {'
				).replace(
					/(\}\)?)$/,
					'  }\n' +
					'  catch(e) {\n' +
					'  }\n' +
					'  TreeStyleTabBookmarksService.endAddBookmarksFromTabs();\n' +
					'$1'
				)
			);
		}
	},
	handleTabsOpenProcess : function TSTBMService_handleTabsOpenProcess(aWhere, aEvent, aBrowserWindow, aIDs, aURLs, aFolderTitle)
	{
		var result = {
				behavior      : undefined,
				treeStructure : undefined,
				previousTabs  : undefined
			};
		if (
			aEvent.type != 'drop' &&
			aWhere.indexOf('tab') != 0 &&
			aEvent.target.id != 'placesContext_openContainer:tabs' &&
			aEvent.target.id != 'placesContext_openLinks:tabs' &&
			aEvent.target != aEvent.target.parentNode._endOptOpenAllInTabs &&
			aEvent.target.getAttribute('openInTabs') != 'true'
			)
			return result;

		var sv = aBrowserWindow.TreeStyleTabBookmarksService;
		result.behavior = sv.openGroupBookmarkBehavior();
		if (result.behavior & sv.kGROUP_BOOKMARK_SUBTREE) {
			let treeStructure = result.behavior & sv.kGROUP_BOOKMARK_DONT_RESTORE_TREE_STRUCTURE ?
						null :
						sv.getTreeStructureFromItems(aIDs) ;
			if (treeStructure) {
				if (result.behavior & sv.kGROUP_BOOKMARK_USE_DUMMY) {
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
							result.behavior & sv.kGROUP_BOOKMARK_USE_DUMMY_FORCE ||
							// when there is any orphan, then all of parents and orphans should be grouped under a dummy tab.
							childCount < parentCount
						)
						) {
						aIDs.unshift(-1);
						treeStructure = sv.getTreeStructureFromItems(aIDs, 0);
						aURLs.unshift(sv.getGroupTabURI({
							title:     aFolderTitle,
							temporary: TreeStyleTabUtils.getTreePref('openGroupBookmark.temporaryGroup')
						}));
					}
				}
				else {
					// make the first item parent.
					treeStructure = treeStructure.map(function(aParent, aIndex) {
						if (aIndex == 0)
							return aParent;
						if (aParent < 0)
							return 0;
						return aParent;
					});
				}
			}

			if (TreeStyleTabUtils.getTreePref('compatibility.TMP') &&
				'TMP_Places' in aBrowserWindow &&
				'openGroup' in aBrowserWindow.TMP_Places) {
				result.treeStructure = treeStructure;
				result.previousTabs = aBrowserWindow.TreeStyleTabService.getTabsInfo(aBrowserWindow.gBrowser);
			}
			else {
				sv.readyToOpenNewTabGroup(null, treeStructure, result.behavior & sv.kGROUP_BOOKMARK_EXPAND_ALL_TREE);
			}
		}
		return result;
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
			id     : aID,
			parent : aFolderID
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
