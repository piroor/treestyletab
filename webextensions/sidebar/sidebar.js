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
var gIndentProp = 'marginLeft';

window.addEventListener('DOMContentLoaded', init, { once: true });

blockUserOperations();

async function init() {
  log('initialize sidebar');
  window.addEventListener('unload', destroy, { once: true });
  window.addEventListener('resize', onResize);

  gTabBar = document.querySelector('#tabbar');
  gAfterTabsForOverflowTabBar = document.querySelector('#tabbar ~ .after-tabs');
  gAllTabs = document.querySelector('#all-tabs');

  gTabBar.addEventListener('mousedown', onMouseDown);
  gTabBar.addEventListener('click', onClick);
  gTabBar.addEventListener('dblclick', onDblClick);

  await configs.$loaded;
  await rebuildAll();
  log('initialize sidebar: post process');
  updateTabbarLayout({ justNow: true });
  browser.runtime.onMessage.addListener(onMessage);
  document.documentElement.setAttribute(kTWISTY_STYLE, configs.twistyStyle);

  configs.$addObserver(onConfigChange);
  onConfigChange('debug');

  startListenDragEvents(window);

  await inheritTreeStructure();
  unblockUserOperations();
}

function destroy() {
  configs.$removeObserver(onConfigChange);
  browser.runtime.onMessage.removeListener(onMessage);
  endListenDragEvents(gTabBar);
  endObserveApiTabs();
  window.removeEventListener('resize', onResize);

  gTabBar.removeEventListener('mousedown', onMouseDown);
  gTabBar.removeEventListener('click', onClick);
  gTabBar.removeEventListener('dblclick', onDblClick);

  gAllTabs = gTabBar = gAfterTabsForOverflowTabBar = undefined;
}

async function rebuildAll() {
  var apiTabs = await browser.tabs.query({ currentWindow: true });
  gTargetWindow = apiTabs[0].windowId;
  gLogContext = `Sidebar-${gTargetWindow}`;
  clearAllTabsContainers();
  var container = buildTabsContainerFor(gTargetWindow);
  for (let apiTab of apiTabs) {
    let newTab = buildTab(apiTab, { existing: true });
    container.appendChild(newTab);
    updateTab(newTab, apiTab, { forceApply: true });
  }
  gAllTabs.appendChild(container);
  startObserveApiTabs();
}

async function inheritTreeStructure() {
  var response = await browser.runtime.sendMessage({
    type:     kCOMMAND_PULL_TREE_STRUCTURE,
    windowId: gTargetWindow
  }).catch(e => {
    log('inheritTreeStructure: failed to get response. ',
        String(e));
    //throw e;
  });
  if (response && response.structure)
    applyTreeStructureToTabs(getAllTabs(gTargetWindow), response.structure);
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
  log('reserveToUpdateIndent');
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
  var tabCondition = configs.indentAutoShrinkOnlyForVisible ?
                      `${kXPATH_VISIBLE_TAB}[@${kPARENT}]` :
                      `${kXPATH_CONTROLLABLE_TAB}[@${kPARENT}]`;
  var maxLevel = evaluateXPath(
                   `descendant::${tabCondition}[
                     not(preceding-sibling::${tabCondition}/@${kNEST} > @${kNEST})
                   ][
                     not(following-sibling::${tabCondition}/@${kNEST} > @${kNEST})
                   ]/@${kNEST}`,
                   document,
                   XPathResult.NUMBER_TYPE
                 ).numberValue;
  if (isNaN(maxLevel))
    maxLevel = 0;
  if (configs.maxTreeLevel > -1)
    maxLevel = Math.min(maxLevel, configs.maxTreeLevel);

  log('maxLevel ', maxLevel);

  var oldIndent = gIndent;
  var indent    = (oldIndent < 0 ? configs.baseIndent : oldIndent ) * maxLevel;
  var maxIndent = gTabBar.getBoundingClientRect().width * (0.33);
  var minIndent= Math.max(kDEFAULT_MIN_INDENT, configs.minIndent);
  var indentUnit = Math.min(configs.baseIndent, Math.max(Math.floor(maxIndent / maxLevel), minIndent));
  log('calculated result: ', { oldIndent, indent, maxIndent, minIndent, indentUnit });
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

  var definitions = [];
  // default indent for unhandled (deep) level tabs
  definitions.push(`.tab[${kPARENT}]:not([${kNEST}="0"]) { margin-left: ${maxLevel + 1 * indentUnit}px; }`);
  for (let level = 1; level <= maxLevel; level++) {
    definitions.push(`.tab[${kPARENT}][${kNEST}="${level}"] { margin-left: ${level * indentUnit}px; }`);
  }
  gIndentDefinition.textContent = definitions.join('\n');
  log('updated indent definition: ', gIndentDefinition.textContent);
}


function reserveToUpdateTabbarLayout() {
  log('reserveToUpdateTabbarLayout');
  if (reserveToUpdateTabbarLayout.waiting)
    clearTimeout(reserveToUpdateTabbarLayout.waiting);
  reserveToUpdateTabbarLayout.waiting = setTimeout(() => {
    delete reserveToUpdateTabbarLayout.waiting;
    updateTabbarLayout();
  }, 10);
}

function updateTabbarLayout(aParams = {}) {
  log('updateTabbarLayout');
  var range = document.createRange();
  range.selectNodeContents(gTabBar);
  var containerHeight = gTabBar.getBoundingClientRect().height;
  var contentHeight = range.getBoundingClientRect().height;
  log('height: ', { container: containerHeight, content: contentHeight });
  var overflow = containerHeight < contentHeight;
  if (overflow && !gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW)) {
    log('overflow');
    gTabBar.classList.add(kTABBAR_STATE_OVERFLOW);
    let range = document.createRange();
    range.selectNodeContents(gAfterTabsForOverflowTabBar);
    let offset = range.getBoundingClientRect().height;
    range.detach();
    gTabBar.style.bottom = `${offset}px`;
  }
  else if (!overflow && gTabBar.classList.contains(kTABBAR_STATE_OVERFLOW)) {
    log('underflow');
    gTabBar.classList.remove(kTABBAR_STATE_OVERFLOW);
    gTabBar.style.bottom = '';
  }

  positionPinnedTabs(aParams);
}
