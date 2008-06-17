var TreeStyleTabService = { 
	kID                 : 'treestyletab-id',
	kCHILDREN           : 'treestyletab-children',
	kPARENT             : 'treestyletab-parent',
	kANCESTOR           : 'treestyletab-ancestors',
	kINSERT_BEFORE      : 'treestyletab-insert-before',
	kSUBTREE_COLLAPSED  : 'treestyletab-subtree-collapsed',
	kCOLLAPSED          : 'treestyletab-collapsed',
	kTWISTY_HOVER       : 'treestyletab-twisty-hover',
	kNEST               : 'treestyletab-nest',
	kDROP_POSITION      : 'treestyletab-drop-position',
	kTABBAR_POSITION    : 'treestyletab-tabbar-position',
	kMODE               : 'treestyletab-mode',
	kUI_INVERTED        : 'treestyletab-appearance-inverted',
	kSCROLLBAR_INVERTED : 'treestyletab-scrollbar-inverted',
	kALLOW_COLLAPSE     : 'treestyletab-allow-subtree-collapse',
	kHIDE_ALLTABS       : 'treestyletab-hide-alltabs-button',
	kSTYLE              : 'treestyletab-style',
	kTWISTY_STYLE       : 'treestyletab-twisty-style',
	kFIRSTTAB_BORDER    : 'treestyletab-firsttab-border',
	kAUTOHIDE           : 'treestyletab-tabbar-autohide',
	kFIXED              : 'treestyletab-tabbar-fixed',
	kRESIZING           : 'treestyletab-tabbar-resizing',
	kTRANSPARENT        : 'treestyletab-tabbar-transparent',

	kTWISTY                : 'treestyletab-twisty',
	kTWISTY_CONTAINER      : 'treestyletab-twisty-container',
	kDROP_MARKER           : 'treestyletab-drop-marker',
	kDROP_MARKER_CONTAINER : 'treestyletab-drop-marker-container',
	kCOUNTER               : 'treestyletab-counter',
	kCOUNTER_CONTAINER     : 'treestyletab-counter-container',
	kSPLITTER              : 'treestyletab-splitter',
	kSTRINGBUNDLE          : 'treestyletab-stringbundle',

	kMENUITEM_REMOVESUBTREE_SELECTION : 'multipletab-selection-item-removeTabSubTree',

	kFOCUS_ALL     : 0,
	kFOCUS_VISIBLE : 1,

	kDROP_BEFORE : -1,
	kDROP_ON     : 0,
	kDROP_AFTER  : 1,

	kACTION_MOVE   : 1,
	kACTION_ATTACH : 2,
	kACTION_PART   : 4,
	kACTION_DUPLICATE : 8,
	kACTION_MOVE_FROM_OTHER_WINDOW : 16,

	kTABBAR_TOP    : 1,
	kTABBAR_BOTTOM : 2,
	kTABBAR_LEFT   : 4,
	kTABBAR_RIGHT  : 8,

	kTABBAR_HORIZONTAL : 3,
	kTABBAR_VERTICAL   : 12,

	kAUTOHIDE_MODE_DISABLED : 0,
	kAUTOHIDE_MODE_HIDE     : 1,
	kAUTOHIDE_MODE_SHRINK   : 2,
	get autoHideMode()
	{
		if (this._autoHideMode == this.kAUTOHIDE_MODE_SHRINK &&
			this.getTreePref('tabbar.position') != 'left' &&
			this.getTreePref('tabbar.position') != 'right')
			return this.kAUTOHIDE_MODE_HIDE;
		return this._autoHideMode;
	},
	set autoHideMode(aValue)
	{
		this._autoHideMode = aValue;
		return aValue;
	},
	_autoHideMode : 0,

	kSHOWN_BY_UNKNOWN   : 0,
	kSHOWN_BY_SHORTCUT  : 1,
	kSHOWN_BY_MOUSEMOVE : 2,
	kSHOWN_BY_FEEDBACK  : 3,

	kTRANSPARENT_NONE : 0,
	kTRANSPARENT_PART : 1,
	kTRANSPARENT_FULL : 2,
	kTRANSPARENT_STYLE : ['none', 'part', 'full'],

	kINSERT_FISRT : 0,
	kINSERT_LAST  : 1,

	baseLebelMargin : 12,

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
			this._SessionStore = Components
					.classes['@mozilla.org/browser/sessionstore;1']
					.getService(Components.interfaces.nsISessionStore);
		}
		return this._SessionStore;
	},
	_SessionStore : null,

	get ObserverService() {
		if (!this._ObserverService) {
			this._ObserverService = Components
					.classes['@mozilla.org/observer-service;1']
					.getService(Components.interfaces.nsIObserverService);
		}
		return this._ObserverService;
	},
	_ObserverService : null,

	get IOService() {
		if (!this._IOService) {
			this._IOService = Components
					.classes['@mozilla.org/network/io-service;1']
					.getService(Components.interfaces.nsIIOService);
		}
		return this._IOService;
	},
	_IOService : null,

	get WindowMediator() {
		if (!this._WindowMediator) {
			this._WindowMediator = Components
					.classes['@mozilla.org/appshell/window-mediator;1']
					.getService(Components.interfaces.nsIWindowMediator);
		}
		return this._WindowMediator;
	},
	_WindowMediator : null,

	get isGecko18() {
		var version = this.XULAppInfo.platformVersion.split('.');
		return parseInt(version[0]) <= 1 && parseInt(version[1]) <= 8;
	},
	get isGecko19() {
		var version = this.XULAppInfo.platformVersion.split('.');
		return parseInt(version[0]) >= 2 || parseInt(version[1]) >= 9;
	},

	get XULAppInfo() {
		if (!this._XULAppInfo) {
			this._XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1'].getService(Components.interfaces.nsIXULAppInfo);
		}
		return this._XULAppInfo;
	},
	_XULAppInfo : null,

	get stringbundle() {
		if (!this._stringbundle) {
			this._stringbundle = document.getElementById(this.kSTRINGBUNDLE);
		}
		return this._stringbundle;
	},
	_stringbundle : null,
	 
/* API */ 
	
	readyToOpenChildTab : function(aFrameOrTabBrowser, aMultiple, aInsertBefore) 
	{
		if (!this.getTreePref('autoAttachNewTabsAsChildren')) return;

		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.treeStyleTab.readyToAttachNewTab   = true;
		ownerBrowser.treeStyleTab.readyToAttachMultiple = aMultiple || false ;
		ownerBrowser.treeStyleTab.multipleCount         = 0;
		ownerBrowser.treeStyleTab.parentTab             = this.getTabFromFrame(frame, ownerBrowser).getAttribute(this.kID);
		ownerBrowser.treeStyleTab.insertBefore          = aInsertBefore ? aInsertBefore.getAttribute(this.kID) : null ;
	},
 
	readyToOpenNewTabGroup : function(aFrameOrTabBrowser) 
	{
		if (!this.getTreePref('autoAttachNewTabsAsChildren')) return;

		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		this.stopToOpenChildTab(frame);

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.treeStyleTab.readyToAttachNewTabGroup = true;
		ownerBrowser.treeStyleTab.readyToAttachMultiple    = true;
		ownerBrowser.treeStyleTab.multipleCount            = 0;
	},
 
	stopToOpenChildTab : function(aFrameOrTabBrowser) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.treeStyleTab.readyToAttachNewTab      = false;
		ownerBrowser.treeStyleTab.readyToAttachNewTabGroup = false;
		ownerBrowser.treeStyleTab.readyToAttachMultiple    = false;
		ownerBrowser.treeStyleTab.multipleCount            = 0;
		ownerBrowser.treeStyleTab.parentTab                = null;
		ownerBrowser.treeStyleTab.insertBefore             = null;
	},
 
	checkToOpenChildTab : function(aFrameOrTabBrowser) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return false;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		return ownerBrowser.treeStyleTab.readyToAttachNewTab || ownerBrowser.treeStyleTab.readyToAttachNewTabGroup ? true : false ;
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

		var b       = this.getTabBrowserFromFrame(frame);
		var nextTab = b.treeStyleTab.getNextSiblingTab(currentTab);

		var targetHost  = /^\w+:\/\/([^:\/]+)(\/|$)/.test(info.uri) ? RegExp.$1 : null ;
		var currentTab  = this.getTabFromFrame(frame);
		var currentURI  = frame.location.href;
		var currentHost = currentURI.match(/^\w+:\/\/([^:\/]+)(\/|$)/) ? RegExp.$1 : null ;
		var parentTab   = b.treeStyleTab.getParentTab(currentTab);
		var parentURI   = parentTab ? parentTab.linkedBrowser.currentURI : null ;
		var parentHost  = parentURI && parentURI.spec.match(/^\w+:\/\/([^:\/]+)(\/|$)/) ? RegExp.$1 : null ;

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
							b.treeStyleTab.getTabById(currentTab.__treestyletab__next) ||
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
  
/* backward compatibility */ 
	getTempTreeStyleTab : function(aTabBrowser)
	{
		return aTabBrowser.treeStyleTab || new TreeStyleTabBrowser(aTabBrowser);
	},
	
	initTabAttributes : function(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabAttributes(aTab);
	},
 
	initTabContents : function(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabContents(aTab);
	},
 
	initTabContentsOrder : function(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabContentsOrder(aTab);
	},
  
/* Utilities */ 
	
	isEventFiredOnTwisty : function(aEvent) 
	{
		var tab = this.getTabFromEvent(aEvent);
		if (!tab) return false;

		return this.hasChildTabs(tab) && this.evaluateXPath(
				'ancestor-or-self::*[@class="'+this.kTWISTY+'" or (ancestor::xul:tabbrowser[@'+this.kMODE+'="vertical"] and @class="tab-icon")]',
				aEvent.originalTarget || aEvent.target,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue ? true : false ;
	},
 
	get browserWindow() 
	{
		return this.WindowMediator.getMostRecentWindow('navigator:browser');
	},
 
	get browser() 
	{
		var w = this.browserWindow;
		return !w ? null :
			'SplitBrowser' in w ? w.SplitBrowser.activeBrowser :
			w.gBrowser ;
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
 
	getTabBrowserFromChild : function(aTab) 
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
		var w = this.browserWindow;
		return !w ? null :
			('SplitBrowser' in w) ? this.getTabBrowserFromChild(w.SplitBrowser.getSubBrowserAndBrowserFromFrame(aFrame.top).browser) :
			this.browser ;
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
				frame = this.getTabBrowserFromChild(frame);
				if (!frame) return null;
				frame = frame.contentWindow;
			}
		}
		if (!frame)
			frame = this.browser.contentWindow;

		return frame;
	},
 
	makeNewId : function() 
	{
		return 'tab-<'+Date.now()+'-'+parseInt(Math.random() * 65000)+'>';
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
 
	toggleAutoHide : function() 
	{
		this.setTreePref('tabbar.autoHide.mode',
			this.getTreePref('tabbar.autoHide.mode') == this.kAUTOHIDE_MODE_DISABLED ?
				this.getTreePref('tabbar.autoHide.mode.toggle') :
				this.kAUTOHIDE_MODE_DISABLED
		);
	},
 
	toggleFixed : function() 
	{
		this.setTreePref('tabbar.fixed',
			!this.getTreePref('tabbar.fixed'));
	},
 
	changeTabbarPosition : function(aNewPosition) 
	{
		if (!aNewPosition || !/^(top|bottom|left|right)$/i.test(aNewPosition))
			aNewPosition = 'top';

		aNewPosition = aNewPosition.toLowerCase();
		this.setTreePref('tabbar.position', aNewPosition);

		if (!this.getTreePref('tabbar.syncRelatedPrefsForDynamicPosition')) return;

		var vertical = (aNewPosition == 'left' || aNewPosition == 'right');
		this.setTreePref('enableSubtreeIndent', vertical);
		this.setTreePref('allowSubtreeCollapseExpand', vertical);
	},
 
/* get tab(s) */ 
	
	getTabById : function(aId, aTabBrowserChildren) 
	{
		if (!aId) return null;
		var b = aTabBrowserChildren ? this.getTabBrowserFromChild(aTabBrowserChildren) : null ;
		if (!b) b = this.browser;
		return this.evaluateXPath(
				'descendant::xul:tab[@'+this.kID+' = "'+aId+'"]',
				b.mTabContainer,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getNextVisibleTab : function(aTab) 
	{
		var xpathResult = this.evaluateXPath(
				'following-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")]',
				aTab
			);
		return xpathResult.snapshotItem(0);
	},
 
	getPreviousVisibleTab : function(aTab) 
	{
		var xpathResult = this.evaluateXPath(
				'preceding-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")]',
				aTab
			);
		return xpathResult.snapshotItem(xpathResult.snapshotLength-1);
	},
 
	getLastVisibleTab : function(aTab) 
	{
		var xpathResult = this.evaluateXPath(
				'child::xul:tab[not(@'+this.kCOLLAPSED+'="true")]',
				aTab.parentNode
			);
		return xpathResult.snapshotItem(xpathResult.snapshotLength-1);
	},
 
	getVisibleTabs : function(aTab) 
	{
		var xpathResult = this.evaluateXPath(
				'child::xul:tab[not(@'+this.kCOLLAPSED+'="true")]',
				aTab.parentNode
			);
		return xpathResult;
	},
 
	getVisibleIndex : function(aTab) 
	{
		return this.evaluateXPath(
				'preceding-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")]',
				aTab
			).snapshotLength;
	},
  
/* tree manipulations */ 
	
	get rootTabs() 
	{
		return this.getArrayFromXPathResult(
				this.evaluateXPath(
					'child::xul:tab[not(@'+this.kNEST+') or @'+this.kNEST+'="0" or @'+this.kNEST+'=""]',
					this.browser.mTabContainer
				)
			);
	},
 
	getParentTab : function(aTab) 
	{
		if (!aTab) return null;
		var id = aTab.getAttribute(this.kID);
		if (!id) return null; // not initialized yet
		return this.evaluateXPath(
				'parent::*/child::xul:tab[contains(concat("|", @'+this.kCHILDREN+', "|"), "|'+id+'|")]',
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

		var children = parentTab.getAttribute(this.kCHILDREN);
		if (children) {
			var list = ('|'+children).split('|'+aTab.getAttribute(this.kID))[1].split('|');
			for (var i = 0, maxi = list.length; i < maxi; i++)
			{
				var firstChild = this.getTabById(list[i], aTab);
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

		var children = parentTab.getAttribute(this.kCHILDREN);
		if (children) {
			var list = ('|'+children).split('|'+aTab.getAttribute(this.kID))[0].split('|');
			for (var i = list.length-1; i > -1; i--)
			{
				var lastChild = this.getTabById(list[i], aTab);
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
		var tab;
		for (var i = 0, maxi = list.length; i < maxi; i++)
		{
			tab = this.getTabById(list[i], aTab);
			if (!tab) continue;
			tabs.push(tab);
			if (aAllTabsArray)
				this.getChildTabs(tab, tabs);
		}

		return tabs;
	},
 
	hasChildTabs : function(aTab) 
	{
		if (!aTab) return false;
		return aTab.hasAttribute(this.kCHILDREN);
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

		var children   = aTab.getAttribute(this.kCHILDREN);
		var firstChild = null;
		if (children) {
			var list = children.split('|');
			for (var i = 0, maxi = list.length; i < maxi; i++)
			{
				firstChild = this.getTabById(list[i], aTab);
				if (firstChild) break;
			}
		}
		return firstChild;
	},
 
	getLastChildTab : function(aTab) 
	{
		if (!aTab) return null;

		var children  = aTab.getAttribute(this.kCHILDREN);
		var lastChild = null;
		if (children) {
			var list = children.split('|');
			for (var i = list.length-1; i > -1; i--)
			{
				lastChild = this.getTabById(list[i], aTab);
				if (lastChild) break;
			}
		}
		return lastChild;
	},
 
	getChildIndex : function(aTab, aParent) 
	{
		var parent = this.getParentTab(aTab);
		if (!aParent || !parent || aParent != parent) {
			parent = aTab;
			while (parent && parent != aParent)
			{
				aTab = parent;
				parent = this.getParentTab(parent);
			}
			if (parent != aParent)
				return -1;
			aParent = parent;
		}

		if (aParent) {
			var children = aParent.getAttribute(this.kCHILDREN);
			var list = children.split('|');
			var id = aTab.getAttribute(this.kID);
			for (var i = 0, maxi = list.length; i < maxi; i++)
			{
				if (list[i] == id) return i;
			}
			return -1;
		}
		else {
			var tabs = this.rootTabs;
			for (var i = 0, maxi = tabs.length; i < maxi; i++)
			{
				if (tabs[i] == aTab) return i;
			}
		}
	},
  
/* Session Store API */ 
	
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
   
/* Initializing */ 
	
	preInit : function() 
	{
		window.removeEventListener('DOMContentLoaded', this, true);
		if (!document.getElementById('content')) return;

		this.overrideExtensionsPreInit(); // hacks.js
	},
 
	init : function() 
	{
		if (!('gBrowser' in window)) return;

		window.removeEventListener('load', this, false);
		window.addEventListener('unload', this, false);
		document.getElementById('contentAreaContextMenu').addEventListener('popupshowing', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);

		this.addPrefListener(this);

		this.overrideExtensionsOnInitBefore(); // hacks.js
		this.overrideGlobalFunctions();
		this.initTabBrowser(gBrowser);
		this.overrideExtensionsOnInitAfter(); // hacks.js

		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.levelMargin');
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.tabbar.autoHide.mode');
		this.observe(null, 'nsPref:changed', 'browser.link.open_newwindow.restriction.override');
		this.observe(null, 'nsPref:changed', 'browser.tabs.loadFolderAndReplace.override');
	},
	 
	initTabBrowser : function(aTabBrowser) 
	{
		if (aTabBrowser.localName != 'tabbrowser') return;
		aTabBrowser.treeStyleTab = new TreeStyleTabBrowser(aTabBrowser);
		aTabBrowser.treeStyleTab.init();
	},
 
	updateTabDNDObserver : function(aObserver) 
	{
		eval('aObserver.canDrop = '+
			aObserver.canDrop.toSource().replace(
				'{',
				'{ var TSTTabBrowser = this;'
			).replace(
				/\.screenX/g, '[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.positionProp]'
			).replace(
				/\.width/g, '[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.sizeProp]'
			).replace( // Tab Mix Plus
				/\.screenY/g, '[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.invertedPositionProp]'
			).replace( // Tab Mix Plus
				/\.height/g, '[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.invertedSizeProp]'
			).replace(
				/(return true;)/,
				<><![CDATA[
					if (!(function(aSelf) {
try{
							if (!aDragSession.sourceNode ||
								aDragSession.sourceNode.parentNode != aSelf.mTabContainer ||
								aEvent.target.localName != 'tab')
								return true;

							if (aEvent.target.getAttribute(TreeStyleTabService.kCOLLAPSED) == 'true')
								return false;

							var info = TSTTabBrowser.treeStyleTab.getDropAction(aEvent, aDragSession);
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
							var info = TSTTabBrowser.treeStyleTab.getDropAction(aEvent, aDragSession);

							if (!info.target || info.target != TreeStyleTabService.evaluateXPath(
									'child::xul:tab[@'+TreeStyleTabService.kDROP_POSITION+']',
									aSelf.mTabContainer,
									XPathResult.FIRST_ORDERED_NODE_TYPE
								).singleNodeValue)
								TSTTabBrowser.treeStyleTab.clearDropPosition();

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
				'$1; this.treeStyleTab.clearDropPosition();'
			)
		);

		eval('aObserver.onDrop = '+
			aObserver.onDrop.toSource().replace(
				'{',
				<><![CDATA[
					{
						var TSTTabBrowser = this;
						TSTTabBrowser.treeStyleTab.clearDropPosition();
						var dropActionInfo = TSTTabBrowser.treeStyleTab.getDropAction(aEvent, aDragSession);
				]]></>
			).replace( // Firefox 2
				/(if \(aDragSession[^\)]+\) \{)/,
				<><![CDATA[$1
					if (TSTTabBrowser.treeStyleTab.processDropAction(dropActionInfo, aDragSession.sourceNode))
						return;
				]]></>
			).replace( // Firefox 3
				'if (accelKeyPressed) {',
				<><![CDATA[
					if (TSTTabBrowser.treeStyleTab.processDropAction(dropActionInfo, draggedTab))
						return;
					$&]]></>
			).replace( // Firefox 3, duplication of tab
				/(this.selectedTab = newTab;(\s*\})?)/g,
				<><![CDATA[$1;
					if (dropActionInfo.position == TreeStyleTabService.kDROP_ON)
						TSTTabBrowser.treeStyleTab.attachTabTo(newTab, dropActionInfo.target);
				]]></>
			).replace( // Firefox 3, dragging tab from another window
				'else if (draggedTab) {',
				<><![CDATA[$&
					if (TSTTabBrowser.treeStyleTab.processDropAction(dropActionInfo, draggedTab))
						return;
				]]></>
			).replace(
				/(this.loadOneTab\([^;]+\));/,
				<><![CDATA[
					TSTTabBrowser.treeStyleTab.processDropAction(dropActionInfo, $1);
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
						TSTTabBrowser.treeStyleTab.processDropAction(dropActionInfo, TSTTabBrowser.loadOneTab(getShortcutOrURI(url), null, null, null, bgLoad, false));
						return;
					}
				]]></>
			)
		);
	},
 
	overrideGlobalFunctions : function() 
	{
		var funcs;
		var func;
		var overwriteProcess;

		overwriteProcess = function(aName) {
			var overwroteFunc;
			eval('overwroteFunc = '+aName);
			if (overwroteFunc.toSource().indexOf('function BrowserLoadURL') != 0) return;
			eval(aName + ' = '+
				overwroteFunc.toSource().replace(
					'aTriggeringEvent && aTriggeringEvent.altKey',
					<><![CDATA[
						TreeStyleTabService.checkReadyToOpenNewTab({
							uri      : url,
							external : {
								newTab : TreeStyleTabService.getTreePref('urlbar.loadDifferentDomainToNewTab'),
								forceChild : TreeStyleTabService.getTreePref('urlbar.loadDifferentDomainToNewTab.asChild')
							},
							internal : { newTab : TreeStyleTabService.getTreePref('urlbar.loadSameDomainToNewChildTab') },
							modifier : $&,
							invert   : TreeStyleTabService.getTreePref('urlbar.invertDefaultBehavior')
						})
					]]></>
				)
			);
		};
		overwriteProcess('window.BrowserLoadURL');
		if ('permaTabs' in window &&
			'window.BrowserLoadURL' in permaTabs.utils.wrappedFunctions)
			overwriteProcess('permaTabs.utils.wrappedFunctions["window.BrowserLoadURL"]');


		eval('nsContextMenu.prototype.openLinkInTab = '+
			nsContextMenu.prototype.openLinkInTab.toSource().replace(
				'{',
				<><![CDATA[$&
					TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
				]]></>
			)
		);
		eval('nsContextMenu.prototype.openFrameInTab = '+
			nsContextMenu.prototype.openFrameInTab.toSource().replace(
				'{',
				<><![CDATA[$&
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
					$&]]></>
			)
		);
		eval('nsContextMenu.prototype.viewBGImage = '+
			nsContextMenu.prototype.viewBGImage.toSource().replace(
				'openUILink(',
				<><![CDATA[
					if (String(whereToOpenLink(e, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]></>
			)
		);
		eval('nsContextMenu.prototype.addDictionaries = '+
			nsContextMenu.prototype.addDictionaries.toSource().replace(
				'openUILinkIn(',
				<><![CDATA[
					if (where.indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]></>
			)
		);

		funcs = 'handleLinkClick __splitbrowser__handleLinkClick __ctxextensions__handleLinkClick __treestyletab__highlander__origHandleLinkClick'.split(' ');
		for (var i in funcs)
		{
			if (funcs[i] in window && /^function handleLinkClick/.test(window[funcs[i]].toString()))
				eval('window.'+funcs[i]+' = '+
					window[funcs[i]].toSource().replace(
						/(openNewTabWith\()/g,
						<><![CDATA[
							if (!TreeStyleTabService.checkToOpenChildTab(event.target.ownerDocument.defaultView)) TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView);
							$1]]></>
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
								if (!('TMP_contentAreaClick' in window) && // do nothing for Tab Mix Plus
									TreeStyleTabService.checkToOpenChildTab()) {
									TreeStyleTabService.stopToOpenChildTab();
									urlSecurityCheck(href, 'nodePrincipal' in linkNode.ownerDocument ? linkNode.ownerDocument.nodePrincipal : linkNode.ownerDocument.location.href );
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

		funcs = 'contentAreaClick __contentAreaClick __ctxextensions__contentAreaClick'.split(' ');
		overwriteProcess = function(aName) {
			var overwroteFunc;
			eval('overwroteFunc = '+aName);
			if (overwroteFunc.toSource().indexOf('function contentAreaClick') != 0) return;
			eval(aName + ' = '+
				overwroteFunc.toSource().replace(
					/(openWebPanel\([^\(]+\("webPanels"\), wrapper.href\);event.preventDefault\(\);return false;\})/,
					<><![CDATA[
						$1
						else if (!('TMP_contentAreaClick' in window) && // do nothing for Tab Mix Plus
							TreeStyleTabService.checkReadyToOpenNewTab({
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
		};
		for (var i in funcs)
		{
			if (funcs[i] in window && window[funcs[i]])
				overwriteProcess('window.'+funcs[i]);
		}
		if ('permaTabs' in window &&
			'window.contentAreaClick' in permaTabs.utils.wrappedFunctions)
			overwriteProcess('permaTabs.utils.wrappedFunctions["window.contentAreaClick"]');

		funcs = 'gotoHistoryIndex BrowserForward BrowserBack __rewindforward__BrowserForward __rewindforward__BrowserBack'.split(' ');
		for (var i in funcs)
		{
			if (funcs[i] in window &&
				/^function (gotoHistoryIndex|BrowserForward|BrowserBack)/.test(window[funcs[i]].toString()))
				eval('window.'+funcs[i]+' = '+
					window[funcs[i]].toSource().replace(
						/(openUILinkIn\()/g,
						<><![CDATA[
							if (where == 'tab' || where == 'tabshifted')
								TreeStyleTabService.readyToOpenChildTab();
							$1]]></>
					)
				);
		}

		func = 'BrowserGoHome' in window ? 'BrowserGoHome' : 'BrowserHomeClick' ;
		overwriteProcess = function(aName, aFunc) {
			var overwroteFunc;
			eval('overwroteFunc = '+aName);
			if (overwroteFunc.toSource().indexOf('function '+func) != 0) return;
			eval(aName + ' = '+
				overwroteFunc.toSource().replace(
					'gBrowser.loadTabs(',
					<><![CDATA[
						TreeStyleTabService.readyToOpenNewTabGroup(gBrowser);
						$&]]></>
				)
			);
		};
		overwriteProcess('window.'+func);
		if ('permaTabs' in window &&
			'window.BrowserHomeClick' in permaTabs.utils.wrappedFunctions)
			overwriteProcess('permaTabs.utils.wrappedFunctions["window.BrowserHomeClick"]');

		eval('nsBrowserAccess.prototype.openURI = '+
			nsBrowserAccess.prototype.openURI.toSource().replace(
				/(switch\s*\(aWhere\))/,
				<><![CDATA[
					if (aOpener &&
						aWhere == Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWTAB) {
						TreeStyleTabService.readyToOpenChildTab(aOpener);
					}
					$1]]></>
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
					$&]]></>
			)
		);
	},
  
	destroy : function() 
	{
		window.removeEventListener('unload', this, false);

		this.destroyTabBrowser(gBrowser);

		this.endListenKeyEvents();

		document.getElementById('contentAreaContextMenu').removeEventListener('popupshowing', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.removeEventListener('SubBrowserAdded', this, false);
		appcontent.removeEventListener('SubBrowserRemoveRequest', this, false);

		this.removePrefListener(this);
	},
	 
	destroyTabBrowser : function(aTabBrowser) 
	{
		if (aTabBrowser.localName != 'tabbrowser') return;
		aTabBrowser.treeStyleTab.destroy();
		delete aTabBrowser.treeStyleTab;
	},
   
/* Event Handling */ 
	 
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'DOMContentLoaded':
				this.preInit();
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

			case 'keydown':
				this.onKeyDown(aEvent);
				return;

			case 'keyup':
			case 'keypress':
				this.onKeyRelease(aEvent);
				return;

			case 'SubBrowserAdded':
				this.initTabBrowser(aEvent.originalTarget.browser);
				return;

			case 'SubBrowserRemoveRequest':
				this.destroyTabBrowser(aEvent.originalTarget.browser);
				return;
		}
	},
	 
	onKeyDown : function(aEvent) 
	{
		var b = this.browser;
		if (!b || !b.treeStyleTab) return;
		var sv = b.treeStyleTab;

		if (this.delayedAutoShowDone)
			this.cancelDelayedAutoShow();

		this.accelKeyPressed = (
				navigator.platform.match(/mac/i) ?
					(aEvent.metaKey || (aEvent.keyCode == aEvent.DOM_VK_META)) :
					(aEvent.ctrlKey || (aEvent.keyCode == aEvent.DOM_VK_CONTROL))
			);
		if (
			b.mTabContainer.childNodes.length > 1 &&
			!aEvent.altKey &&
			this.accelKeyPressed
			) {
			if (this.getTreePref('tabbar.autoShow.accelKeyDown') && 
				!sv.tabbarShown &&
				!this.delayedAutoShowTimer) {
				this.delayedAutoShowTimer = window.setTimeout(
					function(aSelf) {
						aSelf.delayedAutoShowDone = true;
						sv.showTabbar(sv.kSHOWN_BY_SHORTCUT);
					},
					this.getTreePref('tabbar.autoShow.accelKeyDown.delay'),
					this
				);
				this.delayedAutoShowDone = false;
			}
		}
		else {
			sv.hideTabbar();
		}
	},
	cancelDelayedAutoShow : function()
	{
		if (this.delayedAutoShowTimer) {
			window.clearTimeout(this.delayedAutoShowTimer);
			this.delayedAutoShowTimer = null;
		}
	},
	delayedAutoShowTimer : null,
	delayedAutoShowDone : true,
	accelKeyPressed : false,
 
	onKeyRelease : function(aEvent) 
	{
		var b = this.browser;
		if (!b || !b.treeStyleTab) return;
		var sv = b.treeStyleTab;

		this.cancelDelayedAutoShow();

		var scrollDown,
			scrollUp;
		var isMac = navigator.platform.match(/mac/i);

		this.accelKeyPressed = (isMac ? aEvent.metaKey : aEvent.ctrlKey );

		var standBy = scrollDown = scrollUp = (!aEvent.altKey && (isMac ? aEvent.metaKey : aEvent.ctrlKey ));

		scrollDown = scrollDown && (
				!aEvent.shiftKey &&
				(
					aEvent.keyCode == aEvent.DOM_VK_TAB ||
					aEvent.keyCode == aEvent.DOM_VK_PAGE_DOWN
				)
			);

		scrollUp = scrollUp && (
				aEvent.shiftKey ? (aEvent.keyCode == aEvent.DOM_VK_TAB) : (aEvent.keyCode == aEvent.DOM_VK_PAGE_UP)
			);

		if (
			scrollDown ||
			scrollUp ||
			( // when you release "shift" key
				sv.tabbarShown &&
				standBy && !aEvent.shiftKey &&
				aEvent.charCode == 0 && aEvent.keyCode == 16
			)
			) {
			if (this.getTreePref('tabbar.autoShow.tabSwitch'))
				sv.showTabbar(sv.kSHOWN_BY_SHORTCUT);
			return;
		}

		if (sv.showHideTabbarReason == sv.kSHOWN_BY_SHORTCUT)
			sv.hideTabbar();
	},
 	
	keyEventListening : false, 
 
	startListenKeyEvents : function() 
	{
		if (this.keyEventListening) return;
		window.addEventListener('keydown',  this, true);
		window.addEventListener('keyup',    this, true);
		window.addEventListener('keypress', this, true);
		this.keyEventListening = true;
	},
 
	endListenKeyEvents : function() 
	{
		if (!this.keyEventListening) return;
		window.removeEventListener('keydown',  this, true);
		window.removeEventListener('keyup',    this, true);
		window.removeEventListener('keypress', this, true);
		this.keyEventListening = false;
	},
  
	onTabbarResized : function(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		if (this.autoHideMode == this.kAUTOHIDE_MODE_SHRINK &&
			!b.treeStyleTab.tabbarExpanded)
			this.setTreePref('tabbar.shrunkenWidth', b.mStrip.boxObject.width);
		else
			this.setTreePref('tabbar.width', b.mStrip.boxObject.width);
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
			if (!this.hasChildTabs(aTabs[i])) continue;
			hasSubTree = true;
			break;
		}
		if (hasSubTree)
			aMenuItem.removeAttribute('hidden');
		else
			aMenuItem.setAttribute('hidden', true);
	},
  
/* Commands */ 
	
	removeTabSubTree : function(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = aTabOrTabs;
		if (!(tabs instanceof Array)) {
			tabs = [aTabOrTabs];
		}

		var b = this.getTabBrowserFromChild(tabs[0]);
		var descendant = [];
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			descendant = descendant.concat(b.treeStyleTab.getDescendantTabs(tabs[i]));
		}

		if (aOnlyChildren)
			tabs = this.cleanUpTabsArray(descendant);
		else
			tabs = this.cleanUpTabsArray(tabs.concat(descendant));

		var max = tabs.length;
		if (!max) return;

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
	
	cleanUpTabsArray : function(aTabs) 
	{
		var b = this.getTabBrowserFromChild(aTabs[0]);

		var self = this;
		aTabs = aTabs.map(function(aTab) { return aTab.getAttribute(self.kID); });
		aTabs.sort();
		aTabs = aTabs.join('|').replace(/([^\|]+)(\|\1)+/g, '$1').split('|');

		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			aTabs[i] = b.treeStyleTab.getTabById(aTabs[i]);
		}
		return aTabs;
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
   
	collapseExpandAllSubtree : function(aCollapse) 
	{
		this.ObserverService.notifyObservers(
			window,
			'TreeStyleTab:collapseExpandAllSubtree',
			(aCollapse ? 'collapse' : 'open' )
		);
	},
 
	registerAttachTabPostProcess : function(aProcess) 
	{
		this._attachTabPostProcesses.push(aProcess);
	},
	_attachTabPostProcesses : [],
 
	registerTabFocusAllowance : function(aProcess) 
	{
		this._tabFocusAllowance.push(aProcess);
	},
	_tabFocusAllowance : [],
 
	registerCollapseExpandPostProcess : function(aProcess) 
	{
		this._collapseExpandPostProcess.push(aProcess);
	},
	_collapseExpandPostProcess : [],
  
/* Pref Listener */ 
	
	domains : [ 
		'extensions.treestyletab',
		'browser.link.open_newwindow.restriction.override',
		'browser.tabs.loadFolderAndReplace.override'
	],
 
	observe : function(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.levelMargin':
				this.baseLebelMargin = value;
				this.ObserverService.notifyObservers(null, 'TreeStyleTab:levelMarginModified', value);
				break;

			case 'extensions.treestyletab.tabbar.autoHide.mode':
				this.autoHideMode = this.getTreePref('tabbar.autoHide.mode');
			case 'extensions.treestyletab.tabbar.autoShow.accelKeyDown':
			case 'extensions.treestyletab.tabbar.autoShow.tabSwitch':
			case 'extensions.treestyletab.tabbar.autoShow.feedback':
				if (
					this.autoHideMode &&
					(
						this.getTreePref('tabbar.autoShow.accelKeyDown') ||
						this.getTreePref('tabbar.autoShow.tabSwitch') ||
						this.getTreePref('tabbar.autoShow.feedback')
					)
					)
					this.startListenKeyEvents();
				else
					this.endListenKeyEvents();
				break;

			case 'browser.link.open_newwindow.restriction.override':
			case 'browser.tabs.loadFolderAndReplace.override':
				var target = aPrefName.replace('.override', '');
				this.setPref(target, this.getPref(aPrefName));
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

window.addEventListener('DOMContentLoaded', TreeStyleTabService, true);
window.addEventListener('load', TreeStyleTabService, false);
 
