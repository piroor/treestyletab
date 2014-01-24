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
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2010-2013
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
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

const DEBUG = false;

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');

XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');

XPCOMUtils.defineLazyGetter(this, 'window', function() {
	Cu.import('resource://treestyletab-modules/lib/namespace.jsm');
	return getNamespaceFor('piro.sakura.ne.jp');
});
XPCOMUtils.defineLazyGetter(this, 'prefs', function() {
	Cu.import('resource://treestyletab-modules/lib/prefs.js');
	return window['piro.sakura.ne.jp'].prefs;
});


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
	kSHOWN_BY_ANY_REASON : (1 << 0) | (1 << 1) | (1 << 2),
	kSHOWHIDE_BY_START  : 1 << 3,
	kSHOWHIDE_BY_END    : 1 << 4,
	kSHOWHIDE_BY_POSITION_CHANGE : 1 << 5,
	kSHOWHIDE_BY_RESIZE : 1 << 6,
	kSHOWHIDE_BY_API    : 1 << 8,
	kHIDDEN_BY_CLICK    : 1 << 7,
 
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
		return parseInt(b.getAttribute(this.kMODE+'-normal') || utils.getTreePref('tabbar.autoHide.mode'));
	},
	getModeForFullScreen : function AHB_getModeForFullScreen(aTabBrowser)
	{
		var b = aTabBrowser || this.browser;
		return parseInt(b.getAttribute(this.kMODE+'-fullscreen') || utils.getTreePref('tabbar.autoHide.mode.fullscreen'));
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
			aSelf.mode = (w.fullScreen && prefs.getPref('browser.fullscreen.autohide')) ?
					aSelf.getModeForFullScreen() :
					aSelf.getModeForNormal() ;
			if (aSelf.mode != aSelf.kMODE_DISABLED)
				aSelf.start();
		}, 0, this);
	},
  
	togglerSize : 0, 
	sensitiveArea : 7,
	contentAreaScreenEnabled : true,

	closeButtonsMode : -1,
	CLOSE_BUTTONS_ONLY_ON_CURRENT_TAB : 0,
	CLOSE_BUTTONS_ON_ALL_TABS         : 1,
	CLOSE_BUTTONS_DISABLED            : 2,
	CLOSE_BUTTONS_ON_TABBAR           : 3,
 
	get XOffset() 
	{
		var sv = this.treeStyleTab;
		switch (this.mode)
		{
			case this.kMODE_DISABLED:
				return 0;

			case this.kMODE_HIDE:
				let offset = this.width + this.splitterWidth;
				let resizer = this.resizer;
				if (sv.position == 'left') {
					offset += this.togglerSize;
					if (resizer)
						offset += resizer.boxObject.width;
				}
				else if (sv.position == 'right') {
					offset -= this.togglerSize;
					if (resizer)
						offset -= resizer.boxObject.width;
				}
				return offset;

			default:
			case this.kMODE_SHRINK:
				return utils.getTreePref('tabbar.width')
						- utils.getTreePref('tabbar.shrunkenWidth');
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
 
	get screen()
	{
		return this.document.getElementById('treestyletab-autohide-content-area-screen');
	},
	get resizer()
	{
		return this.document.getElementById('treestyletab-tabbar-resizer-splitter');
	},
 
	start : function AHB_start(aReason) 
	{
		if (this.enabled) return;
		this.enabled = true;
		aReason = aReason || 0;

		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		this.screen.hidePopup();

		sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_EXPANDED);

		if (!(aReason & this.kSHOWHIDE_BY_API)) {
			b.addEventListener('mousedown', this, true);
			b.addEventListener('mouseup', this, true);
			b.addEventListener('dragover', this, true);
			b.addEventListener('dragleave', this, true);
			sv.tabStrip.addEventListener('mousedown', this, true);
			sv.tabStrip.addEventListener('mouseup', this, true);
			if (this.shouldListenMouseMove)
				this.startListenMouseMove();
			if (b == w.gBrowser && sv.shouldListenKeyEventsForAutoHide)
				w.TreeStyleTabService.startListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);
			this.userActionListening = true;
		}
		w.addEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		w.addEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_EXITED, this, false);

		this.updateTransparency();

		this.showHideInternal(this.kSHOWHIDE_BY_START | aReason);

		b.treeStyleTab.fixTooNarrowTabbar();
	},
 
	end : function AHB_end() 
	{
		if (!this.enabled) return;
		this.enabled = false;

		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		this.show(this.kSHOWHIDE_BY_END);

		this.screen.hidePopup();

		if (this.userActionListening) {
			b.removeEventListener('mousedown', this, true);
			b.removeEventListener('mouseup', this, true);
			b.removeEventListener('dragover', this, true);
			b.removeEventListener('dragleave', this, true);
			sv.tabStrip.removeEventListener('mousedown', this, true);
			sv.tabStrip.removeEventListener('mouseup', this, true);
			this.endListenMouseMove();
			if (b == w.gBrowser)
				w.TreeStyleTabService.endListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);
			this.userActionListening = false;
		}
		w.removeEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		w.removeEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_EXITED, this, false);

		this.updateTransparency();

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
		this.mode = prefs.getPref('browser.fullscreen.autohide') ?
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
		this.mode = utils.getTreePref('tabbar.autoHide.mode');
		this.treeStyleTab.checkTabsIndentOverflow();
		if (this.mode != this.kMODE_DISABLED)
			this.start();
	},
  
	// mousemove 
	
	startListenMouseMove : function AHB_startListenMouseMove() 
	{
		if (this.mouseMoveListening) return;

		this.browser.addEventListener('mousemove', this, true);
		this.screen.addEventListener('mousemove', this, true);
		this.treeStyleTab.tabStrip.addEventListener('mousemove', this, true);

		this.mouseMoveListening = true;
	},
 
	endListenMouseMove : function AHB_endListenMouseMove() 
	{
		if (!this.mouseMoveListening) return;

		this.browser.removeEventListener('mousemove', this, true);
		this.screen.removeEventListener('mousemove', this, true);
		this.treeStyleTab.tabStrip.removeEventListener('mousemove', this, true);

		this.mouseMoveListening = false;
	},
 
	get shouldListenMouseMove() 
	{
		return utils.getTreePref('tabbar.autoShow.mousemove');
	},
 
	get shouldListenKeyEventsForAutoHide()
	{
		return utils.getTreePref('tabbar.autoShow.accelKeyDown') ||
				utils.getTreePref('tabbar.autoShow.tabSwitch');
	},
 
	showHideOnMouseMove : function AHB_showHideOnMouseMove(aEvent) 
	{
		var position = this.getMousePosition(aEvent);
		if (position == this.MOUSE_POSITION_UNKNOWN)
			return;

		this.cancelShowHideOnMouseMove();
		this.showHideContentsAreaScreen();

		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		var shouldShow = position & this.MOUSE_POSITION_SENSITIVE;
		if (this.expanded) { // currently shown, let's hide it.
			if (shouldShow) {
				this.show(this.kSHOWN_BY_MOUSEMOVE);
				this.cancelDelayedShowForShortcut();
			}
			else if (
				!shouldShow &&
				utils.getTreePref('tabbar.autoShow.mousemove')
				) {
				this.showHideOnMouseMoveTimer = w.setTimeout(
					function(aSelf) {
						aSelf.cancelDelayedShowForShortcut();
						aSelf.hide(aSelf.kSHOWN_BY_MOUSEMOVE);
					},
					utils.getTreePref('tabbar.autoHide.delay'),
					this
				);
			}
		}
		else if (shouldShow) { // currently shown, let's show it.
			this.showHideOnMouseMoveTimer = w.setTimeout(
				function(aSelf) {
					aSelf.cancelDelayedShowForShortcut();
					aSelf.show(aSelf.kSHOWN_BY_MOUSEMOVE);
				},
				utils.getTreePref('tabbar.autoHide.delay'),
				this
			);
		}

		b = null;
	},
	getMousePosition : function AHB_getMousePosition(aEvent) 
	{
		var w = this.window;
		if ('gestureInProgress' in w && w.gestureInProgress)
			return this.MOUSE_POSITION_UNKNOWN;

		var sv  = this.treeStyleTab;
		var b   = this.browser;
		var pos = sv.position;
		var box = this.getContentsAreaBox();

		var sensitiveArea = this.sensitiveArea;
		if (this.shrunken) {
			let clickable;
			let resizable = !sv.fixed;
			if (resizable &
				this.widthFromMode > 24 &&
				(clickable = this.getNearestClickableBox(aEvent))) {
				/* For resizing of shrunken tab bar and clicking closeboxes,
				   we have to shrink sensitive area. */
				sensitiveArea = -(clickable.width + clickable.padding);
			}
			else if (resizable && this.resizer)
				sensitiveArea = -this.resizer.boxObject.width;
			else
				sensitiveArea = 0;
		}

		if (
			pos == 'left' ?
				(aEvent.screenX > box.screenX + sensitiveArea) :
			pos == 'right' ?
				(aEvent.screenX < box.screenX + box.width - sensitiveArea) :
			pos == 'bottom' ?
				(aEvent.screenY < box.screenY + box.height - sensitiveArea) :
				(aEvent.screenY > box.screenY + sensitiveArea)
			) {
			return this.MOUSE_POSITION_OUTSIDE;
		}

		if (
			pos == 'left' ?
				(aEvent.screenX <= box.screenX - sensitiveArea) :
			pos == 'right' ?
				(aEvent.screenX >= box.screenX + box.width + sensitiveArea) :
			pos == 'bottom' ?
				(aEvent.screenY >= box.screenY + box.height + sensitiveArea) :
				(aEvent.screenY <= box.screenY - sensitiveArea)
			) {
			return this.MOUSE_POSITION_INSIDE;
		}

		return this.MOUSE_POSITION_NEAR;
	},
	getContentsAreaBox : function AHB_getContentsAreaBox()
	{
		var sv  = this.treeStyleTab;
		var b   = this.browser;
		var box = b.mCurrentBrowser.boxObject;
		var xoffset = (this.shrunken || this.hidden) ? 0 : this.XOffset ;
		box = {
			screenX : box.screenX + (sv.position == 'left' ? xoffset : 0 ),
			screenY : box.screenY,
			width   : box.width - xoffset,
			height  : box.height
		};
		return box;
	},
	MOUSE_POSITION_UNKNOWN : 0,
	MOUSE_POSITION_OUTSIDE : (1 << 0),
	MOUSE_POSITION_INSIDE  : (1 << 1),
	MOUSE_POSITION_NEAR    : (1 << 2),
	MOUSE_POSITION_SENSITIVE : (1 << 1) | (1 << 2),
	getNearestClickableBox : function AHB_getNearestClickableBox(aEvent)
	{
		var sv = this.treeStyleTab;
		var tab = sv.getTabFromCoordinates(aEvent);
		if (!tab)
			return null;

		var position = sv.invertedScreenPositionProp;
		var size = sv.invertedSizeProp;
		var coordinate = aEvent[sv.invertedScreenPositionProp];
		var tabbox = tab.boxObject;

		var closebox;
		if (this.closeButtonsMode != this.CLOSE_BUTTONS_DISABLED &&
			this.closeButtonsMode != this.CLOSE_BUTTONS_ON_TABBAR &&
			(closebox = sv.getTabClosebox(tab)) &&
			(closebox = closebox.boxObject) &&
			closebox.width && closebox.height) {
			let padding = Math.min(
					closebox[position] - tabbox[position],
					(tabbox[position] + tabbox[size]) - (closebox[position] + closebox[size])
				);
			if (closebox[position] - padding <= coordinate &&
				closebox[position] + closebox[size] + padding >= coordinate)
				return this.cloneBoxObject(closebox, { padding : padding });
		}

		var twisty;
		if (sv.canCollapseSubtree(tab) &&
			(twisty = sv.getTabTwisty(tab)) &&
			(twisty = twisty.boxObject) &&
			twisty.width && twisty.height) {
			let padding = Math.min(
					twisty[position] - tabbox[position],
					(tabbox[position] + tabbox[size]) - (twisty[position] + twisty[size])
				);
			if (twisty[position] - padding <= coordinate &&
				twisty[position] + twisty[size] + padding >= coordinate)
				return this.cloneBoxObject(twisty, { padding : padding });
		}

		return null;
	},
	cloneBoxObject : function AHB_cloneBoxObject(aBoxObject, aOverride)
	{
		var box = {};
		for (let i in aBoxObject)
		{
			if (typeof aBoxObject[i] != 'function')
				box[i] = aBoxObject[i];
		}
		Object.keys(aOverride).forEach(function(aKey) {
			box[aKey] = aOverride[aKey];
		});
		return box;
	},
 
	cancelShowHideOnMouseMove : function AHB_cancelShowHideOnMouseMove() 
	{
		if (this.showHideOnMouseMoveTimer) {
			this.window.clearTimeout(this.showHideOnMouseMoveTimer);
			this.showHideOnMouseMoveTimer = null;
		}
	},
  
	// feedback 
	
	showForFeedback : function AHB_showForFeedback() 
	{
		if (!this.enabled ||
			!utils.getTreePref('tabbar.autoShow.feedback'))
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
				aSelf.hide(aSelf.kSHOWN_BY_FEEDBACK);
			},
			utils.getTreePref('tabbar.autoShow.feedback.delay'),
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
			utils.setTreePref('tabbar.width', this.treeStyleTab.maxTabbarWidth(aWidth));
		else
			utils.setTreePref('tabbar.shrunkenWidth', this.treeStyleTab.maxTabbarWidth(aWidth));
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
					utils.getTreePref('tabbar.shrunkenWidth') :
					utils.getTreePref('tabbar.width') ;
	},
	get placeHolderWidthFromMode()
	{
		return (this.mode == this.kMODE_SHRINK) ?
					utils.getTreePref('tabbar.shrunkenWidth') :
					utils.getTreePref('tabbar.width') ;
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
		var sv  = this.treeStyleTab;
		var b   = this.browser;
		var pos = sv.position;

		aReason = aReason || 0;

		if (this.expanded) { // to be hidden or shrunken
			let reason = this.kSHOWN_BY_UNKNOWN;
			if (aReason & this.kSHOWHIDE_BY_API)
				reason = aReason;
			this.onHiding();
			this.showHideReason = reason;
		}
		else { // to be shown or expanded
			this.onShowing();
			this.showHideReason = aReason || this.showHideReason || this.kSHOWN_BY_UNKNOWN;
		}

		if (DEBUG) {
			let humanReadableReason =
				(aReason & this.kSHOWN_BY_SHORTCUT ? 'shortcut ' : '' ) +
				(aReason & this.kSHOWN_BY_MOUSEMOVE ? 'mousemove ' : '' ) +
				(aReason & this.kSHOWN_BY_FEEDBACK ? 'feedback ' : '' ) +
				(aReason & this.kSHOWHIDE_BY_START ? 'start ' : '' ) +
				(aReason & this.kSHOWHIDE_BY_END ? 'end ' : '' ) +
				(aReason & this.kSHOWHIDE_BY_POSITION_CHANGE ? 'positionchange ' : '' ) +
				(aReason & this.kSHOWHIDE_BY_RESIZE ? 'resize ' : '' ) +
				(aReason & this.kHIDDEN_BY_CLICK ? 'click ' : '' );
			if (this.expanded)
				dump('autoHide: show by ' + humanReadableReason + '\n');
			else
				dump('autoHide: hide by ' + humanReadableReason + '\n');
		}

		this.fireStateChangingEvent();

		if (this.expanded)
			sv.setTabbrowserAttribute(this.kAUTOHIDE, 'show');
		b.mTabContainer.adjustTabstrip();
		sv.checkTabsIndentOverflow();

		this.window.setTimeout(function(aSelf) {
			aSelf.fireStateChangeEvent();
			aSelf.showHideContentsAreaScreen();
		}, 0, this);
	},
	showHideContentsAreaScreen : function AHB_showHideContentsAreaScreen()
	{
		if (
			this.expanded &&
			this.contentAreaScreenEnabled &&
			Services.focus.activeWindow &&
			Services.focus.activeWindow.top == this.window &&
			this.findPluginArea(this.browser.contentWindow)
			) {
			let box = this.getContentsAreaBox();
			let style = this.screen.style;
			let width = Math.min(box.width, this.window.screen.availWidth - box.screenX);
			let height = Math.min(box.height, this.window.screen.availHeight - box.screenY);
			style.width = width+'px';
			style.height = height+'px';
			if (this.screen.state == 'open')
				this.screen.moveTo(box.screenX, box.screenY);
			else
				this.screen.openPopupAtScreen(box.screenX, box.screenY, false);
			this.screen.setAttribute('popup-shown', true);
		}
		else {
			this.screen.removeAttribute('popup-shown');
			if (this.screen.state != 'close')
				this.screen.hidePopup();
		}
	},
	findPluginArea : function AHB_findPluginArea(aFrame)
	{
		return aFrame.document.querySelector('embed, object') ||
				Array.some(aFrame.frames, AHB_findPluginArea);
	},
	
	show : function AHB_show(aReason) /* PUBLIC API */ 
	{
		if (this.showHideReason & this.kSHOWHIDE_BY_API) {
			this.end();
			return;
		}

		if (aReason) {
			this.showHideReason |= aReason;
		}
		if (!this.expanded)
			this.showHideInternal();
	},
 
	hide : function AHB_hide(aReason) /* PUBLIC API */ 
	{
		if (!this.enabled) {
			this.start(aReason | this.kSHOWHIDE_BY_API);
			return;
		}

		if (aReason) {
			if (aReason == this.kSHOWN_BY_ANY_REASON)
				this.showHideReason &= ~this.kSHOWN_BY_ANY_REASON;
			else if (this.showHideReason & aReason)
				this.showHideReason ^= aReason;

			if (this.showHideReason & this.kSHOWN_BY_ANY_REASON)
				return;
		}
		if (this.expanded)
			this.showHideInternal();
	},
 
	onShowing : function AHB_onShowing() 
	{
		var sv  = this.treeStyleTab;
		var b   = this.browser;
		var pos = sv.position;

		sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_EXPANDED);

		switch (this.mode)
		{
			case this.kMODE_DISABLED:
				break;

			case this.kMODE_HIDE:
				sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_AUTOHIDE);
				break;

			default:
			case this.kMODE_SHRINK:
				if (pos == 'left' || pos == 'right') {
					let width = sv.maxTabbarWidth(utils.getTreePref('tabbar.width'));
					sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_AUTOHIDE);
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
					sv.setTabStripAttribute('width', utils.getTreePref('tabbar.shrunkenWidth'));
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
		'browser.fullscreen.autohide',
		'browser.tabs.closeButtons'
	],
 
	onPrefChange : function AHB_onPrefChange(aPrefName) 
	{
		// ignore after destruction
		if (!this.window || !this.window.TreeStyleTabService)
			return;

		var value = prefs.getPref(aPrefName);
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

			case 'extensions.treestyletab.tabbar.togglerSize':
				this.togglerSize = value;
				var toggler = this.document.getAnonymousElementByAttribute(this.browser, 'class', this.treeStyleTab.kTABBAR_TOGGLER);
				toggler.style.minWidth = toggler.style.minHeight = value+'px';
				if (this.togglerSize <= 0)
					toggler.setAttribute('collapsed', true);
				else
					toggler.removeAttribute('collapsed');
				return;

			case 'extensions.treestyletab.tabbar.autoHide.contentAreaScreen.enabled':
				return this.contentAreaScreenEnabled = value;

			case 'browser.fullscreen.autohide':
				if (!this.window.fullScreen) return;
				this.end();
				this.mode = value ?
						this.getModeForFullScreen() :
						this.kMODE_DISABLED ;
				if (this.mode != this.kMODE_DISABLED)
					this.start();
				return;

			case 'browser.tabs.closeButtons':
				return this.closeButtonsMode = value;

			default:
				return;
		}
	},
  
	handleEvent : function AHB_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'mousedown':
				return this.onMouseDown(aEvent);

			case 'mouseup':
				return this.onMouseUp(aEvent);

			case 'mousemove':
				return this.handleMouseMove(aEvent);

			case 'TabOpen':
			case 'TabClose':
				return this.showForFeedback();

			case 'TabMove':
				if (!this.treeStyleTab.subTreeMovingCount && !this.treeStyleTab.internallyTabMovingCount)
					this.showForFeedback();
				return;

			case 'select':
				if (!this.window.TreeStyleTabService.accelKeyPressed)
					this.showForFeedback();
				return;

			case 'dragover':
				return this.onDragOver(aEvent);

			case 'dragleave':
				return this.onDragLeave(aEvent);

			case this.treeStyleTab.kEVENT_TYPE_TABBAR_POSITION_CHANGING:
				this.isResizing = false;
				return;

			case this.treeStyleTab.kEVENT_TYPE_TABBAR_POSITION_CHANGED:
				if (this.enabled)
					this.window.setTimeout(function(aSelf) {
						aSelf.show(this.kSHOWHIDE_BY_POSITION_CHANGE);
						aSelf.hide(this.kSHOWHIDE_BY_POSITION_CHANGE);
					}, 0, this);
				this.updateTransparency();
				return;

			case this.treeStyleTab.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN:
				return this.onKeyDown(aEvent.getData('sourceEvent'));

			case this.treeStyleTab.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START:
				this.cancelDelayedShowForShortcut();
				if (this.enabled &&
					utils.getTreePref('tabbar.autoShow.tabSwitch') &&
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
				if (this.enabled)
					this.hide(this.kSHOWN_BY_SHORTCUT);
				return;

			case this.treeStyleTab.kEVENT_TYPE_PRINT_PREVIEW_ENTERED:
				this.hide(this.kSHOWHIDE_BY_END);
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
			sv.setTabbrowserAttribute(sv.kRESIZING, true);
		}
		this.cancelShowHideOnMouseMove();
		if (
			this.enabled &&
			this.expanded &&
			(
				aEvent.originalTarget.ownerDocument != this.document ||
				!sv.getTabBrowserFromChild(aEvent.originalTarget)
			)
			)
			this.hide(this.kHIDDEN_BY_CLICK);
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
		}
		this.cancelShowHideOnMouseMove();
		this.lastMouseDownTarget = null;
	},
 
	handleMouseMove : function AHB_handleMouseMove(aEvent) 
	{
		var sv = this.treeStyleTab;
		if (this.isResizing &&
			/^(scrollbar|thumb|slider|scrollbarbutton)$/i.test(this.lastMouseDownTarget))
			return true;

		if (
			!aEvent.shiftKey &&
			!sv.isPopupShown() &&
			(
				!this.expanded ||
				this.showHideReason & this.kSHOWN_BY_ANY_REASON
			) &&
			!this.lastMouseDownTarget
			)
			this.showHideOnMouseMove(aEvent);
		return true;
	},
 
	onDragOver : function AHB_onDragOver(aEvent) 
	{
		if (this.expanded)
			return;

		var position = this.getMousePosition(aEvent);
		if (!(position & this.MOUSE_POSITION_SENSITIVE))
			return;

		var draggedTabs = this.window['piro.sakura.ne.jp'].tabsDragUtils.getSelectedTabs(aEvent);
		if (
			draggedTabs.length ||
			this.treeStyleTab.tabbarDNDObserver.retrieveURLsFromDataTransfer(aEvent.dataTransfer).length
			) {
			this.show(this.kSHOWN_BY_MOUSEMOVE);

			if (this._autoHideOnDragLeaveTimer) {
				this.window.clearTimeout(this._autoHideOnDragLeaveTimer);
				delete this._autoHideOnDragLeaveTimer;
			}
		}
	},
 
	onDragLeave : function AHB_onDragLeave(aEvent) 
	{
		if (!this.expanded)
			return;

		if (this._autoHideOnDragLeaveTimer)
			this.window.clearTimeout(this._autoHideOnDragLeaveTimer);

		var position = this.getMousePosition(aEvent);
		if (position & this.MOUSE_POSITION_SENSITIVE)
			return;

		this._autoHideOnDragLeaveTimer = this.window.setTimeout(function(aSelf) {
			delete aSelf._autoHideOnDragLeaveTimer;
			aSelf.hide(aSelf.kSHOWN_BY_MOUSEMOVE);
		}, 100, this);
	},
 
	onKeyDown : function AHB_onKeyDown(aEvent) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		if (this.delayedShowForShortcutDone)
			this.cancelDelayedShowForShortcut();

		if (
			sv.getTabs(b).length > 1 &&
			!aEvent.altKey &&
			w.TreeStyleTabService.accelKeyPressed
			) {
			if (this.enabled &&
				utils.getTreePref('tabbar.autoShow.accelKeyDown') &&
				!this.delayedAutoShowTimer &&
				!this.delayedShowForShortcutTimer) {
				this.delayedShowForShortcutTimer = w.setTimeout(
					function(aSelf) {
						aSelf.delayedShowForShortcutDone = true;
						aSelf.show(aSelf.kSHOWN_BY_SHORTCUT);
						sv = null;
						b = null;
					},
					utils.getTreePref('tabbar.autoShow.accelKeyDown.delay'),
					this
				);
				this.delayedShowForShortcutDone = false;
			}
		}
		else {
			if (this.enabled)
				this.hide(this.kSHOWN_BY_SHORTCUT);
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
		this.showHideReason = this.kSHOWN_BY_UNKNOWN;
		this.lastMouseDownTarget = null;
		this.isResizing = false;

		this.showHideOnMouseMoveTimer = null;
		this.delayedShowForFeedbackTimer = null;

		b.setAttribute(this.kMODE+'-normal', utils.getTreePref('tabbar.autoHide.mode'));
		b.setAttribute(this.kMODE+'-fullscreen', utils.getTreePref('tabbar.autoHide.mode.fullscreen'));
		prefs.addPrefListener(this);
		this.onPrefChange('browser.tabs.closeButtons');
		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.area');
		this.onPrefChange('extensions.treestyletab.tabbar.togglerSize');
		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.contentAreaScreen.enabled');
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
	},
 
	destroy : function AHB_destroy() 
	{
		this.end();
		prefs.removePrefListener(this);

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
			if (utils.getTreePref(i) != prefs[i])
				utils.setTreePref(i, prefs[i]);
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
				utils.getTreePref(toggleKey) :
				AutoHideBrowser.prototype.kMODE_DISABLED ;

		utils.setTreePref(key, mode);
		b.setAttribute(AutoHideBrowser.prototype.kMODE+'-'+(w.fullScreen ? 'fullscreen' : 'normal' ), mode);
		b.treeStyleTab.autoHide.updateMode();
	},
 
// for shortcuts 
	
	updateKeyListeners : function AHW_updateKeyListeners() 
	{
		// ignore after destruction
		if (!this.window || !this.window.TreeStyleTabService)
			return;

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
			if (w.windowState != Ci.nsIDOMChromeWindow.STATE_NORMAL)
				return;
			var count = 0;
			var resizeTimer = w.setInterval(function(){
				if (w.windowState != Ci.nsIDOMChromeWindow.STATE_NORMAL)
					return w.clearInterval(resizeTimer);

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
					utils.getTreePref('tabbar.autoShow.accelKeyDown') ||
					utils.getTreePref('tabbar.autoShow.tabSwitch') ||
					utils.getTreePref('tabbar.autoShow.feedback')
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
  
