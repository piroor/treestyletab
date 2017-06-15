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
 * Portions created by the Initial Developer are Copyright (C) 2016
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

var EXPORTED_SYMBOLS = ['TabContentsObserver']; 

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

Components.utils.import('resource://treestyletab-modules/constants.js');

XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');

function log(...aArgs) {
	utils.log('tabContentsObserver', ...aArgs);
}
function logWithStackTrace(...aArgs) {
	utils.logWithStackTrace('tabContentsObserver', ...aArgs);
}

function TabContentsObserver(aOwner, aBox, aOptions) {
	this.owner = aOwner;
	this.box = aBox;
	this.init(aOptions);
}
TabContentsObserver.prototype = {
	get MutationObserver()
	{
		var w = this.box.ownerDocument.defaultView;
		return w.MutationObserver || w.MozMutationObserver;
	},

	init : function TabContentsObserver_onInit(aOptions) 
	{
		if (!this.MutationObserver)
			return;
		this.observer = new this.MutationObserver((function(aMutations, aObserver) {
			this.onMutation(aMutations, aObserver);
		}).bind(this));
		var options = {
			childList  : true,
			attributes : false,
			subtree    : true
		};
		if (aOptions) {
			Object.keys(options).forEach(function(aKey) {
				if (aKey in aOptions)
					options[aKey] = aOptions[aKey];
			});
		}
		this.observer.observe(this.box, options);
	},
	onMutation : function TabContentsObserver_onMutation(aMutations, aObserver) 
	{
		aMutations.forEach(function(aMutation) {
			try {
				switch (aMutation.type)
				{
					case 'childList':
						this.onTabContentsModified(aMutation, aObserver);
						return;
				}
			}
			catch(error) {
				this.logMutation(aMutation, 'onMutation(error)');
				Components.utils.reportError(error);
			}
		}, this);
	},

	destroy : function TabContentsObserver_destroy()
	{
		if (this.observer) {
			this.observer.disconnect();
			delete this.observer;
		}
		delete this.box;
		delete this.owner;
	},

	onTabContentsModified : function TabContentsObserver_onTabContentsModified(aMutation, aObserver) 
	{
		var TST = this.owner.browser.treeStyleTab;
		if (this.handlingChange ||
			TST.notifyingRenderedEvent)
			return;

		var target = aMutation.target;
		var tab = TST.getTabFromChild(target);
		if (!tab)
			return;

		// ignore changes in <xul:label/>
		if (
			[...aMutation.addedNodes].every(function(aNode) {
				return (
					aNode.nodeType == aNode.TEXT_NODE &&
					aNode.parentNode.localName == 'label'
				);
			}) ||
			(
				target.localName == 'label' &&
				[...aMutation.removedNodes].every(function(aNode) {
					return aNode.nodeType == aNode.TEXT_NODE;
				})
			)
			)
			return;

		log('onTabContentsModified on the tab '+tab._tPos);

		this.handlingChange = true;

		TST.initTabContentsOrder(tab, true);

		var w = this.box.ownerDocument.defaultView;
		w.setTimeout((function() {
			this.handlingChange = false;
		}).bind(this), 10);
	},

	logMutation : function TabContentsObserver_logMutation(aMutation, aDescription)
	{
		if (!utils.isDebugging('tabContentsObserver'))
			return;

		var target = aMutation.target;
		var ownerInformation = this.box.localName + '#' + this.box.id + '.' + this.box.className;
		var targetInformation = target ? target.localName + '#' + target.id + '.' + target.className : '(null)' ;
		var addedInformation = '';
		if (aMutation.addedNodes.length)
			 addedInformation = ' added[' + [...aMutation.addedNodes] + ']';
		var removedInformation = '';
		if (aMutation.removedNodes.length)
			 removedInformation = ' added[' + [...aMutation.removedNodes] + ']';
		log(aDescription + ' ' +
			ownerInformation + ' / ' +
			targetInformation +
			addedInformation +
			removedInformation);
	}
};
