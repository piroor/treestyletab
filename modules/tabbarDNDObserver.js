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
 * Portions created by the Initial Developer are Copyright (C) 2010-2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro.outsider.reflex@gmail.com>
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
 
const EXPORTED_SYMBOLS = ['TabbarDNDObserver']; 

const DEBUG = false;

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://gre/modules/Services.jsm');

const TAB_DROP_TYPE = 'application/x-moz-tabbrowser-tab';

const SSS = Cc['@mozilla.org/content/style-sheet-service;1']
				.getService(Ci.nsIStyleSheetService);
const SecMan = Cc['@mozilla.org/scriptsecuritymanager;1']
				.getService(Ci.nsIScriptSecurityManager);

function TabbarDNDObserver(aTabBrowser) 
{
	this.init(aTabBrowser);
}

TabbarDNDObserver.prototype = {
	
	readyToStartTabbarDrag : function TabbarDND_readyToStartTabbarDrag() 
	{
		var sheet = this.treeStyleTab.makeURIFromSpec('chrome://treestyletab/content/hide-embed.css');
		if (!SSS.sheetRegistered(sheet, SSS.AGENT_SHEET))
			SSS.loadAndRegisterSheet(sheet, SSS.AGENT_SHEET);
	},
 
	readyToEndTabbarDrag : function TabbarDND_readyToEndTabbarDrag() 
	{
		var sheet = this.treeStyleTab.makeURIFromSpec('chrome://treestyletab/content/hide-embed.css');
		if (SSS.sheetRegistered(sheet, SSS.AGENT_SHEET))
			SSS.unregisterSheet(sheet, SSS.AGENT_SHEET);
	},
 
	canDragTabbar : function TabbarDND_canDragTabbar(aEvent) 
	{
		var sv = this.treeStyleTab;

		if (
			sv.evaluateXPath(
				'ancestor-or-self::*[contains(" scrollbar popup menupopup panel tooltip ", concat(" ", local-name(), " "))]',
				aEvent.originalTarget,
				Ci.nsIDOMXPathResult.BOOLEAN_TYPE
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
					sv.browser.getAttribute(sv.kFIXED) != 'true'
				)
			);

		if (canDrag && !aEvent.shiftKey) {
			let insensitiveArea = sv.getTreePref('tabbar.fixed.insensitiveArea');
			let box = tabbar.boxObject;
			switch (sv.position)
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
 
	canDrop : function TabbarDND_canDrop(aEvent) 
	{
		var sv = this.treeStyleTab;
		var tooltip = sv.tabStrip.firstChild;
		if (tooltip &&
			tooltip.localName == 'tooltip' &&
			tooltip.popupBoxObject.popupState != 'closed')
			tooltip.hidePopup();

		var dropAction = this.getDropAction(aEvent);
		if ('dataTransfer' in aEvent) {
			var dt = aEvent.dataTransfer;
			if (dropAction.action & sv.kACTION_NEWTAB) {
				dt.effectAllowed = dt.dropEffect = (
					!dropAction.source ? 'link' :
					sv.isCopyAction(aEvent) ? 'copy' :
					'move'
				);
			}
		}
		return dropAction.canDrop;
	},
	
	canDropTab : function TabbarDND_canDropTab(aEvent) 
	{
try{
		var sv = this.treeStyleTab;
		var b  = this.browser;

		var session = sv.currentDragSession;
		var node = session.sourceNode;
		var tab = sv.getTabFromChild(node);
		if (!node ||
			!tab ||
			tab.parentNode != b.mTabContainer)
			return true;

		tab = sv.getTabFromEvent(aEvent) || sv.getTabFromTabbarEvent(aEvent);
		if (sv.isCollapsed(tab))
			return false;

		var info = this.getDropAction(aEvent, session);
		return info.canDrop;
}
catch(e) {
		dump('TabbarDND::canDrop\n'+e+'\n');
		return false;
}
	},
  
	getDropAction : function TabbarDND_getDropAction(aEvent, aDragSession) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;

		if (!aDragSession)
			aDragSession = sv.currentDragSession;

		var tab = aDragSession ? sv.getTabFromChild(aDragSession.sourceNode) : null ;
		sv.ensureTabInitialized(tab);

		var info = this.getDropActionInternal(aEvent, tab);
		info.canDrop = true;
		info.source = tab;
		if (tab) {
			var isCopy = sv.isCopyAction(aEvent);
			if (isCopy && 'duplicateTab' in b) {
				info.action |= sv.kACTION_DUPLICATE;
			}
			if (
				!isCopy &&
				sv.getTabBrowserFromChild(tab) != b &&
				(
					('duplicateTab' in b)
				)
				) {
				info.action |= sv.kACTION_IMPORT;
			}

			if (info.action & sv.kACTIONS_FOR_DESTINATION) {
				if (info.action & sv.kACTION_MOVE) info.action ^= sv.kACTION_MOVE;
				if (info.action & sv.kACTION_STAY) info.action ^= sv.kACTION_STAY;
			}

			if (info.action & sv.kACTION_ATTACH) {
				if (info.parent == tab) {
					info.canDrop = false;
				}
				else {
					var orig = tab;
					tab  = info.target;
					while (tab = sv.getParentTab(tab))
					{
						if (tab != orig) continue;
						info.canDrop = false;
						break;
					}
				}
			}
		}

		var isInverted = sv.isVertical ? false : b.ownerDocument.defaultView.getComputedStyle(b.parentNode, null).direction == 'rtl';
		if (
			info.target &&
			(
				info.target.hidden ||
				(
					sv.isCollapsed(info.target) &&
					info.position != (isInverted ? sv.kDROP_BEFORE : sv.kDROP_AFTER )
				)
			)
			)
			info.canDrop = false;

		return info;
	},
	
	getDropActionInternal : function TabbarDND_getDropActionInternal(aEvent, aSourceTab) 
	{
		if (DEBUG) dump('getDropActionInternal: start\n');
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var d  = this.document;

		var tab        = sv.getTabFromEvent(aEvent) || sv.getTabFromTabbarEvent(aEvent) || aEvent.target;
		var tabs       = sv.getTabs(b);
		var firstTab   = sv.getFirstNormalTab(b) || tabs[0];
		var lastTabIndex = tabs.length - 1;
		var isInverted = sv.isVertical ? false : b.ownerDocument.defaultView.getComputedStyle(b.parentNode, null).direction == 'rtl';
		var info       = {
				target       : null,
				position     : null,
				action       : null,
				parent       : null,
				insertBefore : null,
				event        : aEvent
			};

		/**
		 * Even if a dragover tab is moved by CSS "transform",
		 * the event is fired based on its original position.
		 * Following tabs can be transformed, and we'll see far
		 * tab (visually it is far but logically it is below the
		 * pointer!) as the drop target.
		 * "animDropIndex" is calculated based on their visual
		 * positions, and we can use it to calculate the drop target
		 * which is visually below the pointer.
		 */
		let draggedTab = aEvent.dataTransfer && aEvent.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
		if (draggedTab && draggedTab._dragData && 'animDropIndex' in draggedTab._dragData) {
			let newIndex = draggedTab._dragData.animDropIndex;
			/**
			 * Preceding tabs won't be transformed. We have to
			 * handle only following tabs.
			 */
			if (newIndex > draggedTab._tPos) {
				newIndex--;
				let tabs = sv.getAllTabs(b);
				if (newIndex < tabs.length)
					tab = tabs[newIndex];
			}
		}

		var isTabMoveFromOtherWindow = aSourceTab && aSourceTab.ownerDocument != d;
		var isNewTabAction = !aSourceTab || aSourceTab.ownerDocument != d;

		if (tab.localName != 'tab') {
			if (DEBUG) dump('  not on a tab\n');
			let action = isTabMoveFromOtherWindow ? sv.kACTION_STAY : (sv.kACTION_MOVE | sv.kACTION_PART) ;
			if (isNewTabAction) action |= sv.kACTION_NEWTAB;
			if (aEvent[sv.screenPositionProp] < sv.getTabActualScreenPosition(firstTab)) {
				if (DEBUG) dump('  above the first tab\n');
				info.target   = info.parent = info.insertBefore = firstTab;
				info.position = isInverted ? sv.kDROP_AFTER : sv.kDROP_BEFORE ;
				info.action   = action;
				return info;
			}
			else if (aEvent[sv.screenPositionProp] > sv.getTabActualScreenPosition(tabs[lastTabIndex]) + tabs[lastTabIndex].boxObject[sv.sizeProp]) {
				if (DEBUG) dump('  below the last tab\n');
				info.target   = info.parent = tabs[lastTabIndex];
				info.position = isInverted ? sv.kDROP_BEFORE : sv.kDROP_AFTER ;
				info.action   = action;
				return info;
			}
			else {
				let index = b.getNewIndex ?
								b.getNewIndex(aEvent) :
								b.tabContainer._getDropIndex(aEvent) ;
				if (DEBUG) dump('  on the tab '+index+'\n');
				info.target = tabs[Math.min(index, lastTabIndex)];
				if (DEBUG) dump('  info.target = '+info.target._tPos+'\n');
			}
		}
		else {
			if (DEBUG) dump('  on the tab '+tab._tPos+'\n');
			sv.ensureTabInitialized(tab);
			info.target = tab;
		}

		/**
		 * Basically, tabs should have three areas for dropping of items:
		 * [start][center][end], but, pinned tabs couldn't have its tree.
		 * So, if a tab is dragged and the target tab is pinned, then, we
		 * have to ignore the [center] area.
		 */
		var pinned = tab.getAttribute('pinned') == 'true';
		var dropAreasCount = (aSourceTab && pinned) ? 2 : 3 ;
		var screenPositionProp = sv.isVertical && pinned ? sv.invertedScreenPositionProp : sv.screenPositionProp ;
		var sizeProp = sv.isVertical && pinned ? sv.invertedSizeProp : sv.sizeProp ;
		var boxPos  = sv.getTabActualScreenPosition(tab);
		var boxUnit = Math.round(tab.boxObject[sizeProp] / dropAreasCount);
		var eventPosition = aEvent[screenPositionProp];
//		if (this.window['piro.sakura.ne.jp'].tabsDragUtils
//				.canAnimateDraggedTabs(aEvent)) {
//			eventPosition = Math.round(sv.getTabActualScreenPosition(draggedTab) + (tab.boxObject[sizeProp] / 2))
//		}
		if (eventPosition < boxPos + boxUnit) {
			info.position = isInverted ? sv.kDROP_AFTER : sv.kDROP_BEFORE ;
		}
		else if (dropAreasCount == 2 || eventPosition > boxPos + boxUnit + boxUnit) {
			info.position = isInverted ? sv.kDROP_BEFORE : sv.kDROP_AFTER ;
		}
		else {
			info.position = sv.kDROP_ON;
		}

		switch (info.position)
		{
			case sv.kDROP_ON:
				if (DEBUG) dump('  position = on the tab\n');
				var visible = sv.getNextVisibleTab(tab);
				info.action       = sv.kACTION_STAY | sv.kACTION_ATTACH;
				info.parent       = tab;
				info.insertBefore = sv.getTreePref('insertNewChildAt') == sv.kINSERT_FISRT ?
						(sv.getFirstChildTab(tab) || visible) :
						(sv.getNextSiblingTab(tab) || sv.getNextTab(sv.getLastDescendantTab(tab) || tab));
				if (DEBUG && info.insertBefore) dump('  insertBefore = '+info.insertBefore._tPos+'\n');
				break;

			case sv.kDROP_BEFORE:
				if (DEBUG) dump('  position = before the tab\n');
/*
	[TARGET  ] ↑detach from parent, and move

	  [      ]
	[TARGET  ] ↑attach to the parent of the target, and move

	[        ]
	[TARGET  ] ↑attach to the parent of the target, and move

	[        ]
	  [TARGET] ↑attach to the parent of the target (previous tab), and move
*/
				var prevTab = sv.getPreviousVisibleTab(tab);
				if (!prevTab) {
					// allow to drop pinned tab to beside of another pinned tab
					if (aSourceTab && aSourceTab.getAttribute('pinned') == 'true') {
						info.action       = sv.kACTION_MOVE;
						info.insertBefore = tab;
					}
					else {
						info.action       = sv.kACTION_MOVE | sv.kACTION_PART;
						info.insertBefore = firstTab;
					}
				}
				else {
					var prevLevel   = Number(prevTab.getAttribute(sv.kNEST));
					var targetNest = Number(tab.getAttribute(sv.kNEST));
					info.parent       = (prevLevel < targetNest) ? prevTab : sv.getParentTab(tab) ;
					info.action       = sv.kACTION_MOVE | (info.parent ? sv.kACTION_ATTACH : sv.kACTION_PART );
					info.insertBefore = tab;
				}
				if (DEBUG && info.insertBefore) dump('  insertBefore = '+info.insertBefore._tPos+'\n');
				break;

			case sv.kDROP_AFTER:
				if (DEBUG) dump('  position = after the tab\n');
/*
	[TARGET  ] ↓if the target has a parent, attach to it and and move

	  [TARGET] ↓attach to the parent of the target, and move
	[        ]

	[TARGET  ] ↓attach to the parent of the target, and move
	[        ]

	[TARGET  ] ↓attach to the target, and move
	  [      ]
*/
				var nextTab = sv.getNextVisibleTab(tab);
				if (!nextTab) {
					info.action = sv.kACTION_MOVE | sv.kACTION_ATTACH;
					info.parent = sv.getParentTab(tab);
				}
				else {
					var targetNest = Number(tab.getAttribute(sv.kNEST));
					var nextLevel   = Number(nextTab.getAttribute(sv.kNEST));
					info.parent       = (targetNest < nextLevel) ? tab : sv.getParentTab(tab) ;
					info.action       = sv.kACTION_MOVE | (info.parent ? sv.kACTION_ATTACH : sv.kACTION_PART );
					info.insertBefore = nextTab;
/*
	[TARGET   ] ↓attach dragged tab to the parent of the target as its next sibling
	  [DRAGGED]
*/
					if (aSourceTab == nextTab) {
						info.action = sv.kACTION_MOVE | sv.kACTION_ATTACH;
						info.parent = sv.getParentTab(tab);
						info.insertBefore = sv.getNextSiblingTab(tab) || sv.getNextTab(nextTab);
					}
				}
				if (DEBUG && info.insertBefore) dump('  insertBefore = '+info.insertBefore._tPos+'\n');
				break;
		}

		if (isNewTabAction) info.action |= sv.kACTION_NEWTAB;

		return info;
	},
  
	performDrop : function TabbarDND_performDrop(aInfo, aDraggedTab) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		var tabsInfo = this.getDraggedTabsInfoFromOneTab(aInfo, aDraggedTab);
		if (!tabsInfo.draggedTab) return false;

		var sourceWindow = aDraggedTab.ownerDocument.defaultView;
		var sourceBrowser = sourceWindow.TreeStyleTabService.getTabBrowserFromChild(aDraggedTab);
		var sourceService = sourceBrowser.treeStyleTab;

		aDraggedTab = tabsInfo.draggedTab;
		var draggedTabs = tabsInfo.draggedTabs;
		var draggedRoots = sourceService.collectRootTabs(tabsInfo.draggedTabs);


		var targetBrowser = b;
		var tabs = sv.getTabs(targetBrowser);

		var draggedWholeTree = [].concat(draggedRoots);
		for (let i = 0, maxi = draggedRoots.length; i < maxi; i++)
		{
			let root = draggedRoots[i];
			let tabs = sourceService.getDescendantTabs(root);
			for (let i = 0, maxi = tabs.length; i < maxi; i++)
			{
				let tab = tabs[i];
				if (draggedWholeTree.indexOf(tab) < 0)
					draggedWholeTree.push(tab);
			}
		}

		var selectedTabs = draggedTabs.filter(function(aTab) {
				return aTab.getAttribute('multiselected') == 'true';
			});
		if (draggedWholeTree.length != selectedTabs.length &&
			selectedTabs.length) {
			draggedTabs = draggedRoots = selectedTabs;
			if (aInfo.action & sv.kACTIONS_FOR_SOURCE)
				sourceService.detachTabs(selectedTabs);
		}

		while (aInfo.insertBefore && draggedWholeTree.indexOf(aInfo.insertBefore) > -1)
		{
			aInfo.insertBefore = sv.getNextTab(aInfo.insertBefore);
		}

		if (aInfo.action & sv.kACTIONS_FOR_SOURCE) {
			if (aInfo.action & sv.kACTION_PART) {
				this.detachTabsOnDrop(draggedRoots);
			}
			else if (aInfo.action & sv.kACTION_ATTACH) {
				this.attachTabsOnDrop(draggedRoots, aInfo.parent);
			}
			else {
				return false;
			}

			if ( // if this move will cause no change...
				sourceBrowser == targetBrowser &&
				sourceService.getNextVisibleTab(draggedTabs[draggedTabs.length-1]) == aInfo.insertBefore
				) {
				// then, do nothing
				return true;
			}
		}

		var treeStructure = sourceService.getTreeStructureFromTabs(draggedTabs);

		var newTabs = sv.moveTabsInternal(draggedTabs, {
				duplicate    : aInfo.action & sv.kACTION_DUPLICATE,
				insertBefore : aInfo.insertBefore
			});

		if (newTabs.length && aInfo.action & sv.kACTION_ATTACH)
			this.attachTabsOnDrop(
				newTabs.filter(function(aTab, aIndex) {
					return treeStructure[aIndex] == -1;
				}),
				aInfo.parent
			);

		return true;
	},
	
	getDraggedTabsInfoFromOneTab : function TabbarDND_getDraggedTabsInfoFromOneTab(aInfo, aTab) 
	{
		if (aInfo.draggedTabsInfo)
			return aInfo.draggedTabsInfo;

		var sv = this.treeStyleTab;
		var sourceWindow = aTab.ownerDocument.defaultView;
		var sourceBrowser = sourceWindow.TreeStyleTabService.getTabBrowserFromChild(aTab);
		var sourceService = sourceBrowser.treeStyleTab;

		aTab = sourceService.getTabFromChild(aTab);
		if (!aTab || !aTab.parentNode) // ignore removed tabs!
			return {
				draggedTab     : null,
				draggedTabs    : [],
				isMultipleMove : false
			};

		var draggedTabs = sourceWindow['piro.sakura.ne.jp'].tabsDragUtils.getSelectedTabs(aTab || sourceBrowser || aInfo.event);
		var isMultipleMove = false;

		if (draggedTabs.length > 1) {
			isMultipleMove = true;
		}
		else if (aInfo.action & sv.kACTIONS_FOR_DESTINATION) {
			draggedTabs = [aTab].concat(sourceService.getDescendantTabs(aTab));
		}

		return {
			draggedTab     : aTab,
			draggedTabs    : draggedTabs,
			isMultipleMove : isMultipleMove
		};
	},
 
	attachTabsOnDrop : function TabbarDND_attachTabsOnDrop(aTabs, aParent) 
	{
		var b  = aTabs[0].ownerDocument.defaultView.TreeStyleTabService.getTabBrowserFromChild(aTabs[0]);
		var sv = b.treeStyleTab;

		b.movingSelectedTabs = true; // Multiple Tab Handler
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (!tab.parentNode) continue; // ignore removed tabs
			if (aParent)
				sv.attachTabTo(tab, aParent);
			else
				sv.detachTab(tab);
			sv.collapseExpandTab(tab, false);
		}
		b.movingSelectedTabs = false; // Multiple Tab Handler
	},
 
	detachTabsOnDrop : function TabbarDND_detachTabsOnDrop(aTabs) 
	{
		var b  = aTabs[0].ownerDocument.defaultView.TreeStyleTabService.getTabBrowserFromChild(aTabs[0]);
		var sv = b.treeStyleTab;

		b.movingSelectedTabs = true; // Multiple Tab Handler
		for (let i = 0, maxi = aTabs.length; i < maxi; i++)
		{
			let tab = aTabs[i];
			if (!tab.parentNode) continue; // ignore removed tabs
			sv.detachTab(tab);
			sv.collapseExpandTab(tab, false);
		}
		b.movingSelectedTabs = false; // Multiple Tab Handler
	},
  
	clearDropPosition : function TabbarDND_clearDropPosition(aOnFinish) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;

		b.visibleTabs.forEach(function(aTab) {
			if (aTab.hasAttribute(sv.kDROP_POSITION))
				aTab.removeAttribute(sv.kDROP_POSITION)

			// clear drop position preview on Firefox 17 and later
			if (aOnFinish) {
				aTab.style.transform = '';
				if ('__treestyletab__opacityBeforeDragged' in aTab) {
					aTab.style.opacity = aTab.__treestyletab__opacityBeforeDragged;
					delete aTab.__treestyletab__opacityBeforeDragged;
				}
			}
		});

		if (aOnFinish)
			this.browser.mTabContainer.removeAttribute('movingtab')
	},
 
	isDraggingAllTabs : function TabbarDND_isDraggingAllTabs(aTab, aTabs) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;

		var actionInfo = {
				action : sv.kACTIONS_FOR_DESTINATION | sv.kACTION_IMPORT
			};
		var tabsInfo = this.getDraggedTabsInfoFromOneTab(actionInfo, aTab);
		return tabsInfo.draggedTabs.length == (aTabs || sv.getAllTabs(b)).length;
	},
 
	isDraggingAllCurrentTabs : function TabbarDND_isDraggingAllCurrentTabs(aTab) 
	{
		return this.isDraggingAllTabs(aTab, this.treeStyleTab.getTabs(this.treeStyleTab.browser));
	},
 
	handleEvent : function TabbarDND_handleEvent(aEvent) 
	{
		// ignore drag and drop while toolbar customization
		if (this.treeStyleTab.isToolbarCustomizing)
			return;

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
	
	onDragStart : function TabbarDND_onDragStart(aEvent) 
	{
		if (this.canDragTabbar(aEvent))
			return this.onTabbarDragStart(aEvent);

		var tab = this.treeStyleTab.getTabFromEvent(aEvent);
		if (tab)
			return this.onTabDragStart(aEvent, tab);
	},
	
	onTabDragStart : function TabbarDND_onTabDragStart(aEvent, aTab) 
	{
		var sv = this.treeStyleTab;
		var w  = this.window;
		var actionInfo = {
				action : sv.kACTIONS_FOR_DESTINATION | sv.kACTION_MOVE,
				event  : aEvent
			};
		var tabsInfo = this.getDraggedTabsInfoFromOneTab(actionInfo, aTab);
		if (
			tabsInfo.draggedTabs.length <= 1 ||
			Array.some(tabsInfo.draggedTabs, function(aTab) {
				return aTab.getAttribute('multiselected') == 'true'; // if multiselected, it should be handled by other addons (like Multiple Tab Handler)
			})
			)
			return;

		w['piro.sakura.ne.jp'].tabsDragUtils.startTabsDrag(aEvent, tabsInfo.draggedTabs);
	},
 
	onTabbarDragStart : function TabbarDND_onTabbarDragStart(aEvent) 
	{
		var sv = this.treeStyleTab;
		var dt = aEvent.dataTransfer;
		dt.mozSetDataAt(
			sv.kDRAG_TYPE_TABBAR,
			aEvent.shiftKey ?
				sv.kTABBAR_MOVE_FORCE :
				sv.kTABBAR_MOVE_NORMAL,
			0
		);
		dt.mozCursor = 'move';
//		var tabbar = sv.browser.mTabContainer;
//		var box = tabbar.boxObject;
//		dt.setDragImage(
//			tabbar,
//			aEvent.screenX - box.screenX,
//			aEvent.screenY - box.screenY
//		);
		// no feedback image, because it's annoying...
		dt.setDragImage(new this.window.Image(), 0, 0);
		aEvent.stopPropagation();
		this.readyToStartTabbarDrag();
	},
  
	onDragEnter : function TabbarDND_onDragEnter(aEvent) 
	{
		var sv = this.treeStyleTab;
		var w  = this.window;

		var dt = aEvent.dataTransfer;
		if (!this.canDrop(aEvent)) {
			dt.effectAllowed = dt.dropEffect = 'none';
			return;
		}

		var tab = aEvent.target;
		if (tab.localName != 'tab' ||
			!sv.getTreePref('autoExpand.enabled'))
			return;

		w.clearTimeout(this.mAutoExpandTimer);
		w.clearTimeout(this.mAutoExpandTimerNext);

		var sourceNode = dt.getData(sv.kDRAG_TYPE_TABBAR+'-node');
		if (aEvent.target == sourceNode)
			return;

		var draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
		this.mAutoExpandTimerNext = w.setTimeout(function(aSelf, aTarget, aDragged) {
			aSelf.mAutoExpandTimerNext = null;
			aSelf.mAutoExpandTimer = w.setTimeout(
				function() {
					let tab = sv.getTabById(aTarget);
					if (tab &&
						sv.shouldTabAutoExpanded(tab) &&
						tab.getAttribute(sv.kDROP_POSITION) == 'self') {
						let draggedTab = sv.getTabById(aDragged);
						if (sv.getTreePref('autoExpand.intelligently')) {
							sv.collapseExpandTreesIntelligentlyFor(tab);
							aSelf.updateDragData(draggedTab);
						}
						else {
							if (aSelf.mAutoExpandedTabs.indexOf(aTarget) < 0)
								aSelf.mAutoExpandedTabs.push(aTarget);
							sv.collapseExpandSubtree(tab, false);
							aSelf.updateDragData(draggedTab);
						}
					}
				},
				sv.getTreePref('autoExpand.delay')
			);
		}, 0, this, tab.getAttribute(sv.kID), draggedTab.getAttribute(sv.kID));

		tab = null;
	},
	updateDragData : function TabbarDND_updateDragData(aTab)
	{
		if (!aTab || !aTab._dragData) return;
		var sv = this.treeStyleTab;
		var data = aTab._dragData;
		var offsetX = sv.getXOffsetOfTab(aTab);
		var offsetY = sv.getYOffsetOfTab(aTab);
		if ('offsetX' in data) data.offsetX += offsetX;
		if ('screenX' in data) data.screenX += offsetX;
		if ('offsetY' in data) data.offsetY += offsetY;
		if ('screenY' in data) data.screenY += offsetY;
	},
 
	onDragLeave : function TabbarDND_onDragLeave(aEvent) 
	{
		this.clearDropPosition();

		this.window.clearTimeout(this.mAutoExpandTimer);
		this.mAutoExpandTimer = null;
	},
 
	onDragEnd : function TabbarDND_onDragEnd(aEvent) 
	{
		var sv = this.treeStyleTab;
		var dt = aEvent.dataTransfer;
		if (dt.getData(sv.kDRAG_TYPE_TABBAR))
			this.onTabbarDragEnd(aEvent);
		else
			this.onTabDragEnd(aEvent);
	},
	
	onTabDragEnd : function TabbarDND_onTabDragEnd(aEvent) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var d  = this.document;
		var w  = this.window;

		var tabbar = b.mTabContainer;
		var strip = sv.tabStrip;
		var dt = aEvent.dataTransfer;

		this.clearDropPosition(true);
		this.collapseAutoExpandedTabs();

		if (dt.mozUserCancelled || dt.dropEffect != 'none')
			return;

		// prevent handling of this event by the default handler
		aEvent.stopPropagation();
		aEvent.preventDefault();

		var eX = aEvent.screenX;
		var eY = aEvent.screenY;
		var x, y, w, h;

		// ignore drop on the toolbox
		x = w.screenX;
		y = w.screenY;
		w = w.outerWidth;
		h = d.getElementById('navigator-toolbox').boxObject.height;
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
		if (this.isDraggingAllCurrentTabs(draggedTab))
			return;

		if (aEvent.ctrlKey || aEvent.metaKey)
			draggedTab.__treestyletab__toBeDuplicated = true;

		b.replaceTabWithWindow(draggedTab);
	},
 
	onTabbarDragEnd : function TabbarDND_onTabbarDragEnd(aEvent) 
	{
		var w = this.window;
		w.setTimeout(function(aSelf) {
			aSelf.readyToEndTabbarDrag();
			aSelf.treeStyleTab.removeTabbrowserAttribute(aSelf.treeStyleTab.kDROP_POSITION);
		}, 10, this);
		aEvent.stopPropagation();
		aEvent.preventDefault();
	},
  
	onDragOver : function TabbarDND_onDragOver(aEvent) 
	{
		if (this.onTabDragOver(aEvent)) {
			aEvent.stopPropagation();
			aEvent.preventDefault(); // this is required to override default dragover actions!
		}
	},
	
	onTabDragOver : function TabbarDND_onTabDragOver(aEvent) 
	{
try{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var tabbar = b.mTabContainer;

		var session = sv.currentDragSession;
		if (sv.isToolbarCustomizing)
			return false;

		sv.autoScroll.processAutoScroll(aEvent);

		let draggedTab = aEvent.dataTransfer && aEvent.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
		let dragOverTab = sv.getTabFromEvent(aEvent) || sv.getTabFromTabbarEvent(aEvent) || aEvent.target;
		b.ownerDocument.defaultView['piro.sakura.ne.jp'].tabsDragUtils
			.processTabsDragging(aEvent, !dragOverTab || !dragOverTab.pinned);

		/**
		 * We must calculate drop action after tabsDragUtils.processTabsDragging(),
		 * because the drop position depends on tabs' actual
		 * positions (which can be changed by animation effects.)
		 */
		var info = this.getDropAction(aEvent, session);

		var observer = b;
		if (b.tabContainer && b.tabContainer._setEffectAllowedForDataTransfer)
			observer = b.tabContainer;

		// auto-switch for staying on tabs
		if (
			info.position == sv.kDROP_ON &&
			info.target &&
			!info.target.selected &&
			'_dragTime' in observer && '_dragOverDelay' in observer
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
					b.selectedTab = info.target;
			}
		}

		if (
			!info.canDrop ||
			observer._setEffectAllowedForDataTransfer(aEvent) == 'none'
			) {
			aEvent.dataTransfer.effectAllowed = "none";
			this.clearDropPosition();
			return true;
		}

		let indicatorTab = info.target;
		if (sv.isCollapsed(info.target)) {
			let tab = indicatorTab;
			while ((tab = sv.getPreviousTab(tab)) && sv.isCollapsed(tab)) {}
			if (tab) indicatorTab = tab;
		}

		let dropPosition = info.position == sv.kDROP_BEFORE ? 'before' :
							info.position == sv.kDROP_AFTER ? 'after' :
							'self';
		if (indicatorTab != draggedTab &&
			indicatorTab.getAttribute(sv.kDROP_POSITION) != dropPosition) {
			this.clearDropPosition();
			indicatorTab.setAttribute(sv.kDROP_POSITION, dropPosition);
			if (b.ownerDocument.defaultView['piro.sakura.ne.jp'].tabsDragUtils
					.canAnimateDraggedTabs(aEvent)) { // Firefox 17 and later
				let newOpacity = dropPosition == 'self' ? 0.5 : '' ; // to prevent the dragged tab hides the drop target itself
				this.window['piro.sakura.ne.jp'].tabsDragUtils.getDraggedTabs(aEvent).forEach(function(aTab) {
					if (!('__treestyletab__opacityBeforeDragged' in aTab))
						aTab.__treestyletab__opacityBeforeDragged = aTab.style.opacity || '';
					aTab.style.opacity = newOpacity;
				});
			}
		}


		var indicator = b.mTabDropIndicatorBar || b.tabContainer._tabDropIndicator;
		indicator.setAttribute('dragging', (info.position == sv.kDROP_ON || sv.isVertical) ? 'false' : 'true' );
		if (sv.isVertical)
			indicator.collapsed = true;

		return (info.position == sv.kDROP_ON || sv.position != 'top')
}
catch(e) {
	dump('TabbarDND::onDragOver\n'+e+'\n');
}
	},
  
	onDrop : function TabbarDND_onDrop(aEvent) 
	{
		this.onTabDrop(aEvent);
		this.collapseAutoExpandedTabs();
	},
	collapseAutoExpandedTabs : function TabbarDND_collapseAutoExpandedTabs()
	{
		var sv = this.treeStyleTab;
		if (this.mAutoExpandedTabs.length) {
			if (sv.getTreePref('autoExpand.collapseFinally')) {
				for (let i = 0, maxi = this.mAutoExpandedTabs.length; i < maxi; i++)
				{
					sv.collapseExpandSubtree(sv.getTabById(this.mAutoExpandedTabs[i]), true, true);
				}
			}
			this.mAutoExpandedTabs = [];
		}
	},
	
	onTabDrop : function TSTService_onTabDrop(aEvent) 
	{
		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;

		var tabbar = b.mTabContainer;
		var dt = aEvent.dataTransfer;

		/**
		 * We must calculate drop action before clearing "dragging"
		 * state, because the drop position depends on tabs' actual
		 * positions (they are applied only while tab dragging.)
		 */
		var session = sv.currentDragSession;
		var dropActionInfo = this.getDropAction(aEvent, session);

		this.clearDropPosition(true);
		if (tabbar._tabDropIndicator)
			tabbar._tabDropIndicator.collapsed = true;

		var draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
		if (dt.dropEffect != 'link' && !draggedTab) {
			aEvent.stopPropagation();
			return;
		}

		var sourceBrowser = sv.getTabBrowserFromChild(draggedTab);
		if (draggedTab && sourceBrowser != b)
			sourceBrowser.treeStyleTab.tabbarDNDObserver.clearDropPosition(true);

		if (draggedTab && this.performDrop(dropActionInfo, draggedTab)) {
			aEvent.stopPropagation();
			return;
		}

		// duplicating of tabs
		if (
			draggedTab &&
			(
				dt.dropEffect == 'copy' ||
				sourceBrowser != b
			) &&
			dropActionInfo.position == sv.kDROP_ON
			) {
			var beforeTabs = Array.slice(b.mTabContainer.childNodes);
			w.setTimeout(function() {
				var newTabs = Array.slice(b.mTabContainer.childNodes).filter(function(aTab) {
						return beforeTabs.indexOf(aTab) < 0;
					});
				if (newTabs.length)
					sv.attachTabTo(newTabs[0], dropActionInfo.target);
			}, 0);
			return;
		}

		if (!draggedTab)
			this.handleLinksOrBookmarks(aEvent, dropActionInfo);
	},
	handleLinksOrBookmarks : function TabbarDND_handleLinksOrBookmarks(aEvent, aDropActionInfo)
	{
		aEvent.stopPropagation();

		var uris = this.retrieveURLsFromDataTransfer(aEvent.dataTransfer);
		uris.forEach(function(aURI) {
			if (aURI.indexOf(this.BOOKMARK_FOLDER) != 0)
				this.securityCheck(aURI, aEvent);
		}, this);

		var sv = this.treeStyleTab;
		var b  = this.browser;
		var w  = this.window;
		var self = this;

		let bgLoad = sv.getPref('browser.tabs.loadInBackground');
		if (aEvent.shiftKey) bgLoad = !bgLoad;

		let tab = sv.getTabFromEvent(aEvent);
		if (
			!tab ||
			aEvent.dataTransfer.dropEffect == 'copy' ||
			uris.length > 1 ||
			uris[0].indexOf(this.BOOKMARK_FOLDER) == 0
			) {
			uris.reverse().forEach(function(aURI) {
				if (aURI.indexOf(this.BOOKMARK_FOLDER) == 0) {
					let newTabs = sv.getNewTabsWithOperation(function() {
									var data = aURI.replace(self.BOOKMARK_FOLDER, '');
									data = JSON.parse(data);
									w.PlacesUIUtils._openTabset(data.children, { type : 'drop' }, w, data.title);
								}, b);
					aDropActionInfo.draggedTabsInfo = {
						draggedTabs : newTabs,
						draggedTab : newTabs[0],
						isMultipleMove : newTabs.length > 1
					};
					this.performDrop(aDropActionInfo, newTabs[0]);
				}
				else {
					aURI = w.getShortcutOrURI(aURI);
					this.performDrop(aDropActionInfo, b.loadOneTab(aURI, { inBackground: bgLoad }));
				}
			}, this);
		}
		else {
			let locked = (
					tab.getAttribute('locked') == 'true' || // Tab Mix Plus and others
					tab.getAttribute('isPageLocked') == 'true' // Super Tab Mode
				);
			let loadDroppedLinkToNewChildTab = aDropActionInfo.position != sv.kDROP_ON || locked;
			if (!loadDroppedLinkToNewChildTab &&
				aDropActionInfo.position == sv.kDROP_ON)
				loadDroppedLinkToNewChildTab = sv.dropLinksOnTabBehavior() == sv.kDROPLINK_NEWTAB;

			try {
				let uri = w.getShortcutOrURI(uris[0]);
				if (loadDroppedLinkToNewChildTab || locked) {
					this.performDrop(aDropActionInfo, b.loadOneTab(uri, { inBackground: bgLoad }));
				}
				else {
					tab.linkedBrowser.loadURI(uri);
					if (!bgLoad)
						b.selectedTab = tab;
				}
			}
			catch(e) {
			}
		}
	},
	securityCheck : function TabbarDND_securityCheck(aURI, aEvent)
	{
		// See dragDropSecurityCheck() in chrome://global/content/nsDragAndDrop.js
		let session = this.treeStyleTab.currentDragSession;
		if (!session) { //TODO: use some fake nodePrincipal?
			aEvent.stopPropagation();
			throw 'Drop of ' + aURI + ' denied: no drag session.';
		}
		let normalizedURI;
		try {
			normalizedURI = this.treeStyleTab.makeURIFromSpec(aURI);
		}
		catch(e) {
		}
		if (!normalizedURI)
			return;
		let sourceDoc = session.sourceDocument;
		let principal = sourceDoc ? sourceDoc.nodePrincipal
			: SecMan.getSimpleCodebasePrincipal(this.treeStyleTab.IOService.newURI("file:///", null, null));
		try {
			SecMan.checkLoadURIStrWithPrincipal(principal, normalizedURI.spec, Ci.nsIScriptSecurityManager.STANDARD);
		}
		catch(e) {
			aEvent.stopPropagation();
			throw 'Drop of ' + aURI + ' denied.';
		}
	},
	
	retrieveURLsFromDataTransfer : function TSTService_retrieveURLsFromDataTransfer(aDataTransfer) 
	{
		var urls = [];
		var types = [
				'text/x-moz-place',
				'text/uri-list',
				'text/x-moz-text-internal',
				'text/x-moz-url',
				'text/plain',
				'application/x-moz-file'
			];
		for (let i = 0; i < types.length; i++) {
			let dataType = types[i];
			for (let i = 0, maxi = aDataTransfer.mozItemCount; i < maxi; i++)
			{
				let urlData = aDataTransfer.mozGetDataAt(dataType, i);
				if (urlData) {
					urls = urls.concat(this.retrieveURLsFromData(urlData, dataType));
				}
			}
			if (urls.length)
				break;
		}
		return urls.filter(function(aURI) {
				return aURI &&
						aURI.length &&
						aURI.indexOf(this.BOOKMARK_FOLDER) == 0 ||
						(
							aURI.indexOf(' ', 0) == -1 &&
							!/^\s*(javascript|data):/.test(aURI)
						);
			}, this);
	},
	BOOKMARK_FOLDER: 'x-moz-place:',
	retrieveURLsFromData : function TSTService_retrieveURLsFromData(aData, aType)
	{
		switch (aType)
		{
			case 'text/x-moz-place':
				let (uri = JSON.parse(aData).uri) {
					if (uri)
						return uri;
					else
						return this.BOOKMARK_FOLDER+aData;
				}

			case 'text/uri-list':
				return aData.replace(/\r/g, '\n')
							.replace(/^\#.+$/gim, '')
							.replace(/\n\n+/g, '\n')
							.split('\n');

			case 'text/unicode':
			case 'text/plain':
			case 'text/x-moz-text-internal':
				return [aData.replace(/^\s+|\s+$/g, '')];

			case 'text/x-moz-url':
				return [((aData instanceof Ci.nsISupportsString) ? aData.toString() : aData)
							.split('\n')[0]];

			case 'application/x-moz-file':
				let fileHandler = Services.io.getProtocolHandler('file')
									.QueryInterface(Ci.nsIFileProtocolHandler);
				return [fileHandler.getURLSpecFromFile(aData)];
		}
		return [];
	},
    
	init : function TabbarDND_init(aTabBrowser) 
	{
		this.browser      = aTabBrowser;
		this.document     = aTabBrowser.ownerDocument;
		this.window       = this.document.defaultView;
		this.treeStyleTab = aTabBrowser.treeStyleTab;

		this.mAutoExpandTimer = null;
		this.mAutoExpandTimerNext = null;
		this.mAutoExpandedTabs = [];
		this.startListenEvents();
	},
	
	startListenEvents : function TabbarDND_startListenEvents() 
	{
		var strip = this.treeStyleTab.tabStrip;
		strip.addEventListener('dragstart', this, true);
		strip.addEventListener('dragover',  this, true);
		strip.addEventListener('dragenter', this, false);
		strip.addEventListener('dragleave', this, false);
		strip.addEventListener('dragend',   this, true);
		strip.addEventListener('drop',      this, true);
	},
  
	destroy : function TabbarDND_destroy() 
	{
		this.endListenEvents();

		delete this.treeStyleTab;
		delete this.browser;
		delete this.document;
		delete this.window;
	},
	
	endListenEvents : function TabbarDND_endListenEvents() 
	{
		var strip = this.treeStyleTab.tabStrip;
		strip.removeEventListener('dragstart', this, true);
		strip.removeEventListener('dragover',  this, true);
		strip.removeEventListener('dragenter', this, false);
		strip.removeEventListener('dragleave', this, false);
		strip.removeEventListener('dragend',   this, true);
		strip.removeEventListener('drop',      this, true);
	}
  
}; 
  
