/*
 Multiple Tabs Drag and Drop Utilities for Firefox 3.5 or later

 Usage:
   window['piro.sakura.ne.jp'].tabsDragUtils.initTabBrowser(gBrowser);

   // in dragstart event listener
   window['piro.sakura.ne.jp'].tabsDragUtils.startTabsDrag(aEvent, aArrayOfTabs);

 license: The MIT License, Copyright (c) 2010 SHIMODA "Piro" Hiroshi
   http://github.com/piroor/fxaddonlibs/blob/master/license.txt
 original:
   http://github.com/piroor/fxaddonlibs/blob/master/tabsDragUtils.js
*/
(function() {
	const currentRevision = 2;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'tabsDragUtils' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].tabsDragUtils.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	if (loadedRevision &&
		'destroy' in window['piro.sakura.ne.jp'].tabsDragUtils)
		window['piro.sakura.ne.jp'].tabsDragUtils.destroy();

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	var tabsDragUtils = {
		revision : currentRevision,

		init : function TDU_init()
		{
		},
		destroy : function TDU_destroy()
		{
		},

		initTabBrowser : function TDU_initTabBrowser(aTabBrowser)
		{
			var tabDNDObserver = (aTabBrowser.tabContainer && aTabBrowser.tabContainer.tabbrowser == aTabBrowser) ?
									aTabBrowser.tabContainer : // Firefox 4.0 or later
									aTabBrowser ; // Firefox 3.5 - 3.6
			if ('_setEffectAllowedForDataTransfer' in tabDNDObserver &&
				tabDNDObserver._setEffectAllowedForDataTransfer.toSource().indexOf('tabDragUtils') < 0) {
				eval('tabDNDObserver._setEffectAllowedForDataTransfer = '+
					tabDNDObserver._setEffectAllowedForDataTransfer.toSource().replace(
						'dt.mozItemCount > 1',
						'$& && !window["piro.sakura.ne.jp"].tabsDragUtils.isTabsDragging(arguments[0])'
					)
				);
			}
		},
		destroyTabBrowser : function TDU_destroyTabBrowser(aTabBrowser)
		{
		},

		startTabsDrag : function TDU_startTabsDrag(aEvent, aTabs)
		{
			var draggedTab = this.getTabFromEvent(aEvent);
			var tabs = aTabs || [];
			var index = tabs.indexOf(draggedTab);
			if (index < 0)
				return;

			var dt = aEvent.dataTransfer;
			dt.setDragImage(this.createDragFeedbackImage(tabs), 0, 0);

			tabs.splice(index, 1);
			tabs.unshift(draggedTab);

			tabs.forEach(function(aTab, aIndex) {
				dt.mozSetDataAt(TAB_DROP_TYPE, aTab, aIndex);
				dt.mozSetDataAt('text/x-moz-text-internal', this.getCurrentURIOfTab(aTab), aIndex);
			}, this);

			dt.mozCursor = 'default';

			aEvent.stopPropagation();
		},
		createDragFeedbackImage : function TDU_createDragFeedbackImage(aTabs)
		{
			var previews = aTabs.map(function(aTab) {
					return tabPreviews.capture(aTab, false);
				}, this);
			var offset = 16;

			var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
			canvas.width = previews[0].width + (offset * aTabs.length);
			canvas.height = previews[0].height + (offset * aTabs.length);

			var ctx = canvas.getContext('2d');
			ctx.save();
			try {
				ctx.clearRect(0, 0, canvas.width, canvas.height);
				previews.forEach(function(aPreview, aIndex) {
					ctx.drawImage(aPreview, 0, 0);
					ctx.translate(offset, offset);
					ctx.globalAlpha = 1 / (aIndex+1);
				}, this);
			}
			catch(e) {
			}
			ctx.restore();

			return canvas;
		},
		getTabFromEvent : function TDU_getTabFromEvent(aEvent, aReallyOnTab) 
		{
			var tab = (aEvent.originalTarget || aEvent.target).ownerDocument.evaluate(
					'ancestor-or-self::*[local-name()="tab"]',
					aEvent.originalTarget || aEvent.target,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
			if (tab || aReallyOnTab)
				return tab;

			var b = this.getTabBrowserFromChild(aEvent.originalTarget);
			if (b &&
				'treeStyleTab' in b &&
				'getTabFromTabbarEvent' in b.treeStyleTab) { // Tree Style Tab
				return b.treeStyleTab.getTabFromTabbarEvent(aEvent);
			}
			return null;
		},
		getTabBrowserFromChild : function TDU_getTabBrowserFromChild(aTabBrowserChild) 
		{
			if (!aTabBrowserChild)
				return null;

			if (aTabBrowserChild.localName == 'tabbrowser') // itself
				return aTabBrowserChild;

			if (aTabBrowserChild.tabbrowser) // tabs, Firefox 4.0 or later
				return aTabBrowserChild.tabbrowser;

			if (aTabBrowserChild.id == 'TabsToolbar') // tabs toolbar, Firefox 4.0 or later
				return aTabBrowserChild.getElementsByTagName('tabs')[0].tabbrowser;

			var b = aTabBrowserChild.ownerDocument.evaluate(
					'ancestor-or-self::*[local-name()="tabbrowser"] | '+
					'ancestor-or-self::*[local-name()="tabs" and @tabbrowser]',
					aTabBrowserChild,
					XPathResult.FIRST_ORDERED_NODE_TYPE
				).singleNodeValue;
			return (b && b.tabbrowser) || b;
		},

		isTabsDragging : function TDU_isTabsDragging(aEvent) 
		{
			var dt = aEvent.dataTransfer;
			if (dt.mozItemCount < 1)
				return false;
			for (let i = 0, maxi = dt.mozItemCount; i < maxi; i++)
			{
				if (!dt.mozTypesAt(i).contains(TAB_DROP_TYPE))
					return false;
			}
			return true;
		},

		getDraggedTabs : function TDU_getDraggedTabs(aEvent)
		{
			var dt = aEvent.dataTransfer;
			var tabs = [];
			if (dt.mozItemCount < 1 ||
				!dt.mozTypesAt(0).contains(TAB_DROP_TYPE))
				return tabs;

			for (let i = 0, maxi = dt.mozItemCount; i < maxi; i++)
			{
				tabs.push(dt.mozGetDataAt(TAB_DROP_TYPE, i));
			}
			return tabs.sort(function(aA, aB) { return aA._tPos - aB._tPos; });
		},
 
	 	getCurrentURIOfTab : function TDU_getCurrentURIOfTab(aTab) 
		{
			// Firefox 4.0-
			if (aTab.linkedBrowser.__SS_needsRestore) {
				let data = aTab.linkedBrowser.__SS_data;
				let entry = data.entries[Math.max(data.index, data.entries.length-1)];
				return entry.url;
			}
			return aTab.linkedBrowser.currentURI.spec;
		}
	};

	window['piro.sakura.ne.jp'].tabsDragUtils = tabsDragUtils;
	tabsDragUtils.init();
})();
