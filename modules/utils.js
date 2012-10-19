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
 * Portions created by the Initial Developer are Copyright (C) 2010-2012
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

"use strict";

let EXPORTED_SYMBOLS = ['TreeStyleTabUtils'];

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

XPCOMUtils.defineLazyGetter(this, 'window', function() {
	Components.utils.import('resource://treestyletab-modules/lib/namespace.jsm');
	return getNamespaceFor('piro.sakura.ne.jp');
});

XPCOMUtils.defineLazyGetter(this, 'prefs', function() {
	Components.utils.import('resource://treestyletab-modules/lib/prefs.js');
	return window['piro.sakura.ne.jp'].prefs;
});

const TST_PREF_PREFIX = 'extensions.treestyletab.';

let TreeStyleTabUtils = {

	get prefs () {
		delete this.prefs;
		return this.prefs = prefs;
	},

/* Save/Load Prefs */

	getTreePref : function TSTUtils_getTreePref(aPrefstring)
	{
		return prefs.getPref(TST_PREF_PREFIX + aPrefstring);
	},

	setTreePref : function TSTUtils_setTreePref(aPrefstring, aNewValue)
	{
		return prefs.setPref(TST_PREF_PREFIX + aPrefstring, aNewValue);
	},

	clearTreePref : function TSTUtils_clearTreePref(aPrefstring)
	{
		return prefs.clearPref(TST_PREF_PREFIX + aPrefstring);
	},

};
