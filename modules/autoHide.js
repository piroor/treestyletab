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
 * Portions created by the Initial Developer are Copyright (C) 2010-2016
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
 
var EXPORTED_SYMBOLS = ['AutoHideBrowser', 'AutoHideWindow'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://treestyletab-modules/lib/inherit.jsm');
Cu.import('resource://treestyletab-modules/constants.js');
Cu.import('resource://treestyletab-modules/ReferenceCounter.js');

XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');
XPCOMUtils.defineLazyModuleGetter(this, 'TabAttributesObserver', 'resource://treestyletab-modules/tabAttributesObserver.js');

XPCOMUtils.defineLazyGetter(this, 'window', function() {
	Cu.import('resource://treestyletab-modules/lib/namespace.jsm');
	return getNamespaceFor('piro.sakura.ne.jp');
});
XPCOMUtils.defineLazyGetter(this, 'prefs', function() {
	Cu.import('resource://treestyletab-modules/lib/prefs.js');
	return window['piro.sakura.ne.jp'].prefs;
});

function log(...aArgs) {
	utils.log.apply(utils, ['autoHide'].concat(aArgs));
}
function logWithStackTrace(...aArgs) {
	utils.logWithStackTrace.apply(utils, ['autoHide'].concat(aArgs));
}

var AutoHideConstants = Object.freeze(inherit(TreeStyleTabConstants, {
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
	kSHOWN_AUTOMATICALLY : (1 << 0) | (1 << 1),
	kSHOWN_BY_ANY_REASON : (1 << 0) | (1 << 1) | (1 << 2),
	kSHOWHIDE_BY_START  : 1 << 3,
	kSHOWHIDE_BY_END    : 1 << 4,
	kSHOWHIDE_BY_POSITION_CHANGE : 1 << 5,
	kSHOWHIDE_BY_RESIZE : 1 << 6,
	kSHOWHIDE_BY_API    : 1 << 8,
	kHIDDEN_BY_CLICK    : 1 << 7,

	CLOSE_BUTTONS_ONLY_ON_CURRENT_TAB : 0,
	CLOSE_BUTTONS_ON_ALL_TABS         : 1,
	CLOSE_BUTTONS_DISABLED            : 2,
	CLOSE_BUTTONS_ON_TABBAR           : 3,

	MOUSE_POSITION_UNKNOWN : 0,
	MOUSE_POSITION_OUTSIDE : (1 << 0),
	MOUSE_POSITION_INSIDE  : (1 << 1),
	MOUSE_POSITION_NEAR    : (1 << 2),
	MOUSE_POSITION_SENSITIVE : (1 << 1) | (1 << 2)
}));


function AutoHideBase(aTabBrowser) 
{
}
AutoHideBase.prototype = inherit(AutoHideConstants, {
	window       : null,
	browser      : null,
	treeStyleTab : null,

	getMode : function AHB_getMode(aTabBrowser)
	{
		var b = aTabBrowser || this.browser;
		var mode = b.getAttribute(this.kMODE);
		return mode ? parseInt(mode) : this.kMODE_DISABLED ;
	},
	getModeForNormal : function AHB_getModeForNormal(aTabBrowser)
	{
		var b = aTabBrowser || this.browser;
		return parseInt(b.getAttribute(this.kMODE+'-normal') || this.lastNormalMode);
	},
	getModeForFullScreen : function AHB_getModeForFullScreen(aTabBrowser)
	{
		var b = aTabBrowser || this.browser;
		return parseInt(b.getAttribute(this.kMODE+'-fullscreen') || this.lastFullscreenMode);
	},

	get mode() /* PUBLIC API */ 
	{
		return this.getMode(this.browser);
	},
	set mode(aValue)
	{
		this.browser.setAttribute(this.kMODE, aValue);
		return aValue;
	},

	get shouldShrink()
	{
		var toggleKey = 'tabbar.autoHide.mode.toggle';
		if (this.window.fullScreen)
			toggleKey += '.fullscreen';
		return utils.getTreePref(toggleKey) == this.kMODE_SHRINK;
	},

	get lastNormalMode()
	{
		var lastMode = this.treeStyleTab.getWindowValue(this.kMODE + '-normal');
		if (lastMode !== '')
			return parseInt(lastMode);

		return utils.getTreePref('tabbar.autoHide.mode');
	},
	set lastNormalMode(aValue)
	{
		this.treeStyleTab.setWindowValue(this.kMODE + '-normal', aValue);
		return aValue;
	},
 
	get lastFullscreenMode() 
	{
		var lastMode = this.treeStyleTab.getWindowValue(this.kMODE + '-fullscreen');
		if (lastMode !== '')
			return parseInt(lastMode);

		return utils.getTreePref('tabbar.autoHide.mode.fullscreen');
	},
	set lastFullscreenMode(aValue)
	{
		this.treeStyleTab.setWindowValue(this.kMODE + '-fullscreen', aValue);
		return aValue;
	}
});


function AutoHideBrowser(aTabBrowser) 
{
	this.init(aTabBrowser);
}
AutoHideBrowser.prototype = inherit(AutoHideBase.prototype, {
	
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
 
	get toggler()
	{
		return this.document.getAnonymousElementByAttribute(this.browser, 'class', this.treeStyleTab.kTABBAR_TOGGLER);
	},
	
	updateMode : function AHB_updateMode(aNewMode) 
	{
		if (aNewMode === undefined)
			aNewMode = this.mode;

		var suffix = this.treeStyleTab.isFullscreenAutoHide ? 'fullscreen' : 'normal' ;
		this.treeStyleTab.setWindowValue(this.kMODE + '-' + suffix, aNewMode);

		this.end();
		// update internal property after the appearance of the tab bar is updated.
		var w = this.window;
		w.setTimeout((function() {
			this.mode = aNewMode;
			if (this.mode != this.kMODE_DISABLED)
				this.start();
		}).bind(this), 0);
	},
  
	togglerSize : 0, 
	sensitiveArea : 7,
	contentAreaScreenEnabled : true,

	closeButtonsMode : -1,
 
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
				return this.expandedWidth - this.shrunkenWidth;
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
 
	get tabbarWidth()
	{
		return this.expanded ? this.expandedWidth : this.shrunkenWidth ;
	},
	set tabbarWidth(aValue)
	{
		if (this.expanded)
			return this.expandedWidth = aValue;
		else
			return this.shrunkenWidth = aValue;
	},
	get expandedWidth()
	{
		var lastWidth = this.treeStyleTab.getWindowValue(this.kTABBAR_EXPANDED_WIDTH);
		return lastWidth === '' ?
				utils.getTreePref('tabbar.width') :
				parseInt(lastWidth);
	},
	set expandedWidth(aValue)
	{
		var newWidth = this.treeStyleTab.calculateCorrectExpandedAndShrunkenWidth({
			expanded : aValue,
			shrunken : this.shrunkenWidth
		}, 'expanded');
		if (newWidth.corrected) {
			this.shrunkenWidth = newWidth.shrunken;
			aValue = newWidth.expanded;
		}
		this.treeStyleTab.setWindowValue(this.kTABBAR_EXPANDED_WIDTH, aValue);
		utils.setTreePref('tabbar.width', aValue);
		return aValue;
	},
	get shrunkenWidth()
	{
		var lastWidth = this.treeStyleTab.getWindowValue(this.kTABBAR_SHRUNKEN_WIDTH);
		return lastWidth === '' ?
				utils.getTreePref('tabbar.shrunkenWidth') :
				parseInt(lastWidth);
	},
	set shrunkenWidth(aValue)
	{
		var newWidth = this.treeStyleTab.calculateCorrectExpandedAndShrunkenWidth({
			expanded : this.expandedWidth,
			shrunken : aValue
		}, 'shrunken');
		if (newWidth.corrected) {
			this.expandedWidth = newWidth.expanded;
			aValue = newWidth.shrunken;
		}
		this.treeStyleTab.setWindowValue(this.kTABBAR_SHRUNKEN_WIDTH, aValue);
		utils.setTreePref('tabbar.shrunkenWidth', aValue);
		return aValue;
	},

	resetWidth : function AHB_resetWidth()
	{
		this.expandedWidth = utils.getTreePref('tabbar.width.default');
		this.shrunkenWidth = utils.getTreePref('tabbar.shrunkenWidth.default');
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
		if (this.enabled)
			return;

		this.enabled = true;
		aReason = aReason || 0;

		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		this.screen.hidePopup();

		sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_EXPANDED);

		if (!(aReason & this.kSHOWHIDE_BY_API)) {
			w.addEventListener('blur', this, true);
			ReferenceCounter.add('w,blur,AHW,true');
			b.addEventListener('dragover', this, true);
			ReferenceCounter.add('b,dragover,AHW,true');
			b.addEventListener('dragleave', this, true);
			ReferenceCounter.add('b,dragleave,AHW,true');
			sv.tabStripPlaceHolder.addEventListener('mousedown', this, true);
			ReferenceCounter.add('tabStripPlaceHolder,mousedown,AHW,true');
			sv.tabStripPlaceHolder.addEventListener('mouseup', this, true);
			ReferenceCounter.add('tabStripPlaceHolder,mouseup,AHW,true');
			sv.tabStrip.addEventListener('mousedown', this, true);
			ReferenceCounter.add('tabStrip,mousedown,AHW,true');
			w.addEventListener('mouseup', this, true);
			ReferenceCounter.add('w,mouseup,AHW,true');
			w.addEventListener('dragend', this, true);
			ReferenceCounter.add('w,dragend,AHW,true');
			w.addEventListener('drop', this, true);
			ReferenceCounter.add('w,drop,AHW,true');
			if (this.shouldListenMouseMove)
				this.startListenMouseMove();
			if (b == w.gBrowser && sv.shouldListenKeyEventsForAutoHide)
				w.TreeStyleTabService.startListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);
			this.userActionListening = true;
			this.notifyStatusToAllTabs();
		}
		w.addEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		ReferenceCounter.add('w,kEVENT_TYPE_PRINT_PREVIEW_ENTERED,AHW,false');
		w.addEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_EXITED, this, false);
		ReferenceCounter.add('w,kEVENT_TYPE_PRINT_PREVIEW_EXITED,AHW,false');

		this.updateTransparency();

		this.showHideInternal(this.kSHOWHIDE_BY_START | aReason);

		b.treeStyleTab.fixTooNarrowTabbar();
	},
 
	end : function AHB_end() 
	{
		if (!this.enabled)
			return;

		this.enabled = false;

		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		this.show(this.kSHOWHIDE_BY_END);

		this.screen.hidePopup();

		if (this.userActionListening) {
			w.removeEventListener('blur', this, true);
			ReferenceCounter.remove('w,blur,AHW,true');
			b.removeEventListener('dragover', this, true);
			ReferenceCounter.remove('b,dragover,AHW,true');
			b.removeEventListener('dragleave', this, true);
			ReferenceCounter.remove('b,dragleave,AHW,true');
			sv.tabStripPlaceHolder.removeEventListener('mousedown', this, true);
			ReferenceCounter.remove('tabStripPlaceHolder,mousedown,AHW,true');
			sv.tabStripPlaceHolder.removeEventListener('mouseup', this, true);
			ReferenceCounter.remove('tabStripPlaceHolder,mouseup,AHW,true');
			sv.tabStrip.removeEventListener('mousedown', this, true);
			ReferenceCounter.remove('tabStrip,mousedown,AHW,true');
			w.removeEventListener('mouseup', this, true);
			ReferenceCounter.remove('w,mouseup,AHW,true');
			w.removeEventListener('dragend', this, true);
			ReferenceCounter.remove('w,dragend,AHW,true');
			w.removeEventListener('drop', this, true);
			ReferenceCounter.remove('w,drop,AHW,true');
			this.endListenMouseMove();
			if (b == w.gBrowser)
				w.TreeStyleTabService.endListenKeyEventsFor(sv.LISTEN_FOR_AUTOHIDE);
			this.userActionListening = false;
			this.notifyStatusToAllTabs();
		}
		w.removeEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		ReferenceCounter.remove('w,kEVENT_TYPE_PRINT_PREVIEW_ENTERED,AHW,false');
		w.removeEventListener(sv.kEVENT_TYPE_PRINT_PREVIEW_EXITED, this, false);
		ReferenceCounter.remove('w,kEVENT_TYPE_PRINT_PREVIEW_EXITED,AHW,false');

		this.updateTransparency();

		sv.removeTabbrowserAttribute(this.kAUTOHIDE);
		sv.removeTabbrowserAttribute(this.kSTATE);

		if (sv.isVertical)
			sv.setTabStripAttribute('width', this.widthFromMode);
	},

	notifyStatusToAllTabs : function AHB_notifyStatusToAllTabs()
	{
		let tabs = this.treeStyleTab.getTabs(this.browser);
		tabs.forEach(this.notifyStatusToTab, this);
	},
	notifyStatusToTab : function AHB_notifyStatusToTab(aTab)
	{
		aTab.__treestyletab__contentBridge.sendAsyncCommand(this.COMMAND_NOTIFY_AUTOHIDE_STATUS, {
			basicListening   : this.mouseMoveListening || this.userActionListening,
			advanceListening : this.mouseMoveListening
		});
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
		if (this.mouseMoveListening)
			return;

		this.screen.addEventListener('mousemove', this, true);
		ReferenceCounter.add('screen,mousemove,AHW,true');
		this.treeStyleTab.browser.addEventListener('mousemove', this, true);
		ReferenceCounter.add('browser,mousemove,AHW,true');
		this.treeStyleTab.tabStrip.addEventListener('mousemove', this, true);
		ReferenceCounter.add('tabStrip,mousemove,AHW,true');
		this.toggler.addEventListener('mousemove', this, true);
		ReferenceCounter.add('toggler,mousemove,AHW,true');
		this.window.addEventListener('TabRemotenessChange', this, false);
		ReferenceCounter.add('window,TabRemotenessChange,AHW,false');

		this.mouseMoveListening = true;

		this.notifyStatusToAllTabs();
	},
 
	endListenMouseMove : function AHB_endListenMouseMove() 
	{
		if (!this.mouseMoveListening)
			return;

		this.screen.removeEventListener('mousemove', this, true);
		ReferenceCounter.remove('screen,mousemove,AHW,true');
		this.treeStyleTab.browser.removeEventListener('mousemove', this, true);
		ReferenceCounter.remove('browser,mousemove,AHW,true');
		this.treeStyleTab.tabStrip.removeEventListener('mousemove', this, true);
		ReferenceCounter.remove('tabStrip,mousemove,AHW,true');
		this.toggler.removeEventListener('mousemove', this, true);
		ReferenceCounter.remove('toggler,mousemove,AHW,true');
		this.window.removeEventListener('TabRemotenessChange', this, false);
		ReferenceCounter.remove('window,TabRemotenessChange,AHW,false');

		this.mouseMoveListening = false;

		this.notifyStatusToAllTabs();
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
 
	showHideOnMouseMove : function AHB_showHideOnMouseMove(aCoordinates) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		var exapndedByUnknownReason = (
				this.expanded &&
				!(this.showHideReason & this.kSHOWN_BY_ANY_REASON)
			);
		var position = this.getMousePosition(aCoordinates);

		if (utils.isDebugging('autoHide')) {
			let humanReadablePosition = [];
			if (position & this.MOUSE_POSITION_OUTSIDE)
				humanReadablePosition.push('outside');
			if (position & this.MOUSE_POSITION_INSIDE)
				humanReadablePosition.push('inside');
			if (position & this.MOUSE_POSITION_NEAR)
				humanReadablePosition.push('near');
			if (position & this.MOUSE_POSITION_SENSITIVE)
				humanReadablePosition.push('sensitive');
			let extraInfo = [];
			if (sv.isPopupShown())
				extraInfo.push('popupshown');
			if (exapndedByUnknownReason)
				extraInfo.push('expanded-by-unknown');
			if (this.lastMouseDownTarget)
				extraInfo.push('mousedown');
			log('showHideOnMouseMove: ' +
			       '('+aCoordinates.screenX + ', ' + aCoordinates.screenY + ') => ' +
			       humanReadablePosition.join(', ') +
			       (extraInfo.length ? ('[' + extraInfo.join(', ') + ']') : ''));
		}

		if (sv.isPopupShown() ||
			exapndedByUnknownReason ||
			this.lastMouseDownTarget ||
			position == this.MOUSE_POSITION_UNKNOWN)
			return;

		this.cancelShowHideOnMouseMove();
		this.showHideContentsAreaScreen();

		var shouldShow = position & this.MOUSE_POSITION_SENSITIVE;
		var delayToShow = utils.getTreePref('tabbar.autoHide.delay.show');
		if (this.expanded) { // currently shown, let's hide it.
			if (shouldShow) {
				this.show(this.kSHOWN_BY_MOUSEMOVE);
				this.cancelDelayedShowForShortcut();
			}
			else if (
				!shouldShow &&
				utils.getTreePref('tabbar.autoShow.mousemove')
				) {
				let delayToHide = utils.getTreePref('tabbar.autoHide.delay.hide');
				if (delayToHide < 0)
					delayToHide = delayToShow;
				this.showHideOnMouseMoveTimer = w.setTimeout((function() {
					this.cancelDelayedShowForShortcut();
					this.hide(this.kSHOWN_BY_MOUSEMOVE);
				}).bind(this), delayToHide);
			}
		}
		else if (shouldShow) { // currently shown, let's show it.
			this.showHideOnMouseMoveTimer = w.setTimeout((function() {
				this.cancelDelayedShowForShortcut();
				this.show(this.kSHOWN_BY_MOUSEMOVE);
			}).bind(this), delayToShow);
		}

		b = null;
	},
	getMousePosition : function AHB_getMousePosition(aCoordinates) 
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
				(clickable = this.getNearestClickableBox(aCoordinates))) {
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
				(aCoordinates.screenX > box.screenX + sensitiveArea) :
			pos == 'right' ?
				(aCoordinates.screenX < box.screenX + box.width - sensitiveArea) :
			pos == 'bottom' ?
				(aCoordinates.screenY < box.screenY + box.height - sensitiveArea) :
				(aCoordinates.screenY > box.screenY + sensitiveArea)
			) {
			return this.MOUSE_POSITION_OUTSIDE;
		}

		if (
			pos == 'left' ?
				(aCoordinates.screenX <= box.screenX - sensitiveArea) :
			pos == 'right' ?
				(aCoordinates.screenX >= box.screenX + box.width + sensitiveArea) :
			pos == 'bottom' ?
				(aCoordinates.screenY >= box.screenY + box.height + sensitiveArea) :
				(aCoordinates.screenY <= box.screenY - sensitiveArea)
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
	getNearestClickableBox : function AHB_getNearestClickableBox(aCoordinates)
	{
		var sv = this.treeStyleTab;
		var tab = sv.getTabFromCoordinates(aCoordinates);
		if (!tab)
			return null;

		var position = sv.invertedScreenPositionProp;
		var size = sv.invertedSizeProp;
		var coordinate = aCoordinates[sv.invertedScreenPositionProp];
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
	
	showForFeedback : function AHB_showForFeedback(aTab) 
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
		this.delayedShowForFeedbackTimer = w.setTimeout((function() {
			this.delayedShowForFeedbackTimer = null;
			this.delayedShowForFeedback(aTab);
		}).bind(this), 100);
	},
 
	delayedShowForFeedback : function AHB_delayedShowForFeedback(aTab) 
	{
		this.treeStyleTab.highlightTab(aTab);
		this.show(this.kSHOWN_BY_FEEDBACK);
		this.cancelHideForFeedback();
		this.delayedHideTabbarForFeedbackTimer = this.window.setTimeout((function() {
			// TODO: we do something to highlight the given tab.
			this.delayedHideTabbarForFeedbackTimer = null;
			this.hide(this.kSHOWN_BY_FEEDBACK);
		}).bind(this), utils.getTreePref('tabbar.autoShow.feedback.delay'));
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
		aWidth = this.treeStyleTab.maxTabbarWidth(aWidth);
		if (aForceExpanded ||
			this.expanded ||
			this.mode !=  this.kMODE_SHRINK)
			this.expandedWidth = aWidth;
		else
			this.shrunkenWidth = aWidth;
	},
 
	updateMenuItem : function AHB_updateMenuItem(aNode) 
	{
		if (!aNode)
			return;

		if (this.mode != this.kMODE_DISABLED)
			aNode.setAttribute('checked', true);
		else
			aNode.removeAttribute('checked');

		var labelAttribute = this.shouldShrink ? 'label-shrink' : 'label-hide' ;
		aNode.setAttribute('label', aNode.getAttribute(labelAttribute));
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
		return this.shrunken ?
					this.shrunkenWidth :
					this.expandedWidth ;
	},
	get placeHolderWidthFromMode()
	{
		return (this.mode == this.kMODE_SHRINK) ?
					this.shrunkenWidth :
					this.expandedWidth ;
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

		if (utils.isDebugging('autoHide')) {
			let givenReason = this._getHumanReadableReason(aReason);
			let unifiedReason = this._getHumanReadableReason(this.showHideReason);
			if (this.expanded)
				logWithStackTrace('autoHide: show by ' + aReason + '(' + givenReason + ' / ' + unifiedReason + ')');
			else
				logWithStackTrace('autoHide: hide by ' + aReason + '(' + givenReason + ' / ' + unifiedReason + ')');
		}

		this.fireStateChangingEvent();

		if (this.expanded)
			sv.setTabbrowserAttribute(this.kAUTOHIDE, 'show');
		b.mTabContainer.adjustTabstrip();
		sv.checkTabsIndentOverflow();

		this.window.setTimeout((function() {
			this.fireStateChangeEvent();
			this.showHideContentsAreaScreen();
		}).bind(this), 0);
	},
	_getHumanReadableReason: function AHB_getHumanReadableReason(aReason)
	{
		let humanReadableReason =
			(aReason & this.kSHOWN_BY_SHORTCUT ? 'shortcut ' : '' ) +
			(aReason & this.kSHOWN_BY_MOUSEMOVE ? 'mousemove ' : '' ) +
			(aReason & this.kSHOWN_BY_FEEDBACK ? 'feedback ' : '' ) +
			(aReason & this.kSHOWHIDE_BY_START ? 'start ' : '' ) +
			(aReason & this.kSHOWHIDE_BY_END ? 'end ' : '' ) +
			(aReason & this.kSHOWHIDE_BY_POSITION_CHANGE ? 'positionchange ' : '' ) +
			(aReason & this.kSHOWHIDE_BY_RESIZE ? 'resize ' : '' ) +
			(aReason & this.kHIDDEN_BY_CLICK ? 'click ' : '' );
		return humanReadableReason.replace(/\s+$/, '');
	},
	showHideContentsAreaScreen : function AHB_showHideContentsAreaScreen()
	{
		if (
			this.expanded &&
			this.contentAreaScreenEnabled &&
			Services.focus.activeWindow &&
			Services.focus.activeWindow.top == this.window
			) {
			this.browser.selectedTab.__treestyletab__contentBridge.checkPluginAreaExistence()
				.then((function(aExistence) {
					if (aExistence)
						this.showContentsAreaScreen();
					else
						this.hideContentsAreaScreen();
				}).bind(this))
				.catch((function(aError) {
					this.hideContentsAreaScreen();
					Components.utils.reportError(aError);
				}).bind(this));

		}
		else {
			this.hideContentsAreaScreen();
		}
	},
	showContentsAreaScreen : function AHB_showContentsAreaScreen()
	{
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
	},
	hideContentsAreaScreen : function AHB_hideContentsAreaScreen()
	{
		this.screen.removeAttribute('popup-shown');
		if (this.screen.state != 'close')
			this.screen.hidePopup();
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
			this.showHideInternal(aReason);
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
			this.showHideInternal(aReason);
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
					let width = sv.maxTabbarWidth(this.expandedWidth);
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
				sv.updateLastScrollPosition();
				sv.setTabbrowserAttribute(this.kAUTOHIDE, 'hidden');
				sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_HIDDEN);
				sv.updateFloatingTabbar(sv.kTABBAR_UPDATE_BY_AUTOHIDE);
				break;

			default:
			case this.kMODE_SHRINK:
				sv.setTabbrowserAttribute(this.kAUTOHIDE, 'show');
				sv.setTabbrowserAttribute(this.kSTATE, this.kSTATE_SHRUNKEN);
				if (pos == 'left' || pos == 'right')
					sv.setTabStripAttribute('width', this.shrunkenWidth);
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
		this.treeStyleTab.fireCustomEvent(this.treeStyleTab.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGING, this.browser, true, false, data);
		// for backward compatibility
		this.treeStyleTab.fireCustomEvent(this.treeStyleTab.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGING.replace(/^nsDOM/, ''), this.browser, true, false, data);
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
		this.treeStyleTab.fireCustomEvent(this.treeStyleTab.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGE, this.browser, true, false, data);
		// for backward compatibility
		this.treeStyleTab.fireCustomEvent(this.treeStyleTab.kEVENT_TYPE_AUTO_HIDE_STATE_CHANGE.replace(/^nsDOM/, ''), this.browser, true, false, data);
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
				if (!this.window.TreeStyleTabService.shouldApplyNewPref('tabbar.autoHide.mode'))
					return;
				this.browser.setAttribute(this.kMODE+'-normal', value);
				if (!this.window.fullScreen)
					this.updateMode(value);
				return;

			case 'extensions.treestyletab.tabbar.autoHide.mode.fullscreen':
				if (!this.window.TreeStyleTabService.shouldApplyNewPref('tabbar.autoHide.mode.fullscreen'))
					return;
				this.browser.setAttribute(this.kMODE+'-fullscreen', value);
				if (this.window.fullScreen)
					this.updateMode(value);
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
				{
					let toggler = this.toggler;
					toggler.style.minWidth = toggler.style.minHeight = value+'px';
					if (this.togglerSize <= 0)
						toggler.setAttribute('collapsed', true);
					else
						toggler.removeAttribute('collapsed');
				}
				return;

			case 'extensions.treestyletab.tabbar.autoHide.contentAreaScreen.enabled':
				return this.contentAreaScreenEnabled = value;

			case 'browser.fullscreen.autohide':
				if (!this.window.fullScreen)
					return;
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
			case 'blur':
				let activeWindow = Cc['@mozilla.org/focus-manager;1']
									.getService(Ci.nsIFocusManager)
									.activeWindow;
				var inactive = !activeWindow || activeWindow != this.window;
				if (inactive &&
					this.showHideReason & this.kSHOWN_AUTOMATICALLY)
					this.hide(this.kSHOWN_BY_ANY_REASON);
				return;

			case 'mousedown':
				return this.onMouseDown(aEvent);

			case 'mouseup':
			// Note, we must handle "drop" event also to handle the end
			// of drag-and-drop of a tab due to the bug:
			// https://bugzilla.mozilla.org/show_bug.cgi?id=460801
			case 'dragend':
			case 'drop':
				return this.onMouseUp(aEvent);

			case 'mousemove':
				return this.handleMouseMove(aEvent);

            case 'TabRemotenessChange':
				return this.notifyStatusToAllTabs(aEvent.target);

			case 'TabOpen':
				if (utils.getTreePref('tabbar.autoShow.feedback.opened'))
					this.showForFeedback(aEvent.originalTarget);
				return;

			case 'TabClose':
				if (utils.getTreePref('tabbar.autoShow.feedback.closed'))
					this.showForFeedback(aEvent.originalTarget);
				return;

			case 'TabMove':
				if (utils.getTreePref('tabbar.autoShow.feedback.moved') &&
					!this.treeStyleTab.subTreeMovingCount &&
					!this.treeStyleTab.isTabInternallyMoving(aEvent.originalTarget))
					this.showForFeedback(aEvent.originalTarget);
				return;

			case 'select':
				if (utils.getTreePref('tabbar.autoShow.feedback.selected') &&
					!this.window.TreeStyleTabService.accelKeyPressed)
					this.showForFeedback(aEvent.originalTarget);
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
					this.window.setTimeout((function() {
						this.show(this.kSHOWHIDE_BY_POSITION_CHANGE);
						this.hide(this.kSHOWHIDE_BY_POSITION_CHANGE);
					}).bind(this), 0);
				this.updateTransparency();
				return;

			case this.treeStyleTab.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN:
				return this.onKeyDown(aEvent.detail.sourceEvent);

			case this.treeStyleTab.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START:
				this.cancelDelayedShowForShortcut();
				if (this.enabled &&
					utils.getTreePref('tabbar.autoShow.tabSwitch') &&
					(
						aEvent.detail.scrollDown ||
						aEvent.detail.scrollUp ||
						( // when you release "shift" key
							this.expanded &&
							aEvent.detail.standBy &&
							aEvent.detail.onlyShiftKey
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
			aEvent.target &&
			!this.isResizing &&
			utils.evaluateXPath(
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
				!aEvent.originalTarget ||
				aEvent.originalTarget.ownerDocument != this.document ||
				!sv.getTabBrowserFromChild(aEvent.originalTarget)
			)
			)
			this.hide(this.kHIDDEN_BY_CLICK);
		this.lastMouseDownTarget = (
			aEvent.originalTargetLocalName ||
			(aEvent.originalTarget && aEvent.originalTarget.localName) ||
			''
		);
	},
 
	onMouseUp : function AHB_onMouseUp(aEvent) 
	{
		var sv = this.treeStyleTab;
		if (this.isResizing &&
			aEvent.originalTarget &&
			utils.evaluateXPath(
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
			/^(scrollbar|thumb|slider|scrollbarbutton)$/i.test(this.lastMouseDownTarget || ''))
			return true;

		if (!aEvent.shiftKey)
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

		this._autoHideOnDragLeaveTimer = this.window.setTimeout((function() {
			delete this._autoHideOnDragLeaveTimer;
			this.hide(this.kSHOWN_BY_MOUSEMOVE);
		}).bind(this), 100);
	},
 
	onKeyDown : function AHB_onKeyDown(aEvent) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		if( !(this.keyarr instanceof Array) ){
			this.keyarr=[];
		}else{
			let obj={
				key:aEvent.key,
				keycode:aEvent.keycode,
				time:new Date()
			}
			this.keyarr.push(obj)
		}

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
				this.delayedShowForShortcutTimer = w.setTimeout((function() {
					const now=new Date();
					for(let input of this.keyarr){
						//key is object.
						//key{time:date,key:string}
					
						if( (input.time.getTime()-now.getTime()) < 1000 &&
							input.keycode >= 65 &&
							input.keycode <= 90
						){
							
							return;
						}
					}
					
					this.delayedShowForShortcutDone = true;
					this.show(this.kSHOWN_BY_SHORTCUT);
					sv = null;
					b = null;
				}).bind(this), utils.getTreePref('tabbar.autoShow.accelKeyDown.delay'));
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
 
	onTabTitleChanged : function AHB_onTabTitleChanged(aTab)
	{
		if (utils.getTreePref('tabbar.autoShow.feedback.titleChanged'))
			this.showForFeedback(aTab);
	},
    
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

		b.setAttribute(this.kMODE+'-normal', this.lastNormalMode);
		b.setAttribute(this.kMODE+'-fullscreen', this.lastFullscreenMode);
		prefs.addPrefListener(this);
		this.onPrefChange('browser.tabs.closeButtons');
		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.area');
		this.onPrefChange('extensions.treestyletab.tabbar.togglerSize');
		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.contentAreaScreen.enabled');

		b.mTabContainer.addEventListener('TabOpen', this, false);
		ReferenceCounter.add('mTabContainer,TabOpen,AHW,false');
		b.mTabContainer.addEventListener('TabClose', this, false);
		ReferenceCounter.add('mTabContainer,TabClose,AHW,false');
		b.mTabContainer.addEventListener('TabMove', this, false);
		ReferenceCounter.add('mTabContainer,TabMove,AHW,false');
		b.mTabContainer.addEventListener('select', this, false);
		ReferenceCounter.add('mTabContainer,select,AHW,false');
		b.addEventListener(sv.kEVENT_TYPE_TABBAR_POSITION_CHANGING, this, false);
		ReferenceCounter.add('b,kEVENT_TYPE_TABBAR_POSITION_CHANGING,AHW,false');
		b.addEventListener(sv.kEVENT_TYPE_TABBAR_POSITION_CHANGED, this, false);
		ReferenceCounter.add('b,kEVENT_TYPE_TABBAR_POSITION_CHANGED,AHW,false');
		b.addEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN, this, false);
		ReferenceCounter.add('b,kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN,AHW,false');
		b.addEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START, this, false);
		ReferenceCounter.add('b,kEVENT_TYPE_TAB_FOCUS_SWITCHING_START,AHW,false');
		b.addEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);
		ReferenceCounter.add('b,kEVENT_TYPE_TAB_FOCUS_SWITCHING_END,AHW,false');

		this.tabsAttributeObserver = new TabAttributesObserver({
			container  : b.mTabContainer,
			attributes : 'titlechanged',
			callback   : (function(aTab) {
				if (aTab.getAttribute('titlechanged') == 'true')
					this.onTabTitleChanged(aTab);
			}).bind(this)
		});
	},
 
	destroy : function AHB_destroy() 
	{
		this.end();
		prefs.removePrefListener(this);

		this.tabsAttributeObserver.destroy();
		delete this.tabsAttributeObserver;

		var sv = this.treeStyleTab;
		var b  = this.browser;
		b.mTabContainer.removeEventListener('TabOpen', this, false);
		ReferenceCounter.remove('mTabContainer,TabOpen,AHW,false');
		b.mTabContainer.removeEventListener('TabClose', this, false);
		ReferenceCounter.remove('mTabContainer,TabClose,AHW,false');
		b.mTabContainer.removeEventListener('TabMove', this, false);
		ReferenceCounter.remove('mTabContainer,TabMove,AHW,false');
		b.mTabContainer.removeEventListener('select', this, false);
		ReferenceCounter.remove('mTabContainer,select,AHW,false');
		b.removeEventListener(sv.kEVENT_TYPE_TABBAR_POSITION_CHANGING, this, false);
		ReferenceCounter.remove('b,kEVENT_TYPE_TABBAR_POSITION_CHANGING,AHW,false');
		b.removeEventListener(sv.kEVENT_TYPE_TABBAR_POSITION_CHANGED, this, false);
		ReferenceCounter.remove('b,kEVENT_TYPE_TABBAR_POSITION_CHANGED,AHW,false');
		b.removeEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN, this, false);
		ReferenceCounter.remove('b,kEVENT_TYPE_TAB_FOCUS_SWITCHING_KEY_DOWN,AHW,false');
		b.removeEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_START, this, false);
		ReferenceCounter.remove('b,kEVENT_TYPE_TAB_FOCUS_SWITCHING_START,AHW,false');
		b.removeEventListener(sv.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);
		ReferenceCounter.remove('b,kEVENT_TYPE_TAB_FOCUS_SWITCHING_END,AHW,false');

		delete this.treeStyleTab;
		delete this.browser;
		delete this.document;
		delete this.window;
	}
 
}); 
  
function AutoHideWindow(aWindow) 
{
	this.init(aWindow);
}
AutoHideWindow.prototype = inherit(AutoHideBase.prototype, {
	get browser()
	{
		return this.treeStyleTab.browser;
	},
	
// mode 
	
	get mode() /* PUBLIC API, overrides base class's one */ 
	{
		var mode = this.getMode();
		if (mode == this.kMODE_SHRINK && !this.treeStyleTab.isVertical)
			return this.kMODE_HIDE;
		return mode;
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
		b.treeStyleTab.autoHide.updateMode(mode);
	},
 
	initMode : function AHW_initMode()
	{
		// save current state for this window's last state for new (clean) window
		this.lastNormalMode     = this.lastNormalMode;
		this.lastFullscreenMode = this.lastFullscreenMode;

		var mode = this.treeStyleTab.isFullscreenAutoHide ?
					this.lastFullscreenMode :
					this.lastNormalMode;

		if (mode == this.mode)
			return;

		this.mode = mode;
		if (mode != this.kMODE_DISABLED)
			this.updateKeyListeners(this.window);

		this.window.setTimeout((function() {
			this.window.gBrowser.treeStyleTab.autoHide.updateMode(mode);
		}).bind(this), 0);
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
		return (
					utils.getTreePref('tabbar.autoShow.accelKeyDown') ||
					utils.getTreePref('tabbar.autoShow.tabSwitch') ||
					utils.getTreePref('tabbar.autoShow.feedback')
				);
	},
   
	init : function AHW_init(aWindow) 
	{
		this.window       = aWindow;
		this.document     = aWindow.document;
		this.treeStyleTab = aWindow.TreeStyleTabService;
		prefs.addPrefListener(this);
		this.waitForWindowReady();

	},
 
	destroy : function AHW_destroy() 
	{
		this.endWaitForWindowReady();
		prefs.removePrefListener(this);
		delete this.treeStyleTab;
		delete this.document;
		delete this.window;
	},
 
	waitForWindowReady : function AHW_waitForWindowReady() 
	{
		if (this.waitingForWindowReady)
			return;

		this.waitingForWindowReady = true;
		this.window.addEventListener('SSWindowStateReady', this, false);
		ReferenceCounter.add('window,SSWindowStateReady,AHW,false');
		Services.obs.addObserver(this, 'browser-delayed-startup-finished', false);
	},
 
	endWaitForWindowReady : function AHW_endWaitForWindowReady() 
	{
		if (!this.waitingForWindowReady)
			return;

		this.waitingForWindowReady = false;
		this.window.removeEventListener('SSWindowStateReady', this, false);
		ReferenceCounter.remove('window,SSWindowStateReady,AHW,false');
		Services.obs.removeObserver(this, 'browser-delayed-startup-finished');
	},
 
	handleEvent : function AHW_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'SSWindowStateReady':
				this.endWaitForWindowReady();
				this.initMode();
				return;
		}
	},
 
	observe : function AHW_observe(aSubject, aTopic, aData) 
	{
		if (aSubject != this.window)
			return;

		this.endWaitForWindowReady();
		this.window.setTimeout(this.initMode.bind(this), 0);
	},
 
	domains : [ 
		'extensions.treestyletab.'
	],

	onPrefChange : function AHW_onPrefChange(aPrefName) 
	{
		var value = prefs.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.autoHide.mode':
			case 'extensions.treestyletab.tabbar.autoShow.accelKeyDown':
			case 'extensions.treestyletab.tabbar.autoShow.tabSwitch':
			case 'extensions.treestyletab.tabbar.autoShow.feedback':
				this.updateKeyListeners(this.window);

			default:
				return;
		}
	}
 
}); 
  
