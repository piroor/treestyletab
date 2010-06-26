function TreeStyleTabBrowser(aTabBrowser) 
{
	this.mTabBrowser = aTabBrowser;
}
 
TreeStyleTabBrowser.prototype = { 

	kMENUITEM_RELOADSUBTREE            : 'context-item-reloadTabSubtree',
	kMENUITEM_RELOADCHILDREN           : 'context-item-reloadDescendantTabs',
	kMENUITEM_REMOVESUBTREE            : 'context-item-removeTabSubtree',
	kMENUITEM_REMOVECHILDREN           : 'context-item-removeDescendantTabs',
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
	collapseTarget       : 'top',
	positionProp         : 'screenY',
	sizeProp             : 'height',
	invertedPositionProp : 'screenX',
	invertedSizeProp     : 'width',

	kVERTICAL_MARGIN_RULES_PATTERN   : /margin-(top|bottom):[^;]+;?/g,
	kHORIZONTAL_MARGIN_RULES_PATTERN : /margin-(left|right):[^;]+;?/g,
	get indentRulesRegExp()
	{
		return this.isVertical ?
				this.kHORIZONTAL_MARGIN_RULES_PATTERN :
				this.kVERTICAL_MARGIN_RULES_PATTERN ;
	},
	get collapseRulesRegExp()
	{
		return this.isVertical ?
				this.kVERTICAL_MARGIN_RULES_PATTERN :
				this.kHORIZONTAL_MARGIN_RULES_PATTERN ;
	},
 
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
		if (!this._scrollBox) {
			this._scrollBox = ( // Tab Mix Plus
					this.getTreePref('compatibility.TMP') &&
					document.getAnonymousElementByAttribute(this.mTabBrowser.mTabContainer, 'class', 'tabs-frame')
				) ||
				this.mTabBrowser.mTabContainer.mTabstrip;
		}
		return this._scrollBox;
	},
	_scrollBox : null,
	get scrollBoxObject()
	{
		return (this.scrollBox.scrollBoxObject || this.scrollBox.boxObject)
				.QueryInterface(Components.interfaces.nsIScrollBoxObject); // Tab Mix Plus (ensure scrollbox-ed)
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
 
/* utils */ 
	
/* get tab contents */ 
	
	getTabLabel : function TSTBrowser_getTabLabel(aTab) 
	{
		var label = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-stack') || // Mac OS X
					( // Tab Mix Plus
						this.getTreePref('compatibility.TMP') &&
						document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-container')
					) ||
					document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text');
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
  
/* status */ 
	
	get isVertical() 
	{
		var b = this.mTabBrowser;
		if (!b) return false;
		var box = this.scrollBox || b.mTabContainer ;
		return (box.getAttribute('orient') || window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical';
	},
 
	get isFloating() 
	{
		return this._tabStripPlaceHolder;
	},
 
	get isFixed() 
	{
		var b = this.mTabBrowser;
		if (!b) return false;
		return b.getAttribute(this.kFIXED+'-'+(this.isVertical ? 'vertical' : 'horizontal')) == 'true';
	},
 
	isTabInViewport : function TSTBrowser_isTabInViewport(aTab) 
	{
		if (!aTab) return false;
		if (aTab.pinned) return true;
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
 
	positionVerticalPinnedTabs : function TSTBrowser_positionVerticalPinnedTabs() 
	{
		var b = this.mTabBrowser;
		var tabbar = b.tabContainer;
		var count  = b._numPinnedTabs;
		var width  = this.PINNED_TAB_WIDTH;
		var height = this.PINNED_TAB_HEIGHT;
		var maxCol = Math.floor(tabbar.boxObject.width / width);
		var maxRow = Math.ceil(count / maxCol);
		var col    = 0;
		var row    = 0;
		tabbar.style.MozMarginStart = '';
		tabbar.style.marginTop = (height * maxRow)+'px';
		for (var i = 0; i < count; i++)
		{
			let style = tabbar.childNodes[i].style;
			style.MozMarginStart = '';
			style.setProperty('margin-left', (width * col)+'px', 'important');
			style.setProperty('margin-top', (- height * (maxRow - row))+'px', 'important');
			col++;
			if (col >= maxCol) {
				col = 0;
				row++;
			}
		}
	},
	PINNED_TAB_WIDTH : 24,
	PINNED_TAB_HEIGHT : 24,
 
	clearPinnedTabsAppearance : function TSTBrowser_clearPinnedTabsAppearance() 
	{
		var b = this.mTabBrowser;
		var tabbar = b.tabContainer;
		tabbar.style.MozMarginStart = '';
		tabbar.style.marginTop = '';
		for (var i = 0, count = b._numPinnedTabs; i < count; i++)
		{
			let style = tabbar.childNodes[i].style;
			style.MozMarginStart = '';
			style.marginLeft = '';
			style.marginTop = '';
		}
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
	},
 
	onUnpinTab : function TSTBrowser_onUnpinTab(aTab) 
	{
		aTab.style.marginLeft = '';
		aTab.style.marginTop = '';
	},
  
/* initialize */ 
	
	init : function TSTBrowser_init() 
	{
		this.stopRendering();

		var b = this.mTabBrowser;
		b.tabContainer.treeStyleTab = this;

		this.tabsHash = {};
		this.tabStripPlaceHolder = null;

		this.internallyTabMovingCount = 0;
		this.subTreeMovingCount = 0;
		this.subTreeChildrenMovingCount = 0;
		this._treeViewEnabled = true;

		let (toggler, placeHolder) {
			toggler = document.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER);
			if (!toggler) {
				toggler = document.createElement('spacer');
				toggler.setAttribute('class', this.kTABBAR_TOGGLER);
				b.mTabBox.insertBefore(toggler, b.mTabBox.firstChild);
				if (b.mTabDropIndicatorBar == toggler)
					b.mTabDropIndicatorBar = document.getAnonymousElementByAttribute(b, 'class', 'tab-drop-indicator-bar');
			}
			placeHolder = document.getAnonymousElementByAttribute(b, 'anonid', 'strip');
			if (!placeHolder) {
				placeHolder = document.createElement('hbox');
				placeHolder.setAttribute('anonid', 'strip');
				placeHolder.setAttribute('class', 'tabbrowser-strip');
				placeHolder.setAttribute(this.kTABBAR_PLACEHOLDER, true);
				b.mTabBox.insertBefore(placeHolder, toggler.nextSibling);
			}
			if (placeHolder != this.tabStrip)
				this.tabStripPlaceHolder = placeHolder;
		}

		let position = this.currentTabbarPosition;
		this.fireTabbarPositionEvent('TreeStyleTabTabbarPositionChanging', 'top', position); /* PUBLIC API */

		this.setTabbrowserAttribute(this.kFIXED+'-horizontal', this.getTreePref('tabbar.fixed.horizontal') ? 'true' : null, b);
		this.setTabbrowserAttribute(this.kFIXED+'-vertical', this.getTreePref('tabbar.fixed.vertical') ? 'true' : null, b);

		this.initTabbar(null, this.kTABBAR_TOP);

		var strip = this.tabStrip;
		b.mTabContainer.addEventListener('TabOpen',        this, true);
		b.mTabContainer.addEventListener('TabClose',       this, true);
		b.mTabContainer.addEventListener('TabMove',        this, true);
		b.mTabContainer.addEventListener('SSTabRestoring', this, true);
		b.mTabContainer.addEventListener('SSTabRestored',  this, true);
		b.mTabContainer.addEventListener('mouseover', this, true);
		b.mTabContainer.addEventListener('mouseout',  this, true);
		b.mTabContainer.addEventListener('dblclick',  this, true);
		b.mTabContainer.addEventListener('select', this, true);
		b.mTabContainer.addEventListener('scroll', this, true);
		strip.addEventListener('dragstart', this, false);
		strip.addEventListener('dragenter', this, false);
		strip.addEventListener('dragleave', this, false);
		strip.addEventListener('dragend',   this, false);
		strip.addEventListener('dragover',  this, false);
		strip.addEventListener('drop',      this, false);
		strip.addEventListener('mousedown', this, true);
		strip.addEventListener('mouseup',   this, false);
		strip.addEventListener('click',     this, true);
		b.mPanelContainer.addEventListener('dragleave', this, false);
		b.mPanelContainer.addEventListener('dragover',  this, false);
		b.mPanelContainer.addEventListener('drop',      this, true);
		b.mPanelContainer.addEventListener('dragdrop',  this, false); // for Firefox 3.5 or older

		if (this.isFloating)
			window.addEventListener('resize', this, true);

		this.scrollBox.addEventListener('overflow', this, true);
		this.scrollBox.addEventListener('underflow', this, true);

		window.addEventListener('TreeStyleTabPrintPreviewEntered', this, false);
		window.addEventListener('TreeStyleTabPrintPreviewExited', this, false);

		b.addEventListener('MultipleTabHandlerTabsClosing', this, false);



		/* Closing collapsed last tree breaks selected tab.
		   To solve this problem, I override the setter to
		   force to set a tab and forbid it becomes null. */
		let (getter, setter) {
			getter = b.__lookupGetter__('selectedTab');
			setter = b.__lookupSetter__('selectedTab');
			eval('setter = '+setter.toSource().replace(
				'{',
				<![CDATA[$&
					if (!val) {
						val = TreeStyleTabService.getLastTab(this);
					}
				]]>.toString()
			));
			/* We have to use both __defineSetter__ and __defineGetter__
			   just in same time!! If we update only setter,
			   getter will be vanished. */
			b.__defineGetter__('selectedTab', getter);
			b.__defineSetter__('selectedTab', setter);
			getter = null;
			setter = null;
		}


		eval('b.mTabContainer._selectNewTab = '+
			b.mTabContainer._selectNewTab.toSource().replace(
				'{',
				<![CDATA[$&
					if (arguments[0].__treestyletab__preventSelect) {
						arguments[0].__treestyletab__preventSelect = false;
						return;
					}
				]]>
			)
		);

		eval('b.mTabContainer.adjustTabstrip = '+
			b.mTabContainer.adjustTabstrip.toSource().replace(
				/(\}\)?)$/,
				<![CDATA[
					var b = TreeStyleTabService.getTabBrowserFromChild(this);
					b.treeStyleTab.updateInvertedTabContentsOrder(true);
				$1]]>
			)
		);

		eval('b.mTabContainer.advanceSelectedTab = '+
			b.mTabContainer.advanceSelectedTab.toSource().replace(
				'{',
				<![CDATA[$&
					var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;
					treeStyleTab._focusChangedByShortcut = TreeStyleTabService.accelKeyPressed;
					if (treeStyleTab.canCollapseSubtree() &&
						treeStyleTab.getTreePref('focusMode') == treeStyleTab.kFOCUS_VISIBLE) {
						(function(aDir, aWrap, aSelf) {
							var nextTab = (aDir < 0) ? treeStyleTab.getPreviousVisibleTab(aSelf.selectedItem) : treeStyleTab.getNextVisibleTab(aSelf.selectedItem) ;
							if (!nextTab && aWrap) {
								nextTab = TreeStyleTabService.evaluateXPath(
										'child::xul:tab[not(@'+TreeStyleTabService.kCOLLAPSED+'="true")]['+
										(aDir < 0 ? 'last()' : '1' )+
										']',
										aSelf,
										XPathResult.FIRST_ORDERED_NODE_TYPE
									).singleNodeValue;
							}
							if (nextTab && nextTab != aSelf.selectedItem) {
								aSelf._selectNewTab(nextTab, aDir, aWrap);
							}
						})(arguments[0], arguments[1], this);
						return;
					}
				]]>
			)
		);

		eval('b.mTabContainer._handleTabSelect = '+
			b.mTabContainer._handleTabSelect.toSource().replace(
				'{',
				<![CDATA[$&
					if ((function(aTabs) {
							var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(aTabs).treeStyleTab;
							var tab = aTabs.selectedItem;
							if (!treeStyleTab.isTabInViewport(tab)) {
								treeStyleTab.scrollToTab(tab);
								return true;
							}
							return false;
						})(this)) {
						return;
					}
				]]>
			)
		);

/*
		if ('ensureElementIsVisible' in b.mTabContainer.mTabstrip &&
			'_smoothScrollByPixels' in b.mTabContainer.mTabstrip) {
			eval('b.mTabContainer.mTabstrip.ensureElementIsVisible = '+
				b.mTabContainer.mTabstrip.ensureElementIsVisible.toSource().replace(
					'{',
					<![CDATA[$&
						var browser = TreeStyleTabService.getTabBrowserFromChild(this);
						var startProp = browser.treeStyleTab.isVertical ? 'top' : 'left' ;
						var endProp = browser.treeStyleTab.isVertical ? 'bottom' : 'right' ;
					]]>
				).replace(
					/\.left/g, '[startProp]'
				).replace(
					/\.right/g, '[endProp]'
				).replace(
					'|| this.getAttribute("orient") == "vertical"', ''
				)
			);
			eval('b.mTabContainer.mTabstrip._smoothScrollByPixels = '+
				b.mTabContainer.mTabstrip._smoothScrollByPixels.toSource().replace(
					'{',
					<![CDATA[$&
						var TST = TreeStyleTabService.getTabBrowserFromChild(this);
					]]>
				).replace(
					'scrollBy(distance, 0)',
					<![CDATA[scrollBy(
						(TST.isVertical ? 0 : distance ),
						(TST.isVertical ? distance : 0 )
					)]]>
				)
			);
		}
*/

		eval('b.mTabContainer._notifyBackgroundTab = '+
			b.mTabContainer._notifyBackgroundTab.toSource().replace(
				'{',
				'{ var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;'
			).replace(
				/\.screenX/g, '[treeStyleTab.positionProp]'
			).replace(
				/\.width/g, '[treeStyleTab.sizeProp]'
			)
		);

		if (b.mTabContainer._positionPinnedTabs) {
			eval('b.mTabContainer._positionPinnedTabs = '+
				b.mTabContainer._positionPinnedTabs.toSource().replace(
					'{',
					<![CDATA[{
						if (this.tabbrowser.treeStyleTab.isVertical) {
							this.tabbrowser.treeStyleTab.positionVerticalPinnedTabs();
						}
						else {
							this.tabbrowser.treeStyleTab.clearPinnedTabsAppearance();
					]]>.toString()
				).replace(
					'this.mTabstrip.ensureElementIsVisible',
					'} $&'
				)
			);
		}

		if (b.pinTab) {
			eval('b.pinTab = '+
				b.pinTab.toSource().replace(
					'this.moveTabTo(',
					<![CDATA[
						this.treeStyleTab.onPinTab(aTab);
					$&]]>.toString()
				)
			);
		}

		if (b.unpinTab) {
			eval('b.unpinTab = '+
				b.unpinTab.toSource().replace(
					'this.tabContainer._positionPinnedTabs',
					<![CDATA[
						this.treeStyleTab.onUnpinTab(aTab);
					$&]]>.toString()
				)
			);
		}

		TreeStyleTabService.updateTabDNDObserver(b);

		if (b.tabContainer && '_getDropIndex' in b.tabContainer) { // Firefox 3.7 or later
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

		if (b.tabContainer.tabbrowser == b && '_handleKeyEvent' in b) { // Firefox 3.7-
			eval('b._handleKeyEvent = '+
				b._handleKeyEvent.toSource().replace(
					'this.moveTabOver(aEvent);',
					<![CDATA[
						if (!this.treeStyleTab.isVertical ||
							!this.treeStyleTab.moveTabLevel(aEvent)) {
							$&
						}
					]]>
				).replace(
					'this.moveTabForward();',
					<![CDATA[
						if (this.treeStyleTab.isVertical ||
							!this.treeStyleTab.moveTabLevel(aEvent)) {
							$&
						}
					]]>
				).replace(
					'this.moveTabBackward();',
					<![CDATA[
						if (this.treeStyleTab.isVertical ||
							!this.treeStyleTab.moveTabLevel(aEvent)) {
							$&
						}
					]]>
				)
			);
		}
		else if ('_keyEventHandler' in b) { // Firefox 3.6 or older
			eval('b._keyEventHandler.handleEvent = '+
				b._keyEventHandler.handleEvent.toSource().replace(
					'this.tabbrowser.moveTabOver(aEvent);',
					<![CDATA[
						if (!this.tabbrowser.treeStyleTab.isVertical ||
							!this.tabbrowser.treeStyleTab.moveTabLevel(aEvent)) {
							$&
						}
					]]>
				).replace(
					'this.tabbrowser.moveTabForward();',
					<![CDATA[
						if (this.tabbrowser.treeStyleTab.isVertical ||
							!this.tabbrowser.treeStyleTab.moveTabLevel(aEvent)) {
							$&
						}
					]]>
				).replace(
					'this.tabbrowser.moveTabBackward();',
					<![CDATA[
						if (this.tabbrowser.treeStyleTab.isVertical ||
							!this.tabbrowser.treeStyleTab.moveTabLevel(aEvent)) {
							$&
						}
					]]>
				)
			);
		}

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

		eval('b.createTooltip = '+
			b.createTooltip.toSource().replace(
				'if ("mOverCloseButton" in tn && tn.mOverCloseButton) {',
				<![CDATA[
					if (TreeStyleTabService.getTabBrowserFromChild(tn) &&
						TreeStyleTabService.getTabBrowserFromChild(tn).treeStyleTab.handleTooltip(event, tn)) {
						return true;
					}
					else $&]]>
			)
		);

		if ('_beginRemoveTab' in b) {
			eval('b._beginRemoveTab = '+
				b._beginRemoveTab.toSource().replace(
					'if (l == 1) {',
					'if (l == 1 || this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab)) {'
				).replace(
					'this._removingTabs.length == 0',
					'(this.treeStyleTab.shouldCloseLastTabSubtreeOf(aTab) || $&)'
				)
			);
		}

		eval('b.removeCurrentTab = '+b.removeCurrentTab.toSource().replace(
			'{',
			'{ if (!this.treeStyleTab.warnAboutClosingTabSubtreeOf(this.selectedTab)) return;'
		));

		let (tabs = this.getTabsArray(b)) {
			for each (let tab in tabs)
			{
				this.initTab(tab);
			}
		}

		this.onPrefChange('extensions.treestyletab.tabbar.style');
		this.onPrefChange('extensions.treestyletab.twisty.style');
		this.onPrefChange('extensions.treestyletab.showBorderForFirstTab');
		this.onPrefChange('extensions.treestyletab.tabbar.invertTabContents');
		this.onPrefChange('extensions.treestyletab.tabbar.invertClosebox');
		this.onPrefChange('extensions.treestyletab.animation.enabled');

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

		let (removeTabItem = document.getAnonymousElementByAttribute(b, 'id', 'context_closeTab')) {
			if (removeTabItem) {
				removeTabItem.setAttribute(
					'oncommand',
					removeTabItem.getAttribute('oncommand').replace(
						/(tabbrowser\.removeTab\(([^\)]+)\))/,
						'if (tabbrowser.treeStyleTab.warnAboutClosingTabSubtreeOf($2)) $1'
					)
				);
			}
		}

		/* To move up content area on the tab bar, switch tab.
		   If we don't do it, a gray space appears on the content area
		   by negative margin of it. */
		if (this.currentTabbarPosition == 'left' &&
			b.getAttribute(this.kSCROLLBAR_INVERTED) == 'true') {
			b.removeTab(
				b.selectedTab = b.addTab('about:blank')
			);
		}

		this.ObserverService.addObserver(this, 'TreeStyleTab:indentModified', false);
		this.ObserverService.addObserver(this, 'TreeStyleTab:collapseExpandAllSubtree', false);
		this.ObserverService.addObserver(this, 'TreeStyleTab:changeTreeViewAvailability', false);
		this.addPrefListener(this);

		this.autoHide;

		this.fireTabbarPositionEvent('TreeStyleTabTabbarPositionChanged', 'top', position); /* PUBLIC API */

		b = null;

		this.startRendering();
	},
	
	initTab : function TSTBrowser_initTab(aTab) 
	{
		if (!aTab.hasAttribute(this.kID)) {
			var id = this.getTabValue(aTab, this.kID) || this.makeNewId();
			aTab.setAttribute(this.kID, id);
			aTab.setAttribute(this.kSUBTREE_COLLAPSED, true);
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
		var pos = this.currentTabbarPosition;
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
			aTab.setAttribute('maxwidth', 250);
			aTab.setAttribute('minwidth', this.mTabBrowser.mTabContainer.mTabMinWidth);
			aTab.setAttribute('width', '0');
			aTab.setAttribute('flex', 100);
			aTab.maxWidth = 250;
			aTab.minWidth = this.mTabBrowser.mTabContainer.mTabMinWidth;
			if (this.getTreePref('compatibility.TMP'))
				aTab.removeAttribute('dir'); // Tab Mix Plus
		}
	},
 
	initTabContents : function TSTBrowser_initTabContents(aTab) 
	{
		var icon  = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-icon');
		var label = this.getTabLabel(aTab);
		var close = this.getTabClosebox(aTab);
		var counter = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER);

		if (!document.getAnonymousElementByAttribute(aTab, 'class', this.kTWISTY)) {
			var twisty = document.createElement('image');
			twisty.setAttribute('class', this.kTWISTY);
			var container = document.createElement('hbox');
			container.setAttribute('class', this.kTWISTY_CONTAINER);
			container.appendChild(twisty);

			icon.appendChild(container);

			var marker = document.createElement('image');
			marker.setAttribute('class', this.kDROP_MARKER);
			container = document.createElement('hbox');
			container.setAttribute('class', this.kDROP_MARKER_CONTAINER);
			container.appendChild(marker);

			icon.appendChild(container);
		}

		if (!counter) {
			var counter = document.createElement('hbox');
			counter.setAttribute('class', this.kCOUNTER_CONTAINER);

			counter.appendChild(document.createElement('label'));
			counter.lastChild.setAttribute('class', this.kCOUNTER_PAREN);
			counter.lastChild.setAttribute('value', '(');

			counter.appendChild(document.createElement('label'));
			counter.lastChild.setAttribute('class', this.kCOUNTER);
			counter.lastChild.setAttribute('value', '0');

			counter.appendChild(document.createElement('label'));
			counter.lastChild.setAttribute('class', this.kCOUNTER_PAREN);
			counter.lastChild.setAttribute('value', ')');

			if (label) {
				label.parentNode.insertBefore(counter, label.nextSibling);
			}
		}
		this.initTabContentsOrder(aTab);
	},
 
	initTabContentsOrder : function TSTBrowser_initTabContentsOrder(aTab) 
	{
		var label = this.getTabLabel(aTab);
		var close = this.getTabClosebox(aTab);
		var counter = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER);
		var inverted = this.mTabBrowser.getAttribute(this.kTAB_CONTENTS_INVERTED) == 'true';

		var nodes = Array.slice(document.getAnonymousNodes(aTab));

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
		nodes.splice(nodes.indexOf(counter), 1);
		if (inverted) nodes.reverse();
		nodes.splice(nodes.indexOf(label)+1, 0, counter);
		count = nodes.length;
		nodes.reverse().forEach(function(aNode, aIndex) {
			if (aNode.getAttribute('class') == 'informationaltab-thumbnail-container')
				return;
			aNode.setAttribute('ordinal', (count - aIndex + 1) * 100);
		}, this);
	},
 
	updateInvertedTabContentsOrder : function TSTBrowser_updateInvertedTabContentsOrder(aAll) 
	{
		if (!this.getTreePref('tabbar.invertTabContents')) return;
		window.setTimeout(function(aSelf) {
			var b = aSelf.mTabBrowser;
			var tabs = aAll ? aSelf.getTabsArray(b) : [b.selectedTab] ;
			tabs.forEach(function(aTab) {
				aSelf.initTabContentsOrder(aTab);
			});
			b = null;
			tabs = null;
		}, 0, this);
	},
  
	initTabbar : function TSTBrowser_initTabbar(aNewPosition, aOldPosition) 
	{
		this.stopRendering();

		var b = this.mTabBrowser;

		var pos = aNewPosition || this.getPositionFlag(this.currentTabbarPosition);
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

		this.indentProp = this.getTreePref('indent.property');

		this.getTabsArray(b).forEach(function(aTab) {
			this.updateTabCollapsed(aTab, aTab.getAttribute(this.kCOLLAPSED) == 'true', true);
		}, this);

		this.updateTabbarState();
		window.setTimeout(function(aSelf, aTabBrowser, aSplitter, aToggler) {
			delayedPostProcess(aSelf, aTabBrowser, aSplitter, aToggler);
			aSelf.updateTabbarOverflow();
			aSelf.updateAllTabsButton(aTabBrowser);
			delayedPostProcess = null;
			aSelf.mTabBrowser.style.visibility = '';
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
	
	_ensureNewSplitter : function TSTBrowser__ensureNewSplitter() 
	{
		var splitter = this.splitter;

		// We always have to re-create splitter, because its "collapse"
		// behavior becomes broken by repositioning of the tab bar.
		if (splitter) {
			try {
				splitter.removeEventListener('mouseup', this, false);
				splitter.removeEventListener('click', this, false);
				splitter.removeEventListener('dblclick', this, false);
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
			splitter.appendChild(document.createElement('grippy'));
		}

		var splitterClass = splitter.getAttribute('class') || '';
		if (splitterClass.indexOf(this.kSPLITTER) < 0)
			splitterClass += (splitterClass ? ' ' : '' ) + this.kSPLITTER;
		splitter.setAttribute('class', splitterClass);

		splitter.addEventListener('mouseup', this, false);
		splitter.addEventListener('click', this, false);
		splitter.addEventListener('dblclick', this, false);

		var ref = this.mTabBrowser.mPanelContainer;
		ref.parentNode.insertBefore(splitter, ref);

		return splitter;
	},
 
	updateTabbarState : function TSTBrowser_updateTabbarState() 
	{
		this.stopRendering();

		var b = this.mTabBrowser;
		var orient;
		var toggleTabsOnTop = document.getElementById('cmd_ToggleTabsOnTop');
		if (this.isVertical) {
			orient = 'vertical';
			this.setTabbrowserAttribute(this.kFIXED, b.treeStyleTab.isFixed ? 'true' : null , b);
			if (toggleTabsOnTop)
				toggleTabsOnTop.setAttribute('disabled', true);
		}
		else {
			orient = 'horizontal';
			if (b.treeStyleTab.isFixed) {
				this.setTabbrowserAttribute(this.kFIXED, true, b);
				if (!this.isMultiRow()) {
					this.removeTabStripAttribute('height');
					b.mPanelContainer.removeAttribute('height');
				}
				// remove ordinal for "tabs on top" https://bugzilla.mozilla.org/show_bug.cgi?id=544815
				if (this.isFloating && this.currentTabbarPosition == 'top') {
					this.removeTabStripAttribute('ordinal');
					if ('TabsOnTop' in window) {
						// workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=555987
						TabsOnTop.enabled = !TabsOnTop.enabled;
						window.setTimeout(function() {
							TabsOnTop.enabled = !TabsOnTop.enabled;
						}, 0);
					}
				}
				if (toggleTabsOnTop) {
					if (this.currentTabbarPosition == 'top')
						toggleTabsOnTop.removeAttribute('disabled');
					else
						toggleTabsOnTop.setAttribute('disabled', true);
				}
			}
			else {
				this.removeTabbrowserAttribute(this.kFIXED, b);
				this.setTabStripAttribute('height', this.maxTabbarHeight(this.getTreePref('tabbar.height'), b));
				if (toggleTabsOnTop)
					toggleTabsOnTop.setAttribute('disabled', true);
			}
		}

		window.setTimeout(function(aSelf) {
			aSelf.updateFloatingTabbar();
			aSelf.startRendering();

			if ('_positionPinnedTabs' in b.mTabContainer)
				b.mTabContainer._positionPinnedTabs();
		}, 0, this);

		this.setTabbrowserAttribute(this.kINDENTED, this.getTreePref('enableSubtreeIndent.'+orient) ? 'true' : null);
		this.setTabbrowserAttribute(this.kALLOW_COLLAPSE, this.getTreePref('allowSubtreeCollapseExpand.'+orient) ? 'true' : null);
		this.setTabbrowserAttribute(this.kHIDE_ALLTABS, this.getTreePref('tabbar.hideAlltabsButton.'+orient) ? 'true' : null);

		this.updateAllTabsIndent();
	},
 
	updateFloatingTabbar : function TSTBrowser_updateFloatingTabbar(aJustNow) 
	{
		// this method is just for Firefox 3.7 or later
		if (!this.isFloating) return;

		if (aJustNow) {
			if (this.updateFloatingTabbarTimer)
				window.clearTimeout(this.updateFloatingTabbarTimer);
			this.updateFloatingTabbarTimer = null;
			this.updateFloatingTabbarInternal();
		}
		else {
			this.updateFloatingTabbarTimer = window.setTimeout(function(aSelf) {
				aSelf.updateFloatingTabbarTimer = null;
				aSelf.updateFloatingTabbarInternal()
			}, 0, this);
		}
	},
	updateFloatingTabbarInternal : function TSTBrowser_updateFloatingTabbarInternal()
	{
		var strip = this.tabStrip;
		var tabContainerBox = this.getTabContainerBox(this.mTabBrowser);
		var positioned = false;
		if (this.currentTabbarPosition != 'top' ||
			this.mTabBrowser.getAttribute(this.kFIXED) != 'true') {
			positioned = true;

			let box = this._tabStripPlaceHolder.boxObject;
			let root = document.documentElement.boxObject;
			strip.style.top = (box.screenY - root.screenY)+'px';
			strip.style.left = (box.screenX - root.screenX)+'px';

			let width = parseInt(this._tabStripPlaceHolder.getAttribute('width') || box.width);
			let height = parseInt(this._tabStripPlaceHolder.getAttribute('height') || box.height);

			strip.style.width = (tabContainerBox.width = width)+'px';
			strip.style.height = (tabContainerBox.height = height)+'px';

			tabContainerBox.collapsed = (this.splitter && this.splitter.getAttribute('state') == 'collapsed');
		}
		else {
			tabContainerBox.collapsed = false;
			strip.style.top = '';
			strip.style.left = '';
			strip.style.width = '';
			strip.style.height = '';
		}

		if (this.mTabBrowser != gBrowser)
			return;

		var toolbox = strip.parentNode;
		if (toolbox.localName != 'toolbox')
			return;

		if (!positioned) {
			toolbox.removeAttribute('height', height);
		}
		else {
			// hack to reset the height of the toolbox
			let height = 0;
			Array.slice(toolbox.childNodes).forEach(function(aNode) {
				if (aNode.nodeType == Node.ELEMENT_NODE && aNode != strip)
					height += aNode.boxObject.height;
			});
			height += parseInt(window.getComputedStyle(toolbox, '').getPropertyValue('margin-top').replace('px', ''));
			if (height != toolbox.boxObject.height) {
//				this.stopRendering();
				// "height" attribute of the toolbar prevents rendering of the toolbox with its correct height.
				strip.removeAttribute('height');
				toolbox.setAttribute('height', height);
//				window.setTimeout(function(aSelf) {
//					toolbox.removeAttribute('height');
//					aSelf.startRendering();
//				}, 0, this);
			}
		}

		if ('_positionPinnedTabs' in this.mTabBrowser.mTabContainer)
			this.mTabBrowser.mTabContainer._positionPinnedTabs();
	},
 
	resetTabbarSize : function TSTBrowser_resetTabbarSize() 
	{
		if (!this.isVertical) {
			this.clearTreePref('tabbar.height');
			if (this.isFloating) {
				let tabContainerBox = this.getTabContainerBox(this.mTabBrowser);
				tabContainerBox.removeAttribute('height');
				this._tabStripPlaceHolder.height = tabContainerBox.boxObject.height;
				this.updateFloatingTabbar();
			}
		}
		else {
			if (!this.autoHide.expanded)
				this.clearTreePref('tabbar.shrunkenWidth');
			else
				this.clearTreePref('tabbar.width');
		}
	},
 
	updateTabbarOverflow : function TSTBrowser_updateTabbarOverflow() 
	{
		var b = this.mTabBrowser;
		b.mTabContainer.removeAttribute('overflow'); // Firefox 3.0.x / Firefox 3.7
		var container = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-container');

		if (!container) {
			if (this.isFloating)
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
				b.mTabContainer.setAttribute('overflow', true); // Firefox 3.0.x
				container.setAttribute('overflow', true);
			}
			else {
				b.mTabContainer.removeAttribute('overflow'); // Firefox 3.0.x
				container.removeAttribute('overflow');
			}
		}, 100);
	},
 
	fireTabbarPositionEvent : function TSTBrowser_fireTabbarPositionEvent(aChanging, aOldPosition, aNewPosition) 
	{
		if (aOldPosition == aNewPosition) return false;

		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent(aChanging ? 'TreeStyleTabTabbarPositionChanging' : 'TreeStyleTabTabbarPositionChanged', true, false);
		event.oldPosition = aOldPosition;
		event.newPosition = aNewPosition;
		this.mTabBrowser.dispatchEvent(event);

		return true;
	},
 
	fireTabbarStateChangingEvent : function TSTBrowser_fireTabbarStateChangingEvent() 
	{
		var b = this.mTabBrowser;
		var orient = this.isVertical ? 'vertical' : 'horizontal' ;
		var oldState = {
				fixed         : this.isFixed,
				indented      : b.getAttribute(this.kINDENTED) == 'true',
				canCollapse   : b.getAttribute(this.kALLOW_COLLAPSE) == 'true',
				alltabsButton : b.getAttribute(this.kHIDE_ALLTABS) != 'true'
			};
		oldState.allTabsButton = oldState.alltabsButton;
		var newState = {
				fixed         : this.getTreePref('tabbar.fixed.'+orient),
				indented      : this.getTreePref('enableSubtreeIndent.'+orient),
				canCollapse   : this.getTreePref('allowSubtreeCollapseExpand.'+orient),
				alltabsButton : !this.getTreePref('tabbar.hideAlltabsButton.'+orient)
			};
		newState.allTabsButton = newState.alltabsButton;

		if (oldState.fixed == newState.fixed &&
			oldState.indented == newState.indented &&
			oldState.canCollapse == newState.canCollapse &&
			oldState.alltabsButton == newState.alltabsButton)
			return false;

		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabTabbarStateChanging', true, false);
		event.oldState = oldState;
		event.newState = newState;
		this.mTabBrowser.dispatchEvent(event);

		return true;
	},
 
	fireTabbarStateChangedEvent : function TSTBrowser_fireTabbarStateChangedEvent() 
	{
		var b = this.mTabBrowser;
		var state = {
				fixed         : this.isFixed,
				indented      : b.getAttribute(this.kINDENTED) == 'true',
				canCollapse   : b.getAttribute(this.kALLOW_COLLAPSE) == 'true',
				alltabsButton : b.getAttribute(this.kHIDE_ALLTABS) != 'true'
			};
		state.allTabsButton = state.alltabsButton;

		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabTabbarStateChanged', true, false);
		event.state = state;
		this.mTabBrowser.dispatchEvent(event);

		return true;
	},
   
	destroy : function TSTBrowser_destroy() 
	{
		this.animationManager.removeTask(this.smoothScrollTask);

		this.autoHide.destroy();
		delete this._autoHide;

		var b = this.mTabBrowser;
		delete b.tabContainer.treeStyleTab;

		this.getTabsArray(b).forEach(function(aTab) {
			this.stopTabIndentAnimation(aTab);
			this.stopTabCollapseAnimation(aTab);
			this.destroyTab(aTab);
		}, this);

		var strip = this.tabStrip;
		b.mTabContainer.removeEventListener('TabOpen',        this, true);
		b.mTabContainer.removeEventListener('TabClose',       this, true);
		b.mTabContainer.removeEventListener('TabMove',        this, true);
		b.mTabContainer.removeEventListener('SSTabRestoring', this, true);
		b.mTabContainer.removeEventListener('SSTabRestored',  this, true);
		b.mTabContainer.removeEventListener('mouseover', this, true);
		b.mTabContainer.removeEventListener('mouseout',  this, true);
		b.mTabContainer.removeEventListener('dblclick',  this, true);
		b.mTabContainer.removeEventListener('select', this, true);
		b.mTabContainer.removeEventListener('scroll', this, true);
		strip.removeEventListener('dragstart', this, false);
		strip.removeEventListener('dragenter', this, false);
		strip.removeEventListener('dragleave', this, false);
		strip.removeEventListener('dragend',   this, false);
		strip.removeEventListener('dragover',  this, false);
		strip.removeEventListener('drop',      this, false);
		strip.removeEventListener('mousedown', this, true);
		strip.removeEventListener('mouseup',   this, false);
		strip.removeEventListener('click',     this, true);
		b.mPanelContainer.removeEventListener('dragleave', this, false);
		b.mPanelContainer.removeEventListener('dragover',  this, false);
		b.mPanelContainer.removeEventListener('drop',      this, true);
		b.mPanelContainer.removeEventListener('dragdrop',  this, false); // for Firefox 3.5 or older

		if (this.isFloating)
			window.removeEventListener('resize', this, true);

		window.removeEventListener('TreeStyleTabPrintPreviewEntered', this, false);
		window.removeEventListener('TreeStyleTabPrintPreviewExited', this, false);

		b.removeEventListener('MultipleTabHandlerTabsClosing', this, false);

		TreeStyleTabService.destroyTabDNDObserver(b);

		this.tabbarDNDObserver.destroy();
		delete this._tabbarDNDObserver;
		this.panelDNDObserver.destroy();
		delete this._panelDNDObserver;

		this.scrollBox.removeEventListener('overflow', this, true);
		this.scrollBox.removeEventListener('underflow', this, true);

		var tabContextMenu = b.tabContextMenu ||
							document.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContextMenu.removeEventListener('popupshowing', this, false);

		if (this.tabbarCanvas) {
			this.tabbarCanvas.parentNode.removeChild(this.tabbarCanvas);
			this.tabbarCanvas = null;
		}

		this.ObserverService.removeObserver(this, 'TreeStyleTab:indentModified');
		this.ObserverService.removeObserver(this, 'TreeStyleTab:collapseExpandAllSubtree');
		this.ObserverService.removeObserver(this, 'TreeStyleTab:changeTreeViewAvailability');
		this.removePrefListener(this);

		delete this.mTabBrowser;
		delete this._scrollBox;
	},
	
	destroyTab : function TSTBrowser_destroyTab(aTab) 
	{
		var id = aTab.getAttribute(this.kID);
		if (id in this.tabsHash)
			delete this.tabsHash[id];

		delete aTab.__treestyletab__linkedTabBrowser;
	},
 
	saveCurrentState : function TSTBrowser_saveCurrentState() 
	{
		this.autoHide.saveCurrentState();

		var b = this.mTabBrowser;
		let box = (this.tabStripPlaceHolder || this.getTabStrip(b)).boxObject;
		let prefs = {
				'tabbar.fixed.horizontal' : b.getAttribute(this.kFIXED+'-horizontal') == 'true',
				'tabbar.fixed.vertical'   : b.getAttribute(this.kFIXED+'-vertical') == 'true',
				'tabbar.width'            : this.isVertical && this.autoHide.expanded && box.width ? box.width : void(0),
				'tabbar.shrunkenWidth'    : this.isVertical && !this.autoHide.expanded && box.width ? box.width : void(0),
				'tabbar.height'           : !this.isVertical && this.autoHide.expanded && box.height ? box.height : void(0)
			};
		for (var i in prefs)
		{
			if (prefs[i] !== void(0) && this.getTreePref(i) != prefs[i])
				this.setTreePref(i, prefs[i]);
		}
		this.currentTabbarPosition = this.currentTabbarPosition;
	},
   
/* nsIObserver */ 
	
	domains : [ 
		'extensions.treestyletab.'
	],
 
	observe : function TSTBrowser_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'TreeStyleTab:indentModified':
				if (this.indent > -1)
					this.updateAllTabsIndent();
				break;

			case 'TreeStyleTab:collapseExpandAllSubtree':
				if (aSubject == window) {
					aData = String(aData);
					this.collapseExpandAllSubtree(
						aData.indexOf('collapse') > -1,
						aData.indexOf('now') > -1
					);
				}
				break;

			case 'TreeStyleTab:changeTreeViewAvailability':
				this.treeViewEnabled = (aData != 'false');
				break;

			case 'nsPref:changed':
				this.onPrefChange(aData);
				break;

			default:
				break;
		}
	},
 
	onPrefChange : function TSTBrowser_onPrefChange(aPrefName) 
	{
		var b = this.mTabBrowser;
		var value = this.getPref(aPrefName);
		var tabContainer = b.mTabContainer;
		var tabs  = this.getTabsArray(b);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.position':
				if (!this.shouldApplyNewPref) return;
				var oldPosition = this.currentTabbarPosition;
				if (oldPosition != value) {
					this.fireTabbarPositionEvent(true, oldPosition, value);
					this.initTabbar(this.getPositionFlag(value), this.getPositionFlag(oldPosition));
					tabs.forEach(function(aTab) {
						this.initTabAttributes(aTab);
					}, this);
					tabs.forEach(function(aTab) {
						this.initTabContents(aTab);
					}, this);
					this.fireTabbarPositionEvent(false, oldPosition, value);
					window.setTimeout(function(aSelf) {
						aSelf.checkTabsIndentOverflow();
					}, 0, this);
				}
				break;

			case 'extensions.treestyletab.tabbar.invertTab':
			case 'extensions.treestyletab.tabbar.multirow':
				this.initTabbar();
				this.updateAllTabsIndent();
				tabs.forEach(function(aTab) {
					this.initTabContents(aTab);
				}, this);
				break;
			case 'extensions.treestyletab.tabbar.invertTabContents':
				this.setTabbrowserAttribute(this.kTAB_CONTENTS_INVERTED, value);
				tabs.forEach(function(aTab) {
					this.initTabContents(aTab);
				}, this);
				break;

			case 'extensions.treestyletab.tabbar.invertClosebox':
				this.setTabbrowserAttribute(this.kCLOSEBOX_INVERTED, value);
				tabs.forEach(function(aTab) {
					this.initTabContents(aTab);
				}, this);
				break;

			case 'extensions.treestyletab.tabbar.style':
				this.setTabbarStyle(value);
				value = this.getTreePref('twisty.style');
				if (value != 'auto')
					break;
			case 'extensions.treestyletab.twisty.style':
				this.setTwistyStyle(value);
				break;

			case 'extensions.treestyletab.showBorderForFirstTab':
				this.setTabbrowserAttribute(this.kFIRSTTAB_BORDER, value);
				break;

			case 'extensions.treestyletab.tabbar.fixed.horizontal':
				if (!this.shouldApplyNewPref) return;
				this.setTabbrowserAttribute(this.kFIXED+'-horizontal', value ? 'true' : null, b);
			case 'extensions.treestyletab.enableSubtreeIndent.horizontal':
			case 'extensions.treestyletab.allowSubtreeCollapseExpand.horizontal':
			case 'extensions.treestyletab.tabbar.hideAlltabsButton.horizontal':
				if (!this.isVertical && this.fireTabbarStateChangingEvent()) {
					this.updateTabbarState();
					this.fireTabbarStateChangedEvent();
				}
				break;

			case 'extensions.treestyletab.tabbar.fixed.vertical':
				if (!this.shouldApplyNewPref) return;
				this.setTabbrowserAttribute(this.kFIXED+'-vertical', value ? 'true' : null, b);
			case 'extensions.treestyletab.enableSubtreeIndent.vertical':
			case 'extensions.treestyletab.allowSubtreeCollapseExpand.vertical':
			case 'extensions.treestyletab.tabbar.hideAlltabsButton.vertical':
				if (this.isVertical && this.fireTabbarStateChangingEvent()) {
					this.updateTabbarState();
					this.fireTabbarStateChangedEvent();
				}
				break;

			case 'extensions.treestyletab.tabbar.width':
			case 'extensions.treestyletab.tabbar.shrunkenWidth':
				if (!this.shouldApplyNewPref) return;
				if (!this.autoHide.isResizing && this.isVertical) {
					this.removeTabStripAttribute('width');
					this.setTabStripAttribute('width', this.autoHide.widthFromMode);
					this.updateFloatingTabbar();
				}
				this.checkTabsIndentOverflow();
				break;

			case 'extensions.treestyletab.tabbar.height':
				if (!this.shouldApplyNewPref) return;
				this._horizontalTabMaxIndentBase = 0;
				this.checkTabsIndentOverflow();
				break;

			case 'extensions.treestyletab.animation.enabled':
				this.setTabbrowserAttribute(this.kANIMATION_ENABLED, value ? 'true' : null );
				break;

			default:
				break;
		}
	},
	setTabbarStyle : function TSTBrowser_setTabbarStyle(aStyle)
	{
		if (/^(default|plain|flat|mixed|vertigo|metal|sidebar)$/.test(aStyle))
			aStyle = aStyle.toLowerCase();

		if (aStyle == 'default') { // old name (for compatibility)
			this.setTreePref('tabbar.style', aStyle = 'plain');
		}
		else if (// dropshadow is available only on Firefox 3.5 or later.
			aStyle == 'mixed' &&
			this.Comparator.compare(this.XULAppInfo.version, '3.5') < 0
			) {
			this.setTreePref('tabbar.style', aStyle = 'flat');
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
		if (aStyle == 'auto') {
			if (this.getTreePref('tabbar.style') == 'sidebar') {
				aStyle = 'osx';
			}
			else if (
				this.extensions.isAvailable('informationaltab@piro.sakura.ne.jp') &&
				this.getPref('extensions.informationaltab.thumbnail.enabled') &&
				this.getPref('extensions.informationaltab.thumbnail.position') < 100
				) {
				aStyle = 'retro';
			}
			else {
				aStyle = 'modern-black';
			}
		}
		this.setTabbrowserAttribute(this.kTWISTY_STYLE, aStyle);
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

			case 'SSTabRestoring':
				return this.onTabRestoring(aEvent);

			case 'SSTabRestored':
				return this.onTabRestored(aEvent);

			case 'select':
				return this.onTabSelect(aEvent);

			case 'click':
				return this.onClick(aEvent);

			case 'dblclick':
				return this.onDblClick(aEvent);

			case 'mousedown':
				return this.onMouseDown(aEvent);

			case 'mouseup':
				return this.onMouseUp(aEvent);

			case 'scroll':
				return this.onScroll(aEvent);

			case 'popupshowing':
				return this.onPopupShowing(aEvent)


			case 'dragstart':
				return this.tabbarDNDObserver.onDragStart(aEvent);

			case 'dragenter':
				return this.tabbarDNDObserver.onDragEnter(aEvent);

			case 'dragleave':
				return (aEvent.currentTarget == this.tabStrip ?
							this.tabbarDNDObserver :
							this.panelDNDObserver).onDragLeave(aEvent);

			case 'dragend':
				return this.tabbarDNDObserver.onDragEnd(aEvent);

			case 'dragover':
			case 'dragdrop':
			case 'drop':
				let (observer) {
					if (aEvent.currentTarget == this.tabStrip) {
						observer = this.tabbarDNDObserver;
					}
					else {
						observer = this.panelDNDObserver;
						if ('nsDragAndDrop' in window) {// for Firefox 3.5 or older
							// don't use nsDragAndDrop if it can't be dropped!!
							// http://piro.sakura.ne.jp/latest/blosxom/mozilla/xul/2007-02-02_splitbrowser-dragdrop.htm
							if (observer.canDrop(aEvent))
								nsDragAndDrop[aEvent.type == 'dragover' ? 'dragOver' : 'drop' ](aEvent, observer);
							return;
						}
					}
					observer[aEvent.type == 'dragover' ? 'onDragOver' : 'onDrop' ](aEvent);
				}
				return;


			case 'mouseover':
				if (this.isEventFiredOnTwisty(aEvent))
					aEvent.target.setAttribute(this.kTWISTY_HOVER, true);
				return;

			case 'mouseout':
				if (this.isEventFiredOnTwisty(aEvent))
					aEvent.target.removeAttribute(this.kTWISTY_HOVER);
				return;

			case 'overflow':
			case 'underflow':
				return this.onTabbarOverflow(aEvent);

			case 'resize':
				return this.onResize(aEvent);


			case 'TreeStyleTabPrintPreviewEntered':
				return this.onTreeStyleTabPrintPreviewEntered(aEvent);
			case 'TreeStyleTabPrintPreviewExited':
				return this.onTreeStyleTabPrintPreviewExited(aEvent);


			case 'MultipleTabHandlerTabsClosing':
				if (!this.onTabsRemoving(aEvent))
					aEvent.preventDefault();
				return;
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
				this.attachTabTo(tab, parent);
			}

			let refTab;
			let newIndex = -1;
			if (hasStructure) {
			}
			else if (this.insertBefore &&
				(refTab = this.getTabById(this.insertBefore))) {
				newIndex = refTab._tPos;
			}
			else if (parent &&
				this.getTreePref('insertNewChildAt') == this.kINSERT_FISRT &&
				this.multipleCount == 0) {
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

		if (this.readiedToOpenDivertedTab) {
			if (!this.getPref('browser.tabs.loadDivertedInBackground'))
				b.selectedTab = tab;
			this.readiedToOpenDivertedTab = false;
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

		return true;
	},
	_checkRestoringWindowTimerOnTabAdded : null,
 
	onTabRemoved : function TSTBrowser_onTabRemoved(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.mTabBrowser;

		this.stopTabIndentAnimation(tab);
		this.stopTabCollapseAnimation(tab);

		var closeParentBehavior = this.getTreePref('closeParentBehavior');
		var closeRootBehavior = this.getTreePref('closeRootBehavior');

		var collapsed = this.isCollapsed(tab);
		if (collapsed)
			this.stopRendering();

		var subtreeCollapsed = this.isSubtreeCollapsed(tab);
		if (
			closeParentBehavior == this.CLOSE_PARENT_BEHAVIOR_CLOSE ||
			subtreeCollapsed
			) {
			let tabs = this.getDescendantTabs(tab);
			if (this.fireTabSubtreeClosingEvent(tab, tabs)) {
				if (subtreeCollapsed)
					this.stopRendering();

				this.markAsClosedSet([tab].concat(tabs));

				tabs.reverse().forEach(function(aTab) {
					b.removeTab(aTab);
				}, this);

				// for last tab closing, we have to open new tab manually if running on Firefox 3.0.
				if (
					!('_beginRemoveTab' in b) && !('_endRemoveTab' in b) && // Firefox 3.0.x
					this.getTabsArray(b).length == 1 // last tab
					) {
					b.addTab('about:blank');
				}

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

		var backupAttributes = {};
		var indentModifiedTabs = [];

		if (firstChild) {
			backupAttributes[this.kCHILDREN] = this.getTabValue(tab, this.kCHILDREN);
			let children   = this.getChildTabs(tab);
			children.forEach((
				(closeParentBehavior == this.CLOSE_PARENT_BEHAVIOR_DETACH) ?
					function(aTab) {
						indentModifiedTabs.push(aTab);
						this.partTab(aTab, {
							dontUpdateIndent : true
						});
						this.moveTabSubtreeTo(aTab, this.getLastTab(b)._tPos);
					} :
				(parentTab ?
					(
						closeParentBehavior == this.CLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST &&
						this.getChildTabs(parentTab).length > 1
					) :
					closeRootBehavior == this.CLOSE_ROOT_BEHAVIOR_PROMOTE_FIRST
				) ?
					function(aTab, aIndex) {
						this.partTab(aTab, { dontUpdateIndent : true });
						if (aIndex == 0) {
							nextFocusedTab = aTab;
							indentModifiedTabs.push(aTab);
							if (parentTab) {
								this.attachTabTo(aTab, parentTab, {
									dontUpdateIndent : true,
									dontExpand       : true,
									dontMove         : true
								});
							}
							this.collapseExpandSubtree(aTab, false);
							this.deleteTabValue(aTab, this.kSUBTREE_COLLAPSED);
						}
						else {
							this.attachTabTo(aTab, children[0], {
								dontUpdateIndent : true,
								dontExpand       : true,
								dontMove         : true
							});
						}
					} :
				parentTab ?
					function(aTab) {
						indentModifiedTabs.push(aTab);
						this.attachTabTo(aTab, parentTab, {
							dontUpdateIndent : true,
							dontExpand       : true,
							dontMove         : true
						});
					} :
					function(aTab) {
						indentModifiedTabs.push(aTab);
						this.partTab(aTab, { dontUpdateIndent : true });
					}
			), this);
			if (closeParentBehavior == this.CLOSE_PARENT_BEHAVIOR_PROMOTE_ALL ||
				closeParentBehavior == this.CLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST)
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
						b.removeTab(parentTab);
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
			this._focusChangedByCurrentTabRemove = true;
			if (
				nextFocusedTab &&
				this._tabFocusAllowance.every(function(aFunc) {
					try {
						return aFunc.call(this, b);
					}
					catch(e) {
						return false;
					}
				}, this)
				)
				b.selectedTab = nextFocusedTab;
		}

		this.updateLastScrollPosition();

		this.destroyTab(tab);

		if (collapsed)
			this.startRendering();
	},
	CLOSE_PARENT_BEHAVIOR_PROMOTE_FIRST : 3,
	CLOSE_PARENT_BEHAVIOR_PROMOTE_ALL   : 0,
	CLOSE_PARENT_BEHAVIOR_DETACH        : 1,
	CLOSE_PARENT_BEHAVIOR_CLOSE         : 2,
	CLOSE_ROOT_BEHAVIOR_PROMOTE_FIRST   : 3,
	CLOSE_ROOT_BEHAVIOR_DETACH          : 1,
	getNextFocusedTab : function TSTBrowser_getNextFocusedTab(aTab)
	{
		return this.getNextSiblingTab(aTab) ||
				this.getPreviousVisibleTab(aTab);
	},
 
	onTabsRemoving : function TSTBrowser_onTabsRemoving(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.tabs[0]);

		var trees = this.splitTabsToSubtrees(aEvent.tabs);
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
		old = this.getTabsArray(b)[old];

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

		if (
			this.subTreeMovingCount ||
			this.internallyTabMovingCount ||
			// We don't have to fixup tree structure for a NEW TAB
			// which has already been structured.
			(newlyOpened && this.getParentTab(tab))
			)
			return;

		this.attachTabFromPosition(tab, aEvent.detail);
	},
	
	attachTabFromPosition : function TSTBrowser_attachTabFromPosition(aTab, aOldPosition) 
	{
		var parent = this.getParentTab(aTab);

		if (aOldPosition === void(0)) aOldPosition = aTab._tPos;

		var pos = this.getChildIndex(aTab, parent);
		var oldPos = this.getChildIndex(this.getTabsArray(this.mTabBrowser)[aOldPosition], parent);
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
			if (newParent)
				this.attachTabTo(aTab, newParent, { insertBefore : nextTab });
			else
				this.partTab(aTab);
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
  
	onTabRestoring : function TSTBrowser_onTabRestoring(aEvent) 
	{
		this.restoreStructure(aEvent.originalTarget);
	},
	
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
			   from the temporary parent manually. */
			this.resetTab(tab, false);
		}
		this.deleteTabValue(tab, this.kCLOSED_SET_ID);

		this.setTabValue(tab, this.kID, id);
		this.tabsHash[id] = tab;

		if (closeSetId)
			this.restoreClosedSet(closeSetId, tab);

		var isSubtreeCollapsed = restoringMultipleTabs && (this.getTabValue(tab, this.kSUBTREE_COLLAPSED) == 'true');
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
				this.updateTabsIndent([tab], undefined, undefined, restoringMultipleTabs);
				this.checkTabsIndentOverflow();

				if (parent.getAttribute(this.kCHILDREN_RESTORING))
					this.correctChildTabsOrderWithDelay(parent);
			}
			else {
				this.deleteTabValue(tab, this.kPARENT);
			}
		}
		else if (children) {
			this.updateTabsIndent(tabs, undefined, undefined, restoringMultipleTabs);
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
		var behavior = this.undoCloseTabSetBehavior(0, true);
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
			) ||
			!((behavior = this.undoCloseTabSetBehavior(indexes.length, false)) & this.kUNDO_CLOSE_SET) ||
			(
				'_confirmOpenInTabs' in PlacesUIUtils &&
				PlacesUIUtils._confirmOpenInTabs &&
				!PlacesUIUtils._confirmOpenInTabs(indexes.length)
			)
			)
			return;

		this._restoringClosedSet = true;
		this.stopRendering();

		TreeStyleTabService.restoringTree = true;

		var offset = 0;
		indexes.forEach(function(aIndex) {
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
			if (this.hasChildTabs(aTab) && this.canCollapseSubtree()) {
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
			this.isEventFiredOnClickable(aEvent)
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
		var splitter = tab ? null : this.getSplitterFromEvent(aEvent) ;

		if (tab) {
			this.onTabClick(aEvent, tab);
		}
		else if (splitter) {
			TreeStyleTabService.onTabbarResizerClick(aEvent);
		}
		else {
			// click on indented space on the tab bar
			tab = this.getTabFromTabbarEvent(aEvent);
			if (tab) this.mTabBrowser.selectedTab = tab;
		}
	},
 
	onDblClick : function TSTBrowser_onDblClick(aEvent) 
	{
		switch (aEvent.currentTarget.localName)
		{
			case 'splitter':
				return this.resetTabbarSize();

			default:
				if (this.isVertical &&
					/^(?:(?:arrow)?scrollbox|tabs)$/.test(aEvent.originalTarget.localName)) {
					// re-send dblclick event from the inner-box of the scrollbox,
					// because Firefox's event listener (to open new tabs) handles
					// events only from the box.
					let box = this.mTabBrowser.tabContainer.mTabstrip;
					if (box && box._scrollbox) box = box._scrollbox;
					if (box) box = document.getAnonymousNodes(box)[0];
					if (box && box.localName == 'box') {
						let event = document.createEvent('MouseEvents');
						event.initMouseEvent('dblclick', true, true, window, aEvent.detail, aEvent.screenX, aEvent.screenY, aEvent.x, aEvent.y, aEvent.ctrlKey, aEvent.altKey, aEvent.shiftKey, aEvent.metaKey, aEvent.button, null);
						box.dispatchEvent(event);
					}
					aEvent.preventDefault();
					aEvent.stopPropagation();
					return;
				}
				let tab = this.getTabFromEvent(aEvent);
				if (tab &&
					this.hasChildTabs(tab) &&
					this.getTreePref('collapseExpandSubtree.dblclick')) {
					this.collapseExpandSubtree(tab, tab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');
					aEvent.preventDefault();
					aEvent.stopPropagation();
				}
				return;
		}
	},
 
	onMouseDown : function TSTBrowser_onMouseDown(aEvent) 
	{
		if (
			aEvent.button == 0 &&
			this.isEventFiredOnTwisty(aEvent)
			) {
			this.getTabFromEvent(aEvent).__treestyletab__preventSelect = true;
		}
		else if (
			'TabsOnTop' in window &&
			(
				this.currentTabbarPosition != 'top' ||
				!TabsOnTop.enabled
			) &&
			this.tabbarDNDObserver.canDragTabbar(aEvent)
			) {
			aEvent.stopPropagation();
		}
	},
 
	onMouseUp : function TSTBrowser_onMouseUp(aEvent) 
	{
		var splitter = this.getSplitterFromEvent(aEvent);
		if (splitter)
			TreeStyleTabService.onTabbarResized(aEvent);
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

		this.updateFloatingTabbar();
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
  
	onTreeStyleTabPrintPreviewEntered : function TSTBrowser_onTreeStyleTabPrintPreviewEntered(aEvent) 
	{
		this.setTabbrowserAttribute(this.kPRINT_PREVIEW, true);
	},
 
	onTreeStyleTabPrintPreviewExited : function TSTBrowser_onTreeStyleTabPrintPreviewExited(aEvent) 
	{
		this.removeTabbrowserAttribute(this.kPRINT_PREVIEW);
	},
  
/* drag and drop */ 
	
	get tabbarDNDObserver() 
	{
		return this._tabbarDNDObserver || (this._tabbarDNDObserver = new TreeStyleTabBrowserTabbarDNDObserver(this));
	},
 
	get panelDNDObserver() 
	{
		return this._panelDNDObserver || (this._panelDNDObserver = new TreeStyleTabBrowserTabpanelDNDObserver(this));
	},
 
	getCurrentDragSession : function TSTBrowser_getCurrentDragSession() 
	{
		return Components
				.classes['@mozilla.org/widget/dragservice;1']
				.getService(Components.interfaces.nsIDragService)
				.getCurrentSession();
	},
 
	getDropAction : function TSTBrowser_getDropAction(aEvent, aDragSession) 
	{
		if (!aDragSession)
			aDragSession = this.getCurrentDragSession();

		var tab = aDragSession ? this.getTabFromChild(aDragSession.sourceNode) : null ;
		this.ensureTabInitialized(tab);

		var info = this.getDropActionInternal(aEvent, tab);
		info.canDrop = true;
		info.source = tab;
		if (tab) {
			var isCopy = this.isCopyAction(aEvent);
			if (isCopy && 'duplicateTab' in this.mTabBrowser) {
				info.action |= this.kACTION_DUPLICATE;
			}
			if (
				!isCopy &&
				this.getTabBrowserFromChild(tab) != this.mTabBrowser &&
				(
					('duplicateTab' in this.mTabBrowser) ||
					('swapBrowsersAndCloseOther' in this.mTabBrowser)
				)
				) {
				info.action |= this.kACTION_IMPORT;
			}

			if (info.action & this.kACTIONS_FOR_DESTINATION) {
				if (info.action & this.kACTION_MOVE) info.action ^= this.kACTION_MOVE;
				if (info.action & this.kACTION_STAY) info.action ^= this.kACTION_STAY;
			}

			if (info.action & this.kACTION_ATTACH) {
				if (info.parent == tab) {
					info.canDrop = false;
				}
				else {
					var orig = tab;
					tab  = info.target;
					while (tab = this.getParentTab(tab))
					{
						if (tab != orig) continue;
						info.canDrop = false;
						break;
					}
				}
			}
		}
		return info;
	},
	
	getDropActionInternal : function TSTBrowser_getDropActionInternal(aEvent, aSourceTab) 
	{
		var tab        = aEvent.target;
		var b          = this.mTabBrowser;
		var tabs       = this.getTabsArray(b);
		var firstTab   = this.getFirstNormalTab(b);
		var lastTabIndex = tabs.length -1;
		var isInverted = this.isVertical ? false : window.getComputedStyle(b.parentNode, null).direction == 'rtl';
		var info       = {
				target       : null,
				position     : null,
				action       : null,
				parent       : null,
				insertBefore : null
			};

		var isTabMoveFromOtherWindow = aSourceTab && aSourceTab.ownerDocument != document;
		var isNewTabAction = !aSourceTab || aSourceTab.ownerDocument != document;

		if (tab.localName != 'tab') {
			var action = isTabMoveFromOtherWindow ? this.kACTION_STAY : (this.kACTION_MOVE | this.kACTION_PART) ;
			if (isNewTabAction) action |= this.kACTION_NEWTAB;
			if (aEvent[this.positionProp] < firstTab.boxObject[this.positionProp]) {
				info.target   = info.parent = info.insertBefore = firstTab;
				info.position = isInverted ? this.kDROP_AFTER : this.kDROP_BEFORE ;
				info.action   = action;
				return info;
			}
			else if (aEvent[this.positionProp] > tabs[lastTabIndex].boxObject[this.positionProp] + tabs[lastTabIndex].boxObject[this.sizeProp]) {
				info.target   = info.parent = tabs[lastTabIndex];
				info.position = isInverted ? this.kDROP_BEFORE : this.kDROP_AFTER ;
				info.action   = action;
				return info;
			}
			else {
				let index = b.getNewIndex ?
								b.getNewIndex(aEvent) :
								b.tabContainer._getDropIndex(aEvent) ;
				info.target = tabs[Math.min(index, lastTabIndex)];
			}
		}
		else {
			this.ensureTabInitialized(tab);
			info.target = tab;
		}

		var boxPos  = tab.boxObject[this.positionProp];
		var boxUnit = Math.round(tab.boxObject[this.sizeProp] / 3);
		if (aEvent[this.positionProp] < boxPos + boxUnit) {
			info.position = isInverted ? this.kDROP_AFTER : this.kDROP_BEFORE ;
		}
		else if (aEvent[this.positionProp] > boxPos + boxUnit + boxUnit) {
			info.position = isInverted ? this.kDROP_BEFORE : this.kDROP_AFTER ;
		}
		else {
			info.position = this.kDROP_ON;
		}

		switch (info.position)
		{
			case this.kDROP_ON:
				info.action       = this.kACTION_STAY | this.kACTION_ATTACH;
				info.parent       = tab;
				var visible = this.getNextVisibleTab(tab);
				info.insertBefore = this.getTreePref('insertNewChildAt') == this.kINSERT_FISRT ?
						(this.getFirstChildTab(tab) || visible) :
						(this.getNextSiblingTab(tab) || this.getNextTab(this.getLastDescendantTab(tab)) || visible);
				break;

			case this.kDROP_BEFORE:
/*
	[TARGET  ] ↑part from parent, and move

	  [      ]
	[TARGET  ] ↑attach to the parent of the target, and move

	[        ]
	[TARGET  ] ↑attach to the parent of the target, and move

	[        ]
	  [TARGET] ↑attach to the parent of the target (previous tab), and move
*/
				var prevTab = this.getPreviousVisibleTab(tab);
				if (!prevTab) {
					info.action       = this.kACTION_MOVE | this.kACTION_PART;
					info.insertBefore = firstTab;
				}
				else {
					var prevLevel   = Number(prevTab.getAttribute(this.kNEST));
					var targetNest = Number(tab.getAttribute(this.kNEST));
					info.parent       = (prevLevel < targetNest) ? prevTab : this.getParentTab(tab) ;
					info.action       = this.kACTION_MOVE | (info.parent ? this.kACTION_ATTACH : this.kACTION_PART );
					info.insertBefore = tab;
				}
				break;

			case this.kDROP_AFTER:
/*
	[TARGET  ] ↓if the target has a parent, attach to it and and move

	  [TARGET] ↓attach to the parent of the target, and move
	[        ]

	[TARGET  ] ↓attach to the parent of the target, and move
	[        ]

	[TARGET  ] ↓attach to the target, and move
	  [      ]
*/
				var nextTab = this.getNextVisibleTab(tab);
				if (!nextTab) {
					info.action = this.kACTION_MOVE | this.kACTION_ATTACH;
					info.parent = this.getParentTab(tab);
				}
				else {
					var targetNest = Number(tab.getAttribute(this.kNEST));
					var nextLevel   = Number(nextTab.getAttribute(this.kNEST));
					info.parent       = (targetNest < nextLevel) ? tab : this.getParentTab(tab) ;
					info.action       = this.kACTION_MOVE | (info.parent ? this.kACTION_ATTACH : this.kACTION_PART );
					info.insertBefore = nextTab;
/*
	[TARGET   ] ↓attach dragged tab to the parent of the target as its next sibling
	  [DRAGGED]
*/
					if (aSourceTab == nextTab && this.getDescendantTabs(info.parent).length == 1) {
						info.action = this.kACTION_MOVE | this.kACTION_ATTACH;
						info.parent = this.getParentTab(tab);
						info.insertBefore = this.getNextTab(nextTab);
					}
				}
				break;
		}

		if (isNewTabAction) action |= this.kACTION_NEWTAB;

		return info;
	},
  
	performDrop : function TSTBrowser_performDrop(aInfo, aDraggedTab) 
	{
		var tabsInfo = this.getDraggedTabsInfoFromOneTab(aInfo, aDraggedTab);
		if (!tabsInfo.draggedTab) return false;

		aDraggedTab = tabsInfo.draggedTab;
		var draggedTabs = tabsInfo.draggedTabs;
		var draggedRoots = tabsInfo.draggedRoots;

		var targetBrowser = this.mTabBrowser;
		var tabs = this.getTabsArray(targetBrowser);

		var sourceWindow = aDraggedTab.ownerDocument.defaultView;
		var sourceBrowser = this.getTabBrowserFromChild(aDraggedTab);

		var draggedWholeTree = [].concat(draggedRoots);
		draggedRoots.forEach(function(aRoot) {
			draggedWholeTree = draggedWholeTree.concat(this.getDescendantTabs(aRoot));
		}, this);
		while (aInfo.insertBefore && draggedWholeTree.indexOf(aInfo.insertBefore) > -1)
		{
			aInfo.insertBefore = this.getNextTab(aInfo.insertBefore);
		}

		if (aInfo.action & this.kACTIONS_FOR_SOURCE) {
			if (aInfo.action & this.kACTION_PART) {
				this.partTabsOnDrop(draggedRoots);
			}
			else if (aInfo.action & this.kACTION_ATTACH) {
				this.attachTabsOnDrop(draggedRoots, aInfo.parent);
			}
			else {
				return false;
			}

			if ( // if this move will cause no change...
				sourceBrowser == targetBrowser &&
				sourceBrowser.treeStyleTab.getNextVisibleTab(draggedTabs[draggedTabs.length-1]) == aInfo.insertBefore
				) {
				// then, do nothing
				return true;
			}
		}


		// prevent Multiple Tab Handler feature
		targetBrowser.duplicatingSelectedTabs = true;
		targetBrowser.movingSelectedTabs = true;


		var newRoots = [];
		var shouldClose = (
				aInfo.action & this.kACTION_IMPORT &&
				this.getTabsArray(sourceBrowser).length == draggedTabs.length
			);
		var oldTabs = [];
		var newTabs = [];
		var treeStructure = draggedTabs.map(function(aTab) {
				var parent = sourceBrowser.treeStyleTab.getParentTab(aTab);
				return parent ? draggedTabs.indexOf(parent) : -1 ;
			});

		var parentTabsArray = draggedTabs.map(function(aTab) {
				return (aInfo.action & this.kACTIONS_FOR_DESTINATION) ?
					sourceBrowser.treeStyleTab.getParentTab(aTab) : null ;
			}, this);

		// Firefox fails to "move" collapsed tabs. So, expand them first
		// and collapse them after they are moved.
		var collapseExpandState = [];
		if (aInfo.action & this.kACTION_IMPORT &&
			'swapBrowsersAndCloseOther' in targetBrowser) {
			draggedWholeTree.forEach(function(aTab) {
				collapseExpandState.push(this.getTabValue(aTab, this.kSUBTREE_COLLAPSED) == 'true');
				this.collapseExpandSubtree(aTab, false, true);
				this.collapseExpandTab(aTab, false, true);
			}, this);
		}

		var lastTabIndex = tabs.length -1;
		draggedTabs.forEach(function(aTab, aIndex) {
			var tab = aTab;
			if (aInfo.action & this.kACTIONS_FOR_DESTINATION) {
				var parent = parentTabsArray[aIndex];
				if (tabsInfo.isSelectionMove)
					sourceWindow.MultipleTabService.setSelection(aTab, false);
				if (aInfo.action & this.kACTION_IMPORT &&
					'swapBrowsersAndCloseOther' in targetBrowser) {
					tab = targetBrowser.addTab();
					tab.linkedBrowser.stop();
					tab.linkedBrowser.docShell;
					targetBrowser.swapBrowsersAndCloseOther(tab, aTab);
					targetBrowser.setTabTitle(tab);
				}
				else {
					tab = targetBrowser.duplicateTab(aTab);
					this.deleteTabValue(tab, this.kCHILDREN);
					this.deleteTabValue(tab, this.kPARENT);
					if (aInfo.action & this.kACTION_IMPORT)
						oldTabs.push(aTab);
				}
				newTabs.push(tab);
				if (tabsInfo.isSelectionMove)
					MultipleTabService.setSelection(tab, true);
				if (!parent || draggedTabs.indexOf(parent) < 0)
					newRoots.push(tab);
				lastTabIndex++;
			}

			var newIndex = aInfo.insertBefore ? aInfo.insertBefore._tPos : lastTabIndex ;
			if (aInfo.insertBefore && newIndex > tab._tPos) newIndex--;

			this.internallyTabMovingCount++;
			targetBrowser.moveTabTo(tab, newIndex);
			this.collapseExpandTab(tab, false, true);
			this.internallyTabMovingCount--;

		}, this);

		// close imported tabs from the source browser
		oldTabs.forEach(function(aTab) {
			sourceBrowser.removeTab(aTab);
		});
		if (shouldClose) this.closeOwner(sourceBrowser);

		// restore tree structure for newly opened tabs
		newTabs.forEach(function(aTab, aIndex) {
			var index = treeStructure[aIndex];
			if (index < 0) return;
			targetBrowser.treeStyleTab.attachTabTo(aTab, newTabs[index]);
		});
		newTabs.reverse();
		collapseExpandState.reverse();
		collapseExpandState.forEach(function(aCollapsed, aIndex) {
			this.collapseExpandSubtree(newTabs[aIndex], aCollapsed, true);
		}, this);

		if (aInfo.action & this.kACTIONS_FOR_DESTINATION &&
			aInfo.action & this.kACTION_ATTACH)
			this.attachTabsOnDrop(newRoots, aInfo.parent);

		// Multiple Tab Handler
		targetBrowser.movingSelectedTabs = false;
		targetBrowser.duplicatingSelectedTabs = false;

		return true;
	},
	
	getDraggedTabsInfoFromOneTab : function TSTBrowser_getDraggedTabsInfoFromOneTab(aInfo, aTab) 
	{
		aTab = this.getTabFromChild(aTab);
		if (!aTab)
			return {
				draggedTab      : null,
				draggedTabs     : [],
				draggedRoots    : [],
				isSelectionMove : false
			};

		var targetBrowser = this.mTabBrowser;
		var tabs = this.getTabsArray(targetBrowser);

		var draggedTabs = [aTab];
		var draggedRoots = [aTab];

		var sourceWindow = aTab.ownerDocument.defaultView;
		var sourceBrowser = this.getTabBrowserFromChild(aTab);


		var isSelectionMove = (
				'MultipleTabService' in sourceWindow &&
				sourceWindow.MultipleTabService.isSelected(aTab) &&
				MultipleTabService.allowMoveMultipleTabs
			);

		if (isSelectionMove) {
			draggedTabs = sourceWindow.MultipleTabService.getSelectedTabs(sourceBrowser);
			if (!(aInfo.action & this.kACTIONS_FOR_DESTINATION)) {
				draggedRoots = [];
				draggedTabs.forEach(function(aTab) {
					var parent = aTab,
						current;
					do {
						current = parent;
						parent = sourceBrowser.treeStyleTab.getParentTab(parent)
						if (parent && sourceWindow.MultipleTabService.isSelected(parent)) continue;
						draggedRoots.push(current);
						return;
					}
					while (parent);
				}, this);
			}
		}
		else if (aInfo.action & this.kACTIONS_FOR_DESTINATION) {
			draggedTabs = draggedTabs.concat(sourceBrowser.treeStyleTab.getDescendantTabs(aTab));
		}

		return {
			draggedTab      : aTab,
			draggedTabs     : draggedTabs,
			draggedRoots    : draggedRoots,
			isSelectionMove : isSelectionMove
		};
	},
 
	attachTabsOnDrop : function TSTBrowser_attachTabsOnDrop(aTabs, aParent) 
	{
		this.mTabBrowser.movingSelectedTabs = true; // Multiple Tab Handler
		aTabs.forEach(function(aTab) {
			if (!aTab.parentNode) return; // ignore removed tabs
			if (aParent)
				this.attachTabTo(aTab, aParent);
			else
				this.partTab(aTab);
			this.collapseExpandTab(aTab, false);
		}, this);
		this.mTabBrowser.movingSelectedTabs = false; // Multiple Tab Handler
	},
 
	partTabsOnDrop : function TSTBrowser_partTabsOnDrop(aTabs) 
	{
		this.mTabBrowser.movingSelectedTabs = true; // Multiple Tab Handler
		aTabs.forEach(function(aTab) {
			if (!aTab.parentNode) return; // ignore removed tabs
			this.partTab(aTab);
			this.collapseExpandTab(aTab, false);
		}, this);
		this.mTabBrowser.movingSelectedTabs = false; // Multiple Tab Handler
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
  
	clearDropPosition : function TSTBrowser_clearDropPosition() 
	{
		var b = this.mTabBrowser;
		var xpathResult = this.evaluateXPath(
				'child::xul:tab[@'+this.kDROP_POSITION+']',
				b.mTabContainer
			);
		for (var i = 0, maxi = xpathResult.snapshotLength; i < maxi; i++)
		{
			xpathResult.snapshotItem(i).removeAttribute(this.kDROP_POSITION);
		}
	},
 
	isDraggingAllTabs : function TSTBrowser_isDraggingAllTabs(aTab) 
	{
		var actionInfo = {
				action : this.kACTIONS_FOR_DESTINATION | this.kACTION_IMPORT
			};
		var tabsInfo = this.getDraggedTabsInfoFromOneTab(actionInfo, aTab);
		return tabsInfo.draggedTabs.length == this.getTabsArray(this.mTabBrowser).length;
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
		this.updateTabsIndent([aTab], undefined, undefined, true);
	},
 
	resetAllTabs : function TSTBrowser_resetAllTabs(aPartChildren) 
	{
		this.getTabsArray(this.mTabBrowser).forEach(function(aTab) {
			this.resetTab(aTab, aPartChildren);
		}, this);
	},
 
	get treeViewEnabled() /* PUBLIC API */ 
	{
		return this._treeViewEnabled;
	},
	set treeViewEnabled(aValue)
	{
		this._treeViewEnabled = aValue ? true : false ;
		if (this._treeViewEnabled) {
			let orient = this.isVertical ? 'vertical' : 'horizontal' ;
			if (this.getTreePref('allowSubtreeCollapseExpand.'+orient))
				this.setTabbrowserAttribute(this.kALLOW_COLLAPSE, true);
			this.updateTabsIndent(this.rootTabs, undefined, undefined, true);
		}
		else {
			this.removeTabbrowserAttribute(this.kALLOW_COLLAPSE);
			this.getTabsArray(this.browser).forEach(function(aTab) {
				this.updateTabIndent(aTab, 0, this.indentTarget, true);
			}, this);
		}
		return aValue;
	},
//	_treeViewEnabled : true,
  
/* attach/part */ 
	
	attachTabTo : function TSTBrowser_attachTabTo(aChild, aParent, aInfo) /* PUBLIC API */ 
	{
		var currentParent;
		if (
			!aChild ||
			!aParent ||
			aChild == aParent ||
			(currentParent = this.getParentTab(aChild)) == aParent ||
			aChild.pinned ||
			aParent.pinned
			) {
			this.fireAttachedEvent(aChild, aParent);
			return;
		}

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
			this.updateTabsIndent([aChild], undefined, undefined, aInfo.dontAnimate);
			this.checkTabsIndentOverflow();
		}

		this.fireAttachedEvent(aChild, aParent);
	},
	fireAttachedEvent : function TSTBrowser_fireAttachedEvent(aChild, aParent)
	{
		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabAttached', true, false);
		event.parentTab = aParent;
		aChild.dispatchEvent(event);
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
			this.updateTabsIndent([aChild], undefined, undefined, aInfo.dontAnimate);
			this.checkTabsIndentOverflow();
		}

		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabParted', true, false);
		event.parentTab = parentTab;
		aChild.dispatchEvent(event);

		if (this.isGroupTab(parentTab) && !this.hasChildTabs(parentTab)) {
			window.setTimeout(function(aTabBrowser) {
				if (parentTab.parentNode)
					aTabBrowser.removeTab(parentTab);
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
		this.getChildTabs(aTab).forEach(function(aTab) {
			this.partTab(aTab, aInfo);
		}, this);
	},
  
	updateTabsIndent : function TSTBrowser_updateTabsIndent(aTabs, aLevel, aTarget, aJustNow) 
	{
		if (!aTabs || !aTabs.length || !this._treeViewEnabled) return;

		if (aLevel === void(0)) {
			var parentTab = this.getParentTab(aTabs[0]);
			var aLevel = 0;
			while (parentTab)
			{
				aLevel++;
				parentTab = this.getParentTab(parentTab);
			}
		}

		var b = this.mTabBrowser;
		if (!aTarget) {
			let orient = this.isVertical ? 'vertical' : 'horizontal' ;
			aTarget = this.getTreePref('enableSubtreeIndent.'+orient) ? this.indentTarget : null ;
		}
		var margin = this.indent < 0 ? this.baseIndent : this.indent ;
		var indent = margin * aLevel;

		var multirow = this.isMultiRow();
		if (multirow) {
			let maxIndent = parseInt(aTabs[0].boxObject.height / 2);
			indent = Math.min(aLevel * 3, maxIndent);
		}

		Array.slice(aTabs).forEach(function(aTab) {
			if (!aTab.parentNode) return; // ignore removed tabs
			this.updateTabIndent(aTab, indent, aTarget, aJustNow);
			aTab.setAttribute(this.kNEST, aLevel);
			this.updateTabsIndent(this.getChildTabs(aTab), aLevel+1, aTarget, aJustNow);
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
 
	updateTabIndent : function TSTBrowser_updateTabIndent(aTab, aIndent, aTarget, aJustNow) 
	{
		this.stopTabIndentAnimation(aTab);

		if (this.isMultiRow()) {
			let colors = '-moz-border-'+aTarget+'-colors:'+(function() {
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
					'; border-'+aTarget+': solid transparent '+aIndent+'px !important;'+colors
				);
			}, this);

			return;
		}

		var regexp = this.indentRulesRegExp;
		var property = this.indentProp+'-'+aTarget;
		var CSSTransitionEnabled = ('Transition' in aTab.style || 'MozTransition' in aTab.style);
		if (
			!this.animationEnabled ||
			aJustNow ||
			this.indentDuration < 1 ||
			!aTarget ||
			CSSTransitionEnabled ||
			this.isCollapsed(aTab)
			) {
			aTab.setAttribute(
				'style',
				aTab.getAttribute('style')
					.replace(regexp, '')+';'+
					(aTarget || CSSTransitionEnabled ? property+':'+aIndent+'px !important;' : '' )
			);
			return;
		}

		var startIndent = this.getPropertyPixelValue(aTab, property);
		var delta       = aIndent - startIndent;
		var radian      = 90 * Math.PI / 180;
		var self        = this;
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
			aTab.setAttribute(
				'style',
				aTab.getAttribute('style').replace(regexp, '')+';'+
				property+':'+indent+'px !important;'
			);
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
			0, 0, this.indentDuration
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
		var regexp = this.indentRulesRegExp;
		var indents = (aExistingTab.getAttribute('style') || '').match(regexp) || [];
		aNewTab.setAttribute(
			'style',
			aNewTab.getAttribute('style')
				.replace(regexp, '')+';'+indents.join(';')
		);
	},
 
	updateAllTabsIndent : function TSTBrowser_updateAllTabsIndent() 
	{
		this.updateTabsIndent(this.rootTabs, 0);
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
		if (!nest) return;

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
 
	updateTabsCount : function TSTBrowser_updateTabsCount(aTab, aDontUpdateAncestor) 
	{
		var count = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER);
		if (count) {
			count.setAttribute('value', this.getDescendantTabs(aTab).length);
		}
		var parent = this.getParentTab(aTab);
		if (parent && !aDontUpdateAncestor)
			this.updateTabsCount(parent);
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

		this.doingCollapseExpand = false;
	},
 
	collapseExpandTab : function TSTBrowser_collapseExpandTab(aTab, aCollapse, aJustNow) 
	{
		if (!aTab || !this.getParentTab(aTab)) return;

		this.setTabValue(aTab, this.kCOLLAPSED, aCollapse);
		this.updateTabCollapsed(aTab, aCollapse, aJustNow);

		/* PUBLIC API */
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabCollapsedStateChange', true, false);
		event.collapsed = aCollapse;
		aTab.dispatchEvent(event);

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
		let (firstTab) {
			firstTab = this.getFirstNormalTab(this.mTabBrowser);
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
		}
		else {
			startMargin  = maxMargin;
			endMargin    = 0;
			startOpacity = 0;
			endOpacity   = 1;
		}

		if (
			!this.animationEnabled ||
			aJustNow ||
			this.collapseDuration < 1 ||
//			!this.isVertical ||
			!this.canCollapseSubtree()
			) {
			if (aCollapsed)
				aTab.setAttribute(this.kCOLLAPSED_DONE, true);
			else
				aTab.removeAttribute(this.kCOLLAPSED_DONE);

			aTab.setAttribute(
				'style',
				aTab.getAttribute('style')
					.replace(this.collapseRulesRegExp, '')
					.replace(this.kOPACITY_RULE_REGEXP, '') +
				(CSSTransitionEnabled ?
					(
						collapseProp+': -'+endMargin+'px !important;'+
						'opacity: '+endOpacity+' !important;'
					) :
					'' )
			);
			return;
		}

		var deltaMargin  = endMargin - startMargin;
		var deltaOpacity = endOpacity - startOpacity;

		if (CSSTransitionEnabled) {
			aTab.setAttribute(
				'style',
				aTab.getAttribute('style')
					.replace(this.collapseRulesRegExp, '')+';'+
					collapseProp+': -'+endMargin+'px !important;'+
					'opacity: '+endOpacity+' !important;'
			);
		}
		else {
			aTab.setAttribute(
				'style',
				aTab.getAttribute('style')
					.replace(this.collapseRulesRegExp, '')+';'+
					collapseProp+': -'+startMargin+'px !important;'+
					'opacity: '+startOpacity+' !important;'
			);
		}

		if (!aCollapsed) {
			aTab.setAttribute(offsetAttr, maxMargin);
			aTab.removeAttribute(this.kCOLLAPSED_DONE);
		}

		var radian = 90 * Math.PI / 180;
		var self   = this;
		aTab.__treestyletab__updateTabCollapsedTask = function(aTime, aBeginning, aChange, aDuration) {
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
					aTab.setAttribute(
						'style',
						aTab.getAttribute('style')
							.replace(self.collapseRulesRegExp, '')
							.replace(self.kOPACITY_RULE_REGEXP, '')
					);
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
					aTab.setAttribute(
						'style',
						aTab.getAttribute('style')
							.replace(self.collapseRulesRegExp, '')+';'+
							collapseProp+': -'+margin+'px !important;'+
							'opacity: '+opacity+' !important;'
					);
				}
				aTab.setAttribute(offsetAttr, maxMargin);
				return false;
			}
		};
		this.animationManager.addTask(
			aTab.__treestyletab__updateTabCollapsedTask,
			0, 0, this.collapseDuration
		);
	},
	kOPACITY_RULE_REGEXP : /opacity\s*:[^;]+;?/,
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
			!this.canCollapseSubtree())
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
			0, 0, this.smoothScrollDuration
		);
	},
	smoothScrollTask : null,
  
	scrollToTab : function TSTBrowser_scrollToTab(aTab) 
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
   
/* show/hide tab bar */ 
	get autoHide()
	{
		return this._autoHide || (this._autoHide = new TreeStyleTabBrowserAutoHide(this));
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

	set autoHideShown() { return this.autoHide.expanded; },
	set autoHideShown(aValue) { return this.tabbarShown = aValue; },
	set autoHideXOffset() { return this.autoHide.XOffset; },
	set autoHideYOffset() { return this.autoHide.YOffset; },
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

TreeStyleTabBrowser.prototype.__proto__ = TreeStyleTabService;
 
