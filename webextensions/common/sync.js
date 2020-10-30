/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs,
  getChunkedConfig,
  setChunkedConfig
} from './common.js';
import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('common/sync', ...args);
}

export const onMessage = new EventListenerManager();

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
      id:   `${platformInfo.os}-${platformInfo.arch}/${browserInfo.vendor}-${browserInfo.name}-${browserInfo.version}-${browserInfo.buildID}/${Date.now()}-${Math.round(Math.random() * 65000)}`,
      name: `${browserInfo.name} on ${platformInfo.os}`,
      icon: null
    };
    update();
  }
  window.setInterval(update, 1000 * 60 * 60 * 24); // update info every day!

  configs.$addObserver(key => {
    if (!key.startsWith('chunkedSyncData'))
      return;
    reserveToReceiveMessage();
  });
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
        info.timestamp < expireDateInSeconds) {
      delete devices[id];
      log('device expired: ', info);
    }
  }

  configs.syncDevices = devices;
  log('device updated: ', configs.syncDeviceInfo);
}

function reserveToReceiveMessage() {
  if (reserveToReceiveMessage.reserved)
    clearTimeout(reserveToReceiveMessage.reserved);
  reserveToReceiveMessage.reserved = setTimeout(() => {
    delete reserveToReceiveMessage.reserved;
    receiveMessage();
  }, 250);
}

async function receiveMessage() {
  try {
    const messages = JSON.parse((await getChunkedConfig('chunkedSyncData')) || '[]');
    if (!Array.isArray(messages)) {
      log('invalid data: ', messages);
      return;
    }
    const restMessages = messages.filter(message => {
      if (message.to == configs.syncDeviceInfo.id) {
        log('receiveMessage receive: ', message);
        onMessage.dispatch(message);
        return false;
      }
      return true;
    });
    if (restMessages.length != messages.length)
      await setChunkedConfig('chunkedSyncData', JSON.stringify(messages));
  }
  catch(error) {
    log('receiveMessage fatal error: ', error);
  }
}
