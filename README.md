# Tree Style Tab

This is an addon for Firefox providing tree-like appearance for the tab bar.

## Frequently rejected proposals

I'm very sorry but this addon is strongly concentrated about "tree of tabs". In other words, features not related to "tree of tabs" are out of its purpose. Such features won't be added, even if many people love it. For example:

 * High compatibility with [Tab Mix Plus](https://addons.mozilla.org/firefox/addon/tab-mix-plus/), especially its own session management feature: Supporting TMP is very hard, because TMP-enhanced Firefox is totally different from plain Firefox - they are practically different applications. So, it requires hard work to support both applications constantly. Moreover, unfortunately I have very few motivation to maintain TST for TMP, because I'm not a user of TMP. If you are using TST with TMP and get some troubles, those bugs won't be fixed by my hand aggressively. Instead please fix problems you met and send me pull requests.
 * [Ability to show both horizontal and vertical tab bars](https://github.com/piroor/treestyletab/issues/304): It can't be done because TST's vertical tab bar is the Firefox's tab bar itself. In other words, TST just rotates the orientation of the tab bar from horizontal to vertical and completely reuses Firefox's tab bar.
 * [Quick access to the configuration dialog](https://github.com/piroor/treestyletab/issues/1020)
 * [Keyboard shortcut to toggle show/hide of the tab bar](https://github.com/piroor/treestyletab/issues/156)
 * [Sort child tabs](https://github.com/piroor/treestyletab/issues/94)
 * [Configuration UI to change appearance of tabs in the vertical tab bar](https://github.com/piroor/treestyletab/issues/539): Instead please use `userChrome.css`.

