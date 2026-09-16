/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/resources/dialog/RichConfirmWithUserStyles.js';

class AutoGroupNewTabs extends RichConfirm {
}
AutoGroupNewTabs.Dialog = null;
AutoGroupNewTabs.init('/resources/dialog/AutoGroupNewTabsDialog.html');

export default AutoGroupNewTabs;
