/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

log.context = 'Sidebar-?';

var gInitializing = true;
var gStyle;
var gFaviconSize        = 0;
var gFaviconizedTabSize = 0;
var gTabHeight          = 0;
var gRestoringTabCount = 0;
var gAddonStyles = {};
var gTargetWindow   = null;
var gScrollLockedBy = {};

MetricsData.add('Loaded');

window.addEventListener('pagehide', destroy, { once: true });
window.addEventListener('load', init, { once: true });

var gTabBar                     = document.querySelector('#tabbar');
var gAfterTabsForOverflowTabBar = document.querySelector('#tabbar ~ .after-tabs');
var gOutOfViewTabNotifier       = document.querySelector('#out-of-view-tab-notifier');
var gMasterThrobber             = document.querySelector('#master-throbber');
var gSizeDefinition             = document.querySelector('#size-definition');
var gStyleLoader                = document.querySelector('#style-loader');
var gBrowserThemeDefinition     = document.querySelector('#browser-theme-definition');
var gUserStyleRules             = document.querySelector('#user-style-rules');
var gContextualIdentitiesStyle  = document.querySelector('#contextual-identity-styling');
var gContextualIdentitySelector = document.getElementById(Constants.kCONTEXTUAL_IDENTITY_SELECTOR);
var gNewTabActionSelector       = document.getElementById(Constants.kNEWTAB_ACTION_SELECTOR);

{ // apply style ASAP!
  // allow customiation for platform specific styles with selectors like `:root[data-user-agent*="Windows NT 10"]`
  document.documentElement.dataset.userAgent = navigator.userAgent;

  let style = location.search.match(/style=([^&]+)/);
  if (style)
    applyStyle(style[1]);
  else
    configs.$loaded.then(() => applyStyle());

  configs.$loaded.then(applyUserStyleRules);
}

UserOperationBlocker.block({ throbber: true });

async function init() {
  MetricsData.add('init start');
  log('initialize sidebar on load');
  window.addEventListener('resize', onResize);

  await Promise.all([
    (async () => {
      var apiTabs = await browser.tabs.query({
        active:        true,
        currentWindow: true
      });
      gTargetWindow = apiTabs[0].windowId;
      Tabs.setWindow(gTargetWindow);
      log.context   = `Sidebar-${gTargetWindow}`;
    })(),
    configs.$loaded
  ]);
  MetricsData.add('browser.tabs.query, configs.$loaded');

  onConfigChange('colorScheme');
  onConfigChange('simulateSVGContextFill');

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
          cachedContents = await getEffectiveWindowCache();
        });

      restoredFromCache = await rebuildAll(cachedContents && cachedContents.tabbar);
      ApiTabsListener.startListen();

      browser.runtime.connect({
        name: `${Constants.kCOMMAND_REQUEST_CONNECT_PREFIX}${gTargetWindow}`
      });
      if (browser.theme && browser.theme.getCurrent) // Firefox 58 and later
        browser.theme.getCurrent(gTargetWindow).then(applyBrowserTheme);

      if (!restoredFromCache)
        await MetricsData.addAsync('inheritTreeStructure', async () => {
          await inheritTreeStructure();
        });

      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('click', onClick);
      document.addEventListener('wheel', onWheel, { capture: true });
      document.addEventListener('contextmenu', onContextMenu, { capture: true });
      document.addEventListener('focus', onFocus);
      document.addEventListener('blur', onBlur);
      gTabBar.addEventListener('scroll', onScroll);
      gTabBar.addEventListener('dblclick', onDblClick);
      gTabBar.addEventListener('transitionend', onTransisionEnd);
      gTabBar.addEventListener('overflow', onOverflow);
      gTabBar.addEventListener('underflow', onUnderflow);
      gMasterThrobber.addEventListener('animationiteration', synchronizeThrobberAnimation);
      startListenDragEvents();
      MetricsData.add('start to listen events');

      configs.$addObserver(onConfigChange);
      onConfigChange('debug');
      onConfigChange('sidebarPosition');
      onConfigChange('sidebarDirection');
      onConfigChange('sidebarScrollbarPosition');
      onConfigChange('scrollbarMode');
      onConfigChange('showContextualIdentitiesSelector');
      onConfigChange('showNewTabActionSelector');
      MetricsData.add('apply configs');

      browser.runtime.onMessage.addListener(onMessage);
      browser.runtime.onMessageExternal.addListener(onMessageExternal);
      if (browser.theme && browser.theme.onUpdated) // Firefox 58 and later
        browser.theme.onUpdated.addListener(onBrowserThemeChanged);
    }),
    MetricsData.addAsync('calculateDefaultSizes', async () => {
      calculateDefaultSizes();
      document.documentElement.classList.remove('initializing');
    }),
    MetricsData.addAsync('initializing contextual identities', async () => {
      gContextualIdentitySelector.ui = new MenuUI({
        root:       gContextualIdentitySelector,
        appearance: 'panel',
        onCommand:  onContextualIdentitySelect,
        animationDuration: configs.animation ? configs.collapseDuration : 0.001
      });
      updateContextualIdentitiesStyle();
      updateContextualIdentitiesSelector();
      ContextualIdentities.startObserve();

      gNewTabActionSelector.ui = new MenuUI({
        root:       gNewTabActionSelector,
        appearance: 'panel',
        onCommand:  onNewTabActionSelect,
        animationDuration: configs.animation ? configs.collapseDuration : 0.001
      });
    }),
    MetricsData.addAsync('tabContextMenu.init', async () => {
      tabContextMenu.init();
    }),
    MetricsData.addAsync('getting registered addons and scroll lock state', async () => {
      var results = await browser.runtime.sendMessage([
        { type: Constants.kCOMMAND_REQUEST_REGISTERED_ADDONS },
        { type: Constants.kCOMMAND_REQUEST_SCROLL_LOCK_STATE }
      ]);
      var addons = results[0];
      TSTAPI.setAddons(addons);
      gScrollLockedBy = results[1];
      for (let id of Object.keys(addons)) {
        let addon = addons[id];
        if (addon.style)
          installStyleForAddon(id, addon.style);
      }
      updateSpecialEventListenersForAPIListeners();
    }),
    MetricsData.addAsync('getting Constants.kWINDOW_STATE_SCROLL_POSITION', async () => {
      scrollPosition = await browser.sessions.getWindowValue(gTargetWindow, Constants.kWINDOW_STATE_SCROLL_POSITION);
    })
  ]));

  if (typeof scrollPosition == 'number') {
    log('restore scroll position');
    cancelRunningScroll();
    scrollTo({
      position: scrollPosition,
      justNow:  true
    });
    MetricsData.add('applying scroll position');
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
    for (let tab of Tabs.getAllTabs()) {
      updateTabTwisty(tab);
      updateTabClosebox(tab);
      updateTabsCount(tab);
      updateTabTooltip(tab);
    }
    reserveToUpdateCachedTabbar();
  }
  updateTabbarLayout({ justNow: true });

  onConfigChange('animation');

  UserOperationBlocker.unblock({ throbber: true });

  MetricsData.add('init end');
  log(`Startup metrics for ${Tabs.getTabs().length} tabs: `, MetricsData.toString());
}

function destroy() {
  configs.$removeObserver(onConfigChange);
  browser.runtime.onMessage.removeListener(onMessage);
  browser.runtime.onMessageExternal.removeListener(onMessageExternal);
  if (browser.theme && browser.theme.onUpdated) // Firefox 58 and later
    browser.theme.onUpdated.removeListener(onBrowserThemeChanged);
  endListenDragEvents();
  ApiTabsListener.endListen();
  ContextualIdentities.endObserve();
  window.removeEventListener('resize', onResize);

  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mouseup', onMouseUp);
  document.removeEventListener('click', onClick);
  document.removeEventListener('wheel', onWheel, { capture: true });
  document.removeEventListener('contextmenu', onContextMenu, { capture: true });
  document.removeEventListener('focus', onFocus);
  document.removeEventListener('blur', onBlur);
  gTabBar.removeEventListener('scroll', onScroll);
  gTabBar.removeEventListener('dblclick', onDblClick);
  gTabBar.removeEventListener('transitionend', onTransisionEnd);
  gTabBar.removeEventListener('overflow', onOverflow);
  gTabBar.removeEventListener('underflow', onUnderflow);
  gMasterThrobber.removeEventListener('animationiteration', synchronizeThrobberAnimation);

  if (onMouseMove.listening)
    window.removeEventListener('mousemove', onMouseMove, { capture: true, passive: true });
  if (onMouseOver.listening)
    window.removeEventListener('mouseover', onMouseOver, { capture: true, passive: true });
  if (onMouseOut.listening)
    window.removeEventListener('mouseout', onMouseOut, { capture: true, passive: true });

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
  log('applying theme ', aTheme);
  if (!aTheme.colors) {
    gBrowserThemeDefinition.textContent = '';
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
  const baseColor = Color.mixCSSColors(aTheme.colors.accentcolor, 'rgba(0, 0, 0, 0)', bgAlpha);
  let toolbarColor = Color.mixCSSColors(baseColor, 'rgba(255, 255, 255, 0.4)', bgAlpha);
  if (aTheme.colors.toolbar)
    toolbarColor = Color.mixCSSColors(baseColor, aTheme.colors.toolbar);
  if (aTheme.colors.tab_line)
    extraColors.push(`--browser-tab-active-marker: ${aTheme.colors.tab_line}`);
  if (aTheme.colors.tab_loading)
    extraColors.push(`--browser-loading-indicator: ${aTheme.colors.tab_loading}`);
  gBrowserThemeDefinition.textContent = `
    :root {
      --browser-bg-base:         ${baseColor};
      --browser-bg-less-lighter: ${Color.mixCSSColors(baseColor, 'rgba(255, 255, 255, 0.25)', bgAlpha)};
      --browser-bg-lighter:      ${toolbarColor};
      --browser-bg-more-lighter: ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.6)', bgAlpha)};
      --browser-bg-lightest:     ${Color.mixCSSColors(toolbarColor, 'rgba(255, 255, 255, 0.85)', bgAlpha)};
      --browser-bg-less-darker:  ${Color.mixCSSColors(baseColor, 'rgba(0, 0, 0, 0.1)', bgAlpha)};
      --browser-bg-darker:       ${Color.mixCSSColors(baseColor, 'rgba(0, 0, 0, 0.25)', bgAlpha)};
      --browser-bg-more-darker:  ${Color.mixCSSColors(baseColor, 'rgba(0, 0, 0, 0.5)', bgAlpha)};
      --browser-fg:              ${aTheme.colors.textcolor};
      --browser-fg-active:       ${aTheme.colors.toolbar_text || aTheme.colors.textcolor};
      --browser-border:          ${Color.mixCSSColors(aTheme.colors.textcolor, 'rgba(0, 0, 0, 0)', 0.4)};
      ${extraColors.join(';\n')}
    }
  `;
}

function calculateDefaultSizes() {
  // first, calculate actual favicon size.
  gFaviconSize = document.querySelector('#dummy-favicon-size-box').getBoundingClientRect().height;
  const scale = Math.max(configs.faviconizedTabScale, 1);
  gFaviconizedTabSize = parseInt(gFaviconSize * scale);
  log('gFaviconSize / gFaviconizedTabSize ', gFaviconSize, gFaviconizedTabSize);
  gSizeDefinition.textContent = `:root {
    --favicon-size:         ${gFaviconSize}px;
    --faviconized-tab-size: ${gFaviconizedTabSize}px;
  }`;
  const dummyTab = document.querySelector('#dummy-tab');
  const dummyTabRect = dummyTab.getBoundingClientRect();
  gTabHeight = dummyTabRect.height;
  const dummyTabbar = document.querySelector('#dummy-tabs');
  const dummyTabbarRect = dummyTabbar.getBoundingClientRect();
  const scrollbarSize = dummyTabbarRect.width - dummyTabRect.width;
  log('gTabHeight ', gTabHeight);
  const baseColor = Color.parseCSSColor(window.getComputedStyle(document.querySelector('#dummy-favicon-size-box'), null).backgroundColor);
  const highlightColor = Color.parseCSSColor(window.getComputedStyle(document.querySelector('#dummy-highlight-color-box'), null).backgroundColor);
  gSizeDefinition.textContent += `:root {
    --tab-height: ${gTabHeight}px;
    --scrollbar-size: ${scrollbarSize}px;
    --narrow-scrollbar-size: ${configs.narrowScrollbarSize}px;

    --tab-burst-duration: ${configs.burstDuration}ms;
    --indent-duration:    ${configs.indentDuration}ms;
    --collapse-duration:  ${configs.collapseDuration}ms;
    --out-of-view-tab-notify-duration: ${configs.outOfViewTabNotifyDuration}ms;

    --face-highlight-lighter: ${Color.mixCSSColors(baseColor, Object.assign({}, highlightColor, { alpha: 0.35 }),)};
    --face-highlight-more-lighter: ${Color.mixCSSColors(baseColor, Object.assign({}, highlightColor, { alpha: 0.2 }))};
    --face-highlight-more-more-lighter: ${Color.mixCSSColors(baseColor, Object.assign({}, highlightColor, { alpha: 0.1 }))};
    --face-gradient-start-active: rgba(${baseColor.red}, ${baseColor.green}, ${baseColor.blue}, 0.4);
    --face-gradient-start-inactive: rgba(${baseColor.red}, ${baseColor.green}, ${baseColor.blue}, 0.2);
    --face-gradient-end: rgba(${baseColor.red}, ${baseColor.green}, ${baseColor.blue}, 0);
  }`;
}

function updateContextualIdentitiesStyle() {
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

function updateContextualIdentitiesSelector() {
  const anchors = Array.slice(document.querySelectorAll(`.${Constants.kCONTEXTUAL_IDENTITY_SELECTOR}-marker`));
  for (let anchor of anchors) {
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
    let defaultCotnainerItem = document.createElement('li');
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

function updateSpecialEventListenersForAPIListeners() {
  if ((TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_MOUSEMOVE).length > 0) != onMouseMove.listening) {
    if (!onMouseMove.listening) {
      window.addEventListener('mousemove', onMouseMove, { capture: true, passive: true });
      onMouseMove.listening = true;
    }
    else {
      window.removeEventListener('mousemove', onMouseMove, { capture: true, passive: true });
      onMouseMove.listening = false;
    }
  }

  if ((TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_MOUSEOVER) > 0) != onMouseOver.listening) {
    if (!onMouseOver.listening) {
      window.addEventListener('mouseover', onMouseOver, { capture: true, passive: true });
      onMouseOver.listening = true;
    }
    else {
      window.removeEventListener('mouseover', onMouseOver, { capture: true, passive: true });
      onMouseOver.listening = false;
    }
  }

  if ((TSTAPI.getListenersForMessageType(TSTAPI.kNOTIFY_TAB_MOUSEOUT) > 0) != onMouseOut.listening) {
    if (!onMouseOut.listening) {
      window.addEventListener('mouseout', onMouseOut, { capture: true, passive: true });
      onMouseOut.listening = true;
    }
    else {
      window.removeEventListener('mouseout', onMouseOut, { capture: true, passive: true });
      onMouseOut.listening = false;
    }
  }
}

async function rebuildAll(aCache) {
  var apiTabs = await browser.tabs.query({ currentWindow: true });
  TabsContainer.clearAll();

  if (aCache) {
    let restored = await restoreTabsFromCache(aCache, { tabs: apiTabs });
    if (restored) {
      MetricsData.add('rebuildAll (from cache)');
      return true;
    }
  }

  let container = TabsContainer.buildFor(gTargetWindow);
  for (let apiTab of apiTabs) {
    TabIdFixer.fixTab(apiTab);
    let newTab = Tabs.buildTab(apiTab, { existing: true, inRemote: true });
    container.appendChild(newTab);
    TabsUpdate.updateTab(newTab, apiTab, { forceApply: true });
  }
  Tabs.allTabsContainer.appendChild(container);
  MetricsData.add('rebuildAll (from scratch)');
  return false;
}

async function inheritTreeStructure() {
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
    let response = await browser.runtime.sendMessage({
      type: Constants.kCOMMAND_PING_TO_BACKGROUND
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
          aMessage.type != Constants.kCOMMAND_PING_TO_SIDEBAR)
        return;
      browser.runtime.onMessage.removeListener(onBackgroundIsReady);
      aResolve();
    };
    browser.runtime.onMessage.addListener(onBackgroundIsReady);
  });
}


function getTabTwisty(aTab) {
  return aTab.querySelector(`.${Constants.kTWISTY}`);
}
function getTabFavicon(aTab) {
  return aTab.querySelector(`.${Constants.kFAVICON}`);
}
function getTabThrobber(aTab) {
  return aTab.querySelector(`.${Constants.kTHROBBER}`);
}
function getTabSoundButton(aTab) {
  return aTab.querySelector(`.${Constants.kSOUND_BUTTON}`);
}
function getTabCounter(aTab) {
  return aTab.querySelector(`.${Constants.kCOUNTER}`);
}
function getTabClosebox(aTab) {
  return aTab.querySelector(`.${Constants.kCLOSEBOX}`);
}


async function confirmToCloseTabs(aCount, aOptions = {}) {
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


function updateTabTwisty(aTab) {
  var tooltip;
  if (Tabs.isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab_twisty_collapsed_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_twisty_expanded_tooltip');
  getTabTwisty(aTab).setAttribute('title', tooltip);
}

function updateTabClosebox(aTab) {
  var tooltip;
  if (Tabs.hasChildTabs(aTab) && Tabs.isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab_closebox_tree_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip');
  getTabClosebox(aTab).setAttribute('title', tooltip);
}

function updateTabsCount(aTab) {
  var counter = getTabCounter(aTab);
  if (!counter)
    return;
  var descendants = Tabs.getDescendantTabs(aTab);
  var count = descendants.length;
  if (configs.counterRole == Constants.kCOUNTER_ROLE_ALL_TABS)
    count += 1;
  counter.textContent = count;
}

function collapseExpandAllSubtree(aParams = {}) {
  var container = Tabs.getTabsContainer(gTargetWindow);
  var tabCondition = `.${Constants.kTAB_STATE_SUBTREE_COLLAPSED}`;
  if (aParams.collapsed)
    tabCondition = `:not(${tabCondition})`;
  var tabs = container.querySelectorAll(`.tab:not([${Constants.kCHILDREN}="|"])${subtreeCondition}`);
  for (let tab of tabs) {
    Tree.collapseExpandSubtree(tab, aParams);
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
  var maxLevel = Tabs.getMaxTreeLevel(gTargetWindow, {
    onlyVisible: configs.indentAutoShrinkOnlyForVisible
  });
  document.documentElement.setAttribute(Constants.kMAX_TREE_LEVEL, Math.max(1, maxLevel));
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
    let maxLevel  = Tabs.getMaxTreeLevel(gTargetWindow);
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
  var minIndent  = Math.max(Constants.kDEFAULT_MIN_INDENT, configs.minIndent);
  var indentUnit = Math.min(configs.baseIndent, Math.max(Math.floor(gLastMaxIndent / aMaxLevel), minIndent));

  var configuredMaxLevel = configs.maxTreeLevel;
  if (configuredMaxLevel < 0)
    configuredMaxLevel = Number.MAX_SAFE_INTEGER;

  var base = `:root[${Constants.kMAX_TREE_LEVEL}="${aMaxLevel}"]:not(.initializing) .tab:not(.${Constants.kTAB_STATE_COLLAPSED_DONE})[${Constants.kLEVEL}]`;

  // default indent for unhandled (deep) level tabs
  let defaultIndent = `${Math.min(aMaxLevel + 1, configuredMaxLevel) * indentUnit}px`;
  if (!aDefaultIndentToSelectors[defaultIndent])
    aDefaultIndentToSelectors[defaultIndent] = [];
  aDefaultIndentToSelectors[defaultIndent].push(`${base}:not([${Constants.kLEVEL}="0"])`);

  for (let level = 1; level <= aMaxLevel; level++) {
    let indent = `${Math.min(level, configuredMaxLevel) * indentUnit}px`;
    if (!aIndentToSelectors[indent])
      aIndentToSelectors[indent] = [];
    aIndentToSelectors[indent].push(`${base}[${Constants.kLEVEL}="${level}"]`);
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
  if (overflow && !gTabBar.classList.contains(Constants.kTABBAR_STATE_OVERFLOW)) {
    //log('overflow');
    gTabBar.classList.add(Constants.kTABBAR_STATE_OVERFLOW);
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
      var current = Tabs.getCurrentTab();
      if (!isTabInViewport(current)) {
        log('scroll to current tab on updateTabbarLayout');
        scrollToTab(current);
        return;
      }
      var lastOpenedTab = Tabs.getLastOpenedTab();
      var reasons       = aParams.reasons || 0;
      if (reasons & Constants.kTABBAR_UPDATE_REASON_TAB_OPEN &&
          !isTabInViewport(lastOpenedTab)) {
        log('scroll to last opened tab on updateTabbarLayout ', reasons);
        scrollToTab(lastOpenedTab, {
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
    positionPinnedTabs(aParams);
  else
    reserveToPositionPinnedTabs(aParams);
}


function reserveToUpdateTabTooltip(aTab) {
  if (gInitializing ||
      !Tabs.ensureLivingTab(aTab))
    return;
  for (let tab of [aTab].concat(Tabs.getAncestorTabs(aTab))) {
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
  for (let tab of [aTab].concat(Tabs.getAncestorTabs(aTab))) {
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
  if (document.querySelector(`#${gTabBar.id} ${Tabs.kSELECTOR_VISIBLE_TAB}.loading`))
    document.documentElement.classList.add(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
  else
    document.documentElement.classList.remove(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
}

async function synchronizeThrobberAnimation() {
  var toBeSynchronizedTabs = document.querySelectorAll(`${Tabs.kSELECTOR_VISIBLE_TAB}.${Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED}`);
  if (toBeSynchronizedTabs.length == 0)
    return;

  for (let tab of Array.slice(toBeSynchronizedTabs)) {
    tab.classList.remove(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  }
  await nextFrame();
  document.documentElement.classList.add(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
  await nextFrame();
  document.documentElement.classList.remove(Constants.kTABBAR_STATE_THROBBER_SYNCHRONIZING);
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

