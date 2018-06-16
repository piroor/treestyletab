/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';


function getTwisty(aTab) {
  return aTab.querySelector(`.${Constants.kTWISTY}`);
}

export function getFavIcon(aTab) {
  return aTab.querySelector(`.${Constants.kFAVICON}`);
}

export function getSoundButton(aTab) {
  return aTab.querySelector(`.${Constants.kSOUND_BUTTON}`);
}

function getDescendantsCounter(aTab) {
  return aTab.querySelector(`.${Constants.kCOUNTER}`);
}

export function getClosebox(aTab) {
  return aTab.querySelector(`.${Constants.kCLOSEBOX}`);
}


export function updateTwisty(aTab) {
  let tooltip;
  if (Tabs.isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab_twisty_collapsed_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_twisty_expanded_tooltip');
  getTwisty(aTab).setAttribute('title', tooltip);
}

export function updateClosebox(aTab) {
  let tooltip;
  if (Tabs.hasChildTabs(aTab) && Tabs.isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab_closebox_tree_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip');
  getClosebox(aTab).setAttribute('title', tooltip);
}

export function updateDescendantsCount(aTab) {
  const counter = getDescendantsCounter(aTab);
  if (!counter)
    return;
  const descendants = Tabs.getDescendantTabs(aTab);
  let count = descendants.length;
  if (configs.counterRole == Constants.kCOUNTER_ROLE_ALL_TABS)
    count += 1;
  counter.textContent = count;
}


export function reserveToUpdateTooltip(aTab) {
  if (!Tabs.ensureLivingTab(aTab))
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
    updateTooltip(tab);
  }
}

export function updateTooltip(aTab) {
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
