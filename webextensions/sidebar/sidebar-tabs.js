/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  nextFrame,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as Tree from '../common/tree.js';
import TabFavIconHelper from '../extlib/TabFavIconHelper.js';

let gInitialized = false;

export function init() {
  gInitialized = true;
  document.querySelector('#master-throbber').addEventListener('animationiteration', synchronizeThrobberAnimation);
}

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


function reserveToUpdateLoadingState() {
  if (!gInitialized)
    return;
  if (reserveToUpdateLoadingState.waiting)
    clearTimeout(reserveToUpdateLoadingState.waiting);
  reserveToUpdateLoadingState.waiting = setTimeout(() => {
    delete reserveToUpdateLoadingState.waiting;
    updateLoadingState();
  }, 0);
}

export function updateLoadingState() {
  if (document.querySelector(`#tabbar ${Tabs.kSELECTOR_VISIBLE_TAB}.loading`))
    document.documentElement.classList.add(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
  else
    document.documentElement.classList.remove(Constants.kTABBAR_STATE_HAVE_LOADING_TAB);
}

async function synchronizeThrobberAnimation() {
  const toBeSynchronizedTabs = document.querySelectorAll(`${Tabs.kSELECTOR_VISIBLE_TAB}.${Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED}`);
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


export function updateSoundButtonTooltip(aTab) {
  let tooltip = '';
  if (Tabs.maybeMuted(aTab))
    tooltip = browser.i18n.getMessage('tab_soundButton_muted_tooltip');
  else if (Tabs.maybeSoundPlaying(aTab))
    tooltip = browser.i18n.getMessage('tab_soundButton_playing_tooltip');

  getSoundButton(aTab).setAttribute('title', tooltip);
}


export function updateAll() {
  updateLoadingState();
  synchronizeThrobberAnimation();
  for (const tab of Tabs.getAllTabs()) {
    updateTwisty(tab);
    updateClosebox(tab);
    updateDescendantsCount(tab);
    updateTooltip(tab);
  }
}


Tabs.onRemoving.addListener(reserveToUpdateLoadingState);

Tabs.onStateChanged.addListener(aTab => {
  if (aTab.apiTab.status == 'loading')
    aTab.classList.add(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  else
    aTab.classList.remove(Constants.kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  reserveToUpdateLoadingState();
});

Tabs.onLabelUpdated.addListener(reserveToUpdateTooltip);

Tabs.onFaviconUpdated.addListener((aTab, aURL) => {
  TabFavIconHelper.loadToImage({
    image: getFavIcon(aTab).firstChild,
    tab:   aTab.apiTab,
    url:   aURL
  });
});

Tabs.onCollapsedStateChanged.addListener(reserveToUpdateLoadingState);

Tabs.onUpdated.addListener(updateSoundButtonTooltip);

Tabs.onParentTabUpdated.addListener(updateSoundButtonTooltip);

Tree.onAttached.addListener(async (aTab, aInfo = {}) => {
  if (!gInitialized)
    return;
  updateTwisty(aInfo.parent);
  updateClosebox(aInfo.parent);
  if (aInfo.newlyAttached) {
    const ancestors = [aInfo.parent].concat(Tabs.getAncestorTabs(aInfo.parent));
    for (const ancestor of ancestors) {
      updateDescendantsCount(ancestor);
    }
  }
  reserveToUpdateTooltip(aInfo.parent);
});

Tree.onDetached.addListener(async (_aTab, aDetachInfo = {}) => {
  if (!gInitialized)
    return;
  const parent = aDetachInfo.oldParentTab;
  if (!parent)
    return;
  updateTwisty(parent);
  updateClosebox(parent);
  reserveToUpdateTooltip(parent);
  const ancestors = [parent].concat(Tabs.getAncestorTabs(parent));
  for (const ancestor of ancestors) {
    updateDescendantsCount(ancestor);
  }
});

Tree.onSubtreeCollapsedStateChanging.addListener(aTab => {
  updateTwisty(aTab);
  updateClosebox(aTab);
  if (gInitialized)
    reserveToUpdateTooltip(aTab);
});

configs.$addObserver(aChangedKey => {
  switch (aChangedKey) {
    case 'showCollapsedDescendantsByTooltip':
      if (gInitialized)
        for (const tab of Tabs.getAllTabs()) {
          reserveToUpdateTooltip(tab);
        }
      break;
  }
});
