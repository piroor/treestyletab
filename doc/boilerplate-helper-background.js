/*
 This is a boilerplate to implement a helper addon for Tree Style Tab
 based on its API.
 https://github.com/piroor/treestyletab/wiki/API-for-other-addons

 license: The MIT License, Copyright (c) 2020 YUKI "Piro" Hiroshi
 original:
   http://github.com/piroor/treestyletab/blob/trunk/doc/boilerplate-helper-background.js
*/

'use strict';

const TST_ID = 'treestyletab@piro.sakura.ne.jp';

async function registerToTST() {
  try {
    const result = await browser.runtime.sendMessage(TST_ID, {
      type: 'register-self',

      // Basic information of your addon.
      name:  browser.i18n.getMessage('extensionName'),
      icons: browser.runtime.getManifest().icons,

      // The list of listening message types. (optional)
      // Available message types are listed at:
      // https://github.com/piroor/treestyletab/wiki/API-for-other-addons#notified-message-types
      listeningTypes: [
        'wait-for-shutdown', // This is required to trigger teardown process for this addon on TST side.
        // ...
      ],

      // Extra style rules applied in the sidebar. (optional)
      style: `
      `,

      // Extra permissions to receive tab information via TST's API. (optional)
      // Available permissions are listedat:
      // https://github.com/piroor/treestyletab/wiki/API-for-other-addons#extra-permissions
      permissions: [
        // ...
      ],

      /*
      // Subpanel (optional)
      // https://github.com/piroor/treestyletab/wiki/SubPanel-API
      subPanel: {
        title: browser.i18n.getMessage('extensionName'),
        url:   `moz-extension://${location.host}/path/to/panel.html`
      },
      */

      /*
      // Extra tab contents (optional)
      // https://github.com/piroor/treestyletab/wiki/Extra-Tab-Contents-API
      contents: `<button id="button" part="button">foo</button>`,
      */
    });
  }
  catch(_error) {
    // TST is not available
  }
}
registerToTST();

async function uninitFeaturesForTST() {
  // Put codes to deactivate special features for TST here.
}
async function waitForTSTShutdown() {
  try {
    // https://github.com/piroor/treestyletab/wiki/API-for-other-addons#wait-for-shutdown-type-message
    await browser.runtime.sendMessage(TST_ID, { type: 'wait-for-shutdown' });
  } catch (error) {
    // Extension was disabled before message was sent:
    if (error.message.startsWith('Could not establish connection. Receiving end does not exist.'))
      return true;
    // Extension was disabled while we waited:
    if (error.message.startsWith('Message manager disconnected'))
      return true;
    // Probably an internal Tree Style Tab error:
    throw error;
  }
}
waitForTSTShutdown().then(uninitFeaturesForTST);

browser.runtime.onMessageExternal.addListener((message, sender) => {
  if (sender.id == TST_ID) {
    switch (message && message.type) {
      // Triggers initialization process when TST is reloaded after this addon.
      // https://github.com/piroor/treestyletab/wiki/API-for-other-addons#auto-re-registering-on-the-startup-of-tst
      case 'ready':
        registerToTST();
        break;

      // Triggers teardown process for this addon on TST side.
      // https://github.com/piroor/treestyletab/wiki/API-for-other-addons#unregister-from-tst
      case 'wait-for-shutdown':
        return new Promise(() => {});

      // ...
    }
  }
});
