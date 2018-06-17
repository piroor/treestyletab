/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  wait,
  nextFrame,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as Tabs from '../common/tabs.js';
import * as TabsUpdate from '../common/tabs-update.js';
import * as Tree from '../common/tree.js';
import TabFavIconHelper from '../extlib/TabFavIconHelper.js';

let gInitialized = false;

export function init() {
  gInitialized = true;
  document.querySelector('#master-throbber').addEventListener('animationiteration', synchronizeThrobberAnimation);

  const tabbar = document.querySelector('#tabbar');
  tabbar.addEventListener('overflow', onOverflow);
  tabbar.addEventListener('underflow', onUnderflow);
}

function getTwisty(aTab) {
  return aTab.querySelector(`.${Constants.kTWISTY}`);
}

function getFavIcon(aTab) {
  return aTab.querySelector(`.${Constants.kFAVICON}`);
}

function getSoundButton(aTab) {
  return aTab.querySelector(`.${Constants.kSOUND_BUTTON}`);
}

function getDescendantsCounter(aTab) {
  return aTab.querySelector(`.${Constants.kCOUNTER}`);
}

export function getClosebox(aTab) {
  return aTab.querySelector(`.${Constants.kCLOSEBOX}`);
}


function updateTwisty(aTab) {
  let tooltip;
  if (Tabs.isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab_twisty_collapsed_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_twisty_expanded_tooltip');
  getTwisty(aTab).setAttribute('title', tooltip);
}

function updateClosebox(aTab) {
  let tooltip;
  if (Tabs.hasChildTabs(aTab) && Tabs.isSubtreeCollapsed(aTab))
    tooltip = browser.i18n.getMessage('tab_closebox_tree_tooltip');
  else
    tooltip = browser.i18n.getMessage('tab_closebox_tab_tooltip');
  getClosebox(aTab).setAttribute('title', tooltip);
}

function updateDescendantsCount(aTab) {
  const counter = getDescendantsCounter(aTab);
  if (!counter)
    return;
  const descendants = Tabs.getDescendantTabs(aTab);
  let count = descendants.length;
  if (configs.counterRole == Constants.kCOUNTER_ROLE_ALL_TABS)
    count += 1;
  counter.textContent = count;
}


function reserveToUpdateTooltip(aTab) {
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

function updateTooltip(aTab) {
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

function updateLoadingState() {
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


function onOverflow(aEvent) {
  const tab = Tabs.getTabFromChild(aEvent.target);
  const label = Tabs.getTabLabel(tab);
  if (aEvent.target == label && !Tabs.isPinned(tab)) {
    label.classList.add('overflow');
    reserveToUpdateTooltip(tab);
  }
}

function onUnderflow(aEvent) {
  const tab = Tabs.getTabFromChild(aEvent.target);
  const label = Tabs.getTabLabel(tab);
  if (aEvent.target == label && !Tabs.isPinned(tab)) {
    label.classList.remove('overflow');
    reserveToUpdateTooltip(tab);
  }
}

Tabs.onBuilt.addListener((aTab, aInfo) => {
  const label = Tabs.getTabLabel(aTab);

  const twisty = document.createElement('span');
  twisty.classList.add(Constants.kTWISTY);
  twisty.setAttribute('title', browser.i18n.getMessage('tab_twisty_collapsed_tooltip'));
  aTab.insertBefore(twisty, label);

  const favicon = document.createElement('span');
  favicon.classList.add(Constants.kFAVICON);
  const faviconImage = favicon.appendChild(document.createElement('img'));
  faviconImage.classList.add(Constants.kFAVICON_IMAGE);
  const defaultIcon = favicon.appendChild(document.createElement('span'));
  defaultIcon.classList.add(Constants.kFAVICON_BUILTIN);
  defaultIcon.classList.add(Constants.kFAVICON_DEFAULT); // just for backward compatibility, and this should be removed from future versions
  const throbber = favicon.appendChild(document.createElement('span'));
  throbber.classList.add(Constants.kTHROBBER);
  aTab.insertBefore(favicon, label);

  const counter = document.createElement('span');
  counter.classList.add(Constants.kCOUNTER);
  aTab.appendChild(counter);

  const soundButton = document.createElement('button');
  soundButton.classList.add(Constants.kSOUND_BUTTON);
  aTab.appendChild(soundButton);

  const closebox = document.createElement('span');
  closebox.classList.add(Constants.kCLOSEBOX);
  closebox.setAttribute('title', browser.i18n.getMessage('tab_closebox_tab_tooltip'));
  closebox.setAttribute('draggable', true); // this is required to cancel click by dragging
  aTab.appendChild(closebox);

  const burster = document.createElement('span');
  burster.classList.add(Constants.kBURSTER);
  aTab.appendChild(burster);

  const activeMarker = document.createElement('span');
  activeMarker.classList.add(Constants.kACTIVE_MARKER);
  aTab.appendChild(activeMarker);

  const identityMarker = document.createElement('span');
  identityMarker.classList.add(Constants.kCONTEXTUAL_IDENTITY_MARKER);
  aTab.appendChild(identityMarker);

  const extraItemsContainerBehind = document.createElement('span');
  extraItemsContainerBehind.classList.add(Constants.kEXTRA_ITEMS_CONTAINER);
  extraItemsContainerBehind.classList.add('behind');
  aTab.appendChild(extraItemsContainerBehind);

  aTab.setAttribute('draggable', true);

  if (!aInfo.existing && configs.animation) {
    Tree.collapseExpandTab(aTab, {
      collapsed: true,
      justNow:   true
    });
  }
});

Tabs.onCreated.addListener(aTab => {
  aTab.classList.add(Constants.kTAB_STATE_ANIMATION_READY);
});

Tabs.onRemoving.addListener(reserveToUpdateLoadingState);

Tabs.onRemoved.addListener(async aTab => {
  if (Tabs.isCollapsed(aTab) ||
      !configs.animation)
    return;

  return new Promise(async (aResolve, _aReject) => {
    const tabRect = aTab.getBoundingClientRect();
    aTab.style.marginLeft = `${tabRect.width}px`;
    await wait(configs.animation ? configs.collapseDuration : 0);
    aResolve();
  });
});

Tabs.onMoving.addListener(async aTab => {
  if (!configs.animation ||
      Tabs.isPinned(aTab) ||
      Tabs.isOpening(aTab))
    return;
  aTab.classList.add(Constants.kTAB_STATE_MOVING);
  const visible = !Tabs.isCollapsed(aTab);
  Tree.collapseExpandTab(aTab, {
    collapsed: true,
    justNow:   true
  });
  nextFrame().then(async () => {
    await wait(10); // we need to wait until other operations finished
    if (!Tabs.ensureLivingTab(aTab)) // it was removed while waiting
      return;
    if (visible)
      Tree.collapseExpandTab(aTab, {
        collapsed: false
      });
    await wait(configs.collapseDuration);
    aTab.classList.remove(Constants.kTAB_STATE_MOVING);
  });
});

Tabs.onMoved.addListener(aTab => {
  if (gInitialized)
    reserveToUpdateTooltip(Tabs.getParentTab(aTab));
});

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

Tabs.onDetached.addListener(aTab => {
  if (!gInitialized ||
      !Tabs.ensureLivingTab(aTab))
    return;
  reserveToUpdateTooltip(Tabs.getParentTab(aTab));
});

Tabs.onGroupTabDetected.addListener(aTab => {
  // When a group tab is restored but pending, TST cannot update title of the tab itself.
  // For failsafe now we update the title based on its URL.
  const uri = aTab.apiTab.url;
  const parameters = uri.replace(/^[^\?]+/, '');
  let title = parameters.match(/[&?]title=([^&;]*)/);
  if (!title)
    title = parameters.match(/^\?([^&;]*)/);
  title = title && decodeURIComponent(title[1]) ||
           browser.i18n.getMessage('groupTab_label_default');
  aTab.apiTab.title = title;
  wait(0).then(() => {
    TabsUpdate.updateTab(aTab, { title }, { tab: aTab.apiTab });
  });
});

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
