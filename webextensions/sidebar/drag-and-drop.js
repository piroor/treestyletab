/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1
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
 * Portions created by the Initial Developer are Copyright (C) 2010-2019
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 Infocatcher <https://github.com/Infocatcher>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *
 * ***** END LICENSE BLOCK ******/
'use strict';


import RichConfirm from '/extlib/RichConfirm.js';

import {
  filterMap,
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as ApiTabs from '/common/api-tabs.js';
import * as TabsStore from '/common/tabs-store.js';
import * as TreeBehavior from '/common/tree-behavior.js';
import * as TSTAPI from '/common/tst-api.js';
import * as Scroll from './scroll.js';
import * as EventUtils from './event-utils.js';
import * as SidebarTabs from './sidebar-tabs.js';
import * as BackgroundConnection from './background-connection.js';

import Tab from '/common/Tab.js';

function log(...args) {
  internalLogger('sidebar/drag-and-drop', ...args);
}


const kTREE_DROP_TYPE   = 'application/x-treestyletab-tree';
const kTYPE_X_MOZ_URL   = 'text/x-moz-url';
const kTYPE_URI_LIST    = 'text/uri-list';
const kBOOKMARK_FOLDER  = 'x-moz-place:';

const kDROP_BEFORE  = 'before';
const kDROP_ON_SELF = 'self';
const kDROP_AFTER   = 'after';
const kDROP_IMPOSSIBLE = 'impossible';

const kDROP_POSITION = 'data-drop-position';

const kTABBAR_STATE_TAB_DRAGGING  = 'tab-dragging';
const kTABBAR_STATE_LINK_DRAGGING = 'link-dragging';

let mLongHoverExpandedTabs = [];
let mLongHoverTimer;
let mLongHoverTimerNext;

let mDraggingOnSelfWindow = false;
let mDraggingOnDraggedTabs = false;

let mCapturingForDragging = false;
let mReadyToCaptureMouseEvents = false;
let mLastDragEnteredTarget = null;
let mLastDropPosition      = null;
let mDragTargetIsClosebox  = false;
let mCurrentDragData       = null;

let mDragBehaviorNotification;
let mInstanceId;

export function init() {
  document.addEventListener('dragstart', onDragStart); // eslint-disable-line no-use-before-define
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('dragend', onDragEnd);
  document.addEventListener('drop', onDrop);

  browser.runtime.onMessage.addListener(onMessage);

  mDragBehaviorNotification = document.getElementById('tab-drag-notification');

  browser.runtime.sendMessage({ type: Constants.kCOMMAND_GET_INSTANCE_ID }).then(id => mInstanceId = id);
}


export function isCapturingForDragging() {
  return mCapturingForDragging;
}

export function endMultiDrag(tab, coordinates) {
  const treeItem = tab && new TSTAPI.TreeItem(tab);
  if (mCapturingForDragging) {
    window.removeEventListener('mouseover', onTSTAPIDragEnter, { capture: true });
    window.removeEventListener('mouseout',  onTSTAPIDragExit, { capture: true });
    document.releaseCapture();

    TSTAPI.sendMessage({
      type:    TSTAPI.kNOTIFY_TAB_DRAGEND,
      tab:     treeItem,
      window:  tab && tab.windowId,
      windowId: tab && tab.windowId,
      clientX: coordinates.clientX,
      clientY: coordinates.clientY
    }, { tabProperties: ['tab'] }).catch(_error => {});

    mLastDragEnteredTarget = null;
  }
  else if (mReadyToCaptureMouseEvents) {
    TSTAPI.sendMessage({
      type:    TSTAPI.kNOTIFY_TAB_DRAGCANCEL,
      tab:     treeItem,
      window:  tab && tab.windowId,
      windowId: tab && tab.windowId,
      clientX: coordinates.clientX,
      clientY: coordinates.clientY
    }, { tabProperties: ['tab'] }).catch(_error => {});
  }
  mCapturingForDragging = false;
  mReadyToCaptureMouseEvents = false;
}

function setDragData(dragData) {
  return mCurrentDragData = dragData;
}


/* helpers */

function getDragDataFromOneTab(tab) {
  if (!tab)
    return {
      tab:      null,
      tabs:     [],
      windowId: null,
      instanceId: mInstanceId,
      structure:  []
    };
  const tabs = getDraggedTabsFromOneTab(tab);
  return {
    tab,
    tabs,
    structure:  TreeBehavior.getTreeStructureFromTabs(tabs),
    windowId:   tab.windowId,
    instanceId: mInstanceId
  };
}

function getDraggedTabsFromOneTab(tab) {
  if (tab.$TST.multiselected)
    return Tab.getSelectedTabs(tab.windowId);
  return [tab].concat(tab.$TST.descendants);
}

function sanitizeDragData(dragData) {
  return {
    tab:      dragData.tab && dragData.tab.$TST.sanitized,
    tabs:     dragData.tabs.map(tab => tab && tab.$TST.sanitized),
    structure:  dragData.structure,
    windowId:   dragData.windowId,
    instanceId: dragData.instanceId,
    behavior:   dragData.behavior,
    individualOnOutside: dragData.individualOnOutside
  };
}

function getDropAction(event) {
  const dragOverTab = EventUtils.getTabFromEvent(event);
  const targetTab   = dragOverTab || EventUtils.getTabFromTabbarEvent(event);
  const info = {
    dragOverTab,
    targetTab,
    dropPosition:  null,
    action:        null,
    parent:        null,
    insertBefore:  null,
    insertAfter:   null,
    defineGetter(name, getter) {
      delete this[name];
      Object.defineProperty(this, name, {
        get() {
          delete this[name];
          return this[name] = getter.call(this);
        },
        configurable: true,
        enumerable:   true
      });
    }
  };
  info.defineGetter('dragData', () => {
    const dragData = event.dataTransfer.getData(kTREE_DROP_TYPE);
    return (dragData && JSON.parse(dragData)) || mCurrentDragData;
  });
  info.defineGetter('draggedTab', () => {
    const dragData = info.dragData;
    if (dragData && dragData.instanceId != mInstanceId)
      return null;
    const tab      = dragData && dragData.tab;
    return tab && Tab.get(tab.id) || tab;
  });
  info.defineGetter('draggedTabs', () => {
    const dragData = info.dragData;
    if (dragData && dragData.instanceId != mInstanceId)
      return [];
    const tabs     = dragData && dragData.tabs;
    return tabs && filterMap(tabs, tab => tab && Tab.get(tab.id) || tab || undefined) || [];
  });
  info.defineGetter('draggedTabIds', () => {
    return info.draggedTabs.map(tab => tab.id);
  });
  info.defineGetter('firstTargetTab', () => {
    return Tab.getFirstNormalTab(TabsStore.getWindow()) || Tab.getFirstTab(TabsStore.getWindow());
  });
  info.defineGetter('lastTargetTab', () => {
    return Tab.getLastTab(TabsStore.getWindow());
  });
  info.defineGetter('canDrop', () => {
    if (info.dropPosition == kDROP_IMPOSSIBLE)
      return false;

    const draggedTab = info.dragData && info.dragData.tab;
    const isPrivateBrowsingTabDragged = draggedTab && draggedTab.incognito;
    const isPrivateBrowsingDropTarget = (info.dragOverTab || Tab.getFirstTab(TabsStore.getWindow())).incognito;
    if (draggedTab &&
        isPrivateBrowsingTabDragged != isPrivateBrowsingDropTarget) {
      return false;
    }
    else if (info.draggedTab) {
      if (info.action & Constants.kACTION_ATTACH) {
        if (info.draggedTab.windowId != TabsStore.getWindow()) {
          return true;
        }
        if (info.parent &&
            info.parent.id == info.draggedTab.id) {
          return false;
        }
        if (info.dragOverTab) {
          if (info.draggedTabIds.includes(info.dragOverTab.id))
            return false;
          const ancestors = info.dragOverTab.$TST.ancestors;
          /* too many function call in this way, so I use alternative way for better performance.
          return !info.draggedTabIds.includes(info.dragOverTab.id) &&
                   Tab.collectRootTabs(info.draggedTabs).every(rootTab =>
                     !ancestors.includes(rootTab)
                   );
          */
          for (const tab of info.draggedTabs.slice(0).reverse()) {
            const parent = tab.$TST.parent;
            if (!parent && ancestors.includes(parent))
              return false;
          }
          return true;
        }
      }
    }

    if (info.dragOverTab &&
        (info.dragOverTab.hidden ||
         (info.dragOverTab.$TST.collapsed &&
          info.dropPosition != kDROP_AFTER)))
      return false;

    return true;
  });
  info.defineGetter('EventUtils.isCopyAction', () => EventUtils.isCopyAction(event));
  info.defineGetter('dropEffect', () => getDropEffectFromDropAction(info));

  if (!targetTab) {
    //log('dragging on non-tab element');
    const action = Constants.kACTION_MOVE | Constants.kACTION_DETACH;
    if (event.clientY < info.firstTargetTab.$TST.element.getBoundingClientRect().top) {
      //log('dragging above the first tab');
      info.targetTab    = info.insertBefore = info.firstTargetTab;
      info.dropPosition = kDROP_BEFORE;
      info.action       = action;
      if (info.draggedTab &&
          !info.draggedTab.pinned &&
          info.targetTab.pinned)
        info.dropPosition = kDROP_IMPOSSIBLE;
    }
    else if (event.clientY > info.lastTargetTab.$TST.element.getBoundingClientRect().bottom) {
      //log('dragging below the last tab');
      info.targetTab    = info.insertAfter = info.lastTargetTab;
      info.dropPosition = kDROP_AFTER;
      info.action       = action;
      if (info.draggedTab &&
          info.draggedTab.pinned &&
          !info.targetTab.pinned)
        info.dropPosition = kDROP_IMPOSSIBLE;
    }
    return info;
  }

  /**
   * Basically, tabs should have three areas for dropping of items:
   * [start][center][end], but, pinned tabs couldn't have its tree.
   * So, if a tab is dragged and the target tab is pinned, then, we
   * have to ignore the [center] area.
   */
  const onPinnedTab         = targetTab.pinned;
  const dropAreasCount      = (info.draggedTab && onPinnedTab) ? 2 : 3 ;
  const targetTabRect       = targetTab.$TST.element.getBoundingClientRect();
  const targetTabCoordinate = onPinnedTab ? targetTabRect.left : targetTabRect.top ;
  const targetTabSize       = onPinnedTab ? targetTabRect.width : targetTabRect.height ;
  let beforeOrAfterDropAreaSize;
  if (dropAreasCount == 2) {
    beforeOrAfterDropAreaSize = Math.round(targetTabSize / dropAreasCount);
  }
  else { // enlarge the area to dop something on the tab itself
    beforeOrAfterDropAreaSize = Math.round(targetTabSize / 4);
  }
  const eventCoordinate = onPinnedTab ? event.clientX : event.clientY;
  //log('coordinates: ', {
  //  event: eventCoordinate,
  //  targetTab: targetTabCoordinate,
  //  area: beforeOrAfterDropAreaSize
  //});
  if (eventCoordinate < targetTabCoordinate + beforeOrAfterDropAreaSize) {
    info.dropPosition = kDROP_BEFORE;
    info.insertBefore = info.firstTargetTab;
  }
  else if (dropAreasCount == 2 ||
           eventCoordinate > targetTabCoordinate + targetTabSize - beforeOrAfterDropAreaSize) {
    info.dropPosition = kDROP_AFTER;
    info.insertAfter  = info.lastTargetTab;
  }
  else {
    info.dropPosition = kDROP_ON_SELF;
  }

  switch (info.dropPosition) {
    case kDROP_ON_SELF: {
      log('drop position = on ', info.targetTab.id);
      info.action       = Constants.kACTION_ATTACH;
      info.parent       = targetTab;
      info.insertBefore = configs.insertNewChildAt == Constants.kINSERT_FIRST ?
        (targetTab && targetTab.$TST.firstChild || targetTab.$TST.unsafeNextTab /* instead of nearestVisibleFollowingTab, to avoid placing the tab after hidden tabs (too far from the target) */) :
        (targetTab.$TST.nextSiblingTab || targetTab.$TST.unsafeNearestFollowingForeignerTab /* instead of nearestFollowingForeignerTab, to avoid placing the tab after hidden tabs (too far from the target) */);
      info.insertAfter  = configs.insertNewChildAt == Constants.kINSERT_FIRST ?
        targetTab :
        (targetTab.$TST.lastDescendant || targetTab);
      if (info.draggedTab &&
          info.draggedTab.pinned != targetTab.pinned)
        info.dropPosition = kDROP_IMPOSSIBLE;
      if (configs.debug)
        log(' calculated info: ', info);
    }; break;

    case kDROP_BEFORE: {
      log('drop position = before ', info.targetTab.id);
      const referenceTabs = TreeBehavior.calculateReferenceTabsFromInsertionPosition(info.draggedTab, {
        insertBefore: targetTab
      });
      if (referenceTabs.parent)
        info.parent = referenceTabs.parent;
      if (referenceTabs.insertBefore)
        info.insertBefore = referenceTabs.insertBefore;
      if (referenceTabs.insertAfter)
        info.insertAfter = referenceTabs.insertAfter;
      info.action = Constants.kACTION_MOVE | (info.parent ? Constants.kACTION_ATTACH : Constants.kACTION_DETACH );
      //if (info.insertBefore)
      //  log('insertBefore = ', dumpTab(info.insertBefore));
      if (info.draggedTab &&
          info.draggedTab.pinned != targetTab.pinned)
        info.dropPosition = kDROP_IMPOSSIBLE;
      if (configs.debug)
        log(' calculated info: ', info);
    }; break;

    case kDROP_AFTER: {
      log('drop position = after ', info.targetTab.id);
      const referenceTabs = TreeBehavior.calculateReferenceTabsFromInsertionPosition(info.draggedTab, {
        insertAfter: targetTab
      });
      if (referenceTabs.parent)
        info.parent = referenceTabs.parent;
      if (referenceTabs.insertBefore)
        info.insertBefore = referenceTabs.insertBefore;
      if (referenceTabs.insertAfter)
        info.insertAfter = referenceTabs.insertAfter;
      info.action = Constants.kACTION_MOVE | (info.parent ? Constants.kACTION_ATTACH : Constants.kACTION_DETACH );
      if (info.insertBefore) {
        /* strategy
             +-----------------------------------------------------
             |[TARGET   ]
             |     <= attach dragged tab to the parent of the target as its next sibling
             |  [DRAGGED]
             +-----------------------------------------------------
        */
        if (info.draggedTab &&
            info.draggedTab.id == info.insertBefore.id) {
          info.action      = Constants.kACTION_MOVE | Constants.kACTION_ATTACH;
          info.parent      = targetTab.$TST.parent;
          let insertBefore = targetTab.$TST.nextSiblingTab;
          let ancestor     = info.parent;
          while (ancestor && !insertBefore) {
            insertBefore = ancestor.$TST.nextSiblingTab;
            ancestor     = ancestor.$TST.parent;
          }
          info.insertBefore = insertBefore;
          info.insertAfter  = targetTab.$TST.lastDescendant;
        }
      }
      if (info.draggedTab &&
          info.draggedTab.pinned != !!targetTab.$TST.precedesPinnedTab)
        info.dropPosition = kDROP_IMPOSSIBLE;
      if (configs.debug)
        log(' calculated info: ', info);
    }; break;
  }

  return info;
}
function getDropEffectFromDropAction(actionInfo) {
  if (!actionInfo.canDrop)
    return 'none';
  if (actionInfo.dragData &&
      actionInfo.dragData.instanceId != mInstanceId)
    return 'copy';
  if (!actionInfo.draggedTab)
    return 'link';
  if (actionInfo.isCopyAction)
    return 'copy';
  return 'move';
}

export function clearDropPosition() {
  for (const target of document.querySelectorAll(`[${kDROP_POSITION}]`)) {
    target.removeAttribute(kDROP_POSITION)
  }
}

export function clearDraggingTabsState() {
  for (const tab of Tab.getDraggingTabs(TabsStore.getWindow(), { iterator: true })) {
    tab.$TST.removeState(Constants.kTAB_STATE_DRAGGING);
    TabsStore.removeDraggingTab(tab);
  }
}

export function clearDraggingState() {
  const window = TabsStore.windows.get(TabsStore.getWindow());
  window.classList.remove(kTABBAR_STATE_TAB_DRAGGING);
  document.documentElement.classList.remove(kTABBAR_STATE_TAB_DRAGGING);
  document.documentElement.classList.remove(kTABBAR_STATE_LINK_DRAGGING);
}

function isDraggingAllActiveTabs(tab) {
  const draggingTabsCount = TabsStore.draggingTabsInWindow.get(tab.windowId).size;
  const allTabsCount      = TabsStore.windows.get(tab.windowId).tabs.size;
  return draggingTabsCount == allTabsCount;
}

function collapseAutoExpandedTabsWhileDragging() {
  if (mLongHoverExpandedTabs.length > 0 &&
      configs.autoExpandOnLongHoverRestoreIniitalState) {
    for (const tab of mLongHoverExpandedTabs) {
      BackgroundConnection.sendMessage({
        type:      Constants.kCOMMAND_SET_SUBTREE_COLLAPSED_STATE,
        tabId:     tab.id,
        collapsed: false,
        justNow:   true,
        stack:     configs.debug && new Error().stack
      });
    }
  }
  mLongHoverExpandedTabs = [];
}

async function handleDroppedNonTabItems(event, dropActionInfo) {
  event.stopPropagation();

  const uris = retrieveURIsFromDragEvent(event);
  // uris.forEach(uRI => {
  //   if (uRI.indexOf(Constants.kURI_BOOKMARK_FOLDER) != 0)
  //     securityCheck(uRI, event);
  // });
  log('handleDroppedNonTabItems: ', uris);

  const dragOverTab = dropActionInfo.dragOverTab;
  if (dragOverTab &&
      dropActionInfo.dropPosition == kDROP_ON_SELF &&
      !dragOverTab.pinned) {
    const behavior = await getDroppedLinksOnTabBehavior();
    if (behavior <= Constants.kDROPLINK_ASK)
      return;
    if (behavior & Constants.kDROPLINK_LOAD) {
      BackgroundConnection.sendMessage({
        type:  Constants.kCOMMAND_SELECT_TAB,
        tabId: dropActionInfo.dragOverTab.id
      });
      BackgroundConnection.sendMessage({
        type:  Constants.kCOMMAND_LOAD_URI,
        uri:   uris.shift(),
        tabId: dropActionInfo.dragOverTab.id
      });
    }
  }
  BackgroundConnection.sendMessage({
    type:           Constants.kCOMMAND_NEW_TABS,
    uris,
    windowId:       TabsStore.getWindow(),
    parentId:       dropActionInfo.parent && dropActionInfo.parent.id,
    insertBeforeId: dropActionInfo.insertBefore && dropActionInfo.insertBefore.id,
    insertAfterId:  dropActionInfo.insertAfter && dropActionInfo.insertAfter.id
  });
}

function retrieveURIsFromDragEvent(event) {
  log('retrieveURIsFromDragEvent');
  const dt    = event.dataTransfer;
  const types = [
    kTYPE_URI_LIST,
    kTYPE_X_MOZ_URL,
    'text/plain'
  ];
  let urls = [];
  for (const type of types) {
    const urlData  = dt.getData(type);
    if (urlData)
      urls = urls.concat(retrieveURIsFromData(urlData, type));
    if (urls.length)
      break;
  }
  log(' => retrieved: ', urls);
  urls = urls.filter(uRI =>
    uRI &&
      uRI.length &&
      uRI.indexOf(kBOOKMARK_FOLDER) == 0 ||
      !/^\s*(javascript|data):/.test(uRI)
  );
  log('  => filtered: ', urls);

  urls = urls.map(fixupURIFromText);
  log('  => fixed: ', urls);

  return urls;
}

function retrieveURIsFromData(data, type) {
  log('retrieveURIsFromData: ', type, data);
  switch (type) {
    case kTYPE_URI_LIST:
      return data
        .replace(/\r/g, '\n')
        .replace(/\n\n+/g, '\n')
        .split('\n')
        .filter(line => {
          return line.charAt(0) != '#';
        });

    case kTYPE_X_MOZ_URL:
      return data
        .trim()
        .replace(/\r/g, '\n')
        .replace(/\n\n+/g, '\n')
        .split('\n')
        .filter((_line, index) => {
          return index % 2 == 0;
        });

    case 'text/plain':
      return data
        .replace(/\r/g, '\n')
        .replace(/\n\n+/g, '\n')
        .trim()
        .split('\n')
        .map(line => {
          return /^\w+:\/\/.+/.test(line) ? line : `ext+treestyletab:search:${line}`;
        });
  }
  return [];
}

function fixupURIFromText(maybeURI) {
  if (/^\w+:/.test(maybeURI))
    return maybeURI;

  if (/^([^\.\s]+\.)+[^\.\s]{2}/.test(maybeURI))
    return `http://${maybeURI}`;

  return maybeURI;
}

async function getDroppedLinksOnTabBehavior() {
  let behavior = configs.dropLinksOnTabBehavior;
  if (behavior != Constants.kDROPLINK_ASK)
    return behavior;

  const confirm = new RichConfirm({
    message: browser.i18n.getMessage('dropLinksOnTabBehavior_message'),
    buttons: [
      browser.i18n.getMessage('dropLinksOnTabBehavior_load'),
      browser.i18n.getMessage('dropLinksOnTabBehavior_newtab')
    ],
    checkMessage: browser.i18n.getMessage('dropLinksOnTabBehavior_save')
  });
  const result = await confirm.show();
  switch (result.buttonIndex) {
    case 0:
      behavior = Constants.kDROPLINK_LOAD;
      break;
    case 1:
      behavior = Constants.kDROPLINK_NEWTAB;
      break;
    default:
      return result.buttonIndex;
  }
  if (result.checked)
    configs.dropLinksOnTabBehavior = behavior;
  return behavior;
}


/* DOM event listeners */

let mFinishCanceledDragOperation;
let mLastDragStartTime = 0;

export const onDragStart = EventUtils.wrapWithErrorHandler(function onDragStart(event, options = {}) {
  log('onDragStart: start ', event, options);
  clearDraggingTabsState(); // clear previous state anyway

  const behavior = 'behavior' in options ? options.behavior :
    event.shiftKey ? configs.tabDragBehaviorShift :
      configs.tabDragBehavior;
  const allowBookmark = !!(behavior & Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK);

  const dragData = getDragDataFromOneTab(options.tab || EventUtils.getTabFromEvent(event));
  dragData.individualOnOutside = !dragData.tab.$TST.multiselected && !(behavior & Constants.kDRAG_BEHAVIOR_WHOLE_TREE);
  dragData.behavior = behavior;
  if (!dragData.tab) {
    log('onDragStart: canceled / no dragged tab from drag data');
    return;
  }

  const tab       = dragData.tab;
  const mousedown = EventUtils.getLastMousedown(event.button);

  if (mousedown && mousedown.expired) {
    log('onDragStart: canceled / expired');
    event.stopPropagation();
    event.preventDefault();
    mLastDragEnteredTarget = tab.$TST.element;
    const startOnClosebox = mDragTargetIsClosebox = mousedown.detail.closebox;
    if (startOnClosebox)
      mLastDragEnteredTarget = SidebarTabs.getClosebox(tab);
    const windowId = TabsStore.getWindow();
    TSTAPI.sendMessage({
      type:   TSTAPI.kNOTIFY_TAB_DRAGSTART,
      tab:    new TSTAPI.TreeItem(tab),
      window: windowId,
      windowId,
      startOnClosebox
    }, { tabProperties: ['tab'] }).catch(_error => {});
    window.addEventListener('mouseover', onTSTAPIDragEnter, { capture: true });
    window.addEventListener('mouseout',  onTSTAPIDragExit, { capture: true });
    document.body.setCapture(false);
    mCapturingForDragging = true;
    return;
  }

  EventUtils.cancelHandleMousedown();

  // dragging on clickable element will be expected to cancel the operation
  if (EventUtils.isEventFiredOnClosebox(options.tab && options.tab.$TST.element || event) ||
      EventUtils.isEventFiredOnClickable(options.tab && options.tab.$TST.element || event)) {
    log('onDragStart: canceled / on undraggable element');
    event.stopPropagation();
    event.preventDefault();
    return;
  }

  mDraggingOnSelfWindow = true;
  mDraggingOnDraggedTabs = true;
  mLastDropPosition = null;

  const dt = event.dataTransfer;
  dt.effectAllowed = 'copyMove';

  const sanitizedDragData = sanitizeDragData(dragData);
  dt.setData(kTREE_DROP_TYPE, JSON.stringify(sanitizedDragData));

  // Because addon cannot read drag data across private browsing mode,
  // we need to share detailed information of dragged tabs in different way!
  mCurrentDragData = sanitizedDragData;
  browser.runtime.sendMessage({
    type:     Constants.kCOMMAND_BROADCAST_CURRENT_DRAG_DATA,
    windowId: TabsStore.getWindow(),
    dragData: sanitizedDragData
  }).catch(ApiTabs.createErrorSuppressor());

  const mozUrl  = [];
  const urlList = [];
  for (const draggedTab of dragData.tabs) {
    draggedTab.$TST.addState(Constants.kTAB_STATE_DRAGGING);
    TabsStore.addDraggingTab(draggedTab);
    if (!dragData.individualOnOutside ||
        mozUrl.length == 0) {
      mozUrl.push(`${draggedTab.url}\n${draggedTab.title}`);
      urlList.push(`#${draggedTab.title}\n${draggedTab.url}`);
    }
  }
  if (allowBookmark) {
    log('set kTYPE_X_MOZ_URL');
    dt.setData(kTYPE_X_MOZ_URL, mozUrl.join('\n'));
    log('set kTYPE_URI_LIST');
    dt.setData(kTYPE_URI_LIST, urlList.join('\n'));
  }

  if (options.tab) {
    const tabRect = options.tab.$TST.element.getBoundingClientRect();
    dt.setDragImage(options.tab.$TST.element, event.clientX - tabRect.left, event.clientY - tabRect.top);
  }

  TabsStore.windows.get(TabsStore.getWindow()).classList.add(kTABBAR_STATE_TAB_DRAGGING);
  document.documentElement.classList.add(kTABBAR_STATE_TAB_DRAGGING);

  // The drag operation can be canceled by something, then
  // "dragend" event is not dispatched and TST wrongly keeps
  // its "dragging" state. So we clear the dragging state with
  // a delay. (This timer will be cleared immediately by dragover
  // event, if the dragging operation is not canceled.)
  // See also: https://github.com/piroor/treestyletab/issues/1778#issuecomment-404569842
  mFinishCanceledDragOperation = setTimeout(finishDrag, 250);

  if (!('behavior' in options) &&
      configs.showTabDragBehaviorNotification) {
    const invertedBehavior = event.shiftKey ? configs.tabDragBehavior : configs.tabDragBehaviorShift;
    const count            = dragData.tabs.length;
    const currentResult    = getTabDragBehaviorNotificationMessageType(behavior, count);
    const invertedResult   = getTabDragBehaviorNotificationMessageType(invertedBehavior, count);
    if (currentResult || invertedResult) {
      const invertSuffix = event.shiftKey ? 'without_shift' : 'with_shift';
      mDragBehaviorNotification.firstChild.textContent = [
        currentResult && browser.i18n.getMessage(`tabDragBehaviorNotification_message_base`, [
          browser.i18n.getMessage(`tabDragBehaviorNotification_message_${currentResult}`)]),
        invertedResult && browser.i18n.getMessage(`tabDragBehaviorNotification_message_inverted_base_${invertSuffix}`, [
          browser.i18n.getMessage(`tabDragBehaviorNotification_message_${invertedResult}`)]),
      ].join('\n');
      mDragBehaviorNotification.firstChild.style.animationDuration = browser.i18n.getMessage(`tabDragBehaviorNotification_message_duration_${currentResult && invertedResult ? 'both' : 'single'}`);
      mDragBehaviorNotification.classList.remove('hiding');
      mDragBehaviorNotification.classList.add('shown');
    }
  }

  TSTAPI.sendMessage({
    type:     TSTAPI.kNOTIFY_NATIVE_TAB_DRAGSTART,
    tab:      new TSTAPI.TreeItem(tab),
    windowId: TabsStore.getWindow()
  }, { tabProperties: ['tab'] }).catch(_error => {});

  mLastDragStartTime = Date.now();

  log('onDragStart: started');
});

function getTabDragBehaviorNotificationMessageType(behavior, count) {
  if (behavior & Constants.kDRAG_BEHAVIOR_WHOLE_TREE && count > 1) {
    if (behavior & Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK)
      return 'tree_bookmark';
    else if (behavior & Constants.kDRAG_BEHAVIOR_TEAR_OFF)
      return 'tree_tearoff';
    else
      return '';
  }
  else {
    if (behavior & Constants.kDRAG_BEHAVIOR_ALLOW_BOOKMARK)
      return 'tab_bookmark';
    else if (behavior & Constants.kDRAG_BEHAVIOR_TEAR_OFF)
      return 'tab_tearoff';
    else
      return '';
  }
}

let mLastDragOverTimestamp = null;
let mDelayedClearDropPosition = null;

function onDragOver(event) {
  if (mFinishCanceledDragOperation) {
    clearTimeout(mFinishCanceledDragOperation);
    mFinishCanceledDragOperation = null;
  }

  if (mDelayedClearDropPosition)
    clearTimeout(mDelayedClearDropPosition);
  mDelayedClearDropPosition = setTimeout(() => {
    mDelayedClearDropPosition = null;
    clearDropPosition();
  }, 250);

  event.preventDefault(); // this is required to override default dragover actions!
  Scroll.autoScrollOnMouseEvent(event);

  // reduce too much handling of too frequent dragover events...
  const now = Date.now();
  if (now - (mLastDragOverTimestamp || 0) < configs.minimumIntervalToProcessDragoverEvent)
    return;
  mLastDragOverTimestamp = now;

  const info = getDropAction(event);
  const dt   = event.dataTransfer;

  if (isEventFiredOnTabDropBlocker(event) ||
      !info.canDrop) {
    log('onDragOver: not droppable');
    dt.dropEffect = 'none';
    if (mLastDropPosition)
      clearDropPosition();
    mLastDropPosition = null;
    return;
  }

  let dropPositionTargetTab = info.targetTab;
  if (dropPositionTargetTab && dropPositionTargetTab.$TST.collapsed)
    dropPositionTargetTab = info.targetTab.$TST.nearestVisiblePrecedingTab || info.targetTab;
  if (!dropPositionTargetTab) {
    log('onDragOver: no drop target tab');
    dt.dropEffect = 'none';
    mLastDropPosition = null;
    return;
  }

  if (!info.draggedTab ||
      dropPositionTargetTab.id != info.draggedTab.id) {
    const dropPosition = `${dropPositionTargetTab.id}:${info.dropPosition}`;
    if (dropPosition == mLastDropPosition) {
      log('onDragOver: no move');
      return;
    }
    clearDropPosition();
    dropPositionTargetTab.$TST.element.setAttribute(kDROP_POSITION, info.dropPosition);
    mLastDropPosition = dropPosition;
    log('onDragOver: set drop position to ', dropPosition);
  }
  else {
    mLastDropPosition = null;
  }
}
onDragOver = EventUtils.wrapWithErrorHandler(onDragOver);

function isEventFiredOnTabDropBlocker(event) {
  let node = event.target;
  if (node.nodeType != Node.ELEMENT_NODE)
    node = node.parentNode;
  return node && !!node.closest('.tab-drop-blocker');
}

function onDragEnter(event) {
  mDraggingOnSelfWindow = true;

  const info = getDropAction(event);
  try {
    const enteredTab = EventUtils.getTabFromEvent(event);
    const leftTab    = SidebarTabs.getTabFromDOMNode(event.relatedTarget);
    if (leftTab != enteredTab) {
      mDraggingOnDraggedTabs = (
        info.dragData &&
        info.dragData.tabs.some(tab => tab.id == enteredTab.id)
      );
    }
    TabsStore.windows.get(TabsStore.getWindow()).classList.add(kTABBAR_STATE_TAB_DRAGGING);
    document.documentElement.classList.add(kTABBAR_STATE_TAB_DRAGGING);
  }
  catch(_e) {
  }

  const dt   = event.dataTransfer;
  dt.dropEffect = info.dropEffect;
  if (info.dropEffect == 'link')
    document.documentElement.classList.add(kTABBAR_STATE_LINK_DRAGGING);

  if (!configs.autoExpandOnLongHover ||
      !info.canDrop ||
      !info.dragOverTab)
    return;

  reserveToProcessLongHover.cancel();

  if (info.draggedTab &&
      info.dragOverTab.id == info.draggedTab.id)
    return;

  reserveToProcessLongHover({
    dragOverTabId: info.targetTab && info.targetTab.id,
    draggedTabId:  info.draggedTab && info.draggedTab.id,
    dropEffect:    info.dropEffect
  });
}
onDragEnter = EventUtils.wrapWithErrorHandler(onDragEnter);

function reserveToProcessLongHover(params = {}) {
  mLongHoverTimerNext = setTimeout(() => {
    mLongHoverTimerNext = null;
    mLongHoverTimer = setTimeout(async () => {
      log('reservedProcessLongHover: ', params);

      const dragOverTab = Tab.get(params.dragOverTabId);
      if (!dragOverTab ||
          dragOverTab.$TST.element.getAttribute(kDROP_POSITION) != 'self')
        return;

      // auto-switch for staying on tabs
      if (!dragOverTab.active &&
          params.dropEffect == 'link') {
        BackgroundConnection.sendMessage({
          type:  Constants.kCOMMAND_SELECT_TAB,
          tabId: dragOverTab.id
        });
      }

      if (!dragOverTab ||
          !dragOverTab.$TST.isAutoExpandable)
        return;

      // auto-expand for staying on a parent
      if (configs.autoExpandIntelligently) {
        BackgroundConnection.sendMessage({
          type:  Constants.kCOMMAND_SET_SUBTREE_COLLAPSED_STATE_INTELLIGENTLY_FOR,
          tabId: dragOverTab.id
        });
      }
      else {
        if (!mLongHoverExpandedTabs.includes(params.dragOverTabId))
          mLongHoverExpandedTabs.push(params.dragOverTabId);
        BackgroundConnection.sendMessage({
          type:      Constants.kCOMMAND_SET_SUBTREE_COLLAPSED_STATE,
          tabId:     dragOverTab.id,
          collapsed: false,
          stack:     configs.debug && new Error().stack
        });
      }
    }, configs.autoExpandOnLongHoverDelay);
  }, 0);
}
reserveToProcessLongHover.cancel = function() {
  clearTimeout(mLongHoverTimer);
  clearTimeout(mLongHoverTimerNext);
};

function onDragLeave(event) {
  let leftFromTabBar = false;
  try {
    const info       = getDropAction(event);
    const leftTab    = EventUtils.getTabFromEvent(event);
    const enteredTab = SidebarTabs.getTabFromDOMNode(event.relatedTarget);
    if (leftTab != enteredTab) {
      if (info.dragData &&
          info.dragData.tabs.some(tab => tab.id == leftTab.id) &&
          (!enteredTab ||
           !info.dragData.tabs.every(tab => tab.id == enteredTab.id))) {
        onDragLeave.delayedLeftFromDraggedTabs = setTimeout(() => {
          delete onDragLeave.delayedLeftFromDraggedTabs;
          mDraggingOnDraggedTabs = false;
        }, 10);
      }
      else {
        leftFromTabBar = !enteredTab || enteredTab.windowId != TabsStore.getWindow();
        if (onDragLeave.delayedLeftFromDraggedTabs) {
          clearTimeout(onDragLeave.delayedLeftFromDraggedTabs);
          delete onDragLeave.delayedLeftFromDraggedTabs;
        }
      }
    }
  }
  catch(_e) {
    leftFromTabBar = true;
  }

  if (leftFromTabBar) {
    onDragLeave.delayedLeftFromTabBar = setTimeout(() => {
      delete onDragLeave.delayedLeftFromTabBar;
      mDraggingOnSelfWindow = false;
      mDraggingOnDraggedTabs = false;
      clearDropPosition();
      clearDraggingState();
      mLastDropPosition = null;
    }, 10);
  }
  else if (onDragLeave.delayedLeftFromTabBar) {
    clearTimeout(onDragLeave.delayedLeftFromTabBar);
    delete onDragLeave.delayedLeftFromTabBar;
  }

  clearTimeout(mLongHoverTimer);
  mLongHoverTimer = null;
}
onDragLeave = EventUtils.wrapWithErrorHandler(onDragLeave);

function onDrop(event) {
  setTimeout(() => collapseAutoExpandedTabsWhileDragging(), 0);
  if (mLastDropPosition) {
    clearDropPosition();
    mLastDropPosition = null;
  }

  const dropActionInfo = getDropAction(event);

  if (!dropActionInfo.canDrop) {
    log('undroppable');
    return;
  }

  const dt = event.dataTransfer;
  if (dt.dropEffect != 'link' &&
      dt.dropEffect != 'move' &&
      dropActionInfo.dragData &&
      !dropActionInfo.dragData.tab) {
    log('invalid drop');
    return;
  }

  if (dropActionInfo.dragData &&
      dropActionInfo.dragData.tab) {
    log('there are dragged tabs');
    const fromOtherProfile = dropActionInfo.dragData.instanceId != mInstanceId;
    BackgroundConnection.sendMessage({
      type:                Constants.kCOMMAND_PERFORM_TABS_DRAG_DROP,
      windowId:            dropActionInfo.dragData.windowId,
      tabs:                dropActionInfo.dragData.tabs,
      structure:           dropActionInfo.dragData.structure,
      action:              dropActionInfo.action,
      attachToId:          dropActionInfo.parent && dropActionInfo.parent.id,
      insertBeforeId:      dropActionInfo.insertBefore && dropActionInfo.insertBefore.id,
      insertAfterId:       dropActionInfo.insertAfter && dropActionInfo.insertAfter.id,
      destinationWindowId: TabsStore.getWindow(),
      duplicate:           !fromOtherProfile && dt.dropEffect == 'copy',
      import:              fromOtherProfile
    });
    return;
  }

  log('link or bookmark item is dropped');
  handleDroppedNonTabItems(event, dropActionInfo);
}
onDrop = EventUtils.wrapWithErrorHandler(onDrop);

async function onDragEnd(event) {
  log('onDragEnd, ', { mDraggingOnSelfWindow, mDraggingOnDraggedTabs });

  let dragData = event.dataTransfer.getData(kTREE_DROP_TYPE);
  dragData = (dragData && JSON.parse(dragData)) || mCurrentDragData;
  if (dragData) {
    dragData.tab  = dragData.tab && Tab.get(dragData.tab.id) || dragData.tab;
    dragData.tabs = dragData.tabs && dragData.tabs.map(tab => tab && Tab.get(tab.id) || tab);
  }

  // Don't clear flags immediately, because they are referred by following operations in this function.
  setTimeout(finishDrag, 0);

  if (!(dragData.behavior & Constants.kDRAG_BEHAVIOR_TEAR_OFF))
    return;

  if (event.dataTransfer.getData(kTYPE_URI_LIST)) {
    log('do nothing by TST for dropping just for bookmarking or linking');
    return;
  }

  if (event.dataTransfer.mozUserCancelled ||
      event.dataTransfer.dropEffect != 'none' ||
      //event.shiftKey || // don't ignore shift-drop, because it can be used to drag a parent tab as an individual tab.
      !configs.moveDroppedTabToNewWindowForUnhandledDragEvent) {
    log('dragged items are processed by someone: ', event.dataTransfer.dropEffect);
    return;
  }

  const windowX = window.mozInnerScreenX;
  const windowY = window.mozInnerScreenY;
  const windowW = window.innerWidth;
  const windowH = window.innerHeight;
  const offset  = dragData.tab.$TST.element.getBoundingClientRect().height / 2;
  // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1561522
  const fixedEventScreenX = event.screenX / window.devicePixelRatio;
  const fixedEventScreenY = event.screenY / window.devicePixelRatio;
  log('dragend at: ', {
    windowX,
    windowY,
    windowW,
    windowH,
    eventScreenX: event.screenX,
    eventScreenY: event.screenY,
    eventClientX: event.clientX,
    eventClientY: event.clientY,
    fixedEventScreenX,
    fixedEventScreenY,
    devicePixelRatio: window.devicePixelRatio,
    offset
  });
  if ((event.screenX >= windowX - offset &&
       event.screenY >= windowY - offset &&
       event.screenX <= windowX + windowW + offset &&
       event.screenY <= windowY + windowH + offset) ||
      // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1561522
      (fixedEventScreenX >= windowX - offset &&
       fixedEventScreenY >= windowY - offset &&
       fixedEventScreenX <= windowX + windowW + offset &&
       fixedEventScreenY <= windowY + windowH + offset) ||
      // On macOS sometimes drag gesture is canceled immediately with (0,0) coordinates.
      (Date.now() - mLastDragStartTime < 100 &&
       event.screenX == 0 &&
       event.screenY == 0)) {
    log('dropped near the tab bar (from coordinates): detaching is canceled');
    return;
  }

  log('trying to detach tab from window');
  event.stopPropagation();
  event.preventDefault();

  if (isDraggingAllActiveTabs(dragData.tab)) {
    log('all tabs are dragged, so it is nonsence to tear off them from the window');
    return;
  }

  const detachTabs = dragData.individualOnOutside ? [dragData.tab] : dragData.tabs;
  BackgroundConnection.sendMessage({
    type:      Constants.kCOMMAND_NEW_WINDOW_FROM_TABS,
    tabIds:    detachTabs.map(tab => tab.id),
    duplicate: EventUtils.isAccelKeyPressed(event),
    left:      event.screenX,
    top:       event.screenY
  });
}
onDragEnd = EventUtils.wrapWithErrorHandler(onDragEnd);

function finishDrag() {
  log('finishDrag');

  mDragBehaviorNotification.classList.add('hiding');
  mDragBehaviorNotification.classList.remove('shown');
  setTimeout(() => {
    mDragBehaviorNotification.classList.remove('hiding');
  }, configs.collapseDuration);

  mDraggingOnSelfWindow = false;

  wait(100).then(() => {
    mCurrentDragData = null;
    browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_BROADCAST_CURRENT_DRAG_DATA,
      windowId: TabsStore.getWindow(),
      dragData: null
    }).catch(ApiTabs.createErrorSuppressor());
  });

  onFinishDrag();
}

function onFinishDrag() {
  clearDraggingTabsState();
  clearDropPosition();
  mLastDropPosition = null;
  mLastDragOverTimestamp = null;
  clearDraggingState();
  collapseAutoExpandedTabsWhileDragging();
  mDraggingOnSelfWindow = false;
  mDraggingOnDraggedTabs = false;
}


/* drag on tabs API */

function onTSTAPIDragEnter(event) {
  Scroll.autoScrollOnMouseEvent(event);
  const tab = EventUtils.getTabFromEvent(event);
  if (!tab)
    return;
  let target = tab.$TST.element;
  if (mDragTargetIsClosebox && EventUtils.isEventFiredOnClosebox(event))
    target = SidebarTabs.getClosebox(tab);
  cancelDelayedTSTAPIDragExitOn(target);
  if (tab &&
      (!mDragTargetIsClosebox ||
       EventUtils.isEventFiredOnClosebox(event))) {
    if (target != mLastDragEnteredTarget) {
      TSTAPI.sendMessage({
        type:     TSTAPI.kNOTIFY_TAB_DRAGENTER,
        tab:      new TSTAPI.TreeItem(tab),
        window:   tab.windowId,
        windowId: tab.windowId
      }, { tabProperties: ['tab'] }).catch(_error => {});
    }
  }
  mLastDragEnteredTarget = target;
}

function onTSTAPIDragExit(event) {
  if (mDragTargetIsClosebox &&
      !EventUtils.isEventFiredOnClosebox(event))
    return;
  const tab = EventUtils.getTabFromEvent(event);
  if (!tab)
    return;
  let target = tab.$TST.element;
  if (mDragTargetIsClosebox && EventUtils.isEventFiredOnClosebox(event))
    target = SidebarTabs.getClosebox(tab);
  cancelDelayedTSTAPIDragExitOn(target);
  target.onTSTAPIDragExitTimeout = setTimeout(() => {
    delete target.onTSTAPIDragExitTimeout;
    TSTAPI.sendMessage({
      type:     TSTAPI.kNOTIFY_TAB_DRAGEXIT,
      tab:      new TSTAPI.TreeItem(tab),
      window:   tab.windowId,
      windowId: tab.windowId
    }, { tabProperties: ['tab'] }).catch(_error => {});
  }, 10);
}

function cancelDelayedTSTAPIDragExitOn(target) {
  if (target && target.onTSTAPIDragExitTimeout) {
    clearTimeout(target.onTSTAPIDragExitTimeout);
    delete target.onTSTAPIDragExitTimeout;
  }
}


function onMessage(message, _sender, _respond) {
  if (!message ||
      typeof message.type != 'string')
    return;

  switch (message.type) {
    case Constants.kCOMMAND_BROADCAST_CURRENT_DRAG_DATA:
      setDragData(message.dragData || null);
      if (!message.dragData)
        onFinishDrag();
      break;
  }
}

