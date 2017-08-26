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

const kTREE_DROP_TYPE = 'application/x-treestyletab-tree';

var gAutoExpandedTabs = [];
var gAutoExpandWhileDNDTimer;
var gAutoExpandWhileDNDTimerNext;

function startListenDragEvents(aTarget) {
  aTarget.addEventListener('dragstart', onDragStart);
  aTarget.addEventListener('dragover', onDragOver);
  aTarget.addEventListener('dragenter', onDragEnter);
  aTarget.addEventListener('dragleave', onDragLeave);
  aTarget.addEventListener('drop', onDrop);
  aTarget.addEventListener('dragend', onDragEnd);
}

function endListenDragEvents(aTarget) {
  aTarget.removeEventListener('dragstart', onDragStart);
  aTarget.removeEventListener('dragover', onDragOver);
  aTarget.removeEventListener('dragenter', onDragEnter);
  aTarget.removeEventListener('dragleave', onDragLeave);
  aTarget.removeEventListener('drop', onDrop);
  aTarget.removeEventListener('dragend', onDragEnd);
}


function getDragDataFromOneTab(aTab) {
  aTab = getTabFromChild(aTab);
  if (!aTab)
    return {
      draggedTab: null,
      draggedTabs: [],
      transferable: {}
    };

  var draggedTabs = [aTab].concat(getDescendantTabs(aTab)); //tabsDragUtils.getSelectedTabs(aTab || aInfo.event);
  return {
    draggedTab: aTab,
    draggedTabs: draggedTabs,
    transferable: {
      draggedTab: aTab.id,
      draggedTabs: draggedTabs.map(aDraggedTab => aDraggedTab.id)
    }
  };
}

function getDropAction(aEvent) {
  var info = getDropActionInternal(aEvent);
  info.canDrop = true;
  if (info.dragged) {
    var isCopy = isCopyAction(aEvent);
    if (isCopy)
      info.action |= kACTION_DUPLICATE;
    if (!isCopy && info.dragged.ownerDocument != document)
      info.action |= kACTION_IMPORT;

    if (info.action & kACTION_AFFECTS_TO_DESTINATION) {
      if (info.action & kACTION_MOVE)
        info.action ^= kACTION_MOVE;
      if (info.action & kACTION_STAY)
        info.action ^= kACTION_STAY;
    }

    if (info.target &&
        isPinned(info.dragged) != isPinned(info.target)) {
      info.canDrop = false;
    }
    else if (info.action & kACTION_ATTACH) {
      if (info.parent == info.dragged) {
        info.canDrop = false;
      }
      else if (info.target &&
               getAncestorTabs(info.target).indexOf(info.dragged) > -1) {
        info.canDrop = false;
      }
    }
  }

  if (info.target &&
      (isHidden(info.target) ||
       (isCollapsed(info.target) &&
        info.position != kDROP_AFTER)))
    info.canDrop = false;

  return info;
}
function getDropActionInternal(aEvent) {
  //log('getDropActionInternal: start');
  var targetTab = getTabFromEvent(aEvent) || getTabFromTabbarEvent(aEvent) || aEvent.target;
  var targetTabs = getTabs(targetTab);
  var firstTargetTab = getFirstNormalTab(targetTab) || targetTabs[0];
  var lastTargetTabIndex = targetTabs.length - 1;
  var lastTargetTab      = targetTabs[lastTargetTabIndex];
  var info       = {
    actualTarget : targetTab,
    dragged      : null,
    target       : null,
    position     : null,
    action       : null,
    parent       : null,
    insertBefore : null
  };

  var dragData = aEvent.dataTransfer.getData(kTREE_DROP_TYPE);
  dragData = dragData && JSON.parse(dragData);

  var draggedTab = info.dragged = getTabById(dragData && dragData.draggedTab);
  var isRemoteTab = draggedTab && draggedTab.ownerDocument != document;
  var isNewTabAction = !draggedTab || draggedTab.ownerDocument != document;

  if (!targetTab) {
    //log('dragging on non-tab element');
    let action = isRemoteTab ? kACTION_STAY : (kACTION_MOVE | kACTION_DETACH) ;
    if (isNewTabAction) action |= kACTION_NEWTAB;
    if (aEvent.clientY < firstTargetTab.getBoundingClientRect().top) {
      //log('dragging above the first tab');
      info.target   = info.parent = info.insertBefore = firstTargetTab;
      info.position = kDROP_BEFORE;
      info.action   = action;
      return info;
    }
    else if (aEvent.clientY > lastTargetTab.getBoundingClientRect().bottom) {
      //log('dragging below the last tab');
      info.target   = info.parent = lastTargetTab;
      info.position = kDROP_AFTER;
      info.action   = action;
      return info;
    }
    else {
      //log('dragging on the tab ', dumpTab(targetTab));
      let index = getTabIndex(targetTab);
      index = Math.min(index, lastTargetTabIndex);
      info.target = targetTab = targetTabs[index];
      if (index == getTabIndex(lastTargetTab)) {
        if (index > 0)
          info.target = targetTab = targetTabs[index - 1];
        info.position = kDROP_AFTER;
        //log('=> after the last tab');
      }
      else if (targetTab == firstTargetTab) {
        if (index < lastTargetTabIndex - 1)
          info.target = targetTab = targetTabs[index + 1];
        info.position = kDROP_BEFORE;
        //log('=> before the first tab');
      }
      //log('info.target = ', dumpTab(info.target));
    }
  }
  else {
    //log('on the tab ', dumpTab(targetTab));
    //ensureTabInitialized(targetTab);
    info.target = targetTab;
  }

  /**
   * Basically, tabs should have three areas for dropping of items:
   * [start][center][end], but, pinned tabs couldn't have its tree.
   * So, if a tab is dragged and the target tab is pinned, then, we
   * have to ignore the [center] area.
   */
  var onPinnedTab = isPinned(targetTab);
  var dropAreasCount = (draggedTab && onPinnedTab) ? 2 : 3 ;
  var targetTabRect = targetTab.getBoundingClientRect();
  var targetTabCoordinate = onPinnedTab ? targetTabRect.left : targetTabRect.top ;
  var targetTabSize = onPinnedTab ? targetTabRect.width : targetTabRect.height ;
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
  //  target: targetTabCoordinate,
  //  area: beforeOrAfterDropAreaSize
  //});
  if (eventCoordinate < targetTabCoordinate + beforeOrAfterDropAreaSize) {
    info.position = kDROP_BEFORE ;
  }
  else if (dropAreasCount == 2 ||
           eventCoordinate > targetTabCoordinate + targetTabSize - beforeOrAfterDropAreaSize) {
    info.position = kDROP_AFTER ;
  }
  else {
    info.position = kDROP_ON;
  }

  switch (info.position)
  {
    case kDROP_ON: {
      //log('drop position = on the tab');
      let visibleNext = getNextVisibleTab(targetTab);
      info.action       = kACTION_STAY | kACTION_ATTACH;
      info.parent       = targetTab;
      info.insertBefore = configs.insertNewChildAt == kINSERT_FISRT ?
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
        let prevLevel   = Number(prevTab.getAttribute(kNEST) || 0);
        let targetLevel = Number(targetTab.getAttribute(kNEST) || 0);
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
        var targetLevel = Number(targetTab.getAttribute(kNEST) || 0);
        var nextLevel   = Number(nextTab.getAttribute(kNEST) || 0);
        info.parent       = (targetLevel < nextLevel) ? targetTab : getParentTab(targetTab) ;
        info.action       = kACTION_MOVE | (info.parent ? kACTION_ATTACH : kACTION_DETACH );
        info.insertBefore = nextTab;
/* strategy
  +-----------------------------------------------------
  |[TARGET   ]
  |     <= attach dragged tab to the parent of the target as its next sibling
  |  [DRAGGED]
  +-----------------------------------------------------
*/
        if (draggedTab == nextTab) {
          info.action = kACTION_MOVE | kACTION_ATTACH;
          info.parent = getParentTab(targetTab);
          info.insertBefore = getNextSiblingTab(targetTab);
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

  if (isNewTabAction)
    info.action |= kACTION_NEWTAB;

  return info;
}

function clearDropPosition() {
  for (let tab of document.querySelectorAll(`[${kDROP_POSITION}]`)) {
    tab.removeAttribute(kDROP_POSITION)
  }
}

function isDraggingAllTabs(aTab, aTabs) {
  var dragData = getDragDataFromOneTab(aTab);
  return dragData.length == (aTabs || getAllTabs(aTab)).length;
}
 
function isDraggingAllCurrentTabs(aTab) {
  return isDraggingAllTabs(aTab, getTabs(aTab));
}

function collapseAutoExpandedTabsWhileDragging() {
  if (gAutoExpandedTabs.length > 0 &&
      configs.autoExpandCollapseFinally) {
    for (let tab of gAutoExpandedTabs) {
      collapseExpandSubtree(tab, {
        collapsed: false,
        justNow:   true,
        inRemote:  true
      });
    }
  }
  gAutoExpandedTabs = [];
}

async function performDrop(aDropActionInfo) {
  log('performDrop: start');
  if (!aDropActionInfo.dragged) {
    log('=> no dragged tab');
    return false;
  }

  var draggedTabs = getDragDataFromOneTab(aDropActionInfo.dragged).draggedTabs;
  var draggedRoots = collectRootTabs(draggedTabs);

  var targetTabs = getTabs(gTargetWindow);

  var draggedWholeTree = [].concat(draggedRoots);
  for (let draggedRoot of draggedRoots) {
    let descendants = getDescendantTabs(draggedRoot);
    for (let descendant of descendants) {
      if (draggedWholeTree.indexOf(descendant) < 0)
        draggedWholeTree.push(descendant);
    }
  }
  log('=> draggedTabs: ', draggedTabs.map(dumpTab).join(' / '));

  var selectedTabs = draggedTabs.filter(isSelected);
  if (draggedWholeTree.length != selectedTabs.length &&
      selectedTabs.length > 0) {
    log('=> partially dragged');
    draggedTabs = draggedRoots = selectedTabs;
    if (aDropActionInfo.action & kACTION_AFFECTS_TO_SOURCE)
      detachTabs(selectedTabs);
  }

  while (aDropActionInfo.insertBefore &&
         draggedWholeTree.indexOf(aDropActionInfo.insertBefore) > -1) {
    aDropActionInfo.insertBefore = getNextTab(aDropActionInfo.insertBefore);
  }

  if (aDropActionInfo.action & kACTION_AFFECTS_TO_SOURCE) {
    log('=> moving dragged tabs');
    let doMove = !isAllTabsPlacedBefore(draggedTabs, aDropActionInfo.insertBefore) ?
      null :
      async () => {
        await moveTabInternallyBefore(aDropActionInfo.dragged, aDropActionInfo.insertBefore, {
          inRemote: true
        });
        await moveTabsInternallyAfter(
          draggedTabs.filter(aTab => aTab != aDropActionInfo.dragged),
          aDropActionInfo.dragged,
          { inRemote: true }
        );
      };

    log('=> action for source tabs');
    if (aDropActionInfo.action & kACTION_DETACH) {
      log('=> detach');
      if (doMove)
        await doMove();
      detachTabsOnDrop(draggedRoots);
    }
    else if (aDropActionInfo.action & kACTION_ATTACH) {
      log('=> attach');
      attachTabsOnDrop(draggedRoots, aDropActionInfo.parent, {
        insertBefore: aDropActionInfo.insertBefore
      });
    }
    else {
      log('=> just moved');
      if (doMove)
        await doMove();
    }

    // if this move will cause no change...
    if (getNextVisibleTab(draggedTabs[draggedTabs.length-1]) == aDropActionInfo.insertBefore) {
      log('=> no change: do nothing');
      return true;
    }
  }

  var treeStructure = getTreeStructureFromTabs(draggedTabs);

  var newTabs;
/*
  var replacedGroupTabs = doAndGetNewTabs(() => {
    newTabs = moveTabsInternal(draggedTabs, {
      duplicate    : aDropActionInfo.action & kACTION_DUPLICATE,
      insertBefore : aDropActionInfo.insertBefore,
      inRemote     : true
    });
  });
  log('=> opened group tabs: ', replacedGroupTabs);
  aDropActionInfo.dragged.ownerDocument.defaultView.setTimeout(() => {
    log('closing needless group tabs');
    replacedGroupTabs.reverse().forEach(function(aTab) {
      log(' check: ', aTab.label+'('+aTab._tPos+') '+getLoadingURI(aTab));
      if (isGroupTab(aTab) &&
        !hasChildTabs(aTab))
        removeTab(aTab);
    }, this);
  }, 0);
*/

/*
  if (newTabs.length && aDropActionInfo.action & kACTION_ATTACH) {
    Promise.all(newTabs.map((aTab) => aTab.__treestyletab__promisedDuplicatedTab))
      .then((function() {
        log('   => attach (last)');
        await attachTabsOnDrop(
          newTabs.filter(function(aTab, aIndex) {
            return treeStructure[aIndex] == -1;
          }),
          aDropActionInfo.parent,
          { insertBefore: aDropActionInfo.insertBefore }
        );
      }).bind(this));
  }
*/

  log('=> finished');
  return true;
}

function attachTabsOnDrop(aTabs, aParent, aOptions = {}) {
  log('attachTabsOnDrop: start');
  for (let tab of aTabs) {
    if (aParent)
      attachTabTo(tab, aParent, {
        insertBefore: aOptions.insertBefore,
        inRemote: true
      });
    else
      detachTab(tab, { inRemote: true });
    collapseExpandTab(tab, { collapsed: false });
  }
}

function detachTabsOnDrop(aTabs) {
  log('detachTabsOnDrop: start');
  for (let tab of aTabs) {
    detachTab(tab, { inRemote: true });
    collapseExpandTab(tab, { collapsed: false });
  }
}


function onDragStart(aEvent) {
  var tab = aEvent.target;
  var dragData = getDragDataFromOneTab(tab);
  for (let draggedTab of dragData.draggedTabs) {
    draggedTab.classList.add(kTAB_STATE_DRAGGING);
  }
  aEvent.dataTransfer.setData(kTREE_DROP_TYPE, JSON.stringify(dragData.transferable));
  getTabsContainer(tab).classList.add(kTABBAR_STATE_TAB_DRAGGING);
}

function onDragOver(aEvent) {
  aEvent.preventDefault(); // this is required to override default dragover actions!
try{
  //autoScroll.processAutoScroll(aEvent);
  var info = getDropAction(aEvent);

/*
  // auto-switch for staying on tabs
  if (
    info.position == kDROP_ON &&
    info.target &&
    !isActive(info.target) &&
    '_dragTime' in observer && '_dragOverDelay' in observer
    ) {
    let time = observer.mDragTime || observer._dragTime || 0;
    let delay = observer.mDragOverDelay || observer._dragOverDelay || 0;
    let effects = '_setEffectAllowedForDataTransfer' in observer ?
            observer._setEffectAllowedForDataTransfer(aEvent) :
            observer._getDropEffectForTabDrag(aEvent) ;
    if (effects == 'link') {
      let now = Date.now();
      if (!time) {
        time = now;
        if ('mDragTime' in observer)
          observer.mDragTime = time;
        else
          observer._dragTime = time;
      }
      if (now >= time + delay)
        b.selectedTab = info.target;
    }
  }
*/

/*
  let effects = '_setEffectAllowedForDataTransfer' in observer ?
            observer._setEffectAllowedForDataTransfer(aEvent) :
            observer._getDropEffectForTabDrag(aEvent) ;
*/
  if (!info.canDrop/* ||
      effects == 'none'*/) {
    aEvent.dataTransfer.effectAllowed = 'none';
    clearDropPosition();
    return;
  }

  var dropPositionTargetTab = info.target;
  while (isCollapsed(dropPositionTargetTab)) {
    dropPositionTargetTab = getPreviousTab(dropPositionTargetTab);
  }
  if (!dropPositionTargetTab)
    dropPositionTargetTab = info.target;
  //log('drop position tab: ', dumpTab(dropPositionTargetTab));

  var dropPosition = info.position == kDROP_BEFORE ? 'before' :
                     info.position == kDROP_AFTER ? 'after' :
                     'self';
  if (dropPositionTargetTab != info.draggedTab) {
    clearDropPosition();
    dropPositionTargetTab.setAttribute(kDROP_POSITION, dropPosition);
    //log('set drop position to ', dropPosition);
  }
}catch(e){log(String(e));}
}

function onDragEnter(aEvent) {
  var info = getDropAction(aEvent);
  var dt = aEvent.dataTransfer;
  if (info.action & kACTION_NEWTAB)
      dt.effectAllowed = dt.dropEffect = (
      !info.dragged ? 'link' :
      isCopyAction(aEvent) ? 'copy' :
      'move'
    );

  if (!info.canDrop) {
    dt.effectAllowed = dt.dropEffect = 'none';
    return;
  }

  if (!info.actualTarget ||
      !configs.autoExpandEnabled)
    return;

  var container = info.target.parentNode;
  clearTimeout(gAutoExpandWhileDNDTimer);
  clearTimeout(gAutoExpandWhileDNDTimerNext);

  if (aEvent.target == info.dragged)
    return;

  gAutoExpandWhileDNDTimerNext = setTimeout((aTargetId, aDraggedId) => {
    gAutoExpandWhileDNDTimerNext = null;
    gAutoExpandWhileDNDTimer = setTimeout(() => {
        let targetTab = getTabById(aTargetId);
        if (targetTab &&
            shouldTabAutoExpanded(targetTab) &&
            targetTab.getAttribute(kDROP_POSITION) == 'self') {
          let draggedTab = aDraggedId && getTabById(aDraggedId);
          if (configs.autoExpandIntelligently) {
            collapseExpandTreesIntelligentlyFor(targetTab, { inRemote: true });
          }
          else {
            if (container.autoExpandedTabs.indexOf(aTargetId) < 0)
                container.autoExpandedTabs.push(aTargetId);
            collapseExpandSubtree(targetTab, {
              collapsed: false,
              inRemote: true
            });
          }
        }
    }, configs.autoExpandDelay);
  }, 0, info.target.id, info.dragged && info.dragged.id);
}

function onDragLeave(aEvent) {
  clearDropPosition();
  clearTimeout(gAutoExpandWhileDNDTimer);
  gAutoExpandWhileDNDTimer = null;
}

async function onDrop(aEvent) {
  await onTabDrop(aEvent);
  collapseAutoExpandedTabsWhileDragging();
}
async function onTabDrop(aEvent) {
  /**
   * We must calculate drop action before clearing "dragging"
   * state, because the drop position depends on tabs' actual
   * positions (they are applied only while tab dragging.)
   */
  var dropActionInfo = getDropAction(aEvent);
  var dt = aEvent.dataTransfer;

  clearDropPosition();
  var container = dropActionInfo.target.parentNode;
  container.classList.remove(kTABBAR_STATE_TAB_DRAGGING);
  log('onDrop', {
    dropEffect: dt.dropEffect,
    dragged: dumpTab(dropActionInfo.dragged)
  });

  if (dt.dropEffect != 'link' &&
      dt.dropEffect != 'move' &&
      !dropActionInfo.dragged) {
    log('invalid drop');
    aEvent.stopPropagation();
    return;
  }

  if (!dropActionInfo.dragged) {
    log('link or bookmark item is dropped');
    //handleLinksOrBookmarks(aEvent, dropActionInfo);
    return;
  }

  if (await performDrop(dropActionInfo)) {
    log('dropped tab is performed.');
    aEvent.stopPropagation();
    return;
  }

  // duplicating of tabs
  if ((dt.dropEffect == 'copy' ||
       dropActionInfo.dragged.ownerDocument != document) &&
      dropActionInfo.position == kDROP_ON) {
    log('duplicate dropped tabs as children of the tab: ', dumpTab(dropActionInfo.target));
    // attachTabTo(newTabs[0], dropActionInfo.target, { inRemote: true });
  }
}

function onDragEnd(aEvent) {
  log('onDragEnd');
  var dragData = aEvent.dataTransfer.getData(kTREE_DROP_TYPE);
  dragData = JSON.parse(dragData);

  if (Array.isArray(dragData.draggedTabs)) {
    dragData.draggedTabs = dragData.draggedTabs.map(getTabById);
    for (let draggedTab of dragData.draggedTabs) {
      draggedTab.classList.remove(kTAB_STATE_DRAGGING);
    }
  }

  clearDropPosition();
  getTabsContainer(aEvent.target).classList.remove(kTABBAR_STATE_TAB_DRAGGING);
  collapseAutoExpandedTabsWhileDragging();

  if (aEvent.dataTransfer.dropEffect != 'none')
    return;

  aEvent.stopPropagation();
  aEvent.preventDefault();

  var eX = aEvent.clientX;
  var eY = aEvent.clientY;
  var x, y, w, h;

  // ignore drop on the sidebar
  var tabbarRect = document.body.getBoundingClientRect();
  w = tabbarRect.width;
  h = tabbarRect.height;
  if (eX > 0 && eX < w && eY > 0 && eY < h)
    return;

  // ignore drop near the tab bar
  var ignoreArea = Math.max(16, parseInt(getFirstNormalTab(gTargetWindow).getBoundingClientRect().height / 2));
  x = -ignoreArea;
  y = - ignoreArea;
  w = tabbarRect.width + ignoreArea + ignoreArea;
  h = tabbarRect.height + ignoreArea + ignoreArea;
  if (eX > x && eX < x + w && eY > y && eY < y + h)
    return;

  if (isDraggingAllCurrentTabs(dragData.draggedTab))
    return;

  //if (aEvent.ctrlKey || aEvent.metaKey)
  //  draggedTab.__treestyletab__toBeDuplicated = true;
 
  //tearOff(draggedTab);
}
