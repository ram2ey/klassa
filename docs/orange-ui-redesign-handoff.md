# Orange UI redesign: implementation handoff

Updated: 2026-10-05. Repository: `C:\Users\admin\Desktop\WEB\gradia-klasso`.

## Read this first

The user's goal is to make Klasso resemble the UKO dashboard, using **orange instead of violet**. Reference: https://mui.com/store/previews/uko-client-admin-dashboard/ and its demo https://uko-react.vercel.app/dashboard/add-user. The design direction is a soft gray canvas, rounded white cards, restrained orange accents, generous spacing, clear typography, and a white responsive sidebar.

UI redesign Phases 1–6 are implemented locally. Phase 4 delivered student/guardian directories and profile presentation; Phase 5 delivered operational staff pages across attendance & reception, gradebook & reports, and school communications; Phase 6 completed remaining orange styling, shell consistency and the local production-build blocker.

**Do not confuse these UI phases with ROADMAP.md's archived six-phase feature roadmap.** Its historical Phase 4 is school communications. The Phase 6 breakdown below is the proposed final UI polish and consistency phase.

All changes are saved as working-tree files. No Git commit, push, deployment, database reset, or live-data deletion was performed for the UI redesign. There are substantial unrelated and mixed pre-existing changes: preserve them. Earlier user messages requested a live-data reset; that request remains unresolved and must be handled separately with the actual deployment and data scope established. Do not erase data while continuing visual work.

## Source documents and environment

Read these in order before continuing:

1. `AGENTS.md`: Next.js-specific instructions. Read the relevant installed guide under `node_modules/next/dist/docs/` before writing framework code; this version may differ from remembered APIs.
2. This handoff and the current status at the top of `ROADMAP.md`.
3. `docs/design-system.md`: actual component APIs, token usage, shell and directory integration details.
4. `docs/design-foundations-verification.md`, `docs/workspace-shell-verification.md`, `docs/overview-verification.md`, `docs/directories-verification.md`: phase-specific evidence and limitations.
5. Existing component tests and role-specific data/action modules for any screen being changed.

Installed stack: Next.js 16.3.8, React 19.2.8, Tailwind CSS 4, TypeScript, Vitest, PostgreSQL/Drizzle and Better Auth. The UI uses Plus Jakarta Sans Variable, Lucide icons in new components, and existing Phosphor icons in parts of the demo. Do not replace the application with a purchased template or introduce MUI solely to copy the appearance.

Working local development command:

```powershell
npm run dev -- --webpack --port 3002
```

Check whether a server already occupies port 3002 before starting another. Useful development-only previews:

- `http://localhost:3002/design-system`
- `http://localhost:3002/design-system/shell?role=administrator&section=overview`
- `http://localhost:3002/design-system/shell?role=administrator&section=students`
- `http://localhost:3002/design-system/shell?role=office&section=guardians`
- Change the role to teacher or guardian to inspect their shell/navigation. Not every preview section has a complete page; remaining sections may be placeholders.

Preview routes intentionally call `notFound()` in production. Preview data and editing are synthetic/local and do not mutate the database. Never use preview success as evidence of authenticated live-school acceptance.

## Phase 1 completed: visual foundations

### Files and behavior

- `src/app/globals.css`: semantic CSS variables and Tailwind aliases, canvas/surface/text/border palettes, shape/elevation, focus-visible treatment, reduced-motion behavior, and `ui-card`, `ui-field`, `ui-overlay` classes.
- `src/components/ui/button.tsx`: primary, secondary, ghost and danger variants; loading/disabled behavior; Slot-based `asChild`; labeled `IconButton`.
- `src/components/ui/badge.tsx`: primary, green, amber, danger and slate tones. The legacy blue compatibility tone now maps into the orange design.
- `src/components/ui/card.tsx`: Card, CardHeader, CardContent, PageHeading; preserve heading hierarchy.
- `src/components/ui/field.tsx`: Input, Select, Textarea and Field with label/hint/error associations. Field expects a direct control child; wrapping the control in an arbitrary div can break these associations.
- `src/components/ui/tabs.tsx`: accessible tabs with ArrowLeft/ArrowRight/Home/End navigation, one tab stop and associated panels.
- `src/components/ui/states.tsx`: empty, loading, error and warning states.
- `src/components/ui/overlay.tsx`: native controlled dialog/drawer with Escape/outside closure and native focus handling. Phase 4 closes the native dialog before notifying the parent to avoid losing focus restoration during unmount.
- `src/components/school-admin/shared.ts`, `school-admin/ui.tsx`, `school-admin/editor.tsx`: existing shared field/panel/editor presentation adopts the foundations.
- `src/components/design-system-preview.tsx`, `src/app/design-system/page.tsx`: foundations gallery.
- `src/instrumentation.ts`: Node telemetry import is inside the positive Node runtime branch, allowing Webpack development compilation without changing intended runtime behavior.
- `src/components/ui/foundations.test.tsx`: label association, keyboard tabs and loading action regression coverage.

### Design values

Canvas `#F4F4F5`; surface `#FFFFFF`; subtle surface `#FAFAFA`; strong text `#18181B`; secondary text `#52525B`; muted text `#71717A`; border `#D4D4D8`; subtle border `#E4E4E7`. Primary orange `#C2410C`, hover/selected foreground `#9A3412`, subtle orange `#FFF7ED`, focus `#C2410C`. Success `#15803D`, warning `#B45309`, danger `#B91C1C`. Card/control/small radii are 16/8/6px. Use semantic classes and existing primitives rather than reintroducing hardcoded violet or blue primary styling.

Known small foundation follow-up: button hover classes use `enabled:hover`, which does not apply to anchor elements rendered with `asChild`. Fix link hover styling deliberately without making disabled actions interactive. Callers remain responsible for disabled-link semantics.

## Phase 2 completed: shared responsive shell

- `src/components/workspace-shell.tsx`: shared shell, white 260px expanded / 72px collapsed desktop sidebar, grouped navigation, `aria-current`, accessible collapsed labels, stable collapse control, school/year/actor context, account menu, skip link and one main landmark. Main content is capped at 1500px with responsive padding and `min-width: 0` behavior.
- Below 1024px, navigation uses a native left drawer. Selection, Escape, outside interaction and transition to desktop close it. Account menu supports outside/Escape closure and focus return.
- `src/components/workspace-navigation.tsx`: role-specific navigation grouping. It only presents existing supplied sections; it does not grant permissions or add routes.
- `src/components/guardian-workspace-shell.tsx`: guardian hash-based navigation to existing family anchors. No staff actions or school-switch control; notices are omitted when no linked children are available.
- Integrated into `school-admin-workspace.tsx`, `office-workspace.tsx`, `teacher-workspace.tsx`, `guardian-portal-workspace.tsx`, and `klasso-workspace.tsx` (synthetic demo).
- Staff school switching uses `/schools`; sign-out uses existing staff/guardian behavior. Synthetic previews override account actions locally. Demo persona/search/notification controls remain supported.
- `workspace-shell-preview.tsx`, `src/app/design-system/shell/page.tsx`: role/section preview with validated async search parameters.
- `workspace-shell.test.tsx`: responsive navigation/account behavior regressions.

The shell is complete across these roles. This does **not** mean every page body has been redesigned.

## Phase 3 completed: role-scoped overviews

- `src/components/overview-dashboard.tsx`: reusable presentation for four metrics (4/2/1 responsive grid), attendance breakdown, setup progress, review tasks, quick actions, activity and notices. Activity displays actor/action/time without raw metadata. No fabricated trends or charts.
- `src/components/school-overviews.tsx`: separate administrator, office and teacher adapters over existing authorized data.
- `src/components/demo/overview.tsx`: same presentation using explicitly synthetic local data. Empty/unsubmitted attendance does not display a fabricated 100% result.
- `overview-preview-model.ts`: role-specific synthetic and empty models.
- `src/lib/school-admin-data.ts`: aggregate attendance first/last dates added without exposing individual marks in overview cards; preserve unrelated SMS changes in this file.
- `src/lib/teacher-data.ts`: overview attendance uses existing assignment and period filtering.
- `school-admin-workflows.tsx`: read-only latest guardian absence-note panel with `guardian-absence-notes` anchor in attendance. Review mutations remain office-only.
- `school-overviews.test.tsx` and existing workspace regressions cover metric scopes, empty states, teacher deduplication/assignment, draft filtering and setup behavior.

Data rules to retain:

- Administrator roster count uses active pupils; class count is current-year; staff count includes applicable administrator membership.
- Administrator attendance summarizes school submitted/locked sessions across school years and labels its date range. Numerator is present + late; denominator is all marks, including other/excused marks. Do not silently redefine it as today's attendance.
- Setup checks current year, classes, teacher/office account, active current-year enrollment and guardian linkage to an active pupil. It is a foundation checklist, not proof every pupil is fully configured.
- Administrator guardian-note counts are explicitly limited to the latest 100 records; office data is limited to the latest 200. Avoid presenting these as unlimited historical totals.
- Office overview is selected-date reception/roll-call data. Teacher overview is selected-date and assignment scoped; unique pupils are deduplicated.
- Medical/directive details stay in authorized operational screens; overview reminders link there without revealing sensitive details.

## Phase 4 completed: student/guardian directories and profiles

### Shared directory API and behavior

`src/components/ui/directory.tsx` provides Directory, DirectoryIdentity and DirectoryStatus. Read its actual types before wiring another screen.

- Rows carry stable IDs, names/search text, rendered cells, sortable values and filter values. Columns declare labels and sorting; filters declare labeled options.
- Search trims whitespace; filter and numeric-aware locale sorting combine before pagination. Sort buttons announce `aria-sort`.
- Page sizes are 10/25/50; changing query/filter/reset scope/page size resets pagination. Query can be local or externally controlled. Pass `resetKey` when external filtering changes the source scope.
- Controlled selected IDs persist across pages and filters. Select-all affects only the visible page and announces indeterminate state. Pending bulk work disables selection controls.
- Export returns **all filtered IDs in current sort order**, not just the page. Selected export remains a separate operation.
- Result count is announced; a truly empty directory differs from a no-match result with clear-filters action.
- Wide tables scroll inside a labeled, keyboard-focusable region with a mobile instruction. The document itself must not overflow.
- Identity actions are explicit named buttons when callbacks exist; entire rows are not implicitly clickable. Status is expressed through readable labels as well as color.
- `ui/directory.test.tsx`: four tests cover filtering/pagination/export/selection/empty/controlled-query behavior.

### Live integrations

- `school-admin-student-directory.tsx`: retains existing hooks, server actions, quick filters, profile/edit, filtered/selected CSV export, bulk status/class updates and feedback. Class options are current-year. Placement uses current-year active or pending enrollment and excludes withdrawn enrollment. Sort placement by human-readable class, not UUID. Bulk success clears selection while preserving feedback; failure retains selection and the error.
- `school-admin-student-directory.test.tsx`: three added tests for placement/class scope and bulk success/error handling.
- `people-directories.tsx`: shared guardian directory and office student directory. Guardians search name/email/phone/linked pupil names and filter student linkage/legal responsibility. Relationship badges describe individual relationships; do not collapse legal responsibility into a misleading global permission.
- `school-admin-workspace.tsx`: guardian table integration retains relationship editors and existing portal eligibility. Portal eligibility still depends on legal responsibility and enabled account state.
- `office-workspace.tsx`: student/guardian tables retain intake, edit, linking, SMS preferences and guardian phone confirmation. Restriction flags use existing expiry-aware logic. No academic, staff-management or administrator bulk privilege was added. Duplicate outer search controls were removed where Directory now owns presentation.
- `student-academic-drawer.tsx`: native modal, close-before-unmount, Escape/backdrop handling, focus containment/restoration, orange profile controls and pressed-state section buttons. Existing academic/report/safety/timetable data contracts are retained. `student-academic-drawer.test.tsx` stubs native dialog methods and checks cancel-event behavior.
- `student-enrollment-flow.tsx`, `student-csv-import.tsx`: orange/rounded fields and controls; validation and actions unchanged.
- `school-admin/ui.tsx`: generic DataTable now has semantic colors, but it is **not** the new filtering/sorting/pagination Directory implementation.

### Demo and preview

- `demo/directories.tsx`: shares Directory presentation while retaining local callbacks/persona behavior. Parent grade/status filters retain stable options from the full source and reset page scope. Sensitive synthetic categories are displayed as general alert/restriction badges.
- `demo/dialogs.tsx`: student profile uses shared Overlay; other legacy DialogFrame users still need review in later phases.
- `klasso-workspace.tsx`: passes full available grade options and trims search whitespace; retains local selection/persona state.
- `directory-preview.tsx`: 18 synthetic pupils, seven guardians, empty toggle, local add/edit and selection demonstrations, academic drawer with empty history. `workspace-shell-preview.tsx` mounts this for administrator/office student and guardian sections, remounting when section changes.

## Verification actually performed

Latest full unit run through Phase 5: **63 files, 338 tests passed**. Earlier phase documents contain historical counts (318, 325, 331). Phase 6 type checking, ESLint and Webpack production build passed; the test suite was not rerun for Phase 6.

Commands for the next implementation:

```powershell
npm run typecheck
npm run lint
npm test -- --maxWorkers=2
git -c core.safecrlf=false diff --check
npm run build -- --webpack
```

On this Windows setup, sandboxed test execution previously failed with missing temporary-file ENOENT errors. The successful full run used an approved execution outside the sandbox with two workers. If that recurs, diagnose the execution environment; do not change tests to conceal it.

Browser verification used synthetic development previews. Checked 375, 768, 1024 and 1440px layouts, no horizontal document overflow, internal table scrolling, filters/sorting, empty states, local edits, guardian responsibility filter, mobile academic drawer and Escape focus restoration to its profile trigger. Foundation tabs and overlays were also manually checked.

Local ignored screenshots, if still present: `.next/phase3-artifacts/desktop-overview.jpg`, `.next/phase3-artifacts/mobile-empty.jpg`, `.next/phase4-artifacts/desktop-directory.jpg`, `.next/phase4-artifacts/mobile-profile.jpg`. These are disposable visual artifacts, not durable acceptance evidence. Verification Markdown is the durable record.

No authenticated live-school browser acceptance, staging migration test, live E2E run or deployment was completed as part of these UI phases. Live integration behavior is covered by existing and added component regressions; this is not equivalent to staging acceptance.

## Production blockers and incomplete technical work

1. **Webpack production build:** the earlier `UnhandledSchemeError` for `node:crypto` no longer reproduces. The security settings client was changed to avoid importing server monitoring/crypto modules; its AES-GCM control now checks the browser Web Crypto API with a temporary in-memory key and labels that distinction. The sensitive-record server/client split is present. `npm run build -- --webpack` passed after Phase 6. Keep server crypto, encryption and audit behavior intact.
2. **Default Turbopack:** a prior CSS processing subprocess failure is documented. Phase 6 used the working Webpack build and did not rerun Turbopack, so its status remains unverified.
3. **Operational acceptance remains:** no authenticated live-school browser acceptance, staging migration test, live E2E run, tenant-isolation acceptance or deployment was done. ROADMAP notes RLS is not active on an existing deployment until its migration/configuration are successfully deployed. Local build success does not establish these.

## Phase 5 completed: operational staff pages

### Attendance and reception

1. **Administrator & Office Workflows:**
   - Modernized `src/components/school-admin-workflows.tsx` and `src/components/office-workspace.tsx`.
   - Replaced legacy tables and square panels with `Card`, `CardHeader`, `CardContent`, `ui-field`, rounded orange buttons, `divide-line-subtle`, and warning banners.
   - Preserved office-only guardian absence-note review and administrator read-only review panel/anchor.
   - Retained medical/safety access controls and safeguarding court order alerts in the reception desk log.
2. **Teacher Roster & Attendance:**
   - Modernized `src/components/teacher-workspace.tsx`.
   - Updated attendance roster, period attendance session locking alert, safety banner, gradebook rosters, reports draft generation, class reports cards, printable links, and teacher class announcements.
3. **Demo Attendance:**
   - Modernized `src/components/demo/attendance.tsx`.
   - Restyled header breadcrumbs, KPI ribbon, navigation sub-tabs (active orange border), roll call table with segmented status buttons (`P`, `A`, `L`, `E`), discrepancy log table, class rate bars, chronic absenteeism watchlist, `CorrectAttendanceDialog`, and `SubmitExcuseDialog`.

### Gradebook and reports

1. **Gradebook Module:**
   - Modernized `src/components/assessments/gradebook-module.tsx`.
   - Restyled header, class/subject filter selectors, sub-tabs, category weight summary, interactive gradebook matrix table, assessment weight cards, grading scales table, and grade change audit ledger.
2. **Report Cards Module:**
   - Modernized `src/components/assessments/report-cards-module.tsx`.
   - Restyled header, progress bar & metric cards, filter toolbar with search, and report cards table.
3. **Official Report Card Modal:**
   - Modernized `src/components/assessments/official-report-card-modal.tsx`.
   - Restyled printable transcript modal shell, header, student demographics grid, coursework matrix, academic standing, attendance summary, remarks, and signature blocks.
4. **Dialogs:**
   - Modernized `src/components/assessments/add-assessment-dialog.tsx` and `src/components/assessments/correct-grade-dialog.tsx` with rounded white surface cards, semantic field wrappers, and accessible focus management.

### Notices and communication

1. **Communications Module:**
   - Modernized `src/components/communications/communications-module.tsx`.
   - Restyled hub banner, KPI telemetry, sub-tabs, notice board filter bar, announcement cards with read rate bars, institutional templates library cards, guardian consent table, and telecom & cost ledger table.
2. **Announcement Creation Dialog:**
   - Modernized `src/components/communications/create-announcement-dialog.tsx`.
   - Restyled modal shell, template picker, target selector, priority selector, SMS cost forecast card, and action buttons.

### Verification actually performed

- Full unit suite: **63 files / 338 tests passed**.
- Type checking (`tsc --noEmit`): **passed** (0 errors).
- ESLint (`npm run lint`): **passed** (0 errors).
- Component regressions across `school-admin-workspace.test.tsx`, `office-workspace.test.tsx`, `teacher-workspace.test.tsx`, `guardian-portal-workspace.test.tsx` all pass.
- Verification record: see `docs/operational-workflows-verification.md`.

## Phase 6 completed: remaining pages and consistency

- Restyled the security, GDPR, multi-school and OpenAPI settings panels with the orange semantic palette, rounded cards, semantic fields and consistent tables. Settings tabs now expose tab/tabpanel relationships and support arrow/Home/End keyboard navigation.
- Migrated settings provisioning, onboarding, data export, data request and anonymization dialogs to the shared native `Overlay`; added a wide overlay size for the export dossier. Existing validation, callbacks and anonymization confirmation remain intact.
- Styled the remaining synthetic demo tables and workspace chrome, teacher roster/profile actions, sensitive-record panels, rollover and communications actions, guardian timetable, invitation/authentication links, platform UI accents and report/print links with the adopted orange palette. Green, amber and red retain status meaning.
- Replaced the demo guardian view's mismatched record types/props with the current announcement, report-card and consent contracts. It only receives Amelia's published reports; a failed simulated preference update no longer announces success.
- The demo security panel no longer imports server monitoring/Node crypto into client code. Its crypto check tests browser Web Crypto using a throwaway key, rate limits show configured policy rather than empty browser-side server metrics, and the restore action is labeled as a simulation.
- Added `size="wide"` to `ui/overlay.tsx` for the export dossier.
- No server authorization, tenant filters, sensitive-record encryption/audit rules, live consent endpoints, or live data were intentionally changed in this UI phase.

### Phase 6 verification actually performed

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build -- --webpack`: passed, including compilation, TypeScript and static page generation.
- `rg` scan of `src/components` and `src/app` TSX found no remaining blue/violet/purple/indigo utility classes.
- **The unit test suite was not run** during Phase 6. Phase 5's recorded 338-test pass predates these edits.
- No Phase 6 authenticated staging or manual mobile-browser acceptance was performed. Check guardian/settings/sensitive flows at 375/768/1024/1440px and keyboard/focus behavior in browser before release.
- A live consent server-action error and native overlay closures need appropriate regression coverage when the unit suite is next run. Do not treat a successful production build as behavior-test evidence.

The local UI portion of Phase 6 is complete. Release acceptance remains open: authenticated staging checks for administrator/office/teacher/guardian, tenant isolation and migration/deployment checks are separate operational work. No deployment or data reset was performed.

## Working-tree preservation and ownership

At handoff the repository has many modified/untracked files. Some are redesign changes; others are unrelated operational/security/SMS work, and several files contain both. `git status` alone cannot establish ownership. Do not `git reset`, clean untracked files, wholesale replace workspaces, or commit all changes without inspecting them.

Examples of separate/mixed areas to preserve: `.github/workflows/verify.yml`, Dockerfile, package.json scripts, `.gitattributes`, backup/restore/staging docs, `e2e/live-workspaces.spec.ts`, scripts for backup/bootstrap/deploy/restore/security, guardian SMS preferences/actions/tests, guardian consent/data, office/admin data and workspace files, migration tests and SMS integration tests. The new handoff and UI verification files are not a reason to discard those changes.

No environment secrets are copied here. Inspect configuration names only as needed and keep credentials out of tool output, documentation and commits.

## Immediate resume checklist

1. Read this document, design-system APIs and applicable Next.js guides; inspect `git status --short` and relevant diffs.
2. Continue with staging acceptance and operational release checks only when the deployment target and test accounts are available. If further visual work is requested, use the preview and concrete remaining browser acceptance items above.
3. Open the working Webpack preview and compare current migrated pages before changing shared primitives.
4. Implement one coherent workflow group at a time, retaining existing role/data/action contracts and unrelated changes.
5. Test meaningful affected behavior, then typecheck/lint/full suite; browser-check responsive and keyboard flows. Separate known build failures from any new regression.
6. Update this handoff, ROADMAP and phase verification with actual completion, remaining work and limits. Do not claim deployment or data reset unless those actions were separately completed and verified.
