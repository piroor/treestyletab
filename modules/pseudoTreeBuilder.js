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
 * Portions created by the Initial Developer are Copyright (C) 2011-2016
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

var EXPORTED_SYMBOLS = ['PseudoTreeBuilder'];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

XPCOMUtils.defineLazyModuleGetter(this, 'TreeStyleTabBase', 'resource://treestyletab-modules/base.js');

var PseudoTreeBuilder = {
	XHTMLNS : 'http://www.w3.org/1999/xhtml',

	kFAVICON      : 'treestyletab-pseudo-tree-favicon',
	kROOT         : 'treestyletab-pseudo-tree-root',
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
		tree.className = this.kROOT;

		var row = tree.querySelector('*|*.' + this.kTREEROW);
		if (!row)
			return;

		row.className += ' ' + this.kROOTITEM;

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

		var item = doc.createElementNS(this.XHTMLNS, 'div');
		item.setAttribute('class', this.kTREEITEM);

		var favicon = item.appendChild(doc.createElementNS(this.XHTMLNS, 'img'));
		favicon.setAttribute('src', aTab.getAttribute('image') || 'chrome://mozapps/skin/places/defaultFavicon.png');
		favicon.setAttribute('class', this.kFAVICON);

		var label = item.appendChild(doc.createElement('label'));
		label.setAttribute('flex', 1);
		label.textContent = aTab.label;
		var tooltip = aTab.label;
		var uri = aTab.linkedBrowser.currentURI.spec;
		if (w.isBlankPageURL ? !w.isBlankPageURL(uri) : (uri != 'about:blank')) tooltip += '\n' + uri;
		label.setAttribute('tooltiptext', tooltip);
		label.setAttribute('class', 'text-link');
		label.setAttribute('tab-id', TreeStyleTabBase.getTabValue(aTab, TreeStyleTabBase.kID));

		var row = doc.createElementNS(this.XHTMLNS, 'div');
		row.setAttribute('class', this.kTREEROW);
		row.appendChild(item);

		var children = this.createTabChildren(aTab);
		if (children) {
			let container = doc.createElementNS(this.XHTMLNS, 'div');
			container.appendChild(row);
			container.appendChild(children);
			return container;
		}
		else {
			return row;
		}
	},

	createTabChildren : function TB_createTabChildren(aTab)
	{
		var doc = aTab.ownerDocument;

		var children = TreeStyleTabBase.getChildTabs(aTab);
		if (!children.length)
			return null;

		var container = doc.createElementNS(this.XHTMLNS, 'div');
		container.setAttribute('class', this.kTREECHILDREN);
		for (let i = 0, maxi = children.length; i < maxi; i++)
		{
			container.appendChild(this.createTabItem(children[i]));
		}
		return container;
	},

	columnizeTree : function TB_columnizeTree(aTree, aContainerBox)
	{
		aContainerBox = aContainerBox || aTree.parentNode.boxObject;

		var style = aTree.style;
		var height = aTree.clientHeight * (aTree.columnCount || 1);
		if (height > aContainerBox.height &&
			aContainerBox.height < aContainerBox.width) {
			let maxWidth = aContainerBox.width;
			aTree.columnWidth = Math.floor(maxWidth * 0.9 / 2.5);
			let count = Math.ceil(
				(aTree.clientWidth * aTree.clientHeight) /
				(aTree.columnWidth * aTree.clientHeight)
			);
			aTree.columnCount = style.columnCount = style.MozColumnCount = count;
			style.columnWidth = style.MozColumnWidth = aTree.columnWidth+'px';
			style.columnGap = style.MozColumnGap = '0';
			style.columnFill = style.MozColumnFill = 'auto';

			aTree.ownerDocument.defaultView.setTimeout((function() {
				let columnCount = this.getActualColumnCount(aTree);
				aTree.columnCount = style.columnCount =
					style.MozColumnCount = columnCount;
			}).bind(this), 0);
		}
		else {
			aTree.columnCount = 1;
			style.columnCount = style.MozColumnCount =
				style.columnWidth = style.MozColumnWidth =
				style.columnGap = style.MozColumnGap =
				style.columnFill = style.MozColumnFill;
		}

		if (aTree.columnCount > 1) {
			style.height = style.maxHeight =
				Math.floor(aContainerBox.height * 0.9) + 'px';
		}
		else {
			style.height = style.maxHeight = '';
		}
	},
	getActualColumnCount : function TB_getActualColumnCount(aTree)
	{
		var rows = aTree.querySelectorAll('*|*.' + this.kTREEROW);
		if (rows.length <= 1)
			return 0;

		var firstWidth = rows[0].clientWidth;
		var lastWidth  = rows[rows.length - 1].clientWidth;

		// We have to see XUL box object's x instead of HTML element's clientLeft
		// to get actual position of elements in a multi-column box.
		var labels = aTree.querySelectorAll('label');
		var firstX = labels[0].boxObject.x;
		var lastX  = labels[labels.length - 1].boxObject.x;

		var totalWidth = lastX + lastWidth - firstX;
		return Math.floor(totalWidth / firstWidth);
	}
};
