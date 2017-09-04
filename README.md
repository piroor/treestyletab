# Tree Style Tab (aka TST)

This is a Firefox add-on which provides ability to operate tabs as "tree".

New tabs opened from the current tab are automatically organized as "children" of the current.
Such "branches" are easily folded (collapsed) by clicking on down-triangle shown in a "parent" tab, so you don't need to be suffered from too many visible tabs anymore.
If you hope, you can restructure the tree via drag and drop.

 * Such a tree of tabs will behave like a visual browsing history for you.
   For example, if you see a list of search results for a topic, you'll open each search result link in new child tab.
   For more details you'll also open more descendant tabs from them.
   You'll easily dig and dig deeply, without lose your browsing trail - if you hope to go back to the original search result, you just have to switch to the "root" tab.
 * Moreover, you'll treat tree of tabs just as "grouped tabs" for similar topics.

Anyway this addon just provide uncolored "tree" feature.
Please enjoy as you like!

## Supported versions of Firefox

TST has two main version lines: "renewed" (WebExtensions-based) and "legacy" (XUL-based), and one more extra line: "migration".

 * ([In development](https://github.com/piroor/treestyletab/issues/1224#issuecomment-326467198)) "Renewed", version 2.0 and later: supports Firefox 57 and later.
   By technical reasons, some fatures are dropped from the legacy version.
 * (Currently released) "Legacy", version 0.19.x supports only Firefox 52-56.
   Just maintained for people who are not migrated to Firefox 57 or later yet.
 * ([Not available yet](https://github.com/piroor/treestyletab/issues/1344)) "Migration", version 0.99.x will support only Firefox 56.
   This will just migrate configuration and tree information from legacy to renewed.
   It will be updated to the renewed version to complete the migration process.

## Development builds

There are [automated builds from latest codes](http://piro.sakura.ne.jp/xul/xpi/nightly/).

 * ["Renewed" version 2.0a](http://piro.sakura.ne.jp/xul/xpi/nightly/treestyletab-we.xpi)
 * ["Legacy" version 0.19.x](http://piro.sakura.ne.jp/xul/xpi/nightly/treestyletab.xpi)

Packages are not signed so you cannot try them on your Firefox if it is a released or beta version.
On Nightly, you can try them by setting a secret preference `xpinstall.signatures.required` to `false` via `about:config`.

## Similar projects

 * [Tree Tabs](https://addons.mozilla.org/firefox/addon/tree-tabs/):
   Cross-browser, more powerful faatures, and high customizability.
   (One large difference between TST is: the design strategy.
   TST is aimed to keep it simple and work together with other addons as possible as it can.)
 * [Tab Center Redux ](https://addons.mozilla.org/firefox/addon/tab-center-redux/):
   Vertical tab bar without tree.
 * [sidebarTabs](https://github.com/asamuzaK/sidebarTabs):
   Vertical tab bar with grouped tabs.

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

### Full support for the horizontal tab bar or non-indented vertical tabs

"Renewed" TST is implemented as just a sidebar panel, so there is no chance to provide horizontal version.

Basically "legacy" TST is designed to provide vertical indented, deeply nested tree of tabs.
There is only limited support for non-tree mode.
If you just require the vertical tab bar and you never use "tree of tabs", then please try other alternative addons:

 * [Vertical Tabs (Simplified)](https://addons.mozilla.org/firefox/addon/vertical-tabs-simplified/)
 * [Vertical Tabs Reloaded](https://addons.mozilla.org/firefox/addon/vertical-tabs-reloaded/)
 * [Side Tabs](https://addons.mozilla.org/firefox/addon/side-tabs/)

And, horizontal tab bar is just a bonus.
If you are a heavy user of the horizontal tab bar, then bugs appearing only on it won't be fixed by me.
Instead please fix it by your hand and send pull requests to me.

### High compatibility with [Tab Mix Plus](https://addons.mozilla.org/firefox/addon/tab-mix-plus/), especially its own session management feature

"Renewed" TST works inside the sidebar, so it works separatedly from (legacy) TMP.

Supporting TMP by "legacy" TST is very hard, because TMP-enhanced Firefox is totally different from plain Firefox - they are practically different applications.
So, it requires hard work to support both applications constantly.
Moreover, unfortunately I have very few motivation to maintain TST for TMP, because I'm not a user of TMP.
If you are using TST with TMP and get some troubles, those bugs won't be fixed by my hand aggressively.

Instead please fix problems you met and send pull requests to me.

### [Support for Pale Moon](https://github.com/piroor/treestyletab/issues/1043)

Pale Moon is based on old Firefox but TST supports only recent versions of official Firefox.
Supporting for Pale Moon means supporting for very old Firefox.
To keep codes cleaner, I have to remove obsolete codes only for old versions of Firefox.

If you require TST for Pale Moon, sorry but please fork this project and rollback to an old revision which can work on Pale Moon.

### [Ability to show both horizontal and vertical tab bars](https://github.com/piroor/treestyletab/issues/304)

"Renewed" TST is just a sidebar panel, so you'll see both horizontal tab bar and vertical tree.

"Legacy" TST can't do it because TST's vertical tab bar is the Firefox's tab bar itself.
In other words, TST just rotates the orientation of the tab bar from horizontal to vertical and completely reuses Firefox's tab bar.
It is not another new sidebar, TST doesn't hide Firefox's original tab bar.
It is still there.

If you really want to show both horizontal and vertical tab bar, then please uninstall legacy TST and install any other addon which provides a custom sidebar panel to show tabs vertically.

### [Quick access to the configuration dialog](https://github.com/piroor/treestyletab/issues/1020), Adding new minor (trivial) options, and so on

I have no plan to add a custom menu item to go to TST's configuration dialog - sorry but you have to go to the dialog via Firefox's Addons Manager always.
If the configuration dialog is frequently required in your daily use, there is something implicit problem which must be solved in another way.
Instead, please describe why you need such a fast pass to the configuration dialog.
After the actual problem is solved, you won't need such a menu anymore.
In other words, adding such a menu can disguise fatal problems which really should be solved.

And, high customizability for details of features is out of TST's purpose.
I hope to provide only very required options which are truly un-omitable.
Too many optional features will kill this project, because they will cloud the important concept of TST and will bring together people who don't like my core vision about TST.
Instead, sorry but please fork this project and modify it for your usecase.

### Adding new options to control where new tabs are opened from [links](https://github.com/piroor/treestyletab/issues/1052) or [bookmarks](https://github.com/piroor/treestyletab/issues/263)

In most cases - subjectively 99%, new tabs from links may be related to the source tab, and tabs from bookmarks may not be related to the current tab.
For other rare cases - if you want to open the link in new sibling tab, or you want to open a bookmark as a child tab of the current, then you can do it by dragging a link or bookmark and drop it onto a tab or between tabs.
Natural operations for GUI objects shoud be optimized for most major usecases.

Too high customizability for such rare usecases will just make you happy, but others including me won't - they are just confused that "why such too much choices are here?"

### Keyboard shortcuts for TST's custom functions, for example, [toggle show/hide of the tab bar](https://github.com/piroor/treestyletab/issues/156), [close a tree](https://github.com/piroor/treestyletab/issues/274), [operations to modify tree](https://github.com/piroor/treestyletab/issues/772), [moving focus](https://github.com/piroor/treestyletab/issues/836), and so on

This topic is strongly written for "legacy" TST.

Firefox already have [very large number of keyboard shortcuts](https://support.mozilla.org/kb/keyboard-shortcuts-perform-firefox-tasks-quickly), and other addons also provide their own keyboard shortcuts, I cannot find out safe combinations for my features.
So I gave up and decided to provide only [APIs for other addons](http://piro.sakura.ne.jp/xul/_treestyletab.html.en#api).
Please use generic addons to customize keyboard shortcuts which can define custom actions based on scripts.
Sorry.
See [the code snippets](https://github.com/piroor/treestyletab/wiki/Code-snippets-for-custom-keyboard-shortcuts) also.

By the way, "auto hide tab bar" feature doesn't provide any its own keyboard shortcut to toggle it because the feature is included in TST mainly to simulate Firefox's default behavior in the fullscreen mode (started by the `F11` key).
Is there any keyboard shortcut to show/hide the navigation toolbar?

### High-power management of tree, like [sorting child tabs](https://github.com/piroor/treestyletab/issues/94), [auto-modification of tree](https://github.com/piroor/treestyletab/issues/509), [renaming of tabs](https://github.com/piroor/treestyletab/issues/794), and so on

I believe that generally "tree of tabs should be a visualized history of web browsing", because they are built on relations where you came from.
Possibly such a tree is facially chaotic, but it just mirrors your actual footmarks, so you'll easily find out where is the target tab based on a map in your mind. Moreover, those relations themselves may let you recall forgotten idea you thought while you were browsing those tabs.

On the other hand, sorted tabs based on URLs or something will be beautiful - but that's all.
Such sorted tabs won't help me - I'm very forgetful.
In other words, I just need something which memorizes my chaotic mind as-is.

By the way, my another addon [Multiple Tab Handler](https://addons.mozilla.org/firefox/addon/multiple-tab-handler/) will help you if you frequently modify tree by drag and drop.
It provides ability to select multiple tabs by Ctrl-Click or Shift-Click and you can drag selected tabs at once.

### Configuration UI to change appearance of tabs in the vertical tab bar, for example, [color](https://github.com/piroor/treestyletab/issues/539), [height](https://github.com/piroor/treestyletab/issues/236), [visibility of the scrollbar](https://github.com/piroor/treestyletab/issues/514), [transparency of tabs](https://github.com/piroor/treestyletab/issues/651), and so on

On "legacy" TST, please use the `userChrome.css` or `about:config` instead of such detailed configuration UIs.
TST should have configuration UIs only for something it can't be done by any other existing customization feature.
[The list of all legacy TST's preferences including secret items is available.](https://github.com/piroor/treestyletab/blob/master/defaults/preferences/treestyletab.js)

On "Renewed" TST, there is a plan to implement an input field to write custom CSS rules, so it will work like as `userChrome.css`.

### [Ability to disable animation effects around tabs](https://github.com/piroor/treestyletab/issues/499)

"Renewed" TST has the option. See its configurations.

"Legacy" TST doesn't have such an option.
[If Firefox introduces new preference to disable tab animations](https://bugzilla.mozilla.org/show_bug.cgi?id=556717), I'll apply it for TST too.
Otherwise I have no plan to implement such a "no animation mode", because it will make TST more far from Firefox's plain codes.
Now I have only a few resources to maintain TST, so I don't want to increase the risk that I give up to update TST for future versions of Firefox which will be continuously modified.

### [Donation](https://github.com/piroor/treestyletab/issues/761)

Thanks, but sorry, I have no plan about any donation because I hope to keep me as the prime user of this project.
I hope to keep having a privilege to say "no" about requests not matched to my vision.
My hand is already full to maintain this addon for my usecase.

If you fixed a bug you met, please send a pull request - I'll merge it.
If you have different plan about TST, please fork this project freely for your purpose, if needed.

### [Fully-reviewed on Mozilla Add-ons](https://github.com/piroor/treestyletab/issues/793)

"Renewed" TST will be published for all people, because it is built only on clean, Mozilla-recommended technologies.

"Legacy" TST never been published as a "full-reviewed" addon on AMO, because there is one unavoidable issue: TST doesn't match to the policy of AMO.

In 2010, AMO editors decided to reject Tree Style Tab and some my other addons as "bad" addons, because they were against AMO policies - mainly, they used many `eval()` to inject custom codes into functions defined by Firefox itself.
Because there are less APIs for addons like TST, I still have to use `eval()` to do it.
[I wrote an objection for this topic, in years ago.](http://piro.sakura.ne.jp/latest/blosxom/mozilla/xul/2010-02-08_eval-en.htm)

If the review policy was changed or relaxed, I'm ready to request full review again.
Otherwise, my request won't be accepted...

To be honest, I agree that TST possibly should not be published as a full-reviewed addon, by AMO policy.
TST is too fragile from many tricky hacks.
Moreover, actually, too many `eval()` make my addon hard to be reviewed.
So, I even think it is better that my addon is kept in sandbox with quick updates, than slow updates from every full-review processes taking much time.
