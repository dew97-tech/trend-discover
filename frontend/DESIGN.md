# Trend Discover — Signal Desk design system

> Direction: an instrument-panel console for software engineers. Cool paper and
> ink, one signal accent, hairlines over cards, data set in mono, page titles in
> an editorial serif. Deliberately not a generic SaaS card kit.

This document is the source of truth for the frontend visual language. Read it
before adding UI; update it when the system changes.

## Principles

1. **Borders over shadows.** Structure comes from 1px hairlines and spacing.
   Shadows exist only on overlays (dialogs, popovers, menus, toasts).
2. **One accent.** LinkedIn blue (`--signal`) marks links, focus, selection and
   live data. Everything else is ink on paper. Actions use ink, not blue.
3. **Type does the hierarchy.** Serif for page titles and hero statements,
   Geist for UI, JetBrains Mono for every number and data label.
4. **Density with rhythm.** This is an operations tool: rows and ledgers over
   decorative cards. Macro-whitespace between sections, tight grouping inside.
5. **Motion is feedback, not decoration.** 150–200ms, explicit properties,
   `transform`/`opacity` only. No entry animations on every section.

## Typefaces

| Role | Family | Token | Notes |
|---|---|---|---|
| UI, body, controls | Geist Variable | `font-sans` | Default via `body` |
| Page titles, hero statements | Newsreader Variable | `font-serif` | `tracking-tight`, `font-medium` |
| Numbers, code, meta labels | JetBrains Mono | `font-mono` | Weights 400 / 500 / 700 bundled |

Rules:

- Every number that can be compared or updated (scores, counts, durations,
  latencies, character counts) is `font-mono tabular-nums`.
- Micro labels are `font-mono text-[10px] uppercase tracking-[0.08em]`.
  Use at most one per component; never stack eyebrows above every section.
- Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.
- Body copy is sentence case, active voice, specific. No exclamation marks,
  no "Oops", no marketing clichés.

## Color tokens

Semantic tokens only — components never use raw hex. All tokens are defined for
light and dark in `src/index.css`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#f2f4f7` | `#0e1013` | App canvas |
| `--surface` | `#ffffff` | `#16191e` | Panels, cards, inputs |
| `--surface-muted` | `#e9edf2` | `#1d2127` | Hover fills, wells |
| `--surface-sunken` | `#eef1f5` | `#111317` | Log blocks, dark input wells |
| `--foreground` | `#15181d` | `#e6e9ee` | Ink |
| `--muted-foreground` | `#5b6472` | `#98a2b3` | Secondary text |
| `--border` | `#dde2e9` | `#272d36` | Hairlines |
| `--border-strong` | `#c9d0d9` | `#39414c` | Input/outline borders |
| `--primary` | `#15181d` | `#e6e9ee` | Action buttons (ink) |
| `--signal` | `#0a66c2` | `#6ba6e8` | Links, focus, active data |
| `--signal-soft` | `#e4effa` | `#16283c` | Signal washes |
| `--success` / `--success-soft` | `#346538` / `#edf3ec` | `#7fbb8a` / `#16251a` | Ready, high scores |
| `--warning` / `--warning-soft` | `#956400` / `#fbf3db` | `#d9b25f` / `#2a2312` | Review, medium scores |
| `--danger` / `--danger-soft` | `#9f2f2d` / `#fdebec` | `#e08583` / `#2c1919` | Failures, destructive |
| `--info` / `--info-soft` | `#1f6c9f` / `#e1f3fe` | `#7db3df` / `#152433` | Informational status |
| `--code` / `--code-foreground` | `#0d1117` / `#e6edf3` | same | Code surfaces stay dark |

Rules:

- Never `#000` or `#fff`; always the tinted ink and paper tokens.
- Status colors are always the pastel pair (soft background + strong text).
- Text on soft fills must use the matching strong token, never white.

## Shape and elevation

- Radius scale: `--radius: 0.5rem` → `rounded-sm` 4px (chips, tags),
  `rounded-md` 6px (controls), `rounded-lg` 8px (panels), `rounded-xl` 12px
  (dialogs). Pills only for switches, progress and avatars-in-motion.
- `--shadow-overlay` is the only shadow, on overlays only.
- Panels are `bg-card` + `border border-border`, no shadow.
- Interactive rows/cards get `hover:bg-surface-muted` or
  `hover:border-signal/50`, plus `focus-visible:ring-2 ring-ring/40`.

## Layering

Stacking is explicit and single-source in `index.css`:

| Token | Value | Layer |
|---|---|---|
| `--z-sticky` | 30 | Sticky header, editor action bar |
| `--z-overlay` | 40 | Dialog backdrops |
| `--z-modal` | 50 | Dialog content |
| `--z-popover` | 60 | Select, dropdown, tooltip — must sit **above** dialogs |
| `--z-toast` | 70 | Skip link (Sonner manages its own, higher) |

Never give a portaled popper the overlay or modal layer: a Select opened inside a
dialog is portaled to `body`, so z-index (`--z-popover`) is what keeps it on top,
not DOM order. New overlay primitives must pick their layer from this table.

## Layout

- Page container: `mx-auto max-w-[1200px] px-4 py-8 sm:px-6`.
  Editorial flows (editor, settings) narrow to `max-w-[1100px]`/`max-w-[900px]`.
- Navigation: a 56px sticky top bar, single line on `lg`, with a ⌘K command
  palette. There is no sidebar.
- Prefer ledgers (`divide-y` rows in one panel) for ranked data, and
  asymmetric grids for mixed content. Avoid rows of equal feature cards.
- Auth pages use a split layout: editorial statement left, form right.
- Every filter, tab and search that shapes a list is reflected in the URL
  (`useSearchParams`, `replace: true`).

## Motion

- Tokens: `--duration-fast: 120ms`, `--duration-base: 200ms`,
  `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`.
- Hover/active feedback: `active:translate-y-px`, color/background transitions.
- Route content enters with `.route-enter` (4px rise, 200ms); this is the only
  page-level animation.
- `prefers-reduced-motion` is honored globally in `index.css`.
- Never animate `top`, `left`, `width`, `height`; never use `transition-all`.

## Iconography

- Phosphor Icons (`@phosphor-icons/react`), weight `bold`, set once via
  `IconContext` in `src/main.tsx`.
- Icons are sized with `size-3`/`size-3.5`/`size-4` classes.
- Decorative icons are `aria-hidden`; icon-only buttons require `aria-label`.
- Lucide is removed; do not reintroduce it (`components.json` points at
  `radix` so a future `shadcn add` does not pull Lucide back in).

## Component conventions

- `src/components/ui/*` are the primitives (shadcn-derived, restyled to this
  system). Page code composes them; it does not restyle them locally beyond
  layout classes.
- `src/components/shared/*` are product primitives: `PageHeader`,
  `SectionHeader`, `StatTile` (hairline readout, no card), `EmptyState`,
  `PostCard`, `Field`, `HelpTip`, `ConfirmDialog`, `ScorePill`, `StatusBadge`,
  `CodeBlock`, `Toolbar`.
- Loading uses skeletons shaped like the real content; empty and error states
  are composed, specific, and actionable.
- Every interactive element ships default, hover, focus-visible, active and
  disabled states. Focus rings are `ring-2 ring-ring/40`.

## Accessibility baseline

- Skip link to `#main-content`; one `<h1>` per page; heading levels do not skip.
- All form controls have labels (`htmlFor` or `aria-label`); search inputs are
  labeled; range/number inputs are labeled.
- Clickable rows and cards are real `<button>`s (or carry `role`, `tabIndex`
  and Enter/Space handling). Never a bare `<div onClick>`.
- Dialogs trap focus and close on Escape (Radix). Mobile navigation and the
  command palette are dialogs, not custom overlays.
- Dates and numbers use `Intl` via `toLocaleDateString`/`toLocaleString`.
- No zoom blocking, no paste blocking, no autoplaying motion.

## Provenance

Built after a full UI audit against these open-source guidance sets, applied
and kept in `.agents/skills/`:

- `minimalist-ui` (taste-skill) — editorial restraint, pastel statuses, hairlines
- `redesign-existing-projects` (taste-skill) — audit-first upgrade order
- `design-taste-frontend` (taste-skill v2) — anti-slop tells and state cycles
- `web-design-guidelines` (vercel-labs) — web interface compliance
- `frontend-design` (anthropics) — distinct direction and self-critique
