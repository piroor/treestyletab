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
 * Portions created by the Initial Developer are Copyright (C) 2010-2011
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
 
const EXPORTED_SYMBOLS = ['TabpanelDNDObserver'];

const Cc = Components.classes;
const Ci = Components.interfaces;
 
function TabpanelDNDObserver(aTabBrowser) 
{
	this.init(aTabBrowser);
}

TabpanelDNDObserver.prototype = {
	
	getDropPosition : function TabpanelDND_getDropPosition(aEvent) 
	{
		var box = this.browser.boxObject;
		var W = box.width;
		var H = box.height;
		var X = box.screenX;
		var Y = box.screenY;
		var x = aEvent.screenX - X;
		var y = aEvent.screenY - Y;

		if (x > (W * 0.33) &&
			x < (W * 0.66) &&
			y > (H * 0.33) &&
			y < (H * 0.66))
			return 'center';

		var isTL = x <= W - (y * W / H);
		var isBL = x <= y * W / H;
		return (isTL && isBL) ? 'left' :
				(isTL && !isBL) ? 'top' :
				(!isTL && isBL) ? 'bottom' :
				'right' ;
	},
 
	canDrop : function TabpanelDND_canDrop(aEvent) 
	{
		var session = this.treeStyleTab.currentDragSession;
		return !!(
				session &&
				session.isDataFlavorSupported(this.treeStyleTab.kDRAG_TYPE_TABBAR) &&
				session.sourceNode &&
				session.sourceNode.ownerDocument == this.document
			);
	},
 
	handleEvent : function TabpanelDND_handleEvent(aEvent) 
	{
		// ignore drag and drop while toolbar customization (for Firefox 3.6)
		if (this.treeStyleTab.isToolbarCustomizing)
			return;

		switch (aEvent.type)
		{
			case 'dragleave': return this.onDragLeave(aEvent);
			case 'dragover':  return this.onDragOver(aEvent);
			case 'drop':      return this.onDrop(aEvent);
		}
	},
	
	onDragLeave : function TabpanelDND_onDragLeave(aEvent) 
	{
		if (!this.canDrop(aEvent)) return;
		var sv = this.treeStyleTab;
		if (this.browser.hasAttribute(sv.kDROP_POSITION))
			sv.setTabbrowserAttribute(sv.kDROP_POSITION, sv.kDROP_POSITION_UNKNOWN);
	},
 
	onDragOver : function TabpanelDND_onDragOver(aEvent) 
	{
		if (!this.canDrop(aEvent)) return;
		aEvent.preventDefault();
		var sv = this.treeStyleTab;
		sv.setTabbrowserAttribute(sv.kDROP_POSITION, this.getDropPosition(aEvent));
	},
 
	onDrop : function TabpanelDND_onDrop(aEvent) 
	{
		if (!this.canDrop(aEvent)) return;
		var sv = this.treeStyleTab;
		var dt = aEvent.dataTransfer;
		var position = this.getDropPosition(aEvent);
		if (position != 'center' &&
			position != sv.position) {
			if (sv.getTreePref('tabbar.fixed.autoCancelOnDrop') &&
				dt.getData(sv.kDRAG_TYPE_TABBAR) != sv.kTABBAR_MOVE_FORCE) {
				let orient = (position == 'left' || position == 'right') ? 'vertical' : 'horizontal' ;
				sv.setTreePref('tabbar.fixed.'+orient, false);
			}
			sv.setPrefForActiveWindow(function() {
				sv.utils.position = position;
				sv.position = position;
			});
		}

		aEvent.preventDefault();
		aEvent.stopPropagation();
	},
  
	init : function TabpanelDND_init(aTabBrowser) 
	{
		this.browser      = aTabBrowser;
		this.document     = aTabBrowser.ownerDocument;
		this.window       = this.document.defaultView;
		this.treeStyleTab = aTabBrowser.treeStyleTab;

		var b = this.treeStyleTab.mTabBrowser;
		b.mPanelContainer.addEventListener('dragover',  this, true);
		b.mPanelContainer.addEventListener('dragleave', this, true);
		b.mPanelContainer.addEventListener('drop',      this, true);
	},
 
	destroy : function TabpanelDND_destroy() 
	{
		var b = this.treeStyleTab.mTabBrowser;
		b.mPanelContainer.removeEventListener('dragover',  this, true);
		b.mPanelContainer.removeEventListener('dragleave', this, true);
		b.mPanelContainer.removeEventListener('drop',      this, true);

		delete this.treeStyleTab;
		delete this.browser;
		delete this.document;
		delete this.window;
	}
 
}; 
  
