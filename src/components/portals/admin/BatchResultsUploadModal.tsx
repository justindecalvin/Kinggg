import React, { useState, useMemo, useEffect } from 'react';
import { useSchool } from '../../../context/SchoolContext';
import { normalizeRegForUpsert } from '../../../lib/supabase';
import { 
  X, 
  Upload, 
  CheckCircle2, 
  Download, 
  Zap, 
  UserPlus, 
  KeyRound, 
  Layers, 
  Copy, 
  Check, 
  ArrowRight, 
  HelpCircle,
  ShieldCheck,
  FileSpreadsheet,
  Database,
  Sparkles,
  Info,
  RefreshCw
} from '../../RealIcons';

interface BatchResultsUploadModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onNavigateToVault?: () => void;
}

type TabType = 'download_db' | 'upload' | 'migration' | 'templates' | 'guide';

interface ParsedRowPreview {
  studentIdOrReg: string;
  name: string;
  email: string;
  gradeLevel: string;
  isExisting: boolean;
  matchedStudentId?: string;
  matchedStudentName?: string;
  matchedStudentReg?: string;
  subjectsCount: number;
  calculatedAverage: number;
  subjects: Array<{
    subject: string;
    ca1: number;
    ca2: number;
    ca3: number;
    exam: number;
    total: number;
    grade: string;
    remark: string;
  }>;
}

const DEFAULT_CORE_SUBJECTS = [
  'Mathematics',
  'English Language',
  'Basic Science',
  'Social Studies'
];

const COMMON_EXTRA_SUBJECTS = [
  'Computer Studies',
  'Biology',
  'Chemistry',
  'Physics',
  'Civic Education',
  'Agricultural Science',
  'Economics',
  'Literature in English',
  'Yoruba Language'
];

export const BatchResultsUploadModal: React.FC<BatchResultsUploadModalProps> = ({
  isOpen,
  onClose,
  onNavigateToVault
}) => {
  if (isOpen === false) return null;
  const { 
    students, 
    subjects: websiteSubjects,
    addSubject,
    tutors,
    assessmentConfig, 
    batchUpsertStudentResults, 
    calculateGrade, 
    classes,
    schoolInfo,
    exportDatabaseSnapshot,
    importDatabaseSnapshot,
    unifyLocalStorageResultsToDatabase,
    dispatchCollatedResultsToDashboards
  } = useSchool();

  // Build complete, deduplicated list of all subjects created inside the website + tutor/student subjects
  const allWebsiteSubjects = useMemo(() => {
    const seen = new Map<string, string>();
    const addName = (raw?: string) => {
      const trimmed = (raw || '').trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, trimmed);
      }
    };

    // 1. Primary: All subjects created/configured inside the website (AdminSubjectsGradingTab / SchoolContext)
    (websiteSubjects || []).forEach(s => addName(s?.name));

    // 2. Any subjects assigned to tutors
    (tutors || []).forEach(t => {
      (t?.assignedSubjects || []).forEach(sub => addName(sub));
    });

    // 3. Any subjects already recorded in enrolled students' gradebooks
    (students || []).forEach(st => {
      (st?.grades || []).forEach(g => addName(g?.subject));
    });

    // 4. Fallback defaults if not already present
    DEFAULT_CORE_SUBJECTS.forEach(addName);
    COMMON_EXTRA_SUBJECTS.forEach(addName);

    return Array.from(seen.values());
  }, [websiteSubjects, tutors, students]);

  // Primary website subject names (created in Subjects & Grading)
  const createdWebsiteSubjectNames = useMemo(() => {
    const seen = new Map<string, string>();
    (websiteSubjects || []).forEach(s => {
      const trimmed = (s?.name || '').trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.set(trimmed.toLowerCase(), trimmed);
      }
    });
    if (seen.size === 0) {
      allWebsiteSubjects.forEach(s => seen.set(s.toLowerCase(), s));
    }
    return Array.from(seen.values());
  }, [websiteSubjects, allWebsiteSubjects]);

  // Navigation tab (defaults to download_db so teachers can first download their students database or enter 1st & 2nd tests)
  const [activeTab, setActiveTab] = useState<TabType>('download_db');

  // Term & Session settings
  const [selectedTerm, setSelectedTerm] = useState<'1st Term' | '2nd Term' | '3rd Term'>(
    (assessmentConfig.activeTerm as any) || '1st Term'
  );
  const [selectedSession, setSelectedSession] = useState<string>(
    assessmentConfig.activeSession || '2026/2027'
  );
  const [defaultGradeFallback, setDefaultGradeFallback] = useState<string>('SSS 1 Science');

  // =========================================================================
  // TAB 1 STATE: DATABASE DOWNLOAD & INTERACTIVE 1ST / 2ND TEST SPACES
  // =========================================================================
  const [dbClassFilter, setDbClassFilter] = useState<string>('all');
  // Default to 'split_tests' so every subject has explicit 1st Test and 2nd Test spaces/columns
  const [dbLayoutMode, setDbLayoutMode] = useState<'single_column' | 'split_tests'>('split_tests');
  const [dbSelectedSubjects, setDbSelectedSubjects] = useState<string[]>(() =>
    createdWebsiteSubjectNames.length > 0 ? createdWebsiteSubjectNames : allWebsiteSubjects
  );
  const [dbCustomSubjectInput, setDbCustomSubjectInput] = useState<string>('');
  const [dbIncludeCurrentScores, setDbIncludeCurrentScores] = useState<boolean>(true);
  const [dbIncludeLoginsAndParents, setDbIncludeLoginsAndParents] = useState<boolean>(true);
  const [dbCopiedToClipboard, setDbCopiedToClipboard] = useState<boolean>(false);

  // Interactive 1st & 2nd test score edits keyed by `${studentId}::${subjectLower}`
  const [inlineTestEdits, setInlineTestEdits] = useState<Record<string, { ca1?: string; ca2?: string }>>({});
  const [isSavingInlineTests, setIsSavingInlineTests] = useState<boolean>(false);
  const [inlineSaveBanner, setInlineSaveBanner] = useState<string | null>(null);
  const [uploadErrorBanner, setUploadErrorBanner] = useState<string | null>(null);
  const [replaceEntireRosterOnUpload, setReplaceEntireRosterOnUpload] = useState<boolean>(false);
  const [autoPublishToPortals, setAutoPublishToPortals] = useState<boolean>(true);
  const [isPublishingLive, setIsPublishingLive] = useState<boolean>(false);
  const [migrationBanner, setMigrationBanner] = useState<string | null>(null);
  const migrationJsonInputRef = React.useRef<HTMLInputElement | null>(null);

  // Automatically sync any newly created website subjects into dbSelectedSubjects
  const syncedWebsiteSubjectsRef = React.useRef<Set<string>>(new Set(createdWebsiteSubjectNames.map(s => s.toLowerCase())));
  useEffect(() => {
    const newlyAdded: string[] = [];
    createdWebsiteSubjectNames.forEach(sub => {
      const key = sub.toLowerCase();
      if (!syncedWebsiteSubjectsRef.current.has(key)) {
        syncedWebsiteSubjectsRef.current.add(key);
        newlyAdded.push(sub);
      }
    });
    if (newlyAdded.length > 0) {
      setDbSelectedSubjects(prev => {
        const existingLower = new Set(prev.map(s => s.toLowerCase()));
        const toAppend = newlyAdded.filter(s => !existingLower.has(s.toLowerCase()));
        return toAppend.length > 0 ? [...prev, ...toAppend] : prev;
      });
    }
  }, [createdWebsiteSubjectNames]);

  // Filter and deduplicate students by registration number for database export
  const exportStudents = useMemo(() => {
    const seenRegs = new Set<string>();
    return students.filter(s => {
      if (!s || s.isUpgradedTutor) return false;
      if (dbClassFilter !== 'all' && s.grade?.toLowerCase().trim() !== dbClassFilter.toLowerCase().trim()) {
        return false;
      }
      const regKey = normalizeRegForUpsert(s.regNumber || s.id);
      if (regKey) {
        if (seenRegs.has(regKey)) return false;
        seenRegs.add(regKey);
      }
      return true;
    });
  }, [students, dbClassFilter]);

  // Helper to get current or edited 1st & 2nd test score for a student + subject
  const getStudentSubjectTestScores = (st: (typeof students)[number], subjectName: string): { ca1: string; ca2: string } => {
    const editKey = `${st.id}::${subjectName.toLowerCase()}`;
    const edited = inlineTestEdits[editKey];
    const foundGrade = Array.isArray(st.grades)
      ? st.grades.find(g => g.subject?.trim().toLowerCase() === subjectName.trim().toLowerCase())
      : undefined;

    const baseCa1 = dbIncludeCurrentScores && foundGrade?.ca1 !== undefined && foundGrade.ca1 !== null
      ? String(foundGrade.ca1)
      : '';
    const baseCa2 = dbIncludeCurrentScores && foundGrade?.ca2 !== undefined && foundGrade.ca2 !== null
      ? String(foundGrade.ca2)
      : '';

    return {
      ca1: edited?.ca1 !== undefined ? edited.ca1 : baseCa1,
      ca2: edited?.ca2 !== undefined ? edited.ca2 : baseCa2,
    };
  };

  const handleInlineTestScoreChange = (
    studentId: string,
    subjectName: string,
    field: 'ca1' | 'ca2',
    value: string
  ) => {
    const editKey = `${studentId}::${subjectName.toLowerCase()}`;
    setInlineTestEdits(prev => ({
      ...prev,
      [editKey]: {
        ...prev[editKey],
        [field]: value,
      },
    }));
    if (inlineSaveBanner) setInlineSaveBanner(null);
  };

  // Save inline 1st & 2nd test edits directly via batchUpsertStudentResults (upserts by regNumber)
  const handleSaveInlineTestScores = async () => {
    if (isSavingInlineTests) return;
    setIsSavingInlineTests(true);
    setInlineSaveBanner(null);

    try {
      const recordsToUpsert: any[] = [];
      exportStudents.forEach(st => {
        const subjectResults: Array<{ subject: string; ca1: number; ca2: number }> = [];
        dbSelectedSubjects.forEach(sub => {
          const editKey = `${st.id}::${sub.toLowerCase()}`;
          const editObj = inlineTestEdits[editKey];
          if (!editObj || (editObj.ca1 === undefined && editObj.ca2 === undefined)) return;

          const scores = getStudentSubjectTestScores(st, sub);
          if (scores.ca1 === '' && scores.ca2 === '') return;

          subjectResults.push({
            subject: sub,
            ca1: Number(scores.ca1) || 0,
            ca2: Number(scores.ca2) || 0,
          });
        });

        if (subjectResults.length > 0) {
          recordsToUpsert.push({
            registration_no: st.regNumber,
            student_id: st.regNumber,
            regNumber: st.regNumber,
            id: st.id,
            full_name: st.name,
            email: st.email,
            grade_level: st.grade,
            results: subjectResults,
          });
        }
      });

      if (recordsToUpsert.length === 0) {
        setInlineSaveBanner('Enter or modify at least one 1st Test or 2nd Test score in the table below before saving.');
        setIsSavingInlineTests(false);
        return;
      }

      const res = await batchUpsertStudentResults(
        recordsToUpsert,
        selectedTerm,
        selectedSession,
        { assessmentMode: 'tests_only' }
      );
      if (autoPublishToPortals) {
        await dispatchCollatedResultsToDashboards(dbClassFilter === 'all' ? 'all' : dbClassFilter);
      }
      setInlineTestEdits({});
      setInlineSaveBanner(
        `Saved & published 1st & 2nd Test scores live to portals for ${res.updatedCount} existing scholar(s) without creating duplicates.`
      );
    } catch (err: any) {
      setInlineSaveBanner(`Could not save test scores: ${err?.message || 'Unexpected error'}`);
    } finally {
      setIsSavingInlineTests(false);
    }
  };

  // Publish all current browser results, edited students (e.g. 88 scholars), logins & subjects live to cloud & portals
  const handlePublishEverythingLiveNow = async () => {
    if (isPublishingLive) return;
    setIsPublishingLive(true);
    setMigrationBanner(null);
    try {
      const unifyRes = await unifyLocalStorageResultsToDatabase();
      const pubRes = await dispatchCollatedResultsToDashboards('all');
      setMigrationBanner(
        `LIVE SYNC COMPLETE: ${exportStudents.length} edited scholars, student logins, ${allWebsiteSubjects.length} subjects, and ${pubRes.dispatchedCount} results are now live across all browsers and Student/Parent Portals! (${unifyRes.message})`
      );
    } catch (err: any) {
      setMigrationBanner(`Live publish error: ${err?.message || 'Could not reach cloud server'}`);
    } finally {
      setIsPublishingLive(false);
    }
  };

  // Export complete JSON migration package (edited students, logins, created subjects, classes, results)
  const handleDownloadFullMigrationJson = () => {
    try {
      const jsonStr = exportDatabaseSnapshot();
      const timestamp = new Date().toISOString().split('T')[0];
      downloadTextFile(
        jsonStr,
        `Stanbax_Complete_Migration_${exportStudents.length}_Scholars_Logins_Subjects_${timestamp}.json`,
        'application/json;charset=utf-8;'
      );
      setMigrationBanner(
        `Downloaded Complete Migration Package (.json) containing ${exportStudents.length} edited scholars, all student logins/passwords, and ${websiteSubjects.length} website subjects.`
      );
    } catch (err: any) {
      setMigrationBanner(`Export failed: ${err?.message || 'Unexpected error'}`);
    }
  };

  // Import complete JSON migration package on a new hosting provider or browser
  const handleImportFullMigrationJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const content = event.target?.result as string;
        const res = await importDatabaseSnapshot(content);
        if (res.success) {
          setMigrationBanner(`${res.message} Publishing live to all portals...`);
          await unifyLocalStorageResultsToDatabase();
          await dispatchCollatedResultsToDashboards('all');
          setMigrationBanner(`${res.message} All restored students, logins, subjects, and results are now live!`);
        } else {
          setMigrationBanner(res.message);
        }
      } catch (err: any) {
        setMigrationBanner(`Failed to import migration file: ${err?.message || 'Invalid JSON'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // CSV escape helper
  const escapeCsv = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  // Generate downloadable CSV string for enrolled scholars (includes password & parent fields when dbIncludeLoginsAndParents is enabled)
  const generatedDatabaseCsv = useMemo(() => {
    const lines: string[] = [];
    const baseHeaders = dbIncludeLoginsAndParents
      ? ['registration_no', 'full_name', 'grade_level', 'password', 'parent_name', 'parent_phone']
      : ['registration_no', 'full_name', 'grade_level'];

    if (dbLayoutMode === 'single_column') {
      const headers = [...baseHeaders, ...dbSelectedSubjects];
      lines.push(headers.map(escapeCsv).join(','));

      exportStudents.forEach(st => {
        const row = dbIncludeLoginsAndParents
          ? [
              st.regNumber || st.id,
              st.name,
              st.grade || 'SSS 1 Science',
              st.password || 'stanbax2025',
              st.parentName || '',
              st.parentPhone || ''
            ]
          : [
              st.regNumber || st.id,
              st.name,
              st.grade || 'SSS 1 Science'
            ];

        dbSelectedSubjects.forEach(sub => {
          const { ca1, ca2 } = getStudentSubjectTestScores(st, sub);
          if (ca1 !== '' || ca2 !== '') {
            row.push(`${ca1 || 0}/${ca2 || 0}`);
          } else {
            row.push('');
          }
        });

        lines.push(row.map(escapeCsv).join(','));
      });
    } else {
      const headers = [...baseHeaders];
      dbSelectedSubjects.forEach(sub => {
        headers.push(`${sub} (1st Test)`);
        headers.push(`${sub} (2nd Test)`);
      });
      lines.push(headers.map(escapeCsv).join(','));

      exportStudents.forEach(st => {
        const row = dbIncludeLoginsAndParents
          ? [
              st.regNumber || st.id,
              st.name,
              st.grade || 'SSS 1 Science',
              st.password || 'stanbax2025',
              st.parentName || '',
              st.parentPhone || ''
            ]
          : [
              st.regNumber || st.id,
              st.name,
              st.grade || 'SSS 1 Science'
            ];

        dbSelectedSubjects.forEach(sub => {
          const { ca1, ca2 } = getStudentSubjectTestScores(st, sub);
          row.push(ca1);
          row.push(ca2);
        });

        lines.push(row.map(escapeCsv).join(','));
      });
    }

    return lines.join('\n');
  }, [exportStudents, dbLayoutMode, dbSelectedSubjects, dbIncludeCurrentScores, dbIncludeLoginsAndParents, inlineTestEdits]);

  // Download CSV trigger
  const handleDownloadDatabaseCsv = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const classSlug = dbClassFilter === 'all' ? 'All_Classes' : dbClassFilter.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `stanbax_student_results_template_${classSlug}_${timestamp}.csv`;
    downloadTextFile(generatedDatabaseCsv, filename, 'text/csv;charset=utf-8;');
  };

  // Copy table to clipboard as TSV for immediate paste into Excel or Google Sheets
  const handleCopyDatabaseTable = () => {
    const tsvLines: string[] = [];
    if (dbLayoutMode === 'single_column') {
      const headers = ['registration_no', 'full_name', 'grade_level', ...dbSelectedSubjects];
      tsvLines.push(headers.join('\t'));
      exportStudents.forEach(st => {
        const row = [st.regNumber || st.id, st.name, st.grade || 'SSS 1 Science'];
        dbSelectedSubjects.forEach(sub => {
          const { ca1, ca2 } = getStudentSubjectTestScores(st, sub);
          row.push(ca1 !== '' || ca2 !== '' ? `${ca1 || 0}/${ca2 || 0}` : '');
        });
        tsvLines.push(row.join('\t'));
      });
    } else {
      const headers = ['registration_no', 'full_name', 'grade_level'];
      dbSelectedSubjects.forEach(sub => {
        headers.push(`${sub} (1st Test)`);
        headers.push(`${sub} (2nd Test)`);
      });
      tsvLines.push(headers.join('\t'));
      exportStudents.forEach(st => {
        const row = [st.regNumber || st.id, st.name, st.grade || 'SSS 1 Science'];
        dbSelectedSubjects.forEach(sub => {
          const { ca1, ca2 } = getStudentSubjectTestScores(st, sub);
          row.push(ca1);
          row.push(ca2);
        });
        tsvLines.push(row.join('\t'));
      });
    }

    navigator.clipboard.writeText(tsvLines.join('\n'));
    setDbCopiedToClipboard(true);
    setTimeout(() => setDbCopiedToClipboard(false), 2500);
  };

  const handleAddCustomSubject = () => {
    const trimmed = dbCustomSubjectInput.trim();
    if (!trimmed) return;

    const alreadySelected = dbSelectedSubjects.some(s => s.toLowerCase() === trimmed.toLowerCase());
    if (!alreadySelected) {
      setDbSelectedSubjects(prev => [...prev, trimmed]);
    }

    // Also persist to the website's subjects list if not already present
    const existsInWebsite = (websiteSubjects || []).some(
      s => s.name?.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (!existsInWebsite && typeof addSubject === 'function') {
      const code = trimmed
        .replace(/[^A-Za-z0-9 ]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w.slice(0, 3).toUpperCase())
        .join('')
        .slice(0, 6) || 'SUB101';
      addSubject({
        name: trimmed,
        code: `${code}101`,
        department: 'General',
        isCore: true,
      });
    }

    setDbCustomSubjectInput('');
  };

  const handleToggleSubject = (sub: string) => {
    setDbSelectedSubjects(prev => {
      const exists = prev.some(s => s.toLowerCase() === sub.toLowerCase());
      if (exists) {
        if (prev.length <= 1) return prev; // Keep at least one subject
        return prev.filter(s => s.toLowerCase() !== sub.toLowerCase());
      }
      return [...prev, sub];
    });
  };

  // =========================================================================
  // TAB 2 STATE: UPLOAD & RECONCILIATION
  // =========================================================================
  const [inputText, setInputText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [uploadAssessmentScope, setUploadAssessmentScope] = useState<'tests_only' | 'full'>('full');
  const [singleScoreBehavior, setSingleScoreBehavior] = useState<'split' | 'ca1' | 'ca2'>('split');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);

  // Result / Audit state
  const [auditResult, setAuditResult] = useState<{
    totalProcessed: number;
    updatedCount: number;
    provisionedCount: number;
    message: string;
    auditLogs: Array<{
      name: string;
      regNumber: string;
      status: string;
      subjectsCount: number;
      termAverage: number;
    }>;
  } | null>(null);

  // Resolve a subject header name against website subjects first, then common subjects
  const resolveCanonicalSubjectName = useMemo(() => {
    return (rawHeaderName: string, fallbackIndex?: number): string => {
      const cleaned = rawHeaderName.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleaned) return `Subject ${(fallbackIndex ?? 0) + 1}`;
      const lower = cleaned.toLowerCase();

      // 1. Exact case-insensitive match against website subjects (by name or code)
      for (const ws of websiteSubjects || []) {
        if (ws?.name && ws.name.trim().toLowerCase() === lower) {
          return ws.name.trim();
        }
        if (ws?.code && ws.code.trim().toLowerCase() === lower) {
          return ws.name.trim();
        }
      }

      // 2. Exact case-insensitive match against allWebsiteSubjects or dbSelectedSubjects
      for (const s of [...dbSelectedSubjects, ...allWebsiteSubjects]) {
        if (s.trim().toLowerCase() === lower) {
          return s.trim();
        }
      }

      // 3. Safe shorthand aliases ONLY when the user typed a short code
      if (/^(math|maths|mathematics)$/i.test(cleaned)) return 'Mathematics';
      if (/^(eng|english|english\s*lang|english\s*language)$/i.test(cleaned)) return 'English Language';
      if (/^(b\.?\s*sci|basic\s*sci|basic\s*science)$/i.test(cleaned)) return 'Basic Science';
      if (/^(soc|social\s*stud|social\s*studies)$/i.test(cleaned)) return 'Social Studies';
      if (/^(chem|chemistry)$/i.test(cleaned)) return 'Chemistry';
      if (/^(phy|physics)$/i.test(cleaned)) return 'Physics';
      if (/^(bio|biology)$/i.test(cleaned)) return 'Biology';
      if (/^(comp|ict|computer\s*stud|computer\s*studies)$/i.test(cleaned)) return 'Computer Studies';
      if (/^(civ|civic|civic\s*edu|civic\s*education)$/i.test(cleaned)) return 'Civic Education';
      if (/^(agric|agricultural\s*sci|agricultural\s*science)$/i.test(cleaned)) return 'Agricultural Science';

      // 4. Preserve custom website subject name in clean Title Case / original casing
      return cleaned.replace(/\b\w/g, l => l.toUpperCase());
    };
  }, [websiteSubjects, dbSelectedSubjects, allWebsiteSubjects]);

  // Sample data presets using active website subjects
  const sampleSubjectsSlice = useMemo(() => {
    return (dbSelectedSubjects.length > 0 ? dbSelectedSubjects : allWebsiteSubjects).slice(0, 6);
  }, [dbSelectedSubjects, allWebsiteSubjects]);

  const loadSampleTestsCSV = () => {
    const existingSample = students[0];
    const sampleId = existingSample ? existingSample.regNumber : 'SBS/2026/001';
    const sampleName = existingSample ? existingSample.name : 'Adebayo Oluwaseun';
    const sampleGrade = existingSample?.grade || 'SSS 1 Science';
    const subs = sampleSubjectsSlice;

    const header = ['registration_no', 'full_name', 'grade_level', ...subs].join(',');
    const row1Scores = subs.map((_, idx) => `${10 - (idx % 2)}/${9 + (idx % 2)}`).join(',');
    const row2Scores = subs.map((_, idx) => `${9 - (idx % 2)}/${10 - (idx % 2)}`).join(',');
    const row3Scores = subs.map((_, idx) => `${8 + (idx % 2)}/${8}`).join(',');

    const sample = `${header}
${sampleId},${sampleName},${sampleGrade},${row1Scores}
SBS/2026/NEW01,Chioma Nwachukwu,SSS 1 Science,${row2Scores}
SBS/2026/NEW02,Tunde Bakare,SSS 1 Science,${row3Scores}`;
    setInputText(sample);
    setFileName('student_results_tests_wide.csv');
    setUploadAssessmentScope('tests_only');
  };

  const loadSampleSplitTestsCSV = () => {
    const existingSample = students[0];
    const sampleId = existingSample ? existingSample.regNumber : 'SBS/2026/001';
    const sampleName = existingSample ? existingSample.name : 'Adebayo Oluwaseun';
    const sampleGrade = existingSample?.grade || 'SSS 1 Science';
    const subs = sampleSubjectsSlice;

    const splitHeaders: string[] = ['registration_no', 'full_name', 'grade_level'];
    subs.forEach(s => {
      splitHeaders.push(`${s} (1st Test)`);
      splitHeaders.push(`${s} (2nd Test)`);
    });

    const row1 = subs.flatMap((_, idx) => [String(10 - (idx % 2)), String(9 + (idx % 2))]).join(',');
    const row2 = subs.flatMap((_, idx) => [String(9), String(10 - (idx % 2))]).join(',');
    const row3 = subs.flatMap((_, idx) => [String(8 + (idx % 2)), String(8)]).join(',');

    const sample = `${splitHeaders.join(',')}
${sampleId},${sampleName},${sampleGrade},${row1}
SBS/2026/NEW01,Chioma Nwachukwu,SSS 1 Science,${row2}
SBS/2026/NEW02,Tunde Bakare,SSS 1 Science,${row3}`;
    setInputText(sample);
    setFileName('student_results_split_tests.csv');
    setUploadAssessmentScope('tests_only');
  };

  const loadSampleJSON = () => {
    const existingSample = students[0];
    const sampleId = existingSample ? existingSample.regNumber : 'SBS/2026/001';
    const sampleName = existingSample ? existingSample.name : 'Adebayo Oluwaseun';
    const subs = sampleSubjectsSlice;

    const sampleObj = [
      {
        registration_no: sampleId,
        student_id: sampleId,
        full_name: sampleName,
        email: `${sampleName.toLowerCase().replace(/\s+/g, '')}@stanbaxschools.edu.ng`,
        grade_level: existingSample?.grade || "SSS 1 Science",
        results: subs.map((subject, idx) => ({
          subject,
          ca1: 10 - (idx % 2),
          ca2: 9 + (idx % 2),
          score: 19
        }))
      },
      {
        registration_no: "SBS/2026/NEW03",
        student_id: "SBS/2026/NEW03",
        full_name: "Fatima Aliyu",
        email: "fatima.aliyu@example.com",
        grade_level: "SSS 1 Science",
        parent_name: "Alhaji Ibrahim Aliyu",
        parent_phone: "+234 803 111 2233",
        results: subs.map((subject, idx) => ({
          subject,
          ca1: 9,
          ca2: 9 - (idx % 2),
          score: 18 - (idx % 2)
        }))
      }
    ];
    setInputText(JSON.stringify(sampleObj, null, 2));
    setFileName('student_results_tests.json');
    setUploadAssessmentScope('tests_only');
  };

  // Helper to deduplicate parsed records by registration number (merges subject scores if same regNo appears in multiple rows)
  const mergeParsedRecordsByRegistration = (records: any[]): any[] => {
    const mergedMap = new Map<string, any>();

    records.forEach((rec, idx) => {
      if (!rec) return;
      const rawId = (
        rec.registration_no ||
        rec.reg_no ||
        rec.regNo ||
        rec.regNumber ||
        rec.registration_number ||
        rec.student_id ||
        rec.studentId ||
        rec.matric_no ||
        rec.id ||
        ''
      ).toString().trim();
      const rawName = (rec.full_name || rec.name || '').toString().trim();
      const rawEmail = (rec.email || '').toString().trim();
      const normReg = normalizeRegForUpsert(rawId);

      const key = normReg
        ? `reg:${normReg}`
        : rawEmail
          ? `email:${rawEmail.toLowerCase()}`
          : rawName
            ? `name:${rawName.toLowerCase()}`
            : `row:${idx}`;

      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          ...rec,
          registration_no: rawId || rec.registration_no,
          student_id: rawId || rec.student_id,
          regNumber: rawId || rec.regNumber,
          full_name: rawName || rec.full_name || rec.name,
          email: rawEmail || rec.email,
          results: Array.isArray(rec.results) ? [...rec.results] : [],
        });
      } else {
        const existing = mergedMap.get(key)!;
        const mergedResults = Array.isArray(existing.results) ? [...existing.results] : [];
        const incomingResults = Array.isArray(rec.results) ? rec.results : [];

        incomingResults.forEach((ir: any) => {
          if (!ir || !ir.subject) return;
          const subIdx = mergedResults.findIndex(
            (mr: any) => mr.subject?.trim().toLowerCase() === ir.subject.trim().toLowerCase()
          );
          if (subIdx >= 0) {
            const prevSub = mergedResults[subIdx];
            const ca1 = ir.ca1 !== undefined && ir.ca1 !== 0 ? Number(ir.ca1) : Number(prevSub.ca1 || 0);
            const ca2 = ir.ca2 !== undefined && ir.ca2 !== 0 ? Number(ir.ca2) : Number(prevSub.ca2 || 0);
            const ca3 = ir.ca3 !== undefined && ir.ca3 !== 0 ? Number(ir.ca3) : Number(prevSub.ca3 || 0);
            const exam = ir.exam !== undefined && ir.exam !== 0 ? Number(ir.exam) : Number(prevSub.exam || 0);
            mergedResults[subIdx] = {
              ...prevSub,
              ...ir,
              ca1,
              ca2,
              ca3,
              exam,
              score: (ca1 + ca2 + ca3 + exam) || Number(ir.score || prevSub.score || 0),
            };
          } else {
            mergedResults.push(ir);
          }
        });

        mergedMap.set(key, {
          ...existing,
          ...rec,
          registration_no: rawId || existing.registration_no,
          student_id: rawId || existing.student_id,
          regNumber: rawId || existing.regNumber,
          full_name: rawName || existing.full_name,
          email: rawEmail || existing.email,
          grade_level: rec.grade_level || existing.grade_level,
          results: mergedResults,
        });
      }
    });

    return Array.from(mergedMap.values());
  };

  // Parsing engine: parses CSV, TSV, or JSON into standard raw records (deduplicated by registration number)
  const rawRecords = useMemo(() => {
    const text = inputText.trim();
    if (!text) return [];

    // Try JSON parsing
    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);
        return mergeParsedRecordsByRegistration(arr);
      } catch {}
    }

    // Try Tabular CSV / TSV parsing
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];

    // Detect delimiter: comma, tab, or semicolon
    const headerLine = lines[0];
    let delimiter = ',';
    if (headerLine.includes('\t')) delimiter = '\t';
    else if (headerLine.includes(';') && !headerLine.includes(',')) delimiter = ';';

    const parseLine = (line: string): string[] => {
      if (delimiter === '\t') return line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === delimiter && !inQuotes) {
          result.push(cur.trim().replace(/^"|"$/g, ''));
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim().replace(/^"|"$/g, ''));
      return result;
    };

    const rawHeaders = parseLine(headerLine).map(h => h.trim());
    const headers = rawHeaders.map(h => h.toLowerCase());

    // Priority match for registration number / student ID column (never match S/N or Serial No)
    const isSerialCol = (h: string) =>
      /^(s\/n|sn|s\.n\.?|serial|serial\s*no|serial_no|row|index|#)$/i.test(h.trim());

    let idIdx = headers.findIndex(
      h =>
        !isSerialCol(h) &&
        /^(registration_no|registration_number|reg_no|reg_number|regno|regnumber|reg\s*no\.?|registration\s*no\.?|student_id|student\s*id|scholar_id|scholar\s*id|matric_no|matric\s*no|admission_no|admission\s*no|id)$/i.test(
          h.trim()
        )
    );
    if (idIdx < 0) {
      idIdx = headers.findIndex(
        h => !isSerialCol(h) && /\b(reg\s*no|reg_no|registration|matric|student_id|admission)\b/i.test(h.trim())
      );
    }

    const serialIdx = headers.findIndex(h => isSerialCol(h));
    const nameIdx = headers.findIndex(h =>
      /^(full_name|fullname|full\s*name|student_name|student\s*name|scholar_name|scholar\s*name|name|student|scholar|candidate\s*name|candidate|pupil\s*name)$/i.test(
        h.trim()
      )
    );
    const emailIdx = headers.findIndex(h =>
      /^(email|e-mail|email_address|email\s*address|student_email|student\s*email|mail)$/i.test(h.trim())
    );
    const gradeIdx = headers.findIndex(h =>
      /^(grade_level|grade\s*level|class|class_name|class\s*name|student_class|student\s*class|arm|class\s*arm|level)$/i.test(
        h.trim()
      )
    );
    const passwordIdx = headers.findIndex(
      h => h === 'password' || h === 'student_password' || h === 'student password' || h === 'passcode' || h === 'pin'
    );
    const parentNameIdx = headers.findIndex(h => h.includes('parent') && h.includes('name'));
    const parentPhoneIdx = headers.findIndex(
      h => h.includes('parent') && (h.includes('phone') || h.includes('mobile') || h.includes('login'))
    );

    const parseNumericScore = (rawVal: string | undefined): number => {
      if (rawVal === undefined || rawVal === null) return 0;
      const cleaned = String(rawVal)
        .trim()
        .replace(/%$/, '')
        .replace(/\/\s*\d+(\.\d+)?$/, '')
        .trim();
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    // Check if narrow format: contains "subject" and "score"/"ca1"/"exam" headers
    const subjectIdx = headers.findIndex(h => h === 'subject' || h === 'course' || h === 'subject_name');
    const scoreIdx = headers.findIndex(h => h === 'score' || h === 'total' || h === 'total_score' || h === 'mark');
    const ca1Idx = headers.findIndex(h =>
      /^(ca\s*1|c\.?a\.?\s*1|test\s*1|ca_1|1st\s*test|1st_test|first\s*test|1st\s*ca|t1)$/i.test(h.trim())
    );
    const ca2Idx = headers.findIndex(h =>
      /^(ca\s*2|c\.?a\.?\s*2|test\s*2|ca_2|2nd\s*test|2nd_test|second\s*test|2nd\s*ca|t2)$/i.test(h.trim())
    );
    const ca3Idx = headers.findIndex(h =>
      /^(ca\s*3|c\.?a\.?\s*3|test\s*3|ca_3|3rd\s*test|3rd_test|third\s*test|3rd\s*ca|t3)$/i.test(h.trim())
    );
    const examIdx = headers.findIndex(h =>
      /^(exam|exams|examination|exam_score|exam\s*score|terminal_exam|terminal\s*exam)$/i.test(h.trim())
    );

    if (subjectIdx >= 0 && (scoreIdx >= 0 || ca1Idx >= 0 || ca2Idx >= 0 || examIdx >= 0)) {
      // Narrow format (itemized rows grouped by student registration number)
      const narrowRecords: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length === 0 || cols.every(c => !c)) continue;

        const rawId = idIdx >= 0 ? (cols[idIdx] || '').trim() : '';
        const rawName = nameIdx >= 0 ? (cols[nameIdx] || '').trim() : '';
        const rawEmail = emailIdx >= 0 ? (cols[emailIdx] || '').trim() : '';
        const rawGrade = gradeIdx >= 0 && cols[gradeIdx] ? cols[gradeIdx].trim() : defaultGradeFallback;
        const rawSubName = cols[subjectIdx] || 'General Subject';
        const subName = resolveCanonicalSubjectName(rawSubName);

        const hasCa1 = ca1Idx >= 0 && (cols[ca1Idx] || '').trim() !== '';
        const hasCa2 = ca2Idx >= 0 && (cols[ca2Idx] || '').trim() !== '';
        const hasCa3 = ca3Idx >= 0 && (cols[ca3Idx] || '').trim() !== '';
        const hasExam = (examIdx >= 0 && (cols[examIdx] || '').trim() !== '') || (examIdx < 0 && scoreIdx >= 0 && (cols[scoreIdx] || '').trim() !== '');

        const ca1 = hasCa1 ? parseNumericScore(cols[ca1Idx]) : 0;
        const ca2 = hasCa2 ? parseNumericScore(cols[ca2Idx]) : 0;
        const ca3 = hasCa3 ? parseNumericScore(cols[ca3Idx]) : 0;
        const exam =
          examIdx >= 0 && (cols[examIdx] || '').trim() !== ''
            ? parseNumericScore(cols[examIdx])
            : ca1Idx < 0 && ca2Idx < 0 && scoreIdx >= 0
            ? parseNumericScore(cols[scoreIdx])
            : 0;
        const total = (ca1 + ca2 + ca3 + exam) || (scoreIdx >= 0 ? parseNumericScore(cols[scoreIdx]) : 0);

        narrowRecords.push({
          registration_no: rawId,
          student_id: rawId,
          full_name: rawName,
          email: rawEmail,
          grade_level: rawGrade,
          password: passwordIdx >= 0 ? cols[passwordIdx] : undefined,
          parent_name: parentNameIdx >= 0 ? cols[parentNameIdx] : undefined,
          parent_phone: parentPhoneIdx >= 0 ? cols[parentPhoneIdx] : undefined,
          results: [
            {
              subject: subName,
              ca1,
              ca2,
              ca3,
              exam,
              score: total,
              hasCa1,
              hasCa2,
              hasCa3,
              hasExam,
            }
          ]
        });
      }
      return mergeParsedRecordsByRegistration(narrowRecords);
    }

    // Wide format: parse subject columns (including 1st Test & 2nd Test columns for all website subjects)
    const metadataIndexes = new Set(
      [serialIdx, idIdx, nameIdx, emailIdx, gradeIdx, passwordIdx, parentNameIdx, parentPhoneIdx].filter(i => i >= 0)
    );

    interface SubjectColDef {
      index: number;
      subjectName: string;
      testType: 'ca1' | 'ca2' | 'ca3' | 'exam' | 'composite';
    }

    const colDefs: SubjectColDef[] = [];
    rawHeaders.forEach((rawH, idx) => {
      const h = rawH.toLowerCase().trim();
      if (
        !metadataIndexes.has(idx) &&
        h &&
        !isSerialCol(h) &&
        !['term', 'session', 'gender', 'sex', 'remark', 'remarks', 'total', 'overall_total', 'average', 'term_average', 'position', 'class_position', 'grade'].includes(h)
      ) {
        let testType: SubjectColDef['testType'] = 'composite';
        // Strip trailing weight markers like "(10)", "(20)", "(70)", "[10]", "/10", "10%" first
        const weightStrippedH = rawH
          .replace(/[\(\[]\s*\d+(\.\d+)?\s*%?\s*(?:marks?|pts?|points?)?\s*[\)\]]/gi, '')
          .replace(/\/\s*\d+(\.\d+)?\s*$/g, '')
          .trim();
        let cleanRawName = weightStrippedH;

        const ca1Regex = /(\(\s*(?:1st\s*test|test\s*1|first\s*test|c\.?a\.?\s*1|1st\s*c\.?a\.?|t\s*1)\s*\)|\[(?:1st\s*test|test\s*1|c\.?a\.?\s*1|t1)\]|\b(?:1st\s*test|1st_test|test\s*1|test_1|first\s*test|c\.?a\.?\s*1|ca_1|1st\s*c\.?a\.?|t1)\b)/i;
        const ca2Regex = /(\(\s*(?:2nd\s*test|test\s*2|second\s*test|c\.?a\.?\s*2|2nd\s*c\.?a\.?|t\s*2)\s*\)|\[(?:2nd\s*test|test\s*2|c\.?a\.?\s*2|t2)\]|\b(?:2nd\s*test|2nd_test|test\s*2|test_2|second\s*test|c\.?a\.?\s*2|ca_2|2nd\s*c\.?a\.?|t2)\b)/i;
        const ca3Regex = /(\(\s*(?:3rd\s*test|test\s*3|third\s*test|c\.?a\.?\s*3|3rd\s*c\.?a\.?|t\s*3)\s*\)|\[(?:3rd\s*test|test\s*3|c\.?a\.?\s*3|t3)\]|\b(?:3rd\s*test|3rd_test|test\s*3|test_3|third\s*test|c\.?a\.?\s*3|ca_3|3rd\s*c\.?a\.?|t3)\b)/i;
        const examRegex = /(\(\s*(?:terminal\s*exam(?:ination)?|exam(?:ination)?\s*score|exams?|examination)\s*\)|\[(?:terminal\s*exam|exams?|examination)\]|\b(?:terminal\s*exam(?:ination)?|terminal_exam|exam_score|exam\s*score|exams?|examination)\b)/i;

        if (ca1Regex.test(weightStrippedH)) {
          testType = 'ca1';
          cleanRawName = weightStrippedH
            .replace(ca1Regex, '')
            .replace(/[()_[\]\-–—:]+$/g, '')
            .replace(/^[()_[\]\-–—:]+/g, '')
            .trim();
        } else if (ca2Regex.test(weightStrippedH)) {
          testType = 'ca2';
          cleanRawName = weightStrippedH
            .replace(ca2Regex, '')
            .replace(/[()_[\]\-–—:]+$/g, '')
            .replace(/^[()_[\]\-–—:]+/g, '')
            .trim();
        } else if (ca3Regex.test(weightStrippedH)) {
          testType = 'ca3';
          cleanRawName = weightStrippedH
            .replace(ca3Regex, '')
            .replace(/[()_[\]\-–—:]+$/g, '')
            .replace(/^[()_[\]\-–—:]+/g, '')
            .trim();
        } else if (examRegex.test(weightStrippedH)) {
          testType = 'exam';
          cleanRawName = weightStrippedH
            .replace(examRegex, '')
            .replace(/[()_[\]\-–—:]+$/g, '')
            .replace(/^[()_[\]\-–—:]+/g, '')
            .trim();
        }

        const formatted = resolveCanonicalSubjectName(cleanRawName, idx);
        colDefs.push({ index: idx, subjectName: formatted, testType });
      }
    });

    // Group columns by canonical subject name (case-insensitive key)
    const subjectGroups = new Map<string, { subjectName: string; cols: SubjectColDef[] }>();
    colDefs.forEach(cd => {
      const key = cd.subjectName.toLowerCase();
      const existing = subjectGroups.get(key);
      if (existing) {
        existing.cols.push(cd);
      } else {
        subjectGroups.set(key, { subjectName: cd.subjectName, cols: [cd] });
      }
    });

    const parsedList: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length === 0 || cols.every(c => !c)) continue;

      const rawId = idIdx >= 0 ? (cols[idIdx] || '').trim() : '';
      const rawName = nameIdx >= 0 ? (cols[nameIdx] || '').trim() : '';
      const rawEmail = emailIdx >= 0 ? (cols[emailIdx] || '').trim() : '';
      const rawGrade = gradeIdx >= 0 && cols[gradeIdx] ? cols[gradeIdx].trim() : defaultGradeFallback;

      if (!rawId && !rawName && !rawEmail) continue;

      const results: any[] = [];

      // Process each subject for this student row
      subjectGroups.forEach(({ subjectName: subName, cols: groupCols }) => {
        let ca1 = 0;
        let ca2 = 0;
        let ca3 = 0;
        let exam = 0;
        let hasValues = false;
        let hasCa1 = false;
        let hasCa2 = false;
        let hasCa3 = false;
        let hasExam = false;

        const ca1Col = groupCols.find(c => c.testType === 'ca1');
        const ca2Col = groupCols.find(c => c.testType === 'ca2');
        const ca3Col = groupCols.find(c => c.testType === 'ca3');
        const examCol = groupCols.find(c => c.testType === 'exam');
        const compositeCols = groupCols.filter(c => c.testType === 'composite');

        if (ca1Col || ca2Col || ca3Col || examCol) {
          // Explicit 1st Test / 2nd Test / Exam columns
          if (ca1Col && cols[ca1Col.index] !== undefined && cols[ca1Col.index].trim() !== '') {
            ca1 = parseNumericScore(cols[ca1Col.index]);
            hasCa1 = true;
            hasValues = true;
          }
          if (ca2Col && cols[ca2Col.index] !== undefined && cols[ca2Col.index].trim() !== '') {
            ca2 = parseNumericScore(cols[ca2Col.index]);
            hasCa2 = true;
            hasValues = true;
          }
          if (ca3Col && cols[ca3Col.index] !== undefined && cols[ca3Col.index].trim() !== '') {
            ca3 = parseNumericScore(cols[ca3Col.index]);
            hasCa3 = true;
            hasValues = true;
          }
          if (examCol && cols[examCol.index] !== undefined && cols[examCol.index].trim() !== '') {
            exam = parseNumericScore(cols[examCol.index]);
            hasExam = true;
            hasValues = true;
          }
          // If there is ALSO a composite column alongside CA columns (e.g. "Mathematics 1st Test", "Mathematics 2nd Test", "Mathematics" as Exam/Total)
          if (!hasExam && compositeCols.length > 0) {
            const compValStr = (cols[compositeCols[0].index] || '').trim();
            if (compValStr !== '') {
              const compNum = parseNumericScore(compValStr);
              // If compNum looks like a total (> 70 and ca1+ca2 > 0), subtract ca1+ca2+ca3; otherwise treat as exam score
              if (compNum > 70 && ca1 + ca2 + ca3 > 0 && compNum >= ca1 + ca2 + ca3) {
                exam = compNum - (ca1 + ca2 + ca3);
              } else {
                exam = compNum;
              }
              hasExam = true;
              hasValues = true;
            }
          }
        } else if (compositeCols.length > 0) {
          // Single subject column (e.g. "10/10/55" or "10/10" or single total score)
          const valStr = (cols[compositeCols[0].index] || '').trim();
          if (valStr !== '') {
            hasValues = true;
            if (valStr.includes('/') || valStr.includes(',') || valStr.includes('+') || (valStr.includes('-') && !valStr.startsWith('-'))) {
              const parts = valStr.split(/[/,+-]|\s+/).filter(Boolean).map(p => parseNumericScore(p));
              ca1 = parts[0] || 0;
              ca2 = parts[1] || 0;
              hasCa1 = true;
              hasCa2 = parts.length >= 2;
              if (parts.length === 3) {
                exam = parts[2] || 0;
                hasExam = true;
              } else if (parts.length >= 4) {
                ca3 = parts[2] || 0;
                exam = parts[3] || 0;
                hasCa3 = true;
                hasExam = true;
              }
            } else {
              const scoreNum = parseNumericScore(valStr);
              if (uploadAssessmentScope === 'tests_only' && scoreNum <= 30) {
                if (singleScoreBehavior === 'split') {
                  ca1 = Math.round(scoreNum / 2);
                  ca2 = Math.floor(scoreNum / 2);
                  hasCa1 = true;
                  hasCa2 = true;
                } else if (singleScoreBehavior === 'ca1') {
                  ca1 = scoreNum;
                  ca2 = 0;
                  hasCa1 = true;
                } else {
                  ca1 = 0;
                  ca2 = scoreNum;
                  hasCa2 = true;
                }
              } else {
                ca1 = Math.round(scoreNum * 0.15);
                ca2 = Math.round(scoreNum * 0.15);
                exam = scoreNum - ca1 - ca2;
                hasCa1 = true;
                hasCa2 = true;
                hasExam = true;
              }
            }
          }
        }

        if (hasValues) {
          const total = ca1 + ca2 + ca3 + exam;
          results.push({
            subject: subName,
            ca1,
            ca2,
            ca3,
            exam,
            score: total,
            hasCa1,
            hasCa2,
            hasCa3,
            hasExam,
          });
        }
      });

      parsedList.push({
        registration_no: rawId,
        student_id: rawId,
        full_name: rawName,
        email: rawEmail,
        grade_level: rawGrade,
        password: passwordIdx >= 0 ? cols[passwordIdx] : undefined,
        parent_name: parentNameIdx >= 0 ? cols[parentNameIdx] : undefined,
        parent_phone: parentPhoneIdx >= 0 ? cols[parentPhoneIdx] : undefined,
        results
      });
    }

    return mergeParsedRecordsByRegistration(parsedList);
  }, [inputText, defaultGradeFallback, uploadAssessmentScope, singleScoreBehavior, resolveCanonicalSubjectName]);

  // Preview models matched against active student records by registration number (and fallback email/name)
  const previewRows = useMemo<ParsedRowPreview[]>(() => {
    return rawRecords.map(rec => {
      const rawId = (
        rec.registration_no ||
        rec.reg_no ||
        rec.regNo ||
        rec.regNumber ||
        rec.registration_number ||
        rec.student_id ||
        rec.studentId ||
        rec.matric_no ||
        rec.id ||
        ''
      ).toString().trim();
      const rawName = (rec.full_name || rec.name || '').toString().trim();
      const rawEmail = (rec.email || '').toString().trim();

      const cleanRegKey = rawId ? rawId.toLowerCase().replace(/\s+/g, '') : '';
      const normRegKey = normalizeRegForUpsert(rawId);
      const cleanNameKey = rawName ? rawName.toLowerCase().trim() : '';
      const cleanEmailKey = rawEmail ? rawEmail.toLowerCase().trim() : '';

      // Match against existing students prioritizing Registration Number / Student ID
      const matched = students.find(s => {
        if (!s) return false;
        if (rawId && (s.id === rawId || s.regNumber?.toLowerCase() === rawId.toLowerCase())) return true;
        if (cleanRegKey && s.regNumber && s.regNumber.toLowerCase().replace(/\s+/g, '') === cleanRegKey) return true;
        if (normRegKey && (normalizeRegForUpsert(s.regNumber) === normRegKey || normalizeRegForUpsert(s.id) === normRegKey)) return true;
        if (cleanEmailKey && s.email && s.email.toLowerCase().trim() === cleanEmailKey) return true;
        if (cleanNameKey && s.name && s.name.toLowerCase().trim() === cleanNameKey) return true;
        return false;
      });

      const parsedSubs = (rec.results || []).map((sub: any) => {
        const ca1 = Number(sub.ca1 || 0);
        const ca2 = Number(sub.ca2 || 0);
        const ca3 = Number(sub.ca3 || 0);
        const exam = Number(sub.exam || 0);
        const total = (ca1 + ca2 + ca3 + exam) || Number(sub.score || 0);
        const calc = calculateGrade(total);
        return {
          subject: sub.subject,
          ca1,
          ca2,
          ca3,
          exam,
          total,
          grade: sub.grade || calc.grade,
          remark: sub.remark || calc.remark
        };
      });

      const avg = parsedSubs.length > 0
        ? Math.round((parsedSubs.reduce((sum: number, s: any) => sum + s.total, 0) / parsedSubs.length) * 10) / 10
        : 0;

      return {
        studentIdOrReg: matched?.regNumber || rawId || 'To be assigned',
        name: rawName || (matched ? matched.name : 'Unknown Scholar'),
        email: rawEmail || (matched ? matched.email : ''),
        gradeLevel: rec.grade_level || (matched ? matched.grade : defaultGradeFallback),
        isExisting: Boolean(matched),
        matchedStudentId: matched?.id,
        matchedStudentName: matched?.name,
        matchedStudentReg: matched?.regNumber,
        subjectsCount: parsedSubs.length,
        calculatedAverage: avg,
        subjects: parsedSubs
      };
    });
  }, [rawRecords, students, calculateGrade, defaultGradeFallback]);

  const existingCount = previewRows.filter(r => r.isExisting).length;
  const newCount = previewRows.filter(r => !r.isExisting).length;

  const importedClasses = useMemo(() => {
    const set = new Set<string>();
    previewRows.forEach(r => {
      if (r.gradeLevel && r.gradeLevel.trim()) {
        set.add(r.gradeLevel.trim());
      }
    });
    return Array.from(set);
  }, [previewRows]);

  const [lastImportedClasses, setLastImportedClasses] = useState<string[]>([]);
  const [selectedPublishClass, setSelectedPublishClass] = useState<string>('ALL');
  const [isPublishingToClass, setIsPublishingToClass] = useState(false);
  const [classPublishConfirmation, setClassPublishConfirmation] = useState<{
    targetClass: string;
    dispatchedCount: number;
    timestamp: string;
  } | null>(null);

  const handlePublishToClassImmediately = async (targetClassOverride?: string) => {
    if (isPublishingToClass) return;
    setIsPublishingToClass(true);
    setUploadErrorBanner(null);
    try {
      const targetCls =
        targetClassOverride ||
        (selectedPublishClass !== 'ALL'
          ? selectedPublishClass
          : lastImportedClasses.length === 1
          ? lastImportedClasses[0]
          : importedClasses.length === 1
          ? importedClasses[0]
          : 'all');

      const dispatchRes = await dispatchCollatedResultsToDashboards({
        targetClass: targetCls,
        reportKind: uploadAssessmentScope === 'tests_only' ? 'mid' : 'end',
        dispatchedBy: 'Admin Bulk Import & Immediate Class Publisher',
      });
      await unifyLocalStorageResultsToDatabase();

      setClassPublishConfirmation({
        targetClass: targetCls === 'all' || targetCls === 'ALL' ? 'All Imported Classes' : targetCls,
        dispatchedCount: dispatchRes.dispatchedCount || 0,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setUploadErrorBanner(`Class publish failed: ${err?.message || 'Unexpected database error'}`);
    } finally {
      setIsPublishingToClass(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadErrorBanner(null);
    setClassPublishConfirmation(null);
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setInputText(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteBatchUpsert = async () => {
    if (rawRecords.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setUploadErrorBanner(null);
    setClassPublishConfirmation(null);

    try {
      const classesInBatch = [...importedClasses];
      setLastImportedClasses(classesInBatch);
      const defaultTargetClass = classesInBatch.length === 1 ? classesInBatch[0] : 'ALL';
      setSelectedPublishClass(defaultTargetClass);

      // Ensure any custom subject columns in the uploaded CSV are also added to websiteSubjects so they remain intact
      const uploadedSubNames = new Set<string>();
      rawRecords.forEach(r => {
        (r.results || []).forEach((sub: any) => {
          if (sub?.subject) uploadedSubNames.add(String(sub.subject).trim());
        });
      });
      uploadedSubNames.forEach(subName => {
        const exists = (websiteSubjects || []).some(
          ws => ws?.name?.trim().toLowerCase() === subName.toLowerCase()
        );
        if (!exists && typeof addSubject === 'function') {
          const code = subName
            .replace(/[^A-Za-z0-9 ]/g, '')
            .split(/\s+/)
            .filter(Boolean)
            .map(w => w.slice(0, 3).toUpperCase())
            .join('')
            .slice(0, 6) || 'SUB';
          addSubject({
            name: subName,
            code: `${code}101`,
            department: 'General',
            isCore: true,
          });
        }
      });

      const result = await batchUpsertStudentResults(
        rawRecords,
        selectedTerm,
        selectedSession,
        {
          assessmentMode: uploadAssessmentScope,
          replaceEntireRoster: replaceEntireRosterOnUpload
        }
      );

      if (autoPublishToPortals) {
        const targetCls = classesInBatch.length === 1 ? classesInBatch[0] : 'all';
        const dispatchRes = await dispatchCollatedResultsToDashboards({
          targetClass: targetCls,
          reportKind: uploadAssessmentScope === 'tests_only' ? 'mid' : 'end',
          dispatchedBy: 'Admin Bulk Import & Immediate Class Publisher',
        });
        await unifyLocalStorageResultsToDatabase();
        setClassPublishConfirmation({
          targetClass: targetCls === 'all' ? (classesInBatch.join(', ') || 'All Imported Classes') : targetCls,
          dispatchedCount: dispatchRes.dispatchedCount || 0,
          timestamp: new Date().toLocaleTimeString(),
        });
      }

      setAuditResult({
        ...result,
        message: `${result.message}${autoPublishToPortals ? ' Published live to the central database — students have immediate portal access!' : ''}`
      });
    } catch (err: any) {
      setUploadErrorBanner(`Batch upload failed: ${err?.message || 'Unexpected error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyTemplateToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTemplate(label);
    setTimeout(() => setCopiedTemplate(null), 2500);
  };

  const downloadTextFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Pre-built template strings dynamically populated with the website's subjects
  const splitTestsCsvTemplate = useMemo(() => {
    const subs = sampleSubjectsSlice;
    const headers = ['registration_no', 'full_name', 'grade_level'];
    subs.forEach(s => {
      headers.push(`${s} (1st Test)`);
      headers.push(`${s} (2nd Test)`);
    });
    const r1 = subs.flatMap((_, i) => [10 - (i % 2), 9 + (i % 2)]).join(',');
    const r2 = subs.flatMap((_, i) => [9, 10 - (i % 2)]).join(',');
    const r3 = subs.flatMap((_, i) => [8 + (i % 2), 8]).join(',');
    return `${headers.join(',')}
SBS/2026/001,Alex Morgan,SSS 1 Science,${r1}
SBS/2026/002,Samira Khan,SSS 1 Science,${r2}
SBS/2026/NEW01,Chioma Nwachukwu,SSS 1 Science,${r3}`;
  }, [sampleSubjectsSlice]);

  const exactRequestedTemplate = useMemo(() => {
    const subs = sampleSubjectsSlice;
    const headers = ['registration_no', 'full_name', 'grade_level', ...subs];
    const r1 = subs.map((_, i) => `${10 - (i % 2)}/${9 + (i % 2)}`).join(',');
    const r2 = subs.map((_, i) => `${9}/${10 - (i % 2)}`).join(',');
    const r3 = subs.map((_, i) => `${8 + (i % 2)}/8`).join(',');
    return `${headers.join(',')}
SBS/2026/001,Alex Morgan,SSS 1 Science,${r1}
SBS/2026/002,Samira Khan,SSS 1 Science,${r2}
SBS/2026/NEW01,Chioma Nwachukwu,SSS 1 Science,${r3}`;
  }, [sampleSubjectsSlice]);

  const jsonTemplate = useMemo(() => {
    const subs = sampleSubjectsSlice;
    return JSON.stringify([
      {
        registration_no: "SBS/2026/001",
        student_id: "SBS/2026/001",
        full_name: "Alex Morgan",
        email: "alex.morgan@stanbaxschools.edu.ng",
        grade_level: "SSS 1 Science",
        term: "1st Term",
        results: subs.map((subject, i) => ({
          subject,
          ca1: 10 - (i % 2),
          ca2: 9 + (i % 2)
        }))
      },
      {
        registration_no: "SBS/2026/NEW01",
        student_id: "SBS/2026/NEW01",
        full_name: "Chioma Nwachukwu",
        email: "chioma.n@example.com",
        grade_level: "SSS 1 Science",
        parent_name: "Chief Chukwuma Nwachukwu",
        parent_phone: "+234 803 456 7890",
        results: subs.map((subject, i) => ({
          subject,
          ca1: 9,
          ca2: 9 - (i % 2)
        }))
      }
    ], null, 2);
  }, [sampleSubjectsSlice]);

  const allDisplaySubjects = useMemo(() => {
    const map = new Map<string, string>();
    [...allWebsiteSubjects, ...dbSelectedSubjects].forEach(s => {
      const trimmed = (s || '').trim();
      if (trimmed && !map.has(trimmed.toLowerCase())) {
        map.set(trimmed.toLowerCase(), trimmed);
      }
    });
    return Array.from(map.values());
  }, [allWebsiteSubjects, dbSelectedSubjects]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-fade-in text-slate-900">
        
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 text-white p-6 relative shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-amber-400 text-blue-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                  <Sparkles className="w-3 h-3" />
                  Continuous Assessment &amp; Batch Upsert Engine
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-bold border border-white/15">
                  1st &amp; 2nd Tests • All Website Subjects ({allDisplaySubjects.length}) • Reg-No Upsert
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-amber-400 shrink-0" />
                <span>Student Results Database Download &amp; Batch Upload</span>
              </h2>
              <p className="text-xs text-blue-200/90 leading-relaxed">
                Populates all subjects created inside the website with dedicated spaces for <strong>1st Test (CA1)</strong> and <strong>2nd Test (CA2)</strong>. Existing registration numbers are updated in-place without creating duplicate student rows.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 mt-5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('download_db')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'download_db'
                  ? 'bg-amber-400 text-blue-950 shadow-md font-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>1. Download Students CSV</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'download_db' ? 'bg-blue-950 text-white' : 'bg-amber-400 text-blue-950'
              }`}>
                {exportStudents.length} Scholars
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-amber-400 text-blue-950 shadow-md font-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>2. Upload &amp; Sync Results</span>
              {previewRows.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'upload' ? 'bg-blue-950 text-white' : 'bg-amber-400 text-blue-950'
                }`}>
                  {previewRows.length} Parsed
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('migration')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'migration'
                  ? 'bg-amber-400 text-blue-950 shadow-md font-black'
                  : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 hover:bg-emerald-500/30'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>3. Hosting Migration &amp; Live Publish</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'templates'
                  ? 'bg-amber-400 text-blue-950 shadow-md font-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>4. Sample Formats</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-amber-400 text-blue-950 shadow-md font-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>5. Step-by-Step Guide</span>
            </button>
          </div>
        </div>

        {/* Modal Main Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
          <input
            ref={migrationJsonInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFullMigrationJson}
            className="hidden"
          />

          {/* Quick Live Sync & Migration Bar */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                  Cross-Device &amp; Hosting Sync
                </span>
                <span className="text-xs font-black">
                  Current Browser Roster: {exportStudents.length} Scholars • {allDisplaySubjects.length} Website Subjects
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90">
                Publish this browser&apos;s exact edited students ({exportStudents.length}), logins, subjects, and results live to all browsers &amp; Student Portals, or download a portable backup for your new hosting provider.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                disabled={isPublishingLive}
                onClick={handlePublishEverythingLiveNow}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPublishingLive ? 'animate-spin' : ''}`} />
                <span>{isPublishingLive ? 'Publishing Live...' : `Push ${exportStudents.length} Scholars & Results Live`}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadFullMigrationJson}
                className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-300" />
                <span>Backup All (.json)</span>
              </button>
              <button
                type="button"
                onClick={() => migrationJsonInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-300" />
                <span>Restore Backup (.json)</span>
              </button>
            </div>
          </div>

          {migrationBanner && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{migrationBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setMigrationBanner(null)}
                className="text-emerald-800 hover:underline text-[11px] shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 1: DOWNLOAD STUDENTS DATABASE AS CSV & 1ST/2ND TEST SPACES */}
          {/* =============================================================== */}
          {activeTab === 'download_db' && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Header card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Database className="w-5 h-5 text-blue-900" />
                      <span>Export Enrolled Scholars for 1st &amp; 2nd Tests Entry</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      All subjects created inside the website are automatically populated below with spaces for <strong>1st Test</strong> and <strong>2nd Test</strong>. Download the CSV or enter test scores directly in the table below.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleDownloadDatabaseCsv}
                      className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-black shadow-md cursor-pointer transition flex items-center gap-2 active:scale-98"
                    >
                      <Download className="w-4 h-4 text-amber-400" />
                      <span>Download CSV File</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyDatabaseTable}
                      className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                    >
                      {dbCopiedToClipboard ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-emerald-700" />}
                      <span>{dbCopiedToClipboard ? 'Copied to Clipboard!' : 'Copy Table'}</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Format Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Class / Department</label>
                    <select
                      value={dbClassFilter}
                      onChange={e => setDbClassFilter(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      <option value="all">All Enrolled Classes ({exportStudents.length} scholars)</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">1st &amp; 2nd Tests Layout Structure</label>
                    <select
                      value={dbLayoutMode}
                      onChange={e => setDbLayoutMode(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      <option value="split_tests">Separate 1st &amp; 2nd Test Columns (1st Test, 2nd Test)</option>
                      <option value="single_column">Single Subject Column (Format: 1stTest/2ndTest)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 mb-1">CSV Export Options</label>
                    <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dbIncludeCurrentScores}
                        onChange={e => setDbIncludeCurrentScores(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-xs text-slate-700 font-medium">Pre-fill current 1st &amp; 2nd Test scores</span>
                    </label>
                    <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dbIncludeLoginsAndParents}
                        onChange={e => setDbIncludeLoginsAndParents(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="text-xs text-slate-700 font-medium">Include Student Passwords &amp; Parent Logins</span>
                    </label>
                  </div>
                </div>

                {/* Subject Selector Checklist (Populated from Website Subjects) */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Subject Columns Included in CSV ({dbSelectedSubjects.length} of {allDisplaySubjects.length} website subjects selected):
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setDbSelectedSubjects(createdWebsiteSubjectNames.length > 0 ? createdWebsiteSubjectNames : allDisplaySubjects)}
                        className="text-blue-700 hover:underline cursor-pointer font-bold"
                      >
                        Populate All Website Subjects ({createdWebsiteSubjectNames.length})
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setDbSelectedSubjects(allDisplaySubjects)}
                        className="text-blue-700 hover:underline cursor-pointer font-bold"
                      >
                        Select All ({allDisplaySubjects.length})
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => setDbSelectedSubjects(DEFAULT_CORE_SUBJECTS)}
                        className="text-slate-600 hover:underline cursor-pointer font-bold"
                      >
                        Reset to 4 Core
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {allDisplaySubjects.map(sub => {
                      const isSelected = dbSelectedSubjects.some(s => s.toLowerCase() === sub.toLowerCase());
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleToggleSubject(sub)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                          <span>{sub}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Subject field (also saves to website subjects) */}
                  <div className="flex items-center gap-2 max-w-sm pt-2">
                    <input
                      type="text"
                      placeholder="Add new subject to website & CSV..."
                      value={dbCustomSubjectInput}
                      onChange={e => setDbCustomSubjectInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomSubject(); } }}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSubject}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* CSV Format Preview Banner */}
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <Info className="w-4 h-4 text-amber-700" />
                    <span>How 1st &amp; 2nd Test Spaces Work in This CSV &amp; Table:</span>
                  </div>
                  {dbLayoutMode === 'split_tests' ? (
                    <p className="text-[11px] text-amber-900/90 leading-relaxed">
                      Every subject has dedicated columns for <strong>1st Test</strong> and <strong>2nd Test</strong>:{' '}
                      <code className="font-mono font-bold bg-amber-100/80 px-1.5 py-0.5 rounded">
                        registration_no, full_name, grade_level, {dbSelectedSubjects.slice(0, 2).map(s => `${s} (1st Test), ${s} (2nd Test)`).join(', ')}...
                      </code>{' '}
                      Enter scores in Excel/Google Sheets and upload back, or type scores directly into the <strong>1st Test</strong> and <strong>2nd Test</strong> spaces below!
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-900/90 leading-relaxed">
                      Columns generated: <code className="font-mono font-bold bg-amber-100/80 px-1.5 py-0.5 rounded">registration_no,full_name,grade_level,{dbSelectedSubjects.slice(0, 4).join(',')}</code>.
                      In each subject cell, enter 1st and 2nd test scores separated by a slash (e.g. <span className="font-mono font-bold">10/10</span> for 1st Test = 10, 2nd Test = 10).
                    </p>
                  )}
                </div>
              </div>

              {/* Interactive Live Database Preview & Direct 1st / 2nd Test Entry Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Live Database &amp; Interactive 1st / 2nd Test Score Sheet ({exportStudents.length} Scholars)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Each subject has dedicated <strong>1st Test</strong> and <strong>2nd Test</strong> spaces. You can type scores here and save directly, or download as CSV.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={isSavingInlineTests}
                      onClick={handleSaveInlineTestScores}
                      className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isSavingInlineTests ? 'Saving Scores...' : 'Save 1st & 2nd Tests Now'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Proceed to CSV Upload</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {inlineSaveBanner && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-900 flex items-center justify-between">
                    <span>{inlineSaveBanner}</span>
                    <button
                      type="button"
                      onClick={() => setInlineSaveBanner(null)}
                      className="text-emerald-700 hover:underline text-[11px] ml-3"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[420px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 bg-slate-100">Registration No</th>
                        <th className="py-2.5 px-3 bg-slate-100">Full Name</th>
                        <th className="py-2.5 px-3 bg-slate-100">Class / Grade</th>
                        {dbSelectedSubjects.map(sub => (
                          <th key={sub} colSpan={2} className="py-2 px-3 text-center text-blue-950 border-l border-slate-200 bg-blue-50/60">
                            <div className="font-black text-[10px]">{sub}</div>
                            <div className="grid grid-cols-2 gap-1 mt-1 text-[9px] text-slate-600 font-bold">
                              <span className="bg-white/80 rounded px-1 py-0.5 border border-slate-200">1st Test</span>
                              <span className="bg-white/80 rounded px-1 py-0.5 border border-slate-200">2nd Test</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {exportStudents.map(st => (
                        <tr key={st.id} className="hover:bg-slate-50 transition">
                          <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">{st.regNumber}</td>
                          <td className="py-2 px-3 font-sans font-bold text-slate-900 whitespace-nowrap">{st.name}</td>
                          <td className="py-2 px-3 font-sans text-slate-600 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                              {st.grade}
                            </span>
                          </td>
                          {dbSelectedSubjects.map(sub => {
                            const scores = getStudentSubjectTestScores(st, sub);
                            return (
                              <React.Fragment key={`${st.id}-${sub}`}>
                                <td className="py-1.5 px-1.5 border-l border-slate-100">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    placeholder="1st"
                                    value={scores.ca1}
                                    onChange={e => handleInlineTestScoreChange(st.id, sub, 'ca1', e.target.value)}
                                    className="w-14 px-1.5 py-1 rounded-lg border border-slate-200 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 text-center font-mono text-xs bg-white text-slate-900 outline-none"
                                  />
                                </td>
                                <td className="py-1.5 px-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    placeholder="2nd"
                                    value={scores.ca2}
                                    onChange={e => handleInlineTestScoreChange(st.id, sub, 'ca2', e.target.value)}
                                    className="w-14 px-1.5 py-1 rounded-lg border border-slate-200 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-center font-mono text-xs bg-white text-slate-900 outline-none"
                                  />
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                      {exportStudents.length === 0 && (
                        <tr>
                          <td colSpan={3 + dbSelectedSubjects.length * 2} className="text-center py-6 text-slate-400 italic">
                            No scholars found in selected class.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: UPLOAD & SYNC RESULTS */}
          {/* =============================================================== */}
          {activeTab === 'upload' && !auditResult && (
            <div className="space-y-6 animate-fade-in">
              
              {/* Target Term & Assessment Scope Banner */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Target Academic Term</label>
                    <select
                      value={selectedTerm}
                      onChange={e => setSelectedTerm(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      <option value="1st Term">1st Term (First Semester)</option>
                      <option value="2nd Term">2nd Term (Second Semester)</option>
                      <option value="3rd Term">3rd Term (Promotional Final)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Academic Session</label>
                    <input
                      type="text"
                      value={selectedSession}
                      onChange={e => setSelectedSession(e.target.value)}
                      placeholder="e.g. 2026/2027"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Assessment Ingestion Scope</label>
                    <select
                      value={uploadAssessmentScope}
                      onChange={e => setUploadAssessmentScope(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-blue-400 text-xs font-bold bg-blue-50/60 text-blue-950 focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      <option value="tests_only">1st &amp; 2nd Tests Only (CA1 + CA2)</option>
                      <option value="full">Full Composite (Tests + Terminal Exam)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Fallback Class for New Scholars</label>
                    <select
                      value={defaultGradeFallback}
                      onChange={e => setDefaultGradeFallback(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      <option value="SSS 1 Science">SSS 1 Science</option>
                      <option value="SSS 1 Commercial">SSS 1 Commercial</option>
                      <option value="SSS 1 Arts">SSS 1 Arts</option>
                    </select>
                  </div>
                </div>

                {/* Scope Notice */}
                {uploadAssessmentScope === 'tests_only' && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <strong>Tests-Only Upsert Active:</strong> Matches existing scholars by <strong>Registration Number</strong> and updates their 1st Test (CA1) and 2nd Test (CA2) scores in-place without creating duplicate rows or overwriting terminal exams.
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-slate-600">Single cell score:</span>
                      <select
                        value={singleScoreBehavior}
                        onChange={e => setSingleScoreBehavior(e.target.value as any)}
                        className="px-2 py-1 rounded-lg border border-emerald-300 text-xs font-bold bg-white text-slate-800"
                      >
                        <option value="split">Split evenly (e.g. 18 to 9 and 9)</option>
                        <option value="ca1">Record into 1st Test (CA1)</option>
                        <option value="ca2">Record into 2nd Test (CA2)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Live Publish & Roster Lock Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-blue-200 bg-blue-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPublishToPortals}
                      onChange={e => setAutoPublishToPortals(e.target.checked)}
                      className="rounded text-blue-700 focus:ring-blue-600 h-4 w-4 mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-black text-blue-950 block">Publish Live to Student &amp; Parent Portals Immediately</span>
                      <span className="text-[11px] text-slate-600">Pushes uploaded results directly to the live cloud database so students see them on every device (not just local storage).</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-amber-200 bg-amber-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceEntireRosterOnUpload}
                      onChange={e => setReplaceEntireRosterOnUpload(e.target.checked)}
                      className="rounded text-amber-700 focus:ring-amber-600 h-4 w-4 mt-0.5"
                    />
                    <div className="text-xs">
                      <span className="font-black text-amber-950 block">Lock &amp; Replace Entire Student Roster with Uploaded File</span>
                      <span className="text-[11px] text-slate-600">Enable when migrating all edited students (e.g. 88 scholars) so unincluded demo students are permanently removed across all browsers.</span>
                    </div>
                  </label>
                </div>
              </div>

              {uploadErrorBanner && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-900 flex items-center justify-between">
                  <span>{uploadErrorBanner}</span>
                  <button
                    type="button"
                    onClick={() => setUploadErrorBanner(null)}
                    className="text-rose-700 hover:underline text-[11px]"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Upload Dropzone or Raw Paste Area */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMode('file')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        inputMode === 'file' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      File Upload (.csv, .json, .tsv)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('paste')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        inputMode === 'paste' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Paste Spreadsheet / Text Data
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={loadSampleSplitTestsCSV}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition border border-emerald-200 cursor-pointer flex items-center gap-1.5"
                    >
                      <Layers className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sample 1st &amp; 2nd Test Columns CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={loadSampleTestsCSV}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition border border-indigo-200 cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Sample Slash Format (10/10)</span>
                    </button>
                    <button
                      type="button"
                      onClick={loadSampleJSON}
                      className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition border border-purple-200 cursor-pointer flex items-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 text-purple-600" />
                      <span>Sample JSON</span>
                    </button>
                  </div>
                </div>

                {inputMode === 'file' ? (
                  <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-slate-50/50 hover:bg-blue-50/30 transition group relative">
                    <input
                      type="file"
                      accept=".csv,.tsv,.json,.txt"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="space-y-3 pointer-events-none">
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center group-hover:scale-110 transition">
                        <Upload className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">
                          {fileName ? `Selected File: ${fileName}` : 'Drag & drop your results spreadsheet file here, or click to browse'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Supports CSV, TSV, JSON, and Tabulated Text files (UTF-8, up to 10MB)
                        </p>
                      </div>
                      {fileName && (
                        <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                          File Loaded Successfully ({rawRecords.length} unique student records parsed)
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      rows={7}
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder="Paste your CSV, tab-separated columns from Excel/Google Sheets, or JSON array here..."
                      className="w-full p-4 rounded-2xl border border-slate-300 text-xs font-mono bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-600 outline-none leading-relaxed"
                    />
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Tip: Duplicate rows for the same registration number are automatically merged into one student record.</span>
                      {inputText && (
                        <button
                          type="button"
                          onClick={() => { setInputText(''); setFileName(''); }}
                          className="text-rose-600 hover:underline cursor-pointer font-bold"
                        >
                          Clear Text
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pre-Upload Match & Preview Table */}
              {previewRows.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <span>Pre-Upload Reconciliation Preview (Upsert by Registration No)</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Scholars whose Registration Number is already present are updated in-place—no duplicate student entries will be created.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{existingCount} Existing Updated</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 text-xs font-bold flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5 text-purple-600" />
                        <span>{newCount} New Accounts Provisioned</span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100/80 text-slate-700 font-black uppercase text-[11px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Action &amp; Status</th>
                          <th className="py-3 px-4">Scholar Name</th>
                          <th className="py-3 px-4">Student ID / Reg No</th>
                          <th className="py-3 px-4">Class</th>
                          <th className="py-3 px-4">Parsed 1st &amp; 2nd Test Scores</th>
                          <th className="py-3 px-4">Average</th>
                          <th className="py-3 px-4">Vault Credentials</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4">
                              {row.isExisting ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-black">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Update Existing</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-black">
                                  <UserPlus className="w-3 h-3 text-purple-600" />
                                  <span>Auto-Provision</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {row.name}
                              {row.matchedStudentName && row.matchedStudentName !== row.name && (
                                <span className="block text-[10px] text-slate-500 font-normal">
                                  Matched Record: {row.matchedStudentName}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                              {row.studentIdOrReg}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[11px] font-bold">
                                {row.gradeLevel}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1 max-w-sm">
                                {row.subjects.map((s, sIdx) => (
                                  <span key={sIdx} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 text-[10px] font-bold border border-blue-200">
                                    {s.subject}: 1st={s.ca1}, 2nd={s.ca2} (Tot: {s.total})
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-lg text-[11px] font-black ${
                                row.calculatedAverage >= 70 ? 'bg-emerald-100 text-emerald-900' :
                                row.calculatedAverage >= 50 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'
                              }`}>
                                {row.calculatedAverage}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[11px]">
                              {row.isExisting ? (
                                <span className="text-slate-500">Preserved in Vault</span>
                              ) : (
                                <div className="space-y-0.5">
                                  <div className="text-purple-900 font-bold flex items-center gap-1">
                                    <KeyRound className="w-3 h-3 text-purple-600" />
                                    <span>Pass: stanbax2025</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">Created upon upsert</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Execution Bar */}
                  <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                    <div className="text-xs text-slate-600">
                      Target Term: <strong>{selectedTerm}</strong> • Session: <strong>{selectedSession}</strong> • Classes in File: <strong>{importedClasses.length > 0 ? importedClasses.join(', ') : defaultGradeFallback}</strong> • Scope: <strong>{uploadAssessmentScope === 'tests_only' ? '1st & 2nd Tests Only' : 'Full Composite'}</strong>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleExecuteBatchUpsert}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 hover:from-blue-950 hover:to-indigo-950 text-white font-black text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                    >
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>
                        {isProcessing
                          ? 'Saving to Database & Publishing...'
                          : autoPublishToPortals
                          ? `Step 1 & 2: Bulk Import + Publish to ${importedClasses.length === 1 ? importedClasses[0] : 'Class'} Immediately (${previewRows.length} Scholars)`
                          : `Step 1: Execute Bulk Result Import (${previewRows.length} Scholars)`}
                      </span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* =============================================================== */}
          {/* AUDIT SUMMARY REPORT (After Execution) */}
          {/* =============================================================== */}
          {auditResult && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-3xl border border-emerald-200 shadow-md space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Step 1 Complete: Bulk Result Import Saved to Database</h3>
                    <p className="text-xs text-slate-500">{auditResult.message}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <span className="block text-2xl font-black text-slate-900">{auditResult.totalProcessed}</span>
                    <span className="text-xs font-bold text-slate-500">Total Unique Scholars Processed</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                    <span className="block text-2xl font-black text-emerald-800">{auditResult.updatedCount}</span>
                    <span className="text-xs font-bold text-emerald-700">Existing Records Updated In-Place</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-center">
                    <span className="block text-2xl font-black text-purple-800">{auditResult.provisionedCount}</span>
                    <span className="text-xs font-bold text-purple-700">New Accounts Provisioned</span>
                  </div>
                </div>

                {/* STEP 2 & STEP 3: PUBLISH TO CLASS IMMEDIATELY (CENTRAL DATABASE) */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white border border-emerald-700/50 space-y-4 shadow-md">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                        <Database className="w-3 h-3" /> Step 2 &amp; Step 3 • Central Database Live Dispatch
                      </div>
                      <h4 className="text-sm font-black text-white">
                        Publish Results to Class Immediately (Students Have Instant Portal Access)
                      </h4>
                      <p className="text-xs text-emerald-100/80">
                        Pushes collated report cards, class rankings, and scores directly to the Supabase &amp; Server database (not local storage) so students in the class can log in on any phone or computer and view their results immediately.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {lastImportedClasses.length > 1 && (
                        <select
                          value={selectedPublishClass}
                          onChange={e => setSelectedPublishClass(e.target.value)}
                          className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold focus:outline-none"
                        >
                          <option value="ALL" className="text-slate-900">All Imported Classes ({lastImportedClasses.length})</option>
                          {lastImportedClasses.map(cls => (
                            <option key={cls} value={cls} className="text-slate-900">{cls}</option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        disabled={isPublishingToClass}
                        onClick={() => handlePublishToClassImmediately()}
                        className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4 fill-slate-950" />
                        <span>
                          {isPublishingToClass
                            ? 'Publishing to Database...'
                            : classPublishConfirmation
                            ? `Re-Publish to ${lastImportedClasses.length === 1 ? lastImportedClasses[0] : 'Class'} Portals Now`
                            : `Publish Results to ${lastImportedClasses.length === 1 ? lastImportedClasses[0] : 'Class'} Immediately`}
                        </span>
                      </button>
                    </div>
                  </div>

                  {classPublishConfirmation && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-200">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          <strong>LIVE IN DATABASE ({classPublishConfirmation.timestamp}):</strong> Published to <strong>{classPublishConfirmation.targetClass}</strong> ({classPublishConfirmation.dispatchedCount} scholar portals updated). Students now have immediate access on all devices!
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-400/20 text-emerald-300 font-black text-[10px] uppercase tracking-wider shrink-0">
                        Step 3 Active: Student Access Unlocked
                      </span>
                    </div>
                  )}
                </div>

                {auditResult.provisionedCount > 0 && (
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-purple-600" />
                      <span>
                        <strong>{auditResult.provisionedCount} new student login accounts</strong> have been registered in the Credentials Vault with default passcode <span className="font-mono font-bold">stanbax2025</span>.
                      </span>
                    </div>
                    {onNavigateToVault && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToVault();
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-900 text-white font-bold text-xs hover:bg-purple-950 cursor-pointer shadow-xs"
                      >
                        Open Credentials Vault
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Transaction Logs Table */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-black text-slate-900">Transaction Audit Log</h4>
                  <button
                    type="button"
                    onClick={() => {
                      setAuditResult(null);
                      setInputText('');
                      setFileName('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Upload Another File
                  </button>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Scholar Name</th>
                        <th className="py-2.5 px-3">Registration Number</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Subjects Recorded</th>
                        <th className="py-2.5 px-3">Calculated Average</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditResult.auditLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{log.name}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{log.regNumber}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status.includes('Provisioned')
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-700">{log.subjectsCount} subjects</td>
                          <td className="py-2 px-3 font-bold text-slate-800">{log.termAverage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: HOSTING MIGRATION & LIVE CLOUD PUBLISH */}
          {/* =============================================================== */}
          {activeTab === 'migration' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-700" />
                      <span>Complete Hosting Migration &amp; Multi-Browser Sync Center</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Keep all your edited scholars ({exportStudents.length} scholars), student login passwords, registration numbers, and created subjects ({allDisplaySubjects.length} subjects) 100% intact across browsers or when moving to a new hosting provider.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Push Live from Current Browser */}
                  <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-black uppercase">
                        Fix Browser Mismatch (88 vs 106)
                      </span>
                      <h4 className="text-sm font-black text-slate-900">
                        1. Push This Browser&apos;s Data Live to All Devices
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        If this browser has your correct <strong>{exportStudents.length} edited scholars</strong> and created subjects, click below to lock the cloud database and Student Portals to this exact roster.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isPublishingLive}
                      onClick={handlePublishEverythingLiveNow}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isPublishingLive ? 'animate-spin' : ''}`} />
                      <span>{isPublishingLive ? 'Syncing to Cloud...' : `Lock & Publish ${exportStudents.length} Scholars Live`}</span>
                    </button>
                  </div>

                  {/* Card 2: Download Full Migration File */}
                  <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-900 text-white text-[10px] font-black uppercase">
                        Step 1 for New Hosting Provider
                      </span>
                      <h4 className="text-sm font-black text-slate-900">
                        2. Download Complete Migration File (.json &amp; .csv)
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Exports all <strong>{exportStudents.length} edited students</strong>, their login passwords, parent accounts, all <strong>{allDisplaySubjects.length} created subjects</strong>, and collated results.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleDownloadFullMigrationJson}
                        className="w-full py-2.5 px-4 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-black text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-amber-400" />
                        <span>Download Full Migration (.json)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadDatabaseCsv}
                        className="w-full py-2 px-4 rounded-xl bg-white hover:bg-blue-50 text-blue-900 border border-blue-300 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Download Students + Logins + Subjects (.csv)</span>
                      </button>
                    </div>
                  </div>

                  {/* Card 3: Import Full Migration File */}
                  <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black uppercase">
                        Step 2 on New Host / Device
                      </span>
                      <h4 className="text-sm font-black text-slate-900">
                        3. Import &amp; Restore Migration Backup (.json)
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Upload your <code className="font-mono font-bold">.json</code> backup file on your new hosting provider or second browser. Replaces demo students with your exact edited roster, logins, and subjects.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => migrationJsonInputRef.current?.click()}
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Migration Backup (.json)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: SAMPLE TEMPLATES & FORMATS */}
          {/* =============================================================== */}
          {activeTab === 'templates' && (
            <div className="space-y-6 animate-fade-in">
              {/* Split test columns template */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Separate 1st &amp; 2nd Test Columns Template (Populated with Website Subjects)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Each subject is given explicit <code className="font-mono text-blue-900">(1st Test)</code> and <code className="font-mono text-blue-900">(2nd Test)</code> columns for entering continuous assessment marks.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyTemplateToClipboard(splitTestsCsvTemplate, 'split')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedTemplate === 'split' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTemplate === 'split' ? 'Copied!' : 'Copy Template'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInputText(splitTestsCsvTemplate);
                        setFileName('student_results_split_tests.csv');
                        setUploadAssessmentScope('tests_only');
                        setActiveTab('upload');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Load into Uploader</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                  <pre>{splitTestsCsvTemplate}</pre>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Single Column Slash Format (1stTest/2ndTest)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Enter 1st and 2nd tests separated by a slash (<code className="font-mono font-bold text-blue-900">10/10</code>) under each website subject column.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyTemplateToClipboard(exactRequestedTemplate, 'exact')}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedTemplate === 'exact' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTemplate === 'exact' ? 'Copied!' : 'Copy Template'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInputText(exactRequestedTemplate);
                        setFileName('student_results_exact_tests.csv');
                        setUploadAssessmentScope('tests_only');
                        setActiveTab('upload');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Load into Uploader</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                  <pre>{exactRequestedTemplate}</pre>
                </div>
              </div>

              {/* JSON Template */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Structured JSON Array Format</h3>
                    <p className="text-xs text-slate-500">For scripts, automated database pipelines, or integration webhooks.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyTemplateToClipboard(jsonTemplate, 'json')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedTemplate === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTemplate === 'json' ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-60 leading-relaxed">
                  <pre>{jsonTemplate}</pre>
                </div>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: STEP-BY-STEP SCORING GUIDE */}
          {/* =============================================================== */}
          {activeTab === 'guide' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-blue-950 font-black text-base">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <span>Step-by-Step Round-Trip Results Workflow</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Follow this 4-step workflow to export your students with all website subjects, enter 1st &amp; 2nd test scores, and sync everything back without duplicate entries:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-black text-xs">
                      1
                    </div>
                    <h5 className="font-bold text-xs text-slate-900">Download Students CSV</h5>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      All subjects created inside the website are automatically selected. Click <strong>Download CSV File</strong> to export enrolled scholars with <span className="font-mono">(1st Test)</span> and <span className="font-mono">(2nd Test)</span> columns.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-black text-xs">
                      2
                    </div>
                    <h5 className="font-bold text-xs text-slate-900">Enter 1st &amp; 2nd Tests</h5>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Enter 1st Test and 2nd Test marks in Excel/Google Sheets, or type them directly into the interactive <strong>1st Test</strong> and <strong>2nd Test</strong> boxes on Tab 1.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black text-xs">
                      3
                    </div>
                    <h5 className="font-bold text-xs text-slate-900">Upload &amp; Reconcile</h5>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Upload your completed CSV on Tab 2. The engine matches by <strong>Registration Number</strong> and tags existing students as <span className="text-emerald-700 font-bold">Update Existing</span>.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-black text-xs">
                      4
                    </div>
                    <h5 className="font-bold text-xs text-slate-900">Upsert Without Duplicates</h5>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Click <strong>Execute Batch Upsert</strong>. Existing registration numbers are updated in-place with the new scores—never duplicated.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-blue-900">
                    <Info className="w-4 h-4 text-blue-700" />
                    <span>Frequently Asked Questions</span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-700">
                    <p>
                      <strong>Q: What happens if a Registration Number is already in the database?</strong><br />
                      A: It updates the existing student record in-place with the new 1st &amp; 2nd Test scores and preserves their terminal exams. It will never create a duplicate row for the same student ID or registration number.
                    </p>
                    <p>
                      <strong>Q: Do subjects created in the Subjects &amp; Grading section appear here automatically?</strong><br />
                      A: Yes! Every subject created in the website is automatically populated in the CSV builder, interactive score sheet, and upload parser.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 md:px-6 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Enrolled Scholars in Database: <strong className="text-slate-900">{exportStudents.length}</strong> • Website Subjects Populated: <strong className="text-slate-900">{allDisplaySubjects.length}</strong> • Active Session: <strong className="text-slate-900">{schoolInfo.activeSession || selectedSession}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
