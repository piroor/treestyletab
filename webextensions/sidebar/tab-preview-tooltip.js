/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs,
  log as internalLogger,
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ContextualIdentities from '/common/contextual-identities.js';
import * as Permissions from '/common/permissions.js';
import * as TabsStore from '/common/tabs-store.js';
import { Tab, TreeItem } from '/common/TreeItem.js';

import InContentPanelController from '/resources/module/InContentPanelController.js';
import TabPreviewPanel from '/resources/module/TabPreviewPanel.js'; // the IMPL

import * as EventUtils from './event-utils.js';
import * as Sidebar from './sidebar.js';

import { kEVENT_TREE_ITEM_SUBSTANCE_ENTER, kEVENT_TREE_ITEM_SUBSTANCE_LEAVE } from './components/TreeItemSubstanceElement.js';

const CAPTURABLE_URLS_MATCHER         = /^(https?|data):/;
const PREVIEW_WITH_HOST_URLS_MATCHER  = /^(https?|moz-extension):/;
const PREVIEW_WITH_TITLE_URLS_MATCHER = /^file:/;

document.addEventListener(kEVENT_TREE_ITEM_SUBSTANCE_ENTER, onTabSubstanceEnter);
document.addEventListener(kEVENT_TREE_ITEM_SUBSTANCE_LEAVE, onTabSubstanceLeave);

function log(...args) {
  internalLogger('sidebar/tab-preview-tooltip', ...args);
}

const hoveringItemIds = new Set();
let mLastHoverItemId = -1;

const mTabPreviewPanel = new TabPreviewPanel(document.querySelector('#tabPreviewRoot'));
const mController = new InContentPanelController({
  type:   TabPreviewPanel.TYPE,
  logger: log,
  shouldLog() {
    return configs.logFor['sidebar/tab-preview-tooltip'] && configs.debug;
  },
  canRenderInSidebar() {
    return !!(configs.tabPreviewTooltipRenderIn & Constants.kIN_CONTENT_PANEL_RENDER_IN_SIDEBAR);
  },
  canRenderInContent() {
    return !!(configs.tabPreviewTooltipRenderIn & Constants.kIN_CONTENT_PANEL_RENDER_IN_CONTENT);
  },
  shouldFallbackToSidebar() {
    return !!(configs.tabPreviewTooltipRenderIn & Constants.kIN_CONTENT_PANEL_RENDER_IN_SIDEBAR);
  },
  canSendPossibleExpiredMessage(message) {
    return (
      message.type != `treestyletab:${TabPreviewPanel.TYPE}:show` ||
      hoveringItemIds.has(message.targetId)
    );
  },
  UIClass:         TabPreviewPanel,
  inSidebarUI:     mTabPreviewPanel,
  initializerCode: `
    const root = document.createElement('div');
    appendClosedContents(root);
    const tabPreviewPanel = new TabPreviewPanel(root);

    let destroy;

    const onMouseMove = event => {
      const onPanel = !!event.originalTarget?.closest('.in-content-panel.extended')
      if (logging) {
        console.log('mouse move on the content area: ', { onPanel });
      }
      if (onPanel) {
        browser.runtime.sendMessage({
          type: 'treestyletab:${TabPreviewPanel.TYPE}:keep',
          timestamp: Date.now(),
        });
        return;
      }
      if (logging) {
        console.log('=> destroy tab preview container');
      }
      document.documentElement.removeEventListener('mousemove', onMouseMove);
      browser.runtime.sendMessage({
        type: 'treestyletab:${TabPreviewPanel.TYPE}:hide',
        timestamp: Date.now(),
      });
      destroyClosedContents(destroy);
    };
    document.documentElement.addEventListener('mousemove', onMouseMove);

    destroy = createClosedContentsDestructor(tabPreviewPanel, () => {
      window.removeEventListener('mousemove', onMouseMove);
    });

    return tabPreviewPanel;
  `,
});

async function onTabSubstanceEnter(event) {
  const timestamp = Date.now();

  const canCaptureTab = Permissions.isGrantedSync(Permissions.ALL_URLS);
  if (!canCaptureTab)
    return;

  const windowId = TabsStore.getCurrentWindowId();
  const activeTab = Tab.getActiveTab(windowId) || (await browser.tabs.query({ active: true, windowId }))[0];

  if (!configs.tabPreviewTooltip ||
      !(configs.tabPreviewTooltipRenderIn & Constants.kIN_CONTENT_PANEL_RENDER_IN_ANYWHERE)) {
    mController.hideIn(activeTab.id);
    return;
  }

  const substance = event.target;
  const raw       = substance?.raw;

  if (!raw ||
      (raw.type != TreeItem.TYPE_TAB &&
       raw.type != TreeItem.TYPE_GROUP) ||
      document.documentElement.classList.contains(Constants.kTABBAR_STATE_TAB_DRAGGING)) {
    return;
  }

  const active = raw?.id == activeTab.id;
  const url = PREVIEW_WITH_HOST_URLS_MATCHER.test(raw?.url) ? new URL(raw?.url).host :
    PREVIEW_WITH_TITLE_URLS_MATCHER.test(raw?.url) ? null :
      raw?.url;
  const hasCustomTooltip = !!substance.hasCustomTooltip;

  if (raw?.type == TreeItem.TYPE_GROUP &&
      !hasCustomTooltip) {
    return;
  }

  const hasPreview = (
    raw?.type == TreeItem.TYPE_TAB &&
    !active &&
    !raw?.discarded &&
    CAPTURABLE_URLS_MATCHER.test(raw?.url) &&
    !hasCustomTooltip
  );
  const previewURL = (
    hasPreview &&
    canCaptureTab &&
    configs.tabPreviewTooltip &&
    (async () => { // We just define a getter function for now, because further operations may contain async operations and we can call this at there for more optimization.
      try {
        return await browser.tabs.captureTab(raw?.id);
      }
      catch(_error) {
      }
      return null;
    })
  ) || null;

  if (!substance.raw)
    return;

  log(`onTabSubstanceEnter(${raw.id}}) start `, { hasCustomTooltip }, timestamp);

  hoveringItemIds.add(raw.id);
  mLastHoverItemId = raw.id;

  const contextualIdentity = raw.cookieStoreId && raw.cookieStoreId != 'firefox-default' ? ContextualIdentities.get(raw.cookieStoreId) : null;

  const succeeded = await mController.show({
    anchorItem:    raw,
    targetItem:    raw,
    messageParams: {
      hasCustomTooltip,
      ...(hasCustomTooltip ?
        {
          tooltipHtml: substance.appliedTooltipHtml,
        } :
        {
          title: raw.title,
          url,
          contextualIdentity,
        }
      ),
      hasPreview,
      previewURL:           null,
      // This is required to simulate the behavior:
      // show tab preview panel with delay only when the panel is not shown yet.
      waitInitialShowUntil: timestamp + Math.max(configs.tabPreviewTooltipDelayMsec, 0),
    },
    promisedMessageParams: new Promise(async (resolve, _reject) => {
      const promisedPreviewURL = typeof previewURL == 'function' && previewURL();
      if (!promisedPreviewURL) {
        return resolve(null);
      }
      resolve({
        previewURL: await promisedPreviewURL,
      });
    }),
    canRenderInSidebar() {
      return !!(configs.tabPreviewTooltipRenderIn & Constants.kIN_CONTENT_PANEL_RENDER_IN_SIDEBAR) &&
        !(hasCustomTooltip && configs.showCollapsedDescendantsByLegacyTooltipOnSidebar);
    },
    shouldFallbackToSidebar() {
      return !!(configs.tabPreviewTooltipRenderIn & Constants.kIN_CONTENT_PANEL_RENDER_IN_SIDEBAR) &&
        !(hasCustomTooltip && configs.showCollapsedDescendantsByLegacyTooltipOnSidebar);
    },
  });

  if (!substance.raw) // the tab may be destroyed while capturing tab preview
    return;

  if (substance.closest('tab-item')?.parentNode &&
      succeeded)
    substance.invalidateTooltip();
}
onTabSubstanceEnter = EventUtils.wrapWithErrorHandler(onTabSubstanceEnter);

let mDelayedHideOnTabSubstanceLeaveTimer = 0;
async function onTabSubstanceLeave(event) {
  const timestamp = Date.now();
  const substance = event.target;
  const raw       = substance?.raw;
  if (!raw)
    return;

  hoveringItemIds.delete(raw.id);

  if (substance?.hasCustomTooltip) {
    if (mDelayedHideOnTabSubstanceLeaveTimer) {
      clearTimeout(mDelayedHideOnTabSubstanceLeaveTimer);
    }
    mDelayedHideOnTabSubstanceLeaveTimer = setTimeout(() => {
      mLastHoverItemId = -1;
      mDelayedHideOnTabSubstanceLeaveTimer = 0;
      if (!document.querySelector('.in-content-panel-root.tab-preview-panel.extended .in-content-panel:hover')) {
        mController.hide({ targetItem: raw, timestamp });
      }
    }, configs.showCollapsedDescendantsMouseleaveMaxDelay);
  }
  else {
    mController.hide({ targetItem: raw, timestamp });
  }
}
onTabSubstanceLeave = EventUtils.wrapWithErrorHandler(onTabSubstanceLeave);

Sidebar.onReady.addListener(() => {
  const windowId = TabsStore.getCurrentWindowId();
  mTabPreviewPanel.windowId = windowId;
});

function hideOnUserAction(timestamp) {
  hoveringItemIds.clear();
  mLastHoverItemId = -1;

  mController.hideInSidebar({ timestamp });

  const activeTab = Tab.getActiveTab(TabsStore.getCurrentWindowId());
  if (activeTab) {
    mController.hide({ timestamp });
  }
}

let mDelayedHideOnTabbarLeaveTimer = 0;
document.querySelector('#tabbar').addEventListener('mouseleave', () => {
  const timestamp = Date.now();
  log('mouse is left from the tab bar ', timestamp);
  const item = TreeItem.get(mLastHoverItemId);
  const itemElement = item?.$TST?.element;
  if (itemElement?.substanceElement?.hasCustomTooltip) {
    if (mDelayedHideOnTabbarLeaveTimer) {
      clearTimeout(mDelayedHideOnTabbarLeaveTimer);
    }
    mDelayedHideOnTabbarLeaveTimer = setTimeout(() => {
      mDelayedHideOnTabbarLeaveTimer = 0;
      if (!document.querySelector('.in-content-panel-root.tab-preview-panel.extended .in-content-panel:hover')) {
        hideOnUserAction(timestamp);
      }
    }, configs.showCollapsedDescendantsMouseleaveMaxDelay);
    return;
  }
  else {
    hideOnUserAction(timestamp);
  }
});

document.querySelector('#tabbar').addEventListener('dragover', () => {
  const timestamp = Date.now();
  log('mouse is dragover on the tab bar ', timestamp);
  hideOnUserAction(timestamp);
});

browser.runtime.onMessage.addListener((message, sender) => {
  const activeTab = Tab.getActiveTab(TabsStore.getCurrentWindowId());
  if (!activeTab ||
      sender.tab?.id != activeTab.id) {
    return;
  }
  switch (message?.type) {
    case 'treestyletab:' + TabPreviewPanel.TYPE + ':keep':
      if (mDelayedHideOnTabSubstanceLeaveTimer) {
        clearTimeout(mDelayedHideOnTabSubstanceLeaveTimer);
        mDelayedHideOnTabSubstanceLeaveTimer = 0;
      }
      if (mDelayedHideOnTabbarLeaveTimer) {
        clearTimeout(mDelayedHideOnTabbarLeaveTimer);
        mDelayedHideOnTabbarLeaveTimer = 0;
      }
      break;
  }
});
