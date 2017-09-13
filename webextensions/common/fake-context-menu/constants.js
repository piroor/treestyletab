/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

/*
 Workaround until native context menu becomes available.
 I have very less motivation to maintain this for future versions.
 See also: https://bugzilla.mozilla.org/show_bug.cgi?id=1376251
           https://bugzilla.mozilla.org/show_bug.cgi?id=1396031
*/

const kTSTAPI_CONTEXT_MENU_UPDATED    = 'fake-contextMenu-updated';
const kTSTAPI_CONTEXT_MENU_OPEN       = 'fake-contextMenu-open';
const kTSTAPI_CONTEXT_MENU_CREATE     = 'fake-contextMenu-create';
const kTSTAPI_CONTEXT_MENU_UPDATE     = 'fake-contextMenu-update';
const kTSTAPI_CONTEXT_MENU_REMOVE     = 'fake-contextMenu-remove';
const kTSTAPI_CONTEXT_MENU_REMOVE_ALL = 'fake-contextMenu-remove-all';
const kTSTAPI_CONTEXT_MENU_CLICK      = 'fake-contextMenu-click';
