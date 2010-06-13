function TreeStyleTabBrowserTabbarDNDObserver(aOwner) 
{
	this.mOwner = aOwner;
	this.mAutoExpandTimer = null;
	this.mAutoExpandedTabs = [];
}

TreeStyleTabBrowserTabbarDNDObserver.prototype = {
	
	onDragStart : function TSTTabbarDND_onDragStart(aEvent) 
	{
		if (!this.canDragTabbar(aEvent))
			return false;

		var sv = this.mOwner;
		var dt = aEvent.dataTransfer;
		dt.setData(
			sv.kDRAG_TYPE_TABBAR,
			aEvent.shiftKey ?
				sv.kTABBAR_MOVE_FORCE :
				sv.kTABBAR_MOVE_NORMAL
		);
		dt.setData(
			sv.kDRAG_TYPE_TABBAR+'-node',
			sv.getTabbarFromEvent(aEvent)
		);
		dt.effectAllowed = 'move';

		this.readyToStartDrag();

		aEvent.stopPropagation();
		return true;
	},
 
	canDragTabbar : function TSTTabbarDND_canDragTabbar(aEvent) 
	{
		var sv = this.mOwner;

		if (
			sv.evaluateXPath(
				'ancestor-or-self::*[contains(" scrollbar popup menupopup panel tooltip ", concat(" ", local-name(), " "))]',
				aEvent.originalTarget,
				XPathResult.BOOLEAN_TYPE
			).booleanValue ||
			sv.isToolbarCustomizing
			)
			return false;

		var tab = sv.getTabFromEvent(aEvent);
		var tabbar = sv.getTabbarFromEvent(aEvent);
		var canDrag = (
				(tab ? aEvent.shiftKey : tabbar ) &&
				(
					aEvent.shiftKey ||
					sv.mTabBrowser.getAttribute(sv.kFIXED) != 'true'
				)
			);

		if (canDrag && !aEvent.shiftKey) {
			let insensitiveArea = sv.getTreePref('tabbar.fixed.insensitiveArea');
			let box = tabbar.boxObject;
			switch (sv.currentTabbarPosition)
			{
				case 'right':
					if (aEvent.screenX < box.screenX + insensitiveArea)
						canDrag = false;
					break;

				case 'left':
					if (aEvent.screenX > box.screenX + box.width - insensitiveArea)
						canDrag = false;
					break;

				default:
				case 'top':
					if (aEvent.screenY > box.screenY + box.height - insensitiveArea)
						canDrag = false;
					break;

				case 'bottom':
					if (aEvent.screenY < box.screenY + insensitiveArea)
						canDrag = false;
					break;
			}
		}

		return canDrag;
	},
 
	get SSS()
	{
		if (this._SSS === void(0)) {
			if ('@mozilla.org/content/style-sheet-service;1' in Components.classes) {
				this._SSS = Components.classes['@mozilla.org/content/style-sheet-service;1'].getService(Components.interfaces.nsIStyleSheetService);
			}
			if (!this._SSS)
				this._SSS = null;
		}
		return this._SSS;
	},
 
	readyToStartDrag : function TSTTabbarDND_readyToStartDrag() 
	{
		var sheet = this.mOwner.makeURIFromSpec('chrome://treestyletab/content/hide-embed.css');
		if (!this.SSS.sheetRegistered(sheet, this.SSS.AGENT_SHEET))
			this.SSS.loadAndRegisterSheet(sheet, this.SSS.AGENT_SHEET);
	},
 
	readyToEndDrag : function TSTTabbarDND_readyToEndDrag() 
	{
		var sheet = this.mOwner.makeURIFromSpec('chrome://treestyletab/content/hide-embed.css');
		if (this.SSS.sheetRegistered(sheet, this.SSS.AGENT_SHEET))
			this.SSS.unregisterSheet(sheet, this.SSS.AGENT_SHEET);
	},
 
	onDragEnter : function TSTTabbarDND_onDragEnter(aEvent) 
	{
		var dt = aEvent.dataTransfer;
		if (!this.canDrop(aEvent)) return;

		var sv = this.mOwner;
		var tab = aEvent.target;
		if (tab.localName != 'tab' ||
			!sv.getTreePref('autoExpand.enabled'))
			return;

		window.clearTimeout(this.mAutoExpandTimer);

		var sourceNode = dt.getData(sv.kDRAG_TYPE_TABBAR+'-node');
		if (aEvent.target == sourceNode) return;

		this.mAutoExpandTimer = window.setTimeout(
			function(aTarget) {
				let tab = sv.getTabById(aTarget);
				if (tab &&
					sv.shouldTabAutoExpanded(tab) &&
					tab.getAttribute(sv.kDROP_POSITION) == 'self') {
					if (sv.getTreePref('autoExpand.intelligently')) {
						sv.collapseExpandTreesIntelligentlyFor(tab);
					}
					else {
						this.mAutoExpandedTabs.push(aTarget);
						sv.collapseExpandSubtree(tab, false);
					}
				}
			},
			sv.getTreePref('autoExpand.delay'),
			tab.getAttribute(sv.kID)
		);

		tab = null;
	},
 
	onDragLeave : function TSTTabbarDND_onDragLeave(aEvent) 
	{
		var sv = this.mOwner;
		var dt = aEvent.dataTransfer;
		if (!dt.getData(sv.kDRAG_TYPE_TABBAR)) return;

		window.clearTimeout(this.mAutoExpandTimer);
		this.mAutoExpandTimer = null;
	},
 
	onDragEnd : function TSTTabbarDND_onDragEnd(aEvent) 
	{
		var sv = this.mOwner;
		var dt = aEvent.dataTransfer;
		if (!dt.getData(sv.kDRAG_TYPE_TABBAR)) return;

		window.setTimeout(function(aSelf) {
			aSelf.readyToEndDrag();
			aSelf.mOwner.removeTabbrowserAttribute(aSelf.mOwner.kDROP_POSITION);
		}, 10, this);
		aEvent.stopPropagation();
		aEvent.preventDefault();
	},
 
	onDragOver : function TSTTabbarDND_onDragOver(aEvent) 
	{
		var sv = this.mOwner;
		var dt = aEvent.dataTransfer;
		if (!dt.getData(sv.kDRAG_TYPE_TABBAR) || !this.canDrop(aEvent))
			return;

		dt.dropEffect = 'move';
		aEvent.preventDefault();
	},
 
	onDrop : function TSTTabbarDND_onDrop(aEvent) 
	{
		if (!this.canDrop(aEvent)) return;
		var sv = this.mOwner;
		if (!this.mAutoExpandedTabs.length) return;
		if (sv.getTreePref('autoExpand.collapseFinally')) {
			this.mAutoExpandedTabs.forEach(function(aTarget) {
				this.collapseExpandSubtree(this.getTabById(aTarget), true, true);
			}, sv);
		}
		this.mAutoExpandedTabs = [];
		aEvent.preventDefault();
		aEvent.stopPropagation();
	},
 
	canDrop : function TSTTabbarDND_canDrop(aEvent) 
	{
		var sv = this.mOwner;
		var tooltip = sv.tabStrip.firstChild;
		if (tooltip &&
			tooltip.localName == 'tooltip' &&
			tooltip.popupBoxObject.popupState != 'closed')
			tooltip.hidePopup();

		var dropAction = sv.getDropAction(aEvent);
		if ('dataTransfer' in aEvent) {
			var dt = aEvent.dataTransfer;
			if (dropAction.action & this.kACTION_NEWTAB) {
				dt.effectAllowed = dt.dropEffect = (
					!dropAction.source ? 'link' :
					sv.isCopyAction(aEvent) ? 'copy' :
					'move'
				);
			}
		}
		return dropAction.canDrop;
	},
 
	destroy : function TSTTabbarDND_destroy() 
	{
		delete this.mOwner;
	}
 
}; 
  
