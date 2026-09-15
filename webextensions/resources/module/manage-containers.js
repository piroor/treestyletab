/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import '/extlib/l10n.js';
import RichConfirm from '/extlib/RichConfirm.js';

import {
  configs,
  isRTL,
  sanitizeAccesskeyMark,
} from '/common/common.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as ContextualIdentities from '/common/contextual-identities.js';
import EditContextualIdentity from '/resources/dialog/EditContextualIdentity.js';

RichConfirm.init('/extlib/RichConfirmDialog.html');

document.documentElement.classList.toggle('rtl', isRTL());

let mDraggingRow = null;

function styleSuffix() {
  return configs.style == 'nova' ? 'nova' : 'proton';
}

function iconURL(basename) {
  return `/resources/icons/${basename}.svg#${styleSuffix()}`;
}

function applyStyle() {
  document.documentElement.dataset.style = styleSuffix();
}

function createIconMask(url) {
  const icon = document.createElement('span');
  icon.classList.add('icon-mask');
  icon.style.setProperty('--icon-mask', `url(${url})`);
  return icon;
}

function buildRow(identity) {
  const row = document.createElement('li');
  row.classList.add('container-row');
  row.dataset.cookieStoreId = identity.cookieStoreId;

  const handle = document.createElement('span');
  handle.classList.add('drag-handle');
  handle.title = browser.i18n.getMessage('manageContainers_dragHandle_tooltip');
  handle.setAttribute('aria-label', handle.title);
  handle.draggable = true;
  handle.appendChild(createIconMask(iconURL('move-16')));
  handle.addEventListener('dragstart', event => {
    mDraggingRow = row;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.dataset.cookieStoreId);
    row.classList.add('dragging');
  });
  handle.addEventListener('dragend', () => {
    row.classList.remove('dragging');
    mDraggingRow = null;
  });
  row.appendChild(handle);

  const badge = document.createElement('span');
  badge.classList.add('identity-icon');
  badge.style.backgroundColor = identity.colorCode || '';
  if (identity.iconUrl)
    badge.appendChild(createIconMask(identity.iconUrl));
  row.appendChild(badge);

  const name = document.createElement('span');
  name.classList.add('identity-name');
  name.textContent = identity.name;
  row.appendChild(name);

  const actions = document.createElement('span');
  actions.classList.add('identity-actions');

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.title = browser.i18n.getMessage('manageContainers_editButton_tooltip');
  editButton.setAttribute('aria-label', editButton.title);
  editButton.appendChild(createIconMask(iconURL('edit-outline')));
  editButton.addEventListener('click', () => editContainer(identity));
  actions.appendChild(editButton);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.title = browser.i18n.getMessage('manageContainers_deleteButton_tooltip');
  deleteButton.setAttribute('aria-label', deleteButton.title);
  deleteButton.appendChild(createIconMask(iconURL('delete')));
  deleteButton.addEventListener('click', () => deleteContainer(identity));
  actions.appendChild(deleteButton);

  row.appendChild(actions);

  return row;
}

async function renderList() {
  const identities = await browser.contextualIdentities.query({}).catch(ApiTabs.createErrorHandler()) || [];

  const list  = document.querySelector('#containersList');
  const range = document.createRange();
  range.selectNodeContents(list);
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  for (const rawIdentity of identities) {
    const identity = ContextualIdentities.get(rawIdentity.cookieStoreId) || rawIdentity;
    fragment.appendChild(buildRow(identity));
  }
  range.insertNode(fragment);
  range.detach();
}

async function addContainer() {
  const result = await EditContextualIdentity.show({
    acceptLabel: browser.i18n.getMessage('editContextualIdentityDialog_accept'),
  }).catch(_error => ({ buttonIndex: -1 }));
  if (result.buttonIndex != 0)
    return;

  const name = (result.values.name || '').trim() ||
    browser.i18n.getMessage('contextualIdentitySelector_createNew_defaultName');
  await browser.contextualIdentities.create({
    name,
    color: result.values.color,
    icon:  result.values.icon,
  }).catch(ApiTabs.createErrorHandler());
}

async function editContainer(identity) {
  const result = await EditContextualIdentity.show({
    title:       browser.i18n.getMessage('editContextualIdentityDialog_title', [identity.name]),
    acceptLabel: browser.i18n.getMessage('editContextualIdentityDialog_accept'),
    values:      {
      name:  identity.name,
      color: identity.color,
      icon:  identity.icon,
    },
  }).catch(_error => ({ buttonIndex: -1 }));
  if (result.buttonIndex != 0)
    return;

  const name = (result.values.name || '').trim() ||
    browser.i18n.getMessage('contextualIdentitySelector_createNew_defaultName');
  await browser.contextualIdentities.update(identity.cookieStoreId, {
    name,
    color: result.values.color,
    icon:  result.values.icon,
  }).catch(ApiTabs.createErrorHandler());
}

async function deleteContainer(identity) {
  const tabs = await browser.tabs.query({ cookieStoreId: identity.cookieStoreId }).catch(ApiTabs.createErrorHandler()) || [];
  if (tabs.length > 0) {
    const result = await RichConfirm.show({
      type:    'common-dialog',
      title:   browser.i18n.getMessage('manageContainers_removeConfirm_title'),
      message: browser.i18n.getMessage('manageContainers_removeConfirm_message', [tabs.length]),
      buttons: [
        browser.i18n.getMessage('manageContainers_removeConfirm_ok'),
        browser.i18n.getMessage('manageContainers_removeConfirm_cancel'),
      ],
    }).catch(_error => ({ buttonIndex: -1 }));
    if (result.buttonIndex != 0)
      return;
  }

  await browser.contextualIdentities.remove(identity.cookieStoreId).catch(ApiTabs.createErrorHandler());
}

function initList() {
  const list = document.querySelector('#containersList');

  list.addEventListener('dragover', event => {
    if (!mDraggingRow)
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const targetRow = event.target.closest('.container-row');
    if (!targetRow || targetRow == mDraggingRow)
      return;

    const rect = targetRow.getBoundingClientRect();
    const insertBefore = (event.clientY - rect.top) < (rect.height / 2);
    list.insertBefore(mDraggingRow, insertBefore ? targetRow : targetRow.nextSibling);
  });

  list.addEventListener('drop', async event => {
    if (!mDraggingRow)
      return;
    event.preventDefault();

    const cookieStoreId = mDraggingRow.dataset.cookieStoreId;
    const newIndex = Array.from(list.children).indexOf(mDraggingRow);
    await browser.contextualIdentities.move(cookieStoreId, newIndex).catch(ApiTabs.createErrorHandler());
    await renderList();
  });
}

function onConfigChange(changedKey) {
  if (changedKey != 'style')
    return;
  applyStyle();
  renderList();
}

window.addEventListener('DOMContentLoaded', async () => {
  document.querySelector('#title').textContent = document.title = browser.i18n.getMessage('manageContainers_title');

  const addNewContainerButton = document.querySelector('#addNewContainer');
  addNewContainerButton.textContent = sanitizeAccesskeyMark(browser.i18n.getMessage('contextualIdentitySelector_createNew'));
  addNewContainerButton.addEventListener('click', addContainer);

  initList();

  await configs.$loaded;
  applyStyle();
  configs.$addObserver(onConfigChange);

  await ContextualIdentities.init();
  ContextualIdentities.startObserve();
  ContextualIdentities.onUpdated.addListener(renderList);

  await renderList();

  document.documentElement.classList.add('initialized');
}, { once: true });
