/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/extlib/RichConfirm.js';

import {
  configs,
} from '/common/common.js';

class CreateContextualIdentity extends RichConfirm {
  // browser.contextualIdentities is not available to a script injected into
  // a content page (see RichConfirm.showInTab()), so the list of supported
  // colors/icons must be resolved here, where this class is always loaded
  // (the background or sidebar namespace), and handed to the dialog as
  // default params instead of being fetched by the dialog itself.
  static async withColorsAndIcons(params = {}) {
    const needsColors = !Array.isArray(params.colors);
    const needsIcons  = !Array.isArray(params.icons);
    if (!needsColors && !needsIcons)
      return params;

    const [colors, icons] = await Promise.all([
      needsColors ? browser.contextualIdentities.getSupportedColors().catch(() => []) : params.colors,
      needsIcons  ? browser.contextualIdentities.getSupportedIcons().catch(() => [])  : params.icons,
    ]);
    const style = configs.style == 'nova' ? 'nova' : 'proton';
    return { ...params, colors, icons, style };
  }

  static async show(params, onDialogOpened = null) {
    return super.show(await this.withColorsAndIcons(params), onDialogOpened);
  }

  static async showInTab(tabId, params, onDialogOpened = null) {
    if (typeof tabId != 'number') {
      onDialogOpened = params;
      params = tabId;
      return super.showInTab(await this.withColorsAndIcons(params), onDialogOpened);
    }
    return super.showInTab(tabId, await this.withColorsAndIcons(params), onDialogOpened);
  }
}
CreateContextualIdentity.Dialog = null;
CreateContextualIdentity.init('/resources/dialog/CreateContextualIdentityDialog.html');

export default CreateContextualIdentity;
