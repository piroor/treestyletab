/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

import TabIdFixer from '../extlib/TabIdFixer.js';

import {
  log as internalLogger,
  wait,
  dumpTab,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as ApiTabs from './api-tabs.js';
import * as Tabs from './tabs.js';
import * as TabsContainer from './tabs-container.js';
import * as TabsUpdate from './tabs-update.js';
import * as TabsInternalOperation from './tabs-internal-operation.js';

function log(...aArgs) {
  if (configs.logFor['common/api-tabs-listener'])
    internalLogger(...aArgs);
}
function logUpdated(...aArgs) {
  if (configs.logOnUpdated)
    internalLogger(...aArgs);
}

export function startListen() {
  browser.tabs.onActivated.addListener(onActivated);
  browser.tabs.onUpdated.addListener(onUpdated);
  browser.tabs.onCreated.addListener(onCreated);
  browser.tabs.onRemoved.addListener(onRemoved);
  browser.tabs.onMoved.addListener(onMoved);
  browser.tabs.onAttached.addListener(onAttached);
  browser.tabs.onDetached.addListener(onDetached);
  browser.windows.onRemoved.addListener(onWindowRemoved);
}

export function endListen() {
  browser.tabs.onActivated.removeListener(onActivated);
  browser.tabs.onUpdated.removeListener(onUpdated);
  browser.tabs.onCreated.removeListener(onCreated);
  browser.tabs.onRemoved.removeListener(onRemoved);
  browser.tabs.onMoved.removeListener(onMoved);
  browser.tabs.onAttached.removeListener(onAttached);
  browser.tabs.onDetached.removeListener(onDetached);
  browser.windows.onRemoved.removeListener(onWindowRemoved);
}



const gTabOperationQueue = [];

function addTabOperationQueue() {
  let onCompleted;
  const previous = gTabOperationQueue[gTabOperationQueue.length - 1];
  const queue = new Promise((aResolve, _aReject) => {
    onCompleted = aResolve;
  });
  queue.then(() => {
    gTabOperationQueue.splice(gTabOperationQueue.indexOf(queue), 1);
  });
  gTabOperationQueue.push(queue);
  return [onCompleted, previous];
}

function getOrBuildTabsContainer(aHint) {
  let container = Tabs.getTabsContainer(aHint);
  if (container)
    return container;

  if (typeof aHint != 'number')
    throw new Error(`The given ID seems invalid as an window id: ${aHint}`);

  container = TabsContainer.buildFor(aHint);
  Tabs.allTabsContainer.appendChild(container);
  return container;
}

const gLastClosedWhileActiveResolvers = new WeakMap();

async function onActivated(aActiveInfo) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && aActiveInfo.windowId != targetWindow)
    return;

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    const container = getOrBuildTabsContainer(aActiveInfo.windowId);

    let byInternalOperation = parseInt(container.dataset.internalFocusCount) > 0;
    if (byInternalOperation)
      TabsContainer.decrementCounter(container, 'internalFocusCount');
    const silently = parseInt(container.dataset.internalSilentlyFocusCount) > 0;
    if (silently)
      TabsContainer.decrementCounter(container, 'internalSilentlyFocusCount');
    const byTabDuplication = parseInt(container.dataset.duplicatingTabsCount) > 0;

    await Tabs.waitUntilTabsAreCreated(aActiveInfo.tabId);

    const newTab = Tabs.getTabById({ tab: aActiveInfo.tabId, window: aActiveInfo.windowId });
    if (!newTab) {
      onCompleted();
      return;
    }

    log('tabs.onActivated: ', dumpTab(newTab));
    const oldActiveTabs = TabsInternalOperation.setTabFocused(newTab);

    let byCurrentTabRemove = gLastClosedWhileActiveResolvers.has(container);
    if (byCurrentTabRemove) {
      TabsContainer.incrementCounter(container, 'tryingReforcusForClosingCurrentTabCount');
      gLastClosedWhileActiveResolvers.get(container)();
      delete gLastClosedWhileActiveResolvers.delete(container);
      const focusRedirected = await container.focusRedirectedForClosingCurrentTab;
      delete container.focusRedirectedForClosingCurrentTab;
      if (parseInt(container.dataset.tryingReforcusForClosingCurrentTabCount) > 0) // reduce count even if not redirected
        TabsContainer.decrementCounter(container, 'tryingReforcusForClosingCurrentTabCount');
      log('focusRedirected: ', focusRedirected);
      if (focusRedirected) {
        onCompleted();
        return;
      }
    }
    else if (parseInt(container.dataset.tryingReforcusForClosingCurrentTabCount) > 0) { // treat as "redirected unintentional tab focus"
      TabsContainer.decrementCounter(container, 'tryingReforcusForClosingCurrentTabCount');
      byCurrentTabRemove  = true;
      byInternalOperation = false;
    }

    if (!Tabs.ensureLivingTab(newTab)) { // it can be removed while waiting
      onCompleted();
      return;
    }

    const focusOverridden = (await Tabs.onActivating.dispatch(newTab, {
      byCurrentTabRemove,
      byTabDuplication,
      byInternalOperation,
      silently
    })) === false;
    if (focusOverridden) {
      onCompleted();
      return;
    }

    if (!Tabs.ensureLivingTab(newTab)) { // it can be removed while waiting
      onCompleted();
      return;
    }

    await Tabs.onActivated.dispatch(newTab, {
      oldActiveTabs,
      byCurrentTabRemove,
      byTabDuplication,
      byInternalOperation,
      silently
    });
    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

async function onUpdated(aTabId, aChangeInfo, aTab) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && aTab.windowId != targetWindow)
    return;

  TabIdFixer.fixTab(aTab);
  aTabId = aTab.id;

  await Tabs.waitUntilTabsAreCreated(aTabId);

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    const updatedTab = Tabs.getTabById({ tab: aTabId, window: aTab.windowId });
    if (!updatedTab) {
      onCompleted();
      return;
    }

    logUpdated('tabs.onUpdated ', aTabId, aChangeInfo, aTab, updatedTab.apiTab);

    //updatedTab.apiTab = aTab;
    /*
      Updated openerTabId is not notified via tabs.onUpdated due to
      https://bugzilla.mozilla.org/show_bug.cgi?id=1409262 , so it can be
      notified with delay as a part of the complete tabs.Tab object,
      "aTab" given to this handler. To prevent unexpected tree brekage,
      we should apply updated openerTabId only when it is modified at
      outside of TST (in other words, by any other addon.)
    */
    for (const key of Object.keys(aChangeInfo)) {
      updatedTab.apiTab[key] = aChangeInfo[key];
    }
    if (configs.enableWorkaroundForBug1409262 &&
        aTab.openerTabId != updatedTab.apiTab.TSTUpdatedOpenerTabId) {
      logUpdated(`openerTabId of ${aTabId} is changed by someone!: ${updatedTab.apiTab.TSTUpdatedOpenerTabId} => ${aTab.openerTabId}`);
      updatedTab.apiTab.TSTUpdatedOpenerTabId = updatedTab.apiTab.openerTabId = aTab.openerTabId;
    }

    TabsUpdate.updateTab(updatedTab, aChangeInfo, {
      tab: aTab
    });
    TabsUpdate.updateParentTab(Tabs.getParentTab(updatedTab));

    await Tabs.onUpdated.dispatch(updatedTab, aChangeInfo);
    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

function onCreated(aTab) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && aTab.windowId != targetWindow)
    return;

  log('tabs.onCreated: ', aTab.id);
  return onNewTabTracked(aTab);
}

async function onNewTabTracked(aTab) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && aTab.windowId != targetWindow)
    return null;

  await Tabs.waitUntilAllTabsAreCreated();

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    log('onNewTabTracked: ', aTab);
    const container = getOrBuildTabsContainer(aTab.windowId);

    const hasNextTab = !!Tabs.getAllTabs(container)[aTab.index];

    const newTab = Tabs.buildTab(aTab, { inRemote: !!targetWindow });
    newTab.classList.add(Constants.kTAB_STATE_OPENING);

    const nextTab = Tabs.getAllTabs(container)[aTab.index];
    container.insertBefore(newTab, nextTab);

    const onTabCreatedInner = Tabs.addCreatingTab(newTab);
    const onTabCreated = (aUniqueId) => { onTabCreatedInner(aUniqueId); onCompleted(); };
    const uniqueId = await newTab.uniqueId;

    if (!Tabs.ensureLivingTab(newTab)) { // it can be removed while waiting
      onTabCreated(uniqueId);
      return;
    }

    TabsUpdate.updateTab(newTab, aTab, {
      tab:        aTab,
      forceApply: true
    });

    // tabs can be removed and detached while waiting, so cache them here for `detectTabActionFromNewPosition()`.
    const treeForActionDetection = Tabs.snapshotTreeForActionDetection(newTab);

    const activeTab            = Tabs.getCurrentTab(container);
    const openedWithPosition   = parseInt(container.dataset.toBeOpenedTabsWithPositions) > 0;
    const duplicatedInternally = parseInt(container.dataset.duplicatingTabsCount) > 0;
    const maybeOrphan          = parseInt(container.dataset.toBeOpenedOrphanTabs) > 0;

    if (openedWithPosition)
      TabsContainer.decrementCounter(container, 'toBeOpenedTabsWithPositions');
    if (maybeOrphan)
      TabsContainer.decrementCounter(container, 'toBeOpenedOrphanTabs');
    if (duplicatedInternally)
      TabsContainer.decrementCounter(container, 'duplicatingTabsCount');

    const duplicated = duplicatedInternally || uniqueId.duplicated;
    const restored   = uniqueId.restored;
    if (restored) {
      container.restoredCount = container.restoredCount || 0;
      container.restoredCount++;
      if (!container.allTabsRestored) {
        log('Maybe starting to restore window ', aTab.id);
        container.allTabsRestored = new Promise((aResolve, _aReject) => {
          let lastCount = container.restoredCount;
          const timer = setInterval(() => {
            if (lastCount != container.restoredCount) {
              lastCount = container.restoredCount;
              return;
            }
            clearTimeout(timer);
            container.allTabsRestored = null;
            container.restoredCount   = 0;
            log('All tabs are restored');
            aResolve(lastCount);
          }, 200);
        });
        container.allTabsRestored = Tabs.onWindowRestoring.dispatch(aTab.windowId);
      }
      Tabs.onRestoring.dispatch(newTab);
      await container.allTabsRestored;
      log('onNewTabTracked: continued for restored tab ', aTab.id);
    }
    if (!container.parentNode ||
        !newTab.parentNode) {
      log(' => aborted ', aTab.id);
      onTabCreated(uniqueId);
      return;
    }

    const moved = (await Tabs.onCreating.dispatch(newTab, {
      maybeOpenedWithPosition: openedWithPosition,
      maybeOrphan,
      restored,
      duplicated,
      duplicatedInternally,
      activeTab
    })) === false;

    if (container.parentNode) { // it can be removed while waiting
      TabsContainer.incrementCounter(container, 'openingCount');
      setTimeout(() => {
        if (!container.parentNode) // it can be removed while waiting
          return;
        TabsContainer.decrementCounter(container, 'openingCount');
      }, 0);
    }

    if (!Tabs.ensureLivingTab(newTab)) { // it can be removed while waiting
      onTabCreated(uniqueId);
      return;
    }

    log('uniqueId: ', uniqueId);

    Tabs.onCreated.dispatch(newTab, {
      openedWithPosition: openedWithPosition || moved,
      skipFixupTree: !hasNextTab,
      restored,
      duplicated,
      duplicatedInternally,
      originalTab: duplicated && Tabs.getTabById({ tab: uniqueId.originalTabId }),
      treeForActionDetection
    });
    wait(configs.newTabAnimationDuration).then(() => {
      newTab.classList.remove(Constants.kTAB_STATE_OPENING);
    });
    Tabs.resolveOpened(newTab);

    if (!duplicated &&
        restored) {
      newTab.classList.add(Constants.kTAB_STATE_RESTORED);
      Tabs.onRestored.dispatch(newTab);
      checkRecycledTab(container);
    }

    if (aTab.active &&
        Tabs.getCurrentTabs().some(aTabElement => aTabElement != newTab && aTabElement.parentNode == newTab.parentNode))
      onActivated({ tabId: aTab.id, windowId: aTab.windowId });

    onTabCreated(uniqueId);
    return newTab;
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

// "Recycled tab" is an existing but reused tab for session restoration.
const kBASE_RECYCLED_TAB_CONDITION = `li:not(.${Constants.kTAB_STATE_RESTORED}):not(.${Constants.kTAB_STATE_OPENING})`;
function checkRecycledTab(aContainer) {
  const possibleRecycledTabs = aContainer.querySelectorAll(`
    ${kBASE_RECYCLED_TAB_CONDITION}:not([${Constants.kCURRENT_URI}]),
    ${kBASE_RECYCLED_TAB_CONDITION}[${Constants.kCURRENT_URI}="${configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl}"],
    ${kBASE_RECYCLED_TAB_CONDITION}[${Constants.kCURRENT_URI}="about:blank"],
    ${kBASE_RECYCLED_TAB_CONDITION}[${Constants.kCURRENT_URI}="about:privatebrowsing"]
  `);
  if (possibleRecycledTabs.length == 0)
    return;

  log(`Detecting recycled tabs for session restoration from ${possibleRecycledTabs.length} tabs`);
  for (const tab of possibleRecycledTabs) {
    const currentId = tab.getAttribute(Constants.kPERSISTENT_ID);
    Tabs.updateUniqueId(tab).then(aUniqueId => {
      if (!Tabs.ensureLivingTab(tab) ||
          !aUniqueId.restored ||
          aUniqueId.id == currentId ||
          tab.classList.contains(Constants.kTAB_STATE_RESTORED))
        return;
      log('A recycled tab is detected: ', dumpTab(tab));
      tab.classList.add(Constants.kTAB_STATE_RESTORED);
      Tabs.onRestored.dispatch(tab);
    });
  }
}

async function onRemoved(aTabId, aRemoveInfo) {
  log('tabs.onRemoved: ', aTabId, aRemoveInfo);
  const targetWindow = Tabs.getWindow();
  if (targetWindow && aRemoveInfo.windowId != targetWindow)
    return;

  const container = getOrBuildTabsContainer(aRemoveInfo.windowId);
  const byInternalOperation = parseInt(container.dataset.internalClosingCount) > 0;
  if (byInternalOperation)
    TabsContainer.decrementCounter(container, 'internalClosingCount');

  await Tabs.waitUntilAllTabsAreCreated();

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    const oldTab = Tabs.getTabById({ tab: aTabId, window: aRemoveInfo.windowId });
    if (!oldTab) {
      onCompleted();
      return;
    }

    log('tabs.onRemoved, tab is found: ', dumpTab(oldTab));

    Tabs.onStateChanged.dispatch(oldTab);

    if (Tabs.isActive(oldTab)) {
      const resolver = Tabs.fetchClosedWhileActiveResolver(oldTab);
      if (resolver)
        gLastClosedWhileActiveResolvers.set(container, resolver);
    }

    await Tabs.onRemoving.dispatch(oldTab, {
      byInternalOperation
    });

    oldTab[Constants.kTAB_STATE_REMOVING] = true;
    oldTab.classList.add(Constants.kTAB_STATE_REMOVING);

    await Tabs.onRemoved.dispatch(oldTab, {
      byInternalOperation
    });
    await onRemovedComplete(oldTab);
    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}
function onRemovedComplete(aTab) {
  clearTabRelationsForRemovedTab(aTab);
  const container = aTab.parentNode;
  if (!container) // it was removed while waiting
    return;
  container.removeChild(aTab);
  if (!container.hasChildNodes())
    container.parentNode.removeChild(container);
}
function clearTabRelationsForRemovedTab(aTab) {
  if (aTab.parentTab) {
    aTab.parentTab.childTabs = aTab.parentTab.childTabs.filter(aChild => aChild != aTab);
    aTab.parentTab = null;
    aTab.ancestorTabs = [];
  }
  for (const child of aTab.childTabs) {
    if (child.parentTab == aTab) {
      child.parentTab = null;
      child.ancestorTabs = child.ancestorTabs.filter(aAncestor => aAncestor != aTab);
    }
  }
}

async function onMoved(aTabId, aMoveInfo) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && aMoveInfo.windowId != targetWindow)
    return;

  const container = getOrBuildTabsContainer(aMoveInfo.windowId);
  const byInternalOperation = parseInt(container.dataset.internalMovingCount) > 0;

  await Tabs.waitUntilTabsAreCreated(aTabId);
  await Tabs.waitUntilAllTabsAreMoved();

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    const onTabMoved = Tabs.addMovingTabId(aTabId);
    const completelyMoved = () => { onTabMoved(); onCompleted() };

    /* When a tab is pinned, tabs.onMoved may be notified before
       tabs.onUpdated(pinned=true) is notified. As the result,
       descendant tabs are unexpectedly moved to the top of the
       tab bar to follow their parent pinning tab. To avoid this
       problem, we have to wait for a while with this "async" and
       do following processes after the tab is completely pinned. */
    const movedTab = Tabs.getTabById({ tab: aTabId, window: aMoveInfo.windowId });
    if (!movedTab) {
      if (byInternalOperation)
        TabsContainer.decrementCounter(container, 'internalMovingCount');
      completelyMoved();
      return;
    }

    let oldPreviousTab = Tabs.getPreviousTab(movedTab);
    let oldNextTab     = Tabs.getNextTab(movedTab);
    if (Tabs.getTabIndex(aMoveInfo) != aMoveInfo.toIndex) { // already moved
      const tabs = Tabs.getAllTabs(container);
      oldPreviousTab = tabs[aMoveInfo.toIndex < aMoveInfo.fromIndex ? aMoveInfo.fromIndex : aMoveInfo.fromIndex - 1];
      oldNextTab     = tabs[aMoveInfo.toIndex < aMoveInfo.fromIndex ? aMoveInfo.fromIndex + 1 : aMoveInfo.fromIndex];
    }
    const moveInfo = Object.assign({}, aMoveInfo, {
      byInternalOperation,
      oldPreviousTab,
      oldNextTab
    });
    log('tabs.onMoved: ', dumpTab(movedTab), moveInfo, movedTab.apiTab);

    let alreadyMoved = false;
    if (parseInt(container.dataset.alreadyMovedTabsCount) > 0) {
      TabsContainer.decrementCounter(container, 'alreadyMovedTabsCount');
      alreadyMoved = true;
    }

    const canceled = (await Tabs.onMoving.dispatch(movedTab, moveInfo)) === false;
    if (!canceled &&
        Tabs.ensureLivingTab(movedTab)) { // it is removed while waiting
      let newNextIndex = moveInfo.toIndex;
      if (moveInfo.fromIndex < newNextIndex)
        newNextIndex++;
      const tabs    = Tabs.getAllTabs(movedTab);
      const nextTab = tabs[newNextIndex];
      if (!alreadyMoved && movedTab.nextSibling != nextTab) {
        container.insertBefore(movedTab, nextTab);
        log('Tab nodes rearranged by tabs.onMoved listener:\n'+(!configs.debug ? '' :
          Array.slice(container.childNodes)
            .map(aTab => aTab.id+(aTab == movedTab ? '[MOVED]' : ''))
            .join('\n')
            .replace(/^/gm, ' - ')));
      }
      const startIndex = Math.min(aMoveInfo.fromIndex, aMoveInfo.toIndex);
      const endIndex   = Math.max(aMoveInfo.fromIndex, aMoveInfo.toIndex);
      for (let i = startIndex; i < endIndex; i++) {
        tabs[i].apiTab.index = i;
      }
      await Tabs.onMoved.dispatch(movedTab, moveInfo);
    }
    if (byInternalOperation)
      TabsContainer.decrementCounter(container, 'internalMovingCount');
    completelyMoved();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

const gTreeInfoForTabsMovingAcrossWindows = new Map();

async function onAttached(aTabId, aAttachInfo) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && aAttachInfo.newWindowId != targetWindow)
    return;

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    log('tabs.onAttached, id: ', aTabId, aAttachInfo);
    let apiTab;
    await Promise.all([
      (async () => {
        apiTab = await browser.tabs.get(aTabId).catch(ApiTabs.handleMissingTabError);
        log(`New apiTab for attached tab ${aTabId}: `, apiTab);
      })(),
      Tabs.waitUntilTabsAreCreated(aTabId)
    ]);
    if (!apiTab) {
      onCompleted();
      return;
    }

    TabIdFixer.fixTab(apiTab);

    TabsInternalOperation.clearOldActiveStateInWindow(aAttachInfo.newWindowId);
    const info = gTreeInfoForTabsMovingAcrossWindows.get(aTabId);
    gTreeInfoForTabsMovingAcrossWindows.delete(aTabId);

    const newTab = await onNewTabTracked(apiTab);
    const byInternalOperation = newTab && parseInt(newTab.parentNode.dataset.toBeAttachedTabs) > 0;
    if (byInternalOperation)
      TabsContainer.decrementCounter(newTab.parentNode, 'toBeAttachedTabs');
    info.byInternalOperation = info.byInternalOperation || byInternalOperation;

    if (!byInternalOperation) // we should process only tabs attached by others.
      await Tabs.onAttached.dispatch(newTab, info);

    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

async function onDetached(aTabId, aDetachInfo) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && aDetachInfo.oldWindowId != targetWindow)
    return;

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    log('tabs.onDetached, id: ', aTabId, aDetachInfo);
    const oldTab = Tabs.getTabById({ tab: aTabId, window: aDetachInfo.oldWindowId });
    if (!oldTab) {
      onCompleted();
      return;
    }

    const byInternalOperation = parseInt(oldTab.parentNode.dataset.toBeDetachedTabs) > 0;
    if (byInternalOperation)
      TabsContainer.decrementCounter(oldTab.parentNode, 'toBeDetachedTabs');

    const info = {
      byInternalOperation,
      windowId:    aDetachInfo.oldWindowId,
      descendants: Tabs.getDescendantTabs(oldTab)
    };
    gTreeInfoForTabsMovingAcrossWindows.set(aTabId, info);

    Tabs.onStateChanged.dispatch(oldTab);

    if (!byInternalOperation) // we should process only tabs detached by others.
      Tabs.onDetached.dispatch(oldTab, info);

    const container = oldTab.parentNode;
    clearTabRelationsForRemovedTab(oldTab);
    container.removeChild(oldTab);
    if (!container.hasChildNodes())
      container.parentNode.removeChild(container);

    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

async function onWindowRemoved(aWindowId) {
  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    log('onWindowRemoved ', aWindowId);
    const container = Tabs.getTabsContainer(aWindowId);
    if (container) {
      for (const tab of Tabs.getAllTabs(container)) {
        if (!tab.reservedCleanupNeedlessGroupTab)
          continue;
        clearTimeout(container.reservedCleanupNeedlessGroupTab);
        delete container.reservedCleanupNeedlessGroupTab;
      }
    }

    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

