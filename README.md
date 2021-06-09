# Tree Style Tab (aka TST)

[![Build Status](https://travis-ci.org/piroor/treestyletab.svg?branch=trunk)](https://travis-ci.org/piroor/treestyletab)

This extension to Firefox provides the ability to work with tabs as "trees".

New tabs opened from the current tab are automatically organized as "children" of the current.
Such "branches" are easily folded (collapsed) by clicking on down on the arrow shown in the "parent" tab, so you don't need to suffer from too many visible tabs anymore.
If you want, you can restructure the tree via drag and drop.

 * Such a tree of tabs will behave like a visual browsing history for you.
   For example, if you see a list of search results for a topic, you'll open each search result link in new child tab.
   For more details you'll also open more descendant tabs from them.
   You'll easily dig and dig deeply, without losing your browsing trail - if you want to go back to the original search result, you just have to switch to the "root" tab.
 * Moreover, you'll treat a tree of tabs just as "grouped tabs" for similar topics.

Anyway this addon just provide uncolored "tree" feature.
Please enjoy as you like!

## Release builds

* The signed package of the latest version is available at [Mozilla Add-ons (AMO)](https://addons.mozilla.org/firefox/addon/tree-style-tab/). See also the [`strict_min_version` information in the install manifest](https://github.com/piroor/treestyletab/blob/master/webextensions/manifest.json#L203) to know the minimum supported Firefox version.
* [Old packages are also downloadable on the AMO website](https://addons.mozilla.org/firefox/addon/tree-style-tab/versions/). TST sometimes drops outdated versions of Firefox, but you may find out old packages supporting the dropped versions of Firefox. 
* For more older versions of Firefox, Waterfox, or Palemoon, [Classic Add-ons Archive](https://github.com/JustOff/ca-archive) possibly contains legacy packages of TST.

## Development builds

There is an [automated build based on the latest source code](https://piro.sakura.ne.jp/xul/xpi/nightly/treestyletab-we.xpi).
Builds for each commit are avilable at ["Artifacts" of the CI/CD action](https://github.com/piroor/treestyletab/actions?query=workflow%3ACI%2FCD).

<details>
<p><summary>It is not signed, so you need to load it by non-regular way. (Please click this section to see instructions.)</summary></p>

There are two methods to try them in your environment:

* Go to `about:debugging` and click "Load Temporary Add-on" button, then choose the downloaded file. The development build will be loaded and active until you restart your Firefox.
* If you want to try it as a regular addon instead of a temporary addon, you need to use [Nightly](https://www.mozilla.org/firefox/channel/desktop/) instead of the stable Firefox or Firefox beta. On Nightly, go to `about:config` and set `xpinstall.signatures.required` to `false`. Then you will be able to install such an unsigned addon.

Also, you can build a custom development build locally. For example, here are the steps to build an XPI on Ubuntu (native, or WSL on Windows 10):

```bash
$ sudo apt install git nodejs npm
$ git clone --recursive https://github.com/piroor/treestyletab.git
$ cd treestyletab/webextensions
$ make
```

Steps to build a specific revision (for example bb467286d58b3da90fd1b2e6ee8a8016e3377b97):

```
$ cd treestyletab/webextensions
$ git checkout bb467286d58b3da90fd1b2e6ee8a8016e3377b97
$ git submodule update
$ make
```

Then you will see new `.xpi` files in the current directory. You can install such a development build via `about:debugging`. Click the `Load Temporary Add-on` button and choose `treestyletab/manifest.json` or a built `.xpi` file.
</details>


## Extensions that extend TST

TST provides an [API for other extensions](https://github.com/piroor/treestyletab/wiki/API-for-other-addons).
Some extend the behavior of TST's sidebar panel:

 * [Multiple Tab Handler](https://addons.mozilla.org/firefox/addon/multiple-tab-handler/) allows you to select multiple tabs with long-press on tabs. It also allows you to close mutiple tabs with long-press on the closebox on tabs.
 * [TST Bookmarks Subpanel](https://addons.mozilla.org/firefox/addon/tst-bookmarks-subpanel/) allows you to show a small "Bookmarks" sidebar panel below tabs in the TST's sidebar.
 * [TST More Tree Commands](https://addons.mozilla.org/firefox/addon/tst-more-tree-commands/) provides more context menu and keyboard shortcut commands to manipulate TST's tree.
 * [TST Active Tab in Collapsed Tree](https://addons.mozilla.org/firefox/addon/tst-active-tab-in-collapsed-tr/) shows [a small tab on a collapsed tree as an alias for the last active tab under the tree](https://github.com/piroor/treestyletab/issues/2192).
 * [TST Lock Tree Collapsed](https://addons.mozilla.org/firefox/addon/tst-lock-tree-collapsed/) allows you to lock arbitrary trees as collapsed. (This was a built-in feature on TST 3.3.0-3.3.6, and now separated.)
 * [TST Tab Drag Handle](https://addons.mozilla.org/firefox/addon/tst-tab-drag-handle/) provides a small tooltip on tab labels to start dragging of tabs for specific operations. (This was a built-in feature on TST 2.6.0-3.3.6, and now separated.)
 * [TST Open Bookmarks as Partial Tree](https://addons.mozilla.org/firefox/addon/tst-open-bookmarks-as-partial-/) allows you to open only some bookmarks in a folder as a partial tree. Moreover, it also provides ability to open tree of container tabs from bookmarks.
 * [TST-MiddleClick](https://addons.mozilla.org/firefox/addon/tst-middleclick/) allows you to run "undo close tab" or "close currently active tab" command on middle click on the sidebar.
 * [Tree Style Tab Mouse Wheel](https://addons.mozilla.org/firefox/addon/tree-style-tab-mouse-wheel/) allows you to switch active tab by wheel scrolling.
 * [Tab flip for Tree Style Tab](https://addons.mozilla.org/firefox/addon/tab-flip-for-tree-style-tab/) allows you to move focus to the tab previously focused, by clicking on the active tab.
 * [Tree Style Tab Focus Preceding Tab on Close](https://addons.mozilla.org/firefox/addon/tst-focus-preceding-tab/) focuses the previous tab instead of the next tab when a tab is closed.
 * [Tab Unloader for Tree Style Tab](https://addons.mozilla.org/firefox/addon/tab-unload-for-tree-style-tab/) allows you to unload tabs by clicking on them in the sidebar.
 * [Move unloaded tabs for Tree Style Tab](https://addons.mozilla.org/firefox/addon/move-unloaded-tabs-for-tst/) allows you to move tabs in the sidebar without them becoming active.
 * [Tree Style Tab in Separate Window](https://addons.mozilla.org/firefox/addon/tst-in-separate-window/) allows you to open the Tree Style Tab sidebar page in a new window.
 * [Auto Tab Discard](https://addons.mozilla.org/firefox/addon/auto-tab-discard/) supports the fake context menu in the Tree Style Tab sidebar.
 * [UnloadTabs](https://addons.mozilla.org/firefox/addon/unload-tabs/) supports the fake context menu in the Tree Style Tab sidebar.
 * [Bookmark Tree for Tree Style Tab](https://addons.mozilla.org/firefox/addon/bookmark-tree-for-tst/) allows you to bookmark and restore trees.
 * [TST Hoverswitch](https://addons.mozilla.org/firefox/addon/tst-hoverswitch/) allows you to switch tabs by hovering over them.
 * [TST Colored Tabs](https://addons.mozilla.org/firefox/addon/tst-colored-tabs/) gives custom background color for tabs based on their domain.
 * [Add Last Active Class To Tab](https://addons.mozilla.org/firefox/addon/add-last-active-class-to-tab/) helps you to give custom appearance for the "previously active tab".
 * [TSTのタブを閉じるボタンの挙動を変更 (tst-change-close-tab-button-be)](https://addons.mozilla.org/firefox/addon/tst-change-close-tab-button-be/) allows you to close the parent and its all descendants with a middle click on the closebox of a parent tab, whether the tree is expanded or collapsed.
 * [TST Select Random Tab](https://addons.mozilla.org/firefox/addon/tst-select-random-tab/) adds a context menu option for selecting a random tab in a Tree Style Tab tree.
 * [TST Tab Search](https://github.com/NiklasGollenstede/tst-search) provides a search field (as a subpanel) to filter opened tabs in the sidebar.


## Similar projects

There are some similar project by someone not me providing similar features:

* <details><summary>Vertical tab bar with tree (and more features)</summary>
  
  * [Tree Tabs](https://addons.mozilla.org/firefox/addon/tree-tabs/)
  * [Sidebery](https://addons.mozilla.org/firefox/addon/sidebery/)
  * [ftt](https://addons.mozilla.org/firefox/addon/ftt/)
  </details>
* <details><summary>Vertical tab bar with grouping</summary>
  
  * [Container Tabs Sidebar](https://addons.mozilla.org/firefox/addon/container-tabs-sidebar/)
  * [Sidebar Tabs](https://addons.mozilla.org/firefox/addon/sidebartabs/)
  * [Tab Sidebar](https://addons.mozilla.org/firefox/addon/tab-sidebar-we/)
  </details>
* <details><summary>Vertical tab bar without tree or grouping</summary>
  
  * [Tab Center Reborn](https://addons.mozilla.org/firefox/addon/tabcenter-reborn/)
  * [Vertical Tabs Reloaded](https://addons.mozilla.org/firefox/addon/vertical-tabs-reloaded/)
  * [Vertigo Tabs](https://addons.mozilla.org/firefox/addon/vertigo-tabs/)
  * [Sidebar+](https://addons.mozilla.org/firefox/addon/sidebar_plus/)
  * [Tabs2List](https://addons.mozilla.org/firefox/addon/tabs-2-list/)
  </details>
* <details><summary>Listing tabs with a search field</summary>
  
  Some extensions provide a pop-up list of tabs with a search field that complements TST:
  
  * [Tab Manager v2](https://addons.mozilla.org/firefox/addon/tab-manager-v2)
  * [TabSearch](https://addons.mozilla.org/firefox/addon/tab_search/)
  * [Tabby - Window & Tab Manager](https://addons.mozilla.org/firefox/addon/tabby-window-tab-manager/)
  * [Tab Master 5000](https://addons.mozilla.org/firefox/addon/tab-master-5000/)
  * [Power Tabs](https://addons.mozilla.org/firefox/addon/power-tabs/)
  * [Tabs2List](https://addons.mozilla.org/firefox/addon/tabs-2-list/): provides not only sidebar panel but a toolbar button with a popup panel also. It has an option to show a search field in the panel by default.
  </details>
* <details><summary>for Google Chrome and Chromium</summary>
  
  * [Sidewise Tree Style Tabs](https://chrome.google.com/webstore/detail/sidewise-tree-style-tabs/biiammgklaefagjclmnlialkmaemifgo)
  * [Tabs Outliner](https://chrome.google.com/webstore/detail/tabs-outliner/eggkanocgddhmamlbiijnphhppkpkmkl)
  * [Treely: Tree Style Tab Manager](https://chrome.google.com/webstore/detail/treely-tree-style-tab-man/hbledhepdppepjnbnohiepcpcnphimdj)
  * [Tree Style Tab](https://chrome.google.com/webstore/detail/tree-style-tab/oicakdoenlelpjnkoljnaakdofplkgnd)
  </details>
* <details><summary>for Vivaldi</summary>
  
  * [Tree Tabs](https://drive.google.com/drive/folders/0B3jXQpRtOfvSdkN4RW5XN2tOc3c)
  </details>


## If you have any request, proposal, or unexpected trouble from bugs?

All feedbacks are handled as [GitHub issues](https://github.com/piroor/treestyletab/issues).
But please read FAQ below, before you post any new feature request.

### Basics

 * *TST is basically designed to be used as an permanently-shown tab management UI, an alternative of Firefox's native tab bar.*
   * To avoid users' confusion, TST respects Firefox's built-in behavior and features around the tab bar - tab context menu, gestures, and so on.
 * And, of course *TST is designed to work with "tree of tabs"*.
   * TST's tree is designed to work as an extended memory for your brain. To satisfy this concept, TST is designed to guess relation of tabs automatically, from the context.
   * Better usability around ungrouped flat tabs in a vertical tab bar is out of purpose.

Any feature request unrelated to these points may be rejected, even if many people love it.
For example: [session management](https://addons.mozilla.org/firefox/addon/tab-session-manager/), [search field](https://addons.mozilla.org/firefox/addon/tab_search/), detailed focus control of tabs, and so on.

Instead of adding more features, I hope to make TST *compatible with other tab-related extensions*.
If it is required for more better compatibility I add [public APIs for other extensions](https://github.com/piroor/treestyletab/wiki/API-for-other-addons), and [actually there are some implementations using this API](#addons-extend-tst).

If you need any new API, please file API proposals to the issue tracker.

### FAQ / frequently rejected requests/proposals

#### Other browsers support

* <details><summary>Support for <a href="https://github.com/piroor/treestyletab/issues/1043">Pale Moon, Waterfox, and other Firefox forks</a></summary>
  
  Please use [a forked version of TST for Pale Moon](https://github.com/oinkin/treestyletab) instead.
  TST is designed for latest release of Mozilla Firefox (*Please see also the [`strict_min_version` information in the install manifest](https://github.com/piroor/treestyletab/blob/master/webextensions/manifest.json#L203) to know the minimum supported Firefox version)<!-- and Mozilla Firefox ESR-->, and other applications forked from Firefox are not supported.
  
  "Waterfox Current" looks based on Firefox ESR68 and you can install TST 2.0 and later to it.
  However "Waterfox Classic" based on Firefox 56 is never supported.
  </details>
* <details><summary>Support for other browsers based on Chromium (ex. Google Chrome) and WebKit (ex. Safari)</a></summary>
  
  TST can't be ported to other browsers because [it depends on some Firefox specific APIs like `sidebar`](https://github.com/piroor/treestyletab/issues/2801#issuecomment-768584534), so it needs to be re-implemented completely.
  Sorry but I won't re-implement TST as an extension for other browsers by myself because I still use Firefox.
  (But [there are some alternatives developed by someone not me](#similar-projects).)
  </details>

#### Appearance

* <details><summary>How to hide the top tab bar (horizontal tab strip)?</summary>
  
  As a workaround, you can [create a `userChrome.css` file.](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules#for-userchromecss)
  But please remind that I - the original author of TST - never recommend such an usage, because TST doesn't cover full features of the native tabs due to restrictions of WebExtensions API so *some tab features become inaccessible*, and I also believe that TST is not enough stable to replace Firefox's tab bar completely.
  Thus I usually use TST together with horizontal tab bar for safety.
  
  If I hid the tab bar on my environment in my daily use, I might maintain the userChrome.css hack by myself, but actually I don't do that.
  So guidance to hide the tab bar need to be maintained by people who really use.
  I think it is a nightmare for regular people who don't know how to research and find out solutions with debugger.
  I intentionally don't describe details how to hide the horizontal tab bar, to save people from critical troubles.
  
  I say again, I don't recommend you to hide the horizontal tab bar if you cannot write any suitable userChrome.css hack by yourself.
  I have no motivation to investigate how to hide the horizontal tab bar, because I'll never do that and it may lead people to troubles.
  </details>
* <details><summary>How to apply GTK+ theme color on Linux?</summary>
  
  Due to restrictions within Firefox, TST can not apply GTK+ theme color to its appearance by default. If you want TST's UI with colors to match other parts of Firefox, you need to configure Firefox and TST as:
  
  * Firefox's about:config
    * *`widget.content.allow-gtk-dark-theme`=`true` (not default)*
    * `widget.content.gtk-theme-override`=unset (default)
  * TST's options (pattern 1, using "Proton" theme)
    * "Appearance" => "Theme" => "Proton" (default)
    * *"Advanced" => "Extra style rules..." => [paste these lines](https://github.com/piroor/treestyletab/blob/180b6fa502587a3528af7f2e4f4671aca58d244a/webextensions/sidebar/styles/proton/proton.css#L72-L113) (not default)*
    * "Development" => "Color scheme" => "System Color" (default)
  * TST's options (pattern 1b, using "Photon" theme)
    * "Appearance" => "Theme" => "Photon" (default)
    * *"Advanced" => "Extra style rules..." => [paste these lines](https://github.com/piroor/treestyletab/blob/5a8569c22feeaedeecde623a86832db7bc0419a2/webextensions/sidebar/styles/photon/photon.css#L49-L76) (not default)*
    * "Development" => "Color scheme" => "System Color" (default)
  * TST's options (pattern 2, using less extra style rules)
    * *"Appearance" => "Theme" => "High Contrast" (not default)*
    * "Advanced" => "Extra style rules..." => no active style rule (default)
    * "Development" => "Color scheme" => "System Color" (default)
  
  For more details, please see also [the discussions in the issue #2667](https://github.com/piroor/treestyletab/issues/2667).
  </details>
* <details><summary>How to apply colors customized via <a href="https://color.firefox.com/">Firefox Color</a>?</summary>
  
  In short, there is a workaround:
  
  1. Go to TST's options.
  2. Choose "Development" => "Color scheme" => "Photon".
  3. Add a [CSS declaration applying Firefox's native tab colors](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules#apply-tab-colors-exactly-same-to-firefoxs-native-2780) to "Advanced" => "Extra style rules for contents provided by Tree Style Tab".
  
  For more detailed background, please see also [my comment in the issue #2780](https://github.com/piroor/treestyletab/issues/2780#issuecomment-746043627).
  </details>
* <details><summary>I cannot find out suitable <a href="https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules">code snippet</a> satisfying my demand. Is there any reference document?</summary>
  
  Sadly there is no stable reference document due to unstableness of TST's DOM structure. The [code snippets](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules) are just examples for the time they were written, and they may be broken by changes on TST itself, thus they need to be updated by users through [investigation with the debugger](https://github.com/piroor/treestyletab/wiki/How-to-inspect-tree-of-tabs#how-to-inspect-the-sidebar).
  </details>

#### Feature requests

* <details><summary>Horizontal tab bar</summary>
  
  It is not possible for Tree Style Tab to support horizontal tabs. 
  TST 2.0 and later is implemented as a Firefox sidebar, there is no chance to provide a horizontal version of the extension.
  </details>
* <details><summary>Better support for non-indented tabs</summary>
  
  This is beyond the scope of "Tree" Style Tab.
  There exist [complementary extensions that can provide vertical tabs without a tree](#similar-projects).
  </details>
* <details><summary>Better tab context menu</summary>
  
  Full-featured, expanded outside of the sidebar, access keys, and so on: [available with Firefox 64 and later](https://piro.sakura.ne.jp/latest/blosxom/mozilla/xul/2018-10-14_override-context-on-fx64.htm#topic2018-10-14_override-context-on-fx64).
  
  [WebExtensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions) restrictions prevent implementation of some features. See for example Mozilla bug [1417183 - Provide a web extensions API-based way to send pages between devices](https://bugzilla.mozilla.org/show_bug.cgi?id=1417183) (_WONTFIX_).
  </details>
* <details><summary>I don't need an automatically organized tree, I want to organize trees myself</summary>
  
  You can switch off this behavior:
  
  1. Go to TST's configuration.
  2. "Development" section.
  3. Expand the section "All Configs". Then all internal configurations are listed.
  4. Clear the ☐ `autoAttach` checkbox.
  5. Clear the ☐ `syncParentTabAndOpenerTab` checkbox.
  
  With those preferences unset, TST will no longer automatically attach new tabs to a tree.
  
  To select multiple tabs, for drag-and-drop: <kbd>Shift</kbd>/<kbd>Ctrl</kbd>-click. [Multiple Tab Handler](https://addons.mozilla.org/firefox/addon/multiple-tab-handler/) has additional features.
  </details>
* <details><summary>Endlessly adding minor/trivial options</summary>
  
  Please see the [list of helper extensions](#addons-that-extend-tst).
  For the appearance of tabs in the sidebar, [custom user styles](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules) may help.
  
  The variety of configurations for TST will not increase infinitely. Instead, I hope to reduce the variety.
  High customizability is out of scope.
  I want to limit options to those that are truly essential.
  Too many options would kill this project, because they would cloud the main concept of TST and would attract people who don't share my core vision.
  </details>
* <details><summary>Controlling where new tabs are opened from <a href="https://github.com/piroor/treestyletab/issues/1052">links</a> or <a href="https://github.com/piroor/treestyletab/issues/263">bookmarks</a></summary>
  
  Available with TST 3.7.0 and later, as an expert option: "Tabs from any other trigger" under the "New Tabs Behavior" section.
  [We cannot control the behavior for each detailed case, due to limitations of the WebExtensions API.](https://github.com/piroor/treestyletab/issues/2391#issuecomment-542302281)
  </details>
* <details><summary>Context menu to reach Tree Style Tab options</summary>
  
  If you use the TST toolbar button, you can open the options page directly from the context menu of the button. 
  Globally, Firefox provides a "Manage Extension" command in the context menus of toolbar buttons that are provided by extensions. 
  TST provides additional commands, such as the options dialog at the menu for a shortcut.
  
  I'm against providing a command such as "TST Options" in the tab context menu, for these reasons:
  
  * The command is fundamentally unrelated to the context: "what command do you want to invoke for the tab?"
  * If you need to change options too frequently during daily use, something is wrong. For example, failure of auto-detection of TST for your action's context. Instead of working around, I believe that such problems should be fixed through improved auto-detection by TST.
  
  If you do frequently open TST options, you can bookmark this address: `ext+treestyletab:options` – your bookmark will open the options page in a tab.
  </details>
* <details><summary>How to customize tab context menu?</summary>
  
  You can do this with `userChrome.css`. There's advice for [activation of `userChrome.css`](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules#for-userchromecss) and [style rules to hide specific context menu items](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules#hide-context-menu-items-in-the-sidebar-2116).
  
  I have no plan to add a configuration UI for items that are native to the tab context menu of Firefox. [Here are some comments describing my reasons for this decision.](https://github.com/piroor/treestyletab/issues/2658)
  </details>
* <details><summary>Automatically hide the sidebar</summary>
  
  Due to limitations of the WebExtensions API, this is impossible.
  There exists [a workaround with userChrome.css](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules#auto-showhide-sidebar-by-mouseover-hover).
  
  The WebExtensions API allows us to toggle visibility of the sidebar with [keyboard shortcuts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands#Key_combinations) and the toolbar button.
  Other arbitrary timings are disallowed, including `mouseover` and long-press of a key.
  </details>
* <details><summary>I want the "Bookmarks" sidebar to appear alongside the sidebar of Tree Style Tab</summary>
  
  This is currently impossible due to Mozilla bug [1328776 - Provide ability to show multiple sidebar contents parallelly)](https://bugzilla.mozilla.org/show_bug.cgi?id=1328776). Workarounds include:
  
  * [TST Bookmarks Subpanel](https://addons.mozilla.org/firefox/addon/tst-bookmarks-subpanel/), which places a collapsible "Bookmarks" panel below Tree Style Tabs.
  * [Aggregate Tabs to Main Window](https://addons.mozilla.org/firefox/addon/aggregate-tabs-to-main-window/), through which multiple windows can help your workflow – "one window for a sidebar", "another window for browsing tabs". You can treat such windows as virtual multiple sidebars.
  </details>
* <details><summary>High-power management of tree, like <a href="https://github.com/piroor/treestyletab/issues/94">sorting child tabs</a>, <a href="https://github.com/piroor/treestyletab/issues/509">auto-modification of tree</a>, <a href="https://github.com/piroor/treestyletab/issues/794">renaming tabs</a>, and so on</summary>
  
  Please see the [list of helper extensions](#addons-that-extend-tst).
  [TST More Tree Commands](https://addons.mozilla.org/firefox/addon/tst-more-tree-commands/)'s [issue tracker](https://github.com/piroor/tst-more-tree-commands/issues) may be a good place to track your request.
  
  Please note that "useful" features won't be implemented to TST itself as a built-in feature.
  
  I believe that generally "tree of tabs should be a visualized history of web browsing", because they are built on relations where you came from.
  Possibly such a tree is facially chaotic, but it just mirrors your actual footmarks, so you'll easily find out where is the target tab based on a map in your mind. Moreover, those relations themselves may let you recall forgotten idea you thought while you were browsing those tabs.
  
  On the other hand, sorted tabs based on URLs or something will be beautiful - but that's all.
  Such sorted tabs won't help me - I'm very forgetful.
  In other words, I just need something which memorizes my chaotic mind as-is.
  
  By the way, my another addon [Multiple Tab Handler](https://addons.mozilla.org/firefox/addon/multiple-tab-handler/) will help you if you frequently modify tree by drag and drop.
  It provides ability to select multiple tabs by Ctrl-Click or Shift-Click and you can drag selected tabs at once.
  </details>
* <details><summary>Configuration UI to change appearance of tabs in the vertical tab bar, for example, <a href="https://github.com/piroor/treestyletab/issues/539">color</a>, <a href="https://github.com/piroor/treestyletab/issues/236">height</a>, <a href="https://github.com/piroor/treestyletab/issues/514">visibility of the scrollbar</a>, <a href="https://github.com/piroor/treestyletab/issues/651">transparency of tabs</a>, and so on</summary>
  
  There is a plan to implement an input field to write custom CSS rules, so it will work like as `userChrome.css`.
  See the [code snippets](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules) and [details of inspection for the sidebar contents](https://github.com/piroor/treestyletab/issues/1725#issuecomment-359856516).
  </details>

#### Troubles, unexpected behaviors

* <details><summary>TST suddenly became not working! No reaction on the sidebar!</summary>
  
  1. Please try closing the sidebar and reopen it again, to reload the sidebar presentation module of TST.
     TST may work again if the trouble is due to a disconnection between TST's internal modules.
  2. If reopening the sidebar doesn't solve the problem, try disabling and re-enabling TST on the add-ons manager, to reload TST completely.
     TST may work again if the trouble is due to something broken internal status of TST itself.
  3. If both reopening and reloading don't solve the problem, restart Firefox please.
     If the trouble is due to something problems happening in a deeply low layer, we cannot recover the normal status without restarting of Firefox.
* <details><summary>I cannot drop tabs to the bookmarks toolbar to create bookmarks. (<a href="https://github.com/piroor/treestyletab/issues/2033">#2033</a>)</summary>
  
  In short: shift-dragging of tabs will allow you to drop tabs to the bookmarks toolbar. Otherwise [TST Bookmarks Subpanel](https://addons.mozilla.org/firefox/addon/tst-bookmarks-subpanel/) possibly helps you.
  
  From [a change introduced at the bug 1453153 (affects on Firefox 63 and later)](https://bugzilla.mozilla.org/show_bug.cgi?id=1453153), now Firefox doesn't allow extensions to provide ability to do "creating bookmarks (or links) by drag and drop of tabs" and "detach a tab to a new window by dropping it outside of the window" in same time - those functionailities are quite exclusive.
(For more technical details, see [my comment at the issue #2033](https://github.com/piroor/treestyletab/issues/2033#issuecomment-422157577).)
  
  Thus, now TST provides two different effects to gestures:
  
  * Dragging tabs to out of the tab bar: detach dropped tabs to a new window. You cannot drop tabs to the bookmark toolbar.
  * Shift-dragging tabs to out of the tab bar: create links to the desktop from dropped tabs. You can drop tabs to the bookmark toolbar to create bookmarks.
  
  You can switch these behaviors.
  Please go to the "Drag and Drop" section of TST's options page.
  (By the way, [TST Bookmarks Subpanel](https://addons.mozilla.org/firefox/addon/tst-bookmarks-subpanel/)'s small Bookmarks panel always accept drag and drop of TST's tree without such modifier keys.)
  
  For more preference, you can use a [small drag handles](https://addons.mozilla.org/firefox/addon/tst-tab-drag-handle/) with a helper addon: they will appear when the cursor is hovering on left edge (or right edge for inverted appearance) of a tab for a while.
  You can start dragging of the tab from one of handles, with specified effect for each without any modifier key.
  </details>
* <details><summary>New tab is not opened with expected position and container, when it is opened as a blank tab instead of the default new tab page. (<a href="https://github.com/piroor/treestyletab/issues/2176#issuecomment-714853450">#2176</a>)</summary>
  
  This is a known issue and hard (or impossible) to be fixed on TST, due to restrictions of WebExtensions API.
  TST cannot detect "a new blank tab is intentionally opened by the user with the keyboard shortcut Ctrl-T", because all new tabs are initially opened with the `about:blank` URL even if you open a new tab from a link.
  Sadly there is no more hint to detect the context how a new tab is opened by you.
  
  For a workaround, you can define a custom shortcut to open a new blank tab with TST's settings: assigning something shortcut for the command "Open a new tab: Child Tab" at the add-ons manager.
  Go to `about:addons` => click the gear button => "Manage Extension Shortcuts" => "Tree Style Tab" => "Show 40 More" => "Open a new tab: Child Tab" => set something shortcut like Ctrl+Alt+T, then you'll get a child tab as expected with the shortcut instead of the default Ctrl-T.
  </details>
* <details><summary>New tab is not opened with expected position and container, when it is opened with a custom URL instead of the default new tab page. (<a href="https://github.com/piroor/treestyletab/issues/2485#issuecomment-719673532">#2485</a>)</summary>
  
  You need to change the TST's option `New Tabs Behavior` => `Basic control for New Blank Tab` => `Guess a newly opened tab as opened by "New Blank Tab" action, when it is opened with the URL` to detect new tabs opened with any custom URL.
  It is `about:newtab` by default for Firefox's native new tabs.

  * If you use any addon providing a fixed custom new tab page (ex. [Momentum](https://addons.mozilla.org/firefox/addon/momentumdash/)), open a new tab and show the developer tool with the keyboard shortcut `Ctrl-Shift-K`, then type `location.href` in the console. You'll see the actual URL of the new tab page like `moz-extension://XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX/dashboard.html`.
    The UUID part is random due to security reasons.
  * If you use [New Tab Override](https://addons.mozilla.org/firefox/addon/new-tab-override/) to set a custom URL for new tabs, you cannot get the actual internal URL of new tabs with the method above, because it is immediately redirected.
    It is `moz-extension://XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX/html/newtab.html`, the UUID part can be found at `about:debugging#/runtime/this-firefox` => `Extensions` => `New Tab Override` => `Internal UUID`.
  </details>
* <details><summary>Tabs become flatten suddenly / tree structure is lost accidentally</summary>
  
  Such a problem may happen sometimes regardless I'm continuously struggling to solve them. Sadly on most cases there is no way to get back lost tree structure. (Sometimes, closing the window and restoring it via Ctrl-Shift-N may restore the window with correct tree structure, but it is effective only on very limited cases.)
  There are some workarounds to save your tree of tabs before you encounter such a situation:

  * [Tab Session Manager](https://addons.mozilla.org/firefox/addon/tab-session-manager/) supports saving sessions with tree information. Please remind that you need to activate compatibility option manually.
  * TST allows you to take a snapshot of tabs tree to a bookmark folder. Select all tabs (via shift-click, ctrl-click, or "Select All Tabs"), and bookmark selected tabs via the "Bookmark Tabs..." command in tabs context menu on the sidebar panel. Created bookmarks will have `>` marks in their title, it means their tree level. Right click on the bookmark folder and choose the command "Open All as a Tree", then TST will open tabs from the bookmark folder with tree structure constructed from the `>` marks of their title.

#### Other topics

* <details><summary>How to <a href="https://github.com/piroor/treestyletab/issues/761">donate</a> to this project?</summary>
  
  Thanks, but sorry, I have no plan about any donation from some reasons.
  
  * The biggest reason is: because I want to keep me as the prime user of this project.
    I want to keep having a privilege to say "no" about requests that do not match my vision.
    My hands are already full with maintenance of Tree Style Tab for my use case.
    (Of course I know that donation is not payment, but I'm afraid that I would think about voices from people who did donation more seriously and it would unconsciously conflict with my policies.)
  * Also, I'm afraid of [social undermining](https://en.wikipedia.org/wiki/Social_undermining).
  * I'm an employee of the [ClearCode Inc.](https://www.clear-code.com/)
    My employer allows me to develop my extensions during business hours, because my job is technical support to customers (enterprise users of Firefox and Thunderbird) and the development increases my skills with Firefox and Thunderbird.
    In other words, my addon projects already have monetary support enoughly.
    Stagnation of my addon projects are mostly caused from technical reasons or lowering of motivation, not monetary reasons.
  
  Any other contribution to this project is welcome - translation, debugging, triaging of issues, and more.
  If you have fixed a bug you met, please send a pull request - I'll merge it.
  If you have different plans about TST, please fork this project freely for your purpose, if needed.
  </details>
