/**
 * Duration of animations.
 * DO NOT CHANGE THE PREFS, because actual duration of
 * animations are defined in CSS. (CSS Transitions)
 * These prefs are used by the JavaScript implementation.
 */
pref("extensions.treestyletab.animation.indent.duration",   200);
pref("extensions.treestyletab.animation.collapse.duration", 150);

/**
 * Size of resizable tab bar. They are completely ignored if "Tabs on Top"
 * is activated. *.default preferences are user configurable defaults for
 * "reset tab bar size" feature
 */
pref("extensions.treestyletab.tabbar.width",                 200);
pref("extensions.treestyletab.tabbar.width.default",         200);
pref("extensions.treestyletab.tabbar.height",                32);
pref("extensions.treestyletab.tabbar.height.default",        32);
pref("extensions.treestyletab.tabbar.shrunkenWidth",         80);
pref("extensions.treestyletab.tabbar.shrunkenWidth.default", 80);

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
 * instead of between tabs and the content area.
 */
pref("extensions.treestyletab.tabbar.invertScrollbar", true);

/**
 * Scrollbar in vertical tab bar can be shown with narrow width.
 * This option works only for vertical tab bar.
 */
pref("extensions.treestyletab.tabbar.narrowScrollbar", true);
pref("extensions.treestyletab.tabbar.narrowScrollbar.size", "10px");

/**
 * On some environments (ex. GNOME3 on Linux), "narrow scrollbar" cannot get
 * narrow width because system appearance possibly expand the size of scrollbar
 * elements. To prevent this issue, we have to override "-moz-appeearance" defined
 * by Firefox's default theme.
 */
// pref("extensions.treestyletab.tabbar.narrowScrollbar.overrideSystemAppearance", false);
pref("extensions.treestyletab.platform.default.tabbar.narrowScrollbar.overrideSystemAppearance", false);
pref("extensions.treestyletab.platform.Linux.tabbar.narrowScrollbar.overrideSystemAppearance", true);

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
 * When the tab bar is shown, content area must receive mousemove events
 * to hide the tab bar. However, rectangle drawn by plugins (like <embed>)
 * doesn't fire mousemove event even if mouse pointer moves on it. If this
 * preference is "true", TST showns transparent screen on the content area
 * to receive mousemove events anyway. If the screen is annoying for you,
 * (actually it prevents click events on the content area)
 */
pref("extensions.treestyletab.tabbar.autoHide.contentAreaScreen.enabled", true);
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
 * The role of the "counter" in each tab.
 *  1 = Indicate number of all tabs in the tree (including the parent tab itself)
 *  2 = Indicate number of contained tabs in the collapsed tree (imitating file managers)
 */
pref("extensions.treestyletab.counter.role.horizontal", 1);
pref("extensions.treestyletab.counter.role.vertical", 2);

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

/**
 * Maximum level of tree nestings, for horizontal and vertical tab bar.
 * -1 (or any negative value) means "infinity".
 */
pref("extensions.treestyletab.maxTreeLevel.horizontal", 0);
pref("extensions.treestyletab.maxTreeLevel.vertical",   999);
/**
 * When there are too deep tree, TST disables indentation (and collapsing)
 * for tabs deeper than "maxTreeLevel.horizontal/vertical", but it is just
 * cosmetic. TST never re-attach such tabs actually. So, if you enlarge
 * maxTreeLevel prefs enough to show all levels, then TST re-activates
 * indentations for those tabs.
 * This pref can override the behavior described above. If you set this to
 * "true", TST actually re-attach "too deep" tabs to upper level automatically.
 * So, even if you enlarge "maxTreeLevel" prefs, you won't see tabs with new
 * indentation.
 */
pref("extensions.treestyletab.maxTreeLevel.phisical", false);

/**
 * Indentation size for one tree level, in pixels. 
 * Tabs will have flexible indent from "indent.min" to "indent". TST
 * dynamically changes indent of tabs, to avoid hidden tabs caused by too large
 * indent.
 * If you set "indent.autoShrink" to "false", TST doesn't change indent of tabs
 * automatically. On the mode, indent of tabs are always fixed.
 * If you set "autoShrink.onlyForVisible" to "false", TST keeps indent size
 * shrunken even if "too deeply nested" tabs are invisible.
 */
pref("extensions.treestyletab.indent.vertical",       12);
pref("extensions.treestyletab.indent.horizontal",     4);
pref("extensions.treestyletab.indent.min.vertical",   3);
pref("extensions.treestyletab.indent.min.horizontal", 1);
pref("extensions.treestyletab.indent.autoShrink", true);
pref("extensions.treestyletab.indent.autoShrink.onlyForVisible", true);
/**
 * CSS property to apply indent of tabs. By default TST uses "margin", so, for
 * example, tabs in the leftside tab bar are indented via "margin-left".
 * However, in some theme "margin-*" won't work. You can change the CSS
 * property via these prefs.
 */
pref("extensions.treestyletab.indent.property", "margin");
/**
 * To change the default style for each platform, use "platform.default.indent.property.*"
 * instead of "indent.property.*" for the default preference.
 * "indent.property.*" is used as a cache of the default pref which is detected
 * from "platform.default.indent.property.*" prefs.
 *   // pref("extensions.treestyletab.indent.property.top", "");
 *   // pref("extensions.treestyletab.indent.property.right", "");
 *   // pref("extensions.treestyletab.indent.property.bottom", "");
 *   // pref("extensions.treestyletab.indent.property.left", "");
 */
pref("extensions.treestyletab.platform.default.indent.property.top", "");
pref("extensions.treestyletab.platform.default.indent.property.right", "");
pref("extensions.treestyletab.platform.default.indent.property.bottom", "");
pref("extensions.treestyletab.platform.default.indent.property.left", "");
/**
 * On Mac OS X, tabs in the top tab bar are shown like in the bottom tab bar.
 */
pref("extensions.treestyletab.platform.Darwin.indent.property.top", "margin-bottom");

/**
 * The default insertion position for new children. This pref is used for cases
 * when TST cannot detect the best position of the new child automatically.
 * (dropping a tab onto an existing tab, new child tab from link, etc.)
 *  0 = Insert as the first child.
 *  1 = Insert as the last child.
 */
pref("extensions.treestyletab.insertNewChildAt", 1);

/**
 * Appearance of twisty in tabs. Possible values:
 *  "none", "retro", "modern-black", "modern-white", and "auto".
 */
pref("extensions.treestyletab.twisty.style", "auto");
/**
 * Because twisties in tabs are small, it is possibly hard to be clicked.
 * If this pref is "true", TST handles events from favicons just same as
 * ones from twisties.
 * In other words, if you wish that clickings on favicons are ignored by TST,
 * set this to "false".
 */
pref("extensions.treestyletab.twisty.expandSensitiveArea", true);

/**
 * When a tab is indented, your click on the indent will be ignored by TST
 * because the place you clicked is just a margin, not a tab. However, rows
 * in tree widgets can be selected by same action (clicking on the indent).
 * If this is "true", TST handles click events on indents of tabs just same
 * as ones on tabs.
 */
pref("extensions.treestyletab.clickOnIndentSpaces.enabled", true);

/**
 * Contents of the tooltip on tabs.
 * 0 = Firefox default (show the title of the one tab)
 * 1 = show all titles of tabs in the tree only for collapsed tree
 * 2 = show all titles of tabs in the tree always
 */
pref("extensions.treestyletab.tooltip.mode", 2);
/**
 * Maximum count of tabs in a tooltip. Tabs over this limit are
 * not shown in the tooltip.
 */
pref("extensions.treestyletab.tooltip.maxCount", 10);
/**
 * After this delay, TST shows "full tooltip" to show whole tree.
 * Negative value means "do not show full tooltip".
 */
pref("extensions.treestyletab.tooltip.fullTooltipDelay", 2000);

/**
 * Visibility of extra menu items for the context menu on tabs, inserted by TST.
 */
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

/**
 * How to treat a dropped link on a tab.
 *  0 = Always ask how to open the link.
 *  1 = Load the link into the tab.
 *  2 = Open the link as a new child tab of the tab.
 */
pref("extensions.treestyletab.dropLinksOnTab.behavior", 0);
/**
 * How to treat new tabs opened from a bookmark group.
 * The value is an union of following flags:
 *  Basic flags:
 *   0 = Always ask how to open tabs.
 *   1 = Open tabs as a new tree.
 *   2 = Open tabs as a normal tabs (not tree).
 *   4 = Replace all existing tabs.
 *  Structure flags:
 *   256  = Restore tree structure based on information stored in the Places DB,
 *          and use a dummy tab as the parent, only if there is any orphan.
 *          (When a bookmark has no tree information, it will be opened as an
 *          orphan tab - top-level and with no child.)
 *   1024 = Restore tree structure based on information stored in the Places DB,
 *          and use a dummy tab as the parent always.
 *   512  = Ignore tree structure stored in the Places DB.
 *  State flags:
 *   2048        = Expand all tree.
 *   (otherwise) = Collapse all tree.
 *
 * Examples:
 *  1 | 256 | 2048 = Open as a new tree, restore tree structure, and expand.
 *  1 | 512        = Open as a new tree, as a flat group.
 */
pref("extensions.treestyletab.openGroupBookmark.behavior", 2304); /* 0 | 256 | 2048 */
/**
 * Group tabs opened by this feature will be created with "temporary" state
 * so they will be closed automatically if they are become needless.
 * To stay them open, set this to false.
 */
pref("extensions.treestyletab.openGroupBookmark.temporaryGroup", true);
/**
 * How to treat tabs dropped to the Bookmarks menu or Bookmarks toolbar.
 *  0 = Always ask how bookmark the tree.
 *  1 = Bookmark all tabs in the tree of the dragged tab.
 *  2 = Bookmark only the parent tab you dragged.
 */
pref("extensions.treestyletab.bookmarkDroppedTabs.behavior", 0);

/**
 * On Windows, "AeroPeak" can show all of tabs from the task bar. If this is
 * "true", only visible tabs will be shown in the AeroPeak list. Otherwise
 * you'll see all of tabs including collapsed ones.
 */
pref("extensions.treestyletab.taskbarPreviews.hideCollapsedTabs", true);

/**
 * If this is "true", TST expands the focused tree when it is collapsed, and
 * collapses all other trees automatically. This doesn't affect for cases from
 * twisties in tabs.
 * If this is "false" trees never be expanded/collapsed automatically, so
 * you'll have to click twisties in tabs always to collapse/expand them.
 */
pref("extensions.treestyletab.autoCollapseExpandSubtreeOnSelect",      true);
/**
 * When you close a tab and Firefox focuses to the nearest tab, the focus
 * changing possibly causes collapsing/expanding of trees. If you set this
 * to "false", TST ignores focus changings caused by removing of the current
 * tab.
 */
pref("extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.onCurrentTabRemove", true);
/**
 * When you press Ctrl-Tab/Shift-Ctrl-Tab, Firefox advances focus of tabs.
 * If this is "true", TST expands focused tree after a delay specified
 * by another preference "autoExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay".
 * (If the delay is "0", TST dynamiclaly expands focused tree even if
 * you are browsing tabs by those shortcuts.)
 * If this is "false", TST doesn't expand trees while you are switching
 * tab focus by those keyboard shortcuts. And then, after you release the Ctrl
 * key, TST will expand the tree if the newly selected tab have its collapsed
 * tree.
 */
pref("extensions.treestyletab.autoExpandSubtreeOnSelect.whileFocusMovingByShortcut", true);
pref("extensions.treestyletab.autoExpandSubtreeOnSelect.whileFocusMovingByShortcut.collapseOthers", true);
pref("extensions.treestyletab.autoExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay", 800);
/**
 * If this is "true", TST expands/collapses tree by double-clicking on tabs.
 * Otherwise TST simply ignores such actions.
 */
pref("extensions.treestyletab.collapseExpandSubtree.dblclick",         false);
/**
 * Collapsed state of restored tree.
 *  -1 = Restore the last state.
 *  0  = Collapse all restored tree.
 *  1  = Expand all restored tree.
 */
pref("extensions.treestyletab.collapseExpandSubtree.sessionRestore", -1);
/**
 * When a collapsed tab is focused, if this is "true", TST expands the tree
 * automatically. If this is "false", TST prevents to focus to a collapsed tab,
 * and re-focuses to the parent tab automatically.
 */
pref("extensions.treestyletab.autoExpandSubtreeOnCollapsedChildFocused", true);
/**
 * When a tab is newly attached to an existing collapsed tree, if this is
 * "true", TST expands the tree automatically. Otherwise TST simply attaches
 * the tab into the collapsed tree.
 */
pref("extensions.treestyletab.autoExpandSubtreeOnAppendChild",         true);

/**
 * This controlls readyToOpenChildTab() and other APIs to open new child tabs.
 * If this is "true", new tabs opened after the API readyToOpenChildTab() is
 * called, they become children of the specified parent tab or the current tab.
 * If this is "false", tabs are not attached automatically, so you have to
 * manage tree of tabs by your hand. "true" IS STRONGLY RECOMMENDED.
 */
pref("extensions.treestyletab.autoAttach", true);
/**
 * How to treat new tabs for search results from the Web search bar.
 *  0 = Open as an independent tab.
 *  1 = Open the search result tab as a child of the current tab, only if the
 *      search term equals to the selection in the current tab.
 *      In other words, if you do select => copy => search, then the result
 *      will be grouped to the current tab automatically.
 *  2 = Open any search result tab as a child of the current tab.
 * NOTE: This pref doesn't open new tabs from the Web search bar. You have to
 *       use Alt-Enter, middle click, or "browser.search.openintab" to open
 *       the search result as a new tab.
 */
pref("extensions.treestyletab.autoAttach.searchResult", 1);
/**
 * How to treat new tabs from Ctrl-T.
 *  0 = Open as an independent tab.
 *  1 = Open as a child tab of the current tab.
 *  2 = Open as a sibling tab of the current tab.
 *  3 = Open as a next sibling tab of the current tab.
 */
pref("extensions.treestyletab.autoAttach.newTabCommand", 0);
/**
 * How to treat new tabs from middle click (or Ctrl-click) on the "New Tab" button.
 *  Options are same to extensions.treestyletab.autoAttach.newTabCommand.
 */
pref("extensions.treestyletab.autoAttach.newTabButton", 1);
/**
 * How to treat duplicated tabs.
 *  Options are same to extensions.treestyletab.autoAttach.newTabCommand.
 */
pref("extensions.treestyletab.autoAttach.duplicateTabCommand", 3);
/**
 * How to treat duplicated tabs from "back" button.
 *  Options are same to extensions.treestyletab.autoAttach.newTabCommand.
 */
pref("extensions.treestyletab.autoAttach.duplicateTabCommand.back", 1);
/**
 * How to treat duplicated tabs from "forward" button.
 *  Options are same to extensions.treestyletab.autoAttach.newTabCommand.
 */
pref("extensions.treestyletab.autoAttach.duplicateTabCommand.forward", 1);
/**
 * How to treat new tabs from middle click (or Ctrl-click) on the "Go" button.
 *  Options are same to extensions.treestyletab.autoAttach.newTabCommand.
 */
pref("extensions.treestyletab.autoAttach.goButton", 1);
/**
 * How to treat new tabs from the current tab (links, frames, media, etc.).
 *  Options are same to extensions.treestyletab.autoAttach.newTabCommand.
 */
pref("extensions.treestyletab.autoAttach.fromCurrent", 1);

/**
 * Focus targets for Ctrl-Tab/Ctrl-Shift-Tab.
 *  0 = Focus to both visible and collapsed tabs. (If a collapsed tab is
 *      focused, the tree will be expanded by another pref "autoExpandSubtreeOnCollapsedChildFocused".
 *  1 = Focus to visible tabs. Collapsed tabs will be skipped. (But if the tree 
 *      is expanded by "autoExpandSubtreeOnSelect.whileFocusMovingByShortcut",
 *      visible tabs in the tree can be focused.)
 */
pref("extensions.treestyletab.focusMode", 1);

/**
 * How to treat children of a closed parent tab.
 *  3 = Promote the first child tab to the new parent.
 *  0 = Promote all children to the parent level.
 *  1 = Detach all children from the tree.
 *  2 = Close all children too.
 */
pref("extensions.treestyletab.closeParentBehavior", 3);
/**
 * How to treat detached tabs by "closeParentBehavior" == 1. If this is "true",
 * detached tabs are moved to the bottom of the tab bar. If "false", tabs are
 * moved to the position next to the tree. For example:
 *  +[A]
 *   +[A-1]
 *    +[A-1-1]
 *   +[A-2]
 *    +[A-2-1]
 *    +[A-2-2]
 *  +[B]
 * When the tab [A-1] is closed, [A-1-1] is moved to the position next to [B]
 * if this is "true". Otherwise the new position is between [A-2-2] and [B].
 */
pref("extensions.treestyletab.closeParentBehavior.moveDetachedTabsToBottom", false);
/**
 * How to treat children of a closed root tab (which has no parent).
 *  3 = Promote the first child tab to the new root.
 *  1 = Detach all children from the tree. Children become new root tabs.
 * NOTE: This affects only when "closeParentBehavior" == 0.
 */
pref("extensions.treestyletab.closeRootBehavior", 3);

/**
 * How to treat restored tab by "Undo Close Tab", if the tab was a member of
 * a closed tree.
 *  1   = Always ask how to treat it.
 *  0   = Don't restore other tabs.
 *  2   = Restore all other tabs of the closed tree, even if some tabs cannot
 *        be restored. (because out of "undo close tabs" history, etc.)
 *  256 = Restore all other tabs of the closed tree, only if all of members
 *        of the tree is in the "undo close tabs" history.
 */
pref("extensions.treestyletab.undoCloseTabSet.behavior", 3);

/**
 * Status panel possibly covers the tab bar. If "true",
 * TST repositions (and resizes) the status panel automatically.
 * For compatibility, you can set this to "false". Then TST doesn't controll
 * the status panel.
 */
pref("extensions.treestyletab.repositionStatusPanel", true);

/**
 * On Firefox 8 or later, TST can restore tree structure before SSTabRestoring
 * events. SSTabRestoring based restore can break tree for duplicated tabs via
 * the SessionStore service, so, "1" and "2" are recommended.
 * ("2" will take much time on the startup if there are too many background groups.)
 *  0 = Restore trees on SSTabRestoring. (disable "fast restore")
 *  1 = Restore trees before SSTabRestoring.
 *      Trees in background groups are restored when they are shown.
 *  2 = Restore all trees before SSTabRestoring including background groups.
 */
pref("extensions.treestyletab.restoreTree.level", 1);

/**
 * TST overrides some internal prefs of Firefox itself, because they can
 * conflict with TST features. They will be rolled back when TST is uninstalled.
 */
pref("browser.link.open_newwindow.restriction.override", 0);
pref("browser.tabs.insertRelatedAfterCurrent.override", false);
pref("browser.tabs.insertRelatedAfterCurrent.override.force", true);

/**
 * Extra commands for selected tabs (Multiple Tab Handler)
 */
pref("extensions.multipletab.show.multipletab-selection-item-removeTabSubtree", true);
pref("extensions.multipletab.show.multipletab-selection-item-createSubtree", true);
/**
 * How to create a new tree from selected tabs. If "true", a new dummy tab is
 * automatically opened and selected tabs become children of the tab. Otherwise
 * the first selected tab becomes the parent.
 */
pref("extensions.treestyletab.createSubtree.underParent", true);
/**
 * Group tabs opened by this feature will be created with "temporary" state
 * so they will be closed automatically if they are become needless.
 * To stay them open, set this to false.
 */
pref("extensions.treestyletab.createSubtree.underParent.temporaryGroup", true);

/**
 * Size of pinned tabs in the vertical tab bar.
 * If true, they will be faviconized. Otherwise, they expand to the width
 * of the tab bar.
 */
pref("extensions.treestyletab.pinnedTab.faviconized", true);

/**
 * Compatibility hack flags for other addons. They can be disabled by each
 * addon, when the addon become working with TST without dirty hacks.
 * In other words, add-on authros can disable TST's dirty hack if it is
 * obsolete.
 */
pref("extensions.treestyletab.compatibility.AgingTabs", true);
pref("extensions.treestyletab.compatibility.AIOS", true); // All-in-One Sidebar
pref("extensions.treestyletab.compatibility.Autohide", true);
pref("extensions.treestyletab.compatibility.ColorfulTabs", true);
pref("extensions.treestyletab.compatibility.ContextSearch", true);
pref("extensions.treestyletab.compatibility.DomainTab", true);
pref("extensions.treestyletab.compatibility.DragDeGo", true);
pref("extensions.treestyletab.compatibility.DragIt", true);
pref("extensions.treestyletab.compatibility.DragNDropToolbars", true);
pref("extensions.treestyletab.compatibility.DuplicateThisTab", true);
pref("extensions.treestyletab.compatibility.FirefoxSync", true);
pref("extensions.treestyletab.compatibility.FireGestures", true);
pref("extensions.treestyletab.compatibility.FLST", true);
pref("extensions.treestyletab.compatibility.FocusLastSelectedTab", true);
pref("extensions.treestyletab.compatibility.FullerScreen", true);
pref("extensions.treestyletab.compatibility.GoogleToolbar.Sidewiki", true);
pref("extensions.treestyletab.compatibility.Greasemonkey", true);
pref("extensions.treestyletab.compatibility.Highlander", true);
pref("extensions.treestyletab.compatibility.IETabPlus", true);
pref("extensions.treestyletab.compatibility.InstaClick", true);
pref("extensions.treestyletab.compatibility.LastTab", true);
pref("extensions.treestyletab.compatibility.Linky", true);
pref("extensions.treestyletab.compatibility.Locationbar2", true);
pref("extensions.treestyletab.compatibility.MouseGesturesRedox", true);
pref("extensions.treestyletab.compatibility.MouselessBrowsing", true);
pref("extensions.treestyletab.compatibility.MultiLinks", true);
pref("extensions.treestyletab.compatibility.NavbarOnTitlebar", true);
pref("extensions.treestyletab.compatibility.OptimozTweaks", true);
pref("extensions.treestyletab.compatibility.PermaTabs", true);
pref("extensions.treestyletab.compatibility.PersonalTitlebar", true);
pref("extensions.treestyletab.compatibility.QuickDrag", true);
pref("extensions.treestyletab.compatibility.RemoveNewTabButton", true);
pref("extensions.treestyletab.compatibility.SBMCounter", true);
pref("extensions.treestyletab.compatibility.Scriptish", false);
pref("extensions.treestyletab.compatibility.SelectionLinks", true);
pref("extensions.treestyletab.compatibility.SessionManager", true);
pref("extensions.treestyletab.compatibility.SmoothlyCloseTabs", true);
pref("extensions.treestyletab.compatibility.SnapLinks", true);
pref("extensions.treestyletab.compatibility.STM.warnForNewTabPosition", true);
pref("extensions.treestyletab.compatibility.STM", true); // Super Tab Mode
pref("extensions.treestyletab.compatibility.SuperDragAndGo", true);
pref("extensions.treestyletab.compatibility.Tabberwocky", true);
pref("extensions.treestyletab.compatibility.TabControl", true);
pref("extensions.treestyletab.compatibility.TabUtilities", true);
pref("extensions.treestyletab.compatibility.TMP", true); // Tab Mix Plus
pref("extensions.treestyletab.compatibility.TooManyTabs", true);
pref("extensions.treestyletab.compatibility.TotalToolbar", true);

/**
 * The internal version of TST preferences. Don't change this by hand, because
 * this is managed by JavaScript codes. When  some prefs are renamed, they will
 * be migrated automatically.
 */
pref("extensions.treestyletab.prefsVersion", 0);

