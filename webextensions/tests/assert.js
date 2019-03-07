/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

export function is(expected, actual, message = '') {
  if (expected === actual ||
      JSON.stringify(expected) === JSON.stringify(actual))
    return;
  const error = new Error('AssertionError: unexpected value');
  error.name         = 'AssertionError';
  error.extraMessage = message;
  error.expected     = JSON.stringify(expected, null, 2);
  error.actual       = JSON.stringify(actual, null, 2);
  throw error;
}

export function ok(actual, message = '') {
  if (!!actual)
    return;
  const error = new Error('AssertionError: unexpected non-true value');
  error.name         = 'AssertionError';
  error.extraMessage = message;
  error.expected     = true;
  error.actual       = actual;
  throw error;
}

export function ng(actual, message = '') {
  if (!actual)
    return;
  const error = new Error('AssertionError: unexpected non-false value');
  error.name         = 'AssertionError';
  error.extraMessage = message;
  error.expected     = false;
  error.actual       = actual;
  throw error;
}
