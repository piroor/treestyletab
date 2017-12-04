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

const kTREE_DROP_TYPE   = 'application/x-treestyletab-tree';
const kTYPE_X_MOZ_PLACE = 'text/x-moz-place';

var gLongHoverExpandedTabs = [];
var gLongHoverTimer;
var gLongHoverTimerNext;

function startListenDragEvents() {
  document.addEventListener('dragstart', onDragStart);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragenter', onDragEnter);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('drop', onDrop);
  document.addEventListener('dragend', onDragEnd);
}

function endListenDragEvents() {
  document.removeEventListener('dragstart', onDragStart);
  document.removeEventListener('dragover', onDragOver);
  document.removeEventListener('dragenter', onDragEnter);
  document.removeEventListener('dragleave', onDragLeave);
  document.removeEventListener('drop', onDrop);
  document.removeEventListener('dragend', onDragEnd);
}


/* helpers */

function getDragDataFromOneTab(aTab) {
  aTab = getTabFromChild(aTab);
  if (!aTab)
    return {
      tabNode:  null,
      tabNodes: [],
      tabId:    null,
      tabIds:   [],
      windowId: null
    };

  var draggedTabs = getDraggedTabsFromOneTab(aTab);
  return {
    tabNode:  aTab,
    tabNodes: draggedTabs,
    tabId:    aTab.apiTab.id,
    tabIds:   draggedTabs.map(aDraggedTab => aDraggedTab.apiTab.id),
    windowId: aTab.apiTab.windowId
  };
}

function getDraggedTabsFromOneTab(aTab) {
  if (isSelected(aTab))
    return getSelectedTabs(aTab);
  return [aTab].concat(getDescendantTabs(aTab));
}

function sanitizeDragData(aDragData) {
  return {
    tabNode:  null,
    tabNodes: [],
    tabId:    aDragData.tabId,
    tabIds:   aDragData.tabIds,
    windowId: aDragData.windowId
  };
}

function getDropAction(aEvent) {
  var info = getDropActionInternal(aEvent);
  info.canDrop = true;
  if (info.draggedTab) {
    if (info.dragOverTab &&
        isPinned(info.draggedTab) != isPinned(info.dragOverTab)) {
      info.canDrop = false;
    }
    else if (info.action & kACTION_ATTACH) {
      if (info.parent == info.draggedTab) {
        info.canDrop = false;
      }
      else if (info.dragOverTab) {
        let ancestors = getAncestorTabs(info.dragOverTab);
        info.canDrop = info.draggedTabs.indexOf(info.dragOverTab) < 0 &&
                         collectRootTabs(info.draggedTabs).every(aRootTab =>
                           ancestors.indexOf(aRootTab) < 0
                         );
      }
    }
  }

  if (info.dragOverTab &&
      (isHidden(info.dragOverTab) ||
       (isCollapsed(info.dragOverTab) &&
        info.dropPosition != kDROP_AFTER)))
    info.canDrop = false;

  info.isCopyAction = isCopyAction(aEvent);
  info.dropEffect = getDropEffectFromDropAction(info);
  return info;
}
function getDropActionInternal(aEvent) {
  //log('getDropActionInternal: start');
  var targetTab          = getTabFromEvent(aEvent) ||
                             getTabFromTabbarEvent(aEvent);
  var targetTabs         = getAllTabs(targetTab);
  var firstTargetTab     = getFirstNormalTab(targetTab) ||
                             targetTabs[0];
  var lastTargetTabIndex = targetTabs.length - 1;
  var lastTargetTab      = targetTabs[lastTargetTabIndex];
  var info = {
    dragOverTab:   getTabFromEvent(aEvent),
    draggedTab:    null,
    draggedTabs:   [],
    targetTab:     targetTab,
    dropPosition:  null,
    action:        null,
    parent:        null,
    insertBefore:  null,
    insertAfter:   null
  };

  var dragData = aEvent.dataTransfer.mozGetDataAt(kTREE_DROP_TYPE, 0);
  info.dragData = dragData = dragData && JSON.parse(dragData);

  var draggedTab = dragData && getTabById(dragData.tabId);
  info.draggedTab = draggedTab;
  var draggedTabs = (dragData && dragData.tabIds) || [];
  draggedTabs = draggedTabs.map(getTabById).filter(aTab => !!aTab);
  info.draggedTabs = draggedTabs;
  var isRemoteTab    = !draggedTab && (!dragData || !!dragData.tabId);
  var isNewTabAction = !draggedTab && (!dragData || !dragData.tabId);

  if (!targetTab) {
    //log('dragging on non-tab element');
    let action = kACTION_MOVE | kACTION_DETACH;
    if (aEvent.clientY < firstTargetTab.getBoundingClientRect().top) {
      //log('dragging above the first tab');
      info.targetTab    = info.insertBefore = firstTargetTab;
      info.dropPosition = kDROP_BEFORE;
      info.action       = action;
    }
    else if (aEvent.clientY > lastTargetTab.getBoundingClientRect().bottom) {
      //log('dragging below the last tab');
      info.targetTab    = info.insertAfter = lastTargetTab;
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
  var onPinnedTab         = isPinned(targetTab);
  var dropAreasCount      = (draggedTab && onPinnedTab) ? 2 : 3 ;
  var targetTabRect       = targetTab.getBoundingClientRect();
  var targetTabCoordinate = onPinnedTab ? targetTabRect.left : targetTabRect.top ;
  var targetTabSize       = onPinnedTab ? targetTabRect.width : targetTabRect.height ;
  var beforeOrAfterDropAreaSize;
  if (dropAreasCount == 2) {
    beforeOrAfterDropAreaSize = Math.round(targetTabSize / dropAreasCount);
  }
  else { // enlarge the area to dop something on the tab itself
    beforeOrAfterDropAreaSize = Math.round(targetTabSize / 4);
  }
  var eventCoordinate = onPinnedTab ? aEvent.clientX : aEvent.clientY;
  //log('coordinates: ', {
  //  event: eventCoordinate,
  //  targetTab: targetTabCoordinate,
  //  area: beforeOrAfterDropAreaSize
  //});
  if (eventCoordinate < targetTabCoordinate + beforeOrAfterDropAreaSize) {
    info.dropPosition = kDROP_BEFORE;
    info.insertBefore = firstTargetTab;
  }
  else if (dropAreasCount == 2 ||
           eventCoordinate > targetTabCoordinate + targetTabSize - beforeOrAfterDropAreaSize) {
    info.dropPosition = kDROP_AFTER;
    info.insertAfter  = lastTargetTab;
  }
  else {
    info.dropPosition = kDROP_ON_SELF;
  }

  switch (info.dropPosition)
  {
    case kDROP_ON_SELF: {
      //log('drop position = on the tab');
      let visibleNext = getNextVisibleTab(targetTab);
      info.action       = kACTION_ATTACH;
      info.parent       = targetTab;
      info.insertBefore = configs.insertNewChildAt == kINSERT_FIRST ?
        (getFirstChildTab(targetTab) || visibleNext) :
        (getNextSiblingTab(targetTab) || getNextTab(getLastDescendantTab(targetTab) || targetTab));
      // if (info.insertBefore)
      //  log('insertBefore = ', dumpTab(info.insertBefore));
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
      let prevTab = getPreviousVisibleTab(targetTab);
      if (!prevTab) {
        // allow to drop pinned tab to beside of another pinned tab
        if (draggedTab && isPinned(draggedTab)) {
          info.action       = kACTION_MOVE;
          info.insertBefore = targetTab;
        }
        else {
          info.action       = kACTION_MOVE | kACTION_DETACH;
          info.insertBefore = firstTargetTab;
        }
      }
      else {
        let prevLevel   = Number(prevTab.getAttribute(kLEVEL) || 0);
        let targetLevel = Number(targetTab.getAttribute(kLEVEL) || 0);
        info.parent       = (prevLevel < targetLevel) ? prevTab : getParentTab(targetTab) ;
        info.action       = kACTION_MOVE | (info.parent ? kACTION_ATTACH : kACTION_DETACH );
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
      let nextTab = getNextVisibleTab(targetTab);
      if (!nextTab) {
        info.action = kACTION_MOVE | kACTION_ATTACH;
        info.parent = getParentTab(targetTab);
      }
      else {
        let targetLevel = Number(targetTab.getAttribute(kLEVEL) || 0);
        let nextLevel   = Number(nextTab.getAttribute(kLEVEL) || 0);
        info.parent       = (targetLevel < nextLevel) ? targetTab : getParentTab(targetTab) ;
        info.action       = kACTION_MOVE | (info.parent ? kACTION_ATTACH : kACTION_DETACH );
        info.insertBefore = nextTab;
        info.insertAfter  = targetTab;
        /* strategy
             +-----------------------------------------------------
             |[TARGET   ]
             |     <= attach dragged tab to the parent of the target as its next sibling
             |  [DRAGGED]
             +-----------------------------------------------------
        */
        if (draggedTab == nextTab) {
          info.action       = kACTION_MOVE | kACTION_ATTACH;
          info.parent       = getParentTab(targetTab);
          info.insertBefore = getNextSiblingTab(targetTab);
          info.insertAfter  = getLastDescendantTab(targetTab);
          let ancestor = info.parent;
          while (ancestor && !info.insertBefore) {
            info.insertBefore = getNextSiblingTab(ancestor);
            ancestor = getParentTab(ancestor);
          }
        }
      }
      //if (info.insertBefore)
      //  log('insertBefore = ', dumpTab(info.insertBefore));
    }; break;
  }

  return info;
}
function getDropEffectFromDropAction(aActionInfo) {
  if (aActionInfo.canDrop)
    return 'none';
  if (!aActionInfo.draggedTab)
    return 'link';
  if (aActionInfo.isCopyAction)
    return 'copy';
  return 'move';
}

function clearDropPosition() {
  for (let tab of document.querySelectorAll(`[${kDROP_POSITION}]`)) {
    tab.removeAttribute(kDROP_POSITION)
  }
}

function isDraggingAllTabs(aTab, aTabs) {
  var dragData = getDragDataFromOneTab(aTab);
  return dragData.tabIds.length == (aTabs || getAllTabs(aTab)).length;
}
 
function isDraggingAllCurrentTabs(aTab) {
  return isDraggingAllTabs(aTab, getTabs(aTab));
}

function collapseAutoExpandedTabsWhileDragging() {
  if (gLongHoverExpandedTabs.length > 0 &&
      configs.autoExpandOnLongHoverRestoreIniitalState) {
    for (let tab of gLongHoverExpandedTabs) {
      collapseExpandSubtree(tab, {
        collapsed: false,
        justNow:   true,
        inRemote:  true
      });
    }
  }
  gLongHoverExpandedTabs = [];
}

async function handleDroppedNonTabItems(aEvent, aDropActionInfo) {
  aEvent.stopPropagation();

  var uris = retrieveURIsFromDragEvent(aEvent);
  // uris.forEach(aURI => {
  //   if (aURI.indexOf(kURI_BOOKMARK_FOLDER) != 0)
  //     securityCheck(aURI, aEvent);
  // });
  log('handleDroppedNonTabItems: ', uris);

  var inBackground = false; // prefs.getPref('browser.tabs.loadInBackground');
  if (aEvent.shiftKey)
    inBackground = !inBackground;

  var dragOverTab = aDropActionInfo.dragOverTab;
  if (dragOverTab &&
      aDropActionInfo.dropPosition == kDROP_ON_SELF &&
      (getDroppedLinksOnTabBehavior() & kDROPLINK_LOAD) &&
      !isLocked(dragOverTab) &&
      !isPinned(dragOverTab)) {
    await loadURI(uris.shift(), {
      tab:      dragOverTab,
      inRemote: true
    });
  }
  await openURIsInTabs(uris, {
    parent:       aDropActionInfo.parent,
    insertBefore: aDropActionInfo.insertBefore,
    insertAfter:  aDropActionInfo.insertAfter,
    inRemote:     true
  });
}

function retrieveURIsFromDragEvent(aEvent) {
  log('retrieveURIsFromDragEvent');
  var dt = aEvent.dataTransfer;
  var urls = [];
  var types = [
    kTYPE_X_MOZ_PLACE,
    'text/uri-list',
    'text/x-moz-text-internal',
    'text/x-moz-url',
    'text/plain',
    'application/x-moz-file'
  ];
  for (let i = 0; i < types.length; i++) {
    let dataType = types[i];
    for (let i = 0, maxi = dt.mozItemCount; i < maxi; i++) {
      let urlData = dt.mozGetDataAt(dataType, i);
      if (urlData) {
        urls = urls.concat(retrieveURIsFromData(urlData, dataType));
      }
    }
    if (urls.length)
      break;
  }
  log(' => retrieved: ', urls);
  urls = urls.filter(aURI =>
    aURI &&
      aURI.length &&
      aURI.indexOf(kBOOKMARK_FOLDER) == 0 ||
      !/^\s*(javascript|data):/.test(aURI)
  );
  log('  => filtered: ', urls);

  urls = urls.map(fixupURIFromText);
  log('  => fixed: ', urls);

  return urls;
}

const kBOOKMARK_FOLDER = 'x-moz-place:';
function retrieveURIsFromData(aData, aType) {
  log('retrieveURIsFromData: ', aType, aData);
  switch (aType) {
    case kTYPE_X_MOZ_PLACE: {
      let item = JSON.parse(aData);
      if (item.type == 'text/x-moz-place-container') {
        let children = item.children;
        if (!children) {
          children = item.children = retrieveBookmarksInFolder(item.id);
          aData = JSON.stringify(item);
        }
        // When a blank folder is dropped, just open a dummy tab with the folder name.
        if (children && children.length == 0) {
          let uri = makeGroupTabURI({ title: item.title });
          return [uri];
        }
      }
      let uri = item.uri;
      if (uri)
        return uri;
      else
        return `${kBOOKMARK_FOLDER}${aData}`;
    }; break;

    case 'text/uri-list':
      return aData
        .replace(/\r/g, '\n')
        .replace(/^\#.+$/gim, '')
        .replace(/\n\n+/g, '\n')
        .split('\n');

    case 'text/unicode':
    case 'text/plain':
    case 'text/x-moz-text-internal':
      return [aData.trim()];

    case 'application/x-moz-file':
      return [getURLSpecFromFile(aData)];
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


/* DOM event listeners */

var gDraggingOnSelfWindow = false;

var gCapturingMouseEvents  = false;
var gReadyToCaptureMouseEvents = false;
var gLastDragEnteredTab    = null;
var gLastDragEnteredTarget = null;
var gDragTargetIsClosebox  = false;

function onDragStart(aEvent) {
  var dragData = getDragDataFromOneTab(aEvent.target);
  if (!dragData.tabNode)
    return;

  var tab = dragData.tabNode

  if (gLastMousedown && gLastMousedown.expired) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    gLastDragEnteredTab = gLastDragEnteredTarget = tab;
    let startOnClosebox = gDragTargetIsClosebox = gLastMousedown.detail.closebox;
    if (startOnClosebox)
      gLastDragEnteredTarget = getTabClosebox(tab);
    sendTSTAPIMessage({
      type:   kTSTAPI_NOTIFY_TAB_DRAGSTART,
      tab:    serializeTabForTSTAPI(tab),
      window: gTargetWindow,
      startOnClosebox
    });
    window.addEventListener('mouseover', onTSTAPIDragEnter, { capture: true });
    window.addEventListener('mouseout',  onTSTAPIDragExit, { capture: true });
    document.body.setCapture(false);
    gCapturingMouseEvents = true;
    return;
  }

  if (!cancelHandleMousedown()) {
    // this action is already handled as "click".
    //return;
  }

  // dragging on clickable element will be expected to cancel the operation
  if (isEventFiredOnClosebox(aEvent) ||
      isEventFiredOnClickable(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    return;
  }

  gDraggingOnSelfWindow = true;

  var dt = aEvent.dataTransfer;
  dt.effectAllowed = 'copyMove';

  dt.mozSetDataAt(kTREE_DROP_TYPE, JSON.stringify(sanitizeDragData(dragData)), 0);

  dragData.tabNodes.map((aDraggedTab, aIndex) => {
    aDraggedTab.classList.add(kTAB_STATE_DRAGGING);
    // this type will be...
    //  * droppable on bookmark toolbar and other Places based UI
    //  * undroppable on content area, desktop, and other application
    // so this won't block tearing off of tabs by drag-and-drop.
    dt.mozSetDataAt(kTYPE_X_MOZ_PLACE,
                    JSON.stringify({
                      type:  kTYPE_X_MOZ_PLACE,
                      uri:   aDraggedTab.apiTab.url,
                      title: aDraggedTab.apiTab.title
                    }),
                    aIndex);
    if (aEvent.shiftKey) {
      // this type will be used to create multiple bookmarks
      // but do not add by default, beause dropping this data into
      // the content area will produce both "new tabs from URL" and
      // "tear off".
      dt.mozSetDataAt('text/x-moz-url',
                      `${aDraggedTab.apiTab.url}\n${aDraggedTab.apiTab.title}`, aIndex);
    }
  });
  getTabsContainer(tab).classList.add(kTABBAR_STATE_TAB_DRAGGING);
  document.documentElement.classList.add(kTABBAR_STATE_TAB_DRAGGING);
}

var gLastDragOverTimestamp = null;

function onDragOver(aEvent) {
  gLastDragOverTimestamp = Date.now();
  aEvent.preventDefault(); // this is required to override default dragover actions!
  autoScrollOnMouseEvent(aEvent);
  var info = getDropAction(aEvent);
  var dt   = aEvent.dataTransfer;

  if (!info.canDrop ||
      isEventFiredOnTabDropBlocker(aEvent)) {
    dt.dropEffect = 'none';
    clearDropPosition();
    return;
  }

  var dropPositionTargetTab = info.targetTab;
  while (isCollapsed(dropPositionTargetTab)) {
    dropPositionTargetTab = getPreviousTab(dropPositionTargetTab);
  }
  if (!dropPositionTargetTab)
    dropPositionTargetTab = info.targetTab;

  if (!dropPositionTargetTab) {
    dt.dropEffect = 'none';
    return;
  }

  if (dropPositionTargetTab != info.draggedTab) {
    clearDropPosition();
    dropPositionTargetTab.setAttribute(kDROP_POSITION, info.dropPosition);
    log('set drop position to ', info.dropPosition);
  }
}

function isEventFiredOnTabDropBlocker(aEvent) {
  return evaluateXPath(
    `ancestor-or-self::*[${hasClass('tab-drop-blocker')}]`,
    aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
}

var gDelayedDragEnter;

function onDragEnter(aEvent) {
  gDelayedDragEnter = setTimeout(() => {
    gDraggingOnSelfWindow = true;
    if (gDelayedDragLeave) {
      clearTimeout(gDelayedDragLeave);
      gDelayedDragLeave = null;
    }
  }, 10);

  var info = getDropAction(aEvent);
  var dt   = aEvent.dataTransfer;
  dt.dropEffect = info.dropEffect;

  if (!info.canDrop)
    return;

  if (!info.dragOverTab ||
      !configs.autoExpandOnLongHover)
    return;

  reserveToProcessLongHover.cancel();

  if (aEvent.target == info.draggedTab)
    return;

  reserveToProcessLongHover({
    dragOverTabId: info.targetTab.id,
    draggedTabId:  info.draggedTab && info.draggedTab.id,
    dropEffect:    info.dropEffect
  });
}

function reserveToProcessLongHover(aParams = {}) {
  gLongHoverTimerNext = setTimeout(() => {
    gLongHoverTimerNext = null;
    gLongHoverTimer = setTimeout(async () => {
      log('reservedProcessLongHover: ', aParams);

      let dragOverTab = getTabById(aParams.dragOverTabId);
      if (!dragOverTab ||
          dragOverTab.getAttribute(kDROP_POSITION) != 'self')
        return;

      // auto-switch for staying on tabs
      if (!isActive(dragOverTab) &&
          aParams.dropEffect == 'link') {
        browser.runtime.sendMessage({
          type:     kCOMMAND_SELECT_TAB,
          windowId: gTargetWindow,
          tab:      dragOverTab.id
        });
      }

      if (!shouldTabAutoExpanded(dragOverTab))
        return;

      // auto-expand for staying on a parent
      let draggedTab = getTabById(aParams.draggedTabId);
      if (configs.autoExpandIntelligently) {
        collapseExpandTreesIntelligentlyFor(dragOverTab, { inRemote: true });
      }
      else {
        if (gLongHoverExpandedTabs.indexOf(aParams.dragOverTabId) < 0)
          gLongHoverExpandedTabs.push(aParams.dragOverTabId);
        collapseExpandSubtree(dragOverTab, {
          collapsed: false,
          inRemote:  true
        });
      }
    }, configs.autoExpandOnLongHoverDelay);
  }, 0);
}
reserveToProcessLongHover.cancel = function() {
  clearTimeout(gLongHoverTimer);
  clearTimeout(gLongHoverTimerNext);
};

var gDelayedDragLeave;

function onDragLeave(aEvent) {
  gDelayedDragLeave = setTimeout(() => {
    gDraggingOnSelfWindow = false;
  }, configs.preventTearOffTabsTimeout);

  clearDropPosition();
  clearTimeout(gLongHoverTimer);
  gLongHoverTimer = null;
}

function onDrop(aEvent) {
  setTimeout(() => collapseAutoExpandedTabsWhileDragging(), 0);
  clearDropPosition();

  var dropActionInfo = getDropAction(aEvent);
  var dt = aEvent.dataTransfer;
  if (dt.dropEffect != 'link' &&
      dt.dropEffect != 'move' &&
      dropActionInfo.dragData &&
      !dropActionInfo.dragData.tabId) {
    log('invalid drop');
    return;
  }

  if (dropActionInfo.dragData &&
      dropActionInfo.dragData.tabId) {
    log('there are dragged tabs');
    performTabsDragDrop({
      windowId:            dropActionInfo.dragData.windowId,
      tabIds:              dropActionInfo.dragData.tabIds,
      action:              dropActionInfo.action,
      attachTo:            dropActionInfo.parent,
      insertBefore:        dropActionInfo.insertBefore,
      insertAfter:         dropActionInfo.insertAfter,
      destinationWindowId: gTargetWindow,
      duplicate:           dt.dropEffect == 'copy',
      inRemote:            true
    });
    return;
  }

  log('link or bookmark item is dropped');
  handleDroppedNonTabItems(aEvent, dropActionInfo);
}

function onDragEnd(aEvent) {
  log('onDragEnd, gDraggingOnSelfWindow = ', gDraggingOnSelfWindow);

  // clear "dragging" status safely, because we possibly fail to get drag data from dataTransfer.
  for (let tab of getDraggingTabs(gTargetWindow)) {
    tab.classList.remove(kTAB_STATE_DRAGGING);
  }

  var dragData = aEvent.dataTransfer.mozGetDataAt(kTREE_DROP_TYPE, 0);
  dragData = dragData && JSON.parse(dragData);
  var stillInSelfWindow = !!gDraggingOnSelfWindow;
  gDraggingOnSelfWindow = false;

  if (Array.isArray(dragData.tabIds))
    dragData.tabNodes = dragData.tabIds.map(getTabById);

  clearDropPosition();
  getTabsContainer(aEvent.target).classList.remove(kTABBAR_STATE_TAB_DRAGGING);
  document.documentElement.classList.remove(kTABBAR_STATE_TAB_DRAGGING);
  collapseAutoExpandedTabsWhileDragging();

  if (aEvent.dataTransfer.dropEffect != 'none' ||
      aEvent.shiftKey) {
    log('dragged items are processed by someone: ', aEvent.dataTransfer.dropEffect);
    return;
  }

  var dropTargetTab = getTabFromEvent(aEvent);
  if (dropTargetTab &&
      dragData &&
      dragData.tabNodes &&
      dragData.tabNodes.indexOf(dropTargetTab) < 0) {
    log('ignore drop on dragged tabs themselves');
    return;
  }

  log('trying to detach tab from window');
  aEvent.stopPropagation();
  aEvent.preventDefault();

  if (stillInSelfWindow) {
    log('dropped at tab bar: detaching is canceled');
    return;
  }

  var now = Date.now();
  var delta = now - gLastDragOverTimestamp;
  log('LastDragOverTimestamp: ', {
    last: gLastDragOverTimestamp,
    now, delta,
    timeout: configs.preventTearOffTabsTimeout
  });
  if (gLastDragOverTimestamp &&
      delta < configs.preventTearOffTabsTimeout) {
    log('dropped near the tab bar: detaching is canceled');
    return;
  }

  if (isDraggingAllCurrentTabs(dragData.tabNode)) {
    log('all tabs are dragged, so it is nonsence to tear off them from the window');
    return;
  }

  openNewWindowFromTabs(dragData.tabNodes, {
    duplicate: isAccelKeyPressed(aEvent),
    left:      aEvent.screenX,
    top:       aEvent.screenY,
    inRemote:  true
  });
}


/* drag on tabs API */

function onTSTAPIDragEnter(aEvent) {
  autoScrollOnMouseEvent(aEvent);
  var tab    = getTabFromEvent(aEvent);
  var target = tab;
  if (gDragTargetIsClosebox && isEventFiredOnClosebox(aEvent))
    target = getTabClosebox(tab);
  cancelDelayedTSTAPIDragExitOn(target);
  if (tab &&
      (!gDragTargetIsClosebox ||
       isEventFiredOnClosebox(aEvent))) {
    if (target != gLastDragEnteredTarget) {
      sendTSTAPIMessage({
        type:   kTSTAPI_NOTIFY_TAB_DRAGENTER,
        tab:    serializeTabForTSTAPI(tab),
        window: gTargetWindow
      });
    }
  }
  gLastDragEnteredTab    = tab;
  gLastDragEnteredTarget = target;
}

function onTSTAPIDragExit(aEvent) {
  if (gDragTargetIsClosebox &&
      !isEventFiredOnClosebox(aEvent))
    return;
  var tab = getTabFromEvent(aEvent);
  if (!tab)
    return;
  var target = tab;
  if (gDragTargetIsClosebox && isEventFiredOnClosebox(aEvent))
    target = getTabClosebox(tab);
  cancelDelayedTSTAPIDragExitOn(target);
  target.onTSTAPIDragExitTimeout = setTimeout(() => {
    delete target.onTSTAPIDragExitTimeout;
    sendTSTAPIMessage({
      type:   kTSTAPI_NOTIFY_TAB_DRAGEXIT,
      tab:    serializeTabForTSTAPI(tab),
      window: gTargetWindow
    });
  }, 10);
}

function cancelDelayedTSTAPIDragExitOn(aTarget) {
  if (aTarget && aTarget.onTSTAPIDragExitTimeout) {
    clearTimeout(aTarget.onTSTAPIDragExitTimeout);
    delete aTarget.onTSTAPIDragExitTimeout;
  }
}

