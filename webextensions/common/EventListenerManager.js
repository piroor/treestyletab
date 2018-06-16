/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const TIMEOUT = 2000;

export default class EventListenerManager {
  constructor() {
    this._listeners = new Set();
    this._stacksOnListenerAdded = new WeakMap();
  }

  addListener(aListener) {
    const listeners = this._listeners;
    if (!listeners.has(aListener)) {
      listeners.add(aListener);
      this._stacksOnListenerAdded.set(aListener, new Error().stack);
    }
  }

  removeListener(aListener) {
    this._listeners.delete(aListener);
    this._stacksOnListenerAdded.delete(aListener);
  }

  removeAllListeners() {
    this._listeners.clear();
    this._stacksOnListenerAdded.clear();
  }

  async dispatch(...aArgs) {
    const listeners = Array.from(this._listeners);
    const results = await Promise.all(listeners.map(async aListener => {
      const timer = setTimeout(() => {
        const listenerAddedStack = this._stacksOnListenerAdded.get(aListener);
        console.log(`listener does not respond in ${TIMEOUT}ms.\n${listenerAddedStack}\n\n${new Error().stack}`);
      }, TIMEOUT);
      try {
        return await aListener(...aArgs);
      }
      catch(e) {
        console.log(e);
      }
      finally {
        clearTimeout(timer);
      }
    }));
    if (results.length == 1)
      return results[0];
    for (const result of results) {
      if (result === false)
        return false;
    }
    return true;
  }
}
