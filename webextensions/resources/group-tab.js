/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gTemporaryCheck;

document.title = getTitle();

function getTitle() {
  var title = location.search.match(/[&?]title=([^&;]*)/);
  if (!title)
    title = location.search.match(/^\?([^&;]*)/);
  return title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab.label.default');
}

document.addEventListener('DOMContentLoaded', () => {
  gTemporaryCheck = document.querySelector('#temporary');
  gTemporaryCheck.checked = /[&?]temporary=true/.test(location.href);
  gTemporaryCheck.addEventListener('change', aEvent => {
    var uri = location.href.replace(/&temporary=(true|false)|temporary=(true|false)&?/, '')
    location.replace(`${uri}&temporary=${gTemporaryCheck.checked}`);
  });
}, { once: true });
