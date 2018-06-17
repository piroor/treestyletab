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

function log(...aArgs) {
  if (configs.logFor['background/handle-moved-tabs'])
    internalLogger(...aArgs);
}


Tabs.onCreated.addListener((aTab, aInfo = {}) => {
  if (aInfo.duplicated ||
      aInfo.restored ||
      aInfo.skipFixupTree)
    return;
  // if the tab is opened inside existing tree by someone, we must fixup the tree.
  if (!aInfo.openedWithPosition &&
      (Tabs.getNextNormalTab(aTab) ||
       Tabs.getPreviousNormalTab(aTab) ||
       (aInfo.treeForActionDetection &&
        (aInfo.treeForActionDetection.target.next ||
         aInfo.treeForActionDetection.target.previous))))
    tryFixupTreeForInsertedTab(aTab, {
      toIndex:   aTab.apiTab.index,
      fromIndex: Tabs.getTabIndex(Tabs.getLastTab(aTab)),
      treeForActionDetection: aInfo.treeForActionDetection
    });
});

Tabs.onMoving.addListener((aTab, aMoveInfo) => {
  // avoid TabMove produced by browser.tabs.insertRelatedAfterCurrent=true or something.
  const container = Tabs.getTabsContainer(aTab);
  const isNewlyOpenedTab = parseInt(container.dataset.openingCount) > 0;
  const positionControlled = configs.insertNewChildAt != Constants.kINSERT_NO_CONTROL;
  if (!isNewlyOpenedTab ||
      aMoveInfo.byInternalOperation ||
      !positionControlled)
    return true;

  const opener = Tabs.getOpenerTab(aTab);
  // if there is no valid opener, it can be a restored initial tab in a restored window
  // and can be just moved as a part of window restoration process.
  if (!opener)
    return true;

  log('onTabMove for new child tab: move back '+aMoveInfo.toIndex+' => '+aMoveInfo.fromIndex);
  moveBack(aTab, aMoveInfo);
  return false;
});

async function tryFixupTreeForInsertedTab(aTab, aMoveInfo) {
  if (!Tree.shouldApplyTreeBehavior(aMoveInfo)) {
    Tree.detachAllChildren(aTab, {
      behavior: Tree.getCloseParentBehaviorForTab(aTab, {
        keepChildren: true
      }),
      broadcast: true
    });
    Tree.detachTab(aTab, {
      broadcast: true
    });
  }

  log('the tab can be placed inside existing tab unexpectedly, so now we are trying to fixup tree.');
  const action = await detectTabActionFromNewPosition(aTab, aMoveInfo);
  if (!action) {
    log('no action');
    return;
  }

  log('action: ', action);
  switch (action.action) {
    case 'moveBack':
      moveBack(aTab, aMoveInfo);
      return;

    case 'attach': {
      await Tree.attachTabTo(aTab, Tabs.getTabById(action.parent), {
        insertBefore: Tabs.getTabById(action.insertBefore),
        insertAfter:  Tabs.getTabById(action.insertAfter),
        broadcast:    true
      });
      Tree.followDescendantsToMovedRoot(aTab);
    }; break;

    case 'detach': {
      Tree.detachTab(aTab, { broadcast: true });
      Tree.followDescendantsToMovedRoot(aTab);
    }; break;

    default:
      Tree.followDescendantsToMovedRoot(aTab);
      break;
  }
}

Tabs.onMoved.addListener(async (aTab, aMoveInfo) => {
  if (aMoveInfo.byInternalOperation ||
      Tabs.isDuplicating(aTab)) {
    log('internal move');
    return;
  }
  log('process moved tab');

  tryFixupTreeForInsertedTab(aTab, aMoveInfo);
});

Commands.onMoveUp.addListener(async aTab => {
  const index = Tabs.getTabIndex(aTab);
  await tryFixupTreeForInsertedTab(aTab, {
    toIndex:   index,
    fromIndex: index + 1,
  });
});

Commands.onMoveDown.addListener(async aTab => {
  const index = Tabs.getTabIndex(aTab);
  await tryFixupTreeForInsertedTab(aTab, {
    toIndex:   index,
    fromIndex: index - 1,
  });
});

TreeStructure.onTabAttachedFromRestoredInfo.addListener(tryFixupTreeForInsertedTab);

function moveBack(aTab, aMoveInfo) {
  log('Move back tab from unexpected move: ', dumpTab(aTab), aMoveInfo);
  const container = aTab.parentNode;
  TabsContainer.incrementCounter(container, 'internalMovingCount');
  return browser.tabs.move(aTab.apiTab.id, {
    windowId: aMoveInfo.windowId,
    index:    aMoveInfo.fromIndex
  }).catch(e => {
    if (parseInt(container.dataset.internalMovingCount) > 0)
      TabsContainer.decrementCounter(container, 'internalMovingCount');
    ApiTabs.handleMissingTabError(e);
  });
}

async function detectTabActionFromNewPosition(aTab, aMoveInfo) {
  log('detectTabActionFromNewPosition: ', dumpTab(aTab), aMoveInfo);
  const tree   = aMoveInfo.treeForActionDetection || Tabs.snapshotTreeForActionDetection(aTab);
  const target = tree.target;

  const toIndex   = aMoveInfo.toIndex;
  const fromIndex = aMoveInfo.fromIndex;
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
