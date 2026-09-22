# Klassa — OWASP ASVS Level 2 Verification Matrix

This document provides formal security verification evidence for **Klassa (Institutional SIS)** against the **OWASP Application Security Verification Standard (ASVS) 4.0.3 Level 2** (Applications that handle sensitive data, including PII, healthcare records, and safeguarding files).

---

## Executive Security Summary

- **Target Level:** OWASP ASVS Level 2 (Standard Enterprise & Sensitive PII)
- **Data Classification:** Confidential / Statutory Safeguarding / Health & Medical (Tier 3)
- **Primary Defense Strategy:** Defense-in-depth, zero-trust cryptographic boundaries, role-based access control (RBAC), multi-tenant transaction isolation, and mandatory read-justification audit trails.

---

## 1. ASVS Chapter Verification Evidence

### V1: Architecture, Design and Threat Modeling
- **Multi-Tenant Scoping:** All database transactions run within explicit organization boundary queries using PostgreSQL session configuration (`src/db/tenant.ts` and `withOrganizationScope`).
- **Cryptographic Storage Architecture:** Separation of database metadata from encrypted sensitive narratives (`aes-256-gcm` in `src/lib/sensitive-records.ts`).
- **Separation of Concerns:** Need-to-know directives are structurally separated from raw case records (`needToKnowAlerts` vs `sensitiveCases`). Classroom teachers have zero database read capability for sensitive cases.

### V2: Authentication
- **Strong Credential Storage:** Managed by Better Auth utilizing cryptographic password hashing (bcrypt/Argon2id).
- **Mandatory Staff MFA:** Time-Based One-Time Password (TOTP) RFC 6238 two-factor authentication required for all administrative, teaching, and specialist roles (`twoFactor` in `src/db/schema.ts`).
- **Brute-Force Protection:** Auth tier rate limiter restricts login attempts to 5 per 15-minute window (`src/lib/rate-limit.ts`).

### V3: Session Management
- **Secure Cookie Flags:** `HttpOnly`, `SameSite=Lax` (or `Strict`), `Secure` on production deployments.
- **Session Expiration & Invalidation:** Fixed session timeouts with sliding re-validation and instantaneous server-side session revocation on logout (`sessions` table in `src/db/schema.ts`).
- **Session Regeneration:** Session tokens regenerate upon authentication state transitions.

### V4: Access Control
- **Granular Role Matrix:** Institutional roles defined via `staffRole` PostgreSQL enum (`school_admin`, `office_staff`, `teacher`, `safeguarding_lead`, `senco`, `health_nurse`, `guardian`).
- **Decryption Shield Guard:** Sensitive clinical and child protection narratives require explicit, audited justification before decryption keys are invoked (`src/lib/sensitive-records.ts:canUserAccessCaseArea`).
- **Statutory Court Restrictions:** Automatic enforcement of custody and restraining orders (`court_restrictions`), actively blocking restricted guardians from child pickup, attendance logs, and report card disclosures.

### V5: Malicious Input Handling & Validation
- **Strict Schema Validation:** 100% of incoming Server Action payloads and API parameters are validated with Zod schemas (`src/lib/validation/student.ts`, `src/lib/communications.ts`, `src/lib/sensitive-records.ts`, `src/lib/gdpr.ts`).
- **SQL Injection Defense:** All database queries utilize Drizzle ORM parametrized query builders; raw queries strictly bind parameters using Drizzle's `sql` tagged template literals.
- **CSV Import Sanitization:** RFC 4180 compliant parser validating phone formats, email syntaxes, and preventing CSV formula injection attacks (`src/lib/csv.ts`).

### V6: Cryptography at Rest and in Transit
- **Authenticated Encryption:** AES-256-GCM authenticated cipher with 256-bit SHA-256 derived keys, cryptographically random 12-byte initialization vectors (IV), and 16-byte authentication tags ensuring tamper detection (`src/lib/sensitive-records.ts`).
- **Transport Security:** HTTP Strict Transport Security (`max-age=63072000; includeSubDomains; preload`) enforced in `next.config.ts`.
- **Cryptographic Hash Verification:** Every database backup generates a companion SHA-256 hash verified before restoration (`scripts/backup.sh` and `scripts/restore.sh`).

### V7: Error Handling and Logging
- **Immutable Audit Ledger:** All state changes and sensitive read accesses are logged permanently to `audit_events` and `sensitive_access_logs` with actor ID, organization ID, action type, IP address, and metadata.
- **No Information Leakage:** Stack traces and internal database schemas are suppressed from client-facing responses in production mode.

### V8: Data Protection & Privacy (GDPR Compliance)
- **Article 15 & 20 Data Portability:** Machine-readable student dossier exports (JSON/CSV) aggregating all personal data (`src/lib/gdpr.ts`).
- **Safeguarding Non-Disclosure Exemption:** Statutory exemption under UK/EU Data Protection Act automatically redacting confidential child protection and abuse notes from parental portability packages.
- **Article 17 Right to Erasure / Anonymization:** Irreversible pseudonymization of PII (names, emails, phones, addresses) while retaining anonymized statistical marks required by educational regulations.
- **Article 18 Processing Restriction:** Instant processing freeze blocking outbound telecommunications and roster exports.

### V9: Communications Security
- **Strict Content-Security-Policy (CSP):** `default-src 'self'`, script and style restrictions, `frame-ancestors 'none'`, `object-src 'none'`.
- **Browser Isolation Headers:** `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`.
- **TCPA / PECR Telecom Compliance:** Explicit opt-in/opt-out consent management per delivery channel (`src/lib/communications.ts:updateGuardianConsentAction`).

### V10: Malicious Code & Software Integrity
- **Dependency Scanning:** Standard npm audit scans and lockfile integrity verification.
- **Container Hardening:** Multi-stage non-root Docker build (`Dockerfile`) running under least-privileged system user.

### V11: Business Logic Controls
- **Four-Eyes Emergency Protocol:** High-consequence campus safety broadcasts mandate two distinct executive authorizations; author self-approval is programmatically blocked (`src/lib/communications.ts:confirmEmergencyBroadcast`).
- **Attendance & Grade Integrity:** Discrepancy resolutions and gradebook corrections mandate justification notes and create immutable correction records (`attendance_corrections`, `grade_corrections`).

### V12: File and Resource Handling
- **Sandboxed File Processing:** Uploaded roster CSVs are processed in-memory without persistent disk execution (`src/lib/csv.ts`).
- **Static Assets:** Static web resources served through immutable cache headers with strict MIME type enforcement.

### V13: API and Web Services
- **OpenAPI 3.1.0 Contract:** Formal OpenAPI documentation and machine-readable specification (`docs/openapi.json` and `/api/openapi`).
- **RFC 6585 Rate Limiting:** All API consumers and sensitive endpoints receive rate limiting with `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers (`src/lib/rate-limit.ts`).

### V14: Configuration and Build Architecture
- **Environment Isolation:** Zero hardcoded production secrets. Database credentials and encryption keys are sourced from environment variables with safe development defaults.
- **Disaster Recovery SLAs:** Documented 24-hour RPO and 8-hour RTO validated via monthly restore drill automation (`docs/backup-and-restore.md` and `src/lib/drills.ts`).
