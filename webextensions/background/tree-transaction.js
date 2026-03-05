// TreeTransaction: Accumulates tree structure snapshots during a callback
// and commits them as a single batched sidebar message.
//
// Usage:
//   await TreeTransaction.run(async () => {
//     await Tree.attachTabTo(tab, parent, opts);
//   }, { justNow: true });

import { mergeSnapshots } from './tree-ops.js';

let mActiveTransaction = null;
let mSendFunction = null;

// Inject the function used to send the final sidebar message.
// Called once during initialization from tree.js.
export function setSendFunction(fn) {
  mSendFunction = fn;
}

// Run a callback inside a transaction. All updateTreeStructure() calls
// within the callback accumulate snapshots instead of sending immediately.
// On successful completion, one merged message is sent to the sidebar.
// On exception, accumulated snapshots are discarded and the error is re-thrown.
export async function run(callback, options = {}) {
  if (mActiveTransaction)
    throw new Error('Nested transaction not supported');
  mActiveTransaction = { snapshots: [], tabMap: new Map() };
  try {
    await callback();
    const { snapshots, tabMap } = mActiveTransaction;
    mActiveTransaction = null;
    if (snapshots.length === 0)
      return;
    const merged = mergeSnapshots(snapshots);
    if (mSendFunction)
      mSendFunction(tabMap, merged, options);
  }
  catch(error) {
    mActiveTransaction = null;
    throw error;
  }
}

// Called from updateTreeStructure() to accumulate a snapshot.
// Returns true if accumulated (caller should skip sending), false if no active transaction.
export function accumulate(tabMap, snapshot) {
  if (!mActiveTransaction)
    return false;
  for (const [id, tab] of tabMap)
    mActiveTransaction.tabMap.set(id, tab);
  mActiveTransaction.snapshots.push(snapshot);
  return true;
}
