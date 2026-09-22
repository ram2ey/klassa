import {
  boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, text,
  timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const staffRole = pgEnum("staff_role", ["school_admin", "office_staff", "teacher", "safeguarding_lead", "senco", "health_nurse"]);
export const enrollmentStatus = pgEnum("enrollment_status", ["pending", "active", "withdrawn", "graduated"]);
export const relationshipType = pgEnum("relationship_type", ["parent", "guardian", "foster_carer", "other"]);
export const importStatus = pgEnum("import_status", ["uploaded", "validating", "ready", "processing", "completed", "failed"]);
export const attendanceStatus = pgEnum("attendance_status", ["present", "absent", "late", "excused"]);
export const attendanceSessionStatus = pgEnum("attendance_session_status", ["in_progress", "submitted", "locked"]);
export const gradingSchemeType = pgEnum("grading_scheme_type", ["letter", "percentage", "standards_based"]);
export const assessmentStatus = pgEnum("assessment_status", ["draft", "published"]);
export const gradeStatus = pgEnum("grade_status", ["draft", "submitted", "published"]);
export const reportCardStatus = pgEnum("report_card_status", ["draft", "approved", "published", "archived"]);
export const announcementTarget = pgEnum("announcement_target", ["school", "grade", "class"]);
export const announcementPriority = pgEnum("announcement_priority", ["normal", "important", "emergency"]);
export const announcementStatus = pgEnum("announcement_status", ["draft", "scheduled", "pending_approval", "published", "archived"]);
export const deliveryChannel = pgEnum("delivery_channel", ["in_app", "sms", "both"]);
export const sensitiveCaseArea = pgEnum("sensitive_case_area", ["safeguarding", "health_medical", "special_needs", "disciplinary"]);
export const caseConfidentialityTier = pgEnum("case_confidentiality_tier", ["standard_sensitive", "confidential", "strictly_confidential"]);
export const sensitiveCaseStatus = pgEnum("sensitive_case_status", ["open", "under_review", "monitoring", "closed"]);
export const needToKnowSeverity = pgEnum("need_to_know_severity", ["routine", "urgent", "critical"]);
export const courtOrderType = pgEnum("court_order_type", ["restraining_order", "custody_restriction", "prohibited_contact", "non_disclosure"]);
export const gdprRequestType = pgEnum("gdpr_request_type", ["export", "rectify", "anonymize", "restrict"]);
export const gdprRequestStatus = pgEnum("gdpr_request_status", ["pending", "in_review", "completed", "rejected"]);
export const drillStatus = pgEnum("drill_status", ["passed", "failed", "partial"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull(),
  timezone: varchar("timezone", { length: 80 }).default("Atlantic/Reykjavik").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("organizations_slug_unique").on(table.slug)]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  phoneNumber: varchar("phone_number", { length: 16 }),
  phoneNumberVerified: boolean("phone_number_verified").default(false).notNull(),
  isPlatformAdmin: boolean("is_platform_admin").default(false).notNull(),
  mustChangePassword: boolean("must_change_password").default(false).notNull(),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "restrict" }),
  role: staffRole("role"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email), uniqueIndex("users_phone_unique").on(table.phoneNumber), index("users_organization_idx").on(table.organizationId)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  activeOrganizationId: uuid("active_organization_id").references(() => organizations.id, { onDelete: "set null" }),
}, (table) => [uniqueIndex("sessions_token_unique").on(table.token), index("sessions_user_idx").on(table.userId)]);

export const organizationMemberships = pgTable("organization_memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: staffRole("role").notNull(),
  ...timestamps,
}, table => [uniqueIndex("memberships_school_user_unique").on(table.organizationId, table.userId), index("memberships_user_idx").on(table.userId)]);

export const smsInvitations = pgTable("sms_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  phoneNumber: varchar("phone_number", { length: 16 }).notNull(),
  role: staffRole("role").notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  invitedBy: text("invited_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: text("accepted_by").references(() => users.id, { onDelete: "set null" }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  deliveryStatus: varchar("delivery_status", { length: 20 }).default("pending").notNull(),
  providerRef: text("provider_ref"),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull(),
  ...timestamps,
}, table => [uniqueIndex("sms_invitations_token_unique").on(table.tokenHash), index("sms_invitations_org_idx").on(table.organizationId)]);

export const invitationSmsLimits = pgTable("invitation_sms_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull(),
  windowStartsAt: timestamp("window_starts_at", { withTimezone: true }).notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("accounts_user_idx").on(table.userId)]);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [index("verifications_identifier_idx").on(table.identifier)]);

export const twoFactors = pgTable("two_factors", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  verified: boolean("verified").default(false).notNull(),
  failedVerificationCount: integer("failed_verification_count").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
}, (table) => [index("two_factors_user_idx").on(table.userId)]);

export const academicYears = pgTable("academic_years", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 50 }).notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  isCurrent: boolean("is_current").default(false).notNull(),
  ...timestamps,
}, (table) => [index("academic_years_organization_idx").on(table.organizationId)]);

export const terms = pgTable("terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  position: integer("position").notNull(),
  ...timestamps,
}, (table) => [index("terms_year_idx").on(table.academicYearId)]);

export const gradeLevels = pgTable("grade_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  position: integer("position").notNull(),
  ...timestamps,
}, (table) => [index("grade_levels_organization_idx").on(table.organizationId)]);

export const classes = pgTable("classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  gradeLevelId: uuid("grade_level_id").notNull().references(() => gradeLevels.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 80 }).notNull(),
  homeroomTeacherId: text("homeroom_teacher_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [index("classes_organization_year_idx").on(table.organizationId, table.academicYearId)]);

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  studentNumber: varchar("student_number", { length: 50 }).notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  middleName: varchar("middle_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  preferredName: varchar("preferred_name", { length: 100 }),
  dateOfBirth: date("date_of_birth").notNull(),
  status: enrollmentStatus("status").default("pending").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("students_organization_number_unique").on(table.organizationId, table.studentNumber), index("students_name_idx").on(table.organizationId, table.lastName, table.firstName)]);

export const guardians = pgTable("guardians", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }),
  phone: varchar("phone", { length: 40 }),
  ...timestamps,
}, (table) => [index("guardians_organization_email_idx").on(table.organizationId, table.email)]);

export const studentGuardians = pgTable("student_guardians", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  guardianId: uuid("guardian_id").notNull().references(() => guardians.id, { onDelete: "cascade" }),
  relationship: relationshipType("relationship").notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  hasLegalResponsibility: boolean("has_legal_responsibility").default(false).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("student_guardians_unique").on(table.studentId, table.guardianId)]);

export const enrollments = pgTable("enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "restrict" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  status: enrollmentStatus("status").default("pending").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on"),
  ...timestamps,
}, (table) => [uniqueIndex("enrollments_student_year_unique").on(table.studentId, table.academicYearId), index("enrollments_class_idx").on(table.classId)]);

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  status: importStatus("status").default("uploaded").notNull(),
  sourceFilename: varchar("source_filename", { length: 255 }).notNull(),
  rowCount: integer("row_count").default(0).notNull(),
  validRowCount: integer("valid_row_count").default(0).notNull(),
  invalidRowCount: integer("invalid_row_count").default(0).notNull(),
  validationReport: jsonb("validation_report"),
  ...timestamps,
}, (table) => [index("import_jobs_organization_idx").on(table.organizationId, table.createdAt)]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
  actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 80 }).notNull(),
  entityId: text("entity_id").notNull(),
  requestId: varchar("request_id", { length: 100 }),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("audit_events_organization_time_idx").on(table.organizationId, table.createdAt), index("audit_events_entity_idx").on(table.entityType, table.entityId)]);

export const subjects = pgTable("subjects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 30 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  department: varchar("department", { length: 80 }),
  ...timestamps,
}, (table) => [uniqueIndex("subjects_org_code_unique").on(table.organizationId, table.code), index("subjects_organization_idx").on(table.organizationId)]);

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 254 }).notNull(),
  role: staffRole("role").notNull(),
  token: text("token").notNull(),
  invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("invitations_token_unique").on(table.token), index("invitations_organization_email_idx").on(table.organizationId, table.email)]);

export const teacherClassAssignments = pgTable("teacher_class_assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  teacherId: text("teacher_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  isPrimaryHomeroom: boolean("is_primary_homeroom").default(false).notNull(),
  ...timestamps,
}, (table) => [index("teacher_class_assignments_teacher_idx").on(table.organizationId, table.teacherId), index("teacher_class_assignments_class_idx").on(table.organizationId, table.classId)]);

export const attendanceSessions = pgTable("attendance_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  sessionDate: date("session_date").notNull(),
  period: varchar("period", { length: 50 }).default("morning_roll_call").notNull(),
  recordedBy: text("recorded_by").references(() => users.id, { onDelete: "set null" }),
  status: attendanceSessionStatus("status").default("in_progress").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("attendance_sessions_class_date_period_unique").on(table.organizationId, table.classId, table.sessionDate, table.period), index("attendance_sessions_date_idx").on(table.organizationId, table.sessionDate)]);

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").notNull().references(() => attendanceSessions.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  status: attendanceStatus("status").default("present").notNull(),
  arrivalMinutesLate: integer("arrival_minutes_late").default(0).notNull(),
  reason: varchar("reason", { length: 255 }),
  remarks: text("remarks"),
  ...timestamps,
}, (table) => [uniqueIndex("attendance_records_session_student_unique").on(table.sessionId, table.studentId), index("attendance_records_student_idx").on(table.organizationId, table.studentId)]);

export const attendanceCorrections = pgTable("attendance_corrections", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  attendanceRecordId: uuid("attendance_record_id").notNull().references(() => attendanceRecords.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  previousStatus: attendanceStatus("previous_status").notNull(),
  newStatus: attendanceStatus("new_status").notNull(),
  reason: text("reason").notNull(),
  correctedBy: text("corrected_by").references(() => users.id, { onDelete: "set null" }),
  correctedAt: timestamp("corrected_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("attendance_corrections_student_idx").on(table.organizationId, table.studentId), index("attendance_corrections_record_idx").on(table.attendanceRecordId)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  recipientUserId: text("recipient_user_id").references(() => users.id, { onDelete: "cascade" }),
  recipientEmail: varchar("recipient_email", { length: 254 }),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}).notNull(),
  ...timestamps,
}, (table) => [index("notifications_recipient_idx").on(table.organizationId, table.recipientUserId, table.isRead)]);

export const smsDispatches = pgTable("sms_dispatches", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  recipientPhone: varchar("recipient_phone", { length: 40 }).notNull(),
  recipientName: varchar("recipient_name", { length: 100 }).notNull(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  status: varchar("status", { length: 30 }).default("sent").notNull(),
  providerRef: varchar("provider_ref", { length: 100 }),
  error: text("error"),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => [index("sms_dispatches_org_time_idx").on(table.organizationId, table.sentAt), index("sms_dispatches_student_idx").on(table.studentId)]);

export const gradingSchemes = pgTable("grading_schemes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: gradingSchemeType("type").default("letter").notNull(),
  scaleConfig: jsonb("scale_config").default([]).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  ...timestamps,
}, (table) => [index("grading_schemes_org_idx").on(table.organizationId)]);

export const assessmentCategories = pgTable("assessment_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "set null" }),
  name: varchar("name", { length: 100 }).notNull(),
  weight: integer("weight").default(25).notNull(),
  position: integer("position").default(0).notNull(),
  ...timestamps,
}, (table) => [index("assessment_categories_org_year_idx").on(table.organizationId, table.academicYearId)]);

export const assessments = pgTable("assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "cascade" }),
  termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").notNull().references(() => assessmentCategories.id, { onDelete: "restrict" }),
  gradingSchemeId: uuid("grading_scheme_id").references(() => gradingSchemes.id, { onDelete: "set null" }),
  title: varchar("title", { length: 150 }).notNull(),
  code: varchar("code", { length: 40 }),
  maxScore: integer("max_score").default(100).notNull(),
  dateDue: date("date_due").notNull(),
  status: assessmentStatus("status").default("draft").notNull(),
  createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [
  index("assessments_class_subject_idx").on(table.organizationId, table.classId, table.subjectId),
  index("assessments_term_idx").on(table.termId),
]);

export const assessmentGrades = pgTable("assessment_grades", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  assessmentId: uuid("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
  letterGrade: varchar("letter_grade", { length: 10 }),
  status: gradeStatus("status").default("draft").notNull(),
  feedback: text("feedback"),
  gradedBy: text("graded_by").references(() => users.id, { onDelete: "set null" }),
  gradedAt: timestamp("graded_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, (table) => [
  uniqueIndex("assessment_grades_student_assessment_unique").on(table.assessmentId, table.studentId),
  index("assessment_grades_student_idx").on(table.organizationId, table.studentId),
]);

export const gradeCorrections = pgTable("grade_corrections", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  assessmentGradeId: uuid("assessment_grade_id").notNull().references(() => assessmentGrades.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  previousScore: numeric("previous_score", { precision: 5, scale: 2 }).notNull(),
  newScore: numeric("new_score", { precision: 5, scale: 2 }).notNull(),
  previousGrade: varchar("previous_grade", { length: 10 }),
  newGrade: varchar("new_grade", { length: 10 }),
  reason: text("reason").notNull(),
  correctedBy: text("corrected_by").references(() => users.id, { onDelete: "set null" }),
  correctedAt: timestamp("corrected_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("grade_corrections_grade_idx").on(table.organizationId, table.assessmentGradeId),
  index("grade_corrections_student_idx").on(table.studentId),
]);

export const reportCards = pgTable("report_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYears.id, { onDelete: "restrict" }),
  termId: uuid("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
  classId: uuid("class_id").notNull().references(() => classes.id, { onDelete: "restrict" }),
  version: integer("version").default(1).notNull(),
  status: reportCardStatus("status").default("draft").notNull(),
  gpa: numeric("gpa", { precision: 3, scale: 2 }),
  overallPercentage: numeric("overall_percentage", { precision: 5, scale: 2 }),
  attendanceRate: numeric("attendance_rate", { precision: 4, scale: 1 }),
  daysPresent: integer("days_present").default(0).notNull(),
  daysAbsent: integer("days_absent").default(0).notNull(),
  daysLate: integer("days_late").default(0).notNull(),
  teacherRemarks: text("teacher_remarks"),
  principalRemarks: text("principal_remarks"),
  approvedBy: text("approved_by").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("report_cards_student_term_version_unique").on(table.studentId, table.termId, table.version),
  index("report_cards_class_term_idx").on(table.organizationId, table.classId, table.termId),
]);

export const reportCardSubjectGrades = pgTable("report_card_subject_grades", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  reportCardId: uuid("report_card_id").notNull().references(() => reportCards.id, { onDelete: "cascade" }),
  subjectId: uuid("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  teacherId: text("teacher_id").references(() => users.id, { onDelete: "set null" }),
  scorePercentage: numeric("score_percentage", { precision: 5, scale: 2 }).notNull(),
  letterGrade: varchar("letter_grade", { length: 10 }).notNull(),
  standardsLevel: varchar("standards_level", { length: 50 }),
  comments: text("comments"),
  ...timestamps,
}, (table) => [
  index("report_card_subjects_card_idx").on(table.reportCardId),
]);

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  targetType: announcementTarget("target_type").default("school").notNull(),
  targetId: varchar("target_id", { length: 80 }).default("all").notNull(),
  priority: announcementPriority("priority").default("normal").notNull(),
  channels: deliveryChannel("channels").default("in_app").notNull(),
  status: announcementStatus("status").default("draft").notNull(),
  requiresTwoParty: boolean("requires_two_party").default(false).notNull(),
  firstApproverId: text("first_approver_id").references(() => users.id, { onDelete: "set null" }),
  secondApproverId: text("second_approver_id").references(() => users.id, { onDelete: "set null" }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [
  index("announcements_org_status_idx").on(table.organizationId, table.status),
  index("announcements_target_idx").on(table.organizationId, table.targetType, table.targetId),
]);

export const announcementReads = pgTable("announcement_reads", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  announcementId: uuid("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("announcement_reads_unique").on(table.announcementId, table.userId),
]);

export const guardianConsents = pgTable("guardian_consents", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  guardianId: uuid("guardian_id").notNull().references(() => guardians.id, { onDelete: "cascade" }),
  phone: varchar("phone", { length: 40 }).notNull(),
  optInSmsAnnouncements: boolean("opt_in_sms_announcements").default(true).notNull(),
  optInSmsAttendance: boolean("opt_in_sms_attendance").default(true).notNull(),
  optInSmsEmergency: boolean("opt_in_sms_emergency").default(true).notNull(),
  optOutReason: text("opt_out_reason"),
  optOutAt: timestamp("opt_out_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex("guardian_consents_guardian_unique").on(table.organizationId, table.guardianId),
]);

export const communicationTemplates = pgTable("communication_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 120 }).notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  contentTemplate: text("content_template").notNull(),
  defaultPriority: announcementPriority("default_priority").default("normal").notNull(),
  suggestedChannel: deliveryChannel("suggested_channel").default("in_app").notNull(),
  ...timestamps,
}, (table) => [
  index("comm_templates_org_cat_idx").on(table.organizationId, table.category),
]);

export const sensitiveCases = pgTable("sensitive_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  caseNumber: varchar("case_number", { length: 50 }).notNull(),
  area: sensitiveCaseArea("area").notNull(),
  confidentialityTier: caseConfidentialityTier("confidentiality_tier").default("confidential").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  status: sensitiveCaseStatus("status").default("open").notNull(),
  leadSpecialistId: text("lead_specialist_id").references(() => users.id, { onDelete: "set null" }),
  hasCourtOrder: boolean("has_court_order").default(false).notNull(),
  reviewDate: date("review_date"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedReason: text("closed_reason"),
  ...timestamps,
}, (table) => [
  uniqueIndex("sensitive_cases_case_num_unique").on(table.organizationId, table.caseNumber),
  index("sensitive_cases_org_area_idx").on(table.organizationId, table.area),
  index("sensitive_cases_org_student_idx").on(table.organizationId, table.studentId),
]);

export const sensitiveCaseNotes = pgTable("sensitive_case_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  caseId: uuid("case_id").notNull().references(() => sensitiveCases.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  noteType: varchar("note_type", { length: 80 }).default("clinical_observation").notNull(),
  confidentialityTier: caseConfidentialityTier("confidentiality_tier").default("confidential").notNull(),
  encryptedCiphertext: text("encrypted_ciphertext").notNull(),
  ivHex: varchar("iv_hex", { length: 64 }).notNull(),
  authTagHex: varchar("auth_tag_hex", { length: 64 }).notNull(),
  isQuarantined: boolean("is_quarantined").default(false).notNull(),
  ...timestamps,
}, (table) => [
  index("sensitive_notes_case_idx").on(table.caseId),
]);

export const sensitiveAccessLogs = pgTable("sensitive_access_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  caseId: uuid("case_id").notNull().references(() => sensitiveCases.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).default("view_decrypted").notNull(),
  accessReason: text("access_reason").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  accessedAt: timestamp("accessed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("sensitive_access_logs_case_idx").on(table.caseId),
  index("sensitive_access_logs_user_idx").on(table.userId),
]);

export const needToKnowAlerts = pgTable("need_to_know_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  caseId: uuid("case_id").references(() => sensitiveCases.id, { onDelete: "set null" }),
  category: varchar("category", { length: 60 }).notNull(),
  severity: needToKnowSeverity("severity").default("routine").notNull(),
  directiveSummary: varchar("directive_summary", { length: 255 }).notNull(),
  actionRequired: text("action_required").notNull(),
  authorSpecialistId: text("author_specialist_id").references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index("need_to_know_student_idx").on(table.organizationId, table.studentId, table.isActive),
]);

export const courtRestrictions = pgTable("court_restrictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  restrictedGuardianId: uuid("restricted_guardian_id").references(() => guardians.id, { onDelete: "set null" }),
  restrictedPersonName: varchar("restricted_person_name", { length: 180 }).notNull(),
  orderType: courtOrderType("order_type").default("restraining_order").notNull(),
  docketNumber: varchar("docket_number", { length: 100 }).notNull(),
  issuingCourt: varchar("issuing_court", { length: 180 }).notNull(),
  summary: text("summary").notNull(),
  prohibitPickup: boolean("prohibit_pickup").default(true).notNull(),
  prohibitDisclosure: boolean("prohibit_disclosure").default(true).notNull(),
  prohibitDirectContact: boolean("prohibit_direct_contact").default(true).notNull(),
  effectiveDate: date("effective_date").notNull(),
  expirationDate: date("expiration_date"),
  isEnforced: boolean("is_enforced").default(true).notNull(),
  ...timestamps,
}, (table) => [
  index("court_restrictions_student_idx").on(table.organizationId, table.studentId),
]);

export const gdprRequests = pgTable("gdpr_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }).notNull(),
  requestType: gdprRequestType("request_type").notNull(),
  status: gdprRequestStatus("status").default("pending").notNull(),
  requesterName: varchar("requester_name", { length: 180 }).notNull(),
  requesterRole: varchar("requester_role", { length: 80 }).notNull(),
  requesterEmail: varchar("requester_email", { length: 255 }).notNull(),
  justification: text("justification").notNull(),
  rectificationPayload: jsonb("rectification_payload"),
  resultExportUrl: text("result_export_url"),
  safeguardingRedacted: boolean("safeguarding_redacted").default(false).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  processedBy: text("processed_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
}, (table) => [
  index("gdpr_requests_org_idx").on(table.organizationId),
  index("gdpr_requests_student_idx").on(table.studentId),
]);

export const restoreDrills = pgTable("restore_drills", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }).notNull(),
  drillDate: timestamp("drill_date", { withTimezone: true }).defaultNow().notNull(),
  backupFilename: varchar("backup_filename", { length: 255 }).notNull(),
  backupSizeBytes: integer("backup_size_bytes").notNull(),
  checksumSha256: varchar("checksum_sha256", { length: 64 }).notNull(),
  checksumVerified: boolean("checksum_verified").default(true).notNull(),
  rpoHoursValidated: numeric("rpo_hours_validated", { precision: 5, scale: 2 }).notNull(),
  rtoMinutesElapsed: integer("rto_minutes_elapsed").notNull(),
  reconciledStudents: integer("reconciled_students").notNull(),
  reconciledGuardians: integer("reconciled_guardians").notNull(),
  reconciledCases: integer("reconciled_cases").notNull(),
  status: drillStatus("status").default("passed").notNull(),
  operatorId: text("operator_id").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("restore_drills_org_idx").on(table.organizationId),
]);

export const rateLimitLogs = pgTable("rate_limit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  tier: varchar("tier", { length: 50 }).notNull(),
  clientIdentifier: varchar("client_identifier", { length: 120 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  requestCount: integer("request_count").notNull(),
  limit: integer("limit").notNull(),
  windowSeconds: integer("window_seconds").notNull(),
  blockedAt: timestamp("blocked_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("rate_limit_logs_tier_idx").on(table.tier),
  index("rate_limit_logs_client_idx").on(table.clientIdentifier),
]);

export const schema = {
  organizationMemberships,
  smsInvitations,
  invitationSmsLimits,
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
  twoFactor: twoFactors,
  organizations,
  academicYears,
  terms,
  gradeLevels,
  classes,
  subjects,
  invitations,
  students,
  guardians,
  studentGuardians,
  enrollments,
  importJobs,
  auditEvents,
  teacherClassAssignments,
  attendanceSessions,
  attendanceRecords,
  attendanceCorrections,
  notifications,
  smsDispatches,
  gradingSchemes,
  assessmentCategories,
  assessments,
  assessmentGrades,
  gradeCorrections,
  reportCards,
  reportCardSubjectGrades,
  announcements,
  announcementReads,
  guardianConsents,
  communicationTemplates,
  sensitiveCases,
  sensitiveCaseNotes,
  sensitiveAccessLogs,
  needToKnowAlerts,
  courtRestrictions,
  gdprRequests,
  restoreDrills,
  rateLimitLogs,
};
