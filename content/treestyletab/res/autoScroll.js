/*
 Tab Bar AutoScroll Library for Vertical and Horizontal Tab Bar

 Usage:
   var scrolled = window['piro.sakura.ne.jp']
                        .autoScroll
                        .processAutoScroll(mouseMoveOrDragOverEvent);

 lisence: The MIT License, Copyright (c) 2009 SHIMODA "Piro" Hiroshi
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/license.txt
 original:
   http://www.cozmixng.org/repos/piro/fx3-compatibility-lib/trunk/autoScroll.js
*/
(function() {
	const currentRevision = 1;

	if (!('piro.sakura.ne.jp' in window)) window['piro.sakura.ne.jp'] = {};

	var loadedRevision = 'autoScroll' in window['piro.sakura.ne.jp'] ?
			window['piro.sakura.ne.jp'].autoScroll.revision :
			0 ;
	if (loadedRevision && loadedRevision > currentRevision) {
		return;
	}

	var Cc = Components.classes;
	var Ci = Components.interfaces;

	window['piro.sakura.ne.jp'].autoScroll = {
		revision : currentRevision,

		processAutoScroll : function(aEvent)
		{
			var target = aEvent.originalTarget;
			var b = target.ownerDocument.evaluate(
					'ancestor-or-self::*[local-name()="tabbrowser"]',
					target,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
			if (!b) return false;

			var tabs = b.mTabContainer;
			if (tabs.getAttribute('overflow') != 'true')
				return false;

			var box        = this.getScrollBox(b);
			var boxObject  = this.getScrollBoxObject(b);
			var innerBoxObject = (box.localName == 'arrowscrollbox' ? box._scrollbox : box ).boxObject;

			var orientBox = box || tabs;
			var isVertical = (orientBox.getAttribute('orient') || window.getComputedStyle(orientBox, '').getPropertyValue('-moz-box-orient')) == 'vertical';

			var maxX = {}, maxY = {}, curX = {}, curY = {};
			boxObject.getScrolledSize(maxX, maxY);
			boxObject.getPosition(curX, curY);

			var pixels;
			if (isVertical) {
				pixels = tabs.childNodes[0].boxObject.height * 0.5;
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
				var ltr = window.getComputedStyle(tabs, null).direction == 'ltr';
				if (aEvent.screenX < boxObject.screenX + this.getUpButtonWidth(b)) {
					if (curX.value == 0) return false;
					pixels *= -1;
				}
				else if (aEvent.screenX > boxObject.screenX + boxObject.width - this.getDownButtonWidth(b)) {
					if (innerBoxObject.width + curX.value == maxX.value) return false;
					return false;
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

		getScrollBox : function(aTabBrowser) 
		{
			return document.getAnonymousElementByAttribute(aTabBrowser.mTabContainer, 'class', 'tabs-frame') || // Tab Mix Plus
					aTabBrowser.mTabContainer.mTabstrip;
		},

		getScrollBoxObject : function(aTabBrowser) 
		{
			var box = this.getScrollBox(aTabBrowser);
			return box.scrollBoxObject ||
					box.boxObject.QueryInterface(Ci.nsIScrollBoxObject); // Tab Mix Plus
		},

		getUpButton : function(aTabBrowser)
		{
			var box = this.getScrollBox(aTabBrowser);
			return box._scrollButtonUp ||
				document.getAnonymousElementByAttribute(box, 'class', 'scrollbutton-up') ||
				document.getAnonymousElementByAttribute(box.previousSibling, 'class', 'scrollbutton-up'); // Tab Mix Plus
		},
		getDownButton : function(aTabBrowser)
		{
			var box = this.getScrollBox(aTabBrowser);
			return box._scrollButtonDown ||
				document.getAnonymousElementByAttribute(box, 'class', 'scrollbutton-down') ||
				document.getAnonymousElementByAttribute(box.nextSibling, 'class', 'scrollbutton-up'); // Tab Mix Plus
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
