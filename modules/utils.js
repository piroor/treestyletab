/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is SHIMODA Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro@p.club.ne.jp>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
 
var EXPORTED_SYMBOLS = ['TreeStyleTabUtils']; 

var Cc = Components.classes;
var Ci = Components.interfaces;
 
var TreeStyleTabUtils = { 
	
/* attributes */ 
	kID                 : 'treestyletab-id',
	kCHILDREN           : 'treestyletab-children',
	kPARENT             : 'treestyletab-parent',
	kANCESTOR           : 'treestyletab-ancestors',
	kNEST               : 'treestyletab-nest',
	kINSERT_BEFORE      : 'treestyletab-insert-before',
	kINSERT_AFTER       : 'treestyletab-insert-after',

	kID_RESTORING       : 'treestyletab-id-restoring',
	kCHILDREN_RESTORING : 'treestyletab-children-restoring',

	kSUBTREE_COLLAPSED  : 'treestyletab-subtree-collapsed',
	kCOLLAPSED          : 'treestyletab-collapsed',
	kCOLLAPSED_DONE     : 'treestyletab-collapsed-done',
	kCOLLAPSING         : 'treestyletab-collapsing',
	kALLOW_COLLAPSE     : 'treestyletab-allow-subtree-collapse',

	kX_OFFSET           : 'treestyletab-x-offset',
	kY_OFFSET           : 'treestyletab-y-offset',

	kTABBAR_POSITION    : 'treestyletab-tabbar-position',
	kMODE               : 'treestyletab-mode',

	kHIDE_ALLTABS       : 'treestyletab-hide-alltabs-button',
	kSTYLE              : 'treestyletab-style',
	kFIRSTTAB_BORDER    : 'treestyletab-firsttab-border',
	kFIXED              : 'treestyletab-tabbar-fixed',
	kRESIZING           : 'treestyletab-tabbar-resizing',
	kINDENTED           : 'treestyletab-tabs-indented',

	kTAB_INVERTED          : 'treestyletab-tab-inverted',
	kTAB_CONTENTS_INVERTED : 'treestyletab-tab-contents-inverted',
	kCLOSEBOX_INVERTED     : 'treestyletab-closebox-inverted',
	kSCROLLBAR_INVERTED    : 'treestyletab-scrollbar-inverted',

	kTWISTY_HOVER       : 'treestyletab-twisty-hover',
	kTWISTY_STYLE       : 'treestyletab-twisty-style',

	kDROP_POSITION      : 'treestyletab-drop-position',
	kDRAG_TYPE_TABBAR   : 'application/x-moz-treestyletab-tabbrowser-tabbar',
	kDROP_POSITION_UNKNOWN : 'unknown',
	kTABBAR_MOVE_FORCE  : 'force',
	kTABBAR_MOVE_NORMAL : 'normal',
 
/* classes */ 
	kTWISTY                : 'treestyletab-twisty',
	kTWISTY_CONTAINER      : 'treestyletab-twisty-container',
	kDROP_MARKER           : 'treestyletab-drop-marker',
	kDROP_MARKER_CONTAINER : 'treestyletab-drop-marker-container',
	kCOUNTER               : 'treestyletab-counter',
	kCOUNTER_CONTAINER     : 'treestyletab-counter-container',
	kSPLITTER              : 'treestyletab-splitter',
	kTABBAR_TOGGLER        : 'treestyletab-tabbar-toggler',

	kMENUITEM_REMOVESUBTREE_SELECTION : 'multipletab-selection-item-removeTabSubtree',
 
/* other constant values */ 
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

	kINSERT_FISRT : 0,
	kINSERT_LAST  : 1,
 
/* base variables */ 
	baseIndent : 12,
	shouldDetectClickOnIndentSpaces : true,

	smoothScrollEnabled  : true,
	smoothScrollDuration : 150,

	animationEnabled : true,
	indentDuration   : 200,
	collapseDuration : 150,

	expandTwistyArea : true,
 
	get SessionStore() { 
		if (!this._SessionStore) {
			this._SessionStore = Cc['@mozilla.org/browser/sessionstore;1'].getService(Ci.nsISessionStore);
		}
		return this._SessionStore;
	},
	_SessionStore : null,

	get ObserverService() {
		if (!this._ObserverService) {
			this._ObserverService = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService);
		}
		return this._ObserverService;
	},
	_ObserverService : null,

	get IOService() {
		if (!this._IOService) {
			this._IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
		}
		return this._IOService;
	},
	_IOService : null,

	get WindowMediator() {
		if (!this._WindowMediator) {
			this._WindowMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
		}
		return this._WindowMediator;
	},
	_WindowMediator : null,

	get EffectiveTLD()
	{
		if (!('_EffectiveTLD' in this)) {
			this._EffectiveTLD = 'nsIEffectiveTLDService' in Ci ?
				Cc['@mozilla.org/network/effective-tld-service;1'].getService(Ci.nsIEffectiveTLDService) :
				null ;
		}
		return this._EffectiveTLD;
	},
//	_EffectiveTLD : null,

	get PromptService()
	{
		if (!this._PromptService) {
			this._PromptService = Cc['@mozilla.org/embedcomp/prompt-service;1'].getService(Ci.nsIPromptService);
		}
		return this._PromptService;
	},
	_PromptService : null,

	get XULAppInfo() {
		if (!this._XULAppInfo) {
			this._XULAppInfo = Cc['@mozilla.org/xre/app-info;1'].getService(Ci.nsIXULAppInfo);
		}
		return this._XULAppInfo;
	},
	_XULAppInfo : null,
	get Comparator() {
		if (!this._Comparator) {
			this._Comparator = Cc['@mozilla.org/xpcom/version-comparator;1'].getService(Ci.nsIVersionComparator);
		}
		return this._Comparator;
	},
	_Comparator : null,
 
	init : function TSTUtils_init() 
	{
		if (this._initialized) return;

		this.isMac = Cc['@mozilla.org/network/protocol;1?name=http']
						.getService(Ci.nsIHttpProtocolHandler)
						.QueryInterface(Ci.nsIProtocolHandler)
						.platform
						.toLowerCase()
						.indexOf('mac') > -1;

		this.addPrefListener(this);
		this.ObserverService.addObserver(this, 'private-browsing-change-granted', false);

		this._tabbarPositionHistory.push(this.currentTabbarPosition);

		this.onPrefChange('extensions.treestyletab.indent');
		this.onPrefChange('extensions.treestyletab.clickOnIndentSpaces.enabled');
		this.onPrefChange('browser.link.open_newwindow.restriction.override');
		this.onPrefChange('browser.tabs.loadFolderAndReplace.override');
		this.onPrefChange('browser.tabs.insertRelatedAfterCurrent.override');
		this.onPrefChange('extensions.treestyletab.tabbar.scroll.smooth');
		this.onPrefChange('extensions.treestyletab.tabbar.scroll.duration');
		this.onPrefChange('extensions.treestyletab.animation.enabled');
		this.onPrefChange('extensions.treestyletab.animation.indent.duration');
		this.onPrefChange('extensions.treestyletab.animation.collapse.duration');
		this.onPrefChange('extensions.treestyletab.twisty.expandSensitiveArea');
	},
	_initialized : false,
 
	observe : function TSTUtils_observe(aSubject, aTopic, aData) 
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
 
/* utilities */ 
	
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
 
// event 
	
	isNewTabAction : function TSTUtils_isNewTabAction(aEvent) 
	{
		return aEvent.button == 1 || (aEvent.button == 0 && this.isAccelKeyPressed(aEvent));
	},
 
	isAccelKeyPressed : function TSTUtils_isAccelKeyPressed(aEvent) 
	{
		if ( // this is releasing of the accel key!
			(aEvent.type == 'keyup') &&
			(aEvent.keyCode == (this.isMac ? Ci.nsIDOMKeyEvent.DOM_VK_META : Ci.nsIDOMKeyEvent.DOM_VK_CONTROL ))
			) {
			return false;
		}
		return this.isMac ?
			(aEvent.metaKey || (aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_META)) :
			(aEvent.ctrlKey || (aEvent.keyCode == Ci.nsIDOMKeyEvent.DOM_VK_CONTROL)) ;
	},
 
	isEventFiredOnClosebox : function TSTUtils_isEventFiredOnClosebox(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " tab-close-button ")]',
				aEvent.originalTarget || aEvent.target,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	isEventFiredOnClickable : function TSTUtils_isEventFiredOnClickable(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(" button toolbarbutton scrollbar popup menupopup panel tooltip ", concat(" ", local-name(), " "))]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
  
// string 
	
	makeNewId : function TSTUtils_makeNewId() 
	{
		return 'tab-<'+Date.now()+'-'+parseInt(Math.random() * 65000)+'>';
	},
 
	makeURIFromSpec : function TSTUtils_makeURIFromSpec(aURI) 
	{
		var newURI;
		aURI = aURI || '';
		if (aURI && String(aURI).indexOf('file:') == 0) {
			var fileHandler = this.IOService.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler);
			var tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
			newURI = this.IOService.newFileURI(tempLocalFile);
		}
		else {
			if (!/^\w+\:/.test(aURI)) aURI = 'http://'+aURI;
			newURI = this.IOService.newURI(aURI, null, null);
		}
		return newURI;
	},
 
	getGroupTabURI : function TSTUtils_getGroupTabURI(aTitle) 
	{
		return 'about:treestyletab-group'+(aTitle === void(0) ? '' : '?'+encodeURIComponent(aTitle) );
	},
  
// xpath 
	
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
 
	evaluateXPath : function TSTUtils_evaluateXPath(aExpression, aContext, aType) 
	{
		if (!aType) aType = Ci.nsIDOMXPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
		try {
			var XPathResult = (aContext.ownerDocument || aContext).evaluate(
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
		return XPathResult;
	},
 
	getArrayFromXPathResult : function TSTUtils_getArrayFromXPathResult(aXPathResult) 
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
  
/* Session Store API */ 
	
	getTabValue : function TSTUtils_getTabValue(aTab, aKey) 
	{
		var value = '';
		try {
			value = this.SessionStore.getTabValue(aTab, aKey);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI) {
			let TMPValue = aTab.getAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey);
			if (TMPValue) value = TMPValue;
		}

		return value;
	},
 
	setTabValue : function TSTUtils_setTabValue(aTab, aKey, aValue) 
	{
		if (!aValue) return this.deleteTabValue(aTab, aKey);

		aTab.setAttribute(aKey, aValue);
		try {
			this.checkCachedSessionDataExpiration(aTab);
			this.SessionStore.setTabValue(aTab, aKey, aValue);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI)
			aTab.setAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey, aValue);

		return aValue;
	},
 
	deleteTabValue : function TSTUtils_deleteTabValue(aTab, aKey) 
	{
		aTab.removeAttribute(aKey);
		try {
			this.checkCachedSessionDataExpiration(aTab);
			this.SessionStore.setTabValue(aTab, aKey, '');
			this.SessionStore.deleteTabValue(aTab, aKey);
		}
		catch(e) {
		}

		if (this.useTMPSessionAPI)
			aTab.removeAttribute(this.kTMP_SESSION_DATA_PREFIX+aKey);
	},
 
	// workaround for http://piro.sakura.ne.jp/latest/blosxom/mozilla/extension/treestyletab/2009-09-29_debug.htm
	checkCachedSessionDataExpiration : function TSTUtils_checkCachedSessionDataExpiration(aTab) 
	{
		if (aTab.linkedBrowser.parentNode.__SS_data &&
			aTab.linkedBrowser.parentNode.__SS_data._tabStillLoading &&
			aTab.getAttribute('busy') != 'true')
			aTab.linkedBrowser.parentNode.__SS_data._tabStillLoading = false;
	},
 
	useTMPSessionAPI : false, 
 
	kTMP_SESSION_DATA_PREFIX : 'tmp-session-data-', 
  
// tab 
	
	getTabFromChild : function TSTUtils_getTabFromChild(aTab) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:tab[ancestor::xul:tabbrowser]',
				aTab,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabFromEvent : function TSTUtils_getTabFromEvent(aEvent) 
	{
		return this.getTabFromChild(aEvent.originalTarget || aEvent.target);
	},
 
	getTabFromFrame : function TSTUtils_getTabFromFrame(aFrame, aTabBrowser) 
	{
		var b = aTabBrowser || this.browser;
		var docShell = aFrame.top
			.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIWebNavigation)
			.QueryInterface(Ci.nsIDocShell);
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
 
	getTabbarFromEvent : function TSTUtils_getTabbarFromEvent(aEvent) 
	{
		return this.evaluateXPath(
				'ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " tabbrowser-strip ")]',
				aEvent.originalTarget || aEvent.target,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	cleanUpTabsArray : function TSTUtils_cleanUpTabsArray(aTabs) 
	{
		var newTabs = [];
		aTabs.forEach(function(aTab) {
			if (!aTab.parentNode) return; // ignore removed tabs
			if (newTabs.indexOf(aTab) < 0) newTabs.push(aTab);
		});
		newTabs.sort(this.sortTabsByOrder);
		return newTabs;
	},
	
	sortTabsByOrder : function TSTUtils_sortTabsByOrder(aA, aB) 
	{
		return aA._tPos - aB._tPos;
	},
  
	normalizeToTabs : function TSTUtils_normalizeToTabs(aTabOrTabs, aOnlyChildren) 
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
  
// tabbrowser 
	
	getTabBrowserFromChild : function TSTUtils_getTabBrowserFromChild(aTabBrowserChild) 
	{
		if (!aTabBrowserChild) return null;

		if (aTabBrowserChild.__treestyletab__linkedTabBrowser)
			return aTabBrowserChild.__treestyletab__linkedTabBrowser;

		if (aTabBrowserChild.localName == 'tabbrowser')
			return aTabBrowserChild;

		return this.evaluateXPath(
				'ancestor::xul:tabbrowser[1]',
				aTabBrowserChild,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabBrowserFromFrame : function TSTUtils_getTabBrowserFromFrame(aFrame) 
	{
		var w = this.browserWindow;
		return !w ? null :
			('SplitBrowser' in w) ? this.getTabBrowserFromChild(w.SplitBrowser.getSubBrowserAndBrowserFromFrame(aFrame.top).browser) :
			this.browser ;
	},
 
	getFrameFromTabBrowserElements : function TSTUtils_getFrameFromTabBrowserElements(aFrameOrTabBrowser) 
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
   
/* get tab(s) */ 
	
	getTabById : function TSTUtils_getTabById(aId, aTabBrowserChildren) 
	{
		if (!aId) return null;
		var b = this.getTabBrowserFromChild(aTabBrowserChildren) || this.browser;
		return this.evaluateXPath(
				'descendant::xul:tab[@'+this.kID+' = "'+aId+'"]',
				b.mTabContainer,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	isTabDuplicated : function TSTUtils_isTabDuplicated(aTab) 
	{
		if (!aTab) return false;
		var id = this.getTabValue(aTab, this.kID);
		var b = this.getTabBrowserFromChild(aTab) || this.browser;
		return this.evaluateXPath(
				'count(descendant::xul:tab[@'+this.kID+' = "'+id+'" or @'+this.kID_RESTORING+' = "'+id+'"]) > 1',
				b.mTabContainer,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	getTabs : function TSTUtils_getTabs(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild);
		return this.evaluateXPath(
				'descendant::xul:tab',
				b.mTabContainer
			);
	},
 
	getTabsArray : function TSTUtils_getTabsArray(aTabBrowserChild) 
	{
		var tabs = this.getTabs(aTabBrowserChild);
		var array = [];
		for (var i = 0, maxi = tabs.snapshotLength; i < maxi; i++)
		{
			array.push(tabs.snapshotItem(i));
		}
		return array;
	},
 
	getFirstTab : function TSTUtils_getFirstTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild);
		return this.evaluateXPath(
				'child::xul:tab[1]',
				b.mTabContainer,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getLastTab : function TSTUtils_getLastTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild);
		return this.evaluateXPath(
				'child::xul:tab[last()]',
				b.mTabContainer,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getNextTab : function TSTUtils_getNextTab(aTab) 
	{
		if (!aTab) return null;
		return this.evaluateXPath(
				'following-sibling::xul:tab[1]',
				aTab,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getPreviousTab : function TSTUtils_getPreviousTab(aTab) 
	{
		if (!aTab) return null;
		return this.evaluateXPath(
				'preceding-sibling::xul:tab[1]',
				aTab,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getTabIndex : function TSTUtils_getTabIndex(aTab) 
	{
		if (!aTab) return -1;
		return this.evaluateXPath(
				'count(preceding-sibling::xul:tab)',
				aTab,
				Ci.nsIDOMXPathResult.NUMBER_TYPE
			).numberValue;
	},
 
	getNextVisibleTab : function TSTUtils_getNextVisibleTab(aTab) 
	{
		if (!aTab) return null;

		if (!this.canCollapseSubtree(aTab))
			return this.getNextTab(aTab);

		return this.evaluateXPath(
				'following-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")][1]',
				aTab,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getPreviousVisibleTab : function TSTUtils_getPreviousVisibleTab(aTab) 
	{
		if (!aTab) return null;

		if (!this.canCollapseSubtree(aTab))
			return this.getPreviousTab(aTab);

		return this.evaluateXPath(
				'preceding-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")][1]',
				aTab,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getLastVisibleTab : function TSTUtils_getLastVisibleTab(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild);
		if (!b) return null;

		if (!this.canCollapseSubtree(b))
			return this.getLastTab(b);

		return this.evaluateXPath(
				'child::xul:tab[not(@'+this.kCOLLAPSED+'="true")][last()]',
				b.mTabContainer,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getVisibleTabs : function TSTUtils_getVisibleTabs(aTabBrowserChild) 
	{
		var b = this.getTabBrowserFromChild(aTabBrowserChild);
		if (!this.canCollapseSubtree(b))
			return this.getTabs(b);

		var XPathResult = this.evaluateXPath(
				'child::xul:tab[not(@'+this.kCOLLAPSED+'="true")]',
				b.mTabContainer
			);
		return XPathResult;
	},
 
	getVisibleIndex : function TSTUtils_getVisibleIndex(aTab) 
	{
		if (!aTab) return -1;

		if (!this.canCollapseSubtree(aTab))
			return this.getTabIndex(aTab);

		return aTab.getAttribute(this.kCOLLAPSED) == 'true' ?
			-1 :
			this.evaluateXPath(
				'count(preceding-sibling::xul:tab[not(@'+this.kCOLLAPSED+'="true")])',
				aTab,
				Ci.nsIDOMXPathResult.NUMBER_TYPE
			).numberValue;
	},
  
/* notify "ready to open child tab(s)" */ 
	
	readyToOpenChildTab : function TSTUtils_readyToOpenChildTab(aFrameOrTabBrowser, aMultiple, aInsertBefore) /* PUBLIC API */ 
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

		ownerBrowser.treeStyleTab.readiedToAttachNewTab   = true;
		ownerBrowser.treeStyleTab.readiedToAttachMultiple = aMultiple || false ;
		ownerBrowser.treeStyleTab.multipleCount           = 0;
		ownerBrowser.treeStyleTab.parentTab               = parentId;
		ownerBrowser.treeStyleTab.insertBefore            = refId;
	},
 
	readyToOpenNewTabGroup : function TSTUtils_readyToOpenNewTabGroup(aFrameOrTabBrowser, aTreeStructure) /* PUBLIC API */ 
	{
		if (!this.getTreePref('autoAttachNewTabsAsChildren')) return;

		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		this.stopToOpenChildTab(frame);

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.treeStyleTab.readiedToAttachNewTabGroup = true;
		ownerBrowser.treeStyleTab.readiedToAttachMultiple    = true;
		ownerBrowser.treeStyleTab.multipleCount              = 0;
		ownerBrowser.treeStyleTab.treeStructure              = aTreeStructure;
	},
 
	stopToOpenChildTab : function TSTUtils_stopToOpenChildTab(aFrameOrTabBrowser) /* PUBLIC API */ 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.treeStyleTab.readiedToAttachNewTab      = false;
		ownerBrowser.treeStyleTab.readiedToAttachNewTabGroup = false;
		ownerBrowser.treeStyleTab.readiedToAttachMultiple    = false;
		ownerBrowser.treeStyleTab.multipleCount              = 0;
		ownerBrowser.treeStyleTab.parentTab                  = null;
		ownerBrowser.treeStyleTab.insertBefore               = null;
		ownerBrowser.treeStyleTab.treeStructure              = null;
	},
 
	checkToOpenChildTab : function TSTUtils_checkToOpenChildTab(aFrameOrTabBrowser) /* PUBLIC API */ 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return false;

		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		return ownerBrowser.treeStyleTab.readiedToAttachNewTab || ownerBrowser.treeStyleTab.readiedToAttachNewTabGroup ? true : false ;
	},
 
	checkReadyToOpenNewTab : function TSTUtils_checkReadyToOpenNewTab(aInfo) 
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
			parent = ('forceChild' in internal && !internal.forceChild) ? null :
					(parentHost == targetHost && !internal.forceChild) ? parentTab :
					frame ;
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
	
	checkReadyToOpenNewTabOnLocationBar : function TSTUtils_checkReadyToOpenNewTabOnLocationBar(aURI, aModifier) 
	{
		return this.checkReadyToOpenNewTab({
			uri      : aURI,
			external : {
				newTab     : this.getTreePref('urlbar.loadDifferentDomainToNewTab'),
				forceChild : this.getTreePref('urlbar.loadDifferentDomainToNewTab.asChild')
			},
			internal : {
				newTab     : this.getTreePref('urlbar.loadSameDomainToNewTab'),
				forceChild : this.getTreePref('urlbar.loadSameDomainToNewTab.asChild')
			},
			modifier : aModifier,
			invert   : this.getTreePref('urlbar.invertDefaultBehavior')
		});
	},
 
	_getDomainFromURI : function TSTUtils__getDomainFromURI(aURI) 
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
  
	readyToOpenDivertedTab : function TSTUtils_readyToOpenDivertedTab(aFrameOrTabBrowser) 
	{
		var frame = this.getFrameFromTabBrowserElements(aFrameOrTabBrowser);
		if (!frame) return;
		var ownerBrowser = this.getTabBrowserFromFrame(frame);
		ownerBrowser.treeStyleTab.readiedToOpenDivertedTab = true;
	},
  
/* tree manipulations */ 
	
	get treeViewEnabled() /* PUBLIC API */ 
	{
		return this._treeViewEnabled;
	},
	set treeViewEnabled(aValue)
	{
		this._treeViewEnabled = aValue ? true : false ;
		this.ObserverService.notifyObservers(
			window,
			'TreeStyleTab:changeTreeViewAvailability',
			this._treeViewEnabled
		);
		return aValue;
	},
	_treeViewEnabled : true,
 
	get rootTabs() /* PUBLIC API */ 
	{
		return this.getArrayFromXPathResult(
				this.evaluateXPath(
					'child::xul:tab[not(@'+this.kNEST+') or @'+this.kNEST+'="0" or @'+this.kNEST+'=""]',
					this.browser.mTabContainer
				)
			);
	},
 
	canCollapseSubtree : function TSTUtils_canCollapseSubtree(aTabBrowser) /* PUBLIC API */ 
	{
		var b = this.getTabBrowserFromChild(aTabBrowser) || this.browser;
		return b.getAttribute(this.kALLOW_COLLAPSE) == 'true';
	},
 
	isCollapsed : function TSTUtils_isCollapsed(aTab) /* PUBLIC API */ 
	{
		if (!aTab || !this.canCollapseSubtree(aTab))
			return false;

		return aTab.getAttribute(this.kCOLLAPSED) == 'true';
	},
 
	isSubtreeCollapsed : function TSTUtils_isSubtreeCollapsed(aTab) /* PUBLIC API */ 
	{
		if (!aTab || !this.canCollapseSubtree(aTab) || !this.hasChildTabs(aTab))
			return false;

		return aTab.getAttribute(this.kSUBTREE_COLLAPSED) == 'true';
	},
 
	shouldCloseTabSubtreeOf : function TSTUtils_shouldCloseTabSubtreeOf(aTab) 
	{
		return (
			this.hasChildTabs(aTab) &&
			(
				this.getTreePref('closeParentBehavior') == this.CLOSE_PARENT_BEHAVIOR_CLOSE ||
				this.isSubtreeCollapsed(aTab)
			)
		);
	},
	shouldCloseTabSubTreeOf : function() { return this.shouldCloseTabSubtreeOf.apply(this, arguments); }, // obsolete, for backward compatibility
 
	shouldCloseLastTabSubtreeOf : function TSTUtils_shouldCloseLastTabSubtreeOf(aTab) 
	{
		var b = this.getTabBrowserFromChild(aTab);
		return (
			this.shouldCloseTabSubtreeOf(aTab) &&
			this.getDescendantTabs(aTab).length + 1 == this.getTabs(b).snapshotLength
		);
	},
	shouldCloseLastTabSubTreeOf : function() { return this.shouldCloseLastTabSubtreeOf.apply(this, arguments); }, // obsolete, for backward compatibility
 
	getParentTab : function TSTUtils_getParentTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;
		var id = aTab.getAttribute(this.kID);
		if (!id) return null; // not initialized yet
		return this.evaluateXPath(
				'parent::*/child::xul:tab[contains(concat("|", @'+this.kCHILDREN+', "|"), "|'+id+'|")]',
				aTab,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},
 
	getRootTab : function TSTUtils_getRootTab(aTab) /* PUBLIC API */ 
	{
		var parent = aTab;
		var root   = aTab;
		while (parent = this.getParentTab(parent))
		{
			root = parent;
		}
		return root;
	},
 
	getNextSiblingTab : function TSTUtils_getNextSiblingTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		var parentTab = this.getParentTab(aTab);

		if (!parentTab) {
			let next = aTab;
			do {
				next = next.nextSibling;
			}
			while (next &&
					next.nodeType == Ci.nsIDOMNode.ELEMENT_NODE &&
					this.getParentTab(next));
			return next;
		}

		var children = parentTab.getAttribute(this.kCHILDREN);
		if (children) {
			let list = ('|'+children).split('|'+aTab.getAttribute(this.kID))[1].split('|');
			for (let i = 0, maxi = list.length; i < maxi; i++)
			{
				let firstChild = this.getTabById(list[i], aTab);
				if (firstChild) return firstChild;
			}
		}
		return null;
	},
 
	getPreviousSiblingTab : function TSTUtils_getPreviousSiblingTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		var parentTab = this.getParentTab(aTab);

		if (!parentTab) {
			let prev = aTab;
			do {
				prev = prev.previousSibling;
			}
			while (prev &&
					prev.nodeType == Ci.nsIDOMNode.ELEMENT_NODE &&
					this.getParentTab(prev));
			return prev;
		}

		var children = parentTab.getAttribute(this.kCHILDREN);
		if (children) {
			let list = ('|'+children).split('|'+aTab.getAttribute(this.kID))[0].split('|');
			for (let i = list.length-1; i > -1; i--)
			{
				let lastChild = this.getTabById(list[i], aTab);
				if (lastChild) return lastChild;
			}
		}
		return null;
	},
 
	getChildTabs : function TSTUtils_getChildTabs(aTab, aAllTabsArray) /* PUBLIC API */ 
	{
		var tabs = [];
		if (!aTab) return tabs;

		var children = aTab.getAttribute(this.kCHILDREN);
		if (!children) return tabs;

		if (aAllTabsArray) tabs = aAllTabsArray;

		var list = children.split('|');
		for (let i = 0, maxi = list.length; i < maxi; i++)
		{
			let tab = this.getTabById(list[i], aTab);
			if (!tab) continue;
			tabs.push(tab);
			if (aAllTabsArray)
				this.getChildTabs(tab, tabs);
		}

		return tabs;
	},
 
	hasChildTabs : function TSTUtils_hasChildTabs(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return false;
		return aTab.hasAttribute(this.kCHILDREN);
	},
 
	getDescendantTabs : function TSTUtils_getDescendantTabs(aTab) /* PUBLIC API */ 
	{
		var tabs = [];
		this.getChildTabs(aTab, tabs);
		return tabs;
	},
 
	getFirstChildTab : function TSTUtils_getFirstChildTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		var children   = aTab.getAttribute(this.kCHILDREN);
		var firstChild = null;
		if (children) {
			let list = children.split('|');
			for (let i = 0, maxi = list.length; i < maxi; i++)
			{
				firstChild = this.getTabById(list[i], aTab);
				if (firstChild) break;
			}
		}
		return firstChild;
	},
 
	getLastChildTab : function TSTUtils_getLastChildTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		var children  = aTab.getAttribute(this.kCHILDREN);
		var lastChild = null;
		if (children) {
			let list = children.split('|');
			for (let i = list.length-1; i > -1; i--)
			{
				lastChild = this.getTabById(list[i], aTab);
				if (lastChild) break;
			}
		}
		return lastChild;
	},
 
	getLastDescendantTab : function TSTUtils_getLastDescendantTab(aTab) /* PUBLIC API */ 
	{
		if (!aTab) return null;

		var tabs = this.getDescendantTabs(aTab);
		return tabs.length ? tabs[tabs.length-1] : null ;
	},
 
	getChildIndex : function TSTUtils_getChildIndex(aTab, aParent) 
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
			let children = aParent.getAttribute(this.kCHILDREN);
			let list = children.split('|');
			let id = aTab.getAttribute(this.kID);
			for (let i = 0, maxi = list.length; i < maxi; i++)
			{
				if (list[i] == id) return i;
			}
			return -1;
		}
		else {
			let tabs = this.rootTabs;
			for (let i = 0, maxi = tabs.length; i < maxi; i++)
			{
				if (tabs[i] == aTab) return i;
			}
		}
	},
 
	getXOffsetOfTab : function TSTUtils_getXOffsetOfTab(aTab) 
	{
		var extraCondition = this.canCollapseSubtree(aTab) ?
								'[not(@'+this.kCOLLAPSED+'="true")]' :
								'' ;

		return this.evaluateXPath(
			'sum((self::* | preceding-sibling::xul:tab'+extraCondition+')/attribute::'+this.kX_OFFSET+')',
			aTab,
			Ci.nsIDOMXPathResult.NUMBER_TYPE
		).numberValue;
	},
	getYOffsetOfTab : function TSTUtils_getYOffsetOfTab(aTab)
	{
		var extraCondition = this.canCollapseSubtree(aTab) ?
								'[not(@'+this.kCOLLAPSED+'="true")]' :
								'';

		return this.evaluateXPath(
			'sum((self::* | preceding-sibling::xul:tab'+extraCondition+')/attribute::'+this.kY_OFFSET+')',
			aTab,
			Ci.nsIDOMXPathResult.NUMBER_TYPE
		).numberValue;
	},
 
	isGroupTab : function TSTUtils_isGroupTab(aTab, aLazyCheck) 
	{
		return (
			(aLazyCheck || aTab.linkedBrowser.sessionHistory.count == 1) &&
			aTab.linkedBrowser.currentURI.spec.indexOf('about:treestyletab-group') > -1
		);
	},
  
/* tabbar position */ 
	
	get currentTabbarPosition() /* PUBLIC API */ 
	{
		return this.getTreePref('tabbar.position') || 'top';
	},
	set currentTabbarPosition(aValue)
	{
		var position = String(aValue);
		if (!position || !/^(top|bottom|left|right)$/i.test(position))
			position = 'top';

		position = position.toLowerCase();
		this.setTreePref('tabbar.position', position);

		return aValue;
	},
 
	rollbackTabbarPosition : function TSTUtils_rollbackTabbarPosition() /* PUBLIC API */ 
	{
		if (!this._tabbarPositionHistory.length)
			return false;

		this._inRollbackTabbarPosition = true;
		this.currentTabbarPosition = this._tabbarPositionHistory.pop();
		this._inRollbackTabbarPosition = false;

		return true;
	},
 
	onChangeTabbarPosition : function TSTUtils_onChangeTabbarPosition(aPosition) 
	{
		if (this._inRollbackTabbarPosition) return;
		this._tabbarPositionHistory.push(aPosition);
	},
 
	_tabbarPositionHistory : [], 
  
/* Pref Listener */ 
	
	domains : [ 
		'extensions.treestyletab.',
		'browser.link.open_newwindow.restriction',
		'browser.tabs.loadFolderAndReplace',
		'browser.tabs.insertRelatedAfterCurrent'
	],
 
	onPrefChange : function TSTUtils_onPrefChange(aPrefName) 
	{
		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.indent':
				this.baseIndent = value;
				this.ObserverService.notifyObservers(null, 'TreeStyleTab:indentModified', value);
				break;

			case 'extensions.treestyletab.tabbar.width':
			case 'extensions.treestyletab.tabbar.shrunkenWidth':
				this.updateTabWidthPrefs(aPrefName);
				break;

			case 'browser.link.open_newwindow.restriction':
			case 'browser.tabs.loadFolderAndReplace':
			case 'browser.tabs.insertRelatedAfterCurrent':
				if (this.prefOverriding) return;
				aPrefName += '.override';
				this.setPref(aPrefName, value);
			case 'browser.link.open_newwindow.restriction.override':
			case 'browser.tabs.loadFolderAndReplace.override':
			case 'browser.tabs.insertRelatedAfterCurrent.override':
				this.prefOverriding = true;
				var target = aPrefName.replace('.override', '');
				var originalValue = this.getPref(target);
				if (originalValue !== null && originalValue != value)
					this.setPref(target+'.backup', originalValue);
				this.setPref(target, this.getPref(aPrefName));
				this.prefOverriding = false;
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

			case 'extensions.treestyletab.tabbar.position':
				this.onChangeTabbarPosition(value);
				break;

			case 'extensions.treestyletab.twisty.expandSensitiveArea':
				this.expandTwistyArea = value;
				break;

			default:
				break;
		}
	},
	
	updateTabWidthPrefs : function TSTUtils_updateTabWidthPrefs(aPrefName) 
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
   
/* Save/Load Prefs */ 
	
	getTreePref : function TSTUtils_getTreePref(aPrefstring) 
	{
		return this.getPref('extensions.treestyletab.'+aPrefstring);
	},
 
	setTreePref : function TSTUtils_setTreePref(aPrefstring, aNewValue) 
	{
		return this.setPref('extensions.treestyletab.'+aPrefstring, aNewValue);
	},
 
	clearTreePref : function TSTUtils_clearTreePref(aPrefstring) 
	{
		return this.clearPref('extensions.treestyletab.'+aPrefstring);
	}
  
}; 
 
Components.utils.import('resource://treestyletab-modules/prefs.js'); 
TreeStyleTabUtils.__proto__ = window['piro.sakura.ne.jp'].prefs;
  
