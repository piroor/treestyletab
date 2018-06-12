/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
import * as Constants from '../../common/constants.js';
import * as Common from '../../common/common.js';
import * as Permissions from '../../common/permissions.js';
import * as Migration from '../../common/migration.js';

import l10n from '../../common/l10n.js';
import Options from '../Options.js';
import ShortcutCustomizeUI from '../ShortcutCustomizeUI.js';

// Set to the global to make compatibility with other classic sources.
window.Constants = Constants;
window.configs   = Common.configs;
window.log       = Common.log;
window.dumpTab   = Common.dumpTab;
window.wait      = Common.wait;
window.nextFrame = Common.nextFrame;
window.notify    = Common.notify;
window.Permissions = Permissions;
window.Migration = Migration;

window.l10n = l10n;
window.Options = Options;
window.ShortcutCustomizeUI = ShortcutCustomizeUI;

