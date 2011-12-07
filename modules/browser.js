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
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro.outsider.reflex@gmail.com>
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
 
const EXPORTED_SYMBOLS = ['TreeStyleTabBrowser']; 

const Cc = Components.classes;
const Ci = Components.interfaces;

// Components.utils.import('resource://treestyletab-modules/rap.js');
// rap();

Components.utils.import('resource://treestyletab-modules/window.js');
 
function TreeStyleTabBrowser(aWindowService, aTabBrowser) 
{
	this.windowService = aWindowService;
	this.window = aWindowService.window;
	this.document = aWindowService.document;

	this.mTabBrowser = aTabBrowser;
	aTabBrowser.treeStyleTab = this;

	this.tabVisibilityChangedTabs = [];
	this.updateTabsIndentWithDelayTabs = [];
}
 
TreeStyleTabBrowser.prototype = { 
	__proto__ : TreeStyleTabWindow.prototype,
	
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
 
	mTabBrowser : null, 

	indent                     : -1,
	indentProp                 : 'margin',
	indentTarget               : 'left',
	indentCSSProp              : 'margin-left',
	collapseTarget             : 'top',
	collapseCSSProp            : 'margin-top',
	screenPositionProp         : 'screenY',
	sizeProp                   : 'height',
	invertedScreenPositionProp : 'screenX',
	invertedSizeProp           : 'width',
	startProp                  : 'top',
	endProp                    : 'bottom',

	maxTreeLevelPhisical : false,
 
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
				this.getTreePref('compatibility.TMP') &&
				this.document.getAnonymousElementByAttribute(this.mTabBrowser.mTabContainer, 'class', 'tabs-frame')
			) ||
			this.mTabBrowser.mTabContainer.mTabstrip;
	},
	get scrollBoxObject()
	{
		var node = this.scrollBox;
		if (node._scrollbox) node = node._scrollbox;
		return (node.scrollBoxObject || node.boxObject)
				.QueryInterface(Ci.nsIScrollBoxObject); // for Tab Mix Plus (ensure scrollbox-ed)
	},
 
	get splitter() 
	{
		var d = this.document;
		return d.getAnonymousElementByAttribute(this.mTabBrowser, 'class', this.kSPLITTER) ||
				d.getAnonymousElementByAttribute(this.mTabBrowser, 'id', 'tabkit-splitter'); // Tab Kit
	},
 
	get tabStripPlaceHolder() 
	{
		return this._tabStripPlaceHolder;
	},
	set tabStripPlaceHolder(value)
	{
		return (this._tabStripPlaceHolder = value);
	},
  
/* properties */ 
	
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
 
	get hideAlltabsButton() /* legacy feature for Firefox 3.6 or olders */ 
	{
		return this._hideAlltabsButton;
	},
	set hideAlltabsButton(aValue)
	{
		this._hideAlltabsButton = aValue;
		this.setTabbrowserAttribute(this.kHIDE_ALLTABS, this._hideAlltabsButton ? 'true' : null);
		return aValue;
	},
	_hideAlltabsButton : true,
 
	get fixed() 
	{
		var orient = this.isVertical ? 'vertical' : 'horizontal' ;
		if (!this.windowService.preInitialized)
			return this.getTreePref('tabbar.fixed.'+orient);

		var b = this.mTabBrowser;
		if (!b) return false;
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
 
	get position() /* PUBLIC API */ 
	{
		return (
			// Don't touch to the <tabbrowser/> element before it is initialized by XBL constructor.
			(this.windowService.preInitialized && this.browser.getAttribute(this.kTABBAR_POSITION)) ||
			this.utils.position
		);
	},
	set position(aValue)
	{
		var position = String(aValue).toLowerCase();
		if (!position || !/^(top|bottom|left|right)$/.test(position))
			position = 'top';

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
					label  : self.treeBundle.getString('undo_changeTabbarPosition_label'),
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
	_changeTabbarPosition : function TSTBrowser_changeTabbarPosition(aNewPosition)
	{
		var oldPosition = this.position;
		this.fireTabbarPositionEvent(true, oldPosition, aNewPosition);

		this.initTabbar(aNewPosition, oldPosition);
		this.reinitAllTabs();

		var self = this;
		this.Deferred.next(function() {
			self.checkTabsIndentOverflow();
			self.fireTabbarPositionEvent(false, oldPosition, aNewPosition);
		});
	},
  
/* status getters */ 
	
	get isVertical() 
	{
		if (!this.windowService.preInitialized)
			return ['left', 'right'].indexOf(this.position) > -1;

		var b = this.mTabBrowser;
		if (!b) return false;

		if (b.hasAttribute(this.kMODE))
			return b.getAttribute(this.kMODE) == 'vertical';

		var box = this.scrollBox || b.mTabContainer ;
		return (box.getAttribute('orient') || this.window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical';
	},
 
	get isFloating() 
	{
		return this._tabStripPlaceHolder;
	},
 
	get ownerToolbar() 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:toolbar[1]',
				this.mTabBrowser.tabContainer,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	get canStackTabs() 
	{
		return (
			this.isGecko2 &&
			!this.isVertical &&
			this.canCollapseSubtree() &&
			this.getTreePref('stackCollapsedTabs')
		);
	},
  
/* utils */ 
	
/* get tab contents */ 
	
	getTabLabel : function TSTBrowser_getTabLabel(aTab) 
	{
		var d = this.document;
		var label = d.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-stack') || // Mac OS X
					( // Tab Mix Plus
						this.getTreePref('compatibility.TMP') &&
						d.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-container')
					) ||
					d.getAnonymousElementByAttribute(aTab, 'class', 'tab-text tab-label') || // Firefox 4.0-
					d.getAnonymousElementByAttribute(aTab, 'class', 'tab-text'); // Firefox 3.5 - Firefox 3.6
		return label;
	},
 
	getTabClosebox : function TSTBrowser_getTabClosebox(aTab) 
	{
		var d = this.document;
		var close = ( // Tab Mix Plus
						this.getTreePref('compatibility.TMP') &&
						d.getAnonymousElementByAttribute(aTab, 'class', 'tab-close-button always-right')
					) ||
					d.getAnonymousElementByAttribute(aTab, 'class', 'tab-close-button');
		return close;
	},
  
	isTabInViewport : function TSTBrowser_isTabInViewport(aTab) 
	{
		if (!this.windowService.preInitialized || !aTab)
			return false;
		if (aTab.getAttribute('pinned') == 'true')
			return true;
		var tabBox = aTab.boxObject;
		var barBox = this.scrollBox.boxObject;
		var xOffset = this.getXOffsetOfTab(aTab);
		var yOffset = this.getYOffsetOfTab(aTab);
		return (tabBox.screenX + xOffset >= barBox.screenX &&
			tabBox.screenX + xOffset + tabBox.width <= barBox.screenX + barBox.width &&
			tabBox.screenY + yOffset >= barBox.screenY &&
			tabBox.screenY + yOffset + tabBox.height <= barBox.screenY + barBox.height);
	},
 
	isMultiRow : function TSTBrowser_isMultiRow() 
	{
		var w = this.window;
		return ('tabberwocky' in w && this.getTreePref('compatibility.Tabberwocky')) ?
				(this.getPref('tabberwocky.multirow') && !this.isVertical) :
			('TabmixTabbar' in w && this.getTreePref('compatibility.TMP')) ?
				w.TabmixTabbar.isMultiRow :
				false ;
	},
 
	positionPinnedTabs : function TSTBrowser_positionPinnedTabs(aWidth, aHeight, aJustNow) 
	{
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
			b.mTabContainer._positionPinnedTabs();
			return;
		}

		var tabbarPlaceHolderWidth = this._tabStripPlaceHolder.boxObject.width;
		var tabbarWidth = this.tabStrip.boxObject.width;

		var maxWidth = tabbarPlaceHolderWidth || tabbarWidth;

		var faviconized = this.getTreePref('pinnedTab.faviconized');
		var faviconizedSize = tabbar.childNodes[0].boxObject.height;

		var width  = faviconized ? faviconizedSize : maxWidth ;
		var height = faviconizedSize;
		var maxCol = Math.floor(maxWidth / width);
		var maxRow = Math.ceil(count / maxCol);
		var col    = 0;
		var row    = 0;

		var baseX = this.tabStrip.boxObject.screenX - this.document.documentElement.boxObject.screenX;

		/**
		 * Hacks for Firefox 9 or olders.
		 * In a box with "direction: rtr", we have to position tabs
		 * by margin-right, because the basic position becomes
		 * "top-right" instead of "top-left".
		 */
		var needToInvertDirection = !this.isGecko10OrLater && this.position == 'left' && b.getAttribute(this.kINVERT_SCROLLBAR) == 'true';
		var remainder = maxWidth - (maxCol * width);
		var shrunkenOffset = ((needToInvertDirection || this.position == 'right') && tabbarPlaceHolderWidth) ?
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

			let transitionStyleBackup = style.transition || style.MozTransition || '';
			if (aJustNow)
				style.MozTransition = style.transition = 'none';

			let className = item.className.replace(removeFaviconizedClassPattern, '');
			if (faviconized)
				className += ' '+this.kFAVICONIZED;
			if (className != item.className)
				item.className = className;

			style.maxWidth = style.width = width+'px';
			if (needToInvertDirection) {
				let margin = (width * (maxCol - col - 1)) + remainder + shrunkenOffset;
				style.setProperty('margin-right', margin+'px', 'important');
				style.marginLeft = style.left = style.right = '';
			}
			else {
				style.setProperty('margin-left', ((width * col) + shrunkenOffset)+'px', 'important');
				style.left = baseX+'px';
				style.right = 'auto';
				style.marginRight = '';
			}

			style.setProperty('margin-top', (- height * (maxRow - row))+'px', 'important');
			style.top = style.bottom = '';

			if (aJustNow)
				this.Deferred.next(function() { // "transition" must be cleared after the reflow.
					style.MozTransition = style.transition = transitionStyleBackup;
				});

			col++;
			if (col >= maxCol) {
				col = 0;
				row++;
			}
		}
	},
	positionPinnedTabsWithDelay : function TSTBrowser_positionPinnedTabsWithDelay()
	{
		if (this._positionPinnedTabsWithDelayTimer)
			return;

		var args = Array.slice(arguments);
		var lastArgs = this._positionPinnedTabsWithDelayTimerArgs || [null, null, false];
		lastArgs[0] = lastArgs[0] || args[0];
		lastArgs[1] = lastArgs[1] || args[1];
		lastArgs[2] = lastArgs[2] || args[2];
		this._positionPinnedTabsWithDelayTimerArgs = lastArgs;

		this._positionPinnedTabsWithDelayTimer = this.window.setTimeout(function(aSelf) {
			aSelf.Deferred.next(function() {
				// do with delay again, after Firefox's reposition was completely finished.
				aSelf.positionPinnedTabs.apply(aSelf, aSelf._positionPinnedTabsWithDelayTimerArgs);
			});
			aSelf._positionPinnedTabsWithDelayTimer = null;
			aSelf._positionPinnedTabsWithDelayTimerArgs = null;
		}, 0, this);
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
		var tabs = this.getTabsArray(this.mTabBrowser);
		var count = tabs.length;
		tabs.forEach(
			aStacked ?
				function(aTab, aIndex) {
					aTab.style.zIndex = count * 1000 - aIndex;
				} :
				function(aTab, aIndex) {
					aTab.style.zIndex = '';
				}
		);
	},
 
	fixTooNarrowTabbar : function TSTBrowser_fixTooNarrowTabbar() 
	{
		if (!this.isFloating) return;
		/**
		 * The tab bar can become smaller than the actual size of the
		 * floating tab bar, and then, we cannot resize tab bar by
		 * dragging anymore. To avoid this problem, we have to enlarge
		 * the tab bar larger than the floating tab bar.
		 */
		if (this.isVertical) {
			let key = this.autoHide.expanded ?
						'tabbar.width' : 'tabbar.shrunkenWidth' ;
			let width = this.getTreePref(key);
			let minWidth = this.scrollBox.boxObject.width
			if (minWidth > width) {
				this.setPrefForActiveWindow(function() {
					this.setTreePref(key, minWidth);
					this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_PREF_CHANGE);
				});
			}
		}
		else {
			let height = this.getTreePref('tabbar.height');
			let minHeight = this.scrollBox.boxObject.height
			if (minHeight > height) {
				this.setPrefForActiveWindow(function() {
					this.setTreePref('tabbar.height', minHeight);
					this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_PREF_CHANGE);
				});
			}
		}
	},
  
/* initialize */ 
	
	init : function TSTBrowser_init() 
	{
// rap('browser/init start');
		this.stopRendering();

		var w = this.window;
		var d = this.document;
		var b = this.mTabBrowser;
		b.tabContainer.treeStyleTab = this;

		if (b.tabContainer.parentNode.localName == 'toolbar')
			b.tabContainer.parentNode.classList.add(this.kTABBAR_TOOLBAR);

		this.tabsHash = {};
		this.tabVisibilityChangedTabs = [];
		this._updateFloatingTabbarReason = 0;
		this.internallyTabMovingCount = 0;
		this.subTreeMovingCount = 0;
		this.subTreeChildrenMovingCount = 0;
		this._treeViewEnabled = true;

		this._initTabbrowserExtraContents();

		let position = this.position;
		this.fireTabbarPositionEvent(this.kEVENT_TYPE_TABBAR_POSITION_CHANGING, 'top', position); /* PUBLIC API */

		this.setTabbrowserAttribute(this.kFIXED+'-horizontal', this.getTreePref('tabbar.fixed.horizontal') ? 'true' : null, b);
		this.setTabbrowserAttribute(this.kFIXED+'-vertical', this.getTreePref('tabbar.fixed.vertical') ? 'true' : null, b);

		/**
		 * <tabbrowser> has its custom background color for itself, but it
		 * prevents to make transparent background of the vertical tab bar.
		 * So, I re-define the background color of content area for
		 * <notificationbox>es via dynamically generated stylesheet.
		 * See:
		 *   https://bugzilla.mozilla.org/show_bug.cgi?id=558585
		 *   http://hg.mozilla.org/mozilla-central/rev/e90bdd97d168
		 */
		if (b.style.backgroundColor && this.isFloating) {
			let color = b.style.backgroundColor;
			let pi = d.createProcessingInstruction(
					'xml-stylesheet',
					'type="text/css" href="data:text/css,'+encodeURIComponent(
					<![CDATA[
						.tabbrowser-tabbox > tabpanels > notificationbox {
							background-color: %COLOR%;
						}
					]]>.toString().replace(/%COLOR%/, color)
					)+'"'
				);
			d.insertBefore(pi, d.documentElement);
			b.style.backgroundColor = '';
		}

		this.initTabbar(null, this.kTABBAR_TOP);

		w.addEventListener('resize', this, true);
		w.addEventListener('beforecustomization', this, true);
		w.addEventListener('aftercustomization', this, false);
		w.addEventListener('customizationchange', this, false);
		w.addEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		w.addEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED,  this, false);
		w.addEventListener('tabviewhidden', this, true);
		w.addEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);

		b.addEventListener('nsDOMMultipleTabHandlerTabsClosing', this, false);

		w['piro.sakura.ne.jp'].tabsDragUtils.initTabBrowser(b);

		w.TreeStyleTabWindowHelper.initTabbrowserMethods(b);
		this._initTabbrowserContextMenu();
		w.TreeStyleTabWindowHelper.updateTabDNDObserver(b);

		this.getAllTabsArray(b).forEach(this.initTab, this);

		this.onPrefChange('extensions.treestyletab.maxTreeLevel');
		this.onPrefChange('extensions.treestyletab.tabbar.style');
		this.onPrefChange('extensions.treestyletab.twisty.style');
		this.onPrefChange('extensions.treestyletab.showBorderForFirstTab');
		this.onPrefChange('extensions.treestyletab.tabbar.invertTabContents');
		this.onPrefChange('extensions.treestyletab.tabbar.invertClosebox');
		this.onPrefChange('extensions.treestyletab.tabbar.autoShow.mousemove');
		this.onPrefChange('extensions.treestyletab.tabbar.invertScrollbar');
		this.onPrefChange('extensions.treestyletab.tabbar.narrowScrollbar');
		this.onPrefChange('extensions.treestyletab.animation.enabled');

		this.ObserverService.addObserver(this, this.kTOPIC_INDENT_MODIFIED, false);
		this.ObserverService.addObserver(this, this.kTOPIC_COLLAPSE_EXPAND_ALL, false);
		this.ObserverService.addObserver(this, this.kTOPIC_CHANGE_TREEVIEW_AVAILABILITY, false);
		this.ObserverService.addObserver(this, 'sessionstore-windows-restored', false);
		this.ObserverService.addObserver(this, 'sessionstore-browser-state-restored', false);
		this.ObserverService.addObserver(this, 'private-browsing-change-granted', false);
		this.ObserverService.addObserver(this, 'lightweight-theme-styling-update', false);
		this.addPrefListener(this);

		// Don't init these ovservers on this point to avoid needless initializations.
		//   this.tabbarDNDObserver;
		//   this.panelDNDObserver;
		this._readyToInitDNDObservers();

		// Init autohide service only if it have to be activated.
		if (this.isAutoHide)
			this.autoHide;

		this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_INITIALIZE);
		this.fixTooNarrowTabbar();

		this.fireTabbarPositionEvent(false, 'top', position); /* PUBLIC API */

		this.startRendering();
// rap('browser/init end');
	},
	
	_initTabbrowserExtraContents : function TSTBrowser_initTabbrowserExtraContents() 
	{
		var d = this.document;
		var b = this.mTabBrowser;

		var toggler = d.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER);
		if (!toggler) {
			toggler = d.createElement('spacer');
			toggler.setAttribute('class', this.kTABBAR_TOGGLER);
			toggler.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468
			b.mTabBox.insertBefore(toggler, b.mTabBox.firstChild);
			if (b.mTabDropIndicatorBar == toggler)
				b.mTabDropIndicatorBar = d.getAnonymousElementByAttribute(b, 'class', 'tab-drop-indicator-bar');
		}

		var placeHolder = d.getAnonymousElementByAttribute(b, 'anonid', 'strip');
		if (!placeHolder) {
			placeHolder = d.createElement('hbox');
			placeHolder.setAttribute('anonid', 'strip');
			placeHolder.setAttribute('class', 'tabbrowser-strip '+this.kTABBAR_PLACEHOLDER);
			placeHolder.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468
			b.mTabBox.insertBefore(placeHolder, toggler.nextSibling);
		}
		this.tabStripPlaceHolder = (placeHolder != this.tabStrip) ? placeHolder : null ;
	},
 
	_initTabbrowserContextMenu : function TSTBrowser_initTabbrowserContextMenu() 
	{
		var w = this.window;
		var d = this.document;
		var b = this.mTabBrowser;

		var tabContextMenu = b.tabContextMenu ||
							d.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContextMenu.addEventListener('popupshowing', this, false);
		if (!('MultipleTabService' in w)) {
			w.setTimeout(function(aSelf, aTabBrowser, aPopup) {
				let suffix = '-tabbrowser-'+(aTabBrowser.id || 'instance-'+parseInt(Math.random() * 65000));
				[
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
				].forEach(function(aID) {
					let item = d.getElementById(aID).cloneNode(true);
					item.setAttribute('id', item.getAttribute('id')+suffix);

					let refNode = void(0);
					let insertAfter = item.getAttribute('multipletab-insertafter');
					if (insertAfter) {
						try {
							eval('refNode = ('+insertAfter+').nextSibling');
						}
						catch(e) {
						}
					}
					let insertBefore = item.getAttribute('multipletab-insertbefore');
					if (refNode === void(0) && insertBefore) {
						try {
							eval('refNode = '+insertBefore);
						}
						catch(e) {
						}
					}
					aPopup.insertBefore(item, refNode || null);
				});
				tabContextMenu = null;
			}, 0, this, b, tabContextMenu);
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

		var ns = {};
		Components.utils.import('resource://treestyletab-modules/fullTooltip.js', ns);
		this.tooltipManager = new ns.FullTooltipManager(this);
	},
 
	_readyToInitDNDObservers : function TSTBrowser_readyToInitDNDObservers() 
	{
		var w = this.window;
		this._DNDObserversInitialized = false;
		w.addEventListener('mouseover', this, true);
		w.addEventListener('dragover', this, true);
	},
	
	_initDNDObservers : function TSTBrowser_initDNDObservers() 
	{
		if (this._DNDObserversInitialized)
			return;

		this.tabbarDNDObserver;
		this.panelDNDObserver;

		var w = this.window;
		w.addEventListener('mouseover', this, true);
		w.addEventListener('dragover', this, true);
		this._DNDObserversInitialized = true;
	},
  
	initTab : function TSTBrowser_initTab(aTab) 
	{
		if (!aTab.hasAttribute(this.kID)) {
			let id = this.getTabValue(aTab, this.kID) || this.makeNewId();
			aTab.setAttribute(this.kID, id);
			aTab.setAttribute(this.kSUBTREE_COLLAPSED, true);
			aTab.setAttribute(this.kALLOW_COLLAPSE, true);
			let self = this;
			this.Deferred.next(function() {
				if (!self.getTabValue(aTab, self.kID)) {
					self.setTabValue(aTab, self.kID, id);
					if (!(id in self.tabsHash))
						self.tabsHash[id] = aTab;
				}
			});
			if (!(id in this.tabsHash))
				this.tabsHash[id] = aTab;
		}

		aTab.__treestyletab__linkedTabBrowser = this.mTabBrowser;

		this.initTabAttributes(aTab);
		this.initTabContents(aTab);

		if (!aTab.hasAttribute(this.kNEST))
			aTab.setAttribute(this.kNEST, 0);
	},
	isTabInitialized : function TSTBrowser_isTabInitialized(aTab)
	{
		return aTab.getAttribute(this.kID);
	},
	ensureTabInitialized : function TSTBrowser_ensureTabInitialized(aTab)
	{
		if (!aTab || this.isTabInitialized(aTab)) return;
		this.initTab(aTab);
	},
	
	initTabAttributes : function TSTBrowser_initTabAttributes(aTab) 
	{
		var pos = this.position;
		if (pos == 'left' || pos == 'right') {
			aTab.setAttribute('align', 'stretch');
			aTab.removeAttribute('maxwidth');
			aTab.removeAttribute('minwidth');
			aTab.removeAttribute('width');
			aTab.removeAttribute('flex');
			aTab.maxWidth = 65000;
			aTab.minWidth = 0;
			if (this.getTreePref('compatibility.TMP'))
				aTab.setAttribute('dir', 'ltr'); // Tab Mix Plus
		}
		else {
			aTab.removeAttribute('align');
			aTab.removeAttribute('maxwidth');
			aTab.removeAttribute('minwidth');
			if (!this.isGecko2) { // Firefox 3.6 or older
				aTab.setAttribute('maxwidth', 250);
				aTab.setAttribute('minwidth', this.mTabBrowser.mTabContainer.mTabMinWidth);
				aTab.setAttribute('width', '0');
				aTab.maxWidth = 250;
				aTab.minWidth = this.mTabBrowser.mTabContainer.mTabMinWidth;
				aTab.setAttribute('flex', 100);
			}
			if (this.getTreePref('compatibility.TMP'))
				aTab.removeAttribute('dir'); // Tab Mix Plus
		}
	},
 
	initTabContents : function TSTBrowser_initTabContents(aTab) 
	{
		var d = this.document;

		var icon  = d.getAnonymousElementByAttribute(aTab, 'class', 'tab-icon');
		var twisty = d.getAnonymousElementByAttribute(aTab, 'class', this.kTWISTY);
		if (icon && !twisty) {
			twisty = d.createElement('image');
			twisty.setAttribute('class', this.kTWISTY);
			let container = d.createElement('hbox');
			container.setAttribute('class', this.kTWISTY_CONTAINER);
			container.appendChild(twisty);

			icon.appendChild(container);

			let marker = d.createElement('image');
			marker.setAttribute('class', this.kDROP_MARKER);
			container = d.createElement('hbox');
			container.setAttribute('class', this.kDROP_MARKER_CONTAINER);
			container.appendChild(marker);

			icon.appendChild(container);
		}

		var label = this.getTabLabel(aTab);
		var counter = d.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER);
		if (label && label.parentNode != aTab && !counter) {
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
			 *  Insertion before an anonymous element breaks its "xbl:inherits".
			 * For example, "xbl:inherits" of the closebox in a tab (Tab Mix Plus
			 * defines it) doesn't work. So, I don't use insertBefore().
			 * Instead, the counter will be rearranged by "ordinal" attribute
			 * given by initTabContentsOrder().
			 */
			// label.parentNode.insertBefore(counter, label.nextSibling);
			label.parentNode.appendChild(counter);
		}

		var tabContentBox = d.getAnonymousElementByAttribute(aTab, 'class', 'tab-content');
		if (tabContentBox &&
			(tabContentBox.firstChild.className || '').indexOf('tab-image-') > -1) {
			// Set stretched only if the tabFx2Compatible.xml is applied.
			// Tab Mix Plus overrides the binding so icons are wrongly stretched.
			tabContentBox.setAttribute('align', this.isVertical ? 'stretch' : 'center' );
		}

		this.initTabContentsOrder(aTab);
	},
 
	initTabContentsOrder : function TSTBrowser_initTabContentsOrder(aTab) 
	{
		var d = this.document;

		var label = this.getTabLabel(aTab);
		var close = this.getTabClosebox(aTab);
		var inverted = this.mTabBrowser.getAttribute(this.kTAB_CONTENTS_INVERTED) == 'true';

		var nodesContainer = d.getAnonymousElementByAttribute(aTab, 'class', 'tab-content') || aTab;
		var nodes = Array.slice(d.getAnonymousNodes(nodesContainer) || nodesContainer.childNodes);

		// reset order
		nodes.forEach(function(aNode, aIndex) {
			aNode.setAttribute('ordinal', aIndex);
		}, this);

		// rearrange top-level contents
		nodes.splice(nodes.indexOf(close), 1);
		if (inverted) {
			if (this.mTabBrowser.getAttribute(this.kCLOSEBOX_INVERTED) == 'true')
				nodes.splice(nodes.indexOf(label.parentNode)+1, 0, close);
			else
				nodes.splice(nodes.indexOf(label.parentNode), 0, close);
		}
		else {
			if (this.mTabBrowser.getAttribute(this.kCLOSEBOX_INVERTED) == 'true')
				nodes.splice(nodes.indexOf(label.parentNode), 0, close);
			else
				nodes.splice(nodes.indexOf(label.parentNode)+1, 0, close);
		}
		var count = nodes.length;
		Array.slice(nodes).reverse()
			.forEach(function(aNode, aIndex) {
				aNode.setAttribute('ordinal', (count - aIndex + 1) * 100);
			}, this);

		// rearrange contents in "tab-image-middle"
		nodes = Array.slice(label.parentNode.childNodes);

		if (inverted)
			nodes.reverse();

		var counter = d.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER);
		if (counter) {
			nodes.splice(nodes.indexOf(counter), 1);
			nodes.splice(nodes.indexOf(label)+1, 0, counter);
		}

		count = nodes.length;
		nodes.reverse().forEach(function(aNode, aIndex) {
			if (aNode.getAttribute('class') == 'informationaltab-thumbnail-container')
				return;
			aNode.setAttribute('ordinal', (count - aIndex + 1) * 100);
		}, this);
	},
 
	updateInvertedTabContentsOrder : function TSTBrowser_updateInvertedTabContentsOrder(aTarget) 
	{
		if (!this.getTreePref('tabbar.invertTabContents')) return;
		var self = this;
		this.Deferred.next(function() {
			var b = self.mTabBrowser;
			var tabs = !aTarget ?
						[b.selectedTab] :
					(aTarget instanceof Ci.nsIDOMElement) ?
						[aTarget] :
					(typeof aTarget == 'object' && 'length' in aTarget) ?
						Array.slice(aTarget) :
						self.getAllTabsArray(b);
			tabs.forEach(function(aTab) {
				this.initTabContentsOrder(aTab);
			}, self);
		});
	},
  
	initTabbar : function TSTBrowser_initTabbar(aNewPosition, aOldPosition) 
	{
		var d = this.document;
		var b = this.mTabBrowser;

		if (aNewPosition && typeof aNewPosition == 'string')
			aNewPosition = this.getPositionFlag(aNewPosition);
		if (aOldPosition && typeof aOldPosition == 'string')
			aOldPosition = this.getPositionFlag(aOldPosition);

		this._startListenTabbarEvents();
		this.window.TreeStyleTabWindowHelper.initTabbarMethods(b);

		this.stopRendering();

		var pos = aNewPosition || this.getPositionFlag(this.position);
		if (b.getAttribute('id') != 'content' &&
			!this.getTreePref('tabbar.position.subbrowser.enabled')) {
			pos = this.kTABBAR_TOP;
		}

		aOldPosition = aOldPosition || pos;

		// We have to use CSS property hack instead, because the stopRendering()
		// doesn't effect on the first time of startup.
		//  * This hack works in a "stop"-"start" pair, so, people never see the side effect.
		//  * This hack works only when "ordinal" properties are modified.
		// So, this is just for the case: "right" or "bottom" tab bar on the startup.
		if (
			pos != aOldPosition &&
			(
				((pos & this.kTABBAR_REGULAR) && (aOldPosition & this.kTABBAR_INVERTED)) ||
				((pos & this.kTABBAR_INVERTED) && (aOldPosition & this.kTABBAR_REGULAR))
			)
			)
			b.style.visibility = 'hidden';

		var strip = this.tabStrip;
		var placeHolder = this.tabStripPlaceHolder || strip;
		var splitter = this._ensureNewSplitter();
		var toggler = d.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER);
		var indicator = b.mTabDropIndicatorBar || b.tabContainer._tabDropIndicator;

		// Tab Mix Plus
		var scrollFrame, newTabBox, tabBarMode;
		if (this.getTreePref('compatibility.TMP')) {
			scrollFrame = d.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-frame') ||
							d.getAnonymousElementByAttribute(b.mTabContainer, 'anonid', 'scroll-tabs-frame');
			newTabBox = d.getAnonymousElementByAttribute(b.mTabContainer, 'id', 'tabs-newbutton-box');
			let newTabButton = d.getElementById('new-tab-button');
			if (newTabButton && newTabButton.parentNode == b.tabContainer._container)
				newTabBox = newTabButton;
			tabBarMode = this.getPref('extensions.tabmix.tabBarMode');
		}

		// All-in-One Sidebar
		var toolboxContainer = d.getAnonymousElementByAttribute(strip, 'anonid', 'aiostbx-toolbox-tableft');
		if (toolboxContainer) toolboxContainer = toolboxContainer.parentNode;

		var scrollInnerBox = b.mTabContainer.mTabstrip._scrollbox ?
				d.getAnonymousNodes(b.mTabContainer.mTabstrip._scrollbox)[0] :
				scrollFrame; // Tab Mix Plus

		this.removeTabbrowserAttribute(this.kRESIZING, b);

		this.removeTabStripAttribute('width');
		b.mPanelContainer.removeAttribute('width');

		var delayedPostProcess;

		if (pos & this.kTABBAR_VERTICAL) {
			this.collapseTarget             = 'top';
			this.screenPositionProp         = 'screenY';
			this.sizeProp                   = 'height';
			this.invertedScreenPositionProp = 'screenX';
			this.invertedSizeProp           = 'width';
			this.startProp                  = 'top';
			this.endProp                    = 'bottom';

			b.mTabBox.orient = splitter.orient = 'horizontal';
			strip.orient =
				placeHolder.orient =
				toggler.orient =
				b.mTabContainer.orient =
				b.mTabContainer.mTabstrip.orient =
				b.mTabContainer.mTabstrip.parentNode.orient = 'vertical';
			b.mTabContainer.setAttribute('align', 'stretch'); // for Mac OS X
			if (scrollInnerBox)
				scrollInnerBox.removeAttribute('flex');

			if (this.getTreePref('compatibility.TMP') && scrollFrame) { // Tab Mix Plus
				d.getAnonymousNodes(scrollFrame)[0].removeAttribute('flex');
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'vertical';
				if (newTabBox)
					newTabBox.orient = 'horizontal';
				if (tabBarMode == 2)
					this.setPref('extensions.tabmix.tabBarMode', 1);
			}

			if (toolboxContainer)
				toolboxContainer.orient = 'vertical';

			this.setTabbrowserAttribute(this.kMODE, 'vertical');

			let width = this.maxTabbarWidth(this.getTreePref('tabbar.width'), b);
			this.setTabStripAttribute('width', width);
			this.removeTabStripAttribute('height');
			b.mPanelContainer.removeAttribute('height');

			if (strip.localName == 'toolbar') {
				Array.forEach(strip.childNodes, function(aNode) {
					if (aNode.localName == 'tabs')
						return;
					if (aNode.hasAttribute('flex'))
						aNode.setAttribute('treestyletab-backup-flex', aNode.getAttribute('flex'));
					aNode.removeAttribute('flex');
				}, this);
			}

			if (pos == this.kTABBAR_RIGHT) {
				this.setTabbrowserAttribute(this.kTABBAR_POSITION, 'right');
				if (this.getTreePref('tabbar.invertTab')) {
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
					if (!aSelf.isFloating)
						indicator.setAttribute('ordinal', 1);
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
					if (!aSelf.isFloating)
						indicator.setAttribute('ordinal', 1);
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
			this.sizeProp                   = 'width';
			this.invertedScreenPositionProp = 'screenY';
			this.invertedSizeProp           = 'height';
			this.startProp                  = 'left';
			this.endProp                    = 'right';

			b.mTabBox.orient = splitter.orient = 'vertical';
			strip.orient =
				placeHolder.orient =
				toggler.orient =
				b.mTabContainer.orient =
				b.mTabContainer.mTabstrip.orient =
				b.mTabContainer.mTabstrip.parentNode.orient = 'horizontal';
			b.mTabContainer.removeAttribute('align'); // for Mac OS X
			if (scrollInnerBox)
				scrollInnerBox.setAttribute('flex', 1);

			if (this.getTreePref('compatibility.TMP') && scrollFrame) { // Tab Mix Plus
				d.getAnonymousNodes(scrollFrame)[0].setAttribute('flex', 1);
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'horizontal';
				if (newTabBox)
					newTabBox.orient = 'vertical';
			}

			if (toolboxContainer)
				toolboxContainer.orient = 'horizontal';

			this.setTabbrowserAttribute(this.kMODE, this.getTreePref('tabbar.multirow') ? 'multirow' : 'horizontal');
			this.removeTabbrowserAttribute(this.kTAB_INVERTED);

			if (strip.localName == 'toolbar') {
				Array.forEach(strip.childNodes, function(aNode) {
					if (aNode.localName == 'tabs')
						return;
					var flex = aNode.hasAttribute('treestyletab-backup-flex');
					if (!flex)
						return;
					aNode.setAttribute('flex', flex);
					aNode.removeAttribute('treestyletab-backup-flex');
				}, this);
			}

			if (pos == this.kTABBAR_BOTTOM) {
				this.setTabbrowserAttribute(this.kTABBAR_POSITION, 'bottom');
				this.indentTarget = 'bottom';
				delayedPostProcess = function(aSelf, aTabBrowser, aSplitter, aToggler) {
					if (!aSelf.isFloating)
						indicator.setAttribute('ordinal', 1);
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
					if (!aSelf.isFloating)
						indicator.setAttribute('ordinal', 1);
					aSelf.setTabStripAttribute('ordinal', 10);
					aSplitter.setAttribute('ordinal', 20);
					aToggler.setAttribute('ordinal', 5);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 30);
				};
			}
		}

		var tabs = this.getAllTabsArray(b);
		tabs.forEach(function(aTab) {
			aTab.style.removeProperty(this.indentCSSProp);
			aTab.style.removeProperty(this.collapseCSSProp);
		}, this);

		this.indentProp = this.getTreePref('indent.property');
		this.indentCSSProp = this.indentProp+'-'+this.indentTarget;
		this.collapseCSSProp = 'margin-'+this.collapseTarget;

		tabs.forEach(function(aTab) {
			this.updateTabCollapsed(aTab, aTab.getAttribute(this.kCOLLAPSED) == 'true', true);
		}, this);

		this.updateTabbarState(false);

		var self = this;
		this.Deferred.next(function() {
			delayedPostProcess(self, b, splitter, toggler);
			self.updateTabbarOverflow();
			self.updateAllTabsButton(b);
			delayedPostProcess = null;
			self.mTabBrowser.style.visibility = '';

			var event = d.createEvent('Events');
			event.initEvent(self.kEVENT_TYPE_TABBAR_INITIALIZED, true, false);
			self.mTabBrowser.dispatchEvent(event);

			self.startRendering();
		});

		pos = null;
		scrollFrame = null;
		newTabBox = null
		tabBarMode = null;
		toolboxContainer = null;
		scrollInnerBox = null;
		scrollInnerBox = null;
	},
	
	_startListenTabbarEvents : function TSTBrowser_startListenTabbarEvents() 
	{
		var b = this.mTabBrowser;

		var tabContainer = b.mTabContainer;
		tabContainer.addEventListener('TabOpen',        this, true);
		tabContainer.addEventListener('TabClose',       this, true);
		tabContainer.addEventListener('TabMove',        this, true);
		tabContainer.addEventListener('TabShow',        this, true);
		tabContainer.addEventListener('TabHide',        this, true);
		tabContainer.addEventListener('SSTabRestoring', this, true);
		tabContainer.addEventListener('SSTabRestored',  this, true);
		tabContainer.addEventListener('TabPinned',      this, true);
		tabContainer.addEventListener('TabUnpinned',    this, true);
		if (!this.isGecko2 && 'tabutils' in this.window)
			tabContainer.addEventListener('DOMAttrModified', this, true); // Tab Utilities
		tabContainer.addEventListener('mouseover', this, true);
		tabContainer.addEventListener('dblclick',  this, true);
		tabContainer.addEventListener('select', this, true);
		tabContainer.addEventListener('scroll', this, true);

		var strip = this.tabStrip;
		strip.addEventListener('MozMouseHittest', this, true); // to block default behaviors of the tab bar
		strip.addEventListener('mousedown',       this, true);
		strip.addEventListener('click',           this, true);

		this.scrollBox.addEventListener('overflow', this, true);
		this.scrollBox.addEventListener('underflow', this, true);
	},
 
	_ensureNewSplitter : function TSTBrowser__ensureNewSplitter() 
	{
		var d = this.document;
		var splitter = this.splitter;

		// We always have to re-create splitter, because its "collapse"
		// behavior becomes broken by repositioning of the tab bar.
		if (splitter) {
			try {
				splitter.removeEventListener('mousedown', this.windowService, false);
				splitter.removeEventListener('mouseup', this.windowService, false);
				splitter.removeEventListener('dblclick', this.windowService, false);
			}
			catch(e) {
			}
			let oldSplitter = splitter;
			splitter = oldSplitter.cloneNode(true);
			oldSplitter.parentNode.removeChild(oldSplitter);
		}
		else {
			splitter = d.createElement('splitter');
			splitter.setAttribute('state', 'open');
			splitter.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468
			splitter.appendChild(d.createElement('grippy'));
		}

		var splitterClass = splitter.getAttribute('class') || '';
		if (splitterClass.indexOf(this.kSPLITTER) < 0)
			splitterClass += (splitterClass ? ' ' : '' ) + this.kSPLITTER;
		splitter.setAttribute('class', splitterClass);

		splitter.addEventListener('mousedown', this.windowService, false);
		splitter.addEventListener('mouseup', this.windowService, false);
		splitter.addEventListener('dblclick', this.windowService, false);

		var ref = this.mTabBrowser.mPanelContainer;
		ref.parentNode.insertBefore(splitter, ref);

		return splitter;
	},
 
	fireTabbarPositionEvent : function TSTBrowser_fireTabbarPositionEvent(aChanging, aOldPosition, aNewPosition) 
	{
		if (aOldPosition == aNewPosition) return false;

		var type = aChanging ? this.kEVENT_TYPE_TABBAR_POSITION_CHANGING : this.kEVENT_TYPE_TABBAR_POSITION_CHANGED;
		var data = {
				oldPosition : aOldPosition,
				newPosition : aNewPosition
			};

		/* PUBLIC API */
		this.fireDataContainerEvent(type, this.mTabBrowser, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(type.replace(/^nsDOM/, ''), this.mTabBrowser, true, false, data);

		return true;
	},
  
	updateTabbarState : function TSTBrowser_updateTabbarState(aCancelable) 
	{
		if (!this._fireTabbarStateChangingEvent() && aCancelable)
			return;

		this.stopRendering();

		var w = this.window;
		var d = this.document;
		var b = this.mTabBrowser;
		var orient;
		var toggleTabsOnTop = d.getElementById('cmd_ToggleTabsOnTop');
		var TabsOnTop = 'TabsOnTop' in w ? w.TabsOnTop : null ;
		if (this.isVertical) {
			orient = 'vertical';
			this.fixed = this.fixed; // ensure set to the current orient
			if (toggleTabsOnTop)
				toggleTabsOnTop.setAttribute('disabled', true);
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
				if (this.isFloating && this.position == 'top') {
					this.removeTabStripAttribute('ordinal');
					if (TabsOnTop) {
						// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=555987
						TabsOnTop.enabled = !TabsOnTop.enabled;
						this.Deferred.next(function() {
							TabsOnTop.enabled = !TabsOnTop.enabled;
						});
					}
				}
			}
			else {
				this.fixed = false; // ensure set to the current orient
				this.setTabStripAttribute('height', this.maxTabbarHeight(this.getTreePref('tabbar.height'), b));
			}
			if (toggleTabsOnTop) {
				if (this.position == 'top')
					toggleTabsOnTop.removeAttribute('disabled');
				else
					toggleTabsOnTop.setAttribute('disabled', true);
			}
		}

		if (TabsOnTop) {
			let tabsWasOnTop = TabsOnTop.enabled;
			TabsOnTop.enabled = TabsOnTop.enabled && this.position == 'top' && this.fixed;
			if (tabsWasOnTop && !TabsOnTop.enabled)
				this.setTreePref('tabsOnTopShouldBeRestored', true);
		}

		var self = this;
		this.Deferred.next(function() {
			self.updateFloatingTabbar(self.kTABBAR_UPDATE_BY_APPEARANCE_CHANGE);
			self._fireTabbarStateChangedEvent();
			self.startRendering();
		});

		this.allowSubtreeCollapseExpand = this.getTreePref('allowSubtreeCollapseExpand.'+orient) ;
		this.maxTreeLevel = this.getTreePref('maxTreeLevel.'+orient);

		this.setTabbrowserAttribute(this.kALLOW_STACK, this.canStackTabs ? 'true' : null);
		this.updateTabsZIndex(this.canStackTabs);

		if (!this.ownerToolbar) /* legacy feature for Firefox 3.6 or olders */
			this.hideAlltabsButton = this.getTreePref('tabbar.hideAlltabsButton.'+orient);

		if (this.maxTreeLevelPhisical)
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
				indented      : this.maxTreeLevel != 0,
				canCollapse   : b.getAttribute(this.kALLOW_COLLAPSE) == 'true'
			};
		if (!this.ownerToolbar) { /* legacy feature for Firefox 3.6 or olders */
			oldState.alltabsButton = b.getAttribute(this.kHIDE_ALLTABS) != 'true';
			oldState.allTabsButton = oldState.alltabsButton;
		}
		var newState = {
				fixed         : this.getTreePref('tabbar.fixed.'+orient),
				maxTreeLevel  : this.getTreePref('maxTreeLevel.'+orient),
				indented      : this.getTreePref('maxTreeLevel.'+orient) != 0,
				canCollapse   : this.getTreePref('allowSubtreeCollapseExpand.'+orient)
			};
		if (!this.ownerToolbar) { /* legacy feature for Firefox 3.6 or olders */
			newState.alltabsButton = !this.getTreePref('tabbar.hideAlltabsButton.'+orient);
			newState.allTabsButton = newState.alltabsButton;
		}

		if (oldState.fixed == newState.fixed &&
			oldState.maxTreeLevel == newState.maxTreeLevel &&
			oldState.indented == newState.indented &&
			oldState.canCollapse == newState.canCollapse &&
			oldState.alltabsButton == newState.alltabsButton)
			return false;

		var data = {
				oldState : oldState,
				newState : newState
			};

		/* PUBLIC API */
		this.fireDataContainerEvent(this.kEVENT_TYPE_TABBAR_STATE_CHANGING, this.mTabBrowser, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_TABBAR_STATE_CHANGING.replace(/^nsDOM/, ''), this.mTabBrowser, true, false, data);

		return true;
	},
 
	_fireTabbarStateChangedEvent : function TSTBrowser_fireTabbarStateChangedEvent() 
	{
		var b = this.mTabBrowser;
		var state = {
				fixed         : this.fixed,
				maxTreeLevel  : this.maxTreeLevel,
				indented      : this.maxTreeLevel != 0,
				canCollapse   : b.getAttribute(this.kALLOW_COLLAPSE) == 'true'
			};
		if (!this.ownerToolbar) { /* legacy feature for Firefox 3.6 or olders */
			state.alltabsButton = b.getAttribute(this.kHIDE_ALLTABS) != 'true';
			state.allTabsButton = state.alltabsButton;
		}

		var data = {
				state : state
			};

		/* PUBLIC API */
		this.fireDataContainerEvent(this.kEVENT_TYPE_TABBAR_STATE_CHANGED, this.mTabBrowser, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_TABBAR_STATE_CHANGED.replace(/^nsDOM/, ''), this.mTabBrowser, true, false, data);

		return true;
	},
  
	updateFloatingTabbar : function TSTBrowser_updateFloatingTabbar(aReason) 
	{
		// this method is just for Firefox 4.0 or later
		if (!this.isFloating) return;

		var w = this.window;
		if (this._updateFloatingTabbarTimer) {
			w.clearTimeout(this._updateFloatingTabbarTimer);
			this._updateFloatingTabbarTimer = null;
		}

		this._updateFloatingTabbarReason |= aReason;

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

		var d = this.document;

		var splitter = this.splitter;
		if (splitter.collapsed || splitter.getAttribute('state') != 'collapsed') {
			this._tabStripPlaceHolder.collapsed =
				splitter.collapsed =
					(this.getPref('browser.tabs.autoHide') && this.getTabsArray(this.mTabBrowser).length == 1);
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
				this.autoHide.hide();

			let box = this._tabStripPlaceHolder.boxObject;
			let root = d.documentElement.boxObject;

			let realWidth = parseInt(this._tabStripPlaceHolder.getAttribute('width') || box.width);
			let realHeight = parseInt(this._tabStripPlaceHolder.getAttribute('height') || box.height);
			let width = (this.autoHide.expanded && this.isVertical && (aReason & this.kTABBAR_UPDATE_SYNC_TO_TABBAR) ?
							this.maxTabbarWidth(this.getTreePref('tabbar.width')) :
							0
						) || realWidth;
			let height = (this.autoHide.expanded && !this.isVertical && (aReason & this.kTABBAR_UPDATE_SYNC_TO_TABBAR) ?
							this.maxTabbarHeight(this.getTreePref('tabbar.height')) :
							0
						) || realHeight;
			let yOffset = pos == 'bottom' ? height - realHeight : 0 ;

			stripStyle.top = (box.screenY - root.screenY + root.y - yOffset)+'px';
			stripStyle.left = pos == 'right' ? '' :
							(box.screenX - root.screenX + root.x)+'px';
			stripStyle.right = pos != 'right' ? '' :
							((root.screenX + root.width) - (box.screenX + box.width))+'px';

			stripStyle.width = (tabContainerBox.width = width)+'px';
			stripStyle.height = (tabContainerBox.height = height)+'px';

			this._updateFloatingTabbarResizer({
				width      : width,
				realWidth  : realWidth,
				height     : height,
				realHeight : realHeight
			});

			strip.collapsed = tabContainerBox.collapsed = collapsed;

			if (statusPanel && this.getTreePref('repositionStatusPanel')) {
				let offsetParentBox = this.utils.findOffsetParent(statusPanel).boxObject;
				let contentBox = this.mTabBrowser.mPanelContainer.boxObject;
				let chromeMargins = (d.documentElement.getAttribute('chromemargin') || '0,0,0,0').split(',');
				chromeMargins = chromeMargins.map(function(aMargin) { return parseInt(aMargin); });
				statusPanelStyle.marginTop = (pos == 'bottom') ?
					'-moz-calc(0px - ' + (offsetParentBox.height - contentBox.height + chromeMargins[2]) + 'px - 3em)' :
					'' ;
				statusPanelStyle.marginLeft = (contentBox.screenX - offsetParentBox.screenX + chromeMargins[3])+'px';
				statusPanelStyle.marginRight = ((offsetParentBox.screenX + offsetParentBox.width) - (contentBox.screenX + contentBox.width) + chromeMargins[1])+'px';
				statusPanelStyle.maxWidth = this.isVertical ?
					parseInt(contentBox.width / 2)+'px' :
					'' ;
				statusPanel.__treestyletab__repositioned = true;
			}

			this.mTabBrowser.tabContainer.setAttribute('context', this.mTabBrowser.tabContextMenu.id);
		}
		else {
			strip.collapsed = tabContainerBox.collapsed = collapsed;
			stripStyle.top = stripStyle.left = stripStyle.right = stripStyle.width = stripStyle.height = '';

			if (
				statusPanel &&
				(
					this.getTreePref('repositionStatusPanel') ||
					statusPanel.__treestyletab__repositioned
				)
				) {
				statusPanelStyle.marginTop = statusPanelStyle.marginLeft =
					statusPanelStyle.marginRight = statusPanelStyle.maxWidth = '';
				statusPanel.__treestyletab__repositioned = false;
			}

			strip.removeAttribute('layer'); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468

			this.mTabBrowser.tabContainer.removeAttribute('context');
		}

		if (tabContainerBox.boxObject.width)
			this.positionPinnedTabs(null, null, aReason & this.kTABBAR_UPDATE_BY_AUTOHIDE);
		else
			this.positionPinnedTabsWithDelay(null, null, aReason & this.kTABBAR_UPDATE_BY_AUTOHIDE);
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
			splitter = d.createElement('splitter');
			splitter.setAttribute('id', 'treestyletab-tabbar-resizer-splitter');
			splitter.setAttribute('class', this.kSPLITTER);
			splitter.setAttribute('onmousedown', 'TreeStyleTabService.handleEvent(event);');
			splitter.setAttribute('onmouseup', 'TreeStyleTabService.handleEvent(event);');
			splitter.setAttribute('ondblclick', 'TreeStyleTabService.handleEvent(event);');
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
  
	updateTabbarOverflow : function TSTBrowser_updateTabbarOverflow() 
	{
		var d = this.document;
		var b = this.mTabBrowser;
		b.mTabContainer.removeAttribute('overflow'); // Firefox 4.0
		var container = d.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-container');

		if (!container) {
			if (this.ownerToolbar)
				container = b.mTabContainer;
			else
				return;
		}

		container.removeAttribute('overflow');

		var scrollBox = this.scrollBox;
		this.window.setTimeout(function() {
			scrollBox = d.getAnonymousElementByAttribute(scrollBox, 'anonid', 'scrollbox');
			if (scrollBox) scrollBox = d.getAnonymousNodes(scrollBox)[0];
			if (
				scrollBox &&
				(
					scrollBox.boxObject.width > container.boxObject.width ||
					scrollBox.boxObject.height > container.boxObject.height
				)
				) {
				b.mTabContainer.setAttribute('overflow', true); // Firefox 4.0
				container.setAttribute('overflow', true);
			}
			else {
				b.mTabContainer.removeAttribute('overflow'); // Firefox 4.0
				container.removeAttribute('overflow');
			}
		}, 100);
	},
 
	reinitAllTabs : function TSTBrowser_reinitAllTabs(aSouldUpdateCount) 
	{
		var tabs = this.getAllTabsArray(this.mTabBrowser);
		tabs.forEach(function(aTab) {
			this.initTabAttributes(aTab);
			this.initTabContents(aTab);
			if (aSouldUpdateCount)
				this.updateTabsCount(aTab);
		}, this);
	},
  
	destroy : function TSTBrowser_destroy() 
	{
		this.saveTreeStructure();

		this.animationManager.removeTask(this.smoothScrollTask);

		this.autoHide.destroy();
		delete this._autoHide;

		this._initDNDObservers(); // ensure initialized
		this.tabbarDNDObserver.destroy();
		delete this._tabbarDNDObserver;
		this.panelDNDObserver.destroy();
		delete this._panelDNDObserver;

		if (this.tooltipManager) {
			this.tooltipManager.destroy();
			delete this.tooltipManager;
		}

		var w = this.window;
		var d = this.document;
		var b = this.mTabBrowser;
		delete b.tabContainer.treeStyleTab;

		this.getAllTabsArray(b).forEach(function(aTab) {
			this.stopTabIndentAnimation(aTab);
			this.stopTabCollapseAnimation(aTab);
			this.destroyTab(aTab);
		}, this);

		this._endListenTabbarEvents();

		w.removeEventListener('resize', this, true);
		w.removeEventListener('beforecustomization', this, true);
		w.removeEventListener('aftercustomization', this, false);
		w.removeEventListener('customizationchange', this, false);
		w.removeEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		w.removeEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED,  this, false);
		w.removeEventListener('tabviewhidden', this, true);
		w.removeEventListener(this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END, this, false);

		b.removeEventListener('nsDOMMultipleTabHandlerTabsClosing', this, false);

		w['piro.sakura.ne.jp'].tabsDragUtils.destroyTabBrowser(b);

		var tabContextMenu = b.tabContextMenu ||
							d.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContextMenu.removeEventListener('popupshowing', this, false);

		if (this.tabbarCanvas) {
			this.tabbarCanvas.parentNode.removeChild(this.tabbarCanvas);
			this.tabbarCanvas = null;
		}

		this.ObserverService.removeObserver(this, this.kTOPIC_INDENT_MODIFIED);
		this.ObserverService.removeObserver(this, this.kTOPIC_COLLAPSE_EXPAND_ALL);
		this.ObserverService.removeObserver(this, this.kTOPIC_CHANGE_TREEVIEW_AVAILABILITY);
		this.ObserverService.removeObserver(this, 'sessionstore-windows-restored');
		this.ObserverService.removeObserver(this, 'sessionstore-browser-state-restored');
		this.ObserverService.removeObserver(this, 'private-browsing-change-granted');
		this.ObserverService.removeObserver(this, 'lightweight-theme-styling-update');
		this.removePrefListener(this);

		delete this.windowService;
		delete this.window;
		delete this.document;
		delete this.mTabBrowser.treeStyleTab;
		delete this.mTabBrowser;
	},
	
	destroyTab : function TSTBrowser_destroyTab(aTab) 
	{
		var id = aTab.getAttribute(this.kID);
		if (id in this.tabsHash)
			delete this.tabsHash[id];

		delete aTab.__treestyletab__linkedTabBrowser;
	},
 
	_endListenTabbarEvents : function TSTBrowser_endListenTabbarEvents() 
	{
		var b = this.mTabBrowser;

		var tabContainer = b.mTabContainer;
		tabContainer.removeEventListener('TabOpen',        this, true);
		tabContainer.removeEventListener('TabClose',       this, true);
		tabContainer.removeEventListener('TabMove',        this, true);
		tabContainer.removeEventListener('TabShow',        this, true);
		tabContainer.removeEventListener('TabHide',        this, true);
		tabContainer.removeEventListener('SSTabRestoring', this, true);
		tabContainer.removeEventListener('SSTabRestored',  this, true);
		tabContainer.removeEventListener('TabPinned',      this, true);
		tabContainer.removeEventListener('TabUnpinned',    this, true);
		if (!this.ownerToolbar && 'tabutils' in this.window)
			b.mTabContainer.removeEventListener('DOMAttrModified', this, true); // Tab Utilites
		tabContainer.removeEventListener('mouseover', this, true);
		tabContainer.removeEventListener('dblclick',  this, true);
		tabContainer.removeEventListener('select', this, true);
		tabContainer.removeEventListener('scroll', this, true);

		var strip = this.tabStrip;
		strip.removeEventListener('MozMouseHittest', this, true);
		strip.removeEventListener('mousedown',       this, true);
		strip.removeEventListener('click',           this, true);

		this.scrollBox.removeEventListener('overflow', this, true);
		this.scrollBox.removeEventListener('underflow', this, true);
	},
 
	saveCurrentState : function TSTBrowser_saveCurrentState() 
	{
		this.autoHide.saveCurrentState();

		var b = this.mTabBrowser;
		var floatingBox = this.getTabStrip(b).boxObject;
		var fixedBox = (this.tabStripPlaceHolder || this.getTabStrip(b)).boxObject;
		var prefs = {
				'tabbar.fixed.horizontal' : b.getAttribute(this.kFIXED+'-horizontal') == 'true',
				'tabbar.fixed.vertical'   : b.getAttribute(this.kFIXED+'-vertical') == 'true',
				'tabbar.width'            : this.isVertical && this.autoHide.expanded && floatingBox.width ? floatingBox.width : void(0),
				'tabbar.shrunkenWidth'    : this.isVertical && !this.autoHide.expanded && fixedBox.width ? fixedBox.width : void(0),
				'tabbar.height'           : !this.isVertical && this.autoHide.expanded && floatingBox.height ? floatingBox.height : void(0)
			};
		for (var i in prefs)
		{
			if (prefs[i] !== void(0) && this.getTreePref(i) != prefs[i])
				this.setTreePref(i, prefs[i]);
		}
		this.position = this.position;
	},
   
/* toolbar customization on Firefox 4 or later */ 
	
	syncDestroyTabbar : function TSTBrowser_syncDestroyTabbar() 
	{
		this.stopRendering();

		this._lastTabbarPositionBeforeDestroyed = this.position;
		if (this.position != 'top') {
			let self = this;
			this.doAndWaitDOMEvent(
				this.kEVENT_TYPE_TABBAR_POSITION_CHANGED,
				this.window,
				100,
				function() {
					self.position = 'top';
				}
			);
		}

		this.maxTreeLevel = 0;
		this.hideAlltabsButton = false; /* legacy feature for Firefox 3.6 or olders */
		this.fixed = true;
		this._lastTreeViewEnabledBeforeDestroyed = this.treeViewEnabled;
		this.treeViewEnabled = false;

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

		this._endListenTabbarEvents();

		this.tabbarDNDObserver.endListenEvents();

		this.window.setTimeout(function(aSelf) {
			aSelf.updateCustomizedTabsToolbar();
		}, 100, this);

		this.startRendering();
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
 
	syncReinitTabbar : function TSTBrowser_syncReinitTabbar() 
	{
		this.stopRendering();

		this.ownerToolbar.classList.add(this.kTABBAR_TOOLBAR);
		this.ownerToolbar.classList.remove(this.kTABBAR_TOOLBAR_READY);
		Array.slice(this.document.querySelectorAll('.'+this.kTABBAR_TOOLBAR_READY_POPUP))
			.forEach(function(aPanel) {
				this.safeRemovePopup(aPanel);
			}, this);

		var position = this._lastTabbarPositionBeforeDestroyed || this.position;
		delete this._lastTabbarPositionBeforeDestroyed;

		var self = this;
		this.doAndWaitDOMEvent(
			this.kEVENT_TYPE_TABBAR_INITIALIZED,
			this.window,
			100,
			function() {
				self.initTabbar(position, 'top');
			}
		);
		this.reinitAllTabs(true);

		this.tabbarDNDObserver.startListenEvents();

		this.treeViewEnabled = this._lastTreeViewEnabledBeforeDestroyed;
		delete this._lastTreeViewEnabledBeforeDestroyed;

		this.startRendering();
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
			let label = this.treeBundle.getString('toolbarCustomizing_tabbar_'+(position == 'left' || position == 'right' ? 'vertical' : 'horizontal' ));
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
			aPopup.addEventListener('popuphidden', function(aEvent) {
				aPopup.removeEventListener(aEvent.type, arguments.callee, false);
				aPopup.parentNode.removeChild(aPopup);
			}, false);
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
		'browser.tabs.autoHide',
		'browser.tabs.animate'
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

			case 'sessionstore-windows-restored':
			case 'sessionstore-browser-state-restored':
				return this.onWindowStateRestored();

			case 'private-browsing-change-granted':
				this.collapseExpandAllSubtree(false, true);
				this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_PRIVATE_BROWSING);
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
		var b = this.mTabBrowser;
		var value = this.getPref(aPrefName);
		var tabContainer = b.mTabContainer;
		var tabs  = this.getAllTabsArray(b);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.position':
				if (this.shouldApplyNewPref)
					this.position = value;
				return;

			case 'extensions.treestyletab.tabbar.invertTab':
			case 'extensions.treestyletab.tabbar.multirow':
				this.initTabbar();
				this.updateAllTabsIndent();
				tabs.forEach(function(aTab) {
					this.initTabContents(aTab);
				}, this);
				return;
			case 'extensions.treestyletab.tabbar.invertTabContents':
				this.setTabbrowserAttribute(this.kTAB_CONTENTS_INVERTED, value);
				tabs.forEach(function(aTab) {
					this.initTabContents(aTab);
				}, this);
				return;

			case 'extensions.treestyletab.tabbar.invertClosebox':
				this.setTabbrowserAttribute(this.kCLOSEBOX_INVERTED, value);
				tabs.forEach(function(aTab) {
					this.initTabContents(aTab);
				}, this);
				return;

			case 'extensions.treestyletab.tabbar.style':
			case 'extensions.treestyletab.tabbar.style.aero':
				this.setTabbarStyle(this.getTreePref('tabbar.style'));
				value = this.getTreePref('twisty.style');
				if (value != 'auto')
					return;
			case 'extensions.treestyletab.twisty.style':
				return this.setTwistyStyle(value);

			case 'extensions.treestyletab.showBorderForFirstTab':
				return this.setTabbrowserAttribute(this.kFIRSTTAB_BORDER, value);

			case 'extensions.treestyletab.tabbar.fixed.horizontal':
				if (!this.shouldApplyNewPref) return;
				this.setTabbrowserAttribute(this.kFIXED+'-horizontal', value ? 'true' : null, b);
			case 'extensions.treestyletab.maxTreeLevel.horizontal':
			case 'extensions.treestyletab.allowSubtreeCollapseExpand.horizontal':
			case 'extensions.treestyletab.tabbar.hideAlltabsButton.horizontal': /* legacy feature for Firefox 3.6 or olders */
				if (!this.isVertical)
					this.updateTabbarState(true);
				return;

			case 'extensions.treestyletab.tabbar.fixed.vertical':
				if (!this.shouldApplyNewPref) return;
				this.setTabbrowserAttribute(this.kFIXED+'-vertical', value ? 'true' : null, b);
			case 'extensions.treestyletab.maxTreeLevel.vertical':
			case 'extensions.treestyletab.allowSubtreeCollapseExpand.vertical':
			case 'extensions.treestyletab.tabbar.hideAlltabsButton.vertical': /* legacy feature for Firefox 3.6 or olders */
				if (this.isVertical)
					this.updateTabbarState(true);
				return;

			case 'extensions.treestyletab.tabbar.width':
			case 'extensions.treestyletab.tabbar.shrunkenWidth':
				if (!this.shouldApplyNewPref) return;
				if (!this.autoHide.isResizing && this.isVertical) {
					this.removeTabStripAttribute('width');
					if (this.isFloating) {
						this.setTabStripAttribute('width', this.autoHide.placeHolderWidthFromMode);
						this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_PREF_CHANGE);
					}
					else {
						this.setTabStripAttribute('width', this.autoHide.widthFromMode);
					}
				}
				this.checkTabsIndentOverflow();
				return;

			case 'extensions.treestyletab.tabbar.height':
				if (!this.shouldApplyNewPref) return;
				this._horizontalTabMaxIndentBase = 0;
				this.checkTabsIndentOverflow();
				return;

			case 'extensions.treestyletab.tabbar.autoShow.mousemove':
				let (toggler = this.document.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER)) {
					if (toggler) {
						if (value)
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

			case 'extensions.treestyletab.maxTreeLevel.phisical':
				if (this.maxTreeLevelPhisical = value)
					this.promoteTooDeepLevelTabs();
				return;

			case 'browser.tabs.animate':
			case 'extensions.treestyletab.animation.enabled':
				this.setTabbrowserAttribute(this.kANIMATION_ENABLED,
					(
						this.getPref('extensions.treestyletab.animation.enabled') &&
						(this.getPref('browser.tabs.animate') !== false)
					) ? 'true' : null
				);
				return;

			case 'browser.tabs.closeButtons':
			case 'browser.tabs.closeWindowWithLastTab':
				return this.updateInvertedTabContentsOrder(true);

			case 'browser.tabs.autoHide':
				if (this.getTabsArray(this.mTabBrowser).length == 1)
					this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_SHOWHIDE_TABBAR);
				return;

			case 'extensions.treestyletab.tabbar.autoHide.mode':
			case 'extensions.treestyletab.tabbar.autoHide.mode.fullscreen':
				return this.autoHide; // ensure initialized

			case 'extensions.treestyletab.pinnedTab.faviconized':
				return this.positionPinnedTabsWithDelay();

			case 'extensions.treestyletab.restoreTreeOnStartup':
				if (value) this.saveTreeStructureWithDelay();
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
			this.setTreePref('tabbar.style', aStyle = aStyle.replace('default', 'plain'));
		}
		else if (// dropshadow is available only on Firefox 3.5 or later.
			aStyle.indexOf('mixed') == 0 &&
			this.Comparator.compare(this.XULAppInfo.version, '3.5') < 0
			) {
			this.setTreePref('tabbar.style', aStyle = aStyle.replace('mixed', 'flat'));
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
			if (this.getTreePref('tabbar.style.aero'))
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

		if (this.getTreePref('tabbar.style') == 'sidebar') {
			aStyle = 'osx';
		}
		else if (
			this.getPref('extensions.informationaltab.thumbnail.enabled') &&
			this.getPref('extensions.informationaltab.thumbnail.position') < 100
			) {
			let self = this;
			this.extensions.isAvailable('informationaltab@piro.sakura.ne.jp', {
				ok : function() {
					aStyle = 'retro';
					self.setTabbrowserAttribute(self.kTWISTY_STYLE, aStyle);
				},
				ng : function() {
					self.setTabbrowserAttribute(self.kTWISTY_STYLE, aStyle);
				}
			});
			return;
		}

		this.setTabbrowserAttribute(this.kTWISTY_STYLE, aStyle);
	},
 
	onWindowStateRestored : function TSTBrowser_onWindowStateRestored() 
	{
		if (!this.window.__SS_tabsToRestore)
			return;

		if (!this.windowStateRestored) {
			if (this.getTreePref('restoreTreeOnStartup'))
				this.restoreTreeStructure(this.windowService.storedTreeStructure);
			this.windowStateRestored = true;
		}
	},
 
	getTreeStructure : function TSTBrowser_getTreeStructure(aBaseStructure) 
	{
		aBaseStructure = aBaseStructure || {};
		var id = this.mTabBrowser.getAttribute('id');
		var tabs = this.getAllTabsArray(this.mTabBrowser);
		aBaseStructure[id] = {
			tree : this.getTreeStructureFromTabs(tabs),
			state : tabs.map(function(aTab) {
				var state = { id : this.getTabValue(aTab, this.kID) };
				if (this.isCollapsed(aTab))
					state.collapsed = true;
				if (this.isSubtreeCollapsed(aTab))
					state.subTreeCollapsed = true;
				return state;
			}, this)
		};
		return aBaseStructure;
	},
 
	saveTreeStructureWithDelay : function TSTBrowser_saveTreeStructureWithDelay() 
	{
		if (this.restoringTree || this.saveTreeStructureWithDelayTimer)
			return;

		this.saveTreeStructureWithDelayTimer = this.window.setTimeout(function(aSelf) {
			aSelf.saveTreeStructureWithDelayTimer = null;
			aSelf.saveTreeStructure();
		}, this.getPref('browser.sessionstore.interval'), this);
	},
	saveTreeStructureWithDelayTimer : null,
	saveTreeStructure : function TSTBrowser_saveTreeStructure()
	{
		if (!this.getTreePref('restoreTreeOnStartup'))
			return;

		var treeStructures = this.windowService.storedTreeStructure;
		treeStructures = this.getTreeStructure(treeStructures);
		this.SessionStore.setWindowValue(this.window, this.kSTRUCTURE, JSON.stringify(treeStructures))
	},
 
	restoreTreeStructure : function TSTBrowser_restoreTreeStructure(aStructures) 
	{
		if (!aStructures)
			return;

		var id = this.mTabBrowser.getAttribute('id');
		var treeStructure = id in aStructures ? aStructures[id] : null ;
		if (
			!treeStructure ||
			!treeStructure.state ||
			!treeStructure.state.length ||
			!treeStructure.tree ||
			!treeStructure.tree.length ||
			treeStructure.state.length != treeStructure.tree.length
			)
			return;

		var tabs = this.getAllTabsArray(this.mTabBrowser);

		// on Firefox 3.6, we cannot get tab values before SSTabRestoring...
		var actualTabs = tabs.map(function(aTab) {
				return this.getTabValue(aTab, this.kID);
			}, this).join('\n')+'\n';
		var restoringTabs = treeStructure.state.map(function(aState) {
				return aState.id;
			}).join('\n')+'\n';
		if (actualTabs.indexOf(restoringTabs) < 0)
			return;

		var preTabs = actualTabs
						.split(restoringTabs)[0]
						.replace(/\n$/, '')
						.split('\n')
						.filter(function(aId) { return aId; })
						.length;
		tabs = tabs.slice(preTabs, preTabs + treeStructure.tree.length);

		var relations = tabs.map(function(aTab) {
				return {
					id           : this.getTabValue(aTab, this.kID),
					parent       : this.getTabValue(aTab, this.kPARENT),
					children     : this.getTabValue(aTab, this.kCHILDREN),
					insertBefore : this.getTabValue(aTab, this.kINSERT_BEFORE),
					insertAfter  : this.getTabValue(aTab, this.kINSERT_AFTER)
				};
			}, this);

		this.applyTreeStructureToTabs(tabs, treeStructure.tree, true);

		tabs.forEach(function(aTab, aIndex) {
			var relation = relations[aIndex];
			if (!relation.id)
				return;

			this.tabsHash[relation.id] = aTab;

			var state = treeStructure.state[aIndex];
			this.setTabValue(aTab, this.kSUBTREE_COLLAPSED, state.subTreeCollapsed || null);
			this.collapseExpandTab(aTab, state.collapsed || false, true);

			this.setTabValue(aTab, this.kID, relation.id);
			this.setTabValue(aTab, this.kPARENT, relation.parent);
			this.setTabValue(aTab, this.kCHILDREN, relation.children);
			this.setTabValue(aTab, this.kINSERT_BEFORE, relation.insertBefore);
			this.setTabValue(aTab, this.kINSERT_AFTER, relation.insertAfter);

			aTab.__treestyletab__structureRestored = true;
		}, this);
	},
  
/* DOM Event Handling */ 
	
	handleEvent : function TSTBrowser_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'TabOpen':
				return this.onTabAdded(aEvent);

			case 'TabClose':
				return this.onTabRemoved(aEvent);

			case 'TabMove':
				return this.onTabMove(aEvent);

			case 'TabShow':
			case 'TabHide':
				return this.onTabVisibilityChanged(aEvent);

			case 'SSTabRestoring':
				return this.onTabRestoring(aEvent);

			case 'SSTabRestored':
				return this.onTabRestored(aEvent);

			case 'TabPinned':
				return this.onPinTab(aEvent.originalTarget);

			case 'TabUnpinned':
				return this.onUnpinTab(aEvent.originalTarget);

			case 'DOMAttrModified':
				return this.onDOMAttrModified(aEvent);

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
				this._initTooltipManager();
				this._initDNDObservers();
				let (tab = aEvent.target) {
					if (tab.__treestyletab__twistyHoverTimer)
						this.window.clearTimeout(tab.__treestyletab__twistyHoverTimer);
					if (this.isEventFiredOnTwisty(aEvent))
						tab.__treestyletab__twistyHoverTimer = this.window.setTimeout(function(aSelf) {
							tab.setAttribute(aSelf.kTWISTY_HOVER, true);
						}, 0, this);
					else
						tab.removeAttribute(this.kTWISTY_HOVER);
				}
				return;

			case 'dragover':
				this._initTooltipManager();
				this._initDNDObservers();
				return;

			case 'overflow':
			case 'underflow':
				return this.onTabbarOverflow(aEvent);

			case 'resize':
				return this.onResize(aEvent);


			// toolbar customizing on Firefox 4 or later
			case 'beforecustomization':
				this.toolbarCustomizing = true;
				return this.syncDestroyTabbar();
			case 'aftercustomization':
				// Ignore it, because 'aftercustomization' fired not
				// following to 'beforecustomization' is invalid.
				// Personal Titlebar addon (or others) fires a fake
				// event on its startup process.
				if (!this.toolbarCustomizing) return;
				this.toolbarCustomizing = false;
				return this.syncReinitTabbar();
			case 'customizationchange':
				return this.updateCustomizedTabsToolbar();

			case 'tabviewhidden':
				this.tabViewHiding = true;
				this._addedCountClearTimer = this.window.setTimeout(function(aSelf) {
					aSelf.tabViewHiding = false;
				}, 0, this);
				return;


			case this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED:
				return this.onTreeStyleTabPrintPreviewEntered(aEvent);
			case this.kEVENT_TYPE_PRINT_PREVIEW_EXITED:
				return this.onTreeStyleTabPrintPreviewExited(aEvent);


			case this.kEVENT_TYPE_TAB_FOCUS_SWITCHING_END:
				return this.cancelDelayedExpandOnTabSelect();


			case 'nsDOMMultipleTabHandlerTabsClosing':
				if (!this.onTabsRemoving(aEvent))
					aEvent.preventDefault();
				return;
		}
	},
	lastScrollX : -1,
	lastScrollY : -1,
	tabViewHiding : false,
	
	restoreLastScrollPosition : function TSTBrowser_restoreLastScrollPosition()
	{
		if (this.lastScrollX < 0 || this.lastScrollY < 0) return;
		var lastX = this.lastScrollX;
		var lastY = this.lastScrollY;
		this.clearLastScrollPosition();
		if (!this.smoothScrollTask &&
			!this.scrollBox._smoothScrollTimer) { // don't restore scroll position if another scroll is already running.
			let x = {}, y = {};
			let scrollBoxObject = this.scrollBoxObject;
			scrollBoxObject.getPosition(x, y);
			if (x.value != lastX || y.value != lastY)
				scrollBoxObject.scrollTo(lastX, lastY);
		}
	},
	clearLastScrollPosition : function TSTBrowser_clearLastScrollPosition()
	{
		this.lastScrollX = -1;
		this.lastScrollY = -1;
	},
	updateLastScrollPosition : function TSTBrowser_updateLastScrollPosition() 
	{
		if (!this.isVertical) return;
		var x = {}, y = {};
		var scrollBoxObject = this.scrollBoxObject;
		if (!scrollBoxObject) return;
		scrollBoxObject.getPosition(x, y);
		this.lastScrollX = x.value;
		this.lastScrollY = y.value;
	},
  
	onTabAdded : function TSTBrowser_onTabAdded(aEvent, aTab) 
	{
		var tab = aTab || aEvent.originalTarget;
		var b   = this.mTabBrowser;

		if (this.isTabInitialized(tab))
			return false;

		this.initTab(tab);

		var hasStructure = this.treeStructure && this.treeStructure.length;
		var pareintIndexInTree = hasStructure ? this.treeStructure.shift() : 0 ;
		var lastRelatedTab = b._lastRelatedTab;

		if (this.readiedToAttachNewTab) {
			if (pareintIndexInTree < 0) { // there is no parent, so this is a new parent!
				this.parentTab = tab.getAttribute(this.kID);
			}

			let parent = this.getTabById(this.parentTab);
			if (parent) {
				let tabs = [parent].concat(this.getDescendantTabs(parent));
				parent = pareintIndexInTree < tabs.length ? tabs[pareintIndexInTree] : parent ;
			}
			if (parent) {
				this.attachTabTo(tab, parent, {
					dontExpand : this.shouldExpandAllTree
				});
			}

			let refTab;
			let newIndex = -1;
			if (hasStructure) {
			}
			else if (this.insertBefore &&
				(refTab = this.getTabById(this.insertBefore))) {
				newIndex = refTab._tPos;
			}
			else if (
				parent &&
				this.getTreePref('insertNewChildAt') == this.kINSERT_FISRT &&
				(this.multipleCount <= 0 || this._addedCountInThisLoop <= 0)
				) {
				/* 複数の子タブを一気に開く場合、最初に開いたタブだけを
				   子タブの最初の位置に挿入し、続くタブは「最初の開いたタブ」と
				   「元々最初の子だったタブ」との間に挿入していく */
				newIndex = parent._tPos + 1;
				if (refTab = this.getFirstChildTab(parent))
					this.insertBefore = refTab.getAttribute(this.kID);
			}

			if (newIndex > -1) {
				if (newIndex > tab._tPos) newIndex--;
				this.internallyTabMovingCount++;
				b.moveTabTo(tab, newIndex);
				this.internallyTabMovingCount--;
			}

			if (this.shouldExpandAllTree)
				this.collapseExpandSubtree(parent, false);
		}

		this._addedCountInThisLoop++;
		if (!this._addedCountClearTimer) {
			this._addedCountClearTimer = this.window.setTimeout(function(aSelf) {
				aSelf._addedCountInThisLoop = 0;
				aSelf._addedCountClearTimer = null;
			}, 0, this);
		}

		if (!this.readiedToAttachMultiple) {
			this.stopToOpenChildTab(b);
		}
		else {
			this.multipleCount++;
		}

		if (this.animationEnabled) {
			this.updateTabCollapsed(tab, true, true);
			this.updateTabCollapsed(tab, false, this.restoringTree);
		}

		var prev = this.getPreviousSiblingTab(tab);
		if (prev) {
			this.setTabValue(tab, this.kINSERT_AFTER, prev.getAttribute(this.kID));
			this.setTabValue(prev, this.kINSERT_BEFORE, tab.getAttribute(this.kID));
		}

		var next = this.getNextSiblingTab(tab);
		if (next) {
			this.setTabValue(tab, this.kINSERT_BEFORE, next.getAttribute(this.kID));
			this.setTabValue(next, this.kINSERT_AFTER, tab.getAttribute(this.kID));
		}

		if (this.scrollToNewTabMode > 0)
			this.scrollToTab(tab, this.scrollToNewTabMode < 2);

		if (this.getPref('browser.tabs.autoHide'))
			this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_SHOWHIDE_TABBAR);

		if (this.canStackTabs)
			this.updateTabsZIndex(true);

		// if there is only one tab and new another tab is opened,
		// closebox appearance is possibly changed.
		var tabs = this.getTabsArray(b);
		if (tabs.length == 2)
			this.updateInvertedTabContentsOrder(tabs);

		/**
		 * gBrowser.adthis._changeTabbarPosition(position);
		 dTab() resets gBrowser._lastRelatedTab.owner
		 * when a new background tab is opened from the current tab,
		 * but it will fail with TST because gBrowser.moveTab() (called
		 * by TST) clears gBrowser._lastRelatedTab.
		 * So, we have to restore gBrowser._lastRelatedTab manually.
		 */
		b._lastRelatedTab = lastRelatedTab;

		this.saveTreeStructureWithDelay();

		return true;
	},
	_addedCountInThisLoop : 0,
	_addedCountClearTimer : null,
	_checkRestoringWindowTimerOnTabAdded : null,
 
	onTabRemoved : function TSTBrowser_onTabRemoved(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var d   = this.document;
		var b   = this.mTabBrowser;

		tab.setAttribute(this.kREMOVED, true);

		this.stopTabIndentAnimation(tab);
		this.stopTabCollapseAnimation(tab);

		var closeParentBehavior = this.getCloseParentBehaviorForTab(tab);

		var collapsed = this.isCollapsed(tab);
		if (collapsed)
			this.stopRendering();

		var backupAttributes = {};
		if (this.hasChildTabs(tab))
			backupAttributes[this.kCHILDREN] = this.getTabValue(tab, this.kCHILDREN);

		var subtreeCollapsed = this.isSubtreeCollapsed(tab);
		if (
			closeParentBehavior == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN ||
			subtreeCollapsed
			) {
			let tabs = this.getDescendantTabs(tab);
			if (this.fireTabSubtreeClosingEvent(tab, tabs)) {
				if (subtreeCollapsed)
					this.stopRendering();

				this.markAsClosedSet([tab].concat(tabs));

				tabs.reverse().forEach(function(aTab) {
					b.removeTab(aTab, { animate : true });
				}, this);

				this.fireTabSubtreeClosedEvent(b, tab, tabs);

				if (subtreeCollapsed)
					this.startRendering();
			}
		}

		var toBeClosedSibling = !this.hasChildTabs(tab) ?
								this._reserveCloseNeedlessGroupTabSibling(tab) : null ;

		var firstChild     = this.getFirstChildTab(tab);
		var parentTab      = this.getParentTab(tab);
		var nextFocusedTab = null;

		var prev = this.getPreviousSiblingTab(tab);
		var next = this.getNextSiblingTab(tab);
		if (prev) {
			this.setTabValue(tab, this.kINSERT_AFTER, prev.getAttribute(this.kID));

			if (next)
				this.setTabValue(prev, this.kINSERT_BEFORE, next.getAttribute(this.kID));
			else
				this.deleteTabValue(prev, this.kINSERT_BEFORE);
		}
		if (next) {
			this.setTabValue(tab, this.kINSERT_BEFORE, next.getAttribute(this.kID));

			if (prev)
				this.setTabValue(next, this.kINSERT_AFTER, prev.getAttribute(this.kID));
			else
				this.deleteTabValue(next, this.kINSERT_AFTER);
		}

		var indentModifiedTabs = [];

		if (firstChild) {
			let children = this.getChildTabs(tab);
			indentModifiedTabs = indentModifiedTabs.concat(
					closeParentBehavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD ?
						[children[0]] :
						children
				);
			this.detachAllChildren(tab, {
				behavior         : closeParentBehavior,
				dontUpdateIndent : true
			});
			if (closeParentBehavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN ||
				closeParentBehavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD)
				nextFocusedTab = firstChild;
		}

		if (parentTab) {
			let firstSibling = this.getFirstChildTab(parentTab);
			let lastSibling  = this.getLastChildTab(parentTab);
			if (tab == lastSibling && !nextFocusedTab) {
				if (tab == firstSibling) { // there is only one child
					nextFocusedTab = parentTab;
				}
				else { // previous sibling tab
					nextFocusedTab = this.getPreviousSiblingTab(tab);
				}
			}

			let ancestors = [],
				ancestor = parentTab;
			do {
				ancestors.push(ancestor.getAttribute(this.kID));
				if (!next && (next = this.getNextSiblingTab(ancestor)))
					backupAttributes[this.kINSERT_BEFORE] = next.getAttribute(this.kID);
			}
			while (ancestor = this.getParentTab(ancestor));
			backupAttributes[this.kANCESTOR] = ancestors.join('|');

			let shouldCloseParentTab = (
					this.isGroupTab(parentTab) &&
					this.getDescendantTabs(parentTab).length == 1
				);
			if (shouldCloseParentTab && nextFocusedTab == parentTab)
				nextFocusedTab = this.getNextFocusedTab(parentTab);

			this.detachTab(tab, { dontUpdateIndent : true });

			if (shouldCloseParentTab) {
				this.Deferred.next(function() {
					if (parentTab.parentNode)
						b.removeTab(parentTab, { animate : true });
					parentTab = null;
					b = null;
				});
			}
		}
		else if (!nextFocusedTab) {
			nextFocusedTab = this.getNextFocusedTab(tab);
		}

		if (indentModifiedTabs.length)
			this.updateTabsIndentWithDelay(indentModifiedTabs);
		this.checkTabsIndentOverflow();

		for (var i in backupAttributes)
		{
			this.setTabValue(tab, i, backupAttributes[i]);
		}

		if (b.selectedTab == tab) {
			if (nextFocusedTab && nextFocusedTab == toBeClosedSibling)
				nextFocusedTab = this.getFirstChildTab(nextFocusedTab);
			if (
				nextFocusedTab &&
				!nextFocusedTab.hidden
				) {
				let event = d.createEvent('Events');
				event.initEvent(this.kEVENT_TYPE_FOCUS_NEXT_TAB, true, true);
				let canFocus = tab.dispatchEvent(event);

				// for backward compatibility
				event = d.createEvent('Events');
				event.initEvent(this.kEVENT_TYPE_FOCUS_NEXT_TAB.replace(/^nsDOM/, ''), true, true);
				canFocus = canFocus && tab.dispatchEvent(event);

				if (canFocus) {
					this._focusChangedByCurrentTabRemove = true;
					b.selectedTab = nextFocusedTab;
				}
			}
		}

		this.updateLastScrollPosition();

		this.destroyTab(tab);

		if (tab.getAttribute('pinned') == 'true')
			this.positionPinnedTabsWithDelay();

		if (this.getPref('browser.tabs.autoHide'))
			this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_SHOWHIDE_TABBAR);

		if (this.canStackTabs)
			this.updateTabsZIndex(true);

		if (collapsed)
			this.startRendering();

		this.saveTreeStructureWithDelay();
	},
	_reserveCloseNeedlessGroupTabSibling : function TSTBrowser_reserveCloseNeedlessGroupTabSibling(aTab)
	{
		if (!aTab)
			return null;

		var parent = this.getParentTab(aTab);
		var siblings = this.getSiblingTabs(aTab);
		var groupTabs = siblings.filter(function(aTab) {
				return this.isGroupTab(aTab);
			}, this);
		var groupTab = (
				groupTabs.length == 1 &&
				siblings.length == 1 &&
				this.hasChildTabs(groupTabs[0])
				) ? groupTabs[0] : null ;

		if (groupTab) {
			this.window.setTimeout(function(aSelf, aGroupTab) {
				aSelf.getTabBrowserFromChild(aGroupTab).removeTab(aGroupTab, { animate : true });
			}, 0, this, groupTab);
			return groupTab;
		}

		return null;
	},
	getNextFocusedTab : function TSTBrowser_getNextFocusedTab(aTab)
	{
		return this.getNextSiblingTab(aTab) ||
				this.getPreviousVisibleTab(aTab);
	},
 
	onTabsRemoving : function TSTBrowser_onTabsRemoving(aEvent) 
	{
		var tabs = aEvent.tabs || aEvent.getData('tabs');
		var b = this.getTabBrowserFromChild(tabs[0]);

		var trees = this.splitTabsToSubtrees(tabs);
		if (trees.some(function(aTabs) {
				return aTabs.length > 1 &&
						!this.fireTabSubtreeClosingEvent(aTabs[0], aTabs);
			}, this))
			return false;

		trees.forEach(function(aTabs) {
			this.markAsClosedSet(aTabs);
		}, this);

		var self = this;
		this.Deferred.next(function() {
			trees.forEach(function(aTabs) {
				self.fireTabSubtreeClosedEvent(b, aTabs[0], aTabs);
			});
		});

		return true;
	},
 
	onTabMove : function TSTBrowser_onTabMove(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.mTabBrowser;
		tab.__treestyletab__previousPosition = aEvent.detail;

		// When the tab was moved before TabOpen event is fired, we have to update manually.
		var newlyOpened = !this.isTabInitialized(tab) && this.onTabAdded(null, tab);

		// twisty vanished after the tab is moved!!
		this.initTabContents(tab);

		if (this.hasChildTabs(tab) && !this.subTreeMovingCount) {
			this.moveTabSubtreeTo(tab, tab._tPos);
		}

		var parentTab = this.getParentTab(tab);
		if (parentTab && !this.subTreeChildrenMovingCount) {
			this.updateChildrenArray(parentTab);
		}

		this.updateTabsCount(tab, true);

		var prev = this.getPreviousSiblingTab(tab);
		var next = this.getNextSiblingTab(tab);

		if (prev) {
			this.setTabValue(prev, this.kINSERT_BEFORE, tab.getAttribute(this.kID));
			this.setTabValue(tab, this.kINSERT_AFTER, prev.getAttribute(this.kID));
		}
		else
			this.deleteTabValue(tab, this.kINSERT_AFTER);

		if (next) {
			this.setTabValue(next, this.kINSERT_AFTER, tab.getAttribute(this.kID));
			this.setTabValue(tab, this.kINSERT_BEFORE, next.getAttribute(this.kID));
		}
		else
			this.deleteTabValue(tab, this.kINSERT_BEFORE);

		var old = aEvent.detail;
		if (old > tab._tPos) old--;
		var tabs = this.getAllTabsArray(b);
		old = tabs[old];

		prev = this.getPreviousSiblingTab(old);
		next = this.getNextSiblingTab(old);

		if (prev) {
			this.setTabValue(prev, this.kINSERT_BEFORE, old.getAttribute(this.kID));
			this.setTabValue(old, this.kINSERT_AFTER, prev.getAttribute(this.kID));
		}
		else
			this.deleteTabValue(old, this.kINSERT_AFTER);

		if (next) {
			this.setTabValue(next, this.kINSERT_AFTER, old.getAttribute(this.kID));
			this.setTabValue(old, this.kINSERT_BEFORE, next.getAttribute(this.kID));
		}
		else
			this.deleteTabValue(old, this.kINSERT_BEFORE);

		this.positionPinnedTabsWithDelay();

		if (this.canStackTabs)
			this.updateTabsZIndex(true);

		this.saveTreeStructureWithDelay();

		if (
			this.subTreeMovingCount ||
			this.internallyTabMovingCount ||
			// We don't have to fixup tree structure for a NEW TAB
			// which has already been structured.
			(newlyOpened && this.getParentTab(tab))
			)
			return;

		this.attachTabFromPosition(tab, aEvent.detail);
		this.rearrangeTabViewItems(tab);
	},
	
	attachTabFromPosition : function TSTBrowser_attachTabFromPosition(aTab, aOldPosition) 
	{
		var parent = this.getParentTab(aTab);

		if (aOldPosition === void(0)) aOldPosition = aTab._tPos;

		var pos = this.getChildIndex(aTab, parent);
		var oldPos = this.getChildIndex(this.getAllTabsArray(this.mTabBrowser)[aOldPosition], parent);
		var delta;
		if (pos == oldPos) { // no move?
			return;
		}
		else if (pos < 0 || oldPos < 0) {
			delta = 2;
		}
		else {
			delta = Math.abs(pos - oldPos);
		}

		var prevTab = this.getPreviousTab(aTab);
		var nextTab = this.getNextTab(aTab);

		var tabs = this.getDescendantTabs(aTab);
		if (tabs.length) {
			nextTab = this.getNextTab(tabs[tabs.length-1]);
		}

		var prevParent = this.getParentTab(prevTab);
		var nextParent = this.getParentTab(nextTab);

		var prevLevel  = prevTab ? Number(prevTab.getAttribute(this.kNEST)) : -1 ;
		var nextLevel  = nextTab ? Number(nextTab.getAttribute(this.kNEST)) : -1 ;

		var newParent;

		if (!prevTab) { // moved to topmost position
			newParent = null;
		}
		else if (!nextTab) { // moved to last position
			newParent = (delta > 1) ? prevParent : parent ;
		}
		else if (prevParent == nextParent) { // moved into existing tree
			newParent = prevParent;
		}
		else if (prevLevel > nextLevel) { // moved to end of existing tree
			if (this.mTabBrowser.selectedTab != aTab) { // maybe newly opened tab
				newParent = prevParent;
			}
			else { // maybe drag and drop
				var realDelta = Math.abs(aTab._tPos - aOldPosition);
				newParent = realDelta < 2 ? prevParent : (parent || nextParent) ;
			}
		}
		else if (prevLevel < nextLevel) { // moved to first child position of existing tree
			newParent = parent || nextParent;
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
		var tab = aEvent.originalTarget;
		if (this.tabViewHiding) {
			this.updateInvertedTabContentsOrder(aEvent.originalTarget);

			if (this.tabVisibilityChangedTimer) {
				this.window.clearTimeout(this.tabVisibilityChangedTimer);
				this.tabVisibilityChangedTimer = null;
			}
			this.tabVisibilityChangedTabs.push(tab);
			this.tabVisibilityChangedTimer = this.window.setTimeout(function(aSelf) {
				aSelf.tabVisibilityChangedTimer = null;
				var tabs = aSelf.tabVisibilityChangedTabs;
				aSelf.tabVisibilityChangedTabs = [];
				aSelf.updateTreeByTabVisibility(tabs);
			}, 0, this);
		}
		else if (aEvent.type == 'TabHide') {
			this.subtreeFollowParentAcrossTabGroups(tab);
		}
	},
	tabVisibilityChangedTimer : null,
	updateTreeByTabVisibility : function TSTBrowser_updateTreeByTabVisibility(aChangedTabs)
	{
		this.internallyTabMovingCount++;

		var allTabs = this.getAllTabsArray(this.mTabBrowser);
		var normalTabs = allTabs.filter(function(aTab) {
							return !aTab.hasAttribute('pinned');
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
		for each (let tab in normalTabs)
		{
			let parent = this.getParentTab(tab);
			let attached = false;
			if (parent && (tab.hidden != parent.hidden)) {
				let ancestor = parent;
				let lastNextTab = null;
				while (ancestor = this.getParentTab(ancestor))
				{
					if (ancestor.hidden == tab.hidden) {
						this.attachTabTo(tab, ancestor, {
							dontMove     : true,
							insertBefore : lastNextTab
						});
						attached = true;
						break;
					}
					lastNextTab = this.getNextSiblingTab(ancestor);
				}
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
	tabViewTreeIsMoving : false,
	subtreeFollowParentAcrossTabGroups : function TSTBrowser_subtreeFollowParentAcrossTabGroups(aParent)
	{
		if (this.tabViewTreeIsMoving) return;
		let item = aParent._tabViewTabItem;
		if (!item) return;
		let group = item.parent;
		if (!group) return;

		this.tabViewTreeIsMoving = true;
		this.internallyTabMovingCount++;
		let w = this.window;
		let b = this.mTabBrowser;
		let lastCount = this.getAllTabs(b).snapshotLength - 1;
		w.setTimeout(function(aSelf) {
			aSelf.detachTab(aParent);
			b.moveTabTo(aParent, lastCount);
			let descendantTabs = aSelf.getDescendantTabs(aParent);
			descendantTabs.forEach(function(aTab) {
				w.TabView.moveTabTo(aTab, group.id);
				b.moveTabTo(aTab, lastCount);
			});
			aSelf.internallyTabMovingCount--;
			aSelf.tabViewTreeIsMoving = false;
		}, 0, this);
	},
 
	onTabRestoring : function TSTBrowser_onTabRestoring(aEvent) 
	{
		this.restoreStructure(aEvent.originalTarget);

		/**
		 * Updating of the counter which is used to know how many tabs were
		 * restored in a time.
		 */
		this.windowService.restoringCount++;
		/**
		 * By nsSessionStore.js, the next "SSTabRestoring" event will be fined
		 * with "window.setTimeout()" following this "SSTabRestoring" event.
		 * So, we have to do "setTimeout()" twice, instead of "Deferred.next()".
		 */
		var self = this;
		this.window.setTimeout(function() {
			/**
			 * On this timing, the next "SSTabRestoring" is not fired yet.
			 * We only register the countdown task for the next event loop.
			 */
			self.windowService.Deferred.next(function() {
				/**
				 * On this timing, the next "SSTabRestoring" was fired.
				 * Now we can decrement the counter.
				 */
				self.windowService.restoringCount--;
			});
		}, 0);

		if (!aEvent.originalTarget.selected &&
			this.mTabBrowser.currentURI.spec == 'about:sessionrestore') {
			let frame = this.mTabBrowser.contentWindow;
			frame = frame.wrappedJSObject || frame;
			let tree = frame.document.getElementById('tabList');
			let data = frame.gTreeData;
			if (tree && data) {
				let item = data[tree.currentIndex];
				this.window.setTimeout(function(aSelf, aTab, aTitle, aParent) {
					if (aTab.label== aTitle)
						aSelf.attachTabTo(aTab, aParent);
				}, 0, this, aEvent.originalTarget, item.label, this.mTabBrowser.selectedTab);
			}
		}
	},
	
	RESTORED_TREE_COLLAPSED_STATE_LAST_STATE : -1,
	RESTORED_TREE_COLLAPSED_STATE_COLLAPSED  : 0,
	RESTORED_TREE_COLLAPSED_STATE_EXPANDED   : 1,
	restoreStructure : function TSTBrowser_restoreStructure(aTab) 
	{
		var [id, mayBeDuplicated] = this._restoreTabId(aTab);

		var structureRestored = aTab.__treestyletab__structureRestored;
		delete aTab.__treestyletab__structureRestored;

		var children = this.getTabValue(aTab, this.kCHILDREN);
		if (
			!structureRestored &&
			(
				!mayBeDuplicated ||
				aTab.getAttribute(this.kCHILDREN) != children
			)
			) {
			// for safety
			this.detachAllChildren(aTab, {
				dontUpdateIndent : true,
				dontAnimate      : this.windowService.restoringTree
			});
		}

		var closeSetId = !structureRestored && this._restoreCloseSetId(aTab, mayBeDuplicated);

		this.setTabValue(aTab, this.kID, id);
		this.tabsHash[id] = aTab;

		if (structureRestored) {
			[
				this.kPARENT,
				this.kCHILDREN,
				this.kINSERT_BEFORE,
				this.kINSERT_AFTER,
				this.kSUBTREE_COLLAPSED,
				this.kCOLLAPSED,
				this.kCOLLAPSED_DONE
			].forEach(function(aKey) {
				this.setTabValue(aTab, aKey, this.getTabValue(aTab, aKey));
			}, this);
		}
		else {
			if (closeSetId)
				this.restoreClosedSet(closeSetId, aTab);

			let isSubtreeCollapsed = this._restoreSubtreeCollapsedState(aTab);

			let childTabs = this._restoreChildTabsRelation(aTab, children, mayBeDuplicated);

			this._restoreTabPositionAndIndent(aTab, childTabs, mayBeDuplicated);

			if (isSubtreeCollapsed)
				this.collapseExpandSubtree(aTab, isSubtreeCollapsed);
		}

		if (mayBeDuplicated)
			this.clearRedirectionTable();
	},
	_restoreTabId : function TSTBrowser_restoreTabId(aTab)
	{
		var id = this.getTabValue(aTab, this.kID);
		var mayBeDuplicated = false;

		aTab.setAttribute(this.kID_RESTORING, id);
		if (this.isTabDuplicated(aTab)) {
			mayBeDuplicated = true;
			/**
			 * If the tab has its ID as the attribute, then we should use it
			 * instead of redirected ID, because the tab has been possibly
			 * attached to another tab.
			 */
			id = aTab.getAttribute(this.kID) || this.redirectId(id);
		}
		aTab.removeAttribute(this.kID_RESTORING);

		return [id, mayBeDuplicated];
	},
	_restoreCloseSetId : function TSTBrowser_restoreCloseSetId(aTab, aMayBeDuplicated)
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
	_restoreSubtreeCollapsedState : function TSTBrowser_restoreSubtreeCollapsedState(aTab)
	{
		var shouldCollapse = this.getTreePref('collapseExpandSubtree.sessionRestore');
		var isSubtreeCollapsed = (
				this.windowService.restoringTree &&
				(
					shouldCollapse == this.RESTORED_TREE_COLLAPSED_STATE_LAST_STATE ?
						(this.getTabValue(aTab, this.kSUBTREE_COLLAPSED) == 'true') :
						shouldCollapse == this.RESTORED_TREE_COLLAPSED_STATE_COLLAPSED
				)
			);
		this.setTabValue(aTab, this.kSUBTREE_COLLAPSED, isSubtreeCollapsed);
		return isSubtreeCollapsed;
	},
	_restoreChildTabsRelation : function TSTBrowser_restoreChildTabsRelation(aTab, aChildrenList, aMayBeDuplicated)
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

		var restoringMultipleTabs = this.windowService.restoringTree;
		aChildrenList.forEach(function(aChildTab) {
			if (aChildTab && (aChildTab = this.getTabById(aChildTab))) {
				this.attachTabTo(aChildTab, aTab, {
					dontExpand       : restoringMultipleTabs,
					dontUpdateIndent : true,
					dontAnimate      : restoringMultipleTabs
				});
				childTabs.push(aChildTab);
			}
		}, this);
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
		if (next && aMayBeDuplicated) next = this.redirectId(next);
		next = this.getTabById(next);

		if (!next) {
			let prev = this.getTabValue(aTab, this.kINSERT_AFTER);
			if (prev && aMayBeDuplicated) prev = this.redirectId(prev);
			prev = this.getTabById(prev);
			next = this.getNextSiblingTab(prev);
		}

		var ancestors = (this.getTabValue(aTab, this.kANCESTOR) || this.getTabValue(aTab, this.kPARENT)).split('|');
		var parent = null;
		for (let i in ancestors)
		{
			if (aMayBeDuplicated) ancestors[i] = this.redirectId(ancestors[i]);
			parent = this.getTabById(ancestors[i]);
			if (parent) {
				parent = ancestors[i];
				break;
			}
		}
		this.deleteTabValue(aTab, this.kANCESTOR);

		/**
		 * If the tab is a duplicated and the tab has already been
		 * attached, then reuse current status based on attributes.
		 * (Note, if the tab is not a duplicated tab, all attributes
		 * have been cleared.)
		 */
		if (!parent) {
			parent = aTab.getAttribute(this.kPARENT);
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
		if (!aNextTab) aNextTab = this.getNextTab(aTab);
		var parentOfNext = this.getParentTab(aNextTab);
		var newPos = -1;
		if (parentOfNext) {
			let descendants = this.getDescendantTabs(parentOfNext);
			newPos = descendants[descendants.length-1]._tPos;
		}
		else if (aNextTab) {
			newPos = aNextTab._tPos;
			if (newPos > aTab._tPos) newPos--;
		}
		if (newPos > -1)
			this.mTabBrowser.moveTabTo(aTab, newPos);
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
		var restoringChildren = aTab.getAttribute(this.kCHILDREN_RESTORING);
		if (!restoringChildren) return;

		var children = aTab.getAttribute(this.kCHILDREN);
		if (restoringChildren != children) {
			var restoringChildrenIDs = restoringChildren.split('|');
			restoringChildrenIDs.reverse().forEach(function(aChild, aIndex) {
				aChild = this.getTabById(aChild);
				if (!aChild) return;

				let nextTab = aIndex > 0 ?
							this.getTabById(restoringChildrenIDs[aIndex-1]) :
							this.getNextSiblingTab(aTab) ;
				if (nextTab == this.getNextSiblingTab(aChild)) return;

				let newPos = -1;
				if (nextTab) {
					newPos = nextTab._tPos;
					if (newPos > aChild._tPos) newPos--;
				}
				if (newPos > -1)
					this.moveTabSubtreeTo(aChild, newPos);
			}, this);
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
 
	clearRedirectionTable : function TSTBrowser_clearRedirectionTable() 
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
 
	restoreClosedSet : function TSTBrowser_restoreClosedSet(aId, aRestoredTab) 
	{
		var behavior = this.undoCloseTabSetBehavior;
		if (
			aRestoredTab.__treestyletab__restoredByUndoCloseTab ||
			!this.browser.__treestyletab__readyToUndoCloseTab ||
			this.windowService.useTMPSessionAPI ||
			this._restoringClosedSet ||
			!(behavior & this.kUNDO_CLOSE_SET || behavior & this.kUNDO_ASK)
			)
			return;

		var items = this.evalInSandbox('('+this.SessionStore.getClosedTabData(this.window)+')');
		var indexes = [];
		items.forEach(function(aItem, aIndex) {
			if (aItem.state.extData &&
				aItem.state.extData[this.kCLOSED_SET_ID] &&
				aItem.state.extData[this.kCLOSED_SET_ID] == aId)
				indexes.push(aIndex);
		}, this);

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
			aRestoredTab.addEventListener('SSTabRestored', function(aEvent) {
				aRestoredTab.removeEventListener(aEvent.type, arguments.callee, false);
				self.askUndoCloseTabSetBehavior(aRestoredTab, indexes.length)
					.next(function(aBehavior) {
						if (aBehavior & self.kUNDO_CLOSE_SET)
							self.doRestoreClosedSet(aRestoredTab, indexes);
					});
			}, false);
		}
		else if (behavior & this.kUNDO_CLOSE_SET) {
			this.doRestoreClosedSet(aRestoredTab, indexes);
		}
	},
	doRestoreClosedSet : function TSTBrowser_doRestoreClosedSet(aRestoredTab, aIndexes)
	{
		if (!this.window.PlacesUIUtils._confirmOpenInTabs(aIndexes.length))
			return;

		this._restoringClosedSet = true;
		this.stopRendering();

		this.windowService.restoringTree = true;

		var offset = 0;
		aIndexes.forEach(function(aIndex) {
			undoCloseTab(aIndex - (offset++));
		});

		this.window.setTimeout(function(aSelf, aNextFocused) {
			aSelf.mTabBrowser.selectedTab = aNextFocused;
		}, 0, this, aRestoredTab || aSelf.mTabBrowser.selectedTab);

		this.startRendering();
		this._restoringClosedSet = false;
	},
	_restoringClosedSet : false,
  
	onTabRestored : function TSTBrowser_onTabRestored(aEvent) 
	{
		delete aEvent.originalTarget.__treestyletab__restoredByUndoCloseTab;
	},
 
	onPinTab : function TSTBrowser_onPinTab(aTab) 
	{
		var parentTab = this.getParentTab(aTab);

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
			this.getDescendantTabs(aTab).reverse().forEach(function(aChildTab) {
				if (aChildTab.__treestyletab__previousPosition > aChildTab._tPos)
					b.moveTabTo(aChildTab, aChildTab.__treestyletab__previousPosition);
			}, this);
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
			this.getChildTabs(aTab).reverse().forEach(function(aChildTab) {
				if (aChildTab._tPos < parentTab._tPos)
					b.moveTabTo(aChildTab, parentTab._tPos);
			}, this);
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
		if (this.isVertical) this.positionPinnedTabsWithDelay();
	},
 
	onUnpinTab : function TSTBrowser_onUnpinTab(aTab) 
	{
		var style = aTab.style;
		style.marginLeft = style.marginRight = style.marginTop = '';

		this.updateInvertedTabContentsOrder(aTab);
		if (this.isVertical) this.positionPinnedTabsWithDelay();
	},
 
	onDOMAttrModified : function TSTBrowser_onDOMAttrModified(aEvent) 
	{
		switch (aEvent.attrName)
		{
			case 'pinned':
				let (tab = aEvent.originalTarget) {
					if (tab.localName != 'tab')
						return;

					if (aEvent.newValue == 'true')
						this.onPinTab(tab);
					else
						this.onUnpinTab(tab);
				}
				return;

			default:
				return;
		}
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

		if (this.isCollapsed(tab)) {
			if (this.getTreePref('autoExpandSubtreeOnCollapsedChildFocused')) {
				let parentTab = tab;
				while (parentTab = this.getParentTab(parentTab))
				{
					this.collapseExpandSubtree(parentTab, false);
				}
				this.collapseExpandTreesIntelligentlyWithDelayFor(tab);
			}
			else {
				b.selectedTab = this.getRootTab(tab);
			}
		}
		else if (
				this.getTreePref('autoCollapseExpandSubtreeOnSelect') &&
				(
					!this._focusChangedByCurrentTabRemove ||
					this.getTreePref('autoCollapseExpandSubtreeOnSelect.onCurrentTabRemove')
				)
				) {
			if (!this.hasChildTabs(tab) || !this.isSubtreeCollapsed(tab))
				tab = null;

			let event = this.windowService.arrowKeyEventOnTab;
			let byArrowKey = event && event.advanceFocus;
			let byShortcut = this._focusChangedByShortcut && this.windowService.accelKeyPressed;
			if (!byArrowKey) {
				if (byShortcut) {
					if (!this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut')) {
						this.windowService.expandTreeAfterKeyReleased(tab);
					}
					else {
						let delay = this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay');
						if (delay > 0) {
							this._autoExpandOnTabSelectTimer = this.window.setTimeout(function(aSelf) {
								if (tab && tab.parentNode)
									aSelf.collapseExpandTreesIntelligentlyWithDelayFor(tab);
							}, delay, this);
						}
						else {
							this.collapseExpandTreesIntelligentlyWithDelayFor(tab);
						}
					}
				}
				else {
					this.collapseExpandTreesIntelligentlyWithDelayFor(tab);
				}
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
 
	handleAdvanceSelectedTab : function TSTBrowser_handleAdvanceSelectedTab(aDir, aWrap) 
	{
		this._focusChangedByShortcut = this.windowService.accelKeyPressed;

		if (!this.canCollapseSubtree(this.mTabBrowser.selectedTab) ||
			this.getTreePref('focusMode') != this.kFOCUS_VISIBLE)
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
				if (this.getTreePref('tabbar.invertTab')) {
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
		var tabbar = this.mTabBrowser.mTabContainer;

		var nextTab = (aDir < 0) ? this.getPreviousVisibleTab(tab) : this.getNextVisibleTab(tab) ;
		if (!nextTab && aWrap) {
			nextTab = this.evaluateXPath(
					'child::xul:tab[not(@'+this.kCOLLAPSED+'="true")]['+
					(aDir < 0 ? 'last()' : '1' )+
					']',
					tabbar,
					Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
				).singleNodeValue;
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
				this.collapseExpandSubtree(aTab, aTab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');
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
	getTabFromTabbarEvent : function TSTBrowser_getTabFromTabbarEvent(aEvent)
	{
		if (
			!this.shouldDetectClickOnIndentSpaces ||
			!this.getAncestorTabbarFromEvent(aEvent) ||
			this.isEventFiredOnClickable(aEvent) ||
			this.getSplitterFromEvent(aEvent)
			)
			return null;

		var tab = null;
		var clickedPoint = aEvent[this.screenPositionProp];
		this.getTabsArray(this.mTabBrowser).some(function(aTab) {
			var box = aTab.boxObject;
			if (box[this.screenPositionProp] > clickedPoint ||
				box[this.screenPositionProp] + box[this.sizeProp] < clickedPoint) {
				return false;
			}
			tab = aTab;
			return true;
		}, this);
		return tab;
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
			if (tab) this.mTabBrowser.selectedTab = tab;
		}
	},
 
	onDblClick : function TSTBrowser_onDblClick(aEvent) 
	{
		let tab = this.getTabFromEvent(aEvent);
		if (tab &&
			this.hasChildTabs(tab) &&
			this.getTreePref('collapseExpandSubtree.dblclick')) {
			this.collapseExpandSubtree(tab, tab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');
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
		var tabs = this.mTabBrowser.mTabContainer;
		var horizontal = tabs.orient == 'horizontal';
		if (horizontal) return;
		aEvent.stopPropagation();
		this.positionPinnedTabsWithDelay();
		if (aEvent.detail == 1) return;
		if (aEvent.type == 'overflow') {
			tabs.setAttribute('overflow', 'true');
			this.scrollBoxObject.ensureElementIsVisible(tabs.selectedItem);
		}
		else {
			tabs.removeAttribute('overflow');
		}
	},
 
	onResize : function TSTBrowser_onResize(aEvent) 
	{
		if (
			!aEvent.originalTarget ||
			!(aEvent.originalTarget instanceof Ci.nsIDOMWindow)
			)
			return;

		this.mTabBrowser.mTabContainer.adjustTabstrip();
		this.updateInvertedTabContentsOrder(true);
		this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_WINDOW_RESIZE);
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

		[
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
		].forEach(function(aID) {
			let item = this.evaluateXPath(
				'descendant::xul:*[starts-with(@id, "'+aID+'")]',
				aEvent.currentTarget,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
			if (!item) return;
			items[aID] = item;
			if (this.getTreePref('show.'+aID))
				item.removeAttribute('hidden');
			else
				item.setAttribute('hidden', true);
			switch (aID)
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
					break;
				default:
					break;
			}
		}, this);

		// collapse/expand all
		sep = this.evaluateXPath(
			'descendant::xul:menuseparator[starts-with(@id, "'+this.kMENUITEM_COLLAPSEEXPAND_SEPARATOR+'")]',
			aEvent.currentTarget,
			Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		let collapseItem = items[this.kMENUITEM_COLLAPSE];
		let expandItem = items[this.kMENUITEM_EXPAND];
		if (this.canCollapseSubtree(b) &&
			this.evaluateXPath(
				'child::xul:tab[@'+this.kCHILDREN+']',
				b.mTabContainer
			).snapshotLength) {
			if (collapseItem) {
				if (this.evaluateXPath(
						'child::xul:tab[@'+this.kCHILDREN+' and not(@'+this.kSUBTREE_COLLAPSED+'="true")]',
						b.mTabContainer
					).snapshotLength)
					collapseItem.removeAttribute('disabled');
				else
					collapseItem.setAttribute('disabled', true);
			}

			if (expandItem) {
				if (this.evaluateXPath(
						'child::xul:tab[@'+this.kCHILDREN+' and @'+this.kSUBTREE_COLLAPSED+'="true"]',
						b.mTabContainer
					).snapshotLength)
					expandItem.removeAttribute('disabled');
				else
					expandItem.setAttribute('disabled', true);
			}
		}
		else {
			if (collapseItem) collapseItem.setAttribute('hidden', true);
			if (expandItem) expandItem.setAttribute('hidden', true);
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

		sep = this.evaluateXPath(
			'descendant::xul:menuseparator[starts-with(@id, "'+this.kMENUITEM_AUTOHIDE_SEPARATOR+'")]',
			aEvent.currentTarget,
			Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
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
	},
  
	onTabsOnTopSyncCommand : function TSTBrowser_onTabsOnTopSyncCommand(aEnabled) 
	{
		if (
			!aEnabled ||
			this.position != 'top' ||
			this.fixed
			)
			return;
		var self = this;
		this.Deferred
			.next(function() {
				self.windowService.toggleFixed(self.mTabBrowser);
			})
			.next(function() {
				if (self.window.TabsOnTop.enabled != aEnabled)
					self.window.TabsOnTop.enabled = aEnabled;
			});
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
	
	resetTab : function TSTBrowser_resetTab(aTab, aPartChildren) 
	{
		if (aPartChildren)
			this.detachAllChildren(aTab, {
				dontUpdateIndent : true,
				dontAnimate      : true
			});

		this.detachTab(aTab, {
			dontUpdateIndent : true,
			dontAnimate      : true
		});

		/* reset attributes before restoring */
		aTab.removeAttribute(this.kID);
		aTab.removeAttribute(this.kPARENT);
		aTab.removeAttribute(this.kCHILDREN);
		aTab.removeAttribute(this.kSUBTREE_COLLAPSED);
		aTab.removeAttribute(this.kCOLLAPSED);
		aTab.removeAttribute(this.kCOLLAPSED_DONE);
		aTab.removeAttribute(this.kNEST);
		this.updateTabsIndent([aTab], undefined, true);
	},
 
	resetAllTabs : function TSTBrowser_resetAllTabs(aPartChildren) 
	{
		this.getAllTabsArray(this.mTabBrowser).forEach(function(aTab) {
			this.resetTab(aTab, aPartChildren);
		}, this);
	},
 
	resetTabbarSize : function TSTBrowser_resetTabbarSize() 
	{
		if (this.isVertical) {
			this.clearTreePref('tabbar.shrunkenWidth');
			this.clearTreePref('tabbar.width');
		}
		else {
			this.clearTreePref('tabbar.height');
			if (this.isFloating) {
				let tabContainerBox = this.getTabContainerBox(this.mTabBrowser);
				tabContainerBox.removeAttribute('height');
				this._tabStripPlaceHolder.height = tabContainerBox.boxObject.height;
			}
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
			if (this._lastAllowSubtreeCollapseExpand)
				this.allowSubtreeCollapseExpand = true;
			delete this._lastAllowSubtreeCollapseExpand;

			this.getAllTabsArray(this.browser).forEach(function(aTab) {
				if (aTab._TSTLastSubtreeCollapsed)
					this.collapseExpandSubtree(aTab, true, true);
				delete aTab._TSTLastSubtreeCollapsed;
				this.updateTabIndent(aTab, 0, true);
			}, this);
			this.updateTabsIndent(this.rootTabs, undefined, true);
		}
		else {
			this.getAllTabsArray(this.browser).forEach(function(aTab) {
				this.updateTabIndent(aTab, 0, true);
				aTab._TSTLastSubtreeCollapsed = this.isSubtreeCollapsed(aTab);
				this.collapseExpandSubtree(aTab, false, true);
			}, this);

			this._lastAllowSubtreeCollapseExpand = this.allowSubtreeCollapseExpand;
			this.allowSubtreeCollapseExpand = false;
		}
		return aValue;
	},
//	_treeViewEnabled : true,
  
/* attach/detach */ 
	
	attachTabTo : function TSTBrowser_attachTabTo(aChild, aParent, aInfo) /* PUBLIC API */ 
	{
		aInfo = aInfo || {};

		if (aParent && this.maxTreeLevelPhisical && this.maxTreeLevel > -1) {
			let level = parseInt(aParent.getAttribute(this.kNEST) || 0) + 1;
			while (aParent && level > this.maxTreeLevel)
			{
				level--;
				aParent = this.getParentTab(aParent);
			}
		}

		var currentParent;
		if (
			!aChild ||
			!aParent ||
			aChild == aParent ||
			(currentParent = this.getParentTab(aChild)) == aParent ||
			aChild.getAttribute('pinned') == 'true' ||
			aParent.getAttribute('pinned') == 'true'
			) {
			this.fireAttachedEvent(aChild, aParent);
			return;
		}

		currentParent = aParent;
		do {
			if (currentParent != aChild) continue;
			// this.fireAttachedEvent(aChild, aParent);
			return;
		}
		while (currentParent = this.getParentTab(currentParent));

		shouldInheritIndent = (
			!currentParent ||
			(currentParent.getAttribute(this.kNEST) == aParent.getAttribute(this.kNEST))
		);

		this.ensureTabInitialized(aChild);
		this.ensureTabInitialized(aParent);

		if (!aInfo) aInfo = {};

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
		if (oldIndex > -1) children.splice(oldIndex, 1);

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

		this.updateTabsCount(aParent);
		if (shouldInheritIndent && !aInfo.dontUpdateIndent)
			this.inheritTabIndent(aChild, aParent);

		if (!aInfo.dontMove) {
			if (newIndex > aChild._tPos) newIndex--;
			this.moveTabSubtreeTo(aChild, newIndex);
		}

		if (aInfo.forceExpand) {
			this.collapseExpandSubtree(aParent, false, aInfo.dontAnimate);
		}
		else if (!aInfo.dontExpand) {
			if (this.getTreePref('autoCollapseExpandSubtreeOnSelect')) {
				if (this.shouldTabAutoExpanded(aParent))
					this.collapseExpandTreesIntelligentlyFor(aParent);
				let p = aParent;
				do {
					if (this.shouldTabAutoExpanded(p))
						this.collapseExpandSubtree(p, false, aInfo.dontAnimate);
				}
				while (p = this.getParentTab(p));
			}
			else if (this.shouldTabAutoExpanded(aParent)) {
				if (this.getTreePref('autoExpandSubtreeOnAppendChild')) {
					let p = aParent;
					do {
						if (this.shouldTabAutoExpanded(p))
							this.collapseExpandSubtree(p, false, aInfo.dontAnimate);
					}
					while (p = this.getParentTab(p));
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

		this.saveTreeStructureWithDelay();

		this.fireAttachedEvent(aChild, aParent);
	},
	fireAttachedEvent : function TSTBrowser_fireAttachedEvent(aChild, aParent)
	{
		var data = {
				parentTab : aParent
			};

		/* PUBLIC API */
		this.fireDataContainerEvent(this.kEVENT_TYPE_ATTACHED, aChild, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_ATTACHED.replace(/^nsDOM/, ''), aChild, true, false, data);
	},
	
	shouldTabAutoExpanded : function TSTBrowser_shouldTabAutoExpanded(aTab) 
	{
		return this.hasChildTabs(aTab) &&
				this.isSubtreeCollapsed(aTab);
	},
  
	detachTab : function TSTBrowser_detachTab(aChild, aInfo) /* PUBLIC API */ 
	{
		if (!aChild) return;
		if (!aInfo) aInfo = {};

		var parentTab = this.getParentTab(aChild);
		if (!parentTab) return;

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

		this.updateTabsCount(parentTab);

		if (!aInfo.dontUpdateIndent) {
			this.updateTabsIndent([aChild], undefined, aInfo.dontAnimate);
			this.checkTabsIndentOverflow();
		}

		this.saveTreeStructureWithDelay();

		var data = {
				parentTab : parentTab
			};

		/* PUBLIC API */
		this.fireDataContainerEvent(this.kEVENT_TYPE_DETACHED, aChild, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_DETACHED.replace(/^nsDOM/, ''), aChild, true, false, data);

		if (this.isGroupTab(parentTab) && !this.hasChildTabs(parentTab)) {
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
		aInfo = aInfo || {};
		if (!('behavior' in aInfo))
			aInfo.behavior = this.kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN;
		if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
			aInfo.behavior = this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

		var b = this.mTabBrowser;
		var parentTab = this.getParentTab(aTab);
		var children = this.getChildTabs(aTab);

		if (
			this.isGroupTab(aTab) &&
			this.getTabsArray(b).filter(function(aTab) {
				return !b._removingTabs || b._removingTabs.indexOf(aTab) < 0;
			}).length == children.length
			) {
			aInfo.behavior = this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
			aInfo.dontUpdateIndent = false;
		}

		var insertBefore = null;
		if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN &&
			!this.getTreePref('closeParentBehavior.moveDetachedTabsToBottom')) {
			insertBefore = this.getNextSiblingTab(this.getRootTab(aTab));
		}
		children.forEach((
			aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN ?
				function(aTab) {
					this.detachTab(aTab, aInfo);
					this.moveTabSubtreeTo(aTab, insertBefore ? insertBefore._tPos - 1 : this.getLastTab(b)._tPos );
				} :
			aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD ?
				function(aTab, aIndex) {
					this.detachTab(aTab, aInfo);
					if (aIndex == 0) {
						if (parentTab) {
							this.attachTabTo(aTab, parentTab, {
								__proto__  : aInfo,
								dontExpand : true,
								dontMove   : true
							});
						}
						this.collapseExpandSubtree(aTab, false);
						this.deleteTabValue(aTab, this.kSUBTREE_COLLAPSED);
					}
					else {
						this.attachTabTo(aTab, children[0], {
							__proto__  : aInfo,
							dontExpand : true,
							dontMove   : true
						});
					}
				} :
			aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN && parentTab ?
				function(aTab) {
					this.attachTabTo(aTab, parentTab, {
						__proto__  : aInfo,
						dontExpand : true,
						dontMove   : true
					});
				} :
			// aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN ?
				function(aTab) {
					this.detachTab(aTab, aInfo);
				}
		), this);
	},
	partAllChildren : function TSTBrowser_partAllChildren(aTab, aInfo) /* for backward compatibility */
	{
		return this.detachAllChildren(aTab, aInfo);
	},
 
	detachTabs : function TSTBrowser_detachTabs(aTabs) 
	{
		var aTabs = Array.slice(aTabs);
		for each (let tab in aTabs)
		{
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
		var closeParentBehavior = this.getTreePref('closeParentBehavior');
		var closeRootBehavior = this.getTreePref('closeRootBehavior');

		var parentTab = this.getParentTab(aTab);
		var behavior = aDefaultBehavior ?
							aDefaultBehavior :
						(!parentTab && closeParentBehavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN) ?
							closeRootBehavior :
							closeParentBehavior ;
		if (behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
			parentTab &&
			this.getChildTabs(parentTab).length == 1)
			behavior = this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;

		return behavior;
	},
  
	updateTabsIndent : function TSTBrowser_updateTabsIndent(aTabs, aLevel, aJustNow) 
	{
		if (!aTabs || !aTabs.length || !this._treeViewEnabled) return;

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

		Array.slice(aTabs).forEach(function(aTab) {
			if (!aTab.parentNode) return; // ignore removed tabs
			this.updateTabIndent(aTab, indent, aJustNow);
			aTab.setAttribute(this.kNEST, aLevel);
			this.updateCanCollapseSubtree(aTab, aLevel);
			this.updateTabsIndent(this.getChildTabs(aTab), aLevel+1, aJustNow);
		}, this);
	},
	updateTabsIndentWithDelay : function TSTBrowser_updateTabsIndentWithDelay(aTabs)
	{
		if (this.updateTabsIndentWithDelayTimer)
			this.window.clearTimeout(this.updateTabsIndentWithDelayTimer);

		this.updateTabsIndentWithDelayTabs = this.updateTabsIndentWithDelayTabs.concat(aTabs);
		this.updateTabsIndentWithDelayTimer = this.window.setTimeout(function(aSelf) {
			var tabs = [];
			aSelf.updateTabsIndentWithDelayTabs.forEach(function(aTab) {
				if (tabs.indexOf(aTab) < 0 && aTab.parentNode) tabs.push(aTab);
			});
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
		this.stopTabIndentAnimation(aTab);

		if (aTab.hasAttribute('pinned'))
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
			Array.slice(this.document.getAnonymousNodes(aTab)).forEach(function(aBox) {
				if (aBox.nodeType != Node.ELEMENT_NODE) return;
				aBox.setAttribute(
					'style',
					aBox.getAttribute('style').replace(/(-moz-)?border-(top|bottom)(-[^:]*)?.*:[^;]+;?/g, '') +
					'; border-'+this.indentTarget+': solid transparent '+aIndent+'px !important;'+colors
				);
			}, this);

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
		var CSSTransitionEnabled = ('Transition' in aTab.style || 'MozTransition' in aTab.style);
		if (CSSTransitionEnabled) {
			aTab.__treestyletab__updateTabIndentTask = function(aTime, aBeginning, aChange, aDuration) {
				aTab.style.setProperty(self.indentCSSProp, aIndent+'px', 'important');
				return true;
			};
			this.animationManager.addTask(
				aTab.__treestyletab__updateTabIndentTask,
				0, 0, 1, this.window
			);
			return;
		}

		var startIndent = this.getPropertyPixelValue(aTab, this.indentCSSProp);
		var delta       = aIndent - startIndent;
		var radian      = 90 * Math.PI / 180;
		aTab.__treestyletab__updateTabIndentTask = function(aTime, aBeginning, aChange, aDuration) {
			var indent, finished;
			if (aTime >= aDuration) {
				delete aTab.__treestyletab__updateTabIndentTask;
				indent = aIndent;
				finished = true;
			}
			else {
				indent = startIndent + (delta * Math.sin(aTime / aDuration * radian));
				finished = false;
			}
			aTab.style.setProperty(self.indentCSSProp, indent+'px', 'important');
			if (finished) {
				startIndent = null;
				delta = null;
				radian = null;
				self = null;
				aTab = null;
			}
			return finished;
		};
		this.animationManager.addTask(
			aTab.__treestyletab__updateTabIndentTask,
			0, 0, this.indentDuration, this.window
		);
	},
	stopTabIndentAnimation : function TSTBrowser_stopTabIndentAnimation(aTab)
	{
		this.animationManager.removeTask(
			aTab.__treestyletab__updateTabIndentTask
		);
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
 
	checkTabsIndentOverflow : function TSTBrowser_checkTabsIndentOverflow() 
	{
		if (this.checkTabsIndentOverflowTimer) {
			this.window.clearTimeout(this.checkTabsIndentOverflowTimer);
			this.checkTabsIndentOverflowTimer = null;
		}
		this.checkTabsIndentOverflowTimer = this.window.setTimeout(function(aSelf) {
			aSelf.checkTabsIndentOverflowCallback();
		}, 100, this);
	},
	checkTabsIndentOverflowTimer : null,
	checkTabsIndentOverflowCallback : function TSTBrowser_checkTabsIndentOverflowCallback()
	{
		if (!this.getTreePref('indent.autoShrink')) {
			this.indent = -1;
			return;
		}

		var b    = this.mTabBrowser;
		var tabs = this.getArrayFromXPathResult(this.evaluateXPath(
				'child::xul:tab[@'+this.kNEST+' and not(@'+this.kNEST+'="0" or @'+this.kNEST+'="")]',
				b.mTabContainer
			));
		if (!tabs.length) return;

		var self = this;
		tabs.sort(function(aA, aB) { return Number(aA.getAttribute(self.kNEST)) - Number(aB.setAttribute(self.kNEST)); });
		var nest = tabs[tabs.length-1].getAttribute(this.kNEST);
		if (this.maxTreeLevel > -1)
			nest = Math.min(nest, this.maxTreeLevel);
		if (!nest)
			return;

		var oldIndent = this.indent;
		var indent    = (oldIndent < 0 ? this.baseIndent : oldIndent ) * nest;
		var maxIndentBase = Math.min(
					this.getFirstNormalTab(b).boxObject[this.invertedSizeProp],
					b.mTabContainer.boxObject[this.invertedSizeProp]
				);
		if (!this.isVertical) {
			if (this._horizontalTabMaxIndentBase)
				maxIndentBase = this._horizontalTabMaxIndentBase;
			else
				this._horizontalTabMaxIndentBase = maxIndentBase;
		}
		var maxIndent = maxIndentBase * (this.isVertical ? 0.33 : 0.5 );

		var indentUnit = Math.max(Math.floor(maxIndent / nest), this.getTreePref('indent.min'));
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
 
	updateTabsCount : function TSTBrowser_updateTabsCount(aTab, aDontUpdateAncestor) 
	{
		var count = this.document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER);
		if (count) {
			count.setAttribute('value', this.getDescendantTabs(aTab).length + 1);
		}
		if (!aDontUpdateAncestor) {
			let parent = this.getParentTab(aTab);
			if (parent)
				this.updateTabsCount(parent);
		}
	},
 
	updateAllTabsCount : function TSTBrowser_updateAllTabsCount() 
	{
		this.rootTabs.forEach(function(aTab) {
			this.updateTabsCount(aTab, this);
		}, this);
	},
 
	promoteTooDeepLevelTabs : function TSTBrowser_promoteTooDeepLevelTabs(aParent) 
	{
		if (this.maxTreeLevel < 0 || !this.maxTreeLevelPhisical)
			return;

		var tabs = aParent ? this.getDescendantTabs(aParent) : this.getAllTabsArray(this.mTabBrowser) ;
		tabs.forEach(function(aTab) {
			var level = parseInt(aTab.getAttribute(this.kNEST) || 0);
			if (level <= this.maxTreeLevel)
				return;

			var parent = this.getParentTab(aTab);
			var newParent = this.getParentTab(parent);
			if (this.maxTreeLevel == 0 || !newParent) {
				this.detachTab(aTab);
			}
			else {
				let nextSibling = this.getNextTab(aTab);
				this.attachTabTo(aTab, newParent, {
					dontMove     : true,
					insertBefore : nextSibling
				});
			}
		}, this);
	},
  
/* move */ 
	
	moveTabSubtreeTo : function TSTBrowser_moveTabSubtreeTo(aTab, aIndex) 
	{
		if (!aTab) return;

		var b = this.mTabBrowser;
		this.subTreeMovingCount++;

		this.internallyTabMovingCount++;
		b.moveTabTo(aTab, aIndex);
		this.internallyTabMovingCount--;

		this.subTreeChildrenMovingCount++;
		this.internallyTabMovingCount++;
		this.getDescendantTabs(aTab).forEach(function(aDescendantTab, aIndex) {
			b.moveTabTo(aDescendantTab, aTab._tPos + aIndex + (aTab._tPos < aDescendantTab._tPos ? 1 : 0 ));
		}, this);
		this.internallyTabMovingCount--;
		this.subTreeChildrenMovingCount--;

		this.subTreeMovingCount--;
	},
	moveTabSubTreeTo : function() { return this.moveTabSubtreeTo.apply(this, arguments); }, // obsolete, for backward compatibility
 
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
				sourceService.getAllTabsArray(sourceBrowser).length == aTabs.length
			);
		var newTabs = [];
		var treeStructure = sourceService.getTreeStructureFromTabs(aTabs);

		// Firefox fails to "move" collapsed tabs. So, expand them first
		// and collapse them after they are moved.
		var collapsedStates = sourceService.forceExpandTabs(aTabs);;

		var shouldResetSelection = (
				aTabs.every(function(aTab) {
					return aTab.getAttribute('multiselected') == 'true';
				}) &&
				(sourceService != this || aOptions.duplicate)
			);

		var tabs = this.getTabsArray(targetBrowser);
		var lastTabIndex = tabs[tabs.length -1]._tPos;
		for (let i in aTabs)
		{
			let tab = aTabs[i];

			if (shouldResetSelection) {
				if ('MultipleTabService' in sourceWindow)
					sourceWindow.MultipleTabService.setSelection(tab, false);
				else
					tab.removeAttribute('multiselected');
			}

			if (aOptions.duplicate) {
				tab = this.duplicateTabAsOrphan(tab);
				newTabs.push(tab);
			}
			else if (sourceService != this) {
				tab = this.importTab(tab);
				newTabs.push(tab);
			}

			if (shouldResetSelection) {
				if ('MultipleTabService' in sourceWindow)
					sourceWindow.MultipleTabService.setSelection(tab, true);
				else
					tab.setAttribute('multiselected', true);
			}

			lastTabIndex++;

			let newIndex = aOptions.insertBefore ? aOptions.insertBefore._tPos : lastTabIndex ;
			if (aOptions.insertBefore && newIndex > tab._tPos) newIndex--;

			this.internallyTabMovingCount++;
			targetBrowser.moveTabTo(tab, newIndex);
			this.collapseExpandTab(tab, false, true);
			this.internallyTabMovingCount--;
		}

		if (shouldClose)
			sourceService.closeOwner(sourceBrowser);

		if (newTabs.length)
			this.applyTreeStructureToTabs(
				newTabs,
				treeStructure,
				collapsedStates.map(function(aCollapsed) {
					return !aCollapsed
				})
			);

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
		var newTab = this.mTabBrowser.addTab();
		newTab.linkedBrowser.stop();
		newTab.linkedBrowser.docShell;
		this.mTabBrowser.swapBrowsersAndCloseOther(newTab, aTab);
		this.mTabBrowser.setTabTitle(newTab);
		return newTab;
	},
 
	duplicateTabAsOrphan : function TSTBrowser_duplicateTabAsOrphan(aTab) 
	{
		var newTab = this.mTabBrowser.duplicateTab(aTab);
		this.deleteTabValue(newTab, this.kCHILDREN);
		this.deleteTabValue(newTab, this.kPARENT);
		return newTab;
	},
 
	closeOwner : function TSTBrowser_closeOwner(aTabOwner) 
	{
		var w = aTabOwner.ownerDocument.defaultView;
		if (!w) return;
		if ('SplitBrowser' in w) {
			if ('getSubBrowserFromChild' in w.SplitBrowser) {
				var subbrowser = w.SplitBrowser.getSubBrowserFromChild(aTabOwner);
				if (subbrowser) {
					subbrowser.close();
					return;
				}
			}
			if (w.SplitBrowser.browsers.length) return;
		}
		w.close();
	},
  
/* collapse/expand */ 
	
	collapseExpandSubtree : function TSTBrowser_collapseExpandSubtree(aTab, aCollapse, aJustNow) /* PUBLIC API */ 
	{
		if (!aTab) return;

		if (this.isSubtreeCollapsed(aTab) == aCollapse) return;

		var b = this.mTabBrowser;
		this.doingCollapseExpand = true;

		this.setTabValue(aTab, this.kSUBTREE_COLLAPSED, aCollapse);

		this.getChildTabs(aTab).forEach(function(aTab) {
			this.collapseExpandTab(aTab, aCollapse, aJustNow);
		}, this);

		if (!aCollapse)
			this.scrollToTabSubtree(aTab);

		this.saveTreeStructureWithDelay();

		this.doingCollapseExpand = false;
	},
 
	collapseExpandTab : function TSTBrowser_collapseExpandTab(aTab, aCollapse, aJustNow) 
	{
		if (!aTab || !this.getParentTab(aTab)) return;

		this.setTabValue(aTab, this.kCOLLAPSED, aCollapse);
		this.updateTabCollapsed(aTab, aCollapse, aJustNow);

		var data = {
				collapsed : aCollapse
			};

		/* PUBLIC API */
		this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, aTab, true, false, data);
		// for backward compatibility
		this.fireDataContainerEvent(this.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED.replace(/^nsDOM/, ''), aTab, true, false, data);

		var b = this.mTabBrowser;
		var parent;
		if (aCollapse && aTab == b.selectedTab && (parent = this.getParentTab(aTab))) {
			var newSelection = parent;
			while (this.isCollapsed(parent))
			{
				parent = this.getParentTab(parent);
				if (!parent) break;
				newSelection = parent;
			}
			b.selectedTab = newSelection;
		}

		if (!this.isSubtreeCollapsed(aTab)) {
			this.getChildTabs(aTab).forEach(function(aTab) {
				this.collapseExpandTab(aTab, aCollapse, aJustNow);
			}, this);
		}
	},
	updateTabCollapsed : function TSTBrowser_updateTabCollapsed(aTab, aCollapsed, aJustNow)
	{
		this.stopTabCollapseAnimation(aTab);

		aTab.removeAttribute(this.kX_OFFSET);
		aTab.removeAttribute(this.kY_OFFSET);

		aTab.setAttribute(this.kCOLLAPSING_PHASE, aCollapsed ? this.kCOLLAPSING_PHASE_TO_BE_COLLAPSED : this.kCOLLAPSING_PHASE_TO_BE_EXPANDED );

		var CSSTransitionEnabled = ('Transition' in aTab.style || 'MozTransition' in aTab.style);

		var maxMargin;
		var offsetAttr;
		var collapseProp = 'margin-'+this.collapseTarget;
		let (firstTab = this.getFirstNormalTab(this.mTabBrowser)) {
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

		var startMargin, endMargin, startOpacity, endOpacity;
		if (aCollapsed) {
			startMargin  = 0;
			endMargin    = maxMargin;
			startOpacity = 1;
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

		if (
			!this.animationEnabled ||
			aJustNow ||
			this.collapseDuration < 1 // ||
//			!this.isVertical ||
//			!this.canCollapseSubtree(this.getParentTab(aTab))
			) {
			if (aCollapsed)
				this.setTabValue(aTab, this.kCOLLAPSED_DONE, true);
			else
				this.deleteTabValue(aTab, this.kCOLLAPSED_DONE);
			aTab.removeAttribute(this.kCOLLAPSING_PHASE);

			if (CSSTransitionEnabled) {
				aTab.style.setProperty(this.collapseCSSProp, endMargin ? '-'+endMargin+'px' : '', 'important');
				if (endOpacity == 0)
					aTab.style.setProperty('opacity', endOpacity == 1 ? '' : endOpacity, 'important');
				else
					aTab.style.removeProperty('opacity');
			}
			else {
				aTab.style.removeProperty(this.collapseCSSProp);
				aTab.style.removeProperty('opacity');
			}
			return;
		}

		var deltaMargin  = endMargin - startMargin;
		var deltaOpacity = endOpacity - startOpacity;

		aTab.style.setProperty(this.collapseCSSProp, startMargin ? '-'+startMargin+'px' : '', 'important');
		aTab.style.setProperty('opacity', startOpacity == 1 ? '' : startOpacity, 'important');

		if (!aCollapsed) {
			aTab.setAttribute(offsetAttr, maxMargin);
			this.deleteTabValue(aTab, this.kCOLLAPSED_DONE);
		}

		var radian = 90 * Math.PI / 180;
		var self   = this;
		var firstFrame = true;
		aTab.__treestyletab__updateTabCollapsedTask = function(aTime, aBeginning, aChange, aDuration) {
			if (firstFrame && CSSTransitionEnabled) {
				aTab.style.setProperty(self.collapseCSSProp, endMargin ? '-'+endMargin+'px' : '', 'important');
				aTab.style.setProperty('opacity', endOpacity == 1 ? '' : endOpacity, 'important');
			}
			firstFrame = false;
			// If this is the last tab, negative scroll happens.
			// Then, we shouldn't do animation.
			var stopAnimation = false;
			var scrollBox = self.scrollBox;
			if (scrollBox) {
				if (scrollBox._scrollbox) scrollBox = scrollBox._scrollbox;
				if ('scrollTop' in scrollBox &&
					(scrollBox.scrollTop < 0 || scrollBox.scrollLeft < 0)) {
					scrollBox.scrollTop = 0;
					scrollBox.scrollLeft = 0;
					stopAnimation = true;
				}
			}
			if (aTime >= aDuration || stopAnimation) {
				delete aTab.__treestyletab__updateTabCollapsedTask;
				if (aCollapsed) self.setTabValue(aTab, self.kCOLLAPSED_DONE, true);
				if (!CSSTransitionEnabled) {
					aTab.style.removeProperty(self.collapseCSSProp);
					aTab.style.removeProperty('opacity');
				}
				aTab.removeAttribute(offsetAttr);
				aTab.removeAttribute(self.kCOLLAPSING_PHASE);

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
				aTab = null;

				return true;
			}
			else {
				if (!CSSTransitionEnabled) {
					let power   = Math.sin(aTime / aDuration * radian);
					let margin  = startMargin + (deltaMargin * power);
					let opacity = startOpacity + (deltaOpacity  * power);
					aTab.style.setProperty(self.collapseCSSProp, margin ? '-'+margin+'px' : '', 'important');
					aTab.style.setProperty('opacity', opacity == 1 ? '' : opacity, 'important');
				}
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
		this.animationManager.removeTask(
			aTab.__treestyletab__updateTabCollapsedTask
		);
	},
 
	collapseExpandTreesIntelligentlyFor : function TSTBrowser_collapseExpandTreesIntelligentlyFor(aTab, aJustNow) 
	{
		if (!aTab ||
			this.doingCollapseExpand ||
			!this.canCollapseSubtree(aTab))
			return;

		var b = this.mTabBrowser;
		var sameParentTab = this.getParentTab(aTab);
		var expandedParentTabs = [
				aTab.getAttribute(this.kID)
			];
		var parentTab = aTab;
		while (parentTab = this.getParentTab(parentTab))
		{
			expandedParentTabs.push(parentTab.getAttribute(this.kID));
		}
		expandedParentTabs = expandedParentTabs.join('|');

		var xpathResult = this.evaluateXPath(
				'child::xul:tab[@'+this.kCHILDREN+' and not(@'+this.kCOLLAPSED+'="true") and not(@'+this.kSUBTREE_COLLAPSED+'="true") and @'+this.kID+' and not(contains("'+expandedParentTabs+'", @'+this.kID+'))]',
				b.mTabContainer
			);
		var collapseTab;
		var dontCollapse;
		for (var i = 0, maxi = xpathResult.snapshotLength; i < maxi; i++)
		{
			dontCollapse = false;
			collapseTab  = xpathResult.snapshotItem(i);

			parentTab = this.getParentTab(collapseTab);
			if (parentTab) {
				dontCollapse = true;
				if (!this.isSubtreeCollapsed(parentTab)) {
					do {
						if (expandedParentTabs.indexOf(parentTab.getAttribute(this.kID)) < 0)
							continue;
						dontCollapse = false;
						break;
					}
					while (parentTab = this.getParentTab(parentTab));
				}
			}

			if (!dontCollapse)
				this.collapseExpandSubtree(collapseTab, true, aJustNow);
		}

		this.collapseExpandSubtree(aTab, false, aJustNow);
	},
	collapseExpandTreesIntelligentlyWithDelayFor : function TSTBrowser_collapseExpandTreesIntelligentlyWithDelayFor(aTab)
	{
		if (this.doingCollapseExpand) return;
		if (this._cETIWDFTimer)
			this.window.clearTimeout(this._cETIWDFTimer);
		this._cETIWDFTimer = this.window.setTimeout(function(aSelf) {
			aSelf.window.clearTimeout(aSelf._cETIWDFTimer);
			aSelf._cETIWDFTimer = null;
			aSelf.collapseExpandTreesIntelligentlyFor(aTab);
		}, 0, this);
	},
	_cETIWDFTimer : null,
 
	collapseExpandAllSubtree : function TSTBrowser_collapseExpandAllSubtree(aCollapse, aJustNow) 
	{
		var xpathResult = this.evaluateXPath(
				'child::xul:tab[@'+this.kID+' and @'+this.kCHILDREN+
				(
					aCollapse ?
						' and not(@'+this.kSUBTREE_COLLAPSED+'="true")' :
						' and @'+this.kSUBTREE_COLLAPSED+'="true"'
				)+
				']',
				this.mTabBrowser.mTabContainer
			);
		for (var i = 0, maxi = xpathResult.snapshotLength; i < maxi; i++)
		{
			this.collapseExpandSubtree(xpathResult.snapshotItem(i), aCollapse, aJustNow);
		}
	},
  
/* scroll */ 
	
	scrollTo : function TSTBrowser_scrollTo(aEndX, aEndY) 
	{
		// Prevent to restore scroll position for "TabClose".
		// We override it.
		this.lastScrollX = -1;
		this.lastScrollY = -1;

		if (this.animationEnabled || this.smoothScrollEnabled) {
			this.smoothScrollTo(aEndX, aEndY);
		}
		else {
			try {
				this.scrollBoxObject.scrollTo(aEndX, aEndY);
			}
			catch(e) {
			}
		}
	},
	
	smoothScrollTo : function TSTBrowser_smoothScrollTo(aEndX, aEndY, aDuration) 
	{
		var b = this.mTabBrowser;
		this.animationManager.removeTask(this.smoothScrollTask);

		var scrollBoxObject = this.scrollBoxObject;
		var x = {}, y = {};
		scrollBoxObject.getPosition(x, y);
		var startX = x.value;
		var startY = y.value;
		var deltaX = aEndX - startX;
		var deltaY = aEndY - startY;

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
			var scrollBoxObject = self.scrollBoxObject;
			if (aTime >= aDuration) {
				scrollBoxObject.scrollTo(aEndX, aEndY);

				/**
				 * When there is any expanding tab, we have to retry to scroll.
				 * if the scroll box was expanded.
				 */
				let oldSize = self._getMaxScrollSize(scrollBoxObject);
				self.Deferred.next(function() {
					let newSize = self._getMaxScrollSize(scrollBoxObject);
					let lastTab = self.getLastVisibleTab(self.mTabBrowser);
					if (
						// scroll size can be expanded by expanding tabs.
						oldSize[0] < newSize[0] || oldSize[1] < newSize[1] ||
						// there are still animating tabs
						self.getXOffsetOfTab(lastTab) || self.getYOffsetOfTab(lastTab) ||
						self.evaluateXPath(
							'child::xul:tab[@'+self.kCOLLAPSING_PHASE+'="'+self.kCOLLAPSING_PHASE_TO_BE_EXPANDED+'"]',
							self.mTabBrowser.mTabContainer,
							Ci.nsIDOMXPathResult.BOOLEAN_TYPE
						).booleanValue
						)
						self.smoothScrollTo(aEndX, aEndY, parseInt(aDuration * 0.5));
					self = null;
					scrollBoxObject = null;
				});

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
			0, 0, this.smoothScrollDuration || aDuration, this.window
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
  
	scrollToTab : function TSTBrowser_scrollToTab(aTab, aOnlyWhenCurrentTabIsInViewport) 
	{
		if (!aTab || !aTab.parentNode || this.isTabInViewport(aTab))
			return;

		var b = this.mTabBrowser;

		var scrollBoxObject = this.scrollBoxObject;
		var w = {}, h = {};
		try {
			scrollBoxObject.getScrolledSize(w, h);
		}
		catch(e) { // Tab Mix Plus (or others)
			return;
		}

		var targetTabBox = aTab.boxObject;
		var baseTabBox = this.getFirstNormalTab(b).boxObject;

		var xOffset = this.getXOffsetOfTab(aTab);
		var yOffset = this.getYOffsetOfTab(aTab);

		var targetX = (aTab.boxObject.screenX + xOffset < scrollBoxObject.screenX) ?
			(targetTabBox.screenX + xOffset - baseTabBox.screenX) - (targetTabBox.width * 0.5) :
			(targetTabBox.screenX + xOffset - baseTabBox.screenX) - scrollBoxObject.width + (targetTabBox.width * 1.5) ;

		var targetY = (aTab.boxObject.screenY + yOffset < scrollBoxObject.screenY) ?
			(targetTabBox.screenY + yOffset - baseTabBox.screenY) - (targetTabBox.height * 0.5) :
			(targetTabBox.screenY + yOffset - baseTabBox.screenY) - scrollBoxObject.height + (targetTabBox.height * 1.5) ;

		if (aOnlyWhenCurrentTabIsInViewport && b.selectedTab != aTab) {
			let box = b.selectedTab.boxObject;
			if (targetTabBox.screenX - box.screenX + baseTabBox.width + xOffset > scrollBoxObject.width ||
				targetTabBox.screenY - box.screenY + baseTabBox.height + yOffset > scrollBoxObject.height)
				return;
		}

		this.scrollTo(targetX, targetY);
	},
 
	scrollToTabSubtree : function TSTBrowser_scrollToTabSubtree(aTab) 
	{
		var b          = this.mTabBrowser;
		var descendant = this.getDescendantTabs(aTab);
		var lastVisible = aTab;
		for (var i = descendant.length-1; i > -1; i--)
		{
			if (this.isCollapsed(descendant[i])) continue;
			lastVisible = descendant[i];
			break;
		}

		if (this.isTabInViewport(aTab) && this.isTabInViewport(lastVisible)) {
			return;
		}

		var containerPosition = this.tabStrip.boxObject[this.screenPositionProp];
		var containerSize     = this.tabStrip.boxObject[this.sizeProp];
		var parentPosition    = aTab.boxObject[this.screenPositionProp];
		var lastPosition      = lastVisible.boxObject[this.screenPositionProp];
		var tabSize           = lastVisible.boxObject[this.sizeProp];

		if (lastPosition - parentPosition + tabSize > containerSize - tabSize) { // out of screen
			var endPos = parentPosition - this.getFirstNormalTab(b).boxObject[this.screenPositionProp] - tabSize * 0.5;
			var endX = this.isVertical ? 0 : endPos ;
			var endY = this.isVertical ? endPos : 0 ;
			this.scrollTo(endX, endY);
		}
		else if (!this.isTabInViewport(aTab) && this.isTabInViewport(lastVisible)) {
			this.scrollToTab(aTab);
		}
		else if (this.isTabInViewport(aTab) && !this.isTabInViewport(lastVisible)) {
			this.scrollToTab(lastVisible);
		}
		else if (parentPosition < containerPosition) {
			this.scrollToTab(aTab);
		}
		else {
			this.scrollToTab(lastVisible);
		}
	},
   
/* sub modules */ 
	
	get tabbarDNDObserver() 
	{
		if (!this._tabbarDNDObserver) {
			let ns = {};
			Components.utils.import('resource://treestyletab-modules/tabbarDNDObserver.js', ns);
			this._tabbarDNDObserver = new ns.TabbarDNDObserver(this.mTabBrowser);
		}
		return this._tabbarDNDObserver;
	},
 
	get panelDNDObserver() 
	{
		if (!this._panelDNDObserver) {
			let ns = {};
			Components.utils.import('resource://treestyletab-modules/tabpanelDNDObserver.js', ns);
			this._panelDNDObserver = new ns.TabpanelDNDObserver(this.mTabBrowser);
		}
		return this._panelDNDObserver;
	},
  
/* proxying for window service */ 
	_callWindowServiceMethod : function TSTBrowser_callWindowServiceMethod(aName, aArgs)
	{
		return this.windowService[aName].apply(this.windowService, aArgs);
	},
	isPopupShown : function TSTBrowser_isPopupShown() { return this._callWindowServiceMethod('isPopupShown', arguments); },
	updateTabsOnTop : function TSTBrowser_updateTabsOnTop() { return this._callWindowServiceMethod('updateTabsOnTop', arguments); },
	registerTabFocusAllowance : function TSTBrowser_registerTabFocusAllowance() { return this._callWindowServiceMethod('registerTabFocusAllowance', arguments); },
	isPopupShown : function TSTBrowser_isPopupShown() { return this._callWindowServiceMethod('isPopupShown', arguments); },
	toggleAutoHide : function TSTBrowser_toggleAutoHide() { return this._callWindowServiceMethod('toggleAutoHide', arguments); },
 
/* show/hide tab bar */ 
	get autoHide()
	{
		if (!this._autoHide) {
			let ns = {};
			Components.utils.import('resource://treestyletab-modules/autoHide.js', ns);
			this._autoHide = new ns.AutoHideBrowser(this.mTabBrowser);
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

	get tabbarWidth() { return this.autoHide.width; },
	set tabbarWidth(aValue) { return this.autoHide.widthwidth = aValue; },
	get tabbarHeight() { return this.autoHide.height; },
	set tabbarHeight(aValue) { return this.autoHide.height = aValue; },
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
	cancelHideTabbarForFeedback : function TSTBrowser_cancelHideTabbarForFeedback() { this.autoHide.cancelHideForFeedback(); }
  
}; 
// rap('end of definition of browser');
 
