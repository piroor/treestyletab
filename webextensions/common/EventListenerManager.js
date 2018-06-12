/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

const TIMEOUT = 2000;

export default function EventListenerManager() {
  this.listeners = [];
}

EventListenerManager.prototype = {
  addListener(aListener) {
    if (this.listeners.indexOf(aListener) < 0)
      this.listeners.push(aListener);
  },
  removeListener(aListener) {
    const index = this.listeners.indexOf(aListener);
    if (index > -1)
      this.listeners.splice(index, 1);
  },
  async dispatch(...aArgs) {
    const results = await Promise.all(this.listeners.map(async aListener => {
      let timer = setTimeout(() => {
        console.log(`listener does not respond in ${TIMEOUT}ms.\n${new Error().stack}\n${aListener.toString()}`);
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
    for (let result of results) {
      if (result === false)
        return false;
    }
    return true;
  }
};
