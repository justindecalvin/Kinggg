import React, { useState, useRef } from 'react';
import { 
  Database, 
  Cloud, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  Download, 
  Upload, 
  FileCode, 
  Server, 
  Globe, 
  RefreshCw,
  HelpCircle,
  Lightbulb,
  Smartphone,
  Laptop
} from '../../RealIcons';
import { useSchool } from '../../../context/SchoolContext';
import { isRemoteEnabled, configureSupabaseCredentials, syncLocalSchoolStateToSupabase } from '../../../lib/supabase';
import schemaSql from '../../../../supabase/schema.sql?raw';

interface NetlifyCloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetlifyCloudSyncModal: React.FC<NetlifyCloudSyncModalProps> = ({
  isOpen,
  onClose
}) => {
  const { exportDatabaseSnapshot, importDatabaseSnapshot, students, tutors, classes } = useSchool();
  
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [directUrl, setDirectUrl] = useState(() => {
    try {
      return localStorage.getItem('stanbax_supabase_url') || '';
    } catch { return ''; }
  });
  const [directKey, setDirectKey] = useState(() => {
    try {
      return localStorage.getItem('stanbax_supabase_anon_key') || '';
    } catch { return ''; }
  });
  const [connectMessage, setConnectMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  if (!isOpen) return null;

  const isConnected = isRemoteEnabled();

  const handleSaveDirectCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directUrl.trim() || !directKey.trim()) {
      setConnectMessage({ success: false, text: 'Please enter both the Supabase Project URL and Anon Public Key.' });
      return;
    }
    setIsConnecting(true);
    setConnectMessage({ success: true, text: 'Connecting to Supabase and uploading all school records (scholars, subjects, classes)...' });
    try {
      const ok = configureSupabaseCredentials(directUrl.trim(), directKey.trim());
      if (ok) {
        const syncRes = await syncLocalSchoolStateToSupabase();
        if (syncRes.ok) {
          setConnectMessage({
            success: true,
            text: `Supabase Connected! ${syncRes.written} collections (scholars, classes, subjects, credentials) uploaded to cloud database. Refreshing in 3 seconds to activate multi-device sync...`
          });
          setTimeout(() => {
            window.location.reload();
          }, 3200);
        } else {
          setConnectMessage({
            success: false,
            text: `Supabase credentials saved, but database synchronization returned: ${syncRes.message}. (Make sure you pasted schema.sql in Supabase SQL Editor).`
          });
        }
      } else {
        setConnectMessage({ success: false, text: 'Failed to configure Supabase credentials.' });
      }
    } catch (err: any) {
      setConnectMessage({ success: false, text: err?.message || 'Connection error.' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSyncAllNow = async () => {
    setIsSyncingAll(true);
    setConnectMessage(null);
    try {
      const res = await syncLocalSchoolStateToSupabase();
      setConnectMessage({
        success: res.ok,
        text: res.ok ? `Successfully uploaded ${res.written} records directly to Supabase!` : res.message
      });
    } catch (err: any) {
      setConnectMessage({ success: false, text: err?.message || 'Sync failed.' });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(schemaSql);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 3000);
  };

  const handleDownloadBackup = () => {
    setIsExporting(true);
    try {
      const snapshot = exportDatabaseSnapshot();
      const blob = new Blob([snapshot], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `stanbax_schools_data_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export backup', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setImportStatus({ success: true, message: 'Restoring backup data and synchronizing scholars with Supabase cloud database...' });
        const text = event.target?.result as string;
        const result = await importDatabaseSnapshot(text);
        setImportStatus(result);
        if (result.success) {
          setTimeout(() => {
            window.location.reload();
          }, 3500);
        }
      } catch (err: any) {
        setImportStatus({
          success: false,
          message: 'Could not read backup file: ' + (err?.message || 'Invalid format')
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        
        {/* Header */}
        <div className={`p-5 sm:p-6 text-white flex items-start justify-between gap-4 ${
          isConnected ? 'bg-gradient-to-r from-emerald-800 to-teal-900' : 'bg-gradient-to-r from-stone-900 via-amber-950 to-stone-900'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-md shrink-0 ${
              isConnected ? 'bg-emerald-600/60 border border-emerald-400' : 'bg-amber-500/20 border border-amber-400/40 text-amber-300'
            }`}>
              {isConnected ? <Cloud className="w-6 h-6 text-emerald-200" /> : <Database className="w-6 h-6 text-amber-300" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                  isConnected 
                    ? 'bg-emerald-400/20 text-emerald-200 border border-emerald-400/30' 
                    : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                }`}>
                  {isConnected ? 'Live Cloud Database Active' : 'Single-Browser Mode (LocalStorage Only)'}
                </span>
                <span className="text-[11px] text-stone-300 font-medium">Netlify Deployment</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black mt-1">
                {isConnected 
                  ? 'Multi-Device Database Synchronization is Active' 
                  : 'Why Changes Disappear on Other Browsers & How to Fix'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6 text-stone-800 text-xs sm:text-sm">

          {/* DIAGNOSIS BANNER */}
          {isConnected ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-sm">Your Central Database is Connected!</strong>
                <p className="mt-1 leading-relaxed text-xs">
                  Whenever you register a new student, upload results, or adjust school fees on any computer, phone, or tablet, the changes are stored in PostgreSQL on Supabase and immediately visible worldwide.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-2">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-black text-sm text-amber-900">
                    Why data is not visible when you log in on another browser:
                  </h3>
                  <p className="mt-1 leading-relaxed text-xs text-amber-900">
                    Netlify is a <strong>static website host</strong>. Without connecting a central cloud database, web applications save new records into the individual browser’s internal cache (<code className="font-mono bg-white/80 px-1.5 py-0.5 rounded text-amber-950 font-bold">localStorage</code>).
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-amber-200/80 text-xs">
                <div className="flex items-center gap-2 p-2 bg-white/70 rounded-xl">
                  <Laptop className="w-4 h-4 text-stone-600 shrink-0" />
                  <span><strong>Browser A (where you registered):</strong> Data is stored in this browser's local sandbox only.</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-white/70 rounded-xl">
                  <Smartphone className="w-4 h-4 text-stone-600 shrink-0" />
                  <span><strong>Browser B (phone/new browser):</strong> Has its own blank sandbox, so the new student is not there yet.</span>
                </div>
              </div>
            </div>
          )}

          {/* DIRECT CLOUD CONNECTION PANEL */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-950 text-white border border-stone-700 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                <h4 className="font-black text-sm text-stone-100">
                  {isConnected ? 'Supabase Live Connection Active' : 'Direct Supabase Connection (Instant Sync)'}
                </h4>
              </div>
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                isConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {isConnected ? 'Connected' : 'Offline / Setup Pending'}
              </span>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              Paste your Supabase credentials here to instantly connect your school database right now, or add them as environment variables in Netlify. Once connected, every registration, fee payment, grade change, and file upload is committed directly to PostgreSQL.
            </p>

            <form onSubmit={handleSaveDirectCredentials} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-stone-400 font-bold mb-1 text-[11px]">
                    Supabase Project URL:
                  </label>
                  <input
                    type="url"
                    value={directUrl}
                    onChange={(e) => setDirectUrl(e.target.value)}
                    placeholder="https://xyzabcdefg.supabase.co"
                    className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-stone-400 font-bold mb-1 text-[11px]">
                    Supabase Anon Public Key:
                  </label>
                  <input
                    type="text"
                    value={directKey}
                    onChange={(e) => setDirectKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 rounded-xl bg-stone-800 border border-stone-700 text-stone-100 font-mono text-xs focus:ring-2 focus:ring-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              {connectMessage && (
                <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  connectMessage.success ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700' : 'bg-red-950/80 text-red-300 border border-red-700'
                }`}>
                  {connectMessage.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{connectMessage.text}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isConnecting}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{isConnecting ? 'Connecting & Syncing...' : 'Save & Connect Cloud Database'}</span>
                </button>

                {isConnected && (
                  <button
                    type="button"
                    onClick={handleSyncAllNow}
                    disabled={isSyncingAll}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                    <span>{isSyncingAll ? 'Uploading Records...' : 'Upload & Sync All Current School Data Now'}</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* THE PERMANENT FIX */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2 border-stone-200">
              <h3 className="font-black text-sm uppercase tracking-wider text-stone-900 flex items-center gap-2">
                <Server className="w-4 h-4 text-red-600" />
                Permanent Fix: 3-Minute Setup on Netlify & Supabase
              </h3>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                100% Free
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between space-y-3">
                <div>
                  <div className="w-6 h-6 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center mb-2">
                    1
                  </div>
                  <strong className="block text-stone-900 font-bold mb-1">Create Free Project</strong>
                  <p className="text-stone-600 text-xs leading-relaxed">
                    Create a free PostgreSQL project at Supabase (takes 60 seconds, no credit card).
                  </p>
                </div>
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Supabase.com</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between space-y-3">
                <div>
                  <div className="w-6 h-6 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center mb-2">
                    2
                  </div>
                  <strong className="block text-stone-900 font-bold mb-1">Run Database Schema</strong>
                  <p className="text-stone-600 text-xs leading-relaxed">
                    In Supabase Dashboard → <strong>SQL Editor</strong> → click <strong>New Query</strong>, paste the schema, and click <strong>Run</strong> once.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySchema}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    copiedSchema 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-red-700 hover:bg-red-800 text-white'
                  }`}
                >
                  {copiedSchema ? <Check className="w-3.5 h-3.5" /> : <FileCode className="w-3.5 h-3.5" />}
                  <span>{copiedSchema ? 'SQL Schema Copied!' : 'Copy SQL Schema (schema.sql)'}</span>
                </button>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between space-y-3">
                <div>
                  <div className="w-6 h-6 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center mb-2">
                    3
                  </div>
                  <strong className="block text-stone-900 font-bold mb-1">Add Netlify Env Vars</strong>
                  <p className="text-stone-600 text-xs leading-relaxed">
                    In Netlify Dashboard → <strong>Site configuration → Environment variables</strong>. Add the 2 variables below and trigger deploy.
                  </p>
                </div>
                <a
                  href="https://app.netlify.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Open Netlify App</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Environment Variables Copy Panel */}
            <div className="p-4 rounded-2xl bg-stone-900 text-stone-100 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                  The 2 Environment Variables to Add in Netlify:
                </span>
                <span className="text-[10px] text-stone-400">
                  (Site configuration → Environment variables)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                {/* Variable 1 */}
                <div className="p-3 rounded-xl bg-stone-800/90 border border-stone-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-stone-400 font-sans font-bold">Variable 1 Name</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('VITE_SUPABASE_URL', 'v1')}
                      className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-white text-[10px] font-sans font-bold cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === 'v1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'v1' ? 'Copied' : 'Copy Name'}</span>
                    </button>
                  </div>
                  <div className="text-emerald-400 font-bold text-xs">VITE_SUPABASE_URL</div>
                  <div className="text-[11px] text-stone-400 font-sans">
                    Value from Supabase: <strong>Project Settings → API → Project URL</strong><br />
                    <span className="text-stone-500 text-[10px]">(e.g. https://xyzabcdef.supabase.co)</span>
                  </div>
                </div>

                {/* Variable 2 */}
                <div className="p-3 rounded-xl bg-stone-800/90 border border-stone-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-stone-400 font-sans font-bold">Variable 2 Name</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('VITE_SUPABASE_ANON_KEY', 'v2')}
                      className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-white text-[10px] font-sans font-bold cursor-pointer flex items-center gap-1"
                    >
                      {copiedKey === 'v2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'v2' ? 'Copied' : 'Copy Name'}</span>
                    </button>
                  </div>
                  <div className="text-emerald-400 font-bold text-xs">VITE_SUPABASE_ANON_KEY</div>
                  <div className="text-[11px] text-stone-400 font-sans">
                    Value from Supabase: <strong>Project Settings → API → Project API Keys → anon / public</strong><br />
                    <span className="text-stone-500 text-[10px]">(starts with eyJhbGciOi...)</span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-stone-800/50 border border-stone-800 text-[11px] text-stone-300 font-sans flex items-start gap-1.5">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Important Final Step on Netlify:</strong> After saving the 2 environment variables, go to Netlify <strong>Deploys</strong> and click <strong>Trigger deploy → Deploy site</strong>. Vite embeds environment variables at build time!</span>
              </div>
            </div>
          </div>

          {/* INSTANT DATA BACKUP & TRANSFER (MIGRATION TOOLS) */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-xs uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-amber-700" />
                  Instant Backup & Cross-Browser Data Transfer
                </h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Don't lose students you already registered! Export your current school records from this browser or restore them onto another device right now.
                </p>
              </div>
            </div>

            {importStatus && (
              <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                importStatus.success ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
              }`}>
                {importStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                <span>{importStatus.message}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={isExporting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>Download School Data Backup (.json)</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                id="school-backup-input"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-amber-100/60 text-stone-900 border border-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-stone-600" />
                <span>Import Backup to This Browser</span>
              </button>

              <div className="text-[11px] text-stone-500 italic">
                Current Records: {students.length} students, {tutors.length} tutors, {classes.length} classes
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between">
          <span className="text-xs text-stone-500 font-medium">
            Stanbax Schools Ibadan • Cloud Synchronization Assistant
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-bold transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
