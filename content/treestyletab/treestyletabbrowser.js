function TreeStyleTabBrowser(aTabBrowser) 
{
	this.mTabBrowser = aTabBrowser;
}
 
TreeStyleTabBrowser.prototype = { 
	__proto__ : TreeStyleTabService,
	
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

	indent               : -1,
	indentProp           : 'margin',
	indentTarget         : 'left',
	indentCSSProp        : 'margin-left',
	collapseTarget       : 'top',
	collapseCSSProp      : 'margin-top',
	positionProp         : 'screenY',
	sizeProp             : 'height',
	invertedPositionProp : 'screenX',
	invertedSizeProp     : 'width',
	startProp            : 'top',
	endProp              : 'bottom',

	maxTreeLevelPhisical : false,
 
/* elements */ 
	
	get browser() 
	{
		return this.mTabBrowser;
	},
 
	get container() 
	{
		if (!this._container) {
			this._container = document.getElementById('appcontent');
		}
		return this._container;
	},
	_container : null,
 
	get scrollBox() 
	{
		return ( // Tab Mix Plus
				this.getTreePref('compatibility.TMP') &&
				document.getAnonymousElementByAttribute(this.mTabBrowser.mTabContainer, 'class', 'tabs-frame')
			) ||
			this.mTabBrowser.mTabContainer.mTabstrip;
	},
	get scrollBoxObject()
	{
		var node = this.scrollBox;
		if (node._scrollbox) node = node._scrollbox;
		return (node.scrollBoxObject || node.boxObject)
				.QueryInterface(Components.interfaces.nsIScrollBoxObject); // for Tab Mix Plus (ensure scrollbox-ed)
	},
 
	get splitter() 
	{
		return document.getAnonymousElementByAttribute(this.mTabBrowser, 'class', this.kSPLITTER) ||
				document.getAnonymousElementByAttribute(this.mTabBrowser, 'id', 'tabkit-splitter'); // Tab Kit
	},
 
	get tabStripPlaceHolder() 
	{
		return this._tabStripPlaceHolder;
	},
	set tabStripPlaceHolder(value)
	{
		return (this._tabStripPlaceHolder = value);
	},
 
	get tabTooltip() 
	{
		return document.getElementById('tabbrowser-tab-tooltip') || // Firefox 4.0-
				this.evaluateXPath('descendant::xul:tooltip', this.browser.mStrip, XPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue; // -Firefox 3.6
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
		if (!this.preInitialized)
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
			(this.preInitialized && this.browser.getAttribute(this.kTABBAR_POSITION)) ||
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

		if ('UndoTabService' in window && UndoTabService.isUndoable()) {
			var current = this.position;
			var self = this;
			UndoTabService.doOperation(
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

		window.setTimeout(function(aSelf) {
			aSelf.checkTabsIndentOverflow();
			aSelf.fireTabbarPositionEvent(false, oldPosition, aNewPosition);
		}, 0, this);
	},
  
/* status getters */ 
	
	get isVertical() 
	{
		if (!this.preInitialized)
			return ['left', 'right'].indexOf(this.position) > -1;

		var b = this.mTabBrowser;
		if (!b) return false;

		if (b.hasAttribute(this.kMODE))
			return b.getAttribute(this.kMODE) == 'vertical';

		var box = this.scrollBox || b.mTabContainer ;
		return (box.getAttribute('orient') || window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical';
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
				XPathResult.FIRST_ORDERED_NODE_TYPE
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
		var label = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-stack') || // Mac OS X
					( // Tab Mix Plus
						this.getTreePref('compatibility.TMP') &&
						document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-container')
					) ||
					document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text tab-label') || // Firefox 4.0-
					document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text'); // Firefox 3.5 - Firefox 3.6
		return label;
	},
 
	getTabClosebox : function TSTBrowser_getTabClosebox(aTab) 
	{
		var close = ( // Tab Mix Plus
						this.getTreePref('compatibility.TMP') &&
						document.getAnonymousElementByAttribute(aTab, 'class', 'tab-close-button always-right')
					) ||
					document.getAnonymousElementByAttribute(aTab, 'class', 'tab-close-button');
		return close;
	},
  
	isTabInViewport : function TSTBrowser_isTabInViewport(aTab) 
	{
		if (!this.preInitialized || !aTab)
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
		return false;
	},
 
	positionPinnedTabs : function TSTBrowser_positionPinnedTabs(aWidth, aHeight) 
	{
		var b = this.mTabBrowser;
		var tabbar = b.tabContainer;
		if (
			!tabbar ||
			!tabbar._positionPinnedTabs ||
			!tabbar.boxObject.width
			)
			return;

		if (!this.isVertical) {
			this.resetPinnedTabs();
			b.mTabContainer._positionPinnedTabs();
			return;
		}

		var maxWidth = this._tabStripPlaceHolder.boxObject.width ||
						this.tabStrip.boxObject.width;

		var count  = this.pinnedTabsCount;
		var width  = aWidth || this.PINNED_TAB_DEFAULT_WIDTH;
		var height = aHeight || this.PINNED_TAB_DEFAULT_HEIGHT;
		var maxCol = Math.floor(maxWidth / width);
		var maxRow = Math.ceil(count / maxCol);
		var col    = 0;
		var row    = 0;
		tabbar.style.MozMarginStart = '';
		tabbar.style.setProperty('margin-top', (height * maxRow)+'px', 'important');
		for (let i = 0; i < count; i++)
		{
			let style = tabbar.childNodes[i].style;
			style.MozMarginStart = '';
			style.setProperty('margin-left', (width * col)+'px', 'important');
			style.setProperty('margin-top', (- height * (maxRow - row))+'px', 'important');
			style.top = style.right = style.bottom = style.left = '';
			col++;
			if (col >= maxCol) {
				col = 0;
				row++;
			}
		}
	},
	positionPinnedTabsWithDelay : function TSTBrowser_positionPinnedTabsWithDelay()
	{
		if (this.positionPinnedTabsWithDelayTimer)
			return;

		this.positionPinnedTabsWithDelayTimer = window.setTimeout(function(aSelf) {
			aSelf.Deferred.next(function() {
				// do with delay again, after Firefox's reposition was completely finished.
				aSelf.positionPinnedTabs();
			});
			aSelf.positionPinnedTabsWithDelayTimer = null;
		}, 0, this);
	},
	PINNED_TAB_DEFAULT_WIDTH : 24,
	PINNED_TAB_DEFAULT_HEIGHT : 24,
 
	resetPinnedTabs : function TSTBrowser_resetPinnedTabs() 
	{
		var b = this.mTabBrowser;
		var tabbar = b.tabContainer;
		tabbar.style.MozMarginStart = tabbar.style.marginTop = '';
		for (var i = 0, count = this.pinnedTabsCount; i < count; i++)
		{
			let style = tabbar.childNodes[i].style;
			style.MozMarginStart = style.marginLeft = style.marginTop = '';
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
  
/* initialize */ 
	
	init : function TSTBrowser_init() 
	{
		this.stopRendering();

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

		this.initTabbar(null, this.kTABBAR_TOP);

		window.addEventListener('resize', this, true);
		window.addEventListener('beforecustomization', this, true);
		window.addEventListener('aftercustomization', this, false);
		window.addEventListener('customizationchange', this, false);
		window.addEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		window.addEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED,  this, false);

		b.addEventListener('nsDOMMultipleTabHandlerTabsClosing', this, false);

		window['piro.sakura.ne.jp'].tabsDragUtils.initTabBrowser(b);

		this._initTabbrowserMethods();
		this._initTabbrowserContextMenu();
		TreeStyleTabService.updateTabDNDObserver(b);

		this.getAllTabsArray(b).forEach(this.initTab, this);

		this.onPrefChange('extensions.treestyletab.maxTreeLevel');
		this.onPrefChange('extensions.treestyletab.tabbar.style');
		this.onPrefChange('extensions.treestyletab.twisty.style');
		this.onPrefChange('extensions.treestyletab.showBorderForFirstTab');
		this.onPrefChange('extensions.treestyletab.tabbar.invertTabContents');
		this.onPrefChange('extensions.treestyletab.tabbar.invertClosebox');
		this.onPrefChange('extensions.treestyletab.tabbar.autoShow.mousemove');
		this.onPrefChange('extensions.treestyletab.animation.enabled');

		this.ObserverService.addObserver(this, this.kTOPIC_INDENT_MODIFIED, false);
		this.ObserverService.addObserver(this, this.kTOPIC_COLLAPSE_EXPAND_ALL, false);
		this.ObserverService.addObserver(this, this.kTOPIC_CHANGE_TREEVIEW_AVAILABILITY, false);
		this.ObserverService.addObserver(this, 'sessionstore-windows-restored', false);
		this.ObserverService.addObserver(this, 'sessionstore-browser-state-restored', false);
		this.ObserverService.addObserver(this, 'private-browsing-change-granted', false);
		this.ObserverService.addObserver(this, 'lightweight-theme-styling-update', false);
		this.addPrefListener(this);

		this.tabbarDNDObserver;
		this.panelDNDObserver;
		this.autoHide;

		this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_INITIALIZE);

		this.fireTabbarPositionEvent(false, 'top', position); /* PUBLIC API */

		this.startRendering();
	},
	
	_initTabbrowserExtraContents : function TSTBrowser_initTabbrowserExtraContents() 
	{
		var b = this.mTabBrowser;

		var toggler = document.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER);
		if (!toggler) {
			toggler = document.createElement('spacer');
			toggler.setAttribute('class', this.kTABBAR_TOGGLER);
			toggler.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468
			b.mTabBox.insertBefore(toggler, b.mTabBox.firstChild);
			if (b.mTabDropIndicatorBar == toggler)
				b.mTabDropIndicatorBar = document.getAnonymousElementByAttribute(b, 'class', 'tab-drop-indicator-bar');
		}

		var placeHolder = document.getAnonymousElementByAttribute(b, 'anonid', 'strip');
		if (!placeHolder) {
			placeHolder = document.createElement('hbox');
			placeHolder.setAttribute('anonid', 'strip');
			placeHolder.setAttribute('class', 'tabbrowser-strip '+this.kTABBAR_PLACEHOLDER);
			placeHolder.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468
			b.mTabBox.insertBefore(placeHolder, toggler.nextSibling);
		}
		this.tabStripPlaceHolder = (placeHolder != this.tabStrip) ? placeHolder : null ;
	},
 
	_initTabbrowserMethods : function TSTBrowser_initTabbrowserMethods() 
	{
		var b = this.mTabBrowser;

		eval('b.moveTabForward = '+
			b.moveTabForward.toSource().replace(
				'{', '{ var nextTab;'
			).replace(
				'tabPos < this.browsers.length - 1',
				'nextTab = this.treeStyleTab.getNextSiblingTab(this.mCurrentTab)'
			).replace(
				'tabPos + 1', 'nextTab._tPos'
			).replace(
				'this.moveTabTo(',
				<![CDATA[
					var descendant = this.treeStyleTab.getDescendantTabs(nextTab);
					if (descendant.length) {
						nextTab = descendant[descendant.length-1];
					}
					$&]]>
			).replace(
				'this.moveTabToStart();',
				<![CDATA[
					this.treeStyleTab.internallyTabMovingCount++;
					var parentTab = this.treeStyleTab.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, this.treeStyleTab.getFirstChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						$&
					}
					this.treeStyleTab.internallyTabMovingCount--;
				]]>
			)
		);

		eval('b.moveTabBackward = '+
			b.moveTabBackward.toSource().replace(
				'{', '{ var prevTab;'
			).replace(
				'tabPos > 0',
				'prevTab = this.treeStyleTab.getPreviousSiblingTab(this.mCurrentTab)'
			).replace(
				'tabPos - 1', 'prevTab._tPos'
			).replace(
				'this.moveTabToEnd();',
				<![CDATA[
					this.treeStyleTab.internallyTabMovingCount++;
					var parentTab = this.treeStyleTab.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, this.treeStyleTab.getLastChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						$&
					}
					this.treeStyleTab.internallyTabMovingCount--;
				]]>
			)
		);

		eval('b.loadTabs = '+
			b.loadTabs.toSource().replace(
				'var tabNum = ',
				<![CDATA[
					if (this.treeStyleTab.readiedToAttachNewTabGroup)
						TreeStyleTabService.readyToOpenChildTab(firstTabAdded || this.selectedTab, true);
					$&]]>
			).replace(
				'if (!aLoadInBackground)',
				<![CDATA[
					if (TreeStyleTabService.checkToOpenChildTab(this))
						TreeStyleTabService.stopToOpenChildTab(this);
					$&]]>
			).replace(
				'this.selectedTab = firstTabAdded;',
				<![CDATA[
					this.selectedTab = aURIs[0].indexOf('about:treestyletab-group') < 0 ?
						firstTabAdded :
						TreeStyleTabService.getNextTab(firstTabAdded) ;
				]]>
			)
		);

		if ('_beginRemoveTab' in b) {
			eval('b._beginRemoveTab = '+
				b._beginRemoveTab.toSource().replace( // Firefox 3.5-3.6
					'if (l == 1) {',
					'if (l == 1 || this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab)) {'
				).replace( // Firefox 4.0-
					'if (this.tabs.length - this._removingTabs.length == 1) {',
					'if (this.tabs.length - this._removingTabs.length == 1 || this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab)) {'
				).replace( // Firefox 3.5-
					'this._removingTabs.length == 0',
					'(this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab) || $&)'
				)
			);
		}

		eval('b.removeCurrentTab = '+b.removeCurrentTab.toSource().replace(
			'{',
			'{ if (!this.treeStyleTab.warnAboutClosingTabSubtreeOf(this.selectedTab)) return;'
		));
	},
 
	_initTabbrowserContextMenu : function TSTBrowser_initTabbrowserContextMenu() 
	{
		var b = this.mTabBrowser;

		var tabContextMenu = b.tabContextMenu ||
							document.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContextMenu.addEventListener('popupshowing', this, false);
		if (!('MultipleTabService' in window)) {
			window.setTimeout(function(aSelf, aTabBrowser, aPopup) {
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
					let item = document.getElementById(aID).cloneNode(true);
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

		var removeTabItem = document.getAnonymousElementByAttribute(b, 'id', 'context_closeTab');
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
 
	initTab : function TSTBrowser_initTab(aTab) 
	{
		if (!aTab.hasAttribute(this.kID)) {
			var id = this.getTabValue(aTab, this.kID) || this.makeNewId();
			aTab.setAttribute(this.kID, id);
			aTab.setAttribute(this.kSUBTREE_COLLAPSED, true);
			aTab.setAttribute(this.kALLOW_COLLAPSE, true);
			window.setTimeout(function(aSelf) {
				if (!aSelf.getTabValue(aTab, aSelf.kID)) {
					aSelf.setTabValue(aTab, aSelf.kID, id);
					if (!(id in aSelf.tabsHash))
						aSelf.tabsHash[id] = aTab;
				}
			}, 0, this);
			if (!(id in this.tabsHash))
				this.tabsHash[id] = aTab;
		}

		aTab.__treestyletab__linkedTabBrowser = this.mTabBrowser;

		this.initTabAttributes(aTab);
		this.initTabContents(aTab);

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
		var icon  = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-icon');
		var twisty = document.getAnonymousElementByAttribute(aTab, 'class', this.kTWISTY);
		if (icon && !twisty) {
			twisty = document.createElement('image');
			twisty.setAttribute('class', this.kTWISTY);
			let container = document.createElement('hbox');
			container.setAttribute('class', this.kTWISTY_CONTAINER);
			container.appendChild(twisty);

			icon.appendChild(container);

			let marker = document.createElement('image');
			marker.setAttribute('class', this.kDROP_MARKER);
			container = document.createElement('hbox');
			container.setAttribute('class', this.kDROP_MARKER_CONTAINER);
			container.appendChild(marker);

			icon.appendChild(container);
		}

		var label = this.getTabLabel(aTab);
		var counter = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER);
		if (label && label.parentNode != aTab && !counter) {
			counter = document.createElement('hbox');
			counter.setAttribute('class', this.kCOUNTER_CONTAINER);

			let startParen = counter.appendChild(document.createElement('label'));
			startParen.setAttribute('class', this.kCOUNTER_PAREN);
			startParen.setAttribute('value', '(');

			let counterLabel = counter.appendChild(document.createElement('label'));
			counterLabel.setAttribute('class', this.kCOUNTER);
			counterLabel.setAttribute('value', '0');

			let endParen = counter.appendChild(document.createElement('label'));
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

		var tabContentBox = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-content');
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
		var label = this.getTabLabel(aTab);
		var close = this.getTabClosebox(aTab);
		var inverted = this.mTabBrowser.getAttribute(this.kTAB_CONTENTS_INVERTED) == 'true';

		var nodesContainer = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-content') || aTab;
		var nodes = Array.slice(document.getAnonymousNodes(nodesContainer) || nodesContainer.childNodes);

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

		var counter = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER);
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
		window.setTimeout(function(aSelf) {
			var b = aSelf.mTabBrowser;
			var tabs = !aTarget ?
						[b.selectedTab] :
					(aTarget instanceof Ci.nsIDOMElement) ?
						[aTarget] :
					(typeof aTarget == 'object' && 'length' in aTarget) ?
						Array.slice(aTarget) :
						aSelf.getAllTabsArray(b);
			tabs.forEach(function(aTab) {
				this.initTabContentsOrder(aTab);
			}, aSelf);
		}, 0, this);
	},
  
	initTabbar : function TSTBrowser_initTabbar(aNewPosition, aOldPosition) 
	{
		if (aNewPosition && typeof aNewPosition == 'string')
			aNewPosition = this.getPositionFlag(aNewPosition);
		if (aOldPosition && typeof aOldPosition == 'string')
			aOldPosition = this.getPositionFlag(aOldPosition);

		this._startListenTabbarEvents();
		this._initTabbarMethods();

		this.stopRendering();

		var b = this.mTabBrowser;

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
		var toggler = document.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER);
		var indicator = b.mTabDropIndicatorBar || b.tabContainer._tabDropIndicator;

		// Tab Mix Plus
		var scrollFrame, newTabBox, tabBarMode;
		if (this.getTreePref('compatibility.TMP')) {
			scrollFrame = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-frame') ||
							document.getAnonymousElementByAttribute(b.mTabContainer, 'anonid', 'scroll-tabs-frame');
			newTabBox = document.getAnonymousElementByAttribute(b.mTabContainer, 'id', 'tabs-newbutton-box');
			tabBarMode = this.getPref('extensions.tabmix.tabBarMode');
		}

		// All-in-One Sidebar
		var toolboxContainer = document.getAnonymousElementByAttribute(strip, 'anonid', 'aiostbx-toolbox-tableft');
		if (toolboxContainer) toolboxContainer = toolboxContainer.parentNode;

		var scrollInnerBox = b.mTabContainer.mTabstrip._scrollbox ?
				document.getAnonymousNodes(b.mTabContainer.mTabstrip._scrollbox)[0] :
				scrollFrame; // Tab Mix Plus

		this.removeTabbrowserAttribute(this.kRESIZING, b);

		this.removeTabStripAttribute('width');
		b.mPanelContainer.removeAttribute('width');

		var delayedPostProcess;

		if (pos & this.kTABBAR_VERTICAL) {

			this.collapseTarget       = 'top';
			this.positionProp         = 'screenY';
			this.sizeProp             = 'height';
			this.invertedPositionProp = 'screenX';
			this.invertedSizeProp     = 'width';
			this.startProp            = 'top';
			this.endProp              = 'bottom';

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
				document.getAnonymousNodes(scrollFrame)[0].removeAttribute('flex');
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'vertical';
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
			this.collapseTarget       = 'left';
			this.positionProp         = 'screenX';
			this.sizeProp             = 'width';
			this.invertedPositionProp = 'screenY';
			this.invertedSizeProp     = 'height';
			this.startProp            = 'left';
			this.endProp              = 'right';

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
				document.getAnonymousNodes(scrollFrame)[0].setAttribute('flex', 1);
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'horizontal';
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
		window.setTimeout(function(aSelf, aTabBrowser, aSplitter, aToggler) {
			delayedPostProcess(aSelf, aTabBrowser, aSplitter, aToggler);
			aSelf.updateTabbarOverflow();
			aSelf.updateAllTabsButton(aTabBrowser);
			delayedPostProcess = null;
			aSelf.mTabBrowser.style.visibility = '';

			var event = document.createEvent('Events');
			event.initEvent(aSelf.kEVENT_TYPE_TABBAR_INITIALIZED, true, false);
			aSelf.mTabBrowser.dispatchEvent(event);

			aSelf.startRendering();
		}, 0, this, b, splitter, toggler);

		b = null;
		pos = null;
		splitter = null;
		toggler = null;
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
		if (!this.isGecko2 && 'tabutils' in window)
			tabContainer.addEventListener('DOMAttrModified', this, true); // Tab Utilities
		tabContainer.addEventListener('mouseover', this, true);
		tabContainer.addEventListener('dblclick',  this, true);
		tabContainer.addEventListener('select', this, true);
		tabContainer.addEventListener('scroll', this, true);
		tabContainer.addEventListener('nsDOMMultipleTabHandler:TabsDragStart', this, true);

		var strip = this.tabStrip;
		strip.addEventListener('MozMouseHittest', this, true); // to block default behaviors of the tab bar
		strip.addEventListener('mousedown',       this, true);
		strip.addEventListener('click',           this, true);

		this.scrollBox.addEventListener('overflow', this, true);
		this.scrollBox.addEventListener('underflow', this, true);

		this.tabTooltip.addEventListener('popupshowing', this, true);
	},
 
	_initTabbarMethods : function TSTBrowser_initTabbarMethods() 
	{
		var b = this.mTabBrowser;

		var source = b.mTabContainer.advanceSelectedTab.toSource();
		if (source.indexOf('treeStyleTab.handleAdvanceSelectedTab') < 0) {
			eval('b.mTabContainer.advanceSelectedTab = '+
				source.replace(
					'{',
					<![CDATA[$&
						var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;
						if (treeStyleTab.handleAdvanceSelectedTab(arguments[0], arguments[1], this))
							return;
					]]>
				)
			);
		}

		source = b.mTabContainer._notifyBackgroundTab.toSource();
		if (source.indexOf('TreeStyleTabService.getTabBrowserFromChild') < 0) {
			eval('b.mTabContainer._notifyBackgroundTab = '+
				source.replace(
					'{',
					'{ var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;'
				).replace(
					/\.screenX/g, '[treeStyleTab.positionProp]'
				).replace(
					/\.width/g, '[treeStyleTab.sizeProp]'
				).replace(
					/\.left/g, '[treeStyleTab.startProp]'
				).replace(
					/\.right/g, '[treeStyleTab.endProp]'
				)
			);
		}

		if (b.tabContainer && '_getDropIndex' in b.tabContainer) { // Firefox 4.0 or later
			eval('b.tabContainer._getDropIndex = '+
				b.tabContainer._getDropIndex.toSource().replace(
					/\.screenX/g, '[this.treeStyleTab.positionProp]'
				).replace(
					/\.width/g, '[this.treeStyleTab.sizeProp]'
				)
			);
		}
		else if ('getNewIndex' in b) { // Firefox 3.6 or older
			eval('b.getNewIndex = '+
				b.getNewIndex.toSource().replace(
					/\.screenX/g, '[this.treeStyleTab.positionProp]'
				).replace(
					/\.width/g, '[this.treeStyleTab.sizeProp]'
				)
			);
		}
	},
 
	_ensureNewSplitter : function TSTBrowser__ensureNewSplitter() 
	{
		var splitter = this.splitter;

		// We always have to re-create splitter, because its "collapse"
		// behavior becomes broken by repositioning of the tab bar.
		if (splitter) {
			try {
				splitter.removeEventListener('mousedown', TreeStyleTabService, false);
				splitter.removeEventListener('mouseup', TreeStyleTabService, false);
				splitter.removeEventListener('dblclick', TreeStyleTabService, false);
			}
			catch(e) {
			}
			let oldSplitter = splitter;
			splitter = oldSplitter.cloneNode(true);
			oldSplitter.parentNode.removeChild(oldSplitter);
		}
		else {
			splitter = document.createElement('splitter');
			splitter.setAttribute('state', 'open');
			splitter.setAttribute('layer', true); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468
			splitter.appendChild(document.createElement('grippy'));
		}

		var splitterClass = splitter.getAttribute('class') || '';
		if (splitterClass.indexOf(this.kSPLITTER) < 0)
			splitterClass += (splitterClass ? ' ' : '' ) + this.kSPLITTER;
		splitter.setAttribute('class', splitterClass);

		splitter.addEventListener('mousedown', TreeStyleTabService, false);
		splitter.addEventListener('mouseup', TreeStyleTabService, false);
		splitter.addEventListener('dblclick', TreeStyleTabService, false);

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

		var b = this.mTabBrowser;
		var orient;
		var toggleTabsOnTop = document.getElementById('cmd_ToggleTabsOnTop');
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
					if ('TabsOnTop' in window) {
						// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=555987
						TabsOnTop.enabled = !TabsOnTop.enabled;
						window.setTimeout(function() {
							TabsOnTop.enabled = !TabsOnTop.enabled;
						}, 0);
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

		if ('TabsOnTop' in window)
			TabsOnTop.enabled = TabsOnTop.enabled && this.position == 'top' && this.fixed;

		window.setTimeout(function(aSelf) {
			aSelf.updateFloatingTabbar(aSelf.kTABBAR_UPDATE_BY_APPEARANCE_CHANGE);
			aSelf._fireTabbarStateChangedEvent();
			aSelf.startRendering();
		}, 0, this);

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

		if (this._updateFloatingTabbarTimer) {
			window.clearTimeout(this._updateFloatingTabbarTimer);
			this._updateFloatingTabbarTimer = null;
		}

		this._updateFloatingTabbarReason |= aReason;

		if (this._updateFloatingTabbarReason & this.kTABBAR_UPDATE_NOW) {
			this._updateFloatingTabbarInternal(this.updateFloatingTabbarReason);
			this._updateFloatingTabbarReason = 0;
		}
		else {
			this._updateFloatingTabbarTimer = window.setTimeout(function(aSelf) {
				aSelf._updateFloatingTabbarTimer = null;
				aSelf._updateFloatingTabbarInternal(aSelf._updateFloatingTabbarReason)
				aSelf._updateFloatingTabbarReason = 0;
			}, 0, this);
		}
	},
	
	_updateFloatingTabbarInternal : function TSTBrowser_updateFloatingTabbarInternal(aReason) 
	{
		aReason = aReason || this.kTABBAR_UPDATE_BY_UNKNOWN_REASON;

		if (this.splitter.collapsed || this.splitter.getAttribute('state') != 'collapsed') {
			this._tabStripPlaceHolder.collapsed =
				this.splitter.collapsed =
					(this.getPref('browser.tabs.autoHide') && this.getTabsArray(this.mTabBrowser).length == 1);
		}

		var strip = this.tabStrip;
		var tabContainerBox = this.getTabContainerBox(this.mTabBrowser);
		var statusPanel = document.getElementById('statusbar-display');
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
			let root = document.documentElement.boxObject;

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
			let xOffset = pos == 'right' ? width - realWidth : 0 ;
			let yOffset = pos == 'bottom' ? height - realHeight : 0 ;

			strip.style.top = (box.screenY - root.screenY + root.y - yOffset)+'px';
			strip.style.left = (box.screenX - root.screenX + root.x - xOffset)+'px';

			strip.style.width = (tabContainerBox.width = width)+'px';
			strip.style.height = (tabContainerBox.height = height)+'px';

			this._updateFloatingTabbarResizer({
				width      : width,
				realWidth  : realWidth,
				height     : height,
				realHeight : realHeight
			});

			tabContainerBox.collapsed = (this.splitter && this.splitter.getAttribute('state') == 'collapsed');

			if (statusPanel) {
				statusPanel.style.marginTop = (pos == 'bottom') ?
					'-moz-calc(0px - ' + height + 'px - 3em)' :
					'' ;
			}

			this.mTabBrowser.tabContainer.setAttribute('context', this.mTabBrowser.tabContextMenu.id);
		}
		else {
			tabContainerBox.collapsed = false;
			strip.style.top = '';
			strip.style.left = '';
			strip.style.width = '';
			strip.style.height = '';

			if (statusPanel) {
				statusPanel.style.marginTop = '';
			}

			strip.removeAttribute('layer'); // https://bugzilla.mozilla.org/show_bug.cgi?id=590468

			this.mTabBrowser.tabContainer.removeAttribute('context');
		}

		this.positionPinnedTabs();
	},
 
	_updateFloatingTabbarResizer : function TSTBrowser_updateFloatingTabbarResizer(aSize) 
	{
		var width      = aSize.width;
		var realWidth  = this.autoHide.mode == this.autoHide.kMODE_HIDE ? 0 : aSize.realWidth ;
		var height     = aSize.height;
		var realHeight = this.autoHide.mode == this.autoHide.kMODE_HIDE ? 0 : aSize.realHeight ;
		var pos        = this.position;
		var vertical = this.isVertical;

		var splitter = document.getElementById('treestyletab-tabbar-resizer-splitter');
		if (!splitter) {
			let box = document.createElement('box');
			box.setAttribute('id', 'treestyletab-tabbar-resizer-box');
			splitter = document.createElement('splitter');
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
		var b = this.mTabBrowser;
		b.mTabContainer.removeAttribute('overflow'); // Firefox 4.0
		var container = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-container');

		if (!container) {
			if (this.ownerToolbar)
				container = b.mTabContainer;
			else
				return;
		}

		container.removeAttribute('overflow');

		var scrollBox = this.scrollBox;
		window.setTimeout(function() {
			scrollBox = document.getAnonymousElementByAttribute(scrollBox, 'anonid', 'scrollbox');
			if (scrollBox) scrollBox = document.getAnonymousNodes(scrollBox)[0];
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

		this.tabbarDNDObserver.destroy();
		delete this._tabbarDNDObserver;
		this.panelDNDObserver.destroy();
		delete this._panelDNDObserver;

		var b = this.mTabBrowser;
		delete b.tabContainer.treeStyleTab;

		this.getAllTabsArray(b).forEach(function(aTab) {
			this.stopTabIndentAnimation(aTab);
			this.stopTabCollapseAnimation(aTab);
			this.destroyTab(aTab);
		}, this);

		this._endListenTabbarEvents();

		window.removeEventListener('resize', this, true);
		window.removeEventListener('beforecustomization', this, true);
		window.removeEventListener('aftercustomization', this, false);
		window.removeEventListener('customizationchange', this, false);
		window.removeEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED, this, false);
		window.removeEventListener(this.kEVENT_TYPE_PRINT_PREVIEW_EXITED,  this, false);

		b.removeEventListener('nsDOMMultipleTabHandlerTabsClosing', this, false);

		window['piro.sakura.ne.jp'].tabsDragUtils.destroyTabBrowser(b);

		var tabContextMenu = b.tabContextMenu ||
							document.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
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
		if (!this.ownerToolbar && 'tabutils' in window)
			b.mTabContainer.removeEventListener('DOMAttrModified', this, true); // Tab Utilites
		tabContainer.removeEventListener('mouseover', this, true);
		tabContainer.removeEventListener('dblclick',  this, true);
		tabContainer.removeEventListener('select', this, true);
		tabContainer.removeEventListener('scroll', this, true);
		tabContainer.removeEventListener('nsDOMMultipleTabHandler:TabsDragStart', this, true);

		var strip = this.tabStrip;
		strip.removeEventListener('MozMouseHittest', this, true);
		strip.removeEventListener('mousedown',       this, true);
		strip.removeEventListener('click',           this, true);

		this.scrollBox.removeEventListener('overflow', this, true);
		this.scrollBox.removeEventListener('underflow', this, true);

		this.tabTooltip.removeEventListener('popupshowing', this, true);
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
				window,
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

		window.setTimeout(function(aSelf) {
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
		Array.slice(document.querySelectorAll('.'+this.kTABBAR_TOOLBAR_READY_POPUP))
			.forEach(function(aPanel) {
				this.safeRemovePopup(aPanel);
			}, this);

		var position = this._lastTabbarPositionBeforeDestroyed || this.position;
		delete this._lastTabbarPositionBeforeDestroyed;

		var self = this;
		this.doAndWaitDOMEvent(
			this.kEVENT_TYPE_TABBAR_INITIALIZED,
			window,
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
		var newToolbar = this.ownerToolbar;
		newToolbar.classList.add(this.kTABBAR_TOOLBAR_READY);

		var oldToolbar = document.querySelector('.'+this.kTABBAR_TOOLBAR_READY);
		if (oldToolbar == newToolbar)
			return;

		if (oldToolbar && oldToolbar != newToolbar) {
			this.safeRemovePopup(document.getElementById(oldToolbar.id+'-'+this.kTABBAR_TOOLBAR_READY_POPUP));
			oldToolbar.classList.remove(this.kTABBAR_TOOLBAR_READY);
		}

		var id = newToolbar.id+'-'+this.kTABBAR_TOOLBAR_READY_POPUP;
		var panel = document.getElementById(id);
		if (!panel) {
			panel = document.createElement('panel');
			panel.setAttribute('id', id);
			panel.setAttribute('class', this.kTABBAR_TOOLBAR_READY_POPUP);
			panel.setAttribute('noautohide', true);
			panel.setAttribute('onmouseover', 'this.hidePopup()');
			panel.setAttribute('ondragover', 'this.hidePopup()');
			panel.appendChild(document.createElement('label'));
			let position = this._lastTabbarPositionBeforeDestroyed || this.position;
			let label = this.treeBundle.getString('toolbarCustomizing_tabbar_'+(position == 'left' || position == 'right' ? 'vertical' : 'horizontal' ));
			panel.firstChild.appendChild(document.createTextNode(label));
			document.getElementById('mainPopupSet').appendChild(panel);
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
				if (!aSubject || aSubject == window) {
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
				return this.updateFloatingTabbar(this.kTABBAR_UPDATE_BY_WINDOW_RESIZE);

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
				let (toggler = document.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER)) {
					if (toggler) {
						if (value)
							toggler.removeAttribute('hidden');
						else
							toggler.setAttribute('hidden', true);
					}
				}
				return;

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
		if (!window.__SS_tabsToRestore)
			return;
	},
 
	saveTreeStructureWithDelay : function TSTBrowser_saveTreeStructureWithDelay() 
	{
		if (this.restoringTree || this.saveTreeStructureWithDelayTimer)
			return;

		this.saveTreeStructureWithDelayTimer = window.setTimeout(function(aSelf) {
			aSelf.saveTreeStructureWithDelayTimer = null;
			aSelf.saveTreeStructure();
		}, this.getPref('browser.sessionstore.interval'), this);
	},
	saveTreeStructureWithDelayTimer : null,
	saveTreeStructure : function TSTBrowser_saveTreeStructure()
	{
		if (!this.getTreePref('restoreTreeOnStartup'))
			return;

		var treeStructures = JSON.parse(this.SessionStore.getWindowValue(window, this.kSTRUCTURE) || '{}');
		var id = this.mTabBrowser.getAttribute('id');
		var tabs = this.getAllTabsArray(this.mTabBrowser);
		treeStructures[id] = {
			tree : this.getTreeStructureFromTabs(tabs),
			collapsed : tabs.filter(function(aTab) {
								return this.isCollapsed(aTab);
							}, this).map(function(aTab) {
								return aTab._tPos;
							}),
			treeCollapsed : tabs.filter(function(aTab) {
								return this.isSubtreeCollapsed(aTab);
							}, this).map(function(aTab) {
								return aTab._tPos;
							})
		};
		this.SessionStore.setWindowValue(window, this.kSTRUCTURE, JSON.stringify(treeStructures))
	},
 
	restoreTreeStructure : function TSTBrowser_restoreTreeStructure() 
	{
		if (!this.getTreePref('restoreTreeOnStartup'))
			return;

		this.restoreTreeStructure();

		var treeStructures = JSON.parse(this.SessionStore.getWindowValue(window, this.kSTRUCTURE) || '{}');
		var id = this.mTabBrowser.getAttribute('id');
		var treeStructure = id in treeStructures ? treeStructures[id] : null ;
		if (
			!treeStructure ||
			!treeStructure.tree ||
			!treeStructure.tree.length
			)
			return;

		this.applyTreeStructureToTabBrowser(this.mTabBrowser, treeStructure.tree);

		this.getAllTabsArray(this.mTabBrowser)
			.forEach(function(aTab, aIndex) {
				if (treeStructure.treeCollapsed &&
					treeStructure.treeCollapsed.indexOf(aIndex) > -1)
					aTab.setAttribute(this.kSUBTREE_COLLAPSED, true);

				if (treeStructure.collapsed &&
					treeStructure.collapsed.indexOf(aIndex) > -1)
					this.collapseExpandTab(aTab, true, true);

				aTab.removeAttribute(this.kID);
				aTab.removeAttribute(this.kPARENT);
				aTab.removeAttribute(this.kCHILDREN);
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
				return this.onPopupShowing(aEvent)

			case 'mouseover':
				let (tab = aEvent.target) {
					if (tab.__treestyletab__twistyHoverTimer)
						window.clearTimeout(tab.__treestyletab__twistyHoverTimer);
					if (this.isEventFiredOnTwisty(aEvent))
						tab.__treestyletab__twistyHoverTimer = window.setTimeout(function(aSelf) {
							tab.setAttribute(aSelf.kTWISTY_HOVER, true);
						}, 0, this);
					else
						tab.removeAttribute(this.kTWISTY_HOVER);
				}
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


			case this.kEVENT_TYPE_PRINT_PREVIEW_ENTERED:
				return this.onTreeStyleTabPrintPreviewEntered(aEvent);
			case this.kEVENT_TYPE_PRINT_PREVIEW_EXITED:
				return this.onTreeStyleTabPrintPreviewExited(aEvent);


			case 'nsDOMMultipleTabHandlerTabsClosing':
				if (!this.onTabsRemoving(aEvent))
					aEvent.preventDefault();
				return;

			// cancel tab dragging by Multiple Tab
			case 'nsDOMMultipleTabHandler:TabsDragStart':
				return aEvent.preventDefault();
		}
	},
	lastScrollX : -1,
	lastScrollY : -1,
	
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
				(this.multipleCount == 0 || this._addedCountInThisLoop == 0)
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
			this._addedCountClearTimer =window.setTimeout(function(aSelf) {
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

		if (!TreeStyleTabService.restoringTree &&
			!this.useTMPSessionAPI &&
			!this._checkRestoringWindowTimerOnTabAdded) {
			this._checkRestoringWindowTimerOnTabAdded = window.setTimeout(function(aSelf) {
				aSelf._checkRestoringWindowTimerOnTabAdded = null;
				if (aSelf.getRestoringTabsCount() > 1)
					TreeStyleTabService.restoringTree = true;
			}, 0, this);
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

		return true;
	},
	_addedCountInThisLoop : 0,
	_addedCountClearTimer : null,
	_checkRestoringWindowTimerOnTabAdded : null,
 
	onTabRemoved : function TSTBrowser_onTabRemoved(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.mTabBrowser;

		tab.setAttribute(this.kREMOVED, true);

		this.stopTabIndentAnimation(tab);
		this.stopTabCollapseAnimation(tab);

		var closeParentBehavior = this.getTreePref('closeParentBehavior');
		var closeRootBehavior = this.getTreePref('closeRootBehavior');

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
			let behavior = parentTab ? closeParentBehavior : closeRootBehavior ;
			if (behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD &&
				parentTab &&
				this.getChildTabs(parentTab).length == 1)
				behavior = this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN;
			indentModifiedTabs = indentModifiedTabs.concat(
					behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD ?
						[children[0]] :
						children
				);
			this.partAllChildren(tab, {
				behavior         : behavior,
				dontUpdateIndent : true
			});
			if (behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_ALL_CHILDREN ||
				behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD)
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

			this.partTab(tab, { dontUpdateIndent : true });

			if (shouldCloseParentTab) {
				window.setTimeout(function() {
					if (parentTab.parentNode)
						b.removeTab(parentTab, { animate : true });
					parentTab = null;
					b = null;
				}, 0);
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
			if (
				nextFocusedTab &&
				!nextFocusedTab.hidden
				) {
				let event = document.createEvent('Events');
				event.initEvent(this.kEVENT_TYPE_FOCUS_NEXT_TAB, true, true);
				let canFocus = tab.dispatchEvent(event);

				// for backward compatibility
				event = document.createEvent('Events');
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

		window.setTimeout(function(aSelf) {
			trees.forEach(function(aTabs) {
				aSelf.fireTabSubtreeClosedEvent(b, aTabs[0], aTabs);
			});
		}, 0, this);

		return true;
	},
 
	onTabMove : function TSTBrowser_onTabMove(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.mTabBrowser;

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
				this.partTab(aTab);
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
		this.updateInvertedTabContentsOrder(aEvent.originalTarget);

		if (this.tabVisibilityChangedTimer) {
			window.clearTimeout(this.tabVisibilityChangedTimer);
			this.tabVisibilityChangedTimer = null;
		}
		this.tabVisibilityChangedTabs.push(aEvent.originalTarget);
		this.tabVisibilityChangedTimer = window.setTimeout(function(aSelf) {
			aSelf.tabVisibilityChangedTimer = null;
			var tabs = aSelf.tabVisibilityChangedTabs;
			aSelf.tabVisibilityChangedTabs = [];
			aSelf.updateTreeByTabVisibility(tabs);
		}, 0, this);
	},
	tabVisibilityChangedTimer : null,
	tabVisibilityChangedTabs : [],
	updateTreeByTabVisibility : function TSTBrowser_updateTreeByTabVisibility(aChangedTabs)
	{
		this.internallyTabMovingCount++;
		var tabs = this.getAllTabsArray(this.mTabBrowser);
		aChangedTabs = aChangedTabs || tabs;
		var lastVisibleTab = this.getLastVisibleTab(this.mTabBrowser);
		tabs.reverse().forEach(function(aTab) {
			var parent = this.getParentTab(aTab);
			var attached = false;
			if (parent && aTab.hidden != parent.hidden) {
				var ancestor = parent;

				var lastNextTab = null;
				while (ancestor = this.getParentTab(ancestor))
				{
					if (ancestor.hidden == aTab.hidden) {
						this.attachTabTo(aTab, ancestor, {
							dontMove     : true,
							insertBefore : lastNextTab
						});
						attached = true;
						break;
					}
					lastNextTab = this.getNextSiblingTab(ancestor);
				}
				if (!attached) {
					this.collapseExpandTab(aTab, false, true);
					this.partTab(aTab);
				}
			}

			if (
				!aTab.hidden &&
				!attached &&
				!parent &&
				aChangedTabs.indexOf(aTab) > -1
				)
				this.attachTabFromPosition(aTab, tabs.length-1);

			// Hidden tabs have to be moved below visible tabs, because
			// sometimes hidden tabs between visible tabs break tree
			// structure.
			if (aTab.hidden) {
				let newPos = lastVisibleTab._tPos;
				if (aTab.tPos < lastVisibleTab._tPos) newPos--;
				this.mTabBrowser.moveTabTo(aTab, newPos);
			}
		}, this);
		this.internallyTabMovingCount--;
	},
 
	onTabRestoring : function TSTBrowser_onTabRestoring(aEvent) 
	{
		this.restoreStructure(aEvent.originalTarget);

		if (!aEvent.originalTarget.selected &&
			this.mTabBrowser.currentURI.spec == 'about:sessionrestore') {
			let frame = this.mTabBrowser.contentWindow;
			frame = frame.wrappedJSObject || frame;
			let tree = frame.document.getElementById('tabList');
			let data = frame.gTreeData;
			if (tree && data) {
				let item = data[tree.currentIndex];
				window.setTimeout(function(aSelf, aTab, aTitle, aParent) {
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
		/*
			ウィンドウの復元では以下の順に処理が走る。

				nsSessionStore::restoreWindow()
				nsSessionStore::restoreHistoryPrecursor()
				<タブの復元開始>
				nsSessionStore::restoreHistory() // 現在のタブの復元
				(SSTabRestoring DOMEvent fired)
				(sessionstore-windows-restored nsIObserver notification)
				nsSessionStore::restoreHistory() // 0番目のタブの復元
				(SSTabRestoring DOMEvent fired)
				...
				nsSessionStore::restoreHistory() // 最後のタブの復元
				(SSTabRestoring DOMEvent fired)
				<タブの復元終了>
				nsSessionStore::restoreDocument_proxy() // 最初のタブの復元完了
				(SSTabRestored DOMEvent fired)
				...
				nsSessionStore::restoreDocument_proxy() // 最後のタブの復元完了
				(SSTabRestored DOMEvent fired)
				<タブの復元完了>

			この時、nsSessionStore::restoreHistoryPrecursor() 内で
			nsSessionStore::restoreHistory() が呼ばれるより前に、
			これから復元するすべてのタブについて
			tab.linkedBrowser.__SS_data._tabStillLoading (Firefox 3.6-)
			または
			tab.linkedBrowser.parentNode.__SS_data._tabStillLoading (-Firefox 3.5)
			がtrueにセットされる。
			そのタブの読み込みが完了した時、
			tab.linkedBrowser.__SS_data (Firefox 3.6-)
			または
			tab.linkedBrowser.parentNode.__SS_data (-Firefox 3.5)
			はdeleteされる。

			以上のことから、sessionstore-windows-restored が通知された段階で
			_tabStillLoadingがtrueであるタブがウィンドウ内に2個以上存在して
			いれば、それは、そのウィンドウが復元中であることを示す証拠となる。
			よって、restoringTree を true に設定する。

			restoringTree が true である場合は、SSTabRestored が発行される度に
			_tabStillLoadingがtrueであるタブの数を確認し、数が1以下であれば
			restoringTree を false にする。

			restoringTree は、次の sessionstore-windows-restored が通知される
			までは true になることはない。そのため、手動で連続してタブを複数
			復元したとしても、それがウィンドウ復元中のタブの復元と誤認される
			心配はない。
		*/
		var restoringMultipleTabs = TreeStyleTabService.restoringTree;

		var tab = aTab;
		var b   = this.mTabBrowser;
		var id  = this.getTabValue(tab, this.kID);
		var mayBeDuplicated = false;

		tab.setAttribute(this.kID_RESTORING, id);
		if (this.isTabDuplicated(tab)) {
			mayBeDuplicated = true;
			id = this.redirectId(id);
		}
		tab.removeAttribute(this.kID_RESTORING);

		var children = this.getTabValue(tab, this.kCHILDREN);
		if (!mayBeDuplicated || tab.hasAttribute(this.kCHILDREN)) {
			// for safety
			this.partAllChildren(tab, {
				dontUpdateIndent : true,
				dontAnimate      : restoringMultipleTabs
			});
		}

		var closeSetId = null;
		if (!mayBeDuplicated) {
			closeSetId = this.getTabValue(tab, this.kCLOSED_SET_ID);
			/* If it has a parent, it is wrongly attacched by tab moving
			   on restoring. Restoring the old ID (the next statement)
			   breaks the children list of the temporary parent and causes
			   many problems. So, to prevent these problems, I part the tab
			   from the temporary parent manually.
			   If the ID stored in the session equals to the value of the
			   attribute stored in the element itself, then don't reset the
			   tab, because the restoring session is got from the tab itself.
			   ( like SS.setTabState(tab, SS.getTabState(tab)) )
			 */
			if (id != tab.getAttribute(this.kID))
				this.resetTab(tab, false);
		}
		this.deleteTabValue(tab, this.kCLOSED_SET_ID);

		this.setTabValue(tab, this.kID, id);
		this.tabsHash[id] = tab;

		if (closeSetId)
			this.restoreClosedSet(closeSetId, tab);

		var shouldCollapse = this.getTreePref('collapseExpandSubtree.sessionRestore');
		var isSubtreeCollapsed = (
				restoringMultipleTabs &&
				(
					shouldCollapse == this.RESTORED_TREE_COLLAPSED_STATE_LAST_STATE ?
						(this.getTabValue(tab, this.kSUBTREE_COLLAPSED) == 'true') :
						shouldCollapse == this.RESTORED_TREE_COLLAPSED_STATE_COLLAPSED
				)
			);
		this.setTabValue(tab, this.kSUBTREE_COLLAPSED, isSubtreeCollapsed);

		var tabs = [];
		if (children) {
			tab.removeAttribute(this.kCHILDREN);
			children = children.split('|');
			if (mayBeDuplicated)
				children = children.map(function(aChild) {
					return this.redirectId(aChild);
				}, this);
			children.forEach(function(aTab) {
				if (aTab && (aTab = this.getTabById(aTab))) {
					this.attachTabTo(aTab, tab, {
						dontExpand       : restoringMultipleTabs,
						dontUpdateIndent : true,
						dontAnimate      : restoringMultipleTabs
					});
					tabs.push(aTab);
				}
			}, this);
			children = children.join('|');
			if (tab.getAttribute(this.kCHILDREN) == children)
				tab.removeAttribute(this.kCHILDREN_RESTORING);
			else
				tab.setAttribute(this.kCHILDREN_RESTORING, children);
		}

		var nextTab = this.getTabValue(tab, this.kINSERT_BEFORE);
		if (nextTab && mayBeDuplicated) nextTab = this.redirectId(nextTab);
		nextTab = this.getTabById(nextTab);

		if (!nextTab) {
			let prevTab = this.getTabValue(tab, this.kINSERT_AFTER);
			if (prevTab && mayBeDuplicated) prevTab = this.redirectId(prevTab);
			prevTab = this.getTabById(prevTab);
			nextTab = this.getNextSiblingTab(prevTab);
		}

		var ancestors = (this.getTabValue(tab, this.kANCESTOR) || this.getTabValue(tab, this.kPARENT)).split('|');
		var parent = null;
		for (var i in ancestors)
		{
			if (mayBeDuplicated) ancestors[i] = this.redirectId(ancestors[i]);
			parent = this.getTabById(ancestors[i]);
			if (parent) {
				parent = ancestors[i];
				break;
			}
		}
		this.deleteTabValue(tab, this.kANCESTOR);

		if (parent) {
			tab.removeAttribute(this.kPARENT);
			parent = this.getTabById(parent);
			if (parent) {
				this.attachTabTo(tab, parent, {
					dontExpand       : restoringMultipleTabs,
					insertBefore     : nextTab,
					dontUpdateIndent : true,
					dontAnimate      : restoringMultipleTabs
				});
				this.updateTabsIndent([tab], undefined, restoringMultipleTabs);
				this.checkTabsIndentOverflow();

				if (parent.getAttribute(this.kCHILDREN_RESTORING))
					this.correctChildTabsOrderWithDelay(parent);

			}
			else {
				this.deleteTabValue(tab, this.kPARENT);
			}
		}
		else if (children) {
			this.updateTabsIndent(tabs, undefined, restoringMultipleTabs);
			this.checkTabsIndentOverflow();
		}

		if (!parent) {
			if (!nextTab) nextTab = this.getNextTab(tab);
			let parentOfNext = this.getParentTab(nextTab);
			let newPos = -1;
			if (parentOfNext) {
				let descendants = this.getDescendantTabs(parentOfNext);
				newPos = descendants[descendants.length-1]._tPos;
			}
			else if (nextTab) {
				newPos = nextTab._tPos;
				if (newPos > tab._tPos) newPos--;
			}
			if (newPos > -1)
				b.moveTabTo(tab, newPos);
		}

		if (isSubtreeCollapsed)
			this.collapseExpandSubtree(tab, isSubtreeCollapsed, restoringMultipleTabs);

		if (mayBeDuplicated)
			this.clearRedirectionTable();
	},
 
	correctChildTabsOrderWithDelay : function TSTBrowser_correctChildTabsOrderWithDelay(aTab) 
	{
		if (aTab.correctChildTabsOrderWithDelayTimer)
			window.clearTimeout(aTab.correctChildTabsOrderWithDelayTimer);

		aTab.correctChildTabsOrderWithDelayTimer = window.setTimeout(function(aSelf) {
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
			window.clearTimeout(this._clearRedirectionTableTimer);
			this._clearRedirectionTableTimer = null;
		}
		this._clearRedirectionTableTimer = window.setTimeout(function(aSelf) {
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
			this.useTMPSessionAPI ||
			this._restoringClosedSet ||
			!(behavior & this.kUNDO_CLOSE_SET || behavior & this.kUNDO_ASK)
			)
			return;

		var items = this.evalInSandbox('('+this.SessionStore.getClosedTabData(window)+')');
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
		if (!PlacesUIUtils._confirmOpenInTabs(aIndexes.length))
			return;

		this._restoringClosedSet = true;
		this.stopRendering();

		TreeStyleTabService.restoringTree = true;

		var offset = 0;
		aIndexes.forEach(function(aIndex) {
			undoCloseTab(aIndex - (offset++));
		});

		window.setTimeout(function(aSelf, aNextFocused) {
			aSelf.mTabBrowser.selectedTab = aNextFocused;
		}, 0, this, aRestoredTab || aSelf.mTabBrowser.selectedTab);

		this.startRendering();
		this._restoringClosedSet = false;
	},
	_restoringClosedSet : false,
  
	onTabRestored : function TSTBrowser_onTabRestored(aEvent) 
	{
		delete aEvent.originalTarget.__treestyletab__restoredByUndoCloseTab;

		// update the status for the next restoring
		if (!this.useTMPSessionAPI && TreeStyleTabService.restoringTree)
			TreeStyleTabService.restoringTree = TreeStyleTabService.getRestoringTabsCount() > 0;
	},
 
	onPinTab : function TSTBrowser_onPinTab(aTab) 
	{
		var parentTab = this.getParentTab(aTab);

		if (!parentTab)
			this.collapseExpandSubtree(aTab, false);

		this.getChildTabs(aTab).reverse().forEach(
			parentTab ?
				function(aChildTab) {
					this.attachTabTo(aChildTab, parentTab, {
						dontExpand : true,
						dontMove   : true
					});
				} :
				this.partTab,
		this);
		this.partTab(aTab);

		this.collapseExpandTab(aTab, false);
		if (this.isVertical) this.positionPinnedTabsWithDelay();
	},
 
	onUnpinTab : function TSTBrowser_onUnpinTab(aTab) 
	{
		aTab.style.marginLeft = '';
		aTab.style.marginTop = '';

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

		/* <tabbrowser>.previewTab() focuses to the tab internally,
		   so we should ignore this event if it is fired from previewTab(). */
		if (b._previewMode)
			return;

		if (this.isCollapsed(tab)) {
			if (this.getTreePref('autoExpandSubtreeOnCollapsedChildFocused')) {
				var parentTab = tab;
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

			if (
				this._focusChangedByShortcut &&
				this.accelKeyPressed &&
				!this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut')
				) {
				TreeStyleTabService.expandTreeAfterKeyReleased(tab);
			}
			else {
				this.collapseExpandTreesIntelligentlyWithDelayFor(tab);
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
 
	handleAdvanceSelectedTab : function TSTBrowser_handleAdvanceSelectedTab(aDir, aWrap, aTabbar) 
	{
		this._focusChangedByShortcut = TreeStyleTabService.accelKeyPressed;

		if (!this.canCollapseSubtree(aTabbar.selectedItem) ||
			this.getTreePref('focusMode') != this.kFOCUS_VISIBLE)
			return false;

		var nextTab = (aDir < 0) ? this.getPreviousVisibleTab(aTabbar.selectedItem) : this.getNextVisibleTab(aTabbar.selectedItem) ;
		if (!nextTab && aWrap) {
			nextTab = this.evaluateXPath(
					'child::xul:tab[not(@'+this.kCOLLAPSED+'="true")]['+
					(aDir < 0 ? 'last()' : '1' )+
					']',
					aTabbar,
					XPathResult.FIRST_ORDERED_NODE_TYPE
				).singleNodeValue;
		}
		if (nextTab && nextTab != aTabbar.selectedItem)
			aTabbar._selectNewTab(nextTab, aDir, aWrap);

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
		var clickedPoint = aEvent[this.positionProp];
		this.getTabsArray(this.mTabBrowser).some(function(aTab) {
			var box = aTab.boxObject;
			if (box[this.positionProp] > clickedPoint ||
				box[this.positionProp] + box[this.sizeProp] < clickedPoint) {
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
			aEvent.target.ownerDocument != document ||
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
		if (this.lastScrollX < 0 || this.lastScrollY < 0) return;
		var x = {}, y = {};
		var scrollBoxObject = this.scrollBoxObject;
		scrollBoxObject.getPosition(x, y);
		if (x.value != this.lastScrollX || y.value != this.lastScrollY)
			scrollBoxObject.scrollTo(this.lastScrollX, this.lastScrollY);
		this.lastScrollX = -1;
		this.lastScrollY = -1;
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
		if (aEvent.target.localName == 'tooltip')
			this.handleTooltip(aEvent);
		else if (aEvent.target == aEvent.currentTarget)
			this.initTabContextMenu(aEvent);
	},
	
	handleTooltip : function TSTBrowser_handleTooltip(aEvent) 
	{
		var tab = document.tooltipNode;
		if (tab.localName != 'tab')
			return;

		var label;
		var collapsed = this.isSubtreeCollapsed(tab);

		var base = parseInt(tab.getAttribute(this.kNEST) || 0);
		var descendant = this.getDescendantTabs(tab);
		var indentPart = '  ';
		var tree = (this.getTreePref('tooltip.includeChildren') && descendant.length) ?
					[tab].concat(descendant)
						.map(function(aTab) {
							let label = aTab.getAttribute('label');
							let indent = '';
							let nest = parseInt(aTab.getAttribute(this.kNEST) || 0) - base;
							for (let i = 0; i < nest; i++)
							{
								indent += indentPart;
							}
							return this.treeBundle.getFormattedString('tooltip.item.label', [label, indent]);
						}, this)
						.join('\n') :
					null ;

		if ('mOverCloseButton' in tab && tab.mOverCloseButton) {
			if (descendant.length &&
				(collapsed || this.getTreePref('closeParentBehavior') == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)) {
				label = this.treeBundle.getString('tooltip.closeTree');
			}
		}
		else if (tab.getAttribute(this.kTWISTY_HOVER) == 'true') {
			let key = collapsed ?
						'tooltip.expandSubtree' :
						'tooltip.collapseSubtree' ;
			label = tree || tab.getAttribute('label');
			label = label ?
					this.treeBundle.getFormattedString(key+'.labeled', [label]) :
					this.treeBundle.getString(key) ;
		}
		else if (collapsed) {
			label = tree;
		}

		if (label) {
			aEvent.target.setAttribute('label', label);
			aEvent.stopPropagation();
		}
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
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
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
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		let collapseItem = items[this.kMENUITEM_COLLAPSE];
		let expanndItem = items[this.kMENUITEM_EXPAND];
		if (this.canCollapseSubtree(b) &&
			this.evaluateXPath(
				'child::xul:tab[@'+this.kCHILDREN+']',
				b.mTabContainer
			).snapshotLength) {
			if (this.evaluateXPath(
					'child::xul:tab[@'+this.kCHILDREN+' and not(@'+this.kSUBTREE_COLLAPSED+'="true")]',
					b.mTabContainer
				).snapshotLength)
				collapseItem.removeAttribute('disabled');
			else
				collapseItem.setAttribute('disabled', true);

			if (this.evaluateXPath(
					'child::xul:tab[@'+this.kCHILDREN+' and @'+this.kSUBTREE_COLLAPSED+'="true"]',
					b.mTabContainer
				).snapshotLength)
				expanndItem.removeAttribute('disabled');
			else
				expanndItem.setAttribute('disabled', true);
		}
		else {
			collapseItem.setAttribute('hidden', true);
			expanndItem.setAttribute('hidden', true);
		}
		if (collapseItem.getAttribute('hidden') == 'true' &&
			expanndItem.getAttribute('hidden') == 'true') {
			sep.setAttribute('hidden', true);
		}
		else {
			sep.removeAttribute('hidden');
		}

		// close all tabs but this tree
		let removeAllTabsBut = items[this.kMENUITEM_REMOVEALLTABSBUT];
		let rootTabs = this.visibleRootTabs;
		if (rootTabs.length == 1 && rootTabs[0] == b.mContextTab)
			removeAllTabsBut.setAttribute('disabled', true);
		else
			removeAllTabsBut.removeAttribute('disabled');

		// auto hide
		let autohide = items[this.kMENUITEM_AUTOHIDE];
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
		fixed.setAttribute('label', fixed.getAttribute(fixedLabel));
		if (fixedPref)
			fixed.setAttribute('checked', true);
		else
			fixed.removeAttribute('checked');

		sep = this.evaluateXPath(
			'descendant::xul:menuseparator[starts-with(@id, "'+this.kMENUITEM_AUTOHIDE_SEPARATOR+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (autohide.getAttribute('hidden') != 'true' ||
			fixed.getAttribute('hidden') != 'true') {
			sep.removeAttribute('hidden');
		}
		else {
			sep.setAttribute('hidden', true);
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
		window.setTimeout(function(aTabBrowser) {
			TreeStyleTabService.toggleFixed(aTabBrowser);
			window.setTimeout(function() {
				if (TabsOnTop.enabled != aEnabled)
					TabsOnTop.enabled = aEnabled;
			}, 0);
		}, 0, this.mTabBrowser);
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
			this.partAllChildren(aTab, {
				dontUpdateIndent : true,
				dontAnimate      : true
			});

		this.partTab(aTab, {
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
		this._treeViewEnabled = !!aValue;
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
  
/* attach/part */ 
	
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

		this.partTab(aChild, {
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
			if (descendant.length) refTab = descendant[descendant.length-1];
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

		if (!aInfo.dontExpand) {
			if (this.getTreePref('autoCollapseExpandSubtreeOnSelect')) {
				if (this.shouldTabAutoExpanded(aParent))
					this.collapseExpandTreesIntelligentlyFor(aParent);
				var p = aParent;
				do {
					if (this.shouldTabAutoExpanded(p))
						this.collapseExpandSubtree(p, false, aInfo.dontAnimate);
				}
				while (p = this.getParentTab(p));
			}
			else if (this.shouldTabAutoExpanded(aParent)) {
				if (this.getTreePref('autoExpandSubtreeOnAppendChild')) {
					var p = aParent;
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
 
	partTab : function TSTBrowser_partTab(aChild, aInfo) /* PUBLIC API */ 
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
			window.setTimeout(function(aTabBrowser) {
				if (parentTab.parentNode)
					aTabBrowser.removeTab(parentTab, { animate : true });
				parentTab = null;
			}, 0, this.getTabBrowserFromChild(parentTab));
		}
	},
	detachTab : function TSTBrowser_detachTab(aChild, aInfo) // alias (unstable API!)
	{
		return this.partTab(aChild, aInfo);
	},
	
	partAllChildren : function TSTBrowser_partAllChildren(aTab, aInfo) 
	{
		aInfo = aInfo || {};
		if (!('behavior' in aInfo))
			aInfo.behavior = this.kCLOSE_PARENT_BEHAVIOR_SIMPLY_DETACH_ALL_CHILDREN;
		if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)
			aInfo.behavior = this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD;

		var dontUpdateIndent = aInfo.dontUpdateIndent;

		var b = this.mTabBrowser;
		var parentTab = this.getParentTab(aTab);
		var children = this.getChildTabs(aTab);
		var insertBefore = null;
		if (aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN &&
			!this.getTreePref('closeParentBehavior.moveDetachedTabsToBottom')) {
			insertBefore = this.getNextSiblingTab(this.getRootTab(aTab));
		}
		children.forEach((
			aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_DETACH_ALL_CHILDREN ?
				function(aTab) {
					this.partTab(aTab, aInfo);
					this.moveTabSubtreeTo(aTab, insertBefore ? insertBefore._tPos - 1 : this.getLastTab(b)._tPos );
				} :
			aInfo.behavior == this.kCLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST_CHILD ?
				function(aTab, aIndex) {
					this.partTab(aTab, aInfo);
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
					this.partTab(aTab, aInfo);
				}
		), this);
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
			window.clearTimeout(this.updateTabsIndentWithDelayTimer);

		this.updateTabsIndentWithDelayTabs = this.updateTabsIndentWithDelayTabs.concat(aTabs);
		this.updateTabsIndentWithDelayTimer = window.setTimeout(function(aSelf) {
			var tabs = [];
			aSelf.updateTabsIndentWithDelayTabs.forEach(function(aTab) {
				if (tabs.indexOf(aTab) < 0 && aTab.parentNode) tabs.push(aTab);
			});
			aSelf.updateTabsIndentWithDelayTabs = [];
			aSelf.updateTabsIndent(tabs);
			window.clearTimeout(aSelf.updateTabsIndentWithDelayTimer);
			aSelf.updateTabsIndentWithDelayTimer = null;
			tabs = null;
		}, 0, this);
	},
	updateTabsIndentWithDelayTabs : [],
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
			Array.slice(document.getAnonymousNodes(aTab)).forEach(function(aBox) {
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
				0, 0, 1, window
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
			0, 0, this.indentDuration, window
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
			window.clearTimeout(this.checkTabsIndentOverflowTimer);
			this.checkTabsIndentOverflowTimer = null;
		}
		this.checkTabsIndentOverflowTimer = window.setTimeout(function(aSelf) {
			aSelf.checkTabsIndentOverflowCallback();
		}, 100, this);
	},
	checkTabsIndentOverflowTimer : null,
	checkTabsIndentOverflowCallback : function TSTBrowser_checkTabsIndentOverflowCallback()
	{
		var b    = this.mTabBrowser;
		var tabs = this.getArrayFromXPathResult(this.evaluateXPath(
				'child::xul:tab[@'+this.kNEST+' and not(@'+this.kNEST+'="0" or @'+this.kNEST+'="")]',
				b.mTabContainer
			));
		if (!tabs.length) return;

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
					b.mTabContainer.boxObject[this.invertedSizeProp]
				);
		if (!this.isVertical) {
			if (this._horizontalTabMaxIndentBase)
				maxIndentBase = this._horizontalTabMaxIndentBase;
			else
				this._horizontalTabMaxIndentBase = maxIndentBase;
		}
		var maxIndent = maxIndentBase * (this.isVertical ? 0.33 : 0.5 );

		var indentUnit = Math.max(Math.floor(maxIndent / nest), 1);
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
		var count = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER);
		if (count) {
			count.setAttribute('value', this.getDescendantTabs(aTab).length);
		}
		if (!aDontUpdateAncestor) {
			let parent = this.getParentTab(aTab);
			if (parent)
				this.updateTabsCount(parent);
		}
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
				this.partTab(aTab);
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
		if (aEvent.keyCode == KeyEvent.DOM_VK_RIGHT) {
			var prevTab = this.getPreviousSiblingTab(b.mCurrentTab);
			if ((!parentTab && prevTab) ||
				(parentTab && b.mCurrentTab != this.getFirstChildTab(parentTab))) {
				this.attachTabTo(b.mCurrentTab, prevTab);
				b.mCurrentTab.focus();
				return true;
			}
		}
		else if (aEvent.keyCode == KeyEvent.DOM_VK_LEFT && parentTab) {
			var grandParent = this.getParentTab(parentTab);
			if (grandParent) {
				this.attachTabTo(b.mCurrentTab, grandParent, {
					insertBefore : this.getNextSiblingTab(parentTab)
				});
				b.mCurrentTab.focus();
				return true;
			}
			else {
				var nextTab = this.getNextSiblingTab(parentTab);
				this.partTab(b.mCurrentTab);
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
				aTab.setAttribute(this.kCOLLAPSED_DONE, true);
			else
				aTab.removeAttribute(this.kCOLLAPSED_DONE);

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
			aTab.removeAttribute(this.kCOLLAPSED_DONE);
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
				if (aCollapsed) aTab.setAttribute(self.kCOLLAPSED_DONE, true);
				if (!CSSTransitionEnabled) {
					aTab.style.removeProperty(self.collapseCSSProp);
					aTab.style.removeProperty('opacity');
				}
				aTab.removeAttribute(offsetAttr);

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
			0, 0, this.collapseDuration, window
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
		if (this.cETIWDFTimer)
			window.clearTimeout(this.cETIWDFTimer);
		this.cETIWDFTimer = window.setTimeout(function(aSelf) {
			window.clearTimeout(aSelf.cETIWDFTimer);
			aSelf.cETIWDFTimer = null;
			aSelf.collapseExpandTreesIntelligentlyFor(aTab);
		}, 0, this);
	},
	cETIWDFTimer : null,
 
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
	
	smoothScrollTo : function TSTBrowser_smoothScrollTo(aEndX, aEndY) 
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

				b = null;
				scrollBoxObject = null;
				x = null;
				y = null;
				startX = null;
				startY = null;
				radian = null;
				self = null;

				return true;
			}

			var power = Math.sin(aTime / aDuration * radian);
			var newX = startX + parseInt(deltaX * power);
			var newY = startY + parseInt(deltaY * power);

			var x = {}, y = {};
			scrollBoxObject.getPosition(x, y);

			var w = {}, h = {};
			scrollBoxObject.getScrolledSize(w, h);
			var maxX = Math.max(0, w.value - scrollBoxObject.width);
			var maxY = Math.max(0, h.value - scrollBoxObject.height);
			scrollBoxObject.scrollTo(newX, newY);
			return false;
		};
		this.animationManager.addTask(
			this.smoothScrollTask,
			0, 0, this.smoothScrollDuration, window
		);
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

		var containerPosition = this.tabStrip.boxObject[this.positionProp];
		var containerSize     = this.tabStrip.boxObject[this.sizeProp];
		var parentPosition    = aTab.boxObject[this.positionProp];
		var lastPosition      = lastVisible.boxObject[this.positionProp];
		var tabSize           = lastVisible.boxObject[this.sizeProp];

		if (lastPosition - parentPosition + tabSize > containerSize - tabSize) { // out of screen
			var endPos = parentPosition - this.getFirstNormalTab(b).boxObject[this.positionProp] - tabSize * 0.5;
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
 
