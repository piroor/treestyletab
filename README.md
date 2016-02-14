# Tree Style Tab

This is an addon for Firefox providing tree-like appearance for the tab bar.

## Frequently **REJECTED** requests/proposals

I'm very sorry but this addon is strongly concentrated about "tree of tabs", so features not related to "tree of tabs" are out of its purpose. Such features won't be added, even if many people love it.

Moreover, basically this is my private project and the prime user is me. Of course I'm ready to merge pull requests by any contributor, but I possibly stay it unmerged when it can break my private usecase. Then I strongly recommend you to fork this project for your usecase freely.

There are some major requests which are reported multiple times but I marked them "won't filx". For example...

### Full support for the horizontal tab bar or non-indented vertical tabs

Basically this is designed to provide vertical indented, deeply nested tree of tabs. Other forms are just bonus, so there is only a few motivation and support for those forms.

If you are a heavy user of such forms, bugs appearing only on those forms possibly won't fixed by me. Instead please fix it by your hand and send pull requests to me.

### High compatibility with [Tab Mix Plus](https://addons.mozilla.org/firefox/addon/tab-mix-plus/), especially its own session management feature

Supporting TMP is very hard, because TMP-enhanced Firefox is totally different from plain Firefox - they are practically different applications. So, it requires hard work to support both applications constantly. Moreover, unfortunately I have very few motivation to maintain TST for TMP, because I'm not a user of TMP. If you are using TST with TMP and get some troubles, those bugs won't be fixed by my hand aggressively.

Instead please fix problems you met and send pull requests to me.

### [Support for Pale Moon](https://github.com/piroor/treestyletab/issues/1043)

Pale Moon is based on old Firefox but TST supports only recent versions of official Firefox. Supporting for Pale Moon means supporting for very old Firefox. To keep codes cleaner, I have to remove obsolete codes only for old versions of Firefox.

If you require TST for Pale Moon, sorry but please fork this project and rollback to an old revision which can work on Pale Moon.

### [Ability to show both horizontal and vertical tab bars](https://github.com/piroor/treestyletab/issues/304)

It can't be done because TST's vertical tab bar is the Firefox's tab bar itself. In other words, TST just rotates the orientation of the tab bar from horizontal to vertical and completely reuses Firefox's tab bar. It is not another new sidebar, TST doesn't hide Firefox's original tab bar. It is still there.

If you really want to show both horizontal and vertical tab bar, then please uninstall TST and install any other addon which provides a custom sidebar panel to show tabs vertically.

### [Quick access to the configuration dialog](https://github.com/piroor/treestyletab/issues/1020), Adding new minor (trivial) options, and so on

High customizability for details of features is out of TST's purpose. I hope to provide only very required options which are truly un-omitable. Too many optional features will kill this project, because they will cloud the important concept of TST and will bring together people who don't like my core vision about TST. Instead, sorry but please fork this project and modify it for your usecase.

### Adding new options to control where new tabs are opened from [links](https://github.com/piroor/treestyletab/issues/1052) or [bookmarks](https://github.com/piroor/treestyletab/issues/263)

In most cases - subjectively 99%, new tabs from links may be related to the source tab, and tabs from bookmarks may not be related to the current tab. For other rare cases - if you want to open the link in new sibling tab, or you want to open a bookmark as a child tab of the current, then you can do it by dragging a link or bookmark and drop it onto a tab or between tabs. Natural operations for GUI objects shoud be optimized for most major usecases.

Too high customizability for such rare usecases will just make you happy, but others including me won't - they are just confused that "why such too much choices are here?"

### Keyboard shortcuts, for example, [toggle show/hide of the tab bar](https://github.com/piroor/treestyletab/issues/156), [operations to modify tree](https://github.com/piroor/treestyletab/issues/772), [moving focus](https://github.com/piroor/treestyletab/issues/836), and so on

The feature is included in TST mainly to simulate Firefox's default behavior in the fullscreen mode (started by the `F11` key). Is there any keyboard shortcut to show/hide the navigation toolbar?

### High-power management of tree, like [sorting child tabs](https://github.com/piroor/treestyletab/issues/94), [auto-modification of tree](https://github.com/piroor/treestyletab/issues/509), and so on

I believe that generally "tree of tabs should be a visualized history of web browsing", because they are built on relations where you came from. Possibly such a tree is facially chaotic, but it just mirrors your actual footmarks, so you'll easily find out where is the target tab based on a map in your mind. Moreover, those relations themselves may let you recall forgotten idea you thought while you were browsing those tabs.

On the other hand, sorted tabs based on URLs or something will be beautiful - but that's all. Such sorted tabs won't help me - I'm very forgetful. In other words, I just need something which memorizes my chaotic mind as-is.

### Configuration UI to change appearance of tabs in the vertical tab bar, for example, [color](https://github.com/piroor/treestyletab/issues/539), [height](https://github.com/piroor/treestyletab/issues/236), [visibility of the scrollbar](https://github.com/piroor/treestyletab/issues/514), [transparency of tabs](https://github.com/piroor/treestyletab/issues/651), and so on

Instead please use the `userChrome.css`. TST should have configuration UIs only for something it can't be done by any other existing customization feature.

### Keyboard shortcuts for TST's custom functions, for example, [close a tree](https://github.com/piroor/treestyletab/issues/274)

Firefox already have [very large number of keyboard shortcuts](https://support.mozilla.org/kb/keyboard-shortcuts-perform-firefox-tasks-quickly), and other addons also provide their own keyboard shortcuts, I cannot find out safe combinations for my features. So I gave up and decided to provide only [APIs for other addons](http://piro.sakura.ne.jp/xul/_treestyletab.html.en#api). Please use generic addons to customize keyboard shortcuts which can define custom actions based on scripts. Sorry.

### [Ability to disable animation effects around tabs](https://github.com/piroor/treestyletab/issues/499)

[If Firefox introduces new preference to disable tab animations](https://bugzilla.mozilla.org/show_bug.cgi?id=556717), I'll apply it for TST too. Otherwise I have no plan to implement such a "no animation mode", because it will make TST more far from Firefox's plain codes. Now I have only a few resources to maintain TST, so I don't want to increase the risk that I give up to update TST for future versions of Firefox which will be continuously modified.

### [Donation](https://github.com/piroor/treestyletab/issues/761)

Thanks, but sorry, I have no plan about any donation because I hope to keep me as the prime user of this project. I hope to keep having a privilege to say "no" about requests not matched to my vision. My hand is already full to maintain this addon for my usecase.

If you fixed a bug you met, please send a pull request - I'll merge it. If you have different plan about TST, please fork this project freely for your purpose, if needed.

### [Fully-reviewed on Mozilla Add-ons](https://github.com/piroor/treestyletab/issues/793)

I think TST never been published as a "full-reviewed" addon on AMO, because there is one unavoidable issue: TST doesn't match to the policy of AMO.

In 2010, AMO editors decided to reject Tree Style Tab and some my other addons as "bad" addons, because they were against AMO policies - mainly, they used many `eval()` to inject custom codes into functions defined by Firefox itself. Because there are less APIs for addons like TST, I still have to use `eval()` to do it. [I wrote an objection for this topic, in years ago.](http://piro.sakura.ne.jp/latest/blosxom/mozilla/xul/2010-02-08_eval-en.htm)

If the review policy was changed or relaxed, I'm ready to request full review again. Otherwise, my request won't be accepted...

To be honest, I agree that TST possibly should not be published as a full-reviewed addon, by AMO policy. TST is too fragile from many tricky hacks. Moreover, actually, too many `eval()` make my addon hard to be reviewed. So, I even think it is better that my addon is kept in sandbox with quick updates, than slow updates from every full-review processes taking much time.
