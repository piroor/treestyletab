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
 * Portions created by the Initial Developer are Copyright (C) 2011
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

const EXPORTED_SYMBOLS = ['FullTooltipManager'];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://treestyletab-modules/utils.js');

function FullTooltipManager(aOwner)
{
	this.init(aOwner);
}
FullTooltipManager.prototype = {
	__proto__ : TreeStyleTabUtils,

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
		return this.document.getElementById('tabbrowser-tab-tooltip') || // Firefox 4.0-
				this.evaluateXPath('descendant::xul:tooltip', this.owner.browser.mStrip, Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE).singleNodeValue; // -Firefox 3.6
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

		this.tabFullTooltip.addEventListener('click', this, true);
		this.tabFullTooltip.addEventListener('popupshown', this, true);
		this.tabFullTooltip.addEventListener('popuphidden', this, true);
	},

	destroy : function FTM_destroy()
	{
		this.cancel();
		this.stopListenTooltipEvents();

		this.tabTooltip.removeEventListener('popupshowing', this, true);
		this.tabTooltip.removeEventListener('popuphiding', this, true);

		this.tabFullTooltip.removeEventListener('click', this, true);
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
		var label = this.evaluateXPath(
				'ancestor-or-self::xul:label[@class="text-link"][1]',
				aEvent.target,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		if (label) {
			let id = label.getAttribute(this.kID);
			let tab = this.getTabById(id, this.owner.browser);
			if (tab)
				this.owner.browser.selectedTab = tab;
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
	},

	onHidden : function FTM_onHidden(aEvent) 
	{
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
		var mode = this.getTreePref('tooltip.mode');

		var base = parseInt(tab.getAttribute(this.kNEST) || 0);
		var descendant = this.getDescendantTabs(tab);
		var indentPart = '  ';
		var tree = null;
		var fullTooltipExtraLabel = '';
		if (mode > this.kTOOLTIP_MODE_DEFAULT &&
			descendant.length) {
			let tabs = [tab].concat(descendant);
			let tabsToBeListed = tabs.slice(0, Math.max(1, this.getTreePref('tooltip.maxCount')));
			tree = tabsToBeListed
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
					.join('\n');
			if (tabs.length != tabsToBeListed.length) {
				tree += '\n'+indentPart+this.treeBundle.getFormattedString('tooltip.more', [tabs.length-tabsToBeListed.length]);
			}
		}

		if ('mOverCloseButton' in tab && tab.mOverCloseButton) {
			if (descendant.length &&
				(collapsed || this.getTreePref('closeParentBehavior') == this.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN)) {
				label = tree || tab.getAttribute('label');
				label = label ?
						this.treeBundle.getFormattedString('tooltip.closeTree.labeled', [label]) :
						this.treeBundle.getString('tooltip.closeTree') ;
				fullTooltipExtraLabel = this.treeBundle.getFormattedString('tooltip.closeTree.labeled', ['%TREE%']).split(/\s*%TREE%\s*/);
			}
		}
		else if (tab.getAttribute(this.kTWISTY_HOVER) == 'true') {
			let key = collapsed ?
						'tooltip.expandSubtree' :
						'tooltip.collapseSubtree' ;
			label = tree || tab.getAttribute('label');
			label = label ?
					this.treeBundle.getFormattedString(key+'.labeled', [label]) :
					this.treeBundle.getString(key) ;
			fullTooltipExtraLabel = this.treeBundle.getFormattedString(key+'.labeled', ['%TREE%']).split(/\s*%TREE%\s*/);
		}
		else if (collapsed || mode == this.kTOOLTIP_MODE_ALWAYS) {
			label = tree;
		}

		if (!label)
			return;

		aEvent.target.setAttribute('label', label);
		aEvent.stopPropagation();

		this.setup(aEvent.target, tab, fullTooltipExtraLabel);
	},


	setup : function FTM_setup(aBaseTooltip, aTab, aExtraLabels) 
	{
		this.cancel();

		var delay = this.getTreePref('tooltip.fullTooltipDelay');
		if (delay < 0)
			return;

		this._fullTooltipTimer = this.window.setTimeout(function(aSelf) {
			var x = aBaseTooltip.boxObject.screenX;
			var y = aBaseTooltip.boxObject.screenY;
			aBaseTooltip.hidePopup();

			var tooltip = aSelf.tabFullTooltip;
			tooltip.style.maxWidth = aSelf.window.screen.availWidth+'px';
			tooltip.style.maxHeight = aSelf.window.screen.availHeight+'px';

			aSelf.fill(aTab, aExtraLabels);

			// open as a context menu popup to reposition it automatically
			tooltip.openPopupAtScreen(x, y, true);
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

		var tree = this.createTabItem(aTab);
		var root = this.document.createDocumentFragment();

		if (aExtraLabels) {
			if (typeof aExtraLabels == 'string')
				aExtraLabels = [aExtraLabels];
			aExtraLabels.forEach(function(aLabel) {
				aLabel = aLabel.replace(/^\s+|\s+$/g, '');
				if (!aLabel)
					return;
				root.appendChild(this.document.createElement('description'))
					.appendChild(this.document.createTextNode(aLabel));
			}, this);
		}

		root.insertBefore(tree, root.firstChild && root.firstChild.nextSibling);

		var range = this.document.createRange();
		range.selectNodeContents(this.tabFullTooltip.firstChild);
		range.insertNode(root);
		range.detach();
	},

	clear : function FTM_clear()
	{
		var range = this.document.createRange();
		range.selectNodeContents(this.tabFullTooltip.firstChild);
		range.deleteContents();
		range.detach();
	},

	createTabItem : function FTM_createTabItem(aTab)
	{
		var item = this.document.createElement('hbox');
		item.setAttribute('align', 'center');

		var favicon = item.appendChild(this.document.createElement('image'));
		favicon.setAttribute('src', aTab.getAttribute('image') || 'chrome://mozapps/skin/places/defaultFavicon.png');
		favicon.setAttribute('style', 'max-width:16px;max-height:16px;');

		var label = item.appendChild(this.document.createElement('label'));
		label.setAttribute('value', aTab.label);
		label.setAttribute('tooltiptext', aTab.label+'\n'+aTab.linkedBrowser.currentURI.spec);
		label.setAttribute('crop', 'end');
		label.setAttribute('class', 'text-link');
		label.setAttribute(this.kID, this.getTabValue(aTab, this.kID));

		var children = this.createTabChildren(aTab);
		if (children) {
			let container = this.document.createElement('vbox');
			container.appendChild(item);
			container.appendChild(children);
			return container;
		}
		else {
			return item;
		}
	},

	createTabChildren : function FTM_createTabChildren(aTab)
	{
		var children = this.getChildTabs(aTab);
		if (!children.length)
			return null;

		var container = this.document.createElement('vbox');
		children.forEach(function(aChild) {
			container.appendChild(this.createTabItem(aChild));
		}, this);
		container.setAttribute('align', 'stretch');
		container.setAttribute('style', 'margin-left:1.5em');
		return container;
	}
};
