/**
 * Activates animation effects for collapse/expand, indent/unindent.
 */
pref("extensions.treestyletab.animation.enabled",           true);
/**
 * Duration of animations.
 * DO NOT CHANGE THE PREFS ON FIREFOX 4 OR LATER, because actual duration of
 * animations are defined in CSS. (CSS Transitions)
 * These prefs are used by the JavaScript implementation.
 */
pref("extensions.treestyletab.animation.indent.duration",   200);
pref("extensions.treestyletab.animation.collapse.duration", 150);

/**
 * Size of resizable tab bar. They are completely ignored if "Tabs on Top"
 * is activated on Firefox 4 or later.
 */
pref("extensions.treestyletab.tabbar.width",           200);
pref("extensions.treestyletab.tabbar.height",          32);
pref("extensions.treestyletab.tabbar.shrunkenWidth",   80);

/**
 * Position of the tab bar, possible values are:
 *  "top", "right", "bottom" or "left".
 */
pref("extensions.treestyletab.tabbar.position",        "left");
/**
 * Compatibility for multirow horizontal tab bar (provided by Tab Mix Plus or
 * other addons). If true, tab bar can be multirow. Otherwise, multirow tab bar
 * will be disabled by TST.
 */
pref("extensions.treestyletab.tabbar.multirow",        false);

/**
 * They invert appearance of tabs for the rightside vertical tab bar.
 * "invertTab" inverts appearance of tree. Tabs will be indented from right.
 * "invertTabContents" inverts the order of elements in each tab.
 * "invertClosebox" moves only the closebox in each tab to leftmost position.
 */
pref("extensions.treestyletab.tabbar.invertTab",       true);
pref("extensions.treestyletab.tabbar.invertTabContents", false);
pref("extensions.treestyletab.tabbar.invertClosebox",  false);

/**
 * Smooth-scroll effect for the tab bar. You can change the duration.
 */
pref("extensions.treestyletab.tabbar.scroll.smooth",   true);
pref("extensions.treestyletab.tabbar.scroll.duration", 250);

/**
 * Policy for the auto-scrolling to new tabs opened on a position out of the
 * viewport of the tab bbar.
 *  0 = No scroll.
 *  1 = Scroll to the tab only when the current tab will not scrolled out.
 *  2 = Scroll to new tab always.
 */
pref("extensions.treestyletab.tabbar.scrollToNewTab.mode", 1);
/**
 * Scrollbar in the leftside vertical tab bar should be shown leftmost position
 * instead of between tabs and the content area. This option works only for
 * Firefox 4 or later.
 */
pref("extensions.treestyletab.tabbar.invertScrollbar", true);

/**
 * Scrollbar in vertical tab bar can be shown with narrow width.
 * This option works only for vertical tab bar.
 */
pref("extensions.treestyletab.tabbar.narrowScrollbar", true);
pref("extensions.treestyletab.tabbar.narrowScrollbar.size", "10px");

/**
 * The skin of the tab bar. Available styles are:
 *  "default", "flat", "mixed", "vertigo", "metal" and "sidebar".
 * To change the default style for each platform, use "platform.default.tabbar.style"
 * instead of "tabbar.style" for the default preference. Users can set
 * the selected skin directly via "tabbar.style".
 */
// pref("extensions.treestyletab.tabbar.style",      "mixed");
pref("extensions.treestyletab.platform.default.tabbar.style", "mixed");
pref("extensions.treestyletab.platform.Darwin.tabbar.style", "metal");
pref("extensions.treestyletab.platform.Linux.tabbar.style", "plain");
/**
 * Background of the vertical tab bar can be cleared. On Windows + Aero Glass,
 * Aero Glass will be applied for the vertical tab bar, if you set this to "true".
 */
pref("extensions.treestyletab.tabbar.style.aero", false);

/**
 * AutoHide style for the vertical tab bar.
 *  0 = Disabled. No autohide.
 *  1 = Hide the tab bar completely.
 *  2 = Shrink the tab bar to the width "tabbar.shrunkenWidth".
 */
pref("extensions.treestyletab.tabbar.autoHide.mode",                   0);
/**
 * AutoHide style for the vertical tab bar in the full screen mode (started by
 * F11 key). Possible values are same to "tabbar.autoHide.mode".
 */
pref("extensions.treestyletab.tabbar.autoHide.mode.fullscreen",        1);
/**
 * "Auto Hide" checkbox item in the context menu on the tab bar can be toggled
 * "checked" v.s. "unchecked". These prefs are used for "checked" in each mode.
 *  Possible values are same to "tabbar.autoHide.mode".
 */
pref("extensions.treestyletab.tabbar.autoHide.mode.toggle",            2);
pref("extensions.treestyletab.tabbar.autoHide.mode.toggle.fullscreen", 1);
/**
 * Triggers for the "Auto Hide" feature. They can be controlled via the
 * configuration dialog.
 */
pref("extensions.treestyletab.tabbar.autoHide.delay",      50);
pref("extensions.treestyletab.tabbar.autoHide.area",       7);
pref("extensions.treestyletab.tabbar.autoShow.mousemove", true);
pref("extensions.treestyletab.tabbar.autoShow.accelKeyDown", true);
pref("extensions.treestyletab.tabbar.autoShow.accelKeyDown.delay", 800);
pref("extensions.treestyletab.tabbar.autoShow.tabSwitch", true);
pref("extensions.treestyletab.tabbar.autoShow.feedback", false);
pref("extensions.treestyletab.tabbar.autoShow.feedback.delay", 3000);
/**
 * When the tab bar is automatically shown by keyboard shortcuts or other
 * reasons, the tab bar will be hidden again automatically. If you set
 * this pref to "true", TST cancels to hide the tab bar if the cursor is on the
 * expanded tab bar, even if it is shown by other triggers not mousemove.
 */
pref("extensions.treestyletab.tabbar.autoShow.keepShownOnMouseover", true);
/**
 * Size of the placeholder for "hidden tab bar".
 * When "tabbar.autoHide.mode"==1, the tab bar will be hidden completely.
 * Then, if the contents area is completely covered by a plugin process
 * (PDF, Flash, etc.), the tab bar never become visible by mousemove events.
 * To avoid this problem, TST provides a thin placeholder for such cases.
 * You can expand or shrink the splaceholder via this pref.
 */
pref("extensions.treestyletab.tabbar.togglerSize", 5);

/**
 * The "fixed" state of the tab bar. Fixed tab bar cannot be resized by
 * dragging of the splitter, and cannot be moved by drag and drop on the bar.
 * "Tabs on Top" can be activated for "top"-"fixed" tab bar.
 */
pref("extensions.treestyletab.tabbar.fixed.horizontal", true);
pref("extensions.treestyletab.tabbar.fixed.vertical", false);
/**
 * The size of the "undraggable" area of the tab bar.
 * You can change the position of the tab bar by drag and drop of the tab bar
 * itself, however, you also can do dragging action on the splitter.
 * As the result, you will unexpectedly start to drag the tab bar even when
 * you wish to drag the splitter to resize the tab bar.
 * To avoid this problem, TST ignores dragstart events fired near the splitter
 * based on this pref.
 */
pref("extensions.treestyletab.tabbar.fixed.insensitiveArea", 14);

/**
 * You can change the position of the tab bar by drag and drop with Shift key,
 * even if the tab bar is "fixed" by "tabbar.fixed.*". If this pref is "true",
 * after you drop the tab bar on another position, the "fixed" state is cleared
 * automatically. Otherwise the tab bar will be "fixed" again on the new place.
 */
pref("extensions.treestyletab.tabbar.fixed.autoCancelOnDrop", true);

/**
 * Activates indentation in the "List All Tabs" popup.
 */
pref("extensions.treestyletab.enableSubtreeIndent.allTabsPopup", true);

/**
 * These prefs activate "collaable tree" feature for horizontal and
 * vertical tab bar.
 */
pref("extensions.treestyletab.allowSubtreeCollapseExpand.horizontal", false);
pref("extensions.treestyletab.allowSubtreeCollapseExpand.vertical",   true);

/**
 * Activates "stacked tabs" in the horizontal tab bar.
 * It is very hard to know how many tabs are collapsed in a horizontal tab bar.
 * If "stacked tabs" is activated, collapsed tabs will be shown as a tab behind
 * the top-level parent tab. In this mode, you can click to select a collapsed
 * tab.
 */
pref("extensions.treestyletab.stackCollapsedTabs", true);

/**
 * Activates the border-topfor the first tab. With some theme, the tab bar is
 * possibly shown without border-top. If this pref is "true", special CSS rules
 * for border-top of the first tab will be applied.
 */
pref("extensions.treestyletab.showBorderForFirstTab",  false);

/**
 * Activates "auto-expand/collapse of tabs while dragging".
 * When you're dragging something, a collapsed tree will be expanded
 * automatically by staying on the tree for a while.
 * If "autoExpand.delay" is 500, then the collapsed tree will be expanded by
 * staying 0.5sec on the tree.
 */
pref("extensions.treestyletab.autoExpand.enabled",     true);
pref("extensions.treestyletab.autoExpand.delay",       500);
/**
 * If you set this pref to "true", TST automatically collapses all other trees
 * if a collapsed tree is expanded by staying dragging on the tree. So, as the
 * result, there will be only one expanded tree while dragging.
 * If this is "false", collapsed tree will be expanded without collapsing of
 * other tree. So, they will be many "temporally expanded" tree.
 */
pref("extensions.treestyletab.autoExpand.intelligently", true);
/**
 * If you set this pref to "true", TST automatically collapses tree which are
 * expanded by staying dragging on the tree after the dragging is finished.
 * Otherwise, expanded tree will stay expanded.
 */
pref("extensions.treestyletab.autoExpand.collapseFinally", false);

pref("extensions.treestyletab.maxTreeLevel.horizontal", 0);
pref("extensions.treestyletab.maxTreeLevel.vertical",   999);
pref("extensions.treestyletab.maxTreeLevel.phisical", false);
pref("extensions.treestyletab.indent",          12);
pref("extensions.treestyletab.indent.min",      3);
pref("extensions.treestyletab.indent.property", "margin");
pref("extensions.treestyletab.indent.autoShrink", true);
// pref("extensions.treestyletab.indent.property.top", "");
// pref("extensions.treestyletab.indent.property.right", "");
// pref("extensions.treestyletab.indent.property.bottom", "");
// pref("extensions.treestyletab.indent.property.left", "");
pref("extensions.treestyletab.platform.default.indent.property.top", "");
pref("extensions.treestyletab.platform.default.indent.property.right", "");
pref("extensions.treestyletab.platform.default.indent.property.bottom", "");
pref("extensions.treestyletab.platform.default.indent.property.left", "");
// 0 = first child, 1 = last child
pref("extensions.treestyletab.insertNewChildAt", 1);
pref("extensions.treestyletab.twisty.style", "auto"); // none, retro, modern-black, modern-white, auto
pref("extensions.treestyletab.twisty.expandSensitiveArea", true);
pref("extensions.treestyletab.clickOnIndentSpaces.enabled", true);
pref("extensions.treestyletab.tooltip.includeChildren",  true);

pref("extensions.treestyletab.show.context-item-reloadTabSubtree", true);
pref("extensions.treestyletab.show.context-item-reloadDescendantTabs", false);
pref("extensions.treestyletab.show.context-item-removeTabSubtree", true);
pref("extensions.treestyletab.show.context-item-removeDescendantTabs", false);
pref("extensions.treestyletab.show.context-item-removeAllTabsButThisTree", false);
pref("extensions.treestyletab.show.context-item-collapseAllSubtree", true);
pref("extensions.treestyletab.show.context-item-expandAllSubtree", true);
pref("extensions.treestyletab.show.context-item-toggleAutoHide", true);
pref("extensions.treestyletab.show.context-item-toggleFixed", true);
pref("extensions.treestyletab.show.context-item-bookmarkTabSubtree", true);

// 0 = always ask, 1 = load into the tab, 2 = open new child tab
pref("extensions.treestyletab.dropLinksOnTab.behavior", 0);
// value = Basic | Structure | Collapse/expand
//   Basic behavior:
//     0 = always ask
//     1 = tree
//     2 = separate
//     4 = replace
//   Structure:
//     256  = use dummy tab (for subtree)
//     1024 = use dummy tab, only if there is any orphan
//     512  = do not restore tree structure
//   Collapse/expand:
//     2048 = expand all tree
pref("extensions.treestyletab.openGroupBookmark.behavior", 2304); /* 0 | 256 | 2048 */
// 0 = always ask, 1 = bookmark all, 2 = bookmark only the parent tab
pref("extensions.treestyletab.bookmarkDroppedTabs.behavior", 0);
pref("extensions.treestyletab.taskbarPreviews.hideCollapsedTabs", true);

pref("extensions.treestyletab.autoCollapseExpandSubtreeOnSelect",      true);
pref("extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.onCurrentTabRemove", true);
pref("extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut", false);
pref("extensions.treestyletab.collapseExpandSubtree.dblclick",         false);
// -1 = restore last state, 0 = always collapse, 1 = always expand
pref("extensions.treestyletab.collapseExpandSubtree.sessionRestore", -1);
pref("extensions.treestyletab.autoExpandSubtreeOnCollapsedChildFocused", true);
pref("extensions.treestyletab.autoExpandSubtreeOnAppendChild",         true);
pref("extensions.treestyletab.autoAttach", true);
// 0 = don't attach
// 1 = attach if the search term equals to the selection in the current tab
// 2 = always attach
pref("extensions.treestyletab.autoAttach.searchResult", 1);
// 0 = don't attach (open as an independent tab)
// 1 = attach to the current tab (open as a child)
// 2 = attach to the parent of the current tab (open as a sibling)
pref("extensions.treestyletab.autoAttach.newTabCommand", 0);
// 0 = default, 1 = only visible tabs
pref("extensions.treestyletab.focusMode", 1);
/*
  3 = promote only the first child tab as the parent level
  0 = promote all children as the parent level
  1 = detach all children
  2 = close all children too
*/
pref("extensions.treestyletab.closeParentBehavior", 3);
pref("extensions.treestyletab.closeParentBehavior.moveDetachedTabsToBottom", false);
/*
  3 = promote only the first child tab as the root level
  1 = promote all children as new roots (=detach all children)
  Note: this affects only when closeParentBehavior == 0
*/
pref("extensions.treestyletab.closeRootBehavior", 3);
pref("extensions.treestyletab.createSubtree.underParent", true);
/*
  0   = do nothing.
  1   = always ask.
  2   = reopen all tabs of the tree if a member of tree is reopened.
  256 = don't reopen tree if some tabs are overflowed and lost from the history.
*/
pref("extensions.treestyletab.undoCloseTabSet.behavior", 3);

pref("extensions.treestyletab.autoRepositionStatusPanel", true);
pref("extensions.treestyletab.restoreTreeOnStartup", false);


pref("browser.link.open_newwindow.restriction.override", 0);
pref("browser.tabs.loadFolderAndReplace.override", false);
pref("browser.tabs.insertRelatedAfterCurrent.override", false);
pref("browser.tabs.insertRelatedAfterCurrent.override.force", true);

pref("extensions.multipletab.show.multipletab-selection-item-removeTabSubtree", true);
pref("extensions.multipletab.show.multipletab-selection-item-createSubtree", true);


// compatibility hack flags, can be disabled by each addon
pref("extensions.treestyletab.compatibility.Highlander", true);
pref("extensions.treestyletab.compatibility.PermaTabs", true);
pref("extensions.treestyletab.compatibility.TMP", true); // Tab Mix Plus
pref("extensions.treestyletab.compatibility.SessionManager", true);
pref("extensions.treestyletab.compatibility.FullerScreen", true);
pref("extensions.treestyletab.compatibility.TooManyTabs", true);
pref("extensions.treestyletab.compatibility.DragNDropToolbars", true);
pref("extensions.treestyletab.compatibility.OptimozTweaks", true);
pref("extensions.treestyletab.compatibility.Tabberwocky", true);
pref("extensions.treestyletab.compatibility.SelectionLinks", true);
pref("extensions.treestyletab.compatibility.SuperDragAndGo", true);
pref("extensions.treestyletab.compatibility.DragDeGo", true);
pref("extensions.treestyletab.compatibility.ColorfulTabs", true);
pref("extensions.treestyletab.compatibility.FLST", true);
pref("extensions.treestyletab.compatibility.FocusLastSelectedTab", true);
pref("extensions.treestyletab.compatibility.LastTab", true);
pref("extensions.treestyletab.compatibility.FireGestures", true);
pref("extensions.treestyletab.compatibility.MouseGesturesRedox", true);
pref("extensions.treestyletab.compatibility.Greasemonkey", true);
pref("extensions.treestyletab.compatibility.SBMCounter", true);
pref("extensions.treestyletab.compatibility.AgingTabs", true);
pref("extensions.treestyletab.compatibility.SnapLinks", true);
pref("extensions.treestyletab.compatibility.MouselessBrowsing", true);
pref("extensions.treestyletab.compatibility.Linky", true);
pref("extensions.treestyletab.compatibility.QuickDrag", true);
pref("extensions.treestyletab.compatibility.Autohide", true);
pref("extensions.treestyletab.compatibility.GoogleToolbar.Sidewiki", true);
pref("extensions.treestyletab.compatibility.SmoothlyCloseTabs", true);
pref("extensions.treestyletab.compatibility.STM", true); // Super Tab Mode
pref("extensions.treestyletab.compatibility.STM.warnForNewTabPosition", true);
pref("extensions.treestyletab.compatibility.TabUtilities", true);
pref("extensions.treestyletab.compatibility.RemoveNewTabButton", true);
pref("extensions.treestyletab.compatibility.IETabPlus", true);
pref("extensions.treestyletab.compatibility.MultiLinks", true);
pref("extensions.treestyletab.compatibility.DomainTab", true);
pref("extensions.treestyletab.compatibility.PersonalTitlebar", true);
pref("extensions.treestyletab.compatibility.TotalToolbar", true);
pref("extensions.treestyletab.compatibility.FirefoxSync", true);


pref("extensions.treestyletab.platform.Darwin.indent.property.top", "margin-bottom");


pref("extensions.treestyletab.prefsVersion", 0);
