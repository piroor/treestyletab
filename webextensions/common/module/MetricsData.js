/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

// Defined in a classic script source, and we can read these as global variables. 
/* global
  getTabs: false,
 */

export function MetricsData() {
  this.items       = [];
  this.initialTime = this.lastTime = Date.now();
}

MetricsData.prototype = {
  add(aLabel) {
    var now = Date.now();
    this.items.push({
      label: aLabel,
      delta: now - this.lastTime
    });
    this.deltaBetweenLastItem = now - this.initialTime;
    this.lastTime = now;
  },

  addAsync(aLabel, aAsyncTask) {
    var start = Date.now();
    if (typeof aAsyncTask == 'function')
      aAsyncTask = aAsyncTask();
    return aAsyncTask.then(aResult => {
      this.items.push({
        label: `(async) ${aLabel}`,
        delta: Date.now() - start,
        async: true
      });
      return aResult;
    });
  },

  toString() {
    var logs = this.items.map(aItem => `${aItem.delta || 0}: ${aItem.label}`);
    return `total ${this.deltaBetweenLastItem} msec for ${getTabs().length} tabs\n${logs.join('\n')}`;
  }
};
