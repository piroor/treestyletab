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

function ContentBridge(aTab, aTabBrowser) 
{
	this.init(aTab, aTabBrowser);
}
 
ContentBridge.prototype = inherit(TreeStyleTabConstants, { 
	mTab : null,
	mTabBrowser : null,

	init : function CB_init(aTab, aTabBrowser)
	{
		this.mTab = aTab;
		this.mTabBrowser = aTabBrowser;
		this.handleMessage = this.handleMessage.bind(this);

		var manager = this.mTab.linkedBrowser.messageManager;
		// manager.loadFrameScript(this.CONTENT_SCRIPT, true);
		manager.loadFrameScript(this.CONTENT_SCRIPT_AUTOHIDE, true);
		manager.addMessageListener(this.MESSAGE_TYPE, this.handleMessage);
	},
	destroy : function CB_destroy()
	{
		var manager = this.mTab.linkedBrowser.messageManager;
		manager.removeMessageListener(this.MESSAGE_TYPE, this.handleMessage);
		this.sendAsyncCommand(this.COMMAND_SHUTDOWN);

		delete this.mTab;
		delete this.mTabBrowser;
	},
	sendAsyncCommand : function CB_sendAsyncCommand(aCommandType, aCommandParams)
	{
		var manager = this.mTab.linkedBrowser.messageManager;
		manager.sendAsyncMessage(this.MESSAGE_TYPE, {
			command : aCommandType,
			params  : aCommandParams || {}
		});
	},
	handleMessage : function CB_handleMessage(aMessage)
	{
		// dump(JSON.stringify(aMessage.json)+'\n');
		switch (aMessage.json.command)
		{
			case this.COMMAND_REPORT_MOUSEDOWN:
				let (fakeEvent = this.fixupEventCoordinates(aMessage.json.event)) {
					this.mTabBrowser.treeStyleTab.autoHide.onMouseDown(fakeEvent);
				}
				return;

			case this.COMMAND_REPORT_MOUSEUP:
				let (fakeEvent = this.fixupEventCoordinates(aMessage.json.event)) {
					this.mTabBrowser.treeStyleTab.autoHide.onMouseUp(fakeEvent);
				}
				return;

			case this.COMMAND_REPORT_MOUSEMOVE:
				let (fakeEvent = this.fixupEventCoordinates(aMessage.json.event)) {
					this.mTabBrowser.treeStyleTab.autoHide.handleMouseMove(fakeEvent);
				}
				return;
		}
	},
	fixupEventCoordinates : function CB_fixupEventCoordinates(aCoordinates)
	{
		var box = this.mTab.linkedBrowser.boxObject;
		aCoordinates.screenX += box.screenX;
		aCoordinates.screenY += box.screenY;
		return aCoordinates;
	}
}); 
 
