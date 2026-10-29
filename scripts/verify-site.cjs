const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const site = path.resolve(__dirname, '../recovered-site');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
assert(html.includes('id="root"'), 'The archived application entry point is missing.');
assert(!html.includes('/src/main.tsx'), 'The entry point must reference compiled JavaScript.');

let checked = 0;
for (const match of html.matchAll(/(?:src|href)=["'](\/[^"']+)["']/g)) {
  const relative = decodeURIComponent(match[1].split(/[?#]/)[0]).replace(/^\/+/, '');
  const target = path.resolve(site, relative);
  assert(target.startsWith(site + path.sep), 'Invalid asset path.');
  assert(fs.statSync(target).isFile(), 'An entry-point asset is missing.');
  assert(fs.statSync(target).size > 0, 'An entry-point asset is empty.');
  checked++;
}
assert(checked >= 2, 'The compiled JavaScript and stylesheet must both be present.');
assert(fs.readFileSync(path.join(site, '_redirects'), 'utf8').includes('/index.html'), 'SPA fallback is missing.');
console.log(`Archived website verified: ${checked} entry-point assets and SPA routing.`);
