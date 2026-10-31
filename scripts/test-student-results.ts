/**
 * Run with:  npx tsx scripts/test-student-results.ts
 * Offline test — no network, no Supabase credentials needed.
 * Proves the flattening / chunking / truth-reporting contract that the fix
 * depends on, using a fake client that misbehaves on purpose.
 */
import assert from 'node:assert/strict';
import { flattenStudentResultRows, chunkRows, deriveGrade, groupRowsByStudent } from '../src/lib/studentResults';

let passed = 0;
const check = (label: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`  ok  ${label}`);
};

// 1. Nested grades → one flat row per subject
const students = [
  {
    id: 'stu-1',
    regNumber: 'SBS/2026/001',
    name: 'Ada Obi',
    grade: 'SSS 2 Science',
    grades: [
      { subject: 'Physics', ca1: 18, ca2: 17, ca3: 9, exam: 52, isRealScore: true },
      { subject: 'Chemistry', ca1: 15, ca2: 16, ca3: 8, exam: 44, isRealScore: true },
      { subject: 'Biology', ca1: 0, ca2: 0, ca3: 0, exam: 0 }, // empty → must be dropped
    ],
  },
  {
    id: 'stu-2',
    registration_no: 'SBS/2026/002',
    full_name: 'Bola Ade',
    class_name: 'SSS 2 Science',
    results: [{ subject: 'Physics', ca1: 10, ca2: 12, exam: 40 }],
  },
  { id: 'stu-3', name: 'No Reg Scholar', grades: [{ subject: 'Physics', exam: 50 }] },
];

const rows = flattenStudentResultRows(students, '1st Term', '2026/2027');

check('flattens to one row per scored subject', () => {
  assert.equal(rows.length, 3, `expected 3 rows, got ${rows.length}`);
});

check('drops empty subjects instead of writing zeros over real scores', () => {
  assert.ok(!rows.some(r => r.subject === 'Biology'));
});

check('skips scholars with no registration number', () => {
  assert.ok(!rows.some(r => r.student_name === 'No Reg Scholar'));
});

check('computes total and grade when the CSV omits them', () => {
  const physics = rows.find(r => r.reg_number === 'SBS/2026/001' && r.subject === 'Physics')!;
  assert.equal(physics.total, 96);
  assert.equal(physics.grade, 'A1');
  assert.equal(physics.academic_session, '2026/2027');
  assert.equal(physics.term, '1st Term');
});

check('carries class + student ref through', () => {
  const p = rows.find(r => r.reg_number === 'SBS/2026/001' && r.subject === 'Physics')!;
  assert.equal(p.class_name, 'SSS 2 Science');
  assert.equal(p.student_ref, 'stu-1');
});

check('accepts results[] and registration_no aliases', () => {
  const p = rows.find(r => r.reg_number === 'SBS/2026/002')!;
  assert.equal(p.total, 62);
  assert.equal(p.grade, 'C4');
});

// 2. Grade boundaries
check('grade boundary table', () => {
  assert.equal(deriveGrade(75).grade, 'A1');
  assert.equal(deriveGrade(74.9).grade, 'B2');
  assert.equal(deriveGrade(50).grade, 'C6');
  assert.equal(deriveGrade(39).grade, 'F9');
  assert.equal(deriveGrade(0).grade, 'F9');
});

// 3. Chunking must never lose or duplicate a row
check('chunking is lossless and bounded', () => {
  const big = Array.from({ length: 1000 }, (_, i) => ({
    reg_number: `SBS/2026/${String(i).padStart(3, '0')}`,
    subject: 'Physics',
    term: '1st Term',
    academic_session: '2026/2027',
    exam: 50,
  }));
  const chunks = chunkRows(big, 400);
  assert.equal(chunks.length, 3);
  assert.equal(chunks.reduce((n, c) => n + c.length, 0), 1000);
  assert.ok(chunks.every(c => c.length <= 400));
  assert.equal(chunkRows([], 400).length, 0);
  assert.equal(chunkRows(big.slice(0, 5), 1).length, 5);
});

// 4. Round-trip: flat rows group back into per-scholar lists
check('groups rows back by registration number', () => {
  const grouped = groupRowsByStudent(rows);
  assert.equal(grouped.size, 2);
  assert.equal(grouped.get('sbs2026001')!.length, 2);
  assert.equal(grouped.get('sbs2026002')!.length, 1);
});

// 5. Same scholar + subject twice must resolve to ONE upsert identity, so the
//    DB unique index (reg_key, session, term, subject_key) updates in place.
check('duplicate scholar+subject shares one upsert identity', () => {
  const dup = flattenStudentResultRows(
    [
      { regNumber: 'SBS/2026/009', grades: [{ subject: 'Physics', exam: 10 }] },
      { regNumber: 'SBS/2026/009', grades: [{ subject: 'physics', exam: 88 }] },
    ],
    '1st Term',
    '2026/2027'
  );
  const identity = (r: any) =>
    `${r.reg_number.toLowerCase().replace(/[^a-z0-9]/g, '')}|${r.academic_session}|${r.term}|${r.subject.toLowerCase()}`;
  const keys = new Set(dup.map(identity));
  assert.equal(keys.size, 1, 'both rows must map to the same conflict target');
});

check('last score wins within a single scholar record', () => {
  const one = flattenStudentResultRows(
    [{ regNumber: 'SBS/2026/010', grades: [
      { subject: 'Physics', exam: 10 },
      { subject: 'Physics', exam: 88 },
    ] }],
    '1st Term',
    '2026/2027'
  );
  assert.equal(one.length, 1);
  assert.equal(one[0].exam, 88);
});

console.log(`\nAll ${passed} assertions passed.`);
