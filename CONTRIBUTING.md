# Tree Style Tab Contribution Guideline

If you are planning to open a new issue for a bug report or a feature request, or having additional information for an existing issue, or hoping to translate the language resource for your language, then please see this document before posting.

This is possibly a generic guideline for contributing any Firefox addon project or a public OSS/free software project.

## Good, helpful bug reports including feature requests

A good report is the fastest way to solve a problem.
Even if the problem is very clear for you, it is potentially unclear to me.
Unclear report can be left unfixed for long time.
You'll see [a guidance to minimize conditions to reproduce the problem](
https://github.com/piroor/treestyletab/wiki/How-to-minimize-conditions-to-reproduce-a-problem), an example of [good report](https://github.com/piroor/treestyletab/issues/1134) and [another report with too little information](https://github.com/piroor/treestyletab/issues/1135).

Here is a list of typical questions I asked to existing reports:

 * **Does the problem appear with the [latest develpment build](http://piro.sakura.ne.jp/xul/xpi/nightly/)?**
   Possibly, problems you met have been resolved already.
   On Firefox 48 and later, you'll have to use an [unbranded Firefox](https://wiki.mozilla.org/Add-ons/Extension_Signing#Unbranded_Builds) (including Beta, Aurora, and Nightly) with a secret preference `xpinstall.signatures.required`=`false` (you can set it via `about:config`), to try unsigned development builds.
 * **Does the problem appear without some other tab-related add-on?**
   If a compatibility issue with other addons is reported without such information, it can be very hard to resolve.
   See also the next to next.
 * **Is the "problem" really introduced by TST?**
   If you use TST with other add-ons, please confirm which add-on causes the problem you met - TST or one of others.
   If the problem doesn't appear with no other addon, it can be introduced by others.
   See also the next.
 * **Does the problem appear with a clean profile?**
   You can start Firefox with temporary clean profile by a command line. See also the document [How to run Firefox with a clean profile](https://github.com/piroor/treestyletab/wiki/How-to-run-Firefox-with-a-clean-profile).
   If the problem doesn't appear with a clean profile, please try to find complete reproduction steps out through changing configs, installing add-ons, and other customizations.
   - You can export/import all options except keybaord shortcuts, via TST's options => `Development` => `All Configs` => `Export` and `Import`. If you cannot reproduce the problem with a clean profile, please export configs on your regular profile and attach it to the issue.
 * **Is the main topic single and clear?**
   Sometimes I get an issue including multiple topics, but such an issue is hard to be closed, and it often stays opened for long time and confuses me.
   If you have multiple topics, please report them as separate issues for each.

For future requests, some more important information:

 * **Did you find other add-on which provide the feature you are going to request?**
   If there is any other add-on for the purpose, then TST should become compatible to it instead of merging the feature into TST itself.
 * **Please add `[feature request]` tag into the summary.**
   Sometimes a feature request can be misunderstood as a simple bug report.

Then, please report the bug with these information:

 * **Detailed steps to reproduce the problem.** For example:
   1. Prepare Firefox version XX with plain profile.
   2. Install Tree Style Tab version XXXX.
   3. Install another add-on XXXX version XXXX from "http://....".
   4. Click a button on the toolbar.
   5. ...
 * **Expected result.**
   If you have any screenshot or screencast, it will help me more.
 * **Actual result.**
   If you have any screenshot or screencast, it will help me more.
 * **Platform information.**
   If the problem appear on your multiple platforms, please list them.

If your issue is related to tree strucutre, figures or screenshots will help me a lot, like:

```
A
\- B (collapsed)
C
\- D
E (selected)
```

[Here is an example issue I created.](https://github.com/piroor/treestyletab/issues/2267)

## Please don't join an existing discussion if your problem is different from the originally reported one

Even if the result is quite similar, they may be different problem if the reproduction steps for yours are different from the one originally reported.
You should create a new issue for yours, instead of adding comment to the existing issue.
Otherwise, I'll be confused if the original reporter said "the issue is a compatibility issue with another add-on" but another reporter said "I saw this problem without any other add-on".

To avoid such a confusion, please post your report with detailed reproduction steps always.

## Feature requests can be tagged as "out of purpose"

Please see [the readme page](./README.md) before you post a new feature request.
Even if a requested feature is very useful, it is possibly rejected by the project policy.

Instead, please tell me about other add-ons which provide the feature and report a new issue as "compatibility issue with the add-on, TST should work together with it".
I'm very positive to making TST compatible with other add-ons.

## Translations, pull requests

If you've fixed a problem you met by your hand, then please send a pull request to me.

Translations also.
Pull requests are easier to merge than sending ZIP files.
You can do it without any local application - you can do it on the GitHub.
For example, if you want to fix an existing typo in a locale, you just have to click the pencil button (with a tooltip "Edit this file") for a language resource file.

