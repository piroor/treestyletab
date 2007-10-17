var TreeStyleTabService = { 
	PREFROOT : 'extensions.treestyletab@piro.sakura.ne.jp',

	kID       : 'treestyletab-id',
	kCHILDREN : 'treestyletab-children',

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
 
	get browser() 
	{
		return 'SplitBrowser' ? SplitBrowser.activeBrowser : gBrowser ;
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
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:menuseparator',
					aPopup,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
					null
				);
		}
		catch(e) {
			return { snapshotLength : 0 };
		}
		return xpathResult;
	},
 
	getObsoleteSeparator : function(aPopup) 
	{
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:menuseparator[not(@hidden)][not(following-sibling::*[not(@hidden)]) or not(preceding-sibling::*[not(@hidden)]) or local-name(following-sibling::*[not(@hidden)]) = "menuseparator"]',
					aPopup,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
		}
		catch(e) {
			return null;
		}
		return xpathResult.singleNodeValue;
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
		aTabBrowser.mPanelContainer.addEventListener('click', this, true);


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

		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTab:TabOpen', true, false);
		aTab.dispatchEvent(event);
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
		aTabBrowser.mTabContainer.removeEventListener('TreeStyleTab:TabOpen', this, true);
		aTabBrowser.mTabContainer.removeEventListener('TabClose', this, true);
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
				break;

			case 'TabClose':
				this.onTabRemoved(aEvent);
				break;

			case 'click':
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
				break;

			case 'load':
				this.init();
				break;

			case 'unload':
				this.destroy();
				break;

			case 'popupshowing':
//				this.showHideMenuItems(aEvent.target);
				break;

			case 'SubBrowserAdded':
				this.initTabBrowser(aEvent.originalTarget.browser);
				break;

			case 'SubBrowserRemoveRequest':
				this.destroyTabBrowser(aEvent.originalTarget.browser);
				break;
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
		var tab            = aEvent.originalTarget;
		var b              = this.getTabBrowserFromChildren(tab);
		var firstChild     = this.getFirstChildTabOf(tab);
		var parentTab      = this.getParentTabOf(tab);
		var nextFocusedTab = null;

		if (firstChild) {
			var children   = this.getChildTabsOf(tab);
			var self       = this;
			var adoption   = this.getPref('extensions.treestyletab.adoptChildrenToGrandParentOnRemoveTab');
			var processTab = !adoption ? function(aTab) {
					self.repudiateTab(aTab);
					self.moveTabSubTreeTo(aTab, b.mTabContainer.lastChild._tPos);
				} :
				parentTab ? function(aTab) {
					self.adoptTabTo(aTab, parentTab, tab);
				} :
				function(aTab) {
					self.repudiateTab(aTab);
				};
			for (var i = 0, maxi = children.length; i < maxi; i++)
			{
				processTab(children[i]);
			}
			if (adoption) {
				nextFocusedTab = firstChild;
			}
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
			}
			else {
				nextFocusedTab = this.getNextSiblingTabOf(tab);
			}
		}

		if (nextFocusedTab)
			b.selectedTab = nextFocusedTab;
	},
 
	onTabClick : function(aEvent) 
	{
		if (aEvent.button != 0) return;

		var tab = this.getTabFromEvent(aEvent);
		if (tab) {
			var b = this.getTabBrowserFromChildren(tab);
			if (aEvent.shiftKey) {
				var tabs = b.mTabContainer.childNodes;
				var inSelection = false;
				for (var i = 0, maxi = tabs.length; i < maxi; i++)
				{
					if (tabs[i] == b.selectedTab ||
						tabs[i] == tab) {
						inSelection = !inSelection;
						this.setSelection(tabs[i], true);
					}
					else {
						this.setSelection(tabs[i], inSelection);
					}
				}
				aEvent.preventDefault();
				aEvent.stopPropagation();
				return;
			}
			else if (aEvent.ctrlKey || aEvent.metaKey) {
				if (this.tabClickMode != this.TAB_CLICK_MODE_TOGGLE) return;

				if (!this.selectionModified && !this.hasSelection())
					this.setSelection(b.selectedTab, true);

				this.toggleSelection(tab);
				aEvent.preventDefault();
				aEvent.stopPropagation();
				return;
			}
		}
		if (this.selectionModified && !this.hasSelection())
			this.selectionModified = false;

		this.clearSelection();
	},
  
/* Tab Utilities */ 
	 
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
		try {
			var xpathResult = document.evaluate(
					'descendant::xul:tab[@'+this.kID+' = "'+aId+'"]',
					aTabBrowser.mTabContainer,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
		}
		catch(e) {
			return null;
		}
		return xpathResult.singleNodeValue;
	},
 
	getParentTabOf : function(aTab) 
	{
		var id = aTab.getAttribute(this.kID);
		try {
			var xpathResult = document.evaluate(
					'parent::*/child::xul:tab[contains(@'+this.kCHILDREN+', "'+id+'")]',
					aTab,
					this.NSResolver, // document.createNSResolver(document.documentElement),
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				);
		}
		catch(e) {
			return null;
		}
		return xpathResult.singleNodeValue;
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
			children = '|'+children;
			var originalChildren = children;
			var list = children.split('|'+id)[1].split('|');
			for (var i = 0, maxi = list.length; i < maxi; i++)
			{
				firstChild = this.getTabById(list[i], b);
				if (firstChild) break;
				if (list[i]) children = children.replace('|'+list[i], '');
			}
			if (children != originalChildren)
				this.setTabValue(parentTab, this.kCHILDREN, children.replace(/^\|/, ''));
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
			children = '|'+children;
			var originalChildren = children;
			var list = children.split('|'+id)[0].split('|');
			for (var i = list.length-1; i > -1; i--)
			{
				lastChild = this.getTabById(list[i], b)
				if (lastChild) break;
				if (list[i]) children = children.replace('|'+list[i], '');
			}
			if (children != originalChildren)
				this.setTabValue(parentTab, this.kCHILDREN, children.replace(/^\|/, ''));
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
		children = '|'+children;
		var originalChildren = children;
		for (var i = 0, maxi = list.length; i < maxi; i++)
		{
			tab = this.getTabById(list[i], b)
			if (tab) {
				tabs.push(tab);
				if (aAllTabsArray)
					this.getChildTabsOf(tab, tabs);
			}
			else {
				children = children.replace('|'+list[i], '');
			}
		}
		if (children != originalChildren)
			this.setTabValue(aTab, this.kCHILDREN, children.replace(/^\|/, ''));

		return tabs;
	},
 
	getFirstChildTabOf : function(aTab) 
	{
		var b          = this.getTabBrowserFromChildren(aTab);
		var children   = aTab.getAttribute(this.kCHILDREN);
		var firstChild = null;
		if (children) {
			var list = children.split('|');
			children = '|'+children;
			var originalChildren = children;
			for (var i = 0, maxi = list.length; i < maxi; i++)
			{
				firstChild = this.getTabById(list[i], b)
				if (firstChild) break;
				children = children.replace('|'+list[i], '');
			}
			if (children != originalChildren)
				this.setTabValue(aTab, this.kCHILDREN, children.replace(/^\|/, ''));
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
			children = '|'+children;
			var originalChildren = children;
			for (var i = list.length-1; i > -1; i--)
			{
				lastChild = this.getTabById(list[i], b)
				if (lastChild) break;
				children = children.replace('|'+list[i], '');
			}
			if (children != originalChildren)
				this.setTabValue(aTab, this.kCHILDREN, children.replace(/^\|/, ''));
		}
		return lastChild;
	},
  
/* Commands */ 
	 
	adoptTabTo : function(aChild, aParent, aInsertBefore) 
	{
		var id = aChild.getAttribute(this.kID);
		var b  = this.getTabBrowserFromChildren(aParent);

		this.repudiateTab(aChild, true);

		var children = aParent.getAttribute(this.kCHILDREN);
		var newIndex;

		var beforeTab = aInsertBefore ? aInsertBefore.getAttribute(this.kID) : null ;
		if (aInsertBefore && children.indexOf(beforeTab) > -1) {
			children = children.replace(new RegExp(beforeTab), id+'|'+beforeTab);
			newIndex = aInsertBefore._tPos;
		}
		else {
			children = ((children || '')+'|'+id).replace(/^\|/, '');
			var lastChild = this.getLastChildTabOf(aParent);
			newIndex = (lastChild ? lastChild : aParent )._tPos+1;
		}

		this.setTabValue(aParent, this.kCHILDREN, children);

		if (newIndex > aChild._tPos) newIndex--;
		b.moveTabTo(aChild, newIndex);

		this.updateTabsIndent([aChild]);
	},
 
	repudiateTab : function(aChild, aDontUpdateIndent) 
	{
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
		var tabs = this.getDescendantTabsOf(aTab);

		var b = this.getTabBrowserFromChildren(aTab);
		b.moveTabTo(aTab, aIndex);

		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			b.moveTabTo(tabs[i], aTab._tPos+i+1);
		}
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
 
