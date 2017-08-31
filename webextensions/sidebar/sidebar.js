/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

gLogContext = 'Sidebar-?';

var gTabBar;
var gAfterTabsForOverflowTabBar;
var gIndent = -1;
var gIndentProp = 'margin-left';
var gTabHeight = 0;
var gStyle;

window.addEventListener('DOMContentLoaded', earlyInit, { once: true });
window.addEventListener('load', init, { once: true });

blockUserOperations();

var gSizeDefinition;
var gStyleLoader;

async function earlyInit() {
  log('initialize sidebar on DOMContentLoaded');
  window.addEventListener('unload', destroy, { once: true });

  gTabBar = document.querySelector('#tabbar');
  gAfterTabsForOverflowTabBar = document.querySelector('#tabbar ~ .after-tabs');
  gAllTabs = document.querySelector('#all-tabs');
  gSizeDefinition = document.querySelector('#size-definition');
  gStyleLoader = document.querySelector('#style-loader');

  await configs.$loaded;
  await applyStyle();
}

async function init() {
  log('initialize sidebar on load');
  window.addEventListener('resize', onResize);

  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('click', onClick);
  gTabBar.addEventListener('dblclick', onDblClick);
  gTabBar.addEventListener('transitionend', onTransisionEnd);

  calculateDefaultSizes();

  await rebuildAll();
  log('initialize sidebar: post process');
  updateTabbarLayout({ justNow: true });

  configs.$addObserver(onConfigChange);
  onConfigChange('debug');

  startListenDragEvents(window);
  await inheritTreeStructure();

  browser.runtime.onMessage.addListener(onMessage);
  unblockUserOperations();
}

function destroy() {
  configs.$removeObserver(onConfigChange);
  browser.runtime.onMessage.removeListener(onMessage);
  endListenDragEvents(gTabBar);
  endObserveApiTabs();
  window.removeEventListener('resize', onResize);

  window.removeEventListener('mousedown', onMouseDown);
  window.removeEventListener('click', onClick);
  gTabBar.removeEventListener('dblclick', onDblClick);
  gTabBar.removeEventListener('transitionend', onTransisionEnd);

  gAllTabs = gTabBar = gAfterTabsForOverflowTabBar = undefined;
}

function getChosenStyle() {
  var style = configs.style;
  if (!style && navigator.platform.indexOf('Linux') == 0)
    style = configs.defaultStyleLinux;
  if (!style && navigator.platform.indexOf('Darwin') == 0)
    style = configs.defaultStyleDarwin;
  if (!style)
    style = configs.defaultStyle;
  return style;
}

function applyStyle() {
  gStyle = getChosenStyle();
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
    case 'flat':
      gStyleLoader.setAttribute('href', 'styles/square/flat.css');
      break;
    case 'vertigo':
      gStyleLoader.setAttribute('href', 'styles/square/vertigo.css');
      break;
    default:
      gStyleLoader.setAttribute('href', 'styles/square/plain.css');
      break;
  }
  return new Promise((aResolve, aReject) => {
    gStyleLoader.addEventListener('load', aResolve, { once: true });
  });
}

function calculateDefaultSizes() {
  var dummyContainer = document.querySelector('#dummy-tabs');
  var dummyTab = buildTab({}, { existing: true });
  dummyContainer.appendChild(dummyTab);
  updateTab(dummyTab, {
    title: 'dummy',
    url: 'about:blank',
    status: 'loading',
    mutedInfo: { muted: false }
  }, { forceApply: true });

  // first, calculate actual favicon size.
  var throbberHeight = document.querySelector('#dummy-favicon').getBoundingClientRect().height;
  gSizeDefinition.textContent = `:root {
    --favicon-size: ${throbberHeight}px;
  }`;
  gTabHeight = dummyTab.getBoundingClientRect().height;
  gSizeDefinition.textContent += `:root {
    --tab-height: ${gTabHeight}px;
  }`;
}

async function rebuildAll() {
  var apiTabs = await browser.tabs.query({ currentWindow: true });
  gTargetWindow = apiTabs[0].windowId;
  gLogContext = `Sidebar-${gTargetWindow}`;
  clearAllTabsContainers();
  var container = buildTabsContainerFor(gTargetWindow);
  for (let apiTab of apiTabs) {
    let newTab = buildTab(apiTab, { existing: true, inRemote: true });
    container.appendChild(newTab);
    updateTab(newTab, apiTab, { forceApply: true });
  }
  gAllTabs.appendChild(container);
  startObserveApiTabs();
}

async function inheritTreeStructure() {
  var response = await sendMessageAndGetResponseWithRetry({
    type:     kCOMMAND_PULL_TREE_STRUCTURE,
    windowId: gTargetWindow
  });
  if (response.structure)
    await applyTreeStructureToTabs(getAllTabs(gTargetWindow), response.structure);
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


function collapseExpandAllSubtree(aParams = {}) {
  var container = getTabsContainer(gTargetWindow);
  var subtreeCondition = aParams.collapsed ?
        `:not(.${kTAB_STATE_SUBTREE_COLLAPSED})` :
        `.${kTAB_STATE_SUBTREE_COLLAPSED}`
  var tabs = container.querySelectorAll(`.tab:not([${kCHILDREN}="|"])${subtreeCondition}`);
  for (let tab of tabs) {
    collapseExpandSubtree(tab, aParams);
  }
}


function reserveToUpdateIndent() {
  //log('reserveToUpdateIndent');
  if (reserveToUpdateIndent.waiting)
    clearTimeout(reserveToUpdateIndent.waiting);
  reserveToUpdateIndent.waiting = setTimeout(() => {
    delete reserveToUpdateIndent.waiting;
    updateIndent();
  }, 100);
}

var gIndentDefinition;
var gLastMaxLevel;

function updateIndent() {
  var maxLevel = getMaxTreeLevel(gTargetWindow, {
                   onlyVisible: configs.indentAutoShrinkOnlyForVisible
                 });
  if (isNaN(maxLevel))
    maxLevel = 0;
  if (configs.maxTreeLevel > -1)
    maxLevel = Math.min(maxLevel, configs.maxTreeLevel);

  //log('maxLevel ', maxLevel);

  var oldIndent = gIndent;
  var indent    = (oldIndent < 0 ? configs.baseIndent : oldIndent ) * maxLevel;
  var maxIndent = gTabBar.getBoundingClientRect().width * (0.33);
  var minIndent= Math.max(kDEFAULT_MIN_INDENT, configs.minIndent);
  var indentUnit = Math.min(configs.baseIndent, Math.max(Math.floor(maxIndent / maxLevel), minIndent));
  //log('calculated result: ', { oldIndent, indent, maxIndent, minIndent, indentUnit });
  if (indent > maxIndent) {
    gIndent = indentUnit;
  }
  else {
    gIndent = -1;
    if ((configs.baseIndent * maxLevel) > maxIndent)
      gIndent = indentUnit;
  }

  if (oldIndent == gIndent && gIndentDefinition && maxLevel == gLastMaxLevel)
    return;

  gLastMaxLevel = maxLevel;

  if (!gIndentDefinition) {
    gIndentDefinition = document.createElement('style');
    gIndentDefinition.setAttribute('type', 'text/css');
    document.head.appendChild(gIndentDefinition);
  }

  // prepare definitions for all tabs including collapsed.
  // otherwise, we'll see odd animation for expanded tabs
  // from indent=0 to indent=expected.
  var definitionsMaxLevel = getMaxTreeLevel(gTargetWindow);
  var definitions = [];
  // default indent for unhandled (deep) level tabs
  definitions.push(`.tab[${kPARENT}]:not([${kLEVEL}="0"]) { ${gIndentProp}: ${definitionsMaxLevel + 1 * indentUnit}px; }`);
  for (let level = 1; level <= definitionsMaxLevel; level++) {
    definitions.push(`.tab[${kPARENT}][${kLEVEL}="${level}"] { ${gIndentProp}: ${level * indentUnit}px; }`);
  }
  gIndentDefinition.textContent = definitions.join('\n');
  //log('updated indent definition: ', gIndentDefinition.textContent);
}


function reserveToUpdateTabbarLayout(aTimeout) {
  //log('reserveToUpdateTabbarLayout');
  if (reserveToUpdateTabbarLayout.waiting)
    clearTimeout(reserveToUpdateTabbarLayout.waiting);
  reserveToUpdateTabbarLayout.waiting = setTimeout(() => {
    delete reserveToUpdateTabbarLayout.waiting;
    updateTabbarLayout();
  }, aTimeout || 10);
}

function updateTabbarLayout(aParams = {}) {
  //log('updateTabbarLayout');
  var range = document.createRange();
  range.selectNodeContents(gTabBar);
  var containerHeight = gTabBar.getBoundingClientRect().height;
  var contentHeight = range.getBoundingClientRect().height;
  //log('height: ', { container: containerHeight, content: contentHeight });
  var overflow = containerHeight < contentHeight;
  if (overflow && !gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW)) {
    //log('overflow');
    gTabBar.classList.add(kTABBAR_STATE_OVERFLOW);
    let range = document.createRange();
    range.selectNodeContents(gAfterTabsForOverflowTabBar);
    let offset = range.getBoundingClientRect().height;
    range.detach();
    gTabBar.style.bottom = `${offset}px`;
  }
  else if (!overflow && gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW)) {
    //log('underflow');
    gTabBar.classList.remove(kTABBAR_STATE_OVERFLOW);
    gTabBar.style.bottom = '';
  }

  reserveToPositionPinnedTabs(aParams);
}
