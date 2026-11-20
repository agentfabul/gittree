import { execFileSync } from 'node:child_process';
import path from 'node:path';

const RS = '\x1e';
const US = '\x1f';

export function git(cwd, args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 512,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    if (allowFail) return null;
    const msg = (err.stderr || err.message || '').toString().trim();
    throw new Error(`git ${args.join(' ')} failed: ${msg}`);
  }
}

export function repoRoot(dir) {
  const out = git(dir, ['rev-parse', '--show-toplevel'], { allowFail: true });
  if (!out) throw new Error(`Not a git repository: ${path.resolve(dir)}`);
  return out.trim();
}

function parseRefs(raw) {
  const refs = { head: false, branches: [], remotes: [], tags: [] };
  if (!raw) return refs;
  for (let part of raw.split(', ')) {
    part = part.trim();
    if (!part) continue;
    if (part.startsWith('HEAD -> ')) {
      refs.head = true;
      refs.branches.push(part.slice(8));
    } else if (part === 'HEAD') {
      refs.head = true;
    } else if (part.startsWith('tag: ')) {
      refs.tags.push(part.slice(5));
    } else if (part.endsWith('/HEAD')) {
      continue;
    } else if (part.includes('/') && isRemoteName(part)) {
      refs.remotes.push(part);
    } else {
      refs.branches.push(part);
    }
  }
  return refs;
}

let remoteNames = [];
function isRemoteName(ref) {
  return remoteNames.some((r) => ref.startsWith(r + '/'));
}

export function readCommits(cwd, { max = 2000, remotes = true } = {}) {
  remoteNames = (git(cwd, ['remote'], { allowFail: true }) || '')
    .split('\n').map((s) => s.trim()).filter(Boolean);

  const fmt = RS + ['%H', '%P', '%an', '%ae', '%aI', '%D', '%s'].join(US) + US;
  const scope = remotes ? ['--branches', '--remotes', '--tags', 'HEAD'] : ['--branches', '--tags', 'HEAD'];
  const out = git(cwd, [
    'log', ...scope, '--date-order', '--numstat', '--no-renames',
    `--max-count=${max}`, `--format=${fmt}`,
  ], { allowFail: true }) || '';

  const commits = [];
  for (const rec of out.split(RS)) {
    if (!rec.trim()) continue;
    const fields = rec.split(US);
    const [hash, parents, author, email, date, refs, subject] = fields;
    const statText = fields.slice(7).join(US);
    const files = [];
    let additions = 0;
    let deletions = 0;
    for (const line of statText.split('\n')) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
      if (!m) continue;
      const add = m[1] === '-' ? 0 : Number(m[1]);
      const del = m[2] === '-' ? 0 : Number(m[2]);
      additions += add;
      deletions += del;
      files.push({ path: m[3], add, del, binary: m[1] === '-' });
    }
    commits.push({
      hash,
      short: hash.slice(0, 7),
      parents: parents ? parents.split(' ').filter(Boolean) : [],
      author,
      email,
      date,
      subject,
      refs: parseRefs(refs),
      files,
      additions,
      deletions,
    });
  }
  return commits;
}

export function readBranches(cwd, { remotes = true } = {}) {
  const fmt = ['%(refname)', '%(refname:short)', '%(objectname)', '%(committerdate:iso-strict)', '%(authorname)'].join(US);
  const scopes = remotes ? ['refs/heads', 'refs/remotes'] : ['refs/heads'];
  const out = git(cwd, ['for-each-ref', `--format=${fmt}`, ...scopes], { allowFail: true }) || '';
  return out.split('\n').filter(Boolean).map((line) => {
    const [ref, name, tip, date, author] = line.split(US);
    return { ref, name, tip, date, author, remote: ref.startsWith('refs/remotes/') };
  }).filter((b) => !b.name.endsWith('/HEAD') && b.name !== 'origin');
}

export function defaultBranch(cwd, branches, override) {
  if (override) return override;
  const sym = git(cwd, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { allowFail: true });
  if (sym) {
    const local = sym.trim().replace(/^origin\//, '');
    if (branches.some((b) => b.name === local)) return local;
    return sym.trim();
  }
  for (const name of ['main', 'master', 'develop', 'trunk']) {
    if (branches.some((b) => b.name === name)) return name;
  }
  const head = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
  return head ? head.trim() : (branches[0]?.name ?? 'HEAD');
}

export function aheadBehind(cwd, base, branch) {
  const out = git(cwd, ['rev-list', '--left-right', '--count', `${base}...${branch}`], { allowFail: true });
  if (!out) return null;
  const [behind, ahead] = out.trim().split(/\s+/).map(Number);
  return { ahead, behind };
}

export function currentBranch(cwd) {
  const out = git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
  return out ? out.trim() : null;
}
