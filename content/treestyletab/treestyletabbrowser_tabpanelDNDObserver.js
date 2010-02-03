function TreeStyleTabBrowserTabpanelDNDObserver(aOwner) 
{
	this.mOwner = aOwner;
}

TreeStyleTabBrowserTabpanelDNDObserver.prototype = {
	
	onDragExit : function TSTTabpanelDND_onDragExit(aEvent, aDragSession) 
	{
		if (!this.canDrop(aEvent, aDragSession)) return;
		var sv = this.mOwner;
		if (sv.mTabBrowser.hasAttribute(sv.kDROP_POSITION))
			sv.mTabBrowser.setAttribute(sv.kDROP_POSITION, sv.kDROP_POSITION_UNKNOWN);
	},
 
	onDragOver : function TSTTabpanelDND_onDragOver(aEvent, aFlavour, aDragSession) 
	{
		if (!this.canDrop(aEvent, aDragSession)) return;
		var sv = this.mOwner;
		var position = this.getDropPosition(aEvent);
		if (position != 'center' &&
			position != sv.mTabBrowser.getAttribute(sv.kTABBAR_POSITION))
			sv.mTabBrowser.setAttribute(sv.kDROP_POSITION, position);
	},
 
	onDrop : function TSTTabpanelDND_onDrop(aEvent, aXferData, aDragSession) 
	{
		var sv = this.mOwner;
		var position = this.getDropPosition(aEvent);
		if (position != 'center' &&
			position != sv.mTabBrowser.getAttribute(sv.kTABBAR_POSITION)) {
			if (sv.getTreePref('tabbar.fixed.autoCancelOnDrop') &&
				aXferData.data != sv.kTABBAR_MOVE_FORCE) {
				let orient = (position == 'left' || position == 'right') ? 'vertical' : 'horizontal' ;
				sv.setTreePref('tabbar.fixed.'+orient, false);
			}
			sv.currentTabbarPosition = position;
		}

		aEvent.stopPropagation();

		sv           = null;
		aEvent       = null;
		aXferData    = null;
		aDragSession = null;
	},
 
	getDropPosition : function TSTTabpanelDND_getDropPosition(aEvent) 
	{
		var box = this.mOwner.mTabBrowser.boxObject;
		var W = box.width;
		var H = box.height;
		var X = box.screenX;
		var Y = box.screenY;
		var x = aEvent.screenX - X;
		var y = aEvent.screenY - Y;

		if (x > (W * 0.33) &&
			x < (W * 0.66) &&
			y > (H * 0.33) &&
			y < (H * 0.66))
			return 'center';

		var isTL = x <= W - (y * W / H);
		var isBL = x <= y * W / H;
		return (isTL && isBL) ? 'left' :
				(isTL && !isBL) ? 'top' :
				(!isTL && isBL) ? 'bottom' :
				'right' ;
	},
 
	canDrop : function TSTTabpanelDND_canDrop(aEvent, aDragSession) 
	{
		return (
				aDragSession &&
				aDragSession.isDataFlavorSupported(this.mOwner.kDRAG_TYPE_TABBAR) &&
				aDragSession.sourceNode
			) ? true : false ;
	},
 
	getSupportedFlavours : function TSTTabpanelDND_getSupportedFlavours() 
	{
		var flavourSet = new FlavourSet();
		flavourSet.appendFlavour(this.mOwner.kDRAG_TYPE_TABBAR);
		return flavourSet;
	},
 
	destroy : function TSTTabpanelDND_destroy() 
	{
		delete this.mOwner;
	}
 
}; 
  
