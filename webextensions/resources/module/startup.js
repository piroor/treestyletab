/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import { configs } from '/common/module/common.js';
import * as Permissions from '/common/module/permissions.js';
import '/common/l10n.js';

window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#title').textContent = document.title = `${browser.i18n.getMessage('extensionName')} ${browser.runtime.getManifest().version}`;

  Permissions.bindToCheckbox(
    Permissions.ALL_URLS,
    document.querySelector('#allUrlsPermissionGranted'),
    { onChanged: (aGranted) => configs.skipCollapsedTabsForTabSwitchingShortcuts = aGranted }
  );
  Permissions.bindToCheckbox(
    Permissions.BOOKMARKS,
    document.querySelector('#bookmarksPermissionGranted')
  );
}, { once: true });
