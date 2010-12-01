function TreeStyleTabBrowserTabpanelDNDObserver(aOwner) 
{
	this.init(aOwner);
}

TreeStyleTabBrowserTabpanelDNDObserver.prototype = {
	
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
 
	canDrop : function TSTTabpanelDND_canDrop(aEvent) 
	{
		var session = this.mOwner.getCurrentDragSession();
		return (
				session &&
				session.isDataFlavorSupported(this.mOwner.kDRAG_TYPE_TABBAR) &&
				session.sourceNode
			) ? true : false ;
	},
 
	handleEvent : function TSTTabpanelDND_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'dragleave': return this.onDragLeave(aEvent);
			case 'dragover':  return this.onDragOver(aEvent);
			case 'drop':      return this.onDrop(aEvent);
		}
	},
	
	onDragLeave : function TSTTabpanelDND_onDragLeave(aEvent) 
	{
		if (!this.canDrop(aEvent)) return;
		var sv = this.mOwner;
		if (sv.mTabBrowser.hasAttribute(sv.kDROP_POSITION))
			sv.setTabbrowserAttribute(sv.kDROP_POSITION, sv.kDROP_POSITION_UNKNOWN);
	},
 
	onDragOver : function TSTTabpanelDND_onDragOver(aEvent) 
	{
		if (!this.canDrop(aEvent)) return;
		aEvent.preventDefault();
		var sv = this.mOwner;
		sv.setTabbrowserAttribute(sv.kDROP_POSITION, this.getDropPosition(aEvent));
	},
 
	onDrop : function TSTTabpanelDND_onDrop(aEvent) 
	{
		if (!this.canDrop(aEvent)) return;
		var sv = this.mOwner;
		var dt = aEvent.dataTransfer;
		var position = this.getDropPosition(aEvent);
		if (position != 'center' &&
			position != sv.currentTabbarPosition) {
			if (sv.getTreePref('tabbar.fixed.autoCancelOnDrop') &&
				dt.getData(sv.kDRAG_TYPE_TABBAR) != sv.kTABBAR_MOVE_FORCE) {
				let orient = (position == 'left' || position == 'right') ? 'vertical' : 'horizontal' ;
				sv.setTreePref('tabbar.fixed.'+orient, false);
			}
			sv.currentTabbarPosition = position;
		}

		aEvent.preventDefault();
		aEvent.stopPropagation();
	},
  
	init : function TSTTabpanelDND_init(aOwner) 
	{
		this.mOwner = aOwner;

		var b = this.mOwner.mTabBrowser;
		b.mPanelContainer.addEventListener('dragover',  this, true);
		b.mPanelContainer.addEventListener('dragleave', this, true);
		b.mPanelContainer.addEventListener('drop',      this, true);
	},
 
	destroy : function TSTTabpanelDND_destroy() 
	{
		var b = this.mOwner.mTabBrowser;
		b.mPanelContainer.removeEventListener('dragover',  this, true);
		b.mPanelContainer.removeEventListener('dragleave', this, true);
		b.mPanelContainer.removeEventListener('drop',      this, true);

		delete this.mOwner;
	}
 
}; 
  
