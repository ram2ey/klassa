# Klassa

Klassa is a staff-only school management MVP for the first Ghana pilot school. The supported roles are administrator, office staff and teacher.

The daily workflow is **enrol pupil → assign class → submit daily attendance → enter term marks → publish a report → record fees and payments**.

## Staff workspace

Administrators have six navigation items: Home, Pupils, Attendance, Marks & Reports, Fees and Settings. Guardian contacts and CSV import/export live within Pupils. Settings contains staff access, classes and teacher assignments, subjects, class subjects, academic years/terms, weighting, reviewed year placement and audit history.

Office staff maintain pupil/contact records, follow up submitted attendance and record payments/receipts. Teachers see assigned classes, submit daily registers, save permitted subject marks and prepare homeroom report drafts. Teachers cannot access fees or school administration.

Marks use Classwork /100 and Exam /100, initially weighted 40% and 60%. Blank scores differ from zero. Administrators may change a term's weights before its first marks are saved. All configured class subjects need both scores before publication. Published reports preserve component scores, weights, attendance and remarks; corrections require a reason and a new version. Term locking and reviewed year placement remain available.

Fees use integer Ghana pesewas. Administrators define and review class/term charges, apply only missing charges, record one opening debt and signed adjustments, and void payments with a reason. Administrators and office staff record cash, mobile-money or bank payments. Partial payments reduce debt and overpayments become credit. Receipts have transactional school-specific numbers and preserve the balance at posting. Posted ledger entries and published report snapshots are immutable. Fees never block attendance or reports.

Parent accounts, SMS, notices, timetables, behaviour and specialist workflows are deferred through route/action guards. Existing pickup/disclosure flags remain visible on pupil records. The internal platform console remains available for provisioning. Legacy setup and gradebook/report bookmarks redirect to the new workspace.

## Local development

1. Copy .env.example to .env.local for Next.js and .env for local Compose; replace placeholders.
2. Start PostgreSQL 17 using docker compose -f compose.local.yaml up -d, or configure an existing database.
3. Run npm run db:deploy with the migration-owner connection. This applies the migration history, reconciles restricted roles and bootstraps the initial platform administrator. Runtime must use the restricted klassa_app role.
4. Start npm run dev and provision a synthetic school/staff account through the platform console.

The application has not previously been used. Validate the complete migration chain on a fresh disposable database before first deployment. Migration 0040 adds the school MVP; existing migrations remain intact. Generate independent authentication and sensitive-record encryption secrets of at least 32 characters. Back up the encryption key separately from the database.

KLASSO_DEMO_MODE=true provides a synthetic read-only MVP preview during local development. Live saves require authenticated staff and PostgreSQL. Production rejects demo mode. Public registration is disabled; platform administrators require MFA, and temporary staff passwords must be replaced on first sign-in.

## Verification

Run npm run typecheck, npm run lint -- --max-warnings=0, npm test, npm run test:sms, npm run db:check and npm run build. The installed Next.js guides in node_modules/next/dist/docs are authoritative. On Windows ARM64, a local Turbopack worker failure may require npm run build -- --webpack; the Docker production build retains the default compiler.

Database checks require a migrated disposable PostgreSQL database: RLS_TEST_ADMIN_URL is its owner connection and RLS_TEST_APP_URL its restricted klassa_app connection. Run npm run test:integration and npm run test:operations. The latter uses pg_dump and psql (set PG_BIN to their directory when needed) to verify real backup restoration, ACLs and tenant isolation. Set restricted worker credentials as documented in .env.example. Never point these suites at real pupil data.

Install Chromium with npx playwright install chromium, build production code, then run npm run test:e2e. The browser suite runs staff sign-in and the school workflow behind a local HTTPS proxy using public localhost-only certificates. GitHub Actions validates a fresh PostgreSQL 17 deployment and runs the same checks.

## Deployment

Use the existing [Coolify deployment guide](docs/coolify-deployment.md) and [pilot release checklist](docs/mvp-release.md). Compose starts private PostgreSQL, a one-time migrator/bootstrap service and the web service. SMS_DELIVERY_ENABLED must remain false and the sms Compose profile must remain disabled for this release. /api/health checks database access and cryptography without requiring a disabled SMS worker.

Before entering real pupil data, verify HTTPS sign-in, health checks and a restored production backup. Start with one school and expand only after its staff complete daily attendance, term reporting and fee collection successfully.

The older [roadmap](ROADMAP.md) and staging documents contain historical work; the MVP release checklist defines the current release boundary.
