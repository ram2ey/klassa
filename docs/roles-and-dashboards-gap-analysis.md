# Comprehensive Role & Dashboard Gap Analysis

An exhaustive review of the roles, database schema, authentication policies, data loaders, server actions, and dashboard UI components across the Klassa codebase.

*Last Updated: 2026-09-26 (Audit & Progress Tracking)*

---

## 1. System Role Taxonomy & Architecture

The codebase defines **8 distinct user roles** across three authorization tiers (Platform Administration, School Staff, and Family/Guardian):

```mermaid
flowchart TD
    subgraph Platform Tier
        PA["Platform Admin<br/>(isPlatformAdmin)"]
    end
    subgraph School Staff Tier (staff_role enum)
        SA["School Admin<br/>(school_admin)"]
        OS["Office Staff<br/>(office_staff)"]
        T["Teacher<br/>(teacher)"]
        SL["Safeguarding Lead<br/>(safeguarding_lead)"]
        SENCO["SENCO<br/>(senco)"]
        HN["Health Nurse<br/>(health_nurse)"]
    end
    subgraph Family Tier
        G["Parent / Guardian<br/>(guardian via studentGuardians)"]
    end
```

### High-Priority Architectural Remediations Delivered:
1. **Live Specialist Workspaces Unblocked**:
   [`src/app/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/page.tsx#L68-L72) now actively routes `safeguarding_lead`, `senco`, and `health_nurse` to [`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx), backed by [`getSpecialistData()`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/specialist-data.ts) and role-specific case area isolation.
2. **Classroom Safety Notices & Period Attendance for Teachers**:
   [`TeacherWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/teacher-workspace.tsx) now loads and renders sanitized need-to-know directives, pickup restrictions, guardian contact data, student history context, and period attendance selection (`period_1` to `period_8`).
3. **Office Morning Absence Follow-Up & Emergency Sheets**:
   [`OfficeWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/office-workspace.tsx) now includes a school-wide daily unexplained absence roster with click-to-call phone links, one-click absence review & excuse, medical directives, and printable emergency roll sheets at [`/office/emergency-roll`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/office/emergency-roll/page.tsx).
4. **Subject Teacher Class Assignments & Live GDPR Panel**:
   [`SchoolAdminWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-workspace.tsx) now features subject teacher class assignment management (`teacherClassAssignments`), overview safety & attendance KPI metrics, and a live Data Protection & GDPR panel ([`SchoolAdminGdprPanel`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-gdpr-panel.tsx)).
5. **Guardian Report Card Printing & Consent Management**:
   [`src/app/reports/[id]/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/reports/%5Bid%5D/page.tsx) now authorizes verified legal guardians, and [`GuardianPortalWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/guardian-portal-workspace.tsx) embeds [`GuardianSchoolConsents`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/guardian-school-consents.tsx) for managing photo, excursion, and digital learning consents.
6. **Platform Disaster Recovery Drills, Tenant Export & Search**:
   [`PlatformInvitations`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/platform-invitations.tsx) now surfaces [`PlatformRestoreDrills`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/platform-restore-drills.tsx), full tenant JSON data export at [`/platform/schools/[id]/export`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/platform/schools/%5Bid%5D/export/route.ts), cross-school guardian account search, and platform-wide maintenance broadcasting.

---

## 2. In-Depth Audit by Role: Added vs. Pending

---

### Role 1: `safeguarding_lead` (Designated Safeguarding Lead / DSL)

* **Current Status**: **Active Live Workspace** ([`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx)).
* **Access Clearance**: Authorized for `["safeguarding", "disciplinary", "health_medical"]` case areas, court orders, and staff directives per [`canUserAccessCaseArea`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts#L114-L129).

#### What Has Been Added:
1. **Live Dedicated Workspace**:
   - Routed in [`src/app/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/page.tsx#L68-L72) to [`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx) backed by [`getSpecialistData()`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/specialist-data.ts).
2. **Case Registry & Encrypted Chronology**:
   - Ability to register cases in permitted areas, add AES-256-GCM encrypted notes ([`sensitiveCaseNotes`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/db/schema.ts#L577-L590)), decrypt notes with mandatory audit reasons, and manage case statuses (`open`, `under_review`, `monitoring`, `closed`).
3. **Court Restrictions & Custody Orders**:
   - Dedicated `Court restrictions` tab allowing the DSL to register, enforce, and deactivate restraining orders, custody restrictions, and pickup prohibitions ([`courtRestrictions`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/db/schema.ts#L625-L644)).
4. **Staff Directives (Need-to-Know)**:
   - Interface to create and resolve actionable classroom directives without exposing sensitive background case notes.
5. **Workflow Action Clearance**:
   - [`saveSchoolWorkflowAction`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/actions/school-workflow-actions.ts#L10) and [`saveSchoolWorkflow`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/school-workflow-service.ts#L22) now authorize `safeguarding_lead`.
6. **Statutory Multi-Agency Disclosure Package Generator**:
   - Integrated [`generateDisclosurePackage()`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts) and [`disclosure-package-modal.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/sensitive/disclosure-package-modal.tsx) into [`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx) under dedicated "Statutory disclosures" tab, supporting dynamic tenant branding, recipient agency metadata, digital SHA-256 integrity seal, and official print view.

#### What Remains Pending:
1. **Low-Level Concern Triage Queue**:
   - Standard safeguarding workflow (CPOMS/MyConcern style) where teachers submit low-level concerns for DSL triage before formal case creation.

---

### Role 2: `senco` (Special Educational Needs Coordinator)

* **Current Status**: **Active Live Workspace** ([`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx)).
* **Access Clearance**: Restricted strictly to `["special_needs"]` cases; barred from child protection investigations and clinical medical records.

#### What Has Been Added:
1. **Live Dedicated Workspace**:
   - SENCO dashboard active in [`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx) labeled "SENCO workspace".
2. **Privacy Boundary Enforcement**:
   - Scoped strictly to `special_needs` cases; cannot view safeguarding or disciplinary files.
3. **Case Management & Support Notes**:
   - Create special needs cases, record encrypted intervention notes, and review access logs.
4. **Staff Classroom Directives**:
   - Create actionable classroom accommodations and teaching strategies for classroom teachers.

#### What Remains Pending:
1. **Formal SEN Register & Support Tiers**:
   - Multi-tiered support tracking (Universal, Targeted, Specialist / EHCP / Tier 1-3).
2. **Structured Individual Education Plans (IEP/ILP)**:
   - Dedicated structured fields for exam concessions (25% extra time, reader, rest breaks, assistive tech) rather than plain-text directives.
3. **Statutory Review Calendar & External Agency Tracking**:
   - Review date scheduling and tracking for educational psychologist or speech & language therapy assessments.

---

### Role 3: `health_nurse` (School Nurse)

* **Current Status**: **Active Live Workspace** ([`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx)).
* **Access Clearance**: Restricted strictly to `["health_medical"]` cases; barred from safeguarding investigations or SEN records.

#### What Has Been Added:
1. **Live Dedicated Workspace**:
   - School nurse dashboard active in [`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx).
2. **Medical Cases & Care Plans**:
   - Record chronic conditions (asthma, epilepsy, severe allergies, diabetes) and encrypted clinical notes.
3. **Emergency Medical Directives**:
   - Create life-safety directives (EpiPen locations, seizure action plans) which now surface directly to **Teacher class rosters** and **Office attendance dashboards**.
4. **Daily Clinic Drop-In & Triage Log**:
   - Dedicated "Clinic triage log" tab in [`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx) backed by `clinicVisits` table with `clinicVisitOutcome` enum (returned to class, sent home, emergency referral, etc.), presenting symptoms, triage treatment, guardian notification logging, and institutional audit trail.

#### What Remains Pending:
1. **Medication Administration Records (MAR)**:
   - Daily log tracking scheduled prescription medications administered on campus.

---

### Role 4: `teacher` (Classroom & Homeroom Teacher)

* **Current Status**: **Active Live Workspace** ([`TeacherWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/teacher-workspace.tsx)).
* **Current Tabs**: `Overview`, `My classes`, `Attendance`, `Gradebook`, `Report cards`, `Notices`.

#### What Has Been Added:
1. **Classroom Safety Notices & Pickup Warnings**:
   - Class rosters display sanitized medical/SEN alert badges and court-ordered pickup restriction alerts via [`StudentSafety`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/teacher-safety.ts).
   - Overview banner warns when students in assigned classes have active safety notices.
2. **Student Context & Guardian Contacts**:
   - Roster includes guardian names, emergency phone numbers, email addresses, and past attendance/report card history via `StudentContext`.
3. **Period Attendance**:
   - Subject teachers can take attendance for lesson periods (`period_1` through `period_8`, `afternoon_roll_call`), not just morning roll call.
4. **Guardian Absence Notes Banner**:
   - Attendance tab displays incoming guardian absence notes for students on that date.
5. **Class Announcements**:
   - Teachers can draft and publish class announcements directly to their assigned classes.
6. **Praise & Incident Behaviour Logging**:
   - Conduct tracking interface in [`TeacherWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/teacher-workspace.tsx) via `studentBehaviours` table and `behaviour_log` command:
     - Log positive merits (Academic Excellence, Helpful Citizen, Leadership, Creativity) and negative sanctions (Disruption, Incomplete Homework, Disrespect, Safety Infraction).
     - Point modifiers (+1 to +5, -1 to -5) and guardian portal visibility toggle.
     - Merits badge on student roster rows and summary metrics on Overview.

#### What Remains Pending:
1. **Student Academic Detail Drawer**:
   - Visual multi-term grade trend graphs and full historical academic transcript view.

---

### Role 5: `office_staff` (School Office Staff)

* **Current Status**: **Active Live Workspace** ([`OfficeWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/office-workspace.tsx)).
* **Current Tabs**: `Overview`, `Students`, `Guardians`, `Attendance follow-up`, `Reception desk`, `CSV imports`, `Notices`.

#### What Has Been Added:
1. **Unified Daily Absence Follow-Up Call List**:
   - Dedicated `Unexplained absences for ${date}` roster listing all absentees across all classes lacking a parent note, with click-to-call telephone and email links.
2. **One-Click Absence Review & Excuse**:
   - Absence note cards include a "Review and excuse" button ([`reviewAndExcuseGuardianAbsenceAction`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/actions/office-actions.ts)) that excuses the attendance record and reviews the note in one transaction.
3. **Active Medical Directives Banner**:
   - Displays critical student health directives on overview and attendance tabs.
4. **Printable Emergency Evacuation Roll Sheets**:
   - Added [`/office/emergency-roll`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/office/emergency-roll/page.tsx) with clean printable roll sheets grouped by class with checkboxes, medical notices, and pickup warnings.
5. **Reception Desk Late-Arrival & Early Departure Desk**:
   - Added dedicated `Reception desk` tab in [`OfficeWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/office-workspace.tsx) backed by `receptionLogs` table:
     - Late arrival check-in automatically updates morning roll call attendance marks to `late`, records minutes tardy and reasons, and issues audited correction slips.
     - Early departure sign-out cross-checks court pickup prohibitions (`courtRestrictions`), displaying safeguarding alerts and blocking pickup by prohibited adults.
     - Chronological reception movement register for the date.
6. **Emergency Parent SMS Broadcast Trigger**:
   - Direct SMS dispatch interface in [`OfficeWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/office-workspace.tsx) via `smsDispatches` with severity levels, scope targeting (whole school, grade, class), live GSM-7/Unicode segment counter, safety confirmation guard, and recent broadcast log.

#### What Remains Pending:
1. **Medication Administration Tracking (Front Office backup)**:
   - Secondary intake view for medications delivered to front desk for clinic transfer.

---

### Role 6: `school_admin` (School Administrator / Principal)

* **Current Status**: **Active Live Workspace** ([`SchoolAdminWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-workspace.tsx)).
* **Current Tabs**: `Overview`, `Students`, `Guardians`, `Staff & access`, `Classes & grades`, `Subjects`, `Academic years`, `Attendance`, `Gradebook`, `Report cards`, `Communications`, `Sensitive records`, `Audit history`, `School settings`.

#### What Has Been Added:
1. **Subject Teacher Class Assignments**:
   - Added `teacher_subject_assignment` command and management UI in `Classes & grades` to assign teachers to specific subjects across classes.
2. **Overview Safety & Attendance KPI Metrics**:
   - Overview dashboard renders KPI cards for Active safety alerts, Enforced court restrictions, School-wide attendance rate %, and Unexcused absence totals.
   - Guardian absence note queue displayed on the overview dashboard.
3. **Live GDPR & SAR Data Rights Panel**:
   - Integrated [`SchoolAdminGdprPanel`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-gdpr-panel.tsx) into `School settings` to handle Subject Access Requests, data portability exports, and erasure requests.
4. **Emergency SMS Broadcast Dispatch**:
   - Integrated [`EmergencySmsBroadcast`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/emergency-sms-broadcast.tsx) into `Communications` tab via `smsDispatches` supporting whole-school, grade, and class emergency alerts with safety confirmation guards and delivery logs.

#### What Remains Pending:
1. **Term Closure & Gradebook Seal**:
   - School-wide lock to seal all gradebooks and attendance sessions at term completion.

---

### Role 7: `guardian` (Parent / Family Portal)

* **Current Status**: **Active Live Workspace** ([`GuardianPortalWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/guardian-portal-workspace.tsx)).
* **Current Features**: Student cards, recent attendance, published report cards, absence notes, school notices.

#### What Has Been Added:
1. **Printable Official Report Card Access**:
   - [`src/app/reports/[id]/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/reports/%5Bid%5D/page.tsx) updated to authorize verified legal guardians.
   - Portal includes "Open printable report card" links for all published report cards.
2. **School Consent Management**:
   - Embedded [`GuardianSchoolConsents`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/guardian-school-consents.tsx) allowing parents to grant or revoke photo, excursion, and digital learning permissions.

#### What Remains Pending:
1. **Two-Way School / Teacher Messaging**:
   - Direct inquiry messaging with homeroom teachers beyond absence notes.
2. **Daily Period Timetable**:
   - Student schedule view showing periods and classroom locations.

---

### Role 8: `platform_admin` (Platform Superadministrator)

* **Current Status**: **Active Live Workspace** ([`PlatformInvitations`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/platform-invitations.tsx)).
* **Current Tabs**: `Overview`, `Schools`, `Users & access`, `Audit log`, `Security`, `System health`.

#### What Has Been Added:
1. **Disaster Recovery & Restore Drills Visibility**:
   - Embedded [`PlatformRestoreDrills`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/platform-restore-drills.tsx) on `System health` tab displaying verified table counts, RTO, RPO, and backup timestamps from `restoreDrills`.
2. **Tenant Full Data Portability / Export**:
   - Added [`/platform/schools/[id]/export`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/platform/schools/%5Bid%5D/export/route.ts) allowing platform admins to download an audited JSON export of any school.
3. **Cross-School Guardian Search**:
   - Added [`PlatformGuardianSearch`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/platform-guardian-search.tsx) to find guardian accounts across all schools.
4. **Platform-Wide Announcement**:
   - Added [`PlatformAnnouncement`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/platform-announcement.tsx) to broadcast platform maintenance notices to all schools simultaneously.

#### What Remains Pending:
1. **Automated Drill Execution from UI**:
   - Direct button on console to trigger automated restore drills without running CLI scripts.

---

## 3. Updated Comparative Capability Matrix

| Role | Dedicated Live Dashboard | Attendance Tracking | Gradebook & Reports | Sensitive Records | Communications | Staff / School Mgmt | Key Remaining Gaps |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`safeguarding_lead`** | ✅ Active | ❌ | ❌ | ✅ Active (DSL scoped) | ⚠️ Read notices | ✅ Statutory disclosures & court admin | Low-level concern triage queue |
| **`senco`** | ✅ Active | ❌ | ❌ | ✅ Active (SEN scoped) | ⚠️ Read notices | ⚠️ Case / directive admin | Formal SEN register tiers; IEP review date scheduling |
| **`health_nurse`** | ✅ Active | ❌ | ❌ | ✅ Active (Health scoped)| ⚠️ Read notices | ✅ Clinic triage log & health admin | Prescription medication administration record (MAR) |
| **`teacher`** | ✅ Active | ✅ Period & morning | ✅ Yes | ⚠️ Safety alerts & pickup | ✅ Class & school notices | ❌ | Historical transcript drawer |
| **`office_staff`** | ✅ Active | ✅ Full absence follow-up | ❌ | ⚠️ Pickup & medical alerts | ✅ Emergency SMS trigger | ✅ Intake, emergency rolls & reception desk | Front desk clinic medication intake log |
| **`school_admin`** | ✅ Active | ✅ Full oversight | ✅ Full | ✅ Full | ✅ Emergency SMS trigger | ✅ Full + Subject assignments + GDPR | Bulk term-end gradebook lock |
| **`guardian`** | ✅ Active | ⚠️ Student history | ✅ Printable report cards | ❌ | ⚠️ Read notices | ⚠️ School consents | Direct 2-way messaging with teacher; student daily period timetable view |
| **`platform_admin`** | ✅ Active | ❌ (By design) | ❌ (By design) | ❌ (By design) | ✅ Platform-wide notice | ✅ Full + Restore drills + Tenant export | Direct UI trigger for automated restore drill execution |

---

## 4. Database Schema vs Dashboard Exposure Matrix

| Database Table | Roles Authorized in Domain | Surfaced In Dashboard | Current Status |
| :--- | :--- | :--- | :--- |
| `teacherClassAssignments` | `school_admin`, `teacher` | `SchoolAdminWorkspace`, `TeacherWorkspace` | **Connected**: Subject teacher assignments fully editable |
| `needToKnowAlerts` | `safeguarding_lead`, `senco`, `health_nurse`, `school_admin`, `teacher`, `office_staff` | `SpecialistWorkspace`, `TeacherWorkspace`, `OfficeWorkspace`, `SchoolAdminWorkspace` | **Connected**: Broadcasted across staff workspaces |
| `courtRestrictions` | `safeguarding_lead`, `school_admin`, `office_staff`, `teacher` | `SpecialistWorkspace`, `TeacherWorkspace`, `OfficeWorkspace`, `SchoolAdminWorkspace` | **Connected**: Pickup prohibitions visible to staff |
| `clinicVisits` | `health_nurse`, `school_admin` | `SpecialistWorkspace` | **Connected**: Daily drop-in triage and visit log |
| `receptionLogs` | `office_staff`, `school_admin` | `OfficeWorkspace` | **Connected**: Front desk late arrival & early departure register |
| `studentBehaviours` | `teacher`, `school_admin` | `TeacherWorkspace`, `SchoolAdminWorkspace` | **Connected**: Praise merit points & incident sanction logging |
| `sensitiveCases` | `safeguarding_lead`, `senco`, `health_nurse`, `school_admin` | `SpecialistWorkspace`, `SchoolAdminWorkflows` | **Connected**: Scoped by role area clearance |
| `sensitiveCaseNotes` | `safeguarding_lead`, `senco`, `health_nurse`, `school_admin` | `SpecialistWorkspace`, `SchoolAdminWorkflows` | **Connected**: Encrypted notes with access logs |
| `guardianConsents` | `guardian`, `school_admin`, `office_staff` | `GuardianPortalWorkspace` | **Connected**: Guardians can toggle school consents |
| `gdprRequests` | `school_admin`, `platform_admin` | `SchoolAdminWorkspace` | **Connected**: Live school data rights panel |
| `restoreDrills` | `platform_admin` | `PlatformInvitations` | **Connected**: Disaster recovery drills visible |
| `guardianAbsenceNotes` | `office_staff`, `school_admin`, `teacher`, `guardian` | `OfficeWorkspace`, `TeacherWorkspace`, `SchoolAdminWorkspace`, `GuardianPortalWorkspace` | **Connected**: Visible across all relevant roles |
| `smsDispatches` | `school_admin`, `office_staff` | `SchoolAdminWorkspace`, `OfficeWorkspace` | **Connected**: Live emergency SMS broadcast trigger and audit history |

---

## 5. Prioritized Roadmap for Remaining Work

1. **[COMPLETED] Safeguarding Multi-Agency Disclosure Package**:
   Integrated [`generateDisclosurePackage`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts) and [`disclosure-package-modal.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/sensitive/disclosure-package-modal.tsx) into [`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx) for `safeguarding_lead`.
2. **[COMPLETED] Health Nurse Daily Clinic Drop-In & Triage Log**:
   Added `clinicVisits` table, triage workflow (`clinic_visit` command), and UI tab in [`SpecialistWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/specialist-workspace.tsx) for `health_nurse`.
3. **[COMPLETED] Office Staff Reception Late-Arrival & Early Departure Desk**:
   Added `receptionLogs` table, `reception_log` command, court restriction pickup check, automatic attendance sync, and dedicated `Reception desk` tab in [`OfficeWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/office-workspace.tsx) for `office_staff`.
4. **[COMPLETED] Emergency SMS Broadcast Dispatch**:
   Added `emergency_sms_broadcast` policy & workflow service, [`EmergencySmsBroadcast`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/emergency-sms-broadcast.tsx) component, and dispatch integration into [`SchoolAdminWorkflows`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-workflows.tsx) and [`OfficeWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/office-workspace.tsx) for `school_admin` and `office_staff`.
5. **[COMPLETED] Teacher Behaviour Praise & Incident Point Logging**:
   Added `studentBehaviours` table, `behaviour_log` command & service, and interactive conduct logger in [`TeacherWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/teacher-workspace.tsx) and [`SchoolAdminWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-workspace.tsx).
6. **Guardian Two-Way Messaging & Student Timetable**:
   Add inquiry messaging and daily class schedules to `GuardianPortalWorkspace`.
