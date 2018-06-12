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
import * as ContextMenu from './context-menu.js';
import * as MetricsData from '../../common/module/MetricsData.js';

import * as Tabs from '../../common/module/tabs.js';
import * as TabsContainer from '../../common/module/tabs-container.js';
import * as TabsMove from '../../common/module/tabs-move.js';
import * as TabsOpen from '../../common/module/tabs-open.js';
import * as TSTAPI from '../../common/module/tst-api.js';

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
window.ContextMenu = ContextMenu;
window.MetricsData = MetricsData;

window.Tabs = Tabs;
window.TabsContainer = TabsContainer;
window.TabsMove = TabsMove;
window.TabsOpen = TabsOpen;
window.TSTAPI = TSTAPI;

window.TabIdFixer = TabIdFixer;
window.TabFavIconHelper = TabFavIconHelper;
window.RichConfirm = RichConfirm;

