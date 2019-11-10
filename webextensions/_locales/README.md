# Notes for translators

There are some helper utilities for translations.

 * [ChromeExtensionI18nHelper for Sublime Text plug-in](https://github.com/Harurow/sublime_chromeextensioni18nhelper): it is designed for Google Chrome extensions, but it is also available WebExtensions-based Firefox addons.
 * [web-ext-translator](https://www.npmjs.com/package/web-ext-translator): a Java-based editor for translators.

If you want to know changes in the main `en` locale, you can compare the latest code with any specific version. For example, changes from the version 3.2.0 is: [https://github.com/piroor/treestyletab/compare/3.2.0...master](https://github.com/piroor/treestyletab/compare/3.2.0...master)

Sadly GitHub doesn't provide ability to show the difference between two revisions about single file, but you can see that with the raw `git` command. For example if you want to see changes of the English resource from the version 3.2.0 to the latest revision:

```bash
$ git diff 3.2.0 master -- webextensions/_locales/en/messages.json
```
