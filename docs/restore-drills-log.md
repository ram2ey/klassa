# Disaster recovery evidence register

No verified production restore drill is recorded in this repository. The previous August/September entries were illustrative and lacked supporting execution logs; they must not be used as recovery or compliance evidence.

## Local synthetic verification — 2026-10-04

`npm run test:operations` restored a real compressed PostgreSQL dump into an automatically created disposable database. It verified synthetic pupil row recovery, school isolation, restricted worker table access and SMS function execution permissions. It also restored a legacy dump created with `--no-privileges`, verifying that the security reconciliation repairs its permissions even when migration history is already complete.

This check used local PostgreSQL 16, synthetic records and no live secrets. CI is configured to repeat it with PostgreSQL 17. It does not establish production RPO/RTO, off-site archive recovery, application decryption or deployed account access.

## Required staging/production evidence

For each actual drill record:

- Operator, UTC date, deployment commit and target environment.
- Archive identifier, trusted snapshot time, SHA-256 digest and checksum verification output.
- Expected snapshot row counts and restored counts, including guardian links and sensitive records.
- Total elapsed provisioning, restore and application verification time; backup age at recovery (targets: 24-hour RPO and 8-hour RTO).
- Successful login, sensitive record decryption using separately recovered encryption keys, and tenant isolation checks.
- Pass/fail, remaining issues and links to retained execution logs.

`scripts/restore-drill.sh` enforces backup age, database restore timing and three core row-count comparisons. It retains the target for further application checks and does not certify full recovery automatically.
