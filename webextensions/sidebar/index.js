/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
import '../external/l10n.js';
import '../external/TabIdFixer.js';

import {
  log
} from '../common/common.js';

import * as MetricsData from '../common/metrics-data.js';

import * as Sidebar from './sidebar.js';
import './listener.js';

import './tab-context-menu.js';

log.context = 'Sidebar-?';

MetricsData.add('Loaded');

window.addEventListener('pagehide', Sidebar.destroy, { once: true });
window.addEventListener('load', Sidebar.init, { once: true });
