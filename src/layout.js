/**
 * Assigns each commit a row and a lane (column), and works out how every
 * parent edge is routed. Commits must be ordered children-before-parents
 * (git log --date-order or --topo-order guarantees this).
 *
 * Edge routing: an edge leaves the child, runs down `lane`, and joins the
 * parent. The renderer draws: child -> lane (curve over one row if they
 * differ), straight down the lane, then lane -> parent (curve if they differ).
 */
export function layoutGraph(commits) {
  const rowOf = new Map(commits.map((c, i) => [c.hash, i]));
  const lanes = [];
  const edges = [];
  let maxLanes = 0;

  const freeLane = (preferFrom = 0) => {
    for (let i = preferFrom; i < lanes.length; i++) if (lanes[i] === null) return i;
    lanes.push(null);
    return lanes.length - 1;
  };

  commits.forEach((c, row) => {
    c.row = row;
    const waiting = [];
    lanes.forEach((h, i) => { if (h === c.hash) waiting.push(i); });

    let col;
    if (waiting.length) {
      col = waiting[0];
      for (const i of waiting.slice(1)) lanes[i] = null;
    } else {
      col = freeLane();
    }
    c.lane = col;

    const known = c.parents.filter((p) => rowOf.has(p));
    c.truncated = known.length < c.parents.length;

    if (known.length === 0) {
      lanes[col] = null;
    } else {
      lanes[col] = known[0];
      edges.push({ from: c.hash, to: known[0], lane: col, kind: 'first' });
      for (const p of known.slice(1)) {
        let l = lanes.indexOf(p);
        if (l === -1) {
          l = freeLane(col + 1);
          lanes[l] = p;
        }
        edges.push({ from: c.hash, to: p, lane: l, kind: 'merge' });
      }
    }

    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
    maxLanes = Math.max(maxLanes, lanes.length, col + 1);
  });

  return { edges, maxLanes };
}

/**
 * Gives each commit an owning branch by walking first-parent chains from
 * branch tips. The default branch claims first, then the remaining branches
 * by most recent tip. A commit keeps the first branch that reaches it.
 */
export function assignBranches(commits, branches, defaultName) {
  const byHash = new Map(commits.map((c) => [c.hash, c]));
  const order = [...branches].sort((a, b) => {
    const rank = (x) => (x.name === defaultName ? 0 : x.name === `origin/${defaultName}` ? 1 : x.remote ? 3 : 2);
    return rank(a) - rank(b) || new Date(b.date) - new Date(a.date);
  });

  for (const b of order) {
    let c = byHash.get(b.tip);
    while (c && !c.branch) {
      c.branch = b.name;
      c = byHash.get(c.parents[0]);
    }
  }

  // Commits whose branch was deleted after merging: name them from the
  // merge commit's message when possible ("Merge branch 'x'", "Merge pull request #1 from user/x").
  const fpChild = new Map();
  const mergeChild = new Map();
  for (const c of commits) {
    if (c.parents[0] && !fpChild.has(c.parents[0])) fpChild.set(c.parents[0], c);
    for (const p of c.parents.slice(1)) if (!mergeChild.has(p)) mergeChild.set(p, c);
  }
  for (const c of commits) {
    if (c.branch) continue;
    const child = fpChild.get(c.hash);
    if (child && child.deleted) { c.branch = child.branch; c.deleted = true; continue; }
    const merge = mergeChild.get(c.hash);
    c.branch = (merge && branchFromMergeSubject(merge.subject)) || `merged-${c.short}`;
    c.deleted = true;
  }
}

export function branchFromMergeSubject(subject = '') {
  let m = subject.match(/^Merge branch '([^']+)'/);
  if (m) return m[1];
  m = subject.match(/^Merge pull request #\d+ from [^/\s]+\/(\S+)/);
  if (m) return m[1];
  m = subject.match(/^Merge remote-tracking branch '([^']+)'/);
  if (m) return m[1];
  return null;
}
