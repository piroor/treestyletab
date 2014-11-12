Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabUtils', 'resource://treestyletab-modules/utils.js');

(function() {
let { inherit } = Components.utils.import('resource://treestyletab-modules/lib/inherit.jsm', {});
var TreeStyleTabBookmarksServiceEditable = inherit(TreeStyleTabBookmarksService, {

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
		if (this.isCreatingMultipleBookmarksInFolder) return;

		// main browser window
		if ('StarUI' in window) {
			TreeStyleTabUtils.doPatching(StarUI._doShowEditBookmarkPanel, 'StarUI._doShowEditBookmarkPanel', function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					'{',
					'{ TreeStyleTabBookmarksServiceEditable.initEditUI();'
				));
			}, 'TreeStyleTab');

			TreeStyleTabUtils.doPatching(StarUI.quitEditMode, 'StarUI.quitEditMode', function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					'{',
					'{ TreeStyleTabBookmarksServiceEditable.saveParentFor(this._itemId);'
				));
			}, 'TreeStyleTab');

			TreeStyleTabUtils.doPatching(StarUI.cancelButtonOnCommand, 'StarUI.cancelButtonOnCommand', function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					'{',
					'{ TreeStyleTabBookmarksServiceEditable.canceled = true;'
				));
			}, 'TreeStyleTab');
		}

		// Bookmarks Property dialog
		if ('BookmarkPropertiesPanel' in window) {
			TreeStyleTabUtils.doPatching(BookmarkPropertiesPanel._endBatch, 'BookmarkPropertiesPanel._endBatch', function(aName, aSource) {
				return eval(aName+' = '+aSource.replace(
					/(PlacesUtils\.transactionManager\.endBatch\([^)]*\);)/,
					'$1 TreeStyleTabBookmarksServiceEditable.saveParentFor(this._itemId, true);'
				));
			}, 'TreeStyleTab');
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


		TreeStyleTabUtils.doPatching(gEditItemOverlay._showHideRows, 'gEditItemOverlay._showHideRows', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				/(\}\)?)$/,
				'  TreeStyleTabBookmarksServiceEditable.parentRow.collapsed = this._element("keywordRow").collapsed && this._element("folderRow").collapsed;\n' +
				'$1'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(gEditItemOverlay.initPanel, 'gEditItemOverlay.initPanel', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'if (this._itemType == Ci.nsINavBookmarksService.TYPE_BOOKMARK) {',
				'$& TreeStyleTabBookmarksServiceEditable.initParentMenuList();'
			));
		}, 'TreeStyleTab');

		TreeStyleTabUtils.doPatching(gEditItemOverlay.onItemMoved, 'gEditItemOverlay.onItemMoved', function(aName, aSource) {
			return eval(aName+' = '+aSource.replace(
				'{',
				'$& if (aNewParent == this._getFolderIdFromMenuList()) TreeStyleTabBookmarksServiceEditable.initParentMenuList();'
			));
		}, 'TreeStyleTab');

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
			catch(e if e instanceof StopIteration) {
				aParams.onComplete();
			}
			catch(e) {
				Components.utils.reportError(e);
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
		var treeStructure = this.getTreeStructureFromItems(aItems);

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
		return this._getItemsInFolderIterator(PlacesUtils.bookmarks.getFolderIdForItem(aId));
	},

	saveParentFor : function TSTBMEditable_saveParentFor(aId, aJustNow)
	{
		var newParentId = parseInt(this.menulist.value || -1);
		if (this.canceled || newParentId == this.getParentItem(aId)) return;

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
		var treeStructure = this.getTreeStructureFromItems(aItems);

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
				this.init();
				break;
		}
	}

});

window.addEventListener('DOMContentLoaded', TreeStyleTabBookmarksServiceEditable, false);

window.TreeStyleTabBookmarksServiceEditable = TreeStyleTabBookmarksServiceEditable;
})();
