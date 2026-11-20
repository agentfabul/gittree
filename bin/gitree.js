#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { repoRoot } from '../src/git.js';
import { buildModel } from '../src/analyze.js';
import { renderHtml } from '../src/render.js';
import { renderReport } from '../src/report.js';

const HELP = `gitree: turn a git repo's branch history into an interactive HTML map

Usage
  gitree [repo-path] [options]

Options
  -o, --out <dir>        Output folder (default: <repo>/gitree-out)
  -n, --max <count>      Newest commits to read (default: 2000)
  -b, --base <branch>    Branch to compare others against (default: auto, e.g. main)
      --stale-days <n>   Days without commits before a branch counts as stale (default: 30)
      --no-remotes       Only show local branches
      --open             Open graph.html in your browser when done
  -h, --help             Show this help

Outputs
  graph.html      Interactive branch graph (open it in any browser, works offline)
  graph.json      Full graph data for scripts and AI agents
  GIT_REPORT.md   Branch status, stale branches, hotspots and contributors
`;

function parseArgs(argv) {
  const o = { repo: '.', out: null, max: 2000, base: null, staleDays: 30, remotes: true, open: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      const v = argv[++i];
      if (v === undefined) fail(`${a} needs a value`);
      return v;
    };
    if (a === '-h' || a === '--help') { process.stdout.write(HELP); process.exit(0); }
    else if (a === '-o' || a === '--out') o.out = val();
    else if (a === '-n' || a === '--max') o.max = posInt(val(), a);
    else if (a === '-b' || a === '--base') o.base = val();
    else if (a === '--stale-days') o.staleDays = posInt(val(), a);
    else if (a === '--no-remotes') o.remotes = false;
    else if (a === '--open') o.open = true;
    else if (a.startsWith('-')) fail(`Unknown option ${a}. Run gitree --help.`);
    else o.repo = a;
  }
  return o;
}

function posInt(v, flag) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) fail(`${flag} must be a positive whole number, got "${v}"`);
  return n;
}

function fail(msg) {
  process.stderr.write(`gitree: ${msg}\n`);
  process.exit(1);
}

function openFile(file) {
  const win = process.platform === 'win32';
  const cmd = win ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = win ? ['/c', 'start', '""', file] : [file];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: win }).unref();
}

const opts = parseArgs(process.argv.slice(2));
try {
  const t0 = Date.now();
  const root = repoRoot(opts.repo);
  const model = buildModel(root, opts);
  const out = path.resolve(opts.out ?? path.join(root, 'gitree-out'));
  fs.mkdirSync(out, { recursive: true });
  const htmlPath = path.join(out, 'graph.html');
  fs.writeFileSync(htmlPath, renderHtml(model));
  fs.writeFileSync(path.join(out, 'graph.json'), JSON.stringify(model, null, 2));
  fs.writeFileSync(path.join(out, 'GIT_REPORT.md'), renderReport(model));

  const s = model.stats;
  console.log(`gitree: ${model.repo.name}`);
  console.log(`  ${s.commits} commits, ${s.branches} branches, ${s.merges} merges, ${s.unmerged} unmerged, ${s.stale} stale`);
  if (model.truncated) console.log(`  Only the newest ${s.commits} commits were read. Use --max to read more.`);
  console.log(`  Wrote ${path.relative(process.cwd(), out) || '.'}${path.sep}graph.html, graph.json, GIT_REPORT.md in ${Date.now() - t0}ms`);
  if (opts.open) openFile(htmlPath);
} catch (err) {
  fail(err.message);
}
