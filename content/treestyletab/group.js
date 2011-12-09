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

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://treestyletab-modules/utils.js');
Components.utils.import('resource://treestyletab-modules/pseudoTreeBuilder.js');

var gIcon = document.getElementById('icon');
var gLabel = document.getElementById('label');
var gEdit = document.getElementById('editor');
var gDeck = document.getElementById('deck');

function trim(aString)
{
	return aString.replace(/^\s+|\s+$/g, '');
}

var title = location.href.split('?')[1];
if (location.href.indexOf('?') > -1 && title) {
	title = trim(decodeURIComponent(title));
	document.title = title;
	document.documentElement.setAttribute('title', title);
	gLabel.value = title;
	gLabel.setAttribute('tooltiptext', title);
	gEdit.value = title;
}

function enterEdit()
{
	if (gDeck.selectedIndex == 1) return;

	gEdit.value = gLabel.value;
	gDeck.selectedIndex = 1;
	gEdit.focus();
	gEdit.select();
}

function exitEdit()
{
	if (gDeck.selectedIndex == 0) return;

	var old = trim(gLabel.value);
	var value = trim(gEdit.value);
	document.title = gLabel.value = value;
	gLabel.setAttribute('tooltiptext', value);
	document.documentElement.setAttribute('title', value);

	if (value != old)
		location.replace(location.href.split('?')[0]+'?'+encodeURIComponent(value));

	gEdit.blur();
	gDeck.selectedIndex = 0;
}

function onClick(aEvent)
{
	if (aEvent.target == gEdit) return;
	if (aEvent.target == gLabel)
		enterEdit();
	else
		exitEdit();
}

function onDblClick(aEvent)
{
	if (aEvent.target == gEdit) return;
	if (gDeck.selectedIndex == 0)
		enterEdit();
	else
		exitEdit();
}

function onKeyPress(aEvent)
{
	if (aEvent.keyCode == aEvent.DOM_VK_ENTER ||
		aEvent.keyCode == aEvent.DOM_VK_RETURN ||
		aEvent.keyCode == aEvent.DOM_VK_ESCAPE)
		exitEdit();
}


function getOwnerTabBrowser()
{
	var ownerWindow = window
					.QueryInterface(Ci.nsIInterfaceRequestor)
					.getInterface(Ci.nsIWebNavigation)
					.QueryInterface(Ci.nsIDocShell)
					.QueryInterface(Ci.nsIDocShellTreeItem)
					.parent;
	if (ownerWindow) {
		ownerWindow = ownerWindow
						.QueryInterface(Ci.nsIWebNavigation)
						.document
						.defaultView;
		return ownerWindow.gBrowser;
	}
	return null;
}

function getOwnerTab(aWindow)
{
	var gBrowser = getOwnerTabBrowser();
	return gBrowser &&
			gBrowser.treeStyleTab &&
			gBrowser.treeStyleTab.getTabFromFrame(aWindow || window);
}

function getTabById(aId)
{
	var gBrowser = getOwnerTabBrowser();
	if (aId && gBrowser)
		return gBrowser.treeStyleTab.getTabById(aId);
	return null;
}

function onItemClick(aEvent)
{
	var gBrowser = getOwnerTabBrowser();
	if (!gBrowser)
		return;

	var tab = getTabById(aEvent.getData('id'));
	if (!tab)
		return;

	var event = aEvent.getData('sourceEvent');
	var isMiddleClick = (
			(
				event.button == 1 &&
				!event.altKey &&
				!event.ctrlKey &&
				!event.metaKey &&
				!event.shiftKey
			) ||
			(
				event.button == 0 &&
				!event.altKey &&
				(event.ctrlKey || event.metaKey) &&
				!event.shiftKey
			)
		);

	if (isMiddleClick)
		gBrowser.removeTab(tab);
	else if (event.button != 2)
		gBrowser.selectedTab = tab;
}


function updateTree()
{
	if (window.closed)
		return;

	var tree = document.getElementById('tree');

	var range = document.createRange();
	range.selectNodeContents(tree);
	range.deleteContents();
	range.detach();

	var contents = PseudoTreeBuilder.build(getOwnerTab());
	if (contents)
		tree.appendChild(contents);
}

function checkUpdateTreeNow()
{
	if (getOwnerTab().selected)
		window.setTimeout(function() {
			if (!window.closed)
				onTabSelect();
		}, 0);
}

var gShouldUpdate = false;
function onTabSelect(aEvent)
{
	if (gShouldUpdate)
		updateTree();

	gShouldUpdate = false;
}

function onUnload(aEvent)
{
	destroy();
}

function onTabAttached(aEvent)
{
	var tab = aEvent.getData('parentTab');
	var id = tab.getAttribute(TreeStyleTabUtils.kID);
	if (tab == getOwnerTab() ||
		document.getElementsByAttribute('tab-id', id).length)
		gShouldUpdate = true;

	checkUpdateTreeNow();
}

function onTabDetached(aEvent)
{
	var tab = aEvent.originalTarget;
	var id = tab.getAttribute(TreeStyleTabUtils.kID);
	if (document.getElementsByAttribute('tab-id', id).length)
		gShouldUpdate = true;

	checkUpdateTreeNow();
}

function onDocumentModified(aEvent)
{
	var tab = getOwnerTab(aEvent.target.defaultView.top);
	if (tab) {
		let id = tab.getAttribute(TreeStyleTabUtils.kID);
		if (document.getElementsByAttribute('tab-id', id).length)
			gShouldUpdate = true;
	}

	checkUpdateTreeNow();
}

function startListenTab(aTab)
{
	aTab.addEventListener('TabSelect', onTabSelect, false);
	aTab.addEventListener('TabClose', onUnload, false);
	window.addEventListener('unload', onUnload, false);
	aTab.parentNode.addEventListener('TabMove', onTabAttached, false);
	aTab.parentNode.addEventListener(TreeStyleTabUtils.kEVENT_TYPE_ATTACHED, onTabAttached, false);
	aTab.parentNode.addEventListener(TreeStyleTabUtils.kEVENT_TYPE_DETACHED, onTabDetached, false);

	var tabbrowser = getOwnerTabBrowser();
	tabbrowser.addEventListener('load', onDocumentModified, true);
	tabbrowser.addEventListener('DOMTitleChanged', onDocumentModified, true);
}

function endListenTab(aTab)
{
	aTab.removeEventListener('TabSelect', onTabSelect, false);
	aTab.removeEventListener('TabClose', onUnload, false);
	window.removeEventListener('unload', onUnload, false);
	aTab.parentNode.removeEventListener('TabMove', onTabAttached, false);
	aTab.parentNode.removeEventListener(TreeStyleTabUtils.kEVENT_TYPE_ATTACHED, onTabAttached, false);
	aTab.parentNode.removeEventListener(TreeStyleTabUtils.kEVENT_TYPE_DETACHED, onTabDetached, false);

	var tabbrowser = getOwnerTabBrowser();
	tabbrowser.removeEventListener('load', onDocumentModified, true);
	tabbrowser.removeEventListener('DOMTitleChanged', onDocumentModified, true);
}


var gInitialized = false;

function init()
{
	var tab = getOwnerTab();

	updateTree();

	startListenTab(tab);
	document.getElementById('tree').addEventListener(PseudoTreeBuilder.kTAB_LINK_CLICK, onItemClick, false);

	gInitialized = true;
}

function destroy()
{
	var tab = getOwnerTab();
	if (!gInitialized || !tab)
		return;

	endListenTab(tab);
	document.getElementById('tree').removeEventListener(PseudoTreeBuilder.kTAB_LINK_CLICK, onItemClick, false);
}

window.addEventListener('load', function(aEvent) {
	window.removeEventListener(aEvent.type, arguments.callee, false);
	init();
}, false);
