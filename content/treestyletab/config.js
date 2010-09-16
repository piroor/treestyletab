const XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1']
		.getService(Components.interfaces.nsIXULAppInfo);
const comparator = Components.classes['@mozilla.org/xpcom/version-comparator;1']
					.getService(Components.interfaces.nsIVersionComparator);
var Prefs = Components
		.classes['@mozilla.org/preferences;1']
		.getService(Components.interfaces.nsIPrefBranch);

Components.utils.import('resource://treestyletab-modules/animationManager.js', {});
Components.utils.import('resource://treestyletab-modules/prefs.js', {});
Components.utils.import('resource://treestyletab-modules/namespace.jsm');
var animationManager = getNamespaceFor('piro.sakura.ne.jp')['piro.sakura.ne.jp'].animationManager;
var prefs = getNamespaceFor('piro.sakura.ne.jp')['piro.sakura.ne.jp'].prefs;

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
		gGroupBookmarkReplacePref.value = prefs.getPref(bookmarkReplaceKey);
	}
	catch(e) {
		prefs.setPref(bookmarkReplaceKey, gGroupBookmarkReplacePref.value != 'false');
	}
}

function init()
{
	ensureGroupBookmarkItems();

	var animation = document.getElementById('extensions.treestyletab.animation.enabled-check');
	if (prefs.getPref('browser.tabs.animate') === false)
		animation.setAttribute('disabled', true);
	else
		animation.removeAttribute('disabled');

//	sizeToContent();
}


function initAppearancePane()
{
	onChangeTabbarPosition();

	var mixed = document.getElementById('extensions.treestyletab.tabbar.style-mixed');
	if (comparator.compare(XULAppInfo.version, '3.5') >= 0) {
		mixed.removeAttribute('disabled');
	}
	else {
		if (mixed.checked)
			document.getElementById('extensions.treestyletab.tabbar.style-flat').checked = true;
		mixed.setAttribute('disabled', true);
	}

	var sidebar = document.getElementById('extensions.treestyletab.tabbar.style-sidebar');
	if (comparator.compare(XULAppInfo.version, '3.6') >= 0) {
		sidebar.removeAttribute('disabled');
	}
	else {
		sidebar.setAttribute('disabled', true);
	}

	var hideAllTabsButton = document.getElementById('hideAlltabsButton-box');
	if (comparator.compare(XULAppInfo.version, '4.0b3') > 0) {
		hideAllTabsButton.setAttribute('hidden', true);
	}
	else {
		hideAllTabsButton.removeAttribute('hidden');
	}

	var boxes = [
			document.getElementById('extensions.treestyletab.tabbar.style-arrowscrollbox'),
			document.getElementById('extensions.treestyletab.twisty.style-arrowscrollbox')
		];
	Array.slice(boxes[0].childNodes).concat(Array.slice(boxes[1].childNodes))
	.forEach(function(aItem) {
		var start       = 0;
		var delta       = 200;
		var radian      = 90 * Math.PI / 180;
		aItem.style.overflow = 'hidden';
		aItem.width = 0;
		aItem.style.maxWidth = 0;
		var task = function(aTime, aBeginning, aChange, aDuration) {
			var width;
			if (aTime >= aDuration) {
				width = start + delta;
				finished = true;
			}
			else {
				width = start + (delta * Math.sin(aTime / aDuration * radian));
				finished = false;
			}
			aItem.removeAttribute('width');
			aItem.style.maxWidth = parseInt(width)+'px';

			var itemBox = aItem.boxObject;
			var parentBox = aItem.parentNode.boxObject;
			if (
				parentBox.screenX > itemBox.screenX ||
				parentBox.screenX + parentBox.width < itemBox.screenX + itemBox.width
				) {
				aItem.parentNode.setAttribute('overflow', true);
				if (aItem.selected)
					aItem.parentNode.scrollBoxObject.ensureElementIsVisible(aItem);
			}

			if (finished) {
				start = null;
				delta = null;
				radian = null;
				aItem = null;
			}
			return finished;
		};
		animationManager.addTask(task, 0, 0, 500);
	});
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
		restriction.value = prefs.getPref(restrictionKey);
	}
	catch(e) {
		prefs.setPref(restrictionKey, parseInt(restriction.value));
	}

	gLastStateIsVertical = document.getElementById('extensions.treestyletab.tabbar.position-radiogroup').value;
	gLastStateIsVertical = gLastStateIsVertical == 'left' || gLastStateIsVertical == 'right';

	setUpTabbox('newTab-tabbox');
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
	var hideAllTabsCheckH = document.getElementById('extensions.treestyletab.tabbar.hideAlltabsButton.horizontal-check');
	var hideAllTabsCheckV = document.getElementById('extensions.treestyletab.tabbar.hideAlltabsButton.vertical-check');

	if (pos == 'left' || pos == 'right') {
		indentCheckH.setAttribute('collapsed', true);
		indentCheckV.removeAttribute('collapsed');
		collapseCheckH.setAttribute('collapsed', true);
		collapseCheckV.removeAttribute('collapsed');
		hideAllTabsCheckH.setAttribute('collapsed', true);
		hideAllTabsCheckV.removeAttribute('collapsed');
	}       
	else {
		indentCheckH.removeAttribute('collapsed');
		indentCheckV.setAttribute('collapsed', true);
		collapseCheckH.removeAttribute('collapsed');
		collapseCheckV.setAttribute('collapsed', true);
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


var gUndoCloseTabSetRadioSet;

function initTreePane()
{
	updateCloseRootBehaviorCheck();

	gUndoCloseTabSetRadioSet = new RadioSet(
		'extensions.treestyletab.undoCloseTabSet.behavior',
		'undoCloseTabSet-radiogroup',
		'undoCloseTabSet-check',
		'undoCloseTabSet-deck',
		1
	);

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

function RadioSet(aPref, aRadio, aCheck, aDeck, aAskFlag)
{
	this.pref  = document.getElementById(aPref);
	this.radio = document.getElementById(aRadio);
	this.check = document.getElementById(aCheck);
	this.deck  = document.getElementById(aDeck);
	this.backup = this.value || 1;
	this.askValue = aAskFlag;

	if (this.askValue ? this.value & this.askValue : this.value == 0 ) {
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
			if (this.askValue) {
				this.value |= this.askValue;
			}
			else {
				this.value = 0;
			}
		}
		else {
			this.deck.selectedIndex = 1;
			this.value = this.backup;
			if (this.askValue && this.value & this.askValue) {
				this.value ^= this.askValue;
			}
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

function setUpTabbox(aID)
{
	var tabbox = document.getElementById(aID);
	var pref = document.getElementById('extensions.treestyletab.preferences.'+aID+'.selectedIndex')
	if (pref.value !== null) tabbox.selectedIndex = pref.value;
	tabbox.setAttribute('onselect', 'onTabboxTabSelected("'+aID+'");');
}

function onTabboxTabSelected(aID)
{
	var tabbox = document.getElementById(aID);
	var pref = document.getElementById('extensions.treestyletab.preferences.'+aID+'.selectedIndex')
	pref.valueFromPreferences = tabbox.selectedIndex;
}
