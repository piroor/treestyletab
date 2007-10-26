var TreeStyleTabService = { 
	PREFROOT : 'extensions.treestyletab@piro.sakura.ne.jp',

	kID                 : 'treestyletab-id',
	kCHILDREN           : 'treestyletab-children',
	kPARENT             : 'treestyletab-parent',
	kINSERT_BEFORE      : 'treestyletab-insert-before',
	kSUBTREE_COLLAPSED  : 'treestyletab-subtree-collapsed',
	kCOLLAPSED          : 'treestyletab-collapsed',
	kNEST               : 'treestyletab-nest',
	kDROP_POSITION      : 'treestyletab-drop-position',
	kTABBAR_POSITION    : 'treestyletab-tabbar-position',
	kMODE               : 'treestyletab-mode',
	kUI_INVERTED        : 'treestyletab-appearance-inverted',
	kSCROLLBAR_INVERTED : 'treestyletab-scrollbar-inverted',
	kALLOW_COLLAPSE     : 'treestyletab-allow-subtree-collapse',
	kSTYLE              : 'treestyletab-style',
	kFIRSTTAB_BORDER    : 'treestyletab-firsttab-border',

	kTWISTY                : 'treestyletab-twisty',
	kTWISTY_CONTAINER      : 'treestyletab-twisty-container',
	kDROP_MARKER           : 'treestyletab-drop-marker',
	kDROP_MARKER_CONTAINER : 'treestyletab-drop-marker-container',
	kCOUNTER               : 'treestyletab-counter',
	kCOUNTER_CONTAINER     : 'treestyletab-counter-container',
	kSPLITTER              : 'treestyletab-splitter',

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

	get IOService() {
		if (!this._IOService) {
			this._IOService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		}
		return this._IOService;
	},
	_IOService : null,
	 
/* API */ 
	
	readyToOpenChildTab : function(aFrameOrTabBrowser, aMultiple) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.__treestyletab__readyToAttachNewTab   = true;
		ownerBrowser.__treestyletab__readyToAttachMultiple = aMultiple || false ;
		ownerBrowser.__treestyletab__parentTab             = this.getTabFromFrame(frame, ownerBrowser).getAttribute(this.kID);
	},
 
	readyToOpenNewTabGroup : function(aFrameOrTabBrowser) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		this.stopToOpenChildTab(frame);

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.__treestyletab__readyToAttachNewTabGroup = true;
		ownerBrowser.__treestyletab__readyToAttachMultiple    = true;
	},
 
	stopToOpenChildTab : function(aFrameOrTabBrowser) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.__treestyletab__readyToAttachNewTab      = false;
		ownerBrowser.__treestyletab__readyToAttachNewTabGroup = false;
		ownerBrowser.__treestyletab__readyToAttachMultiple    = false;
		ownerBrowser.__treestyletab__parentTab                = null;
	},
 
	checkToOpenChildTab : function(aFrameOrTabBrowser) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return false;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		return ownerBrowser.__treestyletab__readyToAttachNewTab || ownerBrowser.__treestyletab__readyToAttachNewTabGroup ? true : false ;
	},
  
/* Utilities */ 
	 
	isEventFiredOnTwisty : function(aEvent) 
	{
		var tab = this.getTabFromEvent(aEvent);
		if (!tab) return false;

		return tab.hasAttribute(this.kCHILDREN) && this.evaluateXPath(
				'ancestor-or-self::*[@class="'+this.kTWISTY+'" or @class="tab-icon"]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue ? true : false ;
	},
 
	get browser() 
	{
		return 'SplitBrowser' in window && this.getTreePref('inSubbrowsers.enabled')  ? SplitBrowser.activeBrowser : gBrowser ;
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
		return this.evaluateXPath(
				'ancestor-or-self::xul:tab',
				aEvent.originalTarget || aEvent.target, XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
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

		return this.evaluateXPath(
				'ancestor-or-self::xul:tabbrowser',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabBrowserFromFrame : function(aFrame) 
	{
		return ('SplitBrowser' in window) ? this.getTabBrowserFromChildren(SplitBrowser.getSubBrowserAndBrowserFromFrame(aFrame.top).browser) : gBrowser ;
	},
 
	getFrameFromTabBrowserElements : function(aFrameOrTabBrowser) 
	{
		var frame = aFrameOrTabBrowser;
		if (frame == '[object XULElement]') {
			if (frame.localName == 'tab') {
				frame = frame.linkedBrowser.contentWindow;
			}
			else if (frame.localName == 'browser') {
				frame = frame.contentWindow;
			}
			else {
				frame = this.getTabBrowserFromChildren(frame);
				if (!frame) return null;
				frame = frame.contentWindow;
			}
		}
		if (!frame)
			frame = this.browser.contentWindow;

		return frame;
	},
 
	isTabVertical : function(aTabOrChild) 
	{
		var b = this.getTabBrowserFromChildren(aTabOrChild);
		if (!b) return false;
		var box = b.mTabContainer.mTabstrip || b.mTabContainer ;
		return (box.getAttribute('orient') || window.getComputedStyle(box, '').getPropertyValue('-moz-box-orient')) == 'vertical';
	},
 
	isTabInViewport : function(aTab) 
	{
		if (!aTab) return false;
		var tabBox = aTab.boxObject;
		var barBox = this.getTabBrowserFromChildren(aTab).mTabContainer.mTabstrip.boxObject;
		return (tabBox.screenX >= barBox.screenX &&
			tabBox.screenX + tabBox.width <= barBox.screenX + barBox.width &&
			tabBox.screenY >= barBox.screenY &&
			tabBox.screenY + tabBox.height <= barBox.screenY + barBox.height);
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
 
	makeURIFromSpec : function(aURI) 
	{
		var newURI;
		aURI = aURI || '';
		if (aURI && String(aURI).indexOf('file:') == 0) {
			var fileHandler = this.IOService.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler);
			var tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
			newURI = this.IOService.newFileURI(tempLocalFile);
		}
		else {
			newURI = this.IOService.newURI(aURI, null, null);
		}
		return newURI;
	},
  
/* Initializing */ 
	 
	init : function() 
	{
		if (!('gBrowser' in window)) return;

		window.removeEventListener('load', this, false);

		document.getElementById('contentAreaContextMenu').addEventListener('popupshowing', this, false);

		if (this.getTreePref('inSubbrowsers.enabled')) {
			var appcontent = document.getElementById('appcontent');
			appcontent.addEventListener('SubBrowserAdded', this, false);
			appcontent.addEventListener('SubBrowserRemoveRequest', this, false);
		}

		this.addPrefListener(this);
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.levelMargin');

		this.overrideGlobalFunctions();
		this.overrideExtensions(); // hacks.js

		this.initTabBrowser(gBrowser);
	},
	 
	initTabBrowser : function(aTabBrowser) 
	{
		this.initTabbar(aTabBrowser);

		aTabBrowser.mTabContainer.addEventListener('TreeStyleTab:TabOpen', this, true);
		aTabBrowser.mTabContainer.addEventListener('TabClose', this, true);
		aTabBrowser.mTabContainer.addEventListener('TabMove', this, true);
		aTabBrowser.mTabContainer.addEventListener('SSTabRestoring', this, true);
		aTabBrowser.mTabContainer.addEventListener('click', this, true);
		aTabBrowser.mTabContainer.addEventListener('dblclick', this, true);
		aTabBrowser.mTabContainer.addEventListener('mousedown', this, true);
		aTabBrowser.mTabContainer.addEventListener('select', this, true);
//		aTabBrowser.mPanelContainer.addEventListener('click', this, true);

		aTabBrowser.__treestyletab__levelMargin = -1;

		var selectNewTab = '_selectNewTab' in aTabBrowser.mTabContainer ? '_selectNewTab' : 'selectNewTab' ; // Fx3 / Fx2

		eval('aTabBrowser.mTabContainer.'+selectNewTab+' = '+
			aTabBrowser.mTabContainer[selectNewTab].toSource().replace(
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
						if (TreeStyleTabService.getTreePref('focusMode') == TreeStyleTabService.kFOCUS_VISIBLE) {
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

		eval('aTabBrowser.mTabContainer._handleTabSelect = '+
			aTabBrowser.mTabContainer._handleTabSelect.toSource().replace(
				/\{/,
				<><![CDATA[
					{
						if (!TreeStyleTabService.isTabInViewport(this.selectedItem)) {
							TreeStyleTabService.scrollToTab(this.selectedItem);
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
						if ((function(aSelf) {
try{
							var info = TreeStyleTabService.getDropAction(aEvent, aDragSession);

							if (!info.target || info.target != TreeStyleTabService.evaluateXPath(
									'child::xul:tab[@'+TreeStyleTabService.kDROP_POSITION+']',
									aSelf.mTabContainer,
									XPathResult.FIRST_ORDERED_NODE_TYPE
								).singleNodeValue)
								TreeStyleTabService.clearDropPosition(aSelf);

							if (!aSelf.canDrop(aEvent, aDragSession)) return true;

							info.target.setAttribute(
								TreeStyleTabService.kDROP_POSITION,
								info.position == TreeStyleTabService.kDROP_BEFORE ? 'before' :
								info.position == TreeStyleTabService.kDROP_AFTER ? 'after' :
								'self'
							);
							aSelf.mTabDropIndicatorBar.setAttribute('dragging', (info.position == TreeStyleTabService.kDROP_ON) ? 'false' : 'true' );
							return (info.position == TreeStyleTabService.kDROP_ON || aSelf.getAttribute(TreeStyleTabService.kTABBAR_POSITION) != 'top')
}
catch(e) {
	dump('TreeStyleTabService::onDragOver\n'+e+'\n');
}
						})(this)) {
							return;
						}
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
				'{',
				<><![CDATA[
					{
						TreeStyleTabService.clearDropPosition(this);
						var dropActionInfo = TreeStyleTabService.getDropAction(aEvent, aDragSession);
				]]></>
			).replace(
				/(if \([^\)]+\) \{)/,
				'$1'+<><![CDATA[
					if (TreeStyleTabService.processDropAction(dropActionInfo, this, aDragSession.sourceNode))
						return;
				]]></>
			).replace(
				/(this.loadOneTab\([^;]+\));/,
				<><![CDATA[
					TreeStyleTabService.processDropAction(dropActionInfo, this, $1);
					return;
				]]></>
			).replace(
				'document.getBindingParent(aEvent.originalTarget).localName != "tab"',
				'!TreeStyleTabService.getTabFromEvent(aEvent)'
			).replace(
				'var tab = aEvent.target;',
				<><![CDATA[
					var tab = aEvent.target;
					if (TreeStyleTabService.getTreePref('loadDroppedLinkToNewChildTab') ||
						dropActionInfo.position != TreeStyleTabService.kDROP_ON) {
						TreeStyleTabService.processDropAction(dropActionInfo, this, this.loadOneTab(getShortcutOrURI(url), null, null, null, bgLoad, false));
						return;
					}
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
					this.__treestyletab__internallyTabMoving = true;
					var parentTab = TreeStyleTabService.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, TreeStyleTabService.getFirstChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						this.moveTabToStart();
					}
					this.__treestyletab__internallyTabMoving = false;
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
					this.__treestyletab__internallyTabMoving = true;
					var parentTab = TreeStyleTabService.getParentTab(this.mCurrentTab);
					if (parentTab) {
						this.moveTabTo(this.mCurrentTab, TreeStyleTabService.getLastChildTab(parentTab)._tPos);
						this.mCurrentTab.focus();
					}
					else {
						this.moveTabToEnd();
					}
					this.__treestyletab__internallyTabMoving = false;
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

		eval('aTabBrowser.loadTabs = '+
			aTabBrowser.loadTabs.toSource().replace(
				'var tabNum = ',
				<><![CDATA[
					if (this.__treestyletab__readyToAttachNewTabGroup)
						TreeStyleTabService.readyToOpenChildTab(firstTabAdded || this.selectedTab, true);
					var tabNum = ]]></>
			).replace(
				'if (!aLoadInBackground)',
				<><![CDATA[
					if (TreeStyleTabService.checkToOpenChildTab(this))
						TreeStyleTabService.stopToOpenChildTab(this);
					if (!aLoadInBackground)]]></>
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
		aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.style');
		aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.showBorderForFirstTab');
		aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.invertScrollbar');
		aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.allowSubtreeCollapseExpand');

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

		var pos = this.getTreePref('tabbar.position');
		if (pos == 'left' || pos == 'right') {
			aTab.setAttribute('align', 'stretch');
			aTab.maxWidth = 65000;
			aTab.minWidth = 0;
		}

		this.initTabContents(aTab);

		aTab.setAttribute(this.kNEST, 0);

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
  
	overrideGlobalFunctions : function() 
	{
		var funcs;

		eval('window.BrowserLoadURL = '+
			window.BrowserLoadURL.toSource().replace(
				'{',
				<><![CDATA[
					{
						var currentURI = TreeStyleTabService.browser.currentURI;
						var parentTab  = TreeStyleTabService.getParentTab(TreeStyleTabService.browser.selectedTab);
				]]></>
			).replace(
				'aTriggeringEvent && aTriggeringEvent.altKey',
				<><![CDATA[
					(aTriggeringEvent && aTriggeringEvent.altKey) ||
					(
						/^\w+:\/\/([^:\/]+)(\/|$)/.test(url) &&
						(
							(
								TreeStyleTabService.getTreePref('urlbar.loadSameDomainToNewChildTab') &&
								currentURI.host == RegExp.$1 &&
								(TreeStyleTabService.readyToOpenChildTab(
									parentTab && parentTab.linkedBrowser.currentURI.host == RegExp.$1 ?
										parentTab :
										null
								), true)
							) ||
							(
								TreeStyleTabService.getTreePref('urlbar.loadSameDomainToNewChildTab') &&
								currentURI.host != RegExp.$1
							)
						)
					)
				]]></>
			)
		);

		eval('nsContextMenu.prototype.openLinkInTab = '+
			nsContextMenu.prototype.openLinkInTab.toSource().replace(
				'{',
				<><![CDATA[
					{
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
				]]></>
			)
		);
		eval('nsContextMenu.prototype.openFrameInTab = '+
			nsContextMenu.prototype.openFrameInTab.toSource().replace(
				'{',
				<><![CDATA[
					{
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
				]]></>
			)
		);
		eval('nsContextMenu.prototype.viewImage = '+
			nsContextMenu.prototype.viewImage.toSource().replace(
				'openUILink(',
				<><![CDATA[
					if (String(whereToOpenLink(e, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					openUILink(]]></>
			)
		);
		eval('nsContextMenu.prototype.viewBGImage = '+
			nsContextMenu.prototype.viewBGImage.toSource().replace(
				'openUILink(',
				<><![CDATA[
					if (String(whereToOpenLink(e, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					openUILink(]]></>
			)
		);
		eval('nsContextMenu.prototype.addDictionaries = '+
			nsContextMenu.prototype.addDictionaries.toSource().replace(
				'openUILinkIn(',
				<><![CDATA[
					if (where.indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					openUILinkIn(]]></>
			)
		);

		funcs = 'handleLinkClick __splitbrowser__handleLinkClick __ctxextensions__handleLinkClick'.split(' ');
		for (var i in funcs)
		{
			if (funcs[i] in window)
				eval('window.'+funcs[i]+' = '+
					window[funcs[i]].toSource().replace(
						/openNewTabWith\(/g,
						<><![CDATA[
							TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView);
							openNewTabWith(]]></>
					)
				);
		}

		funcs = 'gotoHistoryIndex BrowserForward BrowserBack __rewindforward__BrowserForward __rewindforward__BrowserBack'.split(' ');
		for (var i in funcs)
		{
			if (funcs[i] in window)
				eval('window.'+funcs[i]+' = '+
					window[funcs[i]].toSource().replace(
						/openUILinkIn\(/g,
						<><![CDATA[
							if (where == 'tab' || where == 'tabshifted')
								TreeStyleTabService.readyToOpenChildTab();
							openUILinkIn(]]></>
					)
				);
		}

		eval('window.BrowserHomeClick = '+
			window.BrowserHomeClick.toSource().replace(
				'gBrowser.loadTabs(',
				<><![CDATA[
					TreeStyleTabService.readyToOpenNewTabGroup(gBrowser);
					gBrowser.loadTabs(]]></>
			)
		);

		eval('nsBrowserAccess.prototype.openURI = '+
			nsBrowserAccess.prototype.openURI.toSource().replace(
				/switch\s*\(aWhere\)/,
				<><![CDATA[
					if (aOpener &&
						aWhere == Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWTAB) {
						TreeStyleTabService.readyToOpenChildTab(aOpener);
					}
					switch(aWhere)
				]]></>
			)
		);
		window.QueryInterface(Components.interfaces.nsIDOMChromeWindow).browserDOMWindow = null;
		window.QueryInterface(Components.interfaces.nsIDOMChromeWindow).browserDOMWindow = new nsBrowserAccess();

		eval('FeedHandler.loadFeed = '+
			FeedHandler.loadFeed.toSource().replace(
				'openUILink(',
				<><![CDATA[
					if (String(whereToOpenLink(event, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(gBrowser);
					openUILink(]]></>
			)
		);

		if ('BookmarksCommand' in window) { // Firefox 2
			eval('BookmarksCommand.openGroupBookmark = '+
				BookmarksCommand.openGroupBookmark.toSource().replace(
					'browser.addTab(uri);',
					<><![CDATA[
						var openedTab = browser.addTab(uri);
						if (!TreeStyleTabService.getPref('browser.tabs.loadFolderAndReplace') &&
							TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree') &&
							!browser.__treestyletab__parentTab) {
							TreeStyleTabService.readyToOpenChildTab(openedTab, true);
						}
					]]></>
				).replace(
					'if (index == index0)',
					<><![CDATA[
						TreeStyleTabService.stopToOpenChildTab(browser);
						if (index == index0)]]></>
				)
			);
		}

		if ('PlacesUtils' in window) { // Firefox 3
			eval('PlacesUtils.openContainerNodeInTabs = '+
				PlacesUtils.openContainerNodeInTabs.toSource().replace(
					'this._openTabset(',
					<><![CDATA[
						if (TreeStyleTabService.getTreePref('openGroupBookmarkAsTabSubTree') &&
							String(whereToOpenLink(aEvent, false, true)).indexOf('tab') == 0)
							TreeStyleTabService.readyToOpenNewTabGroup();
						this._openTabset(]]></>
				)
			);
		}
	},
 	 
	destroy : function() 
	{
		this.destroyTabBrowser(gBrowser);

		window.removeEventListener('unload', this, false);

		document.getElementById('contentAreaContextMenu').removeEventListener('popupshowing', this, false);

		if (this.getTreePref('inSubbrowsers.enabled')) {
			var appcontent = document.getElementById('appcontent');
			appcontent.removeEventListener('SubBrowserAdded', this, false);
			appcontent.removeEventListener('SubBrowserRemoveRequest', this, false);
		}

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

		aTabBrowser.mTabContainer.removeEventListener('TreeStyleTab:TabOpen', this, true);
		aTabBrowser.mTabContainer.removeEventListener('TabClose', this, true);
		aTabBrowser.mTabContainer.removeEventListener('TabMove', this, true);
		aTabBrowser.mTabContainer.removeEventListener('SSTabRestoring', this, true);
		aTabBrowser.mTabContainer.removeEventListener('click', this, true);
		aTabBrowser.mTabContainer.removeEventListener('dblclick', this, true);
		aTabBrowser.mTabContainer.removeEventListener('mousedown', this, true);
		aTabBrowser.mTabContainer.removeEventListener('select', this, true);
//		aTabBrowser.mPanelContainer.removeEventListener('click', this, true);
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
/*
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
					this.readyToOpenChildTab(b.selectedTab);
				}
*/
				return;

			case 'dblclick':
				var tab = this.getTabFromEvent(aEvent);
				if (tab &&
					tab.getAttribute(this.kCHILDREN) &&
					this.getTreePref('collapseExpandSubTree.dblclick')) {
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
				if (aEvent.target != aEvent.currentTarget) return;
				this.initContextMenu();
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

		if (!b.__treestyletab__readyToAttachMultiple) {
			this.stopToOpenChildTab(b);
		}
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

		var rebuildTreeDone = false;

		var b = this.getTabBrowserFromChildren(tab);
		if (tab.getAttribute(this.kCHILDREN) && !b.__treestyletab__isSubTreeMoving) {
			this.moveTabSubTreeTo(tab, tab._tPos);
			rebuildTreeDone = true;
		}

		var parentTab = this.getParentTab(tab);
		if (parentTab && !b.__treestyletab__isSubTreeChildrenMoving) {
			this.updateChildrenArray(parentTab);
		}

		if (
			rebuildTreeDone ||
			b.__treestyletab__isSubTreeMoving ||
			b.__treestyletab__internallyTabMoving
			)
			return;

		var nest     = Number(tab.getAttribute(this.kNEST) || 0);
		var parent     = this.getParentTab(tab);
		var prevParent = this.getParentTab(tab.previousSibling);
		var nextParent = this.getParentTab(tab.nextSibling);
		var prevNest   = tab.previousSibling ? Number(tab.previousSibling.getAttribute(this.kNEST)) : -1 ;
		var nextNest   = tab.nextSibling ? Number(tab.nextSibling.getAttribute(this.kNEST)) : -1 ;

		if (
			!tab.previousSibling || !tab.nextSibling ||
			prevParent == nextParent ||
			prevNest > nextNest
			) {
			if (prevParent)
				this.attachTabTo(tab, prevParent, { insertBefore : tab.nextSibling });
			else
				this.partTab(tab);
		}
		else if (prevNest < nextNest) {
			this.attachTabTo(tab, tab.previousSibling, { insertBefore : tab.nextSibling });
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
		if (parent) {
			parent = this.getTabById(parent, b);
			if (parent) {
				this.attachTabTo(tab, parent, { dontExpand : true, insertBefore : (before ? this.getTabById(before, b) : null ), dontUpdateIndent : true });
				this.updateTabsIndent([tab]);
				this.checkTabsIndentOverflow(b);
			}
			else {
				this.deleteTabValue(tab, this.kPARENT);
			}
		}
		else if (children) {
			this.updateTabsIndent(tabs);
			this.checkTabsIndentOverflow(b);
		}

		if (!parent && (before = this.getTabById(before, b))) {
			var index = before._tPos;
			if (index > tab._tPos) index--;
			b.__treestyletab__internallyTabMoving = true;
			b.moveTabTo(tab, index);
			b.__treestyletab__internallyTabMoving = false;
		}
		this.deleteTabValue(tab, this.kINSERT_BEFORE);

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
				this.getTreePref('autoCollapseExpandSubTreeOnSelect')) {
			this.collapseExpandTreesIntelligentlyFor(tab);
		}
	},
 
	onTabbarResized : function(aEvent) 
	{
		var b = this.getTabBrowserFromChildren(aEvent.originalTarget);
		this.setPref('extensions.treestyletab.tabbar.width', b.mStrip.boxObject.width);
	},
 
	processDropAction : function(aInfo, aTabBrowser, aTarget) 
	{
		var b    = this.getTabBrowserFromChildren(aTabBrowser);
		var tabs = b.mTabContainer.childNodes;
		if (aTarget && aInfo.action & this.kACTION_PART) {
			this.partTab(aTarget);
		}
		else if (aInfo.action & this.kACTION_ATTACH) {
			if (aInfo.parent)
				this.attachTabTo(aTarget, aInfo.parent);
			else
				this.partTab(aTarget);
		}
		else {
			return false;
		}

		if (
			aInfo.action & this.kACTION_MOVE &&
			(
				!aInfo.insertBefore ||
				this.getNextVisibleTab(aTarget) != aInfo.insertBefore
			)
			) {
			var newIndex = aInfo.insertBefore ? aInfo.insertBefore._tPos : tabs.length - 1 ;
			if (aInfo.insertBefore && newIndex > aTarget._tPos) newIndex--;
			b.__treestyletab__internallyTabMoving = true;
			b.moveTabTo(aTarget,  newIndex);
			b.__treestyletab__internallyTabMoving = false;
		}
		return true;
	},
 
	initContextMenu : function() 
	{
		var item = document.getElementById('context-treestyletab-openSelectionLinks');
		var sep  = document.getElementById('context-treestyletab-openSelectionLinks-separator');
		if (this.getTreePref('show.openSelectionLinks') && this.getSelectionLinks().length) {
			item.removeAttribute('hidden');
			sep.removeAttribute('hidden');
		}
		else {
			item.setAttribute('hidden', true);
			sep.setAttribute('hidden', true);
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
		if (!aTab) return null;
		return this.evaluateXPath(
				'parent::*/child::xul:tab[contains(@'+this.kCHILDREN+', "'+aTab.getAttribute(this.kID)+'")]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getNextSiblingTab : function(aTab) 
	{
		if (!aTab) return null;

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
		if (!aTab) return null;

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
		var tabs = [];
		if (!aTab) return null;

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
		if (!aTab) return null;

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
		if (!aTab) return null;

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
		if (info.action & this.kACTION_ATTACH &&
			aDragSession &&
			aDragSession.sourceNode &&
			aDragSession.sourceNode.localName == 'tab') {
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
		return info;
	},
	getDropActionInternal : function(aEvent)
	{
		var tab        = aEvent.target;
		var b          = this.getTabBrowserFromChildren(tab);
		var tabs       = b.mTabContainer.childNodes;
		var isInverted = this.isTabVertical(b) ? false : window.getComputedStyle(b.parentNode, null).direction == 'rtl';
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
					var prevNest   = Number(prevTab.getAttribute(this.kNEST));
					var targetNest = Number(tab.getAttribute(this.kNEST));
					info.parent       = (prevNest < targetNest) ? prevTab : this.getParentTab(tab) ;
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
					var nextNest   = Number(nextTab.getAttribute(this.kNEST));
					info.parent       = (targetNest < nextNest) ? tab : this.getParentTab(tab) ;
					info.action       = this.kACTION_MOVE | (info.parent ? this.kACTION_ATTACH : this.kACTION_PART );
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
	
	initTabbar : function(aTabBrowser, aPosition) 
	{
		if (!aPosition) aPosition = this.getTreePref('tabbar.position');
		aPosition = String(aPosition).toLowerCase();
		var pos = (aPosition == 'left') ? this.kTABBAR_LEFT :
			(aPosition == 'right') ? this.kTABBAR_RIGHT :
			(aPosition == 'bottom') ? this.kTABBAR_BOTTOM :
			this.kTABBAR_TOP;

		var splitter = document.getAnonymousElementByAttribute(aTabBrowser, 'class', this.kSPLITTER);
		if (!splitter) {
			splitter = document.createElement('splitter');
			splitter.setAttribute('class', this.kSPLITTER);
			splitter.setAttribute('onmouseup', 'TreeStyleTabService.onTabbarResized(event);');
			splitter.appendChild(document.createElement('grippy'));
			var ref = aTabBrowser.mPanelContainer;
			ref.parentNode.insertBefore(splitter, ref);
		}

		var scrollInnerBox = document.getAnonymousNodes(aTabBrowser.mTabContainer.mTabstrip._scrollbox)[0];

		if (pos & this.kTABBAR_VERTICAL) {
			this.positionProp     = 'screenY';
			this.sizeProp         = 'height';
			this.invertedSizeProp = 'width';

			aTabBrowser.mTabBox.orient = 'horizontal';
			aTabBrowser.mTabContainer.orient = aTabBrowser.mTabContainer.mTabstrip.orient = 'vertical';
			scrollInnerBox.removeAttribute('flex');

			aTabBrowser.mPanelContainer.removeAttribute('width');
			aTabBrowser.mStrip.setAttribute('width', this.getTreePref('tabbar.width'));

			aTabBrowser.setAttribute(this.kMODE, 'vertical');
			if (pos == this.kTABBAR_RIGHT) {
				aTabBrowser.setAttribute(this.kTABBAR_POSITION, 'right');
				if (this.getTreePref('tabbar.invertUI')) {
					aTabBrowser.setAttribute(this.kUI_INVERTED, 'true');
					this.levelMarginProp = 'margin-right';
				}
				else {
					aTabBrowser.removeAttribute(this.kUI_INVERTED);
					this.levelMarginProp = 'margin-left';
				}
				window.setTimeout(function() {
					aTabBrowser.mTabDropIndicatorBar.setAttribute('ordinal', 1);
					aTabBrowser.mStrip.setAttribute('ordinal', 30);
					splitter.setAttribute('ordinal', 20);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 10);
				}, 0);
			}
			else {
				aTabBrowser.setAttribute(this.kTABBAR_POSITION, 'left');
				aTabBrowser.removeAttribute(this.kUI_INVERTED);
				this.levelMarginProp = 'margin-left';
				window.setTimeout(function() {
					aTabBrowser.mTabDropIndicatorBar.setAttribute('ordinal', 1);
					aTabBrowser.mStrip.setAttribute('ordinal', 10);
					splitter.setAttribute('ordinal', 20);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 30);
				}, 0);
			}
		}
		else {
			this.positionProp     = 'screenX';
			this.sizeProp         = 'width';
			this.invertedSizeProp = 'height';

			aTabBrowser.mTabBox.orient = 'vertical';
			aTabBrowser.mTabContainer.orient = aTabBrowser.mTabContainer.mTabstrip.orient = 'horizontal';
			scrollInnerBox.setAttribute('flex', 1);

			aTabBrowser.mStrip.removeAttribute('width');
			aTabBrowser.mPanelContainer.removeAttribute('width');

			aTabBrowser.setAttribute(this.kMODE, this.getTreePref('tabbar.multirow') ? 'multirow' : 'horizontal' );
			aTabBrowser.removeAttribute(this.kUI_INVERTED);
			if (pos == this.kTABBAR_BOTTOM) {
				aTabBrowser.setAttribute(this.kTABBAR_POSITION, 'bottom');
				this.levelMarginProp = 'margin-bottom';
				window.setTimeout(function() {
					aTabBrowser.mTabDropIndicatorBar.setAttribute('ordinal', 1);
					aTabBrowser.mStrip.setAttribute('ordinal', 30);
					splitter.setAttribute('ordinal', 20);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 10);
				}, 0);
			}
			else {
				aTabBrowser.setAttribute(this.kTABBAR_POSITION, 'top');
				this.levelMarginProp = 'margin-top';
				window.setTimeout(function() {
					aTabBrowser.mTabDropIndicatorBar.setAttribute('ordinal', 1);
					aTabBrowser.mStrip.setAttribute('ordinal', 10);
					splitter.setAttribute('ordinal', 20);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 30);
				}, 0);
			}
		}
	},
 
/* attach/part */ 
	
	attachTabTo : function(aChild, aParent, aInfo) 
	{
		if (
			!aChild ||
			!aParent ||
			aChild == aParent ||
			this.getParentTab(aChild) == aParent
			)
			return;

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
					this.collapseExpandTabSubTree(p, false);
				}
				while (p = this.getParentTab(p));
			}
			else if (aParent.getAttribute(this.kSUBTREE_COLLAPSED) == 'true') {
				if (this.getTreePref('autoExpandSubTreeOnAppendChild')) {
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
			var b = this.getTabBrowserFromChildren(aChild);
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

		if (!aProp) {
			aProp = this.getTreePref('enableSubtreeIndent') ? this.levelMarginProp : 0 ;
		}

		var b      = this.getTabBrowserFromChildren(aTabs[0]);
		var margin = b.__treestyletab__levelMargin < 0 ? this.levelMargin : b.__treestyletab__levelMargin ;
		var indent = margin * aLevel;

		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			aTabs[i].setAttribute('style', aTabs[i].getAttribute('style').replace(/margin(-[^:]+):[^;]+;?/g, '')+'; '+aProp+':'+indent+'px !important;');
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

		b.__treestyletab__internallyTabMoving = true;
		b.moveTabTo(aTab, aIndex);
		b.__treestyletab__internallyTabMoving = false;

		b.__treestyletab__isSubTreeChildrenMoving = true;
		b.__treestyletab__internallyTabMoving     = true;
		var tabs = this.getDescendantTabs(aTab);
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			b.moveTabTo(tabs[i], aTab._tPos+i+(aTab._tPos < tabs[i]._tPos ? 1 : 0 ));
		}
		b.__treestyletab__internallyTabMoving     = false;
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
				b.__treestyletab__internallyTabMoving = true;
				if (nextTab) {
					b.moveTabTo(b.mCurrentTab, nextTab._tPos - 1);
				}
				else {
					b.moveTabTo(b.mCurrentTab, b.mTabContainer.lastChild._tPos);
				}
				b.__treestyletab__internallyTabMoving = false;
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

		if (!aCollapse)
			this.scrollToTabSubTree(aTab);

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
				this.collapseExpandTabSubTree(collapseTab, true);
		}

		this.collapseExpandTabSubTree(aTab, false);
	},
  
/* scroll */ 
	
	scrollTo : function(aTabBrowser, aEndX, aEndY) 
	{
		if (this.getTreePref('tabbar.scroll.smooth'))
			this.smoothScrollTo(aTabBrowser, aEndX, aEndY);
		else
			this.getTabBrowserFromChildren(aTabBrowser).mTabstrip.scrollBoxObject.scrollTo(aEndX, aEndY);
	},
	 
	smoothScrollTo : function(aTabBrowser, aEndX, aEndY) 
	{
		var b = this.getTabBrowserFromChildren(aTabBrowser);

		if (b.__treestyletab__smoothScrollTimer) {
			window.clearInterval(b.__treestyletab__smoothScrollTimer);
			b.__treestyletab__smoothScrollTimer = null;
		}

		var scrollBoxObject = b.mTabContainer.mTabstrip.scrollBoxObject;
		var x = {}, y = {};
		scrollBoxObject.getPosition(x, y);
		b.__treestyletab__smoothScrollTimer = window.setInterval(
			this.smoothScrollToCallback,
			10,
			this,
			b,
			x.value,
			y.value,
			aEndX,
			aEndY,
			Date.now(),
			this.getTreePref('tabbar.scroll.timeout')
		);
	},
 
	smoothScrollToCallback : function(aSelf, aTabBrowser, aStartX, aStartY, aEndX, aEndY, aStartTime, aTimeout) 
	{
		var newX = aStartX + parseInt(
				(aEndX - aStartX) * ((Date.now() - aStartTime) / aTimeout)
			);
		var newY = aStartY + parseInt(
				(aEndY - aStartY) * ((Date.now() - aStartTime) / aTimeout)
			);

		var scrollBoxObject = aTabBrowser.mTabContainer.mTabstrip.scrollBoxObject;
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
			if (aTabBrowser.__treestyletab__smoothScrollTimer) {
				window.clearInterval(aTabBrowser.__treestyletab__smoothScrollTimer);
				aTabBrowser.__treestyletab__smoothScrollTimer = null;
			}
			return;
		}

		scrollBoxObject.scrollTo(newX, newY);
	},
  
	scrollToTab : function(aTab) 
	{
		if (!aTab || this.isTabInViewport(aTab)) return;

		var b = this.getTabBrowserFromChildren(aTab);

		var scrollBoxObject = b.mTabContainer.mTabstrip.scrollBoxObject;
		var w = {}, h = {};
		scrollBoxObject.getScrolledSize(w, h);

		var targetTabBox = aTab.boxObject;
		var baseTabBox = aTab.parentNode.firstChild.boxObject;

		var targetX = (aTab.boxObject.screenX < scrollBoxObject.screenX) ?
			(targetTabBox.screenX - baseTabBox.screenX) - (targetTabBox.width * 0.5) :
			(targetTabBox.screenX - baseTabBox.screenX) - scrollBoxObject.width + (targetTabBox.width * 1.5) ;

		var targetY = (aTab.boxObject.screenY < scrollBoxObject.screenY) ?
			(targetTabBox.screenY - baseTabBox.screenY) - (targetTabBox.height * 0.5) :
			(targetTabBox.screenY - baseTabBox.screenY) - scrollBoxObject.height + (targetTabBox.height * 1.5) ;

		this.scrollTo(b, targetX, targetY);
	},
 
	scrollToTabSubTree : function(aTab) 
	{
		var b          = this.getTabBrowserFromChildren(aTab);
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
			var endX = this.isTabVertical(aTab) ? 0 : endPos ;
			var endY = this.isTabVertical(aTab) ? endPos : 0 ;
			this.scrollTo(b, endX, endY);
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
 
	openSelectionLinks : function() 
	{
		var links = this.getSelectionLinks();
		if (!links.length) return;

		var b = this.browser;
		var targetWindow = document.commandDispatcher.focusedWindow;
		if (!targetWindow || targetWindow.top == window)
			targetWindow = b.contentWindow;

		var referrer = this.makeURIFromSpec(targetWindow.location.href);

		this.readyToOpenChildTab(targetWindow, true);
		var self = this;
		links.forEach(function(aItem, aIndex) {
			var tab = b.addTab(aItem.uri, referrer);
			if (aIndex == 0 && !self.getPref('browser.tabs.loadInBackground'))
				b.selectedTab = tab;
		});
		this.stopToOpenChildTab(targetWindow);
	},
	 
	getSelectionLinks : function() 
	{
		var links = [];

		var targetWindow = document.commandDispatcher.focusedWindow;
		if (!targetWindow || targetWindow.top == window)
			targetWindow = this.browser.contentWindow;

		var selection = targetWindow.getSelection();
		if (!selection || !selection.rangeCount)
			return links;

		const count = selection.rangeCount;
		var range,
			node,
			link,
			uri,
			nodeRange = targetWindow.document.createRange();
		for (var i = 0; i < count; i++)
		{
			range = selection.getRangeAt(0);
			node  = range.startContainer;

			traceTree:
			while (true)
			{
				nodeRange.selectNode(node);

				// 「ノードの終端が、選択範囲の先端より後にあるかどうか」をチェック。
				// 後にあるならば、そのノードは選択範囲内にあると考えられる。
				if (nodeRange.compareBoundaryPoints(Range.START_TO_END, range) > -1) {
					// 「ノードの先端が、選択範囲の終端より後にあるかどうか」をチェック。
					// 後にあるならば、そのノードは選択範囲外にあると考えられる。
					if (nodeRange.compareBoundaryPoints(Range.END_TO_START, range) > 0) {
						// 「リンクテキストが実際には選択されていないリンク」については除外する
						if (
							links.length &&
							range.startContainer.nodeType != Node.ELEMENT_NODE &&
							range.startOffset == range.startContainer.nodeValue.length &&
							links[0].node == this.getParentLink(range.startContainer)
							)
							links.splice(0, 1);

						if (
							links.length &&
							range.endContainer.nodeType != Node.ELEMENT_NODE &&
							range.endOffset == 0 &&
							links[links.length-1].node == this.getParentLink(range.endContainer)
							)
							links.splice(links.length-1, 1);
						break;
					}
					else if (link = this.getParentLink(node)) {
						try {
							uri = link.href;
							if (uri && uri.indexOf('mailto:') < 0)
								links.push({ node : link, uri : uri });
						}
						catch(e) {
						}
					}
				}

				if (node.hasChildNodes() && !link) {
					node = node.firstChild;
				}
				else {
					while (!node.nextSibling)
					{
						node = node.parentNode;
						if (!node) break traceTree;
					}
					node = node.nextSibling;
				}
			}
		}

		nodeRange.detach();

		return links;
	},
	 
	getParentLink : function(aNode) 
	{
		var node = aNode;
		while (!node.href && node.parentNode)
			node = node.parentNode;

		return node.href ? node : null ;
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
 
	getTreePref : function(aPrefstring) 
	{
		return this.getPref('extensions.treestyletab.'+aPrefstring);
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
					case 'extensions.treestyletab.tabbar.position':
						if (value != 'left' && value != 'right') {
							var container = this.mTabBrowser.mTabContainer;
							Array.prototype.slice.call(container.childNodes).forEach(function(aTab) {
								aTab.removeAttribute('align');
								aTab.maxWidth = 250;
								aTab.minWidth = container.mTabMinWidth;
							});
						}
					case 'extensions.treestyletab.tabbar.multirow':
					case 'extensions.treestyletab.tabbar.invertUI':
						TreeStyleTabService.initTabbar(this.mTabBrowser);
						TreeStyleTabService.updateAllTabsIndent(this.mTabBrowser);
						break;

					case 'extensions.treestyletab.enableSubtreeIndent':
						TreeStyleTabService.updateAllTabsIndent(this.mTabBrowser);
						break;

					case 'extensions.treestyletab.tabbar.style':
						this.mTabBrowser.setAttribute(TreeStyleTabService.kSTYLE, value);
						break;

					case 'extensions.treestyletab.showBorderForFirstTab':
						if (value)
							this.mTabBrowser.setAttribute(TreeStyleTabService.kFIRSTTAB_BORDER, true);
						else
							this.mTabBrowser.removeAttribute(TreeStyleTabService.kFIRSTTAB_BORDER);
						break;

					case 'extensions.treestyletab.tabbar.invertScrollbar':
						if (value &&
							TreeStyleTabService.getTreePref('tabbar.position') == 'left')
							this.mTabBrowser.setAttribute(TreeStyleTabService.kSCROLLBAR_INVERTED, true);
						else
							this.mTabBrowser.removeAttribute(TreeStyleTabService.kSCROLLBAR_INVERTED);
						break;

					case 'extensions.treestyletab.allowSubtreeCollapseExpand':
						if (value)
							this.mTabBrowser.setAttribute(TreeStyleTabService.kALLOW_COLLAPSE, true);
						else
							this.mTabBrowser.removeAttribute(TreeStyleTabService.kALLOW_COLLAPSE);
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
 
