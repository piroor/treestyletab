/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import EventListenerManager from './EventListenerManager.js';

var gContextualIdentities = {};

export function get(id) {
  return gContextualIdentities[id];
}

export function getCount() {
  return Object.keys(gContextualIdentities).length;
}

export function forEach(aCallback) {
  for (let id of Object.keys(gContextualIdentities)) {
    aCallback(gContextualIdentities[id]);
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
  for (let identity of identities) {
    gContextualIdentities[identity.cookieStoreId] = identity;
  }
}

export const onUpdated = new EventListenerManager();

function onContextualIdentityCreated(aCreatedInfo) {
  const identity = aCreatedInfo.contextualIdentity;
  gContextualIdentities[identity.cookieStoreId] = identity;
  onUpdated.dispatch();
}

function onContextualIdentityRemoved(aRemovedInfo) {
  const identity = aRemovedInfo.contextualIdentity;
  delete gContextualIdentities[identity.cookieStoreId];
  onUpdated.dispatch();
}

function onContextualIdentityUpdated(aUpdatedInfo) {
  const identity = aUpdatedInfo.contextualIdentity;
  gContextualIdentities[identity.cookieStoreId] = identity;
  onUpdated.dispatch();
}
