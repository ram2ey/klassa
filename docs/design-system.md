# Klassa design system

Klassa uses a formal, compact institutional interface. Large working surfaces are white, structure is slate, and royal blue is reserved for primary actions, links, selection, and focus.

## Foundations

- Typeface: self-hosted Plus Jakarta Sans Variable, weights 400–700.
- Shape: square controls and surfaces with 0–2px corner radii.
- Spacing: 4px base grid; prefer 8, 12, 16, 24, and 32px intervals.
- Desktop controls: 32–36px high. Mobile interaction targets remain at least 44px.
- Icons: Phosphor outline icons at 16px and 20px.
- Motion: 120–180ms color, opacity, and panel transitions; reduced motion is respected.

## Semantic color tokens

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#F8FAFC` | Application background |
| Surface | `#FFFFFF` | Primary working areas |
| Primary text | `#0F172A` | Headings and body text |
| Secondary text | `#475569` | Supporting content |
| Border | `#CBD5E1` | Controls and major boundaries |
| Primary | `#1D4ED8` | Primary actions and selection |
| Primary hover | `#1E40AF` | Primary hover state |
| Focus | `#2563EB` | Keyboard focus ring |
| Success | `#15803D` | Successful and active states |
| Warning | `#B45309` | Pending and warning states |
| Danger | `#B91C1C` | Destructive and error states |

Do not use color as the only status indicator. Avoid gradients, glass effects, decorative shadows, emojis, oversized illustrations, and pill-shaped structural controls.

## Layout and components

- Desktop navigation is a 240px sidebar that collapses to 64px; mobile uses a drawer.
- Administrative pages favor full-width tables with sticky headers, filters, bulk selection, and clear empty states.
- Forms keep visible labels above fields and show errors adjacent to the affected control.
- Overlays use a clear border and restrained shadow; normal surfaces rely on borders rather than elevation.
- Light mode is the Phase 1 theme. All values remain semantic tokens for future theme support.

## Accessibility

Target WCAG 2.2 AA. All workflows must work with keyboard navigation and screen readers, maintain visible focus, support 200% zoom, and preserve a logical focus order. Test phone, tablet, laptop, and wide desktop layouts.
