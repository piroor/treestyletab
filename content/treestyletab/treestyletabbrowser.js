function TreeStyleTabBrowser(aTabBrowser) 
{
	this.mTabBrowser = aTabBrowser;
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
	 
	mTabBrowser : null, 

	tabbarResizing : false,

	levelMargin          : -1,
	levelMarginProp      : 'margin-left',
	positionProp         : 'screenY',
	sizeProp             : 'height',
	invertedPositionProp : 'screenX',
	invertedSizeProp     : 'width',
 
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
 
/* utils */ 
	
/* get tab contents */ 
	 
	getTabLabel : function(aTab) 
	{
		var label = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text-container') || // Tab Mix Plus
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
		var box = b.mTabContainer.mTabstrip || b.mTabContainer ;
		return (box.getAttribute('orient') || window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical';
	},
 
	isTabInViewport : function(aTab) 
	{
		if (!aTab) return false;
		var tabBox = aTab.boxObject;
		var barBox = this.mTabBrowser.mTabContainer.mTabstrip.boxObject;
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

		var selectNewTab = '_selectNewTab' in b.mTabContainer ? '_selectNewTab' : 'selectNewTab' ; // Fx3 / Fx2


		/* Closing collapsed last tree breaks selected tab.
		   To solve this problem, I override the setter to
		   force to set a tab and forbid it becomes null. */
		var getter = b.__lookupGetter__('selectedTab');
		var setter = b.__lookupSetter__('selectedTab');
		eval('setter = '+setter.toSource().replace(
			'{',
			'{ if (!val) val = this.mTabContainer.lastChild;'
		));
		/* We have to use both __defineSetter__ and __defineGetter__
		   just in same time!! If we update only setter,
		   getter will be vanished. */
		b.__defineGetter__('selectedTab', getter);
		b.__defineSetter__('selectedTab', setter);


		eval('b.mTabContainer.'+selectNewTab+' = '+
			b.mTabContainer[selectNewTab].toSource().replace(
				'{',
				<><![CDATA[$&
					if (arguments[0].__treestyletab__preventSelect) {
						arguments[0].__treestyletab__preventSelect = false;
						return;
					}
				]]></>
			)
		);

		eval('b.mTabContainer.adjustTabstrip = '+
			b.mTabContainer.adjustTabstrip.toSource().replace(
				/(\})(\)?)$/,
				<><![CDATA[
					var b = TreeStyleTabService.getTabBrowserFromChild(this);
					b.treeStyleTab.updateInvertedTabContentsOrder(true);
				$1$2]]></>
			)
		);

		eval('b.mTabContainer.advanceSelectedTab = '+
			b.mTabContainer.advanceSelectedTab.toSource().replace(
				'{',
				<><![CDATA[$&
					if (TreeStyleTabService.getTreePref('focusMode') == TreeStyleTabService.kFOCUS_VISIBLE) {
						(function(aDir, aWrap, aSelf) {
							var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(aSelf).treeStyleTab;
							var nextTab = (aDir < 0) ? treeStyleTab.getPreviousVisibleTab(aSelf.selectedItem) : treeStyleTab.getNextVisibleTab(aSelf.selectedItem) ;
							if (!nextTab && aWrap) {
								var xpathResult = TreeStyleTabService.evaluateXPath(
										'child::xul:tab[not(@'+TreeStyleTabService.kCOLLAPSED+'="true")]',
										aSelf
									);
								nextTab = xpathResult.snapshotItem(aDir < 0 ? xpathResult.snapshotLength-1 : 0 );
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
				]]></>
			)
		);

		eval('b.mTabContainer._handleTabSelect = '+
			b.mTabContainer._handleTabSelect.toSource().replace(
				'{',
				<><![CDATA[$&
					var treeStyleTab = TreeStyleTabService.getTabBrowserFromChild(this).treeStyleTab;
					if (!treeStyleTab.isTabInViewport(this.selectedItem)) {
						treeStyleTab.scrollToTab(this.selectedItem);
						return;
					}
				]]></>
			)
		);

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
				<><![CDATA[
					var descendant = this.treeStyleTab.getDescendantTabs(nextTab);
					if (descendant.length) {
						nextTab = descendant[descendant.length-1];
					}
					$&]]></>
			).replace(
				'this.moveTabToStart();',
				<><![CDATA[
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
				]]></>
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
				<><![CDATA[
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
				]]></>
			)
		);

		eval('b._keyEventHandler.handleEvent = '+
			b._keyEventHandler.handleEvent.toSource().replace(
				'this.tabbrowser.moveTabOver(aEvent);',
				<><![CDATA[
					if (!this.tabbrowser.treeStyleTab.isVertical ||
						!this.tabbrowser.treeStyleTab.moveTabLevel(aEvent)) {
						$&
					}
				]]></>
			).replace(
				'this.tabbrowser.moveTabForward();',
				<><![CDATA[
					if (this.tabbrowser.treeStyleTab.isVertical ||
						!this.tabbrowser.treeStyleTab.moveTabLevel(aEvent)) {
						$&
					}
				]]></>
			).replace(
				'this.tabbrowser.moveTabBackward();',
				<><![CDATA[
					if (this.tabbrowser.treeStyleTab.isVertical ||
						!this.tabbrowser.treeStyleTab.moveTabLevel(aEvent)) {
						$&
					}
				]]></>
			)
		);

		eval('b.loadTabs = '+
			b.loadTabs.toSource().replace(
				'var tabNum = ',
				<><![CDATA[
					if (this.treeStyleTab.readyToAttachNewTabGroup)
						TreeStyleTabService.readyToOpenChildTab(firstTabAdded || this.selectedTab, true);
					$&]]></>
			).replace(
				'if (!aLoadInBackground)',
				<><![CDATA[
					if (TreeStyleTabService.checkToOpenChildTab(this))
						TreeStyleTabService.stopToOpenChildTab(this);
					$&]]></>
			)
		);

		eval('b.createTooltip = '+
			b.createTooltip.toSource().replace(
				'if (tn.hasAttribute("label")) {',
				<><![CDATA[
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
					$&]]></>
			)
		);

		eval('b.onTabBarDblClick = '+
			b.onTabBarDblClick.toSource().replace(
				'aEvent.originalTarget.localName == "box"',
				'/^(box|(arrow)?scrollbox|tabs)$/.test(aEvent.originalTarget.localName)'
			)
		);

		var tabs = b.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.initTab(tabs[i]);
		}

		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.style');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.twisty.style');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.showBorderForFirstTab');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.invertScrollbar');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.hideAlltabsButton');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.allowSubtreeCollapseExpand');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.fixed');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.transparent');
		window.setTimeout(function() {
			b.treeStyleTab.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.autoHide.enabled');
		}, 0);

		delete i;
		delete maxi;
		delete tabs;

		var tabContext = document.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContext.addEventListener('popupshowing', this, false);
		tabContext.addEventListener('popuphiding', this, false);
		window.setTimeout(function(aSelf) {
			var suffix = '-'+parseInt(Math.random() * 65000);
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
		}, 0, this);

		var allTabPopup = document.getAnonymousElementByAttribute(b.mTabContainer, 'anonid', 'alltabs-popup');
		allTabPopup.addEventListener('popupshowing', this, false);

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
			canvas.setAttribute('style', 'width:0;height:0;');
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
			this.setTabValue(aTab, this.kID, this.makeNewId());
		}

		aTab.__treestyletab__linkedTabBrowser = this.mTabBrowser;

		this.initTabAttributes(aTab);
		this.initTabContents(aTab);

		aTab.setAttribute(this.kNEST, 0);
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
				if (label.nextSibling)
					label.parentNode.insertBefore(counter, label.nextSibling);
				else
					label.parentNode.appendChild(counter);
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
				Array.prototype.slice.call(b.mTabContainer.childNodes).forEach(function(aTab) {
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
		var b = this.mTabBrowser;

		if (!aPosition) aPosition = this.getTreePref('tabbar.position');
		aPosition = String(aPosition).toLowerCase();

		if (b.getAttribute('id') != 'content') {
			aPosition = 'top';
		}

		var pos = (aPosition == 'left') ? this.kTABBAR_LEFT :
			(aPosition == 'right') ? this.kTABBAR_RIGHT :
			(aPosition == 'bottom') ? this.kTABBAR_BOTTOM :
			this.kTABBAR_TOP;

		var splitter = document.getAnonymousElementByAttribute(b, 'class', this.kSPLITTER);
		if (!splitter) {
			splitter = document.createElement('splitter');
			splitter.setAttribute('class', this.kSPLITTER);
			splitter.setAttribute('onmouseup', 'TreeStyleTabService.onTabbarResized(event);');
			splitter.setAttribute('state', 'open');
			splitter.appendChild(document.createElement('grippy'));
			var ref = b.mPanelContainer;
			ref.parentNode.insertBefore(splitter, ref);
		}

		var scrollInnerBox = b.mTabContainer.mTabstrip._scrollbox ? document.getAnonymousNodes(b.mTabContainer.mTabstrip._scrollbox)[0] :
				document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-frame'); // Tab Mix Plus
		var allTabsButton = document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-alltabs-button') ||
				document.getAnonymousElementByAttribute(b.mTabContainer, 'anonid', 'alltabs-button'); // Tab Mix Plus

		// Tab Mix Plus
		var scrollFrame = document.getAnonymousElementByAttribute(b.mTabContainer, 'id', 'scroll-tabs-frame') ||
						document.getAnonymousElementByAttribute(b.mTabContainer, 'class', 'tabs-frame'); // 0.3.6.1 or later
		var newTabBox = document.getAnonymousElementByAttribute(b.mTabContainer, 'id', 'tabs-newbutton-box');
		var tabBarMode = this.getPref('extensions.tabmix.tabBarMode');

		// All-in-One Sidebar
		var toolboxContainer = document.getAnonymousElementByAttribute(b.mStrip, 'anonid', 'aiostbx-toolbox-tableft');
		if (toolboxContainer) toolboxContainer = toolboxContainer.parentNode;

		this.tabbarResizing = false;
		b.removeAttribute(this.kRESIZING);

		if (pos & this.kTABBAR_VERTICAL) {
			this.positionProp         = 'screenY';
			this.sizeProp             = 'height';
			this.invertedPositionProp = 'screenX';
			this.invertedSizeProp     = 'width';

			b.mTabBox.orient = 'horizontal';
			b.mStrip.orient =
				b.mTabContainer.orient =
				b.mTabContainer.mTabstrip.orient =
				b.mTabContainer.mTabstrip.parentNode.orient = 'vertical';
			if (allTabsButton.parentNode.localName == 'hbox') { // Firefox 2
				allTabsButton.parentNode.orient = 'vertical';
				allTabsButton.parentNode.setAttribute('align', 'stretch');
			}
			allTabsButton.firstChild.setAttribute('position', 'before_start');
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

			b.mTabBox.orient = 'vertical';
			b.mStrip.orient =
				b.mTabContainer.orient =
				b.mTabContainer.mTabstrip.orient =
				b.mTabContainer.mTabstrip.parentNode.orient = 'horizontal';
			if (allTabsButton.parentNode.localName == 'hbox') { // Firefox 2
				allTabsButton.parentNode.orient = 'horizontal';
				allTabsButton.parentNode.removeAttribute('align');
			}
			allTabsButton.firstChild.setAttribute('position', 'after_end');
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
					b.mPanelContainer.setAttribute('ordinal', 30);
				}, 0);
			}
		}
	},
  
	destroy : function() 
	{
		this.endAutoHide();

		var b = this.mTabBrowser;

		var tabs = b.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.destroyTab(tabs[i]);
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

		var tabContext = document.getAnonymousElementByAttribute(b, 'anonid', 'tabContextMenu');
		tabContext.removeEventListener('popupshowing', this, false);
		tabContext.removeEventListener('popuphiding', this, false);

		var allTabPopup = document.getAnonymousElementByAttribute(b.mTabContainer, 'anonid', 'alltabs-popup');
		allTabPopup.removeEventListener('popupshowing', this, false);

		if (this.tabbarCanvas) {
			this.tabbarCanvas.parentNode.removeChild(this.tabbarCanvas);
			this.tabbarCanvas = null;
		}

		this.ObserverService.removeObserver(this, 'TreeStyleTab:levelMarginModified');
		this.ObserverService.removeObserver(this, 'TreeStyleTab:collapseExpandAllSubtree');
		this.removePrefListener(this);

		delete this.mTabBrowser;
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
		var self = this;
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
				var tabs  = Array.prototype.slice.call(tabContainer.childNodes);
				switch (aData)
				{
					case 'extensions.treestyletab.tabbar.position':
//						if (value != 'left' && value != 'right') {
//							this.endAutoHide();
//						}
						if (this.autoHideEnabled && this.tabbarShown) this.hideTabbar();
						this.initTabbar();
						tabs.forEach(function(aTab) {
							self.initTabAttributes(aTab);
						});
						this.updateAllTabsIndent();
						tabs.forEach(function(aTab) {
							self.initTabContents(aTab);
						});
						if (this.autoHideEnabled) this.showTabbar();
						this.updateTabbarTransparency();
						break;

					case 'extensions.treestyletab.tabbar.invertUI':
					case 'extensions.treestyletab.tabbar.multirow':
						this.initTabbar();
						this.updateAllTabsIndent();
						tabs.forEach(function(aTab) {
							self.initTabContents(aTab);
						});
						break;

					case 'extensions.treestyletab.enableSubtreeIndent':
						this.updateAllTabsIndent();
						break;

					case 'extensions.treestyletab.tabbar.style':
						b.setAttribute(this.kSTYLE, value);
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

					case 'extensions.treestyletab.tabbar.autoHide.enabled':
						var pos = b.getAttribute(this.kTABBAR_POSITION);
						if (value/* && (pos == 'left' || pos == 'right')*/)
							this.startAutoHide();
						else
							this.endAutoHide();
						break;

					case 'extensions.treestyletab.tabbar.autoShow.mousemove':
						if (this.autoHideEnabled && value)
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

					case 'extensions.treestyletab.tabbar.transparent':
						this.updateTabbarTransparency();
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
					tab.getAttribute(this.kCHILDREN) &&
					this.getTreePref('collapseExpandSubTree.dblclick')) {
					this.collapseExpandSubtree(tab, tab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');
					aEvent.preventDefault();
					aEvent.stopPropagation();
				}
				return;

			case 'mousedown':
				if (aEvent.currentTarget == this.mTabBrowser.mTabContainer) {
					this.onTabMouseDown(aEvent);
				}
				else {
					if (aEvent.originalTarget.getAttribute('class') == this.kSPLITTER) {
						this.tabbarResizing = true;
						this.mTabBrowser.setAttribute(this.kRESIZING, true);
					}
					this.cancelShowHideTabbarOnMousemove();
					if (
						this.autoHideEnabled &&
						this.tabbarShown &&
						(
							aEvent.originalTarget.ownerDocument != document ||
							!this.getTabBrowserFromChild(aEvent.originalTarget)
						)
						)
						this.hideTabbar();
				}
				return;

			case 'mouseup':
				if (aEvent.originalTarget.getAttribute('class') == this.kSPLITTER) {
					this.tabbarResizing = false;
					this.mTabBrowser.removeAttribute(this.kRESIZING);
				}
				this.cancelShowHideTabbarOnMousemove();
				return;

			case 'mousemove':
				if (!this.tabbarResizing) {
					if (
						!this.tabContextMenuShown &&
						(
							!this.tabbarShown ||
							this.showHideTabbarReason == this.kSHOWN_BY_MOUSEMOVE
						)
						)
						this.showHideTabbarOnMousemove(aEvent);
					return;
				}
			case 'resize':
				if (this.tabbarShown) {
					switch (this.mTabBrowser.getAttribute(this.kTABBAR_POSITION))
					{
						case 'left':
							this.container.style.marginRight = '-'+this.tabbarWidth+'px';
							break;
						case 'right':
							this.container.style.marginLeft = '-'+this.tabbarWidth+'px';
							break;
						case 'bottom':
							this.container.style.marginTop = '-'+this.tabbarHeight+'px';
							break;
						default:
							this.container.style.marginBottom = '-'+this.tabbarHeight+'px';
							break;
					}
					this.redrawContentArea();
				}
				return;

			case 'scroll':
				this.redrawContentArea();
				return;

			case 'load':
				this.redrawContentArea();
				return;

			case 'popupshowing':
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
				return;

			case 'popuphiding':
				if (aEvent.target != aEvent.currentTarget) return;
				switch (aEvent.target.getAttribute('anonid'))
				{
					case 'tabContextMenu':
						this.tabContextMenuShown = false;
						break;
				}
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
		}
	},
 
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

			if (b.mTabContainer.childNodes.length == 1) { // this is the last tab
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
					self.moveTabSubTreeTo(aTab, b.mTabContainer.lastChild._tPos);
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
			if (tab == lastSibling) {
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

		if (tab.getAttribute(this.kCHILDREN) && !this.isSubTreeMoving) {
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
		var oldPos = this.getChildIndex(this.mTabBrowser.mTabContainer.childNodes[aOldPosition], parent);
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

		var prevTab = aTab.previousSibling;
		var nextTab = aTab.nextSibling;

		var tabs = this.getDescendantTabs(aTab);
		if (tabs.length) {
			nextTab = tabs[tabs.length-1].nextSibling;
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
			newParent = aTab.previousSibling;
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
		var self = this;
		this.setTabValue(aTab, this.kCHILDREN,
			children.map(function(aItem) { return aItem.getAttribute(self.kID); }).join('|'));
	},
  
	onTabRestored : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.mTabBrowser;
		var self = this;

		var isDuplicated = false;

		var id = this.getTabValue(tab, this.kID);

		if (this.getTabById(id)) { // this is a duplicated tab!
			isDuplicated = true;
			id = this.getDuplicatedId(id);
		}

		if (!isDuplicated) {
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
			if (isDuplicated)
				children = children.map(function(aChild) {
					return self.getDuplicatedId(aChild);
				});
			for (var i = 0, maxi = children.length; i < maxi; i++)
			{
				if (children[i] && (children[i] = this.getTabById(children[i]))) {
					this.attachTabTo(children[i], tab, { dontExpand : true, dontUpdateIndent : true });
					tabs.push(children[i]);
				}
			}
		}

		var before = this.getTabValue(tab, this.kINSERT_BEFORE);
		if (before && isDuplicated) {
			before = this.getDuplicatedId(before);
		}

		var ancestors = (this.getTabValue(tab, this.kANCESTOR) || this.getTabValue(tab, this.kPARENT) || '').split('|');
		var parent = null;
		for (var i in ancestors)
		{
			if (isDuplicated) ancestors[i] = this.getDuplicatedId(ancestors[i]);
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
					insertBefore : (before ? this.getTabById(before) : null ),
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

		if (!parent && (before = this.getTabById(before))) {
			var index = before._tPos;
			if (index > tab._tPos) index--;
			b.moveTabTo(tab, index);
		}
		this.deleteTabValue(tab, this.kINSERT_BEFORE);

		if (isSubTreeCollapsed) {
			this.collapseExpandSubtree(tab, isSubTreeCollapsed);
		}

		if (isDuplicated) this.clearCachedIds();
	},
	
	getDuplicatedId : function(aId) 
	{
		if (!(aId in this.duplicatedIdsHash))
			this.duplicatedIdsHash[aId] = this.makeNewId();
		return this.duplicatedIdsHash[aId];
	},
	duplicatedIdsHash : {},
 
	clearCachedIds : function() 
	{
		if (this.clearCachedIdsTimer) {
			window.clearTimeout(this.clearCachedIdsTimer);
			this.clearCachedIdsTimer = null;
		}
		this.clearCachedIdsTimer = window.setTimeout(function(aSelf) {
			aSelf.clearCachedIdsCallback();
		}, 1000, this);
	},
	clearCachedIdsTimer : null,
	clearCachedIdsCallback : function()
	{
		this.duplicatedIdsHash = {};
	},
  
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
		else if (tab.getAttribute(this.kCHILDREN) &&
				(tab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') &&
				this.getTreePref('autoCollapseExpandSubTreeOnSelect')) {
			this.collapseExpandTreesIntelligentlyFor(tab);
		}

		if (this.autoHideEnabled && this.tabbarShown)
			this.redrawContentArea();

		this.updateInvertedTabContentsOrder();

		if (!this.accelKeyPressed)
			this.showTabbarForFeedback();
	},
 
	onTabClick : function(aEvent) 
	{
		if (aEvent.button != 0 ||
			!this.isEventFiredOnTwisty(aEvent))
			return;

		var tab = this.getTabFromEvent(aEvent);
		this.collapseExpandSubtree(tab, tab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');

		aEvent.preventDefault();
		aEvent.stopPropagation();
	},
 
	onTabMouseDown : function(aEvent) 
	{
		if (aEvent.button != 0 ||
			!this.isEventFiredOnTwisty(aEvent))
			return;

		this.getTabFromEvent(aEvent).__treestyletab__preventSelect = true;
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
		this.showHideRemoveSubTreeMenuItem(item, [b.mContextTab]);

		item = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_REMOVECHILDREN+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (this.getTreePref('show.'+this.kMENUITEM_REMOVECHILDREN))
			item.removeAttribute('hidden');
		else
			item.setAttribute('hidden', true);
		this.showHideRemoveSubTreeMenuItem(item, [b.mContextTab]);

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
			if (this.getTreePref('tabbar.autoHide.enabled'))
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
	},
 
	initAllTabsPopup : function(aEvent) 
	{
		if (!this.getTreePref('enableSubtreeIndent.allTabsPopup')) return;
		var items = aEvent.target.childNodes;
		var tabs = this.mTabBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = items.length; i < maxi; i++)
		{
			items[i].style.paddingLeft = tabs[i].getAttribute(this.kNEST)+'em';
		}
	},
  
/* drag and drop */ 
	isPlatformNotSupported : navigator.platform.indexOf('Mac') != -1, // see bug 136524
	isTimerSupported       : navigator.platform.indexOf('Win') == -1, // see bug 232795.

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
			var self = this;
			this.autoExpandedTabs.forEach(function(aTarget) {
				self.collapseExpandSubtree(self.getTabById(aTarget), true);
			});
		}
		this.autoExpandedTabs = [];
	},
 
	canDrop : function(aEvent, aDragSession) 
	{
		return this.getDropAction(aEvent, aDragSession).canDrop;
	},
 
	getSupportedFlavours : function() 
	{
		var flavourSet = new FlavourSet();
		flavourSet.appendFlavour('text/x-moz-url');
		flavourSet.appendFlavour('text/unicode');
		flavourSet.appendFlavour('application/x-moz-file', 'nsIFile');
		return flavourSet;
	},
 
	getDropAction : function(aEvent, aDragSession) 
	{
		var info = this.getDropActionInternal(aEvent);
		info.canDrop = true;
		if (aDragSession &&
			aDragSession.sourceNode &&
			aDragSession.sourceNode.localName == 'tab') {
			if (
				'duplicateTab' in this.mTabBrowser &&
				(
					(navigator.platform.toLowerCase().indexOf('mac') == 0 ? aEvent.metaKey : aEvent.ctrlKey ) ||
					aDragSession.sourceNode.ownerDocument != document
				)
				) {
				info.action = info.action | this.kACTION_DUPLICATE;
				if (aDragSession.sourceNode.ownerDocument != document)
					info.action = info.action | this.kACTION_MOVE_FROM_OTHER_WINDOW;
			}

			if (info.action & this.kACTION_ATTACH) {
				var orig = aDragSession.sourceNode;
				if (orig == info.parent) {
					info.canDrop = false;
				}
				else {
					var tab  = info.target;
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
	 
	getDropActionInternal : function(aEvent) 
	{
		var tab        = aEvent.target;
		var b          = this.mTabBrowser;
		var tabs       = b.mTabContainer.childNodes;
		var isInverted = this.isVertical ? false : window.getComputedStyle(b.parentNode, null).direction == 'rtl';
		var info       = {
				target       : null,
				position     : null,
				action       : null,
				parent       : null,
				insertBefore : null
			};

		if (tab.localName != 'tab') {
			if (aEvent[this.positionProp] < tabs[0].boxObject[this.positionProp]) {
				info.target   = info.parent = info.insertBefore = tabs[0];
				info.position = isInverted ? this.kDROP_AFTER : this.kDROP_BEFORE ;
				info.action   = this.kACTION_MOVE | this.kACTION_PART;
				return info;
			}
			else if (aEvent[this.positionProp] > tabs[tabs.length-1].boxObject[this.positionProp] + tabs[tabs.length-1].boxObject[this.sizeProp]) {
				info.target   = info.parent = tabs[tabs.length-1];
				info.position = isInverted ? this.kDROP_BEFORE : this.kDROP_AFTER ;
				info.action   = this.kACTION_MOVE | this.kACTION_PART;
				return info;
			}
			else {
				info.target = tabs[Math.min(b.getNewIndex(aEvent), tabs.length - 1)];
			}
		}
		else {
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
				info.action       = this.kACTION_ATTACH;
				info.parent       = tab;
				info.insertBefore = this.getNextVisibleTab(tab);
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
				}
				break;
		}

		return info;
	},
  
	processDropAction : function(aInfo, aDraggedTab) 
	{
		var b    = this.mTabBrowser;
		var tabs = b.mTabContainer.childNodes;
		var self = this;

		var draggedTabs = [aDraggedTab];
		var draggedRoots = [aDraggedTab];

		var ownerWindow = aInfo.action & this.kACTION_MOVE_FROM_OTHER_WINDOW ? aDraggedTab.ownerDocument.defaultView : window ;
		var ownerBrowser = ownerWindow ? ownerWindow.TreeStyleTabService.getTabBrowserFromChild(aDraggedTab) : this.mTabBrowser ;

		var moveSelection = (
				'MultipleTabService' in ownerWindow &&
				ownerWindow.MultipleTabService.isSelected(aDraggedTab) &&
				MultipleTabService.allowMoveMultipleTabs
			);

		if (moveSelection) {
			draggedTabs = ownerWindow.MultipleTabService.getSelectedTabs(ownerBrowser);
			if (!(aInfo.action & this.kACTION_DUPLICATE)) {
				draggedRoots = [];
				draggedTabs.forEach(function(aTab) {
					var parent = aTab,
						current;
					do {
						current = parent;
						parent = ownerBrowser.treeStyleTab.getParentTab(parent)
						if (parent && ownerWindow.MultipleTabService.isSelected(parent)) continue;
						draggedRoots.push(current);
						return;
					}
					while (parent);
				});
			}
		}
		else if (ownerWindow != window) {
			draggedTabs = draggedTabs.concat(ownerBrowser.treeStyleTab.getDescendantTabs(aDraggedTab));
		}

		if (aDraggedTab && aInfo.action & this.kACTION_PART) {
			if (!(aInfo.action & this.kACTION_DUPLICATE))
				this.partTabsOnDrop(draggedRoots);
		}
		else if (aInfo.action & this.kACTION_ATTACH) {
			if (!(aInfo.action & this.kACTION_DUPLICATE))
				this.attachTabsOnDrop(draggedRoots, aInfo.parent);
		}
		else {
			return false;
		}

		var newSelection = [];
		if (
			(
				aInfo.action & this.kACTION_MOVE ||
				aInfo.action & this.kACTION_DUPLICATE
			) &&
			(
				!aInfo.insertBefore ||
				ownerBrowser.treeStyleTab.getNextVisibleTab(draggedTabs[0]) != aInfo.insertBefore
			)
			) {
			b.duplicatingSelectedTabs = aInfo.action & self.kACTION_DUPLICATE ? true : false ; // Multiple Tab Handler
			b.movingSelectedTabs = true; // Multiple Tab Handler

			var tab, newIndex;
			var newRoots = [];
			var windowShouldBeClosed = (
					ownerWindow != window &&
					ownerBrowser.mTabContainer.childNodes.length == draggedTabs.length
				);
			draggedTabs.forEach(function(aTab) {
				var tab = aTab;
				if (aInfo.action & self.kACTION_DUPLICATE) {
					var parent = ownerBrowser.treeStyleTab.getParentTab(tab);
					if (moveSelection)
						ownerWindow.MultipleTabService.setSelection(tab, false);
					tab = b.duplicateTab(tab);
					if (moveSelection)
						MultipleTabService.setSelection(tab, true);
					if (!parent || draggedTabs.indexOf(parent) < 0)
						newRoots.push(tab);
				}

				newIndex = aInfo.insertBefore ? aInfo.insertBefore._tPos : tabs.length - 1 ;
				if (aInfo.insertBefore && newIndex > tab._tPos) newIndex--;

				self.internallyTabMoving = true;
				b.moveTabTo(tab, newIndex);
				self.collapseExpandTab(tab, false);
				self.internallyTabMoving = false;

			});

			if (ownerWindow != window) {
				draggedTabs.forEach(function(aTab) {
					ownerBrowser.removeTab(aTab);
				});
			}

			if (aInfo.action & this.kACTION_DUPLICATE &&
				aInfo.action & this.kACTION_ATTACH)
				this.attachTabsOnDrop(newRoots, aInfo.parent);

			if (windowShouldBeClosed)
				ownerWindow.close();

			b.movingSelectedTabs = false; // Multiple Tab Handler
			b.duplicatingSelectedTabs = false; // Multiple Tab Handler
		}

		return true;
	},
	attachTabsOnDrop : function(aTabs, aParent)
	{
		this.mTabBrowser.movingSelectedTabs = true; // Multiple Tab Handler
		var self = this;
		aTabs.forEach(function(aTab) {
			if (aParent)
				self.attachTabTo(aTab, aParent);
			else
				self.partTab(aTab);
			self.collapseExpandTab(aTab, false);
		});
		this.mTabBrowser.movingSelectedTabs = false; // Multiple Tab Handler
	},
	partTabsOnDrop : function(aTabs)
	{
		this.mTabBrowser.movingSelectedTabs = true; // Multiple Tab Handler
		var self = this;
		aTabs.forEach(function(aTab) {
			self.partTab(aTab);
			self.collapseExpandTab(aTab, false);
		});
		this.mTabBrowser.movingSelectedTabs = false; // Multiple Tab Handler
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

		if (!aInfo) aInfo = {};

		var id = aChild.getAttribute(this.kID);
		if (!id || !aParent.getAttribute(this.kID))
			return; // if the tab is not initialized yet, do nothing.

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
		var self = this;
		this._attachTabPostProcesses.forEach(function(aProcess) {
			aProcess(aChild, aParent, self);
		});
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
		var nest = tabs[tabs.length-1].getAttribute(self.kNEST);
		if (!nest) return;

		var oldMargin = this.levelMargin;
		var indent    = (oldMargin < 0 ? this.baseLebelMargin : oldMargin ) * nest;
		var maxIndent = (
				b.mTabContainer.childNodes[0].boxObject[this.invertedSizeProp] ||
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
					b.moveTabTo(b.mCurrentTab, b.mTabContainer.lastChild._tPos);
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

		var b = this.mTabBrowser;
		var p;
		if (aCollapse && aTab == b.selectedTab && (p = this.getParentTab(aTab))) {
			b.selectedTab = p;
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
				this.mTabBrowser.mTabstrip.scrollBoxObject.scrollTo(aEndX, aEndY);
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

		var scrollBoxObject = b.mTabContainer.mTabstrip.scrollBoxObject;
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
		var newX = aStartX + parseInt(
				(aEndX - aStartX) * ((Date.now() - aStartTime) / aTimeout)
			);
		var newY = aStartY + parseInt(
				(aEndY - aStartY) * ((Date.now() - aStartTime) / aTimeout)
			);

		var scrollBoxObject = aSelf.mTabBrowser.mTabContainer.mTabstrip.scrollBoxObject;
		var x = {}, y = {};
		scrollBoxObject.getPosition(x, y);

		var w = {}, h = {};
		scrollBoxObject.getScrolledSize(w, h);
		var maxX = Math.max(0, w.value - scrollBoxObject.width);
		var maxY = Math.max(0, h.value - scrollBoxObject.height);

		if (
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

		var scrollBoxObject = b.mTabContainer.mTabstrip.scrollBoxObject;
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

		var containerPosition = b.mStrip.boxObject[this.positionProp];
		var containerSize     = b.mStrip.boxObject[this.sizeProp];
		var parentPosition    = aTab.boxObject[this.positionProp];
		var lastPosition      = lastVisible.boxObject[this.positionProp];
		var tabSize           = lastVisible.boxObject[this.sizeProp];

		if (this.isTabInViewport(aTab) && this.isTabInViewport(lastVisible)) {
			return;
		}

		if (lastPosition - parentPosition + tabSize > containerSize - tabSize) { // out of screen
			var endPos = parentPosition - b.mTabContainer.firstChild.boxObject[this.positionProp] - tabSize * 0.5;
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
	tabbarShown : true,
	 
	get tabbarWidth() 
	{
		if (this.tabbarShown) {
			var b = this.mTabBrowser;
			var splitter = document.getAnonymousElementByAttribute(b, 'class', this.kSPLITTER);
			this._tabbarWidth = b.mStrip.boxObject.width +
				(splitter ? splitter.boxObject.width : 0 );
		}
		return this._tabbarWidth;
	},
	set tabbarWidth(aNewWidth)
	{
		this._tabbarWidth = aNewWidth;
		return this._tabbarWidth;
	},
	_tabbarWidth : 0,
 
	get tabbarHeight() 
	{
		if (this.tabbarShown) {
			var b = this.mTabBrowser;
			this._tabbarHeight = b.mStrip.boxObject.height;
		}
		return this._tabbarHeight;
	},
	set tabbarHeight(aNewHeight)
	{
		this._tabbarHeight = aNewHeight;
		return this._tabbarHeight;
	},
	_tabbarHeight : 0,
 
	showHideTabbarInternal : function(aReason) 
	{
		fullScreenCanvas.show();
		var b = this.mTabBrowser;
		if (this.tabbarShown) {
			var splitter = document.getAnonymousElementByAttribute(b, 'class', this.kSPLITTER);
			this.tabbarHeight = b.mStrip.boxObject.height;
			this.tabbarWidth = b.mStrip.boxObject.width +
				(splitter ? splitter.boxObject.width : 0 );
			this.container.style.margin = 0;
			b.setAttribute(this.kAUTOHIDE, 'hidden');
			this.showHideTabbarReason = aReason || this.kSHOWN_BY_UNKNOWN;
			this.tabbarShown = false;
		}
		else {
			switch (b.getAttribute(this.kTABBAR_POSITION))
			{
				case 'left':
					this.container.style.marginRight = '-'+this.tabbarWidth+'px';
					break;
				case 'right':
					this.container.style.marginLeft = '-'+this.tabbarWidth+'px';
					break;
				case 'bottom':
					this.container.style.marginTop = '-'+this.tabbarHeight+'px';
					break;
				default:
					this.container.style.marginBottom = '-'+this.tabbarHeight+'px';
					break;
			}
			if (this.isGecko18) b.setAttribute(this.kAUTOHIDE, 'show');
			this.showHideTabbarReason = aReason || this.kSHOWN_BY_UNKNOWN;
			this.tabbarShown = true;
		}
		this.redrawContentArea();
		window.setTimeout(function(aSelf) {
			if (!aSelf.isGecko18 && aSelf.tabbarShown) {
				b.setAttribute(this.kAUTOHIDE, 'show');
				aSelf.redrawContentArea();
			}
			aSelf.checkTabsIndentOverflow();
			fullScreenCanvas.hide();
		}, 0, this);
	},
	showHideTabbarReason : 0,
	 
	showTabbar : function(aReason) 
	{
		if (!this.tabbarShown)
			this.showHideTabbarInternal(aReason);
	},
 
	hideTabbar : function(aReason) 
	{
		if (this.tabbarShown)
			this.showHideTabbarInternal(aReason);
	},
  
	redrawContentArea : function() 
	{
		var pos = this.mTabBrowser.getAttribute(this.kTABBAR_POSITION);
		try {
			var v = this.mTabBrowser.markupDocumentViewer;
			if (this.tabbarShown) {
				v.move(
					(
						!this.tabbarShown ? 0 :
						pos == 'left' ? -this.tabbarWidth :
						pos == 'right' ? this.tabbarWidth :
						0
					),
					(
						!this.tabbarShown ? 0 :
						pos == 'top' ? -this.tabbarHeight :
						pos == 'bottom' ? this.tabbarHeight :
						0
					)
				);
				if (this.mTabBrowser.getAttribute(this.kTRANSPARENT) == 'true')
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
		if (!this.tabbarCanvas) return;

		var pos = this.mTabBrowser.getAttribute(this.kTABBAR_POSITION);

		var frame = this.mTabBrowser.contentWindow;
		var tabContainerBox = this.mTabBrowser.mTabContainer.boxObject;
		var browserBox = this.mTabBrowser.mCurrentBrowser.boxObject;
		var contentBox = frame.document.getBoxObjectFor(frame.document.documentElement);

		var x = (pos == 'right') ? browserBox.width - this.tabbarWidth : 0 ;
		var y = (pos == 'bottom') ? browserBox.height - this.tabbarHeight : 0 ;
		var xOffset = (pos == 'top' || pos == 'bottom') ?
				contentBox.screenX + frame.scrollX - browserBox.screenX :
				0 ;
		var yOffset = (pos == 'left' || pos == 'right') ?
				contentBox.screenY + frame.scrollY - browserBox.screenY :
				0 ;
		var w = tabContainerBox.width - xOffset;
		var h = tabContainerBox.height - yOffset;

		this.tabbarCanvas.style.margin = (yOffset || 0)+'px 0 0 '+(xOffset || 0)+'px';
		this.tabbarCanvas.style.width = (this.tabbarCanvas.width = w)+'px';
		this.tabbarCanvas.style.height = (this.tabbarCanvas.height = h)+'px';
		var ctx = this.tabbarCanvas.getContext('2d');
		ctx.clearRect(0, 0, w, h);
		ctx.save();
		ctx.drawWindow(frame, x+frame.scrollX, y+frame.scrollY, w, h, '-moz-field');
		ctx.restore();
	},
 
	clearTabbarCanvas : function() 
	{
		if (!this.tabbarCanvas) return;

		this.tabbarCanvas.style.margin =
			this.tabbarCanvas.style.width =
			this.tabbarCanvas.style.height = 
			this.tabbarCanvas.width = 
			this.tabbarCanvas.height = 0;
	},
 
	updateTabbarTransparency : function() 
	{
		var pos = this.mTabBrowser.getAttribute(this.kTABBAR_POSITION);
		if (pos != 'top' &&
			this.getTreePref('tabbar.autoHide.enabled') &&
			this.getTreePref('tabbar.transparent'))
			this.mTabBrowser.setAttribute(this.kTRANSPARENT, true);
		else
			this.mTabBrowser.removeAttribute(this.kTRANSPARENT);
	},
  
/* auto hide */ 
	autoHideEnabled : false,
	 
	get areaPadding() 
	{
		return this.getTreePref('tabbar.autoHide.area');
	},
 
	startAutoHide : function() 
	{
		if (this.autoHideEnabled) return;
		this.autoHideEnabled = true;

		this.mTabBrowser.addEventListener('mousedown', this, true);
		this.mTabBrowser.addEventListener('mouseup', this, true);
		this.mTabBrowser.addEventListener('scroll', this, true);
		this.mTabBrowser.addEventListener('resize', this, true);
		this.mTabBrowser.addEventListener('load', this, true);
		if (this.getTreePref('tabbar.autoShow.mousemove'))
			this.startListenMouseMove();

		this.clearTabbarCanvas();
		this.updateTabbarTransparency();

		this.tabbarShown = true;
		this.showHideTabbarInternal();
	},
 
	endAutoHide : function() 
	{
		if (!this.autoHideEnabled) return;
		this.autoHideEnabled = false;

		this.mTabBrowser.removeEventListener('mousedown', this, true);
		this.mTabBrowser.removeEventListener('mouseup', this, true);
		this.mTabBrowser.removeEventListener('scroll', this, true);
		this.mTabBrowser.removeEventListener('resize', this, true);
		this.mTabBrowser.removeEventListener('load', this, true);
		this.endListenMouseMove();

		this.clearTabbarCanvas();
		this.updateTabbarTransparency();

		this.container.style.margin = 0;
		this.mTabBrowser.removeAttribute(this.kAUTOHIDE);
		this.mTabBrowser.removeAttribute(this.kTRANSPARENT);
		this.tabbarShown = true;
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
 
	showHideTabbarOnMousemove : function(aEvent) 
	{
		if ('gestureInProgress' in window && window.gestureInProgress) return;

		this.cancelShowHideTabbarOnMousemove();

		var b      = this.mTabBrowser;
		var pos    = b.getAttribute(this.kTABBAR_POSITION);
		var expand = this.getTreePref('tabbar.autoHide.expandArea');
		if (
			(
				!this.tabbarShown ||
				this.showHideTabbarReason == this.kSHOWN_BY_FEEDBACK
			) &&
			(
				pos == 'left' ?
					(aEvent.screenX <= b.boxObject.screenX + (expand ? this.tabbarWidth : 0 ) + this.areaPadding) :
				pos == 'right' ?
					(aEvent.screenX >= b.boxObject.screenX + b.boxObject.width - (expand ? this.tabbarWidth : 0 ) - this.areaPadding) :
				pos == 'bottom' ?
					(aEvent.screenY >= b.boxObject.screenY + b.boxObject.height - (expand ? this.tabbarHeight : 0 ) - this.areaPadding) :
					(aEvent.screenY <= b.boxObject.screenY + (expand ? this.tabbarHeight : 0 ) + this.areaPadding)
				))
				this.showHideTabbarOnMousemoveTimer = window.setTimeout(
					function(aSelf) {
						if (aSelf.showHideTabbarReason == aSelf.kSHOWN_BY_FEEDBACK) {
							aSelf.showHideTabbarReason = aSelf.kSHOWN_BY_MOUSEMOVE;
							aSelf.cancelHideTabbarForFeedback();
						}
						else
							aSelf.showTabbar(aSelf.kSHOWN_BY_MOUSEMOVE);
					},
					this.getTreePref('tabbar.autoHide.delay'),
					this
				);

		if (this.tabbarShown &&
			(
				pos == 'left' ?
					(aEvent.screenX > b.mCurrentBrowser.boxObject.screenX + this.areaPadding) :
				pos == 'right' ?
					(aEvent.screenX < b.mCurrentBrowser.boxObject.screenX + b.mCurrentBrowser.boxObject.width - this.areaPadding) :
				pos == 'bottom' ?
					(aEvent.screenY < b.mCurrentBrowser.boxObject.screenY + b.mCurrentBrowser.boxObject.height - this.areaPadding) :
					(aEvent.screenY > b.mCurrentBrowser.boxObject.screenY + this.areaPadding)
				))
				this.showHideTabbarOnMousemoveTimer = window.setTimeout(
					function(aSelf) {
						if (aSelf.showHideTabbarReason == aSelf.kSHOWN_BY_MOUSEMOVE)
							aSelf.hideTabbar(aSelf.kSHOWN_BY_MOUSEMOVE);
					},
					this.getTreePref('tabbar.autoHide.delay'),
					this
				);
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
 
