# History

 - master/HEAD
   * Allow to save user style rules within 48KB.
 - 3.5.19 (2020.8.4)
   * Use the toolbar color defined in the theme as the background color of each tab surfaces.
   * Accept themes with colors defined in various formats `hsl()`, `hsla()`, and their variations.
 - 3.5.18 (2020.8.4)
   * Safely restore tree for reopened tab even if its old parent was already closed. (regression on 3.5.16)
   * Safely restore tree for reopened tab on the "Fix up tree structure with visible tabs automatically" mode. (regression on 3.5.17)
 - 3.5.17 (2020.8.3)
   * Undo closed tab at its correct old position, even it it was restored as a hidden tab on the startup.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.5.16 (2020.8.1)
   * Drop support for some built-in themes: ["Metal"](https://github.com/piroor/treestyletab/wiki/Metal-theme) and ["Plain Dark"](https://github.com/piroor/treestyletab/wiki/Plain-Dark-theme-%28patch-for-the-theme-%22Plain%22%29). They can be alternated with [user styles](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules#restore-old-built-in-themes).
   * Fix too dark color for active tabs from combinations of the Dark color scheme and a bright theme.
   * Apply a workaround for a problem: [unreadable text color on the "High Contrast" mode of Windows 10](https://bugzilla.mozilla.org/show_bug.cgi?id=1656637).
   * Respect tiling option specified by the browser theme, otherwise expand the background image as an un-repeatable when the aspect ratio of the image is wider than 4:1.
   * Apply system colors on Linux environments by default again.
   * Allow to attach restored hidden tab to other hidden tabs.
   * Suppress errors around dragging of non-tab data.
 - 3.5.15 (2020.7.30)
   * Expand the background image cited from the browser theme to cover the sidebar area, instead of repeating.
   * Don't attach restored tab to its old hidden parent when TST is configured to fix trees based on visible tabs.
 - 3.5.14 (2020.7.29)
   * Confirm to close tabs via context menu commands on the sidebar correctly. (regression on recent versions)
   * Always apply the "Photon" color scheme on Linux environments.
   * Always apply browser's theme to the sidebar (on Mixed, Plain and Vertigo).
   * Keep the tab in the root level, when a tab is moved or opened before a root tab. This improves compatibility with the Facebook Container.
   * Flexible width input field in the bookmark properties dialog.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.5.13 (2020.7.21)
   * List tabs to be closed/grouped in the confirmation dialog to represent which tabs are going to be operated.
   * Update tabs' activated, pinned/unpinned, hidden/shown, and collapsed/expanded states correctly. (regression on 3.5.12)
   * Highlight multiselected tabs on "Metal" and "Sidebar" theme correctly. (regression on 3.5.12)
   * Restore tree structure for "Undo Close Tabs" operation more correctly.
 - 3.5.12 (2020.7.12)
   * Stabilize handling of asynchronously notified messages from the background page to the sidebar page. As the result, wrong indentation and collapsed/expanded state should disappear especially around session restoration.
   * CSS selectors for container tabs like `tab-item[data-contextual-identity-name="Personal"]` is now available for user styles.
 - 3.5.11 (2020.7.12)
   * Show confirmation for multiple tabs closing after a tab is completely closed from outside of TST instead of showing before the tab disappears, for better response on tab closing.
   * Ignore click on the blank area if it is performed immediately after a click on a tab and at the same coordinates.
   * Add ability to import/export user styles.
 - 3.5.10 (2020.7.11)
   * Show fonts with normal weight on Windows 7 Classic theme.
   * Define default keyboard shortcuts statically with the `manifest.json`. It should reduce unexpected disappearing of default shortcuts. You can unbind default shortcuts on Firefox 74 and later, but it is impossible on older versions.
   * Don't produce any scrolling for popup menus (on the new tab button and others) if the focused item is already visible in the view area.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.5.9 (2020.7.10)
   * Constantly promote tab by drag and drop after its present parent tab. (regression on recent versions)
 - 3.5.8 (2020.7.10)
   * Fix incompatibility with [TST Hoverswitch](https://addons.mozilla.org/firefox/addon/tst-hoverswitch/) and other addons using `tab-mouseover` API [by Klemens Schölhorn, thanks!](https://github.com/piroor/treestyletab/pull/2633)
   * Reduce needless confirmation about closing of multiple tabs triggered by actions from outside of TST.
   * Fix unexpected missing centering of the startup tab.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.5.7 (2020.7.6)
   * Process redirection of shorthand URI (`ext+treestyletab:*`) with query parameters correctly.
 - 3.5.6 (2020.7.5)
   * Group "Close Tabs to the Bottom" and "Close Other Tabs" context menu items under a submenu "Close Multiple Tabs", like Firefox 78 does.
   * Add ability to restore the recently closed set of tabs, triggerred with a restoration of tabs in the set.
   * Activate/deactivate the animation effect for updating of indentation with the animation option.
   * Deactivate all animations automatically when animation effects are disabled by the platform itself.
   * Add ability to configure middle click on the new tab button same as Ctrl-click.
   * Quicken detection and grouping of new tabs opened from a bookmark folder.
   * Show the container name in the tooltip on container tabs, like Firefox does.
   * Better container support in group tabs.
   * Add ability to change column width in group tabs. Now custom style definition like `:root.group-tab { --column-width: 30em; }` does it.
   * Cancel TST's default action for click on tabs more correctly, via API notifications `tab-mousedown` and `tab-mouseup`.
   * Add ability to open the sidebar in separate window with the URI `ext+treestyletab:tabbar?windowId=(Window.id)`. This change should help addons like the [TST in Separate Window](https://addons.mozilla.org/firefox/addon/tst-in-separate-window/).
   * The count of opened tabbar pages are now notified to helper addons via the `sidebar-show` and `sidebar-hide` notification APIs.
   * Better responses for tab switching on Firefox 79 and later, with the new API `browser.tabs.warmup()`.
   * Reduce the total amount of sync storage a little, and cleanup of needless sync data. [It is limited until 100KB, and please remind that you cannot put data larger than 16KB for each option especially custom style rules.](https://github.com/piroor/treestyletab/issues/2623)
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.5.5 (2020.6.6)
   * Fix broken appearance of the sidebar after window move across multiple screens with different DPI.
   * Group new tabs automatically by default only when they are detected as tabs opened from bookmarks in one folder. As the result the configuration UI for auto-grouping feature is now very simplified.
   * Shrink clickable area of checkboxes and radio buttons in the options page.
   * Simuate Ctrl-click and Shift-click actions on the new tab button in Firefox's native tab bar. Now Ctrl-click opens a new next sibling tab with inherited container, and Shift-click opens a new window.
   * Expand tree if a new tab is added into a collapsed tree as a next of a parent tab with `browser.tabs.insertAfterCurrent`=`true`.
   * Unify the simulation option for `browser.tabs.closeTabByDblclick`=`true` to the  option for the double-click action on a tab.
   * Apply extra user styles to contents of group tabs also.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.5.4 (2020.5.5)
   * Show semi-modal dialogs more smartly. The annoying flash from a small window before the dialog is finally shown goes away.
   * Add an option to show dialogs in the sidebar, under the "Appearance" section of the options page. It takes back the old behavior around dialogs for confirmation and bookmarking.
   * Reduce needless space below rendered columns of tabs tree in group tab pages.
   * Better compatibility with recent versions of [Firefox Multi-Account Containers](https://addons.mozilla.org/firefox/addon/multi-account-containers/).
   * Better compatibility with [Container Bookmarks](https://addons.mozilla.org/firefox/addon/container-bookmarks/): now TST respects container information stored to bookmarks when TST opens bookmarks as a tree.
   * Support [drag-and-drop between TST's tabs and subpanels](https://github.com/piroor/treestyletab/wiki/SubPanel-API#drag-and-drop-between-your-subpanel-and-tst). This improvement includes a new API [`get-drag-data`](https://github.com/piroor/treestyletab/wiki/SubPanel-API#transfer-drag-data-from-a-subpanel-to-tst).
   * Support [native context menu on subpanels](https://github.com/piroor/treestyletab/wiki/SubPanel-API#how-to-provide-custom-context-menu-on-your-subpanel). This improvement includes a new API [`override-context`](https://github.com/piroor/treestyletab/wiki/SubPanel-API#override-the-context).
   * Unprefix `fake-contextMenu-*` API to `contextMenu-*`. But `fake-` prefixed verisons are still available for backward compatibilitty.
   * Update `de` locale by [SammysHP](https://github.com/SammysHP). Thanks!
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.5.3 (2020.4.28)
   * Handle dismissed semi-modal dialogs correctly.
   * Optimize semi-modal dialogs a little.
   * Optimize bookmark folder chooser UI for very large number of bookmarks.
   * Set the "Other Bookmarks" folder as the default choice of the bookmark folder chooser UI if the configured default folder was removed.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.5.2 (2020.4.25)
   * Improve implementation of semi-modal dialogs. Now it is more stable, more similar to native dialogs, more friendly for dark color scheme, and don't appear in the "Recently Closed Windows" list.
 - 3.5.1 (2020.4.24)
   * Show popup windows correctly on Firefox ESR68. (regression on 3.5.0)
 - 3.5.0 (2020.4.23)
   * Show dialogs as semi-modal popup windows.
   * Hide the context menu item "Reopen in Container" in private windows. This behavior is compatible to Firefox's one.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.4.10 (2020.4.19)
   * Open bookmarks as tabs with their correct title, via the "Open All as a Tree" context menu command on a bookmark folder.
   * Open bookmarks more correctly via the "Open All as a Tree", even if `browser.tabs.insertAfterCurrent` is `true`.
   * Introduce a new notification type API: [`try-fixup-tree-on-tab-moved`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#suppress-autofixing-of-tree-structure-for-moved-tabs).
 - 3.4.9 (2020.4.16)
   * Put bookmarks undar a new folder with their tree structure information automatically, when they are created from tabs via drag and drop.
   * Allow to move down a tree with the keyboard shortcut Ctrl-Shift-PageDown correctly.
   * Don't leave invisible orphans after only their parent tab is moved via drag and drop or other operations.
   * Show the fake context menu correctly even after any helper addon is unloaded.
   * Return root tabs for an API call like `{type:"get-tree",windowId}` correctly.
   * Notify `try-redirect-focus-from-collaped-tab` and `try-expand-tree-from-focused-collapsed-tab` with correct `focusDirection` for the first time or cases with a circulation.
   * Make tabs visible automatically when tabs are attached/detached via APIs.
   * [Performance improvement around APIs](https://github.com/piroor/treestyletab/issues/2554) by [account-login](https://github.com/account-login). Thanks!
   * Fix typo in English locale by [jaens](https://github.com/jaens). Thanks!
   * Update `zh_CN` locale by [no1xsyzy](https://github.com/no1xsyzy): add an access key for the menu item "Tree of tabs". Thanks!
 - 3.4.8 (2020.3.27)
   * Fix ghost "active, highlighted" state of newly opened tabs which lost its focus imediately.
   * Fix accidental unregistration of helper addons from unhandled errors.
   * Fix invalid `tab` property of `tab-mouseup` and `tab-clicked` notifications on mouseup after moving from non-tab element.
   * Suppress error ater the first regular (unpinned) tab restoration.
   * Better description for drag and drop behavior options.
   * Update `zh_CN` locale by [NightSharp](https://github.com/NightSharp). Thanks!
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.4.7 (2020.3.17)
   * Fix undroppability of links and some objects to tabs. (regression on recent versions)
   * Add a link to open the options page itself in a new tab, at the top of the page.
   * Add "Reset All" button to the bottom of the options page.
   * Update `de` locale by [SammysHP](https://github.com/SammysHP). Thanks!
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.4.6 (2020.3.12)
   * Add "Collapse this Tree Recursively" and "Expand this Tree Recursively" commands for the context menu and keyboard shortcuts.
   * Support inverted actions of some context menu commands with middle click: reload tree / reload descendants, close tree / close descendants, collapse tree one level / recursively, and expand tree one level / recursively.
   * Support multiselected tabs by some context menu commands: reload tree, reload descendants, close tree, close descendants, close others except the tree, collapse tree, and expand tree.
   * Add "Collapse this Tree Recursively" and "Expand this Tree Recursively" commands for the context menu and keyboard shortcuts.
   * Add an expert option to control the behavior when the current tab is closed with collapsed descendants and hidden sidebar.
   * Change the default behavior around closing tab without sidebar to "for people who use the native tab bar". It was unexpectedly overwritten by the auto migration mechanism.
   * Add a new option `recursively` to [`collapse-tree`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#collapse-expanded-tree) and [`expand-tree`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#expand-collapsed-tree) APIs.
   * Add a new paremter `button` to parameters notified to `fake-contextMenu-click` listeners.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.4.5 (2020.3.9)
   * Better compatibility to Firefox's native tabs around behavior and user experience about Ctrl-Click and Shift-Click on UI elements in tabs (twisties, sound playing buttons, and closeboxes). Now these actions just changes multizelection state of tabs.
   * Better compatibility with the combination of [TST Lock Tree Collapsed](https://addons.mozilla.org/firefox/addon/tst-lock-tree-collapsed/) and [TST Active Tab in Collapsed Tree](https://addons.mozilla.org/firefox/addon/tst-active-tab-in-collapsed-tr).
   * Add a new API notification message type: [`try-redirect-focus-from-collaped-tab`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#suppress-unintentional-focus-change-by-tst).
 - 3.4.4 (2020.3.8)
   * TST's tab is activated on a mousedown event. This behavior was unexpectedly lost at TST 3.1.0. (regression)
   * Skip collapsed tree while tab switching via Ctrl-Tab/Ctrl-Shift-Tab, including cases they are lcoked as collapsed by some other helper addons.
   * [`tab-mouseup` and `tab-clicked`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#when-a-tab-is-clicked) are notified even if `tab-mousedown` is canceled. I totally confused the spec about mouse events with key and input events. This fixes incompatibility regression with a helper addon [Move unloaded tabs for Tree Style Tab](https://addons.mozilla.org/firefox/addon/move-unloaded-tabs-for-tst/).
 - 3.4.3 (2020.3.7)
   * Better compatibility with known custom user styles.
 - 3.4.2 (2020.3.7)
   * Fix confused color scheme with the "Plain Dark" theme on Linux. (regression on 3.4.0)
 - 3.4.1 (2020.3.6)
   * Fix unclaickable sound playing indicator problem. (regression on 3.4.0)
 - 3.4.0 (2020.3.6)
   * Remove "Lock as Collapsed" feature. Now it is available as a helper addon: [TST Lock Tree Collapsed](https://github.com/piroor/tst-lock-tree-collapsed)
   * Remove "Tab Drag Handle" feature. Now it is available as a helper addon: [TST Tab Drag Handle](https://github.com/piroor/tst-tab-drag-handle)
   * Remove keyboard shortcut customization UI from the options page, because Firefox ESR68 has it.
   * Show in-content confirmations correctly (regression on lately versions of Firefox.)
   * Toggle muted state of descendants of collapsed tree more certainly.
   * Don't show throbber animation in a blank group tab if tree rendering is disabled.
   * More safe for bookmarks with URLs impossible to be opened by an addon.
   * More safe for non-tab drag data. (regression on recent versions)
   * Add checkbox to grant a permission required to show in-content confirmation.
   * Rename an option `autoExpandOnCollapsedChildActive` to `unfocusableCollapsedTab` and make effective on cases tabs going to be collapsed by collapsing parent tree.
   * Better support for a special favicon about `about:devtools-toolbox` tabs.
   * Add new API message types: [`set-extra-tab-contents`, `clear-extra-tab-contents` and `clear-all-extra-tab-contents`](https://github.com/piroor/treestyletab/wiki/Extra-Tab-Contents-API).
   * Add new API notification message types: [`tab-dblclicked`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#when-a-tab-is-clicked), [`tree-collapsed-state-changed`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#when-tree-is-collapsed-or-expanded), [`try-move-focus-from-collapsing-tree`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#suppress-unintentional-focus-change-by-tst), [`try-expand-tree-from-focused-parent`, `try-expand-tree-from-focused-bundled-parent`, `try-expand-tree-from-attached-child`, `try-expand-tree-from-focused-collapsed-tab`, `try-expand-tree-from-long-press-ctrl-key` and `try-expand-tree-from-end-tab-switch`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#suppress-unintentional-expansion-of-collapsed-tree-by-tst).
   * <del>Notifications and operations [`tab-mouseup`, `tab-clicked` and `tab-dblclicked` following to `tab-mousedown`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#when-a-tab-is-clicked) are now canceled by any leading notifications.</del>
   * Don't deliver messages around incognito windows to other addons, if they are not allowed to access incognito windows.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.3.6 (2020.2.21)
   * "Bookmark this Tree" context menu command now bookmarks all multiselected tabs and thier descendants.
   * Open dummy group tab with loaded state always, when it is opened by "Open All as a Tree" context menu command on bookmark folders.
   * Apply "Mute Tab" and "Unmute Tab" context menu commands to the tree recursively when the target tab has collapsed descendants. If you run these commands on an expanded tree, only target tabs are processed.
   * Apply muted/unmuted state to the tree recursively by clicking of the sound playing button only on a collapsed tree. If you click buttons on expanded tabs, only clicked tabs are affected.
   * Fix edge case problem of auto-tree-repair when tabs are switched to shown from hidden.
   * Fix edge case problem of tree attaching with hidden tabs.
   * Suppress needless reloading after some tabs are removed immediately after other tabs are moved.
 - 3.3.5 (2020.1.24)
   * Don't skip peinding (unloaded) tabs on Ctrl-Shift-Tab.
   * Skip collapsed tabs on Ctrl-Tab/Ctrl-Shift-Tab focus rotation more correctly, just after the active tab was closed.
   * Pinned tab is now droppable before the first unpinned tab.
   * Unnpinned tab is now droppable after the last pinned tab.
   * Detect drop position on a tab as top or bottom for pinned but not-faviconized tabs.
   * Add an expert option to control the behavior: collapse other trees when a collapsed tree is auto-expanded by a long-dragover.
   * Update `ru` locale by [wvxwxvw](https://github.com/wvxwxvw). Thanks!
 - 3.3.4 (2020.1.14)
   * Fix unexpected error from cyclic references.
   * Reduce accidental modifications of the tree structure after tabs are shown/hidden.
   * Skip collapsed tabs on Ctrl-Tab/Ctrl-Shift-Tab focus rotation more correctly, just after the active tab was closed.
   * Add `kr` locale by [BoredSomeone](https://github.com/BoredSomeone). Thanks!
 - 3.3.3 (2020.1.12)
   * Support Firefox versions after the [bug 1565170](https://bugzilla.mozilla.org/show_bug.cgi?id=1565170) is fixed.
   * Fix confused tab focus after some tabs are hidden and shown.
   * Don't expand locked-collapsed tree with a long press of the Ctrl key while Ctrl-Tab/Ctrl-Shift-Tab tab switching is in progress.
   * Allow to expand locked-collapsed tree when a descendant tab gets focus directly.
   * Hide options and other tab contents until they are initialized.
 - 3.3.2 (2020.1.9)
   * Ignore double click on any clickable UI in tabs except the closebox, to prevent accidental close or other reactions.
 - 3.3.1 (2020.1.9)
   * Add ability to toggle locked-collapsed state of a tree by double click.
   * Don't expand locked-collapsed tree when a new child tab is attached.
   * Update counter of collapsed descendants correctly on tabs restored from the cache. (regression on recent versions)
   * Update `ru` locale by wvxwxvw. Thanks!
 - 3.3.0 (2020.1.8)
   * Introduce the "Lock as Collapsed" feature. When the state is locked via the context menu command or a keyboard shortcut, TST keeps the tree collapsed when it or its any descendant get focused.
   * Show "Open All as a Tree" in the bookmarks context menu only when the context menu is opened on a folder.
   * Add an option to avoid pending (discarded) tabs to be activated accidentally when the active tab is closed or an ancestor tree of the active tab is collapsed.
   * Introduce a new option to activate/deactivate the confirmation for closing multiple tabs with a normal click on a closebox of a parent tab with its collapsed subtree.
   * Change twisty's appearance to Photon-style one.
   * The delay to ignore too short drag action produced by the [bug 1561879 on macOS](https://bugzilla.mozilla.org/show_bug.cgi?id=1561879) become configurable.
   * Brush up options UI and hide expert options by default. And now more detailed options are exposed in the expert mode.
   * Add new API message types: [`toggle-tree-collapsed`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#toggle-collapsed-state-of-tree), [`lock-tree-collapsed`, `unlock-tree-collapsed` and `toggle-lock-tree-collapsed`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#set-locked-as-collapsed-state-of-tree).
   * Add more [special tab aliases for some API messages](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#basics-to-specify-tabs): `nextVisible`, `previousVisible` (`prevVisible`), and versions with the suffix `Cyclic`.
   * Add support for a special window ID `active` for an API message type [`scroll`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#scroll-the-tab-bar).
   * Reduce needless dependency to an outdated library [webextensions-lib-tab-id-fixer](https://github.com/piroor/webextensions-lib-tab-id-fixer), by adroitwhiz. Thanks!
   * Update `ru` locale by wvxwxvw. Thanks!
 - 3.2.6 (2019.12.27)
   * Apply dark color scheme to the sidebar only when the "Apply Browser Theme" option is active.
   * Give higher priority to the color scheme defined by the theme.
   * Don't break tree when multiple tabs are opened in the middle of an existing tree at just same time.
   * Add a new context menu command "Open All as a Tree including subfolders" for bookmark folders to open them recursively.
   * Don't open needless tabs for non-bookmark items by the "Open All as a Tree" command.
   * Open tabs from the "Open All as a Tree" command as discarded by default.
   * Update descendant tabs counter correctly when a child tab is detached from a window.
   * Add `bundledTabId` property to the [tab item returned/notified via the API](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#data-format).
   * Add new proxied properties `deltaX` and `deltaZ` to [notified `scrolled` messages via the API](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#messages-notified-by-mouse-wheel-rotation).
   * Unlocalize the name of this addon in Japanese, for better findability. As the result the parent context menu item for extra commands is renamed to "Tree of tabs".
   * Don't finish title editing of a group tab by hitting the Enter key to finish a text composition.
   * Don't refresh the subpanel when a helper addon is registered with no subpanel.
   * Fill the list of subpanels correctly after the sidebar is reloaded.
   * Pinned tab is now marked as "unread" only when their title is really changed in the background.
   * Update `ru` locale by wvxwxvw. Thanks!
   * Update `zh_CN` locale by Siyuan Xu. Thanks!
 - 3.2.5 (2019.11.14)
   * Show drop marker with visible color even when a dark color scheme is applied.
   * Show the scrollbar in the sidebar with dark color when a dark color scheme is applied on some themes: Plain, (Plain Dark,) Vertigo and Mixed.
   * Don't show accesskeys for command names on the keyboard shortcut manager of Firefox itself.
   * Re-calculate some colors dyanmically when the system color scheme is changed.
   * Return a tab object of the opened group tab for an API call of the [`group-tab` command](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#create-new-group-from-given-tabs) correctly.
   * Update `de` locale by SammysHP. Thanks!
   * Update `ru` locale by wvxwxvw. Thanks!
 - 3.2.4 (2019.11.7)
   * Apply dark color scheme for options in `about:addons`, when the default color sheme of the platform is dark.
   * Rearrange and relabel options for general New Tab actions and special actions for more understandability.
   * Show attention color correctly on Vertigo and Mixed with the Dark color scheme. (regression on 3.2.3)
   * Show default favicons in group tabs with the text color. (regression on 3.2.3)
   * Apply system colors and Firefox theme correctly even if the default color scheme of the platform is dark on Linux. (regression on 3.2.3)
   * Add a new API command [`open-all-bookmarks-with-structure`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#open-bookmarks-with-structure) to open bookmarks in the specified folder with tree structure.
 - 3.2.3 (2019.11.5)
   * Apply dark color scheme on Plain, Vertigo and Mixed, when the default color sheme of the platform is dark.
   * Apply dark color scheme for options in tab, group tab, and startup tab, when the default color sheme of the platform is dark.
   * Update color scheme of Plain, Plain Dark, Vertigo and Mixed as more friendly for Photon Design System and Firefox's default color scheme.
   * Apply last selected subpanel and its height after restart even if the session restoration is disabled.
   * Show highlighter of hovered background tabs with Plain type themes correctly. (regression on 3.0.x)
   * Update `zh-TW` locale by Bo-Sian Li. Thanks!
   * Update `ru` locale by wvxwxvw. Thanks!
 - 3.2.2 (2019.11.3)
   * Show notification when multiple tabs are closed by one action without any confirmation. It allows you to cancel the operation by clicking it.
   * Duplicate tabs as a sibling of the source tab correctly even if the source tab was active.
   * Highlight active tabs correctly on some edge cases.
   * Allow to detach dragged tabs more ceratainly from the window when tabs are dropped outside the sidebar. This is based on [a workaround](https://github.com/piroor/treestyletab/issues/2256#issuecomment-549072345) for the [bug 1548949](https://bugzilla.mozilla.org/show_bug.cgi?id=1548949), and as a trade-off this change introduced a new intentonal regression on a edge case: tabs are duplicated when tabs are dropped to another Firefox instance (tabs imported to the receiver Firefox and tabs are also detached to a new window on the source Firefox).
   * Update overflow state of tab labels and tooltips more correctly. (regression on 3.2.0)
   * Fix backward compatibility for old custom user styles. (regression on 3.2.0)
   * Allow to close tabs after a tab close was canceled on a `beforeunload` event. (regression on recent versions)
   * Update `ru` locale by wvxwxvw. Thanks!
 - 3.2.1 (2019.10.29)
   * Apply the option to control inheritance of the container from the current tab to a tab opened from outside Firefox.
 - 3.2.0 (2019.10.28)
   * Separate an option to control new tabs from outside Firefox.
   * Open search result tabs opened from `about:addons` tab as children.
   * Save tree structure to bookmarks when multiple bookmarks are created from a tree, via commands provided by TST itself.
   * Add a new context menu command "Open All as a Tree" for bookmarks.
   * Migrate bookmarked internal URLs (like `moz-extension://...`) to shorthand URLs (like `ext+treestyletab:...`) automatically, for better mobility.
   * Restore collapsed state of tabs correctly even if they are placed under an expanded tree and the parent is placed under a collapsed tree.
   * Reduce FPS of throbber animations from 60 to 30. (See also [the bug 1511095](https://bugzilla.mozilla.org/show_bug.cgi?id=1511095).)
   * Show group-tab items with folder icon, in the contents area of a group tab.
   * Re-implement the view with custom elements (Web Components) for better maintainability. (Thanks to saneyuki!)
   * Update `ru` locale by wvxwxvw. Thanks!
 - 3.1.8 (2019.9.13)
   * Optimize internal operations for better performance and less memory usage. (Some ideas are contributed by bb010g. Thanks!)
   * Become more safe to accidental recursive references of tree structures.
   * Reopen same site tab with the container inherited from the current tab correctly, when the tab is opened as a child of the current the.
   * Don't apply special new tab behaviors (ex. auto-attach to the current tab) to restored single tabs.
   * Don't apply special new tab behaviors for Ctrl-T or other commands, to tabs opened with URL (ex. opened from bookmarks or the location bar), even if the `about:blank` is choses for the default page of new tabs.
   * Don't invert children order for a restored parent tab.
   * Apply custom behavior of closed parent tab correctly when a parent tab is closed as a solo tab by an action inside the sidebar.
   * Accept dragged tabs from another Firefox instance as URLs.
   * Treat a tab dragged from the native tab bar to the sidebar as is instead of as a URL string, if possible. (You can deactivate this new behavior with setting `guessDraggedNativeTabs` to `false`.)
   * Refresh indent level of tabs detached from a window by drag and drop correctly.
   * Update visibility of the scrollbar when tabs are shown or hidden, for better compatibility with other addons like the [Simple Tab Groups](https://addons.mozilla.org/firefox/addon/simple-tab-groups/).
   * Brush up appearance of some UI elements in the options page.
   * Restructure some options under the "New Tabs Behavior" section for better findability.
   * URL like `ext+treestyletab:group?(title)` is available to open a group tab with specific title.
   * Show text-shadow with correct color for better readability of text with non-default theme.
   * Update `de` locale by SammysHP. Thanks!
   * Update `fr` locale by ariasuni (and DarckCrystale.) Thanks!
   * Update `ru` locale by wvxwxvw. Thanks!
 - 3.1.7 (2019.8.9)
   * Introduce guards for cyclic reference around restored parent tabs.
   * Update `ru` locale by wvxwxvw. Thanks!
 - 3.1.6 (2019.8.8)
   * Introduce new custom URI `ext+treestyletab:group` to open a blank dummy tab for grouping of tabs, which replaces `about:treestyletab-group`.
   * Restructure config UI for the behavior around closed parent tab.
   * Optimize tree restoration on the startup.
   * Don't try to "fix" tree structure when multiple tabs are moved at a time as a set. This should improve compatibility with other addons which switch visible tab sets.
   * Introduce a guard for cyclic reference about the tree structure.
   * Disallow to put unrelated tab inside a tree including hidden parent tabs.
   * Remove obsolete codes deprecated on Firefox 70.
   * Update `fr` locale by narzb. Thanks!
   * Update `ru` locale by wvxwxvw. Thanks!
 - 3.1.5 (2019.7.9)
   * Make subpanels more secure.
   * Provide `--throbber-animation-steps` custom property to [allow customization for animation frames of throbbers](https://github.com/piroor/treestyletab/issues/2328#issuecomment-508901706).
 - 3.1.4 (2019.7.5)
   * Use more safe combination of system colors on the "High Contrast" skin.
   * Apply style rules for active/inactive windows on the "Sidebar" skin.
   * Fill SVG icon with the color of tab labels correctly for `about:debugging` tabs.
   * Expose "(no control)" choice for options about new tab positions, and set it as the new default value for new tabs opened with the "New Tab" button or the Ctrl-T keyboard shortcut.
 - 3.1.3 (2019.7.1)
   * Allow to import dragged tree from other Firefox instances.
   * Respect option for treatment of new blank tabs opened from outside of TST, event when `browser.tabs.insertAfterCurrent` is configured to `true` by the user.
   * Restrict maximum height of the subpanel.
   * Prevent too frequent detaching of clicked/dragged tab on Windows and macOS. This change is just a workaround, and we still need to wait for complete fix of the [bug 1561522](https://bugzilla.mozilla.org/show_bug.cgi?id=1561522) and [1561879](https://bugzilla.mozilla.org/show_bug.cgi?id=1561879) on Firefox side.
   * Store chache of tree to first tabs in windows instead of last tabs, to reduce bloated session data.
   * Add ability to store cache of tree to windows instead of tabs to more reduce bloated session data, but disabled by default for safety.
   * Prevent too much autoscroll while tab dragging. (If you see too slow autoscrolling and want more speedy scroll, [please shake your mouse on the edge of the scrollable area.](https://github.com/piroor/treestyletab/issues/2321#issuecomment-506667779))
   * Show favicons for new blank tabs correctly. (regression on 3.1.2)
 - 3.1.2 (2019.6.21)
   * Go to the options page to help granting of the permission, when a notification message about missing permission is clicked.
   * Hide the subpanel header when the last subpanel is unregistered.
   * Keep tree structure after a tab is reopened by other addons like Temporary Containers.
   * Keep tree structure of tabs moved between windows, even if they were moved across windows again and again.
   * Don't open (or keep opened) needless group tabs for closed parent tabs, when all children are closed together with their parent.
   * Optimize operations to update "sound playing" and "muted" state of tabs.
   * Add a link to open the options page itself in a tab, under the "Development" section of the options page.
   * API for other addons: [`wait-for-shutdown` notification is now delivered](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#unregister-from-TST). It allows helper addons to notify their uninstallation (or just disabled) to TST.
 - 3.1.1 (2019.6.13)
   * Handle middle click on blank area of the sidebar correctly. (regression on 3.1.0)
   * Don't close a tab with middle click on its indent area.
 - 3.1.0 (2019.6.13)
   * Add ability to embed arbitary contents provided by helper addons as a "sub panel" in the sidebar, via the [SubPanel API](https://github.com/piroor/treestyletab/wiki/SubPanel-API).
   * Add commands to operate ths subpanel with custom keyboard shortcuts. By default `F2` is mapped to toggle the subpanel frame.
   * Treat clicking on the indent area as clicking on the corresponding tab. (regression)
   * Synchronize order of tabs more correctly even if tabs are rearranged by other addons while synchronizing.
   * Select contents of the title field in bookmarks dialog by default.
   * API for other addons: [`tab-clicked` notification is now delivered after `tab-mouseup`](https://github.com/piroor/treestyletab/pull/2306). (by xzn, thanks!)
 - 3.0.17 (2019.6.7)
   * Apply updated tab properties to sidebar tabs more correctly. (regression on 3.0.16)
   * Update `de` locale by SammysHP. Thanks!
 - 3.0.16 (2019.6.7)
   * Auto-group children of a tab with a temporary group tab, when it is going to be pinned.
   * Bundle a pinned tab with a group tab for children of the pinned tab more tightly, and highlight (and treat similar to active) each other when one of them is active.
   * Calculate tree structure for moved/inserted tabs more correctly when there is any hidden child tab. This is mainly environments with a Firefox preference `browser.tabs.insertAfterCurrent`=true.
   * Don't produce "forever loading" tab when loading of a tab is canceled immediately just after it is opened.
   * Reveal deeply hidden debug options (including "Import" and "Export" buttons for all configs) just under the "Development" section of the options page directly.
   * Show internal ID on each tab in the debug mode by default, without default user stylesheet.
   * Unhighlight non-multiselected tabs on Sidebar, Metal and Vertigo theme correctly. (regression)
   * Show active pinned faviconized tab with active background color on the Metal theme. (regression)
   * Show confirmation dialog for closing multiple tabs more certainly.
   * A new secret option: `scrollToExpandedTree` to deactivate scrolling of the sidebar contents when an expanded tree is larger than the height of the visible area.
   * API for other addons: Allow to call APIs from addons without registering. (regression)
   * API for other addons: Send `ready` notifications for last registered addons correctly. If you have any uninitialized helper addons, you need to reload them manually to re-register. (regression)
 - 3.0.15 (2019.5.28)
   * Re-activate context menu on the blank area in the sidebar. (regression on 3.0.12)
   * Add an option to deactivate tree rendering in group tabs.
   * Remove the option for the vibisility of scrollbar in the sidebar, and scrollbar is now shown with narrow width by default. (Please use a user stylesheet `#tabbar { scrollbar-width: auto; }` to show it with regular width, or `#tabbar { scrollbar-width: none; }` to hide it.)
   * Remove the option for the positioning of scrollbar in the sidebar, and scrollbar is now shown at left edge by default for leftside sidebar. (Please use a user sytlesheet `:root.left #tabbar { direction: ltr; }` to show it at right edge.)
   * Duplicate tabs with the "Duplicate Tab" command in the context menu on the sidebar correctly.
   * Don't block operations while tabs are duplicating on Firefox 68 and later.
   * Ignore dropping of tabs to themselves.
   * API for other addons: Send `fake-contextMenu-click` notifications correctly. (regression on recent versions)
 - 3.0.14 (2019.5.25)
   * IMPORTANT SECURITY NOTE: All versions TST 2.x and TST 3.x older than TST 3.0.14 had a data disclosure problem via API for other addons. Sensitive tab information including private window tabs were unintentionally exposed to untrusted addons, regardless they were not have permissions to access those information via WebExtensions API. I strongly recommend you to update to TST 3.0.14 and later. Please see [detailed information](https://github.com/piroor/treestyletab/issues/2288#issuecomment-495756992) also.
   * Remove obsolete information from the startup page.
   * Add a new section in the options page and the startup page, for helper addons.
   * API for other addons: Don't expose `effectiveFavIconUrl` by default.
 - 3.0.13 (2019.5.25)
   * Close tabs with "Close Tabs to Bottom" and "Close Other Tabs" imitated context menu commands correctly. (regression on 3.0.12)
 - 3.0.12 (2019.5.24)
   * Clearly declare the license of this addon: mixed licenses MPL1.1 and MPL2.0.
   * Auto-expand tree while dragging of tabs correctly.
   * Update tooltip of parent tabs correctly after it is collapsed/expanded.
   * Show a confirmation dialog when multiple tabs are closed with commands in the context menu on the sidebar, before they are closed.
   * Initialize indent of tree on the startup more correctly.
   * Never attach tabs opened from a bookmark folder to existing tabs, even if the last existing tab was a child.
   * Never group new tabs automatically if they are opened from a pinned tab in a different window.
   * Never make group tabs `unread`.
   * Set title of the tab to the attribute `data-title` always for each tab.
   * Expose a custom property `--indent-size`.
   * API for other addons: Add new notification message types [`tree-attached` and `tree-detached`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#when-tree-structure-is-modified).
   * API for other addons: [Notification messages from private windows won't be delivered to other addons by default](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#information-in-private-windows). You may need to re-initialize your addon on [`permissions-changed` notifications are delivered](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#when-permissions-for-your-addon-are-changed).
   * API for other addons: [Sensitive information of tabs are not exposed anymore by default](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#data-format). If you need to get full information of tabs, you may need to [request special permissions](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#extra-permissions).
   * Update `de` locale by SammysHP. Thanks!
 - 3.0.11 (2019.5.4)
   * Prevent infinitly reloading when missynchronized tabs are detected.
   * Show confirmation dialog in the sidebar for grouping, when a required permission is not granted.
   * Restore tree structure around recycled active tab more correctly, on manual session restoration.
   * Close temporary group tab when there is one or less child, if it was opened as a successor of a closed parent tab.
   * Fix odd behavior of tabs after a tab is detached from its window by drag and drop.
   * Don't produce multiple active tabs after a tab is attached to an existing window.
   * Add example style rule for debugging.
   * Update `de` locale by SammysHP. Thanks!
 - 3.0.10 (2019.5.2)
   * Reduce wrong tab focus on clicked, caused with broken internal index of tabs.
   * Reduce stuck on sidebar initialization triggered with timing issue.
   * Show confirmation dialog correctly when multiple tabs are closed with operations inside the sidebar, even if TST is configured to treat tabs closed with operations outside of the sidebar as solo tabs.
   * Show confirmation dialog correctly when multiple tabs are closed with operations outside of the sidebar, if TST is configured to handle them, [due to a restriction of WebExtensions-based addon](https://github.com/piroor/treestyletab/issues/2249#issuecomment-488266835).
   * Don't show confirmation dialog for closing multiple tabs when they are closed with any operation outside of TST and there is only one or less restorable tabs.
   * Support special favicon for `about:debugging` and `about:debugging-new` on Nightly 68.0a1.
   * Output timestamp of debug logs with more debuggable format: `(hours):(minutes):(seconds).(milliseconds)`. Years, months, days, and the timezone are omitted.
   * Update `de` locale by SammysHP. Thanks!
 - 3.0.9 (2019.4.30)
   * Tree structure is restored after auto-fix triggered with corruption of tabs information.
   * More stabilized initialization of sidebar contents.
 - 3.0.8 (2019.4.25)
   * Prevent producing of untracked tabs more aggressively (including auto-fix feature [proposed by Dan Moorehead](https://github.com/piroor/treestyletab/pull/2239)), which are opened while TST is initializing. They might to cause various problems.
   * Add ability to show all extra context menu commands as top level context menu items.
   * Fix "never completely loaded" appearance of tabs opened while TST is initializing.
   * Update layout of pinned tabs correctly after any pinned tab is detached from an window.
   * Add new commands for user defined keyboard shortcuts: "Focus to Last Child Tab", "Focus to Previous Sibling Tab", and "Focus to Next Sibling Tab" ([by Sinkerine, thanks!](https://github.com/piroor/treestyletab/pull/2237))
 - 3.0.7 (2019.4.18)
   * Show color sampels of custom CSS properties more correctly.
   * Open duplicated tab as an independent or a next sibling tab more correctly.
   * Don't attach a tab to the current tab even if they have same domain, when those tabs are opened in a time.
   * Clear "dragging" state and drop-position-marker more aggressively while drag-and-drop opeartions.
   * Confusable checkboxes related to the color scheme of the browser theme now have description screenshots.
 - 3.0.6 (2019.4.12)
   * Fix one of hanging up cases on the startup. (regression on 3.0)
   * Select tabs with Shift-click correctly. (regression on recent versions)
   * Open new blank tab as a child of the active tab, at the position next to the parent tab correctly, even if there is any tab marked as "hidden".
   * Open tabs at correct position even if they are opened at a time, for example, [Snap Links Plus](https://addons.mozilla.org/firefox/addon/snaplinksplus/).
   * Add a hint to suppress auto-grouping for tabs opened at a time.
   * Add confirmation to group tabs opened at a time.
   * Add safeguard for tabs opened with wrong index, to avoid wrong tab focus. (See also the [bug 1504775](https://bugzilla.mozilla.org/show_bug.cgi?id=1504775).)
   * Don't group multiple tabs restored or duplicated at a time.
   * Don't collapse other trees, with a dragover on an expanded tree.
   * Make more compatible with themes including new color names.
 - 3.0.5 (2019.4.3)
   * Fix "broken/mismatched index" problem of tabs triggered with a new tab opened before a pinned tab. Annoying behavior like focusing another tab with clicking on a tab is reduced.
   * Determine positions to place new tabs considering existence of hidden tabs, for environments that hidden tabs are revealed by other addons or the user stylesheet.
   * Add ability logging with timestamp at the debug mode.
   * Add more error handling around the startup process, to reduce hanging up.
   * Fix wrongly deep indent level of attached child tabs.
 - 3.0.4 (2019.4.2)
   * Apply tab surface color on the "High Contrast" skin. (regression on 3.0.3)
   * Highlight tabs more again, when they have collapsed but highlighted descendants. (regression on 3.0)
   * Fix sidebar breakage on undoing close tab with `browser.tabs.closeWindowWithLastTab`=`false`.
   * Add "Do nothing" as a choice of actions on tabs dropped outside the sidebar.
   * Use `scrollbar-width` CSS property to control the scrollbar in the sidebar.
 - 3.0.3 (2019.3.31)
   * Attach/detach tabs to/from existing windows correctly. (regression)
   * Don't produce "invisible expanded children" with disabled animation effect. (regression)
   * Apply the header image of the current browser theme more aggressively, on "Plain", "Vertigo" and "Mixed" theme.
   * Define custom CSS properties to use the color scheme of the current browser theme, for user stylesheets.
   * Clear needless cache data for tree restoration for closing or moved tabs, if possible.
 - 3.0.2 (2019.3.29)
   * Open new tabs at correct position even if there is any hidden tab.
   * Don't produce invisible/inaccessible tab after auto-fixing of tree for hidden tabs.
   * Fix unclosability of the tab which notifies updated features of TST itself. (regression)
   * Don't destroy sidebar after the last tab is closed with `browser.tabs.closeWindowWithLastTab`=`false`. (regression)
 - 3.0.1 (2019.3.29)
   * Update layout for pinned tabs correctly after pinnde tab is moved or detached (regression on 3.0)
   * Apply burst animation correctly (regression on 3.0)
 - 3.0 (2019.3.29)
   * Stabilize handling of tabs based on asynchronous WebExtensions API. At old versions, tabs were handled on both the background page and sidebar pages separately, so they were sometimes mis-synchronized. Now all tabs are always handled only on the background page, and a sidebar page works just like a canvas to show tabs.
   * Restore tree of reopened window, even if there are large number of tabs and it takes very long time (until 10 minutes).
   * Add an option to deactivate browser theme color.
   * Show a `about:performance` tab with the favicon same to Firefox's native tab.
   * Restore tree structure for a reopened window more certainly.
   * Add ability to collect logs about internal messages for future performance tuning.
   * Drop support of migration about data from legacy versions.
 - 2.8.7 (2019.3.20)
   * Optimize performance of messaging between the background page and sidebar contents.
   * Optimize performance of initialization processes.
   * Fix startup failure when the background page is initialized with cached tabs and the sidebar is initialized without cache.
   * Show toolbar icons correctly when the option to show icons with theme color is active.
   * Show "muted" and "sound playing" icon on the parent of a collapsed tree when any descendant has those status.
   * Show progressbar on the sidebar while initialization.
 - 2.8.6 (2019.3.16)
   * Officially drop support for Firefox ESR60, and all 2.8.x versions are now marked as unsupported for ESR60.
   * Fix unexpectedly visible (expanded) tabs under logically collapsed tree on the startup session restoration.
   * Dragging of a parent tab now always move whole tree when it is dropped inside sidebar area, even if you configure TST to detach/drop only the dragged individual tab.
   * Dragged multiselected tabs or individual tab are now safely detached from the original tree, when dragged tabs are going to be detached to a new window.
   * Add preview images for some options.
 - 2.8.5 (2019.3.14)
   * Restore collapsed state of subtree more stably with large number of tabs.
   * Optimize startup process with cached data.
   * Prevent to move restored tabs to a place impossible to be placed. This sometimes produced permanently broken tree which was unfixable even if you disable the cache.
   * Prevent to open needless group tab when a new blank tab is reopened with a container inherited from the active tab.
   * Show throbber while waiting on group tabs.
   * Reduce freezing while updating contents of group tabs.
 - 2.8.4 (2019.3.12)
   * Context menu on blank area in the sidebar came back. (regression on recent versions)
   * Context menu commands work again on Firefox ESR60. (regression on recent versions)
   * Extra context menu commands correctly work for multiselected tabs, not for all tabs. (regression on recent versions)
   * New tab opened with Ctrl-T is correctly reopened with the container same to its parent tab. (regression on recent versions)
   * New tab is opened as a child of the active tab as specified, on Firefox ESR60. (regression on recent versions)
   * Control successor tabs for the active tab correctly, on Firefox ESR60. (regression on recent versions)
   * Update tooltip of tabs correctly, on the "crop" mode. (regression on recent versions)
   * On Firefox ESR60, focus to previously visible tab instead of previous sibling tab when the last child tab is closed. (This has been the new behavior at TST 2.8.0, on Firefox 65 and later.)
 - 2.8.3 (2019.3.7)
   * Tabs moved from any other window were misdetected as internally invisible and not used as a successor of other tabs. (regression on 2.8.0)
   * Don't produce needless scrolling of the sidebar when a new tab is opened outside of the visible area and moved into the visible area immediately.
   * Don't open needless duplicated group tabs to bind three or more child tabs opened from same pinned tab.
   * Add a shortcut config menu item for the overflow style of tab label.
   * Import/export configs via the common file dialog.
 - 2.8.2 (2019.3.6)
   * Fix ability to open new tab as a child of the current tab. (regression on 2.8.0)
   * Fix ability to open context menu on the sidebar, at Firefox ESR60. (regression on 2.8.0)
   * Don't attach new tab to the old current tab when they have same domain but the new tab is opened with position, for example a link dropped to the sidebar.
   * Don't highlight two tabs on the initial startup: old active tab and newly opened notification tab.
 - 2.8.1 (2019.3.6)
   * Fix behavior around newly opened tabs depending on old active tab information. The previous active tab was unexpectedly misdetected. (regression on 2.8.0)
   * Mute/unmute by clicking on the "sound playing" icon in each tab correctly. (regression on 2.8.0)
   * Tree strucutre is correctly maintained when new tab is opened at middle of existing tree. (regression on 2.8.0)
   * Update shortcut config menu items on the toolbar button, following to changes on 2.8.0.
 - 2.8.0 (2019.3.5)
   * Drop support for Firefox ESR60.
   * Reconstruct tab management system based on JS objects instead of DOM elements. This aims to make future improvements more easy: performance optimization for too much number of tabs, and stabilization around multiple parallel asynchronous operations.
   * Add ability to collect performance logs of tab queryings. It will help more future optimizations for too much number of tabs. (Please note that you need to activate logging manually, via the checkbox at the "Development" section in the options page.)
   * Don't multiselect all tabs after the context menu command "Move to New Window" in "Move Tabs" is invoked.
   * Add ability to change overflow style of too long tab label, for better performance.
   * Add ability to fix up tree structure with visible tabs when tabs are hidden by other addons. (*Please remind that the option is disabled by default and you need to activate it manually.)
   * Add ability to export and import all configurations except keyboard shortcuts. (TST's options => "Development" => "Debug mode" => "All Configs" => "Import/Export")
   * Better compatibility with [Conex](https://addons.mozilla.org/firefox/addon/conex/).
   * Add new APIs [`move-before` and `move-after`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#move-tree-to-different-position) to move tabs safely.
 - 2.7.23 (2019.2.22)
   * Don't move focus to a tab in a collapsed tree and expand collapsed tree when a collapsed child is focused, when the session was restored.
 - 2.7.22 (2019.2.20)
   * Fix unavailable menu commands and shortcuts. (regression on 2.7.21)
 - 2.7.21 (2019.2.20)
   * Don't produce needless scrolling when new active tab is inserted at non-last position. (regression on 2.7.19)
   * Move focus to a visible child tab instead of a visible next sibling tab at first, when the active tab is closed. (regression on 2.7.20)
 - 2.7.20 (2019.2.19)
   * Add ability to deactivate focus control based on Successor Tabs API by TST completely.
   * Better simulation of `browser.tabs.selectOwnerOnClose`=`true` behavior on Firefox 65 and later.
   * Use "Mixed" theme as the default theme on Linux.
 - 2.7.19 (2019.2.19)
   * Disallow to drop a pinned tab after any unpinned tab / disallow to drop an unpinned tab before any pinned tab.
   * Restore original tree structure after a tree is moved to a new window via the "Move to New Window" command.
   * Fix broken focus of tabs after a tab is detached from a window.
   * Handle new tab opened as the active tab more correctly.
   * Reduce needless operations around saving tree structure for a closing window.
   * Give more highlighted appearance for multiselected tabs. This change respecs Firefox's new appearance introduced by [the bug 1515686](https://bugzilla.mozilla.org/show_bug.cgi?id=1515686).
   * ru locale is updated by trueR3W1ND, thanks!
 - 2.7.18 (2019.1.30)
   * Fix odd tab focus behavior after duplicating of pinned tabs via middle-click on the "Reload" button.
 - 2.7.17 (2019.1.30)
   * Attach tabs opened from dropped links and bookmarks to existing tree correctly.
   * Reduce needless margin around pinned but not faviconized tabs.
   * Apply `discarded` status of restored tabs correctly.
   * Cancel delayed scroll to specific tab, when the sidebar is scrolled by mouse wheel.
   * Add screenshots for configs about drag and drop behavior.
   * Track tabs opened with invalid (too large) index by other addons more safely.
   * Update fade-out effect of too long tab labels, when tabs are expanded or restored.
   * Show confirmation for closing multiple tabs on the active window when it is triggered with a keyboard shortcut.
   * Introduce new API: [`wait-for-shutdown`](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#wait-for-shutdown-type-message).
 - 2.7.16 (2019.1.13)
   * Fix fatal error around API implementation. (regression on 2.7.15)
 - 2.7.15 (2019.1.13)
   * Add advanced option to support environments with Firefox's preference `browser.tabs.multiselect`=`false`.
   * Show confirmation dialog for closing multiple tabs only on the target window.
   * Send API messages to the listener addon correctly even if it is initially registered with some listening message types and re-registered without the information.
 - 2.7.14 (2019.1.12)
   * Fix inifinite recursion function call at synchronizing of tabs order.
   * More optimize reindexing of synchronized tabs.
   * Highlight tabs more when they have collapsed but highlighted descendants.
   * Rename the class for the blue bar of active and highlighted tabs: `active-marker` to `highlighter`. You may need to update your custom user stylesheet.
 - 2.7.13 (2019.1.11)
   * More stabilize synchronizing of tabs order.
   * Wait until confirmation for closing of multiple tabs is done correctly.
 - 2.7.12 (2019.1.11)
   * Optimize synchronizing of tabs order by sequence matcher.
 - 2.7.11 (2019.1.11)
   * Fix broken order and focus of tabs after multiple tabs are opened at a time. (regression)
   * Fix broken order and focus of tabs reopened immediately after they are opened. (regression)
   * Fix odd multiselection behavior on Ctrl/Shift-click on collapsed tree. (regression)
   * Fix broken tree after "Close Other Tabs" command.
   * Show confirmation for closing multiple tabs correctly for context menu commands on the sidebar. (regression)
 - 2.7.10 (2019.1.7)
   * Fix broken focus of tabs after closing of tabs on slow environments. (regression on recent versions)
   * Fix broken order of multiple tabs opened at a time.
   * Deactivate configuration UI around bookmarks when the permission to access bookmarks is not granted.
 - 2.7.9 (2019.1.4)
   * Fix broken focus of tabs after tabs are rearranged by others. (regression on recent versions)
 - 2.7.8 (2019.1.3)
   * Hide all imitation context menu commands when simulation of context menu is disabled, instead of disabling whole the context menu.
   * Allow to drag already-multiselected tabs with long press even if Multiple Tab Handler is installed.
   * Fix broken behavior around closing of tabs on Firefox ESR60.
   * [Allow to cancel default behavior of clicking on twisty, sound button, and closebox on tabs via API.](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#when-a-tab-is-clicked)
 - 2.7.7 (2018.12.28)
   * Don't restore unrelated closed tabs in a rest window, when a window is closed with tabs.
   * Fix broken handling of tabs updated after opened. (regression on 2.7.6)
   * Activate top-level "Close Tree" and "Close Other Tree" commands in the context menu for tabs with no child.
 - 2.7.6 (2018.12.26)
   * Better handling of positioning for new tabs. On Firefox ESR60 running at a high-power PC, a tab moved by Firefox immediately after it was opened was placed to wrong position.
 - 2.7.5 (2018.12.25)
   * "Close Tree" and other top level extra context menu items work correctly again. (regression on recent versions)
   * Better compatibility with other addons which modify `successorTabId` of tabs. (Note that you need to choose "Tree Behavior" => "When the current tab is closed as a last child" => "Focus to the next tab always (Firefox's default)" manually to deactivate controlling by TST.)
   * Control visibility of extra context menu items more correctly.
 - 2.7.4 (2018.12.22)
   * Keep active tab while operations for multiselection.
   * On Firefox ESR60, new tabs opened from links were wrongly placed at the end of the tab bar.
   * Don't show needless separator in the context menu.
   * "Bookmark Selected Tabs" and "Reload Selected Tabs" in the context menu on non-tab area work correcty.
 - 2.7.3 (2018.12.20)
   * Better restoration of tree structure for tabs restored by "Undo Close Tab" feature.
   * Don't show confirmation multiple times for a set of closing tabs.
   * Stabilize menu item position for Firefox 64 and later.
   * Add new option to similate `browser.tabs.closeTabByDblclick`=`true` on Firefox 61 and later.
   * Add new API `grant-to-remove-tabs` to suppress confirmation dialog.
 - 2.7.2 (2018.12.18)
   * Show colored icons for container selector on the new tab button again with Firefox 66 and later.
   * Opened new tab from non-last tab were not attached to the opener tab unexlectedly. (regression on 2.7.0)
 - 2.7.1 (2018.12.15)
   * More optimization around tracking of tab updates and highlighitings (by Lej77, thanks!)
 - 2.7.0 (2018.12.14)
   * Add "Group Tabs" context menu item and keyboard shortcut command. They are moved from "Multiple Tab Handler".
   * Better performance around multiselection of large number of tabs.
   * Redune needlessly duplicated separator in the context menu on Firefox 64 and later.
   * Reduce unexpected focusing to the next/previous when the current tab is closed, on Firefox 65 and later.
   * Show "attention" mark for unpinned tabs.
   * Optimize handling for updated "highlighted" status of tabs.
   * Activate context menu commands for selected tabs: "Reopen in Container" and "Duplicate Tabs".
   * Never detach dropped tabs to new window if the drag action is started just for bookmarks or links.
   * Automatically re-discard accidentaly restored tabs for Ctrl-Tab/Ctrl-Shift-Tab.
   * On Firefox 64 and later at macOS, new style context menu is available for Control-click. (Opening context menu with pressed ⌘ key will show old style context menu. On Windows or Linux, pression Ctrl key works as.)
   * Activate last active tab correctly when multiple active tabs are opened at a time.
   * Synchronize order of Firefox's native tabs and TST's sidebar more correctly when multiple tabs are opened at a time.
   * Fix impossibility of logging in to giffgaff.com and some websites. (again)
   * Tabs won't be detached to new window unexpectedly anymrore when tabs are dropped on the dragged tabs themselves.
   * Open new tab as the next sibling correctly, even if the the active tab is a child tab and there is no more following tab.
   * Use last effective favicon for discarded tabs in group tabs.
   * Return last effective favicon information for discarded tabs, as a part of `get-tree` API responses.
   * Show favicons with fixed size, in group tabs.
   * Follow to changes of tab context menu introduced by the [bug 1502083](https://bugzilla.mozilla.org/show_bug.cgi?id=1502083).
   * Add ability to change settings of TST from the context menu on the toolbar button.
   * Suppress errors from blank context menu.
   * Add new APIs for other addons: `move-to-start`, `move-to-end`, `open-in-new-window` and `reopen-in-container`. They will help you to implement imitated tab context menu compatible to TST.
   * Add new aliases `highlighted` and `multiselected` to specify tabs via APIs (available only on Firefox 63 and later.)
   * The `as` option of the `duplicate` API respects TST's configuration about duplicated tabs by default.
   * Some APIs now return window's id as `windowId`. For backward compatibility `window` is still available for those APIs.
 - 2.6.8 (2018.11.5)
   * Add ability to append "Close Tree" and similar items to the "Close Tab Options" submenu on the sidebar.
   * Hide needless "Tree Style Tab" item in the tab context menu if all items are deactivated.
   * Don't highlight (multiselect) collapsed children of a parent tab, when it is activated as a successor of a closed current tab or activated from a to-be-collapsed descendant.
 - 2.6.7 (2018.11.3)
   * Toggle multiselection state of collapsed descendants under the active tab by Ctrl-click, when there is no selection in different tree.
   * Select collapsed descendants under the active tab always, when non-active tab is Shift-clicked.
   * Introduce timeout for waiting other addons initialized via API. This change will fix freezing of the startup triggered by illegal API responses from other addons.
 - 2.6.6 (2018.10.31)
   * Better compatibility with other addons using `documentUrlPatterns` with `moz-extension:` patterns.
   * Fix wrong value of tabs' `highlighted` attribute gotten via TST's APIs.
 - 2.6.5 (2018.10.30)
   * Fix inaccessibility of "Reopen in Container" sub menu when there is only one container.
   * Fix broken context menu "Tree Stye Tab" after visibility of custom menu items are changed.
   * Fix impossibility of logging in to giffgaff.com and some websites.
   * Don't detach tab to window when dragging operation is canceled by ESC key.
   * Explain more details by the scrolling message, about what happens when dragged tabs are dropped.
   * Fix compatibility problem of the API: remove menu items recirsively if it has any child item.
 - 2.6.4 (2018.10.19)
   * Reintroduce "Bookmark All Tabs" and "Reload All Tabs" for Firefox 62 and older. (They won't appear on Firefox 63 and later.)
   * Apply theme color to toolbar button icon only when it is intentionally activated with `svg.context-properties.content.enabled` = `true`.
 - 2.6.3 (2018.10.18)
   * Show notification message at bottom of the sidebar to describe what will happen when you drop tabs outside of the sidebar, while you are dragging tabs.
   * Deactivate tab drag handle by default.
   * Match color of icon for toolbar button and sidebar panel switcher to the current theme on Firefox 62 and later.
 - 2.6.2 (2018.10.18)
   * Fix unavailability of context menu commands: duplicate tab, reopen in container, and move to new window. (regression on 2.6.0)
   * Never show tab drag handle on the half left or right side of a faviconized tab.
   * Never show tab drag handle after the tab is clicked before the handle is shown.
   * Never show needless separater in bookmark folder chooser.
   * Activate accesskey of context menu items if possible.
   * Respect behavior for new tabs triggered by `browser.tabs.insertAfterCurrent`=`true` (introduced at Firefox 61): when a new tab is opened next to the current tab by the config, TST always ignores "new tab position" configs of TST itself.
 - 2.6.1 (2018.10.17)
   * Search dropped non-URL text by the default search engine, if possible.
   * Hide [unexpectedly exposed dummy elements](https://github.com/piroor/treestyletab/issues/2050) correctly when any custom theme is applied.
 - 2.6.0 (2018.10.16)
   * [Better compatibility with extra context menu commands for tabs added by other addons, on Firefox 64 and later.](https://piro.sakura.ne.jp/latest/blosxom/mozilla/xul/2018-10-14_override-context-on-fx64.htm) And now imitated context menu have items compatible to Firefox 64 and later.
   * Add ability to change behavior of dragged tab to outside of the sidebar for each case: regular drag and Shift-drag. Shfit-drag of a tab will create bookmarks or links from all tabs in the tree, by default.
   * Add [tab drag handler to start dragging of tabs with specific purpose](https://github.com/piroor/treestyletab/issues/2033#issuecomment-422757008). It will appear by pointing for a while around edge of each tab.
   * Show dialog for commands to create bookmarks.
   * Add ability to change the default folder that new bookmarks are created in.
   * Sidebar panel is reloaded immediately after the cache system is disabled.
   * Deactivate a context menu command "Duplicate Tab" for multiselected tabs. This respects to the behavior of Firefox's native one.
   * Open new tab as specified relation correctly.
   * Faster sync for tab loading throbbers. (by Lej77, thanks!)
   * Add "Reset All Shortcuts" button to the options page.
   * Never apply cached indent definition for different direction.
 - 2.5.4 (2018.9.10)
   * Initialize tabs more safely on the startup.
   * Allow to tear off dragged tree from the window by default, and now you need to do Shift-drag to create bookmarks/links from tabs dragged to outside.
   * Default and shift-drag behavior for tabs dragged to outside are now switchable.
   * [`tab-mouseover` and `tab-mouseout` API messages are now delivered correctly on edge cases, by klemens. Thanks!](https://github.com/piroor/treestyletab/pull/2008)
   * Update `de` locale (by sicherist, thanks!)
 - 2.5.3 (2018.8.30)
   * Support native multiselection of tabs on Firefox 63 and later (after the [bug 1486050](https://bugzilla.mozilla.org/show_bug.cgi?id=1486050) is fixed).
   * Support "Reopen in Container" in the fake context menu on the sidebar.
   * Make tabs draggable on Firefox 63 and later (after the [bug 1453153](https://bugzilla.mozilla.org/show_bug.cgi?id=1453153) is fixed).
   * Apply `attention` attribute of tabs to sidebar's contents, on Firefox 63 and later (after the [bug 1396684](https://bugzilla.mozilla.org/show_bug.cgi?id=1396684) is fixed).
   * Fix gramatical mistake in en-US locale.
   * Don't tear off dragged tab(s) from the window when the dropped position is very near to the sidebar area itself.
   * Allow to drag a tree and drop it as a list of URLs.
   * Allow to open dropped URIs as tabs on the tree sidebar.
   * Load embedded SVG images correctly as favicon.
   * [Allow to get permission without toolbar button, by Lej77. Thanks!](https://github.com/piroor/treestyletab/pull/2011)
   * [`tab-mouseout` API message is now delivered at correct timing, by klemens. Thanks!](https://github.com/piroor/treestyletab/pull/2008)
   * Add `soundButton` attribute to notified API messages of `tab-mousedown`, `tab-mouseup` and `tab-clicked`. It indicates that the mute/unmute button is clicked or not.
 - 2.5.2 (2018.8.20)
   * Some context menu commands become robust on slow situation.
 - 2.5.1 (2018.8.19)
   * Fix unexpected recursion around loading of favicons. (regression on 2.5.0)
   * Remove default shortcuts to move focus around tree. Ctrl-Shift-Arrows are already used for general shortcuts to select words in text fields.
   * All keyboard shortcuts are now deassignable by hitting the Escape key on each field.
   * Fix misordernig of input fields to define keyboard shortcuts. (regression on 2.5.0)
   * `tab-mouseout` API message is now delivered at correct timing.
   * Updated zh-CN locale by YFdyh000, thanks!
 - 2.5.0 (2018.8.17)
   * Totally reconstructed as ES modules, for better maintainability.
   * Don't treat click action on closing tabs as clicking on the blank area of the tab bar.
   * New commands "Collapse this Tree" and "Expand this Tree" for the context menu on tabs.
   * New commands "Collapse this Tree", "Expand this Tree", "Focus to Parent Tab" and "Focus to First Child Tab" are now available for keybaord shortcuts.
   * "Focus to Previous Tab" and "Focus to Next Tab" commands (for keyboard shortcuts) circulate focus of tabs.
   * "Focus to Previous Tab" and "Focus to Next Tab" commands (for keyboard shortcuts) focus to actual previous/next tabs, instead of previous/next sibling tabs.
   * "Focus to Previous Tab" and "Focus to Next Tab" commands now have default keyboard shortcut.
   * Place small favicon for group tabs from pinned tabs over "folder" icon correctly.
   * The parent group tab won't be bookmarked by the "Bookmark this Tree" command anymore.
   * Add ability to configure default bookmark folder name, and it includes the date created at by default.
   * Any pinned tab is now possible to be dragged and dropped between unpinned tabs. Opposite is also available.
   * Pinned tabs are now possible to be teared off from the window by drag and drop.
   * Restore group tabs more safely. In old versions, restored group tab can lose its content.
   * Updating of group tabs is now done without reloading of the tab itself.
   * Unfocusing from the input field of the title of a group tab now applies the current value as its new title, instead of cancelling.
   * Tabs opened from a bookmark folder are correctly grouped. (It was a regression on recent versions.)
   * When a new tab is opened from a pinned tab, the tab bar will be scrolled to the new tab if possible.
   * Focus to closest ancestor tab when the active tab is going to be collapsed correctly.
   * Show specified favicon as the tab icon, for a tab with an image file.
   * Apply more theme colors for "Plain", "Vertigo" and "Mixed" for other addons like "Firefox Color".
   * Introduce 32px icons.
   * Show toolbar button icons with opacity (by asamuzaK, thanks!)
   * Clear "dragging" state of tabs more aggressively.
   * Introduce a failsafe for unexpectedly visible descendant tabs under collapsed tree on restored sesssions.
   * Add ability to output log for each module.
   * Make more robust for asynchronously updated collapsed state of tabs. (In old versions, internal state and visible state can be mismatched.)
   * Keep tree expanded after restoration, for restoration without cache.
   * Support [checkbox and radio type context menu items](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#add-new-item-to-the-context-menu-on-tabs) and [`browser.menus.onShown`/`browser.menus.onHidden`-like APIs](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#update-existing-item).
   * Remove non-free color profile from some image files.
   * Update `de` locale (by sicherist, thanks!)
   * Add `ru` and `uk` locales (by perdolka, thanks!)
 - 2.4.24 (2018.6.3)
   * Some context menu commands didn't work when animation effect is disabled, on 2.4.22 and 2.4.23. (regression)
   * Fix 100% CPU usage problem on loading `about;treestyletab-group` on any existing group tab.
   * Fix incompatibility with Conex. When Conex is installed, new tabs opened from dropped links were unexpectedly closed immediately.
 - 2.4.23 (2018.6.1)
   * Add [new API to notify sidebar is shown or hidden](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#when-the-tst-sidebar-is-shownhidden) for other addons.
   * Apply correct favicon for restored tabs.
   * Fix freezing after a tab is detached from a window by drag and drop.
   * Make tabs more easily detachable by drag and drop.
 - 2.4.22 (2018.5.30)
   * Initialize sidebar more safely on browser's startup.
   * Prevent needless flashing of the vertical scrollbar.
   * Open new tabs from Ctrl-T as configured position more correctly.
   * Don't attach new same site tab if it is originally opened as a blank tab intentionally.
   * Close the fake context menu immediately when any item is clicked.
   * Keyboard operations affects correctly for the fake context menu even if the cursor is on any separator.
   * Refresh context menu automatically when items are modified while open.
   * Remove extra context menu items if an external addon is unregistered.
   * Make "Plain" theme more respectful of Firefox's default theme.
   * More respect Firefox's default favicons for tabs without site-specific favicon.
   * Add ability to collect logs while browser's startup process. You can print logs by running `log.logs.join('\n')` in the remote debugger, if you're running TST in the debug mode.
   * Update `de` locale (by sicherist, thanks!)
 - 2.4.21 (2018.5.16)
   * Add ability to attach newly opened orphan tab to the current tab, when they have same website.
   * Add ability to collapse/expand configuration sections.
   * Execute command in the fake context menu, by an access key without Enter, when there is no other command with same access key.
   * Keyboard shortcuts to scroll tab bar never affect to non-active windows anymore.
   * Don't reload restored group tab until it is activated.
   * Control next focused tab for closed current tab correctly (regression)
 - 2.4.20 (2018.5.14)
   * Apply specified color for tab label correctly with style rules written for old versions. (regression)
   * New tabs reopened by [Conex](https://addons.mozilla.org/firefox/addon/conex/) appears in the tab bar correctly. (regression?)
   * Don't show multiple "active" tabs at once when a new active tab is opened.
 - 2.4.19 (2018.5.13)
   * [New APIs for other addons to observe moving of mouse pointer on tabs.](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#when-the-pointer-is-moved-over-tabs)
   * Add ability to change text direction in the sidebar.
   * Add ability to change visibility of collapsed descendants in a tooltip on collapsed tree.
   * Tooltip on a tab will appear only when it is necessary for too long title.
   * Disable animation effect of the fake context menu and other menu-like UI, if animation effects in TST is disabled.
   * Handle keyboard operations around the fake context menu and fake confirmation dialog on `keydown`. This behavior is same to native UI.
   * Show confirmation dialog only once, when multiple tree are closed at a time. And it won't be shown by "Close Tabs to the Right" and "Close Other Tabs", because the action is already accepted by the user.
   * Show confirmation dialog in the content area of the current tab if possible, when multiple tabs are closed by keyboard shortcut command.
   * Apply "insert new child at first" configuration for tabs grouped for their pinned parent.
   * Allow to drop tab before the first tab, when there is no pinned tab. (regression on recent versions)
   * Detach moved tab from existing tree when it is moved by Ctrl-Shift-PageDown. (regression on recent versions)
   * Unexpected bumping of scroll position is disappeared, for most cases around focued tabs.
   * Don't re-focus to a dragged tab after it is dropped, to allow dragging of background tabs as is. (Inspired from codes by Lej77, thanks!)
   * Allow to cancel closing of middle-clicked tab via API. (Inspired from codes by Lej77, thanks!)
   * Mouseup and mouseup events on the sidebar are now handled as a pair with same button (by Lej77, thanks!)
   * Fade out tab labels instead of ellipsis (by Keith94m thanks!)
   * Update `de` locale (by sicherist, thanks!)
 - 2.4.18 (2018.3.22)
   * Support `enable` and `icons` parameters for extra menu items of the fake context menu.
   * [Support `icons` parameter for the `register-self` API.](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#register-and-unregister)
   * Newly opened child tabs are placed to the correct position.
   * Expose detailed options for scrollbar and cache.
   * Collapse large input fields in the "Advanced" section of the options.
 - 2.4.17 (2018.3.7)
   * Use default favicon of tabs same to Firexo 60.
   * Use Firefox-compatible favicon for addon manager and options tabs.
   * Add an option to deactivate fake context menu in the sidebar.
   * Optimize internal processes to collect ancestor tabs from a tab.
   * Synchronize title and favicon of a parent pinned tab to its related group tab.
   * Open new independent tab correctly by the command, when new tab are configured to be opened as children or sibling.
   * Don't cancel drag action on a tab for long press when there is no listener for "tab-dragready" API message.
   * Accept extra context menu items added by other addons without the name of the addon.
   * Set the value of `HTTP_USER_AGENT` to the `data-user-agent` attribute of the root element, for easy platform-specific styling.
   * [`get-tree` API](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#data-format) now returns `ancestorTabIds` for each tab.
   * Notify event messagess via the API only for addons which intentionally listens the message type. (However, all known message types on 2.4.16 are delivered to the addon if it doesn't declare listening event types, for backward compatibility.)
 - 2.4.16 (2018.2.12)
   * Make default shortcuts avoidable from Firefox's built-in shortcuts. Now you can scroll Tree Style Tab's sidebar by Alt-Shift-Up, Alt-Shift-Down, Alt-Shift-PageUp, Alt-Shift-PageDown, Alt-Shift-Home, and Alt-Shift-End.
   * Shortcuts for "scroll sidebar by line" now scrolls for three lines on each time.
   * Pinned tabs are now impossible to be collapsed. Even if they are collapsed accidentaly, the operation is safely blocked.
   * "Close This Tree", "Close Descendant Tabs" and "Close Other Tabs except This Tree" now work again. (regression on 2.4.15)
   * Better styling of extra buttons on the new tab button in the "Metal" theme.
   * Update `de` locale (by sicherist, thanks!)
 - 2.4.15 (2018.2.11)
   * Keyboard shortcuts for commands are now customizable on Firefox 60 and later.
   * Fix broken "Bookmark All Tabs" in the fake context menu. (regression on 2.4.11-13)
   * Introduce new keyboard shortcuts to scroll Tree Style Tab's sidebar itself: Alt-Up, Alt-Down, Alt-PageUp, Alt-PageDown, Alt-Home, and Alt-End.
   * Update `zh_TW` locale (by Bo-Sian Li, thanks!)
 - 2.4.14 (2018.2.10)
   * Tabs are duplicated or moved across windows correctly. (regression on 2.4.11)
 - 2.4.13 (2018.2.10)
   * Restore tree correctly for "Restore Previous Session". (regression on 2.4.12)
 - 2.4.12 (2018.2.9)
   * Respect "expand tree when a tab gets focus" configuration for finally focused tab via Ctrl-Tab/Ctrl-Shift-Tab.
   * Fix missing menu label of extra context menu items. (regression on 2.4.11)
   * Better performance around dragging something over tabs.
 - 2.4.11 (2018.2.9)
   * Reformat keys of localized messages matching to the [spec](https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/i18n/Locale-Specific_Message_reference#Member_details).
 - 2.4.10 (2018.2.9)
   * Match default behavior of long-press on the "New Tab" button to Firefox's one (it shows a menu to choose container).
   * Place button to select new tab posiiton at right side for the new tab button, if the button to choose container is invisible.
   * Respect `browser.tabs.selectOwnerOnClose` correctly when new child tabs are configured to be inserted to top of tree. (regression on 2.4.9)
   * First child tab opened from a pinned tab is now placed at configured position. (regression on 2.4.9)
   * Process initialization message from other addons via API more correctly.
   * Better performance around dragging something over tabs.
   * Better performance around collapse/expand tabs.
 - 2.4.9 (2018.2.8)
   * Introduce ability to open new tab specifying its position, by long-press on the "New Tab" button.
   * Better appearance for the contaienr selector on the "New Tab" button.
   * Warn before closing multiple tabs a a time.
   * Better behavior and keyboard operation handling of fake context menu.
   * Better compatibility with other addons which hide some tabs, like [Conex](https://addons.mozilla.org/firefox/addon/conex/). Now tabs hidden on the top tab bar are also hidden in the sidebar.
   * Always scroll to the newly opened tab when it is opened as the active tab.
   * Tabs opened from same pinned tab are grouped, only when there are multiple tabs to be grouped.
   * Group-tab to bundle tabs opened from same pinned tab inherits the container of the parent pinned tab.
   * Show descendant tabs as the content of a group tab. Clicking on an item will give focus to the tab.
   * Don't break group tabs when Tree Style Tab is dynamically updated.
   * Restore group tabs as-is when they are imported from different profile with session information.
   * More meaningful label for "temporary group" checkbox of group tabs.
   * Reduce mismatched tree structure between the internal master process and the visible sidebar contents.
   * A new [alias to specify tabs via API](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#basics-to-specify-tabs): `senderTab` which is resolved to the owner tab for a content script.
   * Update `de` locale (by sicherist, thanks!)
 - 2.4.8 (2018.2.1)
   * Fix fatal error on the startup process for tree restored from cache.
   * Don't expand current tree by just hitting Ctrl key.
   * Don't focus to collapsed children expectedly, after the tree of tabs are restored from cache.
   * Don't open a new tab by right-click on the "New Tab" button. It was an unexpected behavior on Windows.
   * Accept `about:treestyletab-startup` as a shorthand of the startup tab.
   * APIs now return `indent` information as a part of extended `tabs.Tab`.
 - 2.4.7 (2018.1.30)
   * Fix fatal error on restoration of tabs from the cache.
   * Show active and hover marker for tabs at the Mixed theme, to match tab style of Firefox itself.
   * Use `Highlight` system color to highlight active and hover tabs at the Vertigo and the Mixed themes, on Linux.
   * Apply background color correclty at the Vertigo theme.
   * Update `en` locale (by Thomas Bertels, thanks!)
   * Update `zh_TW` locale (by Bo-Sian Li, thanks!)
   * Update `de` locale (by sicherist, thanks!)
 - 2.4.6 (2018.1.26)
   * Clear needless temporary group tabs correctly even if they are nested.
   * Open pinned tabs at the end of the tab bar as configured, when pinned tabs are not grouped.
   * Deactivate "auto discard" behavior for unexpectedly restored tabs by default.
   * Suppress some fatal initialization errors.
 - 2.4.5 (2018.1.26)
   * Deactivate "hide inactive tabs" feature, because [a depending permission `tabHide` is rejected by Mozilla Add-ons website itself for now](https://github.com/mozilla/addons-linter/issues/1788).
 - 2.4.4 (2018.1.25)
   * Add a new option to hide inactive tabs from top tab bar. This feature works only on Firefox 59 and later, and require new extra permission. Moreover you need to activate the API manually by `extensions.webextensions.tabhide.enabled`, a secret preference of Firefox itself.
   * Track tabs more correctly at cases multiple tabs are opened quickly.
   * Ask how to open the dropped link on a tab, like legacy versions.
   * Staying on a tab while dragging of a link will switch focus to the dragover tab correctly.
   * Shift-drag on a parent tab now allows to drag the tab as an individual tab.
   * Drag and drop operations of tabs between a regular window and a private browsing window are now blocked.
   * "Move to New Window" and similar operation work correctly for tabs in a private browsing window.
   * Treat Ctrl-PageUp and Ctrl-PaegDown as tab switch trigger, same to Ctrl-Tab/Ctrl-Shift-Tab.
   * Activate "Close Tabs to Right" and "Close Other Tabs" context menu items, on pinned tabs (respecting Firefox 59's behavior.)
   * Theme's background color is now applied ASAP.
   * Synchronize title of a group tab with its first child tab, if it has just a default title.
   * Title edit for dummy group tabs now works correctly.
   * Don't focus to the group tab itself after multiple tabs are automatically grouped.
   * New tabs from pinned tabs are placed at correct position as configured.
   * Expand focused tab if it is an orphan but collapsed. This is just a failsafe.
   * Reduce CPU usage from offscreen rendering of tabs' throbber.
   * Add a new configuration to control the position of the scrollbar in the sidebar.
   * Add a secret configuration `moveDroppedTabToNewWindowForUnhandledDragEvent` to deactivate "move tab to new window by drag and drop" behavior.
   * Synchronize some configurations with Firefox Sync.
   * Update `zh_TW` locale (by lycsjm, thanks!)
   * Add `de` locale (by sicherist, thanks!)
   * Accept [`current` and other special values](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#basics-to-specify-tabs) to specify tabs via APIs.
   * Add new APIs to [indent](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#indent-demote-tab), [outdent](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#outdent-promote-tab), [move](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#move-tree-to-different-position), [duplicate](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#duplicate-tab-as-childsibling-tab), [focus](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#focus-to-the-nextprevious-sibling-tab), and [group](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#create-new-group-from-given-tabs) tabs.
 - 2.4.3 (2017.12.12)
   * Never group single orphan tab (regression on 2.4.2)
 - 2.4.2 (2017.12.12)
   * Keep group tabs open after restart of Firefox and reload/update of TST itself. (regression: group tabs were unexpectedly lost on such cases, at 2.4.x.)
   * Add ability to group new tabs opened from pinned tabs automatically.
 - 2.4.1 (2017.12.11)
   * Fix regressions around SVG icons and throbber's animation on the simulation mode.
   * Don't attach newly opened tab at the end of the tab bar to the previous tab.
 - 2.4.0 (2017.12.9)
   * Optimize tree restoration with cache. If you see broken tree from cache, please deactivate this feature by the checkbox under "Debug mode" in Tree Style Tab's configurations.
   * Use SVG icons for closeboxes, "New Tab" button, and sound playing indicator. However, due to the [Bug 1377302](https://bugzilla.mozilla.org/show_bug.cgi?id=1377302) and [1421329](https://bugzilla.mozilla.org/show_bug.cgi?id=1421329), it is just a simulation and requires more CPU. If you want to reduce CPU usage, you need to activate `svg.context-properties.content.enabled` via `about:config` and deactivate the simulation by the checkbox under "Debug mode" in Tree Style Tab's configurations.
   * Use system color instead Photon color scheme on Linux by default, on Plain, Flat, Vertigo, and Mixed theme.
   * Add new theme "Hight Contrast" based on system color on any platform. (contributed by actionless, thanks!)
   * Remove "Flat" theme. It was quite similar to "Plain".
   * On "Plain" and similar themes, show top border of the tab bar only when there is any pinned tab.
   * Keep tab's "unread" state after reloading of the sidebar.
   * Reduce needless requests for tab icons. (contributed by UENO Katsuhiro, thanks!)
   * Apply extra margin for overlay-scrollbar on macOS only for overflow tab bar.
   * Title editor and checkbox to toggle "temporary" status are avialable on group tabs.
   * Group tab won't be closed automatically if it is not marked as "temporary".
   * Don't detach tab from window if it is dropped onto the bookmarks toolbar.
   * Don't output log for keyboard events.
 - 2.3.0 (2017.11.30)
   * Show scrollbar like narrowed by default, on Windows and Linux.
   * Add extra space for overlay-scrollbar on macOS.
   * Don't expand tree when the Shift key is pressed/released while tab switching by Ctrl-Tab/Ctrl-Shift-Tab.
   * Add ability to prevent control for focusing of tabs when the current tab is focused.
   * Discard accidentally restored tab automatically, on Firefox 58 and later.
   * Detect `about:privatebrowsing` as a new blank tab, in the private browsing mode.
   * Always expand tree when a child is manually attached to a parent tab.
   * Open new sibling tab at correct position for root level tab.
   * Place attached tab to natural position more correctly.
   * Detach tab from window more easily by drag and drop to outside of the window. In old versions, it was done if you move the mouse just left or right.
   * Restore selection of the first tab after opened new tabs are automatically grouped.
   * Restore tree structure from sessions more quickly for "Restore Previous Session".
   * Add ability to inherit container (contextual identity) from its parent tab to newly opened child tabs.
   * Add "Default" to the list of selectable containers, when container inheritance is activated.
   * Allow to bookmark all tabs from the fake context menu. (regression)
   * Cleanup tab element for closed tabs correctly. (regression)
   * Calculate size of elements more correctly. (regression)
   * Animation of throbber is now synchronized correctly on Firefox 57. (Many thanks to Lej77!)
   * Recolor "Plain", "Flat", "Vertigo", "Mixed", and the startup page based on the color scheme of Firefox's default Photon theme.
   * Recolor "Plain Dark" based on the color scheme of Firefox's builtin "Dark" theme.
   * Use more larger closebox on macOS.
   * Hide container selector on the new tab button by default.
   * Add "No Decoration" theme as the base for customization.
   * Use white icon for the toolbar button on the "Dark" theme.
   * Disallow zooming of the sidebar contents by default. You can re-activate the old behavior by setting `zoomable` to `true` in the debug mode.
   * Notify both mousedown and mouseup for other addons via API.
   * Handle middle-click on the new tab button correctly even if any other addon listens click events on the tab bar.
   * Add zh_TW locale (by lycsjm, thanks!)
 - 2.2.11 (2017.11.18)
   * Fix performance regression for many numbers of tabs, on 2.2.10.
 - 2.2.10 (2017.11.18)
   * Some permissions are now optional.
   * Open plain text dropped onto the sidebar as a URI, if it seems to be formed like a host name.
   * Tabs reopened by [Firefox Multi-Account Containers](https://addons.mozilla.org/firefox/addon/multi-account-containers) are treated as replacement of the original tab, if possible.
   * While switching tabs by keyboard shortuts, staying on a collapsed tree expands the tree automatically.
   * Add more descriptions and links from the configurations.
   * Fix wrong tab focus when there are only tow child tabs and the last one is active and closed.
   * [Add ability to deactivate auto-attaching of tabs.](https://github.com/piroor/treestyletab/issues/1544)
 - 2.2.9 (2017.11.17)
   * Don't apply indent for pinned tabs.
   * Don't close initial message tab automatically.
 - 2.2.8 (2017.11.16)
   * Reduce width of elipsis for cropped long title of tabs.
   * Close collapsed tree without expansion animation correctly. (regression)
   * Update internal order of child tabs correctly, when they are just rearranged. (regression)
   * Don't shrink close button for indented tabs, on the "Sidebar" skin.
 - 2.2.7 (2017.11.15)
   * Apply theme color for each window.
 - 2.2.6 (2017.11.15)
   * Skip collapsed tabs for focus switching via Ctrl-Tab/Ctrl-Shift-Tab. [But there are some restrictions.](https://github.com/piroor/treestyletab/issues/1531#issuecomment-344487289) (This feature was described at 2.2.4 but didn't work due to missing file.)
 - 2.2.5 (2017.11.15)
   * Isolate from unimplemented feature on Firefox 57.
 - 2.2.4 (2017.11.15)
   * Inherit theme colros applied by extensions like [VivaldiFox](https://addons.mozilla.org/firefox/addon/vivaldifox/), [Container Theme](https://addons.mozilla.org/firefox/addon/containers-theme/), and others. Due to limitations of WebExtensions APIs, non-extension theme colors won't be applied.
   * Collapse other tree when new tree is created. (regression)
 - 2.2.3 (2017.11.15)
   * Add new APIs to work with other addons, especially Multiple Tab Handler.
 - 2.2.2 (2017.11.14)
   * Tabs are opened in correct order when new child tab is attached as a top of existing children. (regression)
 - 2.2.1 (2017.11.14)
   * Introduce new option to operate a parent tab just as a solo tab, by operations outside of the sidebar.
   * Fix some odd behaviors around an window separated from another existing window. (regression)
 - 2.2.0 (2017.11.14)
   * Optimize initialization, retrieving tab relations based on tree, and collapsing/expanding of tree.
 - 2.1.2 (2017.11.12)
   * Keep tabs indented after deep level tab is closed. (regression)
   * Link to instruction to migrate session information.
 - 2.1.1 (2017.11.11)
   * Optimize animation to collapse/expand tree.
   * Collapse other auto-expanded tree when new tree is created. (regression)
   * Dummy group tab now accept tab title specified without`title=`.
   * Import tree from migration data correctly, including their URIs.
 - 2.1.0 (2017.11.9)
   * Better handling of restored tabs.
   * Better handling of new tab opened by Ctrl-T.
   * Redirect legacy `about:treestyletab-group` URI to new `moz-extensions://...` URL.
   * Don't break tree when a member tab of the last tree is promoted by dropping below a paranet tab.
   * Detect copy action for dragging correctly. (regression)
   * Detect sidebar's open/close status more correctly again. (regression)
   * Open tab as independent correctly based on configurations, for duplicated tabs.
   * Move descendant tabs to the new window also by the "Move to New Window" command.
   * Disallow to drop tab onto scrollbar.
   * Keep tabs discarded after moved by "Move to New Window".
   * Move tree to new window more safely from fake context menu.
   * Close only right (below) tabs in the window correctly.
   * Specify background color for dummy group tab.
   * Accept tab ids changed by moving between windows, for API's input.
 - 2.0.7 (2017.10.18)
   * Better tree restoration for restored sessions.
 - 2.0.6 (2017.10.17)
   * Allow to open new active child tab under a parent tab which is internally collapsed. (regression on 2.0.3)
   * Restore collapsed/expanded state of tree after crash recovery, if possible.
   * `tabs.Tab.openerTabId` of each tab is now updated based on tree structure, for other addons.
   * Tabs with updated `tabs.Tab.openerTabId` are now automatically attached to the opener's tree. (Due to [the bug 1409262](https://bugzilla.mozilla.org/show_bug.cgi?id=1409262 "1409262 - Updated openerTabId is not notified via tabs.onUpdated if it is changed by tabs.update()"), updated relation is not applied immediately.)
   * Scroll to the focused tab correctly, when it is focued by Firefox's `browser.tabs.selectOwnerOnClose` feature.
 - 2.0.5 (2017.10.14)
   * Restore tree for tabs restored from crash, if possible.
   * The tab bar is scrolled to newly attached child tab prior to its parent, if the parent is already out of the viewport.
   * Animation effect for completely loaded tab won't be applied again and again for already loaded tabs anymore.
   * Clicking on the tab bar itself is now cancelable by other addons. If any addon returns `true` for the notified message with the type `tabbar-clicked`, TST's default behavior (open new tab) is canceled.
   * Apply macOS specific behavior on macOS correctly.
 - 2.0.4 (2017.10.10)
   * The current tab is never scrolled out when a new tab is opened and the tab bar turned to "overflow" mode.
   * Never show blue gradient for notification when the window is resized.
 - 2.0.3 (2017.10.10)
   * Tree structure is restored when Firefox is started with some extra URLs (or files.)
   * Sidebar UI is now rendered with the system font for message boxes (same to Firefox's tabs).
   * "Max level of indentation" config works more correctly (including `0` case.)
   * Focus redirection for closing current tab works more correctly.
   * "Close Other Tabs" command in the fake context menu don't close pinned tabs anymore.
   * Click actions on fake context menu items now work only on certain correct cases.
   * The fake context menu is shown on the correct timing same to native context menu on the platform.
   * Last scroll position of the tab bar is now restored.
   * TST sidebar's initialization process is optimized and now it is opened more quickly.
   * Add a new option to activate behaviors around tree when TST's sidebar is not shwon. The option is activated by default now.
   * Tabs opened at startup (like "Home" with multiple URLs) aren't grouped anymroe. The maximum delay to detect "opened on startup" is customizable and it is 500msec by default.
   * Sound indicator icon is correctly updated for changes. (regression on 2.0.2)
   * "New Tab" button in the sidebar opens new next sibling tab correctly (if you configured).
   * Collapse/expand tree by changing focus and closing current tab more correctly.
   * Collapsed/expanded state of tree is restored more correctly.
   * Infinitely animation throbbers are gone.
   * Restore closed tabs with previous tree strucutre more correctly.
   * Restoring of closed duplicated tabs unexpectedly broke tree structure.
   * Too narrow height of tabs is corrected for the "Metal" theme.
   * Tabs moved next to collapsed tree by Firefox or other addons won't be attached to the collapsed tree anymore.
   * Invalid middle click (the mouse is moved out before mouseup) is correctly ignored for "close the tab" on a tab and "open new tab" on blank area.
   * Focusing and positioning of duplicated/restored tabs are processed more correctly.
   * Ghost tabs won't be produced anymore from tabs closed after opened immediately.
   * Select tab immediately when mousedown event is fired on a tab, like legacy TST.
   * Use more suitable term "end" instead of "last" for labels of some configurations.
   * New tabs opened at the end of the tab bar is now completely shown (if possible) when the tab bar turns into "overflow" mode by the opened tab.
   * [Simple `ping` API](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#uninit-special-features-for-tst-when-tst-is-going-to-be-disabled) to check TST's living status from other addons is now available.
   * Tabs gotten with [`get-tree` API](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#get-tree-information) now have correct `active` status.
 - 2.0.2 (2017.10.4)
   * Open new tab by middle click on the blank area, like Firefox does.
   * Synchronize animation of throbbers, like Firefox does.
   * Apply "burst" animation for completely loaded tabs, like Firefox does.
   * Show fake context menu with the system font for menu items.
   * Process fake context menu commands correctly when the menu is opened on non-tab area.
   * Fix invisible throbber on active tab with some themes.
   * Open new tab as next sibling without breaking tree, when the current tab is a root tab.
   * Group tabs by a dummy tab correctly on secondary and later windows.
   * Don't open needless group tab in a rest window when another window is closed.
   * Don't highlight unread pinned tabs when they are not faviconized.
   * Respect Frirefox's behavior of `browser.tabs.selectOwnerOnClose` more correctly. Now the "owner" tab is focused when the current tab is closed. You need to disable the option via `about:config` if you want TST to control focusing of tabs completely.
   * Don't create recursively grouped tabs from newly opened tabs.
   * [New APIs to override the wheel scrolling behavior](https://github.com/piroor/treestyletab/wiki/API-for-other-addons#override-reaction-for-mouse-wheel-rotation-on-the-vertical-tab-bar) are now available.
   * Updated zh-CN locale by YFdyh000, thanks!
 - 2.0.1 (2017.9.29)
   * "Middle click to close tab" behavior becomes same to Firefox's one (closed on mouseup).
   * "Dragging" appearance of tabs are correctly cleared when the dragging is canceled.
   * Tabs were too easily detached from the window by drag and drop of a tab onto itself. Now dropping of a tab onto itself is simply ignored.
   * Fix missing translation in Japanese locale.
   * Fix too large padding in tabs in the "Sidebar" theme (by Niklas Hambüchen. Thanks!)
   * The option to control positioning of tabs opened by "New Tab" command is now applied for tabs opened by keyboard shortcut Ctrl-T (⌘-T), if they are opened with the URL "about:newtab". (But there are some problems. [See also technical details.](https://github.com/piroor/treestyletab/issues/1038#issuecomment-332711522))
   * "Open as next sibling" choice for options to control new tab position works more correctly.
   * Focusing of tabs is controlled more correctly for closing current tab.
   * "Move Tab to New Window" in the sidebar context menu works correctly.
   * Reduce CPU usage for throbber animation.
   * WhatsApp Web tabs were unexpectedly eats CPU resource.
   * Last effective icons are restored correctly after restart, for some websites including WhatsApp Web.
   * Tabs are updated more correctly by events. For example, view-source tabs are shown with correct title more certainly.
   * Restore tree structure when a parent tab is restored after it was replaced with a group tab.
   * All collapsed descendant tabs are now shown in the tooltip.
   * An announcement message is shown automatically, when TST is updated from legacy version to 2.x or later.
   * Now pinned tabs are easily unfaviconized. (A new checkbox is added in TST's configurations.)
 - 2.0 (2017.9.26)
   * Rebuilt on WebExtensions.
 - 0.19.2017090601
   * Tree Style Tab's configurations and tree information are now exportable, as a migration assistance for Firefox 57 and later. See the "Advanced" section in the configuration dialog.
   * Tree restoration on the startup or restored window is just triggered by SSWindowReady now. TST don't wait SSTabRestoring event anymore.
   * Fix too frequently redrawing of the tab bar by any animation effect in Firefox's toolbar.
 - 0.19.2017090201
   * Tab bar position is updated after visibility of a toolbar is changed with animation effect.
   * Initialize itself correctly on lately versions of Firefox.
   * Duplicated bookmarks won't be created.
   * "ru" locale is updated by Infocatcher. Thanks!
   * "fr-FR" locale is updated by AxlMun. Thanks!
 - 0.19.2017061601
   * Works on Nightly 56.0a1.
   * Allow to drop multiple local files to the tab bar, on Firefox 52 and later.
   * Scroll to a newly opened tab if possible.
   * Load a URI in an existing tab when it is dropped into the content area. (New tabs were wrongly opened by such operations.)
   * Refresh tab bar correctly when any new notification appears.
   * Support "Compact Dark" theme on Firefox 53 and later.
   * Open tabs from middle-clicked items in "Synced Tabs" sidebar as new root tabs.
   * Support contextual tabs on Firefox 54 and later.
 - 0.19.2017031101
   * Works on lately Firefox versions. (Tested on Nightly 55.0a1.)
   * Drop support for Firefox 51 and older versions.
   * Introduce a new choice "No control" as the position of new child tabs. If you choose the option, new child tabs from links will be opened like Firefox's default behavior.
   * Introduce a new choice "Click" as an action to show shrunken/collapsed tab bar.
   * Treat child tabs opened by the preference `browser.tabs.insertRelatedAfterCurrent`=`true` more correctly.
   * Fix broken configuration UI for the "auto hide delay".
   * The position of the tab bar is now changable again by drag and drop.
   * Collapse the dragged tree while dragging. The experimental "shrink" behavior in the previous release was removed.
   * Open new blank tab as next sibling tab correctly, even if the current tab is in a last tree.
   * Restore children tabs correctly when a parent tab is restored by "undo close tab" command.
   * Fix visual erros in the "Vertigo" skin.
   * Avoid fingerprinting by website authors.
   * Added Greek translation by Vangelis Skarmoutsos. Thanks!
   * Known issue: opened or expanded tabs sometimes stay invisible until you move the mouse cursor on it, due to [Firefox 52's bug](https://github.com/piroor/treestyletab/issues/1202). This doesn't happen on Firefox 53 and later. Simple workaround is disabling of tab animations by `browser.tabs.animate`=`false` in `about:config`.
 - 0.18.2016111701
   * New background tabs are opened correctly. (The first opened tab was opened in the foreground unexpectedly.)
   * Shrink other dragged tabs while dragging. (experimental feature)
   * Better handling of "Tabs in Titlebar" feature of Firefox itself.
   * Open new tab as a next sibling morecorrectly.
   * Better styling of tabs with the "Metal" skin on macOS (OS X). (Many thanks to Andrew Shu! [patch 1](https://github.com/piroor/treestyletab/pull/1192), [patch 2](https://github.com/piroor/treestyletab/pull/1194))
   * Show microphone icon on Nightly 51.0a1 in pinned tabs correctly.
   * Isolate from old libraries and old unrecommended methods.
 - 0.18.2016090802
   * Failed to initialize the browser window with a preference: `browser.tabs.drawInTitlebar`=`false` (regression on 0.18.2016090601.)
 - 0.18.2016090801
   * The dialog to choose how tabs to be opened from a bookmark folder is now cancelable.
     (If you choose the "Cancel" button, the operation will be totally canceled and no tab will be opened.)
   * Isolate codes from `new Function()`.
 - 0.18.2016090601
   * Isolate codes from `eval()` hack.
   * Drop support for Firefox 44 and older versions.
   * Remove compatibility codes for unsupported/unpublished/obsolete addons: Google Toolbar, Snap Links, Highlander, PermaTabs, FullerScreen, DragNDrop Toolbars, Optimoz Tweaks, Tabberwocky, Super DragAndGo, Drag de Go, FLST, Mouse Gestures Redox, Aging Tabs, Autohide, Smoothly Close Tabs, IE Tab Plus, Locationbar², DomainTab and TotalToolbar
   * Remove compatibility codes for Tab Mix Plus's custom session management system. Now it is strongly recommended you to use Firefox's built-in session management system. If you choose the TMP's session management, there is no guaranty about what happens.
 - 0.17.2016083101
   * Fix broken tab color of Firefox 51 and later (due to [bug 1297157](https://bugzilla.mozilla.org/show_bug.cgi?id=1297157).)
 - 0.17.2016083001
   * Better handling about positioning of new tabs duplicated by other addons.
   * Now you can drop tabs onto another tab more easily. (The drop area of each tab is enlarged.)
   * The tab bar can be shrunken even if there is something wide toolbar item like the search bar.
   * Better positioning of tabs opened from the last child tab.
   * Tabs opened from inline frames or webpages including `base` tag are attached to the current tab as new children correctly.
   * Reduce warnings from undefined CSS properties (by asamuzaK. Thanks!)
   * Supports [contextual tab coloring on Firefox 51 and later](https://blog.mozilla.org/tanvi/2016/06/16/contextual-identities-on-the-web/).
   * Remove icons from the pane switcher in the configuration dialog (because Firefox 50 and later have no suitable icon for some categories).
   * A new secret preference `extensions.treestyletab.blockTabsInTitlebar` in introduced to allow customization with userChrome.css around "tabs in titlebar" style.
   * Tabs duplicated by ctrl-drag-and-drop of a tree are duplicated with correct tree structure.
   * Reduce warnings about "unsafe CPOW usage" for the "view image" command.
 - 0.17.2016061501
   * Scrollbar in the tab bar couldn't operated by mouse if you show the menu bar, at Firefox 47 on Windows.
   * The tab bar was wrongly fixed to "overflowed" state after you shrink the tab bar too narrow.
   * Better compatibility with the "Dark" theme of Firefox Developer Edition.
   * Better compatibility with FireGestures.
   * The width of expanded tab bar isn't enlarged too much, when shrunken tab bar is going to be wider than expanded tab bar.
   * Introduce a new secret preference `extensions.treestyletab.controlNewTabPosition` to disable new tab position control by TST itself. When you use any other addon like Tab Mix Plus which provides ability to control new tab position for bookmarks or others, you possibly get better experience with turning it to `false`.
   * The hidden tab bar is never expanded for feedback around pinned tabs.
 - 0.17.2016031101
   * Open bookmark groups as a tree correctly, even if it is the first time for an window. (regression)
   * Apply configured max indent level for vertical tab bar correctly. (regression)
   * Allow to unmute tab always, even if the sound is not played. (regression)
   * Implement pseudo tree in `about:treestyletab-group` tabs and the rich tooltip without XHTML. (We don't need to mix XHTML and XUL to apply multi-column properties of CSS.)
   * Activate multi-column layout only when it is required, at tooltip of tabs and dummy group tabs.
 - 0.17.2016030402
   * Show rich tooltip with multiple columns even if there are only short title tabs.
   * Avoid initialization error on newly opened group tabs.
 - 0.17.2016030401
   * Allow to specify different delay for autoshow/hide on mousemove, via secret preferences `extensions.treestyletab.tabbar.autoHide.delay.show` and `extensions.treestyletab.tabbar.autoHide.delay.hide`.
   * Keep current tab visible after the window is resized, even if there are too many tabs with a scrollbar.
   * Don't scroll to a hidden tab when it is newly opened.
   * Dropped non-URI text (maybe including whitespaces) onto the tab bar is opened with a search result tab. The behavior is same to Firefox's default.
   * Better layout for fake tree in multiple columns (at tooltip of tabs and dummy group tabs).
   * Behaviors around multiple home pages are improved.
     * On the startup, they are opened as flat tabs and not grouped.
     * For left click of the home button, flat new tabs are opened instead of loading the first home page into the current tab.
     * For middle click of the button, home tabs are opened as a tree.
   * Don't leave needless group tab after a tree is detached, when a closed parent tab is configured to be replaced with a dummy group tab.
   * Narrow scroll bar in the tab bar is now more compatible with other customizations.
   * Tree of tabs are now always collapsable for both horizontal and vertical. Moreover, indentation of tabs also activated for the vertical tab bar always.
     There is no way to revoke those tree features.
     If you just require vertical tab bar without tree features, please try other alternative addons: [Vertical Tabs](https://addons.mozilla.org/firefox/addon/vertical-tabs/), [Vertical Tabs (Simplified)](https://addons.mozilla.org/firefox/addon/vertical-tabs-simplified/), [Side Tabs](https://addons.mozilla.org/firefox/addon/side-tabs/), or others.
   * de-DE locale is updated by Björn Kautler. Thanks!
   * ru locale is updated by Infocatcher. Thanks!
 - 0.16.2016021602
   * Attach new tabs only actually opened with `relatedToCurrent`=`true` option (or referrer) to the current tab, as the default behavior for compatibility with other addons.
 - 0.16.2016021601
   * Tree in group (dummy) tabs is now shown with multiple columns. (You can disable the feautre by `extensions.treestyletab.groupTab.columnize`=`false`.)
   * Tree in tooltip is now shown with multiple columns. (You can disable the feautre by `extensions.treestyletab.tooltip.columnize`=`false`.)
   * Fix regression: open bookmarks as separate tabs for user preference.
   * Better appearance for narrow scrollbar in the tab bar.
   * Add ability to collapse/expand the tab bar by middle click on the splitter.
   * Expand the tab bar to feedback what's happen, when a tab has new title, in the "auto hide" mode.
   * Add secret preferences to disable expanding of the tab bar to feedback what's happen for each case: `extensions.treestyletab.tabbar.autoShow.feedback.opened`, `extensions.treestyletab.tabbar.autoShow.feedback.closed`, `extensions.treestyletab.tabbar.autoShow.feedback.moved`, `extensions.treestyletab.tabbar.autoShow.feedback.selected` and `extensions.treestyletab.tabbar.autoShow.feedback.titleChanged`.
   * When the tab bar is expanded for a feedback, the subject tab is now highlighted.
   * Add a new choice when a parent tab is closed: now you can replace the closed parent tab with a new group tab.
   * de-DE locale is updated by Björn Kautler. Thanks!
   * ru locale is updated by Infocatcher. Thanks!
 - 0.16.2016021201
   * Better compatibility with [Tab Badge](https://addons.mozilla.org/firefox/addon/tab-badge/) addon.
   * Never touch session history of remote tabs (on e10s activated). It raised exception and broke tree structure when a parent tab is closed and the next parent is a remote tab.
   * Reduce `eval()` hack.
   * [Gave up to disable the preference `browser.tabs.insertRelatedAfterCurrent`.](https://github.com/piroor/treestyletab/issues/874#issuecomment-183914331)
     Now TST respects the default behavior for the preference, about new tabs opened from links.
     See also the next topic.
   * All new tabs opened via the `gBrowser.addTab()` method with the option `relatedToCurrent:true` or a referrer information are now basically opened as children of the current tab.
     By this change, new tabs from various other addons will be opened as children of the current tab without any hack.
   * New tabs from `window.open()` are now opened as orphan tabs, when TST cannot find the possible parent tab from the referrer information.
   * A new APIs to open new orphan tab is added: `gBrowser.treeStyleTab.readyToOpenOrphanTab()` and `gBrowser.treeStyleTab.readyToOpenOrphanTabNow()`.
     They are useful to open new independent tab with `relatedToCurrent:true` (to go back to the previous "current" tab after the new tab closed immediately).
   * Never shrink the tab bar when it is scrolled.
   * No more flashing issue of the tab bar in the "auto hide" mode, while moving focus on tabs by Ctrl-Tab.
   * Handle long press of the Ctrl key even when `browser.ctrlTab.previews` is `true`.
   * Fixup tree structure of tabs after moving of tabs by Ctrl-Shift-PageUp/PageDown more correctly.
   * Don't shrink/hide the tab bar with simple focus change, if it triggers changing of the visibility of a menu item in the toolbox.
 - 0.16.2015122501
   * Initialize itself correctly on Firefox 38. (regression)
   * Don't show thin glay bar for pinned tabs on fullscreen HTML5 video.
   * Activate/deactivate auto hide feature for fullscreen mode correctly, on Firefox 38.
   * Don't change the scroll position of the tab bar, when it is expanded from shrunken.
 - 0.16.2015113001
   * New tabs can be opened even if Speed Dial or some addons are activated.
   * Clicking at the grippy in the tab bar splitter expands collapsed tab bar correctly. (regression)
   * "New Folder" and "Bookmark Properties" works again. (regression)
   * Don't shake the tab bar when it is scrolled by spacers in the arrowscrollbox.
   * Show the tab bar automatically by mousemove on developer tools.
   * Show preferred label "auto hide" or "auto shrink" for the menuitem to toggle "auto hide" feature from the tab context menu.
   * A new secret preference `extensions.treestyletab.closeParentBehavior.promoteAllChildrenWhenParentIsLastChild` is instoruced to disable a safeguard for the edge case: promoting all children to the upper level when a parent tab which has no sibling is closed.
   * Restore order of rearranged tabs more correctly.
   * Don't break tree structre for tab rearrangings triggered by Ctrl-Shift-PageUp/PageDown.
   * Disallow to enlarge the width of the tab bar over a harf of a window, by dragging of the splitter.
 - 0.16.2015111001
   * Free memory for closed windows correctly (it was grabbed by living-dead event listeners.)
   * Highlighted color of updated pinned tabs is shown correctly.
   * The feature "Bookmark this tree" and the property dialog of bookmark folders now work correctly.
   * The height of the closebox in each tab is never changed anymore.
   * The navigation toolbar is shown correctly below window buttons on OS X.
 - 0.16.2015110801
   * The title bar is now hidden for permanently shown menu bar. (Otherwise the menu bar is not draggable to move the window itself.)
   * Regression: Tabs opened via `GM_openInTab()` are placed at the top of existing child tabs of the current tab, if it is the default position of newly opened children.
   * Regression: "Search with..." in the context menu works correctly.
 - 0.16.2015110701
   * The API `TreeStyleTabService.getLastDescendantTab()` now returns correct value always.
   * Open "View Source" result as a child of the current tab.
   * Follow the position of the tab bar to changes around the social sidebar.
   * Don't reposition/update the tab bar when the window regains focus or the sidebar is switched between different panels.
   * Don't shrink the width of the tab bar with a scrollbar for too many tabs, on OS X.
   * Don't hide the title bar unexpectedly, after toolbar customizations.
   * Introduce new custom DOM event `nsDOMTreeStyleTabTabbarRendered` for addons who need to modify appearance of the tab bar, like Unified Sidebar.
   * Hide (shrink) the tab bar correctly after a tab is dragged and dropped or any FireGestures's gesture is performed.
   * The configuration dialog applies new "auto hide" preference only for the correct mode: normal or full screen.
   * Fix misspelling of `Leftside` and `Rightside` - they simply became `Left` and `Right`.
   * Perform searches from the web search bar and the context menu correctly, when e10s is activated.
   * Show the tab bar at correct position, after the DOM fullscreen mode.
   * Hide tab bar related elements completely in the DOM fullscreen mode.
   * Tabs opened via `GM_openInTabs()` from Greasmeonkey scripts become children of the current tab again.
   * Introduce new internal preferences to control debug prints. You can activate/deactivate debug print per module via preferences like `extensions.treestyletab.debug.*`.
   * Fix broken appearance of overlay icons on pinned tabs.
   * Reduce `eval()` hack to avoid errors around invalid references to objects defined with [ECMAScript 6's `const`](https://bugzilla.mozilla.org/show_bug.cgi?id=1202902) in separate scopes for Firefox sources.
   * Restore order of rearranged tabs more correctly.
   * Don't show gray rect of pinned tabs on full screen videos and collapsed tab bar.
   * Don't update the size of the tab bar too frequently.
     This change solves conflict with the [Unified Sidebar](https://addons.mozilla.org/firefox/addon/unified-sidebar/) addon.
   * On Linux, show the icon of the "all tabs" button in the vertical tab bar correctly.
   * Introduce an internal method `gBrowser.treeStyleTab.dumpTreeInformation()` to dump tree structure information stored in each tab, for debugging around unexpectedly broken tree.
 - 0.15.20150902901
   * Fix many compatibility issues around spec changes at Firefox 40 and later.
     (Including [patches by Xidorn Quan](https://github.com/piroor/treestyletab/pull/925). Thanks!)
   * Drop support for Firefox 31.
   * Re-introduce configuration UIs for the size of the tab bar and its fixedness.
     Now it works to reset size of the tab bar in all existing windows.
   * Toolbar customization works correctly even if the tab bar is placed not on the top.
     In old versions, only the first time worked.
   * Current tab is shown with highlighted color correctly at the "Plain" skin.
   * Mouse events are correctly handled for the "auto hide" feature for tabs even if their remoteness is dynamically changed.
 - 0.15.2015030601
   * Width of the tab bar, position of the tab bar, and status of the "auto hide" feature are saved and restored for each window.
   * Better compatibility with [Duplicate in Tab Context Menu addon](https://addons.mozilla.org/firefox/duplicate-in-tab-context-menu/).
   * Better compatibility with ColorfulTabs. Annoyingly horizontal scroll of the tab bar (happend by clicking on any tab) has been solved.
   * Isolated from obsolete `String.prototype.quote()`.
   * Isolated from deprecated JavaScript 1.7's let blocks.
   * Isolated from obsolete nsIPopupBoxObject interface on Firefox 36 and later.
   * Update appearance of the tab bar correctly, after the sidebar is shown/hidden at Firefxo 39 and later.
   * Reset z-index of vertical tabs always to prevent tabs are shown above other browser elements.
   * Open child tabs from links correctly on Firefox 36 and later.
   * Open child tabs from the web search bar correctly on Firefox 36 and later.
   * Open multiple child tabs from a tab by scripts more correctly, for E10S windows.
   * Firefox Hello's chat boxes are not placed below tabs anymore.
   * Mouse events on the place holder shown when the tab bar is completely hidden are handled correctly to show/hide the tab bar automatically.
 - 0.15.2014120101
   * Open clicked link as a new child tab correctly, from links with `target="_blank"` in e10s mode.
     (See also [the related bug on the bugzilla.mozilla.org](https://bugzilla.mozilla.org/show_bug.cgi?id=1098688))
   * Re-show the tab bar correctly after exiting from the fullscreen mode.
     [(by Xinkai. Thanks!)](https://github.com/piroor/treestyletab/pull/790)
   * "Auto hide tab bar" feature works correctly on Firefox 35 and older versions.
 - 0.15.2014111301
   * Drop support for Firefox 30 and older versions
   * Works correctly on the multi-process mode (E10S).
     * Open child tabs from links correctly, in e10s windows. [(by Nephyrin. Thanks a lot!)](https://github.com/piroor/treestyletab/pull/760)
   * Restore tree structure with multiple trees from bookmarks correctly, even if the dummy tab is disabled.
   * Restore tab position for "Undo Close Tab" command correctly.
   * Works on Nightly 33.0a1 with the preference `dom.compartment_per_addon`=`true`.
   * Update tabbar appearance correctly, after toolbar customization.
   * Save "parent tab" settings correctly in the bookmarks properties dialog.
   * Update fr-FR locale, by AxlMun. Thanks!
 - 0.14.2014051101
   * Don't hide the toolbar in the full screen mode, if `browser.fullscreen.autohide` is `false`.
 - 0.14.2014051001
   * Show the navigation toolbar and the "private browsing" indicator in the titlebar correctly, on OS X. (regression)
   * Don't darken colors of websites with white background, in "auto hide tab bar" mode.
   * [Czech locale is added by Vlastimil Ovčáčík. Thanks!](https://github.com/piroor/treestyletab/pull/714)
 - 0.14.2014050601
   * Allow to hide the title bar if Tabs on Bottom addon is installed.
   * Open new tabs by [Tile Tabs](https://addons.mozilla.org/firefox/addon/tile-tabs/) as next sibling tab.
 - 0.14.2014050102
   * Works with Unified Sidebar correctly, in the "auto shrink" mode. (regression)
 - 0.14.2014050101
   * Works on Nightly 32.0a1 again.
   * Hide pinned tabs completely on DOM full-screen mode.
 - 0.14.2014043001
   * Better compatibility with No Script 2.6.8.20.
 - 0.14.2014042701
   * Works on Nightly 31.0a1 again.
   * Improved: Introduce a new checkbox "When a new tree appears, collapse others automatically" in the configuration dialog. It has been split from "When a tab gets focus, expand its tree and collapse others automatically" because the behavior was not related to the existing checkbox.
   * Improved: Better compatibility with [Classic Theme Restorer](https://addons.mozilla.org/firefox/addon/classicthemerestorer/) about "tabs in titlebar" appearance.
   * Fixed: Restore tree structure on the startup correctly, with Firefox 28 and later.
   * Fixed: Open new tabs from "search by" in the context menu correctly, even if the selection includes line breaks or it is too long.
   * Fixed: Broken trees around duplicated tabs after restarting, are gone.
   * [ru locale is updated by Infocatcher. Thanks!](https://github.com/piroor/treestyletab/pull/672)
 - 0.14.2014020901
   * Improved: On the "auto hide" mode, scroll to the current tab when the tab bar becomes shown.
   * Improved: Accept drag and drop of the tab bar itself, on the blank area around pinned tabs.
   * Fixed: Don't activate "draw in titlebar" feature for windows with vertical tab bar.
   * Fixed: On the "auto hide" mode, keep scroll position of the tab bar correctly when the bar is shown and hidden.
   * Fixed: In the fullscreen mode, don't hide the navigation toolbar on OS X Lion.
   * Fixed: Collapse the tab bar automatically, if it is expanded by long-press of the Ctrl key and a new window is opened while the key is pressed.
   * Fixed: Open tabs as children, from the "search by" in the context menu.
   * Fixed: Don't start dragging operation of the tab bar itself from a button which have its own popup menu.
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
   * A secret preference `extensions.treestyletab.autoAttachNewTabsAsChildren` is renamed to `extensions.treestyletab.autoAttach`.
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
