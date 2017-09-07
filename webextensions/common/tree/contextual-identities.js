/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

var gContextualIdentities = {};

function startObserveContextualIdentities() {
  if (!browser.contextualIdentities)
    return;
  browser.contextualIdentities.onCreated.addListener(onContextualIdentityCreated);
  browser.contextualIdentities.onRemoved.addListener(onContextualIdentityRemoved);
  browser.contextualIdentities.onUpdated.addListener(onContextualIdentityUpdated);
}

function endObserveContextualIdentities() {
  if (!browser.contextualIdentities)
    return;
  browser.contextualIdentities.onCreated.removeListener(onContextualIdentityCreated);
  browser.contextualIdentities.onRemoved.removeListener(onContextualIdentityRemoved);
  browser.contextualIdentities.onUpdated.removeListener(onContextualIdentityUpdated);
}

async function retrieveAllContextualIdentities() {
  if (!browser.contextualIdentities)
    return;
  var identities = await browser.contextualIdentities.query({});
  for (let identity of identities) {
    gContextualIdentities[identity.cookieStoreId] = identity;
  }
}

function onContextualIdentityCreated(aCreatedInfo) {
  var identity = aCreatedInfo.contextualIdentity;
  gContextualIdentities[identity.cookieStoreId] = identity;
  window.onContextualIdentitiesUpdated &&
    onContextualIdentitiesUpdated();
}

function onContextualIdentityRemoved(aRemovedInfo) {
  var identity = aRemovedInfo.contextualIdentity;
  delete gContextualIdentities[identity.cookieStoreId];
  window.onContextualIdentitiesUpdated &&
    onContextualIdentitiesUpdated();
}

function onContextualIdentityUpdated(aUpdatedInfo) {
  var identity = aUpdatedInfo.contextualIdentity;
  gContextualIdentities[identity.cookieStoreId] = identity;
  window.onContextualIdentitiesUpdated &&
    onContextualIdentitiesUpdated();
}
