# Klassa Assistant & Contributor Guidelines

Always review `ROADMAP.md` before making changes. It contains the exact 6-phase master roadmap, current implementation status, file mappings, and immediate next tasks.

## Quick Project Context
- **Current Status**: **Phase 5 Complete** (Sensitive Student Records). **Phase 6 Next** (Production Hardening and Expansion).
- **Current Status**: **All 6 Phases Complete** (Phase 1–6 production-ready). OWASP ASVS Level 2, Disaster Recovery, GDPR, Multi-Tenant Scaling.
- **Core Stack**: Next.js 16 (App Router + Turbopack), PostgreSQL 17, Drizzle ORM, Better Auth (with TOTP MFA), Docker/Coolify.
- **Design Rules**: Follow `docs/design-system.md` strictly (Plus Jakarta Sans, 0–2px radii, Phosphor outline icons, square institutional controls).

## Standard Verification Suite
Run all four commands before completing any milestone:
```bash
npm test            # Vitest unit tests
npm run typecheck   # TypeScript check (tsc --noEmit)
npm run lint        # ESLint
npm run build       # Next.js production build
```

## Key Documentation Files
- `ROADMAP.md` - Master 6-phase status, completed checklist, and next backlog
- `docs/design-system.md` - Visual language tokens and UI layout conventions
- `docs/backup-and-restore.md` - Operational backup, recovery, and Coolify procedures

@AGENTS.md
