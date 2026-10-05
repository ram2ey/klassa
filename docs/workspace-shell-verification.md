# Phase 2 workspace shell verification

Implemented on 2026-10-05.

## Delivered

- One shared shell for the school administrator, office staff, teacher, guardian portal and local synthetic demo.
- White 260px desktop sidebar, 72px collapsed state, grouped navigation and orange active indicators. Collapse/expand preserves keyboard focus; icon links retain accessible labels and native tooltips.
- School identity and available academic-year context in a restrained top bar. Native account disclosure menu exposes existing sign-out and permitted school switching; Escape returns focus to its trigger, and outside interaction closes it.
- A left mobile modal drawer with Escape/outside-click/section-selection closure and native focus restoration. The drawer closes automatically at the desktop breakpoint.
- One main landmark with a skip link, shrinking content column and responsive padding. Existing staff section URLs are unchanged. Existing query/notice/editor cleanup is preserved on navigation.
- Guardian navigation links only to rendered family sections. School notices navigation is omitted when no students are available. No staff administration or school-switching entry is added.
- The synthetic demo keeps its warning, persona selector, working search and notification controls in an optional shell toolbar. Its existing state-based section navigation is retained.
- `/design-system/shell` is a development-only preview of all four live-role navigation lists. It is linked from the Phase 1 component preview. The role selector and synthetic account message are absent from live workspaces.

## Verification

- Full unit suite: 60 files, 325 tests passed after shell integration.
- Final shell/guardian regression run: 8 tests passed, including the additional guardian-navigation check and collapse-focus assertion.
- Type checking and lint pass.
- Existing administrator, office, teacher and guardian workflow tests passed after replacing their wrappers.
- Browser checked the administrator, office, teacher and guardian navigation lists in the development preview.
- Verified desktop collapse/expand, section URL navigation, account disclosure/Escape, mobile drawer navigation/Escape and focus restoration.
- Inspected phone (375px), tablet (768px), laptop (1024px) and wide desktop (1440px) states. Tablet document width matched viewport width; the sidebar switches to a drawer below 1024px.

## Remaining limits

The supported Webpack production build still fails on the existing `node:crypto` import in `src/lib/sensitive-records.ts`, reached by the demo client workspace. Turbopack's subprocess failure from Phase 1 also remains unresolved. These block production build verification and deployment readiness; the shell development preview runs with Webpack.

Page content (metrics, working forms and tables) is preserved for redesign in Phases 3–6. Server actions, authentication, database queries, tenant scoping and audit behavior were not changed. No live data was erased and no deployment was performed.
