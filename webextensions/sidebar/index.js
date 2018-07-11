/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
import '../extlib/l10n.js';
import '../extlib/TabIdFixer.js';

import {
  log
} from '../common/common.js';

import * as MetricsData from '../common/metrics-data.js';

import * as Sidebar from './sidebar.js';
import './mouse-event-listener.js';
import './collapse-expand.js';

import './tab-context-menu.js';

log.context = 'Sidebar-?';

MetricsData.add('Loaded');

window.addEventListener('load', Sidebar.init, { once: true });

window.dumpMetricsData = () => {
  return MetricsData.toString();
};
window.dumpLogs = () => {
  return log.logs.join('\n');
};
