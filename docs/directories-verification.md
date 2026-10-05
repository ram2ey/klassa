# Phase 4 directory verification

Implemented on 2026-10-05 for the orange interface redesign.

## Delivered

- Shared directory card, rounded controls, orange accents, initials, explicit status badges and named row actions.
- Accessible search and filters, sortable headers with `aria-sort`, 10/25/50-row pagination, result announcements, and separate empty/no-match states.
- Tables scroll within a labeled, focusable region on narrow screens; controls wrap without document overflow.
- Administrator student quick filters, class/status filters, current-year placement, filtered CSV export, selected export and bulk updates retain their existing actions. Filtered CSV includes all matching rows in sort order. Selection persists across pages and filters; the page checkbox indicates partial selection.
- Successful bulk updates clear selection while preserving feedback; failed updates retain the selected IDs and show the server error. Placement excludes withdrawn enrollments and current-year class options exclude old classes.
- Live administrator and office guardian directories search contact details and linked pupil names, with student-link and legal-responsibility filters. Existing guardian portal eligibility, relationship editors, SMS preferences and office phone confirmation remain authoritative.
- Office intake/edit actions and restriction reminders are retained without adding administrator bulk or academic privileges.
- Academic profiles use a native modal with close-before-unmount behavior, Escape/outside closure, focus containment and restoration. Existing report, safety and timetable data remain role scoped. Profile sections announce pressed state. The demo profile uses the shared native overlay.
- Enrollment, CSV-import and office record controls use orange semantic styling without changing validation or server actions.
- Local demo student/guardian directories share the new table presentation and preserve their existing callbacks.
- Development shell preview includes student/guardian sample and empty states, local sample editing and an academic drawer with empty academic history. No live mutations occur in previews.

## Verification

- Full unit suite: **63 files / 338 tests passed**.
- Type checking and lint: **passed**.
- New tests cover combined filters, pagination reset, sorted filtered export IDs, selection across pages, mixed checkboxes, empty states, current-year placement and bulk success/error handling.
- Existing administrator, office, teacher and academic-profile regressions pass.
- Browser checked 375px, 768px, 1024px and 1440px layouts. Document width stayed within the viewport; wide tables scroll inside their regions.
- Verified student filtering/sorting, empty-directory toggle, guardian responsibility filtering, temporary student/guardian edits, phone academic profile, Escape closure and focus restoration to the profile trigger.
- Screenshot artifacts: `.next/phase4-artifacts/desktop-directory.jpg` and `.next/phase4-artifacts/mobile-profile.jpg` (local ignored files).

## Remaining limits

`npm run build -- --webpack` was attempted and still fails on the pre-existing `node:crypto` import from `src/lib/sensitive-records.ts` through the demo client workspace. Earlier Turbopack limitations remain documented in the foundation verification. No deployment was performed.

Visual checks used synthetic development data; authenticated live-school browser verification was unavailable. Live directory integration is covered by component regressions. No live data was erased, and no server permissions or data mutation contracts were changed.
