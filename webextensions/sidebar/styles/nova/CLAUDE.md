# Update policy for the nova/ directory

This directory mixes files copied (verbatim or partially adapted) from Firefox's own CSS (the Nova design)
with CSS that is original to Tree Style Tab (TST).

- **`nova.css` is the only file original to TST. It is not copied from Firefox.**
- Every other file is copied from Firefox's own source. Each such file starts with a comment giving the
  permalink at the time it was fetched, in the form:
  `/* https://searchfox.org/firefox-main/rev/<revision hash>/<original file path> */`

This document summarizes the procedure for updating that set of copied files against the latest Firefox
source, so that an AI agent such as Claude Code can reproduce it.

## Target files and their origin

| Local file | Origin (path in mozilla-firefox/firefox) |
| --- | --- |
| `tokens-shared.css` | `toolkit/themes/shared/design-system/dist/tokens-shared.css` |
| `toolbar.css` | `toolkit/themes/shared/design-system/src/toolbar.css` |
| `tabs.css` | `browser/themes/shared/tabbrowser/tabs.css` |
| `tab.tokens.css` | `browser/themes/shared/tabbrowser/tab.tokens.css` |
| `browser-shared.css` | `browser/themes/shared/browser-shared.css` |
| `browser-colors.css` | `browser/themes/shared/browser-colors.css` |
| `tokens-platform.css` | `toolkit/themes/shared/design-system/dist/tokens-platform.css` |

`nova.css` is not in this table. It can, however, be affected by this update work (see below).

## Important: where to fetch Firefox's source from

Firefox's source has moved from Mercurial (`hg.mozilla.org/mozilla-central`) to Git
(`https://github.com/mozilla-firefox/firefox`). **`hg.mozilla.org` only has access to old revisions from
that era and can no longer be used as the basis for updating to the latest state.** Searchfox's
`firefox-main` tree also points at the `main` branch of this Git repository.

- To get the latest revision (commit hash):
  ```
  curl -s "https://api.github.com/repos/mozilla-firefox/firefox/commits/main"
  ```
  `.sha` in the response is the latest revision, and `.commit.author.date` is its date/time.
- To fetch a specific file at a given revision:
  ```
  https://raw.githubusercontent.com/mozilla-firefox/firefox/<revision hash>/<file path>
  ```
  (Fetch both the revision hash recorded in each local file's permalink comment and the latest revision
  hash obtained above, and use them as the basis for comparison.)

## Overview of the update procedure

1. Read the currently-recorded revision hash and original file path from each target file's permalink
   comment.
2. Obtain the latest revision hash.
3. For each file, fetch the content of both the "current revision" and the "latest revision" via the raw
   URL above.
4. Compare the two with `diff` to understand what changed (values added/removed/modified, custom property
   renames, etc.). If the diff is empty, that file only needs its permalink comment's revision hash
   updated.
5. For files with a non-empty diff, reflect only the value changes into the local file, following the
   "Local structural adaptation patterns" section below. **Rather than applying the diff verbatim, it is
   safer to replace the content section by section (per `@layer` block) with the latest Firefox version,
   while preserving TST's own wrapper structure (selectors, indentation).**
   Concretely:
   1. In the latest file, locate every `@layer tokens-xxx {` occurrence and its matching closing brace
      line (e.g. by scanning with `grep -n "@layer tokens\|^  }\|^    }\|^      }\|^        }"`).
   2. Extract just the contents (property definitions) of each `@layer` block with `sed` or similar.
   3. Check the current indentation width of the corresponding block in the local file, and dedent by the
      difference in nesting depth versus the Firefox side (see "Indentation differences" below).
   4. Splice the extracted content into the local side's existing wrapper (its selectors and its
      `/* commented-out @media */` notation) as-is.
   5. Once the replacement is done, **extract and wrap the "current content" of the same revision using
      the same procedure, and check that it matches the local file's present state.** A match confirms
      that the extraction/wrapping procedure itself is correct (this verification was actually performed,
      and confirmed to work, during a past update of this repository).
6. If a custom property has been **renamed**, updating that one file is not enough by itself. See "
   Propagating renamed variables" below.
7. Update the revision hash in each file's permalink comment to the latest revision hash obtained.
8. Run the verification steps (see "Verification steps").
9. Summarize the changes made, in Japanese.

## Local structural adaptation patterns

Because the TST-side files cannot use Firefox's own CSS verbatim, the following adaptations are applied
consistently. When updating the contents of a section (property values), do not break this adaptation
pattern.

- **The nesting order of `@layer` and `:root` is reversed.**
  Firefox itself: `:root, :host(...) { @layer tokens-foundation { --prop: value; } }`
  TST local: `@layer tokens-foundation { :root { --prop: value; } }`
  (`@layer` on the outside, `:root` on the inside, and `:host(...)` is dropped.)
- **`@media -moz-pref("browser.nova.enabled")` is removed entirely**, keeping only the `@layer` inside it.
  (Nova-theme CSS files are only ever loaded when the Nova theme is active, so the pref check itself is
  unnecessary.)
- **`@media (forced-colors)` is never used as an actual `@media`; it is commented out and replaced with
  the `:root.forced-colors` class selector instead:**
  ```css
  @layer tokens-forced-colors-nova {
    /*@media (forced-colors) {*/
      :root.forced-colors {
        --prop: value;
      }
    /*}*/
  }
  ```
- **`:root:is([theme-in-app], :not([lwtheme])), :host {}` is replaced with**
  `:root:not([color-scheme="system-color"])/*:is([theme-in-app], :not([lwtheme]))*/:not(.lwtheme-applied) {}`
  (the original selector is kept as a comment). Likewise, `@media not ((forced-colors) or
  (-moz-native-theme))` is also commented out.
- **The equivalent of `@media (-moz-native-theme)` may be replaced with an attribute selector such as
  `&[color-scheme="system-color"]`, and `@media (-moz-platform: macos)` with a class selector such as
  `&.mac`** (see `tabs.css`). Follow whatever notation the existing block already uses.
- All of the above follow **one consistent policy: keep the original selector/`@media` as a comment, while
  reading it as a different selector/class that actually works in TST's runtime environment.** When in
  doubt, mirror whatever notation other blocks in the same file already use.

### Indentation differences

Since the nesting depth changes (typically by one or two levels), the indentation width of property lines
needs adjusting. Compare "Firefox's indentation width" against "the existing indentation width of the
corresponding block on the local side", and dedent by that difference (normally in steps of 2 spaces) using
`sed 's/^  //'` or similar. The amount to dedent can differ between files, and even between blocks within
the same file, so **check each block individually** (for example, `tokens-browser-theme-nova` in
`tab.tokens.css` dedents by a different amount than its sibling blocks).

## Propagating renamed variables

Firefox sometimes renames or redesigns custom property names (not just adding/removing them, but
reworking their meaning too). In that case, updating that one file alone is not enough: other files that
reference the old variable name are left pointing at nothing, and the styling breaks silently (the value
just becomes empty; there is no CSS error to alert you).

**Whenever a rename is suspected, always check the following:**

1. Compare the new/old versions of the file being updated itself, and check whether a variable serving the
   same role has been given a different name (for example, a past update saw a large-scale rename in
   `tab.tokens.css`: `--tab-outline` → `--tab-border`, `--tab-loading-fill` → `--tab-icon-fill-loading`,
   `--tab-selected-textcolor` → `--tab-text-color-selected`, `--tab-selected-outline-color` →
   `--tab-border-color-selected`, and so on).
2. Search every file under `nova/`, including `nova.css`, for the old variable name with
   `grep -n -- '--old-name'`, and rewrite every reference found to the new name. `nova.css` is not a
   copied-from-upstream file, but since it is a **consumer** of these tokens, updating its references is
   necessary follow-up work, and is the one exception to the "don't touch `nova.css`" principle.
3. Conversely, if an explicit override of a particular variable has been **removed** from a copied file's
   forced-colors section, that is often because "the dependency chain through other tokens has been
   redesigned to resolve to the correct value automatically." Rather than naively restoring the removed
   value, trace the reference chain after the removal (the same-named token's definition in other files)
   to confirm it resolves to the intended value.

## A note on encoding/line endings

This repository standardizes on LF line endings as a rule. CR+LF occasionally creeps in, which can cause
`diff` to report an excessive number of spurious changes; when that happens, use `diff`'s `-w` option (or
similar) to compare while ignoring line-ending differences.

## Verification steps

1. For each file, check that the number of `{` and `}` occurrences match (no syntactically unclosed
   blocks).
2. Cross-check the assembled file content against both the pre-update local file and the new-revision
   Firefox file, and confirm that only the intended differences are present (no unexpected loss or
   duplication of content).
3. As a final check, `grep` across every file under `nova/` to make sure no old name of a renamed variable
   is left behind.
4. Check the summary of changed files/line counts with `git diff --stat`, and if any file has changed by
   far more than expected, suspect a line-ending issue or similar.
5. If possible, actually launch the extension and visually confirm that the Nova theme's appearance (tab
   background color, the selected tab's outline, throbber color, and anything else related to the tokens
   that were changed) is not broken.

## Finally

Each file's permalink comment is the starting point for the next update. Once you finish an update, be sure
to rewrite it to the new revision hash. Keep this document itself in sync too, if the update policy ever
changes.
