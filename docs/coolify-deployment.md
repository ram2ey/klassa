# Deploy Klassa to Coolify

This is the recommended production deployment path for Klassa. It uses the repository's `compose.yaml` so Coolify builds the web image, provisions a private PostgreSQL service, creates persistent storage, generates strong secrets, runs database migrations, creates the first platform administrator, and starts the web application only after database preparation succeeds.

## What the deployment creates

- `web`: the public Next.js application on internal port `3000`
- `postgres`: a private PostgreSQL 17 database with a persistent Docker volume
- `migrate`: a one-time deployment container that applies Drizzle migrations and safely bootstraps the first platform administrator

The database has no published host port. Coolify's proxy exposes only `web`. Every later deployment runs the migrations again; already-applied migrations are skipped. The bootstrap command is idempotent and skips itself after any platform administrator exists.

## Before you begin

Have the following ready:

1. A Coolify server with a working proxy and internet connectivity.
2. Access to the GitHub repository: `https://github.com/ram2ey/klassa`.
3. A domain for the web service. You have three options:
   - **Custom public domain** (e.g. `klassa.example.com`) with an `A` or `AAAA` DNS record pointing to your Coolify server.
   - **Coolify generated domain** (if wildcard domains are configured in your Coolify instance).
   - **Free wildcard IP domain (`sslip.io`)** if you do not own a domain yet (e.g. `https://<YOUR_SERVER_IP>.sslip.io:3000`), which requires zero DNS configuration and automatically supports Let's Encrypt SSL.
4. The username, display name, and a new password for the first platform administrator.

Use a username such as `admin` (3-64 letters, numbers, dots, underscores or hyphens). The initial password must contain 12–128 characters. Use a unique password; do not reuse a personal password.

## 1. Create the application

1. In Coolify, open the destination **Project** and **Environment**.
2. Select **+ New** and choose a Git repository source.
3. Connect the GitHub App/deploy key if the repository is private, or use the public repository option if it is public.
4. Select `ram2ey/klassa` and branch `main`.
5. Choose **Docker Compose** as the build pack.
6. Set **Base Directory** to `/`.
7. Set **Docker Compose Location** to `/compose.yaml` (some Coolify versions display this as `compose.yaml`).
8. Leave **Raw Compose Deployment** disabled. Coolify should manage proxy labels and the resource network.
9. Save and allow Coolify to parse the three services.

Do not create PostgreSQL as a separate public application. It is already defined in the stack and is reachable only as `postgres` on the private Compose network.

## 2. Configure the public domain

Open the parsed `web` service and configure its domain using one of the following methods:

### Method A: Custom public domain
If you already have a domain with DNS pointing to your Coolify server:

```text
https://klassa.example.com:3000
```

Replace the hostname with your real hostname. The `:3000` suffix tells the Coolify proxy which internal container port to use; visitors still open the normal HTTPS URL without typing a port.

### Method B: Coolify generated wildcard domain
If your Coolify instance has a wildcard domain configured:
1. Select **Generate Domain** under the `web` service settings.
2. Confirm the generated URL targets port `3000` (e.g. `https://random-id.your-server.domain:3000`).

### Method C: Free wildcard IP domain (`sslip.io` — No domain purchase required)
If you do not have a public domain yet and Coolify has no wildcard domain set up, you can use your server's public IP address with `sslip.io`. It resolves to your IP automatically without any DNS setup, and Coolify's proxy can provision a free Let's Encrypt SSL certificate for it:

```text
https://YOUR_SERVER_IP.sslip.io:3000
```
*(Example: `https://123.45.67.89.sslip.io:3000`)*

> [!NOTE]
> HTTPS is strongly recommended because Better Auth session cookies and Time-Based One-Time Password (TOTP) authenticator enrollment require a secure browser context. Both Method B and Method C provide automatic HTTPS.

### Changing to your permanent domain later
You can switch to a permanent custom domain at any time without data loss:
1. Point your custom domain's DNS `A` or `AAAA` record to your Coolify server IP.
2. In Coolify, update the `web` service domain to `https://klassa.example.com:3000`.
3. Save and redeploy. Coolify automatically updates the proxy routes and provisions a new SSL certificate.

In **Environment Variables**, explicitly set `BETTER_AUTH_URL` to the public HTTPS origin, for example `https://klassa.example.com`. Use the same hostname as the browser, without a path or the internal `:3000` port. This variable must be available at runtime. The Compose file requires it rather than relying on generated URL interpolation. Update it whenever the domain changes, then redeploy.

## 3. Review generated secrets

Coolify should automatically create and persist these values from the Compose definition:

- `SERVICE_USER_POSTGRES`
- `SERVICE_PASSWORD_64_POSTGRES`
- `SERVICE_REALBASE64_64_AUTH`
- `SERVICE_REALBASE64_64_RECORDS`
- `SERVICE_URL_WEB_3000`

Do not replace them with placeholders. Confirm that each generated value is non-empty. The authentication and sensitive-record keys must remain stable across redeployments. In particular, losing or changing `SERVICE_REALBASE64_64_RECORDS` makes existing encrypted narratives unreadable.

Store encrypted copies of the two generated secrets in your password manager or secrets vault before admitting production data.

## 4. Enter the required variables

Under **Environment Variables**, set the following values.

### Initial administrator

```text
KLASSO_BOOTSTRAP_USERNAME=admin
KLASSO_BOOTSTRAP_NAME=Your Name
KLASSO_BOOTSTRAP_PASSWORD=<a unique 12–128 character password>
```

These variables are passed only to the one-time migration container, not to the public web container. On the first deployment, deployment intentionally fails if no platform administrator exists and these values are missing or invalid.

After the first administrator has signed in successfully, you may blank or remove all three bootstrap values. Future deployments detect the existing administrator and skip bootstrap safely.

Mark the bootstrap password as secret if the Coolify UI offers that option. Klassa does not require an SMS provider: platform administrators create school and staff accounts directly and assign temporary passwords.

### Optional database pool size

```text
DATABASE_POOL_SIZE=10
```

The default is `10`, which is appropriate for one application replica. Before adding replicas, choose a pool size that keeps the combined connections safely below PostgreSQL's connection limit.

Do not add `DATABASE_URL`, `BETTER_AUTH_SECRET`, or `SENSITIVE_RECORD_ENCRYPTION_KEY` manually. The Compose definition constructs them from Coolify-generated values.

## 5. Deploy

Select **Deploy** and follow the deployment logs. A successful first deployment proceeds in this order:

1. Coolify builds the `runner` and `migrator` targets.
2. PostgreSQL starts and passes `pg_isready`.
3. `migrate` applies all pending migrations.
4. `migrate` creates the first platform administrator.
5. `migrate` exits with code `0`.
6. `web` starts and its `/api/health` check verifies PostgreSQL and cryptography.

The completed `migrate` container is expected to be stopped. It is marked `exclude_from_hc`, so its successful completion does not make the stack unhealthy.

Do not bypass a failed migration. Read the `migrate` logs, correct the configuration or migration problem, and redeploy.

## 6. Verify the deployment

Open:

```text
https://klassa.example.com/api/health
```

A healthy response should include:

```json
{
  "status": "healthy",
  "service": "gradia-klassa",
  "checks": {
    "database": { "status": "healthy" },
    "cryptography": { "status": "healthy", "selfTestPassed": true }
  }
}
```

Then verify the user flow:

1. Open `/login`.
2. Sign in with tenant ID `platform`, `KLASSO_BOOTSTRAP_USERNAME`, and `KLASSO_BOOTSTRAP_PASSWORD`.
3. Complete authenticator enrollment at `/setup-mfa`.
4. Store the one-use recovery codes offline.
5. Open `/platform`.
6. Create a school, its initial administrator, and a temporary password.
7. In a private browser session, sign in as that administrator and confirm Klassa requires a new password before school access.
8. Confirm the school administrator can open their school without an authenticator, and create a test staff account from the school workspace.

Share tenant IDs, usernames and temporary passwords through a secure, separate channel. Never send them together in ordinary email or store them in tickets. Klassa never displays the temporary password again.

After this test succeeds, remove the bootstrap variables and redeploy once. Confirm that the migration log says an administrator already exists and that the application remains healthy.

## 7. Configure backups before production data

In Coolify, open the parsed PostgreSQL service and configure scheduled backups:

- Schedule: every 6 hours (`0 */6 * * *`)
- Destination: private S3-compatible storage in a different failure domain
- Retention: at least 30 days, subject to your legal and institutional policy
- Encryption: enable server-side encryption and restrict bucket credentials to the backup destination

Run one backup immediately. Restore it into an isolated staging database and confirm that the core tables are readable. A backup that has never been restored is not yet a verified recovery plan.

Keep a secure copy of `SERVICE_REALBASE64_64_RECORDS` with the backup procedure. Database backups alone cannot decrypt sensitive narratives without that key.

## 8. Updates and automatic migrations

For later releases:

1. Push the tested commit to `main`.
2. Let the GitHub webhook trigger Coolify, or select **Redeploy**.
3. Confirm the one-time `migrate` service exits successfully.
4. Confirm `/api/health` reports healthy.
5. Run a sign-in and one critical workflow smoke test.

Never edit already-applied migration files. Add a new migration, test it against a staging copy of production data, and then deploy it.

## 9. Rollback rules

Application rollback and database rollback are separate operations.

- If a release contains only application code changes, redeploy the previous known-good commit.
- If a release applied a forward-only schema migration, do not blindly deploy old code. Verify that the older code is compatible with the newer schema.
- For a destructive or incompatible migration, restore a verified pre-deployment database backup and deploy the matching application commit during a controlled maintenance window.

Take an on-demand database backup before every migration that drops, renames, rewrites, or encrypts stored data.

## 10. Troubleshooting

### Build fails with a missing secret

The current application routes are forced to runtime rendering and should not need production secrets during `next build`. Confirm Coolify is deploying the latest `main` commit and uses `/compose.yaml`.

### Deployment stops at `migrate`

Open the migration service logs. On the first deployment, the most common cause is missing or invalid `KLASSO_BOOTSTRAP_*` values. Migration SQL failures must be resolved against a staging copy before retrying production.

### Web is unhealthy

Open `/api/health` and inspect the `database` and `cryptography` checks. Confirm PostgreSQL is healthy and that the generated auth and record-encryption secrets are still populated.

### Domain shows “No Available Server”

Confirm the domain is assigned to `web`, includes the internal `:3000` target, DNS resolves to the Coolify server, and the `web` container is healthy. Do not publish PostgreSQL or port `3000` directly on the host.

### A new account cannot sign in

Confirm the tenant ID and username match the account, and that the password was copied exactly. A new account must replace its temporary password before school access. Usernames are unique within a school. Existing installations receive migrated login names as described in the README; passwords remain unchanged.

## Production-readiness boundary

The deployed live system supports authentication, forced temporary-password replacement, MFA, platform-managed schools and staff accounts, school membership selection, and the connected roster workflows described in the README. Attendance, assessments, communications, sensitive cases, GDPR workflows, and some role-specific modules remain demonstrations whose live mutations are intentionally rejected. Do not use unfinished modules as systems of record until their roadmap items are completed and tested.

Relevant Coolify documentation:

- [Docker Compose applications](https://coolify.io/docs/applications/builds/docker-compose)
- [Docker Compose service configuration](https://coolify.io/docs/services/configuration/docker-compose)
- [Environment variables](https://coolify.io/docs/applications/configuration/environment-variables)
- [Domains](https://coolify.io/docs/core/networking/domains)
