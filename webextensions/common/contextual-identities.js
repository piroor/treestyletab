/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger
} from './common.js';

import EventListenerManager from '../extlib/EventListenerManager.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/contextual-identities', ...args);
}

const mContextualIdentities = new Map();

export function get(id) {
  return mContextualIdentities.get(id);
}

export function getCount() {
  return mContextualIdentities.size;
}

export function forEach(callback) {
  for (const identity of mContextualIdentities.values()) {
    callback(identity);
  }
}

export function startObserve() {
  if (!browser.contextualIdentities)
    return;
  browser.contextualIdentities.onCreated.addListener(onContextualIdentityCreated);
  browser.contextualIdentities.onRemoved.addListener(onContextualIdentityRemoved);
  browser.contextualIdentities.onUpdated.addListener(onContextualIdentityUpdated);
}

export function endObserve() {
  if (!browser.contextualIdentities)
    return;
  browser.contextualIdentities.onCreated.removeListener(onContextualIdentityCreated);
  browser.contextualIdentities.onRemoved.removeListener(onContextualIdentityRemoved);
  browser.contextualIdentities.onUpdated.removeListener(onContextualIdentityUpdated);
}

export async function init() {
  if (!browser.contextualIdentities)
    return;
  const identities = await browser.contextualIdentities.query({});
  for (const identity of identities) {
    mContextualIdentities.set(identity.cookieStoreId, identity);
  }
}

export const onUpdated = new EventListenerManager();

function onContextualIdentityCreated(createdInfo) {
  const identity = createdInfo.contextualIdentity;
  mContextualIdentities.set(identity.cookieStoreId, identity);
  onUpdated.dispatch();
}

function onContextualIdentityRemoved(removedInfo) {
  const identity = removedInfo.contextualIdentity;
  delete mContextualIdentities.delete(identity.cookieStoreId);
  onUpdated.dispatch();
}

function onContextualIdentityUpdated(updatedInfo) {
  const identity = updatedInfo.contextualIdentity;
  mContextualIdentities.set(identity.cookieStoreId, identity);
  onUpdated.dispatch();
}
