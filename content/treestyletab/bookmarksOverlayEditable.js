var TreeStyleTabBookmarksServiceEditable = {

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

	init : function()
	{
		// main browser window
		if ('StarUI' in window) {
			if ('_doShowEditBookmarkPanel' in StarUI) {
				eval('StarUI._doShowEditBookmarkPanel = '+StarUI._doShowEditBookmarkPanel.toSource().replace(
					'{',
					'{ TreeStyleTabBookmarksServiceEditable.initEditUI();'
				));
			}
			if ('quitEditMode' in StarUI) {
				eval('StarUI.quitEditMode = '+StarUI.quitEditMode.toSource().replace(
					'{',
					'{ TreeStyleTabBookmarksServiceEditable.saveParentFor(this._itemId);'
				));
			}
			if ('cancelButtonOnCommand' in StarUI) {
				eval('StarUI.cancelButtonOnCommand = '+StarUI.cancelButtonOnCommand.toSource().replace(
					'{',
					'{ TreeStyleTabBookmarksServiceEditable.canceled = true;'
				));
			}
		}

		// Bookmarks Property dialog
		if ('BookmarkPropertiesPanel' in window) {
			eval('BookmarkPropertiesPanel._endBatch = '+BookmarkPropertiesPanel._endBatch.toSource().replace(
				'PlacesUIUtils.ptm.endBatch();',
				'$& TreeStyleTabBookmarksServiceEditable.saveParentFor(this._itemId);'
			));
		}

		// Places Organizer (Library)
		if ('PlacesOrganizer' in window) {
			this.instantApply = true;
		}

		this.initEditUI();
	},

	initEditUI : function()
	{
		if (this.editUIInitialized || !('gEditItemOverlay' in window)) return;

		var container = document.getElementById('editBookmarkPanelGrid');
		if (!container) return;

		container = container.getElementsByTagName('rows')[0];
		var range = document.createRange();
		range.selectNodeContents(container);
		range.collapse(false);
		range.insertNode(range.createContextualFragment(<![CDATA[
			<row align="center" id="treestyletab-parent-row">
				<label id="treestyletab-parent-label"
					control="treestyletab-parent-menulist"/>
				<menulist id="treestyletab-parent-menulist"
					flex="1"
					oncommand="TreeStyleTabBookmarksServiceEditable.onParentChange();">
					<menupopup id="treestyletab-parent-popup">
						<menuseparator id="treestyletab-parent-blank-item-separator"/>
						<menuitem id="treestyletab-parent-blank-item"
							value=""/>
					</menupopup>
				</menulist>
			</row>
		]]>.toString().replace(/^\s*|\s*$/g, '').replace(/>\s+</g, '><')));
		range.detach();
		document.getElementById('treestyletab-parent-label').setAttribute('value', this.treeBundle.getString('bookmarkProperty.parent.label'));
		this.blankItem.setAttribute('label', this.treeBundle.getString('bookmarkProperty.parent.blank.label'));


		eval('gEditItemOverlay._showHideRows = '+gEditItemOverlay._showHideRows.toSource().replace(
			/(\}\)?)$/,
			<![CDATA[
				TreeStyleTabBookmarksServiceEditable.parentRow.collapsed = this._element('keywordRow').collapsed && this._element('folderRow').collapsed;
			$1]]>
		));

		eval('gEditItemOverlay.initPanel = '+gEditItemOverlay.initPanel.toSource().replace(
			'if (this._itemType == Ci.nsINavBookmarksService.TYPE_BOOKMARK) {',
			'$& TreeStyleTabBookmarksServiceEditable.initParentMenuList();'
		));

		eval('gEditItemOverlay.onItemMoved = '+gEditItemOverlay.onItemMoved.toSource().replace(
			'{',
			'$& if (aNewParent == this._getFolderIdFromMenuList()) TreeStyleTabBookmarksServiceEditable.initParentMenuList();'
		));

		this.editUIInitialized = true;
	},
	editUIInitialized : false,

	initParentMenuList : function()
	{
		var id = gEditItemOverlay.itemId;

		var popup = this.popup;
		var range = document.createRange();
		range.selectNodeContents(popup);
		range.setEndBefore(this.separator);
		range.deleteContents();
		var fragment = this._createSiblingsFragment(id);
		var siblings = Array.slice(fragment.childNodes)
						.map(function(aItem) {
							return parseInt(aItem.getAttribute('value'));
						});
		range.insertNode(fragment);
		range.detach();

		var selected = popup.getElementsByAttribute('selected', 'true')[0];
		this.menulist.value = (selected || this.blankItem).getAttribute('value');

		this.canceled = false;
	},
	_createSiblingsFragment : function(aCurrentItem)
	{
		var items = this._getSiblingItems(aCurrentItem);
		var treeStructure = this.getTreeStructureFromItems(items);

		var currentIndex = items.indexOf(aCurrentItem);
		var selected = treeStructure[currentIndex];
		if (selected > -1) selected = items[selected];

		var fragment = document.createDocumentFragment();
		items.forEach(function(aId, aIndex) {
			let label = PlacesUtils.bookmarks.getItemTitle(aId);
			let item = document.createElement('menuitem');
			item.setAttribute('value', aId);

			let parent = aIndex;
			let nest = 0;
			let disabled = false;
			while ((parent = treeStructure[parent]) != -1)
			{
				nest++;
				if (parent == currentIndex) disabled = true;
			}
			if (nest) item.setAttribute('style', 'padding-left:'+nest+'em');

			if (disabled || aId == aCurrentItem) {
				item.setAttribute('disabled', true);
				if (aId == aCurrentItem)
					label = this.treeBundle.getFormattedString('bookmarkProperty.parent.current.label', [label]);
			}
			if (aId == selected) item.setAttribute('selected', true);

			item.setAttribute('label', label);

			fragment.appendChild(item);
		});
		return fragment;
	},
	_getItemsInFolder : function(aId)
	{
		var count = 0;
		var items = [];
		var item;
		try {
			while((item = PlacesUtils.bookmarks.getIdForItemAt(aId, count++)) != -1)
			{
				try {
					let uri = PlacesUtils.bookmarks.getBookmarkURI(item);
					if (uri.spec.indexOf('place:') != 0)
						items.push(item);
				}
				catch(e) {
					// this is not a normal bookmark.
				}
			}
		}
		catch(e) {
		}
		return items;
	},
	_getSiblingItems : function(aId)
	{
		return this._getItemsInFolder(PlacesUtils.bookmarks.getFolderIdForItem(aId));
	},

	saveParentFor : function(aId)
	{
		var newParentId = parseInt(this.menulist.value || -1);
		if (this.canceled || newParentId == this.getParentItem(aId)) return;

		var items = this._getSiblingItems(aId);
		var treeStructure = this.getTreeStructureFromItems(items);

		var parentIndex = items.indexOf(newParentId);
		var newIndex;
		if (this.getTreePref('insertNewChildAt') == this.kINSERT_FISRT) {
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
			value   : newParentId,
			expires : PlacesUtils.annotations.EXPIRE_NEVER
		}]);

		PlacesUtils.bookmarks.moveItem(aId, PlacesUtils.bookmarks.getFolderIdForItem(aId), newIndex);

		if (this.instantApply) this.initParentMenuList();
	},

	onParentChange : function()
	{
		if (!this.instantApply) return;
		this.saveParentFor(gEditItemOverlay.itemId);
	},

	handleEvent : function(aEvent)
	{
		switch (aEvent.type)
		{
			case 'DOMContentLoaded':
				window.removeEventListener('DOMContentLoaded', this, false);
				this.init();
				break;
		}
	}

};
TreeStyleTabBookmarksServiceEditable.__proto__ = TreeStyleTabBookmarksService;

window.addEventListener('DOMContentLoaded', TreeStyleTabBookmarksServiceEditable, false);
