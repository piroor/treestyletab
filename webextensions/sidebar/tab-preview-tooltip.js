/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

// Overview of the tab preview tooltip:
//
// Tab preview tooltips are processed by the combination of this script
// and content scripts. Players are:
//
// * This script (CONTROLLER)
// * The content script of the active tab to load tab preview frames
//   (LOADER): injected by prepareFrame()
// * The content script of the tab preview frame (FRAME): loaded as
//   `/resources/tab-preview-frame.js`
// * The tab A: a tab to be shown in the preview tooltip.
// * The tab B: the active tab which is used to show the preview tooltip.
//
// When we need to show a tab preview:
//
// 1. The CONTROLLER detects `tab-item-substance-enter` (`mouseenter`) event
//    on a tab substance.
// 2. The CONTROLLER sends a message to the LOADER of the active tab,
//    like "do you know the 'frameId' in your paeg?"
//    1. If no response, the CONTROLLER loads a content script LOADER
//       into the active tab.
//       1. The LOADER generates a transparent iframe with the URL of
//          `/resources/tab-preview-frame.html`.
//       2. The FRAME is loaded and it sends a message to the CONTROLLER
//          like "now I'm ready!"
//       3. The CONTROLLER receives the message and gets the `sender.frameId`
//          information corresponding to the message.
//       4. The CONTROLLER sends the `frameId` information to the LOADER
//          of the active tab, like "hey, your iframe is loaded  with the
//          frameId XXX!`
//       5. The LOADER of the active tab tracks the notified `frameId`.
//    2. The LOADER of the active tab responds to the CONTROLLER, like
//       "OK, I'm ready and the frameId of my iframe is XXX!"
//    3. If these operation is not finished until some seconds, the
//       CONTROLLER gives up to show the preview.
// 3. The CONTROLLER receives the "I'm ready" response with `frameId` from
//    the LOADER of the active tab.
// 4. The CONTROLLER generates a thumbnail image for the tab A, and sends
//    a message with `frameId` to the FRAME in the active  tab, like "show
//    a preview with a thumbnail image 'data:image/png,...' at the position
//    (x,y)"
// 5. The FRAME with the specified `frameId` shows the preview.
//
// When we need to hide a tab preview:
//
// 1. The CONTROLLER detects `tab-item-substance-leave` (`mouseleave`) event
//    on a tab substance.
// 2. The CONTROLLER sends a message to the LOADER of the active tab, like
//    "do you know the 'frameId' in your paeg?"
//    1. If no response, the CONTROLLER gives up to hide the preview.
//       We have nothing to do.
// 3. The CONTROLLER receives the "I'm ready" response with `frameId` from
//    the LOADER of the active tab.
// 4. The CONTROLLER sends a message with `frameId` to the FRAME in the
//    active tab, like "hide a preview"
// 5. The FRAME with the specified `frameId` hides the preview.
//
// I think the CONTROLLER should not track `frameId` for each tab.
// Contents of tabs are frequently destroyed, so `frameId` information
// stored (cached) by the CONTROLLER will become obsolete too easily.

import * as TabsStore from '/common/tabs-store.js';
import Tab from '/common/Tab.js';

import * as EventUtils from './event-utils.js';

import { kEVENT_TAB_SUBSTANCE_ENTER, kEVENT_TAB_SUBSTANCE_LEAVE } from './components/TabElement.js';

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

document.addEventListener(kEVENT_TAB_SUBSTANCE_ENTER, onTabSubstanceEnter);
document.addEventListener(kEVENT_TAB_SUBSTANCE_LEAVE, onTabSubstanceLeave);

async function prepareFrame(tabId) {
  await browser.tabs.executeScript(tabId, {
    matchAboutBlank: true,
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

async function sendTabPreviewMessage(tabId, message, retrying) {
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


async function onTabSubstanceEnter(event) {
  if (!event.target.tab)
    return;

  const activeTab = Tab.getActiveTab(event.target.tab.windowId);
  const tabRect = event.target.tab.$TST.element?.getBoundingClientRect();
  const active = event.target.tab.id == activeTab.id;
  const previewURL = !active && await browser.tabs.captureTab(event.target.tab.id);
  //console.log(event.type, event, event.target.tab, event.target, activeTab);
  sendTabPreviewMessage(activeTab.id, {
    type: 'treestyletab:show-tab-preview',
    tabId: event.target.tab.id,
    tabRect: {
      bottom: tabRect.bottom,
      height: tabRect.height,
      left:   tabRect.left,
      right:  tabRect.right,
      top:    tabRect.top,
      width:  tabRect.width,
    },
    active,
    title: event.target.tab.title,
    url: event.target.tab.url,
    previewURL,
  });
}
onTabSubstanceEnter = EventUtils.wrapWithErrorHandler(onTabSubstanceEnter);

function onTabSubstanceLeave(event) {
  if (!event.target.tab)
    return;

  const activeTab = Tab.getActiveTab(event.target.tab.windowId);
  //console.log(event.type, event.target.tab, event.target, activeTab);
  sendTabPreviewMessage(activeTab.id, {
    type: 'treestyletab:hide-tab-preview',
    tabId: event.target.tab.id,
  });
}
onTabSubstanceLeave = EventUtils.wrapWithErrorHandler(onTabSubstanceLeave);


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
