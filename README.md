# Klassa

Klassa is a secure K–12 school administration system. Phase 1 establishes the institutional design system, student and guardian records, enrollment history, CSV-import foundations, audit events, invite-only authentication, and a deployment baseline for Coolify.

## Local development

1. Copy `.env.example` to both `.env.local` (Next.js) and `.env` (local Compose), then replace every placeholder you use.
2. Start PostgreSQL with `docker compose -f compose.local.yaml up -d`, or point `DATABASE_URL` at an existing PostgreSQL 17 database.
3. Run `npm run db:migrate`. Use `npm run db:generate` only after intentionally changing the schema.
4. Start Klassa with `npm run dev`.

The UI currently uses representative local records so the design and workflows can be reviewed before production data is connected. Better Auth is mounted at `/api/auth/[...all]`; public registration is disabled and staff MFA is provided through the TOTP plugin.

### Preview and live boundaries

For the synthetic local preview, set `KLASSO_DEMO_MODE=true` in `.env.local` and run `npm run dev`. Demo actions never write to PostgreSQL or send real SMS, even when a database or SMS provider is configured. Preview changes remain temporary and are shared by visitors to that local server; use synthetic information only. Roster changes are loaded from the server on refresh, but restarting the server resets the demo.

Demo mode is rejected in production. With demo mode disabled, the home page requires an existing staff account, school membership and enabled MFA. Live roster reads, student enrollment and status updates use PostgreSQL and enforce the authenticated organization. Enrollment requires an existing class/grade in the school's current academic year. Mutations and their audit entries commit atomically. Database errors are never converted into successful demo writes.

Attendance, assessments, communications, sensitive cases, GDPR workflows and the old school-provisioning preview remain local demonstrations. Their server actions reject live requests, including requests from administrators. Anonymization is unavailable even in the preview: it cannot yet erase all related records and must not mark requests complete. Emergency approvals are simulations; class/grade SMS audiences are unavailable, and scheduled previews do not dispatch automatically. SMS simulations have zero cost and are not marked delivered.

Production startup requires `DATABASE_URL`, `BETTER_AUTH_SECRET` and `SENSITIVE_RECORD_ENCRYPTION_KEY`. Generate independent random secrets (at least 32 characters) and keep them outside source control. Keep the narrative key securely backed up; changing it without a migration makes existing ciphertext unreadable. No default production key is provided. SMS account activation, MFA enrollment and platform-managed school invitations are now implemented. The remaining live school modules are still being connected.

### Migration recovery

The journal registers migrations `0000` through `0007`; previously only `0000` was registered. Migration `0007` adds phone identity, platform administrators, school memberships and SMS invitations, and copies existing users? school/role assignments into memberships. A fresh database or a database that applied only journaled migrations can use `npm run db:migrate`. If you previously applied later SQL files manually, first reconcile the actual schema and migration history in a staging copy; do not blindly rerun migrations against that database. The final schema snapshot also prevents future generation from recreating the already-written phase migrations.

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

## SMS invitations and first superuser

1. Configure PostgreSQL and set `KLASSO_DEMO_MODE=false`. Apply the migrations with `npm run db:migrate` before starting the new live code. Supply `DATABASE_URL` to the migration process (the Drizzle CLI does not automatically load `.env.local`).
2. Set the public `BETTER_AUTH_URL` (HTTPS in production), `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`. The Compose service passes these settings through. The sending number/account must be permitted by your SMS provider to send to the destination countries.
3. In a trusted local administration shell, set `KLASSO_BOOTSTRAP_PHONE` (including country code), `KLASSO_BOOTSTRAP_NAME`, and `KLASSO_BOOTSTRAP_PASSWORD` (12?128 characters). Run `npm run admin:bootstrap` from a full checkout with dependencies installed. The script reads your local environment, creates a new account, and never promotes or overwrites an existing account. Do not put passwords in command-line arguments or source control; clear the bootstrap variables from your shell afterward.
4. Sign in at `/login` using that phone number and password. Complete authenticator enrollment at `/setup-mfa` and save the one-use recovery codes. The first superuser's phone is trusted through this controlled bootstrap process; ordinary staff prove possession using the SMS invitation.
5. Open `/platform`, create a school, and invite its administrator by mobile number. School creation currently establishes the tenant identity; academic years, grades and classes still need to be configured before roster enrollment.
6. The recipient opens the SMS link, confirms their number, chooses a name and password, and configures their authenticator. School and role are taken exclusively from the invitation. Existing accounts must sign in with the matching verified phone identity before accepting another school membership. They can choose among memberships at `/schools`.

Invitation links last 48 hours and are single-use. Tokens are cryptographically random and only SHA-256 digests are stored. The URL fragment is removed from browser history on opening; reopening the original SMS link is necessary after refreshing the activation page. No token is returned to the superuser or included in audit metadata. The invitation is committed and audited before the provider is called. A crash between commit and dispatch leaves a pending invite that can be resent; a provider error is shown as failed, never delivered. Resending or correcting a phone invalidates the previous link. Send limits are stored in PostgreSQL: one SMS per number per minute, five per number per day, and twenty per superuser per hour, including failed attempts. Concurrent operations reserve these limits atomically.

The platform role is separate from school roles and is checked from the database. Memberships now determine school access; a platform administrator does not automatically receive permission to read school records. Public registration, public phone OTP activation and SMS password resets remain disabled. Authenticator recovery codes are supported at sign-in. Existing verified email accounts can still use the legacy email sign-in option; their numbers are not guessed or silently merged with newly invited phone accounts. Better Auth's required email column holds an internal non-mailbox identifier for phone-only accounts?no email service is needed.

Local demo mode remains isolated: its staff invitation form simulates SMS and cannot create real users, schools or messages. Real provider delivery and migrations must be verified in your PostgreSQL staging environment before rollout. This implementation does not include automated SMS delivery retries, handset delivery callbacks, or self-service phone/password recovery.
