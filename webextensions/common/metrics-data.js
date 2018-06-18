/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

const mItems = [];

const now = Date.now();
const mInitialTime = now;
let mLastTime    = now;
let mDeltaBetweenLastItem = 0;

export function add(aLabel) {
  const now = Date.now();
  mItems.push({
    label: aLabel,
    delta: now - mLastTime
  });
  mDeltaBetweenLastItem = now - mInitialTime;
  mLastTime = now;
}

export async function addAsync(aLabel, aAsyncTask) {
  const start = Date.now();
  if (typeof aAsyncTask == 'function')
    aAsyncTask = aAsyncTask();
  return aAsyncTask.then(aResult => {
    mItems.push({
      label: `(async) ${aLabel}`,
      delta: Date.now() - start,
      async: true
    });
    return aResult;
  });
}

export function toString() {
  const logs = mItems.map(aItem => `${aItem.delta || 0}: ${aItem.label}`);
  return `total ${mDeltaBetweenLastItem} msec\n${logs.join('\n')}`;
}

