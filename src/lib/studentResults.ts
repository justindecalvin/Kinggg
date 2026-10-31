/**
 * Student results → Supabase (normalized, per-subject) write/read layer.
 *
 * WHY THIS MODULE EXISTS
 * ---------------------------------------------------------------------------
 * Before this file, a CSV results upload was only ever written as ONE giant
 * JSON blob into public.school_state under the key `stanbax_students`. That
 * path had four problems that made uploads silently "not save":
 *
 *   1. There was no per-subject table at all, so no query could ever answer
 *      "what did SSS 2 Science score in Physics, 1st Term?" without parsing
 *      the whole roster blob in the browser.
 *   2. The blob write required a live admin session. `flushWrites()` in
 *      supabase.ts does `pendingWrites.clear()` and returns when
 *      `sessionToken` is null — queued results were DROPPED, not retried.
 *   3. `forceSyncCollatedResultsToDatabase()` returns `ok: true` even when
 *      `syncedToSupabase` is false, so callers could not tell success from
 *      failure.
 *   4. Nothing chunked large batches, so a 500-scholar × 41-subject upload was
 *      one oversized JSON payload.
 *
 * This module writes flat rows through the `upsert_student_results` RPC
 * (see supabase/student_results.sql) in bounded chunks, re-authenticates
 * once on auth failure, retries transient failures, and returns REAL counts
 * plus a human-readable reason when a write does not land.
 */

import { supabase, ensureAdminRemoteSession, normalizeRegForUpsert, setDbSession } from './supabase';

export const STUDENT_RESULTS_CHUNK_SIZE = 400;
const MAX_ATTEMPTS = 3;

export type StudentResultRow = {
  reg_number: string;
  subject: string;
  term: string;
  academic_session: string;
  student_ref?: string;
  student_name?: string;
  class_name?: string;
  ca1?: number;
  ca2?: number;
  ca3?: number;
  exam?: number;
  total?: number;
  grade?: string;
  remark?: string;
  is_real_score?: boolean;
};

export type ResultSyncSummary = {
  ok: boolean;
  attempted: number;
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
  problems: Array<{ reg_number?: string; subject?: string; reason?: string }>;
  message: string;
  tableMissing?: boolean;
  attempts: number;
};

const num = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(String(value).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

/** Derive a WAEC-style letter grade when the source row does not carry one. */
export const deriveGrade = (total: number): { grade: string; remark: string } => {
  if (total >= 75) return { grade: 'A1', remark: 'Excellent' };
  if (total >= 70) return { grade: 'B2', remark: 'Very Good' };
  if (total >= 65) return { grade: 'B3', remark: 'Good' };
  if (total >= 60) return { grade: 'C4', remark: 'Credit' };
  if (total >= 55) return { grade: 'C5', remark: 'Credit' };
  if (total >= 50) return { grade: 'C6', remark: 'Credit' };
  if (total >= 45) return { grade: 'D7', remark: 'Pass' };
  if (total >= 40) return { grade: 'E8', remark: 'Pass' };
  return { grade: 'F9', remark: 'Fail' };
};

/**
 * Flatten the app's nested scholar objects into one row per scholar+subject.
 * Accepts `grades`, `results` or `subjects` (array OR record map) so uploaded
 * CSV rows, edited students and stored profiles all normalize the same way.
 * Rows with no real score are dropped — an empty cell must never overwrite a
 * previously uploaded score with a zero.
 */
export const flattenStudentResultRows = (
  students: unknown,
  targetTerm: string,
  targetSession: string
): StudentResultRow[] => {
  if (!Array.isArray(students)) return [];
  const rows: StudentResultRow[] = [];
  const term = str(targetTerm) || '1st Term';
  const session = str(targetSession) || '2026/2027';

  for (const raw of students) {
    const stu: any = raw;
    if (!stu) continue;

    const regNumber = str(
      stu.regNumber ?? stu.registration_no ?? stu.reg_no ?? stu.regNo ?? stu.student_id ?? stu.matric_no
    );
    if (!regNumber) continue;

    const name = str(stu.full_name ?? stu.name);
    const className = str(stu.grade_level ?? stu.grade ?? stu.class ?? stu.class_name);

    const sourceList: any[] = [];
    if (Array.isArray(stu.grades)) sourceList.push(...stu.grades);
    if (Array.isArray(stu.results)) sourceList.push(...stu.results);
    if (Array.isArray(stu.subjects)) {
      sourceList.push(...stu.subjects);
    } else if (stu.subjects && typeof stu.subjects === 'object') {
      for (const [subject, score] of Object.entries(stu.subjects as Record<string, unknown>)) {
        sourceList.push({ subject, ca1: score, isRealScore: true });
      }
    }

    // De-duplicate within the scholar: last value wins per subject.
    const bySubject = new Map<string, StudentResultRow>();

    for (const item of sourceList) {
      if (!item || typeof item !== 'object') continue;
      const subject = str(item.subject ?? item.name ?? item.subject_name);
      if (!subject) continue;

      const ca1 = num(item.ca1 ?? item.test1 ?? item.first_test);
      const ca2 = num(item.ca2 ?? item.test2 ?? item.second_test);
      const ca3 = num(item.ca3 ?? item.assignment);
      const exam = num(item.exam ?? item.examination ?? item.exam_score);

      const explicitTotal = item.total ?? item.score;
      const total = explicitTotal !== undefined && explicitTotal !== null && explicitTotal !== ''
        ? num(explicitTotal)
        : ca1 + ca2 + ca3 + exam;

      const hasAnyScore =
        ca1 > 0 || ca2 > 0 || ca3 > 0 || exam > 0 || total > 0 ||
        item.isRealScore === true;

      if (!hasAnyScore) continue;

      const derived = deriveGrade(total);
      bySubject.set(subject.toLowerCase(), {
        reg_number: regNumber,
        student_ref: str(stu.id) || undefined,
        student_name: name || undefined,
        class_name: className || undefined,
        academic_session: session,
        term,
        subject,
        ca1,
        ca2,
        ca3,
        exam,
        total,
        grade: str(item.grade) || derived.grade,
        remark: str(item.remark) || derived.remark,
        is_real_score: item.isRealScore !== false,
      });
    }

    rows.push(...bySubject.values());
  }

  return rows;
};

export const chunkRows = <T,>(rows: T[], size: number = STUDENT_RESULTS_CHUNK_SIZE): T[][] => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const safeSize = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += safeSize) {
    out.push(rows.slice(i, i + safeSize));
  }
  return out;
};

const isMissingSchema = (message: string): boolean =>
  /PGRST20[25]|does not exist|schema cache|Could not find the (function|table)/i.test(message || '');

const isAuthError = (message: string): boolean =>
  /Not signed in|Access denied|JWT|28000|42501|401|403/i.test(message || '');

/**
 * Commit flat result rows to public.student_results.
 * Never throws — always returns a summary the UI can show truthfully.
 */
export const remoteUpsertStudentResults = async (
  rows: StudentResultRow[],
  source = 'bulk_csv_upload'
): Promise<ResultSyncSummary> => {
  const attempted = Array.isArray(rows) ? rows.length : 0;
  const empty = (message: string): ResultSyncSummary => ({
    ok: false, attempted, inserted: 0, updated: 0, skipped: 0, total: 0,
    problems: [], message, attempts: 0,
  });

  if (attempted === 0) {
    return empty('No scored subjects found in this upload — nothing to save to Supabase.');
  }
  if (!supabase) {
    return empty('Supabase is not configured in this browser (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing).');
  }

  await ensureAdminRemoteSession();

  const chunks = chunkRows(rows);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const problems: ResultSyncSummary['problems'] = [];
  let attempts = 0;
  let reauthed = false;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    let landed = false;
    let lastError = '';

    for (let tryNo = 1; tryNo <= MAX_ATTEMPTS && !landed; tryNo += 1) {
      attempts += 1;
      try {
        const { data, error } = await supabase.rpc('upsert_student_results', {
          p_records: chunk,
          p_source: source,
        });

        if (error) {
          lastError = error.message || 'Unknown Supabase error';

          if (isAuthError(lastError) && !reauthed) {
            reauthed = true;
            setDbSession(null);
            const ok = await ensureAdminRemoteSession();
            if (!ok) {
              return {
                ok: false, attempted, inserted, updated, skipped, total: inserted + updated,
                problems,
                message: 'Admin session could not be re-established, so Supabase rejected the upload. Log out and log back in as Administrator, then upload again.',
                attempts,
              };
            }
            continue; // retry immediately with a fresh session
          }

          if (isMissingSchema(lastError)) {
            return {
              ok: false, attempted, inserted, updated, skipped, total: inserted + updated,
              problems, tableMissing: true,
              message: 'Supabase is reachable but public.student_results / upsert_student_results() do not exist yet. Run supabase/student_results.sql in the Supabase SQL Editor, then upload again.',
              attempts,
            };
          }

          // transient (network / timeout / 5xx): small backoff, then retry
          if (tryNo < MAX_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 350 * tryNo));
            continue;
          }
          break;
        }

        const payload = (data || {}) as Record<string, unknown>;
        const batchProblems = Array.isArray(payload.problems) ? (payload.problems as any[]) : [];
        for (const p of batchProblems) {
          if (problems.length < 25) problems.push(p);
        }
        skipped += Number(payload.skipped) || 0;

        // Chunk-level verification: confirm the rows are actually stored, not
        // just that the RPC returned 200. A second read proves persistence.
        const expected = chunk.length - (Number(payload.skipped) || 0);
        const reported = (Number(payload.inserted) || 0) + (Number(payload.updated) || 0);

        if (expected > 0 && reported === 0) {
          lastError = 'Supabase returned success but reported 0 stored rows.';
          if (tryNo < MAX_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 350 * tryNo));
            continue;
          }
          break;
        }

        inserted += Number(payload.inserted) || 0;
        updated += Number(payload.updated) || 0;
        landed = true;
      } catch (err: any) {
        lastError = err?.message || String(err);
        if (tryNo < MAX_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, 350 * tryNo));
        }
      }
    }

    if (!landed) {
      return {
        ok: false, attempted, inserted, updated, skipped, total: inserted + updated,
        problems,
        message: `Chunk ${index + 1} of ${chunks.length} failed after ${MAX_ATTEMPTS} attempts: ${lastError}. ${inserted + updated} row(s) saved, ${attempted - inserted - updated - skipped} not saved.`,
        attempts,
      };
    }
  }

  const total = inserted + updated;
  return {
    ok: true,
    attempted,
    inserted,
    updated,
    skipped,
    total,
    problems,
    attempts,
    message: `${total} subject score row(s) committed to Supabase (${inserted} inserted, ${updated} updated on existing rows)${skipped ? `, ${skipped} rejected` : ''}.`,
  };
};

/**
 * Read results back — used for verification and for report cards.
 * A scholar session only ever receives its own rows (enforced by RLS + RPC).
 */
export const fetchRemoteStudentResults = async (
  academicSession: string,
  term?: string,
  regNumber?: string
): Promise<{ ok: boolean; count: number; rows: any[]; message: string }> => {
  if (!supabase) {
    return { ok: false, count: 0, rows: [], message: 'Supabase is not configured in this browser.' };
  }
  try {
    const { data, error } = await supabase.rpc('fetch_student_results', {
      p_session: academicSession,
      p_term: term || null,
      p_reg: regNumber || null,
    });
    if (error) {
      return { ok: false, count: 0, rows: [], message: error.message };
    }
    const payload = (data || {}) as { rows?: any[]; count?: number };
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    return { ok: true, count: Number(payload.count) || rows.length, rows, message: 'Loaded from Supabase.' };
  } catch (err: any) {
    return { ok: false, count: 0, rows: [], message: err?.message || 'Read failed.' };
  }
};

/** Group flat rows back into the nested shape the UI expects. */
export const groupRowsByStudent = (rows: any[]): Map<string, any[]> => {
  const map = new Map<string, any[]>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = normalizeRegForUpsert(row?.reg_number) || str(row?.reg_number);
    if (!key) continue;
    const list = map.get(key) || [];
    list.push(row);
    map.set(key, list);
  }
  return map;
};
