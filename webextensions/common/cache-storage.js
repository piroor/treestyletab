/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as UniqueId from '/common/unique-id.js';

const DB_NAME = 'PermanentStorage';
const DB_VERSION = 2;
const EXPIRATION_TIME_IN_MSEC = 7 * 24 * 60 * 60 * 1000; // 7 days

export const STORE_BACKGROUND_CACHES = 'backgroundCaches';
export const STORE_SIDEBAR_CACHES    = 'sidebarCaches';

let mOpenedDB;

async function openDB() {
  if (mOpenedDB)
    return mOpenedDB;
  return new Promise((resolve, _reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      // This can fail if this is in a private window.
      // See: https://github.com/piroor/treestyletab/issues/3387
      //reject(new Error('Failed to open database'));
      resolve(null);
    };

    request.onsuccess = () => {
      const db = request.result;
      mOpenedDB = db;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (event.oldVersion < DB_VERSION) {
        try {
          db.deleteObjectStore(STORE_BACKGROUND_CACHES);
          db.deleteObjectStore(STORE_SIDEBAR_CACHES);
        }
        catch(_error) {
        }

        const backgroundCachesStore = db.createObjectStore(STORE_BACKGROUND_CACHES, { keyPath: 'key', unique: true });
        const sidebarCachesStore = db.createObjectStore(STORE_SIDEBAR_CACHES, { keyPath: 'key', unique: true });

        backgroundCachesStore.createIndex('windowId', 'windowId', { unique: false });
        sidebarCachesStore.createIndex('windowId', 'windowId', { unique: false });

        backgroundCachesStore.createIndex('timestamp', 'timestamp');
        sidebarCachesStore.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

export async function setValue({ windowId, key, value, store } = {}) {
  const [db, windowUniqueId] = await Promise.all([
    openDB(),
    UniqueId.ensureWindowId(windowId),
  ]);
  if (!db)
    return;

  reserveToExpireOldEntries();

  const cacheKey = `${windowUniqueId}-${key}`;
  const timestamp = Date.now();
  try {
    const transaction = db.transaction([store], 'readwrite');
    const cacheStore = transaction.objectStore(store);

    cacheStore.put({
      key:      cacheKey,
      windowId: windowUniqueId,
      value,
      timestamp,
    });

    transaction.oncomplete = () => {
      //db.close();
      windowId = undefined;
      key      = undefined;
      value    = undefined;
      store    = undefined;
    };
  }
  catch(error) {
    console.error(`Failed to store cache ${cacheKey} in the store ${store}`, error);
  }
}

export async function deleteValue({ windowId, key, store } = {}) {
  const [db, windowUniqueId] = await Promise.all([
    openDB(),
    UniqueId.ensureWindowId(windowId),
  ]);
  if (!db)
    return;

  reserveToExpireOldEntries();

  const cacheKey = `${windowUniqueId}-${key}`;
  try {
    const transaction = db.transaction([store], 'readwrite');
    const cacheStore = transaction.objectStore(store);
    cacheStore.delete(cacheKey);
    transaction.oncomplete = () => {
      //db.close();
      windowId = undefined;
      key      = undefined;
      store    = undefined;
    };
  }
  catch(error) {
    console.error(`Failed to delete cache ${cacheKey} in the store ${store}`, error);
  }
}

export async function getValue({ windowId, key, store } = {}) {
  return new Promise(async (resolve, _reject) => {
    const [db, windowUniqueId] = await Promise.all([
      openDB(),
      UniqueId.ensureWindowId(windowId),
    ]);
    if (!db) {
      resolve(null);
      return;
    }

    const cacheKey = `${windowUniqueId}-${key}`;
    const timestamp = Date.now();
    try {
      const transaction = db.transaction([store], 'readwrite');
      const cacheStore = transaction.objectStore(store);

      const cacheRequest = cacheStore.get(cacheKey);

      cacheRequest.onsuccess = () => {
        const cache = cacheRequest.result;
        if (!cache) {
          resolve(null);
          return;
        }
        cacheStore.put({ key: cacheKey, timestamp });
        resolve(cache.value);
        cache.key      = undefined;
        cache.windowId = undefined;
        cache.value    = undefined;
      };

      transaction.oncomplete = () => {
        //db.close();
        windowId = undefined;
        key      = undefined;
        store    = undefined;
      };
    }
    catch(error) {
      console.error('Failed to get from cache:', error);
      resolve(null);
    }
  });
}

export async function clearForWindow(windowId) {
  reserveToExpireOldEntries();
  return new Promise(async (resolve, reject) => {
    const [db, windowUniqueId] = await Promise.all([
      openDB(),
      UniqueId.ensureWindowId(windowId),
    ]);
    if (!db) {
      resolve(null);
      return;
    }

    try {
      const transaction = db.transaction([STORE_BACKGROUND_CACHES, STORE_SIDEBAR_CACHES], 'readwrite');
      const backgroundCacheStore = transaction.objectStore(STORE_BACKGROUND_CACHES);
      const sidebarCacheStore = transaction.objectStore(STORE_SIDEBAR_CACHES);

      const backgroundCacheIndex = backgroundCacheStore.index('windowId');
      const sidebarCacheIndex = sidebarCacheStore.index('windowId');

      const backgroundCacheRequest = backgroundCacheIndex.openCursor(IDBKeyRange.only(windowUniqueId));
      backgroundCacheRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor)
          return;
        const key = cursor.primaryKey;
        cursor.continue();
        backgroundCacheStore.delete(key);
      };

      const sidebarCacheRequest = sidebarCacheIndex.openCursor(IDBKeyRange.only(windowUniqueId));
      sidebarCacheRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor)
          return;
        const key = cursor.primaryKey;
        cursor.continue();
        sidebarCacheStore.delete(key);
      };

      transaction.oncomplete = () => {
        //db.close();
        resolve();
      };
    }
    catch(error) {
      console.error('Failed to clear caches:', error);
      reject(error);
    }
  });
}

async function reserveToExpireOldEntries() {
  if (reserveToExpireOldEntries.reservedExpiration)
    clearTimeout(reserveToExpireOldEntries.reservedExpiration);
  reserveToExpireOldEntries.reservedExpiration = setTimeout(() => {
    reserveToExpireOldEntries.reservedExpiration = null;
    expireOldEntries();
  }, 500);
}

async function expireOldEntries() {
  return new Promise(async (resolve, reject) => {
    const db = await openDB();
    if (!db) {
      resolve();
      return;
    }

    try {
      const transaction = db.transaction([STORE_BACKGROUND_CACHES, STORE_SIDEBAR_CACHES], 'readwrite');
      const backgroundCacheStore = transaction.objectStore(STORE_BACKGROUND_CACHES);
      const sidebarCacheStore = transaction.objectStore(STORE_SIDEBAR_CACHES);

      const backgroundCacheIndex = backgroundCacheStore.index('timestamp');
      const sidebarCacheIndex = sidebarCacheStore.index('timestamp');

      const expirationTimestamp = Date.now() - EXPIRATION_TIME_IN_MSEC;

      const backgroundCacheRequest = backgroundCacheIndex.openCursor(IDBKeyRange.upperBound(expirationTimestamp));
      backgroundCacheRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor)
          return;
        const key = cursor.primaryKey;
        cursor.continue();
        backgroundCacheStore.delete(key);
      };

      const sidebarCacheRequest = sidebarCacheIndex.openCursor(IDBKeyRange.upperBound(expirationTimestamp));
      sidebarCacheRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor)
          return;
        const key = cursor.primaryKey;
        cursor.continue();
        sidebarCacheStore.delete(key);
      };

      transaction.oncomplete = () => {
        //db.close();
        resolve();
      };
    }
    catch(error) {
      console.error('Failed to expire old entries:', error);
      reject(error);
    }
  });
}
