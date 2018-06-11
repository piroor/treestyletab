import * as Constants from '/common/module/constants.js';
import * as Common from '/common/module/common.js';
import * as XPath from '/common/module/xpath.js';
import * as ApiTabs from '/common/module/api-tabs.js';
import * as Permissions from '/common/module/permissions.js';
import * as ContextualIdentities from '/common/module/contextual-identities.js';
import * as MetricsData from '/common/module/MetricsData.js';
import * as Color from './color.js';

import MenuUI from '/common/MenuUI.js';
import l10n from '/common/l10n.js';
import TabIdFixer from '/common/TabIdFixer.js';
import TabFavIconHelper from '/common/TabFavIconHelper.js';
import RichConfirm from '/common/RichConfirm.js';

// Set to the global to make compatibility with other classic sources.
for (let key of Object.keys(Constants)) {
  window[key] = Constants[key];
}
for (let key of Object.keys(Common)) {
  window[key] = Common[key];
}
window.XPath = XPath;
window.ApiTabs = ApiTabs;
window.Permissions = Permissions;
window.ContextualIdentities = ContextualIdentities;
window.MetricsData = MetricsData;
window.Color = Color;

window.MenuUI = MenuUI;
window.l10n = l10n;
window.TabIdFixer = TabIdFixer;
window.TabFavIconHelper = TabFavIconHelper;
window.RichConfirm = RichConfirm;
