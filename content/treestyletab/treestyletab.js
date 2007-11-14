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
		ownerBrowser.treeStyleTab.readyToAttachNewTab   = true;
		ownerBrowser.treeStyleTab.readyToAttachMultiple = aMultiple || false ;
		ownerBrowser.treeStyleTab.multipleCount         = 0;
		ownerBrowser.treeStyleTab.parentTab             = this.getTabFromFrame(frame, ownerBrowser).getAttribute(this.kID);
		ownerBrowser.treeStyleTab.insertBefore          = aInsertBefore ? aInsertBefore.getAttribute(this.kID) : null ;
	},
 
	readyToOpenNewTabGroup : function(aFrameOrTabBrowser) 
	{
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
		var b = aTabBrowser || this.getTabBrowserFromChildren(aTab);
		this.getTempTreeStyleTab(b).initTabAttributes(aTab);
	},
 
	initTabContents : function(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChildren(aTab);
		this.getTempTreeStyleTab(b).initTabContents(aTab);
	},
 
	initTabContentsOrder : function(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChildren(aTab);
		this.getTempTreeStyleTab(b).initTabContentsOrder(aTab);
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
		return 'SplitBrowser' in window ? SplitBrowser.activeBrowser : gBrowser ;
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
		return ('SplitBrowser' in window) ? this.getTabBrowserFromChildren(SplitBrowser.getSubBrowserAndBrowserFromFrame(aFrame.top).browser) : this.browser ;
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
		this.setTreePref('tabbar.autoHide.enabled',
			!this.getTreePref('tabbar.autoHide.enabled'));
	},
  
/* Initializing */ 
	
	init : function() 
	{
		if (!('gBrowser' in window)) return;

		window.removeEventListener('load', this, false);
		document.getElementById('contentAreaContextMenu').addEventListener('popupshowing', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);

		this.addPrefListener(this);

		this.overrideExtensionsBeforeInit(); // hacks.js
		this.overrideGlobalFunctions();
		this.initTabBrowser(gBrowser);
		this.overrideExtensionsAfterInit(); // hacks.js
		this.observe(null, 'nsPref:changed', 'extensions.treestyletab.levelMargin');
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
				/\.screenX/g, '[TreeStyleTabService.getTabBrowserFromChildren(TSTTabBrowser).treeStyleTab.positionProp]'
			).replace(
				/\.width/g, '[TreeStyleTabService.getTabBrowserFromChildren(TSTTabBrowser).treeStyleTab.sizeProp]'
			).replace( // Tab Mix Plus
				/\.screenY/g, '[TreeStyleTabService.getTabBrowserFromChildren(TSTTabBrowser).treeStyleTab.invertedPositionProp]'
			).replace( // Tab Mix Plus
				/\.height/g, '[TreeStyleTabService.getTabBrowserFromChildren(TSTTabBrowser).treeStyleTab.invertedSizeProp]'
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
			).replace(
				/(if \(aDragSession[^\)]+\) \{)/,
				'$1'+<><![CDATA[
					if (TSTTabBrowser.treeStyleTab.processDropAction(dropActionInfo, aDragSession.sourceNode))
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
							!browser.treeStyleTab.parentTab) {
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
		window.removeEventListener('unload', this, false);

		this.destroyTabBrowser(gBrowser);

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
 
	onTabbarResized : function(aEvent) 
	{
		this.setPref(
			'extensions.treestyletab.tabbar.width',
			TreeStyleTabService.getTabBrowserFromChildren(aEvent.currentTarget)
				.mStrip.boxObject.width
		);
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
			if (!aTabs[i].hasAttribute(this.kCHILDREN)) continue;
			hasSubTree = true;
			break;
		}
		if (hasSubTree)
			aMenuItem.removeAttribute('hidden');
		else
			aMenuItem.setAttribute('hidden', true);
	},
  
/* Commands */ 
	
	removeTabSubTree : function(aTabOrTabs) 
	{
		var tabs = aTabOrTabs;
		if (!(tabs instanceof Array)) {
			tabs = [aTabOrTabs];
		}

		var b = this.getTabBrowserFromChildren(tabs[0]);
		var descendant = [];
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			descendant = descendant.concat(b.treeStyleTab.getDescendantTabs(tabs[i]));
		}
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
		var b = this.getTabBrowserFromChildren(aTabs[0]);

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
    
/* Pref Listener */ 
	
	domain : 'extensions.treestyletab', 
 
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
 	
