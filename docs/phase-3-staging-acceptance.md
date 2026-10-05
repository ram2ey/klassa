# Phase 3: staging acceptance

## Status

Repository verification passed locally and in [GitHub Actions for d1a6a92](https://github.com/ram2ey/klassa/actions/runs/37071372982): typecheck, lint, unit/component tests, SMS worker tests, migrations, database integration, tenant isolation, production build and HTTPS browser smoke tests. The earlier Windows spawn restriction was resolved by running the checks with appropriate process permissions.

The 2026-10-04 follow-up passed local typecheck, lint, migration validation and production build, with 318 unit/component tests, 29 database integration tests, four operations tests, five SMS worker tests and five HTTPS browser tests. Operations checks include first-admin failure/concurrency and real dump/restore permissions; browser checks exercise staff and guardian SMS preferences. These follow-up changes have not yet run in GitHub Actions. Linux CI is configured to execute the backup/restore shell scripts, including moved archives and corrupt/missing checksum rejection; Bash is unavailable in this Windows environment, so those wrapper checks remain pending.

**Deployed staging acceptance remains pending.** No Coolify deployment, real provider delivery or production recovery drill has been verified here. Local synthetic tests and CI do not satisfy the deployment checklist. No live data or provider messages were touched.

The development lint dependency chain has an unpatched braces advisory ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)); production dependency audit was clean on 2026-10-04. Track the upstream patch and avoid processing untrusted repositories with this lint toolchain. Do not downgrade the Next.js lint configuration to an incompatible major version merely to satisfy npm's suggested fix.

## Staging setup

- Use a disposable staging deployment and a fresh database. This app has no historical school data to migrate or preserve.
- Configure the database, bootstrap administrator and authentication secrets through the deployment secret manager. Keep mNotify disabled until the SMS acceptance steps below.
- Create two synthetic schools, School A and School B, with separate staff, pupils and guardians. Use synthetic names and phone numbers that cannot contact real people.
- Record the deployment commit, migration result and test date here before marking any acceptance item complete.

## Acceptance checklist

- [ ] Fresh database migrations complete successfully; app health endpoint is healthy.
- [ ] School A administrator and office staff can enroll a pupil, assign the pupil to a class, and link a guardian.
- [ ] School A teacher can submit attendance and enter marks; staff can publish and print/download a term report.
- [ ] Staff can place pupils for the next year, including promoted, repeating and leaving pupils.
- [ ] School A guardian sees only their linked pupil and published information; School B records are inaccessible.
- [ ] Staff can record an authorized collector and apply pickup restrictions; restricted pickup is blocked or surfaced to authorized staff as designed.
- [ ] Guardians can opt out of routine announcement SMS in their portal; office staff can record the same choice for a guardian without portal access. Verify audited evidence and that opted-out contacts are excluded.
- [ ] Important pupil and enrollment changes appear in the audit trail.
- [ ] A database backup is created and restored into an isolated staging database; core school records are readable.
- [ ] With a verified test recipient only, staff can compose a parent announcement, review recipient count and unreachable numbers, confirm send, and see the provider delivery status. Verify a failed or unreachable recipient is visible. Keep production SMS disabled until this passes.

## Results

Record pass/fail, evidence and issue references for each checklist item. Do not mark the staging gate complete based on local typechecking or unit tests. Deployment and broad SMS use remain gated on the staging results above.
