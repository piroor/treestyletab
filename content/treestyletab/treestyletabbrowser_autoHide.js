function TreeStyleTabBrowserAutoHide(aOwner) 
{
	this.mOwner = aOwner;
	this.init();
}
TreeStyleTabBrowserAutoHide.prototype = {
	__proto__ : TreeStyleTabService,
	
	kMODE : 'treestyletab-tabbar-autohide-mode', 
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
		var mode = this.mOwner.browser.getAttribute(this.kMODE);
		return mode ? parseInt(mode) : this.kMODE_DISABLED ;
	},
	set mode(aValue)
	{
		this.mOwner.browser.setAttribute(this.kMODE, aValue);
		return aValue;
	},

	getMode : function TSTAutoHide_getMode(aTabBrowser)
	{
		var b = aTabBrowser || this.mOwner.browser;
		var mode = b.getAttribute(this.kMODE);
		return mode ? parseInt(mode) : this.kMODE_DISABLED ;
	},
	getModeForNormal : function TSTAutoHide_getModeForNormal(aTabBrowser)
	{
		var b = aTabBrowser || this.mOwner.browser;
		return parseInt(b.getAttribute(this.kMODE+'-normal') || this.getTreePref('tabbar.autoHide.mode'));
	},
	getModeForFullScreen : function TSTAutoHide_getModeForFullScreen(aTabBrowser)
	{
		var b = aTabBrowser || this.mOwner.browser;
		return parseInt(b.getAttribute(this.kMODE+'-fullscreen') || this.getTreePref('tabbar.autoHide.mode.fullscreen'));
	},

	get state()
	{
		return this.mOwner.browser.getAttribute(this.kSTATE) || this.kSTATE_EXPANDED;
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
			aSelf.mode = (window.fullScreen && aSelf.getPref('browser.fullscreen.autohide')) ?
					aSelf.getModeForFullScreen() :
					aSelf.getModeForNormal() ;
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
			case this.kMODE_DISABLED:
				return 0;

			case this.kMODE_HIDE:
				let offset = this.width + this.splitterWidth;
				if (sv.currentTabbarPosition == 'left') {
					offset -= this.togglerSize;
				}
				return offset;

			default:
			case this.kMODE_SHRINK:
				return this.getTreePref('tabbar.width')
						- this.getTreePref('tabbar.shrunkenWidth');
		}
	},
	get YOffset()
	{
		return this.height;
	},
	extraXOffset : 0,
	extraYOffset : 0,
 
	get currentXOffset()
	{
		var sv = this.mOwner;
		return (
				sv.currentTabbarPosition == 'left' &&
				this.mode != this.kMODE_DISABLED &&
				this.expanded
			) ? this.XOffset : 0 ;
	},
	get currentYOffset()
	{
		var sv = this.mOwner;
		return (
				sv.currentTabbarPosition == 'top' &&
				this.mode != this.kMODE_DISABLED &&
				this.expanded
			) ? this.YOffset : 0 ;
	},
 
	start : function TSTAutoHide_start() 
	{
		if (this.enabled) return;
		this.enabled = true;

		var sv = this.mOwner;

		sv.browser.addEventListener('mousedown', this, true);
		sv.browser.addEventListener('mouseup', this, true);
		if (sv.isFloating) {
			sv.tabStrip.addEventListener('mousedown', this, true);
			sv.tabStrip.addEventListener('mouseup', this, true);
		}
		window.addEventListener('resize', this, true);
		window.addEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		window.addEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_EXITED, this, false);
		sv.browser.addEventListener('load', this, true);
		sv.browser.mPanelContainer.addEventListener('scroll', this, true);
		if (this.shouldListenMouseMove)
			this.startListenMouseMove();
		if (sv.browser == gBrowser && sv.shouldListenKeyEventsForAutoHide)
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

		sv.browser.removeEventListener('mousedown', this, true);
		sv.browser.removeEventListener('mouseup', this, true);
		if (sv.isFloating) {
			sv.tabStrip.removeEventListener('mousedown', this, true);
			sv.tabStrip.removeEventListener('mouseup', this, true);
		}
		window.removeEventListener('resize', this, true);
		window.removeEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		window.removeEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_EXITED, this, false);
		sv.browser.removeEventListener('load', this, true);
		sv.browser.mPanelContainer.removeEventListener('scroll', this, true);
		this.endListenMouseMove();
		if (sv.browser == gBrowser)
			TreeStyleTabService.endListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);

		this.clearBG();
		this.updateTransparency();

		if (!sv.isFloating)
			sv.container.style.margin = 0;
		sv.removeTabbrowserAttribute(this.kAUTOHIDE);
		sv.removeTabbrowserAttribute(this.kSTATE);
		sv.removeTabbrowserAttribute(this.kTRANSPARENT);

		sv.setTabStripAttribute('width', this.widthFromMode);
	},
 
	// fullscreen 
	
	startForFullScreen : function TSTAutoHide_startForFullScreen() 
	{
		this.mode = this.getMode();
		this.end();
		this.mode = this.getPref('browser.fullscreen.autohide') ?
				this.getModeForFullScreen() :
				this.kMODE_DISABLED ;
		if (this.mode != this.kMODE_DISABLED) {
			this.start();
			this.mOwner.removeTabbrowserAttribute('moz-collapsed');
		}
	},
 
	endForFullScreen : function TSTAutoHide_endForFullScreen() 
	{
		this.mode = this.getModeForFullScreen();
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

		this.mOwner.browser.addEventListener('mousemove', this, true);

		if (this.mOwner.isFloating)
			this.mOwner.tabStrip.addEventListener('mousemove', this, true);

		this.mouseMoveListening = true;
	},
 
	endListenMouseMove : function TSTAutoHide_endListenMouseMove() 
	{
		if (!this.mouseMoveListening) return;

		this.mOwner.browser.removeEventListener('mousemove', this, true);

		if (this.mOwner.isFloating)
			this.mOwner.tabStrip.removeEventListener('mousemove', this, true);

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
		var b   = sv.browser;
		var pos = sv.currentTabbarPosition;
		var box = b.mCurrentBrowser.boxObject;

		if (sv.isFloating && this.expanded) { // Firefox 4.0-
			box = {
				screenX : box.screenX + (pos == 'left' ? this.XOffset : 0 ),
				screenY : box.screenY,
				width   : box.width - this.XOffset,
				height  : box.height
			};
		}

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
			this.setTreePref('tabbar.width', this.mOwner.maxTabbarWidth(aWidth));
		else
			this.setTreePref('tabbar.shrunkenWidth', this.mOwner.maxTabbarWidth(aWidth));
	},
 
	updateMenuItem : function TSTAutoHide_updateMenuItem(aNode) 
	{
		if (!aNode) return;

		if (this.mode != this.kMODE_DISABLED)
			aNode.setAttribute('checked', true);
		else
			aNode.removeAttribute('checked');
	},
 
	// show/hide tabbar 
	
	get width() 
	{
		if (this.expanded) {
			this._width = this.mOwner.tabStrip.boxObject.width || this._width;
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
	get placeHolderWidthFromMode() 
	{
		return (this.mode == this.kMODE_SHRINK) ?
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
			var splitter = document.getAnonymousElementByAttribute(this.mOwner.browser, 'class', this.kSPLITTER);
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
		var sv = this.mOwner;
		if (!sv.isFloating)
			this.stopRendering();

		var b   = sv.browser;
		var pos = sv.currentTabbarPosition;

		if (this.expanded) { // to be hidden or shrunken
			this.onHiding();
			this.showHideReason = aReason || this.kSHOWN_BY_UNKNOWN;
			this.resetContentAreas();
		}
		else { // to be shown or expanded
			this.onShowing();
			this.showHideReason = aReason || this.kSHOWN_BY_UNKNOWN;
		}

		this.fireStateChangingEvent();

		if (this.expanded) {
			sv.setTabbrowserAttribute(this.kAUTOHIDE, 'show');
			this.redrawContentArea();
		}
		b.mTabContainer.adjustTabstrip();
		sv.checkTabsIndentOverflow();

		window.setTimeout(function(aSelf) {
			aSelf.redrawContentArea();
			aSelf.fireStateChangeEvent();
			if (!sv.isFloating)
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
		var b   = sv.browser;
		var pos = sv.currentTabbarPosition;
		if (!sv.isFloating) { // -Firefox 3.6
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
		}

		sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_EXPANDED);

		switch (this.mode)
		{
			case this.kMODE_DISABLED:
				break;

			case this.kMODE_HIDE:
				if (sv.isFloating)
					sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_AUTOHIDE);
				break;

			default:
			case this.kMODE_SHRINK:
				if (pos == 'left' || pos == 'right') {
					let width = sv.maxTabbarWidth(this.getTreePref('tabbar.width'));
					if (sv.isFloating) // Firefox 4.0-
						sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_AUTOHIDE);
					else // -Firefox 3.6
						sv.setTabStripAttribute('width', width);
				}
				break;
		}
	},
 
	onHiding : function TSTAutoHide_onHiding() 
	{
		var sv  = this.mOwner;
		var b   = sv.browser;
		var pos = sv.currentTabbarPosition;

		var box = (sv.tabStripPlaceHolder || sv.tabStrip).boxObject;

		this.tabbarHeight = box.height;
		this.width = box.width || this.width;
		var splitter = document.getAnonymousElementByAttribute(b, 'class', sv.kSPLITTER);
		this.splitterWidth = (splitter ? splitter.boxObject.width : 0 );

		if (!sv.isFloating) // -Firefox 3.6
			sv.container.style.margin = 0;

		switch (this.mode)
		{
			case this.kMODE_DISABLED:
				sv.setTabbrowserAttribute(this.kAUTOHIDE, 'hidden');
				sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_HIDDEN);
				break;

			case this.kMODE_HIDE:
				sv.setTabbrowserAttribute(this.kAUTOHIDE, 'hidden');
				sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_HIDDEN);
				sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_AUTOHIDE);
				break;

			default:
			case this.kMODE_SHRINK:
				sv.setTabbrowserAttribute(this.kAUTOHIDE, 'show');
				sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_SHRUNKEN);
				if (pos == 'left' || pos == 'right')
					sv.setTabStripAttribute('width', this.getTreePref('tabbar.shrunkenWidth'));
				sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_AUTOHIDE);
				break;
		}
	},
 
	fireStateChangingEvent : function TSTAutoHide_fireStateChangingEvent() 
	{
		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGING, true, false);
		event.shown = this.expanded;
		event.state = this.state;
		this.mOwner.browser.dispatchEvent(event);
	},
 
	fireStateChangeEvent : function TSTAutoHide_fireStateChangeEvent() 
	{
		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGE, true, false);
		event.shown = this.expanded;
		event.state = this.state;
		event.xOffset = this.XOffset;
		event.yOffset = this.YOffset;
		this.mOwner.browser.dispatchEvent(event);
	},
  
	redrawContentArea : function TSTAutoHide_redrawContentArea() 
	{
		var sv = this.mOwner;
		if (sv.isFloating)
			return;

		var pos = sv.currentTabbarPosition;
		try {
			var v = sv.browser.markupDocumentViewer;
			if (this.shouldRedraw) {
				if (sv.browser.hasAttribute(this.kTRANSPARENT) &&
					sv.browser.getAttribute(this.kTRANSPARENT) != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_NONE])
					this.drawBG();
				else
					this.clearBG();

				v.move(window.outerWidth, window.outerHeight);
				v.move(
					(
						pos == 'left' ? -this.XOffset :
						pos == 'right' ? this.XOffset :
						0
					) - this.extraXOffset,
					(
						pos == 'top' ? -this.YOffset :
						pos == 'bottom' ? this.YOffset :
						0
					) - this.extraYOffset
				);
			}
			else {
				this.clearBG();
				v.move(window.outerWidth, window.outerHeight);
				v.move(-this.extraXOffset, -this.extraYOffset);
			}
		}
		catch(e) {
			dump(e);
		}
	},
	redrawContentAreaWithDelay : function TSTAutoHide_redrawContentAreaWithDelay()
	{
		if (this.mOwner.isFloating)
			return;

		window.setTimeout(function(aSelf) {
			aSelf.redrawContentArea();
		}, 0, this);
	},
 
	resetContentAreas : function TSTAutoHide_resetContentAreas()
	{
		if (this.mOwner.isFloating)
			return;

		this.mOwner.getTabsArray(this.mOwner.browser).forEach(function(aTab) {
			try {
				aTab.linkedBrowser.markupDocumentViewer.move(0, 0);
			}
			catch(e) {
			}
		}, this);
	},
 
	get shouldRedraw() 
	{
		return !this.mOwner.isFloating && this.enabled && this.expanded;
	},
 
	drawBG : function TSTAutoHide_drawBG() 
	{
		var sv = this.mOwner;
		if (sv.isFloating || !this.tabbarCanvas || this.isResizing)
			return;

		this.tabbarCanvas.style.width = (this.tabbarCanvas.width = 1)+'px';
		this.tabbarCanvas.style.height = (this.tabbarCanvas.height = 1)+'px';

		var pos = sv.currentTabbarPosition;

		var frame = sv.browser.contentWindow;
		var tabContainerBox = sv.browser.mTabContainer.boxObject;
		var browserBox = sv.browser.mCurrentBrowser.boxObject;
		var contentBox = sv.getBoxObjectFor(frame.document.documentElement);

		var zoom = this.getZoomForFrame(frame);

		var x = (pos == 'right') ? browserBox.width - this.XOffset : 0 ;
		var y = (pos == 'bottom') ? browserBox.height - this.YOffset : 0 ;
		if (pos == 'left' && this.mode == this.kMODE_HIDE)
			x -= this.togglerSize;
		x += this.extraXOffset;
		y += this.extraYOffset;

		var xOffset = (zoom == 1 && (pos == 'top' || pos == 'bottom')) ?
				Math.max(0, contentBox.screenX + frame.scrollX - browserBox.screenX) :
				0 ;
		var yOffset = (zoom == 1 && (pos == 'left' || pos == 'right')) ?
				Math.max(0, contentBox.screenY + frame.scrollY - browserBox.screenY) :
				0 ;

		var w = tabContainerBox.width - xOffset;
		var h = tabContainerBox.height - yOffset;
		w -= this.extraXOffset;
		h -= this.extraYOffset;

		var canvasXOffset = 0;
		var canvasYOffset = 0;
		if (pos == 'top' || pos == 'bottom')
			canvasXOffset = tabContainerBox.screenX - sv.browser.boxObject.screenX;
		else
			canvasYOffset = tabContainerBox.screenY - sv.browser.boxObject.screenY;

		for (let node = this.tabbarCanvas;
		     node != sv.browser.mTabBox;
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

		w += this.extraXOffset;
		h += this.extraYOffset;

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
		if (sv.browser.getAttribute(this.kTRANSPARENT) != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_FULL]) {
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
				document.getAnonymousElementByAttribute(sv.browser, 'class', sv.kSPLITTER) ;

		var pos = sv.currentTabbarPosition;
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
		if (this.mOwner.isFloating || !this.tabbarCanvas)
			return;

		this.tabbarCanvas.style.display = 'none';
		this.tabbarCanvas.style.margin = 0;
		// zero width (heigh) canvas becomes wrongly size!!
		this.tabbarCanvas.style.width = this.tabbarCanvas.style.height = '1px';
		this.tabbarCanvas.width = this.tabbarCanvas.height = 1;
	},
 
	updateTransparency : function TSTAutoHide_updateTransparency() 
	{
		var sv  = this.mOwner;
		var b   = sv.browser;
		var pos = sv.currentTabbarPosition;
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
			style != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_NONE]) {
			sv.setTabbrowserAttribute(this.kTRANSPARENT, style);
		}
		else {
			sv.removeTabbrowserAttribute(this.kTRANSPARENT);
		}
		sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_APPEARANCE_CHANGE);
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
				if (!this.shouldApplyNewPref) return;
				this.mOwner.browser.setAttribute(this.kMODE+'-normal', value);
				this.updateMode();
				return;

			case 'extensions.treestyletab.tabbar.autoHide.mode.fullscreen':
				if (!this.shouldApplyNewPref) return;
				this.mOwner.browser.setAttribute(this.kMODE+'-fullscreen', value);
				this.updateMode();
				return;

			case 'extensions.treestyletab.tabbar.autoShow.mousemove':
			case 'extensions.treestyletab.tabbar.autoShow.accelKeyDown':
			case 'extensions.treestyletab.tabbar.autoShow.feedback':
				if (this.enabled && this.shouldListenMouseMove)
					this.startListenMouseMove();
				else
					this.endListenMouseMove();
				return;

			case 'extensions.treestyletab.tabbar.autoHide.area':
				this.sensitiveArea = value;
				return;

			case 'extensions.treestyletab.tabbar.width':
			case 'extensions.treestyletab.tabbar.shrunkenWidth':
				window.setTimeout(function(aSelf) {
					aSelf.onTabbarResized();
				}, 0, this);
				return;

			case 'extensions.treestyletab.tabbar.transparent.style':
				return this.updateTransparency();

			case 'extensions.treestyletab.tabbar.togglerSize':
				this.togglerSize = value;
				var toggler = document.getAnonymousElementByAttribute(this.mOwner.browser, 'class', this.kTABBAR_TOGGLER);
				toggler.style.minWidth = toggler.style.minHeight = value+'px';
				if (this.togglerSize <= 0)
					toggler.setAttribute('collapsed', true);
				else
					toggler.removeAttribute('collapsed');
				return;

			case 'browser.fullscreen.autohide':
				if (!window.fullScreen) return;
				this.end();
				this.mode = value ?
						this.getModeForFullScreen() :
						this.kMODE_DISABLED ;
				if (this.mode != this.kMODE_DISABLED)
					this.start();
				return;

			default:
				return;
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

			case this.kEVENT_TYPE_TABBAR_POSITION_CHANGING:
				this.isResizing = false;
				this.clearBG();
				if (this.shouldRedraw)
					this.hide();
				return;

			case this.kEVENT_TYPE_TABBAR_POSITION_CHANGED:
				if (this.enabled)
					window.setTimeout(function(aSelf) {
						aSelf.show();
						aSelf.hide();
					}, 0, this);
				this.updateTransparency();
				return;

			case this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN:
				this.onKeyDown(aEvent.sourceEvent);
				return;

			case this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START:
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

			case this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END:
				this.cancelDelayedShowForShortcut();
				if (this.enabled &&
					this.showHideReason == this.kSHOWN_BY_SHORTCUT)
					this.hide();
				return;

			case this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED:
				this.hide();
				this.endListenMouseMove();
				return;

			case this.kEVENT_TYPE_PRINT_PREVIEW_EXITED:
				if (this.enabled && this.shouldListenMouseMove)
					this.startListenMouseMove();
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
			sv.setTabbrowserAttribute(sv.kRESIZING, true);
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
			sv.removeTabbrowserAttribute(sv.kRESIZING);
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
			!sv.isPopupShown() &&
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
			aEvent.originalTarget &&
			(
				aEvent.originalTarget.ownerDocument == document ||
				aEvent.originalTarget == window
			)
			)
			this.onTabbarResized();
	},
 
	onTabbarResized : function TSTAutoHide_onTabbarResized()
	{
		var sv = this.mOwner;
		if (sv.isFloating || !this.shouldRedraw)
			return;

		switch (sv.currentTabbarPosition)
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
				(tabbarBox = this.getBoxObjectFor(this.mOwner.browser.mTabContainer)) &&
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
		var b  = sv.browser;

		if (this.delayedShowForShortcutDone)
			this.cancelDelayedShowForShortcut();

		if (
			sv.getTabsArray(b).length > 1 &&
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

		this.mOwner.browser.setAttribute(this.kMODE+'-normal', this.getTreePref('tabbar.autoHide.mode'));
		this.mOwner.browser.setAttribute(this.kMODE+'-fullscreen', this.getTreePref('tabbar.autoHide.mode.fullscreen'));
		this.addPrefListener(this);
		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.area');
		this.onPrefChange('extensions.treestyletab.tabbar.transparent.style');
		this.onPrefChange('extensions.treestyletab.tabbar.togglerSize');
		window.setTimeout(function(aSelf) {
			aSelf.onPrefChange('extensions.treestyletab.tabbar.autoHide.mode');
		}, 0, this);

		var b = this.mOwner.browser;
		b.mTabContainer.addEventListener('TabOpen', this, false);
		b.mTabContainer.addEventListener('TabClose', this, false);
		b.mTabContainer.addEventListener('TabMove', this, false);
		b.mTabContainer.addEventListener('select', this, false);
		b.addEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGING, this, false);
		b.addEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED, this, false);
		b.addEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN, this, false);
		b.addEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START, this, false);
		b.addEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);

		if (!this.mOwner.isFloating) {
			let stack = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-stack');
			if (stack) {
				let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
				canvas.setAttribute('style', 'display:none;width:1;height:1;');
				stack.firstChild.appendChild(canvas);
				this.tabbarCanvas = canvas;
				this.clearBG();
			}
		}
	},
 
	destroy : function TSTAutoHide_destroy() 
	{
		this.end();
		this.removePrefListener(this);

		var b = this.mOwner.browser;
		b.mTabContainer.removeEventListener('TabOpen', this, false);
		b.mTabContainer.removeEventListener('TabClose', this, false);
		b.mTabContainer.removeEventListener('TabMove', this, false);
		b.mTabContainer.removeEventListener('select', this, false);
		b.removeEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGING, this, false);
		b.removeEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED, this, false);
		b.removeEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN, this, false);
		b.removeEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START, this, false);
		b.removeEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);
	},
 
	saveCurrentState : function TSTAutoHide_saveCurrentState() 
	{
		var b = this.mOwner.browser;
		var prefs = {
				'tabbar.autoHide.mode' : this.getModeForNormal(b),
				'tabbar.autoHide.mode.fullscreen' : this.getModeForFullScreen(b),
			};
		for (var i in prefs)
		{
			if (this.getTreePref(i) != prefs[i])
				this.setTreePref(i, prefs[i]);
		}
	}
 
}; 
  
// class methods 
	
// mode 
	
TreeStyleTabBrowserAutoHide.getMode = function TSTAutoHide_class_getMode(aTabBrowser) { 
	var b = aTabBrowser || TreeStyleTabService.browser;
	var mode = b.getAttribute(this.prototype.kMODE);
	return mode ? parseInt(mode) : this.prototype.kMODE_DISABLED ;
};
 
TreeStyleTabBrowserAutoHide.__defineGetter__('mode', function() { /* PUBLIC API */ 
	var mode = this.getMode();
	if (mode == this.prototype.kMODE_SHRINK &&
		TreeStyleTabService.currentTabbarPosition != 'left' &&
		TreeStyleTabService.currentTabbarPosition != 'right')
		return this.prototype.kMODE_HIDE;
	return mode;
});
 
TreeStyleTabBrowserAutoHide.__defineSetter__('mode', function(aValue) { 
	var b = aTabBrowser || TreeStyleTabService.browser;
	b.setAttribute(this.prototype.kMODE, aValue);
	return aValue;
});
  
TreeStyleTabBrowserAutoHide.toggleMode = function TSTAutoHide_class_toggleMode(aTabBrowser) { /* PUBLIC API */ 
	var b = aTabBrowser || TreeStyleTabService.browser;

	var key       = 'tabbar.autoHide.mode';
	var toggleKey = 'tabbar.autoHide.mode.toggle';
	if (window.fullScreen) {
		key       += '.fullscreen';
		toggleKey += '.fullscreen';
	}

	var mode = this.getMode(b) == this.prototype.kMODE_DISABLED ?
			TreeStyleTabService.getTreePref(toggleKey) :
			this.prototype.kMODE_DISABLED ;

	TreeStyleTabService.setTreePref(key, mode);
	b.setAttribute(this.prototype.kMODE+'-'+(window.fullScreen ? 'fullscreen' : 'normal' ), mode);
	b.treeStyleTab.autoHide.updateMode();
};
 
// for shortcuts 
	
TreeStyleTabBrowserAutoHide.updateKeyListeners = function TSTAutoHide_class_updateKeyListeners() { 
	if (
		this.getMode() &&
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
    
