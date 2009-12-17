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
 
	get mode() 
	{
		return TreeStyleTabBrowserAutoHide.mode;
	},
	set mode(aValue)
	{
		TreeStyleTabBrowserAutoHide.mode = aValue;
		return aValue;
	},
	
	updateMode : function() 
	{
		this.end();
		// update internal property after the appearance of the tab bar is updated.
		window.setTimeout(function(aSelf) {
			aSelf.mode = aSelf.getTreePref('tabbar.autoHide.mode');
			if (aSelf.mode != aSelf.kMODE_DISABLED)
				aSelf.start();
		}, 0, this);
	},
  
	get shown() 
	{
		switch (this.mode)
		{
			case this.kMODE_HIDE:
				return this.reallyShown;

			default:
			case this.kMODE_SHRINK:
				return this.expanded;
		}
	},
	set shown(aValue)
	{
		switch (this.mode)
		{
			case this.kMODE_HIDE:
				this.reallyShown = aValue;
				break;

			default:
			case this.kMODE_SHRINK:
				this.expanded = aValue;
				break;
		}
		return aValue;
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
 
	start : function() 
	{
		if (this.enabled) return;
		this.enabled = true;

		var sv = this.mOwner;

		sv.mTabBrowser.addEventListener('mousedown', this, true);
		sv.mTabBrowser.addEventListener('mouseup', this, true);
		sv.mTabBrowser.addEventListener('resize', this, true);
		sv.mTabBrowser.addEventListener('load', this, true);
		sv.mTabBrowser.mPanelContainer.addEventListener('scroll', this, true);
		if (this.shouldListenMouseMove)
			this.startListenMouseMove();
		if (sv.mTabBrowser == gBrowser && sv.shouldListenKeyEventsForAutoHide)
			TreeStyleTabService.startListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);

		this.clearBG();
		this.updateTransparency();

		this.reallyShown = true;
		this.expanded = true;
		this.showHideInternal();
	},
 
	end : function() 
	{
		if (!this.enabled) return;
		this.enabled = false;

		var sv = this.mOwner;

		if (!this.shown)
			this.showHideInternal();

		sv.mTabBrowser.removeEventListener('mousedown', this, true);
		sv.mTabBrowser.removeEventListener('mouseup', this, true);
		sv.mTabBrowser.removeEventListener('resize', this, true);
		sv.mTabBrowser.removeEventListener('load', this, true);
		sv.mTabBrowser.mPanelContainer.removeEventListener('scroll', this, true);
		this.endListenMouseMove();
		if (sv.mTabBrowser == gBrowser)
			TreeStyleTabService.endListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);

		this.clearBG();
		this.updateTransparency();

		sv.container.style.margin = 0;
		sv.mTabBrowser.removeAttribute(this.kAUTOHIDE);
		sv.mTabBrowser.removeAttribute(this.kTRANSPARENT);
		this.reallyShown = true;
		this.expanded = true;
	},
 
	// fullscreen 
	
	startForFullScreen : function() 
	{
		this.mode = this.getTreePref('tabbar.autoHide.mode');
		this.end();
		this.mode = this.getPref('browser.fullscreen.autohide') ?
				this.getTreePref('tabbar.autoHide.mode.fullscreen') :
				this.kMODE_DISABLED ;
		if (this.mode != this.kMODE_DISABLED) {
			this.start();
			var sv = this.mOwner;
			sv.mTabBrowser.mStrip.removeAttribute('moz-collapsed');
			sv.mTabBrowser.mTabContainer.removeAttribute('moz-collapsed'); // 念のため
		}
	},
 
	endForFullScreen : function() 
	{
		this.mode = this.getTreePref('tabbar.autoHide.mode.fullscreen');
		this.end();
		this.mode = this.getTreePref('tabbar.autoHide.mode');
		this.mOwner.checkTabsIndentOverflow();
		if (this.mode != this.kMODE_DISABLED)
			this.start();
	},
  
	// mousemove 
	
	startListenMouseMove : function() 
	{
		if (this.mouseMoveListening) return;
		this.mOwner.mTabBrowser.addEventListener('mousemove', this, true);
		this.mouseMoveListening = true;
	},
 
	endListenMouseMove : function() 
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
 
	showHideOnMousemove : function(aEvent) 
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
		if (!this.shown && this.mode == this.kMODE_SHRINK) {
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
		if (this.shown) {
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
 
	cancelShowHideOnMousemove : function() 
	{
		if (this.showHideOnMousemoveTimer) {
			window.clearTimeout(this.showHideOnMousemoveTimer);
			this.showHideOnMousemoveTimer = null;
		}
	},
  
	// feedback 
	
	showForFeedback : function() 
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
 
	delayedShowForFeedback : function() 
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
 
	cancelHideForFeedback : function() 
	{
		if (this.delayedHideTabbarForFeedbackTimer) {
			window.clearTimeout(this.delayedHideTabbarForFeedbackTimer);
			this.delayedHideTabbarForFeedbackTimer = null;
		}
	},
  
	setWidth : function(aWidth, aForceExpanded) 
	{
		if (aForceExpanded ||
			this.shown ||
			this.mode !=  this.kMODE_SHRINK)
			this.setTreePref('tabbar.width', aWidth);
		else
			this.setTreePref('tabbar.shrunkenWidth', aWidth);
	},
 
	updateMenuItem : function(aNode) 
	{
		if (this.mode != this.kMODE_DISABLED)
			aNode.setAttribute('checked', true);
		else
			aNode.removeAttribute('checked');
	},
 
	// show/hide tabbar 
	
	get width() 
	{
		if (this.shown) {
			this._width = this.mOwner.mTabBrowser.mStrip.boxObject.width;
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
		return (
					!this.shown &&
					this.mode ==  this.kMODE_SHRINK
				) ?
					this.getTreePref('tabbar.shrunkenWidth') :
					this.getTreePref('tabbar.width') ;
	},
  
	get height() 
	{
		if (this.reallyShown) {
			this._height = this.mOwner.mTabBrowser.mStrip.boxObject.height;
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
		if (this.reallyShown) {
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
 
	showHideInternal : function(aReason) 
	{
		var viewer = this.rootContentViewer;
		viewer.hide();

		var sv  = this.mOwner;
		var b   = sv.mTabBrowser;
		var pos = b.getAttribute(sv.kTABBAR_POSITION);

		if (this.shown) { // to be hidden or shrunken
			this.onHiding();
			this.showHideReason = aReason || this.kSHOWN_BY_UNKNOWN;
			this.shown = false;
		}
		else { // to be shown or expanded
			this.onShowing();
			this.showHideReason = aReason || this.kSHOWN_BY_UNKNOWN;
			this.shown = true;
		}

		this.fireStateChangingEvent();

		window.setTimeout(function(aSelf) {
			if (aSelf.shown) {
				sv.mTabBrowser.setAttribute(aSelf.kAUTOHIDE, 'show');
				aSelf.redrawContentArea();
			}
			b.mTabContainer.adjustTabstrip();
			sv.checkTabsIndentOverflow();
			aSelf.redrawContentArea();

			aSelf.fireStateChangeEvent();

			viewer.show();
		}, 0, this);
	},
	
	get rootContentViewer() 
	{
		return window
				.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIWebNavigation)
				.QueryInterface(Components.interfaces.nsIDocShell)
				.contentViewer
				.QueryInterface(Components.interfaces.nsIMarkupDocumentViewer);
	},
 
	show : function(aReason) 
	{
		if (!this.shown)
			this.showHideInternal(aReason);
	},
 
	hide : function(aReason) 
	{
		if (this.shown)
			this.showHideInternal(aReason);
	},
 
	onShowing : function() 
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

		switch (this.mode)
		{
			case this.kMODE_HIDE:
				break;

			default:
			case this.kMODE_SHRINK:
				if (pos == 'left' || pos == 'right')
					b.mStrip.width = this.getTreePref('tabbar.width');
				break;
		}
	},
 
	onHiding : function() 
	{
		var sv  = this.mOwner;
		var b   = sv.mTabBrowser;
		var pos = b.getAttribute(sv.kTABBAR_POSITION);

		this.tabbarHeight = b.mStrip.boxObject.height;
		this.width = b.mStrip.boxObject.width;
		var splitter = document.getAnonymousElementByAttribute(b, 'class', sv.kSPLITTER);
		this.splitterWidth = (splitter ? splitter.boxObject.width : 0 );
		sv.container.style.margin = 0;
		switch (this.mode)
		{
			case this.kMODE_HIDE:
				b.setAttribute(this.kAUTOHIDE, 'hidden');
				break;

			default:
			case this.kMODE_SHRINK:
				b.setAttribute(this.kAUTOHIDE, 'show');
				if (pos == 'left' || pos == 'right')
					b.mStrip.width = this.getTreePref('tabbar.shrunkenWidth');
				break;
		}
	},
 
	fireStateChangingEvent : function() 
	{
		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabAutoHideStateChanging', true, true);
		event.shown = this.shown;
		this.mOwner.mTabBrowser.dispatchEvent(event);
	},
 
	fireStateChangeEvent : function() 
	{
		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabAutoHideStateChange', true, true);
		event.shown = this.shown;
		event.xOffset = this.XOffset;
		event.yOffset = this.YOffset;
		this.mOwner.mTabBrowser.dispatchEvent(event);
	},
  
	redrawContentArea : function() 
	{
		var sv  = this.mOwner;
		var pos = sv.mTabBrowser.getAttribute(sv.kTABBAR_POSITION);
		try {
			var v = sv.mTabBrowser.markupDocumentViewer;
			if (this.enabled && this.shown) {
				v.move(window.outerWidth,window.outerHeight);
				v.move(
					(
						!this.shown ? 0 :
						pos == 'left' ? -this.XOffset :
						pos == 'right' ? this.XOffset :
						0
					),
					(
						!this.shown ? 0 :
						pos == 'top' ? -this.YOffset :
						pos == 'bottom' ? this.YOffset :
						0
					)
				);
				if (sv.mTabBrowser.hasAttribute(this.kTRANSPARENT) &&
					sv.mTabBrowser.getAttribute(this.kTRANSPARENT) != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_NONE])
					this.drawBG();
				else
					this.clearBG();
			}
			else {
				v.move(window.outerWidth,window.outerHeight);
				v.move(0,0);
				this.clearBG();
			}
		}
		catch(e) {
		}
	},
 
	get shouldRedraw() 
	{
		return this.enabled && this.shown; // && this.mTabBrowser.hasAttribute(this.kTRANSPARENT);
	},
 
	drawBG : function() 
	{
		var sv = this.mOwner;

		if (!this.tabbarCanvas || this.isResizing) return;

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
		     node != sv.mTabBrowser.mStrip.parentNode;
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
				sv.mTabBrowser.mStrip :
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
 
	getZoomForFrame : function(aFrame) 
	{
		var zoom = this.rootContentViewer.fullZoom;
		return (zoom * 1000 % 1) ? zoom+0.025 : zoom ;
	},
  
	clearBG : function() 
	{
		if (!this.tabbarCanvas) return;

		this.tabbarCanvas.style.display = 'none';
		this.tabbarCanvas.style.margin = 0;
		// zero width (heigh) canvas becomes wrongly size!!
		this.tabbarCanvas.style.width = this.tabbarCanvas.style.height = '1px';
		this.tabbarCanvas.width = this.tabbarCanvas.height = 1;
	},
 
	updateTransparency : function() 
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
	
	observe : function(aSubject, aTopic, aData) 
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
 
	onPrefChange : function(aPrefName) 
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
  
	handleEvent : function(aEvent) 
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
				if (this.enabled && this.shown) this.hide();
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
							this.shown &&
							aEvent.standBy && aEvent.onlyShiftKey
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
	
	onMouseDown : function(aEvent) 
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
			sv.mTabBrowser.setAttribute(sv.kRESIZING, true);
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
			this.shown &&
			(
				aEvent.originalTarget.ownerDocument != document ||
				!this.getTabBrowserFromChild(aEvent.originalTarget)
			)
			)
			this.hide();
		this.lastMouseDownTarget = aEvent.originalTarget.localName;
	},
 
	onMouseUp : function(aEvent) 
	{
		var sv = this.mOwner;
		if (aEvent.originalTarget &&
			this.evaluateXPath(
				'ancestor-or-self::*[@class="'+this.kSPLITTER+'"]',
				aEvent.originalTarget,
				XPathResult.BOOLEAN_TYPE
			).booleanValue) {
			this.isResizing = false;
			sv.mTabBrowser.removeAttribute(sv.kRESIZING);
			window.setTimeout(function(aSelf) {
				if (!aSelf.shouldRedraw) return;
				aSelf.redrawContentArea();
				aSelf.drawBG();
			}, 0, this);
		}
		this.cancelShowHideOnMousemove();
		this.lastMouseDownTarget = null;
	},
 
	handleMouseMove : function(aEvent) 
	{
		var sv = this.mOwner;
		if (this.isResizing &&
			/^(scrollbar|thumb|slider|scrollbarbutton)$/i.test(this.lastMouseDownTarget))
			return true;

		if (
			!sv.popupMenuShown &&
			(
				!this.shown ||
				this.showHideReason & this.kKEEP_SHOWN_ON_MOUSEOVER
			)
			)
			this.showHideOnMousemove(aEvent);
		return true;
	},
 
	onResize : function(aEvent) 
	{
		if (
			!aEvent.originalTarget ||
			aEvent.originalTarget.ownerDocument != document ||
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
 
	onScroll : function(aEvent) 
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
 
	onKeyDown : function(aEvent) 
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
				!this.shown &&
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
	
	cancelDelayedShowForShortcut : function() 
	{
		if (this.delayedShowForShortcutTimer) {
			window.clearTimeout(this.delayedShowForShortcutTimer);
			this.delayedShowForShortcutTimer = null;
		}
	},
 
	delayedShowForShortcutTimer : null, 
	delayedShowForShortcutDone : true,
    
	init : function() 
	{
		this.enabled = false;
		this.mouseMoveListening = false;
		this.showHideReason = 0;
		this.reallyShown = true;
		this.expanded = true;
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
		b.addEventListener('TabOpen', this, false);
		b.addEventListener('TabClose', this, false);
		b.addEventListener('TabMove', this, false);
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
 
	destroy : function() 
	{
		this.end();
		this.removePrefListener(this);
		var b = this.mOwner.mTabBrowser;
		b.removeEventListener('TabOpen', this, false);
		b.removeEventListener('TabClose', this, false);
		b.removeEventListener('TabMove', this, false);
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
	
TreeStyleTabBrowserAutoHide.__defineGetter__('mode', function() { 
	if (this.mMode == this.prototype.kMODE_SHRINK &&
		TreeStyleTabService.getTreePref('tabbar.position') != 'left' &&
		TreeStyleTabService.getTreePref('tabbar.position') != 'right')
		return this.prototype.kMODE_HIDE;
	return this.mMode;
});
 
TreeStyleTabBrowserAutoHide.__defineSetter__('mode', function(aValue) { 
	this.mMode = aValue;
	return aValue;
});
 
TreeStyleTabBrowserAutoHide.mMode = TreeStyleTabBrowserAutoHide.prototype.kMODE_HIDE; 
  
TreeStyleTabBrowserAutoHide.toggleMode = function() { 
	TreeStyleTabService.setTreePref('tabbar.autoHide.mode',
		TreeStyleTabService.getTreePref('tabbar.autoHide.mode') == this.prototype.kMODE_DISABLED ?
			TreeStyleTabService.getTreePref('tabbar.autoHide.mode.toggle') :
			this.prototype.kMODE_DISABLED
	);
};
 
// for shortcuts 
	
TreeStyleTabBrowserAutoHide.updateKeyListeners = function() { 
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
    
