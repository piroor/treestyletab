function TreeStyleTabBrowser(aTabBrowser) 
{
	this.mTabBrowser = aTabBrowser;
	if (TreeStyleTabService.isGecko19) {
		this.isPlatformNotSupported = false;
		this.isTimerSupported = true;
	}
}
 
TreeStyleTabBrowser.prototype = { 

	kMENUITEM_REMOVESUBTREE            : 'context-item-removeTabSubTree',
	kMENUITEM_REMOVECHILDREN           : 'context-item-removeDescendantTabs',
	kMENUITEM_COLLAPSEEXPAND_SEPARATOR : 'context-separator-collapseExpandAll',
	kMENUITEM_COLLAPSE                 : 'context-item-collapseAllSubtree',
	kMENUITEM_EXPAND                   : 'context-item-expandAllSubtree',
	kMENUITEM_AUTOHIDE_SEPARATOR       : 'context-separator-toggleAutoHide',
	kMENUITEM_AUTOHIDE                 : 'context-item-toggleAutoHide',
	kMENUITEM_FIXED                    : 'context-item-toggleFixed',
	kMENUITEM_POSITION                 : 'context-menu-tabbarPosition',
	kMENUITEM_BOOKMARKSUBTREE          : 'context-item-bookmarkTabSubTree',
	
	mTabBrowser : null, 

	tabbarResizing : false,

	levelMargin          : -1,
	levelMarginProp      : 'margin-left',
	positionProp         : 'screenY',
	sizeProp             : 'height',
	invertedPositionProp : 'screenX',
	invertedSizeProp     : 'width',

	togglerSize : 0,
 
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
			this._scrollBox = document.getAnonymousElementByAttribute(this.mTabBrowser.mTabContainer, 'class', 'tabs-frame') || // Tab Mix Plus
						this.mTabBrowser.mTabContainer.mTabstrip;
		}
		return this._scrollBox;
	},
	_scrollBox : null,
	get scrollBoxObject()
	{
		return this.scrollBox.scrollBoxObject ||
				this.scrollBox.boxObject.QueryInterface(Components.interfaces.nsIScrollBoxObject); // Tab Mix Plus
	},
 
/* utils */ 
	
/* get tab contents */ 
	
	getTabLabel : function(aTab) 
	{
		var label = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-stack') || // Mac OS X
					document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-container') || // Tab Mix Plus
					document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text');
		return label;
	},
 
	getTabClosebox : function(aTab) 
	{
		var close = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-close-button tabs-closebutton always-right') || // Tab Mix Plus
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
 
	isTabInViewport : function(aTab) 
	{
		if (!aTab) return false;
		var tabBox = aTab.boxObject;
		var barBox = this.scrollBox.boxObject;
		return (tabBox.screenX >= barBox.screenX &&
			tabBox.screenX + tabBox.width <= barBox.screenX + barBox.width &&
			tabBox.screenY >= barBox.screenY &&
			tabBox.screenY + tabBox.height <= barBox.screenY + barBox.height);
	},
  
	isMultiRow : function() 
	{
		return false;
	},
  
/* initialize */ 
	
	init : function() 
	{
		var b = this.mTabBrowser;

		this.initTabbar();

		b.addEventListener('TabOpen',        this, true);
		b.addEventListener('TabClose',       this, true);
		b.addEventListener('TabMove',        this, true);
		b.addEventListener('SSTabRestoring', this, true);
		b.mStrip.addEventListener('dragenter', this, false);
		b.mStrip.addEventListener('dragexit', this, false);
		b.mStrip.addEventListener('dragover', this, false);
		b.mStrip.addEventListener('dragdrop', this, false);
		b.mTabContainer.addEventListener('mouseover', this, true);
		b.mTabContainer.addEventListener('mouseout', this, true);
		b.mTabContainer.addEventListener('click', this, true);
		b.mTabContainer.addEventListener('dblclick', this, true);
		b.mTabContainer.addEventListener('mousedown', this, true);
		b.mTabContainer.addEventListener('select', this, true);
		b.mTabContainer.addEventListener('scroll', this, true);


		b.mTabContainer.removeAttribute('overflow'); // Firefox 3.0.x
		var container = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-container');
		if (container) container.removeAttribute('overflow');

		var inner = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabbrowser-arrowscrollbox');
		if (inner) {
			inner.addEventListener('overflow', this, true);
			inner.addEventListener('underflow', this, true);
			window.setTimeout(function() {
				inner = document.getAnonymousElementByAttribute(inner, 'anonid', 'scrollbox');
				if (inner) inner = document.getAnonymousNodes(inner)[0];
				if (
					inner &&
					(
						inner.boxObject.width > container.boxObject.width ||
						inner.boxObject.height > container.boxObject.height
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
		}


		/* Closing collapsed last tree breaks selected tab.
		   To solve this problem, I override the setter to
		   force to set a tab and forbid it becomes null. */
		var getter = b.__lookupGetter__('selectedTab');
		var setter = b.__lookupSetter__('selectedTab');
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


		var selectNewTab = '_selectNewTab' in b.mTabContainer ?
				'_selectNewTab' : // Firefox 3
				'selectNewTab' ; // Firefox 2
		eval('b.mTabContainer.'+selectNewTab+' = '+
			b.mTabContainer[selectNewTab].toSource().replace(
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
				/(\})(\)?)$/,
				<![CDATA[
					var b = TreeStyleTabService.getTabBrowserFromChild(this);
					b.treeStyleTab.updateInvertedTabContentsOrder(true);
				$1$2]]>
			)
		);

		eval('b.mTabContainer.advanceSelectedTab = '+
			b.mTabContainer.advanceSelectedTab.toSource().replace(
				'{',
				<![CDATA[$&
					if (TreeStyleTabService.getTreePref('focusMode') == TreeStyleTabService.kFOCUS_VISIBLE) {
						(function(aDir, aWrap, aSelf) {
							var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(aSelf).treeStyleTab;
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
								if ('_selectNewTab' in aSelf)
									aSelf._selectNewTab(nextTab, aDir, aWrap); // Fx 3
								else
									aSelf.selectNewTab(nextTab, aDir, aWrap); // Fx 2
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

		this.updateTabDNDObserver(b);

		eval('b.getNewIndex = '+
			b.getNewIndex.toSource().replace(
				/\.screenX/g, '[this.treeStyleTab.positionProp]'
			).replace(
				/\.width/g, '[this.treeStyleTab.sizeProp]'
			)
		);

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
					this.treeStyleTab.internallyTabMoving = true;
					var parentTab = this.treeStyleTab.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, this.treeStyleTab.getFirstChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						$&
					}
					this.treeStyleTab.internallyTabMoving = false;
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
					this.treeStyleTab.internallyTabMoving = true;
					var parentTab = this.treeStyleTab.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, this.treeStyleTab.getLastChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						$&
					}
					this.treeStyleTab.internallyTabMoving = false;
				]]>
			)
		);

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

		eval('b.loadTabs = '+
			b.loadTabs.toSource().replace(
				'var tabNum = ',
				<![CDATA[
					if (this.treeStyleTab.readyToAttachNewTabGroup)
						TreeStyleTabService.readyToOpenChildTab(firstTabAdded || this.selectedTab, true);
					$&]]>
			).replace(
				'if (!aLoadInBackground)',
				<![CDATA[
					if (TreeStyleTabService.checkToOpenChildTab(this))
						TreeStyleTabService.stopToOpenChildTab(this);
					$&]]>
			)
		);

		eval('b.createTooltip = '+
			b.createTooltip.toSource().replace(
				'if (tn.hasAttribute("label")) {',
				<![CDATA[
					else if (tn.getAttribute(TreeStyleTabService.kTWISTY_HOVER) == 'true') {
						var key = tn.getAttribute(TreeStyleTabService.kSUBTREE_COLLAPSED) == 'true' ? 'tooltip.expandSubtree' : 'tooltip.collapseSubtree' ;
						event.target.setAttribute(
							'label',
							tn.hasAttribute('label') ?
								TreeStyleTabService.stringbundle.getFormattedString(
									key+'.labeled',
									[tn.getAttribute('label')]
								) :
								TreeStyleTabService.stringbundle.getString(key)
						);
						return true;
					}
					$&]]>
			)
		);

		eval('b.onTabBarDblClick = '+
			b.onTabBarDblClick.toSource().replace(
				'aEvent.originalTarget.localName == "box"',
				'/^(box|(arrow)?scrollbox|tabs)$/.test(aEvent.originalTarget.localName)'
			)
		);

		eval('b.warnAboutClosingTabs = '+
			b.warnAboutClosingTabs.toSource().replace(
				'var numTabs = ', 'var numTabs = this.__treestyletab__closedTabsNum || '
			)
		);

		if ('_onDragEnd' in b) {
			eval('b._onDragEnd = '+b._onDragEnd.toSource().replace(
				'this._replaceTabWithWindow(',
				'if (this.treeStyleTab.isDraggingAllTabs(draggedTab)) return; $&'
			));
		}

		// https://bugzilla.mozilla.org/show_bug.cgi?id=406216
		if ('_beginRemoveTab' in b) {
			eval('b._beginRemoveTab = '+b._beginRemoveTab.toSource().replace(
				'for (let i = 0; i < l; ++i) {',
				'l = this.mTabs.length; $&'
			));
		}

		var tabs = this.getTabs(b);
		for (var i = 0, maxi = tabs.snapshotLength; i < maxi; i++)
		{
			this.initTab(tabs.snapshotItem(i));
		}

		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.style');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.twisty.style');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.showBorderForFirstTab');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.invertScrollbar');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.hideNewTabButton');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.hideAlltabsButton');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.allowSubtreeCollapseExpand');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.fixed');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.transparent.style');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.togglerSize');
		window.setTimeout(function() {
			b.treeStyleTab.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.autoHide.mode');
		}, 0);

		delete i;
		delete maxi;
		delete tabs;

		var tabContext = document.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContext.addEventListener('popupshowing', this, false);
		tabContext.addEventListener('popuphiding', this, false);
		window.setTimeout(function(aSelf) {
			var suffix = '-tabbrowser-'+(b.id || 'instance-'+parseInt(Math.random() * 65000));
			[
				aSelf.kMENUITEM_REMOVESUBTREE,
				aSelf.kMENUITEM_REMOVECHILDREN,
				aSelf.kMENUITEM_COLLAPSEEXPAND_SEPARATOR,
				aSelf.kMENUITEM_COLLAPSE,
				aSelf.kMENUITEM_EXPAND,
				aSelf.kMENUITEM_AUTOHIDE_SEPARATOR,
				aSelf.kMENUITEM_AUTOHIDE,
				aSelf.kMENUITEM_FIXED,
				aSelf.kMENUITEM_POSITION
			].forEach(function(aID) {
				var item = document.getElementById(aID).cloneNode(true);
				item.setAttribute('id', item.getAttribute('id')+suffix);
				tabContext.appendChild(item);
			});

			var item = document.getElementById(aSelf.kMENUITEM_BOOKMARKSUBTREE).cloneNode(true);
			item.setAttribute('id', item.getAttribute('id')+suffix);
			var refNodes = tabContext.getElementsByAttribute('command', 'Browser:BookmarkAllTabs');
			tabContext.insertBefore(
				item,
				(refNodes && refNodes.length) ?
					(aSelf.getNextTab(refNodes[0]) || refNodes[0]) :
					null
			);
		}, 0, this);

		var allTabPopup = document.getAnonymousElementByAttribute(b.mTabContainer, 'anonid', 'alltabs-popup');
		if (allTabPopup) {
			allTabPopup.addEventListener('popupshowing', this, false);
		}

		/* To move up content area on the tab bar, switch tab.
		   If we don't do it, a gray space appears on the content area
		   by negative margin of it. */
		if (b.getAttribute(this.kTABBAR_POSITION) == 'left' &&
			b.getAttribute(this.kSCROLLBAR_INVERTED) == 'true') {
			b.removeTab(
				b.selectedTab = b.addTab('about:blank')
			);
		}

		var stack = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-stack');
		if (stack) {
			var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
			canvas.setAttribute('style', 'display:none;width:1;height:1;');
			stack.firstChild.appendChild(canvas);
			this.tabbarCanvas = canvas;
			this.clearTabbarCanvas();
		}

		this.ObserverService.addObserver(this, 'TreeStyleTab:levelMarginModified', false);
		this.ObserverService.addObserver(this, 'TreeStyleTab:collapseExpandAllSubtree', false);
		this.addPrefListener(this);
	},
	
	initTab : function(aTab) 
	{
		if (!aTab.hasAttribute(this.kID)) {
			var id = this.getTabValue(aTab, this.kID) || this.makeNewId();
			this.setTabValue(aTab, this.kID, id);
		}

		aTab.__treestyletab__linkedTabBrowser = this.mTabBrowser;

		this.initTabAttributes(aTab);
		this.initTabContents(aTab);

		aTab.setAttribute(this.kNEST, 0);
	},
	ensureTabInitialized : function(aTab)
	{
		if (!aTab || aTab.getAttribute(this.kID)) return;
		this.initTab(aTab);
	},
	
	initTabAttributes : function(aTab) 
	{
		var pos = this.mTabBrowser.getAttribute(this.kTABBAR_POSITION);
		if (pos == 'left' || pos == 'right') {
			aTab.setAttribute('align', 'stretch');
			aTab.removeAttribute('maxwidth');
			aTab.removeAttribute('minwidth');
			aTab.removeAttribute('width');
			aTab.removeAttribute('flex');
			aTab.maxWidth = 65000;
			aTab.minWidth = 0;
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
			aTab.removeAttribute('dir'); // Tab Mix Plus
		}
	},
 
	initTabContents : function(aTab) 
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
			counter.lastChild.setAttribute('class', this.kCOUNTER);
			counter.lastChild.setAttribute('value', '(0)');

			if (label) {
				label.parentNode.insertBefore(counter, label.nextSibling);
			}
		}
		this.initTabContentsOrder(aTab);
	},
 
	initTabContentsOrder : function(aTab) 
	{
		var label = this.getTabLabel(aTab);
		var close = this.getTabClosebox(aTab);
		var counter = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER);

		var nodes = document.getAnonymousNodes(aTab);
		for (var i = nodes.length-1; i > -1; i--)
		{
			nodes[i].setAttribute('ordinal', (i + 1) * 10);
		}

		nodes = label.parentNode.childNodes;
		if (this.mTabBrowser.getAttribute(this.kTABBAR_POSITION) == 'right' &&
			this.mTabBrowser.getAttribute(this.kUI_INVERTED) == 'true') {
			for (var i = nodes.length-1; i > -1; i--)
			{
				if (nodes[i].getAttribute('class') == 'informationaltab-thumbnail-container')
					continue;
				nodes[i].setAttribute('ordinal', (nodes.length - i + 1) * 10);
			}
			if (counter)
				counter.setAttribute('ordinal', parseInt(label.getAttribute('ordinal')) + 1);
			close.setAttribute('ordinal', parseInt(label.parentNode.getAttribute('ordinal')) - 5);
		}
		else {
			for (var i = nodes.length-1; i > -1; i--)
			{
				if (nodes[i].getAttribute('class') == 'informationaltab-thumbnail-container')
					continue;
				nodes[i].setAttribute('ordinal', (i + 1) * 10);
			}
		}
	},
 
	updateInvertedTabContentsOrder : function(aAll) 
	{
		if (this.getTreePref('tabbar.position') != 'right' ||
			!this.getTreePref('tabbar.invertUI')) return;

		window.setTimeout(function(aSelf) {
			var b = aSelf.mTabBrowser;
			if (aAll) {
				aSelf.getTabsArray(b).forEach(function(aTab) {
					aSelf.initTabContentsOrder(aTab);
				});
			}
			else {
				aSelf.initTabContentsOrder(b.selectedTab);
			}
		}, 0, this);
	},
  
	initTabbar : function(aPosition) 
	{
		this.clearTabbarCanvas();

		var b = this.mTabBrowser;

		if (!aPosition) aPosition = this.getTreePref('tabbar.position');
		aPosition = String(aPosition).toLowerCase();

		if (b.getAttribute('id') != 'content' &&
			!this.getTreePref('tabbar.position.subbrowser.enabled')) {
			aPosition = 'top';
		}

		var pos = (aPosition == 'left') ? this.kTABBAR_LEFT :
			(aPosition == 'right') ? this.kTABBAR_RIGHT :
			(aPosition == 'bottom') ? this.kTABBAR_BOTTOM :
			this.kTABBAR_TOP;

		var splitter = document.getAnonymousElementByAttribute(b, 'class', this.kSPLITTER);
		var toggler = document.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER);
		if (!splitter) {
			splitter = document.createElement('splitter');
			splitter.setAttribute('class', this.kSPLITTER);
			splitter.setAttribute('onmouseup', 'TreeStyleTabService.onTabbarResized(event);');
			splitter.setAttribute('state', 'open');
			splitter.appendChild(document.createElement('grippy'));
			var ref = b.mPanelContainer;
			ref.parentNode.insertBefore(splitter, ref);
			toggler = document.createElement('spacer');
			toggler.setAttribute('class', this.kTABBAR_TOGGLER);
			b.mStrip.parentNode.insertBefore(toggler, b.mStrip);
		}

		// Tab Mix Plus
		var scrollFrame = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-frame');
		var newTabBox = document.getAnonymousElementByAttribute(b.mTabContainer, 'id', 'tabs-newbutton-box');
		var tabBarMode = this.getPref('extensions.tabmix.tabBarMode');

		// All-in-One Sidebar
		var toolboxContainer = document.getAnonymousElementByAttribute(b.mStrip, 'anonid', 'aiostbx-toolbox-tableft');
		if (toolboxContainer) toolboxContainer = toolboxContainer.parentNode;

		var scrollInnerBox = b.mTabContainer.mTabstrip._scrollbox ?
				document.getAnonymousNodes(b.mTabContainer.mTabstrip._scrollbox)[0] :
				scrollFrame; // Tab Mix Plus
		var allTabsButton = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-alltabs-button') ||
				document.getAnonymousElementByAttribute(b.mTabContainer, 'anonid', 'alltabs-button'); // Tab Mix Plus

		this.tabbarResizing = false;
		b.removeAttribute(this.kRESIZING);

		if (pos & this.kTABBAR_VERTICAL) {
			this.positionProp         = 'screenY';
			this.sizeProp             = 'height';
			this.invertedPositionProp = 'screenX';
			this.invertedSizeProp     = 'width';

			b.mTabBox.orient = splitter.orient = 'horizontal';
			b.mStrip.orient =
				toggler.orient =
				b.mTabContainer.orient =
				b.mTabContainer.mTabstrip.orient =
				b.mTabContainer.mTabstrip.parentNode.orient = 'vertical';
			if (allTabsButton.parentNode.localName == 'hbox') { // Firefox 2
				allTabsButton.parentNode.orient = 'vertical';
				allTabsButton.parentNode.setAttribute('align', 'stretch');
			}
			if (allTabsButton.hasChildNodes()) {
				allTabsButton.firstChild.setAttribute('position', 'before_start');
			}
			b.mTabContainer.setAttribute('align', 'stretch'); // for Mac OS X
			scrollInnerBox.removeAttribute('flex');

			if (scrollFrame) { // Tab Mix Plus
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'vertical';
				newTabBox.orient = 'horizontal';
				if (tabBarMode == 2)
					this.setPref('extensions.tabmix.tabBarMode', 1);
			}

			if (toolboxContainer)
				toolboxContainer.orient = 'vertical';

			b.mStrip.removeAttribute('width');
			b.mStrip.setAttribute('width', this.getTreePref('tabbar.width'));

			b.setAttribute(this.kMODE, 'vertical');
			if (pos == this.kTABBAR_RIGHT) {
				b.setAttribute(this.kTABBAR_POSITION, 'right');
				if (this.getTreePref('tabbar.invertUI')) {
					b.setAttribute(this.kUI_INVERTED, 'true');
					this.levelMarginProp = 'margin-right';
				}
				else {
					b.removeAttribute(this.kUI_INVERTED);
					this.levelMarginProp = 'margin-left';
				}
				window.setTimeout(function(aWidth) {
					/* in Firefox 3, the width of the rightside tab bar
					   unexpectedly becomes 0 on the startup. so, we have
					   to set the width again. */
					b.mStrip.setAttribute('width', aWidth);
					b.mTabDropIndicatorBar.setAttribute('ordinal', 1);
					b.mStrip.setAttribute('ordinal', 30);
					splitter.setAttribute('ordinal', 20);
					toggler.setAttribute('ordinal', 40);
					b.mPanelContainer.setAttribute('ordinal', 10);
					splitter.setAttribute('collapse', 'after');
				}, 0, this.getTreePref('tabbar.width'));
			}
			else {
				b.setAttribute(this.kTABBAR_POSITION, 'left');
				b.removeAttribute(this.kUI_INVERTED);
				this.levelMarginProp = 'margin-left';
				window.setTimeout(function() {
					b.mTabDropIndicatorBar.setAttribute('ordinal', 1);
					b.mStrip.setAttribute('ordinal', 10);
					splitter.setAttribute('ordinal', 20);
					toggler.setAttribute('ordinal', 5);
					b.mPanelContainer.setAttribute('ordinal', 30);
					splitter.setAttribute('collapse', 'before');
				}, 0);
			}
		}
		else {
			this.positionProp         = 'screenX';
			this.sizeProp             = 'width';
			this.invertedPositionProp = 'screenY';
			this.invertedSizeProp     = 'height';

			b.mTabBox.orient = splitter.orient = 'vertical';
			b.mStrip.orient =
				toggler.orient =
				b.mTabContainer.orient =
				b.mTabContainer.mTabstrip.orient =
				b.mTabContainer.mTabstrip.parentNode.orient = 'horizontal';
			if (allTabsButton.parentNode.localName == 'hbox') { // Firefox 2
				allTabsButton.parentNode.orient = 'horizontal';
				allTabsButton.parentNode.removeAttribute('align');
			}
			if (allTabsButton.hasChildNodes()) {
				allTabsButton.firstChild.setAttribute('position', 'after_end');
			}
			b.mTabContainer.removeAttribute('align'); // for Mac OS X
			scrollInnerBox.setAttribute('flex', 1);

			if (scrollFrame) { // Tab Mix Plus
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'horizontal';
				newTabBox.orient = 'vertical';
			}

			if (toolboxContainer)
				toolboxContainer.orient = 'horizontal';

			b.mStrip.removeAttribute('width');
			b.mPanelContainer.removeAttribute('width');

			b.setAttribute(this.kMODE, this.getTreePref('tabbar.multirow') ? 'multirow' : 'horizontal' );
			b.removeAttribute(this.kUI_INVERTED);
			if (pos == this.kTABBAR_BOTTOM) {
				b.setAttribute(this.kTABBAR_POSITION, 'bottom');
				this.levelMarginProp = 'margin-bottom';
				window.setTimeout(function() {
					b.mTabDropIndicatorBar.setAttribute('ordinal', 1);
					b.mStrip.setAttribute('ordinal', 30);
					splitter.setAttribute('ordinal', 20);
					toggler.setAttribute('ordinal', 40);
					b.mPanelContainer.setAttribute('ordinal', 10);
				}, 0);
			}
			else {
				b.setAttribute(this.kTABBAR_POSITION, 'top');
				this.levelMarginProp = 'margin-top';
				window.setTimeout(function() {
					b.mTabDropIndicatorBar.setAttribute('ordinal', 1);
					b.mStrip.setAttribute('ordinal', 10);
					splitter.setAttribute('ordinal', 20);
					toggler.setAttribute('ordinal', 5);
					b.mPanelContainer.setAttribute('ordinal', 30);
				}, 0);
			}
		}

		// 何故かxbl:inheritsによる属性値の継承が効かなくなってしまっているらしい……
		var closebutton = document.getAnonymousElementByAttribute(b.mTabContainer, 'anonid', 'tabs-closebutton');
		if (closebutton &&
			!closebutton.hasAttribute('oncommand') &&
			b.mTabContainer.hasAttribute('onclosetab')) {
			closebutton.setAttribute('oncommand', b.mTabContainer.getAttribute('onclosetab'));
		}
	},
  
	destroy : function() 
	{
		this.endAutoHide();

		var b = this.mTabBrowser;

		var tabs = this.getTabs(b);
		for (var i = 0, maxi = tabs.snapshotLength; i < maxi; i++)
		{
			this.destroyTab(tabs.snapshotItem(i));
		}

		b.removeEventListener('TabOpen',        this, true);
		b.removeEventListener('TabClose',       this, true);
		b.removeEventListener('TabMove',        this, true);
		b.removeEventListener('SSTabRestoring', this, true);
		b.mStrip.removeEventListener('dragenter', this, false);
		b.mStrip.removeEventListener('dragexit', this, false);
		b.mStrip.removeEventListener('dragover', this, false);
		b.mStrip.removeEventListener('dragdrop', this, false);
		b.mTabContainer.removeEventListener('click', this, true);
		b.mTabContainer.removeEventListener('dblclick', this, true);
		b.mTabContainer.removeEventListener('mousedown', this, true);
		b.mTabContainer.removeEventListener('select', this, true);
		b.mTabContainer.removeEventListener('scroll', this, true);

		var inner = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabbrowser-arrowscrollbox');
		if (inner) {
			inner.removeEventListener('overflow', this, true);
			inner.removeEventListener('underflow', this, true);
		}

		var tabContext = document.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContext.removeEventListener('popupshowing', this, false);
		tabContext.removeEventListener('popuphiding', this, false);

		var allTabPopup = document.getAnonymousElementByAttribute(b.mTabContainer, 'anonid', 'alltabs-popup');
		if (allTabPopup) {
			allTabPopup.removeEventListener('popupshowing', this, false);
		}

		if (this.tabbarCanvas) {
			this.tabbarCanvas.parentNode.removeChild(this.tabbarCanvas);
			this.tabbarCanvas = null;
		}

		this.ObserverService.removeObserver(this, 'TreeStyleTab:levelMarginModified');
		this.ObserverService.removeObserver(this, 'TreeStyleTab:collapseExpandAllSubtree');
		this.removePrefListener(this);

		delete this.mTabBrowser;
		delete this._scrollBox;
	},
	
	destroyTab : function(aTab) 
	{
		delete aTab.__treestyletab__linkedTabBrowser;
	},
   
/* nsIObserver */ 
	
	domain : 'extensions.treestyletab', 
 
	observe : function(aSubject, aTopic, aData) 
	{
		var b = this.mTabBrowser;
		switch (aTopic)
		{
			case 'TreeStyleTab:levelMarginModified':
				if (this.levelMargin > -1) {
					this.updateAllTabsIndent();
				}
				break;

			case 'TreeStyleTab:collapseExpandAllSubtree':
				if (aSubject == window)
					this.collapseExpandAllSubtree(aData == 'collapse');
				break;

			case 'nsPref:changed':
				var value = this.getPref(aData);
				var tabContainer = b.mTabContainer;
				var tabs  = this.getTabsArray(b);
				switch (aData)
				{
					case 'extensions.treestyletab.tabbar.position':
//						if (value != 'left' && value != 'right') {
//							this.endAutoHide();
//						}
						if (this.autoHideEnabled && this.autoHideShown) this.hideTabbar();
						this.initTabbar();
						tabs.forEach(function(aTab) {
							this.initTabAttributes(aTab);
						}, this);
						this.updateAllTabsIndent();
						tabs.forEach(function(aTab) {
							this.initTabContents(aTab);
						}, this);
						if (this.autoHideEnabled) this.showTabbar();
						this.updateTabbarTransparency();
						break;

					case 'extensions.treestyletab.tabbar.invertUI':
					case 'extensions.treestyletab.tabbar.multirow':
						this.initTabbar();
						this.updateAllTabsIndent();
						tabs.forEach(function(aTab) {
							this.initTabContents(aTab);
						}, this);
						break;

					case 'extensions.treestyletab.enableSubtreeIndent':
						this.updateAllTabsIndent();
						break;

					case 'extensions.treestyletab.tabbar.style':
						if (value) {
							if (/^(default|vertigo|mixed)$/.test(value))
								value = 'square '+value;
							b.setAttribute(this.kSTYLE, value);
						}
						else {
							b.removeAttribute(this.kSTYLE);
						}
						break;

					case 'extensions.treestyletab.twisty.style':
						if (value == 'auto') {
							if (document.documentElement.getAttribute('informationaltab-thumbnail-enabled') == 'true') {
								value = 'retro';
							}
							else {
								value = 'modern-black';
							}
						}
						b.setAttribute(this.kTWISTY_STYLE, value);
						break;

					case 'extensions.treestyletab.showBorderForFirstTab':
						if (value)
							b.setAttribute(this.kFIRSTTAB_BORDER, true);
						else
							b.removeAttribute(this.kFIRSTTAB_BORDER);
						break;

					case 'extensions.treestyletab.tabbar.invertScrollbar':
						if (value &&
							b.getAttribute(this.kTABBAR_POSITION) == 'left' &&
							this.isGecko18)
							b.setAttribute(this.kSCROLLBAR_INVERTED, true);
						else
							b.removeAttribute(this.kSCROLLBAR_INVERTED);
						break;

					case 'extensions.treestyletab.tabbar.hideNewTabButton':
						var pos = b.getAttribute(this.kTABBAR_POSITION);
						if (value && (pos == 'left' || pos == 'right'))
							b.setAttribute(this.kHIDE_NEWTAB, true);
						else
							b.removeAttribute(this.kHIDE_NEWTAB);
						break;

					case 'extensions.treestyletab.tabbar.hideAlltabsButton':
						var pos = b.getAttribute(this.kTABBAR_POSITION);
						if (value && (pos == 'left' || pos == 'right'))
							b.setAttribute(this.kHIDE_ALLTABS, true);
						else
							b.removeAttribute(this.kHIDE_ALLTABS);
						break;

					case 'extensions.treestyletab.allowSubtreeCollapseExpand':
						if (value)
							b.setAttribute(this.kALLOW_COLLAPSE, true);
						else
							b.removeAttribute(this.kALLOW_COLLAPSE);
						break;

					case 'extensions.treestyletab.tabbar.autoHide.mode':
						this.endAutoHide();
						// update internal property after the appearance of the tab bar is updated.
						window.setTimeout(function(aSelf) {
							aSelf.autoHideMode = value;
							if (value != aSelf.kAUTOHIDE_MODE_DISABLED)
								aSelf.startAutoHide();
						}, 0, this);
						break;

					case 'extensions.treestyletab.tabbar.autoShow.mousemove':
					case 'extensions.treestyletab.tabbar.autoShow.accelKeyDown':
					case 'extensions.treestyletab.tabbar.autoShow.feedback':
						if (this.autoHideEnabled && this.shouldListenMouseMove)
							this.startListenMouseMove();
						else
							this.endListenMouseMove();
						break;

					case 'extensions.treestyletab.tabbar.fixed':
						if (value)
							b.setAttribute(this.kFIXED, true);
						else
							b.removeAttribute(this.kFIXED);
						break;

					case 'extensions.treestyletab.tabbar.transparent.style':
						this.updateTabbarTransparency();
						break;

					case 'extensions.treestyletab.tabbar.width':
					case 'extensions.treestyletab.tabbar.shrunkenWidth':
						this.checkTabsIndentOverflow();
						break;

					case 'extensions.treestyletab.tabbar.togglerSize':
						this.togglerSize = value;
						var toggler = document.getAnonymousElementByAttribute(b, 'class', this.kTABBAR_TOGGLER);
						toggler.style.minWidth = toggler.style.minHeight = value+'px';
						break;

					default:
						break;
				}
				break;

			default:
				break;
		}
	},
  
/* DOM Event Handling */ 
	
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'TabOpen':
				this.onTabAdded(aEvent);
				return;

			case 'TabClose':
				this.onTabRemoved(aEvent);
				if (this.isVertical) {
					var x = {}, y = {};
					var scrollBoxObject = this.scrollBoxObject;
					if (!scrollBoxObject) return;
					scrollBoxObject.getPosition(x, y);
					this.lastScrollX = x.value;
					this.lastScrollY = y.value;
//					var tab = aEvent.originalTarget;
//					var delta = tab.boxObject.height;
//					scrollBoxObject.scrollTo(x.value, y.value-delta);
				}
				return;

			case 'TabMove':
				this.onTabMove(aEvent);
				return;

			case 'SSTabRestoring':
				this.onTabRestored(aEvent);
				return;

			case 'select':
				this.onTabSelect(aEvent);
				return;

			case 'click':
				if (aEvent.target.ownerDocument == document) {
					this.onTabClick(aEvent);
					return;
				}
				return;

			case 'dblclick':
				var tab = this.getTabFromEvent(aEvent);
				if (tab &&
					this.hasChildTabs(tab) &&
					this.getTreePref('collapseExpandSubTree.dblclick')) {
					this.collapseExpandSubtree(tab, tab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');
					aEvent.preventDefault();
					aEvent.stopPropagation();
				}
				return;

			case 'mousedown':
				if (aEvent.currentTarget == this.mTabBrowser.mTabContainer) {
					this.onTabMouseDown(aEvent);
					return;
				}
				if (
					!this.tabbarResizing &&
					aEvent.originalTarget &&
					(
						aEvent.originalTarget.getAttribute('class') == this.kSPLITTER ||
						aEvent.originalTarget.parentNode.getAttribute('class') == this.kSPLITTER
					)
					) {
					this.tabbarResizing = true;
					this.clearTabbarCanvas();
					this.mTabBrowser.setAttribute(this.kRESIZING, true);
					if (this.isGecko19) {
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
						}, 0, aEvent.clientX, aEvent.clientY, aEvent.button, aEvent.detail);
					}
				}
				this.cancelShowHideTabbarOnMousemove();
				if (
					this.autoHideEnabled &&
					this.autoHideShown &&
					(
						aEvent.originalTarget.ownerDocument != document ||
						!this.getTabBrowserFromChild(aEvent.originalTarget)
					)
					)
					this.hideTabbar();
				this.lastMouseDownTarget = aEvent.originalTarget.localName;
				return;

			case 'mouseup':
				if (aEvent.originalTarget &&
					aEvent.originalTarget.getAttribute('class') == this.kSPLITTER ||
					aEvent.originalTarget.parentNode.getAttribute('class') == this.kSPLITTER) {
					this.tabbarResizing = false;
					this.mTabBrowser.removeAttribute(this.kRESIZING);
					if (this.autoHideShown) this.redrawContentArea();
				}
				this.cancelShowHideTabbarOnMousemove();
				this.lastMouseDownTarget = null;
				return;

			case 'mousemove':
				if (!this.tabbarResizing) {
					if (
						!this.tabContextMenuShown &&
						(
							!this.autoHideShown ||
							this.showHideTabbarReason & this.kKEEP_SHOWN_ON_MOUSEOVER
						)
						)
						this.showHideTabbarOnMousemove(aEvent);
					return;
				}
				if (/^(scrollbar|thumb|slider|scrollbarbutton)$/i.test(this.lastMouseDownTarget))
					return;
			case 'resize':
				if (
					!aEvent.originalTarget ||
					aEvent.originalTarget.ownerDocument != document ||
					!this.autoHideShown
					) {
					return;
				}
				switch (this.mTabBrowser.getAttribute(this.kTABBAR_POSITION))
				{
					case 'left':
						this.container.style.marginRight = '-'+this.autoHideXOffset+'px';
						break;
					case 'right':
						this.container.style.marginLeft = '-'+this.autoHideXOffset+'px';
						break;
					case 'bottom':
						this.container.style.marginTop = '-'+this.autoHideYOffset+'px';
						break;
					default:
						this.container.style.marginBottom = '-'+this.autoHideYOffset+'px';
						break;
				}
				this.redrawContentArea();
				return;

			case 'scroll':
				var node = aEvent.originalTarget;
				if (node && node.ownerDocument == document) {
					if (this.lastScrollX < 0 || this.lastScrollY < 0) return;
					var x = {}, y = {};
					var scrollBoxObject = this.scrollBoxObject;
					scrollBoxObject.getPosition(x, y);
					if (x.value != this.lastScrollX || y.value != this.lastScrollY)
						scrollBoxObject.scrollTo(this.lastScrollX, this.lastScrollY);
					this.lastScrollX = -1;
					this.lastScrollY = -1;
				}
				else if (this.autoHideEnabled) {
					this.redrawContentArea();
				}
				return;

			case 'load':
				if (aEvent.originalTarget instanceof Components.interfaces.nsIDOMWindow)
					this.redrawContentArea();
				return;

			case 'popupshowing':
				this.onPopupShowing(aEvent);
				return;

			case 'popuphiding':
				this.onPopupHiding(aEvent);
				return;

			case 'dragenter':
				nsDragAndDrop.dragEnter(aEvent, this);
				return;

			case 'dragexit':
				nsDragAndDrop.dragExit(aEvent, this);
				return;

			case 'dragover':
				nsDragAndDrop.dragOver(aEvent, this);
				return;

			case 'dragdrop':
				nsDragAndDrop.drop(aEvent, this);
				return;

			case 'mouseover':
				if (this.isEventFiredOnTwisty(aEvent)) {
					aEvent.target.setAttribute(this.kTWISTY_HOVER, true);
				}
				return;

			case 'mouseout':
				if (this.isEventFiredOnTwisty(aEvent)) {
					aEvent.target.removeAttribute(this.kTWISTY_HOVER);
				}
				return;

			case 'overflow':
			case 'underflow':
				this.onTabbarOverflow(aEvent);
				return;
		}
	},
	lastScrollX : -1,
	lastScrollY : -1,
 
	onTabAdded : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.mTabBrowser;

		this.initTab(tab);

		if (this.readyToAttachNewTab) {
			var parent = this.getTabById(this.parentTab);
			if (parent)
				this.attachTabTo(tab, parent);

			var refTab;
			var newIndex = -1;
			if (this.insertBefore &&
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
				this.internallyTabMoving = true;
				b.moveTabTo(tab, newIndex);
				this.internallyTabMoving = false;
			}
		}

		if (!this.readyToAttachMultiple) {
			this.stopToOpenChildTab(b);
		}
		else {
			this.multipleCount++;
		}

		this.showTabbarForFeedback();
	},
 
	onTabRemoved : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.mTabBrowser;

		this.destroyTab(tab);

		if (tab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') {
			var descendant = this.getDescendantTabs(tab);
			for (var i = descendant.length-1; i > -1; i--)
			{
				b.removeTab(descendant[i]);
			}

			if (this.getTabs(b).snapshotLength == 1) { // this is the last tab
				b.addTab('about:blank');
			}
		}

		var firstChild     = this.getFirstChildTab(tab);
		var parentTab      = this.getParentTab(tab);
		var nextFocusedTab = null;

		var next = this.getNextSiblingTab(tab);
		if (next)
			this.setTabValue(tab, this.kINSERT_BEFORE, next.getAttribute(this.kID));

		if (firstChild) {
			var backupChildren = this.getTabValue(tab, this.kCHILDREN);
			var children   = this.getChildTabs(tab);
			var self       = this;
			var attach     = this.getTreePref('attachChildrenToGrandParentOnRemoveTab');
			var processTab = !attach ? function(aTab) {
					self.partTab(aTab, true);
					self.moveTabSubTreeTo(aTab, self.getLastTab(b)._tPos);
				} :
				parentTab ? function(aTab) {
					self.attachTabTo(aTab, parentTab, {
						insertBefore : tab,
						dontUpdateIndent : true,
						dontExpand : true
					});
				} :
				function(aTab) {
					self.partTab(aTab, true);
				};
			for (var i = 0, maxi = children.length; i < maxi; i++)
			{
				processTab(children[i]);
			}
			this.updateTabsIndent(children);
			this.checkTabsIndentOverflow();
			if (attach) {
				nextFocusedTab = firstChild;
			}
			this.setTabValue(tab, this.kCHILDREN, backupChildren);
		}

		if (parentTab) {
			var firstSibling = this.getFirstChildTab(parentTab);
			var lastSibling  = this.getLastChildTab(parentTab);
			if (tab == lastSibling && !nextFocusedTab) {
				if (tab == firstSibling) { // there is only one child
					nextFocusedTab = parentTab;
				}
				else { // previous sibling tab
					nextFocusedTab = this.getPreviousSiblingTab(tab);
				}
			}

			var ancestors = [];
			do {
				ancestors.push(parentTab.getAttribute(this.kID));
				if (!next && (next = this.getNextSiblingTab(parentTab)))
					this.setTabValue(tab, this.kINSERT_BEFORE, next.getAttribute(this.kID));
			}
			while (parentTab = this.getParentTab(parentTab));
			this.setTabValue(tab, this.kANCESTOR, ancestors.join('|'));

			this.partTab(tab, true);
		}
		else if (!nextFocusedTab) {
			nextFocusedTab = this.getNextSiblingTab(tab);
		}

		if (
			nextFocusedTab &&
			b.selectedTab == tab &&
			this._tabFocusAllowance.every(function(aFunc) {
				return aFunc(b);
			})
			)
			b.selectedTab = nextFocusedTab;

		this.checkTabsIndentOverflow();

		this.showTabbarForFeedback();
	},
 
	onTabMove : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.mTabBrowser;
		this.initTabContents(tab); // twisty vanished after the tab is moved!!

//		var rebuildTreeDone = false;

		if (this.hasChildTabs(tab) && !this.isSubTreeMoving) {
			this.moveTabSubTreeTo(tab, tab._tPos);
//			rebuildTreeDone = true;
		}

		var parentTab = this.getParentTab(tab);
		if (parentTab && !this.isSubTreeChildrenMoving) {
			this.updateChildrenArray(parentTab);
		}

		this.updateTabsCount(tab, true);

		if (
//			rebuildTreeDone ||
			this.isSubTreeMoving ||
			this.internallyTabMoving
			)
			return;

		this.attachTabFromPosition(tab, aEvent.detail);

		this.showTabbarForFeedback();
	},
	
	attachTabFromPosition : function(aTab, aOldPosition) 
	{
		var parent = this.getParentTab(aTab);

		if (aOldPosition === void(0)) aOldPosition = aTab._tPos;

		var pos = this.getChildIndex(aTab, parent);
		var oldPos = this.getChildIndex(this.getTabs(this.mTabBrowser).snapshotItem(aOldPosition), parent);
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

		if (!prevTab) {
			newParent = null;
		}
		else if (!nextTab) {
			newParent = (delta > 1) ? prevParent : parent ;
		}
		else if (prevParent == nextParent) {
			newParent = prevParent;
		}
		else if (prevLevel > nextLevel) {
			var realDelta = Math.abs(aTab._tPos - aOldPosition);
			newParent = realDelta < 2 ? prevParent : parent ;
		}
		else if (prevLevel < nextLevel) {
			newParent = this.getParentTab(aTab);
		}

		if (newParent != parent) {
			if (newParent)
				this.attachTabTo(aTab, newParent, { insertBefore : nextTab });
			else
				this.partTab(aTab);
		}
	},
 
	updateChildrenArray : function(aTab) 
	{
		var children = this.getChildTabs(aTab);
		children.sort(function(aA, aB) { return aA._tPos - aB._tPos; });
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
  
	onTabRestored : function(aEvent) 
	{
		this.restoreStructure(aEvent.originalTarget);
	},
	restoreStructure : function(aTab)
	{
		var tab = aTab;
		var b   = this.mTabBrowser;

		var maybeDuplicated = false;

		var id = this.getTabValue(tab, this.kID);

		if (this.getTabById(id)) { // this is a duplicated tab!
			maybeDuplicated = true;
			id = this.redirectId(id);
		}

		if (!maybeDuplicated) {
			/* If it has a parent, it is wrongly attacched by tab moving
			   on restoring. Restoring the old ID (the next statement)
			   breaks the children list of the temporary parent and causes
			   many problems. So, to prevent these problems, I part the tab
			   from the temporary parent manually. */
			this.partTab(tab);
			/* reset attributes before restoring */
			tab.removeAttribute(this.kID);
			tab.removeAttribute(this.kPARENT);
			tab.removeAttribute(this.kCHILDREN);
			tab.removeAttribute(this.kSUBTREE_COLLAPSED);
			tab.removeAttribute(this.kCOLLAPSED);
			tab.removeAttribute(this.kNEST);
			this.updateTabsIndent([tab]);
		}

		this.setTabValue(tab, this.kID, id);

		var isSubTreeCollapsed = (this.getTabValue(tab, this.kSUBTREE_COLLAPSED) == 'true');

		var children = this.getTabValue(tab, this.kCHILDREN);
		var tabs = [];
		if (children) {
			tab.removeAttribute(this.kCHILDREN);
			children = children.split('|');
			if (maybeDuplicated)
				children = children.map(function(aChild) {
					return this.redirectId(aChild);
				}, this);
			for (var i = 0, maxi = children.length; i < maxi; i++)
			{
				if (children[i] && (children[i] = this.getTabById(children[i]))) {
					this.attachTabTo(children[i], tab, { dontExpand : true, dontUpdateIndent : true });
					tabs.push(children[i]);
				}
			}
		}

		var nextTab = this.getTabValue(tab, this.kINSERT_BEFORE);
		if (nextTab && maybeDuplicated) {
			nextTab = this.redirectId(nextTab);
		}

		var ancestors = (this.getTabValue(tab, this.kANCESTOR) || this.getTabValue(tab, this.kPARENT)).split('|');
		var parent = null;
		for (var i in ancestors)
		{
			if (maybeDuplicated) ancestors[i] = this.redirectId(ancestors[i]);
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
					dontExpand : true,
					insertBefore : (nextTab ? this.getTabById(nextTab) : null ),
					dontUpdateIndent : true
				});
				this.updateTabsIndent([tab]);
				this.checkTabsIndentOverflow();
			}
			else {
				this.deleteTabValue(tab, this.kPARENT);
			}
		}
		else if (children) {
			this.updateTabsIndent(tabs);
			this.checkTabsIndentOverflow();
		}

		if (!parent) {
			nextTab = this.getTabById(nextTab);
			if (!nextTab) nextTab = this.getNextTab(tab);
			var parentOfNext = this.getParentTab(nextTab);
			var newPos = -1;
			if (parentOfNext) {
				var descendants = this.getDescendantTabs(parentOfNext);
				newPos = descendants[descendants.length-1]._tPos;
			}
			else if (nextTab) {
				var newPos = nextTab._tPos;
				if (newPos > tab._tPos) newPos--;
			}
			if (newPos > -1)
				b.moveTabTo(tab, newPos);
		}
		this.deleteTabValue(tab, this.kINSERT_BEFORE);

		if (isSubTreeCollapsed) {
			this.collapseExpandSubtree(tab, isSubTreeCollapsed);
		}

		if (maybeDuplicated) this.clearRedirectionTable();
	},
	
	redirectId : function(aId) 
	{
		if (!(aId in this._redirectionTable))
			this._redirectionTable[aId] = this.makeNewId();
		return this._redirectionTable[aId];
	},
	_redirectionTable : {},
 
	clearRedirectionTable : function() 
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
  
	onTabSelect : function(aEvent) 
	{
		var b   = this.mTabBrowser;
		var tab = b.selectedTab

		if (tab.getAttribute(this.kCOLLAPSED) == 'true') {
			var parentTab = tab;
			while (parentTab = this.getParentTab(parentTab))
			{
				this.collapseExpandSubtree(parentTab, false);
			}
		}
		else if (this.hasChildTabs(tab) &&
				(tab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') &&
				this.getTreePref('autoCollapseExpandSubTreeOnSelect')) {
			this.collapseExpandTreesIntelligentlyFor(tab);
		}

		if (this.autoHideEnabled && this.autoHideShown)
			this.redrawContentArea();

		this.updateInvertedTabContentsOrder();

		if (!this.accelKeyPressed)
			this.showTabbarForFeedback();
	},
 
	onTabClick : function(aEvent) 
	{
		if (aEvent.button != 0) return;

		if (this.isEventFiredOnTwisty(aEvent)) {
			var tab = this.getTabFromEvent(aEvent);
			this.collapseExpandSubtree(tab, tab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');
		}
		else if (!this.getTabFromEvent(aEvent)) {
			var tab = this.getTabFromTabbarEvent(aEvent);
			if (tab) this.mTabBrowser.selectedTab = tab;
		}
		else {
			return;
		}

		aEvent.preventDefault();
		aEvent.stopPropagation();
	},
	getTabFromTabbarEvent : function(aEvent)
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
 
	onTabMouseDown : function(aEvent) 
	{
		if (aEvent.button != 0 ||
			!this.isEventFiredOnTwisty(aEvent))
			return;

		this.getTabFromEvent(aEvent).__treestyletab__preventSelect = true;
	},
 
	onTabbarOverflow : function(aEvent) 
	{
		var box = aEvent.currentTarget;
		var tabs = this.mTabBrowser.mTabContainer;
		var horizontal = tabs.orient == 'horizontal';
		if (horizontal) return;
		aEvent.stopPropagation();
		if (aEvent.detail == 1) return;
		if (aEvent.type == 'overflow') {
			tabs.setAttribute('overflow', 'true');
			box.scrollBoxObject.ensureElementIsVisible(tabs.selectedItem);
		}
		else {
			tabs.removeAttribute('overflow');
		}
	},
 
	onPopupShowing : function(aEvent) 
	{
		if (aEvent.target != aEvent.currentTarget) return;
		switch (aEvent.target.getAttribute('anonid'))
		{
			case 'tabContextMenu':
				this.tabContextMenuShown = true;
				this.initTabContextMenu(aEvent);
				break;
			case 'alltabs-popup':
				this.initAllTabsPopup(aEvent);
				break;
		}
	},
	
	initTabContextMenu : function(aEvent) 
	{
		var b = this.mTabBrowser;
		var item, sep;

		// remove subtree
		item = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_REMOVESUBTREE+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (this.getTreePref('show.'+this.kMENUITEM_REMOVESUBTREE))
			item.removeAttribute('hidden');
		else
			item.setAttribute('hidden', true);
		this.showHideSubTreeMenuItem(item, [b.mContextTab]);

		item = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_REMOVECHILDREN+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (this.getTreePref('show.'+this.kMENUITEM_REMOVECHILDREN))
			item.removeAttribute('hidden');
		else
			item.setAttribute('hidden', true);
		this.showHideSubTreeMenuItem(item, [b.mContextTab]);

		// collapse/expand all
		sep = this.evaluateXPath(
			'descendant::xul:menuseparator[starts-with(@id, "'+this.kMENUITEM_COLLAPSEEXPAND_SEPARATOR+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		var collapseItem = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_COLLAPSE+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		var expanndItem = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_EXPAND+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (this.evaluateXPath(
				'child::xul:tab[@'+this.kCHILDREN+']',
				b.mTabContainer
			).snapshotLength) {
			if (this.getTreePref('show.'+this.kMENUITEM_COLLAPSE)) {
				collapseItem.removeAttribute('hidden');
				if (this.evaluateXPath(
						'child::xul:tab[@'+this.kCHILDREN+' and not(@'+this.kSUBTREE_COLLAPSED+'="true")]',
						b.mTabContainer
					).snapshotLength) {
					collapseItem.removeAttribute('disabled');
				}
				else {
					collapseItem.setAttribute('disabled', true);
				}
			}
			else {
				collapseItem.setAttribute('hidden', true);
			}

			if (this.getTreePref('show.'+this.kMENUITEM_EXPAND)) {
				expanndItem.removeAttribute('hidden');
				if (this.evaluateXPath(
						'child::xul:tab[@'+this.kCHILDREN+' and @'+this.kSUBTREE_COLLAPSED+'="true"]',
						b.mTabContainer
					).snapshotLength) {
					expanndItem.removeAttribute('disabled');
				}
				else {
					expanndItem.setAttribute('disabled', true);
				}
			}
			else {
				expanndItem.setAttribute('hidden', true);
			}
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
		var autohide = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_AUTOHIDE+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		var pos = b.getAttribute(this.kTABBAR_POSITION);
		if (this.getTreePref('show.'+this.kMENUITEM_AUTOHIDE)/* &&
			(pos == 'left' || pos == 'right')*/) {
			autohide.removeAttribute('hidden');
			if (this.autoHideMode != this.kAUTOHIDE_MODE_DISABLED)
				autohide.setAttribute('checked', true);
			else
				autohide.removeAttribute('checked');
		}
		else {
			autohide.setAttribute('hidden', true);
		}

		// fix
		var fixed = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_FIXED+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (this.getTreePref('show.'+this.kMENUITEM_FIXED) &&
			(pos == 'left' || pos == 'right')) {
			fixed.removeAttribute('hidden');
			if (this.getTreePref('tabbar.fixed'))
				fixed.setAttribute('checked', true);
			else
				fixed.removeAttribute('checked');
		}
		else {
			fixed.setAttribute('hidden', true);
		}

		// position
		var position = this.evaluateXPath(
			'descendant::xul:menu[starts-with(@id, "'+this.kMENUITEM_POSITION+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (this.getTreePref('show.'+this.kMENUITEM_POSITION)) {
			position.removeAttribute('hidden');
			position.getElementsByAttribute('value', pos)[0].setAttribute('checked', true);
		}
		else {
			position.setAttribute('hidden', true);
		}

		sep = this.evaluateXPath(
			'descendant::xul:menuseparator[starts-with(@id, "'+this.kMENUITEM_AUTOHIDE_SEPARATOR+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (autohide.getAttribute('hidden') != 'true' ||
			fixed.getAttribute('hidden') != 'true' ||
			position.getAttribute('hidden') != 'true') {
			sep.removeAttribute('hidden');
		}
		else {
			sep.setAttribute('hidden', true);
		}

		// bookmark
		item = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_BOOKMARKSUBTREE+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (this.getTreePref('show.'+this.kMENUITEM_BOOKMARKSUBTREE))
			item.removeAttribute('hidden');
		else
			item.setAttribute('hidden', true);
		this.showHideSubTreeMenuItem(item, [b.mContextTab]);
	},
 
	initAllTabsPopup : function(aEvent) 
	{
		if (!this.getTreePref('enableSubtreeIndent.allTabsPopup')) return;
		var items = aEvent.target.childNodes;
		var tabs = this.getTabs(this.mTabBrowser);
		for (var i = 0, maxi = items.length; i < maxi; i++)
		{
			items[i].style.paddingLeft = tabs.snapshotItem(i).getAttribute(this.kNEST)+'em';
		}
	},
  
	onPopupHiding : function(aEvent) 
	{
		if (aEvent.target != aEvent.currentTarget) return;
		switch (aEvent.target.getAttribute('anonid'))
		{
			case 'tabContextMenu':
				this.tabContextMenuShown = false;
				break;
		}
	},
  
/* drag and drop */ 
	isPlatformNotSupported : /* !this.isGecko19 && */ navigator.platform.indexOf('Mac') != -1, // see bug 136524
	isTimerSupported       : /* this.isGecko19 || */ navigator.platform.indexOf('Win') == -1, // see bug 232795.

	autoExpandTimer  : null,
	autoExpandTarget : null,
	autoExpandedTabs : [],
	
	onDragEnter : function(aEvent, aDragSession) 
	{
		var tab = aEvent.target;
		if (tab.localName != 'tab' ||
			!this.getTreePref('autoExpand.enabled'))
			return;

		var now = (new Date()).getTime();

		if (this.isPlatformNotSupported) return;
		if (this.isTimerSupported || !aDragSession.sourceNode) {
			window.clearTimeout(this.autoExpandTimer);
			if (aEvent.target == aDragSession.sourceNode) return;
			this.autoExpandTimer = window.setTimeout(
				function(aSelf, aTarget) {
					var tab = aSelf.getTabById(aTarget);
					if (tab &&
						tab.getAttribute(aSelf.kSUBTREE_COLLAPSED) == 'true' &&
						tab.getAttribute(aSelf.kDROP_POSITION) == 'self') {
						if (aSelf.getTreePref('autoExpand.intelligently')) {
							aSelf.collapseExpandTreesIntelligentlyFor(tab);
						}
						else {
							aSelf.autoExpandedTabs.push(aTarget);
							aSelf.collapseExpandSubtree(tab, false);
						}
					}
				},
				this.getTreePref('autoExpand.delay'),
				this,
				tab.getAttribute(this.kID)
			);
		}
		else {
			this.autoExpandTimer  = now;
			this.autoExpandTarget = tab.getAttribute(this.kID);
		}
	},
 
	onDragExit : function(aEvent, aDragSession) 
	{
		var now = (new Date()).getTime();

		if (this.isPlatformNotSupported) return;
		if (this.isTimerSupported || !aDragSession.sourceNode) {
			window.clearTimeout(this.autoExpandTimer);
			this.autoExpandTimer = null;
		}
		else {
			this.autoExpandTimer  = null;
			this.autoExpandTarget = null;
		}
	},
 
	onDragOver : function(aEvent, aFlavour, aDragSession) 
	{
		if (this.isPlatformNotSupported) return;
		if (this.isTimerSupported || !aDragSession.sourceNode) return;

		var now   = (new Date()).getTime();
		var delay = this.getTreePref('autoExpand.delay');
		if (this.autoExpandTimer && (now - delay > this.autoExpandTimer)) {
			var tab = this.getTabById(this.autoExpandTarget);
			if (tab &&
				tab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true' &&
				tab.getAttribute(this.kDROP_POSITION) == 'self') {
				if (this.getTreePref('autoExpand.intelligently')) {
					this.collapseExpandTreesIntelligentlyFor(tab);
				}
				else {
					this.autoExpandedTabs.push(this.autoExpandTarget);
					this.collapseExpandSubtree(tab, false);
				}
			}
			this.autoExpandTimer  = null;
			this.autoExpandTarget = null;
		}
	},
 
	onDrop : function(aEvent, aXferData, aDragSession) 
	{
		if (!this.autoExpandedTabs.length) return;
		if (this.getTreePref('autoExpand.collapseFinally')) {
			this.autoExpandedTabs.forEach(function(aTarget) {
				this.collapseExpandSubtree(this.getTabById(aTarget), true);
			}, this);
		}
		this.autoExpandedTabs = [];
	},
 
	canDrop : function(aEvent, aDragSession) 
	{
		var tooltip = this.mTabBrowser.mStrip.firstChild;
		if (tooltip &&
			tooltip.localName == 'tooltip' &&
			tooltip.popupBoxObject.popupState != 'closed')
			tooltip.hidePopup();

		var dropAction = this.getDropAction(aEvent, aDragSession);
		if ('dataTransfer' in aEvent) {
			var dt = aEvent.dataTransfer;
			if (dropAction.action & this.kACTION_NEWTAB) {
				dt.effectAllowed = dt.dropEffect = (
					!dropAction.source ? 'link' :
					this.isAccelKeyPressed(aEvent) ? 'copy' :
					'move'
				);
			}
		}
		return dropAction.canDrop;
	},
 
	getSupportedFlavours : function() 
	{
		var flavourSet = new FlavourSet();
		flavourSet.appendFlavour('application/x-moz-tabbrowser-tab');
		flavourSet.appendFlavour('text/x-moz-url');
		flavourSet.appendFlavour('text/unicode');
		flavourSet.appendFlavour('text/plain');
		flavourSet.appendFlavour('application/x-moz-file', 'nsIFile');
		return flavourSet;
	},
 
	getCurrentDragSession : function() 
	{
		return Components
				.classes['@mozilla.org/widget/dragservice;1']
				.getService(Components.interfaces.nsIDragService)
				.getCurrentSession();
	},
 
	getDropAction : function(aEvent, aDragSession) 
	{
		if (!aDragSession)
			aDragSession = this.getCurrentDragSession();

		var tab = aDragSession ? this.getTabFromChild(aDragSession.sourceNode) : null ;
		this.ensureTabInitialized(tab);

		var info = this.getDropActionInternal(aEvent, tab);
		info.canDrop = true;
		info.source = tab;
		if (tab) {
			var isCopy = this.isAccelKeyPressed(aEvent);
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
	
	getDropActionInternal : function(aEvent, aSourceTab) 
	{
		var tab        = aEvent.target;
		var b          = this.mTabBrowser;
		var tabs       = this.getTabsArray(b);
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
			if (aEvent[this.positionProp] < tabs[0].boxObject[this.positionProp]) {
				info.target   = info.parent = info.insertBefore = tabs[0];
				info.position = isInverted ? this.kDROP_AFTER : this.kDROP_BEFORE ;
				info.action   = action;
				return info;
			}
			else if (aEvent[this.positionProp] > tabs[tabs.length-1].boxObject[this.positionProp] + tabs[tabs.length-1].boxObject[this.sizeProp]) {
				info.target   = info.parent = tabs[tabs.length-1];
				info.position = isInverted ? this.kDROP_BEFORE : this.kDROP_AFTER ;
				info.action   = action;
				return info;
			}
			else {
				info.target = tabs[Math.min(b.getNewIndex(aEvent), tabs.length - 1)];
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
					info.insertBefore = tabs[0];
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
  
	performDrop : function(aInfo, aDraggedTab) 
	{
		var tabsInfo = this.getDraggedTabsInfoFromOneTab(aInfo, aDraggedTab);
		aDraggedTab = tabsInfo.draggedTab;
		var draggedTabs = tabsInfo.draggedTabs;
		var draggedRoots = tabsInfo.draggedRoots;

		var targetBrowser = this.mTabBrowser;
		var tabs = this.getTabsArray(targetBrowser);

		var sourceWindow = aDraggedTab.ownerDocument.defaultView;
		var sourceBrowser = this.getTabBrowserFromChild(aDraggedTab);

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
				this.getTabs(sourceBrowser).snapshotLength == draggedTabs.length
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
			}

			var newIndex = aInfo.insertBefore ? aInfo.insertBefore._tPos : tabs.length - 1 ;
			if (aInfo.insertBefore && newIndex > tab._tPos) newIndex--;

			this.internallyTabMoving = true;
			targetBrowser.moveTabTo(tab, newIndex);
			this.collapseExpandTab(tab, false);
			this.internallyTabMoving = false;

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

		if (aInfo.action & this.kACTIONS_FOR_DESTINATION &&
			aInfo.action & this.kACTION_ATTACH)
			this.attachTabsOnDrop(newRoots, aInfo.parent);

		// Multiple Tab Handler
		targetBrowser.movingSelectedTabs = false;
		targetBrowser.duplicatingSelectedTabs = false;

		return true;
	},
	
	getDraggedTabsInfoFromOneTab : function(aInfo, aTab) 
	{
		aTab = this.getTabFromChild(aTab);

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
 
	attachTabsOnDrop : function(aTabs, aParent) 
	{
		this.mTabBrowser.movingSelectedTabs = true; // Multiple Tab Handler
		aTabs.forEach(function(aTab) {
			if (aParent)
				this.attachTabTo(aTab, aParent);
			else
				this.partTab(aTab);
			this.collapseExpandTab(aTab, false);
		}, this);
		this.mTabBrowser.movingSelectedTabs = false; // Multiple Tab Handler
	},
 
	partTabsOnDrop : function(aTabs) 
	{
		this.mTabBrowser.movingSelectedTabs = true; // Multiple Tab Handler
		aTabs.forEach(function(aTab) {
			this.partTab(aTab);
			this.collapseExpandTab(aTab, false);
		}, this);
		this.mTabBrowser.movingSelectedTabs = false; // Multiple Tab Handler
	},
 
	closeOwner : function(aTabOwner) 
	{
		var w = aTabOwner.ownerDocument.defaultView;
		if (!w) return;
		if ('SplitBrowser' in w &&
			'getSubBrowserFromChild' in w.SplitBrowser) {
			var subbrowser = w.SplitBrowser.getSubBrowserFromChild(aTabOwner);
			if (subbrowser) {
				subbrowser.close();
				return;
			}
		}
		w.close();
	},
  
	clearDropPosition : function() 
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
 
	isDraggingAllTabs : function(aTab) 
	{
		var actionInfo = {
				action : this.kACTIONS_FOR_DESTINATION | this.kACTION_IMPORT
			};
		var tabsInfo = this.getDraggedTabsInfoFromOneTab(actionInfo, aTab);
		return tabsInfo.draggedTabs.length == this.getTabs(this.mTabBrowser).snapshotLength;
	},
  
/* commands */ 
	
/* attach/part */ 
	
	attachTabTo : function(aChild, aParent, aInfo) 
	{
		if (
			!aChild ||
			!aParent ||
			aChild == aParent ||
			this.getParentTab(aChild) == aParent
			) {
			this.attachTabPostProcess(aChild, aParent);
			return;
		}

		this.ensureTabInitialized(aChild);
		this.ensureTabInitialized(aParent);

		if (!aInfo) aInfo = {};

		var id = aChild.getAttribute(this.kID);

		this.partTab(aChild, true);

		var children = aParent.getAttribute(this.kCHILDREN);
		var newIndex;

		if (children.indexOf(id) > -1) {
			children = ('|'+children).replace('|'+id, '').replace(/^\|/);
		}

		var insertBefore = aInfo.insertBefore;
		var beforeTab = insertBefore ? insertBefore.getAttribute(this.kID) : null ;
		if (beforeTab && children.indexOf(beforeTab) > -1) {
			children = children.replace(beforeTab, id+'|'+beforeTab);
			newIndex = insertBefore._tPos;
		}
		else {
			children = ((children || '')+'|'+id).replace(/^\|/, '');
			var refTab = aParent;
			var descendant = this.getDescendantTabs(aParent);
			if (descendant.length) refTab = descendant[descendant.length-1];
			newIndex = refTab._tPos+1;
		}

		this.setTabValue(aParent, this.kCHILDREN, children);
		this.setTabValue(aChild, this.kPARENT, aParent.getAttribute(this.kID));
		this.updateTabsCount(aParent);

		if (newIndex > aChild._tPos) newIndex--;
		this.moveTabSubTreeTo(aChild, newIndex);

		if (!aInfo.dontExpand) {
			if (
/*
				(
					aParent.getAttribute(this.kSUBTREE_COLLAPSED) == 'true' ||
					children.indexOf('|') > -1 // not a first child
				) &&
*/
				this.getTreePref('autoCollapseExpandSubTreeOnSelect')
				) {
				this.collapseExpandTreesIntelligentlyFor(aParent);
				var p = aParent;
				do {
					this.collapseExpandSubtree(p, false);
				}
				while (p = this.getParentTab(p));
			}
			else if (aParent.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') {
				if (this.getTreePref('autoExpandSubTreeOnAppendChild')) {
					var p = aParent;
					do {
						this.collapseExpandSubtree(p, false);
					}
					while (p = this.getParentTab(p));
				}
				else
					this.collapseExpandTab(aChild, true);
			}

			if (aParent.getAttribute(this.kCOLLAPSED) == 'true')
				this.collapseExpandTab(aChild, true);
		}
		else if (aParent.getAttribute(this.kSUBTREE_COLLAPSED) == 'true' ||
				aParent.getAttribute(this.kCOLLAPSED) == 'true') {
			this.collapseExpandTab(aChild, true);
		}

		if (!aInfo.dontUpdateIndent) {
			this.updateTabsIndent([aChild]);
			this.checkTabsIndentOverflow();
		}

		this.attachTabPostProcess(aChild, aParent);
	},
	attachTabPostProcess : function(aChild, aParent)
	{
		this._attachTabPostProcesses.forEach(function(aProcess) {
			aProcess(aChild, aParent, this);
		}, this);
	},
 
	partTab : function(aChild, aDontUpdateIndent) 
	{
		if (!aChild) return;

		var parentTab = this.getParentTab(aChild);
		if (!parentTab) return;

		var id = aChild.getAttribute(this.kID);
		var children = ('|'+parentTab.getAttribute(this.kCHILDREN))
						.replace(new RegExp('\\|'+id), '')
						.replace(/^\|/, '');
		this.setTabValue(parentTab, this.kCHILDREN, children);
		this.deleteTabValue(aChild, this.kPARENT);
		this.updateTabsCount(parentTab);

		if (!aDontUpdateIndent) {
			this.updateTabsIndent([aChild]);
			this.checkTabsIndentOverflow();
		}

		this.attachTabPostProcess(aChild, null);
	},
 
	updateTabsIndent : function(aTabs, aLevel, aProp) 
	{
		if (!aTabs || !aTabs.length) return;

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
		if (!aProp) {
			aProp = this.getTreePref('enableSubtreeIndent') ? this.levelMarginProp : 0 ;
		}
		var margin = this.levelMargin < 0 ? this.baseLebelMargin : this.levelMargin ;
		var indent = margin * aLevel;

		var multirow = this.isMultiRow();
		var topBottom = this.levelMarginProp.match(/top|bottom/);
		var innerBoxes,
			j,
			colors,
			maxIndent = parseInt(aTabs[0].boxObject.height / 2);

		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			if (multirow) {
				indent = Math.min(aLevel * 3, maxIndent);
				innerBoxes = document.getAnonymousNodes(aTabs[i]);
				colors = '-moz-border-top-colors:'+(function(aNum) {
					var retVal = [];
					for (var i = 1; i < aNum; i++)
					{
						retVal.push('transparent');
					}
					retVal.push('ThreeDShadow');
					return retVal.length == 1 ? 'none' : retVal.join(' ') ;
				})(indent)+' !important;';
				for (j = 0, maxj = innerBoxes.length; j < maxj; j++)
				{
					if (innerBoxes[j].nodeType != Node.ELEMENT_NODE) continue;
					innerBoxes[j].setAttribute('style', innerBoxes[j].getAttribute('style').replace(/(-moz-)?border-(top|bottom)(-[^:]*)?.*:[^;]+;?/g, '')+'; border-'+topBottom+': solid transparent '+indent+'px !important;'+colors);
				}
			}
			else {
				aTabs[i].setAttribute('style', aTabs[i].getAttribute('style').replace(/margin(-[^:]+):[^;]+;?/g, '')+'; '+aProp+':'+indent+'px !important;');
			}
			aTabs[i].setAttribute(this.kNEST, aLevel);
			this.updateTabsIndent(this.getChildTabs(aTabs[i]), aLevel+1, aProp);
		}
	},
 
	updateAllTabsIndent : function() 
	{
		this.updateTabsIndent(this.rootTabs, 0);
//		this.checkTabsIndentOverflow();
	},
 
	checkTabsIndentOverflow : function() 
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
	checkTabsIndentOverflowCallback : function()
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

		var oldMargin = this.levelMargin;
		var indent    = (oldMargin < 0 ? this.baseLebelMargin : oldMargin ) * nest;
		var maxIndent = (
				this.getFirstTab(b).boxObject[this.invertedSizeProp] ||
				b.mTabContainer.boxObject[this.invertedSizeProp]
			) * 0.33;

		var marginUnit = Math.max(Math.floor(maxIndent / nest), 1);
		if (indent > maxIndent) {
			this.levelMargin = marginUnit;
		}
		else {
			this.levelMargin = -1;
			if ((this.baseLebelMargin * nest) > maxIndent)
				this.levelMargin = marginUnit;
		}

		if (oldMargin != this.levelMargin) {
			this.updateAllTabsIndent();
		}
	},
 
	updateTabsCount : function(aTab, aDontUpdateAncestor) 
	{
		var count = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER);
		if (count) {
			count.setAttribute('value', '('+this.getDescendantTabs(aTab).length+')');
		}
		var parent = this.getParentTab(aTab);
		if (parent && !aDontUpdateAncestor)
			this.updateTabsCount(parent);
	},
  
/* move */ 
	
	moveTabSubTreeTo : function(aTab, aIndex) 
	{
		if (!aTab) return;

		var b = this.mTabBrowser;
		this.isSubTreeMoving = true;

		this.internallyTabMoving = true;
		b.moveTabTo(aTab, aIndex);
		this.internallyTabMoving = false;

		this.isSubTreeChildrenMoving = true;
		this.internallyTabMoving     = true;
		var tabs = this.getDescendantTabs(aTab);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			b.moveTabTo(tabs[i], aTab._tPos+i+(aTab._tPos < tabs[i]._tPos ? 1 : 0 ));
		}
		this.internallyTabMoving     = false;
		this.isSubTreeChildrenMoving = false;

		this.isSubTreeMoving = false;
	},
 
	moveTabLevel : function(aEvent) 
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
				this.internallyTabMoving = true;
				if (nextTab) {
					b.moveTabTo(b.mCurrentTab, nextTab._tPos - 1);
				}
				else {
					b.moveTabTo(b.mCurrentTab, this.getLastTab(b)._tPos);
				}
				this.internallyTabMoving = false;
				b.mCurrentTab.focus();
				return true;
			}
		}
		return false;
	},
  
/* collapse/expand */ 
	
	collapseExpandSubtree : function(aTab, aCollapse) 
	{
		if (!aTab) return;

		if ((aTab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') == aCollapse) return;

		var b = this.mTabBrowser;
		this.doingCollapseExpand = true;

		this.setTabValue(aTab, this.kSUBTREE_COLLAPSED, aCollapse);

		var tabs = this.getChildTabs(aTab);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.collapseExpandTab(tabs[i], aCollapse);
		}

		if (!aCollapse)
			this.scrollToTabSubTree(aTab);

		this.doingCollapseExpand = false;
	},
 
	collapseExpandTab : function(aTab, aCollapse) 
	{
		if (!aTab || !this.getParentTab(aTab)) return;

		this.setTabValue(aTab, this.kCOLLAPSED, aCollapse);

		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabCollapsedStateChange', true, true);
		event.collapsed = aCollapse;
		aTab.dispatchEvent(event);

		var b = this.mTabBrowser;
		var parent;
		if (aCollapse && aTab == b.selectedTab && (parent = this.getParentTab(aTab))) {
			var newSelection = parent;
			while (parent.getAttribute(this.kCOLLAPSED) == 'true')
			{
				parent = this.getParentTab(parent);
				if (!parent) break;
				newSelection = parent;
			}
			b.selectedTab = newSelection;
		}

		var isSubTreeCollapsed = (aTab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true');
		var tabs = this.getChildTabs(aTab);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			if (!isSubTreeCollapsed)
				this.collapseExpandTab(tabs[i], aCollapse);
		}
	},
 
	collapseExpandTreesIntelligentlyFor : function(aTab) 
	{
		var b = this.mTabBrowser;
		if (this.doingCollapseExpand) return;

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
				if (parentTab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true') {
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
				this.collapseExpandSubtree(collapseTab, true);
		}

		this.collapseExpandSubtree(aTab, false);
	},
 
	collapseExpandAllSubtree : function(aCollapse) 
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
			this.collapseExpandSubtree(xpathResult.snapshotItem(i), aCollapse);
		}
	},
  
/* scroll */ 
	
	scrollTo : function(aEndX, aEndY) 
	{
		if (this.getTreePref('tabbar.scroll.smooth')) {
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
	
	smoothScrollTo : function(aEndX, aEndY) 
	{
		var b = this.mTabBrowser;
		if (this.smoothScrollTimer) {
			window.clearInterval(this.smoothScrollTimer);
			this.smoothScrollTimer = null;
		}

		var scrollBoxObject = this.scrollBoxObject;
		var x = {}, y = {};
		scrollBoxObject.getPosition(x, y);
		this.smoothScrollTimer = window.setInterval(
			this.smoothScrollToCallback,
			10,
			this,
			x.value,
			y.value,
			aEndX,
			aEndY,
			Date.now(),
			this.getTreePref('tabbar.scroll.timeout')
		);
	},
 
	smoothScrollToCallback : function(aSelf, aStartX, aStartY, aEndX, aEndY, aStartTime, aTimeout) 
	{
		var past = Date.now() - aStartTime;

		var newX = aStartX + parseInt(
				(aEndX - aStartX) * (past / aTimeout)
			);
		var newY = aStartY + parseInt(
				(aEndY - aStartY) * (past / aTimeout)
			);

		var scrollBoxObject = aSelf.scrollBoxObject;
		var x = {}, y = {};
		scrollBoxObject.getPosition(x, y);

		var w = {}, h = {};
		scrollBoxObject.getScrolledSize(w, h);
		var maxX = Math.max(0, w.value - scrollBoxObject.width);
		var maxY = Math.max(0, h.value - scrollBoxObject.height);

		if (
			(past > aTimeout) ||
			(
				(
				aEndX - aStartX > 0 ?
					x.value >= Math.min(aEndX, maxX) :
					x.value <= Math.min(aEndX, maxX)
				) &&
				(
				aEndY - aStartY > 0 ?
					y.value >= Math.min(aEndY, maxY) :
					y.value <= Math.min(aEndY, maxY)
				)
			)
			) {
			if (aSelf.smoothScrollTimer) {
				window.clearInterval(aSelf.smoothScrollTimer);
				aSelf.smoothScrollTimer = null;
			}
			return;
		}

		scrollBoxObject.scrollTo(newX, newY);
	},
  
	scrollToTab : function(aTab) 
	{
		if (!aTab || this.isTabInViewport(aTab)) return;

		var b = this.mTabBrowser;

		var scrollBoxObject = this.scrollBoxObject;
		var w = {}, h = {};
		try {
			scrollBoxObject.getScrolledSize(w, h);
		}
		catch(e) { // Tab Mix Plus
			return;
		}

		var targetTabBox = aTab.boxObject;
		var baseTabBox = aTab.parentNode.firstChild.boxObject;

		var targetX = (aTab.boxObject.screenX < scrollBoxObject.screenX) ?
			(targetTabBox.screenX - baseTabBox.screenX) - (targetTabBox.width * 0.5) :
			(targetTabBox.screenX - baseTabBox.screenX) - scrollBoxObject.width + (targetTabBox.width * 1.5) ;

		var targetY = (aTab.boxObject.screenY < scrollBoxObject.screenY) ?
			(targetTabBox.screenY - baseTabBox.screenY) - (targetTabBox.height * 0.5) :
			(targetTabBox.screenY - baseTabBox.screenY) - scrollBoxObject.height + (targetTabBox.height * 1.5) ;

		this.scrollTo(targetX, targetY);
	},
 
	scrollToTabSubTree : function(aTab) 
	{
		var b          = this.mTabBrowser;
		var descendant = this.getDescendantTabs(aTab);
		var lastVisible = aTab;
		for (var i = descendant.length-1; i > -1; i--)
		{
			if (descendant[i].getAttribute(this.kCOLLAPSED) == 'true') continue;
			lastVisible = descendant[i];
			break;
		}

		if (this.isTabInViewport(aTab) && this.isTabInViewport(lastVisible)) {
			return;
		}

		var containerPosition = b.mStrip.boxObject[this.positionProp];
		var containerSize     = b.mStrip.boxObject[this.sizeProp];
		var parentPosition    = aTab.boxObject[this.positionProp];
		var lastPosition      = lastVisible.boxObject[this.positionProp];
		var tabSize           = lastVisible.boxObject[this.sizeProp];

		if (lastPosition - parentPosition + tabSize > containerSize - tabSize) { // out of screen
			var endPos = parentPosition - this.getFirstTab(b).boxObject[this.positionProp] - tabSize * 0.5;
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
	tabbarShown    : true,
	tabbarExpanded : true,
	
	get tabbarWidth() 
	{
		if (this.autoHideShown) {
			this._tabbarWidth = this.mTabBrowser.mStrip.boxObject.width;
		}
		return this._tabbarWidth;
	},
	set tabbarWidth(aNewWidth)
	{
		this._tabbarWidth = aNewWidth;
		return this._tabbarWidth;
	},
	_tabbarWidth : 0,
 
	get splitterWidth() 
	{
		if (this.tabbarShown) {
			var splitter = document.getAnonymousElementByAttribute(this.mTabBrowser, 'class', this.kSPLITTER);
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
 
	get tabbarHeight() 
	{
		if (this.tabbarShown) {
			this._tabbarHeight = this.mTabBrowser.mStrip.boxObject.height;
		}
		return this._tabbarHeight;
	},
	set tabbarHeight(aNewHeight)
	{
		this._tabbarHeight = aNewHeight;
		return this._tabbarHeight;
	},
	_tabbarHeight : 0,
 
	get autoHideShown() 
	{
		switch (this.autoHideMode)
		{
			case this.kAUTOHIDE_MODE_HIDE:
				return this.tabbarShown;

			default:
			case this.kAUTOHIDE_MODE_SHRINK:
				return this.tabbarExpanded;
		}
	},
	set autoHideShown(aValue)
	{
		switch (this.autoHideMode)
		{
			case this.kAUTOHIDE_MODE_HIDE:
				this.tabbarShown = aValue;
				break;

			default:
			case this.kAUTOHIDE_MODE_SHRINK:
				this.tabbarExpanded = aValue;
				break;
		}
		return aValue;
	},
 
	get autoHideXOffset() 
	{
		switch (this.autoHideMode)
		{
			case this.kAUTOHIDE_MODE_HIDE:
				let offset = this.tabbarWidth + this.splitterWidth;
				if (this.mTabBrowser.getAttribute(this.kTABBAR_POSITION) == 'left' &&
					this.autoHideMode == this.kAUTOHIDE_MODE_HIDE) {
					offset -= this.togglerSize;
				}
				return offset;
				break;

			default:
			case this.kAUTOHIDE_MODE_SHRINK:
				return this.getTreePref('tabbar.width')
					- this.getTreePref('tabbar.shrunkenWidth');
				break;
		}
	},
	get autoHideYOffset()
	{
		return this.tabbarHeight;
	},
 
	get autoHideMode() 
	{
		return TreeStyleTabService.autoHideMode;
	},
	set autoHideMode(aValue)
	{
		TreeStyleTabService.autoHideMode = aValue;
		return aValue;
	},
 
	showHideTabbarInternal : function(aReason) 
	{
		fullScreenCanvas.show();
		var b = this.mTabBrowser;

		var pos = this.mTabBrowser.getAttribute(this.kTABBAR_POSITION);
		if (this.autoHideShown) { // to be hidden or shrunken
			this.tabbarHeight = b.mStrip.boxObject.height;
			this.tabbarWidth = b.mStrip.boxObject.width;
			var splitter = document.getAnonymousElementByAttribute(b, 'class', this.kSPLITTER);
			this.splitterWidth = (splitter ? splitter.boxObject.width : 0 );
			this.container.style.margin = 0;
			switch (this.autoHideMode)
			{
				case this.kAUTOHIDE_MODE_HIDE:
					b.setAttribute(this.kAUTOHIDE, 'hidden');
					break;

				default:
				case this.kAUTOHIDE_MODE_SHRINK:
					b.setAttribute(this.kAUTOHIDE, 'show');
					if (pos == 'left' || pos == 'right')
						b.mStrip.width = this.getTreePref('tabbar.shrunkenWidth');
					break;
			}
			this.showHideTabbarReason = aReason || this.kSHOWN_BY_UNKNOWN;
			this.autoHideShown = false;
		}
		else { // to be shown or expanded
			switch (b.getAttribute(this.kTABBAR_POSITION))
			{
				case 'left':
					this.container.style.marginRight = '-'+this.autoHideXOffset+'px';
					break;
				case 'right':
					this.container.style.marginLeft = '-'+this.autoHideXOffset+'px';
					break;
				case 'bottom':
					this.container.style.marginTop = '-'+this.autoHideYOffset+'px';
					break;
				default:
					this.container.style.marginBottom = '-'+this.autoHideYOffset+'px';
					break;
			}
			if (this.isGecko18) b.setAttribute(this.kAUTOHIDE, 'show');
			switch (this.autoHideMode)
			{
				case this.kAUTOHIDE_MODE_HIDE:
					break;

				default:
				case this.kAUTOHIDE_MODE_SHRINK:
					if (pos == 'left' || pos == 'right')
						b.mStrip.width = this.getTreePref('tabbar.width');
					break;
			}
			this.showHideTabbarReason = aReason || this.kSHOWN_BY_UNKNOWN;
			this.autoHideShown = true;
		}
		window.setTimeout(function(aSelf) {
			if (
				aSelf.autoHideShown &&
				(
					aSelf.autoHideMode == aSelf.kAUTOHIDE_MODE_SHRINK ||
					!aSelf.isGecko18
				)
				) {
				b.setAttribute(aSelf.kAUTOHIDE, 'show');
				aSelf.redrawContentArea();
			}
			aSelf.checkTabsIndentOverflow();
			aSelf.redrawContentArea();
			fullScreenCanvas.hide();

			var event = document.createEvent('Events');
			event.initEvent('TreeStyleTabAutoHideStateChange', true, true);
			event.shown = aSelf.autoHideShown;
			event.xOffset = aSelf.autoHideXOffset;
			event.yOffset = aSelf.autoHideYOffset;
			aSelf.mTabBrowser.dispatchEvent(event);
		}, 0, this);
	},
	showHideTabbarReason : 0,
	
	showTabbar : function(aReason) 
	{
		if (!this.autoHideShown)
			this.showHideTabbarInternal(aReason);
	},
 
	hideTabbar : function(aReason) 
	{
		if (this.autoHideShown)
			this.showHideTabbarInternal(aReason);
	},
  
	redrawContentArea : function() 
	{
		var pos = this.mTabBrowser.getAttribute(this.kTABBAR_POSITION);
		try {
			var v = this.mTabBrowser.markupDocumentViewer;
			if (this.autoHideEnabled && this.autoHideShown) {
				v.move(window.outerWidth,window.outerHeight);
				v.move(
					(
						!this.autoHideShown ? 0 :
						pos == 'left' ? -this.autoHideXOffset :
						pos == 'right' ? this.autoHideXOffset :
						0
					),
					(
						!this.autoHideShown ? 0 :
						pos == 'top' ? -this.autoHideYOffset :
						pos == 'bottom' ? this.autoHideYOffset :
						0
					)
				);
				if (this.mTabBrowser.hasAttribute(this.kTRANSPARENT) &&
					this.mTabBrowser.getAttribute(this.kTRANSPARENT) != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_NONE])
					this.drawTabbarCanvas();
				else
					this.clearTabbarCanvas();
			}
			else {
				v.move(window.outerWidth,window.outerHeight);
				v.move(0,0);
				this.clearTabbarCanvas();
			}
		}
		catch(e) {
		}
	},
 
	drawTabbarCanvas : function() 
	{
		if (!this.tabbarCanvas || this.tabbarResizing) return;

		var pos = this.mTabBrowser.getAttribute(this.kTABBAR_POSITION);

		var frame = this.mTabBrowser.contentWindow;
		var tabContainerBox = this.mTabBrowser.mTabContainer.boxObject;
		var browserBox = this.mTabBrowser.mCurrentBrowser.boxObject;
		var contentBox = this.getBoxObjectFor(frame.document.documentElement);

		var zoom = this.getZoomForFrame(frame);

		var x = (pos == 'right') ? browserBox.width - this.autoHideXOffset : 0 ;
		var y = (pos == 'bottom') ? browserBox.height - this.autoHideYOffset : 0 ;
		if (pos == 'left' && this.autoHideMode == this.kAUTOHIDE_MODE_HIDE)
			x -= this.togglerSize;
		var xOffset = (zoom == 1 && (pos == 'top' || pos == 'bottom')) ?
				contentBox.screenX + frame.scrollX - browserBox.screenX :
				0 ;
		var yOffset = (zoom == 1 && (pos == 'left' || pos == 'right')) ?
				contentBox.screenY + frame.scrollY - browserBox.screenY :
				0 ;
		var w = tabContainerBox.width - xOffset;
		var h = tabContainerBox.height - yOffset;

		for (let node = this.tabbarCanvas;
		     node != this.mTabBrowser.mStrip.parentNode;
		     node = node.parentNode)
		{
			let style = window.getComputedStyle(node, null);
			'border-left-width,border-right-width,margin-left,margin-right,padding-left,padding-right'
				.split(',').forEach(function(aProperty) {
					let value = parseInt(style.getPropertyValue(aProperty).replace('px', ''));
					w -= value;
					if (aProperty.indexOf('left') < -1) x += value;
				});
			'border-top-width,border-bottom-width,margin-top,margin-bottom,padding-left,padding-right'
				.split(',').forEach(function(aProperty) {
					let value = parseInt(style.getPropertyValue(aProperty).replace('px', ''));
					h -= value;
					if (aProperty.indexOf('top') < -1) y += value;
				});
		}

		// zero width (heigh) canvas becomes wrongly size!!
		w = Math.max(1, w);
		h = Math.max(1, h);

		this.tabbarCanvas.style.display = 'inline';
		this.tabbarCanvas.style.margin = (yOffset || 0)+'px 0 0 '+(xOffset || 0)+'px';
		this.tabbarCanvas.style.width = (this.tabbarCanvas.width = w)+'px';
		this.tabbarCanvas.style.height = (this.tabbarCanvas.height = h)+'px';
		var ctx = this.tabbarCanvas.getContext('2d');
		ctx.clearRect(0, 0, w, h);
		ctx.save();
		if (this.autoHideMode == this.kAUTOHIDE_MODE_SHRINK) {
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
			(x / zoom)+frame.scrollX,
			(y / zoom)+frame.scrollY,
			w / zoom,
			h / zoom,
			'-moz-field'
		);
		ctx.restore();
		if (this.mTabBrowser.getAttribute(this.kTRANSPARENT) != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_FULL]) {
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
		var borderNode = this.getTreePref('tabbar.fixed') ?
				this.mTabBrowser.mStrip :
				document.getAnonymousElementByAttribute(this.mTabBrowser, 'class', this.kSPLITTER) ;

		var pos = this.mTabBrowser.getAttribute(this.kTABBAR_POSITION);
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
		if (!this.getPref('browser.zoom.full')) return 1;
		return  aFrame
			.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIWebNavigation)
			.QueryInterface(Components.interfaces.nsIDocShell)
			.contentViewer
			.QueryInterface(Components.interfaces.nsIMarkupDocumentViewer)
			.fullZoom;
	},
 
	clearTabbarCanvas : function() 
	{
		if (!this.tabbarCanvas) return;

		this.tabbarCanvas.style.display = 'none';
		this.tabbarCanvas.style.margin = 0;
		// zero width (heigh) canvas becomes wrongly size!!
		this.tabbarCanvas.style.width = this.tabbarCanvas.style.height = '1px';
		this.tabbarCanvas.width = this.tabbarCanvas.height = 1;
	},
 
	updateTabbarTransparency : function() 
	{
		var pos = this.mTabBrowser.getAttribute(this.kTABBAR_POSITION);
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
			this.autoHideMode != this.kAUTOHIDE_MODE_DISABLED &&
			style != this.kTRANSPARENT_STYLE[this.kTRANSPARENT_NONE])
			this.mTabBrowser.setAttribute(this.kTRANSPARENT, style);
		else
			this.mTabBrowser.removeAttribute(this.kTRANSPARENT);
	},
  
/* auto hide */ 
	autoHideEnabled : false,
	
	get sensitiveArea() 
	{
		var b    = this.mTabBrowser;
		var area = Math.abs(this.getTreePref('tabbar.autoHide.area'));
		var pos  = b.getAttribute(this.kTABBAR_POSITION);
		switch (this.autoHideMode)
		{
			case this.kAUTOHIDE_MODE_HIDE:
				if (!this.tabbarShown &&
					this.getTreePref('tabbar.autoHide.expandArea'))
					area += (pos == 'left' || pos == 'right') ?
							this.autoHideXOffset + this.splitterWidth :
							this.autoHideYOffset ;
				break;

			default:
			case this.kAUTOHIDE_MODE_SHRINK:
				if (pos == 'left' || pos == 'right') {
					if (!this.tabbarExpanded)
						area = b.mStrip.boxObject.width - area;
				}
				break;
		}
		return area;
	},
 
	startAutoHide : function() 
	{
		if (this.autoHideEnabled) return;
		this.autoHideEnabled = true;

		this.mTabBrowser.addEventListener('mousedown', this, true);
		this.mTabBrowser.addEventListener('mouseup', this, true);
		this.mTabBrowser.addEventListener('resize', this, true);
		this.mTabBrowser.addEventListener('load', this, true);
		this.mTabBrowser.mPanelContainer.addEventListener('scroll', this, true);
		if (this.shouldListenMouseMove)
			this.startListenMouseMove();
		if (this.mTabBrowser == gBrowser && this.shouldListenKeyEvents)
			TreeStyleTabService.startListenKeyEvents();

		this.clearTabbarCanvas();
		this.updateTabbarTransparency();

		this.tabbarShown = true;
		this.tabbarExpanded = true;
		this.showHideTabbarInternal();
	},
 
	endAutoHide : function() 
	{
		if (!this.autoHideEnabled) return;
		this.autoHideEnabled = false;

		if (!this.autoHideShown)
			this.showHideTabbarInternal();

		this.mTabBrowser.removeEventListener('mousedown', this, true);
		this.mTabBrowser.removeEventListener('mouseup', this, true);
		this.mTabBrowser.removeEventListener('resize', this, true);
		this.mTabBrowser.removeEventListener('load', this, true);
		this.mTabBrowser.mPanelContainer.removeEventListener('scroll', this, true);
		this.endListenMouseMove();
		if (this.mTabBrowser == gBrowser)
			TreeStyleTabService.endListenKeyEvents();

		this.clearTabbarCanvas();
		this.updateTabbarTransparency();

		this.container.style.margin = 0;
		this.mTabBrowser.removeAttribute(this.kAUTOHIDE);
		this.mTabBrowser.removeAttribute(this.kTRANSPARENT);
		this.tabbarShown = true;
		this.tabbarExpanded = true;
	},
 
	startListenMouseMove : function() 
	{
		if (this.mouseMoveListening) return;
		this.mTabBrowser.addEventListener('mousemove', this, true);
		this.mouseMoveListening = true;
	},
	endListenMouseMove : function()
	{
		if (!this.mouseMoveListening) return;
		this.mTabBrowser.removeEventListener('mousemove', this, true);
		this.mouseMoveListening = false;
	},
	mouseMoveListening : false,
	get shouldListenMouseMove()
	{
		return this.getTreePref('tabbar.autoShow.mousemove') ||
				this.getTreePref('tabbar.autoShow.accelKeyDown') ||
				this.getTreePref('tabbar.autoShow.tabSwitch') ||
				this.getTreePref('tabbar.autoShow.feedback');
	},
 
	showHideTabbarOnMousemove : function(aEvent) 
	{
		if ('gestureInProgress' in window && window.gestureInProgress) return;

		this.cancelShowHideTabbarOnMousemove();

		var b   = this.mTabBrowser;
		var pos = b.getAttribute(this.kTABBAR_POSITION);
		var shouldKeepShown = (
				pos == 'left' ?
					(aEvent.screenX <= b.mCurrentBrowser.boxObject.screenX + this.sensitiveArea) :
				pos == 'right' ?
					(aEvent.screenX >= b.mCurrentBrowser.boxObject.screenX + b.boxObject.width - this.sensitiveArea) :
				pos == 'bottom' ?
					(aEvent.screenY >= b.mCurrentBrowser.boxObject.screenY + b.boxObject.height - this.sensitiveArea) :
					(aEvent.screenY <= b.mCurrentBrowser.boxObject.screenY + this.sensitiveArea)
			);
		if (this.autoHideShown) {
			if (
				shouldKeepShown &&
				this.showHideTabbarReason & this.kKEEP_SHOWN_ON_MOUSEOVER &&
				this.getTreePref('tabbar.autoShow.keepShownOnMouseover')
				) {
				this.showHideTabbarReason = this.kSHOWN_BY_MOUSEMOVE;
				this.cancelDelayedAutoShowForShortcut();
				this.cancelHideTabbarForFeedback();
			}
			else if (
				!shouldKeepShown &&
				this.getTreePref('tabbar.autoShow.mousemove')
				) {
				this.showHideTabbarOnMousemoveTimer = window.setTimeout(
					function(aSelf) {
						aSelf.cancelDelayedAutoShowForShortcut();
						if (aSelf.showHideTabbarReason == aSelf.kSHOWN_BY_MOUSEMOVE)
							aSelf.hideTabbar(aSelf.kSHOWN_BY_MOUSEMOVE);
					},
					this.getTreePref('tabbar.autoHide.delay'),
					this
				);
			}
		}
		else if (
				pos == 'left' ?
					(aEvent.screenX <= b.boxObject.screenX + this.sensitiveArea) :
				pos == 'right' ?
					(aEvent.screenX >= b.boxObject.screenX + b.boxObject.width - this.sensitiveArea) :
				pos == 'bottom' ?
					(aEvent.screenY >= b.boxObject.screenY + b.boxObject.height - this.sensitiveArea) :
					(aEvent.screenY <= b.boxObject.screenY + this.sensitiveArea)
			) {
			this.showHideTabbarOnMousemoveTimer = window.setTimeout(
				function(aSelf) {
					aSelf.cancelDelayedAutoShowForShortcut();
					aSelf.cancelHideTabbarForFeedback();
					aSelf.showTabbar(aSelf.kSHOWN_BY_MOUSEMOVE);
				},
				this.getTreePref('tabbar.autoHide.delay'),
				this
			);
		}
	},
	showHideTabbarOnMousemoveTimer : null,
	
	cancelShowHideTabbarOnMousemove : function() 
	{
		if (this.showHideTabbarOnMousemoveTimer) {
			window.clearTimeout(this.showHideTabbarOnMousemoveTimer);
			this.showHideTabbarOnMousemoveTimer = null;
		}
	},
  
	showTabbarForFeedback : function() 
	{
		if (!this.autoHideEnabled ||
			!this.getTreePref('tabbar.autoShow.feedback'))
			return;

		if (this.delayedShowTabbarForFeedbackTimer) {
			window.clearTimeout(this.delayedShowTabbarForFeedbackTimer);
			this.delayedShowTabbarForFeedbackTimer = null;
		}
		this.cancelHideTabbarForFeedback();
		this.delayedShowTabbarForFeedbackTimer = window.setTimeout(
			function(aSelf) {
				aSelf.delayedShowTabbarForFeedbackTimer = null;
				aSelf.delayedShowTabbarForFeedback();
			},
			100,
			this
		);
	},
	delayedShowTabbarForFeedback : function()
	{
		this.showTabbar(this.kSHOWN_BY_FEEDBACK);
		this.cancelHideTabbarForFeedback();
		this.delayedHideTabbarForFeedbackTimer = window.setTimeout(
			function(aSelf) {
				aSelf.delayedHideTabbarForFeedbackTimer = null;
				if (aSelf.showHideTabbarReason == aSelf.kSHOWN_BY_FEEDBACK)
					aSelf.hideTabbar();
			},
			this.getTreePref('tabbar.autoShow.feedback.delay'),
			this
		);
	},
	
	cancelHideTabbarForFeedback : function() 
	{
		if (this.delayedHideTabbarForFeedbackTimer) {
			window.clearTimeout(this.delayedHideTabbarForFeedbackTimer);
			this.delayedHideTabbarForFeedbackTimer = null;
		}
	}
    
}; 

TreeStyleTabBrowser.prototype.__proto__ = TreeStyleTabService;
 
