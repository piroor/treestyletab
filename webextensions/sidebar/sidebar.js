/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '/extlib/RichConfirm.js';
import TabIdFixer from '/extlib/TabIdFixer.js';

import {
  log as internalLogger,
  nextFrame,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as ApiTabsListener from '/common/api-tabs-listener.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as TabsMove from '/common/tabs-move.js';
import * as Tree from '/common/tree.js';
import * as TSTAPI from '/common/tst-api.js';
import * as ContextualIdentities from '/common/contextual-identities.js';
import * as Commands from '/common/commands.js';
import * as Bookmark from '/common/bookmark.js';
import * as UserOperationBlocker from '/common/user-operation-blocker.js';
import * as MetricsData from '/common/metrics-data.js';

import Tab from '/common/Tab.js';
import Window from '/common/Window.js';

import * as SidebarCache from './sidebar-cache.js';
import * as SidebarTabs from './sidebar-tabs.js';
import * as PinnedTabs from './pinned-tabs.js';
import * as DragAndDrop from './drag-and-drop.js';
import * as TabDragHandle from './tab-drag-handle.js';
import * as RestoringTabCount from './restoring-tab-count.js';
import * as Size from './size.js';
import * as Color from './color.js';
import * as Indent from './indent.js';
import * as Scroll from './scroll.js';
import * as TabContextMenu from './tab-context-menu.js';

import EventListenerManager from '/extlib/EventListenerManager.js';

function log(...args) {
  internalLogger('sidebar/sidebar', ...args);
}

export const onInit    = new EventListenerManager();
export const onBuilt   = new EventListenerManager();
export const onReady   = new EventListenerManager();


let mStyle;
let mTargetWindow = null;
let mInitialized = false;

const mTabBar                     = document.querySelector('#tabbar');
const mAfterTabsForOverflowTabBar = document.querySelector('#tabbar ~ .after-tabs');
const mStyleLoader                = document.querySelector('#style-loader');
const mBrowserThemeDefinition     = document.querySelector('#browser-theme-definition');
const mUserStyleRules             = document.querySelector('#user-style-rules');
const mContextualIdentitiesStyle  = document.querySelector('#contextual-identity-styling');

{ // apply style ASAP!
  // allow customiation for platform specific styles with selectors like `:root[data-user-agent*="Windows NT 10"]`
  document.documentElement.dataset.userAgent = navigator.userAgent;

  const style = location.search.match(/style=([^&]+)/);
  if (style)
    applyStyle(style[1]);
  else
    configs.$loaded.then(() => applyStyle());

  configs.$loaded.then(applyUserStyleRules);
}

UserOperationBlocker.block({ throbber: true });

export async function init() {
  MetricsData.add('init: start');
  log('initialize sidebar on load');

  let promisedAllTabsTracked;
  const [nativeTabs] = await Promise.all([
    MetricsData.addAsync('getting native tabs', async () => {
      const tabs = await MetricsData.addAsync('browser.tabs.query', browser.tabs.query({ currentWindow: true }).catch(ApiTabs.createErrorHandler()));
      mTargetWindow = tabs[0].windowId;
      TabsStore.setWindow(mTargetWindow);
      internalLogger.context   = `Sidebar-${mTargetWindow}`;

      // Track only the first tab for now, because it is required to initialize
      // the container and it will be used by the SidebarCache module.
      TabIdFixer.fixTab(tabs[0]);
      Tab.track(tabs[0]);

      promisedAllTabsTracked = MetricsData.addAsync('tracking all native tabs', async () => {
        let count = 0;
        for (const tab of tabs.slice(1)) {
          TabIdFixer.fixTab(tab);
          Tab.track(tab);
          if (count++ > 100) {
            count = 0;
            await nextFrame(); // initialize tabs progressively
          }
        }
      });

      PinnedTabs.init();
      Indent.init();

      SidebarCache.init();
      SidebarCache.onRestored.addListener(() => { DragAndDrop.clearDropPosition(); });

      return tabs;
    }),
    configs.$loaded
  ]);
  MetricsData.add('browser.tabs.query finish, SidebarCache initialized, configs are loaded.');

  onConfigChange('colorScheme');
  onConfigChange('simulateSVGContextFill');
  onInit.dispatch();

  const promisedScrollPosition = browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SCROLL_POSITION).catch(ApiTabs.createErrorHandler());
  const promisedInitializedContextualIdentities = ContextualIdentities.init();

  const [importedTabs] = await Promise.all([
    MetricsData.addAsync('importTabsFromBackground()', importTabsFromBackground()),
    MetricsData.addAsync('promisedAllTabsTracked', promisedAllTabsTracked)
  ]);

  let cachedContents;
  let restoredFromCache;
  await MetricsData.addAsync('parallel initialization', Promise.all([
    MetricsData.addAsync('parallel initialization: main', async () => {
      if (configs.useCachedTree)
        await MetricsData.addAsync('parallel initialization: main: read cached sidebar contents', async () => {
          cachedContents = await SidebarCache.getEffectiveWindowCache({ tabs: importedTabs });
        });
      restoredFromCache = await MetricsData.addAsync('parallel initialization: main: rebuildAll', rebuildAll(nativeTabs, importedTabs, cachedContents && cachedContents.tabbar));
      ApiTabsListener.startListen();

      browser.runtime.connect({
        name: `${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}${mTargetWindow}`
      });
      if (browser.theme && browser.theme.getCurrent) // Firefox 58 and later
        browser.theme.getCurrent(mTargetWindow).then(applyBrowserTheme);
      else
        applyBrowserTheme();

      configs.$addObserver(onConfigChange);
      onConfigChange('debug');
      onConfigChange('sidebarPosition');
      onConfigChange('sidebarDirection');
      onConfigChange('sidebarScrollbarPosition');
      onConfigChange('scrollbarMode');
      onConfigChange('showContextualIdentitiesSelector');
      onConfigChange('showNewTabActionSelector');

      document.addEventListener('focus', onFocus);
      document.addEventListener('blur', onBlur);
      window.addEventListener('resize', onResize);
      mTabBar.addEventListener('transitionend', onTransisionEnd);

      if (browser.theme && browser.theme.onUpdated) // Firefox 58 and later
        browser.theme.onUpdated.addListener(onBrowserThemeChanged);

      browser.runtime.onMessage.addListener(onMessage);

      onBuilt.dispatch();

      DragAndDrop.init();
      TabDragHandle.init();
    }),
    MetricsData.addAsync('parallel initialization: Size', async () => {
      Size.init();
    }),
    MetricsData.addAsync('parallel initialization: contextual identities', async () => {
      await promisedInitializedContextualIdentities;
      updateContextualIdentitiesStyle();
      updateContextualIdentitiesSelector();
      ContextualIdentities.startObserve();
    }),
    MetricsData.addAsync('parallel initialization: TabContextMenu', async () => {
      TabContextMenu.init();
    }),
    MetricsData.addAsync('parallel initialization: API for other addons', TSTAPI.initAsFrontend())
  ]));

  await MetricsData.addAsync('parallel initialization: post process', Promise.all([
    MetricsData.addAsync('parallel initialization: post process: main', async () => {
      SidebarCache.startTracking();
      Indent.updateRestoredTree(cachedContents && cachedContents.indent);
      if (!restoredFromCache) {
        SidebarTabs.updateAll();
        SidebarCache.reserveToUpdateCachedTabbar();
      }
      updateTabbarLayout({ justNow: true });

      SidebarTabs.init();

      onConfigChange('animation');
      onReady.dispatch();
    }),
    MetricsData.addAsync('parallel initialization: post process: Scroll.init', async () => {
      Scroll.init(await promisedScrollPosition);
    })
  ]));

  document.documentElement.classList.remove('initializing');
  mInitialized = true;
  UserOperationBlocker.unblock({ throbber: true });

  MetricsData.add('init: end');
  if (configs.debug)
    log(`Startup metrics for ${Tab.getTabs(mTargetWindow).length} tabs: `, MetricsData.toString());
}

function applyStyle(style) {
  mStyle = style || configs.style;
  switch (mStyle) {
    case 'metal':
      mStyleLoader.setAttribute('href', 'styles/metal/metal.css');
      break;
    case 'sidebar':
      mStyleLoader.setAttribute('href', 'styles/sidebar/sidebar.css');
      break;
    case 'mixed':
      mStyleLoader.setAttribute('href', 'styles/square/mixed.css');
      break;
    case 'vertigo':
      mStyleLoader.setAttribute('href', 'styles/square/vertigo.css');
      break;
    case 'plain-dark':
      mStyleLoader.setAttribute('href', 'styles/square/plain-dark.css');
      break;
    case 'plain':
    case 'flat': // for backward compatibility, fall back to plain.
      mStyleLoader.setAttribute('href', 'styles/square/plain.css');
      break;
    case 'highcontrast':
      mStyleLoader.setAttribute('href', 'styles/square/highcontrast.css');
      break;
    default:
      // as the base of customization. see also:
      // https://github.com/piroor/treestyletab/issues/1604
      mStyleLoader.setAttribute('href', 'data:text/css,');
      break;
  }
  return new Promise((resolve, _reject) => {
    mStyleLoader.addEventListener('load', () => {
      nextFrame().then(resolve);
    }, { once: true });
  });
}

function applyUserStyleRules() {
  mUserStyleRules.textContent = configs.userStyleRules || '';
}

function applyBrowserTheme(theme) {
  log('applying theme ', theme);

  const baseColor = Color.parseCSSColor(window.getComputedStyle(document.querySelector('#dummy-favicon-size-box'), null).backgroundColor);
  const highlightColor = Color.parseCSSColor(window.getComputedStyle(document.querySelector('#dummy-highlight-color-box'), null).backgroundColor);
  const defaultColors = `:root {
    --face-highlight-lighter: ${Color.mixCSSColors(baseColor, Object.assign({}, highlightColor, { alpha: 0.35 }),)};
    --face-highlight-more-lighter: ${Color.mixCSSColors(baseColor, Object.assign({}, highlightColor, { alpha: 0.2 }))};
    --face-highlight-more-more-lighter: ${Color.mixCSSColors(baseColor, Object.assign({}, highlightColor, { alpha: 0.1 }))};
    --face-gradient-start-active: rgba(${baseColor.red}, ${baseColor.green}, ${baseColor.blue}, 0.4);
    --face-gradient-start-inactive: rgba(${baseColor.red}, ${baseColor.green}, ${baseColor.blue}, 0.2);
    --face-gradient-end: rgba(${baseColor.red}, ${baseColor.green}, ${baseColor.blue}, 0);
  }`;

  if (!theme || !theme.colors) {
    mBrowserThemeDefinition.textContent = defaultColors;
    return;
  }
  const extraColors = [];
  let bgAlpha = 1;
  if (theme.images) {
    if (theme.images.headerURL)
      extraColors.push(`--browser-header-url: url(${JSON.stringify(theme.images.headerURL)})`);
    if (Array.isArray(theme.images.additional_backgrounds) &&
        theme.images.additional_backgrounds.length > 0) {
      extraColors.push(`--browser-bg-url: url(${JSON.stringify(theme.images.additional_backgrounds[0])})`);
      bgAlpha = 0.75;
    }
  }
  const themeBaseColor = Color.mixCSSColors(theme.colors.accentcolor, 'rgba(0, 0, 0, 0)', bgAlpha);
  let toolbarColor = Color.mixCSSColors(themeBaseColor, 'rgba(255, 255, 255, 0.4)', bgAlpha);
  if (theme.colors.toolbar)
    toolbarColor = Color.mixCSSColors(themeBaseColor, theme.colors.toolbar);
  if (theme.colors.tab_line)
    extraColors.push(`--browser-tab-highlighter: ${theme.colors.tab_line}`);
  if (theme.colors.tab_loading)
    extraColors.push(`--browser-loading-indicator: ${theme.colors.tab_loading}`);
  mBrowserThemeDefinition.textContent = `
    ${defaultColors}
    :root {
      --browser-background:      ${theme.colors.accentcolor};
      --browser-bg-base:         ${themeBaseColor};
      --browser-bg-less-lighter: ${Color.mixCSSColors(themeBaseColor, 'rgba(255, 255, 255, 0.25)', bgAlpha)};
      --browser-bg-lighter:      ${toolbarColor};
      --browser-bg-more-lighter: ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.6)', bgAlpha)};
      --browser-bg-lightest:     ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.85)', bgAlpha)};
      --browser-bg-less-darker:  ${Color.mixCSSColors(themeBaseColor, 'rgba(0, 0, 0, 0.1)', bgAlpha)};
      --browser-bg-darker:       ${Color.mixCSSColors(themeBaseColor, 'rgba(0, 0, 0, 0.25)', bgAlpha)};
      --browser-bg-more-darker:  ${Color.mixCSSColors(themeBaseColor, 'rgba(0, 0, 0, 0.5)', bgAlpha)};
      --browser-fg:              ${theme.colors.textcolor};
      --browser-fg-active:       ${theme.colors.toolbar_text || theme.colors.textcolor};
      --browser-border:          ${Color.mixCSSColors(theme.colors.textcolor, 'rgba(0, 0, 0, 0)', 0.4)};
      ${extraColors.join(';\n')}
    }
  `;
}

function updateContextualIdentitiesStyle() {
  const definitions = [];
  ContextualIdentities.forEach(identity => {
    if (!identity.colorCode)
      return;
    definitions.push(`
      .tab.contextual-identity-${identity.cookieStoreId} .contextual-identity-marker {
        background-color: ${identity.colorCode};
      }
    `);
  });
  mContextualIdentitiesStyle.textContent = definitions.join('\n');
}

function updateContextualIdentitiesSelector() {
  const anchors = document.querySelectorAll(`.${Constants.kCONTEXTUAL_IDENTITY_SELECTOR}-marker`);
  for (const anchor of anchors) {
    if (ContextualIdentities.getCount() == 0)
      anchor.setAttribute('disabled', true);
    else
      anchor.removeAttribute('disabled');
  }

  const selector = document.getElementById(Constants.kCONTEXTUAL_IDENTITY_SELECTOR);
  const range    = document.createRange();
  range.selectNodeContents(selector);
  range.deleteContents();

  const fragment = document.createDocumentFragment();
  ContextualIdentities.forEach(identity => {
    const item = document.createElement('li');
    item.dataset.value = identity.cookieStoreId;
    item.textContent = identity.name;
    item.dataset.icon = identity.iconUrl;
    fragment.appendChild(item);
  });
  if (configs.inheritContextualIdentityToNewChildTab) {
    const defaultCotnainerItem = document.createElement('li');
    defaultCotnainerItem.dataset.value = 'firefox-default';
    defaultCotnainerItem.textContent = browser.i18n.getMessage('tabbar_newTabWithContexualIdentity_default');
    const icon = document.createElement('span');
    icon.classList.add('icon');
    defaultCotnainerItem.insertBefore(icon, defaultCotnainerItem.firstChild);
    fragment.appendChild(defaultCotnainerItem);
  }
  range.insertNode(fragment);
  range.detach();
}

export async function rebuildAll(tabs, importedTabs, cache) {
  MetricsData.add('rebuildAll: start');
  const range = document.createRange();
  range.selectNodeContents(SidebarTabs.wholeContainer);
  range.deleteContents();
  range.detach();

  const trackedWindow = TabsStore.windows.get(mTargetWindow);
  if (!trackedWindow)
    Window.init(mTargetWindow);

  tabs = importedTabs.map(importedTab => Tab.import(importedTab));

  if (cache) {
    const restored = await SidebarCache.restoreTabsFromCache(cache, { tabs });
    if (restored) {
      MetricsData.add('rebuildAll: end (from cache)');
      return true;
    }
  }

  // Re-get tabs before rebuilding tree, because they can be modified while
  // waiting for SidebarCache.restoreTabsFromCache().
  await MetricsData.addAsync('rebuildAll: re-import tabs before rebuilding tree', async () => {
    const [nativeTabs, importedTabs] = await Promise.all([
      browser.tabs.query({ windowId: mTargetWindow }).catch(ApiTabs.createErrorHandler()),
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_PULL_TABS,
        windowId: mTargetWindow
      })
    ]);
    tabs = nativeTabs.map((tab, index) => {
      Tab.track(tab);
      return importedTabs[index] && Tab.import(importedTabs[index]) || tab;
    });
  });

  const window = Window.init(mTargetWindow);
  window.element.parentNode.removeChild(window.element); // remove from the document for better pefromance
  for (const tab of tabs) {
    const trackedTab = Tab.init(tab, { existing: true, inRemote: true });
    TabsUpdate.updateTab(trackedTab, tab, { forceApply: true });
    SidebarTabs.applyCollapseExpandStateToElement(trackedTab);
    if (tab.active)
      TabsInternalOperation.setTabActive(trackedTab);
  }
  SidebarTabs.wholeContainer.appendChild(window.element);
  MetricsData.add('rebuildAll: end (from scratch)');
  return false;
}

async function importTabsFromBackground() {
  try {
    const importedTabs = await MetricsData.addAsync('importTabsFromBackground: kCOMMAND_PING_TO_BACKGROUND', browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_PING_TO_BACKGROUND,
      windowId: mTargetWindow
    }).catch(ApiTabs.createErrorHandler()));
    if (importedTabs)
      return importedTabs;
  }
  catch(_e) {
  }
  return MetricsData.addAsync('importTabsFromBackground: kCOMMAND_PING_TO_SIDEBAR', new Promise((resolve, _reject) => {
    const onBackgroundIsReady = (message, _sender, _respond) => {
      if (!message ||
          !message.type ||
          message.type != Constants.kCOMMAND_PING_TO_SIDEBAR ||
          message.windowId != mTargetWindow)
        return;
      browser.runtime.onMessage.removeListener(onBackgroundIsReady);
      resolve(message.tabs);
    };
    browser.runtime.onMessage.addListener(onBackgroundIsReady);
  }));
}


export async function confirmToCloseTabs(tabIds, _options = {}) {
  tabIds = tabIds.filter(id => !configs.grantedRemovingTabIds.includes(id));
  const count = tabIds.length;
  if (count <= 1 ||
      !configs.warnOnCloseTabs)
    return true;

  const confirm = new RichConfirm({
    message: browser.i18n.getMessage('warnOnCloseTabs_message', [count]),
    buttons: [
      browser.i18n.getMessage('warnOnCloseTabs_close'),
      browser.i18n.getMessage('warnOnCloseTabs_cancel')
    ],
    checkMessage: browser.i18n.getMessage('warnOnCloseTabs_warnAgain'),
    checked: true
  });
  const result = await confirm.show();
  switch (result.buttonIndex) {
    case 0:
      if (!result.checked)
        configs.warnOnCloseTabs = false;
      configs.lastConfirmedToCloseTabs = Date.now();
      configs.grantedRemovingTabIds = Array.from(new Set((configs.grantedRemovingTabIds || []).concat(tabIds)));
      log('confirmToCloseTabs: granted ', configs.grantedRemovingTabIds);
      return true;
    default:
      return false;
  }
}
Commands.onTabsClosing.addListener(confirmToCloseTabs);
TabContextMenu.onTabsClosing.addListener(confirmToCloseTabs);


export function reserveToUpdateTabbarLayout(options = {}) {
  //log('reserveToUpdateTabbarLayout');
  if (reserveToUpdateTabbarLayout.waiting)
    clearTimeout(reserveToUpdateTabbarLayout.waiting);
  if (options.reason && !(reserveToUpdateTabbarLayout.reasons & options.reason))
    reserveToUpdateTabbarLayout.reasons |= options.reason;
  const timeout = options.timeout || 10;
  reserveToUpdateTabbarLayout.timeout = Math.max(timeout, reserveToUpdateTabbarLayout.timeout);
  reserveToUpdateTabbarLayout.waiting = setTimeout(() => {
    delete reserveToUpdateTabbarLayout.waiting;
    const reasons = reserveToUpdateTabbarLayout.reasons;
    reserveToUpdateTabbarLayout.reasons = 0;
    reserveToUpdateTabbarLayout.timeout = 0;
    updateTabbarLayout({ reasons });
  }, reserveToUpdateTabbarLayout.timeout);
}
reserveToUpdateTabbarLayout.reasons = 0;
reserveToUpdateTabbarLayout.timeout = 0;

function updateTabbarLayout(params = {}) {
  if (RestoringTabCount.hasMultipleRestoringTabs()) {
    log('updateTabbarLayout: skip until completely restored');
    reserveToUpdateTabbarLayout({
      reason:  params.reasons,
      timeout: Math.max(100, params.timeout)
    });
    return;
  }
  //log('updateTabbarLayout');
  const range = document.createRange();
  range.selectNodeContents(mTabBar);
  const containerHeight = mTabBar.getBoundingClientRect().height;
  const contentHeight   = range.getBoundingClientRect().height;
  //log('height: ', { container: containerHeight, content: contentHeight });
  const overflow = containerHeight < contentHeight;
  if (overflow && !mTabBar.classList.contains(Constants.kTABBAR_STATE_OVERFLOW)) {
    //log('overflow');
    mTabBar.classList.add(Constants.kTABBAR_STATE_OVERFLOW);
    const range = document.createRange();
    range.selectNode(mAfterTabsForOverflowTabBar.querySelector('.newtab-button-box'));
    const offset = range.getBoundingClientRect().height;
    range.detach();
    mTabBar.style.bottom = `${offset}px`;
    nextFrame().then(() => {
      // Tab at the end of the tab bar can be hidden completely or
      // partially (newly opened in small tab bar, or scrolled out when
      // the window is shrunken), so we need to scroll to it explicitely.
      const activeTab = Tab.getActiveTab(TabsStore.getWindow());
      if (activeTab && !Scroll.isTabInViewport(activeTab)) {
        log('scroll to active tab on updateTabbarLayout');
        Scroll.scrollToTab(activeTab);
        return;
      }
      const lastOpenedTab = Tab.getLastOpenedTab(TabsStore.getWindow());
      const reasons       = params.reasons || 0;
      if (reasons & Constants.kTABBAR_UPDATE_REASON_TAB_OPEN &&
          !Scroll.isTabInViewport(lastOpenedTab)) {
        log('scroll to last opened tab on updateTabbarLayout ', reasons);
        Scroll.scrollToTab(lastOpenedTab, {
          anchor:            activeTab,
          notifyOnOutOfView: true
        });
      }
    });
  }
  else if (!overflow && mTabBar.classList.contains(Constants.kTABBAR_STATE_OVERFLOW)) {
    //log('underflow');
    mTabBar.classList.remove(Constants.kTABBAR_STATE_OVERFLOW);
    mTabBar.style.bottom = '';
  }

  if (params.justNow)
    PinnedTabs.reposition(params);
  else
    PinnedTabs.reserveToReposition(params);
}


function onFocus(_event) {
  browser.runtime.sendMessage({
    type:     Constants.kNOTIFY_SIDEBAR_FOCUS,
    windowId: mTargetWindow
  }).catch(ApiTabs.createErrorSuppressor());
}

function onBlur(_event) {
  browser.runtime.sendMessage({
    type:     Constants.kNOTIFY_SIDEBAR_BLUR,
    windowId: mTargetWindow
  }).catch(ApiTabs.createErrorSuppressor());
}

function onResize(_event) {
  reserveToUpdateTabbarLayout({
    reason: Constants.kTABBAR_UPDATE_REASON_RESIZE
  });
}

function onTransisionEnd(event) {
  if (event.pseudoElement || // ignore size change of pseudo elements because they won't change height of tabbar contents
      !event.target.classList.contains('tab') || // ignore animations of twisty or something inside tabs
      /opacity|color|text-shadow/.test(event.propertyName))
    return;
  //log('transitionend ', event);
  reserveToUpdateTabbarLayout({
    reason: Constants.kTABBAR_UPDATE_REASON_ANIMATION_END
  });
}

function onBrowserThemeChanged(updateInfo) {
  if (!updateInfo.windowId || // reset to default
      updateInfo.windowId == mTargetWindow)
    applyBrowserTheme(updateInfo.theme);
}


Tab.onCreated.addListener((_tab, _info) => {
  reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_TAB_OPEN,
    timeout: configs.collapseDuration
  });
});

Tab.onRemoving.addListener((tab, removeInfo) => {
  if (removeInfo.isWindowClosing)
    return;

  const closeParentBehavior = Tree.getCloseParentBehaviorForTabWithSidebarOpenState(tab, removeInfo);
  if (closeParentBehavior != Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
      tab.$TST.subtreeCollapsed)
    Tree.collapseExpandSubtree(tab, {
      collapsed: false
    });

  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  Tree.detachTab(tab, {
    dontUpdateIndent: true
  });

  reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_TAB_CLOSE,
    timeout: configs.collapseDuration
  });
});

Tab.onMoved.addListener((_tab, _info) => {
  reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_TAB_MOVE,
    timeout: configs.collapseDuration
  });
});

Tab.onDetached.addListener((tab, _info) => {
  if (!TabsStore.ensureLivingTab(tab))
    return;
  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  Tree.detachTab(tab, {
    dontUpdateIndent: true
  });
});

Tab.onRestoring.addListener(tab => {
  if (!configs.useCachedTree) // we cannot know when we should unblock on no cache case...
    return;

  const window = TabsStore.windows.get(tab.windowId);
  // When we are restoring two or more tabs.
  // (But we don't need do this again for third, fourth, and later tabs.)
  if (window.restoredCount == 2)
    UserOperationBlocker.block({ throbber: true });
});

// Tree restoration for "Restore Previous Session"
Tab.onWindowRestoring.addListener(async windowId => {
  if (!configs.useCachedTree)
    return;

  log('Tabs.onWindowRestoring');
  const window = TabsStore.windows.get(windowId);
  const restoredCount = await window.allTabsRestored;
  if (restoredCount == 1) {
    log('Tabs.onWindowRestoring: single tab restored');
    UserOperationBlocker.unblock({ throbber: true });
    return;
  }

  log('Tabs.onWindowRestoring: continue');
  const cache = await SidebarCache.getEffectiveWindowCache({
    ignorePinnedTabs: true
  });
  if (!cache ||
      (cache.offset &&
       window.element.childNodes.length <= cache.offset)) {
    log('Tabs.onWindowRestoring: no effective cache');
    UserOperationBlocker.unblock({ throbber: true });
    return;
  }

  log('Tabs.onWindowRestoring restore! ', cache);
  MetricsData.add('Tabs.onWindowRestoring restore start');
  cache.tabbar.tabsDirty = true;
  const importedTabs = await browser.runtime.sendMessage({
    type: Constants.kCOMMAND_PULL_TABS,
    windowId
  });
  const restored = await SidebarCache.restoreTabsFromCache(cache.tabbar, {
    offset: cache.offset || 0,
    tabs:   importedTabs.map(importedTab => Tab.import(importedTab))
  });
  if (!restored) {
    await rebuildAll();
  }
  Indent.updateRestoredTree(restored && cache.offset == 0 ? cache.indent : null);
  updateTabbarLayout({ justNow: true });
  UserOperationBlocker.unblock({ throbber: true });
  MetricsData.add('Tabs.onWindowRestoring restore end');
});

Tab.onHighlightedTabsChanged.addListener(windowId => {
  if (windowId != mTargetWindow)
    return;
  const window             = TabsStore.windows.get(windowId);
  const allHighlightedTabs = TabsStore.highlightedTabsInWindow.get(windowId);
  if (!window || !window.element || !allHighlightedTabs)
    return;
  if (allHighlightedTabs.size > 1)
    window.classList.add(Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED);
  else
    window.classList.remove(Constants.kTABBAR_STATE_MULTIPLE_HIGHLIGHTED);
});


ContextualIdentities.onUpdated.addListener(() => {
  updateContextualIdentitiesStyle();
  updateContextualIdentitiesSelector();
});


function onConfigChange(changedKey) {
  const rootClasses = document.documentElement.classList;
  switch (changedKey) {
    case 'debug': {
      if (mInitialized) {
        // We have no need to re-update tabs on the startup process.
        // Moreover, we should not re-update tabs at the time to avoid
        // breaking of initialized tab states.
        for (const tab of Tab.getAllTabs(mTargetWindow, { iterator: true })) {
          TabsUpdate.updateTab(tab, tab, { forceApply: true });
        }
      }
      if (configs.debug)
        rootClasses.add('debug');
      else
        rootClasses.remove('debug');
    }; break;

    case 'animation':
      if (configs.animation)
        rootClasses.add('animation');
      else
        rootClasses.remove('animation');
      break;

    case 'sidebarPosition':
      if (configs.sidebarPosition == Constants.kTABBAR_POSITION_RIGHT) {
        rootClasses.add('right');
        rootClasses.remove('left');
      }
      else {
        rootClasses.add('left');
        rootClasses.remove('right');
      }
      Indent.update({ force: true });
      break;

    case 'sidebarDirection':
      if (configs.sidebarDirection == Constants.kTABBAR_DIRECTION_RTL) {
        rootClasses.add('rtl');
        rootClasses.remove('ltr');
      }
      else {
        rootClasses.add('ltr');
        rootClasses.remove('rtl');
      }
      break;

    case 'sidebarScrollbarPosition': {
      let position = configs.sidebarScrollbarPosition;
      if (position == Constants.kTABBAR_SCROLLBAR_POSITION_AUTO)
        position = configs.sidebarPosition;
      if (position == Constants.kTABBAR_SCROLLBAR_POSITION_RIGHT) {
        rootClasses.add('right-scrollbar');
        rootClasses.remove('left-scrollbar');
      }
      else {
        rootClasses.add('left-scrollbar');
        rootClasses.remove('right-scrollbar');
      }
      Indent.update({ force: true });
    }; break;

    case 'baseIndent':
    case 'minIndent':
    case 'maxTreeLevel':
    case 'indentAutoShrink':
    case 'indentAutoShrinkOnlyForVisible':
      Indent.update({ force: true });
      break;

    case 'style':
      location.reload();
      break;

    case 'scrollbarMode':
      rootClasses.remove(Constants.kTABBAR_STATE_NARROW_SCROLLBAR);
      rootClasses.remove(Constants.kTABBAR_STATE_NO_SCROLLBAR);
      rootClasses.remove(Constants.kTABBAR_STATE_OVERLAY_SCROLLBAR);
      switch (configs.scrollbarMode) {
        default:
        case Constants.kTABBAR_SCROLLBAR_MODE_DEFAULT:
          break;
        case Constants.kTABBAR_SCROLLBAR_MODE_NARROW:
          rootClasses.add(Constants.kTABBAR_STATE_NARROW_SCROLLBAR);
          break;
        case Constants.kTABBAR_SCROLLBAR_MODE_HIDE:
          rootClasses.add(Constants.kTABBAR_STATE_NO_SCROLLBAR);
          break;
        case Constants.kTABBAR_SCROLLBAR_MODE_OVERLAY:
          rootClasses.add(Constants.kTABBAR_STATE_OVERLAY_SCROLLBAR);
          break;
      }
      break;

    case 'colorScheme':
      document.documentElement.setAttribute('color-scheme', configs.colorScheme);
      break;

    case 'narrowScrollbarSize':
      location.reload();
      break;

    case 'userStyleRules':
      applyUserStyleRules()
      break;

    case 'inheritContextualIdentityToNewChildTab':
      updateContextualIdentitiesSelector();
      break;

    case 'showContextualIdentitiesSelector':
      if (configs[changedKey])
        rootClasses.add(Constants.kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE);
      else
        rootClasses.remove(Constants.kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE);
      break;

    case 'showNewTabActionSelector':
      if (configs[changedKey])
        rootClasses.add(Constants.kTABBAR_STATE_NEWTAB_ACTION_SELECTABLE);
      else
        rootClasses.remove(Constants.kTABBAR_STATE_NEWTAB_ACTION_SELECTABLE);
      break;

    case 'simulateSVGContextFill':
      if (configs[changedKey])
        rootClasses.add('simulate-svg-context-fill');
      else
        rootClasses.remove('simulate-svg-context-fill');
      break;
  }
}


let mLastTreeChangeFromRemote = Promise.resolve();
function doTreeChangeFromRemote(task) {
  const previousPromisedComplete = mLastTreeChangeFromRemote;
  return mLastTreeChangeFromRemote = new Promise(async (resolve, reject) => {
    try {
      await previousPromisedComplete;
      await task();
      resolve();
    }
    catch(error) {
      reject(error);
    }
  });
}

function onMessage(message, _sender, _respond) {
  if (!message ||
      typeof message.type != 'string' ||
      message.type.indexOf('treestyletab:') != 0)
    return;

  if (message.windowId &&
      message.windowId != mTargetWindow)
    return;

  //log('onMessage: ', message, sender);
  switch (message.type) {
    case Constants.kCOMMAND_PING_TO_SIDEBAR:
      return Promise.resolve(true);

    case Constants.kCOMMAND_PUSH_TREE_STRUCTURE:
      Tree.applyTreeStructureToTabs(Tab.getAllTabs(mTargetWindow), message.structure);
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORING:
      RestoringTabCount.increment();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORED:
      RestoringTabCount.decrement();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED:
      (async () => {
        await Tab.waitUntilTracked(message.tabId, { element: true });
        const tab = Tab.get(message.tabId);
        if (tab)
          Tab.onFaviconUpdated.dispatch(tab, message.favIconUrl);
      })();
      break;

    case Constants.kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE:
      return doTreeChangeFromRemote(async () => {
        await Tab.waitUntilTracked(message.tabId, { element: true });
        const tab = Tab.get(message.tabId);
        if (!tab)
          return;
        const params = {
          collapsed: message.collapsed,
          justNow:   message.justNow,
          stack:     message.stack
        };
        if (message.manualOperation)
          Tree.manualCollapseExpandSubtree(tab, params);
        else
          Tree.collapseExpandSubtree(tab, params);
      });

    case Constants.kCOMMAND_CHANGE_TAB_COLLAPSED_STATE:
      return (async () => {
        await Tab.waitUntilTracked(message.tabId, { element: true });
        const tab = Tab.get(message.tabId);
        if (!tab)
          return;
        // Tree's collapsed state can be changed before this message is delivered,
        // so we should ignore obsolete messages.
        if (message.byAncestor &&
            message.collapsed != tab.$TST.ancestors.some(ancestor => ancestor.$TST.subtreeCollapsed))
          return;
        Tree.collapseExpandTab(tab, {
          collapsed:   message.collapsed,
          justNow:     message.justNow,
          broadcasted: true,
          stack:       message.stack
        });
      })();

    case Constants.kCOMMAND_SYNC_TABS_ORDER:
      SidebarTabs.reserveToSyncTabsOrder();
      break;

    case Constants.kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        const tabIds = message.tabIds.concat([message.nextTabId]);
        await Tab.waitUntilTracked(tabIds, { element: true });
        return TabsMove.moveTabsBefore(
          message.tabIds.map(id => Tab.get(id)),
          message.nextTabId && Tab.get(message.nextTabId),
          message
        ).then(tabs => {
          // Asynchronously broadcasted movement can break the order of tabs,
          // so we trigger synchronization for safety.
          SidebarTabs.reserveToSyncTabsOrder();
          return tabs.map(tab => tab.id);
        });
      })();

    case Constants.kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        const tabIds = message.tabIds.concat([message.previousTabId]);
        await Tab.waitUntilTracked(tabIds, { element: true });
        return TabsMove.moveTabsAfter(
          message.tabIds.map(id => Tab.get(id)),
          message.previousTabId && Tab.get(message.previousTabId),
          message
        ).then(tabs => {
          // Asynchronously broadcasted movement can break the order of tabs,
          // so we trigger synchronization for safety.
          SidebarTabs.reserveToSyncTabsOrder();
          return tabs.map(tab => tab.id);
        });
      })();

    case Constants.kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await Tab.waitUntilTracked(message.tabIds, { element: true });
        return TabsInternalOperation.removeTabs(message.tabIds.map(id => Tab.get(id)), message.options);
      })();

    case Constants.kCOMMAND_ATTACH_TAB_TO:
      return doTreeChangeFromRemote(async () => {
        await Promise.all([
          await Tab.waitUntilTracked([
            message.childId,
            message.parentId,
            message.insertBeforeId,
            message.insertAfterId
          ], { element: true })
        ]);
        log('attach tab from remote ', message);
        const child  = Tab.get(message.childId);
        const parent = Tab.get(message.parentId);
        if (child && parent)
          await Tree.attachTabTo(child, parent, Object.assign({}, message, {
            insertBefore: Tab.get(message.insertBeforeId),
            insertAfter:  Tab.get(message.insertAfterId),
            inRemote:     false,
            broadcast:    false
          }));
      });

    case Constants.kCOMMAND_DETACH_TAB:
      return doTreeChangeFromRemote(async () => {
        await Tab.waitUntilTracked(message.tabId, { element: true });
        const tab = Tab.get(message.tabId);
        if (tab)
          Tree.detachTab(tab, message);
      });

    case Constants.kCOMMAND_BLOCK_USER_OPERATIONS:
      UserOperationBlocker.blockIn(mTargetWindow, message);
      break;

    case Constants.kCOMMAND_UNBLOCK_USER_OPERATIONS:
      UserOperationBlocker.unblockIn(mTargetWindow, message);
      break;

    case Constants.kCOMMAND_BROADCAST_TAB_STATE: {
      if (!message.tabIds.length)
        break;
      return (async () => {
        await Tab.waitUntilTracked(message.tabIds, { element: true });
        const add    = message.add || [];
        const remove = message.remove || [];
        log('apply broadcasted tab state ', message.tabIds, {
          add:    add.join(','),
          remove: remove.join(',')
        });
        const modified = add.concat(remove);
        for (const id of message.tabIds) {
          const tab = Tab.get(id);
          if (!tab)
            continue;
          add.forEach(state => tab.$TST.addState(state));
          remove.forEach(state => tab.$TST.removeState(state));
          if (modified.includes(Constants.kTAB_STATE_AUDIBLE) ||
              modified.includes(Constants.kTAB_STATE_SOUND_PLAYING) ||
              modified.includes(Constants.kTAB_STATE_MUTED)) {
            SidebarTabs.reserveToUpdateSoundButtonTooltip(tab);
          }
        }
      })();
    }; break;

    case Constants.kCOMMAND_CONFIRM_TO_CLOSE_TABS:
      log('kCOMMAND_CONFIRM_TO_CLOSE_TABS: ', { message, mTargetWindow });
      return confirmToCloseTabs(message.tabIds);


    case Constants.kCOMMAND_BOOKMARK_TAB_WITH_DIALOG:
      return Bookmark.bookmarkTab(Tab.get(message.tabId), { showDialog: true });

    case Constants.kCOMMAND_BOOKMARK_TABS_WITH_DIALOG:
      return Bookmark.bookmarkTabs(message.tabIds.map(id => Tab.get(id)), { showDialog: true });
  }
}
