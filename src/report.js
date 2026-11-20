const d = (iso) => iso.slice(0, 10);
const esc = (s) => String(s).replace(/\|/g, '\\|');

export function renderReport(m) {
  const s = m.stats;
  const L = [];
  L.push(`# Git report: ${m.repo.name}`, '');
  L.push(`Generated ${d(m.generatedAt)} by gitree. Base branch: \`${m.repo.base}\`. Checked out: \`${m.repo.head ?? 'detached'}\`.`, '');
  if (m.truncated) L.push(`> Only the newest ${s.commits} commits were read. Run with \`--max\` to include more.`, '');

  L.push('## Summary', '');
  L.push(`- ${s.commits} commits from ${d(s.firstCommit)} to ${d(s.lastCommit)}`);
  L.push(`- ${s.branches} branches, ${s.unmerged} not merged into \`${m.repo.base}\`, ${s.stale} stale (no commits in ${m.options.staleDays}+ days)`);
  L.push(`- ${s.merges} merge commits, ${s.tags} tags, ${s.contributors} contributors`, '');

  const attention = m.branches.filter((b) => b.stale || (!b.isBase && !b.merged && b.behind > 50));
  if (attention.length) {
    L.push('## Needs attention', '');
    for (const b of attention) {
      const why = [];
      if (b.stale) why.push(`no commits for ${b.ageDays} days`);
      if (b.behind > 50) why.push(`${b.behind} commits behind \`${m.repo.base}\`, merge will likely conflict`);
      L.push(`- \`${b.name}\`: ${why.join('; ')}`);
    }
    L.push('');
  }

  L.push('## Branches', '');
  L.push(`| Branch | Status | Ahead | Behind | Last commit | Author |`, `|---|---|---:|---:|---|---|`);
  for (const b of m.branches) {
    L.push(`| \`${esc(b.name)}\` | ${b.status} | ${b.ahead ?? '?'} | ${b.behind ?? '?'} | ${d(b.lastCommit)} (${b.ageDays}d ago) | ${esc(b.lastAuthor)} |`);
  }
  L.push('');

  if (m.hotspots.length) {
    L.push('## Hotspots', '', 'Files that change most often. Files touched on several branches are the likeliest merge-conflict spots.', '');
    L.push('| File | Commits | Branches | Lines changed |', '|---|---:|---:|---:|');
    for (const f of m.hotspots.slice(0, 15)) L.push(`| \`${esc(f.path)}\` | ${f.commits} | ${f.branches} | ${f.churn} |`);
    L.push('');
  }

  L.push('## Contributors', '', '| Name | Commits | Lines added | Lines removed | Active |', '|---|---:|---:|---:|---|');
  for (const c of m.contributors.slice(0, 20)) L.push(`| ${esc(c.name)} | ${c.commits} | ${c.add} | ${c.del} | ${d(c.first)} to ${d(c.last)} |`);
  L.push('');

  if (m.tags.length) {
    L.push('## Tags', '');
    for (const t of m.tags.slice(0, 30)) L.push(`- \`${t.name}\` at ${t.short} (${d(t.date)})`);
    L.push('');
  }
  return L.join('\n');
}
