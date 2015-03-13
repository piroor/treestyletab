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
 * Portions created by the Initial Developer are Copyright (C) 2014
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
 
const EXPORTED_SYMBOLS = ['ContentBridge']; 

const DEBUG = false;

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://treestyletab-modules/lib/inherit.jsm');
Cu.import('resource://treestyletab-modules/constants.js');
Cu.import('resource://gre/modules/Promise.jsm');

function ContentBridge(aTab, aTabBrowser) 
{
	this.init(aTab, aTabBrowser);
}

ContentBridge.install = function CB_installScript(aWindow) {
	aWindow.messageManager.loadFrameScript(TreeStyleTabConstants.CONTENT_SCRIPT_AUTOHIDE, true);
};

ContentBridge.uninstall = function CB_installScript(aWindow) {
	aWindow.messageManager.sendAsyncCommand(TreeStyleTabConstants.COMMAND_SHUTDOWN);
};
 
ContentBridge.prototype = inherit(TreeStyleTabConstants, { 
	mTab : null,
	mTabBrowser : null,

	init : function CB_init(aTab, aTabBrowser)
	{
		this.mTab = aTab;
		this.mTabBrowser = aTabBrowser;
		this.handleMessage = this.handleMessage.bind(this);
		this.checkPluginAreaExistenceResolvers = {};

		var manager = this.mTab.ownerDocument.defaultView.messageManager;
		manager.addMessageListener(this.MESSAGE_TYPE, this.handleMessage);
	},
	destroy : function CB_destroy()
	{
		var manager = this.mTab.ownerDocument.defaultView.messageManager;
		manager.removeMessageListener(this.MESSAGE_TYPE, this.handleMessage);

		delete this.mTab;
		delete this.mTabBrowser;
		delete this.checkPluginAreaExistenceResolvers;
	},
	sendAsyncCommand : function CB_sendAsyncCommand(aCommandType, aCommandParams)
	{
		var manager = this.mTab.linkedBrowser.messageManager;
		manager.sendAsyncMessage(this.MESSAGE_TYPE, {
			command : aCommandType,
			params  : aCommandParams || {}
		});
	},
	checkPluginAreaExistence : function CB_checkPluginAreaExistence()
	{
		return new Promise((function(aResolve, aReject) {
			var id = Date.now() + '-' + Math.floor(Math.random() * 65000);
			this.sendAsyncCommand(this.COMMAND_REQUEST_PLUGIN_AREA_EXISTENCE, {
				id : id
			});
			return this.checkPluginAreaExistenceResolvers[id] = aResolve;
		}).bind(this));
	},
	handleMessage : function CB_handleMessage(aMessage)
	{
//		dump('*********************handleMessage*******************\n');
//		dump('TARGET IS: '+aMessage.target.localName+'\n');
//		dump(JSON.stringify(aMessage.json)+'\n');

		if (aMessage.target != this.mTab.linkedBrowser)
		  return;

		switch (aMessage.json.command)
		{
			case this.COMMAND_REPORT_MOUSEDOWN:
				{
					let fakeEvent = this.fixupEventCoordinates(aMessage.json.event);
					this.mTabBrowser.treeStyleTab.autoHide.onMouseDown(fakeEvent);
				}
				return;

			case this.COMMAND_REPORT_MOUSEUP:
				{
					let fakeEvent = this.fixupEventCoordinates(aMessage.json.event);
					this.mTabBrowser.treeStyleTab.autoHide.onMouseUp(fakeEvent);
				}
				return;

			case this.COMMAND_REPORT_MOUSEMOVE:
				{
					let fakeEvent = this.fixupEventCoordinates(aMessage.json.event);
					this.mTabBrowser.treeStyleTab.autoHide.handleMouseMove(fakeEvent);
				}
				return;

			case this.COMMAND_REPORT_PLUGIN_AREA_EXISTENCE:
				var id = aMessage.json.id;
				if (id in this.checkPluginAreaExistenceResolvers) {
					let resolver = this.checkPluginAreaExistenceResolvers[id];
					delete this.checkPluginAreaExistenceResolvers[id];
					resolver(aMessage.json.existence);
				}
				return;
		}
	},
	fixupEventCoordinates : function CB_fixupEventCoordinates(aCoordinates)
	{
		// On Firefox 36 and later, screenX/screenY from out-of-process
		// content frame is wrong, so we have to calculate correct
		// screen coordinates manually via the utility method.
		// This hack should be removed after the bug
		// https://bugzilla.mozilla.org/show_bug.cgi?id=1075670
		// is fixed.
		if (typeof this.mTab.linkedBrowser.mapScreenCoordinatesFromContent == 'function') {
			let fixedCoordinates = this.mTab.linkedBrowser.mapScreenCoordinatesFromContent(aCoordinates.screenX, aCoordinates.screenY);
			aCoordinates.screenX = fixedCoordinates.x;
			aCoordinates.screenY = fixedCoordinates.y;
		}
		return aCoordinates;
	}
}); 
 
