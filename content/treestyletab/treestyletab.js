var TreeStyleTabService = { 
	PREFROOT : 'extensions.treestyletab@piro.sakura.ne.jp',

	kID                : 'treestyletab-id',
	kCHILDREN          : 'treestyletab-children',
	kPARENT            : 'treestyletab-parent',
	kINSERT_BEFORE     : 'treestyletab-insert-before',
	kSUBTREE_COLLAPSED : 'treestyletab-subtree-collapsed',
	kCOLLAPSED         : 'treestyletab-collapsed',
	kNEST              : 'treestyletab-nest',
	kDROP_POSITION     : 'treestyletab-drop-position',
	kTABBAR_POSITION   : 'treestyletab-tabbar-position',
	kVERTICAL          : 'treestyletab-vertical',

	kTWISTY                : 'treestyletab-twisty',
	kTWISTY_CONTAINER      : 'treestyletab-twisty-container',
	kDROP_MARKER           : 'treestyletab-drop-marker',
	kDROP_MARKER_CONTAINER : 'treestyletab-drop-marker-container',
	kCOUNTER               : 'treestyletab-counter',
	kCOUNTER_CONTAINER     : 'treestyletab-counter-container',

	kMENUITEM_REMOVESUBTREE_SELECTION : 'multipletab-selection-item-removeTabSubTree',
	kMENUITEM_REMOVESUBTREE_CONTEXT   : 'context-item-removeTabSubTree',

	kFOCUS_ALL     : 0,
	kFOCUS_VISIBLE : 1,

	kDROP_BEFORE : -1,
	kDROP_ON     : 0,
	kDROP_AFTER  : 1,

	kACTION_MOVE   : 1,
	kACTION_ATTACH : 2,
	kACTION_PART   : 4,

	kTABBAR_TOP    : 1,
	kTABBAR_BOTTOM : 2,
	kTABBAR_LEFT   : 4,
	kTABBAR_RIGHT  : 8,

	kTABBAR_HORIZONTAL : 3,
	kTABBAR_VERTICAL   : 12,
	kTABBAR_INVERTED   : 10,

	levelMargin      : 12,
	levelMarginProp  : 'margin-left',
	positionProp     : 'screenY',
	sizeProp         : 'height',
	invertedSizeProp : 'width',

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

	get ObserverService() {
		if (!this._ObserverService) {
			this._ObserverService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);
		}
		return this._ObserverService;
	},
	_ObserverService : null,
	 
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
		var tab = this.getTabFromEvent(aEvent);
		var twisty = document.getAnonymousElementByAttribute(tab, 'class', this.kTWISTY);
		if (!twisty || !tab.hasAttribute(this.kCHILDREN)) return false;

		var box = twisty.parentNode.parentNode.boxObject;
		return !(aEvent.screenX < box.screenX ||
				aEvent.screenX > box.screenX + box.width ||
				aEvent.screenY < box.screenY ||
				aEvent.screenY > box.screenY + box.height);
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
 
	isTabVertical : function(aTabOrChild) 
	{
		var b = this.getTabBrowserFromChildren(aTabOrChild);
		if (!b) return false;
		var box = b.mTabContainer.mTabstrip || b.mTabContainer ;
		return (box.getAttribute('orient') || window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical';
	},
 
	cleanUpTabsArray : function(aTabs) 
	{
		var b = this.getTabBrowserFromChildren(aTabs[0]);

		var self = this;
		aTabs = aTabs.map(function(aTab) { return aTab.getAttribute(self.kID); });
		aTabs.sort();
		aTabs = aTabs.join('|').replace(/([^\|]+)(\|\1)+/g, '$1').split('|');

		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			aTabs[i] = this.getTabById(aTabs[i], b);
		}
		return aTabs;
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
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.levelMargin');

		eval('window.nsBrowserAccess.prototype.openURI = '+
			window.nsBrowserAccess.prototype.openURI.toSource().replace(
				/switch\s*\(aWhere\)/,
				<><![CDATA[
					if (aOpener &&
						aWhere == Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWTAB) {
						(function(aOpener) {
							var ownerBrowser = ('SplitBrowser' in window) ? TreeStyleTabService.getTabBrowserFromChildren(SplitBrowser.getSubBrowserAndBrowserFromFrame(aOpener.top).browser) : gBrowser ;
							var parentTab = TreeStyleTabService.getTabFromFrame(aOpener, ownerBrowser);

							ownerBrowser.__treestyletab__readyToAttachNewTab = true;
							ownerBrowser.__treestyletab__parentTab = parentTab.getAttribute(TreeStyleTabService.kID);
						})(aOpener);
					}
					switch(aWhere)
				]]></>
			)
		);
		window.QueryInterface(Components.interfaces.nsIDOMChromeWindow).browserDOMWindow = null;
		window.QueryInterface(Components.interfaces.nsIDOMChromeWindow).browserDOMWindow = new nsBrowserAccess();

		if ('MultipleTabService' in window) {
			eval('MultipleTabService.showHideMenuItems = '+
				MultipleTabService.showHideMenuItems.toSource().replace(
					/var separators = /,
					<><![CDATA[
						(function(aPopup) {
							var b;
							var item;
							var tabs;
							if (aPopup.id == 'multipletab-selection-menu') {
								b    = MultipleTabService.browser;
								item = document.getElementById(TreeStyleTabService.kMENUITEM_REMOVESUBTREE_SELECTION);
								tabs = MultipleTabService.getSelectedTabs();
							}
							else { // context
								b    = TreeStyleTabService.getTabBrowserFromChildren(aPopup);
								item = TreeStyleTabService.evaluateXPath(
										'descendant::xul:menuitem[starts-with(@id, "'+TreeStyleTabService.kMENUITEM_REMOVESUBTREE_CONTEXT+'")]',
										aPopup,
										XPathResult.FIRST_ORDERED_NODE_TYPE
									).singleNodeValue;
								tabs = [b.mContextTab];
							}

							if (item.getAttribute('hidden') == 'true') return;

							var hasSubTree = false;
							for (var i = 0, maxi = tabs.length; i < maxi; i++)
							{
								if (!tabs[i].hasAttribute(TreeStyleTabService.kCHILDREN)) continue;
								hasSubTree = true;
								break;
							}
							if (hasSubTree)
								item.removeAttribute('hidden');
							else
								item.setAttribute('hidden', true);
						})(aPopup);
						var separators = ]]></>
				)
			);
		}

		this.initTabBrowser(gBrowser);
	},
	 
	initTabBrowser : function(aTabBrowser) 
	{
		this.initTabbarPosition(aTabBrowser, this.getPref('extensions.treestyletab.tabbarPosition'));

		aTabBrowser.mTabContainer.addEventListener('TreeStyleTab:TabOpen', this, true);
		aTabBrowser.mTabContainer.addEventListener('TabClose', this, true);
		aTabBrowser.mTabContainer.addEventListener('TabMove', this, true);
		aTabBrowser.mTabContainer.addEventListener('SSTabRestoring', this, true);
		aTabBrowser.mTabContainer.addEventListener('click', this, true);
		aTabBrowser.mTabContainer.addEventListener('dblclick', this, true);
		aTabBrowser.mTabContainer.addEventListener('mousedown', this, true);
		aTabBrowser.mTabContainer.addEventListener('select', this, true);
		aTabBrowser.mPanelContainer.addEventListener('click', this, true);

		aTabBrowser.__treestyletab__levelMargin = -1;

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
						if (TreeStyleTabService.getPref('extensions.treestyletab.focusMode') == TreeStyleTabService.kFOCUS_VISIBLE) {
							(function(aDir, aWrap, aSelf) {
								var nextTab = (aDir < 0) ? TreeStyleTabService.getPreviousVisibleTab(aSelf.selectedItem) : TreeStyleTabService.getNextVisibleTab(aSelf.selectedItem) ;
								if (!nextTab && aWrap) {
									var xpathResult = TreeStyleTabService.evaluateXPath(
											'child::xul:tab[not(@'+TreeStyleTabService.kCOLLAPSED+'="true")]',
											aSelf
										);
									nextTab = xpathResult.snapshotItem(aDir < 0 ? xpathResult.snapshotLength-1 : 0 );
								}
								if (nextTab && nextTab != aSelf.selectedItem) {
									aSelf.selectNewTab(nextTab, aDir, aWrap);
								}
							})(arguments[0], arguments[1], this);
							return;
						}
				]]></>
			)
		);

		eval('aTabBrowser.mTabContainer._notifyBackgroundTab = '+
			aTabBrowser.mTabContainer._notifyBackgroundTab.toSource().replace(
				/\.screenX/g, '[TreeStyleTabService.positionProp]'
			).replace(
				/\.width/g, '[TreeStyleTabService.sizeProp]'
			)
		);

		eval('aTabBrowser.canDrop = '+
			aTabBrowser.canDrop.toSource().replace(
				/\.screenX/g, '[TreeStyleTabService.positionProp]'
			).replace(
				/\.width/g, '[TreeStyleTabService.sizeProp]'
			).replace(
				/return true;/,
				<><![CDATA[
					if (!(function(aSelf) {
try{
							if (!aDragSession.sourceNode ||
								aDragSession.sourceNode.parentNode != aSelf.mTabContainer ||
								aEvent.target.localName != 'tab')
								return true;

							if (aEvent.target.getAttribute(TreeStyleTabService.kCOLLAPSED) == 'true')
								return false;

							var info = TreeStyleTabService.getDropAction(aEvent, aDragSession);
							return info.canDrop;
}
catch(e) {
	dump('TreeStyleTabService::canDrop\n'+e+'\n');
	return false;
}
						})(this))
						return false;
					return true;
				]]></>
			)
		);

		eval('aTabBrowser.onDragOver = '+
			aTabBrowser.onDragOver.toSource().replace(
				'{',
				<><![CDATA[
					{
						(function(aSelf) {
try{
							var info = TreeStyleTabService.getDropAction(aEvent, aDragSession);

							if (!info.target || info.target != TreeStyleTabService.evaluateXPath(
									'child::xul:tab[@'+TreeStyleTabService.kDROP_POSITION+']',
									aSelf.mTabContainer,
									XPathResult.FIRST_ORDERED_NODE_TYPE
								).singleNodeValue)
								TreeStyleTabService.clearDropPosition(aSelf);

							if (!aSelf.canDrop(aEvent, aDragSession)) return;

							info.target.setAttribute(
								TreeStyleTabService.kDROP_POSITION,
								info.position == TreeStyleTabService.kDROP_BEFORE ? 'before' :
								info.position == TreeStyleTabService.kDROP_AFTER ? 'after' :
								'self'
							);
}
catch(e) {
	dump('TreeStyleTabService::onDragOver\n'+e+'\n');
}
						})(this);
						return;
				]]></>
			)
		);

		eval('aTabBrowser.onDragExit = '+
			aTabBrowser.onDragExit.toSource().replace(
				/(this.mTabDropIndicatorBar\.[^;]+;)/,
				'$1; TreeStyleTabService.clearDropPosition(this);'
			)
		);

		eval('aTabBrowser.onDrop = '+
			aTabBrowser.onDrop.toSource().replace(
				'{', '{ TreeStyleTabService.clearDropPosition(this);'
			).replace(
				/(if \([^\)]+\) \{)/,
				'$1'+<><![CDATA[
					if ((function(aSelf) {
							var info = TreeStyleTabService.getDropAction(aEvent, aDragSession);
							var tab  = aDragSession.sourceNode;
							var tabs = aSelf.mTabContainer.childNodes;
							if (info.action & TreeStyleTabService.kACTION_PART) {
								TreeStyleTabService.partTab(tab);
								if (info.action & TreeStyleTabService.kACTION_MOVE) {
									aSelf.moveTabTo(tab, (info.insertBefore ? info.insertBefore._tPos : tabs.length - 1 ));
								}
								return true;
							}
							else if (info.action & TreeStyleTabService.kACTION_ATTACH) {
								TreeStyleTabService.attachTabTo(tab, info.parent);
								if (info.action & TreeStyleTabService.kACTION_MOVE) {
									aSelf.moveTabTo(tab, info.insertBefore ? info.insertBefore._tPos : tabs.length - 1 );
								}
								return true;
							}
							return false;
						})(this))
						return;
				]]></>
			)
		);

		eval('aTabBrowser.getNewIndex = '+
			aTabBrowser.getNewIndex.toSource().replace(
				/\.screenX/g, '[TreeStyleTabService.positionProp]'
			).replace(
				/\.width/g, '[TreeStyleTabService.sizeProp]'
			)
		);

		eval('aTabBrowser.moveTabForward = '+
			aTabBrowser.moveTabForward.toSource().replace(
				'{', '{ var nextTab;'
			).replace(
				'tabPos < this.browsers.length - 1',
				'nextTab = TreeStyleTabService.getNextSiblingTab(this.mCurrentTab)'
			).replace(
				'tabPos + 1', 'nextTab._tPos'
			).replace(
				'this.moveTabTo(',
				<><![CDATA[
					var descendant = TreeStyleTabService.getDescendantTabs(nextTab);
					if (descendant.length) {
						nextTab = descendant[descendant.length-1];
					}
					this.moveTabTo(]]></>
			).replace(
				'this.moveTabToStart();',
				<><![CDATA[
					var parentTab = TreeStyleTabService.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, TreeStyleTabService.getFirstChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						this.moveTabToStart();
					}
				]]></>
			)
		);

		eval('aTabBrowser.moveTabBackward = '+
			aTabBrowser.moveTabBackward.toSource().replace(
				'{', '{ var prevTab;'
			).replace(
				'tabPos > 0',
				'prevTab = TreeStyleTabService.getPreviousSiblingTab(this.mCurrentTab)'
			).replace(
				'tabPos - 1', 'prevTab._tPos'
			).replace(
				'this.moveTabToEnd();',
				<><![CDATA[
					var parentTab = TreeStyleTabService.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, TreeStyleTabService.getLastChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						this.moveTabToEnd();
					}
				]]></>
			)
		);

		eval('aTabBrowser._keyEventHandler.handleEvent = '+
			aTabBrowser._keyEventHandler.handleEvent.toSource().replace(
				'this.tabbrowser.moveTabOver(aEvent);',
				<><![CDATA[
					if (!TreeStyleTabService.isTabVertical(this.tabbrowser) ||
						!TreeStyleTabService.moveTabLevel(aEvent)) {
						this.tabbrowser.moveTabOver(aEvent);
					}
				]]></>
			).replace(
				'this.tabbrowser.moveTabForward();',
				<><![CDATA[
					if (TreeStyleTabService.isTabVertical(this.tabbrowser) ||
						!TreeStyleTabService.moveTabLevel(aEvent)) {
						this.tabbrowser.moveTabForward();
					}
				]]></>
			).replace(
				'this.tabbrowser.moveTabBackward();',
				<><![CDATA[
					if (TreeStyleTabService.isTabVertical(this.tabbrowser) ||
						!TreeStyleTabService.moveTabLevel(aEvent)) {
						this.tabbrowser.moveTabBackward();
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

		var tabs = aTabBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.initTab(tabs[i], aTabBrowser);
		}

		aTabBrowser.__treestyletab__observer = new TreeStyleTabBrowserObserver(aTabBrowser);

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

		var pos = this.getPref('extensions.treestyletab.tabbarPosition');
		if (pos == 'left' || pos == 'right')
			aTab.setAttribute('align', 'stretch');

		this.initTabContents(aTab);

		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTab:TabOpen', true, false);
		aTab.dispatchEvent(event);
	},
	 
	initTabContents : function(aTab) 
	{
		if (!document.getAnonymousElementByAttribute(aTab, 'class', this.kTWISTY)) {
			var twisty = document.createElement('image');
			twisty.setAttribute('class', this.kTWISTY);
			var container = document.createElement('hbox');
			container.setAttribute('class', this.kTWISTY_CONTAINER);
			container.appendChild(twisty);

			var icon = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-icon');
			icon.appendChild(container);

			var marker = document.createElement('image');
			marker.setAttribute('class', this.kDROP_MARKER);
			container = document.createElement('hbox');
			container.setAttribute('class', this.kDROP_MARKER_CONTAINER);
			container.appendChild(marker);

			icon.appendChild(container);
		}

		if (!document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER)) {
			var counter = document.createElement('hbox');
			counter.setAttribute('class', this.kCOUNTER_CONTAINER);

			counter.appendChild(document.createElement('label'));
			counter.lastChild.setAttribute('class', this.kCOUNTER);
			counter.lastChild.setAttribute('value', '(0)');

			var text = document.getAnonymousElementByAttribute(aTab, 'class', 'tab-text');
			if (text) {
				if (text.nextSibling)
					text.parentNode.insertBefore(counter, text.nextSibling);
				else
					text.parentNode.appendChild(counter);
			}
		}
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
		aTabBrowser.__treestyletab__observer.destroy();
		delete aTabBrowser.__treestyletab__observer;

		var tabs = aTabBrowser.mTabContainer.childNodes;
		var parent;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			parent = this.getParentTab(tabs[i]);
			if (parent)
				this.setTabValue(tabs[i], this.kPARENT, parent.getAttribute(this.kID));
		}

		aTabBrowser.mTabContainer.removeEventListener('TreeStyleTab:TabOpen', this, true);
		aTabBrowser.mTabContainer.removeEventListener('TabClose', this, true);
		aTabBrowser.mTabContainer.removeEventListener('TabMove', this, true);
		aTabBrowser.mTabContainer.removeEventListener('SSTabRestoring', this, true);
		aTabBrowser.mTabContainer.removeEventListener('click', this, true);
		aTabBrowser.mTabContainer.removeEventListener('dblclick', this, true);
		aTabBrowser.mTabContainer.removeEventListener('mousedown', this, true);
		aTabBrowser.mTabContainer.removeEventListener('select', this, true);
		aTabBrowser.mPanelContainer.removeEventListener('click', this, true);
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
				this.onTabMove(aEvent);
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
					b.__treestyletab__readyToAttachNewTab = true;
					b.__treestyletab__parentTab = b.selectedTab.getAttribute(this.kID);
				}
				return;

			case 'dblclick':
				var tab = this.getTabFromEvent(aEvent);
				if (tab &&
					tab.getAttribute(this.kCHILDREN) &&
					this.getPref('extensions.treestyletab.collapseExpandSubTree.dblclick')) {
					this.collapseExpandTabSubTree(tab, tab.getAttribute(this.kSUBTREE_COLLAPSED) != 'true');
					aEvent.preventDefault();
					aEvent.stopPropagation();
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

		if (b.__treestyletab__readyToAttachNewTab) {
			var parent = this.getTabById(b.__treestyletab__parentTab, b);
			if (parent)
				this.attachTabTo(tab, parent);
		}

		b.__treestyletab__readyToAttachNewTab = false;
		b.__treestyletab__parentTab = '';
	},
 
	onTabRemoved : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.getTabBrowserFromChildren(tab);

		if (tab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') {
			var descendant = this.getDescendantTabs(tab);
			for (var i = descendant.length-1; i > -1; i--)
			{
				b.removeTab(descendant[i]);
			}
		}

		var firstChild     = this.getFirstChildTab(tab);
		var parentTab      = this.getParentTab(tab);
		var nextFocusedTab = null;

		if (parentTab) {
			this.setTabValue(tab, this.kPARENT, parentTab.getAttribute(this.kID));
			var next = this.getNextSiblingTab(tab);
			if (next)
				this.setTabValue(tab, this.kINSERT_BEFORE, next.getAttribute(this.kID));
		}

		if (firstChild) {
			var backupChildren = this.getTabValue(tab, this.kCHILDREN);
			var children   = this.getChildTabs(tab);
			var self       = this;
			var attach     = this.getPref('extensions.treestyletab.attachChildrenToGrandParentOnRemoveTab');
			var processTab = !attach ? function(aTab) {
					self.partTab(aTab, true);
					self.moveTabSubTreeTo(aTab, b.mTabContainer.lastChild._tPos);
				} :
				parentTab ? function(aTab) {
					self.attachTabTo(aTab, parentTab, { insertBefore : tab, dontUpdateIndent : true });
				} :
				function(aTab) {
					self.partTab(aTab, true);
				};
			for (var i = 0, maxi = children.length; i < maxi; i++)
			{
				processTab(children[i]);
			}
			this.updateTabsIndent(children);
			this.checkTabsIndentOverflow(b);
			if (attach) {
				nextFocusedTab = firstChild;
			}
			this.setTabValue(tab, this.kCHILDREN, backupChildren);
		}

		if (!nextFocusedTab) {
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
				this.partTab(tab, true);
			}
			else {
				nextFocusedTab = this.getNextSiblingTab(tab);
			}
		}

		if (nextFocusedTab && b.selectedTab == tab)
			b.selectedTab = nextFocusedTab;

		this.checkTabsIndentOverflow(b);
	},
 
	onTabMove : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		this.initTabContents(tab); // twisty vanished after the tab is moved!!

		var b = this.getTabBrowserFromChildren(tab);
		if (tab.getAttribute(this.kCHILDREN) && !b.__treestyletab__isSubTreeMoving) {
			this.moveTabSubTreeTo(tab, tab._tPos);
		}

		var parentTab = this.getParentTab(tab);
		if (parentTab && !b.__treestyletab__isSubTreeChildrenMoving) {
			var children = this.getChildTabs(parentTab);
			children.sort(function(aA, aB) { return aA._tPos - aB._tPos; });
			var self = this;
			this.setTabValue(parentTab, this.kCHILDREN, children.map(function(aItem) { return aItem.getAttribute(self.kID); }).join('|'));
		}
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
					this.attachTabTo(children[i], tab, { dontExpand : true, dontUpdateIndent : true });
					tabs.push(children[i]);
				}
			}
		}

		var parent = this.getTabValue(tab, this.kPARENT);
		var before = this.getTabValue(tab, this.kINSERT_BEFORE);
		if (parent && (parent = this.getTabById(parent, b))) {
			this.attachTabTo(tab, parent, { dontExpand : true, insertBefore : (before ? this.getTabById(before, b) : null ), dontUpdateIndent : true });
			this.deleteTabValue(tab, this.kPARENT);
			this.updateTabsIndent([tab]);
			this.checkTabsIndentOverflow(b);
		}
		else if (children) {
			this.updateTabsIndent(tabs);
			this.checkTabsIndentOverflow(b);
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
			(p = this.getParentTab(tab))) {
			b.selectedTab = p;
		}
*/
		if (tab.getAttribute(this.kCOLLAPSED) == 'true') {
			var parentTab = tab;
			while (parentTab = this.getParentTab(parentTab))
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
 
	getNextVisibleTab : function(aTab) 
	{
		var xpathResult = this.evaluateXPath(
				'following-sibling::xul:tab[not(@'+TreeStyleTabService.kCOLLAPSED+'="true")]',
				aTab
			);
		return xpathResult.snapshotItem(0);
	},
 
	getPreviousVisibleTab : function(aTab) 
	{
		var xpathResult = this.evaluateXPath(
				'preceding-sibling::xul:tab[not(@'+TreeStyleTabService.kCOLLAPSED+'="true")]',
				aTab
			);
		return xpathResult.snapshotItem(xpathResult.snapshotLength-1);
	},
 
/* tree */ 
	
	getRootTabs : function(aTabBrowser) 
	{
		return this.evaluateXPath(
				'child::xul:tab[not(@'+this.kNEST+') or @'+this.kNEST+'="0" or @'+this.kNEST+'=""]',
				aTabBrowser.mTabContainer
			);
	},
 
	getParentTab : function(aTab) 
	{
		var id = aTab.getAttribute(this.kID);
		return this.evaluateXPath(
				'parent::*/child::xul:tab[contains(@'+this.kCHILDREN+', "'+id+'")]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getNextSiblingTab : function(aTab) 
	{
		var id        = aTab.getAttribute(this.kID);
		var parentTab = this.getParentTab(aTab);

		if (!parentTab) {
			var next = aTab;
			do {
				next = next.nextSibling;
			}
			while (next && this.getParentTab(next));
			return next;
		}

		var b        = this.getTabBrowserFromChildren(aTab);
		var children = parentTab.getAttribute(this.kCHILDREN);
		if (children) {
			var list = ('|'+children).split('|'+id)[1].split('|');
			for (var i = 0, maxi = list.length; i < maxi; i++)
			{
				var firstChild = this.getTabById(list[i], b);
				if (firstChild) return firstChild;
			}
		}
		return null;
	},
 
	getPreviousSiblingTab : function(aTab) 
	{
		var id        = aTab.getAttribute(this.kID);
		var parentTab = this.getParentTab(aTab);

		if (!parentTab) {
			var prev = aTab;
			do {
				prev = prev.previousSibling;
			}
			while (prev && this.getParentTab(prev));
			return prev;
		}

		var b        = this.getTabBrowserFromChildren(aTab);
		var children = parentTab.getAttribute(this.kCHILDREN);
		if (children) {
			var list = ('|'+children).split('|'+id)[0].split('|');
			for (var i = list.length-1; i > -1; i--)
			{
				var lastChild = this.getTabById(list[i], b)
				if (lastChild) return lastChild;
			}
		}
		return null;
	},
 
	getChildTabs : function(aTab, aAllTabsArray) 
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
				this.getChildTabs(tab, tabs);
		}

		return tabs;
	},
 
	getDescendantTabs : function(aTab) 
	{
		var tabs = [];
		this.getChildTabs(aTab, tabs);
		return tabs;
	},
 
	getFirstChildTab : function(aTab) 
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
 
	getLastChildTab : function(aTab) 
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
  
	getDropAction : function(aEvent, aDragSession) 
	{
		var info = this.getDropActionInternal(aEvent);
		info.canDrop = true;
		if (info.action & this.kACTION_ATTACH) {
			var orig = aDragSession.sourceNode;
			var tab  = info.target;
			while (tab = this.getParentTab(tab))
			{
				if (tab != orig) continue;
				info.canDrop = false;
				break;
			}
		}
		return info;
	},
	getDropActionInternal : function(aEvent)
	{
		var tab        = aEvent.target;
		var b          = this.getTabBrowserFromChildren(tab);
		var tabs       = b.mTabContainer.childNodes;
		var isInverted = this.isTabVertical(b) ? false : window.getComputedStyle(b.parentNode, null).direction == 'ltr';
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
	[TARGET  ] Å™part from parent, and move

	  [      ]
	[TARGET  ] Å™attach to the parent of the previous visible, and move

	[        ]
	[TARGET  ] Å™attach to the parent of the target, and move

	[        ]
	  [TARGET] Å™attach to the parent of the targetm and move
*/
				var prevTab = this.getPreviousVisibleTab(tab);
				if (!prevTab) {
					info.action       = this.kACTION_MOVE | this.kACTION_PART;
					info.insertBefore = tabs[0];
				}
				else {
					var prevNest   = Number(prevTab.getAttribute(this.kNEST));
					var targetNest = Number(tab.getAttribute(this.kNEST));
					info.action       = this.kACTION_MOVE | this.kACTION_ATTACH;
					info.parent       = (
							(prevNest < targetNest) ? this.getParentTab(prevTab) :
							(prevNest > targetNest) ? prevTab :
							this.getParentTab(tab)
						) || tab ;
					info.insertBefore = tab;
				}
				break;

			case this.kDROP_AFTER:
/*
	[TARGET  ] Å´part from parent, and move

	  [TARGET] Å´attach to the parent of the target, and move
	[        ]

	[TARGET  ] Å´attach to the parent of the target, and move
	[        ]

	[TARGET  ] Å´attach to the target, and move
	  [      ]
*/
				var nextTab = this.getNextVisibleTab(tab);
				if (!nextTab) {
					info.action = this.kACTION_MOVE | this.kACTION_PART;
				}
				else {
					var targetNest = Number(tab.getAttribute(this.kNEST));
					var nextNest   = Number(nextTab.getAttribute(this.kNEST));
					info.action       = this.kACTION_MOVE | this.kACTION_ATTACH;
					info.parent       = (
							(targetNest < nextNest) ? tab :
							this.getParentTab(tab)
						) || tab ;
					info.insertBefore = nextTab;
				}
				break;
		}

		return info;
	},
 
	clearDropPosition : function(aTabBrowser) 
	{
		var b = this.getTabBrowserFromChildren(aTabBrowser);
		var xpathResult = this.evaluateXPath(
				'child::xul:tab[@'+this.kDROP_POSITION+']',
				b.mTabContainer
			);
		for (var i = 0, maxi = xpathResult.snapshotLength; i < maxi; i++)
		{
			xpathResult.snapshotItem(i).removeAttribute(this.kDROP_POSITION);
		}
	},
  
/* Commands */ 
	 
	initTabbarPosition : function(aTabBrowser, aPosition) 
	{
		aPosition = String(aPosition).toLowerCase();
		var pos = (aPosition == 'left') ? this.kTABBAR_LEFT :
			(aPosition == 'right') ? this.kTABBAR_RIGHT :
			(aPosition == 'bottom') ? this.kTABBAR_BOTTOM :
			this.kTABBAR_TOP;

		if (pos & this.kTABBAR_VERTICAL) {
			this.positionProp     = 'screenY';
			this.sizeProp         = 'height';
			this.invertedSizeProp = 'width';

			aTabBrowser.mTabBox.orient = 'horizontal';
			aTabBrowser.mTabContainer.orient = aTabBrowser.mTabContainer.mTabstrip.orient = 'vertical';

			aTabBrowser.setAttribute(this.kVERTICAL, true);
			aTabBrowser.setAttribute(this.kTABBAR_POSITION, 'left');
		}
		else {
			this.positionProp     = 'screenX';
			this.sizeProp         = 'width';
			this.invertedSizeProp = 'height';

			aTabBrowser.mTabBox.orient = 'vertical';
			aTabBrowser.mTabContainer.orient = aTabBrowser.mTabContainer.mTabstrip.orient = 'horizontal';

			aTabBrowser.removeAttribute(this.kVERTICAL);
			aTabBrowser.setAttribute(this.kTABBAR_POSITION, 'top');
		}
	},
 
/* attach/part */ 
	
	attachTabTo : function(aChild, aParent, aInfo) 
	{
		if (!aChild || !aParent || this.getParentTab(aChild) == aParent) return;
		if (!aInfo) aInfo = {};

		var id = aChild.getAttribute(this.kID);
		var b  = this.getTabBrowserFromChildren(aParent);

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
		this.updateTabsCount(aParent);

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
				var p = aParent;
				do {
					this.collapseExpandTabSubTree(p, false);
				}
				while (p = this.getParentTab(p));
			}
			else if (aParent.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') {
				if (this.getPref('extensions.treestyletab.autoExpandSubTreeOnAppendChild')) {
					var p = aParent;
					do {
						this.collapseExpandTabSubTree(p, false);
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
			this.checkTabsIndentOverflow(b);
		}
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
		this.updateTabsCount(parentTab);

		if (!aDontUpdateIndent) {
			this.updateTabsIndent([aChild]);
			this.checkTabsIndentOverflow(b);
		}
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

		if (!aProp) aProp = this.levelMarginProp;

		var b      = this.getTabBrowserFromChildren(aTabs[0]);
		var margin = b.__treestyletab__levelMargin < 0 ? this.levelMargin : b.__treestyletab__levelMargin ;
		var indent = margin * aLevel;

		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			aTabs[i].setAttribute('style', aTabs[i].getAttribute('style')+'; margin: 0 !important; '+aProp+':'+indent+'px !important;');
			aTabs[i].setAttribute(this.kNEST, aLevel);
			this.updateTabsIndent(this.getChildTabs(aTabs[i]), aLevel+1, aProp);
		}
	},
 
	updateAllTabsIndent : function(aTabBrowser) 
	{
		var b = this.getTabBrowserFromChildren(aTabBrowser);
		this.updateTabsIndent(
			this.getArrayFromXPathResult(
				this.getRootTabs(b)
			),
			0
		);
//		this.checkTabsIndentOverflow(b);
	},
 
	checkTabsIndentOverflow : function(aTabBrowser) 
	{
		if (this.checkTabsIndentOverflowTimer) {
			window.clearTimeout(this.checkTabsIndentOverflowTimer);
			this.checkTabsIndentOverflowTimer = null;
		}
		this.checkTabsIndentOverflowTimer = window.setTimeout(function(aSelf, aTabBrowser) {
			aSelf.checkTabsIndentOverflowCallback(aTabBrowser);
		}, 100, this, aTabBrowser);
	},
	checkTabsIndentOverflowTimer : null,
	checkTabsIndentOverflowCallback : function(aTabBrowser)
	{
		var b    = aTabBrowser;
		var tabs = this.getArrayFromXPathResult(this.evaluateXPath(
				'child::xul:tab[@'+this.kNEST+' and not(@'+this.kNEST+'="0" or @'+this.kNEST+'="")]',
				b.mTabContainer
			));
		if (!tabs.length) return;

		var self = this;
		tabs.sort(function(aA, aB) { return Number(aA.getAttribute(self.kNEST)) - Number(aB.getAttribute(self.kNEST)); });
		var nest = tabs[tabs.length-1].getAttribute(self.kNEST);
		if (!nest) return;

		var oldMargin = b.__treestyletab__levelMargin;
		var indent    = (oldMargin < 0 ? this.levelMargin : oldMargin ) * nest;
		var maxIndent = b.mTabContainer.childNodes[0].boxObject[this.invertedSizeProp] * 0.33;

		var marginUnit = Math.max(Math.floor(maxIndent / nest), 1);
		if (indent > maxIndent) {
			b.__treestyletab__levelMargin = marginUnit;
		}
		else {
			b.__treestyletab__levelMargin = -1;
			if ((this.levelMargin * nest) > maxIndent)
				b.__treestyletab__levelMargin = marginUnit;
		}

		if (oldMargin != b.__treestyletab__levelMargin) {
			this.updateAllTabsIndent(b);
		}
	},
 
	updateTabsCount : function(aTab) 
	{
		var count = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER);
		if (count) {
			count.setAttribute('value', '('+this.getDescendantTabs(aTab).length+')');
		}
		var parent = this.getParentTab(aTab);
		if (parent)
			this.updateTabsCount(parent);
	},
  
/* move */ 
	
	moveTabSubTreeTo : function(aTab, aIndex) 
	{
		if (!aTab) return;

		var b = this.getTabBrowserFromChildren(aTab);
		b.__treestyletab__isSubTreeMoving = true;

		b.moveTabTo(aTab, aIndex);

		b.__treestyletab__isSubTreeChildrenMoving = true;
		var tabs = this.getDescendantTabs(aTab);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			b.moveTabTo(tabs[i], aTab._tPos+i+(aTab._tPos < tabs[i]._tPos ? 1 : 0 ));
		}
		b.__treestyletab__isSubTreeChildrenMoving = false;

		b.__treestyletab__isSubTreeMoving = false;
	},
 
	moveTabLevel : function(aEvent) 
	{
		var b = this.getTabBrowserFromChildren(aEvent.target);
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
				this.attachTabTo(b.mCurrentTab, grandParent, { insertBefore : this.getNextSiblingTab(parentTab) });
				b.mCurrentTab.focus();
				return true;
			}
			else {
				var nextTab = this.getNextSiblingTab(parentTab);
				this.partTab(b.mCurrentTab);
				if (nextTab) {
					b.moveTabTo(b.mCurrentTab, nextTab._tPos - 1);
				}
				else {
					b.moveTabTo(b.mCurrentTab, b.mTabContainer.lastChild._tPos);
				}
				b.mCurrentTab.focus();
				return true;
			}
		}
		return false;
	},
  
/* collapse/expand */ 
	
	collapseExpandTabSubTree : function(aTab, aCollapse) 
	{
		if (!aTab) return;

		if ((aTab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') == aCollapse) return;

		var b = this.getTabBrowserFromChildren(aTab);
		b.__treestyletab__doingCollapseExpand = true;

		this.setTabValue(aTab, this.kSUBTREE_COLLAPSED, aCollapse);

		var tabs = this.getChildTabs(aTab);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.collapseExpandTab(tabs[i], aCollapse);
		}

		b.__treestyletab__doingCollapseExpand = false;
	},
 
	collapseExpandTab : function(aTab, aCollapse) 
	{
		if (!aTab) return;

		this.setTabValue(aTab, this.kCOLLAPSED, aCollapse);

		var b = this.getTabBrowserFromChildren(aTab);
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
		var b = this.getTabBrowserFromChildren(aTab);
		if (b.__treestyletab__doingCollapseExpand) return;

		var parent = this.getParentTab(aTab);
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
				'child::xul:tab[@'+this.kCHILDREN+' and not(@'+this.kCOLLAPSED+'="true") and not(@'+this.kSUBTREE_COLLAPSED+'="true") and not(contains("'+expandedParentTabs+'", @'+this.kID+'))]',
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
				do {
					if (parentTab != parent) continue;
					dontCollapse = false;
					break;
				}
				while (parentTab = this.getParentTab(parentTab));
			}

			if (!dontCollapse)
				this.collapseExpandTabSubTree(collapseTab, true);
		}

		this.collapseExpandTabSubTree(aTab, false);
	},
  
	removeTabSubTree : function(aTabOrTabs) 
	{
		var tabs = aTabOrTabs;
		if (!(tabs instanceof Array)) {
			tabs = [aTabOrTabs];
		}

		var descendant = [];
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			descendant = descendant.concat(this.getDescendantTabs(tabs[i]));
		}
		tabs = this.cleanUpTabsArray(tabs.concat(descendant));

		var max = tabs.length;
		if (!max) return;

		var b = this.getTabBrowserFromChildren(tabs[0]);
		if (
			max > 1 &&
			!b.warnAboutClosingTabs(true, max)
			)
			return;

		for (var i = tabs.length-1; i > -1; i--)
		{
			b.removeTab(tabs[i]);
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
			case 'extensions.treestyletab.levelMargin':
				this.levelMargin = value;
				this.ObserverService.notifyObservers(null, 'TreeStyleTab:levelMarginModified', value);
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
 
function TreeStyleTabBrowserObserver(aTabBrowser) 
{
	this.mTabBrowser = aTabBrowser;
	TreeStyleTabService.ObserverService.addObserver(this, 'TreeStyleTab:levelMarginModified', false);
	TreeStyleTabService.addPrefListener(this);
}
TreeStyleTabBrowserObserver.prototype = {
	domain      : 'extensions.treestyletab',
	mTabBrowser : null,
	observe : function(aSubject, aTopic, aData)
	{
		switch (aTopic)
		{
			case 'TreeStyleTab:levelMarginModified':
				if (this.mTabBrowser.__treestyletab__levelMargin > -1) {
					TreeStyleTabService.updateAllTabsIndent(this.mTabBrowser);
				}
				break;

			case 'nsPref:changed':
				var value = TreeStyleTabService.getPref(aData);
				switch (aData)
				{
					case 'extensions.treestyletab.tabbarPosition':
						TreeStyleTabService.initTabbarPosition(this.mTabBrowser, value);
						break;

					default:
						break;
				}
				break;

			default:
				break;
		}
	},
	destroy : function()
	{
		TreeStyleTabService.ObserverService.removeObserver(this, 'TreeStyleTab:levelMarginModified');
		TreeStyleTabService.removePrefListener(this);
		delete this.mTabBrowser;
	}
};
 	
