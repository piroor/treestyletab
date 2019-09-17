/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs,
  notify
} from './common.js';
import * as Permissions from './permissions.js';
import * as ApiTabs from './api-tabs.js';
import * as Constants from './constants.js';

import MenuUI from '/extlib/MenuUI.js';
import RichConfirm from '/extlib/RichConfirm.js';
import l10n from '/extlib/l10n.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/bookmarks', ...args);
}

async function getItemById(id) {
  if (!id)
    return null;
  try {
    const items = await browser.bookmarks.get(id).catch(ApiTabs.createErrorHandler());
    if (items.length > 0)
      return items[0];
  }
  catch(_error) {
  }
  return null;
}

export async function bookmarkTab(tab, options = {}) {
  try {
    if (!(await Permissions.isGranted(Permissions.BOOKMARKS)))
      throw new Error('not permitted');
  }
  catch(_e) {
    notify({
      title:   browser.i18n.getMessage('bookmark_notification_notPermitted_title'),
      message: browser.i18n.getMessage('bookmark_notification_notPermitted_message'),
      url:     `moz-extension://${location.host}/options/options.html#bookmarksPermissionSection`
    });
    return null;
  }
  const parent = await getItemById(options.parentId || configs.defaultBookmarkParentId);

  let title    = tab.title;
  let url      = tab.url;
  let parentId = parent && parent.id;
  if (options.showDialog) {
    try {
      const result = await RichConfirm.show({
        content: `
          <div><label>__MSG_bookmarkDialog_title__
                      <input type="text"
                             name="title"
                             value=${JSON.stringify(title)}></label></div>
          <div><label>__MSG_bookmarkDialog_url__
                      <input type="text"
                             name="url"
                             value=${JSON.stringify(url)}></label></div>
          <div><label>__MSG_bookmarkDialog_parentId__
                      <button name="parentId"></button></label></div>
        `,
        onShown(container) {
          l10n.updateDocument();
          container.classList.add('bookmark-dialog');
          initFolderChoolser(container.querySelector('button'), {
            defaultValue: parentId
          });
          container.querySelector('[name="title"]').select();
        },
        buttons: [
          browser.i18n.getMessage('bookmarkDialog_accept'),
          browser.i18n.getMessage('bookmarkDialog_cancel')
        ]
      });
      if (result.buttonIndex != 0)
        return null;
      title    = result.values.title;
      url      = result.values.url;
      parentId = result.values.parentId;
    }
    catch(_error) {
      return null;
    }
  }

  const item = await browser.bookmarks.create({
    parentId, title, url
  }).catch(ApiTabs.createErrorHandler());
  return item;
}

export async function bookmarkTabs(tabs, options = {}) {
  try {
    if (!(await Permissions.isGranted(Permissions.BOOKMARKS)))
      throw new Error('not permitted');
  }
  catch(_e) {
    notify({
      title:   browser.i18n.getMessage('bookmark_notification_notPermitted_title'),
      message: browser.i18n.getMessage('bookmark_notification_notPermitted_message'),
      url:     `moz-extension://${location.host}/options/options.html#bookmarksPermissionSection`
    });
    return null;
  }
  const now = new Date();
  const title = configs.bookmarkTreeFolderName
    .replace(/%TITLE%/gi, tabs[0].title)
    .replace(/%URL%/gi, tabs[0].url)
    .replace(/%YEAR%/gi, now.getFullYear())
    .replace(/%MONTH%/gi, `0${now.getMonth() + 1}`.substr(-2))
    .replace(/%DATE%/gi, `0${now.getDate()}`.substr(-2));
  const folderParams = { title };
  let parent;
  if (options.parentId) {
    parent = await getItemById(options.parentId);
    if ('index' in options)
      folderParams.index = options.index;
  }
  else {
    parent = await getItemById(configs.defaultBookmarkParentId);
  }
  if (parent)
    folderParams.parentId = parent.id;

  if (options.showDialog) {
    try {
      const result = await RichConfirm.show({
        content: `
          <div><label>__MSG_bookmarkDialog_title__
                      <input type="text"
                             name="title"
                             value=${JSON.stringify(folderParams.title)}></label></div>
          <div><label>__MSG_bookmarkDialog_parentId__
                      <button name="parentId"></button></label></div>
        `,
        onShown(container) {
          l10n.updateDocument();
          container.classList.add('bookmark-dialog');
          initFolderChoolser(container.querySelector('button'), {
            defaultValue: folderParams.parentId
          });
          container.querySelector('[name="title"]').select();
        },
        buttons: [
          browser.i18n.getMessage('bookmarkDialog_accept'),
          browser.i18n.getMessage('bookmarkDialog_cancel')
        ]
      });
      if (result.buttonIndex != 0)
        return null;
      folderParams.title    = result.values.title;
      folderParams.parentId = result.values.parentId;
    }
    catch(_error) {
      return null;
    }
  }

  const minLevel = Math.min(...tabs.map(tab => parseInt(tab.$TST.getAttribute(Constants.kLEVEL) || '0')));
  const folder = await browser.bookmarks.create(folderParams).catch(ApiTabs.createErrorHandler());
  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    const tab = tabs[i];
    let title = tab.title;
    const level = parseInt(tab.$TST.getAttribute(Constants.kLEVEL) || '0') - minLevel;
    let prefix = '';
    for (let j = 0; j < level; j++) {
      prefix += '>';
    }
    if (prefix)
      title = `${prefix} ${title}`;
    else
      title = title.replace(/^>+ /, ''); // if the page title has marker-like prefix, we need to remove it.
    await browser.bookmarks.create({
      parentId: folder.id,
      index:    i,
      title,
      url:      tab.url
    }).catch(ApiTabs.createErrorSuppressor());
  }

  return folder;
}

let mChooserTree = null;

export async function initFolderChoolser(anchor, params = {}) {
  if (!mChooserTree) {
    mChooserTree = document.documentElement.appendChild(document.createElement('ul'));
  }
  else {
    const range = document.createRange();
    range.selectNodeContents(mChooserTree);
    range.deleteContents();
    range.detach();
  }

  delete anchor.dataset.value;
  anchor.textContent = browser.i18n.getMessage('bookmarkFolderChooser_unspecified');

  anchor.style.overflow     = 'hidden';
  anchor.style.textOverflow = 'ellipsis';
  anchor.style.whiteSpace   = 'pre';

  let lastChosenId = null;
  if (params.defaultValue) {
    const item = await getItemById(params.defaultValue);
    if (item) {
      lastChosenId         = item.id;
      anchor.dataset.value = lastChosenId;
      anchor.dataset.title = item.title;
      anchor.textContent   = item.title || browser.i18n.getMessage('bookmarkFolderChooser_blank');
      anchor.setAttribute('title', anchor.textContent);
    }
  }

  anchor.ui = new MenuUI({
    root:       mChooserTree,
    appearance: 'menu',
    onCommand(item, event) {
      if (item.dataset.id) {
        lastChosenId         = item.dataset.id;
        anchor.dataset.value = lastChosenId;
        anchor.dataset.title = item.dataset.title;
        anchor.textContent   = item.dataset.title || browser.i18n.getMessage('bookmarkFolderChooser_blank');
        anchor.setAttribute('title', anchor.textContent);
      }
      if (typeof params.onCommand == 'function')
        params.onCommand(item, event);
      anchor.ui.close();
    },
    onShown() {
      for (const item of mChooserTree.querySelectorAll('.checked')) {
        item.classList.remove('checked');
      }
      if (lastChosenId) {
        const item = mChooserTree.querySelector(`.radio[data-id=${lastChosenId}]`);
        if (item)
          item.classList.add('checked');
      }
    },
    animationDuration: configs.animation ? configs.collapseDuration : 0.001
  });
  anchor.addEventListener('click', () => {
    anchor.ui.open({
      anchor
    });
  });
  anchor.addEventListener('keydown', event => {
    if (event.key == 'Enter')
      anchor.ui.open({
        anchor
      });
  });

  const generateFolderItem = (folder) => {
    const item = document.createElement('li');
    item.appendChild(document.createTextNode(folder.title));
    item.setAttribute('title', folder.title || browser.i18n.getMessage('bookmarkFolderChooser_blank'));
    item.dataset.id    = folder.id;
    item.dataset.title = folder.title;
    item.classList.add('folder');
    item.classList.add('radio');
    const container = item.appendChild(document.createElement('ul'));
    const useThisItem = container.appendChild(document.createElement('li'));
    useThisItem.textContent   = browser.i18n.getMessage('bookmarkFolderChooser_useThisFolder');
    useThisItem.dataset.id    = folder.id;
    useThisItem.dataset.title = folder.title;
    return item;
  };

  const buildItems = (items, container) => {
    for (const item of items) {
      if (item.type != 'folder')
        continue;
      const folderItem = generateFolderItem(item);
      container.appendChild(folderItem);
      if (item.children.length > 0)
        buildItems(item.children, folderItem.lastChild);
    }
    const firstFolderItem = container.querySelector('.folder');
    if (firstFolderItem && firstFolderItem.previousSibling) {
      const separator = container.insertBefore(document.createElement('li'), firstFolderItem);
      separator.classList.add('separator');
    }
  };

  const rootItems = await browser.bookmarks.getTree().catch(ApiTabs.createErrorHandler());
  buildItems(rootItems[0].children, mChooserTree);
}
