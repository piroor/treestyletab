/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

function MetricsData() {
  this.items = [];
  this.initialTime = this.lastTime = Date.now();
}

MetricsData.prototype = {
  add(aLabel) {
    var now = Date.now();
    this.items.push({ label: aLabel, delta: now - this.lastTime });
    this.deltaBetweenLastItem = now - this.initialTime;
    this.lastTime = now;
  },

  toString() {
    return `total ${this.deltaBetweenLastItem} msec for ${getTabs().length} tabs\n${this.items.map(aItem => `${aItem.delta || 0}: ${aItem.label}`).join('\n')}`;
  }
};
