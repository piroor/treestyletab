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
	document.getElementById('extensions.treestyletab.tabbar.invertScrollbar-check').disabled = pos != 'left';
	document.getElementById('extensions.treestyletab.tabbar.invertUI-check').disabled = pos != 'right';

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
		indentCheck.setAttribute('style', 'visibility:collapse');
		autoHideCheck.removeAttribute('style');
	}
	else {
		indentCheck.removeAttribute('style');
		autoHideCheck.setAttribute('style', 'visibility:collapse');
	}

	gTabbarPlacePositionInitialized = true;
}
