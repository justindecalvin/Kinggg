/**
 * Durable backup restore pipeline.
 *
 * The previous Cloud Sync import only wrote the uploaded snapshot into
 * localStorage, then reloaded the page. Supabase was never verified, and the
 * boot-time hydration (`hydrateFromSupabase`) immediately overwrote every
 * stanbax_* key with the stale cloud rows - so the restored data appeared for
 * a few seconds and then vanished.
 *
 * This module makes the restore durable and honest:
 *   1. parse + validate the migration file,
 *   2. write it to localStorage,
 *   3. write it to Supabase (single transactional RPC when deployed, chunked
 *      `put_states` fallback otherwise) with per-key error capture,
 *   4. read the rows back and verify the record counts,
 *   5. arm a short-lived "restore guard" when the cloud write failed so the
 *      boot hydration / live poll cannot clobber the restored data.
 */
import {
  supabase,
  ensureAdminRemoteSession,
  getDbSession,
  resolveStorageKey,
  deduplicateStudentsByRegistration,
} from './supabase';

export const RESTORE_GUARD_KEY = 'stanbax_restore_guard_v1';
export const RESTORE_REPORT_KEY = 'stanbax_last_restore_report_v1';

/** Passwords exported by the app are redacted with a bracketed marker. */
export const PLACEHOLDER_PASSWORD_PATTERN = /^\s*\[.*\]\s*$/;
export const TEMP_STUDENT_PASSWORD = 'Stanbax2026!';

const STORAGE_KEY_TO_FIELD: Record<string, string> = {
  stanbax_school_info: 'schoolInfo',
  stanbax_app_images: 'images',
  stanbax_classes: 'classes',
  stanbax_subjects: 'subjects',
  stanbax_grading_system: 'gradingSystem',
  stanbax_tutors: 'tutors',
  stanbax_students: 'students',
  stanbax_parents_list: 'parents',
  stanbax_homeworks: 'homeworks',
  stanbax_notices: 'notices',
  stanbax_applications: 'applications',
  stanbax_entrance_exam_settings: 'entranceExamSettings',
  stanbax_broadcast_logs: 'broadcastLogs',
  stanbax_inquiries: 'inquiries',
  stanbax_lesson_notes: 'lessonNotes',
  stanbax_notes_enabled: 'notesFeatureEnabled',
  stanbax_assessment_config: 'assessmentConfig',
  stanbax_term_resumption_config: 'termResumptionConfig',
  stanbax_attendance_records: 'attendanceRecords',
  stanbax_cbt_exams: 'cbtExams',
  stanbax_cbt_attempts: 'cbtAttempts',
  stanbax_weekly_timetables: 'timetables',
  stanbax_sickbay_logs: 'sickBayLogs',
  stanbax_parent_consultations: 'consultationRequests',
  stanbax_fee_payments: 'feePayments',
  stanbax_calvin_tokens: 'calvinTokens',
  stanbax_library_books: 'libraryBooks',
  stanbax_proprietress_profile: 'proprietressProfile',
  stanbax_proprietress_appointments: 'appointments',
  stanbax_proprietress_messages: 'messagesToProprietress',
  stanbax_proprietress_directives: 'directives',
  stanbax_faculty_members: 'facultyList',
  stanbax_hero_slides: 'heroSlides',
  stanbax_hero_highlights: 'heroHighlights',
  stanbax_key_pillars: 'keyPillars',
  stanbax_key_pillars_header: 'keyPillarsHeader',
  stanbax_about_content: 'aboutContent',
  stanbax_academic_programs: 'academicPrograms',
  stanbax_featured_courses: 'featuredCourses',
  stanbax_clubs_list: 'clubsList',
  stanbax_house_standings: 'houseStandings',
  stanbax_bus_routes: 'busRoutes',
  stanbax_meal_menu: 'mealMenu',
  stanbax_calendar_events: 'calendarEvents',
  stanbax_testimonials: 'testimonials',
  stanbax_testimonials_header: 'testimonialsHeader',
  stanbax_faq_items: 'faqs',
  stanbax_faq_header: 'faqHeader',
  stanbax_admin_password: 'adminPassword',
  stanbax_proprietress_password: 'proprietressPassword',
  stanbax_admin_security_q: 'adminSecurityQuestion',
  stanbax_admin_security_a: 'adminSecurityAnswer',
  stanbax_school_rep_config: 'schoolRepConfig',
  stanbax_visitor_conversations: 'visitorConversations',
  stanbax_landing_sections: 'landingSections',
  stanbax_deleted_account_ids: 'deletedAccountIds',
};

/** Accept both the app's flat export and a direct school_state row backup. */
const normalizeBackupPayload = (input: Record<string, unknown>): Record<string, unknown> => {
  const rows = Array.isArray(input.rows) ? input.rows : null;
  if (!rows) return input;
  const snapshot: Record<string, unknown> = {};
  rows.forEach((row: any) => {
    if (!row || typeof row.key !== 'string' || row.data === undefined || row.data === null) return;
    snapshot[STORAGE_KEY_TO_FIELD[row.key] || row.key] = row.data;
  });
  if (input.backedUpAt) snapshot.exportedAt = input.backedUpAt;
  if (input.schoolName) snapshot.schoolName = input.schoolName;
  return snapshot;
};

const GUARD_TTL_MS = 30 * 60 * 1000;
const HEAVY_KEYS = ['stanbax_app_images', 'stanbax_gallery_photos', 'stanbax_campus_gallery_photos'];

export interface RestoreGuard {
  at: number;
  reason: string;
  keys: string[];
}

export const readRestoreGuard = (): RestoreGuard | null => {
  try {
    const raw = localStorage.getItem(RESTORE_GUARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RestoreGuard;
    if (!parsed || typeof parsed.at !== 'number') return null;
    if (Date.now() - parsed.at > GUARD_TTL_MS) {
      localStorage.removeItem(RESTORE_GUARD_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const writeRestoreGuard = (reason: string, keys: string[]): void => {
  try {
    localStorage.setItem(
      RESTORE_GUARD_KEY,
      JSON.stringify({ at: Date.now(), reason, keys } as RestoreGuard)
    );
  } catch { /* ignore */ }
};

export const clearRestoreGuard = (): void => {
  try { localStorage.removeItem(RESTORE_GUARD_KEY); } catch { /* ignore */ }
};

export const isRestoreProtectedKey = (key: string): boolean => {
  const guard = readRestoreGuard();
  if (!guard) return false;
  if (!Array.isArray(guard.keys) || guard.keys.length === 0) return true;
  return guard.keys.includes(key);
};

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

export interface ParsedBackup {
  ok: boolean;
  snapshot: Record<string, unknown>;
  error?: string;
  recognized: string[];
  unknown: string[];
  counts: Record<string, number>;
}

const RECOGNIZED_FIELDS = [
  'schoolInfo', 'images', 'classes', 'subjects', 'gradingSystem', 'tutors', 'students',
  'parents', 'homeworks', 'notices', 'applications', 'entranceExamSettings',
  'broadcastLogs', 'inquiries', 'lessonNotes', 'notesFeatureEnabled', 'assessmentConfig',
  'termResumptionConfig', 'attendanceRecords', 'cbtExams', 'cbtAttempts', 'timetables',
  'sickBayLogs', 'consultationRequests', 'feePayments', 'calvinTokens', 'libraryBooks',
  'proprietressProfile', 'appointments', 'messagesToProprietress', 'directives',
  'facultyList', 'heroSlides', 'heroHighlights', 'keyPillars', 'keyPillarsHeader',
  'aboutContent', 'academicPrograms', 'featuredCourses', 'clubsList', 'houseStandings',
  'busRoutes', 'mealMenu', 'calendarEvents', 'testimonials', 'testimonialsHeader',
  'faqs', 'faqHeader', 'adminPassword', 'proprietressPassword', 'adminSecurityQuestion',
  'adminSecurityAnswer', 'schoolRepConfig', 'visitorConversations', 'landingSections',
  'deletedAccountIds',
];

export const parseBackupJson = (rawText: string): ParsedBackup => {
  const empty: ParsedBackup = { ok: false, snapshot: {}, recognized: [], unknown: [], counts: {} };
  const text = String(rawText || '').replace(/^\uFEFF/, '').trim();
  if (!text) return { ...empty, error: 'The selected file is empty.' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err: any) {
    return { ...empty, error: `This is not a valid JSON backup file (${err?.message || 'parse error'}).` };
  }

  // Tolerate a JSON string that itself contains the JSON payload (double encoded).
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { /* keep as-is */ }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ...empty, error: 'Unrecognised backup format: expected a JSON object at the top level.' };
  }

  const snapshot = normalizeBackupPayload(parsed as Record<string, unknown>);
  const recognized: string[] = [];
  const unknown: string[] = [];
  const counts: Record<string, number> = {};

  Object.keys(snapshot).forEach(key => {
    if (RECOGNIZED_FIELDS.includes(key) || key.startsWith('stanbax_')) {
      recognized.push(key);
      const value = snapshot[key];
      counts[key] = Array.isArray(value) ? value.length : 1;
    } else {
      unknown.push(key);
    }
  });

  if (snapshot.students !== undefined && !Array.isArray(snapshot.students)) {
    return { ...empty, error: 'The "students" section of this backup is not a list, so it cannot be restored.' };
  }

  const hasCollection = recognized.some(key => {
    if (key === 'deletedAccountIds') return false;
    const value = snapshot[key];
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;
  });

  if (!hasCollection) {
    return {
      ...empty,
      recognized,
      unknown,
      counts,
      error: 'This file has no recognisable Stanbax school collections (students, classes, subjects, schoolInfo...).',
    };
  }

  return { ok: true, snapshot, recognized, unknown, counts };
};

// ---------------------------------------------------------------------------
// Snapshot -> school_state items
// ---------------------------------------------------------------------------

export interface StateItem {
  key: string;
  data: unknown;
}

export const buildStateItems = (snapshot: Record<string, unknown>): StateItem[] => {
  const items: StateItem[] = [];
  const seen = new Set<string>();

  Object.entries(snapshot).forEach(([field, value]) => {
    if (value === undefined || value === null) return;
    if (field === 'version' || field === 'schoolName' || field === 'exportedAt') return;
    const key = resolveStorageKey(field);
    if (!key.startsWith('stanbax_') || seen.has(key)) return;
    seen.add(key);
    items.push({ key, data: value });
  });

  return items;
};

export const buildExpectedCounts = (items: StateItem[]): Record<string, number | null> => {
  const expected: Record<string, number | null> = {};
  items.forEach(item => {
    if (Array.isArray(item.data)) expected[item.key] = item.data.length;
    else expected[item.key] = null; // presence only
  });
  return expected;
};

/**
 * Write the snapshot into this browser's localStorage.
 * `students` is de-duplicated exactly like the rest of the app expects.
 */
export const writeSnapshotToLocalStorage = (
  snapshot: Record<string, unknown>,
  deletedIds?: string[]
): { writtenKeys: string[]; failedKeys: string[] } => {
  const writtenKeys: string[] = [];
  const failedKeys: string[] = [];

  let studentsPayload = snapshot.students;
  if (Array.isArray(studentsPayload)) {
    try {
      studentsPayload = deduplicateStudentsByRegistration(
        studentsPayload as Array<Record<string, any>>,
        new Set((deletedIds || []).map(x => String(x).toLowerCase()))
      );
    } catch {
      studentsPayload = snapshot.students;
    }
  }

  buildStateItems({ ...snapshot, students: studentsPayload }).forEach(item => {
    try {
      const isRawString = typeof item.data === 'string';
      localStorage.setItem(item.key, isRawString ? String(item.data) : JSON.stringify(item.data));
      writtenKeys.push(item.key);
    } catch (err: any) {
      failedKeys.push(item.key);
      console.warn(`[Restore] Could not cache ${item.key} locally:`, err?.message);
    }
  });

  if (Array.isArray(deletedIds)) {
    try {
      localStorage.setItem('stanbax_deleted_account_ids', JSON.stringify(deletedIds));
      if (!writtenKeys.includes('stanbax_deleted_account_ids')) {
        writtenKeys.push('stanbax_deleted_account_ids');
      }
    } catch { /* ignore */ }
  }

  return { writtenKeys, failedKeys };
};

// ---------------------------------------------------------------------------
// Cloud persistence
// ---------------------------------------------------------------------------

export interface RestoreVerificationRow {
  key: string;
  expected: number | null;
  actual: number;
  ok: boolean;
}

export interface RestoreResult {
  ok: boolean;
  cloudOk: boolean;
  verified: boolean;
  written: number;
  writtenKeys: string[];
  failedKeys: string[];
  errors: string[];
  verification: RestoreVerificationRow[];
  credentials: { created: number; preserved: number } | null;
  usedRpc: boolean;
  message: string;
}

const chunk = <T,>(list: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

const tryRestoreRpc = async (
  snapshot: Record<string, unknown>
): Promise<{ attempted: boolean; ok: boolean; data?: any; message?: string }> => {
  if (!supabase) return { attempted: false, ok: false, message: 'Supabase client not configured.' };
  try {
    const { data, error } = await supabase.rpc('restore_backup_snapshot', { p_snapshot: snapshot });
    if (error) {
      const missing =
        error.code === 'PGRST202' ||
        /could not find the function|does not exist|schema cache/i.test(error.message || '');
      if (missing) return { attempted: false, ok: false, message: 'restore_backup_snapshot RPC not deployed' };
      return { attempted: true, ok: false, message: error.message };
    }
    const payload = data as any;
    if (payload && payload.ok === false) {
      return { attempted: true, ok: false, message: payload.message || 'Restore RPC rejected the snapshot.' };
    }
    return { attempted: true, ok: true, data: payload };
  } catch (err: any) {
    return { attempted: true, ok: false, message: err?.message || 'Restore RPC failed.' };
  }
};

const callPutStates = async (
  items: StateItem[]
): Promise<{ ok: boolean; message?: string; needsLogin?: boolean }> => {
  if (!supabase) return { ok: false, message: 'Supabase client not configured.' };
  try {
    const { error } = await supabase.rpc('put_states', { p_items: items });
    if (!error) return { ok: true };
    const notSignedIn = /not signed in|jwt|401|permission denied|access denied/i.test(error.message || '');
    return { ok: false, message: error.message, needsLogin: notSignedIn };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'put_states failed.' };
  }
};

const verifyCloudRestore = async (
  expected: Record<string, number | null>
): Promise<{ verified: boolean; rows: RestoreVerificationRow[]; message?: string }> => {
  const keys = Object.keys(expected);
  if (!supabase || keys.length === 0) return { verified: false, rows: [], message: 'Nothing to verify.' };
  try {
    const { data, error } = await supabase.from('school_state').select('key,data').in('key', keys);
    if (error) return { verified: false, rows: [], message: error.message };

    const byKey = new Map<string, any>();
    (data || []).forEach((row: any) => byKey.set(row.key, row.data));

    const rows: RestoreVerificationRow[] = keys.map(key => {
      const remote = byKey.get(key);
      const expectedCount = expected[key];
      const actual = Array.isArray(remote) ? remote.length : remote === null || remote === undefined ? 0 : 1;
      const ok =
        remote === null || remote === undefined
          ? false
          : expectedCount === null
          ? true
          : actual === expectedCount;
      return { key, expected: expectedCount, actual, ok };
    });

    return { verified: rows.every(r => r.ok), rows };
  } catch (err: any) {
    return { verified: false, rows: [], message: err?.message || 'Verification read failed.' };
  }
};

/**
 * Persist an already-parsed snapshot to Supabase and verify it round-trips.
 * Never throws: every failure is reported so the UI can show it instead of
 * silently reloading into stale data.
 */
export const persistRestoreToSupabase = async (
  snapshot: Record<string, unknown>,
  onProgress?: (stage: string) => void
): Promise<RestoreResult> => {
  const items = buildStateItems(snapshot);
  const expected = buildExpectedCounts(items);
  const allKeys = items.map(i => i.key);

  const base: RestoreResult = {
    ok: false,
    cloudOk: false,
    verified: false,
    written: 0,
    writtenKeys: [],
    failedKeys: [],
    errors: [],
    verification: [],
    credentials: null,
    usedRpc: false,
    message: '',
  };

  if (!supabase) {
    writeRestoreGuard('supabase-not-configured', allKeys);
    return {
      ...base,
      failedKeys: allKeys,
      message:
        'Supabase is not connected in this browser, so the backup was only restored locally. Add your Project URL and anon key in Cloud Sync (or as Netlify env vars) and run the restore again.',
    };
  }

  onProgress?.('Signing in to Supabase as Administrator...');
  if (!getDbSession()) {
    await ensureAdminRemoteSession();
  }

  // Preferred path: one transactional server-side restore.
  onProgress?.('Restoring every collection into PostgreSQL...');
  const rpc = await tryRestoreRpc(snapshot);
  let cloudOk = false;
  let writtenKeys: string[] = [];
  let failedKeys: string[] = [];
  const errors: string[] = [];
  let usedRpc = false;
  let credentials: { created: number; preserved: number } | null = null;

  if (rpc.attempted && rpc.ok) {
    usedRpc = true;
    cloudOk = true;
    writtenKeys = allKeys.slice();
    const created = Number((rpc.data && (rpc.data.credentials_created ?? rpc.data.credentialsCreated)) || 0);
    const preserved = Number((rpc.data && (rpc.data.credentials_preserved ?? rpc.data.credentialsPreserved)) || 0);
    credentials = { created, preserved };
  } else {
    if (rpc.attempted && rpc.message) errors.push(`restore_backup_snapshot: ${rpc.message}`);

    // Fallback: chunked put_states with an explicit re-login retry.
    onProgress?.('Writing collections in batches...');
    const priorityOrder = [
      'stanbax_students', 'stanbax_classes', 'stanbax_subjects', 'stanbax_tutors',
      'stanbax_parents_list', 'stanbax_grading_system', 'stanbax_assessment_config',
      'stanbax_school_info', 'stanbax_deleted_account_ids', 'stanbax_term_resumption_config',
    ];
    const ordered = [
      ...items.filter(i => priorityOrder.includes(i.key)).sort(
        (a, b) => priorityOrder.indexOf(a.key) - priorityOrder.indexOf(b.key)
      ),
      ...items.filter(i => !priorityOrder.includes(i.key) && !HEAVY_KEYS.includes(i.key)),
      ...items.filter(i => HEAVY_KEYS.includes(i.key)),
    ];

    for (const batch of chunk(ordered, 3)) {
      let res = await callPutStates(batch);
      if (!res.ok && res.needsLogin) {
        await ensureAdminRemoteSession();
        res = await callPutStates(batch);
      }
      if (res.ok) {
        writtenKeys.push(...batch.map(i => i.key));
      } else {
        failedKeys.push(...batch.map(i => i.key));
        if (res.message) errors.push(`${batch.map(i => i.key).join(', ')}: ${res.message}`);
      }
    }

    cloudOk = failedKeys.length === 0 && writtenKeys.length > 0;
  }

  onProgress?.('Verifying what PostgreSQL actually stored...');
  const verification = await verifyCloudRestore(expected);
  if (verification.message) errors.push(`verify: ${verification.message}`);

  if (!verification.verified) {
    failedKeys = Array.from(
      new Set([
        ...failedKeys,
        ...verification.rows.filter(r => !r.ok).map(r => r.key),
      ])
    );
    cloudOk = false;
  }

  const verified = verification.verified;

  if (cloudOk && verified) {
    clearRestoreGuard();
  } else {
    writeRestoreGuard('cloud-restore-incomplete', allKeys);
  }

  const studentsItem = items.find(i => i.key === 'stanbax_students');
  const studentCount = Array.isArray(studentsItem?.data) ? (studentsItem!.data as unknown[]).length : 0;

  const message = cloudOk && verified
    ? usedRpc
      ? `Restore verified in Supabase: ${studentCount} scholars and ${writtenKeys.length} collections now match the backup exactly.`
      : `Restore verified in Supabase: ${writtenKeys.length} collections written and read back successfully.`
    : `Only the browser copy could be restored. Supabase rejected ${failedKeys.length || 'some'} collection(s).${
        errors[0] ? ` Reason: ${errors[0]}` : ''
      }`;

  const result: RestoreResult = {
    ok: cloudOk && verified,
    cloudOk,
    verified,
    written: writtenKeys.length,
    writtenKeys,
    failedKeys,
    errors,
    verification: verification.rows,
    credentials,
    usedRpc,
    message,
  };

  try {
    localStorage.setItem(RESTORE_REPORT_KEY, JSON.stringify({ at: Date.now(), ...result }));
  } catch { /* ignore */ }

  return result;
};

/** Read the report written by the most recent restore (survives the reload). */
export const readLastRestoreReport = (): RestoreResult | null => {
  try {
    const raw = localStorage.getItem(RESTORE_REPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RestoreResult & { at?: number };
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...parsed, verification: Array.isArray(parsed.verification) ? parsed.verification : [] };
  } catch {
    return null;
  }
};

/** Convenience: is a placeholder (redacted) password we must not use as a real login? */
export const isPlaceholderPassword = (value: unknown): boolean =>
  typeof value !== 'string' || value.trim() === '' || PLACEHOLDER_PASSWORD_PATTERN.test(value);
