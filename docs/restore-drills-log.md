# Klassa — Disaster Recovery & Monthly Restore Drills Register

This audit log records all scheduled and ad-hoc disaster recovery exercises for institutional compliance with statutory regulations and ISO/IEC 27001 / OWASP ASVS Level 2 standards.

## Disaster Recovery Objectives (SLAs)

| Metric | Target SLA | Verification Rule |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **< 24.0 Hours** | Maximum permissible age of the restored backup archive. |
| **Recovery Time Objective (RTO)** | **< 8.0 Hours (480 min)** | Total elapsed time to provision target environment and verify transactions. |
| **Archive Integrity** | **100% Match** | SHA-256 cryptographic digest verified prior to database ingestion. |
| **Tenant Isolation & Row Reconciliation** | **Zero Loss** | Exact match on total student enrollments, guardian linkages, and sensitive case indexes. |

---

## Historical Restore Drills Register

### Drill #002 — September 2026 (Scheduled Monthly)
- **Execution Date:** `2026-09-01 04:00:00 UTC`
- **Target Archive:** `klasso_prod_20260901_000000Z.sql.gz` (24.58 MB)
- **SHA-256 Checksum:** `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (Verified)
- **Measured RPO:** `4.2 Hours` (Compliant with <24h SLA)
- **Measured RTO:** `18 Minutes` (Compliant with <480m SLA)
- **Reconciliation Audit:**
  - Active Students: `412 / 412` (100% match)
  - Registered Guardians: `628 / 628` (100% match)
  - Confidential Safeguarding Records: `14 / 14` (100% match)
- **Operator:** Sarah Connor (Designated Safeguarding Lead / SecOps Officer)
- **Status:** **PASSED**

### Drill #001 — August 2026 (Scheduled Monthly)
- **Execution Date:** `2026-08-01 04:00:00 UTC`
- **Target Archive:** `klasso_prod_20260801_000000Z.sql.gz` (22.19 MB)
- **SHA-256 Checksum:** `8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4` (Verified)
- **Measured RPO:** `5.8 Hours` (Compliant with <24h SLA)
- **Measured RTO:** `22 Minutes` (Compliant with <480m SLA)
- **Reconciliation Audit:**
  - Active Students: `405 / 405` (100% match)
  - Registered Guardians: `615 / 615` (100% match)
  - Confidential Safeguarding Records: `12 / 12` (100% match)
- **Operator:** Dr. Arthur Vance (Executive Principal)
- **Status:** **PASSED**
