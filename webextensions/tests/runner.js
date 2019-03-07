/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from '/common/common.js';

import * as TestTree from './test-tree.js';

let mLogs;

async function run() {
  mLogs = document.getElementById('logs');
  const configValues = backupConfigs();
  restoreConfigs(configs.$default);
  await runAll();
  restoreConfigs(configValues);
}

function backupConfigs() {
  const values = {};
  for (const key of Object.keys(configs.$default).sort()) {
    values[key] = configs[key];
  }
  return values;
}

function restoreConfigs(values) {
  for (const key of Object.keys(values)) {
    configs[key] = values[key];
  }
}

async function runAll() {
  const testCases = [
    TestTree
  ];
  for (const tests of testCases) {
    const setup    = tests.setUp || tests.setup;
    const teardown = tests.tearDown || tests.teardown;
    for (const name of Object.keys(tests)) {
      if (!name.startsWith('test'))
        continue;
      try {
        if (typeof setup == 'function')
          await setup();
        await tests[name]();
        if (typeof teardown == 'function')
          await teardown();
        log(`${name}: succeess`);
      }
      catch(error) {
        log(`${name}: error`, error);
      }
    }
  }
}

function log(message, ...extra) {
  const item = mLogs.appendChild(document.createElement('li'));
  item.textContent = message;
  if (extra.length > 0) {
    item.appendChild(document.createElement('br'));
    item.appendChild(document.createText(JSON.stringify(extra)));
  }
}

window.addEventListener('DOMContentLoaded', run, { once: true });
