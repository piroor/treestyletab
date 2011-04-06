/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is SHIMODA Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2010-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro@p.club.ne.jp>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
 
const EXPORTED_SYMBOLS = ['AutoHideBrowser', 'AutoHideWindow'];

const Cc = Components.classes;
const Ci = Components.interfaces;
 
function AutoHideBrowser(aTabBrowser) 
{
	this.init(aTabBrowser);
}
AutoHideBrowser.prototype = {
	
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
 
	get mode() /* PUBLIC API */ 
	{
		var mode = this.browser.getAttribute(this.kMODE);
		return mode ? parseInt(mode) : this.kMODE_DISABLED ;
	},
	set mode(aValue)
	{
		this.browser.setAttribute(this.kMODE, aValue);
		return aValue;
	},

	getMode : function AHB_getMode(aTabBrowser)
	{
		var b = aTabBrowser || this.browser;
		var mode = b.getAttribute(this.kMODE);
		return mode ? parseInt(mode) : this.kMODE_DISABLED ;
	},
	getModeForNormal : function AHB_getModeForNormal(aTabBrowser)
	{
		var b = aTabBrowser || this.browser;
		return parseInt(b.getAttribute(this.kMODE+'-normal') || this.treeStyleTab.getTreePref('tabbar.autoHide.mode'));
	},
	getModeForFullScreen : function AHB_getModeForFullScreen(aTabBrowser)
	{
		var b = aTabBrowser || this.browser;
		return parseInt(b.getAttribute(this.kMODE+'-fullscreen') || this.treeStyleTab.getTreePref('tabbar.autoHide.mode.fullscreen'));
	},

	get state()
	{
		return this.browser.getAttribute(this.kSTATE) || this.kSTATE_EXPANDED;
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
	
	updateMode : function AHB_updateMode() 
	{
		this.end();
		// update internal property after the appearance of the tab bar is updated.
		var w = this.window;
		w.setTimeout(function(aSelf) {
			aSelf.mode = (w.fullScreen && aSelf.treeStyleTab.getPref('browser.fullscreen.autohide')) ?
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
		var sv = this.treeStyleTab;
		switch (this.mode)
		{
			case this.kMODE_DISABLED:
				return 0;

			case this.kMODE_HIDE:
				let offset = this.width + this.splitterWidth;
				if (sv.position == 'left') {
					offset -= this.togglerSize;
				}
				return offset;

			default:
			case this.kMODE_SHRINK:
				return sv.getTreePref('tabbar.width')
						- sv.getTreePref('tabbar.shrunkenWidth');
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
		var sv = this.treeStyleTab;
		return (
				sv.position == 'left' &&
				this.mode != this.kMODE_DISABLED &&
				this.expanded
			) ? this.XOffset : 0 ;
	},
	get currentYOffset()
	{
		var sv = this.treeStyleTab;
		return (
				sv.position == 'top' &&
				this.mode != this.kMODE_DISABLED &&
				this.expanded
			) ? this.YOffset : 0 ;
	},
 
	start : function AHB_start() 
	{
		if (this.enabled) return;
		this.enabled = true;

		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_EXPANDED);

		b.addEventListener('mousedown', this, true);
		b.addEventListener('mouseup', this, true);
		if (sv.isFloating) {
			sv.tabStrip.addEventListener('mousedown', this, true);
			sv.tabStrip.addEventListener('mouseup', this, true);
		}
		w.addEventListener('resize', this, true);
		w.addEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		w.addEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_EXITED, this, false);
		b.addEventListener('load', this, true);
		b.mPanelContainer.addEventListener('scroll', this, true);
		if (this.shouldListenMouseMove)
			this.startListenMouseMove();
		if (b == w.gBrowser && sv.shouldListenKeyEventsForAutoHide)
			w.TreeStyleTabService.startListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);

		this.clearBG(); /* legacy feature for Firefox 3.6 or olders */
		this.updateTransparency();

		this.showHideInternal();

		b.treeStyleTab.fixTooNarrowTabbar();
	},
 
	end : function AHB_end() 
	{
		if (!this.enabled) return;
		this.enabled = false;

		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		this.show();

		b.removeEventListener('mousedown', this, true);
		b.removeEventListener('mouseup', this, true);
		if (sv.isFloating) {
			sv.tabStrip.removeEventListener('mousedown', this, true);
			sv.tabStrip.removeEventListener('mouseup', this, true);
		}
		w.removeEventListener('resize', this, true);
		w.removeEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		w.removeEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_EXITED, this, false);
		b.removeEventListener('load', this, true);
		b.mPanelContainer.removeEventListener('scroll', this, true);
		this.endListenMouseMove();
		if (b == w.gBrowser)
			w.TreeStyleTabService.endListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);

		this.clearBG(); /* legacy feature for Firefox 3.6 or olders */
		this.updateTransparency();

		if (!sv.isFloating)
			sv.container.style.margin = 0;
		sv.removeTabbrowserAttribute(this.kAUTOHIDE);
		sv.removeTabbrowserAttribute(this.kSTATE);

		if (sv.isVertical)
			sv.setTabStripAttribute('width', this.widthFromMode);
	},
 
	// fullscreen 
	
	startForFullScreen : function AHB_startForFullScreen() 
	{
		this.mode = this.getMode();
		this.end();
		this.mode = this.treeStyleTab.getPref('browser.fullscreen.autohide') ?
				this.getModeForFullScreen() :
				this.kMODE_DISABLED ;
		if (this.mode != this.kMODE_DISABLED) {
			this.start();
			this.treeStyleTab.removeTabbrowserAttribute('moz-collapsed');
		}
	},
 
	endForFullScreen : function AHB_endForFullScreen() 
	{
		this.mode = this.getModeForFullScreen();
		this.end();
		this.mode = this.treeStyleTab.getTreePref('tabbar.autoHide.mode');
		this.treeStyleTab.checkTabsIndentOverflow();
		if (this.mode != this.kMODE_DISABLED)
			this.start();
	},
  
	// mousemove 
	
	startListenMouseMove : function AHB_startListenMouseMove() 
	{
		if (this.mouseMoveListening) return;

		this.browser.addEventListener('mousemove', this, true);

		if (this.treeStyleTab.isFloating)
			this.treeStyleTab.tabStrip.addEventListener('mousemove', this, true);

		this.mouseMoveListening = true;
	},
 
	endListenMouseMove : function AHB_endListenMouseMove() 
	{
		if (!this.mouseMoveListening) return;

		this.browser.removeEventListener('mousemove', this, true);

		if (this.treeStyleTab.isFloating)
			this.treeStyleTab.tabStrip.removeEventListener('mousemove', this, true);

		this.mouseMoveListening = false;
	},
 
	get shouldListenMouseMove() 
	{
		return this.treeStyleTab.getTreePref('tabbar.autoShow.mousemove');
	},
 
	get shouldListenKeyEventsForAutoHide()
	{
		return this.treeStyleTab.getTreePref('tabbar.autoShow.accelKeyDown') ||
				this.treeStyleTab.getTreePref('tabbar.autoShow.tabSwitch');
	},
 
	showHideOnMousemove : function AHB_showHideOnMousemove(aEvent) 
	{
		var w = this.window;
		if ('gestureInProgress' in w && w.gestureInProgress)
			return;

		this.cancelShowHideOnMousemove();

		var sv  = this.treeStyleTab;
		var b   = this.browser;
		var pos = sv.position;
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
			if (pos != 'right' || b.getAttribute(sv.kTAB_INVERTED) == 'true')
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
				sv.getTreePref('tabbar.autoShow.keepShownOnMouseover')
				) {
				this.showHideReason = this.kSHOWN_BY_MOUSEMOVE;
				this.cancelDelayedShowForShortcut();
				this.cancelHideForFeedback();
			}
			else if (
				!shouldKeepShown &&
				sv.getTreePref('tabbar.autoShow.mousemove')
				) {
				this.showHideOnMousemoveTimer = w.setTimeout(
					function(aSelf) {
						aSelf.cancelDelayedShowForShortcut();
						if (aSelf.showHideReason == aSelf.kSHOWN_BY_MOUSEMOVE)
							aSelf.hide(aSelf.kSHOWN_BY_MOUSEMOVE);
					},
					sv.getTreePref('tabbar.autoHide.delay'),
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
			this.showHideOnMousemoveTimer = w.setTimeout(
				function(aSelf) {
					aSelf.cancelDelayedShowForShortcut();
					aSelf.cancelHideForFeedback();
					aSelf.show(aSelf.kSHOWN_BY_MOUSEMOVE);
				},
				sv.getTreePref('tabbar.autoHide.delay'),
				this
			);
		}

		b = null;
		pos = null
		box = null;
		sensitiveArea = null;
		shouldKeepShown = null;
	},
 
	cancelShowHideOnMousemove : function AHB_cancelShowHideOnMousemove() 
	{
		if (this.showHideOnMousemoveTimer) {
			this.window.clearTimeout(this.showHideOnMousemoveTimer);
			this.showHideOnMousemoveTimer = null;
		}
	},
  
	// feedback 
	
	showForFeedback : function AHB_showForFeedback() 
	{
		if (!this.enabled ||
			!this.treeStyleTab.getTreePref('tabbar.autoShow.feedback'))
			return;

		var w = this.window;
		if (this.delayedShowForFeedbackTimer) {
			w.clearTimeout(this.delayedShowForFeedbackTimer);
			this.delayedShowForFeedbackTimer = null;
		}
		this.cancelHideForFeedback();
		this.delayedShowForFeedbackTimer = w.setTimeout(
			function(aSelf) {
				aSelf.delayedShowForFeedbackTimer = null;
				aSelf.delayedShowForFeedback();
			},
			100,
			this
		);
	},
 
	delayedShowForFeedback : function AHB_delayedShowForFeedback() 
	{
		this.show(this.kSHOWN_BY_FEEDBACK);
		this.cancelHideForFeedback();
		this.delayedHideTabbarForFeedbackTimer = this.window.setTimeout(
			function(aSelf) {
				aSelf.delayedHideTabbarForFeedbackTimer = null;
				if (aSelf.showHideReason == aSelf.kSHOWN_BY_FEEDBACK)
					aSelf.hide();
			},
			this.treeStyleTab.getTreePref('tabbar.autoShow.feedback.delay'),
			this
		);
	},
 
	cancelHideForFeedback : function AHB_cancelHideForFeedback() 
	{
		if (this.delayedHideTabbarForFeedbackTimer) {
			this.window.clearTimeout(this.delayedHideTabbarForFeedbackTimer);
			this.delayedHideTabbarForFeedbackTimer = null;
		}
	},
  
	setWidth : function AHB_setWidth(aWidth, aForceExpanded) 
	{
		if (aForceExpanded ||
			this.expanded ||
			this.mode !=  this.kMODE_SHRINK)
			this.treeStyleTab.setTreePref('tabbar.width', this.treeStyleTab.maxTabbarWidth(aWidth));
		else
			this.treeStyleTab.setTreePref('tabbar.shrunkenWidth', this.treeStyleTab.maxTabbarWidth(aWidth));
	},
 
	updateMenuItem : function AHB_updateMenuItem(aNode) 
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
			this._width = this.treeStyleTab.tabStrip.boxObject.width || this._width;
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
					this.treeStyleTab.getTreePref('tabbar.shrunkenWidth') :
					this.treeStyleTab.getTreePref('tabbar.width') ;
	},
	get placeHolderWidthFromMode()
	{
		return (this.mode == this.kMODE_SHRINK) ?
					this.treeStyleTab.getTreePref('tabbar.shrunkenWidth') :
					this.treeStyleTab.getTreePref('tabbar.width') ;
	},
  
	get height() 
	{
		if (this.expanded) {
			this._height = this.treeStyleTab.tabStrip.boxObject.height;
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
			var splitter = this.document.getAnonymousElementByAttribute(this.browser, 'class', this.treeStyleTab.kSPLITTER);
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
 
	showHideInternal : function AHB_showHideInternal(aReason) 
	{
		var sv = this.treeStyleTab;
		if (!sv.isFloating)
			sv.stopRendering();

		var b   = this.browser;
		var pos = sv.position;

		if (this.expanded) { // to be hidden or shrunken
			this.onHiding();
			this.showHideReason = aReason || this.kSHOWN_BY_UNKNOWN;
			this.resetContentAreas(); /* legacy feature for Firefox 3.6 or olders */
		}
		else { // to be shown or expanded
			this.onShowing();
			this.showHideReason = aReason || this.kSHOWN_BY_UNKNOWN;
		}

		this.fireStateChangingEvent();

		if (this.expanded) {
			sv.setTabbrowserAttribute(this.kAUTOHIDE, 'show');
			this.redrawContentArea(); /* legacy feature for Firefox 3.6 or olders */
		}
		b.mTabContainer.adjustTabstrip();
		sv.checkTabsIndentOverflow();

		this.window.setTimeout(function(aSelf) {
			aSelf.redrawContentArea(); /* legacy feature for Firefox 3.6 or olders */
			aSelf.fireStateChangeEvent();
			if (!sv.isFloating)
				sv.startRendering();
		}, 0, this);
	},
	
	show : function AHB_show(aReason) /* PUBLIC API */ 
	{
		if (!this.expanded)
			this.showHideInternal(aReason);
	},
 
	hide : function AHB_hide(aReason) /* PUBLIC API */ 
	{
		if (this.expanded)
			this.showHideInternal(aReason);
	},
 
	onShowing : function AHB_onShowing() 
	{
		var sv  = this.treeStyleTab;
		var b   = this.browser;
		var pos = sv.position;
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
					let width = sv.maxTabbarWidth(sv.getTreePref('tabbar.width'));
					if (sv.isFloating) // Firefox 4.0-
						sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_AUTOHIDE);
					else // -Firefox 3.6
						sv.setTabStripAttribute('width', width);
				}
				break;
		}
	},
 
	onHiding : function AHB_onHiding() 
	{
		var sv  = this.treeStyleTab;
		var b   = this.browser;
		var pos = sv.position;

		var box = (sv.tabStripPlaceHolder || sv.tabStrip).boxObject;

		this.tabbarHeight = box.height;
		this.width = box.width || this.width;
		var splitter = this.document.getAnonymousElementByAttribute(b, 'class', sv.kSPLITTER);
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
					sv.setTabStripAttribute('width', sv.getTreePref('tabbar.shrunkenWidth'));
				sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_AUTOHIDE);
				break;
		}
	},
 
	fireStateChangingEvent : function AHB_fireStateChangingEvent() 
	{
		var data = {
				shown : this.expanded,
				state : this.state
			};

		/* PUBLIC API */
		this.treeStyleTab.fireDataContainerEvent(this.treeStyleTab.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGING, this.browser, true, false, data);
		// for backward compatibility
		this.treeStyleTab.fireDataContainerEvent(this.treeStyleTab.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGING.replace(/^nsDOM/, ''), this.browser, true, false, data);
	},
 
	fireStateChangeEvent : function AHB_fireStateChangeEvent() 
	{
		var data = {
				shown   : this.expanded,
				state   : this.state,
				xOffset : this.XOffset,
				yOffset : this.YOffset
			};

		/* PUBLIC API */
		this.treeStyleTab.fireDataContainerEvent(this.treeStyleTab.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGE, this.browser, true, false, data);
		// for backward compatibility
		this.treeStyleTab.fireDataContainerEvent(this.treeStyleTab.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGE.replace(/^nsDOM/, ''), this.browser, true, false, data);
	},
  
	redrawContentArea : function AHB_redrawContentArea() /* legacy feature for Firefox 3.6 or olders */ 
	{
		var sv = this.treeStyleTab;
		if (sv.isFloating)
			return;

		var pos = sv.position;
		var w = this.window;
		try {
			var v = this.browser.markupDocumentViewer;
			if (this.shouldRedraw) {
				this.drawBG();

				v.move(w.outerWidth, w.outerHeight);
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
				v.move(w.outerWidth, w.outerHeight);
				v.move(-this.extraXOffset, -this.extraYOffset);
			}
		}
		catch(e) {
			dump(e);
		}
	},
	redrawContentAreaWithDelay : function AHB_redrawContentAreaWithDelay() /* legacy feature for Firefox 3.6 or olders */
	{
		if (this.treeStyleTab.isFloating)
			return;

		this.window.setTimeout(function(aSelf) {
			aSelf.redrawContentArea();
		}, 0, this);
	},
 
	resetContentAreas : function AHB_resetContentAreas() /* legacy feature for Firefox 3.6 or olders */ 
	{
		if (this.treeStyleTab.isFloating)
			return;

		this.treeStyleTab.getTabsArray(this.browser).forEach(function(aTab) {
			try {
				aTab.linkedBrowser.markupDocumentViewer.move(0, 0);
			}
			catch(e) {
			}
		}, this);
	},
 
	get shouldRedraw() /* legacy feature for Firefox 3.6 or olders */ 
	{
		return !this.treeStyleTab.isFloating && this.enabled && this.expanded;
	},
 
	drawBG : function AHB_drawBG() /* legacy feature for Firefox 3.6 or olders */ 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var canvas = this.tabbarCanvas;
		if (sv.isFloating || !canvas || this.isResizing)
			return;

		var alpha = Number(sv.getTreePref('tabbar.transparent.partialTransparency'));
		if (isNaN(alpha)) alpha = 0.25;
		if (alpha >= 1)
			return;

		canvas.style.width = (canvas.width = 1)+'px';
		canvas.style.height = (canvas.height = 1)+'px';

		var pos = sv.position;

		var frame = b.contentWindow;
		var tabContainerBox = b.mTabContainer.boxObject;
		var browserBox = b.mCurrentBrowser.boxObject;
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
			canvasXOffset = tabContainerBox.screenX - b.boxObject.screenX;
		else
			canvasYOffset = tabContainerBox.screenY - b.boxObject.screenY;

		for (let node = canvas;
		     node != b.mTabBox;
		     node = node.parentNode)
		{
			let style = this.window.getComputedStyle(node, null);
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

		canvas.style.display = 'inline';
		canvas.style.margin = (yOffset)+'px 0 0 '+(xOffset)+'px';
		canvas.style.width = (canvas.width = w)+'px';
		canvas.style.height = (canvas.height = h)+'px';

		w += this.extraXOffset;
		h += this.extraYOffset;

		var ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, w, h);
		ctx.save();
		if (this.mode == this.kMODE_SHRINK) {
			var offset = sv.getTreePref('tabbar.shrunkenWidth') + this.splitterWidth;
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
		ctx.globalAlpha = alpha;
		ctx.fillStyle = 'black';
		ctx.fillRect(0, 0, w, h);
		ctx.restore();
	},
	
	get splitterBorderColor() /* legacy feature for Firefox 3.6 or olders */ 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;
		var borderNode = sv.getTreePref(
					sv.isVertical ?
						'tabbar.fixed.vertical' :
						'tabbar.fixed.horizontal'
				) ?
				sv.tabStrip :
				this.document.getAnonymousElementByAttribute(b, 'class', sv.kSPLITTER) ;

		var pos = sv.position;
		var prop = pos == 'left' ? 'right' :
				pos == 'right' ? 'left' :
				pos == 'top' ? 'bottom' :
				'top' ;

		var borderColor = w.getComputedStyle(borderNode, null).getPropertyValue('-moz-border-'+prop+'-colors');
		if (borderColor == 'none')
			borderRight = w.getComputedStyle(borderNode, null).getPropertyValue('border-'+prop+'-color');

		/rgba?\(([^,]+),([^,]+),([^,]+)(,.*)?\)/.test(borderColor);

		return 'rgb('+[
				parseInt(parseInt(RegExp.$1) * 0.8),
				parseInt(parseInt(RegExp.$2) * 0.8),
				parseInt(parseInt(RegExp.$3) * 0.8)
			].join(',')+')';
	},
 
	getZoomForFrame : function AHB_getZoomForFrame(aFrame) /* legacy feature for Firefox 3.6 or olders */ 
	{
		var zoom = aFrame
				.QueryInterface(Ci.nsIInterfaceRequestor)
				.getInterface(Ci.nsIWebNavigation)
				.QueryInterface(Ci.nsIDocShell)
				.contentViewer
				.QueryInterface(Ci.nsIMarkupDocumentViewer)
				.fullZoom;
		return (zoom * 1000 % 1) ? zoom+0.025 : zoom ;
	},
  
	clearBG : function AHB_clearBG() /* legacy feature for Firefox 3.6 or olders */ 
	{
		var canvas = this.tabbarCanvas;
		if (this.treeStyleTab.isFloating || !canvas)
			return;

		canvas.style.display = 'none';
		canvas.style.margin = 0;
		// zero width (heigh) canvas becomes wrongly size!!
		canvas.style.width = canvas.style.height = '1px';
		canvas.width = canvas.height = 1;
	},
 
	updateTransparency : function AHB_updateTransparency() 
	{
		var sv  = this.treeStyleTab;
		sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_APPEARANCE_CHANGE);
	},
  
	// event handling 
	
	observe : function AHB_observe(aSubject, aTopic, aData) 
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
 
	onPrefChange : function AHB_onPrefChange(aPrefName) 
	{
		var value = this.treeStyleTab.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.autoHide.mode':
				if (!this.window.TreeStyleTabService.shouldApplyNewPref) return;
				this.browser.setAttribute(this.kMODE+'-normal', value);
				this.updateMode();
				return;

			case 'extensions.treestyletab.tabbar.autoHide.mode.fullscreen':
				if (!this.window.TreeStyleTabService.shouldApplyNewPref) return;
				this.browser.setAttribute(this.kMODE+'-fullscreen', value);
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
				this.window.setTimeout(function(aSelf) {
					aSelf.onTabbarResized();
				}, 0, this);
				return;

			case 'extensions.treestyletab.tabbar.togglerSize':
				this.togglerSize = value;
				var toggler = this.document.getAnonymousElementByAttribute(this.browser, 'class', this.treeStyleTab.kTABBAR_TOGGLER);
				toggler.style.minWidth = toggler.style.minHeight = value+'px';
				if (this.togglerSize <= 0)
					toggler.setAttribute('collapsed', true);
				else
					toggler.removeAttribute('collapsed');
				return;

			case 'browser.fullscreen.autohide':
				if (!this.window.fullScreen) return;
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
  
	handleEvent : function AHB_handleEvent(aEvent) 
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
				if (!this.treeStyleTab.subTreeMovingCount && !this.treeStyleTab.internallyTabMovingCount)
					this.showForFeedback();
				return;

			case 'select':
				if (this.shouldRedraw)
					this.redrawContentArea();
				if (!this.window.TreeStyleTabService.accelKeyPressed)
					this.showForFeedback();
				return;

			case this.treeStyleTab.kEVENT_TYPE_TABBAR_POSITION_CHANGING:
				this.isResizing = false;
				this.clearBG(); /* legacy feature for Firefox 3.6 or olders */
				if (this.shouldRedraw) /* legacy feature for Firefox 3.6 or olders */
					this.hide();
				return;

			case this.treeStyleTab.kEVENT_TYPE_TABBAR_POSITION_CHANGED:
				if (this.enabled)
					this.window.setTimeout(function(aSelf) {
						aSelf.show();
						aSelf.hide();
					}, 0, this);
				this.updateTransparency();
				return;

			case this.treeStyleTab.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN:
				this.onKeyDown(aEvent.getData('sourceEvent'));
				return;

			case this.treeStyleTab.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START:
				this.cancelDelayedShowForShortcut();
				if (this.enabled &&
					this.treeStyleTab.getTreePref('tabbar.autoShow.tabSwitch') &&
					(
						aEvent.getData('scrollDown') ||
						aEvent.getData('scrollUp') ||
						( // when you release "shift" key
							this.expanded &&
							aEvent.getData('standBy') &&
							aEvent.getData('onlyShiftKey')
						)
					))
					this.show(this.kSHOWN_BY_SHORTCUT);
				return;

			case this.treeStyleTab.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END:
				this.cancelDelayedShowForShortcut();
				if (this.enabled &&
					this.showHideReason == this.kSHOWN_BY_SHORTCUT)
					this.hide();
				return;

			case this.treeStyleTab.kEVENT_TYPE_PRINT_PREVIEW_ENTERED:
				this.hide();
				this.endListenMouseMove();
				return;

			case this.treeStyleTab.kEVENT_TYPE_PRINT_PREVIEW_EXITED:
				if (this.enabled && this.shouldListenMouseMove)
					this.startListenMouseMove();
				return;
		}
	},
	
	onMouseDown : function AHB_onMouseDown(aEvent) 
	{
		var sv = this.treeStyleTab;
		var w = this.window;
		if (
			!this.isResizing &&
			sv.evaluateXPath(
				'ancestor-or-self::*[@class="'+sv.kSPLITTER+'"]',
				aEvent.originalTarget || aEvent.target,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue
			) {
			this.isResizing = true;
			this.clearBG(); /* legacy feature for Firefox 3.6 or olders */
			sv.setTabbrowserAttribute(sv.kRESIZING, true);
			/* canvasを非表示にしたのと同じタイミングでリサイズを行うと、
			   まだ内部的にcanvasの大きさが残ったままなので、その大きさ以下に
			   タブバーの幅を縮められなくなる。手動でイベントを再送してやると
			   この問題を防ぐことができる。 */
			aEvent.preventDefault();
			aEvent.stopPropagation();
			var flags = 0;
			const nsIDOMNSEvent = Ci.nsIDOMNSEvent;
			if (aEvent.altKey) flags |= nsIDOMNSEvent.ALT_MASK;
			if (aEvent.ctrlKey) flags |= nsIDOMNSEvent.CONTROL_MASK;
			if (aEvent.shiftKey) flags |= nsIDOMNSEvent.SHIFT_MASK;
			if (aEvent.metaKey) flags |= nsIDOMNSEvent.META_MASK;
			w.setTimeout(function(aX, aY, aButton, aDetail) {
				w.QueryInterface(Ci.nsIInterfaceRequestor)
					.getInterface(Ci.nsIDOMWindowUtils)
					.sendMouseEvent('mousedown', aX, aY, aButton, aDetail, flags);
				flags = null;
			}, 0, aEvent.clientX, aEvent.clientY, aEvent.button, aEvent.detail);
		}
		this.cancelShowHideOnMousemove();
		if (
			this.enabled &&
			this.expanded &&
			(
				aEvent.originalTarget.ownerDocument != this.document ||
				!sv.getTabBrowserFromChild(aEvent.originalTarget)
			)
			)
			this.hide();
		this.lastMouseDownTarget = aEvent.originalTarget.localName;
	},
 
	onMouseUp : function AHB_onMouseUp(aEvent) 
	{
		var sv = this.treeStyleTab;
		if (aEvent.originalTarget &&
			sv.evaluateXPath(
				'ancestor-or-self::*[@class="'+sv.kSPLITTER+'"]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue) {
			this.isResizing = false;
			sv.removeTabbrowserAttribute(sv.kRESIZING);
			this.window.setTimeout(function(aSelf) { /* legacy feature for Firefox 3.6 or olders */
				if (!aSelf.shouldRedraw) return;
				aSelf.redrawContentArea();
				aSelf.drawBG();
			}, 0, this);
		}
		this.cancelShowHideOnMousemove();
		this.lastMouseDownTarget = null;
	},
 
	handleMouseMove : function AHB_handleMouseMove(aEvent) 
	{
		var sv = this.treeStyleTab;
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
 
	onResize : function AHB_onResize(aEvent) /* legacy feature for Firefox 3.6 or olders */ 
	{
		if (
			aEvent.originalTarget &&
			(
				aEvent.originalTarget.ownerDocument == this.document ||
				aEvent.originalTarget == this.window
			)
			)
			this.onTabbarResized();
	},
 
	onTabbarResized : function AHB_onTabbarResized() /* legacy feature for Firefox 3.6 or olders */ 
	{
		var sv = this.treeStyleTab;
		if (sv.isFloating || !this.shouldRedraw)
			return;

		switch (sv.position)
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
 
	onScroll : function AHB_onScroll(aEvent) 
	{
		var node = aEvent.originalTarget;
		if ((node && node.ownerDocument == this.document) || !this.shouldRedraw) return;

		var tabbarBox, nodeBox;
		if (
			!(node instanceof Ci.nsIDOMElement) ||
			(
				(tabbarBox = this.treeStyleTab.getBoxObjectFor(this.browser.mTabContainer)) &&
				(nodeBox = this.treeStyleTab.getBoxObjectFor(node)) &&
				tabbarBox.screenX <= nodeBox.screenX + nodeBox.width &&
				tabbarBox.screenX + tabbarBox.width >= nodeBox.screenX &&
				tabbarBox.screenY <= nodeBox.screenY + nodeBox.height &&
				tabbarBox.screenY + tabbarBox.height >= nodeBox.screenY
			)
			)
			this.redrawContentArea();
	},
 
	onKeyDown : function AHB_onKeyDown(aEvent) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		if (this.delayedShowForShortcutDone)
			this.cancelDelayedShowForShortcut();

		if (
			sv.getTabsArray(b).length > 1 &&
			!aEvent.altKey &&
			w.TreeStyleTabService.accelKeyPressed
			) {
			if (this.enabled &&
				sv.getTreePref('tabbar.autoShow.accelKeyDown') &&
				!this.expanded &&
				!this.delayedAutoShowTimer &&
				!this.delayedShowForShortcutTimer) {
				this.delayedShowForShortcutTimer = w.setTimeout(
					function(aSelf) {
						aSelf.delayedShowForShortcutDone = true;
						aSelf.show(aSelf.kSHOWN_BY_SHORTCUT);
						sv = null;
						b = null;
					},
					sv.getTreePref('tabbar.autoShow.accelKeyDown.delay'),
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
	
	cancelDelayedShowForShortcut : function AHB_cancelDelayedShowForShortcut() 
	{
		if (this.delayedShowForShortcutTimer) {
			this.window.clearTimeout(this.delayedShowForShortcutTimer);
			this.delayedShowForShortcutTimer = null;
		}
	},
 
	delayedShowForShortcutTimer : null, 
	delayedShowForShortcutDone : true,
    
	init : function AHB_init(aTabBrowser) 
	{
		this.browser      = aTabBrowser;
		this.document     = aTabBrowser.ownerDocument;
		this.window       = this.document.defaultView;
		this.treeStyleTab = aTabBrowser.treeStyleTab;

		var sv = this.treeStyleTab;
		var b  = this.browser;

		this.enabled = false;
		this.mouseMoveListening = false;
		this.showHideReason = 0;
		this.lastMouseDownTarget = null;
		this.isResizing = false;

		this.showHideOnMousemoveTimer = null;
		this.delayedShowForFeedbackTimer = null;

		b.setAttribute(this.kMODE+'-normal', sv.getTreePref('tabbar.autoHide.mode'));
		b.setAttribute(this.kMODE+'-fullscreen', sv.getTreePref('tabbar.autoHide.mode.fullscreen'));
		sv.addPrefListener(this);
		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.area');
		this.onPrefChange('extensions.treestyletab.tabbar.togglerSize');
		this.window.setTimeout(function(aSelf) {
			aSelf.onPrefChange('extensions.treestyletab.tabbar.autoHide.mode');
		}, 0, this);

		b.mTabContainer.addEventListener('TabOpen', this, false);
		b.mTabContainer.addEventListener('TabClose', this, false);
		b.mTabContainer.addEventListener('TabMove', this, false);
		b.mTabContainer.addEventListener('select', this, false);
		b.addEventListener(sv.kEVENT_TYPE_TABBAR_POSITION_CHANGING, this, false);
		b.addEventListener(sv.kEVENT_TYPE_TABBAR_POSITION_CHANGED, this, false);
		b.addEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN, this, false);
		b.addEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START, this, false);
		b.addEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);

		if (!sv.isFloating) { /* legacy feature for Firefox 3.6 or olders */
			let stack = this.document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-stack');
			if (stack) {
				let canvas = this.document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
				canvas.setAttribute('style', 'display:none;width:1;height:1;');
				stack.firstChild.appendChild(canvas);
				this.tabbarCanvas = canvas;
				this.clearBG();
			}
		}
	},
 
	destroy : function AHB_destroy() 
	{
		this.end();
		this.treeStyleTab.removePrefListener(this);

		var sv = this.treeStyleTab;
		var b  = this.browser;
		b.mTabContainer.removeEventListener('TabOpen', this, false);
		b.mTabContainer.removeEventListener('TabClose', this, false);
		b.mTabContainer.removeEventListener('TabMove', this, false);
		b.mTabContainer.removeEventListener('select', this, false);
		b.removeEventListener(sv.kEVENT_TYPE_TABBAR_POSITION_CHANGING, this, false);
		b.removeEventListener(sv.kEVENT_TYPE_TABBAR_POSITION_CHANGED, this, false);
		b.removeEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN, this, false);
		b.removeEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START, this, false);
		b.removeEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);

		delete this.treeStyleTab;
		delete this.browser;
		delete this.document;
		delete this.window;
	},
 
	saveCurrentState : function AHB_saveCurrentState() 
	{
		var b = this.browser;
		var prefs = {
				'tabbar.autoHide.mode' : this.getModeForNormal(b),
				'tabbar.autoHide.mode.fullscreen' : this.getModeForFullScreen(b),
			};
		for (var i in prefs)
		{
			if (this.treeStyleTab.getTreePref(i) != prefs[i])
				this.treeStyleTab.setTreePref(i, prefs[i]);
		}
	}
 
}; 
  
function AutoHideWindow(aWindow) 
{
	this.init(aWindow);
}
AutoHideWindow.prototype = {
	get browser()
	{
		return this.treeStyleTab.browser;
	},
	
// mode 
	
	getMode : function AHW_getMode(aTabBrowser) 
	{
		var b = aTabBrowser || this.browser;
		var mode = b.getAttribute(AutoHideBrowser.prototype.kMODE);
		return mode ? parseInt(mode) : AutoHideBrowser.prototype.kMODE_DISABLED ;
	},
 
	get mode() /* PUBLIC API */ 
	{
		var mode = this.getMode();
		if (mode == AutoHideBrowser.prototype.kMODE_SHRINK &&
			this.treeStyleTab.position != 'left' &&
			this.treeStyleTab.position != 'right')
			return AutoHideBrowser.prototype.kMODE_HIDE;
		return mode;
	},
 
	set mode(aValue) 
	{
		var b = aTabBrowser || this.browser;
		b.setAttribute(AutoHideBrowser.prototype.kMODE, aValue);
		return aValue;
	},
  
	toggleMode : function AHW_toggleMode(aTabBrowser) /* PUBLIC API */ 
	{
		var b = aTabBrowser || this.browser;
		var w = this.window;

		var key       = 'tabbar.autoHide.mode';
		var toggleKey = 'tabbar.autoHide.mode.toggle';
		if (w.fullScreen) {
			key       += '.fullscreen';
			toggleKey += '.fullscreen';
		}

		var mode = this.getMode(b) == AutoHideBrowser.prototype.kMODE_DISABLED ?
				this.treeStyleTab.getTreePref(toggleKey) :
				AutoHideBrowser.prototype.kMODE_DISABLED ;

		this.treeStyleTab.setTreePref(key, mode);
		b.setAttribute(AutoHideBrowser.prototype.kMODE+'-'+(w.fullScreen ? 'fullscreen' : 'normal' ), mode);
		b.treeStyleTab.autoHide.updateMode();
	},
 
// for shortcuts 
	
	updateKeyListeners : function AHW_updateKeyListeners() 
	{
		if (
			this.getMode() &&
			this.shouldListenKeyEvents
			) {
			this.treeStyleTab.startListenKeyEventsFor(this.treeStyleTab.LISTEN_FOR_AUTOHIDE);
		}
		else {
			this.treeStyleTab.endListenKeyEventsFor(this.treeStyleTab.LISTEN_FOR_AUTOHIDE);
		}
		var w = this.window;
		w.setTimeout(function() {
			if (w.windowState != Ci.nsIDOMChromeWindow.STATE_NORMAL) return;
			var count = 0;
			var resizeTimer = w.setInterval(function(){
				if (++count > 100 || w.innerHeight > 0) {
					w.clearInterval(resizeTimer);
					w.resizeBy(-1,-1);
					w.resizeBy(1,1);
				}
			}, 250);
		}, 0);
	},
	
	get shouldListenKeyEvents() 
	{
		return !this.treeStyleTab.ctrlTabPreviewsEnabled &&
				(
					this.treeStyleTab.getTreePref('tabbar.autoShow.accelKeyDown') ||
					this.treeStyleTab.getTreePref('tabbar.autoShow.tabSwitch') ||
					this.treeStyleTab.getTreePref('tabbar.autoShow.feedback')
				);
	},
   
	init : function AHB_init(aWindow) 
	{
		this.window       = aWindow;
		this.document     = aWindow.document;
		this.treeStyleTab = aWindow.TreeStyleTabService;
	},
 
	destroy : function AHB_destroy() 
	{
		delete this.treeStyleTab;
		delete this.document;
		delete this.window;
	}
 
}; 
  
