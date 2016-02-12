# Tree Style Tab

This is an addon for Firefox providing tree-like appearance for the tab bar.

## Frequently **REJECTED** proposals

I'm very sorry but this addon is strongly concentrated about "tree of tabs". In other words, features not related to "tree of tabs" are out of its purpose. Such features won't be added, even if many people love it. For example...

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

### [Keyboard shortcut to toggle show/hide of the tab bar](https://github.com/piroor/treestyletab/issues/156)

The feature is included in TST mainly to simulate Firefox's default behavior in the fullscreen mode (started by the `F11` key). Is there any keyboard shortcut to show/hide the navigation toolbar?

### [Sort child tabs](https://github.com/piroor/treestyletab/issues/94)

### Configuration UI to change appearance of tabs in the vertical tab bar, for example, [color](https://github.com/piroor/treestyletab/issues/539), [height](https://github.com/piroor/treestyletab/issues/236), and so on

Instead please use the `userChrome.css`. TST should have configuration UIs only for something it can't be done by any other existing customization feature.
