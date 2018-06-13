/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
import * as Constants from '../../common/constants.js';
import * as Common from '../../common/common.js';
import * as XPath from '../../common/xpath.js';
import * as ApiTabs from '../../common/api-tabs.js';
import * as ApiTabsListener from '../../common/api-tabs-listener.js';
import * as Sidebar from '../../common/sidebar.js';
import * as Permissions from '../../common/permissions.js';
import * as ContextualIdentities from '../../common/contextual-identities.js';
import * as MetricsData from '../../common/metrics-data.js';
import * as Migration from '../../common/migration.js';
import * as ContextMenu from './context-menu.js';
import * as Background from './background.js';
import * as BackgroundCache from './cache.js';

import * as Tabs from '../../common/tabs.js';
import * as TabsContainer from '../../common/tabs-container.js';
import * as TabsUpdate from '../../common/tabs-update.js';
import * as TabsMove from '../../common/tabs-move.js';
import * as TabsOpen from '../../common/tabs-open.js';
import * as TabsInternalOperation from '../../common/tabs-internal-operation.js';
import * as TabsGroup from '../../common/tabs-group.js';
import * as TSTAPI from '../../common/tst-api.js';
import * as Bookmark from '../../common/bookmark.js';
import * as Cache from '../../common/cache.js';
import * as Tree from '../../common/tree.js';
import * as Commands from '../../common/commands.js';
import * as TabContextMenu from './tab-context-menu.js';

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
window.ApiTabsListener = ApiTabsListener;
window.Sidebar = Sidebar;
window.Permissions = Permissions;
window.ContextualIdentities = ContextualIdentities;
window.MetricsData = MetricsData;
window.ContextMenu = ContextMenu;
window.TabContextMenu = TabContextMenu;
window.Migration = Migration;
window.Background = Background;
window.BackgroundCache = BackgroundCache;

window.Tabs = Tabs;
window.TabsContainer = TabsContainer;
window.TabsUpdate = TabsUpdate;
window.TabsMove = TabsMove;
window.TabsOpen = TabsOpen;
window.TabsInternalOperation = TabsInternalOperation;
window.TabsGroup = TabsGroup;
window.TSTAPI = TSTAPI;
window.Bookmark = Bookmark;
window.Cache = Cache;
window.Tree = Tree;
window.Commands = Commands;

window.TabIdFixer = TabIdFixer;
window.TabFavIconHelper = TabFavIconHelper;
window.RichConfirm = RichConfirm;

