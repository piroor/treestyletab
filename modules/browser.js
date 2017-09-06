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
 * Portions created by the Initial Developer are Copyright (C) 2011-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
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
 
var EXPORTED_SYMBOLS = ['TreeStyleTabBrowser']; 

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Timer.jsm');
Cu.import('resource://treestyletab-modules/lib/inherit.jsm');
Cu.import('resource://treestyletab-modules/ReferenceCounter.js');

XPCOMUtils.defineLazyModuleGetter(this, 'Services', 'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Promise', 'resource://gre/modules/Promise.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'AddonManager', 'resource://gre/modules/AddonManager.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');
XPCOMUtils.defineLazyModuleGetter(this, 'FullTooltipManager', 'resource://treestyletab-modules/fullTooltip.js');
XPCOMUtils.defineLazyModuleGetter(this, 'TabbarDNDObserver', 'resource://treestyletab-modules/tabbarDNDObserver.js');
XPCOMUtils.defineLazyModuleGetter(this, 'TabpanelDNDObserver', 'resource://treestyletab-modules/tabpanelDNDObserver.js');
XPCOMUtils.defineLazyModuleGetter(this, 'AutoHideBrowser', 'resource://treestyletab-modules/autoHide.js');
XPCOMUtils.defineLazyModuleGetter(this, 'ContentBridge', 'resource://treestyletab-modules/contentBridge.js');
XPCOMUtils.defineLazyModuleGetter(this, 'BrowserUIShowHideObserver', 'resource://treestyletab-modules/browserUIShowHideObserver.js');
XPCOMUtils.defineLazyModuleGetter(this, 'TabAttributesObserver', 'resource://treestyletab-modules/tabAttributesObserver.js');
XPCOMUtils.defineLazyModuleGetter(this, 'TabContentsObserver', 'resource://treestyletab-modules/tabContentsObserver.js');
XPCOMUtils.defineLazyModuleGetter(this, 'visuallyselectedTabs', 'resource://treestyletab-modules/lib/visuallyselectedTabs.jsm');

Cu.import('resource://treestyletab-modules/lib/prefs.js');

XPCOMUtils.defineLazyGetter(this, 'ContextualIdentityService', function() {
	try {
		Cu.import('resource://gre/modules/ContextualIdentityService.jsm');
		return ContextualIdentityService;
	}
	catch(e) {
		return null;
	}
});

function wait(aMilliSeconds) {
	return new Promise(function(aResolve, aReject) {
		setTimeout(function() {
			aResolve();
		}, aMilliSeconds);
	});
}

function log(...aArgs) {
	utils.log('browser', ...aArgs);
}
function logWithStackTrace(...aArgs) {
	utils.logWithStackTrace('browser', ...aArgs);
}

Cu.import('resource://treestyletab-modules/window.js');
 
function TreeStyleTabBrowser(aWindowService, aTabBrowser) 
{
	this.id = Date.now() + '-' + parseInt(Math.random() * 65000);

	this.windowService = aWindowService;
	this.window = aWindowService.window;
	this.document = aWindowService.document;

	this.mTabBrowser = aTabBrowser;
	aTabBrowser.treeStyleTab = this;

	this.tabVisibilityChangedTabs = [];
	this.updateTabsIndentWithDelayTabs = [];
	this.timers = {};

	this.tabVisibilityChangedTabs = [];
	this._updateFloatingTabbarReason = 0;
	this.internallyTabMovingCount = 0;
	this.subTreeMovingCount = 0;
	this.subTreeChildrenMovingCount = 0;
	this._treeViewEnabled = true;

	// This prevents to group home page tabs.
	// Because home tabs are restored for every new windows,
	// we always do this for every startup.
	if (prefs.getPref('browser.startup.page') === 1)
		this.nextOpenedTabToBeParent = false;
}
 
TreeStyleTabBrowser.prototype = inherit(TreeStyleTabWindow.prototype, { 
	
	kMENUITEM_RELOADSUBTREE            : 'context-item-reloadTabSubtree', 
	kMENUITEM_RELOADCHILDREN           : 'context-item-reloadDescendantTabs',
	kMENUITEM_REMOVESUBTREE            : 'context-item-removeTabSubtree',
	kMENUITEM_REMOVECHILDREN           : 'context-item-removeDescendantTabs',
	kMENUITEM_REMOVEALLTABSBUT         : 'context-item-removeAllTabsButThisTree',
	kMENUITEM_COLLAPSEEXPAND_SEPARATOR : 'context-separator-collapseExpandAll',
	kMENUITEM_COLLAPSE                 : 'context-item-collapseAllSubtree',
	kMENUITEM_EXPAND                   : 'context-item-expandAllSubtree',
	kMENUITEM_AUTOHIDE_SEPARATOR       : 'context-separator-toggleAutoHide',
	kMENUITEM_AUTOHIDE                 : 'context-item-toggleAutoHide',
	kMENUITEM_FIXED                    : 'context-item-toggleFixed',
	kMENUITEM_BOOKMARKSUBTREE          : 'context-item-bookmarkTabSubtree',

	kMENUITEM_CLOSE_TABS_TO_END        : 'context_closeTabsToTheEnd',
 
	mTabBrowser : null, 

	indent                     : -1,
	indentProp                 : 'margin',
	indentTarget               : 'left',
	indentCSSProp              : 'margin-left',
	collapseTarget             : 'top',
	collapseCSSProp            : 'margin-top',
	screenPositionProp         : 'screenY',
	offsetProp                 : 'offsetY',
	translateFunction          : 'translateY',
	sizeProp                   : 'height',
	invertedScreenPositionProp : 'screenX',
	invertedSizeProp           : 'width',
	startProp                  : 'top',
	endProp                    : 'bottom',

	maxTreeLevelPhysical : false,

	needRestoreTree : false,

	// Descriptors to cache "last owner" information for tabs.
	// See the definition of TreeStyleTabBrowser.prototype.onTabOpen()
	tabbrowserLastRelateTabHookDescriptor : {
		get : function() {
			return this.__treestyletab__lastRelateTab;
		},
		set : function(aNewRelateTab) {
			if (aNewRelateTab)
				aNewRelateTab.__treestyletab__lastOwner = this.selectedTab.getAttribute(TreeStyleTabBrowser.prototype.kID);
			return this.__treestyletab__lastRelateTab = aNewRelateTab;
		},
		enumerable : true,
		configurable : true
	},
	tabOwnerHookDescriptor : {
		get : function() {
			return this.__treestyletab__owner;
		},
		set : function(aNewOwner) {
			if (aNewOwner)
				this.__treestyletab__lastOwner = aNewOwner.getAttribute(TreeStyleTabBrowser.prototype.kID);
			return this.__treestyletab__owner = aNewOwner;
		},
		enumerable : true,
		configurable : true
	},
 
/* elements */ 
	
	get browser() 
	{
		return this.mTabBrowser;
	},
 
	get container() 
	{
		if (!this._container) {
			this._container = this.document.getElementById('appcontent');
		}
		return this._container;
	},
	_container : null,
 
	get scrollBox() 
	{
		return ( // Tab Mix Plus
				utils.getTreePref('compatibility.TMP') &&
				this.document.getAnonymousElementByAttribute(this.mTabBrowser.tabContainer, 'class', 'tabs-frame')
			) ||
			this.mTabBrowser.tabContainer.mTabstrip;
	},
	get scrollBoxObject()
	{
		var node = this.scrollBox;
		if (node._scrollbox)
			node = node._scrollbox;
		var boxObject = (node.scrollBoxObject || node.boxObject);
		try {
			boxObject = boxObject.QueryInterface(Ci.nsIScrollBoxObject); // for Tab Mix Plus (ensure scrollbox-ed)
		}
		catch(e) {
			// May not implement this interface e.g. after bug 979835
		}
                return boxObject;
	},
 
	get splitter() 
	{
		if (this._splitter)
			return this._splitter;
		var d = this.document;
		return d.getAnonymousElementByAttribute(this.mTabBrowser, 'class', this.kSPLITTER) ||
				d.getAnonymousElementByAttribute(this.mTabBrowser, 'id', 'tabkit-splitter'); // Tab Kit
	},
 
	get toggler() 
	{
		var d = this.document;
		var b = this.mTabBrowser;
		return d.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER);
	},
 
	get tabStripPlaceHolder() 
	{
		return this._tabStripPlaceHolder;
	},
	set tabStripPlaceHolder(value)
	{
		return (this._tabStripPlaceHolder = value);
	},

	get notificationBoxContainers()
	{
		var d = this.document;
		return [
			this.browser,
			d.getElementById('global-notificationbox'),
			d.getElementById('high-priority-global-notificationbox')
		].map(function(aNode) {
			if (aNode) {
				return {
					node : aNode,
					id   : 'notificationBoxContainers(#' + aNode.id + ')'
				};
			}
			else {
				return null;
			}
		}).filter(function(aItem) {
			return aItem;
		});
	},
  
/* properties */ 
	
	get tabbarWidth()
	{
		return this.autoHide.tabbarWidth;
	},
	set tabbarWidth(aValue)
	{
		return this.autoHide.tabbarWidth = aValue;
	},
/* // this section will be used after autoHide feature is separated in the future...
	get tabbarWidth()
	{
		var width = this.getWindowValue(this.kTABBAR_WIDTH);
		return width === '' ?
				utils.getTreePref('tabbar.width') :
				parseInt(width);
	},
	set tabbarWidth(aValue)
	{
		this.setWindowValue(this.kTABBAR_WIDTH, aValue);
		utils.setTreePref('tabbar.width', aValue);
		return aValue;
	},
*/
 
	get tabbarHeight()
	{
		var height = this.getWindowValue(this.kTABBAR_HEIGHT);
		return height === '' ?
				utils.getTreePref('tabbar.height') :
				parseInt(height);
	},
	set tabbarHeight(aValue)
	{
		this.setWindowValue(this.kTABBAR_HEIGHT, aValue);
		utils.setTreePref('tabbar.height', aValue);
		return aValue;
	},
 
	get maxTreeLevel() 
	{
		return this._maxTreeLevel;
	},
	set maxTreeLevel(aValue)
	{
		this._maxTreeLevel = aValue;
		this.setTabbrowserAttribute(this.kMAX_LEVEL, this._maxTreeLevel || '0');
		this.enableSubtreeIndent = this._maxTreeLevel != 0;
		return aValue;
	},
	_maxTreeLevel : -1,
 
	get baseIndent() {
		return this.isVertical ? this.baseIndentVertical : this.baseIndentHorizontal;
	},
 
	get enableSubtreeIndent() 
	{
		return this._enableSubtreeIndent;
	},
	set enableSubtreeIndent(aValue)
	{
		this._enableSubtreeIndent = aValue;
		this.setTabbrowserAttribute(this.kINDENTED, this._enableSubtreeIndent ? 'true' : null);
		return aValue;
	},
	_enableSubtreeIndent : true,
 
	get allowSubtreeCollapseExpand() 
	{
		return this._allowSubtreeCollapseExpand;
	},
	set allowSubtreeCollapseExpand(aValue)
	{
		this._allowSubtreeCollapseExpand = aValue;
		this.setTabbrowserAttribute(this.kALLOW_COLLAPSE, this._allowSubtreeCollapseExpand ? 'true' : null);
		return aValue;
	},
	_allowSubtreeCollapseExpand : true,
 
	get fixed() 
	{
		var orient = this.isVertical ? 'vertical' : 'horizontal' ;
		if (!this.windowService.preInitialized)
			return utils.getTreePref('tabbar.fixed.'+orient);

		var b = this.mTabBrowser;
		if (!b)
			return false;
		return b.getAttribute(this.kFIXED+'-'+orient) == 'true';
	},
	set fixed(aValue)
	{
		this.setTabbrowserAttribute(this.kFIXED, aValue || null, this.mTabBrowser);
		return aValue;
	},
	get isFixed() // for backward compatibility
	{
		return this.fixed;
	},
 
	set temporaryPosition(aValue)
	{
		var position = this.normalizeTabbarPosition(aValue);
		if (position == this.position)
			return position;

		if ('UndoTabService' in this.window && this.window.UndoTabService.isUndoable()) {
			var current = this.position;
			var self = this;
			this.window.UndoTabService.doOperation(
				function() {
					self._changeTabbarPosition(position, true);
					self._temporaryPosition = aValue;
				},
				{
					label  : utils.treeBundle.getString('undo_changeTabbarPosition_label'),
					name   : 'treestyletab-changeTabbarPosition-private',
					data   : {
						oldPosition : current,
						newPosition : position,
						target      : self.mTabBrowser.id
					}
				}
			);
		}
		else {
			this._changeTabbarPosition(position, true);
			this._temporaryPosition = aValue;
		}
		return position;
	},
	_temporaryPosition : null,
 
	get position() /* PUBLIC API */ 
	{
		if (this._temporaryPosition)
			return this._temporaryPosition;

		var lastPosition = this.getWindowValue(this.kTABBAR_POSITION);
		if (lastPosition !== '')
			return lastPosition;

		return (
			// Don't touch to the <tabbrowser/> element before it is initialized by XBL constructor.
			(this.windowService.preInitialized && this.browser.getAttribute(this.kTABBAR_POSITION)) ||
			this.base.position
		);
	},
	set position(aValue)
	{
		var position = this.normalizeTabbarPosition(aValue);
		if (position == this.position)
			return position;

		if ('UndoTabService' in this.window && this.window.UndoTabService.isUndoable()) {
			var current = this.position;
			var self = this;
			this.window.UndoTabService.doOperation(
				function() {
					self._changeTabbarPosition(position);
				},
				{
					label  : utils.treeBundle.getString('undo_changeTabbarPosition_label'),
					name   : 'treestyletab-changeTabbarPosition-private',
					data   : {
						oldPosition : current,
						newPosition : position,
						target      : self.mTabBrowser.id
					}
				}
			);
		}
		else {
			this._changeTabbarPosition(position);
		}
		return position;
	},
	_changeTabbarPosition : function TSTBrowser_changeTabbarPosition(aNewPosition, aIsTemporaryChange)
	{
		if (this.timers['_changeTabbarPosition'])
			clearTimeout(this.timers['_changeTabbarPosition']);

		var oldPosition = this.position;
		this.fireTabbarPositionEvent(true, oldPosition, aNewPosition);

		this.initTabbar(aNewPosition, oldPosition, aIsTemporaryChange);
		this.reinitAllTabs();

		this.timers['_changeTabbarPosition'] = setTimeout((function() {
			try {
				this.checkTabsIndentOverflow();
				this.fireTabbarPositionEvent(false, oldPosition, aNewPosition);
			}
			catch(e) {
				this.defaultErrorHandler(e);
			}
			delete this.timers['_changeTabbarPosition'];
		}).bind(this), 0);
	},
  
/* status getters */ 
	
	get isVertical() 
	{
		if (!this.windowService.preInitialized)
			return ['left', 'right'].indexOf(this.position) > -1;

		var b = this.mTabBrowser;
		if (!b)
			return false;

		if (b.hasAttribute(this.kMODE))
			return b.getAttribute(this.kMODE) == 'vertical';

		var box = this.scrollBox || b.tabContainer ;
		return (box.getAttribute('orient') || this.window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical';
	},
 
	get isVisible()
	{
		var bar = this.ownerToolbar;
		var style = this.window.getComputedStyle(bar, '');
		if (style.visibility != 'visible' || style.display == 'none')
			return false;

		var box = bar.boxObject;
		return !!(box.width || box.height);
	},
 
	isFloating : true, // for backward compatibility (but this should be removed) 
 
	get ownerToolbar() 
	{
		return utils.evaluateXPath(
				'ancestor-or-self::xul:toolbar[1]',
				this.mTabBrowser.tabContainer,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	get canStackTabs() 
	{
		return (
			!this.isVertical &&
			this.canCollapseSubtree() &&
			utils.getTreePref('stackCollapsedTabs')
		);
	},
 
	get counterRole() 
	{
		return this.isVertical ? this.counterRoleVertical : this.counterRoleHorizontal ;
	},
 
	get isDestroying()
	{
		return !this.mTabBrowser || !this.mTabBrowser.tabContainer;
	},
  
/* utils */ 
	
/* get tab contents */ 
	
	getTabLabel : function TSTBrowser_getTabLabel(aTab) 
	{
		var d = this.document;
		var label = d.getAnonymousElementByAttribute(aTab, 'class', 'tab-label-container') || // Firefox 53 and later (and Tab Mix Plus)
					d.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-stack') || // Mac OS X
					d.getAnonymousElementByAttribute(aTab, 'class', 'tab-text tab-label');
		return label;
	},
 
	getTabSoundButton : function TSTBrowser_getTabSoundButton(aTab) 
	{
		return this.document.getAnonymousElementByAttribute(aTab, 'anonid', 'soundplaying-icon');
	},
 
	getTabClosebox : function TSTBrowser_getTabClosebox(aTab) 
	{
		var d = this.document;
		var close = ( // Tab Mix Plus
						utils.getTreePref('compatibility.TMP') &&
						d.getAnonymousElementByAttribute(aTab, 'class', 'tab-close-button always-right')
					) ||
					d.getAnonymousElementByAttribute(aTab, 'anonid', 'close-button') || // with Australis
					d.getAnonymousElementByAttribute(aTab, 'class', 'tab-close-button');
		return close;
	},
 
	getTabTwisty : function TSTBrowser_getTabTwisty(aTab) 
	{
		return this.document.getAnonymousElementByAttribute(aTab, 'class', this.kTWISTY);
	},
 
	getTabTwistyAnchorNode : function TSTBrowser_getTabTwistyAnchorNode(aTab) 
	{
		return this.document.getAnonymousElementByAttribute(aTab, 'class', 'tab-icon') || // Tab Mix Plus
			this.document.getAnonymousElementByAttribute(aTab, 'class', 'tab-throbber');
	},
  
	getTabFromTabbarEvent : function TSTBrowser_getTabFromTabbarEvent(aEvent) 
	{
		if (
			!this.shouldDetectClickOnIndentSpaces ||
			!this.getAncestorTabbarFromEvent(aEvent) ||
			this.isEventFiredOnClickable(aEvent) ||
			this.getSplitterFromEvent(aEvent)
			)
			return null;
		return this.getTabFromCoordinates(aEvent);
	},
	getTabFromCoordinates : function TSTBrowser_getTabFromCoordinates(aCoordinates, aTabs)
	{
		var tab = this.document.elementFromPoint(aCoordinates.clientX, aCoordinates.clientY);
		if (tab && tab.localName == 'tab' && (!aTabs || aTabs.indexOf(tab) > -1))
			return tab;

		var positionCoordinate = aCoordinates[this.screenPositionProp];

		var tabs = aTabs || this.getTabs(this.mTabBrowser);
		if (!tabs.length ||
			this.getTabActualScreenPosition(tabs[0]) > positionCoordinate ||
			this.getTabActualScreenPosition(tabs[tabs.length-1]) < positionCoordinate)
			return null;

		var low = 0;
		var high = tabs.length - 1;
		while (low <= high) {
			let middle = Math.floor((low + high) / 2);
			let position = this.getTabActualScreenPosition(tabs[middle]);
			if (position > positionCoordinate) {
				high = middle - 1;
			}
			else if (position + tabs[middle].boxObject[this.sizeProp] < positionCoordinate) {
				low = middle + 1;
			}
			else {
				return tabs[middle];
			}
		}
		return null;
/*
		var tab = null;
		this.getTabs(this.mTabBrowser).some(function(aTab) {
			var box = aTab.boxObject;
			if (box[this.screenPositionProp] > positionCoordinate ||
				box[this.screenPositionProp] + box[this.sizeProp] < positionCoordinate) {
				return false;
			}
			tab = aTab;
			return true;
		}, this);
		return tab;
*/
	},
 
	getNextFocusedTab : function TSTBrowser_getNextFocusedTab(aTab) 
	{
		return this.getNextSiblingTab(aTab) ||
				this.getPreviousVisibleTab(aTab);
	},
 
	isTabInViewport : function TSTBrowser_isTabInViewport(aTab) 
	{
		if (!this.windowService.preInitialized || !aTab)
			return false;

		if (aTab.pinned)
			return true;

		var tabBox = this.getFutureBoxObject(aTab);
		var barBox = this.scrollBox.boxObject;

		if (this.isVertical)
			return (
				tabBox.screenY >= barBox.screenY &&
				tabBox.screenY + tabBox.height <= barBox.screenY + barBox.height
			);
		else
			return (
				tabBox.screenX >= barBox.screenX &&
				tabBox.screenX + tabBox.width <= barBox.screenX + barBox.width
			);
	},
 
	isTabInternallyMoving : function TSTBrowser_isTabInternallyMoving(aTab)
	{
		if (aTab &&
			aTab.__treestyletab__internallyTabMovingCount)
			return true;
		return Boolean(this.internallyTabMovingCount);
	},
 
	isMultiRow : function TSTBrowser_isMultiRow() 
	{
		var w = this.window;
		return ('tabberwocky' in w && utils.getTreePref('compatibility.Tabberwocky')) ?
				(prefs.getPref('tabberwocky.multirow') && !this.isVertical) :
			('TabmixTabbar' in w && utils.getTreePref('compatibility.TMP')) ?
				w.TabmixTabbar.isMultiRow :
				false ;
	},
 
	positionPinnedTabs : function TSTBrowser_positionPinnedTabs(aWidth, aHeight, aJustNow) 
	{
		log('TSTBrowser:positionPinnedTabs');
		var b = this.mTabBrowser;
		var tabbar = b.tabContainer;
		if (
			!tabbar ||
			!tabbar._positionPinnedTabs ||
			!tabbar.boxObject.width
			)
			return;

		var count = this.pinnedTabsCount;
		if (!this.isVertical || !count) {
			this.resetPinnedTabs();
			b.tabContainer._positionPinnedTabs();
			return;
		}

		var tabbarPlaceHolderWidth = this._tabStripPlaceHolder.boxObject.width;
		var tabbarWidth = this.tabStrip.boxObject.width;

		var maxWidth = tabbarPlaceHolderWidth || tabbarWidth;

		var faviconized = utils.getTreePref('pinnedTab.faviconized');
		var faviconizedSize = tabbar.childNodes[0].boxObject.height;

		var width  = faviconized ? faviconizedSize : maxWidth ;
		var height = faviconizedSize;
		var maxCol = Math.max(1, Math.floor(maxWidth / width));
		var maxRow = Math.ceil(count / maxCol);
		var col    = 0;
		var row    = 0;

		var baseX = this.tabStrip.boxObject.screenX - this.document.documentElement.boxObject.screenX;

		var shrunkenOffset = (this.position == 'right' && tabbarPlaceHolderWidth) ?
								tabbarWidth - tabbarPlaceHolderWidth :
								0 ;

		var removeFaviconizedClassPattern = new RegExp('\\s+'+this.kFAVICONIZED, 'g');

		tabbar.style.MozMarginStart = '';
		tabbar.style.setProperty('margin-top', (height * maxRow)+'px', 'important');
		for (let i = 0; i < count; i++)
		{
			let item = tabbar.childNodes[i];

			let style = item.style;
			style.MozMarginStart = '';

			let transitionStyleBackup = style.transition || '';
			if (aJustNow)
				style.transition = 'none';

			let className = item.className.replace(removeFaviconizedClassPattern, '');
			if (faviconized)
				className += ' '+this.kFAVICONIZED;
			if (className != item.className)
				item.className = className;

			style.maxWidth = style.width = width+'px';
			style.setProperty('margin-left', ((width * col) + shrunkenOffset)+'px', 'important');
			style.left = baseX+'px';
			style.right = 'auto';
			style.marginRight = '';

			style.setProperty('margin-top', (- height * (maxRow - row))+'px', 'important');
			style.top = style.bottom = '';

			log('  tab ' + item._tPos, {
				col : col,
				width : width,
				height : height,
				shrunkenOffset : shrunkenOffset
			});

			if (aJustNow) {
				let key = 'positionPinnedTabs_tab_'+parseInt(Math.random() * 65000);
				// "transition" must be cleared after the reflow.
				this.timers[key] = setTimeout((function() {
					try {
						style.transition = transitionStyleBackup;
					}
					catch(e) {
						this.defaultErrorHandler(e);
					}
					delete this.timers[key];
				}).bind(this), 0);
			}

			col++;
			if (col >= maxCol) {
				col = 0;
				row++;
				log('  new row');
			}
		}
	},
	positionPinnedTabsWithDelay : function TSTBrowser_positionPinnedTabsWithDelay(...aArgs)
	{
		if (this.timers['positionPinnedTabsWithDelay'])
			return;

		var lastArgs = this.timers['positionPinnedTabsWithDelay'] ?
						this.timers['positionPinnedTabsWithDelay'].__treestyletab__args :
						[null, null, false] ;
		lastArgs[0] = lastArgs[0] || aArgs[0];
		lastArgs[1] = lastArgs[1] || aArgs[1];
		lastArgs[2] = lastArgs[2] || aArgs[2];

		var timer = setTimeout((function() {
			setTimeout((function() {
				try {
					// do with delay again, after Firefox's reposition was completely finished.
					this.positionPinnedTabs.apply(this, lastArgs);
				}
				catch(e) {
					this.defaultErrorHandler(e);
				}
				delete this.timers['positionPinnedTabsWithDelay'];
			}).bind(this), 0);
		}).bind(this), 0);
		this.timers['positionPinnedTabsWithDelay'] = {
			timer                : timer,
			__treestyletab__args : lastArgs
		};
	},
 
	resetPinnedTabs : function TSTBrowser_resetPinnedTabs() 
	{
		var b = this.mTabBrowser;
		var tabbar = b.tabContainer;
		tabbar.style.MozMarginStart = tabbar.style.marginTop = '';
		for (var i = 0, count = this.pinnedTabsCount; i < count; i++)
		{
			let style = tabbar.childNodes[i].style;
			style.maxWidth = style.width = style.left = style.right =
				style.MozMarginStart = style.marginLeft = style.marginRight = style.marginTop = '';
		}
	},
 
	updateTabsZIndex : function TSTBrowser_updateTabsZIndex(aStacked) 
	{
		var tabs = this.getTabs(this.mTabBrowser);
		var count = tabs.length;
		for (let i = 0; i < count; i++)
		{
			let tab = tabs[i];
			if (aStacked)
				tab.style.zIndex = count * 1000 - i;
			else
				tab.style.zIndex = '';
		}
	},
 
	fixTooNarrowTabbar : function TSTBrowser_fixTooNarrowTabbar() 
	{
		/**
		 * The tab bar can become smaller than the actual size of the
		 * floating tab bar, and then, we cannot resize tab bar by
		 * dragging anymore. To avoid this problem, we have to enlarge
		 * the tab bar larger than the floating tab bar.
		 */
		if (this.isVertical) {
			let width = this.tabbarWidth;
			let minWidth = Math.max(this.MIN_TABBAR_WIDTH, this.scrollBox.boxObject.width);
			if (minWidth > width) {
				this.tabbarWidth = minWidth;
				this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_PREF_CHANGE);
			}
		}
		else {
			let height = this.tabbarHeight;
			let minHeight = Math.max(this.MIN_TABBAR_HEIGHT, this.scrollBox.boxObject.height);
			if (minHeight > height) {
				this.tabbarHeight = minHeight;
				this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_PREF_CHANGE);
			}
		}
	},
  
/* initialize */ 
	
	init : function TSTBrowser_init() 
	{
		var w = this.window;
		var d = this.document;
		var b = this.mTabBrowser;
		b.tabContainer.treeStyleTab = this;

		visuallyselectedTabs(b);

		this.tabsHash = {};

		if (b.tabContainer.parentNode.localName == 'toolbar')
			b.tabContainer.parentNode.classList.add(this.kTABBAR_TOOLBAR);

		/**
		 * On secondary (and later) window, SSWindowStateBusy event can be fired
		 * before DOMContentLoad, on "domwindowopened".
		 */
		this.needRestoreTree = w.__treestyletab__WindowStateBusy || false;
		this.isWindowBusy = w.__treestyletab__WindowStateBusy || false;
		delete w.__treestyletab__WindowStateBusy;
		if (w.__treestyletab__WindowStateReady) {
			setTimeout(() => {
				this.isWindowBusy = false;
				this.restoreTree()
			}, 0);
		}
		delete w.__treestyletab__WindowStateReady;

		this._initTabbrowserExtraContents();

		var position = this.position;
		this.fireTabbarPositionEvent(this.kEVENT_TYPE_TABBAR_POSITION_CHANGING, 'top', position); /* PUBLIC API */

		this.setTabbrowserAttribute(this.kFIXED+'-horizontal', utils.getTreePref('tabbar.fixed.horizontal') ? 'true' : null, b);
		this.setTabbrowserAttribute(this.kFIXED+'-vertical', utils.getTreePref('tabbar.fixed.vertical') ? 'true' : null, b);
		this.setTabStripAttribute(this.kTAB_STRIP_ELEMENT, true);

		Object.defineProperty(b, '_lastRelatedTab', this.tabbrowserLastRelateTabHookDescriptor);

		/**
		 * <tabbrowser> has its custom background color for itself, but it
		 * prevents to make transparent background of the vertical tab bar.
		 * So, I re-define the background color of content area for
		 * <notificationbox>es via dynamically generated stylesheet.
		 * See:
		 *   https://bugzilla.mozilla.org/show_bug.cgi?id=558585
		 *   http://hg.mozilla.org/mozilla-central/rev/e90bdd97d168
		 */
		if (b.style.backgroundColor) {
			let color = b.style.backgroundColor;
			let pi = d.createProcessingInstruction(
					'xml-stylesheet',
					'type="text/css" href="data:text/css,'+encodeURIComponent(
					('.tabbrowser-tabbox > tabpanels > notificationbox {\n' +
					'  background-color: %COLOR%;\n' +
					'}').replace(/%COLOR%/, color)
					)+'"'
				);
			d.insertBefore(pi, d.documentElement);
			b.style.backgroundColor = '';
		}

		this.initTabbar(null, this.kTABBAR_TOP, true);

		w.addEventListener('resize', this, true);
		ReferenceCounter.add('w,resize,TSTBrowser,true');
		w.addEventListener('beforecustomization', this, true);
		ReferenceCounter.add('w,beforecustomization,TSTBrowser,true');
		w.addEventListener('aftercustomization', this, false);
		ReferenceCounter.add('w,aftercustomization,TSTBrowser,false');
		w.addEventListener('customizationchange', this, false);
		ReferenceCounter.add('w,customizationchange,TSTBrowser,false');
		w.addEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		ReferenceCounter.add('w,kEVENT_TYPE_PRINT_PREVIEW_ENTERED,TSTBrowser,false');
		w.addEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED,  this, false);
		ReferenceCounter.add('w,kEVENT_TYPE_PRINT_PREVIEW_EXITED,TSTBrowser,false');
		w.addEventListener('tabviewframeinitialized', this, false);
		ReferenceCounter.add('w,tabviewframeinitialized,TSTBrowser,false');
		w.addEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);
		ReferenceCounter.add('w,kEVENT_TYPE_TAB_FOCUS_SWITCHING_END,TSTBrowser,false');
		if (!this.needRestoreTree) {
			w.addEventListener('SSWindowStateBusy', this, false);
			ReferenceCounter.add('w,SSWindowStateBusy,TSTBrowser,false');
			w.addEventListener('SSWindowStateReady', this, false);
			ReferenceCounter.add('w,SSWindowStateReady,TSTBrowser,false');
		}

		for (let container of this.notificationBoxContainers)
		{
			container.node.addEventListener('transitionend', this, false);
			ReferenceCounter.add(container.id + ',transitionend,TSTBrowser,false');
			container.node.addEventListener('transitioncancel', this, false);
			ReferenceCounter.add(container.id + ',transitioncancel,TSTBrowser,false');
			container.node.addEventListener('transitionrun', this, false);
			ReferenceCounter.add(container.id + ',transitionrun,TSTBrowser,false');
		}

		b.addEventListener('DOMAudioPlaybackStarted', this, false);
		ReferenceCounter.add('b,DOMAudioPlaybackStarted,TSTBrowser,false');
		b.addEventListener('DOMAudioPlaybackStopped', this, false);
		ReferenceCounter.add('b,DOMAudioPlaybackStopped,TSTBrowser,false');

		b.addEventListener('nsDOMMultipleTabHandlerTabsClosing', this, false);
		ReferenceCounter.add('b,nsDOMMultipleTabHandlerTabsClosing,TSTBrowser,false');

		w['piro.sakura.ne.jp'].tabsDragUtils.initTabBrowser(b);

		w.TreeStyleTabWindowHelper.initTabbrowserMethods(b);
		this._initTabbrowserContextMenu();
		w.TreeStyleTabWindowHelper.updateTabDNDObserver(b);

		this.tabsAttributeObserver = new TabAttributesObserver({
			container  : b.tabContainer,
			attributes : 'usercontextid',
			callback   : (function(aTab) {
				this.onTabContextIdChanged(aTab);
			}).bind(this)
		});

		this.getAllTabs(b).forEach(this.initTab, this);

		this.allowSubtreeCollapseExpand = true; // reset attribute

		this.onPrefChange('extensions.treestyletab.maxTreeLevel');
		this.onPrefChange('extensions.treestyletab.tabbar.style');
		this.onPrefChange('extensions.treestyletab.twisty.style');
		this.onPrefChange('extensions.treestyletab.showBorderForFirstTab');
		this.onPrefChange('extensions.treestyletab.tabbar.invertTabContents');
		this.onPrefChange('extensions.treestyletab.tabbar.invertClosebox');
		this.onPrefChange('extensions.treestyletab.tabbar.autoShow.mousemove');
		this.onPrefChange('extensions.treestyletab.tabbar.invertScrollbar');
		this.onPrefChange('extensions.treestyletab.tabbar.narrowScrollbar');
		this.onPrefChange('toolkit.cosmeticAnimations.enabled');
		this.onPrefChange('browser.tabs.animate');

		Services.obs.addObserver(this, this.kTOPIC_INDENT_MODIFIED, false);
		Services.obs.addObserver(this, this.kTOPIC_COLLAPSE_EXPAND_ALL, false);
		Services.obs.addObserver(this, this.kTOPIC_CHANGE_TREEVIEW_AVAILABILITY, false);
		Services.obs.addObserver(this, 'lightweight-theme-styling-update', false);
		prefs.addPrefListener(this);

		// Don't init these ovservers on this point to avoid needless initializations.
		//   this.tabbarDNDObserver;
		//   this.panelDNDObserver;
		this._readyToInitDNDObservers();

		this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_INITIALIZE);
		this.fixTooNarrowTabbar();

		this.fireTabbarPositionEvent(false, 'top', position); /* PUBLIC API */
	},
	
	_initTabbrowserExtraContents : function TSTBrowser_initTabbrowserExtraContents() 
	{
		var d = this.document;
		var b = this.mTabBrowser;

		var toggler = this.toggler;
		if (!toggler) {
			toggler = d.createElement('spacer');
			toggler.setAttribute(this.kTAB_STRIP_ELEMENT, true);
			toggler.setAttribute('class', this.kTABBAR_TOGGLER);
			toggler.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468
			b.mTabBox.insertBefore(toggler, b.mTabBox.firstChild);
			if (b.mTabDropIndicatorBar == toggler)
				b.mTabDropIndicatorBar = d.getAnonymousElementByAttribute(b, 'class', 'tab-drop-indicator-bar');
		}

		var placeHolder = d.getAnonymousElementByAttribute(b, 'anonid', 'strip');
		if (!placeHolder) {
			placeHolder = d.createElement('hbox');
			placeHolder.setAttribute(this.kTAB_STRIP_ELEMENT, true);
			placeHolder.setAttribute('anonid', 'strip');
			placeHolder.setAttribute('class', 'tabbrowser-strip '+this.kTABBAR_PLACEHOLDER);
			placeHolder.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468
			b.mTabBox.insertBefore(placeHolder, toggler.nextSibling);
		}
		this.tabStripPlaceHolder = (placeHolder != this.tabStrip) ? placeHolder : null ;

		if (this.tabStripPlaceHolder)
			this.tabStripPlaceHolderBoxObserver = new BrowserUIShowHideObserver(this, this.tabStripPlaceHolder.parentNode);

		this.tabContentsObserver = new TabContentsObserver(this, this.tabStrip);
	},
 
	_initTabbrowserContextMenu : function TSTBrowser_initTabbrowserContextMenu() 
	{
		var w = this.window;
		var d = this.document;
		var b = this.mTabBrowser;

		var tabContextMenu = b.tabContextMenu ||
							d.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContextMenu.addEventListener('popupshowing', this, false);
		ReferenceCounter.add('tabContextMenu,popupshowing,TSTBrowser,false');
		if (!('MultipleTabService' in w)) {
			w.setTimeout(function(aSelf, aTabBrowser, aPopup) {
				let suffix = '-tabbrowser-'+(aTabBrowser.id || 'instance-'+parseInt(Math.random() * 65000));
				let ids = [
						aSelf.kMENUITEM_RELOADSUBTREE,
						aSelf.kMENUITEM_RELOADCHILDREN,
						aSelf.kMENUITEM_REMOVESUBTREE,
						aSelf.kMENUITEM_REMOVECHILDREN,
						aSelf.kMENUITEM_REMOVEALLTABSBUT,
						aSelf.kMENUITEM_COLLAPSEEXPAND_SEPARATOR,
						aSelf.kMENUITEM_COLLAPSE,
						aSelf.kMENUITEM_EXPAND,
						aSelf.kMENUITEM_AUTOHIDE_SEPARATOR,
						aSelf.kMENUITEM_AUTOHIDE,
						aSelf.kMENUITEM_FIXED,
						aSelf.kMENUITEM_BOOKMARKSUBTREE
					];
				for (let i = 0, maxi = ids.length; i < maxi; i++)
				{
					let id = ids[i];
					let item = d.getElementById(id).cloneNode(true);
					item.setAttribute('id', item.getAttribute('id')+suffix);

					let refNode = void(0);
					let insertAfter = item.getAttribute('multipletab-insertafter');
					if (insertAfter) {
						try {
							refNode = utils.evaluateXPath(
									insertAfter.replace(/^\s*xpath:\s*/i, ''),
									tabContextMenu,
									Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
								).singleNodeValue;
							if (refNode) refNode = refNode.nextSibling;
						}
						catch(e) {
						}
					}
					let insertBefore = item.getAttribute('multipletab-insertbefore');
					if (refNode === void(0) && insertBefore) {
						try {
							refNode = utils.evaluateXPath(
									insertBefore.replace(/^\s*xpath:\s*/i, ''),
									tabContextMenu,
									Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
								).singleNodeValue;
						}
						catch(e) {
						}
					}
					aPopup.insertBefore(item, refNode || null);
				}
				tabContextMenu = null;
			}, 0, this, b, tabContextMenu);
		}

		let closeTabsToEnd = d.getElementById(this.kMENUITEM_CLOSE_TABS_TO_END);
		if (closeTabsToEnd) {
			this._closeTabsToEnd_horizontalLabel = closeTabsToEnd.getAttribute('label');
			this._closeTabsToEnd_horizontalAccesskey = closeTabsToEnd.getAttribute('accesskey');
		}

		var removeTabItem = d.getAnonymousElementByAttribute(b, 'id', 'context_closeTab');
		if (removeTabItem) {
			removeTabItem.setAttribute(
				'oncommand',
				removeTabItem.getAttribute('oncommand').replace(
					/(tabbrowser\.removeTab\(([^\)]+)\))/,
					'if (tabbrowser.treeStyleTab.warnAboutClosingTabSubtreeOf($2)) $1'
				)
			);
		}
	},
 
	_initTooltipManager : function TSTBrowser_initTooltipManager() 
	{
		if (this.tooltipManager)
			return;

		this.tooltipManager = new FullTooltipManager(this);
	},
 
	_readyToInitDNDObservers : function TSTBrowser_readyToInitDNDObservers() 
	{
		var w = this.window;
		this._DNDObserversInitialized = false;
		w.addEventListener('mouseover', this, true);
		ReferenceCounter.add('w,mouseover,TSTBrowser,true');
		w.addEventListener('dragover', this, true);
		ReferenceCounter.add('w,dragover,TSTBrowser,true');
	},
	
	_initDNDObservers : function TSTBrowser_initDNDObservers() 
	{
		if (this._DNDObserversInitialized)
			return;

		this.tabbarDNDObserver;
		this.panelDNDObserver;

		var w = this.window;
		w.removeEventListener('mouseover', this, true);
		ReferenceCounter.remove('w,mouseover,TSTBrowser,true');
		w.removeEventListener('dragover', this, true);
		ReferenceCounter.remove('w,dragover,TSTBrowser,true');
		this._DNDObserversInitialized = true;
	},
  
	initTab : function TSTBrowser_initTab(aTab) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		if (!aTab.hasAttribute(this.kID)) {
			let id = this.getTabValue(aTab, this.kID) || this.makeNewId();
			aTab.setAttribute(this.kID, id);
			aTab.setAttribute(this.kID_NEW, id);
			aTab.setAttribute(this.kSUBTREE_COLLAPSED, true);
			aTab.setAttribute(this.kALLOW_COLLAPSE, true);
			let key = 'initTab_'+id;
			if (this.timers[key])
				clearTimeout(this.timers[key]);
			this.timers[key] = setTimeout((function() {
				try {
					if (aTab.getAttribute(this.kID) == id) { // not changed by someone!
						aTab.removeAttribute(this.kID_NEW);
						if (!this.getTabValue(aTab, this.kID)) {
							this.setTabValue(aTab, this.kID, id);
							if (!(id in this.tabsHash))
								this.tabsHash[id] = aTab;
						}
					}
				}
				catch(e) {
					this.defaultErrorHandler(e);
				}
				delete this.timers[key];
			}).bind(this), 0);
			if (!(id in this.tabsHash))
				this.tabsHash[id] = aTab;
		}
		else {
			// if the tab is restored from session, it can be not-cached.
			let id = aTab.getAttribute(this.kID);
			if (!(id in this.tabsHash))
				this.tabsHash[id] = aTab;
		}

		aTab.__treestyletab__linkedTabBrowser = this.mTabBrowser;
		aTab.__treestyletab__restoreState = this.RESTORE_STATE_INITIAL;
		aTab.__treestyletab__internallyTabMovingCount = 0;

		if (utils.isTabNotRestoredYet(aTab))
			aTab.__treestyletab__toBeRestored = true;

		this.initTabAttributes(aTab);
		this.initTabContents(aTab);
		this.window.TreeStyleTabWindowHelper.initTabMethods(aTab, this.mTabBrowser);

		if (!aTab.hasAttribute(this.kNEST))
			aTab.setAttribute(this.kNEST, 0);

		aTab.__treestyletab__contentBridge = new ContentBridge(aTab, this.mTabBrowser);
		this.autoHide.notifyStatusToTab(aTab);

		this.onTabContextIdChanged(aTab);
	},
	
	isTabInitialized : function TSTBrowser_isTabInitialized(aTab) 
	{
		return aTab.getAttribute(this.kID);
	},
 
	ensureTabInitialized : function TSTBrowser_ensureTabInitialized(aTab) 
	{
		if (!aTab || this.isTabInitialized(aTab))
			return;
		this.initTab(aTab);
	},
 
	initTabAttributes : function TSTBrowser_initTabAttributes(aTab) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		var pos = this.position;
		if (pos == 'left' || pos == 'right') {
			aTab.setAttribute('align', 'stretch');
			aTab.removeAttribute('maxwidth');
			aTab.removeAttribute('minwidth');
			aTab.removeAttribute('width');
			aTab.removeAttribute('flex');
			aTab.maxWidth = 65000;
			aTab.minWidth = 0;
			if (utils.getTreePref('compatibility.TMP'))
				aTab.setAttribute('dir', 'ltr'); // Tab Mix Plus
		}
		else {
			aTab.removeAttribute('align');
			aTab.removeAttribute('maxwidth');
			aTab.removeAttribute('minwidth');
			if (utils.getTreePref('compatibility.TMP'))
				aTab.removeAttribute('dir'); // Tab Mix Plus
		}
	},
 
	initTabContents : function TSTBrowser_initTabContents(aTab) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		var d = this.document;

		var twisty = this.getTabTwisty(aTab);
		var anchor = this.getTabTwistyAnchorNode(aTab);
		if (anchor && !twisty) {
			twisty = d.createElement('image');
			twisty.setAttribute('class', this.kTWISTY);
			anchor.parentNode.appendChild(twisty);
		}

		var label = this.getTabLabel(aTab);
		var counter = d.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER);
		if (label && !counter) {
			counter = d.createElement('hbox');
			counter.setAttribute('class', this.kCOUNTER_CONTAINER);

			let startParen = counter.appendChild(d.createElement('label'));
			startParen.setAttribute('class', this.kCOUNTER_PAREN);
			startParen.setAttribute('value', '(');

			let counterLabel = counter.appendChild(d.createElement('label'));
			counterLabel.setAttribute('class', this.kCOUNTER);
			counterLabel.setAttribute('value', '0');

			let endParen = counter.appendChild(d.createElement('label'));
			endParen.setAttribute('class', this.kCOUNTER_PAREN);
			endParen.setAttribute('value', ')');

			/** XXX
			 * Insertion before an anonymous element breaks its "xbl:inherits".
			 * For example, "xbl:inherits" of the closebox in a tab (Tab Mix Plus
			 * defines it) doesn't work. So, I don't use insertBefore().
			 * Instead, the counter will be rearranged by "ordinal" attribute
			 * given by initTabContentsOrder().
			 */
			// label.parentNode.insertBefore(counter, label.nextSibling);
			label.parentNode.appendChild(counter);
		}

		this.initTabContentsOrder(aTab, true);
	},
 
	initTabContentsOrder : function TSTBrowser_initTabContentsOrder(aTab, aForce) 
	{
		if (
			!aTab.parentNode || // do nothing for closed tab!
			aTab.__treestyletab__initializingContentsOrder
			)
			return;

		aTab.__treestyletab__initializingContentsOrder = true;

		try {
			var d = this.document;
			var namedNodes = {
					label        : this.getTabLabel(aTab),
					sound        : this.getTabSoundButton(aTab),
					close        : this.getTabClosebox(aTab),
					twistyAnchor : this.getTabTwistyAnchorNode(aTab),
					twisty       : this.getTabTwisty(aTab),
					counter      : d.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER)
				};

			namedNodes.closeAnchor = namedNodes.label;
			if (namedNodes.closeAnchor.parentNode != namedNodes.close.parentNode) {
				let containerFinder = d.createRange();
				containerFinder.selectNode(namedNodes.closeAnchor);
				containerFinder.setEndAfter(namedNodes.close);
				let container = containerFinder.commonAncestorContainer;
				while (namedNodes.closeAnchor.parentNode != container)
				{
					namedNodes.closeAnchor = namedNodes.closeAnchor.parentNode;
				}
				while (namedNodes.close.parentNode != container)
				{
					namedNodes.close = namedNodes.close.parentNode;
				}
			}

			namedNodes.counterAnchor = namedNodes.label;

			var foundContainers = [];
			var containers = [
					namedNodes.twistyAnchor && namedNodes.twistyAnchor.parentNode,
					namedNodes.label && namedNodes.label.parentNode,
					namedNodes.counter && namedNodes.counter.parentNode,
					namedNodes.closeAnchor && namedNodes.closeAnchor.parentNode
				];
			for (let i = 0, maxi = containers.length; i < maxi; i++)
			{
				let container = containers[i];
				if (!container ||
					foundContainers.indexOf(container) > -1)
					continue;
				this.initTabContentsOrderInternal(container, namedNodes, aForce);
				foundContainers.push(container);
			}
		}
		finally {
			delete aTab.__treestyletab__initializingContentsOrder;
		}
	},
	initTabContentsOrderInternal : function TSTBrowser_initTabContentsOrderInternal(aContainer, aNamedNodes, aForce) 
	{
		if (this.window.getComputedStyle(aContainer, '').getPropertyValue('-moz-box-orient') == 'vertical')
			return;

		var nodes = [...(this.document.getAnonymousNodes(aContainer) || aContainer.childNodes)];

		// reset order at first!
		for (let i = 0, maxi = nodes.length; i < maxi; i++)
		{
			let node = nodes[i];
			if (node.getAttribute('class') == 'informationaltab-thumbnail-container')
				continue;
			node.setAttribute('ordinal', i);
		}

		// after that, rearrange contents

		var index = nodes.indexOf(aNamedNodes.close);
		if (index > -1) {
			nodes.splice(index, 1);
			if (this.mTabBrowser.getAttribute(this.kCLOSEBOX_INVERTED) == 'true')
				nodes.splice(nodes.indexOf(aNamedNodes.closeAnchor), 0, aNamedNodes.close);
			else
				nodes.push(aNamedNodes.close);
		}

		index = nodes.indexOf(aNamedNodes.sound);
		if (index > -1) {
			nodes.splice(index, 1);
			let closeIndex = nodes.indexOf(aNamedNodes.close);
			if (closeIndex < 0)
				nodes.push(aNamedNodes.sound);
			else
				nodes.splice(closeIndex, 0, aNamedNodes.sound);
		}

		index = nodes.indexOf(aNamedNodes.twisty);
		if (index > -1) {
			nodes.splice(index, 1);
			nodes.splice(nodes.indexOf(aNamedNodes.twistyAnchor), 0, aNamedNodes.twisty);
		}

		if (this.mTabBrowser.getAttribute(this.kTAB_CONTENTS_INVERTED) == 'true')
			nodes.reverse();

		// counter must rightside of the label!
		index = nodes.indexOf(aNamedNodes.counter);
		if (index > -1) {
			nodes.splice(index, 1);
			nodes.splice(nodes.indexOf(aNamedNodes.counterAnchor)+1, 0, aNamedNodes.counter);
		}

		var count = nodes.length;
		nodes.reverse();
		for (let i = 0, maxi = nodes.length; i < maxi; i++)
		{
			let node = nodes[i];
			if (node.getAttribute('class') == 'informationaltab-thumbnail-container')
				continue;
			node.setAttribute('ordinal', (count - i + 1) * 100);
		}

		if (aForce) {
			/**
			 * After the order of contents are changed dynamically,
			 * Gecko doesn't re-render them in the new order.
			 * Changing of "display" or "position" can fix this problem.
			 */
			let shouldHideTemporaryState = (
					'TabmixTabbar' in this.window || // Tab Mix Plus
					'InformationalTabService' in this.window // Informational Tab
				);
			for (let i = 0, maxi = nodes.length; i < maxi; i++)
			{
				let node = nodes[i];
				if (shouldHideTemporaryState)
					node.style.visibility = 'hidden';
				node.style.position = 'fixed';
			}
			let key = 'initTabContentsOrderInternal_'+parseInt(Math.random() * 65000);
			this.timers[key] = setTimeout((function() {
				try {
					for (let i = 0, maxi = nodes.length; i < maxi; i++)
					{
						let node = nodes[i];
						node.style.position = '';
						if (shouldHideTemporaryState)
							node.style.visibility = '';
					}
				}
				catch(e) {
					this.defaultErrorHandler(e);
				}
				delete this.timers[key];
			}).bind(this), 100);
		}
	},
 
	updateInvertedTabContentsOrder : function TSTBrowser_updateInvertedTabContentsOrder(aTarget) 
	{
		let key = 'updateInvertedTabContentsOrder_'+parseInt(Math.random() * 65000);
		this.timers[key] = setTimeout((function() {
			try {
				var b = this.mTabBrowser;
				var tabs = !aTarget ?
							[b.selectedTab] :
						(aTarget instanceof this.window.Element) ?
							[aTarget] :
						(typeof aTarget == 'object' && 'length' in aTarget) ?
							[...aTarget] :
							this.getAllTabs(b);
				for (let i = 0, maxi = tabs.length; i < maxi; i++)
				{
					this.initTabContentsOrder(tabs[i]);
				}
			}
			catch(e) {
				this.defaultErrorHandler(e);
			}
			delete this.timers[key];
		}).bind(this), 0);
	},
  
	initTabbar : function TSTBrowser_initTabbar(aNewPosition, aOldPosition, aIsTemporaryChange) 
	{
		var d = this.document;
		var b = this.mTabBrowser;

		if (aNewPosition && typeof aNewPosition == 'string')
			aNewPosition = this.getPositionFlag(aNewPosition);
		if (aOldPosition && typeof aOldPosition == 'string')
			aOldPosition = this.getPositionFlag(aOldPosition);

		this._startListenTabbarEvents();
		this.window.TreeStyleTabWindowHelper.initTabbarMethods(b);

		var pos = aNewPosition || this.getPositionFlag(this.position);
		if (b.getAttribute('id') != 'content' &&
			!utils.getTreePref('tabbar.position.subbrowser.enabled')) {
			pos = this.kTABBAR_TOP;
		}

		if (!aIsTemporaryChange) {
			let positionName = this.normalizeTabbarPosition(pos);
			this.setWindowValue(this.kTABBAR_POSITION, positionName);
			utils.setTreePref('tabbar.position', positionName);
		}

		aOldPosition = aOldPosition || pos;

		var strip = this.tabStrip;
		var placeHolder = this.tabStripPlaceHolder || strip;
		var splitter = this._ensureNewSplitter();

		// Tab Mix Plus
		var scrollFrame, newTabBox, tabBarMode;
		if (utils.getTreePref('compatibility.TMP')) {
			scrollFrame = d.getAnonymousElementByAttribute(b.tabContainer, 'class', 'tabs-frame') ||
							d.getAnonymousElementByAttribute(b.tabContainer, 'anonid', 'scroll-tabs-frame');
			newTabBox = d.getAnonymousElementByAttribute(b.tabContainer, 'id', 'tabs-newbutton-box');
			let newTabButton = d.getElementById('new-tab-button');
			if (newTabButton && newTabButton.parentNode == b.tabContainer._container)
				newTabBox = newTabButton;
			tabBarMode = prefs.getPref('extensions.tabmix.tabBarMode');
		}

		// All-in-One Sidebar
		var toolboxContainer = d.getAnonymousElementByAttribute(strip, 'anonid', 'aiostbx-toolbox-tableft');
		if (toolboxContainer)
			toolboxContainer = toolboxContainer.parentNode;

		var scrollInnerBox = b.tabContainer.mTabstrip._scrollbox ?
				d.getAnonymousNodes(b.tabContainer.mTabstrip._scrollbox)[0] :
				scrollFrame; // Tab Mix Plus

		this.removeTabbrowserAttribute(this.kRESIZING, b);

		this.removeTabStripAttribute('width');
		b.mPanelContainer.removeAttribute('width');

		var delayedPostProcess;

		if (pos & this.kTABBAR_VERTICAL) {
			this.collapseTarget             = 'top';
			this.screenPositionProp         = 'screenY';
			this.offsetProp                 = 'offsetY';
			this.translateFunction          = 'translateY';
			this.sizeProp                   = 'height';
			this.invertedScreenPositionProp = 'screenX';
			this.invertedSizeProp           = 'width';
			this.startProp                  = 'top';
			this.endProp                    = 'bottom';

			b.mTabBox.orient = splitter.orient = 'horizontal';
			strip.orient =
				placeHolder.orient =
				this.toggler.orient =
				b.tabContainer.orient =
				b.tabContainer.mTabstrip.orient =
				b.tabContainer.mTabstrip.parentNode.orient = 'vertical';
			b.tabContainer.setAttribute('align', 'stretch'); // for Mac OS X
			if (scrollInnerBox)
				scrollInnerBox.removeAttribute('flex');

			if (utils.getTreePref('compatibility.TMP') && scrollFrame) { // Tab Mix Plus
				d.getAnonymousNodes(scrollFrame)[0].removeAttribute('flex');
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'vertical';
				if (newTabBox)
					newTabBox.orient = 'horizontal';
				if (tabBarMode == 2)
					prefs.setPref('extensions.tabmix.tabBarMode', 1);
			}

			if (toolboxContainer)
				toolboxContainer.orient = 'vertical';

			this.setTabbrowserAttribute(this.kMODE, 'vertical');

			//let width = this.maxTabbarWidth(this.tabbarWidth, b);
			let width = this.maxTabbarWidth(this.autoHide.expandedWidth, b);
			this.setTabStripAttribute('width', width);
			this.removeTabStripAttribute('height');
			b.mPanelContainer.removeAttribute('height');

			if (strip.localName == 'toolbar') {
				let nodes = strip.childNodes;
				for (let i = 0, maxi = nodes.length; i < maxi; i++)
				{
					let node = nodes[i];
					if (node.localName == 'tabs')
						continue;
					if (node.hasAttribute('flex'))
						node.setAttribute('treestyletab-backup-flex', node.getAttribute('flex'));
					node.removeAttribute('flex');
				}
			}

			if (pos == this.kTABBAR_RIGHT) {
				this.setTabbrowserAttribute(this.kTABBAR_POSITION, 'right');
				if (utils.getTreePref('tabbar.invertTab')) {
					this.setTabbrowserAttribute(this.kTAB_INVERTED, 'true');
					this.indentTarget = 'right';
				}
				else {
					this.removeTabbrowserAttribute(this.kTAB_INVERTED);
					this.indentTarget = 'left';
				}
				delayedPostProcess = function(aSelf, aTabBrowser, aSplitter, aToggler) {
					/* in Firefox 3, the width of the rightside tab bar
					   unexpectedly becomes 0 on the startup. so, we have
					   to set the width again. */
					aSelf.setTabStripAttribute('width', width);
					aSelf.setTabStripAttribute('ordinal', 30);
					aSplitter.setAttribute('ordinal', 20);
					aToggler.setAttribute('ordinal', 40);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 10);
					aSplitter.setAttribute('collapse', 'after');
				};
			}
			else {
				this.setTabbrowserAttribute(this.kTABBAR_POSITION, 'left');
				this.removeTabbrowserAttribute(this.kTAB_INVERTED);
				this.indentTarget = 'left';
				delayedPostProcess = function(aSelf, aTabBrowser, aSplitter, aToggler) {
					aSelf.setTabStripAttribute('ordinal', 10);
					aSplitter.setAttribute('ordinal', 20);
					aToggler.setAttribute('ordinal', 5);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 30);
					aSplitter.setAttribute('collapse', 'before');
				};
			}
		}
		else {
			this.collapseTarget             = 'left';
			this.screenPositionProp         = 'screenX';
			this.offsetProp                 = 'offsetX';
			this.translateFunction          = 'translateX';
			this.sizeProp                   = 'width';
			this.invertedScreenPositionProp = 'screenY';
			this.invertedSizeProp           = 'height';
			this.startProp                  = 'left';
			this.endProp                    = 'right';

			b.mTabBox.orient = splitter.orient = 'vertical';
			strip.orient =
				placeHolder.orient =
				this.toggler.orient =
				b.tabContainer.orient =
				b.tabContainer.mTabstrip.orient =
				b.tabContainer.mTabstrip.parentNode.orient = 'horizontal';
			b.tabContainer.removeAttribute('align'); // for Mac OS X
			if (scrollInnerBox)
				scrollInnerBox.setAttribute('flex', 1);

			if (utils.getTreePref('compatibility.TMP') && scrollFrame) { // Tab Mix Plus
				d.getAnonymousNodes(scrollFrame)[0].setAttribute('flex', 1);
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'horizontal';
				if (newTabBox)
					newTabBox.orient = 'vertical';
			}

			if (toolboxContainer)
				toolboxContainer.orient = 'horizontal';

			this.setTabbrowserAttribute(this.kMODE, utils.getTreePref('tabbar.multirow') ? 'multirow' : 'horizontal');
			this.removeTabbrowserAttribute(this.kTAB_INVERTED);

			if (strip.localName == 'toolbar') {
				let nodes = strip.childNodes;
				for (let i = 0, maxi = nodes.length; i < maxi; i++)
				{
					let node = nodes[i];
					if (node.localName == 'tabs')
						continue;
					let flex = node.hasAttribute('treestyletab-backup-flex');
					if (!flex)
						continue;
					node.setAttribute('flex', flex);
					node.removeAttribute('treestyletab-backup-flex');
				}
			}

			if (pos == this.kTABBAR_BOTTOM) {
				this.setTabbrowserAttribute(this.kTABBAR_POSITION, 'bottom');
				this.indentTarget = 'bottom';
				delayedPostProcess = function(aSelf, aTabBrowser, aSplitter, aToggler) {
					aSelf.setTabStripAttribute('ordinal', 30);
					aSplitter.setAttribute('ordinal', 20);
					aToggler.setAttribute('ordinal', 40);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 10);
				};
			}
			else {
				this.setTabbrowserAttribute(this.kTABBAR_POSITION, 'top');
				this.indentTarget = 'top';
				delayedPostProcess = function(aSelf, aTabBrowser, aSplitter, aToggler) {
					aSelf.setTabStripAttribute('ordinal', 10);
					aSplitter.setAttribute('ordinal', 20);
					aToggler.setAttribute('ordinal', 5);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 30);
				};
			}
		}

		// init() can fail to set the tab-strip-element attribute for the internal box,
		// because the custom binding can be not applied yet at the time.
		// We have to set it certainly.
		this.setTabStripAttribute(this.kTAB_STRIP_ELEMENT, true);

		var tabs = this.getAllTabs(b);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			tab.style.removeProperty(this.indentCSSProp);
			tab.style.removeProperty(this.collapseCSSProp);
		}

		this.indentProp = utils.getTreePref('indent.property');
		this.indentCSSProp = this.indentProp+'-'+this.indentTarget;
		this.collapseCSSProp = 'margin-'+this.collapseTarget;

		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			this.updateTabCollapsed(tab, tab.getAttribute(this.kCOLLAPSED) == 'true', true);
		}

		// for updateTabbarOverflow(), we should reset the "overflow" now.
		b.tabContainer.removeAttribute('overflow');
		{
			let container = this.document.getAnonymousElementByAttribute(b.tabContainer, 'class', 'tabs-container');
			if (container)
				container.removeAttribute('overflow');
		}

		this.updateTabbarState(false);

		if (this.timers['initTabbar'])
			clearTimeout(this.timers['initTabbar']);

		this.timers['initTabbar'] = setTimeout((function() {
			try {
				delayedPostProcess(this, b, splitter, this.toggler);
				this.updateTabbarOverflow();
				this.updateAllTabsButton(b);
				this.updateAllTabsAsParent();
				delayedPostProcess = null;
				this.mTabBrowser.style.visibility = '';

				var event = d.createEvent('Events');
				event.initEvent(this.kEVENT_TYPE_TABBAR_INITIALIZED, true, false);
				this.mTabBrowser.dispatchEvent(event);
			}
			catch(e) {
				this.defaultErrorHandler(e);
			}
			delete this.timers['initTabbar'];
		}).bind(this), 0);

		pos = null;
		scrollFrame = null;
		newTabBox = null
		tabBarMode = null;
		toolboxContainer = null;
		scrollInnerBox = null;
		scrollInnerBox = null;

		return new Promise((function(aResolve, aReject) {
			var onInitialized = (function() {
				this.mTabBrowser.removeEventListener(this.kEVENT_TYPE_TABBAR_INITIALIZED, onInitialized, false);
				ReferenceCounter.remove('mTabBrowser,kEVENT_TYPE_TABBAR_INITIALIZED,onInitialized,false');
				if (!aIsTemporaryChange)
					delete this._temporaryPosition;
				aResolve();
			}).bind(this);
			this.mTabBrowser.addEventListener(this.kEVENT_TYPE_TABBAR_INITIALIZED, onInitialized, false);
			ReferenceCounter.add('mTabBrowser,kEVENT_TYPE_TABBAR_INITIALIZED,onInitialized,false');
		}).bind(this));
	},
	
	_startListenTabbarEvents : function TSTBrowser_startListenTabbarEvents() 
	{
		var b = this.mTabBrowser;

		var tabContainer = b.tabContainer;
		tabContainer.addEventListener('TabOpen',        this, true);
		ReferenceCounter.add('tabContainer,TabOpen,TSTBrowser,true');
		tabContainer.addEventListener('TabClose',       this, true);
		ReferenceCounter.add('tabContainer,TabClose,TSTBrowser,true');
		tabContainer.addEventListener('TabMove',        this, true);
		ReferenceCounter.add('tabContainer,TabMove,TSTBrowser,true');
		tabContainer.addEventListener('TabShow',        this, true);
		ReferenceCounter.add('tabContainer,TabShow,TSTBrowser,true');
		tabContainer.addEventListener('TabHide',        this, true);
		ReferenceCounter.add('tabContainer,TabHide,TSTBrowser,true');
		tabContainer.addEventListener('TabAttrModified', this, true);
		ReferenceCounter.add('tabContainer,TabAttrModified,TSTBrowser,true');
		tabContainer.addEventListener('SSTabRestoring', this, true);
		ReferenceCounter.add('tabContainer,SSTabRestoring,TSTBrowser,true');
		tabContainer.addEventListener('SSTabRestored',  this, true);
		ReferenceCounter.add('tabContainer,SSTabRestored,TSTBrowser,true');
		tabContainer.addEventListener('TabPinned',      this, true);
		ReferenceCounter.add('tabContainer,TabPinned,TSTBrowser,true');
		tabContainer.addEventListener('TabUnpinned',    this, true);
		ReferenceCounter.add('tabContainer,TabUnpinned,TSTBrowser,true');
		tabContainer.addEventListener('mouseover', this, true);
		ReferenceCounter.add('tabContainer,mouseover,TSTBrowser,true');
		tabContainer.addEventListener('mouseout', this, true);
		ReferenceCounter.add('tabContainer,mouseout,TSTBrowser,true');
		tabContainer.addEventListener('dblclick',  this, true);
		ReferenceCounter.add('tabContainer,dblclick,TSTBrowser,true');
		tabContainer.addEventListener('select', this, true);
		ReferenceCounter.add('tabContainer,select,TSTBrowser,true');
		tabContainer.addEventListener('scroll', this, true);
		ReferenceCounter.add('tabContainer,scroll,TSTBrowser,true');

		var strip = this.tabStrip;
		strip.addEventListener('MozMouseHittest', this, true); // to block default behaviors of the tab bar
		ReferenceCounter.add('strip,MozMouseHittest,TSTBrowser,true');
		strip.addEventListener('mousedown',       this, true);
		ReferenceCounter.add('strip,mousedown,TSTBrowser,true');
		strip.addEventListener('click',           this, true);
		ReferenceCounter.add('strip,click,TSTBrowser,true');

		this.scrollBox.addEventListener('overflow', this, true);
		ReferenceCounter.add('scrollBox,overflow,TSTBrowser,true');
		this.scrollBox.addEventListener('underflow', this, true);
		ReferenceCounter.add('scrollBox,underflow,TSTBrowser,true');
	},
 
	_ensureNewSplitter : function TSTBrowser__ensureNewSplitter() 
	{
		var d = this.document;
		var splitter = this.splitter;
		var grippy;

		// We always have to re-create splitter, because its "collapse"
		// behavior becomes broken by repositioning of the tab bar.
		if (splitter) {
			this._destroyOldSplitter();
			let oldSplitter = splitter;
			splitter = oldSplitter.cloneNode(true);
			grippy = splitter.firstChild;
			oldSplitter.parentNode.removeChild(oldSplitter);
		}
		else {
			splitter = d.createElement('splitter');
			splitter.setAttribute(this.kTAB_STRIP_ELEMENT, true);
			splitter.setAttribute('state', 'open');
			splitter.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468
			grippy = d.createElement('grippy')
			grippy.setAttribute(this.kTAB_STRIP_ELEMENT, true);
			splitter.appendChild(grippy);
		}
		{
			// Workaround for bugs:
			//  * https://github.com/piroor/treestyletab/issues/593
			//  * https://github.com/piroor/treestyletab/issues/783
			// When you click the grippy...
			//  1. The grippy changes "state" of the splitter from "collapsed"
			//     to "open".
			//  2. The splitter changes visibility of the place holder.
			//  3. BrowserUIShowHideObserver detects the change of place
			//     holder's visibility and triggers updateFloatingTabbar().
			//  4. updateFloatingTabbar() copies the visibility of the
			//     actual tab bar to the place holder. However, the tab bar
			//     is still collapsed.
			//  5. As the result, the place holder becomes collapsed and
			//     the splitter disappear.
			// So, we have to turn the actual tab bar visible manually
			// when the grippy is clicked.
			let tabContainer = this.mTabBrowser.tabContainer;
			grippy.grippyOnClick = function(aEvent) {
				if (aEvent.button != 0)
					return;
				tabContainer.ownerDocument.defaultView.setTimeout(function() {
					var visible = grippy.getAttribute('state') != 'collapsed';
					if (visible != tabContainer.visible)
						tabContainer.visible = visible;
				}, 0);
			};
			grippy.addEventListener('click', grippy.grippyOnClick, true);
			ReferenceCounter.add('grippy,click,grippy.grippyOnClick,true');
		}

		var splitterClass = splitter.getAttribute('class') || '';
		if (splitterClass.indexOf(this.kSPLITTER) < 0)
			splitterClass += (splitterClass ? ' ' : '' ) + this.kSPLITTER;
		splitter.setAttribute('class', splitterClass);

		splitter.addEventListener('mousedown', this.windowService, false);
		ReferenceCounter.add('splitter,mousedown,windowService,false');
		splitter.addEventListener('mouseup', this.windowService, false);
		ReferenceCounter.add('splitter,mouseup,windowService,false');
		splitter.addEventListener('dblclick', this.windowService, false);
		ReferenceCounter.add('splitter,dblclick,windowService,false');
		splitter.addEventListener('click', this.windowService, false);
		ReferenceCounter.add('splitter,click,windowService,false');

		var ref = this.mTabBrowser.mPanelContainer;
		ref.parentNode.insertBefore(splitter, ref);

		this._splitter = splitter;
		return splitter;
	},
 
	_destroyOldSplitter : function TSTBrowser_destroyOldSplitter(aChanging, aOldPosition, aNewPosition) 
	{
		var d = this.document;
		var splitter = this.splitter;
		try {
			splitter.removeEventListener('mousedown', this.windowService, false);
			ReferenceCounter.remove('splitter,mousedown,windowService,false');
			splitter.removeEventListener('mouseup', this.windowService, false);
			ReferenceCounter.remove('splitter,mouseup,windowService,false');
			splitter.removeEventListener('dblclick', this.windowService, false);
			ReferenceCounter.remove('splitter,dblclick,windowService,false');
			splitter.removeEventListener('click', this.windowService, false);
			ReferenceCounter.remove('splitter,click,windowService,false');
			var grippy = splitter.firstChild;
			grippy.removeEventListener('click', grippy.grippyOnClick, true);
			ReferenceCounter.remove('grippy,click,grippy.grippyOnClick,true');
			delete grippy.grippyOnClick;
		}
		catch(e) {
		}
	},
 
	fireTabbarPositionEvent : function TSTBrowser_fireTabbarPositionEvent(aChanging, aOldPosition, aNewPosition) 
	{
		if (aOldPosition == aNewPosition)
			return false;

		var type = aChanging ? this.kEVENT_TYPE_TABBAR_POSITION_CHANGING : this.kEVENT_TYPE_TABBAR_POSITION_CHANGED;
		var data = {
				oldPosition : aOldPosition,
				newPosition : aNewPosition
			};

		/* PUBLIC API */
		this.fireCustomEvent(type, this.mTabBrowser, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(type.replace(/^nsDOM/, ''), this.mTabBrowser, true, false, data);

		return true;
	},
  
	updateTabbarState : function TSTBrowser_updateTabbarState(aCancelable) 
	{
		if (!this._fireTabbarStateChangingEvent() && aCancelable)
			return;

		var w = this.window;
		var d = this.document;
		var b = this.mTabBrowser;
		var orient;
		if (this.isVertical) {
			orient = 'vertical';
			this.fixed = this.fixed; // ensure set to the current orient
		}
		else {
			orient = 'horizontal';
			if (this.fixed) {
				this.fixed = true; // ensure set to the current orient
				if (!this.isMultiRow()) {
					this.removeTabStripAttribute('height');
					b.mPanelContainer.removeAttribute('height');
				}
				// remove ordinal for "tabs on top" https://bugzilla.mozilla.org/show_bug.cgi?id=544815
				if (this.position == 'top') {
					this.removeTabStripAttribute('ordinal');
				}
			}
			else {
				this.fixed = false; // ensure set to the current orient
				this.setTabStripAttribute('height', this.maxTabbarHeight(this.tabbarHeight, b));
			}
		}

		if (this.timers['updateTabbarState'])
			clearTimeout(this.timers['updateTabbarState']);
		this.timers['updateTabbarState'] = setTimeout((function() {
			try {
				this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_APPEARANCE_CHANGE);
				this._fireTabbarStateChangedEvent();
			}
			catch(e) {
				this.defaultErrorHandler(e);
			}
			delete this.timers['updateTabbarState'];
		}).bind(this), 0);

		this.maxTreeLevel = utils.getTreePref('maxTreeLevel.'+orient);

		this.setTabbrowserAttribute(this.kALLOW_STACK, this.canStackTabs ? 'true' : null);
		this.updateTabsZIndex(this.canStackTabs);

		if (this.maxTreeLevelPhysical)
			this.promoteTooDeepLevelTabs();

		this.updateAllTabsIndent();
	},
	
	_fireTabbarStateChangingEvent : function TSTBrowser_fireTabbarStateChangingEvent() 
	{
		var b = this.mTabBrowser;
		var orient = this.isVertical ? 'vertical' : 'horizontal' ;
		var oldState = {
				fixed         : this.fixed,
				maxTreeLevel  : this.maxTreeLevel,
				indented      : this.maxTreeLevel != 0
			};
		var newState = {
				fixed         : utils.getTreePref('tabbar.fixed.'+orient),
				maxTreeLevel  : utils.getTreePref('maxTreeLevel.'+orient),
				indented      : utils.getTreePref('maxTreeLevel.'+orient) != 0
			};

		if (oldState.fixed == newState.fixed &&
			oldState.maxTreeLevel == newState.maxTreeLevel &&
			oldState.indented == newState.indented)
			return false;

		var data = {
				oldState : oldState,
				newState : newState
			};

		/* PUBLIC API */
		this.fireCustomEvent(this.kEVENT_TYPE_TABBAR_STATE_CHANGING, this.mTabBrowser, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_TABBAR_STATE_CHANGING.replace(/^nsDOM/, ''), this.mTabBrowser, true, false, data);

		return true;
	},
 
	_fireTabbarStateChangedEvent : function TSTBrowser_fireTabbarStateChangedEvent() 
	{
		var b = this.mTabBrowser;
		var state = {
				fixed         : this.fixed,
				maxTreeLevel  : this.maxTreeLevel,
				indented      : this.maxTreeLevel != 0
			};

		var data = {
				state : state
			};

		/* PUBLIC API */
		this.fireCustomEvent(this.kEVENT_TYPE_TABBAR_STATE_CHANGED, this.mTabBrowser, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_TABBAR_STATE_CHANGED.replace(/^nsDOM/, ''), this.mTabBrowser, true, false, data);

		return true;
	},
  
	updateFloatingTabbar : function TSTBrowser_updateFloatingTabbar(aReason) 
	{
		var w = this.window;
		if (this._updateFloatingTabbarTimer) {
			w.clearTimeout(this._updateFloatingTabbarTimer);
			this._updateFloatingTabbarTimer = null;
		}

		this._updateFloatingTabbarReason |= aReason;
		this._currentTabWasVisible = (
			this._currentTabWasVisible ||
			this.isTabInViewport(this.browser.selectedTab)
		);

		if (this._updateFloatingTabbarReason & this.kTABBAR_UPDATE_NOW) {
			this._updateFloatingTabbarInternal(this._updateFloatingTabbarReason);
			this._updateFloatingTabbarReason = 0;
		}
		else {
			this._updateFloatingTabbarTimer = w.setTimeout(function(aSelf) {
				aSelf._updateFloatingTabbarTimer = null;
				aSelf._updateFloatingTabbarInternal(aSelf._updateFloatingTabbarReason)
				aSelf._updateFloatingTabbarReason = 0;
			}, 0, this);
		}
	},
	
	_updateFloatingTabbarInternal : function TSTBrowser_updateFloatingTabbarInternal(aReason) 
	{
		aReason = aReason || this.kTABBAR_UPDATE_BY_UNKNOWN_REASON;

		{
			let humanReadableReason =
				(aReason & this.kTABBAR_UPDATE_BY_RESET ? 'reset ' : '' ) +
				(aReason & this.kTABBAR_UPDATE_BY_PREF_CHANGE ? 'prefchange ' : '' ) +
				(aReason & this.kTABBAR_UPDATE_BY_APPEARANCE_CHANGE ? 'appearance-change ' : '' ) +
				(aReason & this.kTABBAR_UPDATE_BY_TABBAR_RESIZE ? 'tabbar-resize ' : '' ) +
				(aReason & this.kTABBAR_UPDATE_BY_WINDOW_RESIZE ?
					'window-resize(currentTabWasVisible='+this._currentTabWasVisible+') ' : '' ) +
				(aReason & this.kTABBAR_UPDATE_BY_FULLSCREEN ? 'fullscreen ' : '' ) +
				(aReason & this.kTABBAR_UPDATE_BY_AUTOHIDE ? 'autohide ' : '' ) +
				(aReason & this.kTABBAR_UPDATE_BY_INITIALIZE ? 'initialize ' : '' ) +
				(aReason & this.kTABBAR_UPDATE_BY_TOGGLE_SIDEBAR ? 'toggle-sidebar ' : '' );
			log('updateFloatingTabbarInternal: ' + humanReadableReason);
		}

		var d = this.document;

		// When the tab bar is invisible even if the tab bar is resizing, then
		// now I'm trying to expand the tab bar from collapsed state.
		// Then the tab bar must be shown.
		if (aReason & this.kTABBAR_UPDATE_BY_TABBAR_RESIZE &&
			!this.browser.tabContainer.visible)
			this.browser.tabContainer.visible = true;

		var splitter = this.splitter;
		if (splitter.collapsed || splitter.getAttribute('state') != 'collapsed') {
			// Synchronize visibility of the tab bar to the placeholder,
			// because the tab bar can be shown/hidden by someone
			// (Tab Mix Plus, Pale Moon, or some addons).
			this._tabStripPlaceHolder.collapsed =
				splitter.collapsed =
					!this.browser.tabContainer.visible;
		}

		var strip = this.tabStrip;
		var collapsed = splitter.collapsed ?
							strip.collapsed :
							splitter.getAttribute('state') == 'collapsed' ;
		var stripStyle = strip.style;
		var tabContainerBox = this.getTabContainerBox(this.mTabBrowser);
		var statusPanel = d.getElementById('statusbar-display');
		var statusPanelStyle = statusPanel ? statusPanel.style : null ;
		var pos = this.position;
		if (pos != 'top' ||
			this.mTabBrowser.getAttribute(this.kFIXED) != 'true') {
			strip.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468

			if (
				this.autoHide.enabled &&
				this.autoHide.expanded &&
				(aReason & this.kTABBAR_UPDATE_SYNC_TO_PLACEHOLDER) &&
				this.autoHide.mode == this.autoHide.kMODE_SHRINK
				)
				this.autoHide.hide(this.autoHide.kSHOWN_BY_ANY_REASON);

			let box  = this._tabStripPlaceHolder.boxObject;
			let root = d.documentElement.boxObject;
			let realSize = this.getTabbarPlaceholderSize();

			let width = (this.autoHide.expanded && this.isVertical && (aReason & this.kTABBAR_UPDATE_SYNC_TO_TABBAR) ?
//							this.maxTabbarWidth(this.tabbarWidth) :
							this.maxTabbarWidth(this.autoHide.expandedWidth) :
							0
						) || realSize.width;
			let height = (this.autoHide.expanded && !this.isVertical && (aReason & this.kTABBAR_UPDATE_SYNC_TO_TABBAR) ?
							this.maxTabbarHeight(this.tabbarHeight) :
							0
						) || realSize.height;
			let yOffset = pos == 'bottom' ? height - realSize.height : 0 ;

			stripStyle.top = (box.screenY - root.screenY + root.y - yOffset)+'px';
			stripStyle.left = pos == 'right' ? '' :
							(box.screenX - root.screenX + root.x)+'px';
			stripStyle.right = pos != 'right' ? '' :
							((root.screenX + root.width) - (box.screenX + box.width))+'px';

			stripStyle.width = (strip.width = tabContainerBox.width = width)+'px';
			stripStyle.height = (strip.height = tabContainerBox.height = height)+'px';

			this._updateFloatingTabbarResizer({
				width      : width,
				realWidth  : realSize.width,
				height     : height,
				realHeight : realSize.height
			});

			this._lastTabbarPlaceholderSize = realSize;

			strip.collapsed = tabContainerBox.collapsed = collapsed;

			if (statusPanel && utils.getTreePref('repositionStatusPanel')) {
				let offsetParentBox = this.base.findOffsetParent(statusPanel).boxObject;
				let contentBox = this.mTabBrowser.mPanelContainer.boxObject;
				let chromeMargins = (d.documentElement.getAttribute('chromemargin') || '0,0,0,0').split(',');
				chromeMargins = chromeMargins.map(function(aMargin) { return parseInt(aMargin); });
				statusPanelStyle.marginTop = (pos == 'bottom') ?
					'-moz-calc(0px - ' + (offsetParentBox.height - contentBox.height + chromeMargins[2]) + 'px - 3em)' :
					'' ;
				statusPanelStyle.marginLeft = (contentBox.screenX - offsetParentBox.screenX + chromeMargins[3])+'px';
				statusPanelStyle.marginRight = ((offsetParentBox.screenX + offsetParentBox.width) - (contentBox.screenX + contentBox.width) + chromeMargins[1])+'px';
				statusPanelStyle.maxWidth = this.isVertical ?
					(contentBox.width-5)+'px' : // emulate the margin defined on https://bugzilla.mozilla.org/show_bug.cgi?id=632634
					'' ;
				statusPanel.__treestyletab__repositioned = true;
			}

			this.mTabBrowser.tabContainer.setAttribute('context', this.mTabBrowser.tabContextMenu.id);
			this._updateChatbar();
		}
		else {
			strip.collapsed = tabContainerBox.collapsed = collapsed;
			stripStyle.top = stripStyle.left = stripStyle.right = stripStyle.width = stripStyle.height = '';

			if (
				statusPanel &&
				(
					utils.getTreePref('repositionStatusPanel') ||
					statusPanel.__treestyletab__repositioned
				)
				) {
				statusPanelStyle.marginTop = statusPanelStyle.marginLeft =
					statusPanelStyle.marginRight = statusPanelStyle.maxWidth = '';
				statusPanel.__treestyletab__repositioned = false;
			}

			strip.removeAttribute('layer'); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468

			this.mTabBrowser.tabContainer.removeAttribute('context');
			this._resetChatbar();
		}

		if (tabContainerBox.boxObject.width)
			this.positionPinnedTabs(null, null, aReason & this.kTABBAR_UPDATE_BY_AUTOHIDE);
		else
			this.positionPinnedTabsWithDelay(null, null, aReason & this.kTABBAR_UPDATE_BY_AUTOHIDE);

		this.updateTabbarOverflow();

		this.notifyingRenderedEvent = true;
		var event = d.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_TABBAR_RENDERED, true, false);
		this.mTabBrowser.tabContainer.dispatchEvent(event);

		setTimeout((function() {
			this.notifyingRenderedEvent = false;

			var shownAutomatically = (
				!collapsed &&
				this.autoHide.mode == this.autoHide.kMODE_HIDE &&
				aReason & this.kTABBAR_UPDATE_BY_AUTOHIDE
			);
			var scrollToCurrentAfterResize = (
				this._currentTabWasVisible &&
				aReason & this.kTABBAR_UPDATE_BY_WINDOW_RESIZE
			);
			log('after floating tab is updated: ', {
				shownAutomatically         : shownAutomatically,
				scrollToCurrentAfterResize : scrollToCurrentAfterResize
			});

			if (this.browser) { // ignore calling after destroyed...
				if (shownAutomatically) {
					this.scrollToTab(this.browser.selectedTab);
				}
				else if (scrollToCurrentAfterResize) {
					// Make the tab visible immediately!
					// If we use scrollToTab with animation, the current tab
					// can be invisible sometimes.
					this.scrollBoxObject.ensureElementIsVisible(this.browser.selectedTab);
				}
			}

			if (!this._updateFloatingTabbarTimer)
				delete this._currentTabWasVisible;
		}).bind(this), 0);
	},
	getTabbarPlaceholderSize: function TSTBrowser_getTabbarPlaceholderSize()
	{
		var box = this._tabStripPlaceHolder.boxObject;
		return {
			width:  parseInt(this._tabStripPlaceHolder.getAttribute('width') || box.width),
			height: parseInt(this._tabStripPlaceHolder.getAttribute('height') || box.height)
		};
	},
	getExistingTabsCount : function TSTBrowser_getTabsCount() 
	{
		return this.getAllTabs(this.mTabBrowser).length - this.mTabBrowser._removingTabs.length;
	},
 
	_updateFloatingTabbarResizer : function TSTBrowser_updateFloatingTabbarResizer(aSize) 
	{
		var d = this.document;

		var width      = aSize.width;
		var realWidth  = this.autoHide.mode == this.autoHide.kMODE_HIDE ? 0 : aSize.realWidth ;
		var height     = aSize.height;
		var realHeight = this.autoHide.mode == this.autoHide.kMODE_HIDE ? 0 : aSize.realHeight ;
		var pos        = this.position;
		var vertical = this.isVertical;

		var splitter = d.getElementById('treestyletab-tabbar-resizer-splitter');
		if (!splitter) {
			let box = d.createElement('box');
			box.setAttribute('id', 'treestyletab-tabbar-resizer-box');
			box.setAttribute(this.kTAB_STRIP_ELEMENT, true);
			splitter = d.createElement('splitter');
			splitter.setAttribute(this.kTAB_STRIP_ELEMENT, true);
			splitter.setAttribute('id', 'treestyletab-tabbar-resizer-splitter');
			splitter.setAttribute('class', this.kSPLITTER);
			splitter.setAttribute('onmousedown', 'TreeStyleTabService.handleEvent(event);');
			splitter.setAttribute('onmouseup', 'TreeStyleTabService.handleEvent(event);');
			splitter.setAttribute('ondblclick', 'TreeStyleTabService.handleEvent(event);');
			splitter.setAttribute('onclick', 'TreeStyleTabService.handleEvent(event);');
			box.appendChild(splitter);
			this.tabStrip.appendChild(box);
		}

		var box = splitter.parentNode;

		box.orient = splitter.orient = vertical ? 'horizontal' : 'vertical' ;
		box.width = (width - realWidth) || width;
		box.height = (height - realHeight) || height;

		var boxStyle = box.style;
		boxStyle.top    = pos == 'top' ? realHeight+'px' : '' ;
		boxStyle.right  = pos == 'right' ? realWidth+'px' : '' ;
		boxStyle.left   = pos == 'left' ? realWidth+'px' : '' ;
		boxStyle.bottom = pos == 'bottom' ? realHeight+'px' : '' ;

		if (vertical) {
			splitter.removeAttribute('width');
			splitter.setAttribute('height', height);
		}
		else {
			splitter.setAttribute('width', width);
			splitter.removeAttribute('height');
		}

		var splitterWidth = splitter.boxObject.width;
		var splitterHeight = splitter.boxObject.height;
		var splitterStyle = splitter.style;
		splitterStyle.marginTop    = pos == 'bottom' ? (-splitterHeight)+'px' :
									vertical ? '0' :
									box.height+'px' ;
		splitterStyle.marginRight  = pos == 'left' ? (-splitterWidth)+'px' :
									!vertical ? '0' :
									box.width+'px' ;
		splitterStyle.marginLeft   = pos == 'right' ? (-splitterWidth)+'px' :
									!vertical ? '0' :
									box.width+'px' ;
		splitterStyle.marginBottom = pos == 'top' ? (-splitterHeight)+'px' :
									vertical ? '0' :
									box.height+'px' ;
	},
 
	get _chatbarBox()
	{
		var chatbar = this.document.getElementById('pinnedchats');
		return chatbar && chatbar.innerbox;
	},
	_updateChatbar : function TSTBrowser_updateChatbar() 
	{
		var box = this._chatbarBox;
		if (!box)
			return;

		this._resetChatbar();

		var tabbarSize = this.getTabbarPlaceholderSize();
		var splitterBox = this.splitter.boxObject;

		switch (this.position)
		{
			case 'left':
				box.style.marginLeft = (tabbarSize.width + splitterBox.width) + 'px';
				break;

			case 'right':
				box.style.marginRight = (tabbarSize.width + splitterBox.width) + 'px';
				break;

			case 'bottom':
				box.style.marginBottom = (tabbarSize.height + splitterBox.height) + 'px';
				break;
		}
	},
	_resetChatbar : function TSTBrowser_resetChatbar() 
	{
		var box = this._chatbarBox;
		if (!box)
			return;

		var style = box.style;
		style.marginLeft =
			style.marginRight =
			style.marginBottom = '';
	},
  
	updateTabbarOverflow : function TSTBrowser_updateTabbarOverflow() 
	{
		log('updateTabbarOverflow');
		var d = this.document;
		var b = this.mTabBrowser;
		b.tabContainer.removeAttribute('overflow');
		var container = d.getAnonymousElementByAttribute(b.tabContainer, 'class', 'tabs-container') || b.tabContainer;

		if (container != b.tabContainer)
			container.removeAttribute('overflow');

		var scrollBox = this.scrollBox;
		scrollBox = d.getAnonymousElementByAttribute(scrollBox, 'anonid', 'scrollbox');
		if (scrollBox) {
			scrollBox = d.getAnonymousNodes(scrollBox)[0];
			log('scrollBox.width='+scrollBox.boxObject.width+' > container.width='+container.boxObject.width);
			log('scrollBox.height='+scrollBox.boxObject.height+' > container.height='+container.boxObject.height);
		}
		if (
			scrollBox &&
			(
				scrollBox.boxObject.width > container.boxObject.width ||
				scrollBox.boxObject.height > container.boxObject.height
			)
			) {
			log(' => overflow');
			b.tabContainer.setAttribute('overflow', true);
			if (container != b.tabContainer)
				container.setAttribute('overflow', true);
		}
		else {
			log(' => underflow');
			b.tabContainer.removeAttribute('overflow');
			if (container != b.tabContainer)
				container.removeAttribute('overflow');
		}
	},
 
	reinitAllTabs : function TSTBrowser_reinitAllTabs(aSouldUpdateAsParent) 
	{
		var tabs = this.getAllTabs(this.mTabBrowser);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			this.initTabAttributes(tab);
			this.initTabContents(tab);
			if (aSouldUpdateAsParent)
				this.updateTabAsParent(tab, {
					dontUpdateAncestor : true
				});
			this.window.TreeStyleTabWindowHelper.initTabMethods(tab, this.mTabBrowser);
		}
	},
  
	destroy : function TSTBrowser_destroy() 
	{
		this.stopSmoothScroll();

		Object.keys(this.timers).forEach(function(key) {
			if (!this.timers[key])
				return;
			let timer = this.timers[key];
			if (typeof timer == 'object')
				timer = timer.timer;
			clearTimeout(timer);
			delete this.timers[key];
		}, this);

		this._initDNDObservers(); // ensure initialized
		this.tabbarDNDObserver.destroy();
		delete this._tabbarDNDObserver;
		this.panelDNDObserver.destroy();
		delete this._panelDNDObserver;

		if (this.tooltipManager) {
			this.tooltipManager.destroy();
			delete this.tooltipManager;
		}

		if (this.tabStripPlaceHolderBoxObserver) {
			this.tabStripPlaceHolderBoxObserver.destroy();
			delete this.tabStripPlaceHolderBoxObserver;
		}

		if (this.tabContentsObserver) {
			this.tabContentsObserver.destroy();
			delete this.tabContentsObserver;
		}

		this._destroyOldSplitter();

		var w = this.window;
		var d = this.document;
		var b = this.mTabBrowser;
		delete b.tabContainer.treeStyleTab;

		var tabs = this.getAllTabs(b);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			this.stopTabIndentAnimation(tab);
			this.stopTabCollapseAnimation(tab);
			this.destroyTab(tab);
		}

		this._endListenTabbarEvents();

		this.autoHide.destroy();
		this._autoHide = undefined; // block to be re-initialized by property accesses

		w.removeEventListener('resize', this, true);
		ReferenceCounter.remove('w,resize,TSTBrowser,true');
		w.removeEventListener('beforecustomization', this, true);
		ReferenceCounter.remove('w,beforecustomization,TSTBrowser,true');
		w.removeEventListener('aftercustomization', this, false);
		ReferenceCounter.remove('w,aftercustomization,TSTBrowser,false');
		w.removeEventListener('customizationchange', this, false);
		ReferenceCounter.remove('w,customizationchange,TSTBrowser,false');
		w.removeEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		ReferenceCounter.remove('w,kEVENT_TYPE_PRINT_PREVIEW_ENTERED,TSTBrowser,false');
		w.removeEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED,  this, false);
		ReferenceCounter.remove('w,kEVENT_TYPE_PRINT_PREVIEW_EXITED,TSTBrowser,false');
		w.removeEventListener('tabviewframeinitialized', this, false);
		ReferenceCounter.remove('w,tabviewframeinitialized,TSTBrowser,false');
		w.removeEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);
		ReferenceCounter.remove('w,kEVENT_TYPE_TAB_FOCUS_SWITCHING_END,TSTBrowser,false');

		for (let container of this.notificationBoxContainers)
		{
			container.node.removeEventListener('transitionend', this, false);
			ReferenceCounter.remove(container.id + ',transitionend,TSTBrowser,false');
			container.node.removeEventListener('transitioncancel', this, false);
			ReferenceCounter.remove(container.id + ',transitioncancel,TSTBrowser,false');
			container.node.removeEventListener('transitionrun', this, false);
			ReferenceCounter.remove(container.id + ',transitionrun,TSTBrowser,false');
		}

		b.removeEventListener('DOMAudioPlaybackStarted', this, false);
		ReferenceCounter.remove('b,DOMAudioPlaybackStarted,TSTBrowser,false');
		b.removeEventListener('DOMAudioPlaybackStopped', this, false);
		ReferenceCounter.remove('b,DOMAudioPlaybackStopped,TSTBrowser,false');

		b.removeEventListener('nsDOMMultipleTabHandlerTabsClosing', this, false);
		ReferenceCounter.remove('b,nsDOMMultipleTabHandlerTabsClosing,TSTBrowser,false');

		w['piro.sakura.ne.jp'].tabsDragUtils.destroyTabBrowser(b);

		var tabContextMenu = b.tabContextMenu ||
							d.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContextMenu.removeEventListener('popupshowing', this, false);
		ReferenceCounter.remove('tabContextMenu,popupshowing,TSTBrowser,false');

		if (this.tabbarCanvas) {
			this.tabbarCanvas.parentNode.removeChild(this.tabbarCanvas);
			this.tabbarCanvas = null;
		}

		Services.obs.removeObserver(this, this.kTOPIC_INDENT_MODIFIED);
		Services.obs.removeObserver(this, this.kTOPIC_COLLAPSE_EXPAND_ALL);
		Services.obs.removeObserver(this, this.kTOPIC_CHANGE_TREEVIEW_AVAILABILITY);
		Services.obs.removeObserver(this, 'lightweight-theme-styling-update');
		prefs.removePrefListener(this);

		delete this.windowService;
		delete this.window;
		delete this.document;
		delete this.mTabBrowser.treeStyleTab;
		delete this.mTabBrowser;
	},
	
	destroyTab : function TSTBrowser_destroyTab(aTab) 
	{
		var id = aTab.getAttribute(this.kID);
		if (id in this.tabsHash &&
			aTab == this.tabsHash[id])
			delete this.tabsHash[id];

		if (aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave) {
			this.document.removeEventListener('mouseover', aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave, true);
			ReferenceCounter.remove('document,mouseover,aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave,true');
			this.document.removeEventListener('mouseout', aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave, true);
			ReferenceCounter.remove('document,mouseout,aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave,true');
			delete aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave;
		}

		this.autoHide.notifyStatusToTab(aTab);

		aTab.__treestyletab__contentBridge.destroy();
		delete aTab.__treestyletab__contentBridge;

		delete aTab.__treestyletab__linkedTabBrowser;
	},
 
	_endListenTabbarEvents : function TSTBrowser_endListenTabbarEvents() 
	{
		var b = this.mTabBrowser;

		var tabContainer = b.tabContainer;
		tabContainer.removeEventListener('TabOpen',        this, true);
		ReferenceCounter.remove('tabContainer,TabOpen,TSTBrowser,true');
		tabContainer.removeEventListener('TabClose',       this, true);
		ReferenceCounter.remove('tabContainer,TabClose,TSTBrowser,true');
		tabContainer.removeEventListener('TabMove',        this, true);
		ReferenceCounter.remove('tabContainer,TabMove,TSTBrowser,true');
		tabContainer.removeEventListener('TabShow',        this, true);
		ReferenceCounter.remove('tabContainer,TabShow,TSTBrowser,true');
		tabContainer.removeEventListener('TabHide',        this, true);
		ReferenceCounter.remove('tabContainer,TabHide,TSTBrowser,true');
		tabContainer.removeEventListener('TabAttrModified', this, true);
		ReferenceCounter.remove('tabContainer,TabAttrModified,TSTBrowser,true');
		tabContainer.removeEventListener('SSTabRestoring', this, true);
		ReferenceCounter.remove('tabContainer,SSTabRestoring,TSTBrowser,true');
		tabContainer.removeEventListener('SSTabRestored',  this, true);
		ReferenceCounter.remove('tabContainer,SSTabRestored,TSTBrowser,true');
		tabContainer.removeEventListener('TabPinned',      this, true);
		ReferenceCounter.remove('tabContainer,TabPinned,TSTBrowser,true');
		tabContainer.removeEventListener('TabUnpinned',    this, true);
		ReferenceCounter.remove('tabContainer,TabUnpinned,TSTBrowser,true');
		tabContainer.removeEventListener('mouseover', this, true);
		ReferenceCounter.remove('tabContainer,mouseover,TSTBrowser,true');
		tabContainer.removeEventListener('mouseout', this, true);
		ReferenceCounter.remove('tabContainer,mouseout,TSTBrowser,true');
		tabContainer.removeEventListener('dblclick',  this, true);
		ReferenceCounter.remove('tabContainer,dblclick,TSTBrowser,true');
		tabContainer.removeEventListener('select', this, true);
		ReferenceCounter.remove('tabContainer,select,TSTBrowser,true');
		tabContainer.removeEventListener('scroll', this, true);
		ReferenceCounter.remove('tabContainer,scroll,TSTBrowser,true');

		var strip = this.tabStrip;
		strip.removeEventListener('MozMouseHittest', this, true);
		ReferenceCounter.remove('strip,MozMouseHittest,TSTBrowser,true');
		strip.removeEventListener('mousedown',       this, true);
		ReferenceCounter.remove('strip,mousedown,TSTBrowser,true');
		strip.removeEventListener('click',           this, true);
		ReferenceCounter.remove('strip,click,TSTBrowser,true');

		this.scrollBox.removeEventListener('overflow', this, true);
		ReferenceCounter.remove('scrollBox,overflow,TSTBrowser,true');
		this.scrollBox.removeEventListener('underflow', this, true);
		ReferenceCounter.remove('scrollBox,underflow,TSTBrowser,true');
	},
 
	saveCurrentState : function TSTBrowser_saveCurrentState() 
	{
		var b = this.mTabBrowser;
		var floatingBox = this.getTabStrip(b).boxObject;
		var fixedBox = (this.tabStripPlaceHolder || this.getTabStrip(b)).boxObject;
		var prefs = {
				'tabbar.fixed.horizontal' : b.getAttribute(this.kFIXED+'-horizontal') == 'true',
				'tabbar.fixed.vertical'   : b.getAttribute(this.kFIXED+'-vertical') == 'true'
			};
		for (var i in prefs)
		{
			if (prefs[i] !== void(0) && utils.getTreePref(i) != prefs[i])
				utils.setTreePref(i, prefs[i]);
		}
	},
   
/* toolbar customization */ 
	
	destroyTabbar : function TSTBrowser_destroyTabbar() 
	{
		this._endListenTabbarEvents();
		this.tabbarDNDObserver.endListenEvents();

		this._lastTreeViewEnabledBeforeDestroyed = this.treeViewEnabled;
		this.treeViewEnabled = false;
		this.maxTreeLevel = 0;

		this._lastTabbarPositionBeforeDestroyed = this.position;
		if (this.position != 'top') {
			this.temporaryPosition = 'top';
			return new Promise((function(aResolve, aReject) {
				var onRestored = (function() {
					this.mTabBrowser.removeEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED, onRestored, false);
					ReferenceCounter.remove('mTabBrowser,kEVENT_TYPE_TABBAR_POSITION_CHANGED,onRestored,false');
					aResolve();
				}).bind(this);
				this.mTabBrowser.addEventListener(this.kEVENT_TYPE_TABBAR_POSITION_CHANGED, onRestored, false);
				ReferenceCounter.add('mTabBrowser,kEVENT_TYPE_TABBAR_POSITION_CHANGED,onRestored,false');
			}).bind(this))
				.then(this.destroyTabbarPostProcess.bind(this));
		}
		else {
			this.destroyTabbarPostProcess();
			return Promise.resolve();
		}
	},
	destroyTabbarPostProcess : function TSTBrowser_destroyTabbarPostProcess()
	{
		this.fixed = true;

		var tabbar = this.mTabBrowser.tabContainer;
		tabbar.removeAttribute('width');
		tabbar.removeAttribute('height');
		tabbar.removeAttribute('ordinal');

		this.removeTabStripAttribute('width');
		this.removeTabStripAttribute('height');
		this.removeTabStripAttribute('ordinal');
		this.removeTabStripAttribute('orient');

		var toolbar = this.ownerToolbar;
		this.destroyTabStrip(toolbar);
		toolbar.classList.add(this.kTABBAR_TOOLBAR_READY);

		this.window.setTimeout(function(aSelf) {
			aSelf.updateCustomizedTabsToolbar();
		}, 100, this);
	},
	destroyTabStrip : function TSTBrowser_destroyTabStrip(aTabStrip)
	{
		aTabStrip.classList.remove(this.kTABBAR_TOOLBAR);
		aTabStrip.style.top = aTabStrip.style.left = aTabStrip.style.width = aTabStrip.style.height = '';
		aTabStrip.removeAttribute('height');
		aTabStrip.removeAttribute('width');
		aTabStrip.removeAttribute('ordinal');
		aTabStrip.removeAttribute('orient');
	},
 
	reinitTabbar : function TSTBrowser_reinitTabbar() 
	{
		this.ownerToolbar.classList.add(this.kTABBAR_TOOLBAR);
		this.ownerToolbar.classList.remove(this.kTABBAR_TOOLBAR_READY);
		[...this.document.querySelectorAll('.'+this.kTABBAR_TOOLBAR_READY_POPUP)]
			.forEach(this.safeRemovePopup, this);

		var position = this._lastTabbarPositionBeforeDestroyed || this.position;
		delete this._lastTabbarPositionBeforeDestroyed;

		this.initTabbar(position, 'top').then((function() {
			this.reinitAllTabs(true);

			this.tabbarDNDObserver.startListenEvents();

			this.treeViewEnabled = this._lastTreeViewEnabledBeforeDestroyed;
			delete this._lastTreeViewEnabledBeforeDestroyed;

			this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_RESET);
		}).bind(this));
	},
 
	updateCustomizedTabsToolbar : function TSTBrowser_updateCustomizedTabsToolbar() 
	{
		var d = this.document;

		var newToolbar = this.ownerToolbar;
		newToolbar.classList.add(this.kTABBAR_TOOLBAR_READY);

		var oldToolbar = d.querySelector('.'+this.kTABBAR_TOOLBAR_READY);
		if (oldToolbar == newToolbar)
			return;

		if (oldToolbar && oldToolbar != newToolbar) {
			this.safeRemovePopup(d.getElementById(oldToolbar.id+'-'+this.kTABBAR_TOOLBAR_READY_POPUP));
			oldToolbar.classList.remove(this.kTABBAR_TOOLBAR_READY);
		}

		var id = newToolbar.id+'-'+this.kTABBAR_TOOLBAR_READY_POPUP;
		var panel = d.getElementById(id);
		if (!panel) {
			panel = d.createElement('panel');
			panel.setAttribute('id', id);
			panel.setAttribute('class', this.kTABBAR_TOOLBAR_READY_POPUP);
			panel.setAttribute('noautohide', true);
			panel.setAttribute('onmouseover', 'this.hidePopup()');
			panel.setAttribute('ondragover', 'this.hidePopup()');
			panel.appendChild(d.createElement('label'));
			let position = this._lastTabbarPositionBeforeDestroyed || this.position;
			let label = utils.treeBundle.getString('toolbarCustomizing_tabbar_'+(position == 'left' || position == 'right' ? 'vertical' : 'horizontal' ));
			panel.firstChild.appendChild(d.createTextNode(label));
			d.getElementById('mainPopupSet').appendChild(panel);
		}
		panel.openPopup(newToolbar, 'end_after', 0, 0, false, false);
	},
	safeRemovePopup : function TSTBrowser_safeRemovePopup(aPopup)
	{
		if (!aPopup)
			return;
		if (aPopup.state == 'open') {
			aPopup.addEventListener('popuphidden', function onPopuphidden(aEvent) {
				aPopup.removeEventListener(aEvent.type, onPopuphidden, false);
				ReferenceCounter.remove('aPopup,popuphidden,onPopuphidden,false');
				aPopup.parentNode.removeChild(aPopup);
			}, false);
			ReferenceCounter.add('aPopup,popuphidden,onPopuphidden,false');
			aPopup.hidePopup();
		}
		else {
			aPopup.parentNode.removeChild(aPopup);
		}
	},
  
/* nsIObserver */ 
	
	domains : [ 
		'extensions.treestyletab.',
		'browser.tabs.closeButtons',
		'browser.tabs.closeWindowWithLastTab',
		'toolkit.cosmeticAnimations.enabled',
		'browser.tabs.animate' // Firefox 54 and olders
	],
 
	observe : function TSTBrowser_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case this.kTOPIC_INDENT_MODIFIED:
				if (this.indent > -1)
					this.updateAllTabsIndent();
				return;

			case this.kTOPIC_COLLAPSE_EXPAND_ALL:
				if (!aSubject || aSubject == this.window) {
					aData = String(aData);
					this.collapseExpandAllSubtree(
						aData.indexOf('collapse') > -1,
						aData.indexOf('now') > -1
					);
				}
				return;

			case 'lightweight-theme-styling-update':
				return this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_APPEARANCE_CHANGE);

			case this.kTOPIC_CHANGE_TREEVIEW_AVAILABILITY:
				return this.treeViewEnabled = (aData != 'false');

			case 'nsPref:changed':
				return this.onPrefChange(aData);

			default:
				return;
		}
	},
 
	onPrefChange : function TSTBrowser_onPrefChange(aPrefName) 
	{
		// ignore after destruction
		if (!this.window || !this.window.TreeStyleTabService)
			return;

		var b = this.mTabBrowser;
		var value = prefs.getPref(aPrefName);
		var tabContainer = b.tabContainer;
		var tabs  = this.getAllTabs(b);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.position':
				if (this.shouldApplyNewPref('tabbar.position'))
					this.position = value;
				return;

			case 'extensions.treestyletab.tabbar.invertTab':
			case 'extensions.treestyletab.tabbar.multirow':
				this.initTabbar();
				this.updateAllTabsIndent();
				for (let i = 0, maxi = tabs.length; i < maxi; i++)
				{
					this.initTabContents(tabs[i]);
				}
				return;
			case 'extensions.treestyletab.tabbar.invertTabContents':
				this.setTabbrowserAttribute(this.kTAB_CONTENTS_INVERTED, value);
				for (let i = 0, maxi = tabs.length; i < maxi; i++)
				{
					this.initTabContents(tabs[i]);
				}
				return;

			case 'extensions.treestyletab.tabbar.invertClosebox':
				this.setTabbrowserAttribute(this.kCLOSEBOX_INVERTED, value);
				for (let i = 0, maxi = tabs.length; i < maxi; i++)
				{
					this.initTabContents(tabs[i]);
				}
				return;

			case 'extensions.treestyletab.tabbar.style':
			case 'extensions.treestyletab.tabbar.style.aero':
				this.setTabbarStyle(utils.getTreePref('tabbar.style'));
				value = utils.getTreePref('twisty.style');
				if (value != 'auto')
					return;
			case 'extensions.treestyletab.twisty.style':
				return this.setTwistyStyle(value);

			case 'extensions.treestyletab.showBorderForFirstTab':
				return this.setTabbrowserAttribute(this.kFIRSTTAB_BORDER, value);

			case 'extensions.treestyletab.tabbar.fixed.horizontal':
				if (!this.shouldApplyNewPref('tabbar.fixed.horizontal'))
					return;
				this.setTabbrowserAttribute(this.kFIXED+'-horizontal', value ? 'true' : null, b);
			case 'extensions.treestyletab.maxTreeLevel.horizontal':
				if (!this.isVertical)
					this.updateTabbarState(true);
				return;

			case 'extensions.treestyletab.tabbar.fixed.vertical':
				if (!this.shouldApplyNewPref('tabbar.fixed.vertical'))
					return;
				this.setTabbrowserAttribute(this.kFIXED+'-vertical', value ? 'true' : null, b);
			case 'extensions.treestyletab.maxTreeLevel.vertical':
				if (this.isVertical)
					this.updateTabbarState(true);
				return;

			case 'extensions.treestyletab.tabbar.width':
			case 'extensions.treestyletab.tabbar.shrunkenWidth':
				if (!this.shouldApplyNewPref('tabbar.width'))
					return;
			case 'extensions.treestyletab.tabbar.width.override':
				if (!this.autoHide.isResizing && this.isVertical) {
					this.removeTabStripAttribute('width');
					if (aPrefName.indexOf('shrunken') > -1)
						this.shrunkenWidth = value;
					else
						this.expandedWidth = value;
					this.setTabStripAttribute('width', this.autoHide.placeHolderWidthFromMode);
					this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_PREF_CHANGE);
				}
				this.checkTabsIndentOverflow();
				return;

			case 'extensions.treestyletab.tabbar.height':
				if (!this.shouldApplyNewPref('tabbar.height'))
					return;
			case 'extensions.treestyletab.tabbar.height.override':
				this._horizontalTabMaxIndentBase = 0;
				this.tabbarHeight = value;
				this.checkTabsIndentOverflow();
				return;

			case 'extensions.treestyletab.tabbar.autoShow.mousemove':
			case 'extensions.treestyletab.tabbar.autoShow.click':
				{
					let toggler = this.toggler;
					if (toggler) {
						if (utils.getTreePref('tabbar.autoShow.mousemove') ||
							utils.getTreePref('tabbar.autoShow.click'))
							toggler.removeAttribute('hidden');
						else
							toggler.setAttribute('hidden', true);
					}
				}
				return;

			case 'extensions.treestyletab.tabbar.invertScrollbar':
				this.setTabbrowserAttribute(this.kINVERT_SCROLLBAR, value);
				this.positionPinnedTabs();
				return;

			case 'extensions.treestyletab.tabbar.narrowScrollbar':
				return this.setTabbrowserAttribute(this.kNARROW_SCROLLBAR, value);

			case 'extensions.treestyletab.tabbar.narrowScrollbar.width':
				if (this.isVertical &&
					this.mTabBrowser.tabContainer.getAttribute('overflow') == 'true')
					utils.updateNarrowScrollbarStyle(this.browser);
				return;

			case 'extensions.treestyletab.maxTreeLevel.physical':
				if (this.maxTreeLevelPhysical = value)
					this.promoteTooDeepLevelTabs();
				return;

			case 'toolkit.cosmeticAnimations.enabled':
			case 'browser.tabs.animate':
				this.setTabbrowserAttribute(this.kANIMATION_ENABLED,
					this.animationEnabled ? 'true' : null);
				return;

			case 'browser.tabs.closeButtons':
			case 'browser.tabs.closeWindowWithLastTab':
				return this.updateInvertedTabContentsOrder(true);

			case 'extensions.treestyletab.tabbar.autoHide.mode':
			case 'extensions.treestyletab.tabbar.autoHide.mode.fullscreen':
				return this.autoHide; // ensure initialized

			case 'extensions.treestyletab.pinnedTab.faviconized':
				return this.positionPinnedTabsWithDelay();

			case 'extensions.treestyletab.counter.role.horizontal':
				if (!this.isVertical) {
					if (this.timers[aPrefName])
						clearTimeout(this.timers[aPrefName]);
					this.timers[aPrefName] = setTimeout((function() {
						try {
							this.updateAllTabsAsParent();
						}
						catch(e) {
							this.defaultErrorHandler(e);
						}
						delete this.timers[aPrefName];
					}).bind(this), 0);
				}
				return;
			case 'extensions.treestyletab.counter.role.vertical':
				if (this.isVertical) {
					if (this.timers[aPrefName])
						clearTimeout(this.timers[aPrefName]);
					this.timers[aPrefName] = setTimeout((function() {
						try {
							this.updateAllTabsAsParent();
						}
						catch(e) {
							this.defaultErrorHandler(e);
						}
						delete this.timers[aPrefName];
					}).bind(this), 0);
				}
				return;

			default:
				return;
		}
	},
	setTabbarStyle : function TSTBrowser_setTabbarStyle(aStyle)
	{
		if (/^(default|plain|flat|mixed|vertigo|metal|sidebar)(-aero)?$/.test(aStyle))
			aStyle = aStyle.toLowerCase();

		if (aStyle.indexOf('default') == 0) { // old name (for compatibility)
			utils.setTreePref('tabbar.style', aStyle = aStyle.replace('default', 'plain'));
		}

		if (aStyle) {
			let additionalValues = [];
			if (/^(plain|flat|mixed|vertigo)$/.test(aStyle))
				additionalValues.push('square');
			if (/^(plain|flat|mixed)$/.test(aStyle))
				additionalValues.push('border');
			if (/^(flat|mixed)$/.test(aStyle))
				additionalValues.push('color');
			if (/^(plain|mixed)$/.test(aStyle))
				additionalValues.push('shadow');
			if (utils.getTreePref('tabbar.style.aero'))
				additionalValues.push('aero');
			if (additionalValues.length)
				aStyle = additionalValues.join(' ')+' '+aStyle;

			this.setTabbrowserAttribute(this.kSTYLE, aStyle);
		}
		else {
			this.removeTabbrowserAttribute(this.kSTYLE);
		}
	},
	setTwistyStyle : function TSTBrowser_setTwistyStyle(aStyle)
	{
		if (aStyle != 'auto') {
			this.setTabbrowserAttribute(this.kTWISTY_STYLE, aStyle);
			return;
		}

		aStyle = 'modern-black';

		if (utils.getTreePref('tabbar.style') == 'sidebar') {
			aStyle = 'osx';
		}
		else if (
			prefs.getPref('extensions.informationaltab.thumbnail.enabled') &&
			prefs.getPref('extensions.informationaltab.thumbnail.position') < 100
			) {
			AddonManager.getAddonByID('informationaltab@piro.sakura.ne.jp', (function(aAddon) {
				if (aAddon) {
					aStyle = 'retro';
					this.setTabbrowserAttribute(this.kTWISTY_STYLE, aStyle);
				}
				else {
					this.setTabbrowserAttribute(this.kTWISTY_STYLE, aStyle);
				}
			}).bind(this));
			return;
		}

		this.setTabbrowserAttribute(this.kTWISTY_STYLE, aStyle);
	},
  
/* DOM Event Handling */ 
	
	handleEvent : function TSTBrowser_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'TabOpen':
				return this.onTabOpen(aEvent);

			case 'TabClose':
				return this.onTabClose(aEvent);

			case 'TabMove':
				return this.onTabMove(aEvent);

			case 'TabShow':
			case 'TabHide':
				return this.onTabVisibilityChanged(aEvent);

			case 'TabAttrModified':
				{
					let tab = aEvent.originalTarget;
					// on Fireofx 38 the event has no "detail" information.
					if (!aEvent.detail)
						return;
					aEvent.detail.changed.forEach(function(aAttrName) {
						switch (aAttrName)
						{
							case 'soundplaying': // mainly for restored tab
								if (tab.getAttribute('soundplaying') == 'true')
									this.setTabValue(tab, this.kREALLY_SOUND_PLAYING, true);
								else
									this.deleteTabValue(tab, this.kREALLY_SOUND_PLAYING);
								this.updateTabAsParent(tab, {
									dontUpdateCount : true
								});
								return;

							case 'muted':
								if (tab.getAttribute('muted') == 'true')
									this.setTabValue(tab, this.kREALLY_MUTED, true);
								else
									this.deleteTabValue(tab, this.kREALLY_MUTED);
								this.updateTabAsParent(tab, {
									dontUpdateCount : true
								});
								return;
						}
					}, this);
				}
				return;

			case 'SSTabRestoring':
				return this.onTabRestoring(aEvent);

			case 'SSTabRestored':
				return this.onTabRestored(aEvent);

			case 'TabPinned':
				return this.onTabPinned(aEvent.originalTarget);

			case 'TabUnpinned':
				return this.onTabUnpinned(aEvent.originalTarget);

			case 'select':
				return this.onTabSelect(aEvent);

			case 'click':
				return this.onClick(aEvent);

			case 'dblclick':
				return this.onDblClick(aEvent);

			case 'MozMouseHittest': // to block default behaviors of the tab bar
				return this.onMozMouseHittest(aEvent);

			case 'mousedown':
				return this.onMouseDown(aEvent);

			case 'scroll':
				return this.onScroll(aEvent);

			case 'popupshowing':
				return this.onPopupShowing(aEvent);

			case 'popuphiding':
				return this.onPopupHiding(aEvent);

			case 'mouseover':
				if (!this.tooltipManager)
					this._initTooltipManager();
				if (!this._DNDObserversInitialized)
					this._initDNDObservers();
				{
					let tab = aEvent.target;
					if (tab.__treestyletab__twistyHoverTimer)
						this.window.clearTimeout(tab.__treestyletab__twistyHoverTimer);
					if (this.isEventFiredOnTwisty(aEvent)) {
						tab.setAttribute(this.kTWISTY_HOVER, true);
						tab.__treestyletab__twistyHoverTimer = this.window.setTimeout(function(aSelf) {
							tab.setAttribute(aSelf.kTWISTY_HOVER, true);
							delete tab.__treestyletab__twistyHoverTimer;
						}, 0, this);
					}
				}
				return;

			case 'mouseout':
				{
					let tab = aEvent.target;
					if (tab.__treestyletab__twistyHoverTimer) {
						this.window.clearTimeout(tab.__treestyletab__twistyHoverTimer);
						delete tab.__treestyletab__twistyHoverTimer;
					}
					tab.removeAttribute(this.kTWISTY_HOVER);
				}
				return;

			case 'dragover':
				if (!this.tooltipManager)
					this._initTooltipManager();
				if (!this._DNDObserversInitialized)
					this._initDNDObservers();
				return;

			case 'overflow':
			case 'underflow':
				return this.onTabbarOverflow(aEvent);

			case 'resize':
				return this.onResize(aEvent);


			// toolbar customizing
			case 'beforecustomization':
				this.toolbarCustomizing = true;
				return this.destroyTabbar();
			case 'aftercustomization':
				// Ignore it, because 'aftercustomization' fired not
				// following to 'beforecustomization' is invalid.
				// Personal Titlebar addon (or others) fires a fake
				// event on its startup process.
				if (!this.toolbarCustomizing)
					return;
				this.toolbarCustomizing = false;
				return this.reinitTabbar();
			case 'customizationchange':
				return this.updateCustomizedTabsToolbar();

			case 'tabviewframeinitialized':
				return this.lastTabViewGroup = this.getTabViewGroupId();


			case this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED:
				return this.onTreeStyleTabPrintPreviewEntered(aEvent);
			case this.kEVENT_TYPE_PRINT_PREVIEW_EXITED:
				return this.onTreeStyleTabPrintPreviewExited(aEvent);


			case this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END:
				return this.cancelDelayedExpandOnTabSelect();


			case 'SSWindowStateBusy':
				this.isWindowBusy = true;
				this.needRestoreTree = true;
				this.window.removeEventListener('SSWindowStateBusy', this, false);
				ReferenceCounter.remove('w,SSWindowStateBusy,TSTBrowser,false');
				return;
			case 'SSWindowStateReady':
				this.isWindowBusy = false;
				setTimeout(() => {
					this.restoreTree()
				}, 0);
				this.window.removeEventListener('SSWindowStateReady', this, false);
				ReferenceCounter.remove('w,SSWindowStateReady,TSTBrowser,false');
				return;


			case 'DOMAudioPlaybackStarted':
				{
					let tab = this.getTabFromBrowser(aEvent.originalTarget);
					this.setTabValue(tab, this.kREALLY_SOUND_PLAYING, true);
					this.updateTabAsParent(tab, {
						dontUpdateCount : true
					});
				}
				return;

			case 'DOMAudioPlaybackStopped':
				{
					let tab = this.getTabFromBrowser(aEvent.originalTarget);
					this.deleteTabValue(tab, this.kREALLY_SOUND_PLAYING);
					this.updateTabAsParent(tab, {
						dontUpdateCount : true
					});
				}
				return;

			case 'transitionend':
			case 'transitioncancel':
			case 'transitionrun':
				if (aEvent.originalTarget.localName == 'notification')
					this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_WINDOW_RESIZE);
				return;


			case 'nsDOMMultipleTabHandlerTabsClosing':
				if (!this.onTabsClosing(aEvent))
					aEvent.preventDefault();
				return;
		}
	},
	lastScrollX : -1,
	lastScrollY : -1,
	
	restoreLastScrollPosition : function TSTBrowser_restoreLastScrollPosition() 
	{
		if (this.lastScrollX < 0 || this.lastScrollY < 0 || !this.isVisible)
			return;
		var lastX = this.lastScrollX;
		var lastY = this.lastScrollY;
		this.clearLastScrollPosition();

		// don't restore scroll position if another scroll is already running.
		if (this.isSmoothScrolling())
			return;

		let x = {}, y = {};
		let scrollBoxObject = this.scrollBoxObject;
		scrollBoxObject.getPosition(x, y);
		if (x.value != lastX || y.value != lastY)
			scrollBoxObject.scrollTo(lastX, lastY);
	},
 
	clearLastScrollPosition : function TSTBrowser_clearLastScrollPosition() 
	{
		this.lastScrollX = this.lastScrollY = -1;
	},
 
	updateLastScrollPosition : function TSTBrowser_updateLastScrollPosition() 
	{
		if (!this.isVertical || !this.isVisible)
			return;
		var x = {}, y = {};
		var scrollBoxObject = this.scrollBoxObject;
		if (!scrollBoxObject)
			return;
		scrollBoxObject.getPosition(x, y);
		this.lastScrollX = x.value;
		this.lastScrollY = y.value;
	},
 
	cancelPerformingAutoScroll : function TSTBrowser_cancelPerformingAutoScroll(aOnlyCancel) 
	{
		this.stopSmoothScroll();
		this.clearLastScrollPosition();

		if (this.timers['cancelPerformingAutoScroll']) {
			clearTimeout(this.timers['cancelPerformingAutoScroll']);
			delete this.timers['cancelPerformingAutoScroll'];
		}

		if (aOnlyCancel)
			return;

		this.timers['cancelPerformingAutoScroll'] = setTimeout((function() {
			delete this.timers['cancelPerformingAutoScroll'];
		}).bind(this), 300);
	},
 
	shouldCancelEnsureElementIsVisible : function TSTBRowser_shouldCancelEnsureElementIsVisible() 
	{
		return (
			this.timers['cancelPerformingAutoScroll'] &&
			(new Error()).stack.indexOf('onxblDOMMouseScroll') < 0
		);
	},
  
	onTabOpen : function TSTBrowser_onTabOpen(aEvent, aTab) 
	{
		var tab = aTab || aEvent.originalTarget;
		var b   = this.mTabBrowser;

		if (this.isTabInitialized(tab))
			return false;

		this.initTab(tab);

		var hasStructure = this.treeStructure && this.treeStructure.length;
		var parentIndexInTree = hasStructure ? this.treeStructure.shift() : 0 ;
		var lastRelatedTab = b._lastRelatedTab;

		log('onTabOpen at ' + tab._tPos + '\n  ' + [
		  'readiedToAttachNewTab: '+this.readiedToAttachNewTab,
		  'parentTab: '+this.parentTab + ' (' + this.getTabById(this.parentTab) + ')',
		  'insertBefore: '+this.insertBefore,
		  'insertAfter: '+this.insertAfter,
		  'treeStructure: '+this.treeStructure
		].join('\n  '));

		if (utils.getTreePref('autoAttach') &&
			typeof this.readiedToAttachNewTab !== 'boolean') {
			// The "owner" may be updated after TabOpen multiple times.
			// We need to hook tab.owner to get last available owner.
			if (tab.owner)
				tab.__treestyletab__lastOwner = tab.owner.getAttribute(this.kID);
			if (!('__treestyletab__owner' in tab))
				Object.defineProperty(tab, 'owner', this.tabOwnerHookDescriptor);
			this.window.setTimeout((function() {
				var owner = this.getTabById(tab.__treestyletab__lastOwner);
				delete tab.__treestyletab__lastOwner; // it is not needed anymore!
				if (!owner)
					return;
				log('onTabOpen: new child tab opened by browser.tabs.insertRelatedAfterCurrent=true');
				var nextTab = this.findNextTabForNewChild(tab, owner);
				log('  next tab: '+(nextTab && nextTab._tPos));
				this.attachTabTo(tab, owner, {
					insertBefore: nextTab
				});
			}).bind(this), 0);
		}

		if (this.readiedToAttachNewTab) {
			if (parentIndexInTree < 0) { // there is no parent, so this is a new parent!
				this.parentTab = tab.getAttribute(this.kID);
			}

			let parent = this.getTabById(this.parentTab);
			if (parent) {
				let tabs = [parent].concat(this.getDescendantTabs(parent));
				parent = parentIndexInTree > -1 && parentIndexInTree < tabs.length ? tabs[parentIndexInTree] : parent ;
			}
			if (parent) {
				this.attachTabTo(tab, parent, {
					dontExpand : this.shouldExpandAllTree,
					dontMove   : utils.getTreePref('insertNewChildAt') == this.kINSERT_NO_CONTROL
				});
			}

			let refTab;
			let newIndex = -1;
			if (hasStructure) {
				log('  newIndex => -1 (has structure)');
			}
			else if (this.insertBefore &&
				(refTab = this.getTabById(this.insertBefore))) {
				newIndex = refTab._tPos;
				log('  newIndex => '+newIndex+' (from "insertBefore")');
			}
			else if (this.insertAfter &&
				(refTab = this.getTabById(this.insertAfter))) {
				newIndex = refTab._tPos + 1;
				log('  newIndex => '+newIndex+' (from "insertAfter")');
			}
			else if (
				parent &&
				utils.getTreePref('insertNewChildAt') == this.kINSERT_FISRT &&
				(typeof this.multipleCount !== 'number' || this._addedCountInThisLoop <= 0)
				) {
				/* 複数の子タブを一気に開く場合、最初に開いたタブだけを
				   子タブの最初の位置に挿入し、続くタブは「最初の開いたタブ」と
				   「元々最初の子だったタブ」との間に挿入していく */
				newIndex = parent._tPos + 1;
				log('  newIndex => '+newIndex+' (from "parent")');
				if (refTab = this.getFirstChildTab(parent))
					this.insertBefore = refTab.getAttribute(this.kID);
			}
			else if (utils.getTreePref('insertNewChildAt') == this.kINSERT_LAST) {
				refTab = this.findNextTabForNewChild(tab, parent);
				if (refTab)
					nextIndex = refTab._tPos;
			}

			if (newIndex > -1) {
				if (newIndex > tab._tPos)
					newIndex--;
				tab.__treestyletab__internallyTabMovingCount++;
				b.moveTabTo(tab, newIndex);
				tab.__treestyletab__internallyTabMovingCount--;
			}

			if (this.shouldExpandAllTree)
				this.collapseExpandSubtree(parent, false);
		}

		this._addedCountInThisLoop++;
		if (!this._addedCountClearTimer) {
			this._addedCountClearTimer = this.window.setTimeout((function() {
				this._addedCountInThisLoop = 0;
				this._addedCountClearTimer = null;
			}).bind(this), 0);
		}

		if (!this.readiedToAttachMultiple) {
			this.stopToOpenChildTab(b);
		}
		else {
			this.multipleCount++;
		}

		if (this.animationEnabled) {
			this.updateTabCollapsed(tab, true, true);
			let self = this;
			this.updateTabCollapsed(tab, false, this.windowService.restoringTree, function() {
				/**
				 * When the system is too slow, the animation can start after
				 * smooth scrolling is finished. The smooth scrolling should be
				 * started together with the start of the animation effect.
				 */
				self.scrollToNewTab(tab);
			});
		}
		else {
			this.scrollToNewTab(tab);
		}

		this.updateInsertionPositionInfo(tab);

		if (this.canStackTabs)
			this.updateTabsZIndex(true);

		// if there is only one tab and new another tab is opened,
		// closebox appearance is possibly changed.
		var tabs = this.getTabs(b);
		if (tabs.length == 2)
			this.updateInvertedTabContentsOrder(tabs);

		/**
		 * gBrowser.addTab() resets gBrowser._lastRelatedTab.owner
		 * when a new background tab is opened from the current tab,
		 * but it will fail with TST because gBrowser.moveTab() (called
		 * by TST) clears gBrowser._lastRelatedTab.
		 * So, we have to restore gBrowser._lastRelatedTab manually.
		 */
		b._lastRelatedTab = lastRelatedTab;

		// this is the first tab of loading group.
		if (this.nextOpenedTabToBeParent) {
			this.readyToOpenChildTab(tab, true);
		}
		delete this.nextOpenedTabToBeParent;

		tab.__treestyletab__isOpening = true;
		this.window.setTimeout((function() {
			tab.__treestyletab__isOpening = false;
		}).bind(this), 0);

		return true;
	},
	loadingMultipleTabs : false,
	_addedCountInThisLoop : 0,
	_addedCountClearTimer : null,
	_checkRestoringWindowTimerOnTabAdded : null,
	
	findNextTabForNewChild : function TSTBrowser_findNextTabForNewChild(aTab, aParent) 
	{
		if (!aParent)
			return this.getNextTab(aTab);

		var nextTab;
		if (utils.getTreePref('insertNewChildAt') === this.kINSERT_FISRT)
			nextTab = this.getFirstChildTab(aParent);
		else
			nextTab = this.getNextSiblingTab(aParent) || this.getNextTab(this.getLastDescendantTab(aParent));

		if (nextTab == aTab)
			nextTab = this.getNextTab(nextTab);

		return nextTab;
	},
 
	scrollToNewTab : function TSTBrowser_scrollToNewTab(aTab) 
	{
		if (!this.canScrollToTab(aTab))
			return;

		if (this.scrollToNewTabMode > 0)
			this.scrollToTab(aTab, this.scrollToNewTabMode < 2);
	},
 
	updateInsertionPositionInfo : function TSTBrowser_updateInsertionPositionInfo(aTab) 
	{
		if (!aTab ||
			!aTab.parentNode) // do nothing for closed tab!
			return;

		var prev = this.getPreviousSiblingTab(aTab);
		if (prev) {
			this.setTabValue(aTab, this.kINSERT_AFTER, prev.getAttribute(this.kID));
			this.setTabValue(prev, this.kINSERT_BEFORE, aTab.getAttribute(this.kID));
		} else {
			this.deleteTabValue(aTab, this.kINSERT_AFTER);
		}

		var next = this.getNextSiblingTab(aTab);
		if (next) {
			this.setTabValue(aTab, this.kINSERT_BEFORE, next.getAttribute(this.kID));
			this.setTabValue(next, this.kINSERT_AFTER, aTab.getAttribute(this.kID));
		} else {
			this.deleteTabValue(aTab, this.kINSERT_BEFORE);
		}
	},
 
	closeUpInsertionPositionInfoAround : function TSTBrowser_closeUpInsertionPositionInfoAround(aTab) 
	{
		if (!aTab ||
			!aTab.parentNode) // do nothing for closed tab!
			return;

		var prev = this.getPreviousSiblingTab(aTab);
		var next = this.getNextSiblingTab(aTab);
		if (prev) {
			this.setTabValue(aTab, this.kINSERT_AFTER, prev.getAttribute(this.kID));

			if (next)
				this.setTabValue(prev, this.kINSERT_BEFORE, next.getAttribute(this.kID));
			else
				this.deleteTabValue(prev, this.kINSERT_BEFORE);
		}
		if (next) {
			this.setTabValue(aTab, this.kINSERT_BEFORE, next.getAttribute(this.kID));

			if (prev)
				this.setTabValue(next, this.kINSERT_AFTER, prev.getAttribute(this.kID));
			else
				this.deleteTabValue(next, this.kINSERT_AFTER);
		}
	},
  
	onTabClose : function TSTBrowser_onTabClose(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var d   = this.document;
		var b   = this.mTabBrowser;

		tab.setAttribute(this.kREMOVED, true);

		this.stopTabIndentAnimation(tab);
		this.stopTabCollapseAnimation(tab);

		var closeParentBehavior = this.getCloseParentBehaviorForTab(tab);

		var backupAttributes = this._collectBackupAttributes(tab);
		log('onTabClose: backupAttributes = ', backupAttributes);

		if (closeParentBehavior == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
			this.isSubtreeCollapsed(tab))
			this._closeChildTabs(tab);

		var firstChild = this.getFirstChildTab(tab);

		this.detachAllChildren(tab, {
			behavior : closeParentBehavior
		});

		var nextFocusedTab = null;
		if (firstChild &&
			(closeParentBehavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN ||
			closeParentBehavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD))
			nextFocusedTab = firstChild;

		var toBeClosedTabs = this._collectNeedlessGroupTabs(tab);

		var parentTab = this.getParentTab(tab);
		if (parentTab) {
			if (!nextFocusedTab && tab == this.getLastChildTab(parentTab)) {
				if (tab == this.getFirstChildTab(parentTab)) // this is the really last child
					nextFocusedTab = parentTab;
				else
					nextFocusedTab = this.getPreviousSiblingTab(tab);
			}

			if (nextFocusedTab && toBeClosedTabs.indexOf(nextFocusedTab) > -1)
				nextFocusedTab = this.getNextFocusedTab(parentTab);
		}
		else if (!nextFocusedTab) {
			nextFocusedTab = this.getNextFocusedTab(tab);
		}

		if (nextFocusedTab && toBeClosedTabs.indexOf(nextFocusedTab) > -1)
			nextFocusedTab = this.getNextFocusedTab(nextFocusedTab);

		if (nextFocusedTab && nextFocusedTab.hasAttribute(this.kREMOVED))
			nextFocusedTab = null;

		this._reserveCloseRelatedTabs(toBeClosedTabs);

		this.detachTab(tab, { dontUpdateIndent : true });

		this._restoreTabAttributes(tab, backupAttributes);

		if (b.selectedTab == tab)
			this._tryMoveFocusFromClosingCurrentTab(nextFocusedTab);

		this.updateLastScrollPosition();

		this.destroyTab(tab);

		if (tab.pinned)
			this.positionPinnedTabsWithDelay();

		if (this.canStackTabs)
			this.updateTabsZIndex(true);
	},
	
	_collectBackupAttributes : function TSTBrowser_collectBackupAttributes(aTab) 
	{
		var attributes = {};

		if (this.hasChildTabs(aTab)) {
			attributes[this.kCHILDREN] = this.getTabValue(aTab, this.kCHILDREN);
			attributes[this.kSUBTREE_COLLAPSED] = this.getTabValue(aTab, this.kSUBTREE_COLLAPSED);
		}

		var ancestors = this.getAncestorTabs(aTab);
		if (ancestors.length) {
			let next = this.getNextSiblingTab(aTab);
			ancestors = ancestors.map(function(aAncestor) {
				if (!next && (next = this.getNextSiblingTab(aAncestor)))
					attributes[this.kINSERT_BEFORE] = next.getAttribute(this.kID);
				return aAncestor.getAttribute(this.kID);
			}, this);
			attributes[this.kANCESTORS] = ancestors.join('|');
		}

		return attributes;
	},
 
	_closeChildTabs : function TSTBrowser_closeChildTabs(aTab) 
	{
		var tabs = this.getDescendantTabs(aTab);
		if (!this.fireTabSubtreeClosingEvent(aTab, tabs))
			return;

		this.markAsClosedSet([aTab].concat(tabs));

		tabs.reverse();
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.mTabBrowser.removeTab(tabs[i], { animate : true });
		}

		this.fireTabSubtreeClosedEvent(this.mTabBrowser, aTab, tabs);
	},
 
	_collectNeedlessGroupTabs : function TSTBrowser_collectNeedlessGroupTabs(aTab) 
	{
		var tabs = [];
		if (!aTab || !aTab.parentNode)
			return tabs;

		var parent = this.getParentTab(aTab);
		var siblings = this.getSiblingTabs(aTab);
		var groupTabs = siblings.filter(function(aTab) {
			return this.isTemporaryGroupTab(aTab);
		}, this);
		var groupTab = (
				groupTabs.length == 1 &&
				siblings.length == 1 &&
				this.hasChildTabs(groupTabs[0])
				) ? groupTabs[0] : null ;
		if (groupTab)
			tabs.push(groupTab);

		var shouldCloseParentTab = (
				parent &&
				this.isTemporaryGroupTab(parent) &&
				this.getDescendantTabs(parent).length == 1
			);
		if (shouldCloseParentTab)
			tabs.push(parent);

		return tabs;
	},
 
	_reserveCloseRelatedTabs : function TSTBrowser_reserveCloseRelatedTabs(aTabs) 
	{
		if (!aTabs.length)
			return;

		var key = 'onTabClose_'+parseInt(Math.random() * 65000);
		this.timers[key] = setTimeout((function() {
			try {
				aTabs.forEach(function(aTab) {
					if (aTab.parentNode)
						this.mTabBrowser.removeTab(aTab, { animate : true });
				}, this);
			}
			catch(e) {
				this.defaultErrorHandler(e);
			}
			delete this.timers[key];
			aTabs = null;
			key = null;
		}).bind(this), 0);
	},
 
	_restoreTabAttributes : function TSTBrowser_restoreTabAttributes(aTab, aAttributes) 
	{
		for (var i in aAttributes)
		{
			this.setTabValue(aTab, i, aAttributes[i]);
		}
	},
 
	_tryMoveFocusFromClosingCurrentTab : function TSTBrowser_tryMoveFocusFromClosingCurrentTab(aNextFocusedTab) 
	{
		if (!aNextFocusedTab || aNextFocusedTab.hidden)
			return;

		var currentTab = this.mTabBrowser.selectedTab;
		var d = this.document;

		var event = d.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_FOCUS_NEXT_TAB, true, true);
		var canFocus = currentTab.dispatchEvent(event);

		// for backward compatibility
		event = d.createEvent('Events');
		event.initEvent(this.kEVENT_TYPE_FOCUS_NEXT_TAB.replace(/^nsDOM/, ''), true, true);
		canFocus = canFocus && currentTab.dispatchEvent(event);

		if (canFocus) {
			this._focusChangedByCurrentTabRemove = true;
			this.mTabBrowser.selectedTab = aNextFocusedTab;
		}
	},
  
	onTabsClosing : function TSTBrowser_onTabsClosing(aEvent) 
	{
		var tabs = aEvent.detail && aEvent.detail.tabs ||
					aEvent.getData('tabs') // for backward compatibility;
		var b = this.getTabBrowserFromChild(tabs[0]);

		var trees = this.splitTabsToSubtrees(tabs);
		if (trees.some(function(aTabs) {
				return aTabs.length > 1 &&
						!this.fireTabSubtreeClosingEvent(aTabs[0], aTabs);
			}, this))
			return false;

		trees.forEach(this.markAsClosedSet, this);

		let key = 'onTabClosing_'+parseInt(Math.random() * 65000);
		this.timers[key] = setTimeout((function() {
			try {
				for (let i = 0, maxi = trees.length; i < maxi; i++)
				{
					let tabs = trees[i];
					this.fireTabSubtreeClosedEvent(b, tabs[0], tabs);
				}
			}
			catch(e) {
				this.defaultErrorHandler(e);
			}
			delete this.timers[key];
		}).bind(this), 0);

		return true;
	},
 
	onTabMove : function TSTBrowser_onTabMove(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.mTabBrowser;
		if (this.isWindowBusy) {
			log('onTabMove: do nothing because now we are restoring a window');
			return;
		}

		var prevPosition = aEvent.detail;
		var positionControlled = utils.getTreePref('insertNewChildAt') != this.kINSERT_NO_CONTROL;
		if (tab.__treestyletab__isOpening &&
			!this.isTabInternallyMoving(tab) &&
			positionControlled) {
			log('onTabMove for new child tab: move back '+tab._tPos+' => '+prevPosition);
			tab.__treestyletab__internallyTabMovingCount++;
			b.moveTabTo(tab, prevPosition);
			tab.__treestyletab__internallyTabMovingCount--;
			return;
		}

		tab.__treestyletab__previousPosition = prevPosition;
		logWithStackTrace('onTabMove '+prevPosition+' => '+tab._tPos+' (internal moving count='+tab.__treestyletab__internallyTabMovingCount+', owner='+String(tab.owner)+')');

		// When the tab was moved before TabOpen event is fired, we have to update manually.
		var newlyOpened = !this.isTabInitialized(tab) && this.onTabOpen(null, tab);

		var restored = false;

		// twisty vanished after the tab is moved!!
		this.initTabContents(tab);

		this.onTabContextIdChanged(tab);

		this.window.TreeStyleTabWindowHelper.initTabMethods(tab, b);

		// On Firefox 29, 30 and laters, reopened (restored) tab can be
		// placed in wrong place, because "TabMove" event fires before
		// "SSTabRestoring" event and "kINSERT_BEFORE" information is
		// unexpectedly cleared. So now I simulate the "SSTabRestoring"
		// event here.
		// See: https://github.com/piroor/treestyletab/issues/676#issuecomment-47700158
		if (tab.__SS_extdata) {
			let storedId = tab.__SS_extdata[this.kID]; // getTabValue() doesn't get the value!
			if (storedId && tab.getAttribute(this.kID) != storedId)
				restored = this.onTabRestoring(aEvent);
		}
		log('  newlyOpened: '+newlyOpened);
		log('  restored:    '+restored);

		if (this.hasChildTabs(tab) && !this.subTreeMovingCount) {
			log('  => move sub tree');
			this.moveTabSubtreeTo(tab, tab._tPos);
		}

		this.updateTabAsParent(tab);

		var tabsToBeUpdated = [tab];

		var allTabs = this.getAllTabs(this.mTabBrowser);
		tabsToBeUpdated.push(allTabs[prevPosition]);
		if (prevPosition > tab._tPos) { // from bottom to top
			if (prevPosition < allTabs.length - 1)
				tabsToBeUpdated.push(allTabs[prevPosition + 1]);
		}
		else { // from top to bottom
			if (prevPosition > 0)
				tabsToBeUpdated.push(allTabs[prevPosition - 1]);
		}

		var parentTab = this.getParentTab(tab);
		if (parentTab) {
			let children = this.getChildTabs(parentTab);
			let oldChildIndex = children.indexOf(tab);
			if (oldChildIndex > -1) {
				if (oldChildIndex > 0) {
					let oldPrevTab = children[oldChildIndex - 1];
					tabsToBeUpdated.push(oldPrevTab);
				}
				if (oldChildIndex < children.lenght - 1) {
					let oldNextTab = children[oldChildIndex + 1];
					tabsToBeUpdated.push(oldNextTab);
				}
			}
			if (!this.subTreeChildrenMovingCount)
				this.updateChildrenArray(parentTab);
		}
		log('  tabsToBeUpdated: '+tabsToBeUpdated.map(function(aTab) { return aTab._tPos; }));

		var updatedTabs = new WeakMap();
		tabsToBeUpdated.forEach(function(aTab) {
			if (updatedTabs.has(aTab))
				return;
			updatedTabs.set(aTab, true);
			this.updateInsertionPositionInfo(aTab);
		}, this);
		updatedTabs = undefined;

		this.positionPinnedTabsWithDelay();

		if (this.canStackTabs)
			this.updateTabsZIndex(true);

		if (
			this.subTreeMovingCount ||
			this.isTabInternallyMoving(tab) ||
			// We don't have to fixup tree structure for a NEW TAB
			// which has already been structured.
			(newlyOpened && this.getParentTab(tab))
			)
			return;

		if (!restored &&
			!positionControlled &&
			!this.isTabInternallyMoving(tab))
			this.attachTabFromPosition(tab, aEvent.detail);

		this.rearrangeTabViewItems(tab);
	},
	
	attachTabFromPosition : function TSTBrowser_attachTabFromPosition(aTab, aOldPosition) 
	{
		log('attachTabFromPosition '+aOldPosition+' => '+aTab._tPos);
		var parent = this.getParentTab(aTab);
		log('  parent: '+(parent&&(parent._tPos+'('+parent.linkedBrowser.currentURI.spec+')') || 'null'));

		if (aOldPosition === void(0))
			aOldPosition = aTab._tPos;

		var pos = this.getChildIndex(aTab, parent);
		var oldPositionTab = this.getAllTabs(this.mTabBrowser)[aOldPosition];
		var oldPos = this.getChildIndex(oldPositionTab, parent);
		var delta;
		if (oldPositionTab == aTab && pos == oldPos) { // no move?
			log('  => no move');
			return;
		}
		else if (pos < 0 || oldPos < 0) {
			delta = 2;
		}
		else {
			delta = Math.abs(pos - oldPos);
		}

		logWithStackTrace('  moving');

		var prevTab = this.getPreviousVisibleTab(aTab);
		var nextTab = this.getNextVisibleTab(aTab);

		var tabs = this.getDescendantTabs(aTab);
		if (tabs.length) {
			nextTab = this.getNextTab(tabs[tabs.length-1]);
		}
		log('  prevTab: '+(prevTab&&(prevTab._tPos+'('+prevTab.linkedBrowser.currentURI.spec+')')));
		log('  nextTab: '+(nextTab&&(nextTab._tPos+'('+nextTab.linkedBrowser.currentURI.spec+')')));

		var prevParent = this.getParentTab(prevTab);
		var nextParent = this.getParentTab(nextTab);

		var prevLevel  = prevTab ? Number(prevTab.getAttribute(this.kNEST)) : -1 ;
		var nextLevel  = nextTab ? Number(nextTab.getAttribute(this.kNEST)) : -1 ;
		log('  prevLevel: '+prevLevel);
		log('  nextLevel: '+nextLevel);

		var newParent;

		if (parent &&
			prevTab &&
			[prevTab].concat(this.getAncestorTabs(prevTab)).indexOf(parent) > -1) {
			log(' => no need to fix case');
			newParent = parent;
		}
		else if (!prevTab) {
			log(' => moved to topmost position');
			newParent = null;
		}
		else if (!nextTab) {
			log(' => moved to last position');
			newParent = (delta > 1) ? prevParent : parent ;
		}
		else if (prevParent == nextParent) {
			log(' => moved into existing tree');
			newParent = prevParent;
		}
		else if (prevLevel > nextLevel) {
			log(' => moved to end of existing tree');
			if (this.mTabBrowser.selectedTab != aTab) { 
				log('    => maybe newly opened tab');
				newParent = prevParent;
			}
			else {
				log('    => maybe drag and drop');
				var realDelta = Math.abs(aTab._tPos - aOldPosition);
				newParent = realDelta < 2 ? prevParent : (parent || nextParent) ;
			}
		}
		else if (prevLevel < nextLevel) {
			log(' => moved to first child position of existing tree');
			newParent = prevTab || parent || nextParent;
		}

		if (newParent != parent) {
			if (newParent) {
				if (newParent.hidden == aTab.hidden)
					this.attachTabTo(aTab, newParent, { insertBefore : nextTab });
			}
			else {
				this.detachTab(aTab);
			}
		}
	},
 
	updateChildrenArray : function TSTBrowser_updateChildrenArray(aTab) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		var children = this.getChildTabs(aTab);
		children.sort(this.sortTabsByOrder);
		this.setTabValue(
			aTab,
			this.kCHILDREN,
			children
				.map(function(aItem) {
					return aItem.getAttribute(this.kID);
				}, this)
				.join('|')
		);
	},
 
	// for TabView (Panorama aka Tab Candy)
	rearrangeTabViewItems : function TSTBrowser_rearrangeTabViewItems(aTab) 
	{
		if (
			!aTab.parentNode || // do nothing for closed tab!
			!aTab.tabItem ||
			!aTab.tabItem.parent ||
			!aTab.tabItem.parent.reorderTabItemsBasedOnTabOrder
			)
			return;

		aTab.tabItem.parent.reorderTabItemsBasedOnTabOrder();
	},
  
	// for TabView (Panorama aka Tab Candy)
	onTabVisibilityChanged : function TSTBrowser_onTabVisibilityChanged(aEvent) 
	{
		/**
		 * Note: On this timing, we cannot know that which is the reason of this
		 * event, by exitting from Panorama or the "Move to Group" command in the
		 * context menu on tabs. So, we have to do operations with a delay to compare
		 * last and current group which is updated in the next event loop.
		 */

		var tab = aEvent.originalTarget;
		this.updateInvertedTabContentsOrder(tab);
		this.tabVisibilityChangedTabs.push({
			tab  : tab,
			type : aEvent.type
		});

		if (this.tabVisibilityChangedTimer) {
			this.window.clearTimeout(this.tabVisibilityChangedTimer);
			this.tabVisibilityChangedTimer = null;
		}

		this.tabVisibilityChangedTimer = this.window.setTimeout(function(aSelf) {
			aSelf.tabVisibilityChangedTimer = null;

			var tabs = aSelf.tabVisibilityChangedTabs;
			if (!tabs.length)
				return;

			// restore tree from bottom safely
			var restoreTabs = tabs.filter(function(aChanged) {
					return aChanged.type == 'TabShow' &&
							aChanged.tab.__treestyletab__restoreState == aSelf.RESTORE_STATE_READY_TO_RESTORE;
				})
				.map(function(aChanged) {
					return aChanged.tab;
				})
				.sort(function(aA, aB) {
					return aB._tPos - aA._tPos;
				})
				.filter(aSelf.restoreOneTab, aSelf);
			for (let i = 0, maxi = restoreTabs.length; i < maxi; i++)
			{
				let tab = restoreTabs[i];
				aSelf.updateInsertionPositionInfo(tab);
				delete tab.__treestyletab__restoreState;
			}

			var currentGroupId = aSelf.getTabViewGroupId();
			if (aSelf.lastTabViewGroup && currentGroupId != aSelf.lastTabViewGroup) {
				// We should clear it first, because updateTreeByTabVisibility() never change visibility of tabs.
				aSelf.tabVisibilityChangedTabs = [];
				aSelf.updateTreeByTabVisibility(tabs.map(function(aChanged) { return aChanged.tab; }));
			}
			else {
				// For tabs moved by "Move to Group" command in the context menu on tabs
				var processedTabs = {};
				/**
				 * subtreeFollowParentAcrossTabGroups() can change visibility of child tabs, so,
				 * we must not clear tabVisibilityChangedTabs here, and we have to use
				 * simple "for" loop instead of Array.prototype.forEach.
				 */
				for (let i = 0; i < aSelf.tabVisibilityChangedTabs.length; i++)
				{
					let changed = aSelf.tabVisibilityChangedTabs[i];
					let tab = changed.tab;
					if (aSelf.getAncestorTabs(tab).some(function(aTab) {
							return processedTabs[aTab.getAttribute(aSelf.kID)];
						}))
						continue;
					aSelf.subtreeFollowParentAcrossTabGroups(tab);
					processedTabs[tab.getAttribute(aSelf.kID)] = true;
				}
				// now we can clear it!
				aSelf.tabVisibilityChangedTabs = [];
			}
			aSelf.lastTabViewGroup = currentGroupId;
			aSelf.checkTabsIndentOverflow();
		}, 0, this);
	},
	tabVisibilityChangedTimer : null,
	lastTabViewGroup : null,
	
	updateTreeByTabVisibility : function TSTBrowser_updateTreeByTabVisibility(aChangedTabs) 
	{
		this.internallyTabMovingCount++;

		var allTabs = this.getAllTabs(this.mTabBrowser);
		var normalTabs = allTabs.filter(function(aTab) {
							return !aTab.pinned;
						});
		aChangedTabs = aChangedTabs || normalTabs;

		var shownTabs = aChangedTabs.filter(function(aTab) {
							return !aTab.hidden;
						});

		var movingTabToAnotherGroup = !shownTabs.length;
		var switchingGroup = !movingTabToAnotherGroup;

		var lastIndex = allTabs.length - 1;
		var lastMovedTab;
		normalTabs = normalTabs.slice(0).reverse();
		for (let i = 0, maxi = normalTabs.length; i < maxi; i++)
		{
			let tab = normalTabs[i];
			let parent = this.getParentTab(tab);
			let attached = false;
			if (parent && (tab.hidden != parent.hidden)) {
				let lastNextTab = null;
				this.getAncestorTabs(tab).some(function(aAncestor) {
					if (aAncestor.hidden == tab.hidden) {
						this.attachTabTo(tab, aAncestor, {
							dontMove     : true,
							insertBefore : lastNextTab
						});
						attached = true;
						return true;
					}
					lastNextTab = this.getNextSiblingTab(aAncestor);
					return false;
				}, this);
				if (!attached) {
					this.collapseExpandTab(tab, false, true);
					this.detachTab(tab);
				}
			}

			if (aChangedTabs.indexOf(tab) < 0)
				continue;

			if (
				switchingGroup &&
				!tab.hidden &&
				!attached &&
				!parent
				) {
				let prev = this.getPreviousTab(tab);
				let next = this.getNextTab(tab);
				if (
					(prev && aChangedTabs.indexOf(prev) < 0 && !prev.hidden) ||
					(next && aChangedTabs.indexOf(next) < 0 && !next.hidden)
					)
					this.attachTabFromPosition(tab, lastIndex);
			}

			if (movingTabToAnotherGroup && tab.hidden) {
				let index = lastMovedTab ? lastMovedTab._tPos - 1 : lastIndex ;
				this.mTabBrowser.moveTabTo(tab, index);
				lastMovedTab = tab;
			}
		}
		this.internallyTabMovingCount--;
	},
 
	subtreeFollowParentAcrossTabGroups : function TSTBrowser_subtreeFollowParentAcrossTabGroups(aParent) 
	{
		if (this.tabViewTreeIsMoving)
			return;

		var id = this.getTabViewGroupId(aParent);
		if (!id)
			return;

		this.tabViewTreeIsMoving = true;
		this.internallyTabMovingCount++;
		var w = this.window;
		var b = this.mTabBrowser;
		var lastCount = this.getAllTabs(b).length - 1;

		this.detachTab(aParent);
		b.moveTabTo(aParent, lastCount);
		var descendantTabs = this.getDescendantTabs(aParent);
		for (let i = 0, maxi = descendantTabs.length; i < maxi; i++)
		{
			let tab = descendantTabs[i];
			w.TabView.moveTabTo(tab, id);
			b.moveTabTo(tab, lastCount);
		}
		this.internallyTabMovingCount--;
		this.tabViewTreeIsMoving = false;
	},
	tabViewTreeIsMoving : false,
 
	getTabViewGroupId : function TSTBrowser_getTabViewGroupId(aTab) 
	{
		var tab = aTab || this.mTabBrowser.selectedTab;
		var item = tab._tabViewTabItem;
		if (!item)
			return null;

		var group = item.parent;
		if (!group)
			return null;

		return group.id;
	},
  
	onRestoreTabContentStarted : function TSTBrowser_onRestoreTabContentStarted(aTab)
	{
		// don't override "false" value (means "already restored")!
		if (typeof aTab.__treestyletab__toBeRestored == 'undefined')
			aTab.__treestyletab__toBeRestored = true;
	},
 
	onTabRestoring : function TSTBrowser_onTabRestoring(aEvent) 
	{
		var tab = aEvent.originalTarget;
		log('onTabRestoring ', tab._tPos);

		tab.__treestyletab__toBeRestored = false;
		var restored = this.handleRestoredTab(tab);

		/**
		 * Updating of the counter which is used to know how many tabs were
		 * restored in a time.
		 */
		this.windowService.restoringCount++;
		/**
		 * By nsSessionStore.js, the next "SSTabRestoring" event will be fined
		 * with "window.setTimeout()" following this "SSTabRestoring" event.
		 * So, we have to do "setTimeout()" twice.
		 */
		this.window.setTimeout((function() {
			/**
			 * On this timing, the next "SSTabRestoring" is not fired yet.
			 * We only register the countdown task for the next event loop.
			 */
			let key = 'onTabRestoring_'+parseInt(Math.random() * 65000);
			this.timers[key] = setTimeout((function() {
				try {
					/**
					 * On this timing, the next "SSTabRestoring" was fired.
					 * Now we can decrement the counter.
					 */
					this.windowService.restoringCount--;
				}
				catch(e) {
					this.defaultErrorHandler(e);
				}
				delete this.timers[key];
			}).bind(this), 0);
		}).bind(this), 0);

		if (!tab.selected &&
			this.mTabBrowser.currentURI.spec == 'about:sessionrestore' &&
			this.mTabBrowser.selectedBrowser.getAttribute('remote') != 'true') {
			// because this is a chrome document, E10S is not applied.
			let frame = this.mTabBrowser.contentWindow;
			frame = frame.wrappedJSObject || frame;
			let tree = frame.document.getElementById('tabList');
			let data = frame.gTreeData;
			if (tree && data) {
				let item = data[tree.currentIndex];
				this.window.setTimeout(function(aSelf, aTab, aTitle, aParent) {
					if (aTab.label== aTitle)
						aSelf.attachTabTo(aTab, aParent);
				}, 0, this, tab, item.label, this.mTabBrowser.selectedTab);
			}
		}

		return restored;
	},
	
	handleRestoredTab : function TSTBrowser_handleRestoredTab(aTab) 
	{
		if (aTab.__treestyletab__restoreState === undefined) {
			log('handleRestoredTab: ' + aTab._tPos + ' is already restored!');
			return false;
		}

		if (aTab.__treestyletab__restoreState == this.RESTORE_STATE_READY_TO_RESTORE) {
			// this is a hidden tab in the background group, and
			// have to be restored by restoreOneTab() on "TabShown" event.
			this.deleteTabValue(aTab, this.kCLOSED_SET_ID);
			return false;
		}

		var [id, mayBeDuplicated] = this._restoreTabId(aTab);
		var structureRestored = aTab.__treestyletab__restoreState == this.RESTORE_STATE_STRUCTURE_RESTORED;
		var children = this.getTabValue(aTab, this.kCHILDREN);
		if (
			!structureRestored &&
			(
				!mayBeDuplicated ||
				aTab.getAttribute(this.kCHILDREN) != children
			)
			) {
			// failsafe
			this.detachAllChildren(aTab, {
				dontUpdateIndent : true,
				dontAnimate      : this.windowService.restoringTree
			});
		}

		var closeSetId = !structureRestored && this._getCloseSetId(aTab, mayBeDuplicated);

		// remove temporary cache
		var currentId = aTab.getAttribute(this.kID);
		if (id != currentId &&
			currentId &&
			currentId in this.tabsHash &&
			this.tabsHash[currentId] == aTab)
			delete this.tabsHash[currentId];

		this.setTabValue(aTab, this.kID, id);
		this.tabsHash[id] = aTab;

		var undoing = (
			// on e10s window, SSTabRestoring event can fire while undoCloseTab() is executing.
			this.browser.__treestyletab__doingUndoCloseTab ||
			// on non-e10s window, SSTabRestoring event is fired after the undoCloseTab() is executing.
			aTab.__treestyletab__restoredByUndoCloseTab
		);

		if (structureRestored && !undoing) {
			this._fixMissingAttributesFromSessionData(aTab);
		}
		else {
			let isSubtreeCollapsed = this._restoreSubtreeCollapsedState(aTab);

			let restoringMultipleTabs = this.windowService.restoringTree;
			let options = {
					dontExpand       : restoringMultipleTabs,
					dontUpdateIndent : true,
					dontAnimate      : restoringMultipleTabs
				};
			let childTabs = structureRestored ?
				[] :
				this._restoreChildTabsRelation(aTab, children, mayBeDuplicated, options);

			this._restoreTabPositionAndIndent(aTab, childTabs, mayBeDuplicated);

			if (closeSetId && undoing)
				this.restoreClosedSet(closeSetId, aTab);

			if (isSubtreeCollapsed)
				this.collapseExpandSubtree(aTab, isSubtreeCollapsed);
		}

		if (mayBeDuplicated) {
			this.clearRedirectionTableWithDelay();
			this.clearRedirectbTabRelationsWithDelay(aTab);
		}

		delete aTab.__treestyletab__restoreState;

		return true;
	},
	
	_restoreTabId : function TSTBrowser_restoreTabId(aTab) 
	{
		// kID can be overridden by nsSessionStore. kID_NEW is for failsafe.
		var currentId  = aTab.getAttribute(this.kID_NEW) || aTab.getAttribute(this.kID);
		aTab.removeAttribute(this.kID_NEW);
		var restoredId = this.getTabValue(aTab, this.kID);
		var mayBeDuplicated = false;

		aTab.setAttribute(this.kID_RESTORING, restoredId);
		if (this.isTabDuplicated(aTab)) {
			mayBeDuplicated = true;
			/**
			 * If the tab has its ID as the attribute, then we should use it
			 * instead of redirected ID, because the tab has been possibly
			 * attached to another tab.
			 */
			restoredId = currentId || this.redirectId(restoredId);
		}
		aTab.removeAttribute(this.kID_RESTORING);

		return [restoredId || currentId, mayBeDuplicated];
	},
 
	_getCloseSetId : function TSTBrowser_getCloseSetId(aTab, aMayBeDuplicated) 
	{
		var closeSetId = null;
		if (!aMayBeDuplicated) {
			closeSetId = this.getTabValue(aTab, this.kCLOSED_SET_ID);
			/**
			 * If the tab is not a duplicated but it has a parent, then,
			 * it is wrongly attacched by tab moving on restoring.
			 * Restoring the old ID (the next statement) breaks the children
			 * list of the temporary parent and causes many problems.
			 * So, to prevent these problems, I detach the tab from the temporary
			 * parent manually.
			 * If the ID stored in the session equals to the value of the
			 * attribute stored in the element itself, then don't reset the
			 * tab, because the restoring session is got from the tab itself.
			 * ( like SS.setTabState(tab, SS.getTabState(tab)) )
			 */
			if (this.getTabValue(aTab, this.kID) != aTab.getAttribute(this.kID))
				this.resetTab(aTab, false);
		}
		this.deleteTabValue(aTab, this.kCLOSED_SET_ID);
		return closeSetId;
	},
 
	_fixMissingAttributesFromSessionData : function TSTBrowser_fixMissingAttributesFromSessionData(aTab) 
	{
		/**
		 * By some reasons (ex. persistTabAttribute()), actual state of
		 * the tab (attributes) can be lost on SSTabRestoring.
		 * For failsafe, we must override actual attributes by stored
		 * values.
		 */
		var keys = [
				this.kINSERT_BEFORE,
				this.kINSERT_AFTER
			];
		for (let i = 0, maxi = keys.length; i < maxi; i++)
		{
			let key = keys[i];
			let tab = this.getTabValue(aTab, key);
			if (this.getTabById(tab))
				this.setTabValue(aTab, key, tab);
		}

		let parentId = this.getTabValue(aTab, this.kPARENT);
		let parentTab = this.getTabById(parentId);
		if (parentTab && parentTab._tPos < aTab._tPos)
			this.setTabValue(aTab, this.kPARENT, parentId);
		else
			this.deleteTabValue(aTab, this.kPARENT);

		let ancestors = [aTab].concat(this.getAncestorTabs(aTab));
		let children = this.getTabValue(aTab, this.kCHILDREN);
		children = children.split('|').filter(function(aChild) {
			let tab = this.getTabById(aChild);
			return tab && ancestors.indexOf(tab) < 0;
		}, this);
		this.setTabValue(aTab, this.kCHILDREN, children.join('|'));

		let subtreeCollapsed = this.getTabValue(aTab, this.kSUBTREE_COLLAPSED);
		if (subtreeCollapsed != aTab.getAttribute(this.kSUBTREE_COLLAPSED))
			this.collapseExpandSubtree(aTab, subtreeCollapsed == 'true', true);
	},
 
	_restoreSubtreeCollapsedState : function TSTBrowser_restoreSubtreeCollapsedState(aTab, aCollapsed) 
	{
		var shouldCollapse = utils.getTreePref('collapseExpandSubtree.sessionRestore');

		if (aCollapsed === void(0))
			aCollapsed = this.getTabValue(aTab, this.kSUBTREE_COLLAPSED) == 'true';

		var isSubtreeCollapsed = (
				this.windowService.restoringTree &&
				(
					shouldCollapse == this.RESTORED_TREE_COLLAPSED_STATE_LAST_STATE ?
						aCollapsed :
						shouldCollapse == this.RESTORED_TREE_COLLAPSED_STATE_COLLAPSED
				)
			);
		this.setTabValue(aTab, this.kSUBTREE_COLLAPSED, isSubtreeCollapsed);
		return isSubtreeCollapsed;
	},
 
	_restoreChildTabsRelation : function TSTBrowser_restoreChildTabsRelation(aTab, aChildrenList, aMayBeDuplicated, aOptions) 
	{
		var childTabs = [];
		if (!aChildrenList)
			return childTabs;

		aTab.removeAttribute(this.kCHILDREN);

		aChildrenList = aChildrenList.split('|');
		if (aMayBeDuplicated)
			aChildrenList = aChildrenList.map(function(aChild) {
				return this.redirectId(aChild);
			}, this);

		for (let i = 0, maxi = aChildrenList.length; i < maxi; i++)
		{
			let childTab = aChildrenList[i];
			if (childTab && (childTab = this.getTabById(childTab))) {
				let options = aOptions;
				if (options && typeof options == 'function')
					options = options(childTab);
				this.attachTabTo(childTab, aTab, options);
				childTabs.push(childTab);
			}
		}
		aChildrenList = aChildrenList.join('|');
		if (aTab.getAttribute(this.kCHILDREN) == aChildrenList)
			aTab.removeAttribute(this.kCHILDREN_RESTORING);
		else
			aTab.setAttribute(this.kCHILDREN_RESTORING, aChildrenList);

		return childTabs;
	},
 
	_restoreTabPositionAndIndent : function TSTBrowser_restoreTabPositionAndIndent(aTab, aChildTabs, aMayBeDuplicated) 
	{
		var restoringMultipleTabs = this.windowService.restoringTree;
		var position = this._prepareInsertionPosition(aTab, aMayBeDuplicated);
		var parent = position.parent;
		log('handleRestoredTab: found parent = ' + parent);
		if (parent) {
			aTab.removeAttribute(this.kPARENT);
			parent = this.getTabById(parent);
			if (parent) {
				this.attachTabTo(aTab, parent, {
					dontExpand       : restoringMultipleTabs,
					insertBefore     : position.next,
					dontUpdateIndent : true,
					dontAnimate      : restoringMultipleTabs
				});
				this.updateTabsIndent([aTab], undefined, restoringMultipleTabs);
				this.checkTabsIndentOverflow();

				if (parent.getAttribute(this.kCHILDREN_RESTORING))
					this.correctChildTabsOrderWithDelay(parent);
			}
			else {
				this.deleteTabValue(aTab, this.kPARENT);
			}
		}
		else {
			if (aChildTabs.length) {
				this.updateTabsIndent(aChildTabs, undefined, restoringMultipleTabs);
				this.checkTabsIndentOverflow();
			}
			this._restoreTabPosition(aTab, position.next);
		}
	},
	
	_prepareInsertionPosition : function TSTBrowser_prepareInsertionPosition(aTab, aMayBeDuplicated) 
	{
		var next = this.getTabValue(aTab, this.kINSERT_BEFORE);
		if (next && aMayBeDuplicated)
			next = this.redirectId(next);
		next = this.getTabById(next);

		if (!next) {
			let prev = this.getTabValue(aTab, this.kINSERT_AFTER);
			if (prev && aMayBeDuplicated)
				prev = this.redirectId(prev);
			prev = this.getTabById(prev);
			next = this.getNextSiblingTab(prev);
		}

		var ancestors = (this.getTabValue(aTab, this.kANCESTORS) || this.getTabValue(aTab, this.kPARENT)).split('|');
		log('handleRestoredTab: ancestors = ' + ancestors);
		var parent = null;
		for (let i in ancestors)
		{
			if (aMayBeDuplicated)
				ancestors[i] = this.redirectId(ancestors[i]);
			parent = this.getTabById(ancestors[i]);
			if (parent) {
				parent = ancestors[i];
				break;
			}
		}
		this.deleteTabValue(aTab, this.kANCESTORS);

		/**
		 * If the tab is a duplicated and the tab has already been
		 * attached, then reuse current status based on attributes.
		 * (Note, if the tab is not a duplicated tab, all attributes
		 * have been cleared.)
		 */
		if (!parent) {
			parent = aTab.getAttribute(this.kPARENT);
			log('handleRestoredTab: parent = ' + parent);
			if (parent && !next)
				next = this.getNextSiblingTab(aTab);
		}

		return {
			parent : parent,
			next   : next
		};
	},
  
	_restoreTabPosition : function TSTBrowser_restoreTabPosition(aTab, aNextTab) 
	{
		if (!aNextTab)
			aNextTab = this.getNextTab(aTab);
		var parentOfNext = this.getParentTab(aNextTab);
		var newPos = -1;
		if (parentOfNext) {
			let descendants = this.getDescendantTabs(parentOfNext);
			if (descendants.length)
				newPos = descendants[descendants.length-1]._tPos;
		}
		else if (aNextTab) {
			newPos = aNextTab._tPos;
			if (newPos > aTab._tPos)
				newPos--;
		}
		if (newPos > -1)
			this.mTabBrowser.moveTabTo(aTab, newPos);
	},
  
	handleTabToggleMuteAudio : function TSTBrowser_handleTabToggleMuteAudio(aTab) 
	{
		if (!this.isCollapsed(aTab) && !this.isSubtreeCollapsed(aTab))
			return;
		let children = this.getChildTabs(aTab);
		let parentStatus = aTab.getAttribute('muted');
		children.forEach(function(aChild) {
			if (aChild.getAttribute('muted') == parentStatus)
				aChild.toggleMuteAudio();
		}, this);
	},
 
	correctChildTabsOrderWithDelay : function TSTBrowser_correctChildTabsOrderWithDelay(aTab) 
	{
		if (aTab.correctChildTabsOrderWithDelayTimer)
			this.window.clearTimeout(aTab.correctChildTabsOrderWithDelayTimer);

		aTab.correctChildTabsOrderWithDelayTimer = this.window.setTimeout(function(aSelf) {
			aSelf.correctChildTabsOrder(aTab);
		}, 10, this);
	},
 
	correctChildTabsOrder : function TSTBrowser_correctChildTabsOrder(aTab) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		var restoringChildren = aTab.getAttribute(this.kCHILDREN_RESTORING);
		if (!restoringChildren)
			return;

		var children = aTab.getAttribute(this.kCHILDREN);
		if (restoringChildren != children) {
			var restoringChildrenIDs = restoringChildren.split('|').reverse();
			for (let i = 0, maxi = restoringChildrenIDs.length; i < maxi; i++)
			{
				let child = this.getTabById(restoringChildrenIDs[i]);
				if (!child)
					continue;

				let nextTab = i > 0 ?
							this.getTabById(restoringChildrenIDs[i-1]) :
							this.getNextSiblingTab(aTab) ;
				if (nextTab == this.getNextSiblingTab(child))
					continue;

				let newPos = -1;
				if (nextTab) {
					newPos = nextTab._tPos;
					if (newPos > child._tPos)
						newPos--;
				}
				if (newPos > -1)
					this.moveTabSubtreeTo(child, newPos);
			}
			children = aTab.getAttribute(this.kCHILDREN);
		}

		if (restoringChildren == children)
			aTab.removeAttribute(this.kCHILDREN_RESTORING);

		aTab.correctChildTabsOrderWithDelayTimer = null;
	},
 
	redirectId : function TSTBrowser_redirectId(aId) 
	{
		if (!(aId in this._redirectionTable))
			this._redirectionTable[aId] = this.makeNewId();
		return this._redirectionTable[aId];
	},
	_redirectionTable : {},
 
	clearRedirectionTableWithDelay : function TSTBrowser_clearRedirectionTableWithDelay() 
	{
		if (this._clearRedirectionTableTimer) {
			this.window.clearTimeout(this._clearRedirectionTableTimer);
			this._clearRedirectionTableTimer = null;
		}
		this._clearRedirectionTableTimer = this.window.setTimeout(function(aSelf) {
			aSelf._redirectionTable = {};
		}, 1000, this);
	},
	_clearRedirectionTableTimer : null,
 
	clearRedirectbTabRelationsWithDelay : function TSTBrowser_clearRedirectbTabRelationsWithDelay(aTab) 
	{
		if (aTab._clearRedirectbTabRelationsTimer) {
			this.window.clearTimeout(aTab._clearRedirectbTabRelationsTimer);
			aTab._clearRedirectbTabRelationsTimer = null;
		}
		aTab._clearRedirectbTabRelationsTimer = this.window.setTimeout(function(aSelf) {
			aSelf.clearRedirectbTabRelations(aTab);
			delete aTab._clearRedirectbTabRelationsTimer;
		}, 1500, this);
	},
	clearRedirectbTabRelations : function TSTBrowser_clearRedirectbTabRelations(aTab) 
	{
		if (!aTab || !aTab.parentNode)
			return;

		var redirectingIds = Object.keys(this._redirectionTable).map(function(aId) {
			return this._redirectionTable[aId];
		}, this);
		var existingIds = this.getAllTabs(this.mTabBrowser).map(function(aTab) {
			return this.getTabValue(aTab, this.kID);
		}, this);
		var validIds = redirectingIds.concat(existingIds);
		validIds = validIds.filter(function(aId) {
			return !!aId;
		});

		var ancestors = this.getTabValue(aTab, this.kANCESTORS);
		if (ancestors) {
			ancestors = ancestors.split('|');
			let actualAncestors = this.getAncestorTabs(aTab).map(function(aTab) {
				return aTab.getAttribute(this.kID);
			}, this);
			ancestors = ancestors.filter(function(aAncestor) {
				if (actualAncestors.indexOf(aAncestor) < 0)
					return false;
				else
					return validIds.indexOf(aAncestor) > -1;
			}, this);
			if (ancestors.length)
				this.setTabValue(aTab, this.kANCESTORS, ancestors.join('|'));
			else
				this.deleteTabValue(aTab, this.kANCESTORS);
		}

		var children = this.getTabValue(aTab, this.kCHILDREN);
		if (children) {
			children = children.split('|');
			children = children.filter(function(aChild) {
				if (this.getParentTab(this.getTabById(aChild)) != aTab)
					return false;
				else
					return validIds.indexOf(aChild) > -1;
			}, this);
			if (children.length)
				this.setTabValue(aTab, this.kCHILDREN, children.join('|'));
			else
				this.deleteTabValue(aTab, this.kCHILDREN);
		}

		var restoringChildren = aTab.getAttribute(this.kCHILDREN_RESTORING);
		if (restoringChildren) {
			restoringChildren = restoringChildren.split('|');
			restoringChildren = restoringChildren.filter(function(aChild) {
				return validIds.indexOf(aChild) > -1;
			}, this);
			if (restoringChildren.length)
				aTab.setAttribute(this.kCHILDREN_RESTORING, restoringChildren.join('|'));
			else
				aTab.removeAttribute(this.kCHILDREN_RESTORING);
		}
	},
 
	restoreClosedSet : function TSTBrowser_restoreClosedSet(aId, aRestoredTab) 
	{
		var behavior = this.undoCloseTabSetBehavior;
		if (
			this._restoringClosedSet ||
			!(behavior & this.kUNDO_CLOSE_SET || behavior & this.kUNDO_ASK)
			)
			return;

		var indexes = [];
		var items = utils.evalInSandbox('('+this.SessionStore.getClosedTabData(this.window)+')');
		for (let i = 0, maxi = items.length; i < maxi; i++)
		{
			let item = items[i];
			if (item.state.extData &&
				item.state.extData[this.kCLOSED_SET_ID] &&
				item.state.extData[this.kCLOSED_SET_ID] == aId)
				indexes.push(i);
		}

		var count = parseInt(aId.split('::')[1]);

		if (
			!indexes.length ||
			(
				indexes.length+1 < count &&
				behavior & this.kUNDO_CLOSE_FULL_SET
			)
			)
			return;

		if (behavior & this.kUNDO_ASK) {
			let self = this;
			aRestoredTab.addEventListener('SSTabRestoring', function onSSTabRestoring(aEvent) {
				aRestoredTab.removeEventListener(aEvent.type, onSSTabRestoring, false);
				ReferenceCounter.remove('aRestoredTab,SSTabRestoring,onSSTabRestoring,false');
				self.askUndoCloseTabSetBehavior(aRestoredTab, indexes.length)
					.then(function(aBehavior) {
						if (aBehavior & self.kUNDO_CLOSE_SET)
							self.doRestoreClosedSet(aRestoredTab, indexes);
					})
					.catch(function(aError) {
						Components.utils.reportError(aError);
					});
			}, false);
			ReferenceCounter.add('aRestoredTab,SSTabRestoring,onSSTabRestoring,false');
		}
		else if (behavior & this.kUNDO_CLOSE_SET) {
			this.doRestoreClosedSet(aRestoredTab, indexes);
		}
	},
	
	doRestoreClosedSet : function TSTBrowser_doRestoreClosedSet(aRestoredTab, aIndexes) 
	{
		if (!this.window.PlacesUIUtils.confirmOpenInTabs(aIndexes.length, this.window))
			return;

		this._restoringClosedSet = true;

		this.windowService.restoringTree = true;

		var offset = 0;
		for (let i = 0, maxi = aIndexes.length; i < maxi; i++)
		{
			this.window.undoCloseTab(aIndexes[i] - (offset++));
		}

		var nextFocusedTab = aRestoredTab;
		this.window.setTimeout((function() {
			this.windowService.restoringTree = false;
			this.mTabBrowser.selectedTab = nextFocusedTab;
			this._restoringClosedSet = false;
		}).bind(this), 0);
	},
	_restoringClosedSet : false,
   
	onTabRestored : function TSTBrowser_onTabRestored(aEvent) 
	{
		var tab = aEvent.originalTarget;
		log('onTabRestored ', tab._tPos);
		this.initTabContents(tab); // the restored current tab can lost its contents on startup.
		this.updateTabAsParent(tab, {
			dontUpdateCount : true
		});
		delete tab.__treestyletab__restoredByUndoCloseTab;
		this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_RESET);
	},
 
	onTabPinned : function TSTBrowser_onTabPinned(aTab) 
	{
		var parentTab = this.getParentTab(aTab);

		this.collapseExpandSubtree(aTab, false);

		/**
		 * Children of the newly pinned tab are possibly
		 * moved to the top of the tab bar, by TabMove event
		 * from the newly pinned tab. So, we have to
		 * reposition unexpectedly moved children.
		 */
		if (!parentTab) {
			/**
			 * Universal but dangerous logic. "__treestyletab__previousPosition"
			 * can be broken by multiple movings.
			 */
			let b = this.browser;
			this.internallyTabMovingCount++;
			let children = this.getDescendantTabs(aTab).reverse();
			for (let i = 0, maxi = children.length; i < maxi; i++)
			{
				let childTab = children[i];
				if (childTab.__treestyletab__previousPosition > childTab._tPos)
					b.moveTabTo(childTab, childTab.__treestyletab__previousPosition);
			}
			this.internallyTabMovingCount--;
		}
		else {
			/**
			 * Safer logic. This cannot be available for "root" tabs because
			 * their children (already moved) have no way to know the anchor
			 * position (the next sibling of the pinned tab itself).
			 */
			let b = this.browser;
			this.internallyTabMovingCount++;
			let children = this.getChildTabs(aTab).reverse();
			for (let i = 0, maxi = children.length; i < maxi; i++)
			{
				let childTab = children[i];
				if (childTab._tPos < parentTab._tPos)
					b.moveTabTo(childTab, parentTab._tPos);
			}
			this.internallyTabMovingCount--;
		}

		this.detachAllChildren(aTab, {
			behavior : this.getCloseParentBehaviorForTab(
				aTab,
				this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
			)
		});
		this.detachTab(aTab);

		this.collapseExpandTab(aTab, false);
		if (this.isVertical)
			this.positionPinnedTabsWithDelay();
	},
 
	onTabUnpinned : function TSTBrowser_onTabUnpinned(aTab) 
	{
		var style = aTab.style;
		style.marginLeft = style.marginRight = style.marginTop = '';

		this.updateInvertedTabContentsOrder(aTab);
		if (this.isVertical)
			this.positionPinnedTabsWithDelay();
	},
 
	onTabSelect : function TSTBrowser_onTabSelect(aEvent) 
	{
		var b   = this.mTabBrowser;
		var tab = b.selectedTab

		this.cancelDelayedExpandOnTabSelect();

		if (
			/**
			 * <tabbrowser>.previewTab() focuses to the tab internally,
			 * so we should ignore this event if it is fired from previewTab().
			 */
			b._previewMode ||
			/**
			 * Ignore selected tabs which is being closed. For example,
			 * when a collapsed tree is closed, Firefox unexpectedly gives
			 * focus to a collapsed child in the tree.
			 */
			(b._removingTabs && b._removingTabs.indexOf(tab) > -1)
			)
			return;

		var shouldCollapseExpandNow = utils.getTreePref('autoCollapseExpandSubtreeOnSelect');
		var newActiveTabOptions = {
				canCollapseTree : shouldCollapseExpandNow,
				canExpandTree   : shouldCollapseExpandNow
			};
		if (this.isCollapsed(tab)) {
			if (utils.getTreePref('autoExpandSubtreeOnCollapsedChildFocused')) {
				this.getAncestorTabs(tab).forEach(function(aAncestor) {
					this.collapseExpandSubtree(aAncestor, false);
				}, this);
				this.handleNewActiveTab(tab, newActiveTabOptions);
			}
			else {
				b.selectedTab = this.getRootTab(tab);
			}
		}
		else if (
				(
					/**
					 * Focus movings by arrow keys should not be handled on TabSelect,
					 * because they are already handled by handleAdvanceSelectedTab().
					 */
					this.windowService.arrowKeyEventOnTab &&
					this.windowService.arrowKeyEventOnTab.advanceFocus
				) ||
				(
					/**
					 * Focus movings by closing of the old current tab should be handled
					 * only when it is activated by user preference expressly.
					 */
					this._focusChangedByCurrentTabRemove &&
					!utils.getTreePref('autoCollapseExpandSubtreeOnSelect.onCurrentTabRemove')
				)
			) {
			// do nothing!
		}
		else if (this.hasChildTabs(tab) && this.isSubtreeCollapsed(tab)) {
			if (
				this._focusChangedByShortcut &&
				this.windowService.accelKeyPressed
				) {
				if (utils.getTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut')) {
					newActiveTabOptions.canExpandTree = true;
					newActiveTabOptions.canCollapseTree = (
						newActiveTabOptions.canCollapseTree &&
						utils.getTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut.collapseOthers')
					);
					let delay = utils.getTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay');
					if (delay > 0) {
						this._autoExpandOnTabSelectTimer = this.window.setTimeout(function(aSelf) {
							if (tab && tab.parentNode)
								aSelf.handleNewActiveTab(tab, newActiveTabOptions);
						}, delay, this);
					}
					else {
						this.handleNewActiveTab(tab, newActiveTabOptions);
					}
				}
				else if (newActiveTabOptions.canExpandTree) {
					this.windowService.expandTreeAfterKeyReleased(tab);
				}
			}
			else {
				this.handleNewActiveTab(tab, newActiveTabOptions);
			}
		}

		this._focusChangedByCurrentTabRemove = false;
		this._focusChangedByShortcut = false;

		this.updateInvertedTabContentsOrder();

		if (!this.isTabInViewport(tab)) {
			this.scrollToTab(tab);
			aEvent.stopPropagation();
		}
	},
	cancelDelayedExpandOnTabSelect : function TSTBrowser_cancelDelayedExpandOnTabSelect() {
		if (this._autoExpandOnTabSelectTimer) {
			this.window.clearTimeout(this._autoExpandOnTabSelectTimer);
			this._autoExpandOnTabSelectTimer = null;
		}
	},
	handleNewActiveTab : function TSTBrowser_handleNewActiveTab(aTab, aOptions)
	{
		if (this.doingCollapseExpand || !aTab || !aTab.parentNode)
			return;

		aOptions = aOptions || {};

		if (this._handleNewActiveTabTimer)
			this.window.clearTimeout(this._handleNewActiveTabTimer);

		/**
		 * First, we wait until all event listeners for the TabSelect
		 * event were processed.
		 */
		this._handleNewActiveTabTimer = this.window.setTimeout(function(aSelf) {
			aSelf.window.clearTimeout(aSelf._handleNewActiveTabTimer);
			aSelf._handleNewActiveTabTimer = null;

			if (aOptions.canExpandTree) {
				if (aOptions.canCollapseTree &&
					utils.getTreePref('autoExpand.intelligently'))
					aSelf.collapseExpandTreesIntelligentlyFor(aTab);
				else
					aSelf.collapseExpandSubtree(aTab, false);
			}
		}, 0, this);
	},
	_handleNewActiveTabTimer : null,
	
	handleAdvanceSelectedTab : function TSTBrowser_handleAdvanceSelectedTab(aDir, aWrap) 
	{
		this._focusChangedByShortcut = this.windowService.accelKeyPressed;

		if (!this.canCollapseSubtree(this.mTabBrowser.selectedTab) ||
			utils.getTreePref('focusMode') != this.kFOCUS_VISIBLE)
			return false;

		if (this.processArrowKeyOnFocusAdvanced())
			return true;

		return this.advanceSelectedTab(aDir, aWrap);
	},
	
	processArrowKeyOnFocusAdvanced : function TSTBrowser_processArrowKeyOnFocusAdvanced() 
	{
		var event = this.windowService.arrowKeyEventOnTab;
		if (!event)
			return false;

		if (
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			event.shiftKey ||
			(this.isVertical ? (event.up || event.down) : (event.left || event.right))
			) {
			event.advanceFocus = true;
			return false;
		}

		var collapse, expand;
		switch (this.position)
		{
			case 'top':
				collapse = event.up;
				expand = event.down;
				break;

			case 'bottom':
				collapse = event.down;
				expand = event.up;
				break;

			case 'left':
				collapse = event.left;
				expand = event.right;
				break;

			case 'right':
				if (utils.getTreePref('tabbar.invertTab')) {
					collapse = event.right;
					expand = event.left;
				}
				else {
					collapse = event.left;
					expand = event.right;
				}
				break;
		}

		var tab = this.mTabBrowser.selectedTab;

		var collapsed = this.isSubtreeCollapsed(tab);
		if (this.hasChildTabs(tab) && (collapsed ? expand : collapse )) {
			event.collapse = collapse;
			event.expand = expand;
			this.collapseExpandSubtree(tab, !collapsed);
			return true;
		}

		var nextSelected;
		if (expand)
			nextSelected = this.getFirstChildTab(tab);
		else if (collapse)
			nextSelected = this.getParentTab(tab);

		if (nextSelected) {
			event.advanceFocus = true;
			this.mTabBrowser.selectedTab = nextSelected;
			return true;
		}

		return true;
	},
 
	advanceSelectedTab : function TSTBrowser_advanceSelectedTab(aDir, aWrap) 
	{
		var tab = this.mTabBrowser.selectedTab;
		var tabbar = this.mTabBrowser.tabContainer;

		var nextTab = (aDir < 0) ? this.getPreviousVisibleTab(tab) : this.getNextVisibleTab(tab) ;
		if (!nextTab && aWrap) {
			let tabs = tabbar.querySelectorAll('tab:not(['+this.kCOLLAPSED+'="true"])');
			nextTab = tabs[aDir < 0 ? tabs.length-1 : 0 ];
		}
		if (nextTab && nextTab != tab)
			tabbar._selectNewTab(nextTab, aDir, aWrap);

		return true;
	},
   
	onTabClick : function TSTBrowser_onTabClick(aEvent, aTab) 
	{
		aTab = aTab || this.getTabFromEvent(aEvent);

		if (aEvent.button == 1) {
			if (!this.warnAboutClosingTabSubtreeOf(aTab)) {
				aEvent.preventDefault();
				aEvent.stopPropagation();
			}
			return;
		}

		if (aEvent.button != 0)
			return;

		if (this.isEventFiredOnTwisty(aEvent)) {
			if (this.hasChildTabs(aTab) && this.canCollapseSubtree(aTab)) {
				this.manualCollapseExpandSubtree(aTab, aTab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');
				aEvent.preventDefault();
				aEvent.stopPropagation();
			}
			return;
		}

		if (this.isEventFiredOnClosebox(aEvent)) {
			if (!this.warnAboutClosingTabSubtreeOf(aTab)) {
				aEvent.preventDefault();
				aEvent.stopPropagation();
			}
			return;
		}
	},

	onTabContextIdChanged : function TSTBrowser_onTabContextIdChanged(aTab)
	{
		if (!ContextualIdentityService ||
			aTab.__treestyletab__updatingContextualTabColor)
			return;

		aTab.__treestyletab__updatingContextualTabColor = true;
		setTimeout(function() {
			aTab.__treestyletab__updatingContextualTabColor = false;
		}, 1);

		var tabStyle = aTab.style;
		var tabBackground = aTab.ownerDocument.getAnonymousElementByAttribute(aTab, 'class', 'tab-background');
		var backgroundStyle = tabBackground && tabBackground.style;
		function clearOldStyles() {
			tabStyle.backgroundImage =
				tabStyle.backgroundSize =
				tabStyle.backgroundRepeat =
				tabStyle.backgroundPosition = '';
			if (backgroundStyle)
				backgroundStyle.backgroundImage =
					backgroundStyle.backgroundSize =
					backgroundStyle.backgroundRepeat =
					backgroundStyle.backgroundPosition = '';
		}

		if (!this.isVertical) {
			clearOldStyles();
			ContextualIdentityService.setTabStyle(aTab);
			return;
		}

		var color;
		var userContextId = aTab.getAttribute('usercontextid');
		if (userContextId) {
			let identity = ContextualIdentityService.getPublicIdentityFromId ?
							ContextualIdentityService.getPublicIdentityFromId(userContextId) : // Firefox 54 and later
							ContextualIdentityService.getIdentityFromId(userContextId) ; // Firefox 53 or older
			color = identity ? identity.color : null ;
		}
		if (color) {
			setTimeout(function() {
				clearOldStyles();

				var style = utils.getTreePref('tabbar.style') == 'sidebar' ? backgroundStyle : tabStyle ;
				if (!style)
					style = tabStyle;

				style.setProperty('background-image', 'linear-gradient(to bottom, transparent 0, ' + color + ' 5%, ' + color + ' 95%, transparent 100%)', 'important');
	  			style.setProperty('background-size', '2px auto', 'important');
	  			style.setProperty('background-repeat', 'no-repeat', 'important');
	  			let shouldInvert = this.position == 'right' && utils.getTreePref('tabbar.invertTab');
	  			let position = shouldInvert ? 'right' : 'left' ;
	  			style.setProperty('background-position', position, 'important');
	  		}, 0);
		}
	},
 
	onClick : function TSTBrowser_onClick(aEvent) 
	{
		if (
			aEvent.target.ownerDocument != this.document ||
			aEvent.button != 0 ||
			this.isAccelKeyPressed(aEvent)
			)
			return;

		var tab = this.getTabFromEvent(aEvent);
		if (tab) {
			this.onTabClick(aEvent, tab);
		}
		else {
			// click on indented space on the tab bar
			tab = this.getTabFromTabbarEvent(aEvent);
			if (tab)
				this.mTabBrowser.selectedTab = tab;
		}
	},
 
	onDblClick : function TSTBrowser_onDblClick(aEvent) 
	{
		let tab = this.getTabFromEvent(aEvent);
		if (tab &&
			this.hasChildTabs(tab) &&
			utils.getTreePref('collapseExpandSubtree.dblclick')) {
			this.manualCollapseExpandSubtree(tab, tab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');
			aEvent.preventDefault();
			aEvent.stopPropagation();
		}
	},
 
	onMozMouseHittest : function TSTBrowser_onMozMouseHittest(aEvent) 
	{
		// block default behaviors of the tab bar (dragging => window move, etc.)
		if (
			!this.getTabFromEvent(aEvent) &&
			!this.isEventFiredOnClickable(aEvent) &&
			(
				this.position != 'top' ||
				aEvent.shiftKey ||
				this.tabbarDNDObserver.canDragTabbar(aEvent)
			)
			)
			aEvent.stopPropagation();
	},
 
	onMouseDown : function TSTBrowser_onMouseDown(aEvent) 
	{
		if (this.isEventFiredOnScrollbar(aEvent))
			this.cancelPerformingAutoScroll();

		if (
			aEvent.button == 0 &&
			this.isEventFiredOnTwisty(aEvent)
			) {
			// prevent to select the tab for clicking on twisty
			aEvent.stopPropagation();
			// prevent to focus to the tab element itself
			aEvent.preventDefault();
		}
		else {
			this.onMozMouseHittest(aEvent);
		}
	},
 
	onScroll : function TSTBrowser_onScroll(aEvent) 
	{
		// restore scroll position when a tab is closed.
		this.restoreLastScrollPosition();
	},
 
	onTabbarOverflow : function TSTBrowser_onTabbarOverflow(aEvent) 
	{
		if (this.getTabFromEvent(aEvent))
			return;

		var tabs = this.mTabBrowser.tabContainer;
		var horizontal = tabs.orient == 'horizontal';
		if (horizontal)
			return;

		aEvent.stopPropagation();
		this.positionPinnedTabsWithDelay();
		if (aEvent.detail == 1) {
			/**
			 * By horizontal overflow/underflow, Firefox can wrongly
			 * removes "overflow" attribute for vertical tab bar.
			 * We have to override the result.
			 */
			this.updateTabbarOverflow();
		}
		else {
			if (aEvent.type == 'overflow') {
				tabs.setAttribute('overflow', 'true');
				this.scrollBoxObject.ensureElementIsVisible(tabs.selectedItem);
				utils.updateNarrowScrollbarStyle(this.browser);
			}
			else {
				tabs.removeAttribute('overflow');
			}
		}
	},
 
	onResize : function TSTBrowser_onResize(aEvent) 
	{
		if (
			!aEvent.originalTarget ||
			!(aEvent.originalTarget instanceof this.window.Window)
			)
			return;

		var resizedTopFrame = aEvent.originalTarget.top;
		// for E10S tabs, isContentResize is always false.
		var isInProcessTab = this.mTabBrowser.selectedBrowser.getAttribute('remote') != 'true';
		var isContentResize = isInProcessTab && resizedTopFrame == this.mTabBrowser.contentWindow;
		var isChromeResize = resizedTopFrame == this.window;

		if (isChromeResize && aEvent.originalTarget != resizedTopFrame) {
			// ignore resizing of sub frames in "position:fixed" box
			let target = aEvent.target;
			try {
				let node = target.QueryInterface(Ci.nsIInterfaceRequestor)
								.getInterface(Ci.nsIWebNavigation)
								.QueryInterface(Ci.nsIDocShell)
								.chromeEventHandler;
				let root = node.ownerDocument.documentElement;
				while (node && node != root) {
					if (node.boxObject && !node.boxObject.parentBox) {
						isChromeResize = false;
						break;
					}
					node = node.parentNode;
				}
			}
			catch(e) {
			}
		}

		// Ignore events when a background tab raises to the foreground.
		if (isContentResize && this._lastTabbarPlaceholderSize) {
			let newSize = this.getTabbarPlaceholderSize();
			isContentResize =
				newSize.width != this._lastTabbarPlaceholderSize.width ||
				newSize.height != this._lastTabbarPlaceholderSize.height;
		}

		if (isContentResize || isChromeResize) {
			log('TSTBrowser_onResize');
			log('  isContentResize = '+isContentResize);
			log('  isChromeResize = '+isChromeResize);
			this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_WINDOW_RESIZE);
			this.updateInvertedTabContentsOrder(true);
			this.mTabBrowser.tabContainer.adjustTabstrip();
		}
	},
 
	onPopupShowing : function TSTBrowser_onPopupShowing(aEvent) 
	{
		if (aEvent.target == aEvent.currentTarget)
			this.initTabContextMenu(aEvent);
	},
	
	initTabContextMenu : function TSTBrowser_initTabContextMenu(aEvent) 
	{
		var b = this.mTabBrowser;
		var sep, items = {};

		var ids = [
				this.kMENUITEM_RELOADSUBTREE,
				this.kMENUITEM_RELOADCHILDREN,
				this.kMENUITEM_REMOVESUBTREE,
				this.kMENUITEM_REMOVECHILDREN,
				this.kMENUITEM_REMOVEALLTABSBUT,
				this.kMENUITEM_COLLAPSE,
				this.kMENUITEM_EXPAND,
				this.kMENUITEM_AUTOHIDE,
				this.kMENUITEM_FIXED,
				this.kMENUITEM_BOOKMARKSUBTREE
			];
		for (let i = 0, maxi = ids.length; i < maxi; i++)
		{
			let id = ids[i];
			let item = aEvent.currentTarget.querySelector('*[id^="'+id+'"]');
			if (!item)
				continue;
			items[id] = item;
			if (utils.getTreePref('show.'+id))
				item.removeAttribute('hidden');
			else
				item.setAttribute('hidden', true);
			switch (id)
			{
				case this.kMENUITEM_RELOADSUBTREE:
				case this.kMENUITEM_RELOADCHILDREN:
				case this.kMENUITEM_REMOVESUBTREE:
				case this.kMENUITEM_REMOVECHILDREN:
				case this.kMENUITEM_REMOVEALLTABSBUT:
				case this.kMENUITEM_COLLAPSE:
				case this.kMENUITEM_EXPAND:
				case this.kMENUITEM_BOOKMARKSUBTREE:
					this.showHideSubtreeMenuItem(item, [b.mContextTab]);
					continue;
				default:
					continue;
			}
		}

		// collapse/expand all
		sep = aEvent.currentTarget.querySelector('menuseparator[id^="'+this.kMENUITEM_COLLAPSEEXPAND_SEPARATOR+'"]');
		let collapseItem = items[this.kMENUITEM_COLLAPSE];
		let expandItem = items[this.kMENUITEM_EXPAND];
		if (this.canCollapseSubtree(b) &&
			b.tabContainer.querySelector('tab['+this.kCHILDREN+']')) {
			if (collapseItem) {
				if (b.tabContainer.querySelector('tab['+this.kCHILDREN+']:not(['+this.kSUBTREE_COLLAPSED+'="true"])'))
					collapseItem.removeAttribute('disabled');
				else
					collapseItem.setAttribute('disabled', true);
			}

			if (expandItem) {
				if (b.tabContainer.querySelector('tab['+this.kCHILDREN+']['+this.kSUBTREE_COLLAPSED+'="true"]'))
					expandItem.removeAttribute('disabled');
				else
					expandItem.setAttribute('disabled', true);
			}
		}
		else {
			if (collapseItem)
				collapseItem.setAttribute('hidden', true);
			if (expandItem)
				expandItem.setAttribute('hidden', true);
		}
		if (sep) {
			if (
				(!collapseItem || collapseItem.getAttribute('hidden') == 'true') &&
				(!expandItem || expandItem.getAttribute('hidden') == 'true')
				) {
				sep.setAttribute('hidden', true);
			}
			else {
				sep.removeAttribute('hidden');
			}
		}

		// close all tabs but this tree
		let removeAllTabsBut = items[this.kMENUITEM_REMOVEALLTABSBUT];
		if (removeAllTabsBut) {
			let rootTabs = this.visibleRootTabs;
			if (rootTabs.length == 1 && rootTabs[0] == b.mContextTab)
				removeAllTabsBut.setAttribute('disabled', true);
			else
				removeAllTabsBut.removeAttribute('disabled');
		}

		// auto hide
		let autohide = items[this.kMENUITEM_AUTOHIDE];
		if (autohide)
			this.autoHide.updateMenuItem(autohide);

		// fix
		let fixedPref;
		let fixedLabel;
		if (this.isVertical) {
			fixedPref = b.getAttribute(this.kFIXED+'-vertical') == 'true';
			fixedLabel = 'label-vertical';
		}
		else {
			fixedPref = b.getAttribute(this.kFIXED+'-horizontal') == 'true';
			fixedLabel = 'label-horizontal';
		}
		let fixed = items[this.kMENUITEM_FIXED];
		if (fixed) {
			fixed.setAttribute('label', fixed.getAttribute(fixedLabel));
			if (fixedPref)
				fixed.setAttribute('checked', true);
			else
				fixed.removeAttribute('checked');
		}

		sep = aEvent.currentTarget.querySelector('menuseparator[id^="'+this.kMENUITEM_AUTOHIDE_SEPARATOR+'"]');
		if (sep) {
			if (
				(autohide && autohide.getAttribute('hidden') != 'true') ||
				(fixed && fixed.getAttribute('hidden') != 'true')
				) {
				sep.removeAttribute('hidden');
			}
			else {
				sep.setAttribute('hidden', true);
			}
		}

		let closeTabsToEnd = aEvent.currentTarget.querySelector('*[id^="'+this.kMENUITEM_CLOSE_TABS_TO_END+'"]');
		if (closeTabsToEnd) { // https://bugzilla.mozilla.org/show_bug.cgi?id=866880
			let label, accesskey;
			if (this.isVertical) {
				label = utils.treeBundle.getString('closeTabsToTheEnd_vertical_label');
				accesskey = utils.treeBundle.getString('closeTabsToTheEnd_vertical_accesskey');
			}
			else {
				label = this._closeTabsToEnd_horizontalLabel;
				accesskey = this._closeTabsToEnd_horizontalAccesskey;
			}
			closeTabsToEnd.setAttribute('label', label);
			closeTabsToEnd.setAttribute('accesskey', accesskey);
		}
	},
  
	onBeforeFullScreenToggle : function TSTBrowser_onBeforeFullScreenToggle(aEnterFS)
	{
		log('onBeforeFullScreenToggle / ' + this.position);
		if (this.position != 'top') {
			log('  this.document.mozFullScreen => ' + this.document.mozFullScreen);
			log('  aEnterFS => ' + aEnterFS);
			// ignore entering to the DOM-fullscreen (ex. YouTube Player)
			if (!this.document.mozFullScreen) {
				if (aEnterFS)
					this.autoHide.startForFullScreen();
				else
					this.autoHide.endForFullScreen();
			}
		}
	},
 
	onTreeStyleTabPrintPreviewEntered : function TSTBrowser_onTreeStyleTabPrintPreviewEntered(aEvent) 
	{
		this.setTabbrowserAttribute(this.kPRINT_PREVIEW, true);
	},
 
	onTreeStyleTabPrintPreviewExited : function TSTBrowser_onTreeStyleTabPrintPreviewExited(aEvent) 
	{
		this.removeTabbrowserAttribute(this.kPRINT_PREVIEW);
	},
  
/* commands */ 
	
/* reset */ 
	
	resetTab : function TSTBrowser_resetTab(aTab, aDetachAllChildren) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		if (aDetachAllChildren)
			this.detachAllChildren(aTab, {
				dontUpdateIndent : true,
				dontAnimate      : true
			});

		this.detachTab(aTab, {
			dontUpdateIndent : true,
			dontAnimate      : true
		});

		this.resetTabState(aTab);
		this.updateTabsIndent([aTab], undefined, true);
	},
	
	resetTabState : function TSTBrowser_resetTabState(aTab) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		aTab.removeAttribute(this.kID);
		aTab.removeAttribute(this.kID_RESTORING);
		aTab.removeAttribute(this.kPARENT);
		aTab.removeAttribute(this.kCHILDREN);
		aTab.removeAttribute(this.kCHILDREN_RESTORING);
		aTab.removeAttribute(this.kSUBTREE_COLLAPSED);
		aTab.removeAttribute(this.kSUBTREE_EXPANDED_MANUALLY);
		aTab.removeAttribute(this.kCOLLAPSED);
		aTab.removeAttribute(this.kNEST);
		this.updateTabCollapsed(aTab, false, true);
	},
  
	resetAllTabs : function TSTBrowser_resetAllTabs(aDetachAllChildren) 
	{
		var tabs = this.getAllTabs(this.mTabBrowser);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.resetTab(tabs[i], aDetachAllChildren);
		}
	},
 
	resetTabbarSize : function TSTBrowser_resetTabbarSize() 
	{
		if (this.isVertical) {
			//this.tabbarWidth = utils.getTreePref('tabbar.width.default');
			this.autoHide.resetWidth();
		}
		else {
			this.tabbarHeight = utils.getTreePref('tabbar.height.default');
			let tabContainerBox = this.getTabContainerBox(this.mTabBrowser);
			tabContainerBox.removeAttribute('height');
			this._tabStripPlaceHolder.height = tabContainerBox.boxObject.height;
		}

		this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_RESET);
	},
 
	get treeViewEnabled() /* PUBLIC API */ 
	{
		return this._treeViewEnabled;
	},
	set treeViewEnabled(aValue)
	{
		var newValue = !!aValue;
		if (newValue == this._treeViewEnabled)
			return aValue;

		this._treeViewEnabled = newValue;
		if (this._treeViewEnabled) {
			this.allowSubtreeCollapseExpand = true;

			let tabs = this.getAllTabs(this.browser);
			for (let i = 0, maxi = tabs.length; i < maxi; i++)
			{
				let tab = tabs[i];
				if (tab._TSTLastSubtreeCollapsed)
					this.collapseExpandSubtree(tab, true, true);
				if (tab._TSTLastSubtreeExpandedManually)
					this.setTabValue(tab, this.kSUBTREE_EXPANDED_MANUALLY, true);
				delete tab._TSTLastSubtreeCollapsed;
				delete tab._TSTLastSubtreeExpandedManually;
				this.updateTabIndent(tab, 0, true);
			}
			this.updateTabsIndent(this.rootTabs, undefined, true);
		}
		else {
			let tabs = this.getAllTabs(this.browser);
			for (let i = 0, maxi = tabs.length; i < maxi; i++)
			{
				let tab = tabs[i];
				this.updateTabIndent(tab, 0, true);
				tab._TSTLastSubtreeCollapsed = this.isSubtreeCollapsed(tab);
				tab._TSTLastSubtreeExpandedManually = this.getTabValue(tab, this.kSUBTREE_EXPANDED_MANUALLY) == 'true';
				this.collapseExpandSubtree(tab, false, true);
			}

			this.allowSubtreeCollapseExpand = false;
		}
		return aValue;
	},
//	_treeViewEnabled : true,
  
/* attach/detach */ 
	
	attachTabTo : function TSTBrowser_attachTabTo(aChild, aParent, aInfo) /* PUBLIC API */ 
	{
		if (!aChild.parentNode || (aParent && !aParent.parentNode)) {
			log('attachTabTo: canceled for already removed tab');
			return;
		}

		log('attachTabTo: attach ', aChild._tPos, ' to ', aParent._tPos);

		aInfo = aInfo || {};
		var newAncestors = [];

		if (aParent) {
			newAncestors = [aParent].concat(this.getAncestorTabs(aParent));
			if (this.maxTreeLevelPhysical && this.maxTreeLevel > -1) {
				let level = parseInt(aParent.getAttribute(this.kNEST) || 0) + 1;
				newAncestors.some(function(aAncestor) {
					if (level <= this.maxTreeLevel)
						return true;
					level--;
					return false;
				}, this);
			}
		}

		var currentParent;
		if (
			!aChild ||
			!aParent ||
			aChild == aParent ||
			(currentParent = this.getParentTab(aChild)) == aParent ||
			aChild.pinned ||
			aParent.pinned
			) {
			log('attachTabTo: already attached');
			this.fireAttachedEvent(aChild, aParent);
			return;
		}

		// avoid recursive tree
		var ancestors = [aParent].concat(this.getAncestorTabs(aChild));
		if (ancestors.indexOf(aChild) > -1) {
			log('attachTabTo: canceled for recursive request');
			return;
		}

		currentParent = ancestors[ancestors.length-1];
		var shouldInheritIndent = (
				!currentParent ||
				(currentParent.getAttribute(this.kNEST) == aParent.getAttribute(this.kNEST))
			);

		this.ensureTabInitialized(aChild);
		this.ensureTabInitialized(aParent);

		if (!aInfo)
			aInfo = {};

		var id = aChild.getAttribute(this.kID);

		this.detachTab(aChild, {
			dontUpdateIndent : true
		});

		var children = aParent.getAttribute(this.kCHILDREN)
						.split('|').filter(function(aId) {
							return this.getTabById(aId);
						}, this);

		var newIndex;

		var oldIndex = children.indexOf(id);
		if (oldIndex > -1)
			children.splice(oldIndex, 1);

		var insertBefore = aInfo.insertBefore ||
						(aInfo.dontMove ? this.getNextTab(aChild) : null );
		var beforeTab = insertBefore ? insertBefore.getAttribute(this.kID) : null ;
		var beforeIndex;
		if (beforeTab && (beforeIndex = children.indexOf(beforeTab)) > -1) {
			children.splice(beforeIndex, 0, id);
			newIndex = insertBefore._tPos;
		}
		else {
			children.push(id);
			if (aInfo.dontMove && children.length > 1) {
				children = children
							.map(this.getTabById, this)
							.sort(this.sortTabsByOrder)
							.map(function(aTab) {
								return aTab.getAttribute(this.kID);
							}, this);
			}
			let refTab = aParent;
			let descendant = this.getDescendantTabs(aParent);
			if (descendant.length) {
				let lastDescendant = descendant[descendant.length-1];
				/**
				 * The last descendant tab can be temporarilly moved
				 * upper than the root parent tab, in some cases.
				 * (the parent tab is pinned, etc.)
				 */
				if (!refTab || lastDescendant._tPos > refTab._tPos)
					refTab = lastDescendant;
			}
			newIndex = refTab._tPos+1;
		}

		this.setTabValue(aParent, this.kCHILDREN, children.join('|'));
		this.setTabValue(aChild, this.kPARENT, aParent.getAttribute(this.kID));

		this.updateTabAsParent(aParent);
		if (shouldInheritIndent && !aInfo.dontUpdateIndent)
			this.inheritTabIndent(aChild, aParent);

		if (!aInfo.dontMove) {
			if (newIndex > aChild._tPos)
				newIndex--;
			this.moveTabSubtreeTo(aChild, newIndex);
		}

		if (aInfo.forceExpand) {
			this.collapseExpandSubtree(aParent, false, aInfo.dontAnimate);
		}
		else if (!aInfo.dontExpand) {
			if (utils.getTreePref('autoCollapseExpandSubtreeOnAttach') &&
				this.shouldTabAutoExpanded(aParent))
				this.collapseExpandTreesIntelligentlyFor(aParent);

			if (utils.getTreePref('autoCollapseExpandSubtreeOnSelect')) {
				newAncestors.forEach(function(aAncestor) {
					if (this.shouldTabAutoExpanded(aAncestor))
						this.collapseExpandSubtree(aAncestor, false, aInfo.dontAnimate);
				}, this);
			}
			else if (this.shouldTabAutoExpanded(aParent)) {
				if (utils.getTreePref('autoExpandSubtreeOnAppendChild')) {
					newAncestors.forEach(function(aAncestor) {
						if (this.shouldTabAutoExpanded(aAncestor))
							this.collapseExpandSubtree(aAncestor, false, aInfo.dontAnimate);
					}, this);
				}
				else
					this.collapseExpandTab(aChild, true, aInfo.dontAnimate);
			}

			if (this.isCollapsed(aParent))
				this.collapseExpandTab(aChild, true, aInfo.dontAnimate);
		}
		else if (this.shouldTabAutoExpanded(aParent) ||
				this.isCollapsed(aParent)) {
			this.collapseExpandTab(aChild, true, aInfo.dontAnimate);
		}

		if (!aInfo.dontUpdateIndent) {
			this.updateTabsIndent([aChild], undefined, aInfo.dontAnimate);
			this.checkTabsIndentOverflow();
		}

		this.promoteTooDeepLevelTabs(aChild);

		this.fireAttachedEvent(aChild, aParent);
	},
	fireAttachedEvent : function TSTBrowser_fireAttachedEvent(aChild, aParent)
	{
		var data = {
				parentTab : aParent
			};

		/* PUBLIC API */
		this.fireCustomEvent(this.kEVENT_TYPE_ATTACHED, aChild, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_ATTACHED.replace(/^nsDOM/, ''), aChild, true, false, data);
	},
	
	shouldTabAutoExpanded : function TSTBrowser_shouldTabAutoExpanded(aTab) 
	{
		return this.hasChildTabs(aTab) &&
				this.isSubtreeCollapsed(aTab);
	},
  
	detachTab : function TSTBrowser_detachTab(aChild, aInfo) /* PUBLIC API */ 
	{
		if (!aChild || !aChild.parentNode) {
			log('detachTab: canceled for already removed tab');
			return;
		}
		if (!aInfo)
			aInfo = {};

		var parentTab = this.getParentTab(aChild);
		if (!parentTab) {
			log('detachTab: canceled for an orphan tab');
			return;
		}

		log('detachTab: detach ', aChild._tPos, ' from ', parentTab._tPos);

		if (!aInfo.dontUpdateInsertionPositionInfo)
			this.closeUpInsertionPositionInfoAround(aChild);

		var id = aChild.getAttribute(this.kID);

		this.setTabValue(
			parentTab,
			this.kCHILDREN,
			parentTab.getAttribute(this.kCHILDREN)
				.split('|')
				.filter(function(aId) {
					return this.getTabById(aId) && aId != id;
				}, this).join('|')
		);
		this.deleteTabValue(aChild, this.kPARENT);

		if (!this.hasChildTabs(parentTab))
			this.setTabValue(parentTab, this.kSUBTREE_COLLAPSED, true);

		this.updateTabAsParent(parentTab);

		if (!aInfo.dontUpdateIndent) {
			this.updateTabsIndent([aChild], undefined, aInfo.dontAnimate);
			this.checkTabsIndentOverflow();
		}

		var data = {
				parentTab : parentTab
			};

		/* PUBLIC API */
		this.fireCustomEvent(this.kEVENT_TYPE_DETACHED, aChild, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_DETACHED.replace(/^nsDOM/, ''), aChild, true, false, data);

		if (this.isTemporaryGroupTab(parentTab) && !this.hasChildTabs(parentTab)) {
			this.window.setTimeout(function(aTabBrowser) {
				if (parentTab.parentNode)
					aTabBrowser.removeTab(parentTab, { animate : true });
				parentTab = null;
			}, 0, this.getTabBrowserFromChild(parentTab));
		}
	},
	partTab : function TSTBrowser_partTab(aChild, aInfo) /* PUBLIC API, for backward compatibility */
	{
		return this.detachTab(aChild, aInfo);
	},
	
	detachAllChildren : function TSTBrowser_detachAllChildren(aTab, aInfo) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		var children = this.getChildTabs(aTab);
		if (!children.length)
			return;

		aInfo = aInfo || {};
		if (!('behavior' in aInfo))
			aInfo.behavior = this.kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN;
		if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
			aInfo.behavior = this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

		aInfo.dontUpdateInsertionPositionInfo = true;

		var b = this.mTabBrowser;
		var parentTab = this.getParentTab(aTab);

		if (
			this.isGroupTab(aTab) &&
			this.getTabs(b).filter(function(aTab) {
				return !b._removingTabs || b._removingTabs.indexOf(aTab) < 0;
			}).length == children.length
			) {
			aInfo.behavior = this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
			aInfo.dontUpdateIndent = false;
		}

		var insertBefore = null;
		if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN &&
			!utils.getTreePref('closeParentBehavior.moveDetachedTabsToBottom')) {
			insertBefore = this.getNextSiblingTab(this.getRootTab(aTab));
		}

		if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_REPLACE_WITH_GROUP_TAB) {
			let uri = utils.getGroupTabURI({
				title:     aTab.label,
				temporary: true
			});
			let groupTab = b.addTab(uri);
			if (parentTab) {
				this.attachTabTo(groupTab, parentTab, {
					insertBefore : aTab,
					dontAnimate  : true
				});
			}
			else {
				this.moveTabSubtreeTo(groupTab, aTab._tPos);
			}
			this.attachTabTo(aTab, groupTab, {
				dontAnimate : true
			});
			parentTab = groupTab;
			aInfo.behavior = this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
		}

		for (let i = 0, maxi = children.length; i < maxi; i++)
		{
			let tab = children[i];
			if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN) {
				this.detachTab(tab, aInfo);
				this.moveTabSubtreeTo(tab, insertBefore ? insertBefore._tPos - 1 : this.getLastTab(b)._tPos );
			}
			else if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD) {
				this.detachTab(tab, aInfo);
				if (i == 0) {
					if (parentTab) {
						this.attachTabTo(tab, parentTab, inherit(aInfo, {
							dontExpand : true,
							dontMove   : true
						}));
					}
					this.collapseExpandSubtree(tab, false);
					this.deleteTabValue(tab, this.kSUBTREE_COLLAPSED);
				}
				else {
					this.attachTabTo(tab, children[0], inherit(aInfo, {
						dontExpand : true,
						dontMove   : true
					}));
				}
			}
			else if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN && parentTab) {
				this.attachTabTo(tab, parentTab, inherit(aInfo, {
					dontExpand : true,
					dontMove   : true
				}));
			}
			else { // aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN
				this.detachTab(tab, aInfo);
			}
		}
	},
	partAllChildren : function TSTBrowser_partAllChildren(aTab, aInfo) /* for backward compatibility */
	{
		return this.detachAllChildren(aTab, aInfo);
	},
 
	detachTabs : function TSTBrowser_detachTabs(aTabs) 
	{
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (aTabs.indexOf(this.getParentTab(tab)) > -1)
				continue;
			this.detachAllChildren(tab, {
				behavior : this.getCloseParentBehaviorForTab(
					tab,
					this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD
				)
			});
		}
	},
	partTabs : function TSTBrowser_partTabs(aTabs) /* for backward compatibility */
	{
		return this.detachTabs(aTabs);
	},
 
	getCloseParentBehaviorForTab : function TSTBrowser_getCloseParentBehaviorForTab(aTab, aDefaultBehavior) 
	{
		var closeParentBehavior = utils.getTreePref('closeParentBehavior');
		var closeRootBehavior = utils.getTreePref('closeRootBehavior');

		var parentTab = this.getParentTab(aTab);
		var behavior = aDefaultBehavior ?
							aDefaultBehavior :
						(!parentTab && closeParentBehavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN) ?
							closeRootBehavior :
							closeParentBehavior ;
		// Promote all children to upper level, if this is the last child of the parent.
		// This is similar to "taking by representation".
		if (behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
			parentTab &&
			this.getChildTabs(parentTab).length == 1 &&
			utils.getTreePref('closeParentBehavior.promoteAllChildrenWhenParentIsLastChild'))
			behavior = this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;

		return behavior;
	},
  
	updateTabsIndent : function TSTBrowser_updateTabsIndent(aTabs, aLevel, aJustNow) 
	{
		if (!aTabs || !aTabs.length || !this._treeViewEnabled)
			return;

		if (aLevel === void(0))
			aLevel = this.getAncestorTabs(aTabs[0]).length;

		var b = this.mTabBrowser;
		var margin = this.indent < 0 ? this.baseIndent : this.indent ;
		var indent = (this.maxTreeLevel < 0 ? aLevel : Math.min(aLevel, this.maxTreeLevel) ) * margin;

		var multirow = this.isMultiRow();
		if (multirow) {
			let maxIndent = parseInt(aTabs[0].boxObject.height / 2);
			indent = Math.min(aLevel * 3, maxIndent);
		}

		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (!tab.parentNode)
				continue; // ignore removed tabs
			this.updateTabIndent(tab, indent, aJustNow);
			tab.setAttribute(this.kNEST, aLevel);
			this.updateCanCollapseSubtree(tab, aLevel);
			this.updateTabsIndent(this.getChildTabs(tab), aLevel+1, aJustNow);
		}
	},
	updateTabsIndentWithDelay : function TSTBrowser_updateTabsIndentWithDelay(aTabs)
	{
		if (this.updateTabsIndentWithDelayTimer)
			this.window.clearTimeout(this.updateTabsIndentWithDelayTimer);

		this.updateTabsIndentWithDelayTabs = this.updateTabsIndentWithDelayTabs.concat(aTabs);
		this.updateTabsIndentWithDelayTimer = this.window.setTimeout(function(aSelf) {
			var tabs = [];
			for (let i = 0, maxi = aSelf.updateTabsIndentWithDelayTabs.length; i < maxi; i++)
			{
				let tab = aSelf.updateTabsIndentWithDelayTabs[i];
				if (tabs.indexOf(tab) < 0 && tab.parentNode)
					tabs.push(tab);
			}
			aSelf.updateTabsIndentWithDelayTabs = [];
			aSelf.updateTabsIndent(tabs);
			aSelf.window.clearTimeout(aSelf.updateTabsIndentWithDelayTimer);
			aSelf.updateTabsIndentWithDelayTimer = null;
			tabs = null;
		}, 0, this);
	},
	updateTabsIndentWithDelayTimer : null,
 
	updateTabIndent : function TSTBrowser_updateTabIndent(aTab, aIndent, aJustNow) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		this.stopTabIndentAnimation(aTab);

		if (aTab.pinned)
			return;

		if (!this.enableSubtreeIndent)
			aIndent = 0;

		if (this.isMultiRow()) {
			let colors = '-moz-border-'+this.indentTarget+'-colors:'+(function() {
				var retVal = [];
				for (var i = 1; i < aIndent; i++)
				{
					retVal.push('transparent');
				}
				retVal.push('ThreeDShadow');
				return retVal.length == 1 ? 'none' : retVal.join(' ') ;
			})()+' !important;';
			let boxes = this.document.getAnonymousNodes(aTab);
			for (let i = 0, box = boxes.length; i < maxi; i++)
			{
				let box = boxes[i];
				if (box.nodeType != Node.ELEMENT_NODE)
					continue;
				box.setAttribute(
					'style',
					box.getAttribute('style')
						.replace(/(-moz-)?border-(top|bottom)(-[^:]*)?.*:[^;]+;?/g, '') +
					'; border-'+this.indentTarget+': solid transparent '+aIndent+'px !important;'+colors
				);
			}
			return;
		}

		if (
			!this.animationEnabled ||
			aJustNow ||
			this.indentDuration < 1 ||
			this.isCollapsed(aTab)
			) {
			aTab.style.setProperty(this.indentCSSProp, aIndent+'px', 'important');
			return;
		}

		var self = this;
		aTab.__treestyletab__updateTabIndentTask = function(aTime, aBeginning, aChange, aDuration) {
			delete aTab.__treestyletab__updateTabIndentTask;
			if (!self.isDestroying)
				aTab.style.setProperty(self.indentCSSProp, aIndent+'px', 'important');
			return true;
		};
		this.animationManager.addTask(
			aTab.__treestyletab__updateTabIndentTask,
			0, 0, 1, this.window
		);
	},
	stopTabIndentAnimation : function TSTBrowser_stopTabIndentAnimation(aTab)
	{
		if (!aTab.parentNode)
			return; // do nothing for closed tab!
		this.animationManager.removeTask(
			aTab.__treestyletab__updateTabIndentTask
		);
		delete aTab.__treestyletab__updateTabIndentTask;
	},
 
	inheritTabIndent : function TSTBrowser_inheritTabIndent(aNewTab, aExistingTab) 
	{
		var indent = this.getPropertyPixelValue(aExistingTab, this.indentCSSProp);
		if (indent)
			aNewTab.style.setProperty(this.indentCSSProp, indent+'px', 'important');
		else
			aNewTab.style.removeProperty(this.indentCSSProp);
	},
 
	updateAllTabsIndent : function TSTBrowser_updateAllTabsIndent(aJustNow) 
	{
		this.updateTabsIndent(this.rootTabs, 0, aJustNow);
//		this.checkTabsIndentOverflow();
	},
 
	checkTabsIndentOverflow : function TSTBrowser_checkTabsIndentOverflow(aDelay) 
	{
		this.cancelCheckTabsIndentOverflow();
		this.checkTabsIndentOverflowTimer = this.window.setTimeout(function(aSelf) {
			aSelf.checkTabsIndentOverflowTimer = null;
			aSelf.checkTabsIndentOverflowCallback();
		}, aDelay || 100, this);
	},
	cancelCheckTabsIndentOverflow : function TSTBrowser_cancelCheckTabsIndentOverflow()
	{
		if (this.checkTabsIndentOverflowTimer) {
			this.window.clearTimeout(this.checkTabsIndentOverflowTimer);
			this.checkTabsIndentOverflowTimer = null;
		}
	},
	checkTabsIndentOverflowTimer : null,
	checkTabsIndentOverflowCallback : function TSTBrowser_checkTabsIndentOverflowCallback()
	{
		if (!utils.getTreePref('indent.autoShrink')) {
			this.indent = -1;
			return;
		}

		var b = this.mTabBrowser;
		var tabbarSize = b.tabContainer.boxObject[this.invertedSizeProp];
		if (!tabbarSize) // don't update indent for collapsed tab bar
			return;

		var tabs = [...b.tabContainer.querySelectorAll(
				'tab['+this.kNEST+']:not(['+this.kNEST+'="0"]):not(['+this.kNEST+'=""])'+
					':not(['+this.kCOLLAPSED+'="true"])'+
					':not([hidden="true"])'+
					':not([collapsed="true"])'
			)];
		if (!tabs.length)
			return;

		var self = this;
		tabs.sort(function(aA, aB) { return Number(aA.getAttribute(self.kNEST)) - Number(aB.getAttribute(self.kNEST)); });
		var nest = tabs[tabs.length-1].getAttribute(this.kNEST);
		if (this.maxTreeLevel > -1)
			nest = Math.min(nest, this.maxTreeLevel);
		if (!nest)
			return;

		var oldIndent = this.indent;
		var indent    = (oldIndent < 0 ? this.baseIndent : oldIndent ) * nest;
		var maxIndentBase = Math.min(
					this.getFirstNormalTab(b).boxObject[this.invertedSizeProp],
					tabbarSize
				);
		var isVertical = this.isVertical;
		if (!isVertical) {
			if (this._horizontalTabMaxIndentBase)
				maxIndentBase = this._horizontalTabMaxIndentBase;
			else
				this._horizontalTabMaxIndentBase = maxIndentBase;
		}
		var maxIndent = maxIndentBase * (isVertical ? 0.33 : 0.5 );

		var indentMin;
		{
			let indentKey = isVertical ? 'indent.min.vertical' : 'indent.min.horizontal';
			let defaultIndent = utils.getDefaultTreePref(indentKey);
			let currentIndent = utils.getTreePref(indentKey);
			indentMin = isVertical ? Math.max(defaultIndent, currentIndent) : currentIndent ;
		}
		var indentUnit = Math.max(Math.floor(maxIndent / nest), indentMin);
		if (indent > maxIndent) {
			this.indent = indentUnit;
		}
		else {
			this.indent = -1;
			if ((this.baseIndent * nest) > maxIndent)
				this.indent = indentUnit;
		}

		if (oldIndent != this.indent) {
			this.updateAllTabsIndent();
		}
	},
	_horizontalTabMaxIndentBase : 0,
 
	updateCanCollapseSubtree : function TSTBrowser_updateCanCollapseSubtree(aTab, aLevel) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		if (
			!aLevel ||
			this.maxTreeLevel < 0 ||
			this.maxTreeLevel > aLevel
			) {
			aTab.setAttribute(this.kALLOW_COLLAPSE, true);
			this.collapseExpandSubtree(aTab, this.isSubtreeCollapsed(aTab));
		}
		else {
			this.collapseExpandSubtree(aTab, false);
			aTab.removeAttribute(this.kALLOW_COLLAPSE);
		}
	},
 
	updateTabAsParent : function TSTBrowser_updateTabAsParent(aTab, aOptions) 
	{
		if (!aTab ||
			!aTab.parentNode) // do nothing for closed tab!
			 return;

		aOptions = aOptions || {};

		if (!aOptions.dontUpdateCount)
			this.updateTabsCount(aTab);

		this.updateTabSoundIndicator(aTab);

		if (!aOptions.dontUpdateAncestor) {
			let parent = this.getParentTab(aTab);
			if (parent)
				this.updateTabAsParent(parent, aOptions);
		}
	},
	updateTabsCount : function TSTBrowser_updateTabsCount(aTab) 
	{
		var descendants = this.getDescendantTabs(aTab);
		var count = this.document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER);
		if (count) {
			let value = descendants.length;
			if (this.counterRole == this.kCOUNTER_ROLE_ALL_TABS)
				value += 1;
			count.setAttribute('value', value);
		}
	},
	updateTabSoundIndicator : function TSTBrowser_updateTabSoundIndicator(aTab)
	{
		var children = this.getChildTabs(aTab);

		var hasSoundPlayingChild = (
			this.allowSubtreeCollapseExpand &&
			children.some(function(aChild) {
				return aChild.getAttribute('soundplaying') == 'true';
			}, this)
		);
		var reallySoundPlaying = this.getTabValue(aTab, this.kREALLY_SOUND_PLAYING) == 'true';
		if (hasSoundPlayingChild ||
			reallySoundPlaying)
			aTab.setAttribute('soundplaying', true);
		else
			aTab.removeAttribute('soundplaying');

		var allChildrenMuted = (
			this.allowSubtreeCollapseExpand &&
			children.length > 0 && children.every(function(aChild) {
				return aChild.getAttribute('muted') == 'true';
			}, this)
		);
		if ((allChildrenMuted && !reallySoundPlaying) ||
			this.getTabValue(aTab, this.kREALLY_MUTED) == 'true')
			aTab.setAttribute('muted', true);
		else
			aTab.removeAttribute('muted');
	},
 
	updateAllTabsAsParent : function TSTBrowser_updateAllTabsAsParent() 
	{
		var tabs = this.getAllTabs(this.mTabBrowser);
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			this.updateTabAsParent(tab, {
				dontUpdateAncestor : true
			});
		}
	},
 
	promoteTooDeepLevelTabs : function TSTBrowser_promoteTooDeepLevelTabs(aParent) 
	{
		if (this.maxTreeLevel < 0 || !this.maxTreeLevelPhysical)
			return;

		var tabs = aParent ? this.getDescendantTabs(aParent) : this.getAllTabs(this.mTabBrowser) ;
		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let level = parseInt(tab.getAttribute(this.kNEST) || 0);
			if (level <= this.maxTreeLevel)
				continue;

			let parent = this.getParentTab(tab);
			let newParent = this.getParentTab(parent);
			if (this.maxTreeLevel == 0 || !newParent) {
				this.detachTab(aTab);
			}
			else {
				let nextSibling = this.getNextTab(tab);
				this.attachTabTo(tab, newParent, {
					dontMove     : true,
					insertBefore : nextSibling
				});
			}
		}
	},
  
/* move */ 
	
	moveTabSubtreeTo : function TSTBrowser_moveTabSubtreeTo(aTab, aIndex) 
	{
		if (!aTab || !aTab.parentNode)
			return;

		var b = this.mTabBrowser;
		this.subTreeMovingCount++;

		this.internallyTabMovingCount++;
		b.moveTabTo(aTab, aIndex);
		this.internallyTabMovingCount--;

		this.subTreeChildrenMovingCount++;
		this.internallyTabMovingCount++;
		var descendantTabs = this.getDescendantTabs(aTab);
		for (let i = 0, maxi = descendantTabs.length; i < maxi; i++)
		{
			let descendantTab = descendantTabs[i];
			b.moveTabTo(descendantTab, aTab._tPos + i + (aTab._tPos < descendantTab._tPos ? 1 : 0 ));
		}
		this.internallyTabMovingCount--;
		this.subTreeChildrenMovingCount--;

		this.subTreeMovingCount--;
	},
	moveTabSubTreeTo : function(...aArgs) {
		return this.moveTabSubtreeTo.apply(this, aArgs);
	}, // obsolete, for backward compatibility
 
	moveTabLevel : function TSTBrowser_moveTabLevel(aEvent) 
	{
		var b = this.mTabBrowser;
		var parentTab = this.getParentTab(b.mCurrentTab);
		if (aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_RIGHT) {
			let prevTab = this.getPreviousSiblingTab(b.mCurrentTab);
			if ((!parentTab && prevTab) ||
				(parentTab && b.mCurrentTab != this.getFirstChildTab(parentTab))) {
				this.attachTabTo(b.mCurrentTab, prevTab);
				b.mCurrentTab.focus();
				return true;
			}
		}
		else if (aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_LEFT && parentTab) {
			let grandParent = this.getParentTab(parentTab);
			if (grandParent) {
				this.attachTabTo(b.mCurrentTab, grandParent, {
					insertBefore : this.getNextSiblingTab(parentTab)
				});
				b.mCurrentTab.focus();
				return true;
			}
			else {
				let nextTab = this.getNextSiblingTab(parentTab);
				this.detachTab(b.mCurrentTab);
				this.internallyTabMovingCount++;
				if (nextTab) {
					b.moveTabTo(b.mCurrentTab, nextTab._tPos - 1);
				}
				else {
					b.moveTabTo(b.mCurrentTab, this.getLastTab(b)._tPos);
				}
				this.internallyTabMovingCount--;
				b.mCurrentTab.focus();
				return true;
			}
		}
		return false;
	},
 
	/**
	 * Imports tabs from another window with their tree structure.
	 * aOptions is an optional hash which can have two properties:
	 *   * duplicate (boolean)
	 *   * insertBefore (nsIDOMElement)
	 */
	importTabs : function TSTBrowser_importTabs(aTabs, aInsertBefore) /* PUBLIC API */ 
	{
		return this.moveTabsInternal(aTabs, { insertBefore : aInsertBefore });
	},
	duplicateTabs : function TSTBrowser_duplicateTabs(aTabs, aInsertBefore) /* PUBLIC API */
	{
		return this.moveTabsInternal(aTabs, { insertBefore : aInsertBefore, duplicate : true });
	},
	moveTabs : function TSTBrowser_importTabs(aTabs, aInsertBefore) /* PUBLIC API */
	{
		return this.moveTabsInternal(aTabs, { insertBefore : aInsertBefore });
	},
	moveTabsInternal : function TSTBrowser_moveTabsInternal(aTabs, aOptions)
	{
		aOptions = aOptions || {};

		var targetBrowser = this.mTabBrowser;
		var sourceWindow  = aTabs[0].ownerDocument.defaultView;
		var sourceBrowser = sourceWindow.TreeStyleTabService.getTabBrowserFromChild(aTabs[0]);
		var sourceService = sourceBrowser.treeStyleTab;

		// prevent Multiple Tab Handler feature
		targetBrowser.duplicatingSelectedTabs = true;
		targetBrowser.movingSelectedTabs = true;

		var shouldClose = (
				!aOptions.duplicate &&
				sourceService.getAllTabs(sourceBrowser).length == aTabs.length
			);
		var newTabs = [];
		var treeStructure = utils.getTreeStructureFromTabs(aTabs);
		log('moveTabsInternal: treeStructure ', treeStructure);

		// Firefox fails to "move" collapsed tabs. So, expand them first
		// and collapse them after they are moved.
		var collapsedStates = sourceService.forceExpandTabs(aTabs);;

		var shouldResetSelection = (
				aTabs.every(function(aTab) {
					return aTab.getAttribute('multiselected') == 'true';
				}) &&
				(sourceService != this || aOptions.duplicate)
			);

		var tabs = this.getTabs(targetBrowser);
		var lastExistingTab = tabs[tabs.length - 1];
		var promisedDuplicatedTabs = [];
		var delayedPostProcesses = [];
		aTabs.forEach(function(aTab, aIndex) {
			if (shouldResetSelection) {
				if ('MultipleTabService' in sourceWindow)
					sourceWindow.MultipleTabService.setSelection(aTab, false);
				else
					aTab.removeAttribute('multiselected');
			}

			if (aOptions.duplicate) {
				aTab = this.duplicateTabAsOrphan(aTab);
				aTab.__treestyletab__promisedDuplicatedTab = new Promise(function(aResolve, aReject) {
					let onTabRestoring = function() {
						aTab.removeEventListener('SSTabRestoring', onTabRestoring, false);
						delete aTab.__treestyletab__promisedDuplicatedTab;
						aResolve(aTab);
					};
					aTab.addEventListener('SSTabRestoring', onTabRestoring, false);
				});
				newTabs.push(aTab);
				promisedDuplicatedTabs.push(aTab.__treestyletab__promisedDuplicatedTab);
			}
			else if (sourceService != this) {
				aTab = this.importTab(aTab);
				newTabs.push(aTab);
			}

			let postProcess = (function(aProcessedTabIndex) {
				if (shouldResetSelection) {
					if ('MultipleTabService' in sourceWindow)
						sourceWindow.MultipleTabService.setSelection(aTab, true);
					else
						aTab.setAttribute('multiselected', true);
				}

				let newIndex = aOptions.insertBefore ?
								 aOptions.insertBefore._tPos :
								 lastExistingTab._tPos + aProcessedTabIndex + 1 ;
				if (newIndex > aTab._tPos)
					newIndex--;

				this.internallyTabMovingCount++;
				if (newIndex != aTab._tPos)
					targetBrowser.moveTabTo(aTab, newIndex);
				this.collapseExpandTab(aTab, false, true);
				this.internallyTabMovingCount--;
			}).bind(this);

			if (promisedDuplicatedTabs.length)
				delayedPostProcesses.push(postProcess);
			else
				postProcess(aIndex);
		}, this);

		if (shouldClose)
			sourceService.closeOwner(sourceBrowser);

		if (newTabs.length) {
			Promise.all(promisedDuplicatedTabs).then((function() {
				log('moveTabsInternal: applying tree structure for new ' + newTabs.length + ' tabs');
				delayedPostProcesses.forEach(function(aPostProcess, aIndex) {
					aPostProcess(aIndex);
				});
				this.applyTreeStructureToTabs(
					newTabs,
					treeStructure,
					collapsedStates.map(function(aCollapsed) {
						return !aCollapsed
					})
				);
			}).bind(this));
		}

		for (let i = collapsedStates.length - 1; i > -1; i--)
		{
			sourceService.collapseExpandSubtree(aTabs[i], collapsedStates[i], true);
		}

		// Multiple Tab Handler
		targetBrowser.movingSelectedTabs = false;
		targetBrowser.duplicatingSelectedTabs = false;

		return newTabs;
	},
 
	importTab : function TSTBrowser_importTab(aTab) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return null;

		var newTab = this.mTabBrowser.addTab();
		newTab.linkedBrowser.stop();
		newTab.linkedBrowser.docShell;
		this.mTabBrowser.swapBrowsersAndCloseOther(newTab, aTab);
		this.mTabBrowser.setTabTitle(newTab);
		return newTab;
	},
 
	duplicateTabAsOrphan : function TSTBrowser_duplicateTabAsOrphan(aTab) 
	{
		if (!aTab.parentNode) // do nothing for closed tab!
			return null;

		var children = this.getTabValue(aTab, this.kCHILDREN);
		var parent = this.getTabValue(aTab, this.kPARENT);

		this.deleteTabValue(aTab, this.kCHILDREN);
		this.deleteTabValue(aTab, this.kPARENT);

		var newTab = this.mTabBrowser.duplicateTab(aTab);

		this.setTabValue(aTab, this.kCHILDREN, children);
		this.setTabValue(aTab, this.kPARENT, parent);

		return newTab;
	},
 
	closeOwner : function TSTBrowser_closeOwner(aTabOwner) 
	{
		var w = aTabOwner.ownerDocument.defaultView;
		if (!w)
			return;
		if ('SplitBrowser' in w) {
			if ('getSubBrowserFromChild' in w.SplitBrowser) {
				var subbrowser = w.SplitBrowser.getSubBrowserFromChild(aTabOwner);
				if (subbrowser) {
					subbrowser.close();
					return;
				}
			}
			if (w.SplitBrowser.browsers.length)
				return;
		}
		w.close();
	},
  
/* collapse/expand */ 
	
	collapseExpandSubtree : function TSTBrowser_collapseExpandSubtree(aTab, aCollapse, aJustNow) /* PUBLIC API */ 
	{
		if (!aTab || !aTab.parentNode)
			return;

		if (this.isSubtreeCollapsed(aTab) == aCollapse)
			return;

		var b = this.mTabBrowser;
		this.doingCollapseExpand = true;

		this.setTabValue(aTab, this.kSUBTREE_COLLAPSED, aCollapse);

		var expandedTabs = this.getChildTabs(aTab);
		var lastExpandedTabIndex = expandedTabs.length - 1;
		for (let i = 0, maxi = expandedTabs.length; i < maxi; i++)
		{
			let childTab = expandedTabs[i];
			if (!aCollapse && !aJustNow && i == lastExpandedTabIndex) {
				let self = this;
				this.collapseExpandTab(childTab, aCollapse, aJustNow, function() {
					self.scrollToTabSubtree(aTab);
				});
			}
			else
				this.collapseExpandTab(childTab, aCollapse, aJustNow);
		}

		if (aCollapse)
			this.deleteTabValue(aTab, this.kSUBTREE_EXPANDED_MANUALLY);

		if (utils.getTreePref('indent.autoShrink') &&
			utils.getTreePref('indent.autoShrink.onlyForVisible'))
			this.checkTabsIndentOverflow();

		this.doingCollapseExpand = false;
	},
	manualCollapseExpandSubtree : function(aTab, aCollapse, aJustNow)
	{
		this.collapseExpandSubtree(aTab, aCollapse, aJustNow);
		if (!aCollapse)
			this.setTabValue(aTab, this.kSUBTREE_EXPANDED_MANUALLY, true);

		if (utils.getTreePref('indent.autoShrink') &&
			utils.getTreePref('indent.autoShrink.onlyForVisible')) {
			this.cancelCheckTabsIndentOverflow();
			if (!aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave) {
				var self = this;
				var stillOver = false;
				var id = this.getTabValue(aTab, this.kID);
				aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave = function checkTabsIndentOverflowOnMouseLeave(aEvent, aDelayed) {
					if (aEvent.type == 'mouseover') {
						if (utils.evaluateXPath(
								'ancestor-or-self::*[@' + self.kID + '="' + id + '"]',
								aEvent.originalTarget || aEvent.target,
								Ci.nsIDOMXPathResult.BOOLEAN_TYPE
							).booleanValue)
							stillOver = true;
						return;
					}
					else if (!aDelayed) {
						if (stillOver) {
							stillOver = false;
						}
						setTimeout(function() {
							checkTabsIndentOverflowOnMouseLeave.call(null, aEvent, true);
						}, 0);
						return;
					} else if (stillOver) {
						return;
					}
					var x = aEvent.clientX;
					var y = aEvent.clientY;
					var rect = aTab.getBoundingClientRect();
					if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom)
						return;
					self.document.removeEventListener('mouseover', aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave, true);
					ReferenceCounter.remove('document,mouseover,aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave,true');
					self.document.removeEventListener('mouseout', aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave, true);
					ReferenceCounter.remove('document,mouseout,aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave,true');
					delete aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave;
					self.checkTabsIndentOverflow();
				};
				this.document.addEventListener('mouseover', aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave, true);
				ReferenceCounter.add('document,mouseover,aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave,true');
				this.document.addEventListener('mouseout', aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave, true);
				ReferenceCounter.add('document,mouseout,aTab.__treestyletab__checkTabsIndentOverflowOnMouseLeave,true');
			}
		}
	},
 
	collapseExpandTab : function TSTBrowser_collapseExpandTab(aTab, aCollapse, aJustNow, aCallbackToRunOnStartAnimation) 
	{
		if (!aTab || !aTab.parentNode || !this.getParentTab(aTab))
			return;

		this.setTabValue(aTab, this.kCOLLAPSED, aCollapse);
		this.updateTabCollapsed(aTab, aCollapse, aJustNow, aCallbackToRunOnStartAnimation);

		var data = {
				collapsed : aCollapse
			};

		/* PUBLIC API */
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, aTab, true, false, data);
		// for backward compatibility
		this.fireCustomEvent(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED.replace(/^nsDOM/, ''), aTab, true, false, data);

		var b = this.mTabBrowser;
		var parent;
		if (aCollapse && aTab == b.selectedTab && (parent = this.getParentTab(aTab))) {
			var newSelection = parent;
			this.getAncestorTabs(aTab).some(function(aAncestor) {
				if (!this.isCollapsed(aAncestor)) {
					newSelection = aAncestor;
					return true;
				}
				return false;
			}, this);
			b.selectedTab = newSelection;
		}

		if (!this.isSubtreeCollapsed(aTab)) {
			let tabs = this.getChildTabs(aTab);
			for (let i = 0, maxi = tabs.length; i < maxi; i++)
			{
				this.collapseExpandTab(tabs[i], aCollapse, aJustNow);
			}
		}
	},
	updateTabCollapsed : function TSTBrowser_updateTabCollapsed(aTab, aCollapsed, aJustNow, aCallbackToRunOnStartAnimation)
	{
		log('TSTBrowser::updateTabCollapsed for ' + aTab._tPos);
		if (!aTab.parentNode) // do nothing for closed tab!
			return;

		this.stopTabCollapseAnimation(aTab);

		aTab.removeAttribute(this.kX_OFFSET);
		aTab.removeAttribute(this.kY_OFFSET);

		if (!this.canCollapseSubtree(this.getRootTab(aTab)))
			aCollapsed = false;

		aTab.setAttribute(this.kCOLLAPSING_PHASE, aCollapsed ? this.kCOLLAPSING_PHASE_TO_BE_COLLAPSED : this.kCOLLAPSING_PHASE_TO_BE_EXPANDED );

		var maxMargin;
		var offsetAttr;
		var collapseProp = 'margin-'+this.collapseTarget;
		{
			let firstTab = this.getFirstNormalTab(this.mTabBrowser);
			if (this.isVertical) {
				maxMargin = firstTab.boxObject.height;
				offsetAttr = this.kY_OFFSET;
				if (firstTab.style.height)
					aTab.style.height = firstTab.style.height;
			}
			else {
				maxMargin = firstTab.boxObject.width;
				offsetAttr = this.kX_OFFSET;
				if (firstTab.style.width)
					aTab.style.width = firstTab.style.width;
			}
		}

		var startMargin, endMargin, endOpacity;
		var startOpacity = this.window.getComputedStyle(aTab).opacity;
		if (aCollapsed) {
			startMargin  = 0;
			endMargin    = maxMargin;
			endOpacity   = 0;
			if (this.canStackTabs && this.getParentTab(aTab)) {
				endOpacity = 1;
				endMargin = this.kSTACKED_TAB_MARGIN;
			}
		}
		else {
			startMargin  = maxMargin;
			endMargin    = 0;
			startOpacity = 0;
			endOpacity   = 1;
			if (this.canStackTabs && this.getParentTab(aTab)) {
				startOpacity = 1;
				startMargin = this.kSTACKED_TAB_MARGIN;
			}
		}
		log('  animation params: ', {
			startMargin  : startMargin,
			endMargin    : endMargin,
			startOpacity : startOpacity,
			endOpacity   : endOpacity
		});

		if (
			!this.animationEnabled ||
			aJustNow ||
			this.collapseDuration < 1 // ||
//			!this.isVertical ||
//			!this.canCollapseSubtree(this.getParentTab(aTab))
			) {
			log(' => skip animation');
			if (aCollapsed)
				aTab.setAttribute(this.kCOLLAPSED_DONE, true);
			else
				aTab.removeAttribute(this.kCOLLAPSED_DONE);
			aTab.removeAttribute(this.kCOLLAPSING_PHASE);

			// Pinned tabs are positioned by "margin-top", so
			// we must not reset the property for pinned tabs.
			// (However, we still must update "opacity".)
			let pinned = aTab.pinned;
			let canExpand = !pinned || this.collapseCSSProp != 'margin-top';

			log(' skipped animation params: ', {
				pinned    : pinned,
				canExpand : canExpand,
				endMargin : endMargin
			});

			if (canExpand)
				aTab.style.setProperty(this.collapseCSSProp, endMargin ? '-'+endMargin+'px' : '', 'important');

			if (endOpacity == 0)
				aTab.style.setProperty('opacity', 0, 'important');
			else
				aTab.style.opacity = '';

			if (aCallbackToRunOnStartAnimation)
				aCallbackToRunOnStartAnimation();
			return;
		}

		var deltaMargin  = endMargin - startMargin;
		var deltaOpacity = endOpacity - startOpacity;

		aTab.style.setProperty(this.collapseCSSProp, startMargin ? '-'+startMargin+'px' : '', 'important');
		aTab.style.setProperty('opacity', startOpacity, 'important');

		if (!aCollapsed) {
			aTab.setAttribute(offsetAttr, maxMargin);
			aTab.removeAttribute(this.kCOLLAPSED_DONE);
		}

		var radian = 90 * Math.PI / 180;
		var self   = this;
		var firstFrame = true;
		aTab.__treestyletab__updateTabCollapsedTask = function(aTime, aBeginning, aChange, aDuration) {
			if (self.isDestroying)
				return true;
			if (firstFrame) {
				// The callback must be started before offsetAttr is changed!
				if (aCallbackToRunOnStartAnimation)
					aCallbackToRunOnStartAnimation();
				aTab.style.setProperty(self.collapseCSSProp, endMargin ? '-'+endMargin+'px' : '', 'important');
				aTab.style.setProperty('opacity', endOpacity, 'important');
			}
			firstFrame = false;
			// If this is the last tab, negative scroll happens.
			// Then, we shouldn't do animation.
			var stopAnimation = false;
			var scrollBox = self.scrollBox;
			if (scrollBox) {
				if (scrollBox._scrollbox)
					scrollBox = scrollBox._scrollbox;
				if ('scrollTop' in scrollBox &&
					(scrollBox.scrollTop < 0 || scrollBox.scrollLeft < 0)) {
					scrollBox.scrollTop = 0;
					scrollBox.scrollLeft = 0;
					stopAnimation = true;
				}
			}
			if (aTime >= aDuration || stopAnimation) {
				log(' => finish animation for '+aTab._tPos);
				delete aTab.__treestyletab__updateTabCollapsedTask;
				if (aCollapsed)
					aTab.setAttribute(self.kCOLLAPSED_DONE, true);
				aTab.removeAttribute(offsetAttr);
				aTab.removeAttribute(self.kCOLLAPSING_PHASE);

				if (endOpacity > 0) {
					if (self.window.getComputedStyle(aTab).opacity > 0) {
						aTab.style.opacity = '';
						aTab = null;
					}
					else {
						// If we clear its "opacity" before it becomes "1"
						// by CSS transition, the calculated opacity will
						// become 0 after we set an invalid value to clear it.
						// So we have to clear it with delay.
						// This is workaround for the issue:
						//   https://github.com/piroor/treestyletab/issues/1202
						setTimeout(function() {
							aTab.style.opacity = '';
							aTab = null;
						}, 0);
					}
				}

				maxMargin = null;
				offsetAttr = null;
				startMargin = null;
				endMargin = null;
				startOpacity = null;
				endOpacity = null;
				deltaMargin = null;
				deltaOpacity = null;
				collapseProp = null;
				radian = null;
				self = null;

				return true;
			}
			else {
				aTab.setAttribute(offsetAttr, maxMargin);
				return false;
			}
		};
		this.animationManager.addTask(
			aTab.__treestyletab__updateTabCollapsedTask,
			0, 0, this.collapseDuration, this.window
		);
	},
	kOPACITY_RULE_REGEXP : /opacity\s*:[^;]+;?/,
	kSTACKED_TAB_MARGIN : 15,
	stopTabCollapseAnimation : function TSTBrowser_stopTabCollapseAnimation(aTab)
	{
		if (!aTab.parentNode)
			return; // do nothing for closed tab!

		this.animationManager.removeTask(
			aTab.__treestyletab__updateTabCollapsedTask
		);
	},
 
	collapseExpandTreesIntelligentlyFor : function TSTBrowser_collapseExpandTreesIntelligentlyFor(aTab, aJustNow) 
	{
		if (!aTab ||
			!aTab.parentNode ||
			this.doingCollapseExpand ||
			!this.canCollapseSubtree(aTab))
			return;

		var b = this.mTabBrowser;
		var sameParentTab = this.getParentTab(aTab);
		var expandedAncestors = [aTab].concat(this.getAncestorTabs(aTab))
				.map(function(aAncestor) {
					return aAncestor.getAttribute(this.kID);
				}, this)
				.join('|');

		var xpathResult = utils.evaluateXPath(
				'child::xul:tab[@'+this.kCHILDREN+' and not(@'+this.kCOLLAPSED+'="true") and not(@'+this.kSUBTREE_COLLAPSED+'="true") and @'+this.kID+' and not(contains("'+expandedAncestors+'", @'+this.kID+')) and not(@hidden="true")]',
				b.tabContainer
			);
		for (var i = 0, maxi = xpathResult.snapshotLength; i < maxi; i++)
		{
			let dontCollapse = false;
			let collapseTab  = xpathResult.snapshotItem(i);

			let parentTab = this.getParentTab(collapseTab);
			if (parentTab) {
				dontCollapse = true;
				if (!this.isSubtreeCollapsed(parentTab)) {
					this.getAncestorTabs(collapseTab).some(function(aAncestor) {
						if (expandedAncestors.indexOf(aAncestor.getAttribute(this.kID)) < 0)
							return false;
						dontCollapse = false;
						return true;
					}, this);
				}
			}

			let manuallyExpanded = this.getTabValue(collapseTab, this.kSUBTREE_EXPANDED_MANUALLY) == 'true';
			if (!dontCollapse && !manuallyExpanded)
				this.collapseExpandSubtree(collapseTab, true, aJustNow);
		}

		this.collapseExpandSubtree(aTab, false, aJustNow);
	},
 
	collapseExpandAllSubtree : function TSTBrowser_collapseExpandAllSubtree(aCollapse, aJustNow) 
	{
		var tabs = this.mTabBrowser.tabContainer.querySelectorAll(
				'tab['+this.kID+']['+this.kCHILDREN+']'+
				(
					aCollapse ?
						':not(['+this.kSUBTREE_COLLAPSED+'="true"])' :
						'['+this.kSUBTREE_COLLAPSED+'="true"]'
				)
			);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.collapseExpandSubtree(tabs[i], aCollapse, aJustNow);
		}
	},
  
/* scroll */ 
	
	scrollTo : function TSTBrowser_scrollTo(aEndX, aEndY, aTargetElement) 
	{
		log('scrollTo ' + aEndX + ', ' + aEndY);
		if (this.timers['cancelPerformingAutoScroll'])
			return;

		if (this.animationEnabled || this.smoothScrollEnabled) {
			this.smoothScrollTo(aEndX, aEndY, null, aTargetElement);
		}
		else {
			try {
				this.cancelPerformingAutoScroll();
				this.scrollBoxObject.scrollTo(aEndX, aEndY);
			}
			catch(e) {
			}
		}
	},
	
	smoothScrollTo : function TSTBrowser_smoothScrollTo(aEndX, aEndY, aDuration, aTargetElement) 
	{
		log('smoothScrollTo ' + aEndX + ', ' + aEndY);
		this.cancelPerformingAutoScroll(true);

		var b = this.mTabBrowser;
		var scrollBoxObject = this.scrollBoxObject;
		var x = {}, y = {};
		scrollBoxObject.getPosition(x, y);
		var startX = x.value;
		var startY = y.value;
		var deltaX = aEndX - startX;
		var deltaY = aEndY - startY;

		// Use Firefox's native smooth scroll if possible
		// because it can be accelerated.
		if (
			typeof this.scrollBox._smoothScrollByPixels == 'function' &&
			( // We need to use it only when the tab is completely expanded...
				!aTargetElement ||
				(
					!this.getXOffsetOfTab(aTargetElement) &&
					!this.getYOffsetOfTab(aTargetElement)
				)
			)
			) {
			log('  => native smooth scroll');
			let amountToScroll = this.isVertical ? deltaY : deltaX ;
			return this.scrollBox._smoothScrollByPixels(amountToScroll, aTargetElement);
		}
		// Otherwise fallback to TST's custom one.
		log('  => TST\'s smooth scroll');

		var arrowscrollbox = scrollBoxObject.element.parentNode;
		if (
			arrowscrollbox &&
			(
				arrowscrollbox.localName != 'arrowscrollbox' ||
				!('_isScrolling' in arrowscrollbox)
			)
			)
			arrowscrollbox = null;

		var radian = 90 * Math.PI / 180;
		var self = this;
		this.smoothScrollTask = function(aTime, aBeginning, aChange, aDuration) {
			if (self.isDestroying)
				return true;
			var scrollBoxObject = self.scrollBoxObject;
			if (aTime >= aDuration || self.timers['cancelPerformingAutoScroll']) {
				if (!self.timers['cancelPerformingAutoScroll']) {
					scrollBoxObject.scrollTo(aEndX, aEndY);
					/**
					 * When there is any expanding tab, we have to retry to scroll.
					 * if the scroll box was expanded.
					 */
					let oldSize = self._getMaxScrollSize(scrollBoxObject);
					let key = 'smoothScrollTo_'+parseInt(Math.random() * 65000);
					self.timers[key] = setTimeout(function() {
						try {
							let newSize = self._getMaxScrollSize(scrollBoxObject);
							let lastTab = self.getLastVisibleTab(self.mTabBrowser);
							if (
								// scroll size can be expanded by expanding tabs.
								oldSize[0] < newSize[0] || oldSize[1] < newSize[1] ||
								// there are still animating tabs
								self.getXOffsetOfTab(lastTab) || self.getYOffsetOfTab(lastTab) ||
								self.mTabBrowser.tabContainer.querySelector('tab['+self.kCOLLAPSING_PHASE+'="'+self.kCOLLAPSING_PHASE_TO_BE_EXPANDED+'"]')
								)
								self.smoothScrollTo(aEndX, aEndY, parseInt(aDuration * 0.5));
						}
						catch(e) {
							self.defaultErrorHandler(e);
						}
						delete self.timers[key];
						scrollBoxObject = null;
						self = null;
					}, 0);
				}

				b = null;
				x = null;
				y = null;
				startX = null;
				startY = null;
				radian = null;
				self.smoothScrollTask = null;

				return true;
			}

			var power = Math.sin(aTime / aDuration * radian);
			var newX = startX + parseInt(deltaX * power);
			var newY = startY + parseInt(deltaY * power);
			scrollBoxObject.scrollTo(newX, newY);
			return false;
		};
		this.animationManager.addTask(
			this.smoothScrollTask,
			0, 0, aDuration || this.smoothScrollDuration, this.window
		);
	},
	_getMaxScrollSize : function(aScrollBoxObject) {
		var x = {}, y = {};
		aScrollBoxObject.getPosition(x, y);
		var w = {}, h = {};
		aScrollBoxObject.getScrolledSize(w, h);
		var maxX = Math.max(0, w.value - aScrollBoxObject.width);
		var maxY = Math.max(0, h.value - aScrollBoxObject.height);
		return [maxX, maxY];
	},
	smoothScrollTask : null,
 
	isSmoothScrolling : function TSTBrowser_isSmoothScrolling() 
	{
		return Boolean(
			// Firefox's native scroll
			this.scrollBox._smoothScrollTimer ||
			// TST's custom one
			this.smoothScrollTask
		);
	},
 
	stopSmoothScroll : function TSTBrowser_stopSmoothScroll() 
	{
		// Firefox's native scroll
		if (typeof this.scrollBox._stopSmoothScroll == 'function')
			this.scrollBox._stopSmoothScroll();

		// TST's custom one
		if (this.smoothScrollTask) {
			this.animationManager.removeTask(this.smoothScrollTask);
			this.smoothScrollTask = null;
		}
	},
  
	scrollToTab : function TSTBrowser_scrollToTab(aTab, aOnlyWhenCurrentTabIsInViewport) 
	{
		log('scrollToTab to ' + (aTab && aTab._tPos));
		if (!this.canScrollToTab(aTab)) {
			log('  => unscrollable');
			return;
		}

		this.cancelPerformingAutoScroll(true);

		if (this.isTabInViewport(aTab)) {
			log('  => already visible');
			return;
		}

		var b = this.mTabBrowser;

		var scrollBoxObject = this.scrollBoxObject;
		var w = {}, h = {};
		try {
			scrollBoxObject.getScrolledSize(w, h);
		}
		catch(e) { // Tab Mix Plus (or others)
			return;
		}

		var targetTabBox = this.getFutureBoxObject(aTab);
		var baseTabBox = this.getFirstNormalTab(b).boxObject;

		var targetX = (targetTabBox.screenX < scrollBoxObject.screenX) ?
			(targetTabBox.screenX - baseTabBox.screenX) - (targetTabBox.width * 0.5) :
			(targetTabBox.screenX - baseTabBox.screenX) - scrollBoxObject.width + (targetTabBox.width * 1.5) ;

		var targetY = (targetTabBox.screenY < scrollBoxObject.screenY) ?
			(targetTabBox.screenY - baseTabBox.screenY) - (targetTabBox.height * 0.5) :
			(targetTabBox.screenY - baseTabBox.screenY) - scrollBoxObject.height + (targetTabBox.height * 1.5) ;

		if (aOnlyWhenCurrentTabIsInViewport && b.selectedTab != aTab) {
			let box = b.selectedTab.boxObject;
			if (targetTabBox.screenX - box.screenX + baseTabBox.width > scrollBoxObject.width ||
				targetTabBox.screenY - box.screenY + baseTabBox.height > scrollBoxObject.height)
				return;
		}

		this.scrollTo(targetX, targetY, aTab);
	},
 
	canScrollToTab : function TSTBrowser_canScrollToTab(aTab)
	{
		return (
			aTab &&
			aTab.parentNode &&
			aTab.getAttribute('hidden') != 'true'
		);
	},
 
	scrollToTabSubtree : function TSTBrowser_scrollToTabSubtree(aTab) 
	{
		if (!this.canScrollToTab(aTab))
			return;
		var descendants = this.getDescendantTabs(aTab);
		return this.scrollToTabs([aTab].concat(descendants));
	},
 
	scrollToTabs : function TSTBrowser_scrollToTabs(aTabs) 
	{
		var firstTab = aTabs[0];
		if (!this.canScrollToTab(firstTab))
			return;

		var b            = this.mTabBrowser;
		var parentTabBox = this.getFutureBoxObject(firstTab);

		var containerPosition = this.tabStrip.boxObject[this.screenPositionProp];
		var containerSize     = this.tabStrip.boxObject[this.sizeProp];
		var parentPosition    = parentTabBox[this.screenPositionProp];

		var lastVisible = firstTab;
		for (let i = aTabs.length-1; i > -1; i--)
		{
			let tab = aTabs[i];
			if (this.isCollapsed(tab))
				continue;

			let box = this.getFutureBoxObject(tab);
			if (box[this.screenPositionProp] + box[this.sizeProp] - parentPosition > containerSize)
				continue;

			lastVisible = tab;
			break;
		}

		this.cancelPerformingAutoScroll(true);

		if (this.isTabInViewport(firstTab) && this.isTabInViewport(lastVisible))
			return;

		var lastVisibleBox = this.getFutureBoxObject(lastVisible);
		var lastPosition = lastVisibleBox[this.screenPositionProp];
		var tabSize      = lastVisibleBox[this.sizeProp];

		var treeHeight = lastPosition - parentPosition + tabSize;
		var treeIsLargerThanViewport = treeHeight > containerSize - tabSize;
		if (treeIsLargerThanViewport) {
			var endPos = parentPosition - this.getFirstNormalTab(b).boxObject[this.screenPositionProp] - tabSize * 0.5;
			var endX = this.isVertical ? 0 : endPos ;
			var endY = this.isVertical ? endPos : 0 ;
			this.scrollTo(endX, endY);
		}
		else if (!this.isTabInViewport(firstTab) && this.isTabInViewport(lastVisible)) {
			this.scrollToTab(firstTab);
		}
		else if (this.isTabInViewport(firstTab) && !this.isTabInViewport(lastVisible)) {
			this.scrollToTab(lastVisible);
		}
		else if (parentPosition < containerPosition) {
			this.scrollToTab(firstTab);
		}
		else {
			this.scrollToTab(lastVisible);
		}
	},
  
	notifyBackgroundTab : function TSTBrowser_notifyBackgroundTab() 
	{
		var animateElement = this.mTabBrowser.tabContainer._animateElement;
		var attrName = this.kBG_NOTIFY_PHASE;
		if (!animateElement)
			return;

		if (this.timers['notifyBackgroundTab'])
			clearTimeout(this.timers['notifyBackgroundTab']);

		if (!animateElement.hasAttribute(attrName))
			animateElement.setAttribute(attrName, 'ready');

		this.timers['notifyBackgroundTab'] = setTimeout((function() {
			Promise.resolve()
				.then(function() {
					animateElement.setAttribute(attrName, 'notifying');
					return wait(150);
				})
				.then(function() {
					animateElement.setAttribute(attrName, 'finish');
					return wait(1000);
				})
				.then(function() {
					animateElement.removeAttribute(attrName);
				})
				.catch(this.defaultErrorHandler.bind(this))
				.then((function() {
					delete this.timers['notifyBackgroundTab'];
				}).bind(this));
		}).bind(this), 0);
	},

	highlightTab : function TSTBrowser_highlightTab(aTab)
	{
		aTab.setAttribute(this.kHIGHLIGHTED, 'ready');
		wait(0)
			.then((function() {
				aTab.setAttribute(this.kHIGHLIGHTED, 'notifying');
				return wait(500);
			}).bind(this))
			.then((function() {
				aTab.setAttribute(this.kHIGHLIGHTED, 'finish');
				return wait(1000);
			}).bind(this))
			.then((function() {
				aTab.removeAttribute(this.kHIGHLIGHTED);
			}).bind(this));
	},
 
	restoreTree : function TSTBrowser_restoreTree() 
	{
		if (!this.needRestoreTree)
			return;

		this.needRestoreTree = false;

		if (prefs.getPref('extensions.tabmix.sessions.manager'))
			return;

		var level = utils.getTreePref('restoreTree.level');
		var tabs = this.getAllTabs(this.mTabBrowser);
		log('TSTBrowser::restoreTree');
		log('  level = '+level);

		if (level <= this.kRESTORE_TREE_LEVEL_NONE)
			return;

		var onlyVisible = level <= this.kRESTORE_TREE_ONLY_VISIBLE;
		tabs = tabs.filter(function(aTab) {
			// The "to be restored" state can be still undetermined.
			// If the previous state is "undetermined" ("undefined")
			// and now it has became certain, then we should save the state
			// for now and the next time..
			if (typeof aTab.__treestyletab__toBeRestored == 'undefined' &&
				utils.isTabNotRestoredYet(aTab))
				aTab.__treestyletab__toBeRestored = true;
			return (
				aTab.__treestyletab__toBeRestored &&
				(!onlyVisible || !aTab.hidden)
			);
		});

		log('  restoring member tabs = '+tabs.length,
			tabs.map(function(aTab) {
				return {
					pos    : aTab._tPos,
					pinned : aTab.pinned
				};
			})
		);

		if (tabs.length <= 1)
			return;

		for (let i = 0, maxi = tabs.length; i < maxi; i++)
		{
			let tab = tabs[i];
			let currentId = tab.getAttribute(this.kID);
			if (this.tabsHash[currentId] == tab)
				delete this.tabsHash[currentId];

			this.resetTabState(tab);

			tab.setAttribute(this.kID, currentId); // to fallback to it
			let [id, duplicated] = this._restoreTabId(tab);

			this.setTabValue(tab, this.kID, id);
			this.tabsHash[id] = tab;

			tab.__treestyletab__restoreState = this.RESTORE_STATE_READY_TO_RESTORE;
			tab.__treestyletab__duplicated = duplicated;
		}

		this.updateAllTabsIndent(true);

		// restore tree from bottom safely
		tabs.reverse()
			.filter(this.restoreOneTab, this)
			.forEach(this.updateInsertionPositionInfo, this);
	},
	restoreOneTab : function TSTBrowser_restoreOneTab(aTab)
	{
		if (aTab.__treestyletab__restoreState != this.RESTORE_STATE_READY_TO_RESTORE)
			return false;

		let duplicated = aTab.__treestyletab__duplicated;

		let children = this.getTabValue(aTab, this.kCHILDREN);
		if (children) {
			this.deleteTabValue(aTab, this.kCHILDREN);
			let manuallyExpanded = this.getTabValue(aTab, this.kSUBTREE_EXPANDED_MANUALLY) == 'true';
			let subTreeCollapsed = this.getTabValue(aTab, this.kSUBTREE_COLLAPSED) == 'true';
			subTreeCollapsed = this._restoreSubtreeCollapsedState(aTab, subTreeCollapsed);
			let self = this;
			this._restoreChildTabsRelation(aTab, children, duplicated, function(aChild) {
				/**
				 * When the child has the reference to the parent tab, attachTabTo()
				 * does nothing. To ensure they are correctly related, we have to
				 * clear the relation here.
				 */
				self.deleteTabValue(aChild, self.kPARENT);
				let refId = self.getTabValue(aChild, self.kINSERT_BEFORE);
				if (refId && duplicated)
					refId = self.redirectId(refId);
				return {
					forceExpand  : true, // to prevent to collapse the selected tab
					dontAnimate  : true,
					insertBefore : self.getTabById(refId)
				};
			});
			this.collapseExpandSubtree(aTab, subTreeCollapsed, true);
			if (manuallyExpanded && !subTreeCollapsed)
				this.setTabValue(aTab, this.kSUBTREE_EXPANDED_MANUALLY, true);
			else
				this.deleteTabValue(aTab, this.kSUBTREE_EXPANDED_MANUALLY);
		}

		delete aTab.__treestyletab__duplicated;
		aTab.__treestyletab__restoreState = this.RESTORE_STATE_STRUCTURE_RESTORED;
		return true
	},
  
/* sub modules */ 
	
	get tabbarDNDObserver() 
	{
		if (!this._tabbarDNDObserver) {
			this._tabbarDNDObserver = new TabbarDNDObserver(this.mTabBrowser);
		}
		return this._tabbarDNDObserver;
	},
 
	get panelDNDObserver() 
	{
		if (!this._panelDNDObserver) {
			this._panelDNDObserver = new TabpanelDNDObserver(this.mTabBrowser);
		}
		return this._panelDNDObserver;
	},
  
/* proxying for window service */ 
	_callWindowServiceMethod : function TSTBrowser_callWindowServiceMethod(aName, aArgs)
	{
		return this.windowService[aName].apply(this.windowService, aArgs);
	},
	isPopupShown : function TSTBrowser_isPopupShown(...aArgs) {
		return this._callWindowServiceMethod('isPopupShown', aArgs);
	},
	updateTabsInTitlebar : function TSTBrowser_updateTabsInTitlebar(...aArgs) {
		return this._callWindowServiceMethod('updateTabsInTitlebar', aArgs);
	},
	registerTabFocusAllowance : function TSTBrowser_registerTabFocusAllowance(...aArgs) {
		return this._callWindowServiceMethod('registerTabFocusAllowance', aArgs);
	},
	toggleAutoHide : function TSTBrowser_toggleAutoHide(...aArgs) {
		return this._callWindowServiceMethod('toggleAutoHide', aArgs);
	},
 
/* show/hide tab bar */ 
	get autoHide()
	{
		if (!('_autoHide' in this)) {
			this._autoHide = new AutoHideBrowser(this.mTabBrowser);
		}
		return this._autoHide;
	},

	// for backward compatibility
	get tabbarShown() { return this.autoHide.expanded; },
	set tabbarShown(aValue) { if (aValue) this.autoHide.show(); else this.autoHide.hide(); return aValue; },
	get tabbarExpanded() { return this.autoHide.expanded; },
	set tabbarExpanded(aValue) { return this.tabbarShown = aValue; },
	get tabbarResizing() { return this.autoHide.isResizing; },
	set tabbarResizing(aValue) { return this.autoHide.isResizing = aValue; },
	get togglerSize() { return this.autoHide.togglerSize; },
	set togglerSize(aValue) { return this.autoHide.togglerSize = aValue; },
	get sensitiveArea() { return this.autoHide.sensitiveArea; },
	set sensitiveArea(aValue) { return this.autoHide.sensitiveArea = aValue; },
	get lastMouseDownTarget() { return this.autoHide.lastMouseDownTarget; },
	set lastMouseDownTarget(aValue) { return this.autoHide.lastMouseDownTarget = aValue; },

	get splitterWidth() { return this.autoHide.splitterWidth; },

	get autoHideShown() { return this.autoHide.expanded; },
	set autoHideShown(aValue) { return this.tabbarShown = aValue; },
	get autoHideXOffset() { return this.autoHide.XOffset; },
	get autoHideYOffset() { return this.autoHide.YOffset; },
	get autoHideMode() { return this.autoHide.mode; },
	set autoHideMode(aValue) { return this.autoHide.mode = aValue; },

	updateAutoHideMode : function TSTBrowser_updateAutoHideMode() { this.autoHide.updateAutoHideMode(); },
	showHideTabbarInternal : function TSTBrowser_showHideTabbarInternal(aReason) { this.autoHide.showHideInternal(aReason); },
	showTabbar : function TSTBrowser_showTabbar(aReason) { this.autoHide.show(aReason); },
	hideTabbar : function TSTBrowser_hideTabbar(aReason) { this.autoHide.hide(aReason); },
	redrawContentArea : function TSTBrowser_redrawContentArea() { this.autoHide.redrawContentArea(); },
	drawTabbarCanvas : function TSTBrowser_drawTabbarCanvas() { this.autoHide.drawBG(); },
	get splitterBorderColor() { this.autoHide.splitterBorderColor; },
	clearTabbarCanvas : function TSTBrowser_clearTabbarCanvas() { this.autoHide.clearBG(); },
	updateTabbarTransparency : function TSTBrowser_updateTabbarTransparency() { this.autoHide.updateTransparency(); },

	get autoHideEnabled() { return this.autoHide.enabled; },
	set autoHideEnabled(aValue) { return this.autoHide.enabled = aValue; },
	startAutoHide : function TSTBrowser_startAutoHide() { this.autoHide.start(); },
	endAutoHide : function TSTBrowser_endAutoHide() { this.autoHide.end(); },
	startAutoHideForFullScreen : function TSTBrowser_startAutoHideForFullScreen() { this.autoHide.startForFullScreen(); },
	endAutoHideForFullScreen : function TSTBrowser_endAutoHideForFullScreen() { this.autoHide.endForFullScreen(); },

	startListenMouseMove : function TSTBrowser_startListenMouseMove() { this.autoHide.startListenMouseMove(); },
	endListenMouseMove : function TSTBrowser_endListenMouseMove() { this.autoHide.endListenMouseMove(); },
	get shouldListenMouseMove() { return this.autoHide.shouldListenMouseMove; },
	showHideTabbarOnMousemove : function TSTBrowser_showHideTabbarOnMousemove() { this.autoHide.showHideOnMousemove(); },
	cancelShowHideTabbarOnMousemove : function TSTBrowser_cancelShowHideTabbarOnMousemove() { this.autoHide.cancelShowHideOnMousemove(); },
	showTabbarForFeedback : function TSTBrowser_showTabbarForFeedback() { this.autoHide.showForFeedback(); },
	delayedShowTabbarForFeedback : function TSTBrowser_delayedShowTabbarForFeedback() { this.autoHide.delayedShowForFeedback(); },
	cancelHideTabbarForFeedback : function TSTBrowser_cancelHideTabbarForFeedback() { this.autoHide.cancelHideForFeedback(); },
  
	// DEBUGGING
	dumpTreeInformation : function() {
		var ids = [];
		var extraAttributes = {
			children: this.kCHILDREN,
			restoringChildren: this.kCHILDREN_RESTORING,
			parent: this.kPARENT,
			insertBefore: this.kINSERT_BEFORE,
			insertAfter: this.kINSERT_AFTER
		};
		var result = this.rootTabs.map(function scanTab(aTab) {
			var id = this.getTabValue(aTab, this.kID);
			ids.push(id);
			var result = { id: id };
			Object.keys(extraAttributes).forEach(function(aKey) {
				var value = this.getTabValue(aTab, extraAttributes[aKey]);
				if (value)
					result[aKey] = value;
			}, this);
			var children = this.getChildTabs(aTab).map(scanTab, this);
			if (children.length > 0)
				result.actualChildren = children;
			return result;
		}, this);
		var json = JSON.stringify(result);
		ids.forEach(function(aId, aIndex) {
			json = json.replace(new RegExp(aId, 'g'), 'TAB-' + aIndex);
		});
		return JSON.parse(json);
	}
 
}, Object); 
 
