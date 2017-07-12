/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2016-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
 
var EXPORTED_SYMBOLS = ['TreeStyleTabBookmarksService']; 

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');

Cu.import('resource:///modules/PlacesUIUtils.jsm');
Cu.import('resource://gre/modules/PlacesUtils.jsm');

Cu.import('resource://treestyletab-modules/lib/inherit.jsm');
Cu.import('resource://treestyletab-modules/constants.js');

XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');

function log(...aArgs) {
	utils.log('bookmark', ...aArgs);
}
function logWithStackTrace(...aArgs) {
	utils.logWithStackTrace('bookmark', ...aArgs);
}

var TreeStyleTabBookmarksService = inherit(TreeStyleTabConstants, {
	get BookmarksService() {
		if (!this._BookmarksService) {
			this._BookmarksService = Cc['@mozilla.org/browser/nav-bookmarks-service;1']
										.getService(Ci.nsINavBookmarksService);
		}
		return this._BookmarksService;
	},
	_BookmarksService : null,


	beginAddBookmarksFromTabs : function TSTBMService_beginAddBookmarksFromTabs(aTabs) /* PUBLIC API */ 
	{
		if (this._observing ||
			!aTabs ||
			aTabs.length <= 0)
			return;

		this._observing = true;

		var TST = aTabs[0].ownerDocument.defaultView.TreeStyleTabService;
		aTabs = TST.cleanUpTabsArray(aTabs);

		this._addingBookmarks = [];
		this._addingBookmarkTreeStructure = aTabs.map(function(aTab) {
			var parent = TST.getParentTab(aTab);
			return aTabs.indexOf(parent);
		}, this);

		this.BookmarksService.addObserver(this, false);
	},
 
	endAddBookmarksFromTabs : function TSTBMService_endAddBookmarksFromTabs() /* PUBLIC API */ 
	{
		if (!this._observing)
			return;

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
		if (tabs.length <= 0)
			return;

		var window = tabs[0].ownerDocument.defaultView;
		var TST = window.TreeStyleTabService;

		var folderName = (TST.isGroupTab(tabs[0]) || tabs.length == 1) ?
						tabs[0].label :
						null ;

		var b = TST.getTabBrowserFromChild(tabs[0]);
		var bookmarkedTabs = [];
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			if (!TST.isGroupTab(tab))
				bookmarkedTabs.push(tab);
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
	bookmarkTabSubTree : function(...aArgs) { return this.bookmarkTabSubtree(...aArgs); }, // obsolete, for backward compatibility

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
		/* this returns a result same to utils.getTreeStructureFromTabs().
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

		return utils.cleanUpTreeStructureArray(treeStructure, aDefaultParentID);
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

	handleTabsOpenProcess : function TSTBMService_handleTabsOpenProcess(aWhere, aEvent, aBrowserWindow, aIDs, aURLs, aItemsToOpen, aFolderTitle)
	{
		var result = {
				behavior      : undefined,
				treeStructure : undefined,
				treeStructureApplied : false
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

		var TST = aBrowserWindow.TreeStyleTabService;

		result.behavior = TST.openGroupBookmarkBehavior();
		if (result.behavior != this.kGROUP_BOOKMARK_CANCEL &&
			result.behavior & this.kGROUP_BOOKMARK_SUBTREE) {
			log('handleTabsOpenProcess: open as a group');
			let treeStructure = result.behavior & this.kGROUP_BOOKMARK_DONT_RESTORE_TREE_STRUCTURE ?
						null :
						this.getTreeStructureFromItems(aIDs) ;
			log('  treeStructure => ', treeStructure);
			if (treeStructure) {
				let parentTabs = treeStructure.filter(function(aParent) {
						return aParent < 0;
					});
				let haveMultipleTrees = parentTabs.length != treeStructure.length;
				if (result.behavior & this.kGROUP_BOOKMARK_USE_DUMMY) {
					log('  trying to use dummy group tab');
					let parentCount = 0;
					let childCount = 0;
					for (let i in treeStructure) {
						if (treeStructure[i] == -1)
							parentCount++;
						else
							childCount++;
					}
					log('  parentCount: '+parentCount);
					log('  childCount: '+childCount);
					if (
						parentCount > 1 &&
						(
							result.behavior & this.kGROUP_BOOKMARK_USE_DUMMY_FORCE ||
							// when there is any orphan, then all of parents and orphans should be grouped under a dummy tab.
							childCount < parentCount
						)
						) {
						aIDs.unshift(-1);
						treeStructure = this.getTreeStructureFromItems(aIDs, 0);
						let uri = utils.getGroupTabURI({
							title:     aFolderTitle,
							temporary: utils.getTreePref('openGroupBookmark.temporaryGroup')
						});
						aURLs.unshift(uri);
						aItemsToOpen.unshift({
							itemId: -1,
							title:  aFolderTitle,
							uri:    uri
						})
						log('  updated treeStructure => ', treeStructure);
					}
				}
				else if (!haveMultipleTrees) {
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

			result.treeStructure = treeStructure;

			if (utils.getTreePref('compatibility.TMP') &&
				'TMP_Places' in aBrowserWindow &&
				'openGroup' in aBrowserWindow.TMP_Places) {
				result.treeStructureApplied = false;
			}
			else {
				TST.readyToOpenNewTabGroup(null, treeStructure, result.behavior & this.kGROUP_BOOKMARK_EXPAND_ALL_TREE);
				result.treeStructureApplied = true;
			}
		}
		else {
			TST.browser.treeStyleTab.nextOpenedTabToBeParent = false;
		}
		return result;
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
	onEndUpdateBatch : function TSTBMService_onEndUpdateBatch() {}
}, Object);


PlacesUIUtils.__treestyletab__openTabset = PlacesUIUtils._openTabset;
PlacesUIUtils._openTabset = function(aItemsToOpen, aEvent, aWindow, ...aArgs) {
	log('TSTBookmarks_openTabset');

	var uris = [];
	var ids = [];
	var nodes = this.__treestyletab__openTabset_rawNodes || [];
	aItemsToOpen = aItemsToOpen.filter(function(aItem, aIndex) {
		if (aItem.uri) {
			uris.push(aItem.uri);
			let id = aItem.id;
			if (!id && aIndex in nodes)
				id = nodes[aIndex].itemId;
			ids.push(id);
			log('  '+aIndex+': '+id+' / '+aItem.uri);
			return true;
		}
		return false;
	});
	log('  items => '+aItemsToOpen.length);

	if (aItemsToOpen.length <= 0)
		return this.__treestyletab__openTabset(aItemsToOpen, aEvent, aWindow, ...aArgs);

	var w = aWindow && aWindow.document.documentElement.getAttribute('windowtype') == 'navigator:browser' ?
			aWindow :
			this._getTopBrowserWin() ;
	var TST = w.TreeStyleTabService;
	var BS = TreeStyleTabBookmarksService;

	var where = w && w.whereToOpenLink(aEvent, false, true) || 'window';
	log('  where: '+where);
	if (where === 'window')
		return this.__treestyletab__openTabset(aItemsToOpen, aEvent, aWindow, ...aArgs);

	var result = BS.handleTabsOpenProcess(where, aEvent, w, ids, uris, aItemsToOpen, this.__treestyletab__folderName);
	log('  result: ', result);

	if (result.behavior == TST.kGROUP_BOOKMARK_CANCEL)
		return;

	var tabs = TST.doAndGetNewTabs((function() {
			this.__treestyletab__openTabset(aItemsToOpen, aEvent, aWindow, ...aArgs);
		}).bind(this), w.gBrowser);
	log('  tabs: '+tabs.length);

	if (!result.treeStructure)
		tabs = [];

	if (!result.treeStructureApplied)
		TST.applyTreeStructureToTabs(
			tabs,
			result.treeStructure,
			result.behavior & BS.kGROUP_BOOKMARK_EXPAND_ALL_TREE
		);

	var loadInBackground = where == 'tabshifted';
	if (!loadInBackground) {
		// start scroll after expanding animation is finished
		w.setTimeout(function() {
			w.gBrowser.treeStyleTab.scrollToTabs(tabs);
		}, w.gBrowser.treeStyleTab.collapseDuration);
	}
};

PlacesUtils.__treestyletab__getURLsForContainerNode = PlacesUtils.getURLsForContainerNode;
PlacesUtils.getURLsForContainerNode = function(aNode, ...aArgs) {
	var uris = this.__treestyletab__getURLsForContainerNode(aNode, ...aArgs);
	var nodes = TreeStyleTabBookmarksService.getItemIdsForContainerNode(aNode);
	for (let i in nodes) {
		uris[i].id = nodes[i];
	}
	return uris;
};

PlacesUIUtils.__treestyletab__openContainerNodeInTabs = PlacesUIUtils.openContainerNodeInTabs;
PlacesUIUtils.openContainerNodeInTabs = function(aNode, ...aArgs) {
	this.__treestyletab__folderName = aNode.title;
	try {
		return this.__treestyletab__openContainerNodeInTabs(aNode, ...aArgs);
	}
	finally {
		delete this.__treestyletab__folderName;
	}
};

PlacesUIUtils.__treestyletab__openURINodesInTabs = PlacesUIUtils.openURINodesInTabs;
PlacesUIUtils.openURINodesInTabs = function(aNodes, ...aArgs) {
	try {
		this.__treestyletab__openTabset_rawNodes = aNodes;
		this.__treestyletab__folderName = utils.treeBundle.getFormattedString(
			PlacesUtils.nodeIsBookmark(aNodes[0]) ?
				'openSelectedPlaces.bookmarks' :
				'openSelectedPlaces.history',
			[aNodes[0].title, aNodes.length]
		);
		return this.__treestyletab__openURINodesInTabs(aNodes, ...aArgs);
	}
	finally {
		delete this.__treestyletab__openTabset_rawNodes;
		delete this.__treestyletab__folderName;
	}
};

PlacesUIUtils.__treestyletab__openNodeWithEvent = PlacesUIUtils.openNodeWithEvent;
PlacesUIUtils.openNodeWithEvent = function(aNode, aEvent, ...aArgs) {
	var window = aEvent.target.ownerGlobal;
	if (!window.gBrowser)
		window = PlacesUIUtils._getTopBrowserWin();
	if (window && window.gBrowser)
		window.gBrowser.treeStyleTab.readyToOpenOrphanTabNow();
	return PlacesUIUtils.__treestyletab__openNodeWithEvent(aNode, aEvent, ...aArgs);
};
