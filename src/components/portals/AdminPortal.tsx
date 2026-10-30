import React, { useEffect, useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { SchoolLogo } from '../SchoolLogo';
import { 
  Building2, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Award, 
  Settings, 
  Calendar, 
  FileText, 
  LogOut, 
  Search, 
  ChevronRight, 
  Layers, 
  ShieldCheck, 
  Key, 
  Radio, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Menu,
  X,
  HelpCircle,
  Layout,
  MessageSquare,
  School as SchoolIcon,
  Camera,
  Download,
  Palette
} from '../RealIcons';

import { AdminStudentsAlumniTab } from './admin/AdminStudentsAlumniTab';
import { AdminFacultyTab } from './admin/AdminFacultyTab';
import { AdminTutorAssignmentsTab } from './admin/AdminTutorAssignmentsTab';
import { AdminClassesFeesTab } from './admin/AdminClassesFeesTab';
import { AdminSubjectsGradingTab } from './admin/AdminSubjectsGradingTab';
import { AdminResultCollationTab } from './admin/AdminResultCollationTab';
import { AdminLessonNotesTab } from './admin/AdminLessonNotesTab';
import { AdminParentBroadcastTab } from './admin/AdminParentBroadcastTab';
import { AdminProprietressTab } from './admin/AdminProprietressTab';
import { AdminCredentialsVaultTab } from './admin/AdminCredentialsVaultTab';
import { AdminSchoolSettingsTab } from './admin/AdminSchoolSettingsTab';
import { AdminSchoolCalendarTab } from './admin/AdminSchoolCalendarTab';
import { AdminLandingPageTab } from './admin/AdminLandingPageTab';
import { AdminFaqSubTab } from './admin/AdminFaqSubTab';
import { AdminCalvinTokensTab } from './admin/AdminCalvinTokensTab';
import { AdminSchemeOfWorkTab } from './admin/AdminSchemeOfWorkTab';
import { AdminCampusGalleryTab } from './admin/AdminCampusGalleryTab';
import { AdminVisitorInquiriesSubTab } from './admin/AdminVisitorInquiriesSubTab';
import { AdminRolePrivilegesTab } from './admin/AdminRolePrivilegesTab';
import { AdminContributorsTab } from './admin/AdminContributorsTab';
import { AdminWaecRegistrationTab } from './admin/AdminWaecRegistrationTab';
import { BatchResultsUploadModal } from './admin/BatchResultsUploadModal';
import { AdminQuickAddStudentModal } from './admin/AdminQuickAddStudentModal';
import { AdminFamilyLinkageModal } from './admin/AdminFamilyLinkageModal';
import { AdminDownloadStudentLoginsModal } from './admin/AdminDownloadStudentLoginsModal';
import { AdminThemeSwitcherModal } from './admin/AdminThemeSwitcherModal';
import { SchoolChatSystem } from '../chat/SchoolChatSystem';
import { SchoolPrefectBadgesModal } from '../chat/ChatLeadershipModals';
import { NetlifyCloudSyncModal } from './admin/NetlifyCloudSyncModal';
import { StudentRosterDirectoryModal } from '../StudentRosterDirectoryModal';
import { isRemoteEnabled } from '../../lib/supabase';
import { Newspaper, Compass, Database, HeartHandshake, ClipboardCheck, UploadCloud } from 'lucide-react';

interface AdminPortalProps {
  onBackToWebsite: () => void;
}

type AdminTab = 
  | 'overview'
  | 'fast_scores'
  | 'family_linkage'
  | 'roles_privileges'
  | 'chat'
  | 'calvin_tokens'
  | 'scheme_of_work'
  | 'calendar'
  | 'gallery'
  | 'students'
  | 'waec'
  | 'faculty'
  | 'assignments'
  | 'classes'
  | 'subjects'
  | 'results'
  | 'notes'
  | 'broadcasts'
  | 'proprietress'
  | 'credentials'
  | 'settings'
  | 'landing'
  | 'contributors'
  | 'faqs';

export const AdminPortal: React.FC<AdminPortalProps> = ({ onBackToWebsite }) => {
  const { 
    schoolInfo, 
    students, 
    tutors, 
    classes, 
    calvinTokens,
    galleryPhotos,
    logoutAdmin,
    attendanceRecords,
    termResumptionConfig,
    consultationRequests,
    visitorConversations,
    waecRegistrations,
    activeAdminAccount,
    isSuperAdmin,
    hasAdminPrivilege,
    adminAccounts,
    appTheme,
    availableThemes
  } = useSchool();

  const pendingConsultationsCount = consultationRequests.filter(c => c.status === 'Pending').length;
  const availableTokensCount = calvinTokens.filter(t => t.status === 'unused').length;
  const unreadVisitorInquiriesCount = visitorConversations?.filter(c => c.unreadByAdmin).length || 0;
  const pendingWaecCount = waecRegistrations?.filter(r => r.status === 'submitted').length || 0;

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [adminChatTab, setAdminChatTab] = useState<'rep_desk' | 'channels'>('rep_desk');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPrefectModal, setShowPrefectModal] = useState(false);
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showDownloadLoginsModal, setShowDownloadLoginsModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('stanbax_open_bulk_upload') === 'true') {
        sessionStorage.removeItem('stanbax_open_bulk_upload');
        setActiveTab('fast_scores');
      }
    } catch {}
  }, []);

  const handleLogout = () => {
    logoutAdmin();
    onBackToWebsite();
  };

  const allMenuItems: Array<{ id: AdminTab; label: string; icon: React.ElementType; badge?: string | number }> = [
    { id: 'overview', label: 'Dashboard Overview', icon: Layers },
    { id: 'fast_scores', label: 'Bulk Results Import / Fast Score Entry', icon: CheckCircle2, badge: 'Rapid Input' },
    { id: 'family_linkage', label: 'Family & Sibling Linkage', icon: Users, badge: 'Merge/Assign' },
    { id: 'roles_privileges', label: 'Admin Accounts & Privileges', icon: ShieldCheck, badge: `${adminAccounts.length + 1} Admins` },
    { 
      id: 'chat', 
      label: 'Community & Representative Chat', 
      icon: MessageSquare, 
      badge: unreadVisitorInquiriesCount > 0 ? `${unreadVisitorInquiriesCount} New` : 'Live' 
    },
    { id: 'calvin_tokens', label: 'Calvin AI Tokens', icon: Key, badge: availableTokensCount > 0 ? `${availableTokensCount} Ready` : undefined },
    { id: 'scheme_of_work', label: 'Schemes of Work (Curriculum Matrix)', icon: Compass, badge: 'Curriculum' },
    { id: 'calendar', label: 'Term Calendar & Events', icon: Calendar },
    { id: 'gallery', label: 'Campus Gallery & Photos', icon: Camera, badge: `${galleryPhotos?.length || 0} Photos` },
    { id: 'students', label: 'Scholars & Alumni', icon: GraduationCap, badge: students.length },
    { 
      id: 'waec', 
      label: 'WAEC / WASSCE & Bio-Data', 
      icon: ClipboardCheck, 
      badge: pendingWaecCount > 0 ? `${pendingWaecCount} New` : (waecRegistrations?.length ? `${waecRegistrations.length}` : undefined) 
    },
    { id: 'faculty', label: 'Faculty Staff', icon: Users, badge: tutors.length },
    { id: 'assignments', label: 'Tutor & Principal Roles', icon: BookOpen },
    { id: 'classes', label: 'Classes & Fees', icon: SchoolIcon, badge: classes.length },
    { id: 'subjects', label: 'Subjects & Grading', icon: Award },
    { id: 'results', label: 'Terminal Collation & Signatures', icon: CheckCircle2 },
    { id: 'notes', label: 'Lesson Notes', icon: FileText },
    { id: 'broadcasts', label: 'Parent Broadcasts & Relations', icon: Radio, badge: pendingConsultationsCount || undefined },
    { id: 'proprietress', label: 'Executive Council', icon: ShieldCheck },
    { id: 'credentials', label: 'Credentials Vault', icon: Key },
    { id: 'settings', label: 'School Settings & Signatures', icon: Settings },
    { id: 'landing', label: 'School Logo & Website CMS', icon: Layout, badge: 'Logo & Media' },
    { id: 'contributors', label: 'Website Production Credits', icon: HeartHandshake, badge: 'Credits' },
    { id: 'faqs', label: 'FAQ Manager', icon: HelpCircle }
  ];

  const isTabAllowedForAdmin = (tab: AdminTab): boolean => {
    if (isSuperAdmin) return true;
    switch (tab) {
      case 'overview':
        return true;
      case 'fast_scores':
        return hasAdminPrivilege('enter_edit_grades') || hasAdminPrivilege('collate_publish_results');
      case 'family_linkage':
        return hasAdminPrivilege('manage_students') || hasAdminPrivilege('manage_admissions');
      case 'roles_privileges':
      case 'proprietress':
      case 'credentials':
        return false;
      case 'chat':
        return hasAdminPrivilege('manage_community_chat') || hasAdminPrivilege('manage_visitor_inquiries');
      case 'calvin_tokens':
        return hasAdminPrivilege('manage_calvin_ai_tokens');
      case 'scheme_of_work':
        return hasAdminPrivilege('manage_classes_subjects') || hasAdminPrivilege('manage_lesson_notes');
      case 'calendar':
        return hasAdminPrivilege('manage_timetables') || hasAdminPrivilege('manage_landing_cms');
      case 'gallery':
      case 'landing':
      case 'contributors':
      case 'faqs':
        return hasAdminPrivilege('manage_landing_cms');
      case 'students':
        return (
          hasAdminPrivilege('manage_students') ||
          hasAdminPrivilege('manage_admissions') ||
          hasAdminPrivilege('manage_alumni_Approvals')
        );
      case 'waec':
        return hasAdminPrivilege('collate_publish_results') || hasAdminPrivilege('manage_students');
      case 'faculty':
        return hasAdminPrivilege('manage_tutors');
      case 'assignments':
        return hasAdminPrivilege('manage_tutors') || hasAdminPrivilege('manage_classes_subjects');
      case 'classes':
        return hasAdminPrivilege('manage_classes_subjects') || hasAdminPrivilege('manage_fee_verifications');
      case 'subjects':
        return hasAdminPrivilege('manage_classes_subjects') || hasAdminPrivilege('enter_edit_grades');
      case 'results':
      case 'settings':
        return hasAdminPrivilege('collate_publish_results');
      case 'notes':
        return hasAdminPrivilege('manage_lesson_notes');
      case 'broadcasts':
        return hasAdminPrivilege('manage_Broadcasts_notices');
      default:
        return false;
    }
  };

  const menuItems = allMenuItems.filter(item => isTabAllowedForAdmin(item.id));

  return (
    <div data-stanbax-admin-portal="true" className="h-screen bg-[#FDFBF7] flex flex-col font-['Nunito',sans-serif] overflow-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 px-2 sm:px-6 lg:px-8 py-2 sm:py-3.5 flex items-center justify-between shadow-xs shrink-0 gap-1 sm:gap-2 min-w-0 max-w-full overflow-hidden">
        <div className="flex items-center gap-1 sm:gap-2.5 min-w-0 shrink">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-stone-600 hover:bg-stone-100 rounded-xl md:hidden shrink-0"
            title="Toggle Menu"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <div className="shrink-0">
              <SchoolLogo size="sm" showText={false} />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black text-stone-900 leading-tight truncate max-w-[85px] xs:max-w-[140px] sm:max-w-xs md:max-w-none">
                {schoolInfo.name} Administration
              </div>
              <div className="text-[9px] sm:text-[11px] font-bold text-amber-700 truncate hidden xs:block">
                {termResumptionConfig?.termName || schoolInfo.activeTerm} • {termResumptionConfig?.session || schoolInfo.activeSession}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap">
          {/* Multi-Device Cloud Sync Button */}
          <button
            type="button"
            onClick={() => setShowCloudSyncModal(true)}
            className={`inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer shadow-2xs border shrink-0 ${
              isRemoteEnabled()
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200 animate-pulse'
            }`}
            title={isRemoteEnabled() ? 'Cloud Database Synced across all devices' : 'Single-Browser Mode: Click to configure multi-device sync on Netlify'}
          >
            <Database className={`w-3.5 h-3.5 shrink-0 ${isRemoteEnabled() ? 'text-emerald-600' : 'text-amber-700'}`} />
            <span className="hidden sm:inline">
              {isRemoteEnabled() ? 'Cloud Synced' : 'Multi-Device Sync'}
            </span>
            <span className="hidden xs:inline sm:hidden text-[10px] font-black">
              {isRemoteEnabled() ? 'Synced' : 'Sync'}
            </span>
          </button>

          {/* Quick Add Scholar Button */}
          <button
            type="button"
            onClick={() => setShowQuickAddModal(true)}
            className="inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 text-xs font-black rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all cursor-pointer shadow-xs shrink-0"
            title="Quickly create scholar in Supabase database"
            id="btn-header-quick-add-student"
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">+ Quick Add Scholar</span>
            <span className="hidden xs:inline sm:hidden text-[10px] font-black">+ Scholar</span>
            <span className="xs:hidden text-[10px] font-black">+</span>
          </button>

          {/* View Enrolled Student Roster & Fast Sign-In */}
          <button
            type="button"
            onClick={() => setShowRosterModal(true)}
            className="inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 text-xs font-black rounded-xl bg-gradient-to-r from-red-800 via-red-900 to-amber-900 hover:from-red-900 hover:to-amber-950 text-white transition-all cursor-pointer shadow-xs border border-amber-500/40 shrink-0"
            title="View Enrolled Student Roster & Fast Sign-In Directory"
            id="btn-admin-student-roster"
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="hidden md:inline">Student Roster</span>
            <span className="text-[10px] font-bold bg-amber-400 text-neutral-950 px-1.5 py-0.2 rounded-full leading-none">
              {students.length}
            </span>
          </button>

          {/* Theme switcher on desktop */}
          <button
            type="button"
            onClick={() => setShowThemeModal(true)}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-amber-950 bg-amber-100/90 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all cursor-pointer shadow-2xs shrink-0"
            title="Switch Website & Portals Theme"
            id="btn-admin-header-theme-switcher"
          >
            <Palette className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden xl:inline">Theme:</span>
            <span className="font-black text-amber-900 capitalize">
              {availableThemes?.find(t => t.id === appTheme)?.name.split(' ')[0] || 'Crimson'}
            </span>
          </button>

          {/* Download Logins on desktop */}
          <button
            type="button"
            onClick={() => setShowDownloadLoginsModal(true)}
            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-xl transition-colors cursor-pointer shadow-2xs shrink-0"
            title="Download student names, passwords, and parent logins"
            id="btn-admin-header-download-logins"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Download Logins</span>
          </button>

          {/* Prefect Badges on desktop */}
          <button
            type="button"
            onClick={() => setShowPrefectModal(true)}
            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl transition-colors cursor-pointer shadow-2xs shrink-0"
            title="Appoint & confer official school prefect badges"
          >
            <Award className="w-3.5 h-3.5 text-amber-700" />
            <span>Prefect Badges</span>
          </button>

          {/* Public Website button on desktop */}
          <button
            type="button"
            onClick={onBackToWebsite}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors shrink-0"
          >
            Public Website
          </button>

          {/* Logout Button */}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-1 p-1.5 sm:px-3 sm:py-1.5 text-xs font-bold text-red-600 hover:text-white hover:bg-red-600 bg-red-50 rounded-xl transition-colors shrink-0"
            title="Logout of Administration"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar for Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-white border-r border-stone-200 shrink-0 p-4 space-y-1 overflow-y-auto">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 px-3 py-2">
            Operations & Portals
          </div>
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden bg-stone-900/50 backdrop-blur-xs flex animate-fade-in">
            <div className="w-80 max-w-[85vw] bg-white h-full p-4 space-y-4 overflow-y-auto shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <SchoolLogo size="sm" showText={false} />
                    <span className="text-xs font-black uppercase tracking-wider text-stone-800">Admin Control</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-stone-500 hover:bg-stone-100 rounded-lg cursor-pointer"
                    aria-label="Close menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile Quick Action Tools Grid */}
                <div className="mb-4 p-2.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block px-1">
                    Quick Tools & Utilities
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => { setShowThemeModal(true); setMobileMenuOpen(false); }}
                      className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[11px] cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>Theme Style</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDownloadLoginsModal(true); setMobileMenuOpen(false); }}
                      className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-[11px] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Logins Export</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowPrefectModal(true); setMobileMenuOpen(false); }}
                      className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[11px] cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>Prefect Badges</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCloudSyncModal(true); setMobileMenuOpen(false); }}
                      className="flex items-center gap-1.5 p-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-bold text-[11px] cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5 text-sky-700 shrink-0" />
                      <span>Cloud Sync</span>
                    </button>
                  </div>
                </div>

                <div className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 px-3 py-1">
                  Portals & Operations
                </div>
                <div className="space-y-1">
                  {menuItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isActive ? 'bg-red-600 text-white shadow-xs' : 'text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-500'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Drawer Footer with Website and Logout */}
              <div className="pt-3 border-t border-stone-200 space-y-2 shrink-0">
                <button
                  type="button"
                  onClick={() => { onBackToWebsite(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                >
                  <SchoolIcon className="w-4 h-4" />
                  <span>Return to Public Website</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout from Admin</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Workspace Tab Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full min-h-0 pb-20">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-red-600 via-red-700 to-amber-700 text-white rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden">
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold mb-3 backdrop-blur-xs">
                      <SchoolIcon className="w-3.5 h-3.5" />
                      <span>
                        {isSuperAdmin
                          ? 'Master Super Administrator • Executive Central Registry'
                          : `${activeAdminAccount?.roleTitle || 'Delegated Administrator'} • ${activeAdminAccount?.privileges.length || 0} Assigned Privileges`}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                      Welcome, {isSuperAdmin ? 'Super Administrator' : activeAdminAccount?.name || 'Administrator'}
                    </h1>
                    <p className="text-white/90 text-sm mt-2 leading-relaxed">
                      {isSuperAdmin
                        ? 'Full executive authority over school attendance, grading, report sheet signatures, lesson notes, fee structures, and delegated sub-admin accounts.'
                        : `You are signed in with delegated administrative privileges (${activeAdminAccount?.roleTitle}). Use the sidebar to access your assigned school management modules.`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('roles_privileges')}
                        className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-black text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-stone-950" />
                        <span>Create Admin & Manage Privileges</span>
                      </button>
                    )}
                    {isTabAllowedForAdmin('results') && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('results')}
                        className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-black text-xs transition flex items-center gap-2 cursor-pointer"
                      >
                        <Award className="w-4 h-4 text-amber-300" />
                        <span>Report Sheet Signatures & Results</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase text-stone-400">Total Enrolled Scholars</div>
                    <GraduationCap className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="text-2xl font-black text-stone-900 mt-2">{students.length}</div>
                  <div className="text-xs text-stone-500 mt-1">Across all primary & secondary arms</div>
                  <button
                    type="button"
                    onClick={() => setShowRosterModal(true)}
                    className="w-full mt-3 py-1.5 px-3 rounded-xl bg-gradient-to-r from-red-800 via-red-900 to-amber-900 hover:from-red-900 hover:to-amber-950 text-white font-black text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-amber-500/30"
                    title="View Enrolled Student Roster & Fast Sign-In Directory"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-amber-300" />
                    <span>View Student Roster ({students.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDownloadLoginsModal(true)}
                    className="w-full mt-1.5 py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Download names of all students, password, and parent login in tabulated format"
                    id="btn-admin-overview-download-logins"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Download Logins (Tabulated)</span>
                  </button>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase text-stone-400">Faculty Tutors</div>
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-stone-900 mt-2">{tutors.length}</div>
                  <div className="text-xs text-stone-500 mt-1">Registered academic faculty</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase text-stone-400">School Classes</div>
                    <SchoolIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-stone-900 mt-2">{classes.length}</div>
                  <div className="text-xs text-stone-500 mt-1">Active grade categories</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase text-stone-400">Attendance Registers</div>
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-stone-900 mt-2">{attendanceRecords.length}</div>
                  <div className="text-xs text-emerald-600 font-semibold mt-1">Daily registers logged</div>
                </div>
              </div>

              {/* Quick Actions Shortcuts */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
                <h3 className="text-sm font-black text-stone-900 uppercase tracking-wider mb-4">
                  Quick Navigation Shortcuts
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('fast_scores')}
                    className="p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50/60 hover:border-emerald-600 hover:bg-emerald-100/70 text-left transition-all group"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Bulk Results Import</div>
                    <div className="text-[11px] text-emerald-800 font-bold">Rapid CA1, CA2 & Exam</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQuickAddModal(true)}
                    className="p-4 rounded-xl border-2 border-red-300 bg-red-50/60 hover:border-red-600 hover:bg-red-100/70 text-left transition-all group"
                  >
                    <Users className="w-5 h-5 text-red-700 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">+ Quick Add Scholar</div>
                    <div className="text-[11px] text-red-800 font-bold">Instant Supabase Enrollment</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowFamilyModal(true)}
                    className="p-4 rounded-xl border-2 border-purple-300 bg-purple-50/60 hover:border-purple-600 hover:bg-purple-100/70 text-left transition-all group"
                  >
                    <Users className="w-5 h-5 text-purple-700 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Family & Sibling Linkage</div>
                    <div className="text-[11px] text-purple-800 font-bold">Merge & Assign Parents</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDownloadLoginsModal(true)}
                    className="p-4 rounded-xl border-2 border-emerald-300 bg-emerald-50/60 hover:border-emerald-600 hover:bg-emerald-100/70 text-left transition-all group"
                    id="btn-admin-shortcut-download-logins"
                  >
                    <Download className="w-5 h-5 text-emerald-700 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Download Student & Parent Logins</div>
                    <div className="text-[11px] text-emerald-800 font-bold">Tabulated • Siblings, Parents & Class</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowThemeModal(true)}
                    className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/60 hover:border-amber-600 hover:bg-amber-100/80 text-left transition-all group cursor-pointer"
                    id="btn-admin-shortcut-theme-switcher"
                  >
                    <Palette className="w-5 h-5 text-amber-700 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Website & Roles Visual Themes</div>
                    <div className="text-[11px] text-amber-800 font-bold">3 Unique Styles • All Portals & Database</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('landing')}
                    className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/40 hover:border-amber-500 hover:bg-amber-50 text-left transition-all group"
                  >
                    <Layout className="w-5 h-5 text-amber-700 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Landing Page CMS & Toggles</div>
                    <div className="text-[11px] text-amber-800 font-semibold">16 Section Visibility Toggles</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onBackToWebsite();
                      setTimeout(() => {
                        const el = document.getElementById('news-blog');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 hover:border-amber-500 hover:bg-amber-50 text-left transition-all group"
                  >
                    <Newspaper className="w-5 h-5 text-amber-700 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">News & Blog Gazette</div>
                    <div className="text-[11px] text-amber-700 font-semibold">Press desk & dispatches</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="p-4 rounded-xl border border-stone-200 hover:border-red-500 hover:bg-red-50/50 text-left transition-all group"
                  >
                    <Settings className="w-5 h-5 text-red-600 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Term Resumption</div>
                    <div className="text-[11px] text-stone-500">Set resumption date</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('classes')}
                    className="p-4 rounded-xl border border-stone-200 hover:border-amber-500 hover:bg-amber-50/50 text-left transition-all group"
                  >
                    <SchoolIcon className="w-5 h-5 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Class & Fees</div>
                    <div className="text-[11px] text-stone-500">Manage tuition rates</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('students')}
                    className="p-4 rounded-xl border border-stone-200 hover:border-blue-500 hover:bg-blue-50/50 text-left transition-all group"
                  >
                    <GraduationCap className="w-5 h-5 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Student Profiles</div>
                    <div className="text-[11px] text-stone-500">Attendance & ranks</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('results')}
                    className="p-4 rounded-xl border border-stone-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-left transition-all group"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Result Collation</div>
                    <div className="text-[11px] text-stone-500">Generate report cards</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('calendar')}
                    className="p-4 rounded-xl border border-stone-200 hover:border-purple-500 hover:bg-purple-50/50 text-left transition-all group"
                  >
                    <Calendar className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">School Calendar</div>
                    <div className="text-[11px] text-stone-500">Terms & milestones</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('calvin_tokens')}
                    className="p-4 rounded-xl border border-stone-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-left transition-all group"
                  >
                    <Key className="w-5 h-5 text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                    <div className="font-bold text-xs text-stone-900">Calvin AI Tokens</div>
                    <div className="text-[11px] text-stone-500">Mint study access</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-6">
              {/* Sub-navigation tabs: Representative Desk vs Community Channels */}
              <div className="flex items-center gap-2 p-1.5 bg-neutral-200/60 rounded-2xl w-fit">
                <button
                  type="button"
                  onClick={() => setAdminChatTab('rep_desk')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                    adminChatTab === 'rep_desk'
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'text-neutral-700 hover:text-neutral-950 hover:bg-white/50'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Landing Page Desk & Representative Assignment</span>
                  {unreadVisitorInquiriesCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                      {unreadVisitorInquiriesCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAdminChatTab('channels')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 ${
                    adminChatTab === 'channels'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-neutral-700 hover:text-neutral-950 hover:bg-white/50'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Internal School Community Channels</span>
                </button>
              </div>

              {adminChatTab === 'rep_desk' ? (
                <AdminVisitorInquiriesSubTab />
              ) : (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-red-950 text-white p-6 rounded-3xl shadow-sm border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="px-2.5 py-0.5 rounded-full bg-red-600/30 text-red-300 text-[10px] font-black uppercase tracking-wider border border-red-500/40">
                        Omnipotent Administrative Control
                      </span>
                      <h2 className="text-xl font-black">Stanbax School Community Chat System</h2>
                      <p className="text-xs text-neutral-300 max-w-xl">
                        Full supervisory control across student class forums, extracurricular club hubs, and direct guardian-faculty consultations. Lock channels, flag messages, or manage discussion rooms.
                      </p>
                    </div>
                  </div>

                  <SchoolChatSystem
                    currentUserRole="admin"
                    currentUserId="admin-1"
                    currentUserName="Principal Administrator"
                    currentUserSubtext="School Administration & Registry"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'fast_scores' && (
            <div className="space-y-6">
              <BatchResultsUploadModal onClose={() => setActiveTab('overview')} />
            </div>
          )}
          {activeTab === 'family_linkage' && (
            <div className="space-y-6">
              <AdminFamilyLinkageModal
                isOpen={true}
                onClose={() => setActiveTab('overview')}
              />
            </div>
          )}
          {activeTab === 'roles_privileges' && <AdminRolePrivilegesTab />}
          {activeTab === 'calvin_tokens' && <AdminCalvinTokensTab />}
          {activeTab === 'scheme_of_work' && <AdminSchemeOfWorkTab />}
          {activeTab === 'calendar' && <AdminSchoolCalendarTab />}
          {activeTab === 'gallery' && <AdminCampusGalleryTab />}
          {activeTab === 'students' && <AdminStudentsAlumniTab />}
          {activeTab === 'waec' && <AdminWaecRegistrationTab />}
          {activeTab === 'faculty' && <AdminFacultyTab />}
          {activeTab === 'assignments' && <AdminTutorAssignmentsTab />}
          {activeTab === 'classes' && <AdminClassesFeesTab />}
          {activeTab === 'subjects' && <AdminSubjectsGradingTab />}
          {activeTab === 'results' && <AdminResultCollationTab />}
          {activeTab === 'notes' && <AdminLessonNotesTab />}
          {activeTab === 'broadcasts' && <AdminParentBroadcastTab />}
          {activeTab === 'proprietress' && <AdminProprietressTab />}
          {activeTab === 'credentials' && <AdminCredentialsVaultTab />}
          {activeTab === 'settings' && <AdminSchoolSettingsTab />}
          {activeTab === 'landing' && <AdminLandingPageTab />}
          {activeTab === 'contributors' && <AdminContributorsTab />}
          {activeTab === 'faqs' && <AdminFaqSubTab />}
        </main>
      </div>

      {/* School Prefect Badges Modal */}
      {showPrefectModal && (
        <SchoolPrefectBadgesModal
          onClose={() => setShowPrefectModal(false)}
        />
      )}

      {/* Netlify & Multi-Device Cloud Sync Assistant Modal */}
      <NetlifyCloudSyncModal
        isOpen={showCloudSyncModal}
        onClose={() => setShowCloudSyncModal(false)}
      />

      {/* Quick Add Scholar Modal */}
      <AdminQuickAddStudentModal
        isOpen={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
      />

      {/* Family & Sibling Linkage Modal */}
      <AdminFamilyLinkageModal
        isOpen={showFamilyModal}
        onClose={() => setShowFamilyModal(false)}
      />

      {/* Enrolled Student Roster & Fast Sign-In Directory Modal */}
      <StudentRosterDirectoryModal
        isOpen={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        students={students}
        onSelectStudent={(student) => {
          setShowRosterModal(false);
          localStorage.setItem('stanbax_student_auth', 'true');
          localStorage.setItem('stanbax_student_id', student.id);
          localStorage.setItem('stanbax_active_section', 'student-portal');
          window.location.reload();
        }}
      />

      {/* Download Student Names & Parent Logins Directory Modal */}
      <AdminDownloadStudentLoginsModal
        isOpen={showDownloadLoginsModal}
        onClose={() => setShowDownloadLoginsModal(false)}
      />

      {/* Website & Role Portals Theme Switcher Modal */}
      <AdminThemeSwitcherModal
        isOpen={showThemeModal}
        onClose={() => setShowThemeModal(false)}
      />
      <button
        type="button"
        onClick={() => {
          setActiveTab('fast_scores');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="fixed bottom-5 right-20 z-[60] inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3.5 py-3 text-xs font-black text-white shadow-xl ring-4 ring-white/80 transition hover:bg-emerald-700 hover:scale-105 active:scale-95 sm:right-24 sm:px-4"
        title="Open Bulk Results Upload"
        aria-label="Open Bulk Results Upload"
      >
        <UploadCloud className="h-4 w-4 shrink-0" />
        <span>Bulk Upload</span>
      </button>
    </div>
  );
};
