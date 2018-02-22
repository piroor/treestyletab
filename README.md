# Tree Style Tab (aka TST)

This is a Firefox add-on which provides ability to operate tabs as "tree".

New tabs opened from the current tab are automatically organized as "children" of the current.
Such "branches" are easily folded (collapsed) by clicking on down-triangle shown in a "parent" tab, so you don't need to be suffered from too many visible tabs anymore.
If you want, you can restructure the tree via drag and drop.

 * Such a tree of tabs will behave like a visual browsing history for you.
   For example, if you see a list of search results for a topic, you'll open each search result link in new child tab.
   For more details you'll also open more descendant tabs from them.
   You'll easily dig and dig deeply, without lose your browsing trail - if you want to go back to the original search result, you just have to switch to the "root" tab.
 * Moreover, you'll treat tree of tabs just as "grouped tabs" for similar topics.

Anyway this addon just provide uncolored "tree" feature.
Please enjoy as you like!

## Supported versions of Firefox

TST has two main version lines: "renewed" (WebExtensions-based) and "legacy" (XUL-based), and one more extra line: "migration".

 * "Renewed", version 2.0 and later: supports Firefox 57 and later.
   By technical reasons, some features are dropped from the legacy version.
 * "Legacy", version 0.19.x supports only Firefox 52-56.
   Just maintained for people who are not migrated to Firefox 57 or later yet.

## Development builds

There are [automated builds from latest codes](https://piro.sakura.ne.jp/xul/xpi/nightly/).

 * ["Renewed" version 2.x](https://piro.sakura.ne.jp/xul/xpi/nightly/treestyletab-we.xpi)
 * ["Legacy" version 0.19.x](https://piro.sakura.ne.jp/xul/xpi/nightly/treestyletab.xpi)

Packages are not signed so you cannot try them on your Firefox if it is a released or beta version.
On Nightly, you can try them by setting a secret preference `xpinstall.signatures.required` to `false` via `about:config`.

And, you can build custom development build locally. For example, here is steps to build XPI on Ubuntu (native, or WSL on Windows 10):

```bash
$ sudo apt install git nodejs npm
$ git clone --recursive https://github.com/piroor/treestyletab.git
$ cd treestyletab/webextensions
$ make install_dependency
$ make
```

Steps to build specific revision (for example bb467286d58b3da90fd1b2e6ee8a8016e3377b97):

```
$ cd treestyletab/webextensions
$ git checkout bb467286d58b3da90fd1b2e6ee8a8016e3377b97
$ git submodule update
$ make
```

Then you'll see new `.xpi` files at the current directory. You can install such a development build via `about:debugging`. Click `Load Temporary Add-on` button and choose `treestyletab/manifest.json` or a built `.xpi` file.


## Addons extend TST

TST provides some [APIs for other addons](https://github.com/piroor/treestyletab/wiki/API-for-other-addons).
Some addons provide extended behavior to TST's sidebar panel:

 * [Multiple Tab Handler](https://addons.mozilla.org/firefox/addon/multiple-tab-handler/) allows you to select multiple tabs and operate them at a time.
 * [TST-MiddleClick](https://addons.mozilla.org/firefox/addon/tst-middleclick/) allows you to run "undo close tab" command on middle click on the sidebar.
 * [Tree Style Tab Mouse Wheel](https://addons.mozilla.org/firefox/addon/tree-style-tab-mouse-wheel/) allows you to switch active tab by wheel scrolling.
 * [Tree Style Tab Open in Private](https://addons.mozilla.org/firefox/addon/tree-style-tab-open-in-private/) allows you to move the tab to a private mode window.
 * [Tree Style Tab Closed Tabs](https://addons.mozilla.org/firefox/addon/tree-style-tab-closed-tabs/) allows you to restore closed tabs from a menu.
 * [Tab flip for Tree Style Tab](https://addons.mozilla.org/firefox/addon/tab-flip-for-tree-style-tab/) allows you to move focus to the tab previously focused, by clicking on the active tab.

## Similar projects

 * [Tree Tabs](https://addons.mozilla.org/firefox/addon/tree-tabs/):
   Cross-browser, more powerful features, and high customizability.
   (One large difference between TST is: the design strategy.
   TST is aimed to keep it simple and work together with other addons as possible as it can.)
 * [Tab Center Redux](https://addons.mozilla.org/firefox/addon/tab-center-redux/),
   [Vertigo Tabs](https://addons.mozilla.org/firefox/addon/vertigo-tabs/):
   Vertical tab bar without tree.
 * [sidebarTabs](https://github.com/asamuzaK/sidebarTabs):
   Vertical tab bar with grouped tabs.
 * [Tab Sidebar](https://addons.mozilla.org/firefox/addon/tab-sidebar-we/):
   Vertical tab bar with grouped tabs.

Some Google Chrome extensions also provides similar feature.

 * [Sidewise Tree Style Tabs](https://chrome.google.com/webstore/detail/sidewise-tree-style-tabs/biiammgklaefagjclmnlialkmaemifgo)
 * [Tabs Outliner](https://chrome.google.com/webstore/detail/tabs-outliner/eggkanocgddhmamlbiijnphhppkpkmkl)

## If you have any request, proposal, or unexpected trouble from bugs?

All feedbacks are handled as [GitHub issues](https://github.com/piroor/treestyletab/issues).

However, there are some frequently **REJECTED** requests/proposals.
I'm very sorry but this addon is strongly concentrated about "tree of tabs", so features not related to its name are out of purpose.
Such features won't be added, even if many people love it.

Moreover, basically this is my private project and the prime user is me.
Of course I'm ready to merge pull requests by any contributor, but I possibly stay it unmerged when it can break my private usecase.
Then I strongly recommend you to fork this project for your usecase freely.

Here is a lis of some major requests which are reported multiple times but I marked them "won't fix".
Note that some topics are just about "legacy" versions of TST.

### Full support for the non-indented vertical tabs

TST is basically designed to operate tabs as tree nodes, so "flat vertical tabs" is out of purpose.
Instead there are some "vertical tabs" addons, see the "Similar projects" section.

### I don't need automatically organized tree, instead I just want to organize tree by myself

You can deactivate TST's automatic tree organizing behaviors, by some secret preferences:

 1. Go to TST's configuration.
 2. "Development" section.
 3. Turn on the checkbox "Debug mode". Then all internal configurations are listed.
 4. Turn off the checkbox "autoAttach".
 5. Turn off the checkbox "syncParentTabAndOpenerTab".

After that TST never attach new tabs to existing tree automatically.

If you want to drag multiple tabs at once to organize tree, [Multiple Tab Handler](https://addons.mozilla.org/firefox/addon/multiple-tab-handler/) will help you.

### Full support for the horizontal tab bar

TST is implemented as just a sidebar panel, so there is no chance to provide horizontal version.

### Better context menu on tabs - full featured, expanded outside of the sidebar, accesskeys, and so on

Due to WebExtensions API's limitation, it is currently impossible to provide native context menu for tabs on the sidebar. See also:

 * [1280347 - Add ability to provide custom HTML elements working as alias of existing Firefox UI items, especially tabs](https://bugzilla.mozilla.org/show_bug.cgi?id=1280347)
 * [1376251 - Allow sidebar extensions access to native tab context menu](https://bugzilla.mozilla.org/show_bug.cgi?id=1376251)

And, there is another bug for accesskey support of context menu items:

 * [1320462 - Add ability to set access key to context menu item](https://bugzilla.mozilla.org/show_bug.cgi?id=1320462)

As described at the [migration story of TST](http://piro.sakura.ne.jp/latest/blosxom/mozilla/extension/treestyletab/2017-10-03_migration-we-en.htm#topic2017-10-03_migration-we-en), current context menu in the sidebar is just a workaround, until any genuine WebExtensions feature to do that is landed. So I have very less motivation to improve the fake context menu by myself, sorry...

### [Support for Pale Moon](https://github.com/piroor/treestyletab/issues/1043) or Waterfox

Both Pale Moon and Waterfox are based on old Firefox but TST supports only recent versions of official Firefox.
Supporting for these forked Firefox means supporting for very old Firefox.
To keep codes cleaner, I have to remove obsolete codes only for old versions of Firefox.

If you require TST for Pale Moon or Waterfox, sorry but please fork this project and rollback to an old revision which can work on them. Actually, there seems to be [a forked version of TST for Pale Moon](https://github.com/oinkin/treestyletab).

### [Quick access to the configuration dialog](https://github.com/piroor/treestyletab/issues/1020), Adding new minor (trivial) options, and so on

I have no plan to add a custom menu item to go to TST's configuration dialog - sorry but you have to go to the dialog via Firefox's Addons Manager always.
If the configuration dialog is frequently required in your daily use, there is something implicit problem which must be solved in another way.
Instead, please describe why you need such a fast pass to the configuration dialog.
After the actual problem is solved, you won't need such a menu anymore.
In other words, adding such a menu can disguise fatal problems which really should be solved.

And, high customizability for details of features is out of TST's purpose.
I want to provide only very required options which are truly un-omitable.
Too many optional features will kill this project, because they will cloud the important concept of TST and will bring together people who don't like my core vision about TST.
Instead, sorry but please fork this project and modify it for your usecase.

### Adding new options to control where new tabs are opened from [links](https://github.com/piroor/treestyletab/issues/1052) or [bookmarks](https://github.com/piroor/treestyletab/issues/263)

In most cases - subjectively 99%, new tabs from links may be related to the source tab, and tabs from bookmarks may not be related to the current tab.
For other rare cases - if you want to open the link in new sibling tab, or you want to open a bookmark as a child tab of the current, then you can do it by dragging a link or bookmark and drop it onto a tab or between tabs.
Natural operations for GUI objects shoud be optimized for most major usecases.

Too high customizability for such rare usecases will just make you happy, but others including me won't - they are just confused that "why such too much choices are here?"

### Keyboard shortcuts for TST's custom functions, for example, toggle show/hide of the sidebar, operations to modify tree, and so on

Due to limitations of WebExtensions APIs, the keyboard shortcut to toggle show/hide the sidebar is not changable.
See also:

 * [1215061 - Better keyboard shortcut support](https://bugzilla.mozilla.org/show_bug.cgi?id=1215061)
 * [1303384 - UI for re-assigning command shortcuts](https://bugzilla.mozilla.org/show_bug.cgi?id=1303384 )
 * [1320332 - Support overriding existing keybinding through WebExtensions](https://bugzilla.mozilla.org/show_bug.cgi?id=1320332)
 * [1348589 - \[commands\] Support dynamic commands](https://bugzilla.mozilla.org/show_bug.cgi?id=1348589)
 * [1421811 - Provide a way for an extension to update the shortcut for its command](https://bugzilla.mozilla.org/show_bug.cgi?id=1421811)

And, because Firefox already have [very large number of keyboard shortcuts](https://support.mozilla.org/kb/keyboard-shortcuts-perform-firefox-tasks-quickly), I have no plan to provide various shortcuts for TST's each feature by default.
In future versions, if generic keyboard shortcut customizability is introduced Firefox, I'll define optional commands for user-defined keyboard shortcuts.

### High-power management of tree, like [sorting child tabs](https://github.com/piroor/treestyletab/issues/94), [auto-modification of tree](https://github.com/piroor/treestyletab/issues/509), [renaming of tabs](https://github.com/piroor/treestyletab/issues/794), and so on

I believe that generally "tree of tabs should be a visualized history of web browsing", because they are built on relations where you came from.
Possibly such a tree is facially chaotic, but it just mirrors your actual footmarks, so you'll easily find out where is the target tab based on a map in your mind. Moreover, those relations themselves may let you recall forgotten idea you thought while you were browsing those tabs.

On the other hand, sorted tabs based on URLs or something will be beautiful - but that's all.
Such sorted tabs won't help me - I'm very forgetful.
In other words, I just need something which memorizes my chaotic mind as-is.

By the way, my another addon [Multiple Tab Handler](https://addons.mozilla.org/firefox/addon/multiple-tab-handler/) will help you if you frequently modify tree by drag and drop.
It provides ability to select multiple tabs by Ctrl-Click or Shift-Click and you can drag selected tabs at once.

### Configuration UI to change appearance of tabs in the vertical tab bar, for example, [color](https://github.com/piroor/treestyletab/issues/539), [height](https://github.com/piroor/treestyletab/issues/236), [visibility of the scrollbar](https://github.com/piroor/treestyletab/issues/514), [transparency of tabs](https://github.com/piroor/treestyletab/issues/651), and so on

There is a plan to implement an input field to write custom CSS rules, so it will work like as `userChrome.css`.
See the [code snippets](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-style-rules) and [details of inspectation for the sidebar contents](https://github.com/piroor/treestyletab/issues/1725#issuecomment-359856516).

### [Donation](https://github.com/piroor/treestyletab/issues/761)

Thanks, but sorry, I have no plan about any donation from some reasons.
The largest reason is: because I want to keep me as the prime user of this project.
I want to keep having a privilege to say "no" about requests not matched to my vision.
My hand is already full to maintain this addon for my usecase.

If you fixed a bug you met, please send a pull request - I'll merge it.
If you have different plan about TST, please fork this project freely for your purpose, if needed.

