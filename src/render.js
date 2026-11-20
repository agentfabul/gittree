import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const TEMPLATE = fileURLToPath(new URL('./viewer.html', import.meta.url));

export function renderHtml(model) {
  const json = JSON.stringify(model)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const title = `${model.repo.name} · gitree`.replace(/[<&]/g, '');
  return fs.readFileSync(TEMPLATE, 'utf8')
    .replace('__GITREE_TITLE__', () => title)
    .replace('__GITREE_DATA__', () => json);
}
