var TreeStyleTabService = { 
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
	kHIDE_ALLTABS       : 'treestyletab-hide-alltabs-button',
	kSTYLE              : 'treestyletab-style',
	kFIRSTTAB_BORDER    : 'treestyletab-firsttab-border',
	kAUTOHIDE           : 'treestyletab-tabbar-autohide',

	kTWISTY                : 'treestyletab-twisty',
	kTWISTY_CONTAINER      : 'treestyletab-twisty-container',
	kDROP_MARKER           : 'treestyletab-drop-marker',
	kDROP_MARKER_CONTAINER : 'treestyletab-drop-marker-container',
	kCOUNTER               : 'treestyletab-counter',
	kCOUNTER_CONTAINER     : 'treestyletab-counter-container',
	kSPLITTER              : 'treestyletab-splitter',

	kMENUITEM_REMOVESUBTREE_SELECTION : 'multipletab-selection-item-removeTabSubTree',
	kMENUITEM_REMOVESUBTREE_CONTEXT   : 'context-item-removeTabSubTree',
	kMENUITEM_AUTOHIDE_CONTEXT        : 'context-item-toggleAutoHide',
	kMENUITEM_AUTOHIDE_SEPARATOR_CONTEXT : 'context-separator-toggleAutoHide',

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

	kINSERT_FISRT : 0,
	kINSERT_LAST  : 1,

	levelMargin          : 12,
	levelMarginProp      : 'margin-left',
	positionProp         : 'screenY',
	sizeProp             : 'height',
	invertedPositionProp : 'screenX',
	invertedSizeProp     : 'width',

	tabbarResizing : false,

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

	get isGecko18() {
		var version = this.XULAppInfo.platformVersion.split('.');
		return parseInt(version[0]) <= 1 && parseInt(version[1]) <= 8;
	},

	get XULAppInfo() {
		if (!this._XULAppInfo) {
			this._XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1'].getService(Components.interfaces.nsIXULAppInfo);
		}
		return this._XULAppInfo;
	},
	_XULAppInfo : null,
	 
/* API */ 
	
	readyToOpenChildTab : function(aFrameOrTabBrowser, aMultiple, aInsertBefore) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.__treestyletab__readyToAttachNewTab   = true;
		ownerBrowser.__treestyletab__readyToAttachMultiple = aMultiple || false ;
		ownerBrowser.__treestyletab__multipleCount         = 0;
		ownerBrowser.__treestyletab__parentTab             = this.getTabFromFrame(frame, ownerBrowser).getAttribute(this.kID);
		ownerBrowser.__treestyletab__insertBefore          = aInsertBefore ? aInsertBefore.getAttribute(this.kID) : null ;
	},
 
	readyToOpenNewTabGroup : function(aFrameOrTabBrowser) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		this.stopToOpenChildTab(frame);

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.__treestyletab__readyToAttachNewTabGroup = true;
		ownerBrowser.__treestyletab__readyToAttachMultiple    = true;
		ownerBrowser.__treestyletab__multipleCount            = 0;
	},
 
	stopToOpenChildTab : function(aFrameOrTabBrowser) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.__treestyletab__readyToAttachNewTab      = false;
		ownerBrowser.__treestyletab__readyToAttachNewTabGroup = false;
		ownerBrowser.__treestyletab__readyToAttachMultiple    = false;
		ownerBrowser.__treestyletab__multipleCount            = 0;
		ownerBrowser.__treestyletab__parentTab                = null;
		ownerBrowser.__treestyletab__insertBefore             = null;
	},
 
	checkToOpenChildTab : function(aFrameOrTabBrowser) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return false;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		return ownerBrowser.__treestyletab__readyToAttachNewTab || ownerBrowser.__treestyletab__readyToAttachNewTabGroup ? true : false ;
	},
 
	checkReadyToOpenNewTab : function(aInfo) 
	{
/*
	挙動の説明

	・現在のサイトと異なるサイトを読み込む場合にタブを開く時：
	  →特に何もしない。新しく開くタブを子タブにする場合は別途
	    readyToOpenChildTabを使う。

	・現在のサイトと同じサイトのページを読み込む場合にタブを開く時：
	  →親のタブは同じサイトか？
	    No ：子タブを開く
	    Yes：兄弟としてタブを開く。ただし、このタブからのタブはすべて
	         現在のタブと次の兄弟タブとの間に開かれ、仮想サブツリーとなる。
	         →現在のタブに「__treestyletab__next」プロパティが
	           あるか？
	           Yes：__treestyletab__nextで示されたタブの直前に
	                新しい兄弟タブを挿入する。
	           No ：現在のタブの次の兄弟タブのIDを__treestyletab__next
	                プロパティに保持し、仮想の子タブを挿入する位置の
	                基準とする。
*/

		var info = aInfo || { uri : '' };
		if (/^javascript:/.test(info.uri)) return false;

		var frame = this.getFrameFromTabBrowserElements(info.target);
		if (!frame) return false;

		var external = info.external || {};
		var internal = info.internal || {};

		var targetHost  = /^\w+:\/\/([^:\/]+)(\/|$)/.test(info.uri) ? RegExp.$1 : null ;
		var currentTab  = this.getTabFromFrame(frame);
		var currentURI  = frame.location.href;
		var currentHost = currentURI.match(/^\w+:\/\/([^:\/]+)(\/|$)/) ? RegExp.$1 : null ;
		var parentTab   = this.getParentTab(currentTab);
		var parentURI   = parentTab ? parentTab.linkedBrowser.currentURI : null ;
		var parentHost  = parentURI && parentURI.spec.match(/^\w+:\/\/([^:\/]+)(\/|$)/) ? RegExp.$1 : null ;

		var b       = this.getTabBrowserFromFrame(frame);
		var nextTab = this.getNextSiblingTab(currentTab);

		var openTab      = false;
		var parent       = null;
		var insertBefore = null;

		if (info.modifier) openTab = true;

		if (
			internal.newTab &&
			currentHost == targetHost &&
			currentURI != 'about:blank' &&
			currentURI.split('#')[0] != info.uri.split('#')[0]
			) {
			openTab = info.modifier && info.invert ? !openTab : true ;
			parent = parentHost == targetHost && !internal.forceChild ? parentTab : frame ;
			insertBefore = parentHost == targetHost && !internal.forceChild &&
					(this.getTreePref('insertNewChildAt') == this.kINSERT_FIRST ?
						nextTab :
						(
							this.getTabById(currentTab.__treestyletab__next, b) ||
							(nextTab ? (currentTab.__treestyletab__next = nextTab.getAttribute(this.kID), nextTab) : null )
						)
					);
		}
		else if (
			external.newTab &&
			currentHost != targetHost &&
			currentURI != 'about:blank'
			) {
			openTab = info.modifier && info.invert ? !openTab : true ;
			if (external.forceChild) {
				parent = frame;
			}
		}

		if (openTab && parent) {
			this.readyToOpenChildTab(parent, false, insertBefore);
		}
		return openTab;
	},
  
/* Utilities */ 
	 
	isEventFiredOnTwisty : function(aEvent) 
	{
		var tab = this.getTabFromEvent(aEvent);
		if (!tab) return false;

		return tab.hasAttribute(this.kCHILDREN) && this.evaluateXPath(
				'ancestor-or-self::*[@class="'+this.kTWISTY+'" or (ancestor::xul:tabbrowser[@'+this.kMODE+'="vertical"] and @class="tab-icon")]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue ? true : false ;
	},
 
	get browser() 
	{
		return 'SplitBrowser' in window && this.getTreePref('inSubbrowsers.enabled')  ? SplitBrowser.activeBrowser : gBrowser ;
	},
 
	get container() 
	{
		if (!this._container) {
			this._container = document.getElementById('appcontent');
		}
		return this._container;
	},
	_container : null,
 
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

		aTabBrowser.addEventListener('TabOpen',        this, true);
		aTabBrowser.addEventListener('TabClose',       this, true);
		aTabBrowser.addEventListener('TabMove',        this, true);
		aTabBrowser.addEventListener('SSTabRestoring', this, true);
		aTabBrowser.mTabContainer.addEventListener('click', this, true);
		aTabBrowser.mTabContainer.addEventListener('dblclick', this, true);
		aTabBrowser.mTabContainer.addEventListener('mousedown', this, true);
		aTabBrowser.mTabContainer.addEventListener('select', this, true);
//		aTabBrowser.mPanelContainer.addEventListener('click', this, true);

		aTabBrowser.__treestyletab__levelMargin = -1;

		var selectNewTab = '_selectNewTab' in aTabBrowser.mTabContainer ? '_selectNewTab' : 'selectNewTab' ; // Fx3 / Fx2

		eval('aTabBrowser.mTabContainer.'+selectNewTab+' = '+
			aTabBrowser.mTabContainer[selectNewTab].toSource().replace(
				'{',
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
				'{',
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
				'{',
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

		this.updateTabDNDObserver(aTabBrowser);

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

		var tabs = aTabBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.initTab(tabs[i], aTabBrowser);
		}

		var tabContext = document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
		tabContext.addEventListener('popupshowing', this, false);
		tabContext.addEventListener('popuphiding', this, false);
		window.setTimeout(function(aSelf) {
			var suffix = '-'+parseInt(Math.random() * 65000);
			var item = document.getElementById(aSelf.kMENUITEM_REMOVESUBTREE_CONTEXT).cloneNode(true);
			item.setAttribute('id', item.getAttribute('id')+suffix);
			tabContext.appendChild(item);

			item = document.getElementById(aSelf.kMENUITEM_AUTOHIDE_SEPARATOR_CONTEXT).cloneNode(true);
			item.setAttribute('id', item.getAttribute('id')+suffix);
			tabContext.appendChild(item);
			item = document.getElementById(aSelf.kMENUITEM_AUTOHIDE_CONTEXT).cloneNode(true);
			item.setAttribute('id', item.getAttribute('id')+suffix);
			tabContext.appendChild(item);
		}, 0, this);

		aTabBrowser.__treestyletab__observer = new TreeStyleTabBrowserObserver(aTabBrowser);
		aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.style');
		aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.showBorderForFirstTab');
		aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.invertScrollbar');
		aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.hideAlltabsButton');
		aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.allowSubtreeCollapseExpand');
		window.setTimeout(function() {
			aTabBrowser.__treestyletab__observer.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.autoHide.enabled');
		}, 0);

		delete i;
		delete maxi;
		delete tabs;

		/* To move up content area on the tab bar, switch tab.
		   If we don't do it, a gray space appears on the content area
		   by negative margin of it. */
		if (this.getTreePref('tabbar.position') == 'left' &&
			this.getTreePref('tabbar.invertScrollbar')) {
			aTabBrowser.removeTab(
				aTabBrowser.selectedTab = aTabBrowser.addTab('about:blank')
			);
		}
	},
 
	updateTabDNDObserver : function(aObserver)
	{
		eval('aObserver.canDrop = '+
			aObserver.canDrop.toSource().replace(
				/\.screenX/g, '[TreeStyleTabService.positionProp]'
			).replace(
				/\.width/g, '[TreeStyleTabService.sizeProp]'
			).replace( // Tab Mix Plus
				/\.screenY/g, '[TreeStyleTabService.invertedPositionProp]'
			).replace( // Tab Mix Plus
				/\.height/g, '[TreeStyleTabService.invertedSizeProp]'
			).replace(
				/(return true;)/,
				<><![CDATA[
					var TSTTabBrowser = this;
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
						})(TSTTabBrowser))
						return false;
					$1
				]]></>
			)
		);

		eval('aObserver.onDragOver = '+
			aObserver.onDragOver.toSource().replace(
				'{',
				<><![CDATA[
					{
						var TSTTabBrowser = this;
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
						})(TSTTabBrowser)) {
							return;
						}
				]]></>
			)
		);

		eval('aObserver.onDragExit = '+
			aObserver.onDragExit.toSource().replace(
				/(this.mTabDropIndicatorBar\.[^;]+;)/,
				'$1; TreeStyleTabService.clearDropPosition(this);'
			)
		);

		eval('aObserver.onDrop = '+
			aObserver.onDrop.toSource().replace(
				'{',
				<><![CDATA[
					{
						var TSTTabBrowser = this;
						TreeStyleTabService.clearDropPosition(TSTTabBrowser);
						var dropActionInfo = TreeStyleTabService.getDropAction(aEvent, aDragSession);
				]]></>
			).replace(
				/(if \(aDragSession[^\)]+\) \{)/,
				'$1'+<><![CDATA[
					if (TreeStyleTabService.processDropAction(dropActionInfo, TSTTabBrowser, aDragSession.sourceNode))
						return;
				]]></>
			).replace(
				/(this.loadOneTab\([^;]+\));/,
				<><![CDATA[
					TreeStyleTabService.processDropAction(dropActionInfo, TSTTabBrowser, $1);
					return;
				]]></>
			).replace(
				'document.getBindingParent(aEvent.originalTarget).localName != "tab"',
				'!TreeStyleTabService.getTabFromEvent(aEvent)'
			).replace(
				'var tab = aEvent.target;',
				<><![CDATA[
					var tab = aEvent.target;
					if (
						tab.getAttribute('locked') == 'true' || // Tab Mix Plus
						TreeStyleTabService.getTreePref('loadDroppedLinkToNewChildTab') ||
						dropActionInfo.position != TreeStyleTabService.kDROP_ON
						) {
						TreeStyleTabService.processDropAction(dropActionInfo, TSTTabBrowser, TSTTabBrowser.loadOneTab(getShortcutOrURI(url), null, null, null, bgLoad, false));
						return;
					}
				]]></>
			)
		);
	},
 
	initTab : function(aTab, aTabBrowser) 
	{
		if (!aTabBrowser)
			aTabBrowser = this.getTabBrowserFromChildren(aTab);

		if (!aTab.hasAttribute(this.kID)) {
			var id = 'tab-<'+Date.now()+'-'+parseInt(Math.random() * 65000)+'>';
			this.setTabValue(aTab, this.kID, id);
		}

		aTab.__treestyletab__linkedTabBrowser = aTabBrowser;

		this.initTabAttributes(aTab, aTabBrowser);
		this.initTabContents(aTab, aTabBrowser);

		aTab.setAttribute(this.kNEST, 0);
	},
	 
	initTabAttributes : function(aTab, aTabBrowser) 
	{
		if (!aTabBrowser)
			aTabBrowser = this.getTabBrowserFromChildren(aTab);

		var pos = this.getTreePref('tabbar.position');
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
			aTab.setAttribute('minwidth', aTabBrowser.mTabContainer.mTabMinWidth);
			aTab.setAttribute('width', '0');
			aTab.setAttribute('flex', 100);
			aTab.maxWidth = 250;
			aTab.minWidth = aTabBrowser.mTabContainer.mTabMinWidth;
			aTab.removeAttribute('dir'); // Tab Mix Plus
		}
	},
 
	initTabContents : function(aTab, aTabBrowser) 
	{
		if (!aTabBrowser)
			aTabBrowser = this.getTabBrowserFromChildren(aTab);

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
		this.initTabContentsOrder(aTab, aTabBrowser);
	},
 
	initTabContentsOrder : function(aTab, aTabBrowser) 
	{
		if (!aTabBrowser)
			aTabBrowser = this.getTabBrowserFromChildren(aTab);

		var label = this.getTabLabel(aTab);
		var close = this.getTabClosebox(aTab);
		var counter = document.getAnonymousElementByAttribute(aTab, 'class', this.kCOUNTER_CONTAINER);

		var nodes = document.getAnonymousNodes(aTab);
		for (var i = nodes.length-1; i > -1; i--)
		{
			nodes[i].setAttribute('ordinal', (i + 1) * 10);
		}

		nodes = label.parentNode.childNodes;
		if (this.getTreePref('tabbar.position') == 'right' &&
			this.getTreePref('tabbar.invertUI')) {
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
  
	overrideGlobalFunctions : function() 
	{
		var funcs;

		eval('window.BrowserLoadURL = '+
			window.BrowserLoadURL.toSource().replace(
				'aTriggeringEvent && aTriggeringEvent.altKey',
				<><![CDATA[
					TreeStyleTabService.checkReadyToOpenNewTab({
						uri      : url,
						external : { newTab : TreeStyleTabService.getTreePref('urlbar.loadDifferentDomainToNewTab') },
						internal : { newTab : TreeStyleTabService.getTreePref('urlbar.loadSameDomainToNewChildTab') },
						modifier : aTriggeringEvent && aTriggeringEvent.altKey,
						invert   : TreeStyleTabService.getTreePref('urlbar.invertDefaultBehavior')
					})
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
			if (funcs[i] in window && /^function handleLinkClick/.test(window[funcs[i]].toString()))
				eval('window.'+funcs[i]+' = '+
					window[funcs[i]].toSource().replace(
						/openNewTabWith\(/g,
						<><![CDATA[
							if (!TreeStyleTabService.checkToOpenChildTab(event.target.ownerDocument.defaultView)) TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView);
							openNewTabWith(]]></>
					).replace(
						/(event.ctrlKey|event.metaKey)/,
						<><![CDATA[
							TreeStyleTabService.checkReadyToOpenNewTab({
								uri      : href,
								external : {
									newTab : TreeStyleTabService.getTreePref('openOuterLinkInNewTab') || TreeStyleTabService.getTreePref('openAnyLinkInNewTab'),
									forceChild : true
								},
								internal : {
									newTab : TreeStyleTabService.getTreePref('openAnyLinkInNewTab')
								},
								modifier : $1,
								invert   : TreeStyleTabService.getTreePref('link.invertDefaultBehavior')
							}) ? true : (TreeStyleTabService.readyToOpenChildTab(), false)
						]]></>
					).replace(
						'return false;case 1:',
						<><![CDATA[
								if (TreeStyleTabService.checkToOpenChildTab()) {
									TreeStyleTabService.stopToOpenChildTab();
									urlSecurityCheck(href, linkNode.ownerDocument.location.href);
									var postData = {};
									href = getShortcutOrURI(href, postData);
									if (!href) return false;
									loadURI(href, null, postData.value, false);
								}
								return false;
							case 1:
						]]></>
					)
				);
		}

		funcs = 'contentAreaClick __ctxextensions__contentAreaClick'.split(' ');
		for (var i in funcs)
		{
			if (funcs[i] in window && /^function contentAreaClick/.test(window[funcs[i]].toString()))
				eval('window.'+funcs[i]+' = '+
					window[funcs[i]].toSource().replace(
						/(openWebPanel\([^\(]+\("webPanels"\), wrapper.href\);event.preventDefault\(\);return false;\})/,
						<><![CDATA[
							$1
							else if (TreeStyleTabService.checkReadyToOpenNewTab({
									uri      : wrapper.href,
									external : {
										newTab : TreeStyleTabService.getTreePref('openOuterLinkInNewTab') || TreeStyleTabService.getTreePref('openAnyLinkInNewTab'),
										forceChild : true
									},
									internal : {
										newTab : TreeStyleTabService.getTreePref('openAnyLinkInNewTab')
									}
								})) {
								event.stopPropagation();
								event.preventDefault();
								handleLinkClick(event, wrapper.href, linkNode);
								return true;
							}
						]]></>
					)
				);
		}

		funcs = 'gotoHistoryIndex BrowserForward BrowserBack __rewindforward__BrowserForward __rewindforward__BrowserBack'.split(' ');
		for (var i in funcs)
		{
			if (funcs[i] in window &&
				/^function (gotoHistoryIndex|BrowserForward|BrowserBack)/.test(window[funcs[i]].toString()))
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
		this.endAutoHide();

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

		aTabBrowser.removeEventListener('TabOpen',        this, true);
		aTabBrowser.removeEventListener('TabClose',       this, true);
		aTabBrowser.removeEventListener('TabMove',        this, true);
		aTabBrowser.removeEventListener('SSTabRestoring', this, true);
		aTabBrowser.mTabContainer.removeEventListener('click', this, true);
		aTabBrowser.mTabContainer.removeEventListener('dblclick', this, true);
		aTabBrowser.mTabContainer.removeEventListener('mousedown', this, true);
		aTabBrowser.mTabContainer.removeEventListener('select', this, true);
//		aTabBrowser.mPanelContainer.removeEventListener('click', this, true);

		var tabContext = document.getAnonymousElementByAttribute(aTabBrowser, 'anonid', 'tabContextMenu');
		tabContext.removeEventListener('popupshowing', this, false);
		tabContext.removeEventListener('popuphiding', this, false);
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
				if (aEvent.originalTarget.getAttribute('class') == this.kSPLITTER)
					this.tabbarResizing = true;
				if (aEvent.currentTarget == this.container) {
					this.cancelShowHideTabbar();
				}
				else {
					this.onTabMouseDown(aEvent);
				}
				return;

			case 'mouseup':
				if (aEvent.originalTarget.getAttribute('class') == this.kSPLITTER)
					this.tabbarResizing = false;
				this.cancelShowHideTabbar();
				return;

			case 'mousemove':
				if (!this.tabbarResizing) {
					if (!this.tabContextMenuShown)
						this.showHideTabbar(aEvent);
					return;
				}
			case 'resize':
				if (this.tabbarShown) {
					switch (this.getTreePref('tabbar.position'))
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

			case 'select':
				this.onTabSelect(aEvent);
				return;

			case 'load':
				if (aEvent.currentTarget == this.container)
					this.redrawContentArea();
				else
					this.init();
				return;

			case 'unload':
				this.destroy();
				return;

			case 'popupshowing':
				if (aEvent.target != aEvent.currentTarget) return;
				if (aEvent.currentTarget.id == 'contentAreaContextMenu') {
					this.initContextMenu();
				}
				else {
					this.tabContextMenuShown = true;
					this.initTabContextMenu(aEvent);
				}
				return;

			case 'popuphiding':
				this.tabContextMenuShown = false;
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

		this.initTab(tab, b);

		if (b.__treestyletab__readyToAttachNewTab) {
			var parent = this.getTabById(b.__treestyletab__parentTab, b);
			if (parent)
				this.attachTabTo(tab, parent);

			var refTab;
			var newIndex = -1;
			if (b.__treestyletab__insertBefore &&
				(refTab = this.getTabById(b.__treestyletab__insertBefore, b))) {
				newIndex = refTab._tPos;
			}
			else if (parent &&
				this.getTreePref('insertNewChildAt') == this.kINSERT_FISRT &&
				b.__treestyletab__multipleCount == 0) {
				/* 複数の子タブを一気に開く場合、最初に開いたタブだけを
				   子タブの最初の位置に挿入し、続くタブは「最初の開いたタブ」と
				   「元々最初の子だったタブ」との間に挿入していく */
				newIndex = parent._tPos + 1;
				if (refTab = this.getFirstChildTab(parent))
					b.__treestyletab__insertBefore = refTab.getAttribute(this.kID);
			}

			if (newIndex > -1) {
				if (newIndex > tab._tPos) newIndex--;
				b.__treestyletab__internallyTabMoving = true;
				b.moveTabTo(tab, newIndex);
				b.__treestyletab__internallyTabMoving = false;
			}
		}

		if (!b.__treestyletab__readyToAttachMultiple) {
			this.stopToOpenChildTab(b);
		}
		else {
			b.__treestyletab__multipleCount++;
		}
	},
 
	onTabRemoved : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.getTabBrowserFromChildren(tab);

		this.destroyTab(tab, b);

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
			this.checkTabsIndentOverflow(b);
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
			this.partTab(tab, true);
		}
		else if (!nextFocusedTab) {
			nextFocusedTab = this.getNextSiblingTab(tab);
		}

		if (nextFocusedTab && b.selectedTab == tab)
			b.selectedTab = nextFocusedTab;

		this.checkTabsIndentOverflow(b);
	},
 
	onTabMove : function(aEvent) 
	{
		var tab = aEvent.originalTarget;
		var b   = this.getTabBrowserFromChildren(tab);
		this.initTabContents(tab, b); // twisty vanished after the tab is moved!!

		var rebuildTreeDone = false;

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
				this.attachTabTo(tab, parent, {
					dontExpand : true,
					insertBefore : (before ? this.getTabById(before, b) : null ),
					dontUpdateIndent : true
				});
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

		if (this.autoHideEnabled && this.tabbarShown)
			this.redrawContentArea();
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
 
	initTabContextMenu : function(aEvent) 
	{
		var b = this.getTabBrowserFromChildren(aEvent.currentTarget);
		var item = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_REMOVESUBTREE_CONTEXT+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		if (this.getTreePref('show.context-item-removeTabSubTree'))
			item.removeAttribute('hidden');
		else
			item.setAttribute('hidden', true);
		this.showHideRemoveSubTreeMenuItem(item, [b.mContextTab]);

		item = this.evaluateXPath(
			'descendant::xul:menuitem[starts-with(@id, "'+this.kMENUITEM_AUTOHIDE_CONTEXT+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		var sep = this.evaluateXPath(
			'descendant::xul:menuseparator[starts-with(@id, "'+this.kMENUITEM_AUTOHIDE_SEPARATOR_CONTEXT+'")]',
			aEvent.currentTarget,
			XPathResult.FIRST_ORDERED_NODE_TYPE
		).singleNodeValue;
		var pos = this.getTreePref('tabbar.position');
		if (this.getTreePref('show.context-item-toggleAutoHide') &&
			(pos == 'left' || pos == 'right')) {
			item.removeAttribute('hidden');
			sep.removeAttribute('hidden');

			if (this.getTreePref('tabbar.autoHide.enabled'))
				item.setAttribute('checked', true);
			else
				item.removeAttribute('checked');
		}
		else {
			item.setAttribute('hidden', true);
			sep.setAttribute('hidden', true);
		}
	},
 
	showHideRemoveSubTreeMenuItem : function(aMenuItem, aTabs) 
	{
		if (!aMenuItem ||
			aMenuItem.getAttribute('hidden') == 'true' ||
			!aTabs ||
			!aTabs.length)
			return;

		var hasSubTree = false;
		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			if (!aTabs[i].hasAttribute(this.kCHILDREN)) continue;
			hasSubTree = true;
			break;
		}
		if (hasSubTree)
			aMenuItem.removeAttribute('hidden');
		else
			aMenuItem.setAttribute('hidden', true);
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
		if (!aId || !aTabBrowser) return null;
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
		var id = aTab.getAttribute(this.kID);
		if (!id) return null; // not initialized yet
		return this.evaluateXPath(
				'parent::*/child::xul:tab[contains(@'+this.kCHILDREN+', "'+id+'")]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getRootTab : function(aTab) 
	{
		var parent = aTab;
		var root   = aTab;
		while (parent = this.getParentTab(parent))
		{
			root = parent;
		}
		return root;
	},
 
	getNextSiblingTab : function(aTab) 
	{
		if (!aTab) return null;

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
			var list = ('|'+children).split('|'+aTab.getAttribute(this.kID))[1].split('|');
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
			var list = ('|'+children).split('|'+aTab.getAttribute(this.kID))[0].split('|');
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
			splitter.setAttribute('state', 'open');
			splitter.appendChild(document.createElement('grippy'));
			var ref = aTabBrowser.mPanelContainer;
			ref.parentNode.insertBefore(splitter, ref);
		}

		var scrollInnerBox = document.getAnonymousNodes(aTabBrowser.mTabContainer.mTabstrip._scrollbox)[0];
		var allTabsButton = document.getAnonymousElementByAttribute(aTabBrowser.mTabContainer, 'class', 'tabs-alltabs-button');

		// Tab Mix Plus
		var scrollFrame = document.getAnonymousElementByAttribute(aTabBrowser.mTabContainer, 'id', 'scroll-tabs-frame');
		var newTabBox = document.getAnonymousElementByAttribute(aTabBrowser.mTabContainer, 'id', 'tabs-newbutton-box');
		var tabBarMode = this.getPref('extensions.tabmix.tabBarMode');

		if (pos & this.kTABBAR_VERTICAL) {
			this.positionProp         = 'screenY';
			this.sizeProp             = 'height';
			this.invertedPositionProp = 'screenX';
			this.invertedSizeProp     = 'width';

			aTabBrowser.mTabBox.orient = 'horizontal';
			aTabBrowser.mStrip.orient =
				aTabBrowser.mTabContainer.orient =
				aTabBrowser.mTabContainer.mTabstrip.orient =
				aTabBrowser.mTabContainer.mTabstrip.parentNode.orient = 'vertical';
			if (allTabsButton.parentNode.localName == 'hbox') { // Firefox 2
				allTabsButton.parentNode.orient = 'vertical';
				allTabsButton.parentNode.setAttribute('align', 'stretch');
			}
			allTabsButton.firstChild.setAttribute('position', 'before_start');
			aTabBrowser.mTabContainer.setAttribute('align', 'stretch'); // for Mac OS X
			scrollInnerBox.removeAttribute('flex');

			if (scrollFrame) { // Tab Mix Plus
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'vertical';
				newTabBox.orient = 'horizontal';
				if (tabBarMode == 2)
					this.setPref('extensions.tabmix.tabBarMode', 1);
			}

			aTabBrowser.mStrip.removeAttribute('width');
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
				window.setTimeout(function(aWidth) {
					/* in Firefox 3, the width of the rightside tab bar
					   unexpectedly becomes 0 on the startup. so, we have
					   to set the width again. */
					aTabBrowser.mStrip.setAttribute('width', aWidth);
					aTabBrowser.mTabDropIndicatorBar.setAttribute('ordinal', 1);
					aTabBrowser.mStrip.setAttribute('ordinal', 30);
					splitter.setAttribute('ordinal', 20);
					aTabBrowser.mPanelContainer.setAttribute('ordinal', 10);
					splitter.setAttribute('collapse', 'after');
				}, 0, this.getTreePref('tabbar.width'));
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
					splitter.setAttribute('collapse', 'before');
				}, 0);
			}
		}
		else {
			this.positionProp         = 'screenX';
			this.sizeProp             = 'width';
			this.invertedPositionProp = 'screenY';
			this.invertedSizeProp     = 'height';

			aTabBrowser.mTabBox.orient = 'vertical';
			aTabBrowser.mStrip.orient =
				aTabBrowser.mTabContainer.orient =
				aTabBrowser.mTabContainer.mTabstrip.orient =
				aTabBrowser.mTabContainer.mTabstrip.parentNode.orient = 'horizontal';
			if (allTabsButton.parentNode.localName == 'hbox') { // Firefox 2
				allTabsButton.parentNode.orient = 'horizontal';
				allTabsButton.parentNode.removeAttribute('align');
			}
			allTabsButton.firstChild.setAttribute('position', 'after_end');
			aTabBrowser.mTabContainer.removeAttribute('align'); // for Mac OS X
			scrollInnerBox.setAttribute('flex', 1);

			if (scrollFrame) { // Tab Mix Plus
				scrollFrame.parentNode.orient =
					scrollFrame.orient = 'horizontal';
				newTabBox.orient = 'vertical';
			}

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
		if (!id || !aParent.getAttribute(this.kID))
			return; // if the tab is not initialized yet, do nothing.

		this.partTab(aChild, true);

		var b        = this.getTabBrowserFromChildren(aParent);
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
				this.attachTabTo(b.mCurrentTab, grandParent, {
					insertBefore : this.getNextSiblingTab(parentTab)
				});
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
   
/* auto hide */ 
	autoHideEnabled : false,
	tabbarShown : true,
	 
	get tabbarWidth() 
	{
		if (this.tabbarShown) {
			var b = this.browser;
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
			var b = this.browser;
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
 
	toggleAutoHide : function() 
	{
		this.setTreePref('tabbar.autoHide.enabled',
			!this.getTreePref('tabbar.autoHide.enabled'));
	},
 
	get areaPadding() 
	{
		return this.getTreePref('tabbar.autoHide.area');
	},
 
	startAutoHide : function(aTabBrowser) 
	{
		if (this.autoHideEnabled) return;
		this.autoHideEnabled = true;

		this.container.addEventListener('mousedown', this, true);
		this.container.addEventListener('mouseup', this, true);
		this.container.addEventListener('mousemove', this, true);
		this.container.addEventListener('scroll', this, true);
		this.container.addEventListener('resize', this, true);
		this.container.addEventListener('load', this, true);

		this.tabbarShown = true;
		this.showHideTabbarInternal();
	},
 
	endAutoHide : function(aTabBrowser) 
	{
		if (!this.autoHideEnabled) return;
		this.autoHideEnabled = false;

		this.container.removeEventListener('mousedown', this, true);
		this.container.removeEventListener('mouseup', this, true);
		this.container.removeEventListener('mousemove', this, true);
		this.container.removeEventListener('scroll', this, true);
		this.container.removeEventListener('resize', this, true);
		this.container.removeEventListener('load', this, true);

		this.container.style.margin = 0;
		this.browser.removeAttribute(this.kAUTOHIDE);
		this.tabbarShown = true;
	},
 
	showHideTabbar : function(aEvent) 
	{
		if ('gestureInProgress' in window && window.gestureInProgress) return;

		this.cancelShowHideTabbar();

		var pos    = this.getTreePref('tabbar.position');
		var expand = this.getTreePref('tabbar.autoHide.expandArea');
		var b = this.browser;
		if (!this.tabbarShown &&
			(
				pos == 'left' ?
					(aEvent.screenX <= b.boxObject.screenX + (expand ? this.tabbarWidth : 0 ) + this.areaPadding) :
				pos == 'right' ?
					(aEvent.screenX >= b.boxObject.screenX + b.boxObject.width - (expand ? this.tabbarWidth : 0 ) - this.areaPadding) :
				pos == 'bottom' ?
					(aEvent.screenY >= b.boxObject.screenY + b.boxObject.height - (expand ? this.tabbarHeight : 0 ) - this.areaPadding) :
					(aEvent.screenY <= b.boxObject.screenY + (expand ? this.tabbarHeight : 0 ) + this.areaPadding)
				))
				this.showHideTabbarTimer = window.setTimeout(
					'TreeStyleTabService.showHideTabbarInternal();',
					this.getTreePref('tabbar.autoHide.delay')
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
				this.showHideTabbarTimer = window.setTimeout(
					'TreeStyleTabService.showHideTabbarInternal();',
					this.getTreePref('tabbar.autoHide.delay')
				);
	},
	showHideTabbarTimer : null,
	 
	showHideTabbarInternal : function() 
	{
		var b = this.browser;
		if (this.tabbarShown) {
			var splitter = document.getAnonymousElementByAttribute(b, 'class', this.kSPLITTER);
			this.tabbarHeight = b.mStrip.boxObject.height;
			this.tabbarWidth = b.mStrip.boxObject.width +
				(splitter ? splitter.boxObject.width : 0 );
			this.container.style.margin = 0;
			b.setAttribute(this.kAUTOHIDE, true);
			this.tabbarShown = false;
		}
		else {
			switch (this.getTreePref('tabbar.position'))
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
			b.removeAttribute(this.kAUTOHIDE);
			this.tabbarShown = true;
		}
		this.redrawContentArea();
		window.setTimeout('TreeStyleTabService.checkTabsIndentOverflow(TreeStyleTabService.browser);', 0);
	},
 
	cancelShowHideTabbar : function() 
	{
		if (this.showHideTabbarTimer) {
			window.clearTimeout(this.showHideTabbarTimer);
			this.showHideTabbarTimer = null;
		}
	},
  
	redrawContentArea : function() 
	{
		var pos = this.getTreePref('tabbar.position');
		try {
			var v = this.browser.markupDocumentViewer;
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
			}
			else {
				v.move(window.outerWidth,window.outerHeight);
				v.move(0,0);
			}
		}
		catch(e) {
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
 
	setTreePref : function(aPrefstring, aNewValue) 
	{
		return this.setPref('extensions.treestyletab.'+aPrefstring, aNewValue);
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
		var sv = TreeStyleTabService;
		var b = this.mTabBrowser;
		switch (aTopic)
		{
			case 'TreeStyleTab:levelMarginModified':
				if (b.__treestyletab__levelMargin > -1) {
					sv.updateAllTabsIndent(b);
				}
				break;

			case 'nsPref:changed':
				var value = sv.getPref(aData);
				var tabContainer = b.mTabContainer;
				var tabs  = Array.prototype.slice.call(tabContainer.childNodes);
				switch (aData)
				{
					case 'extensions.treestyletab.tabbar.position':
						if (value != 'left' && value != 'right') {
							sv.endAutoHide(b);
						}
						tabs.forEach(function(aTab) {
							sv.initTabAttributes(aTab, b);
						});
					case 'extensions.treestyletab.tabbar.invertUI':
					case 'extensions.treestyletab.tabbar.multirow':
						sv.initTabbar(b);
						sv.updateAllTabsIndent(b);
						tabs.forEach(function(aTab) {
							sv.initTabContents(aTab, b);
						});
						break;

					case 'extensions.treestyletab.enableSubtreeIndent':
						sv.updateAllTabsIndent(b);
						break;

					case 'extensions.treestyletab.tabbar.style':
						b.setAttribute(sv.kSTYLE, value);
						break;

					case 'extensions.treestyletab.showBorderForFirstTab':
						if (value)
							b.setAttribute(sv.kFIRSTTAB_BORDER, true);
						else
							b.removeAttribute(sv.kFIRSTTAB_BORDER);
						break;

					case 'extensions.treestyletab.tabbar.invertScrollbar':
						if (value &&
							sv.getTreePref('tabbar.position') == 'left' &&
							sv.isGecko18)
							b.setAttribute(sv.kSCROLLBAR_INVERTED, true);
						else
							b.removeAttribute(sv.kSCROLLBAR_INVERTED);
						break;

					case 'extensions.treestyletab.tabbar.hideAlltabsButton':
						var pos = sv.getTreePref('tabbar.position');
						if (value && (pos == 'left' || pos == 'right'))
							b.setAttribute(sv.kHIDE_ALLTABS, true);
						else
							b.removeAttribute(sv.kHIDE_ALLTABS);
						break;

					case 'extensions.treestyletab.allowSubtreeCollapseExpand':
						if (value)
							b.setAttribute(sv.kALLOW_COLLAPSE, true);
						else
							b.removeAttribute(sv.kALLOW_COLLAPSE);
						break;

					case 'extensions.treestyletab.tabbar.autoHide.enabled':
						var pos = sv.getTreePref('tabbar.position');
						if (value && (pos == 'left' || pos == 'right'))
							sv.startAutoHide(b);
						else
							sv.endAutoHide(b);
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
 
