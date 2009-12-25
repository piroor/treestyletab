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
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): SHIMODA Hiroshi <piro@p.club.ne.jp>
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
 
var EXPORTED_SYMBOLS = ['TreeStyleTabUtils']; 
 
var TreeStyleTabUtils = { 
	
	init : function TSTUtils_init() 
	{
		if (this._initialized) return;

		this.addPrefListener(this);
		this._tabbarPositionHistory.push(this.currentTabbarPosition);
	},
	_initialized : false,
 
// tabbar position 
	
	get currentTabbarPosition() /* PUBLIC API */ 
	{
		return this.getTreePref('tabbar.position') || 'top';
	},
	set currentTabbarPosition(aValue)
	{
		var position = String(aValue);
		if (!position || !/^(top|bottom|left|right)$/i.test(position))
			position = 'top';

		position = position.toLowerCase();
		this.setTreePref('tabbar.position', position);

		return aValue;
	},
 
	rollbackTabbarPosition : function TSTUtils_rollbackTabbarPosition() /* PUBLIC API */ 
	{
		if (!this._tabbarPositionHistory.length)
			return false;

		this._inRollbackTabbarPosition = true;
		this.currentTabbarPosition = this._tabbarPositionHistory.pop();
		this._inRollbackTabbarPosition = false;

		return true;
	},
 
	onChangeTabbarPosition : function TSTUtils_onChangeTabbarPosition(aPosition) 
	{
		if (this._inRollbackTabbarPosition) return;
		this._tabbarPositionHistory.push(aPosition);
	},
 
	_tabbarPositionHistory : [], 
  
// pref listener 
	
	domains : [ 
		'extensions.treestyletab.tabbar.position'
	],
 
	observe : function TSTUtils_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onPrefChange(aData);
				return;
		}
	},
 
	onPrefChange : function TSTUtils_onPrefChange(aPrefName) 
	{
		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.treestyletab.tabbar.position':
				this.onChangeTabbarPosition(value);
				break;

			default:
				break;
		}
	},
  
/* Save/Load Prefs */ 
	
	getTreePref : function TSTUtils_getTreePref(aPrefstring) 
	{
		return this.getPref('extensions.treestyletab.'+aPrefstring);
	},
 
	setTreePref : function TSTUtils_setTreePref(aPrefstring, aNewValue) 
	{
		return this.setPref('extensions.treestyletab.'+aPrefstring, aNewValue);
	},
 
	clearTreePref : function TSTUtils_clearTreePref(aPrefstring) 
	{
		return this.clearPref('extensions.treestyletab.'+aPrefstring);
	}
  
}; 
 
Components.utils.import('resource://treestyletab-modules/prefs.js'); 
TreeStyleTabUtils.__proto__ = window['piro.sakura.ne.jp'].prefs;
  
