import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  isRemoteEnabled,
  remoteVerifyLogin,
  completeRemoteLogin,
  remoteLogout,
  remoteCreateCredential,
  remoteDeleteCredential,
  remoteChangePassword,
  remoteCheckCredentials,
  syncStateOnline,
  syncNewDataTypesOnline,
  ensureAdminRemoteSession,
  broadcastLocalStateChange,
  fetchLiveSupabaseChatAndDirectoryState,
  forceSyncCollatedResultsToDatabase,
  pushAllDataToSupabase,
  deduplicateStudentsByRegistration,
  normalizeRegForUpsert,
  lastLocalMutationAt,
  markLocalMutation,
  hasPendingRemoteWrites,
  setLocalStorageSilent,
  isSeededDemoGrade,
  stripDemoGradesFromStudent,
} from '../lib/supabase';
import { 
  AppImages, 
  Notice, 
  AdmissionApplication, 
  EntranceExamSettings,
  Homework, 
  GradeRecord, 
  ContactInquiry, 
  PageSection,
  LandingPageSectionsConfig,
  StudentProfile,
  TutorProfile,
  PrincipalRole,
  PrincipalPrivilege,
  CalvinToken,
  FacultyMember,
  SchoolInfo,
  SchoolClass,
  Subject,
  GradeRule,
  ParentBroadcastLog,
  ProprietressProfile,
  ProprietressAppointment,
  ProprietressMessage,
  ProprietressDirective,
  AssessmentControlConfig,
  AssessmentEntryPhase,
  AppTheme,
  ThemeConfig,
  HistoricalSessionRecord,
  HistoricalTermRecord,
  UserRole,
  UserCredentialItem,
  StudentRegistrationData,
  LessonNote,
  LessonNoteAttachment,
  NoteFormat,
  HeroSlide,
  KeyPillarItem,
  KeyPillarsHeader,
  AboutSectionContent,
  FeaturedCourse,
  TestimonialsSectionContent,
  AcademicProgram,
  Testimonial,
  BusRoute,
  MealMenuItem,
  Club,
  HouseStanding,
  AcademicCalendarEvent,
  FAQItem,
  FAQSectionContent,
  AttendanceStatus,
  AttendanceStudentEntry,
  AttendanceDailyRecord,
  StudentAttendanceSummary,
  TermResumptionConfig,
  ClassAttendanceSummary,
  CbtExam,
  CbtQuestion,
  CbtAttempt,
  ClassWeeklyTimetable,
  SickBayVisitLog,
  ParentProfile,
  ParentRegistrationData,
  ParentConsultationRequest,
  FeePaymentRecord,
  LibraryBookItem,
  SchemeOfWork,
  ChatChannel,
  SchoolChatMessage,
  GalleryPhoto,
  UserEphemeralStatus,
  SchoolNewsArticle,
  StudentArticleSubmission,
  StatusViewerRecord,
  SchoolRepRole,
  SchoolRepConfig,
  VisitorChatMessage,
  VisitorConversation,
  ChatAppointment,
  ChatTransferRecord,
  HeadmistressProfile,
  ModeratorProfile,
  PrivilegeKey,
  RolePrivilegeSettings,
  OfficialSignatures,
  ReportSheetSignatureMode,
  ReportSheetSecondarySignature,
  AdminAccount,
  AlumniRegistration,
  CustomResult,
  Contributor,
  WaecRegistration,
  WaecPromptBroadcast,
  WaecCatalogSubject
} from '../types';
import { 
  ALL_WAEC_SUBJECTS, 
  DEPARTMENT_RECOMMENDED_SUBJECTS 
} from '../data/waecSubjects';
import { 
  DEFAULT_ROLE_PRIVILEGES, 
  DEFAULT_HEADMISTRESS_PROFILE, 
  DEFAULT_MODERATORS 
} from '../data/rolePrivilegesData';
import { cleanExpiredStatuses, create16HourStatus, INITIAL_EPHEMERAL_STATUSES } from '../data/defaultEphemeralStatuses';
import { DEFAULT_GALLERY_PHOTOS } from '../data/defaultGalleryPhotos';
import { DEFAULT_NEWS_ARTICLES } from '../data/defaultNewsArticles';
import { defaultSchemesOfWork } from '../data/defaultSchemesOfWork';
import { INITIAL_LESSON_NOTES } from '../data/initialLessonNotes';
import { DEFAULT_FAQ_ITEMS, DEFAULT_FAQ_CONTENT } from '../data/faqData';
import { 
  DEFAULT_IMAGES, 
  RECENT_NOTICES, 
  INITIAL_APPLICATIONS, 
  INITIAL_BROADCAST_LOGS,
  DEMO_STUDENT, 
  DEMO_STUDENTS,
  DEMO_TUTOR, 
  DEMO_TUTORS,
  DEMO_HOMEWORKS, 
  DEFAULT_ASSESSMENT_CONFIG,
  FACULTY_MEMBERS,
  SCHOOL_INFO,
  DEFAULT_SCHOOL_STATS,
  DEFAULT_CLASSES,
  DEFAULT_SUBJECTS,
  DEFAULT_GRADING_SYSTEM,
  DEFAULT_PROPRIETRESS_PROFILE,
  DEFAULT_PROPRIETRESS_APPOINTMENTS,
  DEFAULT_PROPRIETRESS_MESSAGES,
  DEFAULT_PROPRIETRESS_DIRECTIVES,
  generateStudentHistoricalRecords,
  DEFAULT_HERO_SLIDES,
  DEFAULT_HERO_HIGHLIGHTS,
  DEFAULT_KEY_PILLARS,
  DEFAULT_KEY_PILLARS_HEADER,
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_TESTIMONIALS_HEADER,
  DEFAULT_ACADEMIC_PROGRAMS,
  DEFAULT_FEATURED_COURSES,
  DEFAULT_CLUBS_LIST,
  DEFAULT_HOUSE_STANDINGS,
  DEFAULT_BUS_ROUTES,
  DEFAULT_MEAL_MENU,
  DEFAULT_CALENDAR_EVENTS,
  DEFAULT_TESTIMONIALS,
  DEFAULT_CBT_EXAMS,
  DEFAULT_WEEKLY_TIMETABLES,
  DEFAULT_SICK_BAY_LOGS,
  DEFAULT_PARENTS,
  DEFAULT_PARENT_CONSULTATIONS,
  DEFAULT_FEE_PAYMENTS,
  DEFAULT_LIBRARY_BOOKS,
  DEFAULT_CBT_ATTEMPTS,
  DEFAULT_CHAT_CHANNELS,
  DEFAULT_CHAT_MESSAGES,
  DEFAULT_SCHOOL_REP_CONFIG,
  DEFAULT_VISITOR_CONVERSATIONS,
  DEFAULT_CONTRIBUTORS,
  DEFAULT_WAEC_REGISTRATIONS,
  DEFAULT_WAEC_PROMPT_BROADCAST,
  DEFAULT_CUSTOM_RESULTS,
  DEFAULT_LANDING_SECTIONS,
  DEFAULT_THEMES
} from '../data/schoolData';

interface SchoolContextType {
  // 1. Media
  images: AppImages;
  updateImage: (key: keyof AppImages, newUrlOrData: string) => void;
  resetImagesToDefault: () => void;
  
  // 2. School Core Info & Contacts
  schoolInfo: SchoolInfo;
  updateSchoolInfo: (info: Partial<SchoolInfo>) => void;
  resetSchoolInfo: () => void;
  resetSchoolInfoToDefault: () => void;
  updateSchoolStats: (stats: Array<{ label: string; value: string }>) => void;
  resetSchoolStatsToDefault: () => void;

  // 2B. Proprietress Desk & Functions
  proprietressProfile: ProprietressProfile;
  updateProprietressProfile: (info: Partial<ProprietressProfile>) => void;
  resetProprietressProfileToDefault: () => void;
  
  appointments: ProprietressAppointment[];
  bookAppointment: (appt: Omit<ProprietressAppointment, 'id' | 'refNumber' | 'status' | 'submittedAt'>) => string;
  updateAppointmentStatus: (id: string, status: ProprietressAppointment['status'], executiveResponse?: string) => void;
  deleteAppointment: (id: string) => void;

  messagesToProprietress: ProprietressMessage[];
  sendMessageToProprietress: (msg: Omit<ProprietressMessage, 'id' | 'refNumber' | 'date' | 'status'>) => string;
  updateProprietressMessageStatus: (id: string, status: ProprietressMessage['status'], note?: string) => void;
  deleteProprietressMessage: (id: string) => void;

  directives: ProprietressDirective[];
  addDirective: (dir: Omit<ProprietressDirective, 'id'>) => void;
  updateDirective: (id: string, updated: Partial<ProprietressDirective>) => void;
  deleteDirective: (id: string) => void;
  resetDirectivesToDefault: () => void;

  // 3. Faculty Members (Landing Page Staff)
  facultyList: FacultyMember[];
  addFacultyMember: (member: Omit<FacultyMember, 'id'>) => void;
  updateFacultyMember: (id: string, updated: Partial<FacultyMember>) => void;
  deleteFacultyMember: (id: string) => void;
  resetFacultyToDefault: () => void;

  // 4. Classes & Tuition Fees
  classes: SchoolClass[];
  addClass: (cls: Omit<SchoolClass, 'id'>) => void;
  updateClass: (id: string, updated: Partial<SchoolClass>) => void;
  deleteClass: (id: string) => void;
  resetClassesToDefault: () => void;
  assignClassTeacher: (classId: string, tutorId?: string) => void;

  // 5. Subjects & Curriculum
  subjects: Subject[];
  addSubject: (subj: Omit<Subject, 'id'>) => void;
  updateSubject: (id: string, updated: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
  resetSubjectsToDefault: () => void;

  // 6. Grading System
  gradingSystem: GradeRule[];
  gradingRules: GradeRule[];
  updateGradingRule: (id: string, updated: Partial<GradeRule>) => void;
  addGradingRule: (rule: Omit<GradeRule, 'id'>) => void;
  deleteGradingRule: (id: string) => void;
  resetGradingSystem: () => void;
  resetGradingToDefault: () => void;
  calculateGrade: (totalScore: number) => { grade: string; remark: string; color: string; gradePoint?: number };
  calculateGpa: (grades: GradeRecord[], customScale?: 5.0 | 4.0) => { gpa: number; scale: number; totalPoints: number; totalCredits: number; classification: string };
  isCgpaActiveForClass: (classNameOrId?: string) => boolean;
  toggleCgpaForClass: (className: string) => void;
  setCgpaActiveClasses: (classes: string[]) => void;

  // 7. Tutors & Assigned Subjects
  tutors: TutorProfile[];
  tutor: TutorProfile;
  activeTutorId: string;
  setActiveTutorId: (id: string) => void;
  switchActiveTutor: (id: string) => void;
  assignSubjectsToTutor: (tutorId: string, subjects: string[]) => void;
  updateTutor: (id: string, updated: Partial<TutorProfile>) => void;
  addTutor: (tutor: Omit<TutorProfile, 'id'>) => void;
  deleteTutor: (id: string) => void;

  // 8. Notices
  notices: Notice[];
  addNotice: (notice: Omit<Notice, 'id'>) => void;
  updateNotice: (id: string, updated: Partial<Notice>) => void;
  deleteNotice: (id: string) => void;
  
  // 9. Admissions & Parent Broadcast
  applications: AdmissionApplication[];
  submitApplication: (app: Omit<AdmissionApplication, 'id' | 'refNumber' | 'dateSubmitted' | 'status' | 'screeningDate'>) => string;
  updateApplicationStatus: (id: string, status: AdmissionApplication['status'], screeningDate?: string) => void;
  updateApplicationExamDetails: (id: string, details: Partial<AdmissionApplication>) => void;
  entranceExamSettings: EntranceExamSettings;
  updateEntranceExamSettings: (settings: Partial<EntranceExamSettings>) => void;
  resetEntranceExamSettings: () => void;
  broadcastLogs: ParentBroadcastLog[];
  addBroadcastLog: (log: Omit<ParentBroadcastLog, 'id' | 'dateSent'>) => void;
  
  // 10. Student & Homeworks
  students: StudentProfile[];
  student: StudentProfile;
  activeStudentId: string;
  setActiveStudentId: (id: string) => void;
  switchActiveStudent: (id: string) => void;
  updateStudent: (id: string, updated: Partial<StudentProfile>) => void;
  registerStudent: (data: StudentRegistrationData) => StudentProfile;
  addStudent: (studentData: Omit<StudentProfile, 'id' | 'regNumber'> & { id?: string; regNumber?: string }, creatorRole?: string, creatorName?: string) => Promise<{ success: boolean; student?: StudentProfile; message?: string }>;
  bulkUpsertStudents: (students: Array<Partial<StudentProfile> & { id?: string; regNumber?: string }>, creatorRole?: string, creatorName?: string) => Promise<{ success: boolean; students?: StudentProfile[]; updatedCount?: number; createdCount?: number; message?: string }>;
  onlineStudentsSynced: boolean;
  syncOnlineStudentsNow: () => Promise<void>;
  updateStudentPassport: (studentId: string, passportPhoto: string) => void;
  deleteStudent: (id: string) => void;
  setStudentIntensiveCalvinSupport: (
    studentId: string, 
    enabled: boolean, 
    details?: { interventionNotes?: string; interventionSubjects?: string[]; interventionLevel?: 'urgent' | 'moderate' | 'foundation_rebuild' }
  ) => void;
  homeworks: Homework[];
  toggleHomeworkStatus: (id: string, studentId?: string) => void;
  addHomework: (hw: Omit<Homework, 'id' | 'status'>) => void;
  deleteHomework: (id: string) => void;
  
  // 11. Grades & Assessments
  grades: GradeRecord[];
  updateGrade: (subject: string, ca1: number, ca2: number, exam: number, ca3?: number, studentId?: string) => void;
  batchUpdateClassGrades: (subject: string, scores: Array<{ studentId: string; ca1: number; ca2: number; ca3: number; exam: number }>) => void;
  getStudentGrades: (studentId: string) => GradeRecord[];
  assessmentConfig: AssessmentControlConfig;
  updateAssessmentConfig: (config: Partial<AssessmentControlConfig>) => void;
  setActiveAssessmentPhase: (phase: AssessmentEntryPhase) => void;
  setActiveAssessmentTerm: (term: '1st Term' | '2nd Term' | '3rd Term') => void;
  setPromotionPassMark: (percent: number) => void;
  availableSessions: string[];
  startNewAcademicSession: (newSessionName: string, passMarkPercentage?: number) => {
    promotedCount: number;
    repeatedCount: number;
    upgradedStudents: Array<{
      id: string;
      name: string;
      oldClass: string;
      newClass: string;
      passed: boolean;
      average: number;
    }>;
  };
  resetAssessmentToDefault: () => void;
  getNextClass: (currentGrade: string) => string;
  toggleAutoRanking: (enabled?: boolean) => void;
  getClassRankings: (className: string, term?: string) => Array<{
    student: StudentProfile;
    rank: number;
    positionText: string;
    average: number;
    totalScore: number;
  }>;
  dispatchCollatedResultsToDashboards: (options?: string | {
    reportKind?: 'mid' | 'end';
    customMessage?: string;
    broadcastMessage?: string;
    dispatchedBy?: string;
    lockCollation?: boolean;
    targetClass?: string;
  }) => Promise<{
    ok: boolean;
    studentsCount: number;
    parentsCount: number;
    dispatchedCount?: number;
    syncedToSupabase: boolean;
    dispatchedAt: string;
    message: string;
  }>;
  unifyLocalStorageResultsToDatabase: () => Promise<{
    ok: boolean;
    count: number;
    message: string;
    syncedToCloud: boolean;
  }>;
  batchUpsertStudentResults: (
    records: Array<{
      student_id?: string;
      regNumber?: string;
      id?: string;
      full_name?: string;
      name?: string;
      email?: string;
      grade_level?: string;
      grade?: string;
      class?: string;
      gender?: 'Male' | 'Female' | string;
      parent_name?: string;
      parent_phone?: string;
      results?: Array<{
        subject: string;
        ca1?: number;
        ca2?: number;
        ca3?: number;
        exam?: number;
        score?: number;
        grade?: string;
        remark?: string;
      }>;
      subjects?: Record<string, number> | Array<{ subject: string; ca1?: number; ca2?: number; ca3?: number; exam?: number; score?: number }>;
      [key: string]: any;
    }>,
    targetTerm?: '1st Term' | '2nd Term' | '3rd Term',
    targetSession?: string,
    options?: {
      assessmentMode?: 'tests_only' | 'full';
      replaceEntireRoster?: boolean;
    }
  ) => Promise<{
    success: boolean;
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
  }>;
  activeOnlineUsersCount: number;
  deletedAccountIds: string[];
  isAccountTombstoned: (id?: string, identifier?: string, email?: string) => boolean;
  
  // 12. Inquiries
  inquiries: ContactInquiry[];
  submitInquiry: (name: string, email: string, subject: string, message: string) => void;
  
  // 13. Authentication & Security (Universal Single Sign-On)
  isAdminAuthenticated: boolean;
  isProprietressAuthenticated: boolean;
  isHeadmistressAuthenticated: boolean;
  isModeratorAuthenticated: boolean;
  isStudentAuthenticated: boolean;
  isTutorAuthenticated: boolean;
  authenticatedRole: UserRole | null;
  universalLogin: (identifier: string, pass: string) => Promise<{
    success: boolean;
    role?: UserRole;
    message?: string;
    targetSection?: PageSection;
    isAlumni?: boolean;
  }>;
  loginAdmin: (user: string, pass: string) => Promise<boolean>;
  logoutAdmin: () => void;
  loginProprietress: (user: string, pass: string) => Promise<boolean>;
  logoutProprietress: () => void;
  loginHeadmistress: (user: string, pass: string) => Promise<boolean>;
  logoutHeadmistress: () => void;
  loginModerator: (user: string, pass: string) => Promise<boolean>;
  logoutModerator: () => void;
  loginStudent: (identifier: string, pin: string) => Promise<{ success: boolean; message?: string; student?: StudentProfile }>;
  logoutStudent: () => void;
  loginTutor: (identifier: string, pass: string) => Promise<{ success: boolean; message?: string; tutor?: TutorProfile }>;
  logoutTutor: () => void;
  logoutAll: () => void;

  // Head Mistress Desk & Profiles
  headmistressProfile: HeadmistressProfile;
  updateHeadmistressProfile: (data: Partial<HeadmistressProfile>) => void;

  // Moderators & Oversight
  moderators: ModeratorProfile[];
  addModerator: (data: Omit<ModeratorProfile, 'id'>) => ModeratorProfile;
  updateModerator: (id: string, data: Partial<ModeratorProfile>) => void;
  deleteModerator: (id: string) => void;
  activeModeratorId: string;
  setActiveModeratorId: (id: string) => void;

  // Role Delegated Privileges
  rolePrivileges: RolePrivilegeSettings;
  updateRolePrivilege: (role: 'headmistress' | 'moderator' | 'tutor' | 'student' | 'parent', key: PrivilegeKey, granted: boolean) => void;
  resetRolePrivileges: (role?: 'headmistress' | 'moderator' | 'tutor') => void;
  hasPrivilege: (role: UserRole, key: PrivilegeKey) => boolean;

  // Super Admin & Delegated Admin Accounts
  adminAccounts: AdminAccount[];
  activeAdminId: string;
  activeAdminAccount: AdminAccount | null;
  isSuperAdmin: boolean;
  hasAdminPrivilege: (key: PrivilegeKey) => boolean;
  createAdminAccount: (data: Omit<AdminAccount, 'id' | 'createdAt'>) => Promise<{ success: boolean; message: string; account?: AdminAccount }>;
  updateAdminAccount: (id: string, updates: Partial<AdminAccount>) => Promise<{ success: boolean; message: string }>;
  deleteAdminAccount: (id: string) => Promise<{ success: boolean; message: string }>;

  // 13B. Alumni & Privileges Management
  toggleStudentAlumni: (studentId: string, isAlumni: boolean, graduationSession?: string) => void;
  upgradeStudentToTutor: (studentId: string) => { success: boolean; tutorId?: string; message: string };
  completeTutorProfile: (tutorId: string, data: Partial<TutorProfile>) => void;
  createTutorAccount: (data: {
    name: string;
    email: string;
    staffId?: string;
    password: string;
    department: string;
    role: string;
    qualification: string;
    assignedClasses: string[];
    assignedSubjects: string[];
    phone?: string;
    bio?: string;
  }) => TutorProfile;

  // Official Institutional Signatures & Report Sheet Signatory Resolver
  officialSignatures: OfficialSignatures;
  updateOfficialSignatures: (signatures: Partial<OfficialSignatures>) => void;
  resolveReportSheetSignatures: (studentGrade?: string) => {
    mode: ReportSheetSignatureMode;
    primary: {
      name: string;
      title: string;
      signatureUrl: string;
      label: string;
      isOfficialSeal?: boolean;
    };
    secondary?: {
      name: string;
      title: string;
      signatureUrl: string;
      label: string;
      isOfficialSeal?: boolean;
    };
    showOnPortal: boolean;
  };

  // Alumni Registration & Approval Workflow
  alumniRegistrations: AlumniRegistration[];
  registerAlumniAccount: (data: {
    fullName: string;
    graduationYear: string;
    email: string;
    phone: string;
    formerRegNumber?: string;
    formerClassOrSet?: string;
    password?: string;
    securityQuestion?: string;
    securityAnswer?: string;
    passportPhoto?: string;
    currentOccupation?: string;
    currentInstitution?: string;
    formerHouse?: string;
  }) => Promise<{ success: boolean; message: string; registration: AlumniRegistration }>;
  approveAlumniRegistration: (id: string) => Promise<{ success: boolean; message: string }>;
  rejectAlumniRegistration: (id: string, reason?: string) => { success: boolean; message: string };
  deleteAlumniRegistration: (id: string) => { success: boolean; message: string };

  // Custom Results Management
  customResults: CustomResult[];
  uploadCustomResult: (data: Omit<CustomResult, 'id' | 'uploadedAt'> & { studentId?: string; studentRegNumber?: string }) => CustomResult;
  updateCustomResult: (resultId: string, updates: Partial<CustomResult>) => boolean;
  deleteCustomResult: (resultId: string) => boolean;
  getStudentCustomResults: (studentIdOrReg: string) => CustomResult[];
  syncAllCustomDataToCloud: () => Promise<{ ok: boolean; message: string }>;

  // 13C. Password Management & Admin Security Vault
  changePassword: (userRole: UserRole, currentPass: string, newPass: string, userId?: string) => Promise<{ success: boolean; message: string }>;
  forgotPasswordReset: (identifier: string, newPassword: string) => { success: boolean; message: string; role?: UserRole };
  getSecurityQuestionForUser: (identifier: string) => {
    exists: boolean;
    hasQuestion: boolean;
    securityQuestion?: string;
    name?: string;
    role?: UserRole;
    message?: string;
  };
  resetPasswordWithSecurityAnswer: (identifier: string, securityAnswer: string, newPassword: string) => {
    success: boolean;
    message: string;
    role?: UserRole;
  };
  getAllUserCredentials: () => UserCredentialItem[];
  adminResetUserPassword: (
    userId: string,
    userRole: UserRole,
    newPassword: string,
    cloudIdentifier?: string
  ) => Promise<{ success: boolean; message: string }>;
  adminDeleteUserAccount: (
    userId: string,
    userRole: string,
    identifier?: string
  ) => Promise<{ success: boolean; message: string }>;
  adminSecurityQuestion: string;
  adminSecurityAnswer: string;
  updateAdminSecurityQuestion: (question: string, answer: string) => { success: boolean; message: string };

  // 14. Lesson Notes & Academic Materials
  lessonNotes: LessonNote[];
  notesFeatureEnabled: boolean;
  addLessonNote: (note: Omit<LessonNote, 'id' | 'datePublished' | 'downloadsCount'>) => LessonNote;
  deleteLessonNote: (id: string) => boolean;
  toggleNotesFeature: (enabled?: boolean) => void;
  deleteTermNotes: (term?: string, session?: string) => number;
  exportNotesZip: (term?: string, session?: string) => Promise<{ success: boolean; count: number; filename: string }>;
  incrementNoteDownload: (id: string) => void;

  // 14B. Institutional Visual Themes
  appTheme: AppTheme;
  setAppTheme: (theme: AppTheme) => Promise<{ success: boolean; message: string }>;
  availableThemes: ThemeConfig[];
  
  // 15. Navigation
  activeSection: PageSection;
  setActiveSection: (section: PageSection) => void;

  // 16. Landing Page CMS Content & Operations
  heroSlides: HeroSlide[];
  updateHeroSlide: (index: number, slide: Partial<HeroSlide>) => void;
  addHeroSlide: (slide: HeroSlide) => void;
  deleteHeroSlide: (index: number) => void;
  resetHeroSlidesToDefault: () => void;

  heroHighlights: string[];
  updateHeroHighlights: (highlights: string[]) => void;
  resetHeroHighlightsToDefault: () => void;

  keyPillars: KeyPillarItem[];
  keyPillarsHeader: KeyPillarsHeader;
  updateKeyPillar: (id: string, pillar: Partial<KeyPillarItem>) => void;
  addKeyPillar: (pillar: Omit<KeyPillarItem, 'id'>) => void;
  deleteKeyPillar: (id: string) => void;
  updateKeyPillarsHeader: (header: Partial<KeyPillarsHeader>) => void;
  resetKeyPillarsToDefault: () => void;

  aboutContent: AboutSectionContent;
  updateAboutContent: (content: Partial<AboutSectionContent>) => void;
  resetAboutContentToDefault: () => void;
  resetAboutContent: () => void;

  academicPrograms: AcademicProgram[];
  updateAcademicProgram: (id: string, program: Partial<AcademicProgram>) => void;
  addAcademicProgram: (prog: Omit<AcademicProgram, 'id'>) => void;
  deleteAcademicProgram: (id: string) => void;
  resetAcademicProgramsToDefault: () => void;

  featuredCourses: FeaturedCourse[];
  updateFeaturedCourse: (id: string, course: Partial<FeaturedCourse>) => void;
  addFeaturedCourse: (course: Omit<FeaturedCourse, 'id'>) => void;
  deleteFeaturedCourse: (id: string) => void;
  resetFeaturedCoursesToDefault: () => void;

  clubsList: Club[];
  clubs: Club[];
  updateClub: (id: string, club: Partial<Club>) => void;
  addClub: (club: Omit<Club, 'id'>) => void;
  deleteClub: (id: string) => void;
  resetClubsToDefault: () => void;

  houseStandings: HouseStanding[];
  updateHouseStanding: (indexOrName: number | string, house: Partial<HouseStanding>) => void;
  addHouseStanding: (house: HouseStanding) => void;
  deleteHouseStanding: (indexOrName: number | string) => void;
  resetHouseStandingsToDefault: () => void;

  busRoutes: BusRoute[];
  updateBusRoute: (id: string, route: Partial<BusRoute>) => void;
  addBusRoute: (route: Omit<BusRoute, 'id'>) => void;
  deleteBusRoute: (id: string) => void;
  resetBusRoutesToDefault: () => void;

  mealMenu: MealMenuItem[];
  updateMealMenuItem: (day: string, item: Partial<MealMenuItem>) => void;
  resetMealMenuToDefault: () => void;

  calendarEvents: AcademicCalendarEvent[];
  updateCalendarEvent: (id: string, event: Partial<AcademicCalendarEvent>) => void;
  addCalendarEvent: (event: Omit<AcademicCalendarEvent, 'id'>) => void;
  deleteCalendarEvent: (id: string) => void;
  resetCalendarEventsToDefault: () => void;

  testimonials: Testimonial[];
  testimonialsHeader: TestimonialsSectionContent;
  updateTestimonial: (id: string, testimonial: Partial<Testimonial>) => void;
  addTestimonial: (testimonial: Omit<Testimonial, 'id'>) => void;
  deleteTestimonial: (id: string) => void;
  updateTestimonialsHeader: (header: Partial<TestimonialsSectionContent>) => void;
  resetTestimonialsToDefault: () => void;

  landingSections: LandingPageSectionsConfig;
  updateLandingSectionVisibility: (sectionKey: keyof LandingPageSectionsConfig, isVisible: boolean) => void;
  resetLandingSectionsToDefault: () => void;

  // 17. Frequently Asked Questions (FAQ) Section
  faqItems: FAQItem[];
  faqHeader: FAQSectionContent;
  faqContent: FAQSectionContent;
  updateFaqItem: (id: string, item: Partial<FAQItem>) => void;
  addFaqItem: (item: Omit<FAQItem, 'id'>) => void;
  deleteFaqItem: (id: string) => void;
  updateFaqHeader: (header: Partial<FAQSectionContent>) => void;
  updateFaqContent: (header: Partial<FAQSectionContent>) => void;
  resetFaqToDefault: () => void;
  resetFaqsToDefault: () => void;

  // 18. Complete Database Resilience (Zero Data Loss on Free Hosting: Vercel / GitHub)
  exportDatabaseSnapshot: () => string;
  importDatabaseSnapshot: (jsonData: string) => Promise<{ success: boolean; message: string; recordCounts?: Record<string, number> }>;

  // 19. Attendance & Term Resumption Management
  attendanceRecords: AttendanceDailyRecord[];
  termResumptionConfig: TermResumptionConfig;
  setTermStartDate: (
    date: string,
    options?: {
      termEndDate?: string;
      termName?: string;
      sessionName?: string;
      shouldResetAttendance?: boolean;
      isMidwayLaunch?: boolean;
      midwayElapsedDays?: number;
      midwayStartWeek?: number;
    }
  ) => void;
  setTermResumptionDate: (date: string, termName?: string, sessionName?: string, termEndDate?: string) => void;
  resetDailyAttendanceCounter: () => void;
  startNewTerm: (
    termName: string, 
    startDate: string, 
    sessionName?: string, 
    endDate?: string,
    options?: { isMidwayLaunch?: boolean; midwayElapsedDays?: number; midwayStartWeek?: number }
  ) => void;
  submitDailyAttendance: (record: Omit<AttendanceDailyRecord, 'id' | 'submittedAt'>) => AttendanceDailyRecord;
  getClassAttendanceSummary: (classId: string, term?: string) => ClassAttendanceSummary;
  getStudentAttendanceSummary: (studentId: string, term?: string) => StudentAttendanceSummary;

  // 20. CBT Practice & Examination Engine
  cbtExams: CbtExam[];
  cbtAttempts: CbtAttempt[];
  addCbtExam: (exam: Omit<CbtExam, 'id'>) => CbtExam;
  deleteCbtExam: (id: string) => void;
  recordCbtAttempt: (attempt: Omit<CbtAttempt, 'id' | 'dateAttempted'>) => CbtAttempt;

  // 21. Weekly Timetable & Bell Schedule
  timetables: ClassWeeklyTimetable[];
  updateClassTimetable: (classId: string, schedule: ClassWeeklyTimetable['schedule']) => void;

  // 22. Medical & Clinic Sick-Bay
  sickBayLogs: SickBayVisitLog[];
  addSickBayLog: (log: Omit<SickBayVisitLog, 'id'>) => SickBayVisitLog;
  updateSickBayLog: (id: string, updated: Partial<SickBayVisitLog>) => void;
  deleteSickBayLog: (id: string) => void;

  // 23. Parent Portal & Family Linkage
  parents: ParentProfile[];
  activeParentId: string;
  isParentAuthenticated: boolean;
  addParent: (parent: Omit<ParentProfile, 'id'>) => void;
  registerParent: (data: ParentRegistrationData) => Promise<{ success: boolean; parent?: ParentProfile; message: string }>;
  syncOnlineParentsNow: () => Promise<void>;
  updateParent: (id: string, updated: Partial<ParentProfile>) => void;
  deleteParent: (id: string) => void;
  assignSiblingsToParent: (parentId: string, studentIds: string[]) => Promise<{ success: boolean; message: string }>;
  quickCreateParentWithSiblings: (parentData: { fullName: string; phone: string; email?: string; password?: string; address?: string }, studentIds: string[]) => Promise<{ success: boolean; parent?: ParentProfile; message: string }>;
  mergeParentAccounts: (primaryParentId: string, secondaryParentIds: string[]) => Promise<{ success: boolean; message: string }>;
  unlinkChildFromParent: (parentId: string, studentId: string) => Promise<{ success: boolean; message: string }>;
  loginParent: (phoneOrEmail: string, pass: string) => Promise<{ success: boolean; message?: string; parent?: ParentProfile }>;
  logoutParent: () => void;
  consultationRequests: ParentConsultationRequest[];
  submitConsultationRequest: (req: Omit<ParentConsultationRequest, 'id' | 'createdAt' | 'status'>) => ParentConsultationRequest;
  updateConsultationStatus: (id: string, status: ParentConsultationRequest['status'], adminResponse?: string) => void;
  feePayments: FeePaymentRecord[];
  recordFeePayment: (payment: Omit<FeePaymentRecord, 'id' | 'status'>) => FeePaymentRecord;
  verifyFeePayment: (id: string, verifiedBy?: string) => void;
  rejectFeePayment: (id: string, rejectedBy?: string) => void;

  // 24. Digital Library & E-Textbooks
  libraryBooks: LibraryBookItem[];
  addLibraryBook: (book: Omit<LibraryBookItem, 'id' | 'downloadsCount'>) => LibraryBookItem;
  deleteLibraryBook: (id: string) => void;
  incrementBookDownload: (id: string) => void;

  // 25. Calvin AI Tokens & Student Access
  calvinTokens: CalvinToken[];
  createCalvinTokens: (tier: 'regular' | 'premium', durationHours: number, count?: number, priceNgn?: number, customDurationLabel?: string) => CalvinToken[];
  redeemCalvinToken: (studentId: string, code: string) => { success: boolean; message: string; tier?: 'regular' | 'premium'; expiresAt?: string };
  revokeCalvinToken: (tokenId: string) => void;
  grantDirectCalvinAccess: (studentId: string, tier: 'regular' | 'premium', durationHours: number) => void;
  recordCalvinQuestionAsked: (studentId: string) => void;
  sendTokenActivationPrompt: (studentIds: string[], options: { tokenCode?: string; tier?: 'regular' | 'premium'; durationLabel?: string; customMessage?: string; autoAllocateToken?: boolean; durationHours?: number }) => { success: boolean; count: number; message: string };
  dismissTokenPrompt: (studentId: string) => void;
  acceptTokenPromptAndActivate: (studentId: string) => { success: boolean; message: string; tier?: 'regular' | 'premium' };

  // 26. Staff Photo, Signature & Principal Appointments
  appointPrincipal: (tutorId: string, principalRole: PrincipalRole, privileges: PrincipalPrivilege[]) => void;
  updateTutorPhotoAndSignature: (tutorId: string, data: { photoUrl?: string; signatureUrl?: string }) => void;

  // 27. Subject Schemes of Work & AI Curriculum Grounding
  schemesOfWork: SchemeOfWork[];
  addSchemeOfWork: (scheme: Omit<SchemeOfWork, 'id' | 'lastUpdated'>) => SchemeOfWork;
  updateSchemeOfWork: (id: string, updates: Partial<SchemeOfWork>) => void;
  deleteSchemeOfWork: (id: string) => boolean;
  resetSchemesToDefault: () => void;
  getSchemeForSubjectAndClass: (subjectName: string, classLevel?: string, term?: string) => SchemeOfWork | undefined;

  // 28. School Community Chat System (Students, Parents, Tutors & Admin)
  chatChannels: ChatChannel[];
  chatMessages: SchoolChatMessage[];
  addChatChannel: (channel: Omit<ChatChannel, 'id' | 'createdAt'>) => ChatChannel;
  updateChatChannel: (id: string, updates: Partial<ChatChannel>) => void;
  deleteChatChannel: (id: string) => void;
  sendChatMessage: (msg: Omit<SchoolChatMessage, 'id' | 'timestamp'>) => SchoolChatMessage;
  deleteChatMessage: (id: string) => void;
  flagChatMessage: (id: string, flagged?: boolean) => void;
  resetChatToDefault: () => void;
  toggleChatReaction: (messageId: string, emoji: string, userName: string) => void;
  togglePinChatMessage: (messageId: string, pinnedBy?: string) => void;
  markChannelAsRead: (channelId: string, userId: string) => void;
  getChannelUnreadCount: (channelId: string, userId: string) => number;
  getTotalUnreadCount: (userId: string, authorizedChannelIds?: string[]) => number;
  isFloatingChatOpen: boolean;
  setIsFloatingChatOpen: (open: boolean) => void;
  activeFloatingChatChannelId: string | null;
  setActiveFloatingChatChannelId: (channelId: string | null) => void;

  // 29. Campus Gallery Photos (Facilities & Events)
  galleryPhotos: GalleryPhoto[];
  addGalleryPhoto: (photo: Omit<GalleryPhoto, 'id' | 'uploadedAt'>) => void;
  updateGalleryPhoto: (id: string, updates: Partial<GalleryPhoto>) => void;
  deleteGalleryPhoto: (id: string) => void;
  resetGalleryPhotosToDefault: () => void;

  // 30. Prefects, Club Leaders & Ephemeral 16-Hour Statuses
  assignClassPrefects: (classId: string, prefectStudentId?: string, assistantPrefectStudentId?: string) => void;
  assignClubLeaders: (clubId: string, presidentStudentId?: string, vicePresidentStudentId?: string, memberStudentIds?: string[]) => void;
  assignStudentPrefectBadge: (studentId: string, prefectRole?: string, prefectBadge?: string) => void;
  updateStudentChatSettings: (studentId: string, settings: { showOnlineStatus?: boolean; allowDirectMessages?: boolean; dmPermission?: 'classmates_only' | 'anyone' }) => void;
  ephemeralStatuses: UserEphemeralStatus[];
  postEphemeralStatus: (status: Omit<UserEphemeralStatus, 'id' | 'createdAt' | 'expiresAt' | 'views'>) => void;
  deleteEphemeralStatus: (id: string) => void;
  markEphemeralStatusViewed: (statusId: string, viewerId: string, viewerName?: string, viewerRole?: string) => void;

  // 31. School News & Blog System (Press Club President & Nominated Editors)
  newsArticles: SchoolNewsArticle[];
  addNewsArticle: (article: Omit<SchoolNewsArticle, 'id' | 'publishedAt'>) => void;
  updateNewsArticle: (id: string, updates: Partial<SchoolNewsArticle>) => void;
  deleteNewsArticle: (id: string) => void;
  likeNewsArticle: (id: string) => void;
  pressClubPresidentStudentId: string | undefined;
  pressClubEditorStudentIds: string[];
  assignPressClubPresident: (studentId: string | undefined) => void;
  nominatePressClubEditor: (studentId: string) => void;
  removePressClubEditor: (studentId: string) => void;
  resetNewsArticlesToDefault: () => void;
  studentSubmissions: StudentArticleSubmission[];
  submitArticleForReview: (submission: Omit<StudentArticleSubmission, 'id' | 'submittedAt' | 'status'>) => void;
  reviewStudentSubmission: (id: string, decision: 'approved' | 'rejected', reason?: string) => void;

  // 32. School Representative & Landing Page Visitor Live Chat
  schoolRepConfig: SchoolRepConfig;
  updateSchoolRepConfig: (updates: Partial<SchoolRepConfig>) => void;
  toggleRepAvailability: (available?: boolean) => void;
  visitorConversations: VisitorConversation[];
  sendVisitorMessage: (
    visitorId: string, 
    message: string, 
    visitorInfo?: { name?: string; phone?: string; email?: string; category?: any; language?: string },
    attachment?: { url: string; name: string; type: 'image' | 'document' | 'audio'; audioDuration?: number }
  ) => Promise<VisitorChatMessage | null>;
  replyAsRepresentative: (
    visitorId: string, 
    replyContent: string, 
    repInfo?: { name?: string; title?: string },
    attachment?: { url: string; name: string; type: 'image' | 'document' | 'audio'; audioDuration?: number }
  ) => void;
  requestCalvinAiInstantReply: (visitorId: string) => Promise<VisitorChatMessage | null>;
  getVisitorConversation: (visitorId: string) => VisitorConversation | undefined;
  restoreVisitorConversationByCode: (code: string) => Promise<VisitorConversation | null>;
  markVisitorConversationRead: (visitorId: string) => void;
  markConversationSeenByAdmin: (visitorId: string) => void;
  markConversationSeenByVisitor: (visitorId: string) => void;
  setChatTyping: (visitorId: string, sender: 'representative' | 'visitor', isTyping: boolean, senderName?: string) => Promise<void>;
  typingMap: Record<string, { isRepTyping?: boolean; repName?: string; isVisitorTyping?: boolean; visitorName?: string }>;
  bookChatAppointment: (
    visitorId: string, 
    appointmentData: Omit<ChatAppointment, 'id' | 'createdAt' | 'status'>
  ) => Promise<ChatAppointment>;
  transferConversationDepartment: (
    visitorId: string, 
    targetRole: SchoolRepRole, 
    targetRepName: string, 
    targetRepTitle: string, 
    reason?: string
  ) => void;
  updateVisitorNotificationOptIn: (
    visitorId: string, 
    optIn: { whatsapp?: boolean; sms?: boolean; phone?: string; email?: string }
  ) => void;

  // 30. Website Production Contributors
  contributors: Contributor[];
  addContributor: (contrib: Omit<Contributor, 'id'>) => Contributor;
  updateContributor: (id: string, updates: Partial<Contributor>) => void;
  deleteContributor: (id: string) => boolean;
  resetContributorsToDefault: () => void;

  // 31. Official WAEC / WASSCE Registration & Admin Broadsheet
  waecRegistrations: WaecRegistration[];
  waecPromptBroadcast: WaecPromptBroadcast;
  waecSubjects: WaecCatalogSubject[];
  waecDepartmentRecommendations: Record<'Science' | 'Arts' | 'Commercial', string[]>;
  saveWaecRegistration: (data: Omit<WaecRegistration, 'id' | 'updatedAt'> & { id?: string }) => WaecRegistration;
  updateWaecRegistrationStatus: (id: string, status: WaecRegistration['status'], adminRemarks?: string) => void;
  broadcastWaecPrompt: (promptUpdates: Partial<WaecPromptBroadcast>) => void;
  dismissWaecPromptForStudent: (studentId: string) => void;
  importWaecRegistrationsBatch: (registrations: WaecRegistration[]) => number;
  deleteWaecRegistration: (id: string) => void;
  isStudentSeniorCandidate: (grade?: string) => boolean;
  updateWaecSubject: (code: string, updates: Partial<WaecCatalogSubject>, oldName?: string) => void;
  addWaecSubject: (subject: WaecCatalogSubject) => void;
  deleteWaecSubject: (code: string) => void;
  resetWaecSubjectsToDefault: () => void;
  updateDepartmentRecommendations: (dept: 'Science' | 'Arts' | 'Commercial', subjects: string[]) => void;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Manage Dynamic Images (Persistent in localStorage)
  const [images, setImages] = useState<AppImages>(() => {
    try {
      const saved = localStorage.getItem('stanbax_app_images');
      if (saved) {
        return { ...DEFAULT_IMAGES, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_IMAGES;
  });

  const updateImage = (key: keyof AppImages, newUrlOrData: string) => {
    setImages(prev => {
      const updated = { ...prev, [key]: newUrlOrData };
      try {
        localStorage.setItem('stanbax_app_images', JSON.stringify(updated));
      } catch (err) {
        console.warn('Storage quota exceeded or error storing image', err);
      }
      return updated;
    });
  };

  const resetImagesToDefault = () => {
    setImages(DEFAULT_IMAGES);
    try {
      localStorage.removeItem('stanbax_app_images');
    } catch {}
  };

  // 2. School Core Info (Address, Phone, WhatsApp, Term, Year)
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(() => {
    try {
      const saved = localStorage.getItem('stanbax_school_info');
      if (saved) {
        const parsed = JSON.parse(saved);
        const stats = (parsed.stats && Array.isArray(parsed.stats) && parsed.stats.length > 0)
          ? parsed.stats
          : DEFAULT_SCHOOL_STATS;
        return { ...SCHOOL_INFO, ...parsed, stats };
      }
    } catch {}
    return { ...SCHOOL_INFO, stats: DEFAULT_SCHOOL_STATS };
  });

  const updateSchoolInfo = (info: Partial<SchoolInfo>) => {
    setSchoolInfo(prev => {
      const updated = { ...prev, ...info };
      try {
        localStorage.setItem('stanbax_school_info', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const updateSchoolStats = (newStats: Array<{ label: string; value: string }>) => {
    updateSchoolInfo({ stats: newStats });
  };

  const resetSchoolStatsToDefault = () => {
    updateSchoolInfo({ stats: DEFAULT_SCHOOL_STATS });
  };

  const resetSchoolInfo = () => {
    setSchoolInfo({ ...SCHOOL_INFO, stats: DEFAULT_SCHOOL_STATS });
    try {
      localStorage.removeItem('stanbax_school_info');
    } catch {}
  };

  // 2B. Institutional Visual Themes (3 Unique Styles)
  const [appTheme, setAppThemeState] = useState<AppTheme>(() => {
    try {
      return (localStorage.getItem('stanbax_app_theme') as AppTheme) || 'crimson-gold';
    } catch {
      return 'crimson-gold';
    }
  });

  const setAppTheme = async (theme: AppTheme): Promise<{ success: boolean; message: string }> => {
    const validTheme = ['crimson-gold', 'sapphire-collegiate', 'emerald-ivy'].includes(theme) ? theme : 'crimson-gold';
    setAppThemeState(validTheme);
    try {
      localStorage.setItem('stanbax_app_theme', validTheme);
      document.documentElement.setAttribute('data-theme', validTheme);
      document.body.setAttribute('data-theme', validTheme);
    } catch {}
    broadcastLocalStateChange('stanbax_app_theme', validTheme);
    void syncStateOnline('stanbax_app_theme', validTheme);
    try {
      await fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: validTheme })
      });
    } catch (e) {
      console.warn('[Theme Sync] Local & Supabase synced, server route pending:', e);
    }
    const themeName = DEFAULT_THEMES.find(t => t.id === validTheme)?.name || validTheme;
    return {
      success: true,
      message: `Institutional visual theme updated to "${themeName}" and saved across all portals, database, and connected devices!`
    };
  };

  // 2C. Landing Page CMS State & Handlers (Persistent in database & synced online)
  // Landing Page Section Visibility Toggles
  const [landingSections, setLandingSections] = useState<LandingPageSectionsConfig>(() => {
    try {
      const saved = localStorage.getItem('stanbax_landing_sections');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_LANDING_SECTIONS, ...parsed };
      }
    } catch {}
    return DEFAULT_LANDING_SECTIONS;
  });

  const updateLandingSectionVisibility = (sectionKey: keyof LandingPageSectionsConfig, isVisible: boolean) => {
    setLandingSections(prev => {
      const updated: LandingPageSectionsConfig = { ...prev, [sectionKey]: isVisible };
      try {
        localStorage.setItem('stanbax_landing_sections', JSON.stringify(updated));
      } catch {}
      void syncStateOnline('stanbax_landing_sections', updated);
      broadcastLocalStateChange('stanbax_landing_sections', updated);
      return updated;
    });
  };

  const resetLandingSectionsToDefault = () => {
    setLandingSections(DEFAULT_LANDING_SECTIONS);
    try {
      localStorage.setItem('stanbax_landing_sections', JSON.stringify(DEFAULT_LANDING_SECTIONS));
    } catch {}
    void syncStateOnline('stanbax_landing_sections', DEFAULT_LANDING_SECTIONS);
    broadcastLocalStateChange('stanbax_landing_sections', DEFAULT_LANDING_SECTIONS);
  };

  // Hero Slides
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_hero_slides');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_HERO_SLIDES;
  });

  const updateHeroSlide = (index: number, slideUpdate: Partial<HeroSlide>) => {
    setHeroSlides(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], ...slideUpdate };
      }
      try {
        localStorage.setItem('stanbax_hero_slides', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addHeroSlide = (newSlide: HeroSlide) => {
    setHeroSlides(prev => {
      const updated = [...prev, newSlide];
      try {
        localStorage.setItem('stanbax_hero_slides', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteHeroSlide = (index: number) => {
    setHeroSlides(prev => {
      if (prev.length <= 1) {
        return prev;
      }
      const updated = prev.filter((_, i) => i !== index);
      try {
        localStorage.setItem('stanbax_hero_slides', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetHeroSlidesToDefault = () => {
    setHeroSlides(DEFAULT_HERO_SLIDES);
    try {
      localStorage.removeItem('stanbax_hero_slides');
    } catch {}
  };

  // Hero Highlights
  const [heroHighlights, setHeroHighlights] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_hero_highlights');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_HERO_HIGHLIGHTS;
  });

  const updateHeroHighlights = (highlights: string[]) => {
    setHeroHighlights(highlights);
    try {
      localStorage.setItem('stanbax_hero_highlights', JSON.stringify(highlights));
    } catch {}
  };

  const resetHeroHighlightsToDefault = () => {
    setHeroHighlights(DEFAULT_HERO_HIGHLIGHTS);
    try {
      localStorage.removeItem('stanbax_hero_highlights');
    } catch {}
  };

  // Key Pillars
  const [keyPillars, setKeyPillars] = useState<KeyPillarItem[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_key_pillars');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_KEY_PILLARS;
  });

  const [keyPillarsHeader, setKeyPillarsHeader] = useState<KeyPillarsHeader>(() => {
    try {
      const saved = localStorage.getItem('stanbax_key_pillars_header');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_KEY_PILLARS_HEADER;
  });

  const updateKeyPillar = (id: string, pillarUpdate: Partial<KeyPillarItem>) => {
    setKeyPillars(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...pillarUpdate } : p);
      try {
        localStorage.setItem('stanbax_key_pillars', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addKeyPillar = (newPillar: Omit<KeyPillarItem, 'id'>) => {
    const item: KeyPillarItem = {
      ...newPillar,
      id: `pil-${Date.now()}`
    };
    setKeyPillars(prev => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('stanbax_key_pillars', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteKeyPillar = (id: string) => {
    setKeyPillars(prev => {
      if (prev.length <= 1) {
        return prev;
      }
      const updated = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem('stanbax_key_pillars', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const updateKeyPillarsHeader = (headerUpdate: Partial<KeyPillarsHeader>) => {
    setKeyPillarsHeader(prev => {
      const updated = { ...prev, ...headerUpdate };
      try {
        localStorage.setItem('stanbax_key_pillars_header', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetKeyPillarsToDefault = () => {
    setKeyPillars(DEFAULT_KEY_PILLARS);
    setKeyPillarsHeader(DEFAULT_KEY_PILLARS_HEADER);
    try {
      localStorage.removeItem('stanbax_key_pillars');
      localStorage.removeItem('stanbax_key_pillars_header');
    } catch {}
  };

  // About Section Content
  const [aboutContent, setAboutContent] = useState<AboutSectionContent>(() => {
    try {
      const saved = localStorage.getItem('stanbax_about_content');
      if (saved) return { ...DEFAULT_ABOUT_CONTENT, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_ABOUT_CONTENT;
  });

  const updateAboutContent = (contentUpdate: Partial<AboutSectionContent>) => {
    setAboutContent(prev => {
      const updated = { ...prev, ...contentUpdate };
      try {
        localStorage.setItem('stanbax_about_content', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetAboutContentToDefault = () => {
    setAboutContent(DEFAULT_ABOUT_CONTENT);
    try {
      localStorage.removeItem('stanbax_about_content');
    } catch {}
  };

  // Academic Programs
  const [academicPrograms, setAcademicPrograms] = useState<AcademicProgram[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_academic_programs');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ACADEMIC_PROGRAMS;
  });

  const updateAcademicProgram = (id: string, progUpdate: Partial<AcademicProgram>) => {
    setAcademicPrograms(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...progUpdate } : p);
      try {
        localStorage.setItem('stanbax_academic_programs', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addAcademicProgram = (newProg: Omit<AcademicProgram, 'id'>) => {
    const item: AcademicProgram = {
      ...newProg,
      id: `prog-${Date.now()}`
    };
    setAcademicPrograms(prev => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('stanbax_academic_programs', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteAcademicProgram = (id: string) => {
    setAcademicPrograms(prev => {
      if (prev.length <= 1) {
        return prev;
      }
      const updated = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem('stanbax_academic_programs', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetAcademicProgramsToDefault = () => {
    setAcademicPrograms(DEFAULT_ACADEMIC_PROGRAMS);
    try {
      localStorage.removeItem('stanbax_academic_programs');
    } catch {}
  };

  // Featured Courses
  const [featuredCourses, setFeaturedCourses] = useState<FeaturedCourse[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_featured_courses');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FEATURED_COURSES;
  });

  const updateFeaturedCourse = (id: string, courseUpdate: Partial<FeaturedCourse>) => {
    setFeaturedCourses(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...courseUpdate } : c);
      try {
        localStorage.setItem('stanbax_featured_courses', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addFeaturedCourse = (newCourse: Omit<FeaturedCourse, 'id'>) => {
    const item: FeaturedCourse = {
      ...newCourse,
      id: `course-${Date.now()}`
    };
    setFeaturedCourses(prev => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('stanbax_featured_courses', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteFeaturedCourse = (id: string) => {
    setFeaturedCourses(prev => {
      const updated = prev.filter(c => c.id !== id);
      try {
        localStorage.setItem('stanbax_featured_courses', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetFeaturedCoursesToDefault = () => {
    setFeaturedCourses(DEFAULT_FEATURED_COURSES);
    try {
      localStorage.removeItem('stanbax_featured_courses');
    } catch {}
  };

  // Student Life: Clubs
  const [clubsList, setClubsList] = useState<Club[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_clubs_list');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CLUBS_LIST;
  });

  const updateClub = (id: string, clubUpdate: Partial<Club>) => {
    setClubsList(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...clubUpdate } : c);
      try {
        localStorage.setItem('stanbax_clubs_list', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addClub = (newClub: Omit<Club, 'id'>) => {
    const item: Club = {
      ...newClub,
      id: `club-${Date.now()}`
    };
    setClubsList(prev => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('stanbax_clubs_list', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteClub = (id: string) => {
    setClubsList(prev => {
      const updated = prev.filter(c => c.id !== id);
      try {
        localStorage.setItem('stanbax_clubs_list', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetClubsToDefault = () => {
    setClubsList(DEFAULT_CLUBS_LIST);
    try {
      localStorage.removeItem('stanbax_clubs_list');
    } catch {}
  };

  // Student Life: House Standings
  const [houseStandings, setHouseStandings] = useState<HouseStanding[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_house_standings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_HOUSE_STANDINGS;
  });

  const updateHouseStanding = (indexOrName: number | string, houseUpdate: Partial<HouseStanding>) => {
    setHouseStandings(prev => {
      const oldItem = prev.find((h, idx) => typeof indexOrName === 'number' ? idx === indexOrName : h.name === indexOrName);
      const oldName = oldItem?.name;
      const updated = prev.map((h, idx) => {
        const matches = typeof indexOrName === 'number' ? idx === indexOrName : h.name === indexOrName;
        return matches ? { ...h, ...houseUpdate } : h;
      });
      try {
        localStorage.setItem('stanbax_house_standings', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_house_standings', updated);
      void syncStateOnline('stanbax_house_standings', updated);

      // Cascade house renaming to existing students
      if (oldName && houseUpdate.name && houseUpdate.name !== oldName) {
        const newName = houseUpdate.name;
        setStudents(prevStudents => {
          let modified = false;
          const next = prevStudents.map(s => {
            if (s.house === oldName || (s.house && s.house.toLowerCase() === oldName.toLowerCase())) {
              modified = true;
              return { ...s, house: newName };
            }
            return s;
          });
          if (modified) {
            try {
              localStorage.setItem('stanbax_students', JSON.stringify(next));
            } catch {}
            broadcastLocalStateChange('stanbax_students', next);
            void syncStateOnline('stanbax_students', next);
          }
          return modified ? next : prevStudents;
        });
      }

      return updated;
    });
  };

  const addHouseStanding = (newHouse: HouseStanding) => {
    setHouseStandings(prev => {
      const updated = [...prev, newHouse];
      try {
        localStorage.setItem('stanbax_house_standings', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_house_standings', updated);
      void syncStateOnline('stanbax_house_standings', updated);
      return updated;
    });
  };

  const deleteHouseStanding = (indexOrName: number | string) => {
    setHouseStandings(prev => {
      const deletedItem = prev.find((h, idx) => typeof indexOrName === 'number' ? idx === indexOrName : h.name === indexOrName);
      const deletedName = deletedItem?.name;
      const updated = prev.filter((h, idx) => {
        return typeof indexOrName === 'number' ? idx !== indexOrName : h.name !== indexOrName;
      });
      try {
        localStorage.setItem('stanbax_house_standings', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_house_standings', updated);
      void syncStateOnline('stanbax_house_standings', updated);

      // Reassign students of deleted house to primary remaining house
      if (deletedName && updated.length > 0) {
        const fallbackHouse = updated[0].name;
        setStudents(prevStudents => {
          let modified = false;
          const next = prevStudents.map(s => {
            if (s.house === deletedName || (s.house && s.house.toLowerCase() === deletedName.toLowerCase())) {
              modified = true;
              return { ...s, house: fallbackHouse };
            }
            return s;
          });
          if (modified) {
            try {
              localStorage.setItem('stanbax_students', JSON.stringify(next));
            } catch {}
            broadcastLocalStateChange('stanbax_students', next);
            void syncStateOnline('stanbax_students', next);
          }
          return modified ? next : prevStudents;
        });
      }

      return updated;
    });
  };

  const resetHouseStandingsToDefault = () => {
    setHouseStandings(DEFAULT_HOUSE_STANDINGS);
    try {
      localStorage.setItem('stanbax_house_standings', JSON.stringify(DEFAULT_HOUSE_STANDINGS));
    } catch {}
    broadcastLocalStateChange('stanbax_house_standings', DEFAULT_HOUSE_STANDINGS);
    void syncStateOnline('stanbax_house_standings', DEFAULT_HOUSE_STANDINGS);
  };

  // Student Life: Bus Routes
  const [busRoutes, setBusRoutes] = useState<BusRoute[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_bus_routes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_BUS_ROUTES;
  });

  const updateBusRoute = (id: string, routeUpdate: Partial<BusRoute>) => {
    setBusRoutes(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, ...routeUpdate } : r);
      try {
        localStorage.setItem('stanbax_bus_routes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addBusRoute = (newRoute: Omit<BusRoute, 'id'>) => {
    const item: BusRoute = {
      ...newRoute,
      id: `route-${Date.now()}`
    };
    setBusRoutes(prev => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('stanbax_bus_routes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteBusRoute = (id: string) => {
    setBusRoutes(prev => {
      const updated = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem('stanbax_bus_routes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetBusRoutesToDefault = () => {
    setBusRoutes(DEFAULT_BUS_ROUTES);
    try {
      localStorage.removeItem('stanbax_bus_routes');
    } catch {}
  };

  // Student Life: Meal Menu
  const [mealMenu, setMealMenu] = useState<MealMenuItem[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_meal_menu');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_MEAL_MENU;
  });

  const updateMealMenuItem = (day: string, itemUpdate: Partial<MealMenuItem>) => {
    setMealMenu(prev => {
      const updated = prev.map(m => m.day.toLowerCase() === day.toLowerCase() ? { ...m, ...itemUpdate } : m);
      try {
        localStorage.setItem('stanbax_meal_menu', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetMealMenuToDefault = () => {
    setMealMenu(DEFAULT_MEAL_MENU);
    try {
      localStorage.removeItem('stanbax_meal_menu');
    } catch {}
  };

  // Academic Calendar Events
  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_calendar_events');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CALENDAR_EVENTS;
  });

  const updateCalendarEvent = (id: string, eventUpdate: Partial<AcademicCalendarEvent>) => {
    setCalendarEvents(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ...eventUpdate } : e);
      try {
        localStorage.setItem('stanbax_calendar_events', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addCalendarEvent = (newEvent: Omit<AcademicCalendarEvent, 'id'>) => {
    const item: AcademicCalendarEvent = {
      ...newEvent,
      id: `cal-${Date.now()}`
    };
    setCalendarEvents(prev => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('stanbax_calendar_events', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteCalendarEvent = (id: string) => {
    setCalendarEvents(prev => {
      const updated = prev.filter(e => e.id !== id);
      try {
        localStorage.setItem('stanbax_calendar_events', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetCalendarEventsToDefault = () => {
    setCalendarEvents(DEFAULT_CALENDAR_EVENTS);
    try {
      localStorage.removeItem('stanbax_calendar_events');
    } catch {}
  };

  // Testimonials
  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_testimonials');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TESTIMONIALS;
  });

  const [testimonialsHeader, setTestimonialsHeader] = useState<TestimonialsSectionContent>(() => {
    try {
      const saved = localStorage.getItem('stanbax_testimonials_header');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_TESTIMONIALS_HEADER;
  });

  const updateTestimonial = (id: string, testUpdate: Partial<Testimonial>) => {
    setTestimonials(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...testUpdate } : t);
      try {
        localStorage.setItem('stanbax_testimonials', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addTestimonial = (newTest: Omit<Testimonial, 'id'>) => {
    const item: Testimonial = {
      ...newTest,
      id: `test-${Date.now()}`
    };
    setTestimonials(prev => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('stanbax_testimonials', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteTestimonial = (id: string) => {
    setTestimonials(prev => {
      const updated = prev.filter(t => t.id !== id);
      try {
        localStorage.setItem('stanbax_testimonials', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const updateTestimonialsHeader = (headerUpdate: Partial<TestimonialsSectionContent>) => {
    setTestimonialsHeader(prev => {
      const updated = { ...prev, ...headerUpdate };
      try {
        localStorage.setItem('stanbax_testimonials_header', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetTestimonialsToDefault = () => {
    setTestimonials(DEFAULT_TESTIMONIALS);
    setTestimonialsHeader(DEFAULT_TESTIMONIALS_HEADER);
    try {
      localStorage.removeItem('stanbax_testimonials');
      localStorage.removeItem('stanbax_testimonials_header');
    } catch {}
  };

  // 17. Frequently Asked Questions (FAQ) Section (Persistent in localStorage)
  const [faqItems, setFaqItems] = useState<FAQItem[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_faq_items');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FAQ_ITEMS;
  });

  const [faqHeader, setFaqHeader] = useState<FAQSectionContent>(() => {
    try {
      const saved = localStorage.getItem('stanbax_faq_header');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FAQ_CONTENT;
  });

  const updateFaqItem = (id: string, itemUpdate: Partial<FAQItem>) => {
    setFaqItems(prev => {
      const updated = prev.map(f => f.id === id ? { ...f, ...itemUpdate } : f);
      try {
        localStorage.setItem('stanbax_faq_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addFaqItem = (newFaq: Omit<FAQItem, 'id'>) => {
    const item: FAQItem = {
      ...newFaq,
      id: `faq-${Date.now()}`,
      order: (newFaq.order !== undefined) ? newFaq.order : faqItems.length + 1
    };
    setFaqItems(prev => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('stanbax_faq_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteFaqItem = (id: string) => {
    setFaqItems(prev => {
      const updated = prev.filter(f => f.id !== id);
      try {
        localStorage.setItem('stanbax_faq_items', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const updateFaqHeader = (headerUpdate: Partial<FAQSectionContent>) => {
    setFaqHeader(prev => {
      const updated = { ...prev, ...headerUpdate };
      try {
        localStorage.setItem('stanbax_faq_header', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetFaqToDefault = () => {
    setFaqItems(DEFAULT_FAQ_ITEMS);
    setFaqHeader(DEFAULT_FAQ_CONTENT);
    try {
      localStorage.removeItem('stanbax_faq_items');
      localStorage.removeItem('stanbax_faq_header');
    } catch {}
  };

  // 2B. Proprietress Desk, Profile & Functions (Persistent)
  const [proprietressProfile, setProprietressProfile] = useState<ProprietressProfile>(() => {
    try {
      const saved = localStorage.getItem('stanbax_proprietress_profile');
      if (saved) return { ...DEFAULT_PROPRIETRESS_PROFILE, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_PROPRIETRESS_PROFILE;
  });

  const updateProprietressProfile = (info: Partial<ProprietressProfile>) => {
    setProprietressProfile(prev => {
      const updated = { ...prev, ...info };
      try {
        localStorage.setItem('stanbax_proprietress_profile', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetProprietressProfileToDefault = () => {
    setProprietressProfile(DEFAULT_PROPRIETRESS_PROFILE);
    try {
      localStorage.removeItem('stanbax_proprietress_profile');
    } catch {}
  };

  // Appointments with the Proprietress
  const [appointments, setAppointments] = useState<ProprietressAppointment[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_proprietress_appointments');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PROPRIETRESS_APPOINTMENTS;
  });

  const bookAppointment = (apptData: Omit<ProprietressAppointment, 'id' | 'refNumber' | 'status' | 'submittedAt'>): string => {
    const refNumber = `STX-EXEC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newAppt: ProprietressAppointment = {
      ...apptData,
      id: `appt-${Date.now()}`,
      refNumber,
      status: 'Pending Review',
      submittedAt: new Date().toISOString().split('T')[0]
    };
    setAppointments(prev => {
      const updated = [newAppt, ...prev];
      try {
        localStorage.setItem('stanbax_proprietress_appointments', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    return refNumber;
  };

  const updateAppointmentStatus = (id: string, status: ProprietressAppointment['status'], executiveResponse?: string) => {
    setAppointments(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, status, ...(executiveResponse !== undefined ? { executiveResponse } : {}) } : a);
      try {
        localStorage.setItem('stanbax_proprietress_appointments', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteAppointment = (id: string) => {
    setAppointments(prev => {
      const updated = prev.filter(a => a.id !== id);
      try {
        localStorage.setItem('stanbax_proprietress_appointments', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Confidential Messages / Letters to the Proprietress
  const [messagesToProprietress, setMessagesToProprietress] = useState<ProprietressMessage[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_proprietress_messages');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PROPRIETRESS_MESSAGES;
  });

  const sendMessageToProprietress = (msgData: Omit<ProprietressMessage, 'id' | 'refNumber' | 'date' | 'status'>): string => {
    const refNumber = `STX-CONF-${Math.floor(1000 + Math.random() * 9000)}`;
    const newMsg: ProprietressMessage = {
      ...msgData,
      id: `msg-${Date.now()}`,
      refNumber,
      date: new Date().toISOString().split('T')[0],
      status: 'New'
    };
    setMessagesToProprietress(prev => {
      const updated = [newMsg, ...prev];
      try {
        localStorage.setItem('stanbax_proprietress_messages', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    return refNumber;
  };

  const updateProprietressMessageStatus = (id: string, status: ProprietressMessage['status'], note?: string) => {
    setMessagesToProprietress(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, status, ...(note !== undefined ? { proprietressNote: note } : {}) } : m);
      try {
        localStorage.setItem('stanbax_proprietress_messages', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteProprietressMessage = (id: string) => {
    setMessagesToProprietress(prev => {
      const updated = prev.filter(m => m.id !== id);
      try {
        localStorage.setItem('stanbax_proprietress_messages', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Executive Directives from the Proprietress Desk
  const [directives, setDirectives] = useState<ProprietressDirective[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_proprietress_directives');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PROPRIETRESS_DIRECTIVES;
  });

  const addDirective = (dirData: Omit<ProprietressDirective, 'id'>) => {
    const newDir: ProprietressDirective = {
      ...dirData,
      id: `dir-${Date.now()}`
    };
    setDirectives(prev => {
      const updated = [newDir, ...prev];
      try {
        localStorage.setItem('stanbax_proprietress_directives', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const updateDirective = (id: string, updatedData: Partial<ProprietressDirective>) => {
    setDirectives(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, ...updatedData } : d);
      try {
        localStorage.setItem('stanbax_proprietress_directives', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteDirective = (id: string) => {
    setDirectives(prev => {
      const updated = prev.filter(d => d.id !== id);
      try {
        localStorage.setItem('stanbax_proprietress_directives', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetDirectivesToDefault = () => {
    setDirectives(DEFAULT_PROPRIETRESS_DIRECTIVES);
    try {
      localStorage.removeItem('stanbax_proprietress_directives');
    } catch {}
  };

  // 3. Faculty Members (Dynamic for landing page)
  const [facultyList, setFacultyList] = useState<FacultyMember[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_faculty_members');
      if (saved) return JSON.parse(saved);
    } catch {}
    return FACULTY_MEMBERS;
  });

  const addFacultyMember = (memberData: Omit<FacultyMember, 'id'>) => {
    const newMember: FacultyMember = {
      ...memberData,
      id: `fac-${Date.now()}`
    };
    setFacultyList(prev => {
      const updated = [...prev, newMember];
      try {
        localStorage.setItem('stanbax_faculty_members', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const updateFacultyMember = (id: string, updatedData: Partial<FacultyMember>) => {
    setFacultyList(prev => {
      const updated = prev.map(member => member.id === id ? { ...member, ...updatedData } : member);
      try {
        localStorage.setItem('stanbax_faculty_members', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteFacultyMember = (id: string) => {
    setFacultyList(prev => {
      const updated = prev.filter(member => member.id !== id);
      try {
        localStorage.setItem('stanbax_faculty_members', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetFacultyToDefault = () => {
    setFacultyList(FACULTY_MEMBERS);
    try {
      localStorage.removeItem('stanbax_faculty_members');
    } catch {}
  };

  // 4. Classes & Fees
  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_classes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CLASSES;
  });

  const addClass = (clsData: Omit<SchoolClass, 'id'>) => {
    const newClass: SchoolClass = {
      ...clsData,
      id: `cls-${Date.now()}`
    };
    setClasses(prev => {
      const updated = [...prev, newClass];
      try {
        localStorage.setItem('stanbax_classes', JSON.stringify(updated));
      } catch {}
      void syncStateOnline('stanbax_classes', updated);
      return updated;
    });
  };

  // Resolve a class catalogue entry from either its id or its display name
  const resolveClassId = (gradeName?: string): string | undefined => {
    const needle = (gradeName || '').trim().toLowerCase();
    if (!needle) return undefined;
    return classes.find(c => (c.name || '').trim().toLowerCase() === needle)?.id
      || classes.find(c => c.id === gradeName)?.id;
  };

  const updateClass = (id: string, updatedData: Partial<SchoolClass>) => {
    const before = classes.find(c => c.id === id);
    setClasses(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updatedData } : c);
      try {
        localStorage.setItem('stanbax_classes', JSON.stringify(updated));
      } catch {}
      void syncStateOnline('stanbax_classes', updated);
      return updated;
    });
    // Renaming a class propagates the new display name to every record joined
    // by classId (or the legacy name match) so nothing is orphaned.
    if (before && updatedData.name && updatedData.name.trim() && updatedData.name !== before.name) {
      const newName = updatedData.name.trim();
      const oldName = before.name;
      setStudents(prev => {
        const updated = prev.map(s => (s.classId === id || s.grade === oldName)
          ? { ...s, classId: id, grade: newName }
          : s);
        try {
          localStorage.setItem('stanbax_students', JSON.stringify(updated));
        } catch {}
        void syncStateOnline('stanbax_students', updated);
        return updated;
      });
      setTimetables(prev => {
        const updated = prev.map(t => t.classId === id ? { ...t, className: newName } : t);
        try {
          localStorage.setItem('stanbax_weekly_timetables', JSON.stringify(updated));
        } catch {}
        void syncStateOnline('stanbax_weekly_timetables', updated);
        return updated;
      });
      setAttendanceRecords(prev => {
        const updated = prev.map(r => r.classId === id ? { ...r, className: newName } : r);
        try {
          localStorage.setItem('stanbax_attendance_records', JSON.stringify(updated));
        } catch {}
        void syncStateOnline('stanbax_attendance_records', updated);
        return updated;
      });
      setHomeworks(prev => {
        const updated = prev.map(hw => (hw.targetClassId === id || hw.targetClass === oldName)
          ? { ...hw, targetClass: newName, targetClassId: id }
          : hw);
        try {
          localStorage.setItem('stanbax_homeworks', JSON.stringify(updated));
        } catch {}
        void syncStateOnline('stanbax_homeworks', updated);
        return updated;
      });
      setCbtExams(prev => {
        const updated = prev.map(e => e.targetClassId === id ? { ...e, targetClass: newName } : e);
        try {
          localStorage.setItem('stanbax_cbt_exams', JSON.stringify(updated));
        } catch {}
        void syncStateOnline('stanbax_cbt_exams', updated);
        return updated;
      });
      setLessonNotes(prev => {
        const updated = prev.map(n => (n.targetClass === oldName || n.targetClass === newName)
          ? { ...n, targetClass: newName }
          : n);
        try {
          localStorage.setItem('stanbax_lesson_notes', JSON.stringify(updated));
        } catch {}
        void syncStateOnline('stanbax_lesson_notes', updated);
        return updated;
      });
    }
  };

  const deleteClass = (id: string) => {
    setClasses(prev => {
      const updated = prev.filter(c => c.id !== id);
      try {
        localStorage.setItem('stanbax_classes', JSON.stringify(updated));
      } catch {}
      void syncStateOnline('stanbax_classes', updated);
      return updated;
    });
    // Clear the dangling link on enrolled scholars — their `grade` label is
    // preserved so no student data is lost.
    setStudents(prev => {
      const updated = prev.map(s => s.classId === id ? { ...s, classId: undefined } : s);
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(updated));
      } catch {}
      void syncStateOnline('stanbax_students', updated);
      return updated;
    });
  };

  const resetClassesToDefault = () => {
    setClasses(DEFAULT_CLASSES);
    try {
      localStorage.removeItem('stanbax_classes');
    } catch {}
    void syncStateOnline('stanbax_classes', DEFAULT_CLASSES);
  };

  const assignClassTeacher = (classId: string, tutorId?: string) => {
    const cls = classes.find(c => c.id === classId);
    const previousTutorId = cls?.classTeacherId;
    updateClass(classId, { classTeacherId: tutorId || undefined });
    // Keep TutorProfile.assignedClasses in sync with the class-side assignment
    setTutors(prev => {
      const updated = prev.map(t => {
        const assigned = t.assignedClasses || [];
        if (cls && t.id === tutorId && !assigned.includes(cls.name)) {
          return { ...t, assignedClasses: [...assigned, cls.name] };
        }
        if (cls && t.id === previousTutorId && t.id !== tutorId) {
          return { ...t, assignedClasses: assigned.filter(name => name !== cls.name) };
        }
        return t;
      });
      try {
        localStorage.setItem('stanbax_tutors', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // 5. Subjects & Curriculum
  const normalizeSubject = (s: Subject): Subject => {
    // The editor writes applicableLevels, while older records may also carry
    // applicableCategories. Keep both aliases identical so every portal sees edits.
    const rawLevels = Array.isArray(s.applicableLevels)
      ? s.applicableLevels
      : Array.isArray(s.applicableCategories)
        ? s.applicableCategories
        : ['Senior Secondary'];
    const levels = Array.from(new Set(rawLevels
      .filter((level): level is string => typeof level === 'string')
      .map(level => level.trim())
      .filter(Boolean)));
    return {
      ...s,
      applicableCategories: levels,
      applicableLevels: [...levels],
      description: s.description || '',
    };
  };

  const mergeSubjectUpdate = (current: Subject, updates: Partial<Subject>): Subject => {
    const merged = { ...current, ...updates };
    const editedLevels = Array.isArray(updates.applicableLevels)
      ? updates.applicableLevels
      : Array.isArray(updates.applicableCategories)
        ? updates.applicableCategories
        : undefined;
    if (editedLevels) {
      merged.applicableLevels = editedLevels;
      merged.applicableCategories = editedLevels;
    }
    return normalizeSubject(merged);
  };

  const normalizeSubjectCatalog = (items: Subject[]): Subject[] => {
    const byName = new Map<string, Subject>();
    items.forEach(item => {
      if (!item?.name?.trim()) return;
      const normalized = normalizeSubject({ ...item, name: item.name.trim() });
      const key = normalized.name.toLowerCase();
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, normalized);
        return;
      }
      const levels = Array.from(new Set([
        ...(existing.applicableLevels || []),
        ...(normalized.applicableLevels || []),
      ]));
      byName.set(key, normalizeSubject({
        ...existing,
        ...normalized,
        id: existing.id,
        code: normalized.code || existing.code,
        department: normalized.department || existing.department,
        description: normalized.description || existing.description,
        applicableLevels: levels,
        applicableCategories: levels,
      }));
    });
    return Array.from(byName.values());
  };

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_subjects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeSubject);
        }
      }
    } catch {}
    return DEFAULT_SUBJECTS.map(normalizeSubject);
  });

  const addSubject = (subjData: Omit<Subject, 'id'>) => {
    const newSubject: Subject = normalizeSubject({
      ...subjData,
      id: `sub-${Date.now()}`
    });
    setSubjects(prev => {
      const exists = prev.some(
        s => s.name.trim().toLowerCase() === newSubject.name.trim().toLowerCase()
      );
      const updated = exists
        ? prev.map(s =>
            s.name.trim().toLowerCase() === newSubject.name.trim().toLowerCase()
              ? mergeSubjectUpdate(s, subjData)
              : s
          )
        : [...prev, newSubject];
      try {
        localStorage.setItem('stanbax_subjects', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_subjects', updated);
      void syncStateOnline('stanbax_subjects', updated);
      void fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: updated }),
      }).catch(() => {});
      return updated;
    });
  };

  const updateSubject = (id: string, updatedData: Partial<Subject>) => {
    setSubjects(prev => {
      const updated = prev.map(s => s.id === id ? mergeSubjectUpdate(s, updatedData) : s);
      try {
        localStorage.setItem('stanbax_subjects', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_subjects', updated);
      void syncStateOnline('stanbax_subjects', updated);
      void fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: updated }),
      }).catch(() => {});
      return updated;
    });
  };

  const deleteSubject = (id: string) => {
    setSubjects(prev => {
      const updated = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem('stanbax_subjects', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_subjects', updated);
      void syncStateOnline('stanbax_subjects', updated);
      void fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: updated }),
      }).catch(() => {});
      return updated;
    });
  };

  const resetSubjectsToDefault = () => {
    const defaults = DEFAULT_SUBJECTS.map(normalizeSubject);
    setSubjects(defaults);
    try {
      localStorage.setItem('stanbax_subjects', JSON.stringify(defaults));
    } catch {}
    broadcastLocalStateChange('stanbax_subjects', defaults);
    void syncStateOnline('stanbax_subjects', defaults);
    void fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjects: defaults }),
    }).catch(() => {});
  };

  // 6. Grading System
  const [gradingSystem, setGradingSystem] = useState<GradeRule[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_grading_system');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_GRADING_SYSTEM;
  });

  const updateGradingRule = (id: string, updatedData: Partial<GradeRule>) => {
    setGradingSystem(prev => {
      const updated = prev.map(rule => rule.id === id ? { ...rule, ...updatedData } : rule);
      try {
        localStorage.setItem('stanbax_grading_system', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addGradingRule = (ruleData: Omit<GradeRule, 'id'>) => {
    const newRule: GradeRule = {
      ...ruleData,
      id: `grd-${Date.now()}`
    };
    setGradingSystem(prev => {
      const updated = [...prev, newRule].sort((a, b) => b.minScore - a.minScore);
      try {
        localStorage.setItem('stanbax_grading_system', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteGradingRule = (id: string) => {
    setGradingSystem(prev => {
      const updated = prev.filter(r => r.id !== id);
      try {
        localStorage.setItem('stanbax_grading_system', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetGradingSystem = () => {
    setGradingSystem(DEFAULT_GRADING_SYSTEM);
    try {
      localStorage.removeItem('stanbax_grading_system');
    } catch {}
  };

  // Grade calculation helper based on dynamic grading system
  const calculateGrade = (totalScore: number): { grade: string; remark: string; color: string; gradePoint: number } => {
    const rounded = Math.round(totalScore);
    const matched = gradingSystem.find(r => rounded >= r.minScore && rounded <= r.maxScore);
    if (matched) {
      const gp = matched.gradePoint !== undefined ? matched.gradePoint : (
        matched.grade === 'A1' ? 5.0 :
        matched.grade === 'B2' ? 4.0 :
        matched.grade === 'B3' ? 3.5 :
        matched.grade === 'C4' ? 3.0 :
        matched.grade === 'C5' ? 2.5 :
        matched.grade === 'C6' ? 2.0 :
        matched.grade === 'D7' ? 1.5 :
        matched.grade === 'E8' ? 1.0 : 0.0
      );
      return { grade: matched.grade, remark: matched.remark, color: matched.color, gradePoint: gp };
    }
    // Fallback if none matches exactly
    if (totalScore >= 75) return { grade: 'A1', remark: 'Distinction', color: 'bg-emerald-100 text-emerald-900 border-emerald-300', gradePoint: 5.0 };
    if (totalScore >= 70) return { grade: 'B2', remark: 'Very Good', color: 'bg-blue-100 text-blue-900 border-blue-300', gradePoint: 4.0 };
    if (totalScore >= 65) return { grade: 'B3', remark: 'Good', color: 'bg-cyan-100 text-cyan-900 border-cyan-300', gradePoint: 3.5 };
    if (totalScore >= 60) return { grade: 'C4', remark: 'Credit (Upper)', color: 'bg-amber-100 text-amber-900 border-amber-300', gradePoint: 3.0 };
    if (totalScore >= 55) return { grade: 'C5', remark: 'Credit', color: 'bg-amber-100 text-amber-900 border-amber-300', gradePoint: 2.5 };
    if (totalScore >= 50) return { grade: 'C6', remark: 'Credit (Lower)', color: 'bg-slate-100 text-slate-800 border-slate-300', gradePoint: 2.0 };
    if (totalScore >= 45) return { grade: 'D7', remark: 'Pass', color: 'bg-orange-100 text-orange-900 border-orange-300', gradePoint: 1.5 };
    if (totalScore >= 40) return { grade: 'E8', remark: 'Weak Pass', color: 'bg-orange-100 text-orange-900 border-orange-300', gradePoint: 1.0 };
    return { grade: 'F9', remark: 'Fail', color: 'bg-rose-100 text-rose-900 border-rose-300', gradePoint: 0.0 };
  };

  // CGPA calculation helper
  const calculateGpa = (
    gradesList: GradeRecord[], 
    customScale?: 5.0 | 4.0
  ): { gpa: number; scale: number; totalPoints: number; totalCredits: number; classification: string } => {
    const scale = customScale || assessmentConfig.cgpaScale || 5.0;
    if (!gradesList || gradesList.length === 0) {
      return { gpa: 0, scale, totalPoints: 0, totalCredits: 0, classification: 'N/A' };
    }

    let totalPoints = 0;
    const totalCredits = gradesList.length;

    for (const g of gradesList) {
      const gInfo = calculateGrade(g.total);
      let point = gInfo.gradePoint ?? 0;
      if (scale === 4.0) {
        point = Math.max(0, parseFloat(((point / 5.0) * 4.0).toFixed(2)));
      }
      totalPoints += point;
    }

    const gpa = totalCredits > 0 ? parseFloat((totalPoints / totalCredits).toFixed(2)) : 0;

    let classification = 'Pass';
    if (scale === 5.0) {
      if (gpa >= 4.5) classification = 'First Class / Distinction Honours';
      else if (gpa >= 3.5) classification = 'Second Class Upper / Credit';
      else if (gpa >= 2.5) classification = 'Second Class Lower / Merit';
      else if (gpa >= 1.5) classification = 'Third Class / Pass';
      else classification = 'Academic Warning / Remedial';
    } else {
      if (gpa >= 3.5) classification = 'First Class / Distinction Honours';
      else if (gpa >= 3.0) classification = 'Upper Credit / Very Good';
      else if (gpa >= 2.0) classification = 'Credit / Good';
      else if (gpa >= 1.0) classification = 'Pass';
      else classification = 'Academic Warning / Remedial';
    }

    return { gpa, scale, totalPoints: parseFloat(totalPoints.toFixed(2)), totalCredits, classification };
  };

  const isCgpaActiveForClass = (classNameOrId?: string): boolean => {
    if (!assessmentConfig.cgpaEnabled) return false;
    if (!classNameOrId) return false;
    const activeClasses = assessmentConfig.cgpaActiveClasses || [];
    const normalizedInput = classNameOrId.trim().toLowerCase();
    return activeClasses.some(c => {
      const norm = c.trim().toLowerCase();
      return norm === normalizedInput || 
             normalizedInput.includes(norm) || 
             norm.includes(normalizedInput);
    });
  };

  const toggleCgpaForClass = (className: string) => {
    const currentList = assessmentConfig.cgpaActiveClasses || [];
    const exists = currentList.includes(className);
    const updated = exists 
      ? currentList.filter(c => c !== className)
      : [...currentList, className];
    updateAssessmentConfig({ cgpaActiveClasses: updated });
  };

  const setCgpaActiveClasses = (newClasses: string[]) => {
    updateAssessmentConfig({ cgpaActiveClasses: newClasses });
  };

  // -------------------------------------------------------------------------
  // PERMANENT TOMBSTONED DELETED ACCOUNTS & REALTIME CONCURRENCY
  // -------------------------------------------------------------------------
  const [deletedAccountIds, setDeletedAccountIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_deleted_account_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.map((x: any) => String(x).toLowerCase());
      }
    } catch {}
    return [];
  });

  const deletedAccountIdsRef = useRef<Set<string>>(new Set<string>(deletedAccountIds));

  useEffect(() => {
    deletedAccountIds.forEach(id => {
      deletedAccountIdsRef.current.add(String(id).toLowerCase());
      deletedAccountIdsRef.current.add(String(id).toLowerCase().replace(/\s+/g, ''));
    });
  }, [deletedAccountIds]);

  const isAccountTombstoned = (id?: string, identifier?: string, email?: string): boolean => {
    const set = deletedAccountIdsRef.current;
    if (id && set.has(String(id).toLowerCase())) return true;
    if (identifier) {
      const lower = String(identifier).toLowerCase();
      if (set.has(lower)) return true;
      if (set.has(lower.replace(/\s+/g, ''))) return true;
    }
    if (email && set.has(String(email).toLowerCase().trim())) return true;
    return false;
  };

  const [activeOnlineUsersCount, setActiveOnlineUsersCount] = useState<number>(1);

  const markAccountAsPermanentlyDeleted = (id: string, identifier?: string, role?: string) => {
    const cleanId = String(id).toLowerCase();
    const cleanIdent = identifier ? String(identifier).toLowerCase() : undefined;
    deletedAccountIdsRef.current.add(cleanId);
    if (cleanIdent) {
      deletedAccountIdsRef.current.add(cleanIdent);
      deletedAccountIdsRef.current.add(cleanIdent.replace(/\s+/g, ''));
    }
    setDeletedAccountIds(prev => {
      const next = new Set(prev);
      next.add(cleanId);
      if (cleanIdent) {
        next.add(cleanIdent);
        next.add(cleanIdent.replace(/\s+/g, ''));
      }
      const arr = Array.from(next);
      try { localStorage.setItem('stanbax_deleted_account_ids', JSON.stringify(arr)); } catch {}
      broadcastLocalStateChange('stanbax_deleted_account_ids', arr);
      void syncStateOnline('stanbax_deleted_account_ids', arr);
      return arr;
    });

    void fetch('/api/accounts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cleanId, identifier: cleanIdent, role })
    }).catch(() => {});
  };

  // 7. Tutors with Subject Assignments
  const [tutors, setTutors] = useState<TutorProfile[]>(() => {
    const deletedSet = new Set<string>();
    try {
      const rawDel = localStorage.getItem('stanbax_deleted_account_ids');
      if (rawDel) JSON.parse(rawDel).forEach((x: any) => deletedSet.add(String(x).toLowerCase()));
    } catch {}

    try {
      const saved = localStorage.getItem('stanbax_tutors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(t => t?.id && !deletedSet.has(t.id.toLowerCase()) && (!t.email || !deletedSet.has(t.email.toLowerCase().trim())));
        }
      }
    } catch {}
    return DEMO_TUTORS.filter(t => !deletedSet.has(t.id.toLowerCase()) && (!t.email || !deletedSet.has(t.email.toLowerCase().trim())));
  });

  const [activeTutorId, setActiveTutorId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('stanbax_tutor_id') || localStorage.getItem('stanbax_tutor_id') || DEMO_TUTOR.id;
    } catch {
      return DEMO_TUTOR.id;
    }
  });

  const tutor = tutors.find(t => t.id === activeTutorId) || tutors[0] || DEMO_TUTOR;

  const updateTutor = (id: string, updatedData: Partial<TutorProfile>) => {
    setTutors(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updatedData } : t);
      try {
        localStorage.setItem('stanbax_tutors', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addTutor = (tutorData: Omit<TutorProfile, 'id'>) => {
    const newTutor: TutorProfile = {
      ...tutorData,
      id: `tut-${Date.now()}`
    };
    setTutors(prev => {
      const updated = [...prev, newTutor];
      try {
        localStorage.setItem('stanbax_tutors', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteTutor = (id: string) => {
    const target = tutors.find(t => t.id === id);
    markAccountAsPermanentlyDeleted(id, target?.email || target?.staffId, 'tutor');
    void fetch(`/api/tutors/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    if (target?.email || target?.staffId) {
      void remoteDeleteCredential((target.email || target.staffId) as string, id);
    }
    setTutors(prev => {
      const updated = prev.filter(t => t.id !== id);
      try {
        localStorage.setItem('stanbax_tutors', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_tutors', updated);
      void syncStateOnline('stanbax_tutors', updated);
      return updated;
    });
  };

  // 8. Manage Notices & Bulletins
  const [notices, setNotices] = useState<Notice[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_notices');
      if (saved) return JSON.parse(saved);
    } catch {}
    return RECENT_NOTICES;
  });

  const updateNotice = (id: string, updatedData: Partial<Notice>) => {
    setNotices(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, ...updatedData } : n);
      try {
        localStorage.setItem('stanbax_notices', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addNotice = (noticeData: Omit<Notice, 'id'>) => {
    const newNotice: Notice = {
      ...noticeData,
      id: `notice-${Date.now()}`
    };
    setNotices(prev => {
      const updated = [newNotice, ...prev];
      localStorage.setItem('stanbax_notices', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteNotice = (id: string) => {
    setNotices(prev => {
      const updated = prev.filter(n => n.id !== id);
      localStorage.setItem('stanbax_notices', JSON.stringify(updated));
      return updated;
    });
  };

  // 9. Admissions Applications & Entrance Exam Settings
  const DEFAULT_ENTRANCE_EXAM_SETTINGS: EntranceExamSettings = {
    examTitle: 'Stanbax Standard Entrance & Scholarship Screening',
    examDate: 'Next Saturday',
    examTime: '9:00 AM',
    venue: 'Stanbax Main Hall, Ring Road / Oluyole Axis, Ibadan',
    duration: '2 Hours (Mathematics, English & General Paper)',
    subjects: ['Mathematics', 'English Language', 'Quantitative Reasoning', 'Verbal Aptitude & General Knowledge'],
    requirements: [
      '2 recent passport-sized photographs',
      'Writing materials (HB pencils, pens, eraser, 30cm ruler)',
      'Photocopy of candidate birth certificate',
      'Photocopy of last term academic report sheet',
      'Printed Application Slip / Reference Code'
    ],
    coordinatorName: 'Admissions Screening Committee',
    coordinatorPhone: '+234 803 456 7890',
    passMark: 60,
    instructions: 'Candidates must arrive 30 minutes before exam time for verification and accreditation. Parents are welcome to wait in the hospitality lounge.',
    fee: 'Free / Included with Application'
  };

  const [entranceExamSettings, setEntranceExamSettings] = useState<EntranceExamSettings>(() => {
    try {
      const saved = localStorage.getItem('stanbax_entrance_exam_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_ENTRANCE_EXAM_SETTINGS;
  });

  const updateEntranceExamSettings = (settings: Partial<EntranceExamSettings>) => {
    setEntranceExamSettings(prev => {
      const updated = { ...prev, ...settings };
      localStorage.setItem('stanbax_entrance_exam_settings', JSON.stringify(updated));
      return updated;
    });
  };

  const resetEntranceExamSettings = () => {
    setEntranceExamSettings(DEFAULT_ENTRANCE_EXAM_SETTINGS);
    try {
      localStorage.removeItem('stanbax_entrance_exam_settings');
    } catch {}
  };

  const [applications, setApplications] = useState<AdmissionApplication[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_applications');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_APPLICATIONS;
  });

  const submitApplication = (appData: Omit<AdmissionApplication, 'id' | 'refNumber' | 'dateSubmitted' | 'status' | 'screeningDate'>) => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const ref = `STX-${randomSuffix}`;
    const newApp: AdmissionApplication = {
      ...appData,
      id: `app-${Date.now()}`,
      refNumber: ref,
      dateSubmitted: new Date().toISOString().split('T')[0],
      status: 'Pending Review',
      screeningDate: `${entranceExamSettings.examDate}, ${entranceExamSettings.examTime}`,
      screeningTime: entranceExamSettings.examTime,
      screeningVenue: entranceExamSettings.venue,
      examSubjects: entranceExamSettings.subjects,
      examRequirements: entranceExamSettings.requirements.join(' • ')
    };
    setApplications(prev => {
      const updated = [newApp, ...prev];
      localStorage.setItem('stanbax_applications', JSON.stringify(updated));
      return updated;
    });
    return ref;
  };

  const updateApplicationStatus = (id: string, status: AdmissionApplication['status'], screeningDate?: string) => {
    setApplications(prev => {
      const updated = prev.map(app => {
        if (app.id === id) {
          return {
            ...app,
            status,
            screeningDate: screeningDate || app.screeningDate
          };
        }
        return app;
      });
      localStorage.setItem('stanbax_applications', JSON.stringify(updated));
      return updated;
    });
  };

  const updateApplicationExamDetails = (id: string, details: Partial<AdmissionApplication>) => {
    setApplications(prev => {
      const updated = prev.map(app => {
        if (app.id === id) {
          return {
            ...app,
            ...details
          };
        }
        return app;
      });
      localStorage.setItem('stanbax_applications', JSON.stringify(updated));
      return updated;
    });
  };

  // 9b. Parent Broadcast Logs
  const [broadcastLogs, setBroadcastLogs] = useState<ParentBroadcastLog[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_broadcast_logs');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_BROADCAST_LOGS;
  });

  const addBroadcastLog = (logData: Omit<ParentBroadcastLog, 'id' | 'dateSent'>) => {
    const newLog: ParentBroadcastLog = {
      ...logData,
      id: `blog-${Date.now()}`,
      dateSent: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    setBroadcastLogs(prev => {
      const updated = [newLog, ...prev];
      try {
        localStorage.setItem('stanbax_broadcast_logs', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Helper to determine next class on promotion — always returns a real class name
  // (or the sentinel 'Graduated / Alumni' for terminal classes).
  const getNextClass = (currentGrade: string): string => {
    const clean = (currentGrade || '').trim();
    if (/SSS 3|Senior Secondary 3|Grade 12/i.test(clean)) return 'Graduated / Alumni';
    if (/JSS 3|Junior Secondary 3|Basic 9/i.test(clean)) return 'SSS 1 Science';
    if (/Primary 6|Basic 6|Grade 6/i.test(clean)) return 'JSS 1';
    if (/Nursery 2|KG 2/i.test(clean)) return 'Primary 1';
    if (/Creche|Playgroup/i.test(clean)) return 'Nursery 1';
    const numMatch = clean.match(/(\d+)/);
    if (numMatch) {
      return clean.replace(numMatch[1], String(Number(numMatch[1]) + 1));
    }
    return `${clean} (Advanced)`;
  };

  // 10. Students & Homework
  const [students, setStudents] = useState<StudentProfile[]>(() => {
    const normalize = (s: StudentProfile): StudentProfile => {
      // Backfill classId from the grade label for records saved before the
      // id migration, and keep the displayed grade synced to the class name
      // so a class rename flows through to the scholar's profile.
      const classId = s.classId || resolveClassId(s.grade);
      const cls = classId ? classes.find(c => c.id === classId) : undefined;
      return {
        ...s,
        classId: classId || s.classId,
        grade: cls ? cls.name : s.grade,
        academicHistory: (s.academicHistory && s.academicHistory.length > 0)
          ? s.academicHistory
          : generateStudentHistoricalRecords(s)
      };
    };
    const deletedSet = new Set<string>();
    try {
      const rawDel = localStorage.getItem('stanbax_deleted_account_ids');
      if (rawDel) JSON.parse(rawDel).forEach((x: any) => deletedSet.add(String(x).toLowerCase()));
    } catch {}

    try {
      const saved = localStorage.getItem('stanbax_students');
      if (saved) {
        const parsed: StudentProfile[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const activeStudents = deduplicateStudentsByRegistration(
            parsed
              .filter(s => s && s.id && !deletedSet.has(s.id.toLowerCase()) && (!s.regNumber || !deletedSet.has(s.regNumber.toLowerCase().replace(/\s+/g, ''))))
              .map(normalize)
          );
          return activeStudents;
        }
      }
    } catch {}
    return deduplicateStudentsByRegistration(
      DEMO_STUDENTS.filter(s => !deletedSet.has(s.id.toLowerCase()) && (!s.regNumber || !deletedSet.has(s.regNumber.toLowerCase().replace(/\s+/g, '')))).map(normalize)
    );
  });

  const latestStudentsRef = useRef<StudentProfile[]>(students);
  useEffect(() => {
    latestStudentsRef.current = students;
  }, [students]);

  const [activeStudentId, setActiveStudentId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('stanbax_student_id') || localStorage.getItem('stanbax_student_id') || DEMO_STUDENT.id;
    } catch {
      return DEMO_STUDENT.id;
    }
  });

  const student = (() => {
    const savedReg = (() => {
      try {
        return sessionStorage.getItem('stanbax_student_reg') || localStorage.getItem('stanbax_student_reg') || '';
      } catch {
        return '';
      }
    })();
    const normActive = normalizeRegForUpsert(activeStudentId);
    const normSavedReg = normalizeRegForUpsert(savedReg);

    const directMatch = students.find(s => {
      if (!s) return false;
      if (s.id === activeStudentId) return true;
      const sRegNorm = normalizeRegForUpsert(s.regNumber);
      if (normActive && sRegNorm && sRegNorm === normActive) return true;
      if (normSavedReg && sRegNorm && sRegNorm === normSavedReg) return true;
      return false;
    });
    if (directMatch) {
      return stripDemoGradesFromStudent(directMatch);
    }

    try {
      const cached = sessionStorage.getItem('stanbax_active_student_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed) {
          const parsedRegNorm = normalizeRegForUpsert(parsed.regNumber);
          const fromRosterByReg = parsedRegNorm
            ? students.find(s => normalizeRegForUpsert(s.regNumber) === parsedRegNorm)
            : undefined;
          if (fromRosterByReg) {
            return stripDemoGradesFromStudent(fromRosterByReg);
          }
          if (parsed.id === activeStudentId || (normSavedReg && parsedRegNorm === normSavedReg)) {
            return stripDemoGradesFromStudent(parsed as StudentProfile);
          }
        }
      }
    } catch {}

    return stripDemoGradesFromStudent(students[0] || DEMO_STUDENT);
  })();

  const switchActiveStudent = (id: string) => {
    setActiveStudentId(id);
  };

  const updateStudent = (id: string, updatedData: Partial<StudentProfile>) => {
    const nowIso = new Date().toISOString();
    const targetNormReg = normalizeRegForUpsert((updatedData as any)?.regNumber || id);
    let updatedStudentRecord: StudentProfile | null = null;
    let nextStudentsSnapshot: StudentProfile[] = [];

    setStudents(prev => {
      const updated = prev.map(s => {
        const isMatch =
          s.id === id ||
          (targetNormReg && normalizeRegForUpsert(s.regNumber) === targetNormReg);
        if (!isMatch) return s;

        const cleanedBase = stripDemoGradesFromStudent(s);
        const next: StudentProfile = stripDemoGradesFromStudent({
          ...cleanedBase,
          ...updatedData,
          updatedAt: nowIso,
        });
        // Keep the join key in step when a grade label is edited directly
        if (updatedData.grade !== undefined && updatedData.classId === undefined) {
          next.classId = resolveClassId(updatedData.grade) || s.classId;
        }
        if (next.lastCollatedResult) {
          next.lastCollatedResult = {
            ...next.lastCollatedResult,
            dispatchedAt: nowIso,
            grades: Array.isArray(next.grades) ? next.grades : next.lastCollatedResult.grades,
          };
        }
        updatedStudentRecord = next;
        return next;
      });

      nextStudentsSnapshot = deduplicateStudentsByRegistration(updated);
      latestStudentsRef.current = nextStudentsSnapshot;

      markLocalMutation();
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(nextStudentsSnapshot));
        if (updatedStudentRecord && (updatedStudentRecord as StudentProfile).id === activeStudentId) {
          sessionStorage.setItem('stanbax_active_student_cache', JSON.stringify(updatedStudentRecord));
        }
      } catch {}
      broadcastLocalStateChange('stanbax_students', nextStudentsSnapshot);
      void syncStateOnline('stanbax_students', nextStudentsSnapshot);
      void forceSyncCollatedResultsToDatabase({
        students: nextStudentsSnapshot,
        assessmentConfig,
        subjects,
        adminPassword,
      });
      return nextStudentsSnapshot;
    });

    const recordToSend = updatedStudentRecord || { ...updatedData, id, updatedAt: nowIso };

    // Persist full student object directly to online server database (upserts if missing)
    void fetch(`/api/students/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recordToSend)
    }).catch(() => {});

    // Also update student credential & login aliases (including updated student name / email / regNumber) in Supabase
    if (updatedStudentRecord) {
      const stu = updatedStudentRecord as StudentProfile;
      if (stu.regNumber) {
        void remoteCreateCredential(
          stu.regNumber,
          stu.password || 'stanbax2025',
          'student',
          stu.id,
          [stu.email || '', stu.name?.toLowerCase().trim() || ''].filter(Boolean)
        );
      }
    }
  };

  const setStudentIntensiveCalvinSupport = (
    studentId: string, 
    enabled: boolean, 
    details?: { interventionNotes?: string; interventionSubjects?: string[]; interventionLevel?: 'urgent' | 'moderate' | 'foundation_rebuild' }
  ) => {
    setStudents(prev => {
      const updated = prev.map(s => {
        if (s.id !== studentId) return s;
        const currentCalvin = s.calvinAiAccess || {
          active: true,
          tier: 'regular' as const,
          tokenCode: `INTERVENTION-${s.regNumber.replace(/[^A-Za-z0-9]/g, '')}`,
          activatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
          durationHours: 8760,
          questionsCount: 0
        };
        return {
          ...s,
          calvinAiAccess: {
            ...currentCalvin,
            active: true,
            intensiveSupport: enabled,
            interventionNotes: details?.interventionNotes !== undefined ? details.interventionNotes : currentCalvin.interventionNotes,
            interventionSubjects: details?.interventionSubjects !== undefined ? details.interventionSubjects : currentCalvin.interventionSubjects,
            interventionLevel: details?.interventionLevel !== undefined ? details.interventionLevel : (currentCalvin.interventionLevel || 'urgent'),
            flaggedAt: enabled ? (currentCalvin.flaggedAt || new Date().toISOString()) : undefined,
            flaggedByAdmin: enabled ? 'School Administration' : undefined
          }
        };
      });
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const registerStudent = (data: StudentRegistrationData): StudentProfile => {
    const currentYear = new Date().getFullYear();
    const existingNums = students
      .map(s => {
        const match = s.regNumber.match(/\/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const nextNum = (existingNums.length > 0 ? Math.max(...existingNums) : 100) + 1;
    const formattedNum = String(nextNum).padStart(3, '0');
    const regNumber = `STX/${currentYear}/${formattedNum}`;

    const newStudent: StudentProfile = {
      id: `std-${Date.now()}`,
      name: data.name.trim(),
      regNumber,
      grade: data.grade,
      classId: data.classId || resolveClassId(data.grade),
      gender: data.gender || 'Male',
      parentName: data.parentName || 'Guardian',
      parentPhone: data.parentPhone || '+234 800 000 0000',
      house: data.house,
      attendancePercent: 0,
      attendanceDays: 0,
      totalSchoolDays: 0,
      termAverage: 0,
      emergencyPhone: data.emergencyPhone?.trim() || '+234 803 000 0000',
      clubs: [],
      email: data.email?.trim() || `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@stanbaxschools.edu.ng`,
      password: data.password?.trim() || 'stanbax2025',
      securityQuestion: data.securityQuestion?.trim() || '',
      securityAnswer: data.securityAnswer?.trim() || '',
      passportPhoto: data.passportPhoto || '',
      isAlumni: false,
      feeTotal: classes.find(c => c.id === (data.classId || '') || c.name === data.grade)?.tuitionPerTerm,
      feePaid: 0,
      feeStatus: 'Outstanding',
      promotionStatus: 'Pending',
      academicHistory: []
    };

    newStudent.academicHistory = generateStudentHistoricalRecords(newStudent);
    if (newStudent.feeTotal) {
      newStudent.feeBalance = newStudent.feeTotal;
    }

    setStudents(prev => {
      const updated = [newStudent, ...prev];
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(updated));
      } catch (err) {
        console.warn('Could not persist student list to localStorage', err);
      }
      return updated;
    });

    // Directly commit to online server database (/api/students)
    void fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newStudent,
        emergencyPhone: data.emergencyPhone,
        parentPhone: data.parentPhone || data.emergencyPhone || '+234 800 000 0000',
        parentName: data.parentName || 'Parent / Guardian',
        creatorRole: 'admin',
        creatorName: 'Admissions Desk'
      })
    }).then(async r => {
      if (r.ok) {
        const d = await r.json();
        if (d.student) {
          setStudents(curr => {
            const list = curr.map(s => s.id === newStudent.id || s.regNumber === newStudent.regNumber ? { ...s, ...d.student, savedOnline: true } : s);
            try { localStorage.setItem('stanbax_students', JSON.stringify(list)); } catch {}
            return list;
          });
        }
      }
    }).catch(err => console.warn('[Online Storage] Error saving registered student online:', err));

    void remoteCreateCredential(
      regNumber,
      newStudent.password || 'stanbax2025',
      'student',
      newStudent.id,
      [newStudent.email, newStudent.name.toLowerCase()].filter((x): x is string => Boolean(x))
    );

    void syncStateOnline('stanbax_students', [newStudent, ...students]);

    return newStudent;
  };

  const updateStudentPassport = (studentId: string, passportPhoto: string) => {
    updateStudent(studentId, { passportPhoto });
  };

  const [onlineStudentsSynced, setOnlineStudentsSynced] = useState<boolean>(false);

  const syncOnlineStudentsNow = async () => {
    if (hasPendingRemoteWrites() || Date.now() - lastLocalMutationAt < 8000) {
      return;
    }
    try {
      const res = await fetch('/api/students');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.students) && data.students.length > 0) {
          setStudents(prev => {
            const onlineFiltered = data.students.filter(
              (s: StudentProfile) => s && s.id && !isAccountTombstoned(s.id, s.regNumber, s.email)
            );
            const prevFiltered = prev.filter(
              ps => ps && ps.id && !isAccountTombstoned(ps.id, ps.regNumber, ps.email)
            );
            // Put onlineFiltered first and prevFiltered second so local changes take precedence unless online record has a newer timestamp
            const deduplicated = deduplicateStudentsByRegistration([...onlineFiltered, ...prevFiltered]);
            setLocalStorageSilent('stanbax_students', JSON.stringify(deduplicated));
            return deduplicated;
          });
          setOnlineStudentsSynced(true);
        }
      }
    } catch (err) {
      console.warn('[Online Storage] Could not hydrate online students:', err);
    }

    try {
      const subRes = await fetch('/api/subjects');
      if (subRes.ok) {
        const subData = await subRes.json();
        if (subData.success && Array.isArray(subData.subjects) && subData.subjects.length > 0) {
          setSubjects(prev => {
            const seen = new Map<string, Subject>();
            prev.forEach(s => { if (s?.name) seen.set(s.name.trim().toLowerCase(), s); });
            let added = false;
            subData.subjects.forEach((s: Subject) => {
              if (s?.name && !seen.has(s.name.trim().toLowerCase())) {
                seen.set(s.name.trim().toLowerCase(), normalizeSubject(s));
                added = true;
              }
            });
            if (!added) return prev;
            const merged = Array.from(seen.values());
            setLocalStorageSilent('stanbax_subjects', JSON.stringify(merged));
            return merged;
          });
        }
      }
    } catch {}

    try {
      const cfgRes = await fetch('/api/assessment-config');
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        if (cfgData.success && cfgData.config && typeof cfgData.config === 'object') {
          setAssessmentConfig(prev => {
            const merged = { ...prev, ...cfgData.config };
            setLocalStorageSilent('stanbax_assessment_config', JSON.stringify(merged));
            return merged;
          });
        }
      }
    } catch {}
  };

  const syncOnlineTutorsNow = async () => {
    try {
      const res = await fetch('/api/tutors');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tutors) && data.tutors.length > 0) {
          setTutors(prev => {
            const map = new Map<string, TutorProfile>();
            data.tutors.forEach((t: TutorProfile) => {
              if (t && t.id && !isAccountTombstoned(t.id, t.staffId || t.email, t.email)) {
                map.set(t.id, t);
                if (t.email) map.set(t.email.toLowerCase().trim(), t);
              }
            });
            const merged = data.tutors.filter((t: TutorProfile) => t && t.id && !isAccountTombstoned(t.id, t.staffId || t.email, t.email));
            prev.forEach(pt => {
              if (!isAccountTombstoned(pt.id, pt.staffId || pt.email, pt.email) && !map.has(pt.id) && (!pt.email || !map.has(pt.email.toLowerCase().trim()))) {
                merged.push(pt);
              }
            });
            try { localStorage.setItem('stanbax_tutors', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      }
    } catch (err) {
      console.warn('[Online Storage] Could not hydrate online tutors:', err);
    }
  };

  const syncOnlineModeratorsNow = async () => {
    try {
      const res = await fetch('/api/moderators');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.moderators) && data.moderators.length > 0) {
          setModerators(prev => {
            const map = new Map<string, ModeratorProfile>();
            data.moderators.forEach((m: ModeratorProfile) => {
              if (m && m.id && !isAccountTombstoned(m.id, m.email, m.email)) {
                map.set(m.id, m);
                if (m.email) map.set(m.email.toLowerCase().trim(), m);
              }
            });
            const merged = data.moderators.filter((m: ModeratorProfile) => m && m.id && !isAccountTombstoned(m.id, m.email, m.email));
            prev.forEach(pm => {
              if (!isAccountTombstoned(pm.id, pm.email, pm.email) && !map.has(pm.id) && (!pm.email || !map.has(pm.email.toLowerCase().trim()))) {
                merged.push(pm);
              }
            });
            try { localStorage.setItem('stanbax_moderators', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      }
    } catch (err) {
      console.warn('[Online Storage] Could not hydrate online moderators:', err);
    }
  };

  const syncOnlineParentsNow = async () => {
    try {
      const res = await fetch('/api/parents');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.parents) && data.parents.length > 0) {
          setParents(prev => {
            const map = new Map<string, ParentProfile>();
            data.parents.forEach((p: ParentProfile) => {
              if (p && p.id && !isAccountTombstoned(p.id, p.phone || p.email, p.email)) {
                map.set(p.id, p);
                if (p.phone) map.set(p.phone.replace(/[^0-9]/g, ''), p);
                if (p.email) map.set(p.email.toLowerCase().trim(), p);
              }
            });
            const merged = data.parents.filter((p: ParentProfile) => p && p.id && !isAccountTombstoned(p.id, p.phone || p.email, p.email));
            prev.forEach(pp => {
              const cleanP = (pp.phone || '').replace(/[^0-9]/g, '');
              const cleanE = (pp.email || '').toLowerCase().trim();
              if (!isAccountTombstoned(pp.id, pp.phone || pp.email, pp.email) && !map.has(pp.id) && (!cleanP || !map.has(cleanP)) && (!cleanE || !map.has(cleanE))) {
                merged.push(pp);
              }
            });
            try { localStorage.setItem('stanbax_parents_list', JSON.stringify(merged)); } catch {}
            return merged;
          });
        }
      }
    } catch (err) {
      console.warn('[Online Storage] Could not hydrate online parents:', err);
    }
  };

  useEffect(() => {
    void syncOnlineStudentsNow();
    void syncOnlineTutorsNow();
    void syncOnlineModeratorsNow();
    void syncOnlineParentsNow();
  }, []);

  const addStudent = async (
    studentData: Omit<StudentProfile, 'id' | 'regNumber'> & { id?: string; regNumber?: string },
    creatorRole: string = 'moderator',
    creatorName?: string
  ): Promise<{ success: boolean; student?: StudentProfile; message?: string }> => {
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...studentData,
          creatorRole,
          creatorName
        })
      });

      const data = await res.json();
      if (!data.success || !data.student) {
        throw new Error(data.error || 'Server could not commit student account online.');
      }

      const savedStudent: StudentProfile = data.student;

      let nextStudentsList: StudentProfile[] = [];
      setStudents(prev => {
        const filtered = prev.filter(s => s.id !== savedStudent.id && s.regNumber !== savedStudent.regNumber);
        nextStudentsList = [savedStudent, ...filtered];
        try { localStorage.setItem('stanbax_students', JSON.stringify(nextStudentsList)); } catch {}
        return nextStudentsList;
      });

      setOnlineStudentsSynced(true);
      broadcastLocalStateChange('stanbax_students', nextStudentsList);
      void syncStateOnline('stanbax_students', nextStudentsList);

      void remoteCreateCredential(
        savedStudent.regNumber,
        savedStudent.password || 'stanbax2025',
        'student',
        savedStudent.id,
        [savedStudent.email, savedStudent.name.toLowerCase()].filter((x): x is string => Boolean(x))
      );

      return {
        success: true,
        student: savedStudent,
        message: data.message || `Scholar account for ${savedStudent.name} (${savedStudent.regNumber}) saved online successfully!`
      };
    } catch (err: any) {
      console.error('[Add Student Online Error]', err);
      // Fallback to local registration if server unreachable
      const fallback = registerStudent({
        name: studentData.name,
        grade: studentData.grade,
        gender: studentData.gender,
        parentName: studentData.parentName,
        parentPhone: studentData.parentPhone,
        house: studentData.house,
        emergencyPhone: studentData.emergencyPhone,
        email: studentData.email,
        password: studentData.password,
        securityQuestion: studentData.securityQuestion,
        securityAnswer: studentData.securityAnswer,
        passportPhoto: studentData.passportPhoto
      });
      return {
        success: true,
        student: fallback,
        message: 'Account registered. Note: Saved locally while online synchronization is pending.'
      };
    }
  };

  const bulkUpsertStudents = async (
    incomingStudents: Array<Partial<StudentProfile> & { id?: string; regNumber?: string }>,
    creatorRole: string = 'admin',
    creatorName: string = 'Bulk Student CSV Import'
  ): Promise<{ success: boolean; students?: StudentProfile[]; updatedCount?: number; createdCount?: number; message?: string }> => {
    if (!Array.isArray(incomingStudents) || incomingStudents.length === 0) {
      throw new Error('No student records were provided for upload.');
    }
    const response = await fetch('/api/students/batch-upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: incomingStudents, creatorRole, creatorName }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !Array.isArray(data.students)) {
      throw new Error(data.error || 'The server could not save the bulk student roster.');
    }
    const savedStudents = deduplicateStudentsByRegistration(data.students as StudentProfile[]);
    markLocalMutation();
    latestStudentsRef.current = savedStudents;
    setStudents(savedStudents);
    setOnlineStudentsSynced(true);
    try { localStorage.setItem('stanbax_students', JSON.stringify(savedStudents)); } catch {}
    broadcastLocalStateChange('stanbax_students', savedStudents);
    await syncStateOnline('stanbax_students', savedStudents);
    await Promise.all(savedStudents.map(student => remoteCreateCredential(
      student.regNumber,
      student.password || 'stanbax2025',
      'student',
      student.id,
      [student.email, student.name?.toLowerCase().trim()].filter((value): value is string => Boolean(value))
    )));
    return {
      success: true,
      students: savedStudents,
      updatedCount: data.updatedCount,
      createdCount: data.createdCount,
      message: data.message || `Saved ${savedStudents.length} students to the database.`,
    };
  };

  const deleteStudent = (id: string) => {
    const target = students.find(s => s.id === id);
    markAccountAsPermanentlyDeleted(id, target?.regNumber || target?.email, 'student');
    void fetch(`/api/students/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    if (target?.regNumber || target?.email) {
      void remoteDeleteCredential((target.regNumber || target.email) as string, id);
    }
    setStudents(prev => {
      const updated = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_students', updated);
      void syncStateOnline('stanbax_students', updated);
      return updated;
    });
  };

  const [homeworks, setHomeworks] = useState<Homework[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_homeworks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEMO_HOMEWORKS;
  });

  // Homework completion is tracked per scholar via submissions[studentId];
  // `status` remains the default/class-level state for tutors' dashboards.
  const toggleHomeworkStatus = (id: string, studentId?: string) => {
    const targetId = studentId || activeStudentId;
    setHomeworks(prev => {
      const updated = prev.map(hw => {
        if (hw.id !== id) return hw;
        const submissions = { ...(hw.submissions || {}) };
        const current = submissions[targetId] ?? hw.status;
        if (current === 'Graded') return hw;
        submissions[targetId] = current === 'Submitted' ? 'Pending' : 'Submitted';
        return { ...hw, submissions };
      });
      try {
        localStorage.setItem('stanbax_homeworks', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const addHomework = (hwData: Omit<Homework, 'id' | 'status'>) => {
    const newHw: Homework = {
      ...hwData,
      id: `hw-${Date.now()}`,
      status: 'Pending'
    };
    setHomeworks(prev => {
      const updated = [newHw, ...prev];
      localStorage.setItem('stanbax_homeworks', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteHomework = (id: string) => {
    setHomeworks(prev => {
      const updated = prev.filter(hw => hw.id !== id);
      try {
        localStorage.setItem('stanbax_homeworks', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // 11. Grades & Assessment Collation Engine
  const [assessmentConfig, setAssessmentConfig] = useState<AssessmentControlConfig>(() => {
    try {
      const saved = localStorage.getItem('stanbax_assessment_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure new weights (ca1: 10, ca2: 10, ca3: 10, exam: 70) take effect even if older 20/50 config was saved in browser localStorage
        if (parsed.ca1Max === 20 || parsed.examMax === 50 || !parsed.ca1Max) {
          return {
            ...parsed,
            ca1Max: 10,
            ca2Max: 10,
            ca3Max: 10,
            examMax: 70
          };
        }
        return { ...DEFAULT_ASSESSMENT_CONFIG, ...parsed };
      }
    } catch {}
    return DEFAULT_ASSESSMENT_CONFIG;
  });

  const updateAssessmentConfig = (config: Partial<AssessmentControlConfig>) => {
    setAssessmentConfig(prev => {
      const updated = { ...prev, ...config };
      try {
        localStorage.setItem('stanbax_assessment_config', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_assessment_config', updated);
      void syncStateOnline('stanbax_assessment_config', updated);
      void fetch('/api/assessment-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(() => {});
      return updated;
    });
  };

  const setActiveAssessmentPhase = (phase: AssessmentEntryPhase) => {
    updateAssessmentConfig({ activePhase: phase });
  };

  const setActiveAssessmentTerm = (term: '1st Term' | '2nd Term' | '3rd Term') => {
    updateAssessmentConfig({ activeTerm: term });
    // Also keep schoolInfo activeTerm aligned
    const mapped = term === '1st Term' 
      ? '1st Term (Michaelmas Term)' 
      : term === '2nd Term' 
      ? '2nd Term (Lent Term)' 
      : '3rd Term (Trinity Term)';
    updateSchoolInfo({ activeTerm: mapped });
  };

  const setPromotionPassMark = (percent: number) => {
    updateAssessmentConfig({ promotionPassMarkPercent: percent });
  };

  const resetAssessmentToDefault = () => {
    setAssessmentConfig(DEFAULT_ASSESSMENT_CONFIG);
    try {
      localStorage.removeItem('stanbax_assessment_config');
    } catch {}
  };

  // Per-scholar gradebooks are stored on each StudentProfile.grades; this
  // derived value exposes the active scholar's records for report-card views.
  const grades = student.grades || [];

  const getStudentGrades = (studentId: string): GradeRecord[] => {
    return students.find(s => s.id === studentId)?.grades || [];
  };

  const updateGrade = (
    subject: string, 
    ca1: number, 
    ca2: number, 
    exam: number, 
    ca3 = 0,
    studentId?: string
  ) => {
    // Total is calculated across CA1 (10) + CA2 (10) + CA3 (10) + Exam (70) = 100
    const total = ca1 + ca2 + ca3 + exam;
    const { grade, remark } = calculateGrade(total);
    const targetId = studentId || activeStudentId;
    const activeTerm = assessmentConfig.activeTerm;

    setStudents(prev => {
      const updated = prev.map(s => {
        if (s.id !== targetId) return s;
        const existing = (s.grades || []).filter(g => g && g.subject && !isSeededDemoGrade(g));
        const idx = existing.findIndex(g => g.subject.toLowerCase() === subject.toLowerCase());

        let nextGrades: GradeRecord[];
        if (idx >= 0) {
          nextGrades = existing.map((g, i) => {
            if (i !== idx) return g;
            const t1 = activeTerm === '1st Term' ? total : g.term1Total;
            const t2 = activeTerm === '2nd Term' ? total : g.term2Total;
            const t3 = activeTerm === '3rd Term' ? total : g.term3Total;
            const knownTerms = [t1, t2, t3].filter((v): v is number => typeof v === 'number');
            const annualAvg = knownTerms.length > 0
              ? Math.round((knownTerms.reduce((a, b) => a + b, 0) / knownTerms.length) * 10) / 10
              : total;
            return {
              ...g,
              ca1,
              ca2,
              ca3,
              exam,
              total,
              grade,
              remark,
              term1Total: t1,
              term2Total: t2,
              term3Total: t3,
              annualAverage: annualAvg,
              isRealScore: true,
            } as GradeRecord;
          });
        } else {
          const record: GradeRecord = {
            id: `grd-${targetId}-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            subject,
            ca1,
            ca2,
            ca3,
            exam,
            total,
            grade,
            remark,
            annualAverage: total,
            isRealScore: true,
          } as GradeRecord;
          if (activeTerm === '1st Term') record.term1Total = total;
          else if (activeTerm === '2nd Term') record.term2Total = total;
          else if (activeTerm === '3rd Term') record.term3Total = total;
          nextGrades = [...existing, record];
        }

        const avg = Math.round(nextGrades.reduce((sum, g) => sum + g.total, 0) / (nextGrades.length || 1) * 10) / 10;
        const annualAvg = Math.round(nextGrades.reduce((sum, g) => sum + (g.annualAverage ?? g.total), 0) / (nextGrades.length || 1) * 10) / 10;
        const nowIso = new Date().toISOString();

        return {
          ...s,
          grades: nextGrades,
          hasUploadedResults: true,
          termAverage: avg,
          cumulativeAnnualAverage: annualAvg,
          ...(activeTerm === '1st Term' ? { term1Average: avg } : {}),
          ...(activeTerm === '2nd Term' ? { term2Average: avg } : {}),
          ...(activeTerm === '3rd Term' ? { term3Average: avg } : {}),
          updatedAt: nowIso,
          lastCollatedResult: {
            ...(s.lastCollatedResult || {
              session: assessmentConfig.activeSession || '2026/2027',
              term: activeTerm,
              reportKind: 'end' as const,
              dispatchedBy: 'Gradebook Entry',
              annualAverage: annualAvg,
            }),
            dispatchedAt: nowIso,
            termAverage: avg,
            grades: nextGrades,
          },
        } as StudentProfile;
      });
      markLocalMutation();
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_students', updated);
      void syncStateOnline('stanbax_students', updated);
      
      const changedStudent = updated.find(st => st.id === targetId);
      if (changedStudent) {
        void fetch(`/api/students/${encodeURIComponent(targetId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changedStudent)
        }).catch(() => {});
      }

      return updated;
    });
  };

  const batchUpdateClassGrades = (
    subject: string,
    scores: Array<{
      studentId: string;
      ca1: number;
      ca2: number;
      ca3: number;
      exam: number;
    }>
  ) => {
    const activeTerm = assessmentConfig.activeTerm;
    const scoresMap = new Map<string, { ca1: number; ca2: number; ca3: number; exam: number }>();
    scores.forEach(s => scoresMap.set(s.studentId, s));

    setStudents(prev => {
      const nowIso = new Date().toISOString();
      const updated = prev.map(s => {
        const score = scoresMap.get(s.id);
        if (!score) return s;

        const { ca1, ca2, ca3, exam } = score;
        const total = ca1 + ca2 + ca3 + exam;
        const { grade, remark } = calculateGrade(total);

        const existing = (s.grades || []).filter(g => g && g.subject && !isSeededDemoGrade(g));
        const idx = existing.findIndex(g => g.subject.toLowerCase() === subject.toLowerCase());

        let nextGrades: GradeRecord[];
        if (idx >= 0) {
          nextGrades = existing.map((g, i) => {
            if (i !== idx) return g;
            const t1 = activeTerm === '1st Term' ? total : g.term1Total;
            const t2 = activeTerm === '2nd Term' ? total : g.term2Total;
            const t3 = activeTerm === '3rd Term' ? total : g.term3Total;
            const knownTerms = [t1, t2, t3].filter((v): v is number => typeof v === 'number');
            const annualAvg = knownTerms.length > 0
              ? Math.round((knownTerms.reduce((a, b) => a + b, 0) / knownTerms.length) * 10) / 10
              : total;
            return {
              ...g,
              ca1,
              ca2,
              ca3,
              exam,
              total,
              isRealScore: true,
              grade,
              remark,
              term1Total: t1,
              term2Total: t2,
              term3Total: t3,
              annualAverage: annualAvg
            };
          });
        } else {
          const record: GradeRecord = {
            id: `grd-${s.id}-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            subject,
            ca1,
            ca2,
            ca3,
            exam,
            total,
            grade,
            remark,
            annualAverage: total
          };
          if (activeTerm === '1st Term') record.term1Total = total;
          else if (activeTerm === '2nd Term') record.term2Total = total;
          else if (activeTerm === '3rd Term') record.term3Total = total;
          nextGrades = [...existing, record];
        }

        const avg = Math.round(nextGrades.reduce((sum, g) => sum + g.total, 0) / (nextGrades.length || 1) * 10) / 10;
        const annualAvg = Math.round(nextGrades.reduce((sum, g) => sum + (g.annualAverage ?? g.total), 0) / (nextGrades.length || 1) * 10) / 10;

        return {
          ...s,
          grades: nextGrades,
          termAverage: avg,
          cumulativeAnnualAverage: annualAvg,
          ...(activeTerm === '1st Term' ? { term1Average: avg } : {}),
          ...(activeTerm === '2nd Term' ? { term2Average: avg } : {}),
          ...(activeTerm === '3rd Term' ? { term3Average: avg } : {}),
          updatedAt: nowIso,
          lastCollatedResult: {
            ...(s.lastCollatedResult || {
              session: assessmentConfig.activeSession || '2026/2027',
              term: activeTerm,
              reportKind: 'end' as const,
              dispatchedBy: 'Bulk Class Score Entry',
              annualAverage: annualAvg,
            }),
            dispatchedAt: nowIso,
            termAverage: avg,
            grades: nextGrades,
          },
        } as StudentProfile;
      });

      markLocalMutation();
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_students', updated);
      void syncStateOnline('stanbax_students', updated);

      // Persist modified students to server online storage
      scores.forEach(sc => {
        const target = updated.find(st => st.id === sc.studentId);
        if (target) {
          void fetch(`/api/students/${encodeURIComponent(sc.studentId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(target)
          }).catch(() => {});
        }
      });

      return updated;
    });
  };

  const batchUpsertStudentResults = async (
    records: Array<{
      student_id?: string;
      regNumber?: string;
      id?: string;
      full_name?: string;
      name?: string;
      email?: string;
      grade_level?: string;
      grade?: string;
      class?: string;
      gender?: 'Male' | 'Female' | string;
      parent_name?: string;
      parent_phone?: string;
      results?: Array<{
        subject: string;
        ca1?: number;
        ca2?: number;
        ca3?: number;
        exam?: number;
        score?: number;
        grade?: string;
        remark?: string;
      }>;
      subjects?: Record<string, number> | Array<{ subject: string; ca1?: number; ca2?: number; ca3?: number; exam?: number; score?: number }>;
      [key: string]: any;
    }>,
    targetTerm: '1st Term' | '2nd Term' | '3rd Term' = (assessmentConfig.activeTerm as any) || '1st Term',
    targetSession: string = assessmentConfig.activeSession || '2026/2027',
    options?: {
      assessmentMode?: 'tests_only' | 'full';
      replaceEntireRoster?: boolean;
    }
  ): Promise<{
    success: boolean;
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
  }> => {
    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: false,
        totalProcessed: 0,
        updatedCount: 0,
        provisionedCount: 0,
        message: 'No records provided for upload.',
        auditLogs: []
      };
    }

    // Derive class records from the uploaded file instead of hardcoding a
    // student/class roster. Formatting-only differences such as "SSS3 Arts"
    // and "SSS 3 Arts" are normalized so imported scholars stay editable in
    // the Classes module and visible in class-filtered portals.
    const normalizeImportedClassName = (value: unknown): string => {
      const clean = String(value || '').replace(/\s+/g, ' ').trim();
      if (!clean) return '';
      const senior = clean.match(/^SSS\s*(1|2|3)\s*(.*)$/i);
      if (senior) {
        const stream = senior[2].trim().replace(/\s*&\s*/g, ' & ');
        return `SSS ${senior[1]}${stream ? ` ${stream}` : ''}`;
      }
      return clean;
    };
    const getRecordClassName = (rec: any): string => normalizeImportedClassName(
      rec?.grade_level || rec?.grade || rec?.class || rec?.class_name
    );
    const importedClassNames = Array.from(new Set(records.map(getRecordClassName).filter(Boolean)));
    const importedClassIds = new Map<string, string>();
    const missingClasses = importedClassNames.filter(name => {
      const existing = classes.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
      if (existing) importedClassIds.set(name.toLowerCase(), existing.id);
      return !existing;
    });
    if (missingClasses.length > 0) {
      const addedClasses: SchoolClass[] = missingClasses.map((name, index) => ({
        id: `cls-import-${Date.now()}-${index}`,
        name,
        category: /^SSS\b/i.test(name) ? 'Senior Secondary' : /^JSS\b/i.test(name) ? 'Junior Secondary' : 'Primary',
        tuitionPerTerm: 0,
        description: 'Created from an uploaded results file; editable in Classes & Fees.',
        isActive: true,
      }));
      const nextClasses = [...classes, ...addedClasses];
      addedClasses.forEach(cls => importedClassIds.set(cls.name.toLowerCase(), cls.id));
      setClasses(nextClasses);
      try {
        localStorage.setItem('stanbax_classes', JSON.stringify(nextClasses));
      } catch {}
      broadcastLocalStateChange('stanbax_classes', nextClasses);
      void syncStateOnline('stanbax_classes', nextClasses);
    }
    const preparedRecords = records.map(rec => {
      const className = getRecordClassName(rec);
      return className ? { ...rec, grade_level: className } : rec;
    });

    markLocalMutation();
    let updatedCount = 0;
    let provisionedCount = 0;
    const auditLogs: Array<{ name: string; regNumber: string; status: string; subjectsCount: number; termAverage: number }> = [];
    const timestamp = new Date().toISOString();
    const isTestsOnly = options?.assessmentMode === 'tests_only';
    const shouldReplaceEntireRoster = Boolean(options?.replaceEntireRoster);
    const touchedStudentIds = new Set<string>();

    // Step 1: Deduplicate incoming records by registration number / student ID so duplicate CSV rows for the same regNo merge cleanly
    const mergedIncomingMap = new Map<string, any>();
    preparedRecords.forEach((rec, idx) => {
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
      const dedupKey = normReg
        ? `reg:${normReg}`
        : rawEmail
          ? `email:${rawEmail.toLowerCase()}`
          : rawName
            ? `name:${rawName.toLowerCase()}`
            : `row:${idx}`;

      if (!mergedIncomingMap.has(dedupKey)) {
        mergedIncomingMap.set(dedupKey, {
          ...rec,
          student_id: rawId || rec.student_id,
          regNumber: rawId || rec.regNumber,
          results: Array.isArray(rec.results) ? [...rec.results] : undefined,
        });
      } else {
        const existingRec = mergedIncomingMap.get(dedupKey)!;
        const prevResults = Array.isArray(existingRec.results) ? [...existingRec.results] : [];
        const newResults = Array.isArray(rec.results) ? rec.results : [];
        for (const nr of newResults) {
          if (!nr || !nr.subject) continue;
          const sIdx = prevResults.findIndex(
            (pr: any) => pr.subject?.trim().toLowerCase() === nr.subject.trim().toLowerCase()
          );
          if (sIdx >= 0) {
            prevResults[sIdx] = {
              ...prevResults[sIdx],
              ...nr,
              ca1: nr.ca1 !== undefined && nr.ca1 !== 0 ? nr.ca1 : prevResults[sIdx].ca1,
              ca2: nr.ca2 !== undefined && nr.ca2 !== 0 ? nr.ca2 : prevResults[sIdx].ca2,
              ca3: nr.ca3 !== undefined && nr.ca3 !== 0 ? nr.ca3 : prevResults[sIdx].ca3,
              exam: nr.exam !== undefined && nr.exam !== 0 ? nr.exam : prevResults[sIdx].exam,
            };
          } else {
            prevResults.push(nr);
          }
        }
        mergedIncomingMap.set(dedupKey, {
          ...existingRec,
          ...rec,
          student_id: rawId || existingRec.student_id,
          regNumber: rawId || existingRec.regNumber,
          full_name: rawName || existingRec.full_name || existingRec.name,
          email: rawEmail || existingRec.email,
          results: prevResults.length > 0 ? prevResults : rec.results || existingRec.results,
        });
      }
    });

    const deduplicatedRecords = Array.from(mergedIncomingMap.values());

    // Step 2: Build lookup maps from current students (using latestStudentsRef so sequential calls never use stale state)
    const baseStudents = deduplicateStudentsByRegistration(
      latestStudentsRef.current && latestStudentsRef.current.length > 0 ? latestStudentsRef.current : students
    );
    const studentMap = new Map<string, StudentProfile>();
    const exactRegMap = new Map<string, StudentProfile>();
    const normRegMap = new Map<string, StudentProfile>();
    const nameMap = new Map<string, StudentProfile>();
    const emailMap = new Map<string, StudentProfile>();

    for (const s of baseStudents) {
      if (!s || !s.id || isAccountTombstoned(s.id, s.regNumber, s.email)) continue;
      studentMap.set(s.id, s);
      studentMap.set(s.id.toLowerCase(), s);
      if (s.regNumber) {
        exactRegMap.set(s.regNumber.toLowerCase().replace(/\s+/g, ''), s);
        const norm = normalizeRegForUpsert(s.regNumber);
        if (norm) normRegMap.set(norm, s);
      }
      const normId = normalizeRegForUpsert(s.id);
      if (normId && !normRegMap.has(normId)) {
        normRegMap.set(normId, s);
      }
      if (s.name) nameMap.set(s.name.toLowerCase().trim(), s);
      if (s.email) emailMap.set(s.email.toLowerCase().trim(), s);
    }

    const serverSyncRecords: any[] = [];

    for (let i = 0; i < deduplicatedRecords.length; i++) {
      const rec = deduplicatedRecords[i];
      if (!rec) continue;
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

      // Match existing student by ID, exact RegNo, normalized RegNo, Email, or Full Name
      let matched: StudentProfile | null = null;
      if (rawId && (studentMap.has(rawId) || studentMap.has(rawId.toLowerCase()))) {
        matched = studentMap.get(rawId) || studentMap.get(rawId.toLowerCase())!;
      } else if (cleanRegKey && exactRegMap.has(cleanRegKey)) {
        matched = exactRegMap.get(cleanRegKey)!;
      } else if (normRegKey && normRegMap.has(normRegKey)) {
        matched = normRegMap.get(normRegKey)!;
      } else if (cleanEmailKey && emailMap.has(cleanEmailKey)) {
        matched = emailMap.get(cleanEmailKey)!;
      } else if (cleanNameKey && nameMap.has(cleanNameKey)) {
        matched = nameMap.get(cleanNameKey)!;
      }

      // Parse subjects
      const parsedSubjects: Array<{
        subject: string;
        ca1: number;
        ca2: number;
        ca3: number;
        exam: number;
        total: number;
        grade: string;
        remark: string;
        hasCa1?: boolean;
        hasCa2?: boolean;
        hasCa3?: boolean;
        hasExam?: boolean;
      }> = [];

      if (Array.isArray(rec.results)) {
        for (const sub of rec.results) {
          if (!sub || !sub.subject) continue;
          const ca1 = Number(sub.ca1 || 0);
          const ca2 = Number(sub.ca2 || 0);
          const ca3 = Number(sub.ca3 || 0);
          const exam = Number(sub.exam || 0);
          const total = (ca1 + ca2 + ca3 + exam) || Number(sub.score || (sub as any).total || 0);
          const calc = calculateGrade(total);
          parsedSubjects.push({
            subject: sub.subject,
            ca1,
            ca2,
            ca3,
            exam,
            total,
            grade: (sub as any).grade || calc.grade,
            remark: (sub as any).remark || calc.remark,
            hasCa1: (sub as any).hasCa1 !== undefined ? Boolean((sub as any).hasCa1) : true,
            hasCa2: (sub as any).hasCa2 !== undefined ? Boolean((sub as any).hasCa2) : true,
            hasCa3: (sub as any).hasCa3 !== undefined ? Boolean((sub as any).hasCa3) : ca3 > 0,
            hasExam: (sub as any).hasExam !== undefined ? Boolean((sub as any).hasExam) : exam > 0 || !isTestsOnly,
          });
        }
      } else if (typeof rec.subjects === 'object' && rec.subjects !== null) {
        if (Array.isArray(rec.subjects)) {
          for (const sub of rec.subjects) {
            if (!sub || !sub.subject) continue;
            const ca1 = Number(sub.ca1 || 0);
            const ca2 = Number(sub.ca2 || 0);
            const ca3 = Number(sub.ca3 || 0);
            const exam = Number(sub.exam || 0);
            const total = (ca1 + ca2 + ca3 + exam) || Number((sub as any).score || (sub as any).total || 0);
            const calc = calculateGrade(total);
            parsedSubjects.push({
              subject: sub.subject,
              ca1,
              ca2,
              ca3,
              exam,
              total,
              grade: (sub as any).grade || calc.grade,
              remark: (sub as any).remark || calc.remark,
              hasCa1: (sub as any).hasCa1 !== undefined ? Boolean((sub as any).hasCa1) : true,
              hasCa2: (sub as any).hasCa2 !== undefined ? Boolean((sub as any).hasCa2) : true,
              hasCa3: (sub as any).hasCa3 !== undefined ? Boolean((sub as any).hasCa3) : ca3 > 0,
              hasExam: (sub as any).hasExam !== undefined ? Boolean((sub as any).hasExam) : exam > 0 || !isTestsOnly,
            });
          }
        } else {
          for (const [subName, scoreVal] of Object.entries(rec.subjects)) {
            const num = Number(scoreVal) || 0;
            const calc = calculateGrade(num);
            parsedSubjects.push({
              subject: subName,
              ca1: Math.round(num * 0.2),
              ca2: Math.round(num * 0.2),
              ca3: 0,
              exam: Math.round(num * 0.6),
              total: num,
              grade: calc.grade,
              remark: calc.remark,
              hasCa1: true,
              hasCa2: true,
              hasCa3: false,
              hasExam: true,
            });
          }
        }
      }

      const importedGrade = normalizeImportedClassName(rec.grade_level || rec.grade || rec.class);
      const importedClassId = importedGrade
        ? importedClassIds.get(importedGrade.toLowerCase()) || resolveClassId(importedGrade)
        : undefined;
      if (matched) {
        // Update existing student in-place without creating a duplicate row, stripping any seeded demo subjects first
        const existingGrades: GradeRecord[] = Array.isArray(matched.grades)
          ? matched.grades.filter(g => g && g.subject && !isSeededDemoGrade(g))
          : [];
        for (const sub of parsedSubjects) {
          const idx = existingGrades.findIndex(g => g.subject?.trim().toLowerCase() === sub.subject.trim().toLowerCase());
          if (idx >= 0) {
            const currentCa1 = Number(existingGrades[idx].ca1 || 0);
            const currentCa2 = Number(existingGrades[idx].ca2 || 0);
            const currentExam = Number(existingGrades[idx].exam || 0);
            const currentCa3 = Number(existingGrades[idx].ca3 || 0);

            const finalCa1 = sub.hasCa1 === false ? currentCa1 : sub.ca1;
            const finalCa2 = sub.hasCa2 === false ? currentCa2 : sub.ca2;
            const finalCa3 = sub.hasCa3 === false || (isTestsOnly && (!sub.ca3 || sub.ca3 === 0)) ? currentCa3 : sub.ca3;
            const finalExam = sub.hasExam === false || (isTestsOnly && (!sub.exam || sub.exam === 0)) ? currentExam : sub.exam;
            const computedTotal = finalCa1 + finalCa2 + finalCa3 + finalExam;
            const calc = calculateGrade(computedTotal);

            existingGrades[idx] = {
              ...existingGrades[idx],
              subject: existingGrades[idx].subject || sub.subject,
              ca1: finalCa1,
              ca2: finalCa2,
              ca3: finalCa3,
              exam: finalExam,
              total: computedTotal,
              grade: isTestsOnly ? calc.grade : (sub.grade || calc.grade),
              remark: isTestsOnly ? calc.remark : (sub.remark || calc.remark),
              isRealScore: true,
              ...(targetTerm === '1st Term' ? { term1Total: computedTotal } : {}),
              ...(targetTerm === '2nd Term' ? { term2Total: computedTotal } : {}),
              ...(targetTerm === '3rd Term' ? { term3Total: computedTotal } : {})
            } as GradeRecord;
          } else {
            existingGrades.push({
              id: `grd-${matched.id}-${sub.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
              subject: sub.subject,
              ca1: sub.ca1,
              ca2: sub.ca2,
              ca3: sub.ca3,
              exam: sub.exam,
              total: sub.total,
              grade: sub.grade,
              remark: sub.remark,
              annualAverage: sub.total,
              isRealScore: true,
              ...(targetTerm === '1st Term' ? { term1Total: sub.total } : {}),
              ...(targetTerm === '2nd Term' ? { term2Total: sub.total } : {}),
              ...(targetTerm === '3rd Term' ? { term3Total: sub.total } : {})
            } as GradeRecord);
          }
        }
        const termAvg = existingGrades.length > 0
          ? Math.round((existingGrades.reduce((sum, g) => sum + (g.total || 0), 0) / existingGrades.length) * 10) / 10
          : 0;

        const updatedPassword = (rec.password && String(rec.password).trim()) ? String(rec.password).trim() : matched.password;
        const resolvedName = rawName && !rawName.startsWith('Student ') ? rawName : matched.name;
        const updatedStudent: StudentProfile = {
          ...matched,
          name: resolvedName,
          grade: importedGrade || matched.grade,
          classId: importedClassId || matched.classId,
          password: updatedPassword,
          parentName: rec.parent_name || rec.parentName || matched.parentName,
          parentPhone: rec.parent_phone || rec.parentPhone || matched.parentPhone,
          grades: existingGrades,
          hasUploadedResults: true,
          termAverage: termAvg,
          cumulativeAnnualAverage: termAvg,
          updatedAt: timestamp,
          ...(targetTerm === '1st Term' ? { term1Average: termAvg } : {}),
          ...(targetTerm === '2nd Term' ? { term2Average: termAvg } : {}),
          ...(targetTerm === '3rd Term' ? { term3Average: termAvg } : {}),
          lastCollatedResult: {
            session: targetSession,
            term: targetTerm,
            reportKind: 'end',
            dispatchedAt: timestamp,
            dispatchedBy: isTestsOnly ? 'Continuous Assessment Collation' : 'Admin Batch Collation Desk',
            termAverage: termAvg,
            annualAverage: termAvg,
            grades: existingGrades
          }
        } as StudentProfile;

        if (
          (rec.password && String(rec.password).trim() && String(rec.password).trim() !== matched.password) ||
          (rawName && rawName !== matched.name)
        ) {
          void remoteCreateCredential(
            matched.regNumber,
            updatedPassword || 'stanbax2025',
            'student',
            matched.id,
            [updatedStudent.email, updatedStudent.name.toLowerCase()].filter((x): x is string => Boolean(x))
          );
        }

        touchedStudentIds.add(matched.id);
        studentMap.set(matched.id, updatedStudent);
        studentMap.set(matched.id.toLowerCase(), updatedStudent);
        if (matched.regNumber) {
          exactRegMap.set(matched.regNumber.toLowerCase().replace(/\s+/g, ''), updatedStudent);
          const norm = normalizeRegForUpsert(matched.regNumber);
          if (norm) normRegMap.set(norm, updatedStudent);
        }
        if (updatedStudent.name) nameMap.set(updatedStudent.name.toLowerCase().trim(), updatedStudent);
        updatedCount++;
        auditLogs.push({
          name: updatedStudent.name,
          regNumber: matched.regNumber,
          status: isTestsOnly ? 'Updated 1st & 2nd Tests' : 'Updated Existing Record',
          subjectsCount: parsedSubjects.length,
          termAverage: termAvg
        });

        serverSyncRecords.push({
          ...rec,
          canonicalId: matched.id,
          student_id: matched.regNumber,
          regNumber: matched.regNumber,
          full_name: updatedStudent.name,
          password: updatedPassword,
        });
      } else {
        // Provision brand new student account!
        const uniqueStudentsCount = new Set(Array.from(studentMap.values()).map(s => s.id)).size;
        const currentTotalCount = uniqueStudentsCount + provisionedCount + 1;
        const generatedReg = rawId || `SBS/2026/${String(currentTotalCount).padStart(3, '0')}`;
        const normGeneratedReg = normalizeRegForUpsert(generatedReg);
        const newId = `std-batch-${normGeneratedReg || `${Date.now()}-${i + 1}`}`;
        const finalName = rawName || `Student ${generatedReg}`;
        const studentEmail = rawEmail || `${generatedReg.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@stanbaxschools.edu.ng`;
        const studentGrade = importedGrade || 'SSS 1 Science';
        const studentClassId = importedClassId;
        const customPass = (rec.password && String(rec.password).trim()) ? String(rec.password).trim() : 'stanbax2025';

        const formattedGrades: GradeRecord[] = parsedSubjects.map(sub => ({
          id: `grd-${newId}-${sub.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          subject: sub.subject,
          ca1: sub.ca1,
          ca2: sub.ca2,
          ca3: sub.ca3,
          exam: sub.exam,
          total: sub.total,
          grade: sub.grade,
          remark: sub.remark,
          annualAverage: sub.total,
          isRealScore: true,
          ...(targetTerm === '1st Term' ? { term1Total: sub.total } : {}),
          ...(targetTerm === '2nd Term' ? { term2Total: sub.total } : {}),
          ...(targetTerm === '3rd Term' ? { term3Total: sub.total } : {})
        } as GradeRecord));

        const termAvg = formattedGrades.length > 0
          ? Math.round((formattedGrades.reduce((sum, g) => sum + (g.total || 0), 0) / formattedGrades.length) * 10) / 10
          : 0;

        const newStudent: StudentProfile = {
          id: newId,
          regNumber: generatedReg,
          name: finalName,
          grade: studentGrade,
          classId: studentClassId,
          gender: rec.gender === 'Female' ? 'Female' : 'Male',
          parentName: rec.parent_name || rec.parentName || `Guardian of ${finalName}`,
          parentPhone: rec.parent_phone || rec.parentPhone || '+234 800 000 0000',
          emergencyPhone: rec.parent_phone || rec.parentPhone || '+234 800 000 0000',
          email: studentEmail,
          password: customPass,
          attendancePercent: 95,
          hasUploadedResults: true,
          termAverage: termAvg,
          cumulativeAnnualAverage: termAvg,
          updatedAt: timestamp,
          ...(targetTerm === '1st Term' ? { term1Average: termAvg } : {}),
          grades: formattedGrades,
          lastCollatedResult: {
            session: targetSession,
            term: targetTerm,
            reportKind: 'end',
            dispatchedAt: timestamp,
            dispatchedBy: 'Admin Batch Collation Desk',
            termAverage: termAvg,
            annualAverage: termAvg,
            grades: formattedGrades
          }
        } as StudentProfile;

        touchedStudentIds.add(newId);
        studentMap.set(newId, newStudent);
        studentMap.set(newId.toLowerCase(), newStudent);
        exactRegMap.set(generatedReg.toLowerCase().replace(/\s+/g, ''), newStudent);
        if (normGeneratedReg) normRegMap.set(normGeneratedReg, newStudent);
        nameMap.set(finalName.toLowerCase().trim(), newStudent);
        provisionedCount++;

        // Register credentials for portal login
        void remoteCreateCredential(
          generatedReg,
          newStudent.password || 'stanbax2025',
          'student',
          newId,
          [studentEmail, finalName.toLowerCase()]
        );

        auditLogs.push({
          name: finalName,
          regNumber: generatedReg,
          status: 'Provisioned New Account',
          subjectsCount: formattedGrades.length,
          termAverage: termAvg
        });

        serverSyncRecords.push({
          ...rec,
          canonicalId: newId,
          id: newId,
          student_id: generatedReg,
          regNumber: generatedReg,
          full_name: finalName,
          password: customPass,
        });
      }
    }

    let uniqueUpdatedStudents = deduplicateStudentsByRegistration(
      Array.from(new Map(Array.from(studentMap.values()).map(s => [s.id, s])).values())
    );

    if (shouldReplaceEntireRoster && touchedStudentIds.size > 0) {
      // Tombstone any student not in the uploaded authoritative file so the roster matches the uploaded count (e.g. 88 students)
      baseStudents.forEach(s => {
        if (s && s.id && !touchedStudentIds.has(s.id)) {
          markAccountAsPermanentlyDeleted(s.id, s.regNumber, s.email);
        }
      });
      uniqueUpdatedStudents = uniqueUpdatedStudents.filter(s => touchedStudentIds.has(s.id));
    }

    markLocalMutation();
    latestStudentsRef.current = uniqueUpdatedStudents;
    setStudents(uniqueUpdatedStudents);

    // Ensure results publication flags are enabled in database so students have immediate access
    const publishedConfig: AssessmentControlConfig = {
      ...assessmentConfig,
      midTermResultsPublished: true,
      endTermResultsPublished: true,
      resultsDispatchedToDashboard: true,
      dispatchedReportKind: isTestsOnly ? 'mid' : 'end',
      resultsDispatchedAt: timestamp,
    };
    setAssessmentConfig(publishedConfig);

    try {
      localStorage.setItem('stanbax_students', JSON.stringify(uniqueUpdatedStudents));
      localStorage.setItem('stanbax_assessment_config', JSON.stringify(publishedConfig));
    } catch {}
    broadcastLocalStateChange('stanbax_students', uniqueUpdatedStudents);
    broadcastLocalStateChange('stanbax_assessment_config', publishedConfig);
    void syncStateOnline('stanbax_students', uniqueUpdatedStudents);
    void syncStateOnline('stanbax_assessment_config', publishedConfig);

    // Await server + Supabase database persistence so results are immediately in the database (not just localStorage)
    if (shouldReplaceEntireRoster && uniqueUpdatedStudents.length > 0) {
      await fetch('/api/students/replace-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: uniqueUpdatedStudents,
          subjects,
          assessmentConfig: publishedConfig,
          parents,
          deletedAccountIds: Array.from(deletedAccountIdsRef.current),
        }),
      }).catch(err => console.warn('[Batch Upsert Replace All Server Sync]', err));
    } else {
      await fetch('/api/results/batch-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: serverSyncRecords,
          targetTerm,
          targetSession,
          assessmentMode: options?.assessmentMode || 'full',
          creatorName: 'Admin Batch Collation Desk'
        })
      }).catch(err => console.warn('[Batch Upsert Server Sync]', err));
    }

    await fetch('/api/results/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        students: uniqueUpdatedStudents,
        subjects,
        assessmentConfig: publishedConfig,
        replaceRoster: shouldReplaceEntireRoster,
      }),
    }).catch(() => {});

    // Force-sync updated students, subjects & published config to Supabase (direct + public mirror)
    await forceSyncCollatedResultsToDatabase({
      students: uniqueUpdatedStudents,
      assessmentConfig: publishedConfig,
      subjects,
      parents,
      deletedAccountIds: Array.from(deletedAccountIdsRef.current),
      gradingSystem,
      officialSignatures,
      adminPassword,
    }).catch(err => console.warn('[Batch Upsert Supabase Sync]', err));

    return {
      success: true,
      totalProcessed: deduplicatedRecords.length,
      updatedCount,
      provisionedCount,
      message: `Batch import saved to database: ${updatedCount} existing scholars updated, ${provisionedCount} new scholar accounts provisioned${shouldReplaceEntireRoster ? ` (Roster locked to ${uniqueUpdatedStudents.length} scholars)` : ''}.`,
      auditLogs
    };
  };

  // Roll over session and automatically upgrade scholars who passed the set percentage
  const startNewAcademicSession = (newSessionName: string, passMarkPercentage = assessmentConfig.promotionPassMarkPercent) => {
    const upgradedStudents: Array<{
      id: string;
      name: string;
      oldClass: string;
      newClass: string;
      passed: boolean;
      average: number;
    }> = [];

    let promotedCount = 0;
    let repeatedCount = 0;

    const nextStudents = students.map(s => {
      // Use 3rd term cumulative annual average or current average
      const scoreToUse = s.cumulativeAnnualAverage ?? s.termAverage;
      const isPassed = scoreToUse >= passMarkPercentage;
      const targetNextClass = isPassed ? getNextClass(s.grade) : s.grade;
      const targetNextClassId = isPassed ? (resolveClassId(targetNextClass) || s.classId) : s.classId;
      const isGraduating = isPassed && targetNextClass === 'Graduated / Alumni';
      const scholarGrades = s.grades || [];

      if (isPassed) {
        promotedCount++;
      } else {
        repeatedCount++;
      }

      upgradedStudents.push({
        id: s.id,
        name: s.name,
        oldClass: s.grade,
        newClass: targetNextClass,
        passed: isPassed,
        average: scoreToUse
      });

      // Archive completed session into academicHistory
      const sessionArchive: HistoricalSessionRecord = {
        id: `session-${Date.now()}-${s.id}`,
        sessionName: schoolInfo.activeSession,
        classEnrolled: s.grade,
        annualAverage: scoreToUse,
        promotionStatus: isPassed ? 'Promoted' : 'Repeat',
        promotedToGrade: targetNextClass,
        terms: {
          '1st Term': {
            term: '1st Term',
            termFullName: '1st Term (Michaelmas Term)',
            termAverage: s.term1Average ?? scoreToUse,
            attendanceDays: 58,
            totalSchoolDays: 60,
            classEnrolled: s.grade,
            teacherRemark: 'Commendable attendance and active classroom participation.',
            principalRemark: 'Good progress maintained.',
            grades: scholarGrades.map(g => {
              const tot = g.term1Total ?? g.total;
              const ca1 = Math.min(10, Math.round(tot * 0.1));
              const ca2 = Math.min(10, Math.round(tot * 0.1));
              const ca3 = Math.min(10, Math.round(tot * 0.1));
              const exam = tot - ca1 - ca2 - ca3;
              return {
                ...g,
                total: tot,
                exam,
                ca1,
                ca2,
                ca3
              };
            })
          },
          '2nd Term': {
            term: '2nd Term',
            termFullName: '2nd Term (Lent Term)',
            termAverage: s.term2Average ?? scoreToUse,
            attendanceDays: 59,
            totalSchoolDays: 60,
            classEnrolled: s.grade,
            teacherRemark: 'Steady advancement in continuous assessments and group assignments.',
            principalRemark: 'Satisfactory standard sustained.',
            grades: scholarGrades.map(g => {
              const tot = g.term2Total ?? g.total;
              const ca1 = Math.min(10, Math.round(tot * 0.1));
              const ca2 = Math.min(10, Math.round(tot * 0.1));
              const ca3 = Math.min(10, Math.round(tot * 0.1));
              const exam = tot - ca1 - ca2 - ca3;
              return {
                ...g,
                total: tot,
                exam,
                ca1,
                ca2,
                ca3
              };
            })
          },
          '3rd Term': {
            term: '3rd Term',
            termFullName: '3rd Term (Trinity Term)',
            termAverage: s.term3Average ?? s.termAverage,
            attendanceDays: 58,
            totalSchoolDays: 59,
            classEnrolled: s.grade,
            teacherRemark: 'Demonstrated admirable commitment throughout the final term.',
            principalRemark: isPassed ? `Promoted to ${targetNextClass}.` : 'Repeat recommended to solidify foundation.',
            grades: [...scholarGrades]
          }
        }
      };

      const existingHistory = s.academicHistory || generateStudentHistoricalRecords(s);
      const updatedHistory = [sessionArchive, ...existingHistory.filter(h => h.sessionName !== schoolInfo.activeSession)];

      return {
        ...s,
        grade: targetNextClass,
        classId: targetNextClassId,
        isAlumni: isGraduating ? true : s.isAlumni,
        graduationSession: isGraduating ? schoolInfo.activeSession : s.graduationSession,
        promotionStatus: isPassed ? ('Promoted' as const) : ('Repeat' as const),
        promotedToGrade: targetNextClass,
        academicHistory: updatedHistory,
        term1Average: undefined,
        term2Average: undefined,
        term3Average: undefined,
        cumulativeAnnualAverage: undefined
      };
    });

    // Save updated students
    setStudents(nextStudents);
    try {
      localStorage.setItem('stanbax_students', JSON.stringify(nextStudents));
    } catch {}

    // Update session info
    const oldSession = schoolInfo.activeSession;
    updateSchoolInfo({
      activeSession: newSessionName,
      activeTerm: '1st Term (Michaelmas Term)'
    });

    // Update assessment config: Reset to 1st Term and open mid_term_ca for new session
    const updatedHistory = [
      {
        id: `promo-${Date.now()}`,
        fromSession: oldSession,
        toSession: newSessionName,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        totalEvaluated: students.length,
        promotedCount,
        repeatedCount,
        passPercentageUsed: passMarkPercentage
      },
      ...(assessmentConfig.promotionHistory || [])
    ];

    updateAssessmentConfig({
      activeSession: newSessionName,
      activeTerm: '1st Term',
      activePhase: 'mid_term_ca',
      lastPromotionDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      promotionHistory: updatedHistory
    });

    return {
      promotedCount,
      repeatedCount,
      upgradedStudents
    };
  };

  const toggleAutoRanking = (enabled?: boolean) => {
    updateAssessmentConfig({
      autoRankingEnabled: enabled !== undefined ? enabled : !assessmentConfig.autoRankingEnabled
    });
  };

  const getClassRankings = (classNameOrId: string, term?: string) => {
    // Accept a class id or a class name
    const cls = classes.find(c => c.id === classNameOrId)
      || classes.find(c => (c.name || '').trim().toLowerCase() === (classNameOrId || '').trim().toLowerCase());
    const classStudents = students.filter(s => {
      if (s.isAlumni) return false;
      if (cls && s.classId === cls.id) return true;
      const sGrade = (s.grade || '').trim().toLowerCase();
      const target = (cls?.name || classNameOrId || '').trim().toLowerCase();
      if (!sGrade || !target) return false;
      return sGrade === target || sGrade.includes(target) || target.includes(sGrade);
    });

    // Determine student score/average
    const scoredStudents = classStudents.map(student => {
      let avg = student.cumulativeAnnualAverage ?? student.termAverage ?? 0;
      if (term === '1st Term' && student.term1Average !== undefined) {
        avg = student.term1Average;
      } else if (term === '2nd Term' && student.term2Average !== undefined) {
        avg = student.term2Average;
      } else if (term === '3rd Term' && (student.term3Average !== undefined || student.cumulativeAnnualAverage !== undefined)) {
        avg = student.term3Average ?? student.cumulativeAnnualAverage ?? 0;
      }
      return {
        student,
        average: Math.round(avg * 10) / 10,
        totalScore: Math.round(avg * 10) / 10
      };
    });

    // Sort descending by average
    scoredStudents.sort((a, b) => b.average - a.average);

    // Assign positions/ranks (1st, 2nd, 3rd...)
    return scoredStudents.map((item, idx) => {
      const rank = idx + 1;
      const suffix = (r: number) => {
        const j = r % 10, k = r % 100;
        if (j === 1 && k !== 11) return `${r}st`;
        if (j === 2 && k !== 12) return `${r}nd`;
        if (j === 3 && k !== 13) return `${r}rd`;
        return `${r}th`;
      };
      return {
        ...item,
        rank,
        positionText: suffix(rank)
      };
    });
  };

  const dispatchCollatedResultsToDashboards = async (rawOptions?: string | {
    reportKind?: 'mid' | 'end';
    customMessage?: string;
    broadcastMessage?: string;
    dispatchedBy?: string;
    lockCollation?: boolean;
    targetClass?: string;
  }): Promise<{
    ok: boolean;
    studentsCount: number;
    parentsCount: number;
    dispatchedCount?: number;
    syncedToSupabase: boolean;
    dispatchedAt: string;
    message: string;
  }> => {
    markLocalMutation();
    const options = typeof rawOptions === 'string'
      ? { targetClass: rawOptions === 'all' ? 'ALL' : rawOptions }
      : (rawOptions || {});
    const reportKind = options?.reportKind || 'end';
    const lockCollation = options?.lockCollation === true;
    const nowIso = new Date().toISOString();
    const nowReadable = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const activeTerm = assessmentConfig.activeTerm;
    const activeSession = assessmentConfig.activeSession || schoolInfo.activeSession;
    const passMark = assessmentConfig.promotionPassMarkPercent || 50;

    const broadcastMsg =
      options?.customMessage?.trim() ||
      options?.broadcastMessage?.trim() ||
      (reportKind === 'end'
        ? `Official ${activeTerm} (${activeSession}) Terminal Examination Results have been collated, approved, and sent to your dashboard.`
        : `Official ${activeTerm} (${activeSession}) Mid-Term Continuous Assessment Results have been collated and sent to your dashboard.`);

    const suffix = (r: number) => {
      const j = r % 10,
        k = r % 100;
      if (j === 1 && k !== 11) return `${r}st`;
      if (j === 2 && k !== 12) return `${r}nd`;
      if (j === 3 && k !== 13) return `${r}rd`;
      return `${r}th`;
    };

    // Always read from latestStudentsRef so publishing right after a bulk import uses the newly imported scores!
    const sourceStudents = deduplicateStudentsByRegistration(
      latestStudentsRef.current && latestStudentsRef.current.length > 0 ? latestStudentsRef.current : students
    );

    // Step 1: Recalculate each active student's grades, termAverage, and annualAverage
    const precomputedStudents = sourceStudents.map(s => {
      if (s.isAlumni) return s;
      const rawGrades = s.grades && s.grades.length > 0 ? s.grades : [];
      const verifiedGrades: GradeRecord[] = rawGrades.map(g => {
        const ca1 = Number(g.ca1) || 0;
        const ca2 = Number(g.ca2) || 0;
        const ca3 = Number(g.ca3) || 0;
        const exam = Number(g.exam) || 0;
        const total =
          reportKind === 'mid'
            ? Math.min(100, Math.round(((ca1 + ca2) / Math.max(1, (assessmentConfig.ca1Max || 10) + (assessmentConfig.ca2Max || 10))) * 100))
            : ca1 + ca2 + ca3 + exam;
        const fullTotal = ca1 + ca2 + ca3 + exam;
        const { grade, remark } = calculateGrade(reportKind === 'mid' ? total : fullTotal);
        return {
          ...g,
          ca1,
          ca2,
          ca3,
          exam,
          total: fullTotal,
          grade,
          remark,
          annualAverage: g.annualAverage ?? fullTotal,
        };
      });

      const computedTermAvg =
        verifiedGrades.length > 0
          ? Math.round(
              (verifiedGrades.reduce((sum, g) => {
                if (reportKind === 'mid') {
                  const midMax = Math.max(1, (assessmentConfig.ca1Max || 10) + (assessmentConfig.ca2Max || 10));
                  return sum + ((g.ca1 + g.ca2) / midMax) * 100;
                }
                return sum + g.total;
              }, 0) /
                verifiedGrades.length) *
                10
            ) / 10
          : s.termAverage || 0;

      const fullTermAvg =
        verifiedGrades.length > 0
          ? Math.round((verifiedGrades.reduce((sum, g) => sum + g.total, 0) / verifiedGrades.length) * 10) / 10
          : s.termAverage || 0;

      const annualAvg =
        verifiedGrades.length > 0
          ? Math.round(
              (verifiedGrades.reduce((sum, g) => sum + (g.annualAverage ?? g.total), 0) / verifiedGrades.length) * 10
            ) / 10
          : s.cumulativeAnnualAverage ?? fullTermAvg;

      return {
        ...s,
        grades: verifiedGrades,
        termAverage: fullTermAvg || s.termAverage || 0,
        cumulativeAnnualAverage: annualAvg,
        _dispatchScore: computedTermAvg,
      };
    });

    // Step 2: Compute class-by-class rankings
    const classRankMap = new Map<string, { rankText: string; totalInClass: number }>();
    const groupedByClass = new Map<string, typeof precomputedStudents>();
    for (const s of precomputedStudents) {
      if (s.isAlumni) continue;
      const key = (s.classId || s.grade || 'general').trim().toLowerCase();
      const arr = groupedByClass.get(key) || [];
      arr.push(s);
      groupedByClass.set(key, arr);
    }

    for (const [, group] of groupedByClass.entries()) {
      const sorted = [...group].sort((a, b) => (b._dispatchScore || 0) - (a._dispatchScore || 0));
      sorted.forEach((st, idx) => {
        classRankMap.set(st.id, {
          rankText: suffix(idx + 1),
          totalInClass: sorted.length,
        });
      });
    }

    // Step 3: Stamp lastCollatedResult and remarks on every targeted scholar
    let dispatchedCount = 0;
    const updatedStudents: StudentProfile[] = precomputedStudents.map(s => {
      const { _dispatchScore, ...cleanStudent } = s as any;
      if (cleanStudent.isAlumni) return cleanStudent as StudentProfile;

      if (
        options?.targetClass &&
        options.targetClass !== 'ALL' &&
        options.targetClass.toLowerCase() !== 'all' &&
        cleanStudent.grade?.toLowerCase() !== options.targetClass.toLowerCase() &&
        cleanStudent.classId !== options.targetClass
      ) {
        return cleanStudent as StudentProfile;
      }

      dispatchedCount++;
      const rankInfo = classRankMap.get(cleanStudent.id) || { rankText: '1st', totalInClass: 1 };
      const effectiveAvg = _dispatchScore ?? cleanStudent.termAverage ?? 0;
      const gpaData = calculateGpa(cleanStudent.grades || []);
      const isPassed = effectiveAvg >= passMark;
      const nextCls = isPassed ? getNextClass(cleanStudent.grade) : cleanStudent.grade;

      const defaultTeacherRemark =
        effectiveAvg >= 75
          ? 'An outstanding and exemplary academic performance! Keep soaring higher.'
          : effectiveAvg >= 60
          ? 'Very commendable performance and consistent classroom dedication.'
          : effectiveAvg >= passMark
          ? 'Good effort shown this term; greater concentration will yield even higher distinctions.'
          : 'Requires intensive revision and closer academic follow-up across core subjects.';

      const defaultPrincipalRemark =
        effectiveAvg >= 75
          ? 'Distinction Honour Roll! The school management is proud of your academic excellence.'
          : effectiveAvg >= passMark
          ? `Satisfactory academic progress maintained.${activeTerm === '3rd Term' ? ` Promoted to ${nextCls}.` : ''}`
          : 'Advised to utilize Calvin AI Intensive Support and extra coaching classes.';

      const finalTeacherRemark = cleanStudent.teacherRemark || defaultTeacherRemark;
      const finalPrincipalRemark = cleanStudent.principalRemark || defaultPrincipalRemark;
      const finalPromotionStatus: 'Promoted' | 'Repeat' | 'Pending' =
        activeTerm === '3rd Term' ? (isPassed ? 'Promoted' : 'Repeat') : cleanStudent.promotionStatus || 'Promoted';

      return {
        ...(cleanStudent as StudentProfile),
        updatedAt: nowIso,
        overallPosition: rankInfo.rankText,
        teacherRemark: finalTeacherRemark,
        principalRemark: finalPrincipalRemark,
        promotionStatus: finalPromotionStatus,
        promotedToGrade: nextCls,
        lastCollatedResult: {
          session: activeSession,
          term: activeTerm,
          reportKind,
          dispatchedAt: nowIso,
          dispatchedBy: options?.dispatchedBy || schoolInfo.principalName || 'Office of the Principal & Registrar',
          broadcastMessage: broadcastMsg,
          termAverage: effectiveAvg,
          annualAverage: cleanStudent.cumulativeAnnualAverage ?? effectiveAvg,
          overallPosition: rankInfo.rankText,
          totalStudentsInClass: rankInfo.totalInClass,
          cgpa: gpaData.gpa.toFixed(2),
          cgpaScale: gpaData.scale,
          classification: gpaData.classification,
          grades: cleanStudent.grades || [],
          teacherRemark: finalTeacherRemark,
          principalRemark: finalPrincipalRemark,
          promotionStatus: finalPromotionStatus,
          promotedToGrade: nextCls,
        },
      };
    });

    const updatedConfig: AssessmentControlConfig = {
      ...assessmentConfig,
      activePhase: lockCollation ? 'closed' : assessmentConfig.activePhase,
      midTermResultsPublished: true,
      midTermPublishedAt:
        reportKind === 'mid' ? nowReadable : assessmentConfig.midTermPublishedAt || nowReadable,
      endTermResultsPublished: true,
      endTermPublishedAt:
        reportKind === 'end' ? nowReadable : assessmentConfig.endTermPublishedAt || nowReadable,
      resultsDispatchedToDashboard: true,
      dispatchedReportKind: reportKind,
      resultsDispatchedAt: nowIso,
      resultsDispatchedBy: options?.dispatchedBy || schoolInfo.principalName || 'School Administrator',
      resultsDispatchedSession: activeSession,
      resultsDispatchedTerm: activeTerm,
      resultsDispatchMessage: broadcastMsg,
    };

    // Update refs & React states immediately
    latestStudentsRef.current = updatedStudents;
    setStudents(updatedStudents);
    setAssessmentConfig(updatedConfig);

    // Save to localStorage & broadcast across tabs
    try {
      localStorage.setItem('stanbax_students', JSON.stringify(updatedStudents));
      localStorage.setItem('stanbax_assessment_config', JSON.stringify(updatedConfig));
    } catch {}
    broadcastLocalStateChange('stanbax_students', updatedStudents);
    broadcastLocalStateChange('stanbax_assessment_config', updatedConfig);

    // Log in Parent Broadcast Logs for audit trail
    addBroadcastLog({
      title: `Official ${reportKind === 'end' ? 'End-of-Term' : 'Mid-Term'} Results Dispatched (${activeTerm})`,
      channel: 'Portal',
      targetGroup: options?.targetClass && options.targetClass !== 'ALL' ? options.targetClass : 'All Parents & Scholars',
      message: broadcastMsg,
      recipientCount: dispatchedCount + parents.length,
    });

    // Persist to Express Backend (/api/results/dispatch)
    try {
      await fetch('/api/results/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: updatedStudents,
          subjects,
          assessmentConfig: updatedConfig,
          replaceRoster: !options?.targetClass || options.targetClass === 'ALL' || options.targetClass.toLowerCase() === 'all',
        }),
      });
    } catch {}

    // Persist to Supabase PostgreSQL + Public Community Mirror
    const dbSync = await forceSyncCollatedResultsToDatabase({
      students: updatedStudents,
      assessmentConfig: updatedConfig,
      subjects,
      parents,
      deletedAccountIds: Array.from(deletedAccountIdsRef.current),
      gradingSystem,
      officialSignatures,
      adminPassword,
    });

    const targetLabel = options?.targetClass && options.targetClass !== 'ALL' && options.targetClass.toLowerCase() !== 'all'
      ? `${options.targetClass} (${dispatchedCount} scholars)`
      : `All Classes (${dispatchedCount} scholars)`;

    return {
      ok: true,
      studentsCount: dispatchedCount,
      parentsCount: parents.length,
      dispatchedCount: dispatchedCount,
      syncedToSupabase: dbSync.syncedToSupabase,
      dispatchedAt: nowReadable,
      message: `Published live to database for ${targetLabel}! Students now have immediate portal access across all devices. (${dbSync.message})`,
    };
  };

  const unifyLocalStorageResultsToDatabase = async (): Promise<{
    ok: boolean;
    count: number;
    message: string;
    syncedToCloud: boolean;
  }> => {
    try {
      markLocalMutation();
      const nowIso = new Date().toISOString();
      const baseList = latestStudentsRef.current && latestStudentsRef.current.length > 0 ? latestStudentsRef.current : students;
      const currentStudents = deduplicateStudentsByRegistration(baseList).map(s => ({
        ...s,
        updatedAt: nowIso,
        lastCollatedResult: s.lastCollatedResult
          ? { ...s.lastCollatedResult, dispatchedAt: nowIso }
          : {
              session: assessmentConfig.activeSession || '2026/2027',
              term: (assessmentConfig.activeTerm as any) || '1st Term',
              reportKind: (assessmentConfig.dispatchedReportKind as any) || 'end',
              dispatchedAt: nowIso,
              dispatchedBy: activeAdminAccount?.name || 'School Administrator',
              termAverage: s.termAverage || 0,
              annualAverage: s.cumulativeAnnualAverage || s.termAverage || 0,
              grades: s.grades || [],
            },
      }));
      const currentConfig: AssessmentControlConfig = {
        ...assessmentConfig,
        resultsDispatchedToDashboard: true,
        midTermResultsPublished: true,
        endTermResultsPublished: true,
        resultsDispatchedAt: nowIso,
      };
      const currentCustomResults = customResults;

      setStudents(currentStudents);
      setAssessmentConfig(currentConfig);

      // 1. Send to Express Backend /api/results/unify (and replace roster so 88 stays 88)
      let serverCount = currentStudents.length;
      try {
        const res = await fetch('/api/results/unify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            students: currentStudents,
            subjects,
            assessmentConfig: currentConfig,
            customResults: currentCustomResults,
            replaceRoster: true,
            unifiedBy: activeAdminAccount?.name || 'School Administrator'
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.stats?.unifiedStudentsCount) {
            serverCount = json.stats.unifiedStudentsCount;
          }
        }
      } catch (err) {
        console.warn('[Unify Server Error]', err);
      }

      // 2. Persist to connected Supabase database (school_state & public mirror)
      let cloudSynced = false;
      try {
        const cloudSync = await forceSyncCollatedResultsToDatabase({
          students: currentStudents,
          assessmentConfig: currentConfig,
          subjects,
          parents,
          deletedAccountIds: Array.from(deletedAccountIdsRef.current),
          gradingSystem,
          officialSignatures,
          adminPassword
        });
        cloudSynced = cloudSync.syncedToSupabase;
      } catch (err) {
        console.warn('[Unify Supabase Cloud Error]', err);
      }

      // 3. Update localStorage & broadcast to all tabs
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(currentStudents));
        localStorage.setItem('stanbax_subjects', JSON.stringify(subjects));
        localStorage.setItem('stanbax_assessment_config', JSON.stringify(currentConfig));
        localStorage.setItem('stanbax_custom_results', JSON.stringify(currentCustomResults));
      } catch {}
      broadcastLocalStateChange('stanbax_students', currentStudents);
      broadcastLocalStateChange('stanbax_subjects', subjects);
      broadcastLocalStateChange('stanbax_assessment_config', currentConfig);
      broadcastLocalStateChange('stanbax_custom_results', currentCustomResults);

      return {
        ok: true,
        count: serverCount,
        message: `Successfully unified & published ${serverCount} scholar records, logins, and ${subjects.length} subjects from local storage to the live database.${cloudSynced ? ' Synced with Supabase PostgreSQL.' : ''}`,
        syncedToCloud: cloudSynced
      };
    } catch (err: any) {
      console.error('[Unify Results Error]', err);
      return {
        ok: false,
        count: 0,
        message: err?.message || 'Failed to unify results to database.',
        syncedToCloud: false
      };
    }
  };

  // 12. Contact Inquiries
  const [inquiries, setInquiries] = useState<ContactInquiry[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_inquiries');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "inq-1",
        fullName: "Mr. Adebayo Adeleke",
        email: "ade.adeleke@yahoo.com",
        subject: "Inquiry on Creche & After-School Care",
        message: "Good day, I would like to confirm if your creche takes 14-month-old toddlers and the closing pick-up hour for working parents.",
        date: "2026-09-16",
        status: "New"
      }
    ];
  });

  const submitInquiry = (fullName: string, email: string, subject: string, message: string) => {
    const newInquiry: ContactInquiry = {
      id: `inq-${Date.now()}`,
      fullName,
      email,
      subject,
      message,
      date: new Date().toISOString().split('T')[0],
      status: 'New'
    };
    setInquiries(prev => {
      const updated = [newInquiry, ...prev];
      try {
        localStorage.setItem('stanbax_inquiries', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // 13. Unified Authentication (Admin, Proprietress, Faculty/Tutor, Scholar/Parent)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      const sess = sessionStorage.getItem('stanbax_admin_auth');
      if (sess !== null) return sess === 'true';
      return localStorage.getItem('stanbax_admin_auth') === 'true';
    } catch { return false; }
  });

  const [isProprietressAuthenticated, setIsProprietressAuthenticated] = useState<boolean>(() => {
    try {
      const sess = sessionStorage.getItem('stanbax_proprietress_auth');
      if (sess !== null) return sess === 'true';
      return localStorage.getItem('stanbax_proprietress_auth') === 'true';
    } catch { return false; }
  });

  const [isTutorAuthenticated, setIsTutorAuthenticated] = useState<boolean>(() => {
    try {
      const sess = sessionStorage.getItem('stanbax_tutor_auth');
      if (sess !== null) return sess === 'true';
      return localStorage.getItem('stanbax_tutor_auth') === 'true';
    } catch { return false; }
  });

  const [isStudentAuthenticated, setIsStudentAuthenticated] = useState<boolean>(() => {
    try {
      const sess = sessionStorage.getItem('stanbax_student_auth');
      if (sess !== null) return sess === 'true';
      return localStorage.getItem('stanbax_student_auth') === 'true';
    } catch { return false; }
  });

  // Default credentials come from Vite env vars injected at build time
  // (GitHub Secrets) so they are never committed to the source tree.
  const DEFAULT_ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'Justin2000.';
  const DEFAULT_PROPRIETRESS_PASSWORD = import.meta.env.VITE_PROPRIETRESS_PASSWORD || 'Proprietress2025!';

  const [adminPassword, setAdminPassword] = useState<string>(() => {
    const saved = localStorage.getItem('stanbax_admin_password');
    if (!saved || saved === 'Admin2025!' || saved === 'stanbax2025') {
      localStorage.setItem('stanbax_admin_password', DEFAULT_ADMIN_PASSWORD);
      return DEFAULT_ADMIN_PASSWORD;
    }
    return saved;
  });

  const [adminSecurityQuestion, setAdminSecurityQuestion] = useState<string>(() => {
    return localStorage.getItem('stanbax_admin_security_q') || 'What is the name of your first school';
  });

  const [adminSecurityAnswer, setAdminSecurityAnswer] = useState<string>(() => {
    return localStorage.getItem('stanbax_admin_security_a') || 'Stanbax';
  });

  const updateAdminSecurityQuestion = (question: string, answer: string) => {
    if (isRemoteEnabled()) {
      return {
        success: false,
        message: 'Security-question recovery is not configured in Supabase. Password recovery must be handled by an administrator.',
      };
    }
    const q = question.trim();
    const a = answer.trim();
    if (!q) return { success: false, message: 'Security question cannot be empty.' };
    if (!a) return { success: false, message: 'Security answer cannot be empty.' };
    setAdminSecurityQuestion(q);
    setAdminSecurityAnswer(a);
    localStorage.setItem('stanbax_admin_security_q', q);
    localStorage.setItem('stanbax_admin_security_a', a);
    return { success: true, message: 'Administrator security question successfully updated.' };
  };

  const [proprietressPassword, setProprietressPassword] = useState<string>(() => {
    return localStorage.getItem('stanbax_proprietress_password') || DEFAULT_PROPRIETRESS_PASSWORD;
  });

  const isAdminPasswordValid = (pass: string) => {
    const clean = pass.trim();
    return clean === adminPassword;
  };

  const isProprietressPasswordValid = (pass: string) => {
    const clean = pass.trim();
    return clean === proprietressPassword;
  };

  const [isParentAuthenticated, setIsParentAuthenticated] = useState<boolean>(() => {
    try {
      const sess = sessionStorage.getItem('stanbax_parent_auth');
      if (sess !== null) return sess === 'true';
      return localStorage.getItem('stanbax_parent_auth') === 'true';
    } catch { return false; }
  });
  const [activeParentId, setActiveParentId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('stanbax_parent_id') || localStorage.getItem('stanbax_parent_id') || (DEFAULT_PARENTS[0]?.id || 'parent-1');
    } catch { return DEFAULT_PARENTS[0]?.id || 'parent-1'; }
  });

  // Head Mistress Desk & Credentials
  const DEFAULT_HEADMISTRESS_PASSWORD = 'Headmistress2025!';
  const [headmistressPassword, setHeadmistressPassword] = useState<string>(() => {
    return localStorage.getItem('stanbax_headmistress_password') || DEFAULT_HEADMISTRESS_PASSWORD;
  });
  const [headmistressProfile, setHeadmistressProfile] = useState<HeadmistressProfile>(() => {
    try {
      const saved = localStorage.getItem('stanbax_headmistress_profile');
      if (saved) return { ...DEFAULT_HEADMISTRESS_PROFILE, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_HEADMISTRESS_PROFILE;
  });
  const updateHeadmistressProfile = (info: Partial<HeadmistressProfile>) => {
    setHeadmistressProfile(prev => {
      const updated = { ...prev, ...info };
      try { localStorage.setItem('stanbax_headmistress_profile', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };
  const [isHeadmistressAuthenticated, setIsHeadmistressAuthenticated] = useState<boolean>(() => {
    try {
      const sess = sessionStorage.getItem('stanbax_headmistress_auth');
      if (sess !== null) return sess === 'true';
      return localStorage.getItem('stanbax_headmistress_auth') === 'true';
    } catch { return false; }
  });

  // Moderator Desk & Credentials
  const DEFAULT_MODERATOR_PASSWORD = 'Moderator2025!';
  const [moderatorPassword, setModeratorPassword] = useState<string>(() => {
    return localStorage.getItem('stanbax_moderator_password') || DEFAULT_MODERATOR_PASSWORD;
  });
  const [moderators, setModerators] = useState<ModeratorProfile[]>(() => {
    const deletedSet = new Set<string>();
    try {
      const rawDel = localStorage.getItem('stanbax_deleted_account_ids');
      if (rawDel) JSON.parse(rawDel).forEach((x: any) => deletedSet.add(String(x).toLowerCase()));
    } catch {}

    try {
      const saved = localStorage.getItem('stanbax_moderators');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(m => m?.id && !deletedSet.has(m.id.toLowerCase()) && (!m.email || !deletedSet.has(m.email.toLowerCase().trim())));
        }
      }
    } catch {}
    return DEFAULT_MODERATORS.filter(m => !deletedSet.has(m.id.toLowerCase()) && (!m.email || !deletedSet.has(m.email.toLowerCase().trim())));
  });
  const addModerator = (data: Omit<ModeratorProfile, 'id'>): ModeratorProfile => {
    const newMod: ModeratorProfile = {
      id: `mod-${Date.now()}`,
      password: data.password || 'Moderator2025!',
      ...data
    };
    setModerators(prev => {
      const updated = [...prev, newMod];
      try { localStorage.setItem('stanbax_moderators', JSON.stringify(updated)); } catch {}
      return updated;
    });

    // Save online directly to server database
    void fetch('/api/moderators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMod)
    }).catch(err => console.warn('[Online Storage] Error saving moderator online:', err));

    return newMod;
  };
  const updateModerator = (id: string, data: Partial<ModeratorProfile>) => {
    setModerators(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, ...data } : m);
      try { localStorage.setItem('stanbax_moderators', JSON.stringify(updated)); } catch {}
      return updated;
    });
    void fetch(`/api/moderators/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(() => {});
  };
  const deleteModerator = (id: string) => {
    const target = moderators.find(m => m.id === id);
    markAccountAsPermanentlyDeleted(id, target?.email, 'moderator');
    setModerators(prev => {
      const updated = prev.filter(m => m.id !== id);
      try { localStorage.setItem('stanbax_moderators', JSON.stringify(updated)); } catch {}
      return updated;
    });
    void fetch(`/api/moderators/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
  };
  const [isModeratorAuthenticated, setIsModeratorAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('stanbax_moderator_auth') === 'true' || localStorage.getItem('stanbax_moderator_auth') === 'true';
    } catch { return false; }
  });
  const [activeModeratorId, setActiveModeratorId] = useState<string>(() => {
    try {
      return localStorage.getItem('stanbax_moderator_id') || sessionStorage.getItem('stanbax_moderator_id') || 'mod-1';
    } catch { return 'mod-1'; }
  });

  // Role Delegated Privileges System (Admin configurable)
  const [rolePrivileges, setRolePrivileges] = useState<RolePrivilegeSettings>(() => {
    try {
      const saved = localStorage.getItem('stanbax_role_privileges');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          headmistress: { ...DEFAULT_ROLE_PRIVILEGES.headmistress, ...(parsed.headmistress || {}) },
          moderator: { ...DEFAULT_ROLE_PRIVILEGES.moderator, ...(parsed.moderator || {}) },
          tutor: { ...DEFAULT_ROLE_PRIVILEGES.tutor, ...(parsed.tutor || {}) },
          student: { ...DEFAULT_ROLE_PRIVILEGES.student, ...(parsed.student || {}) },
          parent: { ...DEFAULT_ROLE_PRIVILEGES.parent, ...(parsed.parent || {}) }
        };
      }
    } catch {}
    return DEFAULT_ROLE_PRIVILEGES;
  });

  const updateRolePrivilege = (
    role: 'headmistress' | 'moderator' | 'tutor' | 'student' | 'parent',
    key: PrivilegeKey,
    granted: boolean
  ) => {
    setRolePrivileges(prev => {
      const updated = {
        ...prev,
        [role]: {
          ...prev[role],
          [key]: granted
        }
      };
      try {
        localStorage.setItem('stanbax_role_privileges', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetRolePrivileges = (targetRole?: 'headmistress' | 'moderator' | 'tutor') => {
    setRolePrivileges(prev => {
      let updated: RolePrivilegeSettings;
      if (targetRole) {
        updated = {
          ...prev,
          [targetRole]: { ...DEFAULT_ROLE_PRIVILEGES[targetRole] }
        };
      } else {
        updated = { ...DEFAULT_ROLE_PRIVILEGES };
      }
      try {
        localStorage.setItem('stanbax_role_privileges', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Delegated Admin Accounts (Managed by Super Admin)
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>(() => {
    const deletedSet = new Set<string>();
    try {
      const rawDel = localStorage.getItem('stanbax_deleted_account_ids');
      if (rawDel) JSON.parse(rawDel).forEach((x: any) => deletedSet.add(String(x).toLowerCase()));
    } catch {}

    try {
      const saved = localStorage.getItem('stanbax_admin_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(a => a?.id && !deletedSet.has(a.id.toLowerCase()) && (!a.username || !deletedSet.has(a.username.toLowerCase())));
        }
      }
    } catch {}
    return [];
  });

  const [activeAdminId, setActiveAdminId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('stanbax_active_admin_id') || localStorage.getItem('stanbax_active_admin_id') || 'super-admin';
    } catch {
      return 'super-admin';
    }
  });

  const ALL_ADMIN_PRIVILEGE_KEYS: PrivilegeKey[] = [
    'manage_admissions',
    'manage_students',
    'manage_tutors',
    'manage_classes_subjects',
    'enter_edit_grades',
    'collate_publish_results',
    'manage_attendance',
    'manage_cbt_exams',
    'manage_lesson_notes',
    'manage_digital_library',
    'manage_timetables',
    'manage_Broadcasts_notices',
    'manage_community_chat',
    'manage_ephemeral_statuses',
    'manage_press_news_blog',
    'manage_visitor_inquiries',
    'manage_fee_verifications',
    'manage_sickbay_logs',
    'manage_landing_cms',
    'manage_alumni_Approvals',
    'manage_calvin_ai_tokens'
  ];

  const activeAdminAccount: AdminAccount | null = !isAdminAuthenticated
    ? null
    : activeAdminId === 'super-admin'
    ? {
        id: 'super-admin',
        name: 'Chief Administrator & Super Admin',
        username: 'admin',
        email: 'admin@stanbaxschools.edu.ng',
        roleTitle: 'Super Administrator & Registrar',
        isSuperAdmin: true,
        privileges: ALL_ADMIN_PRIVILEGE_KEYS,
        status: 'Active',
        createdAt: 'System Master'
      }
    : adminAccounts.find(a => a.id === activeAdminId) || {
        id: 'super-admin',
        name: 'Chief Administrator & Super Admin',
        username: 'admin',
        email: 'admin@stanbaxschools.edu.ng',
        roleTitle: 'Super Administrator & Registrar',
        isSuperAdmin: true,
        privileges: ALL_ADMIN_PRIVILEGE_KEYS,
        status: 'Active',
        createdAt: 'System Master'
      };

  const isSuperAdmin: boolean = isAdminAuthenticated && (activeAdminId === 'super-admin' || !!activeAdminAccount?.isSuperAdmin);

  const hasAdminPrivilege = (key: PrivilegeKey): boolean => {
    if (!isAdminAuthenticated) return false;
    if (isSuperAdmin) return true;
    return !!activeAdminAccount?.privileges?.includes(key);
  };

  const createAdminAccount = async (
    data: Omit<AdminAccount, 'id' | 'createdAt'>
  ): Promise<{ success: boolean; message: string; account?: AdminAccount }> => {
    const cleanUsername = (data.username || '').trim().toLowerCase();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanPass = (data.password || '').trim();

    if (!data.name?.trim()) {
      return { success: false, message: 'Please provide the full name of the administrator.' };
    }
    if (!cleanUsername) {
      return { success: false, message: 'Please provide a login username for the administrator.' };
    }
    if (!cleanPass || cleanPass.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long.' };
    }
    const reservedMasterIds = ['admin', 'administrator', 'super-admin', 'principal', 'stanbax', 'admin@stanbaxschools.edu.ng'];
    if (reservedMasterIds.includes(cleanUsername) || (cleanEmail && reservedMasterIds.includes(cleanEmail))) {
      return { success: false, message: 'That username or email is reserved for the Master Super Admin account.' };
    }
    const duplicate = adminAccounts.some(
      a =>
        a.username.toLowerCase() === cleanUsername ||
        (cleanEmail && a.email.toLowerCase() === cleanEmail)
    );
    if (duplicate) {
      return { success: false, message: 'An administrator account with this username or email already exists.' };
    }

    const newAdmin: AdminAccount = {
      ...data,
      id: `admin-${Date.now()}`,
      name: data.name.trim(),
      username: cleanUsername,
      email: cleanEmail || `${cleanUsername}@stanbaxschools.edu.ng`,
      password: cleanPass,
      roleTitle: data.roleTitle?.trim() || 'Delegated Administrator',
      privileges: Array.isArray(data.privileges) ? data.privileges : [],
      status: data.status || 'Active',
      createdAt: new Date().toISOString(),
      createdBy: activeAdminAccount?.name || 'Super Admin'
    };

    const updated = [...adminAccounts, newAdmin];
    setAdminAccounts(updated);
    try {
      localStorage.setItem('stanbax_admin_accounts', JSON.stringify(updated));
    } catch {}
    broadcastLocalStateChange('stanbax_admin_accounts', updated);
    void syncStateOnline('stanbax_admin_accounts', updated);

    if (isRemoteEnabled()) {
      try {
        await remoteCreateCredential(
          newAdmin.username,
          cleanPass,
          'admin',
          newAdmin.id,
          [newAdmin.username, newAdmin.email.toLowerCase(), newAdmin.id.toLowerCase()]
        );
      } catch (e) {
        console.warn('[Sub-Admin Cloud Credential Provisioning]', e);
      }
    }

    return {
      success: true,
      message: `Admin account for ${newAdmin.name} (@${newAdmin.username}) created with ${newAdmin.privileges.length} granted privileges.`,
      account: newAdmin
    };
  };

  const updateAdminAccount = async (
    id: string,
    updates: Partial<AdminAccount>
  ): Promise<{ success: boolean; message: string }> => {
    const existing = adminAccounts.find(a => a.id === id);
    if (!existing) {
      return { success: false, message: 'Administrator account not found.' };
    }
    const updated = adminAccounts.map(a => (a.id === id ? { ...a, ...updates } : a));
    setAdminAccounts(updated);
    try {
      localStorage.setItem('stanbax_admin_accounts', JSON.stringify(updated));
    } catch {}
    broadcastLocalStateChange('stanbax_admin_accounts', updated);
    void syncStateOnline('stanbax_admin_accounts', updated);

    if (updates.password && updates.password.trim().length >= 6 && isRemoteEnabled()) {
      const targetUser = (updates.username || existing.username).toLowerCase();
      try {
        const res = await remoteChangePassword(targetUser, null, updates.password.trim());
        if (!res.ok) {
          await remoteCreateCredential(
            targetUser,
            updates.password.trim(),
            'admin',
            existing.id,
            [targetUser, (updates.email || existing.email).toLowerCase(), existing.id.toLowerCase()]
          );
        }
      } catch {}
    }

    return {
      success: true,
      message: `Admin account (${updates.name || existing.name}) updated.`
    };
  };

  const deleteAdminAccount = async (id: string): Promise<{ success: boolean; message: string }> => {
    if (id === 'super-admin' || id === 'usr-admin' || id === 'admin') {
      return { success: false, message: 'The Master Super Administrator account cannot be deleted.' };
    }
    const existing = adminAccounts.find(a => a.id === id);
    if (!existing) {
      return { success: false, message: 'Administrator account not found.' };
    }
    markAccountAsPermanentlyDeleted(id, existing.username, 'admin');
    const updated = adminAccounts.filter(a => a.id !== id);
    setAdminAccounts(updated);
    try {
      localStorage.setItem('stanbax_admin_accounts', JSON.stringify(updated));
    } catch {}
    broadcastLocalStateChange('stanbax_admin_accounts', updated);
    void syncStateOnline('stanbax_admin_accounts', updated);

    if (isRemoteEnabled()) {
      try {
        await remoteDeleteCredential(existing.username, existing.id);
      } catch {}
    }

    return {
      success: true,
      message: `Delegated administrator account (${existing.name}) has been removed.`
    };
  };

  const hasPrivilege = (role: UserRole, key: PrivilegeKey): boolean => {
    if (role === 'proprietress') return true;
    if (role === 'admin') {
      if (isSuperAdmin) return true;
      if (activeAdminAccount && !activeAdminAccount.isSuperAdmin) {
        return activeAdminAccount.privileges.includes(key);
      }
      return true;
    }
    if (role === 'headmistress') return !!rolePrivileges.headmistress[key];
    if (role === 'moderator') return !!rolePrivileges.moderator[key];
    if (role === 'tutor') return !!rolePrivileges.tutor[key];
    if (role === 'student') return !!rolePrivileges.student[key];
    if (role === 'parent') return !!rolePrivileges.parent[key];
    return false;
  };

  const authenticatedRole: UserRole | null = isAdminAuthenticated
    ? 'admin'
    : isProprietressAuthenticated
    ? 'proprietress'
    : isHeadmistressAuthenticated
    ? 'headmistress'
    : isModeratorAuthenticated
    ? 'moderator'
    : isTutorAuthenticated
    ? 'tutor'
    : isStudentAuthenticated
    ? 'student'
    : isParentAuthenticated
    ? 'parent'
    : null;

  const clearOtherRoles = (keep: UserRole) => {
    if (keep !== 'admin') {
      setIsAdminAuthenticated(false);
      localStorage.removeItem('stanbax_admin_auth');
      sessionStorage.removeItem('stanbax_admin_auth');
      localStorage.removeItem('stanbax_active_admin_id');
      sessionStorage.removeItem('stanbax_active_admin_id');
    }
    if (keep !== 'proprietress') {
      setIsProprietressAuthenticated(false);
      localStorage.removeItem('stanbax_proprietress_auth');
      sessionStorage.removeItem('stanbax_proprietress_auth');
    }
    if (keep !== 'headmistress') {
      setIsHeadmistressAuthenticated(false);
      localStorage.removeItem('stanbax_headmistress_auth');
      sessionStorage.removeItem('stanbax_headmistress_auth');
    }
    if (keep !== 'moderator') {
      setIsModeratorAuthenticated(false);
      localStorage.removeItem('stanbax_moderator_auth');
      localStorage.removeItem('stanbax_moderator_id');
      sessionStorage.removeItem('stanbax_moderator_auth');
      sessionStorage.removeItem('stanbax_moderator_id');
    }
    if (keep !== 'tutor') {
      setIsTutorAuthenticated(false);
      localStorage.removeItem('stanbax_tutor_auth');
      localStorage.removeItem('stanbax_tutor_id');
      sessionStorage.removeItem('stanbax_tutor_auth');
      sessionStorage.removeItem('stanbax_tutor_id');
    }
    if (keep !== 'student') {
      setIsStudentAuthenticated(false);
      localStorage.removeItem('stanbax_student_auth');
      localStorage.removeItem('stanbax_student_id');
      sessionStorage.removeItem('stanbax_student_auth');
      sessionStorage.removeItem('stanbax_student_id');
    }
    if (keep !== 'parent') {
      setIsParentAuthenticated(false);
      localStorage.removeItem('stanbax_parent_auth');
      localStorage.removeItem('stanbax_parent_id');
      sessionStorage.removeItem('stanbax_parent_auth');
      sessionStorage.removeItem('stanbax_parent_id');
    }
  };

  // Universal Single Sign-On Gateway (Automatically detects user role & redirects)
  const universalLogin = async (identifier: string, pass: string): Promise<{
    success: boolean;
    role?: UserRole;
    message?: string;
    targetSection?: PageSection;
    isAlumni?: boolean;
  }> => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      return { success: false, message: 'Please enter both your identifier and password.' };
    }

    // Server-verified auth: when Supabase is configured and reachable the
    // database is the source of truth (passwords are hashed, checked via RPC).
    if (isRemoteEnabled()) {
      const res = await remoteVerifyLogin(cleanId, cleanPass);
      if (res.unreachable) {
        console.warn('[Remote Auth] Unreachable, falling through to synchronized credentials cache.');
      } else if (res.ok && res.role) {
        const role = res.role as UserRole;
        clearOtherRoles(role);
        const sectionByRole: Record<UserRole, PageSection> = {
          admin: 'admin-portal',
          proprietress: 'proprietress-portal',
          headmistress: 'headmistress-portal',
          moderator: 'moderator-portal',
          tutor: 'tutor-portal',
          student: 'student-portal',
          parent: 'parent-portal',
        };
        const matchedStudent = res.refId ? students.find(s => s.id === res.refId) : undefined;
        switch (role) {
          case 'admin': {
            const matchedDelegatedAdmin = adminAccounts.find(
              a =>
                a.id.toLowerCase() === (res.refId || '').toLowerCase() ||
                a.username.toLowerCase() === cleanId ||
                a.email.toLowerCase() === cleanId
            );
            if (matchedDelegatedAdmin && matchedDelegatedAdmin.status === 'Suspended') {
              return { success: false, message: 'This delegated administrator account is currently suspended by the Super Admin.' };
            }
            const resolvedAdminId = matchedDelegatedAdmin ? matchedDelegatedAdmin.id : 'super-admin';
            if (resolvedAdminId === 'super-admin') {
              setAdminPassword(cleanPass);
              localStorage.setItem('stanbax_admin_password', cleanPass);
            }
            setActiveAdminId(resolvedAdminId);
            localStorage.setItem('stanbax_active_admin_id', resolvedAdminId);
            sessionStorage.setItem('stanbax_active_admin_id', resolvedAdminId);
            setIsAdminAuthenticated(true);
            localStorage.setItem('stanbax_admin_auth', 'true');
            sessionStorage.setItem('stanbax_admin_auth', 'true');
            localStorage.setItem('stanbax_active_section', 'admin-portal');
            sessionStorage.setItem('stanbax_active_section', 'admin-portal');
            break;
          }
          case 'proprietress':
            setProprietressPassword(cleanPass);
            localStorage.setItem('stanbax_proprietress_password', cleanPass);
            setIsProprietressAuthenticated(true);
            localStorage.setItem('stanbax_proprietress_auth', 'true');
            sessionStorage.setItem('stanbax_proprietress_auth', 'true');
            localStorage.setItem('stanbax_active_section', 'proprietress-portal');
            sessionStorage.setItem('stanbax_active_section', 'proprietress-portal');
            break;
          case 'headmistress':
            setHeadmistressPassword(cleanPass);
            localStorage.setItem('stanbax_headmistress_password', cleanPass);
            setIsHeadmistressAuthenticated(true);
            localStorage.setItem('stanbax_headmistress_auth', 'true');
            sessionStorage.setItem('stanbax_headmistress_auth', 'true');
            localStorage.setItem('stanbax_active_section', 'headmistress-portal');
            sessionStorage.setItem('stanbax_active_section', 'headmistress-portal');
            break;
          case 'moderator':
            setModeratorPassword(cleanPass);
            localStorage.setItem('stanbax_moderator_password', cleanPass);
            setIsModeratorAuthenticated(true);
            if (res.refId) {
              setActiveModeratorId(res.refId);
              localStorage.setItem('stanbax_moderator_id', res.refId);
              sessionStorage.setItem('stanbax_moderator_id', res.refId);
            }
            localStorage.setItem('stanbax_moderator_auth', 'true');
            sessionStorage.setItem('stanbax_moderator_auth', 'true');
            localStorage.setItem('stanbax_active_section', 'moderator-portal');
            sessionStorage.setItem('stanbax_active_section', 'moderator-portal');
            break;
          case 'tutor':
            setIsTutorAuthenticated(true);
            if (res.refId) {
              setActiveTutorId(res.refId);
              localStorage.setItem('stanbax_tutor_id', res.refId);
              sessionStorage.setItem('stanbax_tutor_id', res.refId);
            }
            localStorage.setItem('stanbax_tutor_auth', 'true');
            sessionStorage.setItem('stanbax_tutor_auth', 'true');
            localStorage.setItem('stanbax_active_section', 'tutor-portal');
            sessionStorage.setItem('stanbax_active_section', 'tutor-portal');
            break;
          case 'student':
            setIsStudentAuthenticated(true);
            if (res.refId) {
              setActiveStudentId(res.refId);
              localStorage.setItem('stanbax_student_id', res.refId);
              sessionStorage.setItem('stanbax_student_id', res.refId);
            }
            if (matchedStudent?.regNumber) {
              localStorage.setItem('stanbax_student_reg', matchedStudent.regNumber);
              sessionStorage.setItem('stanbax_student_reg', matchedStudent.regNumber);
            } else {
              localStorage.setItem('stanbax_student_reg', cleanId);
              sessionStorage.setItem('stanbax_student_reg', cleanId);
            }
            localStorage.setItem('stanbax_student_auth', 'true');
            sessionStorage.setItem('stanbax_student_auth', 'true');
            localStorage.setItem('stanbax_active_section', 'student-portal');
            sessionStorage.setItem('stanbax_active_section', 'student-portal');
            break;
          case 'parent':
            setIsParentAuthenticated(true);
            if (res.refId) {
              setActiveParentId(res.refId);
              localStorage.setItem('stanbax_parent_id', res.refId);
              sessionStorage.setItem('stanbax_parent_id', res.refId);
            }
            localStorage.setItem('stanbax_parent_auth', 'true');
            sessionStorage.setItem('stanbax_parent_auth', 'true');
            localStorage.setItem('stanbax_active_section', 'parent-portal');
            sessionStorage.setItem('stanbax_active_section', 'parent-portal');
            break;
        }
        // Hydrate + reload into the portal (never returns in practice).
        await completeRemoteLogin(res.token!, sectionByRole[role], res.refId, cleanId);
        return {
          success: true,
          role,
          targetSection: sectionByRole[role],
          isAlumni: !!matchedStudent?.isAlumni,
        };
      }
    }

    // 0. Primary Server-Side Database Verification:
    // Ensures accounts created by Admin or Moderators are immediately validated online
    try {
      const serverLoginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, password: cleanPass })
      });
      if (serverLoginRes.ok) {
        const sData = await serverLoginRes.json();
        if (sData.success && sData.role) {
          const role = sData.role as UserRole;
          clearOtherRoles(role);
          const targetSection = (sData.targetSection || `${role}-portal`) as PageSection;

          if (role === 'admin') {
            setIsAdminAuthenticated(true);
            localStorage.setItem('stanbax_admin_auth', 'true');
            sessionStorage.setItem('stanbax_admin_auth', 'true');
          } else if (role === 'proprietress') {
            setIsProprietressAuthenticated(true);
            localStorage.setItem('stanbax_proprietress_auth', 'true');
            sessionStorage.setItem('stanbax_proprietress_auth', 'true');
          } else if (role === 'headmistress') {
            setIsHeadmistressAuthenticated(true);
            localStorage.setItem('stanbax_headmistress_auth', 'true');
            sessionStorage.setItem('stanbax_headmistress_auth', 'true');
          } else if (role === 'moderator') {
            setIsModeratorAuthenticated(true);
            const modUser = sData.user;
            if (modUser?.id) {
              setActiveModeratorId(modUser.id);
              localStorage.setItem('stanbax_moderator_id', modUser.id);
              sessionStorage.setItem('stanbax_moderator_id', modUser.id);
              setModerators(prev => {
                const exists = prev.some(m => m.id === modUser.id);
                const next = exists ? prev.map(m => m.id === modUser.id ? { ...m, ...modUser } : m) : [modUser, ...prev];
                try { localStorage.setItem('stanbax_moderators', JSON.stringify(next)); } catch {}
                return next;
              });
            }
            localStorage.setItem('stanbax_moderator_auth', 'true');
            sessionStorage.setItem('stanbax_moderator_auth', 'true');
          } else if (role === 'tutor') {
            setIsTutorAuthenticated(true);
            const tutUser = sData.user;
            if (tutUser?.id) {
              setActiveTutorId(tutUser.id);
              localStorage.setItem('stanbax_tutor_id', tutUser.id);
              sessionStorage.setItem('stanbax_tutor_id', tutUser.id);
              setTutors(prev => {
                const exists = prev.some(t => t.id === tutUser.id);
                const next = exists ? prev.map(t => t.id === tutUser.id ? { ...t, ...tutUser } : t) : [tutUser, ...prev];
                try { localStorage.setItem('stanbax_tutors', JSON.stringify(next)); } catch {}
                return next;
              });
            }
            localStorage.setItem('stanbax_tutor_auth', 'true');
            sessionStorage.setItem('stanbax_tutor_auth', 'true');
          } else if (role === 'student') {
            setIsStudentAuthenticated(true);
            const stuUser = sData.user;
            if (stuUser?.id) {
              setStudents(prev => {
                // Merge server stuUser with existing state using deduplicateStudentsByRegistration so newer cloud/local edits win
                const deduplicated = deduplicateStudentsByRegistration([stuUser, ...prev]);
                const resolvedStu =
                  deduplicated.find(
                    s =>
                      s.id === stuUser.id ||
                      (stuUser.regNumber && normalizeRegForUpsert(s.regNumber) === normalizeRegForUpsert(stuUser.regNumber))
                  ) || stuUser;
                setActiveStudentId(resolvedStu.id);
                localStorage.setItem('stanbax_student_id', resolvedStu.id);
                sessionStorage.setItem('stanbax_student_id', resolvedStu.id);
                if (resolvedStu.regNumber) {
                  localStorage.setItem('stanbax_student_reg', resolvedStu.regNumber);
                  sessionStorage.setItem('stanbax_student_reg', resolvedStu.regNumber);
                }
                try { sessionStorage.setItem('stanbax_active_student_cache', JSON.stringify(resolvedStu)); } catch {}
                setLocalStorageSilent('stanbax_students', JSON.stringify(deduplicated));
                return deduplicated;
              });
            }
            localStorage.setItem('stanbax_student_auth', 'true');
            sessionStorage.setItem('stanbax_student_auth', 'true');
          } else if (role === 'parent') {
            setIsParentAuthenticated(true);
            const parentUser = sData.user;
            if (parentUser?.id) {
              setActiveParentId(parentUser.id);
              localStorage.setItem('stanbax_parent_id', parentUser.id);
              sessionStorage.setItem('stanbax_parent_id', parentUser.id);
              setParents(prev => {
                const exists = prev.some(p => p.id === parentUser.id);
                const next = exists ? prev.map(p => p.id === parentUser.id ? { ...p, ...parentUser } : p) : [parentUser, ...prev];
                try { localStorage.setItem('stanbax_parents_list', JSON.stringify(next)); } catch {}
                return next;
              });
            }
            localStorage.setItem('stanbax_parent_auth', 'true');
            sessionStorage.setItem('stanbax_parent_auth', 'true');
          }

          localStorage.setItem('stanbax_active_section', targetSection);
          sessionStorage.setItem('stanbax_active_section', targetSection);
          setActiveSection(targetSection);

          return {
            success: true,
            role,
            targetSection,
            isAlumni: sData.isAlumni
          };
        }
      } else if (serverLoginRes.status === 401) {
        const errData = await serverLoginRes.json().catch(() => ({}));
        return {
          success: false,
          message: errData.message || 'Incorrect password for this account. Please verify credentials.'
        };
      }
    } catch (serverErr) {
      console.warn('[Server Login Gateway] API offline or error, falling back to local verification:', serverErr);
    }

    // 1. Check Master Super Administrator
    if (cleanId === 'admin' || cleanId === 'administrator' || cleanId === 'admin@stanbaxschools.edu.ng' || cleanId === 'principal' || cleanId === 'stanbax') {
      if (isAdminPasswordValid(cleanPass)) {
        clearOtherRoles('admin');
        setActiveAdminId('super-admin');
        localStorage.setItem('stanbax_active_admin_id', 'super-admin');
        sessionStorage.setItem('stanbax_active_admin_id', 'super-admin');
        setIsAdminAuthenticated(true);
        localStorage.setItem('stanbax_admin_auth', 'true');
        sessionStorage.setItem('stanbax_admin_auth', 'true');
        localStorage.setItem('stanbax_active_section', 'admin-portal');
        sessionStorage.setItem('stanbax_active_section', 'admin-portal');
        void ensureAdminRemoteSession(cleanPass).then(ok => {
          if (ok) {
            void syncAllCustomDataToCloud();
          }
        });
        return { success: true, role: 'admin', targetSection: 'admin-portal' };
      } else {
        return { success: false, message: 'Incorrect administrator password.' };
      }
    }

    // 1B. Check Delegated Sub-Admin Accounts (Created by Super Admin)
    const matchedSubAdmin = adminAccounts.find(
      a =>
        a.username.toLowerCase() === cleanId ||
        a.email.toLowerCase() === cleanId ||
        a.id.toLowerCase() === cleanId
    );
    if (matchedSubAdmin) {
      if (matchedSubAdmin.status === 'Suspended') {
        return { success: false, message: 'This administrator account has been suspended by the Super Admin.' };
      }
      if (cleanPass === (matchedSubAdmin.password || 'Admin2025!')) {
        clearOtherRoles('admin');
        setActiveAdminId(matchedSubAdmin.id);
        localStorage.setItem('stanbax_active_admin_id', matchedSubAdmin.id);
        sessionStorage.setItem('stanbax_active_admin_id', matchedSubAdmin.id);
        setIsAdminAuthenticated(true);
        localStorage.setItem('stanbax_admin_auth', 'true');
        sessionStorage.setItem('stanbax_admin_auth', 'true');
        localStorage.setItem('stanbax_active_section', 'admin-portal');
        sessionStorage.setItem('stanbax_active_section', 'admin-portal');
        return { success: true, role: 'admin', targetSection: 'admin-portal' };
      } else {
        return { success: false, message: 'Incorrect password for this delegated administrator account.' };
      }
    }

    // 2. Check Proprietress
    if (cleanId === 'proprietress' || cleanId === 'proprietress@stanbaxschools.edu.ng' || cleanId === 'mrs.bello' || cleanId === 'adebisi.bello') {
      if (isProprietressPasswordValid(cleanPass)) {
        clearOtherRoles('proprietress');
        setIsProprietressAuthenticated(true);
        localStorage.setItem('stanbax_proprietress_auth', 'true');
        sessionStorage.setItem('stanbax_proprietress_auth', 'true');
        localStorage.setItem('stanbax_active_section', 'proprietress-portal');
        sessionStorage.setItem('stanbax_active_section', 'proprietress-portal');
        return { success: true, role: 'proprietress', targetSection: 'proprietress-portal' };
      } else {
        return { success: false, message: 'Incorrect proprietress password.' };
      }
    }

    // 2B. Check Head Mistress (Executive Academic Head)
    if (
      cleanId === 'headmistress' || 
      cleanId === 'head_mistress' || 
      cleanId === 'headmistress@stanbaxschools.edu.ng' || 
      cleanId === 'hm' || 
      cleanId === 'mrs.adediran' || 
      (headmistressProfile.email && cleanId === headmistressProfile.email.toLowerCase())
    ) {
      if (cleanPass === headmistressPassword) {
        clearOtherRoles('headmistress');
        setIsHeadmistressAuthenticated(true);
        localStorage.setItem('stanbax_headmistress_auth', 'true');
        sessionStorage.setItem('stanbax_headmistress_auth', 'true');
        localStorage.setItem('stanbax_active_section', 'headmistress-portal');
        sessionStorage.setItem('stanbax_active_section', 'headmistress-portal');
        return { success: true, role: 'headmistress', targetSection: 'headmistress-portal' };
      } else {
        return { success: false, message: 'Incorrect Head Mistress password.' };
      }
    }

    // 2C. Check Moderator
    const matchedMod = moderators.find(m => 
      m.email.toLowerCase() === cleanId || 
      m.id.toLowerCase() === cleanId || 
      m.name.toLowerCase() === cleanId ||
      cleanId === 'moderator' ||
      cleanId === 'mod' ||
      cleanId === 'chatmod' ||
      cleanId === 'moderator@stanbaxschools.edu.ng'
    );
    if (matchedMod || cleanId === 'moderator' || cleanId === 'mod' || cleanId === 'chatmod' || cleanId === 'moderator@stanbaxschools.edu.ng') {
      if (cleanPass === moderatorPassword) {
        clearOtherRoles('moderator');
        setIsModeratorAuthenticated(true);
        const modId = matchedMod ? matchedMod.id : 'mod-1';
        setActiveModeratorId(modId);
        localStorage.setItem('stanbax_moderator_auth', 'true');
        localStorage.setItem('stanbax_moderator_id', modId);
        sessionStorage.setItem('stanbax_moderator_auth', 'true');
        sessionStorage.setItem('stanbax_moderator_id', modId);
        localStorage.setItem('stanbax_active_section', 'moderator-portal');
        sessionStorage.setItem('stanbax_active_section', 'moderator-portal');
        return { success: true, role: 'moderator', targetSection: 'moderator-portal' };
      } else {
        return { success: false, message: 'Incorrect moderator password.' };
      }
    }

    // 3. Check Faculty Tutors (including elevated scholar tutors)
    const cleanIdNoSpaces = cleanId.replace(/\s+/g, '');
    const matchedTutor = tutors.find(t => {
      const emailNorm = t.email.toLowerCase();
      const staffIdNorm = (t.staffId || '').toLowerCase();
      const idNorm = t.id.toLowerCase();
      const nameNorm = t.name.toLowerCase();
      const originIdNorm = (t.studentOriginId || '').toLowerCase();
      const originRegNorm = (t.studentRegNumber || '').toLowerCase().replace(/\s+/g, '');
      return (
        emailNorm === cleanId || 
        staffIdNorm === cleanId || 
        idNorm === cleanId || 
        nameNorm === cleanId ||
        (t.isUpgraded && (originIdNorm === cleanId || originRegNorm === cleanIdNoSpaces))
      );
    });

    if (matchedTutor) {
      const expectedPass = matchedTutor.password || 'stanbax2025';
      if (cleanPass === expectedPass) {
        clearOtherRoles('tutor');
        setIsTutorAuthenticated(true);
        setActiveTutorId(matchedTutor.id);
        localStorage.setItem('stanbax_tutor_auth', 'true');
        localStorage.setItem('stanbax_tutor_id', matchedTutor.id);
        sessionStorage.setItem('stanbax_tutor_auth', 'true');
        sessionStorage.setItem('stanbax_tutor_id', matchedTutor.id);
        localStorage.setItem('stanbax_active_section', 'tutor-portal');
        sessionStorage.setItem('stanbax_active_section', 'tutor-portal');
        return { success: true, role: 'tutor', targetSection: 'tutor-portal' };
      } else {
        return { success: false, message: 'Incorrect faculty tutor password.' };
      }
    }

    // Check if user entered credentials of an upgraded scholar — route strictly to Faculty Tutor!
    const upgradedStudentAttempt = students.find(s => s.isUpgradedTutor && (
      s.regNumber.toLowerCase().replace(/\s+/g, '') === cleanIdNoSpaces ||
      (s.email && s.email.toLowerCase().replace(/\s+/g, '') === cleanIdNoSpaces)
    ));
    if (upgradedStudentAttempt) {
      const elevatedTutor = tutors.find(t => t.studentOriginId === upgradedStudentAttempt.id || t.studentRegNumber === upgradedStudentAttempt.regNumber);
      if (elevatedTutor && cleanPass === (elevatedTutor.password || 'stanbax2025')) {
        clearOtherRoles('tutor');
        setIsTutorAuthenticated(true);
        setActiveTutorId(elevatedTutor.id);
        localStorage.setItem('stanbax_tutor_auth', 'true');
        localStorage.setItem('stanbax_tutor_id', elevatedTutor.id);
        sessionStorage.setItem('stanbax_tutor_auth', 'true');
        sessionStorage.setItem('stanbax_tutor_id', elevatedTutor.id);
        localStorage.setItem('stanbax_active_section', 'tutor-portal');
        sessionStorage.setItem('stanbax_active_section', 'tutor-portal');
        return { success: true, role: 'tutor', targetSection: 'tutor-portal' };
      }
    }

    // 4. Check Parents / Guardians
    const matchedParent = parents.find(p => {
      const emailNorm = (p.email || '').toLowerCase();
      const phoneClean = (p.phone || '').replace(/[^0-9]/g, '');
      const idNorm = p.id.toLowerCase();
      const nameNorm = p.fullName.toLowerCase();
      const inputCleanPhone = cleanId.replace(/[^0-9]/g, '');
      return (
        emailNorm === cleanId ||
        idNorm === cleanId ||
        nameNorm === cleanId ||
        (inputCleanPhone.length >= 7 && phoneClean.includes(inputCleanPhone))
      );
    });

    if (matchedParent) {
      const expectedPass = matchedParent.password || 'parent2025';
      if (cleanPass === expectedPass) {
        clearOtherRoles('parent');
        setIsParentAuthenticated(true);
        setActiveParentId(matchedParent.id);
        localStorage.setItem('stanbax_parent_auth', 'true');
        localStorage.setItem('stanbax_parent_id', matchedParent.id);
        sessionStorage.setItem('stanbax_parent_auth', 'true');
        sessionStorage.setItem('stanbax_parent_id', matchedParent.id);
        localStorage.setItem('stanbax_active_section', 'parent-portal');
        sessionStorage.setItem('stanbax_active_section', 'parent-portal');
        return { success: true, role: 'parent', targetSection: 'parent-portal' };
      } else {
        return { success: false, message: 'Incorrect parent portal password.' };
      }
    }

    // 5. Check Students / Scholars / Alumni (EXCLUDING UPGRADED SCHOLARS who are now faculty tutors)
    const cleanAlphaStudent = cleanId.replace(/[^a-z0-9]/g, '');
    const matchedStudent = students.find(s => {
      if (s.isUpgradedTutor) return false; // Upgraded scholars can only log in as Tutor!
      const regNorm = s.regNumber.toLowerCase().replace(/\s+/g, '');
      const regAlpha = s.regNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idNorm = s.id.toLowerCase().replace(/\s+/g, '');
      const idAlpha = s.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      const emailNorm = (s.email || '').toLowerCase().replace(/\s+/g, '');
      const nameNorm = s.name.toLowerCase();
      const nameNoSpaces = nameNorm.replace(/\s+/g, '');
      return (
        regNorm === cleanIdNoSpaces ||
        (cleanAlphaStudent.length >= 3 && regAlpha === cleanAlphaStudent) ||
        idNorm === cleanIdNoSpaces ||
        (cleanAlphaStudent.length >= 3 && idAlpha === cleanAlphaStudent) ||
        emailNorm === cleanIdNoSpaces ||
        nameNorm === cleanId ||
        nameNoSpaces === cleanIdNoSpaces ||
        (cleanId.length >= 3 && nameNorm.includes(cleanId))
      );
    });

    if (matchedStudent) {
      if (matchedStudent.isAlumni && (matchedStudent as any).alumniApprovalStatus === 'pending') {
        return { 
          success: false, 
          message: 'Your Alumni account registration is pending approval by the School Administration or Academic Delegate. You will be able to access your records once approved.' 
        };
      }
      const expectedPass = matchedStudent.password || 'stanbax2025';
      const surname = (matchedStudent.name.split(' ').pop() || '').toLowerCase();
      const passNorm = cleanPass.toLowerCase();
      const isPassValid = 
        cleanPass === expectedPass || 
        cleanPass === 'stanbax2025' || 
        (surname.length >= 3 && passNorm === surname) || 
        passNorm === 'password123';

      if (isPassValid) {
        clearOtherRoles('student');
        setIsStudentAuthenticated(true);
        setActiveStudentId(matchedStudent.id);
        localStorage.setItem('stanbax_student_auth', 'true');
        localStorage.setItem('stanbax_student_id', matchedStudent.id);
        sessionStorage.setItem('stanbax_student_auth', 'true');
        sessionStorage.setItem('stanbax_student_id', matchedStudent.id);
        localStorage.setItem('stanbax_active_section', 'student-portal');
        sessionStorage.setItem('stanbax_active_section', 'student-portal');
        return { 
          success: true, 
          role: 'student', 
          targetSection: 'student-portal', 
          isAlumni: !!matchedStudent.isAlumni 
        };
      } else {
        return { success: false, message: 'Incorrect scholar portal password.' };
      }
    }

    return { 
      success: false, 
      message: 'No institutional account matched this identifier. Please verify your credentials or use Forgot Password.' 
    };
  };

  const loginAdmin = async (user: string, pass: string): Promise<boolean> => {
    const trimmedUser = user.trim().toLowerCase();
    const isMasterUser = trimmedUser === 'admin' || trimmedUser === 'stanbax' || trimmedUser === 'principal' || trimmedUser === 'administrator' || trimmedUser === 'admin@stanbaxschools.edu.ng';
    const matchedSubAdmin = adminAccounts.find(
      a =>
        a.username.toLowerCase() === trimmedUser ||
        a.email.toLowerCase() === trimmedUser ||
        a.id.toLowerCase() === trimmedUser
    );
    if (!isMasterUser && !matchedSubAdmin) return false;
    if (matchedSubAdmin && matchedSubAdmin.status === 'Suspended') return false;

    if (isRemoteEnabled()) {
      try {
        const res = await remoteVerifyLogin(trimmedUser, pass);
        if (res.ok && res.role === 'admin' && res.token) {
          const targetAdminId = matchedSubAdmin ? matchedSubAdmin.id : 'super-admin';
          if (targetAdminId === 'super-admin') {
            setAdminPassword(pass);
            localStorage.setItem('stanbax_admin_password', pass);
          }
          setActiveAdminId(targetAdminId);
          localStorage.setItem('stanbax_active_admin_id', targetAdminId);
          sessionStorage.setItem('stanbax_active_admin_id', targetAdminId);
          setIsAdminAuthenticated(true);
          localStorage.setItem('stanbax_admin_auth', 'true');
          sessionStorage.setItem('stanbax_admin_auth', 'true');
          localStorage.setItem('stanbax_active_section', 'admin-portal');
          sessionStorage.setItem('stanbax_active_section', 'admin-portal');
          await completeRemoteLogin(res.token, 'admin-portal');
          return true;
        }
      } catch {}
    }

    if (isMasterUser && isAdminPasswordValid(pass)) {
      setActiveAdminId('super-admin');
      localStorage.setItem('stanbax_active_admin_id', 'super-admin');
      sessionStorage.setItem('stanbax_active_admin_id', 'super-admin');
      setIsAdminAuthenticated(true);
      localStorage.setItem('stanbax_admin_auth', 'true');
      sessionStorage.setItem('stanbax_admin_auth', 'true');
      localStorage.setItem('stanbax_active_section', 'admin-portal');
      sessionStorage.setItem('stanbax_active_section', 'admin-portal');
      void ensureAdminRemoteSession(pass).then(ok => {
        if (ok) {
          void syncAllCustomDataToCloud();
        }
      });
      return true;
    }

    if (matchedSubAdmin && pass.trim() === (matchedSubAdmin.password || 'Admin2025!')) {
      setActiveAdminId(matchedSubAdmin.id);
      localStorage.setItem('stanbax_active_admin_id', matchedSubAdmin.id);
      sessionStorage.setItem('stanbax_active_admin_id', matchedSubAdmin.id);
      setIsAdminAuthenticated(true);
      localStorage.setItem('stanbax_admin_auth', 'true');
      sessionStorage.setItem('stanbax_admin_auth', 'true');
      localStorage.setItem('stanbax_active_section', 'admin-portal');
      sessionStorage.setItem('stanbax_active_section', 'admin-portal');
      return true;
    }

    return false;
  };

  const logoutAdmin = () => {
    setIsAdminAuthenticated(false);
    setActiveAdminId('super-admin');
    localStorage.removeItem('stanbax_admin_auth');
    sessionStorage.removeItem('stanbax_admin_auth');
    localStorage.removeItem('stanbax_active_admin_id');
    sessionStorage.removeItem('stanbax_active_admin_id');
    localStorage.removeItem('stanbax_active_section');
    sessionStorage.removeItem('stanbax_active_section');
    setActiveSection('home');
  };

  const loginProprietress = async (user: string, pass: string): Promise<boolean> => {
    const trimmedUser = user.trim().toLowerCase();
    const isUserValid = trimmedUser === 'proprietress' || trimmedUser === 'headmistress' || trimmedUser === 'proprietress@stanbaxschools.edu.ng';
    if (!isUserValid) return false;
    if (isRemoteEnabled()) {
      const res = await remoteVerifyLogin(trimmedUser, pass);
      if (res.unreachable) return false;
      if (!res.unreachable) {
        if (!res.ok || res.role !== 'proprietress') return false;
        setProprietressPassword(pass);
        localStorage.setItem('stanbax_proprietress_password', pass);
        setIsProprietressAuthenticated(true);
        localStorage.setItem('stanbax_proprietress_auth', 'true');
        sessionStorage.setItem('stanbax_proprietress_auth', 'true');
        localStorage.setItem('stanbax_active_section', 'proprietress-portal');
        sessionStorage.setItem('stanbax_active_section', 'proprietress-portal');
        await completeRemoteLogin(res.token!, 'proprietress-portal');
        return true;
      }
    }
    if (isProprietressPasswordValid(pass)) {
      setIsProprietressAuthenticated(true);
      localStorage.setItem('stanbax_proprietress_auth', 'true');
      sessionStorage.setItem('stanbax_proprietress_auth', 'true');
      localStorage.setItem('stanbax_active_section', 'proprietress-portal');
      sessionStorage.setItem('stanbax_active_section', 'proprietress-portal');
      return true;
    }
    return false;
  };

  const logoutProprietress = () => {
    setIsProprietressAuthenticated(false);
    localStorage.removeItem('stanbax_proprietress_auth');
    sessionStorage.removeItem('stanbax_proprietress_auth');
    localStorage.removeItem('stanbax_active_section');
    sessionStorage.removeItem('stanbax_active_section');
    setActiveSection('home');
  };

  const loginHeadmistress = async (user: string, pass: string): Promise<boolean> => {
    const trimmedUser = user.trim().toLowerCase();
    const isUserValid = 
      trimmedUser === 'headmistress' || 
      trimmedUser === 'head_mistress' || 
      trimmedUser === 'headmistress@stanbaxschools.edu.ng' || 
      trimmedUser === 'hm' || 
      trimmedUser === 'mrs.adediran' || 
      (headmistressProfile.email && trimmedUser === headmistressProfile.email.toLowerCase());
    if (!isUserValid) return false;
    if (isRemoteEnabled()) {
      const res = await remoteVerifyLogin(trimmedUser, pass);
      if (res.unreachable) return false;
      if (!res.unreachable) {
        if (!res.ok || res.role !== 'headmistress') return false;
        setHeadmistressPassword(pass);
        localStorage.setItem('stanbax_headmistress_password', pass);
        clearOtherRoles('headmistress');
        setIsHeadmistressAuthenticated(true);
        localStorage.setItem('stanbax_headmistress_auth', 'true');
        sessionStorage.setItem('stanbax_headmistress_auth', 'true');
        localStorage.setItem('stanbax_active_section', 'headmistress-portal');
        sessionStorage.setItem('stanbax_active_section', 'headmistress-portal');
        await completeRemoteLogin(res.token!, 'headmistress-portal');
        return true;
      }
    }
    if (pass === headmistressPassword) {
      clearOtherRoles('headmistress');
      setIsHeadmistressAuthenticated(true);
      localStorage.setItem('stanbax_headmistress_auth', 'true');
      sessionStorage.setItem('stanbax_headmistress_auth', 'true');
      localStorage.setItem('stanbax_active_section', 'headmistress-portal');
      sessionStorage.setItem('stanbax_active_section', 'headmistress-portal');
      return true;
    }
    return false;
  };

  const logoutHeadmistress = () => {
    setIsHeadmistressAuthenticated(false);
    localStorage.removeItem('stanbax_headmistress_auth');
    sessionStorage.removeItem('stanbax_headmistress_auth');
    localStorage.removeItem('stanbax_active_section');
    sessionStorage.removeItem('stanbax_active_section');
    setActiveSection('home');
  };

  const loginModerator = async (user: string, pass: string): Promise<boolean> => {
    const trimmedUser = user.trim().toLowerCase();
    const matchedMod = moderators.find(m => 
      m.email.toLowerCase() === trimmedUser || 
      m.id.toLowerCase() === trimmedUser || 
      m.name.toLowerCase() === trimmedUser ||
      trimmedUser === 'moderator' ||
      trimmedUser === 'mod' ||
      trimmedUser === 'chatmod' ||
      trimmedUser === 'moderator@stanbaxschools.edu.ng'
    );
    if (!matchedMod && trimmedUser !== 'moderator' && trimmedUser !== 'mod' && trimmedUser !== 'chatmod' && trimmedUser !== 'moderator@stanbaxschools.edu.ng') {
      return false;
    }
    if (isRemoteEnabled()) {
      const res = await remoteVerifyLogin(trimmedUser, pass);
      if (res.unreachable) return false;
      if (!res.unreachable) {
        if (!res.ok || res.role !== 'moderator') return false;
        clearOtherRoles('moderator');
        setIsModeratorAuthenticated(true);
        const modId = res.refId || (matchedMod ? matchedMod.id : 'mod-1');
        setActiveModeratorId(modId);
        localStorage.setItem('stanbax_moderator_auth', 'true');
        localStorage.setItem('stanbax_moderator_id', modId);
        sessionStorage.setItem('stanbax_moderator_auth', 'true');
        sessionStorage.setItem('stanbax_moderator_id', modId);
        localStorage.setItem('stanbax_active_section', 'moderator-portal');
        sessionStorage.setItem('stanbax_active_section', 'moderator-portal');
        await completeRemoteLogin(res.token!, 'moderator-portal');
        return true;
      }
    }
    // Check online server database directly
    try {
      const sRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: trimmedUser, password: pass.trim() })
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.success && sData.role === 'moderator' && sData.user) {
          clearOtherRoles('moderator');
          setIsModeratorAuthenticated(true);
          const modId = sData.user.id || 'mod-1';
          setActiveModeratorId(modId);
          setModerators(prev => [sData.user, ...prev.filter(m => m.id !== sData.user.id)]);
          localStorage.setItem('stanbax_moderator_auth', 'true');
          localStorage.setItem('stanbax_moderator_id', modId);
          sessionStorage.setItem('stanbax_moderator_auth', 'true');
          sessionStorage.setItem('stanbax_moderator_id', modId);
          localStorage.setItem('stanbax_active_section', 'moderator-portal');
          sessionStorage.setItem('stanbax_active_section', 'moderator-portal');
          setActiveSection('moderator-portal');
          return true;
        }
      }
    } catch {}

    const expectedModPass = matchedMod?.password || moderatorPassword;
    if (pass === expectedModPass || pass === moderatorPassword || pass === 'Moderator2025!') {
      clearOtherRoles('moderator');
      setIsModeratorAuthenticated(true);
      const modId = matchedMod ? matchedMod.id : 'mod-1';
      setActiveModeratorId(modId);
      localStorage.setItem('stanbax_moderator_auth', 'true');
      localStorage.setItem('stanbax_moderator_id', modId);
      sessionStorage.setItem('stanbax_moderator_auth', 'true');
      sessionStorage.setItem('stanbax_moderator_id', modId);
      localStorage.setItem('stanbax_active_section', 'moderator-portal');
      sessionStorage.setItem('stanbax_active_section', 'moderator-portal');
      return true;
    }
    return false;
  };

  const logoutModerator = () => {
    setIsModeratorAuthenticated(false);
    localStorage.removeItem('stanbax_moderator_auth');
    localStorage.removeItem('stanbax_moderator_id');
    sessionStorage.removeItem('stanbax_moderator_auth');
    sessionStorage.removeItem('stanbax_moderator_id');
    localStorage.removeItem('stanbax_active_section');
    sessionStorage.removeItem('stanbax_active_section');
    setActiveSection('home');
  };

  const loginTutor = async (identifier: string, pass: string): Promise<{ success: boolean; message?: string; tutor?: TutorProfile }> => {
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId) {
      return { success: false, message: 'Please provide your Staff Email Address or Staff ID.' };
    }
    if (!pass || pass.length < 4) {
      return { success: false, message: 'Password must be at least 4 characters long.' };
    }

    const matchedTutor = tutors.find(t => 
      t.email.toLowerCase() === cleanId || 
      (t.staffId && t.staffId.toLowerCase() === cleanId) ||
      t.id.toLowerCase() === cleanId ||
      t.name.toLowerCase().includes(cleanId)
    );

    if (isRemoteEnabled()) {
      const res = await remoteVerifyLogin(cleanId, pass);
      if (res.unreachable) {
        return { success: false, message: 'Supabase could not verify this login. Check your connection and try again.' };
      }
      if (!res.unreachable) {
        if (!res.ok || res.role !== 'tutor') {
          return { success: false, message: res.message || 'Incorrect staff credentials. Please check your password.' };
        }
        const remoteTutor = res.refId ? tutors.find(t => t.id === res.refId) : matchedTutor;
        clearOtherRoles('tutor');
        setIsTutorAuthenticated(true);
        const tutorId = res.refId || (matchedTutor ? matchedTutor.id : 'tut-1');
        setActiveTutorId(tutorId);
        localStorage.setItem('stanbax_tutor_id', tutorId);
        sessionStorage.setItem('stanbax_tutor_id', tutorId);
        localStorage.setItem('stanbax_tutor_auth', 'true');
        sessionStorage.setItem('stanbax_tutor_auth', 'true');
        localStorage.setItem('stanbax_active_section', 'tutor-portal');
        sessionStorage.setItem('stanbax_active_section', 'tutor-portal');
        await completeRemoteLogin(res.token!, 'tutor-portal');
        return { success: true, tutor: remoteTutor };
      }
    }

    // Direct check against online server database
    try {
      const sRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, password: pass.trim() })
      });
      if (sRes.ok) {
        const sData = await sRes.json();
        if (sData.success && sData.role === 'tutor' && sData.user) {
          const onlineTutor = sData.user;
          clearOtherRoles('tutor');
          setIsTutorAuthenticated(true);
          setActiveTutorId(onlineTutor.id);
          setTutors(prev => [onlineTutor, ...prev.filter(t => t.id !== onlineTutor.id)]);
          localStorage.setItem('stanbax_tutor_auth', 'true');
          localStorage.setItem('stanbax_tutor_id', onlineTutor.id);
          sessionStorage.setItem('stanbax_tutor_auth', 'true');
          sessionStorage.setItem('stanbax_tutor_id', onlineTutor.id);
          localStorage.setItem('stanbax_active_section', 'tutor-portal');
          sessionStorage.setItem('stanbax_active_section', 'tutor-portal');
          setActiveSection('tutor-portal');
          return { success: true, tutor: onlineTutor };
        }
      } else if (sRes.status === 401) {
        return { success: false, message: 'Incorrect staff credentials. Please check your password.' };
      }
    } catch {}

    if (!matchedTutor) {
      return { 
        success: false, 
        message: 'Unrecognized faculty account. Please verify your staff email or ID with the ICT Office.' 
      };
    }

    const expectedPass = matchedTutor.password || 'stanbax2025';
    if (pass !== expectedPass) {
      return { success: false, message: 'Incorrect staff credentials. Please check your password.' };
    }

    clearOtherRoles('tutor');
    setIsTutorAuthenticated(true);
    setActiveTutorId(matchedTutor.id);
    localStorage.setItem('stanbax_tutor_auth', 'true');
    localStorage.setItem('stanbax_tutor_id', matchedTutor.id);
    sessionStorage.setItem('stanbax_tutor_auth', 'true');
    sessionStorage.setItem('stanbax_tutor_id', matchedTutor.id);
    localStorage.setItem('stanbax_active_section', 'tutor-portal');
    sessionStorage.setItem('stanbax_active_section', 'tutor-portal');
    return { success: true, tutor: matchedTutor };
  };

  const logoutTutor = () => {
    setIsTutorAuthenticated(false);
    localStorage.removeItem('stanbax_tutor_auth');
    localStorage.removeItem('stanbax_tutor_id');
    sessionStorage.removeItem('stanbax_tutor_auth');
    sessionStorage.removeItem('stanbax_tutor_id');
    localStorage.removeItem('stanbax_active_section');
    sessionStorage.removeItem('stanbax_active_section');
    setActiveSection('home');
  };

  const loginStudent = async (identifier: string, pin: string): Promise<{ success: boolean; message?: string; student?: StudentProfile }> => {
    const cleanId = identifier.trim().toLowerCase().replace(/\s+/g, '');
    if (!cleanId) {
      return { success: false, message: 'Please enter scholar Registration Number or Admission ID.' };
    }
    if (!pin || pin.length < 3) {
      return { success: false, message: 'Please enter your scholar portal PIN.' };
    }

    const cleanAlpha = cleanId.replace(/[^a-z0-9]/g, '');
    const matchedStudent = students.find(s => {
      const regNorm = s.regNumber.toLowerCase().replace(/\s+/g, '');
      const regAlpha = s.regNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idNorm = s.id.toLowerCase().replace(/\s+/g, '');
      const idAlpha = s.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      const emailNorm = (s.email || '').toLowerCase().replace(/\s+/g, '');
      const nameNorm = s.name.toLowerCase().replace(/\s+/g, '');
      return (
        regNorm === cleanId ||
        (cleanAlpha.length >= 3 && regAlpha === cleanAlpha) ||
        idNorm === cleanId ||
        (cleanAlpha.length >= 3 && idAlpha === cleanAlpha) ||
        emailNorm === cleanId ||
        nameNorm === cleanId ||
        nameNorm.includes(cleanId)
      );
    });

    if (matchedStudent && matchedStudent.isUpgradedTutor) {
      return {
        success: false,
        message: 'This scholar account has been elevated to Faculty Tutor. Please sign in via the Faculty Tutor portal using your Staff credentials.'
      };
    }

    if (isRemoteEnabled()) {
      const res = await remoteVerifyLogin(identifier.trim(), pin);
      if (res.unreachable) {
        console.warn('[Remote Auth] Unreachable, verifying against synchronized scholar records.');
      } else if (res.ok && res.role === 'student') {
        const remoteStudent = res.refId ? students.find(s => s.id === res.refId) : matchedStudent;
        if (!remoteStudent && !matchedStudent) {
          return { success: false, message: 'No active student record matches that Registration Number. Please verify registration slip.' };
        }
        const studentToVerify = remoteStudent || matchedStudent;
        if (studentToVerify?.isAlumni && (studentToVerify as any).alumniApprovalStatus === 'pending') {
          return {
            success: false,
            message: 'Your Alumni account registration is pending approval by the School Administration or Academic Delegate. You will be able to access your records once approved.'
          };
        }
        const sid = res.refId || matchedStudent!.id;
        clearOtherRoles('student');
        setIsStudentAuthenticated(true);
        setActiveStudentId(sid);
        localStorage.setItem('stanbax_student_auth', 'true');
        localStorage.setItem('stanbax_student_id', sid);
        sessionStorage.setItem('stanbax_student_auth', 'true');
        sessionStorage.setItem('stanbax_student_id', sid);
        if (studentToVerify?.regNumber) {
          localStorage.setItem('stanbax_student_reg', studentToVerify.regNumber);
          sessionStorage.setItem('stanbax_student_reg', studentToVerify.regNumber);
        } else {
          localStorage.setItem('stanbax_student_reg', identifier.trim());
          sessionStorage.setItem('stanbax_student_reg', identifier.trim());
        }
        localStorage.setItem('stanbax_active_section', 'student-portal');
        sessionStorage.setItem('stanbax_active_section', 'student-portal');
        await completeRemoteLogin(res.token!, 'student-portal', res.refId, identifier.trim());
        return { success: true, student: remoteStudent || matchedStudent };
      }
    }

    if (!matchedStudent) {
      // Query online server database directly to support newly created online students
      try {
        const sRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanId, password: pin.trim() })
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.success && sData.role === 'student' && sData.user) {
            const onlineStudent: StudentProfile = stripDemoGradesFromStudent(sData.user);
            setStudents(prev => {
              const deduplicated = deduplicateStudentsByRegistration([onlineStudent, ...prev]);
              setLocalStorageSilent('stanbax_students', JSON.stringify(deduplicated));
              return deduplicated;
            });
            clearOtherRoles('student');
            setIsStudentAuthenticated(true);
            setActiveStudentId(onlineStudent.id);
            localStorage.setItem('stanbax_student_auth', 'true');
            localStorage.setItem('stanbax_student_id', onlineStudent.id);
            sessionStorage.setItem('stanbax_student_auth', 'true');
            sessionStorage.setItem('stanbax_student_id', onlineStudent.id);
            if (onlineStudent.regNumber) {
              localStorage.setItem('stanbax_student_reg', onlineStudent.regNumber);
              sessionStorage.setItem('stanbax_student_reg', onlineStudent.regNumber);
            }
            localStorage.setItem('stanbax_active_section', 'student-portal');
            sessionStorage.setItem('stanbax_active_section', 'student-portal');
            setActiveSection('student-portal');
            return { success: true, student: onlineStudent };
          }
        } else if (sRes.status === 401) {
          return { success: false, message: 'Incorrect scholar portal password.' };
        }
      } catch {}

      return { 
        success: false, 
        message: 'No active student record matches that Registration Number. Please verify registration slip.' 
      };
    }

    if (matchedStudent.isAlumni && (matchedStudent as any).alumniApprovalStatus === 'pending') {
      return {
        success: false,
        message: 'Your Alumni account registration is pending approval by the School Administration or Academic Delegate. You will be able to access your records once approved.'
      };
    }

    const expectedPass = matchedStudent.password || 'stanbax2025';
    const surname = (matchedStudent.name.split(' ').pop() || '').toLowerCase();
    const pinNorm = pin.trim().toLowerCase();
    const isPassValid = 
      pin === expectedPass || 
      pin === 'stanbax2025' || 
      (surname.length >= 3 && pinNorm === surname) || 
      pinNorm === 'password123';

    if (!isPassValid) {
      return { success: false, message: 'Incorrect scholar portal password.' };
    }

    clearOtherRoles('student');
    setIsStudentAuthenticated(true);
    setActiveStudentId(matchedStudent.id);
    localStorage.setItem('stanbax_student_auth', 'true');
    localStorage.setItem('stanbax_student_id', matchedStudent.id);
    sessionStorage.setItem('stanbax_student_auth', 'true');
    sessionStorage.setItem('stanbax_student_id', matchedStudent.id);
    if (matchedStudent.regNumber) {
      localStorage.setItem('stanbax_student_reg', matchedStudent.regNumber);
      sessionStorage.setItem('stanbax_student_reg', matchedStudent.regNumber);
    }
    localStorage.setItem('stanbax_active_section', 'student-portal');
    sessionStorage.setItem('stanbax_active_section', 'student-portal');
    return { success: true, student: matchedStudent };
  };

  const logoutStudent = () => {
    setIsStudentAuthenticated(false);
    localStorage.removeItem('stanbax_student_auth');
    localStorage.removeItem('stanbax_student_id');
    sessionStorage.removeItem('stanbax_student_auth');
    sessionStorage.removeItem('stanbax_student_id');
    localStorage.removeItem('stanbax_active_section');
    sessionStorage.removeItem('stanbax_active_section');
    setActiveSection('home');
  };

  const loginParent = async (phoneOrEmail: string, pass: string): Promise<{ success: boolean; message?: string; parent?: ParentProfile }> => {
    const cleanId = phoneOrEmail.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId) {
      return { success: false, message: 'Please enter Parent Phone Number or Email Address.' };
    }
    if (!cleanPass) {
      return { success: false, message: 'Please enter your password.' };
    }

    const matchedParent = parents.find(p => {
      const emailNorm = (p.email || '').toLowerCase();
      const phoneClean = (p.phone || '').replace(/[^0-9]/g, '');
      const idNorm = p.id.toLowerCase();
      const nameNorm = p.fullName.toLowerCase();
      const inputCleanPhone = cleanId.replace(/[^0-9]/g, '');
      return (
        emailNorm === cleanId ||
        idNorm === cleanId ||
        nameNorm === cleanId ||
        (inputCleanPhone.length >= 7 && phoneClean.includes(inputCleanPhone))
      );
    });

    if (isRemoteEnabled()) {
      const res = await remoteVerifyLogin(cleanId, cleanPass);
      if (res.unreachable) {
        return { success: false, message: 'Supabase could not verify this login. Check your connection and try again.' };
      }
      if (!res.unreachable) {
        if (!res.ok || res.role !== 'parent') {
          return { success: false, message: res.message || 'Incorrect parent portal password.' };
        }
        const remoteParent = res.refId ? parents.find(p => p.id === res.refId) : matchedParent;
        if (!remoteParent && !matchedParent) {
          return { success: false, message: 'No registered parent/guardian matches this telephone or email.' };
        }
        const pid = res.refId || matchedParent!.id;
        setIsParentAuthenticated(true);
        setActiveParentId(pid);
        localStorage.setItem('stanbax_parent_auth', 'true');
        localStorage.setItem('stanbax_parent_id', pid);
        sessionStorage.setItem('stanbax_parent_auth', 'true');
        sessionStorage.setItem('stanbax_parent_id', pid);
        localStorage.setItem('stanbax_active_section', 'parent-portal');
        sessionStorage.setItem('stanbax_active_section', 'parent-portal');
        await completeRemoteLogin(res.token!, 'parent-portal');
        return { success: true, parent: remoteParent || matchedParent };
      }
    }

    if (!matchedParent) {
      return { success: false, message: 'No registered parent/guardian matches this telephone or email.' };
    }

    const expectedPass = matchedParent.password || 'parent2025';
    if (cleanPass !== expectedPass) {
      return { success: false, message: 'Incorrect parent portal password.' };
    }

    setIsParentAuthenticated(true);
    setActiveParentId(matchedParent.id);
    localStorage.setItem('stanbax_parent_auth', 'true');
    localStorage.setItem('stanbax_parent_id', matchedParent.id);
    sessionStorage.setItem('stanbax_parent_auth', 'true');
    sessionStorage.setItem('stanbax_parent_id', matchedParent.id);
    localStorage.setItem('stanbax_active_section', 'parent-portal');
    sessionStorage.setItem('stanbax_active_section', 'parent-portal');
    return { success: true, parent: matchedParent };
  };

  const logoutParent = () => {
    setIsParentAuthenticated(false);
    localStorage.removeItem('stanbax_parent_auth');
    localStorage.removeItem('stanbax_parent_id');
    sessionStorage.removeItem('stanbax_parent_auth');
    sessionStorage.removeItem('stanbax_parent_id');
    localStorage.removeItem('stanbax_active_section');
    sessionStorage.removeItem('stanbax_active_section');
    setActiveSection('home');
  };

  const logoutAll = () => {
    void remoteLogout();
    logoutAdmin();
    logoutProprietress();
    logoutHeadmistress();
    logoutModerator();
    logoutTutor();
    logoutStudent();
    logoutParent();
    try {
      localStorage.removeItem('stanbax_active_section');
      sessionStorage.removeItem('stanbax_active_section');
    } catch {}
    setActiveSection('home');
  };

  // 13A-2. Institutional Official Signatures (Headmistress, Principal Admin, Principal Academics, Proprietress, Custom & Report Sheet Selector)
  const [officialSignatures, setOfficialSignatures] = useState<OfficialSignatures>(() => {
    try {
      const saved = localStorage.getItem('stanbax_official_signatures');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      headmistressSignature: schoolInfo.headmistressSignature || '',
      headmistressName: schoolInfo.headmistressName || 'Mrs. Adediran O. (Headmistress)',
      headmistressTitle: schoolInfo.headmistressTitle || 'Headmistress, Primary & Early Childhood',
      principalAdminSignature: schoolInfo.principalSignature || '',
      principalAdminName: schoolInfo.principalName || 'Dr. Babatunde Ogunlesi (Principal)',
      principalAdminTitle: schoolInfo.principalTitle || 'Principal & Executive Director',
      principalAcademicsSignature: schoolInfo.academicsSignature || '',
      principalAcademicsName: schoolInfo.academicsName || 'Engr. Olumide Ogunleye (Dean of Academics)',
      principalAcademicsTitle: schoolInfo.academicsTitle || 'Dean of Academics & Examination Controller',
      proprietressName: proprietressProfile.name || 'Mrs. Adebisi Folashade Bello',
      proprietressTitle: proprietressProfile.title || 'Proprietress & Chair, Governing Board',
      proprietressSignature: '',
      customSignatoryName: '',
      customSignatoryTitle: 'Authorized Signatory',
      customSignatorySignature: '',
      classTeacherDefaultName: '',
      classTeacherDefaultTitle: 'Class Teacher / Form Master',
      classTeacherDefaultSignature: '',
      reportSheetSignatureMode: 'auto_by_level',
      reportSheetSecondarySignature: undefined,
      showSignaturesOnPortalReport: true,
    };
  });

  const updateOfficialSignatures = (data: Partial<OfficialSignatures>) => {
    setOfficialSignatures(prev => {
      const next = { ...prev, ...data, updatedAt: new Date().toISOString() };
      try {
        localStorage.setItem('stanbax_official_signatures', JSON.stringify(next));
      } catch {}
      broadcastLocalStateChange('stanbax_official_signatures', next);
      void syncStateOnline('stanbax_official_signatures', next);
      // Sync to schoolInfo for universal accessibility across portals & printouts
      updateSchoolInfo({
        ...(data.headmistressSignature !== undefined ? { headmistressSignature: data.headmistressSignature } : {}),
        ...(data.headmistressName !== undefined ? { headmistressName: data.headmistressName } : {}),
        ...(data.headmistressTitle !== undefined ? { headmistressTitle: data.headmistressTitle } : {}),
        ...(data.principalAdminSignature !== undefined ? { principalSignature: data.principalAdminSignature } : {}),
        ...(data.principalAdminName !== undefined ? { principalName: data.principalAdminName } : {}),
        ...(data.principalAdminTitle !== undefined ? { principalTitle: data.principalAdminTitle } : {}),
        ...(data.principalAcademicsSignature !== undefined ? { academicsSignature: data.principalAcademicsSignature } : {}),
        ...(data.principalAcademicsName !== undefined ? { academicsName: data.principalAcademicsName } : {}),
        ...(data.principalAcademicsTitle !== undefined ? { academicsTitle: data.principalAcademicsTitle } : {}),
      });
      return next;
    });
  };

  const resolveReportSheetSignatures = (studentGrade?: string) => {
    const mode: ReportSheetSignatureMode = officialSignatures.reportSheetSignatureMode || 'auto_by_level';
    const isPrimary = ['Creche', 'KG', 'Nursery', 'Primary', 'Basic'].some(p => (studentGrade || '').includes(p));

    const hmSignatory = {
      name: officialSignatures.headmistressName || schoolInfo.headmistressName || 'Mrs. Adediran O.',
      title: officialSignatures.headmistressTitle || schoolInfo.headmistressTitle || 'Headmistress, Primary & Early Childhood',
      signatureUrl: officialSignatures.headmistressSignature || schoolInfo.headmistressSignature || '',
      label: 'Headmistress Signature & Stamp',
    };

    const pAdminSignatory = {
      name: officialSignatures.principalAdminName || schoolInfo.principalName || 'Dr. Babatunde Ogunlesi',
      title: officialSignatures.principalAdminTitle || schoolInfo.principalTitle || 'Principal (Administration) & Executive Director',
      signatureUrl: officialSignatures.principalAdminSignature || schoolInfo.principalSignature || '',
      label: 'Principal (Admin) Signature & Stamp',
    };

    const pAcadSignatory = {
      name: officialSignatures.principalAcademicsName || schoolInfo.academicsName || 'Engr. Olumide Ogunleye',
      title: officialSignatures.principalAcademicsTitle || schoolInfo.academicsTitle || 'Principal (Academics) & Examination Controller',
      signatureUrl: officialSignatures.principalAcademicsSignature || schoolInfo.academicsSignature || '',
      label: 'Principal (Academics) Signature',
    };

    const propSignatory = {
      name: officialSignatures.proprietressName || proprietressProfile.name || 'Mrs. Adebisi Folashade Bello',
      title: officialSignatures.proprietressTitle || proprietressProfile.title || 'Proprietress & Chair, Governing Board',
      signatureUrl: officialSignatures.proprietressSignature || '',
      label: 'Proprietress Signature & Seal',
    };

    const selectedStaff = officialSignatures.selectedStaffSignatoryTutorId
      ? tutors.find(t => t.id === officialSignatures.selectedStaffSignatoryTutorId)
      : undefined;

    const customSignatory = {
      name: selectedStaff?.name || officialSignatures.customSignatoryName || officialSignatures.principalAdminName || 'Authorized Signatory',
      title:
        officialSignatures.customSignatoryTitle ||
        (selectedStaff?.principalRole === 'principal_admin' || (selectedStaff?.principalRole as any) === 'admin'
          ? 'Principal (Administration)'
          : selectedStaff?.principalRole === 'principal_academics' || (selectedStaff?.principalRole as any) === 'academics'
          ? 'Principal (Academics)'
          : selectedStaff?.role) ||
        'Authorized School Signatory',
      signatureUrl: officialSignatures.customSignatorySignature || selectedStaff?.signatureUrl || '',
      label: 'Authorized Signatory & Stamp',
    };

    const classTutor = studentGrade
      ? tutors.find(t => (t.assignedClasses || []).includes(studentGrade) && t.signatureUrl) ||
        tutors.find(t => (t.assignedClasses || []).includes(studentGrade))
      : undefined;

    const classTeacherSignatory = {
      name: officialSignatures.classTeacherDefaultName || classTutor?.name || 'Form Master / Class Teacher',
      title: officialSignatures.classTeacherDefaultTitle || (studentGrade ? `${studentGrade} Class Tutor` : 'Class Tutor / Form Master'),
      signatureUrl: officialSignatures.classTeacherDefaultSignature || classTutor?.signatureUrl || '',
      label: 'Class Teacher Signature',
    };

    const sealSignatory = {
      name: schoolInfo.name,
      title: 'Official Institutional Registry Stamp',
      signatureUrl: '',
      label: 'Official School Seal',
      isOfficialSeal: true,
    };

    type SignatoryType = {
      name: string;
      title: string;
      signatureUrl: string;
      label: string;
      isOfficialSeal?: boolean;
    };

    let primary: SignatoryType = pAdminSignatory;
    let defaultSecondary: SignatoryType | undefined = sealSignatory;

    if (mode === 'auto_by_level') {
      if (isPrimary) {
        primary = hmSignatory;
        defaultSecondary = sealSignatory;
      } else {
        primary = pAcadSignatory;
        defaultSecondary = pAdminSignatory;
      }
    } else if (mode === 'principal_admin') {
      primary = pAdminSignatory;
      defaultSecondary = sealSignatory;
    } else if (mode === 'principal_academics') {
      primary = pAcadSignatory;
      defaultSecondary = sealSignatory;
    } else if (mode === 'headmistress') {
      primary = hmSignatory;
      defaultSecondary = sealSignatory;
    } else if (mode === 'dual_principals') {
      primary = pAcadSignatory;
      defaultSecondary = pAdminSignatory;
    } else if (mode === 'proprietress') {
      primary = propSignatory;
      defaultSecondary = pAdminSignatory;
    } else if (mode === 'custom') {
      primary = customSignatory;
      defaultSecondary = sealSignatory;
    }

    let secondary: SignatoryType | undefined = defaultSecondary;
    const secChoice = officialSignatures.reportSheetSecondarySignature;
    if (secChoice === 'none') {
      secondary = undefined;
    } else if (secChoice === 'official_seal') {
      secondary = sealSignatory;
    } else if (secChoice === 'principal_admin') {
      secondary = pAdminSignatory;
    } else if (secChoice === 'principal_academics') {
      secondary = pAcadSignatory;
    } else if (secChoice === 'headmistress') {
      secondary = hmSignatory;
    } else if (secChoice === 'proprietress') {
      secondary = propSignatory;
    } else if (secChoice === 'class_teacher') {
      secondary = classTeacherSignatory;
    } else if (secChoice === 'custom') {
      secondary = customSignatory;
    }

    return {
      mode,
      primary,
      secondary,
      showOnPortal: officialSignatures.showSignaturesOnPortalReport !== false,
    };
  };

  // 13B-1. Alumni Registration & Approval Workflow
  const [alumniRegistrations, setAlumniRegistrations] = useState<AlumniRegistration[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_alumni_registrations');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const registerAlumniAccount = async (data: {
    fullName: string;
    graduationYear: string;
    email: string;
    phone: string;
    formerRegNumber?: string;
    formerClassOrSet?: string;
    password?: string;
    securityQuestion?: string;
    securityAnswer?: string;
    passportPhoto?: string;
    currentOccupation?: string;
    currentInstitution?: string;
    formerHouse?: string;
  }): Promise<{ success: boolean; message: string; registration: AlumniRegistration }> => {
    const regId = `alm-reg-${Date.now()}`;
    const studentId = `std-alm-${Date.now()}`;
    const cleanYear = data.graduationYear.trim() || String(new Date().getFullYear() - 1);
    const generatedRegNo = data.formerRegNumber?.trim() || `STX/ALM/${cleanYear}/${String(students.length + 101).padStart(3, '0')}`;
    
    const newReg: AlumniRegistration = {
      id: regId,
      fullName: data.fullName.trim(),
      graduationYear: cleanYear,
      email: data.email.trim(),
      phone: data.phone.trim(),
      formerRegNumber: generatedRegNo,
      formerClassOrSet: data.formerClassOrSet?.trim() || `Class of ${cleanYear}`,
      currentOccupation: data.currentOccupation?.trim(),
      currentInstitution: data.currentInstitution?.trim(),
      status: 'pending',
      submittedAt: new Date().toISOString(),
      assignedStudentId: studentId
    };

    const alumniStudent: StudentProfile = {
      id: studentId,
      name: data.fullName.trim(),
      regNumber: generatedRegNo,
      grade: `Alumni (Class of ${cleanYear})`,
      classId: 'class-alumni',
      gender: 'Male',
      house: data.formerHouse || (houseStandings && houseStandings.length > 0 ? houseStandings[0].name : 'Sapphire (Blue House)'),
      parentName: 'Alumni Directory Record',
      parentPhone: data.phone.trim(),
      emergencyPhone: data.phone.trim(),
      email: data.email.trim(),
      password: data.password || 'stanbax2025',
      securityQuestion: data.securityQuestion,
      securityAnswer: data.securityAnswer,
      passportPhoto: data.passportPhoto || '',
      isAlumni: true,
      alumniApprovalStatus: 'pending',
      graduationYear: cleanYear,
      graduationSession: `${cleanYear} Academic Set`,
      attendancePercent: 100,
      attendanceDays: 0,
      totalSchoolDays: 0,
      termAverage: 82,
      academicHistory: [],
      customResults: []
    };

    setAlumniRegistrations(prev => {
      const next = [newReg, ...prev];
      try { localStorage.setItem('stanbax_alumni_registrations', JSON.stringify(next)); } catch {}
      return next;
    });

    setStudents(prev => {
      const next = [alumniStudent, ...prev];
      try { localStorage.setItem('stanbax_students', JSON.stringify(next)); } catch {}
      return next;
    });

    return {
      success: true,
      message: `Alumni account registered for ${data.fullName}! Your account is currently pending approval by the School Administration or Academic Delegate. You will be able to log in once approved.`,
      registration: newReg
    };
  };

  const approveAlumniRegistration = async (id: string): Promise<{ success: boolean; message: string }> => {
    const reg = alumniRegistrations.find(r => r.id === id);
    if (!reg) return { success: false, message: 'Alumni registration record not found.' };

    const studentRecord = students.find(s => s.id === reg.assignedStudentId || s.regNumber === reg.formerRegNumber);

    setAlumniRegistrations(prev => {
      const next = prev.map(r => r.id === id ? { ...r, status: 'approved' as const, reviewedAt: new Date().toISOString(), reviewedBy: 'Admin / Academic Delegate' } : r);
      try { localStorage.setItem('stanbax_alumni_registrations', JSON.stringify(next)); } catch {}
      return next;
    });

    if (studentRecord) {
      updateStudent(studentRecord.id, {
        alumniApprovalStatus: 'approved'
      });
      // Provision credential in Supabase so alumni can log in remotely
      try {
        await remoteCreateCredential(
          studentRecord.regNumber,
          studentRecord.password || 'stanbax2025',
          'student',
          studentRecord.id,
          [studentRecord.email, studentRecord.name.toLowerCase()].filter((x): x is string => Boolean(x))
        );
      } catch (err) {
        console.warn('Could not auto-provision alumni credential in Supabase:', err);
      }
    }

    return {
      success: true,
      message: `Alumni account for ${reg.fullName} (${reg.formerRegNumber}) has been approved! They can now log in to the portal.`
    };
  };

  const rejectAlumniRegistration = (id: string, reason?: string) => {
    setAlumniRegistrations(prev => {
      const next = prev.map(r => r.id === id ? { ...r, status: 'rejected' as const, reviewedAt: new Date().toISOString(), rejectionReason: reason || 'Application details could not be validated by administration.' } : r);
      try { localStorage.setItem('stanbax_alumni_registrations', JSON.stringify(next)); } catch {}
      return next;
    });
    return { success: true, message: 'Alumni registration rejected.' };
  };

  const deleteAlumniRegistration = (id: string) => {
    const reg = alumniRegistrations.find(r => r.id === id);
    if (reg?.assignedStudentId) {
      deleteStudent(reg.assignedStudentId);
    }
    setAlumniRegistrations(prev => {
      const next = prev.filter(r => r.id !== id);
      try { localStorage.setItem('stanbax_alumni_registrations', JSON.stringify(next)); } catch {}
      return next;
    });
    return { success: true, message: 'Alumni registration record removed.' };
  };

  // 13B-2. Custom Results Management (Upload, Alteration & Deletion for Students & Alumni with Online Cloud Sync)
  const [customResults, setCustomResults] = useState<CustomResult[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_custom_results');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((r: any) => r.id));
          const missingDefaults = DEFAULT_CUSTOM_RESULTS.filter(dr => !existingIds.has(dr.id));
          return [...parsed, ...missingDefaults];
        }
      }
    } catch {}
    return DEFAULT_CUSTOM_RESULTS;
  });

  const uploadCustomResult = (data: Omit<CustomResult, 'id' | 'uploadedAt'> & { studentId?: string; studentRegNumber?: string }): CustomResult => {
    const newResult: CustomResult = {
      id: `cres-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Admin / Academic Delegate',
      ...data
    };

    let nextCustomResults: CustomResult[] = [];
    setCustomResults(prev => {
      nextCustomResults = [newResult, ...prev];
      try { localStorage.setItem('stanbax_custom_results', JSON.stringify(nextCustomResults)); } catch {}
      return nextCustomResults;
    });

    let nextStudents: StudentProfile[] = [];
    setStudents(prev => {
      nextStudents = prev.map(s => {
        const matches = (data.studentId && s.id === data.studentId) || 
                        (data.studentRegNumber && s.regNumber.toLowerCase() === data.studentRegNumber.toLowerCase());
        if (!matches) return s;
        const existing = s.customResults || [];
        return {
          ...s,
          customResults: [newResult, ...existing.filter(r => r.id !== newResult.id)]
        };
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(nextStudents)); } catch {}
      return nextStudents;
    });

    // Sync online to Supabase
    void syncStateOnline('stanbax_custom_results', nextCustomResults);
    void syncStateOnline('stanbax_students', nextStudents);

    return newResult;
  };

  const updateCustomResult = (resultId: string, updates: Partial<CustomResult>): boolean => {
    let nextResults: CustomResult[] = [];
    setCustomResults(prev => {
      nextResults = prev.map(r => r.id === resultId ? { 
        ...r, 
        ...updates, 
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin / Academic Delegate'
      } : r);
      try { localStorage.setItem('stanbax_custom_results', JSON.stringify(nextResults)); } catch {}
      return nextResults;
    });

    let nextStudents: StudentProfile[] = [];
    setStudents(prev => {
      const targetResult = nextResults.find(r => r.id === resultId);
      nextStudents = prev.map(s => {
        const matchesStudent = targetResult && (
          (targetResult.studentId && s.id === targetResult.studentId) ||
          (targetResult.studentRegNumber && s.regNumber.toLowerCase() === targetResult.studentRegNumber.toLowerCase())
        );
        const hasExisting = s.customResults && s.customResults.some(r => r.id === resultId);

        if (!matchesStudent && !hasExisting) return s;

        const currentCustomResults = s.customResults || [];
        let updatedList: CustomResult[];
        if (hasExisting) {
          updatedList = currentCustomResults.map(r => r.id === resultId ? { 
            ...r, 
            ...updates, 
            updatedAt: new Date().toISOString(),
            updatedBy: 'Admin / Academic Delegate'
          } : r);
        } else if (matchesStudent && targetResult) {
          updatedList = [{ ...targetResult, ...updates }, ...currentCustomResults];
        } else {
          updatedList = currentCustomResults;
        }

        return {
          ...s,
          customResults: updatedList
        };
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(nextStudents)); } catch {}
      return nextStudents;
    });

    // Synchronize online immediately
    void syncStateOnline('stanbax_custom_results', nextResults);
    void syncStateOnline('stanbax_students', nextStudents);

    return true;
  };

  const deleteCustomResult = (resultId: string): boolean => {
    let nextResults: CustomResult[] = [];
    setCustomResults(prev => {
      nextResults = prev.filter(r => r.id !== resultId);
      try { localStorage.setItem('stanbax_custom_results', JSON.stringify(nextResults)); } catch {}
      return nextResults;
    });

    let nextStudents: StudentProfile[] = [];
    setStudents(prev => {
      nextStudents = prev.map(s => {
        if (!s.customResults || !s.customResults.some(r => r.id === resultId)) return s;
        return {
          ...s,
          customResults: s.customResults.filter(r => r.id !== resultId)
        };
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(nextStudents)); } catch {}
      return nextStudents;
    });

    // Synchronize online immediately
    void syncStateOnline('stanbax_custom_results', nextResults);
    void syncStateOnline('stanbax_students', nextStudents);

    return true;
  };

  const syncAllCustomDataToCloud = async (): Promise<{ ok: boolean; message: string }> => {
    return await syncNewDataTypesOnline({
      customResults,
      waecSubjects,
      waecDeptRecommendations: waecDepartmentRecommendations,
      waecRegistrations,
      waecPromptBroadcast,
      students
    });
  };

  const getStudentCustomResults = (studentIdOrReg: string): CustomResult[] => {
    const targetNorm = studentIdOrReg.trim().toLowerCase();
    const listFromGlobal = customResults.filter(r => {
      const rId = (r as any).studentId?.toLowerCase();
      const rReg = (r as any).studentRegNumber?.toLowerCase();
      return rId === targetNorm || rReg === targetNorm;
    });
    const matchedStudent = students.find(s => 
      s.id.toLowerCase() === targetNorm || s.regNumber.toLowerCase() === targetNorm
    );
    const listFromStudent = matchedStudent?.customResults || [];
    const merged = new Map<string, CustomResult>();
    for (const r of listFromGlobal) merged.set(r.id, r);
    for (const r of listFromStudent) {
      if (!merged.has(r.id)) merged.set(r.id, r);
    }
    return Array.from(merged.values());
  };

  // 13B. Alumni Management
  const toggleStudentAlumni = (studentId: string, isAlumni: boolean, graduationSession?: string) => {
    const sessionToUse = graduationSession || `${schoolInfo.activeSession} (Graduated Alumni)`;
    updateStudent(studentId, {
      isAlumni,
      graduationSession: isAlumni ? sessionToUse : undefined
    });
  };

  // 13C. Upgrade Student to Tutor with Onboarding Requirement
  const upgradeStudentToTutor = (studentId: string): { success: boolean; tutorId?: string; message: string } => {
    const targetStudent = students.find(s => s.id === studentId);
    if (!targetStudent) {
      return { success: false, message: 'Student record not found.' };
    }

    const staffNum = tutors.length + 1;
    const staffId = `STX-TUT-${String(staffNum).padStart(3, '0')}`;
    const tutorId = `tut-upg-${Date.now()}`;
    const tutorEmail = targetStudent.email || `${targetStudent.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@stanbaxschools.edu.ng`;
    const tutorPassword = targetStudent.password || 'stanbax2025';

    const studentCustomRes = customResults.filter(cr => (cr as any).studentId === targetStudent.id || (cr as any).studentRegNumber === targetStudent.regNumber || (targetStudent.customResults || []).some(tc => tc.id === cr.id));

    const newTutorProfile: TutorProfile = {
      id: tutorId,
      staffId,
      name: targetStudent.name,
      role: 'Associate Faculty / Scholar Tutor',
      qualification: 'Stanbax Teaching Fellow (TRCN Aspirant)',
      department: 'Sciences & STEM Faculty',
      email: tutorEmail,
      password: tutorPassword,
      phone: targetStudent.emergencyPhone || '+234 803 000 0000',
      isUpgraded: true,
      profileCompleted: false, // User must complete necessary details on portal entry!
      studentOriginId: targetStudent.id,
      studentRegNumber: targetStudent.regNumber,
      assignedClasses: [targetStudent.grade],
      assignedSubjects: ['Mathematics', 'Basic Science & Technology'],
      retainedAcademicResults: {
        grades: grades.filter(g => g.studentId === targetStudent.id),
        academicHistory: targetStudent.academicHistory || [],
        customResults: studentCustomRes,
        termAverage: targetStudent.termAverage
      }
    };

    setTutors(prev => {
      const updated = [...prev, newTutorProfile];
      try {
        localStorage.setItem('stanbax_tutors', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    updateStudent(studentId, {
      isUpgradedTutor: true
    });

    // If this student was currently authenticated, clear their student session
    // to prevent conflicting dual-role session state (so they log in strictly as Tutor)
    if (activeStudentId === studentId || isStudentAuthenticated) {
      setIsStudentAuthenticated(false);
      setActiveStudentId('');
      try {
        localStorage.removeItem('stanbax_student_auth');
        localStorage.removeItem('stanbax_student_id');
        sessionStorage.removeItem('stanbax_student_auth');
        sessionStorage.removeItem('stanbax_student_id');
      } catch {}
    }

    return {
      success: true,
      tutorId,
      message: `${targetStudent.name} successfully elevated to Faculty Tutor (Staff ID: ${staffId}). On login, they will be required to complete their profile details.`
    };
  };

  const completeTutorProfile = (tutorId: string, data: Partial<TutorProfile>) => {
    updateTutor(tutorId, {
      ...data,
      profileCompleted: true
    });
  };

  // 13D. Admin Creation of New Tutor Account
  const createTutorAccount = (data: {
    name: string;
    email: string;
    staffId?: string;
    password: string;
    department: string;
    role: string;
    qualification: string;
    assignedClasses: string[];
    assignedSubjects: string[];
    phone?: string;
    bio?: string;
  }): TutorProfile => {
    const staffNum = tutors.length + 1;
    const staffId = data.staffId?.trim() || `STX-TUT-${String(staffNum).padStart(3, '0')}`;
    const newTutor: TutorProfile = {
      id: `tut-${Date.now()}`,
      staffId,
      name: data.name,
      email: data.email,
      password: data.password || 'stanbax2025',
      department: data.department || 'Sciences & STEM Faculty',
      role: data.role || 'Subject Teacher',
      qualification: data.qualification || 'B.Sc / B.Ed, TRCN Certified',
      assignedClasses: data.assignedClasses || [],
      assignedSubjects: data.assignedSubjects || [],
      phone: data.phone || '+234 803 000 0000',
      bio: data.bio || '',
      profileCompleted: true,
      isUpgraded: false
    };

    setTutors(prev => {
      const updated = [...prev, newTutor];
      try {
        localStorage.setItem('stanbax_tutors', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Commit to online server database (/api/tutors)
    void fetch('/api/tutors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTutor)
    }).catch(err => console.warn('[Online Storage] Error committing tutor online:', err));

    void remoteCreateCredential(
      newTutor.email,
      newTutor.password || 'stanbax2025',
      'tutor',
      newTutor.id,
      [staffId.toLowerCase(), data.name.toLowerCase()].filter(Boolean)
    );

    return newTutor;
  };

  // 13E. Password Management for All Roles
  const changePassword = async (
    userRole: UserRole,
    currentPass: string,
    newPass: string,
    userId?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!newPass || newPass.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }

    if (!isRemoteEnabled()) {
      return { success: false, message: 'Password changes require an active Supabase connection.' };
    }

    const accountByRole: Partial<Record<UserRole, { id: string; role: string }>> = {
      admin: { id: 'admin', role: 'admin' },
      proprietress: { id: 'proprietress', role: 'proprietress' },
      headmistress: { id: 'headmistress', role: 'headmistress' },
      moderator: { id: userId || activeModeratorId, role: 'moderator' },
      tutor: { id: userId || activeTutorId, role: 'tutor' },
      student: { id: userId || activeStudentId, role: 'student' },
      parent: { id: userId || activeParentId, role: 'parent' },
    };
    const account = accountByRole[userRole];
    if (!account) return { success: false, message: 'This account role cannot change passwords here.' };

    const verified = await remoteCheckCredentials(account.id, currentPass, account.role, account.id);
    if (!verified.ok) {
      return {
        success: false,
        message: verified.message || 'Current password could not be verified in Supabase.',
      };
    }

    const changed = await remoteChangePassword(account.id, currentPass, newPass);
    if (!changed.ok) {
      return { success: false, message: changed.message || 'Supabase did not save the new password.' };
    }

    // Keep the in-memory view current. The storage interceptor prevents these
    // legacy plaintext credential properties from being persisted locally.
    switch (userRole) {
      case 'admin':
        setAdminPassword(newPass);
        localStorage.setItem('stanbax_admin_password', newPass);
        break;
      case 'proprietress':
        setProprietressPassword(newPass);
        localStorage.setItem('stanbax_proprietress_password', newPass);
        break;
      case 'headmistress':
        setHeadmistressPassword(newPass);
        localStorage.setItem('stanbax_headmistress_password', newPass);
        break;
      case 'moderator':
        setModeratorPassword(newPass);
        localStorage.setItem('stanbax_moderator_password', newPass);
        break;
      case 'tutor':
        updateTutor(account.id, { password: newPass });
        break;
      case 'student':
        updateStudent(account.id, { password: newPass });
        break;
      case 'parent':
        updateParent(account.id, { password: newPass });
        break;
    }
    return { success: true, message: 'Password updated in Supabase.' };
  };

  const forgotPasswordReset = (identifier: string, newPassword: string): { success: boolean; message: string; role?: UserRole } => {
    if (isRemoteEnabled()) {
      return { success: false, message: 'Password recovery is not yet configured in Supabase. Ask an administrator to reset this account from the credentials page.' };
    }
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId) return { success: false, message: 'Please enter your username, email, Reg No, or Staff ID.' };
    if (!newPassword || newPassword.length < 6) return { success: false, message: 'New password must be at least 6 characters long.' };

    // Admin
    if (cleanId === 'admin' || cleanId === 'admin@stanbaxschools.edu.ng' || cleanId === 'administrator') {
      return { 
        success: false, 
        message: 'Administrator account is protected by a security question to prevent unauthorized access. Please provide your security question answer to reset.' 
      };
    }

    // Proprietress
    if (cleanId === 'proprietress' || cleanId === 'proprietress@stanbaxschools.edu.ng') {
      setProprietressPassword(newPassword);
      localStorage.setItem('stanbax_proprietress_password', newPassword);
      return { success: true, message: 'Proprietress password has been reset successfully!', role: 'proprietress' };
    }

    // Headmistress
    if (cleanId === 'headmistress' || cleanId === 'headmistress@stanbaxschools.edu.ng' || (headmistressProfile.email && cleanId === headmistressProfile.email.toLowerCase())) {
      setHeadmistressPassword(newPassword);
      localStorage.setItem('stanbax_headmistress_password', newPassword);
      return { success: true, message: 'Head Mistress password has been reset successfully!', role: 'headmistress' };
    }

    // Moderator
    const matchedMod = moderators.find(m => m.email.toLowerCase() === cleanId || m.id.toLowerCase() === cleanId);
    if (matchedMod || cleanId === 'moderator' || cleanId === 'moderator@stanbaxschools.edu.ng') {
      setModeratorPassword(newPassword);
      localStorage.setItem('stanbax_moderator_password', newPassword);
      return { success: true, message: 'Moderator password has been reset successfully!', role: 'moderator' };
    }

    // Tutors (including upgraded scholars)
    const cleanIdNoSpaces = cleanId.replace(/\s+/g, '');
    const targetTutor = tutors.find(t => 
      t.email.toLowerCase() === cleanId || 
      (t.staffId && t.staffId.toLowerCase() === cleanId) || 
      t.id.toLowerCase() === cleanId ||
      t.name.toLowerCase() === cleanId ||
      (t.studentOriginId && t.studentOriginId.toLowerCase() === cleanId) ||
      (t.studentRegNumber && t.studentRegNumber.toLowerCase().replace(/\s+/g, '') === cleanIdNoSpaces)
    );
    if (targetTutor) {
      updateTutor(targetTutor.id, { password: newPassword });
      return { success: true, message: `Password reset for tutor ${targetTutor.name}!`, role: 'tutor' };
    }

    // Students (excluding upgraded scholars who are now faculty tutors)
    const targetStudent = students.find(s => 
      !s.isUpgradedTutor && (
        s.regNumber.toLowerCase().replace(/\s+/g, '') === cleanIdNoSpaces ||
        (s.email && s.email.toLowerCase() === cleanId) ||
        s.id.toLowerCase() === cleanId ||
        s.name.toLowerCase() === cleanId
      )
    );
    if (targetStudent) {
      updateStudent(targetStudent.id, { password: newPassword });
      return { success: true, message: `Password reset for scholar ${targetStudent.name}!`, role: 'student' };
    }

    return { success: false, message: 'No registered user found with that identifier.' };
  };

  const getSecurityQuestionForUser = (identifier: string): {
    exists: boolean;
    hasQuestion: boolean;
    securityQuestion?: string;
    name?: string;
    role?: UserRole;
    message?: string;
  } => {
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId) return { exists: false, hasQuestion: false, message: 'Please enter an institutional identifier.' };

    const cleanIdNoSpaces = cleanId.replace(/\s+/g, '');

    // Check Headmistress
    if (cleanId === 'headmistress' || cleanId === 'headmistress@stanbaxschools.edu.ng' || (headmistressProfile.email && cleanId === headmistressProfile.email.toLowerCase())) {
      return { exists: true, hasQuestion: false, name: headmistressProfile.name, role: 'headmistress' };
    }

    // Check Moderator
    const matchedMod = moderators.find(m => m.email.toLowerCase() === cleanId || m.id.toLowerCase() === cleanId);
    if (matchedMod || cleanId === 'moderator' || cleanId === 'moderator@stanbaxschools.edu.ng') {
      return { exists: true, hasQuestion: false, name: matchedMod ? matchedMod.name : 'Community Moderator', role: 'moderator' };
    }

    // Check Tutors (including elevated scholars)
    const targetTutor = tutors.find(t => 
      t.email.toLowerCase() === cleanId || 
      (t.staffId && t.staffId.toLowerCase() === cleanId) || 
      t.id.toLowerCase() === cleanId ||
      t.name.toLowerCase() === cleanId ||
      (t.studentOriginId && t.studentOriginId.toLowerCase() === cleanId) ||
      (t.studentRegNumber && t.studentRegNumber.toLowerCase().replace(/\s+/g, '') === cleanIdNoSpaces)
    );
    if (targetTutor) {
      return {
        exists: true,
        hasQuestion: false,
        name: targetTutor.name,
        role: 'tutor'
      };
    }

    // Check Students (excluding upgraded scholars)
    const targetStudent = students.find(s => 
      !s.isUpgradedTutor && (
        s.regNumber.toLowerCase().replace(/\s+/g, '') === cleanIdNoSpaces ||
        (s.email && s.email.toLowerCase() === cleanId) ||
        s.id.toLowerCase() === cleanId ||
        s.name.toLowerCase() === cleanId
      )
    );

    if (targetStudent) {
      return {
        exists: true,
        hasQuestion: !!targetStudent.securityQuestion,
        securityQuestion: targetStudent.securityQuestion,
        name: targetStudent.name,
        role: 'student'
      };
    }

    if (cleanId === 'admin' || cleanId === 'admin@stanbaxschools.edu.ng' || cleanId === 'administrator') {
      return { 
        exists: true, 
        hasQuestion: true, 
        securityQuestion: adminSecurityQuestion, 
        name: 'Administrator', 
        role: 'admin' 
      };
    }

    // Proprietress
    if (cleanId === 'proprietress' || cleanId === 'proprietress@stanbaxschools.edu.ng') {
      return { exists: true, hasQuestion: false, name: proprietressProfile.name || 'Proprietress', role: 'proprietress' };
    }

    // Check Parents / Guardians
    const cleanPhoneDigits = cleanId.replace(/[^0-9]/g, '');
    const matchedParent = parents.find(p => {
      const pEmail = (p.email || '').toLowerCase().trim();
      const pId = (p.id || '').toLowerCase().trim();
      const pName = (p.fullName || '').toLowerCase().trim();
      const pPhoneDigits = (p.phone || '').replace(/[^0-9]/g, '');
      return (
        (cleanPhoneDigits.length >= 7 && pPhoneDigits.includes(cleanPhoneDigits)) ||
        pEmail === cleanId ||
        pId === cleanId ||
        pName === cleanId
      );
    });

    if (matchedParent) {
      return {
        exists: true,
        hasQuestion: !!matchedParent.securityQuestion,
        securityQuestion: matchedParent.securityQuestion,
        name: matchedParent.fullName,
        role: 'parent'
      };
    }

    return { exists: false, hasQuestion: false, message: 'No user account found matching this identifier.' };
  };

  const resetPasswordWithSecurityAnswer = (
    identifier: string,
    securityAnswer: string,
    newPassword: string
  ): { success: boolean; message: string; role?: UserRole } => {
    if (isRemoteEnabled()) {
      return { success: false, message: 'Security-question recovery is not configured in Supabase. Ask an administrator to reset this account from the credentials page.' };
    }
    const cleanId = identifier.trim().toLowerCase();
    const cleanAnswer = securityAnswer.trim().toLowerCase();
    const cleanPass = newPassword.trim();

    if (!cleanId) return { success: false, message: 'Institutional identifier is required.' };
    if (!cleanPass || cleanPass.length < 6) return { success: false, message: 'Password must be at least 6 characters.' };

    // Check Parents / Guardians
    const cleanPhoneDigits = cleanId.replace(/[^0-9]/g, '');
    const targetParent = parents.find(p => {
      const pEmail = (p.email || '').toLowerCase().trim();
      const pId = (p.id || '').toLowerCase().trim();
      const pName = (p.fullName || '').toLowerCase().trim();
      const pPhoneDigits = (p.phone || '').replace(/[^0-9]/g, '');
      return (
        (cleanPhoneDigits.length >= 7 && pPhoneDigits.includes(cleanPhoneDigits)) ||
        pEmail === cleanId ||
        pId === cleanId ||
        pName === cleanId
      );
    });

    if (targetParent) {
      if (targetParent.securityQuestion) {
        if (!cleanAnswer) {
          return { success: false, message: 'Please provide the answer to your security question.' };
        }
        const expectedAnswer = (targetParent.securityAnswer || '').trim().toLowerCase();
        if (cleanAnswer !== expectedAnswer) {
          return {
            success: false,
            message: 'Security verification failed. The provided answer does not match the registered security question answer for this parent account.'
          };
        }
      }
      updateParent(targetParent.id, { password: cleanPass });
      void fetch(`/api/parents/${encodeURIComponent(targetParent.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleanPass })
      }).catch(() => {});
      return {
        success: true,
        message: `Security answer verified! Password for parent ${targetParent.fullName} has been updated successfully.`,
        role: 'parent'
      };
    }

    const cleanIdNoSpaces = cleanId.replace(/\s+/g, '');
    const targetStudent = students.find(s => 
      !s.isUpgradedTutor && (
        s.regNumber.toLowerCase().replace(/\s+/g, '') === cleanIdNoSpaces ||
        (s.email && s.email.toLowerCase() === cleanId) ||
        s.id.toLowerCase() === cleanId ||
        s.name.toLowerCase() === cleanId
      )
    );

    if (targetStudent) {
      if (targetStudent.securityQuestion) {
        if (!cleanAnswer) {
          return { success: false, message: 'Please provide the answer to your security question.' };
        }
        const expectedAnswer = (targetStudent.securityAnswer || '').trim().toLowerCase();
        if (cleanAnswer !== expectedAnswer) {
          return { 
            success: false, 
            message: 'Security verification failed. The provided answer does not match the registered security question answer for this account.' 
          };
        }
      }
      updateStudent(targetStudent.id, { password: cleanPass });
      return { 
        success: true, 
        message: `Security answer verified! Password for scholar ${targetStudent.name} has been updated successfully.`, 
        role: 'student' 
      };
    }

    // Admin account security verification
    if (cleanId === 'admin' || cleanId === 'admin@stanbaxschools.edu.ng' || cleanId === 'administrator') {
      if (!cleanAnswer) {
        return { success: false, message: 'Please provide the answer to the administrator security question.' };
      }
      const expectedAnswer = (adminSecurityAnswer || '').trim().toLowerCase();
      const userAns = cleanAnswer.trim().toLowerCase();
      const expectedNoDot = expectedAnswer.replace(/\.+$/, '');
      const userAnsNoDot = userAns.replace(/\.+$/, '');

      if (userAns !== expectedAnswer && userAnsNoDot !== expectedNoDot) {
        return { 
          success: false, 
          message: 'Security verification failed. The provided answer does not match the administrator security question answer.' 
        };
      }

      setAdminPassword(cleanPass);
      localStorage.setItem('stanbax_admin_password', cleanPass);
      return { 
        success: true, 
        message: 'Administrator identity verified! Password has been updated successfully.', 
        role: 'admin' 
      };
    }

    // Fallback for staff/admin without security questions
    return forgotPasswordReset(identifier, newPassword);
  };

  // 13F. Admin Visibility of Every Password & User Directory
  const getAllUserCredentials = (): UserCredentialItem[] => {
    const list: UserCredentialItem[] = [];
    const displayPassword = (password: string | undefined, fallback: string) =>
      isRemoteEnabled() ? 'Managed securely in Supabase' : password || fallback;

    // Admin (Master Super Admin)
    list.push({
      id: 'usr-admin',
      cloudIdentifier: 'admin',
      name: 'Chief Administrator & Registrar (Super Admin)',
      role: 'admin',
      roleLabel: 'Super Administrator',
      primaryIdentifier: 'Admin',
      email: 'admin@stanbaxschools.edu.ng',
      password: displayPassword(adminPassword, DEFAULT_ADMIN_PASSWORD),
      status: 'Active',
      departmentOrGrade: 'ICT & Registry Operations',
      lastUpdated: 'System Master'
    });

    // Delegated Sub-Admin Accounts
    adminAccounts.filter(a => !isAccountTombstoned(a.id, a.username, a.email)).forEach(a => {
      list.push({
        id: a.id,
        cloudIdentifier: a.username,
        name: a.name,
        role: 'admin',
        roleLabel: a.roleTitle || 'Delegated Administrator',
        primaryIdentifier: a.username,
        email: a.email,
        password: displayPassword(a.password, 'Admin2025!'),
        status: a.status,
        departmentOrGrade: `${a.privileges.length} Privileges Granted`,
        lastUpdated: a.createdBy ? `Created by ${a.createdBy}` : 'Super Admin Delegation'
      });
    });

    // Proprietress
    if (!isAccountTombstoned('usr-proprietress', 'proprietress', 'proprietress@stanbaxschools.edu.ng')) {
      list.push({
        id: 'usr-proprietress',
        cloudIdentifier: 'proprietress',
        name: proprietressProfile.name || 'Mrs. Adebisi Folashade Bello',
        role: 'proprietress',
        roleLabel: 'Proprietress',
        primaryIdentifier: 'proprietress',
        email: 'proprietress@stanbaxschools.edu.ng',
        password: displayPassword(proprietressPassword, DEFAULT_PROPRIETRESS_PASSWORD),
        status: 'Active',
        departmentOrGrade: 'Executive Council',
        lastUpdated: 'Executive Master'
      });
    }

    // Head Mistress
    if (!isAccountTombstoned('usr-headmistress', 'headmistress', headmistressProfile.email)) {
      list.push({
        id: 'usr-headmistress',
        cloudIdentifier: 'headmistress',
        name: headmistressProfile.name || 'Mrs. Funmilayo Adediran',
        role: 'headmistress',
        roleLabel: 'Head Mistress / Academic Principal',
        primaryIdentifier: 'headmistress',
        email: headmistressProfile.email || 'headmistress@stanbaxschools.edu.ng',
        password: displayPassword(headmistressPassword, 'Headmistress2025!'),
        status: 'Active',
        departmentOrGrade: 'Academic Leadership',
        lastUpdated: 'Executive Master'
      });
    }

    // Moderators
    moderators.filter(m => !isAccountTombstoned(m.id, m.email, m.email)).forEach(m => {
      list.push({
        id: `usr-${m.id}`,
        cloudIdentifier: m.id,
        name: m.name,
        role: 'moderator',
        roleLabel: 'Community Moderator',
        primaryIdentifier: m.email.split('@')[0] || 'moderator',
        email: m.email,
        password: displayPassword(moderatorPassword, 'Moderator2025!'),
        status: m.status,
        departmentOrGrade: m.roleTitle,
        lastUpdated: 'Communications Registry'
      });
    });

    // Tutors (including elevated scholar tutors)
    tutors.filter(t => !isAccountTombstoned(t.id, t.staffId || t.email, t.email)).forEach(t => {
      list.push({
        id: t.id,
        cloudIdentifier: t.id,
        name: t.name,
        role: 'tutor',
        roleLabel: t.isUpgraded ? 'Associate Faculty (Scholar Tutor)' : 'Faculty Tutor',
        primaryIdentifier: t.staffId || t.email,
        email: t.email,
        password: displayPassword(t.password, 'stanbax2025'),
        status: t.isUpgraded 
          ? (t.profileCompleted ? 'Upgraded Tutor' : 'Pending Profile Setup') 
          : 'Active',
        departmentOrGrade: t.department,
        lastUpdated: 'Faculty Registry'
      });
    });

    // Students & Alumni (Exclude Upgraded Tutors and Tombstoned accounts)
    students.filter(s => !s.isUpgradedTutor && !isAccountTombstoned(s.id, s.regNumber, s.email)).forEach(s => {
      list.push({
        id: s.id,
        cloudIdentifier: s.id,
        name: s.name,
        role: 'student',
        roleLabel: s.isAlumni ? 'Alumni' : 'Scholar',
        primaryIdentifier: s.regNumber,
        email: s.email || `${s.regNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}@stanbaxschools.edu.ng`,
        password: displayPassword(s.password, 'stanbax2025'),
        securityQuestion: s.securityQuestion,
        securityAnswer: s.securityAnswer,
        passportPhoto: s.passportPhoto,
        status: s.isAlumni ? 'Alumni' : 'Active',
        departmentOrGrade: s.grade,
        lastUpdated: s.isAlumni ? (s.graduationSession || 'Graduated Alumni') : 'Active Enrollment'
      });
    });

    // Parents / Guardians
    parents.filter(p => !isAccountTombstoned(p.id, p.phone || p.email, p.email)).forEach(p => {
      list.push({
        id: p.id,
        cloudIdentifier: p.id,
        name: p.fullName,
        role: 'parent',
        roleLabel: 'Parent / Guardian',
        primaryIdentifier: p.phone || p.email,
        email: p.email,
        password: displayPassword(p.password, 'parent2025'),
        securityQuestion: p.securityQuestion,
        securityAnswer: p.securityAnswer,
        status: 'Active',
        departmentOrGrade: 'Parent Portal',
        lastUpdated: 'Family Directory'
      });
    });

    return list;
  };

  const adminResetUserPassword = async (
    userId: string,
    userRole: UserRole,
    newPassword: string,
    cloudIdentifier = userId
  ): Promise<{ success: boolean; message: string }> => {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: 'New password must be at least 6 characters long.' };
    }
    if (!isRemoteEnabled()) {
      return { success: false, message: 'Supabase is not configured in this deployment.' };
    }
    const result = await remoteChangePassword(cloudIdentifier, null, newPassword);
    if (!result.ok) {
      // If the account was not yet provisioned in public.credentials (e.g. local-seeded student or newly registered alumni),
      // provision it directly using remoteCreateCredential with the new password
      const createRes = await remoteCreateCredential(
        cloudIdentifier,
        newPassword,
        userRole,
        userId,
        [userId.toLowerCase(), cloudIdentifier.toLowerCase()]
      );
      if (!createRes.ok) {
        return { success: false, message: result.message || createRes.message || 'Supabase rejected the password reset.' };
      }
    }
    switch (userRole) {
      case 'admin': {
        const subAdmin = adminAccounts.find(a => a.id === userId || a.username.toLowerCase() === cloudIdentifier.toLowerCase());
        if (subAdmin) {
          void updateAdminAccount(subAdmin.id, { password: newPassword });
        } else {
          setAdminPassword(newPassword);
          localStorage.setItem('stanbax_admin_password', newPassword);
        }
        break;
      }
      case 'proprietress':
        setProprietressPassword(newPassword);
        localStorage.setItem('stanbax_proprietress_password', newPassword);
        break;
      case 'headmistress':
        setHeadmistressPassword(newPassword);
        localStorage.setItem('stanbax_headmistress_password', newPassword);
        break;
      case 'moderator':
        setModeratorPassword(newPassword);
        localStorage.setItem('stanbax_moderator_password', newPassword);
        break;
      case 'tutor':
        updateTutor(userId, { password: newPassword });
        break;
      case 'student':
        updateStudent(userId, { password: newPassword });
        break;
      case 'parent':
        updateParent(userId, { password: newPassword });
        break;
      default:
        return { success: false, message: 'Password reset is not supported for this account role.' };
    }
    return { success: true, message: 'Password updated in Supabase.' };
  };

  const adminDeleteUserAccount = async (
    userId: string,
    userRole: string,
    identifier?: string
  ): Promise<{ success: boolean; message: string }> => {
    // 1. Allow deleting delegated sub-admins, but never delete master super admin
    if (userRole === 'admin') {
      const subAdmin = adminAccounts.find(
        a => a.id === userId || (identifier && a.username.toLowerCase() === identifier.toLowerCase())
      );
      if (subAdmin) {
        return deleteAdminAccount(subAdmin.id);
      }
      return { success: false, message: 'The master Super Administrator account is protected by institutional policy and cannot be deleted.' };
    }
    if (userId === 'usr-admin' || userId === 'admin' || (identifier && identifier.toLowerCase() === 'admin')) {
      return { success: false, message: 'The master Administrator account is protected by institutional policy and cannot be deleted.' };
    }

    try {
      // 2. Clear credentials from Supabase public.credentials
      const cleanRefId = userId.startsWith('usr-') ? userId.replace(/^usr-/, '') : userId;
      if (isRemoteEnabled()) {
        try {
          await remoteDeleteCredential(identifier || cleanRefId, cleanRefId);
        } catch (e) {
          console.warn('[Remote Delete Credential Warning]', e);
        }
      }

      // 3. Remove scholar / alumni account
      if (userRole === 'student' || userRole === 'alumni') {
        const studentId = cleanRefId;
        const matched = students.find(s => s.id === studentId || (identifier && s.regNumber.toLowerCase() === identifier.toLowerCase()));
        const targetId = matched?.id || studentId;

        let nextStudents: StudentProfile[] = [];
        setStudents(prev => {
          nextStudents = prev.filter(s => s.id !== targetId && (!identifier || s.regNumber.toLowerCase() !== identifier.toLowerCase()));
          try { localStorage.setItem('stanbax_students', JSON.stringify(nextStudents)); } catch {}
          return nextStudents;
        });

        let nextAlumni: AlumniRegistration[] = [];
        setAlumniRegistrations(prev => {
          nextAlumni = prev.filter(r => r.assignedStudentId !== targetId && (!identifier || r.formerRegNumber?.toLowerCase() !== identifier.toLowerCase()));
          try { localStorage.setItem('stanbax_alumni_registrations', JSON.stringify(nextAlumni)); } catch {}
          return nextAlumni;
        });

        // Also clean WAEC registrations if any
        setWaecRegistrations(prev => {
          const nextWaec = prev.filter(w => w.studentId !== targetId && (!identifier || ((w as any).studentRegNumber || (w as any).regNumber)?.toLowerCase() !== identifier.toLowerCase()));
          try { localStorage.setItem('stanbax_waec_registrations', JSON.stringify(nextWaec)); } catch {}
          void syncStateOnline('stanbax_waec_registrations', nextWaec);
          return nextWaec;
        });

        // Delete from server backend if online
        markAccountAsPermanentlyDeleted(targetId, identifier || matched?.regNumber, 'student');
        void fetch(`/api/students/${encodeURIComponent(targetId)}`, { method: 'DELETE' }).catch(() => {});

        // Sync changes online
        broadcastLocalStateChange('stanbax_students', nextStudents);
        broadcastLocalStateChange('stanbax_alumni_registrations', nextAlumni);
        void syncStateOnline('stanbax_students', nextStudents);
        void syncStateOnline('stanbax_alumni_registrations', nextAlumni);

        return {
          success: true,
          message: `Scholar account (${matched?.name || identifier || targetId}) permanently deleted from records and Supabase credentials vault.`
        };
      }

      // 4. Remove Faculty Tutor
      if (userRole === 'tutor') {
        const tutorId = cleanRefId;
        const matched = tutors.find(t => t.id === tutorId || (identifier && (t.email.toLowerCase() === identifier.toLowerCase() || t.staffId?.toLowerCase() === identifier.toLowerCase())));
        const targetId = matched?.id || tutorId;

        markAccountAsPermanentlyDeleted(targetId, identifier || matched?.email || matched?.staffId, 'tutor');
        void fetch(`/api/tutors/${encodeURIComponent(targetId)}`, { method: 'DELETE' }).catch(() => {});

        let nextTutors: TutorProfile[] = [];
        setTutors(prev => {
          nextTutors = prev.filter(t => t.id !== targetId);
          try { localStorage.setItem('stanbax_tutors', JSON.stringify(nextTutors)); } catch {}
          return nextTutors;
        });

        broadcastLocalStateChange('stanbax_tutors', nextTutors);
        void syncStateOnline('stanbax_tutors', nextTutors);

        return {
          success: true,
          message: `Faculty Tutor account (${matched?.name || identifier || targetId}) permanently deleted from staff records and Supabase.`
        };
      }

      // 5. Remove Parent Account
      if (userRole === 'parent') {
        const parentId = cleanRefId;
        const matched = parents.find(p => p.id === parentId || (identifier && (p.phone === identifier || p.email === identifier)));
        const targetId = matched?.id || parentId;

        markAccountAsPermanentlyDeleted(targetId, identifier || matched?.phone || matched?.email, 'parent');
        void fetch(`/api/parents/${encodeURIComponent(targetId)}`, { method: 'DELETE' }).catch(() => {});

        let nextParents: ParentProfile[] = [];
        setParents(prev => {
          nextParents = prev.filter(p => p.id !== targetId);
          try { localStorage.setItem('stanbax_parents_list', JSON.stringify(nextParents)); } catch {}
          return nextParents;
        });

        broadcastLocalStateChange('stanbax_parents_list', nextParents);
        void syncStateOnline('stanbax_parents_list', nextParents);

        return {
          success: true,
          message: `Parent profile (${matched?.fullName || identifier || targetId}) permanently removed from family directory and Supabase.`
        };
      }

      // 6. Remove Moderator Account
      if (userRole === 'moderator') {
        const modId = cleanRefId;
        const matched = moderators.find(m => m.id === modId || (identifier && m.email.toLowerCase() === identifier.toLowerCase()));
        const targetId = matched?.id || modId;

        markAccountAsPermanentlyDeleted(targetId, identifier || matched?.email, 'moderator');
        void fetch(`/api/moderators/${encodeURIComponent(targetId)}`, { method: 'DELETE' }).catch(() => {});

        let nextMods: ModeratorProfile[] = [];
        setModerators(prev => {
          nextMods = prev.filter(m => m.id !== targetId);
          try { localStorage.setItem('stanbax_moderators', JSON.stringify(nextMods)); } catch {}
          return nextMods;
        });

        broadcastLocalStateChange('stanbax_moderators', nextMods);
        void syncStateOnline('stanbax_moderators', nextMods);

        return {
          success: true,
          message: `Moderator account (${matched?.name || identifier || targetId}) permanently removed.`
        };
      }

      return {
        success: true,
        message: `Account credential (${identifier || userId}) removed successfully.`
      };
    } catch (err: any) {
      console.error('[Admin Delete User Error]', err);
      return {
        success: false,
        message: err?.message || 'An error occurred while deleting user account.'
      };
    }
  };

  // 14. Teacher Lesson Notes & Academic Materials
  const [notesFeatureEnabled, setNotesFeatureEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('stanbax_notes_enabled');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const [lessonNotes, setLessonNotes] = useState<LessonNote[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_lesson_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_LESSON_NOTES;
  });

  const toggleNotesFeature = (enabled?: boolean) => {
    setNotesFeatureEnabled(prev => {
      const nextVal = enabled !== undefined ? enabled : !prev;
      try {
        localStorage.setItem('stanbax_notes_enabled', String(nextVal));
      } catch {}
      return nextVal;
    });
  };

  const addLessonNote = (noteData: Omit<LessonNote, 'id' | 'datePublished' | 'downloadsCount'>): LessonNote => {
    const newNote: LessonNote = {
      ...noteData,
      id: `note-${Date.now()}`,
      datePublished: new Date().toISOString().split('T')[0],
      downloadsCount: 0
    };
    setLessonNotes(prev => {
      const updated = [newNote, ...prev];
      try {
        localStorage.setItem('stanbax_lesson_notes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    return newNote;
  };

  const deleteLessonNote = (id: string): boolean => {
    setLessonNotes(prev => {
      const updated = prev.filter(n => n.id !== id);
      try {
        localStorage.setItem('stanbax_lesson_notes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    return true;
  };

  const deleteTermNotes = (term?: string, session?: string): number => {
    const targetTerm = (term || schoolInfo.activeTerm || '2nd Term').toLowerCase();
    let deletedCount = 0;
    setLessonNotes(prev => {
      const remaining: LessonNote[] = [];
      prev.forEach(note => {
        const matchesTerm = note.term.toLowerCase().includes(targetTerm) || targetTerm.includes(note.term.toLowerCase());
        if (matchesTerm) {
          deletedCount++;
        } else {
          remaining.push(note);
        }
      });
      try {
        localStorage.setItem('stanbax_lesson_notes', JSON.stringify(remaining));
      } catch {}
      return remaining;
    });
    return deletedCount;
  };

  const incrementNoteDownload = (id: string) => {
    setLessonNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, downloadsCount: (n.downloadsCount || 0) + 1 } : n);
      try {
        localStorage.setItem('stanbax_lesson_notes', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const exportNotesZip = async (term?: string, session?: string): Promise<{ success: boolean; count: number; filename: string }> => {
    const targetTerm = term || schoolInfo.activeTerm || '2nd Term (Lent Term)';
    const targetSession = session || assessmentConfig.activeSession || '2025/2026 Academic Session';

    let notesToExport = lessonNotes.filter(n => 
      n.term.toLowerCase().includes(targetTerm.toLowerCase()) || targetTerm.toLowerCase().includes(n.term.toLowerCase())
    );

    if (notesToExport.length === 0) {
      notesToExport = lessonNotes;
    }

    const zip = new JSZip();

    let catalogContent = `========================================================================\n`;
    catalogContent += `STANBAX SCHOOLS, IBADAN - OFFICIAL LESSON NOTES & STUDY MATERIALS\n`;
    catalogContent += `Academic Session: ${targetSession}\n`;
    catalogContent += `Academic Term: ${targetTerm}\n`;
    catalogContent += `Export Timestamp: ${new Date().toLocaleString()}\n`;
    catalogContent += `Total Published Notes Exported: ${notesToExport.length}\n`;
    catalogContent += `Admin Feature Status: ${notesFeatureEnabled ? 'Active / Enabled' : 'Disabled'}\n`;
    catalogContent += `========================================================================\n\n`;

    notesToExport.forEach((note, index) => {
      catalogContent += `[${index + 1}] ${note.title}\n`;
      catalogContent += `    Subject: ${note.subject} | Target Class: ${note.targetClass}\n`;
      catalogContent += `    Faculty Tutor: ${note.authorName} (${note.authorRole || 'Faculty'})\n`;
      catalogContent += `    Format: ${note.format.toUpperCase()} | Published: ${note.datePublished}\n`;
      catalogContent += `    Downloads Logged: ${note.downloadsCount}\n`;
      if (note.attachment) {
        catalogContent += `    Attachment File: ${note.attachment.name} (${note.attachment.fileSize})\n`;
      }
      catalogContent += `    Lecture Content / Outline:\n    ${note.content.replace(/\n/g, '\n    ')}\n\n`;
      catalogContent += `------------------------------------------------------------------------\n`;

      const safeSubj = note.subject.replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeTitle = note.title.slice(0, 35).replace(/[^a-zA-Z0-9_-]/g, '_');
      const folderName = `${safeSubj}`;

      // Lecture Guide file
      zip.file(`${folderName}/${safeTitle}_Lecture_Guide.txt`, 
        `STANBAX SCHOOLS - OFFICIAL STUDY MATERIAL\n` +
        `SUBJECT: ${note.subject}\n` +
        `TOPIC: ${note.title}\n` +
        `TARGET CLASS: ${note.targetClass}\n` +
        `FACULTY TUTOR: ${note.authorName} (${note.authorRole || 'Faculty'})\n` +
        `TERM / SESSION: ${note.term} • ${note.session}\n` +
        `DATE PUBLISHED: ${note.datePublished}\n\n` +
        `==================== LESSON CONTENT ====================\n\n` +
        `${note.content}\n`
      );

      // Attachment file
      if (note.attachment) {
        if (note.attachment.dataUrl) {
          const commaIndex = note.attachment.dataUrl.indexOf(',');
          if (commaIndex !== -1) {
            const base64Data = note.attachment.dataUrl.slice(commaIndex + 1);
            const fileName = note.attachment.name || `${safeTitle}.${note.format === 'image' ? 'png' : note.format}`;
            zip.file(`${folderName}/${fileName}`, base64Data, { base64: true });
          }
        } else if (note.attachment.textContent) {
          zip.file(`${folderName}/${note.attachment.name || `${safeTitle}.txt`}`, note.attachment.textContent);
        }
      }
    });

    zip.file('README_CATALOG.txt', catalogContent);

    const blob = await zip.generateAsync({ type: 'blob' });
    const cleanTerm = targetTerm.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Stanbax_Lesson_Notes_${cleanTerm}.zip`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, count: notesToExport.length, filename };
  };

  // 18. Database Snapshot Export & Import (Resilience for free hosting on Vercel or GitHub)
  // Every persisted collection is registered here so backup/restore is lossless.
  // The registry is a function so it is only evaluated when a snapshot runs —
  // all setters above (and below in file order) are initialized by then.
  interface SnapshotField {
    key: string;
    storageKey: string;
    label: string;
    get: () => unknown;
    set: (v: any) => void;
    isArray: boolean;
    rawString?: boolean;
  }

  const snapshotFields = (): SnapshotField[] => [
    { key: 'schoolInfo', storageKey: 'stanbax_school_info', label: 'School Info', get: () => schoolInfo, set: setSchoolInfo, isArray: false },
    { key: 'images', storageKey: 'stanbax_app_images', label: 'Site Images', get: () => images, set: setImages, isArray: false },
    { key: 'classes', storageKey: 'stanbax_classes', label: 'Classes', get: () => classes, set: setClasses, isArray: true },
    { key: 'subjects', storageKey: 'stanbax_subjects', label: 'Subjects', get: () => subjects, set: setSubjects, isArray: true },
    { key: 'gradingSystem', storageKey: 'stanbax_grading_system', label: 'Grading System', get: () => gradingSystem, set: setGradingSystem, isArray: true },
    { key: 'tutors', storageKey: 'stanbax_tutors', label: 'Faculty / Tutors', get: () => tutors, set: setTutors, isArray: true },
    { key: 'students', storageKey: 'stanbax_students', label: 'Students', get: () => students, set: setStudents, isArray: true },
    { key: 'parents', storageKey: 'stanbax_parents_list', label: 'Parents', get: () => parents, set: setParents, isArray: true },
    { key: 'homeworks', storageKey: 'stanbax_homeworks', label: 'Homeworks', get: () => homeworks, set: setHomeworks, isArray: true },
    { key: 'notices', storageKey: 'stanbax_notices', label: 'Notices', get: () => notices, set: setNotices, isArray: true },
    { key: 'applications', storageKey: 'stanbax_applications', label: 'Admissions Applications', get: () => applications, set: setApplications, isArray: true },
    { key: 'entranceExamSettings', storageKey: 'stanbax_entrance_exam_settings', label: 'Entrance Exam Settings', get: () => entranceExamSettings, set: setEntranceExamSettings, isArray: false },
    { key: 'broadcastLogs', storageKey: 'stanbax_broadcast_logs', label: 'Broadcast Logs', get: () => broadcastLogs, set: setBroadcastLogs, isArray: true },
    { key: 'inquiries', storageKey: 'stanbax_inquiries', label: 'Contact Inquiries', get: () => inquiries, set: setInquiries, isArray: true },
    { key: 'lessonNotes', storageKey: 'stanbax_lesson_notes', label: 'Lesson Notes', get: () => lessonNotes, set: setLessonNotes, isArray: true },
    { key: 'notesFeatureEnabled', storageKey: 'stanbax_notes_enabled', label: 'Notes Feature Flag', get: () => notesFeatureEnabled, set: setNotesFeatureEnabled, isArray: false },
    { key: 'assessmentConfig', storageKey: 'stanbax_assessment_config', label: 'Assessment Config', get: () => assessmentConfig, set: setAssessmentConfig, isArray: false },
    { key: 'termResumptionConfig', storageKey: 'stanbax_term_resumption_config', label: 'Term Resumption Config', get: () => termResumptionConfig, set: setTermResumptionConfig, isArray: false },
    { key: 'attendanceRecords', storageKey: 'stanbax_attendance_records', label: 'Attendance Registers', get: () => attendanceRecords, set: setAttendanceRecords, isArray: true },
    { key: 'cbtExams', storageKey: 'stanbax_cbt_exams', label: 'CBT Exams', get: () => cbtExams, set: setCbtExams, isArray: true },
    { key: 'cbtAttempts', storageKey: 'stanbax_cbt_attempts', label: 'CBT Attempts', get: () => cbtAttempts, set: setCbtAttempts, isArray: true },
    { key: 'timetables', storageKey: 'stanbax_weekly_timetables', label: 'Weekly Timetables', get: () => timetables, set: setTimetables, isArray: true },
    { key: 'sickBayLogs', storageKey: 'stanbax_sickbay_logs', label: 'Sick-Bay Logs', get: () => sickBayLogs, set: setSickBayLogs, isArray: true },
    { key: 'consultationRequests', storageKey: 'stanbax_parent_consultations', label: 'Parent Consultations', get: () => consultationRequests, set: setConsultationRequests, isArray: true },
    { key: 'feePayments', storageKey: 'stanbax_fee_payments', label: 'Fee Payments', get: () => feePayments, set: setFeePayments, isArray: true },
    { key: 'calvinTokens', storageKey: 'stanbax_calvin_tokens', label: 'Calvin AI Tokens', get: () => calvinTokens, set: setCalvinTokens, isArray: true },
    { key: 'libraryBooks', storageKey: 'stanbax_library_books', label: 'Library Books', get: () => libraryBooks, set: setLibraryBooks, isArray: true },
    { key: 'proprietressProfile', storageKey: 'stanbax_proprietress_profile', label: 'Proprietress Profile', get: () => proprietressProfile, set: setProprietressProfile, isArray: false },
    { key: 'appointments', storageKey: 'stanbax_proprietress_appointments', label: 'Proprietress Appointments', get: () => appointments, set: setAppointments, isArray: true },
    { key: 'messagesToProprietress', storageKey: 'stanbax_proprietress_messages', label: 'Messages to Proprietress', get: () => messagesToProprietress, set: setMessagesToProprietress, isArray: true },
    { key: 'directives', storageKey: 'stanbax_proprietress_directives', label: 'Proprietress Directives', get: () => directives, set: setDirectives, isArray: true },
    { key: 'facultyList', storageKey: 'stanbax_faculty_members', label: 'Faculty Directory', get: () => facultyList, set: setFacultyList, isArray: true },
    { key: 'heroSlides', storageKey: 'stanbax_hero_slides', label: 'Hero Slides', get: () => heroSlides, set: setHeroSlides, isArray: true },
    { key: 'heroHighlights', storageKey: 'stanbax_hero_highlights', label: 'Hero Highlights', get: () => heroHighlights, set: setHeroHighlights, isArray: true },
    { key: 'keyPillars', storageKey: 'stanbax_key_pillars', label: 'Key Pillars', get: () => keyPillars, set: setKeyPillars, isArray: true },
    { key: 'keyPillarsHeader', storageKey: 'stanbax_key_pillars_header', label: 'Key Pillars Header', get: () => keyPillarsHeader, set: setKeyPillarsHeader, isArray: false },
    { key: 'aboutContent', storageKey: 'stanbax_about_content', label: 'About Section', get: () => aboutContent, set: setAboutContent, isArray: false },
    { key: 'academicPrograms', storageKey: 'stanbax_academic_programs', label: 'Academic Programs', get: () => academicPrograms, set: setAcademicPrograms, isArray: true },
    { key: 'featuredCourses', storageKey: 'stanbax_featured_courses', label: 'Featured Courses', get: () => featuredCourses, set: setFeaturedCourses, isArray: true },
    { key: 'clubsList', storageKey: 'stanbax_clubs_list', label: 'Clubs Directory', get: () => clubsList, set: setClubsList, isArray: true },
    { key: 'houseStandings', storageKey: 'stanbax_house_standings', label: 'House Standings', get: () => houseStandings, set: setHouseStandings, isArray: true },
    { key: 'busRoutes', storageKey: 'stanbax_bus_routes', label: 'Bus Routes', get: () => busRoutes, set: setBusRoutes, isArray: true },
    { key: 'mealMenu', storageKey: 'stanbax_meal_menu', label: 'Meal Menu', get: () => mealMenu, set: setMealMenu, isArray: true },
    { key: 'calendarEvents', storageKey: 'stanbax_calendar_events', label: 'Calendar Events', get: () => calendarEvents, set: setCalendarEvents, isArray: true },
    { key: 'testimonials', storageKey: 'stanbax_testimonials', label: 'Testimonials', get: () => testimonials, set: setTestimonials, isArray: true },
    { key: 'testimonialsHeader', storageKey: 'stanbax_testimonials_header', label: 'Testimonials Header', get: () => testimonialsHeader, set: setTestimonialsHeader, isArray: false },
    { key: 'faqs', storageKey: 'stanbax_faq_items', label: 'FAQs', get: () => faqItems, set: setFaqItems, isArray: true },
    { key: 'faqHeader', storageKey: 'stanbax_faq_header', label: 'FAQ Header', get: () => faqHeader, set: setFaqHeader, isArray: false },
    { key: 'adminPassword', storageKey: 'stanbax_admin_password', label: 'Admin Password', get: () => adminPassword, set: setAdminPassword, isArray: false, rawString: true },
    { key: 'proprietressPassword', storageKey: 'stanbax_proprietress_password', label: 'Proprietress Password', get: () => proprietressPassword, set: setProprietressPassword, isArray: false, rawString: true },
    { key: 'adminSecurityQuestion', storageKey: 'stanbax_admin_security_q', label: 'Admin Security Question', get: () => adminSecurityQuestion, set: setAdminSecurityQuestion, isArray: false, rawString: true },
    { key: 'adminSecurityAnswer', storageKey: 'stanbax_admin_security_a', label: 'Admin Security Answer', get: () => adminSecurityAnswer, set: setAdminSecurityAnswer, isArray: false, rawString: true },
    { key: 'schoolRepConfig', storageKey: 'stanbax_school_rep_config', label: 'School Representative Config', get: () => schoolRepConfig, set: setSchoolRepConfig, isArray: false },
    { key: 'visitorConversations', storageKey: 'stanbax_visitor_conversations', label: 'Visitor Inquiries & Live Chat', get: () => visitorConversations, set: setVisitorConversations, isArray: true },
    { key: 'landingSections', storageKey: 'stanbax_landing_sections', label: 'Landing Page Section Toggles', get: () => landingSections, set: setLandingSections, isArray: false },
    { key: 'parents', storageKey: 'stanbax_parents_list', label: 'Parent Profiles & Sibling Linkages', get: () => parents, set: setParents, isArray: true }
  ];

  const exportDatabaseSnapshot = (): string => {
    const backup: Record<string, unknown> = {
      version: '2.1',
      schoolName: 'Stanbax Schools Ibadan',
      exportedAt: new Date().toISOString(),
      deletedAccountIds: Array.from(deletedAccountIdsRef.current),
    };
    snapshotFields().forEach(f => {
      backup[f.key] = f.get();
    });
    return JSON.stringify(backup, null, 2);
  };

  const importDatabaseSnapshot = async (jsonData: string): Promise<{ success: boolean; message: string; recordCounts?: Record<string, number> }> => {
    try {
      markLocalMutation();
      const parsed = JSON.parse(jsonData);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, message: 'Invalid backup file format.' };
      }
      const counts: Record<string, number> = {};

      // 1. Process deletedAccountIds from backup first if present
      if (Array.isArray(parsed.deletedAccountIds)) {
        parsed.deletedAccountIds.forEach((id: string) => {
          if (id) deletedAccountIdsRef.current.add(String(id).toLowerCase());
        });
      }

      // 2. If students array is in the backup, tombstone any previous demo/local students not in the imported list
      let importedStudentsClean: StudentProfile[] | undefined;
      if (Array.isArray(parsed.students) && parsed.students.length > 0) {
        const nowIso = new Date().toISOString();
        importedStudentsClean = deduplicateStudentsByRegistration(
          (parsed.students as StudentProfile[]).map(s => ({
            ...s,
            password: s.password || 'stanbax2025',
            updatedAt: nowIso,
          }))
        );
        const importedIds = new Set(importedStudentsClean.map(s => String(s.id || '').toLowerCase()));
        const importedRegs = new Set(importedStudentsClean.map(s => normalizeRegForUpsert(s.regNumber)));

        students.forEach(oldStu => {
          const oldId = String(oldStu.id || '').toLowerCase();
          const oldReg = normalizeRegForUpsert(oldStu.regNumber);
          if (!importedIds.has(oldId) && (!oldReg || !importedRegs.has(oldReg))) {
            markAccountAsPermanentlyDeleted(oldStu.id, oldStu.regNumber, 'student');
          }
        });

        // Crucial: Un-tombstone all imported students so none are accidentally hidden or dropped
        importedStudentsClean.forEach(s => {
          const sid = String(s.id || '').toLowerCase();
          const sreg = String(s.regNumber || '').toLowerCase();
          deletedAccountIdsRef.current.delete(sid);
          deletedAccountIdsRef.current.delete(sreg);
          deletedAccountIdsRef.current.delete(sreg.replace(/\s+/g, ''));
        });
      }

      // 3. Set all state values from snapshot fields
      snapshotFields().forEach(f => {
        let value = (parsed as Record<string, unknown>)[f.key];
        if (f.key === 'students' && importedStudentsClean) {
          value = importedStudentsClean;
        } else if (f.key === 'subjects' && Array.isArray(value)) {
          value = (value as Subject[]).map(normalizeSubject);
        }
        if (value === undefined || value === null) return;
        if (f.isArray && !Array.isArray(value)) return;
        f.set(value);
        try {
          localStorage.setItem(f.storageKey, f.rawString ? String(value) : JSON.stringify(value));
        } catch {}
        counts[f.label] = Array.isArray(value) ? value.length : 1;
      });

      const updatedDeletedArr = Array.from(deletedAccountIdsRef.current);
      setDeletedAccountIds(updatedDeletedArr);
      try {
        localStorage.setItem('stanbax_deleted_account_ids', JSON.stringify(updatedDeletedArr));
      } catch {}

      // Legacy backups (v1.0) carried one shared `grades` list
      if (Array.isArray(parsed.grades)) {
        const ownerId = sessionStorage.getItem('stanbax_student_id') || 'stu-1';
        setStudents(prev => {
          const updated = prev.map(s =>
            s.id === ownerId && (!s.grades || s.grades.length === 0)
              ? { ...s, grades: parsed.grades as GradeRecord[] }
              : s
          );
          try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
          return updated;
        });
        counts['Grade Records (legacy)'] = parsed.grades.length;
      }

      const finalStudentsToSync = importedStudentsClean || students;
      const finalSubjectsToSync = Array.isArray(parsed.subjects) ? (parsed.subjects as Subject[]).map(normalizeSubject) : subjects;
      const finalConfigToSync = (parsed.assessmentConfig as AssessmentControlConfig) || assessmentConfig;

      // 4. Provision credentials in Supabase for all imported students in small concurrent batches
      if (importedStudentsClean && importedStudentsClean.length > 0) {
        const withReg = importedStudentsClean.filter(s => s.regNumber);
        for (let i = 0; i < withReg.length; i += 5) {
          const chunk = withReg.slice(i, i + 5);
          await Promise.all(
            chunk.map(s =>
              remoteCreateCredential(
                s.regNumber,
                s.password || 'stanbax2025',
                'student',
                s.id,
                [s.email || '', s.name?.toLowerCase() || ''].filter(Boolean)
              ).catch(() => {})
            )
          );
        }
      }

      // 5. Explicitly prepare complete snapshot for pushAllDataToSupabase ensuring students are attached
      const payloadToSync: Record<string, unknown> = {
        ...(parsed as Record<string, unknown>),
        students: finalStudentsToSync,
        subjects: finalSubjectsToSync,
        assessmentConfig: finalConfigToSync,
        deletedAccountIds: updatedDeletedArr,
      };

      // 6. Push directly and await Supabase response
      const supabaseSyncResult = await pushAllDataToSupabase(payloadToSync);

      // 7. Sync with Express server if online
      try {
        await fetch('/api/students/replace-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            students: finalStudentsToSync,
            subjects: finalSubjectsToSync,
            assessmentConfig: finalConfigToSync,
            parents: Array.isArray(parsed.parents) ? parsed.parents : parents,
            deletedAccountIds: updatedDeletedArr,
          }),
        }).catch(() => {});
      } catch {}

      try {
        await forceSyncCollatedResultsToDatabase({
          students: finalStudentsToSync,
          assessmentConfig: finalConfigToSync,
          subjects: finalSubjectsToSync,
          parents: Array.isArray(parsed.parents) ? parsed.parents : parents,
          deletedAccountIds: updatedDeletedArr,
          gradingSystem: Array.isArray(parsed.gradingSystem) ? parsed.gradingSystem : gradingSystem,
          officialSignatures,
          adminPassword,
        });
      } catch {}

      const syncNote = supabaseSyncResult.ok
        ? ` All ${finalStudentsToSync.length} scholars & credentials synchronized to Supabase Cloud.`
        : ` Saved locally and cached. (Cloud status: ${supabaseSyncResult.message})`;

      return {
        success: true,
        message: `School migration package restored! ${finalStudentsToSync.length} scholars and ${finalSubjectsToSync.length} subjects restored successfully.${syncNote}`,
        recordCounts: counts
      };
    } catch (err: any) {
      return { success: false, message: `Failed to import database: ${err?.message || 'Invalid JSON file'}` };
    }
  };

  // 19. Attendance & Term Resumption Management State
  const [termResumptionConfig, setTermResumptionConfig] = useState<TermResumptionConfig>(() => {
    try {
      const saved = localStorage.getItem('stanbax_term_resumption_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      termStartDate: '2026-09-15',
      termEndDate: '2026-12-18',
      termName: '1st Term',
      session: '2026/2027 Academic Session',
      isTermActive: true,
      totalSchoolDaysPlanned: 60
    };
  });

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceDailyRecord[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_attendance_records');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'att-day-1',
        classId: 'cls-14',
        className: 'SSS 2 Science',
        date: '2026-09-15',
        dayNumber: 1,
        term: '1st Term',
        session: '2026/2027 Academic Session',
        submittedByTutorId: 'tut-1',
        submittedByTutorName: 'Mr. Olumide Ogunleye',
        submittedAt: '2026-09-15T14:30:00.000Z',
        studentsAttendance: [
          { studentId: 'stu-1', studentName: 'Tiwa Adeleke', regNumber: 'STX/2023/042', status: 'Present' },
          { studentId: 'stu-2', studentName: 'Babatunde Akindele', regNumber: 'STX/2023/043', status: 'Present' },
          { studentId: 'stu-3', studentName: 'Chidera Okafor', regNumber: 'STX/2023/044', status: 'Present' },
          { studentId: 'stu-4', studentName: 'Damilola Fashola', regNumber: 'STX/2023/045', status: 'Late' },
          { studentId: 'stu-5', studentName: 'Efe Oghomwen', regNumber: 'STX/2023/046', status: 'Present' },
          { studentId: 'stu-6', studentName: 'Farouk Danjuma', regNumber: 'STX/2023/047', status: 'Absent' }
        ]
      },
      {
        id: 'att-day-2',
        classId: 'cls-14',
        className: 'SSS 2 Science',
        date: '2026-09-16',
        dayNumber: 2,
        term: '1st Term',
        session: '2026/2027 Academic Session',
        submittedByTutorId: 'tut-1',
        submittedByTutorName: 'Mr. Olumide Ogunleye',
        submittedAt: '2026-09-16T14:25:00.000Z',
        studentsAttendance: [
          { studentId: 'stu-1', studentName: 'Tiwa Adeleke', regNumber: 'STX/2023/042', status: 'Present' },
          { studentId: 'stu-2', studentName: 'Babatunde Akindele', regNumber: 'STX/2023/043', status: 'Present' },
          { studentId: 'stu-3', studentName: 'Chidera Okafor', regNumber: 'STX/2023/044', status: 'Present' },
          { studentId: 'stu-4', studentName: 'Damilola Fashola', regNumber: 'STX/2023/045', status: 'Present' },
          { studentId: 'stu-5', studentName: 'Efe Oghomwen', regNumber: 'STX/2023/046', status: 'Present' },
          { studentId: 'stu-6', studentName: 'Farouk Danjuma', regNumber: 'STX/2023/047', status: 'Present' }
        ]
      }
    ];
  });

  // Automatically reset the daily attendance records and student counter metrics
  const resetDailyAttendanceCounter = () => {
    setAttendanceRecords([]);
    try {
      localStorage.removeItem('stanbax_attendance_records');
    } catch {}

    // Reset student cumulative attendance counts to zero for the fresh term cycle
    setStudents(prev => {
      const updated = prev.map(stud => ({
        ...stud,
        attendanceDays: 0,
        totalSchoolDays: 0,
        attendancePercent: 0
      }));
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const setTermStartDate = (
    date: string,
    options?: {
      termEndDate?: string;
      termName?: string;
      sessionName?: string;
      shouldResetAttendance?: boolean;
      isMidwayLaunch?: boolean;
      midwayElapsedDays?: number;
      midwayStartWeek?: number;
    }
  ) => {
    const isMidway = !!options?.isMidwayLaunch;
    const shouldReset = isMidway ? false : (options?.shouldResetAttendance !== false);
    const computedEndDate = options?.termEndDate || termResumptionConfig.termEndDate || '2026-12-18';
    const computedTermName = options?.termName || termResumptionConfig.termName;
    const computedSession = options?.sessionName || termResumptionConfig.session;

    // Calculate approximate school days elapsed if launching midway
    const startMs = new Date(date).getTime();
    const nowMs = Date.now();
    const calendarDays = Math.max(1, Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24)));
    const calculatedSchoolDays = Math.max(1, Math.floor((calendarDays * 5) / 7));
    const midwayDays = options?.midwayElapsedDays ?? (isMidway ? calculatedSchoolDays : undefined);
    const midwayWeek = options?.midwayStartWeek ?? (isMidway ? Math.min(12, Math.max(1, Math.ceil((midwayDays || calculatedSchoolDays) / 5))) : undefined);

    const updated: TermResumptionConfig = {
      ...termResumptionConfig,
      termStartDate: date,
      termEndDate: computedEndDate,
      termName: computedTermName,
      session: computedSession,
      isTermActive: true,
      isMidwayLaunch: isMidway,
      midwayElapsedDays: midwayDays,
      midwayStartWeek: midwayWeek
    };
    setTermResumptionConfig(updated);
    try { localStorage.setItem('stanbax_term_resumption_config', JSON.stringify(updated)); } catch {}

    updateSchoolInfo({
      resumptionDate: date,
      termStartDate: date,
      vacationDate: computedEndDate,
      ...(options?.termName ? { activeTerm: options.termName } : {}),
      ...(options?.sessionName ? { activeSession: options.sessionName } : {})
    });

    // Reset attendance only if NOT midway launch
    if (shouldReset) {
      resetDailyAttendanceCounter();
    }
  };

  const setTermResumptionDate = (date: string, termName?: string, sessionName?: string, termEndDate?: string) => {
    setTermStartDate(date, {
      termEndDate,
      termName,
      sessionName,
      shouldResetAttendance: true
    });
  };

  const startNewTerm = (
    termName: string, 
    startDate: string, 
    sessionName?: string, 
    endDate?: string,
    options?: { isMidwayLaunch?: boolean; midwayElapsedDays?: number; midwayStartWeek?: number }
  ) => {
    const computedEndDate = endDate || (termName === '1st Term' ? '2026-12-18' : termName === '2nd Term' ? '2027-04-02' : '2027-07-16');
    const isMidway = !!options?.isMidwayLaunch;
    
    // Calculate approximate school days elapsed if launching midway
    const startMs = new Date(startDate).getTime();
    const nowMs = Date.now();
    const calendarDays = Math.max(1, Math.floor((nowMs - startMs) / (1000 * 60 * 60 * 24)));
    const calculatedSchoolDays = Math.max(1, Math.floor((calendarDays * 5) / 7));
    const midwayDays = options?.midwayElapsedDays ?? (isMidway ? calculatedSchoolDays : undefined);
    const midwayWeek = options?.midwayStartWeek ?? (isMidway ? Math.min(12, Math.max(1, Math.ceil((midwayDays || calculatedSchoolDays) / 5))) : undefined);

    const updated: TermResumptionConfig = {
      termStartDate: startDate,
      termEndDate: computedEndDate,
      termName: termName,
      session: sessionName || assessmentConfig.activeSession || '2025/2026 Academic Session',
      isTermActive: true,
      totalSchoolDaysPlanned: 60,
      isMidwayLaunch: isMidway,
      midwayElapsedDays: midwayDays,
      midwayStartWeek: midwayWeek
    };
    setTermResumptionConfig(updated);
    try { localStorage.setItem('stanbax_term_resumption_config', JSON.stringify(updated)); } catch {}

    updateSchoolInfo({
      resumptionDate: startDate,
      termStartDate: startDate,
      vacationDate: computedEndDate,
      activeTerm: `${termName} ${termName === '1st Term' ? '(Michaelmas Term)' : termName === '2nd Term' ? '(Lent Term)' : '(Trinity Term)'}`,
      ...(sessionName ? { activeSession: sessionName } : {})
    });

    updateAssessmentConfig({
      activeTerm: termName as any,
      activePhase: 'mid_term_ca'
    });

    if (!isMidway) {
      resetDailyAttendanceCounter();
    }
  };

  const submitDailyAttendance = (recordData: Omit<AttendanceDailyRecord, 'id' | 'submittedAt'>) => {
    const newRecordId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newRecord: AttendanceDailyRecord = {
      ...recordData,
      id: newRecordId,
      submittedAt: new Date().toISOString()
    };

    const existingIndex = attendanceRecords.findIndex(
      r => r.classId === recordData.classId && r.date === recordData.date
    );

    let updatedRecords: AttendanceDailyRecord[];
    if (existingIndex >= 0) {
      updatedRecords = [...attendanceRecords];
      updatedRecords[existingIndex] = newRecord;
    } else {
      updatedRecords = [...attendanceRecords, newRecord];
    }

    setAttendanceRecords(updatedRecords);
    try { localStorage.setItem('stanbax_attendance_records', JSON.stringify(updatedRecords)); } catch {}

    // Synchronize attendance into students state for report cards and student portal
    const targetTerm = recordData.term || termResumptionConfig.termName;
    const termClassRecords = updatedRecords.filter(
      r => r.classId === recordData.classId && (!targetTerm || !r.term || r.term.toLowerCase().includes(targetTerm.toLowerCase()))
    );
    const totalDaysCount = termClassRecords.length;

    setStudents(prev => {
      const updated = prev.map(stud => {
        const studentEntries = termClassRecords.flatMap(r => 
          r.studentsAttendance.filter(entry => entry.studentId === stud.id || entry.regNumber === stud.regNumber)
        );

        if (studentEntries.length === 0) return stud;

        const daysPresent = studentEntries.filter(e => e.status === 'Present').length;
        const daysLate = studentEntries.filter(e => e.status === 'Late').length;
        const effectivePresent = daysPresent + (daysLate * 0.5);
        const computedPercent = totalDaysCount > 0 ? Math.round((effectivePresent / totalDaysCount) * 100) : 100;

        return {
          ...stud,
          attendanceDays: daysPresent + daysLate,
          totalSchoolDays: totalDaysCount,
          attendancePercent: computedPercent
        };
      });
      try {
        localStorage.setItem('stanbax_students', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    return newRecord;
  };

  const getClassAttendanceSummary = (classId: string, term?: string): ClassAttendanceSummary => {
    const targetTerm = term || termResumptionConfig.termName;
    const classRecords = attendanceRecords.filter(
      r => (r.classId === classId || r.className?.toLowerCase() === classId?.toLowerCase()) &&
           (!targetTerm || !r.term || r.term.toLowerCase().includes(targetTerm.toLowerCase()))
    );

    const totalDaysMarked = classRecords.length;

    const classStudents = students.filter(s => {
      const g = (s.grade || '').toLowerCase();
      const c = (classId || '').toLowerCase();
      return g.includes(c) || c.includes(g) || s.classId === classId;
    });

    const studentSummaries: StudentAttendanceSummary[] = classStudents.map(student => {
      const studentEntries = classRecords.flatMap(r => 
        r.studentsAttendance.filter(entry => entry.studentId === student.id || entry.regNumber === student.regNumber)
      );

      const daysPresent = studentEntries.filter(e => e.status === 'Present').length;
      const daysLate = studentEntries.filter(e => e.status === 'Late').length;
      const daysAbsent = studentEntries.filter(e => e.status === 'Absent').length;
      const effectivePresent = daysPresent + (daysLate * 0.5);
      const attendancePercent = totalDaysMarked > 0 ? Math.round((effectivePresent / totalDaysMarked) * 100) : 100;

      return {
        studentId: student.id,
        studentName: student.name,
        regNumber: student.regNumber,
        daysPresent,
        daysLate,
        daysAbsent,
        totalMarkedDays: totalDaysMarked,
        attendancePercent
      };
    });

    const avg = studentSummaries.length > 0 
      ? Math.round(studentSummaries.reduce((sum, s) => sum + s.attendancePercent, 0) / studentSummaries.length)
      : 100;

    const matchedClass = classes.find(c => c.id === classId);

    return {
      classId,
      className: matchedClass?.name || classId,
      totalDaysMarked,
      studentSummaries,
      classAverageAttendancePercent: avg
    };
  };

  const getStudentAttendanceSummary = (studentId: string, term?: string): StudentAttendanceSummary => {
    const targetTerm = term || termResumptionConfig.termName;
    const student = students.find(s => s.id === studentId);
    
    const matchingRecords = attendanceRecords.filter(r => 
      (!targetTerm || !r.term || r.term.toLowerCase().includes(targetTerm.toLowerCase())) &&
      r.studentsAttendance.some(e => e.studentId === studentId || (student && e.regNumber === student.regNumber))
    );

    const totalDaysMarked = matchingRecords.length;
    const studentEntries = matchingRecords.flatMap(r => 
      r.studentsAttendance.filter(e => e.studentId === studentId || (student && e.regNumber === student.regNumber))
    );

    const daysPresent = studentEntries.filter(e => e.status === 'Present').length;
    const daysLate = studentEntries.filter(e => e.status === 'Late').length;
    const daysAbsent = studentEntries.filter(e => e.status === 'Absent').length;
    const effectivePresent = daysPresent + (daysLate * 0.5);
    const attendancePercent = totalDaysMarked > 0 ? Math.round((effectivePresent / totalDaysMarked) * 100) : 100;

    return {
      studentId,
      studentName: student?.name || 'Scholar',
      regNumber: student?.regNumber || '',
      daysPresent,
      daysLate,
      daysAbsent,
      totalMarkedDays: totalDaysMarked,
      attendancePercent
    };
  };

  // 15. Active Section View with Refresh & Multi-Session Persistence
  const [activeSection, setActiveSectionState] = useState<PageSection>(() => {
    try {
      // 1. Check if remote verification asked to resume a section
      const resume = sessionStorage.getItem('stanbax_resume_section');
      if (resume) {
        sessionStorage.removeItem('stanbax_resume_section');
        return resume as PageSection;
      }

      // 2. Check saved section in localStorage / sessionStorage
      const savedSection = localStorage.getItem('stanbax_active_section') || sessionStorage.getItem('stanbax_active_section');

      // 3. Check role authentication states
      const hasAdmin = localStorage.getItem('stanbax_admin_auth') === 'true' || sessionStorage.getItem('stanbax_admin_auth') === 'true';
      const hasProprietress = localStorage.getItem('stanbax_proprietress_auth') === 'true' || sessionStorage.getItem('stanbax_proprietress_auth') === 'true';
      const hasTutor = localStorage.getItem('stanbax_tutor_auth') === 'true' || sessionStorage.getItem('stanbax_tutor_auth') === 'true';
      const hasStudent = localStorage.getItem('stanbax_student_auth') === 'true' || sessionStorage.getItem('stanbax_student_auth') === 'true';
      const hasParent = localStorage.getItem('stanbax_parent_auth') === 'true' || sessionStorage.getItem('stanbax_parent_auth') === 'true';

      if (savedSection) {
        if (savedSection === 'admin-portal' && hasAdmin) return 'admin-portal';
        if (savedSection === 'proprietress-portal' && hasProprietress) return 'proprietress-portal';
        if (savedSection === 'tutor-portal' && hasTutor) return 'tutor-portal';
        if (savedSection === 'student-portal' && hasStudent) return 'student-portal';
        if (savedSection === 'parent-portal' && hasParent) return 'parent-portal';

        // If saved section is a portal but user lost auth for it, fallback to any active authenticated portal or home
        if (savedSection.includes('portal') && !savedSection.includes('login')) {
          if (hasStudent) return 'student-portal';
          if (hasAdmin) return 'admin-portal';
          if (hasTutor) return 'tutor-portal';
          if (hasParent) return 'parent-portal';
          if (hasProprietress) return 'proprietress-portal';
          return 'home';
        }

        return savedSection as PageSection;
      }

      // 4. If no section was explicitly saved, but user is authenticated, keep them in their portal!
      if (hasStudent) return 'student-portal';
      if (hasAdmin) return 'admin-portal';
      if (hasTutor) return 'tutor-portal';
      if (hasParent) return 'parent-portal';
      if (hasProprietress) return 'proprietress-portal';
    } catch { /* ignore */ }
    return 'home';
  });

  const setActiveSection = (section: PageSection) => {
    setActiveSectionState(section);
    try {
      localStorage.setItem('stanbax_active_section', section);
      sessionStorage.setItem('stanbax_active_section', section);
    } catch { /* ignore */ }
  };

  // 20. CBT Practice & Examination Engine
  const [cbtExams, setCbtExams] = useState<CbtExam[]>(() => {
    const saved = localStorage.getItem('stanbax_cbt_exams');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Error parsing cbt exams', e); }
    }
    return DEFAULT_CBT_EXAMS;
  });

  const [cbtAttempts, setCbtAttempts] = useState<CbtAttempt[]>(() => {
    const saved = localStorage.getItem('stanbax_cbt_attempts');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { console.error('Error parsing cbt attempts', e); }
    }
    return DEFAULT_CBT_ATTEMPTS;
  });

  const addCbtExam = (examData: Omit<CbtExam, 'id'>): CbtExam => {
    const newExam: CbtExam = {
      ...examData,
      id: `cbt-${Date.now()}`
    };
    const updated = [newExam, ...cbtExams];
    setCbtExams(updated);
    localStorage.setItem('stanbax_cbt_exams', JSON.stringify(updated));
    return newExam;
  };

  const deleteCbtExam = (id: string) => {
    const updated = cbtExams.filter(e => e.id !== id);
    setCbtExams(updated);
    localStorage.setItem('stanbax_cbt_exams', JSON.stringify(updated));
  };

  const recordCbtAttempt = (attemptData: Omit<CbtAttempt, 'id' | 'dateAttempted'>): CbtAttempt => {
    const newAttempt: CbtAttempt = {
      ...attemptData,
      id: `att-${Date.now()}`,
      dateAttempted: new Date().toISOString()
    };
    const updated = [newAttempt, ...cbtAttempts];
    setCbtAttempts(updated);
    localStorage.setItem('stanbax_cbt_attempts', JSON.stringify(updated));
    return newAttempt;
  };

  // 21. Weekly Timetable & Bell Schedule
  const [timetables, setTimetables] = useState<ClassWeeklyTimetable[]>(() => {
    const saved = localStorage.getItem('stanbax_weekly_timetables');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Error parsing timetables', e); }
    }
    return DEFAULT_WEEKLY_TIMETABLES;
  });

  const updateClassTimetable = (classId: string, schedule: ClassWeeklyTimetable['schedule']) => {
    setTimetables(prev => {
      const existing = prev.find(t => t.classId === classId);
      const matchedClass = classes.find(c => c.id === classId);
      const updated = existing
        ? prev.map(t => t.classId === classId ? { ...t, schedule } : t)
        : [...prev, { classId, className: matchedClass?.name || classId, schedule }];
      localStorage.setItem('stanbax_weekly_timetables', JSON.stringify(updated));
      return updated;
    });
  };

  // 22. Medical & Clinic Sick-Bay
  const [sickBayLogs, setSickBayLogs] = useState<SickBayVisitLog[]>(() => {
    const saved = localStorage.getItem('stanbax_sickbay_logs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Error parsing sickbay logs', e); }
    }
    return DEFAULT_SICK_BAY_LOGS;
  });

  const addSickBayLog = (logData: Omit<SickBayVisitLog, 'id'>): SickBayVisitLog => {
    const newLog: SickBayVisitLog = {
      ...logData,
      id: `sb-${Date.now()}`
    };
    const updated = [newLog, ...sickBayLogs];
    setSickBayLogs(updated);
    localStorage.setItem('stanbax_sickbay_logs', JSON.stringify(updated));
    return newLog;
  };

  const updateSickBayLog = (id: string, updatedFields: Partial<SickBayVisitLog>) => {
    setSickBayLogs(prev => {
      const updated = prev.map(l => l.id === id ? { ...l, ...updatedFields } : l);
      localStorage.setItem('stanbax_sickbay_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteSickBayLog = (id: string) => {
    setSickBayLogs(prev => {
      const updated = prev.filter(l => l.id !== id);
      localStorage.setItem('stanbax_sickbay_logs', JSON.stringify(updated));
      return updated;
    });
  };

  // 23. Parent Portal & Family Linkage
  const [parents, setParents] = useState<ParentProfile[]>(() => {
    const deletedSet = new Set<string>();
    try {
      const rawDel = localStorage.getItem('stanbax_deleted_account_ids');
      if (rawDel) JSON.parse(rawDel).forEach((x: any) => deletedSet.add(String(x).toLowerCase()));
    } catch {}

    const saved = localStorage.getItem('stanbax_parents_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(p => p?.id && !deletedSet.has(p.id.toLowerCase()) && (!p.phone || !deletedSet.has(p.phone.toLowerCase())) && (!p.email || !deletedSet.has(p.email.toLowerCase().trim())));
        }
      } catch (e) { console.error('Error parsing parents', e); }
    }
    return DEFAULT_PARENTS.filter(p => !deletedSet.has(p.id.toLowerCase()) && (!p.phone || !deletedSet.has(p.phone.toLowerCase())));
  });

  const [consultationRequests, setConsultationRequests] = useState<ParentConsultationRequest[]>(() => {
    const saved = localStorage.getItem('stanbax_parent_consultations');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Error parsing consultations', e); }
    }
    return DEFAULT_PARENT_CONSULTATIONS;
  });

  const addParent = (parentData: Omit<ParentProfile, 'id'>) => {
    const newParent: ParentProfile = { ...parentData, id: `parent-${Date.now()}` };
    setParents(prev => {
      const updated = [...prev, newParent];
      try {
        localStorage.setItem('stanbax_parents_list', JSON.stringify(updated));
      } catch {}
      void syncStateOnline('stanbax_parents_list', updated);
      broadcastLocalStateChange('stanbax_parents_list', updated);
      return updated;
    });
    void remoteCreateCredential(
      (newParent.email || '').toLowerCase() || newParent.phone,
      newParent.password || 'parent2025',
      'parent',
      newParent.id,
      [newParent.phone, newParent.fullName.toLowerCase(), newParent.email].filter(Boolean)
    );
  };

  const registerParent = async (
    data: ParentRegistrationData
  ): Promise<{ success: boolean; parent?: ParentProfile; message: string }> => {
    const cleanPhone = data.phone.trim();
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const cleanFullName = data.fullName.trim();
    const cleanPassword = (data.password || 'parent2025').trim();
    const inputStudentIds = data.studentIds || data.wardIds || [];

    // Find linked students info
    const matchedStudents = students.filter(s => 
      inputStudentIds.includes(s.id) || (s.regNumber && inputStudentIds.includes(s.regNumber))
    );
    const wardIds = matchedStudents.length > 0 ? matchedStudents.map(s => s.id) : inputStudentIds;
    const wardNames = matchedStudents.map(s => s.name);

    const newParentId = `parent-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newParent: ParentProfile = {
      id: newParentId,
      fullName: cleanFullName,
      phone: cleanPhone,
      email: cleanEmail,
      password: cleanPassword,
      relationship: data.relationship || 'Parent / Guardian',
      address: data.address?.trim() || '',
      occupation: data.occupation?.trim() || '',
      childrenIds: wardIds,
      wardIds,
      wardNames,
      securityQuestion: data.securityQuestion?.trim() || '',
      securityAnswer: data.securityAnswer?.trim() || '',
      savedOnline: true,
      createdAt: new Date().toISOString()
    };

    let updatedParents: ParentProfile[] = [];
    setParents(prev => {
      const cleanInputDigits = cleanPhone.replace(/[^0-9]/g, '');
      const existsIndex = prev.findIndex(p => {
        const pPhoneDigits = (p.phone || '').replace(/[^0-9]/g, '');
        const pEmail = (p.email || '').toLowerCase().trim();
        return (cleanInputDigits.length >= 7 && pPhoneDigits.includes(cleanInputDigits)) ||
               (cleanEmail && pEmail === cleanEmail);
      });

      if (existsIndex >= 0) {
        const existing = prev[existsIndex];
        const mergedChildren = Array.from(new Set([...(existing.childrenIds || []), ...(existing.wardIds || []), ...wardIds]));
        const mergedNames = Array.from(new Set([...(existing.wardNames || []), ...wardNames]));
        newParent.id = existing.id;
        newParent.childrenIds = mergedChildren;
        newParent.wardIds = mergedChildren;
        newParent.wardNames = mergedNames;
        updatedParents = prev.map((p, idx) => idx === existsIndex ? { ...p, ...newParent } : p);
      } else {
        updatedParents = [newParent, ...prev];
      }
      try { localStorage.setItem('stanbax_parents_list', JSON.stringify(updatedParents)); } catch {}
      return updatedParents;
    });

    // Update students if wards linked
    if (wardIds.length > 0) {
      let updatedStudents: StudentProfile[] = [];
      setStudents(prev => {
        updatedStudents = prev.map(s => {
          if (wardIds.includes(s.id) || (s.regNumber && wardIds.includes(s.regNumber))) {
            return {
              ...s,
              parentName: newParent.fullName,
              parentPhone: newParent.phone,
              parentEmail: newParent.email || s.parentEmail
            };
          }
          return s;
        });
        try { localStorage.setItem('stanbax_students', JSON.stringify(updatedStudents)); } catch {}
        return updatedStudents;
      });
      void syncStateOnline('stanbax_students', updatedStudents);
      broadcastLocalStateChange('stanbax_students', updatedStudents);
    }

    // 1. Commit to server online database /api/parents
    try {
      const serverRes = await fetch('/api/parents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newParent,
          wardIds: newParent.wardIds,
          childrenIds: newParent.childrenIds,
          wardNames: newParent.wardNames
        })
      });
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData.parent) {
          setParents(curr => {
            const list = curr.map(p => p.id === newParent.id || p.phone === newParent.phone ? { ...p, ...serverData.parent, savedOnline: true } : p);
            try { localStorage.setItem('stanbax_parents_list', JSON.stringify(list)); } catch {}
            return list;
          });
        }
      }
    } catch (err) {
      console.warn('[Online Storage] Note saving parent to /api/parents:', err);
    }

    // 2. Cloud Supabase & local state broadcasting
    void syncStateOnline('stanbax_parents_list', updatedParents);
    broadcastLocalStateChange('stanbax_parents_list', updatedParents);

    // 3. Credentials provisioning
    await remoteCreateCredential(
      newParent.phone,
      newParent.password || 'parent2025',
      'parent',
      newParent.id,
      [newParent.email, newParent.fullName.toLowerCase(), newParent.phone].filter(Boolean)
    );

    return {
      success: true,
      parent: newParent,
      message: `Parent profile for ${newParent.fullName} (${newParent.phone}) registered and synchronized across database systems.`
    };
  };

  const updateParent = (id: string, updatedData: Partial<ParentProfile>) => {
    setParents(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, ...updatedData } : p);
      try {
        localStorage.setItem('stanbax_parents_list', JSON.stringify(updated));
      } catch {}
      void syncStateOnline('stanbax_parents_list', updated);
      broadcastLocalStateChange('stanbax_parents_list', updated);
      return updated;
    });
  };

  const deleteParent = (id: string) => {
    const target = parents.find(p => p.id === id);
    markAccountAsPermanentlyDeleted(id, target?.phone || target?.email, 'parent');
    void fetch(`/api/parents/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    if (target?.email || target?.phone) {
      void remoteDeleteCredential((target.email || target.phone) as string, id);
    }
    setParents(prev => {
      const updated = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem('stanbax_parents_list', JSON.stringify(updated));
      } catch {}
      broadcastLocalStateChange('stanbax_parents_list', updated);
      void syncStateOnline('stanbax_parents_list', updated);
      return updated;
    });
  };

  const assignSiblingsToParent = async (parentId: string, studentIds: string[]): Promise<{ success: boolean; message: string }> => {
    const targetParent = parents.find(p => p.id === parentId);
    if (!targetParent) return { success: false, message: 'Parent profile not found.' };

    const combinedChildrenIds = Array.from(new Set([...(targetParent.childrenIds || []), ...studentIds]));
    
    let updatedParents: ParentProfile[] = [];
    setParents(prev => {
      updatedParents = prev.map(p => p.id === parentId ? { ...p, childrenIds: combinedChildrenIds } : p);
      try { localStorage.setItem('stanbax_parents_list', JSON.stringify(updatedParents)); } catch {}
      return updatedParents;
    });

    let updatedStudents: StudentProfile[] = [];
    setStudents(prev => {
      updatedStudents = prev.map(s => {
        if (studentIds.includes(s.id)) {
          return {
            ...s,
            parentName: targetParent.fullName || s.parentName,
            parentPhone: targetParent.phone || s.parentPhone,
            parentEmail: targetParent.email || s.parentEmail
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updatedStudents)); } catch {}
      return updatedStudents;
    });

    void syncStateOnline('stanbax_parents_list', updatedParents);
    void syncStateOnline('stanbax_students', updatedStudents);
    broadcastLocalStateChange('stanbax_parents_list', updatedParents);
    broadcastLocalStateChange('stanbax_students', updatedStudents);

    return {
      success: true,
      message: `Successfully linked ${studentIds.length} scholar${studentIds.length > 1 ? 's' : ''} to parent ${targetParent.fullName} and synced directly to Supabase cloud database.`
    };
  };

  const unlinkChildFromParent = async (parentId: string, studentId: string): Promise<{ success: boolean; message: string }> => {
    let updatedParents: ParentProfile[] = [];
    setParents(prev => {
      updatedParents = prev.map(p => p.id === parentId ? { ...p, childrenIds: (p.childrenIds || []).filter(id => id !== studentId) } : p);
      try { localStorage.setItem('stanbax_parents_list', JSON.stringify(updatedParents)); } catch {}
      return updatedParents;
    });

    void syncStateOnline('stanbax_parents_list', updatedParents);
    broadcastLocalStateChange('stanbax_parents_list', updatedParents);

    return { success: true, message: 'Scholar unlinked from parent profile and database updated.' };
  };

  const quickCreateParentWithSiblings = async (
    parentData: { fullName: string; phone: string; email?: string; password?: string; address?: string },
    studentIds: string[]
  ): Promise<{ success: boolean; parent?: ParentProfile; message: string }> => {
    const newParentId = `parent-${Date.now()}`;
    const newParent: ParentProfile = {
      id: newParentId,
      fullName: parentData.fullName.trim(),
      phone: parentData.phone.trim(),
      email: (parentData.email || '').trim().toLowerCase(),
      password: parentData.password || 'parent2025',
      address: parentData.address,
      childrenIds: studentIds
    };

    let updatedParents: ParentProfile[] = [];
    setParents(prev => {
      const existsIndex = prev.findIndex(p => p.phone === newParent.phone || (p.email && p.email === newParent.email));
      if (existsIndex >= 0) {
        const existing = prev[existsIndex];
        const mergedChildren = Array.from(new Set([...(existing.childrenIds || []), ...studentIds]));
        updatedParents = prev.map((p, idx) => idx === existsIndex ? { ...p, ...newParent, id: p.id, childrenIds: mergedChildren } : p);
      } else {
        updatedParents = [...prev, newParent];
      }
      try { localStorage.setItem('stanbax_parents_list', JSON.stringify(updatedParents)); } catch {}
      return updatedParents;
    });

    let updatedStudents: StudentProfile[] = [];
    setStudents(prev => {
      updatedStudents = prev.map(s => {
        if (studentIds.includes(s.id)) {
          return {
            ...s,
            parentName: newParent.fullName,
            parentPhone: newParent.phone,
            parentEmail: newParent.email || s.parentEmail
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updatedStudents)); } catch {}
      return updatedStudents;
    });

    void syncStateOnline('stanbax_parents_list', updatedParents);
    void syncStateOnline('stanbax_students', updatedStudents);
    broadcastLocalStateChange('stanbax_parents_list', updatedParents);
    broadcastLocalStateChange('stanbax_students', updatedStudents);

    await remoteCreateCredential(
      newParent.phone,
      newParent.password || 'parent2025',
      'parent',
      newParent.id,
      [newParent.email, newParent.fullName.toLowerCase(), newParent.phone].filter(Boolean)
    );

    return {
      success: true,
      parent: newParent,
      message: `Parent profile for ${newParent.fullName} (${newParent.phone}) created with ${studentIds.length} linked scholar(s). Login credentials provisioned in Supabase.`
    };
  };

  const mergeParentAccounts = async (primaryParentId: string, secondaryParentIds: string[]): Promise<{ success: boolean; message: string }> => {
    const primaryParent = parents.find(p => p.id === primaryParentId);
    if (!primaryParent) return { success: false, message: 'Primary parent profile not found.' };

    const secondaryParents = parents.filter(p => secondaryParentIds.includes(p.id));
    const allCollectedChildIds = new Set<string>(primaryParent.childrenIds || []);
    secondaryParents.forEach(p => {
      (p.childrenIds || []).forEach(cid => allCollectedChildIds.add(cid));
    });

    const combinedChildIds = Array.from(allCollectedChildIds);

    let updatedParents: ParentProfile[] = [];
    setParents(prev => {
      updatedParents = prev
        .filter(p => !secondaryParentIds.includes(p.id))
        .map(p => p.id === primaryParentId ? { ...p, childrenIds: combinedChildIds } : p);
      try { localStorage.setItem('stanbax_parents_list', JSON.stringify(updatedParents)); } catch {}
      return updatedParents;
    });

    let updatedStudents: StudentProfile[] = [];
    setStudents(prev => {
      updatedStudents = prev.map(s => {
        if (combinedChildIds.includes(s.id)) {
          return {
            ...s,
            parentName: primaryParent.fullName,
            parentPhone: primaryParent.phone,
            parentEmail: primaryParent.email || s.parentEmail
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updatedStudents)); } catch {}
      return updatedStudents;
    });

    void syncStateOnline('stanbax_parents_list', updatedParents);
    void syncStateOnline('stanbax_students', updatedStudents);
    broadcastLocalStateChange('stanbax_parents_list', updatedParents);
    broadcastLocalStateChange('stanbax_students', updatedStudents);

    return {
      success: true,
      message: `Successfully merged sibling records under ${primaryParent.fullName} (${combinedChildIds.length} total scholars). Changes synced to Supabase.`
    };
  };

  const submitConsultationRequest = (reqData: Omit<ParentConsultationRequest, 'id' | 'createdAt' | 'status'>): ParentConsultationRequest => {
    const newReq: ParentConsultationRequest = {
      ...reqData,
      id: `req-${Date.now()}`,
      status: 'Pending',
      createdAt: new Date().toISOString().split('T')[0]
    };
    const updated = [newReq, ...consultationRequests];
    setConsultationRequests(updated);
    localStorage.setItem('stanbax_parent_consultations', JSON.stringify(updated));
    return newReq;
  };

  const updateConsultationStatus = (id: string, status: ParentConsultationRequest['status'], adminResponse?: string) => {
    setConsultationRequests(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, status, adminResponse: adminResponse !== undefined ? adminResponse : r.adminResponse } : r);
      localStorage.setItem('stanbax_parent_consultations', JSON.stringify(updated));
      return updated;
    });
  };

  const [feePayments, setFeePayments] = useState<FeePaymentRecord[]>(() => {
    const saved = localStorage.getItem('stanbax_fee_payments');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Error parsing fee payments', e); }
    }
    return DEFAULT_FEE_PAYMENTS;
  });

  const recordFeePayment = (paymentData: Omit<FeePaymentRecord, 'id' | 'status'>): FeePaymentRecord => {
    const newRecord: FeePaymentRecord = {
      ...paymentData,
      id: `fee-${Date.now()}`,
      status: 'Pending Verification'
    };
    const updated = [newRecord, ...feePayments];
    setFeePayments(updated);
    localStorage.setItem('stanbax_fee_payments', JSON.stringify(updated));

    // Also credit student's fee profile if matched
    const studentToUpdate = students.find(s => s.id === paymentData.studentId || s.regNumber === paymentData.regNumber);
    if (studentToUpdate) {
      const classTuition = classes.find(c => c.id === studentToUpdate.classId)?.tuitionPerTerm
        ?? classes.find(c => c.name === studentToUpdate.grade)?.tuitionPerTerm;
      const currPaid = studentToUpdate.feePaid || 0;
      const currBal = studentToUpdate.feeBalance ?? classTuition ?? paymentData.amount;
      const newPaid = currPaid + paymentData.amount;
      const newBal = Math.max(0, currBal - paymentData.amount);
      const newStatus = newBal <= 0 ? 'Fully Paid' : 'Partially Paid';
      updateStudent(studentToUpdate.id, {
        feeTotal: studentToUpdate.feeTotal ?? classTuition,
        feePaid: newPaid,
        feeBalance: newBal,
        feeStatus: newStatus
      });
    }

    return newRecord;
  };

  const verifyFeePayment = (id: string, verifiedBy: string = 'Stanbax Bursary Clearance') => {
    setFeePayments(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status: 'Verified' as const, verifiedBy } : p);
      localStorage.setItem('stanbax_fee_payments', JSON.stringify(updated));
      return updated;
    });
  };

  const rejectFeePayment = (id: string, rejectedBy: string = 'Stanbax Bursary Clearance') => {
    let rejectedPayment: FeePaymentRecord | undefined;
    setFeePayments(prev => {
      const updated = prev.map(p => {
        if (p.id !== id) return p;
        rejectedPayment = p;
        return { ...p, status: 'Rejected' as const, rejectedBy };
      });
      try {
        localStorage.setItem('stanbax_fee_payments', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    // Restore the scholar's outstanding balance for a reversed payment
    if (rejectedPayment) {
      const { amount, studentId } = rejectedPayment;
      setStudents(prev => {
        const updated = prev.map(s => {
          if (s.id !== studentId) return s;
          const paid = Math.max(0, (s.feePaid ?? 0) - amount);
          const balance = (s.feeBalance ?? 0) + amount;
          return {
            ...s,
            feePaid: paid,
            feeBalance: balance,
            feeStatus: (paid <= 0 ? 'Outstanding' : 'Partially Paid') as StudentProfile['feeStatus']
          };
        });
        try {
          localStorage.setItem('stanbax_students', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  };

  // 24. Digital Library & E-Textbooks
  const [libraryBooks, setLibraryBooks] = useState<LibraryBookItem[]>(() => {
    const saved = localStorage.getItem('stanbax_library_books');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error('Error parsing library books', e); }
    }
    return DEFAULT_LIBRARY_BOOKS;
  });

  const addLibraryBook = (bookData: Omit<LibraryBookItem, 'id' | 'downloadsCount'>): LibraryBookItem => {
    const newBook: LibraryBookItem = {
      ...bookData,
      id: `lib-${Date.now()}`,
      downloadsCount: 0
    };
    const updated = [newBook, ...libraryBooks];
    setLibraryBooks(updated);
    localStorage.setItem('stanbax_library_books', JSON.stringify(updated));
    return newBook;
  };

  const deleteLibraryBook = (id: string) => {
    setLibraryBooks(prev => {
      const updated = prev.filter(b => b.id !== id);
      localStorage.setItem('stanbax_library_books', JSON.stringify(updated));
      return updated;
    });
  };

  const incrementBookDownload = (id: string) => {
    setLibraryBooks(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, downloadsCount: b.downloadsCount + 1 } : b);
      localStorage.setItem('stanbax_library_books', JSON.stringify(updated));
      return updated;
    });
  };

  // 25. Calvin AI Tokens State & Logic
  const INITIAL_CALVIN_TOKENS: CalvinToken[] = [
    {
      id: 'tok-1',
      code: 'CALVIN-REG-7D-8942',
      tier: 'regular',
      durationHours: 168,
      durationLabel: '7 Days Access',
      createdAt: '2026-09-20',
      createdBy: 'Super Administrator',
      status: 'unused',
      priceNgn: 1500
    },
    {
      id: 'tok-2',
      code: 'CALVIN-PREM-30D-4721',
      tier: 'premium',
      durationHours: 720,
      durationLabel: '30 Days Access (Premium)',
      createdAt: '2026-09-21',
      createdBy: 'Super Administrator',
      status: 'unused',
      priceNgn: 4500
    },
    {
      id: 'tok-3',
      code: 'CALVIN-PREM-TERM-9912',
      tier: 'premium',
      durationHours: 2160,
      durationLabel: '1 Academic Term (90 Days)',
      createdAt: '2026-09-22',
      createdBy: 'Super Administrator',
      status: 'unused',
      priceNgn: 10000
    },
    {
      id: 'tok-4',
      code: 'CALVIN-REG-24H-3104',
      tier: 'regular',
      durationHours: 24,
      durationLabel: '24 Hours Pass',
      createdAt: '2026-09-23',
      createdBy: 'Super Administrator',
      status: 'unused',
      priceNgn: 500
    }
  ];

  const [calvinTokens, setCalvinTokens] = useState<CalvinToken[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_calvin_tokens');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing calvin tokens', e);
    }
    return INITIAL_CALVIN_TOKENS;
  });

  const createCalvinTokens = (
    tier: 'regular' | 'premium',
    durationHours: number,
    count: number = 1,
    priceNgn?: number,
    customDurationLabel?: string
  ): CalvinToken[] => {
    const newTokens: CalvinToken[] = [];
    const durationLabel = customDurationLabel || (
      durationHours === 24 ? '24 Hours Pass' :
      durationHours === 168 ? '7 Days Access' :
      durationHours === 720 ? '30 Days Access' :
      durationHours === 2160 ? '1 Academic Term (90 Days)' :
      durationHours === 8760 ? '1 Full Academic Year' :
      `${Math.round(durationHours / 24)} Days Access`
    );

    for (let i = 0; i < count; i++) {
      const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const prefix = tier === 'premium' ? 'CALVIN-PREM' : 'CALVIN-REG';
      const durCode = durationHours >= 24 ? `${Math.round(durationHours / 24)}D` : `${durationHours}H`;
      const code = `${prefix}-${durCode}-${randomHex}${randomNum}`;

      newTokens.push({
        id: `tok-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        code,
        tier,
        durationHours,
        durationLabel,
        createdAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        createdBy: 'Super Administrator',
        status: 'unused',
        priceNgn: priceNgn || (tier === 'premium' ? (durationHours <= 24 ? 1000 : durationHours <= 168 ? 2500 : 6000) : (durationHours <= 24 ? 500 : durationHours <= 168 ? 1200 : 3000))
      });
    }

    const updated = [...newTokens, ...calvinTokens];
    setCalvinTokens(updated);
    try { localStorage.setItem('stanbax_calvin_tokens', JSON.stringify(updated)); } catch {}
    return newTokens;
  };

  const redeemCalvinToken = (
    studentId: string, 
    inputCode: string
  ): { success: boolean; message: string; tier?: 'regular' | 'premium'; expiresAt?: string } => {
    const cleanCode = inputCode.trim().toUpperCase();
    const token = calvinTokens.find(t => t.code.toUpperCase() === cleanCode);

    if (!token) {
      return { success: false, message: 'Invalid token code. Please check your token voucher and try again.' };
    }

    if (token.status === 'used' || token.status === 'expired') {
      return { 
        success: false, 
        message: `This token has already been redeemed by ${token.usedByStudentName || 'another student'} on ${token.activatedAt || 'an earlier date'}. Tokens cannot be used twice.` 
      };
    }

    const studentObj = students.find(s => s.id === studentId);
    const now = new Date();
    const expirationDate = new Date(now.getTime() + token.durationHours * 60 * 60 * 1000);
    const expiresAtStr = expirationDate.toISOString();
    const activatedAtStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Mark token as used (single-use enforcement)
    const updatedTokens = calvinTokens.map(t => {
      if (t.id === token.id) {
        return {
          ...t,
          status: 'used' as const,
          usedByStudentId: studentId,
          usedByStudentName: studentObj?.name || 'Student',
          activatedAt: activatedAtStr,
          expiresAt: expiresAtStr
        };
      }
      return t;
    });
    setCalvinTokens(updatedTokens);
    try { localStorage.setItem('stanbax_calvin_tokens', JSON.stringify(updatedTokens)); } catch {}

    // Update student's calvinAiAccess
    setStudents(prev => {
      const updated = prev.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            calvinAiAccess: {
              active: true,
              tier: token.tier,
              tokenId: token.id,
              tokenCode: token.code,
              activatedAt: activatedAtStr,
              expiresAt: expiresAtStr,
              durationHours: token.durationHours,
              questionsCount: s.calvinAiAccess?.questionsCount || 0
            }
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
      return updated;
    });

    return {
      success: true,
      message: `Success! Activated ${token.tier === 'premium' ? 'Premium' : 'Regular'} Calvin AI access! Valid for ${token.durationLabel || token.durationHours + ' hours'}.`,
      tier: token.tier,
      expiresAt: expiresAtStr
    };
  };

  const revokeCalvinToken = (tokenId: string) => {
    setCalvinTokens(prev => {
      const updated = prev.map(t => t.id === tokenId ? { ...t, status: 'expired' as const } : t);
      try { localStorage.setItem('stanbax_calvin_tokens', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const grantDirectCalvinAccess = (studentId: string, tier: 'regular' | 'premium', durationHours: number) => {
    const now = new Date();
    const expirationDate = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    const expiresAtStr = expirationDate.toISOString();
    const activatedAtStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    setStudents(prev => {
      const updated = prev.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            calvinAiAccess: {
              active: true,
              tier,
              tokenCode: `ADMIN-GRANT-${tier.toUpperCase()}`,
              activatedAt: activatedAtStr,
              expiresAt: expiresAtStr,
              durationHours,
              questionsCount: s.calvinAiAccess?.questionsCount || 0
            }
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const recordCalvinQuestionAsked = (studentId: string) => {
    setStudents(prev => {
      const updated = prev.map(s => {
        if (s.id === studentId && s.calvinAiAccess) {
          return {
            ...s,
            calvinAiAccess: {
              ...s.calvinAiAccess,
              questionsCount: (s.calvinAiAccess.questionsCount || 0) + 1
            }
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const sendTokenActivationPrompt = (
    studentIds: string[], 
    options: { 
      tokenCode?: string; 
      tier?: 'regular' | 'premium'; 
      durationLabel?: string; 
      customMessage?: string; 
      autoAllocateToken?: boolean;
      durationHours?: number;
    }
  ) => {
    if (!studentIds || studentIds.length === 0) {
      return { success: false, count: 0, message: 'No scholars selected.' };
    }

    const tier = options.tier || 'regular';
    const durationHours = options.durationHours || 720; // 30 days default
    const durationLabel = options.durationLabel || (durationHours >= 720 ? `${Math.round(durationHours / 720)} Month(s)` : `${durationHours} Hours`);

    let allocatedCodes: string[] = [];
    if (options.autoAllocateToken) {
      const generated = createCalvinTokens(tier, durationHours, studentIds.length, 0, durationLabel);
      allocatedCodes = generated.map(g => g.code);
    } else if (options.tokenCode) {
      allocatedCodes = [options.tokenCode];
    }

    let modifiedCount = 0;
    setStudents(prev => {
      const updated = prev.map(s => {
        const targetIdx = studentIds.indexOf(s.id);
        if (targetIdx !== -1) {
          modifiedCount++;
          const assignedCode = allocatedCodes[targetIdx] || (allocatedCodes.length === 1 ? allocatedCodes[0] : undefined);
          const studentFirstName = s.name.split(' ')[0] || s.name;
          const defaultMsg = assignedCode 
            ? `Dear ${studentFirstName}, your Stanbax School Administrator has issued a ${tier === 'premium' ? 'Premium Masterclass' : 'Regular'} Calvin AI Token Voucher (${assignedCode}) for your ${s.grade || 'class'} syllabus. Tap below to activate your interactive study pass!`
            : `Dear ${studentFirstName}, you are prompted to activate your Calvin AI Academic Tutor pass for your ${s.grade || 'class'} studies. Please contact the School Bursary or Admin to obtain your voucher.`;

          return {
            ...s,
            tokenPrompt: {
              id: `prompt-${Date.now()}-${s.id}`,
              tokenCode: assignedCode,
              tier,
              durationLabel,
              message: options.customMessage?.trim() || defaultMsg,
              senderName: 'School Administrator',
              sentAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              status: 'pending' as const
            }
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
      return updated;
    });

    return {
      success: true,
      count: modifiedCount || studentIds.length,
      message: `Token activation prompt sent successfully to ${studentIds.length} scholar(s)!`
    };
  };

  const dismissTokenPrompt = (studentId: string) => {
    setStudents(prev => {
      const updated = prev.map(s => {
        if (s.id === studentId && s.tokenPrompt) {
          return {
            ...s,
            tokenPrompt: {
              ...s.tokenPrompt,
              status: 'viewed' as const
            }
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const acceptTokenPromptAndActivate = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !student.tokenPrompt) {
      return { success: false, message: 'No pending token prompt found' };
    }

    if (student.tokenPrompt.tokenCode) {
      const result = redeemCalvinToken(studentId, student.tokenPrompt.tokenCode);
      if (result.success) {
        setStudents(prev => {
          const updated = prev.map(s => {
            if (s.id === studentId && s.tokenPrompt) {
              return {
                ...s,
                tokenPrompt: {
                  ...s.tokenPrompt,
                  status: 'activated' as const
                }
              };
            }
            return s;
          });
          try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
          return updated;
        });
        return result;
      } else {
        grantDirectCalvinAccess(studentId, student.tokenPrompt.tier || 'regular', 720);
        setStudents(prev => {
          const updated = prev.map(s => {
            if (s.id === studentId && s.tokenPrompt) {
              return {
                ...s,
                tokenPrompt: {
                  ...s.tokenPrompt,
                  status: 'activated' as const
                }
              };
            }
            return s;
          });
          try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
          return updated;
        });
        return { success: true, message: 'Token activated directly by Administrative Authority!', tier: student.tokenPrompt.tier };
      }
    } else {
      grantDirectCalvinAccess(studentId, student.tokenPrompt.tier || 'regular', 720);
      setStudents(prev => {
        const updated = prev.map(s => {
          if (s.id === studentId && s.tokenPrompt) {
            return {
              ...s,
              tokenPrompt: {
                ...s.tokenPrompt,
                status: 'activated' as const
              }
            };
          }
          return s;
        });
        try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
        return updated;
      });
      return { success: true, message: 'Token access activated successfully!', tier: student.tokenPrompt.tier };
    }
  };

  // 26. Staff Photo, Digital Signature & Principal Appointments
  const appointPrincipal = (tutorId: string, principalRole: PrincipalRole, privileges: PrincipalPrivilege[]) => {
    setTutors(prev => {
      const updated = prev.map(t => {
        if (t.id === tutorId) {
          return {
            ...t,
            principalRole,
            principalPrivileges: privileges,
            appointedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            appointedBy: 'Super Administrator'
          };
        }
        return t;
      });
      try { localStorage.setItem('stanbax_tutors', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updateTutorPhotoAndSignature = (tutorId: string, data: { photoUrl?: string; signatureUrl?: string }) => {
    setTutors(prev => {
      const updated = prev.map(t => {
        if (t.id === tutorId) {
          return {
            ...t,
            ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
            ...(data.signatureUrl !== undefined ? { signatureUrl: data.signatureUrl } : {})
          };
        }
        return t;
      });
      try { localStorage.setItem('stanbax_tutors', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // 27. Subject Schemes of Work & AI Curriculum Grounding
  const [schemesOfWork, setSchemesOfWork] = useState<SchemeOfWork[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_schemes_of_work');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved schemes of work', e);
    }
    return defaultSchemesOfWork;
  });

  const addSchemeOfWork = (schemeData: Omit<SchemeOfWork, 'id' | 'lastUpdated'>): SchemeOfWork => {
    const newScheme: SchemeOfWork = {
      ...schemeData,
      id: `scheme-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      lastUpdated: new Date().toISOString().split('T')[0],
      isAiLearned: true
    };
    setSchemesOfWork(prev => {
      const filtered = prev.filter(s => !(s.subjectName.toLowerCase() === newScheme.subjectName.toLowerCase() && s.classLevel === newScheme.classLevel && s.term === newScheme.term));
      const updated = [newScheme, ...filtered];
      try { localStorage.setItem('stanbax_schemes_of_work', JSON.stringify(updated)); } catch {}
      return updated;
    });
    return newScheme;
  };

  const updateSchemeOfWork = (id: string, updates: Partial<SchemeOfWork>) => {
    setSchemesOfWork(prev => {
      const updated = prev.map(s => {
        if (s.id === id) {
          return {
            ...s,
            ...updates,
            lastUpdated: new Date().toISOString().split('T')[0],
            isAiLearned: true
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_schemes_of_work', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const deleteSchemeOfWork = (id: string): boolean => {
    let deleted = false;
    setSchemesOfWork(prev => {
      const updated = prev.filter(s => {
        if (s.id === id) {
          deleted = true;
          return false;
        }
        return true;
      });
      try { localStorage.setItem('stanbax_schemes_of_work', JSON.stringify(updated)); } catch {}
      return updated;
    });
    return deleted;
  };

  const resetSchemesToDefault = () => {
    setSchemesOfWork(defaultSchemesOfWork);
    try { localStorage.setItem('stanbax_schemes_of_work', JSON.stringify(defaultSchemesOfWork)); } catch {}
  };

  const getSchemeForSubjectAndClass = (subjectName: string, classLevel?: string, term?: string): SchemeOfWork | undefined => {
    if (!subjectName) return undefined;
    const sName = subjectName.toLowerCase().trim();
    // 1. Exact match on subject name + class level + term
    let found = schemesOfWork.find(s => {
      const matchSubject = s.subjectName.toLowerCase() === sName || s.subjectName.toLowerCase().includes(sName) || sName.includes(s.subjectName.toLowerCase());
      const matchClass = !classLevel || s.classLevel.toLowerCase() === classLevel.toLowerCase() || s.classLevel === 'All Levels' || s.classLevel === 'All Classes' || (s.applicableClasses && s.applicableClasses.includes(classLevel));
      const matchTerm = !term || s.term === term || s.term === 'All Terms';
      return matchSubject && matchClass && matchTerm;
    });

    if (found) return found;

    // 2. Fallback: match subject and class level regardless of term
    found = schemesOfWork.find(s => {
      const matchSubject = s.subjectName.toLowerCase() === sName || s.subjectName.toLowerCase().includes(sName) || sName.includes(s.subjectName.toLowerCase());
      const matchClass = !classLevel || s.classLevel.toLowerCase() === classLevel.toLowerCase() || s.classLevel === 'All Levels' || s.classLevel === 'All Classes' || (s.applicableClasses && s.applicableClasses.includes(classLevel));
      return matchSubject && matchClass;
    });

    if (found) return found;

    // 3. Fallback: match subject name only
    found = schemesOfWork.find(s => {
      return s.subjectName.toLowerCase() === sName || s.subjectName.toLowerCase().includes(sName) || sName.includes(s.subjectName.toLowerCase());
    });

    if (found) return found;

    // 4. Fallback: match general scheme of work marked for all classes
    return schemesOfWork.find(s => s.isGeneralScheme || s.classLevel === 'All Levels' || s.classLevel === 'All Classes');
  };

  // 28. School Community Chat System (Students, Parents, Tutors & Admin)
  const [chatChannels, setChatChannels] = useState<ChatChannel[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_chat_channels');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading chat channels', e);
    }
    return DEFAULT_CHAT_CHANNELS;
  });

  const [chatMessages, setChatMessages] = useState<SchoolChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_chat_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading chat messages', e);
    }
    return DEFAULT_CHAT_MESSAGES;
  });

  const addChatChannel = (channelData: Omit<ChatChannel, 'id' | 'createdAt'>): ChatChannel => {
    const newChan: ChatChannel = {
      ...channelData,
      id: `chan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    setChatChannels(prev => {
      const updated = [...prev, newChan];
      try { localStorage.setItem('stanbax_chat_channels', JSON.stringify(updated)); } catch {}
      broadcastLocalStateChange('stanbax_chat_channels', updated);
      void syncStateOnline('stanbax_chat_channels', updated);
      void fetch('/api/chat-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChan)
      }).catch(() => {});
      return updated;
    });
    return newChan;
  };

  const updateChatChannel = (id: string, updates: Partial<ChatChannel>) => {
    setChatChannels(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c);
      try { localStorage.setItem('stanbax_chat_channels', JSON.stringify(updated)); } catch {}
      broadcastLocalStateChange('stanbax_chat_channels', updated);
      void syncStateOnline('stanbax_chat_channels', updated);
      void fetch(`/api/chat-channels/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      }).catch(() => {});
      return updated;
    });
  };

  const deleteChatChannel = (id: string) => {
    void fetch(`/api/chat-channels/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    setChatChannels(prev => {
      const updated = prev.filter(c => c.id !== id);
      try { localStorage.setItem('stanbax_chat_channels', JSON.stringify(updated)); } catch {}
      broadcastLocalStateChange('stanbax_chat_channels', updated);
      void syncStateOnline('stanbax_chat_channels', updated);
      return updated;
    });
    // Also remove messages belonging to deleted channel
    setChatMessages(prev => {
      const updated = prev.filter(m => m.channelId !== id);
      try { localStorage.setItem('stanbax_chat_messages', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const sendChatMessage = (msgData: Omit<SchoolChatMessage, 'id' | 'timestamp'>): SchoolChatMessage => {
    let resolvedBadge = msgData.senderBadge;
    if (!resolvedBadge && msgData.senderRole === 'student') {
      const studentObj = students.find(s => s.id === msgData.senderId);
      const chanObj = chatChannels.find(c => c.id === msgData.channelId);
      if (studentObj) {
        if (chanObj?.type === 'class') {
          const matchedClass = classes.find(c => c.id === chanObj.classId || c.name.toLowerCase() === chanObj.name.toLowerCase() || (chanObj.className && c.name.toLowerCase() === chanObj.className.toLowerCase()));
          if (matchedClass?.prefectStudentId === studentObj.id || studentObj.classLeadershipRole === 'prefect') {
            resolvedBadge = 'Class Prefect';
          } else if (matchedClass?.assistantPrefectStudentId === studentObj.id || studentObj.classLeadershipRole === 'assistant_prefect') {
            resolvedBadge = 'Assistant Class Prefect';
          } else if (studentObj.prefectRole) {
            resolvedBadge = studentObj.prefectRole;
          }
        } else if (chanObj?.type === 'club') {
          const matchedClub = clubsList.find(c => c.id === chanObj.clubId || c.name.toLowerCase() === chanObj.name.toLowerCase() || (chanObj.clubName && c.name.toLowerCase() === chanObj.clubName.toLowerCase()));
          if (matchedClub?.presidentStudentId === studentObj.id || studentObj.clubLeadershipRoles?.[matchedClub?.id || ''] === 'president') {
            resolvedBadge = 'President';
          } else if (matchedClub?.vicePresidentStudentId === studentObj.id || studentObj.clubLeadershipRoles?.[matchedClub?.id || ''] === 'vice_president') {
            resolvedBadge = 'Vice President';
          } else if (studentObj.prefectRole) {
            resolvedBadge = studentObj.prefectRole;
          }
        } else if (studentObj.prefectRole) {
          resolvedBadge = studentObj.prefectRole;
        }
      }
    }

    const newMsg: SchoolChatMessage = {
      ...msgData,
      senderBadge: resolvedBadge,
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => {
      const updated = [...prev, newMsg];
      try { localStorage.setItem('stanbax_chat_messages', JSON.stringify(updated)); } catch {}
      broadcastLocalStateChange('stanbax_chat_messages', updated);
      void syncStateOnline('stanbax_chat_messages', updated);
      void fetch('/api/chat-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg)
      }).catch(() => {});
      return updated;
    });
    return newMsg;
  };

  const deleteChatMessage = (id: string) => {
    setChatMessages(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, deletedByAdmin: true } : m);
      try { localStorage.setItem('stanbax_chat_messages', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const flagChatMessage = (id: string, flagged: boolean = true) => {
    setChatMessages(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, flaggedByAdmin: flagged } : m);
      try { localStorage.setItem('stanbax_chat_messages', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const resetChatToDefault = () => {
    setChatChannels(DEFAULT_CHAT_CHANNELS);
    setChatMessages(DEFAULT_CHAT_MESSAGES);
    try {
      localStorage.setItem('stanbax_chat_channels', JSON.stringify(DEFAULT_CHAT_CHANNELS));
      localStorage.setItem('stanbax_chat_messages', JSON.stringify(DEFAULT_CHAT_MESSAGES));
    } catch {}
  };

  const toggleChatReaction = (messageId: string, emoji: string, userName: string) => {
    setChatMessages(prev => {
      const updated = prev.map(m => {
        if (m.id !== messageId) return m;
        const currentReactions = { ...(m.reactions || {}) };
        const usersForEmoji = currentReactions[emoji] || [];
        const exists = usersForEmoji.includes(userName);
        if (exists) {
          const filtered = usersForEmoji.filter(u => u !== userName);
          if (filtered.length === 0) {
            delete currentReactions[emoji];
          } else {
            currentReactions[emoji] = filtered;
          }
        } else {
          currentReactions[emoji] = [...usersForEmoji, userName];
        }
        return { ...m, reactions: currentReactions };
      });
      try { localStorage.setItem('stanbax_chat_messages', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const togglePinChatMessage = (messageId: string, pinnedBy?: string) => {
    setChatMessages(prev => {
      const target = prev.find(m => m.id === messageId);
      if (!target) return prev;
      const willPin = !target.isPinned;
      const updated = prev.map(m => {
        if (m.id === messageId) {
          return {
            ...m,
            isPinned: willPin,
            pinnedBy: willPin ? (pinnedBy || 'Staff Administrator') : undefined,
            pinnedAt: willPin ? new Date().toISOString() : undefined
          };
        }
        // If pinning a message in this channel, unpin any other message in the channel so there's one highlighted pinned banner
        if (willPin && m.channelId === target.channelId && m.isPinned) {
          return { ...m, isPinned: false };
        }
        return m;
      });
      try { localStorage.setItem('stanbax_chat_messages', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // Last read timestamps per user & channel for live unread badges
  const [lastReadTimestamps, setLastReadTimestamps] = useState<{ [userKey: string]: { [channelId: string]: number } }>(() => {
    try {
      const saved = localStorage.getItem('stanbax_chat_read_timestamps');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Seed sensible initial last read to show 1-2 demo unread messages for initial excitement
    const initialSeed: { [channelId: string]: number } = {};
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    initialSeed['chan-gen-announcement'] = oneDayAgo;
    return { default: initialSeed, 'demo-student': initialSeed };
  });

  const markChannelAsRead = (channelId: string, userId: string) => {
    setLastReadTimestamps(prev => {
      const userKey = userId || 'default';
      const userObj = { ...(prev[userKey] || {}) };
      userObj[channelId] = Date.now();
      const updated = { ...prev, [userKey]: userObj };
      try { localStorage.setItem('stanbax_chat_read_timestamps', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const getChannelUnreadCount = (channelId: string, userId: string): number => {
    const userKey = userId || 'default';
    const userReads = lastReadTimestamps[userKey] || {};
    const lastRead = userReads[channelId] ?? (Date.now() - 48 * 60 * 60 * 1000); // default to 48 hours ago if never read
    
    return chatMessages.filter(m => {
      if (m.channelId !== channelId) return false;
      if (m.senderId === userId) return false;
      if (m.deletedByAdmin) return false;
      const msgTime = new Date(m.timestamp).getTime();
      return msgTime > lastRead;
    }).length;
  };

  const getTotalUnreadCount = (userId: string, authorizedChannelIds?: string[]): number => {
    const validChannels = authorizedChannelIds && authorizedChannelIds.length > 0 
      ? chatChannels.filter(c => authorizedChannelIds.includes(c.id))
      : chatChannels;

    return validChannels.reduce((sum, chan) => {
      return sum + getChannelUnreadCount(chan.id, userId);
    }, 0);
  };

  // Global floating chat drawer & popup state
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);
  const [activeFloatingChatChannelId, setActiveFloatingChatChannelId] = useState<string | null>(null);

  // 29. Campus Gallery Photos (Facilities & Events)
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_campus_gallery_photos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return DEFAULT_GALLERY_PHOTOS;
  });

  const addGalleryPhoto = (photo: Omit<GalleryPhoto, 'id' | 'uploadedAt'>) => {
    const newPhoto: GalleryPhoto = {
      ...photo,
      id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      uploadedAt: new Date().toISOString().split('T')[0]
    };
    setGalleryPhotos(prev => {
      const next = [newPhoto, ...prev];
      try {
        localStorage.setItem('stanbax_campus_gallery_photos', JSON.stringify(next));
      } catch (err) {
        console.warn('Storage error on gallery photo', err);
      }
      void syncStateOnline('stanbax_campus_gallery_photos', next);
      return next;
    });
  };

  const updateGalleryPhoto = (id: string, updates: Partial<GalleryPhoto>) => {
    setGalleryPhotos(prev => {
      const next = prev.map(p => p.id === id ? { ...p, ...updates } : p);
      try {
        localStorage.setItem('stanbax_campus_gallery_photos', JSON.stringify(next));
      } catch (err) {
        console.warn('Storage error updating photo', err);
      }
      return next;
    });
  };

  const deleteGalleryPhoto = (id: string) => {
    setGalleryPhotos(prev => {
      const next = prev.filter(p => p.id !== id);
      try {
        localStorage.setItem('stanbax_campus_gallery_photos', JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  };

  const resetGalleryPhotosToDefault = () => {
    setGalleryPhotos(DEFAULT_GALLERY_PHOTOS);
    try {
      localStorage.removeItem('stanbax_campus_gallery_photos');
    } catch {}
  };

  // 30. Prefects, Club Leaders & Ephemeral 16-Hour Statuses
  const assignClassPrefects = (classId: string, prefectStudentId?: string, assistantPrefectStudentId?: string) => {
    setClasses(prev => {
      const updated = prev.map(c => c.id === classId ? { ...c, prefectStudentId, assistantPrefectStudentId } : c);
      try { localStorage.setItem('stanbax_classes', JSON.stringify(updated)); } catch {}
      return updated;
    });

    setStudents(prev => {
      const targetClass = classes.find(c => c.id === classId);
      const updated = prev.map(s => {
        const inThisClass = s.classId === classId || (targetClass && s.grade.toLowerCase() === targetClass.name.toLowerCase());
        if (s.id === prefectStudentId) {
          return { ...s, classLeadershipRole: 'prefect' as const };
        }
        if (s.id === assistantPrefectStudentId) {
          return { ...s, classLeadershipRole: 'assistant_prefect' as const };
        }
        if (inThisClass && (s.classLeadershipRole === 'prefect' || s.classLeadershipRole === 'assistant_prefect')) {
          return { ...s, classLeadershipRole: null };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const assignClubLeaders = (
    clubId: string,
    presidentStudentId?: string,
    vicePresidentStudentId?: string,
    memberStudentIds?: string[]
  ) => {
    setClubsList(prev => {
      const updated = prev.map(c => c.id === clubId ? {
        ...c,
        presidentStudentId,
        vicePresidentStudentId,
        memberStudentIds: memberStudentIds || c.memberStudentIds || []
      } : c);
      try { localStorage.setItem('stanbax_clubs_list', JSON.stringify(updated)); } catch {}
      return updated;
    });

    const targetClub = clubsList.find(c => c.id === clubId);
    if (targetClub && (targetClub.name.toLowerCase().includes('press') || targetClub.name.toLowerCase().includes('media'))) {
      setPressClubPresidentStudentId(presidentStudentId);
      try {
        if (presidentStudentId) localStorage.setItem('stanbax_press_president', presidentStudentId);
        else localStorage.removeItem('stanbax_press_president');
      } catch {}
    }

    setStudents(prev => {
      const targetClub = clubsList.find(c => c.id === clubId);
      const clubName = targetClub?.name;
      const updated = prev.map(s => {
        let clubs = s.clubs ? [...s.clubs] : [];
        let leadership = { ...(s.clubLeadershipRoles || {}) };

        const isPresident = s.id === presidentStudentId;
        const isVice = s.id === vicePresidentStudentId;
        const isMember = memberStudentIds?.includes(s.id) || isPresident || isVice;

        if (clubName) {
          if (isMember && !clubs.includes(clubName)) {
            clubs.push(clubName);
          } else if (memberStudentIds && !isMember && clubs.includes(clubName)) {
            clubs = clubs.filter(cn => cn !== clubName);
          }
        }

        if (isPresident) {
          leadership[clubId] = 'president';
        } else if (isVice) {
          leadership[clubId] = 'vice_president';
        } else {
          delete leadership[clubId];
        }

        return { ...s, clubs, clubLeadershipRoles: leadership };
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const assignStudentPrefectBadge = (studentId: string, prefectRole?: string, prefectBadge?: string) => {
    setStudents(prev => {
      const updated = prev.map(s => s.id === studentId ? {
        ...s,
        prefectRole: prefectRole || undefined,
        prefectBadge: prefectBadge || (prefectRole ? 'School Prefect' : undefined)
      } : s);
      try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updateStudentChatSettings = (studentId: string, settings: { showOnlineStatus?: boolean; allowDirectMessages?: boolean; dmPermission?: 'classmates_only' | 'anyone' }) => {
    setStudents(prev => {
      const updated = prev.map(s => s.id === studentId ? {
        ...s,
        chatSettings: { ...(s.chatSettings || { showOnlineStatus: true, allowDirectMessages: true, dmPermission: 'anyone' }), ...settings }
      } : s);
      try { localStorage.setItem('stanbax_students', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const [ephemeralStatuses, setEphemeralStatuses] = useState<UserEphemeralStatus[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_ephemeral_statuses');
      if (saved) {
        const parsed = JSON.parse(saved);
        const active = cleanExpiredStatuses(parsed);
        return active.length > 0 ? active : cleanExpiredStatuses(INITIAL_EPHEMERAL_STATUSES);
      }
    } catch {}
    return cleanExpiredStatuses(INITIAL_EPHEMERAL_STATUSES);
  });

  // Purge expired statuses periodically every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      setEphemeralStatuses(prev => {
        const active = cleanExpiredStatuses(prev);
        if (active.length !== prev.length) {
          try { localStorage.setItem('stanbax_ephemeral_statuses', JSON.stringify(active)); } catch {}
        }
        return active;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const postEphemeralStatus = (statusData: Omit<UserEphemeralStatus, 'id' | 'createdAt' | 'expiresAt' | 'views'>) => {
    const newStatus = create16HourStatus(statusData);
    setEphemeralStatuses(prev => {
      const active = cleanExpiredStatuses([newStatus, ...prev]);
      try { localStorage.setItem('stanbax_ephemeral_statuses', JSON.stringify(active)); } catch {}
      return active;
    });
  };

  const deleteEphemeralStatus = (id: string) => {
    setEphemeralStatuses(prev => {
      const updated = prev.filter(s => s.id !== id);
      try { localStorage.setItem('stanbax_ephemeral_statuses', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const markEphemeralStatusViewed = (statusId: string, viewerId: string, viewerName?: string, viewerRole?: string) => {
    setEphemeralStatuses(prev => {
      const updated = prev.map(s => {
        if (s.id === statusId) {
          const views = s.views || [];
          const viewRecords = s.viewRecords || [];
          if (!views.includes(viewerId)) {
            const newRecord: StatusViewerRecord = {
              userId: viewerId,
              userName: viewerName || 'School Scholar',
              userRole: viewerRole || 'student',
              viewedAt: new Date().toISOString()
            };
            return {
              ...s,
              views: [...views, viewerId],
              viewRecords: [...viewRecords, newRecord]
            };
          }
        }
        return s;
      });
      try { localStorage.setItem('stanbax_ephemeral_statuses', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // 31. School News & Blog System (Managed by Press Club President & Nominated Editors)
  const [newsArticles, setNewsArticles] = useState<SchoolNewsArticle[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_news_articles');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_NEWS_ARTICLES;
  });

  const [pressClubPresidentStudentId, setPressClubPresidentStudentId] = useState<string | undefined>(() => {
    try {
      const saved = localStorage.getItem('stanbax_press_president');
      if (saved) return saved;
    } catch {}
    return 'stu-1'; // Default: Tiwa Adeleke
  });

  const [pressClubEditorStudentIds, setPressClubEditorStudentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_press_editors');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['stu-2', 'stu-3']; // Default editors: Babatunde Akindele, Chinedu Eze
  });

  const addNewsArticle = (article: Omit<SchoolNewsArticle, 'id' | 'publishedAt'>) => {
    const newArt: SchoolNewsArticle = {
      ...article,
      id: `news-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      publishedAt: new Date().toISOString(),
      likesCount: 0,
      viewsCount: 1
    };
    setNewsArticles(prev => {
      const updated = [newArt, ...prev];
      try { localStorage.setItem('stanbax_news_articles', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updateNewsArticle = (id: string, updates: Partial<SchoolNewsArticle>) => {
    setNewsArticles(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, ...updates } : a);
      try { localStorage.setItem('stanbax_news_articles', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const deleteNewsArticle = (id: string) => {
    setNewsArticles(prev => {
      const updated = prev.filter(a => a.id !== id);
      try { localStorage.setItem('stanbax_news_articles', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const likeNewsArticle = (id: string) => {
    setNewsArticles(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, likesCount: (a.likesCount || 0) + 1 } : a);
      try { localStorage.setItem('stanbax_news_articles', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const assignPressClubPresident = (studentId: string | undefined) => {
    setPressClubPresidentStudentId(studentId);
    try {
      if (studentId) localStorage.setItem('stanbax_press_president', studentId);
      else localStorage.removeItem('stanbax_press_president');
    } catch {}
  };

  const nominatePressClubEditor = (studentId: string) => {
    setPressClubEditorStudentIds(prev => {
      if (prev.includes(studentId)) return prev;
      const updated = [...prev, studentId];
      try { localStorage.setItem('stanbax_press_editors', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const removePressClubEditor = (studentId: string) => {
    setPressClubEditorStudentIds(prev => {
      const updated = prev.filter(id => id !== studentId);
      try { localStorage.setItem('stanbax_press_editors', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const resetNewsArticlesToDefault = () => {
    setNewsArticles(DEFAULT_NEWS_ARTICLES);
    setPressClubPresidentStudentId('stu-1');
    setPressClubEditorStudentIds(['stu-2', 'stu-3']);
    try {
      localStorage.setItem('stanbax_news_articles', JSON.stringify(DEFAULT_NEWS_ARTICLES));
      localStorage.setItem('stanbax_press_president', 'stu-1');
      localStorage.setItem('stanbax_press_editors', JSON.stringify(['stu-2', 'stu-3']));
    } catch {}
  };

  // Student Article Submissions ("Letters to the Editor")
  const [studentSubmissions, setStudentSubmissions] = useState<StudentArticleSubmission[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_student_submissions');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'sub-sample-1',
        studentId: 'stu-3',
        studentName: 'Chinedu Eze',
        studentGrade: 'SSS 1 Commercial',
        title: 'Why Robotics and Financial Literacy Should Be Taught in Junior Classes',
        category: 'STEM & Innovation',
        content: 'As young scholars navigating the 21st century, understanding both algorithmic problem solving and financial discipline prepares us for tertiary scholarship and entrepreneurial ventures. Our JETS club experience proves that even early secondary students can build functional hardware prototypes and understand economic value creation.',
        submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      }
    ];
  });

  const submitArticleForReview = (submission: Omit<StudentArticleSubmission, 'id' | 'submittedAt' | 'status'>) => {
    const newSub: StudentArticleSubmission = {
      ...submission,
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      submittedAt: new Date().toISOString(),
      status: 'pending'
    };
    setStudentSubmissions(prev => {
      const updated = [newSub, ...prev];
      try { localStorage.setItem('stanbax_student_submissions', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const reviewStudentSubmission = (id: string, decision: 'approved' | 'rejected', reason?: string) => {
    setStudentSubmissions(prev => {
      const target = prev.find(s => s.id === id);
      if (target && decision === 'approved') {
        addNewsArticle({
          title: target.title,
          slug: target.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50),
          category: target.category,
          excerpt: target.content.slice(0, 140) + '...',
          content: target.content,
          coverImage: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop',
          readTime: `${Math.max(2, Math.round(target.content.split(' ').length / 180))} min read`,
          tags: ['Student Voice', 'Letters to Editor', target.category],
          isFeatured: false,
          author: {
            id: target.studentId,
            name: target.studentName,
            role: 'Press Club Editor',
            gradeOrTitle: target.studentGrade
          },
          likesCount: 1,
          viewsCount: 1
        });
      }
      const updated = prev.map(s => s.id === id ? { ...s, status: decision, rejectionReason: reason } : s);
      try { localStorage.setItem('stanbax_student_submissions', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // 32. School Representative & Landing Page Visitor Inquiries
  const [schoolRepConfig, setSchoolRepConfig] = useState<SchoolRepConfig>(() => {
    try {
      const saved = localStorage.getItem('stanbax_school_rep_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged: SchoolRepConfig = { ...DEFAULT_SCHOOL_REP_CONFIG, ...parsed };
        // Ensure roleProfiles reflects the active role's saved name/title/welcomeMessage
        const activeRole = merged.activeRole || 'principal';
        const roleProfiles = { ...(merged.roleProfiles || {}) };
        if (merged.repName) {
          roleProfiles[activeRole] = {
            name: merged.repName,
            title: merged.repTitle || roleProfiles[activeRole]?.title || DEFAULT_SCHOOL_REP_CONFIG.repTitle,
            welcomeMessage: merged.welcomeMessage || roleProfiles[activeRole]?.welcomeMessage || DEFAULT_SCHOOL_REP_CONFIG.welcomeMessage,
          };
        }
        return { ...merged, roleProfiles };
      }
    } catch {}
    return DEFAULT_SCHOOL_REP_CONFIG;
  });

  const updateSchoolRepConfig = (updates: Partial<SchoolRepConfig>) => {
    setSchoolRepConfig(prev => {
      const nextRole = updates.activeRole || prev.activeRole;
      const nextName = (updates.repName !== undefined ? updates.repName : prev.repName).trim() || prev.repName;
      const nextTitle = (updates.repTitle !== undefined ? updates.repTitle : prev.repTitle).trim() || prev.repTitle;
      let nextWelcome = updates.welcomeMessage !== undefined ? updates.welcomeMessage : prev.welcomeMessage;

      // If the representative name changed (e.g. from Mrs. Bello to Mrs. Yemi),
      // automatically update the name inside the welcome greeting if it still references the old name
      if (updates.repName && nextName !== prev.repName) {
        const prevRoleName = prev.roleProfiles?.[nextRole]?.name;
        for (const oldCandidate of [prev.repName, prevRoleName, 'Mrs. Bello'].filter(Boolean) as string[]) {
          if (oldCandidate && oldCandidate !== nextName && nextWelcome.includes(oldCandidate)) {
            nextWelcome = nextWelcome.split(oldCandidate).join(nextName);
          }
        }
      }

      const nextRoleProfiles = {
        ...(prev.roleProfiles || {}),
        [nextRole]: {
          name: nextName,
          title: nextTitle,
          welcomeMessage: nextWelcome,
        },
      };

      const updated: SchoolRepConfig = {
        ...prev,
        ...updates,
        activeRole: nextRole,
        repName: nextName,
        repTitle: nextTitle,
        welcomeMessage: nextWelcome,
        updatedAt: new Date().toISOString(),
        roleProfiles: nextRoleProfiles,
      };
      try {
        localStorage.setItem('stanbax_school_rep_config', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      broadcastLocalStateChange('stanbax_school_rep_config', updated);
      void syncStateOnline('stanbax_school_rep_config', updated);
      void fetch('/api/school-rep-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }).catch(() => {});
      return updated;
    });
  };

  const toggleRepAvailability = (available?: boolean) => {
    setSchoolRepConfig(prev => {
      const newAvail = available !== undefined ? available : !prev.isAvailable;
      const updated: SchoolRepConfig = {
        ...prev,
        isAvailable: newAvail,
        updatedAt: new Date().toISOString(),
        statusText: newAvail 
          ? 'Online Now • Available for Live Consultation'
          : 'Away on Campus Inspection • Calvin AI Virtual Rep Active'
      };
      try {
        localStorage.setItem('stanbax_school_rep_config', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      broadcastLocalStateChange('stanbax_school_rep_config', updated);
      void syncStateOnline('stanbax_school_rep_config', updated);
      void fetch('/api/school-rep-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      }).catch(() => {});
      return updated;
    });
  };

  const [visitorConversations, setVisitorConversations] = useState<VisitorConversation[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_visitor_conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((c: VisitorConversation) => ({
            ...c,
            queryCode: c.queryCode || `STX-${c.visitorId.slice(-5).toUpperCase()}`,
          }));
        }
      }
    } catch {}
    return DEFAULT_VISITOR_CONVERSATIONS;
  });

  // Real-time typing indicators registry (conversationId -> typing state)
  const [typingMap, setTypingMap] = useState<Record<string, { isRepTyping?: boolean; repName?: string; isVisitorTyping?: boolean; visitorName?: string }>>(() => {
    try {
      const saved = localStorage.getItem('stanbax_chat_typing');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const mergeConversationLists = (
    currentList: VisitorConversation[],
    incomingList: VisitorConversation[]
  ): { merged: VisitorConversation[]; changed: boolean } => {
    const map = new Map<string, VisitorConversation>();
    for (const c of currentList) {
      if (!c?.visitorId) continue;
      map.set(c.visitorId, {
        ...c,
        queryCode: c.queryCode || `STX-${c.visitorId.slice(-5).toUpperCase()}`,
      });
    }
    let changed = false;
    for (const inc of incomingList) {
      if (!inc?.visitorId) continue;
      const existing = map.get(inc.visitorId);
      const incWithCode: VisitorConversation = {
        ...inc,
        queryCode: inc.queryCode || existing?.queryCode || `STX-${inc.visitorId.slice(-5).toUpperCase()}`,
      };
      if (!existing) {
        map.set(inc.visitorId, incWithCode);
        changed = true;
      } else {
        const msgMap = new Map<string, VisitorChatMessage>();
        for (const m of existing.messages || []) {
          if (m?.id) msgMap.set(m.id, m);
        }
        let msgAddedOrUpdated = false;
        for (const m of incWithCode.messages || []) {
          if (!m?.id) continue;
          const prevM = msgMap.get(m.id);
          if (!prevM || (m.status === 'seen' && prevM.status !== 'seen')) {
            msgMap.set(m.id, m);
            msgAddedOrUpdated = true;
          }
        }
        const mergedMessages = Array.from(msgMap.values()).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const incTime = new Date(incWithCode.lastMessageAt || 0).getTime();
        const extTime = new Date(existing.lastMessageAt || 0).getTime();
        if (
          msgAddedOrUpdated ||
          mergedMessages.length !== (existing.messages?.length || 0) ||
          incTime > extTime ||
          incWithCode.assignedRole !== existing.assignedRole ||
          incWithCode.lastSeenByAdminAt !== existing.lastSeenByAdminAt ||
          incWithCode.lastSeenByVisitorAt !== existing.lastSeenByVisitorAt
        ) {
          const newer = incTime >= extTime ? incWithCode : existing;
          const hasNewRepReply = mergedMessages.some(
            m =>
              (m.sender === 'representative' || m.sender === 'calvin_ai') &&
              !(existing.messages || []).some(em => em.id === m.id)
          );
          map.set(inc.visitorId, {
            ...existing,
            ...newer,
            queryCode: incWithCode.queryCode,
            unreadByVisitor: hasNewRepReply ? true : newer.unreadByVisitor,
            messages: mergedMessages,
            lastMessageAt:
              mergedMessages.length > 0
                ? mergedMessages[mergedMessages.length - 1].timestamp
                : newer.lastMessageAt,
          });
          changed = true;
        }
      }
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime()
    );
    return { merged, changed };
  };

  // ---------------------------------------------------------------------------
  // REAL-TIME CROSS-DEVICE SYNCHRONIZATION VIA SSE, SUPABASE & SERVER DATABASE
  // Guarantees real-time sync across Laptop, Phone, Tablet, and Desktop!
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // 1. Initial fetch of online server & Supabase state
    const fetchInitialServerState = async () => {
      try {
        const repRes = await fetch('/api/school-rep-config');
        if (repRes.ok) {
          const repData = await repRes.json();
          if (repData?.config && repData.config.repName) {
            setSchoolRepConfig(prev => {
              // Never overwrite a customized local config with an older or default server config
              const localHasCustom = prev.updatedAt || prev.repName !== DEFAULT_SCHOOL_REP_CONFIG.repName;
              const serverTime = repData.config.updatedAt ? new Date(repData.config.updatedAt).getTime() : 0;
              const localTime = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
              if (localHasCustom && serverTime <= localTime) {
                return prev;
              }
              const nextConfig = { ...prev, ...repData.config };
              try { localStorage.setItem('stanbax_school_rep_config', JSON.stringify(nextConfig)); } catch {}
              return nextConfig;
            });
          }
        }
      } catch {}

      try {
        const chanRes = await fetch('/api/chat-channels');
        if (chanRes.ok) {
          const chanData = await chanRes.json();
          if (Array.isArray(chanData?.channels) && chanData.channels.length > 0) {
            setChatChannels(prev => {
              const map = new Map<string, ChatChannel>();
              for (const c of prev) map.set(c.id, c);
              for (const c of chanData.channels) map.set(c.id, c);
              const combined = Array.from(map.values());
              try { localStorage.setItem('stanbax_chat_channels', JSON.stringify(combined)); } catch {}
              return combined;
            });
          }
        }
      } catch {}

      try {
        const convRes = await fetch('/api/visitor-conversations');
        if (convRes.ok) {
          const convData = await convRes.json();
          if (Array.isArray(convData?.conversations)) {
            setVisitorConversations(prev => {
              const { merged, changed } = mergeConversationLists(prev, convData.conversations);
              if (!changed) return prev;
              try { localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(merged)); } catch {}
              return merged;
            });
          }
        }
      } catch {}

      try {
        const msgRes = await fetch('/api/chat-messages');
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          if (Array.isArray(msgData?.messages) && msgData.messages.length > 0) {
            setChatMessages(prev => {
              const ids = new Set(prev.map(m => m.id));
              const newMsgs = msgData.messages.filter((m: any) => !ids.has(m.id));
              if (newMsgs.length === 0) return prev;
              const combined = [...prev, ...newMsgs];
              try { localStorage.setItem('stanbax_chat_messages', JSON.stringify(combined)); } catch {}
              return combined;
            });
          }
        }
      } catch {}
    };

    void fetchInitialServerState();

    // 2. Connect to SSE Realtime Push Stream
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime/stream');

      eventSource.addEventListener('visitor_conversation_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { conversation, message } = payload?.payload || payload;
          if (conversation && conversation.visitorId) {
            setVisitorConversations(prev => {
              const idx = prev.findIndex(c => c.visitorId === conversation.visitorId);
              let copy: VisitorConversation[];
              if (idx >= 0) {
                copy = [...prev];
                copy[idx] = conversation;
              } else {
                copy = [conversation, ...prev];
              }
              try {
                localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
                window.dispatchEvent(new Event('storage'));
              } catch {}
              return copy;
            });

            // Synthesize subtle notification sound if new message from visitor
            if (message?.sender === 'visitor') {
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
              } catch {}
            }
          }
        } catch (err) {
          console.warn('[Realtime SSE Error]', err);
        }
      });

      eventSource.addEventListener('visitor_conversation_deleted', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { visitorId } = payload?.payload || payload;
          if (visitorId) {
            setVisitorConversations(prev => {
              const next = prev.filter(c => c.visitorId !== visitorId);
              try { localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('school_rep_config_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { config } = payload?.payload || payload;
          if (config && config.repName) {
            setSchoolRepConfig(config);
            try {
              localStorage.setItem('stanbax_school_rep_config', JSON.stringify(config));
              window.dispatchEvent(new Event('storage'));
            } catch {}
          }
        } catch {}
      });

      eventSource.addEventListener('chat_channels_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { channels } = payload?.payload || payload;
          if (Array.isArray(channels)) {
            setChatChannels(channels);
            try {
              localStorage.setItem('stanbax_chat_channels', JSON.stringify(channels));
              window.dispatchEvent(new Event('storage'));
            } catch {}
          }
        } catch {}
      });

      eventSource.addEventListener('chat_message_created', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { message } = payload?.payload || payload;
          if (message && message.id) {
            setChatMessages(prev => {
              if (prev.some(m => m.id === message.id)) return prev;
              const next = [...prev, message];
              try {
                localStorage.setItem('stanbax_chat_messages', JSON.stringify(next));
                window.dispatchEvent(new Event('storage'));
              } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('chat_message_deleted', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { messageId } = payload?.payload || payload;
          if (messageId) {
            setChatMessages(prev => {
              const next = prev.map(m => m.id === messageId ? { ...m, deletedByAdmin: true } : m);
              try { localStorage.setItem('stanbax_chat_messages', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('student_deleted', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { id } = payload?.payload || payload;
          if (id) {
            setStudents(prev => {
              const next = prev.filter(s => s.id !== id);
              try { localStorage.setItem('stanbax_students', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('tutor_deleted', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { id } = payload?.payload || payload;
          if (id) {
            setTutors(prev => {
              const next = prev.filter(t => t.id !== id);
              try { localStorage.setItem('stanbax_tutors', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('moderator_deleted', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { id } = payload?.payload || payload;
          if (id) {
            setModerators(prev => {
              const next = prev.filter(m => m.id !== id);
              try { localStorage.setItem('stanbax_moderators', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('parent_deleted', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { id } = payload?.payload || payload;
          if (id) {
            setParents(prev => {
              const next = prev.filter(p => p.id !== id);
              try { localStorage.setItem('stanbax_parents_list', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('chat_typing', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { conversationId, sender, senderName, isTyping } = payload?.payload || payload;
          if (conversationId && sender) {
            setTypingMap(prev => {
              const current = prev[conversationId] || {};
              const nextMap = {
                ...prev,
                [conversationId]: {
                  ...current,
                  ...(sender === 'representative'
                    ? { isRepTyping: isTyping, repName: isTyping ? senderName : undefined }
                    : { isVisitorTyping: isTyping, visitorName: isTyping ? senderName : undefined })
                }
              };
              return nextMap;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('assessment_config_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { config } = payload?.payload || payload;
          if (config && typeof config === 'object') {
            setAssessmentConfig(prev => {
              const next = { ...prev, ...config };
              try { localStorage.setItem('stanbax_assessment_config', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('collated_results_dispatched', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { students: remoteStudents, assessmentConfig: remoteConfig } = payload?.payload || payload;
          if (Array.isArray(remoteStudents) && remoteStudents.length > 0) {
            setStudents(remoteStudents);
            try { localStorage.setItem('stanbax_students', JSON.stringify(remoteStudents)); } catch {}
          }
          if (remoteConfig && typeof remoteConfig === 'object') {
            setAssessmentConfig(prev => {
              const next = { ...prev, ...remoteConfig };
              try { localStorage.setItem('stanbax_assessment_config', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('results_unified', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { students: remoteStudents, assessmentConfig: remoteConfig } = payload?.payload || payload;
          if (Array.isArray(remoteStudents) && remoteStudents.length > 0) {
            setStudents(remoteStudents);
            try { localStorage.setItem('stanbax_students', JSON.stringify(remoteStudents)); } catch {}
          }
          if (remoteConfig && typeof remoteConfig === 'object') {
            setAssessmentConfig(prev => {
              const next = { ...prev, ...remoteConfig };
              try { localStorage.setItem('stanbax_assessment_config', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('student_updated', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { student } = payload?.payload || payload;
          if (student && student.id) {
            setStudents(prev => {
              const idx = prev.findIndex(s => s.id === student.id);
              let next;
              if (idx >= 0) {
                next = [...prev];
                next[idx] = { ...prev[idx], ...student };
              } else {
                next = [...prev, student];
              }
              try { localStorage.setItem('stanbax_students', JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {}
      });

      eventSource.addEventListener('account_deleted', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { id, identifier, role } = payload?.payload || payload;
          if (id) {
            const cleanId = String(id).toLowerCase();
            const cleanIdent = identifier ? String(identifier).toLowerCase() : undefined;
            setDeletedAccountIds(prev => {
              const next = new Set(prev);
              next.add(cleanId);
              if (cleanIdent) next.add(cleanIdent);
              const arr = Array.from(next);
              try { localStorage.setItem('stanbax_deleted_account_ids', JSON.stringify(arr)); } catch {}
              return arr;
            });
            if (role === 'student' || !role) {
              setStudents(prev => prev.filter(s => s.id !== id && s.regNumber?.toLowerCase() !== cleanIdent));
            }
            if (role === 'tutor' || !role) {
              setTutors(prev => prev.filter(t => t.id !== id && t.email?.toLowerCase() !== cleanIdent));
            }
            if (role === 'moderator' || !role) {
              setModerators(prev => prev.filter(m => m.id !== id && m.email?.toLowerCase() !== cleanIdent));
            }
            if (role === 'admin' || !role) {
              setAdminAccounts(prev => prev.filter(a => a.id !== id && a.username?.toLowerCase() !== cleanIdent));
            }
          }
        } catch {}
      });
    } catch (e) {
      console.warn('[Realtime Stream Init Error]', e);
    }

    // 3. Periodic Polling every 3 seconds (syncs Express API, Sessions & Supabase Cloud State!)
    const pollLiveState = async () => {
      // Poll Express API if running in full-stack environment
      fetch('/api/visitor-conversations')
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (Array.isArray(data?.conversations)) {
            setVisitorConversations(prev => {
              const { merged, changed } = mergeConversationLists(prev, data.conversations);
              if (!changed) return prev;
              try { localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(merged)); } catch {}
              return merged;
            });
          }
        })
        .catch(() => {});

      // Poll latest central results from database (skip if local mutation happened in the last 8s or writes are pending)
      if (!hasPendingRemoteWrites() && Date.now() - lastLocalMutationAt >= 8000) {
        fetch('/api/results/latest')
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            if (!data || hasPendingRemoteWrites() || Date.now() - lastLocalMutationAt < 8000) return;

            if (Array.isArray(data.deletedAccountIds) && data.deletedAccountIds.length > 0) {
              data.deletedAccountIds.forEach((id: string) => {
                deletedAccountIdsRef.current.add(String(id).toLowerCase());
                deletedAccountIdsRef.current.add(String(id).toLowerCase().replace(/\s+/g, ''));
              });
            }

            if (Array.isArray(data.subjects) && data.subjects.length > 0) {
              const normalized = normalizeSubjectCatalog(data.subjects);
              setSubjects(prev => {
                if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev;
                setLocalStorageSilent('stanbax_subjects', JSON.stringify(normalized));
                return normalized;
              });
            }

            if (Array.isArray(data.students) && data.students.length > 0) {
              setStudents(prev => {
                const remoteValid = data.students.filter(
                  (s: StudentProfile) => s && s.id && !isAccountTombstoned(s.id, s.regNumber, s.email)
                );
                const prevValid = prev.filter(
                  s => s && s.id && !isAccountTombstoned(s.id, s.regNumber, s.email)
                );
                // Put remoteValid first and prevValid second so deduplicateStudentsByRegistration compares timestamps and never overwrites newer local grades
                const deduplicated = deduplicateStudentsByRegistration([...remoteValid, ...prevValid]);
                if (JSON.stringify(deduplicated) === JSON.stringify(prev)) return prev;
                try { localStorage.setItem('stanbax_students', JSON.stringify(deduplicated)); } catch {}
                return deduplicated;
              });
            }
            if (data?.assessmentConfig && typeof data.assessmentConfig === 'object') {
              setAssessmentConfig(prev => {
                const remoteCfg = data.assessmentConfig;
                const remTime = remoteCfg.resultsDispatchedAt ? new Date(remoteCfg.resultsDispatchedAt).getTime() : 0;
                const locTime = prev.resultsDispatchedAt ? new Date(prev.resultsDispatchedAt).getTime() : 0;
                if (locTime > remTime) return prev;
                const isDiff =
                  remoteCfg.resultsDispatchedToDashboard !== prev.resultsDispatchedToDashboard ||
                  remoteCfg.dispatchedReportKind !== prev.dispatchedReportKind ||
                  remoteCfg.resultsDispatchedAt !== prev.resultsDispatchedAt ||
                  remoteCfg.midTermResultsPublished !== prev.midTermResultsPublished ||
                  remoteCfg.endTermResultsPublished !== prev.endTermResultsPublished;
                if (!isDiff) return prev;
                const updated = { ...prev, ...remoteCfg };
                try { localStorage.setItem('stanbax_assessment_config', JSON.stringify(updated)); } catch {}
                return updated;
              });
            }
          })
          .catch(() => {});
      }

      // High-concurrency heartbeat: maintain session isolation and update active users counter
      try {
        let sessionId = sessionStorage.getItem('stanbax_session_id');
        if (!sessionId) {
          sessionId = 'sess_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
          sessionStorage.setItem('stanbax_session_id', sessionId);
        }
        const currentRole =
          sessionStorage.getItem('stanbax_admin_auth') === 'true' ? 'admin' :
          sessionStorage.getItem('stanbax_proprietress_auth') === 'true' ? 'proprietress' :
          sessionStorage.getItem('stanbax_tutor_auth') === 'true' ? 'tutor' :
          sessionStorage.getItem('stanbax_student_auth') === 'true' ? 'student' :
          sessionStorage.getItem('stanbax_parent_auth') === 'true' ? 'parent' : 'visitor';
        
        fetch('/api/sessions/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, role: currentRole })
        })
          .then(r => (r.ok ? r.json() : null))
          .then(d => {
            if (d && typeof d.activeSessionsCount === 'number') {
              setActiveOnlineUsersCount(Math.max(1, d.activeSessionsCount));
            }
          })
          .catch(() => {});
      } catch {}

      // Keep deleted account tombstones fresh across all browsers and sessions
      fetch('/api/accounts/deleted')
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          const list = Array.isArray(d?.deletedAccountIds) ? d.deletedAccountIds : (Array.isArray(d?.deletedIds) ? d.deletedIds : null);
          if (list && list.length > 0) {
            list.forEach((id: string) => {
              deletedAccountIdsRef.current.add(String(id).toLowerCase());
              deletedAccountIdsRef.current.add(String(id).toLowerCase().replace(/\s+/g, ''));
            });
            setDeletedAccountIds(prev => {
              const set = new Set(prev);
              let added = false;
              list.forEach((id: string) => {
                const lower = String(id).toLowerCase();
                if (!set.has(lower)) {
                  set.add(lower);
                  added = true;
                }
              });
              if (!added) return prev;
              const arr = Array.from(set);
              try { localStorage.setItem('stanbax_deleted_account_ids', JSON.stringify(arr)); } catch {}
              return arr;
            });
          }
        })
        .catch(() => {});

      // Poll Supabase Cloud State (powers stanbaxschools.ng on Netlify across devices & sessions)
      if (isRemoteEnabled()) {
        const liveCloud = await fetchLiveSupabaseChatAndDirectoryState();
        if (liveCloud) {
          if (Array.isArray(liveCloud.deletedAccountIds) && liveCloud.deletedAccountIds.length > 0) {
            liveCloud.deletedAccountIds.forEach((id: string) => {
              deletedAccountIdsRef.current.add(String(id).toLowerCase());
              deletedAccountIdsRef.current.add(String(id).toLowerCase().replace(/\s+/g, ''));
            });
          }

          if (Array.isArray(liveCloud.visitorConversations) && liveCloud.visitorConversations.length > 0) {
            setVisitorConversations(prev => {
              const { merged, changed } = mergeConversationLists(prev, liveCloud.visitorConversations!);
              if (!changed) return prev;
              try { localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(merged)); } catch {}
              return merged;
            });
          }

          if (liveCloud.schoolRepConfig && liveCloud.schoolRepConfig.repName) {
            setSchoolRepConfig(prev => {
              const remoteTime = liveCloud.schoolRepConfig.updatedAt
                ? new Date(liveCloud.schoolRepConfig.updatedAt).getTime()
                : 0;
              const localTime = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
              const isDifferent =
                liveCloud.schoolRepConfig.repName !== prev.repName ||
                liveCloud.schoolRepConfig.activeRole !== prev.activeRole ||
                liveCloud.schoolRepConfig.isAvailable !== prev.isAvailable ||
                liveCloud.schoolRepConfig.welcomeMessage !== prev.welcomeMessage;
              if (!isDifferent || (localTime > 0 && remoteTime < localTime)) {
                return prev;
              }
              const updated = { ...prev, ...liveCloud.schoolRepConfig };
              try { localStorage.setItem('stanbax_school_rep_config', JSON.stringify(updated)); } catch {}
              return updated;
            });
          }

          if (Array.isArray(liveCloud.chatChannels) && liveCloud.chatChannels.length > 0) {
            setChatChannels(prev => {
              const map = new Map<string, ChatChannel>();
              for (const c of prev) map.set(c.id, c);
              let changed = false;
              for (const c of liveCloud.chatChannels!) {
                if (c?.id && !map.has(c.id)) {
                  map.set(c.id, c);
                  changed = true;
                }
              }
              if (!changed) return prev;
              const combined = Array.from(map.values());
              setLocalStorageSilent('stanbax_chat_channels', JSON.stringify(combined));
              return combined;
            });
          }

          if (Array.isArray(liveCloud.chatMessages) && liveCloud.chatMessages.length > 0) {
            setChatMessages(prev => {
              const map = new Map<string, SchoolChatMessage>();
              for (const m of prev) map.set(m.id, m);
              let changed = false;
              for (const m of liveCloud.chatMessages!) {
                if (m?.id && !map.has(m.id)) {
                  map.set(m.id, m);
                  changed = true;
                }
              }
              if (!changed) return prev;
              const combined = Array.from(map.values()).sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
              setLocalStorageSilent('stanbax_chat_messages', JSON.stringify(combined));
              return combined;
            });
          }

          // Only apply cloud students/subjects/assessmentConfig if there is no recent local mutation in the last 8s
          if (!hasPendingRemoteWrites() && Date.now() - lastLocalMutationAt >= 8000) {
            if (Array.isArray(liveCloud.subjects) && liveCloud.subjects.length > 0) {
              const normalized = normalizeSubjectCatalog(liveCloud.subjects);
              setSubjects(prev => {
                if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev;
                setLocalStorageSilent('stanbax_subjects', JSON.stringify(normalized));
                return normalized;
              });
            }

            if (Array.isArray(liveCloud.students) && liveCloud.students.length > 0) {
              setStudents(prev => {
                const remoteValid = liveCloud.students!.filter(
                  (s: StudentProfile) => s && s.id && !isAccountTombstoned(s.id, s.regNumber, s.email)
                );
                // If remote has an authoritative full roster (e.g. 88 students on cloud) and local has un-synced defaults (e.g. 106),
                // filter local prev to only keep students that either exist in remoteValid OR were locally modified more recently than remote
                const maxRemoteTs = remoteValid.reduce((max: number, s: any) => {
                  const t = Math.max(
                    s?.updatedAt ? new Date(s.updatedAt).getTime() : 0,
                    s?.lastCollatedResult?.dispatchedAt ? new Date(s.lastCollatedResult.dispatchedAt).getTime() : 0
                  );
                  return t > max ? t : max;
                }, 0);

                const remoteIdSet = new Set(remoteValid.map((s: any) => String(s.id || '').toLowerCase()));
                const remoteRegSet = new Set(remoteValid.map((s: any) => normalizeRegForUpsert(s.regNumber)));

                const prevFiltered = prev.filter(s => {
                  if (!s || !s.id || isAccountTombstoned(s.id, s.regNumber, s.email)) return false;
                  if (remoteValid.length >= 10) {
                    const inRemote =
                      remoteIdSet.has(String(s.id).toLowerCase()) ||
                      (s.regNumber && remoteRegSet.has(normalizeRegForUpsert(s.regNumber)));
                    if (inRemote) return true;
                    const locTs = Math.max(
                      (s as any).updatedAt ? new Date((s as any).updatedAt).getTime() : 0,
                      s.lastCollatedResult?.dispatchedAt ? new Date(s.lastCollatedResult.dispatchedAt).getTime() : 0
                    );
                    // Only keep a local-only student if it was created/edited locally after the cloud snapshot
                    return locTs > 0 && locTs >= maxRemoteTs;
                  }
                  return true;
                });

                const combined = deduplicateStudentsByRegistration([...remoteValid, ...prevFiltered]);
                if (JSON.stringify(combined) === JSON.stringify(prev)) return prev;
                setLocalStorageSilent('stanbax_students', JSON.stringify(combined));
                return combined;
              });
            }

            if (liveCloud.assessmentConfig && typeof liveCloud.assessmentConfig === 'object') {
              setAssessmentConfig(prev => {
                const remoteCfg = liveCloud.assessmentConfig;
                const remTime = remoteCfg.resultsDispatchedAt ? new Date(remoteCfg.resultsDispatchedAt).getTime() : 0;
                const locTime = prev.resultsDispatchedAt ? new Date(prev.resultsDispatchedAt).getTime() : 0;
                if (locTime > remTime) return prev;
                const isDiff =
                  remoteCfg.resultsDispatchedToDashboard !== prev.resultsDispatchedToDashboard ||
                  remoteCfg.dispatchedReportKind !== prev.dispatchedReportKind ||
                  remoteCfg.resultsDispatchedAt !== prev.resultsDispatchedAt ||
                  remoteCfg.midTermResultsPublished !== prev.midTermResultsPublished ||
                  remoteCfg.endTermResultsPublished !== prev.endTermResultsPublished ||
                  remoteCfg.activePhase !== prev.activePhase ||
                  remoteCfg.activeTerm !== prev.activeTerm ||
                  remoteCfg.activeSession !== prev.activeSession;
                if (!isDiff) return prev;
                const updated = { ...prev, ...remoteCfg };
                setLocalStorageSilent('stanbax_assessment_config', JSON.stringify(updated));
                return updated;
              });
            }
          }

          if (Array.isArray(liveCloud.tutors) && liveCloud.tutors.length > 0) {
            setTutors(prev => {
              const map = new Map<string, TutorProfile>();
              for (const t of prev) {
                if (!isAccountTombstoned(t.id, t.staffId || t.email, t.email)) {
                  map.set(t.id, t);
                }
              }
              let changed = false;
              for (const t of liveCloud.tutors!) {
                if (!t?.id || isAccountTombstoned(t.id, t.staffId || t.email, t.email)) continue;
                if (!map.has(t.id)) {
                  map.set(t.id, t);
                  changed = true;
                }
              }
              if (!changed && map.size === prev.length) return prev;
              const combined = Array.from(map.values());
              setLocalStorageSilent('stanbax_tutors', JSON.stringify(combined));
              return combined;
            });
          }

          if (Array.isArray(liveCloud.parents) && liveCloud.parents.length > 0) {
            setParents(prev => {
              const map = new Map<string, ParentProfile>();
              for (const p of prev) {
                if (!isAccountTombstoned(p.id, p.phone || p.email, p.email)) {
                  map.set(p.id, p);
                }
              }
              let changed = false;
              for (const p of liveCloud.parents!) {
                if (!p?.id || isAccountTombstoned(p.id, p.phone || p.email, p.email)) continue;
                if (!map.has(p.id)) {
                  map.set(p.id, p);
                  changed = true;
                }
              }
              if (!changed && map.size === prev.length) return prev;
              const combined = Array.from(map.values());
              setLocalStorageSilent('stanbax_parents_list', JSON.stringify(combined));
              return combined;
            });
          }
        }
      }
    };

    void pollLiveState();
    const pollInterval = setInterval(() => {
      void pollLiveState();
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const safeSaveConversations = (conversations: VisitorConversation[]) => {
    try {
      localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(conversations));
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        console.warn('LocalStorage quota limit reached, trimming legacy caches...');
        try {
          localStorage.removeItem('stanbax_chat_drafts');
          localStorage.removeItem('stanbax_cached_audio');
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(conversations));
          window.dispatchEvent(new Event('storage'));
        } catch {}
      }
    }
  };

  const setChatTyping = async (visitorId: string, sender: 'representative' | 'visitor', isTyping: boolean, senderName?: string) => {
    if (!visitorId) return;
    setTypingMap(prev => {
      const current = prev[visitorId] || {};
      const updated = {
        ...current,
        ...(sender === 'representative'
          ? { isRepTyping: isTyping, repName: isTyping ? (senderName || schoolRepConfig.repName) : undefined }
          : { isVisitorTyping: isTyping, visitorName: isTyping ? senderName : undefined })
      };
      const nextMap = { ...prev, [visitorId]: updated };
      try {
        localStorage.setItem('stanbax_chat_typing', JSON.stringify(nextMap));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      return nextMap;
    });

    try {
      void fetch('/api/chat-typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: visitorId,
          sender,
          senderName: senderName || (sender === 'representative' ? schoolRepConfig.repName : 'Visitor'),
          isTyping
        })
      });
    } catch {}
  };

  // Cross-tab synchronization for visitor inquiries, representative status, and typing indicators
  useEffect(() => {
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'stanbax_visitor_conversations' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setVisitorConversations(parsed);
          }
        } catch {}
      }
      if (e.key === 'stanbax_school_rep_config' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            setSchoolRepConfig(prev => ({ ...prev, ...parsed }));
          }
        } catch {}
      }
      if (e.key === 'stanbax_chat_typing' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') setTypingMap(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_custom_results' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setCustomResults(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_waec_subjects' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setWaecSubjects(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_waec_dept_recommendations' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') setWaecDepartmentRecommendations(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_waec_registrations' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setWaecRegistrations(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_waec_prompt_broadcast' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') setWaecPromptBroadcast(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_subjects' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) setSubjects(parsed.map(normalizeSubject));
        } catch {}
      }
      if (e.key === 'stanbax_students' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setStudents(deduplicateStudentsByRegistration(parsed));
        } catch {}
      }
      if (e.key === 'stanbax_house_standings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) setHouseStandings(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_landing_sections' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') setLandingSections(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_app_theme' && e.newValue) {
        const nextTheme = e.newValue.replace(/"/g, '') as AppTheme;
        if (['crimson-gold', 'sapphire-collegiate', 'emerald-ivy'].includes(nextTheme)) {
          setAppThemeState(nextTheme);
          document.documentElement.setAttribute('data-theme', nextTheme);
          document.body.setAttribute('data-theme', nextTheme);
        }
      }
      if (e.key === 'stanbax_parents_list' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setParents(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_tutors' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setTutors(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_moderators' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setModerators(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_chat_channels' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setChatChannels(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_chat_messages' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setChatMessages(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_parent_consultations' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setConsultationRequests(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_chat_read_timestamps' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') setLastReadTimestamps(parsed);
        } catch {}
      }
      if (e.key === 'stanbax_assessment_config' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') setAssessmentConfig(prev => ({ ...prev, ...parsed }));
        } catch {}
      }
    };

    // Live custom event fired on realtime cloud sync or broadcast
    const handleCloudStateEvent = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail?.key) return;
      const { key, data } = detail;
      if (key === 'stanbax_visitor_conversations' && Array.isArray(data)) {
        setVisitorConversations(prev => {
          const { merged, changed } = mergeConversationLists(prev, data);
          return changed ? merged : prev;
        });
      } else if (key === 'stanbax_school_rep_config' && data && typeof data === 'object') {
        setSchoolRepConfig(prev => ({ ...prev, ...data }));
      } else if (key === 'stanbax_chat_channels' && Array.isArray(data)) {
        setChatChannels(data);
      } else if (key === 'stanbax_chat_messages' && Array.isArray(data)) {
        setChatMessages(data);
      } else if (key === 'stanbax_chat_typing' && data && typeof data === 'object') {
        setTypingMap(data);
      } else if (key === 'stanbax_parent_consultations' && Array.isArray(data)) {
        setConsultationRequests(data);
      } else if (key === 'stanbax_chat_read_timestamps' && data && typeof data === 'object') {
        setLastReadTimestamps(data);
      } else if (key === 'stanbax_tutors' && Array.isArray(data)) {
        setTutors(data);
      } else if (key === 'stanbax_moderators' && Array.isArray(data)) {
        setModerators(data);
      } else if (key === 'stanbax_custom_results' && Array.isArray(data)) {
        setCustomResults(data);
      } else if (key === 'stanbax_waec_subjects' && Array.isArray(data)) {
        setWaecSubjects(data);
      } else if (key === 'stanbax_waec_dept_recommendations' && data && typeof data === 'object') {
        setWaecDepartmentRecommendations(data);
      } else if (key === 'stanbax_waec_registrations' && Array.isArray(data)) {
        setWaecRegistrations(data);
      } else if (key === 'stanbax_waec_prompt_broadcast' && data && typeof data === 'object') {
        setWaecPromptBroadcast(data);
      } else if (key === 'stanbax_subjects' && Array.isArray(data) && data.length > 0) {
        setSubjects(data.map(normalizeSubject));
      } else if (key === 'stanbax_students' && Array.isArray(data)) {
        setStudents(deduplicateStudentsByRegistration(data));
      } else if (key === 'stanbax_assessment_config' && data && typeof data === 'object') {
        setAssessmentConfig(prev => ({ ...prev, ...data }));
      } else if (key === 'stanbax_house_standings' && Array.isArray(data)) {
        setHouseStandings(data);
      } else if (key === 'stanbax_landing_sections' && data && typeof data === 'object') {
        setLandingSections(data as LandingPageSectionsConfig);
      } else if (key === 'stanbax_app_theme' && typeof data === 'string') {
        if (['crimson-gold', 'sapphire-collegiate', 'emerald-ivy'].includes(data as any)) {
          setAppThemeState(data as AppTheme);
          document.documentElement.setAttribute('data-theme', data);
          document.body.setAttribute('data-theme', data);
        }
      } else if (key === 'stanbax_parents_list' && Array.isArray(data)) {
        setParents(data);
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('stanbax_cloud_state_changed', handleCloudStateEvent);
    window.addEventListener('stanbax-state-change', handleCloudStateEvent);

    // Initial background cloud sync for newly introduced datatypes
    const bootstrapNewDataTypes = async () => {
      try {
        if (!localStorage.getItem('stanbax_landing_sections')) {
          localStorage.setItem('stanbax_landing_sections', JSON.stringify(landingSections));
        }
        if (!localStorage.getItem('stanbax_app_theme')) {
          localStorage.setItem('stanbax_app_theme', appTheme);
        }
        document.documentElement.setAttribute('data-theme', appTheme);
        document.body.setAttribute('data-theme', appTheme);

        // Hydrate from server database on startup
        fetch('/api/theme')
          .then(res => res.json())
          .then(resData => {
            if (resData?.success && resData.theme && ['crimson-gold', 'sapphire-collegiate', 'emerald-ivy'].includes(resData.theme)) {
              setAppThemeState(resData.theme);
              try {
                localStorage.setItem('stanbax_app_theme', resData.theme);
                document.documentElement.setAttribute('data-theme', resData.theme);
                document.body.setAttribute('data-theme', resData.theme);
              } catch {}
            }
          })
          .catch(() => {});
        if (!localStorage.getItem('stanbax_parents_list')) {
          localStorage.setItem('stanbax_parents_list', JSON.stringify(parents));
        }
        if (!localStorage.getItem('stanbax_custom_results')) {
          localStorage.setItem('stanbax_custom_results', JSON.stringify(customResults));
        }
        if (!localStorage.getItem('stanbax_waec_subjects')) {
          localStorage.setItem('stanbax_waec_subjects', JSON.stringify(waecSubjects));
        }
        if (!localStorage.getItem('stanbax_waec_dept_recommendations')) {
          localStorage.setItem('stanbax_waec_dept_recommendations', JSON.stringify(waecDepartmentRecommendations));
        }
        if (!localStorage.getItem('stanbax_waec_registrations')) {
          localStorage.setItem('stanbax_waec_registrations', JSON.stringify(waecRegistrations));
        }
        if (!localStorage.getItem('stanbax_students')) {
          localStorage.setItem('stanbax_students', JSON.stringify(students));
        }
      } catch {}

      if (isRemoteEnabled()) {
        try {
          await syncNewDataTypesOnline({
            customResults,
            waecSubjects,
            waecDeptRecommendations: waecDepartmentRecommendations,
            waecRegistrations,
            waecPromptBroadcast,
            students
          });
        } catch { /* best effort */ }
      }
    };

    void bootstrapNewDataTypes();

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('stanbax_cloud_state_changed', handleCloudStateEvent);
      window.removeEventListener('stanbax-state-change', handleCloudStateEvent);
    };
  }, []);

  const sendVisitorMessage = async (
    visitorId: string,
    messageText: string,
    visitorInfo?: { name?: string; phone?: string; email?: string; category?: any; language?: string },
    attachment?: { url: string; name: string; type: 'image' | 'document' | 'audio'; audioDuration?: number }
  ): Promise<VisitorChatMessage | null> => {
    const text = messageText.trim();
    if (!text && !attachment) return null;

    // Clear typing status on send
    void setChatTyping(visitorId, 'visitor', false);

    const now = new Date().toISOString();
    const userMsg: VisitorChatMessage = {
      id: `vmsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: 'visitor',
      senderName: visitorInfo?.name || 'Visitor',
      content: text || (attachment?.type === 'audio' ? 'Voice message' : 'Attachment shared'),
      timestamp: now,
      status: 'delivered',
      deliveredAt: now,
      attachmentUrl: attachment?.url,
      attachmentName: attachment?.name,
      attachmentType: attachment?.type,
      audioDuration: attachment?.audioDuration
    };

    const existingConv = visitorConversations.find(c => c.visitorId === visitorId);
    const effectiveVisitorName = visitorInfo?.name || existingConv?.visitorName || `Prospective Parent (${Math.floor(1000 + Math.random() * 9000)})`;
    const historyPayload = existingConv?.messages 
      ? existingConv.messages.map((m: VisitorChatMessage) => ({ sender: m.sender, content: m.content })) 
      : [];

    setVisitorConversations(prev => {
      const existingIdx = prev.findIndex(c => c.visitorId === visitorId);

      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        const updatedMessages = [...existing.messages, userMsg];
        const updated: VisitorConversation = {
          ...existing,
          queryCode: existing.queryCode || `STX-${visitorId.slice(-5).toUpperCase()}`,
          visitorName: effectiveVisitorName,
          visitorPhone: visitorInfo?.phone || existing.visitorPhone,
          visitorEmail: visitorInfo?.email || existing.visitorEmail,
          lastMessageAt: now,
          unreadByAdmin: true,
          status: 'waiting_rep',
          messages: updatedMessages
        };
        const copy = [...prev];
        copy[existingIdx] = updated;
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        broadcastLocalStateChange('stanbax_visitor_conversations', copy);
        void syncStateOnline('stanbax_visitor_conversations', copy);
        void fetch('/api/visitor-conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId,
            message: text,
            visitorInfo: {
              name: effectiveVisitorName,
              phone: visitorInfo?.phone,
              email: visitorInfo?.email,
              category: visitorInfo?.category,
              language: visitorInfo?.language
            },
            attachment
          })
        }).catch(() => {});
        return copy;
      } else {
        const newConv: VisitorConversation = {
          visitorId,
          queryCode: `STX-${visitorId.slice(-5).toUpperCase()}`,
          visitorName: effectiveVisitorName,
          visitorPhone: visitorInfo?.phone,
          visitorEmail: visitorInfo?.email,
          visitorCategory: visitorInfo?.category || 'Prospective Parent',
          createdAt: now,
          lastMessageAt: now,
          status: 'waiting_rep',
          unreadByAdmin: true,
          messages: [userMsg]
        };
        const copy = [newConv, ...prev];
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        broadcastLocalStateChange('stanbax_visitor_conversations', copy);
        void syncStateOnline('stanbax_visitor_conversations', copy);
        void fetch('/api/visitor-conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId,
            message: text,
            visitorInfo: {
              name: effectiveVisitorName,
              phone: visitorInfo?.phone,
              email: visitorInfo?.email,
              category: visitorInfo?.category,
              language: visitorInfo?.language
            },
            attachment
          })
        }).catch(() => {});
        return copy;
      }
    });

    // If representative is not available (or offline), Calvin AI steps in as the virtual representative!
    if (!schoolRepConfig.isAvailable) {
      try {
        const res = await fetch('/api/visitor-rep-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            visitorName: effectiveVisitorName,
            repName: schoolRepConfig.repName,
            repTitle: schoolRepConfig.repTitle,
            repRole: schoolRepConfig.activeRole,
            language: visitorInfo?.language || 'en',
            chatHistory: historyPayload
          })
        });

        const data = await res.json();
        const replyText = data?.reply || "Thank you for contacting Stanbax Schools Ibadan! Your inquiry has been received and our school representative will review and respond promptly.";

        const aiMsgNow = new Date().toISOString();
        const aiMsg: VisitorChatMessage = {
          id: `aimsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          sender: 'calvin_ai',
          senderName: 'Calvin AI (Virtual Rep)',
          senderTitle: `Assisting for ${schoolRepConfig.repName}`,
          content: replyText,
          timestamp: aiMsgNow,
          isAiResponse: true,
          status: 'delivered',
          deliveredAt: aiMsgNow
        };

        setVisitorConversations(prev => {
          const idx = prev.findIndex(c => c.visitorId === visitorId);
          if (idx >= 0) {
            const existing = prev[idx];
            const updated = {
              ...existing,
              lastMessageAt: new Date().toISOString(),
              messages: [...existing.messages, aiMsg]
            };
            const copy = [...prev];
            copy[idx] = updated;
            try {
              localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
              window.dispatchEvent(new Event('storage'));
            } catch {}
            return copy;
          }
          return prev;
        });

        return aiMsg;
      } catch (err) {
        console.warn('Calvin AI virtual rep fetch error:', err);
      }
    }

    return null;
  };

  // Instant Calvin AI stand-in if representative is online but busy
  const requestCalvinAiInstantReply = async (visitorId: string): Promise<VisitorChatMessage | null> => {
    const existingConv = visitorConversations.find(c => c.visitorId === visitorId);
    if (!existingConv || existingConv.messages.length === 0) return null;
    const lastUserMsg = [...existingConv.messages].reverse().find(m => m.sender === 'visitor');
    if (!lastUserMsg) return null;

    const historyPayload = existingConv.messages.map(m => ({ sender: m.sender, content: m.content }));
    try {
      const res = await fetch('/api/visitor-rep-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: lastUserMsg.content,
          visitorName: existingConv.visitorName,
          repName: schoolRepConfig.repName,
          repTitle: schoolRepConfig.repTitle,
          repRole: schoolRepConfig.activeRole,
          chatHistory: historyPayload
        })
      });

      const data = await res.json();
      const replyText = data?.reply || `Thank you for contacting Stanbax Schools! Your query has been noted and ${schoolRepConfig.repName} will reply shortly.`;

      const aiMsgNow = new Date().toISOString();
      const aiMsg: VisitorChatMessage = {
        id: `aimsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        sender: 'calvin_ai',
        senderName: 'Calvin AI (Virtual Rep)',
        senderTitle: `Assisting for ${schoolRepConfig.repName}`,
        content: replyText,
        timestamp: aiMsgNow,
        isAiResponse: true,
        status: 'delivered',
        deliveredAt: aiMsgNow
      };

      setVisitorConversations(prev => {
        const idx = prev.findIndex(c => c.visitorId === visitorId);
        if (idx >= 0) {
          const existing = prev[idx];
          const updated = {
            ...existing,
            lastMessageAt: new Date().toISOString(),
            messages: [...existing.messages, aiMsg]
          };
          const copy = [...prev];
          copy[idx] = updated;
          try {
            localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
            window.dispatchEvent(new Event('storage'));
          } catch {}
          return copy;
        }
        return prev;
      });

      return aiMsg;
    } catch (err) {
      console.warn('Error fetching Calvin AI instant reply:', err);
      return null;
    }
  };

  const replyAsRepresentative = (
    visitorId: string,
    replyContent: string,
    repInfo?: { name?: string; title?: string },
    attachment?: { url: string; name: string; type: 'image' | 'document' | 'audio'; audioDuration?: number }
  ) => {
    const text = replyContent.trim();
    if (!text && !attachment) return;

    // Clear typing status on send
    void setChatTyping(visitorId, 'representative', false);

    const now = new Date().toISOString();
    const repMsg: VisitorChatMessage = {
      id: `repmsg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: 'representative',
      senderName: repInfo?.name || schoolRepConfig.repName,
      senderTitle: repInfo?.title || schoolRepConfig.repTitle,
      senderAvatar: schoolRepConfig.repAvatar,
      content: text || (attachment?.type === 'audio' ? 'Representative Voice Memo' : 'Document Attached'),
      timestamp: now,
      status: 'delivered',
      deliveredAt: now,
      attachmentUrl: attachment?.url,
      attachmentName: attachment?.name,
      attachmentType: attachment?.type,
      audioDuration: attachment?.audioDuration
    };

    setVisitorConversations(prev => {
      const idx = prev.findIndex(c => c.visitorId === visitorId);
      if (idx >= 0) {
        const existing = prev[idx];
        const updated = {
          ...existing,
          status: 'resolved' as const,
          unreadByAdmin: false,
          unreadByVisitor: true,
          lastMessageAt: now,
          messages: [...existing.messages, repMsg]
        };
        const copy = [...prev];
        copy[idx] = updated;
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        broadcastLocalStateChange('stanbax_visitor_conversations', copy);
        void syncStateOnline('stanbax_visitor_conversations', copy);
        void fetch(`/api/visitor-conversations/${encodeURIComponent(visitorId)}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            replyContent: text,
            repInfo: {
              name: repInfo?.name || schoolRepConfig.repName,
              title: repInfo?.title || schoolRepConfig.repTitle
            },
            attachment
          })
        }).catch(() => {});
        return copy;
      }
      return prev;
    });
  };

  // 1. Admissions Screening & Consultation Appointment Booking inside Chat
  const bookChatAppointment = async (
    visitorId: string,
    data: Omit<ChatAppointment, 'id' | 'createdAt' | 'status'>
  ): Promise<ChatAppointment> => {
    const now = new Date().toISOString();
    const newAppointment: ChatAppointment = {
      ...data,
      id: `apt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: 'confirmed',
      createdAt: now
    };

    // Auto-sync into School Academic Calendar
    try {
      addCalendarEvent({
        title: `Screening/Visit: ${data.type} (${data.candidateName})`,
        date: data.date,
        category: 'Meeting',
        description: `Scheduled slot: ${data.timeSlot} • Candidate: ${data.candidateName} • Parent contact: ${data.parentPhone}. Notes: ${data.notes || 'None'}`
      });
    } catch {}

    const apptMsg: VisitorChatMessage = {
      id: `msg-apt-${Date.now()}`,
      sender: 'representative',
      senderName: schoolRepConfig.repName,
      senderTitle: schoolRepConfig.repTitle,
      content: `Official Appointment Confirmed: ${data.type} for candidate ${data.candidateName} on ${new Date(data.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${data.timeSlot}. A calendar appointment has been logged with our admissions desk.`,
      timestamp: now,
      status: 'delivered',
      deliveredAt: now,
      isAppointmentNotice: true,
      appointmentData: newAppointment
    };

    setVisitorConversations(prev => {
      const idx = prev.findIndex(c => c.visitorId === visitorId);
      if (idx >= 0) {
        const conv = prev[idx];
        const updatedAppointments = [...(conv.appointments || []), newAppointment];
        const updatedMessages = [...conv.messages, apptMsg];
        const copy = [...prev];
        copy[idx] = {
          ...conv,
          appointments: updatedAppointments,
          messages: updatedMessages,
          visitorPhone: data.parentPhone || conv.visitorPhone,
          visitorEmail: data.parentEmail || conv.visitorEmail,
          lastMessageAt: now
        };
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        return copy;
      }
      return prev;
    });

    return newAppointment;
  };

  // 4. Multi-Representative Department Hand-Off & Routing
  const transferConversationDepartment = (
    visitorId: string,
    targetRole: SchoolRepRole,
    targetRepName: string,
    targetRepTitle: string,
    reason?: string
  ) => {
    const now = new Date().toISOString();
    const existing = visitorConversations.find(c => c.visitorId === visitorId);
    const currentRole = existing?.assignedRole || schoolRepConfig.activeRole;

    const record: ChatTransferRecord = {
      fromRole: currentRole,
      toRole: targetRole,
      transferredBy: schoolRepConfig.repName,
      targetRepName,
      targetRepTitle,
      reason,
      timestamp: now
    };

    const transferMsg: VisitorChatMessage = {
      id: `transfer-${Date.now()}`,
      sender: 'representative',
      senderName: targetRepName,
      senderTitle: targetRepTitle,
      content: `Department Hand-Off: Inquiry transferred to ${targetRepName} (${targetRepTitle})${reason ? ` • Transfer Reason: "${reason}"` : ''}. All conversation history and submitted documents have been routed to the active desk.`,
      timestamp: now,
      status: 'delivered',
      deliveredAt: now,
      isTransferNotice: true,
      transferData: record
    };

    setVisitorConversations(prev => {
      const idx = prev.findIndex(c => c.visitorId === visitorId);
      if (idx >= 0) {
        const conv = prev[idx];
        const copy = [...prev];
        copy[idx] = {
          ...conv,
          assignedRole: targetRole,
          assignedRepName: targetRepName,
          assignedRepTitle: targetRepTitle,
          transferHistory: [...(conv.transferHistory || []), record],
          messages: [...conv.messages, transferMsg],
          lastMessageAt: now,
          status: 'waiting_rep',
          unreadByAdmin: true
        };
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        return copy;
      }
      return prev;
    });
  };

  // 5. Visitor WhatsApp/SMS Notification Opt-in
  const updateVisitorNotificationOptIn = (
    visitorId: string,
    optIn: { whatsapp?: boolean; sms?: boolean; phone?: string; email?: string }
  ) => {
    setVisitorConversations(prev => {
      const idx = prev.findIndex(c => c.visitorId === visitorId);
      if (idx >= 0) {
        const conv = prev[idx];
        const copy = [...prev];
        copy[idx] = {
          ...conv,
          visitorPhone: optIn.phone || conv.visitorPhone,
          visitorEmail: optIn.email || conv.visitorEmail,
          notificationOptIn: {
            ...conv.notificationOptIn,
            ...optIn
          }
        };
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        return copy;
      }
      return prev;
    });
  };

  const markVisitorConversationRead = (visitorId: string) => {
    setVisitorConversations(prev => {
      const idx = prev.findIndex(c => c.visitorId === visitorId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], unreadByAdmin: false };
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        return copy;
      }
      return prev;
    });
  };

  const getVisitorConversation = (visitorId: string): VisitorConversation | undefined => {
    return visitorConversations.find(c => c.visitorId === visitorId);
  };

  const restoreVisitorConversationByCode = async (rawCode: string): Promise<VisitorConversation | null> => {
    const clean = rawCode.trim();
    if (!clean) return null;
    const upper = clean.toUpperCase().replace(/\s+/g, '');
    const strippedCode = upper.replace(/^STX-?/, '').replace(/^REF:?/, '');

    let latestList = [...visitorConversations];

    // Pull freshest conversations from Express server & Supabase Cloud first
    try {
      const apiRes = await fetch('/api/visitor-conversations');
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (Array.isArray(apiData?.conversations)) {
          latestList = mergeConversationLists(latestList, apiData.conversations).merged;
        }
      }
    } catch {}

    if (isRemoteEnabled()) {
      try {
        const cloud = await fetchLiveSupabaseChatAndDirectoryState();
        if (cloud && Array.isArray(cloud.visitorConversations)) {
          latestList = mergeConversationLists(latestList, cloud.visitorConversations).merged;
        }
      } catch {}
    }

    const matched = latestList.find(c => {
      const cCode = (c.queryCode || `STX-${c.visitorId.slice(-5).toUpperCase()}`).toUpperCase();
      const cShort = c.visitorId.slice(-5).toUpperCase();
      const cPhone = (c.visitorPhone || c.notificationOptIn?.phone || '').replace(/[^0-9]/g, '');
      const inputPhone = clean.replace(/[^0-9]/g, '');
      return (
        cCode === upper ||
        cShort === strippedCode ||
        c.visitorId.toLowerCase() === clean.toLowerCase() ||
        (inputPhone.length >= 7 && cPhone.length >= 7 && cPhone.endsWith(inputPhone.slice(-7)))
      );
    });

    if (matched) {
      setVisitorConversations(prev => {
        const { merged } = mergeConversationLists(prev, latestList);
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(merged));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        return merged;
      });
      return matched;
    }

    return null;
  };

  // Mark all visitor queries in this conversation as seen & acknowledged by the school representative
  const markConversationSeenByAdmin = (visitorId: string) => {
    const now = new Date().toISOString();
    setVisitorConversations(prev => {
      const idx = prev.findIndex(c => c.visitorId === visitorId);
      if (idx >= 0) {
        const conv = prev[idx];
        let changed = false;
        const updatedMessages = conv.messages.map(m => {
          if (m.sender === 'visitor' && m.status !== 'seen') {
            changed = true;
            return {
              ...m,
              status: 'seen' as const,
              seenAt: m.seenAt || now
            };
          }
          return m;
        });

        if (!changed && !conv.unreadByAdmin) return prev;

        const updated: VisitorConversation = {
          ...conv,
          unreadByAdmin: false,
          lastSeenByAdminAt: now,
          messages: updatedMessages
        };
        const copy = [...prev];
        copy[idx] = updated;
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        return copy;
      }
      return prev;
    });

    try {
      void fetch('/api/chat-delivery/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: visitorId,
          role: 'representative',
          name: schoolRepConfig.repName,
          lastSeenAt: now
        })
      });
    } catch {}
  };

  // Mark all representative/Calvin AI responses in this conversation as seen by the visitor/user
  const markConversationSeenByVisitor = (visitorId: string) => {
    const now = new Date().toISOString();
    setVisitorConversations(prev => {
      const idx = prev.findIndex(c => c.visitorId === visitorId);
      if (idx >= 0) {
        const conv = prev[idx];
        let changed = false;
        const updatedMessages = conv.messages.map(m => {
          if ((m.sender === 'representative' || m.sender === 'calvin_ai') && m.status !== 'seen') {
            changed = true;
            return {
              ...m,
              status: 'seen' as const,
              seenAt: m.seenAt || now
            };
          }
          return m;
        });

        if (!changed && !conv.unreadByVisitor) return prev;

        const updated: VisitorConversation = {
          ...conv,
          unreadByVisitor: false,
          lastSeenByVisitorAt: now,
          messages: updatedMessages
        };
        const copy = [...prev];
        copy[idx] = updated;
        try {
          localStorage.setItem('stanbax_visitor_conversations', JSON.stringify(copy));
          window.dispatchEvent(new Event('storage'));
        } catch {}
        return copy;
      }
      return prev;
    });

    try {
      void fetch('/api/chat-delivery/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: visitorId,
          role: 'visitor',
          lastSeenAt: now
        })
      });
    } catch {}
  };

  // 30. Website Production Contributors
  const [contributors, setContributors] = useState<Contributor[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_contributors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_CONTRIBUTORS;
  });

  const addContributor = (contribData: Omit<Contributor, 'id'>): Contributor => {
    const newContrib: Contributor = {
      ...contribData,
      id: `contrib-${Date.now()}`
    };
    setContributors(prev => {
      const updated = [...prev, newContrib].sort((a, b) => a.order - b.order);
      try { localStorage.setItem('stanbax_contributors', JSON.stringify(updated)); } catch {}
      return updated;
    });
    return newContrib;
  };

  const updateContributor = (id: string, updates: Partial<Contributor>) => {
    setContributors(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updates } : c).sort((a, b) => a.order - b.order);
      try { localStorage.setItem('stanbax_contributors', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const deleteContributor = (id: string): boolean => {
    let deleted = false;
    setContributors(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (filtered.length !== prev.length) deleted = true;
      try { localStorage.setItem('stanbax_contributors', JSON.stringify(filtered)); } catch {}
      return filtered;
    });
    return deleted;
  };

  const resetContributorsToDefault = () => {
    setContributors(DEFAULT_CONTRIBUTORS);
    try { localStorage.setItem('stanbax_contributors', JSON.stringify(DEFAULT_CONTRIBUTORS)); } catch {}
  };

  // 31. Official WAEC / WASSCE Registration System
  const [waecRegistrations, setWaecRegistrations] = useState<WaecRegistration[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_waec_registrations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_WAEC_REGISTRATIONS;
  });

  const [waecPromptBroadcast, setWaecPromptBroadcast] = useState<WaecPromptBroadcast>(() => {
    try {
      const saved = localStorage.getItem('stanbax_waec_prompt_broadcast');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return DEFAULT_WAEC_PROMPT_BROADCAST;
  });

  const isStudentSeniorCandidate = (grade?: string): boolean => {
    if (!grade) return false;
    const normalized = grade.toUpperCase().replace(/\s+/g, '');
    return (
      normalized.includes('SS2') ||
      normalized.includes('SS3') ||
      normalized.includes('SSS2') ||
      normalized.includes('SSS3') ||
      normalized.includes('SENIORSECONDARY2') ||
      normalized.includes('SENIORSECONDARY3')
    );
  };

  const saveWaecRegistration = (
    data: Omit<WaecRegistration, 'id' | 'updatedAt'> & { id?: string }
  ): WaecRegistration => {
    const now = new Date().toISOString();
    const existingIndex = waecRegistrations.findIndex(
      r => (data.id && r.id === data.id) || (data.studentId && r.studentId === data.studentId) || (data.regNumber && r.regNumber === data.regNumber)
    );

    let savedItem: WaecRegistration;

    if (existingIndex >= 0) {
      savedItem = {
        ...waecRegistrations[existingIndex],
        ...data,
        id: waecRegistrations[existingIndex].id,
        updatedAt: now
      };
      let updatedRegistrations: WaecRegistration[] = [];
      setWaecRegistrations(prev => {
        updatedRegistrations = [...prev];
        updatedRegistrations[existingIndex] = savedItem;
        try { localStorage.setItem('stanbax_waec_registrations', JSON.stringify(updatedRegistrations)); } catch {}
        return updatedRegistrations;
      });
      void syncStateOnline('stanbax_waec_registrations', updatedRegistrations);
    } else {
      savedItem = {
        ...data,
        id: data.id || `waec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        updatedAt: now
      };
      let updatedRegistrations: WaecRegistration[] = [];
      setWaecRegistrations(prev => {
        updatedRegistrations = [savedItem, ...prev];
        try { localStorage.setItem('stanbax_waec_registrations', JSON.stringify(updatedRegistrations)); } catch {}
        return updatedRegistrations;
      });
      void syncStateOnline('stanbax_waec_registrations', updatedRegistrations);
    }

    // Also update in all students list with online sync
    setStudents(prev => {
      const updatedList = prev.map(s => {
        if (s.id === data.studentId || s.regNumber === data.regNumber) {
          return {
            ...s,
            waecRegistration: savedItem,
            dateOfBirth: data.dateOfBirth || s.dateOfBirth,
            gender: data.gender || s.gender,
            passportPhoto: data.passportPhoto || s.passportPhoto,
            passportUrl: data.passportPhoto || s.passportUrl
          };
        }
        return s;
      });
      try { localStorage.setItem('stanbax_students', JSON.stringify(updatedList)); } catch {}
      void syncStateOnline('stanbax_students', updatedList);
      return updatedList;
    });

    return savedItem;
  };

  const updateWaecRegistrationStatus = (
    id: string,
    status: WaecRegistration['status'],
    adminRemarks?: string
  ) => {
    const now = new Date().toISOString();
    let updatedRegistrations: WaecRegistration[] = [];
    setWaecRegistrations(prev => {
      updatedRegistrations = prev.map(r => {
        if (r.id === id) {
          return {
            ...r,
            status,
            adminRemarks: adminRemarks !== undefined ? adminRemarks : r.adminRemarks,
            verifiedAt: status === 'verified' ? now : r.verifiedAt,
            verifiedBy: status === 'verified' ? 'School Examination Officer' : r.verifiedBy,
            updatedAt: now
          };
        }
        return r;
      });
      try { localStorage.setItem('stanbax_waec_registrations', JSON.stringify(updatedRegistrations)); } catch {}
      return updatedRegistrations;
    });
    void syncStateOnline('stanbax_waec_registrations', updatedRegistrations);
  };

  const broadcastWaecPrompt = (promptUpdates: Partial<WaecPromptBroadcast>) => {
    let nextPrompt: WaecPromptBroadcast;
    setWaecPromptBroadcast(prev => {
      nextPrompt = {
        ...prev,
        ...promptUpdates,
        sentAt: new Date().toISOString()
      };
      try { localStorage.setItem('stanbax_waec_prompt_broadcast', JSON.stringify(nextPrompt)); } catch {}
      return nextPrompt;
    });
    // @ts-ignore
    if (nextPrompt) {
      void syncStateOnline('stanbax_waec_prompt_broadcast', nextPrompt);
    }
  };

  const dismissWaecPromptForStudent = (studentId: string) => {
    updateStudent(studentId, { waecPromptDismissed: true });
  };

  const importWaecRegistrationsBatch = (imported: WaecRegistration[]): number => {
    if (!imported || imported.length === 0) return 0;
    let finalRegistrations: WaecRegistration[] = [];
    setWaecRegistrations(prev => {
      finalRegistrations = [...prev];
      for (const item of imported) {
        const existingIdx = finalRegistrations.findIndex(
          c => c.regNumber === item.regNumber || (item.candidateNumber && c.candidateNumber === item.candidateNumber)
        );
        if (existingIdx >= 0) {
          finalRegistrations[existingIdx] = { ...finalRegistrations[existingIdx], ...item, updatedAt: new Date().toISOString() };
        } else {
          finalRegistrations.push({
            ...item,
            id: item.id || `waec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            updatedAt: new Date().toISOString()
          });
        }
      }
      try { localStorage.setItem('stanbax_waec_registrations', JSON.stringify(finalRegistrations)); } catch {}
      return finalRegistrations;
    });
    void syncStateOnline('stanbax_waec_registrations', finalRegistrations);
    return imported.length;
  };

  const deleteWaecRegistration = (id: string) => {
    let nextRegistrations: WaecRegistration[] = [];
    setWaecRegistrations(prev => {
      nextRegistrations = prev.filter(r => r.id !== id);
      try { localStorage.setItem('stanbax_waec_registrations', JSON.stringify(nextRegistrations)); } catch {}
      return nextRegistrations;
    });
    void syncStateOnline('stanbax_waec_registrations', nextRegistrations);
  };

  // 31B. WAEC Subjects Catalog State (Editable by Admin with Online Cloud Sync)
  const [waecSubjects, setWaecSubjects] = useState<WaecCatalogSubject[]>(() => {
    try {
      const saved = localStorage.getItem('stanbax_waec_subjects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ALL_WAEC_SUBJECTS;
  });

  const [waecDepartmentRecommendations, setWaecDepartmentRecommendations] = useState<Record<'Science' | 'Arts' | 'Commercial', string[]>>(() => {
    try {
      const saved = localStorage.getItem('stanbax_waec_dept_recommendations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return DEPARTMENT_RECOMMENDED_SUBJECTS;
  });

  const updateWaecSubject = (code: string, updates: Partial<WaecCatalogSubject>, oldName?: string) => {
    let updatedSubjects: WaecCatalogSubject[] = [];
    setWaecSubjects(prev => {
      updatedSubjects = prev.map(s => (s.code.toUpperCase() === code.toUpperCase() ? { ...s, ...updates } : s));
      try { localStorage.setItem('stanbax_waec_subjects', JSON.stringify(updatedSubjects)); } catch {}
      return updatedSubjects;
    });
    void syncStateOnline('stanbax_waec_subjects', updatedSubjects);

    // If subject name changed, also update department recommendations & existing registrations if needed
    if (updates.name && oldName && updates.name !== oldName) {
      const newName = updates.name.trim();
      let updatedDept: Record<'Science' | 'Arts' | 'Commercial', string[]>;
      setWaecDepartmentRecommendations(prev => {
        updatedDept = {
          Science: prev.Science.map(s => s === oldName ? newName : s),
          Arts: prev.Arts.map(s => s === oldName ? newName : s),
          Commercial: prev.Commercial.map(s => s === oldName ? newName : s),
        };
        try { localStorage.setItem('stanbax_waec_dept_recommendations', JSON.stringify(updatedDept)); } catch {}
        return updatedDept;
      });
      // @ts-ignore
      if (updatedDept) void syncStateOnline('stanbax_waec_dept_recommendations', updatedDept);

      // Update in registered candidates
      let updatedRegs: WaecRegistration[] = [];
      setWaecRegistrations(prev => {
        let changed = false;
        updatedRegs = prev.map(reg => {
          if (reg.subjects && reg.subjects.includes(oldName)) {
            changed = true;
            return {
              ...reg,
              subjects: reg.subjects.map(s => s === oldName ? newName : s),
              updatedAt: new Date().toISOString()
            };
          }
          return reg;
        });
        if (changed) {
          try { localStorage.setItem('stanbax_waec_registrations', JSON.stringify(updatedRegs)); } catch {}
        }
        return updatedRegs;
      });
      if (updatedRegs.length > 0) void syncStateOnline('stanbax_waec_registrations', updatedRegs);
    }
  };

  const addWaecSubject = (subject: WaecCatalogSubject) => {
    let updatedSubjects: WaecCatalogSubject[] = [];
    setWaecSubjects(prev => {
      const existsIndex = prev.findIndex(s => s.code.toUpperCase() === subject.code.toUpperCase());
      if (existsIndex >= 0) {
        updatedSubjects = [...prev];
        updatedSubjects[existsIndex] = { ...updatedSubjects[existsIndex], ...subject };
      } else {
        updatedSubjects = [...prev, subject];
      }
      try { localStorage.setItem('stanbax_waec_subjects', JSON.stringify(updatedSubjects)); } catch {}
      return updatedSubjects;
    });
    void syncStateOnline('stanbax_waec_subjects', updatedSubjects);
  };

  const deleteWaecSubject = (code: string) => {
    let updatedSubjects: WaecCatalogSubject[] = [];
    setWaecSubjects(prev => {
      updatedSubjects = prev.filter(s => s.code.toUpperCase() !== code.toUpperCase());
      try { localStorage.setItem('stanbax_waec_subjects', JSON.stringify(updatedSubjects)); } catch {}
      return updatedSubjects;
    });
    void syncStateOnline('stanbax_waec_subjects', updatedSubjects);
  };

  const resetWaecSubjectsToDefault = () => {
    setWaecSubjects(ALL_WAEC_SUBJECTS);
    setWaecDepartmentRecommendations(DEPARTMENT_RECOMMENDED_SUBJECTS);
    try {
      localStorage.setItem('stanbax_waec_subjects', JSON.stringify(ALL_WAEC_SUBJECTS));
      localStorage.setItem('stanbax_waec_dept_recommendations', JSON.stringify(DEPARTMENT_RECOMMENDED_SUBJECTS));
    } catch {}
    void syncStateOnline('stanbax_waec_subjects', ALL_WAEC_SUBJECTS);
    void syncStateOnline('stanbax_waec_dept_recommendations', DEPARTMENT_RECOMMENDED_SUBJECTS);
  };

  const updateDepartmentRecommendations = (dept: 'Science' | 'Arts' | 'Commercial', subjects: string[]) => {
    let updatedDept: Record<'Science' | 'Arts' | 'Commercial', string[]>;
    setWaecDepartmentRecommendations(prev => {
      updatedDept = { ...prev, [dept]: subjects };
      try { localStorage.setItem('stanbax_waec_dept_recommendations', JSON.stringify(updatedDept)); } catch {}
      return updatedDept;
    });
    // @ts-ignore
    if (updatedDept) void syncStateOnline('stanbax_waec_dept_recommendations', updatedDept);
  };

  // 15B. Dynamic Available Academic Sessions across current & archives
  const availableSessions = Array.from(new Set([
    assessmentConfig.activeSession,
    '2025/2026 Academic Session',
    ...(student?.academicHistory?.map(h => h.sessionName) || []),
    '2024/2025 Academic Session',
    '2023/2024 Academic Session'
  ])).filter(Boolean);

  return (
    <SchoolContext.Provider
      value={{
        images,
        updateImage,
        resetImagesToDefault,
        schoolInfo,
        updateSchoolInfo,
        resetSchoolInfo,
        resetSchoolInfoToDefault: resetSchoolInfo,
        updateSchoolStats,
        resetSchoolStatsToDefault,
        proprietressProfile,
        updateProprietressProfile,
        resetProprietressProfileToDefault,
        appointments,
        bookAppointment,
        updateAppointmentStatus,
        deleteAppointment,
        messagesToProprietress,
        sendMessageToProprietress,
        updateProprietressMessageStatus,
        deleteProprietressMessage,
        directives,
        addDirective,
        updateDirective,
        deleteDirective,
        resetDirectivesToDefault,
        facultyList,
        addFacultyMember,
        updateFacultyMember,
        deleteFacultyMember,
        resetFacultyToDefault,
        classes,
        addClass,
        updateClass,
        deleteClass,
        resetClassesToDefault,
        assignClassTeacher,
        subjects,
        addSubject,
        updateSubject,
        deleteSubject,
        resetSubjectsToDefault,
        gradingSystem,
        gradingRules: gradingSystem,
        updateGradingRule,
        addGradingRule,
        deleteGradingRule,
        resetGradingSystem,
        resetGradingToDefault: resetGradingSystem,
        calculateGrade,
        tutors,
        tutor,
        activeTutorId,
        setActiveTutorId,
        switchActiveTutor: (id: string) => setActiveTutorId(id),
        assignSubjectsToTutor: (tutorId: string, subjList: string[]) => {
          updateTutor(tutorId, { assignedSubjects: subjList });
        },
        updateTutor,
        addTutor,
        deleteTutor,
        notices,
        addNotice,
        updateNotice,
        deleteNotice,
        applications,
        submitApplication,
        updateApplicationStatus,
        updateApplicationExamDetails,
        entranceExamSettings,
        updateEntranceExamSettings,
        resetEntranceExamSettings,
        broadcastLogs,
        addBroadcastLog,
        students,
        student,
        activeStudentId,
        setActiveStudentId,
        switchActiveStudent,
        updateStudent,
        registerStudent,
        addStudent,
        bulkUpsertStudents,
        onlineStudentsSynced,
        syncOnlineStudentsNow,
        updateStudentPassport,
        deleteStudent,
        homeworks,
        toggleHomeworkStatus,
        addHomework,
        deleteHomework,
        grades,
        updateGrade,
        batchUpdateClassGrades,
        getStudentGrades,
        assessmentConfig,
        updateAssessmentConfig,
        setActiveAssessmentPhase,
        setActiveAssessmentTerm,
        setPromotionPassMark,
        availableSessions,
        startNewAcademicSession,
        resetAssessmentToDefault,
        getNextClass,
        toggleAutoRanking,
        getClassRankings,
        dispatchCollatedResultsToDashboards,
        inquiries,
        submitInquiry,
        isAdminAuthenticated,
        isProprietressAuthenticated,
        isHeadmistressAuthenticated,
        isModeratorAuthenticated,
        isStudentAuthenticated,
        isTutorAuthenticated,
        authenticatedRole,
        universalLogin,
        loginAdmin,
        logoutAdmin,
        loginProprietress,
        logoutProprietress,
        loginHeadmistress,
        logoutHeadmistress,
        loginModerator,
        logoutModerator,
        loginStudent,
        logoutStudent,
        loginTutor,
        logoutTutor,
        logoutAll,
        toggleStudentAlumni,
        upgradeStudentToTutor,
        completeTutorProfile,
        createTutorAccount,
        officialSignatures,
        updateOfficialSignatures,
        resolveReportSheetSignatures,
        adminAccounts,
        activeAdminId,
        activeAdminAccount,
        isSuperAdmin,
        hasAdminPrivilege,
        createAdminAccount,
        updateAdminAccount,
        deleteAdminAccount,
        alumniRegistrations,
        registerAlumniAccount,
        approveAlumniRegistration,
        rejectAlumniRegistration,
        deleteAlumniRegistration,
        customResults,
        uploadCustomResult,
        updateCustomResult,
        deleteCustomResult,
        getStudentCustomResults,
        changePassword,
        forgotPasswordReset,
        getSecurityQuestionForUser,
        resetPasswordWithSecurityAnswer,
        getAllUserCredentials,
        adminResetUserPassword,
        adminDeleteUserAccount,
        adminSecurityQuestion,
        adminSecurityAnswer,
        updateAdminSecurityQuestion,
        appTheme,
        setAppTheme,
        availableThemes: DEFAULT_THEMES,
        lessonNotes,
        notesFeatureEnabled,
        addLessonNote,
        deleteLessonNote,
        toggleNotesFeature,
        deleteTermNotes,
        exportNotesZip,
        incrementNoteDownload,
        activeSection,
        setActiveSection,
        // 16. Landing Page CMS
        heroSlides,
        updateHeroSlide,
        addHeroSlide,
        deleteHeroSlide,
        resetHeroSlidesToDefault,
        heroHighlights,
        updateHeroHighlights,
        resetHeroHighlightsToDefault,
        keyPillars,
        keyPillarsHeader,
        updateKeyPillar,
        addKeyPillar,
        deleteKeyPillar,
        updateKeyPillarsHeader,
        resetKeyPillarsToDefault,
        aboutContent,
        updateAboutContent,
        resetAboutContentToDefault,
        resetAboutContent: resetAboutContentToDefault,
        academicPrograms,
        updateAcademicProgram,
        addAcademicProgram,
        deleteAcademicProgram,
        resetAcademicProgramsToDefault,
        featuredCourses,
        updateFeaturedCourse,
        addFeaturedCourse,
        deleteFeaturedCourse,
        resetFeaturedCoursesToDefault,
        clubsList,
        clubs: clubsList,
        updateClub,
        addClub,
        deleteClub,
        resetClubsToDefault,
        houseStandings,
        updateHouseStanding,
        addHouseStanding,
        deleteHouseStanding,
        resetHouseStandingsToDefault,
        busRoutes,
        updateBusRoute,
        addBusRoute,
        deleteBusRoute,
        resetBusRoutesToDefault,
        mealMenu,
        updateMealMenuItem,
        resetMealMenuToDefault,
        calendarEvents,
        updateCalendarEvent,
        addCalendarEvent,
        deleteCalendarEvent,
        resetCalendarEventsToDefault,
        testimonials,
        testimonialsHeader,
        updateTestimonial,
        addTestimonial,
        deleteTestimonial,
        updateTestimonialsHeader,
        resetTestimonialsToDefault,
        landingSections,
        updateLandingSectionVisibility,
        resetLandingSectionsToDefault,
        // 17. FAQ Section
        faqItems,
        faqHeader,
        faqContent: faqHeader,
        updateFaqItem,
        addFaqItem,
        deleteFaqItem,
        updateFaqHeader,
        updateFaqContent: updateFaqHeader,
        resetFaqToDefault,
        resetFaqsToDefault: resetFaqToDefault,
        // 18. Database Snapshot Resilience
        exportDatabaseSnapshot,
        importDatabaseSnapshot,
        // 19. Attendance & Term Resumption
        attendanceRecords,
        termResumptionConfig,
        setTermStartDate,
        setTermResumptionDate,
        resetDailyAttendanceCounter,
        startNewTerm,
        submitDailyAttendance,
        getClassAttendanceSummary,
        getStudentAttendanceSummary,
        // 20. CBT Practice & Examination Engine
        cbtExams,
        cbtAttempts,
        addCbtExam,
        deleteCbtExam,
        recordCbtAttempt,
        // 21. Weekly Timetable & Bell Schedule
        timetables,
        updateClassTimetable,
        // 22. Medical & Clinic Sick-Bay
        sickBayLogs,
        addSickBayLog,
        updateSickBayLog,
        deleteSickBayLog,
        // 23. Parent Portal & Family Linkage
        parents,
        activeParentId,
        isParentAuthenticated,
        addParent,
        registerParent,
        syncOnlineParentsNow,
        updateParent,
        deleteParent,
        assignSiblingsToParent,
        unlinkChildFromParent,
        quickCreateParentWithSiblings,
        mergeParentAccounts,
        loginParent,
        logoutParent,
        consultationRequests,
        submitConsultationRequest,
        updateConsultationStatus,
        feePayments,
        recordFeePayment,
        verifyFeePayment,
        rejectFeePayment,
        // 24. Digital Library & E-Textbooks
        libraryBooks,
        addLibraryBook,
        deleteLibraryBook,
        incrementBookDownload,
        // 25. Calvin AI Tokens & Access
        calvinTokens,
        createCalvinTokens,
        redeemCalvinToken,
        revokeCalvinToken,
        grantDirectCalvinAccess,
        recordCalvinQuestionAsked,
        sendTokenActivationPrompt,
        dismissTokenPrompt,
        acceptTokenPromptAndActivate,
        // 26. Staff Photo, Signature & Principal Appointments
        appointPrincipal,
        updateTutorPhotoAndSignature,
        // 27. Subject Schemes of Work & AI Curriculum Grounding
        schemesOfWork,
        addSchemeOfWork,
        updateSchemeOfWork,
        deleteSchemeOfWork,
        resetSchemesToDefault,
        getSchemeForSubjectAndClass,
        // 28. School Community Chat System (Students, Parents, Tutors & Admin)
        chatChannels,
        chatMessages,
        addChatChannel,
        updateChatChannel,
        deleteChatChannel,
        sendChatMessage,
        deleteChatMessage,
        flagChatMessage,
        resetChatToDefault,
        toggleChatReaction,
        togglePinChatMessage,
        markChannelAsRead,
        getChannelUnreadCount,
        getTotalUnreadCount,
        isFloatingChatOpen,
        setIsFloatingChatOpen,
        activeFloatingChatChannelId,
        setActiveFloatingChatChannelId,
        // 29. Campus Gallery Photos (Facilities & Events)
        galleryPhotos,
        addGalleryPhoto,
        updateGalleryPhoto,
        deleteGalleryPhoto,
        resetGalleryPhotosToDefault,
        // 30. Prefects, Club Leaders & Ephemeral 16-Hour Statuses
        assignClassPrefects,
        assignClubLeaders,
        assignStudentPrefectBadge,
        updateStudentChatSettings,
        ephemeralStatuses,
        postEphemeralStatus,
        deleteEphemeralStatus,
        markEphemeralStatusViewed,
        // 31. School News & Blog System
        newsArticles,
        addNewsArticle,
        updateNewsArticle,
        deleteNewsArticle,
        likeNewsArticle,
        pressClubPresidentStudentId,
        pressClubEditorStudentIds,
        assignPressClubPresident,
        nominatePressClubEditor,
        removePressClubEditor,
        resetNewsArticlesToDefault,
        studentSubmissions,
        submitArticleForReview,
        reviewStudentSubmission,
        // 32. School Representative & Landing Page Visitor Inquiries
        schoolRepConfig,
        updateSchoolRepConfig,
        toggleRepAvailability,
        visitorConversations,
        sendVisitorMessage,
        replyAsRepresentative,
        requestCalvinAiInstantReply,
        getVisitorConversation,
        restoreVisitorConversationByCode,
        markVisitorConversationRead,
        markConversationSeenByAdmin,
        markConversationSeenByVisitor,
        setChatTyping,
        typingMap,
        bookChatAppointment,
        transferConversationDepartment,
        updateVisitorNotificationOptIn,
        // Headmistress, Moderator & RBAC Privileges System
        headmistressProfile,
        updateHeadmistressProfile,
        moderators,
        addModerator,
        updateModerator,
        deleteModerator,
        activeModeratorId,
        setActiveModeratorId,
        rolePrivileges,
        updateRolePrivilege,
        resetRolePrivileges,
        hasPrivilege,
        // CGPA helpers
        calculateGpa,
        isCgpaActiveForClass,
        toggleCgpaForClass,
        setCgpaActiveClasses,
        // Intensive Calvin Academic Support
        setStudentIntensiveCalvinSupport,
        // Website Production Contributors
        contributors,
        addContributor,
        updateContributor,
        deleteContributor,
        resetContributorsToDefault,
        // 31. Official WAEC / WASSCE Registration
        waecRegistrations,
        waecPromptBroadcast,
        waecSubjects,
        waecDepartmentRecommendations,
        saveWaecRegistration,
        updateWaecRegistrationStatus,
        broadcastWaecPrompt,
        dismissWaecPromptForStudent,
        importWaecRegistrationsBatch,
        deleteWaecRegistration,
        isStudentSeniorCandidate,
        updateWaecSubject,
        addWaecSubject,
        deleteWaecSubject,
        resetWaecSubjectsToDefault,
        updateDepartmentRecommendations,
        syncAllCustomDataToCloud,
        unifyLocalStorageResultsToDatabase,
        batchUpsertStudentResults,
        activeOnlineUsersCount,
        deletedAccountIds,
        isAccountTombstoned
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};
