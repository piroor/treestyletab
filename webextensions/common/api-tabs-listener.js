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

import TabIdFixer from '/extlib/TabIdFixer.js';

import {
  log as internalLogger,
  wait,
  configs
} from './common.js';
import * as Constants from './constants.js';
import * as Tabs from './tabs.js';
import * as TabsUpdate from './tabs-update.js';
import * as TabsInternalOperation from './tabs-internal-operation.js';

function log(...args) {
  internalLogger('common/api-tabs-listener', ...args);
}
function logUpdated(...args) {
  internalLogger('common/tabs-update', ...args);
}

export function startListen() {
  const targetWindow = Tabs.getWindow();

  browser.tabs.onActivated.addListener(onActivated);

  let hasOnUpdated = false;
  try {
    if (typeof targetWindow === 'number') {
      browser.tabs.onUpdated.addListener(onUpdated, { windowId: targetWindow });
      hasOnUpdated = true;
    }
  }
  catch (_error) {
    /* browser.tabs.onUpdated filter not supported (Firefox 60 or earlier) */
  }
  if (!hasOnUpdated)
    browser.tabs.onUpdated.addListener(onUpdated);

  browser.tabs.onHighlighted.addListener(onHighlighted);
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
  browser.tabs.onHighlighted.removeListener(onHighlighted);
  browser.tabs.onCreated.removeListener(onCreated);
  browser.tabs.onRemoved.removeListener(onRemoved);
  browser.tabs.onMoved.removeListener(onMoved);
  browser.tabs.onAttached.removeListener(onAttached);
  browser.tabs.onDetached.removeListener(onDetached);
  browser.windows.onRemoved.removeListener(onWindowRemoved);
}



const mTabOperationQueue = [];

function addTabOperationQueue() {
  let onCompleted;
  const previous = mTabOperationQueue[mTabOperationQueue.length - 1];
  const queue = new Promise((resolve, _aReject) => {
    onCompleted = resolve;
  });
  queue.then(() => {
    mTabOperationQueue.splice(mTabOperationQueue.indexOf(queue), 1);
  });
  mTabOperationQueue.push(queue);
  return [onCompleted, previous];
}

function getTrackedWindow(windowId) {
  if (typeof windowId != 'number')
    throw new Error(`The given ID seems invalid as an window id: ${windowId}`);

  let window = Tabs.trackedWindows.get(windowId);
  if (window &&
      window.element &&
      window.element.parentNode)
    return window;

  if (!window.element) {
    const container = Tabs.buildElementsContainerFor(windowId);
    Tabs.allElementsContainer.appendChild(container);
    window = container.$TST;
  }

  return window;
}

const mLastClosedWhileActiveResolvers = new WeakMap(); // used only on Firefox 64 and older

async function onActivated(activeInfo) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && activeInfo.windowId != targetWindow)
    return;

  Tabs.activeTabForWindow.set(activeInfo.windowId, Tabs.trackedTabs.get(activeInfo.tabId));

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    const window = getTrackedWindow(activeInfo.windowId);

    let byInternalOperation = window.internalFocusCount > 0;
    if (byInternalOperation)
      window.internalFocusCount--;
    const silently = window.internalSilentlyFocusCount > 0;
    if (silently)
      window.internalSilentlyFocusCount--;
    const byTabDuplication = parseInt(window.duplicatingTabsCount) > 0;

    if (Tabs.hasCreatingTab(activeInfo.windowId))
      await Tabs.waitUntilTabsAreCreated(activeInfo.tabId);

    const newActiveTab = Tabs.trackedTabs.get(activeInfo.tabId);
    if (!newActiveTab ||
        !Tabs.ensureLivingTab(newActiveTab)) {
      onCompleted();
      return;
    }

    log('tabs.onActivated: ', newActiveTab);
    const oldActiveTabs = TabsInternalOperation.setTabActive(newActiveTab);

    let byActiveTabRemove = !activeInfo.previousTabId;
    if (!('successorTabId' in newActiveTab)) { // on Firefox 64 or older
      byActiveTabRemove = mLastClosedWhileActiveResolvers.has(window.id);
      if (byActiveTabRemove) {
        window.tryingReforcusForClosingActiveTabCount++;
        mLastClosedWhileActiveResolvers.get(window.id)();
        delete mLastClosedWhileActiveResolvers.delete(window.id);
        const focusRedirected = await window.focusRedirectedForClosingActiveTab;
        delete window.focusRedirectedForClosingActiveTab;
        if (window.tryingReforcusForClosingActiveTabCount > 0) // reduce count even if not redirected
          window.tryingReforcusForClosingActiveTabCount--;
        log('focusRedirected: ', focusRedirected);
        if (focusRedirected) {
          onCompleted();
          return;
        }
      }
      else if (window.tryingReforcusForClosingActiveTabCount > 0) { // treat as "redirected unintentional tab focus"
        window.tryingReforcusForClosingActiveTabCount--;
        byActiveTabRemove  = true;
        byInternalOperation = false;
      }
    }

    if (!Tabs.ensureLivingTab(newActiveTab)) { // it can be removed while waiting
      onCompleted();
      return;
    }

    let focusOverridden = Tabs.onActivating.dispatch(newActiveTab, Object.assign({}, activeInfo, {
      byActiveTabRemove,
      byTabDuplication,
      byInternalOperation,
      silently
    }));
    // don't do await if not needed, to process things synchronously
    if (focusOverridden instanceof Promise)
      focusOverridden = await focusOverridden;
    focusOverridden = focusOverridden === false;
    if (focusOverridden) {
      onCompleted();
      return;
    }

    if (!Tabs.ensureLivingTab(newActiveTab)) { // it can be removed while waiting
      onCompleted();
      return;
    }

    const onActivatedReuslt = Tabs.onActivated.dispatch(newActiveTab, Object.assign({}, activeInfo, {
      oldActiveTabs,
      byActiveTabRemove,
      byTabDuplication,
      byInternalOperation,
      silently
    }));
    // don't do await if not needed, to process things synchronously
    if (onActivatedReuslt instanceof Promise)
      await onActivatedReuslt;
    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

async function onUpdated(tabId, changeInfo, tab) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && tab.windowId != targetWindow)
    return;

  TabIdFixer.fixTab(tab);
  tabId = tab.id;

  if (Tabs.hasCreatingTab(tab.windowId))
    await Tabs.waitUntilTabsAreCreated(tabId);

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    const updatedTab = Tabs.trackedTabs.get(tabId);
    if (!updatedTab ||
        !Tabs.ensureLivingTab(updatedTab)) {
      onCompleted();
      return;
    }

    logUpdated('tabs.onUpdated ', tabId, changeInfo, tab, updatedTab);

    if ('url' in changeInfo)
      changeInfo.previousUrl = updatedTab.url;
    //updatedTab.apiTab = tab;
    /*
      Updated openerTabId is not notified via tabs.onUpdated due to
      https://bugzilla.mozilla.org/show_bug.cgi?id=1409262 , so it can be
      notified with delay as a part of the complete tabs.Tab object,
      "tab" given to this handler. To prevent unexpected tree brekage,
      we should apply updated openerTabId only when it is modified at
      outside of TST (in other words, by any other addon.)
    */
    for (const key of Object.keys(changeInfo)) {
      if (key != 'index')
        updatedTab[key] = changeInfo[key];
    }
    if (changeInfo.url ||
        changeInfo.status == 'complete') {
      // On some edge cases internally changed "favIconUrl" is not
      // notified, so we need to check actual favIconUrl manually.
      // Known cases are:
      //  * Transition from "about:privatebrowsing" to "about:blank"
      //    https://github.com/piroor/treestyletab/issues/1916
      //  * Reopen tab by Ctrl-Shift-T
      browser.tabs.get(tabId).then(apiTab => {
        if (apiTab.favIconUrl != updatedTab.favIconUrl)
          onUpdated(tabId, { favIconUrl: apiTab.favIconUrl }, apiTab);
      });
    }
    if (configs.enableWorkaroundForBug1409262 &&
        tab.openerTabId != updatedTab.$TST.updatedOpenerTabId) {
      logUpdated(`openerTabId of ${tabId} is changed by someone!: ${updatedTab.$TST.updatedOpenerTabId} => ${tab.openerTabId}`);
      updatedTab.$TST.updatedOpenerTabId = updatedTab.openerTabId = tab.openerTabId;
    }

    TabsUpdate.updateTab(updatedTab, changeInfo, { tab });
    TabsUpdate.updateParentTab(Tabs.getParentTab(updatedTab));

    const onUpdatedResult = Tabs.onUpdated.dispatch(updatedTab, changeInfo);
    // don't do await if not needed, to process things synchronously
    if (onUpdatedResult instanceof Promise)
      await onUpdatedResult;
    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

const mTabsHighlightedTimers = new Map();
const mLastHighlightedCount  = new Map();
function onHighlighted(highlightInfo) {
  let timer = mTabsHighlightedTimers.get(highlightInfo.windowId);
  if (timer)
    clearTimeout(timer);
  if ((mLastHighlightedCount.get(highlightInfo.windowId) || 0) <= 1 &&
      highlightInfo.tabIds.length == 1) {
    // simple active tab switching
    TabsUpdate.updateTabsHighlighted(highlightInfo);
    return;
  }
  timer = setTimeout(() => {
    mTabsHighlightedTimers.delete(highlightInfo.windowId);
    TabsUpdate.updateTabsHighlighted(highlightInfo);
    mLastHighlightedCount.set(highlightInfo.windowId, highlightInfo.tabIds.length);
  }, 50);
  mTabsHighlightedTimers.set(highlightInfo.windowId, timer);
}

function onCreated(tab) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && tab.windowId != targetWindow)
    return;

  log('tabs.onCreated: ', tab.id);
  return onNewTabTracked(tab);
}

async function onNewTabTracked(tab) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && tab.windowId != targetWindow)
    return null;

  log(`onNewTabTracked(id=${tab.id}): `, tab);

  Tabs.track(tab);

  const window               = getTrackedWindow(tab.windowId);
  const positionedBySelf     = window.toBeOpenedTabsWithPositions > 0;
  const duplicatedInternally = window.duplicatingTabsCount > 0;
  const maybeOrphan          = window.toBeOpenedOrphanTabs > 0;
  const activeTab            = Tabs.getActiveTab(window.id, { element: false });

  Tabs.onBeforeCreate.dispatch(tab, {
    positionedBySelf,
    maybeOrphan,
    activeTab
  });

  if (Tabs.hasCreatingTab(tab.windowId))
    await Tabs.waitUntilAllTabsAreCreated(tab.windowId);

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  log(`onNewTabTracked(id=${tab.id}): start to create tab element`);

  try {
    const newTabElement = Tabs.buildTabElement(tab, { inRemote: !!targetWindow });
    Tabs.addState(newTabElement, Constants.kTAB_STATE_OPENING);

    // New tab's index can become invalid because the value of "index" is same to
    // the one given to browser.tabs.create() instead of actual index.
    // See also: https://github.com/piroor/treestyletab/issues/2131
    tab.index = Math.max(0, Math.min(tab.index, window.element.childNodes.length));

    const nextTabElement = Tabs.getAllTabs(window.id)[tab.index];
    window.element.insertBefore(newTabElement, nextTabElement);

    // We need to update "active" state of a new active tab immediately.
    // Attaching of initial child tab (this new tab may become it) to an
    // existing tab may produce collapsing of existing tree, and a
    // collapsing tree may have the old active tab. On such cases TST
    // tries to move focus to a nearest visible ancestor, instead of this
    // new active tab.
    // See also: https://github.com/piroor/treestyletab/issues/2155
    if (tab.active) {
      Tabs.activeTabForWindow.set(tab.windowId, tab);
      TabsInternalOperation.setTabActive(tab);
    }

    const onTabCreatedInner = Tabs.addCreatingTab(tab);
    const onTabCreated = (uniqueId) => { onTabCreatedInner(uniqueId); onCompleted(); };
    const uniqueId = await tab.$TST.promisedUniqueId;

    if (!Tabs.ensureLivingTab(newTabElement)) { // it can be removed while waiting
      onTabCreated(uniqueId);
      Tabs.untrack(tab.id);
      return;
    }

    TabsUpdate.updateTab(tab, tab, {
      tab,
      forceApply: true
    });

    // tabs can be removed and detached while waiting, so cache them here for `detectTabActionFromNewPosition()`.
    const treeForActionDetection = Tabs.snapshotTreeForActionDetection(tab);

    if (positionedBySelf)
      window.toBeOpenedTabsWithPositions--;
    if (maybeOrphan)
      window.toBeOpenedOrphanTabs--;
    if (duplicatedInternally)
      window.duplicatingTabsCount--;

    const duplicated = duplicatedInternally || uniqueId.duplicated;
    const restored   = uniqueId.restored;
    if (restored) {
      window.restoredCount = window.restoredCount || 0;
      window.restoredCount++;
      if (!window.allTabsRestored) {
        log(`onNewTabTracked(id=${tab.id}): Maybe starting to restore window`);
        window.allTabsRestored = new Promise((resolve, _aReject) => {
          let lastCount = window.restoredCount;
          const timer = setInterval(() => {
            if (lastCount != window.restoredCount) {
              lastCount = window.restoredCount;
              return;
            }
            clearTimeout(timer);
            window.allTabsRestored = null;
            window.restoredCount   = 0;
            log('All tabs are restored');
            resolve(lastCount);
          }, 200);
        });
        window.allTabsRestored = Tabs.onWindowRestoring.dispatch(tab.windowId);
      }
      Tabs.onRestoring.dispatch(tab);
      await window.allTabsRestored;
      log(`onNewTabTracked(id=${tab.id}): continued for restored tab`);
    }
    if (!window.element.parentNode ||
        !newTabElement.parentNode) {
      log(`onNewTabTracked(id=${tab.id}):  => aborted`);
      onTabCreated(uniqueId);
      Tabs.untrack(tab.id);
      return;
    }

    let moved = Tabs.onCreating.dispatch(tab, {
      positionedBySelf,
      maybeOrphan,
      restored,
      duplicated,
      duplicatedInternally,
      activeTab
    });
    // don't do await if not needed, to process things synchronously
    if (moved instanceof Promise)
      moved = await moved;
    moved = moved === false;
    log(`onNewTabTracked(id=${tab.id}): moved = `, moved);

    if (window.element.parentNode) { // it can be removed while waiting
      window.openingTabs.add(tab.id);
      setTimeout(() => {
        if (!window.parentNode) // it can be removed while waiting
          return;
        window.openingTabs.delete(tab.id);
      }, 0);
    }

    if (!Tabs.ensureLivingTab(newTabElement)) { // it can be removed while waiting
      onTabCreated(uniqueId);
      Tabs.untrack(tab.id);
      return;
    }

    log(`onNewTabTracked(id=${tab.id}): uniqueId = `, uniqueId);

    Tabs.onCreated.dispatch(tab, {
      positionedBySelf: positionedBySelf || moved,
      skipFixupTree: !nextTabElement,
      restored,
      duplicated,
      duplicatedInternally,
      originalTab: duplicated && Tabs.trackedTabs.get(uniqueId.originalTabId),
      treeForActionDetection
    });
    wait(configs.newTabAnimationDuration).then(() => {
      Tabs.removeState(tab, Constants.kTAB_STATE_OPENING);
    });
    Tabs.resolveOpened(tab);

    if (!duplicated &&
        restored) {
      Tabs.addState(newTabElement, Constants.kTAB_STATE_RESTORED);
      Tabs.onRestored.dispatch(tab);
      checkRecycledTab(window.id);
    }

    onTabCreated(uniqueId);

    // tab can be changed while creating!
    const renewedTab = await browser.tabs.get(tab.id);
    const changedProps = {};
    for (const key of Object.keys(renewedTab)) {
      if (tab[key] != renewedTab[key])
        changedProps[key] = renewedTab[key];
    }
    if (Object.keys(renewedTab).length > 0)
      onUpdated(tab.id, changedProps, renewedTab);

    const currentActiveTab = Tabs.getActiveTab(tab.windowId);
    if (renewedTab.active &&
        currentActiveTab.id != tab.id)
      onActivated({
        tabId:         tab.id,
        windowId:      tab.windowId,
        previousTabId: currentActiveTab.id
      });

    return newTabElement;
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

// "Recycled tab" is an existing but reused tab for session restoration.
function checkRecycledTab(windowId) {
  const possibleRecycledTabs = Tabs.queryAll({
    windowId: windowId,
    states: [
      Constants.kTAB_STATE_RESTORED, false,
      Constants.kTAB_STATE_OPENING,  false
    ],
    attributes: [
      Constants.kCURRENT_URI, new RegExp(`^(|${configs.guessNewOrphanTabAsOpenedByNewTabCommandUrl}|about:blank|about:privatebrowsing)$`)
    ]
  });
  if (possibleRecycledTabs.length == 0)
    return;

  log(`Detecting recycled tabs for session restoration from ${possibleRecycledTabs.length} tabs`);
  for (const tab of possibleRecycledTabs) {
    if (!Tabs.ensureLivingTab(tab))
      continue;
    const currentId = tab.uniqueId.id;
    Tabs.updateUniqueId(tab).then(uniqueId => {
      if (!Tabs.ensureLivingTab(tab) ||
          !uniqueId.restored ||
          uniqueId.id == currentId ||
          Constants.kTAB_STATE_RESTORED in tab.$TST.states)
        return;
      log('A recycled tab is detected: ', tab);
      Tabs.addState(tab, Constants.kTAB_STATE_RESTORED);
      Tabs.onRestored.dispatch(tab);
    });
  }
}

async function onRemoved(tabId, removeInfo) {
  log('tabs.onRemoved: ', tabId, removeInfo);
  const targetWindow = Tabs.getWindow();
  if (targetWindow && removeInfo.windowId != targetWindow)
    return;

  const window              = getTrackedWindow(removeInfo.windowId);
  const byInternalOperation = window.internalClosingTabs.has(tabId);
  if (byInternalOperation)
    window.internalClosingTabs.delete(tabId);

  if (Tabs.hasCreatingTab(removeInfo.windowId))
    await Tabs.waitUntilAllTabsAreCreated(removeInfo.windowId);

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    const oldTab = Tabs.trackedTabs.get(tabId);
    if (!oldTab) {
      onCompleted();
      return;
    }

    log('tabs.onRemoved, tab is found: ', oldTab);

    Tabs.onStateChanged.dispatch(oldTab);

    if (Tabs.isActive(oldTab) &&
        !('successorTabId' in oldTab)) { // on Firefox 64 or older
      const resolver = Tabs.fetchClosedWhileActiveResolver(oldTab);
      if (resolver)
        mLastClosedWhileActiveResolvers.set(window, resolver);
    }

    const onRemovingResult = Tabs.onRemoving.dispatch(oldTab, Object.assign({}, removeInfo, {
      byInternalOperation
    }));
    // don't do await if not needed, to process things synchronously
    if (onRemovingResult instanceof Promise)
      await onRemovingResult;

    // The removing tab may be attached to tree/someone attached to the removing tab.
    // We need to clear them by onRemoved handlers.
    const oldChildren = Tabs.getChildTabs(oldTab, { element: false });
    const oldParent   = Tabs.getParentTab(oldTab, { element: false });
    Tabs.addState(oldTab, Constants.kTAB_STATE_REMOVING);

    Tabs.trackedWindows.get(removeInfo.windowId).detachTab(oldTab);

    const onRemovedReuslt = Tabs.onRemoved.dispatch(oldTab, Object.assign({}, removeInfo, {
      byInternalOperation,
      oldChildren,
      oldParent
    }));
    // don't do await if not needed, to process things synchronously
    if (onRemovedReuslt instanceof Promise)
      await onRemovedReuslt;
    oldTab.destroy();
    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

async function onMoved(tabId, moveInfo) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && moveInfo.windowId != targetWindow)
    return;

  const window = getTrackedWindow(moveInfo.windowId);

  // Firefox may move the tab between TabsMove.moveTabsInternallyBefore/After()
  // and TabsMove.syncTabsPositionToApiTabs(). We should treat such a movement
  // as an "internal" operation also, because we need to suppress "move back"
  // and other fixup operations around tabs moved by foreign triggers, on such
  // cases. Don't mind, the tab will be rearranged again by delayed
  // TabsMove.syncTabsPositionToApiTabs() anyway!
  const maybeInternalOperation = window.internalMovingTabs.has(tabId);

  if (Tabs.hasCreatingTab(moveInfo.windowId))
    await Tabs.waitUntilTabsAreCreated(tabId);
  if (Tabs.hasMovingTab(moveInfo.windowId))
    await Tabs.waitUntilAllTabsAreMoved(moveInfo.windowId);

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    const onTabMoved = Tabs.addMovingTabId(tabId, moveInfo.windowId);
    const completelyMoved = () => { onTabMoved(); onCompleted() };

    /* When a tab is pinned, tabs.onMoved may be notified before
       tabs.onUpdated(pinned=true) is notified. As the result,
       descendant tabs are unexpectedly moved to the top of the
       tab bar to follow their parent pinning tab. To avoid this
       problem, we have to wait for a while with this "async" and
       do following processes after the tab is completely pinned. */
    const movedTab = Tabs.trackedTabs.get(tabId);
    if (!movedTab) {
      if (maybeInternalOperation)
        window.internalMovingTabs.delete(tabId);
      completelyMoved();
      return;
    }

    let oldPreviousTab = Tabs.getPreviousTab(tabId);
    let oldNextTab     = Tabs.getNextTab(tabId);
    if (movedTab.index != moveInfo.toIndex) { // already moved
      const tabs = Tabs.getAllTabs(moveInfo.windowId);
      oldPreviousTab = tabs[moveInfo.toIndex < moveInfo.fromIndex ? moveInfo.fromIndex : moveInfo.fromIndex - 1];
      oldNextTab     = tabs[moveInfo.toIndex < moveInfo.fromIndex ? moveInfo.fromIndex + 1 : moveInfo.fromIndex];
    }

    let alreadyMoved = false;
    if (window.alreadyMovedTabs.has(tabId)) {
      window.alreadyMovedTabs.delete(tabId);
      alreadyMoved = true;
    }

    const extendedMoveInfo = Object.assign({}, moveInfo, {
      byInternalOperation: maybeInternalOperation,
      alreadyMoved,
      oldPreviousTab,
      oldNextTab
    });
    log('tabs.onMoved: ', movedTab, extendedMoveInfo);

    let canceled = Tabs.onMoving.dispatch(movedTab, extendedMoveInfo);
    // don't do await if not needed, to process things synchronously
    if (canceled instanceof Promise)
      await canceled;
    canceled = canceled === false;
    if (!canceled &&
        Tabs.ensureLivingTab(movedTab)) { // it is removed while waiting
      let newNextIndex = extendedMoveInfo.toIndex;
      if (extendedMoveInfo.fromIndex < newNextIndex)
        newNextIndex++;
      const nextTab = Tabs.getAllTabs(moveInfo.windowId, { element: false })[newNextIndex];
      if (!alreadyMoved &&
          Tabs.getNextTab(movedTab) != nextTab) {
        window.element.insertBefore(movedTab.$TST.element, nextTab.$TST.element);
        if (nextTab) {
          if (nextTab.index > movedTab.index)
            movedTab.index = nextTab.index - 1;
          else
            movedTab.index = nextTab.index;
        }
        else {
          movedTab.index = window.tabs.size - 1
        }
        window.trackTab(movedTab);
        log('Tab nodes rearranged by tabs.onMoved listener:\n'+(!configs.debug ? '' :
          Array.from(window.element.childNodes)
            .map(tab => ' - '+tab.apiTab.index+': '+tab.id+(tab.apiTab.id == movedTab.id ? '[MOVED]' : ''))
            .join('\n')),
            { moveInfo });
      }
      const onMovedResult = Tabs.onMoved.dispatch(movedTab, extendedMoveInfo);
      // don't do await if not needed, to process things synchronously
      if (onMovedResult instanceof Promise)
        await onMovedResult;
    }
    if (maybeInternalOperation)
      window.internalMovingTabs.delete(tabId);
    completelyMoved();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

const mTreeInfoForTabsMovingAcrossWindows = new Map();

async function onAttached(tabId, attachInfo) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && attachInfo.newWindowId != targetWindow)
    return;

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    log('tabs.onAttached, id: ', tabId, attachInfo);
    let tab = Tabs.trackedTabs.get(tabId);
    const attachedTab = await browser.tabs.get(tabId);
    if (!attachedTab) {
      onCompleted();
      return;
    }

    if (tab) {
      tab.windowId = attachedTab.windowId
      tab.index    = attachedTab.index;
    }
    else {
      tab = attachedTab;
      TabIdFixer.fixTab(tab);
    }

    TabsInternalOperation.clearOldActiveStateInWindow(attachInfo.newWindowId);
    const info = Object.assign({}, attachInfo, mTreeInfoForTabsMovingAcrossWindows.get(tabId));
    mTreeInfoForTabsMovingAcrossWindows.delete(tabId);

    const window = Tabs.trackedWindows.get(attachInfo.newWindowId);
    const newTabElement = await onNewTabTracked(tab);
    const byInternalOperation = newTabElement && window.toBeAttachedTabs.has(tabId);
    if (byInternalOperation)
      window.toBeAttachedTabs.delete(tabId);
    info.byInternalOperation = info.byInternalOperation || byInternalOperation;

    if (!byInternalOperation && newTabElement) { // we should process only tabs attached by others.
      const onAttachedResult = Tabs.onAttached.dispatch(tab, info);
      // don't do await if not needed, to process things synchronously
      if (onAttachedResult instanceof Promise)
        await onAttachedResult;
    }

    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

async function onDetached(tabId, detachInfo) {
  const targetWindow = Tabs.getWindow();
  if (targetWindow && detachInfo.oldWindowId != targetWindow)
    return;

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    log('tabs.onDetached, id: ', tabId, detachInfo);
    const oldTab = Tabs.trackedTabs.get(tabId);
    if (!oldTab) {
      onCompleted();
      return;
    }

    const oldWindow           = Tabs.trackedWindows.get(detachInfo.oldWindowId);
    const byInternalOperation = oldWindow.toBeDetachedTabs.has(tabId);
    if (byInternalOperation)
      oldWindow.toBeDetachedTabs.delete(tabId);

    const info = Object.assign({}, detachInfo, {
      byInternalOperation,
      windowId:    detachInfo.oldWindowId,
      descendants: Tabs.getDescendantTabs(oldTab)
    });
    mTreeInfoForTabsMovingAcrossWindows.set(tabId, info);

    Tabs.onStateChanged.dispatch(oldTab);

    if (!byInternalOperation) // we should process only tabs detached by others.
      Tabs.onDetached.dispatch(oldTab, info);

    const window = Tabs.trackedWindows.get(oldTab.windowId);
    window.element.removeChild(oldTab.$TST.element);
    if (targetWindow)
      window.untrackTab(oldTab.id);
    else
      window.detachTab(oldTab.id);
    if (window.tabs.size == 0)
      window.destroy();

    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

async function onWindowRemoved(windowId) {
  mTabsHighlightedTimers.delete(windowId);
  mLastHighlightedCount.delete(windowId);

  const [onCompleted, previous] = addTabOperationQueue();
  if (!configs.acceleratedTabOperations && previous)
    await previous;

  try {
    log('onWindowRemoved ', windowId);
    const window = Tabs.trackedWindows.get(windowId);
    if (window)
      window.destroy();

    onCompleted();
  }
  catch(e) {
    console.log(e);
    onCompleted();
  }
}

