const XULAppInfo = Components.classes['@mozilla.org/xre/app-info;1']
		.getService(Components.interfaces.nsIXULAppInfo);
const comparator = Components.classes['@mozilla.org/xpcom/version-comparator;1']
					.getService(Components.interfaces.nsIVersionComparator);
var Prefs = Components
		.classes['@mozilla.org/preferences;1']
		.getService(Components.interfaces.nsIPrefBranch);

Components.utils.import('resource://treestyletab-modules/lib/animationManager.js', {});
Components.utils.import('resource://treestyletab-modules/lib/prefs.js', {});
Components.utils.import('resource://treestyletab-modules/lib/namespace.jsm');
var animationManager = getNamespaceFor('piro.sakura.ne.jp')['piro.sakura.ne.jp'].animationManager;
var prefs = getNamespaceFor('piro.sakura.ne.jp')['piro.sakura.ne.jp'].prefs;


function syncEnabledState(aElement, aEnabled)
{
	if (typeof aElement == 'string')
		aElement = document.getElementById(aElement);
	if (typeof aEnabled == 'string')
		aEnabled = (new Function('return '+aEnabled)).call(aElement);

	aElement.getAttribute('sync-enabled-state-targets')
		.replace(/$\s+|\s+$/g, '')
		.split(/\s+/)
		.map(function(aId) {
			if (!aId)
				return;
			var target = document.getElementById(aId);
			if (aEnabled)
				target.removeAttribute('disabled');
			else
				target.setAttribute('disabled', true);
		});
}


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

	var sidebar = document.getElementById('extensions.treestyletab.tabbar.style-sidebar');
	if (comparator.compare(XULAppInfo.version, '3.6') >= 0) {
		sidebar.removeAttribute('disabled');
	}
	else {
		sidebar.setAttribute('disabled', true);
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

	var newTabPref = document.getElementById('extensions.treestyletab.autoAttach.newTabButton-box');
	if (comparator.compare(XULAppInfo.version, '4.0') >= 0)
		newTabPref.removeAttribute('hidden');
	else
		newTabPref.setAttribute('hidden', true);

	var bookmarkGroupReplacePref = document.getElementById('openGroupBookmark.replace');
	if (comparator.compare(XULAppInfo.version, '7.0') > 0) {
		if (bookmarkGroupReplacePref.selected)
			document.getElementById('openGroupBookmark.subtree').selected = true;
		bookmarkGroupReplacePref.setAttribute('hidden', true);
	}
	else {
		bookmarkGroupReplacePref.removeAttribute('hidden');
	}
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
	gGroupBookmarkUnderParent.checked = !!(gGroupBookmarkBehaviorPref.value & 256);
	gGroupBookmarkType.value = gGroupBookmarkBehaviorPref.value & 512 ? 'true' : 'false' ;
	return behavior;
}


function onChangeTabbarPosition()
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

	var maxTreeLevelH   = document.getElementById('maxTreeLevel-horizontal');
	var maxTreeLevelV   = document.getElementById('maxTreeLevel-vertical');
	var collapseCheckH = document.getElementById('extensions.treestyletab.allowSubtreeCollapseExpand.horizontal-check');
	var collapseCheckV = document.getElementById('extensions.treestyletab.allowSubtreeCollapseExpand.vertical-check');

	if (pos == 'left' || pos == 'right') {
		maxTreeLevelH.setAttribute('collapsed', true);
		maxTreeLevelV.removeAttribute('collapsed');
		collapseCheckH.setAttribute('collapsed', true);
		collapseCheckV.removeAttribute('collapsed');
	}       
	else {
		maxTreeLevelH.removeAttribute('collapsed');
		maxTreeLevelV.setAttribute('collapsed', true);
		collapseCheckH.removeAttribute('collapsed');
		collapseCheckV.setAttribute('collapsed', true);
	}

	gTabbarPlacePositionInitialized = true;
}

function onSyncMaxTreeLevelUIToPref(aTarget, aSetPrefValue)
{
	aTarget = document.getElementById(aTarget);
	if (aTarget.sync)
		return;
	aTarget.sync = true;

	var textbox = aTarget.parentNode.getElementsByTagName('textbox')[0];
	var prefValue = aTarget.checked ? textbox.value : 0 ;

	if (aSetPrefValue)
		document.getElementById(aTarget.getAttribute('preference')).value = prefValue;

	aTarget.sync = false;
	return prefValue;
}

function onSyncMaxTreeLevelPrefToUI(aTarget)
{
	aTarget = document.getElementById(aTarget);
	if (aTarget.sync)
		return;
	aTarget.sync = true;

	var pref = document.getElementById(aTarget.getAttribute('preference'));
	var value = pref.value;
	var UIValue = value != 0;

	var textbox = aTarget.parentNode.getElementsByTagName('textbox')[0];

	if (UIValue)
		textbox.value = value;

	syncEnabledState(aTarget, UIValue);

	aTarget.sync = false;
	return UIValue;
}


function initAutoHidePane()
{
	syncEnabledState('extensions.treestyletab.tabbar.autoShow.mousemove-check', 'this.checked');
	syncEnabledState('extensions.treestyletab.tabbar.autoShow.accelKeyDown-check', 'this.checked');
	syncEnabledState('extensions.treestyletab.tabbar.autoShow.feedback-check', 'this.checked');
}

function onChangeAutoHideMode(aRadioGroup, aTogglePref)
{
	if (aRadioGroup.value != 0)
		document.getElementById(aTogglePref).value = aRadioGroup.value;
}


function initTreePane()
{
	syncEnabledState('extensions.treestyletab.closeParentBehavior-radiogroup', 'this.value == 0');

	var focusMode = document.getElementById('extensions.treestyletab.focusMode-check');
	var focusModePref = document.getElementById('extensions.treestyletab.focusMode');
	if (focusModePref.value != focusModePref.defaultValue)
		focusMode.removeAttribute('collapsed');
	else
		focusMode.setAttribute('collapsed', true);
}


var gBookmarkDroppedTabsRadioSet,
	gUndoCloseTabSetRadioSet;

function initAdvancedPane()
{
	gBookmarkDroppedTabsRadioSet = new RadioSet(
		'extensions.treestyletab.bookmarkDroppedTabs.behavior',
		'bookmarkDroppedTabs-radiogroup',
		'bookmarkDroppedTabs-check',
		'bookmarkDroppedTabs-deck'
	);

	gUndoCloseTabSetRadioSet = new RadioSet(
		'extensions.treestyletab.undoCloseTabSet.behavior',
		'undoCloseTabSet-radiogroup',
		'undoCloseTabSet-check',
		'undoCloseTabSet-deck',
		1
	);
}



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
