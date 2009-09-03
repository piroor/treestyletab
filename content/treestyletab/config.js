const XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1']
		.getService(Components.interfaces.nsIXULAppInfo);
const comparator = Components.classes['@mozilla.org/xpcom/version-comparator;1']
					.getService(Components.interfaces.nsIVersionComparator);
var Prefs = Components
		.classes['@mozilla.org/preferences;1']
		.getService(Components.interfaces.nsIPrefBranch);

var gGroupBookmarkRadio,
	gGroupBookmarkUnderParent,
	gGroupBookmarkType,
	gGroupBookmarkBehaviorPref,
	gGroupBookmarkReplacePref;

function ensureGroupBookmarkItems()
{
	if (gGroupBookmarkBehaviorPref) return;

	gGroupBookmarkRadio        = document.getElementById('openGroupBookmark-radiogroup');
	gGroupBookmarkUnderParent  = document.getElementById('openGroupBookmark.underParent-check');
	gGroupBookmarkType         = document.getElementById('openGroupBookmark.subtreeType-menulist');
	gGroupBookmarkBehaviorPref = document.getElementById('extensions.treestyletab.openGroupBookmark.behavior');
	var bookmarkReplaceKey = 'browser.tabs.loadFolderAndReplace';
	gGroupBookmarkReplacePref = document.getElementById(bookmarkReplaceKey);
	try {
		gGroupBookmarkReplacePref.value = Prefs.getBoolPref(bookmarkReplaceKey);
	}
	catch(e) {
		Prefs.setBoolPref(bookmarkReplaceKey, gGroupBookmarkReplacePref.value != 'false');
	}
}

function init()
{
	ensureGroupBookmarkItems();
//	sizeToContent();
}


var gDropLinksOnRadioSet,
	gGroupBookmarkRadioSet,
	gOpenLinkInTabScale,
	gLoadLocationBarToNewTabScale,
	gLoadLocationBarToChildTabScale,
	gLastStateIsVertical;
var gTabbarPlacePositionInitialized = false;

function initTabPane()
{
	gDropLinksOnTabRadioSet = new RadioSet(
		'extensions.treestyletab.dropLinksOnTab.behavior',
		'dropLinksOnTab-radiogroup',
		'dropLinksOnTab-check',
		'dropLinksOnTab-deck'
	);
	gGroupBookmarkRadioSet = new RadioSet(
		'extensions.treestyletab.openGroupBookmark.behavior',
		'openGroupBookmark-radiogroup',
		'openGroupBookmark-check',
		'openGroupBookmark-deck'
	);

	gOpenLinkInTabScale = new ScaleSet(
		['extensions.treestyletab.openOuterLinkInNewTab',
		 'extensions.treestyletab.openAnyLinkInNewTab'],
		'openLinkInNewTab-scale',
		'openLinkInNewTab-labels'
	);
	gLoadLocationBarToNewTabScale = new ScaleSet(
		['extensions.treestyletab.urlbar.loadDifferentDomainToNewTab',
		 'extensions.treestyletab.urlbar.loadSameDomainToNewTab'],
		'loadLocationBarToNewTab-scale',
		'loadLocationBarToNewTab-labels'
	);
	gLoadLocationBarToChildTabScale = new ScaleSet(
		['extensions.treestyletab.urlbar.loadSameDomainToNewTab.asChild',
		 'extensions.treestyletab.urlbar.loadDifferentDomainToNewTab.asChild'],
		'loadLocationBarToChildTab-scale',
		'loadLocationBarToChildTab-labels'
	);

	gLoadLocationBarToChildTabScale.disabled = gLoadLocationBarToNewTabScale.value == 0;


	var restrictionKey = 'browser.link.open_newwindow.restriction';
	var restriction = document.getElementById(restrictionKey);
	try {
		restriction.value = Prefs.getIntPref(restrictionKey);
	}
	catch(e) {
		Prefs.setIntPref(restrictionKey, parseInt(restriction.value));
	}

	gLastStateIsVertical = document.getElementById('extensions.treestyletab.tabbar.position-radiogroup').value;
	gLastStateIsVertical = gLastStateIsVertical == 'left' || gLastStateIsVertical == 'right';
}

function onSyncGroupBookmarkUIToPref()
{
	ensureGroupBookmarkItems();
	var behavior = gGroupBookmarkBehaviorPref.value;
	if (behavior & 1) behavior ^= 1;
	if (behavior & 2) behavior ^= 2;
	if (behavior & 4) behavior ^= 4;
	if (behavior & 256) behavior ^= 256;
	if (behavior & 512) behavior ^= 512;

	behavior |= parseInt(gGroupBookmarkRadio.value);

	if (gGroupBookmarkUnderParent.checked) behavior |= 256;
	if (gGroupBookmarkType.value == 'true') behavior |= 512;

	[
		gGroupBookmarkUnderParent,
		gGroupBookmarkType,
		gGroupBookmarkType.previousSibling,
		gGroupBookmarkType.nextSibling
	].forEach(function(aNode) {
		if (behavior & 1)
			aNode.removeAttribute('disabled');
		else
			aNode.setAttribute('disabled', true);
	});

	return behavior;
}

function onSyncGroupBookmarkPrefToUI()
{
	ensureGroupBookmarkItems();
	var behavior = gGroupBookmarkBehaviorPref.value & 1 ? 1 :
					gGroupBookmarkBehaviorPref.value & 2 ? 2 :
					gGroupBookmarkBehaviorPref.value & 4 ? 4 :
					0;
	gGroupBookmarkUnderParent.checked = gGroupBookmarkBehaviorPref.value & 256 ? true : false ;
	gGroupBookmarkType.value = gGroupBookmarkBehaviorPref.value & 512 ? 'true' : 'false' ;
	return behavior;
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

	var newTabAvailable = comparator.compare(XULAppInfo.version, '3.5') >= 0;
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


var gAutoHideModeRadio,
	gAutoHideModeToggle,
	gTabbarTransparencyScale,
	gTabbarTransparencyLabels;
function initAutoHidePane()
{
	gAutoHideModeRadio = document.getElementById('extensions.treestyletab.tabbar.autoHide.mode-radio');
	gAutoHideModeToggle = document.getElementById('extensions.treestyletab.tabbar.autoHide.mode.toggle');
	gTabbarTransparencyScale = document.getElementById('tabbarTransparency-scale');
	gTabbarTransparencyLabels = document.getElementById('tabbarTransparency-labels');

	// for Firefox 3.0.x
	gTabbarTransparencyScale.value = document.getElementById('extensions.treestyletab.tabbar.transparent.style').value;

	updateAutoHideModeLabel();
	onTabbarTransparencyScaleChange();
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

function onTabbarTransparencyScaleChange()
{
	gTabbarTransparencyLabels.selectedIndex = gTabbarTransparencyScale.value;
}


function initTreePane()
{
	updateCloseRootBehaviorCheck();

	var focusMode = document.getElementById('extensions.treestyletab.focusMode-check');
	var focusModePref = document.getElementById('extensions.treestyletab.focusMode');
	if (focusModePref.value != focusModePref.defaultValue)
		focusMode.removeAttribute('collapsed');
	else
		focusMode.setAttribute('collapsed', true);
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



function ScaleSet(aPrefs, aScale, aLabelsContainer)
{
	this.prefs = aPrefs.map(document.getElementById, document);
	this.scale = document.getElementById(aScale);
	this.labels = Array.slice(document.getElementById(aLabelsContainer).getElementsByTagName('label'));

	this.scale.value = this.prefs[1].value ? 2 :
						this.prefs[0].value ? 1 :
							0 ;
	this.updateLabels();
}
ScaleSet.prototype = {
	onChange : function()
	{
		var value = this.value;
		this.prefs[0].value = value > 0;
		this.prefs[1].value = value > 1;
		this.updateLabels();
	},

	set value(aValue)
	{
		this.scale.value = aValue;
		this.onChange();
		return aValue;
	},
	get value()
	{
		return parseInt(this.scale.value);
	},

	set disabled(aDisabled)
	{
		if (aDisabled) {
			this.scale.setAttribute('disabled', true);
			this.labels.forEach(function(aNode) {
				aNode.setAttribute('disabled', true);
			});
		}
		else {
			this.scale.removeAttribute('disabled');
			this.labels.forEach(function(aNode) {
				aNode.removeAttribute('disabled');
			});
		}
	},
	get disabled()
	{
		return this.scale.getAttribute('disabled') == 'true';
	},

	updateLabels : function()
	{
		this.labels.forEach(function(aLabel, aIndex) {
			if (aIndex == this.value)
				aLabel.setAttribute('scale-selected', true);
			else
				aLabel.removeAttribute('scale-selected');
		}, this);
	},

	destroy : function()
	{
		this.prefs = null;
		this.scale = null;
		this.labels = null;
	}
};

function RadioSet(aPref, aRadio, aCheck, aDeck)
{
	this.pref  = document.getElementById(aPref);
	this.radio = document.getElementById(aRadio);
	this.check = document.getElementById(aCheck);
	this.deck  = document.getElementById(aDeck);
	this.backup = this.value || 1;

	if (this.value == 0) {
		this.check.checked = true;
		this.deck.selectedIndex = 0;
	}
	else {
		this.check.checked = false;
		this.deck.selectedIndex = 1;
	}
}
RadioSet.prototype = {
	onChange : function(aDontUpdatePref)
	{
		if (this.checked) {
			this.backup = this.value;
			this.deck.selectedIndex = 0;
			this.value = 0;
		}
		else {
			this.deck.selectedIndex = 1;
			this.value = this.backup;
		}
		if (!aDontUpdatePref)
			this.pref.value = this.value;
	},

	get checked()
	{
		return this.check.checked;
	},
	set checked(aValue)
	{
		return this.check.checked = aValue;
	},

	get value()
	{
		return parseInt(this.radio.value);
	},
	set value(aValue)
	{
		return this.radio.value = aValue;
	}
};
