# First school MVP release

## Release scope

One Ghana pilot school; administrator, office staff and teacher accounts only. Six administrator areas: Home, Pupils, Attendance, Marks & Reports, Fees and Settings. Preserve the authentication, tenant isolation and audit trail. Keep parent access, SMS, notices, timetables, behaviour and specialist workflows disabled at the server boundary.

## Prepare the pilot

1. Provision the school and first administrator in the MFA-protected platform console. Replace temporary passwords at first sign-in.
2. In Settings, create the current academic year and terms, grades, classes, staff and subjects. Assign homeroom/subject teachers and select every class's required subjects.
3. Confirm the term's Classwork/Exam weights before saving any marks. Default: 40/60, scores out of 100, total rounded to two decimals.
4. Enrol or import synthetic pupils and guardian contacts. Review assigned numbers and CSV row results. Check existing pickup/disclosure flags with the office.
5. Submit one complete daily class register using present, absent, late or excused. Explain corrections to submitted registers.
6. Enter both components for each required subject. Prepare previews, then publish selected complete reports as administrator. Print the report; verify pupil identity, scores, weighting, attendance and remarks.
7. Correct a published mark with a reason and publish again. Confirm the original report stays unchanged and the new version is numbered separately. Lock the term only after every active pupil has a current published report.
8. Define a named class/term charge, review recipients and apply it. Reapply and confirm no duplicate bills. Moving a pupil to another class must leave existing bills unchanged.
9. Record any opening debts once per pupil, with a reason. Use signed adjustments to correct posted charges. Record a partial payment and print its receipt; verify outstanding balance. Check an overpayment appears as credit. Administrator-only payment voids retain the payment and mark the receipt void.
10. Export balances and print a pupil statement. Verify teachers cannot open fees, unassigned classes or other schools' reports; repeat isolation checks with a second synthetic school.

## Deployment gates

- Apply the entire forward migration chain to a fresh PostgreSQL 17 database and reconcile klassa_app privileges. Migration 0040 creates RLS-protected MVP tables and immutable-ledger/report triggers.
- Pass typecheck, lint, unit tests, SMS engine regression tests, migration checks, production build, database integration checks, operations restore checks and browser tests.
- Deploy the reviewed code through the existing Coolify Compose application. Set SMS_DELIVERY_ENABLED=false; do not enable COMPOSE_PROFILES=sms. No SMS provider is required.
- Verify the real public HTTPS domain, secure session cookies, staff password replacement, platform MFA and /api/health. Do not treat local HTTPS verification as evidence of a public deployment.
- Take a production backup and restore it into an isolated staging database. Verify migration history, pupil/report/fee rows, restricted-role ACLs and cross-school isolation. Keep the narrative encryption key securely backed up.
- Remove synthetic pilot records before entering real records. Obtain staff sign-off on attendance, reporting and fees. Expand to additional schools only after that sign-off.

## Recovery and corrections

Do not edit posted pupil charges or delete payments. Post an adjustment or void with a reason. Do not edit a published report; correct the marks and publish a new version. Preserve request IDs when retrying uncertain saves; the server returns the original audited result for identical requests. Receipts are allocated inside the same transaction as the payment and audit entry.

Follow [Coolify deployment and backup procedures](coolify-deployment.md). Migration-owner credentials are for migration/restore only; the web application uses klassa_app. A failed migration is a deployment stop, not a reason to bypass schema preparation.

## Local verification — 7 October 2026

| Check | Result |
| --- | --- |
| TypeScript and lint (zero warnings) | Passed |
| Unit tests | 64 files, 341 tests passed |
| Database integration | 5 files, 38 tests passed |
| Fresh PostgreSQL 17 migration chain and restricted-role probe | Passed |
| Migration consistency check | Passed |
| SMS engine regression tests (no live delivery) | 5 tests passed |
| Real PostgreSQL dump/restore and bootstrap/ACL operations | 4 tests passed |
| Browser acceptance on production server with localhost HTTPS | 7 tests passed |
| Production build | Passed with the supported webpack compiler |
| Report, receipt and mobile layout inspection | Passed; report/receipt PDFs generated |

The local Windows ARM64 Turbopack CSS worker exited before connecting, including outside the sandbox. Verification used npm run build -- --webpack. The existing Linux Docker build retains npm run build and must pass in Coolify/CI. Docker itself was unavailable on the local machine.

All database and browser checks used synthetic schools on a disposable local PostgreSQL 17 instance. Public Coolify deployment, public-domain HTTPS checks and a restored production backup remain outstanding because no deployment target or access was supplied. Local backup restoration is verified; it does not replace the production restore gate.
