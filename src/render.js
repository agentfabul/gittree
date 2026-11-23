import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const TEMPLATE = fileURLToPath(new URL('./viewer.html', import.meta.url));
const STYLES = fileURLToPath(new URL('./viewer.css', import.meta.url));
const STYLE_LINK = '<link rel="stylesheet" href="viewer.css">';

export function renderHtml(model) {
  const json = JSON.stringify(model)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const title = `${model.repo.name} · gitree`.replace(/[<&]/g, '');
  // The CSS lives in its own file for editing, but is inlined here so the
  // generated graph.html stays a single self-contained file.
  const css = fs.readFileSync(STYLES, 'utf8').replace(/<\/style/gi, '<\\/style');
  return fs.readFileSync(TEMPLATE, 'utf8')
    .replace(STYLE_LINK, () => `<style>\n${css}</style>`)
    .replace('__GITREE_TITLE__', () => title)
    .replace('__GITREE_DATA__', () => json);
}
