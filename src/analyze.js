import path from 'node:path';
import { readCommits, readBranches, defaultBranch, aheadBehind, currentBranch } from './git.js';
import { layoutGraph, assignBranches } from './layout.js';

const DAY = 86400000;

export function buildModel(root, opts) {
  const { max, remotes, staleDays, base: baseOverride } = opts;
  const commits = readCommits(root, { max, remotes });
  if (!commits.length) throw new Error('No commits found. Is this an empty repository?');

  let branches = readBranches(root, { remotes });
  // A remote branch that just mirrors a local branch at the same commit adds noise.
  const localTips = new Map(branches.filter((b) => !b.remote).map((b) => [b.name, b.tip]));
  branches = branches.filter((b) => {
    if (!b.remote) return true;
    const local = b.name.replace(/^[^/]+\//, '');
    return localTips.get(local) !== b.tip;
  });

  const base = defaultBranch(root, branches, baseOverride);
  assignBranches(commits, branches, base);
  const { edges, maxLanes } = layoutGraph(commits);

  const now = Date.now();
  const byHash = new Map(commits.map((c) => [c.hash, c]));
  const branchInfo = branches.map((b) => {
    const isBase = b.name === base;
    const ab = isBase ? { ahead: 0, behind: 0 } : (branches.length <= 300 ? aheadBehind(root, base, b.ref) : null);
    const ageDays = Math.floor((now - new Date(b.date)) / DAY);
    const merged = !isBase && ab ? ab.ahead === 0 : false;
    const stale = !isBase && !merged && ageDays >= staleDays;
    const commitCount = commits.filter((c) => c.branch === b.name).length;
    return {
      name: b.name,
      remote: b.remote,
      tip: b.tip,
      tipShort: b.tip.slice(0, 7),
      tipSubject: byHash.get(b.tip)?.subject ?? '',
      lastCommit: b.date,
      lastAuthor: b.author,
      ageDays,
      ahead: ab?.ahead ?? null,
      behind: ab?.behind ?? null,
      isBase,
      merged,
      stale,
      status: isBase ? 'base' : merged ? 'merged' : stale ? 'stale' : 'active',
      commitsInView: commitCount,
    };
  }).sort((a, b) => (b.isBase - a.isBase) || new Date(b.lastCommit) - new Date(a.lastCommit));

  // File hotspots: how often each file changes, and across how many branches.
  const files = new Map();
  for (const c of commits) {
    for (const f of c.files) {
      const e = files.get(f.path) || { path: f.path, commits: 0, add: 0, del: 0, branches: new Set() };
      e.commits++;
      e.add += f.add;
      e.del += f.del;
      e.branches.add(c.branch);
      files.set(f.path, e);
    }
  }
  const hotspots = [...files.values()]
    .map((f) => ({ ...f, branches: f.branches.size, churn: f.add + f.del }))
    .sort((a, b) => b.commits - a.commits || b.churn - a.churn)
    .slice(0, 25);

  const people = new Map();
  for (const c of commits) {
    const e = people.get(c.author) || { name: c.author, commits: 0, add: 0, del: 0, first: c.date, last: c.date };
    e.commits++;
    e.add += c.additions;
    e.del += c.deletions;
    if (c.date < e.first) e.first = c.date;
    if (c.date > e.last) e.last = c.date;
    people.set(c.author, e);
  }
  const contributors = [...people.values()].sort((a, b) => b.commits - a.commits);

  const merges = commits.filter((c) => c.parents.length > 1).length;
  const tags = commits.flatMap((c) => c.refs.tags.map((t) => ({ name: t, hash: c.hash, short: c.short, date: c.date })));

  return {
    tool: 'gitree',
    version: 1,
    generatedAt: new Date().toISOString(),
    repo: { name: path.basename(root), path: root, base, head: currentBranch(root) },
    options: { max, remotes, staleDays },
    truncated: commits.length >= max,
    stats: {
      commits: commits.length,
      branches: branchInfo.length,
      merges,
      tags: tags.length,
      contributors: contributors.length,
      unmerged: branchInfo.filter((b) => !b.isBase && !b.merged).length,
      stale: branchInfo.filter((b) => b.stale).length,
      firstCommit: commits[commits.length - 1].date,
      lastCommit: commits[0].date,
    },
    branches: branchInfo,
    tags,
    hotspots,
    contributors,
    graph: { maxLanes, edges },
    commits: commits.map((c) => ({
      hash: c.hash,
      short: c.short,
      parents: c.parents,
      author: c.author,
      email: c.email,
      date: c.date,
      subject: c.subject,
      refs: c.refs,
      branch: c.branch,
      deletedBranch: !!c.deleted,
      row: c.row,
      lane: c.lane,
      truncated: c.truncated || undefined,
      additions: c.additions,
      deletions: c.deletions,
      fileCount: c.files.length,
      files: c.files.slice(0, 60),
    })),
  };
}
