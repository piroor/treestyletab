var gOuterLinkCheck,
	gAnyLinkCheck,
	gGroupBookmarkRadio,
	gGroupBookmarkTree,
	gGroupBookmarkReplace;
var gTabbarPlacePositionInitialized = false;

function initTabPane()
{
	gOuterLinkCheck = document.getElementById('extensions.treestyletab.openOuterLinkInNewTab-check');
	gAnyLinkCheck = document.getElementById('extensions.treestyletab.openAnyLinkInNewTab-check');
	gOuterLinkCheck.disabled = gAnyLinkCheck.checked;

	gGroupBookmarkRadio = document.getElementById('openGroupBookmarkAsTabSubTree-radiogroup');
	gGroupBookmarkTree = document.getElementById('extensions.treestyletab.openGroupBookmarkAsTabSubTree');
	gGroupBookmarkReplace = document.getElementById('browser.tabs.loadFolderAndReplace');

	gGroupBookmarkRadio.value =
		gGroupBookmarkTree.value && !gGroupBookmarkReplace.value ? 'subtree' :
		!gGroupBookmarkTree.value && !gGroupBookmarkReplace.value ? 'flat' :
		'replace';
}

function onChangeGroupBookmarkRadio()
{
	gGroupBookmarkTree.value    = gGroupBookmarkRadio.value == 'subtree';
	gGroupBookmarkReplace.value = gGroupBookmarkRadio.value == 'replace';
}


function onChangeTabbarPosition(aOnChange)
{
	var pos = document.getElementById('extensions.treestyletab.tabbar.position-radiogroup').value;
	var invertScrollbar = document.getElementById('extensions.treestyletab.tabbar.invertScrollbar-check');
	invertScrollbar.disabled = pos != 'left';
	document.getElementById('extensions.treestyletab.tabbar.invertUI-check').disabled = pos != 'right';

	if (isGecko18()) {
		invertScrollbar.removeAttribute('collapsed');
	}
	else {
		invertScrollbar.setAttribute('collapsed', true);
	}

	var indentPref    = document.getElementById('extensions.treestyletab.enableSubtreeIndent');
	var collapsePref  = document.getElementById('extensions.treestyletab.allowSubtreeCollapseExpand');
	var autoHidePref  = document.getElementById('extensions.treestyletab.tabbar.autoHide.enabled');
	var indentCheck   = document.getElementById('extensions.treestyletab.enableSubtreeIndent-check');
	var collapseCheck = document.getElementById('extensions.treestyletab.allowSubtreeCollapseExpand-check');
	var autoHideCheck = document.getElementById('extensions.treestyletab.tabbar.autoHide.enabled-check');
	if (aOnChange) {
		indentPref.value = indentCheck.checked =
			collapsePref.value = collapseCheck.checked = (pos == 'left' || pos == 'right');
	}
	if (pos == 'left' || pos == 'right') {
		indentCheck.setAttribute('collapsed', true);
		autoHideCheck.removeAttribute('collapsed');
	}
	else {
		indentCheck.removeAttribute('collapsed');
		autoHideCheck.setAttribute('collapsed', true);
	}

	gTabbarPlacePositionInitialized = true;
}

function isGecko18()
{
	const XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1'].getService(Components.interfaces.nsIXULAppInfo);
	var version = XULAppInfo.platformVersion.split('.');
	return parseInt(version[0]) <= 1 && parseInt(version[1]) <= 8;
}
