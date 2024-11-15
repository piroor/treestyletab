/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as TabsStore from '/common/tabs-store.js';
//import Tab from '/common/Tab.js';

const TAB_PREVIEW_FRAME_STYLE = `
  background: transparent;
  border: 0 none;
  bottom: 0;
  height: 100%;
  left: 0;
  overflow: hidden;
  pointer-events: none;
  position: fixed;
  right: 0;
  top: 0;
  width: 100%;
  z-index: 65000;
`;

async function prepareFrame(tabId) {
  await browser.tabs.executeScript(tabId, {
    code: `
      const frame = document.createElement('iframe');
      frame.setAttribute('src', '${browser.runtime.getURL('/resources/tab-preview-frame.html')}');
      frame.setAttribute('style', ${JSON.stringify(TAB_PREVIEW_FRAME_STYLE)});
      document.documentElement.appendChild(frame);

      let frameIdResolver;
      let promisedFrameId = new Promise((resolve, _reject) => {
        frameIdResolver = resolve;
      });

      browser.runtime.onMessage.addListener((message, _sender) => {
        switch (message?.type) {
          case 'treestyletab:ask-tab-preview-frame-id':
            return promisedFrameId;

          case 'treestyletab:notify-tab-preview-frame-id':
            frameIdResolver(message.frameId);
            break;
        }
      });
    `,
  });
}

export async function sendTabPreviewMessage(tabId, message, retrying) {
  let frameId;
  try {
    frameId = await browser.tabs.sendMessage(tabId, {
      type: 'treestyletab:ask-tab-preview-frame-id',
    }).catch(_error => {});
    if (!frameId) {
      if (retrying)
        return;

      await prepareFrame(tabId);
      setTimeout(() => {
        sendTabPreviewMessage(tabId, message, true);
      }, 100);
    }
  }
  catch (error) {
    console.log('Could not send tab preview message: ', tabId, message, error);
    return;
  }

  browser.tabs.sendMessage(tabId, message, { frameId });
}

browser.runtime.onMessage.addListener((message, sender) => {
  const windowId = TabsStore.getCurrentWindowId();
  if (!windowId ||
      sender.tab?.windowId != windowId)
    return;

  switch (message?.type) {
    case 'treestyletab:tab-preview-frame-loaded':
      browser.tabs.sendMessage(sender.tab.id, {
        type: 'treestyletab:notify-tab-preview-frame-id',
        frameId: sender.frameId,
      });
      break;
  }
});
