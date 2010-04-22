var TreeStyleTabService = { 
	
/* API */ 

	changeTabbarPosition : function TSTService_changeTabbarPosition(aNewPosition) /* PUBLIC API (obsolete, for backward compatibility) */
	{
		this.currentTabbarPosition = aNewPosition;
	},
	
	get currentTabbarPosition() /* PUBLIC API */ 
	{
		return this.utils.currentTabbarPosition;
	},
	set currentTabbarPosition(aValue)
	{
		if ('UndoTabService' in window && UndoTabService.isUndoable()) {
			var current = this.utils.currentTabbarPosition;
			var self = this;
			UndoTabService.doOperation(
				function() {
					self.utils.currentTabbarPosition = aValue;
				},
				{
					label  : self.treeBundle.getString('undo_changeTabbarPosition_label'),
					name   : 'treestyletab-changeTabbarPosition',
					data   : {
						oldPosition : current,
						newPosition : aValue
					}
				}
			);
		}
		return this.utils.currentTabbarPosition = aValue;
	},
 
	undoChangeTabbarPosition : function TSTService_undoChangeTabbarPosition() /* PUBLIC API */ 
	{
		return this.utils.undoChangeTabbarPosition();
	},
 
	redoChangeTabbarPosition : function TSTService_redoChangeTabbarPosition() /* PUBLIC API */ 
	{
		return this.utils.redoChangeTabbarPosition();
	},
 
	get treeViewEnabled() /* PUBLIC API */ 
	{
		return this.utils.treeViewEnabled;
	},
	set treeViewEnabled(aValue)
	{
		return this.utils.treeViewEnabled = aValue;
	},
 
	get useTMPSessionAPI() /* PUBLIC API */ 
	{
		return this.utils.useTMPSessionAPI;
	},
	set useTMPSessionAPI(aValue)
	{
		return this.utils.useTMPSessionAPI = aValue;
	},
  
/* backward compatibility */ 
	getTempTreeStyleTab : function TSTService_getTempTreeStyleTab(aTabBrowser)
	{
		return aTabBrowser.treeStyleTab || new TreeStyleTabBrowser(aTabBrowser);
	},
	
	initTabAttributes : function TSTService_initTabAttributes(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabAttributes(aTab);
	},
 
	initTabContents : function TSTService_initTabContents(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabContents(aTab);
	},
 
	initTabContentsOrder : function TSTService_initTabContentsOrder(aTab, aTabBrowser) 
	{
		var b = aTabBrowser || this.getTabBrowserFromChild(aTab);
		this.getTempTreeStyleTab(b).initTabContentsOrder(aTab);
	},
  
/* Utilities */ 
	
	stopRendering : function TSTService_stopRendering() 
	{
		window['piro.sakura.ne.jp'].stopRendering.stop();
	},
	startRendering : function TSTService_startRendering()
	{
		window['piro.sakura.ne.jp'].stopRendering.start();
	},
 
	getPropertyPixelValue : function TSTService_getPropertyPixelValue(aElementOrStyle, aProp) 
	{
		var style = aElementOrStyle instanceof Components.interfaces.nsIDOMCSSStyleDeclaration ?
					aElementOrStyle :
					window.getComputedStyle(aElementOrStyle, null) ;
		return Number(style.getPropertyValue(aProp).replace(/px$/, ''));
	},
 
	get isToolbarCustomizing() 
	{
		return window.gToolbox && gToolbox.customizing;
	},
 
	maxTabbarWidth : function TSTService_maxTabbarWidth(aWidth, aTabBrowser) 
	{
		aTabBrowser = aTabBrowser || this.browser;
		return Math.min(
				aWidth,
				parseInt(Math.min(
					Math.max(window.outerWidth, parseInt(document.documentElement.getAttribute('width'))),
					aTabBrowser.boxObject.width
				) * 0.9)
			);
	},
 
	maxTabbarHeight : function TSTService_maxTabbarHeight(aHeight, aTabBrowser) 
	{
		aTabBrowser = aTabBrowser || this.browser;
		return Math.min(
				aHeight,
				parseInt(Math.min(
					Math.max(window.outerHeight, parseInt(document.documentElement.getAttribute('height'))),
					aTabBrowser.boxObject.height
				) * 0.9)
			);
	},
  
/* Initializing */ 
	
	preInit : function TSTService_preInit() 
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
					'!TreeStyleTabService.tearOffSubtreeFromRemote() && $&'
				));
			}
			else {
				eval('window.BrowserStartup = '+source.replace(
					'gBrowser.swapBrowsersAndCloseOther(gBrowser.selectedTab, uriToLoad);',
					'if (!TreeStyleTabService.tearOffSubtreeFromRemote()) { $& }'
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

		if ('undoCloseTab' in window) {
			eval('window.undoCloseTab = '+
				window.undoCloseTab.toSource().replace(
					/(\btab\s*=\s*[^\.]+\.undoCloseTab\([^;]+\);)/,
					<![CDATA[
						gBrowser.__treestyletab__readyToUndoCloseTab = true;
						$1
						tab.__treestyletab__restoredByUndoCloseTab = true;
						delete gBrowser.__treestyletab__readyToUndoCloseTab;
					]]>
				)
			);
		}

		this.overrideExtensionsPreInit(); // hacks.js

		this.registerTabFocusAllowance(this.defaultTabFocusAllowance);

		this.migratePrefs();
	},
	preInitialized : false,
	
	defaultTabFocusAllowance : function TSTService_defaultTabFocusAllowance(aBrowser) 
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
 
	kPREF_VERSION : 5,
	migratePrefs : function TSTService_migratePrefs() 
	{
		// migrate old prefs
		var orientalPrefs = [];
		switch (this.getTreePref('prefsVersion'))
		{
			case 0:
				orientalPrefs = orientalPrefs.concat([
					'extensions.treestyletab.tabbar.fixed',
					'extensions.treestyletab.enableSubtreeIndent',
					'extensions.treestyletab.allowSubtreeCollapseExpand'
				]);
			case 1:
				orientalPrefs = orientalPrefs.concat([
					'extensions.treestyletab.tabbar.hideAlltabsButton'
				]);
			case 2:
				if (this.getTreePref('urlbar.loadSameDomainToNewChildTab') !== null) {
					let value = this.getTreePref('urlbar.loadSameDomainToNewChildTab');
					this.setTreePref('urlbar.loadSameDomainToNewTab', value);
					this.setTreePref('urlbar.loadSameDomainToNewTab.asChild', value);
					if (value) this.setTreePref('urlbar.loadDifferentDomainToNewTab', value);
					this.clearTreePref('urlbar.loadSameDomainToNewChildTab');
				}
			case 3:
				if (this.getTreePref('loadDroppedLinkToNewChildTab') !== null) {
					this.setTreePref('dropLinksOnTab.behavior',
						this.getTreePref('loadDroppedLinkToNewChildTab.confirm') ?
							this.kDROPLINK_ASK :
						this.getTreePref('loadDroppedLinkToNewChildTab') ?
							this.kDROPLINK_NEWTAB :
							this.kDROPLINK_LOAD
					);
					this.clearTreePref('loadDroppedLinkToNewChildTab.confirm');
					this.clearTreePref('loadDroppedLinkToNewChildTab');
				}
				if (this.getTreePref('openGroupBookmarkAsTabSubTree') !== null) {
					let behavior = 0;
					if (this.getTreePref('openGroupBookmarkAsTabSubTree.underParent'))
						behavior += this.kGROUP_BOOKMARK_USE_DUMMY;
					if (!this.getTreePref('openGroupBookmarkBehavior.confirm')) {
						behavior += (
							this.getTreePref('openGroupBookmarkAsTabSubTree') ?
								this.kGROUP_BOOKMARK_SUBTREE :
							this.getTreePref('browser.tabs.loadFolderAndReplace') ?
								this.kGROUP_BOOKMARK_REPLACE :
								this.kGROUP_BOOKMARK_SEPARATE
						);
					}
					this.setTreePref('openGroupBookmark.behavior', behavior);
					this.clearTreePref('openGroupBookmarkBehavior.confirm');
					this.clearTreePref('openGroupBookmarkAsTabSubTree');
					this.clearTreePref('openGroupBookmarkAsTabSubTree.underParent');
					this.setPref('browser.tabs.loadFolderAndReplace', behavior & this.kGROUP_BOOKMARK_REPLACE ? true : false );
				}
			case 4:
				[
					'extensions.treestyletab.autoCollapseExpandSubTreeOnSelect',
					'extensions.treestyletab.autoCollapseExpandSubTreeOnSelect.onCurrentTabRemove',
					'extensions.treestyletab.autoCollapseExpandSubTreeOnSelect.whileFocusMovingByShortcut',
					'extensions.treestyletab.autoExpandSubTreeOnAppendChild',
					'extensions.treestyletab.autoExpandSubTreeOnCollapsedChildFocused',
					'extensions.treestyletab.collapseExpandSubTree.dblclick',
					'extensions.treestyletab.createSubTree.underParent',
					'extensions.treestyletab.show.context-item-reloadTabSubTree',
					'extensions.treestyletab.show.context-item-removeTabSubTree',
					'extensions.treestyletab.show.context-item-bookmarkTabSubTree',
					'extensions.multipletab.show.multipletab-selection-item-removeTabSubTree',
					'extensions.multipletab.show.multipletab-selection-item-createSubTree'
				].forEach(function(aPref) {
					var value = this.getPref(aPref);
					if (value === null) return;
					this.setPref(aPref.replace('SubTree', 'Subtree'), value);
					this.clearPref(aPref);
				}, this);
			default:
				orientalPrefs.forEach(function(aPref) {
					let value = this.getPref(aPref);
					if (value === null) return;
					this.setPref(aPref+'.horizontal', value);
					this.setPref(aPref+'.vertical', value);
					this.clearPref(aPref);
				}, this);
				break;
		}
		this.setTreePref('prefsVersion', this.kPREF_VERSION);
	},
  
	init : function TSTService_init() 
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
		document.addEventListener('popupshowing', this, false);
		document.addEventListener('popuphiding', this, false);
		document.addEventListener('TreeStyleTabCollapsedStateChange', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);

		window.addEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
		window.addEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);

		this.addPrefListener(this);

		this.initUninstallationListener();

		this.overrideExtensionsOnInitBefore(); // hacks.js
		this.overrideGlobalFunctions();
		this.initTabBrowser(gBrowser);
		this.overrideExtensionsOnInitAfter(); // hacks.js

		this.processRestoredTabs();

		this.onPrefChange('extensions.treestyletab.tabbar.autoHide.mode');
		this.onPrefChange('extensions.treestyletab.tabbar.style');
		this.onPrefChange('extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut');
	},
	initialized : false,
	
	initUninstallationListener : function TSTService_initUninstallationListener() 
	{
		var prefs = window['piro.sakura.ne.jp'].prefs;
		var restorePrefs = function() {
				if (!prefs) return;
				[
					'browser.link.open_newwindow.restriction',
					'browser.tabs.loadFolderAndReplace',
					'browser.tabs.insertRelatedAfterCurrent',
					'extensions.stm.tabBarMultiRows' // Super Tab Mode
				].forEach(function(aPref) {
					var backup = prefs.getPref(aPref+'.backup');
					if (backup === null) return;
					prefs.setPref(aPref+'.override', backup); // we have to set to ".override" pref, to avoid unexpectedly reset by the preference listener.
					prefs.clearPref(aPref+'.backup');
				});
			};
		new window['piro.sakura.ne.jp'].UninstallationListener({
			id : 'treestyletab@piro.sakura.ne.jp',
			onuninstalled : restorePrefs,
			ondisabled : restorePrefs
		});
	},
 
	initTabBrowser : function TSTService_initTabBrowser(aTabBrowser) 
	{
		if (aTabBrowser.localName != 'tabbrowser') return;
		aTabBrowser.treeStyleTab = new TreeStyleTabBrowser(aTabBrowser);
		aTabBrowser.treeStyleTab.init();
	},
 
	updateTabDNDObserver : function TSTService_updateTabDNDObserver(aObserver) 
	{
		var strip = this.getTabStrip(aObserver) ||
					gBrowser.mStrip // fallback to the default strip, for Tab Mix Plus;

		if (aObserver.tabContainer &&
			aObserver.tabContainer.tabbrowser == aObserver) { // Firefox 3.7 or later
			aObserver = aObserver.tabContainer;
			strip.addEventListener('drop', this, true);
			strip.addEventListener('dragend', this, true);
		}

		// Firefox 3.5 or later
		var useHTML5Events = '_setEffectAllowedForDataTransfer' in aObserver;
		if (useHTML5Events) {
			strip.addEventListener('dragstart', this, true);
			strip.addEventListener('dragover', this, true);
			strip.addEventListener('dragleave', this, true);
		}

		var canDropFunctionName = useHTML5Events ?
				'_setEffectAllowedForDataTransfer' : // Firefox 3.5 or later
				'canDrop' ; // Firefox 3.0.x
		if (canDropFunctionName in aObserver) {
			eval('aObserver.'+canDropFunctionName+' = '+
				aObserver[canDropFunctionName].toSource().replace(
					'{',
					'{ var TSTTabBrowser = this;'
				).replace(
					/\.screenX/g, '[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.positionProp]'
				).replace(
					/\.width/g, '[TreeStyleTabService.getTabBrowserFromChild(TSTTabBrowser).treeStyleTab.sizeProp]'
				).replace(
					/(return (?:true|dt.effectAllowed = "copyMove");)/,
					<![CDATA[
						if (!this.treeStyleTab.checkCanTabDrop(arguments[0], this)) {
							return TST_DRAGDROP_DISALLOW_RETRUN_VALUE;
						}
						$1
					]]>
				).replace(
					/TST_DRAGDROP_DISALLOW_RETRUN_VALUE/g,
					(canDropFunctionName == 'canDrop' ?
						'false' :
						'dt.effectAllowed = "none"'
					)
				)
			);
		}

		if ('onDragStart' in aObserver) { // Firefox 3.0.x
			eval('aObserver.onDragStart = '+
				aObserver.onDragStart.toSource().replace(
					'aEvent.target.localName == "tab"',
					<![CDATA[
						(
							!this.treeStyleTab.tabbarDNDObserver.canDragTabbar(aEvent) &&
							$&
						)
					]]>
				)
			);
		}

		if ('onDragOver' in aObserver) { // Firefox 3.0.x
			eval('aObserver.onDragOver = '+
				aObserver.onDragOver.toSource().replace(
					'{',
					<![CDATA[$&
							if (this.treeStyleTab.processTabDragOverEvent(aEvent, this))
								return;
					]]>
				)
			);
		}

		if ('onDragExit' in aObserver) { // Firefox 3.0.x
			eval('aObserver.onDragExit = '+
				aObserver.onDragExit.toSource().replace(
					/(this.mTabDropIndicatorBar\.[^;]+;)/,
					'$1; this.treeStyleTab.clearDropPosition();'
				)
			);
		}

		var dropFunctionName = '_onDrop' in aObserver ?
				'_onDrop' : // Firefox 3.5 - 3.6
				'onDrop' ; // Firefox 3.0.x
		if (dropFunctionName in aObserver) {
			eval('aObserver.'+dropFunctionName+' = '+
				aObserver[dropFunctionName].toSource().replace(
					'{',
					<![CDATA[
						{
							var TSTTabBrowser = this;
							TSTTabBrowser.treeStyleTab.clearDropPosition();
							var dropActionInfo = TSTTabBrowser.treeStyleTab.getDropAction(aEvent, TST_DRAGSESSION);
					]]>
				).replace( // Firefox 3.0.x, 3.5 or later
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
						let locked = (
								tab.getAttribute('locked') == 'true' || // Tab Mix Plus and others
								tab.getAttribute('isPageLocked') == 'true' // Super Tab Mode
							);
						var loadDroppedLinkToNewChildTab = (
								dropActionInfo.position != TreeStyleTabService.kDROP_ON ||
								locked
							);
						if (!loadDroppedLinkToNewChildTab &&
							dropActionInfo.position == TreeStyleTabService.kDROP_ON) {
							loadDroppedLinkToNewChildTab = TreeStyleTabService.dropLinksOnTabBehavior() == TreeStyleTabService.kDROPLINK_NEWTAB;
						}
						if (loadDroppedLinkToNewChildTab || locked) {
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
		}

		if ('_onDragEnd' in aObserver) { // Firefox 3.5 - 3.6
			eval('aObserver._onDragEnd = '+aObserver._onDragEnd.toSource().replace(
				/([^\{\}\(\);]*this\.replaceTabWithWindow\()/,
				'if (this.treeStyleTab.isDraggingAllTabs(draggedTab)) return; $1'
			).replace(
				'{',
				'{ var treeStyleTab = this.treeStyleTab;'
			).replace(
				/window\.screenX/g, 'gBrowser.boxObject.screenX'
			).replace(
				/window\.outerWidth/g, 'gBrowser.boxObject.width'
			).replace(
				/\.screenX/g, '[treeStyleTab.positionProp]'
			).replace(
				/\.width/g, '[treeStyleTab.sizeProp]'
			).replace(
				/\.screenY/g, '[treeStyleTab.invertedPositionProp]'
			).replace(
				/\.height/g, '[treeStyleTab.invertedSizeProp]'
			));
		}
	},
	destroyTabDNDObserver : function TSTService_destroyTabDNDObserver(aObserver)
	{
		var strip = this.getTabStrip(aObserver) ||
					gBrowser.mStrip // fallback to the default strip, for Tab Mix Plus;

		if (aObserver.tabContainer &&
			aObserver.tabContainer.tabbrowser == aObserver) { // Firefox 3.7 or later
			strip.removeEventListener('dragstart', this, true);
			strip.removeEventListener('dragover', this, true);
			strip.removeEventListener('dragleave', this, true);
		}

		// Firefox 3.5 or later
		var useHTML5Events = '_setEffectAllowedForDataTransfer' in aObserver;
		if (useHTML5Events) {
			strip.removeEventListener('dragstart', this, true);
			strip.removeEventListener('dragover', this, true);
			strip.removeEventListener('dragleave', this, true);
		}
	},
	
	checkCanTabDrop : function TSTService_checkCanTabDrop(aEvent, aTabBrowser) 
	{
try{
		var session = this.getCurrentDragSession();
		var node = session.sourceNode;
		var tab = this.getTabFromChild(node);
		if (!node ||
			!tab ||
			tab.parentNode != aTabBrowser.mTabContainer)
			return true;

		tab = this.getTabFromEvent(aEvent);
		if (this.isCollapsed(tab))
			return false;

		var info = this.getDropAction(aEvent, session);
		return info.canDrop;
}
catch(e) {
		dump('TreeStyleTabService::canDrop\n'+e+'\n');
		return false;
}
	},
 
	onTabDragStart : function TSTService_onTabDragStart(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		if (b.treeStyleTab.tabbarDNDObserver.canDragTabbar(aEvent))
			b.treeStyleTab.onTabbarDragStart(aEvent, b);
	},
	
	onTabbarDragStart : function TSTService_onTabbarDragStart(aEvent, aTabBrowser) 
	{
		var dt = aEvent.dataTransfer;
		dt.mozSetDataAt(
			this.kDRAG_TYPE_TABBAR,
			aEvent.shiftKey ?
				this.kTABBAR_MOVE_FORCE :
				this.kTABBAR_MOVE_NORMAL,
			0
		);
		dt.mozCursor = 'move';
//		var tabbar = aTabBrowser.mTabContainer;
//		var box = tabbar.boxObject;
//		dt.setDragImage(
//			tabbar,
//			aEvent.screenX - box.screenX,
//			aEvent.screenY - box.screenY
//		);
		// no feedback image, because it's annoying...
		dt.setDragImage(new Image(), 0, 0);
		aEvent.stopPropagation();
		aTabBrowser.treeStyleTab.tabbarDNDObserver.readyToStartDrag();
	},
  
	onTabDragOver : function TSTService_onTabDragOver(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		if (b.treeStyleTab.processTabDragOverEvent(aEvent, b)) {
			aEvent.stopPropagation();
			aEvent.preventDefault(); // this is required to override default dragover actions!
		}
	},
	
	processTabDragOverEvent : function TSTService_processTabDragOverEvent(aEvent, aTabBrowser) 
	{
try{
		var session = this.getCurrentDragSession();
		// don't touch to drag & drop of customizable toolbar items
		if (this.isToolbarCustomizing && !this.getTabFromChild(session.sourceNode))
			return false;

		window['piro.sakura.ne.jp'].autoScroll.processAutoScroll(aEvent);

		var info = this.getDropAction(aEvent, session);

		var setEffectAllowedFunc;
		var observer = aTabBrowser;
		if (aTabBrowser._setEffectAllowedForDataTransfer) {
			setEffectAllowedFunc = function(aEvent) {
				return aTabBrowser._setEffectAllowedForDataTransfer(aEvent);
			};
		}
		else if (aTabBrowser.tabContainer &&
				aTabBrowser.tabContainer._setEffectAllowedForDataTransfer) {
			observer = aTabBrowser.tabContainer;
			setEffectAllowedFunc = function(aEvent) {
				return aTabBrowser.tabContainer._setEffectAllowedForDataTransfer(aEvent);
			};
		}

		// auto-switch for staying on tabs (Firefox 3.0 or later)
		if (
			setEffectAllowedFunc &&
			info.target &&
			!info.target.selected &&
			(
				('mDragTime' in observer && 'mDragOverDelay' in observer) || // Firefox 3.6
				('_dragTime' in observer && '_dragOverDelay' in observer) // Firefox 3.7 or later
			)
			) {
			let time = observer.mDragTime || observer._dragTime || 0;
			let delay = observer.mDragOverDelay || observer._dragOverDelay || 0;
			let effects = setEffectAllowedFunc(aEvent);
			if (effects == 'link') {
				let now = Date.now();
				if (!time) {
					if ('mDragTime' in observer)
						observer.mDragTime = now;
					else
						observer._dragTime = now;
				}
				if (now >= time + delay)
					aTabBrowser.selectedTab = info.target;
			}
		}

		if (!info.target || info.target != this.evaluateXPath(
				'child::xul:tab[@'+this.kDROP_POSITION+']',
				aTabBrowser.mTabContainer,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue)
			this.clearDropPosition();

		if (setEffectAllowedFunc ?
				(setEffectAllowedFunc(aEvent) == 'none') :
				!aTabBrowser.canDrop(aEvent, session)
			)
			return true;

		info.target.setAttribute(
			this.kDROP_POSITION,
			info.position == this.kDROP_BEFORE ? 'before' :
			info.position == this.kDROP_AFTER ? 'after' :
			'self'
		);
		var indicator = aTabBrowser.mTabDropIndicatorBar || aTabBrowser.tabContainer._tabDropIndicator;
		indicator.setAttribute('dragging', (info.position == this.kDROP_ON) ? 'false' : 'true' );
		return (info.position == this.kDROP_ON || aTabBrowser.getAttribute(this.kTABBAR_POSITION) != 'top')
}
catch(e) {
	dump('TreeStyleTabService::onDragOver\n'+e+'\n');
}
	},
  
	onTabDragLeave : function TSTService_onTabDragLeave(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		var tabbarFromEvent = this.getTabbarFromChild(aEvent.relatedTarget);
		if (!tabbarFromEvent)
			b.treeStyleTab.clearDropPosition();
	},
 
	onTabDrop : function TSTService_onTabDrop(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		var tabbar = b.mTabContainer;
		var sv = b.treeStyleTab;
		var dt = aEvent.dataTransfer;

		sv.clearDropPosition();

		var dropActionInfo = sv.getDropAction(aEvent, sv.getCurrentDragSession());

		var draggedTab;
		if (dt.dropEffect != 'link') {
			draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
			if (!draggedTab) {
				aEvent.stopPropagation();
				return;
			}
		}

		if (draggedTab && sv.performDrop(dropActionInfo, draggedTab)) {
			aEvent.stopPropagation();
			return;
		}

		// duplicating of tabs
		if (
			draggedTab &&
			(
				dt.dropEffect == 'copy' ||
				this.getTabBrowserFromChild(draggedTab) != b
			) &&
			dropActionInfo.position == sv.kDROP_ON
			) {
			var beforeTabs = Array.slice(b.mTabContainer.childNodes);
			window.setTimeout(function() {
				var newTabs = Array.slice(b.mTabContainer.childNodes).filter(function(aTab) {
						return beforeTabs.indexOf(aTab) < 0;
					});
				if (newTabs.length)
					sv.attachTabTo(newTabs[0], dropActionInfo.target);
			}, 0);
			return;
		}

		// dropping of urls
		if (!draggedTab) {
			aEvent.stopPropagation();

			let url;
			for (let i = 0; i < tabbar._supportedLinkDropTypes.length; i++) {
				let dataType = tabbar._supportedLinkDropTypes[i];
				let isURLList = dataType == 'text/uri-list';
				let urlData = dt.mozGetDataAt(isURLList ? 'URL' : dataType , 0);
				if (urlData) {
					url = transferUtils.retrieveURLFromData(urlData, isURLList ? 'text/plain' : dataType);
					break;
				}
			}

			if (!url || !url.length || url.indexOf(' ', 0) != -1 || /^\s*(javascript|data):/.test(url))
				return;

			nsDragAndDrop.dragDropSecurityCheck(aEvent, sv.getCurrentDragSession(), url);

			let bgLoad = this.getPref('browser.tabs.loadInBackground');
			if (aEvent.shiftKey) bgLoad = !bgLoad;

			let tab = sv.getTabFromEvent(aEvent);
			if (!tab || dt.dropEffect == 'copy') {
				sv.performDrop(dropActionInfo, b.loadOneTab(getShortcutOrURI(url), { inBackground: bgLoad }));
			}
			else {
				let locked = (
						tab.getAttribute('locked') == 'true' || // Tab Mix Plus and others
						tab.getAttribute('isPageLocked') == 'true' // Super Tab Mode
					);
				let loadDroppedLinkToNewChildTab = dropActionInfo.position != sv.kDROP_ON || locked;
				if (!loadDroppedLinkToNewChildTab &&
					dropActionInfo.position == sv.kDROP_ON)
					loadDroppedLinkToNewChildTab = sv.dropLinksOnTabBehavior() == sv.kDROPLINK_NEWTAB;

				try {
					if (loadDroppedLinkToNewChildTab || locked) {
						sv.performDrop(dropActionInfo, b.loadOneTab(getShortcutOrURI(url), { inBackground: bgLoad }));
					}
					else {
						tab.linkedBrowser.loadURI(getShortcutOrURI(url));
						if (!bgLoad)
							b.selectedTab = tab;
					}
				}
				catch(e) {
				}
			}
		}
	},
 
	onTabDragEnd : function TSTService_onTabDragEnd(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		var tabbar = b.mTabContainer;
		var sv = b.treeStyleTab;
		var dt = aEvent.dataTransfer;

		sv.clearDropPosition();

		if (
			dt.mozUserCancelled ||
			dt.dropEffect != 'none' ||
			tabbar.hasAttribute(this.kDROP_POSITION) // ignore dragging of the tabbar itself
			)
			return;

		// prevent handling of this event by the default handler
		aEvent.stopPropagation();

		var eX = aEvent.screenX;
		var eY = aEvent.screenY;
		var x, y, w, h;

		// ignore drop on the toolbox
		x = window.screenX;
		y = window.screenY;
		w = window.outerWidth;
		h = document.getElementById('navigator-toolbox').boxObject.height;
		if (eX > x && eX < x + w && eY > y && eY < y + h)
			return;

		// ignore drop near the tab bar
		var box = tabbar.boxObject;
		var ignoreArea = Math.max(16, parseInt(tabbar.firstChild.boxObject.height / 2));
		x = box.screenX - (sv.isVertical ? ignoreArea : 0 );
		y = box.screenY - ignoreArea;
		w = box.width + (sv.isVertical ? ignoreArea + ignoreArea : 0 );
		h = box.height + ignoreArea + ignoreArea;
		if (eX > x && eX < x + w && eY > y && eY < y + h)
			return;

		var draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
		if (sv.isDraggingAllTabs(draggedTab))
			return;

		b.replaceTabWithWindow(draggedTab);
	},
  
	overrideGlobalFunctions : function TSTService_overrideGlobalFunctions() 
	{
//		window.__treestyletab__BrowserCustomizeToolbar = window.BrowserCustomizeToolbar;
//		window.BrowserCustomizeToolbar = function() {
//			TreeStyleTabService.destroyBar();
//			window.__treestyletab__BrowserCustomizeToolbar.call(window);
//		};

		let (toolbox) {
			toolbox = document.getElementById('navigator-toolbox');
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
					}) ?
						(
							(TreeStyleTabService.isNewTabAction(event) ? null : TreeStyleTabService.readyToOpenDivertedTab()),
							true
						) :
						(TreeStyleTabService.readyToOpenChildTab(), false)
				]]>
			).replace(
				/* あらゆるリンクからタブを開く設定の時に、アクセルキーが押されていた場合は
				   反転された動作（通常のリンク読み込み）を行う */
				'return false;case 1:',
				<![CDATA[
						if (( // do nothing for Tab Mix Plus
								!TreeStyleTabService.getTreePref('compatibility.TMP') ||
								!('TMP_contentAreaClick' in window)
							) &&
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
					else if (
						( // do nothing for Tab Mix Plus
							!TreeStyleTabService.getTreePref('compatibility.TMP') ||
							!('TMP_contentAreaClick' in window)
						) &&
						TreeStyleTabService.checkReadyToOpenNewTab({
							uri      : wrapper.href,
							external : {
								newTab : TreeStyleTabService.getTreePref('openOuterLinkInNewTab') || TreeStyleTabService.getTreePref('openAnyLinkInNewTab'),
								forceChild : true
							},
							internal : {
								newTab : TreeStyleTabService.getTreePref('openAnyLinkInNewTab')
							}
						})
						) {
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
		eval('FullScreen._animateUp = '+
			FullScreen._animateUp.toSource().replace(
				/(gBrowser\.mStrip\.boxObject\.height)/,
				'((gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION) != "top") ? 0 : $1)'
			)
		);
		eval('FullScreen.mouseoverToggle = '+
			FullScreen.mouseoverToggle.toSource().replace(
				// Firefox 3.7 or later
				'allFSToolbars[i].setAttribute("moz-collapsed", !aShow);',
				'if (allFSToolbars[i].id != "TabsToolbar" || gBrowser.getAttribute(TreeStyleTabService.kTABBAR_POSITION) == "top") { $& }'
			).replace(
				// Firefox 3.7 or later
				'this._isChromeCollapsed = !aShow;',
				'gBrowser.treeStyleTab.updateFloatingTabbar(); $&'
			).replace(
				// Firefox 3.6 or older
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
							treeStyleTab.autoHide.endForFullScreen();
						else
							treeStyleTab.autoHide.startForFullScreen();
					}
				]]>
			)
		);

		if ('PrintUtils' in window) {
			eval('PrintUtils.printPreview = '+PrintUtils.printPreview.toSource().replace(
				'{',
				'{ TreeStyleTabService.onPrintPreviewEnter();'
			));
			eval('PrintUtils.exitPrintPreview = '+PrintUtils.exitPrintPreview.toSource().replace(
				/(\}\)?)$/,
				'TreeStyleTabService.onPrintPreviewExit(); $1'
			));
		}
	},
	_splitFunctionNames : function TSTService__splitFunctionNames(aString)
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
	_getFunctionSource : function TSTService__getFunctionSource(aFunc)
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
 
	initBar : function TSTService_initBar() 
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
  
	destroy : function TSTService_destroy() 
	{
		window.removeEventListener('unload', this, false);

		window['piro.sakura.ne.jp'].animationManager.stop();
		this.destroyTabBrowser(gBrowser);

		this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOHIDE);
		this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);

		document.removeEventListener('popupshowing', this, false);
		document.removeEventListener('popuphiding', this, false);
		document.removeEventListener('TreeStyleTabCollapsedStateChange', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.removeEventListener('SubBrowserAdded', this, false);
		appcontent.removeEventListener('SubBrowserRemoveRequest', this, false);

		window.removeEventListener('UIOperationHistoryUndo:TabbarOperations', this, false);
		window.removeEventListener('UIOperationHistoryRedo:TabbarOperations', this, false);

		this.removePrefListener(this);
		this.ObserverService.removeObserver(this, 'sessionstore-windows-restored');
	},
	
	destroyTabBrowser : function TSTService_destroyTabBrowser(aTabBrowser) 
	{
		if (aTabBrowser.localName != 'tabbrowser') return;
		aTabBrowser.treeStyleTab.destroy();
		delete aTabBrowser.treeStyleTab;
	},
   
/* Event Handling */ 
	
	handleEvent : function TSTService_handleEvent(aEvent) 
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
				if (aEvent.originalTarget.boxObject &&
					!this.evaluateXPath(
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
				if (aEvent.originalTarget.boxObject &&
					!this.evaluateXPath(
						'local-name() = "tooltip" or local-name() ="panel" or '+
						'parent::*/ancestor-or-self::*[local-name()="popup" or local-name()="menupopup"]',
						aEvent.originalTarget,
						XPathResult.BOOLEAN_TYPE
					).booleanValue) {
					this.popupMenuShown = false;
				}
				return;

			case 'TreeStyleTabCollapsedStateChange':
				return this.updateAeroPeekPreviews();

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

			case 'UIOperationHistoryUndo:TabbarOperations':
				switch (aEvent.entry.name)
				{
					case 'treestyletab-changeTabbarPosition':
						this.currentTabbarPosition = aEvent.entry.data.oldPosition;
						return;
				}
				break;

			case 'UIOperationHistoryRedo:TabbarOperations':
				switch (aEvent.entry.name)
				{
					case 'treestyletab-changeTabbarPosition':
						this.currentTabbarPosition = aEvent.entry.data.newPosition;
						return;
				}

			// Firefox 3.5 or later
			case 'dragstart': return this.onTabDragStart(aEvent);
			case 'dragover': return this.onTabDragOver(aEvent);
			case 'dragleave': return this.onTabDragLeave(aEvent);
			// Firefox 3.7 or later
			case 'drop': return this.onTabDrop(aEvent);
			case 'dragend': return this.onTabDragEnd(aEvent);
		}
	},
	
	keyEventListening      : false, 
	keyEventListeningFlags : 0,

	LISTEN_FOR_AUTOHIDE                  : 1,
	LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE : 2,
	
	startListenKeyEventsFor : function TSTService_startListenKeyEventsFor(aReason) 
	{
		if (this.keyEventListeningFlags & aReason) return;
		if (!this.keyEventListening) {
			window.addEventListener('keydown',  this, true);
			window.addEventListener('keyup',    this, true);
			window.addEventListener('keypress', this, true);
			this.keyEventListening = true;
		}
		this.keyEventListeningFlags |= aReason;
	},
 
	endListenKeyEventsFor : function TSTService_endListenKeyEventsFor(aReason) 
	{
		if (!(this.keyEventListeningFlags & aReason)) return;
		this.keyEventListeningFlags ^= aReason;
		if (!this.keyEventListeningFlags && this.keyEventListening) {
			window.removeEventListener('keydown',  this, true);
			window.removeEventListener('keyup',    this, true);
			window.removeEventListener('keypress', this, true);
			this.keyEventListening = false;
		}
	},
 
	onKeyDown : function TSTService_onKeyDown(aEvent) 
	{
		this.accelKeyPressed = this.isAccelKeyPressed(aEvent);

		/* PUBLIC API */
		var b = this.browser;
		var event = b.ownerDocument.createEvent('Events');
		event.initEvent('TreeStyleTabFocusSwitchingKeyDown', true, false);
		event.sourceEvent = aEvent;
		b.dispatchEvent(event);
	},
	accelKeyPressed : false,
 
	onKeyRelease : function TSTService_onKeyRelease(aEvent) 
	{
		var b = this.browser;
		if (!b || !b.treeStyleTab) return;
		var sv = b.treeStyleTab;

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

		var onlyShiftKey = (!aEvent.shiftKey && aEvent.keyCode == 16 && (aEvent.type == 'keyup' || aEvent.charCode == 0));

		if (
			scrollDown ||
			scrollUp ||
			( // when you release "shift" key
				standBy && onlyShiftKey
			)
			) {
			/* PUBLIC API */
			let event = b.ownerDocument.createEvent('Events');
			event.initEvent('TreeStyleTabFocusSwitchingStart', true, false);
			event.scrollDown = scrollDown;
			event.scrollUp = scrollUp;
			event.standBy = standBy;
			event.onlyShiftKey = onlyShiftKey;
			event.sourceEvent = aEvent;
			b.dispatchEvent(event);
			return;
		}

		// when you just release accel key...

		/* PUBLIC API */
		let (event) {
			event = document.createEvent('Events');
			event.initEvent('TreeStyleTabFocusSwitchingEnd', true, false);
			event.scrollDown = scrollDown;
			event.scrollUp = scrollUp;
			event.standBy = standBy;
			event.onlyShiftKey = onlyShiftKey;
			event.sourceEvent = aEvent;
			b.dispatchEvent(event);
		}

		if (this._tabShouldBeExpandedAfterKeyReleased) {
			let tab = this._tabShouldBeExpandedAfterKeyReleased;
			if (this.hasChildTabs(tab) &&
				this.isSubtreeCollapsed(tab)) {
				this.getTabBrowserFromChild(tab)
						.treeStyleTab
						.collapseExpandTreesIntelligentlyFor(tab);
			}
		}
		this._tabShouldBeExpandedAfterKeyReleased = null;
	},
 
	get shouldListenKeyEventsForAutoExpandByFocusChange() 
	{
		return !this.ctrlTabPreviewsEnabled &&
				!this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut') &&
				this.getTreePref('autoCollapseExpandSubtreeOnSelect');
	},
 
	get ctrlTabPreviewsEnabled() 
	{
		return 'allTabs' in window &&
				this.getPref('browser.ctrlTab.previews');
	},
   
	onTabbarResized : function TSTService_onTabbarResized(aEvent) 
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		var box = (b.treeStyleTab.tabStripPlaceHolder || this.getTabStrip(b)).boxObject;
		window.setTimeout(function(aSelf) {
			if (!b.treeStyleTab.clickedOnTabbarResizerGrippy) {
				if (!b.treeStyleTab.isVertical) {
					aSelf.setTreePref('tabbar.height', aSelf.maxTabbarHeight(box.height, b));
				}
				else {
					if (!b.treeStyleTab.autoHide.expanded)
						aSelf.setTreePref('tabbar.shrunkenWidth', aSelf.maxTabbarWidth(box.width, b));
					else
						aSelf.setTreePref('tabbar.width', aSelf.maxTabbarWidth(box.width, b));
				}
			}
			b.treeStyleTab.updateFloatingTabbar();
			b.treeStyleTab.clickedOnTabbarResizerGrippy = false;
		}, 10, this);
	},
	onTabbarResizerClick : function TSTService_onTabbarResizerClick(aEvent)
	{
		var b = this.getTabBrowserFromChild(aEvent.currentTarget);
		b.treeStyleTab.clickedOnTabbarResizerGrippy = this.evaluateXPath(
				'ancestor-or-self::xul:grippy',
				aEvent.originalTarget,
				XPathResult.BOOLEAN_TYPE
			).booleanValue;
	},
 
	showHideSubtreeMenuItem : function TSTService_showHideSubtreeMenuItem(aMenuItem, aTabs) 
	{
		if (!aMenuItem ||
			aMenuItem.getAttribute('hidden') == 'true' ||
			!aTabs ||
			!aTabs.length)
			return;

		var hasSubtree = false;
		for (var i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			if (!this.hasChildTabs(aTabs[i])) continue;
			hasSubtree = true;
			break;
		}
		if (hasSubtree)
			aMenuItem.removeAttribute('hidden');
		else
			aMenuItem.setAttribute('hidden', true);
	},
	showHideSubTreeMenuItem : function() { return this.showHideSubtreeMenuItem.apply(this, arguments); }, // obsolete, for backward compatibility
 
	handleTooltip : function TSTService_handleTooltip(aEvent, aTab) 
	{
		var label;
		var collapsed = this.isSubtreeCollapsed(aTab);

		var base = parseInt(aTab.getAttribute(this.kNEST) || 0);
		var descendant = this.getDescendantTabs(aTab);
		var indentPart = '  ';
		var tree = (this.getTreePref('tooltip.includeChildren') && descendant.length) ?
					[aTab].concat(descendant)
						.map(function(aTab) {
							let label = aTab.getAttribute('label');
							let indent = '';
							let nest = parseInt(aTab.getAttribute(this.kNEST) || 0) - base;
							for (let i = 0; i < nest; i++)
							{
								indent += indentPart;
							}
							return this.treeBundle.getFormattedString('tooltip.item.label', [label, indent]);
						}, this)
						.join('\n') :
					null ;

		if ('mOverCloseButton' in aTab && aTab.mOverCloseButton) {
			if (descendant.length &&
				(collapsed || this.getTreePref('closeParentBehavior') == this.CLOSE_PARENT_BEHAVIOR_CLOSE)) {
				label = this.treeBundle.getString('tooltip.closeTree');
			}
		}
		else if (aTab.getAttribute(this.kTWISTY_HOVER) == 'true') {
			let key = collapsed ?
						'tooltip.expandSubtree' :
						'tooltip.collapseSubtree' ;
			label = tree || aTab.getAttribute('label');
			label = label ?
					this.treeBundle.getFormattedString(key+'.labeled', [label]) :
					this.treeBundle.getString(key) ;
		}
		else if (collapsed) {
			label = tree;
		}

		if (label)
			aEvent.target.setAttribute('label', label);

		return label;
	},
 
	updateAeroPeekPreviews : function TSTService_updateAeroPeekPreviews() 
	{
		if (
			this.updateAeroPeekPreviewsTimer ||
			!('Win7Features' in window) ||
			!window.Win7Features ||
			!this.AeroPeek ||
			!this.AeroPeek.windows
			)
			return;

		this.updateAeroPeekPreviewsTimer = window.setTimeout(function(aSelf) {
			aSelf.updateAeroPeekPreviewsTimer = null;
			try {
				aSelf.updateAeroPeekPreviewsInternal();
			}
			catch(e) {
				dump(e+'\n');
				aSelf.updateAeroPeekPreviews();
			}
		}, 250, this);
	},
	updateAeroPeekPreviewsTimer : null,
	updateAeroPeekPreviewsInternal : function TSTService_updateAeroPeekPreviewsInternal()
	{
		this.AeroPeek.windows.some(function(aTabWindow) {
			if (aTabWindow.win == window) {
				aTabWindow.previews.forEach(function(aPreview) {
					if (!aPreview) return;
					var tab = aPreview.controller.wrappedJSObject.tab;
					aPreview.visible = tab.getAttribute(this.kCOLLAPSED) != 'true';
				}, this);
				this.AeroPeek.checkPreviewCount();
				return true;
			}
			return false;
		}, this);
	},
  
/* Tree Style Tabの初期化が行われる前に復元されたセッションについてツリー構造を復元 */ 
	
	_restoringTabs : [], 
 
	onTabRestored : function TSTService_onTabRestored(aEvent) 
	{
		this._restoringTabs.push(aEvent.originalTarget);
	},
 
	processRestoredTabs : function TSTService_processRestoredTabs() 
	{
		this._restoringTabs.forEach(function(aTab) {
			try {
				var b = this.getTabBrowserFromChild(aTab);
				if (b) b.treeStyleTab.restoreStructure(aTab, true);
			}
			catch(e) {
			}
		}, this);
		this._restoringTabs = [];
	},
  
/* Commands */ 
	
	setTabbarWidth : function TSTService_setTabbarWidth(aWidth, aForceExpanded) /* PUBLIC API */ 
	{
		gBrowser.treeStyleTab.autoHide.setWidth(aWidth, aForceExpanded);
	},
 
	setContentWidth : function TSTService_setContentWidth(aWidth, aKeepWindowSize) /* PUBLIC API */ 
	{
		var treeStyleTab = gBrowser.treeStyleTab;
		var strip = treeStyleTab.tabStrip;
		var tabbarWidth = treeStyleTab.splitterWidth + (treeStyleTab.isVertical ? strip.boxObject.width : 0 );
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
 
	toggleAutoHide : function TSTService_toggleAutoHide() /* PUBLIC API, for backward compatibility */ 
	{
		TreeStyleTabBrowserAutoHide.toggleMode();
	},
 
	toggleFixed : function TSTService_toggleFixed() /* PUBLIC API */ 
	{
		var pos = this.currentTabbarPosition;
		var isVertical = (pos == 'left' || pos == 'right');

		var orient = isVertical ? 'vertical' : 'horizontal' ;
		var pref = 'tabbar.fixed.'+orient;
		this.setTreePref(pref, !this.getTreePref(pref));

		if (!this.getTreePref('tabbar.syncRelatedPrefsForDynamicPosition')) return;

		if (!isVertical)
			this.setTreePref('enableSubtreeIndent.horizontal', !this.getTreePref(pref));
	},
 
	removeTabSubtree : function TSTService_removeTabSubtree(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = this.gatherSubtreeMemberTabs(aTabOrTabs);
		if (!this.warnAboutClosingTabs(tabs.length))
			return;

		this.splitTabsToSubtrees(tabs).forEach(function(aTabs) {
			if (!this.fireTabSubtreeClosingEvent(aTabs[0], aTabs))
				return;
			var b = this.getTabBrowserFromChild(aTabs[0]);
			if (aOnlyChildren)
				aTabs = aTabs.slice(1);
			if (!aTabs.length)
				return;
			this.stopRendering();
			this.markAsClosedSet(aTabs);
			for (var i = aTabs.length-1; i > -1; i--)
			{
				b.removeTab(aTabs[i]);
			}
			this.startRendering();
			this.fireTabSubtreeClosedEvent(b, aTabs[0], aTabs)
		}, this);
	},
	removeTabSubTree : function() { return this.removeTabSubtree.apply(this, arguments); }, // obsolete, for backward compatibility
	
	fireTabSubtreeClosingEvent : function TSTService_fireTabSubtreeClosingEvent(aParentTab, aClosedTabs) 
	{
		/* PUBLIC API */
		var event = aParentTab.ownerDocument.createEvent('Events');
		event.initEvent('TreeStyleTabSubtreeClosing', true, true);
		event.parent = aParentTab;
		event.tabs = aClosedTabs;
		return this.getTabBrowserFromChild(aParentTab).dispatchEvent(event);
	},
 
	fireTabSubtreeClosedEvent : function TSTService_fireTabSubtreeClosedEvent(aTabBrowser, aParentTab, aClosedTabs) 
	{
		aClosedTabs = aClosedTabs.filter(function(aTab) { return !aTab.parentNode; });
		/* PUBLIC API */
		var event = aTabBrowser.ownerDocument.createEvent('Events');
		event.initEvent('TreeStyleTabSubtreeClosed', true, false);
		event.parent = aParentTab;
		event.tabs = aClosedTabs;
		aTabBrowser.dispatchEvent(event);
	},
 
	warnAboutClosingTabSubtreeOf : function TSTService_warnAboutClosingTabSubtreeOf(aTab) 
	{
		if (!this.shouldCloseTabSubtreeOf(aTab))
			return true;

		var tabs = [aTab].concat(this.getDescendantTabs(aTab));
		return this.warnAboutClosingTabs(tabs.length);
	},
	warnAboutClosingTabSubTreeOf : function() { return this.warnAboutClosingTabSubtreeOf.apply(this, arguments); }, // obsolete, for backward compatibility
 
	warnAboutClosingTabs : function TSTService_warnAboutClosingTabs(aTabsCount) 
	{
		if (
			aTabsCount <= 1 ||
			!this.getPref('browser.tabs.warnOnClose')
			)
			return true;
		var checked = { value:true };
		window.focus();
		var shouldClose = this.PromptService.confirmEx(window,
				this.tabbrowserBundle.getString('tabs.closeWarningTitle'),
				this.tabbrowserBundle.getFormattedString('tabs.closeWarningMultipleTabs', [aTabsCount]),
				(this.PromptService.BUTTON_TITLE_IS_STRING * this.PromptService.BUTTON_POS_0) +
				(this.PromptService.BUTTON_TITLE_CANCEL * this.PromptService.BUTTON_POS_1),
				this.tabbrowserBundle.getString('tabs.closeButtonMultiple'),
				null, null,
				this.tabbrowserBundle.getString('tabs.closeWarningPromptMe'),
				checked
			) == 0;
		if (shouldClose && !checked.value)
			this.setPref('browser.tabs.warnOnClose', false);
		return shouldClose;
	},
  
	reloadTabSubtree : function TSTService_reloadTabSubtree(aTabOrTabs, aOnlyChildren) 
	{
		var tabs = this.gatherSubtreeMemberTabs(aTabOrTabs, aOnlyChildren);
		var b = this.getTabBrowserFromChild(tabs[0]);
		for (var i = tabs.length-1; i > -1; i--)
		{
			b.reloadTab(tabs[i]);
		}
	},
	reloadTabSubTree : function() { return this.reloadTabSubtree.apply(this, arguments); }, // obsolete, for backward compatibility
 
	createSubtree : function TSTService_createSubtree(aTabs) 
	{
		aTabs = this.getRootTabs(aTabs);
		if (!aTabs.length) return;

		var b = this.getTabBrowserFromChild(aTabs[0]);

		var parent = this.getParentTab(aTabs[0]);

		var next = aTabs[0];
		while (
			(next = this.getNextSiblingTab(next)) &&
			aTabs.indexOf(next) > -1
		);

		var root = this.getTreePref('createSubtree.underParent') ?
					b.addTab(this.getGroupTabURI()) :
					aTabs.shift() ;
		window.setTimeout(function(aSelf) {
			aTabs.forEach(function(aTab) {
				b.treeStyleTab.attachTabTo(aTab, root);
				b.treeStyleTab.collapseExpandTab(aTab, false);
			}, aSelf);
			if (parent) {
				b.treeStyleTab.attachTabTo(root, parent, {
					insertBefore : next
				});
			}
			else if (next) {
				b.treeStyleTab.moveTabSubtreeTo(root, next._tPos);
			}
		}, 0, this);
	},
	createSubTree : function() { return this.createSubtree.apply(this, arguments); }, // obsolete, for backward compatibility
	
	canCreateSubtree : function TSTService_canCreateSubtree(aTabs) 
	{
		aTabs = this.getRootTabs(aTabs);
		if (aTabs.length < 2) return false;

		var lastParent = this.getParentTab(aTabs[0]);
		for (let i = 1, maxi = aTabs.length-1; i < maxi; i++)
		{
			let parent = this.getParentTab(aTabs[i]);
			if (!lastParent || parent != lastParent) return true;
			lastParent = parent;
		}
		return this.getChildTabs(lastParent).length != aTabs.length;
	},
	canCreateSubTree : function() { return this.canCreateSubtree.apply(this, arguments); }, // obsolete, for backward compatibility
 
	getRootTabs : function TSTService_getRootTabs(aTabs) 
	{
		var roots = [];
		if (!aTabs || !aTabs.length) return roots;
		aTabs = this.cleanUpTabsArray(aTabs);
		aTabs.forEach(function(aTab) {
			var parent = this.getParentTab(aTab);
			if (parent && aTabs.indexOf(parent) > -1) return;
			roots.push(aTab);
		}, this);
		return roots;
	},
  
	collapseExpandAllSubtree : function TSTService_collapseExpandAllSubtree(aCollapse) 
	{
		this.ObserverService.notifyObservers(
			window,
			'TreeStyleTab:collapseExpandAllSubtree',
			(aCollapse ? 'collapse' : 'open' )
		);
	},
 
	promoteTab : function TSTService_promoteTab(aTab) /* PUBLIC API */ 
	{
		var b = this.getTabBrowserFromChild(aTab);
		var sv = b.treeStyleTab;

		var parent = sv.getParentTab(aTab);
		if (!parent) return;

		var nextSibling = sv.getNextSiblingTab(parent);

		var grandParent = sv.getParentTab(parent);
		if (grandParent) {
			sv.attachTabTo(aTab, grandParent, {
				insertBefore : nextSibling
			});
		}
		else {
			sv.partTab(aTab);
			let index = nextSibling ? nextSibling._tPos : b.mTabContainer.childNodes.length ;
			if (index > aTab._tPos) index--;
			b.moveTabTo(aTab, index);
		}
	},
	
	promoteCurrentTab : function TSTService_promoteCurrentTab() /* PUBLIC API */ 
	{
		this.promoteTab(this.browser.selectedTab);
	},
  
	demoteTab : function TSTService_demoteTab(aTab) /* PUBLIC API */ 
	{
		var b = this.getTabBrowserFromChild(aTab);
		var sv = b.treeStyleTab;

		var previous = this.getPreviousSiblingTab(aTab);
		if (previous)
			sv.attachTabTo(aTab, previous);
	},
	
	demoteCurrentTab : function TSTService_demoteCurrentTab() /* PUBLIC API */ 
	{
		this.demoteTab(this.browser.selectedTab);
	},
  
	expandTreeAfterKeyReleased : function TSTService_expandTreeAfterKeyReleased(aTab) 
	{
		if (this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut')) return;
		this._tabShouldBeExpandedAfterKeyReleased = aTab || null;
	},
	_tabShouldBeExpandedAfterKeyReleased : null,
 
	registerTabFocusAllowance : function TSTService_registerTabFocusAllowance(aProcess) /* PUBLIC API */ 
	{
		this._tabFocusAllowance.push(aProcess);
	},
	_tabFocusAllowance : [],
 
	tearOffSubtreeFromRemote : function TSTService_tearOffSubtreeFromRemote() 
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
	tearOffSubTreeFromRemote : function() { return this.tearOffSubtreeFromRemote.apply(this, arguments); }, // obsolete, for backward compatibility
 
	onPrintPreviewEnter : function TSTService_onPrintPreviewEnter() 
	{
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabPrintPreviewEntered', true, false);
		document.documentElement.dispatchEvent(event);
	},
 
	onPrintPreviewExit : function TSTService_onPrintPreviewExit() 
	{
		var event = document.createEvent('Events');
		event.initEvent('TreeStyleTabPrintPreviewExited', true, false);
		document.documentElement.dispatchEvent(event);
	},
  
	observe : function TSTService_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onPrefChange(aData);
				return;

			case 'sessionstore-windows-restored':
				if (!this.useTMPSessionAPI)
					this.restoringTree = this.getRestoringTabsCount() > 1;
				return;
		}
	},
	restoringTree : false,
	getRestoringTabsCount : function TSTService_getRestoringTabsCount()
	{
		return this.getTabsArray(this.browser)
				.filter(function(aTab) {
					var owner = aTab.linkedBrowser;
					var data = owner.__SS_data || // Firefox 3.6-
								owner.parentNode.__SS_data; // -Firefox 3.5
					return data && data._tabStillLoading;
				}).length;
	},
 
/* Pref Listener */ 
	
	domains : [ 
		'extensions.treestyletab',
		'browser.ctrlTab.previews'
	],
 
	onPrefChange : function TSTService_onPrefChange(aPrefName) 
	{
		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.autoHide.mode':
				// don't set on this time, because appearance of all tabbrowsers are not updated yet.
				// this.autoHide.mode = this.getTreePref('tabbar.autoHide.mode');
			case 'extensions.treestyletab.tabbar.autoShow.accelKeyDown':
			case 'extensions.treestyletab.tabbar.autoShow.tabSwitch':
			case 'extensions.treestyletab.tabbar.autoShow.feedback':
				TreeStyleTabBrowserAutoHide.updateKeyListeners();
				break;

			case 'extensions.treestyletab.tabbar.style':
			case 'extensions.treestyletab.tabbar.position':
				this.preLoadImagesForStyle([
					this.getPref('extensions.treestyletab.tabbar.style'),
					this.currentTabbarPosition
				].join('-'));
				break;

			case 'browser.ctrlTab.previews':
				TreeStyleTabBrowserAutoHide.updateKeyListeners();
			case 'extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut':
			case 'extensions.treestyletab.autoCollapseExpandSubtreeOnSelect':
				if (this.shouldListenKeyEventsForAutoExpandByFocusChange)
					this.startListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);
				else
					this.endListenKeyEventsFor(this.LISTEN_FOR_AUTOEXPAND_BY_FOCUSCHANGE);
				break;

			default:
				break;
		}
	},
  
}; 
  
(function() { 
	var namespace = {};
	Components.utils.import(
		'resource://treestyletab-modules/utils.js',
		namespace
	);
	TreeStyleTabService.__proto__ = TreeStyleTabService.utils = namespace.TreeStyleTabUtils;
	TreeStyleTabService.utils.init();
})();
window.addEventListener('DOMContentLoaded', TreeStyleTabService, true);
window.addEventListener('load', TreeStyleTabService, false);
TreeStyleTabService.ObserverService.addObserver(TreeStyleTabService, 'sessionstore-windows-restored', false);
 
