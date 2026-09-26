# Comprehensive Role & Dashboard Gap Analysis

An exhaustive review of the roles, database schema, authentication policies, data loaders, server actions, and dashboard UI components across the Klassa codebase was performed.

---

## 1. Executive Summary & Core Architectural Gaps

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

### Key Architectural Findings:
1. **The Specialist Live Dashboard Lockout**:
   In [`src/app/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/page.tsx#L42-L67), when a `safeguarding_lead`, `senco`, or `health_nurse` signs in to a live school, they are met with a static placeholder:
   > *"Your school account is ready. Your membership is active. Live workflows for your role are still being connected."*
   There is **no dedicated live workspace or dashboard component** for any of these three specialist roles. Furthermore, [`saveSchoolWorkflowAction`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/actions/school-workflow-actions.ts#L10-L13) restricts workflow mutations strictly to `school_admin`, leaving specialists with no route or action to interact with sensitive records, court orders, or need-to-know alerts in live mode.
2. **Dual-System Fragmentation (Live vs Demo Mode)**:
   A rich set of specialized UI components exists in [`src/components/sensitive/`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/sensitive/) (`sensitive-records-module.tsx`, `disclosure-package-modal.tsx`, `court-order-dialog.tsx`, etc.), but they are connected only to [`klasso-workspace.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/klasso-workspace.tsx#L1474-L1476) (the demo mode workspace) and backed by server actions gated behind `requireDemoAction()`, which deliberately throws an error in live mode.
3. **Broken Report Card Access for Guardians**:
   [`src/app/reports/[id]/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/reports/%5Bid%5D/page.tsx#L12-L18) enforces `await requireStaff(["school_admin", "teacher"])`. If a parent/guardian attempts to access the printable report card URL for their child, the server throws an access denied exception.
4. **Missing Subject Teacher Assignment Workflow**:
   [`src/lib/teacher-data.ts`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/teacher-data.ts#L15-L36) relies on `teacherClassAssignments` matching `subjectId` to allow teachers to enter grades for non-homeroom classes. However, [`SchoolAdminWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-workspace.tsx#L205-L217) and [`school-admin-service.ts`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/school-admin-service.ts#L106-L108) only provide UI and commands to set the *homeroom teacher*. There is **no UI or command for assigning subject teachers to classes**.

---

## 2. In-Depth Audit by Role

---

### Role 1: `safeguarding_lead` (Designated Safeguarding Lead / DSL)

* **Current State**: No live dashboard. When authenticated, [`src/app/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/page.tsx#L64-L67) renders a "Live workflows still being connected" placeholder.
* **Access Rules**: Per [`src/lib/sensitive-records.ts`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts#L114-L146), this role has clearance for `safeguarding`, `disciplinary`, and collaborative `health_medical` areas, can manage court orders, and can manage need-to-know alerts.

#### Missing Dashboard Features & Workflows:
1. **Dedicated DSL Live Dashboard**: Missing an interactive workspace providing:
   - Active child protection concerns and case registry.
   - Status triage overview (`open`, `under_review`, `monitoring`, `closed`).
   - Audit trail of case access reasons.
2. **Encrypted Chronology & Case Note Management**:
   - Database table [`sensitiveCaseNotes`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/db/schema.ts#L577-L590) supports AES-256-GCM encryption with IV and authentication tags.
   - Missing live UI for the DSL to log timestamped concerns, upload/paste narratives, and view decrypted case chronologies with mandatory logged justification.
3. **Statutory Multi-Agency Disclosure Package Generator**:
   - [`generateDisclosurePackage()`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts#L244-L290) and [`disclosure-package-modal.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/sensitive/disclosure-package-modal.tsx) exist for generating redacted packages for child protective services, police, and family courts with cryptographic integrity checksums.
   - This capability is completely absent from the live DSL experience.
4. **Court Restrictions & Custody Orders**:
   - DSLs must log and monitor restraining orders and pickup prohibitions (`courtRestrictions` table).
   - Currently, only `school_admin` has a form to register court restrictions in live mode.
5. **Need-to-Know Alerts Dispatcher**:
   - DSLs need to issue sanitized directives to classroom teachers (e.g., *"Student may become distressed around raised voices; allow quiet corridor break"*) without leaking child protection details.

---

### Role 2: `senco` (Special Educational Needs Coordinator)

* **Current State**: No live dashboard. Stranded on the placeholder page in live mode.
* **Access Rules**: Per [`canUserAccessCaseArea`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts#L122-L123), SENCO is cleared exclusively for `special_needs` cases and barred from child protection investigations or clinical medical records.

#### Missing Dashboard Features & Workflows:
1. **SEN Register & Caseload Overview**:
   - No view to filter students by special educational needs tiers, EHCP (Education, Health and Care Plan), or Individual Learning Plans (ILP/IEP).
2. **Classroom Accommodations & Need-to-Know Directives**:
   - SENCOs must provide teachers with classroom accommodations (extra test time, front-row seating, visual timetables, sensory breaks).
   - While [`canUserManageNeedToKnow("senco")`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts#L131-L138) returns `true`, there is no dashboard or live server action for the SENCO to dispatch or resolve alerts.
3. **External Specialist Reports & Review Dates**:
   - No workflow to log educational psychologist recommendations, speech & language therapy assessments, or scheduled review cycles.
4. **Academic Performance Tracking for SEN Students**:
   - No view to cross-reference SEN students with their gradebook trends or attendance patterns to detect early academic distress.

---

### Role 3: `health_nurse` (School Nurse)

* **Current State**: No live dashboard. Stranded on the placeholder page in live mode.
* **Access Rules**: Per [`canUserAccessCaseArea`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts#L120-L121), the nurse is cleared for `health_medical` and blocked from safeguarding or SEN case notes.

#### Missing Dashboard Features & Workflows:
1. **Medical Alerts & Individual Healthcare Plans (IHP)**:
   - No interface to manage student allergies (e.g. EpiPen protocols), chronic conditions (asthma, diabetes, epilepsy), or emergency action plans.
2. **Medical Need-to-Know Alerts for Staff**:
   - Nurses must broadcast critical life-safety warnings to teachers and office staff (e.g., *"Severe nut allergy: EpiPen stored in main office and classroom pack"*). No interface exists in live mode.
3. **Daily Clinic Visit & Triage Log**:
   - No feature to record daily student infirmary visits: time in/out, presenting complaint, treatment administered (e.g., ice pack, paracetamol), and guardian notification status.
4. **Medication Administration Records (MAR)**:
   - No mechanism to track daily prescribed medications administered at school (dosage, time, administering nurse, parent permission verification).

---

### Role 4: `teacher` (Classroom & Homeroom Teacher)

* **Current State**: Has [`TeacherWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/teacher-workspace.tsx) backed by [`getTeacherData`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/teacher-data.ts).
* **Current Tabs**: `Overview`, `My classes`, `Attendance`, `Gradebook`, `Report cards`, `Notices`.

#### Missing Dashboard Features & Workflows:
1. **CRITICAL: Classroom Need-to-Know Alerts & Court Pickup Warnings**:
   - [`getTeacherData`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/teacher-data.ts#L8-L57) **does not query `needToKnowAlerts` or `courtRestrictions`**.
   - As a result, teachers standing in front of students have **zero visibility** if a child in their classroom has an acute medical alert (e.g. severe allergy), an active SEN accommodation, or a court-ordered pickup restriction preventing departure with an unauthorized person.
   - The sanitizer [`sanitizeTeacherAlert()`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts#L160-L187) was specifically developed to protect student privacy while informing teachers, but is never invoked in `TeacherWorkspace`.
2. **Subject Period Attendance**:
   - [`TeacherWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/teacher-workspace.tsx#L82-L85) restricts attendance recording exclusively to homeroom teachers during morning roll call (`homeClasses`).
   - Subject teachers who teach Periods 1 through 6 cannot record or view lesson attendance for their classes, despite `attendanceSessions.period` existing in the schema.
3. **Guardian Emergency Contacts on Roster**:
   - In the `My classes` tab, only student names and student numbers are listed. Teachers have no access to primary guardian contact info for urgent communication or field trips.
4. **Guardian Absence Notes Awareness**:
   - When taking roll call, teachers see whether a student is absent, but cannot see whether a parent already submitted an absence note explaining an illness or medical appointment.
5. **Class Announcements / Messaging**:
   - Teachers can only view school-wide notices under `Notices`. They cannot draft or publish class-level announcements to their students' guardians.
6. **Student Academic & Attendance Profiles**:
   - Teachers cannot view a student's prior term grades or historical attendance trends.

---

### Role 5: `office_staff` (School Office Staff)

* **Current State**: Has [`OfficeWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/office-workspace.tsx) backed by [`getOfficeData`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/office-data.ts).
* **Current Tabs**: `Overview`, `Students`, `Guardians`, `Attendance follow-up`, `CSV imports`, `Notices`.

#### Missing Dashboard Features & Workflows:
1. **Unified Daily Absence Follow-Up Call List**:
   - In [`office-workspace.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/office-workspace.tsx#L107-L109), attendance corrections and roll calls can only be inspected **one class at a time** via a dropdown.
   - Office staff have no unified morning call list of *all unexplained absentees across the school* with primary guardian phone numbers, contact status, and call resolution notes.
2. **Absence Note Actionability**:
   - When office staff mark a guardian absence note as "reviewed", it **does not alter the student's attendance record** (e.g. converting `absent` to `excused`). Staff must separately navigate to the class roll call to make the correction manually.
3. **Medical Need-to-Know Alerts**:
   - [`getOfficeData`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/office-data.ts#L3-L37) queries `courtRestrictions` for pickup warnings, but **does not query `needToKnowAlerts`**.
   - Front office staff (who administer first aid when the nurse is off-site and handle medication drop-offs) cannot see student health protocols.
4. **Communications & Emergency Alerts**:
   - Office staff can only read announcements. They cannot draft notices, trigger emergency broadcasts, or send SMS notifications to guardians, despite handling parent inquiries.
5. **Front Desk Visitor & Late Arrivals Desk**:
   - No log for students arriving late to sign in at the front desk or visitors entering the building.
6. **Printable Emergency Roll Call Sheets**:
   - No one-click export or printable PDF roster for fire drills and evacuations.

---

### Role 6: `school_admin` (School Administrator / Principal)

* **Current State**: Has comprehensive [`SchoolAdminWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-workspace.tsx) and [`SchoolAdminWorkflows`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-workflows.tsx).
* **Current Tabs**: `Overview`, `Students`, `Guardians`, `Staff & access`, `Classes & grades`, `Subjects`, `Academic years`, `Attendance`, `Gradebook`, `Report cards`, `Communications`, `Sensitive records`, `Audit history`, `School settings`.

#### Missing Dashboard Features & Workflows:
1. **Subject Teacher Class Assignments (`teacherClassAssignments`)**:
   - Admin can assign a `homeroomTeacherId` to a class, but there is **no UI, editor, or policy command** to assign subject teachers to classes (e.g. assigning Teacher X to teach Science to Class 9A).
   - Because `getTeacherData` checks `teacherClassAssignments.subjectId`, non-homeroom teachers cannot grade assessments without this assignment existing.
2. **Unrendered Data on Overview Dashboard**:
   - [`getSchoolAdminData()`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/school-admin-data.ts#L41-L52) queries `activeAlerts`, `activeRestrictions`, and `attendanceSummary`.
   - However, [`SchoolAdminWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-workspace.tsx#L90-L112)'s `overview` section **never displays these items**. Daily attendance rates, persistent absenteeism flags, and active safeguarding counts are absent from the main dashboard.
3. **Guardian Absence Notes Oversight**:
   - Absence notes submitted by guardians are rendered in the office workspace, but the school administrator cannot review absence note trends or unresolved disputes.
4. **GDPR / SAR (Subject Access Request) Management**:
   - The database contains [`gdprRequests`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/db/schema.ts#L646-L665) and [`gdpr-compliance-panel.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/settings/gdpr-compliance-panel.tsx) exists in the repository.
   - However, the live `SchoolAdminWorkspace` has no GDPR tab or interface to fulfill data export requests (data portability) or erasure requests.
5. **Emergency Broadcasts & Parent SMS**:
   - The communications tab supports in-app announcements only. There is no trigger for emergency SMS broadcasts (`smsDispatches` table) in case of school closures or severe weather.
6. **Academic Term Closure & Grade Lock**:
   - No workflow to lock all gradebooks and attendance sessions at the conclusion of a term to prevent historical modifications.

---

### Role 7: `guardian` (Parent / Family Portal)

* **Current State**: Has [`GuardianPortalWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/guardian-portal-workspace.tsx) backed by [`getGuardianPortalData`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/guardian-portal-data.ts).
* **Current Features**: Student cards, recent attendance history, published report card breakdown, absence note submission, published notices.

#### Missing Dashboard Features & Workflows:
1. **CRITICAL: Official Printable Report Card Access**:
   - [`src/app/reports/[id]/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/reports/%5Bid%5D/page.tsx#L13) restricts report cards with `requireStaff(["school_admin", "teacher"])`.
   - Guardians cannot access or print their student's official PDF/report card view.
   - Furthermore, `GuardianPortalWorkspace` only renders subject grades in an inline list without any link to open the full official report card.
2. **Consent Management**:
   - Database table [`guardianConsents`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/db/schema.ts#L528-L541) tracks consents (`photo_consent`, `excursion_consent`, `digital_learning_consent`, etc.), grant dates, and withdrawal dates.
   - The Guardian Portal provides **no interface to view or sign school consents**.
3. **Two-Way School Messaging**:
   - Guardians can only submit absence notes. They have no channel to send general inquiries to their student's homeroom teacher or the school office.
4. **Timetable & School Calendar**:
   - No daily timetable view showing which classes their student has today, and no calendar of upcoming school holidays or term dates.
5. **Profile & Emergency Contact Verification**:
   - Guardians cannot view or request corrections to their telephone numbers, home addresses, or alternative emergency contact listings.

---

### Role 8: `platform_admin` (Platform Superadministrator / Multi-School Admin)

* **Current State**: Has [`PlatformInvitations`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/platform-invitations.tsx) and [`platform/schools/[id]`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/platform/schools/%5Bid%5D/page.tsx).
* **Current Tabs**: `Overview`, `Schools`, `Users & access`, `Audit log`, `Security`, `System health`.

#### Missing Dashboard Features & Workflows:
1. **Disaster Recovery & Backup Drills Log**:
   - Database table [`restoreDrills`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/db/schema.ts#L667-L686) tracks backup verification, RTO (Recovery Time Objective), RPO (Recovery Point Objective), table counts, and integrity status, documented in [`docs/backup-and-restore.md`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/docs/backup-and-restore.md).
   - There is **no UI on the platform console** to view, record, or verify disaster recovery drills.
2. **Tenant Full Data Portability / Export**:
   - Platform admins cannot trigger a full school data export (database archive or GDPR tenant transfer) from the UI.
3. **Cross-School Guardian Search**:
   - The `Users & access` tab searches staff memberships only. If a parent encounters authentication problems, platform admins have no search tool for guardian accounts.
4. **Platform-Wide Announcement / Maintenance Banner**:
   - No facility to broadcast platform-wide maintenance notifications to staff across all schools.

---

## 3. Comparative Capability Matrix

| Role | Dedicated Live Dashboard | Attendance Tracking | Gradebook & Reports | Sensitive Records | Communications | Staff / School Mgmt | Key Missing Capabilities |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`safeguarding_lead`** | ❌ No | ❌ | ❌ | ❌ (Blocked) | ❌ | ❌ | Complete live dashboard, case chronology, court orders, disclosure packages |
| **`senco`** | ❌ No | ❌ | ❌ | ❌ (Blocked) | ❌ | ❌ | Complete live dashboard, SEN register, IEP accommodations, teacher directives |
| **`health_nurse`** | ❌ No | ❌ | ❌ | ❌ (Blocked) | ❌ | ❌ | Complete live dashboard, medical care plans, clinic visit log, allergy alerts |
| **`teacher`** | ⚠️ Partial | ⚠️ Morning only | ✅ Yes | ❌ Blocked | ⚠️ Read only | ❌ | **Need-to-know health/safety alerts**, period attendance, parent contacts |
| **`office_staff`** | ⚠️ Partial | ⚠️ Class-by-class | ❌ | ⚠️ Pickup orders | ⚠️ Read only | ⚠️ Student intake | Unified morning absence call list, absence note resolution, SMS/broadcasts |
| **`school_admin`** | ✅ Comprehensive | ✅ Full | ✅ Full | ⚠️ Generic only | ⚠️ In-app only | ⚠️ Homeroom only | **Subject teacher assignments**, overview alert metrics, GDPR requests |
| **`guardian`** | ⚠️ Partial | ⚠️ Student history | ⚠️ Summary only | ❌ | ⚠️ Read notices | ❌ | **Printable report cards (`/reports/[id]`)**, consent management, messaging |
| **`platform_admin`** | ✅ Comprehensive | ❌ (By design) | ❌ (By design) | ❌ (By design) | ❌ | ✅ Full | Disaster recovery / restore drills log, tenant export, guardian account lookup |

---

## 4. Database Schema vs Dashboard Exposure Matrix

The following database tables are defined in [`src/db/schema.ts`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/db/schema.ts) but have gaps in their dashboard exposure:

| Database Table | Roles Authorized in Domain | Currently Surfaced In Dashboard | Dashboard Gap |
| :--- | :--- | :--- | :--- |
| `teacherClassAssignments` | `school_admin`, `teacher` | Partial (homeroom only) | **Subject assignments cannot be created/edited in admin UI** |
| `needToKnowAlerts` | `safeguarding_lead`, `senco`, `health_nurse`, `school_admin`, `teacher`, `office_staff` | `SchoolAdminWorkflows`, `SchoolAdminStudentDirectory` | **Never shown to Teachers, Office Staff, or Specialists** |
| `courtRestrictions` | `safeguarding_lead`, `school_admin`, `office_staff`, `teacher` | `SchoolAdminWorkflows`, `OfficeWorkspace` | **Never loaded or shown to Teachers** |
| `sensitiveCases` | `safeguarding_lead`, `senco`, `health_nurse`, `school_admin` | `SchoolAdminWorkflows` | **Locked out from DSL, SENCO, and Nurse** |
| `sensitiveCaseNotes` | `safeguarding_lead`, `senco`, `health_nurse`, `school_admin` | `SchoolAdminWorkflows` | **Locked out from DSL, SENCO, and Nurse** |
| `guardianConsents` | `guardian`, `school_admin`, `office_staff` | None | **Orphaned: No UI in Guardian Portal or Admin** |
| `gdprRequests` | `school_admin`, `platform_admin` | Demo workspace only | **Orphaned from live School Admin settings** |
| `restoreDrills` | `platform_admin` | None | **Orphaned: No UI on Platform console** |
| `smsDispatches` | `school_admin`, `office_staff` | Demo workspace only | **No live broadcast/SMS trigger** |
| `guardianAbsenceNotes` | `office_staff`, `school_admin`, `teacher`, `guardian` | `OfficeWorkspace`, `GuardianPortalWorkspace` | **Hidden from Teachers and School Admins** |

---

## 5. Recommended Priority Remediation Plan

### High Priority (Functional & Safety Blockers)
1. **Unblock Specialist Dashboards**:
   - Create a specialized workspace or tabbed views for `safeguarding_lead`, `senco`, and `health_nurse` in [`src/app/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/page.tsx).
   - Implement data loaders (`getSafeguardingData`, `getSencoData`, `getHealthNurseData`) adhering strictly to the area permissions in [`canUserAccessCaseArea`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/sensitive-records.ts#L114-L129).
   - Update [`saveSchoolWorkflowAction`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/actions/school-workflow-actions.ts#L10-L13) and [`saveSchoolWorkflow`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/school-workflow-service.ts#L22) to authorize `safeguarding_lead`, `senco`, and `health_nurse` for sensitive records and alerts.
2. **Inject Need-to-Know Alerts & Court Restrictions into Teacher Dashboard**:
   - Update [`getTeacherData`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/teacher-data.ts) to query active `needToKnowAlerts` and `courtRestrictions` for students enrolled in the teacher's classes.
   - Render sanitized alert badges (medical, SEN, pickup restrictions) on student rosters in [`TeacherWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/teacher-workspace.tsx).
3. **Fix Report Card Access for Guardians**:
   - Update [`src/app/reports/[id]/page.tsx`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/app/reports/%5Bid%5D/page.tsx#L13) to allow guardians who have a verified legal link (`hasLegalResponsibility = true`) to the student.
   - Add an *"Open printable report card"* link to [`GuardianPortalWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/guardian-portal-workspace.tsx).
4. **Implement Subject Teacher Assignment Interface**:
   - Add `teacher_subject_assignment` command to [`schoolCommandSchema`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/school-admin-policy.ts#L8-L23) and [`school-admin-service.ts`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/lib/school-admin-service.ts).
   - Add an assignment modal/table in `SchoolAdminWorkspace` under `Classes & grades` or `Subjects` so subject teachers can be granted gradebook access.

### Medium Priority (Operational Efficiency)
5. **Office Staff Unified Absence Call Sheet & Note Actionability**:
   - Provide a unified "Today's Unexplained Absences" table with one-click guardian phone calling.
   - Add a *"Convert note to excused absence"* action directly on guardian absence notes.
6. **Surface Admin Overview Metrics**:
   - Wire `data.activeAlerts`, `data.activeRestrictions`, and `data.attendanceSummary` into the KPI cards of [`SchoolAdminWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/school-admin-workspace.tsx#L90-L96).
7. **Guardian Consent Management**:
   - Add a "School Consents" panel to [`GuardianPortalWorkspace`](file:///c:/Users/admin/Desktop/WEB/gradia-klasso/src/components/guardian-portal-workspace.tsx) querying `guardianConsents` to allow parents to grant/revoke media and excursion permissions.
8. **Live GDPR & SAR Panel**:
   - Integrate `gdpr-compliance-panel.tsx` into live `SchoolAdminWorkspace` under `School settings` to support data portability exports.

### Low Priority (Platform & Governance)
9. **Platform Console Disaster Recovery Drills**:
   - Add a "Disaster Recovery" card in `PlatformInvitations` under `System health` rendering records from the `restoreDrills` table.
10. **Period Attendance Expansion**:
    - Extend `TeacherWorkspace` to allow selecting session periods beyond `morning_roll_call`.
