const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const site = path.resolve(__dirname, '../recovered-site');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const bulkImport = fs.readFileSync(path.join(site, 'bulk-results-import.html'), 'utf8');
assert(html.includes('id="root"'), 'The archived application entry point is missing.');
assert(!html.includes('/src/main.tsx'), 'The entry point must reference compiled JavaScript.');
assert(!html.includes('bulk-results-import.html') && !html.includes('Bulk Results Import'), 'The public homepage must not expose the bulk-results importer.');
const appScript = html.match(/src=["'](\/[^"']+\.js)["']/)?.[1];
assert(appScript, 'The compiled application script is missing.');
const appBundle = fs.readFileSync(path.resolve(site, appScript.slice(1)), 'utf8');
assert(appBundle.includes('Fast Score Entry (Bulk CA/Exam)'), 'The admin portal results importer entry is missing.');
assert(bulkImport.includes('id="file"'), 'The bulk-results file picker is missing.');
assert(bulkImport.includes('Bulk Results Import'), 'The bulk-results import page is incomplete.');
assert(bulkImport.includes('Open Admin Portal to Import Results'), 'The bulk-results page must link to the actual importer.');
assert(bulkImport.includes('Fast Score Entry (Bulk CA/Exam)'), 'The page must tell admins where the actual importer is.');
assert(bulkImport.includes('import audit report'), 'The page must explain where to confirm a completed import.');

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
console.log(`Archived website verified: ${checked} entry-point assets, SPA routing, and admin-only results import entry.`);
