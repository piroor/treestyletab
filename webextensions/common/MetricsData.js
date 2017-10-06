/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

function MetricsData() {
  this.items = [];
}

MetricsData.prototype = {
  add(aLabel) {
    this.items.push({ label: aLabel, time: Date.now() });
  },

  toString() {
    var lastItem;
    return this.items.map(aItem => {
      if (lastItem)
        lastItem.delta = aItem.time - lastItem.time;
      lastItem = aItem;
      return `${aItem.delta || 0}: ${aItem.label}`;
    }).join('\n');
  }
};
