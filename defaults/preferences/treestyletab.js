pref("extensions.treestyletab.animation.enabled",           true);
pref("extensions.treestyletab.animation.indent.duration",   200);
pref("extensions.treestyletab.animation.collapse.duration", 150);

pref("extensions.treestyletab.tabbar.width",           200);
pref("extensions.treestyletab.tabbar.height",          32);
pref("extensions.treestyletab.tabbar.shrunkenWidth",   80);
pref("extensions.treestyletab.tabbar.position",        "left");
pref("extensions.treestyletab.tabbar.position.subbrowser.enabled", false);
pref("extensions.treestyletab.tabbar.multirow",        false);
pref("extensions.treestyletab.tabbar.invertTab",       true);
pref("extensions.treestyletab.tabbar.invertTabContents", false);
pref("extensions.treestyletab.tabbar.invertClosebox",  false);
pref("extensions.treestyletab.tabbar.hideNewTabButton.horizontal",  false);
pref("extensions.treestyletab.tabbar.hideNewTabButton.vertical",    false);
pref("extensions.treestyletab.tabbar.hideAlltabsButton.horizontal", false);
pref("extensions.treestyletab.tabbar.hideAlltabsButton.vertical",   true);
pref("extensions.treestyletab.tabbar.scroll.smooth",   true);
pref("extensions.treestyletab.tabbar.scroll.duration", 250);
// default, vertigo, mixed
pref("extensions.treestyletab.tabbar.style",           "mixed");
// 0 = disabled, 1 = hide, 2 = shrink
pref("extensions.treestyletab.tabbar.autoHide.mode",       0);
pref("extensions.treestyletab.tabbar.autoHide.mode.toggle", 2);
pref("extensions.treestyletab.tabbar.autoHide.mode.fullscreen", 1);
pref("extensions.treestyletab.tabbar.autoHide.delay",      50);
pref("extensions.treestyletab.tabbar.autoHide.area",       7);
pref("extensions.treestyletab.tabbar.autoHide.expandArea", false);
// 0 = not transparent, 1 = partial transparent, 2 = completely transparent
pref("extensions.treestyletab.tabbar.transparent.style", 1);
pref("extensions.treestyletab.tabbar.transparent.partialTransparency", "0.25");
pref("extensions.treestyletab.tabbar.autoShow.mousemove", true);
pref("extensions.treestyletab.tabbar.autoShow.accelKeyDown", true);
pref("extensions.treestyletab.tabbar.autoShow.accelKeyDown.delay", 800);
pref("extensions.treestyletab.tabbar.autoShow.tabSwitch", true);
pref("extensions.treestyletab.tabbar.autoShow.feedback", false);
pref("extensions.treestyletab.tabbar.autoShow.feedback.delay", 3000);
pref("extensions.treestyletab.tabbar.autoShow.keepShownOnMouseover", true);
pref("extensions.treestyletab.tabbar.togglerSize", 5);
pref("extensions.treestyletab.tabbar.fixed.horizontal", true);
pref("extensions.treestyletab.tabbar.fixed.vertical", false);
pref("extensions.treestyletab.tabbar.syncRelatedPrefsForDynamicPosition", true);
pref("extensions.treestyletab.enableSubtreeIndent.horizontal", false);
pref("extensions.treestyletab.enableSubtreeIndent.vertical",   true);
pref("extensions.treestyletab.enableSubtreeIndent.allTabsPopup", true);
pref("extensions.treestyletab.allowSubtreeCollapseExpand.horizontal", false);
pref("extensions.treestyletab.allowSubtreeCollapseExpand.vertical",   true);
pref("extensions.treestyletab.showBorderForFirstTab",  false);
pref("extensions.treestyletab.autoExpand.enabled",     true);
pref("extensions.treestyletab.autoExpand.delay",       500);
pref("extensions.treestyletab.autoExpand.intelligently", true);
pref("extensions.treestyletab.autoExpand.collapseFinally", false);
pref("extensions.treestyletab.indent",                 12);
pref("extensions.treestyletab.indent.property.left",   "margin-left");
pref("extensions.treestyletab.indent.property.right",  "margin-right");
pref("extensions.treestyletab.indent.property.top",    "margin-top");
pref("extensions.treestyletab.indent.property.bottom", "margin-bottom");
// 0 = first child, 1 = last child
pref("extensions.treestyletab.insertNewChildAt", 1);
pref("extensions.treestyletab.twisty.style", "auto"); // none, retro, modern-black, modern-white, auto
pref("extensions.treestyletab.twisty.expandSensitiveArea", true);
pref("extensions.treestyletab.clickOnIndentSpaces.enabled", true);
pref("extensions.treestyletab.tooltip.includeChildren",  true);

pref("extensions.treestyletab.show.openSelectionLinks", true);
pref("extensions.treestyletab.show.context-item-reloadTabSubTree", true);
pref("extensions.treestyletab.show.context-item-reloadDescendantTabs", false);
pref("extensions.treestyletab.show.context-item-removeTabSubTree", true);
pref("extensions.treestyletab.show.context-item-removeDescendantTabs", false);
pref("extensions.treestyletab.show.context-item-collapseAllSubtree", true);
pref("extensions.treestyletab.show.context-item-expandAllSubtree", true);
pref("extensions.treestyletab.show.context-item-toggleAutoHide", true);
pref("extensions.treestyletab.show.context-item-toggleFixed", true);
pref("extensions.treestyletab.show.context-menu-tabbarPosition", true);
pref("extensions.treestyletab.show.context-item-bookmarkTabSubTree", true);

pref("extensions.treestyletab.openOuterLinkInNewTab",              false);
pref("extensions.treestyletab.openAnyLinkInNewTab",                false);
pref("extensions.treestyletab.link.invertDefaultBehavior",         true);
pref("extensions.treestyletab.urlbar.loadDifferentDomainToNewTab", true);
pref("extensions.treestyletab.urlbar.loadDifferentDomainToNewTab.asChild", false);
pref("extensions.treestyletab.urlbar.loadSameDomainToNewTab",      true);
pref("extensions.treestyletab.urlbar.loadSameDomainToNewTab.asChild", true);
pref("extensions.treestyletab.urlbar.invertDefaultBehavior",       true);
// 0 = always ask, 1 = load into the tab, 2 = open new child tab
pref("extensions.treestyletab.dropLinksOnTab.behavior", 0);
// 0 = always ask, 1 = tree, 2 = separate, 4 = replace
// 256 = use dummy tab (for subtree)
// 512 = do not restore tree structure
pref("extensions.treestyletab.openGroupBookmark.behavior", 256);
pref("extensions.treestyletab.useEffectiveTLD", true);

pref("extensions.treestyletab.autoCollapseExpandSubTreeOnSelect",      true);
pref("extensions.treestyletab.autoCollapseExpandSubTreeOnSelect.onCurrentTabRemove", true);
pref("extensions.treestyletab.autoCollapseExpandSubTreeOnSelect.whileFocusMovingByShortcut", false);
pref("extensions.treestyletab.collapseExpandSubTree.dblclick",         false);
pref("extensions.treestyletab.autoExpandSubTreeOnCollapsedChildFocused", true);
pref("extensions.treestyletab.autoExpandSubTreeOnAppendChild",         true);
pref("extensions.treestyletab.autoAttachNewTabsAsChildren", true);
// 0 = default, 1 = only visible tabs
pref("extensions.treestyletab.focusMode", 1);
/*
  3 = escalate only the first child tab to the parent level
  0 = escalate all children to the parent level
  1 = detach all children
  2 = close all children too
*/
pref("extensions.treestyletab.closeParentBehavior", 3);
/*
  3 = escalate only the first child tab to the root level
  1 = escalate all children to new roots (=detach all children)
  Note: this affects only when closeParentBehavior == 0
*/
pref("extensions.treestyletab.closeRootBehavior", 3);
pref("extensions.treestyletab.createSubTree.underParent", true);


pref("browser.link.open_newwindow.restriction.override", 0);
pref("browser.tabs.loadFolderAndReplace.override", false);


pref("extensions.multipletab.show.multipletab-selection-item-removeTabSubTree", true);
pref("extensions.multipletab.show.multipletab-selection-item-createSubTree", true);


pref("extensions.treestyletab.TMP.doNotUpdate.isTabVisible", false);


pref("extensions.treestyletab.prefsVersion", 0);


pref("extensions.treestyletab@piro.sakura.ne.jp.name", "chrome://treestyletab/locale/treestyletab.properties");
pref("extensions.treestyletab@piro.sakura.ne.jp.description", "chrome://treestyletab/locale/treestyletab.properties");
