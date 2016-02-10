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
 * Portions created by the Initial Developer are Copyright (C) 2014-2015
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 Infocatcher <https://github.com/Infocatcher>
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

var EXPORTED_SYMBOLS = ['BrowserUIShowHideObserver']; 

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

Components.utils.import('resource://treestyletab-modules/constants.js');

XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');

function BrowserUIShowHideObserver(aOwner, aBox, aOptions) {
	this.owner = aOwner;
	this.box = aBox;
	this.init(aOptions);
}
BrowserUIShowHideObserver.prototype = {
	get MutationObserver()
	{
		var w = this.box.ownerDocument.defaultView;
		return w.MutationObserver || w.MozMutationObserver;
	},

	init : function BrowserUIShowHideObserver_onInit(aOptions) 
	{
		if (!this.MutationObserver)
			return;
		this.observer = new this.MutationObserver((function(aMutations, aObserver) {
			this.onMutation(aMutations, aObserver);
		}).bind(this));
		var options = {
			childList       : true,
			attributes      : true,
			subtree         : true,
			attributeOldValue: utils.isDebugging('browserUIShowHideObserver'),
			attributeFilter : [
				'hidden',
				'collapsed',
				'moz-collapsed', // Used in full screen mode
				'disablechrome',
				'width',
				'height'
			]
		};
		if (aOptions) {
			Object.keys(options).forEach(function(aKey) {
				if (aKey in aOptions)
					options[aKey] = aOptions[aKey];
			});
		}
		this.observer.observe(this.box, options);
	},
	onMutation : function BrowserUIShowHideObserver_onMutation(aMutations, aObserver) 
	{
		aMutations.forEach(function(aMutation) {
			try {
				switch (aMutation.type)
				{
					case 'childList':
						if (aMutation.target == this.box) {
							this.dumpMutation(aMutation, 'BrowserUIShowHideObserver_onMutation/childList');
							this.owner.browser.treeStyleTab.updateFloatingTabbar(TreeStyleTabConstants.kTABBAR_UPDATE_BY_WINDOW_RESIZE);
						}
						return;

					case 'attributes':
						this.onAttributeModified(aMutation, aObserver);
						return;
				}
			}
			catch(error) {
				this.dumpMutation(aMutation, 'BrowserUIShowHideObserver_onMutation(error)');
				Components.utils.reportError(error);
			}
		}, this);
	},

	destroy : function BrowserUIShowHideObserver_destroy()
	{
		if (this.observer) {
			this.observer.disconnect();
			delete this.observer;
		}
		delete this.box;
		delete this.owner;
	},

	dumpMutation : function BrowserUIShowHideObserver_dumpMutation(aMutation, aDescription)
	{
		if (!utils.isDebugging('browserUIShowHideObserver'))
			return;

		var target = aMutation.target;
		var ownerInformation = this.box.localName + '#' + this.box.id + '.' + this.box.className;
		var targetInformation = target.localName + '#' + target.id + '.' + target.className;
		var attributeInformation = '';
		if (aMutation.attributeName)
			 attributeInformation = ' / ' +
					aMutation.attributeName + ', ' +
					aMutation.oldValue + ' => ' +
					target.getAttribute(aMutation.attributeName);
		dump(aDescription + ' ' +
			ownerInformation + ' / ' +
			targetInformation +
			attributeInformation + '\n');
	},

	onAttributeModified : function BrowserUIShowHideObserver_onAttributeModified(aMutation, aObserver) 
	{
		var TST = this.owner.browser.treeStyleTab;
		if (this.handlingAttrChange ||
			TST.notifyingRenderedEvent)
			return;

		var target = aMutation.target;
		var state = this.serializeBoxState(target);
		if (target.__treestyletab_mutationObserver_lastState == state)
			return;

		if (
			// ignore modifications of each tab
			TST.getTabFromChild(target) ||
			utils.evaluateXPath(
				// ignore modifications in the location bar (ex. identity icon)
				'ancestor-or-self::xul:textbox |' +
				// or menu items
				'ancestor-or-self::xul:menupopup |' +
				// or scrollable indicator in the vertical tab bar
				'ancestor-or-self::xul:spacer[' +
					'contains(@class, "arrowscrollbox-overflow-start-indicator") or ' +
					'contains(@class, "arrowscrollbox-overflow-end-indicator")' +
				'][ancestor::xul:tabs[@' + TreeStyleTabConstants.kMODE + ' = "vertical"]]',
				target,
				Components.interfaces.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue
			)
			return;

		var tabbar = this.owner.browser.tabContainer;
		var placeHolder = TST.tabStripPlaceHolder;

		var tabbarVisibilityMismatching = false;
		{
			let toolbarVisible     = !TST.ownerToolbar.collapsed;
			let tabbarVisible      = tabbar.visible;
			let placeHolderVisible = !placeHolder.collapsed;
			tabbarVisibilityMismatching = (
				toolbarVisible != placeHolderVisible ||
				tabbarVisible  != placeHolderVisible
			);
		}

		var tabbarMatrixMismatching = false;
		{
			let tabbarBox         = tabbar.boxObject;
			let tabbarMatrix      = JSON.stringify({
				x: tabbarBox.screenX,
				y: tabbarBox.screenY,
				w: tabbarBox.width,
				h: tabbarBox.height
			});
			let placeHolderBox    = placeHolder.boxObject;
			let placeHolderMatrix = JSON.stringify({
				x: placeHolderBox.screenX,
				y: placeHolderBox.screenY,
				w: placeHolderBox.width,
				h: placeHolderBox.height
			});
			tabbarMatrixMismatching = tabbarMatrix != placeHolderMatrix;
		}

		if (
			// I must ignore show/hide of elements managed by TST,
			// to avoid infinity loop.
			utils.evaluateXPath(
				'ancestor-or-self::xul:*[@' + TreeStyleTabConstants.kTAB_STRIP_ELEMENT + '="true"]',
				target,
				Components.interfaces.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue &&
			// However, I have to synchronize visibility of the real
			// tab bar and the placeholder's one. If they have
			// different visibility, then the tab bar is shown or
			// hidden by "auto hide tab bar" feature of someone
			// (Pale Moon, Tab Mix Plus, etc.)
			!tabbarVisibilityMismatching &&
			!tabbarMatrixMismatching
			)
			return;

		this.dumpMutation(aMutation, 'BrowserUIShowHideObserver_onAttributeModified');

		this.handlingAttrChange = true;

		TST.updateFloatingTabbar(TreeStyleTabConstants.kTABBAR_UPDATE_BY_WINDOW_RESIZE);

		var w = this.box.ownerDocument.defaultView;
		w.setTimeout((function() {
			target.__treestyletab_mutationObserver_lastState = this.serializeBoxState(target);
			this.handlingAttrChange = false;
		}).bind(this), 10);
	},

	serializeBoxState : function BrowserUIShowHideObserver_serializeBoxState(aElement)
	{
		aElement = aElement || this.box;
		var box = aElement.boxObject || {}; // Some times there is no boxObject (ex. HTML element)
		return JSON.stringify({
			width  : box.width || 0,
			height : box.height || 0,
			hidden : Boolean(aElement.hidden),
			collapsed : Boolean(aElement.collapsed)
		});
	}
};
