/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/
'use strict';

import {
  log as internalLogger,
  dumpTab,
  configs
} from '../common/common.js';

import * as Constants from '../common/constants.js';
import * as ApiTabs from '../common/api-tabs.js';
import * as Tabs from '../common/tabs.js';
import * as TabsContainer from '../common/tabs-container.js';
import * as Tree from '../common/tree.js';
import * as Commands from '../common/commands.js';

import * as TreeStructure from './tree-structure.js';

function log(...args) {
  internalLogger('background/handle-moved-tabs', ...args);
}


Tabs.onCreated.addListener((tab, info = {}) => {
  if (info.duplicated ||
      info.restored ||
      info.skipFixupTree)
    return;
  // if the tab is opened inside existing tree by someone, we must fixup the tree.
  if (!info.openedWithPosition &&
      (Tabs.getNextNormalTab(tab) ||
       Tabs.getPreviousNormalTab(tab) ||
       (info.treeForActionDetection &&
        (info.treeForActionDetection.target.next ||
         info.treeForActionDetection.target.previous))))
    tryFixupTreeForInsertedTab(tab, {
      toIndex:   tab.apiTab.index,
      fromIndex: Tabs.getTabIndex(Tabs.getLastTab(tab)),
      treeForActionDetection: info.treeForActionDetection
    });
});

Tabs.onMoving.addListener((tab, moveInfo) => {
  // avoid TabMove produced by browser.tabs.insertRelatedAfterCurrent=true or something.
  const container = Tabs.getTabsContainer(tab);
  const isNewlyOpenedTab = parseInt(container.dataset.openingCount) > 0;
  const positionControlled = configs.insertNewChildAt != Constants.kINSERT_NO_CONTROL;
  if (!isNewlyOpenedTab ||
      moveInfo.byInternalOperation ||
      !positionControlled)
    return true;

  const opener = Tabs.getOpenerTab(tab);
  // if there is no valid opener, it can be a restored initial tab in a restored window
  // and can be just moved as a part of window restoration process.
  if (!opener)
    return true;

  log('onTabMove for new child tab: move back '+moveInfo.toIndex+' => '+moveInfo.fromIndex);
  moveBack(tab, moveInfo);
  return false;
});

async function tryFixupTreeForInsertedTab(tab, moveInfo) {
  if (!Tree.shouldApplyTreeBehavior(moveInfo)) {
    Tree.detachAllChildren(tab, {
      behavior: Tree.getCloseParentBehaviorForTab(tab, {
        keepChildren: true
      }),
      broadcast: true
    });
    Tree.detachTab(tab, {
      broadcast: true
    });
  }

  log('the tab can be placed inside existing tab unexpectedly, so now we are trying to fixup tree.');
  const action = await detectTabActionFromNewPosition(tab, moveInfo);
  if (!action) {
    log('no action');
    return;
  }

  log('action: ', action);
  switch (action.action) {
    case 'moveBack':
      moveBack(tab, moveInfo);
      return;

    case 'attach': {
      await Tree.attachTabTo(tab, Tabs.getTabById(action.parent), {
        insertBefore: Tabs.getTabById(action.insertBefore),
        insertAfter:  Tabs.getTabById(action.insertAfter),
        broadcast:    true
      });
      Tree.followDescendantsToMovedRoot(tab);
    }; break;

    case 'detach': {
      Tree.detachTab(tab, { broadcast: true });
      Tree.followDescendantsToMovedRoot(tab);
    }; break;

    default:
      Tree.followDescendantsToMovedRoot(tab);
      break;
  }
}

Tabs.onMoved.addListener((tab, moveInfo = {}) => {
  if (moveInfo.byInternalOperation ||
      Tabs.isDuplicating(tab)) {
    log('internal move');
    return;
  }
  log('process moved tab');

  tryFixupTreeForInsertedTab(tab, moveInfo);
});

Commands.onMoveUp.addListener(async tab => {
  const index = Tabs.getTabIndex(tab);
  await tryFixupTreeForInsertedTab(tab, {
    toIndex:   index,
    fromIndex: index + 1,
  });
});

Commands.onMoveDown.addListener(async tab => {
  const index = Tabs.getTabIndex(tab);
  await tryFixupTreeForInsertedTab(tab, {
    toIndex:   index,
    fromIndex: index - 1,
  });
});

TreeStructure.onTabAttachedFromRestoredInfo.addListener(tab => { tryFixupTreeForInsertedTab(tab); });

function moveBack(tab, moveInfo) {
  log('Move back tab from unexpected move: ', dumpTab(tab), moveInfo);
  const container = tab.parentNode;
  TabsContainer.incrementCounter(container, 'internalMovingCount');
  return browser.tabs.move(tab.apiTab.id, {
    windowId: moveInfo.windowId,
    index:    moveInfo.fromIndex
  }).catch(e => {
    if (parseInt(container.dataset.internalMovingCount) > 0)
      TabsContainer.decrementCounter(container, 'internalMovingCount');
    ApiTabs.handleMissingTabError(e);
  });
}

async function detectTabActionFromNewPosition(tab, moveInfo = {}) {
  log('detectTabActionFromNewPosition: ', dumpTab(tab), moveInfo);
  const tree   = moveInfo.treeForActionDetection || Tabs.snapshotTreeForActionDetection(tab);
  const target = tree.target;

  const toIndex   = moveInfo.toIndex;
  const fromIndex = moveInfo.fromIndex;
  if (toIndex == fromIndex) { // no move?
    log('=> no move');
    return { action: null };
  }

  const prevTab = tree.tabsById[target.previous];
  const nextTab = tree.tabsById[target.next];
  log('prevTab: ', prevTab && prevTab.id);
  log('nextTab: ', nextTab && nextTab.id);

  const prevParent = prevTab && tree.tabsById[prevTab.parent];
  const nextParent = nextTab && tree.tabsById[nextTab.parent];

  const prevLevel  = prevTab ? prevTab.level : -1 ;
  const nextLevel  = nextTab ? nextTab.level : -1 ;
  log('prevLevel: '+prevLevel);
  log('nextLevel: '+nextLevel);

  const oldParent = tree.tabsById[target.parent];
  let newParent = null;

  if (prevTab &&
      target.cookieStoreId != prevTab.cookieStoreId &&
      target.url == prevTab.url) {
    // https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/
    log('=> replaced by Firefox Multi-Acount Containers');
    newParent = prevParent;
  }
  else if (oldParent &&
           prevTab &&
           oldParent == prevTab) {
    log('=> no need to fix case');
    newParent = oldParent;
  }
  else if (!prevTab) {
    log('=> moved to topmost position');
    newParent = null;
  }
  else if (!nextTab) {
    log('=> moved to last position');
    let ancestor = oldParent;
    while (ancestor) {
      if (ancestor == prevParent) {
        log(' => moving in related tree: keep it attached in existing tree');
        newParent = prevParent;
        break;
      }
      ancestor = tree.tabsById[ancestor.parent];
    }
    if (!newParent) {
      log(' => moving from other tree: keep it orphaned');
    }
  }
  else if (prevParent == nextParent) {
    log('=> moved into existing tree');
    newParent = prevParent;
  }
  else if (prevLevel > nextLevel) {
    log('=> moved to end of existing tree');
    if (!target.active) {
      log('=> maybe newly opened tab');
      newParent = prevParent;
    }
    else {
      log('=> maybe drag and drop (or opened with active state and position)');
      const realDelta = Math.abs(toIndex - fromIndex);
      newParent = realDelta < 2 ? prevParent : (oldParent || nextParent) ;
    }
    while (newParent && newParent.collapsed) {
      log('=> the tree is collapsed, up to parent tree')
      newParent = tree.tabsById[newParent.parent];
    }
  }
  else if (prevLevel < nextLevel) {
    log('=> moved to first child position of existing tree');
    newParent = prevTab || oldParent || nextParent;
  }

  log('calculated parent: ', {
    old: oldParent && oldParent.id,
    new: newParent && newParent.id
  });

  if (newParent) {
    let ancestor = newParent;
    while (ancestor) {
      if (ancestor == target) {
        log('=> invalid move: a parent is moved inside its own tree, thus move back!');
        return { action: 'moveBack' };
      }
      ancestor = tree.tabsById[ancestor.parent];
    }
  }

  if (newParent != oldParent) {
    if (newParent) {
      return {
        action:       'attach',
        parent:       newParent.id,
        insertBefore: nextTab && nextTab.id,
        insertAfter:  prevTab && prevTab.id
      };
    }
    else {
      return { action: 'detach' };
    }
  }
  return { action: 'move' };
}
