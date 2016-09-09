Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'Services', 'resource://gre/modules/Services.jsm');
XPCOMUtils.defineLazyModuleGetter(this,
  'TreeStyleTabUtils', 'resource://treestyletab-modules/utils.js');

TreeStyleTabWindowHelper.extraProperties = [
	TreeStyleTabService.kID,
	TreeStyleTabService.kCOLLAPSED,
	TreeStyleTabService.kSUBTREE_COLLAPSED,
	TreeStyleTabService.kCHILDREN,
	TreeStyleTabService.kPARENT,
	TreeStyleTabService.kANCESTORS,
	TreeStyleTabService.kINSERT_BEFORE,
	TreeStyleTabService.kINSERT_AFTER
];

TreeStyleTabWindowHelper.overrideExtensionsPreInit = function TSTWH_overrideExtensionsPreInit() {
	var sv = this.service;

	// Tab Mix Plus
	if (TreeStyleTabUtils.getTreePref('compatibility.TMP')) {
		document.documentElement.setAttribute('treestyletab-enable-compatibility-tmp', true);
	}

	// TooManyTabs
	// https://addons.mozilla.org/firefox/addon/toomanytabs-saves-your-memory/
	if ('tooManyTabs' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.TooManyTabs')) {
		sv.registerExpandTwistyAreaBlocker('tooManyTabs');
	}

	// Greasemonkey
	// https://addons.mozilla.org/firefox/addon/greasemonkey/
	if (TreeStyleTabUtils.getTreePref('compatibility.Greasemonkey')) {
		try {
			if ('GM_BrowserUI' in window &&
				typeof GM_BrowserUI.openInTab == 'function') {
				window.messageManager.removeMessageListener('greasemonkey:open-in-tab', GM_BrowserUI.openInTab);
				let originalOpenInTab = GM_BrowserUI.openInTab;
				let originalTabs = [];
				GM_BrowserUI.openInTab = function(aMessage, ...aArgs) {
					if (originalTabs.length === 0)
						originalTabs = Array.slice(gBrowser.tabContainer.childNodes, 0);
					var owner = aMessage.target;
					var retVal = originalOpenInTab.call(this, aMessage, ...aArgs);
					window.setTimeout(function() {
						window.setTimeout(function() {
							if (originalTabs.length === 0)
								return;
							var currentTabs = Array.slice(gBrowser.tabContainer.childNodes, 0);
							var parent = gBrowser.treeStyleTab.getTabFromBrowser(owner);
							var insertAtFirst = TreeStyleTabUtils.getTreePref('insertNewChildAt') == sv.kINSERT_FISRT;
							var firstChild = gBrowser.treeStyleTab.getFirstChildTab(parent);
							currentTabs.forEach(function(aTab) {
								if (originalTabs.indexOf(aTab) >= 0)
									return;
								gBrowser.treeStyleTab.attachTabTo(aTab, parent, {
									insertBefore : insertAtFirst ? firstChild : null
								});
							});
							originalTabs = [];
						}, 0);
					}, 0);
					return retVal;
				};
				window.messageManager.addMessageListener('greasemonkey:open-in-tab', GM_BrowserUI.openInTab);
			}
		}
		catch(e) {
			dump('Tree Style Tab: failed to patch to Greasemonkey.\n');
			dump(e+'\n');
		}
	}

	// Duplicate in Tab Context Menu
	// https://addons.mozilla.org/firefox/addon/duplicate-in-tab-context-menu/
	if (TreeStyleTabUtils.getTreePref('compatibility.DuplicateInTabContext') &&
		'SchuzakJp' in window &&
		'DuplicateInTabContext' in SchuzakJp &&
		typeof SchuzakJp.DuplicateInTabContext.Duplicate == 'function' &&
		!SchuzakJp.DuplicateInTabContext.__treestyletab__Duplicate) {
		SchuzakJp.DuplicateInTabContext.__treestyletab__Duplicate = SchuzakJp.DuplicateInTabContext.Duplicate;
		SchuzakJp.DuplicateInTabContext.Duplicate = function(aOriginalTab, ...aArgs) {
			gBrowser.treeStyleTab.onBeforeTabDuplicate(aOriginalTab);
			return this.__treestyletab__Duplicate(aOriginalTab, ...aArgs);
		};
	}
};

TreeStyleTabWindowHelper.overrideExtensionsBeforeBrowserInit = function TSTWH_overrideExtensionsBeforeBrowserInit() {
	var sv = this.service;

	// Tab Mix Plus
	if (TreeStyleTabUtils.getTreePref('compatibility.TMP') &&
		'TMP_LastTab' in window) {
		TMP_LastTab.TabBar = gBrowser.mTabContainer;
	}
};

TreeStyleTabWindowHelper.overrideExtensionsAfterBrowserInit = function TSTWH_overrideExtensionsAfterBrowserInit() {
	var sv = this.service;
	var { AddonManager } = Component.utils.import('resource://gre/modules/AddonManager.jsm', {});

	// Selection Links
	// https://addons.mozilla.org/firefox/addon/selection-links/
	// open selection links as child tabs
	if ('selectionlinks' in window &&
		'parseSelection' in selectionlinks &&
		TreeStyleTabUtils.getTreePref('compatibility.SelectionLinks') &&
		!selectionlinks.__treestyletab__parseSelection) {
		selectionlinks.__treestyletab__parseSelection = selectionlinks.parseSelection;
		selectionlinks.parseSelection = function(...aArgs) {
			gBrowser.treeStyleTab.readyToOpenChildTabNow(gBrowser.selectedTab, true);
			return selectionlinks.__treestyletab__parseSelection(...aArgs);
		};
	}


	// Tab Mix Plus
	if (
		TreeStyleTabUtils.getTreePref('compatibility.TMP') &&
		'TabmixTabbar' in window &&
		!TMP_tabDNDObserver.__treestyletab__clearDragmark
		) {
		this.updateTabDNDObserver(TMP_tabDNDObserver);
		TMP_tabDNDObserver.__treestyletab__clearDragmark = TMP_tabDNDObserver.clearDragmark;
		TMP_tabDNDObserver.clearDragmark = function(...aArgs) {
			var result = this.__treestyletab__clearDragmark(...aArgs);
			gBrowser.treeStyleTab.tabbarDNDObserver.clearDropPosition();
			return result;
		};

		if ('TabmixContext' in window &&
			typeof TabmixContext.openMultipleLinks == 'function') {
			TabmixContext.__treestyletab__openMultipleLinks = TabmixContext.openMultipleLinks;
			TabmixContext.openMultipleLinks = function(aCheck, ...aArgs) {
				if (!aCheck)
					TreeStyleTabService.readyToOpenChildTabNow(gBrowser, true);
				return this.__treestyletab__openMultipleLinks(aCheck, ...aArgs);
			};
		}

		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case sv.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED:
							TabmixTabbar.updateScrollStatus();
							break;

						case sv.kEVENT_TYPE_FOCUS_NEXT_TAB:
							let mode = TreeStyleTabUtils.prefs.getPref('extensions.tabmix.focusTab');
							if (mode != 2 && mode != 5)
								aEvent.preventDefault();
							break;

						case 'unload':
							document.removeEventListener(sv.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, this, false);
							document.removeEventListener(sv.kEVENT_TYPE_FOCUS_NEXT_TAB, this, false);
							document.removeEventListener('unload', this, false);
							break;
					}
				}
			};
		document.addEventListener(sv.kEVENT_TYPE_TAB_COLLAPSED_STATE_CHANGED, listener, false);
		document.addEventListener(sv.kEVENT_TYPE_FOCUS_NEXT_TAB, listener, false);
		document.addEventListener('unload', listener, false);

		gBrowser.treeStyleTab.internallyTabMovingCount++; // until "TMmoveTabTo" method is overwritten
	}

	// DragIt
	// https://addons.mozilla.org/firefox/addon/dragit-formerly-drag-de-go/
	// open new tabs as children of the current tab, for links or search terms
	if ('DragIt' in window &&
		DragIt.tab &&
		DragIt.tab.open &&
		TreeStyleTabUtils.getTreePref('compatibility.DragIt') &&
		!DragIt.tab.__treestyletab__open) {
		DragIt.tab.__treestyletab__open = DragIt.tab.open;
		DragIt.tab.open = function(...aArgs) {
			TreeStyleTabService.readyToOpenChildTabNow(gBrowser);
			return this.__treestyletab__open(...aArgs);
		};
	}

	// Colorful Tabs
	// https://addons.mozilla.org/firefox/addon/colorfultabs/
	if ('colorfulTabs' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.ColorfulTabs')) {
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'TabOpen':
						case 'TreeStyleTabAttached':
						case 'TreeStyleTabParted':
							var child = aEvent.originalTarget;
							var parent = aEvent.parentTab;
							if (child && parent) {
								let color = TreeStyleTabService.SessionStore.getTabValue(parent, 'tabClr');
								if (/^\d+,\d+,\d+$/.test(color))
									color = 'rgb('+color+')';
								window.setTimeout(function() {
									colorfulTabs.setColor(child, color);
								}, 0);
							}
							else if (child) {
								TreeStyleTabService.SessionStore.setTabValue(child, 'tabClr', '');
								colorfulTabs.calcTabClr({
									target : child,
									originalTarget : child,
								});
							}
							break;

						case 'unload':
							document.removeEventListener('TabOpen', this, false);
							document.removeEventListener('TreeStyleTabAttached', this, false);
							document.removeEventListener('TreeStyleTabParted', this, false);
							document.removeEventListener('unload', this, false);
							break;
					}
				}
			};
		document.addEventListener('TabOpen', listener, false);
		document.addEventListener('TreeStyleTabAttached', listener, false);
		document.addEventListener('TreeStyleTabParted', listener, false);
		document.addEventListener('unload', listener, false);
		// hide separater between the tab bar and the toolbox
		colorfulTabs.__treestyletab__show_ctStack = colorfulTabs.show_ctStack;
		colorfulTabs.show_ctStack = function(...aArgs) {
			if (gBrowser.treeStyleTab.position != 'top')
				return document.getElementById('colorfulTabsStack').style.setProperty('display', 'none', 'important');
			return this.__treestyletab__show_ctStack(...aArgs);
		};
		setTimeout(function() {
			colorfulTabs.show_ctStack();
		}, 0);
	}

	// Focus Last Selected Tab 0.9.5.x
	// http://www.gozer.org/mozilla/extensions/
	if (TreeStyleTabUtils.getTreePref('compatibility.FocusLastSelectedTab')) {
		AddonManager.getAddonById('focuslastselectedtab@gozer.org', function(aAddon) {
			if (aAddon && aAddon.isAvailable)
				TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
					return !aTabBrowser.selectedTab.hasAttribute('lastselected');
				});
		});
	}

	// LastTab
	// https://addons.mozilla.org/firefox/addon/lasttab/
	if ('LastTab' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.LastTab')) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return !TreeStyleTabUtils.prefs.getPref('extensions.lasttab.focusLastTabOnClose');
		});
	}

	// FireGestures
	// https://addons.mozilla.org/firefox/addon/6366
	if ('FireGestures' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.FireGestures')) {
		FireGestures.__treestyletab__onExtraGesture = FireGestures.onExtraGesture;
		FireGestures.onExtraGesture = function(aEvent, aGesture, ...aArgs) {
			switch (aGesture)
			{
				case 'keypress-stop':
					TreeStyleTabService.readyToOpenChildTab(gBrowser, true);
					break;
				case 'gesture-timeout':
					TreeStyleTabService.stopToOpenChildTab(gBrowser);
					break;
			}
			return FireGestures.__treestyletab__onExtraGesture.call(this, aEvent, aGesture, ...aArgs);
		};
		FireGestures.__treestyletab__performAction = FireGestures._performAction;
		FireGestures._performAction = function(aEvent, aCommand, ...aArgs) {
			switch (aCommand)
			{
				case 'FireGestures:OpenLinkInBgTab':
				case 'FireGestures:OpenLinkInFgTab':
					TreeStyleTabService.readyToOpenChildTabNow(gBrowser);;
					break;
			}
			return FireGestures.__treestyletab__performAction.call(this, aEvent, aCommand, ...aArgs);
		};
		FireGestures.__treestyletab__handleEvent = FireGestures.handleEvent;
		FireGestures.handleEvent = function(aEvent, ...aArgs) {
			if (aEvent.type == 'command')
				TreeStyleTabService.readyToOpenChildTabNow(gBrowser);
			return FireGestures.__treestyletab__handleEvent.call(this, aEvent, ...aArgs);
		};
	}

	// SBM Counter
	// http://miniturbo.org/products/sbmcounter/
	if ('SBMCounter' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.SBMCounter') &&
		!SBMCounter.__treestyletab__action) {
		SBMCounter.__treestyletab__action = SBMCounter.action;
		SBMCounter.action = function(...aArgs) {
			TreeStyleTabService.readyToOpenChildTabNow(gBrowser);
			return this.__treestyletab__action(...aArgs);
		};
	}

	// Mouseless Browsing
	// https://addons.mozilla.org/firefox/addon/mouseless-browsing/
	if ('mouselessbrowsing' in window &&
		'EventHandler' in mouselessbrowsing &&
		TreeStyleTabUtils.getTreePref('compatibility.MouselessBrowsing')) {
		if ('execute' in mouselessbrowsing.EventHandler &&
			!mouselessbrowsing.EventHandler.__treestyletab__execute) {
			mouselessbrowsing.EventHandler.__treestyletab__execute = mouselessbrowsing.EventHandler.execute;
			mouselessbrowsing.EventHandler.execute = function(...aArgs) {
				TreeStyleTabService.readyToOpenChildTabNow();
				return this.__treestyletab__execute(...aArgs);
			};
		}
		if ('openLinkInOtherLocationViaPostfixKey' in mouselessbrowsing.EventHandler &&
			!mouselessbrowsing.EventHandler.__treestyletab__openLinkInOtherLocationViaPostfixKey) {
			mouselessbrowsing.EventHandler.__treestyletab__openLinkInOtherLocationViaPostfixKey = mouselessbrowsing.EventHandler.openLinkInOtherLocationViaPostfixKey;
			mouselessbrowsing.EventHandler.openLinkInOtherLocationViaPostfixKey = function(...aArgs) {
				TreeStyleTabService.readyToOpenChildTabNow();
				return this.__treestyletab__openLinkInOtherLocationViaPostfixKey(...aArgs);
			};
		}
	}

	// Linky
	// https://addons.mozilla.org/firefox/addon/linky/
	if ('LinkyContext' in window &&
		'prototype' in LinkyContext &&
		TreeStyleTabUtils.getTreePref('compatibility.Linky')) {
		let methods = 'openLink,openLinks,generateDocument'.split(',');
		for (let i = 0, maxi = methods.length; i < maxi; i++)
		{
			let method = methods[i];
			if (!(method in LinkyContext.prototype) ||
				LinkyContext.prototype['__treestyletab__' + method])
				continue;
			let orig = LinkyContext.prototype[method];
			LinkyContext.prototype['__treestyletab__' + method] = orig;
			LinkyContext.prototype[method] = function(...aArgs) {
				TreeStyleTabService.readyToOpenChildTabNow(null, true);
				return orig.call(this, ...aArgs);
			};
		}
	}

	// QuickDrag
	// https://addons.mozilla.org/firefox/addon/quickdrag/
	if ('QuickDrag' in window &&
		'_loadTab' in QuickDrag &&
		TreeStyleTabUtils.getTreePref('compatibility.QuickDrag') &&
		!QuickDrag.__treestyletab__loadTab) {
		QuickDrag.__treestyletab__loadTab = QuickDrag._loadTab;
		QuickDrag._loadTab = function(...aArgs) {
			TreeStyleTabService.readyToOpenChildTabNow();
			return this.__treestyletab__loadTab(...aArgs);
		};
	}

	// Super Tab Mode
	// https://addons.mozilla.org/firefox/addon/super-tab-mode/
	if ('stmM' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.STM')) {
		var observer = {
				domain : 'extensions.stm.',
				observe : function(aSubject, aTopic, aData)
				{
					switch (aData)
					{
						case 'extensions.stm.tabBarMultiRows':
						case 'extensions.stm.tabBarPosition':
							if (
								TreeStyleTabUtils.prefs.getPref('extensions.stm.tabBarMultiRows') &&
								TreeStyleTabUtils.prefs.getPref('extensions.stm.tabBarPosition') == 0
								) {
								TreeStyleTabUtils.prefs.setPref('extensions.stm.tabBarMultiRows.override', false);
							}
							return;

						case 'extensions.stm.newTabBtnPos':
							if (TreeStyleTabUtils.prefs.getPref(aData) == 0)
								document.documentElement.removeAttribute(TreeStyleTabService.kHIDE_NEWTAB);
							else
								document.documentElement.setAttribute(TreeStyleTabService.kHIDE_NEWTAB, true);
							return;
					}
				}
			};
		observer.observe(null, null, 'extensions.stm.tabBarMultiRows');
		observer.observe(null, null, 'extensions.stm.newTabBtnPos');
		TreeStyleTabUtils.prefs.addPrefListener(observer);
		document.addEventListener('unload', function onUnload() {
			document.removeEventListener('unload', onUnload, false);
			TreeStyleTabUtils.prefs.removePrefListener(observer);
		}, false);

		let warnPref = 'extensions.treestyletab.compatibility.STM.warnForNewTabPosition';
		if (
			TreeStyleTabUtils.prefs.getPref(warnPref) &&
			TreeStyleTabUtils.prefs.getPref('extensions.stm.newTabPosition') != 0
			) {
			let checked = { value : false };
			if (Services.prompt.confirmEx(
					null,
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_title'),
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_text'),
					(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
					(Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1),
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_use_TST'),
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_use_STM'),
					null,
					TreeStyleTabUtils.treeBundle.getString('compatibility_STM_warning_never'),
					checked
				) == 0) {
				TreeStyleTabUtils.prefs.setPref('extensions.stm.newTabPosition', 0);
			}
			if (checked.value)
				TreeStyleTabUtils.prefs.setPref(warnPref, false);
		}

		sv.registerTabFocusAllowance(function(aTabBrowser) {
			return TreeStyleTabUtils.prefs.getPref('extensions.stm.focusAfterCloseTab') == 0;
		});
	}

	// Tab Utilities Fixed
	// https://addons.mozilla.org/firefox/addon/tab-utilities-fixed/
	if ('tabutils' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.TabUtilitiesFixed')) {
		TreeStyleTabService.registerTabFocusAllowance(function(aTabBrowser) {
			return TreeStyleTabUtils.prefs.getPref('extensions.tabutils.selectOnClose') == 0;
		});
	}

	// Remove New Tab Button
	// https://addons.mozilla.org/firefox/addon/remove-new-tab-button/
	if (TreeStyleTabUtils.getTreePref('compatibility.RemoveNewTabButton')) {
		AddonManager.getAddonById('remove-new-tab-button@forerunnerdesigns.com', function(aAddon) {
			if (aAddon && aAddon.isAvailable)
				document.documentElement.setAttribute(TreeStyleTabService.kHIDE_NEWTAB, true);
		});
	}

	// InstaClick
	// https://addons.mozilla.org/firefox/addon/instaclick/
	if ('instaclick' in window &&
		'contentAreaClick2' in window.instaclick &&
		TreeStyleTabUtils.getTreePref('compatibility.InstaClick') &&
		!instaclick.__treestyletab__contentAreaClick2) {
		instaclick.__treestyletab__contentAreaClick2 = instaclick.contentAreaClick2;
		instaclick.contentAreaClick2 = function(...aArgs) {
			TreeStyleTabService.readyToOpenChildTabNow();
			return this.__treestyletab__contentAreaClick2(...aArgs);
		};
	}

	// Duplicate This Tab
	// https://addons.mozilla.org/firefox/addon/duplicate-this-tab/
	if ('duplicatethistab' in window &&
		'openLinkWithHistory' in window.duplicatethistab &&
		TreeStyleTabUtils.getTreePref('compatibility.DuplicateThisTab') &&
		!duplicatethistab.__treestyletab__openLinkWithHistory) {
		duplicatethistab.__treestyletab__openLinkWithHistory = duplicatethistab.openLinkWithHistory;
		duplicatethistab.openLinkWithHistory = function(...aArgs) {
			gBrowser.treeStyleTab.onBeforeTabDuplicate();
			return this.__treestyletab__openLinkWithHistory(...aArgs);
		};
		duplicatethistab.__treestyletab__duplicateInTab = duplicatethistab.duplicateInTab;
		duplicatethistab.duplicateInTab = function(...aArgs) {
			gBrowser.treeStyleTab.onBeforeTabDuplicate();
			return this.__treestyletab__duplicateInTab(...aArgs);
		};
	}

	// Context Search
	// https://addons.mozilla.org/firefox/addon/context-search/
	if ('contextsearch' in window &&
		'search' in window.contextsearch &&
		TreeStyleTabUtils.getTreePref('compatibility.ContextSearch') &&
		!contextsearch.__treestyletab__search) {
		contextsearch.__treestyletab__search = contextsearch.search;
		contextsearch.search = function(...aArgs) {
			TreeStyleTabService.readyToOpenChildTabNow();
			return this.__treestyletab__search(...aArgs);
		};
	}

	// Tile Tabs
	// https://addons.mozilla.org/firefox/addon/tile-tabs/
	if ('tileTabs' in window &&
		TreeStyleTabUtils.getTreePref('compatibility.TileTabs')) {
		if ('allocateTab' in window.tileTabs &&
			!tileTabs.__treestyletab__allocateTab) {
			tileTabs.__treestyletab__allocateTab = tileTabs.allocateTab;
			tileTabs.allocateTab = function(...aArgs) {
				TreeStyleTabService.readyToOpenNextSiblingTabNow();
				return this.__treestyletab__allocateTab(...aArgs);
			};
		}
		if ('doClickBrowser' in window.tileTabs &&
			!tileTabs.__treestyletab__doClickBrowser) {
			tileTabs.__treestyletab__doClickBrowser = tileTabs.doClickBrowser;
			tileTabs.doClickBrowser = function(...aArgs) {
				TreeStyleTabService.readyToOpenNextSiblingTabNow();
				return this.__treestyletab__doClickBrowser(...aArgs);
			};
		}
		if ('doDropBrowserTile' in window.tileTabs &&
			!tileTabs.__treestyletab__doDropBrowserTile) {
			tileTabs.__treestyletab__doDropBrowserTile = tileTabs.doDropBrowserTile;
			tileTabs.doDropBrowserTile = function(...aArgs) {
				TreeStyleTabService.readyToOpenNextSiblingTabNow();
				return this.__treestyletab__doDropBrowserTile(...aArgs);
			};
		}
		if ('menuActions' in window.tileTabs &&
			!tileTabs.__treestyletab__menuActions) {
			tileTabs.__treestyletab__menuActions = tileTabs.menuActions;
			tileTabs.menuActions = function(...aArgs) {
				TreeStyleTabService.readyToOpenNextSiblingTabNow();
				return this.__treestyletab__menuActions(...aArgs);
			};
		}
		if ('applyLayoutString' in window.tileTabs &&
			!tileTabs.__treestyletab__applyLayoutString) {
			tileTabs.__treestyletab__applyLayoutString = tileTabs.applyLayoutString;
			tileTabs.applyLayoutString = function(...aArgs) {
				TreeStyleTabService.readyToOpenNextSiblingTabNow();
				return this.__treestyletab__applyLayoutString(...aArgs);
			};
		}
	}

	window.setTimeout(function(aSelf) {
		aSelf.overrideExtensionsDelayed();
	}, 0, this);
};


TreeStyleTabWindowHelper.overrideExtensionsDelayed = function TSTWH_overrideExtensionsDelayed() {
	var sv = this.service;

	// Tab Mix Plus
	if (TreeStyleTabUtils.getTreePref('compatibility.TMP') &&
		'TabmixTabbar' in window) {
		// correct broken appearance of the first tab
		var t = gBrowser.treeStyleTab.getFirstTab(gBrowser);
		gBrowser.treeStyleTab.initTabAttributes(t);
		gBrowser.treeStyleTab.initTabContentsOrder(t);
		gBrowser.treeStyleTab.internallyTabMovingCount--;
	}

	// Multi Links Plus
	// https://addons.mozilla.org/firefox/addon/multi-links-plus/
	if ('MultiLinks_Wrapper' in window &&
		'LinksManager' in MultiLinks_Wrapper &&
		'OpenInNewTabs' in MultiLinks_Wrapper.LinksManager &&
		!MultiLinks_Wrapper.LinksManager.__treestyletab__OpenInNewTabs &&
		TreeStyleTabUtils.getTreePref('compatibility.MultiLinksPlus')) {
		MultiLinks_Wrapper.LinksManager.__treestyletab__OpenInNewTabs = MultiLinks_Wrapper.LinksManager.OpenInNewTabs;
		MultiLinks_Wrapper.LinksManager.OpenInNewTabs = function(...aArgs) {
			if (!TreeStyleTabService.checkToOpenChildTab(getBrowser()))
				TreeStyleTabService.readyToOpenChildTab(getBrowser(), true);
			var result = this.__treestyletab__OpenInNewTabs(...aArgs);
			if (TreeStyleTabService.checkToOpenChildTab(getBrowser()))
				TreeStyleTabService.stopToOpenChildTab(getBrowser());
			return result;
		};
	}

	// Personal Titlebar
	// https://addons.mozilla.org/firefox/addon/personal-titlebar/
	if (document.getElementById('personal-titlebar') &&
		TreeStyleTabUtils.getTreePref('compatibility.PersonalTitlebar')) {
		let titlebar = document.getElementById('titlebar');
		let personalTitlebar = document.getElementById('personal-titlebar');
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'beforecustomization':
							titlebar.removeEventListener('DOMAttrModified', this, true);
							gBrowser.treeStyleTab.destroyTabStrip(personalTitlebar);
							break;

						case 'aftercustomization':
							titlebar.addEventListener('DOMAttrModified', this, true);
							break;

						case 'DOMAttrModified':
							if (
								aEvent.attrName == 'hidden' &&
								gBrowser.tabContainer.parentNode.id == (aEvent.newValue == 'true' ? 'toolbar-menubar' : 'personal-titlebar' )
								) {
								gBrowser.treeStyleTab.destroyTabbar()
									.then(function() {
										gBrowser.treeStyleTab.reinitTabbar();
									});
							}
							break;

						case 'unload':
							titlebar.removeEventListener('DOMAttrModified', this, true);
							document.removeEventListener('beforecustomization', this, false);
							document.removeEventListener('aftercustomization', this, false);
							document.removeEventListener('unload', this, false);
							personalTitlebar = null;
							break;
					}
				}
			};
		document.addEventListener('beforecustomization', listener, false);
		document.addEventListener('aftercustomization', listener, false);
		document.addEventListener('unload', listener, false);
		titlebar.addEventListener('DOMAttrModified', listener, true);
	}

	// Tab Control
	// https://addons.mozilla.org/firefox/addon/tab-control/
	if (
		TreeStyleTabUtils.getTreePref('compatibility.TabControl') &&
		'gTabControl' in window
		) {
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case sv.kEVENT_TYPE_FOCUS_NEXT_TAB:
							if (TreeStyleTabUtils.prefs.getPref('tabcontrol.focusLeftOnClose'))
								aEvent.preventDefault();
							break;

						case 'unload':
							document.removeEventListener(sv.kEVENT_TYPE_FOCUS_NEXT_TAB, this, false);
							break;
					}
				}
			};
		document.addEventListener(sv.kEVENT_TYPE_FOCUS_NEXT_TAB, listener, false);
		document.addEventListener('unload', listener, false);
	}

	// Firefox Sync (Weave)
	// http://www.mozilla.com/en-US/firefox/sync/
	if (
		(
			'gFxWeaveGlue' in window || // addon
			'gSyncUI' in window // Firefox 4 built-in
		) &&
		TreeStyleTabUtils.getTreePref('compatibility.FirefoxSync')
		) {
		let ns = {};
		try { // 1.4
			Components.utils.import('resource://services-sync/service.js', ns);
		}
		catch(e) { // 1.3
			Components.utils.import('resource://weave/service.js', ns);
		}
		let listener = {
				handleEvent : function(aEvent)
				{
					switch (aEvent.type)
					{
						case 'TabOpen':
							let tab = aEvent.originalTarget
							let b = TreeStyleTabService.getTabBrowserFromChild(tab);
							if (b.selectedTab.linkedBrowser.currentURI.spec != 'about:sync-tabs')
								return;

							let service = ns.Service || ns.Weave /* old name */;
							let manager = service.engineManager || service.Engines /* old name */;
							let engine = manager.get('tabs');

							let parent = b.selectedTab;
							window.setTimeout(function() {
								let uri = tab.linkedBrowser.userTypedValue || tab.linkedBrowser.currentURI.spec;
								for (let [guid, client] in Iterator(engine.getAllClients()))
								{
									if (client.tabs.some(function({ urlHistory }) {
											return urlHistory[0] == uri;
										})) {
										if (parent.parentNode &&
											tab.parentNode &&
											!b.treeStyleTab.getParentTab(tab))
											b.treeStyleTab.attachTabTo(tab, parent);
										return;
									}
								}
							}, 0);
							return;

						case 'unload':
							document.removeEventListener('TabOpen', this, true);
							document.removeEventListener('unload', this, false);
							return;
					}
				}
			};
		document.addEventListener('TabOpen', listener, true);
		document.addEventListener('unload', listener, false);
	}

};
