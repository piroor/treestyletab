/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gTemporaryCheck;
var gTitle;
var gTitleField;

document.title = getTitle();

function getTitle() {
  var title = location.search.match(/[&?]title=([^&;]*)/);
  if (!title)
    title = location.search.match(/^\?([^&;]*)/);
  return title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab.label.default');
}

function enterTitleEdit() {
  gTitle.style.display = 'none';
  gTitleField.style.display = 'inline';
  gTitleField.select();
  gTitleField.focus();
}

function exitTitleEdit() {
  gTitle.style.display = '';
  gTitleField.style.display = '';
}

function hasModifier(aEvent) {
  return aEvent.altKey ||
         aEvent.ctrlKey ||
         aEvent.metaKey ||
         aEvent.shiftKey;
}

document.addEventListener('DOMContentLoaded', () => {
  gTitle = document.querySelector('#title');
  gTitleField = document.querySelector('#title-field');

  gTitle.addEventListener('dblclick', enterTitleEdit);
  gTitleField.addEventListener('keypress', aEvent => {
    if (hasModifier(aEvent))
      return;

    switch (aEvent.keyCode) {
      case KeyEvent.DOM_VK_ESCAPE:
        gTitleField.value = gTitle.textContent;
        exitTitleEdit();
        break;

      case KeyEvent.DOM_VK_ENTER:
      case KeyEvent.DOM_VK_RETURN: {
        let uri = location.href;
        if (/[&?]title=([^&;]*)/.test(uri))
          uri = uri.replace(/&title=[^&]+|title=[^&]+&?/, '');
        else
          uri = uri.replace(/\?.+$/, '?');
        if (/\?.+$/.test(uri))
          uri = `${uri}&`;
        location.replace(`${uri}title=${encodeURIComponent(gTitleField.value)}`);
      }; break;

      case KeyEvent.DOM_VK_F2:
        aEvent.stopPropagation();
        break;
    }
  });
  window.addEventListener('keypress', aEvent => {
    if (aEvent.keyCode == KeyEvent.DOM_VK_F2 &&
        !hasModifier(aEvent))
      enterTitleEdit();
  });

  gTitle.textContent = gTitleField.value = getTitle();

  gTemporaryCheck = document.querySelector('#temporary');
  gTemporaryCheck.checked = /[&?]temporary=true/.test(location.href);
  gTemporaryCheck.addEventListener('change', aEvent => {
    var uri = location.href.replace(/&temporary=(true|false)|temporary=(true|false)&?/, '')
    if (/\?.+$/.test(uri))
      uri = `${uri}&`;
    location.replace(`${uri}temporary=${gTemporaryCheck.checked}`);
  });
}, { once: true });
