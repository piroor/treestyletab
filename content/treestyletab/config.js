Components.utils.import('resource://gre/modules/Services.jsm');

const XULAppInfo = Services.appinfo;
const comparator = Services.vc;
var Prefs = Services.prefs;

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Components.utils.import('resource://treestyletab-modules/lib/animationManager.js');
Components.utils.import('resource://treestyletab-modules/lib/prefs.js');
Components.utils.import('resource://treestyletab-modules/utils.js');

var gStringBundle;

function syncEnabledState(aElement, aEnabled)
{
	if (typeof aElement == 'string')
		aElement = document.getElementById(aElement);
	if (typeof aEnabled == 'function')
		aEnabled = aEnabled.call(aElement);

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
	gGroupBookmarkBehaviorPref;

function ensureGroupBookmarkItems()
{
	if (gGroupBookmarkBehaviorPref) return;

	gGroupBookmarkRadio        = document.getElementById('openGroupBookmark-radiogroup');
	gGroupBookmarkUnderParent  = document.getElementById('openGroupBookmark.underParent-check');
	gGroupBookmarkType         = document.getElementById('openGroupBookmark.subtreeType-menulist');
	gGroupBookmarkBehaviorPref = document.getElementById('extensions.treestyletab.openGroupBookmark.behavior');
}

function init()
{
	ensureGroupBookmarkItems();

	gStringBundle = document.getElementById('treestyletab-bundle');

//	sizeToContent();
}


function initAppearancePane()
{
	onChangeTabbarPosition();

	var sidebar = document.getElementById('extensions.treestyletab.tabbar.style-sidebar');
	sidebar.removeAttribute('disabled');
	
	var boxes = [
			document.getElementById('extensions.treestyletab.tabbar.style-arrowscrollbox'),
			document.getElementById('extensions.treestyletab.twisty.style-arrowscrollbox')
		];
	[...boxes[0].childNodes].concat([...boxes[1].childNodes]).forEach(function(aItem) {
		let start       = 0;
		let delta       = 200;
		let radian      = 90 * Math.PI / 180;
		aItem.style.overflow = 'hidden';
		aItem.width = 0;
		aItem.style.maxWidth = 0;
		let task = function(aTime, aBeginning, aChange, aDuration) {
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
		animationManager.addTask(task, 0, 0, 500, window);
	});
}

function readOverrideSize(aFieldId)
{
	var field = document.getElementById(aFieldId);
	var overrideKey = field.getAttribute('preference');
	var regularKey = overrideKey.replace(/\.override$/, '');
	var regularPref = document.getElementById(regularKey);
	return regularPref.value;
}

function writeOverrideSize(aFieldId)
{
	var field = document.getElementById(aFieldId);
	var overrideKey = field.getAttribute('preference');
	var regularKey = overrideKey.replace(/\.override$/, '');
	var regularPref = document.getElementById(regularKey);
	regularPref.value = field.value;
	return field.value;
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
	newTabPref.removeAttribute('hidden');
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

	var nodes = [
			gGroupBookmarkUnderParent,
			gGroupBookmarkType,
			gGroupBookmarkType.previousSibling,
			gGroupBookmarkType.nextSibling
		];
	for (let i = 0, maxi = nodes.length; i < maxi; i++)
	{
		let node = nodes[i];
		if (behavior & 1)
			node.removeAttribute('disabled');
		else
			node.setAttribute('disabled', true);
	}

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

	var horizontalElements = [
		'maxTreeLevel-horizontal',
		'fixedTabbar-horizontal'
	];
	var verticalElements = [
		'maxTreeLevel-vertical',
		'fixedTabbar-vertical'
	];
	if (pos == 'left' || pos == 'right') {
		horizontalElements.forEach(function(aId) {
			document.getElementById(aId).setAttribute('collapsed', true);
		});
		verticalElements.forEach(function(aId) {
			document.getElementById(aId).removeAttribute('collapsed');
		});
	}       
	else {
		horizontalElements.forEach(function(aId) {
			document.getElementById(aId).removeAttribute('collapsed');
		});
		verticalElements.forEach(function(aId) {
			document.getElementById(aId).setAttribute('collapsed', true);
		});
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
	syncEnabledState('extensions.treestyletab.tabbar.autoShow.mousemove-check', function() { return this.checked; });
	syncEnabledState('extensions.treestyletab.tabbar.autoShow.accelKeyDown-check', function() { return this.checked; });
	syncEnabledState('extensions.treestyletab.tabbar.autoShow.feedback-check', function() { return this.checked; });
}

function onChangeAutoHideMode(aRadioGroup, aTogglePref)
{
	if (aRadioGroup.value != 0)
		document.getElementById(aTogglePref).value = aRadioGroup.value;
}


function initTreePane()
{
	syncEnabledState('extensions.treestyletab.closeParentBehavior-radiogroup', function() { return this.value == 0; });

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

function saveConfigsToFile() {
	var configs = {};

	prefs.getDescendant('extensions.treestyletab.').forEach(function(aKey) {
		var value = prefs.getPref(aKey);
		var defaultPref = prefs.getDefaultPref(aKey);
		if (value !== null &&
			value !== defaultPref)
			configs[aKey] = value;
	});

	pickFile(gStringBundle.getString('migration.configsSaved.choose'), 'tst-config.txt')
		.then(function(aFile) {
			writeTo(JSON.stringify(configs), aFile, 'UTF-8');
			Services.prompt.alert(window,
				gStringBundle.getString('migration.configsSaved.title'),
				gStringBundle.getString('migration.configsSaved.text')
			);
		});
}

function saveTreeToFile() {
	var structures = [];

	var windows = Services.wm.getEnumerator('navigator:browser');
	while (windows.hasMoreElements())
	{
		let window = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
		let tabs = Array.slice(window.gBrowser.tabs);
		let structure = TreeStyleTabUtils.getTreeStructureFromTabs(tabs, true);
		structures.push(structure);
	}

	pickFile(gStringBundle.getString('migration.treeSaved.choose'), 'tst-tree.txt')
		.then(function(aFile) {
			writeTo(JSON.stringify(structures), aFile, 'UTF-8');
			Services.prompt.alert(window,
				gStringBundle.getString('migration.treeSaved.title'),
				gStringBundle.getString('migration.treeSaved.text')
			);
		});
}

function pickFile(aTitle, aDefaultFileName) 
{
	const nsIFilePicker = Ci.nsIFilePicker;

	var picker = Cc['@mozilla.org/filepicker;1']
		.createInstance(nsIFilePicker);
	picker.defaultExtension = '.txt';
	picker.defaultString = aDefaultFileName;
	picker.init(window, aTitle, nsIFilePicker.modeSave);
	picker.appendFilters(nsIFilePicker.filterAll);
	return new Promise(function(aResolve, aReject) {
		picker.open({ done: function(aResult) {
			if (aResult == nsIFilePicker.returnOK ||
				aResult == nsIFilePicker.returnReplace) {
				aResolve(picker.file.QueryInterface(Ci.nsIFile));
			}
			else {
				aResolve(null);
			}
		}});
	});
}

function writeTo(aContent, aFile, aEncoding)
{
	(function createDir(aDir) {
		try {
			if (aDir.parent) createDir(aDir.parent);
			if (aDir.exists()) return;
			aDir.create(aDir.DIRECTORY_TYPE, 0755);
		}
		catch(e) {
		}
	})(aFile.parent);

	if (aFile.exists()) aFile.remove(true);
	aFile.create(aFile.NORMAL_FILE_TYPE, 0666);

	var stream = Cc['@mozilla.org/network/file-output-stream;1']
			.createInstance(Ci.nsIFileOutputStream);
	stream.init(aFile, 2, 0x200, false); // open as "write only"

	if (aEncoding) {
		var converterStream = Cc['@mozilla.org/intl/converter-output-stream;1']
				.createInstance(Ci.nsIConverterOutputStream);
		var buffer = aContent.length;
		converterStream.init(stream, aEncoding, buffer, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
		converterStream.writeString(aContent);
		converterStream.close();
	}
	else {
		stream.write(aContent, aContent.length);
	}

	stream.close();

	return aFile;
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
