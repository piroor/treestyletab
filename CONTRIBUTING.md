# Tree Style Tab contribution guide

## Good, helpful bug reports

A good report is the fastest way to solve a problem.
Even if the problem is very clear for you, possibly unclear for me.
Unclear report can be left unfixed for long time.

Before you open a new issue to report a bug, please see following checklist.

 * Does the problem appear with the [latest develpment build](http://piro.sakura.ne.jp/xul/xpi/nightly/)?
   Possibly, problems you met has been resolved already.
   On Firefox 43 and later you need to set `xpinstall.signatures.required` to `false` via `about:config`.
   For Firefox 46 and later, you'll have to try an unbranded Firefox (including Beta, Aurora, and Nightly) to try development builds because the option will be removed on official Firefox 46 and later.
 * Does the problem appear without Tab Mix Plus or something other tab related addon?
   If a compatibility issue with other addons is reported without such information, it is very hard to be resolved.
   See also the next.
 * Does the problem appear with a clean profile?
   You can start Firefox with temporary clean profile by a command line `-profile`, like: `"C:\Program Filex (x86)\Mozilla Firefox\firefox.exe" -no-remote -profile "%Temp%\FirefoxTemporaryProfile"`

Then, please report the bug with these information:

 * Detailed steps to reproduce the problem. For example:
   1. Prepare Firefox version XX with plain profile.
   2. Install TST version XXXX.
   3. Install another addon XXXX version XXXX from "http://....".
   4. Click a button on the toolbar.
   5. ...
 * Expected result.
 * Actual result.
 * Platform information.
   If the problem appear on your multiple platforms, please list them.
 * Screenshot images or screencast, if possible.

## Feature requests can be tagged as "out of purpose"

Please see [the readme page](./README.md) before you post a new feature request.
Even if a requested feature is very useful, it is possibly rejected by the project policy.

Instead, please tell me other addon which provide the feature and report a new issue as "compatibility issue with the addon, TST should work together with it".

## Translations, pull requests

If you've fixed a problem you met by your hand, then please send the difference as a pull request.

And, if you translated TST for your language, please feedback it for me as a pull request.
You'll be able to do it without any local application - you can do it on the GitHub.
