/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import InContentPanel from './InContentPanel.js';

export default class TabGroupMenuPanel extends InContentPanel {
  static TYPE = 'tab-group-menu';

  get styleRules() {
    return super.styleRules + `
      .in-content-panel-root.tab-group-menu-panel {
        .in-content-panel {
          overflow-y: auto;

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/browser/themes/shared/tabbrowser/tabs.css#1145 */

          /* https://searchfox.org/mozilla-central/rev/7d73613454bfe426fdceb635b33cd3061a69def4/toolkit/themes/shared/design-system/tokens-shared.css#266 */
          /** Size **/
          --size-item-small: calc(16px / var(--in-content-panel-scale));
          --size-item-medium: calc(28px / var(--in-content-panel-scale));
          --size-item-large: calc(32px / var(--in-content-panel-scale));

          /* https://searchfox.org/mozilla-central/rev/7d73613454bfe426fdceb635b33cd3061a69def4/toolkit/themes/shared/design-system/tokens-shared.css#271 */
          /** Space **/
          --space-xxsmall: calc(0.5 * var(--space-xsmall)); /* 2px */
          --space-xsmall: calc(0.267rem /* 4px */ / var(--in-content-panel-scale));
          --space-small: calc(2 * var(--space-xsmall)); /* 8px */
          --space-medium: calc(3 * var(--space-xsmall)); /* 12px */
          --space-large: calc(4 * var(--space-xsmall)); /* 16px */
          --space-xlarge: calc(6 * var(--space-xsmall)); /* 24px */
          --space-xxlarge: calc(8 * var(--space-xsmall)); /* 32px */

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/browser/themes/shared/customizableui/panelUI-shared.css#20 */
          --panel-separator-margin-vertical: calc(4px / var(--in-content-panel-scale));

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-shared.css#107 */
          /** Color **/
          --color-blue-20: oklch(83% 0.17 260);
          --color-blue-60: oklch(55% 0.24 260);
          --color-blue-70: oklch(48% 0.2 260);
          --color-blue-80: oklch(41% 0.17 260);
          --color-cyan-10: oklch(90% 0.07 205);
          --color-cyan-20: oklch(83% 0.11 205);
          --color-cyan-30: oklch(76% 0.14 205);
          --color-cyan-70: oklch(48% 0.2 205);
          --color-green-20: oklch(83% 0.14 145);
          --color-green-70: oklch(48% 0.2 145);
          --color-orange-20: oklch(86% 0.14 50);
          --color-orange-70: oklch(48% 0.20 50);
          --color-pink-20: oklch(83% 0.14 360);
          --color-pink-70: oklch(48% 0.2 360);
          --color-purple-20: oklch(83% 0.14 315);
          --color-purple-70: oklch(48% 0.2 315);
          --color-red-20: oklch(83% 0.14 15);
          --color-red-70: oklch(48% 0.2 15);
          --color-white: #ffffff;
          --color-yellow-20: oklch(86% 0.14 90);
          --color-yellow-70: oklch(51% 0.23 90);

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-platform.css#31 */
          --color-accent-primary: AccentColor;

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-shared.css#226 */
          /** Focus Outline **/
          --focus-outline: var(--focus-outline-width) solid var(--focus-outline-color);
          --focus-outline-color: var(--color-accent-primary);
          --focus-outline-inset: calc(-1 * var(--focus-outline-width));
          --focus-outline-offset: calc(2px / var(--in-content-panel-scale));
          --focus-outline-width: calc(2px / var(--in-content-panel-scale));

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-shared.css#20 */
          /** Border **/
          --border-color-card: color-mix(in srgb, currentColor 10%, transparent);
          --border-color-interactive-hover: var(--border-color-interactive);
          --border-color-interactive-active: var(--border-color-interactive);
          --border-color-interactive-disabled: var(--border-color-interactive);
          --border-radius-circle: calc(9999px / var(--in-content-panel-scale));
          --border-radius-small: calc(4px/ var(--in-content-panel-scale));
          --border-radius-medium: calc(8px / var(--in-content-panel-scale));
          --border-radius-large: calc(16px / var(--in-content-panel-scale));
          --border-width: calc(1px / var(--in-content-panel-scale));

          /* https://searchfox.org/mozilla-central/rev/7d73613454bfe426fdceb635b33cd3061a69def4/browser/themes/shared/tabbrowser/tabs.css#79 */
          --tab-group-color-blue: light-dark(var(--color-blue-70), var(--color-blue-20));
          --tab-group-color-purple: light-dark(var(--color-purple-70), var(--color-purple-20));
          --tab-group-color-cyan: light-dark(var(--color-cyan-70), var(--color-cyan-20));
          --tab-group-color-orange: light-dark(var(--color-orange-70), var(--color-orange-20));
          --tab-group-color-yellow: light-dark(var(--color-yellow-70), var(--color-yellow-20));
          --tab-group-color-pink: light-dark(var(--color-pink-70), var(--color-pink-20));
          --tab-group-color-green: light-dark(var(--color-green-70), var(--color-green-20));
          --tab-group-color-red: light-dark(var(--color-red-70), var(--color-red-20));
          --tab-group-color-gray: light-dark(#5E6A77, #99A6B4);

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-shared.css#286 */
          --text-color-error: light-dark(var(--color-red-70), var(--color-red-20));

          input[value="blue"] {
            --tabgroup-swatch-color: var(--tab-group-color-blue);
          }
          input[value="purple"] {
            --tabgroup-swatch-color: var(--tab-group-color-purple);
          }
          input[value="cyan"] {
            --tabgroup-swatch-color: var(--tab-group-color-cyan);
          }
          input[value="orange"] {
            --tabgroup-swatch-color: var(--tab-group-color-orange);
          }
          input[value="yellow"] {
            --tabgroup-swatch-color: var(--tab-group-color-yellow);
          }
          input[value="pink"] {
            --tabgroup-swatch-color: var(--tab-group-color-pink);
          }
          input[value="green"] {
            --tabgroup-swatch-color: var(--tab-group-color-green);
          }
          input[value="red"] {
            --tabgroup-swatch-color: var(--tab-group-color-red);
          }
          input[value="grey"] {
            --tabgroup-swatch-color: var(--tab-group-color-gray);
          }

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/popup.css#63 */
          .in-content-panel-contents-inner-box {
            padding: var(--panel-padding);
          }

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/browser/themes/shared/tabbrowser/tabs.css#37 */
          --tab-hover-background-color: color-mix(in srgb, currentColor 11%, transparent);

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-brand.css#23 */
          --button-text-color-primary: light-dark(var(--color-white), var(--color-gray-100));
          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-brand.css#30 */
          --color-accent-primary: light-dark(var(--color-blue-60), var(--color-cyan-30));
          --color-accent-primary-hover: light-dark(var(--color-blue-70), var(--color-cyan-20));
          --color-accent-primary-active: light-dark(var(--color-blue-80), var(--color-cyan-10));
          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/toolkit/themes/shared/design-system/tokens-shared.css#99 */
          --button-text-color-primary-hover: var(--button-text-color-primary);
          --button-text-color-primary-active: var(--button-text-color-primary-hover);
          --button-text-color-primary-disabled: var(--button-text-color-primary);

          &.style-nova {
            /* https://searchfox.org/mozilla-central/rev/1a4138fff3c97b328b33c107266a461edf83140a/toolkit/themes/shared/design-system/tokens-shared.css */
            --color-blue-20: #a2d3ff;
            --color-blue-30: #7bb2ff;
            --color-blue-50: #455fe7;
            --color-blue-60: #3246b0;
            --color-blue-70: #23327b;
            --color-blue-80: #17214c;
            --color-cyan-10: #c3eef8;
            --color-cyan-20: #8fddf0;
            --color-cyan-30: #4cc4e1;
            --color-cyan-50: #0a809f;
            --color-cyan-70: #034554;
            --color-gray-0: #fbfbfe;
            --color-gray-50: #67666a;
            --color-gray-55: #515054;
            --color-gray-70: #252428;
            --color-green-20: #90e3c6;
            --color-green-30: #4acca6;
            --color-green-50: #008865;
            --color-green-70: #004933;
            --color-orange-20: #febd99;
            --color-orange-30: #ff9565;
            --color-orange-50: #cd4208;
            --color-orange-70: #701c07;
            --color-pink-20: #ffb0e2;
            --color-pink-30: #f585d3;
            --color-pink-50: #b32e9f;
            --color-pink-70: #5f1854;
            --color-purple-20: #e8b7ff;
            --color-purple-30: #d490ff;
            --color-purple-50: #9540c8;
            --color-purple-70: #4f216b;
            --color-red-20: #ffb6bf;
            --color-red-30: #ff8998;
            --color-red-50: #c52d4f;
            --color-red-70: #69172d;
            --color-violet-10: #eaddff;
            --color-violet-20: #d4c1ff;
            --color-violet-30: #b89cff;
            --color-violet-50: #764edd;
            --color-violet-60: #5939a8;
            --color-violet-70: #3e2976;
            --color-yellow-20: #fbcc77;
            --color-yellow-30: #f3a81e;
            --color-yellow-50: #b26100;
            --color-yellow-70: #5f3100;

            /* https://searchfox.org/firefox-main/rev/1a4138fff3c97b328b33c107266a461edf83140a/browser/themes/shared/tabbrowser/tab.tokens.css */
            --tab-group-color-blue: light-dark(var(--color-blue-50), var(--color-blue-30));
            --tab-group-color-cyan: light-dark(var(--color-cyan-50), var(--color-cyan-30));
            --tab-group-color-gray: light-dark(var(--color-gray-55), var(--color-gray-0));
            --tab-group-color-green: light-dark(var(--color-green-50), var(--color-green-30));
            --tab-group-color-orange: light-dark(var(--color-orange-50), var(--color-orange-30));
            --tab-group-color-pink: light-dark(var(--color-pink-50), var(--color-pink-30));
            --tab-group-color-purple: light-dark(var(--color-purple-50), var(--color-purple-30));
            --tab-group-color-red: light-dark(var(--color-red-50), var(--color-red-30));
            --tab-group-color-yellow: light-dark(var(--color-yellow-50), var(--color-yellow-30));

            /* https://searchfox.org/mozilla-central/rev/1a4138fff3c97b328b33c107266a461edf83140a/toolkit/themes/shared/design-system/tokens-shared.css */
            --button-text-color-primary: light-dark(var(--color-white), var(--color-gray-70));
            --color-accent-primary: light-dark(var(--color-violet-50), var(--color-violet-30));
            --color-accent-primary-hover: light-dark(var(--color-violet-60), var(--color-violet-20));
            --color-accent-primary-active: light-dark(var(--color-violet-70), var(--color-violet-10));
            --button-text-color-primary-hover: var(--button-text-color-primary);
            --button-text-color-primary-active: var(--button-text-color-primary-hover);
            --button-text-color-primary-disabled: var(--button-text-color-primary);

            /* https://searchfox.org/firefox-main/rev/1a4138fff3c97b328b33c107266a461edf83140a/toolkit/themes/shared/design-system/dist/tokens-shared.css */
            --toolbarbutton-background-color-hover: light-dark(rgba(117, 102, 159, 0.25), rgba(182, 170, 217, 0.25));
            /* https://searchfox.org/firefox-main/rev/1a4138fff3c97b328b33c107266a461edf83140a/browser/themes/shared/tabbrowser/tab.tokens.css */
            --tab-hover-background-color: var(--toolbarbutton-background-color-hover);

            .in-content-panel-contents-inner-box {
              --panel-padding: var(--space-medium);
              padding: var(--space-small) var(--panel-padding) var(--panel-padding);
            }
          }


          --panel-width: calc(22em / var(--in-content-panel-scale));
          --panel-padding: var(--space-large);
          --panel-separator-margin: var(--panel-separator-margin-vertical) 0;
          font: menu;

          .panel-header {
            min-height: auto;
            > h1 {
              text-align: center;
              font: menu;
              font-size: calc(100% / var(--in-content-panel-scale));
              font-weight: bold;

              margin-top: 0;
            }
          }

          hr /*toolbarseparator*/ {
            margin-block: var(--space-medium);
            border: calc(1px / var(--in-content-panel-scale)) solid;
            border-width: calc(1px / var(--in-content-panel-scale)) 0 0 0;
            opacity: 0.5;
          }

          .panel-body {
            padding-block: var(--space-medium);
          }

          &.tab-group-editor-mode-create .tab-group-edit-mode-only,
          &:not(.tab-group-editor-mode-create) .tab-group-create-mode-only {
            display: none;
          }

          .tab-group-editor-name > label {
            display: flex;
            flex-direction: column;
            font: menu;
            font-size: calc(100% / var(--in-content-panel-scale));
            margin-inline: 0;
            margin-bottom: var(--space-small);

            > input[type="text"] {
              font-size: 100%;
              padding: var(/*--space-medium*/--space-xsmall);
            }
          }

          .tab-group-editor-swatches {
            display: flex;
            flex-flow: row nowrap;
            justify-content: space-between;

            #tabGroupContextMenuRoot & {
              flex-flow: row wrap;
              justify-content: flex-start;
            }
          }
          &.style-nova .tab-group-editor-swatches {
            margin-block: 0;
            padding-block: 0;
          }

          .tab-group-editor-swatch {
            appearance: none;
            box-sizing: content-box;
            margin: 0;

            font-size: 0;
            width: calc(16px / var(--in-content-panel-scale));
            height: calc(16px / var(--in-content-panel-scale));
            padding: var(--focus-outline-offset);
            border: var(--focus-outline-width) solid transparent;
            border-radius: var(--border-radius-medium);
            background-clip: content-box;
            background-color: var(--tabgroup-swatch-color);

            &:checked {
              border-color: var(--focus-outline-color);
            }

            &:disabled {
              opacity: 0.5;
            }

            &:focus-visible {
              outline: calc(1px / var(--in-content-panel-scale))) solid var(--focus-outline-color);
              outline-offset: calc(1px / var(--in-content-panel-scale))
            }

            + .label-text {
              font-size: 0;
            }
          }
          &.style-nova .tab-group-editor-swatch {
            width: calc(18px / var(--in-content-panel-scale));
            height: calc(18px / var(--in-content-panel-scale));
            border-radius: var(--border-radius-large);
          }

          .tab-group-edit-actions,
          .tab-group-delete {
            padding-block: 0;
            > button /*toolbarbutton*/ {
             appearance: none;
             background: transparent;
             border: none;
             border-radius: var(--space-xsmall);
             display: block;
             font: menu;
             font-size: calc(100% / var(--in-content-panel-scale));
             margin: 0;
             padding: var(--space-small);
             text-align: start;
             width: 100%;

             justify-content: flex-start;

             &[disabled] {
               opacity: 0.5;
             }

             &:not([disabled]):hover {
               background-color: var(--tab-hover-background-color);
             }

             &:not([disabled]):focus {
               box-shadow: none;
             }
            }
          }
          &.style-nova {
            .tab-group-edit-actions,
            .tab-group-delete {
              padding-block: 0;
              > button /*toolbarbutton*/ {
               border-radius: var(--space-large);
              }
            }
          }

          /* cancel /resources/base.css */
          input:focus {
            box-shadow: none;
          }
        }

        .tab-group-editor-panel.tab-group-editor-panel-expanded {
          --panel-width: calc(25em / var(--in-content-panel-scale));
        }

        @media not (prefers-contrast) {
          .tabGroupEditor_deleteGroup {
            color: var(--text-color-error);
          }
        }

        .tab-group-create-actions {
          text-align: end;

          button {
            appearance: none;
            border: none;
            border-radius: var(--space-xsmall);
            margin-inline: var(--space-xsmall);
            padding: var(--space-small);

            &.primary {
              color: var(--button-text-color-primary);
              background-color: var(--color-accent-primary);
              &:hover {
                color: var(--button-text-color-primary-hover);
                background-color: var(--color-accent-primary-hover);
              }
              &:hover:active,
              &[open] {
                color: var(--button-text-color-primary-active);
                background-color: var(--color-accent-primary-active);
              }
            }

            &:focus {
              box-shadow: none;
            }
          }
        }
      }
    `;
  }

  init(givenRoot, i18n) {
    // https://searchfox.org/mozilla-central/source/browser/themes/shared/tabbrowser/tabs.css#1143
    this.BASE_PANEL_WIDTH = '22em';

    super.init(givenRoot);

    this.onClickSelf = this.onClick.bind(this);
    this.onKeyDownSelf = this.onKeyDown.bind(this);

    this.i18n = i18n;

    this.root.classList.add('tab-group-menu-panel');
  }

  onMessage(message, sender) {
    if (this.windowId &&
        message?.windowId != this.windowId)
      return;

    switch (message?.type) {
      default:
        return super.onMessage(message, sender);

      case `treestyletab:${this.type}:hide-if-shown`:
        if (!this.panel ||
            (message.targetId &&
             this.panel.dataset.targetId != message.targetId) ||
            !this.panel.classList.contains('open')) {
          return;
        }
        return super.onMessage({
          ...message,
          type: `treestyletab:${this.type}:hide`,
        }, sender);
    }
  }

  onClick(event) {
    event.stopPropagation();
    const target = event.target?.closest('input, button');
    if (!target?.dataset?.command) {
      return;
    }
    this.invokeCommand(target);
  }

  onKeyDown(event) {
    event.stopPropagation();
    const target = event.target?.closest('input, button');
    if (!target) {
      return;
    }
    switch (event.key) {
      case 'Tab':
        this.advanceFocus(event.shiftKey ? -1 : 1);
        event.preventDefault();
        return;

      case 'Enter':
      case 'Return':
        this.invokeCommand(target);
        return;

      case 'Escape':
        this.onMessage({
          type:      `treestyletab:${this.type}:hide`,
          windowId:  this.windowId,
          timestamp: Date.now(),
        });
        return;
    }
  }

  invokeCommand(target) {
    if (target.dataset?.command == 'copyLinks') {
      this.copyLinks();
    }
    else {
      browser.runtime.sendMessage({
        type:     'treestyletab:invoke-native-tab-group-menu-panel-command',
        windowId: this.windowId,
        groupId:  parseInt(this.panel.dataset.targetId),
        command:  target.dataset?.command,
      });
    }
    this.onMessage({
      type:      `treestyletab:${this.type}:hide`,
      windowId:  this.windowId,
      timestamp: Date.now(),
    });
  }

  advanceFocus(direction) {
    const lastFocused = this.panel.querySelector('input:focus, button:focus');
    const focusibleItems = this.focusibleItems;
    const index = lastFocused ? focusibleItems.indexOf(lastFocused) : -1;
    const lastIndex = focusibleItems.length - 1;
    if (index < 0) {
      if (direction < 0) {
        this.focusTo(focusibleItems[lastIndex]);
      }
      else {
        this.focusTo(focusibleItems[0]);
      }
      return;
    }
    this.focusTo(direction < 0 ?
      (index == 0 ? focusibleItems[lastIndex] : focusibleItems[index - 1]) :
      (index == lastIndex ? focusibleItems[0] : focusibleItems[index + 1])
    );
  }

  focusTo(item) {
    if (!item) {
      return;
    }
    item.focus();
  }

  get focusibleItems() {
    return [...this.panel.querySelectorAll('input[type="text"], input[type="radio"]:checked, button')]
      .filter(item => item.checkVisibility({ visibilityProperty: false, opacityProperty: false }));
  }

  onBeforeDestroy() {
    if (!this.onMessageSelf)
      return;

    if (this.panel) {
      this.panel.removeEventListener('click', this.onClickSelf);
      this.panel.removeEventListener('keydown', this.onKeyDownSelf);
    }

    this.onClickSelf = this.onKeyDownSelf = this.i18n = null;
  }

  get UISource() {
    const i18n = this.i18n;
    const doneButton = `
      <button class="primary tab-group-editor-button-done"
              data-command="done"
              accesskey=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_done_accesskey)}
             >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_done_label)}</button>
    `;
    const cancelButton = `
      <button class="tab-group-editor-button-cancel"
              data-command="cancel"
              accesskey=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_cancel_accesskey)}
             >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_cancel_label)}</button>
    `;
    const title = this.style == 'nova' ? '' : `
      <div class="tab-group-default-header">
        <div class="panel-header">
          <h1 class="tab-group-editor-title-create tab-group-create-mode-only"
             >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_title_create)}</h1>
          <h1 class="tab-group-editor-title-edit tab-group-edit-mode-only"
             >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_title_edit)}</h1>
        </div>
      </div>
      <hr/>
    `;
    const nameFieldLabel = this.style == 'nova' ? '' : `
      <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_name_label)}</span>
    `;
    const nameField = `
      <div class="panel-body tab-group-editor-name">
        <label>
          ${nameFieldLabel}
          <input class="in-content-panel-title-field" type="text"
                 placeholder=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_name_field_placeholder)}/>
        </label>
      </div>
    `;
    return `
      ${title}
      ${this.style == 'nova' ? '' : nameField}
      <div class="tab-group-main">
        <div class="panel-body tab-group-editor-swatches" role="radiogroup"
             aria-label=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector_aria_label)}>
          <label title=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector2_blue_title)}>
            <input type="radio" name="tab-group-color" value="blue" class="tab-group-editor-swatch"/>
            <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_color_selector2_blue)}</span>
          </label>
          <label title=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector2_purple_title)}>
            <input type="radio" name="tab-group-color" value="purple" class="tab-group-editor-swatch"/>
            <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_color_selector2_purple)}</span>
          </label>
          <label title=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector2_cyan_title)}>
            <input type="radio" name="tab-group-color" value="cyan" class="tab-group-editor-swatch"/>
            <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_color_selector2_cyan)}</span>
          </label>
          <label title=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector2_orange_title)}>
            <input type="radio" name="tab-group-color" value="orange" class="tab-group-editor-swatch"/>
            <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_color_selector2_orange)}</span>
          </label>
          <label title=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector2_yellow_title)}>
            <input type="radio" name="tab-group-color" value="yellow" class="tab-group-editor-swatch"/>
            <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_color_selector2_yellow)}</span>
          </label>
          <label title=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector2_pink_title)}>
            <input type="radio" name="tab-group-color" value="pink" class="tab-group-editor-swatch"/>
            <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_color_selector2_pink)}</span>
          </label>
          <label title=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector2_green_title)}>
            <input type="radio" name="tab-group-color" value="green" class="tab-group-editor-swatch"/>
            <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_color_selector2_green)}</span>
          </label>
          <label title=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector2_gray_title)}>
            <input type="radio" name="tab-group-color" value="grey" class="tab-group-editor-swatch"/>
            <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_color_selector2_gray)}</span>
          </label>
          <label title=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_color_selector2_red_title)}>
            <input type="radio" name="tab-group-color" value="red" class="tab-group-editor-swatch"/>
            <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_color_selector2_red)}</span>
          </label>
        </div>
        ${this.style == 'nova' ? nameField : ''}
        ${this.style == 'nova' ? '' : '<hr/>'}
        <div class="panel-body tab-group-edit-actions tab-group-edit-mode-only">
          <button tabindex="0" class="tabGroupEditor_addNewTabInGroup subviewbutton"
                  data-command="addNewTabInGroup"
                 >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_action_new_tab_label)}</button>
          <button tabindex="0" class="tabGroupEditor_moveGroupToNewWindow subviewbutton"
                  data-command="moveGroupToNewWindow"
                 >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_action_new_window_label)}</button>
          <button tabindex="0" class="tabGroupEditor_copyLinks subviewbutton"
                  data-command="copyLinks"
                 ></button>
          <!--
          <button tabindex="0" class="tabGroupEditor_saveAndCloseGroup subviewbutton"
                  data-command="saveAndCloseGroup"
                 >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_action_save_label)}</button>
          -->
          <button tabindex="0" class="tabGroupEditor_ungroupTabs subviewbutton"
                  data-command="ungroupTabs"
                 >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_action_ungroup_label)}</button>
        </div>
        <hr class="tab-group-edit-mode-only"/>
        <div class="tab-group-edit-mode-only panel-body tab-group-delete">
          <button tabindex="0" class="tabGroupEditor_deleteGroup subviewbutton"
                  data-command="deleteGroup"
                 >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_action_delete_label)}</button>
        </div>
        <!-hr class="tab-group-create-mode-only"/>
        <div class="tab-group-create-actions tab-group-create-mode-only">
          ${ this.isWindows ? doneButton + cancelButton : cancelButton + doneButton /* https://searchfox.org/mozilla-central/rev/b7b6aa5e8ffc27bc70d4c129c95adc5921766b93/toolkit/content/widgets/moz-button-group/moz-button-group.mjs#74 */ }
        </div>
      </div>
    `;
  }
  sanitizeForHTMLText(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  prepareUI() {
    if (this.panel) {
      return;
    }
    super.prepareUI();

    const titleField = this.panel.querySelector('.in-content-panel-title-field');
    titleField.addEventListener('input', event => {
      browser.runtime.sendMessage({
        type:    'treestyletab:update-native-tab-group',
        groupId: parseInt(this.panel.dataset.targetId),
        title:   event.target.value,
      });
    });
    const colorRadioGroup = this.panel.querySelector('.tab-group-editor-swatches');
    colorRadioGroup.addEventListener('change', event => {
      if (!event.target.checked) {
        return;
      }
      browser.runtime.sendMessage({
        type:    'treestyletab:update-native-tab-group',
        groupId: parseInt(this.panel.dataset.targetId),
        color:   event.target.value,
      });
    });
    this.panel.addEventListener('click', this.onClickSelf);
    this.panel.addEventListener('keydown', this.onKeyDownSelf);
  }

  onUpdateUI({ targetId, groupTitle, groupColor, creating, tabsToBeCopied, anchorTabRect, complete, ...params }) {
    this.log(`${this.type} updateUI `, { panel: this.panel, targetId, groupTitle, groupColor, creating, anchorTabRect, ...params });

    this.panel.classList.toggle('tab-group-editor-mode-create', creating);

    const titleField = this.panel.querySelector('.in-content-panel-title-field');
    titleField.value = groupTitle || '';

    const colorRadio = this.panel.querySelector(`.tab-group-editor-swatches input[value="${groupColor}"]`)
    if (colorRadio) {
      colorRadio.checked = true;
    }

    this.tabsToBeCopied = tabsToBeCopied || [];
    const copyLinksButton = this.panel.querySelector(`button[data-command="copyLinks"]`)
    copyLinksButton.disabled = this.tabsToBeCopied.length <= 0;
    copyLinksButton.textContent = this.tabsToBeCopied.length == 1 ?
      this.i18n.tabGroupMenu_tab_group_editor_action_copy_link_label :
      this.i18n.tabGroupMenu_tab_group_editor_action_copy_links_label.replace(/%S/gi, this.tabsToBeCopied.length);

    complete();
  }

  onShown() {
    const titleField = this.panel.querySelector('.in-content-panel-title-field');
    titleField.focus();
  }

  // We cannot use copyLinks() in background/commands because calling it via messaging will be blocked due to the error: "DOMException: Clipboard write was blocked due to lack of user activation."
  async copyLinks() {
    if (!this.tabsToBeCopied || this.tabsToBeCopied.length == 0)
      return;

    const plainText = this.tabsToBeCopied.map(tab => tab.url).join('\n');
    const richText  = this.tabsToBeCopied.map(this.toRichTextLink, this).join('<br>\n');

    if (typeof navigator.clipboard.write == 'function') {
      this.log('trying to write data to clipboard via Clipboard API');
      try {
        const clipboardItem = new ClipboardItem({
          ['text/html']:  richText,
          ['text/plain']: plainText,
        });
        await navigator.clipboard.write([clipboardItem]);
        return;
      }
      catch(error) {
        console.error(error);
      }
      return;
    }

    try {
      navigator.clipboard.writeText(plainText);
      return;
    }
    catch(error) {
      console.error(error);
    }
  }
  toRichTextLink(tab) {
    return `<a href="${this.sanitizeForHTMLText(tab.url)}">${this.sanitizeForHTMLText(tab.title)}</a>`;
  }
}
