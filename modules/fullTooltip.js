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
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2014
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
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

const EXPORTED_SYMBOLS = ['FullTooltipManager'];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

Components.utils.import('resource://treestyletab-modules/lib/inherit.jsm');
Components.utils.import('resource://treestyletab-modules/base.js');
Components.utils.import('resource://treestyletab-modules/pseudoTreeBuilder.js');

XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');

XPCOMUtils.defineLazyServiceGetter(this, 'ScreenManager',
  '@mozilla.org/gfx/screenmanager;1', 'nsIScreenManager');

function FullTooltipManager(aOwner)
{
	this.init(aOwner);
}
FullTooltipManager.prototype = inherit(TreeStyleTabBase, {

	kTOOLTIP_MODE_DEFAULT   : 0,
	kTOOLTIP_MODE_COLLAPSED : 1,
	kTOOLTIP_MODE_ALWAYS    : 2,

	get window()
	{
		return this.owner.window;
	},

	get document()
	{
		return this.owner.document;
	},
 
	get tabTooltip() 
	{
		return this.document.getElementById('tabbrowser-tab-tooltip');
	},
 
	get tabFullTooltip() 
	{
		return this.document.getElementById('treestyletab-full-tree-tooltip');
	},


	init : function FTM_init(aOwner)
	{
		this.owner = aOwner;

		this.tabTooltip.addEventListener('popupshowing', this, true);
		this.tabTooltip.addEventListener('popuphiding', this, true);

		this.tabFullTooltip.addEventListener('click', this, false);
		this.tabFullTooltip.addEventListener(PseudoTreeBuilder.kTAB_LINK_CLICK, this, true);
		this.tabFullTooltip.addEventListener('popupshown', this, true);
		this.tabFullTooltip.addEventListener('popuphidden', this, true);
	},

	destroy : function FTM_destroy()
	{
		this.cancel();
		this.stopListenTooltipEvents();

		this.tabTooltip.removeEventListener('popupshowing', this, true);
		this.tabTooltip.removeEventListener('popuphiding', this, true);

		this.tabFullTooltip.removeEventListener('click', this, false);
		this.tabFullTooltip.removeEventListener(PseudoTreeBuilder.kTAB_LINK_CLICK, this, true);
		this.tabFullTooltip.removeEventListener('popupshown', this, true);
		this.tabFullTooltip.removeEventListener('popuphidden', this, true);

		delete this.owner;
	},

	handleEvent : function FTM_handleEvent(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'click':
				return this.onClick(aEvent);

			case PseudoTreeBuilder.kTAB_LINK_CLICK:
				return this.onItemClick(aEvent);

			case 'popupshowing':
				return this.onDefaultTooltipShowing(aEvent);

			case 'popuphiding':
				return this.onDefaultTooltipHiding(aEvent);

			case 'popupshown':
				return this.onShown(aEvent);

			case 'popuphidden':
				return this.onHidden(aEvent);

			case 'mousemove':
				return this.onTooltipMouseMove(aEvent);

			case 'mouseover':
				return this.cancelDelayedHide();

			case 'mouseout':
				return this.hideWithDelay();

			default:
				return this.onTooltipEvent(aEvent);
		}
	},

	getFullTooltipFromEvent : function FTM_getFullTooltipFromEvent(aEvent)
	{
		return this.evaluateXPath(
				'ancestor-or-self::xul:tooltip[@id="'+this.tabFullTooltip.id+'"]',
				aEvent.target,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
	},

	onClick : function FTM_onClick(aEvent)
	{
		this.tabFullTooltip.hidePopup();
	},

	onItemClick : function FTM_onItemClick(aEvent)
	{
		var id = aEvent.detail.id;
		if (id) {
			let tab = this.getTabById(id, this.owner.browser);
			if (tab) {
				let event = aEvent.detail.sourceEvent;
				if (event.button == 1 ||
					(event.button == 0 && this.isAccelKeyPressed(event)))
					this.owner.browser.removeTab(tab);
				else if (event.button != 2)
					this.owner.browser.selectedTab = tab;
			}
		}
		this.tabFullTooltip.hidePopup();
	},

	onDefaultTooltipShowing : function FTM_onDefaultTooltipShowing(aEvent) 
	{
		this.cancel();
		this.handleDefaultTooltip(aEvent);
	},

	onDefaultTooltipHiding : function FTM_onDefaultTooltipHiding(aEvent)
	{
		this.cancel();
	},

	onShown : function FTM_onShown(aEvent) 
	{
		this.startListenTooltipEvents();

		var tooltip = this.tabFullTooltip;
		tooltip.setAttribute('popup-shown', true);

		var w = {},
			h = {};
		var box = tooltip.boxObject;
		var scrollBoxObject = tooltip.firstChild.scrollBoxObject;
		scrollBoxObject.getScrolledSize(w, h);
		var currentW = box.width - scrollBoxObject.width + w.value;
		var currentH = box.height - scrollBoxObject.height + h.value;
		var currentX = box.screenX;
		var currentY = box.screenY;

		var currentScreen = Cc['@mozilla.org/gfx/screenmanager;1']
							.getService(Ci.nsIScreenManager)
							.screenForRect(box.screenX, box.screenY, box.width, box.height);
		var screenLeft   = {},
			screenTop    = {},
			screenWidth  = {},
			screenHeight = {};
		currentScreen.GetRect(screenLeft, screenTop, screenWidth, screenHeight);

		var style = tooltip.style;
		style.maxWidth = screenWidth.value+'px';
		style.maxHeight = screenHeight.value+'px';
		style.minWidth = 0;
		style.minHeight = 0;
		if (currentX + currentW + screenLeft.value >= screenWidth.value)
			style.marginLeft = (Math.max(screenLeft.value, screenWidth.value - currentW) - this.window.screenX)+'px';
		if (currentY + currentH + screenTop.value >= screenHeight.value)
			style.marginTop = (Math.max(screenTop.value, screenHeight.value - currentH) - this.window.screenY)+'px';
	},

	onHidden : function FTM_onHidden(aEvent) 
	{
		this.tabFullTooltip.removeAttribute('popup-shown');
		this.stopListenTooltipEvents();
		this.clear();
	},

	onTooltipMouseMove : function FTM_onTooltipMouseMove(aEvent)
	{
		if (this.getFullTooltipFromEvent(aEvent))
			this.cancelDelayedHide();
		else
			this.hideWithDelay();
	},

	onTooltipEvent : function FTM_onTooltipEvent(aEvent)
	{
		if (!this.getFullTooltipFromEvent(aEvent))
			this.hide();
	},

	startListenTooltipEvents : function FTM_startListenTooltipEvents()
	{
		if (this.listening)
			return;
		this.window.addEventListener('DOMMouseScroll', this, true);
		this.window.addEventListener('keydown', this, true);
		this.window.addEventListener('mousedown', this, true);
		this.window.addEventListener('mouseup', this, true);
		this.window.addEventListener('dragstart', this, true);
		this.window.addEventListener('mousemove', this, true);
		this.tabFullTooltip.addEventListener('mouseover', this, false);
		this.tabFullTooltip.addEventListener('mouseout', this, false);
		this.listening = true;
	},

	stopListenTooltipEvents : function FTM_stopListenTooltipEvents()
	{
		if (!this.listening)
			return;
		this.window.removeEventListener('DOMMouseScroll', this, true);
		this.window.removeEventListener('keydown', this, true);
		this.window.removeEventListener('mousedown', this, true);
		this.window.removeEventListener('mouseup', this, true);
		this.window.removeEventListener('dragstart', this, true);
		this.window.removeEventListener('mousemove', this, true);
		this.tabFullTooltip.removeEventListener('mouseover', this, false);
		this.tabFullTooltip.removeEventListener('mouseout', this, false);
		this.listening = false;
	},


	handleDefaultTooltip : function FTM_handleDefaultTooltip(aEvent) 
	{
		var tab = this.getTabFromChild(this.document.tooltipNode);
		if (!tab || tab.localName != 'tab')
			return;

		var label;
		var collapsed = this.isSubtreeCollapsed(tab);
		var mode = utils.getTreePref('tooltip.mode');

		var base = parseInt(tab.getAttribute(this.kNEST) || 0);
		var descendant = this.getDescendantTabs(tab);
		var indentPart = '  ';
		var tree = null;
		var fullTooltipExtraLabel = '';
		if (mode > this.kTOOLTIP_MODE_DEFAULT &&
			descendant.length) {
			let tabs = [tab].concat(descendant);
			let tabsToBeListed = tabs.slice(0, Math.max(1, utils.getTreePref('tooltip.maxCount')));
			tree = tabsToBeListed
					.map(function(aTab) {
						let label = aTab.getAttribute('label');
						let indent = '';
						let nest = parseInt(aTab.getAttribute(this.kNEST) || 0) - base;
						for (let i = 0; i < nest; i++)
						{
							indent += indentPart;
						}
						return utils.treeBundle.getFormattedString('tooltip.item.label', [label, indent]);
					}, this)
					.join('\n');
			if (tabs.length != tabsToBeListed.length) {
				tree += '\n'+indentPart+utils.treeBundle.getFormattedString('tooltip.more', [tabs.length-tabsToBeListed.length]);
			}
		}

		var shouldShowTree = mode != this.kTOOLTIP_MODE_DEFAULT && (collapsed || mode == this.kTOOLTIP_MODE_ALWAYS);
		if ('mOverCloseButton' in tab && tab.mOverCloseButton) {
			if (descendant.length &&
				(collapsed || utils.getTreePref('closeParentBehavior') == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)) {
				label = tree || tab.getAttribute('label');
				label = label && shouldShowTree ?
						utils.treeBundle.getFormattedString('tooltip.closeTree.labeled', [label]) :
						utils.treeBundle.getString('tooltip.closeTree') ;
				fullTooltipExtraLabel = utils.treeBundle.getFormattedString('tooltip.closeTree.labeled', ['%TREE%']).split(/\s*%TREE%\s*/);
			}
		}
		else if (tab.getAttribute(this.kTWISTY_HOVER) == 'true') {
			let key = collapsed ?
						'tooltip.expandSubtree' :
						'tooltip.collapseSubtree' ;
			label = tree || tab.getAttribute('label');
			label = label && shouldShowTree ?
					utils.treeBundle.getFormattedString(key+'.labeled', [label]) :
					utils.treeBundle.getString(key) ;
			fullTooltipExtraLabel = utils.treeBundle.getFormattedString(key+'.labeled', ['%TREE%']).split(/\s*%TREE%\s*/);
		}
		else if (shouldShowTree) {
			label = tree;
		}

		if (!label)
			return;

		aEvent.target.setAttribute('label', label);
		aEvent.stopPropagation();

		if (shouldShowTree)
			this.setup(aEvent.target, tab, fullTooltipExtraLabel);
	},


	/**
	 * If the window is maximized, screenX and screenY can be out of
	 * visible screen rect. On the other hand,
	 * nsIPopupBoxObject#openPopupAtScreen() automatically reposition
	 * the popup if it is going to be shown out of the visible screen
	 * rect. As the result, the popup will be repositioned unexpectedly
	 * if I use the raw screenX and screenY.
	 * https://github.com/piroor/treestyletab/issues/302
	 * To prevent such a result, I have to calculate valid base position
	 * for the popup.
	 */
	get windowBasePosition() {
		var screen = ScreenManager.screenForRect(
				this.window.screenX,
				this.window.screenY,
				this.window.outerWidth,
				this.window.outerHeight
			);
		var screenMinX = {},
			screenMinY = {},
			screenMaxX = {},
			screenMaxY = {};
		screen.GetAvailRect(screenMinX, screenMinY, screenMaxX, screenMaxY);

		return {
			x: Math.max(this.window.screenX, screenMinX.value),
			y: Math.max(this.window.screenY, screenMinY.value)
		};
	},

	setup : function FTM_setup(aBaseTooltip, aTab, aExtraLabels) 
	{
		this.cancel();

		var delay = utils.getTreePref('tooltip.fullTooltipDelay');
		if (delay < 0)
			return;

		this._fullTooltipTimer = this.window.setTimeout(function(aSelf) {
			var basePosition = aSelf.windowBasePosition;
			var box = aBaseTooltip.boxObject;
			var x = box.screenX - basePosition.x;
			var y = box.screenY - basePosition.y;
			var w = box.width;
			var h = box.height;
			aBaseTooltip.hidePopup();

			aSelf.fill(aTab, aExtraLabels);

			var tooltip = aSelf.tabFullTooltip;
			let (style = tooltip.style) {
				style.marginLeft = x+'px';
				style.marginTop = y+'px';
				style.maxWidth = style.minWidth = w+'px';
				style.maxHeight = style.minHeight = h+'px';
			}
			tooltip.openPopupAtScreen(basePosition.x, basePosition.y, false);
		}, Math.max(delay, 0), this);
	},

	cancel : function FTM_destroyFullTooltip()
	{
		if (this._fullTooltipTimer) {
			this.window.clearTimeout(this._fullTooltipTimer);
			this._fullTooltipTimer = null;
		}
		this.hide();
	},

	hide : function FTM_hide()
	{
		this.cancelDelayedHide();
		this.tabFullTooltip.hidePopup();
	},


	hideWithDelay : function FTM_hideWithDelay()
	{
		this.cancelDelayedHide();
		this._delayedHideTimer = this.window.setTimeout(function(aSelf) {
			aSelf.hide();
		}, 500, this);
	},

	cancelDelayedHide : function FTM_cancelDelayedHide()
	{
		if (this._delayedHideTimer) {
			this.window.clearTimeout(this._delayedHideTimer);
			this._delayedHideTimer = null;
		}
	},


	fill : function FTM_fill(aTab, aExtraLabels)
	{
		this.clear();

		var tree = PseudoTreeBuilder.build(aTab);
		var root = this.document.createElement('arrowscrollbox');
		root.setAttribute('orient', 'vertical');
		root.setAttribute('flex', 1);

		if (aExtraLabels) {
			if (typeof aExtraLabels == 'string')
				aExtraLabels = [aExtraLabels];
			for (let i = 0, maxi = aExtraLabels.length; i < maxi; i++)
			{
				let label = aExtraLabels[i];
				label = label.trim();
				if (!label)
					continue;
				root.appendChild(this.document.createElement('description'))
					.appendChild(this.document.createTextNode(label));
			}
		}

		root.insertBefore(tree, root.firstChild && root.firstChild.nextSibling);

		this.tabFullTooltip.appendChild(root);
	},

	clear : function FTM_clear()
	{
		var range = this.document.createRange();
		range.selectNodeContents(this.tabFullTooltip);
		range.deleteContents();
		range.detach();
	}
});
