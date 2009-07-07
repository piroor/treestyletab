var TreeStyleTabService = { 
	/* attributes */
	kID                 : 'treestyletab-id',
	kCHILDREN           : 'treestyletab-children',
	kPARENT             : 'treestyletab-parent',
	kANCESTOR           : 'treestyletab-ancestors',
	kNEST               : 'treestyletab-nest',
	kINSERT_BEFORE      : 'treestyletab-insert-before',

	kSUBTREE_COLLAPSED  : 'treestyletab-subtree-collapsed',
	kCOLLAPSED          : 'treestyletab-collapsed',
	kCOLLAPSED_DONE     : 'treestyletab-collapsed-done',
	kCOLLAPSING         : 'treestyletab-collapsing',
	kALLOW_COLLAPSE     : 'treestyletab-allow-subtree-collapse',

	kX_OFFSET           : 'treestyletab-x-offset',
	kY_OFFSET           : 'treestyletab-y-offset',

	kTABBAR_POSITION    : 'treestyletab-tabbar-position',
	kMODE               : 'treestyletab-mode',

	kHIDE_NEWTAB        : 'treestyletab-hide-newtab-button',
	kHIDE_ALLTABS       : 'treestyletab-hide-alltabs-button',
	kSTYLE              : 'treestyletab-style',
	kFIRSTTAB_BORDER    : 'treestyletab-firsttab-border',
	kAUTOHIDE           : 'treestyletab-tabbar-autohide',
	kFIXED              : 'treestyletab-tabbar-fixed',
	kRESIZING           : 'treestyletab-tabbar-resizing',
	kTRANSPARENT        : 'treestyletab-tabbar-transparent',
	kINDENTED           : 'treestyletab-tabs-indented',

	kTAB_INVERTED          : 'treestyletab-tab-inverted',
	kTAB_CONTENTS_INVERTED : 'treestyletab-tab-contents-inverted',
	kCLOSEBOX_INVERTED     : 'treestyletab-closebox-inverted',
	kSCROLLBAR_INVERTED    : 'treestyletab-scrollbar-inverted',

	kTWISTY_HOVER       : 'treestyletab-twisty-hover',
	kTWISTY_STYLE       : 'treestyletab-twisty-style',

	kDROP_POSITION      : 'treestyletab-drop-position',

	/* classes */
	kTWISTY                : 'treestyletab-twisty',
	kTWISTY_CONTAINER      : 'treestyletab-twisty-container',
	kDROP_MARKER           : 'treestyletab-drop-marker',
	kDROP_MARKER_CONTAINER : 'treestyletab-drop-marker-container',
	kCOUNTER               : 'treestyletab-counter',
	kCOUNTER_CONTAINER     : 'treestyletab-counter-container',
	kSPLITTER              : 'treestyletab-splitter',
	kTABBAR_TOGGLER        : 'treestyletab-tabbar-toggler',
	kSTRINGBUNDLE          : 'treestyletab-stringbundle',

	kMENUITEM_REMOVESUBTREE_SELECTION : 'multipletab-selection-item-removeTabSubTree',

	kFOCUS_ALL     : 0,
	kFOCUS_VISIBLE : 1,

	kDROP_BEFORE : -1,
	kDROP_ON     : 0,
	kDROP_AFTER  : 1,

	kACTION_MOVE      : 1 << 0,
	kACTION_STAY      : 1 << 1,
	kACTION_DUPLICATE : 1 << 2,
	kACTION_IMPORT    : 1 << 3,
	kACTION_NEWTAB    : 1 << 4,
	kACTION_ATTACH    : 1 << 10,
	kACTION_PART      : 1 << 11,
	kACTIONS_FOR_SOURCE      : (1 << 0) | (1 << 1),
	kACTIONS_FOR_DESTINATION : (1 << 2) | (1 << 3),

	kTABBAR_TOP    : 1 << 0,
	kTABBAR_BOTTOM : 1 << 1,
	kTABBAR_LEFT   : 1 << 2,
	kTABBAR_RIGHT  : 1 << 3,

	kTABBAR_HORIZONTAL : (1 << 0) | (1 << 1),
	kTABBAR_VERTICAL   : (1 << 2) | (1 << 3),

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
	kSHOWN_BY_SHORTCUT  : 1 << 0,
	kSHOWN_BY_MOUSEMOVE : 1 << 1,
	kSHOWN_BY_FEEDBACK  : 1 << 2,
	kKEEP_SHOWN_ON_MOUSEOVER : (1 << 0) | (1 << 1) | (1 << 2),

	kTRANSPARENT_NONE : 0,
	kTRANSPARENT_PART : 1,
	kTRANSPARENT_FULL : 2,
	kTRANSPARENT_STYLE : ['none', 'part', 'full'],

	kINSERT_FISRT : 0,
	kINSERT_LAST  : 1,

	baseIndent : 12,
	shouldDetectClickOnIndentSpaces : true,

	smoothScrollEnabled  : true,
	smoothScrollDuration : 150,

	animationEnabled : true,
	indentDuration   : 200,
	collapseDuration : 150,

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

	get EffectiveTLD()
	{
		if (!('_EffectiveTLD' in this)) {
			this._EffectiveTLD = 'nsIEffectiveTLDService' in Components.interfaces ?
				Components
					.classes['@mozilla.org/network/effective-tld-service;1']
					.getService(Components.interfaces.nsIEffectiveTLDService) :
				null ;
		}
		return this._EffectiveTLD;
	},
//	_EffectiveTLD : null,

	get isGecko18() {
		if (this._isGecko18 === null)
			this._isGecko18 = this.Comparator.compare(this.XULAppInfo.version, '3.0') < 0;
		return this._isGecko18;
	},
	_isGecko18 : null,
	get isGecko19() {
		if (this._isGecko19 === null)
			this._isGecko19 = this.Comparator.compare(this.XULAppInfo.version, '3.0') >= 0;
		return this._isGecko19;
	},
	_isGecko19 : null,
	get XULAppInfo() {
		if (!this._XULAppInfo) {
			this._XULAppInfo = Components
					.classes['@mozilla.org/xre/app-info;1']
					.getService(Components.interfaces.nsIXULAppInfo);
		}
		return this._XULAppInfo;
	},
	_XULAppInfo : null,
	get Comparator() {
		if (!this._Comparator) {
			this._Comparator = Components
					.classes['@mozilla.org/xpcom/version-comparator;1']
					.getService(Components.interfaces.nsIVersionComparator);
		}
		return this._Comparator;
	},
	_Comparator : null,

	get stringbundle() {
		if (!this._stringbundle) {
			this._stringbundle = document.getElementById(this.kSTRINGBUNDLE);
		}
		return this._stringbundle;
	},
	_stringbundle : null,

	get tabbrowserBundle() {
		if (!this._tabbrowserBundle) {
			this._tabbrowserBundle = document.getElementById('treestyletab-tabbrowserBundle');
		}
		return this._tabbrowserBundle;
	},
	_tabbrowserBundle : null,
	
/* API */ 
	
	readyToOpenChildTab : function(aFrameOrTabBrowser, aMultiple, aInsertBefore) /* PUBLIC API */ 
	{
		if (!this.getTreePref('autoAttachNewTabsAsChildren')) return;

		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);

		var parentTab = this.getTabFromFrame(frame, ownerBrowser);
		ownerBrowser.treeStyleTab.ensureTabInitialized(parentTab);
		var parentId = parentTab.getAttribute(this.kID);

		var refId = null;
		if (aInsertBefore) {
			ownerBrowser.treeStyleTab.ensureTabInitialized(parentTab);
			refId = aInsertBefore.getAttribute(this.kID);
		}

		ownerBrowser.treeStyleTab.readyToAttachNewTab   = true;
		ownerBrowser.treeStyleTab.readyToAttachMultiple = aMultiple || false ;
		ownerBrowser.treeStyleTab.multipleCount         = 0;
		ownerBrowser.treeStyleTab.parentTab             = parentId;
		ownerBrowser.treeStyleTab.insertBefore          = refId;
	},
 
	readyToOpenNewTabGroup : function(aFrameOrTabBrowser) /* PUBLIC API */ 
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
 
	stopToOpenChildTab : function(aFrameOrTabBrowser) /* PUBLIC API */ 
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
 
	checkToOpenChildTab : function(aFrameOrTabBrowser) /* PUBLIC API */ 
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

		var targetHost  = this._getDomainFromURI(info.uri);
		var currentTab  = this.getTabFromFrame(frame);
		var currentURI  = frame.location.href;
		var currentHost = this._getDomainFromURI(currentURI);
		var parentTab   = b.treeStyleTab.getParentTab(currentTab);
		var parentURI   = parentTab ? parentTab.linkedBrowser.currentURI : null ;
		var parentHost  = this._getDomainFromURI(parentURI);

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
	checkReadyToOpenNewTabOnLocationBar : function(aURI, aModifier)
	{
		return this.checkReadyToOpenNewTab({
			uri      : aURI,
			external : {
				newTab     : this.getTreePref('urlbar.loadDifferentDomainToNewTab'),
				forceChild : this.getTreePref('urlbar.loadDifferentDomainToNewTab.asChild')
			},
			internal : { newTab : this.getTreePref('urlbar.loadSameDomainToNewChildTab') },
			modifier : aModifier,
			invert   : this.getTreePref('urlbar.invertDefaultBehavior')
		});
	},
	_getDomainFromURI : function(aURI)
	{
		if (!aURI) return null;

		if (this.getTreePref('useEffectiveTLD') && this.EffectiveTLD) {
			try {
				var uri = aURI;
				if (!(uri instanceof Ci.nsIURI)) uri = this.makeURIFromSpec(uri);
				var domain = this.EffectiveTLD.getBaseDomain(uri, 0);
				if (domain) return domain;
			}
			catch(e) {
			}
		}

		var str = aURI;
		if (str instanceof Ci.nsIURI) str = aURI.spec;
		return /^\w+:\/\/([^:\/]+)/.test(getShortcutOrURI(str)) ?
				RegExp.$1 :
				null ;
	},
 
	setTabbarWidth : function(aWidth, aForceExpanded) /* PUBLIC API */ 
	{
		var treeStyleTab = gBrowser.treeStyleTab;
		if (aForceExpanded ||
			treeStyleTab.autoHideShown ||
			treeStyleTab.autoHideMode !=  this.kAUTOHIDE_MODE_SHRINK)
			this.setTreePref('tabbar.width', aWidth);
		else
			this.setTreePref('tabbar.shrunkenWidth', aWidth);
	},
 
	setContentWidth : function(aWidth, aKeepWindowSize) /* PUBLIC API */ 
	{
		var treeStyleTab = gBrowser.treeStyleTab;
		var tabbarWidth = treeStyleTab.splitterWidth + (treeStyleTab.isVertical ? gBrowser.mStrip.boxObject.width : 0 );
		var contentWidth = gBrowser.boxObject.width - tabbarWidth;
		if (aKeepWindowSize ||
			window.fullScreen ||
			window.windowState != Components.interfaces.nsIDOMChromeWindow.STATE_NORMAL) {
			this.setTabbarWidth(Math.max(10, gBrowser.boxObject.width - aWidth));
		}
		else if (tabbarWidth + aWidth <= screen.availWidth) {
			window.resizeBy(aWidth - contentWidth, 0);
		}
		else {
			window.resizeBy(screen.availWidth - window.outerWidth, 0);
			this.setTabbarWidth(gBrowser.boxObject.width - aWidth);
		}
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
		var pos = this.getTreePref('tabbar.position');
		var pref = (pos == 'left' || pos == 'right') ?
					'tabbar.fixed.vertical' :
					'tabbar.fixed.horizontal' ;
		this.setTreePref(pref, !this.getTreePref(pref));
	},
 
	changeTabbarPosition : function(aNewPosition) /* PUBLIC API */ 
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
		if (!tab || !this.hasChildTabs(tab)) return false;

		var expression = 'ancestor-or-self::*[@class="'+this.kTWISTY+'"]';
		if (this.canExpandTwistyArea(this.getTabBrowserFromChild(tab)))
			expression += ' | ancestor-or-self::*[@class="tab-icon" and ancestor::xul:tabbrowser[@'+this.kMODE+'="vertical"]]';

		return this.evaluateXPath(
				expression,
				aEvent.originalTarget || aEvent.target,
				XPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
	canExpandTwistyArea : function(aTabBrowser)
	{
		return (
				this.expandTwistyArea &&
				this._expandTwistyAreaAllowance.every(function(aFunc) {
					return aFunc.call(this, aTabBrowser);
				}, this)
			);
	},
	expandTwistyArea : true,
 
	isEventFiredOnClickable : function(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(" button toolbarbutton scrollbar popup menupopup tooltip ", concat(" ", local-name(), " "))]',
				aEvent.originalTarget,
				XPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isAccelKeyPressed : function(aEvent) 
	{
		var isMac = navigator.platform.toLowerCase().indexOf('mac') > -1;
		var nsIDOMKeyEvent = Components.interfaces.nsIDOMKeyEvent;
		if ( // this is releasing of the accel key!
			(aEvent.type == 'keyup') &&
			(aEvent.keyCode == (isMac ? nsIDOMKeyEvent.DOM_VK_META : nsIDOMKeyEvent.DOM_VK_CONTROL ))
			) {
			return false;
		}
		return isMac ?
			(aEvent.metaKey || (aEvent.keyCode == nsIDOMKeyEvent.DOM_VK_META)) :
			(aEvent.ctrlKey || (aEvent.keyCode == nsIDOMKeyEvent.DOM_VK_CONTROL)) ;
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
			var xpathResult = (aContext.ownerDocument || aContext || document).evaluate(
					aExpression,
					(aContext || document),
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
 
	getBoxObjectFor : function(aNode) 
	{
		return window['piro.sakura.ne.jp'].boxObject.getBoxObjectFor(aNode);
	},
 
	getTabFromEvent : function(aEvent) 
	{
		return this.getTabFromChild(aEvent.originalTarget || aEvent.target);
	},
 
	getTabFromFrame : function(aFrame, aTabBrowser) 
	{
		var b = aTabBrowser || this.browser;
		var docShell = aFrame.top
			.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIWebNavigation)
			.QueryInterface(Components.interfaces.nsIDocShell);
		var tabs = this.getTabs(b);
		var tab;
		for (var i = 0, maxi = tabs.snapshotLength; i < maxi; i++)
		{
			tab = tabs.snapshotItem(i);
			if (tab.linkedBrowser.docShell == docShell)
				return tab;
		}
		return null;
	},
 
	getTabFromChild : function(aTab) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:tab[ancestor::xul:tabbrowser]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
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
 
	getPropertyPixelValue : function(aElementOrStyle, aProp) 
	{
		var style = aElementOrStyle instanceof Components.interfaces.nsIDOMCSSStyleDeclaration ?
					aElementOrStyle :
					window.getComputedStyle(aElementOrStyle, null) ;
		return Number(style.getPropertyValue(aProp).replace(/px$/, ''));
	},
 
	getGroupTabURI : function(aTitle) 
	{
		return 'about:treestyletab-group?'+encodeURIComponent(aTitle);
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
 
	getTabs : function(aTabBrowser) 
	{
		return this.evaluateXPath(
				'descendant::xul:tab',
				aTabBrowser.mTabContainer
			);
	},
 
	getTabsArray : function(aTabBrowser) 
	{
		var tabs = this.getTabs(aTabBrowser);
		var array = [];
		for (var i = 0, maxi = tabs.snapshotLength; i < maxi; i++)
		{
			array.push(tabs.snapshotItem(i));
		}
		return array;
	},
 
	getFirstTab : function(aTabBrowser) 
	{
		return this.evaluateXPath(
				'descendant::xul:tab[1]',
				aTabBrowser.mTabContainer,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getLastTab : function(aTabBrowser) 
	{
		return this.evaluateXPath(
				'descendant::xul:tab[last()]',
				aTabBrowser.mTabContainer,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getNextTab : function(aTab) 
	{
		return this.evaluateXPath(
				'following-sibling::xul:tab[1]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getPreviousTab : function(aTab) 
	{
		return this.evaluateXPath(
				'preceding-sibling::xul:tab[1]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getNextVisibleTab : function(aTab) 
	{
		return this.evaluateXPath(
				'following-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")][1]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getPreviousVisibleTab : function(aTab) 
	{
		return this.evaluateXPath(
				'preceding-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")][1]',
				aTab,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getLastVisibleTab : function(aTab) 
	{
		return this.evaluateXPath(
				'child::xul:tab[not(@'+this.kCOLLAPSED+'="true")][last()]',
				aTab.parentNode,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
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
		if (aTab.getAttribute(this.kCOLLAPSED) == 'true') return -1;
		return this.evaluateXPath(
				'count(preceding-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")])',
				aTab,
				XPathResult.NUMBER_TYPE
			).numberValue;
	},
  
/* tree manipulations */ 
	
	get rootTabs() /* PUBLIC API */ 
	{
		return this.getArrayFromXPathResult(
				this.evaluateXPath(
					'child::xul:tab[not(@'+this.kNEST+') or @'+this.kNEST+'="0" or @'+this.kNEST+'=""]',
					this.browser.mTabContainer
				)
			);
	},
 
	getParentTab : function(aTab) /* PUBLIC API */ 
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
 
	getRootTab : function(aTab) /* PUBLIC API */ 
	{
		var parent = aTab;
		var root   = aTab;
		while (parent = this.getParentTab(parent))
		{
			root = parent;
		}
		return root;
	},
 
	getNextSiblingTab : function(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		var parentTab = this.getParentTab(aTab);

		if (!parentTab) {
			var next = aTab;
			do {
				next = next.nextSibling;
			}
			while (next &&
					next.nodeType == Node.ELEMENT_NODE &&
					this.getParentTab(next));
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
 
	getPreviousSiblingTab : function(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		var parentTab = this.getParentTab(aTab);

		if (!parentTab) {
			var prev = aTab;
			do {
				prev = prev.previousSibling;
			}
			while (prev &&
					prev.nodeType == Node.ELEMENT_NODE &&
					this.getParentTab(prev));
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
 
	getChildTabs : function(aTab, aAllTabsArray) /* PUBLIC API */ 
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
 
	hasChildTabs : function(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return false;
		return aTab.hasAttribute(this.kCHILDREN);
	},
 
	getDescendantTabs : function(aTab) /* PUBLIC API */ 
	{
		var tabs = [];
		this.getChildTabs(aTab, tabs);
		return tabs;
	},
 
	getFirstChildTab : function(aTab) /* PUBLIC API */ 
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
 
	getLastChildTab : function(aTab) /* PUBLIC API */ 
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
 
	getLastDescendantTab : function(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		var tabs = this.getDescendantTabs(aTab);
		return tabs.length ? tabs[tabs.length-1] : null ;
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
 
	getXOffsetOfTab : function(aTab) 
	{
		return this.evaluateXPath(
			'sum((self::* | preceding-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")])/attribute::'+this.kX_OFFSET+')',
			aTab,
			XPathResult.NUMBER_TYPE
		).numberValue;
	},
	getYOffsetOfTab : function(aTab)
	{
		return this.evaluateXPath(
			'sum((self::* | preceding-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")])/attribute::'+this.kY_OFFSET+')',
			aTab,
			XPathResult.NUMBER_TYPE
		).numberValue;
	},
 
	isGroupTab : function(aTab) 
	{
		return (
			aTab.linkedBrowser.sessionHistory.count == 1 &&
			aTab.linkedBrowser.currentURI.spec.indexOf('about:treestyletab-group') > -1
		);
	},
  
/* Session Store API */ 
	
	getTabValue : function(aTab, aKey) 
	{
		var value = '';
		try {
			value = this.SessionStore.getTabValue(aTab, aKey);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI) {
			var TMPValue = aTab.getAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey);
			if (TMPValue) value = TMPValue;
		}

		return value;
	},
 
	setTabValue : function(aTab, aKey, aValue) 
	{
		if (!aValue) return this.deleteTabValue(aTab, aKey);

		aTab.setAttribute(aKey, aValue);
		try {
			this.SessionStore.setTabValue(aTab, aKey, aValue);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI)
			aTab.setAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey, aValue);

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

		if (this.useTMPSessionAPI)
			aTab.removeAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey);
	},
 
	useTMPSessionAPI : false, 
	kTMP_SESSION_DATA_PREFIX : 'tmp-session-data-',
   
/* Initializing */ 
	
	preInit : function() 
	{
		if (this.preInitialized) return;
		this.preInitialized = true;

		window.removeEventListener('DOMContentLoaded', this, true);
		if (!document.getElementById('content')) return;

		window.addEventListener('SSTabRestoring', this, true);

		if ('swapBrowsersAndCloseOther' in document.getElementById('content')) {
			var source = window.BrowserStartup.toSource();
			if (source.indexOf('!MultipleTabService.tearOffSelectedTabsFromRemote()') > -1) {
				eval('window.BrowserStartup = '+source.replace(
					'!MultipleTabService.tearOffSelectedTabsFromRemote()',
					'!TreeStyleTabService.tearOffSubTreeFromRemote() && $&'
				));
			}
			else {
				eval('window.BrowserStartup = '+source.replace(
					'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);',
					'if (!TreeStyleTabService.tearOffSubTreeFromRemote()) { $& }'
				));
			}
		}

		eval('nsBrowserAccess.prototype.openURI = '+
			nsBrowserAccess.prototype.openURI.toSource().replace(
				/(switch\s*\(aWhere\))/,
				<![CDATA[
					if (aOpener &&
						aWhere == Components.interfaces.nsIBrowserDOMWindow.OPEN_NEWTAB) {
						TreeStyleTabService.readyToOpenChildTab(aOpener);
					}
					$1]]>
			)
		);

		this.overrideExtensionsPreInit(); // hacks.js

		this.registerTabFocusAllowance(this.defaultTabFocusAllowance);
	},
	preInitialized : false,
	
	defaultTabFocusAllowance : function(aBrowser) 
	{
		var tab = aBrowser.selectedTab;
		return (
			!this.getPref('browser.tabs.selectOwnerOnClose') ||
			!tab.owner ||
			(
				aBrowser._removingTabs &&
				aBrowser._removingTabs.indexOf(tab.owner) > -1
			)
		);
	},
  
	init : function() 
	{
		if (!('gBrowser' in window)) return;

		if (this.initialized) return;
		this.initialized = true;

		if (!this.preInitialized) {
			this.preInit();
		}
		window.removeEventListener('SSTabRestoring', this, true);

		window.removeEventListener('load', this, false);
		window.addEventListener('unload', this, false);
		document.getElementById('contentAreaContextMenu').addEventListener('popupshowing', this, false);
		document.addEventListener('popupshowing', this, false);
		document.addEventListener('popuphiding', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);

		this.addPrefListener(this);
		this.ObserverService.addObserver(this, 'private-browsing-change-granted', false);

		this.overrideExtensionsOnInitBefore(); // hacks.js
		this.overrideGlobalFunctions();
		this.initTabBrowser(gBrowser);
		this.overrideExtensionsOnInitAfter(); // hacks.js

		this.processRestoredTabs();

		this.onPrefChange('extensions.treestyletab.indent');
		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.mode');
		this.onPrefChange('extensions.treestyletab.clickOnIndentSpaces.enabled');
		this.onPrefChange('browser.link.open_newwindow.restriction.override');
		this.onPrefChange('browser.tabs.loadFolderAndReplace.override');
		this.onPrefChange('extensions.treestyletab.tabbar.style');
		this.onPrefChange('extensions.treestyletab.tabbar.scroll.smooth');
		this.onPrefChange('extensions.treestyletab.tabbar.scroll.duration');
		this.onPrefChange('extensions.treestyletab.animation.enabled');
		this.onPrefChange('extensions.treestyletab.animation.indent.duration');
		this.onPrefChange('extensions.treestyletab.animation.collapse.duration');
		this.onPrefChange('extensions.treestyletab.twisty.expandSensitiveArea');
	},
	initialized : false,
	
	initTabBrowser : function(aTabBrowser) 
	{
		if (aTabBrowser.localName != 'tabbrowser') return;
		aTabBrowser.treeStyleTab = new TreeStyleTabBrowser(aTabBrowser);
		aTabBrowser.treeStyleTab.init();
	},
 
	updateTabDNDObserver : function(aObserver) 
	{
		var canDropFunctionName = '_setEffectAllowedForDataTransfer' in aObserver ?
				'_setEffectAllowedForDataTransfer' : // Firefox 3.1 or later
				'canDrop' ; // Firefox 3.0.x
		eval('aObserver.'+canDropFunctionName+' = '+
			aObserver[canDropFunctionName].toSource().replace(
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
				/(return (?:true|dt.effectAllowed = "copyMove");)/,
				<![CDATA[
					if (!(function(aSelf) {
try{
							var node = TST_DRAGSESSION.sourceNode;
							var tab = TSTTabBrowser.treeStyleTab.getTabFromChild(node);
							if (!node ||
								!tab ||
								tab.parentNode != aSelf.mTabContainer)
								return true;

							tab = TSTTabBrowser.treeStyleTab.getTabFromEvent(aEvent);
							if (tab && tab.getAttribute(TreeStyleTabService.kCOLLAPSED) == 'true')
								return false;

							var info = TSTTabBrowser.treeStyleTab.getDropAction(aEvent, TST_DRAGSESSION);
							return info.canDrop;
}
catch(e) {
	dump('TreeStyleTabService::canDrop\n'+e+'\n');
	return false;
}
						})(TSTTabBrowser)) {
						return TST_DRAGDROP_DISALLOW_RETRUN_VALUE;
					}
					$1
				]]>
			).replace(
				/TST_DRAGSESSION/g,
				(canDropFunctionName == 'canDrop' ?
					'aDragSession' :
					'TSTTabBrowser.treeStyleTab.getCurrentDragSession()'
				)
			).replace(
				/TST_DRAGDROP_DISALLOW_RETRUN_VALUE/g,
				(canDropFunctionName == 'canDrop' ?
					'false' :
					'dt.effectAllowed = "none"'
				)
			)
		);

		var dragOverFunctionName = '_onDragOver' in aObserver ?
				'_onDragOver' : // Firefox 3.1 or later
				'onDragOver' ; // Firefox 3.0.x
		eval('aObserver.'+dragOverFunctionName+' = '+
			aObserver[dragOverFunctionName].toSource().replace(
				'{',
				<![CDATA[
					{
						var TSTTabBrowser = this;
						if ((function(aSelf) {
try{
							window['piro.sakura.ne.jp'].autoScroll.processAutoScroll(aEvent);

							var info = TSTTabBrowser.treeStyleTab.getDropAction(aEvent, TST_DRAGSESSION);

							if (!info.target || info.target != TreeStyleTabService.evaluateXPath(
									'child::xul:tab[@'+TreeStyleTabService.kDROP_POSITION+']',
									aSelf.mTabContainer,
									XPathResult.FIRST_ORDERED_NODE_TYPE
								).singleNodeValue)
								TSTTabBrowser.treeStyleTab.clearDropPosition();

							if (TST_DRAGDROP_DISALLOW_CHECK) return true;

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
				]]>
			).replace(
				/TST_DRAGSESSION/g,
				(canDropFunctionName == 'canDrop' ?
					'aDragSession' :
					'null'
				)
			).replace(
				/TST_DRAGDROP_DISALLOW_CHECK/g,
				(canDropFunctionName == 'canDrop' ?
					'!aSelf.canDrop(aEvent, aDragSession)' :
					'aSelf._setEffectAllowedForDataTransfer(aEvent) == "none"'
				)
			)
		);

		var dragExitFunctionName = '_onDragLeave' in aObserver ?
				'_onDragLeave' : // Firefox 3.1 or later
				'onDragExit' ; // Firefox 3.0.x
		eval('aObserver.'+dragExitFunctionName+' = '+
			aObserver[dragExitFunctionName].toSource().replace(
				/(this.mTabDropIndicatorBar\.[^;]+;)/,
				'$1; this.treeStyleTab.clearDropPosition();'
			)
		);

		var dropFunctionName = '_onDrop' in aObserver ?
				'_onDrop' : // Firefox 3.1 or later
				'onDrop' ; // Firefox 3.0.x
		eval('aObserver.'+dropFunctionName+' = '+
			aObserver[dropFunctionName].toSource().replace(
				'{',
				<![CDATA[
					{
						var TSTTabBrowser = this;
						TSTTabBrowser.treeStyleTab.clearDropPosition();
						var dropActionInfo = TSTTabBrowser.treeStyleTab.getDropAction(aEvent, TST_DRAGSESSION);
				]]>
			).replace( // Firefox 2
				/(if \(aDragSession[^\)]+\) \{)/,
				<![CDATA[$1
					if (TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, TST_DRAGSESSION.sourceNode))
						return;
				]]>
			).replace( // Firefox 3.0.x, 3.1 or later
				/(if \((accelKeyPressed|isCopy|dropEffect == "copy")\) {)/,
				<![CDATA[
					if (TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, draggedTab))
						return;
					$1]]>
			).replace( // Firefox 3, duplication of tab
				/(this.selectedTab = newTab;)(\s*\})?/g,
				<![CDATA[$1;
					if (dropActionInfo.position == TreeStyleTabService.kDROP_ON)
						TSTTabBrowser.treeStyleTab.attachTabTo(newTab, dropActionInfo.target);
				$2]]>
			).replace( // Firefox 3, dragging tab from another window
				'else if (draggedTab) {',
				<![CDATA[$&
					if (TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, draggedTab))
						return;
				]]>
			).replace(
				/(this.loadOneTab\([^;]+\));/,
				<![CDATA[
					TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, $1);
					return;
				]]>
			).replace(
				'document.getBindingParent(aEvent.originalTarget).localName != "tab"',
				'!TreeStyleTabService.getTabFromEvent(aEvent)'
			).replace(
				'var tab = aEvent.target;',
				<![CDATA[$&
					if (
						tab.getAttribute('locked') == 'true' || // Tab Mix Plus
						TreeStyleTabService.getTreePref('loadDroppedLinkToNewChildTab') ||
						dropActionInfo.position != TreeStyleTabService.kDROP_ON
						) {
						TSTTabBrowser.treeStyleTab.performDrop(dropActionInfo, TSTTabBrowser.loadOneTab(getShortcutOrURI(url), null, null, null, bgLoad, false));
						return;
					}
				]]>
			).replace(
				/TST_DRAGSESSION/g,
				(canDropFunctionName == 'canDrop' ?
					'aDragSession' :
					'TSTTabBrowser.treeStyleTab.getCurrentDragSession()'
				)
			)
		);
	},
 
	overrideGlobalFunctions : function() 
	{
//		window.__treestyletab__BrowserCustomizeToolbar = window.BrowserCustomizeToolbar;
//		window.BrowserCustomizeToolbar = function() {
//			TreeStyleTabService.destroyBar();
//			window.__treestyletab__BrowserCustomizeToolbar.call(window);
//		};

		let (toolbox) {
			toolbox = document.getElementById('browser-toolbox') || // Firefox 3
						document.getElementById('navigator-toolbox'); // Firefox 2
			if (toolbox.customizeDone) {
				toolbox.__treestyletab__customizeDone = toolbox.customizeDone;
				toolbox.customizeDone = function(aChanged) {
					this.__treestyletab__customizeDone(aChanged);
					TreeStyleTabService.initBar();
				};
			}
			if ('BrowserToolboxCustomizeDone' in window) {
				window.__treestyletab__BrowserToolboxCustomizeDone = window.BrowserToolboxCustomizeDone;
				window.BrowserToolboxCustomizeDone = function(aChanged) {
					window.__treestyletab__BrowserToolboxCustomizeDone.apply(window, arguments);
					TreeStyleTabService.initBar();
				};
			}
			this.initBar();
			toolbox = null;
		}

		this._splitFunctionNames(<![CDATA[
			window.permaTabs.utils.wrappedFunctions["window.BrowserLoadURL"]
			window.BrowserLoadURL
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function BrowserLoadURL/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				'aTriggeringEvent && aTriggeringEvent.altKey',
				'TreeStyleTabService.checkReadyToOpenNewTabOnLocationBar(url, $&)'
			));
			source = null;
		}, this);


		eval('nsContextMenu.prototype.openLinkInTab = '+
			nsContextMenu.prototype.openLinkInTab.toSource().replace(
				'{',
				<![CDATA[$&
					TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
				]]>
			)
		);
		eval('nsContextMenu.prototype.openFrameInTab = '+
			nsContextMenu.prototype.openFrameInTab.toSource().replace(
				'{',
				<![CDATA[$&
					TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
				]]>
			)
		);
		var viewImageMethod = ('viewImage' in nsContextMenu.prototype) ? 'viewImage' : 'viewMedia' ;
		eval('nsContextMenu.prototype.'+viewImageMethod+' = '+
			nsContextMenu.prototype[viewImageMethod].toSource().replace(
				'openUILink(',
				<![CDATA[
					if (String(whereToOpenLink(e, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]>
			)
		);
		eval('nsContextMenu.prototype.viewBGImage = '+
			nsContextMenu.prototype.viewBGImage.toSource().replace(
				'openUILink(',
				<![CDATA[
					if (String(whereToOpenLink(e, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]>
			)
		);
		eval('nsContextMenu.prototype.addDictionaries = '+
			nsContextMenu.prototype.addDictionaries.toSource().replace(
				'openUILinkIn(',
				<![CDATA[
					if (where.indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(this.target.ownerDocument.defaultView);
					$&]]>
			)
		);

		this._splitFunctionNames(<![CDATA[
			window.duplicateTab.handleLinkClick
			window.__treestyletab__highlander__origHandleLinkClick
			window.__splitbrowser__handleLinkClick
			window.__ctxextensions__handleLinkClick
			window.handleLinkClick
		]]>).some(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function handleLinkClick/.test(source))
				return false;
			eval(aFunc+' = '+source.replace(
				/(openNewTabWith\()/g,
				<![CDATA[
					if (!TreeStyleTabService.checkToOpenChildTab(event.target.ownerDocument.defaultView)) TreeStyleTabService.readyToOpenChildTab(event.target.ownerDocument.defaultView);
					$1]]>
			).replace(
				/(event.ctrlKey|event.metaKey)/,
				<![CDATA[
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
				]]>
			).replace(
				/* あらゆるリンクからタブを開く設定の時に、アクセルキーが押されていた場合は
				   反転された動作（通常のリンク読み込み）を行う */
				'return false;case 1:',
				<![CDATA[
						if (!('TMP_contentAreaClick' in window) && // do nothing for Tab Mix Plus
							TreeStyleTabService.checkToOpenChildTab()) {
							TreeStyleTabService.stopToOpenChildTab();
							if (TreeStyleTabService.isAccelKeyPressed(event)) {
								if (linkNode)
									urlSecurityCheck(href,
										'nodePrincipal' in linkNode.ownerDocument ?
											linkNode.ownerDocument.nodePrincipal :
											linkNode.ownerDocument.location.href
									);
								var postData = {};
								href = getShortcutOrURI(href, postData);
								if (!href) return false;
								loadURI(href, null, postData.value, false);
							}
						}
						return false;
					case 1:
				]]>
			));
			source = null;
			return true;
		}, this);

		this._splitFunctionNames(<![CDATA[
			window.permaTabs.utils.wrappedFunctions["window.contentAreaClick"]
			window.__contentAreaClick
			window.__ctxextensions__contentAreaClick
			window.contentAreaClick
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function contentAreaClick/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				/((openWebPanel\([^\;]+\);|PlacesUIUtils.showMinimalAddBookmarkUI\([^;]+\);)event.preventDefault\(\);return false;\})/,
				<![CDATA[
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
				]]>
			));
			source = null;
		}, this);

		this._splitFunctionNames(<![CDATA[
			window.duplicateTab.gotoHistoryIndex
			window.duplicateTab.BrowserBack
			window.duplicateTab.BrowserForward
			window.__rewindforward__BrowserForward
			window.__rewindforward__BrowserBack
			window.gotoHistoryIndex
			window.BrowserForward
			window.BrowserBack
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function (gotoHistoryIndex|BrowserForward|BrowserBack)/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				/(openUILinkIn\()/g,
				<![CDATA[
					if (where == 'tab' || where == 'tabshifted')
						TreeStyleTabService.readyToOpenChildTab();
					$1]]>
			));
			source = null;
		}, this);

		this._splitFunctionNames(<![CDATA[
			permaTabs.utils.wrappedFunctions["window.BrowserHomeClick"]
			window.BrowserHomeClick
			window.BrowserGoHome
		]]>).forEach(function(aFunc) {
			let source = this._getFunctionSource(aFunc);
			if (!source || !/^\(?function (BrowserHomeClick|BrowserGoHome)/.test(source))
				return;
			eval(aFunc+' = '+source.replace(
				'gBrowser.loadTabs(',
				<![CDATA[
					TreeStyleTabService.readyToOpenNewTabGroup(gBrowser);
					$&]]>
			));
			source = null;
		}, this);

		eval('FeedHandler.loadFeed = '+
			FeedHandler.loadFeed.toSource().replace(
				'openUILink(',
				<![CDATA[
					if (String(whereToOpenLink(event, false, true)).indexOf('tab') == 0)
						TreeStyleTabService.readyToOpenChildTab(gBrowser);
					$&]]>
			)
		);

		// Firefox 3 full screen
		if ('FullScreen' in window && '_animateUp' in FullScreen) {
			eval('FullScreen._animateUp = '+
				FullScreen._animateUp.toSource().replace(
					'gBrowser.mStrip.boxObject.height',
					'((gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION) != "top") ? 0 : gBrowser.mStrip.boxObject.height)'
				)
			);
			eval('FullScreen.mouseoverToggle = '+
				FullScreen.mouseoverToggle.toSource().replace(
					'gBrowser.mStrip.setAttribute("moz-collapsed", !aShow);',
					'if (gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION) == "top") { $& }'
				)
			);
			eval('FullScreen.toggle = '+
				FullScreen.toggle.toSource().replace(
					'{',
					<![CDATA[{
						var treeStyleTab = gBrowser.treeStyleTab;
						if (gBrowser.getAttribute(treeStyleTab.kTABBAR_POSITION) != 'top') {
							if (window.fullScreen)
								treeStyleTab.endAutoHideForFullScreen();
							else
								treeStyleTab.startAutoHideForFullScreen();
						}
					]]>
				)
			);
		}
	},
	_splitFunctionNames : function(aString)
	{
		return String(aString)
				.split(/\s+/)
				.map(function(aString) {
					return aString
							.replace(/\/\*.*\*\//g, '')
							.replace(/\/\/.+$/, '')
							.replace(/^\s+|\s+$/g, '');
				});
	},
	_getFunctionSource : function(aFunc)
	{
		var func;
		try {
			eval('func = '+aFunc);
		}
		catch(e) {
			return null;
		}
		return func ? func.toSource() : null ;
	},
 
	initBar : function() 
	{
		var bar = document.getElementById('urlbar');
		if (!bar) return;

		var source;
		if (
			'handleCommand' in bar &&
			(source = bar.handleCommand.toSource()) &&
			source.indexOf('TreeStyleTabService') < 0
			) {
			eval('bar.handleCommand = '+source.replace(
				'aTriggeringEvent && aTriggeringEvent.altKey',
				'TreeStyleTabService.checkReadyToOpenNewTabOnLocationBar(url, $&)'
			));
		}
		bar    = null;
		source = null;
	},
  
	destroy : function() 
	{
		window.removeEventListener('unload', this, false);

		window['piro.sakura.ne.jp'].animationManager.stop();
		this.destroyTabBrowser(gBrowser);

		this.endListenKeyEvents();

		document.getElementById('contentAreaContextMenu').removeEventListener('popupshowing', this, false);
		document.removeEventListener('popupshowing', this, false);
		document.removeEventListener('popuphiding', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.removeEventListener('SubBrowserAdded', this, false);
		appcontent.removeEventListener('SubBrowserRemoveRequest', this, false);

		this.removePrefListener(this);
		this.ObserverService.removeObserver(this, 'private-browsing-change-granted');
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

			case 'SSTabRestoring':
				this.onTabRestored(aEvent);
				return;

			case 'popupshowing':
				if (aEvent.currentTarget.id == 'contentAreaContextMenu' &&
					aEvent.target == aEvent.currentTarget) {
					this.initContextMenu();
				}
				if (!this.evaluateXPath(
						'local-name() = "tooltip" or local-name() ="panel" or '+
						'parent::*/ancestor-or-self::*[local-name()="popup" or local-name()="menupopup"]',
						aEvent.originalTarget,
						XPathResult.BOOLEAN_TYPE
					).booleanValue) {
					this.popupMenuShown = true;
					window.setTimeout(function(aSelf, aPopup) {
						if (!aPopup.boxObject.width || !aPopup.boxObject.height)
							aSelf.popupMenuShown = false;
					}, 10, this, aEvent.originalTarget);
				}
				return;

			case 'popuphiding':
				if (!this.evaluateXPath(
						'local-name() = "tooltip" or local-name() ="panel" or '+
						'parent::*/ancestor-or-self::*[local-name()="popup" or local-name()="menupopup"]',
						aEvent.originalTarget,
						XPathResult.BOOLEAN_TYPE
					).booleanValue) {
					this.popupMenuShown = false;
				}
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

		if (this.delayedAutoShowForShortcutDone)
			this.cancelDelayedAutoShowForShortcut();

		this.accelKeyPressed = this.isAccelKeyPressed(aEvent);
		if (
			this.getTabs(b).snapshotLength > 1 &&
			!aEvent.altKey &&
			this.accelKeyPressed
			) {
			if (this.getTreePref('tabbar.autoShow.accelKeyDown') &&
				!sv.autoHideShown &&
				!sv.delayedAutoShowTimer &&
				!this.delayedAutoShowForShortcutTimer) {
				this.delayedAutoShowForShortcutTimer = window.setTimeout(
					function(aSelf) {
						this.delayedAutoShowForShortcutDone = true;
						sv.showTabbar(sv.kSHOWN_BY_SHORTCUT);
						sv = null;
						b = null;
					},
					this.getTreePref('tabbar.autoShow.accelKeyDown.delay'),
					this
				);
				this.delayedAutoShowForShortcutDone = false;
			}
		}
		else {
			sv.hideTabbar();
		}
	},
	cancelDelayedAutoShowForShortcut : function()
	{
		if (this.delayedAutoShowForShortcutTimer) {
			window.clearTimeout(this.delayedAutoShowForShortcutTimer);
			this.delayedAutoShowForShortcutTimer = null;
		}
	},
	delayedAutoShowForShortcutTimer : null,
	delayedAutoShowForShortcutDone : true,
	accelKeyPressed : false,
 
	onKeyRelease : function(aEvent) 
	{
		var b = this.browser;
		if (!b || !b.treeStyleTab) return;
		var sv = b.treeStyleTab;

		this.cancelDelayedAutoShowForShortcut();

		var scrollDown,
			scrollUp;

		this.accelKeyPressed = this.isAccelKeyPressed(aEvent);

		var standBy = scrollDown = scrollUp = (!aEvent.altKey && this.accelKeyPressed);

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
				sv.autoHideShown &&
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
 
	updateAutoHideKeyListeners : function() 
	{
		if (
			this.getTreePref('tabbar.autoHide.mode') &&
			this.shouldListenKeyEvents
			) {
			this.startListenKeyEvents();
		}
		else {
			this.endListenKeyEvents();
		}
		window.setTimeout(function() {
			if (window.windowState != Components.interfaces.nsIDOMChromeWindow.STATE_NORMAL) return;
			window.resizeBy(-1,-1);
			window.resizeBy(1,1);
		}, 0);
	},
	
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
 
	keyEventListening : false, 
 
	get shouldListenKeyEvents() 
	{
		return this.getTreePref('tabbar.autoShow.accelKeyDown') ||
				this.getTreePref('tabbar.autoShow.tabSwitch') ||
				this.getTreePref('tabbar.autoShow.feedback');
	},
   
	onTabbarResized : function(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		if (!b.treeStyleTab.isVertical) {
			this.setTreePref('tabbar.height', b.mStrip.boxObject.height);
		}
		else {
			if (!b.treeStyleTab.tabbarExpanded)
				this.setTreePref('tabbar.shrunkenWidth', b.mStrip.boxObject.width);
			else
				this.setTreePref('tabbar.width', b.mStrip.boxObject.width);
		}
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
 
	showHideSubTreeMenuItem : function(aMenuItem, aTabs) 
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
 
	updateTabWidthPrefs : function(aPrefName) 
	{
		var expanded = this.getTreePref('tabbar.width');
		var shrunken = this.getTreePref('tabbar.shrunkenWidth');
		if (expanded <= shrunken) {
			this.tabbarWidthResetting = true;
			if (aPrefName == 'extensions.treestyletab.tabbar.width')
				this.setTreePref('tabbar.shrunkenWidth', parseInt(expanded / 1.5));
			else
				this.setTreePref('tabbar.width', parseInt(shrunken * 1.5));
			this.tabbarWidthResetting = false;
		}
	},
  
/* Tree Style Tabの初期化が行われる前に復元されたセッションについてツリー構造を復元 */ 
	
	_restoringTabs : [], 
 
	onTabRestored : function(aEvent) 
	{
		this._restoringTabs.push(aEvent.originalTarget);
	},
 
	processRestoredTabs : function() 
	{
		this._restoringTabs.forEach(function(aTab) {
			try {
				var b = this.getTabBrowserFromChild(aTab);
				if (b) b.treeStyleTab.restoreStructure(aTab);
			}
			catch(e) {
			}
		}, this);
		this._restoringTabs = [];
	},
  
/* Commands */ 
	
	removeTabSubTree : function(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = this._normalizeToTabs(aTabOrTabs, aOnlyChildren);
		if (!this.warnAboutClosingTabs(tabs.length))
			return;

		var b = this.getTabBrowserFromChild(tabs[0]);
		for (var i = tabs.length-1; i > -1; i--)
		{
			b.removeTab(tabs[i]);
		}
	},
	warnAboutClosingTabs : function(aTabsCount)
	{
		if (
			aTabsCount <= 1 ||
			!this.getPref('browser.tabs.warnOnClose')
			)
			return true;
		var promptService = Components
							.classes['@mozilla.org/embedcomp/prompt-service;1']
							.getService(Components.interfaces.nsIPromptService);
		var checked = { value:true };
		window.focus();
		var shouldClose = promptService.confirmEx(window,
				this.tabbrowserBundle.getString('tabs.closeWarningTitle'),
				this.tabbrowserBundle.getFormattedString('tabs.closeWarningMultipleTabs', [aTabsCount]),
				(promptService.BUTTON_TITLE_IS_STRING * promptService.BUTTON_POS_0) +
				(promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1),
				this.tabbrowserBundle.getString('tabs.closeButtonMultiple'),
				null, null,
				this.tabbrowserBundle.getString('tabs.closeWarningPromptMe'),
				checked
			) == 0;
		if (shouldClose && !checked.value)
			this.setPref('browser.tabs.warnOnClose', false);
		return shouldClose;
	},
	
	_normalizeToTabs : function(aTabOrTabs, aOnlyChildren) 
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

		return tabs;
	},
 
	cleanUpTabsArray : function(aTabs) 
	{
		var newTabs = [];
		aTabs.forEach(function(aTab) {
			if (!aTab.parentNode) return; // ignore removed tabs
			if (newTabs.indexOf(aTab) < 0) newTabs.push(aTab);
		});
		newTabs.sort(function(aA, aB) {
			return aA._tPos - aB._tPos;
		});
		return newTabs;
	},
  
	reloadTabSubTree : function(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = this._normalizeToTabs(aTabOrTabs, aOnlyChildren);
		var b = this.getTabBrowserFromChild(tabs[0]);
		for (var i = tabs.length-1; i > -1; i--)
		{
			b.reloadTab(tabs[i]);
		}
	},
 
	bookmarkTabSubTree : function(aTabOrTabs) 
	{
		var tabs = aTabOrTabs;
		if (!(tabs instanceof Array)) {
			tabs = [aTabOrTabs];
		}

		var b = this.getTabBrowserFromChild(tabs[0]);
		var bookmarkedTabs = [];
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			bookmarkedTabs.push(tabs[i]);
			bookmarkedTabs = bookmarkedTabs.concat(b.treeStyleTab.getDescendantTabs(tabs[i]));
		}

		if ('MultipleTabService' in window &&
			'addBookmarkFor' in MultipleTabService) {
			MultipleTabService.addBookmarkFor(bookmarkedTabs);
		}
		else {
			this._addBookmarkFor(bookmarkedTabs);
		}
	},
	
	_addBookmarkFor : function(aTabs) // from Multiple Tab Handler 
	{
		if (!aTabs) return;

		var b = this.getTabBrowserFromChild(aTabs[0]);

		if ('PlacesUIUtils' in window || 'PlacesUtils' in window) { // Firefox 3
			var utils = 'PlacesUIUtils' in window ? PlacesUIUtils : PlacesUtils ;
			utils.showMinimalAddMultiBookmarkUI(Array.slice(aTabs).map(this.addBookmarkTabsFilter));
			return;
		}

		var currentTabInfo;
		var tabsInfo = Array.slice(aTabs)
			.filter(function(aTab) {
				return aTab.parentNode; // ignore removed tabs
			})
			.map(function(aTab) {
				var webNav = aTab.linkedBrowser.webNavigation;
				var url    = webNav.currentURI.spec;
				var name   = '';
				var charSet, description;
				try {
					var doc = webNav.document;
					name = doc.title || url;
					charSet = doc.characterSet;
					description = BookmarksUtils.getDescriptionFromDocument(doc);
				}
				catch (e) {
					name = url;
				}
				return {
					name        : name,
					url         : url,
					charset     : charSet,
					description : description
				};
			});

		window.openDialog(
			'chrome://browser/content/bookmarks/addBookmark2.xul',
			'',
			BROWSER_ADD_BM_FEATURES,
			(aTabs.length == 1 ?
				tabsInfo[0] :
				{
					name             : gNavigatorBundle.getString('bookmarkAllTabsDefault'),
					bBookmarkAllTabs : true,
					objGroup         : tabsInfo
				}
			)
		);
	},
	addBookmarkTabsFilter : function(aTab)
	{
		return aTab.linkedBrowser.currentURI;
	},
  
	openSelectionLinks : function(aFrame) 
	{
		aFrame = this.getCurrentFrame(aFrame);

		var b = this.browser;
		var links = this.getSelectionLinks(aFrame);
		if (!links.length) return;

		var referrer = this.makeURIFromSpec(aFrame.location.href);

		this.readyToOpenChildTab(aFrame, true);
		links.forEach(function(aLink, aIndex) {
			var tab = b.addTab(aLink.href, referrer);
			if (aIndex == 0 && !this.getPref('browser.tabs.loadInBackground'))
				b.selectedTab = tab;
		}, this);
		this.stopToOpenChildTab(aFrame);
	},
	
	getCurrentFrame : function(aFrame) 
	{
		if (aFrame) return aFrame;
		var targetWindow = document.commandDispatcher.focusedWindow;
		if (!targetWindow || targetWindow.top == window)
			targetWindow = this.browser.contentWindow;
		return targetWindow;
	},
 
	getSelectionLinks : function(aFrame) 
	{
		aFrame = this.getCurrentFrame(aFrame);

		var links = [];

		var selection = aFrame.getSelection();
		if (!selection || !selection.rangeCount)
			return links;

		for (var i = 0, maxi = selection.rangeCount; i < maxi; i++)
		{
			links = links.concat(this.getLinksInRange(selection.getRangeAt(i)));
		}
		return links;
	},
	
	getLinksInRange : function(aRange) 
	{
		// http://nanto.asablo.jp/blog/2008/10/18/3829312
		var links = [];
		if (aRange.collapsed) return links;

		var startCountExpression = 'count(preceding::*[@href])';
		var startNode = aRange.startContainer;
		if (startNode.nodeType == Node.ELEMENT_NODE) {
			if (aRange.startOffset < startNode.childNodes.length) {
				startNode = startNode.childNodes[aRange.startOffset];
			}
			else {
				startCountExpression += ' + count(descendant::*[@href])';
			}
		}
		var startCount = this.evaluateXPath(
				startCountExpression,
				startNode,
				XPathResult.NUMBER_TYPE
			).numberValue;

		var linksExpression = 'ancestor::*[@href] | preceding::*[@href]';
		var endNode = aRange.endContainer;
		if (endNode.nodeType == Node.ELEMENT_NODE) {
			if (aRange.endOffset < endNode.childNodes.length) {
				endNode = endNode.childNodes[aRange.endOffset];
			}
			else {
				linksExpression += ' | descendant-or-self::*[@href]';
			}
		}
		var linksResult = this.evaluateXPath(linksExpression, endNode);

		var allLinksCount = linksResult.snapshotLength;
		var contentRange = startNode.ownerDocument.createRange();
		if (startCount < allLinksCount) {
			var lastNode = this.evaluateXPath(
					'descendant-or-self::node()[not(child::node()) and not(following-sibling::node())]',
					linksResult.snapshotItem(startCount),
					XPathResult.FIRST_ORDERED_NODE_TYPE
				).singleNodeValue;
			contentRange.selectNodeContents(lastNode);
			contentRange.setStart(aRange.startContainer, aRange.startOffset);
			if (contentRange.collapsed) {
				startCount++;
			}
		}
		if (startCount < allLinksCount) {
			var firstNode = this.evaluateXPath(
					'descendant-or-self::node()[not(child::node()) and not(preceding-sibling::node())]',
					linksResult.snapshotItem(allLinksCount-1),
					XPathResult.FIRST_ORDERED_NODE_TYPE
				).singleNodeValue;
			contentRange.selectNodeContents(firstNode);
			contentRange.setEnd(aRange.endContainer, aRange.endOffset);
			if (contentRange.collapsed) {
				allLinksCount--;
			}
		}
		contentRange.detach();

		for (var i = startCount; i < allLinksCount; i++)
		{
			links.push(linksResult.snapshotItem(i));
		}
		return links;
	},
   
	collapseExpandAllSubtree : function(aCollapse) 
	{
		this.ObserverService.notifyObservers(
			window,
			'TreeStyleTab:collapseExpandAllSubtree',
			(aCollapse ? 'collapse' : 'open' )
		);
	},
 
	registerTabFocusAllowance : function(aProcess) /* PUBLIC API */ 
	{
		this._tabFocusAllowance.push(aProcess);
	},
	_tabFocusAllowance : [],
 
	registerExpandTwistyAreaAllowance : function(aProcess) /* PUBLIC API */ 
	{
		this._expandTwistyAreaAllowance.push(aProcess);
	},
	_expandTwistyAreaAllowance : [],
 
	tearOffSubTreeFromRemote : function() 
	{
		var remoteTab = window.arguments[0];
		var remoteWindow  = remoteTab.ownerDocument.defaultView;
		var remoteService = remoteWindow.TreeStyleTabService;
		var remoteMultipleTabService = remoteWindow.MultipleTabService;
		if (remoteService.hasChildTabs(remoteTab) ||
			(remoteMultipleTabService && remoteMultipleTabService.isSelected(remoteTab))) {
			var remoteBrowser = remoteService.getTabBrowserFromChild(remoteTab);
			if (remoteBrowser.treeStyleTab.isDraggingAllTabs(remoteTab)) {
				window.close();
			}
			else {
				var actionInfo = {
						action : this.kACTIONS_FOR_DESTINATION | this.kACTION_IMPORT
					};
				window.setTimeout(function() {
					var blankTab = gBrowser.selectedTab;
					gBrowser.treeStyleTab.performDrop(actionInfo, remoteTab);
					window.setTimeout(function() {
						gBrowser.removeTab(blankTab);

						remoteTab = null;
						remoteBrowser = null;
						remoteWindow = null
						remoteService = null;
						remoteMultipleTabService = null;
					}, 0);
				}, 0);
			}
			return true;
		}
		return false;
	},
  
	observe : function(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onPrefChange(aData);
				return;

			case 'private-browsing-change-granted':
				if (aData == 'enter')
					this.ObserverService.notifyObservers(window, 'TreeStyleTab:collapseExpandAllSubtree', 'expand-now');
				return;
		}
	},
 
/* Pref Listener */ 
	
	domains : [ 
		'extensions.treestyletab',
		'browser.link.open_newwindow.restriction.override',
		'browser.tabs.loadFolderAndReplace.override'
	],
 
	onPrefChange : function(aPrefName) 
	{
		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.indent':
				this.baseIndent = value;
				this.ObserverService.notifyObservers(null, 'TreeStyleTab:indentModified', value);
				break;

			case 'extensions.treestyletab.tabbar.autoHide.mode':
				// don't set on this time, because appearance of all tabbrowsers are not updated yet.
				// this.autoHideMode = this.getTreePref('tabbar.autoHide.mode');
			case 'extensions.treestyletab.tabbar.autoShow.accelKeyDown':
			case 'extensions.treestyletab.tabbar.autoShow.tabSwitch':
			case 'extensions.treestyletab.tabbar.autoShow.feedback':
				this.updateAutoHideKeyListeners();
				break;

			case 'extensions.treestyletab.tabbar.width':
			case 'extensions.treestyletab.tabbar.shrunkenWidth':
				this.updateTabWidthPrefs(aPrefName);
				break;

			case 'browser.link.open_newwindow.restriction.override':
			case 'browser.tabs.loadFolderAndReplace.override':
				this.setPref(aPrefName.replace('.override', ''), this.getPref(aPrefName));
				break;

			case 'extensions.treestyletab.clickOnIndentSpaces.enabled':
				this.shouldDetectClickOnIndentSpaces = this.getPref(aPrefName);
				break;

			case 'extensions.treestyletab.tabbar.scroll.smooth':
				this.smoothScrollEnabled = value;
				break;
			case 'extensions.treestyletab.tabbar.scroll.duration':
				this.smoothScrollDuration = value;
				break;

			case 'extensions.treestyletab.animation.enabled':
				this.animationEnabled = value;
				break;
			case 'extensions.treestyletab.animation.indent.duration':
				this.indentDuration = value;
				break;
			case 'extensions.treestyletab.animation.collapse.duration':
				this.collapseDuration = value;
				break;

			case 'extensions.treestyletab.tabbar.style':
			case 'extensions.treestyletab.tabbar.position':
				this.preLoadImagesForStyle([
					this.getPref('extensions.treestyletab.tabbar.style'),
					this.getPref('extensions.treestyletab.tabbar.position')
				].join('-'));
				break;

			case 'extensions.treestyletab.twisty.expandSensitiveArea':
				this.expandTwistyArea = value;
				break;

			default:
				break;
		}
	},
  
/* Save/Load Prefs */ 
	
	getTreePref : function(aPrefstring) 
	{
		return this.getPref('extensions.treestyletab.'+aPrefstring);
	},
 
	setTreePref : function(aPrefstring, aNewValue) 
	{
		return this.setPref('extensions.treestyletab.'+aPrefstring, aNewValue);
	}
   
}; 

TreeStyleTabService.__proto__ = window['piro.sakura.ne.jp'].prefs;
window.addEventListener('DOMContentLoaded', TreeStyleTabService, true);
window.addEventListener('load', TreeStyleTabService, false);
 
