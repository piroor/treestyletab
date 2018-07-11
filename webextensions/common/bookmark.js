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

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('common/bookmarks', ...args);
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
  if (options.parentId) {
    folderParams.parentId = options.parentId;
    if ('index' in options)
      folderParams.index = options.index;
  }
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

