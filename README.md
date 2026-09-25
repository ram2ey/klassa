# Klassa

Klassa is a secure K–12 school administration system. Phase 1 establishes the institutional design system, student and guardian records, enrollment history, CSV-import foundations, audit events, administrator-provisioned authentication, and a deployment baseline for Coolify.

## Local development

1. Copy `.env.example` to both `.env.local` (Next.js) and `.env` (local Compose), then replace every placeholder you use.
2. Start PostgreSQL with `docker compose -f compose.local.yaml up -d`, or point `DATABASE_URL` at an existing PostgreSQL 17 database.
3. Run `npm run db:migrate`. Use `npm run db:generate` only after intentionally changing the schema.
4. Start Klassa with `npm run dev`.

The UI currently uses representative local records so the design and workflows can be reviewed before production data is connected. Better Auth is mounted at `/api/auth/[...all]`; public registration is disabled and staff MFA is provided through the TOTP plugin.

### Preview and live boundaries

For the synthetic local preview, set `KLASSO_DEMO_MODE=true` in `.env.local` and run `npm run dev`. Demo actions never write to PostgreSQL. Preview changes remain temporary and are shared by visitors to that local server; use synthetic information only. Roster changes are loaded from the server on refresh, but restarting the server resets the demo.

Demo mode is rejected in production. With demo mode disabled, the home page requires an existing staff account, school membership and enabled MFA. Live roster reads, student enrollment and status updates use PostgreSQL and enforce the authenticated organization. Enrollment requires an existing class/grade in the school's current academic year. Mutations and their audit entries commit atomically. Database errors are never converted into successful demo writes.

Attendance, assessments, communications, sensitive cases, GDPR workflows and the old school-provisioning preview remain local demonstrations. Their server actions reject live requests, including requests from administrators. Anonymization is unavailable even in the preview: it cannot yet erase all related records and must not mark requests complete. Emergency approvals are simulations; class/grade SMS audiences are unavailable, and scheduled previews do not dispatch automatically. SMS simulations have zero cost and are not marked delivered.

Production startup requires `DATABASE_URL`, `BETTER_AUTH_SECRET` and `SENSITIVE_RECORD_ENCRYPTION_KEY`. Generate independent random secrets (at least 32 characters) and keep them outside source control. Keep the narrative key securely backed up; changing it without a migration makes existing ciphertext unreadable. No default production key is provided. Platform-managed school and staff provisioning, forced temporary-password replacement, and MFA enrollment are implemented. No SMS provider is required. The remaining live school modules are still being connected.

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
6. Share the tenant ID, username and temporary password through a secure channel. On first sign-in, the account must replace the temporary password before MFA enrollment or school access.

Tenant IDs are school slugs, and `platform` is reserved for platform administrators. Usernames are case insensitive and unique within a tenant. A duplicate username in the same school is rejected; the same username in another school creates a separate account. Existing users with several memberships can still choose a school at `/schools`.

The platform role is separate from school roles and is checked from the database. Memberships determine school access; a platform administrator does not automatically receive permission to read school records. Public registration, phone OTP, SMS delivery, and self-service password reset remain disabled. Authenticator recovery codes are supported at sign-in. Better Auth's required email column holds an internal non-mailbox identifier. Sign-in uses tenant ID and username; no phone or email service is needed.

### Moving existing accounts to tenant usernames

Deploy migration `0009_tenant_usernames` before starting the updated application. It keeps existing passwords, MFA secrets, recovery codes, and memberships. The earliest platform administrator receives tenant ID `platform` and username `admin`; additional platform administrators receive `admin-2`, `admin-3`, and so on. Existing school staff receive `staff-N` usernames, visible alongside their login tenant in **Users & access**. Distribute those login details before staff sign in again. Accounts without a school membership or primary school need administrator provisioning. A school slug named `platform` must be renamed before migration.

For new deployments use `KLASSO_BOOTSTRAP_USERNAME` instead of `KLASSO_BOOTSTRAP_PHONE`. An existing administrator is not recreated by bootstrap; use the migrated username and existing password.
