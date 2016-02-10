Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabUtils', 'resource://treestyletab-modules/utils.js');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabBookmarksService', 'resource://treestyletab-modules/bookmark.js');

(function() {
let { ReferenceCounter } = Components.utils.import('resource://treestyletab-modules/ReferenceCounter.js', {});
let { inherit } = Components.utils.import('resource://treestyletab-modules/lib/inherit.jsm', {});

function log(...aArgs) {
	TreeStyleTabUtils.log.apply(utils, ['bookmark'].concat(aArgs));
}
function logWithStackTrace(...aArgs) {
	TreeStyleTabUtils.logWithStackTrace.apply(utils, ['bookmark'].concat(aArgs));
}

var TreeStyleTabBookmarksServiceEditable = inherit(TreeStyleTabBookmarksUIService, {

	instantApply : false,
	canceled : false,

	get parentRow()
	{
		return document.getElementById('treestyletab-parent-row');
	},

	get menulist()
	{
		return document.getElementById('treestyletab-parent-menulist');
	},
	get popup()
	{
		return document.getElementById('treestyletab-parent-popup');
	},

	get separator()
	{
		return document.getElementById('treestyletab-parent-blank-item-separator');
	},
	get blankItem()
	{
		return document.getElementById('treestyletab-parent-blank-item');
	},

	get isCreatingMultipleBookmarksInFolder()
	{
		return (
			window.arguments.length &&
			window.arguments[0] &&
			window.arguments[0].type == 'folder'
		);
	},

	init : function TSTBMEditable_init()
	{
		if (this.isCreatingMultipleBookmarksInFolder)
			return;

		// main browser window
		if ('StarUI' in window) {
			StarUI.__treestyletab___doShowEditBookmarkPanel = StarUI.__treestyletab___doShowEditBookmarkPanel || StarUI._doShowEditBookmarkPanel;
			StarUI._doShowEditBookmarkPanel = function(...args) {
				TreeStyleTabBookmarksServiceEditable.initEditUI();
				return this.__treestyletab___doShowEditBookmarkPanel.apply(this, args);
			};

			StarUI.__treestyletab__quitEditMode = StarUI.__treestyletab__quitEditMode || StarUI.quitEditMode;
			StarUI.quitEditMode = function(...args) {
				TreeStyleTabBookmarksServiceEditable.saveParentFor(gEditItemOverlay.itemId);
				return this.__treestyletab__quitEditMode.apply(this, args);
			};

			StarUI.__treestyletab__cancelButtonOnCommand = StarUI.__treestyletab__cancelButtonOnCommand || StarUI.cancelButtonOnCommand;
			StarUI.cancelButtonOnCommand = function(...args) {
				TreeStyleTabBookmarksServiceEditable.canceled = true;
				return this.__treestyletab__cancelButtonOnCommand.apply(this, args);
			};
		}

		// Bookmarks Property dialog
		if ('BookmarkPropertiesPanel' in window) {
			BookmarkPropertiesPanel.__treestyletab__onDialogAccept = BookmarkPropertiesPanel.onDialogAccept;
			BookmarkPropertiesPanel.onDialogAccept = function(...aArgs) {
				try {
					TreeStyleTabBookmarksServiceEditable.saveParentFor(gEditItemOverlay.itemId, true);
				}
				catch(e) {
					log(e);
				}
				return this.__treestyletab__onDialogAccept.apply(this, aArgs);
			};

			BookmarkPropertiesPanel.__treestyletab__endBatch = BookmarkPropertiesPanel._endBatch;
			BookmarkPropertiesPanel._endBatch = function(...aArgs) {
				var id = this.__treestyletab__itemId || gEditItemOverlay.itemId;
				log('BookmarkPropertiesPanel._endBatch for '+id);
				var batching = this._batching;
				var result = this.__treestyletab__endBatch.apply(this, aArgs);
				if (id >= 0 && !batching && !this._batching) {
					this._batching = true;
					try {
						TreeStyleTabBookmarksServiceEditable.saveParentFor(id, true);
					}
					catch(e) {
						log(e);
					}
					finally {
						this._batching = false;
					}
				}
				return result;
			};
		}

		// Places Organizer (Library)
		if ('PlacesOrganizer' in window) {
			this.instantApply = true;
		}

		this.initEditUI();
	},

	initEditUI : function TSTBMEditable_initEditUI()
	{
		if (
			this.editUIInitialized ||
			!('gEditItemOverlay' in window) ||
			this.isCreatingMultipleBookmarksInFolder
			)
			return;

		var container = document.getElementById('editBookmarkPanelGrid');
		if (!container) return;

		container = container.getElementsByTagName('rows')[0];
		var range = document.createRange();
		range.selectNodeContents(container);
		range.collapse(false);
		range.insertNode(range.createContextualFragment(
			('<row align="center" id="treestyletab-parent-row">' +
			'  <label id="treestyletab-parent-label"' +
			'    control="treestyletab-parent-menulist"/>' +
			'  <menulist id="treestyletab-parent-menulist"' +
			'    flex="1"' +
			'    oncommand="TreeStyleTabBookmarksServiceEditable.onParentChange();">' +
			'    <menupopup id="treestyletab-parent-popup">' +
			'      <menuseparator id="treestyletab-parent-blank-item-separator"/>' +
			'      <menuitem id="treestyletab-parent-blank-item"' +
			'        value=""/>' +
			'    </menupopup>' +
			'  </menulist>' +
			'</row>').trim().replace(/>\s+</g, '><')));
		range.detach();
		document.getElementById('treestyletab-parent-label').setAttribute('value', TreeStyleTabUtils.treeBundle.getString('bookmarkProperty.parent.label'));
		this.blankItem.setAttribute('label', TreeStyleTabUtils.treeBundle.getString('bookmarkProperty.parent.blank.label'));

		gEditItemOverlay.__treestyletab__initPanel = gEditItemOverlay.initPanel;
		gEditItemOverlay.initPanel = function(...aArgs) {
			var result = this.__treestyletab__initPanel.apply(this, aArgs);
			TreeStyleTabBookmarksServiceEditable.parentRow.collapsed = (
				this._element('keywordRow').collapsed &&
				this._element('folderRow').collapsed
			);
			if (!TreeStyleTabBookmarksServiceEditable.parentRow.collapsed)
				TreeStyleTabBookmarksServiceEditable.initParentMenuList();
			return result;
		};

		gEditItemOverlay.__treestyletab__onItemMoved = gEditItemOverlay.onItemMoved;
		gEditItemOverlay.onItemMoved = function(aItemId, aOldParent, aOldIndex, aNewParent, aNewIndex, aItemType, ...aArgs) {
			if (aNewParent == this._getFolderIdFromMenuList())
				TreeStyleTabBookmarksServiceEditable.initParentMenuList();
			return this.__treestyletab__onItemMoved.apply(this, [aItemId, aOldParent, aOldIndex, aNewParent, aNewIndex, aItemType].concat(aArgs));
		};

		this.editUIInitialized = true;
	},
	editUIInitialized : false,

	initParentMenuList : function TSTBMEditable_initParentMenuList()
	{
		var id = gEditItemOverlay.itemId;

		this.menulist.disabled = true;
		this.menulist.setAttribute('label', '...');

		var popup = this.popup;
		var range = document.createRange();
		range.selectNodeContents(popup);
		range.setEndBefore(this.separator);
		range.deleteContents();
		range.detach();

		this.canceled = false;

		// Ignore bookmark in the "unsorted bookmarks" folder, because
		// there can be very large number of bookmarks and they won't be
		// opened as a tree.
		if (PlacesUtils.bookmarks.getFolderIdForItem(id) == PlacesUtils.unfiledBookmarksFolderId)
			return;

		this._createSiblingsFragment(id, (function(aSiblingsFragment) {
			var range = document.createRange();
			range.selectNodeContents(popup);
			range.setEndBefore(this.separator);
			range.insertNode(aSiblingsFragment);
			range.detach();

			var selected = popup.getElementsByAttribute('selected', 'true')[0];
			this.menulist.disabled = false;
			this.menulist.value = (selected || this.blankItem).getAttribute('value');
		}).bind(this))
	},
	_doProgressively : function TSTBMEditable__doProgressively(aParams)
	{
		var name = aParams.name;
		if (this._doProgressivelyTimers[name])
			window.clearTimeout(this._doProgressivelyTimers[name]);

		var interval = 100;
		var step = 10;
		var progressiveIteration = (function() {
			try {
				if (aParams.justNow) {
					while (true)
					{
						aParams.onProgress();
					}
				}
				else {
					for (let i = 0; i < step; i++)
					{
						aParams.onProgress();
					}
					this._doProgressivelyTimers[name] = window.setTimeout(progressiveIteration, interval);
				}
			}
			catch(e) {
				if (e instanceof StopIteration) {
					aParams.onComplete();
				}
				else {
					Components.utils.reportError(e);
				}
			}
			finally {
				this._doProgressivelyTimers[name] = null;
			}
		}).bind(this);

		if (aParams.justNow)
			progressiveIteration();
		else
			this._doProgressivelyTimers[name] = window.setTimeout(progressiveIteration, interval);
	},
	_doProgressivelyTimers : {},
	_createSiblingsFragment : function TSTBMEditable__createSiblingsFragment(aCurrentItem, aCallback)
	{
		var itemsIterator = this._getSiblingItemsIterator(aCurrentItem);
		var items = [];
		this._doProgressively({
			name : '_createSiblingsFragment',
			onProgress : function() {
				items.push(itemsIterator.next());
			},
			onComplete : (function() {
				this._createSiblingsFragmentInternal(aCurrentItem, items, function(aSiblingsFragment) {
					aCallback(aSiblingsFragment);
				});
			}).bind(this)
		});
	},
	_createSiblingsFragmentInternal : function TSTBMEditable_createSiblingsFragmentInternal(aCurrentItem, aItems, aCallback)
	{
		var treeStructure = TreeStyleTabBookmarksService.getTreeStructureFromItems(aItems);

		var currentIndex = aItems.indexOf(aCurrentItem);
		var selected = treeStructure[currentIndex];
		if (selected > -1) {
			let offset = treeStructure.lastIndexOf(-1, currentIndex);
			let subStructure = treeStructure.slice(offset);
			selected = aItems[selected + offset];
		}

		var fragment = document.createDocumentFragment();

		var itemsIterator = Iterator(aItems);
		this._doProgressively({
			name : '_createSiblingsFragment',
			onProgress : (function() {
				let [index, id] = itemsIterator.next();

				let label = PlacesUtils.bookmarks.getItemTitle(id);
				let menuitem = document.createElement('menuitem');
				menuitem.setAttribute('value', id);

				let parent = index;
				let nest = 0;
				let disabled = false;
				while ((parent = treeStructure[parent]) != -1)
				{
					nest++;
					if (parent == currentIndex) disabled = true;
				}
				if (nest)
					menuitem.setAttribute('style', 'padding-left:'+nest+'em');

				if (disabled || id == aCurrentItem) {
					menuitem.setAttribute('disabled', true);
					if (id == aCurrentItem)
						label = TreeStyleTabUtils.treeBundle.getFormattedString('bookmarkProperty.parent.current.label', [label]);
				}
				if (id == selected)
					menuitem.setAttribute('selected', true);

				menuitem.setAttribute('label', label);

				fragment.appendChild(menuitem);
			}).bind(this),
			onComplete : function() {
				aCallback(fragment);
			}
		});
	},
	_getItemsInFolderIterator : function TSTBMEditable_getItemsInFolderIterator(aId)
	{
		var count = 0;
		var item;
		try {
			while((item = PlacesUtils.bookmarks.getIdForItemAt(aId, count++)) != -1)
			{
				try {
					let uri = PlacesUtils.bookmarks.getBookmarkURI(item);
					if (uri.spec.indexOf('place:') != 0)
						yield item;
				}
				catch(e) {
					// this is not a normal bookmark.
				}
			}
		}
		catch(e) {
		}
	},
	_getSiblingItemsIterator : function TSTBMEditable_getSiblingItemsIterator(aId)
	{
		var folderId = -1;
		try {
			folderId = PlacesUtils.bookmarks.getFolderIdForItem(aId);
		}
		catch(e) {
		}
		return this._getItemsInFolderIterator(folderId);
	},

	saveParentFor : function TSTBMEditable_saveParentFor(aId, aJustNow)
	{
		var newParentId = parseInt(this.menulist.value || -1);
		if (this.canceled || newParentId == TreeStyleTabBookmarksService.getParentItem(aId))
			return;

		var itemsIterator = this._getSiblingItemsIterator(aId);
		var items = [];
		this._doProgressively({
			name : '_createSiblingsFragment',
			onProgress : function() {
				items.push(itemsIterator.next());
			},
			onComplete : (function() {
				this._saveParentForInternal(aId, newParentId, items);
			}).bind(this),
			justNow : aJustNow
		});
	},
	_saveParentForInternal : function TSTBMEditable_saveParentForInternal(aId, aNewParentId, aItems)
	{
		var treeStructure = TreeStyleTabBookmarksService.getTreeStructureFromItems(aItems);

		var parentIndex = aItems.indexOf(aNewParentId);
		var newIndex;
		if (TreeStyleTabUtils.getTreePref('insertNewChildAt') == this.kINSERT_FISRT) {
			newIndex = treeStructure.indexOf(parentIndex);
		}
		else {
			do {
				newIndex = parentIndex;
				parentIndex = treeStructure.lastIndexOf(parentIndex);
			}
			while (parentIndex > -1);
			newIndex++;
		}

		PlacesUtils.setAnnotationsForItem(aId, [{
			name    : this.kPARENT,
			value   : aNewParentId,
			expires : PlacesUtils.annotations.EXPIRE_NEVER
		}]);

		PlacesUtils.bookmarks.moveItem(aId, PlacesUtils.bookmarks.getFolderIdForItem(aId), newIndex);

		if (this.instantApply) this.initParentMenuList();
	},

	onParentChange : function TSTBMEditable_onParentChange()
	{
		if (!this.instantApply) return;
		this.saveParentFor(gEditItemOverlay.itemId);
	},

	handleEvent : function TSTBMEditable_handleEvent(aEvent)
	{
		switch (aEvent.type)
		{
			case 'DOMContentLoaded':
				window.removeEventListener('DOMContentLoaded', this, false);
				ReferenceCounter.remove('window,DOMContentLoaded,TreeStyleTabBookmarksServiceEditable,false');
				this.init();
				break;
		}
	}

});

window.addEventListener('DOMContentLoaded', TreeStyleTabBookmarksServiceEditable, false);
ReferenceCounter.add('window,DOMContentLoaded,TreeStyleTabBookmarksServiceEditable,false');

window.TreeStyleTabBookmarksServiceEditable = TreeStyleTabBookmarksServiceEditable;
})();
