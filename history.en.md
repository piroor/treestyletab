# History

 - master/HEAD
 - 0.14.2014013001
   * Improved: Better compatibility with [Nav Bar on Title Bar](https://addons.mozilla.org/firefox/addon/nav-bar-on-title-bar/).
   * Improved: Better compatibility with [Tab Control](https://addons.mozilla.org/firefox/addon/tab-control/).
   * Modified: Remove codes for an extinct feature "replace the current tab when opening a bookmark group". The feature was already removed in old Firefox.
   * Fixed: Public APIs to show/hide the tab bar works correctly.
   * Fixed: Maximize scrollable area of tree-like view in a about:treestyletab-group tab.
   * Fixed: Open bookmark folder as a tree correctly, even if the user don't want to open a dummy grouping tab.
   * Fixed: Fix broken appearance of the tab bar on Firefox versions without the "Tabs on Top" feature.
 - 0.14.2013112901
   * Improved: Better compatibility with someone who change visibility of the tab bar, like "auto hide tab bar for last single tab" feature of Tab Mix Plus, Pale Moon, and [Hide Tab Bar With One Tab](https://addons.mozilla.org/firefox/addon/hide-tab-bar-with-one-tab/).
   * Improved: Better compatibility with [Context Search](http://www.cusser.net/extensions/contextsearch/). Now search result tabs are opened as children of the current tab.
   * Modified: Expand the shrunken tab bar immediately when the mouse pointer moves onto the tab bar, if the size of teh tab bar is fixed.
   * Modified: Keep the UI to modify relations of bookmarks disabled, for bookmark items in the "Unsorted Bookmarks" folder. (Because people won't open all items in the folder as a tree of tabs by middle-click on the folder.)
   * Modified: Updated pinned tabs are highlighted by TST itself.
   * Fixed: Hide (or collapse) the tab bar correctly with delay, when a tab is opened or closed in the "auto hide" mode.
   * Fixed: Better responsibility for bookmark management UI when there are very large number of sibling bookmarks in a folder.
   * Fixed: Save and restore both sizes of expanded and shrunken tab bar correctly, on the next startup.
   * Fixed: Re-show the tab bar correctly when the F11 key is pressed to exit from the DOM full-screen mode.
   * Fixed: Show the tab bar again correctly when I click the grippy in the splitter.
   * Fixed: Show the tab bar again correctly when I drag the splitter.
   * Fixed: Correctly update "list all tabs" menu if there is pinned tabs ([by Infocatcher.](https://github.com/piroor/treestyletab/pull/606) Thanks!)
   * Fixed: Better compatibility with "Australis".
   * Fixed: Don't disable background color of tabs when Tab Mix Plus is installed.
   * Fixed: Open tabs from user scripts with [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/) 1.11 correctly.
   * [fr-FR locale is updated by AxlMun. Thanks!](https://github.com/piroor/treestyletab/pull/595)
 - 0.14.2013100901
   * Improved: Position and size of the tab bar is updated automatically when any element is inserted to the browser box.
   * Fixed: Show the full tooltip near the original tooltip correctly, even if there are multiple screens.
   * Fixed: Don't shrink/hide the tab bar for keyboard shortcuts Ctrl-T, Ctrl-R, etc, if the tab bar is shown by a long-press of the Ctrl key.
   * Fixed: Don't focus to the tab which is going to be closed. This also fixes some breakages (including [issue #569](https://github.com/piroor/treestyletab/issues/569)) caused by TabSelect events from disappearing tabs.
   * Fixed: Don't activate auto-hide feature of the tab bar for DOM-fullscreen mode (ex. YouTube). This is based on the behavior of Firefox's auto-hide feature in DOM-fullscreen mode.
   * Fixed: Don't hide browser's toolbars when the tab bar is vertical, except cases to hide them for special tabs (for example, web application).
   * Fixed: Erase odd border in each tab appearing with Tab Mix Plus. ([by wanabe. Thanks!](https://github.com/piroor/treestyletab/pull/556))
   * Fixed: Better compatibility with "How Many Times Can I Back?". ([by wanabe. Thanks!](https://github.com/piroor/treestyletab/pull/554))
   * Fixed: Better compatibility with [Sidebars List](https://addons.mozilla.org/firefox/addon/sidebars-list/). ([by Infocatcher. Thanks!](https://github.com/piroor/treestyletab/pull/571))
 - 0.14.2013082301
   * Fixed: Failed to initialize on Firefox 23 and later. (regression on the previous release)
   * [ru locale is updated by Infocatcher. Thanks!](https://github.com/piroor/treestyletab/pull/542)
 - 0.14.2013082201
   * Works on Firefox 25 and later.
   * Fixed: Restore tree structure correctly for "undo close tab" feature, even if the tab had no child. (It was a regression on the version 0.14.2013052901.)
   * Improved: New tab from [DragIt](https://addons.mozilla.org/firefox/addon/dragit-formerly-drag-de-go/) is opened as a child of the current tab.
   * Fixed: Don't shrink tab bar automatically, when the user selects a background tab.
   * Improved: Update label of Firefox's "Close Tabs to the Right" menu item to "Close Tabs to the Bottom" in the vertical tab bar.
   * Fixed: Don't break tree structure by drag and drop of a child tab to move it to the upper level.
   * Fixed: Detect new tabs opened from content scripts more correctly.
   * Fixed: Show favicon for dummy (group) tabs correctly on Firefox 22.
   * Fixed: Detect dummy (group) tabs correctly. ([Fixed by Infocatcher. Thanks!](https://github.com/piroor/treestyletab/pull/518))
   * Fixed: On Firefox 23 and later, ignore the preference "hide the tab bar when there is only one tab" because it was available on Firefox 22 or older versions.
   * Fixed: Resolve visual glitch of the tab bar after showing/hiding a toolbar.
   * Fixed: Works with [bug489729 (Disable detach and tear off tab)](https://addons.mozilla.org/firefox/addon/bug489729-disable-detach-and-t/).
   * Improved: Introduce the concept "temporary group tab" and "permanent group tab". And close needless group tabs automatically only when it is marked as temporary. Automatically opened group (dummy) tabs are temporary, and manually opened tabs are permanently by default. You can make group tabs always permanent by these preferences `extensions.treestyletab.openGroupBookmark.temporaryGroup` (for bookmark groups) and `extensions.treestyletab.createSubtree.underParent.temporaryGroup` (for "create new tree from selected tabs" feature) with the value `false`.
   * Fixed: Show/hide tab bar correctly after the grippy is clicked.
   * Fixed: Don't freeze on the interface to edit bookmarks, even if there are too many bookmarks in the same folder.
   * [ru locale is updated by Infocatcher. Thanks!](https://github.com/piroor/treestyletab/pull/534)
 - 0.14.2013052901
   * Fixed: Pinned tabs are shown with more stylized appearance.
   * Fixed: Don't set margin to indicate grouped tabs for parent tabs next to hidden tabs in more cases. (by Drugoy. Thanks!)
   * Fixed: Update the tab bar correctly when contents in the browser bottom bar or the toolbar are modified. (Regression on 0.14.2013040601)
   * Fixed: Don't make new tabs children of the current tab, if they are opened by [Gmail Panel](https://addons.mozilla.org/firefox/addon/gmail-panel/) or someone.
   * Modified: Update codes around [session store API](http://dutherenverseauborddelatable.wordpress.com/2013/05/23/add-on-breakage-continued-list-of-add-ons-that-will-probably-be-affected/).
 - 0.14.2013040601
   * Improved: Add a new secret option `extensions.treestyletab.autoAttach.fromCurrent` to control new tab position from the current tab.
   * Fixed: Move tab by moveTabForward/moveTabBackward on Firefox 20 correctly.
   * Fixed: Don't set margin to indicate grouped tabs for parent tabs next to hidden tabs.
   * Fixed: Don't insert needless margins between collapsed tabs. Negative margins for collapsed tabs were unexpectedly inverted for tabs which have its "cannot be collapsed" parent tab. However, such tabs still can be collapsed if its root parent tab can be collapse its sub tree.
   * Fixed: Observe changes of UI shown/hidden not only the browser bottom box but also the toolbox
   * Fixed: Restore the original user preference when this addon is disabled or removed. (by saneyuki_s)
   * Fixed: Move dragged tab to the correct position, even if there are hidden tabs.
   * Fixed: Move all tabs in the dragged tree to a newly opened window correctly on Firefox 19 and later.
   * Modified: Make dragging tabs transparently always, to see the drop position marker.
   * Modified: Expand the drop area to drop dragged tabs to a tab itself. By this change, you can drop a tab to another more easily.
   * Modified: "jar" archive is no longer included.
 - 0.14.2012122901
   * Works on Nightly 20.0a1 again. (Updated for new MutationObserver spec.)
   * Fixed: Never raise error messages for dragging of non-tab objects onto the tab bar.
 - 0.14.2012121401
   * Improved: Open new tabs from [Linky](https://addons.mozilla.org/firefox/addon/425) as child tabs of the current tab even if they are opened vi a dialog.
   * Improved: Define minimum width/height of the tab bar and restore it on the startup (so, if you accidentaly get too narrow tab bar, it will be fixed in the next startup.)
   * Fixed: Collapse/hide the tab bar automatically even if the webpage includes any plugin area.
   * Fixed: Fix wrong dragging behavior of tabs in the vertical tab bar. Now tabs can be droppend on another tab easily.
   * Fixed: Fix odd padding in the vertical overflowed tab bar with pinned tabs and "Default" skin.
   * Fixed: Hide tab bar for only one tab window correctly.
   * Fixed: Fix dynamic patch for [QuickDrag](https://addons.mozilla.org/firefox/addon/6912).
   * Modified: Don't change indent of tabs for collapsed tab bar.
   * Modified: Don't listen "mouseleave" event anymore (because it increases CPU usage.)
   * Modifeid: Unify the preference item `extensions.treestyletab.animation.enabled` to `browser.tabs.animate`.
 - 0.14.2012111201
   * Fixed: Tabs from other computers are correctly opened as child tabs of the "about:sync" tab, on lately Nightly.
   * Fixed: All animation effects were unexpectedly stopped after the configuration dialog is opened.
 - 0.14.2012111001
   * Improved: Dragged tabs in vertical tab bar are now animated (on Firefox 17 beta and later.)
   * Improved: Update indent of tabs automatically when too deeply nested tabs are collapsed/expanded and the mouse cursor goes away from the operated tab. This behavior can be disabled by the secret preference `extensions.treestyletab.indent.autoShrink.onlyForVisible`.
   * Fixed: Update indent of tabs automatically when tab groups are modified or switched.
   * Improved: Different indent of tabs can be applied for horizontal and vertical tab bar. Secret preferences `extensions.treestyletab.indent.horizontal`, `extensions.treestyletab.indent.vertical`, `extensions.treestyletab.indent.min.horizontal` and `extensions.treestyletab.indent.min.vertical` are available.
   * Improved: The default size of the tab bar (it is used to reset the tab bar when the splitter is double-clicked) is now customizable by secret preferences `extensions.treestyletab.tabbar.width.default`, `extensions.treestyletab.tabbar.height.default` and `extensions.treestyletab.tabbar.shrunkenWidth.default`.
   * Fixed: Drop position markers in vertical tab bar were accidentaly disappeared while dragging.
   * Fixed: Don't duplicate the current tab accidentaly when simple left click on the reload button.
   * Improved: Duplicate tabs as children of the current tab, from items of back/forward button's menu.
   * Fixed: Don't hide closeboxes of other tabs when toolbars are shown/hidden.
   * Fixed: Animation effects of tabs were accidentaly stopped when there were multiple windows.
   * Improved: Refactor internal codes.
 - 0.14.2012081101
   * Fixed: Apply animation effects correctly. In old versions, all animation effects (about tabs and the configuration dialog) were accidentally stopped.
 - 0.14.2012080901
   * Fixed: New tabs are shown correctly even if you activate animation effects. New tabs were sometimes stay hidden because animation was accidently stopped by some errors.
   * Fixed: Tabs are shown with correct height in "Metal" skin on Windows and Linux.
   * Fixed: Collapse a tree correctly even if you focused to a grandchild tab of the collapsing tree.
   * Fixed: Tabs dropped to the bookmarks sidebar are correctly bookmarked.
   * Fixed: Better handling of recursive/broken tree when collecting descendant tabs.
 - 0.14.2012080601
   * Updated for Firefox 16
   * Fixed: `extensions.treestyletab.autoExpand.intelligently` works correctly. If you set the preference to  `false` , not-focused trees are never collapsed by expansion of the newly focused tree.
   * Fixed: Don't forget collapsed state of trees while toolbar customizing.
   * Fixed: Create tree of nested bookmark folders, from dragged tree correctly.
   * Fixed: Open tabs as a tree on the dropped position in the tab bar, from dragged bookmark tree.
   * Fixed: Update tab bar appearance when contents of the browser bottom box is shown or hidden.
   * Fixed: Move the dragged pinned tab to the dropped position correctly, even if the drop target is the first pinned tab.
   * Fixed: Expand collapsed children of newly pinned tab automatically. (Child tabs unexpectedly vanished when a parent tab with collapsed children was pinned.)
   * Fixed: Don't break tree structure when a last child tab is moved to the upper level by drag and drop.
   * Fixed: After session restorations, new tabs related to the current tab could be shown as broken tree because TST's internal caches were lost. Now, session restorations work more stablely.
   * Fixed: "Fast restoration of tree structures on the startup" feature couldn't work correctly on some environments.
   * Fixed: Suppress freezing from infinity loop which is caused by recursive reference (it can be there unexpectedly by some reasons!) of tabs.
   * Fixed: Show bottom border of the toolbox for the vertical tab bar and "Tabs on Bottom" toolbox.
   * Fixed: Show notification about newly opened tabs at out of the viewport correctly, on Linux.
   * Fixed: Update "Metal" skin for Firefox 14 and later.
 - 0.14.2012050301
   * Improved: Move tab to the upper level if it is dropped on the bottom area of its parent tab.
   * Modified: Change the background color of tabs in "Flat" and "Mixed" theme for some platform (e.g. Ambience theme on Ubuntu).
   * Fixed: Handle new tabs from the "new tab" button correctly.
   * Fixed: Respect special behaviors defined in Firefox itself or other addons for middle-click on the new tab button.
   * Fixed: Fix NS_ERROR_XPC_BAD_OP_ON_WN_PROTO error in auto-shrink mode.
   * Fixed: Fix broken appearance of pinned tabs with "Sidebar" theme.
   * Fixed: Fix broken appearance of pinned tabs with "Metal" theme on Mac OS X.
   * Fixed: Layout pinned tabs correctly even if the tab bar is narrower than the size of a pinned tab.
   * Fixed: Move the dragged tab to the correct position when the drop target tab has no child.
   * Fixed: Disable the "Tabs on Top" menu item for the vertical tab bar correctly.
   * Fixed: Store and restore the original state of the "Tabs on Top" feature when TST is uninstalled.
   * Fixed: Don't reset "Tabs on Top" state on the startup. (It was wrongly enabled on every startup.)
   * Fixed: Enlarge max width of the status panel. (See [bug 632634](https://bugzilla.mozilla.org/show_bug.cgi?id=632634).)
   * Fixed: Don't show TST's "full tooltip" if TST's tooltip is disabled by user preference.
   * Fixed: Don't collapse tabs if collapsing/expanding of tree is disabled by user preference.
   * Fixed: Reset the appearance of tree twisties when the mouse pointer go away from the tab bar.
   * Fixed: Don't show tree twisties on the favicon of existing tabs, in a horizontal tab bar.
   * Fixed: Show the floating menu bar (and title bar) with [Hide Caption Titlebar Plus](https://addons.mozilla.org/firefox/addon/hide-caption-titlebar-plus-sma/) correctly.
 - 0.14.2012021101
   * Fixed: Better appearance around twisty in tabs on a horizontal tab bar. (regression)
   * Fixed: Preferences migration on the startup failed in some cases.
   * Russian locale is updated by Infocatcher.
 - 0.14.2012021001
   * Improved: A collapsed tree is expanded automatically if you press the Ctrl key for a while on it, even if the checkbox "When a tab gets focus, expand its tree and collapse others automatically" is unchecked. You can disable this behavior by the secret preference `extensions.treestyletab.autoExpandSubtreeOnSelect.whileFocusMovingByShortcut`.
   * Fixed: Tree twisties couldn't be hidden by user preference. (regression)
   * Fixed: With Tab Mix Plus, failed to save session data on exit. (regression)
   * Fixed: Icons of collapsed tabs in the horizontal tree were not hidden. (regression)
   * Fixed: User preference of "When a tab gets focus, expand its tree and collapse others automatically" was wrongly ignored when a collapsed tab in a collapsed tree is focused directly.
   * Fixed: A link dropped onto the last parent tab was wrongly opened as the first child tab even if it should be opened as the last child by the user preference.
 - 0.14.2012020901
   * Updated for Nightly 13.0a1.
   * Improved: Better compatibility with other tab-related addons. Now this addon doesn't apply custom binding to &lt;tab/&gt;s.
   * Fixed: On lately Nightly, appearances and behaviors of the tab bar were totally broken after the last tree was dragged and dropped to another window.
   * Fixed: Trees dropped on outside of existing Firefox windows were unexpectedly duplicated. Now they are correctly moved to new windows.
   * Fixed: When auto-showing/hiding (not shrinking) of the tab bar was activated, it was wrongly shown even if the mouse pointer was not near the window edge.
   * Fixed: Auto-scrolling of the tab bar didn't work if the first tab was hidden.
   * Fixed: "Tabs on Top" was wrongly enabled for "top" and "fixed" tab bar, when a popup window was opened.
   * Fixed: Sometimes the height of the vertical tab bar was not updated (ex. Firebug's panel.)
   * Fixed: "Bookmark this tree" didn't work correctly on Firefox 9 and later.
   * Fixed: "Restore closed tree" confirmation didn't work with localized versions: da-DK, de-DE, es-ES, fr-FR, it-IT, pl, ru-RU, sv-SE, zh-CN and zh-TW.
   * Fixed: When both Tab Mix Plus and any third-party's theme were installed, collapsed tabs in the horizontal tab bar couldn't be collapsed.
   * Russian locale is updated by Infocatcher.
 - 0.14.2012012901
   * Improved: Manually expanded trees were not collapsed automatically by focus changes (like Windows Explorer.) 
   * Improved: Now tab bar isn't hidden (shrunken) by keyboard input if the tab bar is expanded by mouse actions.
   * Improved: When a tab which was a member of closed tree is restored, TST asks you to restore the whole tree by the notification popup (a.k.a. "doorhangar").
   * Improved: Auto exmansion of shrunken/hidden tab bar can be suppressed by pressing Shift key.
   * Improved: Group tabs are now saved as bookmark folders.
   * Improved: When new tab is opened at the position outside of visible area of the vertical tab bar, it is notified with an animation effect.
   * Fixed: The "overflow" state of the vertical tab bar was broken when the bar was overflowed horizontally.
   * Fixed: Tree structures were broken when tab groups (Panorama) were switched by Ctrl-Shift-"`" and Ctrl-Shift-"~".
   * Fixed: Fast restoration of tree structures on session restoration didn't work for secondary (and later) window.
   * Fixed: Some odd behaviors around auto expansion of shrunken tab bar disappeared.
   * Fixed: When the current tab includes &lt;embed&gt;, drag and drop feature totally broken after you tried to drag the tab bar itself.
   * Fixed: Pinned but not faviconized tabs were not highlighted anymore.
   * Fixed: F2 key didn't work on group tabs. (regression)
   * Fixed: Failed to store edited title of group tabs. (regression)
   * Fixed: With Tab Mix Plus, failed to restore secondary or later pinned tabs if there is no normal tab.
   * Fixed: When the browser is too slow, manual scrollings on the tab bar could be canceled by smooth scroll animations of TST itself.
   * Fixed: Unexpected jumping on the tab bar after new child tabs are opened is suppressed.
   * Fixed: TST could be broken by API calls on window destruction.
   * Fixed: When the system was too slow on TabOpen event (by Informational Tab or some addons), the tab bar failed to be scrolled to the newly opened tab.
   * Fixed: Tree of tabs in group tabs had too narrow height.
   * Modified: The role of the counter in tabs is now switched for vertical and horizontal tab bar automatically. In the horizontal tab bar, it reports the number of all tabs in the tree (including the tab itself). In the vertical tab bar, it reports the number of collapsed children in the tree (excluding the tab itself). Secret preferences `extensions.treestyletab.counter.role.horizontal` and `extensions.treestyletab.counter.role.vertical` are available to control this behavior. [See discussions in #197.](https://github.com/piroor/treestyletab/issues/197)
   * Updated for Nightly 12.0a1.
   * Drop support for Firefox 3.6.
 - 0.13.2011121501
   * Fixed: "Fast restore" didn't work if Tab Mix Plus is installed without its custom session management.
   * Fixed: Tabs moved into existing tree didn't become member tabs of the tree. (Regression on 0.13.2011121401. If you use Tab Mix Plus or other addons to control new tab position, tree could be broken.)
 - 0.13.2011121401
   * Improved: "Fast restore" has landed. Last tree structure of tabs is restored on the startup quickly. If you see any trouble from this feature, disable it by following processes: go to "about:config" and set `extensions.treestyletab.restoreTree.level` to `0`.
   * Improved: "about:treestyletab-group" tabs (dummy tabs for grouping) now contains list of member tabs as links. You can click it to select the tab, and you can close tabs by middle-click on links.
   * Improved: When the current tab has focus, arrow keys should work like in the folder pane on Windows Explorer. Right arrow expands a collapsed tree or focuses to the first child tab. Left arrow focuses to the parent tab or collapses the tree. (*Note: if you want to focus to the tab by mouse click, you have to add a CSS rule  `.tabbrowser-tab { -moz-user-focus: normal !important; }`  to your userChrome.css.)
   * Improved: Now, "auto hide tab bar" feature correctly hides the tab bar even if plugins (ex. PDF, Flash, and so on) cover the content area. (On old versions, the tab bar was kept shown unexpectedly on such cases.) This hack is based on an invisible popup covering the content area, so, if you see any trouble from this hack, disable it by following processes: go to "about:config" and set `extensions.treestyletab.tabbar.autoHide.contentAreaScreen.enabled` to `false`.
   * Improved: "Undo Close Tree" confirmation UI is now shown immediately when a tab member of closed tree is restored by "Undo Close Tab".
   * Improved: Now you can close tabs by middle click on the rich tooltip on tree.
   * Fixed: The width of the tab bar was wrongly shrunken to 105px when you started Firefox with fullscreen or maximized state.
   * Fixed: Items in "List all tabs" were not indented on Nightly 11.0a1.
   * Fixed: Trees in background groups (made by Panorama) were unexpectedly collapsed by trees in the current group.
   * Fixed: "Undo Close Tree" feature didn't work. Now you can correctly get closed tabs back.
   * Fixed: Rich tooltip on tree was always shown on the primary screen unexpectedly. Now it works with multiple screens correctly.
   * Fixed: When the shrunken tab bar was too narrow, we couldn't expand it automatically by mouse move.
   * Fixed: Linux specific style rules were not loaded unexpectedly.
   * Fixed: On Linux + GNOME3, "narrow scroll bar" was not narrow.
   * Modified: The API  `partTab()`  is renamed to  `detachTab()` . For backward compatibility, the old name is still available.
 - 0.12.2011120101
   * Improved: While you are browsing tabs by Ctrl-Tab/Ctrl-Shift-Tab, now collapsed tree is automatically expanded, if you stay there with pressed Ctrl key. (You can change the delay via a secret preference `extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut.delay`.)
   * Improved: Title of "dummy" tabs can be changed by F2 key.
   * Improved: Tooltip on a tree now reports only top 10 tabs at first, and it is expanded to scrollable tooltip automatically after a delay. (You can change the delay via a secret preference `extensions.treestyletab.tooltip.fullTooltipDelay`.)
   * Improved: Members of the tree is shown in the tooltip on the closebox in tabs.
   * Improved: Calculation about size of pinned tabs is simplified. A new boolean preference `extensions.treestyletab.pinnedTab.faviconized` is available to change pinned tabs in a vertical tab bar from "faviconized" to "regular tab".
   * Fixed: Works on Nightly 11 at 2011-11-30(PST). Now the animation management module never uses `MozBeforePaint` event.
   * Fixed: Dropped tabs were broken if they are dropped on "indent" areas.
   * Fixed: Shrunken vertical tab bar couldn't be resized by drag and drop because the tab bar was unexpectedly expanded anyway.
   * Modified: Tooltip on tree always show tree. If you like the old behavior (tooltip with tree only for collapsed tree), you can set a secret preference `extensions.treestyletab.tooltip.mode` to `1`. (`0` means "never", `2` means "always").
   * Modified: The counter in a parent tab now reports the number of all tabs in the tree including itself.
 - 0.12.2011110101
   * Fixed: "Open in tabs" feature for bookmark folder didn't work. (regression on 0.12.2011102901)
 - 0.12.2011103101
   * Fixed: Pinned tabs appeared on wrong position for rightside tab bar. (regression on 0.12.2011102901)
   * Fixed: Tab's throbbers in the vertical tab bar were shown without vertical tab bar specific appearance unexpectedly.
 - 0.12.2011102901
   * Improved: Rest members in a tree of tabs are moved to another group if the parent tab is moved to the group.
   * Fixed: When a parent tab is pinned, rest members of the tree stay there correctly.
   * Fixed: Background color of the tab bar should be light gray for "Vertigo" and "Sidebar" style with auto-hide.
   * Fixed: Pinned tabs were mispositioned on Nightly.
   * Fixed: New tabs opened by Greasemonkey scripts are correctly become children of the tab.
   * Fixed: Tabs opened from bookmark folders in secondary (or others) window, their tree structure weren't restored if Tab Utilities is installed.
   * Fixed: When `TreeStyleTabService.treeViewEnabled` was set to false twice, twisties in tabs were lost unexpectedly.
   * Fixed: Hacks for [Colorful Tabs](https://addons.mozilla.org/firefox/addon/1368) didn't work. Now all tabs in a tree are shown with same background color.
   * Fixed: New tabs from "new blank tab" button on the tab bar didn't become first child of the current tab (by the user preference) automatically when it is opened. Now it works.
   * zh-TW locale is updated by bootleq.
 - 0.12.2011082901
   * Note: This version (and older versions) is incompatible to Firefox 8 or later due to the [bug 455694](https://bugzilla.mozilla.org/show_bug.cgi?id=455694) and [674925](https://bugzilla.mozilla.org/show_bug.cgi?id=674925).
   * Improved: A dummy tab for grouping tabs is automatically closed when it has no sibling tab.
   * Improved: The size of pinned tabs can be customized by secret prefs `extensions.treestyletab.pinnedTab.width` and `extensions.treestyletab.pinnedTab.height`. If you set the width to `-1`, then pinned tabs will be expanded to the width of the vertical tab bar.
   * Improved: Needless spaces around favicons in horizontal tabs disappeared.
   * Fixed: The parent tab was unexpectedly focused when a child tab was closed even if still there were any other child.
   * Fixed: Browser windows are not resized automatically if it is maximized.
   * Fixed: New tabs opened by "Search *** by ***" context menu command didn't become children of the current tab on Firefox 4 and later.
   * Fixed: The tab bar was wrongly shrunken/hidden/expanded while something is dragged.
   * Fixed: The tab bar unexpectedly lost its scroll position when the bar was shrunken/hidden/expanded.
   * Modified: "Replace current tab" radio item for bookmark groups is never shown on lately Firefox due to the [bug 440093](https://bugzilla.mozilla.org/show_bug.cgi?id=440093).
   * Improved: Now compatible to [Snap Links Plus 2.1](http://snaplinks.mozdev.org/).
   * Improved: Tabs opened by [Duplicate This Tab](https://addons.mozilla.org/firefox/addon/duplicate-this-tab/) become child tabs of the current tab.
   * Improved: New tabs opened by [InstaClick](https://addons.mozilla.org/firefox/addon/instaclick/) should become child tabs of the current tab.
   * Fixed: Visibility of menuitems and separators are now not controlled by self, if they are removed by Menu Editor addon.
   * Fixed: When tabs are highlighted by Tab Utilities, favicons were wrongly hidden.
   * Fixed: New tabs from  `GM_openInTab()`  in Greasemonkey scripts didn't become children of the current tab.
 - 0.12.2011061701
   * Improved: While dragging of tabs or links, auto-hidden tab bar is expanded automatically.
   * Improved: New API for other addons:  `gBrowser.treeStyleTab.moveTabs()` ,  `gBrowser.treeStyleTab.importTabs()` , and  `gBrowser.treeStyleTab.duplicateTabs()`  to process multiple tabs with their tree structure.
   * Fixed: Auto-hide of the tab bar was broken.
   * Fixed: Didn't work on Nightly 7.0a1 due to removed interface "nsIDOM3Node".
   * Fixed: Animation effects were suddenly stopped by window close or other reasons.
   * Fixed: With [ColorfulTabs](https://addons.mozilla.org/firefox/addon/colorfultabs/), vertical tab bar was wrongly scrolled.
 - 0.12.2011060202
   * Fixed: With Multiple Tab Handler, selected tabs couldn't be bookmarked by drag and drop.
   * Fixed: Some compatibility hacks for other addons (ex. Tab Mix Plus) didn't work.
 - 0.12.2011060201
   * Drop support for Firefox 3.5.
   * Improved: Optimization for performance issue about switching of tab groups (Panorama).
   * Improved: Optimization for startup time. (CSS refactorings, JavaScript code modules for shared codes, etc.)
   * Improved: Middle click on the "new tab" button and the "go" button should open the new tab as the child of the current tab. (They can be customized.)
   * Improved: With [Locationbar²](https://addons.mozilla.org/ja/firefox/addon/locationbar%C2%B2/), new tabs from path segments are now opened as child tabs of the current tab.
   * Improved: New APIs for addons are available :  `TreeStyleTabService.readyToOpenChildTabNow()` ,  `TreeStyleTabService.readyToOpenNextSiblingTabNow()` , and  `TreeStyleTabService.readyToOpenNewTabGroupNow()` . They are useful for reservation of new child tab, if the new tab is possibly canceled by some reason. Reservations made by these new API are automatically canceled with delay, so you don't have to call  `TreeStyleTabService.stopToOpenChildTab()`  manually.
   * Fixed: Contents of textbox in toolbar items inserted into vertical tab bar were unexpectedly hidden.
   * Fixed: Vertical tab bar in popup windows should be hidden by `chromehidden` attribute.
   * Fixed: Drop position indicator in vertical tab bar was missing wrongly for the last tab, if there was any collapsed tab.
   * Fixed: When a root tab with collapsed children was moved by drag and drop, its children were unexpectedly expanded.
   * Fixed: The feature "hide tab bar when there is only one tab" (one of Firefox's options) didn't work correctly on Firefox 4.
   * Fixed: Horizontal tab bar was wrongly shown on the top alwasy.
   * Fixed: Clicking on the grippy in the splitter of the vertical tab bar didn't expand the collapsed tab bar.
   * Fixed: On-screen tabs on vertical tab bar were not highlighted correctly in the "list all tabs" popup. (It is a new feature introduced by the [bug 626903](https://bugzilla.mozilla.org/show_bug.cgi?id=626903).)
   * Fixed: An internal preference `extensions.treestyletab.tabbar.scrollToNewTab.mode` didn't work for new tabs opened in the background.
   * Fixed: With [All-in-One Sidebar](https://addons.mozilla.org/firefox/addon/1027) the tab bar was wrongly left on the content area after the sidebar was hidden automatically by AiOS.
   * Fixed: On Nightly, background color of the vertical tab bar was unexpectedly fixed to "white" by [these patches](http://hg.mozilla.org/mozilla-central/rev/e90bdd97d168) introduced by the [bug 558585](https://bugzilla.mozilla.org/show_bug.cgi?id=558585).
   * da-DK locale is updated by Regmos.
 - 0.11.2011050602
   * Fixed: With Personas, vertical tab bar didn't work correctly.
   * Fixed: Pinned tabs in the rightside tab bar were unexpectedly animated.
   * Fixed: Pinned tabs wrongly disappeared when "auto hide" (not "auto shrink") is enabled.
   * Fixed: Shrunken rightside tab bar should be resizable.
   * Fixed: On Mac OS X, clicking on the grippy in the splitter for vertical tab bar didn't expand collapsed tab bar.
   * Other expanded trees were unexpectedly collapsed when the current tab was closed with collapsed children.
 - 0.11.2011050601
   * Improved: New blank tab can be opened as the next sibling of the current tab.
   * Improved: Duplicated tab by middle click of the "Reload" button can be opened as a child, a sibling, or the next sibling of the source tab.
   * Improved: New API for other addons:  `TreeStyleTabService.readyToOpenNextSiblingTab(aSourceTab)`  is available.
   * Improved: "Tabs on Top" state will be restored after uninstallation. (But if you already installed TST, the state won't be restored because TST cannot know what is the original state before TST is installed anymore.)
   * Modified: Only "selected" tabs are dragged if there is any selection (by Multiple Tab Handler, Tab Utilities, etc.)
   * Fixed: Secret prefs of Firefox itself modified by Tree Style Tab will be restored after uninstallation correctly.
   * Fixed: The rightside tab bar was wrongly out of the window, if "auto collapse" (not "auto shrink") is enabled.
   * Fixed: Pinned tabs were wrongly positioned in "auto shrink" mode.
   * Fixed: Confirmation with info bar didn't work correctly.
   * Fixed: Pinned tabs should not be closed by the command "close other tabs except this tree".
   * Fixed: The splitter for the tab bar wrongly handled dragging with right or middle mouse button.
   * Fixed: When a parent tab is closed, child tabs were wrongly controlled. The pref `extensions.treestyletab.closeRootBehavior` should work only if `extensions.treestyletab.closeParentBehavior` is `0`. (regression)
   * Fixed: The status popup was shown in wrong position if there is any sidebar or vertical toolbar.
   * Fixed: Broken tree made by middle click on "back" and "forward" button is fixed.
   * Fixed: With [Hide Caption Titlebar Plus](https://addons.mozilla.org/firefox/addon/hide-caption-titlebar-plus-sma/), vertical tab bar didn't work correctly.
   * Fixed: With Tab Mix Plus, tabs cannot be pinned correctly.
 - 0.11.2011040804
   * Fixed: Pinned tabs in the right tab bar were wrongly positioned. (regression on 0.11.2011040802)
 - 0.11.2011040803
   * Modified: Only selected tabs (which have `multiselected` attribute) are moved by drag and drop, even if selected tabs have any not-selected child.
 - 0.11.2011040802
   * Fixed: Unpinned tabs were shown with wrong margin in the left tab bar. (regression on 0.11.2011040801)
   * Fixed: When a tab which have both parent and children becomes pinned, tree structure was broken unexpectedly.
   * Modified: When the dragged tab is selected by `multiselected` attribute, drag and drop of a parent tab to a bookmark tree is handled by Firefox or other addons, not by Tree Style Tab itself.
 - 0.11.2011040801
   * Fixed: Pinned tabs were mis-positioned in the left tab bar. (regression on 0.11.2011040701)
 - 0.11.2011040701
   * Improved: The scrollbar in the leftside tab bar is shown leftside on Firefox 4. This can be disabled by `extensions.treestyletab.tabbar.invertScrollbar`.
   * Improved: The scrollbar in the vertical tab bar is shown with narrow width.
   * Improved: The minimum indent of tabs can be customized by a secret pref `extensions.treestyletab.indent.min`. Default value is `3`.
   * Improved: Dynamic changing of indent can be disabled by a secret pref `extensions.treestyletab.indent.autoShrink`.
   * Improved: Dynamic repositioning of status panels on Firefox 4 becomes better. You can disable this behvior by a secret pref `extensions.treestyletab.repositionStatusPanel`.
   * Improved: Dirty hacks for other addons can be disabled by secret prefs. See `extensions.treestyletab.compatibility.*` items in the about:config.
   * Modified: When you change some tab bar prefs (size, position and fixed) via configuration dialog or about:config, then new setting is applied to all existing windows.
   * Fixed: Dragging of the tab bar itself from a browser window to another window broke the secondary window.
   * Fixed: Unexpected too narrow tab bar is now automatically expanded.
   * Fixed: On Firefox 4 with some theme, the content area was covered by unclickable rect if auto-hide is active.
   * Fixed: On Firefox 4 on Windows Vista/7 with Classic theme (Aero Glass disabled), the height of appearance of the vertical tab bar was broken.
   * Fixed: On Firefox 4, smooth scrolling to expanding tabs were broken.
   * Fixed: On some cases, tree were not expanded automatically even if a collapsed child tab was focused.
   * Fixed: On Firefox 4, extra toolbar items inserted to the tab bar couldn't accept drag drop of tabs.
   * Fixed: On Firefox 4, the fixed closebox in the vertical tab bar itself was wrognly hidden.
   * Fixed: The drop indicator was unexpectedly shown on the vertical tab bar.
   * Fixed: On Firefox 4, works with [Focus Last Selected Tab](http://www.gozer.org/mozilla/extens
ions/) correctly.
   * Fixed: On Firefox 4, works with [Optimoz Tweaks](http://optimoz.mozdev.org/tweaks/).
   * Fixed: Progress bar in tabs inserted by Tab Mix Plus were wrongly positioned.
   * Fixed: New tabs from links opened by Tab Mix Plus were not become children of the current tab.
   * da-DK locale is available, translated by Regmos. Thanks a lot!
 - 0.11.2011032401
   * Fixed: On Firefox 4, toolbar buttons in the tab bar were unexpectedly hidden.
   * Fixed: On Firefox 4, switching of tab groups broke tree of tabs.
   * Fixed: Works with [Locationbar2](https://addons.mozilla.org/firefox/addon/locationbar%C2%B2/) correctly.
 - 0.11.2011031901
   * Fixed: Flexible toolbar items (like search bar) were wrongly shrunken and hidden if there were too many tabs.
   * Fixed: Clicking on an extra toolbar item in the tab bar wrongly selected overflow-ed tabs behind the toolbar item.
   * Fixed: In secondary browser window, bookmarks couldn't be opened after the primary browser window was closed.
   * Fixed: Toolbar customization unexpectedly moved toolbar items before tabs, to the place after tabs.
   * Fixed: Extra toolbar items in the tab bar can be removed by dragging correctly.
   * Fixed: Clicks on extra toolbar items were wrongly ignored.
   * Fixed: Tree Style Tab freezed Firefox itself when you close a last tree of tabs in the tab bar.
   * Fixed: Pinned tabs never accept dropping of tabs.
   * Fixed: Pinned tabs were sometimes wrongly positioned.
   * Fixed: Tree view was unexpectedly disabled by [Personal Titlebar](https://addons.mozilla.org/ja/firefox/addon/personal-titlebar/).
   * Fixed: Broken appearance of pinned tabs with Tab Mix Plus gone.
   * Fixed: Misplaced favicons in pinned tabs with Tab Mix Plus gone.
   * Improved: A new secret preference to control collapsed/expanded state of restored tabs, `extensions.treestyletab.collapseExpandSubtree.sessionRestore`. -1 restores the last state, 0 collapses all of restored trees, 1 expands all of them.
   * German locale was updated by Andy Pillip.
 - 0.11.2011021901
   * Fixed: TST wrongly handled drag and drop actions on the tab bar even if it is fired in the toolbar customization.
   * Fixed: Pinned tabs are shown with highlighted background correctly when their titles are changed.
   * Fixed: Better compatibility with [TotalToolbar](http://totaltoolbar.mozdev.org/).
 - 0.11.2011021601
   * Improved: Buttons in the information bar to confirm how restore other closed tabs in the tree (it is shown when you do "undo close tab" for a tab which was in a tree) now have their suitable accesskey.
   * Improved: Focusring is shown in tabs if tabs are focusable by userChrome.css.
   * Improved: On Firefox 3.6 or olders, the background of the transparent tab bar is no longer drawn if the secret pref `extensions.treestyletab.tabbar.transparent.partialTransparency` has a value equals to or larger than `1`.
   * Improved: An alternative drop-marker for drag and drop onto the vertical tab bar is available, for the "Default" skin.
   * Fixed: On Minefield, closing of the current tab didn't back the focus to the owner tab.
   * Fixed: Tearing off of multiple tabs was failed unexpectedly when [Multiple Tab Handler](http://piro.sakura.ne.jp/xul/_multipletab.html.en) is installed.
   * Fixed: Needless blank window was wrongly opened when a tab was teared off from the window by drag-and-drop.
   * Fixed: On Minefield, dragging on the grippy in the splitter for the tab bar failed to resize the tab bar.
   * Fixed: Restored tab from "Undo Close Tab" was unexpectedly opened in a collapsed tree, when [BarTab](https://addons.mozilla.org/firefox/addon/bartab/) is installed.
   * Fixed: On Minefield, the appearance of the tab bar was unexpectedly broken if [RequestPolicy](https://addons.mozilla.org/firefox/addon/requestpolicy/) is installed.
   * zh-CN locale is updated by hzhbest. Thanks!
   * es-ES locale is updated by Tito Bouzout. Thanks!
   * sv-SE (Swedish) locale is available, translated by Mikael Hiort af Ornäs. Thanks!
 - 0.11.2011020402
   * Fixed: An error in the initialization process disappeared.
 - 0.11.2011020401
   * Modified: The status panel on Minefield is shown in the another side by default, for vertical tab bar.
   * Fixed: The API `TreeStyleTabService.position` didn't work.
 - 0.11.2011020301
   * Improved: Now you can open a new blank tab in existing tree.
   * Improved: Tabs restored from about:sessionrestore become children of the tab.
   * Improved: Works with [DragNDrop Toolbars](https://addons.mozilla.org/firefox/addon/dragndrop-toolbars/).
   * Fixed: [The status panel](https://bugzilla.mozilla.org/show_bug.cgi?id=628654) is repositioned for bottom tab bar.
   * Fixed: Tabs in a moved tree were expanded wrongly, if the tree was collapsed.
   * Fixed: Tabs can't be dragged if there is Tab Mix Plus.
   * Modified: The transparency of the tab bar (for auto-hide mode) is fixed. It is no longer customizable.
 - 0.11.2011012302
   * Fixed: pl locale was broken.
 - 0.11.2011012301
   * Improved: The tab bar can be moved to another place with [Peronal Titlebar](https://addons.mozilla.org/irefox/addon/personal-titlebar/) (or otehr addons provide customizability of the tab bar). If the tab bar is moved to another toolbar, then whole the toolbar becomes "tab bar" for Tree Style Tab.
   * Improved: In bookmark group tabs (about:treestyletab-group), the existing text in the text field is automatically selected when you click the title.
   * Modified:  `TreeStyleTabService.currentTabbarPosition`  was renamed to  `TreeStyleTabService.position` . For backward compatibility, the old name is still available.
   * Fixed: Tooltip on tabs were not updated after it was shown on a twisty of a tab.
   * Fixed: Icons of tabs were unexpectedly stretched if Tab Mix Plus is installed.
   * Fixed: The drop position indicator for horizontal tab bar was unexpectedly shown even if the tab bar was vertical.
   * Fixed: When  `TreeStyleTabService.treeViewEnabled`  becomes `false`, then stacked tabs in horizontal tab bar are correctly unstacked.
 - 0.11.2011011301
   * Fixed: After rearranging of tabs in the Panorama view, the order of actual tabs were not synchronized to the order of thumbnails in the Panorama view.
   * Fixed: On Minefield, the tab bar became too wide/too narrow when you toggled the "auto hide" feature of the tab bar.
   * Fixed: Pinned tabs were shown in wrong positions.
   * Fixed: Styles of pinned tabs are updated.
   * Fixed: Pinned tabs were shown in wrong positions when a session was restored.
   * Fixed: When the "auto hide" feature of the tab bar is activated, pinned tabs are shown in stable positions.
   * Fixed: Appearance of "Sidebar" theme is updated for Minefield. There was needless border on the top of the tab bar.
 - 0.11.2011011102
   * Modified: API changing. You can get values via  `getData()`  from events fired with old names (without "nsDOM" prefix).
 - 0.11.2011011101
   * Improved: The auto hide feature of the tab bar can be customizable for both modes: normal window mode and full screen mode.
   * Improved: When the auto hide feature of the tab bar is disabled, the place holder for auto-showing by mousemove on window edges are hidden if Tree Style Tab don't handle mousemove events by the user preference.
   * Improved: New tabs from "Search XXX for SELECTED TERM" in the context menu become children of the current tab.
   * Improved: You can decide how treat drag of tree (a parent tab) to a bookmarks tree. (You can create bookmarks for all of tabs in the tree, or one bookmark for the just dragged tab.)
   * Fixed: On Minefield, the auto-hidden tab bar couldn't be shown by pressing of Ctrl key and Ctrl-Tab shortcuts.
   * Fixed: The tab bar was wrongly expanded automatically by mousemove on window edges even if Tree Style Tab shouldn't handle mousemove events by the user preference.
   * Fixed: On Minefield, the tab bar was sometimes shown with too narrow width on the startup.
   * Fixed: On Minefield, the tab bar was broken when you resized the window while the tab bar was expanded.
   * Fixed: On Minefield, the tab bar was shown with wrong position on the startup.
   * Fixed: On Minefield, appearance of tabs were broken on Mac OS X (and so on).
   * Fixed: On Minefield, extra toolbar buttons in the tab bar were wrongly hidden if a Persona (lightweight theme) was applied.
   * Fixed: On Minefield, previewing of Personas (lightweight themes) broke the appearance of the tab bar.
   * Fixed: On Minefieod, the expanded tab bar couldn't be resized by drag-and-drop on Linux.
   * Fixed: On Minefield, there was useless border on the tab bar on Linux.
   * Fixed: New tabs from the web search bar didn't become children of the current tab if `extensions.treestyletab.autoAttachSearchResultAsChildren` was set to `2`.
   * Fixed: Clicking on twisties in tabs were ignored on Mac OS X.
   * Fixed: With Tab Mix Plus, trees of tabs were not draggable.
   * Modified: API changing. API based on DOM Events are now sent as DataContainerEvent as new event types with "nsDOM" prefix, due to security restrictions on Minefield. (You can still use old API based on property access, but it doesn't work on Firefox 4 (and later) in some cases. Instead, you should use  `aEvent.getData(property name)`  to get the value from the event object.)
 - 0.11.2010120903
   * Fixed: On some webpages, TST blocked to start search from the searchbar.
 - 0.11.2010120902
   * Fixed: Tab overflow and other operations were wrongly blocked by TST's internal error.
 - 0.11.2010120901
   * Improved: A new context menu item for tabs: "Close Other Tabs except this Tree".
   * Improved: Search result tab from the web search bar become child of the current tab, when you search a term selected in the current tab. (This behavior can be customized by a new secret preference `extensions.treestyletab.autoAttachSearchResultAsChildren`. 1 = default, 2 = always open result tabs as children, 0 = disable this behavior.)
   * Improved: New tabs opened by [DomainTab](https://addons.mozilla.org/firefox/addon/13906/) become children of the current tab.
   * Fixed: The configuration dialog was broken.
 - 0.11.2010120802
   * Fixed: Initializing processes of Firefox itself or other addons were unexpectedly blocked.
 - 0.11.2010120801
   * Improved: New child tabs opened in a loop via the API should be ordered by "opened order", even if you set new child is inserted at the first position of existing children.
   * Fixed: On Minefield, "Metal" theme was broken.
   * Fixed: On Minefield, resizer for the vertical tab bar was unavailable if "auto hide" is activated.
   * Fixed: On Minefield, opening/closing of sidebar always reposition the tab bar.
   * Fixed: On Minefield, tooltips on tabs were not updated correctly.
   * Modified: Some codes are refactored.
 - 0.11.2010120301
   * Fixed: Dragging from non-tab elements were not handled.
   * Fixed: In the print preview mode, the auto hide of the tab bar should be disabled temporally.
   * Fixed: When you exit from the print preview mode, the tab bar possibly stayed hidden wrongly if All-in-One Sidebar or other addons there.
   * Fixed: Incorrect width of the tab bar disappeared for multiple windows.
   * Fixed: `TreeStyleTabFocusNextTab` event didn't fired and controlling of tab focus didn't work.
 - 0.11.2010120202
   * Improved: When a tree is dropped into a bookmarks tree, all tabs in the tree are bookmarked.
 - 0.11.2010120201
   * Modified: On Firefox 3.6 or olders on Windows, the cursor while multiple tabs are dragged is shown with default drag-and-drop style. (due to a bug of Firefox itself: Firefox cannot show a drag feedback image for dragging of multiple items via HTML5 drag and drop events.)
   * Fixed: Drag and drop operations of the tab bar was broken. (regression on 0.11.2010120101)
 - 0.11.2010120101
   * Drop support for Firefox 3.0.
   * Improved: Now Tree Style Tab uses HTML5 drag and drop events for dragging of multiple tabs. Dragging of tabs by Tab Utilities and other addons can be handled correctly.
   * Improved: Maximum level of trees can be limited. (default = 999)
   * Improved: Groups of tabs in the vertical tab bar are shown with separator margins if tree indentation is disabled.
   * Improved: New APIs:  `getAncestorTabs()`  and `TreeStyleTabFocusNextTab` event. You can cancel focus handling of Tree Style Tab when the current tab is closed, by canceling of `TreeStyleTabFocusNextTab` events.
   * Fixed: On Minefield, expanding tabs unexpectedly have no transparency.
   * Fixed: Always apply animation effects for collapsing/expanding tabs, if it is allowed.
 - 0.11.2010112601
   * Modified: Features about links are removed and re-implemented as a new addon [Open Link in New Tab](http://piro.sakura.ne.jp/xul//xul/_openlinkintab.html.en).
   * Modified: Features about the location bar are removed and re-implemented as a new addon [New Tab from Location Bar](http://piro.sakura.ne.jp/xul//xul/_newtabfromlocationbar.html).
   * Improved: More visual drop-marker for tabs in the horizontal tab bar.
   * Improved: On Minefield, tree of tabs in the horizontal tab bar can be stacked. You can disable this feature by a secret preference extensions.treestyletab.stackCollapsedTabs.
   * Fixed: On Minefield, tabs in the horizontal tab bar were unexpectedly expanded.
   * Fixed: On Minefield, tab drop indicator for the horizontal tab bar were not cleared.
   * Fixed: Indentation preference was wrongly ignored.
   * Fixed: On Linux and Mac OS X, selected theme didn't saved.
 - 0.10.2010111301
   * Fixed: On Minefield, bookmarks are opened correctly.
   * Fixed: On Minefield, tabs from links become children of the current tab correctly.
   * Modified: about: uris (about:config, about:plugins, etc.) are recognized as different domains, to open new tabs from the location bar.
   * Modified: By default, Alt-Enter in the location bar always open new tab. (If you want Alt key inverts the default behavior "new tab" vs "current tab", set `extensions.treestyletab.urlbar.invertDefaultBehavior` to `true`.)
 - 0.10.2010102501
   * Updated for [Bug 586234](https://bugzilla.mozilla.org/show_bug.cgi?id=586234): Tabs opened from links become children of the current tab correctly.
   * Updated for [Bug 568691](https://bugzilla.mozilla.org/show_bug.cgi?id=568691): Platform-specific default preferences are loaded correctly.
   * Fixed: Tree structure was possibly broken on the startup. (regression on 0.10.2010102401)
   * Fixed: On Minefield, icons in the configuration dialog are shown correctly.
 - 0.10.2010102401
   * Updated for [Bug 448546](https://bugzilla.mozilla.org/show_bug.cgi?id=448546): Tabs opened from toolbar buttons correctly become children of the current tab.
   * Updated for [Bug 568691](https://bugzilla.mozilla.org/show_bug.cgi?id=568691): Platform-specific codes are loaded correctly.
   * Updated for [Bug 586068](https://bugzilla.mozilla.org/show_bug.cgi?id=586068): Last session is correctly restored.
   * Updated for [Bug 602964](https://bugzilla.mozilla.org/show_bug.cgi?id=602964): Following-up for changes of tab structure.
   * Fixed: Tree of tabs correctly work even if there are some invisible tabs hidden by Tab Candy. (Now hidden tabs are automatically moved after visible tabs internally.)
   * Fixed: Auto-hide of the tab bar is correctly disabled while you open popup menus.
   * Fixed: Duplicated new tabs opened by double-click on the tab bar disappeared when some tab-related addons are installed.
 - 0.10.2010091901
   * Fixed: Tabs are wrongly transparent on Firefox 3.6 and old versions. (regression on 0.10.2010091801)
   * Fixed: "Reload Childen" wrongly reloads the parent tab.
   * Fixed: New tabs opened from links by [Tab Utilities](https://addons.mozilla.org/firefox/addon/59961/) becomes children of the current tab correctly.
   * Improved: You can make new tabs children of the current tab by secret preferences, when they are automatically opened from external or internal links.
     * extensions.treestyletab.openOuterLinkInNewTab.asChild makes tabs children if they are opened from external links.
     * extensions.treestyletab.openAnyLinkInNewTab.asChild makes tabs children if they are opened from internal links (links to the page in the same domain).
   * Improved: Liberated tabs (by closing of the parent tab) are put on their suitable place, not the last of the tab bar. If you wish to get back the previous behavior, change the secret preference extensions.treestyletab.closeParentBehavior.moveDetachedTabsToBottom to true.
 - 0.10.2010091602
   * Fixed: "Always show the tab bar" with vertical tab bar in the right works correctly on Minefield.
   * Fixed: Expanded tab bar is resized by dragging correctly, on Minefield.
   * Modified: Configuration about the button "list all tabs" is removed for Minefield, because the button can be customized as a normal toolbar button on Minefield.
 - 0.10.2010091601
   * Updated for the latest build of Minefield 4.0b7pre. (Firefox 4.0beta6 and older beta are never supported.)
   * Updated for changes introduced by [Bug 593967 - Add more elements into tabbrowser tabs for easier stylability](https://bugzilla.mozilla.org/show_bug.cgi?id=593967).
   * Modified: Titlebar like behaviors of the tab bar is disabled completely, when the tab bar is draggable or the tab bar is placed in left/right/bottom.
   * Fixed: Status of tabs is correctly updated when a new tabs is opened.
   * Fixed: Broken popup window (opened by  `window.open()`  with features) disappeared.
   * Fixed: Ctrl-Tab works on Mac OS X. (I misunderstood that it was triggered by the Command key.)
 - 0.10.2010091401
   * Fixed: A window is wrongly closed automatically when the last tree is closed, even if there are other groups (made by Tab Panorama).
   * Fixed: Menu items in the "list all tabs" popup are correctly indented even if tabs are grouped by Tab Panorama.
   * Fixed: Menu items in the "list all tabs" popup are correctly indented even if [Tab Utilities](https://addons.mozilla.org/firefox/addon/59961/) is installed.
   * Fixed:  `TreeStyleTabService.readyToOpenChildTab()`  works correctly (ignores the call) if it is called in the sidebar panel. (reported by Bert Blaha)
   * Fixed: The grippy in the tab bar splitter works correctly on Minefield.
   * Fixed: Unexpected shrunken window size problem disappeared. (regression on 0.10.2010091001)
 - 0.10.2010091001
   * Updated for Minefield 4.0b6pre.
   * Improved: A tab is detached from its tree automatically when the tab is moved from a group to another, on Minefield.
   * Improved: Tabs opened from "Tabs From Other Computers" of Minefield become children.
   * Fixed: Files for AeroPeek are never loaded on Linux and Mac OS X.
   * Fixed: Wrongly positioned twisties in the Metal theme disappeared.
   * Fixed: Less spaces around tabs' closeboxes in the Metal theme.
   * Fixed: Setting a session information to the tab which is the source of the session works correctly.
   * Improved: New tabs from [IE Tab Plus](https://addons.mozilla.org/firefox/addon/10909/) become child tabs.
   * Improved: New tabs from tabs pinned by [Tab Utilities](https://addons.mozilla.org/firefox/addon/59961/) never become child tabs of a hidden tab.
 - 0.10.2010080802
   * Fixed: Zombie tab disappeared on Minefield 4.0b4pre. ([Bug 585417](https://bugzilla.mozilla.org/show_bug.cgi?id=585417))
   * Fixed: Changing of indent of new tabs are not shown with animation on Minefield 4.0b4pre.
   * Fixed: New tabs are correctly opened from the location bar Minefield 4.0b4pre.
 - 0.10.2010080801
   * Fixed: Updated for [Bug 380960 - Implement closing tabs animation](https://bugzilla.mozilla.org/show_bug.cgi?id=380960).
   * Fixed: Animation effects for expanding tree work corretcly on Minefield 4.0b4pre.
   * fr-FR locale is updated by Laurent Haas.
 - 0.10.2010073001
   * Fixed: Appearance of twisty in tabs is applied on the startup correctly.
   * Fixed: Tree of tabs opened from bookmark folders are always expanded. (You can disable if by a secret preference `extensions.treestyletab.openGroupBookmark.behavior`. If you dislike this behavior, set a value: current value minus 2048)
   * fr-FR locale is updated by Laurent Haas.
 - 0.10.2010072901
   * Fixed: Context menu on tabs is available on Minefield 4.0b3pre.
   * Fixed: Context menu for tabs will be shown on blank area of the tab bar on Minefield 4.0b3pre, if the tab bar is not on top.
   * Fixed: On Minefield 4.0b3pre, opacity of tabs was wrongly fixed to 1.
   * Fixed: Blank tab bar was wrongly shown when the last tab was hidden by browser.tabs.autoHide.
   * Fixed: [A problem on turning onto private browsing mode](http://piro.sakura.ne.jp/cgi-bin/bbs.cgi?2736) disappeared.
   * Fixed: Updated for [Bug 574654](https://bugzilla.mozilla.org/show_bug.cgi?id=574654).
   * Improved: The tab bar is automatically scrolled to newly opened tabs even if they are opened in the background, only when the current tab will be not scrolled out. You can change this behavior by `extensions.treestyletab.tabbar.scrollToNewTab.mode` (default=1), 0 will disable this change, and 2 will scroll to new tabs anyway.
   * French locale is available, translated by Laurent Haas.
 - 0.10.2010070301
   * Fixed: Startup problem on Minefield 4.0b2pre disappeared.
   * Fixed: Context menu on a vertical tab bar is available on Minefield 4.0b2pre.
   * Fixed: Session restoring works correctly even if there is add-on manager tab on Minefield 4.0b2pre.
   * Fixed: "Tabs on Top" checkbox works correctly if it is checkable.
   * Fixed: Wrongly slided rendering of the content area for the auto-hidden tab bar disappeared.
   * Fixed: Imported tabs opened from "Tabs from Other Computers" of [Firefox Sync (Weave)](http://www.mozilla.com/firefox/sync) 1.4 correctly become children of the current tab.
 - 0.10.2010062901
   * Improved: Tabs pinned by  `pinTab()`  are shown as icons, even if it is in a vertical tab bar on Minefield 3.7a6pre.
   * Improved: "Tabs on Top" and "Fix Tab Bar" checkboxes are synchronized when the tab bar is placed on the top of the window on Minefield 3.7a6pre.
   * Fixed: Drag and drop of the tab bar itself works correctly on Minefield 3.7a6pre.
   * Fixed: Changing of the position of the tab bar and some operations wrongly moves the window itself on Minefield 3.7a6pre.
   * Fixed: Auto-scrolling while dragging on the tab bar works correctly on Minefield 3.7a6pre.
   * Fixed: Click on the content area wrongly selected and scrolled the page when the tab bar was automatically shown/hidden.
   * Fixed: [Wrongly opened blank windows by dragging of the tab bar](http://piro.sakura.ne.jp/cgi-bin/bbs.cgi?2698) disappeared.
   * Improved: New tabs opened by [Mouse Gestures Redox](http://www.mousegestures.org/) become children of the current tab. (by A A)
   * Improved: Imported tabs opened from "Tabs from Other Computers" of [Firefox Sync (Weave)](http://www.mozilla.com/firefox/sync) become children of the current tab.
   * ru-RU locale is updated by L'Autour.
 - 0.10.2010051201
   * Improved: Position, width (height), fixed state (position and size), and auto hide state are changable for each window.
   * Improved: On the Trunk, animation effects are re-implemented based on CSS3 Transitions.
   * Modified: Now, browser.tabs.insertRelatedAfterCurrent is always fixed to false while Tree Style Tab is available.
   * Fixed: On Windows 7, AeroPeek feature is wrongly enabled even if it is disabled by user preference.
   * Fixed: Links were not opened in new tabs automatically. (regression)
   * Fixed: "Parent tab" is correctly saved for bookmarks.
   * Fixed: Size of tooltips were wrongly fixed.
   * Fixed: The tree structure of tabs opened from a bookmark folder is correctly restored even if Tab Mix Plus is installed. (maybe)
 - 0.10.2010043001
   * Improved: Collapsed tabs are now hidden in the Aero Peek of Windows 7.
   * Updated for changes by [Bug 457187 - Make the tabs toolbar customizable](https://bugzilla.mozilla.org/show_bug.cgi?id=457187), [Bug 544815 - Allow for placing Tabs over the Navigation Bar with option for Tabs under the Navigation Bar (add tabs on top option)](https://bugzilla.mozilla.org/show_bug.cgi?id=544815), [Bug 545714 - Consolidate browser and nsContentAreaDragDrop.cpp dropped link handlers](https://bugzilla.mozilla.org/show_bug.cgi?id=545714), and [Bug 556739 - PlacesUIUtils should be a module instead](https://bugzilla.mozilla.org/show_bug.cgi?id=556739).
   * Fixed: On Minefield 3.7a5pre, [too narrow tab bar couldn't be expanded by dragging of the splitter](http://piro.sakura.ne.jp/cgi-bin/bbs.cgi?2664).
   * Fixed: On Minefield 3.7a5pre, [a bookmark folder couldn't be opened in tabs if it has not been expanded](http://piro.sakura.ne.jp/cgi-bin/bbs.cgi?2663).
   * Fixed: On Minefield 3.7a5pre, the place holder for the vertical tab bar was wrongly shown if  `window.open()`  is called with an option  `toolbars=no` .
   * Fixed: On Minefield 3.7a5pre, some items in the context menu on tabs didn't work.
   * Fixed: Broken appearance of "Plain" and "Mixed" were fixed on Linux.
   * Fixed: Ctrl-drop of tab works correctly on Linux.
   * Fixed: [a dragging on the blank area of the tab bar was wrongly recognized as a dragging on the last tab](http://piro.sakura.ne.jp/cgi-bin/bbs.cgi?2687).
   * Fixed: Dragging of a link on a tab wrongly gave focus to the tab. Now tabs will get focus after a delay (like Firefox's default behavior.)
   * Fixed: Tree Style Tab now ignores Ctrl-click and middle-click on a twisty in a tab, on the splitter of the tab bar, and on the blank area in the tab bar.
   * Fixed: Dragging of the tab bar itself is disabled while you are customizing the toolbar.
   * Fixed: Too wide tab bar (wider than the window) was gone. Now tab bar automatically fits to the window.
   * Fixed: Twisties in tabs work correctly even if some addons ([TooManyTabs](https://addons.mozilla.org/firefox/addon/9429), Tab Mix Plus, etc.) are available.
   * Fixed: Focus control by Tab Mix Plus works correctly.
   * Fixed: "Open any link in new tab" feature of Tree Style Tab works correctly with Tab Mix Plus.
   * Fixed: Works with [TotalToolbar](http://totaltoolbar.mozdev.org/) together.
   * Fixed: Broken indentations of menu items in the "list all tabs" popup disappeared with [Weave](https://mozillalabs.com/weave/).
   * Fixed: Saving and restoring sessions by [Session Manager](https://addons.mozilla.org/firefox/addon/2324) work correctly. Now all other tabs are completely closed before you restore a session.
   * de-DE locale is updated by Andy Pillip.
   * zh-CN locale is updated by hzhbest.
 - 0.10.2010040201
   * Updated for the bug: [Bug 554991  - allow tab context menu to be modified by normal XUL overlays](https://bugzilla.mozilla.org/show_bug.cgi?id=554991)
 - 0.10.2010040102
   * Fixed: Built-in theme "Metal" and "Sidebar" appliy window focus to their appearance correctly.
   * Fixed: Broken background color of the built-in theme "Vertigo" disappeared.
   * Modified: Built-in theme "Plain" is back for the default theme on Linux.
 - 0.10.2010040101
   * Modified: An obsolete built-in style "Plain" was removed, and instead new style "Flat" (it is a modified version of "Mixed" and it has no dropshadow effect) is now available.
   * Update for Minefield 3.7a4pre: Built-in styles now use  `:-moz-window-inactive`  pseudo class introduced by [Bug 508482](https://bugzilla.mozilla.org/show_bug.cgi?id=508482).
   * Update for Minefield 3.7a4pre: Toolbar animation on switching to the full screen mode is available.
   * Update for Minefield 3.7a4pre: Toolbar with wrong height on the full screen mode disappeared.
   * Improved: On Minefield 3.7a4pre, there is less redrawing of the tab bar.
   * Fixed: In some cases, showing bookmark properties caused infinity loop and made Firefox frozen.
   * Fixed: "Auto hide tab bar" didn't work in the full screen mode.
   * Fixed: Broken rendering in the full screen mode with [AutoHide](http://www.krickelkrackel.de/autohide/) disappeared.
   * Fixed: Broken behavior of "auto hide tab bar" in the full screen mode with [AutoHide](http://www.krickelkrackel.de/autohide/) on the next startup of the shutdown in the mode disappeared.
   * Fixed: Orphan dropshadows of hidden "new tab" button disappeared in the "Mixed" style, if the button was hidden by [Tab Mix Plus](https://addons.mozilla.org/firefox/addon/1122), [Tab Mix Lite](https://addons.mozilla.org/firefox/addon/12444), [Tabberwocky](https://addons.mozilla.org/firefox/addon/14439), [Tab Utilities](https://addons.mozilla.org/firefox/addon/59961), [Super Tab Mode](https://addons.mozilla.org/firefox/addon/13288), or [Remove New Tab Button](https://addons.mozilla.org/firefox/addon/10535).
   * Modified: Controlling of new tab position by [Super Tab Mode](https://addons.mozilla.org/firefox/addon/13288) is automatically disabled if user decides.
   * Fixed: Dropping of an URL onto a tab locked by [Super Tab Mode](https://addons.mozilla.org/firefox/addon/13288) doesn't replace the current page, instead it opens a new tabs.
   * Fixed: Tree Style Tab doesn't control focusing of tabs when the current tab is closed, if [Tab Utilities](https://addons.mozilla.org/firefox/addon/59961) or [Super Tab Mode](https://addons.mozilla.org/firefox/addon/13288) is installed.
 - 0.10.2010032902
   * Fixed: Misdetection of the version of Firefox is fixed.
 - 0.10.2010032901
   * Fixed: The place holder for the tab bar is correctly hidden in the print preview mode on Minefield 3.7a4pre.
 - 0.10.2010032802
   * Fixed: Wrong mergin of the vertical tab bar disappeared on Minefield 3.7a4pre.
 - 0.10.2010032801
   * Improved: Works on Minefield 3.7a4pre.
   * Improved: Double-click on the splitter resets the width/height of the tab bar.
   * Fixed: A dropshadow image was wrongly shown in the "all tabs" popup on Firefox 3.5 and later.
   * Fixed: Original values of secret preferences of Firefox modified by Tree Style Tab are now correctly restored when you disable/enable Tree Style Tab by the extensions manager.
   * Fixed: Internal operations ignore popups generated by SELECT elements in webpages correctoyl
   * Fixed: Works with [Smoothly Close Tabs](https://addons.mozilla.org/firefox/addon/71410). (maybe)
   * Fixed: Duplicated splitter disappeared when [Tab Kit](https://addons.mozilla.org/firefox/addon/5447) is installed.
   * pl locale is updated by Leszek(teo)Życzkowski.
 - 0.9.2010020502
   * Fixed: Some images of built-in theme were not loaded. (regression)
 - 0.9.2010020501
   * Improved: New built-in theme, "Sidebar" based on [SidebarStyleTab](https://addons.mozilla.org/firefox/addon/58998). Thanks, Philipp von Weitershausen!
   * Improved: When undoing "close tab", whole the tree can be restored .
   * Fixed: Error on creating new bookmarks disappeared.
   * Fixed: State of trees (collapse/expanded) are correctly restored on Firefox 3.6.
   * Fixed: On the startup, leftside tab bar doesn't appear if the tab bar should be shown in rightside.
   * Fixed: Tabs get focus by clicking on favicon correctly, when TST cannot collapse tree.
   * Fixed: Wrongly centered tabs with [Tab Utilities](https://addons.mozilla.org/ja/firefox/addon/59961) disappeared.
   * Fixed: Wrongly hidden tabs with Tab Mix Plus disappeared when the animation effect is disabled.
   * New APIs:     * markAsClosedSet()
     * unmarkAsClosedSet()
     * splitTabsToSubtrees()
     * New events, TreeStyleTabSubtreeClosing and TreeStyleTabSubtreeClosed are dispatched.
 - 0.8.2009122501
   * Improved: Works with [Tabberwocky](https://addons.mozilla.org/firefox/addon/14439).
   * Fixed: The height of transparent tab bar is automatically updated when the window is resized.
   * Fixed: Broken behavior of the splitter for the tab bar (after the tab bar is moved) disappeared (maybe). The splitter is always re-created when the position of the tab bar is changed.
   * Fixed: Moving of newly created tabs before `TabOpen` event is dispatched don't break tree structure anymore.
   * Modified: Functions, IDs, and preferences are renamed from "SubTree" to "Subtree". Following secret preferences also renamed.
     *  `extensions.treestyletab.autoExpandSubtreeOnCollapsedChildFocused` 
     *  `extensions.treestyletab.autoCollapseExpandSubtreeOnSelect.whileFocusMovingByShortcut` 
 - 0.8.2009122401
   * Fixed: Some operations in the content work correctly even after the current tab was closed. (By a regression from 0.8.2009122101 to 0.8.2009122103, window focus was wrongly lost.)
   * Fixed: Wrong focus after the current tab is closed disappeared. (Internal order of child tabs was wrongly saved in some cases.)
   * Improved: Works with [Multi Links](https://addons.mozilla.org/firefox/addon/13494) together.
 - 0.8.2009122103
   * Fixed: Background of tab bar is correctly rendered even if the page is zoomed.
 - 0.8.2009122102
   * Fixed: Collapsed children are automatically expanded if the first tab becomes new parent when the parent tab is closed.
 - 0.8.2009122101
   * Improved: Works with [Selection Links](https://addons.mozilla.org/firefox/addon/8644) together.
   * Removed: The feature to open selection links is removed. Instead, use [Selection Links](https://addons.mozilla.org/firefox/addon/8644).
   * Removed: The option to hide "New Tab" button is removed. Intead, write  `.tabs-newtab-button { visibility: collapse !important; }`  into the userChrome.css.
   * Improved: When "auto hide" of the tab bar is enabled, the tab bar is shown or hidden quickly.
   * Fixed: Changing of tab bar position by drag and drop works even if the page is PDF. (While dragging, any "EMBED" elements are hidden.)
   * Fixed: Dragging of links or texts on background tabs gives focus to the tab correctly. (It is a default behavior of Firefox 3 and later.)
   * Fixed: "Auto hide" of tab bar works correctly even if [Jetpack](https://jetpack.mozillalabs.com/) is installed.
   * Fixed: Background of tab bar is correctly rendered even if any element is inserted to the tab bar. (ex. Slidebar button of Jetpack)
   * Fixed: Needless "*" mark disappeared from the tooltip on tabs which has no child.
   * Fixed: Warning for multiple tabs closing correctly appears when all children will be closed by clicking on close box in tabs.
   * Fixed: Window state is correcly saved when the window is closed by closing a tree.
   * Improved: If there are multiple "parent" tabs in a bookmark folder, dummy tab will not appear when you open all of bookmark items in the folder as tabs. (You can get back the old behavior. Add 1024 to the integer preference `extensions.treestyletab.openGroupBookmark.behavior`.)
   * Fixed: Window size is correctly restored even if you use startup prompt of [Session Manager](https://addons.mozilla.org/firefox/addon/2324) 0.6.7. ([patched by Alice0775](http://piro.sakura.ne.jp/cgi-bin/bbs.cgi?2565)）
   * Fixed: "Collapsed" state of tree is correctly restored by [Session Manager](https://addons.mozilla.org/firefox/addon/2324).
   * Fixed: Sessions are correctly restored by [Session Manager](https://addons.mozilla.org/firefox/addon/2324), even if there is any collapsed tree.
   * Modified: You can disable all codes for compatibility with Tab Mix Plus, by a boolean preference `extensions.treestyletab.compatibility.TMP`.
   * Fixed: Drag and drop of tabs works correctly for the tab bar placed on the top of the window, even if there is Tab Mix Plus.
   * Fixed: Tree structure is correctly restored by the session management feature of Tab Mix Plus.
   * Improved: New APIs for other addons;     *  `gBrowser.treeStyleTab.partAllChildren(aTab)` 
     *  `TreeStyleTabService.currentTabbarPosition` 
     *  `TreeStyleTabService.treeViewEnabled` 
     *  `TreeStyleTabService.promoteTab(aTab)` 
     *  `TreeStyleTabService.promoteCurrentTab()` 
     *  `TreeStyleTabService.demoteTab(aTab)` 
     *  `TreeStyleTabService.demoteCurrentTab()` 
   * Improved: When you use "auto hide" feature of tab bar, then the status of the tab bar is stored to the  `treestyletab-tabbar-autohide-state`  attribute.
   * pl-PL locale is updated by Jacek Chrząszcz.
 - 0.8.2009102801
   * Fixed: The restored tree was wrongly collapsed when a parent tab was reopened by "undo close tab" or "recently closed tabs".
 - 0.8.2009102701
   * Improved: Duplicated links are ignored by "Open Selection Links in Tabs" feature.
   * Improved: Selection state is restored for tabs in the configuration dialog.
   * Improved: Tree structure is restored for tabs from [PermaTabs Mod](https://addons.mozilla.org/firefox/addon/7816).
   * Fixed: Domain detection works correctly for URL inputs into the location bar without schemer part.
   * Fixed: Wrongly collapsed tree disappeared for new parent tab from old first child.
   * Fixed: Wrongly collapsed tree disappeared after restoring last child of a tree.
   * Fixed: Not-focusable tabs disappeared even if trees cannot be collapsed by user preference.
   * Fixed: Error on dragging of something on the tab bar disappeared.
   * Improved: "Pie" progress icon on Trunk is available.
   * zh-CN locale is updated by hzhbest
   * de-DE locale is updated by Andy Pillip.
 - 0.8.2009100101
   * Fixed: Better restoration of tree structure on restarting.
 - 0.8.2009093001
   * Improved: Other trees keep themselves expanded if tabs are inserted to an expanded tree.
   * Fixed: Better restoration of tree structure on restarting.
   * Fixed: `browser.tabs.loadInBackground` works correctly for Ctrl/Command-click on links. (`browser.tabs.loadDivertedInBackground` was wrongly applied.)
   * Fixed: Works with Google Toolbar Sidewiki.
 - 0.8.2009090901
   * Fixed: Duplidated blank tabs, opened after closing of the last tab, disappeared on Firefox 3.5 or later.
   * Fixed: Clicking on the grippy in the splitter of tab bar works correctly, on Firefox 3.5 or later.
   * Fixed: Too high CPU load disappeared for webpages which dispatche `scroll` event frequently.
   * Improved: `browser.tabs.loadDivertedInBackground` works for new tabs automatically opened from links.
   * Improved: After uninstallation, original values of secret preferences of Firefox itself modified by Tree Style Tab are restored.
 - 0.8.2009090403
   * Improved: Dragging of the tab bar becomes silent. No feed back image, and no drop position marker while the position of the tab bar is possibly not changed.
   * Improved: Dragging gesture near the tab bar splitter will be ignored. (Insensitive range can be customized by  `extensions.treestyletab.tabbar.fixed.insensitiveArea` )
   * Improved: Tabs opened by [Snap Links Plus](http://snaplinks.mozdev.org/) become child tabs of the current tab.
   * Fixed: Wrongly transparent tabs disappeared for disabled auto-hide tab bar.
 - 0.8.2009090402
   * Fixed: The configuration UI for tab bar transparency was broken on Firefox 3.0.x.
   * Fixed: Dragging on scrollbar or popup menu wrongly started to move the tab bar.
   * Fixed: Background canvas in the tab bar was not updated after the tab bar was resized.
   * Fixed: Works with [Drag &amp; Drop.io](https://addons.mozilla.org/firefox/addon/8482).
   * zh-CN locale is updated by hzhbest
 - 0.8.2009090201
   * Improved: You can move the tab bar by drag and drop. If you start dragging with Shfit key, then you can move it even if the position of the bar is fixed.
   * Improved: Now, collapsed trees are never expanded automatically, while you are changing tab focus by Ctrl-Tab. If you like the old behavior, set  `extensions.treestyletab.autoCollapseExpandSubTreeOnSelect.whileFocusMovingByShortcut`  to  `true` .
   * Modified: Configuration dialog is restructured.
   * Modified: "Tab Bar Position" menu is no longer available, from the context menu on tabs.
   * Fixed: Broken order of restored tabs from the last session disappeared. (Note: if you use Tab Mix Plus, broken order still appears.)
   * Fixed: Collapsed trees are correctly moved between windows by drag and drop.
   * Fixed: Other trees are correctly collapsed automatically as you set, when a tab in collapsed tree is focused.
   * Fixed: Broken position of splitter for the bottom tab bar disappeared.
   * Fixed: New tabs from bookmarks and others are correctly positioned, when Tab Mix Plus is installed and new tabs have to be opened next to the current tab.
   * zh-CN locale is updated by hzhbest
   * zh-TW locale is updated by Tsprajna.
 - 0.8.2009081101
   * Improved: Tree structure in tooltips on tabs can be hidden by user preference.
   * Improved: New tabs from "History" sidebar are operated like as tabs from bookmark folder.
   * Improved: Now you can modify tree structure of tabs by bookmark properties dialog more freely.
   * Fixed: Bookmark panel of "Star" icon works correctly.
   * Fixed: Broken tree after you dragged and dropped selected tabs disappeared.
   * Fixed: With some themes, vertical tab bar is shown correct width.
   * Fixed: "Open All in Tabs" of bookmark folders work correctly on Firefox 3.0.x.
   * Fixed: Auto-hide behavior of the tab bar is correctly disabled when you disable auto-hide of toolbars in the fullscreen mode.
   * Fixed: Broken order of tabs after restoring sessions disappeared. (regression on 0.8.2009073101)
   * Fixed: Initializing operations of bookmark properties are correctly disabled for each page-loading.
   * Fixed: You can prevent to restore tree strucutre from bookmarks. To do it, append 512 to the value of `extensions.treestyletab.openGroupBookmark.behavior`.
   * de-DE locale is updated by Andy Pillip.
   * zh-CN locale is updated by hzhbest
 - 0.8.2009073102
   * Fixed: Bookmark property works correctly. (regression on 0.8.2009073101)
 - 0.8.2009073101
   * Drops Firefox 2 support.
   * Improved: When a parent tab is closed and the tab has no sibling tab, then all of child tabs are raise to upper level even if you set the first child becomes new parent.
   * Improved: You can save tree structures to bookmarks.
   * Improved: The default name of new bookmark folder created by "Bookmark this tree" becomes to same name of the parent tab.
   * Fixed: Tabs opened from selected items in "Library" are correctly grouped.
   * Improved: Names of collapsed children are shown in the tooltip on a collapsed tree.
   * Improved: You can choose how to open the dropped link onto a tab / bookmark items, by their dialog.
   * Fixed: Stupid focusing when you close the current parent tab disappeared.
   * Fixed: "Bookmark this tree" and "Bookmark all tabs" work correctly even if Tab Mix Plus is installed.
   * Fixed: Wrongly centered tabs in vertical tab bar disappeared even if Tab Mix Plus is installed.
 - 0.7.2009072401
   * Improved: "Gather to a New Tree" is available for selected tabs, with Multiple Tab Handler.
   * Improved: Dummy parent tabs which have no child are automatically closed.
   * Modified: "auto" style for tree twisties always works as "retro", if thumbnails in tabs of Informational Tab are shown in the row same to tab label.
   * Improved: Checkboxes for "New Tab" and "List All Tabs" buttons save their value for each position: vertical or horizontal.
   * Modified: When the current tab is closed, the previous visible tab will be focused instead of the previous sibling.
   * Fixed: Operations when tabs are dropped to the tab bar work correctly on Firefox 3.5.
   * Fixed: With vertical tab bar, you can move the dragged tab to a new window correctly, when you drop it onto the content area.
   * Fixed: The appearance of "New Tab" button is correctly updated after you switch tab bar position from horizontal to vertical.
   * Fixed: Works with [Focus Last Selected Tab 0.9.5.x](http://www.gozer.org/mozilla/extensions/).
   * Fixed: With Tab Mix Plus, focus control by Tree Style Tab is available if you set to focus to the right tab when you close the current tab.
   * Updated: de-DE locale is updated by Andy Pillip.
 - 0.7.2009071001
   * Improved: The height of horizontal tab bar is now flexible. (require unchecking "fix height of tab bar")
   * Improved: Indentation and tree-collapsability settings are saved to the tab bar for each position: horizontal and vertical.
   * Improved: Now you can rename dummy tabs from bookmark folders.
   * Improved: When you create bookmark folder from tab sub trees, the parent tab will be ignored if it is a dummy tab.
   * Improved: A new preference to prevent expanding of focused tree on tabs are closed is available.
   * Improved: A new secret preference, to prevent expanding of tree including focused tab in his collapsed children, is available. It is `extensions.treestyletab.autoExpandSubTreeOnCollapsedChildFocused`.
   * Fixed: Indent of tabs are correctly updated when the tab bar position is changed.
   * Fixed: Broken order of restored tabs disappeared, even if the focused tab is in a tree.
   * Fixed: Missing items of the context menu on tabs are back.
   * Fixed: With Tab Mix Plus, position of newly opened tab is correctly placed just below the current tab, as your preference.
   * Fixed: Auto-scrolling to focused tabs works correctly with Tab Mix Plus.
   * Fixed: Duplicated bookmark folders from "Bookmark This Tree" disappeared even if Multiple Tab Handler is installed.
   * Fixed: Configuration dialog works correctly with ru-RU locale.
   * zh-CN locale is updated by hzhbest.
   * zh-TW locale is updated by Tsprajna.
 - 0.7.2009070701
   * Improved: "Reload this Tree" and "Reload Children" are avilable for the context menu on tabs.
   * Fixed: The first child tab will be focused correctly even if the parent current tab is closed and the first child becomes new parent.
   * Fixed: Private browsing mode works correctly even if there are collapsed trees.
   * Fixed: The previous "sibling" tab will be focused after the last tab is closed. In old versions, just previous tab (it is possibly a descendant of another tab) was focused.
   * Fixed: On Firefox 3.0, closing of the last child tab of a "dummy" tab for a bookmark group works correctly.
   * Fixed: Broken order of tab context menu items disappeared.
   * zh-TW locale is updated by Tsprajna.
   * de-DE locale is updated by Andy Pillip.
 - 0.7.2009062901
   * Improved: When the parent tab of a tree is closed, then the first child tab becomes new parent. (You can disable this feature by preference)
   * Improved: Tabs from bookmark folder are grouped under a dummy tab.
   * Fixed: The number of closed tabs is shown correctly.
   * Fixed: With horizontal tab bar, invisible "clickable" area leftside of tabs disapepared. You can click closeboxes of tabs correctly.
   * New custom events for developers: `TreeStyleTabParted` (for detaching of a tab from a tree) and `TreeStyleTabAutoHideStateChanging` (for auto-show/hide of the tab bar)
   * Fixed: Throbber in tabs is correctly shown with Firefox 3.5 on Mac OS X.
   * it-IT locale is updated by Godai71.
   * de-DE locale is updated by Andy Pillip.
 - 0.7.2009051501
   * Fixed: After Auto-show/hide of the tab bar, visibility of  closeboxes in tabs is correctly updated.
   * Fixed: Without Multiple Tab Handler, extra menu items in the tab context menu are correctly shown. (regression of 0.7.2009051301)
   * Fixed: The width of shrunken and expanded tab bar is correctly updaded after you modifies the width. (regression of 0.7.2009051301)
   * Fixed: Auto-hide of the tab bar works correctly after tooltips are canceled. (regression of 0.7.2009051301)
 - 0.7.2009051301
   * Improved: You can invert tab appearance and tab contents parallelly.
   * Improved: Appearance of indented tabs on the top of windows is customized for each platform.
   * Modified: Auto-hide of tab bar is temporally disabled while any popup menu is shown.
   * Modified: Collapse/expand operations of tabs in horizontal tab bar are shown with animation effect.
   * Modified: `extensions.treestyletab.tabbar.invertClosebox` becomes a secret preference (checkbox for the option will not be shown in the configuration dialog). And, on Mac OS X, the default value becomes same to other platforms.
   * Modified: Clicking on favicons are ignored by Tree Style Tab if [TooManyTabs](https://addons.mozilla.org/firefox/addon/9429) is installed.
   * Modified: Maximum indent of top/bottom tab bar is fixed in a range.
   * Fixed: Broken indent disappeared, after closing of multiple tabs.
   * Fixed: Broken order of tab contents disappeared, after closebox in tabs are shown/hidden.
   * Fixed: Unexpectedly blank space over the reopened tab disappeared, even if there was only one blank tab.
   * Fixed: Releasing of ctrl key correctly cancels auto-show of tab bar.
   * Fixed: Odd animation for newly opened tabs disappeared even if thumbnails are shown in tabs by [Informational Tab](http://piro.sakura.ne.jp/xul/_informationaltab.html.en).
 - 0.7.2009043002
   * Works on Minefield.
 - 0.7.2009043001
   * Fixed: With [Split Browser](http://piro.sakura.ne.jp/xul/_splitbrowser.html.en), the window isn't closed even if the last tab in the main pane is moved to another window from an window which have some panes.
 - 0.7.2009042803
   * Fixed: Non-URI input for the location bar works correctly again. (regression on 0.7.2009042801)
 - 0.7.2009042802
   * Fixed: Errors on localhost or other special cases disappeared. (regression on 0.7.2009042801)
 - 0.7.2009042801
   * Improved: "Same/different website" detection is now based on Effective TLD list of Firefox 3.
   * Improved: Closebox in each tab can be shown leftside. (The option is enabled by default on Mac OS X.)
   * Modified: Click events on favicons are not canceled if the tab don't have collapsed children.
   * Fixed: The parent tab is correctly focused and sub tree is correctly collapsed, when you collapse a sub tree including the focused tab. (regression on 0.7.2009040901)
   * Fixed: New tabs become chldren of the current tab correctly even if [Highlander](https://addons.mozilla.org/firefox/addon/4086) is installed.
   * Fixed: "Open All in Tabs" command for bookmark folders opens tabs as a sub tree correctly.
   * Fixed: The label of default behavior about bookmark folders is updated for Firefox 3.
   * Fixed: Tabs moved by `moveTabTo()` method are correctly indented.
   * Works with [Chromifox Basic](https://addons.mozilla.org/firefox/addon/8782).
   * Works with [FullerScreen 2.4](https://addons.mozilla.org/firefox/addon/4650).
   * Works with [AutoHide 1.5.4](http://www.krickelkrackel.de/autohide/).
   * Works with [Duplicate Tab 1.0.2](https://addons.mozilla.org/firefox/addon/28).
   * Works with [QuickDrag 2.0.1](https://addons.mozilla.org/firefox/addon/6912).
   * Supposedly works with Tab Mix Plus 0.3.7.3.
   * Fixed: New tabs opened by the option "Force to open in new tab" of Tab Mix Plus become children of the current tab correctly.
   * zh-TW locale is updated.
   * pl-PL locale is updated. (by Andrzej Pasterczyk)
 - 0.7.2009042301
   * Fixed: Broken indent and memory leak disappeared for closing of child tabs which have descendant tabs. (regression on 0.7.2009042101)
 - 0.7.2009042101
   * Modified: Checkbox for "List all tabs" button is always shown.
   * Modified: Checkbox for "New Tab" button on Firefox 3.5 is hidden for Firefox 3.0 or lower versions.
   * Modified: Changing tab bar mode only between horizontal and vertical resets state of checkboxes for tab bar contents.
   * Modified: Animation effect to collapse/expand tabs is disabled if the tree of tabs cannot be collapsed by preference.
   * Modified: Appearance of "twisty" of tabs are inverted for horizontal and collapsable tab bar. (only on Modern style)
   * Modified: Animation effect for tab switching now starts after the current tab is completely selected.
   * Fixed: Wrong tab focus on closing the current "parent" tab with the setting "Move child tabs to the level of the closed parent tab" disappeared. (regression on 0.7.2009040901)
   * Fixed: "Auto-Hide" tab bar is now correctly resized. (regression)
   * Fixed: Now "shrunken" tab bar cannot be smaller than the "expanded" tab bar correctly. (regression)
   * Fixed: Wrongly disappearing of focused tab after closing the current tab disappeared.
   * Fixed: The height of "top" tab bar with indent is not changed by hovering on tabs.
   * Improved: Changing preferences of tab bar width is appied to the GUI automatically.
   * Improved: New APIs for developers or heavy users,  `TreeStyleTabService.setTabbarWidth()`  and  `TreeStyleTabService.setContentWidth()`  are available.
   * it-IT locale is updated. (by Godai71)
   * de-DE locale is updated. (by Andy Pillip)
 - 0.7.2009040901
   * Improved: Animation effects are available.
   * Improved: New option to close all of child tabs when the "parent" tab is closed even if the tree is expanded.
   * Improved: Auto-scroll for tab draggings is available.
   * Fixed: "Close Tab" button on the tab bar closes only one tab correctly.
   * Fixed: Broken tree disappeared when trees are duplicated or moved to another window.
   * Fixed: Auto-hide of tab bar works for rightside or bottom tab bar.
   * pl-PL locale is available. (translated by Andrzej Pasterczyk)
 - 0.7.2009040201
   * Works on Minefield again.
   * Improved: A narrow bar for auto-hide tab bar is available. You can access to the tab bar even if there is a full-screen Flash.
   * Improved: Pointing on the tab bar keeps auto-hide tab bar shown even if it is shown by keyboard shortcuts.
   * Fixed: Keyboard shortcuts to switch tabs show tab bar automatically in the fullscreen mode.
   * Fixed: It disappeared that infinity redrawing on auto-collapse with some theme including paddings for tabs.
   * Fixed: Too narrow tab bar in the fullscreen mode disappeared.
   * Fixed: The content area is correctly redrawed after you exit from the fullscreen mode.
   * Fixed: Works correctly even if it is the initial startup.
   * Fixed: "New Tab" button in the tab bar works correctly.
 - 0.7.2009032801
   * Fixed: "Vertigo" style was broken on Firefox 3.0.x.
 - 0.7.2009032701
   * Improved: Appearance of tabs in "Mixed" style is updated.
   * Fixed: Works with [Mouseless Browsing](https://addons.mozilla.org/firefox/addon/879) correctly.
   * Fixed: Tooltip on tabs is always hidden while tab drag, because we sometimes drop tabs to the tooltip accidentally.
 - 0.7.2009032502
   * Improved: Background image of tab icons shown as an animation. (Firefox 3 or later)
 - 0.7.2009032501
   * Improved: New theme "Metal" is available. It is the default theme on Mac OS X.
   * Fixed: Odd appearance on Linux and Mac OS X disappearef.
   * Fixed: It disappeared that infinity redrawing on auto-collapse with some theme.
   * Fixed: Dropped tabs from another window keep their tree structure correctly.
   * Improved: A custom event `TreeStyleTabCollapsedStateChange` is available for developers. 
   * de-DE locale is updated by Andy Pillip.
 - 0.7.2009031701
   * Improved: New tabs from [QuickDrag](https://addons.mozilla.org/firefox/addon/6912), [Linky](https://addons.mozilla.org/firefox/addon/425), [Mouseless Browsing](https://addons.mozilla.org/firefox/addon/879), and [Snap Links](https://addons.mozilla.org/firefox/addon/4336) become child tabs of the current tab.
   * Improved: Dropped tab becomes new first child if you set new child tabs to be inserted as first child.
   * Fixed: The closebox in the tab bar (not in tabs) works correctly.
   * Fixed: Correct behavior of tab dropping.
   * Fixed: Correct appearence of the closebox in the vertical tab bar (not in tabs).
   * Fixed: Correct appearance of the "new tab" button in the vertical tab bar with Tab Mix Plus.
   * Fixed: The tab bar is correctly scrolled by tab focus even if Tab Mix Plus is installed.
   * Updated: Italian locale is updated. (by Godai71)
 - 0.7.2009030901
   * Improved: On Firefox 3.5 or later, vertical tahs are shown with dropshadow.
   * Modified: When the last child tab is dropped just after its parent, the dragged tab becomes a next sibling of the parent.
   * Modified: Dropped tabs always become last child of the target tab.
   * Fixed: On Shiretoko 3.1b4pre, position of "new tab" button is correctly updated when many tabs are open.
   * Fixed: Ctrl-Tab correctly circulate tab focus.
 - 0.7.2009021201
   * Works on Firefox 3.1b3pre.
   * Fixed: XLinks in SVG (or others) are correctly ignored when it is clicked.
   * Fixed: The first child tab is correctly focused if the parent tab is closed.
   * Improved: You can open links from separete selections in new tabs.
 - 0.7.2008122801
   * Fixed: Buttons on the tab bar work correctly.
   * Added: ru-RU locale is available. (by L'Autour)
 - 0.7.2008120401
   * Fixed: Possibly works with [Tab History](https://addons.mozilla.org/firefox/addon/1859).
   * Fixed: Works with [Aging Tabs](https://addons.mozilla.org/firefox/addon/3542).
   * Fixed: On Shiretoko 3.1b3pre, dropping of files, links, etc. to the tab bar is correctly performed.
   * Improved: Clicks on spaces of indented tabs work as clicks on tabs. Thus, you can switch tabs by clicking screen edges in the full screen mode. If you disable this change, change the value of a secret preference `extensions.treestyletab.clickOnIndentSpaces.enabled` to `false`.
 - 0.7.2008120201
   * Fixed: Drag and drop of tabs works correctly on Minefield 3.1b3pre.
   * Fixed: Drag and drop of links works correctly on Minefield 3.1b3pre.
   * Improved: Dragging parent tab and dropping it out of the window tears off the subtree to a new window on Minefield 3.1b3pre.
   * Improved: "Open a new tab" button can be hidden by checkbox on Minefield 3.1b3pre.
   * Fixed: The checkbox for "List all tabs" button works correctly on Minefield 3.1b3pre.
   * Improved: New tabs from [SBM Counter](http://miniturbo.org/) are opened as child tabs of the current tab.
   * Fixed: Broken menu with [Multiple Tab Handler](http://piro.sakura.ne.jp/xul/_multipletab.html.en) disappeared.
 - 0.7.2008110801
   * Fixed: "Maximized" state is correctly restored on the next startup.
 - 0.7.2008110701
   * Fixed: Dropping of tabs works correctly on the blank are of the tab bar.
   * Fixed: Works on Minefield 3.1b2pre.
   * es-ES locale is updated. (by tito)
   * it-IT locale is updated. (by Godai71)
   * de-DE locale is updated. (by Andy Pillip)
 - 0.7.2008101801
   * Improved: On Minefield 3.1b2pre, tabs are moved from an window to another by drag and drop, without reloading.
   * Fixed: "Bookmark Sub Tree" feature works with Tab Mix Plus.
 - 0.7.2008101502
   * Fixed: Flashing when tab bar is automatically collapsed/expanded disappeared on Minefield 3.1b2pre.
   * Fixed: Works with [LastTab](https://addons.mozilla.org/firefox/addon/112).
 - 0.7.2008101501
   * Improved: Works on Minefield 3.1b2pre.
   * Improved: A new feature, "Bookmark this Tree" is available for tab context menu.
   * Improved: Tab indentation is automatically adjusted by tab bar width.
   * Fixed: Works with [Menu Edit](https://addons.mozilla.org/firefox/addon/710). Menu items of tab context menu are not duplicated anymore.
   * Fixed: Works with [Link Widgets](https://addons.mozilla.org/firefox/addon/2933).
   * Fixed: Works with [FireGestures](https://addons.mozilla.org/firefox/addon/6366) again.
   * Fixed: Tab indentation is correctly back after full screen mode is finished.
   * Fixed: Content area are correctly rendered after auto-hide tab bar feature is disabled.
   * Fixed: Links in web pages are correctly opened as child tabs automatically.
   * Fixed: Secondary or later windows are initialized correctly.
   * Fixed: Sub tree is correctly collapsed even if one of descendant tab is selected.
   * Fixed: The number of closed tabs in warning dialog is corrected.
   * Fixed: Sub tree structure of the current tab is correctly restored even if [Session Manager](https://addons.mozilla.org/firefox/addon/2324) is installed.
   * Updated: German locale is updated.
   * Updated: Italian locale is updated.
 - 0.7.2008062001
   * Improved: Session Management of Tab Mix Plus is supported.
   * Fixed: Tab Mix Plus can know a tab in vertical tab bar is visible or not. (If you like, you can take the old behavior back by changing `extensions.treestyletab.TMP.doNotUpdate.isTabVisible` to `true`.)
   * Fixed: Scroll position is correctly restored when a tab is closed in vertical tab bar.
 - 0.7.2008061901
   * Improved: Tab appearance specified by the current theme is available for vertical/bottom tab bar.
   * Modified: Tab appearance is changed a little.
   * Fixed: Greasemonkey 0.8 or later is supported.
   * Fixed: Keyboard shortcuts or other cases expand shrunken tab bar correctly.
   * Fixed: In vertical tab bar, it is scrolled to the selected tab after a tab is closed.
   * Fixed: Broken context menu on tabs disappeared, with the Multiple Tab Handler.
 - 0.7.2008061701
   * Improved: Now the "Auto Hide Tab Bar" feature makes tab bar shrunken, not collapsed. However you can choose the old behavior as you like. (This improvement was inspired from Zusukar's patch. Thanks!)
   * Improved: Better full zoom support on Firefox 3.
   * Improved: Better full screen support on Firefox 3.
 - 0.6.2008061601
   * Improved: Subtrees are automatically opened while drag-and-drop operations.
   * Fixed: Appearance on Mac OS X is corrected.
 - 0.6.2008050601
   * Added: Traditional Chinese locale is available. (by HkYtrewq, Thanks!)
 - 0.6.2008050101
   * Improved: Advanced settings are available for auto-hide feature of the tab bar.
   * Improved: Auto-hide of the tab bar is disabled while you drag scrollbars.
   * Improved: New tabs from GM_openInTab of Greasemonkey are opened as child tabs of the current tab.
   * Fixed: Configuration dialog works correctly with Minefield on Linux.
   * Fixed: Tree structure is kept correct when top-level tabs are reopened.
   * Fixed: Multiple bookmarks are opened as separate tabs even if Tab Mix Plus is available.
   * Fixed: Works on Firefox 3 beta5.
   * Added: German locale is available. (by Andy Pillip)
 - 0.6.2008031101
   * Fixed: Wrongly shown tab bar after keyboard shortcuts are used disappeared.
   * Modified: Tab bar is shown in half-transparent appearance.
   * Chinese locale is updated.
 - 0.6.2008030904
   * Fixed: Auto-hide works correctly on Minefield.
 - 0.6.2008030903
   * Improved: Tab bar is shown as transparent, when it is placed to left, right, or bottom and auto-hide is available.
 - 0.6.2008030902
   * Fixed: Pressing Ctrl key in a while works correctly in Linux.
   * Fixed: Wrongly shown canvas disappeared.
 - 0.6.2008030901
   * Improved: Auto show/hide of the tab bar becomes more flexible.
   * Improved: Flash on auto show/hide of the tab bar decreased.
   * Improved: New tabs opened by [FireGestures](https://addons.mozilla.org/firefox/addon/6366) become child tabs.
   * Spanish locale is available. (by tito, Thanks!)
   * Works on Minefield 3.0b5pre.
 - 0.5.2008030303
   * Fixed: Some preferences are saved its user value correctly after the addon is re-installed.
   * Fixed: Position of closeboxes in inverted rightside tabs are corrected.
 - 0.5.2008030302
   * Improved: Toolbars beside the tab bar, provided by [All-in-One Sidebar](https://addons.mozilla.org/firefox/addon/1027) with a secret preference `extensions.aios.tbx.tabbar`, are available on vertical tab bar. If you turn it to `true`, customizable toolbars are shown on/below the vertical tab bar.
 - 0.5.2008030301
   * Improved: "Auto" is available for the style of tree twisties.
   * Fixed: Works with Tab Mix Plus 0.3.6.1.
   * Fixed: Works with combination of Firefox 3 and Tab Mix Plus.
   * Fixed: Works with [FLST](https://addons.mozilla.org/firefox/addon/32) and [Tabbrowser Preferences](https://addons.mozilla.org/firefox/addon/158).
   * Added: zh-CN locale is available. (by [Fatiaomao](http://fatiaomao.yo2.cn/), Thanks!)
 - 0.5.2008022901
   * Improved: Appearance of tree twisties can be changed.
 - 0.5.2008022801
   * Improved: Children tabs inherits the color of the parent tab if [ColorfulTabs](https://addons.mozilla.org/firefox/addon/1368) is available.
   * Improved: New tabs opened by drag and drop in web pages with [Super DragAndGo](https://addons.mozilla.org/firefox/addon/137) or [Drag de Go](https://addons.mozilla.org/firefox/addon/2918) become children of the current tab automatically.
   * Improved: Auto-tree feature (like above) can be disabled completely by a secret preference `extensions.treestyletab.autoAttachNewTabsAsChildren`. If you don't want any tabs to be children automatically, you should turn it to `false`.
 - 0.5.2008022702
   * Fixed: Bookmark groups are loaded by your preference correctly on Firefox 3.
   * Fixed: New tabs from the location bar or other cases opened correctly. (it was a regression in 0.5.2008022701)
 - 0.5.2008022701
   * Improved: Now you can change the position of tab bar dynamically from context menu on tab bar.
   * Fixed: Became compatible to [Highlander](https://addons.mozilla.org/firefox/addon/4086) and [PermaTabs](https://addons.mozilla.org/ja/firefox/addon/2558) (maybe)
   * Updated: Italian locale is updated. (by Godai71.Extenzilla)
 - 0.5.2008022501
   * Fixed: A typo in en-US locale disappeared.
   * Fixed: "Fix width of tab bar" state is restored correctly on every startup.
 - 0.5.2008022402
   * Improved: Moving of tabs by drag and drop from other windows is available on Firefox 3.
 - 0.5.2008022401
   * Improved: Drag and drop actions for selection tabs are available with [Multiple Tab Handler](http://piro.sakura.ne.jp/xul/_multipletab.html.en).
   * Fixed: Drag and drop actions work correctly on Firefox 3.
 - 0.5.2008022301
   * Improved: New tabs opened from the location bar can be opened as children of the current tab even if their domains are different from the current.
   * Improved: New option to fix width of the tab bar and hide splitter is available in the context menu of the tab bar.
   * Fixed: Compatibility with some themes (iFox etc.) is improved.
   * Fixed: Double clicking on the tab bar works correctly.
 - 0.5.2008022201
   * Improved: Works on Firefox 3 beta3.
   * Fixed: Tabs opened from the bookmarks sidebar are grouped correctly.
   * Improved: UI to modify detailed settings of auto hide is available.
   * Fixed: Compatibility with multi-row tab bar of Tab Mix Plus is improved.
 - 0.5.2007120101
   * Improved: Tooltips and hover icon are updated for tree twisties in tabs.
 - 0.5.2007113001
   * Fixed: "No tab is selected" problem (which appear when there is a tree of tabs in the end edge of the tab bar, it is collapsed, the root tab of the tree is selected, and it is closed) disappeared.
 - 0.5.2007112801
   * Improved: New item "Close Children" (and middle-click on "Close this Tree") are available in the context menu on tabs.
   * Fixed: Wrongly collapsed tab which is moved from other tree by drag and drop disappeared.
   * Modified: Internal operations to move tabs and restoring tree state are rewritten.
   * Updated: Italian locale is updated. (by Godai71.Extenzilla)
 - 0.5.2007112401
   * Fixed: Broken tree of restored session disappeared.
   * Fixed: Broken tree of restoring closed tabs disappeared.
   * Fixed: Broken tree of bookmark group disappeared.
   * Fixed: Too small width of indent disappeared.
   * Fixed: Dropping is prevented correctly on descendant tabs of the dragged tab.
 - 0.5.2007111801
   * Improved: While dragging something to tabs, collapsed subtree are expanded automatically by waiting on it.
   * Fixed: "Close this Tree", "Collapse All Trees" and "Expand All Trees" work correctly.
 - 0.5.2007111702
   * Fixed: Broken tree with duplicated tabs made by Session Store API of Firefox 2 ([Multiple Tab Handler](http://piro.sakura.ne.jp/xul/_multipletab.html.en) etc.), disappeared.
 - 0.5.2007111701
   * Improved: "Collapse All Tree" and "Expand All Tree" are available in the context menu on tabs.
   * Improved: Menu items of "List all tabs" button are indented like the tree.
   * Updated: Italian locale is updated.
 - 0.5.2007111502
   * Fixed: Focus of tabs can be moved by keyboard shortcuts and so on correctly.
   * Fixed: Problem about links with `target` attribute which were wrongly loaded to both of new tab and the current tab, is corrected.
   * Fixed: Broken indent of restored tab is corrected.
   * Fixed: Broken counter of collapsed descendant tabs is corrected for reopened tabs.
 - 0.5.2007111501
   * Improved: Performance of combinations with Tab Mix Plus and [Split Browser](http://piro.sakura.ne.jp/xul/_splitbrowser.html.en) is improved.
   * Fixed: When there is only one tree and all of tabs are related to it, you can close the whole of the tree without fatal error.
   * Fixed: Structure of tabs tree are kept correctly even if uninitialized tabs are moved.
 - 0.4.2007111302
   * Fixed: Broken tree disappeared in most cases, if you use Tab Mix Plus.
 - 0.4.2007111301
   * Fixed: Invisible tabs which appears when a parent tab was closed, disappeared.
   * Improved: Works with Tab Mix Plus. (Too buggy, so you should use only with leftside or rightside tab bar.
 - 0.4.2007111001
   * Improved: Vertical tab bar can be shown/hidden automatically.
   * Improved: Grippy in the splitter of the tab bar is available on Minefield. When you click grippy, the tab bar will be collapsed quickly.
   * Improved: "List all tabs" button can be shown in the vertical tab bar.
   * Modified: Leftmost scrollbar of leftside tab bar is disabled on Firefox 3 or later, because it doesn't work anymore.
 - 0.3.2007110701
   * Fixed: Tab bar can be moved dynamically again.
   * Fixed: Wrong position of tab icons is corrected.
 - 0.3.2007110601
   * Fixed: Wrongly expanded tab bar in the leftside with leftmost scrollbar disappeared.
   * Modified: Method to invert appearance of rightside tabs is changed.
   * Added: Italian locale is available. (made by Godai71.Extenzilla)
 - 0.3.2007110501
   * Fixed: Closeboxes of tabs can be clicked even if there is leftmost scrollbar in the vertical tab bar.
 - 0.3.2007103102
   * Improved: Insertion point of new child tabs becomes customizable. New child can be inserted at the top of the sub tree as the first child, or append to the sub tree as the last child.
 - 0.3.2007103101
   * Fixed: Works with [ImgLikeOpera](https://addons.mozilla.org/firefox/addon/1672) correctly.
   * Fixed: Broken popup for selected tabs by [Multiple Tab Handler](http://piro.sakura.ne.jp/xul/_multipletab.html.en) disappeared.
 - 0.3.2007103002
   * Improved: "Close this Sub Tree" menuitem is available in the context menu on tabs even if Multiple Tab Handler is not available.
   * Fixed: Broken appeaarance of tabs in Firefox on Mac OS X disappeared.
 - 0.3.2007103001
   * Improved: When new tabs are opened from links or location bar automatically, the behavior is inverted if modifier key (Ctrl, Command or Alt) is pressed.
   * Fixed: Wrong focus of tabs, appeared when the first child tab of subtree is closed, disappeared.
 - 0.3.2007102904
   * Fixed: List of child tabs is correctly updated when a child tab is closed.
 - 0.3.2007102903
   * Fixed: Wrongly opened blank tab from "javascript:" links disappeared.
 - 0.3.2007102902
   * Fixed: The new feature to load links in new tab works correctly.
 - 0.3.2007102901
   * Improved: Any link or links to different website can be loaded in new tab automatically.
   * Fixed: New tabs are correctly opened from the location bar even if the URL is "about:" URLs.
 - 0.3.2007102701
   * Improved: New tabs can be loaded from the location bar automatically. (default: same domain =&gt; new child tab, different domain =&gt; new tab)
   * Fixed: Tree of tabs can be saved/restored by extensions like [Session Manager](https://addons.mozilla.org/firefox/addon/2324) which use session store API of Firefox 2.
   * Improved: Tree of tabs is automatically corrected if positions of tabs are modified by moveTabTo method.
 - 0.2.2007102602
   * Fixed: Count of descendant tabs are hidden correctly for expanded sub tree.
 - 0.2.2007102601
   * Improved: Sub trees of tabs in horizontal tab bar are shown with spaces, so you'll be able to understand easily which tabs are grouped or not.
   * Improved: Indent of tabs and collapse/expand of sub tree are disabled by default for horizontal tab bar.
 - 0.2.2007102501
   * Improved: Tab bar can be put on the top or below the content area.
 - 0.1.2007102401
   * Improved: Middle click on "View Image", "View Background Image", "Add Dictionary" (for spellcheck), "Subscribe Feed", and "Home" can open the result as children tab of the original tab.
   * Modified: The scrollbar of the leftside tab bar is moved to leftmost, like as [Fastladder](http://fastladder.com/).
 - 0.1.2007102301
   * Modified: Algorithm of auto-collapse-expand is modified.
 - 0.1.2007102204
   * Improved: A new command, open selection links in child tabs is available in the context menu.
   * Improved: Appearance of rightside tab bar can be inverted.
 - 0.1.2007102203
   * Improved: New tabs from a bookmark folder can be opened as a sub tree, in Minefield.
   * Improved: A new API for  `tabbrowser.loadTabs()`  is available.
 - 0.1.2007102202
   * Improved: Works on Minefield.
   * Modified: Default apparance is changed to "Mixed".
 - 0.1.2007102201
   * Improved: You can change the action when links or URL strings are dropped to existing tabs.
   * Improved: Fullscreen mode of [Autohide](http://www.krickelkrackel.de/autohide/) is supported (for leftside tab bar only)
   * Fixed: Works with [ContextMenu Extensions](http://piro.sakura.ne.jp/xul/ctxextensions/index.html.en) and [Split Browser](http://piro.sakura.ne.jp/xul/_splitbrowser.html.en).
   * Improved: APIs are available for other addons.
 - 0.1.2007102102
   * Fixed: Startup error disappeared.
   * Fixed: Tabs are moved correctly after drag and drop.
 - 0.1.2007102101
   * Released.
