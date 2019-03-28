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
import * as TabsStore from '/common/tabs-store.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as TSTAPI from '/common/tst-api.js';
import * as ContextualIdentities from '/common/contextual-identities.js';
import * as Bookmark from '/common/bookmark.js';
import * as UserOperationBlocker from '/common/user-operation-blocker.js';
import * as MetricsData from '/common/metrics-data.js';

import Tab from '/common/Tab.js';
import Window from '/common/Window.js';

import * as Background from './background.js';
import * as SidebarCache from './sidebar-cache.js';
import * as SidebarTabs from './sidebar-tabs.js';
import * as PinnedTabs from './pinned-tabs.js';
import * as DragAndDrop from './drag-and-drop.js';
import * as TabDragHandle from './tab-drag-handle.js';
import * as RestoringTabCount from './restoring-tab-count.js';
import * as CollapseExpand from './collapse-expand.js';
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

const mPreloadedCaches = new Map();

function preloadCache(tabId) {
  Promise.all([
    browser.sessions.getTabValue(tabId, Constants.kWINDOW_STATE_CACHED_SIDEBAR),
    browser.sessions.getTabValue(tabId, Constants.kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY),
    browser.sessions.getTabValue(tabId, Constants.kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY)
  ]).catch(ApiTabs.createErrorSuppressor())
    .then(cache => mPreloadedCaches.set(tabId, cache));
}

export async function init() {
  MetricsData.add('init: start');
  log('initialize sidebar on load');

  // Read caches from existing tabs at first, for better performance.
  // Those promises will be resolved while waiting other operations.
  browser.tabs.query({ currentWindow: true })
    .catch(ApiTabs.createErrorHandler())
    .then(tabs => preloadCache(tabs[tabs.length - 1].id));

  let promisedAllTabsTracked;
  UserOperationBlocker.setProgress(0);
  const [nativeTabs] = await Promise.all([
    MetricsData.addAsync('getting native tabs', async () => {
      const tabs = await MetricsData.addAsync('browser.tabs.query', browser.tabs.query({ currentWindow: true }).catch(ApiTabs.createErrorHandler()));
      preloadCache(tabs[tabs.length-1].id);
      mTargetWindow = tabs[0].windowId;
      TabsStore.setWindow(mTargetWindow);
      internalLogger.context   = `Sidebar-${mTargetWindow}`;

      // Track only the first tab for now, because it is required to initialize
      // the container and it will be used by the SidebarCache module.
      TabIdFixer.fixTab(tabs[0]);
      Tab.track(tabs[0]);

      promisedAllTabsTracked = MetricsData.addAsync('tracking all native tabs', async () => {
        let lastDraw = Date.now();
        let count = 0;
        const maxCount = tabs.length - 1;
        for (const tab of tabs.slice(1)) {
          TabIdFixer.fixTab(tab);
          Tab.track(tab);
          if (Date.now() - lastDraw > Constants.kPROGRESS_INTERVAL) {
            UserOperationBlocker.setProgress(Math.round(++count / maxCount * 16) + 16); // 2/6: track all tabs
            await nextFrame();
            lastDraw = Date.now();
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
  EventListenerManager.debug = configs.debug;

  onConfigChange('colorScheme');
  onConfigChange('simulateSVGContextFill');
  onInit.dispatch();

  const promisedScrollPosition = browser.sessions.getWindowValue(mTargetWindow, Constants.kWINDOW_STATE_SCROLL_POSITION).catch(ApiTabs.createErrorHandler());
  const promisedInitializedContextualIdentities = ContextualIdentities.init();

  UserOperationBlocker.setProgress(16); // 1/6: wait background page
  const [importedTabs] = await Promise.all([
    MetricsData.addAsync('importTabsFromBackground()', importTabsFromBackground()),
    MetricsData.addAsync('promisedAllTabsTracked', promisedAllTabsTracked)
  ]);

  // we don't need await for these features
  MetricsData.addAsync('API for other addons', TSTAPI.initAsFrontend());

  let cachedContents;
  let restoredFromCache;
  await Promise.all([
    MetricsData.addAsync('parallel initialization: main', async () => {
      if (configs.useCachedTree)
        cachedContents = await MetricsData.addAsync('parallel initialization: main: read cached sidebar contents', SidebarCache.getEffectiveWindowCache({ tabs: importedTabs, caches: mPreloadedCaches }));
      mPreloadedCaches.clear();
      restoredFromCache = await MetricsData.addAsync('parallel initialization: main: rebuildAll', rebuildAll(nativeTabs, importedTabs, cachedContents && cachedContents.tabbar));

      TabsUpdate.completeLoadingTabs(mTargetWindow);

      Background.connect();
      onConfigChange('applyBrowserTheme');

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
    })
  ]);

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

  if (!theme ||
      !theme.colors ||
      !configs.applyBrowserTheme) {
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
      --browser-fg-active:       ${theme.colors.toolbar_text || theme.colors.bookmark_text || theme.colors.textcolor};
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
    let lastDraw = Date.now();
    let count = 0;
    const maxCount = nativeTabs.length;
    tabs = []
    for (let index = 0; index < maxCount; index++) {
      let tab = nativeTabs[index];
      Tab.track(tab);
      tab = importedTabs[index] && Tab.import(importedTabs[index]) || tab;
      if (Date.now() - lastDraw > Constants.kPROGRESS_INTERVAL) {
        UserOperationBlocker.setProgress(Math.round(++count / maxCount * 33) + 33); // 2/3: re-track all tabs
        await nextFrame();
        lastDraw = Date.now();
      }
      tabs.push(tab);
    }
  });

  const window = Window.init(mTargetWindow);
  window.element.parentNode.removeChild(window.element); // remove from the document for better pefromance
  let lastDraw = Date.now();
  let count = 0;
  const maxCount = tabs.length;
  for (const tab of tabs) {
    const trackedTab = Tab.init(tab, { existing: true, inBackground: true });
    TabsUpdate.updateTab(trackedTab, tab, { forceApply: true });
    SidebarTabs.applyCollapseExpandStateToElement(trackedTab);
    if (tab.active)
      TabsInternalOperation.setTabActive(trackedTab);
    if (Date.now() - lastDraw > Constants.kPROGRESS_INTERVAL) {
      UserOperationBlocker.setProgress(Math.round(++count / maxCount * 33) + 66); // 3/3: build tab elements
      await nextFrame();
      lastDraw = Date.now();
    }
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
    const onBackgroundIsReady = (message) => {
      if (!message ||
          !message.type ||
          message.type != Constants.kCOMMAND_PING_TO_SIDEBAR ||
          message.windowId != mTargetWindow)
        return;
      Background.onMessage.removeListener(onBackgroundIsReady);
      resolve(message.tabs);
    };
    Background.onMessage.addListener(onBackgroundIsReady);
    Background.connect();
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
  Background.sendMessage({
    type: Constants.kNOTIFY_SIDEBAR_FOCUS
  });
}

function onBlur(_event) {
  Background.sendMessage({
    type: Constants.kNOTIFY_SIDEBAR_BLUR
  });
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


ContextualIdentities.onUpdated.addListener(() => {
  updateContextualIdentitiesStyle();
  updateContextualIdentitiesSelector();
});


CollapseExpand.onUpdated.addListener((_tab, options) => {
  const reason = options.collapsed ? Constants.kTABBAR_UPDATE_REASON_COLLAPSE : Constants.kTABBAR_UPDATE_REASON_EXPAND ;
  reserveToUpdateTabbarLayout({ reason });
});

function onConfigChange(changedKey) {
  const rootClasses = document.documentElement.classList;
  switch (changedKey) {
    case 'debug': {
      EventListenerManager.debug = configs.debug;
      if (mInitialized) {
        // We have no need to re-update tabs on the startup process.
        // Moreover, we should not re-update tabs at the time to avoid
        // breaking of initialized tab states.
        for (const tab of Tab.getAllTabs(mTargetWindow, { iterator: true })) {
          TabsUpdate.updateTab(tab, tab, { forceApply: true });
          tab.$TST.tooltipIsDirty = true;
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

    case 'applyBrowserTheme':
      if (browser.theme && browser.theme.getCurrent) // Firefox 58 and later
        browser.theme.getCurrent(mTargetWindow).then(applyBrowserTheme);
      else
        applyBrowserTheme();
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
    case Constants.kCOMMAND_CONFIRM_TO_CLOSE_TABS:
      log('kCOMMAND_CONFIRM_TO_CLOSE_TABS: ', { message, mTargetWindow });
      return confirmToCloseTabs(message.tabIds);
  }
}


Background.onMessage.addListener(async message => {
  switch (message.type) {
    case Constants.kCOMMAND_REMOVE_TABS_INTERNALLY:
      await Tab.waitUntilTracked(message.tabIds, { element: true });
      TabsInternalOperation.removeTabs(message.tabIds.map(id => Tab.get(id)));
      break;

    case Constants.kCOMMAND_BLOCK_USER_OPERATIONS:
      UserOperationBlocker.blockIn(mTargetWindow, message);
      break;

    case Constants.kCOMMAND_UNBLOCK_USER_OPERATIONS:
      UserOperationBlocker.unblockIn(mTargetWindow, message);
      break;

    case Constants.kCOMMAND_PROGRESS_USER_OPERATIONS:
      UserOperationBlocker.setProgress(message.percentage, mTargetWindow);
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_CREATED:
    case Constants.kCOMMAND_NOTIFY_TAB_MOVED:
      if (message.tabId)
        await Tab.waitUntilTracked(message.tabId, { element: true });
      reserveToUpdateTabbarLayout({
        reason:  Constants.kTABBAR_UPDATE_REASON_TAB_OPEN,
        timeout: configs.collapseDuration
      });
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_REMOVING: {
      await Tab.waitUntilTracked(message.tabId, { element: true });
      reserveToUpdateTabbarLayout({
        reason:  Constants.kTABBAR_UPDATE_REASON_TAB_CLOSE,
        timeout: configs.collapseDuration
      });
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORING: {
      if (!configs.useCachedTree) // we cannot know when we should unblock on no cache case...
        return;

      await Tab.waitUntilTracked(message.tabId, { element: true });
      const tab = Tab.get(message.tabId);
      const window = TabsStore.windows.get(tab.windowId);
      // When we are restoring two or more tabs.
      // (But we don't need do this again for third, fourth, and later tabs.)
      if (window.restoredCount == 2)
        UserOperationBlocker.block({ throbber: true });
    }; break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORED: {
      // Tree restoration for "Restore Previous Session"
      if (!configs.useCachedTree)
        return;

      await Tab.waitUntilTracked(message.tabId, { element: true });
      log('Tabs.onWindowRestoring');
      const window = TabsStore.windows.get(message.windowId);
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
        type:     Constants.kCOMMAND_PULL_TABS,
        windowId: message.windowId
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
    }; break;

    case Constants.kCOMMAND_BOOKMARK_TAB_WITH_DIALOG:
      Bookmark.bookmarkTab(Tab.get(message.tabId), { showDialog: true });
      break;

    case Constants.kCOMMAND_BOOKMARK_TABS_WITH_DIALOG:
      Bookmark.bookmarkTabs(message.tabIds.map(id => Tab.get(id)), { showDialog: true });
      break;
  }
});
