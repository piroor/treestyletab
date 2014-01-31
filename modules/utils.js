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
 * Portions created by the Initial Developer are Copyright (C) 2010-2014
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

"use strict";

let EXPORTED_SYMBOLS = ['TreeStyleTabUtils'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://treestyletab-modules/constants.js');

XPCOMUtils.defineLazyGetter(this, 'window', function() {
	Cu.import('resource://treestyletab-modules/lib/namespace.jsm');
	return getNamespaceFor('piro.sakura.ne.jp');
});
XPCOMUtils.defineLazyGetter(this, 'prefs', function() {
	Cu.import('resource://treestyletab-modules/lib/prefs.js');
	return window['piro.sakura.ne.jp'].prefs;
});
XPCOMUtils.defineLazyGetter(this, 'stringBundle', function() {
	Cu.import('resource://treestyletab-modules/lib/stringBundle.js', {});
	return window['piro.sakura.ne.jp'].stringBundle;
});

XPCOMUtils.defineLazyModuleGetter(this, 'Task',
	'resource://gre/modules/Task.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'TreeStyleTabConstants',
  'resource://treestyletab-modules/constants.js', 'TreeStyleTabConstants');

const TST_PREF_PREFIX = 'extensions.treestyletab.';
const TST_PREF_VERSION = 10;


let TreeStyleTabUtils = {

	get prefs () {
		return prefs;
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

	migratePrefs : function utils_migratePrefs()
	{
		// migrate old prefs
		var orientalPrefs = [];
		switch (this.getTreePref('prefsVersion'))
		{
			case 0:
				orientalPrefs = orientalPrefs.concat([
					'extensions.treestyletab.tabbar.fixed',
					'extensions.treestyletab.enableSubtreeIndent',
					'extensions.treestyletab.allowSubtreeCollapseExpand'
				]);
			case 1:
			case 2:
				if (this.getTreePref('urlbar.loadSameDomainToNewChildTab') !== null) {
					let value = this.getTreePref('urlbar.loadSameDomainToNewChildTab');
					this.setTreePref('urlbar.loadSameDomainToNewTab', value);
					this.setTreePref('urlbar.loadSameDomainToNewTab.asChild', value);
					if (value) {
						this.setTreePref('urlbar.loadDifferentDomainToNewTab', value);
					}
					this.clearTreePref('urlbar.loadSameDomainToNewChildTab');
				}
			case 3:
				if (this.getTreePref('loadDroppedLinkToNewChildTab') !== null) {
					this.setTreePref('dropLinksOnTab.behavior',
						this.getTreePref('loadDroppedLinkToNewChildTab.confirm') ?
							TreeStyleTabConstants.kDROPLINK_ASK :
						this.getTreePref('loadDroppedLinkToNewChildTab') ?
							TreeStyleTabConstants.kDROPLINK_NEWTAB :
							TreeStyleTabConstants.kDROPLINK_LOAD
					);
					this.clearTreePref('loadDroppedLinkToNewChildTab.confirm');
					this.clearTreePref('loadDroppedLinkToNewChildTab');
				}
				if (this.getTreePref('openGroupBookmarkAsTabSubTree') !== null) {
					let behavior = 0;
					if (this.getTreePref('openGroupBookmarkAsTabSubTree.underParent'))
						behavior += TreeStyleTabConstants.kGROUP_BOOKMARK_USE_DUMMY;
					if (!this.getTreePref('openGroupBookmarkBehavior.confirm')) {
						behavior += (
							this.getTreePref('openGroupBookmarkAsTabSubTree') ?
								TreeStyleTabConstants.kGROUP_BOOKMARK_SUBTREE :
								TreeStyleTabConstants.kGROUP_BOOKMARK_SEPARATE
						);
					}
					this.setTreePref('openGroupBookmark.behavior', behavior);
					this.clearTreePref('openGroupBookmarkBehavior.confirm');
					this.clearTreePref('openGroupBookmarkAsTabSubTree');
					this.clearTreePref('openGroupBookmarkAsTabSubTree.underParent');
				}
			case 4:
				let (subTreePrefs = [
						'extensions.treestyletab.autoCollapseExpandSubTreeOnSelect',
						'extensions.treestyletab.autoCollapseExpandSubTreeOnSelect.onCurrentTabRemove',
						'extensions.treestyletab.autoCollapseExpandSubTreeOnSelect.whileFocusMovingByShortcut',
						'extensions.treestyletab.autoExpandSubTreeOnAppendChild',
						'extensions.treestyletab.autoExpandSubTreeOnCollapsedChildFocused',
						'extensions.treestyletab.collapseExpandSubTree.dblclick',
						'extensions.treestyletab.createSubTree.underParent',
						'extensions.treestyletab.show.context-item-reloadTabSubTree',
						'extensions.treestyletab.show.context-item-removeTabSubTree',
						'extensions.treestyletab.show.context-item-bookmarkTabSubTree',
						'extensions.multipletab.show.multipletab-selection-item-removeTabSubTree',
						'extensions.multipletab.show.multipletab-selection-item-createSubTree'
					]) {
					for (let i = 0, maxi = subTreePrefs.length; i < maxi; i++)
					{
						let pref = subTreePrefs[i];
						let value = prefs.getPref(pref);
						if (value === null) {
							continue;
						}
						prefs.setPref(pref.replace('SubTree', 'Subtree'), value);
						prefs.clearPref(pref);
					}
				}
			case 5:
				let (behavior = this.getTreePref('openGroupBookmark.behavior')) {
					behavior = behavior | 2048;
					this.setTreePref('openGroupBookmark.behavior', behavior);
				}
			case 6:
				let (
					general = this.getTreePref('autoAttachNewTabsAsChildren'),
					search = this.getTreePref('autoAttachSearchResultAsChildren')
					) {
					if (general !== null)
						this.setTreePref('autoAttach', general);
					if (search !== null)
						this.setTreePref('autoAttach.searchResult', search);
				}
			case 7:
				let (
					enabled = this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut'),
					delay = this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay')
					) {
					if (enabled !== null) {
						this.setTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut', enabled);
						this.setTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut.collapseOthers', enabled);
					}
					if (delay !== null)
						this.setTreePref('autoExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay', delay);
				}
			case 8:
				orientalPrefs = orientalPrefs.concat([
					'extensions.treestyletab.indent',
					'extensions.treestyletab.indent.min'
				]);
			case 9:
				let (behavior = this.getTreePref('openGroupBookmark.behavior')) {
					if (behavior & 4) {
						behavior ^= 4;
						behavior |= 1;
						this.setTreePref('openGroupBookmark.behavior', behavior);
					}
				}
			default:
				for (let i = 0, maxi = orientalPrefs.length; i < maxi; i++)
				{
					let pref = orientalPrefs[i];
					let value = prefs.getPref(pref);
					if (value === null) {
						continue;
					}
					prefs.setPref(pref+'.horizontal', value);
					prefs.setPref(pref+'.vertical', value);
					prefs.clearPref(pref);
				}
				break;
		}
		this.setTreePref('prefsVersion', TST_PREF_VERSION);
	},

/* string bundle */
	get treeBundle () {
		return stringBundle.get('chrome://treestyletab/locale/treestyletab.properties');
	},
	get tabbrowserBundle () {
		return stringBundle.get('chrome://browser/locale/tabbrowser.properties');
	},

	evalInSandbox : function utils_evalInSandbox(aCode, aOwner)
	{
		try {
			var sandbox = new Cu.Sandbox(aOwner || 'about:blank');
			return Cu.evalInSandbox(aCode, sandbox);
		}
		catch(e) {
		}
		return void(0);
	},


	isTabNotRestoredYet: function(aTab)
	{
		var browser = aTab.linkedBrowser;
		// Firefox 25 and later. See: https://bugzilla.mozilla.org/show_bug.cgi?id=867142
		if (this.TabRestoreStates &&
			this.TabRestoreStates.has(browser))
			return (
				this.TabRestoreStates.isNeedsRestore(browser) ||
				this.TabRestoreStates.isRestoring(browser)
			);

		return !!browser.__SS_restoreState;
	},
	isTabNeedToBeRestored: function(aTab)
	{
		var browser = aTab.linkedBrowser;
		// Firefox 25 and later. See: https://bugzilla.mozilla.org/show_bug.cgi?id=867142
		if (this.TabRestoreStates &&
			this.TabRestoreStates.has(browser))
			return this.TabRestoreStates.isNeedsRestore(browser);

		return browser.__SS_restoreState == 1;
	},
	get TabRestoreStates() {
		return this.SessionStoreNS.TabRestoreStates;
	},
	get SessionStoreNS() {
		if (!this._SessionStoreNS) {
			try {
				// resource://app/modules/sessionstore/SessionStore.jsm ?
				this._SessionStoreNS = Components.utils.import('resource:///modules/sessionstore/SessionStore.jsm', {});
			}
			catch(e) {
				this._SessionStoreNS = {};
			}
		}
		return this._SessionStoreNS;
	},

	getShortcutOrURI : function utils_getShortcutOrURI(aBrowserWindow, aURI)
	{
		if (aBrowserWindow.getShortcutOrURI) // Firefox 24 and older
			return aBrowserWindow.getShortcutOrURI(aURI);

		// Firefox 25 and later
		var getShortcutOrURIAndPostData = aBrowserWindow.getShortcutOrURIAndPostData;
		var done = false;
		Task.spawn(function() {
			var data = yield getShortcutOrURIAndPostData(aURI);
			aURI = data.url;
			done = true;
		});

		// this should be rewritten in asynchronous style...
		var thread = Cc['@mozilla.org/thread-manager;1'].getService().mainThread;
		while (!done)
		{
			thread.processNextEvent(true);
		}

		return aURI;
	}
};
