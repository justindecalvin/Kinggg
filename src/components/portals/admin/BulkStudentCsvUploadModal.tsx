import React, { useMemo, useRef, useState } from 'react';
import { useSchool } from '../../../context/SchoolContext';
import { CheckCircle2, Database, Download, FileSpreadsheet, Info, RefreshCw, XCircle } from '../../RealIcons';

interface BulkStudentCsvUploadProps {
  onClose?: () => void;
}

interface StudentCsvRow {
  registration_no?: string;
  full_name?: string;
  grade_level?: string;
  gender?: string;
  date_of_birth?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  email?: string;
  password?: string;
  house?: string;
  emergency_phone?: string;
  [key: string]: string | undefined;
}

const normalizeHeader = (value: string) => value.trim().toLowerCase().replace(/[\s-]+/g, '_');
const aliases: Record<string, string[]> = {
  registration_no: ['registration_no', 'registration_number', 'reg_no', 'reg_number', 'regno', 'student_id', 'admission_no', 'matric_no'],
  full_name: ['full_name', 'fullname', 'student_name', 'student', 'scholar_name', 'name'],
  grade_level: ['grade_level', 'grade', 'class', 'class_name', 'student_class', 'level'],
  gender: ['gender', 'sex'],
  date_of_birth: ['date_of_birth', 'dob', 'birth_date'],
  parent_name: ['parent_name', 'guardian_name', 'parent_guardian'],
  parent_phone: ['parent_phone', 'parent_mobile', 'guardian_phone', 'parent_contact'],
  parent_email: ['parent_email', 'guardian_email'],
  email: ['email', 'student_email', 'email_address'],
  password: ['password', 'student_password', 'passcode', 'pin'],
  house: ['house', 'house_name'],
  emergency_phone: ['emergency_phone', 'emergency_contact', 'emergency_mobile'],
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('The CSV contains an unfinished quoted field.');
  if (cell || row.length) {
    row.push(cell);
    if (row.some(value => value.trim())) rows.push(row);
  }
  return rows;
}

const csvEscape = (value: unknown) => {
  const text = String(value ?? '');
  return /[,"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const getField = (row: StudentCsvRow, key: string) => {
  const found = aliases[key]?.find(alias => row[alias] !== undefined);
  return found ? String(row[found] || '').trim() : '';
};

export const BulkStudentCsvUpload: React.FC<BulkStudentCsvUploadProps> = () => {
  const { students, bulkUpsertStudents } = useSchool();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<StudentCsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const validRows = useMemo(() => rows.filter(row => getField(row, 'full_name')), [rows]);
  const duplicateCount = useMemo(() => {
    const seen = new Set<string>();
    let duplicates = 0;
    validRows.forEach(row => {
      const key = getField(row, 'registration_no').toLowerCase().replace(/[^a-z0-9]/g, '') || getField(row, 'full_name').toLowerCase();
      if (seen.has(key)) duplicates += 1;
      seen.add(key);
    });
    return duplicates;
  }, [validRows]);

  const loadFile = (file: File) => {
    setError(null);
    setStatus(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onerror = () => setError('The selected CSV could not be read.');
    reader.onload = () => {
      try {
        const table = parseCsv(String(reader.result || '').replace(/^\uFEFF/, ''));
        if (table.length < 2) throw new Error('The CSV must contain a header row and at least one student row.');
        const headers = table[0].map(normalizeHeader);
        const nameHeader = aliases.full_name.find(alias => headers.includes(alias));
        if (!nameHeader) throw new Error('Add a full_name or student_name column to the CSV.');
        const mapped = table.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()])) as StudentCsvRow);
        const withNames = mapped.filter(row => getField(row, 'full_name'));
        if (!withNames.length) throw new Error('No student rows with names were found.');
        setRows(withNames);
      } catch (err: any) {
        setRows([]);
        setError(err?.message || 'Could not parse the CSV.');
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const headers = ['registration_no', 'full_name', 'grade_level', 'gender', 'date_of_birth', 'parent_name', 'parent_phone', 'parent_email', 'email', 'password', 'house', 'emergency_phone'];
    const sample = ['SBS/2026/001', 'Adebayo Oluwaseun', 'SSS 1 Science', 'Male', '2010-01-15', 'Adebayo Guardian', '+234 803 000 0000', '', 'adebayo@example.com', 'stanbax2025', 'Sapphire (Blue House)', ''];
    const blob = new Blob([[headers, sample].map(line => line.map(csvEscape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'stanbax_students_bulk_template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!validRows.length || isSaving) return;
    setIsSaving(true);
    setError(null);
    setStatus(null);
    try {
      const payload = validRows.map(row => ({
        id: getField(row, 'registration_no') || undefined,
        regNumber: getField(row, 'registration_no') || undefined,
        name: getField(row, 'full_name'),
        grade: getField(row, 'grade_level') || 'SSS 1 Science',
        gender: getField(row, 'gender') === 'Female' ? 'Female' : 'Male',
        dateOfBirth: getField(row, 'date_of_birth') || undefined,
        parentName: getField(row, 'parent_name') || 'Parent / Guardian',
        parentPhone: getField(row, 'parent_phone') || '+234 800 000 0000',
        parentEmail: getField(row, 'parent_email') || undefined,
        email: getField(row, 'email') || undefined,
        password: getField(row, 'password') || 'stanbax2025',
        house: getField(row, 'house') || 'Sapphire (Blue House)',
        emergencyPhone: getField(row, 'emergency_phone') || undefined,
      }));
      const result = await bulkUpsertStudents(payload, 'admin', 'Bulk Student CSV Import');
      setStatus(result.message || `Saved ${result.students?.length || payload.length} student records to the database.`);
      setRows([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err?.message || 'The bulk student upload failed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2"><Database className="w-5 h-5 text-blue-900" /> Bulk Student Roster Upload</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">Upload one CSV containing all students. Existing registration numbers are updated in place; new registration numbers are provisioned as student accounts and saved to the online database.</p>
          </div>
          <button type="button" onClick={downloadTemplate} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-2 cursor-pointer shrink-0"><Download className="w-4 h-4" /> Download template</button>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50 p-7 text-center hover:bg-blue-50 transition cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={event => event.target.files?.[0] && loadFile(event.target.files[0])} />
          <FileSpreadsheet className="w-9 h-9 mx-auto text-blue-900 mb-2" />
          <p className="text-sm font-black text-blue-950">Choose the students CSV</p>
          <p className="text-xs text-slate-500 mt-1">Required: full_name. Recommended: registration_no and grade_level.</p>
          {fileName && <p className="text-xs font-bold text-emerald-700 mt-3">{fileName}</p>}
        </div>
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 flex gap-2"><Info className="w-4 h-4 shrink-0 text-amber-600" /><span>Use registration_no as the stable database key. Re-uploading the same registration number updates the existing scholar and does not create a duplicate.</span></div>
        {error && <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-bold text-red-800 flex gap-2"><XCircle className="w-4 h-4 shrink-0" />{error}</div>}
        {status && <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{status}</div>}
      </div>
      {rows.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><h4 className="text-sm font-black text-slate-900">Ready to sync {validRows.length} student records</h4><p className="text-xs text-slate-500 mt-1">{duplicateCount ? `${duplicateCount} duplicate row(s) will be merged. ` : ''}{students.length} students currently exist in this browser.</p></div>
            <button type="button" disabled={isSaving} onClick={handleSave} className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-black flex items-center gap-2 disabled:opacity-50 cursor-pointer"><RefreshCw className={`w-4 h-4 text-amber-400 ${isSaving ? 'animate-spin' : ''}`} />{isSaving ? 'Saving to database…' : 'Upload & sync all students'}</button>
          </div>
          <div className="overflow-auto rounded-2xl border border-slate-200"><table className="w-full text-xs"><thead className="bg-slate-50"><tr><th className="text-left p-3">Registration No.</th><th className="text-left p-3">Full Name</th><th className="text-left p-3">Class</th><th className="text-left p-3">Parent Phone</th><th className="text-left p-3">Action</th></tr></thead><tbody>{validRows.slice(0, 12).map((row, index) => <tr key={`${getField(row, 'registration_no')}-${index}`} className="border-t border-slate-100"><td className="p-3 font-bold">{getField(row, 'registration_no') || 'Auto-generated'}</td><td className="p-3">{getField(row, 'full_name')}</td><td className="p-3">{getField(row, 'grade_level') || 'SSS 1 Science'}</td><td className="p-3">{getField(row, 'parent_phone') || '—'}</td><td className="p-3 text-emerald-700 font-bold">{getField(row, 'registration_no') ? 'Upsert' : 'Create'}</td></tr>)}</tbody></table></div>
          {validRows.length > 12 && <p className="text-[11px] text-slate-500">Showing the first 12 rows of {validRows.length}. All rows will be uploaded.</p>}
        </div>
      )}
    </div>
  );
};
