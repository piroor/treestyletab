/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/extlib/RichConfirm.js';

import { loadUserStyleRules } from '/common/common.js';

// Common base for all of TST's own RichConfirm based dialogs, and for
// inline (in-content-area) confirms built directly with RichConfirm.
// It reflects the user's custom style rules (configured at the
// "Development" section of the options page) into the rendered dialog,
// via RichConfirmDialog's generic "userStyles" parameter.
class RichConfirmWithUserStyles extends RichConfirm {
  static withUserStyles(params = {}) {
    if ('userStyles' in params)
      return params;
    return { ...params, userStyles: loadUserStyleRules() };
  }

  static async show(params, onDialogOpened = null) {
    return super.show(this.withUserStyles(params), onDialogOpened);
  }

  static async showInTab(tabId, params, onDialogOpened = null) {
    if (typeof tabId != 'number') {
      onDialogOpened = params;
      params = tabId;
      return super.showInTab(this.withUserStyles(params), onDialogOpened);
    }
    return super.showInTab(tabId, this.withUserStyles(params), onDialogOpened);
  }

  static async showInPopup(ownerWinId, params, onDialogOpened = null) {
    if (typeof ownerWinId != 'number') {
      onDialogOpened = params;
      params = ownerWinId;
      return super.showInPopup(this.withUserStyles(params), onDialogOpened);
    }
    return super.showInPopup(ownerWinId, this.withUserStyles(params), onDialogOpened);
  }
}
RichConfirmWithUserStyles.Dialog = null;
RichConfirmWithUserStyles.init('/extlib/RichConfirmDialog.html');

export default RichConfirmWithUserStyles;
