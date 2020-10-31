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
export const onNewDevice = new EventListenerManager();
export const onObsoleteDevice = new EventListenerManager();

export async function init() {
  if (!configs.syncDeviceInfo) {
    configs.syncDeviceInfo = await generateDeviceInfo();
  }
  updateSelf();
  updateDevices();
  reserveToReceiveMessage();
  window.setInterval(updateSelf, 1000 * 60 * 60 * 24); // update info every day!

  configs.$addObserver(key => {
    switch (key) {
      case 'syncDevices':
        updateDevices();
        break;

      default:
        if (key.startsWith('chunkedSyncData'))
          reserveToReceiveMessage();
        break;
    }
  });
}

export async function generateDeviceInfo({ name, icon } = {}) {
  const [platformInfo, browserInfo] = await Promise.all([
    browser.runtime.getPlatformInfo(),
    browser.runtime.getBrowserInfo()
  ]);
  return {
    id:   `device-${Date.now()}-${Math.round(Math.random() * 65000)}`,
    name: name === undefined ? `${browserInfo.name} on ${platformInfo.os}` : (name || null),
    icon: icon || null
  };
}

configs.$addObserver(key => {
  switch (key) {
    case 'syncUnsendableUrlPattern':
      isSendableTab.unsendableUrlMatcher = null;
      break;

    case 'syncDeviceInfo':
      updateSelf();
      break;

    default:
      break;
  }
});

function updateSelf() {
  if (updateSelf.updating)
    return;

  updateSelf.updating = true;

  const now = Math.floor(Date.now() / 1000);
  configs.syncDeviceInfo = {
    ...clone(configs.syncDeviceInfo),
    timestamp: now
  };

  const devices = clone(configs.syncDevices);
  devices[configs.syncDeviceInfo.id] = clone(configs.syncDeviceInfo);

  if (configs.syncDeviceExpirationDays > 0) {
    const expireDateInSeconds = now - (60 * 60 * configs.syncDeviceExpirationDays);
    for (const [id, info] of Object.entries(devices)) {
      if (info &&
          info.timestamp < expireDateInSeconds) {
        delete devices[id];
        log('updateSelf: expired ', info);
      }
    }
  }

  configs.syncDevices = devices;
  configs.syncDevicesLocalCache = clone(devices);
  log('updateSelf: updated ', configs.syncDeviceInfo, devices);

  setTimeout(() => {
    updateSelf.updating = false;
  }, 250);
}

function updateDevices() {
  if (updateDevices.updating)
    return;
  updateDevices.updating = true;

  const remote = clone(configs.syncDevices);
  const local  = clone(configs.syncDevicesLocalCache);
  log('devices updated: ', local, remote);
  for (const [id, info] of Object.entries(remote)) {
    if (id in local ||
        id == configs.syncDeviceInfo.id)
      continue;
    log('new device: ', info);
    onNewDevice.dispatch(info);
    local[id] = info;
  }
  for (const [id, info] of Object.entries(local)) {
    if (id in remote ||
        id == configs.syncDeviceInfo.id)
      continue;
    log('obsolete device: ', info);
    delete local[id];
    onObsoleteDevice.dispatch(info);
  }
  configs.syncDevices = local;
  configs.syncDevicesLocalCache = clone(local);
  setTimeout(() => {
    updateDevices.updating = false;
  }, 250);
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
    const messages = JSON.parse(getChunkedConfig('chunkedSyncData') || '[]');
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
      await setChunkedConfig('chunkedSyncData', JSON.stringify(restMessages));
  }
  catch(error) {
    log('receiveMessage fatal error: ', error);
  }
}

export async function sendMessage(to, message) {
  const messages = JSON.parse(getChunkedConfig('chunkedSyncData') || '[]');
  messages.push({
    timestamp: Math.floor(Date.now() / 1000),
    from:      configs.syncDeviceInfo.id,
    to,
    message
  });
  await setChunkedConfig('chunkedSyncData', JSON.stringify(messages));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getOtherDevices() {
  const devices = configs.syncDevices || {};
  const result = [];
  for (const [id, info] of Object.entries(devices)) {
    if (id == configs.syncDeviceInfo.id)
      continue;
    result.push(info);
  }
  return result.sort((a, b) => a.name > b.name);
}
