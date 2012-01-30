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

const EXPORTED_SYMBOLS = ['PseudoTreeBuilder'];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://treestyletab-modules/utils.js');

var PseudoTreeBuilder = {
	__proto__ : TreeStyleTabUtils,

	kFAVICON      : 'treestyletab-pseudo-tree-favicon',
	kROOTITEM     : 'treestyletab-pseudo-tree-root-item',
	kTREEITEM     : 'treestyletab-pseudo-tree-item',
	kTREEROW      : 'treestyletab-pseudo-tree-row',
	kTREECHILDREN : 'treestyletab-pseudo-tree-children',

	kTAB_LINK_CLICK : 'nsDOMTSTPseudoTreeItemClick',

	build : function TB_build(aTab) 
	{
		if (!aTab)
			return null;

		var tree = this.createTabItem(aTab);

		var row = tree.querySelector("."+this.kTREEROW);
		if (!row)
			return;

		row.className += " "+this.kROOTITEM;

		tree.setAttribute('onclick', <![CDATA[
			var doc = event.target.ownerDocument;
			var label = doc.evaluate(
					'ancestor-or-self::*[local-name()="label" and contains(@class, "text-link")][1]',
					event.target,
					null,
					Components.interfaces.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE,
					null
				).singleNodeValue;
			if (label) {
				var customEvent = doc.createEvent('DataContainerEvent');
				customEvent.initEvent(%EVENT_TYPE%, true, true);
				customEvent.setData('id', label.getAttribute('tab-id'));
				customEvent.setData('sourceEvent', event);
				event.target.dispatchEvent(customEvent);
			}
		]]>.toString().replace('%EVENT_TYPE%', this.kTAB_LINK_CLICK.quote()));

		return tree;
	},

	createTabItem : function TB_createTabItem(aTab)
	{
		var doc = aTab.ownerDocument;
		var w = doc.defaultView;

		var item = doc.createElement('hbox');
		item.setAttribute('class', this.kTREEROW);

		var favicon = item.appendChild(doc.createElement('image'));
		favicon.setAttribute('src', aTab.getAttribute('image') || 'chrome://mozapps/skin/places/defaultFavicon.png');
		favicon.setAttribute('class', this.kFAVICON);

		var label = item.appendChild(doc.createElement('label'));
		label.setAttribute('value', aTab.label);
		var tooltip = aTab.label;
		var uri = aTab.linkedBrowser.currentURI.spec;
		if (w.isBlankPageURL ? !w.isBlankPageURL(uri) : (uri != 'about:blank')) tooltip += '\n' + uri;
		label.setAttribute('tooltiptext', tooltip);
		label.setAttribute('class', 'text-link '+this.kTREEITEM);
		label.setAttribute('tab-id', this.getTabValue(aTab, this.kID));

		var children = this.createTabChildren(aTab);
		if (children) {
			let container = doc.createElement('vbox');
			container.appendChild(item);
			container.appendChild(children);
			return container;
		}
		else {
			return item;
		}
	},

	createTabChildren : function TB_createTabChildren(aTab)
	{
		var doc = aTab.ownerDocument;

		var children = this.getChildTabs(aTab);
		if (!children.length)
			return null;

		var container = doc.createElement('vbox');
		children.forEach(function(aChild) {
			container.appendChild(this.createTabItem(aChild));
		}, this);
		container.setAttribute('class', this.kTREECHILDREN);
		return container;
	}
};
