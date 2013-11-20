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
 * Portions created by the Initial Developer are Copyright (C) 2010-2013
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

const EXPORTED_SYMBOLS = ['GroupTab']; 

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://treestyletab-modules/base.js');
Components.utils.import('resource://treestyletab-modules/pseudoTreeBuilder.js');

function GroupTab(aWindow)
{
	this.window = aWindow;
	this.init();
}

GroupTab.prototype = {
	__proto__ : TreeStyleTabBase,

	initialized : false,
	shouldUpdate : false,

	window : null,
	get document()
	{
		return this.window && this.window.document;
	},
	get location()
	{
		return this.window && this.window.location;
	},
	get locationSearch()
	{
		return this.location.href.replace(/^[^\?]+/, '');
	},

	get label()
	{
		return this.document.getElementById('label');
	},
	get editor()
	{
		return this.document.getElementById('editor');
	},
	get deck()
	{
		return this.document.getElementById('deck');
	},
	get temporaryCheck()
	{
		return this.document.getElementById('temporary');
	},

	get title()
	{
		if (this._title === null) {
			let locationSearch = this.locationSearch;
			let title = locationSearch.match(/(?:^|[\?&;])title=([^&;]*)/i);
			if (title)
				title = title[1];
			// for old style URIs
			if (!title && !/(?:^|[\?&;])temporary=/i.test(locationSearch))
				title = locationSearch.replace(/^\?/, '');
			this._title = (title) ?
							this.trim(decodeURIComponent(title)) :
							'' ;
		}
		return this._title;
	},
	set title(aValue) {
		this._title = aValue;
		this.document.title = this.label.value = aValue;
		this.label.setAttribute('tooltiptext', aValue);
		this.document.documentElement.setAttribute('title', aValue);
		this._updateURI();
		return aValue;
	},
	_title : null,

	get temporary() {
		return /(?:^|[\?&;])temporary=(?:1|yes|true)/i.test(this.locationSearch);
	},
	set temporary(aValue) {
		aValue = !!aValue;
		this._updateURI({ temporary: aValue });
		this.temporaryCheck.checked = aValue;
		return aValue;
	},

	_updateURI : function GT_updateURI(aOptions) {
		aOptions = aOptions || {};
		var temporary = this.temporary;
		if ('temporary' in aOptions)
			temporary = aOptions.temporary;
		this.location.replace(
			this.location.href.split('?')[0] + '?' +
			'title=' + encodeURIComponent(this.title) + '&' +
			'temporary=' + temporary
		);
	},

	get browser()
	{
		var ownerWindow = this.window
						.QueryInterface(Ci.nsIInterfaceRequestor)
						.getInterface(Ci.nsIWebNavigation)
						.QueryInterface(Ci.nsIDocShell)
						.QueryInterface(Ci.nsIDocShellTreeItem)
						.parent;
		if (ownerWindow) {
			ownerWindow = ownerWindow
							.QueryInterface(Ci.nsIWebNavigation)
							.document
							.defaultView;
			return ownerWindow.gBrowser;
		}
		return null;
	},

	getOwnerTab : function GT_getOwnerTab(aWindow)
	{
		var b = this.browser;
		return b &&
				b.treeStyleTab &&
				b.treeStyleTab.getTabFromFrame(aWindow || this.window);
	},


	init : function GT_init()
	{
		var title = this.title;
		if (title) {
			this.document.title = title;
			this.document.documentElement.setAttribute('title', title);
			this.label.value = title;
			this.label.setAttribute('tooltiptext', title);
			this.editor.value = title;
		}

		this.temporaryCheck.checked = this.temporary;

		this.window.addEventListener('load', this, false);

		this.window.groupTab = this;
	},


	trim : function GT_trim(aString)
	{
		return aString.replace(/^\s+|\s+$/g, '');
	},

	getTabById : function GT_getTabById(aId)
	{
		var b = this.browser;
		if (aId && b)
			return b.treeStyleTab.getTabById(aId);
		return null;
	},


	enterEdit : function GT_enterEdit()
	{
		if (this.deck.selectedIndex == 1) return;

		this.editor.value = this.label.value;
		this.deck.selectedIndex = 1;
		this.editor.focus();
		this.editor.select();
	},

	exitEdit : function GT_exitEdit()
	{
		if (this.deck.selectedIndex == 0) return;

		var old = this.trim(this.label.value);
		var value = this.trim(this.editor.value);

		if (value != old)
			this.title = value;

		this.editor.blur();
		this.deck.selectedIndex = 0;
	},


	updateTree : function GT_updateTree()
	{
		if (!this.window || this.window.closed)
			return;

		var tree = this.document.getElementById('tree');

		var range = this.document.createRange();
		range.selectNodeContents(tree);
		range.deleteContents();
		range.detach();

		var contents = PseudoTreeBuilder.build(this.getOwnerTab());
		if (contents)
			tree.appendChild(contents);
	},

	checkUpdateTreeNow : function GT_checkUpdateTreeNow()
	{
		if (this.getOwnerTab().selected)
			this.window.setTimeout(function(aSelf) {
				if (aSelf.window && !aSelf.window.closed)
					aSelf.onTabSelect();
			}, 0, this);
	},


	handleEvent : function GT_handleEvent(aEvent)
	{
		switch (aEvent.type)
		{
			case 'load':
				if (aEvent.currentTarget == this.window)
					this.onLoad(aEvent);
				else
					this.onDocumentModified(aEvent);
				return;

			case 'unload':
			case 'TabClose':
				return this.onUnload(aEvent);

			case 'click':
				return this.onClick(aEvent);
			case 'dblclick':
				return this.onDblClick(aEvent);
			case 'keypress':
				return this.onKeyPress(aEvent);

			case PseudoTreeBuilder.kTAB_LINK_CLICK:
				return this.onItemClick(aEvent);

			case 'TabSelect':
				return this.onTabSelect(aEvent);

			case this.kEVENT_TYPE_ATTACHED:
				return this.onTabAttached(aEvent);
			case this.kEVENT_TYPE_DETACHED:
				return this.onTabDetached(aEvent);

			case 'DOMTitleChanged':
				return this.onDocumentModified(aEvent);
		}
	},

	onLoad : function GT_onLoad(aEvent)
	{
		this.window.removeEventListener('load', this, false);

		if (this.initialized)
			return;

		var tab = this.getOwnerTab();

		this.updateTree();

		this.window.addEventListener('unload', this, false);
		this.window.addEventListener('click', this, false);
		this.window.addEventListener('dblclick', this, false);

		tab.addEventListener('TabSelect', this, false);
		tab.addEventListener('TabClose', this, false);
		tab.parentNode.addEventListener(this.kEVENT_TYPE_ATTACHED, this, false);
		tab.parentNode.addEventListener(this.kEVENT_TYPE_DETACHED, this, false);

		var b = this.browser;
		b.addEventListener('load', this, true);
		b.addEventListener('DOMTitleChanged', this, true);

		this.editor.addEventListener('keypress', this, false);

		this.document.getElementById('tree')
			.addEventListener(PseudoTreeBuilder.kTAB_LINK_CLICK, this, false);

		this.initialized = true;
	},

	onUnload : function GT_onUnload(aEvent)
	{
		var tab = this.getOwnerTab();
		if (!this.initialized || !tab)
			return;

		this.window.removeEventListener('unload', this, false);
		this.window.removeEventListener('click', this, false);
		this.window.removeEventListener('dblclick', this, false);

		tab.removeEventListener('TabSelect', this, false);
		tab.removeEventListener('TabClose', this, false);
		tab.parentNode.removeEventListener(this.kEVENT_TYPE_ATTACHED, this, false);
		tab.parentNode.removeEventListener(this.kEVENT_TYPE_DETACHED, this, false);

		var b = this.browser;
		b.removeEventListener('load', this, true);
		b.removeEventListener('DOMTitleChanged', this, true);

		this.editor.removeEventListener('keypress', this, false);

		this.document.getElementById('tree')
			.removeEventListener(PseudoTreeBuilder.kTAB_LINK_CLICK, this, false);

		delete this.window.groupTab;
		delete this.window;
	},

	onClick : function GT_onClick(aEvent)
	{
		if (aEvent.target == this.editor) return;
		if (aEvent.target == this.label)
			this.enterEdit();
		else
			this.exitEdit();
	},

	onDblClick : function GT_onDblClick(aEvent)
	{
		if (aEvent.target == this.editor) return;
		if (this.deck.selectedIndex == 0)
			this.enterEdit();
		else
			this.exitEdit();
	},

	onKeyPress : function GT_onKeyPress(aEvent)
	{
		if (aEvent.keyCode == aEvent.DOM_VK_ENTER ||
			aEvent.keyCode == aEvent.DOM_VK_RETURN ||
			aEvent.keyCode == aEvent.DOM_VK_ESCAPE)
			this.exitEdit();
	},

	onItemClick : function GT_onItemClick(aEvent)
	{
		var b = this.browser;
		if (!b)
			return;

		var tab = this.getTabById(aEvent.getData('id'));
		if (!tab)
			return;

		var event = aEvent.getData('sourceEvent');
		if (event.button == 1 ||
			(event.button == 0 && this.isAccelKeyPressed(event)))
			b.removeTab(tab);
		else if (event.button != 2)
			b.selectedTab = tab;
	},

	onTabSelect : function GT_onTabSelect(aEvent)
	{
		if (this.shouldUpdate)
			this.updateTree();

		this.shouldUpdate = false;
	},

	onTabAttached : function GT_onTabAttached(aEvent)
	{
		var tab = aEvent.getData('parentTab');
		var id = tab.getAttribute(this.kID);
		if (tab == this.getOwnerTab() ||
			this.document.getElementsByAttribute('tab-id', id).length)
			this.shouldUpdate = true;

		this.checkUpdateTreeNow();
	},

	onTabDetached : function GT_onTabDetached(aEvent)
	{
		var tab = aEvent.originalTarget;
		var id = tab.getAttribute(this.kID);
		if (this.document.getElementsByAttribute('tab-id', id).length)
			this.shouldUpdate = true;

		this.checkUpdateTreeNow();
	},

	onDocumentModified : function GT_onDocumentModified(aEvent)
	{
		var tab = this.getOwnerTab(aEvent.target.defaultView.top);
		if (tab) {
			let id = tab.getAttribute(this.kID);
			if (this.document.getElementsByAttribute('tab-id', id).length)
				this.shouldUpdate = true;
		}

		this.checkUpdateTreeNow();
	}
};
