/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import * as Constants from '/common/constants.js';

const uri = decodeURIComponent(location.search.replace(/^\?/, ''));
const matched = uri && uri.match(Constants.kSHORTHAND_CUSTOM_URI);
if (matched) {
  const name = matched[1];
  const params = matched[2] || '';
  switch (name.toLowerCase()) {
    case 'group':
      location.href = `${Constants.kSHORTHAND_URIS.group}?${params}`;
      break;

    case 'startup':
      location.href = Constants.kSHORTHAND_URIS.startup;
      break;

    case 'test-runner':
    case 'testrunner':
      location.href = `${Constants.kSHORTHAND_URIS.testRunner}${location.search}`;
      break;

    case 'options':
      location.href = `${Constants.kSHORTHAND_URIS.options}${params.split('#')[1] || ''}`;
      break;

    case 'tabbar':
      location.href = `${Constants.kSHORTHAND_URIS.tabbar}${location.search}`;
      break;
  }
}
