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
 * Portions created by the Initial Developer are Copyright (C) 2010-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 Infocatcher <https://github.com/Infocatcher>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
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


import RichConfirm from '/extlib/RichConfirm.js';

import {
  log as internalLogger,
  wait,
  configs
} from '/common/common.js';
import * as Constants from '/common/constants.js';
import * as Tabs from '/common/tabs.js';
import * as TabsOpen from '/common/tabs-open.js';
import * as Tree from '/common/tree.js';
import * as TSTAPI from '/common/tst-api.js';
import * as Size from './size.js';
import * as Scroll from './scroll.js';
import * as EventUtils from './event-utils.js';
import * as SidebarTabs from './sidebar-tabs.js';

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

const kDROP_POSITION = 'data-drop-position';

const kTABBAR_STATE_TAB_DRAGGING  = 'tab-dragging';
const kTABBAR_STATE_LINK_DRAGGING = 'link-dragging';

let mLongHoverExpandedTabs = [];
let mLongHoverTimer;
let mLongHoverTimerNext;

let mDelayedDragEnter;
let mDelayedDragLeave;

let mDraggingOnSelfWindow = false;

let mCapturingForDragging = false;
let mReadyToCaptureMouseEvents = false;
let mLastDragEnteredTarget = null;
let mLastDropPosition      = null;
let mDragTargetIsClosebox  = false;
let mCurrentDragData       = null;

const mTabDragHandle = document.querySelector('#tab-drag-handle');

export function init() {
  document.addEventListener('dragstart', onDragStart);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('dragend', onDragEnd);
  document.addEventListener('drop', onDrop);

  document.addEventListener('mousemove', onMouseMove, { capture: true, passive: true });
  document.addEventListener('scroll', () => hideTabDragHandle(), true);
  mTabDragHandle.addEventListener('click', () => hideTabDragHandle());
  mTabDragHandle.addEventListener('dragstart', onTabDragHandleDragStart);

  browser.runtime.onMessage.addListener(onMessage);
}


export function isCapturingForDragging() {
  return mCapturingForDragging;
}

export function startMultiDrag(tab, aIsClosebox) {
  TSTAPI.sendMessage({
    type:   TSTAPI.kNOTIFY_TAB_DRAGREADY,
    tab:    TSTAPI.serializeTab(tab),
    window: Tabs.getWindow(),
    startOnClosebox: aIsClosebox
  });
  mReadyToCaptureMouseEvents = true;
}

export function endMultiDrag(tab, aCoordinates) {
  const serializedTab = tab && TSTAPI.serializeTab(tab);
  if (mCapturingForDragging) {
    window.removeEventListener('mouseover', onTSTAPIDragEnter, { capture: true });
    window.removeEventListener('mouseout',  onTSTAPIDragExit, { capture: true });
    document.releaseCapture();

    TSTAPI.sendMessage({
      type:    TSTAPI.kNOTIFY_TAB_DRAGEND,
      tab:     serializedTab,
      window:  tab && tab.apiTab.windowId,
      clientX: aCoordinates.clientX,
      clientY: aCoordinates.clientY
    });

    mLastDragEnteredTarget = null;
  }
  else if (mReadyToCaptureMouseEvents) {
    TSTAPI.sendMessage({
      type:    TSTAPI.kNOTIFY_TAB_DRAGCANCEL,
      tab:     serializedTab,
      window:  tab && tab.apiTab.windowId,
      clientX: aCoordinates.clientX,
      clientY: aCoordinates.clientY
    });
  }
  mCapturingForDragging = false;
  mReadyToCaptureMouseEvents = false;
}

function setDragData(aDragData) {
  return mCurrentDragData = aDragData;
}


/* helpers */

function getDragDataFromOneTab(hint, options = {}) {
  const tab = Tabs.getTabFromChild(hint);
  if (!tab)
    return {
      tabNode:  null,
      tabNodes: [],
      apiTab:   null,
      apiTabs:  [],
      windowId: null
    };

  const draggedTabs = options.shouldIgnoreDescendants ? [tab] : getDraggedTabsFromOneTab(tab);
  return {
    tabNode:  tab,
    tabNodes: draggedTabs,
    apiTab:   tab.apiTab,
    apiTabs:  draggedTabs.map(aDraggedTab => aDraggedTab.apiTab),
    windowId: tab.apiTab.windowId
  };
}

function getDraggedTabsFromOneTab(tab) {
  if (Tabs.isSelected(tab))
    return Tabs.getSelectedTabs(tab);
  return [tab].concat(Tabs.getDescendantTabs(tab));
}

function sanitizeDragData(aDragData) {
  return {
    tabNode:  null,
    tabNodes: [],
    apiTab:   aDragData.apiTab,
    apiTabs:  aDragData.apiTabs,
    windowId: aDragData.windowId
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
    defineGetter(name, aGetter) {
      delete this[name];
      Object.defineProperty(this, name, {
        get() {
          delete this[name];
          return this[name] = aGetter.call(this);
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
    // don't touch this if not needed, to reduce needless function call.
    return Tabs.getTabById(info.draggedAPITab);
  });
  info.defineGetter('draggedAPITab', () => {
    const dragData = info.dragData;
    return dragData && dragData.apiTab;
  });
  info.defineGetter('draggedTabs', () => {
    // don't touch this if not needed, to reduce needless function call.
    return info.draggedAPITabs.map(Tabs.getTabById).filter(tab => !!tab);
  });
  info.defineGetter('draggedAPITabs', () => {
    const dragData = info.dragData;
    return (dragData && dragData.apiTabs).filter(aPITab => !!aPITab) || [];
  });
  info.defineGetter('draggedAPITabIDs', () => {
    return info.draggedAPITabs.map(apiTab => apiTab.id);
  });
  info.defineGetter('targetTabs', () => {
    return Tabs.getAllTabs(targetTab);
  });
  info.defineGetter('firstTargetTab', () => {
    return Tabs.getFirstNormalTab(targetTab) || info.targetTabs[0];
  });
  info.defineGetter('lastTargetTab', () => {
    return info.targetTabs[info.targetTabs.length - 1];
  });
  info.defineGetter('canDrop', () => {
    const draggedApiTab               = info.dragData && info.dragData.apiTab;
    const isPrivateBrowsingTabDragged = draggedApiTab && draggedApiTab.incognito;
    if (draggedApiTab &&
        isPrivateBrowsingTabDragged != Tabs.isPrivateBrowsing(info.dragOverTab || Tabs.getFirstTab())) {
      return false;
    }
    else if (info.draggedAPITab) {
      if (info.action & Constants.kACTION_ATTACH) {
        if (info.parent &&
            info.parent.apiTab.id == info.draggedAPITab.id) {
          return false;
        }
        else if (info.dragOverTab) {
          if (info.draggedAPITabIDs.includes(info.dragOverTab.apiTab.id))
            return false;
          const ancestors = Tabs.getAncestorTabs(info.dragOverTab);
          /* too many function call in this way, so I use alternative way for better performance.
          return !info.draggedAPITabIDs.includes(info.dragOverTab.apiTab.id) &&
                   Tabs.collectRootTabs(info.draggedTabs).every(rootTab =>
                     !ancestors.includes(rootTab)
                   );
          */
          for (const apiTab of info.draggedAPITabs.slice().reverse()) {
            const tab    = Tabs.getTabById(apiTab);
            const parent = Tabs.getParentTab(tab);
            if (!parent && ancestors.includes(parent))
              return false;
          }
          return true;
        }
      }
    }

    if (info.dragOverTab &&
        (Tabs.isHidden(info.dragOverTab) ||
         (Tabs.isCollapsed(info.dragOverTab) &&
          info.dropPosition != kDROP_AFTER)))
      return false;

    return true;
  });
  info.defineGetter('EventUtils.isCopyAction', () => EventUtils.isCopyAction(event));
  info.defineGetter('dropEffect', () => getDropEffectFromDropAction(info));

  if (!targetTab) {
    //log('dragging on non-tab element');
    const action = Constants.kACTION_MOVE | Constants.kACTION_DETACH;
    if (event.clientY < info.firstTargetTab.getBoundingClientRect().top) {
      //log('dragging above the first tab');
      info.targetTab    = info.insertBefore = info.firstTargetTab;
      info.dropPosition = kDROP_BEFORE;
      info.action       = action;
    }
    else if (event.clientY > info.lastTargetTab.getBoundingClientRect().bottom) {
      //log('dragging below the last tab');
      info.targetTab    = info.insertAfter = info.lastTargetTab;
      info.dropPosition = kDROP_AFTER;
      info.action       = action;
    }
    return info;
  }

  /**
   * Basically, tabs should have three areas for dropping of items:
   * [start][center][end], but, pinned tabs couldn't have its tree.
   * So, if a tab is dragged and the target tab is pinned, then, we
   * have to ignore the [center] area.
   */
  const onPinnedTab         = Tabs.isPinned(targetTab);
  const dropAreasCount      = (info.draggedAPITab && onPinnedTab) ? 2 : 3 ;
  const targetTabRect       = targetTab.getBoundingClientRect();
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
      //log('drop position = on the tab');
      info.action       = Constants.kACTION_ATTACH;
      info.parent       = targetTab;
      info.defineGetter('insertBefore', () => {
        return configs.insertNewChildAt == Constants.kINSERT_FIRST ?
          (Tabs.getFirstChildTab(targetTab) || Tabs.getNextVisibleTab(targetTab)) :
          (Tabs.getNextSiblingTab(targetTab) || Tabs.getNextTab(Tabs.getLastDescendantTab(targetTab) || targetTab));
        // if (info.insertBefore)
        //  log('insertBefore = ', dumpTab(info.insertBefore));
      });
    }; break;

    case kDROP_BEFORE: {
      //log('drop position = before the tab');
      /* strategy
           +-----------------------------------------------------
           |     <= detach from parent, and move
           |[TARGET  ]
           +-----------------------------------------------------
           |  [      ]
           |     <= attach to the parent of the target, and move
           |[TARGET  ]
           +-----------------------------------------------------
           |[        ]
           |     <= attach to the parent of the target, and move
           |[TARGET  ]
           +-----------------------------------------------------
           |[        ]
           |     <= attach to the parent of the target (previous tab), and move
           |  [TARGET]
           +-----------------------------------------------------
      */
      const prevTab = Tabs.getPreviousVisibleTab(targetTab);
      if (!prevTab) {
        // allow to drop pinned tab to beside of another pinned tab
        if (info.draggedAPITab && info.draggedAPITab.pinned) {
          info.action       = Constants.kACTION_MOVE;
          info.insertBefore = targetTab;
        }
        else {
          info.action       = Constants.kACTION_MOVE | Constants.kACTION_DETACH;
          info.insertBefore = info.firstTargetTab;
        }
      }
      else {
        const prevLevel   = Number(prevTab.getAttribute(Constants.kLEVEL) || 0);
        const targetLevel = Number(targetTab.getAttribute(Constants.kLEVEL) || 0);
        info.parent       = (prevLevel < targetLevel) ? prevTab : Tabs.getParentTab(targetTab) ;
        info.action       = Constants.kACTION_MOVE | (info.parent ? Constants.kACTION_ATTACH : Constants.kACTION_DETACH );
        info.insertBefore = targetTab;
      }
      //if (info.insertBefore)
      //  log('insertBefore = ', dumpTab(info.insertBefore));
    }; break;

    case kDROP_AFTER: {
      //log('drop position = after the tab');
      /* strategy
           +-----------------------------------------------------
           |[TARGET  ]
           |     <= if the target has a parent, attach to it and and move
           +-----------------------------------------------------
           |  [TARGET]
           |     <= attach to the parent of the target, and move
           |[        ]
           +-----------------------------------------------------
           |[TARGET  ]
           |     <= attach to the parent of the target, and move
           |[        ]
           +-----------------------------------------------------
           |[TARGET  ]
           |     <= attach to the target, and move
           |  [      ]
           +-----------------------------------------------------
      */
      const nextTab = Tabs.getNextVisibleTab(targetTab);
      if (!nextTab) {
        info.action = Constants.kACTION_MOVE | Constants.kACTION_ATTACH;
        info.parent = Tabs.getParentTab(targetTab);
      }
      else {
        const targetLevel = Number(targetTab.getAttribute(Constants.kLEVEL) || 0);
        const nextLevel   = Number(nextTab.getAttribute(Constants.kLEVEL) || 0);
        info.parent       = (targetLevel < nextLevel) ? targetTab : Tabs.getParentTab(targetTab) ;
        info.action       = Constants.kACTION_MOVE | (info.parent ? Constants.kACTION_ATTACH : Constants.kACTION_DETACH );
        info.insertBefore = nextTab;
        info.insertAfter  = targetTab;
        /* strategy
             +-----------------------------------------------------
             |[TARGET   ]
             |     <= attach dragged tab to the parent of the target as its next sibling
             |  [DRAGGED]
             +-----------------------------------------------------
        */
        if (info.draggedAPITab &&
            info.draggedAPITab.id == nextTab.apiTab.id) {
          info.action       = Constants.kACTION_MOVE | Constants.kACTION_ATTACH;
          info.parent       = Tabs.getParentTab(targetTab);
          info.defineGetter('insertBefore', () => {
            let insertBefore = Tabs.getNextSiblingTab(targetTab);
            let ancestor     = info.parent;
            while (ancestor && !insertBefore) {
              insertBefore = Tabs.getNextSiblingTab(ancestor);
              ancestor     = Tabs.getParentTab(ancestor);
            }
            //if (insertBefore)
            //  log('insertBefore = ', dumpTab(insertBefore));
            return insertBefore;
          });
          info.defineGetter('insertAfter', () => {
            return Tabs.getLastDescendantTab(targetTab);
          });
        }
      }
    }; break;
  }

  return info;
}
function getDropEffectFromDropAction(aActionInfo) {
  if (!aActionInfo.canDrop)
    return 'none';
  if (!aActionInfo.draggedAPITab)
    return 'link';
  if (aActionInfo.isCopyAction)
    return 'copy';
  return 'move';
}

export function clearDropPosition() {
  for (const tab of document.querySelectorAll(`[${kDROP_POSITION}]`)) {
    tab.removeAttribute(kDROP_POSITION)
  }
}

export function clearDraggingTabsState() {
  for (const tab of Tabs.getDraggingTabs(Tabs.getWindow())) {
    tab.classList.remove(Constants.kTAB_STATE_DRAGGING);
  }
}

export function clearDraggingState() {
  Tabs.getTabsContainer().classList.remove(kTABBAR_STATE_TAB_DRAGGING);
  document.documentElement.classList.remove(kTABBAR_STATE_TAB_DRAGGING);
  document.documentElement.classList.remove(kTABBAR_STATE_LINK_DRAGGING);
}

function isDraggingAllTabs(tab, tabs) {
  const draggingTabs = Tabs.getDraggingTabs(tab);
  return draggingTabs.length == (tabs || Tabs.getAllTabs(tab)).length;
}
 
function isDraggingAllCurrentTabs(tab) {
  return isDraggingAllTabs(tab, Tabs.getAllTabs(tab));
}

function collapseAutoExpandedTabsWhileDragging() {
  if (mLongHoverExpandedTabs.length > 0 &&
      configs.autoExpandOnLongHoverRestoreIniitalState) {
    for (const tab of mLongHoverExpandedTabs) {
      Tree.collapseExpandSubtree(tab, {
        collapsed: false,
        justNow:   true,
        inRemote:  true
      });
    }
  }
  mLongHoverExpandedTabs = [];
}

async function handleDroppedNonTabItems(event, aDropActionInfo) {
  event.stopPropagation();

  const uris = retrieveURIsFromDragEvent(event);
  // uris.forEach(uRI => {
  //   if (uRI.indexOf(Constants.kURI_BOOKMARK_FOLDER) != 0)
  //     securityCheck(uRI, event);
  // });
  log('handleDroppedNonTabItems: ', uris);

  const dragOverTab = aDropActionInfo.dragOverTab;
  if (dragOverTab &&
      aDropActionInfo.dropPosition == kDROP_ON_SELF &&
      !Tabs.isLocked(dragOverTab) &&
      !Tabs.isPinned(dragOverTab)) {
    const behavior = await getDroppedLinksOnTabBehavior();
    if (behavior <= Constants.kDROPLINK_ASK)
      return;
    if (behavior & Constants.kDROPLINK_LOAD) {
      browser.runtime.sendMessage({
        type:     Constants.kCOMMAND_SELECT_TAB,
        windowId: Tabs.getWindow(),
        tab:      dragOverTab.id
      });
      await TabsOpen.loadURI(uris.shift(), {
        tab:      dragOverTab,
        inRemote: true
      });
    }
  }
  await TabsOpen.openURIsInTabs(uris, {
    windowId:     Tabs.getWindow(),
    parent:       aDropActionInfo.parent,
    insertBefore: aDropActionInfo.insertBefore,
    insertAfter:  aDropActionInfo.insertAfter,
    inRemote:     true
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

function retrieveURIsFromData(aData, type) {
  log('retrieveURIsFromData: ', type, aData);
  switch (type) {
    case kTYPE_URI_LIST:
      return aData
        .replace(/\r/g, '\n')
        .replace(/\n\n+/g, '\n')
        .split('\n')
        .filter(line => {
          return line.charAt(0) != '#';
        });

    case kTYPE_X_MOZ_URL:
      return aData
        .trim()
        .replace(/\r/g, '\n')
        .replace(/\n\n+/g, '\n')
        .split('\n')
        .filter((_line, index) => {
          return index % 2 == 0;
        });

    case 'text/plain':
      return aData
        .replace(/\r/g, '\n')
        .replace(/\n\n+/g, '\n')
        .trim()
        .split('\n')
        .filter(line => {
          return /^\w+:\/\/.+/.test(line);
        });
  }
  return [];
}

function fixupURIFromText(aMaybeURI) {
  if (/^\w+:/.test(aMaybeURI))
    return aMaybeURI;

  if (/^([^\.\s]+\.)+[^\.\s]{2}/.test(aMaybeURI))
    return `http://${aMaybeURI}`;

  return aMaybeURI;
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

function onDragStart(event, options = {}) {
  log('onDragStart: start ', event, options);
  console.log('onDragStart: start ', event, options);
  clearDraggingTabsState(); // clear previous state anyway

  const shouldIgnoreDescendants = 'shouldIgnoreDescendants' in options ? options.shouldIgnoreDescendants : event.shiftKey;
  const allowBookmark = 'allowBookmark' in options ? options.allowBookmark : configs.allowBookmarkCreationFromDraggedTree;

  const dragData = getDragDataFromOneTab(options.target || event.target, {
    shouldIgnoreDescendants
  });
  if (!dragData.tabNode) {
    log('onDragStart: canceled / no dragged tab from drag data');
    return;
  }

  const tab       = dragData.tabNode
  const mousedown = EventUtils.getLastMousedown(event.button);

  if (mousedown && mousedown.expired) {
    log('onDragStart: canceled / expired');
    event.stopPropagation();
    event.preventDefault();
    mLastDragEnteredTarget = tab;
    const startOnClosebox = mDragTargetIsClosebox = mousedown.detail.closebox;
    if (startOnClosebox)
      mLastDragEnteredTarget = SidebarTabs.getClosebox(tab);
    TSTAPI.sendMessage({
      type:   TSTAPI.kNOTIFY_TAB_DRAGSTART,
      tab:    TSTAPI.serializeTab(tab),
      window: Tabs.getWindow(),
      startOnClosebox
    });
    window.addEventListener('mouseover', onTSTAPIDragEnter, { capture: true });
    window.addEventListener('mouseout',  onTSTAPIDragExit, { capture: true });
    document.body.setCapture(false);
    mCapturingForDragging = true;
    return;
  }

  EventUtils.cancelHandleMousedown();

  // dragging on clickable element will be expected to cancel the operation
  if (EventUtils.isEventFiredOnClosebox(options.target || event) ||
      EventUtils.isEventFiredOnClickable(options.target || event)) {
    log('onDragStart: canceled / on undraggable element');
    event.stopPropagation();
    event.preventDefault();
    return;
  }

  mDraggingOnSelfWindow = true;
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
    windowId: Tabs.getWindow(),
    dragData: sanitizedDragData
  });

  const mozUrl  = [];
  const urlList = [];
  for (const draggedTab of dragData.tabNodes) {
    draggedTab.classList.add(Constants.kTAB_STATE_DRAGGING);
    mozUrl.push(`${draggedTab.apiTab.url}\n${draggedTab.apiTab.title}`);
    urlList.push(`#${draggedTab.apiTab.title}\n${draggedTab.apiTab.url}`);
  }
  if (allowBookmark) {
    log('set kTYPE_X_MOZ_URL');
    dt.setData(kTYPE_X_MOZ_URL, mozUrl.join('\n'));
    log('set kTYPE_URI_LIST');
    dt.setData(kTYPE_URI_LIST, urlList.join('\n'));
  }

  if (options.target) {
    const tabRect = options.target.getBoundingClientRect();
    dt.setDragImage(options.target, event.clientX - tabRect.left, event.clientY - tabRect.top);
  }

  Tabs.getTabsContainer(tab).classList.add(kTABBAR_STATE_TAB_DRAGGING);
  document.documentElement.classList.add(kTABBAR_STATE_TAB_DRAGGING);

  // The drag operation can be canceled by something, then
  // "dragend" event is not dispatched and TST wrongly keeps
  // its "dragging" state. So we clear the dragging state with
  // a delay. (This timer will be cleared immediately by dragover
  // event, if the dragging operation is not canceled.)
  // See also: https://github.com/piroor/treestyletab/issues/1778#issuecomment-404569842
  mFinishCanceledDragOperation = setTimeout(finishDrag, 250);

  log('onDragStart: started');
}
onDragStart = EventUtils.wrapWithErrorHandler(onDragStart);

let mLastDragOverTimestamp = null;

function onDragOver(event) {
  if (mFinishCanceledDragOperation) {
    clearTimeout(mFinishCanceledDragOperation);
    mFinishCanceledDragOperation = null;
  }

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
  while (Tabs.isCollapsed(dropPositionTargetTab)) {
    dropPositionTargetTab = Tabs.getPreviousTab(dropPositionTargetTab);
  }
  if (!dropPositionTargetTab)
    dropPositionTargetTab = info.targetTab;

  if (!dropPositionTargetTab) {
    log('onDragOver: no drop target tab');
    dt.dropEffect = 'none';
    mLastDropPosition = null;
    return;
  }

  if (!info.draggedAPITab ||
      dropPositionTargetTab.apiTab.id != info.draggedAPITab.id) {
    const dropPosition = `${dropPositionTargetTab.id}:${info.dropPosition}`;
    if (dropPosition == mLastDropPosition) {
      log('onDragOver: no move');
      return;
    }
    clearDropPosition();
    dropPositionTargetTab.setAttribute(kDROP_POSITION, info.dropPosition);
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
  if (mDelayedDragEnter) {
    clearTimeout(mDelayedDragEnter);
    mDelayedDragEnter = null;
  }
  mDelayedDragEnter = setTimeout(() => {
    mDelayedDragEnter = null;
    mDraggingOnSelfWindow = true;
    if (mDelayedDragLeave) {
      clearTimeout(mDelayedDragLeave);
      mDelayedDragLeave = null;
    }
  }, 10);

  const info = getDropAction(event);
  const dt   = event.dataTransfer;
  dt.dropEffect = info.dropEffect;
  if (info.dropEffect == 'link')
    document.documentElement.classList.add(kTABBAR_STATE_LINK_DRAGGING);

  if (!configs.autoExpandOnLongHover ||
      !info.canDrop ||
      !info.dragOverTab)
    return;

  reserveToProcessLongHover.cancel();

  if (info.draggedAPITab &&
      info.dragOverTab.apiTab.id == info.draggedAPITab.id)
    return;

  reserveToProcessLongHover({
    dragOverTabId: info.targetTab.id,
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

      const dragOverTab = Tabs.getTabById(params.dragOverTabId);
      if (!dragOverTab ||
          dragOverTab.getAttribute(kDROP_POSITION) != 'self')
        return;

      // auto-switch for staying on tabs
      if (!Tabs.isActive(dragOverTab) &&
          params.dropEffect == 'link') {
        browser.runtime.sendMessage({
          type:     Constants.kCOMMAND_SELECT_TAB,
          windowId: Tabs.getWindow(),
          tab:      dragOverTab.id
        });
      }

      if (!Tree.shouldTabAutoExpanded(dragOverTab))
        return;

      // auto-expand for staying on a parent
      if (configs.autoExpandIntelligently) {
        Tree.collapseExpandTreesIntelligentlyFor(dragOverTab, { inRemote: true });
      }
      else {
        if (!mLongHoverExpandedTabs.includes(params.dragOverTabId))
          mLongHoverExpandedTabs.push(params.dragOverTabId);
        Tree.collapseExpandSubtree(dragOverTab, {
          collapsed: false,
          inRemote:  true
        });
      }
    }, configs.autoExpandOnLongHoverDelay);
  }, 0);
}
reserveToProcessLongHover.cancel = function() {
  clearTimeout(mLongHoverTimer);
  clearTimeout(mLongHoverTimerNext);
};

function onDragLeave(_event) {
  if (mDelayedDragLeave) {
    clearTimeout(mDelayedDragLeave);
    mDelayedDragLeave = null;
  }
  setTimeout(() => {
    mDelayedDragLeave = setTimeout(() => {
      mDelayedDragLeave = null;
      mDraggingOnSelfWindow = false;
      clearDropPosition();
      clearDraggingState();
      mLastDropPosition = null;
    }, configs.preventTearOffTabsTimeout);
  }, 10);

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
  const dt = event.dataTransfer;
  if (dt.dropEffect != 'link' &&
      dt.dropEffect != 'move' &&
      dropActionInfo.dragData &&
      !dropActionInfo.dragData.apiTab) {
    log('invalid drop');
    return;
  }

  if (dropActionInfo.dragData &&
      dropActionInfo.dragData.apiTab) {
    log('there are dragged tabs');
    Tree.performTabsDragDrop({
      windowId:            dropActionInfo.dragData.windowId,
      tabs:                dropActionInfo.dragData.apiTabs,
      action:              dropActionInfo.action,
      attachTo:            dropActionInfo.parent,
      insertBefore:        dropActionInfo.insertBefore,
      insertAfter:         dropActionInfo.insertAfter,
      destinationWindowId: Tabs.getWindow(),
      duplicate:           dt.dropEffect == 'copy',
      inRemote:            true
    });
    return;
  }

  log('link or bookmark item is dropped');
  handleDroppedNonTabItems(event, dropActionInfo);
}
onDrop = EventUtils.wrapWithErrorHandler(onDrop);

function onDragEnd(event) {
  log('onDragEnd, mDraggingOnSelfWindow = ', mDraggingOnSelfWindow);

  let dragData = event.dataTransfer.getData(kTREE_DROP_TYPE);
  dragData = (dragData && JSON.parse(dragData)) || mCurrentDragData;
  if (Array.isArray(dragData.apiTabs))
    dragData.tabNodes = dragData.apiTabs.map(Tabs.getTabById);

  finishDrag();

  if (event.dataTransfer.dropEffect != 'none' ||
      //event.shiftKey || // don't ignore shift-drop, because it can be used to drag a parent tab as an individual tab.
      !configs.moveDroppedTabToNewWindowForUnhandledDragEvent) {
    log('dragged items are processed by someone: ', event.dataTransfer.dropEffect);
    return;
  }

  const dropTargetTab = EventUtils.getTabFromEvent(event);
  if (dropTargetTab &&
      dragData &&
      dragData.tabNodes &&
      !dragData.tabNodes.includes(dropTargetTab)) {
    log('ignore drop on dragged tabs themselves');
    return;
  }

  const windowX = window.mozInnerScreenX * window.devicePixelRatio;
  const windowY = window.mozInnerScreenY * window.devicePixelRatio;
  const offset  = dragData.tabNodes[0].getBoundingClientRect().height * window.devicePixelRatio / 2;
  log('dragend at: ', {
    windowX,
    windowY,
    windowW: window.innerWidth,
    windowH: window.innerHeight,
    eventX:  event.screenX,
    eventY:  event.screenY,
    offset
  });
  if (event.screenX >= windowX - offset &&
      event.screenY >= windowY - offset &&
      event.screenX <= windowX + window.innerWidth + offset &&
      event.screenY <= windowY + window.innerHeight + offset) {
    log('dropped near the tab bar (from coordinates): detaching is canceled');
    return;
  }

  log('trying to detach tab from window');
  event.stopPropagation();
  event.preventDefault();

  if (isDraggingAllCurrentTabs(dragData.tabNode)) {
    log('all tabs are dragged, so it is nonsence to tear off them from the window');
    return;
  }

  Tree.openNewWindowFromTabs(dragData.tabNodes, {
    duplicate: EventUtils.isAccelKeyPressed(event),
    left:      event.screenX,
    top:       event.screenY,
    inRemote:  true
  });
}
onDragEnd = EventUtils.wrapWithErrorHandler(onDragEnd);

function finishDrag() {
  log('finishDrag');
  clearDraggingTabsState();

  mDraggingOnSelfWindow = false;

  wait(100).then(() => {
    mCurrentDragData = null;
    browser.runtime.sendMessage({
      type:     Constants.kCOMMAND_BROADCAST_CURRENT_DRAG_DATA,
      windowId: Tabs.getWindow(),
      dragData: null
    });
  });

  clearDropPosition();
  mLastDropPosition = null;
  mLastDragOverTimestamp = null;
  clearDraggingState();
  collapseAutoExpandedTabsWhileDragging();
}


/* tab drag handler */

function showTabDragHandle(tab) {
  if (showTabDragHandle.timer)
    clearTimeout(showTabDragHandle.timer);
  showTabDragHandle.timer = setTimeout(() => {
    delete showTabDragHandle.timer;
    reallyShowTabDragHandle(tab);
  }, 100);
}
function reallyShowTabDragHandle(tab) {
  if (!configs.showDragHandle ||
      !Tabs.ensureLivingTab(tab))
    return;

  if (mTabDragHandle.showTimer) {
    clearTimeout(mTabDragHandle.showTimer);
    delete mTabDragHandle.showTimer;
  }

  mTabDragHandle.classList.remove('animating');
  mTabDragHandle.classList.remove('shown');

  for (const activeItem of mTabDragHandle.querySelectorAll('.active')) {
    activeItem.classList.remove('active');
  }

  mTabDragHandle.dataset.targetTabId = tab.id;
  if (Tabs.hasChildTabs(tab))
    mTabDragHandle.classList.add('has-child');
  else
    mTabDragHandle.classList.remove('has-child');

  const tabRect       = tab.getBoundingClientRect();
  const containerRect = tab.parentNode.getBoundingClientRect();
  if (Tabs.isPinned(tab) ||
      configs.sidebarPosition == Constants.kTABBAR_POSITION_LEFT) {
    mTabDragHandle.style.right = '';
    mTabDragHandle.style.left  = `${tabRect.left}px`;
  }
  else {
    mTabDragHandle.style.left  = '';
    mTabDragHandle.style.right = `${containerRect.width - tabRect.width}px`;
  }

  const handlerRect = mTabDragHandle.getBoundingClientRect();
  if (handlerRect.left < 0) {
    mTabDragHandle.style.right = '';
    mTabDragHandle.style.left  = 0;
  }
  else if (handlerRect.right > containerRect.width) {
    mTabDragHandle.style.left  = '';
    mTabDragHandle.style.right = 0;
  }

  mTabDragHandle.style.top = `${tabRect.top + ((tabRect.height - handlerRect.height) / 2)}px`;

  mTabDragHandle.classList.add('animating');
  mTabDragHandle.classList.add('shown');
  setTimeout(() => {
    if (mTabDragHandle.classList.contains('shown'))
      mTabDragHandle.classList.remove('animating');
  }, configs.collapseDuration);
}

function reserveToShowTabDragHandle(tab) {
  if (mTabDragHandle.hideTimer) {
    clearTimeout(mTabDragHandle.hideTimer);
    delete mTabDragHandle.hideTimer;
  }
  mTabDragHandle.showTimer = setTimeout(() => {
    delete mTabDragHandle.showTimer;
    showTabDragHandle(tab);
  }, configs.dragHandleDelay);
}

function hideTabDragHandle() {
  if (mTabDragHandle.showTimer) {
    clearTimeout(mTabDragHandle.showTimer);
    delete mTabDragHandle.showTimer;
  }
  mTabDragHandle.classList.add('animating');
  mTabDragHandle.classList.remove('shown');
  mTabDragHandle.dataset.targetTabId = '';
  setTimeout(() => {
    if (mTabDragHandle.classList.contains('shown'))
      return;
    mTabDragHandle.style.left =
      mTabDragHandle.style.right =
      mTabDragHandle.style.top = '';
  }, configs.collapseDuration * 2);
}

function reserveToHideTabDragHandle() {
  if (mTabDragHandle.showTimer) {
    clearTimeout(mTabDragHandle.showTimer);
    delete mTabDragHandle.showTimer;
  }
  mTabDragHandle.hideTimer = setTimeout(() => {
    delete mTabDragHandle.hideTimer;
    hideTabDragHandle();
  }, configs.subMenuCloseDelay);
}

function onMouseMove(event) {
  if (!configs.showDragHandle)
    return;

  const tab    = EventUtils.getTabFromEvent(event);
  const target = EventUtils.getElementTarget(event.target);
  if (tab) {
    // We need to use coordinates because elements with
    // "pointer-events:none" won't be found by element.closest().
    const dragHandlerRect = mTabDragHandle.getBoundingClientRect();
    if (mTabDragHandle.classList.contains('shown') &&
        event.clientX >= dragHandlerRect.left &&
        event.clientY >= dragHandlerRect.top &&
        event.clientX <= dragHandlerRect.right &&
        event.clientY <= dragHandlerRect.bottom) {
      if (mTabDragHandle.hideTimer) {
        clearTimeout(mTabDragHandle.hideTimer);
        delete mTabDragHandle.hideTimer;
      }
    }
    else {
      const tabRect  = tab.getBoundingClientRect();
      const areaSize = Size.getFavIconSize() / 2;
      const onLeft   = Tabs.isPinned(tab) || configs.sidebarPosition == Constants.kTABBAR_POSITION_LEFT;
      const onArea   = (onLeft &&
                        event.clientX >= tabRect.left &&
                        event.clientX <= tabRect.left + areaSize) ||
                       (!onLeft &&
                        event.clientX <= tabRect.right &&
                        event.clientX >= tabRect.right - areaSize);
      if (onArea)
        reserveToShowTabDragHandle(tab);
      else
        reserveToHideTabDragHandle();
    }
  }
  else if (!target || !target.closest(`#${mTabDragHandle.id}`)) {
    reserveToHideTabDragHandle();
  }
}
onMouseMove = EventUtils.wrapWithErrorHandler(onMouseMove);

function onTabDragHandleDragStart(event) {
  // get target tab at first before it is cleared by hideTabDragHandle()
  const targetTab = Tabs.getTabById(mTabDragHandle.dataset.targetTabId);
  log('onTabDragHandleDragStart: targetTab = ', mTabDragHandle.dataset.targetTabId, targetTab);

  if (!targetTab) {
    hideTabDragHandle();
    return;
  }

  event.stopPropagation();

  const target = EventUtils.getElementTarget(event.target);
  target.classList.add('active');
  target.classList.add('animating');

  setTimeout(() => {
    hideTabDragHandle();
  }, configs.dragHandleFeedbackDuration);

  return onDragStart(event, {
    target:                  targetTab,
    shouldIgnoreDescendants: !!target.closest('.shouldIgnoreDescendants'),
    allowBookmark:           !!target.closest('.allowBookmark')
  });
}
onTabDragHandleDragStart = EventUtils.wrapWithErrorHandler(onTabDragHandleDragStart);


/* drag on tabs API */

function onTSTAPIDragEnter(event) {
  Scroll.autoScrollOnMouseEvent(event);
  const tab = EventUtils.getTabFromEvent(event);
  let target = tab;
  if (mDragTargetIsClosebox && EventUtils.isEventFiredOnClosebox(event))
    target = SidebarTabs.getClosebox(tab);
  cancelDelayedTSTAPIDragExitOn(target);
  if (tab &&
      (!mDragTargetIsClosebox ||
       EventUtils.isEventFiredOnClosebox(event))) {
    if (target != mLastDragEnteredTarget) {
      TSTAPI.sendMessage({
        type:   TSTAPI.kNOTIFY_TAB_DRAGENTER,
        tab:    TSTAPI.serializeTab(tab),
        window: Tabs.getWindow()
      });
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
  let target = tab;
  if (mDragTargetIsClosebox && EventUtils.isEventFiredOnClosebox(event))
    target = SidebarTabs.getClosebox(tab);
  cancelDelayedTSTAPIDragExitOn(target);
  target.onTSTAPIDragExitTimeout = setTimeout(() => {
    delete target.onTSTAPIDragExitTimeout;
    TSTAPI.sendMessage({
      type:   TSTAPI.kNOTIFY_TAB_DRAGEXIT,
      tab:    TSTAPI.serializeTab(tab),
      window: Tabs.getWindow()
    });
  }, 10);
}

function cancelDelayedTSTAPIDragExitOn(aTarget) {
  if (aTarget && aTarget.onTSTAPIDragExitTimeout) {
    clearTimeout(aTarget.onTSTAPIDragExitTimeout);
    delete aTarget.onTSTAPIDragExitTimeout;
  }
}


function onMessage(message, _aSender, _aRespond) {
  if (!message ||
      typeof message.type != 'string')
    return;

  switch (message.type) {
    case Constants.kCOMMAND_BROADCAST_CURRENT_DRAG_DATA:
      setDragData(message.dragData || null);
      break;
  }
}

