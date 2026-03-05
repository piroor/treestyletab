// TreeOps: Pure functions for computing tree structure snapshot diffs.
// No side effects — operates on a tab map via accessors.

// Tab accessors — absorb the difference between TestTab and real TreeItem
function getParentId(tab) { return tab.$TST ? tab.$TST.parentId : tab.parentId; }
function getChildIds(tab) { return tab.$TST ? tab.$TST.childIds : tab.childIds; }
function getAncestorIds(tab) { return tab.$TST ? tab.$TST.ancestorIds : tab.ancestorIds; }

// Compute the snapshot diff for attaching a child to a parent.
// Returns { children: { [parentId]: [...childIds] } } or {} if no-op.
export function computeAttach(tabs, childId, targetParentId) {
  const child = tabs.get(childId);
  const parent = tabs.get(targetParentId);
  if (!child || !parent) return {};
  if (childId === targetParentId) return {};
  if (getAncestorIds(parent).includes(childId)) return {};

  const children = {};

  // Remove from old parent
  const oldParentId = getParentId(child);
  if (oldParentId !== null && oldParentId !== undefined && oldParentId !== targetParentId) {
    const oldParent = tabs.get(oldParentId);
    if (oldParent)
      children[oldParentId] = getChildIds(oldParent).filter(id => id !== childId);
  }

  // Add to new parent (avoid duplicates)
  children[targetParentId] = [...getChildIds(parent).filter(id => id !== childId), childId];

  return { children };
}

// Compute the snapshot diff for detaching a child (making it root).
// Returns { children: { [parentId]: [...childIds] }, detached: [childId] } or {} if no-op.
export function computeDetach(tabs, childId) {
  const child = tabs.get(childId);
  if (!child) return {};
  const pid = getParentId(child);
  if (pid === null || pid === undefined) return {};
  const parent = tabs.get(pid);
  if (!parent)
    return { detached: [childId] };
  return {
    children: { [pid]: getChildIds(parent).filter(id => id !== childId) },
    detached: [childId],
  };
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
  for (const cids of Object.values(mergedChildren)) {
    for (const cid of cids)
      mergedDetached.delete(cid);
  }

  return {
    children: Object.keys(mergedChildren).length > 0 ? mergedChildren : undefined,
    detached: mergedDetached.size > 0 ? [...mergedDetached] : undefined,
  };
}
