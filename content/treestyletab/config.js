const XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1']
		.getService(Components.interfaces.nsIXULAppInfo);
const comparator = Components.classes['@mozilla.org/xpcom/version-comparator;1']
					.getService(Components.interfaces.nsIVersionComparator);

function init()
{
//	sizeToContent();
}


var gOuterLinkCheck,
	gAnyLinkCheck,
	gGroupBookmarkRadio,
	gGroupBookmarkTree,
	gGroupBookmarkReplace,
	gLastStateIsVertical;
var gTabbarPlacePositionInitialized = false;

function initTabPane()
{
	gOuterLinkCheck = document.getElementById('extensions.treestyletab.openOuterLinkInNewTab-check');
	gAnyLinkCheck = document.getElementById('extensions.treestyletab.openAnyLinkInNewTab-check');
	gOuterLinkCheck.disabled = gAnyLinkCheck.checked;

	gGroupBookmarkRadio = document.getElementById('openGroupBookmarkAsTabSubTree-radiogroup');
	gGroupBookmarkTree = document.getElementById('extensions.treestyletab.openGroupBookmarkAsTabSubTree');


	var Prefs = Components.classes['@mozilla.org/preferences;1']
			.getService(Components.interfaces.nsIPrefBranch);

	var restrictionKey = 'browser.link.open_newwindow.restriction';
	var restriction = document.getElementById(restrictionKey);
	try {
		restriction.value = Prefs.getIntPref(restrictionKey);
	}
	catch(e) {
		Prefs.setIntPref(restrictionKey, parseInt(restriction.value));
	}

	var bookmarkReplaceKey = 'browser.tabs.loadFolderAndReplace';
	gGroupBookmarkReplace = document.getElementById(bookmarkReplaceKey);
	try {
		gGroupBookmarkReplace.value = Prefs.getBoolPref(bookmarkReplaceKey);
	}
	catch(e) {
		Prefs.setBoolPref(bookmarkReplaceKey, gGroupBookmarkReplace.value != 'false');
	}

	gGroupBookmarkRadio.value =
		gGroupBookmarkTree.value && !gGroupBookmarkReplace.value ? 'subtree' :
		!gGroupBookmarkTree.value && !gGroupBookmarkReplace.value ? 'flat' :
		'replace';

	gLastStateIsVertical = document.getElementById('extensions.treestyletab.tabbar.position-radiogroup').value;
	gLastStateIsVertical = gLastStateIsVertical == 'left' || gLastStateIsVertical == 'right';
}

function onChangeGroupBookmarkRadio()
{
	gGroupBookmarkTree.value    = gGroupBookmarkRadio.value == 'subtree';
	gGroupBookmarkReplace.value = gGroupBookmarkRadio.value == 'replace';

	var underParent = document.getElementById('openGroupBookmarkAsTabSubTree.underParent-check');
	if (gGroupBookmarkTree.value)
		underParent.removeAttribute('disabled');
	else
		underParent.setAttribute('disabled', true);
}


function onChangeTabbarPosition(aOnChange)
{
	var pos = document.getElementById('extensions.treestyletab.tabbar.position-radiogroup').value;
	var invertTab = document.getElementById('extensions.treestyletab.tabbar.invertTab-check');
	var invertTabContents = document.getElementById('extensions.treestyletab.tabbar.invertTabContents-check');
	var invertClosebox = document.getElementById('extensions.treestyletab.tabbar.invertClosebox-check');

	invertTab.disabled = pos != 'right';
//	invertTabContents.disabled = pos != 'right';
	invertClosebox.setAttribute('label',
		invertClosebox.getAttribute(
			(pos == 'right' && invertTabContents.checked) ?
				'label-right' :
				'label-left'
		)
	);
	if (invertClosebox.checked != document.getElementById('extensions.treestyletab.tabbar.invertClosebox').defaultValue)
		invertClosebox.removeAttribute('collapsed');
	else
		invertClosebox.setAttribute('collapsed', true);

	var indentCheckH   = document.getElementById('extensions.treestyletab.enableSubtreeIndent.horizontal-check');
	var indentCheckV   = document.getElementById('extensions.treestyletab.enableSubtreeIndent.vertical-check');
	var collapseCheckH = document.getElementById('extensions.treestyletab.allowSubtreeCollapseExpand.horizontal-check');
	var collapseCheckV = document.getElementById('extensions.treestyletab.allowSubtreeCollapseExpand.vertical-check');
	var hideNewTabCheckH = document.getElementById('extensions.treestyletab.tabbar.hideNewTabButton.horizontal-check');
	var hideNewTabCheckV = document.getElementById('extensions.treestyletab.tabbar.hideNewTabButton.vertical-check');
	var hideAllTabsCheckH = document.getElementById('extensions.treestyletab.tabbar.hideAlltabsButton.horizontal-check');
	var hideAllTabsCheckV = document.getElementById('extensions.treestyletab.tabbar.hideAlltabsButton.vertical-check');

	var newTabAvailable = comparator.compare(XULAppInfo.version, '3.1b3') >= 0;
	if (!newTabAvailable) {
		hideNewTabCheckH.setAttribute('collapsed', true);
		hideNewTabCheckV.setAttribute('collapsed', true);
	}

	if (pos == 'left' || pos == 'right') {
		indentCheckH.setAttribute('collapsed', true);
		indentCheckV.removeAttribute('collapsed');
		collapseCheckH.setAttribute('collapsed', true);
		collapseCheckV.removeAttribute('collapsed');
		if (newTabAvailable) {
			hideNewTabCheckH.setAttribute('collapsed', true);
			hideNewTabCheckV.removeAttribute('collapsed');
		}
		hideAllTabsCheckH.setAttribute('collapsed', true);
		hideAllTabsCheckV.removeAttribute('collapsed');
	}       
	else {
		indentCheckH.removeAttribute('collapsed');
		indentCheckV.setAttribute('collapsed', true);
		collapseCheckH.removeAttribute('collapsed');
		collapseCheckV.setAttribute('collapsed', true);
		if (newTabAvailable) {
			hideNewTabCheckH.removeAttribute('collapsed');
			hideNewTabCheckV.setAttribute('collapsed', true);
		}
		hideAllTabsCheckH.removeAttribute('collapsed');
		hideAllTabsCheckV.setAttribute('collapsed', true);
	}

	gTabbarPlacePositionInitialized = true;
}


var gAutoHideModeRadio;
var gAutoHideModeToggle;

function initAutoHidePane()
{
	gAutoHideModeRadio = document.getElementById('extensions.treestyletab.tabbar.autoHide.mode-radio');
	gAutoHideModeToggle = document.getElementById('extensions.treestyletab.tabbar.autoHide.mode.toggle');
	updateAutoHideModeLabel();
}

function onChangeAutoHideMode()
{
	if (!gAutoHideModeRadio) return;
	var mode = gAutoHideModeRadio.value;
	if (!mode) return;
	if (gAutoHideModeRadio.value != 0) {
		gAutoHideModeToggle.value = mode;
		updateAutoHideModeLabel();
	}
}

function updateAutoHideModeLabel()
{
	if (!gAutoHideModeRadio) return;
	var mode = gAutoHideModeRadio.value;
	var nodes = document.getElementsByAttribute('label-mode'+mode, '*');
	if (nodes && nodes.length)
		Array.slice(nodes).forEach(function(aNode) {
			var label = aNode.getAttribute('label-mode'+mode);
			var node = document.getElementById(aNode.getAttribute('target'));
			var attr = node.localName == 'label' ? 'value' : 'label' ;
			node.setAttribute(attr, label);
		});
}

function updateCloseRootBehaviorCheck()
{
	var closeParentBehavior = document.getElementById('extensions.treestyletab.closeParentBehavior-radiogroup').value;
	var closeRootBehavior = document.getElementById('extensions.treestyletab.closeRootBehavior-check');
	if (closeParentBehavior == 0)
		closeRootBehavior.removeAttribute('disabled');
	else
		closeRootBehavior.setAttribute('disabled', true);
}
