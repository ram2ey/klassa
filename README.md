# Klassa

Klassa is a secure K–12 school administration system. Phase 1 establishes the institutional design system, student and guardian records, enrollment history, CSV-import foundations, audit events, administrator-provisioned authentication, and a deployment baseline for Coolify.

## Local development

1. Copy `.env.example` to both `.env.local` (Next.js) and `.env` (local Compose), then replace every placeholder you use.
2. Start PostgreSQL with `docker compose -f compose.local.yaml up -d`, or point `DATABASE_URL` at an existing PostgreSQL 17 database.
3. Run `npm run db:migrate`. Use `npm run db:generate` only after intentionally changing the schema.
4. Start Klassa with `npm run dev`.

The local demo uses representative records. In live mode, school administrators have a database-connected workspace for school administration. Better Auth is mounted at `/api/auth/[...all]`; public registration is disabled and platform administrator MFA is provided through the TOTP plugin.

### Preview and live boundaries

For the synthetic local preview, set `KLASSO_DEMO_MODE=true` in `.env.local` and run `npm run dev`. Demo actions never write to PostgreSQL. Preview changes remain temporary and are shared by visitors to that local server; use synthetic information only. Roster changes are loaded from the server on refresh, but restarting the server resets the demo.

Demo mode is rejected in production. With demo mode disabled, the home page requires an existing staff account and school membership. Platform administrators also need enabled MFA. Live roster reads, student enrollment and status updates use PostgreSQL and enforce the authenticated organization. Enrollment requires an existing class/grade in the school's current academic year. Mutations and their audit entries commit atomically. Database errors are never converted into successful demo writes.

The older demo action routes for attendance, assessments, communications and sensitive records remain preview-only; the live school administrator sections use separate school-scoped actions. GDPR workflows and the old school-provisioning preview remain local demonstrations. Anonymization is unavailable even in the preview: it cannot yet erase all related records and must not mark requests complete. Emergency approvals are simulations; live SMS, scheduled delivery and guardian messaging are not connected. SMS simulations have zero cost and are not marked delivered.

### Live school administrator workspace

School administrators land on the school overview at `/`. Navigation links use `?section=` so sections can be bookmarked. The workspace includes:

- Overview: real student, staff, class and guardian counts, school setup checklist, and recent activity.
- Students: search, filter, sort and page through the directory; inspect profiles with enrollment history, submitted attendance summaries and published report-card summaries; see record-completeness and restricted-record indicators; export all filtered or selected students; and bulk update status or current-year class placement (up to 100 students, with one audited transaction). Staff can also enroll, edit and import validated CSV files. The enrollment wizard captures the student, class, new or existing guardian contacts, and optional category-only sensitive referrals in one transaction. Klassa assigns a permanent school-specific number such as `ST-000001` when a student is created.
- Guardians: create and edit optional contact details, link students, and maintain primary-contact and legal-responsibility flags.
- Staff & access: create tenant username accounts, list staff, and change school roles. Administrators cannot change their own role.
- Classes & grades: create and edit grade levels and classes, assign a homeroom teacher, and see enrollment counts.
- Subjects: create and edit the school subject catalog.
- Academic years: create and edit years and terms, select one current year, and validate term dates against year boundaries.
- Attendance: mark active class rosters by date, submit complete roll calls, record reasons for later corrections, and export a dated CSV.
- Gradebook: create weighted categories and assessments, enter scores, publish complete class grades, and explain published-grade corrections.
- Report cards: generate versioned cards from published grades and submitted attendance, inspect subject results, approve, publish, and print or save a PDF.
- Communications: draft and publish school, grade and class in-app announcements. Staff see published notices relevant to their role and class assignment.
- Sensitive records: create cases, store encrypted notes, require an access reason for decryption, maintain case status and access history, and record staff directives and court restrictions.
- Audit history: search the latest 100 events for this school.
- School settings: edit the school's display name and timezone. The sign-in tenant ID remains managed separately.

For a new school, create the academic year and mark it current, add grades and classes, then enroll students and link guardians. Every mutation checks the authenticated school and commits its audit entry in the same transaction. Guardian delivery, emergency two-party broadcasts, operational enforcement of court restrictions at pickup, delivery of specialist directives to other roles, and GDPR requests are not connected to the live administrator workspace.

Student numbers are assigned from a per-school counter inside the enrollment transaction, including CSV imports. Existing student numbers stay unchanged, and staff cannot edit assigned numbers. The CSV template does not require a student number; `externalReference` is optional for a school's old ID. Older CSVs with a `studentNumber` column are accepted and that value is stored as the external reference. A repeated external reference in the same school is rejected. After import, download the row-by-row mapping of old IDs and assigned numbers; both are searchable in the student directory. Apply migration `0011_student_number_counters` with `npm run db:migrate` before using live enrollment or import.

### Live school office workspace

Office staff land on their own overview at `/`. They can enroll and update students, change current-year class placement and status, maintain guardian contacts and relationships, import validated student CSV files, and correct a submitted roll call with a written reason. Student numbers are assigned automatically for both individual enrollment and CSV import. The student directory flags active pickup or disclosure restrictions for office follow-up. Staff can read published school notices. Server actions reject attempts to manage staff roles, academic setup, grades, report publication, or direct sensitive case editing.

The shared enrollment wizard lets office staff flag safeguarding, health, learning support, or behaviour concerns. These create restricted cases with only a generic title and category; no sensitive narrative is collected on the enrollment form. School administrators review them under Sensitive records and add protected notes through that workflow. A safeguarding referral does not itself create or enforce a pickup or court restriction.

### Live teacher workspace

Teachers land on their own overview at `/`. School administrators assign a teacher to a class as homeroom teacher; subject assignments already stored in `teacher_class_assignments` are also supported. Teachers see only current-year classes assigned to them, their enrolled students, and the published notices addressed to them.

Homeroom teachers can record and submit attendance and generate draft report cards with teacher remarks. Assigned subject teachers can create assessments from administrator-defined categories, enter grades and publish complete assessments for their subject and class. Homeroom teachers can also manage assessments in their class. Administrators retain approval and publication of report cards. Server actions recheck the teacher's class or subject assignment on every save. No school-wide roster, guardian contacts or sensitive case details are sent to the teacher workspace.

### Live guardian portal

School administrators can enable a guardian account from the Guardian directory after linking that contact to a student with legal responsibility. The account is not added to staff memberships. Share its tenant ID, username and temporary password through a verified private channel; the guardian must change the password at first sign-in. The portal displays only students whose guardian link grants legal responsibility, submitted attendance from the most recent 120 days, published report cards, and published school, grade or current-class notices. Guardians can submit an absence date and reason category; office staff can mark the note reviewed. A note does not change attendance and contains no free-text health details. The portal does not expose sensitive case notes or attendance reasons. Direct messaging, email/SMS invitations and delivery remain future work.

Production startup requires `DATABASE_URL`, `BETTER_AUTH_SECRET` and `SENSITIVE_RECORD_ENCRYPTION_KEY`. Generate independent random secrets (at least 32 characters) and keep them outside source control. Keep the narrative key securely backed up; changing it without a migration makes existing ciphertext unreadable. No default production key is provided. Platform-managed school and staff provisioning, forced temporary-password replacement, and MFA enrollment are implemented. No SMS provider is required for the in-app workflows.

### Migration recovery

The migration journal includes the phone identity, platform administration, school membership, account provisioning, and temporary-password schema changes. A fresh database can use `npm run db:migrate`. If you previously applied SQL files manually, first reconcile the actual schema and migration history in a staging copy; do not blindly rerun migrations against that database.

## Verification

```text
npm run typecheck
npm run lint
npm test
npm run db:check
npm run build
```

## Deployment

The recommended Coolify deployment is defined in `compose.yaml`. Coolify generates the database credentials, authentication secret, encryption key and public application URL. A one-time migration container applies the schema and creates the first platform administrator before the web service starts. PostgreSQL stays private and persists in a named volume. The application health endpoint at `/api/health` performs live database and cryptography checks.

Follow the complete [Coolify deployment guide](docs/coolify-deployment.md). For local PostgreSQL, use `compose.local.yaml`; the production Compose file is intentionally optimized for Coolify's generated variables.

## Documentation & Roadmap

- **Progress & Roadmap:** See [`ROADMAP.md`](ROADMAP.md) for the master 6-phase status, completed Phase 1 checklist, and Phase 2 backlog.
- **Visual Guidelines:** See [`docs/design-system.md`](docs/design-system.md) for Klassa’s design system rules.
- **Backup & Disaster Recovery:** See [`docs/backup-and-restore.md`](docs/backup-and-restore.md) for Coolify and Docker automated backup runbooks.
- **Coolify Deployment:** See [`docs/coolify-deployment.md`](docs/coolify-deployment.md) for the complete first deployment, verification, backup, update and rollback procedure.

## First platform administrator and school provisioning

1. Configure PostgreSQL, set `KLASSO_DEMO_MODE=false`, and apply migrations with `npm run db:migrate`. Supply `DATABASE_URL` to the migration process.
2. Set the public `BETTER_AUTH_URL` to the production HTTPS origin.
3. In a trusted administration shell, set `KLASSO_BOOTSTRAP_USERNAME` (for example, `admin`), `KLASSO_BOOTSTRAP_NAME`, and `KLASSO_BOOTSTRAP_PASSWORD` (12–128 characters). Run `npm run admin:bootstrap`. Clear the bootstrap variables afterward.
4. Sign in at `/login` and complete authenticator enrollment at `/setup-mfa`. Save the one-use recovery codes offline.
5. Open `/platform`. Create each school together with its initial administrator, username, and a unique temporary password. Platform administrators can add more staff there; after setup, each school administrator can also create staff accounts directly inside their own school.
6. Share the tenant ID, username and temporary password through a secure channel. On first sign-in, the account must replace the temporary password before school access.

In **Users & access**, platform administrators can revoke staff sessions, reset a temporary password, suspend an account with an audited reason, and reactivate it. Suspension blocks sign-in and revokes existing sessions across every school membership. The last active administrator of any affected school cannot be suspended. Apply migration `0014_charming_stryfe` before using these controls in a live deployment.

The platform **Schools** directory links to a detail page for each school. Platform administrators can update the display name and timezone, review setup and staff status, and suspend or reactivate the school with an audit trail. School suspension signs out its accounts and blocks new sign-ins and protected actions. It refuses to proceed if an account has a membership in another school. Apply migration `0015_rich_krista_starr` before using school suspension in a live deployment.

Tenant IDs are school slugs, and `platform` is reserved for platform administrators. Usernames are case insensitive and unique within a tenant. A duplicate username in the same school is rejected; the same username in another school creates a separate account. Existing users with several memberships can still choose a school at `/schools`.

The platform role is separate from school roles and is checked from the database. Memberships determine school access; a platform administrator does not automatically receive permission to read school records. Public registration, phone OTP, SMS delivery, and self-service password reset remain disabled. Authenticator recovery codes are supported at sign-in. Better Auth's required email column holds an internal non-mailbox identifier. Sign-in uses tenant ID and username; no phone or email service is needed.

### Moving existing accounts to tenant usernames

Deploy migration `0009_tenant_usernames` before starting the updated application. It keeps existing passwords, MFA secrets, recovery codes, and memberships. The earliest platform administrator receives tenant ID `platform` and username `admin`; additional platform administrators receive `admin-2`, `admin-3`, and so on. Existing school staff receive `staff-N` usernames, visible alongside their login tenant in **Users & access**. Distribute those login details before staff sign in again. Accounts without a school membership or primary school need administrator provisioning. A school slug named `platform` must be renamed before migration.

For new deployments use `KLASSO_BOOTSTRAP_USERNAME` instead of `KLASSO_BOOTSTRAP_PHONE`. An existing administrator is not recreated by bootstrap; use the migrated username and existing password.

Authenticator MFA is required only for platform administrators. Migration `0010_platform_admin_mfa` disables previously enrolled MFA for school accounts while retaining platform administrator enrollment. School administrators and all other staff use tenant ID, username and password; temporary password changes still apply.
