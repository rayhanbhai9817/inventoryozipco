# Design system

Everything visual in this product comes from one file — `frontend/src/app/globals.css` —
and one component library — `frontend/src/components/ui/`. Components reference
tokens; they never reference raw hex values. That is what makes the whole product
re-themeable from a single place, and what makes dark mode a token swap rather
than a `dark:` variant bolted onto every element.

There are no UI dependencies. No component library, no icon package, no charting
library. The icon set, the charts, the tables, the modals and the toasts are all
hand-built here. Two reasons: a premium interface is mostly a consistent
interface, which is far easier to guarantee when you own every pixel; and the
bundle stays small — 102 kB of shared JS for the whole dashboard.

---

## Contents

1. [Design principles](#design-principles)
2. [Colour](#colour)
3. [Semantic surfaces and dark mode](#semantic-surfaces-and-dark-mode)
4. [Typography](#typography)
5. [Spacing, radius and elevation](#spacing-radius-and-elevation)
6. [Motion](#motion)
7. [Component library](#component-library)
8. [Data tables on small screens](#data-tables-on-small-screens)
9. [The four states, always](#the-four-states-always)
10. [Charts](#charts)
11. [Icons](#icons)
12. [Accessibility](#accessibility)
13. [Extending the system](#extending-the-system)

---

## Design principles

**Data first, chrome second.** This is a tool people use all day to answer
questions about stock. Numbers get tabular figures, generous alignment and the
strongest contrast on the page. Decoration never competes with a quantity.

**Density with air.** Inventory tables are long. Rows are compact enough to show
a useful number of products without scrolling, but the gutters, the hairlines and
the generous vertical rhythm between sections keep it from feeling like a
spreadsheet.

**Depth from hairlines, not shadows.** Every raised surface is a 1px border plus
a soft, low-contrast shadow. Heavy drop shadows read as dated and make a dense
interface noisy.

**One of everything.** One focus ring. One card treatment. One way to show a
stock status. One empty state shape. Visual consistency is the whole budget.

**Nothing is a dead end.** Every empty state names the next action. Every error
offers a retry. Every destructive action is confirmed, and says what will happen.

---

## Colour

Three ramps and four semantic families, all defined in the `@theme` block.

### Brand — deep teal

`brand-50` → `brand-950`, anchored at `brand-600` `#137e87`.

Teal reads as operational and precise rather than playful. The specific reason it
is teal and not green or blue: in an inventory product, green and red are *data*
— they mean healthy stock and no stock. A green brand colour would constantly be
misread as a status. Teal sits adjacent to the semantic greens without colliding
with them.

`brand-600` is the primary action colour. `brand-700` is its hover. `brand-50`
and `brand-950` are the tinted backgrounds for brand-toned badges and alerts.

### Accent — ember coral

`ember-50` → `ember-900`, anchored at `ember-500` `#ff5a1f`.

Used sparingly and deliberately: the brandmark, the gradient terminus in the
marketing headline, one chart series. It supplies the "Fast" in Fast Sold without
turning the interface into a warning. It is never used for interactive state.

### Neutrals — cool ink

`ink-25` → `ink-950`. Slightly blue-cast rather than pure grey, so large flat
surfaces feel considered instead of washed out. `ink-50` is the app background in
light mode; `ink-950` is the page background in dark.

### Semantic families

Each has a `50`/`100` tint, a `500` base and `600`/`700` for text on tints.

| Family | Meaning in this product |
| --- | --- |
| `positive` | In stock. A completed action. A positive quantity change. |
| `caution` | Low stock. An adjustment. Something that needs attention but is not broken. |
| `critical` | Out of stock. A destructive action. A failure. |
| `info` | Neutral information. Outbound movements. The append-only notice on the ledger. |

The mapping is fixed product-wide. Out of stock is never amber; an adjustment is
never red. Status colour is information, so it has to mean the same thing on
every screen.

---

## Semantic surfaces and dark mode

Components never use `ink-50` or `#fff` directly. They use semantic tokens, which
are redefined under `.dark`:

| Token | Tailwind class | Light | Dark |
| --- | --- | --- | --- |
| `--surface-page` | `bg-surface-page` | `ink-50` | `ink-950` |
| `--surface-card` | `bg-surface-card` | `#ffffff` | `#0f171d` |
| `--surface-raised` | `bg-surface-raised` | `#ffffff` | `#162027` |
| `--surface-sunken` | `bg-surface-sunken` | `ink-100` | `#0a1014` |
| `--surface-inverse` | `bg-surface-inverse` | `ink-900` | `#ffffff` |
| `--border-subtle` | `border-border-subtle` | `ink-200` | `#1e2a33` |
| `--border-default` | `border-border-default` | `ink-300` | `#2a3841` |
| `--border-strong` | `border-border-strong` | `ink-400` | `#3c4c57` |
| `--text-primary` | `text-content-primary` | `ink-900` | `ink-50` |
| `--text-secondary` | `text-content-secondary` | `ink-600` | `ink-300` |
| `--text-tertiary` | `text-content-tertiary` | `ink-500` | `ink-400` |

Note what changes in dark mode: `card` and `raised` are identical in light mode
(both white, separated by shadow) and *diverge* in dark mode, because shadows do
not read on a dark background — elevation has to come from lightness instead.

An `@theme inline` block bridges these CSS variables into Tailwind utilities, so
`bg-surface-card` and `text-content-primary` work like any other colour utility.

### How the theme is applied

Light is primary. `system` is the default preference, so the product follows the
OS until the user chooses otherwise. `ThemeProvider` in `src/lib/theme.tsx` owns
the state and persists it to `localStorage` under `fastsold.theme`; a small
inline script in the document head applies the `.dark` class **before** hydration,
so there is no flash of the wrong theme on load. Storage access is wrapped in
try/catch — a private window falls back to `system` rather than breaking.

Adding a new colour means adding it in one place, with a `.dark` value. A
component that needs a `dark:` variant is usually a sign a token is missing.

---

## Typography

Three families, all with complete system fallback stacks so the page renders
correctly if the webfont never arrives:

- **`--font-sans`** — Inter. Body, UI, tables.
- **`--font-display`** — Inter Tight. Headings and marketing display type, set
  tighter because large text needs less tracking.
- **`--font-mono`** — JetBrains Mono. SKUs, batch numbers, references. Anything
  a person might read aloud, type, or compare character by character.

`h1`–`h4` automatically use the display family at weight 600 with `-0.02em`
tracking, so headings are consistent without a utility class.

### Display scale

For the marketing site, where the UI text scale runs out. Each step carries its
own line height and progressively tighter letter-spacing:

| Class | Size | Tracking |
| --- | --- | --- |
| `text-display-xs` | 1.5rem | -0.010em |
| `text-display-sm` | 1.875rem | -0.018em |
| `text-display-md` | 2.25rem | -0.022em |
| `text-display-lg` | 3rem | -0.026em |
| `text-display-xl` | 3.75rem | -0.030em |
| `text-display-2xl` | 4.5rem | -0.034em |

### Numerals

`table`, `.tabular` and anything with `[data-numeric]` get
`font-variant-numeric: tabular-nums` from the base layer. Every quantity in a
table or KPI therefore uses fixed-width digits, so columns of numbers align and
values do not jitter as they change. Body text keeps proportional figures, where
they read better.

Inter's `cv11` and `ss01` features are enabled globally — a single-storey `a` and
disambiguated `1`/`l`/`I`, which matters when someone is reading a SKU off a
screen.

---

## Spacing, radius and elevation

Spacing is Tailwind's default 0.25rem scale, plus three layout tokens:
`--spacing-sidebar` (16rem), `--spacing-sidebar-collapsed` (4.5rem) and
`--spacing-topbar` (4rem), so the shell's geometry is stated once.

Radii run `--radius-xs` 0.25rem through `--radius-3xl` 1.5rem. In practice:
`sm` for inline chips, `md`/`lg` for inputs and buttons, `xl` for cards (via
`card-surface`), `2xl`/`3xl` for marketing panels.

Six shadow steps plus `--shadow-glow` (a 4px brand-tinted halo used on focus and
on the active sidebar item). Each step is two layered shadows at low opacity
rather than one dark one.

### Pattern utilities

| Utility | Purpose |
| --- | --- |
| `container-page` | The page container: full width, centred, max 80rem, 1.25rem side padding rising to 2rem at ≥48rem. |
| `card-surface` | The card treatment — `surface-card`, 1px `border-subtle`, `radius-xl`, `shadow-sm`. |
| `grid-backdrop` | The faint 3rem grid behind the marketing hero and some empty states. |
| `text-gradient-brand` | Teal → ember text gradient, for the one headline that earns it. |
| `reveal` | Scroll-linked entrance via `animation-timeline: view()`, used on marketing sections. |

---

## Motion

Two easings: `--ease-out-quint` for almost everything (fast out, settles
gently) and `--ease-spring` for toasts, which earn a slight overshoot because
they appear uninvited and need to be noticed.

Seven named animations: `fade-in`, `rise`, `scale-in`, `slide-in-right`,
`slide-in-left`, `shimmer` (skeletons), `toast-in`. Durations are 180–400ms —
long enough to read as motion, short enough that nobody waits for the UI.

`prefers-reduced-motion: reduce` collapses every animation and transition to
0.01ms and disables smooth scrolling, in the base layer, for everything. It is
not opt-in per component.

---

## Component library

All under `frontend/src/components/ui/`. Every component is typed, forwards the
props of the element it renders, and takes `className` for one-off adjustment.

### `button.tsx`

`Button`, `ButtonLink`, `Spinner`.

Variants: `primary`, `secondary`, `ghost`, `subtle`, `danger`, `danger-subtle`,
`inverse`. Sizes: `xs`, `sm`, `md`, `lg`. Plus `icon`, `iconOnly`, `loading`
and `fullWidth`.

`loading` swaps in a spinner **and** disables the button, because the two always
belong together — a button that shows a spinner but still accepts clicks is a
duplicate-submission bug. `ButtonLink` exists so a navigation action can be a
real `<a>` while looking identical to a button.

### `field.tsx`

`Field`, `Input`, `PasswordInput`, `Textarea`, `Select`, `Checkbox`, `Switch`,
`RadioCardGroup`.

`Field` owns the label, the optional hint, the error message and the generated
id wiring (`aria-describedby`, `aria-invalid`), so no screen has to assemble that
by hand. Control sizes are `sm`/`md`/`lg`. `PasswordInput` has a show/hide
toggle. `RadioCardGroup` is the large tappable choice used for role selection and
report pickers.

### `card.tsx`

`Card` (with `flush` for tables that meet the edge), `CardHeader`, `CardBody`,
`CardFooter`, `KpiCard`, `Sparkline`, `StatList`.

`KpiCard` takes a value, an optional delta, a tone and an optional sparkline —
the dashboard's primary vocabulary.

### `badge.tsx`

`Badge` (tones `neutral`, `brand`, `positive`, `caution`, `critical`, `info`,
`ember`), plus the semantic wrappers that encode the product's fixed mappings so
no screen can get them wrong: `StockStatusBadge`, `MovementTypeBadge`,
`RoleBadge`, `ActiveBadge`, `CategoryChip`, `CountBubble`.

### `table.tsx`

`DataTable`, `TableSkeleton`, `SkeletonBar`, `Pagination`.

Columns are declared as data, not markup — see [Data tables on small
screens](#data-tables-on-small-screens). `Pagination` shows a windowed page list
(first, last, and a window around the current page) plus a per-page selector, and
states the range in words: *"Showing 26–50 of 94."*

### `states.tsx`

`EmptyState`, `ErrorState`, `LoadingState`, `CardSkeleton`, `KpiRowSkeleton`,
`Alert` (tones `info`, `positive`, `caution`, `critical`, `brand`), `PageHeader`.

### `modal.tsx`

`Modal` (sizes `sm`–`xl`), `ConfirmDialog`, `Drawer`.

Focus is trapped while open, restored on close; Escape closes; the body scroll
locks. `ConfirmDialog` takes a tone and a confirm label, and is the only way a
destructive action is allowed to happen.

### `toast.tsx`

`ToastProvider`, `useToast`. Tones `success`, `error`, `info`, `warning`.
Auto-dismissing, stacked, dismissible, announced politely to assistive tech.

### Others

`dropdown.tsx` (`Dropdown`, `RowActions`), `tabs.tsx` (`Tabs`, `TabLinks`,
`TabPanel`, `SegmentedControl`), `search-input.tsx` (debounced, with a clear
button), `chart.tsx`, `icon.tsx`.

### Layout and shared

`components/layout/` holds the shell: `sidebar` (collapsible to a 4.5rem rail),
`topbar` (⌘K search, quick-create, notification bell, theme, account),
`global-search` (the command palette), `app-shell` (route guard + mobile drawer).

`components/shared/` holds the cross-module pieces — most notably `filter-bar`,
which renders whichever filters a screen declares via `enabled={[...]}` and maps
them onto the API's shared filter contract.

---

## Data tables on small screens

A table is a desktop idiom. Shrinking one to 375px produces something technically
responsive and practically unusable, so `DataTable` does not shrink — it changes
form.

Columns are declared as objects, which is what makes two renderings possible from
one definition:

```tsx
const columns: Array<Column<Product>> = [
  { key: 'name', header: 'Product', primary: true, cell: (p) => <ProductCell product={p} /> },
  { key: 'category', header: 'Category', hideBelowLg: true, cell: (p) => p.category?.name },
  { key: 'qty', header: 'On hand', align: 'right', sortKey: 'quantity_on_hand',
    cell: (p) => formatQuantity(p.quantity_on_hand) },
  { key: 'actions', header: '', hideOnMobile: true, cell: (p) => <RowActions … /> },
];
```

- **`primary`** marks the column that becomes the card headline on mobile.
  Exactly one column should set it.
- **`hideBelowLg`** drops a column on narrow desktop and tablet widths, for
  information that matters less than the rest.
- **`hideOnMobile`** excludes a column from the card view entirely — used for the
  row-actions column, since cards get `mobileActions` instead.
- **`mobileLabel`** overrides the label shown beside a value on a card, for
  headers that only make sense above a column.
- **`sortKey`** is the value sent to the API. Omitting it makes the column
  unsortable, so no header invites a sort the backend cannot perform.

Below `md`, each row renders as a card: the `primary` column as the headline, the
rest as label/value pairs, `mobileActions` in the corner. The same data, the same
sort, a shape that works with a thumb.

Loading renders `skeletonRows` shimmer rows with the real column widths, so the
layout does not jump when data arrives.

---

## The four states, always

Every screen that fetches data handles four states, and `useAsync`
(`src/lib/use-async.ts`) returns exactly the four flags needed for them.

1. **Loading** — a skeleton shaped like the content, never a centred spinner on a
   blank page. The first paint should already show the layout.
2. **Empty** — `EmptyState` with an icon, a sentence explaining why it is empty,
   and the action that would fill it. "No products yet" with a *Create product*
   button, not "No results".
3. **Error** — `ErrorState` with the server's human message and a *Try again*
   button that re-runs the request. The message comes from the API's `message`
   field, because the backend already writes errors for people.
4. **Loaded** — the content.

Forms add two more, via `useSubmit`: a pending state (button `loading`, inputs
disabled) and a result — a toast on success, inline field errors on `422`, mapped
straight from Laravel's `errors` object onto the matching `Field`.

Insufficient stock is handled earlier than an error, on the stock-out form. The
FIFO preview runs as the quantity changes, so an over-withdrawal is shown as the
real available figure and a blocked submit button *before* the request is sent,
rather than discovered from a `422` afterwards. The server still rejects it
authoritatively — the preview is a courtesy, not the check.

---

## Charts

`chart.tsx` provides `MovementTrendChart` (dual-series area/line for stock in vs
out), `HorizontalBarChart` (category and supplier breakdowns) and `DonutChart`
(stock health composition). All three are inline SVG, drawn from the token
palette, sized by viewBox so they scale without a resize observer.

Every chart renders an `sr-only` `<table>` of the same data. A chart is a
visualisation of a dataset, and the dataset is the part that has to be
accessible — so the figures are always available to a screen reader, and always
correct, because both renderings come from one array.

Colour is never the only channel: series are labelled directly, the trend chart
differentiates by fill as well as hue, and the donut legend carries values.

---

## Icons

`icon.tsx` contains a hand-drawn set of ~60 glyphs on a 24px grid at 1.5px
stroke weight, referenced by name (`<Icon name="package" size={18} />`). Adding
one means adding a path to the union type and the map — which is the point: the
set cannot drift in weight or grid, and there is no icon dependency to version.

Icons are decorative by default (`aria-hidden`). Pass `label` to make one
meaningful, which is required when an icon is the only content of a control.

`BrandMark` is the standalone mark (stacked layers resolving into a forward
chevron — inventory in motion); `BrandLogo` is the mark plus the wordmark.

---

## Accessibility

Not a pass at the end; built into the components, so screens get it by default.

- **Focus** — one treatment everywhere: a 2px `brand-500` outline at 2px offset,
  via `:focus-visible`, so it appears for keyboard users and not on mouse click.
  Never removed.
- **Contrast** — body text, table text and every badge tone meet WCAG AA against
  their own surface, in both themes. Tertiary text is reserved for genuinely
  secondary content.
- **Keyboard** — every interactive element is reachable and operable. Modals and
  drawers trap focus and restore it on close. Dropdowns support arrow keys, Home
  and End, Escape. The command palette is ⌘K / Ctrl+K.
- **Semantics** — real `<table>` markup for tables, real `<button>` for actions,
  real `<a>` for navigation. `aria-sort` on sortable headers, `aria-current` on
  active navigation, `aria-invalid` and `aria-describedby` wired by `Field`.
- **Announcements** — toasts are a polite live region; table skeletons carry
  `aria-busy` in a polite live region, so a fetch is announced rather than
  silently replacing content.
- **Motion** — `prefers-reduced-motion` respected globally.
- **Targets** — interactive targets are at least 40px on touch, which is why the
  mobile card view exists instead of a shrunken table.
- **Colour is never the only signal** — stock status pairs a tone with a text
  label; movement direction pairs a tone with a sign and an icon.

---

## Extending the system

1. **Check whether a token already covers it.** Most "we need a new colour"
   moments are an existing semantic family used on the wrong surface.
2. **New colour → `globals.css`, with a `.dark` value.** If a component needs a
   `dark:` variant to look right, a semantic token is probably missing.
3. **New component → `components/ui/`,** matching the existing conventions:
   `className` passthrough, forwarded element props, tones named after the
   semantic families, sizes from the existing scales.
4. **New screen → compose existing components.** Reach for a new one only when
   the pattern genuinely does not exist yet; two near-identical components are
   worse than one slightly more general one.
5. **Handle all four states before calling a screen done.** A screen that only
   works when data is present is not finished.
6. **Run `npm run lint` and `npm run typecheck`.** Both are clean, and should
   stay that way.
