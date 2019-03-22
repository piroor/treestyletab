/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  configs
} from '/common/common.js';

import * as Constants from '/common/constants.js';
import * as TabsStore from '/common/tabs-store.js';
import * as Tree from '/common/tree.js';

import Tab from '/common/Tab.js';

import * as Background from './background.js';

// eslint-disable-next-line no-unused-vars
function log(...args) {
  internalLogger('sidebar/indent', ...args);
}

let mInitialized = false;
let mIndentDefinition;
let mLastMaxLevel  = -1;
let mLastMaxIndent = -1;
let mTargetWindow;
let mTabBar;

export function init() {
  mTargetWindow = TabsStore.getWindow();
  mTabBar       = document.querySelector('#tabbar');

  window.addEventListener('resize', reserveToUpdateIndent);

  mInitialized = true;
}

export function updateRestoredTree(cachedIndent) {
  updateVisualMaxTreeLevel();
  update({
    force: true,
    cache: cachedIndent
  });
}

export function update(options = {}) {
  if (!options.cache) {
    const maxLevel  = getMaxTreeLevel(mTargetWindow);
    const maxIndent = mTabBar.getBoundingClientRect().width * (0.33);
    if (maxLevel <= mLastMaxLevel &&
        maxIndent == mLastMaxIndent &&
        !options.force)
      return;

    mLastMaxLevel  = maxLevel + 5;
    mLastMaxIndent = maxIndent;
  }
  else {
    mLastMaxLevel  = options.cache.lastMaxLevel;
    mLastMaxIndent = options.cache.lastMaxIndent;
  }

  if (!mIndentDefinition) {
    mIndentDefinition = document.createElement('style');
    mIndentDefinition.setAttribute('type', 'text/css');
    document.head.appendChild(mIndentDefinition);
  }

  const indentProp = (configs.sidebarPosition == Constants.kTABBAR_POSITION_RIGHT) ? 'margin-right' : 'margin-left';
  if (options.cache &&
      options.cache.definition &&
      options.cache.definition.includes(indentProp)) {
    mIndentDefinition.textContent = options.cache.definition;
  }
  else {
    const indentToSelectors = {};
    const defaultIndentToSelectors = {};
    for (let i = 0; i <= mLastMaxLevel; i++) {
      generateIndentAndSelectorsForMaxLevel(i, indentToSelectors, defaultIndentToSelectors);
    }

    const definitions = [];
    for (const indentSet of [defaultIndentToSelectors, indentToSelectors]) {
      const indents = Object.keys(indentSet);
      indents.sort((aA, aB) => parseInt(aA) - parseInt(aB));
      for (const indent of indents) {
        definitions.push(`${indentSet[indent].join(',\n')} { ${indentProp}: ${indent}; }`);
      }
    }
    mIndentDefinition.textContent = definitions.join('\n');
  }
}
function generateIndentAndSelectorsForMaxLevel(maxLevel, indentToSelectors, defaultIndentToSelectors) {
  const minIndent  = Math.max(Constants.kDEFAULT_MIN_INDENT, configs.minIndent);
  const indentUnit = Math.min(configs.baseIndent, Math.max(Math.floor(mLastMaxIndent / maxLevel), minIndent));

  let configuredMaxLevel = configs.maxTreeLevel;
  if (configuredMaxLevel < 0)
    configuredMaxLevel = Number.MAX_SAFE_INTEGER;

  const base = `:root[${Constants.kMAX_TREE_LEVEL}="${maxLevel}"]:not(.initializing) .tab:not(.${Constants.kTAB_STATE_COLLAPSED_DONE})[${Constants.kLEVEL}]`;

  // default indent for unhandled (deep) level tabs
  const defaultIndent = `${Math.min(maxLevel + 1, configuredMaxLevel) * indentUnit}px`;
  if (!defaultIndentToSelectors[defaultIndent])
    defaultIndentToSelectors[defaultIndent] = [];
  defaultIndentToSelectors[defaultIndent].push(`${base}:not([${Constants.kLEVEL}="0"])`);

  for (let level = 1; level <= maxLevel; level++) {
    const indent = `${Math.min(level, configuredMaxLevel) * indentUnit}px`;
    if (!indentToSelectors[indent])
      indentToSelectors[indent] = [];
    indentToSelectors[indent].push(`${base}[${Constants.kLEVEL}="${level}"]`);
  }
}

export function getCacheInfo() {
  return {
    lastMaxLevel:  mLastMaxLevel,
    lastMaxIndent: mLastMaxIndent,
    definition:    mIndentDefinition.textContent
  };
}


export function reserveToUpdateVisualMaxTreeLevel() {
  if (!mInitialized)
    return;
  if (updateVisualMaxTreeLevel.waiting)
    clearTimeout(updateVisualMaxTreeLevel.waiting);
  updateVisualMaxTreeLevel.waiting = setTimeout(() => {
    delete updateVisualMaxTreeLevel.waiting;
    updateVisualMaxTreeLevel();
  }, configs.collapseDuration * 1.5);
}

function updateVisualMaxTreeLevel() {
  const maxLevel = getMaxTreeLevel(mTargetWindow, {
    onlyVisible: configs.indentAutoShrinkOnlyForVisible
  });
  document.documentElement.setAttribute(Constants.kMAX_TREE_LEVEL, Math.max(1, maxLevel));
}

function getMaxTreeLevel(windowId, options = {}) {
  if (typeof options != 'object')
    options = {};
  const tabs = options.onlyVisible ?
    Tab.getVisibleTabs(windowId, { ordered: false }) :
    Tab.getTabs(windowId, { ordered: false }) ;
  let maxLevel = Math.max(...tabs.map(tab => parseInt(tab.$TST.attributes[Constants.kLEVEL] || 0)));
  if (configs.maxTreeLevel > -1)
    maxLevel = Math.min(maxLevel, configs.maxTreeLevel);
  return maxLevel;
}

Tree.onAttached.addListener((_tab, _info) => { reserveToUpdateVisualMaxTreeLevel(); });
Tree.onDetached.addListener(async (_tab, detachInfo = {}) => {
  if (detachInfo.oldParentTab)
    reserveToUpdateVisualMaxTreeLevel();
});


function reserveToUpdateIndent() {
  if (!mInitialized)
    return;
  //log('reserveToUpdateIndent');
  if (reserveToUpdateIndent.waiting)
    clearTimeout(reserveToUpdateIndent.waiting);
  reserveToUpdateIndent.waiting = setTimeout(() => {
    delete reserveToUpdateIndent.waiting;
    update();
  }, Math.max(configs.indentDuration, configs.collapseDuration) * 1.5);
}

Tree.onAttached.addListener((_tab, _info) => { reserveToUpdateIndent() });
Tree.onDetached.addListener((_tab, _info) => { reserveToUpdateIndent() });

Background.onMessage.addListener(async message => {
  switch (message.type) {
    case Constants.kCOMMAND_NOTIFY_TAB_CREATED:
    case Constants.kCOMMAND_NOTIFY_TAB_REMOVING:
      reserveToUpdateVisualMaxTreeLevel();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_SHOWN:
    case Constants.kCOMMAND_NOTIFY_TAB_HIDDEN:
      reserveToUpdateIndent();
      reserveToUpdateVisualMaxTreeLevel();
      break;

    case Constants.kCOMMAND_NOTIFY_TAB_LEVEL_CHANGED:
      reserveToUpdateIndent();
      break;
  }
});
