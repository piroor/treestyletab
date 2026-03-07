/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs,
  wait,
} from './common.js';
import * as ApiTabs from './api-tabs.js';
import * as Constants from './constants.js';
import * as TabsStore from './tabs-store.js';
import MetricsData from './MetricsData.js';

function log(...args) {
  internalLogger('common/unique-id', ...args);
}

//===================================================================
// Unique Tab ID
//===================================================================

// for generated IDs
const kID_ADJECTIVES = `
Agile
Breezy
Cheerful
Dapper
Edgy
Feisty
Gutsy
Hoary
Intrepid
Jaunty
Karmic
Lucid
Maverick
Natty
Oneiric
Precise
Quantal
Raring
Saucy
Trusty
Utopic
Vivid
Warty
Xenial
Yakkety
Zesty
`.toLowerCase().trim().split(/\s+/);

const kID_NOUNS = `
Alpaca
Badger
Cat
Drake
Eft
Fawn
Gibbon
Heron
Ibis
Jackalope
Koala
Lynx
Meerkat
Narwhal
Ocelot
Pangolin
Quetzal
Ringtail
Salamander
Tahr
Unicorn
Vervet
Werewolf
Xerus
Yak
Zapus
`.toLowerCase().trim().split(/\s+/);

let mReadyToDetectDuplicatedTab = false;

const mRestoredPersistentIdMap = new Map();

/**
 * Monitor session restoration and pre-fetch persistent IDs for all tabs.
 * Must be called synchronously at startup (to register tabs.onCreated
 * listener before any await).
 * Background page only.
 *
 * @param {function(tab: browser.tabs.Tab): void} [onTabRestored]
 *   Called for each tab detected via tabs.onCreated during restoration.
 *   Called immediately (without waiting for persistent ID polling) so
 *   callers can start parallel work like cache preloading.
 * @returns {Promise<void>}
 */
export function ensurePersistentIdRestored(onTabRestored) {
  log('ensurePersistentIdRestored');

  const promisedInitialTabs = browser.tabs.query({});

  return promisedInitialTabs.then(initialTabs => Promise.all([
    MetricsData.addAsync('ensurePersistentIdRestored: existing tabs ', Promise.all(
      initialTabs.map(tab => waitUntilPersistentIdBecomeAvailable(tab.id)
        .then(uniqueId => { if (uniqueId) mRestoredPersistentIdMap.set(tab.id, uniqueId); })
        .catch(_error => {}))
    )),
    MetricsData.addAsync('ensurePersistentIdRestored: opening tabs ', new Promise((resolve, _reject) => {
      let promises = [];
      let timeout;
      let resolver;
      let onNewTabRestored = async (tab, _info = {}) => {
        clearTimeout(timeout);
        log('new restored tab is detected.');
        promises.push(
          waitUntilPersistentIdBecomeAvailable(tab.id)
            .then(uniqueId => { if (uniqueId) mRestoredPersistentIdMap.set(tab.id, uniqueId); })
            .catch(_error => {})
        );
        if (onTabRestored) {
          try { onTabRestored(tab); }
          catch(e) { console.error('Error in onTabRestored callback:', e); }
        }
        timeout = setTimeout(resolver, 100);
      };
      browser.tabs.onCreated.addListener(onNewTabRestored);
      resolver = (async () => {
        log(`timeout: all ${promises.length} tabs are restored. `, promises);
        browser.tabs.onCreated.removeListener(onNewTabRestored);
        timeout = resolver = onNewTabRestored = undefined;
        await Promise.all(promises);
        promises = undefined;
        resolve();
      });
      timeout = setTimeout(resolver, 500);
    })),
  ]));
}

async function waitUntilPersistentIdBecomeAvailable(tabId, retryCount = 0) {
  if (retryCount > 10) {
    console.log(`could not get persistent ID for ${tabId}`);
    return null;
  }
  const uniqueId = await browser.sessions.getTabValue(tabId, Constants.kPERSISTENT_ID);
  if (!uniqueId)
    return wait(100).then(() => waitUntilPersistentIdBecomeAvailable(tabId, retryCount + 1));
  return uniqueId;
}

/**
 * Complete the restoration phase.
 * - Clears remaining entries in the internal persistent ID map (safety net)
 * - Enables delayed duplicate tab detection
 *
 * Call after rebuildAll() and loadTreeStructure() have finished.
 */
export function completeRestoration() {
  mRestoredPersistentIdMap.clear();
  mReadyToDetectDuplicatedTab = true;
}

export function isRestorationComplete() {
  return mReadyToDetectDuplicatedTab;
}

export async function request(tabOrId, options = {}) {
  log('requested for ', tabOrId?.id || tabOrId);
  if (typeof options != 'object')
    options = {};

  let tab = tabOrId;
  if (typeof tabOrId == 'number')
    tab = TabsStore.tabs.get(tabOrId);

  if (TabsStore.getCurrentWindowId()) {
    log(' => redirect to the background page');
    return browser.runtime.sendMessage({
      type:  Constants.kCOMMAND_REQUEST_UNIQUE_ID,
      tabId: tab.id
    }).catch(ApiTabs.createErrorHandler());
  }

  let originalId    = null;
  let originalTabId = null;
  let duplicated    = false;
  if (!options.forceNew) {
    // https://github.com/piroor/treestyletab/issues/2845
    // This delay may break initial restoration of tabs, so we should
    // ignore it until all restoration processes are finished.
    if (mReadyToDetectDuplicatedTab &&
        configs.delayForDuplicatedTabDetection > 0)
      await wait(configs.delayForDuplicatedTabDetection);

    let oldId;
    if (mRestoredPersistentIdMap.has(tab.id)) {
      oldId = mRestoredPersistentIdMap.get(tab.id);
      mRestoredPersistentIdMap.delete(tab.id);
    }
    else {
      oldId = await browser.sessions.getTabValue(tab.id, Constants.kPERSISTENT_ID).catch(ApiTabs.createErrorHandler());
    }
    if (oldId && !oldId.tabId) // ignore broken information!
      oldId = null;

    log(' => oldId: ', oldId, tab.id);
    if (oldId) {
      // If the tab detected from stored tabId is different, it is duplicated tab.
      try {
        const tabWithOldId = TabsStore.tabs.get(oldId.tabId);
        if (!tabWithOldId)
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
        originalId = (tabWithOldId.$TST.uniqueId || await tabWithOldId.$TST.promisedUniqueId).id;
        duplicated = tab && tabWithOldId.id != tab.id && originalId == oldId.id;
        log(' => duplicated: ', !!duplicated, tab.id);
        if (duplicated)
          originalTabId = oldId.tabId;
        else
          throw new Error(`Invalid tab ID: ${oldId.tabId}`);
      }
      catch(e) {
        log(' => error: ', e, tab.id);
        ApiTabs.handleMissingTabError(e);
        // It fails if the tab doesn't exist.
        // There is no live tab for the tabId, thus
        // this seems to be a tab restored from session.
        // We need to update the related tab id.
        browser.sessions.setTabValue(tab.id, Constants.kPERSISTENT_ID, {
          id:    oldId.id,
          tabId: tab.id
        }).catch(ApiTabs.createErrorSuppressor());
        return {
          id:            oldId.id,
          originalId:    null,
          originalTabId: oldId.tabId,
          restored:      true
        };
      }
    }
  }

  const id = `tab-${generate()}`;
  log(' => new id: ', id, tab.id);
  // tabId is for detection of duplicated tabs
  await browser.sessions.setTabValue(tab.id, Constants.kPERSISTENT_ID, { id, tabId: tab.id }).catch(ApiTabs.createErrorSuppressor());
  return { id, originalId, originalTabId, duplicated };
}

function generate() {
  const adjective   = kID_ADJECTIVES[Math.floor(Math.random() * kID_ADJECTIVES.length)];
  const noun        = kID_NOUNS[Math.floor(Math.random() * kID_NOUNS.length)];
  const randomValue = Math.floor(Math.random() * 1000);
  return `${adjective}-${noun}-${Date.now()}-${randomValue}`;
}

export async function ensureWindowId(windowId) {
  const storedUniqueId = await browser.sessions.getWindowValue(windowId, 'uniqueId').catch(_ => null);
  if (storedUniqueId)
    return storedUniqueId;

  const uniqueId = `window-${generate()}`;
  await browser.sessions.setWindowValue(windowId, 'uniqueId', uniqueId).catch(_ => null);
  return uniqueId;
}
