function TreeStyleTabBrowserTabbarDNDObserver(aOwner) 
{
	this.mOwner = aOwner;
	this.mAutoExpandTimer = null;
	this.mAutoExpandedTabs = [];
}

TreeStyleTabBrowserTabbarDNDObserver.prototype = {
	 
	onDragStart : function(aEvent, aTransferData, aDragAction) 
	{
		if (!this.canDragTabbar(aEvent))
			return false;

		var sv = this.mOwner;
		aTransferData.data = new TransferData();
		aTransferData.data.addDataForFlavour(
			sv.kDRAG_TYPE_TABBAR,
			aEvent.shiftKey ?
				sv.kTABBAR_MOVE_FORCE :
				sv.kTABBAR_MOVE_NORMAL
		);
		sv.mTabBrowser.setAttribute(sv.kDROP_POSITION, sv.kDROP_POSITION_UNKNOWN);

		aEvent.stopPropagation();
		return true;
	},
 
	canDragTabbar : function(aEvent) 
	{
		var sv = this.mOwner;
		var tab = sv.getTabFromEvent(aEvent);
		var tabbar = sv.getTabbarFromEvent(aEvent);
		return (
				(tab ? aEvent.shiftKey : tabbar ) &&
				(
					aEvent.shiftKey ||
					sv.mTabBrowser.getAttribute(sv.kFIXED) != 'true'
				)
			);
	},
 
	onDragEnter : function(aEvent, aDragSession) 
	{
		var sv = this.mOwner;
		var tab = aEvent.target;
		if (tab.localName != 'tab' ||
			!sv.getTreePref('autoExpand.enabled'))
			return;

		var now = (new Date()).getTime();

		window.clearTimeout(this.mAutoExpandTimer);
		if (aEvent.target == aDragSession.sourceNode) return;
		this.mAutoExpandTimer = window.setTimeout(
			function(aTarget) {
				let tab = sv.getTabById(aTarget);
				if (tab &&
					tab.getAttribute(sv.kSUBTREE_COLLAPSED) == 'true' &&
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
		now = null;
	},
 
	onDragExit : function(aEvent, aDragSession) 
	{
		var sv = this.mOwner;
		var now = (new Date()).getTime();

		window.clearTimeout(this.mAutoExpandTimer);
		this.mAutoExpandTimer = null;
	},
 
	onDragEnd : function(aEvent) 
	{
		var sv = this.mOwner;
		window.setTimeout(function() {
			sv.mTabBrowser.removeAttribute(sv.kDROP_POSITION);
		}, 10);
		aEvent.stopPropagation();
	},
 
	onDragOver : function(aEvent, aFlavour, aDragSession) 
	{
	},
 
	onDrop : function(aEvent, aXferData, aDragSession) 
	{
		var sv = this.mOwner;
		if (!this.mAutoExpandedTabs.length) return;
		if (sv.getTreePref('autoExpand.collapseFinally')) {
			this.mAutoExpandedTabs.forEach(function(aTarget) {
				this.collapseExpandSubtree(this.getTabById(aTarget), true, true);
			}, sv);
		}
		this.mAutoExpandedTabs = [];
	},
 
	canDrop : function(aEvent, aDragSession) 
	{
		var sv = this.mOwner;
		var tooltip = sv.mTabBrowser.mStrip.firstChild;
		if (tooltip &&
			tooltip.localName == 'tooltip' &&
			tooltip.popupBoxObject.popupState != 'closed')
			tooltip.hidePopup();

		var dropAction = sv.getDropAction(aEvent, aDragSession);
		if ('dataTransfer' in aEvent) {
			var dt = aEvent.dataTransfer;
			if (dropAction.action & this.kACTION_NEWTAB) {
				dt.effectAllowed = dt.dropEffect = (
					!dropAction.source ? 'link' :
					sv.isAccelKeyPressed(aEvent) ? 'copy' :
					'move'
				);
			}
		}
		return dropAction.canDrop;
	},
 
	getSupportedFlavours : function() 
	{
		var flavourSet = new FlavourSet();
		flavourSet.appendFlavour('application/x-moz-tabbrowser-tab');
		flavourSet.appendFlavour('text/x-moz-url');
		flavourSet.appendFlavour('text/unicode');
		flavourSet.appendFlavour('text/plain');
		flavourSet.appendFlavour('application/x-moz-file', 'nsIFile');
		return flavourSet;
	},
 
	destroy : function() 
	{
		delete this.mOwner;
	}
 
}; 
  
