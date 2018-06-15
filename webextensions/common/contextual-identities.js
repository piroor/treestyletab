/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import EventListenerManager from './EventListenerManager.js';

const gContextualIdentities = new Map();

export function get(aId) {
  return gContextualIdentities.get(aId);
}

export function getCount() {
  return gContextualIdentities.size;
}

export function forEach(aCallback) {
  for (const identity of gContextualIdentities.values()) {
    aCallback(identity);
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
    gContextualIdentities.set(identity.cookieStoreId, identity);
  }
}

export const onUpdated = new EventListenerManager();

function onContextualIdentityCreated(aCreatedInfo) {
  const identity = aCreatedInfo.contextualIdentity;
  gContextualIdentities.set(identity.cookieStoreId, identity);
  onUpdated.dispatch();
}

function onContextualIdentityRemoved(aRemovedInfo) {
  const identity = aRemovedInfo.contextualIdentity;
  delete gContextualIdentities.delete(identity.cookieStoreId);
  onUpdated.dispatch();
}

function onContextualIdentityUpdated(aUpdatedInfo) {
  const identity = aUpdatedInfo.contextualIdentity;
  gContextualIdentities.set(identity.cookieStoreId, identity);
  onUpdated.dispatch();
}
