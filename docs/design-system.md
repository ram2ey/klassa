# Klassa design system

## Approved direction

Use UKO-inspired white surfaces, a pale gray canvas, rounded cards, restrained shadows and orange accents. This replaces the earlier square, royal-blue institutional theme. Keep school workflows and permissions intact. Phases 1–6 established the shared foundations, navigation, directories and workflow styling. Use semantic primary colors; retain green, amber and red for status.

## Foundations

- Typeface: self-hosted Plus Jakarta Sans Variable, weights 400–700.
- Page title: 24px / 600; card title: 16–18px / 600; body: 14px; supporting text: 12–13px; metric: 28–32px / 600 with tabular numerals.
- Spacing: 4px grid, typically 8, 12, 16, 24 and 32px. Card padding and gaps: 24px. Page padding: 16px mobile, 24–32px desktop.
- Shape: cards 16px; controls 8px; badges and small menus 6px.
- Controls: 44px default height and mobile targets. Compact buttons may be 36px on desktop.
- Icons: Lucide for new shared components and school workspaces. Keep existing Phosphor demo icons until their screens are migrated; do not add another icon package.
- Motion: 150ms color transitions; respect reduced motion. No decorative scaling, glass effects or gradients in working surfaces.

## Tokens

Use semantic Tailwind utilities (`bg-primary`, `text-secondary`, `border-line`) or shared components. Do not hardcode orange hex values in pages.

| CSS token | Value | Tailwind utility example |
| --- | --- | --- |
| `--canvas` | `#F4F4F5` | `bg-canvas` |
| `--surface` | `#FFFFFF` | `bg-surface` |
| `--surface-subtle` | `#FAFAFA` | `bg-surface-subtle` |
| `--text-primary` | `#18181B` | `text-ink` |
| `--text-secondary` | `#52525B` | `text-secondary` |
| `--text-muted` | `#71717A` | `text-muted` |
| `--border` | `#D4D4D8` | `border-line` |
| `--border-subtle` | `#E4E4E7` | `border-line-subtle` |
| `--primary` | `#C2410C` | `bg-primary` |
| `--primary-hover` | `#9A3412` | `hover:bg-primary-hover` |
| `--primary-subtle` | `#FFF7ED` | `bg-primary-subtle` |
| `--selected-text` | `#9A3412` | `text-selected` |
| `--focus` | `#C2410C` | `outline-focus` |
| `--success` | `#15803D` | `text-success` |
| `--warning` | `#B45309` | `text-warning` |
| `--danger` | `#B91C1C` | `text-danger` |

Success, warning and danger have corresponding subtle backgrounds. Orange indicates actions and selection; warnings use amber, an explicit label and an icon. Never indicate status by color alone. Primary orange against white has approximately 5.2:1 contrast. Subtle control borders are supplemented by visible labels and an explicit focus outline; they are not status indicators.

Shape and elevation source tokens are `--shape-card`, `--shape-control`, `--shape-small`, `--elevation-card` and `--elevation-overlay`. Tailwind exposes `rounded-card`, `rounded-control`, `rounded-small`, `shadow-card` and `shadow-overlay`.

## Shared components

- `ui/button.tsx`: primary, secondary, ghost and danger variants; compact and icon sizes; loading state. `IconButton` requires a label. Keep meaningful visible text while loading. `asChild` is intended for links; link-specific disabled handling is the caller's responsibility.
- `ui/badge.tsx`: neutral, primary, success, warning and danger tones. Existing `blue` calls are a compatibility alias for primary orange. Include a status word; add an icon for warnings.
- `ui/card.tsx`: Card, CardHeader, CardContent and PageHeading. Cards do not clip content by default, so focus rings and menus remain visible.
- `ui/field.tsx`: Input, Select, Textarea and Field. Wrap a single control in Field to link visible labels, hints and errors. Native required and disabled states remain available. Checkbox and radio controls should use their own appropriately associated labels.
- `ui/tabs.tsx`: self-contained tabs with ArrowLeft/ArrowRight, Home/End navigation, linked panels and one tab stop. Supply stable unique item values and at least one item. Use links instead when navigation changes URLs.
- `ui/states.tsx`: EmptyState, LoadingState, ErrorState and WarningNotice. Distinguish empty records from failed reads. Provide a real action where one exists.
- `ui/overlay.tsx`: controlled native modal dialog or drawer. `open` and `onClose` belong to the caller. Native dialogs provide focus containment and restoration; Escape and outside click request closure. `size="wide"` supports wide content such as the data export dossier. Set an appropriate title and description. Preserve pending-save guards in existing editors.
- `school-admin/shared.ts`: `panelStyle` and `fieldStyle` bridge existing live school cards and editors to these foundations.
- `school-admin/ui.tsx`: existing Metric, PanelHeading, Empty and Status use shared styling. This does not change data or permissions.

## Development preview

Run `npm run dev` and open `/design-system`. It contains synthetic metrics and samples of actions, fields, statuses, tabs, empty/loading/error states, dialogs and drawers. The route returns 404 outside development, even when demo mode is enabled. It performs no mutations.

## Shared workspace shell (Phase 2)

`components/workspace-shell.tsx` provides the white desktop sidebar (260px expanded / 72px collapsed), top bar, account disclosure menu, skip link and single main landmark. Below 1024px it uses a left-side native modal drawer. The drawer closes on Escape, outside click and section selection, restores focus, and closes when crossing the desktop breakpoint. The desktop toggle stays mounted so keyboard focus is retained during collapse/expand. Collapsed navigation keeps accessible text and native title tooltips.

Supply `schoolName`, optional `academicYear`, `actorName`, `roleLabel`, `navigationLabel`, `groups`, `activeId`, `contentId` and `children`. Each navigation item has a stable `id`, visible `label`, rendered `icon` and optional `href`. An item without an href is a button (used for existing demo state navigation). `onNavigate` supports workspace cleanup; `switchSchoolHref` is optional and is never supplied by the guardian portal. `accountActions` replaces the real sign-out control for synthetic previews only. Optional `banner` and `toolbar` preserve the demo warning, search, persona switching and existing notifications.

`components/workspace-navigation.tsx` groups only the entries supplied by the role; it does not authorize access or add routes. Office and teacher lists live here, administrator sections remain in `school-admin/shared.ts`, and `guardianNavigation` returns existing family section anchors. Never pass administrator navigation to another role. Server authorization remains authoritative.

`components/guardian-workspace-shell.tsx` manages family section selection and browser hash navigation without adding staff membership or school-switching features. Section anchor targets remain in the server-rendered guardian content. `/design-system/shell` previews all four roles using the same navigation configuration; it returns 404 outside development. The preview role selector is never included in live workspaces.

## Verification

Target WCAG 2.2 AA. Retain browser focus outlines and explicit `:focus-visible` rings; use visible field labels and adjacent errors. All controls must work with a keyboard and screen readers. Respect reduced motion, 200% zoom, narrow screens and long text. Verify 375, 768, 1024 and 1440px layouts. Do not place fake interactive controls in product flows.

Run type checking, lint, unit tests and a production build after foundation changes. Verify the preview visually and exercise keyboard tabs and overlay focus before applying the components to later phases.

## School overview dashboards (Phase 3)

The shared `components/overview-dashboard.tsx` renders four responsive metric cards (4/2/1), attendance summary, setup progress, review tasks, quick actions, activity and notices from an explicit presentation model. The model accepts only the fields rendered; no restricted pupil details are included. `components/school-overviews.tsx` maps the existing administrator, office and teacher data into that model.

- Administrator pupils are active school-directory records; classes belong to the current academic year; staff counts school memberships. Attendance covers all years and submitted/locked sessions, with the earliest/latest mark dates returned by the existing aggregate query.
- Attendance numerator is present + late; denominator is all recorded marks in submitted/locked sessions. Excused marks are shown under other marks. No historical comparisons or charts are invented. Zero marks produce an em dash and an empty state.
- Office attendance uses the selected date and morning roll calls. Teacher attendance uses the selected date and the same class/period permission filtering as attendance entry. The teacher loader now fetches that permitted date's sessions for overview as well as attendance.
- Setup completion requires a current year, current-year classes, a teacher or office account, active current-year enrollment, and a guardian link to an active pupil. These steps establish initial setup, rather than certify full roster coverage.
- Pending absence counts are explicitly limited to the loaded recent notes (administrator 100, office 200). The administrator link opens a read-only note status panel in attendance; review actions remain office-only. Office medical directives stay in operational attendance, with an overview reminder. Teacher safety reminders still link to class rosters.
- Recent activity shows action, actor and timestamp without event metadata. Office/teacher notices retain their existing server filtering. Live workspaces keep their existing routes and server actions.
- The local demo shares these cards and clearly identifies synthetic information. Draft demo attendance is excluded and administrative shortcuts are shown only to the admin persona.

At `/design-system/shell?role=administrator&section=overview`, switch roles to inspect the overview and use **Show empty school** to inspect onboarding and empty states. All preview information is synthetic, and the route remains development-only.

## Directories and profiles (Phase 4)

`components/ui/directory.tsx` provides a shared rounded directory card with search, labeled filters, sortable columns with `aria-sort`, page sizes 10/25/50, result announcements and distinct empty/no-match states. Each row has an ID, display name, searchable text, rendered cells, explicit sort values and filter values. Sorting uses the supplied values rather than rendered markup. Searches trim leading/trailing whitespace. Wide tables scroll within a labeled, keyboard-focusable region; narrow screens show a scrolling hint. The document itself must not overflow.

Optional controlled selection retains IDs across pages and filters. The page checkbox shows a mixed state when only some visible rows are selected and affects only the current page. Supply `selectionDisabled` while a mutation is pending. Optional `onExport` receives every filtered ID in the displayed sort order, across all pages. `resetKey` resets pagination for filters owned by the caller. This component performs no server requests or mutations.

`DirectoryIdentity` shows initials and a named profile button where a profile action exists. `DirectoryStatus` uses textual active/pending/neutral status badges. Do not attach click-only actions to entire table rows or add decorative overflow menus.

The administrator student directory keeps its existing quick filters, selected-row export, bulk status/class updates, CSV download and academic profile/edit workflows. Search is now inside the directory; the outer duplicate search is removed. Class/status filters combine with quick filters. Placement considers current-year active or pending enrollment, excluding withdrawn placements. Bulk success feedback remains visible after selection clears; errors retain the selection. Current-year class options exclude old classes.

`components/people-directories.tsx` connects the shared layout to office students and live guardian contacts. Guardian search includes linked pupil names, phone and email, with filters for student links and recorded legal responsibility. Primary/legal badges summarize whether at least one relationship has that flag; responsibility is still per relationship. Administrator portal-access eligibility continues to come from the existing legal-link check, and office staff receive only their existing edit/intake actions. Relationship editors, SMS preferences and phone-confirmation workflows remain available below the directories.

The academic profile uses a native modal dialog for focus containment and background inertness. Close, Escape and outside-click handlers close the dialog before notifying the caller, preserving focus restoration when the profile unmounts. Profile content, report access, timetable and role-scoped safety information retain their existing data sources. Its section buttons announce their pressed state. The demo profile now uses the shared native overlay, and demo directories use the same table controls with synthetic records.

Enrollment and CSV-import surfaces use orange semantic controls and rounded cards while retaining existing validation, pending guards and server actions. No new backend endpoints or permissions are introduced.

Preview at `/design-system/shell?role=administrator&section=students` or `section=guardians`. Both administrator and office previews use shared directory components. They include sample/empty states and temporary local sample editing. The student preview opens the real academic drawer with empty academic history. Preview controls perform no live mutations and remain development-only.
