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
          --space-xsmall: calc(0.267em/*rem // We must avoid using "rem", because it refers the font size of the root element and it can be changed by the web page author, for example extremely large value, and it will break the layout of the in-content UI. */ /* 4px */ / var(--in-content-panel-scale));
          --space-small: calc(2 * var(--space-xsmall)); /* 8px */
          --space-medium: calc(3 * var(--space-xsmall)); /* 12px */
          --space-large: calc(4 * var(--space-xsmall)); /* 16px */
          --space-xlarge: calc(6 * var(--space-xsmall)); /* 24px */
          --space-xxlarge: calc(8 * var(--space-xsmall)); /* 32px */

          /* https://searchfox.org/mozilla-central/rev/126697140e711e04a9d95edae537541c3bde89cc/browser/themes/shared/customizableui/panelUI-shared.css#20 */
          --panel-separator-margin-vertical: calc(4px / var(--in-content-panel-scale));

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

            /* https://searchfox.org/mozilla-central/rev/1a4138fff3c97b328b33c107266a461edf83140a/toolkit/themes/shared/design-system/tokens-shared.css */
            --toolbarbutton-background-color-hover: light-dark(var(--color-violet-desaturated-20), var(--color-violet-desaturated-50));
            /* https://searchfox.org/firefox-main/rev/1a4138fff3c97b328b33c107266a461edf83140a/browser/themes/shared/tabbrowser/tab.tokens.css */
            --tab-hover-background-color: var(--toolbarbutton-background-color-hover);

            /* https://searchfox.org/mozilla-central/rev/1a4138fff3c97b328b33c107266a461edf83140a/toolkit/themes/shared/design-system/tokens-shared.css */
            --text-color-error: light-dark(var(--color-red-50), var(--color-red-20));

            .in-content-panel-contents-inner-box {
              --panel-padding: var(--space-medium);
            }

            &:not(.tab-group-editor-mode-create) {
              .panel-header,
              .tab-group-editor-name > label > span {
                position: absolute;
                overflow: hidden;
                clip-path: inset(50%);
                width: 0;
                height: 0;
                min-height: 0;
                pointer-events: none;
              }

              .tab-group-default-header-separator {
                display: none;
              }
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

              &:focus {
                outline: var(--focus-outline);
                outline-offset: var(--focus-outline-inset);
              }
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
               outline: var(--focus-outline);
               outline-offset: var(--focus-outline-inset);
             }
            }
          }
          &.style-nova {
            .tab-group-edit-actions,
            .tab-group-delete {
              padding-block: 0;
              > button /*toolbarbutton*/ {
                border-radius: var(--space-large);

                $:focus {
                  outline-color: var(--focus-outline-color);
                }
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
    return [...this.panel.querySelectorAll('input[type="text"], input[type="radio"]:checked, button:not([disabled)')]
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
    const nameField = `
      <div class="panel-body tab-group-editor-name">
        <label>
          <span class="label-text">${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_name_label)}</span>
          <input class="in-content-panel-title-field" type="text"
                 placeholder=${JSON.stringify(i18n.tabGroupMenu_tab_group_editor_name_field_placeholder)}/>
        </label>
      </div>
    `;
    return `
      <div class="tab-group-default-header">
        <div class="panel-header">
          <h1 class="tab-group-editor-title-create tab-group-create-mode-only"
             >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_title_create)}</h1>
          <h1 class="tab-group-editor-title-edit tab-group-edit-mode-only"
             >${this.sanitizeForHTMLText(i18n.tabGroupMenu_tab_group_editor_title_edit)}</h1>
        </div>
      </div>
      <hr class="tab-group-default-header-separator"/>
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
      if (this.lastStyle == this.style)
        return;

      this.panel.remove();
      this.panel = null;
    }
    super.prepareUI();

    this.lastStyle = this.style;

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
