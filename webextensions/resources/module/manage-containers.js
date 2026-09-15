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
  sanitizeForHTMLText,
  updateAccessKey,
} from '/common/common.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as Constants from '/common/constants.js';
import * as ContextualIdentities from '/common/contextual-identities.js';
import EditContextualIdentity from '/resources/dialog/EditContextualIdentity.js';

RichConfirm.init('/extlib/RichConfirmDialog.html');

document.documentElement.classList.toggle('rtl', isRTL());

let mDraggingRow = null;

function styleSuffix() {
  return configs.style == 'nova' ? 'nova' : 'proton';
}

function applyStyle() {
  document.documentElement.dataset.style = styleSuffix();
}

function buildRowHTML(identity) {
  const dragHandleLabel = browser.i18n.getMessage('manageContainers_dragHandle_tooltip');
  const editLabel       = browser.i18n.getMessage('manageContainers_editButton_tooltip');
  const deleteLabel     = browser.i18n.getMessage('manageContainers_deleteButton_tooltip');
  return `
    <li class="container-row" data-cookie-store-id=${JSON.stringify(sanitizeForHTMLText(identity.cookieStoreId))}>
      <span class="drag-handle" draggable="true"
            title=${JSON.stringify(sanitizeForHTMLText(dragHandleLabel))}
            aria-label=${JSON.stringify(sanitizeForHTMLText(dragHandleLabel))}
           ><span class="icon-mask"></span></span>
      <span class="identity-icon" style="background-color: ${sanitizeForHTMLText(identity.colorCode || '')};"
           >${identity.iconUrl ? `<span class="icon-mask" style="--icon-mask: url(${sanitizeForHTMLText(identity.iconUrl)});"></span>` : ''}</span>
      <span class="identity-name">${sanitizeForHTMLText(identity.name)}</span>
      <span class="identity-actions">
        <button type="button" class="edit-button"
                title=${JSON.stringify(sanitizeForHTMLText(editLabel))}
                aria-label=${JSON.stringify(sanitizeForHTMLText(editLabel))}
               ><span class="icon-mask"></span></button>
        <button type="button" class="delete-button"
                title=${JSON.stringify(sanitizeForHTMLText(deleteLabel))}
                aria-label=${JSON.stringify(sanitizeForHTMLText(deleteLabel))}
               ><span class="icon-mask"></span></button>
      </span>
    </li>
  `.trim().replace(/>\s+</g, '><');
}

async function renderList() {
  const identities = await browser.contextualIdentities.query({}).catch(ApiTabs.createErrorHandler()) || [];

  const list  = document.querySelector('#containersList');
  const range = document.createRange();
  range.selectNodeContents(list);
  range.deleteContents();
  range.detach();

  const rowsHTML = identities
    .map(rawIdentity => ContextualIdentities.get(rawIdentity.cookieStoreId) || rawIdentity)
    .map(buildRowHTML)
    .join('');
  list.insertAdjacentHTML('beforeend', rowsHTML);
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

  list.addEventListener('click', event => {
    const row = event.target.closest('.container-row');
    if (!row)
      return;
    const identity = ContextualIdentities.get(row.dataset.cookieStoreId);
    if (!identity)
      return;

    if (event.target.closest('.edit-button')) {
      editContainer(identity);
      return;
    }
    if (event.target.closest('.delete-button')) {
      deleteContainer(identity);
      return;
    }
  });

  list.addEventListener('dragstart', event => {
    const handle = event.target.closest('.drag-handle');
    if (!handle)
      return;
    const row = handle.closest('.container-row');
    mDraggingRow = row;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.dataset.cookieStoreId);
    row.classList.add('dragging');
  });

  list.addEventListener('dragend', event => {
    const handle = event.target.closest('.drag-handle');
    if (!handle)
      return;
    handle.closest('.container-row').classList.remove('dragging');
    mDraggingRow = null;
  });

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

  const inheritContextualIdentityToNewTabModeLabel = document.querySelector('#inheritContextualIdentityToNewTabMode_label');
  updateAccessKey(inheritContextualIdentityToNewTabModeLabel);
  inheritContextualIdentityToNewTabModeLabel.querySelector('input').addEventListener('change', event => {
    configs.inheritContextualIdentityToNewTabMode = event.target.checked ?
      Constants.kCONTEXTUAL_IDENTITY_SELECT_FOR_EACH :
      Constants.kCONTEXTUAL_IDENTITY_DEFAULT;
  });

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
