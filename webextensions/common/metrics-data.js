/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

const gItems = [];

const now = Date.now();
const gInitialTime = now;
let gLastTime    = now;
let gDeltaBetweenLastItem = 0;

export function add(aLabel) {
  const now = Date.now();
  gItems.push({
    label: aLabel,
    delta: now - gLastTime
  });
  gDeltaBetweenLastItem = now - gInitialTime;
  gLastTime = now;
}

export async function addAsync(aLabel, aAsyncTask) {
  const start = Date.now();
  if (typeof aAsyncTask == 'function')
    aAsyncTask = aAsyncTask();
  return aAsyncTask.then(aResult => {
    gItems.push({
      label: `(async) ${aLabel}`,
      delta: Date.now() - start,
      async: true
    });
    return aResult;
  });
}

export function toString() {
  const logs = gItems.map(aItem => `${aItem.delta || 0}: ${aItem.label}`);
  return `total ${gDeltaBetweenLastItem} msec\n${logs.join('\n')}`;
}

