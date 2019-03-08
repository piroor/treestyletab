/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from '/common/common.js';

import * as ApiTabsListener from '/common/api-tabs-listener.js';
import { Diff } from '/common/diff.js';

import * as TestTree from './test-tree.js';

let mLogs;

async function run() {
  await configs.$loaded;
  ApiTabsListener.startListen();
  mLogs = document.getElementById('logs');
  const configValues = backupConfigs();
  restoreConfigs(configs.$default);
  await runAll();
  ApiTabsListener.endListen();
  restoreConfigs(configValues);
}

function backupConfigs() {
  const values = {};
  for (const key of Object.keys(configs.$default).sort()) {
    values[key] = configs[key];
  }
  return JSON.parse(JSON.stringify(values));
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
      let shouldTearDown = true;
      try {
        if (typeof setup == 'function')
          await setup();
        await tests[name]();
        if (typeof teardown == 'function') {
          await teardown();
          shouldTearDown = false;
        }
        log(`${name}: succeess`);
      }
      catch(error) {
        try {
          if (shouldTearDown &&
              typeof teardown == 'function') {
            await teardown();
          }
          throw error;
        }
        catch(error) {
          if (error && error.name == 'AssertionError')
            logFailure(`${name}: failure`, error);
          else
            logError(`${name}: error`, error);
        }
      }
    }
  }
}

function log(message, error) {
  const item = mLogs.appendChild(document.createElement('li'));
  item.textContent = message;
}

function logError(message, error) {
  const item = mLogs.appendChild(document.createElement('li'));
  item.classList.add('error');
  const description = item.appendChild(document.createElement('div'));
  description.classList.add('description');
  description.textContent = message;
  if (error) {
    description.appendChild(document.createElement('br'));
    description.appendChild(document.createTextNode(error.toString()));

    const stack = item.appendChild(document.createElement('pre'));
    stack.classList.add('stack');
    stack.textContent = error.stack;
  }
}

function logFailure(title, error) {
  const item = mLogs.appendChild(document.createElement('li'));
  item.classList.add('failure');
  const description = item.appendChild(document.createElement('div'));
  description.classList.add('description');
  description.textContent = title;
  if (error.message) {
    description.appendChild(document.createElement('br'));
    description.appendChild(document.createTextNode(error.message));
  }

  const stack = item.appendChild(document.createElement('pre'));
  stack.classList.add('stack');
  stack.textContent = error.stack;

  if ('expected' in error) {
    const expectedBlock = item.appendChild(document.createElement('fieldset'));
    expectedBlock.appendChild(document.createElement('legend')).textContent = 'Expected';
    const expected = expectedBlock.appendChild(document.createElement('pre'));
    expected.classList.add('expected');
    expected.textContent = error.expected.trim();
  }

  const actualBlock = item.appendChild(document.createElement('fieldset'));
  actualBlock.appendChild(document.createElement('legend')).textContent = 'Actual';
  const actual = actualBlock.appendChild(document.createElement('pre'));
  actual.classList.add('actual');
  actual.textContent = error.actual.trim();

  if ('expected' in error) {
    const diffBlock = item.appendChild(document.createElement('fieldset'));
    diffBlock.appendChild(document.createElement('legend')).textContent = 'Difference';
    const diff = diffBlock.appendChild(document.createElement('pre'));
    diff.classList.add('diff');
    diff.innerHTML = Diff.readable(error.expected, error.actual, true);
  }
}

window.addEventListener('DOMContentLoaded', run, { once: true });
