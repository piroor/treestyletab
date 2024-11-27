/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// This is a sub part to show tab preview tooltip.
// See also: /siedbar/tab-preview-tooltip.js

try{
  browser.runtime.onMessage.addListener((message, _sender) => {
    console.log('ON MESSAGE IN IFRAME ', message);
    /*
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(message);
    document.body.appendChild(pre);
    */

    switch (message?.type) {
      case 'treestyletab:show-tab-preview':
        break;

      case 'treestyletab:hide-tab-preview':
        break;
    }
  });

  document.documentElement.style.pointerEvents = 'none';

  browser.runtime.sendMessage({
    type: 'treestyletab:tab-preview-frame-loaded',
  });
}
catch (error) {
  console.log('TST Tab Preview Frame fatal error: ', error);
}
