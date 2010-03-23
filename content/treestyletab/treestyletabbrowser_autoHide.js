function TreeStyleTabBrowserAutoHide(aOwner) 
{
	this.mOwner = aOwner;
	this.init();
}
TreeStyleTabBrowserAutoHide.prototype = {
	
	kMODE_DISABLED : 0, 
	kMODE_HIDE     : 1,
	kMODE_SHRINK   : 2,

	kAUTOHIDE : 'treestyletab-tabbar-autohide',

	kSTATE : 'treestyletab-tabbar-autohide-state',
	kSTATE_HIDDEN   : 'hidden',
	kSTATE_EXPANDED : 'expanded',
	kSTATE_SHRUNKEN : 'shrunken',

	kSHOWN_BY_UNKNOWN   : 0,
	kSHOWN_BY_SHORTCUT  : 1 << 0,
	kSHOWN_BY_MOUSEMOVE : 1 << 1,
	kSHOWN_BY_FEEDBACK  : 1 << 2,
	kKEEP_SHOWN_ON_MOUSEOVER : (1 << 0) | (1 << 1) | (1 << 2),

	kTRANSPARENT       : 'treestyletab-tabbar-transparent',
	kTRANSPARENT_NONE  : 0,
	kTRANSPARENT_PART  : 1,
	kTRANSPARENT_FULL  : 2,
	kTRANSPARENT_STYLE : ['none', 'part', 'full'],
 
	get mode() /* PUBLIC API */ 
	{
		return TreeStyleTabBrowserAutoHide.mode;
	},
	set mode(aValue)
	{
		TreeStyleTabBrowserAutoHide.mode = aValue;
		return aValue;
	},

	get state()
	{
		return this.mOwner.mTabBrowser.getAttribute(this.kSTATE) || this.kSTATE_EXPANDED;
	},
	get expanded()
	{
		return this.state == this.kSTATE_EXPANDED;
	},
	get shrunken()
	{
		return this.state == this.kSTATE_SHRUNKEN;
	},
	get hidden()
	{
		return this.state == this.kSTATE_HIDDEN;
	},
	
	updateMode : function TSTAutoHide_updateMode() 
	{
		this.end();
		// update internal property after the appearance of the tab bar is updated.
		window.setTimeout(function(aSelf) {
			aSelf.mode = aSelf.getTreePref('tabbar.autoHide.mode');
			if (aSelf.mode != aSelf.kMODE_DISABLED)
				aSelf.start();
		}, 0, this);
	},
  
	togglerSize : 0, 
	sensitiveArea : 7,
 
	get XOffset() 
	{
		var sv = this.mOwner;
		switch (this.mode)
		{
			case this.kMODE_HIDE:
				let offset = this.width + this.splitterWidth;
				if (sv.mTabBrowser.getAttribute(sv.kTABBAR_POSITION) == 'left' &&
					this.mode == this.kMODE_HIDE) {
					offset -= this.togglerSize;
				}
				return offset;
				break;

			default:
			case this.kMODE_SHRINK:
				return this.getTreePref('tabbar.width')
					- this.getTreePref('tabbar.shrunkenWidth');
				break;
		}
	},
	get YOffset()
	{
		return this.height;
	},
 
	start : function TSTAutoHide_start() 
	{
		if (this.enabled) return;
		this.enabled = true;

		var sv = this.mOwner;

		sv.mTabBrowser.addEventListener('mousedown', this, true);
		sv.mTabBrowser.addEventListener('mouseup', this, true);
		window.addEventListener('resize', this, true);
		sv.mTabBrowser.addEventListener('load', this, true);
		sv.mTabBrowser.mPanelContainer.addEventListener('scroll', this, true);
		if (this.shouldListenMouseMove)
			this.startListenMouseMove();
		if (sv.mTabBrowser == gBrowser && sv.shouldListenKeyEventsForAutoHide)
			TreeStyleTabService.startListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);

		this.clearBG();
		this.updateTransparency();

		this.showHideInternal();
	},
 
	end : function TSTAutoHide_end() 
	{
		if (!this.enabled) return;
		this.enabled = false;

		var sv = this.mOwner;

		if (!this.expanded)
			this.showHideInternal();

		sv.mTabBrowser.removeEventListener('mousedown', this, true);
		sv.mTabBrowser.removeEventListener('mouseup', this, true);
		window.removeEventListener('resize', this, true);
		sv.mTabBrowser.removeEventListener('load', this, true);
		sv.mTabBrowser.mPanelContainer.removeEventListener('scroll', this, true);
		this.endListenMouseMove();
		if (sv.mTabBrowser == gBrowser)
			TreeStyleTabService.endListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);

		this.clearBG();
		this.updateTransparency();

		sv.container.style.margin = 0;
		sv.mTabBrowser.removeAttribute(this.kAUTOHIDE);
		sv.mTabBrowser.removeAttribute(this.kSTATE);
		sv.mTabBrowser.removeAttribute(this.kTRANSPARENT);
	},
 
	// fullscreen 
	
	startForFullScreen : function TSTAutoHide_startForFullScreen() 
	{
		this.mode = this.getTreePref('tabbar.autoHide.mode');
		this.end();
		this.mode = this.getPref('browser.fullscreen.autohide') ?
				this.getTreePref('tabbar.autoHide.mode.fullscreen') :
				this.kMODE_DISABLED ;
		if (this.mode != this.kMODE_DISABLED) {
			this.start();
			var sv = this.mOwner;
			sv.tabStrip.removeAttribute('moz-collapsed');
			sv.mTabBrowser.mTabContainer.removeAttribute('moz-collapsed'); // 念のため
		}
	},
 
	endForFullScreen : function TSTAutoHide_endForFullScreen() 
	{
		this.mode = this.getTreePref('tabbar.autoHide.mode.fullscreen');
		this.end();
		this.mode = this.getTreePref('tabbar.autoHide.mode');
		this.mOwner.checkTabsIndentOverflow();
		if (this.mode != this.kMODE_DISABLED)
			this.start();
	},
  
	// mousemove 
	
	startListenMouseMove : function TSTAutoHide_startListenMouseMove() 
	{
		if (this.mouseMoveListening) return;
		this.mOwner.mTabBrowser.addEventListener('mousemove', this, true);
		this.mouseMoveListening = true;
	},
 
	endListenMouseMove : function TSTAutoHide_endListenMouseMove() 
	{
		if (!this.mouseMoveListening) return;
		this.mOwner.mTabBrowser.removeEventListener('mousemove', this, true);
		this.mouseMoveListening = false;
	},
 
	get shouldListenMouseMove() 
	{
		return this.getTreePref('tabbar.autoShow.mousemove') ||
				this.getTreePref('tabbar.autoShow.accelKeyDown') ||
				this.getTreePref('tabbar.autoShow.tabSwitch') ||
				this.getTreePref('tabbar.autoShow.feedback');
	},
 
	showHideOnMousemove : function TSTAutoHide_showHideOnMousemove(aEvent) 
	{
		if ('gestureInProgress' in window && window.gestureInProgress) return;

		this.cancelShowHideOnMousemove();

		var sv  = this.mOwner;
		var b   = sv.mTabBrowser;
		var pos = b.getAttribute(sv.kTABBAR_POSITION);
		var box = b.mCurrentBrowser.boxObject;

		var sensitiveArea = this.sensitiveArea;
		/* For resizing of shrunken tab bar and clicking closeboxes,
		   we have to shrink sensitive area a little. */
		if (this.shrunken) {
			sensitiveArea = 0;
			if (pos != 'right' || b.getAttribute(this.kTAB_INVERTED) == 'true')
				sensitiveArea -= 20;
		}

		var shouldKeepShown = (
				pos == 'left' ?
					(aEvent.screenX <= box.screenX + sensitiveArea) :
				pos == 'right' ?
					(aEvent.screenX >= box.screenX + box.width - sensitiveArea) :
				pos == 'bottom' ?
					(aEvent.screenY >= box.screenY + box.height - sensitiveArea) :
					(aEvent.screenY <= box.screenY + sensitiveArea)
			);
		if (this.expanded) {
			if (
				shouldKeepShown &&
				this.showHideReason & this.kKEEP_SHOWN_ON_MOUSEOVER &&
				this.getTreePref('tabbar.autoShow.keepShownOnMouseover')
				) {
				this.showHideReason = this.kSHOWN_BY_MOUSEMOVE;
				this.cancelDelayedShowForShortcut();
				this.cancelHideForFeedback();
			}
			else if (
				!shouldKeepShown &&
				this.getTreePref('tabbar.autoShow.mousemove')
				) {
				this.showHideOnMousemoveTimer = window.setTimeout(
					function(aSelf) {
						aSelf.cancelDelayedShowForShortcut();
						if (aSelf.showHideReason == aSelf.kSHOWN_BY_MOUSEMOVE)
							aSelf.hide(aSelf.kSHOWN_BY_MOUSEMOVE);
					},
					this.getTreePref('tabbar.autoHide.delay'),
					this
				);
			}
		}
		else if (
				pos == 'left' ?
					(aEvent.screenX <= box.screenX + sensitiveArea) :
				pos == 'right' ?
					(aEvent.screenX >= box.screenX + box.width - sensitiveArea) :
				pos == 'bottom' ?
					(aEvent.screenY >= box.screenY + box.height - sensitiveArea) :
					(aEvent.screenY <= box.screenY + sensitiveArea)
			) {
			this.showHideOnMousemoveTimer = window.setTimeout(
				function(aSelf) {
					aSelf.cancelDelayedShowForShortcut();
					aSelf.cancelHideForFeedback();
					aSelf.show(aSelf.kSHOWN_BY_MOUSEMOVE);
				},
				this.getTreePref('tabbar.autoHide.delay'),
				this
			);
		}

		b = null;
		pos = null
		box = null;
		sensitiveArea = null;
		shouldKeepShown = null;
	},
 
	cancelShowHideOnMousemove : function TSTAutoHide_cancelShowHideOnMousemove() 
	{
		if (this.showHideOnMousemoveTimer) {
			window.clearTimeout(this.showHideOnMousemoveTimer);
			this.showHideOnMousemoveTimer = null;
		}
	},
  
	// feedback 
	
	showForFeedback : function TSTAutoHide_showForFeedback() 
	{
		if (!this.enabled ||
			!this.getTreePref('tabbar.autoShow.feedback'))
			return;

		if (this.delayedShowForFeedbackTimer) {
			window.clearTimeout(this.delayedShowForFeedbackTimer);
			this.delayedShowForFeedbackTimer = null;
		}
		this.cancelHideForFeedback();
		this.delayedShowForFeedbackTimer = window.setTimeout(
			function(aSelf) {
				aSelf.delayedShowForFeedbackTimer = null;
				aSelf.delayedShowForFeedback();
			},
			100,
			this
		);
	},
 
	delayedShowForFeedback : function TSTAutoHide_delayedShowForFeedback() 
	{
		this.show(this.kSHOWN_BY_FEEDBACK);
		this.cancelHideForFeedback();
		this.delayedHideTabbarForFeedbackTimer = window.setTimeout(
			function(aSelf) {
				aSelf.delayedHideTabbarForFeedbackTimer = null;
				if (aSelf.showHideReason == aSelf.kSHOWN_BY_FEEDBACK)
					aSelf.hide();
			},
			this.getTreePref('tabbar.autoShow.feedback.delay'),
			this
		);
	},
 
	cancelHideForFeedback : function TSTAutoHide_cancelHideForFeedback() 
	{
		if (this.delayedHideTabbarForFeedbackTimer) {
			window.clearTimeout(this.delayedHideTabbarForFeedbackTimer);
			this.delayedHideTabbarForFeedbackTimer = null;
		}
	},
  
	setWidth : function TSTAutoHide_setWidth(aWidth, aForceExpanded) 
	{
		if (aForceExpanded ||
			this.expanded ||
			this.mode !=  this.kMODE_SHRINK)
			this.setTreePref('tabbar.width', aWidth);
		else
			this.setTreePref('tabbar.shrunkenWidth', aWidth);
	},
 
	updateMenuItem : function TSTAutoHide_updateMenuItem(aNode) 
	{
		if (this.mode != this.kMODE_DISABLED)
			aNode.setAttribute('checked', true);
		else
			aNode.removeAttribute('checked');
	},
 
	// show/hide tabbar 
	
	get width() 
	{
		if (this.expanded) {
			this._width = this.mOwner.tabStrip.boxObject.width;
		}
		return this._width;
	},
	set width(aNewWidth)
	{
		this._width = aNewWidth;
		return this._width;
	},
	_width : 0,
	
	get widthFromMode() 
	{
		return (this.shrunken) ?
					this.getTreePref('tabbar.shrunkenWidth') :
					this.getTreePref('tabbar.width') ;
	},
  
	get height() 
	{
		if (this.expanded) {
			this._height = this.mOwner.tabStrip.boxObject.height;
		}
		return this._height;
	},
	set height(aNewHeight)
	{
		this._height = aNewHeight;
		return this._height;
	},
	_height : 0,
 
	get splitterWidth() 
	{
		if (this.expanded) {
			var splitter = document.getAnonymousElementByAttribute(this.mOwner.mTabBrowser, 'class', this.kSPLITTER);
			this._splitterWidth = (splitter ? splitter.boxObject.width : 0 );
		}
		return this._splitterWidth;
	},
	set splitterWidth(aNewWidth)
	{
		this._splitterWidth = aNewWidth;
		return this._splitterWidth;
	},
	_splitterWidth : 0,
 
	showHideInternal : function TSTAutoHide_showHideInternal(aReason) 
	{
		this.stopRendering();

		var sv  = this.mOwner;
		var b   = sv.mTabBrowser;
		var pos = b.getAttribute(sv.kTABBAR_POSITION);

		if (this.expanded) { // to be hidden or shrunken
			this.onHiding();
			this.showHideReason = aReason || this.kSHOWN_BY_UNKNOWN;
		}
		else { // to be shown or expanded
			this.onShowing();
			this.showHideReason = aReason || this.kSHOWN_BY_UNKNOWN;
		}

		this.fireStateChangingEvent();

		window.setTimeout(function(aSelf) {
			if (aSelf.expanded) {
				sv.mTabBrowser.setAttribute(aSelf.kAUTOHIDE, 'show');
				aSelf.redrawContentArea();
			}
			b.mTabContainer.adjustTabstrip();
			sv.checkTabsIndentOverflow();
			aSelf.redrawContentArea();

			aSelf.fireStateChangeEvent();

			aSelf.startRendering();
		}, 0, this);
	},
	
	show : function TSTAutoHide_show(aReason) /* PUBLIC API */ 
	{
		if (!this.expanded)
			this.showHideInternal(aReason);
	},
 
	hide : function TSTAutoHide_hide(aReason) /* PUBLIC API */ 
	{
		if (this.expanded)
			this.showHideInternal(aReason);
	},
 
	onShowing : function TSTAutoHide_onShowing() 
	{
		var sv  = this.mOwner;
		var b   = sv.mTabBrowser;
		var pos = b.getAttribute(sv.kTABBAR_POSITION);

		switch (pos)
		{
			case 'left':
				sv.container.style.marginRight = '-'+this.XOffset+'px';
				break;
			case 'right':
				sv.container.style.marginLeft = '-'+this.XOffset+'px';
				break;
			case 'bottom':
				sv.container.style.marginTop = '-'+this.YOffset+'px';
				break;
			default:
				sv.container.style.marginBottom = '-'+this.YOffset+'px';
				break;
		}

		b.setAttribute(this.kSTATE, this.kSTATE_EXPANDED);

		switch (this.mode)
		{
			case this.kMODE_HIDE:
				break;

			default:
			case this.kMODE_SHRINK:
				if (pos == 'left' || pos == 'right')
					sv.tabStrip.width = this.getTreePref('tabbar.width');
				break;
		}
	},
 
	onHiding : function TSTAutoHide_onHiding() 
	{
		var sv  = this.mOwner;
		var b   = sv.mTabBrowser;
		var pos = b.getAttribute(sv.kTABBAR_POSITION);

		this.tabbarHeight = sv.tabStrip.boxObject.height;
		this.width = sv.tabStrip.boxObject.width;
		var splitter = document.getAnonymousElementByAttribute(b, 'class', sv.kSPLITTER);
		this.splitterWidth = (splitter ? splitter.boxObject.width : 0 );
		sv.container.style.margin = 0;
		switch (this.mode)
		{
			case this.kMODE_HIDE:
				b.setAttribute(this.kAUTOHIDE, 'hidden');
				b.setAttribute(this.kSTATE, this.kSTATE_HIDDEN);
				break;

			default:
			case this.kMODE_SHRINK:
				b.setAttribute(this.kAUTOHIDE, 'show');
				b.setAttribute(this.kSTATE, this.kSTATE_SHRUNKEN);
				if (pos == 'left' || pos == 'right')
					sv.tabStrip.width = this.getTreePref('tabbar.shrunkenWidth');
				break;
		}
	},
 
	fireStateChangingEvent : function TSTAutoHide_fireStateChangingEvent() 
	{
		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabAutoHideStateChanging', true, false);
		event.shown = this.expanded;
		event.state = this.state;
		this.mOwner.mTabBrowser.dispatchEvent(event);
	},
 
	fireStateChangeEvent : function TSTAutoHide_fireStateChangeEvent() 
	{
		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabAutoHideStateChange', true, false);
		event.shown = this.expanded;
		event.state = this.state;
		event.xOffset = this.XOffset;
		event.yOffset = this.YOffset;
		this.mOwner.mTabBrowser.dispatchEvent(event);
	},
  
	redrawContentArea : function TSTAutoHide_redrawContentArea() 
	{
		var sv  = this.mOwner;
		var pos = sv.mTabBrowser.getAttribute(sv.kTABBAR_POSITION);
		try {
			var v = sv.mTabBrowser.markupDocumentViewer;
			if (this.shouldRedraw) {
				if (sv.mTabBrowser.hasAttribute(this.kTRANSPARENT) &&
					sv.mTabBrowser.getAttribute(this.kTRANSPARENT) != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_NONE])
					this.drawBG();
				else
					this.clearBG();

				v.move(window.outerWidth,window.outerHeight);
				v.move(
					(
						pos == 'left' ? -this.XOffset :
						pos == 'right' ? this.XOffset :
						0
					),
					(
						pos == 'top' ? -this.YOffset :
						pos == 'bottom' ? this.YOffset :
						0
					)
				);
			}
			else {
				this.clearBG();
				v.move(window.outerWidth,window.outerHeight);
				v.move(0,0);
			}
		}
		catch(e) {
		}
	},
 
	get shouldRedraw() 
	{
		return this.enabled && this.expanded;
	},
 
	drawBG : function TSTAutoHide_drawBG() 
	{
		var sv = this.mOwner;

		if (!this.tabbarCanvas || this.isResizing) return;

		this.tabbarCanvas.style.width = (this.tabbarCanvas.width = 1)+'px';
		this.tabbarCanvas.style.height = (this.tabbarCanvas.height = 1)+'px';

		var pos = sv.mTabBrowser.getAttribute(sv.kTABBAR_POSITION);

		var frame = sv.mTabBrowser.contentWindow;
		var tabContainerBox = sv.mTabBrowser.mTabContainer.boxObject;
		var browserBox = sv.mTabBrowser.mCurrentBrowser.boxObject;
		var contentBox = sv.getBoxObjectFor(frame.document.documentElement);

		var zoom = this.getZoomForFrame(frame);

		var x = (pos == 'right') ? browserBox.width - this.XOffset : 0 ;
		var y = (pos == 'bottom') ? browserBox.height - this.YOffset : 0 ;
		if (pos == 'left' && this.mode == this.kMODE_HIDE)
			x -= this.togglerSize;
		var xOffset = (zoom == 1 && (pos == 'top' || pos == 'bottom')) ?
				contentBox.screenX + frame.scrollX - browserBox.screenX :
				0 ;
		var yOffset = (zoom == 1 && (pos == 'left' || pos == 'right')) ?
				contentBox.screenY + frame.scrollY - browserBox.screenY :
				0 ;
		var w = tabContainerBox.width - xOffset;
		var h = tabContainerBox.height - yOffset;

		var canvasXOffset = 0;
		var canvasYOffset = 0;
		if (pos == 'top' || pos == 'bottom')
			canvasXOffset = tabContainerBox.screenX - sv.mTabBrowser.boxObject.screenX;
		else
			canvasYOffset = tabContainerBox.screenY - sv.mTabBrowser.boxObject.screenY;

		for (let node = this.tabbarCanvas;
		     node != sv.tabStrip.parentNode;
		     node = node.parentNode)
		{
			let style = window.getComputedStyle(node, null);
			'border-left-width,border-right-width,margin-left,margin-right,padding-left,padding-right'
				.split(',').forEach(function(aProperty) {
					let value = sv.getPropertyPixelValue(style, aProperty);
					w -= value;
					if (aProperty.indexOf('left') < -1) x += value;
				}, this);
			'border-top-width,border-bottom-width,margin-top,margin-bottom,padding-left,padding-right'
				.split(',').forEach(function(aProperty) {
					let value = sv.getPropertyPixelValue(style, aProperty);
					h -= value;
					if (aProperty.indexOf('top') < -1) y += value;
				}, this);
		}

		// zero width (heigh) canvas becomes wrongly size!!
		w = Math.max(1, w);
		h = Math.max(1, h);

		this.tabbarCanvas.style.display = 'inline';
		this.tabbarCanvas.style.margin = (yOffset)+'px 0 0 '+(xOffset)+'px';
		this.tabbarCanvas.style.width = (this.tabbarCanvas.width = w)+'px';
		this.tabbarCanvas.style.height = (this.tabbarCanvas.height = h)+'px';
		var ctx = this.tabbarCanvas.getContext('2d');
		ctx.clearRect(0, 0, w, h);
		ctx.save();
		if (this.mode == this.kMODE_SHRINK) {
			var offset = this.getTreePref('tabbar.shrunkenWidth') + this.splitterWidth;
			if (pos == 'left')
				ctx.translate(offset, 0);
			else
				x += this.splitterWidth;
			w -= offset;
		}
		ctx.globalAlpha = 1;
		if (pos == 'left' || pos == 'right') {
			ctx.fillStyle = this.splitterBorderColor;
			ctx.fillRect((pos == 'left' ? -1 : w+1 ), 0, 1, h);
		}
		ctx.save();
		ctx.scale(zoom, zoom);
		ctx.drawWindow(
			frame,
			(x / zoom)+frame.scrollX+canvasXOffset,
			(y / zoom)+frame.scrollY+canvasYOffset,
			w / zoom,
			h / zoom,
			'-moz-field'
		);
		ctx.restore();
		if (sv.mTabBrowser.getAttribute(this.kTRANSPARENT) != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_FULL]) {
			var alpha = Number(this.getTreePref('tabbar.transparent.partialTransparency'));
			if (isNaN(alpha)) alpha = 0.25;
			ctx.globalAlpha = alpha;
			ctx.fillStyle = 'black';
			ctx.fillRect(0, 0, w, h);
		}
		ctx.restore();
	},
	
	get splitterBorderColor() 
	{
		var sv = this.mOwner;
		var borderNode = this.getTreePref(
					sv.isVertical ?
						'tabbar.fixed.vertical' :
						'tabbar.fixed.horizontal'
				) ?
				sv.tabStrip :
				document.getAnonymousElementByAttribute(sv.mTabBrowser, 'class', sv.kSPLITTER) ;

		var pos = sv.mTabBrowser.getAttribute(sv.kTABBAR_POSITION);
		var prop = pos == 'left' ? 'right' :
				pos == 'right' ? 'left' :
				pos == 'top' ? 'bottom' :
				'top' ;

		var borderColor = window.getComputedStyle(borderNode, null).getPropertyValue('-moz-border-'+prop+'-colors');
		if (borderColor == 'none')
			borderRight = window.getComputedStyle(borderNode, null).getPropertyValue('border-'+prop+'-color');

		/rgba?\(([^,]+),([^,]+),([^,]+)(,.*)?\)/.test(borderColor);

		return 'rgb('+[
				parseInt(parseInt(RegExp.$1) * 0.8),
				parseInt(parseInt(RegExp.$2) * 0.8),
				parseInt(parseInt(RegExp.$3) * 0.8)
			].join(',')+')';
	},
 
	getZoomForFrame : function TSTAutoHide_getZoomForFrame(aFrame) 
	{
		var zoom = aFrame
				.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIWebNavigation)
				.QueryInterface(Components.interfaces.nsIDocShell)
				.contentViewer
				.QueryInterface(Components.interfaces.nsIMarkupDocumentViewer)
				.fullZoom;
		return (zoom * 1000 % 1) ? zoom+0.025 : zoom ;
	},
  
	clearBG : function TSTAutoHide_clearBG() 
	{
		if (!this.tabbarCanvas) return;

		this.tabbarCanvas.style.display = 'none';
		this.tabbarCanvas.style.margin = 0;
		// zero width (heigh) canvas becomes wrongly size!!
		this.tabbarCanvas.style.width = this.tabbarCanvas.style.height = '1px';
		this.tabbarCanvas.width = this.tabbarCanvas.height = 1;
	},
 
	updateTransparency : function TSTAutoHide_updateTransparency() 
	{
		var sv  = this.mOwner;
		var b   = sv.mTabBrowser;
		var pos = b.getAttribute(sv.kTABBAR_POSITION);
		var style = this.kTRANSPARENT_STYLE[
				Math.max(
					this.kTRANSPARENT_NONE,
					Math.min(
						this.kTRANSPARENT_FULL,
						this.getTreePref('tabbar.transparent.style')
					)
				)
			];
		if (pos != 'top' &&
			this.mode != this.kMODE_DISABLED &&
			style != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_NONE])
			b.setAttribute(this.kTRANSPARENT, style);
		else
			b.removeAttribute(this.kTRANSPARENT);
	},
  
	// event handling 
	
	observe : function TSTAutoHide_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onPrefChange(aData);
				break;

			default:
				break;
		}
	},
	
	domains : [ 
		'extensions.treestyletab.',
		'browser.fullscreen.autohide'
	],
 
	onPrefChange : function TSTAutoHide_onPrefChange(aPrefName) 
	{
		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.autoHide.mode':
				this.updateMode();
				break;

			case 'extensions.treestyletab.tabbar.autoShow.mousemove':
			case 'extensions.treestyletab.tabbar.autoShow.accelKeyDown':
			case 'extensions.treestyletab.tabbar.autoShow.feedback':
				if (this.enabled && this.shouldListenMouseMove)
					this.startListenMouseMove();
				else
					this.endListenMouseMove();
				break;

			case 'extensions.treestyletab.tabbar.autoHide.area':
				this.sensitiveArea = value;
				break;

			case 'extensions.treestyletab.tabbar.transparent.style':
				this.updateTransparency();
				break;

			case 'extensions.treestyletab.tabbar.togglerSize':
				this.togglerSize = value;
				var toggler = document.getAnonymousElementByAttribute(this.mOwner.mTabBrowser, 'class', this.kTABBAR_TOGGLER);
				toggler.style.minWidth = toggler.style.minHeight = value+'px';
				if (this.togglerSize <= 0)
					toggler.setAttribute('collapsed', true);
				else
					toggler.removeAttribute('collapsed');
				break;

			case 'browser.fullscreen.autohide':
				if (!window.fullScreen) return;
				this.end();
				this.mode = value ?
						this.getTreePref('tabbar.autoHide.mode.fullscreen') :
						this.kMODE_DISABLED ;
				if (this.mode != this.kMODE_DISABLED)
					this.start();
				break;

			default:
				break;
		}
	},
  
	handleEvent : function TSTAutoHide_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'mousedown':
				this.onMouseDown(aEvent);
				return;

			case 'mouseup':
				this.onMouseUp(aEvent);
				return;

			case 'mousemove':
				if (this.handleMouseMove(aEvent)) return;
			case 'resize':
				this.onResize(aEvent);
				return;

			case 'scroll':
				this.onScroll(aEvent);
				return;

			case 'load':
				if (this.shouldRedraw)
					this.redrawContentArea();
				return;

			case 'TabOpen':
			case 'TabClose':
				this.showForFeedback();
				return;

			case 'TabMove':
				if (!this.mOwner.subTreeMovingCount && !this.mOwner.internallyTabMovingCount)
					this.showForFeedback();
				return;

			case 'select':
				if (this.shouldRedraw)
					this.redrawContentArea();
				if (!TreeStyleTabService.accelKeyPressed)
					this.showForFeedback();
				return;

			case 'TreeStyleTabTabbarPositionChanging':
				this.isResizing = false;
				this.clearBG();
				if (this.shouldRedraw)
					this.hide();
				return;

			case 'TreeStyleTabTabbarPositionChanged':
				if (this.enabled) this.show();
				this.updateTransparency();
				return;

			case 'TreeStyleTabFocusSwitchingKeyDown':
				this.onKeyDown(aEvent.sourceEvent);
				return;

			case 'TreeStyleTabFocusSwitchingStart':
				this.cancelDelayedShowForShortcut();
				if (this.enabled &&
					this.getTreePref('tabbar.autoShow.tabSwitch') &&
					(
						aEvent.scrollDown ||
						aEvent.scrollUp ||
						( // when you release "shift" key
							this.expanded &&
							aEvent.standBy &&
							aEvent.onlyShiftKey
						)
					))
					this.show(this.kSHOWN_BY_SHORTCUT);
				return;

			case 'TreeStyleTabFocusSwitchingEnd':
				this.cancelDelayedShowForShortcut();
				if (this.enabled &&
					this.showHideReason == this.kSHOWN_BY_SHORTCUT)
					this.hide();
				return;
		}
	},
	
	onMouseDown : function TSTAutoHide_onMouseDown(aEvent) 
	{
		var sv = this.mOwner;
		if (
			!this.isResizing &&
			this.evaluateXPath(
				'ancestor-or-self::*[@class="'+this.kSPLITTER+'"]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.BOOLEAN_TYPE
			).booleanValue
			) {
			this.isResizing = true;
			this.clearBG();
			sv.setTabbarAttribute(sv.kRESIZING, true, sv.mTabBrowser);
			/* canvasを非表示にしたのと同じタイミングでリサイズを行うと、
			   まだ内部的にcanvasの大きさが残ったままなので、その大きさ以下に
			   タブバーの幅を縮められなくなる。手動でイベントを再送してやると
			   この問題を防ぐことができる。 */
			aEvent.preventDefault();
			aEvent.stopPropagation();
			var flags = 0;
			const nsIDOMNSEvent = Components.interfaces.nsIDOMNSEvent;
			if (aEvent.altKey) flags |= nsIDOMNSEvent.ALT_MASK;
			if (aEvent.ctrlKey) flags |= nsIDOMNSEvent.CONTROL_MASK;
			if (aEvent.shiftKey) flags |= nsIDOMNSEvent.SHIFT_MASK;
			if (aEvent.metaKey) flags |= nsIDOMNSEvent.META_MASK;
			window.setTimeout(function(aX, aY, aButton, aDetail) {
				window
					.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
					.getInterface(Components.interfaces.nsIDOMWindowUtils)
					.sendMouseEvent('mousedown', aX, aY, aButton, aDetail, flags);
				flags = null;
			}, 0, aEvent.clientX, aEvent.clientY, aEvent.button, aEvent.detail);
		}
		this.cancelShowHideOnMousemove();
		if (
			this.enabled &&
			this.expanded &&
			(
				aEvent.originalTarget.ownerDocument != document ||
				!this.getTabBrowserFromChild(aEvent.originalTarget)
			)
			)
			this.hide();
		this.lastMouseDownTarget = aEvent.originalTarget.localName;
	},
 
	onMouseUp : function TSTAutoHide_onMouseUp(aEvent) 
	{
		var sv = this.mOwner;
		if (aEvent.originalTarget &&
			this.evaluateXPath(
				'ancestor-or-self::*[@class="'+this.kSPLITTER+'"]',
				aEvent.originalTarget,
				XPathResult.BOOLEAN_TYPE
			).booleanValue) {
			this.isResizing = false;
			sv.setTabbarAttribute(sv.kRESIZING, null, sv.mTabBrowser);
			window.setTimeout(function(aSelf) {
				if (!aSelf.shouldRedraw) return;
				aSelf.redrawContentArea();
				aSelf.drawBG();
			}, 0, this);
		}
		this.cancelShowHideOnMousemove();
		this.lastMouseDownTarget = null;
	},
 
	handleMouseMove : function TSTAutoHide_handleMouseMove(aEvent) 
	{
		var sv = this.mOwner;
		if (this.isResizing &&
			/^(scrollbar|thumb|slider|scrollbarbutton)$/i.test(this.lastMouseDownTarget))
			return true;

		if (
			!sv.popupMenuShown &&
			(
				!this.expanded ||
				this.showHideReason & this.kKEEP_SHOWN_ON_MOUSEOVER
			)
			)
			this.showHideOnMousemove(aEvent);
		return true;
	},
 
	onResize : function TSTAutoHide_onResize(aEvent) 
	{
		if (
			!aEvent.originalTarget ||
			(
				aEvent.originalTarget.ownerDocument != document &&
				aEvent.originalTarget != window
			) ||
			!this.shouldRedraw
			) {
			return;
		}
		var sv = this.mOwner;
		switch (sv.mTabBrowser.getAttribute(sv.kTABBAR_POSITION))
		{
			case 'left':
				sv.container.style.marginRight = '-'+this.XOffset+'px';
				break;
			case 'right':
				sv.container.style.marginLeft = '-'+this.XOffset+'px';
				break;
			case 'bottom':
				sv.container.style.marginTop = '-'+this.YOffset+'px';
				break;
			default:
				sv.container.style.marginBottom = '-'+this.YOffset+'px';
				break;
		}
		this.redrawContentArea();
	},
 
	onScroll : function TSTAutoHide_onScroll(aEvent) 
	{
		var node = aEvent.originalTarget;
		if ((node && node.ownerDocument == document) || !this.shouldRedraw) return;

		var tabbarBox, nodeBox;
		if (
			!(node instanceof Components.interfaces.nsIDOMElement) ||
			(
				(tabbarBox = this.getBoxObjectFor(this.mTabBrowser.mTabContainer)) &&
				(nodeBox = this.getBoxObjectFor(node)) &&
				tabbarBox.screenX <= nodeBox.screenX + nodeBox.width &&
				tabbarBox.screenX + tabbarBox.width >= nodeBox.screenX &&
				tabbarBox.screenY <= nodeBox.screenY + nodeBox.height &&
				tabbarBox.screenY + tabbarBox.height >= nodeBox.screenY
			)
			)
			this.redrawContentArea();
	},
 
	onKeyDown : function TSTAutoHide_onKeyDown(aEvent) 
	{
		var sv = this.mOwner;
		var b  = sv.mTabBrowser;

		if (this.delayedShowForShortcutDone)
			this.cancelDelayedShowForShortcut();

		if (
			sv.getTabs(b).snapshotLength > 1 &&
			!aEvent.altKey &&
			TreeStyleTabService.accelKeyPressed
			) {
			if (this.enabled &&
				this.getTreePref('tabbar.autoShow.accelKeyDown') &&
				!this.expanded &&
				!this.delayedAutoShowTimer &&
				!this.delayedShowForShortcutTimer) {
				this.delayedShowForShortcutTimer = window.setTimeout(
					function(aSelf) {
						aSelf.delayedShowForShortcutDone = true;
						aSelf.show(aSelf.kSHOWN_BY_SHORTCUT);
						sv = null;
						b = null;
					},
					this.getTreePref('tabbar.autoShow.accelKeyDown.delay'),
					this
				);
				this.delayedShowForShortcutDone = false;
			}
		}
		else {
			if (this.enabled)
				this.hide();
		}
	},
	
	cancelDelayedShowForShortcut : function TSTAutoHide_cancelDelayedShowForShortcut() 
	{
		if (this.delayedShowForShortcutTimer) {
			window.clearTimeout(this.delayedShowForShortcutTimer);
			this.delayedShowForShortcutTimer = null;
		}
	},
 
	delayedShowForShortcutTimer : null, 
	delayedShowForShortcutDone : true,
    
	init : function TSTAutoHide_init() 
	{
		this.enabled = false;
		this.mouseMoveListening = false;
		this.showHideReason = 0;
		this.lastMouseDownTarget = null;
		this.isResizing = false;

		this.showHideOnMousemoveTimer = null;
		this.delayedShowForFeedbackTimer = null;

		this.addPrefListener(this);
		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.area');
		this.onPrefChange('extensions.treestyletab.tabbar.transparent.style');
		this.onPrefChange('extensions.treestyletab.tabbar.togglerSize');
		window.setTimeout(function(aSelf) {
			aSelf.onPrefChange('extensions.treestyletab.tabbar.autoHide.mode');
		}, 0, this);

		var b = this.mOwner.mTabBrowser;
		b.mTabContainer.addEventListener('TabOpen', this, false);
		b.mTabContainer.addEventListener('TabClose', this, false);
		b.mTabContainer.addEventListener('TabMove', this, false);
		b.mTabContainer.addEventListener('select', this, false);
		b.addEventListener('TreeStyleTabTabbarPositionChanging', this, false);
		b.addEventListener('TreeStyleTabTabbarPositionChanged', this, false);
		b.addEventListener('TreeStyleTabFocusSwitchingKeyDown', this, false);
		b.addEventListener('TreeStyleTabFocusSwitchingStart', this, false);
		b.addEventListener('TreeStyleTabFocusSwitchingEnd', this, false);

		var stack = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-stack');
		if (stack) {
			let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
			canvas.setAttribute('style', 'display:none;width:1;height:1;');
			stack.firstChild.appendChild(canvas);
			this.tabbarCanvas = canvas;
			this.clearBG();
		}

		b = null;
		stack = null;
	},
 
	destroy : function TSTAutoHide_destroy() 
	{
		this.end();
		this.removePrefListener(this);
		var b = this.mOwner.mTabBrowser;
		b.mTabContainer.removeEventListener('TabOpen', this, false);
		b.mTabContainer.removeEventListener('TabClose', this, false);
		b.mTabContainer.removeEventListener('TabMove', this, false);
		b.mTabContainer.removeEventListener('select', this, false);
		b.removeEventListener('TreeStyleTabTabbarPositionChanging', this, false);
		b.removeEventListener('TreeStyleTabTabbarPositionChanged', this, false);
		b.removeEventListener('TreeStyleTabFocusSwitchingKeyDown', this, false);
		b.removeEventListener('TreeStyleTabFocusSwitchingStart', this, false);
		b.removeEventListener('TreeStyleTabFocusSwitchingEnd', this, false);
	}
 
}; 
TreeStyleTabBrowserAutoHide.prototype.__proto__ = TreeStyleTabService;
  
// class methods 
	
// mode 
	
TreeStyleTabBrowserAutoHide.__defineGetter__('mode', function() { /* PUBLIC API */ 
	if (this.mMode == this.prototype.kMODE_SHRINK &&
		TreeStyleTabService.currentTabbarPosition != 'left' &&
		TreeStyleTabService.currentTabbarPosition != 'right')
		return this.prototype.kMODE_HIDE;
	return this.mMode;
});
 
TreeStyleTabBrowserAutoHide.__defineSetter__('mode', function(aValue) { 
	this.mMode = aValue;
	return aValue;
});
 
TreeStyleTabBrowserAutoHide.mMode = TreeStyleTabBrowserAutoHide.prototype.kMODE_HIDE; 
  
TreeStyleTabBrowserAutoHide.toggleMode = function TSTAutoHide_toggleMode() { /* PUBLIC API */ 
	TreeStyleTabService.setTreePref('tabbar.autoHide.mode',
		TreeStyleTabService.getTreePref('tabbar.autoHide.mode') == this.prototype.kMODE_DISABLED ?
			TreeStyleTabService.getTreePref('tabbar.autoHide.mode.toggle') :
			this.prototype.kMODE_DISABLED
	);
};
 
// for shortcuts 
	
TreeStyleTabBrowserAutoHide.updateKeyListeners = function TSTAutoHide_updateKeyListeners() { 
	if (
		TreeStyleTabService.getTreePref('tabbar.autoHide.mode') &&
		this.shouldListenKeyEvents
		) {
		TreeStyleTabService.startListenKeyEventsFor(TreeStyleTabService.LISTEN_FOR_AUTOHIDE);
	}
	else {
		TreeStyleTabService.endListenKeyEventsFor(TreeStyleTabService.LISTEN_FOR_AUTOHIDE);
	}
	window.setTimeout(function() {
		if (window.windowState != Components.interfaces.nsIDOMChromeWindow.STATE_NORMAL) return;
		var count = 0;
		var resizeTimer = window.setInterval(function(){
			if (++count > 100 || window.innerHeight > 0) {
				window.clearInterval(resizeTimer);
				window.resizeBy(-1,-1);
				window.resizeBy(1,1);
			}
		}, 250);
	}, 0);
};
	
TreeStyleTabBrowserAutoHide.__defineGetter__('shouldListenKeyEvents', function() { 
	return !TreeStyleTabService.ctrlTabPreviewsEnabled &&
			(
				TreeStyleTabService.getTreePref('tabbar.autoShow.accelKeyDown') ||
				TreeStyleTabService.getTreePref('tabbar.autoShow.tabSwitch') ||
				TreeStyleTabService.getTreePref('tabbar.autoShow.feedback')
			);
});
    
