/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from '../../common/common.js';

import * as Constants from '../../common/constants.js';
import * as Tabs from '../../common/tabs.js';

let gIndentDefinition;
let gLastMaxLevel  = -1;
let gLastMaxIndent = -1;
let gTargetWindow;
let gTabBar;

export function init() {
  gTargetWindow = Tabs.getWindow();
  gTabBar       = document.querySelector('#tabbar');
}

export function update(aOptions = {}) {
  if (!aOptions.cache) {
    const maxLevel  = Tabs.getMaxTreeLevel(gTargetWindow);
    const maxIndent = gTabBar.getBoundingClientRect().width * (0.33);
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
    const indentToSelectors = {};
    const defaultIndentToSelectors = {};
    for (let i = 0; i <= gLastMaxLevel; i++) {
      generateIndentAndSelectorsForMaxLevel(i, indentToSelectors, defaultIndentToSelectors);
    }

    const indentProp = (configs.sidebarPosition == Constants.kTABBAR_POSITION_RIGHT) ? 'margin-right' : 'margin-left';
    const definitions = [];
    for (let indentSet of [defaultIndentToSelectors, indentToSelectors]) {
      let indents = Object.keys(indentSet);
      indents.sort((aA, aB) => parseInt(aA) - parseInt(aB));
      for (let indent of indents) {
        definitions.push(`${indentSet[indent].join(',\n')} { ${indentProp}: ${indent}; }`);
      }
    }
    gIndentDefinition.textContent = definitions.join('\n');
  }
}
function generateIndentAndSelectorsForMaxLevel(aMaxLevel, aIndentToSelectors, aDefaultIndentToSelectors) {
  const minIndent  = Math.max(Constants.kDEFAULT_MIN_INDENT, configs.minIndent);
  const indentUnit = Math.min(configs.baseIndent, Math.max(Math.floor(gLastMaxIndent / aMaxLevel), minIndent));

  let configuredMaxLevel = configs.maxTreeLevel;
  if (configuredMaxLevel < 0)
    configuredMaxLevel = Number.MAX_SAFE_INTEGER;

  const base = `:root[${Constants.kMAX_TREE_LEVEL}="${aMaxLevel}"]:not(.initializing) .tab:not(.${Constants.kTAB_STATE_COLLAPSED_DONE})[${Constants.kLEVEL}]`;

  // default indent for unhandled (deep) level tabs
  const defaultIndent = `${Math.min(aMaxLevel + 1, configuredMaxLevel) * indentUnit}px`;
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

export function getCacheInfo() {
  return {
    lastMaxLevel:  gLastMaxLevel,
    lastMaxIndent: gLastMaxIndent,
    definition:    gIndentDefinition.textContent
  };
}
