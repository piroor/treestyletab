/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

(() => {
  browser.runtime.onMessage.addListener((message, _sender) => {
    if (!message ||
        typeof message != 'object' ||
        message.type != 'treestyletab:response-query-logs')
      return;
    if (!message.logs || message.logs.length < 1)
      return;
    document.getElementById('queryLogs').textContent += message.logs.filter(log => !!log).map(log => {
      log.windowId = message.windowId || 'background';
      return JSON.stringify(log);
    }).join(',\n')+',\n';
  });
  browser.runtime.sendMessage({ type: 'treestyletab:request-query-logs' });
})();
