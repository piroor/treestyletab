var gGroupBookmarkRadio, gGroupBookmarkTree, gGroupBookmarkReplace;

function initGroupBookmarkRadio()
{
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


function onChangeTabbarPosition()
{
	var pos = document.getElementById('extensions.treestyletab.tabbar.position-radiogroup').value;
	document.getElementById('extensions.treestyletab.tabbar.invertScrollbar-check').disabled = pos != 'left';
	document.getElementById('extensions.treestyletab.tabbar.invertUI-check').disabled = pos != 'right';
}
