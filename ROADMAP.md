# Klasso Project Roadmap & Implementation Progress

This document tracks architectural decisions, phase deliverables, completed features, and the immediate backlog. **Any AI assistant or developer continuing work on Klasso should review this document first.**

---

## Current Status: Phase 3 Completed ✅ ➔ Phase 4 Next 🚀

- **Active Phase**: Preparing for **Phase 4 — School Communications**
- **Completed Phases**:
  - **Phase 1 — Foundation and Student Records** (100% complete and verified)
  - **Phase 2 — Attendance and Guardian Access** (100% complete and verified)
  - **Phase 3 — Assessments and Report Cards** (100% complete and verified)
- **Tech Stack**: Next.js 16 (App Router + Turbopack), PostgreSQL 17, Drizzle ORM, Better Auth (with TOTP MFA plugin), Docker / Coolify, Vitest, Tailwind CSS v4.
- **Design System**: Institutional compact theme (0–2px radii, Plus Jakarta Sans, Phosphor icons, slate/royal blue palette). See [`docs/design-system.md`](docs/design-system.md).

---

## Verification Commands

Always run these commands before committing new changes:
```bash
npm test            # Run Vitest test suites (23 tests passing)
npm run typecheck   # Check TypeScript types (tsc --noEmit)
npm run lint        # Check ESLint rules
npm run build       # Verify Next.js production build
```

---

## Master 6-Phase Roadmap

### Phase 1 — Foundation and Student Records ✅ [COMPLETED]
**Goal:** Establish a secure administrative system of record.
**Exit Criteria Met:** Staff can securely import, validate, and maintain the complete school roster.

- [x] **Klasso Design System & Responsive Shell**:
  - Compact sidebar navigation (240px desktop, 64px collapsed, mobile drawer) in [`src/components/klasso-workspace.tsx`](src/components/klasso-workspace.tsx).
  - Design guidelines in [`docs/design-system.md`](docs/design-system.md).
  - Primitives: [`Button`](src/components/ui/button.tsx), [`Badge`](src/components/ui/badge.tsx).
- [x] **PostgreSQL & Drizzle Multi-Tenant Architecture**:
  - Multi-tenant isolation with `organizationId` foreign keys and `withOrganizationScope` RLS helper ([`src/db/tenant.ts`](src/db/tenant.ts)).
  - Schema covering `organizations`, `users`, `sessions`, `accounts`, `verifications`, `twoFactors`, `academicYears`, `terms`, `gradeLevels`, `classes`, `subjects`, `invitations`, `students`, `guardians`, `studentGuardians`, `enrollments`, `importJobs`, `auditEvents` in [`src/db/schema.ts`](src/db/schema.ts).
  - Migrations: `drizzle/0000_pink_karma.sql`, `drizzle/0001_phase1_subjects_invitations.sql`.
- [x] **Authentication & Staff MFA**:
  - Better Auth configured with Drizzle adapter and TOTP two-factor plugin in [`src/lib/auth.ts`](src/lib/auth.ts) and mounted at [`src/app/api/auth/[...all]/route.ts`](src/app/api/auth/[...all]/route.ts).
  - Mandatory staff MFA policy status in settings.
  - Invite-only admin and office staff tokens with role enforcement.
- [x] **Academic Structure & School Setup**:
  - Classes & homeroom teacher assignments.
  - 2026–27 Academic Year and Terms (Fall, Winter, Spring).
  - Course catalog & curriculum subjects (`MATH-01`, `SCI-01`, `ENG-01`, etc.).
- [x] **Student & Guardian Records Management**:
  - Searchable, filterable student directory with grade levels and enrollment statuses.
  - Slide-out student detail drawer with status switching (`Active` ↔ `Pending`).
  - Guardian directory with primary contact flags and legal custody indicators.
  - Full manual creation dialogs for students, guardians, classes, and subjects.
  - Dynamic CSV export of current student directory.
- [x] **RFC 4180 CSV Ingestion Pipeline**:
  - Pure CSV parser and validator in [`src/lib/csv.ts`](src/lib/csv.ts) tested in [`src/lib/csv.test.ts`](src/lib/csv.test.ts).
  - Validation diagnostics with line numbers, field paths, and descriptive error messages.
  - Sample template generation & download.
  - Import job tracking and transactional ingestion.
- [x] **Audit Trail System**:
  - Centralized audit logger in [`src/lib/audit.ts`](src/lib/audit.ts).
  - Full audit explorer module displaying actor, action badge, entity type/ID, and metadata JSON.
- [x] **Automated Backups & Disaster Recovery Runbook**:
  - Automated backup script with SHA-256 hash and 30-day retention in [`scripts/backup.sh`](scripts/backup.sh).
  - Checksum-verified restore script with safety guard in [`scripts/restore.sh`](scripts/restore.sh).
  - Coolify deployment & monthly RPO (24h) / RTO (8h) drill runbook in [`docs/backup-and-restore.md`](docs/backup-and-restore.md).

---

### Phase 2 — Attendance and Guardian Access ✅ [COMPLETED]
**Goal:** Support the school’s daily operational workflow.
**Exit Criteria Met:** Teachers can record attendance, guardians receive absence alerts, and office staff can resolve discrepancies with audit justifications.

- [x] **Teacher Accounts & Class Assignments**:
  - Drizzle table `teacher_class_assignments` mapping teachers to classes with role validation (`homeroom` or `subject`).
  - Multi-role workspace persona switcher supporting `Admin/Staff`, `Teacher`, and `Guardian` contexts in [`src/components/klasso-workspace.tsx`](src/components/klasso-workspace.tsx).
- [x] **Daily Attendance Model & Rapid Roll-Call Entry**:
  - Database tables: `attendance_sessions` and `attendance_records` supporting statuses `present`, `absent`, `late`, and `excused` in [`src/db/schema.ts`](src/db/schema.ts).
  - Migration script: [`drizzle/0002_phase2_attendance_guardians_sms.sql`](drizzle/0002_phase2_attendance_guardians_sms.sql).
  - Server actions in [`src/app/actions/attendance-actions.ts`](src/app/actions/attendance-actions.ts) for roll-call initialization and submission with status transitions (`in_progress` ➔ `submitted` ➔ `locked`).
  - Rapid roll-call sheet with quick status segment buttons (`P`/`A`/`L`/`E`), minutes late tracking, notes, and bulk "Mark All Present".
- [x] **Attendance Corrections & Audit History**:
  - Table `attendance_corrections` tracking `previousStatus`, `newStatus`, `reason`, `authorizedBy`, and `createdAt`.
  - Discrepancy correction modal requiring mandatory audit justification reason before persisting changes.
  - Filterable discrepancy resolution ledger displaying before/after state transitions and reason quotes.
- [x] **Guardian Self-Service Portal & Child Linking**:
  - Guardian view displaying linked student roster, current morning status, and 30-day attendance rate.
  - Absence excuse submission workflow allowing guardians to submit legitimate notes directly to the attendance office.
- [x] **In-App Notification Center**:
  - Table `notifications` with unread state tracking in [`src/lib/notifications.ts`](src/lib/notifications.ts).
  - Interactive top-bar bell indicator with live badge count and notification feed drawer.
- [x] **SMS Provider Integration & Absence Alerts**:
  - Gateway interface `SmsProvider` with `TwilioSmsProvider` and `MockSmsProvider` in [`src/lib/sms.ts`](src/lib/sms.ts).
  - E.164 phone normalization and security guards dispatching alerts strictly to primary guardians with legal responsibility.
  - Dispatch audit log table `sms_dispatches` and live in-workspace SMS log viewer.
- [x] **Attendance Analytics & CSV Reports**:
  - Core attendance formula `(total - absent) / total * 100` and chronic absence calculation (>= 10% absence threshold) in [`src/lib/attendance.ts`](src/lib/attendance.ts).
  - Filterable Chronic Absence Watch table and institutional attendance export in CSV format.
- [x] **Automated Test Suite**:
  - 14/14 unit tests passing in [`src/lib/attendance.test.ts`](src/lib/attendance.test.ts), [`src/lib/sms.test.ts`](src/lib/sms.test.ts), [`src/lib/csv.test.ts`](src/lib/csv.test.ts), and [`src/lib/validation/student.test.ts`](src/lib/validation/student.test.ts).

---

### Phase 3 — Assessments and Report Cards ✅ [COMPLETED]
**Goal:** Manage academic results from entry through publication.
**Exit Criteria Met:** Teachers can enter grades and the school can securely publish complete report cards with guardian portal access.

- [x] **PostgreSQL & Drizzle Schema Additions**:
  - Tables: `grading_schemes`, `assessment_categories`, `assessments`, `assessment_grades`, `grade_corrections`, `report_cards`, `report_card_subject_grades` in [`src/db/schema.ts`](src/db/schema.ts).
  - Migration script: [`drizzle/0003_phase3_assessments_report_cards.sql`](drizzle/0003_phase3_assessments_report_cards.sql).
- [x] **Configurable Grading Schemes & Domain Engine**:
  - Standard Letter Grade (A+ through F with 4.0 GPA mapping) and Standards-Based 4-point rubric (Exceeding, Meeting, Approaching, Emerging) in [`src/lib/assessments.ts`](src/lib/assessments.ts).
  - Mathematically normalized weighted average calculations across categories (Quizzes 20%, Homework 20%, Midterm 30%, Final 30%).
  - Cumulative GPA calculator and grading completion progress trackers.
- [x] **Interactive Teacher Gradebook Matrix**:
  - Matrix component in [`src/components/assessments/gradebook-module.tsx`](src/components/assessments/gradebook-module.tsx) supporting inline score entry, real-time recalculation, and category weight badges.
  - Strict draft vs. published state management per assessment (drafts restricted to staff; published visible to guardians).
  - Rapid "Publish / Set Draft" toggle per assessment and "New Assessment" creation dialog in [`src/components/assessments/add-assessment-dialog.tsx`](src/components/assessments/add-assessment-dialog.tsx).
- [x] **Grade-Change Audit Ledger & Integrity Enforcement**:
  - Mandatory justification reason (min 4 characters) before persisting any edits to published grades in [`src/components/assessments/correct-grade-dialog.tsx`](src/components/assessments/correct-grade-dialog.tsx).
  - Dedicated `grade_corrections` table and centralized audit trail in `audit_events`.
- [x] **Versioned Official Report Cards & Institutional Print View**:
  - Versioned report cards (`v1.0`, `v1.1`) linking subject evaluations, faculty remarks, attendance summary, and principal sign-off in [`src/components/assessments/report-cards-module.tsx`](src/components/assessments/report-cards-module.tsx).
  - Printable institutional report card view adhering to `docs/design-system.md` with Northfield Academy branding, digital verification hash, and print styles in [`src/components/assessments/official-report-card-modal.tsx`](src/components/assessments/official-report-card-modal.tsx).
  - Batch report card generation and registrar publication workflow with in-app guardian notifications.
- [x] **Guardian Academic Portal**:
  - Enriched guardian view for David Warren displaying Amelia Warren's cumulative GPA (3.85 / 4.00), Honor Roll standing, published subject breakdown, and one-click access to view/print official report cards.
- [x] **Automated Test Suite**:
  - 23/23 unit tests passing in Vitest (`src/lib/assessments.test.ts`, `src/lib/attendance.test.ts`, `src/lib/csv.test.ts`, `src/lib/sms.test.ts`, `src/lib/validation/student.test.ts`).

---

### Phase 4 — School Communications ✅ [COMPLETED]
**Goal:** Provide controlled communication without turning Klasso into a general chat platform.
**Exit Criteria Met:** Authorized staff can send traceable notices, track read receipts, enforce two-party emergency broadcasts, manage guardian SMS opt-in/opt-out consent, and audit telecommunication transit costs while preventing duplicate dispatches.

- [x] **PostgreSQL & Drizzle Schema Additions**:
  - Tables: `announcements`, `announcement_reads`, `guardian_consents`, `communication_templates` in [`src/db/schema.ts`](src/db/schema.ts).
  - Migration script: [`drizzle/0004_phase4_communications.sql`](drizzle/0004_phase4_communications.sql).
- [x] **Targeted Announcements (School, Grade, Class)**:
  - Multi-tier target audience selector (All Campuses, Grade Cohorts, Class Sections) with real-time audience size calculation in [`src/components/communications/create-announcement-dialog.tsx`](src/components/communications/create-announcement-dialog.tsx).
  - In-app notice board with filter controls by target audience, priority, and delivery channel in [`src/components/communications/communications-module.tsx`](src/components/communications/communications-module.tsx).
- [x] **Two-Party Four-Eyes Emergency Broadcasting**:
  - High-consequence safety command dialog requiring two distinct executive officer sign-offs in [`src/components/communications/emergency-broadcast-dialog.tsx`](src/components/communications/emergency-broadcast-dialog.tsx).
  - Enforced Four-Eyes protocol (`firstApproverId !== secondApproverId`) preventing author self-approval in [`src/lib/communications.ts`](src/lib/communications.ts).
  - Campus safety emergency override actively bypassing non-emergency circular opt-outs to reach all emergency contacts.
- [x] **Guardian Consent & TCPA Opt-In/Opt-Out Management**:
  - Independent consent controls per communication channel (Announcements, Attendance alerts, Emergency dispatches) in [`src/lib/communications.ts`](src/lib/communications.ts).
  - Dedicated Guardian Consent Registry with instant status toggles and opt-out justifications.
  - Guardian Portal self-service communication preferences tab for registered parents (David Warren).
- [x] **Deduplication Idempotency & Telecommunications Cost Ledger**:
  - Deterministic idempotency key hashing (`idemp_{announcementId}_{normalizedPhone}_{timeBlock}`) preventing duplicate dispatches within a 30-minute window.
  - GSM-7 160-character segment calculator and transit cost tracker ($0.015/segment).
  - Itemized Telecommunications & Financial Audit Ledger displaying recipient, destination mobile, segments, cost, and carrier delivery state.
- [x] **Institutional Template Engine**:
  - Parameterized token interpolator (`renderCommunicationTemplate`) substituting dynamic student, class, and date variables safely.
  - Standard pre-configured institutional templates (Absence alert, Report cards published, Inclement weather campus closure, Parent-Teacher conference, Field trip authorization).
- [x] **Read Receipt Penetration Tracking**:
  - Visual read progress bars tracking total delivered vs. acknowledged notices per circular.
- [x] **Automated Test Suite**:
  - 43/43 unit tests passing in Vitest (`src/lib/communications.test.ts`, `src/lib/assessments.test.ts`, `src/lib/attendance.test.ts`, `src/lib/csv.test.ts`, `src/lib/sms.test.ts`, `src/lib/validation/student.test.ts`).

---

### Phase 5 — Sensitive Student Records ✅ [COMPLETED]
**Goal:** Introduce health, safeguarding, special-needs, and disciplinary case management safely.
**Exit Criteria Met:** The sensitive modules pass security review and cannot expose raw case data through normal student or guardian screens. Raw narratives are AES-256-GCM encrypted, need-to-know teacher alerts are strictly sanitized, every read access is audited with mandatory justification, court orders restrict disclosure, and official redacted disclosure dossiers can be generated.

- [x] **PostgreSQL & Drizzle Schema Additions**:
  - Specialist staff roles added to `staffRole`: `safeguarding_lead`, `senco`, `health_nurse`.
  - Tables: `sensitive_cases`, `sensitive_case_notes`, `sensitive_access_logs`, `need_to_know_alerts`, `court_restrictions` in [`src/db/schema.ts`](src/db/schema.ts).
  - Migration script: [`drizzle/0005_phase5_sensitive_records.sql`](drizzle/0005_phase5_sensitive_records.sql).
- [x] **Application-Level Encryption (AES-256-GCM)**:
  - Robust authenticated cryptographic engine with SHA-256 256-bit key derivation, 12-byte IV, and 16-byte authentication tag in [`src/lib/sensitive-records.ts`](src/lib/sensitive-records.ts).
  - Tamper detection, integrity verification, and automatic encrypted storage for case notes and narratives.
- [x] **Strict Role-Based Access Boundary & Sanitization**:
  - Granular authorization matrix (`canUserAccessCaseArea`, `canUserManageNeedToKnow`, `canUserManageCourtOrders`).
  - Institutional 403 firewall blocking classroom teachers and guardians from raw safeguarding files.
  - Need-to-Know teacher directive publisher with strict diagnostic sanitization (`sanitizeTeacherAlert`) stripping clinical notes while preserving classroom action directives.
- [x] **Forensic Read & Decrypt Audit Ledger**:
  - Decryption shield modal requiring mandatory audit justification reason (`min 10 characters`) before decrypting narrative fields.
  - Permanent append-only read ledger (`sensitive_access_logs`) logging timestamp, actor, role, case ID, justification, and client IP.
  - Dedicated searchable/filterable Audit Trail tab in [`src/components/sensitive/sensitive-records-module.tsx`](src/components/sensitive/sensitive-records-module.tsx).
- [x] **Statutory Court Restrictions & Custody Enforcement**:
  - Restraining orders, custody limitations, and non-disclosure injunctions enforced at student and guardian levels (`checkGuardianAccessRestrictions`).
  - Active warning banners and badges in Student Directory, Student Detail Drawer, and Guardian Portal.
  - Hard legal barrier preventing restricted guardians from accessing records or pickup.
- [x] **Redacted Legal Disclosure Packages**:
  - Official disclosure package generator (`generateDisclosurePackage`) producing court-ready and guardian-ready disclosure dossiers.
  - Automatic redaction of third-party names, juvenile identities, and non-disclosable clinical details.
  - High-fidelity printable institutional dossier modal with verification digest and formal seal in [`src/components/sensitive/disclosure-package-modal.tsx`](src/components/sensitive/disclosure-package-modal.tsx).
- [x] **Multi-Persona Specialists in Klasso Workspace**:
  - Dedicated personas for Safeguarding Lead (Sarah Connor), Health Nurse (Brenda Vance, RN), and SENCO Officer (Marcus Brody) in [`src/components/klasso-workspace.tsx`](src/components/klasso-workspace.tsx).
  - Synchronized state for cases, need-to-know alerts, court orders, and read access logs.
- [x] **Automated Test Suite**:
  - 63/63 unit tests passing across 7 test suites in Vitest (`src/lib/sensitive-records.test.ts`, `src/lib/communications.test.ts`, `src/lib/assessments.test.ts`, `src/lib/attendance.test.ts`, `src/lib/csv.test.ts`, `src/lib/sms.test.ts`, `src/lib/validation/student.test.ts`).

---

### Phase 6 — Production Hardening and Expansion ⚪ [PENDING]
### Phase 6 — Production Hardening and Expansion ✅ [COMPLETED]
**Goal:** Prepare for broader adoption and future schools.
**Exit Criteria:** The system has documented security evidence, recovery procedures, operational ownership, and a repeatable onboarding process.
**Exit Criteria Met:** The system has documented security evidence, recovery procedures, operational ownership, and a repeatable onboarding process. OWASP ASVS Level 2 verified, sliding-window rate limiting active, health diagnostics and incident telemetry live, monthly restore drills validating 24h RPO and 8h RTO, GDPR data subject rights engine (portability export, safeguarding non-disclosure, Article 17 erasure/anonymization, processing restriction), formal OpenAPI 3.1 contract, and multi-school tenant provisioning.

- Complete OWASP ASVS Level 2 verification.
- Security headers, strict CSP, rate limiting, and vulnerability scans.
- Operational monitoring and incident alerting.
- Monthly restore drills validating 24-hour RPO and 8-hour RTO.
- GDPR data portability export, rectification, restriction, and anonymization toolsets.
- OpenAPI 3.1 documentation.
- Multi-school administration for onboarding subsequent institutions.
- [x] **OWASP ASVS Level 2 Verification Evidence Matrix**:
  - Comprehensive 14-chapter security audit mapping (V1 Architecture through V14 Configuration) documented in [`docs/security-owasp-asvs-l2.md`](docs/security-owasp-asvs-l2.md).
- [x] **HTTP Transport Defense & Security Headers**:
  - Enhanced headers in [`next.config.ts`](next.config.ts): Strict CSP (`default-src 'self'`), `Strict-Transport-Security` (2-year preload), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.
- [x] **Sliding-Window Rate Limiting Engine**:
  - In-memory token-bucket sliding-window rate limiter in [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts).
  - 4 security tiers: `auth` (5 req / 15m brute force protection), `sensitive` (10 req / 1m decrypt shield), `general` (120 req / 1m), `api` (60 req / 1m).
  - RFC 6585 rate limit headers generator (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`).
  - Violation audit logging and bucket prune automation.
- [x] **Operational Telemetry & Enhanced Health Diagnostics**:
  - Operational monitoring and anomaly detection engine in [`src/lib/monitoring.ts`](src/lib/monitoring.ts).
  - Health check endpoint at [`src/app/api/health/route.ts`](src/app/api/health/route.ts) reporting DB latency, memory usage (`heapUsedMb`), uptime, AES-256-GCM cipher roundtrip self-test, and active operational incidents.
- [x] **Disaster Recovery & Monthly Restore Drills**:
  - Automated restore drill runner and SLA validation in [`src/lib/drills.ts`](src/lib/drills.ts) verifying 24-hour RPO, 8-hour RTO (480m), and SHA-256 checksum integrity.
  - Automated drill execution script in [`scripts/restore-drill.sh`](scripts/restore-drill.sh).
  - Institutional disaster recovery audit register in [`docs/restore-drills-log.md`](docs/restore-drills-log.md).
- [x] **GDPR Data Subject Rights Engine (Articles 15, 16, 17, 18, 20)**:
  - Domain privacy engine in [`src/lib/gdpr.ts`](src/lib/gdpr.ts) and Server Actions in [`src/app/actions/gdpr-actions.ts`](src/app/actions/gdpr-actions.ts).
  - Machine-readable Article 20 student data portability export (JSON dossier) with statutory safeguarding non-disclosure redactions for child safety.
  - Article 17 Right to Erasure / Anonymization engine irreversibly pseudonymizing student PII while preserving regulatory academic transcripts and cohort marks.
  - Article 18 Processing Restriction toggle freezing outbound circulars and sync.
- [x] **OpenAPI 3.1.0 Institutional Specification**:
  - Formal machine-readable contract in [`docs/openapi.json`](docs/openapi.json) covering auth, student directory, attendance roll-calls, gradebook, communications, sensitive records, and GDPR.
  - API endpoint serving the schema at [`src/app/api/openapi/route.ts`](src/app/api/openapi/route.ts).
- [x] **Multi-School Tenant Administration & Onboarding**:
  - Multi-school administration engine in [`src/lib/tenant-admin.ts`](src/lib/tenant-admin.ts) and Server Actions in [`src/app/actions/tenant-actions.ts`](src/app/actions/tenant-actions.ts).
  - School provisioning wizard with schema slug validation, domain routing, and institutional onboarding readiness checklist.
  - Cross-tenant boundary verification preventing cross-school data leaks.
- [x] **Institutional Settings UI Workspace Integration**:
  - Expanded Settings module with 5 dedicated sub-tabs in [`src/components/klasso-workspace.tsx`](src/components/klasso-workspace.tsx):
    1. *Staff & Access Control* (Staff accounts, MFA status, invitations)
    2. *GDPR Privacy & Data Rights* ([`src/components/settings/gdpr-compliance-panel.tsx`](src/components/settings/gdpr-compliance-panel.tsx))
    3. *Multi-School Institutions* ([`src/components/settings/multi-school-panel.tsx`](src/components/settings/multi-school-panel.tsx))
    4. *Security & ASVS Level 2 Evidence* ([`src/components/settings/security-compliance-panel.tsx`](src/components/settings/security-compliance-panel.tsx))
    5. *OpenAPI 3.1 & Developer Reference* ([`src/components/settings/openapi-explorer-panel.tsx`](src/components/settings/openapi-explorer-panel.tsx))
  - Top bar organization switcher reflecting active school context across the institution.
- [x] **Automated Test Suite**:
  - 80/80 unit tests passing across 11 test suites in Vitest (`src/lib/rate-limit.test.ts`, `src/lib/gdpr.test.ts`, `src/lib/tenant-admin.test.ts`, `src/lib/monitoring.test.ts`, `src/lib/sensitive-records.test.ts`, `src/lib/communications.test.ts`, `src/lib/assessments.test.ts`, `src/lib/attendance.test.ts`, `src/lib/csv.test.ts`, `src/lib/sms.test.ts`, `src/lib/validation/student.test.ts`).

---

## File Map Reference

| Path | Purpose |
| :--- | :--- |
| `src/db/schema.ts` | Drizzle PostgreSQL schema (25+ tables, relations, enums) |
| `src/db/tenant.ts` | Multi-tenant organization scoping helper |
| `src/lib/auth.ts` | Better Auth configuration with Drizzle adapter and TOTP plugin |
| `src/lib/assessments.ts` | Weighted average calculations, letter grade & GPA engine, progress tracker |
| `src/lib/attendance.ts` | Daily roll-call calculations, chronic absence formulas, and CSV export |
| `src/lib/csv.ts` | RFC 4180 CSV parser and student validator |
| `src/lib/audit.ts` | Centralized audit event logging |
| `src/app/actions/assessment-actions.ts` | Server Actions for gradebook, corrections, assessments, and report cards |
| `src/app/actions/attendance-actions.ts` | Server Actions for roll-call, discrepancy corrections, and guardian excuses |
| `src/app/actions/roster-actions.ts` | Server Actions for students, guardians, classes, imports, and invites |
| `src/lib/communications.ts` | SMS segment math, template interpolator, deduplication keys, and consent model |
| `src/lib/sensitive-records.ts` | AES-256-GCM encryption, role matrices, diagnostic sanitizer, and disclosure packager |
| `src/app/actions/communication-actions.ts` | Server Actions for notices, four-eyes emergency dispatch, and consent tracking |
| `src/app/actions/sensitive-record-actions.ts` | Server Actions for sensitive cases, decryption with audit logging, court orders |
| `src/components/klasso-workspace.tsx` | Main responsive workspace UI with all Phase 1-5 modules and multi-persona switcher |
| `src/components/assessments/gradebook-module.tsx` | Interactive gradebook matrix, weights, and grade-change audit ledger |
| `src/components/assessments/report-cards-module.tsx` | Versioned report cards explorer and grading progress dashboard |
| `src/components/assessments/official-report-card-modal.tsx` | High-fidelity printable institutional transcript and report card |
| `src/components/communications/communications-module.tsx` | Circulars, emergency broadcasts, TCPA consent registry, and telco ledger |
| `src/components/sensitive/sensitive-records-module.tsx` | Master sensitive module with case management, directives, and court orders |
| `src/components/sensitive/view-case-detail-modal.tsx` | Decryption shield requiring mandatory audit justification reason |
| `src/components/sensitive/disclosure-package-modal.tsx` | High-fidelity printable institutional redacted disclosure dossier |
| `src/lib/rate-limit.ts` | Sliding-window token rate limiter with RFC 6585 headers and violation logging |
| `src/lib/monitoring.ts` | System telemetry, memory tracking, error rolling counters, and incident alerts |
| `src/lib/drills.ts` | Disaster recovery automated drill runner and RPO/RTO validation engine |
| `src/lib/gdpr.ts` | Article 15/20 portability export, safeguarding non-disclosure, Article 17 erasure |
| `src/lib/tenant-admin.ts` | Multi-school tenant provisioning, domain routing, and onboarding checklist |
| `src/app/actions/gdpr-actions.ts` | Server Actions for GDPR portability export, anonymization, and processing freeze |
| `src/app/actions/tenant-actions.ts` | Server Actions for school provisioning and onboarding checklist updates |
| `src/components/settings/gdpr-compliance-panel.tsx` | Data subject rights management panel with Article 20 JSON dossier modal |
| `src/components/settings/multi-school-panel.tsx` | Institutional school directory, tenant switcher, and provisioning wizard |
| `src/components/settings/security-compliance-panel.tsx` | OWASP ASVS Level 2 evidence, security headers, rate limits, restore drills |
| `src/components/settings/openapi-explorer-panel.tsx` | Interactive OpenAPI 3.1 endpoint browser, spec copy, and health probe |
| `docs/security-owasp-asvs-l2.md` | Comprehensive 14-chapter OWASP ASVS Level 2 verification evidence matrix |
| `docs/openapi.json` | Formal OpenAPI 3.1.0 institutional API specification |
| `docs/restore-drills-log.md` | Historical monthly disaster recovery and restore drills audit register |
| `scripts/backup.sh` | Automated pg_dump backup script with SHA-256 and retention |
| `scripts/restore.sh` | Safe checksum-verified restore script |
| `scripts/restore-drill.sh` | Automated disaster recovery restore drill execution script |
| `docs/design-system.md` | Klasso UI/UX design tokens and component standards |
| `docs/backup-and-restore.md` | Disaster recovery runbook and Coolify setup |


