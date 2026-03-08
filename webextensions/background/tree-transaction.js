/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2026
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 tkng (https://github.com/tkng)
 */

// TreeTransaction: Manages tree structure changes and batches sidebar messages.
//
// High-level operations:
//   TreeTransaction.attach(child, parent, opts)  — attach a tab to a parent
//   TreeTransaction.detach(child, opts)           — detach a tab from its parent
//
// Transaction wrapper (batches sidebar messages):
//   await TreeTransaction.run(async () => {
//     TreeTransaction.attach(child1, parent);
//     TreeTransaction.attach(child2, parent);
//   }, { justNow: true });

import * as Constants from '/common/constants.js';
import * as SidebarConnection from '/common/sidebar-connection.js';

let mActiveTransaction = null;

// Run a callback inside a transaction. All attach/detach calls
// within the callback accumulate snapshots instead of sending immediately.
// On successful completion, one merged message is sent to the sidebar.
// On exception, accumulated snapshots are discarded and the error is re-thrown.
export async function run(callback, options = {}) {
  if (mActiveTransaction) {
    // Reentrant: just run the callback; attach/detach accumulate
    // into the outer transaction.
    await callback();
    return;
  }
  mActiveTransaction = { snapshots: [], tabMap: new Map() };
  try {
    await callback();
    const { snapshots, tabMap } = mActiveTransaction;
    if (snapshots.length === 0)
      return;
    const merged = mergeSnapshots(snapshots);
    sendSidebarMessage(tabMap, merged, options);
  }
  finally {
    mActiveTransaction = null;
  }
}

// Attach a child tab to a parent tab.
// Handles old parent removal, cycle/self-reference prevention, level updates,
// and sidebar messaging (or accumulation in a transaction).
export function attach(child, parent, options = {}) {
  if (!child || !parent) return;
  if (child.id === parent.id) return;
  if (parent.$TST.ancestorIds.includes(child.id)) return;

  const oldParent = child.$TST.parent;

  // Build tabMap for sidebar
  const tabMap = new Map([[child.id, child], [parent.id, parent]]);
  if (oldParent && oldParent.id !== parent.id)
    tabMap.set(oldParent.id, oldParent);

  // Remove from old parent
  if (oldParent && oldParent.id !== parent.id)
    removeChildFromParent(child.id, oldParent);

  // Add to new parent (deduplicate)
  parent.$TST.children = [...parent.$TST.childIds.filter(id => id !== child.id), child.id];
  parent.$TST.invalidateCache();

  // Update levels
  updateLevels(tabMap);

  // Build sidebar snapshot from current state
  const snapshot = { children: {} };
  if (oldParent && oldParent.id !== parent.id)
    snapshot.children[oldParent.id] = [...oldParent.$TST.childIds];
  snapshot.children[parent.id] = [...parent.$TST.childIds];

  if (!accumulate(tabMap, snapshot))
    sendSidebarMessage(tabMap, snapshot, options);
}

// Detach a child tab from its parent (make it root).
// Handles level updates and sidebar messaging (or accumulation in a transaction).
export function detach(child, options = {}) {
  if (!child) return;
  const parent = child.$TST.parent;
  if (!parent) return;

  const tabMap = new Map([[child.id, child], [parent.id, parent]]);

  // Remove from parent
  removeChildFromParent(child.id, parent);
  child.$TST.parent = null;

  // Update levels
  updateLevels(tabMap);

  // Build sidebar snapshot
  const snapshot = {
    children: { [parent.id]: [...parent.$TST.childIds] },
    detached: [child.id],
  };

  if (!accumulate(tabMap, snapshot))
    sendSidebarMessage(tabMap, snapshot, options);
}

// Merge multiple snapshots into one.
// For children entries with the same parent, last-write-wins.
// Tabs that appear in a children list are removed from detached.
export function mergeSnapshots(snapshots) {
  const mergedChildren = {};
  const mergedDetached = new Set();

  for (const snapshot of snapshots) {
    if (snapshot.children) {
      for (const [pid, cids] of Object.entries(snapshot.children))
        mergedChildren[pid] = cids;
    }
    if (snapshot.detached) {
      for (const tabId of snapshot.detached)
        mergedDetached.add(tabId);
    }
  }

  // Remove tabs from detached if they appear as a child in any children entry
  for (const cid of Object.values(mergedChildren).flat())
    mergedDetached.delete(cid);

  return {
    children: Object.keys(mergedChildren).length > 0 ? mergedChildren : undefined,
    detached: mergedDetached.size > 0 ? [...mergedDetached] : undefined,
  };
}

function removeChildFromParent(childId, parent) {
  parent.$TST.children = parent.$TST.childIds.filter(id => id !== childId);
  parent.$TST.invalidateCache();
}

function accumulate(tabMap, snapshot) {
  if (!mActiveTransaction)
    return false;
  for (const [id, tab] of tabMap)
    mActiveTransaction.tabMap.set(id, tab);
  mActiveTransaction.snapshots.push(snapshot);
  return true;
}

function updateLevels(tabMap) {
  const visited = new Set();
  for (const [, tab] of tabMap) {
    if (visited.has(tab.id)) continue;
    tab.$TST.setAttribute(Constants.kLEVEL, tab.$TST.ancestors.length);
    visited.add(tab.id);
    for (const desc of tab.$TST.descendants) {
      if (visited.has(desc.id)) continue;
      desc.$TST.setAttribute(Constants.kLEVEL, desc.$TST.ancestors.length);
      visited.add(desc.id);
    }
  }
}

function sendSidebarMessage(tabMap, snapshot, options) {
  if (tabMap.size === 0)
    return;
  const windowId = tabMap.values().next().value.windowId;
  SidebarConnection.sendMessage({
    type:      Constants.kCOMMAND_APPLY_TREE_TRANSACTION,
    windowId,
    tabIds:    [...tabMap.keys()],
    children:  snapshot.children ?? {},
    detached:  snapshot.detached ?? [],
    justNow:   !!options.justNow,
  });
}
