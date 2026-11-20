// Builds ./demo-repo: a small project with feature branches, a hotfix,
// merges, a tag, a deleted-after-merge branch, and a stale branch.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = path.resolve('demo-repo');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);

const DAY = 86400000;
let clock = Date.now() - 70 * DAY;
const people = {
  jay: ['Jay Lim', 'jay@example.com'],
  ana: ['Ana Reyes', 'ana@example.com'],
  marco: ['Marco Cruz', 'marco@example.com'],
};

function git(args, who = 'jay', days = 0) {
  clock += days * DAY + 37 * 60000;
  const [name, email] = people[who];
  const date = new Date(clock).toISOString();
  return execFileSync('git', args, {
    cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name,
      GIT_COMMITTER_EMAIL: email, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });
}
function write(file, text) {
  const p = path.join(dir, file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, text + '\n');
}
function commit(msg, files, who, days = 1) {
  for (const f of files) write(f, `// ${msg}`);
  git(['add', '-A'], who);
  git(['commit', '-q', '-m', msg], who, days);
}
const merge = (branch, msg, who = 'jay') => git(['merge', '-q', '--no-ff', '-X', 'theirs', branch, '-m', msg], who, 0.3);
const checkout = (...a) => git(['checkout', '-q', ...a]);

git(['init', '-q', '-b', 'main']);
commit('Initial commit', ['README.md', 'package.json']);
commit('Set up Express server', ['src/server.js', 'src/routes/index.js']);
commit('Add PostgreSQL connection pool', ['src/db.js', 'src/server.js']);

checkout('-b', 'develop');
commit('Add Supabase client', ['src/supabase.js', 'src/db.js'], 'jay');
checkout('-b', 'feature/login');
commit('Login form UI', ['web/Login.tsx', 'web/styles.css'], 'jay');
commit('JWT auth middleware', ['src/auth.js', 'src/server.js'], 'jay');
checkout('develop');
commit('Inventory table schema', ['db/schema.sql', 'src/db.js'], 'ana');
checkout('main');
checkout('-b', 'hotfix/cors');
commit('Fix CORS on production API', ['src/server.js'], 'marco');
checkout('main');
merge('hotfix/cors', "Merge branch 'hotfix/cors'", 'marco');
git(['branch', '-q', '-d', 'hotfix/cors']);
checkout('feature/login');
commit('Refresh token rotation', ['src/auth.js'], 'jay');
checkout('develop');
merge('feature/login', "Merge branch 'feature/login' into develop");
checkout('-b', 'feature/dashboard');
commit('Dashboard charts scaffold', ['web/Dashboard.tsx', 'web/charts.ts'], 'ana');
commit('KPI summary cards', ['web/Dashboard.tsx', 'web/styles.css'], 'ana');
checkout('develop');
merge('main', "Merge branch 'main' into develop");
commit('Daily transaction entry API', ['src/routes/transactions.js', 'src/db.js'], 'ana', 2);
checkout('-b', 'feature/reports');
commit('Monthly billing report export', ['src/reports.js', 'src/db.js'], 'marco');
checkout('develop');
merge('feature/reports', "Merge branch 'feature/reports' into develop", 'marco');
git(['branch', '-q', '-d', 'feature/reports']);
checkout('main');
merge('develop', 'Release v1.0');
git(['tag', 'v1.0']);
checkout('-b', 'experiment/pdf-import');
commit('Try pdf.js for plot plan import', ['web/PdfImport.tsx'], 'jay', 1);
checkout('feature/dashboard');
commit('Date range filters', ['web/Dashboard.tsx', 'web/filters.ts'], 'ana', 26);
checkout('develop');
commit('Return discrepancies endpoint', ['src/routes/returns.js', 'src/server.js'], 'ana', 3);
commit('Fix rounding in billing totals', ['src/reports.js'], 'marco', 2);
checkout('main');
commit('Bump dependencies', ['package.json'], 'marco', 1);
checkout('develop');
console.log(`Demo repo created at ${dir}`);
