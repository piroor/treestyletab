function TreeStyleTabBrowserTabbarDNDObserver(aOwner) 
{
	this.init(aOwner);
}

TreeStyleTabBrowserTabbarDNDObserver.prototype = {
	
	get SSS() 
	{
		if (this._SSS === void(0)) {
			if ('@mozilla.org/content/style-sheet-service;1' in Components.classes) {
				this._SSS = Components.classes['@mozilla.org/content/style-sheet-service;1'].getService(Components.interfaces.nsIStyleSheetService);
			}
			if (!this._SSS)
				this._SSS = null;
		}
		return this._SSS;
	},
 
	readyToStartTabbarDrag : function TSTTabbarDND_readyToStartTabbarDrag() 
	{
		var sheet = this.mOwner.makeURIFromSpec('chrome://treestyletab/content/hide-embed.css');
		if (!this.SSS.sheetRegistered(sheet, this.SSS.AGENT_SHEET))
			this.SSS.loadAndRegisterSheet(sheet, this.SSS.AGENT_SHEET);
	},
 
	readyToEndTabbarDrag : function TSTTabbarDND_readyToEndTabbarDrag() 
	{
		var sheet = this.mOwner.makeURIFromSpec('chrome://treestyletab/content/hide-embed.css');
		if (this.SSS.sheetRegistered(sheet, this.SSS.AGENT_SHEET))
			this.SSS.unregisterSheet(sheet, this.SSS.AGENT_SHEET);
	},
 
	canDragTabbar : function TSTTabbarDND_canDragTabbar(aEvent) 
	{
		var sv = this.mOwner;

		if (
			sv.evaluateXPath(
				'ancestor-or-self::*[contains(" scrollbar popup menupopup panel tooltip ", concat(" ", local-name(), " "))]',
				aEvent.originalTarget,
				XPathResult.BOOLEAN_TYPE
			).booleanValue ||
			sv.isToolbarCustomizing
			)
			return false;

		var tab = sv.getTabFromEvent(aEvent);
		var tabbar = sv.getTabbarFromEvent(aEvent);
		var canDrag = (
				(tab ? aEvent.shiftKey : tabbar ) &&
				(
					aEvent.shiftKey ||
					sv.mTabBrowser.getAttribute(sv.kFIXED) != 'true'
				)
			);

		if (canDrag && !aEvent.shiftKey) {
			let insensitiveArea = sv.getTreePref('tabbar.fixed.insensitiveArea');
			let box = tabbar.boxObject;
			switch (sv.currentTabbarPosition)
			{
				case 'right':
					if (aEvent.screenX < box.screenX + insensitiveArea)
						canDrag = false;
					break;

				case 'left':
					if (aEvent.screenX > box.screenX + box.width - insensitiveArea)
						canDrag = false;
					break;

				default:
				case 'top':
					if (aEvent.screenY > box.screenY + box.height - insensitiveArea)
						canDrag = false;
					break;

				case 'bottom':
					if (aEvent.screenY < box.screenY + insensitiveArea)
						canDrag = false;
					break;
			}
		}

		return canDrag;
	},
 
	canDrop : function TSTTabbarDND_canDrop(aEvent) 
	{
		var sv = this.mOwner;
		var tooltip = sv.tabStrip.firstChild;
		if (tooltip &&
			tooltip.localName == 'tooltip' &&
			tooltip.popupBoxObject.popupState != 'closed')
			tooltip.hidePopup();

		var dropAction = sv.getDropAction(aEvent);
		if ('dataTransfer' in aEvent) {
			var dt = aEvent.dataTransfer;
			if (dropAction.action & this.kACTION_NEWTAB) {
				dt.effectAllowed = dt.dropEffect = (
					!dropAction.source ? 'link' :
					sv.isCopyAction(aEvent) ? 'copy' :
					'move'
				);
			}
		}
		return dropAction.canDrop;
	},
	
	canDropTab : function TSTTabbarDND_canDropTab(aEvent) 
	{
try{
		var sv = this.mOwner;
		var b  = sv.mTabBrowser;

		var session = sv.getCurrentDragSession();
		var node = session.sourceNode;
		var tab = sv.getTabFromChild(node);
		if (!node ||
			!tab ||
			tab.parentNode != b.mTabContainer)
			return true;

		tab = sv.getTabFromEvent(aEvent);
		if (sv.isCollapsed(tab))
			return false;

		var info = sv.getDropAction(aEvent, session);
		return info.canDrop;
}
catch(e) {
		dump('TreeStyleTabService::canDrop\n'+e+'\n');
		return false;
}
	},
  
	handleEvent : function TSTTabbarDND_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'dragstart': return this.onDragStart(aEvent);
			case 'dragenter': return this.onDragEnter(aEvent);
			case 'dragleave': return this.onDragLeave(aEvent);
			case 'dragend':   return this.onDragEnd(aEvent);
			case 'dragover':  return this.onDragOver(aEvent);
			case 'drop':      return this.onDrop(aEvent);
		}
	},
	
	onDragStart : function TSTTabbarDND_onDragStart(aEvent) 
	{
		if (this.canDragTabbar(aEvent))
			return this.onTabbarDragStart(aEvent);

		var tab = this.mOwner.getTabFromEvent(aEvent);
		if (tab)
			return this.onTabDragStart(aEvent, tab);
	},
	
	onTabDragStart : function TSTTabbarDND_onTabDragStart(aEvent, aTab) 
	{
		var sv = this.mOwner;
		var actionInfo = {
				action : sv.kACTIONS_FOR_DESTINATION | sv.kACTION_MOVE,
				event  : aEvent
			};
		var tabsInfo = sv.getDraggedTabsInfoFromOneTab(actionInfo, aTab);
		if (tabsInfo.draggedTabs.length > 1)
			window['piro.sakura.ne.jp'].tabsDragUtils.startTabsDrag(aEvent, tabsInfo.draggedTabs);
	},
 
	onTabbarDragStart : function TSTTabbarDND_onTabbarDragStart(aEvent) 
	{
		var sv = this.mOwner;
		var dt = aEvent.dataTransfer;
		dt.mozSetDataAt(
			sv.kDRAG_TYPE_TABBAR,
			aEvent.shiftKey ?
				sv.kTABBAR_MOVE_FORCE :
				sv.kTABBAR_MOVE_NORMAL,
			0
		);
		dt.mozCursor = 'move';
//		var tabbar = sv.mTabBrowser.mTabContainer;
//		var box = tabbar.boxObject;
//		dt.setDragImage(
//			tabbar,
//			aEvent.screenX - box.screenX,
//			aEvent.screenY - box.screenY
//		);
		// no feedback image, because it's annoying...
		dt.setDragImage(new Image(), 0, 0);
		aEvent.stopPropagation();
		this.readyToStartTabbarDrag();
	},
  
	onDragEnter : function TSTTabbarDND_onDragEnter(aEvent) 
	{
		var sv = this.mOwner;

		var dt = aEvent.dataTransfer;
		if (!this.canDrop(aEvent)) {
			dt.effectAllowed = dt.dropEffect = 'none';
			return;
		}

		var tab = aEvent.target;
		if (tab.localName != 'tab' ||
			!sv.getTreePref('autoExpand.enabled'))
			return;

		window.clearTimeout(this.mAutoExpandTimer);

		var sourceNode = dt.getData(sv.kDRAG_TYPE_TABBAR+'-node');
		if (aEvent.target == sourceNode)
			return;

		this.mAutoExpandTimer = window.setTimeout(
			function(aTarget) {
				let tab = sv.getTabById(aTarget);
				if (tab &&
					sv.shouldTabAutoExpanded(tab) &&
					tab.getAttribute(sv.kDROP_POSITION) == 'self') {
					if (sv.getTreePref('autoExpand.intelligently')) {
						sv.collapseExpandTreesIntelligentlyFor(tab);
					}
					else {
						this.mAutoExpandedTabs.push(aTarget);
						sv.collapseExpandSubtree(tab, false);
					}
				}
			},
			sv.getTreePref('autoExpand.delay'),
			tab.getAttribute(sv.kID)
		);

		tab = null;
	},
 
	onDragLeave : function TSTTabbarDND_onDragLeave(aEvent) 
	{
		var sv = this.mOwner;
		var b  = sv.mTabBrowser;

		var tabbarFromEvent = sv.getTabbarFromChild(aEvent.relatedTarget);
		if (!tabbarFromEvent)
			sv.clearDropPosition();

		window.clearTimeout(this.mAutoExpandTimer);
		this.mAutoExpandTimer = null;
	},
 
	onDragEnd : function TSTTabbarDND_onDragEnd(aEvent) 
	{
		var sv = this.mOwner;
		var dt = aEvent.dataTransfer;
		if (dt.getData(sv.kDRAG_TYPE_TABBAR))
			this.onTabbarDragEnd(aEvent);
		else
			this.onTabDragEnd(aEvent);
	},
	
	onTabDragEnd : function TSTTabbarDND_onTabDragEnd(aEvent) 
	{
		var sv = this.mOwner;
		var b  = sv.mTabBrowser;

		var tabbar = b.mTabContainer;
		var strip = sv.tabStrip;
		var dt = aEvent.dataTransfer;

		sv.clearDropPosition();

		if (dt.mozUserCancelled || dt.dropEffect != 'none')
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
		var box = strip.boxObject;
		var ignoreArea = Math.max(16, parseInt(sv.getFirstNormalTab(b).boxObject.height / 2));
		x = box.screenX - (sv.isVertical ? ignoreArea : 0 );
		y = box.screenY - ignoreArea;
		w = box.width + (sv.isVertical ? ignoreArea + ignoreArea : 0 );
		h = box.height + ignoreArea + ignoreArea;
		if (eX > x && eX < x + w && eY > y && eY < y + h)
			return;

		var draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
		if (sv.isDraggingAllCurrentTabs(draggedTab))
			return;

		b.replaceTabWithWindow(draggedTab);
	},
 
	onTabbarDragEnd : function TSTTabbarDND_onTabbarDragEnd(aEvent) 
	{
		window.setTimeout(function(aSelf) {
			aSelf.readyToEndTabbarDrag();
			aSelf.mOwner.removeTabbrowserAttribute(aSelf.mOwner.kDROP_POSITION);
		}, 10, this);
		aEvent.stopPropagation();
		aEvent.preventDefault();
	},
  
	onDragOver : function TSTTabbarDND_onDragOver(aEvent) 
	{
		if (this.onTabDragOver(aEvent)) {
			aEvent.stopPropagation();
			aEvent.preventDefault(); // this is required to override default dragover actions!
		}
	},
	
	onTabDragOver : function TSTTabbarDND_onTabDragOver(aEvent) 
	{
try{
		var sv = this.mOwner;
		var b  = sv.mTabBrowser;

		var session = sv.getCurrentDragSession();
		if (
			sv.isToolbarCustomizing ||
			!sv.getTabFromChild(session.sourceNode)
			)
			return false;

		sv.autoScroll.processAutoScroll(aEvent);

		var info = sv.getDropAction(aEvent, session);

		var observer = b;
		if (b.tabContainer && b.tabContainer._setEffectAllowedForDataTransfer) // for Firefox 4.0
			observer = b.tabContainer;

		// auto-switch for staying on tabs (Firefox 3.5 or later)
		if (
			info.position == sv.kDROP_ON &&
			info.target &&
			!info.target.selected &&
			(
				('mDragTime' in observer && 'mDragOverDelay' in observer) || // Firefox 3.6
				('_dragTime' in observer && '_dragOverDelay' in observer) // Firefox 4.0 or later
			)
			) {
			let time = observer.mDragTime || observer._dragTime || 0;
			let delay = observer.mDragOverDelay || observer._dragOverDelay || 0;
			let effects = observer._setEffectAllowedForDataTransfer(aEvent);
			if (effects == 'link') {
				let now = Date.now();
				if (!time) {
					time = now;
					if ('mDragTime' in observer)
						observer.mDragTime = time;
					else
						observer._dragTime = time;
				}
				if (now >= time + delay)
					aTabBrowser.selectedTab = info.target;
			}
		}

		if (!info.target || info.target != sv.evaluateXPath(
				'child::xul:tab[@'+sv.kDROP_POSITION+']',
				b.mTabContainer,
				XPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue)
			sv.clearDropPosition();

		if (
			!info.canDrop ||
			observer._setEffectAllowedForDataTransfer(aEvent) == 'none'
			) {
			aEvent.dataTransfer.effectAllowed = "none";
			return true;
		}

		info.target.setAttribute(
			sv.kDROP_POSITION,
			info.position == sv.kDROP_BEFORE ? 'before' :
			info.position == sv.kDROP_AFTER ? 'after' :
			'self'
		);
		var indicator = b.mTabDropIndicatorBar || b.tabContainer._tabDropIndicator;
		indicator.setAttribute('dragging', (info.position == sv.kDROP_ON) ? 'false' : 'true' );
		return (info.position == sv.kDROP_ON || sv.currentTabbarPosition != 'top')
}
catch(e) {
	dump('TreeStyleTabService::onDragOver\n'+e+'\n');
}
	},
  
	onDrop : function TSTTabbarDND_onDrop(aEvent) 
	{
		this.onTabDrop(aEvent);

		var sv = this.mOwner;
		if (this.mAutoExpandedTabs.length) {
			if (sv.getTreePref('autoExpand.collapseFinally')) {
				this.mAutoExpandedTabs.forEach(function(aTarget) {
					this.collapseExpandSubtree(this.getTabById(aTarget), true, true);
				}, sv);
			}
			this.mAutoExpandedTabs = [];
		}
	},
	
	onTabDrop : function TSTService_onTabDrop(aEvent) 
	{
		var sv = this.mOwner;
		var b  = sv.mTabBrowser;

		var tabbar = b.mTabContainer;
		var dt = aEvent.dataTransfer;

		sv.clearDropPosition();

		if (tabbar._tabDropIndicator) // for Firefox 4 or later
			tabbar._tabDropIndicator.collapsed = true;

		var session = sv.getCurrentDragSession();
		var dropActionInfo = sv.getDropAction(aEvent, session);

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
				sv.getTabBrowserFromChild(draggedTab) != b
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

			let url = this.retrieveURLFromDataTransfer(dt);

			if (!url || !url.length || url.indexOf(' ', 0) != -1 || /^\s*(javascript|data):/.test(url))
				return;

			let (sourceDoc = session ? session.sourceDocument : null) {
				if (sourceDoc &&
					sourceDoc.documentURI.indexOf('chrome://') < 0) {
					let sourceURI = sourceDoc.documentURI;
					let nsIScriptSecurityManager = Components.interfaces.nsIScriptSecurityManager;
					let secMan = Components.classes['@mozilla.org/scriptsecuritymanager;1']
									.getService(nsIScriptSecurityManager);
					try {
						secMan.checkLoadURIStr(sourceDoc.documentURI, url, nsIScriptSecurityManager.STANDARD);
					}
					catch(e) {
						aEvent.stopPropagation();
						throw 'Drop of ' + url + ' denied.';
					}
				}
			}

			let bgLoad = sv.getPref('browser.tabs.loadInBackground');
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
	
	retrieveURLFromDataTransfer : function TSTService_retrieveURLFromDataTransfer(aDataTransfer) 
	{
		let url;
		let types = ['text/x-moz-url', 'text/uri-list', 'text/plain', 'application/x-moz-file'];
		for (let i = 0; i < types.length; i++) {
			let dataType = types[i];
			let isURLList = dataType == 'text/uri-list';
			let urlData = aDataTransfer.mozGetDataAt(isURLList ? 'URL' : dataType , 0);
			if (urlData) {
				url = this.retrieveURLFromData(urlData, isURLList ? 'text/plain' : dataType);
				break;
			}
		}
		return url;
	},
	retrieveURLFromData : function TSTService_retrieveURLFromData(aData, aType)
	{
		switch (aType)
		{
			case 'text/unicode':
			case 'text/plain':
			case 'text/x-moz-text-internal':
				return aData.replace(/^\s+|\s+$/g, '');

			case 'text/x-moz-url':
				return ((aData instanceof Components.interfaces.nsISupportsString) ? aData.toString() : aData)
							.split('\n')[0];

			case 'application/x-moz-file':
				let fileHandler = this.IOService.getProtocolHandler('file')
									.QueryInterface(Components.interfaces.nsIFileProtocolHandler);
				return fileHandler.getURLSpecFromFile(aData);
		}
		return null;
	},
    
	init : function TSTTabbarDND_init(aOwner) 
	{
		this.mOwner = aOwner;
		this.mAutoExpandTimer = null;
		this.mAutoExpandedTabs = [];

		var strip = this.mOwner.tabStrip;
		strip.addEventListener('dragstart', this, true);
		strip.addEventListener('dragover',  this, true);
		strip.addEventListener('dragenter', this, false);
		strip.addEventListener('dragleave', this, false);
		strip.addEventListener('dragend',   this, false);
		strip.addEventListener('drop',      this, true);
	},
 
	destroy : function TSTTabbarDND_destroy() 
	{
		var strip = this.mOwner.tabStrip;
		strip.removeEventListener('dragstart', this, true);
		strip.removeEventListener('dragover',  this, true);
		strip.removeEventListener('dragenter', this, false);
		strip.removeEventListener('dragleave', this, false);
		strip.removeEventListener('dragend',   this, false);
		strip.removeEventListener('drop',      this, true);

		delete this.mOwner;
	}
 
}; 
  
