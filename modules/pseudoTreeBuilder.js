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

const EXPORTED_SYMBOLS = ['PseudoTreeBuilder'];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

XPCOMUtils.defineLazyModuleGetter(this, 'TreeStyleTabBase', 'resource://treestyletab-modules/base.js');

var PseudoTreeBuilder = {

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

		tree.setAttribute('onclick', 
			('var doc = event.target.ownerDocument;\n' +
			'var label = doc.evaluate(\n' +
			'    "ancestor-or-self::*[local-name()=\'label\' and contains(@class, \'text-link\')][1]",\n' +
			'    event.target,\n' +
			'    null,\n' +
			'    Components.interfaces.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE,\n' +
			'    null\n' +
			'  ).singleNodeValue;\n' +
			'if (label) {\n' +
			'  var customEvent = new doc.defaultView.CustomEvent(%EVENT_TYPE%, {\n' +
			'      bubbles    : true,\n' +
			'      cancelable : true,\n' +
			'      detail     : {\n' +
			'        id          : label.getAttribute("tab-id"),\n' +
			'        sourceEvent : event\n' +
			'      }\n' +
			'    });\n' +
			'  event.target.dispatchEvent(customEvent);\n' +
			'}').replace('%EVENT_TYPE%', JSON.stringify(this.kTAB_LINK_CLICK)));

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
		label.setAttribute('tab-id', TreeStyleTabBase.getTabValue(aTab, TreeStyleTabBase.kID));

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

		var children = TreeStyleTabBase.getChildTabs(aTab);
		if (!children.length)
			return null;

		var container = doc.createElement('vbox');
		for (let i = 0, maxi = children.length; i < maxi; i++)
		{
			container.appendChild(this.createTabItem(children[i]));
		}
		container.setAttribute('class', this.kTREECHILDREN);
		return container;
	}
};
