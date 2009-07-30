var TreeStyleTabBookmarksProperty = {

	instantApply : false,

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
		window.removeEventListener('load', this, false);

		eval('gEditItemOverlay._showHideRows = '+gEditItemOverlay._showHideRows.toSource().replace(
			'this._element("locationRow").collapsed',
			'TreeStyleTabBookmarksProperty.parentRow.collapsed = $&'
		));

		eval('gEditItemOverlay.initPanel = '+gEditItemOverlay.initPanel.toSource().replace(
			'if (this._itemType == Ci.nsINavBookmarksService.TYPE_BOOKMARK) {',
			'$& TreeStyleTabBookmarksProperty.initParentMenuList();'
		));

		// Bookmarks Property dialog
		if ('BookmarkPropertiesPanel' in window) {
			eval('BookmarkPropertiesPanel._endBatch = '+BookmarkPropertiesPanel._endBatch.toSource().replace(
				'PlacesUIUtils.ptm.endBatch();',
				'$& TreeStyleTabBookmarksProperty.saveParentFor(this._itemId);'
			));
		}

		// Places Organizer (Library)
		if ('PlacesOrganizer' in window) {
			this.instantApply = true;
		}
	},

	initParentMenuList : function()
	{
		var id = gEditItemOverlay.itemId;

		var popup = this.popup;
		var range = document.createRange();
		range.selectNodeContents(popup);
		range.setEndBefore(this.separator);
		range.deleteContents();

		var siblings = this._getItemsInFolder(PlacesUtils.bookmarks.getFolderIdForItem(id));
		var fragment = document.createDocumentFragment();
		siblings.forEach(function(aId) {
			let item = document.createElement('menuitem');
			item.setAttribute('label', PlacesUtils.bookmarks.getItemTitle(aId));
			item.setAttribute('value', aId);
			if (aId == id) item.setAttribute('disabled', true);
			fragment.appendChild(item);
		});
		range.insertNode(fragment);
		range.detach();

		var annotations = PlacesUtils.getAnnotationsForItem(id);
		var parent = -1;
		for (let i in annotations)
		{
			if (annotations[i].name != TreeStyleTabService.kPARENT) continue;
			parent = parseInt(annotations[i].value);
			break;
		}

		if (siblings.indexOf(parent) < 0)
			this.menulist.selectedItem = this.blankItem;
		else
			this.menulist.value = parent;
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

	saveParentFor : function(aId)
	{
		PlacesUtils.setAnnotationsForItem(aId, [{
			name    : TreeStyleTabService.kPARENT,
			value   : parseInt(this.menulist.value || -1),
			expires : PlacesUtils.annotations.EXPIRE_NEVER
		}]);
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
				this.init();
				break;
		}
	}

};

window.addEventListener('DOMContentLoaded', TreeStyleTabBookmarksProperty, false);
