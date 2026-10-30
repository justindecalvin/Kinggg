const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const site = path.resolve(__dirname, '../recovered-site');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const bulkImport = fs.readFileSync(path.join(site, 'bulk-results-import.html'), 'utf8');
const landingSyncSql = fs.readFileSync(path.resolve(__dirname, '../supabase/landing_page_sync.sql'), 'utf8');
const subjectCatalogSql = fs.readFileSync(path.resolve(__dirname, '../supabase/subjects_catalog_sync.sql'), 'utf8');
assert(html.includes('id="root"'), 'The archived application entry point is missing.');
assert(!html.includes('/src/main.tsx'), 'The entry point must reference compiled JavaScript.');
assert(!html.includes('bulk-results-import.html') && !html.includes('Bulk Results Import'), 'The public homepage must not expose the bulk-results importer.');
const appScript = html.match(/src=["'](\/[^"']+\.js)["']/)?.[1];
assert(appScript, 'The compiled application script is missing.');
const appBundle = fs.readFileSync(path.resolve(site, appScript.slice(1)), 'utf8');
assert(appBundle.includes('Bulk Results Import / Fast Score Entry'), 'The admin portal results importer entry is missing.');
assert(appBundle.includes('h(`enter_edit_grades`)||h(`collate_publish_results`)'), 'The importer must be visible to admins authorized to edit or publish results.');
assert(appBundle.includes('__stanbaxLandingSyncInstalled'), 'Automatic landing-content database sync is missing from the deployed app.');
assert(appBundle.includes('stanbax_campus_gallery_photos') && appBundle.includes('stanbax_news_articles'), 'Gallery and news content must be included in landing sync.');
assert(landingSyncSql.includes("('stanbax_campus_gallery_photos', true)"), 'The Supabase migration must expose the app gallery key to the public landing page.');
assert(appBundle.includes('mergeSubjectAvailability') && appBundle.includes('normalizeSubjectCatalog'), 'Subject edits and cloud catalogs must stay synchronized.');
const subjectJson = subjectCatalogSql.match(/\$subject_catalog\$(.*?)\$subject_catalog\$::jsonb/s)?.[1];
assert(subjectJson, 'The Supabase subject-catalog migration payload is missing.');
const subjects = JSON.parse(subjectJson);
assert.equal(subjects.length, 34, 'The project and database must contain the 34 unique source subjects.');
assert.equal(new Set(subjects.map(subject => subject.name.trim().toLowerCase())).size, 34, 'Duplicate subject names must be merged.');
for (const subject of subjects) {
  assert.deepEqual(subject.applicableCategories, subject.applicableLevels, `Availability aliases differ for ${subject.name}.`);
  assert(Object.keys(subject).every(key => ['id', 'name', 'code', 'department', 'description', 'isCore', 'applicableCategories', 'applicableLevels'].includes(key)), 'Only subject metadata may be imported; score fields are forbidden.');
}
assert(appBundle.includes(JSON.stringify(subjects)), 'The deployed default subject catalog must match the Supabase migration.');
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
console.log(`Archived website verified: ${checked} entry-point assets, SPA routing, admin-only results import, and 34-subject catalog sync.`);
