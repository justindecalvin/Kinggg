import React, { useState, useMemo } from 'react';
import { useSchool } from '../../../context/SchoolContext';
import { StudentProfile, ParentProfile } from '../../../types';
import { 
  X, 
  Download, 
  Printer, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Users, 
  GraduationCap, 
  Lock, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  FileSpreadsheet, 
  CheckCircle2, 
  Layers, 
  School as SchoolIcon,
  ShieldCheck,
  Sparkles,
  Upload,
  Database
} from '../../RealIcons';

interface AdminDownloadStudentLoginsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGrouping?: 'parent' | 'class' | 'flat' | 'siblings_only';
  initialClass?: string;
}

export interface StudentLoginRecord {
  studentId: string;
  name: string;
  grade: string;
  regNumber: string;
  password: string;
  status: 'Active' | 'Alumni';
  isAlumni: boolean;
  parentName: string;
  parentLoginPhone: string;
  parentLoginEmail: string;
  parentPrimaryLogin: string;
  parentPassword: string;
  parentId?: string;
  familyKey: string;
  familyDisplayName: string;
  siblingCount: number;
  siblingNames: string[];
  isMultiSibling: boolean;
}

export const AdminDownloadStudentLoginsModal: React.FC<AdminDownloadStudentLoginsModalProps> = ({
  isOpen,
  onClose,
  initialGrouping = 'parent',
  initialClass = 'all'
}) => {
  const {
    students,
    parents,
    classes,
    subjects,
    schoolInfo,
    syncOnlineStudentsNow,
    onlineStudentsSynced,
    exportDatabaseSnapshot,
    importDatabaseSnapshot,
    unifyLocalStorageResultsToDatabase,
    dispatchCollatedResultsToDashboards
  } = useSchool();

  const [groupingMode, setGroupingMode] = useState<'parent' | 'class' | 'flat' | 'siblings_only'>(initialGrouping);
  const [selectedClass, setSelectedClass] = useState<string>(initialClass);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'alumni'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswords, setShowPasswords] = useState(true);
  const [copiedState, setCopiedState] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const migrationFileInputRef = React.useRef<HTMLInputElement | null>(null);

  // 1. Process all student records and link them to parents & identify siblings
  const allProcessedRecords = useMemo<StudentLoginRecord[]>(() => {
    // Exclude upgraded tutors who are faculty now
    const eligibleStudents = students.filter(s => !s.isUpgradedTutor);

    // Build helper map for parent lookup
    const parentById = new Map<string, ParentProfile>();
    const parentByChildId = new Map<string, ParentProfile>();

    parents.forEach(p => {
      parentById.set(p.id, p);
      if (Array.isArray(p.childrenIds)) {
        p.childrenIds.forEach(cid => {
          if (!parentByChildId.has(cid)) {
            parentByChildId.set(cid, p);
          }
        });
      }
    });

    // Preliminary map of students to compute family keys
    const rawRecords = eligibleStudents.map(student => {
      // Find parent
      let matchedParent: ParentProfile | undefined = parentByChildId.get(student.id);

      if (!matchedParent) {
        matchedParent = parents.find(p => {
          if (student.parentPhone && p.phone && p.phone.replace(/\D/g, '') === student.parentPhone.replace(/\D/g, '')) return true;
          if (student.parentEmail && p.email && p.email.toLowerCase().trim() === student.parentEmail.toLowerCase().trim()) return true;
          if (student.parentName && p.fullName && p.fullName.toLowerCase().trim() === student.parentName.toLowerCase().trim()) return true;
          return false;
        });
      }

      const parentName = matchedParent?.fullName || student.parentName || 'Parent / Guardian';
      const parentPhone = matchedParent?.phone || student.parentPhone || '';
      const parentEmail = matchedParent?.email || student.parentEmail || '';
      const parentLogin = parentPhone || parentEmail || 'Not assigned';
      const parentPassword = matchedParent?.password || 'parent2025';

      // Family Key for grouping siblings
      let familyKey = '';
      if (matchedParent?.id) {
        familyKey = `parent-id:${matchedParent.id}`;
      } else if (parentPhone) {
        const cleanPhone = parentPhone.replace(/\D/g, '');
        familyKey = cleanPhone ? `phone:${cleanPhone}` : `parent-name:${parentName.toLowerCase().trim()}`;
      } else if (parentEmail) {
        familyKey = `email:${parentEmail.toLowerCase().trim()}`;
      } else if (parentName && parentName !== 'Parent / Guardian') {
        familyKey = `parent-name:${parentName.toLowerCase().trim()}`;
      } else {
        familyKey = `student-solo:${student.id}`;
      }

      return {
        studentId: student.id,
        name: student.name || 'Unnamed Scholar',
        grade: student.grade || 'Unassigned Class',
        regNumber: student.regNumber || 'N/A',
        password: student.password || 'stanbax2025',
        status: (student.isAlumni ? 'Alumni' : 'Active') as 'Active' | 'Alumni',
        isAlumni: !!student.isAlumni,
        parentName,
        parentLoginPhone: parentPhone,
        parentLoginEmail: parentEmail,
        parentPrimaryLogin: parentLogin,
        parentPassword,
        parentId: matchedParent?.id,
        familyKey,
        familyDisplayName: parentName !== 'Parent / Guardian' ? `${parentName} Family` : `Family (${student.name})`,
        siblingCount: 0,
        siblingNames: [] as string[],
        isMultiSibling: false
      };
    });

    // Count and link siblings in second pass
    const familyMembersMap = new Map<string, StudentLoginRecord[]>();
    rawRecords.forEach(rec => {
      const existing = familyMembersMap.get(rec.familyKey) || [];
      existing.push(rec);
      familyMembersMap.set(rec.familyKey, existing);
    });

    return rawRecords.map(rec => {
      const familyGroup = familyMembersMap.get(rec.familyKey) || [rec];
      const otherSiblings = familyGroup.filter(m => m.studentId !== rec.studentId);
      const isMultiSibling = familyGroup.length > 1;

      return {
        ...rec,
        siblingCount: otherSiblings.length,
        siblingNames: otherSiblings.map(s => `${s.name} (${s.grade})`),
        isMultiSibling
      };
    });
  }, [students, parents]);

  // 2. Filtered records based on Class, Status, Search Query, and Grouping mode
  const filteredRecords = useMemo(() => {
    return allProcessedRecords.filter(rec => {
      // Status filter
      if (statusFilter === 'active' && rec.isAlumni) return false;
      if (statusFilter === 'alumni' && !rec.isAlumni) return false;

      // Sibling-only filter mode
      if (groupingMode === 'siblings_only' && !rec.isMultiSibling) {
        return false;
      }

      // Class filter
      if (selectedClass !== 'all') {
        const gradeNorm = rec.grade.toLowerCase();
        const targetNorm = selectedClass.toLowerCase();
        if (targetNorm === 'kg 2' && !gradeNorm.includes('kg 2') && !gradeNorm.includes('nursery 2')) {
          return false;
        } else if (targetNorm.includes('primary') && !gradeNorm.includes(targetNorm) && !gradeNorm.includes(targetNorm.replace('primary', 'pry'))) {
          return false;
        } else if (targetNorm === 'sss 2 science' && !gradeNorm.includes('ss 2') && !gradeNorm.includes('sss 2')) {
          return false;
        } else if (!targetNorm.includes('primary') && targetNorm !== 'kg 2' && targetNorm !== 'sss 2 science') {
          if (!gradeNorm.includes(targetNorm)) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = rec.name.toLowerCase().includes(q);
        const matchReg = rec.regNumber.toLowerCase().includes(q);
        const matchGrade = rec.grade.toLowerCase().includes(q);
        const matchParent = rec.parentName.toLowerCase().includes(q);
        const matchPhone = rec.parentLoginPhone.toLowerCase().includes(q);
        const matchEmail = rec.parentLoginEmail.toLowerCase().includes(q);
        return matchName || matchReg || matchGrade || matchParent || matchPhone || matchEmail;
      }

      return true;
    });
  }, [allProcessedRecords, selectedClass, statusFilter, searchQuery, groupingMode]);

  // 3. Grouped structures for display & download
  const groupedData = useMemo(() => {
    if (groupingMode === 'parent' || groupingMode === 'siblings_only') {
      // Group by Family Key / Parent
      const groupsMap = new Map<string, {
        familyKey: string;
        parentName: string;
        parentLoginPhone: string;
        parentLoginEmail: string;
        parentPassword: string;
        students: StudentLoginRecord[];
      }>();

      filteredRecords.forEach(rec => {
        let grp = groupsMap.get(rec.familyKey);
        if (!grp) {
          grp = {
            familyKey: rec.familyKey,
            parentName: rec.parentName,
            parentLoginPhone: rec.parentLoginPhone,
            parentLoginEmail: rec.parentLoginEmail,
            parentPassword: rec.parentPassword,
            students: []
          };
          groupsMap.set(rec.familyKey, grp);
        }
        grp.students.push(rec);
      });

      // Sort families: multi-sibling families first or alphabetical by parent name
      return Array.from(groupsMap.values()).sort((a, b) => {
        if (b.students.length !== a.students.length) {
          return b.students.length - a.students.length;
        }
        return a.parentName.localeCompare(b.parentName);
      });
    }

    if (groupingMode === 'class') {
      // Group by Grade / Class
      const groupsMap = new Map<string, {
        grade: string;
        students: StudentLoginRecord[];
      }>();

      filteredRecords.forEach(rec => {
        let grp = groupsMap.get(rec.grade);
        if (!grp) {
          grp = {
            grade: rec.grade,
            students: []
          };
          groupsMap.set(rec.grade, grp);
        }
        grp.students.push(rec);
      });

      return Array.from(groupsMap.values()).sort((a, b) => a.grade.localeCompare(b.grade));
    }

    // Flat mode
    return filteredRecords;
  }, [filteredRecords, groupingMode]);

  // Overall Statistics
  const totalStudentsCount = filteredRecords.length;
  const uniqueFamiliesCount = useMemo(() => {
    return new Set(filteredRecords.map(r => r.familyKey)).size;
  }, [filteredRecords]);
  const multiSiblingStudentsCount = useMemo(() => {
    return filteredRecords.filter(r => r.isMultiSibling).length;
  }, [filteredRecords]);

  // Server re-sync & live publish handler (pushes current edited roster, logins, subjects & results live)
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const unifyRes = await unifyLocalStorageResultsToDatabase();
      await dispatchCollatedResultsToDashboards('all');
      await syncOnlineStudentsNow();
      setSyncFeedback(
        unifyRes?.message ||
        `Published & synchronized ${students.filter(s => !s.isUpgradedTutor).length} scholars, logins, and ${subjects.length} subjects live across all devices.`
      );
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch {
      setSyncFeedback('Unable to reach server database.');
      setTimeout(() => setSyncFeedback(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  // Export Complete Migration Backup (Edited Students + Logins + Subjects + Classes + Results)
  const handleExportMigrationBackup = () => {
    try {
      const snapshotJson = exportDatabaseSnapshot();
      const timestamp = new Date().toISOString().split('T')[0];
      const blob = new Blob([snapshotJson], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Stanbax_Complete_Migration_${totalStudentsCount}_Scholars_Logins_Subjects_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSyncFeedback(`Downloaded full migration backup (${totalStudentsCount} scholars, logins & ${subjects.length} created subjects).`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err: any) {
      setSyncFeedback(`Export failed: ${err?.message || 'Unexpected error'}`);
    }
  };

  // Import Complete Migration Backup (Restores exact edited students, logins & subjects and replaces demo roster)
  const handleImportMigrationBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const content = event.target?.result as string;
        const result = await importDatabaseSnapshot(content);
        if (result.success) {
          setSyncFeedback(`${result.message} Syncing live to portals...`);
          await unifyLocalStorageResultsToDatabase();
          await dispatchCollatedResultsToDashboards('all');
        } else {
          setSyncFeedback(result.message);
        }
        setTimeout(() => setSyncFeedback(null), 6000);
      } catch (err: any) {
        setSyncFeedback(`Import failed: ${err?.message || 'Invalid migration file'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Helper for CSV escaping
  const escapeCsv = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  // 4. Download CSV Handler
  const handleDownloadCsv = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const schoolName = schoolInfo?.name || 'Stanbax Schools Ibadan';
    let csvRows: string[] = [];

    // Header info rows
    csvRows.push(escapeCsv(schoolName));
    csvRows.push(escapeCsv(`OFFICIAL STUDENT & PARENT LOGINS DIRECTORY (TABULATED)`));
    csvRows.push(escapeCsv(`Export Date: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} | Session: ${schoolInfo?.activeSession || '2025/2026'} | Term: ${schoolInfo?.activeTerm || '1st Term'}`));
    csvRows.push(escapeCsv(`Total Students: ${totalStudentsCount} | Total Families: ${uniqueFamiliesCount} | Grouping Mode: ${groupingMode.toUpperCase()}`));
    csvRows.push(''); // Blank row

    if (groupingMode === 'parent' || groupingMode === 'siblings_only') {
      // Grouped by Parent / Siblings format
      csvRows.push([
        escapeCsv('Family / Parent Unit'),
        escapeCsv('Parent Login (Phone)'),
        escapeCsv('Parent Email'),
        escapeCsv('Parent Password'),
        escapeCsv('Class'),
        escapeCsv('Scholar Name'),
        escapeCsv('Student Login (Reg Number)'),
        escapeCsv('Student Password'),
        escapeCsv('Enrollment Status'),
        escapeCsv('Sibling Count in Family'),
        escapeCsv('Linked Siblings')
      ].join(','));

      const groups = groupedData as Array<{
        familyKey: string;
        parentName: string;
        parentLoginPhone: string;
        parentLoginEmail: string;
        parentPassword: string;
        students: StudentLoginRecord[];
      }>;

      groups.forEach(grp => {
        grp.students.forEach((s) => {
          csvRows.push([
            escapeCsv(grp.parentName),
            escapeCsv(grp.parentLoginPhone || 'N/A'),
            escapeCsv(grp.parentLoginEmail || 'N/A'),
            escapeCsv(grp.parentPassword),
            escapeCsv(s.grade),
            escapeCsv(s.name),
            escapeCsv(s.regNumber),
            escapeCsv(s.password),
            escapeCsv(s.status),
            escapeCsv(s.siblingCount),
            escapeCsv(s.siblingNames.join('; ') || 'None (Single Child)')
          ].join(','));
        });
      });
    } else if (groupingMode === 'class') {
      // Grouped by Class format
      csvRows.push([
        escapeCsv('Class / Grade'),
        escapeCsv('Scholar Name'),
        escapeCsv('Student Login (Reg Number)'),
        escapeCsv('Student Password'),
        escapeCsv('Parent Name'),
        escapeCsv('Parent Login (Phone)'),
        escapeCsv('Parent Email'),
        escapeCsv('Parent Password'),
        escapeCsv('Sibling Status'),
        escapeCsv('Linked Siblings')
      ].join(','));

      const groups = groupedData as Array<{
        grade: string;
        students: StudentLoginRecord[];
      }>;

      groups.forEach(grp => {
        grp.students.forEach(s => {
          csvRows.push([
            escapeCsv(s.grade),
            escapeCsv(s.name),
            escapeCsv(s.regNumber),
            escapeCsv(s.password),
            escapeCsv(s.parentName),
            escapeCsv(s.parentLoginPhone || 'N/A'),
            escapeCsv(s.parentLoginEmail || 'N/A'),
            escapeCsv(s.parentPassword),
            escapeCsv(s.isMultiSibling ? `Family of ${s.siblingCount + 1}` : 'Single Child'),
            escapeCsv(s.siblingNames.join('; ') || 'None')
          ].join(','));
        });
      });
    } else {
      // Flat Tabulated format
      csvRows.push([
        escapeCsv('Class'),
        escapeCsv('Name'),
        escapeCsv('Student Login (Reg Number)'),
        escapeCsv('Student Password'),
        escapeCsv('Parent Login (Phone / Identifier)'),
        escapeCsv('Parent Name'),
        escapeCsv('Parent Email'),
        escapeCsv('Parent Password'),
        escapeCsv('Sibling Count'),
        escapeCsv('Linked Siblings')
      ].join(','));

      (groupedData as StudentLoginRecord[]).forEach(s => {
        csvRows.push([
          escapeCsv(s.grade),
          escapeCsv(s.name),
          escapeCsv(s.regNumber),
          escapeCsv(s.password),
          escapeCsv(s.parentPrimaryLogin),
          escapeCsv(s.parentName),
          escapeCsv(s.parentLoginEmail || 'N/A'),
          escapeCsv(s.parentPassword),
          escapeCsv(s.siblingCount),
          escapeCsv(s.siblingNames.join('; ') || 'None')
        ].join(','));
      });
    }

    // Add BOM for Microsoft Excel UTF-8 display compatibility
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Stanbax_Student_and_Parent_Logins_${groupingMode}_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 5. Copy Tabulated Data (TSV format for Excel/Sheets paste)
  const handleCopyTsv = () => {
    let tsvRows: string[] = [];
    tsvRows.push([
      'Class',
      'Name',
      'Student Password',
      'Student Login (Reg Number)',
      'Parent Login (Phone)',
      'Parent Name',
      'Parent Password',
      'Siblings'
    ].join('\t'));

    filteredRecords.forEach(s => {
      tsvRows.push([
        s.grade,
        s.name,
        s.password,
        s.regNumber,
        s.parentPrimaryLogin,
        s.parentName,
        s.parentPassword,
        s.isMultiSibling ? s.siblingNames.join(', ') : 'None'
      ].join('\t'));
    });

    const content = tsvRows.join('\n');
    navigator.clipboard.writeText(content).then(() => {
      setCopiedState('table');
      setTimeout(() => setCopiedState(null), 3000);
    });
  };

  // 6. Print / PDF Tabulated Slip Generator
  const handlePrintPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up window blocked. Please allow pop-ups to print this tabulated directory.');
      return;
    }

    const schoolTitle = schoolInfo?.name || 'Stanbax Schools Ibadan';
    const motto = schoolInfo?.motto || 'Excellence and Character';
    const address = schoolInfo?.address || 'Ibadan, Oyo State, Nigeria';
    const session = schoolInfo?.activeSession || '2025/2026';
    const term = schoolInfo?.activeTerm || '1st Term';
    const dateFormatted = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    let tableHtml = '';

    if (groupingMode === 'parent' || groupingMode === 'siblings_only') {
      const groups = groupedData as Array<{
        familyKey: string;
        parentName: string;
        parentLoginPhone: string;
        parentLoginEmail: string;
        parentPassword: string;
        students: StudentLoginRecord[];
      }>;

      tableHtml = groups.map((grp, gIdx) => `
        <div style="margin-bottom: 22px; page-break-inside: avoid; border: 1.5px solid #991b1b; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #fef2f2; padding: 10px 14px; border-bottom: 1.5px solid #991b1b; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 800; font-size: 13px; color: #7f1d1d;">👨‍👩‍👧‍👦 Family #${gIdx + 1}: ${grp.parentName}</span>
              <span style="background-color: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; margin-left: 8px;">
                ${grp.students.length} ${grp.students.length > 1 ? 'Siblings' : 'Scholar'}
              </span>
            </div>
            <div style="font-size: 11px; color: #451a03; font-weight: 700;">
              Parent Login: <span style="font-family: monospace; background: #fff; padding: 2px 6px; border: 1px solid #fca5a5; border-radius: 4px;">${grp.parentLoginPhone || grp.parentLoginEmail || 'N/A'}</span>
              &nbsp;|&nbsp; Parent Pass: <span style="font-family: monospace; background: #fff; padding: 2px 6px; border: 1px solid #fca5a5; border-radius: 4px;">${grp.parentPassword}</span>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background-color: #fff1f2; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #881337;">
                <th style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; width: 22%;">Class / Grade</th>
                <th style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; width: 30%;">Scholar Full Name</th>
                <th style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; width: 24%;">Student Login (Reg No)</th>
                <th style="padding: 7px 10px; border-bottom: 1px solid #e2e8f0; width: 24%;">Student Password</th>
              </tr>
            </thead>
            <tbody>
              ${grp.students.map(s => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">${s.grade}</td>
                  <td style="padding: 8px 10px; font-weight: 800; color: #1e293b;">${s.name}</td>
                  <td style="padding: 8px 10px; font-family: monospace; font-weight: 700; color: #991b1b;">${s.regNumber}</td>
                  <td style="padding: 8px 10px; font-family: monospace; font-weight: 800; color: #047857; background-color: #f0fdf4;">${s.password}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('');
    } else {
      tableHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background-color: #991b1b; color: #ffffff; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 8px 10px; border: 1px solid #7f1d1d; width: 14%;">Class</th>
              <th style="padding: 8px 10px; border: 1px solid #7f1d1d; width: 22%;">Scholar Name</th>
              <th style="padding: 8px 10px; border: 1px solid #7f1d1d; width: 16%;">Student Login</th>
              <th style="padding: 8px 10px; border: 1px solid #7f1d1d; width: 14%;">Password</th>
              <th style="padding: 8px 10px; border: 1px solid #7f1d1d; width: 18%;">Parent Login (Phone)</th>
              <th style="padding: 8px 10px; border: 1px solid #7f1d1d; width: 16%;">Parent Pass</th>
            </tr>
          </thead>
          <tbody>
            ${filteredRecords.map((s, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 10px; font-weight: 700; color: #0f172a; border-right: 1px solid #e2e8f0;">${s.grade}</td>
                <td style="padding: 7px 10px; font-weight: 800; color: #1e293b; border-right: 1px solid #e2e8f0;">
                  ${s.name}
                  ${s.isMultiSibling ? `<span style="font-size: 9px; color: #7c2d12; font-weight: 600; display: block;">Sibling: ${s.siblingNames[0] || 'Linked'}</span>` : ''}
                </td>
                <td style="padding: 7px 10px; font-family: monospace; font-weight: 700; color: #991b1b; border-right: 1px solid #e2e8f0;">${s.regNumber}</td>
                <td style="padding: 7px 10px; font-family: monospace; font-weight: 800; color: #047857; background-color: #f0fdf4; border-right: 1px solid #e2e8f0;">${s.password}</td>
                <td style="padding: 7px 10px; font-family: monospace; font-weight: 600; color: #334155; border-right: 1px solid #e2e8f0;">${s.parentPrimaryLogin}</td>
                <td style="padding: 7px 10px; font-family: monospace; font-weight: 700; color: #b45309; background-color: #fffbeb;">${s.parentPassword}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${schoolTitle} - Official Student & Parent Logins</title>
          <style>
            @media print {
              @page { size: portrait; margin: 12mm; }
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 24px; }
            .header { text-align: center; border-bottom: 2.5px solid #991b1b; padding-bottom: 12px; margin-bottom: 16px; }
            .school-name { font-size: 20px; font-weight: 900; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
            .school-motto { font-size: 11px; font-style: italic; color: #64748b; margin: 2px 0 6px 0; }
            .doc-title { font-size: 13px; font-weight: 800; text-transform: uppercase; background: #991b1b; color: #fff; display: inline-block; padding: 4px 16px; border-radius: 4px; letter-spacing: 0.5px; margin-top: 4px; }
            .meta-bar { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 16px; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
            .footer-confidential { margin-top: 24px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 16px; display: flex; justify-content: flex-end; gap: 8px;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #991b1b; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Print / Save as PDF</button>
            <button onclick="window.close()" style="padding: 8px 16px; background: #64748b; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Close</button>
          </div>
          <div class="header">
            <h1 class="school-name">${schoolTitle}</h1>
            <p class="school-motto">"${motto}" • ${address}</p>
            <div class="doc-title">Student Credentials & Parent Login Registry</div>
          </div>
          <div class="meta-bar">
            <div><strong>Academic Session:</strong> ${session} (${term})</div>
            <div><strong>Grouping:</strong> ${groupingMode.toUpperCase()} | <strong>Scholars:</strong> ${totalStudentsCount}</div>
            <div><strong>Generated:</strong> ${dateFormatted}</div>
          </div>
          ${tableHtml}
          <div class="footer-confidential">
            CONFIDENTIAL ACADEMIC RECORD — STRICTLY FOR SCHOOL ADMINISTRATIVE USE ONLY.
            Issued by the Central Registry of ${schoolTitle}. All logins are synchronized with institutional database.
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-950/75 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-red-800 via-red-900 to-amber-950 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Download Student & Parent Logins
                </h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-stone-950">
                  Tabulated Format
                </span>
              </div>
              <p className="text-xs text-amber-100/80 mt-0.5">
                Class, Scholar Name, Password, and Parent Login • Group by Parents, Siblings, or Class
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={migrationFileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportMigrationBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleExportMigrationBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-black transition shadow-xs cursor-pointer"
              title="Download all edited students, logins, passwords, and created subjects for hosting migration"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Export Migration Backup ({totalStudentsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => migrationFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition border border-white/25 cursor-pointer"
              title="Import migration backup file (.json) to restore edited students, logins, and subjects"
            >
              <Upload className="w-3.5 h-3.5 text-amber-300" />
              <span>Import Migration File</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition border border-emerald-400/40 disabled:opacity-50 cursor-pointer"
              title="Push this browser's edited students, logins, subjects, and results live to all devices & portals"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-200' : ''}`} />
              <span>{isSyncing ? 'Publishing Live...' : 'Push & Sync Live'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live sync banner notification if active */}
        {syncFeedback && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Action Controls & Grouping Bar */}
        <div className="p-4 sm:p-5 bg-stone-50 border-b border-stone-200 space-y-3 shrink-0">
          {/* Top row: Grouping Selector & Main Export Buttons */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Grouping Selector Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[11px] font-extrabold uppercase text-stone-500 mr-1 shrink-0">
                Group By:
              </span>
              {[
                { id: 'parent', label: 'Parent / Siblings', icon: Users, badge: `${uniqueFamiliesCount} Families` },
                { id: 'class', label: 'By Class / Grade', icon: SchoolIcon, badge: `${classes.length} Classes` },
                { id: 'flat', label: 'Flat Roster (All)', icon: Layers, badge: `${totalStudentsCount} Scholars` },
                { id: 'siblings_only', label: 'Siblings Only (Multi-Child)', icon: Sparkles, badge: `${multiSiblingStudentsCount}` }
              ].map(tab => {
                const Icon = tab.icon;
                const isSelected = groupingMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setGroupingMode(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-red-700 text-white shadow-xs'
                        : 'bg-white text-stone-700 hover:bg-stone-200/80 border border-stone-200'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-300' : 'text-stone-500'}`} />
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                    }`}>
                      {tab.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Main Download and Print Buttons */}
            <div className="flex items-center gap-2 self-start lg:self-auto shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-98"
                id="btn-download-tabulated-csv"
                title="Download formatted CSV spreadsheet for Excel or Google Sheets"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>Download CSV (Excel)</span>
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-black text-xs shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-98"
                id="btn-print-tabulated-pdf"
                title="Print or Save official tabulated credentials document as PDF"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Print / PDF Document</span>
              </button>

              <button
                type="button"
                onClick={handleCopyTsv}
                className="px-3 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                title="Copy tabulated data to clipboard for instant pasting into Excel"
              >
                {copiedState === 'table' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-stone-500" />
                    <span>Copy Table</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom row: Filter Controls, Class Dropdown & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 items-center pt-1 border-t border-stone-200/60">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search scholar name, class, reg number, parent name, or phone..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-red-600/30 bg-white"
              />
            </div>

            {/* Class Filter */}
            <div>
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-red-600/30 bg-white"
              >
                <option value="all">All Classes & Arms ({classes.length})</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Passwords Visibility Toggle */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="w-full py-1.5 px-3 rounded-xl bg-stone-200/80 hover:bg-stone-300 text-stone-800 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPasswords ? 'Mask Passwords' : 'Show Passwords'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body / Tabulated Preview Table */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Summary Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-stone-600 bg-amber-50/70 p-3 rounded-2xl border border-amber-200/80 gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-900">
                Ready to download:
              </span>
              <span className="px-2 py-0.5 rounded-md bg-red-700 text-white font-mono font-bold text-[11px]">
                {totalStudentsCount} Scholars
              </span>
              <span>across</span>
              <span className="px-2 py-0.5 rounded-md bg-stone-900 text-white font-mono font-bold text-[11px]">
                {uniqueFamiliesCount} Family Units
              </span>
              {multiSiblingStudentsCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px]">
                  {multiSiblingStudentsCount} with Enrolled Siblings
                </span>
              )}
            </div>

            <div className="text-[11px] text-stone-500 font-medium">
              💡 Changes in student/parent passwords & assignments sync dynamically here.
            </div>
          </div>

          {/* Render Tabulated Preview: Grouped by Parent/Siblings */}
          {(groupingMode === 'parent' || groupingMode === 'siblings_only') && (
            <div className="space-y-4">
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs">
                  No scholars found matching your search or filter parameters.
                </div>
              ) : (
                (groupedData as Array<{
                  familyKey: string;
                  parentName: string;
                  parentLoginPhone: string;
                  parentLoginEmail: string;
                  parentPassword: string;
                  students: StudentLoginRecord[];
                }>).map((group, gIdx) => (
                  <div key={group.familyKey} className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    {/* Family Header */}
                    <div className="bg-stone-50 px-4 py-3 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Users className="w-4 h-4 text-red-700" />
                        <span className="font-black text-xs text-stone-900">
                          {group.parentName}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          group.students.length > 1
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-stone-100 text-stone-600'
                        }`}>
                          {group.students.length} {group.students.length > 1 ? 'Siblings Linked' : 'Scholar'}
                        </span>
                      </div>

                      {/* Parent Login Details Badge */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-stone-500">Parent Login:</span>
                          <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded-lg border border-stone-300 text-[11px]">
                            {group.parentLoginPhone || group.parentLoginEmail || 'No phone/email configured'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase font-bold text-stone-500">Parent Password:</span>
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-[11px]">
                            {showPasswords ? group.parentPassword : '••••••••'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Children Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-stone-100/60 text-stone-600 uppercase tracking-wider text-[10px] font-bold border-b border-stone-200">
                            <th className="py-2.5 px-4">Class</th>
                            <th className="py-2.5 px-4">Scholar Name</th>
                            <th className="py-2.5 px-4">Student Login (Reg Number)</th>
                            <th className="py-2.5 px-4">Student Password</th>
                            <th className="py-2.5 px-4">Parent Login</th>
                            <th className="py-2.5 px-4 text-right">Siblings in School</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 font-medium">
                          {group.students.map(student => (
                            <tr key={student.studentId} className="hover:bg-red-50/20 transition-colors">
                              <td className="py-2.5 px-4 font-bold text-stone-900">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-[11px]">
                                  {student.grade}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-black text-stone-950">
                                {student.name}
                              </td>
                              <td className="py-2.5 px-4 font-mono font-bold text-red-700 text-[11px]">
                                {student.regNumber}
                              </td>
                              <td className="py-2.5 px-4 font-mono font-black text-emerald-800 text-xs">
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                                  {showPasswords ? student.password : '••••••••'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[11px] text-stone-700">
                                {student.parentPrimaryLogin}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {student.isMultiSibling ? (
                                  <span className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                    {student.siblingNames.length} Sibling{student.siblingNames.length > 1 ? 's' : ''}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-stone-400">Single</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Render Tabulated Preview: Grouped by Class */}
          {groupingMode === 'class' && (
            <div className="space-y-4">
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs">
                  No scholars found in selected classes.
                </div>
              ) : (
                (groupedData as Array<{
                  grade: string;
                  students: StudentLoginRecord[];
                }>).map(group => (
                  <div key={group.grade} className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                    <div className="bg-stone-50 px-4 py-2.5 border-b border-stone-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SchoolIcon className="w-4 h-4 text-red-700" />
                        <span className="font-black text-xs text-stone-900">
                          {group.grade}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200/80 text-stone-700">
                          {group.students.length} Enrolled
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-stone-100/60 text-stone-600 uppercase tracking-wider text-[10px] font-bold border-b border-stone-200">
                            <th className="py-2.5 px-4">Scholar Name</th>
                            <th className="py-2.5 px-4">Student Login</th>
                            <th className="py-2.5 px-4">Student Password</th>
                            <th className="py-2.5 px-4">Parent Name</th>
                            <th className="py-2.5 px-4">Parent Login (Phone)</th>
                            <th className="py-2.5 px-4">Parent Password</th>
                            <th className="py-2.5 px-4 text-right">Siblings</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 font-medium">
                          {group.students.map(student => (
                            <tr key={student.studentId} className="hover:bg-red-50/20 transition-colors">
                              <td className="py-2.5 px-4 font-black text-stone-950">
                                {student.name}
                              </td>
                              <td className="py-2.5 px-4 font-mono font-bold text-red-700 text-[11px]">
                                {student.regNumber}
                              </td>
                              <td className="py-2.5 px-4 font-mono font-black text-emerald-800 text-xs">
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                                  {showPasswords ? student.password : '••••••••'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-stone-800 font-bold">
                                {student.parentName}
                              </td>
                              <td className="py-2.5 px-4 font-mono text-[11px] text-stone-700">
                                {student.parentPrimaryLogin}
                              </td>
                              <td className="py-2.5 px-4 font-mono font-bold text-amber-800 text-[11px]">
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                                  {showPasswords ? student.parentPassword : '••••••••'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                {student.isMultiSibling ? (
                                  <span className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                    {student.siblingNames.length} in Other Arms
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-stone-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Render Tabulated Preview: Flat Roster */}
          {groupingMode === 'flat' && (
            <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase tracking-wider text-[10px] font-black">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Scholar Name</th>
                      <th className="py-3 px-4">Student Login (Reg No)</th>
                      <th className="py-3 px-4">Student Password</th>
                      <th className="py-3 px-4">Parent Name</th>
                      <th className="py-3 px-4">Parent Login</th>
                      <th className="py-3 px-4">Parent Password</th>
                      <th className="py-3 px-4 text-right">Siblings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-stone-400 text-xs">
                          No records match your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((s, idx) => (
                        <tr key={s.studentId} className="hover:bg-red-50/20 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-stone-400">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 font-bold text-stone-900">
                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-800 text-[11px]">
                              {s.grade}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black text-stone-950">
                            {s.name}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-red-700 text-[11px]">
                            {s.regNumber}
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-emerald-800 text-xs">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                              {showPasswords ? s.password : '••••••••'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-stone-800 font-bold">
                            {s.parentName}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-stone-700">
                            {s.parentPrimaryLogin}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-800 text-[11px]">
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                              {showPasswords ? s.parentPassword : '••••••••'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {s.isMultiSibling ? (
                              <span className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                {s.siblingCount} Siblings
                              </span>
                            ) : (
                              <span className="text-[10px] text-stone-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-stone-500 font-medium">
            Confidential credentials document • For authorised Stanbax administration use only.
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              <span>Download Tabulated CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
