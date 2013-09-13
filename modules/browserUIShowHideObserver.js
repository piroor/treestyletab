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
 * Portions created by the Initial Developer are Copyright (C) 2013
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
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

const EXPORTED_SYMBOLS = ['BrowserUIShowHideObserver']; 

function BrowserUIShowHideObserver(aOwner, aBox) {
	this.owner = aOwner;
	this.box = aBox;
	this.init();
}
BrowserUIShowHideObserver.prototype = {
	get MutationObserver()
	{
		var w = this.box.ownerDocument.defaultView;
		return w.MutationObserver || w.MozMutationObserver;
	},

	init : function BrowserUIShowHideObserver_onInit() 
	{
		if (!this.MutationObserver)
			return;
		var self = this;
		this.observer = new this.MutationObserver(function(aMutations, aObserver) {
			self.onMutationOnParent(aMutations, aObserver);
		});
		this.observer.observe(this.box, { childList : true, attributes : true });
		this.initChildrenObserver();
	},
	onMutationOnParent : function BrowserUIShowHideObserver_onMutationOnParent(aMutations, aObserver) 
	{
		aMutations.forEach(function(aMutation) {
			switch (aMutation.type)
			{
				case 'childList':
					this.destroyChildrenObserver();
					this.initChildrenObserver();
					return;

				case 'attributes':
					this.onAttributeModified(this.box, aMutations, aObserver);
					return;
			}
		}, this);
	},

	destroy : function BrowserUIShowHideObserver_destroy()
	{
		if (this.observer) {
			this.destroyChildrenObserver();
			this.observer.disconnect();
			delete this.observer;
		}
		delete this.box;
		delete this.owner;
	},

	initChildrenObserver : function BrowserUIShowHideObserver_initChildrenObserver(aParent) 
	{
		Array.forEach(this.box.childNodes, function(aChild) {
			var observer = aChild.__treestyletab__attributeObserver;
			if (observer)
				return;

			var self = this;
			observer = new this.MutationObserver(function(aMutations, aObserver) {
				self.onAttributeModified(aChild, aMutations, aObserver);
			});
			observer.observe(aChild, { attributes : true });
			aChild.__treestyletab__attributeObserver = observer;
		}, this)
	},
	onAttributeModified : function BrowserUIShowHideObserver_onAttributeModified(aTargetElement, aMutations, aObserver) 
	{
		// ignore show/hide of the tab bar itself, to avoid infinity loop.
		if (aTargetElement == this.owner.browser.treeStyleTab.ownerToolbar)
			return;
		aMutations.forEach(function(aMutation) {
			if (aMutation.type != 'attributes')
				return;
			if (aMutation.attributeName == 'hidden' ||
				aMutation.attributeName == 'collapsed' ||
				aMutation.attributeName == 'disablechrome')
				this.owner.browser.treeStyleTab.updateFloatingTabbar(this.owner.kTABBAR_UPDATE_BY_WINDOW_RESIZE);
		}, this);
	},
 
	destroyChildrenObserver : function BrowserUIShowHideObserver_destroyChildrenObserver(aParent) 
	{
		Array.forEach(this.box.childNodes, function(aChild) {
			var observer = aChild.__treestyletab__attributeObserver;
			if (!observer)
				return;

			observer.disconnect();
			delete aChild.__treestyletab__attributeObserver;
		}, this)
	}
};
