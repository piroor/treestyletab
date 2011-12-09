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

function onItemClick(aEvent)
{
	var id = aEvent.getData('id');
	var gBrowser = getOwnerTabBrowser();
	if (id && gBrowser) {
		let tab = gBrowser.treeStyleTab.getTabById(id);
		if (tab)
			gBrowser.selectedTab = tab;
	}
}

var treeInitialized = false;

window.addEventListener('load', function(aEvent) {
	window.removeEventListener(aEvent.type, arguments.callee, false);

	var gBrowser = getOwnerTabBrowser();
	if (gBrowser) {
		let tab = gBrowser.treeStyleTab.getTabFromFrame(window);
		let tree = document.getElementById('tree');
		tree.appendChild(PseudoTreeBuilder.build(tab));
		tree.addEventListener(PseudoTreeBuilder.kTAB_LINK_CLICK, onItemClick, false);
		treeInitialized = true;
	}
}, false);

window.addEventListener('unload', function(aEvent) {
	window.removeEventListener(aEvent.type, arguments.callee, false);
	if (!treeInitialized)
		return;

	document.getElementById('tree').removeEventListener(PseudoTreeBuilder.kTAB_LINK_CLICK, onItemClick, false);
}, false);

