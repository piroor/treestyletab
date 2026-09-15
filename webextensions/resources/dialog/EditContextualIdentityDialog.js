/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirmDialog from '/extlib/RichConfirmDialog.js';

import {
  sanitizeForHTMLText,
} from '/common/common.js';

class EditContextualIdentityDialog extends RichConfirmDialog {
  constructor(params) {
    super(params);

    this.params.buttons = [
      this.params.acceptLabel || browser.i18n.getMessage('createContextualIdentityDialog_accept'),
      browser.i18n.getMessage('createContextualIdentityDialog_cancel'),
    ];
    this.params.type  = 'dialog'; // for popup
    this.params.title = this.params.title || browser.i18n.getMessage('createContextualIdentityDialog_title'); // for popup
  }

  generateStyleDefinitions() {
    const definitions = super.generateStyleDefinitions();
    const dialogWidth = browser.i18n.getMessage('createContextualIdentityDialog_dialogWidth');
    return `
      ${definitions}

      .${this.commonClass}.rich-confirm-dialog {
        font-size: calc(100% / var(--in-content-ui-scale));
        margin-left: auto !important;
        margin-right: auto !important;
        max-width: 100%;
        min-width: min(100%, ${dialogWidth});
        width: min(100%, ${dialogWidth});
      }

      .${this.commonClass}.rich-confirm-content {
        text-align: center;
      }

      .${this.commonClass} {
        .cci-heading {
          font-size: 1.1em;
          font-weight: bold;
          margin: 0 0 1em;
          text-align: center;
        }

        .cci-field {
          margin-block-end: 1em;
          text-align: start;
        }

        .cci-field-label {
          display: block;
          font-weight: bold;
          margin-block-end: 0.4em;
        }

        .cci-name-field {
          box-sizing: border-box;
          display: block;
          font-size: 100%;
          padding: 0.4em 0.6em;
          width: 100%;
        }

        .cci-swatches {
          display: flex;
          flex-flow: row wrap;
          gap: 0.6em;
          justify-content: space-between;
        }

        .cci-swatch-label {
          display: inline-flex;
        }

        .cci-visually-hidden {
          clip-path: inset(50%);
          height: 1px;
          overflow: hidden;
          position: absolute;
          width: 1px;
        }

        .cci-color-swatch,
        .cci-icon-swatch,
        .cci-icon-swatch-icon {
          appearance: none;
          background-clip: content-box;
          border: calc(2px / var(--in-content-ui-scale)) solid transparent !important /* required to override dark color scheme */;
          border-radius: 50%;
          box-sizing: content-box;
          height: calc(1.6em / var(--in-content-ui-scale));
          margin: 0;
          outline-offset: calc(2px / var(--in-content-ui-scale));
          padding: calc(2px / var(--in-content-ui-scale));
          width: calc(1.6em / var(--in-content-ui-scale));

          &:checked {
            border-color: var(--in-content-border-active) !important;
          }

          &:focus-visible {
            outline: calc(2px / var(--in-content-ui-scale)) solid var(--in-content-border-active);
          }
        }

        .cci-color-swatch {
          background-color: var(--cci-swatch-color, transparent) !important /* required to override dark color scheme */;
        }

        .cci-icon-swatch {
          background-color: transparent;
        }
        .cci-icon-swatch-icon {
          background-color: currentColor;
          content: " ";
          display: inline-block;
          height: calc((2px * 2 /*padding*/ / var(--in-content-ui-scale)) + 1.8em);
          margin-left: calc(0px - ((2px * 2 /*border of two elements*/) + (2px * 2 /*padding of two elements*/) + 1px) / var(--in-content-ui-scale) - 1.8em);
          mask: var(--cci-icon-mask) no-repeat center / 60%;
          padding: 0;
          width: calc((2px * 2 /*padding*/ / var(--in-content-ui-scale)) + 1.8em);
        }
      }
    `.trim();
  }

  // browser.contextualIdentities is not available to a script injected into
  // a content page (see RichConfirm.showInTab()), so the list of supported
  // colors/icons must be fetched by the caller (running in the background
  // or sidebar namespace) and passed in via params.colors/params.icons.
  async updateContent() {
    this.colors = this.params.colors || [];
    this.icons  = this.params.icons  || [];

    const values = this.params.values || {};

    this.content.insertAdjacentHTML('beforeend', `
      <h1 class="cci-heading">${sanitizeForHTMLText(this.params.title)}</h1>
      <div class="cci-field cci-name-container">
        <label>
          <span class="cci-field-label">${sanitizeForHTMLText(browser.i18n.getMessage('createContextualIdentityDialog_name_label'))}</span>
          <input id="name"
                 class="cci-name-field"
                 type="text"
                 name="name"
                 placeholder=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('createContextualIdentityDialog_name_placeholder')))}
                 value=${JSON.stringify(sanitizeForHTMLText(values.name || ''))}>
        </label>
      </div>
      <div class="cci-field cci-color-container">
        <span class="cci-field-label">${sanitizeForHTMLText(browser.i18n.getMessage('createContextualIdentityDialog_color_label'))}</span>
        <div class="cci-swatches cci-color-swatches"
             role="radiogroup"
             aria-label=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('createContextualIdentityDialog_color_selector_aria_label')))}
            >${this.colors.map(color => `
          <label class="cci-swatch-label" title="${sanitizeForHTMLText(color.color)}">
            <input type="radio"
                   name="cci-color"
                   class="cci-color-swatch"
                   value="${sanitizeForHTMLText(color.color)}"
                   style="--cci-swatch-color: ${sanitizeForHTMLText(color.colorCode)};">
            <span class="cci-visually-hidden">${sanitizeForHTMLText(color.color)}</span>
          </label>
        `).join('')}</div>
        <input type="hidden" id="color" name="color" value=${JSON.stringify(sanitizeForHTMLText(values.color || ''))}>
      </div>
      <div class="cci-field cci-icon-container">
        <span class="cci-field-label">${sanitizeForHTMLText(browser.i18n.getMessage('createContextualIdentityDialog_icon_label'))}</span>
        <div class="cci-swatches cci-icon-swatches"
             role="radiogroup"
             aria-label=${JSON.stringify(sanitizeForHTMLText(browser.i18n.getMessage('createContextualIdentityDialog_icon_selector_aria_label')))}
            >${this.icons.map(icon => `
          <label class="cci-swatch-label" title="${sanitizeForHTMLText(icon.icon)}">
            <input type="radio"
                   name="cci-icon"
                   class="cci-icon-swatch"
                   value="${sanitizeForHTMLText(icon.icon)}">
            <span class="cci-icon-swatch-icon"
                  style="--cci-icon-mask: url(${sanitizeForHTMLText(browser.runtime.getURL(`/resources/icons/contextual-identities/${icon.icon}.svg#gray-${this.params.style}`))});"></span>
            <span class="cci-visually-hidden">${sanitizeForHTMLText(icon.icon)}</span>
          </label>
        `).join('')}</div>
        <input type="hidden" id="icon" name="icon" value=${JSON.stringify(sanitizeForHTMLText(values.icon || ''))}>
      </div>
    `.trim().replace(/>\s+</g, '><'));

    for (const element of this.content.querySelectorAll('[accesskey]')) {
      this.updateAccessKey(element);
    }
  }

  onShown(container) {
    if (this.params.simulation)
      return;

    const nameField          = container.querySelector('#name');
    const colorSwatches      = container.querySelector('.cci-color-swatches');
    const iconSwatches       = container.querySelector('.cci-icon-swatches');
    const colorHiddenField   = container.querySelector('#color');
    const iconHiddenField    = container.querySelector('#icon');

    const selectColor = color => {
      colorHiddenField.value = color;
      const radio = colorSwatches.querySelector(`input[value=${JSON.stringify(color)}]`);
      if (radio)
        radio.checked = true;
    };
    const selectIcon = icon => {
      iconHiddenField.value = icon;
      const radio = iconSwatches.querySelector(`input[value=${JSON.stringify(icon)}]`);
      if (radio)
        radio.checked = true;
    };

    const initialColor = this.colors.some(color => colorHiddenField.value == color.color) ?
      colorHiddenField.value : this.colors[0].color;
    if (initialColor)
      selectColor(initialColor);

    const initialIcon = this.icons.some(icon => iconHiddenField.value == icon.icon) ?
      iconHiddenField.value : this.icons[0].icon;
    if (initialIcon)
      selectIcon(initialIcon);

    colorSwatches.addEventListener('change', event => {
      if (event.target.checked)
        selectColor(event.target.value);
    });
    iconSwatches.addEventListener('change', event => {
      if (event.target.checked)
        selectIcon(event.target.value);
    });

    nameField.focus();
    nameField.select();
  }
};
window.EditContextualIdentityDialog = EditContextualIdentityDialog;
window.RICH_CONFIRM_DIALOG_CLASS_NAME = 'EditContextualIdentityDialog';

export default EditContextualIdentityDialog;
