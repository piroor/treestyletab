/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/resources/dialog/RichConfirmWithUserStyles.js';

import {
  configs,
} from '/common/common.js';

class EditContextualIdentity extends RichConfirm {
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
      needsColors ? this.getSupportedColors() : params.colors,
      needsIcons  ? this.getSupportedIcons()  : params.icons,
    ]);
    const style = configs.style == 'nova' ? 'nova' : 'proton';
    return { ...params, colors, icons, style };
  }

  static async show(params, onDialogOpened = null) {
    return super.show(await this.withColorsAndIcons(params), onDialogOpened);
  }

  static async getSupportedColors() {
    // Firefox 153 and later
    if (typeof browser.contextualIdentities.getSupportedColors == 'function')
      return browser.contextualIdentities.getSupportedColors().catch(() => []);

    // Firefox 152 and older
    return [
      { color: 'toolbar',   colorCode: '#949297' }, // 'gray', (new in Firefox 153)
      { color: 'yellow',    colorCode: '#db820e' },
      { color: 'orange',    colorCode: '#f4682c' },
      { color: 'red',       colorCode: '#ed566e' },
      { color: 'pink',      colorCode: '#db54bf' },
      { color: 'purple',    colorCode: '#b864ee' },
      //{ color: 'violet',    colorCode: '#9871ff' }, (new in Firefox 153)
      { color: 'blue',      colorCode: '#5a87fd' },
      { color: 'turquoise', colorCode: '#10a4ca' }, // 'cyan', (new in Firefox 153)
      { color: 'green',     colorCode: '#11ae84' },
    ];
  }

  static async getSupportedIcons() {
    // Firefox 153 and later
    if (typeof browser.contextualIdentities.getSupportedIcons == 'function')
      return browser.contextualIdentities.getSupportedIcons().catch(() => []);

    // Firefox 152 and older
    return [
      'briefcase',
      'cart',
      'chill',
      'circle',
      'dollar',
      'fence',
      'fingerprint',
      'food',
      'fruit',
      'gift',
      'pet',
      'tree',
      'vacation',
    ].map(icon => ({ icon }));
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
EditContextualIdentity.Dialog = null;
EditContextualIdentity.init('/resources/dialog/EditContextualIdentityDialog.html');

export default EditContextualIdentity;
