var TreeStyleTabService = { 
	PREFROOT : 'extensions.treestyletab@piro.sakura.ne.jp',

	kID                : 'treestyletab-id',
	kCHILDREN          : 'treestyletab-children',
	kPARENT            : 'treestyletab-parent',
	kINSERT_BEFORE     : 'treestyletab-insert-before',
	kSUBTREE_COLLAPSED : 'treestyletab-subtree-collapsed',
	kCOLLAPSED         : 'treestyletab-tab-collapsed',

	kTWISTY           : 'treestyletab-tab-tree-twisty',
	kTWISTY_CONTAINER : 'treestyletab-tab-tree-twisty-container',

	kFOCUS_ALL     : 0,
	kFOCUS_VISIBLE : 1,

	levelMargin : 12,

	NSResolver : {
		lookupNamespaceURI : function(aPrefix)
		{
			switch (aPrefix)
			{
				case 'xul':
					return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
				case 'html':
				case 'xhtml':
					return 'http://www.w3.org/1999/xhtml';
				case 'xlink':
					return 'http://www.w3.org/1999/xlink';
				default:
					return '';
			}
		}
	},

	get SessionStore() {
		if (!this._SessionStore) {
			this._SessionStore = Components.classes['@mozilla.org/browser/sessionstore;1'].getService(Components.interfaces.nsISessionStore);
		}
		return this._SessionStore;
	},
	_SessionStore : null,
	 
/* Utilities */ 
	 
	isEventFiredOnTabIcon : function(aEvent) 
	{
		var tab = this.getTabFromEvent(aEvent);
		if (!tab) return false;

		var icon = document.getAnonymousElementByAttribute(tab, 'class', 'tab-icon');
		var box = icon.boxObject;
		if (aEvent.screenX > box.screenX &&
			aEvent.screenY > box.screenY &&
			aEvent.screenX < box.screenX + box.width &&
			aEvent.screenY < box.screenY + box.height)
			return true;

		return false;
	},
 
	isEventFiredOnTwisty : function(aEvent) 
	{
		var node = aEvent.originalTarget;
		while (node.getAttribute('class') != this.kTWISTY && node.localName != 'tabs')
		{
			node = node.parentNode;
		}
		return (node && node.getAttribute('class') == this.kTWISTY) ? true : false ;
	},
 
	get browser() 
	{
		return 'SplitBrowser' ? SplitBrowser.activeBrowser : gBrowser ;
	},
 
	evaluateXPath : function(aExpression, aContext, aType) 
	{
		if (!aType) aType = XPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
		try {
			var xpathResult = document.evaluate(
					aExpression,
					aContext,
					this.NSResolver,
					aType,
					null
				);
		}
		catch(e) {
			return {
				singleNodeValue : null,
				snapshotLength  : 0,
				snapshotItem    : function() {
					return null
				}
			};
		}
		return xpathResult;
	},
 
	getArrayFromXPathResult : function(aXPathResult) 
	{
		var max = aXPathResult.snapshotLength;
		var array = new Array(max);
		if (!max) return array;

		for (var i = 0; i < max; i++)
		{
			array[i] = aXPathResult.snapshotItem(i);
		}

		return array;
	},
 
	getTabFromEvent : function(aEvent) 
	{
		var target = aEvent.originalTarget || aEvent.target;
		while (target.localName != 'tab' && target.localName != 'tabs' && target.parentNode)
			target = target.parentNode;

		return (target.localName == 'tab') ? target : null ;
	},
 
	getTabFromFrame : function(aFrame, aTabBrowser) 
	{
		var b = aTabBrowser || this.browser;
		var docShell = aFrame.top
			.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIWebNavigation)
			.QueryInterface(Components.interfaces.nsIDocShell);
		var tabs = b.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			if (tabs[i].linkedBrowser.docShell == docShell)
				return tabs[i];
		}
		return null;
	},
 
	getTabBrowserFromChildren : function(aTab) 
	{
		if (!aTab) return null;

		if (aTab.__treestyletab__linkedTabBrowser)
			return aTab.__treestyletab__linkedTabBrowser;

		var target = aTab;
		while (target.localName != 'tabbrowser' && target.parentNode)
			target = target.parentNode;

		return (target.localName == 'tabbrowser') ? target : null ;
	},
 
	showHideMenuItems : function(aPopup) 
	{
		var nodes = aPopup.childNodes;
		var pref;

		var b   = this.getTabBrowserFromChildren(aPopup) || this.browser;
		var box = b.mTabContainer.mTabstrip || b.mTabContainer ;
		var isVertical = ((box.getAttribute('orient') || window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical');

		var label;

		for (var i = 0, maxi = nodes.length; i < maxi; i++)
		{
			if (
				(isVertical && (label = nodes[i].getAttribute('label-vertical'))) ||
				(!isVertical && (label = nodes[i].getAttribute('label-horizontal')))
				)
				nodes[i].setAttribute('label', label);

			pref = this.getPref('extensions.multipletab.show.'+nodes[i].getAttribute('id').replace(/-tabbrowser[0-9]+$/, ''));
			if (pref === null) continue;

			if (pref)
				nodes[i].removeAttribute('hidden');
			else
				nodes[i].setAttribute('hidden', true);
		}

		var separators = this.getSeparators(aPopup);
		for (var i = separators.snapshotLength-1; i > -1; i--)
		{
			separators.snapshotItem(i).removeAttribute('hidden');
		}

		var separator;
		while (separator = this.getObsoleteSeparator(aPopup))
		{
			separator.setAttribute('hidden', true);
		}
	},
	 
	getSeparators : function(aPopup) 
	{
		return this.evaluateXPath('descendant::xul:menuseparator', aPopup);
	},
 
	getObsoleteSeparator : function(aPopup) 
	{
		return this.evaluateXPath(
				'descendant::xul:menuseparator[not(@hidden)][not(following-sibling::*[not(@hidden)]) or not(preceding-sibling::*[not(@hidden)]) or local-name(following-sibling::*[not(@hidden)]) = "menuseparator"]',
				aPopup,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
   
/* Initializing */ 
	 
	init : function() 
	{
		if (!('gBrowser' in window)) return;

		window.removeEventListener('load', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);

		this.addPrefListener(this);
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.');


		eval('window.nsBrowserAccess.prototype.openURI = '+
			window.nsBrowserAccess.prototype.openURI.toSource().replace(
				/switch\s*\(aWhere\)/,
				<><![CDATA[
					if (aOpener &&
						aWhere == Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWTAB) {
						var ownerBrowser = ('SplitBrowser' in window) ? TreeStyleTabService.getTabBrowserFromChildren(SplitBrowser.getSubBrowserAndBrowserFromFrame(aOpener.top).browser) : gBrowser ;
						var parentTab = TreeStyleTabService.getTabFromFrame(aOpener, ownerBrowser);

						ownerBrowser.__treestyletab__readyToAdoptNewTab = true;
						ownerBrowser.__treestyletab__parentTab = parentTab.getAttribute(TreeStyleTabService.kID);
					}
					switch(aWhere)
				]]></>
			)
		);
		window.QueryInterface(Components.interfaces.nsIDOMChromeWindow).browserDOMWindow = null;
		window.QueryInterface(Components.interfaces.nsIDOMChromeWindow).browserDOMWindow = new nsBrowserAccess();


		this.initTabBrowser(gBrowser);
	},
	 
	initTabBrowser : function(aTabBrowser) 
	{
		aTabBrowser.mTabContainer.addEventListener('TreeStyleTab:TabOpen', this, true);
		aTabBrowser.mTabContainer.addEventListener('TabClose', this, true);
		aTabBrowser.mTabContainer.addEventListener('TabMove', this, true);
		aTabBrowser.mTabContainer.addEventListener('SSTabRestoring', this, true);
		aTabBrowser.mTabContainer.addEventListener('click', this, true);
		aTabBrowser.mTabContainer.addEventListener('mousedown', this, true);
		aTabBrowser.mTabContainer.addEventListener('select', this, true);
		aTabBrowser.mPanelContainer.addEventListener('click', this, true);

		eval('aTabBrowser.mTabContainer.selectNewTab = '+
			aTabBrowser.mTabContainer.selectNewTab.toSource().replace(
				/\{/,
				<><![CDATA[
					{
						if (arguments[0].__treestyletab__preventSelect) {
							arguments[0].__treestyletab__preventSelect = false;
							return;
						}
				]]></>
			)
		);

		eval('aTabBrowser.mTabContainer.advanceSelectedTab = '+
			aTabBrowser.mTabContainer.advanceSelectedTab.toSource().replace(
				/\{/,
				<><![CDATA[
					{
						if (TreeStyleTabService.getPref('extensions.treestyletab.focusMode') == 1) {
							var xpathResult = TreeStyleTabService.evaluateXPath(
										(arguments[0] < 0 ? 'preceding-sibling' : 'following-sibling' )+
											'::xul:tab[not(@'+TreeStyleTabService.kCOLLAPSED+'="true")]',
										this.selectedItem
									);
							var nextTab = xpathResult.snapshotItem(arguments[0] < 0 ? xpathResult.snapshotLength-1 : 0 );
							if (!nextTab && arguments[1]) {
								var xpathResult = TreeStyleTabService.evaluateXPath(
										'child::xul:tab[not(@'+TreeStyleTabService.kCOLLAPSED+'="true")]',
										this
									);
								nextTab = xpathResult.snapshotItem(arguments[0] < 0 ? xpathResult.snapshotLength-1 : 0 );
							}
							if (nextTab && nextTab != this.selectedItem) {
								this.selectNewTab(nextTab, arguments[0], arguments[1]);
							}
							return;
						}
				]]></>
			)
		);


		var addTabMethod = 'addTab';
		var removeTabMethod = 'removeTab';
		if (aTabBrowser.__tabextensions__addTab) {
			addTabMethod = '__tabextensions__addTab';
			removeTabMethod = '__tabextensions__removeTab';
		}

		aTabBrowser.__treestyletab__originalAddTab = aTabBrowser[addTabMethod];
		aTabBrowser[addTabMethod] = function() {
			var tab = this.__treestyletab__originalAddTab.apply(this, arguments);
			try {
				TreeStyleTabService.initTab(tab, this);
			}
			catch(e) {
			}
			return tab;
		};

		aTabBrowser.__treestyletab__originalRemoveTab = aTabBrowser[removeTabMethod];
		aTabBrowser[removeTabMethod] = function(aTab) {
			TreeStyleTabService.destroyTab(aTab, this);
			var retVal = this.__treestyletab__originalRemoveTab.apply(this, arguments);
			try {
				if (aTab.parentNode)
					TreeStyleTabService.initTab(aTab, this);
			}
			catch(e) {
			}
			return retVal;
		};


//		var tabContextMenu = document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
//		tabContextMenu.addEventListener('popupshowing', this, false);

		var tabs = aTabBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.initTab(tabs[i], aTabBrowser);
		}


		delete addTabMethod;
		delete removeTabMethod;
		delete i;
		delete maxi;
		delete tabs;

	},
 	
	initTab : function(aTab, aTabBrowser) 
	{
		var id = 'tab-<'+Date.now()+'-'+parseInt(Math.random() * 65000)+'>';
		this.setTabValue(aTab, this.kID, id);
		aTab.__treestyletab__linkedTabBrowser = aTabBrowser;

		this.initTabTwisty(aTab);

		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTab:TabOpen', true, false);
		aTab.dispatchEvent(event);
	},
	 
	initTabTwisty : function(aTab) 
	{
		if (document.getAnonymousElementByAttribute(aTab, 'class', this.kTWISTY)) return;

		var twisty = document.createElement('image');
		twisty.setAttribute('class', this.kTWISTY);

		var container = document.createElement('hbox');
		container.setAttribute('class', this.kTWISTY_CONTAINER);
		container.appendChild(twisty);

		var icon = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-icon');
		icon.appendChild(container);
	},
   
	destroy : function() 
	{
		this.destroyTabBrowser(gBrowser);

		window.removeEventListener('unload', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.removeEventListener('SubBrowserAdded', this, false);
		appcontent.removeEventListener('SubBrowserRemoveRequest', this, false);

		this.removePrefListener(this);

		var tabs = gBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.destroyTab(tabs[i]);
		}
	},
	
	destroyTabBrowser : function(aTabBrowser) 
	{
		var tabs = aTabBrowser.mTabContainer.childNodes;
		var parent;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			parent = this.getParentTabOf(tabs[i]);
			if (parent)
				this.setTabValue(tabs[i], this.kPARENT, parent.getAttribute(this.kID));
		}

		aTabBrowser.mTabContainer.removeEventListener('TreeStyleTab:TabOpen', this, true);
		aTabBrowser.mTabContainer.removeEventListener('TabClose', this, true);
		aTabBrowser.mTabContainer.removeEventListener('TabMove', this, true);
		aTabBrowser.mTabContainer.removeEventListener('SSTabRestoring', this, true);
		aTabBrowser.mTabContainer.removeEventListener('click', this, true);
		aTabBrowser.mTabContainer.removeEventListener('mousedown', this, true);
		aTabBrowser.mTabContainer.removeEventListener('select', this, true);
		aTabBrowser.mPanelContainer.removeEventListener('click', this, true);

//		var tabContextMenu = document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
//		tabContextMenu.removeEventListener('popupshowing', this, false);
	},
 
	destroyTab : function(aTab, aTabBrowser) 
	{
		delete aTab.__treestyletab__linkedTabBrowser;
	},
   
/* Event Handling */ 
	
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'TreeStyleTab:TabOpen':
				this.onTabAdded(aEvent);
				return;

			case 'TabClose':
				this.onTabRemoved(aEvent);
				return;

			case 'TabMove':
				var tab = aEvent.originalTarget;
				this.initTabTwisty(tab); // twisty vanished after the tab is moved!!
				var b = this.getTabBrowserFromChildren(tab);
				if (tab.getAttribute(this.kCHILDREN) && !b.__treestyletab__isSubTreeMoving) {
					this.moveTabSubTreeTo(tab, tab._tPos);
				}
				return;

			case 'SSTabRestoring':
				this.onTabRestored(aEvent);
				return;

			case 'click':
				if (aEvent.target.ownerDocument == document) {
					this.onTabClick(aEvent);
					return;
				}
				var isMiddleClick = (
					aEvent.button == 1 ||
					aEvent.button == 0 && (aEvent.ctrlKey || aEvent.metaKey)
					);
				var node = aEvent.originalTarget;
				while (node.parentNode && !node.href)
				{
					node = node.parentNode;
				}
				if (node.href && isMiddleClick) {
					var b = this.getTabBrowserFromChildren(aEvent.currentTarget);
					b.__treestyletab__readyToAdoptNewTab = true;
					b.__treestyletab__parentTab = b.selectedTab.getAttribute(this.kID);
				}
				return;

			case 'mousedown':
				this.onTabMouseDown(aEvent);
				return;

			case 'select':
				this.onTabSelect(aEvent);
				return;

			case 'load':
				this.init();
				return;

			case 'unload':
				this.destroy();
				return;

			case 'popupshowing':
//				this.showHideMenuItems(aEvent.target);
				return;

			case 'SubBrowserAdded':
				this.initTabBrowser(aEvent.originalTarget.browser);
				return;

			case 'SubBrowserRemoveRequest':
				this.destroyTabBrowser(aEvent.originalTarget.browser);
				return;
		}
	},
 
	onTabAdded : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.getTabBrowserFromChildren(tab);

		if (b.__treestyletab__readyToAdoptNewTab) {
			var parent = this.getTabById(b.__treestyletab__parentTab, b);
			if (parent)
				this.adoptTabTo(tab, parent);
		}

		b.__treestyletab__readyToAdoptNewTab = false;
		b.__treestyletab__parentTab = '';
	},
 
	onTabRemoved : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.getTabBrowserFromChildren(tab);

		if (tab.getAttribute(this.kSUBTREE_COLLAPSED)) {
			var descendant = this.getDescendantTabsOf(tab);
			for (var i = descendant.length-1; i > -1; i--)
			{
				b.removeTab(descendant[i]);
			}
		}

		var firstChild     = this.getFirstChildTabOf(tab);
		var parentTab      = this.getParentTabOf(tab);
		var nextFocusedTab = null;

		if (parentTab) {
			this.setTabValue(tab, this.kPARENT, parentTab.getAttribute(this.kID));
			var next = this.getNextSiblingTabOf(tab);
			if (next)
				this.setTabValue(tab, this.kINSERT_BEFORE, next.getAttribute(this.kID));
		}

		if (firstChild) {
			var backupChildren = this.getTabValue(tab, this.kCHILDREN);
			var children   = this.getChildTabsOf(tab);
			var self       = this;
			var adoption   = this.getPref('extensions.treestyletab.adoptChildrenToGrandParentOnRemoveTab');
			var processTab = !adoption ? function(aTab) {
					self.repudiateTab(aTab, true);
					self.moveTabSubTreeTo(aTab, b.mTabContainer.lastChild._tPos);
				} :
				parentTab ? function(aTab) {
					self.adoptTabTo(aTab, parentTab, { insertBefore : tab, dontUpdateIndent : true });
				} :
				function(aTab) {
					self.repudiateTab(aTab, true);
				};
			for (var i = 0, maxi = children.length; i < maxi; i++)
			{
				processTab(children[i]);
			}
			this.updateTabsIndent(children);
			if (adoption) {
				nextFocusedTab = firstChild;
			}
			this.setTabValue(tab, this.kCHILDREN, backupChildren);
		}

		if (!nextFocusedTab) {
			if (parentTab) {
				var firstSibling = this.getFirstChildTabOf(parentTab);
				var lastSibling  = this.getLastChildTabOf(parentTab);
				if (tab == lastSibling) {
					if (tab == firstSibling) { // there is only one child
						nextFocusedTab = parentTab;
					}
					else { // previous sibling tab
						nextFocusedTab = this.getPreviousSiblingTabOf(tab);
					}
				}
				this.repudiateTab(tab, true);
			}
			else {
				nextFocusedTab = this.getNextSiblingTabOf(tab);
			}
		}

		if (nextFocusedTab)
			b.selectedTab = nextFocusedTab;
	},
 
	onTabRestored : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.getTabBrowserFromChildren(tab);
		var id  = this.getTabValue(tab, this.kID);
		this.setTabValue(tab, this.kID, id);

		var isSubTreeCollapsed = (this.getTabValue(tab, this.kSUBTREE_COLLAPSED) == 'true');

		var children = this.getTabValue(tab, this.kCHILDREN);
		if (children) {
			children = children.split('|');
			var tabs = [];
			for (var i = 0, maxi = children.length; i < maxi; i++)
			{
				if (children[i] && (children[i] = this.getTabById(children[i], b))) {
					this.adoptTabTo(children[i], tab, { dontExpand : true, dontUpdateIndent : true });
					tabs.push(children[i]);
				}
			}
		}

		var parent = this.getTabValue(tab, this.kPARENT);
		var before = this.getTabValue(tab, this.kINSERT_BEFORE);
		if (parent && (parent = this.getTabById(parent, b))) {
			this.adoptTabTo(tab, parent, { dontExpand : true, insertBefore : (before ? this.getTabById(before, b) : null ), dontUpdateIndent : true });
			this.deleteTabValue(tab, this.kPARENT);
			this.updateTabsIndent([tab]);
		}
		else if (children) {
			this.updateTabsIndent(tabs);
		}

		if (isSubTreeCollapsed) {
			this.collapseExpandTabSubTree(tab, isSubTreeCollapsed);
		}
	},
 
	onTabMouseDown : function(aEvent) 
	{
		if (aEvent.button != 0 ||
			!this.isEventFiredOnTwisty(aEvent))
			return;

		this.getTabFromEvent(aEvent).__treestyletab__preventSelect = true;
	},
 
	onTabClick : function(aEvent) 
	{
		if (aEvent.button != 0 ||
			!this.isEventFiredOnTwisty(aEvent))
			return;

		var tab = this.getTabFromEvent(aEvent);
		this.collapseExpandTabSubTree(tab, tab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');

		aEvent.preventDefault();
		aEvent.stopPropagation();
	},
 
	onTabSelect : function(aEvent) 
	{
		var b   = this.getTabBrowserFromChildren(aEvent.currentTarget);
		var tab = b.selectedTab

/*
		var p;
		if ((tab.getAttribute(this.kCOLLAPSED) == 'true') &&
			(p = this.getParentTabOf(tab))) {
			b.selectedTab = p;
		}
*/
		if (tab.getAttribute(this.kCOLLAPSED) == 'true') {
			var parentTab = tab;
			while (parentTab = this.getParentTabOf(parentTab))
			{
				this.collapseExpandTabSubTree(parentTab, false);
			}
		}
		else if (tab.getAttribute(this.kCHILDREN) &&
				(tab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') &&
				this.getPref('extensions.treestyletab.autoCollapseExpandSubTreeOnSelect')) {
			this.collapseExpandTreesIntelligentlyFor(tab);
		}
	},
  
/* Tab Utilities */ 
	
	getTabValue : function(aTab, aKey) 
	{
		var value = null;
		try {
			value = this.SessionStore.getTabValue(aTab, aKey);
		}
		catch(e) {
		}

		return value;
	},
 
	setTabValue : function(aTab, aKey, aValue) 
	{
		if (!aValue) {
			return this.deleteTabValue(aTab, aKey);
		}
		aTab.setAttribute(aKey, aValue);
		try {
			this.SessionStore.setTabValue(aTab, aKey, aValue);
		}
		catch(e) {
		}
		return aValue;
	},
 
	deleteTabValue : function(aTab, aKey) 
	{
		aTab.removeAttribute(aKey);
		try {
			this.SessionStore.deleteTabValue(aTab, aKey);
		}
		catch(e) {
		}
	},
 
	getTabById : function(aId, aTabBrowser) 
	{
		return this.evaluateXPath(
				'descendant::xul:tab[@'+this.kID+' = "'+aId+'"]',
				aTabBrowser.mTabContainer,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getParentTabOf : function(aTab) 
	{
		var id = aTab.getAttribute(this.kID);
		return this.evaluateXPath(
				'parent::*/child::xul:tab[contains(@'+this.kCHILDREN+', "'+id+'")]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getNextSiblingTabOf : function(aTab) 
	{
		var id        = aTab.getAttribute(this.kID);
		var parentTab = this.getParentTabOf(aTab);

		if (!parentTab) {
			var next = aTab;
			do {
				next = next.nextSibling;
			}
			while (next && this.getParentTabOf(next));
			return next;
		}

		var b        = this.getTabBrowserFromChildren(aTab);
		var children = parentTab.getAttribute(this.kCHILDREN);
		if (children) {
			var list = ('|'+children).split('|'+id)[1].split('|');
			for (var i = 0, maxi = list.length; i < maxi; i++)
			{
				firstChild = this.getTabById(list[i], b);
				if (firstChild) break;
			}
		}
		return firstChild;
	},
 
	getPreviousSiblingTabOf : function(aTab) 
	{
		var id        = aTab.getAttribute(this.kID);
		var parentTab = this.getParentTabOf(aTab);

		if (!parentTab) {
			var prev = aTab;
			do {
				prev = prev.previousSibling;
			}
			while (prev && this.getParentTabOf(prev));
			return prev;
		}

		var b        = this.getTabBrowserFromChildren(aTab);
		var children = parentTab.getAttribute(this.kCHILDREN);
		if (children) {
			var list = ('|'+children).split('|'+id)[0].split('|');
			for (var i = list.length-1; i > -1; i--)
			{
				lastChild = this.getTabById(list[i], b)
				if (lastChild) break;
			}
		}
		return lastChild;
	},
 
	getDescendantTabsOf : function(aTab) 
	{
		var tabs = [];
		this.getChildTabsOf(aTab, tabs);
		return tabs;
	},
 
	getChildTabsOf : function(aTab, aAllTabsArray) 
	{
		var tabs     = [];
		var children = aTab.getAttribute(this.kCHILDREN);
		if (!children) return tabs;

		if (aAllTabsArray) tabs = aAllTabsArray;

		var list = children.split('|');
		var b    = this.getTabBrowserFromChildren(aTab);
		var tab;
		for (var i = 0, maxi = list.length; i < maxi; i++)
		{
			tab = this.getTabById(list[i], b)
			if (!tab) continue;
			tabs.push(tab);
			if (aAllTabsArray)
				this.getChildTabsOf(tab, tabs);
		}

		return tabs;
	},
 
	getFirstChildTabOf : function(aTab) 
	{
		var b          = this.getTabBrowserFromChildren(aTab);
		var children   = aTab.getAttribute(this.kCHILDREN);
		var firstChild = null;
		if (children) {
			var list = children.split('|');
			for (var i = 0, maxi = list.length; i < maxi; i++)
			{
				firstChild = this.getTabById(list[i], b)
				if (firstChild) break;
			}
		}
		return firstChild;
	},
 
	getLastChildTabOf : function(aTab) 
	{
		var b         = this.getTabBrowserFromChildren(aTab);
		var children  = aTab.getAttribute(this.kCHILDREN);
		var lastChild = null;
		if (children) {
			var list = children.split('|');
			for (var i = list.length-1; i > -1; i--)
			{
				lastChild = this.getTabById(list[i], b)
				if (lastChild) break;
			}
		}
		return lastChild;
	},
  
/* Commands */ 
	
	adoptTabTo : function(aChild, aParent, aInfo) 
	{
		if (!aChild || !aParent) return;
		if (!aInfo) aInfo = {};

		var id = aChild.getAttribute(this.kID);
		var b  = this.getTabBrowserFromChildren(aParent);

		this.repudiateTab(aChild, true);

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
			var refTab    = aParent;
			var lastChild = this.getLastChildTabOf(aParent);
			if (lastChild) {
				var descendant = this.getDescendantTabsOf(lastChild);
				if (descendant.length) lastChild = descendant[descendant.length-1];
			}
			newIndex = (lastChild ? lastChild : aParent )._tPos+1;
		}

		this.setTabValue(aParent, this.kCHILDREN, children);

		if (newIndex > aChild._tPos) newIndex--;
		this.moveTabSubTreeTo(aChild, newIndex);

		if (!aInfo.dontExpand) {
			if (
				(
					aParent.getAttribute(this.kSUBTREE_COLLAPSED) == 'true' ||
					children.indexOf('|') < 0 // first child
				) &&
				this.getPref('extensions.treestyletab.autoCollapseExpandSubTreeOnSelect')
				) {
				this.collapseExpandTreesIntelligentlyFor(aChild);
			}
			else if (aParent.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') {
				if (this.getPref('extensions.treestyletab.autoExpandSubTreeOnAppendChild')) {
					var p = aParent;
					do {
						this.collapseExpandTabSubTree(p, false);
					}
					while (p = this.getParentTabOf(p));
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

		if (!aInfo.dontUpdateIndent) this.updateTabsIndent([aChild]);
	},
 
	repudiateTab : function(aChild, aDontUpdateIndent) 
	{
		if (!aChild) return;

		var parentTab = this.getParentTabOf(aChild);
		if (!parentTab) return;

		var id = aChild.getAttribute(this.kID);
		var children = ('|'+parentTab.getAttribute(this.kCHILDREN))
						.replace(new RegExp('\\|'+id), '')
						.replace(/^\|/, '');
		this.setTabValue(parentTab, this.kCHILDREN, children);

		if (!aDontUpdateIndent) this.updateTabsIndent([aChild]);
	},
 
	updateTabsIndent : function(aTabs, aLevel) 
	{
		if (!aTabs || !aTabs.length) return;

		if (aLevel === void(0)) {
			var parentTab = this.getParentTabOf(aTabs[0]);
			var aLevel = 0;
			while (parentTab)
			{
				aLevel++;
				parentTab = this.getParentTabOf(parentTab);
			}
		}

		var indent = (this.levelMargin * aLevel)+'px';
		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			aTabs[i].setAttribute('style', aTabs[i].getAttribute('style')+';margin-left:'+indent+' !important;');
			this.updateTabsIndent(this.getChildTabsOf(aTabs[i]), aLevel+1);
		}
	},
 
	moveTabSubTreeTo : function(aTab, aIndex) 
	{
		if (!aTab) return;

		var b = this.getTabBrowserFromChildren(aTab);
		b.__treestyletab__isSubTreeMoving = true;

		b.moveTabTo(aTab, aIndex);

		var tabs = this.getDescendantTabsOf(aTab);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			b.moveTabTo(tabs[i], aTab._tPos+i+(aTab._tPos < tabs[i]._tPos ? 1 : 0 ));
		}

		b.__treestyletab__isSubTreeMoving = false;
	},
 
	collapseExpandTabSubTree : function(aTab, aCollapse) 
	{
		if (!aTab) return;

		if (aTab.getAttribute(this.kSUBTREE_COLLAPSED) == String(aCollapse)) return;

		this.setTabValue(aTab, this.kSUBTREE_COLLAPSED, aCollapse);

		var tabs = this.getChildTabsOf(aTab);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.collapseExpandTab(tabs[i], aCollapse);
		}
	},
 
	collapseExpandTab : function(aTab, aCollapse) 
	{
		if (!aTab) return;

		this.setTabValue(aTab, this.kCOLLAPSED, aCollapse);

		var b = this.getTabBrowserFromChildren(aTab);
		var p;
		if (aCollapse && aTab == b.selectedTab && (p = this.getParentTabOf(aTab))) {
			b.selectedTab = p;
		}

		var isSubTreeCollapsed = (aTab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true');
		var tabs = this.getChildTabsOf(aTab);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			if (!isSubTreeCollapsed)
				this.collapseExpandTab(tabs[i], aCollapse);
		}
	},
 
	collapseExpandTreesIntelligentlyFor : function(aTab) 
	{
		var b      = this.getTabBrowserFromChildren(aTab);
		var parent = this.getParentTabOf(aTab);
		var expandedParentTabs = [
				aTab.getAttribute(this.kID)
			];
		var parentTab = aTab;
		while (parentTab = this.getParentTabOf(parentTab))
		{
			expandedParentTabs.push(parentTab.getAttribute(this.kID));
		}
		expandedParentTabs = expandedParentTabs.join('|');

		var xpathResult = this.evaluateXPath(
				'child::xul:tab[@'+this.kCHILDREN+' and not(@'+this.kCOLLAPSED+'="true") and not(@'+this.kSUBTREE_COLLAPSED+'="true") and not(contains("'+expandedParentTabs+'", @'+this.kID+'))]',
				b.mTabContainer
			);
		var collapseTab;
		var dontCollapse;
		for (var i = 0, maxi = xpathResult.snapshotLength; i < maxi; i++)
		{
			dontCollapse = false;
			collapseTab  = xpathResult.snapshotItem(i);

			parentTab = this.getParentTabOf(collapseTab);
			if (parentTab) {
				dontCollapse = true;
				do {
					if (parentTab != parent) continue;
					dontCollapse = false;
					break;
				}
				while (parentTab = this.getParentTabOf(parentTab));
			}

			if (!dontCollapse)
				this.collapseExpandTabSubTree(collapseTab, true);
		}

		this.collapseExpandTabSubTree(aTab, false);
	},
  
/* Pref Listener */ 
	
	domain : 'extensions.treestyletab', 
 
	observe : function(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.':
				break;

			default:
				break;
		}
	},
  
/* Save/Load Prefs */ 
	
	get Prefs() 
	{
		if (!this._Prefs) {
			this._Prefs = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
		}
		return this._Prefs;
	},
	_Prefs : null,
 
	getPref : function(aPrefstring) 
	{
		try {
			switch (this.Prefs.getPrefType(aPrefstring))
			{
				case this.Prefs.PREF_STRING:
					return decodeURIComponent(escape(this.Prefs.getCharPref(aPrefstring)));
					break;
				case this.Prefs.PREF_INT:
					return this.Prefs.getIntPref(aPrefstring);
					break;
				default:
					return this.Prefs.getBoolPref(aPrefstring);
					break;
			}
		}
		catch(e) {
		}

		return null;
	},
 
	setPref : function(aPrefstring, aNewValue) 
	{
		var pref = this.Prefs ;
		var type;
		try {
			type = typeof aNewValue;
		}
		catch(e) {
			type = null;
		}

		switch (type)
		{
			case 'string':
				pref.setCharPref(aPrefstring, unescape(encodeURIComponent(aNewValue)));
				break;
			case 'number':
				pref.setIntPref(aPrefstring, parseInt(aNewValue));
				break;
			default:
				pref.setBoolPref(aPrefstring, aNewValue);
				break;
		}
		return true;
	},
 
	clearPref : function(aPrefstring) 
	{
		try {
			this.Prefs.clearUserPref(aPrefstring);
		}
		catch(e) {
		}

		return;
	},
 
	addPrefListener : function(aObserver) 
	{
		var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.addObserver(domains[i], aObserver, false);
		}
		catch(e) {
		}
	},
 
	removePrefListener : function(aObserver) 
	{
		var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.removeObserver(domains[i], aObserver, false);
		}
		catch(e) {
		}
	}
   
}; 

window.addEventListener('load', TreeStyleTabService, false);
window.addEventListener('unload', TreeStyleTabService, false);
 
