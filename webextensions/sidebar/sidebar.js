/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'Sidebar-?';

var gTabBar;
var gAfterTabsForOverflowTabBar;
var gOutOfViewTabNotifier;
var gMasterThrobber;
var gFaviconSize        = 0;
var gFaviconizedTabSize = 0;
var gTabHeight          = 0;
var gStyle;
var gRestoringTabCount = 0;

window.addEventListener('DOMContentLoaded', earlyInit, { once: true });
window.addEventListener('load', init, { once: true });

blockUserOperations({ throbber: true });

var gInitializing = true;
var gSizeDefinition;
var gContextualIdentitiesStyle;
var gStyleLoader;
var gBrowserThemeDefinition;
var gUserStyleRules;
var gAddonStyles = {};
var gMetricsData = new MetricsData();
gMetricsData.add('Loaded');

function earlyInit() {
  gMetricsData.add('earlyInit start');
  log('initialize sidebar on DOMContentLoaded');
  window.addEventListener('pagehide', destroy, { once: true });

  gTabBar                     = document.querySelector('#tabbar');
  gAfterTabsForOverflowTabBar = document.querySelector('#tabbar ~ .after-tabs');
  gOutOfViewTabNotifier       = document.querySelector('#out-of-view-tab-notifier');
  gAllTabs                    = document.querySelector('#all-tabs');
  gMasterThrobber             = document.querySelector('#master-throbber');
  gSizeDefinition             = document.querySelector('#size-definition');
  gStyleLoader                = document.querySelector('#style-loader');
  gBrowserThemeDefinition     = document.querySelector('#browser-theme-definition');
  gUserStyleRules             = document.querySelector('#user-style-rules');
  gContextualIdentitiesStyle  = document.querySelector('#contextual-identity-styling');
  gMetricsData.add('earlyInit end');
}

async function init() {
  gMetricsData.add('init start');
  log('initialize sidebar on load');
  window.addEventListener('resize', onResize);

  await Promise.all([
    (async () => {
      var apiTabs = await browser.tabs.query({
        active:        true,
        currentWindow: true
      });
      gTargetWindow = apiTabs[0].windowId;
      gLogContext   = `Sidebar-${gTargetWindow}`;
    })(),
    configs.$loaded
  ]);
  gMetricsData.add('browser.tabs.query, configs.$loaded');

  onConfigChange('colorScheme');
  onConfigChange('simulateSVGContextFill');

  await Promise.all([
    applyStyle(),
    waitUntilBackgroundIsReady(),
    retrieveAllContextualIdentities()
  ]);
  gMetricsData.add('applyStyle, waitUntilBackgroundIsReady and retrieveAllContextualIdentities');

  var cachedContents;
  var restoredFromCache;
  var scrollPosition;
  await gMetricsData.addAsync('parallel initialization tasks', Promise.all([
    gMetricsData.addAsync('main', async () => {
      if (configs.useCachedTree)
        await gMetricsData.addAsync('read cached sidebar contents', async () => {
          cachedContents = await getEffectiveWindowCache();
        });

      restoredFromCache = await rebuildAll(cachedContents && cachedContents.tabbar);
      startObserveApiTabs();

      browser.runtime.sendMessage({
        type:     kNOTIFY_SIDEBAR_OPENED,
        windowId: gTargetWindow
      });
      if (browser.theme && browser.theme.getCurrent) // Firefox 58 and later
        browser.theme.getCurrent(gTargetWindow).then(applyBrowserTheme);

      if (!restoredFromCache)
        await gMetricsData.addAsync('inheritTreeStructure', async () => {
          await inheritTreeStructure();
        });

      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('click', onClick);
      document.addEventListener('change', onChange);
      document.addEventListener('wheel', onWheel, { capture: true });
      document.addEventListener('contextmenu', onContextMenu, { capture: true });
      gTabBar.addEventListener('scroll', onScroll);
      gTabBar.addEventListener('dblclick', onDblClick);
      gTabBar.addEventListener('transitionend', onTransisionEnd);
      gMasterThrobber.addEventListener('animationiteration', synchronizeThrobberAnimation);
      startListenDragEvents();
      gMetricsData.add('start to listen events');

      configs.$addObserver(onConfigChange);
      onConfigChange('debug');
      onConfigChange('sidebarPosition');
      onConfigChange('scrollbarMode');
      onConfigChange('showContextualIdentitiesSelector');
      gMetricsData.add('apply configs');

      browser.runtime.onMessage.addListener(onMessage);
      browser.runtime.onMessageExternal.addListener(onMessageExternal);
      if (browser.theme && browser.theme.onUpdated) // Firefox 58 and later
        browser.theme.onUpdated.addListener(onBrowserThemeChanged);
    }),
    gMetricsData.addAsync('apply styles', async () => {
      applyUserStyleRules();
      gMetricsData.add('applyUserStyleRules');
      calculateDefaultSizes();
      gMetricsData.add('calculateDefaultSizes');
      document.documentElement.classList.remove('initializing');
    }),
    gMetricsData.addAsync('initializing contextual identities', async () => {
      updateContextualIdentitiesStyle();
      updateContextualIdentitiesSelector();
      startObserveContextualIdentities();
    }),
    gMetricsData.addAsync('tabContextMenu.init', async () => {
      tabContextMenu.init();
    }),
    gMetricsData.addAsync('getting registered addons and scroll lock state', async () => {
      var results = await browser.runtime.sendMessage([
        { type: kCOMMAND_REQUEST_REGISTERED_ADDONS },
        { type: kCOMMAND_REQUEST_SCROLL_LOCK_STATE }
      ]);
      var addons = results[0];
      gScrollLockedBy = results[1];
      for (let id of Object.keys(addons)) {
        let addon = addons[id];
        if (addon.style)
          installStyleForAddon(id, addon.style);
      }
    }),
    gMetricsData.addAsync('getting kWINDOW_STATE_SCROLL_POSITION', async () => {
      scrollPosition = await browser.sessions.getWindowValue(gTargetWindow, kWINDOW_STATE_SCROLL_POSITION);
    })
  ]));

  if (typeof scrollPosition == 'number') {
    log('restore scroll position');
    cancelRunningScroll();
    scrollTo({
      position: scrollPosition,
      justNow:  true
    });
    gMetricsData.add('applying scroll position');
  }

  gInitializing = false;

  updateVisualMaxTreeLevel();
  updateIndent({
    force: true,
    cache: cachedContents && cachedContents.indent
  });
  if (!restoredFromCache) {
    updateLoadingState();
    synchronizeThrobberAnimation();
    for (let tab of getAllTabs()) {
      updateTabTwisty(tab);
      updateTabClosebox(tab);
      updateTabsCount(tab);
      updateTabTooltip(tab);
    }
    reserveToUpdateCachedTabbar();
  }
  updateTabbarLayout({ justNow: true });

  onConfigChange('animation');

  unblockUserOperations({ throbber: true });

  gMetricsData.add('post process');

  gMetricsData.add('init end');
  log('Startup metrics: ', gMetricsData.toString());
}

function destroy() {
  browser.runtime.sendMessage({
    type:     kNOTIFY_SIDEBAR_CLOSED,
    windowId: gTargetWindow
  });

  configs.$removeObserver(onConfigChange);
  browser.runtime.onMessage.removeListener(onMessage);
  browser.runtime.onMessageExternal.removeListener(onMessageExternal);
  if (browser.theme && browser.theme.onUpdated) // Firefox 58 and later
    browser.theme.onUpdated.removeListener(onBrowserThemeChanged);
  endListenDragEvents();
  endObserveApiTabs();
  endObserveContextualIdentities();
  window.removeEventListener('resize', onResize);

  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('click', onClick);
  document.removeEventListener('change', onChange);
  document.removeEventListener('wheel', onWheel, { capture: true });
  document.removeEventListener('contextmenu', onContextMenu, { capture: true });
  gTabBar.removeEventListener('scroll', onScroll);
  gTabBar.removeEventListener('dblclick', onDblClick);
  gTabBar.removeEventListener('transitionend', onTransisionEnd);
  gMasterThrobber.removeEventListener('animationiteration', synchronizeThrobberAnimation);

  gAllTabs = gTabBar = gAfterTabsForOverflowTabBar = gMasterThrobber = undefined;
}

function applyStyle() {
  gStyle = configs.style;
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
  return new Promise((aResolve, aReject) => {
    gStyleLoader.addEventListener('load', () => {
      nextFrame().then(aResolve);
    }, { once: true });
  });
}

function applyUserStyleRules() {
  gUserStyleRules.textContent = configs.userStyleRules || '';
}

function applyBrowserTheme(aTheme) {
  if (!aTheme.colors) {
    gBrowserThemeDefinition.textContent = '';
    return;
  }
  var baseColor    = aTheme.colors.accentcolor;
  var toolbarColor = mixCSSColors(baseColor, 'rgba(255, 255, 255, 0.4)');
  if (aTheme.colors.toolbar)
    toolbarColor = mixCSSColors(baseColor, aTheme.colors.toolbar);
  gBrowserThemeDefinition.textContent = `
    :root {
      --browser-bg-base:         ${baseColor};
      --browser-bg-less-lighter: ${mixCSSColors(baseColor, 'rgba(255, 255, 255, 0.25)')};
      --browser-bg-lighter:      ${toolbarColor};
      --browser-bg-more-lighter: ${mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.6)')};
      --browser-bg-lightest:     ${mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.85)')};
      --browser-bg-less-darker:  ${mixCSSColors(baseColor, 'rgba(0, 0, 0, 0.1)')};
      --browser-bg-darker:       ${mixCSSColors(baseColor, 'rgba(0, 0, 0, 0.25)')};
      --browser-bg-more-darker:  ${mixCSSColors(baseColor, 'rgba(0, 0, 0, 0.5)')};
      --browser-fg:              ${aTheme.colors.textcolor};
      --browser-fg-active:       ${aTheme.colors.toolbar_text || aTheme.colors.textcolor};
      --browser-header-url:      url(${JSON.stringify(aTheme.images.headerURL)});
    }
  `;
}

function calculateDefaultSizes() {
  // first, calculate actual favicon size.
  gFaviconSize = document.querySelector('#dummy-favicon-size-box').getBoundingClientRect().height;
  var scale = Math.max(configs.faviconizedTabScale, 1);
  gFaviconizedTabSize = parseInt(gFaviconSize * scale);
  log('gFaviconSize / gFaviconizedTabSize ', gFaviconSize, gFaviconizedTabSize);
  gSizeDefinition.textContent = `:root {
    --favicon-size:         ${gFaviconSize}px;
    --faviconized-tab-size: ${gFaviconizedTabSize}px;
  }`;
  var dummyTab = document.querySelector('#dummy-tab');
  var dummyTabRect = dummyTab.getBoundingClientRect();
  gTabHeight = dummyTabRect.height;
  var dummyTabbar = document.querySelector('#dummy-tabs');
  var dummyTabbarRect = dummyTabbar.getBoundingClientRect();
  var scrollbarSize = dummyTabbarRect.width - dummyTabRect.width;
  log('gTabHeight ', gTabHeight);
  gSizeDefinition.textContent += `:root {
    --tab-height: ${gTabHeight}px;
    --scrollbar-size: ${scrollbarSize}px;
    --narrow-scrollbar-size: ${configs.narrowScrollbarSize}px;

    --tab-burst-duration: ${configs.burstDuration}ms;
    --indent-duration:    ${configs.indentDuration}ms;
    --collapse-duration:  ${configs.collapseDuration}ms;
    --out-of-view-tab-notify-duration: ${configs.outOfViewTabNotifyDuration}ms;
  }`;
}

function updateContextualIdentitiesStyle() {
  var definitions = [];
  for (let id of Object.keys(gContextualIdentities)) {
    let identity = gContextualIdentities[id];
    if (!identity.colorCode)
      continue;
    definitions.push(`
      .tab.contextual-identity-${id} .contextual-identity-marker {
        background-color: ${identity.colorCode};
      }
    `);
  }
  gContextualIdentitiesStyle.textContent = definitions.join('\n');
}

function updateContextualIdentitiesSelector() {
  var selectors = Array.slice(document.querySelectorAll(`.${kCONTEXTUAL_IDENTITY_SELECTOR}`));
  var identityIds = Object.keys(gContextualIdentities);
  var range = document.createRange();
  for (let selector of selectors) {
    range.selectNodeContents(selector);
    range.deleteContents();
    if (identityIds.length == 0) {
      selector.setAttribute('disabled', true);
      continue;
    }
    selector.removeAttribute('disabled');
    let fragment    = document.createDocumentFragment();
    let defaultItem = document.createElement('option');
    defaultItem.setAttribute('value', '');
    fragment.appendChild(defaultItem);
    for (let id of identityIds) {
      let identity = gContextualIdentities[id];
      let item     = document.createElement('option');
      item.setAttribute('value', id);
      if (identity.colorCode) {
        item.style.color           = getReadableForegroundColorFromBGColor(identity.colorCode);
        item.style.backgroundColor = identity.colorCode;
      }
      item.textContent = identity.name;
      fragment.appendChild(item);
    }
    if (configs.inheritContextualIdentityToNewChildTab) {
      let defaultCotnainerItem = document.createElement('option');
      defaultCotnainerItem.setAttribute('value', 'firefox-default');
      defaultCotnainerItem.textContent = browser.i18n.getMessage('tabbar.newTabWithContexualIdentity.default');
      fragment.appendChild(defaultCotnainerItem);
    }
    range.insertNode(fragment);
  }
  range.detach();
}

function installStyleForAddon(aId, aStyle) {
  if (!gAddonStyles[aId]) {
    gAddonStyles[aId] = document.createElement('style');
    gAddonStyles[aId].setAttribute('type', 'text/css');
    document.head.insertBefore(gAddonStyles[aId], gUserStyleRules);
  }
  gAddonStyles[aId].textContent = aStyle;
}

function uninstallStyleForAddon(aId) {
  if (!gAddonStyles[aId])
    return;
  document.head.removeChild(gAddonStyles[aId]);
  delete gAddonStyles[aId];
}

async function rebuildAll(aCache) {
  var apiTabs = await browser.tabs.query({ currentWindow: true });
  clearAllTabsContainers();

  if (aCache) {
    await restoreTabsFromCache(aCache, { tabs: apiTabs });
    gMetricsData.add('rebuildAll (from cache)');
    return true;
  }
  else {
    let container = buildTabsContainerFor(gTargetWindow);
    for (let apiTab of apiTabs) {
      TabIdFixer.fixTab(apiTab);
      let newTab = buildTab(apiTab, { existing: true, inRemote: true });
      container.appendChild(newTab);
      updateTab(newTab, apiTab, { forceApply: true });
    }
    gAllTabs.appendChild(container);
    gMetricsData.add('rebuildAll (from scratch)');
    return false;
  }
}

async function inheritTreeStructure() {
  var response = await browser.runtime.sendMessage({
    type:     kCOMMAND_PULL_TREE_STRUCTURE,
    windowId: gTargetWindow
  });
  gMetricsData.add('inheritTreeStructure: kCOMMAND_PULL_TREE_STRUCTURE');
  if (response.structure) {
    applyTreeStructureToTabs(getAllTabs(gTargetWindow), response.structure);
    gMetricsData.add('inheritTreeStructure: applyTreeStructureToTabs');
  }
}

async function waitUntilBackgroundIsReady() {
  try {
    let response = await browser.runtime.sendMessage({
      type: kCOMMAND_PING_TO_BACKGROUND
    });
    if (response)
      return;
  }
  catch(e) {
  }
  return new Promise((aResolve, aReject) => {
    let onBackgroundIsReady = (aMessage, aSender, aRespond) => {
      if (!aMessage ||
          !aMessage.type ||
          aMessage.type != kCOMMAND_PING_TO_SIDEBAR)
        return;
      browser.runtime.onMessage.removeListener(onBackgroundIsReady);
      aResolve();
    };
    browser.runtime.onMessage.addListener(onBackgroundIsReady);
  });
}


function getTabTwisty(aTab) {
  return aTab.querySelector(`.${kTWISTY}`);
}
function getTabFavicon(aTab) {
  return aTab.querySelector(`.${kFAVICON}`);
}
function getTabThrobber(aTab) {
  return aTab.querySelector(`.${kTHROBBER}`);
}
function getTabSoundButton(aTab) {
  return aTab.querySelector(`.${kSOUND_BUTTON}`);
}
function getTabCounter(aTab) {
  return aTab.querySelector(`.${kCOUNTER}`);
}
function getTabClosebox(aTab) {
  return aTab.querySelector(`.${kCLOSEBOX}`);
}


function updateTabTwisty(aTab) {
  var tooltip;
  if (isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab.twisty.collapsed.tooltip');
  else
    tooltip = browser.i18n.getMessage('tab.twisty.expanded.tooltip');
  getTabTwisty(aTab).setAttribute('title', tooltip);
}

function updateTabClosebox(aTab) {
  var tooltip;
  if (hasChildTabs(aTab) && isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab.closebox.tree.tooltip');
  else
    tooltip = browser.i18n.getMessage('tab.closebox.tab.tooltip');
  getTabClosebox(aTab).setAttribute('title', tooltip);
}

function updateTabsCount(aTab) {
  var counter = getTabCounter(aTab);
  if (!counter)
    return;
  var descendants = getDescendantTabs(aTab);
  var count = descendants.length;
  if (configs.counterRole == kCOUNTER_ROLE_ALL_TABS)
    count += 1;
  counter.textContent = count;
}

function collapseExpandAllSubtree(aParams = {}) {
  var container = getTabsContainer(gTargetWindow);
  var tabCondition = `.${kTAB_STATE_SUBTREE_COLLAPSED}`;
  if (aParams.collapsed)
    tabCondition = `:not(${tabCondition})`;
  var tabs = container.querySelectorAll(`.tab:not([${kCHILDREN}="|"])${subtreeCondition}`);
  for (let tab of tabs) {
    collapseExpandSubtree(tab, aParams);
  }
}


function reserveToUpdateVisualMaxTreeLevel() {
  if (gInitializing)
    return;
  if (updateVisualMaxTreeLevel.waiting)
    clearTimeout(updateVisualMaxTreeLevel.waiting);
  updateVisualMaxTreeLevel.waiting = setTimeout(() => {
    delete updateVisualMaxTreeLevel.waiting;
    updateVisualMaxTreeLevel();
  }, configs.collapseDuration * 1.5);
}

function updateVisualMaxTreeLevel() {
  var maxLevel = getMaxTreeLevel(gTargetWindow, {
    onlyVisible: configs.indentAutoShrinkOnlyForVisible
  });
  document.documentElement.setAttribute(kMAX_TREE_LEVEL, Math.max(1, maxLevel));
}


function reserveToUpdateIndent() {
  if (gInitializing)
    return;
  //log('reserveToUpdateIndent');
  if (reserveToUpdateIndent.waiting)
    clearTimeout(reserveToUpdateIndent.waiting);
  reserveToUpdateIndent.waiting = setTimeout(() => {
    delete reserveToUpdateIndent.waiting;
    updateIndent();
  }, Math.max(configs.indentDuration, configs.collapseDuration) * 1.5);
}

var gIndentDefinition;
var gLastMaxLevel  = -1;
var gLastMaxIndent = -1;
var gIndentProp = 'margin-left';

function updateIndent(aOptions = {}) {
  if (!aOptions.cache) {
    let maxLevel  = getMaxTreeLevel(gTargetWindow);
    let maxIndent = gTabBar.getBoundingClientRect().width * (0.33);
    if (maxLevel <= gLastMaxLevel &&
        maxIndent == gLastMaxIndent &&
        !aOptions.force)
      return;

    gLastMaxLevel  = maxLevel + 5;
    gLastMaxIndent = maxIndent;
  }
  else {
    gLastMaxLevel  = aOptions.cache.lastMaxLevel;
    gLastMaxIndent = aOptions.cache.lastMaxIndent;
  }

  if (!gIndentDefinition) {
    gIndentDefinition = document.createElement('style');
    gIndentDefinition.setAttribute('type', 'text/css');
    document.head.appendChild(gIndentDefinition);
  }

  if (aOptions.cache) {
    gIndentDefinition.textContent = aOptions.cache.definition;
  }
  else {
    let indentToSelectors = {};
    let defaultIndentToSelectors = {};
    for (let i = 0; i <= gLastMaxLevel; i++) {
      generateIndentAndSelectorsForMaxLevel(i, indentToSelectors, defaultIndentToSelectors);
    }

    let definitions = [];
    for (let indentSet of [defaultIndentToSelectors, indentToSelectors]) {
      let indents = Object.keys(indentSet);
      indents.sort((aA, aB) => parseInt(aA) - parseInt(aB));
      for (let indent of indents) {
        definitions.push(`${indentSet[indent].join(',\n')} { ${gIndentProp}: ${indent}; }`);
      }
    }
    gIndentDefinition.textContent = definitions.join('\n');
  }
}
function generateIndentAndSelectorsForMaxLevel(aMaxLevel, aIndentToSelectors, aDefaultIndentToSelectors) {
  var indent     = configs.baseIndent * aMaxLevel;
  var minIndent  = Math.max(kDEFAULT_MIN_INDENT, configs.minIndent);
  var indentUnit = Math.min(configs.baseIndent, Math.max(Math.floor(gLastMaxIndent / aMaxLevel), minIndent));

  var configuredMaxLevel = configs.maxTreeLevel;
  if (configuredMaxLevel < 0)
    configuredMaxLevel = Number.MAX_SAFE_INTEGER;

  var base = `:root[${kMAX_TREE_LEVEL}="${aMaxLevel}"]:not(.initializing) .tab:not(.${kTAB_STATE_COLLAPSED_DONE})[${kLEVEL}]`;

  // default indent for unhandled (deep) level tabs
  let defaultIndent = `${Math.min(aMaxLevel + 1, configuredMaxLevel) * indentUnit}px`;
  if (!aDefaultIndentToSelectors[defaultIndent])
    aDefaultIndentToSelectors[defaultIndent] = [];
  aDefaultIndentToSelectors[defaultIndent].push(`${base}:not([${kLEVEL}="0"])`);

  for (let level = 1; level <= aMaxLevel; level++) {
    let indent = `${Math.min(level, configuredMaxLevel) * indentUnit}px`;
    if (!aIndentToSelectors[indent])
      aIndentToSelectors[indent] = [];
    aIndentToSelectors[indent].push(`${base}[${kLEVEL}="${level}"]`);
  }
}


function reserveToUpdateTabbarLayout(aOptions = {}) {
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

function updateTabbarLayout(aParams = {}) {
  if (gRestoringTabCount > 1) {
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
  if (overflow && !gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW)) {
    //log('overflow');
    gTabBar.classList.add(kTABBAR_STATE_OVERFLOW);
    let range = document.createRange();
    range.selectNodeContents(gAfterTabsForOverflowTabBar);
    range.setStartAfter(gOutOfViewTabNotifier);
    let offset = range.getBoundingClientRect().height;
    range.detach();
    gTabBar.style.bottom = `${offset}px`;
    nextFrame().then(() => {
      // Tab at the end of the tab bar can be hidden completely or
      // partially (newly opened in small tab bar, or scrolled out when
      // the window is shrunken), so we need to scroll to it explicitely.
      var current = getCurrentTab();
      if (!isTabInViewport(current)) {
        log('scroll to current tab on updateTabbarLayout');
        scrollToTab(current);
        return;
      }
      var lastOpenedTab = getLastOpenedTab();
      var reasons       = aParams.reasons || 0;
      if (reasons & kTABBAR_UPDATE_REASON_TAB_OPEN &&
          !isTabInViewport(lastOpenedTab)) {
        log('scroll to last opened tab on updateTabbarLayout ', reasons);
        scrollToTab(lastOpenedTab, {
          anchor:            current,
          notifyOnOutOfView: true
        });
      }
    });
  }
  else if (!overflow && gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW)) {
    //log('underflow');
    gTabBar.classList.remove(kTABBAR_STATE_OVERFLOW);
    gTabBar.style.bottom = '';
  }

  if (aParams.justNow)
    positionPinnedTabs(aParams);
  else
    reserveToPositionPinnedTabs(aParams);
}


function reserveToUpdateTabTooltip(aTab) {
  if (gInitializing ||
      !ensureLivingTab(aTab))
    return;
  for (let tab of [aTab].concat(getAncestorTabs(aTab))) {
    if (tab.reservedUpdateTabTooltip)
      clearTimeout(tab.reservedUpdateTabTooltip);
  }
  aTab.reservedUpdateTabTooltip = setTimeout(() => {
    delete aTab.reservedUpdateTabTooltip;
    updateTabAndAncestorsTooltip(aTab);
  }, 100);
}

function updateTabAndAncestorsTooltip(aTab) {
  if (!ensureLivingTab(aTab))
    return;
  for (let tab of [aTab].concat(getAncestorTabs(aTab))) {
    updateTabTooltip(tab);
  }
}

function updateTabTooltip(aTab) {
  if (!ensureLivingTab(aTab))
    return;
  aTab.dataset.labelWithDescendants = getLabelWithDescendants(aTab);
  aTab.setAttribute('title', isSubtreeCollapsed(aTab) && hasChildTabs(aTab) ?
    aTab.dataset.labelWithDescendants : aTab.dataset.label);
}


function reserveToUpdateLoadingState() {
  if (gInitializing)
    return;
  if (reserveToUpdateLoadingState.waiting)
    clearTimeout(reserveToUpdateLoadingState.waiting);
  reserveToUpdateLoadingState.waiting = setTimeout(() => {
    delete reserveToUpdateLoadingState.waiting;
    updateLoadingState();
  }, 0);
}

function updateLoadingState() {
  if (document.querySelector(`#${gTabBar.id} ${kSELECTOR_VISIBLE_TAB}.loading`))
    document.documentElement.classList.add(kTABBAR_STATE_HAVE_LOADING_TAB);
  else
    document.documentElement.classList.remove(kTABBAR_STATE_HAVE_LOADING_TAB);
}

async function synchronizeThrobberAnimation() {
  var toBeSynchronizedTabs = document.querySelectorAll(`${kSELECTOR_VISIBLE_TAB}.${kTAB_STATE_THROBBER_UNSYNCHRONIZED}`);
  if (toBeSynchronizedTabs.length == 0)
    return;

  for (let tab of Array.slice(toBeSynchronizedTabs)) {
    tab.classList.remove(kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  }
  await nextFrame();
  document.documentElement.classList.add(kTABBAR_STATE_THROBBER_SYNCHRONIZING);
  await nextFrame();
  document.documentElement.classList.remove(kTABBAR_STATE_THROBBER_SYNCHRONIZING);
}


async function notifyOutOfViewTab(aTab) {
  if (gRestoringTabCount > 1) {
    log('notifyOutOfViewTab: skip until completely restored');
    wait(100).then(() => notifyOutOfViewTab(aTab));
    return;
  }
  await nextFrame();
  cancelNotifyOutOfViewTab();
  if (aTab && isTabInViewport(aTab))
    return;
  gOutOfViewTabNotifier.classList.add('notifying');
  await wait(configs.outOfViewTabNotifyDuration);
  cancelNotifyOutOfViewTab();
}

function cancelNotifyOutOfViewTab() {
  gOutOfViewTabNotifier.classList.remove('notifying');
}

