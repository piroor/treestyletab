# Tree Style Tab

This is an addon for Firefox providing tree-like appearance for the tab bar.

## Frequently rejected proposals

I'm very sorry but this addon is strongly concentrated about "tree of tabs". In other words, features not related to "tree of tabs" are out of its purpose. Such features won't be added, even if many people love it. For example:

 * Full support for the horizontal tab bar or non-indented vertical tabs: Basically this is designed to provide vertical indented, deeply nested tree of tabs. Other forms are just bonus, so there is only a few motivation and support for those forms. If you are a heavy user of such forms, bugs appearing only on those forms possibly won't fixed by me. Instead please fix it by your hand and send pull requests to me.
 * High compatibility with [Tab Mix Plus](https://addons.mozilla.org/firefox/addon/tab-mix-plus/), especially its own session management feature: Supporting TMP is very hard, because TMP-enhanced Firefox is totally different from plain Firefox - they are practically different applications. So, it requires hard work to support both applications constantly. Moreover, unfortunately I have very few motivation to maintain TST for TMP, because I'm not a user of TMP. If you are using TST with TMP and get some troubles, those bugs won't be fixed by my hand aggressively. Instead please fix problems you met and send pull requests to me.
 * [Support for Pale Moon](https://github.com/piroor/treestyletab/issues/1043): Pale Moon is based on old Firefox but TST supports only recent versions of official Firefox. Supporting for Pale Moon means supporting for very old Firefox. To keep codes cleaner, I have to remove obsolete codes only for old versions of Firefox. If you require TST for Pale Moon, sorry but please fork this project and rollback to an old revision which can work on Pale Moon.
 * [Ability to show both horizontal and vertical tab bars](https://github.com/piroor/treestyletab/issues/304): It can't be done because TST's vertical tab bar is the Firefox's tab bar itself. In other words, TST just rotates the orientation of the tab bar from horizontal to vertical and completely reuses Firefox's tab bar.
 * [Quick access to the configuration dialog](https://github.com/piroor/treestyletab/issues/1020), Adding new minor (trivial) options, and so on: High customizability for details of features is out of TST's purpose. I hope to provide only very required options which are truly un-omitable. Too many optional features will kill this project, because they will cloud  the important concept of TST and will  bring together people who don't like my core vision about TST. Instead, sorry but please fork this project and modify it for your usecase.
 * [Keyboard shortcut to toggle show/hide of the tab bar](https://github.com/piroor/treestyletab/issues/156)
 * [Sort child tabs](https://github.com/piroor/treestyletab/issues/94)
 * [Configuration UI to change appearance of tabs in the vertical tab bar](https://github.com/piroor/treestyletab/issues/539): Instead please use `userChrome.css`.

