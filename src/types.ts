export type PageSection = 
  | 'home'
  | 'about'
  | 'programs'
  | 'student-life'
  | 'faculty'
  | 'calendar'
  | 'news-blog'
  | 'notices'
  | 'achievements'
  | 'house-championship'
  | 'contact'
  | 'gallery'
  | 'proprietress'
  | 'portal-login'
  | 'admin-portal'
  | 'proprietress-portal'
  | 'headmistress-portal'
  | 'moderator-portal'
  | 'tutor-portal'
  | 'student-portal'
  | 'parent-portal'
  | 'contributors';

export type UserRole = 
  | 'admin' 
  | 'proprietress' 
  | 'headmistress' 
  | 'moderator' 
  | 'tutor' 
  | 'student' 
  | 'parent';

export type PrivilegeKey =
  | 'manage_students'
  | 'manage_faculty'
  | 'academic_curriculum'
  | 'terminal_results'
  | 'exam_cbt_studio'
  | 'community_chat_moderation'
  | 'visitor_inquiries'
  | 'school_calendar'
  | 'broadcasts_notices'
  | 'financial_records'
  | 'credentials_vault'
  | 'campus_gallery'
  | 'prefect_badges'
  | 'manage_admissions'
  | 'manage_tutors'
  | 'manage_classes_subjects'
  | 'enter_edit_grades'
  | 'collate_publish_results'
  | 'manage_attendance'
  | 'manage_cbt_exams'
  | 'manage_lesson_notes'
  | 'manage_digital_library'
  | 'manage_timetables'
  | 'manage_Broadcasts_notices'
  | 'manage_community_chat'
  | 'manage_ephemeral_statuses'
  | 'manage_press_news_blog'
  | 'manage_visitor_inquiries'
  | 'manage_fee_verifications'
  | 'manage_sickbay_logs'
  | 'manage_landing_cms'
  | 'manage_alumni_Approvals'
  | 'manage_calvin_ai_tokens';

export interface PrivilegeDefinition {
  key: PrivilegeKey;
  label: string;
  category: 'Academics & Faculty' | 'Communications & Chat' | 'Operations & Administration' | 'Security & Finance';
  description: string;
}

export type RolePrivilegesMap = Partial<Record<PrivilegeKey, boolean>> & Record<string, boolean>;

export interface RolePrivilegeSettings {
  headmistress: RolePrivilegesMap;
  moderator: RolePrivilegesMap;
  tutor: RolePrivilegesMap;
  student: RolePrivilegesMap;
  parent: RolePrivilegesMap;
}

export interface HeadmistressProfile {
  id?: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  qualification: string;
  welcomeMessage: string;
  signature?: string;
  photoUrl?: string;
}

export interface ModeratorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  title?: string;
  roleTitle: string;
  assignedSections: string[];
  status: 'Active' | 'Suspended';
  isActive?: boolean;
}

export type GalleryCategory = 'all' | 'facilities' | 'events' | 'sports' | 'academics' | 'arts';

export interface GalleryPhoto {
  id: string;
  title: string;
  category: 'facilities' | 'events' | 'sports' | 'academics' | 'arts';
  imageUrl: string;
  caption: string;
  date?: string;
  location?: string;
  featured?: boolean;
  uploadedBy?: string;
  uploadedAt?: string;
}

export interface AppImages {
  crest: string;
  hero: string;
  founders: string;
  earlyYears: string;
  artClass: string;
  faculty: string;
  sports: string;
  soccer: string;
  cultural: string;
  [key: string]: string;
}

export interface Notice {
  id: string;
  title: string;
  date: string;
  category: string;
  content: string;
  description?: string;
  isImportant?: boolean;
  audience?: 'All' | 'Parents' | 'Scholars' | 'Faculty';
}

export interface AdmissionForm {
  childName?: string;
  dateOfBirth?: string;
  gender?: string;
  intendedClass?: string;
  parentName: string;
  parentPhone?: string;
  parentEmail?: string;
  residentialAddress: string;
  previousSchool?: string;
  healthConditions?: string;
  gradeLevel?: string;
  notes?: string;
  email?: string;
  phone?: string;
  studentName?: string;
  studentDob?: string;
}

export interface AdmissionApplication extends AdmissionForm {
  id: string;
  refNumber: string;
  dateSubmitted: string;
  status: 'Pending Review' | 'Screening Scheduled' | 'Offered Admission' | 'Enrolled' | 'Declined' | 'Admitted' | string;
  screeningDate?: string;
  screeningTime?: string;
  screeningVenue?: string;
  examSubjects?: string[];
  examRequirements?: string;
  score?: number;
  assignedSeatNumber?: string;
  examScore?: number;
  examRemark?: string;
  phone?: string;
  studentName?: string;
  gradeLevel?: string;
  email?: string;
}

export interface EntranceExamSettings {
  examTitle?: string;
  examDate: string;
  examTime: string;
  venue: string;
  subjects: string[];
  requirements: string[];
  fee?: string;
  coordinatorPhone?: string;
  duration?: string;
  passMark?: number;
  coordinatorName?: string;
  instructions?: string;
}

export interface Homework {
  id: string;
  title: string;
  subject: string;
  targetClass?: string;
  targetClassId?: string;
  dueDate: string;
  description?: string;
  instructions?: string;
  status: 'Pending' | 'Completed' | 'Submitted' | 'Graded' | string;
  submissions?: Record<string, 'Pending' | 'Submitted' | 'Graded' | 'Completed'>;
  grade?: string;
  assignedBy?: string;
  attachmentUrl?: string;
}

export interface GradeRecord {
  id?: string;
  studentId?: string;
  subject: string;
  ca1: number;
  ca2: number;
  ca3?: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
  color?: string;
  term1Total?: number;
  term2Total?: number;
  term3Total?: number;
  cumulativeTotal?: number;
  annualAverage?: number;
}

export interface ContactInquiry {
  id: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
  date: string;
  status: 'New' | 'In Progress' | 'Resolved';
}

export interface HistoricalTermRecord {
  term: '1st Term' | '2nd Term' | '3rd Term';
  termFullName: string;
  termAverage: number;
  attendanceDays: number;
  totalSchoolDays: number;
  classEnrolled: string;
  teacherRemark: string;
  principalRemark: string;
  grades: GradeRecord[];
}

export interface HistoricalSessionRecord {
  id: string;
  sessionName: string;
  classEnrolled: string;
  annualAverage: number;
  promotionStatus: 'Promoted' | 'Repeat';
  promotedToGrade: string;
  terms: {
    [key in '1st Term' | '2nd Term' | '3rd Term']?: HistoricalTermRecord;
  };
}

export interface CustomResultSubject {
  subject: string;
  score?: string;
  grade?: string;
  remark?: string;
}

export interface CustomResult {
  id: string;
  studentId?: string;
  studentRegNumber?: string;
  studentName?: string;
  title: string;
  examType?: string;
  session: string;
  term?: string;
  examDiet?: string;
  candidateNumber?: string;
  examinationBody?: string;
  centerName?: string;
  overallScore?: string;
  aggregate?: string;
  targetClass?: string;
  placementStatus?: string;
  isOfficialExternal?: boolean;
  remarks?: string;
  fileAttachment?: string | null;
  fileName?: string;
  subjectBreakdown?: CustomResultSubject[];
  uploadedAt?: string;
  uploadedBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  score?: number;
  grade?: string;
  remark?: string;
  date?: string;
  subject?: string;
}

export interface StudentProfile {
  id: string;
  regNumber: string;
  name: string;
  grade: string;
  classId?: string;
  house?: string;
  clubs?: string[];
  gender: 'Male' | 'Female';
  dateOfBirth?: string;
  address?: string;
  passportPhoto?: string;
  term?: string;
  parentName: string;
  parentPhone: string;
  emergencyPhone?: string;
  parentEmail?: string;
  email?: string;
  password?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  isAlumni?: boolean;
  alumniApprovalStatus?: 'pending' | 'approved' | 'rejected';
  graduationYear?: string;
  isUpgradedTutor?: boolean;
  transitionedToTutorId?: string;
  graduationSession?: string;
  attendancePercent: number;
  attendanceDays?: number;
  totalSchoolDays?: number;
  termAverage: number;
  term1Average?: number;
  term2Average?: number;
  term3Average?: number;
  cumulativeAnnualAverage?: number;
  promotionStatus?: 'Promoted' | 'Repeat' | 'Pending';
  promotedToGrade?: string;
  promotionTargetClass?: string;
  academicHistory?: HistoricalSessionRecord[];
  bloodGroup?: string;
  genotype?: string;
  allergies?: string;
  medicalConditions?: string;
  emergencyContactName?: string;
  feeBalance?: number;
  feePaid?: number;
  feeTotal?: number;
  feeStatus?: 'Fully Paid' | 'Partially Paid' | 'Outstanding';
  attendancePercentage?: number;
  overallPosition?: string;
  cumulativeAverage?: number;
  passportUrl?: string;
  teacherRemark?: string;
  principalRemark?: string;
  grades?: GradeRecord[];
  calvinAiAccess?: {
    active: boolean;
    tier: 'regular' | 'premium';
    tokenId?: string;
    tokenCode: string;
    activatedAt: string;
    expiresAt: string;
    durationHours: number;
    questionsCount?: number;
    intensiveSupport?: boolean;
    interventionNotes?: string;
    interventionSubjects?: string[];
    interventionLevel?: string;
    flaggedAt?: string;
  };
  _dispatchScore?: number;
  tokenPrompt?: {
    id: string;
    tokenCode?: string;
    tier?: 'regular' | 'premium';
    durationLabel?: string;
    message: string;
    senderName: string;
    sentAt: string;
    status: 'pending' | 'viewed' | 'activated';
  };
  prefectRole?: string;
  prefectBadge?: string;
  classLeadershipRole?: 'prefect' | 'assistant_prefect' | null;
  clubLeadershipRoles?: Record<string, 'president' | 'vice_president' | 'secretary' | 'member'>;
  chatSettings?: {
    showOnlineStatus?: boolean;
    allowDirectMessages?: boolean;
    dmPermission?: 'classmates_only' | 'anyone';
  };
  customResults?: CustomResult[];
  alumniRegistrationId?: string;
  waecRegistration?: WaecRegistration;
  waecPromptDismissed?: boolean;
  intensiveCalvinSupport?: any;
  lastCollatedResult?: {
    session: string;
    term: string;
    reportKind: 'mid' | 'end';
    dispatchedAt: string;
    dispatchedBy?: string;
    broadcastMessage?: string;
    termAverage: number;
    annualAverage?: number;
    overallPosition?: string;
    totalStudentsInClass?: number;
    cgpa?: string;
    cgpaScale?: number;
    classification?: string;
    grades: GradeRecord[];
    teacherRemark?: string;
    principalRemark?: string;
    promotionStatus?: 'Promoted' | 'Repeat' | 'Pending';
    promotedToGrade?: string;
  };
}

export type PrincipalRole = 'none' | 'principal_admin' | 'principal_administrator' | 'principal_academics';

export type PrincipalPrivilege = 
  | 'approve_lesson_notes'
  | 'manage_timetables'
  | 'audit_grades'
  | 'view_all_students'
  | 'sign_report_cards'
  | 'manage_attendance'
  | 'school_announcements'
  | 'calvin_tokens_manage'
  | 'manage_admissions'
  | 'manage_assessments'
  | 'manage_curriculum'
  | 'manage_staff_leave'
  | 'manage_finances'
  | 'manage_discipline'
  | 'manage_broadcasts';

export interface CalvinToken {
  id: string;
  code: string;
  tier: 'regular' | 'premium';
  durationHours: number;
  durationLabel: string;
  createdAt: string;
  createdBy: string;
  status: 'unused' | 'active' | 'expired' | 'used';
  redeemedByStudentId?: string;
  redeemedByStudentName?: string;
  redeemedAt?: string;
  expiresAt?: string;
  priceNgn?: number;
  usedByStudentName?: string;
  activatedAt?: string;
}

export interface StudentRegistrationData {
  name: string;
  regNumber?: string;
  grade: string;
  classId?: string;
  gender?: 'Male' | 'Female';
  house?: string;
  parentName?: string;
  parentPhone?: string;
  emergencyPhone?: string;
  parentEmail?: string;
  email?: string;
  password?: string;
  passportPhoto?: string;
  securityQuestion?: string;
  securityAnswer?: string;
}

export interface TutorProfile {
  id: string;
  staffId?: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  department: string;
  qualification: string;
  phone?: string;
  bio?: string;
  assignedClasses: string[];
  assignedSubjects: string[];
  isUpgraded?: boolean;
  profileCompleted?: boolean;
  avatarUrl?: string;
  photoUrl?: string;
  signatureUrl?: string;
  principalRole?: PrincipalRole;
  principalPrivileges?: PrincipalPrivilege[];
  appointedDate?: string;
  appointedBy?: string;
  studentOriginId?: string;
  studentRegNumber?: string;
  retainedAcademicResults?: {
    grades?: GradeRecord[];
    academicHistory?: HistoricalSessionRecord[];
    customResults?: CustomResult[];
    termAverage?: number;
    cumulativeAnnualAverage?: number;
    promotedToGrade?: string;
    teacherRemark?: string;
    principalRemark?: string;
  };
}

export interface FacultyMember {
  id: string;
  name: string;
  role: string;
  qualification: string;
  department: string;
  image?: string;
  imageUrl?: string;
  imageKey?: string;
  email?: string;
  phone?: string;
  bio?: string;
  displayOrder?: number;
}

export interface SchoolInfo {
  name: string;
  motto: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  whatsapp: string;
  whatsappNumber?: string;
  shortName?: string;
  logoUrl?: string;
  crestUrl?: string;
  activeSession: string;
  activeTerm: string;
  resumptionDate?: string;
  vacationDate?: string;
  stats?: Array<{ label: string; value: string }>;
  vision?: string;
  mission?: string;
  location?: string;
  admissionsPhone?: string;
  headmistressSignature?: string;
  headmistressName?: string;
  headmistressTitle?: string;
  principalSignature?: string;
  principalName?: string;
  principalTitle?: string;
  academicsSignature?: string;
  academicsName?: string;
  academicsTitle?: string;
  termStartDate?: string;
  bursarName?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  category: 'Early Years' | 'Primary' | 'Junior Secondary' | 'Senior Secondary';
  tuitionPerTerm: number;
  description?: string;
  isActive?: boolean;
  classTeacherId?: string;
  prefectStudentId?: string;
  assistantPrefectStudentId?: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  category?: string;
  department?: string;
  applicableCategories?: string[];
  applicableLevels?: string[];
  description?: string;
  schemeOfWorkId?: string;
  isCore?: boolean;
}

export interface SchemeOfWorkWeeklyTopic {
  week: number;
  topic: string;
  subtopics?: string[];
  learningObjectives?: string[];
  keyFormulasOrTerms?: string[];
  suggestedActivities?: string;
  recommendedTextbook?: string;
}

export interface SchemeOfWork {
  id: string;
  subjectId?: string;
  subjectName: string;
  classLevel: string; // e.g. "SSS 2", "JSS 1", "Primary 5", "All Levels"
  term: '1st Term' | '2nd Term' | '3rd Term' | 'All Terms';
  session?: string;
  curriculumStandard?: string; // e.g. "NERDC / WAEC / Cambridge"
  summary?: string;
  weeklyTopics: SchemeOfWorkWeeklyTopic[];
  uploadedFileName?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  rawText?: string;
  additionalInstructions?: string;
  isAiLearned: boolean;
  lastUpdated: string;
  applicableClasses?: string[];
  isGeneralScheme?: boolean;
}

export interface GradeRule {
  id: string;
  grade: string;
  minScore: number;
  maxScore: number;
  remark: string;
  color: string;
  gradePoint?: number;
}

export interface ParentBroadcastLog {
  id: string;
  title: string;
  channel: 'SMS' | 'WhatsApp' | 'Portal' | 'All';
  targetGroup: string;
  message: string;
  dateSent: string;
  recipientCount: number;
}

export interface ProprietressProfile {
  name: string;
  title: string;
  quote: string;
  welcomeMessage: string;
  photoUrl: string;
  email: string;
  phone: string;
  officeHours: string;
  termTheme?: string;
  termAddress?: string;
  directEmail?: string;
  executivePhone?: string;
  honorifics?: string;
  qualifications?: string;
  portraitUrl?: string;
  establishedYear?: string | number;
  tagline?: string;
  signatureName?: string;
  visionStatement?: string;
  missionStatement?: string;
  philosophy?: string;
  educationalBackground?: string[] | string;
  achievements?: string[] | string;
}

export interface ProprietressAppointment {
  id: string;
  refNumber: string;
  parentName: string;
  guestName?: string;
  phone: string;
  email: string;
  scholarName?: string;
  scholarGrade?: string;
  purpose: string;
  preferredDate: string;
  preferredTime?: string;
  requestedDate?: string;
  requestedTime?: string;
  preferredTimeSlot?: string;
  meetingType?: string;
  notes?: string;
  roleOrAffiliation?: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Rescheduled' | 'Declined' | 'Approved' | 'Pending Review';
  submittedAt: string;
  executiveResponse?: string;
}

export interface ProprietressMessage {
  id: string;
  refNumber: string;
  senderName: string;
  senderRole: 'Parent' | 'Teacher' | 'Alumni' | 'Visitor' | 'Parent / Guardian' | 'Current Student' | 'Faculty / Staff Member' | 'Well-Wisher / Prospective Parent' | string;
  email: string;
  senderEmail?: string;
  phone: string;
  subject: string;
  content: string;
  message?: string;
  category?: string;
  date: string;
  status: 'Unread' | 'Read' | 'Resolved' | 'New';
  note?: string;
  isConfidential?: boolean;
}

export interface ProprietressDirective {
  id: string;
  title: string;
  targetAudience: 'All' | 'Faculty' | 'Parents' | 'Students' | 'All Staff' | string;
  date: string;
  dateIssued?: string;
  priority: 'High' | 'Medium' | 'Normal' | 'Mandatory Compliance' | 'Urgent' | string;
  content: string;
  summary?: string;
  refCode?: string;
  status?: string;
  category?: string;
  isPinned?: boolean;
  signedBy?: string;
}

export type AssessmentEntryPhase = 'mid_term_ca' | 'terminal_exam' | 'closed';

export interface AssessmentControlConfig {
  activeSession: string;
  activeTerm: '1st Term' | '2nd Term' | '3rd Term';
  activePhase: AssessmentEntryPhase;
  midTermResultsPublished?: boolean;
  midTermPublishedAt?: string;
  endTermResultsPublished?: boolean;
  endTermPublishedAt?: string;
  resultsDispatchedToDashboard?: boolean;
  dispatchedReportKind?: 'mid' | 'end';
  resultsDispatchedAt?: string;
  resultsDispatchedBy?: string;
  resultsDispatchedSession?: string;
  resultsDispatchedTerm?: string;
  resultsDispatchMessage?: string;
  cgpaEnabled?: boolean;
  cgpaScale?: 5.0 | 4.0;
  cgpaActiveClasses?: string[];
  ca1Max: number;
  ca2Max: number;
  ca3Max: number;
  examMax: number;
  promotionPassMarkPercent: number;
  autoRankingEnabled: boolean;
  lastPromotionDate?: string;
  promotionHistory?: Array<{
    id: string;
    fromSession: string;
    toSession: string;
    date: string;
    totalEvaluated: number;
    promotedCount: number;
    repeatedCount: number;
    passPercentageUsed: number;
  }>;
}

export interface UserCredentialItem {
  id: string;
  cloudIdentifier?: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  primaryIdentifier: string;
  email: string;
  password: string;
  status: string;
  departmentOrGrade: string;
  lastUpdated: string;
  securityQuestion?: string;
  securityAnswer?: string;
  passportPhoto?: string;
}

export type NoteFormat = 'text' | 'pdf' | 'docx' | 'image';

export interface LessonNoteAttachment {
  name: string;
  fileSize: string;
  fileType: string;
  dataUrl?: string;
  textContent?: string;
}

export interface LessonNote {
  id: string;
  title: string;
  subject: string;
  targetClass: string;
  term: string;
  session: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  format: NoteFormat;
  content: string;
  datePublished: string;
  downloadsCount: number;
  attachment?: LessonNoteAttachment;
}

export interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaAction: string;
  badge: string;
  imageUrl: string;
}

export interface KeyPillarItem {
  id: string;
  title: string;
  description: string;
  desc?: string;
  accent?: string;
  iconName: string;
}

export interface KeyPillarsHeader {
  badge: string;
  title: string;
  subtitle: string;
}

export interface AboutSectionContent {
  badge: string;
  title: string;
  description: string;
  founderName: string;
  founderRole: string;
  establishedYear: string;
  vision: string;
  mission: string;
  quote?: string;
  founderPhotoUrl?: string;
}

export interface FeaturedCourse {
  id: string;
  title: string;
  level: string;
  description: string;
  highlights: string[];
  imageKey?: string;
  grade?: string;
  highlight?: string;
  tutor?: string;
  students?: string | number;
  duration?: string;
}

export interface TestimonialsSectionContent {
  badge: string;
  title: string;
  subtitle: string;
  satisfactionTitle?: string;
  satisfactionRate?: string;
  satisfactionNote?: string;
  associationBadge?: string;
}

export interface AcademicProgram {
  id: string;
  title: string;
  ageRange: string;
  gradeLevels: string;
  description: string;
  features: string[];
  color: string;
  iconName?: string;
  imageKey?: string;
  imageUrl?: string;
  ageGroup?: string;
  category?: string;
  studentCount?: string | number;
  subjects?: string[] | string;
}

export interface Testimonial {
  id: string;
  name: string;
  relationship: string;
  comment: string;
  studentName?: string;
  studentGrade?: string;
  rating: number;
  avatar?: string;
  imageKey?: string;
  imageUrl?: string;
  relation?: string;
  location?: string;
}

export interface BusRoute {
  id: string;
  routeName: string;
  coverageAreas: string[];
  driverName: string;
  contactNumber: string;
  morningDeparture: string;
  afternoonDeparture: string;
  busNumber: string;
}

export interface MealMenuItem {
  day: string;
  breakfast: string;
  lunch: string;
  snack: string;
  allergens?: string;
}

export interface Club {
  id: string;
  name: string;
  category: string;
  meetingDay: string;
  patron: string;
  description: string;
  presidentStudentId?: string;
  vicePresidentStudentId?: string;
  memberStudentIds?: string[];
}

export interface HouseStanding {
  name: string;
  color: string;
  points: number;
  motto: string;
  houseMaster: string;
}

export interface AcademicCalendarEvent {
  id: string;
  title: string;
  date: string;
  category: 'Resumption' | 'Exam' | 'Holiday' | 'Sports' | 'Meeting' | 'Celebration' | string;
  description: string;
  term?: string;
  type?: string;
  dateRange?: string;
  notes?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order?: number;
}

export interface FAQSectionContent {
  badge: string;
  title: string;
  subtitle: string;
}

// Attendance Types
export type AttendanceStatus = 'Present' | 'Late' | 'Absent';

export interface AttendanceStudentEntry {
  studentId: string;
  studentName: string;
  regNumber: string;
  status: AttendanceStatus;
}

export interface AttendanceDailyRecord {
  id: string;
  classId: string;
  className: string;
  date: string; // YYYY-MM-DD
  dayNumber: number; // Day 1, Day 2, etc. of the active term
  term: string; // e.g. '1st Term', '2nd Term', '3rd Term'
  session: string; // e.g. '2025/2026 Academic Session'
  submittedByTutorId: string;
  submittedByTutorName: string;
  submittedAt: string; // ISO string or human string
  studentsAttendance: AttendanceStudentEntry[];
}

export interface StudentAttendanceSummary {
  studentId: string;
  studentName: string;
  regNumber: string;
  daysPresent: number;
  daysLate: number;
  daysAbsent: number;
  totalMarkedDays: number;
  attendancePercent: number;
}

export interface TermResumptionConfig {
  termStartDate: string; // YYYY-MM-DD
  termEndDate?: string; // YYYY-MM-DD
  termName: string; // e.g. '1st Term', '2nd Term', '3rd Term'
  session: string; // e.g. '2025/2026 Academic Session'
  isTermActive: boolean;
  totalSchoolDaysPlanned?: number;
  isMidwayLaunch?: boolean;
  midwayElapsedDays?: number;
  midwayStartWeek?: number;
}

export interface ClassAttendanceSummary {
  classId: string;
  className: string;
  totalDaysMarked: number;
  studentSummaries: StudentAttendanceSummary[];
  classAverageAttendancePercent: number;
}

// 1. CBT Practice & Examination Types
export interface CbtQuestion {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  subject: string;
  topic?: string;
}

export interface CbtExam {
  id: string;
  title: string;
  subject: string;
  examType: 'WAEC' | 'NECO' | 'JAMB_UTME' | 'BECE' | 'TERM_MOCK';
  targetClass: string;
  targetClassId?: string;
  durationMinutes: number;
  questions: CbtQuestion[];
  instructions: string;
  passPercentage: number;
}

export interface CbtAttempt {
  id: string;
  examId: string;
  examTitle: string;
  subject: string;
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  dateAttempted: string;
  answers: Record<string, number>; // questionId -> chosenIndex
}

// 2. Weekly Timetable & Bell Schedule Types
export interface TimetablePeriod {
  id: string;
  periodNumber: number; // 1 to 8
  startTime: string; // e.g. "08:00 AM"
  endTime: string; // e.g. "08:45 AM"
  subject: string;
  tutorName: string;
  teacher?: string;
  tutorId?: string;
  room?: string;
  isBreak?: boolean;
}

export interface ClassDailyTimetable {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  periods: TimetablePeriod[];
}

export interface ClassWeeklyTimetable {
  classId: string;
  className: string;
  schedule: ClassDailyTimetable[];
}

// 3. Medical Records & Sick-Bay Logs
export interface SickBayVisitLog {
  id: string;
  studentId: string;
  studentName: string;
  regNumber: string;
  grade: string;
  visitDate: string; // YYYY-MM-DD
  timeIn: string; // e.g. "10:15 AM"
  timeOut?: string;
  symptoms: string;
  diagnosis?: string;
  treatmentAdministered: string;
  temperatureCelsius?: number;
  nurseNotes?: string;
  parentNotified: boolean;
  admittedToBed: boolean;
  status: 'In Treatment' | 'Discharged to Class' | 'Sent Home with Parent';
}

// 4. Parent Portal, Consultations & Fee Clearance
export interface ParentProfile {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  password?: string;
  address?: string;
  childrenIds: string[]; // IDs of linked students
  wardIds?: string[];
  wardNames?: string[];
  relationship?: string;
  occupation?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  savedOnline?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ParentRegistrationData {
  fullName: string;
  phone: string;
  email?: string;
  password?: string;
  relationship?: string;
  address?: string;
  occupation?: string;
  studentIds?: string[];
  wardIds?: string[];
  wardNames?: string[];
  securityQuestion?: string;
  securityAnswer?: string;
}


export interface ParentConsultationRequest {
  id: string;
  parentId: string;
  parentName: string;
  parentPhone: string;
  studentId: string;
  studentName: string;
  targetRole: 'Class Teacher' | 'Guidance Counselor' | 'Principal' | 'School Nurse';
  recipientName?: string;
  preferredDate: string;
  preferredTime: string;
  topic: string;
  message: string;
  status: 'Pending' | 'Approved' | 'Completed' | 'Declined';
  adminResponse?: string;
  createdAt: string;
}

export interface FeePaymentRecord {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  regNumber: string;
  grade: string;
  amount: number;
  term: string;
  session: string;
  paymentMethod: 'Bank Transfer' | 'POS' | 'Direct Deposit' | 'Online WebPay';
  reference: string;
  paymentDate: string;
  status: 'Verified' | 'Pending Verification' | 'Rejected';
  verifiedBy?: string;
  rejectedBy?: string;
}

export type FeePayment = FeePaymentRecord;

// 5. Digital Library & E-Textbook Repository
export interface LibraryBookItem {
  id: string;
  title: string;
  author: string;
  category: 'WAEC Past Papers' | 'NECO Past Papers' | 'JAMB Past Papers' | 'E-Textbook' | 'Literature in English' | 'STEM Lab Manual' | string;
  subject: string;
  targetClass: string;
  fileSize: string;
  fileType: 'PDF' | 'EPUB' | 'ZIP';
  downloadUrl?: string;
  fileUrl?: string;
  coverColor?: string;
  summary: string;
  description?: string;
  edition?: string;
  downloadsCount: number;
  year?: string;
}

// 6. Community Chat System (Students, Authorized Parents, Tutors & Admin)
export type ChatChannelType = 'class' | 'club' | 'direct' | 'announcement';

export interface ChatChannel {
  id: string;
  name: string;
  type: ChatChannelType;
  description?: string;
  classId?: string;
  className?: string;
  clubId?: string;
  clubName?: string;
  directParticipantIds?: string[]; // user ids (student, parent, tutor, admin)
  directParticipantNames?: string[];
  createdAt: string;
  createdBy: string;
  isReadOnly?: boolean; // admin can lock
  isArchived?: boolean;
}

export interface SchoolChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar?: string;
  senderSubtext?: string; // e.g. "SSS 2 Scholar", "JETS Patron", "Parent of Tiwa", "School Admin"
  senderBadge?: string; // e.g. "⭐ Class Prefect", "👑 President", "🏅 Head Girl"
  content: string;
  timestamp: string;
  attachments?: Array<{
    name: string;
    url: string;
    type?: string;
    size?: string;
  }>;
  flaggedByAdmin?: boolean;
  deletedByAdmin?: boolean;
  isPinned?: boolean;
  pinnedBy?: string;
  pinnedAt?: string;
  reactions?: { [emoji: string]: string[] }; // emoji -> array of user names who reacted
  audioVoiceNote?: {
    url: string;
    durationSeconds: number;
  };
  imageAttachment?: {
    url: string;
    caption?: string;
  };
}

export interface StatusViewerRecord {
  userId: string;
  userName: string;
  userRole: string;
  viewedAt: string;
}

export interface UserEphemeralStatus {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userAvatar?: string;
  userGradeOrTitle?: string;
  userBadge?: string;
  text: string;
  mediaUrl?: string;
  backgroundColor?: string;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string (16 hours after createdAt)
  views?: string[]; // IDs of users who viewed this status
  viewRecords?: StatusViewerRecord[]; // Detailed viewers for the "Seen by" tray
}

// 7. School News & Blog System (Managed by Press Club President & Nominated Editors)
export type SchoolNewsCategory = 
  | 'All'
  | 'Campus News'
  | 'Academic Honors'
  | 'Sports Desk'
  | 'Arts & Culture'
  | 'STEM & Innovation'
  | 'Executive Bulletin';

export interface SchoolNewsAuthor {
  id: string;
  name: string;
  role: 'Press Club President' | 'Press Club Editor' | 'Staff Patron' | 'Principal Administrator';
  gradeOrTitle?: string;
  avatar?: string;
}

export interface SchoolNewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: 'Campus News' | 'Academic Honors' | 'Sports Desk' | 'Arts & Culture' | 'STEM & Innovation' | 'Executive Bulletin';
  coverImage: string;
  publishedAt: string; // ISO string or human date
  readTime: string; // e.g. "3 min read"
  author: SchoolNewsAuthor;
  tags: string[];
  isFeatured?: boolean;
  externalSource?: string;
  externalUrl?: string;
  likesCount?: number;
  viewsCount?: number;
}

export interface StudentArticleSubmission {
  id: string;
  studentId: string;
  studentName: string;
  studentGrade: string;
  title: string;
  category: 'Campus News' | 'Academic Honors' | 'Sports Desk' | 'Arts & Culture' | 'STEM & Innovation' | 'Executive Bulletin';
  content: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

// 8. Public Landing Page School Representative & Visitor Chat
export type SchoolRepRole = 'principal' | 'bursar' | 'representative' | 'admissions';

export interface SchoolRepConfig {
  activeRole: SchoolRepRole;
  repName: string;
  repTitle: string;
  repAvatar?: string;
  isAvailable: boolean; // true = online, false = offline (Calvin AI auto-answers)
  welcomeMessage: string;
  contactPhone?: string;
  contactEmail?: string;
  statusText?: string;
  officeHours?: string;
  updatedAt?: string;
  roleProfiles?: Partial<Record<SchoolRepRole, {
    name: string;
    title: string;
    welcomeMessage: string;
  }>>;
}

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'seen';

export interface ChatAppointment {
  id: string;
  type: 'Entrance Screening' | 'Campus Tour' | 'Principal Interview' | 'Bursary Consultation';
  date: string;
  timeSlot: string;
  candidateName: string;
  gradeApplying?: string;
  parentPhone: string;
  parentEmail?: string;
  notes?: string;
  status: 'confirmed' | 'rescheduled' | 'cancelled';
  createdAt: string;
}

export interface ChatTransferRecord {
  fromRole: SchoolRepRole | string;
  toRole: SchoolRepRole;
  transferredBy: string;
  targetRepName: string;
  targetRepTitle: string;
  reason?: string;
  timestamp: string;
}

export interface VisitorChatMessage {
  id: string;
  sender: 'visitor' | 'representative' | 'calvin_ai';
  senderName: string;
  senderTitle?: string;
  senderAvatar?: string;
  content: string;
  timestamp: string;
  isAiResponse?: boolean;
  status?: MessageDeliveryStatus;
  deliveredAt?: string;
  seenAt?: string;
  // Attachments & Voice Notes
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'document' | 'audio';
  audioDuration?: number; // seconds
  // Booking & Department Transfer metadata
  appointmentData?: ChatAppointment;
  isAppointmentNotice?: boolean;
  isTransferNotice?: boolean;
  transferData?: ChatTransferRecord;
}

export interface VisitorConversation {
  visitorId: string;
  queryCode?: string;
  visitorName: string;
  visitorPhone?: string;
  visitorEmail?: string;
  visitorCategory?: 'Prospective Parent' | 'Guest Scholar' | 'Alumni' | 'General Visitor';
  createdAt: string;
  lastMessageAt: string;
  status: 'open' | 'resolved' | 'waiting_rep';
  unreadByAdmin: boolean;
  unreadByVisitor?: boolean;
  lastSeenByAdminAt?: string;
  lastSeenByVisitorAt?: string;
  isRepTyping?: boolean;
  repTypingName?: string;
  isVisitorTyping?: boolean;
  assignedRole?: SchoolRepRole;
  assignedRepName?: string;
  assignedRepTitle?: string;
  transferHistory?: ChatTransferRecord[];
  appointments?: ChatAppointment[];
  notificationOptIn?: {
    whatsapp?: boolean;
    sms?: boolean;
    phone?: string;
    email?: string;
  };
  messages: VisitorChatMessage[];
}

export interface LandingPageSectionsConfig {
  hero?: boolean;
  keyPillars?: boolean;
  about?: boolean;
  programs?: boolean;
  enrichmentClubs?: boolean;
  studentLife?: boolean;
  gallery?: boolean;
  faculty?: boolean;
  calendar?: boolean;
  newsBlog?: boolean;
  notices?: boolean;
  testimonials?: boolean;
  achievements?: boolean;
  houseChampionship?: boolean;
  contributors?: boolean;
  contact?: boolean;
  faq?: boolean;
}

export type ReportSheetSignatureMode =
  | 'auto_by_level'
  | 'principal_admin'
  | 'principal_academics'
  | 'headmistress'
  | 'dual_principals'
  | 'proprietress'
  | 'custom';

export type ReportSheetSecondarySignature =
  | 'none'
  | 'official_seal'
  | 'principal_academics'
  | 'principal_admin'
  | 'headmistress'
  | 'proprietress'
  | 'class_teacher'
  | 'custom';

export interface OfficialSignatures {
  headmistressName?: string;
  headmistressTitle?: string;
  headmistressSignature?: string;
  principalAdminName?: string;
  principalAdminTitle?: string;
  principalAdminSignature?: string;
  principalAcademicsName?: string;
  principalAcademicsTitle?: string;
  principalAcademicsSignature?: string;
  proprietressName?: string;
  proprietressTitle?: string;
  proprietressSignature?: string;
  customSignatoryName?: string;
  customSignatoryTitle?: string;
  customSignatorySignature?: string;
  classTeacherDefaultName?: string;
  classTeacherDefaultTitle?: string;
  classTeacherDefaultSignature?: string;
  reportSheetSignatureMode?: ReportSheetSignatureMode;
  reportSheetSecondarySignature?: ReportSheetSecondarySignature;
  selectedStaffSignatoryTutorId?: string;
  showSignaturesOnPortalReport?: boolean;
  updatedAt?: string;
}

export interface AdminAccount {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  phone?: string;
  roleTitle: string;
  isSuperAdmin?: boolean;
  privileges: PrivilegeKey[];
  status: 'Active' | 'Suspended';
  avatar?: string;
  createdAt: string;
  createdBy?: string;
}

export interface AlumniRegistration {
  id: string;
  fullName: string;
  graduationYear: string;
  email: string;
  phone: string;
  formerRegNumber: string;
  formerClassOrSet: string;
  currentOccupation?: string;
  currentInstitution?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  assignedStudentId?: string;
}

export interface Contributor {
  id: string;
  name: string;
  role: string;
  category?: string;
  bio: string;
  avatarUrl?: string;
  badge?: string;
  highlight?: boolean;
  isActive?: boolean;
  order: number;
  links?: {
    github?: string;
    linkedin?: string;
    email?: string;
    website?: string;
  };
}

export type WaecDepartment = 'Science' | 'Arts' | 'Commercial';

export interface WaecRegistration {
  id: string;
  studentId: string;
  regNumber: string;
  candidateNumber?: string;
  surname: string;
  firstName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  stateOfOrigin: string;
  lga: string;
  religion: 'Christianity' | 'Islam' | 'Others';
  phone: string;
  nin: string;
  homeAddress: string;
  email: string;
  department: WaecDepartment;
  examType: 'WASSCE (May/June)' | 'GCE (Nov/Dec)' | 'Mock WAEC';
  targetClass: string;
  passportPhoto?: string;
  passportFilename?: string;
  subjects: string[];
  status: 'draft' | 'submitted' | 'verified' | 'queried';
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  adminRemarks?: string;
  updatedAt: string;
}

export interface WaecPromptBroadcast {
  title: string;
  message: string;
  deadline?: string;
  isActive: boolean;
  targetClasses: string[];
  sentAt: string;
  sentBy: string;
}

export interface WaecCatalogSubject {
  code: string;
  name: string;
  category: 'core' | 'science' | 'arts' | 'commercial' | 'trade';
  description: string;
}

export type AppTheme = 'crimson-gold' | 'sapphire-collegiate' | 'emerald-ivy';

export interface ThemeConfig {
  id: AppTheme;
  name: string;
  tagline: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgPreview: string;
  badge: string;
  category: string;
}
