/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
import {
  log
} from '../common/common.js';

import * as MetricsData from '../common/metrics-data.js';

import * as Background from './background.js';
import './listener.js';
import './context-menu.js';

import './tab-context-menu.js';
import '../common/TabIdFixer.js';

log.context = 'BG';

MetricsData.add('index: Loaded');

window.addEventListener('DOMContentLoaded', Background.init, { once: true });
