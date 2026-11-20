# gitree

Turn any git repository's branch history into an interactive map you can open in a browser, plus a JSON graph and a branch health report.

Branches are drawn as colored lines, commits as stops along them, and merges as interchange points, so you can see at a glance where work split off, where it came back together, and what never made it home.

## Quick start

Requires Node.js 18+ and git. No dependencies to install.

```bash
git clone <your-gitree-repo-url>
cd gitree
npm link            # makes the `gitree` command available everywhere

cd path/to/any/repo
gitree --open
```

Or without linking: `node path/to/gitree/bin/gitree.js path/to/repo --open`

Try it on a generated sample repo first:

```bash
npm run demo
```

## What you get

Running `gitree` writes three files to `gitree-out/` inside the repo:

| File | What it's for |
|---|---|
| `graph.html` | Interactive branch graph. Self-contained, works offline, can be shared or committed. |
| `graph.json` | Every commit with its lane, row, parents, refs and changed files, plus branch status. Useful for scripts or for giving an AI agent the shape of a repo's history. |
| `GIT_REPORT.md` | Branch status vs. the base branch, stale branches, merge-conflict hotspots, and contributors. |

Add `gitree-out/` to the repo's `.gitignore` if you don't want to commit the output.

### In the viewer

- **Graph**: click a commit for its author, parents, children and changed files. Click a branch in the legend to highlight just that line. Press `/` to search, `j`/`k` or arrow keys to step through commits, `Esc` to clear.
- **Branches**: every branch with ahead/behind counts against the base branch and a status of base, active, merged or stale. Click a row to jump to it in the graph.
- **Insights**: weekly activity, the files that change most (and on how many branches), and contributors.
- Links like `graph.html#a1b2c3d` open straight to that commit.

## Options

```
gitree [repo-path] [options]

  -o, --out <dir>        Output folder (default: <repo>/gitree-out)
  -n, --max <count>      Newest commits to read (default: 2000)
  -b, --base <branch>    Branch to compare others against (default: auto)
      --stale-days <n>   Days without commits before a branch is stale (default: 30)
      --no-remotes       Only show local branches
      --open             Open graph.html when done
```

The base branch is detected from `origin/HEAD`, then `main`, `master`, `develop` or `trunk`, then whatever is checked out.

## How it works

1. **Read** (`src/git.js`): one `git log --date-order --numstat` call gets every commit, its parents, refs and file changes. `git for-each-ref` lists branches and `git rev-list --left-right --count` gives ahead/behind.
2. **Assign branches** (`src/layout.js`): walks first-parent chains from each branch tip, base branch first, so every commit belongs to one line. Commits from branches deleted after merging are named from the merge message (`Merge branch 'x'`, `Merge pull request #12 from user/x`).
3. **Lay out lanes** (`src/layout.js`): walks commits newest to oldest, keeping a list of lanes that are each waiting for a specific parent. A commit takes the lane waiting for it (or a free one), its first parent continues that lane, and extra parents of a merge get their own lane. Each edge records which lane it travels down so the viewer can draw it.
4. **Analyze** (`src/analyze.js`): branch status, staleness, file hotspots and contributors.
5. **Render** (`src/render.js`, `src/viewer.html`, `src/report.js`): the data is embedded as JSON in a single HTML file that draws the graph with SVG.

## Ideas for next steps

- Show what each unmerged branch changed compared with base (`git diff base...branch --stat`)
- Virtualized rendering for repos with 20,000+ commits
- Collapse long straight runs of commits on one line
- A `--watch` mode that regenerates on new commits
- Publish to npm so it runs with `npx gitree`

## License

MIT
