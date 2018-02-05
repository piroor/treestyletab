/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

if (!window.RichConfirm) {
  window.RichConfirm = function(aParams) {
    this.params = aParams;
    this.onClick = this.onClick.bind(this);
  }
  RichConfirm.prototype = {
    get dialog() {
      return this.ui.querySelector('.rich-confirm-dialog');
    },
    get message() {
      return this.ui.querySelector('.rich-confirm-message');
    },
    get buttonsContainer() {
      return this.ui.querySelector('.rich-confirm-buttons');
    },
    get checkContainer() {
      return this.ui.querySelector('.rich-confirm-check-label');
    },
    get checkCheckbox() {
      return this.ui.querySelector('.rich-confirm-check-checkbox');
    },
    get checkMessage() {
      return this.ui.querySelector('.rich-confirm-check-message');
    },

    buildUI() {
      this.style = document.createElement('style');
      this.style.setAttribute('type', 'text/css');
      this.style.textContent = `
      .rich-confirm {
        background: rgba(0, 0, 0, 0.45);
        border: 1px outset;
        box-shadow: 0.1em 0.1em 0.5em rgba(0, 0, 0, 0.65);
        bottom: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        left:0;
        opacity: 0;
        pointer-events: none;
        position: fixed;
        right: 0;
        transition: opacity var(--collapse-animation);
        top: 0;
        z-index: 999999;
      }

      .rich-confirm.show {
        opacity: 1;
        pointer-events: auto;
      }

      .rich-confirm-row {
        flex-direction: row;
        justify-content: center;
      }

      .rich-confirm-dialog {
        background: -moz-dialog;
        border-radius: 0.5em;
        box-shadow: 0
        color: -moz-dialogtext;
        margin: 0 1em;
        max-width: 20em;
        padding: 1em;
      }

      .rich-confirm-buttons {
        align-items: stretch;
        flex-direction: column;
        justify-content: center;
        margin: 0.5em 0 0;
      }

      .rich-confirm-buttons button {
        display: block;
        width: 100%;
      }

      .rich-confirm-check-label {
        display: flex;
        flex-direction: row;
        margin-top: 0.5em;
      }

      .rich-confirm-check-label.hidden {
        display: none;
      }
    `;
      document.head.appendChild(this.style);

      var range = document.createRange();
      range.selectNodeContents(document.body);
      range.collapse(false);
      var fragment = range.createContextualFragment(`
      <div class="rich-confirm">
        <div class="rich-confirm-row">
          <div class="rich-confirm-dialog">
            <span class="rich-confirm-message"></span>
            <div class="rich-confirm-buttons"></div>
            <label class="rich-confirm-check-label">
              <input type="checkbox" class="rich-confirm-check-checkbox">
              <span class="rich-confirm-check-message"></span>
            </label>
          </div>
        </div>
      </div>
    `);
      range.insertNode(fragment);
      range.detach();
      this.ui = document.body.lastElementChild;
    },

    show: async function() {
      this.buildUI();
      await new Promise((aResolve, aReject) => setTimeout(aResolve, 0));

      this.message.textContent = this.params.message;

      if (this.params.checkMessage) {
        this.checkMessage.textContent = this.params.checkMessage;
        this.checkCheckbox.checked = !!this.params.checked;
        this.checkContainer.classList.remove('hidden');
      }
      else {
        this.checkContainer.classList.add('hidden');
      }

      var range = document.createRange();
      range.selectNodeContents(this.buttonsContainer);
      range.deleteContents();
      var buttons = document.createDocumentFragment();
      for (let label of this.params.buttons) {
        let button = document.createElement('button');
        button.textContent = label;
        button.setAttribute('title', label);
        buttons.appendChild(button);
      }
      range.insertNode(buttons);
      range.detach();

      this.ui.addEventListener('click', this.onClick);
      this.ui.classList.add('show');

      return new Promise((aResolve, aReject) => {
        this._resolve = aResolve;
        this._rejecte = aReject;
      });
    },

    hide() {
      this.ui.removeEventListener('click', this.onClick);
      delete this._resolve;
      delete this._rejecte;
      this.ui.classList.remove('show');
      window.setTimeout(() => {
        this.ui.parentNode.removeChild(this.ui);
        this.style.parentNode.removeChild(this.style);
        delete this.ui;
        delete this.style;
      }, 1000);
    },

    onClick(aEvent) {
      if (aEvent.button != 0) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
        return;
      }

      var button = aEvent.target.closest('button');
      if (button) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
        let buttonIndex = Array.slice(this.buttonsContainer.childNodes).indexOf(button);
        this._resolve({
          buttonIndex,
          checked: !!this.params.message && this.checkCheckbox.checked
        });
        this.hide();
        return;
      }

      if (!aEvent.target.closest(`.rich-confirm-dialog`)) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
        this.hide();
      }
    }
  };
  RichConfirm.showInTab = async function(aTabId, aParams) {
    await browser.tabs.executeScript(aTabId, {
      file:            '/common/RichConfirm.js',
      matchAboutBlank: true,
      runAt:           'document_start'
    });
    const resultSlot = `result_${parseInt(Math.random() * Math.pow(2, 16))}`;
    browser.tabs.executeScript(aTabId, {
      code: `
      delete window.${resultSlot};
      (async () => {
        const confirm = new RichConfirm(${JSON.stringify(aParams)});
        window.${resultSlot} = await confirm.show();
      })();
    `,
      matchAboutBlank: true,
      runAt:           'document_start'
    });
    let result;
    while (true) {
      const results = await browser.tabs.executeScript(aTabId, {
        code:            `window.${resultSlot}`,
        matchAboutBlank: true,
        runAt:           'document_start'
      });
      if (results.length > 0 &&
        results[0] !== undefined) {
        result = results[0];
        break;
      }
      await new Promise((aResolve, aReject) => setTimeout(aResolve, 100));
    }
    return result;
  };
  true; // this is required to run this script as a content script
}
