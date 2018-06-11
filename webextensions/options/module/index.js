import * as Constants from '../../common/module/constants.js';
import * as Common from '../../common/module/common.js';
import * as Permissions from '../../common/module/permissions.js';

import l10n from '../l10n.js';
import Options from '../Options.js';
import ShortcutCustomizeUI from '../ShortcutCustomizeUI.js';

// Set to the global to make compatibility with other classic sources.
for (let key of Object.keys(Constants)) {
  window[key] = Constants[key];
}
for (let key of Object.keys(Common)) {
  window[key] = Common[key];
}
window.Permissions = Permissions;

window.l10n = l10n;
window.Options = Options;
window.ShortcutCustomizeUI = ShortcutCustomizeUI;

