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

import MenuUI from '/extlib/MenuUI.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/bookmarks', ...args);
}

async function getItemById(id) {
  if (!id)
    return null;
  try {
    const items = await browser.bookmarks.get(id);
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
      message: browser.i18n.getMessage('bookmark_notification_notPermitted_message')
    });
    return null;
  }
  const parent = await getItemById(options.parentId || configs.defaultBookmarkParentId);
  const item = await browser.bookmarks.create({
    parentId: parent && parent.id,
    title:    tab.apiTab.title,
    url:      tab.apiTab.url
  });
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
      message: browser.i18n.getMessage('bookmark_notification_notPermitted_message')
    });
    return null;
  }
  const now = new Date();
  const title = configs.bookmarkTreeFolderName
    .replace(/%TITLE%/gi, tabs[0].apiTab.title)
    .replace(/%URL%/gi, tabs[0].apiTab.url)
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
  const folder = await browser.bookmarks.create(folderParams);
  for (let i = 0, maxi = tabs.length; i < maxi; i++) {
    const tab = tabs[i];
    await browser.bookmarks.create({
      parentId: folder.id,
      index:    i,
      title:    tab.apiTab.title,
      url:      tab.apiTab.url
    });
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

  delete anchor.dataset.id;
  anchor.textContent = browser.i18n.getMessage('bookmarkFolderChooser_unspecified');

  let lastChosenId = null;
  if (params.defaultValue) {
    const item = await getItemById(params.defaultValue);
    if (item) {
      lastChosenId         = item.id;
      anchor.dataset.id    = lastChosenId;
      anchor.dataset.title = item.title;
      anchor.textContent   = item.title || browser.i18n.getMessage('bookmarkFolderChooser_blank');
    }
  }

  anchor.ui = new MenuUI({
    root:       mChooserTree,
    appearance: 'menu',
    onCommand:  (item, event) => {
      if (item.dataset.id) {
        lastChosenId         = item.dataset.id;
        anchor.dataset.id    = lastChosenId;
        anchor.dataset.title = item.dataset.title;
        anchor.textContent   = item.dataset.title || browser.i18n.getMessage('bookmarkFolderChooser_blank');
      }
      params.onCommand(item, event);
      anchor.ui.close();
    },
    onShown:    () => {
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
      if (item.children.length > 0) {
        const separator = folderItem.lastChild.appendChild(document.createElement('li'));
        separator.classList.add('separator');
        buildItems(item.children, folderItem.lastChild);
      }
    }
  };

  const rootItems = await browser.bookmarks.getTree();
  buildItems(rootItems[0].children, mChooserTree);
}
