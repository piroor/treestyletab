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
 * Portions created by the Initial Developer are Copyright (C) 2010-2015
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
 
var EXPORTED_SYMBOLS = ['TabpanelDNDObserver'];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
Components.utils.import('resource://treestyletab-modules/ReferenceCounter.js');

XPCOMUtils.defineLazyModuleGetter(this, 'utils', 'resource://treestyletab-modules/utils.js', 'TreeStyleTabUtils');

function log(...aArgs) {
	utils.log('tabpanelDNDObserver', ...aArgs);
}
function logWithStackTrace(...aArgs) {
	utils.logWithStackTrace('tabpanelDNDObserver', ...aArgs);
}


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
		var tabbar = aEvent.dataTransfer.mozGetDataAt(this.treeStyleTab.kDRAG_TYPE_TABBAR_NODE, 0);
		log('canDrop: ', {
			tabbar       : tabbar,
			sameDocument : this.document == (tabbar && tabbar.ownerDocument)
		});
		return !!(tabbar && tabbar.ownerDocument == this.document);
	},
 
	handleEvent : function TabpanelDND_handleEvent(aEvent) 
	{
		// ignore drag and drop while toolbar customization
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
		var canDrop = this.canDrop(aEvent);
		this.endWaitDrop();
		if (!canDrop)
			return;

		var sv = this.treeStyleTab;
		var dt = aEvent.dataTransfer;
		var position = this.getDropPosition(aEvent);
		if (position != 'center' &&
			position != sv.position) {
			if (utils.getTreePref('tabbar.fixed.autoCancelOnDrop') &&
				dt.getData(sv.kDRAG_TYPE_TABBAR) != sv.kTABBAR_MOVE_FORCE) {
				let orient = (position == 'left' || position == 'right') ? 'vertical' : 'horizontal' ;
				utils.setTreePref('tabbar.fixed.'+orient, false);
			}
			sv.position = position;
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
	},
 
	destroy : function TabpanelDND_destroy() 
	{
		this.endWaitDrop();
		delete this.treeStyleTab;
		delete this.browser;
		delete this.document;
		delete this.window;
	},

	startWaitDrop : function TabpanelDND_startWaitDrop()
	{
		log('startWaitDrop');
		if (this.waitingDrop)
			return;

		this.area = this.document.createElement('box');
		this.area.setAttribute('class', this.treeStyleTab.kTABBAR_DROP_AREA);
		this.document.documentElement.appendChild(this.area);
		var style = this.area.style;
		var box = this.browser.mPanelContainer.boxObject;
		style.left = box.x + 'px';
		style.top = box.y + 'px';
		style.width = box.width + 'px';
		style.height = box.height + 'px';

		this.area.addEventListener('dragover',  this, true);
		ReferenceCounter.add('this.area,dragover,this,true');
		this.area.addEventListener('dragleave', this, true);
		ReferenceCounter.add('this.area,dragleave,this,true');
		this.area.addEventListener('drop',      this, true);
		ReferenceCounter.add('this.area,drop,this,true');

		this.waitingDrop = true;
	},

	endWaitDrop : function TabpanelDND_endWaitDrop()
	{
		log('endWaitDrop');
		if (!this.waitingDrop)
			return;

		this.area.removeEventListener('dragover',  this, true);
		ReferenceCounter.remove('this.area,dragover,this,true');
		this.area.removeEventListener('dragleave', this, true);
		ReferenceCounter.remove('this.area,dragleave,this,true');
		this.area.removeEventListener('drop',      this, true);
		ReferenceCounter.remove('this.area,drop,this,true');

		this.area.parentNode.removeChild(this.area);
		delete this.area;

		this.waitingDrop = false;
	}
 
}; 
  
