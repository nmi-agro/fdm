---
name: fdm-app
description: Calm, trustworthy farm-management workbench that turns raw farm data into connected agronomic insight.
colors:
  background: "#ffffff"
  foreground: "#020817"
  card: "#ffffff"
  card-foreground: "#020817"
  primary: "#0f172a"
  primary-foreground: "#f8fafc"
  secondary: "#f1f5f9"
  secondary-foreground: "#0f172a"
  muted: "#f1f5f9"
  muted-foreground: "#64748b"
  accent: "#f1f5f9"
  accent-foreground: "#0f172a"
  destructive: "#ef4444"
  destructive-foreground: "#f8fafc"
  border: "#e2e8f0"
  input: "#e2e8f0"
  ring: "#020817"
  sidebar: "#fafafa"
  sidebar-foreground: "#3f3f46"
  chart-1: "#e8743b"
  chart-2: "#19a3a3"
  chart-3: "#2d5b8a"
  chart-4: "#e9c44a"
  chart-5: "#e0962f"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  xl: "0.75rem"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-ghost:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
  input-default:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.25rem 0.75rem"
    height: "2.25rem"
  card-default:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
---

# Design System: fdm-app

## 1. Overview

**Creative North Star: "The Agronomist's Workbench"**

fdm-app is a quiet, expert tool that disappears into the task. The user comes with raw farm data they already know — fields, cultivations, soil analyses, fertilizer applications, harvests — and leaves with connected agronomic insight: nutrient balances, gebruiksruimte, advice, soil-health indicators, and spatial overviews. The interface earns trust by getting out of the way: a calm near-monochrome surface, a single well-tuned sans, and consistent shadcn/Radix components mean attention stays on the data and the decision, never on the chrome.

The personality is calm, trustworthy, and modern. Density is honest — tables, panels, and forms carry real information without decoration — but never cluttered for its own sake. Color is earned, not sprayed: the surface is neutral slate so that the few moments of hue (chart series, status, the current selection) read instantly. This is the opposite of an overselling consumer app or a cluttered legacy agri-portal; it should feel available to an individual advisor or farmer, not gated behind an enterprise wall.

The system explicitly rejects: clutter that buries insight, hype and unsubstantiated "we save your farm" flourishes, and enterprise-corporate coldness. Substance over spectacle, every screen.

**Key Characteristics:**
- Near-monochrome slate surface; hue reserved for data and state.
- One typeface (Inter) across headings, labels, body, and data.
- Flat by default; subtle shadows only as a response to state.
- Full light/dark parity via CSS custom properties.
- Standard, consistent component vocabulary (shadcn "new-york" + Radix).

## 2. Colors

A near-monochrome slate palette: white content surfaces, slate-tinted neutrals, a near-black primary, and a small set of saturated chart colors that carry all the data-visualization meaning.

### Primary
- **Slate Ink** (`#0f172a`, `hsl(222 47% 11%)`): Primary actions, the active/selected state, and high-emphasis text. In dark mode this inverts to near-white (`#f8fafc`) on a slate-950 surface. It is the closest thing to a brand color and stays deliberately neutral.

### Neutral
- **Paper** (`#ffffff`): Content background and card surface.
- **Sidebar Mist** (`#fafafa`, `hsl(0 0% 98%)`): The second neutral layer for the app-shell sidebar — a hair cooler/lighter than content so navigation reads as a distinct plane.
- **Slate Muted** (`#f1f5f9`, `hsl(210 40% 96%)`): Secondary buttons, hover fills, muted/accent surfaces.
- **Muted Ink** (`#64748b`, `hsl(215 16% 47%)`): Secondary text and captions. Use for de-emphasis only; body copy stays at full foreground for AA contrast.
- **Hairline** (`#e2e8f0`, `hsl(214 32% 91%)`): Borders, inputs, dividers.

### Tertiary (data only)
- **Chart series** (`#e8743b` terracotta, `#19a3a3` teal, `#2d5b8a` deep blue, `#e9c44a` ochre, `#e0962f` amber): The recharts/data-viz palette (`--chart-1..5`, authored in OKLCH). These are the only saturated colors on a normal screen. A separate, darker, more saturated set is used in dark mode.

### Status
- **Destructive Red** (`#ef4444`): Errors, destructive actions, invalid fields. Muted to a darker red in dark mode.

### Named Rules
**The Earned-Color Rule.** The surface is neutral by design. Saturated color appears only where it carries meaning — a chart series, a status, the current selection — never as decoration. If a color isn't encoding data or state, it shouldn't be on the screen.

## 3. Typography

**Display / Body / Label Font:** Inter (with `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"` fallbacks)

**Character:** One humanist-leaning grotesque doing all the work. No display/body pairing — product UI is better served by a single, well-hinted sans that stays legible from a 30px heading down to an 11px table label. Headings lean on weight and slightly negative tracking, not on a second family.

### Hierarchy
- **Display** (600, 1.875rem/30px, line-height 1.2, tracking -0.02em): Page titles and primary section headers. Fixed rem scale, never fluid clamp — a sidebar-embedded heading must not shrink.
- **Headline** (600, 1.5rem/24px, line-height 1.25): Card and panel headers.
- **Title** (600, 1.125rem/18px): Sub-section and dialog titles.
- **Body** (400, 0.875rem/14px, line-height 1.5): Default UI and prose text; cap prose at 65–75ch, data/tables may run denser.
- **Label** (500, 0.875rem/14px): Buttons, form labels, table headers, badges.

### Named Rules
**The One-Voice Rule.** Inter carries everything. No display serif, no second sans, no mono in UI labels. Hierarchy comes from weight (400/500/600) and size on a tight ~1.2 ratio, not from font changes.

## 4. Elevation

Mostly flat. Surfaces sit at rest with hairline borders doing the separation; depth is conveyed by the second neutral layer (sidebar vs. content) and by borders, not by a shadow stack. Shadows are reserved for state and true overlays.

### Shadow Vocabulary
- **Resting** (`shadow-xs` ≈ `0 1px 2px rgb(0 0 0 / 0.05)`): Buttons, inputs, and cards — a barely-there lift that reads as "interactive surface," not "floating."
- **Card** (`shadow` ≈ `0 1px 3px rgb(0 0 0 / 0.1)`): Default card containers.
- **Overlay** (popover/dialog/dropdown shadow): Genuinely floating layers (menus, dialogs, tooltips) that must detach from the page.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat and bordered at rest. A shadow is a signal — hover, focus, or a layer that genuinely floats above the page — never decoration. Don't stack shadows to fake hierarchy that a border or the sidebar layer already provides.

## 5. Components

Built on shadcn/ui ("new-york" style) over Radix primitives, styled with Tailwind v4 tokens. Refined and restrained: standard affordances, consistent shape, every interactive state defined.

### Buttons
- **Shape:** `rounded-md` (0.375rem); heights `sm` 2rem / default 2.25rem / `lg` 2.5rem.
- **Primary:** `bg-primary` slate ink + `text-primary-foreground`, `shadow-xs`, `px-4 py-2`. Hover: `bg-primary/90`.
- **Secondary:** `bg-secondary` slate-muted + dark text; hover `bg-secondary/80`.
- **Outline:** transparent on `bg-background` with a border; hover fills `bg-accent`.
- **Ghost / Link:** no fill; ghost hovers to `bg-accent`, link underlines.
- **Destructive:** `bg-destructive` red + white text.
- **Focus:** `focus-visible:ring-[3px]` ring/50 + border shift; `disabled:opacity-50 pointer-events-none`. Icons auto-size to 1rem.

### Cards / Containers
- **Corner Style:** `rounded-xl` (0.75rem).
- **Background:** `bg-card` (white / slate-950 in dark) + `text-card-foreground`.
- **Shadow Strategy:** resting `shadow` only (see Elevation). Never nest cards.
- **Border:** 1px hairline.
- **Internal Padding:** `p-6` (1.5rem); header uses `space-y-1.5`.

### Inputs / Fields
- **Style:** 1px `border-input`, transparent background, `rounded-md`, `h-9`, `px-3 py-1`, `shadow-xs`, 14px text.
- **Placeholder:** `text-muted-foreground` — still AA-legible, never the faint gray default.
- **Focus:** `focus-visible:ring-1 ring-ring`, outline removed.
- **Error / Disabled:** `aria-invalid` → destructive ring/border; `disabled:opacity-50 cursor-not-allowed`.

### Navigation
- **App shell:** persistent left sidebar on its own neutral layer (`--sidebar-*` tokens), collapsible. Active item uses `sidebar-accent` fill + accent-foreground text; hover is a quiet tint. Responsive behavior is structural (the sidebar collapses), not fluid type.

### Data Visualization (signature)
- Charts (recharts) draw from the five `--chart-*` tokens in series order; status and balance/indicator views must not rely on hue alone — pair color with label, icon, or value so they stay readable for color-vision deficiencies.

## 6. Do's and Don'ts

### Do:
- **Do** keep the surface neutral slate and spend saturated color only on data, status, and the current selection (the Earned-Color Rule).
- **Do** set every interactive component's default, hover, focus-visible, active, disabled, and error states before shipping it.
- **Do** keep body and placeholder text at AA contrast (≥4.5:1); bump muted gray toward the ink end rather than fading it for "elegance."
- **Do** use one Inter voice with weight/size for hierarchy; fixed rem sizes for headings, not fluid clamps.
- **Do** keep layouts working down to a 14-inch laptop and degrade advanced/spatial features gracefully on phones, with an explanation that they work best on desktop.
- **Do** pair every status/indicator color with a label, icon, or value so meaning survives color blindness and dark mode.

### Don't:
- **Don't** add clutter that buries the insight — this is "not another cluttered tool for farmers that is barely used."
- **Don't** oversell: no hype gradients, glow, or "we save your farm" flourishes; trust comes from transparent, auditable numbers.
- **Don't** make it feel enterprise-corporate or gated to big companies — keep it approachable for an individual advisor or farmer.
- **Don't** ask the user to enter derived values (e.g. total nitrogen input); capture only raw data they know and derive the rest.
- **Don't** use side-stripe `border-left`/`border-right` accents, gradient text, decorative glassmorphism, or display fonts in UI labels.
- **Don't** introduce a second typeface or reinvent standard affordances (custom scrollbars, non-standard modals); reach for a modal only after inline/progressive options are exhausted.
- **Don't** stack shadows to fake depth a hairline border or the sidebar layer already provides.
