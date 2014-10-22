/*
 Tab Bar AutoScroll Library for Vertical and Horizontal Tab Bar

 Usage:
   var scrolled = window['piro.sakura.ne.jp']
                        .autoScroll
                        .processAutoScroll(mouseMoveOrDragOverEvent);

 license: The MIT License, Copyright (c) 2009-2014 YUKI "Piro" Hiroshi
 original:
   http://github.com/piroor/fxaddonlib-autoscroll
*/

/* To work as a JS Code Module */
if (typeof window == 'undefined' ||
	(window && typeof window.constructor == 'function')) {
	this.EXPORTED_SYMBOLS = ['autoScroll'];

	// If namespace.jsm is available, export symbols to the shared namespace.
	// See: http://github.com/piroor/fxaddonlibs/blob/master/namespace.jsm
	try {
		let ns = {};
		Components.utils.import('resource://treestyletab-modules/lib/namespace.jsm', ns);
		/* var */ window = ns.getNamespaceFor('piro.sakura.ne.jp');
	}
	catch(e) {
		window = {};
	}
}

(function() {
	const currentRevision = 7;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'autoScroll' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].autoScroll.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	const Cc = Components.classes;
	const Ci = Components.interfaces;

	window['piro.sakura.ne.jp'].autoScroll = {
		revision : currentRevision,

		processAutoScroll : function(aEvent)
		{
			var target = aEvent.originalTarget;
			var b = this.getTabBrowserFromChild(target);
			if (!b) return false;

			var tabs = b.mTabContainer;
			if (tabs.getAttribute('overflow') != 'true')
				return false;

			var view = target.ownerDocument.defaultView;

			var box        = this.getScrollBox(b);
			var boxObject  = this.getScrollBoxObject(b);
			var innerBoxObject = (box.localName == 'arrowscrollbox' ? box._scrollbox : box ).boxObject;

			var orientBox = box || tabs;
			var isMultirow = tabs.getAttribute('flowing') == 'multibar'; // Tab Mix Plus
			var isVertical = (
					isMultirow ||
					((orientBox.getAttribute('orient') || view.getComputedStyle(orientBox, '').getPropertyValue('-moz-box-orient')) == 'vertical')
				);

			var maxX = {}, maxY = {}, curX = {}, curY = {};
			boxObject.getScrolledSize(maxX, maxY);
			boxObject.getPosition(curX, curY);

			var firstTab;
			if (b.visibleTabs) {
				let pinnedTabsCount = b.ownerDocument.evaluate(
						'count(child::*[local-name()="tab" and @pinned="true"])',
						tabs,
						null,
						Ci.nsIDOMXPathResult.NUMBER_TYPE,
						null
					).numberValue;
				firstTab = b.visibleTabs[b.visibleTabs.length > pinnedTabsCount ? pinnedTabsCount : 0 ];
			}
			else {
				firstTab = tabs.childNodes[0];
			}

			var pixels;
			if (isVertical) {
				pixels = firstTab.boxObject.height * 0.5;
				if (isMultirow) pixels *= 0.5;
				if (aEvent.screenY < boxObject.screenY + this.getUpButtonHeight(b)) {
					if (curY.value == 0) return false;
					pixels *= -1;
				}
				else if (aEvent.screenY > boxObject.screenY + boxObject.height - this.getDownButtonHeight(b)) {
					if (innerBoxObject.height + curY.value == maxY.value) return false;
				}
				else {
					return false;
				}
			}
			else {
				pixels = box.scrollIncrement;
				var ltr = view.getComputedStyle(tabs, null).direction == 'ltr';
				if (aEvent.screenX < boxObject.screenX + this.getUpButtonWidth(b)) {
					if (curX.value == 0) return false;
					pixels *= -1;
				}
				else if (aEvent.screenX > boxObject.screenX + boxObject.width - this.getDownButtonWidth(b)) {
					if (innerBoxObject.width + curX.value == maxX.value) return false;
				}
				else {
					return false;
				}
				pixels = (ltr ? 1 : -1) * pixels;
			}

			if ('scrollByPixels' in box) {
				box.scrollByPixels(pixels);
			}
			else { // Tab Mix Plus?
				if (isVertical)
					boxObject.scrollBy(0, pixels);
				else
					boxObject.scrollBy(pixels, 0);
			}
			return true;
		},

		getTabBrowserFromChild : function(aTabBrowserChild) 
		{
			if (aTabBrowserChild.localName == 'tabbrowser') // itself
				return aTabBrowserChild;

			if (aTabBrowserChild.tabbrowser) // tabs, Firefox 4.0 or later
				return aTabBrowserChild.tabbrowser;

			if (aTabBrowserChild.localName == 'toolbar') // tabs toolbar, Firefox 4.0 or later
				return aTabBrowserChild.getElementsByTagName('tabs')[0].tabbrowser;

			var b = aTabBrowserChild.ownerDocument.evaluate(
					'ancestor::*[local-name()="tabbrowser"] | '+
					'ancestor::*[local-name()="tabs" and @tabbrowser] |'+
					'ancestor::*[local-name()="toolbar"]/descendant::*[local-name()="tabs"]',
					aTabBrowserChild,
					null,
					Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
			return (b && b.tabbrowser) || b;
		},

		getScrollBox : function(aTabBrowser) 
		{
			return aTabBrowser.ownerDocument.getAnonymousElementByAttribute(aTabBrowser.mTabContainer, 'class', 'tabs-frame') || // Tab Mix Plus
					aTabBrowser.mTabContainer.mTabstrip;
		},

		getScrollBoxObject : function(aTabBrowser) 
		{
			var box = this.getScrollBox(aTabBrowser);
			var boxObject = box.scrollBoxObject || box.boxObject;
			try {
				boxObject = boxObject.QueryInterface(Ci.nsIScrollBoxObject); // Tab Mix Plus
			}
			catch(e) {
				// May not implement this interface e.g. after bug 979835
			}
			return boxObject;
		},

		getUpButton : function(aTabBrowser)
		{
			var box = this.getScrollBox(aTabBrowser);
			return box._scrollButtonUp ||
				aTabBrowser.ownerDocument.getAnonymousElementByAttribute(box, 'class', 'scrollbutton-up') ||
				aTabBrowser.ownerDocument.getAnonymousElementByAttribute(box.previousSibling, 'class', 'scrollbutton-up'); // Tab Mix Plus
		},
		getDownButton : function(aTabBrowser)
		{
			var box = this.getScrollBox(aTabBrowser);
			return box._scrollButtonDown ||
				aTabBrowser.ownerDocument.getAnonymousElementByAttribute(box, 'class', 'scrollbutton-down') ||
				aTabBrowser.ownerDocument.getAnonymousElementByAttribute(box.nextSibling, 'class', 'scrollbutton-up'); // Tab Mix Plus
		},

		autoScrollArea : 20,

		getUpButtonHeight : function(aTabBrowser)
		{
			var button = this.getUpButton(aTabBrowser);
			return (button ? button.boxObject.height : 0 ) || this.autoScrollArea;
		},
		getUpButtonWidth : function(aTabBrowser)
		{
			var button = this.getUpButton(aTabBrowser);
			return (button ? button.boxObject.width : 0 ) || this.autoScrollArea;
		},

		getDownButtonHeight : function(aTabBrowser)
		{
			var button = this.getDownButton(aTabBrowser);
			return (button ? button.boxObject.height : 0 ) || this.autoScrollArea;
		},
		getDownButtonWidth : function(aTabBrowser)
		{
			var button = this.getDownButton(aTabBrowser);
			return (button ? button.boxObject.width : 0 ) || this.autoScrollArea;
		}

	};
})();

if (window != this) { // work as a JS Code Module
	this.autoScroll = window['piro.sakura.ne.jp'].autoScroll;
}
