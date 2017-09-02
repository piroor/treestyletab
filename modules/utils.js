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
 * Portions created by the Initial Developer are Copyright (C) 2010-2017
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

var EXPORTED_SYMBOLS = ['TreeStyleTabUtils'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Timer.jsm');
Cu.import('resource://treestyletab-modules/constants.js');

XPCOMUtils.defineLazyGetter(this, 'window', function() {
	Cu.import('resource://treestyletab-modules/lib/namespace.jsm');
	return getNamespaceFor('piro.sakura.ne.jp');
});
Cu.import('resource://treestyletab-modules/lib/prefs.js');
XPCOMUtils.defineLazyGetter(this, 'stringBundle', function() {
	Cu.import('resource://treestyletab-modules/lib/stringBundle.js', {});
	return window['piro.sakura.ne.jp'].stringBundle;
});

XPCOMUtils.defineLazyModuleGetter(this, 'Task',
	'resource://gre/modules/Task.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Promise',
	'resource://gre/modules/Promise.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'Services',
	'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this, 'TreeStyleTabConstants',
  'resource://treestyletab-modules/constants.js', 'TreeStyleTabConstants');

const TST_PREF_PREFIX = 'extensions.treestyletab.';
const TST_PREF_VERSION = 15;

var TreeStyleTabUtils = {

	get prefs () {
		return prefs;
	},

/* Save/Load Prefs */

	getTreePref : function TSTUtils_getTreePref(aPrefstring)
	{
		return prefs.getPref(TST_PREF_PREFIX + aPrefstring);
	},
	getDefaultTreePref : function TSTUtils_getTreePref(aPrefstring)
	{
		return prefs.getDefaultPref(TST_PREF_PREFIX + aPrefstring);
	},

	setTreePref : function TSTUtils_setTreePref(aPrefstring, aNewValue)
	{
		if (this.isPrefChanging(aPrefstring))
			return aNewValue;
		return prefs.setPref(TST_PREF_PREFIX + aPrefstring, aNewValue);
	},

	clearTreePref : function TSTUtils_clearTreePref(aPrefstring)
	{
		if (this.isPrefChanging(aPrefstring))
			return null;
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
				{
					let subTreePrefs = [
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
					];
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
				{
					let behavior = this.getTreePref('openGroupBookmark.behavior');
					behavior = behavior | 2048;
					this.setTreePref('openGroupBookmark.behavior', behavior);
				}
			case 6:
				{
					let general = this.getTreePref('autoAttachNewTabsAsChildren');
					let search = this.getTreePref('autoAttachSearchResultAsChildren');
					if (general !== null)
						this.setTreePref('autoAttach', general);
					if (search !== null)
						this.setTreePref('autoAttach.searchResult', search);
				}
			case 7:
				{
					let enabled = this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut');
					let delay = this.getTreePref('autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay');
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
				{
					let behavior = this.getTreePref('openGroupBookmark.behavior');
					if (behavior & 4) {
						behavior ^= 4;
						behavior |= 1;
						this.setTreePref('openGroupBookmark.behavior', behavior);
					}
				}
			case 10:
				{
					let physical = this.getTreePref('maxTreeLevel.phisical');
					this.setTreePref('maxTreeLevel.physical', physical);
					this.clearTreePref('maxTreeLevel.phisical');
				}
			case 11:
				{
					prefs.clearPref('browser.tabs.insertRelatedAfterCurrent');
					let backupValue = prefs.getPref('browser.tabs.insertRelatedAfterCurrent.backup');
					if (backupValue !== null)
						prefs.setPref('browser.tabs.insertRelatedAfterCurrent', backupValue);
				}
			case 12:
				{
					let orient = /^(left|right)$/.test(this.getTreePref('tabbar.position')) ? 'vertical' : 'horizontal' ;
					let disabledCollapseExpand = this.getTreePref('allowSubtreeCollapseExpand.' + orient) === false;
					let disabledIndent = this.getTreePref('indent.' + orient) == 0 ||
										this.getTreePref('indent.min.' + orient) == 0;

					if (disabledCollapseExpand) {
						this.setTreePref('autoCollapseExpandSubtreeOnAttach', false);
						this.setTreePref('autoCollapseExpandSubtreeOnSelect', false);
					}

					let treeWasRevoked = disabledCollapseExpand || (disabledIndent && orient == 'vertical');
					if (treeWasRevoked) {
						Services.prompt.alert(this.browserWindow,
							this.treeBundle.getString('migration.treeNeverRevoked.title'),
							this.treeBundle.getString('migration.treeNeverRevoked.text')
						);
					}
				}
			case 13:
				{
					let delay = this.getTreePref('tabbar.autoHide.delay');
					if (delay !== null)
						this.setTreePref('tabbar.autoHide.delay.show', delay);
				}
			case 14:
				{
					if (this.getTreePref('controlNewTabPosition') !== null) {
						this.setTreePref('insertNewChildAt', TreeStyleTabConstants.kINSERT_NO_CONTROL);
						this.clearTreePref('controlNewTabPosition');
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
 
	isDebugging : function utils_isDebugging(aModule)
	{
		return this.getTreePref('debug.' + aModule) || this.getTreePref('debug.all');
	},

	log : function utils_log(aModule, ...aArgs)
	{
		if (!this.isDebugging(aModule))
			return;

		var logString = '[treestyletab:' + aModule+'] '+ aArgs.map(this.objectToLogString, this).join('');
		Services.console.logStringMessage(logString);
		dump(logString+'\n');
	},
	logWithStackTrace : function utils_logWithStackTrace(aModule, ...aArgs)
	{
		var stack = (new Error()).stack.replace(/^/gm, '  ');
		return this.log.apply(this, [aModule].concat(aArgs).concat([stack]));
	},
	objectToLogString : function utils_objectToLogString(aObject)
	{
		if (!aObject)
			return JSON.stringify(aObject);

		if (/^(string|number|boolean)$/.test(typeof aObject))
			return aObject;

		return this.objectToString(aObject);
	},
	objectToString : function utils_objectToString(aObject)
	{
		try {
			if (!aObject ||
				/^(string|number|boolean)$/.test(typeof aObject))
				return JSON.stringify(aObject);

			if (Array.isArray(aObject))
				return '['+aObject.map(this.objectToString, this).join(', ')+']';

			var constructor = String(aObject.constructor).match(/^function ([^\(]+)/);
			if (constructor) {
				constructor = constructor[1];
				switch (constructor)
				{
					case 'String':
					case 'Number':
					case 'Boolean':
						return JSON.stringify(aObject);

					case 'Object':
						return '{' + Object.keys(aObject).map(function(aKey) {
							return '"' + aKey + '":' + this.objectToString(aObject[aKey]);
						}, this).join(', ') + '}';

					default:
						break;
				}

				if (/Element$/.test(constructor)) {
					let id = '';
					if (aObject.hasAttribute('id'))
						id = '#' + aObject.getAttribute('id');

					let classes = '';
					if (aObject.className)
						classes = '.' + aObject.className.replace(/\s+/g, '.');

					return '<' + aObject.localName + id + classes + '>';
				}

				return '<object '+constructor+'>';
			}

			return String(aObject);
		}
		catch(e) {
			return String(e);
		}
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


	isTabNotRestoredYet : function utils_isTabNotRestoredYet(aTab)
	{
		var browser = aTab.linkedBrowser;
		return !!aTab.__SS_lazyData || !!browser.__SS_restoreState;
	},
	isTabNeedToBeRestored : function utils_isTabNeedToBeRestored(aTab)
	{
		var browser = aTab.linkedBrowser;
		return !!aTab.__SS_lazyData || browser.__SS_restoreState == 1;
	},
	get SessionStoreInternal() {
		return this.SessionStoreNS.SessionStoreInternal;
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


	doPatching : function utils_assertFunctionExists(aFunction, aName, aPatchingTask, aMatcher)
	{
		if (typeof aFunction == 'function') {
			if (aMatcher && this.functionIsMatched(aFunction, aMatcher)) // already patched
				return;
			let patched = aPatchingTask(aName, aFunction.toSource());
			if (patched && aMatcher)
				this.assertFunctionIsPatched(patched, aName, aMatcher);
		}
		else
			Components.utils.reportError(new Error('treestyletab: doPatching: ' + aName + ' is missing!'));
	},

	assertFunctionIsPatched : function utils_assertFunctionIsPatched(aFunction, aName, aMatcher)
	{
		if (!this.functionIsMatched(aFunction, aMatcher))
			Components.utils.reportError(new Error('treestyletab: Failed to patch to ' + aName + ': ' + aFunction.toString()));
	},

	functionIsMatched : function utils_functionIsMatched(aFunction, aMatcher)
	{
		var source = aFunction.toString();
		if (typeof aMatcher == 'string')
			return source.indexOf(aMatcher) > -1;
		else
			return aMatcher.test(source);
	},

	isPrefChanging : function utils_isPrefChanging(aKey) 
	{
		return aKey in this.changingPrefs;
	},
	isTreePrefChanging : function utils_isPrefChanging(aKey) 
	{
		return (TST_PREF_PREFIX + aKey) in this.changingPrefs ||
				this.isPrefChanging(aKey);
	},


// xpath 
	
	NSResolver : { 
		lookupNamespaceURI : function(aPrefix)
		{
			switch (aPrefix)
			{
				case 'xul':
					return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
				case 'html':
				case 'xhtml':
					return 'http://www.w3.org/1999/xhtml';
				case 'xlink':
					return 'http://www.w3.org/1999/xlink';
				default:
					return '';
			}
		}
	},
 
	evaluateXPath : function utils_evaluateXPath(aExpression, aContext, aType) 
	{
		if (!aType)
			aType = Ci.nsIDOMXPathResult.ORDERED_NODE_SNAPSHOT_TYPE;
		try {
			var XPathResult = (aContext.ownerDocument || aContext).evaluate(
					aExpression,
					(aContext || document),
					this.NSResolver,
					aType,
					null
				);
		}
		catch(e) {
			return {
				singleNodeValue : null,
				snapshotLength  : 0,
				snapshotItem    : function() {
					return null
				}
			};
		}
		return XPathResult;
	},
 
	getArrayFromXPathResult : function utils_getArrayFromXPathResult(aXPathResult) 
	{
		var max = aXPathResult.snapshotLength;
		var array = new Array(max);
		if (!max)
			return array;

		for (var i = 0; i < max; i++)
		{
			array[i] = aXPathResult.snapshotItem(i);
		}

		return array;
	},


	getTabBrowserFromChild : function utils_getTabBrowserFromChild(aTabBrowserChild) 
	{
		if (!aTabBrowserChild)
			return null;

		if (aTabBrowserChild.__treestyletab__linkedTabBrowser) // tab
			return aTabBrowserChild.__treestyletab__linkedTabBrowser;

		if (aTabBrowserChild.localName == 'tabbrowser') // itself
			return aTabBrowserChild;

		if (aTabBrowserChild.tabbrowser) // tabs
			return aTabBrowserChild.tabbrowser;

		if (aTabBrowserChild.localName == 'toolbar') // tabs toolbar
			return aTabBrowserChild.getElementsByTagName('tabs')[0].tabbrowser;

		// tab context menu
		var popup = this.evaluateXPath(
				'ancestor-or-self::xul:menupopup[@id="tabContextMenu"]',
				aTabBrowserChild,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		if (popup && 'TabContextMenu' in aTabBrowserChild.ownerDocument.defaultView)
			return this.getTabBrowserFromChild(aTabBrowserChild.ownerDocument.defaultView.TabContextMenu.contextTab);

		var b = this.evaluateXPath(
				'ancestor::xul:tabbrowser | '+
				'ancestor::xul:tabs[@tabbrowser] |'+
				'ancestor::xul:toolbar/descendant::xul:tabs',
				aTabBrowserChild,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE
			).singleNodeValue;
		return (b && b.tabbrowser) || b;
	},


 
	getTreeStructureFromTabs : function TSTUtils_getTreeStructureFromTabs(aTabs) 
	{
		if (!aTabs || !aTabs.length)
			return [];

		/* this returns...
		  [A]     => -1 (parent is not in this tree)
		    [B]   => 0 (parent is 1st item in this tree)
		    [C]   => 0 (parent is 1st item in this tree)
		      [D] => 2 (parent is 2nd in this tree)
		  [E]     => -1 (parent is not in this tree, and this creates another tree)
		    [F]   => 0 (parent is 1st item in this another tree)
		*/
		var browser = this.getTabBrowserFromChild(aTabs[0]);
		return this.cleanUpTreeStructureArray(
				aTabs.map(function(aTab, aIndex) {
					let tab = browser.treeStyleTab.getParentTab(aTab);
					let index = tab ? aTabs.indexOf(tab) : -1 ;
					return index >= aIndex ? -1 : index ;
				}, this),
				-1
			);
	},
	cleanUpTreeStructureArray : function TSTUtils_cleanUpTreeStructureArray(aTreeStructure, aDefaultParent)
	{
		var offset = 0;
		aTreeStructure = aTreeStructure
			.map(function(aPosition, aIndex) {
				return (aPosition == aIndex) ? -1 : aPosition ;
			})
			.map(function(aPosition, aIndex) {
				if (aPosition == -1) {
					offset = aIndex;
					return aPosition;
				}
				return aPosition - offset;
			});

		/* The final step, this validates all of values.
		   Smaller than -1 is invalid, so it becomes to -1. */
		aTreeStructure = aTreeStructure.map(function(aIndex) {
				return aIndex < -1 ? aDefaultParent : aIndex ;
			}, this);
		return aTreeStructure;
	},


	updateNarrowScrollbarStyle : function utils_updateNarrowScrollbarStyle(aTabBrowser) 
	{
		if (this.updatingNarrowScrollbarStyle)
			return;

		this.updatingNarrowScrollbarStyle = true;
		setTimeout((function() {
			this.updatingNarrowScrollbarStyle = false;
		}).bind(this), 100);

		const SSS = Cc['@mozilla.org/content/style-sheet-service;1']
					.getService(Ci.nsIStyleSheetService);

		if (this.lastAgentSheetForNarrowScrollbar &&
			SSS.sheetRegistered(this.lastAgentSheetForNarrowScrollbar, SSS.AGENT_SHEET))
			SSS.unregisterSheet(this.lastAgentSheetForNarrowScrollbar, SSS.AGENT_SHEET);

		var size = this.getTreePref('tabbar.narrowScrollbar.width');
		var negativeMarginRules = '';
		{
			let scrollbox = aTabBrowser.tabContainer.mTabstrip._scrollbox;
			let d = scrollbox.ownerDocument;

			// We have to calculate the width of the scroll bar indirectly
			// based on the width of the container and the scrollable contents,
			// because the scrollbar is not accessible via public APIs.
			let scrollbarSize = this.lastOriginalScrollbarSize;
			if (scrollbarSize == 0) {
				let nodes = d.getAnonymousNodes(scrollbox);
				if (nodes) {
					for (let i = 0, maxi = nodes.length; i < maxi; i++)
					{
						if (nodes[i].localName != 'box')
							continue;
						scrollbarSize = scrollbox.boxObject.width - nodes[i].boxObject.width;
						break;
					}
				}
			}
			if (scrollbarSize > 0) {
				let overWidth = size - scrollbarSize;
				let leftMargin = Math.floor(overWidth / 2);
				let rightMargin = overWidth - leftMargin;
				negativeMarginRules = 'margin-left: '+leftMargin+'px;' +
										'margin-right: '+rightMargin+'px;';
			}
		}

		const style = 'data:text/css,'+encodeURIComponent(
			('@namespace url("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul");' +

			'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
			'  .tabbrowser-arrowscrollbox' +
			'  > scrollbox' +
			'  > scrollbar[orient="vertical"] {' +
			'  font-size: %SIZE%px;' +
			'  max-width: %SIZE%px;' +
			'  min-width: %SIZE%px;' +
			// This "clip-path" is required to clip overflowed elements.
			// Elements with "-moz-appearance" can be larger than its given
			// maximum size.
			'  clip-path: url(#treestyletab-box-clip-path);' +
			'}' +
			'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
			'  .tabbrowser-arrowscrollbox' +
			'  > scrollbox' +
			'  > scrollbar[orient="vertical"] * {' +
			'  font-size: %SIZE%px;' +
			'  max-width: 100%;' +
			'  min-width: %SIZE%px;' +
			'}' +
			'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
			'  .tabbrowser-arrowscrollbox' +
			'  > scrollbox' +
			'  > scrollbar[orient="vertical"] scrollbarbutton {' +
			'  font-size: %SIZE%px;' +
			  negativeMarginRules +
			'}' +
			'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
			'  .tabbrowser-arrowscrollbox' +
			'  > scrollbox' +
			'  > scrollbar[orient="vertical"] * {' +
			'  padding-left: 0;' +
			'  padding-right: 0;' +
			'  margin-left: 0;' +
			'  margin-right: 0;' +
			'}' +

			'%FORCE_NARROW_SCROLLBAR%')
				.replace(/%FORCE_NARROW_SCROLLBAR%/g,
					this.getTreePref('tabbar.narrowScrollbar.overrideSystemAppearance') ?
						TreeStyleTabConstants.kOVERRIDE_SYSTEM_SCROLLBAR_APPEARANCE : '' )
				.replace(/%MODE%/g, TreeStyleTabConstants.kMODE)
				.replace(/%NARROW%/g, TreeStyleTabConstants.kNARROW_SCROLLBAR)
				.replace(/%SIZE%/g, size)
			);
		this.lastAgentSheetForNarrowScrollbar = this.makeURIFromSpec(style);
		SSS.loadAndRegisterSheet(this.lastAgentSheetForNarrowScrollbar, SSS.AGENT_SHEET);
	},
	kOVERRIDE_SYSTEM_SCROLLBAR_APPEARANCE :
		'tabs.tabbrowser-tabs[%MODE%="vertical"][%NARROW%="true"]' +
		'  .tabbrowser-arrowscrollbox' +
		'  > scrollbox' +
		'  > scrollbar[orient="vertical"] {' +
		'  appearance: none;' +
		'  -moz-appearance: none;' +
		'  background: ThreeDFace;' +
		'  border: 1px solid ThreeDShadow;' +
		'}',
	lastAgentSheetForNarrowScrollbar : null,
	lastOriginalScrollbarSize : 0,




	makeURIFromSpec : function utils_makeURIFromSpec(aURI) 
	{
		var newURI;
		aURI = aURI || '';
		if (aURI && String(aURI).indexOf('file:') == 0) {
			var fileHandler = Services.io.getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler);
			var tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
			newURI = Services.io.newFileURI(tempLocalFile);
		}
		else {
			if (!/^\w+\:/.test(aURI))
				aURI = 'http://'+aURI;
			newURI = Services.io.newURI(aURI, null, null);
		}
		return newURI;
	},
 
	getGroupTabURI : function utils_getGroupTabURI(aOptions) 
	{
		aOptions = aOptions || {};
		var parameters = [];
		parameters.push('title=' + encodeURIComponent(aOptions.title || ''));
		parameters.push('temporary=' + !!aOptions.temporary);
		return 'about:treestyletab-group?' + parameters.join('&');
	},



	isMac : Cc['@mozilla.org/xre/app-info;1']
			.getService(Ci.nsIXULAppInfo)
			.QueryInterface(Ci.nsIXULRuntime).OS == 'Darwin',

	wrapEventAsNewTabAction : function(aOriginalEvent, aParams)
	{
		var ctrlKey = !this.isMac;
		var metaKey = this.isMac;
		return new Proxy(aOriginalEvent, {
			get: function(aTarget, aName) {
				switch (aName)
				{
					case 'ctrlKey':
						return ctrlKey;
					case 'metaKey':
						return metaKey;
					default:
						var object = aTarget[aName];
						if (typeof object == 'function')
							return object.bind(aTarget);
						return object;
				}
			}
		});
	},


/* Pref Listener */ 
	domains : [ 
		'extensions.treestyletab.'
	],

	observe : function utils_observe(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onPrefChange(aData);
				return;
		}
	},

	changingPrefs : {},
	onPrefChange : function utils_onPrefChange(aPrefName) 
	{
		this.changingPrefs[aPrefName] = true;
		setTimeout((function() {
			delete this.changingPrefs[aPrefName];
		}).bind(this));
	}
};

prefs.addPrefListener(TreeStyleTabUtils);

{
	// Never save TST specific attributes! (because it causes many problems)
	let { TabAttributesInternal } = Cu.import('resource:///modules/sessionstore/TabAttributes.jsm', {});
	if (TabAttributesInternal && TabAttributesInternal._skipAttrs) {
		Object.keys(TreeStyleTabConstants).forEach(function(aKey) {
			if (!/^k[A-Z_]+$/.test(aKey))
				return;
			var name = TreeStyleTabConstants[aKey];
			if (!/^treestyletab-/.test(String(name)))
				return;
			TabAttributesInternal._skipAttrs.add(name);
		});
	}

	let { SessionStoreInternal } = Cu.import('resource:///modules/sessionstore/SessionStore.jsm', {});
	SessionStoreInternal.__treestyletab__duplicateTab = SessionStoreInternal.duplicateTab;
	SessionStoreInternal.duplicateTab = function(aWindow, aTab, aDelta = 0) {
		aWindow.gBrowser.treeStyleTab.onBeforeTabDuplicate(aWindow, aTab, aDelta);
		return this.__treestyletab__duplicateTab.call(this, aWindow, aTab, aDelta);
	};

	let { TabListView } = Cu.import('resource:///modules/syncedtabs/TabListView.js', {});
	TabListView.prototype.__treestyletab__onOpenSelected = TabListView.prototype.onOpenSelected;
	TabListView.prototype.onOpenSelected = function(...aArgs) {
		this._window.top.gBrowser.treeStyleTab.readyToOpenOrphanTabNow();
		return this.__treestyletab__onOpenSelected(...aArgs);
	};
}
