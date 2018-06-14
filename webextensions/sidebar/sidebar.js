/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import RichConfirm from '../extlib/RichConfirm.js';
import TabIdFixer from '../extlib/TabIdFixer.js';

import {
  log,
  nextFrame,
  configs
} from '../common/common.js';
import * as Constants from '../common/constants.js';
import * as ApiTabsListener from '../common/api-tabs-listener.js';
import * as Tabs from '../common/tabs.js';
import * as TabsUpdate from '../common/tabs-update.js';
import * as TabsContainer from '../common/tabs-container.js';
import * as Tree from '../common/tree.js';
import * as TSTAPI from '../common/tst-api.js';
import * as ContextualIdentities from '../common/contextual-identities.js';
import * as Commands from '../common/commands.js';
import * as UserOperationBlocker from '../common/user-operation-blocker.js';
import * as MetricsData from '../common/metrics-data.js';
import EventListenerManager from '../common/EventListenerManager.js';

import * as SidebarCache from './sidebar-cache.js';
import * as SidebarTabs from './sidebar-tabs.js';
import * as PinnedTabs from './pinned-tabs.js';
import * as DragAndDrop from './drag-and-drop.js';
import * as RestoringTabCount from './restoring-tab-count.js';
import * as Size from './size.js';
import * as Color from './color.js';
import * as Indent from './indent.js';
import * as Scroll from './scroll.js';
import * as TabContextMenu from './tab-context-menu.js';

export const onInit    = new EventListenerManager();
export const onBuilt   = new EventListenerManager();
export const onReady   = new EventListenerManager();
export const onDestroy = new EventListenerManager();


var gInitialized = false;
var gStyle;
var gTargetWindow   = null;

var gTabBar                     = document.querySelector('#tabbar');
var gAfterTabsForOverflowTabBar = document.querySelector('#tabbar ~ .after-tabs');
var gMasterThrobber             = document.querySelector('#master-throbber');
var gStyleLoader                = document.querySelector('#style-loader');
var gBrowserThemeDefinition     = document.querySelector('#browser-theme-definition');
var gUserStyleRules             = document.querySelector('#user-style-rules');
var gContextualIdentitiesStyle  = document.querySelector('#contextual-identity-styling');

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
      var apiTabs = await browser.tabs.query({
        active:        true,
        currentWindow: true
      });
      gTargetWindow = apiTabs[0].windowId;
      Tabs.setWindow(gTargetWindow);
      log.context   = `Sidebar-${gTargetWindow}`;

      PinnedTabs.init();
      Indent.init();
      SidebarCache.init();
      SidebarCache.onRestored.addListener(DragAndDrop.clearDropPosition);
      Scroll.init();
    })(),
    configs.$loaded
  ]);
  MetricsData.add('browser.tabs.query, configs.$loaded');

  onInit.dispatch();

  await Promise.all([
    waitUntilBackgroundIsReady(),
    ContextualIdentities.init()
  ]);
  MetricsData.add('applyStyle, waitUntilBackgroundIsReady and ContextualIdentities.init');

  var cachedContents;
  var restoredFromCache;
  var scrollPosition;
  await MetricsData.addAsync('parallel initialization tasks', Promise.all([
    MetricsData.addAsync('main', async () => {
      if (configs.useCachedTree)
        await MetricsData.addAsync('read cached sidebar contents', async () => {
          cachedContents = await SidebarCache.getEffectiveWindowCache();
        });

      restoredFromCache = await rebuildAll(cachedContents && cachedContents.tabbar);
      ApiTabsListener.startListen();

      browser.runtime.connect({
        name: `${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}${gTargetWindow}`
      });
      if (browser.theme && browser.theme.getCurrent) // Firefox 58 and later
        browser.theme.getCurrent(gTargetWindow).then(applyBrowserTheme);
      else
        applyBrowserTheme();

      if (!restoredFromCache)
        await MetricsData.addAsync('inheritTreeStructure', async () => {
          await inheritTreeStructure();
        });

      onBuilt.dispatch();

      gMasterThrobber.addEventListener('animationiteration', synchronizeThrobberAnimation);
      DragAndDrop.startListen();

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
    MetricsData.addAsync('getting Constants.kWINDOW_STATE_SCROLL_POSITION', async () => {
      scrollPosition = await browser.sessions.getWindowValue(gTargetWindow, Constants.kWINDOW_STATE_SCROLL_POSITION);
    })
  ]));

  if (typeof scrollPosition == 'number') {
    log('restore scroll position');
    Scroll.cancelRunningScroll();
    Scroll.scrollTo({
      position: scrollPosition,
      justNow:  true
    });
    MetricsData.add('applying scroll position');
  }

  gInitialized = true;

  SidebarCache.startTracking();

  updateVisualMaxTreeLevel();
  Indent.update({
    force: true,
    cache: cachedContents && cachedContents.indent
  });
  if (!restoredFromCache) {
    updateLoadingState();
    synchronizeThrobberAnimation();
    for (const tab of Tabs.getAllTabs()) {
      updateTabTwisty(tab);
      updateTabClosebox(tab);
      updateTabsCount(tab);
      updateTabTooltip(tab);
    }
    SidebarCache.reserveToUpdateCachedTabbar();
  }
  updateTabbarLayout({ justNow: true });

  onReady.dispatch();

  UserOperationBlocker.unblock({ throbber: true });

  MetricsData.add('init end');
  log(`Startup metrics for ${Tabs.getTabs().length} tabs: `, MetricsData.toString());
}

export function destroy() {
  DragAndDrop.endListen();
  ApiTabsListener.endListen();
  ContextualIdentities.endObserve();
  onDestroy.dispatch();
  gMasterThrobber.removeEventListener('animationiteration', synchronizeThrobberAnimation);

  gTabBar = gAfterTabsForOverflowTabBar = gMasterThrobber = undefined;
}

function applyStyle(aStyle) {
  gStyle = aStyle || configs.style;
  switch (gStyle) {
    case 'metal':
      gStyleLoader.setAttribute('href', 'styles/metal/metal.css');
      break;
    case 'sidebar':
      gStyleLoader.setAttribute('href', 'styles/sidebar/sidebar.css');
      break;
    case 'mixed':
      gStyleLoader.setAttribute('href', 'styles/square/mixed.css');
      break;
    case 'vertigo':
      gStyleLoader.setAttribute('href', 'styles/square/vertigo.css');
      break;
    case 'plain-dark':
      gStyleLoader.setAttribute('href', 'styles/square/plain-dark.css');
      break;
    case 'plain':
    case 'flat': // for backward compatibility, fall back to plain.
      gStyleLoader.setAttribute('href', 'styles/square/plain.css');
      break;
    case 'highcontrast':
      gStyleLoader.setAttribute('href', 'styles/square/highcontrast.css');
      break;
    default:
      // as the base of customization. see also:
      // https://github.com/piroor/treestyletab/issues/1604
      gStyleLoader.setAttribute('href', 'data:text/css,');
      break;
  }
  return new Promise((aResolve, _aReject) => {
    gStyleLoader.addEventListener('load', () => {
      nextFrame().then(aResolve);
    }, { once: true });
  });
}

export function applyUserStyleRules() {
  gUserStyleRules.textContent = configs.userStyleRules || '';
}

export function applyBrowserTheme(aTheme) {
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
    gBrowserThemeDefinition.textContent = defaultColors;
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
  gBrowserThemeDefinition.textContent = `
    ${defaultColors}
    :root {
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

export function updateContextualIdentitiesStyle() {
  var definitions = [];
  ContextualIdentities.forEach(aIdentity => {
    if (!aIdentity.colorCode)
      return;
    definitions.push(`
      .tab.contextual-identity-${aIdentity.cookieStoreId} .contextual-identity-marker {
        background-color: ${aIdentity.colorCode};
      }
    `);
  });
  gContextualIdentitiesStyle.textContent = definitions.join('\n');
}

export function updateContextualIdentitiesSelector() {
  const anchors = Array.slice(document.querySelectorAll(`.${Constants.kCONTEXTUAL_IDENTITY_SELECTOR}-marker`));
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
  ContextualIdentities.forEach(aIdentity => {
    const item     = document.createElement('li');
    item.dataset.value = aIdentity.cookieStoreId;
    item.textContent = aIdentity.name;
    const icon = document.createElement('span');
    icon.classList.add('icon');
    if (aIdentity.iconUrl) {
      icon.style.backgroundColor = aIdentity.colorCode || 'var(--tab-text)';
      icon.style.mask = `url(${JSON.stringify(aIdentity.iconUrl)}) no-repeat center / 100%`;
    }
    item.insertBefore(icon, item.firstChild);
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

export async function rebuildAll(aCache) {
  var apiTabs = await browser.tabs.query({ currentWindow: true });
  TabsContainer.clearAll();

  if (aCache) {
    const restored = await SidebarCache.restoreTabsFromCache(aCache, { tabs: apiTabs });
    if (restored) {
      MetricsData.add('rebuildAll (from cache)');
      return true;
    }
  }

  const container = TabsContainer.buildFor(gTargetWindow);
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

export async function inheritTreeStructure() {
  var response = await browser.runtime.sendMessage({
    type:     Constants.kCOMMAND_PULL_TREE_STRUCTURE,
    windowId: gTargetWindow
  });
  MetricsData.add('inheritTreeStructure: Constants.kCOMMAND_PULL_TREE_STRUCTURE');
  if (response.structure) {
    await Tree.applyTreeStructureToTabs(Tabs.getAllTabs(gTargetWindow), response.structure);
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
  return new Promise((aResolve, _aReject) => {
    const onBackgroundIsReady = (aMessage, _aSender, _aRespond) => {
      if (!aMessage ||
          !aMessage.type ||
          aMessage.type != Constants.kCOMMAND_PING_TO_SIDEBAR)
        return;
      browser.runtime.onMessage.removeListener(onBackgroundIsReady);
      aResolve();
    };
    browser.runtime.onMessage.addListener(onBackgroundIsReady);
  });
}


export async function confirmToCloseTabs(aCount, _aOptions = {}) {
  if (aCount <= 1 ||
      !configs.warnOnCloseTabs)
    return true;
  const confirm = new RichConfirm({
    message: browser.i18n.getMessage('warnOnCloseTabs_message', [aCount]),
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
      return true;
    default:
      return false;
  }
}
Commands.onTabsClosing.addListener(confirmToCloseTabs);
TabContextMenu.onTabsClosing.addListener(confirmToCloseTabs);


export function updateTabTwisty(aTab) {
  var tooltip;
  if (Tabs.isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab_twisty_collapsed_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_twisty_expanded_tooltip');
  SidebarTabs.getTabTwisty(aTab).setAttribute('title', tooltip);
}

export function updateTabClosebox(aTab) {
  var tooltip;
  if (Tabs.hasChildTabs(aTab) && Tabs.isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab_closebox_tree_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip');
  SidebarTabs.getTabClosebox(aTab).setAttribute('title', tooltip);
}

export function updateTabsCount(aTab) {
  var counter = SidebarTabs.getTabCounter(aTab);
  if (!counter)
    return;
  var descendants = Tabs.getDescendantTabs(aTab);
  var count = descendants.length;
  if (configs.counterRole == Constants.kCOUNTER_ROLE_ALL_TABS)
    count += 1;
  counter.textContent = count;
}


export function reserveToUpdateVisualMaxTreeLevel() {
  if (!gInitialized)
    return;
  if (updateVisualMaxTreeLevel.waiting)
    clearTimeout(updateVisualMaxTreeLevel.waiting);
  updateVisualMaxTreeLevel.waiting = setTimeout(() => {
    delete updateVisualMaxTreeLevel.waiting;
    updateVisualMaxTreeLevel();
  }, configs.collapseDuration * 1.5);
}

export function updateVisualMaxTreeLevel() {
  var maxLevel = Tabs.getMaxTreeLevel(gTargetWindow, {
    onlyVisible: configs.indentAutoShrinkOnlyForVisible
  });
  document.documentElement.setAttribute(Constants.kMAX_TREE_LEVEL, Math.max(1, maxLevel));
}


export function reserveToUpdateIndent() {
  if (!gInitialized)
    return;
  //log('reserveToUpdateIndent');
  if (reserveToUpdateIndent.waiting)
    clearTimeout(reserveToUpdateIndent.waiting);
  reserveToUpdateIndent.waiting = setTimeout(() => {
    delete reserveToUpdateIndent.waiting;
    Indent.update();
  }, Math.max(configs.indentDuration, configs.collapseDuration) * 1.5);
}

export function reserveToUpdateTabbarLayout(aOptions = {}) {
  //log('reserveToUpdateTabbarLayout');
  if (reserveToUpdateTabbarLayout.waiting)
    clearTimeout(reserveToUpdateTabbarLayout.waiting);
  if (aOptions.reason && !(reserveToUpdateTabbarLayout.reasons & aOptions.reason))
    reserveToUpdateTabbarLayout.reasons |= aOptions.reason;
  var timeout = aOptions.timeout || 10;
  reserveToUpdateTabbarLayout.timeout = Math.max(timeout, reserveToUpdateTabbarLayout.timeout);
  reserveToUpdateTabbarLayout.waiting = setTimeout(() => {
    delete reserveToUpdateTabbarLayout.waiting;
    var reasons = reserveToUpdateTabbarLayout.reasons;
    reserveToUpdateTabbarLayout.reasons = 0;
    reserveToUpdateTabbarLayout.timeout = 0;
    updateTabbarLayout({ reasons });
  }, reserveToUpdateTabbarLayout.timeout);
}
reserveToUpdateTabbarLayout.reasons = 0;
reserveToUpdateTabbarLayout.timeout = 0;

export function updateTabbarLayout(aParams = {}) {
  if (RestoringTabCount.hasMultipleRestoringTabs()) {
    log('updateTabbarLayout: skip until completely restored');
    reserveToUpdateTabbarLayout({
      reason:  aParams.reasons,
      timeout: Math.max(100, aParams.timeout)
    });
    return;
  }
  //log('updateTabbarLayout');
  var range = document.createRange();
  range.selectNodeContents(gTabBar);
  var containerHeight = gTabBar.getBoundingClientRect().height;
  var contentHeight   = range.getBoundingClientRect().height;
  //log('height: ', { container: containerHeight, content: contentHeight });
  var overflow = containerHeight < contentHeight;
  if (overflow && !gTabBar.classList.contains(Constants.kTABBAR_STATE_OVERFLOW)) {
    //log('overflow');
    gTabBar.classList.add(Constants.kTABBAR_STATE_OVERFLOW);
    const range = document.createRange();
    range.selectNode(gAfterTabsForOverflowTabBar.querySelector('.newtab-button-box'));
    const offset = range.getBoundingClientRect().height;
    range.detach();
    gTabBar.style.bottom = `${offset}px`;
    nextFrame().then(() => {
      // Tab at the end of the tab bar can be hidden completely or
      // partially (newly opened in small tab bar, or scrolled out when
      // the window is shrunken), so we need to scroll to it explicitely.
      var current = Tabs.getCurrentTab();
      if (!Scroll.isTabInViewport(current)) {
        log('scroll to current tab on updateTabbarLayout');
        Scroll.scrollToTab(current);
        return;
      }
      var lastOpenedTab = Tabs.getLastOpenedTab();
      var reasons       = aParams.reasons || 0;
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
  else if (!overflow && gTabBar.classList.contains(Constants.kTABBAR_STATE_OVERFLOW)) {
    //log('underflow');
    gTabBar.classList.remove(Constants.kTABBAR_STATE_OVERFLOW);
    gTabBar.style.bottom = '';
  }

  if (aParams.justNow)
    PinnedTabs.reposition(aParams);
  else
    PinnedTabs.reserveToReposition(aParams);
}


export function reserveToUpdateTabTooltip(aTab) {
  if (!gInitialized ||
      !Tabs.ensureLivingTab(aTab))
    return;
  for (const tab of [aTab].concat(Tabs.getAncestorTabs(aTab))) {
    if (tab.reservedUpdateTabTooltip)
      clearTimeout(tab.reservedUpdateTabTooltip);
  }
  aTab.reservedUpdateTabTooltip = setTimeout(() => {
    delete aTab.reservedUpdateTabTooltip;
    updateTabAndAncestorsTooltip(aTab);
  }, 100);
}

function updateTabAndAncestorsTooltip(aTab) {
  if (!Tabs.ensureLivingTab(aTab))
    return;
  for (const tab of [aTab].concat(Tabs.getAncestorTabs(aTab))) {
    updateTabTooltip(tab);
  }
}

function updateTabTooltip(aTab) {
  if (!Tabs.ensureLivingTab(aTab))
    return;

  aTab.dataset.labelWithDescendants = Tabs.getLabelWithDescendants(aTab);

  if (configs.showCollapsedDescendantsByTooltip &&
      Tabs.isSubtreeCollapsed(aTab) &&
      Tabs.hasChildTabs(aTab)) {
    aTab.setAttribute('title', aTab.dataset.labelWithDescendants);
    return;
  }

  if (configs.debug)
    return;

  const label = Tabs.getTabLabel(aTab);
  if (Tabs.isPinned(aTab) || label.classList.contains('overflow')) {
    aTab.setAttribute('title', aTab.dataset.label);
  }
  else {
    aTab.removeAttribute('title');
  }
}


export function reserveToUpdateLoadingState() {
  if (!gInitialized)
    return;
  if (reserveToUpdateLoadingState.waiting)
    clearTimeout(reserveToUpdateLoadingState.waiting);
  reserveToUpdateLoadingState.waiting = setTimeout(() => {
    delete reserveToUpdateLoadingState.waiting;
    updateLoadingState();
  }, 0);
}

function updateLoadingState() {
  if (document.querySelector(`#${gTabBar.id} ${Tabs.kSELECTOR_VISIBLE_TAB}.loading`))
    document.documentElement.classList.add(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
  else
    document.documentElement.classList.remove(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
}

async function synchronizeThrobberAnimation() {
  var toBeSynchronizedTabs = document.querySelectorAll(`${Tabs.kSELECTOR_VISIBLE_TAB}.${Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED}`);
  if (toBeSynchronizedTabs.length == 0)
    return;

  for (const tab of Array.slice(toBeSynchronizedTabs)) {
    tab.classList.remove(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  }
  await nextFrame();
  document.documentElement.classList.add(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
  await nextFrame();
  document.documentElement.classList.remove(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
}

