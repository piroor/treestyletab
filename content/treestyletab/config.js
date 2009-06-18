const XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1']
		.getService(Components.interfaces.nsIXULAppInfo);
const comparator = Components.classes['@mozilla.org/xpcom/version-comparator;1']
					.getService(Components.interfaces.nsIVersionComparator);

function init()
{
	var useEffectiveTLD = document.getElementById('useEffectiveTLD');
	var fx2Items = document.getElementsByAttribute('label-fx2', '*');
	if (comparator.compare(XULAppInfo.version, '3.0') < 0) {
		useEffectiveTLD.setAttribute('collapsed', true);
		Array.slice(fx2Items).forEach(function(aItem) {
			aItem.setAttribute('label', aItem.getAttribute('label-fx2'));
		});
	}
	else {
		useEffectiveTLD.removeAttribute('collapsed');
	}

	sizeToContent();
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
	var invertScrollbar = document.getElementById('extensions.treestyletab.tabbar.invertScrollbar-check');
	var invertTab = document.getElementById('extensions.treestyletab.tabbar.invertTab-check');
	var invertTabContents = document.getElementById('extensions.treestyletab.tabbar.invertTabContents-check');
	var invertClosebox = document.getElementById('extensions.treestyletab.tabbar.invertClosebox-check');

	invertScrollbar.disabled = pos != 'left';
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

	if (comparator.compare(XULAppInfo.version, '3.0') < 0) {
		invertScrollbar.removeAttribute('collapsed');
	}
	else {
		invertScrollbar.setAttribute('collapsed', true);
	}

	var indentPref    = document.getElementById('extensions.treestyletab.enableSubtreeIndent');
	var collapsePref  = document.getElementById('extensions.treestyletab.allowSubtreeCollapseExpand');

	var indentCheck   = document.getElementById('extensions.treestyletab.enableSubtreeIndent-check');
	var collapseCheck = document.getElementById('extensions.treestyletab.allowSubtreeCollapseExpand-check');
//	var autoHideCheck = document.getElementById('extensions.treestyletab.tabbar.autoHide.enabled-check');
	var hideNewTabCheck = document.getElementById('extensions.treestyletab.tabbar.hideNewTabButton-check');

	if (aOnChange &&
		gLastStateIsVertical != (pos == 'left' || pos == 'right')) {
		gLastStateIsVertical = (pos == 'left' || pos == 'right');
		indentPref.value = indentCheck.checked =
			collapsePref.value = collapseCheck.checked = gLastStateIsVertical;
	}
	if (pos == 'left' || pos == 'right') {
		indentCheck.setAttribute('collapsed', true);
//		autoHideCheck.removeAttribute('collapsed');
		if (comparator.compare(XULAppInfo.version, '3.1b3') >= 0)
			hideNewTabCheck.removeAttribute('collapsed');
		else
			hideNewTabCheck.setAttribute('collapsed', true);
	}
	else {
		indentCheck.removeAttribute('collapsed');
//		autoHideCheck.setAttribute('collapsed', true);
		hideNewTabCheck.setAttribute('collapsed', true);
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
