/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from './common.js';

export async function init() {
  if (configs.syncDeviceInfo) {
    update();
  }
  else {
    const [platformInfo, browserInfo] = await Promise.all([
      browser.runtime.getPlatformInfo(),
      browser.runtime.getBrowserInfo()
    ]);
    configs.syncDeviceInfo = {
      id:         `${platformInfo.os}-${platformInfo.arch}/${browserInfo.vendor}-${browserInfo.name}-${browserInfo.version}-${browserInfo.buildID}/${Date.now()}-${Math.round(Math.random() * 65000)}`,
      name:       `${browserInfo.name} on ${platformInfo.os}`,
      icon:       null
    };
    update();
  }
  window.setInterval(update, 1000 * 60 * 60 * 24); // update info every day!
}

function update() {
  const now = Math.floor(Date.now() / 1000);
  configs.syncDeviceInfo = {
    ...JSON.parse(JSON.stringify(configs.syncDeviceInfo)),
    timestamp: now
  };

  const devices = JSON.parse(JSON.stringify(configs.syncDevices));
  devices[configs.syncDeviceInfo.id] = JSON.parse(JSON.stringify(configs.syncDeviceInfo));

  const expireDateInSeconds = now - (60 * 60 * configs.syncDeviceExpirationDays);
  for (const [id, info] of Object.entries(devices)) {
    if (info &&
        info.timestamp < expireDateInSeconds)
      delete devices[id];
  }

  configs.syncDevices = devices;
}
