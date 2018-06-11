/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
import * as Constants from '../../common/module/constants.js';
import * as Common from '../../common/module/common.js';
import * as XPath from '../../common/module/xpath.js';
import * as ApiTabs from '../../common/module/api-tabs.js';
import * as Permissions from '../../common/module/permissions.js';
import * as ContextualIdentities from '../../common/module/contextual-identities.js';
import * as MetricsData from '../../common/module/MetricsData.js';
import * as Color from './color.js';

import * as Tabs from '../../common/module/tabs.js';

import MenuUI from '../../common/MenuUI.js';
import l10n from '../../common/l10n.js';
import TabIdFixer from '../../common/TabIdFixer.js';
import TabFavIconHelper from '../../common/TabFavIconHelper.js';
import RichConfirm from '../../common/RichConfirm.js';

// Set to the global to make compatibility with other classic sources.
window.Constants = Constants;
window.configs   = Common.configs;
window.log       = Common.log;
window.dumpTab   = Common.dumpTab;
window.wait      = Common.wait;
window.nextFrame = Common.nextFrame;
window.notify    = Common.notify;
window.XPath = XPath;
window.ApiTabs = ApiTabs;
window.Permissions = Permissions;
window.ContextualIdentities = ContextualIdentities;
window.MetricsData = MetricsData;
window.Color = Color;

window.Tabs = Tabs;

window.MenuUI = MenuUI;
window.l10n = l10n;
window.TabIdFixer = TabIdFixer;
window.TabFavIconHelper = TabFavIconHelper;
window.RichConfirm = RichConfirm;
