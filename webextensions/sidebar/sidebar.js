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
import * as ApiTabsListener from '/common/api-tabs-listener.js';
import * as Tabs from '/common/tabs.js';
import * as TabsInternalOperation from '/common/tabs-internal-operation.js';
import * as TabsUpdate from '/common/tabs-update.js';
import * as TabsMove from '/common/tabs-move.js';
import * as TabsContainer from '/common/tabs-container.js';
import * as Tree from '/common/tree.js';
import * as TSTAPI from '/common/tst-api.js';
import * as ContextualIdentities from '/common/contextual-identities.js';
import * as Commands from '/common/commands.js';
import * as Bookmark from '/common/bookmark.js';
import * as UserOperationBlocker from '/common/user-operation-blocker.js';
import * as MetricsData from '/common/metrics-data.js';

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
  MetricsData.add('init start');
  log('initialize sidebar on load');

  await Promise.all([
    (async () => {
      const apiTabs = await browser.tabs.query({
        active:        true,
        currentWindow: true
      });
      mTargetWindow = apiTabs[0].windowId;
      Tabs.setWindow(mTargetWindow);
      internalLogger.context   = `Sidebar-${mTargetWindow}`;

      PinnedTabs.init();
      Indent.init();
      SidebarCache.init();
      SidebarCache.onRestored.addListener(() => { DragAndDrop.clearDropPosition(); });
    })(),
    configs.$loaded
  ]);
  MetricsData.add('browser.tabs.query, configs.$loaded');

  onConfigChange('colorScheme');
  onConfigChange('simulateSVGContextFill');
  onInit.dispatch();

  await Promise.all([
    waitUntilBackgroundIsReady(),
    ContextualIdentities.init()
  ]);
  MetricsData.add('applyStyle, waitUntilBackgroundIsReady and ContextualIdentities.init');

  let cachedContents;
  let restoredFromCache;
  await MetricsData.addAsync('parallel initialization tasks', Promise.all([
    MetricsData.addAsync('main', async () => {
      if (configs.useCachedTree)
        await MetricsData.addAsync('read cached sidebar contents', async () => {
          cachedContents = await SidebarCache.getEffectiveWindowCache();
        });

      restoredFromCache = await rebuildAll(cachedContents && cachedContents.tabbar);
      ApiTabsListener.startListen();

      browser.runtime.connect({
        name: `${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}${mTargetWindow}`
      });
      if (browser.theme && browser.theme.getCurrent) // Firefox 58 and later
        browser.theme.getCurrent(mTargetWindow).then(applyBrowserTheme);
      else
        applyBrowserTheme();

      if (!restoredFromCache)
        await MetricsData.addAsync('inheritTreeStructure', async () => {
          await inheritTreeStructure();
        });

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

      MetricsData.add('onBuilt: start to listen events');
    }),
    MetricsData.addAsync('Size.init', async () => {
      Size.init();
      document.documentElement.classList.remove('initializing');
    }),
    MetricsData.addAsync('initializing contextual identities', async () => {
      updateContextualIdentitiesStyle();
      updateContextualIdentitiesSelector();
      ContextualIdentities.startObserve();
    }),
    MetricsData.addAsync('TabContextMenu.init', async () => {
      TabContextMenu.init();
    }),
    MetricsData.addAsync('getting registered addons and scroll lock state', async () => {
      await TSTAPI.initAsFrontend();
    }),
    MetricsData.addAsync('Scroll.init', async () => {
      Scroll.init();
    })
  ]));

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

  UserOperationBlocker.unblock({ throbber: true });

  MetricsData.add('init end');
  log(`Startup metrics for ${Tabs.getTabs().length} tabs: `, MetricsData.toString());
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
  return new Promise((resolve, _aReject) => {
    mStyleLoader.addEventListener('load', () => {
      nextFrame().then(resolve);
    }, { once: true });
  });
}

function applyUserStyleRules() {
  mUserStyleRules.textContent = configs.userStyleRules || '';
}

function applyBrowserTheme(aTheme) {
  log('applying theme ', aTheme);

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

  if (!aTheme || !aTheme.colors) {
    mBrowserThemeDefinition.textContent = defaultColors;
    return;
  }
  const extraColors = [];
  let bgAlpha = 1;
  if (aTheme.images) {
    if (aTheme.images.headerURL)
      extraColors.push(`--browser-header-url: url(${JSON.stringify(aTheme.images.headerURL)})`);
    if (Array.isArray(aTheme.images.additional_backgrounds) &&
        aTheme.images.additional_backgrounds.length > 0) {
      extraColors.push(`--browser-bg-url: url(${JSON.stringify(aTheme.images.additional_backgrounds[0])})`);
      bgAlpha = 0.75;
    }
  }
  const themeBaseColor = Color.mixCSSColors(aTheme.colors.accentcolor, 'rgba(0, 0, 0, 0)', bgAlpha);
  let toolbarColor = Color.mixCSSColors(themeBaseColor, 'rgba(255, 255, 255, 0.4)', bgAlpha);
  if (aTheme.colors.toolbar)
    toolbarColor = Color.mixCSSColors(themeBaseColor, aTheme.colors.toolbar);
  if (aTheme.colors.tab_line)
    extraColors.push(`--browser-tab-active-marker: ${aTheme.colors.tab_line}`);
  if (aTheme.colors.tab_loading)
    extraColors.push(`--browser-loading-indicator: ${aTheme.colors.tab_loading}`);
  mBrowserThemeDefinition.textContent = `
    ${defaultColors}
    :root {
      --browser-background:      ${aTheme.colors.accentcolor};
      --browser-bg-base:         ${themeBaseColor};
      --browser-bg-less-lighter: ${Color.mixCSSColors(themeBaseColor, 'rgba(255, 255, 255, 0.25)', bgAlpha)};
      --browser-bg-lighter:      ${toolbarColor};
      --browser-bg-more-lighter: ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.6)', bgAlpha)};
      --browser-bg-lightest:     ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.85)', bgAlpha)};
      --browser-bg-less-darker:  ${Color.mixCSSColors(themeBaseColor, 'rgba(0, 0, 0, 0.1)', bgAlpha)};
      --browser-bg-darker:       ${Color.mixCSSColors(themeBaseColor, 'rgba(0, 0, 0, 0.25)', bgAlpha)};
      --browser-bg-more-darker:  ${Color.mixCSSColors(themeBaseColor, 'rgba(0, 0, 0, 0.5)', bgAlpha)};
      --browser-fg:              ${aTheme.colors.textcolor};
      --browser-fg-active:       ${aTheme.colors.toolbar_text || aTheme.colors.textcolor};
      --browser-border:          ${Color.mixCSSColors(aTheme.colors.textcolor, 'rgba(0, 0, 0, 0)', 0.4)};
      ${extraColors.join(';\n')}
    }
  `;
}

function updateContextualIdentitiesStyle() {
  const definitions = [];
  ContextualIdentities.forEach(aIdentity => {
    if (!aIdentity.colorCode)
      return;
    definitions.push(`
      .tab.contextual-identity-${aIdentity.cookieStoreId} .contextual-identity-marker {
        background-color: ${aIdentity.colorCode};
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

export async function rebuildAll(cache) {
  const apiTabs = await browser.tabs.query({ currentWindow: true });
  TabsContainer.clearAll();

  if (cache) {
    const restored = await SidebarCache.restoreTabsFromCache(cache, { tabs: apiTabs });
    if (restored) {
      MetricsData.add('rebuildAll (from cache)');
      return true;
    }
  }

  const container = TabsContainer.buildFor(mTargetWindow);
  for (const apiTab of apiTabs) {
    TabIdFixer.fixTab(apiTab);
    const newTab = Tabs.buildTab(apiTab, { existing: true, inRemote: true });
    container.appendChild(newTab);
    TabsUpdate.updateTab(newTab, apiTab, { forceApply: true });
  }
  Tabs.allTabsContainer.appendChild(container);
  MetricsData.add('rebuildAll (from scratch)');
  return false;
}

async function inheritTreeStructure() {
  const response = await browser.runtime.sendMessage({
    type:     Constants.kCOMMAND_PULL_TREE_STRUCTURE,
    windowId: mTargetWindow
  });
  MetricsData.add('inheritTreeStructure: Constants.kCOMMAND_PULL_TREE_STRUCTURE');
  if (response.structure) {
    await Tree.applyTreeStructureToTabs(Tabs.getAllTabs(mTargetWindow), response.structure);
    MetricsData.add('inheritTreeStructure: Tree.applyTreeStructureToTabs');
  }
}

async function waitUntilBackgroundIsReady() {
  try {
    const response = await browser.runtime.sendMessage({
      type: Constants.kCOMMAND_PING_TO_BACKGROUND
    });
    if (response)
      return;
  }
  catch(_e) {
  }
  return new Promise((resolve, _aReject) => {
    const onBackgroundIsReady = (message, _aSender, _aRespond) => {
      if (!message ||
          !message.type ||
          message.type != Constants.kCOMMAND_PING_TO_SIDEBAR)
        return;
      browser.runtime.onMessage.removeListener(onBackgroundIsReady);
      resolve();
    };
    browser.runtime.onMessage.addListener(onBackgroundIsReady);
  });
}


export async function confirmToCloseTabs(apiTabIds, _aOptions = {}) {
  apiTabIds = apiTabIds.filter(id => !configs.grantedRemovingTabIds.includes(id));
  const count = apiTabIds.length;
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
      configs.grantedRemovingTabIds = Array.from(new Set((configs.grantedRemovingTabIds || []).concat(apiTabIds)));
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
      const current = Tabs.getCurrentTab();
      if (!Scroll.isTabInViewport(current)) {
        log('scroll to current tab on updateTabbarLayout');
        Scroll.scrollToTab(current);
        return;
      }
      const lastOpenedTab = Tabs.getLastOpenedTab();
      const reasons       = params.reasons || 0;
      if (reasons & Constants.kTABBAR_UPDATE_REASON_TAB_OPEN &&
          !Scroll.isTabInViewport(lastOpenedTab)) {
        log('scroll to last opened tab on updateTabbarLayout ', reasons);
        Scroll.scrollToTab(lastOpenedTab, {
          anchor:            current,
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
  });
}

function onBlur(_aEvent) {
  browser.runtime.sendMessage({
    type:     Constants.kNOTIFY_SIDEBAR_BLUR,
    windowId: mTargetWindow
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


Tabs.onCreated.addListener((_tab, _info) => {
  reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_TAB_OPEN,
    timeout: configs.collapseDuration
  });
});

Tabs.onRemoving.addListener((tab, removeInfo) => {
  if (removeInfo.isWindowClosing)
    return;

  const closeParentBehavior = Tree.getCloseParentBehaviorForTabWithSidebarOpenState(tab, removeInfo);
  if (closeParentBehavior != Constants.kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
      Tabs.isSubtreeCollapsed(tab))
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

Tabs.onMoved.addListener((_tab, _info) => {
  reserveToUpdateTabbarLayout({
    reason:  Constants.kTABBAR_UPDATE_REASON_TAB_MOVE,
    timeout: configs.collapseDuration
  });
});

Tabs.onDetached.addListener((tab, _info) => {
  if (!Tabs.ensureLivingTab(tab))
    return;
  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  Tree.detachTab(tab, {
    dontUpdateIndent: true
  });
});

Tabs.onRestoring.addListener(tab => {
  if (!configs.useCachedTree) // we cannot know when we should unblock on no cache case...
    return;

  const container = tab.parentNode;
  // When we are restoring two or more tabs.
  // (But we don't need do this again for third, fourth, and later tabs.)
  if (container.restoredCount == 2)
    UserOperationBlocker.block({ throbber: true });
});

// Tree restoration for "Restore Previous Session"
Tabs.onWindowRestoring.addListener(async windowId => {
  if (!configs.useCachedTree)
    return;

  log('Tabs.onWindowRestoring');
  const container = Tabs.getTabsContainer(windowId);
  const restoredCount = await container.allTabsRestored;
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
       container.childNodes.length <= cache.offset)) {
    log('Tabs.onWindowRestoring: no effective cache');
    await inheritTreeStructure(); // fallback to classic method
    UserOperationBlocker.unblock({ throbber: true });
    return;
  }

  log('Tabs.onWindowRestoring restore! ', cache);
  MetricsData.add('Tabs.onWindowRestoring restore start');
  cache.tabbar.tabsDirty = true;
  const apiTabs = await browser.tabs.query({ windowId: windowId });
  const restored = await SidebarCache.restoreTabsFromCache(cache.tabbar, {
    offset: cache.offset || 0,
    tabs:   apiTabs
  });
  if (!restored) {
    await rebuildAll();
    await inheritTreeStructure();
  }
  Indent.updateRestoredTree(restored && cache.offset == 0 ? cache.indent : null);
  updateTabbarLayout({ justNow: true });
  UserOperationBlocker.unblock({ throbber: true });
  MetricsData.add('Tabs.onWindowRestoring restore end');
});


ContextualIdentities.onUpdated.addListener(() => {
  updateContextualIdentitiesStyle();
  updateContextualIdentitiesSelector();
});


function onConfigChange(changedKey) {
  const rootClasses = document.documentElement.classList;
  switch (changedKey) {
    case 'debug': {
      for (const tab of Tabs.getAllTabs()) {
        TabsUpdate.updateTab(tab, tab.apiTab, { forceApply: true });
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


const mTreeChangesFromRemote = new Set();
function waitUntilAllTreeChangesFromRemoteAreComplete() {
  return Promise.all(mTreeChangesFromRemote.values());
}

function onMessage(message, _sender, _respond) {
  if (!message ||
      typeof message.type != 'string' ||
      message.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', message, sender);
  switch (message.type) {
    case Constants.kCOMMAND_PING_TO_SIDEBAR: {
      if (message.windowId == mTargetWindow)
        return Promise.resolve(true);
    }; break;

    case Constants.kCOMMAND_PUSH_TREE_STRUCTURE:
      if (message.windowId == mTargetWindow)
        Tree.applyTreeStructureToTabs(Tabs.getAllTabs(mTargetWindow), message.structure);
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORING:
      RestoringTabCount.increment();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_RESTORED:
      RestoringTabCount.decrement();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_FAVICON_UPDATED: {
      const tab = Tabs.getTabById(message.tab);
      if (tab)
        Tabs.onFaviconUpdated.dispatch(tab, message.favIconUrl);
    } break;

    case Constants.kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE: {
      if (message.windowId == mTargetWindow) return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tab);
        const tab = Tabs.getTabById(message.tab);
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
      })();
    }; break;

    case Constants.kCOMMAND_CHANGE_TAB_COLLAPSED_STATE: {
      if (message.windowId == mTargetWindow) return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tab);
        const tab = Tabs.getTabById(message.tab);
        if (!tab)
          return;
        // Tree's collapsed state can be changed before this message is delivered,
        // so we should ignore obsolete messages.
        if (message.byAncestor &&
            message.collapsed != Tabs.getAncestorTabs(tab).some(Tabs.isSubtreeCollapsed))
          return;
        const params = {
          collapsed:   message.collapsed,
          justNow:     message.justNow,
          broadcasted: true,
          stack:       message.stack
        };
        Tree.collapseExpandTab(tab, params);
      })();
    }; break;

    case Constants.kCOMMAND_SYNC_TABS_ORDER:
      SidebarTabs.reserveToSyncTabsOrder();
      break;

    case Constants.kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabs.concat([message.nextTab]));
        return TabsMove.moveTabsBefore(
          message.tabs.map(Tabs.getTabById),
          Tabs.getTabById(message.nextTab),
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
        await Tabs.waitUntilTabsAreCreated(message.tabs.concat([message.previousTab]));
        return TabsMove.moveTabsAfter(
          message.tabs.map(Tabs.getTabById),
          Tabs.getTabById(message.previousTab),
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
        await Tabs.waitUntilTabsAreCreated(message.tabs);
        return TabsInternalOperation.removeTabs(message.tabs.map(Tabs.getTabById), message.options);
      })();

    case Constants.kCOMMAND_ATTACH_TAB_TO: {
      if (message.windowId == mTargetWindow) {
        const promisedComplete = (async () => {
          await Promise.all([
            Tabs.waitUntilTabsAreCreated([
              message.child,
              message.parent,
              message.insertBefore,
              message.insertAfter
            ]),
            waitUntilAllTreeChangesFromRemoteAreComplete()
          ]);
          log('attach tab from remote ', message);
          const child  = Tabs.getTabById(message.child);
          const parent = Tabs.getTabById(message.parent);
          if (child && parent)
            await Tree.attachTabTo(child, parent, Object.assign({}, message, {
              insertBefore: Tabs.getTabById(message.insertBefore),
              insertAfter:  Tabs.getTabById(message.insertAfter),
              inRemote:     false,
              broadcast:    false
            }));
          mTreeChangesFromRemote.delete(promisedComplete);
        })();
        mTreeChangesFromRemote.add(promisedComplete);
        return promisedComplete;
      }
    }; break;

    case Constants.kCOMMAND_DETACH_TAB: {
      if (message.windowId == mTargetWindow) {
        const promisedComplete = (async () => {
          await Promise.all([
            Tabs.waitUntilTabsAreCreated(message.tab),
            waitUntilAllTreeChangesFromRemoteAreComplete()
          ]);
          const tab = Tabs.getTabById(message.tab);
          if (tab)
            Tree.detachTab(tab, message);
          mTreeChangesFromRemote.delete(promisedComplete);
        })();
        mTreeChangesFromRemote.add(promisedComplete);
        return promisedComplete;
      }
    }; break;

    case Constants.kCOMMAND_BLOCK_USER_OPERATIONS: {
      if (message.windowId == mTargetWindow)
        UserOperationBlocker.blockIn(mTargetWindow, message);
    }; break;

    case Constants.kCOMMAND_UNBLOCK_USER_OPERATIONS: {
      if (message.windowId == mTargetWindow)
        UserOperationBlocker.unblockIn(mTargetWindow, message);
    }; break;

    case Constants.kCOMMAND_BROADCAST_TAB_STATE: {
      if (!message.tabs.length)
        break;
      return (async () => {
        await Tabs.waitUntilTabsAreCreated(message.tabs);
        const add    = message.add || [];
        const remove = message.remove || [];
        log('apply broadcasted tab state ', message.tabs, {
          add:    add.join(','),
          remove: remove.join(',')
        });
        const modified = add.concat(remove);
        for (let tab of message.tabs) {
          tab = Tabs.getTabById(tab);
          if (!tab)
            continue;
          add.forEach(state => tab.classList.add(state));
          remove.forEach(state => tab.classList.remove(state));
          if (modified.includes(Constants.kTAB_STATE_AUDIBLE) ||
            modified.includes(Constants.kTAB_STATE_SOUND_PLAYING) ||
            modified.includes(Constants.kTAB_STATE_MUTED)) {
            SidebarTabs.reserveToUpdateSoundButtonTooltip(tab);
            if (message.bubbles)
              TabsUpdate.updateParentTab(Tabs.getParentTab(tab));
          }
        }
      })();
    }; break;

    case Constants.kCOMMAND_CONFIRM_TO_CLOSE_TABS: {
      if (message.windowId == mTargetWindow)
        return confirmToCloseTabs(message.tabIds);
    }; break;


    case Constants.kCOMMAND_BOOKMARK_TAB_WITH_DIALOG:
      if (message.windowId != mTargetWindow)
        return;
      return Bookmark.bookmarkTab(Tabs.getTabById(message.tab), { showDialog: true });

    case Constants.kCOMMAND_BOOKMARK_TABS_WITH_DIALOG:
      if (message.windowId != mTargetWindow)
        return;
      return Bookmark.bookmarkTabs(message.tabs.map(Tabs.getTabById), { showDialog: true });
  }
}
