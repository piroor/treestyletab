/*
 Multiple Tabs Drag and Drop Utilities for Firefox 3.5 or later

 Usage:
   window['piro.sakura.ne.jp'].tabsDragUtils.initTabBrowser(gBrowser);

   // in dragstart event listener
   window['piro.sakura.ne.jp'].tabsDragUtils.startTabsDrag(aEvent, aArrayOfTabs);

 This Source Code Form is subject to the terms of the Mozilla Public
 License, v. 2.0. If a copy of the MPL was not distributed with this
 file, You can obtain one at http://mozilla.org/MPL/2.0/.

 original:
   http://github.com/piroor/fxaddonlibs/blob/master/tabsDragUtils.js
*/
(function() {
	const currentRevision = 20;

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
	const TAB_DROP_TYPE = 'application/x-moz-tabbrowser-tab';

	var tabsDragUtils = {
		revision : currentRevision,

		// "nsDOM" prefix is required!
		// https://developer.mozilla.org/en/Creating_Custom_Events_That_Can_Pass_Data
		EVENT_TYPE_TABS_DROP : 'nsDOMMultipleTabsDrop',

		init : function TDU_init()
		{
			window.addEventListener('load', this, false);
		},
		_delayedInit : function TDU_delayedInit()
		{
			window.removeEventListener('load', this, false);
			delete this._delayedInit;

			if (
				'PlacesControllerDragHelper' in window &&
				'onDrop' in PlacesControllerDragHelper &&
				PlacesControllerDragHelper.onDrop.toSource().indexOf('tabsDragUtils.DOMDataTransferProxy') < 0
				) {
				eval('PlacesControllerDragHelper.onDrop = '+
					PlacesControllerDragHelper.onDrop.toSource().replace(
						// for Firefox 3.5 or later
						/(let|var) doCopy =/,
						'$1 tabsDataTransferProxy = dt = new window["piro.sakura.ne.jp"].tabsDragUtils.DOMDataTransferProxy(dt, insertionPoint); $&'
					).replace( // for Tree Style Tab (save tree structure to bookmarks)
						/(PlacesUIUtils\.ptm|PlacesUtils\.transactionManager)\.doTransaction\(txn\);/,
						<![CDATA[
							if (tabsDataTransferProxy && '_tabs' in tabsDataTransferProxy &&
								'TreeStyleTabBookmarksService' in window)
								TreeStyleTabBookmarksService.beginAddBookmarksFromTabs(tabsDataTransferProxy._tabs);
							$&
							if (tabsDataTransferProxy && '_tabs' in tabsDataTransferProxy &&
								'TreeStyleTabBookmarksService' in window)
								TreeStyleTabBookmarksService.endAddBookmarksFromTabs();
						]]>
					)
				);
			}

			if ('TMP_tabDNDObserver' in window) // for Tab Mix Plus
				this.initTabDNDObserver(TMP_tabDNDObserver);
			else if ('TabDNDObserver' in window)	// for old Tab Mix Plus
				this.initTabDNDObserver(TabDNDObserver);
		},
		destroy : function TDU_destroy()
		{
			if (this._delayedInit)
				window.removeEventListener('load', this, false);
		},

		initTabBrowser : function TDU_initTabBrowser(aTabBrowser)
		{
			var tabDNDObserver = (aTabBrowser.tabContainer && aTabBrowser.tabContainer.tabbrowser == aTabBrowser) ?
									aTabBrowser.tabContainer : // Firefox 4.0 or later
									aTabBrowser ; // Firefox 3.5 - 3.6
			this.initTabDNDObserver(tabDNDObserver);
		},
		destroyTabBrowser : function TDU_destroyTabBrowser(aTabBrowser)
		{
		},

		initTabDNDObserver : function TDU_initTabDNDObserver(aObserver)
		{
			if ('_setEffectAllowedForDataTransfer' in aObserver &&
				aObserver._setEffectAllowedForDataTransfer.toSource().indexOf('tabDragUtils') < 0) {
				eval('aObserver._setEffectAllowedForDataTransfer = '+
					aObserver._setEffectAllowedForDataTransfer.toSource().replace(
						'dt.mozItemCount > 1',
						'$& && !window["piro.sakura.ne.jp"].tabsDragUtils.isTabsDragging(arguments[0])'
					)
				);
			}

			if ('_animateTabMove' in aObserver &&
				aObserver._animateTabMove.toSource().indexOf('tabDragUtils') < 0) {
				eval('aObserver._animateTabMove = '+
					aObserver._animateTabMove.toSource().replace( // support vertical tab bar
						/\.screenX/g,
						'[position]'
					).replace( // support vertical tab bar
						/\.width/g,
						'[size]'
					).replace( // support vertical tab bar
						/(['"])translateX\(/g,
						'$1$1 + translator + $1('
					).replace( // support vertical tab bar
						/\.scrollX/g,
						'[scroll]'
					).replace(
						/(let draggedTab = [^;]+;)/,
						'$1\n' +
						'let draggedTabs = window["piro.sakura.ne.jp"].tabsDragUtils.getDraggedTabs(event);\n' +
						'draggedTab = draggedTabs[0];'
					).replace(
						'if (!("animLastScreenX" in draggedTab._dragData))',
						'let tabsWidth = 0;\n' +
						'draggedTabs.forEach(function(draggedTab) {\n' +
						'  tabsWidth += draggedTab.boxObject.width;\n' +
						'  $&'
					).replace(
						'draggedTab._dragData.animLastScreenX = draggedTab._dragData[position];',
						'  $&\n' +
						'}, this);'
					).replace(
						'let draggingRight = ',
						'draggedTabs.forEach(function(draggedTab) {\n' +
						'  $&'
					).replace(
						'draggedTab._dragData.animLastScreenX = screenX;',
						'  $&\n' +
						'}, this);'
					).replace(
						'let tabWidth = ',
						'tabs = tabs.filter(function(tab) { return draggedTabs.indexOf(tab) < 0 });\n' +
						'$&'
					).replace(
						'let tabCenter = ',
						'draggedTabs.slice(1).forEach(function(tab) {\n' +
						'  tab.style.transform = draggedTab.style.transform;\n' +
						'}, this);\n' +
						'$&'
					).replace(
						/(let tabCenter = [^;]+)\/ 2;/,
						'$1 / units/*2*/;\n' + // support drop on self
						'let firstTabCenter = tabCenter;\n' +
						'let lastTabCenter = tabScreenX + translateX + tabsWidth - tabWidth / units;'
					).replace(
						'tabs[mid] == draggedTab',
						'/* $& */ false'
					).replace(
						'(screenX > tabCenter)',
						'/* $& */ (screenX > lastTabCenter + (aAcceptDropOnSelf ? tabWidth / units : 0 ))'
					).replace(
						'(screenX + boxObject[size] < tabCenter)',
						'/* $& */ (screenX + boxObject[size] < firstTabCenter)'
					).replace(
						'-tabWidth : tabWidth',
						'/* $& */ -tabsWidth : tabsWidth'
					).replace(
						'tabWidth : -tabWidth',
						'/* $& */ tabsWidth : -tabsWidth'
					).replace( // add a new argument
						')',
						', aAcceptDropOnSelf)'
					).replace( // insert initialization processes
						'{',
						'{\n' +
						'  var isVertical = window["piro.sakura.ne.jp"].tabsDragUtils.isVertical(this);\n' +
						'  var position = isVertical ? "screenY" : "screenX" ;\n' +
						'  var size = isVertical ? "height" : "width" ;\n' +
						'  var scroll = isVertical ? "scrollY" : "scrollX" ;\n' +
						'  var translator = isVertical ? "translateY" : "translateX" ;\n' +
						'  aAcceptDropOnSelf = aAcceptDropOnSelf || ("TreeStyleTabService" in window);\n' +
						'  var units = aAcceptDropOnSelf ? 3 : 2 ;'
					)
				);

/**
 * Full version
 *  base version: Firefox 17 beta
 *  revision    : http://hg.mozilla.org/releases/mozilla-beta/rev/20e73f5b19c3
 *  date        : 2012-10-09
 *  source      : http://mxr.mozilla.org/mozilla-central/source/browser/base/content/tabbrowser.xml
 */
// function _animateTabMove(event, aAcceptDropOnSelf) {
// var isVertical = window['piro.sakura.ne.jp'].tabsDragUtils.isVertical(this);
// var position = isVertical ? 'screenY' : 'screenX' ;
// var size = isVertical ? 'height' : 'width' ;
// var translator = isVertical ? "translateY" : "translateX" ;
// aAcceptDropOnSelf = aAcceptDropOnSelf || ("TreeStyleTabService" in window);
// var units = aAcceptDropOnSelf ? 3 : 2 ;
// 
//           let draggedTab = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
// var draggedTabs = window['piro.sakura.ne.jp'].tabsDragUtils.getDraggedTabs(event);
// draggedTab = draggedTabs[0];
// 
//           if (this.getAttribute("movingtab") != "true") {
//             this.setAttribute("movingtab", "true");
//             this.selectedItem = draggedTab;
//           }
// 
// let tabsWidth = 0;
// draggedTabs.forEach(function(draggedTab) {
// tabsWidth += draggedTab.boxObject[size]/*.width*/;
//           if (!("animLastScreenX" in draggedTab._dragData))
//             draggedTab._dragData.animLastScreenX = draggedTab._dragData[position]/*.screenX*/;
// }, this);
// 
//           let screenX = event[position]/*.screenX*/;
//           if (screenX == draggedTab._dragData.animLastScreenX)
//             return;
// 
// draggedTabs.forEach(function(draggedTab) {
//           let draggingRight = screenX > draggedTab._dragData.animLastScreenX;
//           draggedTab._dragData.animLastScreenX = screenX;
// }, this);
// 
//           let rtl = (window.getComputedStyle(this).direction == "rtl");
//           let pinned = draggedTab.pinned;
//           let numPinned = this.tabbrowser._numPinnedTabs;
//           let tabs = this.tabbrowser.visibleTabs
//                                     .slice(pinned ? 0 : numPinned,
//                                            pinned ? numPinned : undefined);
//           if (rtl)
//             tabs.reverse();
// tabs = tabs.filter(function(tab) { return draggedTabs.indexOf(tab) < 0 });
//           let tabWidth = draggedTab.getBoundingClientRect()[size]/*.width*/;
// 
//           // Move the dragged tab based on the mouse position.
// 
//           let leftTab = tabs[0];
//           let rightTab = tabs[tabs.length - 1];
// 
//           let tabScreenX = draggedTab.boxObject[position]/*.screenX*/;
//           let translateX = screenX - draggedTab._dragData[position]/*.screenX*/;
//           if (!pinned)
//             translateX += this.mTabstrip.scrollPosition - draggedTab._dragData[scroll]/*.scrollX*/;
//           let leftBound = leftTab.boxObject[position]/*.screenX*/ - tabScreenX;
//           let rightBound = (rightTab.boxObject[position]/*.screenX*/ + rightTab.boxObject[size]/*.width*/) -
//                            (tabScreenX + tabWidth);
//           translateX = Math.max(translateX, leftBound);
//           translateX = Math.min(translateX, rightBound);
//           draggedTab.style.transform = "translateX(" + translateX + "px)";
// 
//           // Determine what tab we're dragging over.
//           // * Point of reference is the center of the dragged tab. If that
//           //   point touches a background tab, the dragged tab would take that
//           //   tab's position when dropped.
//           // * We're doing a binary search in order to reduce the amount of
//           //   tabs we need to check.
// 
// draggedTabs.slice(1).forEach(function(tab) {
//   tab.style.transform = draggedTab.style.transform;
// }, this);
//           let tabCenter = tabScreenX + translateX + tabWidth / units/*2*/;
// let firstTabCenter = tabCenter;
// let lastTabCenter = tabScreenX + translateX + tabsWidth - tabWidth / units;
//           let newIndex = -1;
//           let oldIndex = "animDropIndex" in draggedTab._dragData ?
//                          draggedTab._dragData.animDropIndex : draggedTab._tPos;
//           let low = 0;
//           let high = tabs.length - 1;
//           while (low <= high) {
//             let mid = Math.floor((low + high) / 2);
// //            if (tabs[mid] == draggedTab &&
//               if (false &&
//                 ++mid > high)
//               break;
//             let boxObject = tabs[mid].boxObject;
//             let screenX = boxObject[position]/*.screenX*/ + getTabShift(tabs[mid], oldIndex);
// //            if (screenX > tabCenter) {
//             if (screenX > lastTabCenter + (aAcceptDropOnSelf ? tabWidth / units : 0 )) {
//               high = mid - 1;
// //            } else if (screenX + boxObject.width < tabCenter) {
//             } else if (screenX + boxObject[size]/*.width*/ < firstTabCenter) {
//               low = mid + 1;
//             } else {
//               newIndex = tabs[mid]._tPos;
//               break;
//             }
//           }
//           if (newIndex >= oldIndex)
//             newIndex++;
//           if (newIndex < 0 || newIndex == oldIndex)
//             return;
//           draggedTab._dragData.animDropIndex = newIndex;
// 
//           // Shift background tabs to leave a gap where the dragged tab
//           // would currently be dropped.
// 
//           for (let tab of tabs) {
//             if (tab != draggedTab) {
//               let shift = getTabShift(tab, newIndex);
//               tab.style.transform = shift ? "" + translator + "(" + shift + "px)" : "";
//             }
//           }
// 
//           function getTabShift(tab, dropIndex) {
//             if (tab._tPos < draggedTab._tPos && tab._tPos >= dropIndex)
// //              return rtl ? -tabWidth : tabWidth;
//               return rtl ? -tabsWidth : tabsWidth;
//             if (tab._tPos > draggedTab._tPos && tab._tPos < dropIndex)
// //              return rtl ? tabWidth : -tabWidth;
//               return rtl ? tabsWidth : -tabsWidth;
//             return 0;
//           }
//         
// }
			}
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

			// On Firefox 3.6 or older versions on Windows, drag feedback
			// image isn't shown if there are multiple drag data...
			if (tabs.length <= 1 ||
				'mozSourceNode' in dt ||
				navigator.platform.toLowerCase().indexOf('win') < 0)
				dt.mozCursor = 'default';

			if (this.shouldAnimateDragggedTabs(aEvent)) {
				let tabbar = this.getTabbarFromEvent(aEvent);
				let tabbarOffsetX = this.getClientX(tabbar.children[0].pinned ? tabbar.children[0] : tabbar );
				let tabbarOffsetY = this.getClientY(tabbar.children[0].pinned ? tabbar.children[0] : tabbar );
				let isVertical = this.isVertical(tabbar.mTabstrip);
				tabs.forEach(function(aTab) {
					var tabOffsetX = this.getClientX(aTab) - tabbarOffsetX;
					var tabOffsetY = this.getClientY(aTab) - tabbarOffsetY;
					aTab._dragData = {
						offsetX: aEvent.screenX - window.screenX - tabOffsetX,
						offsetY: aEvent.screenY - window.screenY - tabOffsetY,
						scrollX: isVertical ? 0 : tabbar.mTabstrip.scrollPosition ,
						scrollY: isVertical ? tabbar.mTabstrip.scrollPosition : 0 ,
						screenX: aEvent.screenX,
						screenY: aEvent.screenY
					};
				}, this);
			}

			aEvent.stopPropagation();
		},
		isVertical : function TDS_isVertical(aElement)
		{
			let style = window.getComputedStyle(aElement, null);
			return (style.MozOrient || style.orient) == 'vertical';
		},
		getClientX : function TDS_getClientX(aElement)
		{
			return aElement.getBoundingClientRect().left;
		},
		getClientY : function TDS_getClientY(aElement)
		{
			return aElement.getBoundingClientRect().top;
		},
		createDragFeedbackImage : function TDU_createDragFeedbackImage(aTabs)
		{
			var previews = aTabs.map(function(aTab) {
					try {
						return tabPreviews.capture(aTab, false);
					}
					catch(e) {
						return null;
					}
				}, this)
				.filter(function(aPreview) {
					return aPreview;
				});
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
		getTabbarFromEvent : function TDU_getTabbarFromEvent(aEvent) 
		{
			return (aEvent.originalTarget || aEvent.target).ownerDocument.evaluate(
					'ancestor-or-self::*[local-name()="tabs"]',
					aEvent.originalTarget || aEvent.target,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
		},
		getTabBrowserFromChild : function TDU_getTabBrowserFromChild(aTabBrowserChild) 
		{
			if (!aTabBrowserChild)
				return null;

			if (aTabBrowserChild.localName == 'tabbrowser') // itself
				return aTabBrowserChild;

			if (aTabBrowserChild.tabbrowser) // tabs, Firefox 4.0 or later
				return aTabBrowserChild.tabbrowser;

			if (aTabBrowserChild.localName == 'toolbar') // tabs toolbar, Firefox 4.0 or later
				return aTabBrowserChild.getElementsByTagName('tabs')[0].tabbrowser;

			var b = aTabBrowserChild.ownerDocument.evaluate(
					'ancestor-or-self::*[local-name()="tabbrowser"] | '+
					'ancestor-or-self::*[local-name()="tabs" and @tabbrowser] |'+
					'ancestor::*[local-name()="toolbar"]/descendant::*[local-name()="tabs" and @tabbrowser]',
					aTabBrowserChild,
					null,
					XPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
			return (b && b.tabbrowser) || b;
		},
		shouldAnimateDragggedTabs: function TDU_shouldAnimateDragggedTabs(aEvent)
		{
			var tabbar = this.getTabbarFromEvent(aEvent);
			return tabbar && '_animateTabMove' in tabbar;
		},

		processTabsDragging: function TDU_processTabsDragging(aEvent, aWillDropOnSelf)
		{
			// Firefox 17 and later
			if (this.shouldAnimateDraggedTabs(aEvent)) {
				let tabbar = this.getTabbarFromEvent(aEvent);
				let draggedTab = aEvent.dataTransfer && aEvent.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
				if (!draggedTab || draggedTab.ownerDocument != tabbar.ownerDocument) return false;

				if (!tabbar.hasAttribute('movingtab'))
					tabbar.setAttribute('movingtab', 'true');
				if (!aWillDropOnSelf) {
					tabbar._animateTabMove(aEvent);
				}
				return true;
			}
			return false;
		},

		isTabsDragging : function TDU_isTabsDragging(aEvent) 
		{
			if (!aEvent)
				return false;
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

		getSelectedTabs : function TDU_getSelectedTabs(aEventOrTabOrTabBrowser)
		{
			var event = aEventOrTabOrTabBrowser instanceof Components.interfaces.nsIDOMEvent ? aEventOrTabOrTabBrowser : null ;
			var b = this.getTabBrowserFromChild(event ? event.target : aEventOrTabOrTabBrowser );
			if (!b)
				return [];

			var w = b.ownerDocument.defaultView;
			var tab = (aEventOrTabOrTabBrowser instanceof Components.interfaces.nsIDOMElement &&
						aEventOrTabOrTabBrowser.localName == 'tab') ?
						aEventOrTabOrTabBrowser :
						(event && this.getTabFromEvent(event)) ;

			var selectedTabs;
			var isMultipleDrag = (
					( // Firefox 4.x (https://bugzilla.mozilla.org/show_bug.cgi?id=566510)
						'visibleTabs' in b &&
						(selectedTabs = b.visibleTabs.filter(function(aTab) {
							return aTab.getAttribute('multiselected') == 'true';
						})) &&
						selectedTabs.length
					) ||
					( // Tab Utilities
						'selectedTabs' in b &&
						(selectedTabs = b.selectedTabs) &&
						selectedTabs.length
					) ||
					( // Multiple Tab Handler
						tab &&
						'MultipleTabService' in w &&
						w.MultipleTabService.isSelected(tab) &&
						w.MultipleTabService.allowMoveMultipleTabs &&
						(selectedTabs = w.MultipleTabService.getSelectedTabs(b)) &&
						selectedTabs.length
					) ||
					( // based on HTML5 drag events
						this.isTabsDragging(event) &&
						(selectedTabs = this.getDraggedTabs(event)) &&
						selectedTabs.length
					)
				);
			return isMultipleDrag ? selectedTabs :
					tab ? [tab] :
					[] ;
		},

		getDraggedTabs : function TDU_getDraggedTabs(aEventOrDataTransfer)
		{
			var dt = aEventOrDataTransfer.dataTransfer || aEventOrDataTransfer;
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
			if (aTab.linkedBrowser.__SS_restoreState == 1) {
				let data = aTab.linkedBrowser.__SS_data;
				let entry = data.entries[Math.min(data.index, data.entries.length-1)];
				return entry.url;
			}
			return aTab.linkedBrowser.currentURI.spec;
		},

		// for drop on bookmarks tree
		willBeInsertedBeforeExistingNode : function TDU_willBeInsertedBeforeExistingNode(aInsertionPoint) 
		{
			// drop on folder in the bookmarks menu
			if (aInsertionPoint.dropNearItemId === void(0))
				return false;

			// drop on folder in the places organizer
			if (aInsertionPoint._index < 0 && aInsertionPoint.dropNearItemId < 0)
				return false;

			return true;
		},

		handleEvent : function TDU_handleEvent(aEvent) 
		{
			switch (aEvent.type)
			{
				case 'load':
					return this._delayedInit();
			}
		},

		_fireTabsDropEvent : function TDU_fireTabsDropEvent(aTabs) 
		{
			var event = document.createEvent('DataContainerEvents');
			event.initEvent(this.EVENT_TYPE_TABS_DROP, true, true);
			event.setData('tabs', aTabs);
			// for backward compatibility
			event.tabs = aTabs;
			return this._dropTarget.dispatchEvent(event);
		},
		get _dropTarget()
		{
			return ('PlacesControllerDragHelper' in window ?
						PlacesControllerDragHelper.currentDropTarge :
						null ) || document;
		}
	};


	function DOMDataTransferProxy(aDataTransfer, aInsertionPoint) 
	{
		// Don't proxy it because it is not a drag of tabs.
		if (!aDataTransfer.mozTypesAt(0).contains(TAB_DROP_TYPE))
			return aDataTransfer;

		var tabs = tabsDragUtils.getDraggedTabs(aDataTransfer);

		// Don't proxy it because there is no selection.
		if (tabs.length < 2)
			return aDataTransfer;

		this._source = aDataTransfer;
		this._tabs = tabs;

		if (!tabsDragUtils._fireTabsDropEvent(tabs))
			this._tabs = [tabs[0]];

		if (tabsDragUtils.willBeInsertedBeforeExistingNode(aInsertionPoint))
			this._tabs.reverse();
	}

	DOMDataTransferProxy.prototype = {
		
		_apply : function DOMDTProxy__apply(aMethod, aArguments) 
		{
			return this._source[aMethod].apply(this._source, aArguments);
		},
	 
		// nsIDOMDataTransfer 
		get dropEffect() { return this._source.dropEffect; },
		set dropEffect(aValue) { return this._source.dropEffect = aValue; },
		get effectAllowed() { return this._source.effectAllowed; },
		set effectAllowed(aValue) { return this._source.effectAllowed = aValue; },
		get files() { return this._source.files; },
		get types() { return this._source.types; },
		clearData : function DOMDTProxy_clearData() { return this._apply('clearData', arguments); },
		setData : function DOMDTProxy_setData() { return this._apply('setData', arguments); },
		getData : function DOMDTProxy_getData() { return this._apply('getData', arguments); },
		setDragImage : function DOMDTProxy_setDragImage() { return this._apply('setDragImage', arguments); },
		addElement : function DOMDTProxy_addElement() { return this._apply('addElement', arguments); },
	 
		// nsIDOMNSDataTransfer 
		get mozItemCount()
		{
			return this._tabs.length;
		},

		get mozCursor() { return this._source.mozCursor; },
		set mozCursor(aValue) { return this._source.mozCursor = aValue; },

		mozTypesAt : function DOMDTProxy_mozTypesAt(aIndex)
		{
			if (aIndex >= this._tabs.length)
				return new StringList([]);

			// return this._apply('mozTypesAt', [0]);
			// I return "text/x-moz-url" as a first type, to override behavior for "to-be-restored" tabs.
			return new StringList(['text/x-moz-url', TAB_DROP_TYPE, 'text/x-moz-text-internal']);
		},

		mozClearDataAt : function DOMDTProxy_mozClearDataAt()
		{
			this._tabs = [];
			return this._apply('mozClearDataAt', [0]);
		},

		mozSetDataAt : function DOMDTProxy_mozSetDataAt(aFormat, aData, aIndex)
		{
			this._tabs = [];
			return this._apply('mozSetDataAt', [aFormat, aData, 0]);
		},

		mozGetDataAt : function DOMDTProxy_mozGetDataAt(aFormat, aIndex)
		{
			if (aIndex >= this._tabs.length)
				return null;

			var tab = this._tabs[aIndex];
			switch (aFormat)
			{
				case TAB_DROP_TYPE:
					return tab;

				case 'text/x-moz-url':
					return (tabsDragUtils.getCurrentURIOfTab(tab) ||
							'about:blank') + '\n' + tab.label;

				case 'text/x-moz-text-internal':
					return tabsDragUtils.getCurrentURIOfTab(tab) ||
							'about:blank';
			}

			return this._apply('mozGetDataAt', [aFormat, 0]);
		},

		get mozUserCancelled() { return this._source.mozUserCancelled; }
	};

	function StringList(aTypes) 
	{
		return {
			__proto__ : aTypes,
			item : function(aIndex)
			{
				return this[aIndex];
			},
			contains : function(aType)
			{
				return this.indexOf(aType) > -1;
			}
		};
	}

	tabsDragUtils.DOMDataTransferProxy = DOMDataTransferProxy;
	tabsDragUtils.StringList = StringList;

	window['piro.sakura.ne.jp'].tabsDragUtils = tabsDragUtils;
	tabsDragUtils.init();
})();
