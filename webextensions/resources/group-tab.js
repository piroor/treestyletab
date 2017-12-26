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

function isTemporary() {
  return /[&?]temporary=true/.test(location.search);
}

function getOpenerTabId() {
  var matched = location.search.match(/[&?]openerTabId=([^&;]*)/);
  return matched && matched[1];
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

function updateParameters(aParameters = {}) {
  var title     = aParameters.title || getTitle() || '';
  var temporary = String(gTemporaryCheck.checked);

  var opener    = getOpenerTabId();
  opener = opener ? `&openerTabId=${opener}` : '';

  var uri = location.href.split('?')[0];
  uri = `${uri}?title=${encodeURIComponent(title)}&temporary=${temporary}${opener}`;
  location.replace(uri);
}

function init() {
  gTitle = document.querySelector('#title');
  gTitleField = document.querySelector('#title-field');

  gTitle.addEventListener('click', aEvent => {
    if (aEvent.button == 0 &&
        !hasModifier(aEvent)) {
      enterTitleEdit();
      aEvent.stopPropagation();
    }
  });
  gTitleField.addEventListener('keypress', aEvent => {
    if (hasModifier(aEvent))
      return;

    switch (aEvent.keyCode) {
      case KeyEvent.DOM_VK_ESCAPE:
        gTitleField.value = gTitle.textContent;
        exitTitleEdit();
        break;

      case KeyEvent.DOM_VK_ENTER:
      case KeyEvent.DOM_VK_RETURN:
        updateParameters({ title: gTitleField.value });
        break;

      case KeyEvent.DOM_VK_F2:
        aEvent.stopPropagation();
        break;
    }
  });
  window.addEventListener('click', aEvent => {
    if (aEvent.button == 0 &&
        !hasModifier(aEvent) &&
        aEvent.target != gTitleField) {
      gTitleField.value = gTitle.textContent;
      exitTitleEdit();
      aEvent.stopPropagation();
    }
  });
  window.addEventListener('keypress', aEvent => {
    if (aEvent.keyCode == KeyEvent.DOM_VK_F2 &&
        !hasModifier(aEvent))
      enterTitleEdit();
  });

  gTitle.textContent = gTitleField.value = getTitle();

  gTemporaryCheck = document.querySelector('#temporary');
  gTemporaryCheck.checked = isTemporary();
  gTemporaryCheck.addEventListener('change', aEvent => updateParameters());

  l10n.updateDocument();
  window.initialized = true;
}
//document.addEventListener('DOMContentLoaded', init, { once: true });
