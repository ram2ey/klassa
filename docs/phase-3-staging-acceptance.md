# Phase 3: staging acceptance

## Status

Local static checks passed on 2026-09-27: `npm run db:check` and `npm run typecheck`. The automated test runner did not start: Vitest failed while loading its config with Windows `spawn EPERM`. No staging database, bootstrap credentials, or mNotify credentials are configured in this environment, so the end-to-end acceptance flow remains **pending**. No live data or provider messages were touched.

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
- [ ] Important pupil and enrollment changes appear in the audit trail.
- [ ] A database backup is created and restored into an isolated staging database; core school records are readable.
- [ ] With a verified test recipient only, staff can compose a parent announcement, review recipient count and unreachable numbers, confirm send, and see the provider delivery status. Verify a failed or unreachable recipient is visible. Keep production SMS disabled until this passes.

## Results

Record pass/fail, evidence and issue references for each checklist item. Do not mark the staging gate complete based on local typechecking or unit tests. Deployment and broad SMS use remain gated on the staging results above.
