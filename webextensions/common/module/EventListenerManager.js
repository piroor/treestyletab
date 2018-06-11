/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

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
  dispatch(...aArgs) {
    return Promise.all(this.listeners.map(aListener => aListener(...aArgs)));
  }
};
